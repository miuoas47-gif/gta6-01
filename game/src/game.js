// One fixed step of Solmar Bay: read the input, move the player, run every
// system, and report what happened as bit flags. The screenshot autopilot
// calls this exact function, so a staged scene plays by the real rules.

import { CAR, PLAYER } from './config.js';
import {
  angleTo, collideCircle, dist, EVENT_BUSTED, EVENT_CRIME, EVENT_DEAD,
  EVENT_MISSION_DONE, EVENT_PICKUP, EVENT_SHOT,
} from './world.js';
import { checkCarPedHits, driveCar, updatePeds, updateTraffic } from './traffic.js';
import { addWanted, hurtPlayer, updatePolice, updatePoliceSpawns, updateWanted } from './police.js';
import { checkPickups, melee, shoot, updateBullets, updateParticles } from './combat.js';
import { retryMission, startMission, updateMissions, updateTaxi } from './missions.js';

function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    const d = dist(state.player, car);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(state) {
  const player = state.player;
  const car = nearestCar(state, 78);
  if (!car) return;
  const stolen = car.kind === 'traffic' || car.kind === 'parked';
  car.kind = 'player';
  car.driver = null;
  player.inCar = car.id;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  if (stolen) {
    state.stats.carsStolen += 1;
    addWanted(state, 1);
  }
}

function exitCar(state) {
  const player = state.player;
  const car = state.cars.find((c) => c.id === player.inCar);
  if (!car) { player.inCar = null; player.onFoot = true; return; }
  car.speed = 0;
  car.vx = 0;
  car.vy = 0;
  const side = player.angle + Math.PI / 2;
  const spot = collideCircle(state, car.x + Math.cos(side) * 42, car.y + Math.sin(side) * 42, PLAYER.radius);
  player.x = spot.x;
  player.y = spot.y;
  player.inCar = null;
  player.onFoot = true;
}

/** One fixed step. `input` carries axes(), mouse() and takeActions() (or a synthetic twin). */
export function stepGame(state, input, dt, audio) {
  let events = 0;
  state.time += dt;
  state.clockMin = (8 * 60 + 12 + state.time * 0.5) % 1440;
  const player = state.player;
  const axes = input.axes();
  const actions = input.takeActions ? input.takeActions() : 0;
  const mouse = input.mouse ? input.mouse() : { x: 0, y: 0, down: false };

  if (player.hurtCooldown > 0) player.hurtCooldown -= dt;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  player.fireCooldown = Math.max(0, (player.fireCooldown ?? 0) - dt);

  // First mission starts the moment play begins (pendingMission unset means
  // no later mission is queued yet).
  if (!state.mission && state.missionIndex === 0 && state.pendingMission == null) {
    startMission(state, 0);
  }

  if (actions & 16) retryMission(state); // M: retry the current mission.

  if (player.onFoot) {
    // Move on foot, sliding along walls.
    let mx = axes.x;
    let my = axes.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      const nx = player.x + mx * PLAYER.speed * dt;
      const ny = player.y + my * PLAYER.speed * dt;
      const fixed = collideCircle(state, nx, ny, PLAYER.radius);
      player.x = fixed.x;
      player.y = fixed.y;
      player.walkPhase += dt * 9;
      player.angle = Math.atan2(my, mx);
    }
    // Aim at the mouse; click (or hold) to fire the pistol.
    if (mouse.worldX !== undefined) {
      player.aimAngle = angleTo(player, { x: mouse.worldX, y: mouse.worldY });
    }
    if (mouse.down && player.fireCooldown <= 0 && player.ammo > 0) {
      if (shoot(state, player.aimAngle ?? player.angle)) {
        player.fireCooldown = 0.28;
        events |= EVENT_SHOT;
        audio?.shot();
      }
    }
    if (actions & 8) { // F: punch.
      if (melee(state)) { events |= EVENT_CRIME; audio?.punch(); }
    }
    if (actions & 4) enterCar(state); // E: get in.
  } else {
    const car = state.cars.find((c) => c.id === player.inCar);
    if (car) {
      const speed = driveCar(state, car, axes, dt);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      if (Math.abs(speed) > 200) audio?.update?.(speed, state.wanted, dt);
      const hits = checkCarPedHits(state);
      if (hits > 0) {
        state.stats.pedsHit += hits;
        addWanted(state, 1);
        events |= EVENT_CRIME;
        audio?.crash();
      }
    }
    if (actions & 4) exitCar(state); // E: get out.
  }

  // Traffic can run the player down on foot.
  if (player.onFoot) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      if (dist(player, car) < 30 && Math.abs(car.speed ?? 0) > 80) {
        hurtPlayer(state, 12);
        const away = angleTo(car, player);
        const fixed = collideCircle(state, player.x + Math.cos(away) * 40, player.y + Math.sin(away) * 40, PLAYER.radius);
        player.x = fixed.x;
        player.y = fixed.y;
      }
    }
  }

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateWanted(state, dt);
  updatePoliceSpawns(state, dt);
  updatePolice(state, dt);
  if (updateMissions(state, dt)) {
    events |= EVENT_MISSION_DONE;
    audio?.mission();
  }
  updateTaxi(state, dt);
  const gained = checkPickups(state);
  if (gained > 0) {
    events |= EVENT_PICKUP;
    audio?.pickup();
  }

  // Camera eases toward the player.
  const target = player.inCar
    ? state.cars.find((c) => c.id === player.inCar) ?? player
    : player;
  state.camera.x += (target.x - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (target.y - state.camera.y) * Math.min(1, dt * 5);
  if (state.time < 0.1) {
    state.camera.x = target.x;
    state.camera.y = target.y;
  }

  if (player.health <= 0) state.over = true;
  if (state.over) events |= EVENT_DEAD;
  if (state.busted) events |= EVENT_BUSTED;
  return events;
}
