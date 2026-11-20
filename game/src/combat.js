// Combat: the pistol and the fist. Bullets fly from the player toward the
// mouse, hurt pedestrians, cars and cruisers, and always draw attention.
// Melee is a short swing for when someone is close.

import { BULLET_RANGE, BULLET_SPEED, PISTOL_DAMAGE, PLAYER } from './config.js';
import { angleTo, dist } from './world.js';
import { addWanted } from './police.js';

export function shoot(state, worldAngle) {
  const player = state.player;
  if (player.ammo <= 0) return false;
  if (player.inCar) return false;
  player.ammo -= 1;
  state.stats.shotsFired += 1;
  state.bullets.push({
    x: player.x + Math.cos(worldAngle) * 20,
    y: player.y + Math.sin(worldAngle) * 20,
    vx: Math.cos(worldAngle) * BULLET_SPEED,
    vy: Math.sin(worldAngle) * BULLET_SPEED,
    travelled: 0,
  });
  state.particles.push({
    x: player.x + Math.cos(worldAngle) * 26, y: player.y + Math.sin(worldAngle) * 26,
    vx: 0, vy: 0, life: 0.12, max: 0.12, kind: 'flash', size: 10,
  });
  addWanted(state, 1);
  return true;
}

export function melee(state) {
  const player = state.player;
  if (player.punchCooldown > 0 || player.inCar) return false;
  player.punchCooldown = 0.45;
  const reach = PLAYER.punchRange;
  let hit = false;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(player, ped) < reach) {
      ped.state = 'down';
      ped.down = 3;
      hit = true;
    }
  }
  if (hit) addWanted(state, 1);
  return hit;
}

export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += BULLET_SPEED * dt;
    let dead = b.travelled > BULLET_RANGE;
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (dist(b, ped) < 16) {
        ped.state = 'down';
        ped.down = 5;
        dead = true;
        break;
      }
    }
    // Cars and cruisers take damage and slow down.
    if (!dead) {
      for (const car of [...state.cars, ...state.police]) {
        if (dist(b, car) < 28) {
          car.hp -= PISTOL_DAMAGE;
          car.speed = Math.max(0, (car.speed ?? 0) - 60);
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, kind: 'spark', size: 4 });
      state.bullets.splice(i, 1);
    }
  }
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += (p.vx ?? 0) * dt;
    p.y += (p.vy ?? 0) * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

/** Pick up cash lying on the sidewalk. */
export function checkPickups(state) {
  const player = state.player;
  if (!player.onFoot) return 0;
  let gained = 0;
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    if (dist(player, pickup) < 30) {
      pickup.taken = true;
      player.money += pickup.value;
      gained += pickup.value;
    }
  }
  return gained;
}
