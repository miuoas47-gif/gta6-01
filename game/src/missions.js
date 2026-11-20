// Missions, taxi fares and package pickups: the story and the side work.
// Three story missions from Mara, played in order, plus fares and parcels
// that pay cash any time Rico is between jobs.
import { MISSIONS } from './config.js';
import { addWanted } from './traffic.js';

export function newMissionState() {
  return {
    index: 0,
    stage: 'intro', // intro | active | done
    objective: '',
    timer: 0,
    checkpoint: 0,
    dialogue: '',
    dialogueT: 0,
    flashT: 0,
  };
}

export function missionDef(state) {
  return MISSIONS[state.mission.index] || null;
}

export function currentTarget(state) {
  const m = state.mission;
  if (m.index === 0) return state.world.garage;
  if (m.index === 1) return state.world.bayRunCheckpoints[m.checkpoint] || null;
  if (m.index === 2) return state.wanted > 0 ? null : state.world.safehouse;
  return null;
}

export function startMission(state) {
  const m = state.mission;
  const def = missionDef(state);
  if (!def) return;
  m.stage = 'active';
  m.dialogue = def.giver + ': ' + def.briefing;
  m.dialogueT = 6;
  if (m.index === 0) m.objective = 'Steal a car, then drive it to ' + state.world.garage.name + '.';
  if (m.index === 1) {
    m.objective = 'Hit checkpoint 1 of 4 before the clock runs out.';
    m.timer = def.timeLimit;
    m.checkpoint = 0;
  }
  if (m.index === 2) {
    m.objective = 'Lose the 3-star wanted level, then reach the safehouse.';
    state.wanted = 3;
    state.evadeTimer = 0;
  }
  m.flashT = 1;
}

export function completeMission(state) {
  const def = missionDef(state);
  if (!def) return;
  state.player.money += def.reward;
  state.message = 'Mission complete: ' + def.name + ' — +$' + def.reward;
  state.messageT = 4;
  state.sound.missionComplete();
  state.mission.index += 1;
  state.mission.stage = 'intro';
  state.mission.objective = '';
  state.mission.timer = 0;
  state.mission.checkpoint = 0;
  if (state.mission.index >= MISSIONS.length) {
    state.mission.objective = 'Free roam: grab fares and parcels around Solmar Bay.';
    state.mission.dialogue = 'Mara: That is the whole set, Rico. The city is yours now — keep earning.';
    state.mission.dialogueT = 7;
  }
}

export function failMission(state, reason) {
  state.message = 'Mission failed: ' + reason + ' — talk to Mara to retry.';
  state.messageT = 4;
  state.mission.stage = 'intro';
  state.mission.timer = 0;
  state.mission.checkpoint = 0;
  if (state.mission.index === 2) state.wanted = Math.max(state.wanted, 1);
  state.sound.missionFail();
}

export function updateMissions(state, dt) {
  const m = state.mission;
  if (m.dialogueT > 0) m.dialogueT -= dt;
  if (m.flashT > 0) m.flashT -= dt;
  if (m.stage !== 'active') return;
  const def = missionDef(state);
  if (!def) return;

  if (m.index === 0) {
    if (!state.player.car) {
      m.objective = 'Steal a car (walk up to one and press E).';
    } else {
      m.objective = 'Deliver the car to ' + state.world.garage.name + ' (yellow marker).';
      const g = state.world.garage;
      if (Math.hypot(state.player.x - g.x, state.player.y - g.y) < 90) completeMission(state);
    }
  }

  if (m.index === 1) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(state, 'the clock ran out on the Bay Run'); return; }
    const cp = state.world.bayRunCheckpoints[m.checkpoint];
    if (cp && Math.hypot(state.player.x - cp.x, state.player.y - cp.y) < 80) {
      m.checkpoint += 1;
      state.sound.pickup();
      if (m.checkpoint >= state.world.bayRunCheckpoints.length) {
        completeMission(state);
      } else {
        m.objective = 'Hit checkpoint ' + (m.checkpoint + 1) + ' of 4 — ' + Math.ceil(m.timer) + 's left.';
        state.message = 'Checkpoint ' + m.checkpoint + ' of 4!';
        state.messageT = 2;
      }
    }
  }

  if (m.index === 2) {
    if (state.wanted > 0) {
      m.objective = 'Lose the wanted level — stay away from police cruisers.';
    } else {
      m.objective = 'Heat is off. Reach the safehouse on Palm Court.';
      const s = state.world.safehouse;
      if (Math.hypot(state.player.x - s.x, state.player.y - s.y) < 90) completeMission(state);
    }
  }
}

// --- Side work -----------------------------------------------------------

export function spawnParcel(state) {
  const spots = [
    { x: 800, y: 1200 }, { x: 2000, y: 400 }, { x: 2400, y: 1200 },
    { x: 1200, y: 2000 }, { x: 2800, y: 800 }, { x: 400, y: 2000 },
  ];
  const spot = spots[state.parcelIndex % spots.length];
  state.parcelIndex += 1;
  state.parcels.push({ x: spot.x, y: spot.y, bob: 0 });
}

export function updateParcels(state, dt) {
  for (const p of state.parcels) p.bob += dt;
  for (let i = state.parcels.length - 1; i >= 0; i--) {
    const p = state.parcels[i];
    if (Math.hypot(state.player.x - p.x, state.player.y - p.y) < 42) {
      state.parcels.splice(i, 1);
      state.player.money += 50;
      state.message = 'Parcel delivered: +$50';
      state.messageT = 2;
      state.sound.pickup();
      state.events.push({ type: 'parcel', x: p.x, y: p.y });
    }
  }
  if (state.parcels.length === 0 && state.mission.index >= 1) spawnParcel(state);
}

// Taxi fares: a waiting rider hails Rico; drive them to their stop.
export function spawnRider(state) {
  if (state.rider) return;
  const stops = [
    { x: 400, y: 1600, name: 'the marina' },
    { x: 2400, y: 400, name: 'Coral Row' },
    { x: 1600, y: 2000, name: 'Palm Court' },
    { x: 800, y: 400, name: 'the boardwalk' },
  ];
  const dest = stops[state.riderIndex % stops.length];
  state.riderIndex += 1;
  const near = state.world.roadsV[1 + (state.riderIndex % 4)];
  state.rider = {
    x: near,
    y: 1200 + (state.riderIndex % 3) * 200,
    dest,
    state: 'waiting',
    fare: 80,
  };
}

export function updateRider(state, dt) {
  if (!state.rider) {
    state.riderTimer -= dt;
    if (state.riderTimer <= 0 && state.mission.index >= 1) {
      spawnRider(state);
      state.riderTimer = 25;
    }
    return;
  }
  const r = state.rider;
  if (r.state === 'waiting') {
    const d = Math.hypot(state.player.x - r.x, state.player.y - r.y);
    if (d < 60 && state.player.car) {
      r.state = 'riding';
      state.message = 'Rider aboard — take them to ' + r.dest.name + '.';
      state.messageT = 3;
      state.sound.pickup();
    }
  } else if (r.state === 'riding') {
    if (!state.player.car) {
      r.state = 'waiting';
      state.message = 'The rider left — you need a car for fares.';
      state.messageT = 2;
    } else if (Math.hypot(state.player.x - r.dest.x, state.player.y - r.dest.y) < 90) {
      state.player.money += r.fare;
      state.message = 'Fare complete: +$' + r.fare;
      state.messageT = 3;
      state.sound.missionComplete();
      state.rider = null;
      state.riderTimer = 20;
    }
  }
}
