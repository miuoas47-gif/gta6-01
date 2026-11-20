// Combat: Rico's pistol, aimed with the mouse, plus a shove on foot.
// Shooting is a crime — it raises the wanted level and draws the police.
import { addWanted } from './traffic.js';

export function shoot(state) {
  if (state.player.ammo <= 0) {
    state.sound.empty();
    state.message = 'Out of ammo — find an ammo crate by the garage.';
    state.messageT = 2;
    return;
  }
  state.player.ammo -= 1;
  state.player.shootCooldown = 0.22;
  const a = state.player.aimAngle;
  state.bullets.push({
    x: state.player.x + Math.cos(a) * 20,
    y: state.player.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 900,
    vy: Math.sin(a) * 900,
    life: 0.6,
  });
  state.sound.shot();
  addWanted(state, 1);
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Hit a pedestrian.
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.hypot(b.x - ped.x, b.y - ped.y) < 16) {
        ped.down = true;
        ped.downT = 8;
        b.life = 0;
        state.events.push({ type: 'shot-hit', x: ped.x, y: ped.y });
        break;
      }
    }
    // Hit a police cruiser: it backs off, stunned.
    for (const cop of state.police) {
      if (Math.hypot(b.x - cop.x, b.y - cop.y) < 30) {
        cop.speed = 40;
        cop.x -= Math.cos(b.vx > 0 ? 0 : 0) * 0;
        b.life = 0;
        state.events.push({ type: 'shot-hit', x: cop.x, y: cop.y });
        break;
      }
    }
    // Hit a traffic car: it stops, driver stunned.
    for (const car of state.cars) {
      if (car === state.player.car) continue;
      if (Math.hypot(b.x - car.x, b.y - car.y) < 30) {
        if (car.traffic) car.stunned = 3;
        b.life = 0;
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

// Melee shove: press F near a pedestrian to knock them down (a crime).
export function shove(state) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - state.player.x, ped.y - state.player.y);
    if (d < 40) {
      ped.down = true;
      ped.downT = 5;
      ped.angle = Math.atan2(ped.y - state.player.y, ped.x - state.player.x);
      ped.x += Math.cos(ped.angle) * 24;
      ped.y += Math.sin(ped.angle) * 24;
      addWanted(state, 1);
      state.sound.shove();
      return true;
    }
  }
  return false;
}
