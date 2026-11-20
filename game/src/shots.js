// Staged screenshots for Solmar Bay. A ?shot= URL stages a real scene by
// playing the game's own rules forward from the seeded world — no fake
// canvas, no drawn stand-ins. The autopilot drives, the traffic moves, the
// police chase, and the mission marker is live.
import { startMission } from './missions.js';
import { addWanted } from './traffic.js';

export function shotName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

// Place the player in a car on a road, moving, with traffic around.
function putInCar(state, x, y, angle, speed) {
  const car = state.cars.find((c) => c.parked) || state.cars[0];
  car.parked = false;
  car.traffic = false;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.color = '#d94f3d';
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

export function setupShot(state, name) {
  const w = state.world;
  if (name === 'start') {
    state.screen = 'title';
    state.camera.x = 1000;
    state.camera.y = 1000;
    state.player.x = w.start.x;
    state.player.y = w.start.y;
    return;
  }
  state.screen = 'play';
  if (name === 'drive') {
    putInCar(state, 800, 800, 0, 300);
    state.player.money = 450;
    state.mission.stage = 'intro';
    state.mission.dialogue = '';
  } else if (name === 'chase') {
    putInCar(state, 1600, 1200, Math.PI / 2, 380);
    state.player.money = 720;
    state.wanted = 3;
    state.mission.stage = 'intro';
    state.mission.dialogue = '';
    state.message = 'Lose the cops!';
    state.messageT = 6;
  } else if (name === 'mission') {
    putInCar(state, 800, 400, 0, 260);
    state.player.money = 120;
    startMission(state);
    state.mission.dialogue = 'Mara: Bring that car to my garage, Rico. No scratches — well, fewer scratches.';
    state.mission.dialogueT = 8;
  }
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

// Run the live simulation forward a fixed number of frames so traffic,
// police and the world are visibly mid-action when the shot is taken.
export function simulateShot(state, frames) {
  for (let i = 0; i < frames; i++) {
    state.update(1 / 60, true);
  }
  state.render();
  window.__shotReady = true;
  document.title = 'shot-ready';
}
