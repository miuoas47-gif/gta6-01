// Traffic cars and pedestrians: simple city life on the road grid.
// Traffic cars drive along roads and turn at intersections; pedestrians
// stroll the sidewalks and scatter when a car comes close.
import { GAME, PALETTE, CAR } from './config.js';
import { nearestRoadPoint, onRoad } from './world.js';

export function spawnTraffic(world, rng) {
  const cars = [];
  for (let i = 0; i < 14; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(world.roadsV) : rng.pick(world.roadsH);
    const along = rng.range(300, (vertical ? world.height : world.width) - 300);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = dir > 0 ? 20 : -20;
    cars.push({
      id: 'traffic-' + i,
      x: vertical ? road + lane : along,
      y: vertical ? along : road + lane,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: rng.range(120, 190),
      dir,
      vertical,
      road,
      color: rng.pick(PALETTE.carColors),
      kind: 'sedan',
      traffic: true,
      stunned: 0,
    });
  }
  return cars;
}

export function spawnParked(world) {
  return world.parked.map((p, i) => ({
    id: 'parked-' + i,
    x: p.x,
    y: p.y,
    angle: p.angle,
    speed: 0,
    color: p.color,
    kind: p.kind,
    traffic: false,
    parked: true,
    stolen: false,
  }));
}

export function spawnPedestrians(world, rng) {
  const peds = [];
  const shirts = ['#e8b13d', '#4a9bd9', '#d97ab5', '#7ad9a1', '#e8e8e8', '#b57ad9', '#d96a4a'];
  for (let i = 0; i < 26; i++) {
    const x = rng.range(GAME.beachWidth + 60, world.width - 120);
    const y = rng.range(120, world.height - 120);
    const road = nearestRoadPoint(world, x, y);
    const px = road.vertical ? road.x + (rng.chance(0.5) ? 66 : -66) : x;
    const py = road.vertical ? y : road.y + (rng.chance(0.5) ? 66 : -66);
    peds.push({
      id: 'ped-' + i,
      x: px,
      y: py,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 52),
      shirt: rng.pick(shirts),
      state: 'walk',
      panic: 0,
      wanderT: rng.range(2, 6),
      targetAngle: rng.range(0, Math.PI * 2),
      down: false,
      downT: 0,
    });
  }
  return peds;
}

// One traffic step: follow the road, turn at a random intersection, and
// stop briefly when another car is right ahead.
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (!car.traffic) continue;
    if (car.stunned > 0) { car.stunned -= dt; car.speed = 0; continue; }
    const roadGap = GAME.roadGap;
    let aheadX = car.x + Math.cos(car.angle) * 70;
    let aheadY = car.y + Math.sin(car.angle) * 70;
    let blocked = false;
    for (const other of state.cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - aheadX, other.y - aheadY);
      if (d < 46) { blocked = true; break; }
    }
    if (state.player.car === car) blocked = false;
    const targetSpeed = blocked ? 0 : car.cruise || 160;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Turn at intersections: pick a new road direction from the seeded RNG.
    const nearV = state.world.roadsV.find((rx) => Math.abs(car.x - rx) < 14);
    const nearH = state.world.roadsH.find((ry) => Math.abs(car.y - ry) < 14);
    if (nearV !== undefined && nearH !== undefined && state.rng.chance(dt * 0.9)) {
      const turn = state.rng.pick(['straight', 'left', 'right']);
      if (turn === 'left') car.angle += Math.PI / 2;
      if (turn === 'right') car.angle -= Math.PI / 2;
      car.angle = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
      const lane = 20;
      if (car.angle === 0) { car.y = nearH + lane; car.vertical = false; }
      else if (Math.abs(car.angle) === Math.PI) { car.y = nearH - lane; car.vertical = false; }
      else if (car.angle === Math.PI / 2) { car.x = nearV - lane; car.vertical = true; }
      else if (car.angle === -Math.PI / 2) { car.x = nearV + lane; car.vertical = true; }
    }
    // Wrap around the city edge instead of driving into the sea.
    if (car.x < GAME.beachWidth + 80) { car.x = GAME.beachWidth + 80; car.angle = Math.PI; }
    if (car.x > state.world.width - 60) { car.x = state.world.width - 60; car.angle = 0; }
    if (car.y < 60) { car.y = 60; car.angle = Math.PI / 2; }
    if (car.y > state.world.height - 60) { car.y = state.world.height - 60; car.angle = -Math.PI / 2; }
  }
}

export function updatePedestrians(state, dt) {
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downT -= dt;
      if (ped.downT <= 0) { ped.down = false; ped.panic = 0; }
      continue;
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += Math.cos(ped.angle) * 120 * dt;
      ped.y += Math.sin(ped.angle) * 120 * dt;
    } else {
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = state.rng.range(3, 7);
        ped.targetAngle = state.rng.range(0, Math.PI * 2);
      }
      ped.angle += (ped.targetAngle - ped.angle) * Math.min(1, dt * 2);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    // Stay in town and out of the water.
    ped.x = Math.max(GAME.beachWidth + 30, Math.min(state.world.width - 30, ped.x));
    ped.y = Math.max(30, Math.min(state.world.height - 30, ped.y));
    // A car bearing down makes a pedestrian panic and run.
    for (const car of state.cars) {
      if (car.speed < 60) continue;
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d < 90 && ped.panic <= 0) {
        ped.panic = 1.6;
        ped.angle = Math.atan2(ped.y - car.y, ped.x - car.x);
      }
    }
  }
}

// A car hitting a pedestrian knocks them down and counts as a crime.
export function checkCarPedCollisions(state) {
  for (const car of state.cars) {
    if (Math.abs(car.speed) < 80) continue;
    for (const ped of state.peds) {
      if (ped.down) continue;
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d < 30) {
        ped.down = true;
        ped.downT = 6;
        if (car === state.player.car) {
          state.events.push({ type: 'ped-hit', x: ped.x, y: ped.y });
          addWanted(state, 1);
        }
      }
    }
  }
}

export function addWanted(state, stars) {
  if (state.wanted >= 5) return;
  state.wanted = Math.min(5, state.wanted + stars);
  state.evadeTimer = 0;
  state.wantedFlash = 1;
}
