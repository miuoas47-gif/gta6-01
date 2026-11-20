// Solmar Bay — tuning and shared constants for the open-world crime game.
// One file, one job: every number the other modules agree on lives here, so the
// city, the cars, the police and the missions all play by the same rules.

export const STEP = 1 / 60;
export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 132;
export const LANE = 34;
export const SAVE_KEY = 'solmar-bay-save-v1';
export const DEFAULT_SEED = 20261120;

export const PLAYER = { speed: 198, radius: 14, health: 100, punchRange: 48, punchDamage: 25 };
export const CAR = {
  accel: 430,
  brake: 720,
  reverseAccel: 270,
  maxSpeed: 565,
  maxReverse: 185,
  turnRate: 2.7,
  radius: 26,
  length: 54,
  width: 27,
};
export const TRAFFIC_SPEED = 150;
export const POLICE_SPEED = 615;
export const WANTED_DECAY_SECONDS = 14;
export const BULLET_SPEED = 820;
export const BULLET_RANGE = 620;
export const PISTOL_DAMAGE = 34;
export const PISTOL_AMMO = 12;

export const MISSION_DEFS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    reward: 300,
    briefing: 'Mara needs wheels, fast. Take any car on the street and bring it to the chop shop on Harbor Row.',
    done: 'Clean delivery. Mara owes you one — and the bay pays in cash.',
  },
  {
    id: 'bay-run',
    name: 'Bay Run',
    reward: 500,
    briefing: 'A courier run across Solmar Bay: hit all four checkpoints before the clock runs out. No excuses.',
    done: 'Four checkpoints, one very fast Rico. The courier crew is impressed.',
  },
  {
    id: 'heat',
    name: 'Heat on the Bay',
    reward: 650,
    briefing: 'The precinct is watching. Get the heat to three stars, then shake it and reach the safehouse on Palm Court.',
    done: 'Heat gone, trail cold. You are a ghost again, Rico.',
  },
];

export const PALETTE = {
  water: '#2f7fa8',
  waterDeep: '#256b90',
  sand: '#e8cf96',
  grass: '#7fae5a',
  park: '#6da24e',
  road: '#3a3d44',
  roadEdge: '#2c2e33',
  sidewalk: '#b9b3a4',
  building: ['#e8a56b', '#d97b6c', '#7fb3c8', '#c9b458', '#9db38a', '#c98bb0', '#8fa3c8', '#e0cfa8'],
  roof: ['#a85f4e', '#7a5a3a', '#5d7a8a', '#8a7a4a'],
  car: ['#c94f42', '#3f7fc9', '#e8c33c', '#4fae62', '#8a5fc9', '#d8d8d8', '#2e2e33', '#e07b2e'],
  police: '#1e3a5f',
  taxi: '#f2c230',
  ped: ['#e8b48a', '#c98a6a', '#8a6a4a', '#e0c090'],
  shirt: ['#d94f4f', '#4f7fd9', '#4fae62', '#e8c33c', '#8a5fc9', '#e07b2e', '#dddddd'],
};

export const DISTRICTS = [
  { name: 'Palm Court', x: 300, y: 300, w: 1100, h: 700 },
  { name: 'Harbor Row', x: 1900, y: 300, w: 1400, h: 700 },
  { name: 'Marina District', x: 300, y: 1100, w: 1100, h: 700 },
  { name: 'Old Town', x: 1900, y: 1100, w: 1400, h: 700 },
  { name: 'Sunset Strip', x: 300, y: 1900, w: 3000, h: 500 },
];
