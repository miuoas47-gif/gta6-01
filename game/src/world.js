// Solmar Bay city generation: roads, blocks, buildings, parks, beach and
// the fixed story locations. Everything is placed from the seeded RNG, so
// the same seed always builds the same city.
import { GAME, PALETTE } from './config.js';

export function buildWorld(rng) {
  const roadsV = [];
  const roadsH = [];
  for (let x = GAME.roadGap; x < GAME.worldWidth; x += GAME.roadGap) roadsV.push(x);
  for (let y = GAME.roadGap; y < GAME.worldHeight; y += GAME.roadGap) roadsH.push(y);

  const buildings = [];
  const parks = [];
  // Blocks are the squares between neighbouring roads. The westernmost
  // strip is beach, so blocks start east of it.
  const blockXs = [GAME.beachWidth + 40];
  for (const x of roadsV) blockXs.push(x + GAME.roadWidth / 2 + 24);
  const blockYs = [40];
  for (const y of roadsH) blockYs.push(y + GAME.roadWidth / 2 + 24);
  const blockW = GAME.roadGap - GAME.roadWidth - 48;
  const blockH = GAME.roadGap - GAME.roadWidth - 48;

  for (let bi = 0; bi < blockXs.length; bi++) {
    for (let bj = 0; bj < blockYs.length; bj++) {
      const bx = blockXs[bi];
      const by = blockYs[bj];
      if (bx + blockW > GAME.worldWidth - 24 || by + blockH > GAME.worldHeight - 24) continue;
      // Two park blocks keep the city green and break up the grid.
      if ((bi === 3 && bj === 2) || (bi === 5 && bj === 4)) {
        parks.push({ x: bx, y: by, w: blockW, h: blockH, trees: [] });
        const park = parks[parks.length - 1];
        for (let t = 0; t < 14; t++) {
          park.trees.push({ x: bx + rng.range(16, blockW - 16), y: by + rng.range(16, blockH - 16), r: rng.range(7, 12) });
        }
        continue;
      }
      const count = rng.int(2, 4);
      for (let k = 0; k < count; k++) {
        const bw = rng.range(70, 130);
        const bh = rng.range(60, 110);
        const px = bx + rng.range(8, Math.max(9, blockW - bw - 8));
        const py = by + rng.range(8, Math.max(9, blockH - bh - 8));
        buildings.push({
          x: px,
          y: py,
          w: bw,
          h: bh,
          roof: rng.pick(PALETTE.buildingRoof),
          wall: rng.pick(PALETTE.buildingWall),
          windows: rng.int(2, 4),
          tall: rng.chance(0.3),
        });
      }
    }
  }

  // Fixed story locations, placed on roads so they are always reachable.
  const garage = { x: 1200, y: 400, name: "Mara's Garage" };
  const safehouse = { x: 2800, y: 2000, name: 'Safehouse' };
  const start = { x: 800, y: 800 };
  const bayRunCheckpoints = [
    { x: 400, y: 400 },
    { x: 1600, y: 800 },
    { x: 2400, y: 1600 },
    { x: 2800, y: 400 },
  ];

  // Parked cars along road edges, with a seeded colour and heading.
  const parked = [];
  for (let i = 0; i < 16; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(roadsV) : rng.pick(roadsH);
    const along = rng.range(500, GAME.worldHeight - 500);
    const side = rng.chance(0.5) ? 1 : -1;
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    parked.push({
      x: vertical ? road + side * (GAME.roadWidth / 2 - 18) : along,
      y: vertical ? along : road + side * (GAME.roadWidth / 2 - 18),
      angle,
      color: rng.pick(PALETTE.carColors),
      kind: 'sedan',
    });
  }

  return {
    width: GAME.worldWidth,
    height: GAME.worldHeight,
    roadsV,
    roadsH,
    buildings,
    parks,
    garage,
    safehouse,
    start,
    bayRunCheckpoints,
    parked,
  };
}

// True when the point is inside a building (solid for cars and on foot).
export function hitsBuilding(world, x, y, pad = 0) {
  for (const b of world.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// True when the point is on a road (used for traffic lanes and markers).
export function onRoad(world, x, y) {
  const half = GAME.roadWidth / 2;
  for (const rx of world.roadsV) if (Math.abs(x - rx) < half) return true;
  for (const ry of world.roadsH) if (Math.abs(y - ry) < half) return true;
  return false;
}

// Nearest road centre to a point, used to snap pedestrians to sidewalks.
export function nearestRoadPoint(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of world.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of world.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}
