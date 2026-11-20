// HUD, minimap and menu screens for Solmar Bay, drawn on the same canvas.
import { GAME, MISSIONS } from './config.js';
import { currentTarget, missionDef } from './missions.js';

function star(ctx, x, y, filled) {
  ctx.fillStyle = filled ? '#ffd23d' : 'rgba(0,0,0,0.45)';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
    ctx.lineTo(x + Math.cos(a2) * 5, y + Math.sin(a2) * 5);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawHud(state) {
  const { ctx } = state;
  const vw = GAME.viewWidth;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: health, money, ammo.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 12, 250, 74);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('RICO VEGA', 26, 34);
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 42, 180, 12);
  ctx.fillStyle = state.player.health > 30 ? '#4ad97a' : '#e84a3d';
  ctx.fillRect(26, 42, 180 * (state.player.health / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('HP ' + Math.ceil(state.player.health), 212, 53);
  ctx.fillStyle = '#4ad97a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('$' + state.player.money, 26, 76);
  ctx.fillStyle = '#ffd23d';
  ctx.font = '13px sans-serif';
  ctx.fillText('Ammo ' + state.player.ammo + (state.player.car ? '   — driving' : '   — on foot'), 110, 76);

  // Top-right: wanted stars and clock.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(vw - 264, 12, 250, 52);
  for (let i = 0; i < 5; i++) star(ctx, vw - 238 + i * 30, 38, i < state.wanted);
  const hour = Math.floor(state.clock);
  const min = Math.floor((state.clock - hour) * 60);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0'), vw - 26, 40);
  ctx.textAlign = 'left';

  // Objective panel under the stars.
  const def = missionDef(state);
  const objective = state.mission.stage === 'active'
    ? state.mission.objective
    : def ? 'Press Enter to start: ' + def.name + ' — ' + def.giver : 'All missions done — free roam!';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(vw - 264, 72, 250, 58);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(def ? def.name.toUpperCase() : 'FREE ROAM', vw - 252, 92);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  wrapText(ctx, objective, vw - 252, 108, 226, 14);
  if (state.mission.stage === 'active' && state.mission.index === 1) {
    ctx.fillStyle = '#ff8a5c';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(Math.ceil(state.mission.timer) + 's', vw - 252, 126);
  }

  // Transient message.
  if (state.messageT > 0) {
    ctx.font = 'bold 17px sans-serif';
    const w = ctx.measureText(state.message).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect((vw - w) / 2, 96, w, 34);
    ctx.fillStyle = '#ffd23d';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, vw / 2, 119);
    ctx.textAlign = 'left';
  }

  // Dialogue box from Mara.
  if (state.mission.dialogueT > 0 && state.mission.dialogue) {
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.fillRect(180, GAME.viewHeight - 118, vw - 360, 84);
    ctx.strokeStyle = '#e8c33d';
    ctx.lineWidth = 2;
    ctx.strokeRect(180, GAME.viewHeight - 118, vw - 360, 84);
    ctx.fillStyle = '#e8c33d';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('MARA', 200, GAME.viewHeight - 92);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    wrapText(ctx, state.mission.dialogue, 200, GAME.viewHeight - 70, vw - 400, 18);
  }

  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(14, GAME.viewHeight - 34, 560, 22);
  ctx.fillStyle = '#ddd';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move / drive   E enter or exit car   Mouse aim, click shoot   F shove / taxi   P pause   M mute', 22, GAME.viewHeight - 19);

  drawMinimap(state);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawMinimap(state) {
  const { ctx, world } = state;
  const mw = 190;
  const mh = 142;
  const mx = GAME.viewWidth - mw - 14;
  const my = GAME.viewHeight - mh - 14;
  const sx = mw / world.width;
  const sy = mh / world.height;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#2c4a2c';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#1e7fa8';
  ctx.fillRect(mx, my, 260 * sx, mh);
  ctx.fillStyle = '#3c3f45';
  for (const rx of world.roadsV) ctx.fillRect(mx + (rx - 48) * sx, my, 96 * sx, mh);
  for (const ry of world.roadsH) ctx.fillRect(mx, my + (ry - 48) * sy, mw, 96 * sy);
  const target = currentTarget(state);
  if (target && state.mission.stage === 'active') {
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4ad97a';
  ctx.fillRect(mx + world.safehouse.x * sx - 3, my + world.safehouse.y * sy - 3, 6, 6);
  for (const cop of state.police) {
    ctx.fillStyle = '#3d7dd9';
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.rider && state.rider.state === 'waiting') {
    ctx.fillStyle = '#e8c33d';
    ctx.beginPath();
    ctx.arc(mx + state.rider.x * sx, my + state.rider.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(mx + state.player.x * sx, my + state.player.y * sy);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // View rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  const cam = state.camera;
  ctx.strokeRect(
    mx + (cam.x - GAME.viewWidth / 2) * sx,
    my + (cam.y - GAME.viewHeight / 2) * sy,
    GAME.viewWidth * sx,
    GAME.viewHeight * sy,
  );
  ctx.restore();
}

function panel(ctx, title, lines, accent) {
  const vw = GAME.viewWidth;
  const vh = GAME.viewHeight;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,22,0.78)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(vw / 2 - 320, vh / 2 - 190, 640, 380);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(vw / 2 - 320, vh / 2 - 190, 640, 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(title, vw / 2, vh / 2 - 120);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  let y = vh / 2 - 70;
  for (const line of lines) {
    ctx.fillText(line, vw / 2, y);
    y += 28;
  }
  ctx.restore();
}

export function drawTitle(state, hasSave) {
  panel(state.ctx, 'SOLMAR BAY', [
    'A sun-soaked open-world crime story.',
    'You are Rico Vega. Mara has work for you — if you can stay ahead of the law.',
    '',
    'WASD — move / drive      E — steal or exit a car',
    'Mouse — aim      Click — shoot      F — shove / hail a taxi',
    'P — pause      M — mute',
    '',
    hasSave ? 'Press ENTER to start — or C to continue your saved game' : 'Press ENTER to start',
  ], '#e8c33d');
  const ctx = state.ctx;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Missions: First Wheels  •  Bay Run  •  Heat', GAME.viewWidth / 2, GAME.viewHeight / 2 + 160);
  ctx.restore();
}

export function drawPause(state) {
  panel(state.ctx, 'PAUSED', [
    'The city waits for you, Rico.',
    'Money: $' + state.player.money + '    Missions done: ' + state.mission.index + ' of ' + MISSIONS.length,
    '',
    'P or Esc — resume      R — restart the day      S — save game',
  ], '#7ec8e8');
}

export function drawDead(state) {
  panel(state.ctx, 'WASTED', [
    'Rico is down. The bay keeps its secrets.',
    'Money kept: $' + state.player.money,
    '',
    'Press ENTER to wake up at the safehouse.',
  ], '#e84a3d');
}

export function drawBusted(state) {
  panel(state.ctx, 'BUSTED', [
    'The Solmar Bay police took Rico in.',
    'Bail paid: $100. Money left: $' + state.player.money,
    '',
    'Press ENTER to walk out of the precinct.',
  ], '#3d7dd9');
}
