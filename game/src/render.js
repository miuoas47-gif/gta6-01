// Drawing only: the world's state and the current screen in, pixels out.
// A camera follows the player over the city; the HUD and minimap are drawn
// in screen space by hud.js. Warm sun-soaked colours, long shadows, and a
// title screen that shows the city alive behind it.

import { PALETTE, ROAD_W, WORLD_H, WORLD_W } from './config.js';
import { currentMarker } from './missions.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, w: 0, h: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    view.scale = Math.max(0.72, Math.min(1.15, Math.min(view.w / 1200, view.h / 760)));
  }

  resize();
  window.addEventListener('resize', resize);

  function worldFromScreen(sx, sy) {
    return {
      x: (sx - view.w / 2) / view.scale + stateRef.camera.x,
      y: (sy - view.h / 2) / view.scale + stateRef.camera.y,
    };
  }

  let stateRef = null;

  function text(value, x, y, size, color, align, weight) {
    ctx.font = `${weight ?? 600} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align ?? 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-26 + 4, -12 + 5, 52, 24);
    const color = car.kind === 'police' ? PALETTE.police : car.color;
    ctx.fillStyle = color;
    roundRect(-27, -13, 54, 26, 7);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    roundRect(-8, -11, 20, 22, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,240,0.7)';
    ctx.fillRect(8, -10, 4, 20);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(24, -11, 3, 5);
    ctx.fillRect(24, 6, 3, 5);
    if (car.kind === 'police') {
      const flash = Math.floor(car.siren * 3) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-4, -13, 8, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SBPD', 0, 2);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      roundRect(-27, -13, 54, 26, 7);
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawWorld(state, time) {
    const cam = state.camera;
    const vw = view.w / view.scale;
    const vh = view.h / view.scale;
    const x0 = cam.x - vw / 2 - 60;
    const y0 = cam.y - vh / 2 - 60;
    const x1 = cam.x + vw / 2 + 60;
    const y1 = cam.y + vh / 2 + 60;

    // Ground: grass, then sand and water on the west edge.
    ctx.fillStyle = '#8ab45e';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, 90), y0, Math.min(x1, 300) - Math.max(x0, 90), y1 - y0);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, y0, Math.min(x1, 90) - x0, y1 - y0);
    // Water shimmer.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) {
      ctx.fillRect(12, y + ((time * 12) % 46), 60, 3);
    }

    // Parks.
    for (const park of state.city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Trees.
    for (const tree of state.city.trees) {
      if (tree.x < x0 || tree.x > x1 || tree.y < y0 || tree.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(tree.x + 4, tree.y + 5, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4e8a3a';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#69a84f';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Roads: asphalt, sidewalk edge, centre dashes.
    const { roads } = state.city;
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of roads.vertical) ctx.fillRect(rx - ROAD_W / 2 - 10, y0, ROAD_W + 20, y1 - y0);
    for (const ry of roads.horizontal) ctx.fillRect(x0, ry - ROAD_W / 2 - 10, x1 - x0, ROAD_W + 20);
    ctx.fillStyle = PALETTE.road;
    for (const rx of roads.vertical) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    for (const ry of roads.horizontal) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
    ctx.fillStyle = '#e8d44d';
    for (const rx of roads.vertical) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
    }
    for (const ry of roads.horizontal) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
    }
    // Crosswalk stripes at the main intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of roads.vertical.slice(0, 4)) {
      for (const ry of roads.horizontal.slice(0, 3)) {
        for (let i = -3; i <= 3; i += 1) ctx.fillRect(rx + i * 16 - 5, ry - ROAD_W / 2 + 6, 10, 18);
      }
    }

    // Buildings with long afternoon shadows and lit windows.
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,244,200,0.75)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          ctx.fillRect(b.x + 12 + c * 34, b.y + 12 + r * 34, 12, 14);
        }
      }
    }

    // Landmarks: safehouse (green) and chop shop (orange) pads.
    drawPad(state.city.safehouse, '#3fae62', 'SAFEHOUSE');
    drawPad(state.city.chopshop, '#e07b2e', 'CHOP SHOP');
    // Pier jutting into the water.
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(30, state.city.pier.y - 14, 130, 28);
    ctx.fillStyle = '#a8845c';
    for (let x = 36; x < 160; x += 18) ctx.fillRect(x, state.city.pier.y - 14, 3, 28);

    // Cash pickups.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (pickup.x < x0 || pickup.x > x1 || pickup.y < y0 || pickup.y > y1) continue;
      const bob = Math.sin(time * 3 + pickup.x) * 3;
      ctx.fillStyle = '#2fae5f';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', pickup.x, pickup.y + bob + 5);
    }

    // Taxi passenger waiting.
    if (state.taxi.active && state.taxi.stage === 'pickup' && state.taxi.passenger) {
      const p = state.taxi.passenger;
      ctx.fillStyle = '#f2c230';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1e1e';
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y + 5);
    }

    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.x < x0 || ped.x > x1 || ped.y < y0 || ped.y > y1) continue;
      if (ped.state === 'down') {
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 14, 8, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const bob = Math.sin(ped.phase * 6) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ped.x + 2, ped.y + 3, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y + bob * 0.3, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4 + bob * 0.3, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cars: parked, traffic, the player's, then the police on top.
    for (const car of state.cars) {
      if (car.x < x0 || car.x > x1 || car.y < y0 || car.y > y1) continue;
      drawCarShape(car, car.id === state.player.inCar);
    }
    for (const cop of state.police) {
      if (cop.x < x0 || cop.x > x1 || cop.y < y0 || cop.y > y1) continue;
      drawCarShape(cop, false);
    }

    // Bullets and particles.
    for (const b of state.bullets) {
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.max);
      if (p.kind === 'spark') {
        ctx.fillStyle = `rgba(255,220,120,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'flash') {
        ctx.fillStyle = `rgba(255,240,170,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(200,200,200,${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - alpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // The player on foot.
    const player = state.player;
    if (player.onFoot && !state.over) {
      const bob = Math.sin(player.walkPhase) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(player.x + 2, player.y + 4, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f6fb2';
      ctx.beginPath();
      ctx.arc(player.x, player.y + bob * 0.3, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b48a';
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5 + bob * 0.3, 7, 0, Math.PI * 2);
      ctx.fill();
      // A short gun barrel when aiming.
      if (player.ammo > 0) {
        const aim = player.aimAngle ?? player.angle;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(player.x + Math.cos(aim) * 8, player.y + Math.sin(aim) * 8);
        ctx.lineTo(player.x + Math.cos(aim) * 24, player.y + Math.sin(aim) * 24);
        ctx.stroke();
      }
    }

    // Objective marker: a pulsing beacon the player can follow across the city.
    const marker = currentMarker(state);
    if (marker) {
      const pulse = 1 + Math.sin(time * 4) * 0.12;
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(242,194,48,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c230';
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1e1e1e';
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, 5);
      ctx.restore();
      // A guide line from the player to far-away markers.
      const d = Math.hypot(marker.x - player.x, marker.y - player.y);
      if (d > 500) {
        ctx.strokeStyle = 'rgba(242,194,48,0.65)';
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 12]);
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(marker.x, marker.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Warm afternoon light over everything.
    ctx.fillStyle = 'rgba(255,196,110,0.06)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  function drawPad(spot, color, label) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(spot.x - 46, spot.y - 46, 92, 92);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(spot.x - 46, spot.y - 46, 92, 92);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, spot.x, spot.y + 4);
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = Math.min(640, view.w - 40);
    const h = 130 + lines.length * 30 + 64;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2;
    ctx.fillStyle = 'rgba(12,16,24,0.88)';
    roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent ?? '#f2c230';
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 14);
    ctx.stroke();
    text(title, view.w / 2, y + 62, 42, '#ffffff', 'center', 800);
    lines.forEach((line, i) => {
      text(line, view.w / 2, y + 108 + i * 30, 17, '#cfd6de', 'center', 500);
    });
    text(prompt, view.w / 2, y + h - 26, 18, '#f2c230', 'center', 700);
  }

  function draw(state, screen, save) {
    stateRef = state;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(view.w / 2 / view.scale - state.camera.x, view.h / 2 / view.scale - state.camera.y);
    drawWorld(state, state.time);
    ctx.restore();

    // Dialogue box, with the line wrapped so long briefings stay inside it.
    if (state.dialogue.text && state.time < state.dialogue.until && screen === SCREEN_PLAY) {
      const w = Math.min(760, view.w - 60);
      const x = (view.w - w) / 2;
      const maxText = w - 36;
      ctx.font = `500 15px ${FONT}`;
      const words = state.dialogue.text.split(' ');
      const lines = [];
      let line = '';
      for (const word of words) {
        const trial = line ? `${line} ${word}` : word;
        if (ctx.measureText(trial).width > maxText && line) {
          lines.push(line);
          line = word;
        } else {
          line = trial;
        }
      }
      if (line) lines.push(line);
      const shown = lines.slice(0, 2);
      const boxH = 34 + shown.length * 22 + 12;
      const y = view.h - 54 - boxH;
      ctx.fillStyle = 'rgba(12,16,24,0.86)';
      roundRect(x, y, w, boxH, 10);
      ctx.fill();
      ctx.strokeStyle = '#f2c230';
      ctx.lineWidth = 1.5;
      roundRect(x, y, w, boxH, 10);
      ctx.stroke();
      text('MARA', x + 18, y + 24, 13, '#f2c230', 'left', 800);
      shown.forEach((ln, i) => {
        text(ln, x + 18, y + 48 + i * 22, 15, '#ffffff', 'left', 500);
      });
    }

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, state, view, text);
    }

    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(10,14,22,0.45)';
      ctx.fillRect(0, 0, view.w, view.h);
      const lines = [
        'Welcome to Solmar Bay — a sun-soaked coastal city that never sleeps.',
        'Steal cars, outrun the SBPD, run missions for Mara, and make your name.',
        'WASD move & drive  •  E enter & exit cars',
        'Mouse aim, click to shoot  •  F punch  •  P pause  •  M retry mission',
        'Taxi fares pay after your first job',
      ];
      const prompt = save ? 'Press Enter to continue — or N for a new game' : 'Press Enter or click to start';
      drawPanel('SOLMAR BAY', lines, prompt, '#f2c230');
      text('Rico Vega • an original open-world crime game', view.w / 2, view.h - 24, 14, '#9fb0c0', 'center', 500);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The bay will wait for you.'], 'Press P to resume — Enter restarts the run', '#7fb3c8');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', [`Rico went down with $${state.player.money} in his pocket.`, 'The bay remembers — but it also forgives.'], 'Press Enter to try again', '#d94f4f');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The SBPD finally caught up with Rico.', `They kept $${Math.floor(state.player.money / 2)} as "evidence".`], 'Press Enter to try again', '#2f7bff');
    }
  }

  return { draw, worldFromScreen, view };
}
