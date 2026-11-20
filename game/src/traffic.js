// Traffic cars and pedestrians: the city moving around the player.
// Traffic follows the road grid and turns at intersections; pedestrians walk
// the sidewalks and run from danger. All choices come from the state's seeded
// generator, never from Math.random.

import { CAR, LANE, ROAD_W, TRAFFIC_SPEED, WORLD_H, WORLD_W } from './config.js';
import { angleDiff, buildingAt, collideCircle, dist } from './world.js';
import { chance, pick, range } from './random.js';

/** Steer a car along its road, turning at intersections, slowing for the car ahead. */
export function updateTrafficCar(state, car, dt) {
  const { rng, city } = state;
  const roads = car.axis === 'v' ? city.roads.horizontal : city.roads.vertical;
  // At an intersection, sometimes turn onto the crossing road.
  let atCross = -1;
  for (let i = 0; i < roads.length; i += 1) {
    const pos = car.axis === 'v' ? car.y : car.x;
    if (Math.abs(pos - roads[i]) < 14) { atCross = roads[i]; break; }
  }
  if (atCross !== -1 && chance(rng, 0.006)) {
    if (car.axis === 'v') {
      car.axis = 'h';
      car.road = atCross;
      car.dir = chance(rng, 0.5) ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = atCross + car.lane * LANE;
    } else {
      car.axis = 'v';
      car.road = atCross;
      car.dir = chance(rng, 0.5) ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = atCross + car.lane * LANE;
    }
  }
  // Slow down for the car ahead on the same lane.
  let targetSpeed = car.speed;
  let desired = range(rng, TRAFFIC_SPEED * 0.75, TRAFFIC_SPEED * 1.05);
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked') continue;
    if (other.axis !== car.axis || other.road !== car.road || other.lane !== car.lane) continue;
    const ahead = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
    if (ahead > 0 && ahead < 90) { desired = Math.min(desired, other.speed * 0.85); break; }
  }
  // Slow near the player on foot so traffic does not plough through them.
  const player = state.player;
  if (player.onFoot) {
    const d = dist(car, player);
    if (d < 70) desired = Math.min(desired, 40);
  }
  targetSpeed = desired;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
  if (car.axis === 'v') {
    car.y += car.dir * car.speed * dt;
    car.x = car.road + car.lane * LANE;
    if (car.y < 180) { car.dir = 1; car.angle = Math.PI / 2; }
    if (car.y > WORLD_H - 180) { car.dir = -1; car.angle = -Math.PI / 2; }
  } else {
    car.x += car.dir * car.speed * dt;
    car.y = car.road + car.lane * LANE;
    if (car.x < 320) { car.dir = 1; car.angle = 0; }
    if (car.x > WORLD_W - 180) { car.dir = -1; car.angle = Math.PI; }
  }
  // A traffic car that clipped a building (bad turn) is nudged back onto its road.
  if (buildingAt(state, car.x, car.y)) {
    const fixed = collideCircle(state, car.x, car.y, CAR.radius);
    car.x = fixed.x;
    car.y = fixed.y;
  }
}

/** Drive a car the player is in: arcade physics with speed, steering and drift. */
export function driveCar(state, car, input, dt) {
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const along = (car.vx ?? 0) * forward + (car.vy ?? 0) * right;
  let speed = along;
  if (input.up) speed += CAR.accel * dt;
  if (input.down) {
    speed -= speed > 20 ? CAR.brake * dt : CAR.reverseAccel * dt;
  }
  // Rolling drag and a soft top speed.
  speed -= speed * 0.55 * dt;
  if (speed > CAR.maxSpeed) speed = CAR.maxSpeed;
  if (speed < -CAR.maxReverse) speed = -CAR.maxReverse;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const grip = Math.min(1, Math.abs(speed) / 140);
  car.angle += steer * CAR.turnRate * grip * dt * (speed >= 0 ? 1 : -1);
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  car.vx = nx * speed;
  car.vy = ny * speed;
  const before = { x: car.x, y: car.y };
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const fixed = collideCircle(state, car.x, car.y, CAR.radius);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    // Hit a wall: lose speed and scrape along it.
    const hitX = fixed.x !== car.x;
    const hitY = fixed.y !== car.y;
    car.x = fixed.x;
    car.y = fixed.y;
    if (hitX) car.vx *= -0.25;
    if (hitY) car.vy *= -0.25;
    car.speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy) * 0.4;
    if (Math.abs(car.vx) + Math.abs(car.vy) > 120) {
      state.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.4, max: 0.4, kind: 'spark', size: 5 });
    }
  } else {
    car.speed = speed;
  }
  if (Math.abs(car.x - before.x) + Math.abs(car.y - before.y) < 0.001 && Math.abs(speed) > 60) {
    car.speed *= 0.5;
    car.vx *= 0.5;
    car.vy *= 0.5;
  }
  return speed;
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind === 'traffic') updateTrafficCar(state, car, dt);
  }
}

/** Pedestrians: walk the sidewalks, pause at corners, flee from cars and gunfire. */
export function updatePeds(state, dt) {
  const { rng } = state;
  const player = state.player;
  const playerCar = player.inCar ? state.cars.find((c) => c.id === player.inCar) : null;
  const threat = playerCar ?? player;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.down -= dt;
      if (ped.down <= 0) { ped.state = 'walk'; ped.flee = 0; }
      continue;
    }
    ped.phase += dt;
    const dThreat = dist(ped, threat);
    const shooting = state.bullets.length > 0;
    if ((dThreat < 110 && threat === playerCar && Math.abs(playerCar?.speed ?? 0) > 60) || (dThreat < 90 && shooting)) {
      ped.state = 'flee';
      ped.flee = 1.6;
    }
    if (ped.state === 'flee') {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.angle += angleDiff(ped.angle, away) * Math.min(1, dt * 6);
      const speed = 150;
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * speed * dt;
      const fixed = collideCircle(state, nx, ny, 12);
      ped.x = fixed.x;
      ped.y = fixed.y;
      if (ped.flee <= 0) ped.state = 'walk';
      continue;
    }
    // Ambling walk: drift along the sidewalk, turn at corners sometimes.
    const speed = ped.speed * (0.7 + 0.3 * Math.sin(ped.phase * 2));
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (buildingAt(state, nx, ny) || nx < 110 || nx > WORLD_W - 30 || ny < 30 || ny > WORLD_H - 30) {
      ped.angle += Math.PI / 2 + (rng() < 0.5 ? 0 : Math.PI);
    } else {
      ped.x = nx;
      ped.y = ny;
    }
    if (chance(rng, 0.002)) ped.angle += pick(rng, [Math.PI / 2, -Math.PI / 2, Math.PI]);
  }
}

/** A car the player drives into a pedestrian knocks them down and is a crime. */
export function checkCarPedHits(state) {
  const player = state.player;
  if (!player.inCar) return 0;
  const car = state.cars.find((c) => c.id === player.inCar);
  if (!car) return 0;
  const speed = Math.abs(car.speed ?? 0);
  if (speed < 90) return 0;
  let hits = 0;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(car, ped) < CAR.radius + 10) {
      ped.state = 'down';
      ped.down = 4;
      ped.flee = 0;
      hits += 1;
      state.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: -30, life: 0.6, max: 0.6, kind: 'poof', size: 18 });
    }
  }
  return hits;
}
