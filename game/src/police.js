// The wanted system and the Solmar Bay police: stars rise on crimes, cruisers
// spawn and chase, and the heat fades only once the player is out of sight.
// All spawns and choices use the state's seeded generator.

import { CAR, POLICE_SPEED, WANTED_DECAY_SECONDS } from './config.js';
import { angleDiff, angleTo, collideCircle, dist, nearestRoadPoint } from './world.js';
import { chance, pick, range } from './random.js';

export const MAX_WANTED = 5;

/** Raise the wanted level (capped at 5) and restart the decay clock. */
export function addWanted(state, stars) {
  if (state.crimeCooldown > 0 && stars <= 1) return state.wanted;
  state.wanted = Math.min(MAX_WANTED, state.wanted + stars);
  state.wantedTimer = WANTED_DECAY_SECONDS;
  state.crimeCooldown = 1.2;
  return state.wanted;
}

/** Heat fades after a quiet stretch with no cruiser close by. */
export function updateWanted(state, dt) {
  if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
  if (state.wanted === 0) return;
  const nearest = nearestPoliceDist(state);
  if (nearest > 700) {
    state.wantedTimer -= dt;
    if (state.wantedTimer <= 0) {
      state.wanted -= 1;
      state.wantedTimer = WANTED_DECAY_SECONDS;
    }
  } else {
    state.wantedTimer = Math.max(state.wantedTimer, 4);
  }
}

function nearestPoliceDist(state) {
  let best = Infinity;
  for (const cop of state.police) {
    const d = dist(cop, state.player);
    if (d < best) best = d;
  }
  return best;
}

/** Keep the right number of cruisers on the street for the current heat. */
export function updatePoliceSpawns(state, dt) {
  const want = Math.min(state.wanted, 4);
  // Despawn cruisers that fell far behind once the heat drops.
  for (let i = state.police.length - 1; i >= 0; i -= 1) {
    const cop = state.police[i];
    if (state.wanted === 0 && dist(cop, state.player) > 900) state.police.splice(i, 1);
  }
  if (state.police.length >= want) return;
  if (state.wanted === 0) return;
  const spawnTimer = state.policeSpawnTimer ?? 0;
  if (spawnTimer > 0) {
    state.policeSpawnTimer = spawnTimer - dt;
    return;
  }
  state.policeSpawnTimer = 1.4;
  const { rng } = state;
  const player = state.player;
  const angle = range(rng, 0, Math.PI * 2);
  const spot = {
    x: player.x + Math.cos(angle) * range(rng, 620, 900),
    y: player.y + Math.sin(angle) * range(rng, 620, 900),
  };
  const road = nearestRoadPoint(state, spot.x, spot.y);
  const cop = {
    id: `cop${state.time.toFixed(0)}${state.police.length}`,
    kind: 'police',
    x: road.x, y: road.y,
    angle: angleTo(road, player),
    speed: 0, vx: 0, vy: 0,
    color: '#1e3a5f', hp: 100,
    siren: range(rng, 0, 1),
    ramCooldown: 0,
    bustedHold: 0,
  };
  state.police.push(cop);
}

/** Cruisers steer at the player and ram; on foot, a long touch means busted. */
export function updatePolice(state, dt) {
  const player = state.player;
  const playerCar = player.inCar ? state.cars.find((c) => c.id === player.inCar) : null;
  const target = playerCar ?? player;
  for (const cop of state.police) {
    cop.siren += dt;
    if (cop.ramCooldown > 0) cop.ramCooldown -= dt;
    const desired = angleTo(cop, target);
    const diff = angleDiff(cop.angle, desired);
    cop.angle += Math.max(-2.9 * dt, Math.min(2.9 * dt, diff));
    const d = dist(cop, target);
    const wantSpeed = d > 700 ? POLICE_SPEED : POLICE_SPEED * 0.92;
    cop.speed += (wantSpeed - cop.speed) * Math.min(1, dt * 1.4);
    cop.vx = Math.cos(cop.angle) * cop.speed;
    cop.vy = Math.sin(cop.angle) * cop.speed;
    cop.x += cop.vx * dt;
    cop.y += cop.vy * dt;
    const fixed = collideCircle(state, cop.x, cop.y, CAR.radius);
    if (fixed.x !== cop.x || fixed.y !== cop.y) {
      cop.x = fixed.x;
      cop.y = fixed.y;
      cop.speed *= 0.55;
      cop.angle += 0.7;
    }
    // Ram: shove the player's car and hurt the player; touch on foot to bust.
    if (d < CAR.radius + 24 && cop.ramCooldown <= 0) {
      cop.ramCooldown = 0.8;
      if (playerCar) {
        playerCar.vx = (playerCar.vx ?? 0) + Math.cos(cop.angle) * 160;
        playerCar.vy = (playerCar.vy ?? 0) + Math.sin(cop.angle) * 160;
        hurtPlayer(state, 6);
        state.particles.push({ x: cop.x, y: cop.y, vx: 0, vy: 0, life: 0.4, max: 0.4, kind: 'spark', size: 6 });
      } else {
        cop.bustedHold += dt;
        hurtPlayer(state, 4);
        if (cop.bustedHold > 1.4) {
          state.busted = true;
          return;
        }
      }
    } else if (d > CAR.radius + 60) {
      cop.bustedHold = 0;
    }
    // Cruisers push traffic aside.
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      if (dist(cop, car) < 70) {
        car.speed = Math.max(40, car.speed - 120 * dt);
      }
    }
  }
}

export function hurtPlayer(state, amount) {
  const player = state.player;
  if (player.hurtCooldown > 0 || state.over) return;
  player.health -= amount;
  player.hurtCooldown = 0.5;
  if (player.health <= 0) {
    player.health = 0;
    state.over = true;
  }
}
