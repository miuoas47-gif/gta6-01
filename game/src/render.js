// Rendering for Solmar Bay: the city, its cars and people, mission
// markers, particles and the day-light tint, all drawn on one canvas.
import { GAME, PALETTE, CAR } from './config.js';
import { currentTarget } from './missions.js';

export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
  ctx.fillStyle = car.color;
  roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRect(ctx, -6, -CAR.width / 2 + 4, 18, CAR.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 6);
  ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 9, 3, 6);
  ctx.fillStyle = '#e84a3d';
  ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 6);
  ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 9, 3, 6);
  if (car.police) {
    const on = car.sirenPhase < 1;
    ctx.fillStyle = on ? '#e84a3d' : '#3d7dd9';
    ctx.fillRect(-10, -CAR.width / 2 - 3, 8, 5);
    ctx.fillStyle = on ? '#3d7dd9' : '#e84a3d';
    ctx.fillRect(2, -CAR.width / 2 - 3, 8, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerShirt;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath();
  ctx.arc(6, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand when aiming.
  ctx.strokeStyle = '#20242c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(18, 0);
  ctx.stroke();
  ctx.restore();
}

function drawMarker(ctx, x, y, color, label, t) {
  const bob = Math.sin(t * 4) * 6;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 26);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-14, -18);
  ctx.arc(0, -18, 14, Math.PI, 0);
  ctx.lineTo(14, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -18, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (label) {
    ctx.save();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(label, x + 1, y - 44 + bob);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x, y - 45 + bob);
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.2;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 34 + Math.sin(t * 4) * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function render(state) {
  const { ctx, world } = state;
  const cam = state.camera;
  const vw = GAME.viewWidth;
  const vh = GAME.viewHeight;
  ctx.save();
  ctx.clearRect(0, 0, vw, vh);
  // Sky-coloured backdrop beyond the city edge.
  ctx.fillStyle = '#7ec8e8';
  ctx.fillRect(0, 0, vw, vh);
  ctx.translate(-cam.x + vw / 2, -cam.y + vh / 2);

  const left = cam.x - vw / 2 - 60;
  const right = cam.x + vw / 2 + 60;
  const top = cam.y - vh / 2 - 60;
  const bottom = cam.y + vh / 2 + 60;

  // Ground: sand and water on the west edge, city grass elsewhere.
  ctx.fillStyle = '#8fc46a';
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(left, top, GAME.beachWidth - left > 0 ? GAME.beachWidth - left : 0, bottom - top);
  if (left < GAME.beachWidth) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(left, top, Math.min(GAME.beachWidth, right) - left > 140 ? 140 : Math.max(0, Math.min(GAME.beachWidth, right) - left), bottom - top);
    ctx.fillStyle = PALETTE.deepWater;
    ctx.fillRect(left, top, 70, bottom - top);
    // Gentle waves.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let wy = Math.floor(top / 90) * 90; wy < bottom; wy += 90) {
      ctx.beginPath();
      ctx.moveTo(80, wy + Math.sin(state.time * 1.5 + wy) * 4);
      ctx.quadraticCurveTo(110, wy + 8, 140, wy);
      ctx.stroke();
    }
  }

  // Parks.
  for (const park of world.parks) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = PALETTE.parkDark;
    for (const t of park.trees) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Roads with centre dashes.
  ctx.fillStyle = PALETTE.asphalt;
  for (const rx of world.roadsV) ctx.fillRect(rx - GAME.roadWidth / 2, 0, GAME.roadWidth, world.height);
  for (const ry of world.roadsH) ctx.fillRect(0, ry - GAME.roadWidth / 2, world.width, GAME.roadWidth);
  ctx.strokeStyle = PALETTE.asphaltLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 26]);
  for (const rx of world.roadsV) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, world.height); ctx.stroke();
  }
  for (const ry of world.roadsH) {
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(world.width, ry); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Sidewalks around road edges.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of world.roadsV) {
    ctx.fillRect(rx - GAME.roadWidth / 2 - 12, 0, 10, world.height);
    ctx.fillRect(rx + GAME.roadWidth / 2 + 2, 0, 10, world.height);
  }
  for (const ry of world.roadsH) {
    ctx.fillRect(0, ry - GAME.roadWidth / 2 - 12, world.width, 10);
    ctx.fillRect(0, ry + GAME.roadWidth / 2 + 2, world.width, 10);
  }

  // Buildings: wall, roof, windows.
  for (const b of world.buildings) {
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 24));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 24, 12, 10);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
    }
  }

  // Safehouse and garage pads.
  drawPad(ctx, world.safehouse.x, world.safehouse.y, '#4ad97a', 'SAFEHOUSE');
  drawPad(ctx, world.garage.x, world.garage.y, '#e8c33d', "MARA'S GARAGE");

  // Parcels.
  for (const p of state.parcels) {
    const bob = Math.sin(p.bob * 5) * 4;
    ctx.fillStyle = '#c98a3d';
    ctx.fillRect(p.x - 10, p.y - 10 + bob, 20, 20);
    ctx.strokeStyle = '#7a4a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 10, p.y - 10 + bob, 20, 20);
    ctx.beginPath();
    ctx.moveTo(p.x - 10, p.y + bob);
    ctx.lineTo(p.x + 10, p.y + bob);
    ctx.stroke();
  }

  // Waiting rider.
  if (state.rider && state.rider.state === 'waiting') {
    drawMarker(ctx, state.rider.x, state.rider.y, '#e8c33d', 'TAXI $80', state.time);
  }
  if (state.rider && state.rider.state === 'riding') {
    drawMarker(ctx, state.rider.dest.x, state.rider.dest.y, '#4ad97a', 'Drop-off: ' + state.rider.dest.name, state.time);
  }

  // Mission target marker.
  const target = currentTarget(state);
  if (target && state.mission.stage === 'active') {
    const label = state.mission.index === 1
      ? 'Checkpoint ' + (state.mission.checkpoint + 1) + ' of 4'
      : state.mission.index === 0 ? "Mara's Garage" : 'Safehouse';
    drawMarker(ctx, target.x, target.y, '#e8c33d', label, state.time);
  }

  // Bullets and particles.
  for (const b of state.bullets) {
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const e of state.events) {
    if (e.type === 'shot-hit' || e.type === 'ram') {
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Cars, pedestrians, player — sorted by y so nearer things overlap right.
  const drawables = [];
  for (const car of state.cars) drawables.push({ y: car.y, fn: () => drawCar(ctx, car) });
  for (const cop of state.police) drawables.push({ y: cop.y, fn: () => drawCar(ctx, cop) });
  for (const ped of state.peds) drawables.push({ y: ped.y, fn: () => drawPed(ctx, ped) });
  if (!state.player.car) drawables.push({ y: state.player.y, fn: () => drawPlayer(ctx, state.player) });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.fn();

  // Aim line on foot.
  if (!state.player.car && state.screen === 'play') {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(state.player.x + Math.cos(state.player.aimAngle) * 70, state.player.y + Math.sin(state.player.aimAngle) * 70);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  // Day lighting: warm sun-soaked tint that shifts with the clock.
  const hour = state.clock;
  let tint = 'rgba(255,190,90,0.05)';
  if (hour < 7 || hour > 19) tint = 'rgba(20,30,90,0.22)';
  else if (hour < 9 || hour > 17) tint = 'rgba(255,170,80,0.10)';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, vw, vh);
}

function drawPad(ctx, x, y, color, label) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(x - 70, y - 50, 140, 100);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 70, y - 50, 140, 100);
  ctx.fillStyle = color;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 58);
}
