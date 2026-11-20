// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh seeded world for a fixed number of
// steps, steered by a simple autopilot (walk to a car, get in, follow the road
// grid toward a waypoint, steer away from cruisers), so the frame is what a
// short game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { angleDiff, angleTo, buildingAt, dist, nearestRoadPoint } from './world.js';
import { stepGame } from './game.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 8;
const DRIVE_SECONDS = 20;
const CHASE_SECONDS = 16;
const MISSION_LIMIT_SECONDS = 60;

/** A synthetic input the autopilot drives, shaped exactly like the real one. */
function pilotInput() {
  const axesState = { x: 0, y: 0, up: false, down: false, left: false, right: false };
  let queued = 0;
  const mouse = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };
  return {
    axes() { return axesState; },
    mouse() { return mouse; },
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
    setAxes(next) {
      axesState.x = next.x ?? 0;
      axesState.y = next.y ?? 0;
      axesState.up = !!next.up;
      axesState.down = !!next.down;
      axesState.left = !!next.left;
      axesState.right = !!next.right;
    },
    queue(action) { queued |= action; },
    aimAt(x, y) { mouse.worldX = x; mouse.worldY = y; },
  };
}

/** Road-following waypoints from `from` to `to`, hugging the grid. */
function routeWaypoints(state, from, to) {
  const { roads } = state.city;
  let vx = roads.vertical[0];
  for (const rx of roads.vertical) if (Math.abs(rx - to.x) < Math.abs(vx - to.x)) vx = rx;
  let hy = roads.horizontal[0];
  for (const ry of roads.horizontal) if (Math.abs(ry - to.y) < Math.abs(hy - to.y)) hy = ry;
  let hy0 = roads.horizontal[0];
  for (const ry of roads.horizontal) if (Math.abs(ry - from.y) < Math.abs(hy0 - from.y)) hy0 = ry;
  return [
    { x: from.x, y: hy0 },
    { x: vx, y: hy0 },
    { x: vx, y: hy },
    { x: to.x, y: to.y },
  ];
}

/** Steer a car toward a waypoint: returns axes for this step. */
function steerToCar(state, car, target) {
  const desired = angleTo(car, target);
  const diff = angleDiff(car.angle, desired);
  const ahead = { x: car.x + Math.cos(car.angle) * 90, y: car.y + Math.sin(car.angle) * 90 };
  const blocked = buildingAt(state, ahead.x, ahead.y);
  const speed = Math.abs(car.speed ?? 0);
  return {
    up: !blocked && Math.abs(diff) < 2.4,
    down: blocked || Math.abs(diff) > 2.4,
    left: diff < -0.08 || (blocked && diff >= 0),
    right: diff > 0.08 || (blocked && diff < 0),
    x: 0, y: 0,
  };
}

/** Walk toward a point on foot. */
function walkTo(player, target) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, up: false, down: false, left: false, right: false };
}

/** Get Rico into the nearest parked car, driving the real enter-car action. */
function getIntoCar(state, pilot, steps) {
  const player = state.player;
  let car = null;
  let best = Infinity;
  for (const c of state.cars) {
    if (c.kind !== 'parked') continue;
    const d = dist(player, c);
    if (d < best) { best = d; car = c; }
  }
  if (!car) return false;
  let guard = 0;
  while (!player.inCar && guard < steps) {
    pilot.setAxes(walkTo(player, car));
    stepGame(state, pilot, STEP);
    guard += 1;
    // Only queue ENTER while still on foot: after the step that gets Rico in,
    // the car is right under him, and a second queued ENTER would get him out.
    if (!player.inCar && dist(player, car) < 60) pilot.queue(4); // ACTION_ENTER
  }
  return !!player.inCar;
}

/** Drive along a route of waypoints for up to `seconds`, or until `stop` says so. */
function driveRoute(state, pilot, waypoints, seconds, stop) {
  let wp = 0;
  const total = Math.floor(seconds / STEP);
  for (let i = 0; i < total; i += 1) {
    const player = state.player;
    const car = state.cars.find((c) => c.id === player.inCar);
    if (!car) return;
    const target = waypoints[Math.min(wp, waypoints.length - 1)];
    if (dist(car, target) < 80 && wp < waypoints.length - 1) wp += 1;
    pilot.setAxes(steerToCar(state, car, waypoints[Math.min(wp, waypoints.length - 1)]));
    pilot.aimAt(car.x + Math.cos(car.angle) * 100, car.y + Math.sin(car.angle) * 100);
    stepGame(state, pilot, STEP);
    if (stop && stop(state)) return;
  }
}

/**
 * Set `state` to the named scene (start, drive, chase or mission; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  const pilot = pilotInput();
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    // Title screen over a living city: traffic and pedestrians move, Rico waits.
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      pilot.setAxes({ x: 0, y: 0 });
      stepGame(state, pilot, STEP);
    }
    return { screen: SCREEN_TITLE };
  }

  if (name === 'drive') {
    getIntoCar(state, pilot, 600);
    const far = { x: state.city.roads.vertical[6], y: state.city.roads.horizontal[1] };
    const waypoints = routeWaypoints(state, state.player, far);
    driveRoute(state, pilot, waypoints, DRIVE_SECONDS);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    getIntoCar(state, pilot, 600);
    addWanted(state, 3);
    const total = Math.floor(CHASE_SECONDS / STEP);
    for (let i = 0; i < total; i += 1) {
      const player = state.player;
      const car = state.cars.find((c) => c.id === player.inCar);
      if (!car) break;
      // Flee: aim for a road point away from the nearest cruiser.
      let cop = null;
      let best = Infinity;
      for (const c of state.police) {
        const d = dist(car, c);
        if (d < best) { best = d; cop = c; }
      }
      let target;
      if (cop) {
        const away = Math.atan2(car.y - cop.y, car.x - cop.x);
        const spot = { x: car.x + Math.cos(away) * 700, y: car.y + Math.sin(away) * 700 };
        target = nearestRoadPoint(state, spot.x, spot.y);
      } else {
        target = { x: state.city.roads.vertical[5], y: state.city.roads.horizontal[4] };
      }
      pilot.setAxes(steerToCar(state, car, target));
      stepGame(state, pilot, STEP);
    }
    return { screen: SCREEN_PLAY };
  }

  // mission: First Wheels in progress — steal a car, then drive toward the chop shop.
  startMission(state, 0);
  getIntoCar(state, pilot, 900);
  const waypoints = routeWaypoints(state, state.player, state.city.chopshop);
  driveRoute(state, pilot, waypoints, MISSION_LIMIT_SECONDS, (s) => {
    const m = s.mission;
    return m && m.stage === 'deliver' && dist(s.player, s.city.chopshop) < 280;
  });
  return { screen: SCREEN_PLAY };
}
