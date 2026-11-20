// Solmar Bay — main loop and game state. Wires every module together:
// the seeded city, traffic, police, missions, combat, rendering, HUD,
// sound and saves. No network, no assets, everything procedural.
import { GAME, PLAYER, CAR, POLICE } from './config.js';
import { makeRng } from './random.js';
import { buildWorld, hitsBuilding } from './world.js';
import {
  spawnTraffic, spawnParked, spawnPedestrians, updateTraffic,
  updatePedestrians, checkCarPedCollisions, addWanted,
} from './traffic.js';
import { updatePolice } from './police.js';
import { shoot, updateBullets, shove } from './combat.js';
import {
  newMissionState, startMission, updateMissions, updateParcels,
  updateRider, spawnParcel,
} from './missions.js';
import { render } from './render.js';
import { drawHud, drawTitle, drawPause, drawDead, drawBusted } from './hud.js';
import { SoundEngine } from './audio.js';
import { createInput } from './input.js';
import { shotName, setupShot, simulateShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = GAME.viewWidth;
canvas.height = GAME.viewHeight;
const ctx = canvas.getContext('2d');

export function createState(seed) {
  const rng = makeRng(seed);
  const world = buildWorld(rng);
  const state = {
    seed,
    rng,
    world,
    ctx,
    time: 0,
    clock: 10.5, // 10:30 in the morning — sun-soaked Solmar Bay.
    screen: 'title',
    player: {
      x: world.start.x,
      y: world.start.y,
      angle: 0,
      aimAngle: 0,
      health: PLAYER.maxHealth,
      money: PLAYER.startMoney,
      ammo: PLAYER.startAmmo,
      car: null,
      shootCooldown: 0,
    },
    cars: [...spawnParked(world), ...spawnTraffic(world, rng)],
    peds: spawnPedestrians(world, rng),
    police: [],
    bullets: [],
    parcels: [],
    parcelIndex: 0,
    rider: null,
    riderIndex: 0,
    riderTimer: 18,
    wanted: 0,
    wantedFlash: 0,
    evadeTimer: 0,
    decayTimer: 0,
    arrestTimer: 0,
    mission: newMissionState(),
    message: '',
    messageT: 0,
    camera: { x: world.start.x, y: world.start.y },
    events: [],
    sound: new SoundEngine(),
    hasSave: false,
  };
  state.cars.forEach((c) => { if (c.traffic) c.cruise = c.speed; });
  spawnParcel(state);
  return state;
}

const state = createState(GAME.seed);
const input = createInput(canvas);
state.input = input;
window.__solmar = state;

try {
  const raw = localStorage.getItem(GAME.saveKey);
  if (raw) state.hasSave = true;
} catch { state.hasSave = false; }

function saveGame() {
  try {
    localStorage.setItem(GAME.saveKey, JSON.stringify({
      money: state.player.money,
      missionIndex: state.mission.index,
      health: state.player.health,
      ammo: state.player.ammo,
      x: state.player.x,
      y: state.player.y,
      clock: state.clock,
    }));
    state.message = 'Game saved.';
    state.messageT = 2;
  } catch { /* storage unavailable — the game still plays */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(GAME.saveKey);
    if (!raw) return false;
    const s = JSON.parse(raw);
    state.player.money = s.money;
    state.mission.index = s.missionIndex;
    state.player.health = s.health;
    state.player.ammo = s.ammo;
    state.player.x = s.x;
    state.player.y = s.y;
    state.clock = s.clock;
    state.player.car = null;
    state.wanted = 0;
    state.police = [];
    return true;
  } catch { return false; }
}

function respawn() {
  state.player.x = state.world.safehouse.x;
  state.player.y = state.world.safehouse.y;
  state.player.health = PLAYER.maxHealth;
  state.player.car = null;
  state.wanted = 0;
  state.police = [];
  state.arrestTimer = 0;
  state.screen = 'play';
}

function nearestCar(maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function moveWithCollision(x, y, nx, ny, radius) {
  // Move one axis at a time so Rico slides along building walls.
  if (!hitsBuilding(state.world, nx, y, radius) && nx > 150 && nx < state.world.width - 20) x = nx;
  if (!hitsBuilding(state.world, x, ny, radius) && ny > 20 && ny < state.world.height - 20) y = ny;
  return { x, y };
}

function updatePlayer(dt) {
  const p = state.player;
  const keys = input.keys;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);

  if (p.car) {
    const car = p.car;
    const forward = keys.has('w') || keys.has('ArrowUp');
    const back = keys.has('s') || keys.has('ArrowDown');
    const left = keys.has('a') || keys.has('ArrowLeft');
    const right = keys.has('d') || keys.has('ArrowRight');
    if (forward) car.speed += CAR.accel * dt;
    if (back) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
    if (!forward && !back) car.speed -= car.speed * CAR.drag * dt;
    if (keys.has(' ')) car.speed -= car.speed * 4 * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (Math.abs(car.speed) > 20) {
      car.angle += steer * CAR.steer * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 200);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = hitsBuilding(state.world, nx, ny, 22);
    if (hit) {
      car.speed *= -0.25;
      p.health = Math.max(0, p.health - Math.abs(car.speed) * 0.004);
    } else {
      car.x = Math.max(150, Math.min(state.world.width - 20, nx));
      car.y = Math.max(20, Math.min(state.world.height - 20, ny));
    }
    // Bump other cars aside.
    for (const other of state.cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 48 && d > 0.01) {
        const push = (48 - d) / 2;
        const ux = (other.x - car.x) / d;
        const uy = (other.y - car.y) / d;
        other.x += ux * push;
        other.y += uy * push;
        if (other.traffic) other.stunned = 0.6;
        car.speed *= 0.85;
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (input.wasPressed('e')) {
      const side = car.angle + Math.PI / 2;
      const pos = moveWithCollision(p.x, p.y, car.x + Math.cos(side) * 40, car.y + Math.sin(side) * 40, 14);
      p.x = pos.x;
      p.y = pos.y;
      car.speed = 0;
      p.car = null;
      state.sound.click();
    }
    return;
  }

  // On foot.
  let dx = 0;
  let dy = 0;
  if (keys.has('w') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('s') || keys.has('ArrowDown')) dy += 1;
  if (keys.has('a') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('d') || keys.has('ArrowRight')) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const speed = (keys.has('Shift')) ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const pos = moveWithCollision(p.x, p.y, p.x + (dx / len) * speed * dt, p.y + (dy / len) * speed * dt, PLAYER.radius);
    p.x = pos.x;
    p.y = pos.y;
    p.angle = Math.atan2(dy, dx);
  }
  // Aim with the mouse, in world coordinates.
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const worldMouseX = state.camera.x - GAME.viewWidth / 2 + input.mouseX;
  const worldMouseY = state.camera.y - GAME.viewHeight / 2 + input.mouseY;
  void scaleX; void scaleY;
  p.aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
  if (input.mouseDown && p.shootCooldown <= 0) shoot(state);

  if (input.wasPressed('e')) {
    const car = nearestCar(75);
    if (car) {
      p.car = car;
      car.parked = false;
      if (car.traffic) {
        car.traffic = false;
        car.stunned = 0;
      }
      if (!car.stolen) {
        car.stolen = true;
        addWanted(state, 1);
        state.message = 'Car stolen! The cops noticed.';
        state.messageT = 3;
      }
      state.sound.enterCar();
    }
  }
  if (input.wasPressed('f')) {
    if (!shove(state)) {
      // No one to shove — try hailing a taxi fare instead.
      if (state.rider && state.rider.state === 'waiting') {
        const d = Math.hypot(state.player.x - state.rider.x, state.player.y - state.rider.y);
        if (d < 60 && !p.car) {
          state.message = 'You need a car to take fares.';
          state.messageT = 2;
        }
      }
    }
  }
}

function update(dt, autopilot = false) {
  state.clock = (state.clock + dt * 0.02) % 24;
  if (state.messageT > 0) state.messageT -= dt;
  if (state.wantedFlash > 0) state.wantedFlash -= dt;
  state.events = [];

  if (state.screen !== 'play') return;
  updatePlayer(dt);
  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  checkCarPedCollisions(state);
  updatePolice(state, dt);
  updateBullets(state, dt);
  updateMissions(state, dt);
  updateParcels(state, dt);
  updateRider(state, dt);

  // Camera follows the player, clamped to the city.
  const tx = Math.max(GAME.viewWidth / 2 - 100, Math.min(state.world.width - GAME.viewWidth / 2 + 100, state.player.x));
  const ty = Math.max(GAME.viewHeight / 2 - 100, Math.min(state.world.height - GAME.viewHeight / 2 + 100, state.player.y));
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 4);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 4);

  // Sound follows the action.
  const speed = state.player.car ? state.player.car.speed : 0;
  state.sound.setEngine(speed, !!state.player.car);
  state.sound.setSiren(state.wanted, state.time);

  if (state.player.health <= 0 && state.screen === 'play') {
    state.screen = 'dead';
    state.sound.busted();
  }
  void autopilot;
}

state.update = update;
state.render = () => {
  render(state);
  if (state.screen === 'play') drawHud(state);
  else if (state.screen === 'title') drawTitle(state, state.hasSave);
  else if (state.screen === 'pause') drawPause(state);
  else if (state.screen === 'dead') drawDead(state);
  else if (state.screen === 'busted') drawBusted(state);
};

function handleScreens() {
  if (input.wasPressed('m')) {
    state.sound.muted = !state.sound.muted;
    state.message = state.sound.muted ? 'Sound muted.' : 'Sound on.';
    state.messageT = 1.5;
  }
  if (state.screen === 'title') {
    if (input.wasPressed('Enter')) {
      state.sound.ensure();
      state.sound.click();
      state.screen = 'play';
      state.mission.dialogue = 'Mara: Rico! First job — steal a car and bring it to my garage on Coral Row. Press Enter to start the job.';
      state.mission.dialogueT = 8;
    } else if (input.wasPressed('c') && state.hasSave) {
      state.sound.ensure();
      if (loadGame()) {
        state.screen = 'play';
        state.message = 'Welcome back, Rico.';
        state.messageT = 3;
      }
    }
    return;
  }
  if (state.screen === 'play') {
    if (input.wasPressed('p') || input.wasPressed('Escape')) {
      state.screen = 'pause';
      state.sound.click();
    } else if (input.wasPressed('Enter') && state.mission.stage === 'intro') {
      state.sound.ensure();
      startMission(state);
    }
    return;
  }
  if (state.screen === 'pause') {
    if (input.wasPressed('p') || input.wasPressed('Escape')) state.screen = 'play';
    else if (input.wasPressed('s')) saveGame();
    else if (input.wasPressed('r')) {
      const fresh = createState(GAME.seed);
      Object.assign(state, fresh);
      state.screen = 'play';
    }
    return;
  }
  if (state.screen === 'dead' || state.screen === 'busted') {
    if (input.wasPressed('Enter')) {
      if (state.screen === 'busted') state.player.money = Math.max(0, state.player.money - 100);
      respawn();
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  state.time += dt; // the animation clock runs on every screen, menus included.
  handleScreens();
  update(dt);
  state.render();
  input.endFrame();
  requestAnimationFrame(frame);
}

// Shot staging: ?shot=start|drive|chase|mission stages a live scene and
// flags it ready for the screenshot tool.
const shot = shotName();
if (shot) {
  state.sound.ensure();
  setupShot(state, shot);
  simulateShot(state, 90);
  // Keep rendering so the scene stays alive behind the shot.
  requestAnimationFrame(frame);
} else {
  requestAnimationFrame(frame);
}
