// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between title, play, paused,
// wasted and busted screens, and saves progress to localStorage.
//
// ?seed=N fixes the city's seed. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { DEFAULT_SEED, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createState, resetState } from './world.js';
import { stepGame } from './game.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { say, startMission } from './missions.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createState(seed, createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
// A read-only handle for automated play-tests (and curious players).
window.__solmar = { state };

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.money !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.player.money,
      missionIndex: state.missionIndex,
      x: state.player.x,
      y: state.player.y,
      health: state.player.health,
      carsStolen: state.stats.carsStolen,
      fares: state.stats.fares,
    }));
    state.saved = true;
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave(save) {
  state.player.money = save.money;
  state.player.x = save.x;
  state.player.y = save.y;
  state.player.health = save.health;
  state.stats.carsStolen = save.carsStolen ?? 0;
  state.stats.fares = save.fares ?? 0;
  state.missionIndex = save.missionIndex ?? 0;
  state.camera.x = save.x;
  state.camera.y = save.y;
  if (state.missionIndex > 0 && state.missionIndex < 3) startMission(state, state.missionIndex);
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    resetState(state);
    if (!fresh && save) applySave(save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    say(state, 'Solmar Bay, 8:12 AM. Mara is waiting on your first job — steal a car.');
    announce('Playing Solmar Bay. First Wheels: steal a car.');
  }

  function endRun(busted) {
    if (busted) {
      state.player.money = Math.floor(state.player.money / 2);
      screen = SCREEN_BUSTED;
      announce('Busted. The SBPD took half your cash.');
    } else {
      screen = SCREEN_OVER;
      announce(`Wasted. You had $${state.player.money}.`);
    }
    audio.fail();
    writeSave();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      else if (actions & 4) { // E starts a fresh game from the title screen.
        startGame(true);
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        state.busted = false;
        state.over = false;
        startGame(false);
      }
    }

    if (screen === SCREEN_PLAY) {
      // Feed the mouse's world position to the game for aiming. One-shot
      // actions are spent by the first fixed step of the frame, so a single
      // press of E can never enter and then immediately exit a car.
      const mouse = input.mouse();
      const worldMouse = renderer.worldFromScreen(mouse.x, mouse.y);
      let stepActions = actions;
      const wrapped = {
        axes: () => input.axes(),
        mouse: () => ({ ...mouse, worldX: worldMouse.x, worldY: worldMouse.y }),
        takeActions: () => {
          const taken = stepActions;
          stepActions = 0;
          return taken;
        },
      };
      while (accumulator >= STEP) {
        const events = stepGame(state, wrapped, STEP, audio);
        accumulator -= STEP;
        if (state.over) { endRun(false); break; }
        if (state.busted) { endRun(true); break; }
        void events;
      }
      // Engine and siren follow the game every frame.
      const car = state.player.inCar ? state.cars.find((c) => c.id === state.player.inCar) : null;
      audio.update(car ? Math.abs(car.speed ?? 0) : 0, state.wanted, 1 / 60);
      saveTimer += 1 / 60;
      if (saveTimer > 10) {
        saveTimer = 0;
        writeSave();
      }
    } else if (screen === SCREEN_TITLE) {
      // The city stays alive behind the title screen.
      const idle = {
        axes: () => ({ x: 0, y: 0, up: false, down: false, left: false, right: false }),
        mouse: () => ({ x: 0, y: 0, down: false }),
        takeActions: () => 0,
      };
      while (accumulator >= STEP) {
        stepGame(state, idle, STEP, null);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, save);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  canvas.addEventListener('mousedown', () => audio.unlock());

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
