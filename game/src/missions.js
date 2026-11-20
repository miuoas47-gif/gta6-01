// Story missions and the taxi side job. Missions run in order — First Wheels,
// Bay Run, Heat on the Bay — and each one tracks its own stage, timer and
// marker. The taxi job opens after the first mission and pays per fare.

import { MISSION_DEFS } from './config.js';
import { dist } from './world.js';
import { addWanted } from './police.js';
import { chance, pick, range } from './random.js';

export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  if (!def) return;
  state.missionIndex = index;
  const city = state.city;
  if (index === 0) {
    state.mission = { index, id: def.id, stage: 'steal', timer: 0, text: 'Steal a car — any car will do.', target: null };
  } else if (index === 1) {
    const p = state.player;
    const checkpoints = [];
    const roadsV = city.roads.vertical;
    const roadsH = city.roads.horizontal;
    checkpoints.push({ x: roadsV[4], y: roadsH[0] });
    checkpoints.push({ x: roadsV[7], y: roadsH[2] });
    checkpoints.push({ x: roadsV[1], y: roadsH[3] });
    checkpoints.push({ x: roadsV[5], y: roadsH[5] });
    state.mission = { index, id: def.id, stage: 'drive', timer: 80, checkpoint: 0, checkpoints, text: 'Checkpoint 1 of 4 — drive!', target: checkpoints[0] };
    void p;
  } else {
    state.mission = { index, id: def.id, stage: 'heat', timer: 0, text: 'Cause trouble until you hit 3 stars.', target: null };
  }
  say(state, `${def.name}: ${def.briefing}`);
}

export function say(state, text) {
  state.dialogue = { text, until: state.time + 6 };
}

function completeMission(state) {
  const def = MISSION_DEFS[state.mission.index];
  state.player.money += def.reward;
  say(state, `${def.name} complete! +$${def.reward}. ${def.done}`);
  state.mission = null;
  const next = state.missionIndex + 1;
  if (next < MISSION_DEFS.length) {
    state.pendingMission = next;
    state.pendingTimer = 2.5;
  } else {
    say(state, 'All story missions done! Solmar Bay is yours — keep earning with taxi fares.');
  }
  return true;
}

/** Advance the active mission; returns true when a mission just completed. */
export function updateMissions(state, dt) {
  if (state.pendingMission !== undefined && state.pendingMission !== null) {
    state.pendingTimer -= dt;
    if (state.pendingTimer <= 0) {
      const next = state.pendingMission;
      state.pendingMission = null;
      startMission(state, next);
    }
  }
  const m = state.mission;
  if (!m) return false;
  const player = state.player;
  const playerCar = player.inCar ? state.cars.find((c) => c.id === player.inCar) : null;
  const pos = playerCar ?? player;

  if (m.index === 0) {
    if (m.stage === 'steal' && player.inCar) {
      m.stage = 'deliver';
      m.target = state.city.chopshop;
      m.text = 'Deliver the car to the chop shop on Harbor Row.';
      say(state, 'Nice wheels. Now get it to the chop shop — follow the yellow marker.');
    } else if (m.stage === 'deliver' && player.inCar) {
      if (dist(pos, state.city.chopshop) < 90) {
        // The chop shop keeps the car; Rico walks away richer.
        const car = playerCar;
        if (car) {
          car.kind = 'parked';
          car.speed = 0;
          car.vx = 0;
          car.vy = 0;
        }
        player.inCar = null;
        player.onFoot = true;
        player.x = state.city.chopshop.x + 60;
        player.y = state.city.chopshop.y;
        return completeMission(state);
      }
    }
  } else if (m.index === 1) {
    m.timer -= dt;
    if (m.timer <= 0) {
      say(state, 'Bay Run failed — the clock beat you. Try again: press M to restart the mission.');
      m.stage = 'failed';
      m.text = 'Bay Run failed. Press M to retry.';
      return false;
    }
    const cp = m.checkpoints[m.checkpoint];
    if (cp && dist(pos, cp) < 80) {
      m.checkpoint += 1;
      state.player.money += 25;
      if (m.checkpoint >= m.checkpoints.length) return completeMission(state);
      m.target = m.checkpoints[m.checkpoint];
      m.text = `Checkpoint ${m.checkpoint + 1} of 4 — ${Math.ceil(m.timer)}s left.`;
      say(state, `Checkpoint ${m.checkpoint} hit! +$25. Next one is marked.`);
    } else if (cp) {
      m.text = `Checkpoint ${m.checkpoint + 1} of 4 — ${Math.ceil(m.timer)}s left.`;
    }
  } else if (m.index === 2) {
    if (m.stage === 'heat') {
      if (state.wanted >= 3) {
        m.stage = 'evade';
        m.text = 'Three stars! Now lose the heat and reach the safehouse.';
        say(state, 'Three stars — the whole precinct is coming. Lose them, then get to the safehouse.');
      } else {
        m.text = `Get the heat to 3 stars (now ${state.wanted}). Steal, speed, make noise.`;
      }
    } else if (m.stage === 'evade') {
      if (state.wanted === 0 && dist(player, state.city.safehouse) < 110) {
        return completeMission(state);
      }
      m.target = state.city.safehouse;
      m.text = state.wanted > 0
        ? `Lose the heat (now ${state.wanted} stars), then reach the safehouse.`
        : 'Heat is clear — reach the safehouse on Palm Court.';
    }
  }
  return false;
}

/** Retry the current mission from its start (M key). */
export function retryMission(state) {
  if (!state.mission) return;
  startMission(state, state.mission.index);
}

/** Where the current objective marker points, if any. */
export function currentMarker(state) {
  const m = state.mission;
  if (m && m.target) return { x: m.target.x, y: m.target.y, label: m.text };
  if (state.taxi.active && state.taxi.stage === 'pickup' && state.taxi.passenger) {
    return { x: state.taxi.passenger.x, y: state.taxi.passenger.y, label: 'Pick up the fare' };
  }
  if (state.taxi.active && state.taxi.stage === 'dropoff' && state.taxi.dest) {
    return { x: state.taxi.dest.x, y: state.taxi.dest.y, label: 'Drop off the fare' };
  }
  return null;
}

// ---- Taxi fares: a repeatable side job that pays per ride. ----

export function maybeStartTaxi(state) {
  const taxi = state.taxi;
  if (taxi.active || state.missionIndex < 1) return;
  if (state.time - (taxi.lastFareAt ?? -999) < 6) return;
  if (!state.player.inCar) return;
  const { rng, city } = state;
  const road = pick(rng, city.roads.vertical);
  const passenger = {
    x: road + 60, y: range(rng, 400, 2200),
    color: pick(rng, ['#e8b48a', '#c98a6a', '#8a6a4a']),
    shirt: pick(rng, ['#d94f4f', '#4f7fd9', '#e8c33c']),
  };
  const destRoad = pick(rng, city.roads.horizontal);
  taxi.active = true;
  taxi.stage = 'pickup';
  taxi.passenger = passenger;
  taxi.dest = { x: range(rng, 400, 3300), y: destRoad };
  taxi.fare = 40 + Math.floor(rng() * 6) * 10;
  taxi.timer = 120;
  say(state, `Taxi fare: pick up the passenger — $${taxi.fare} if you are quick.`);
}

export function updateTaxi(state, dt) {
  const taxi = state.taxi;
  if (!taxi.active) {
    maybeStartTaxi(state);
    return;
  }
  taxi.timer -= dt;
  if (taxi.timer <= 0) {
    say(state, 'The fare gave up waiting. Another one will come along.');
    endTaxi(state);
    return;
  }
  const player = state.player;
  const playerCar = player.inCar ? state.cars.find((c) => c.id === player.inCar) : null;
  if (!playerCar) return;
  if (taxi.stage === 'pickup' && dist(playerCar, taxi.passenger) < 70 && Math.abs(playerCar.speed ?? 0) < 80) {
    taxi.stage = 'dropoff';
    say(state, `Passenger aboard. Take them to the marked stop — $${taxi.fare}.`);
  } else if (taxi.stage === 'dropoff' && dist(playerCar, taxi.dest) < 80) {
    player.money += taxi.fare;
    state.stats.fares += 1;
    say(state, `Fare complete! +$${taxi.fare}.`);
    endTaxi(state);
  }
}

function endTaxi(state) {
  state.taxi.active = false;
  state.taxi.stage = 'idle';
  state.taxi.passenger = null;
  state.taxi.dest = null;
  state.taxi.lastFareAt = state.time;
}
