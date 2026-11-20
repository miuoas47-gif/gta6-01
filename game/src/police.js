// Police: wanted-level response. Police cruisers spawn at the city edge,
// chase the player, ram their car, and arrest Rico on foot if they get
// close for long enough. Lose them and the heat cools off.
import { POLICE, GAME } from './config.js';

export function spawnPoliceCar(state) {
  const edge = state.rng.pick(['north', 'south', 'east', 'west']);
  let x = state.player.x;
  let y = state.player.y;
  if (edge === 'north') { x = state.player.x + state.rng.range(-300, 300); y = Math.max(120, state.player.y - 700); }
  if (edge === 'south') { x = state.player.x + state.rng.range(-300, 300); y = Math.min(state.world.height - 120, state.player.y + 700); }
  if (edge === 'east') { x = Math.min(state.world.width - 120, state.player.x + 700); y = state.player.y + state.rng.range(-300, 300); }
  if (edge === 'west') { x = Math.max(GAME.beachWidth + 120, state.player.x - 700); y = state.player.y + state.rng.range(-300, 300); }
  return {
    id: 'police-' + state.police.length + '-' + Math.floor(state.time * 10),
    x,
    y,
    angle: Math.atan2(state.player.y - y, state.player.x - x),
    speed: 0,
    color: '#20242c',
    kind: 'police',
    traffic: false,
    police: true,
    sirenPhase: state.rng.range(0, 1),
  };
}

export function updatePolice(state, dt) {
  // Spawn cruisers up to the wanted level, capped by POLICE.maxCars.
  const want = Math.min(state.wanted, POLICE.maxCars);
  while (state.police.length < want) state.police.push(spawnPoliceCar(state));
  while (state.police.length > want) state.police.pop();

  const px = state.player.x;
  const py = state.player.y;
  let nearest = Infinity;
  for (const cop of state.police) {
    const targetAngle = Math.atan2(py - cop.y, px - cop.x);
    let diff = targetAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    cop.speed += (POLICE.chaseSpeed - cop.speed) * Math.min(1, dt * 0.8);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.sirenPhase = (cop.sirenPhase + dt * 1.4) % 2;
    const d = Math.hypot(px - cop.x, py - cop.y);
    if (d < nearest) nearest = d;
    // Ram the player's car: a hard hit slows them and hurts Rico.
    if (state.player.car && d < 52 && cop.speed > 200) {
      state.player.car.speed *= 0.55;
      state.player.health = Math.max(0, state.player.health - POLICE.ramDamage * dt * 3);
      state.events.push({ type: 'ram', x: px, y: py });
      state.sound.ram();
    }
    // Arrest on foot: stay close and the cuffs come out.
    if (!state.player.car && d < 46) {
      state.arrestTimer += dt;
      if (state.arrestTimer > POLICE.arrestSeconds) {
        state.screen = 'busted';
        state.sound.busted();
      }
    }
  }
  if (nearest > 60) state.arrestTimer = Math.max(0, state.arrestTimer - dt * 2);

  // Evade: no cruiser nearby for a while and the wanted level drops.
  if (state.wanted > 0) {
    if (nearest > 650) {
      state.evadeTimer += dt;
      if (state.evadeTimer > POLICE.evadeSeconds) {
        state.evadeTimer = 0;
        state.decayTimer += dt;
        if (state.decayTimer > POLICE.decaySeconds) {
          state.decayTimer = 0;
          state.wanted = Math.max(0, state.wanted - 1);
          if (state.wanted === 0) state.events.push({ type: 'clear', x: px, y: py });
        }
      }
    } else {
      state.evadeTimer = 0;
      state.decayTimer = 0;
    }
  }
}
