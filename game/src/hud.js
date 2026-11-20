// The HUD: health, money, wanted stars, the mission objective, the clock,
// and a live minimap of Solmar Bay. Drawn in screen space after the world.

import { WORLD_H, WORLD_W } from './config.js';
import { currentMarker } from './missions.js';

function formatClock(clockMin) {
  const total = Math.floor(clockMin);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const hh = h < 10 ? `0${h}` : `${h}`;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${hh}:${mm}`;
}

export function drawHud(ctx, state, view, text) {
  const w = view.w;
  const h = view.h;
  const player = state.player;

  // Top-left: health bar and money.
  ctx.fillStyle = 'rgba(12,16,24,0.72)';
  ctx.fillRect(14, 14, 250, 64);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(14, 14, 250, 64);
  text('RICO VEGA', 26, 38, 14, '#f2c230', 'left', 800);
  ctx.fillStyle = '#2a2f38';
  ctx.fillRect(26, 46, 180, 12);
  ctx.fillStyle = player.health > 40 ? '#4fae62' : '#d94f4f';
  ctx.fillRect(26, 46, Math.max(0, 180 * (player.health / 100)), 12);
  text(`$${player.money}`, 216, 58, 16, '#ffffff', 'left', 700);
  text(player.inCar ? 'IN CAR — E to exit' : 'ON FOOT — E near a car to steal it', 26, 72, 11, '#9fb0c0', 'left', 500);

  // Top-right: wanted stars and the clock.
  ctx.fillStyle = 'rgba(12,16,24,0.72)';
  ctx.fillRect(w - 264, 14, 250, 64);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(w - 264, 14, 250, 64);
  const stars = '★★★★★';
  text('WANTED', w - 252, 38, 14, '#cfd6de', 'left', 800);
  for (let i = 0; i < 5; i += 1) {
    text('★', w - 252 + i * 22, 62, 20, i < state.wanted ? '#ffcf3d' : '#3a4150', 'left', 800);
  }
  void stars;
  text(formatClock(state.clockMin), w - 26, 38, 16, '#ffffff', 'right', 700);
  text(`AMMO ${player.ammo}`, w - 26, 62, 13, '#9fb0c0', 'right', 600);

  // Top-centre: the mission objective.
  const missionText = state.mission ? state.mission.text : 'No active mission — press M for the next job';
  const mw = Math.min(560, w - 560);
  ctx.fillStyle = 'rgba(12,16,24,0.72)';
  ctx.fillRect((w - mw) / 2, 14, mw, 40);
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 1;
  ctx.strokeRect((w - mw) / 2, 14, mw, 40);
  text(missionText, w / 2, 40, 15, '#ffffff', 'center', 600);

  // Bottom-right: the live minimap.
  const mapW = 220;
  const mapH = Math.round((220 * WORLD_H) / WORLD_W);
  const mx = w - mapW - 16;
  const my = h - mapH - 16;
  const sx = mapW / WORLD_W;
  const sy = mapH / WORLD_H;
  ctx.fillStyle = 'rgba(12,16,24,0.78)';
  ctx.fillRect(mx - 6, my - 6, mapW + 12, mapH + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(mx - 6, my - 6, mapW + 12, mapH + 12);
  ctx.fillStyle = '#2f7fa8';
  ctx.fillRect(mx, my, 90 * sx, mapH);
  ctx.fillStyle = '#7fae5a';
  ctx.fillRect(mx, my, mapW, mapH);
  ctx.fillStyle = '#3a3d44';
  for (const rx of state.city.roads.vertical) ctx.fillRect(mx + rx * sx - 2, my, 4, mapH);
  for (const ry of state.city.roads.horizontal) ctx.fillRect(mx, my + ry * sy - 2, mapW, 4);
  ctx.fillStyle = '#3fae62';
  ctx.fillRect(mx + state.city.safehouse.x * sx - 3, my + state.city.safehouse.y * sy - 3, 6, 6);
  ctx.fillStyle = '#e07b2e';
  ctx.fillRect(mx + state.city.chopshop.x * sx - 3, my + state.city.chopshop.y * sy - 3, 6, 6);
  const marker = currentMarker(state);
  if (marker) {
    ctx.fillStyle = '#f2c230';
    const px = mx + marker.x * sx;
    const py = my + marker.y * sy;
    ctx.beginPath();
    ctx.moveTo(px, py - 6);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 6);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.fill();
  }
  for (const cop of state.police) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow that turns with them.
  ctx.save();
  ctx.translate(mx + player.x * sx, my + player.y * sy);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text('SOLMAR BAY', mx + mapW / 2, my - 12, 11, '#cfd6de', 'center', 700);
}
