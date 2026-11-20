// Solmar Bay — tuning constants for the whole game.
// One place for every number that shapes how the city feels to play.
export const GAME = {
  title: 'Solmar Bay',
  hero: 'Rico Vega',
  contact: 'Mara',
  seed: 20261124,
  worldWidth: 3200,
  worldHeight: 2400,
  roadGap: 400,
  roadWidth: 96,
  beachWidth: 260,
  viewWidth: 1280,
  viewHeight: 800,
  saveKey: 'solmar-bay-save-v1',
};

export const PLAYER = {
  walkSpeed: 210,
  runSpeed: 320,
  radius: 14,
  maxHealth: 100,
  startMoney: 120,
  startAmmo: 24,
};

export const CAR = {
  accel: 520,
  reverseAccel: 320,
  maxSpeed: 560,
  maxReverse: 160,
  brake: 900,
  drag: 0.9,
  steer: 2.6,
  length: 54,
  width: 26,
};

export const POLICE = {
  maxCars: 5,
  chaseSpeed: 520,
  ramDamage: 8,
  arrestSeconds: 2.5,
  evadeSeconds: 9,
  decaySeconds: 5,
};

export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    giver: 'Mara',
    briefing: 'Mara needs wheels. Steal any car on the street, then bring it to her garage on Coral Row.',
    reward: 250,
  },
  {
    id: 'bay-run',
    name: 'Bay Run',
    giver: 'Mara',
    briefing: 'A buyer is waiting across town. Hit all four checkpoints along the bay before the clock runs out.',
    reward: 400,
    timeLimit: 95,
  },
  {
    id: 'heat',
    name: 'Heat',
    giver: 'Mara',
    briefing: 'The cops are all over you. Lose the heat, then slip back to the safehouse on Palm Court.',
    reward: 600,
  },
];

export const PALETTE = {
  water: '#1e7fa8',
  deepWater: '#156a92',
  sand: '#e8d29a',
  grass: '#5da24a',
  parkDark: '#4a8a3c',
  sidewalk: '#c9c2b4',
  asphalt: '#3c3f45',
  asphaltLine: '#e8d44d',
  buildingRoof: ['#c96f4a', '#7d9bb5', '#b5a06a', '#8a6fa8', '#5f8f7a', '#b55a5a', '#6a7f9e', '#d08a4e'],
  buildingWall: ['#e8dcc8', '#d9c9a8', '#f2e6d0', '#cdbfa5'],
  carColors: ['#d94f3d', '#3d7dd9', '#e8c33d', '#4ad97a', '#e8e8e8', '#2b2f36', '#d97ab5', '#7ad9d1'],
  playerShirt: '#e84a3d',
  policeCar: '#20242c',
  policeLight: '#3d7dd9',
};
