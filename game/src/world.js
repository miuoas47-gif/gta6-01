// Solmar Bay itself: the seeded city, the game state, and the geometry helpers
// every other system shares. No drawing and no browser in here — just the map,
// the entities, and the rules for moving through them.
//
// The city is a road grid over a 3600x2600 island. The west edge is beach and
// water; the blocks between roads hold buildings or parks. Everything is built
// from one seeded generator, so the same seed always builds the same city.

import {
  CAR, LANE, PALETTE, PISTOL_AMMO, PLAYER, ROAD_W, TRAFFIC_SPEED, WORLD_H, WORLD_W,
} from './config.js';
import { chance, int, pick, range } from './random.js';

export const EVENT_CRIME = 1;
export const EVENT_MISSION_DONE = 2;
export const EVENT_DEAD = 4;
export const EVENT_BUSTED = 8;
export const EVENT_PICKUP = 16;
export const EVENT_SHOT = 32;

// Road centre lines: a regular grid with a little seeded jitter per road.
export function roadLines(rng) {
  const vertical = [];
  const horizontal = [];
  for (let x = 300; x <= 3300; x += 400) vertical.push(x + int(rng, -14, 14));
  for (let y = 300; y <= 2300; y += 400) horizontal.push(y + int(rng, -14, 14));
  return { vertical, horizontal };
}

function buildCity(rng) {
  const roads = roadLines(rng);
  const buildings = [];
  const parks = [];
  const trees = [];
  // One building or park per block between four neighbouring roads.
  for (let vi = 0; vi < roads.vertical.length - 1; vi += 1) {
    for (let hi = 0; hi < roads.horizontal.length - 1; hi += 1) {
      const x0 = roads.vertical[vi] + ROAD_W / 2 + 26;
      const x1 = roads.vertical[vi + 1] - ROAD_W / 2 - 26;
      const y0 = roads.horizontal[hi] + ROAD_W / 2 + 26;
      const y1 = roads.horizontal[hi + 1] - ROAD_W / 2 - 26;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (chance(rng, 0.16)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = int(rng, 4, 9);
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 16) });
        }
        continue;
      }
      const lots = chance(rng, 0.55) ? 2 : 1;
      for (let lot = 0; lot < lots; lot += 1) {
        const w = range(rng, 90, Math.max(100, (x1 - x0) / lots - 24));
        const h = range(rng, 80, Math.max(90, y1 - y0 - 24));
        const bx = lots === 1 ? x0 + (x1 - x0 - w) / 2 : x0 + lot * ((x1 - x0) / lots) + 8;
        const by = y0 + range(rng, 4, Math.max(5, y1 - y0 - h - 4));
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, PALETTE.building),
          roof: pick(rng, PALETTE.roof),
          tall: chance(rng, 0.3),
        });
      }
    }
  }
  // Landmarks the missions use, pinned to road corners so they are reachable.
  const safehouse = { x: roads.vertical[1] + 4, y: roads.horizontal[4] + 4, label: 'Safehouse' };
  const chopshop = { x: roads.vertical[6] - 4, y: roads.horizontal[0] + 4, label: 'Chop Shop' };
  const pier = { x: 120, y: roads.horizontal[2], label: 'Solmar Pier' };
  return { roads, buildings, parks, trees, safehouse, chopshop, pier };
}

function makeCar(rng, id, kind, x, y, angle) {
  return {
    id, kind, x, y, angle,
    speed: 0,
    color: kind === 'police' ? PALETTE.police : pick(rng, PALETTE.car),
    hp: 100,
    driver: kind === 'parked' ? null : 'traffic',
    // Traffic cars follow one road: axis, road line, direction, lane side.
    axis: 'v', road: 0, dir: 1, lane: 1,
    stuck: 0, siren: 0,
  };
}

export function createState(seed, rng) {
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    time: 0,
    clockMin: 8 * 60 + 12,
    city,
    player: {
      x: city.roads.vertical[1], y: city.roads.horizontal[4] - 40,
      angle: -Math.PI / 2, health: PLAYER.health, money: 0,
      inCar: null, onFoot: true, ammo: PISTOL_AMMO,
      punchCooldown: 0, hurtCooldown: 0, bustedTimer: 0,
      walkPhase: 0,
    },
    cars: [],
    peds: [],
    police: [],
    bullets: [],
    particles: [],
    pickups: [],
    wanted: 0,
    wantedTimer: 0,
    crimeCooldown: 0,
    missionIndex: 0,
    mission: null,
    taxi: { active: false, stage: 'idle', passenger: null, dest: null, fare: 0, timer: 0 },
    dialogue: { text: '', until: 0 },
    stats: { carsStolen: 0, fares: 0, shotsFired: 0, pedsHit: 0 },
    camera: { x: 0, y: 0 },
    over: false,
    busted: false,
    saved: false,
  };
  resetState(state);
  return state;
}

function spawnTraffic(state, count) {
  const { rng, city } = state;
  for (let i = 0; i < count; i += 1) {
    const vertical = chance(rng, 0.5);
    let car;
    if (vertical) {
      const road = pick(rng, city.roads.vertical);
      car = makeCar(rng, `t${i}`, 'traffic', road + (chance(rng, 0.5) ? LANE : -LANE), range(rng, 200, WORLD_H - 200), chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2);
      car.axis = 'v';
      car.road = road;
      car.dir = car.angle > 0 ? 1 : -1;
      car.lane = car.x > road ? 1 : -1;
    } else {
      const road = pick(rng, city.roads.horizontal);
      car = makeCar(rng, `t${i}`, 'traffic', range(rng, 300, WORLD_W - 300), road + (chance(rng, 0.5) ? LANE : -LANE), chance(rng, 0.5) ? 0 : Math.PI);
      car.axis = 'h';
      car.road = road;
      car.dir = car.angle === 0 ? 1 : -1;
      car.lane = car.y > road ? 1 : -1;
    }
    car.speed = range(rng, TRAFFIC_SPEED * 0.7, TRAFFIC_SPEED * 1.05);
    state.cars.push(car);
  }
}

function spawnParked(state, count) {
  const { rng, city } = state;
  for (let i = 0; i < count; i += 1) {
    const vertical = chance(rng, 0.5);
    let car;
    if (vertical) {
      const road = pick(rng, city.roads.vertical);
      const side = chance(rng, 0.5) ? 1 : -1;
      car = makeCar(rng, `p${i}`, 'parked', road + side * (ROAD_W / 2 - 18), range(rng, 350, WORLD_H - 350), side > 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      const road = pick(rng, city.roads.horizontal);
      const side = chance(rng, 0.5) ? 1 : -1;
      car = makeCar(rng, `p${i}`, 'parked', range(rng, 400, WORLD_W - 400), road + side * (ROAD_W / 2 - 18), side > 0 ? 0 : Math.PI);
    }
    state.cars.push(car);
  }
}

function spawnPeds(state, count) {
  const { rng, city } = state;
  for (let i = 0; i < count; i += 1) {
    const vertical = chance(rng, 0.5);
    let ped;
    if (vertical) {
      const road = pick(rng, city.roads.vertical);
      const side = chance(rng, 0.5) ? 1 : -1;
      ped = { x: road + side * (ROAD_W / 2 + 16), y: range(rng, 250, WORLD_H - 250), angle: chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2, speed: range(rng, 42, 78), state: 'walk', color: pick(rng, PALETTE.ped), shirt: pick(rng, PALETTE.shirt), down: 0, flee: 0, phase: range(rng, 0, 6) };
    } else {
      const road = pick(rng, city.roads.horizontal);
      const side = chance(rng, 0.5) ? 1 : -1;
      ped = { x: range(rng, 350, WORLD_W - 350), y: road + side * (ROAD_W / 2 + 16), angle: chance(rng, 0.5) ? 0 : Math.PI, speed: range(rng, 42, 78), state: 'walk', color: pick(rng, PALETTE.ped), shirt: pick(rng, PALETTE.shirt), down: 0, flee: 0, phase: range(rng, 0, 6) };
    }
    state.peds.push(ped);
  }
}

export function resetState(state) {
  const { city } = state;
  state.time = 0;
  state.clockMin = 8 * 60 + 12;
  state.player.x = city.roads.vertical[1];
  state.player.y = city.roads.horizontal[4] - 40;
  state.player.angle = -Math.PI / 2;
  state.player.health = PLAYER.health;
  state.player.money = 0;
  state.player.inCar = null;
  state.player.onFoot = true;
  state.player.ammo = PISTOL_AMMO;
  state.player.punchCooldown = 0;
  state.player.hurtCooldown = 0;
  state.player.bustedTimer = 0;
  state.cars = [];
  state.peds = [];
  state.police = [];
  state.bullets = [];
  state.particles = [];
  state.pickups = [];
  state.wanted = 0;
  state.wantedTimer = 0;
  state.crimeCooldown = 0;
  state.missionIndex = 0;
  state.mission = null;
  state.taxi = { active: false, stage: 'idle', passenger: null, dest: null, fare: 0, timer: 0 };
  state.dialogue = { text: '', until: 0 };
  state.stats = { carsStolen: 0, fares: 0, shotsFired: 0, pedsHit: 0 };
  state.over = false;
  state.busted = false;
  spawnTraffic(state, 16);
  spawnParked(state, 12);
  spawnPeds(state, 26);
  // A few cash pickups scattered on sidewalks for the player to find.
  for (let i = 0; i < 6; i += 1) {
    const road = state.city.roads.vertical[i % state.city.roads.vertical.length];
    state.pickups.push({ x: road + 90, y: 420 + i * 260, kind: 'cash', value: 25 + i * 5, taken: false });
  }
}

// ---- Geometry helpers shared by every system ----

export function clampWorld(x, y) {
  return {
    x: Math.max(24, Math.min(WORLD_W - 24, x)),
    y: Math.max(24, Math.min(WORLD_H - 24, y)),
  };
}

export function buildingAt(state, x, y) {
  const list = state.city.buildings;
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** True when the point is on a road, a sidewalk, sand or grass — anywhere walkable/drivable. */
export function onRoad(state, x, y) {
  const { roads } = state.city;
  for (const rx of roads.vertical) if (Math.abs(x - rx) <= ROAD_W / 2 + 20) return true;
  for (const ry of roads.horizontal) if (Math.abs(y - ry) <= ROAD_W / 2 + 20) return true;
  return false;
}

export function inWater(x) {
  return x < 90;
}

/** Push a circle out of buildings and the water; returns the corrected position. */
export function collideCircle(state, x, y, radius) {
  const list = state.city.buildings;
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        y = cy + (dy / d) * radius;
      } else if (x < b.x + b.w / 2) {
        x = b.x - radius;
      } else {
        x = b.x + b.w + radius;
      }
    }
  }
  if (x < 90 + radius) x = 90 + radius;
  const clamped = clampWorld(x, y);
  return clamped;
}

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Smallest signed turn from angle `a` to angle `b`, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** The nearest point on any road centre line to (x, y). */
export function nearestRoadPoint(state, x, y) {
  const { roads } = state.city;
  let best = null;
  let bestD = Infinity;
  for (const rx of roads.vertical) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of roads.horizontal) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

/** A road point some distance ahead of the player, for traffic to aim at. */
export function roadPointAhead(state, x, y, distance) {
  const p = nearestRoadPoint(state, x, y);
  const vertical = Math.abs(p.x - x) < Math.abs(p.y - y);
  if (vertical) return { x: p.x, y: y + distance };
  return { x: x + distance, y: p.y };
}
