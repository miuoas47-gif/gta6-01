# Solmar Bay — an open-world crime game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/miuoas47-gif/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/miuoas47-gif/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is a 2D top-down open-world crime game set in a sun-soaked
fictional coastal city. You are **Rico Vega**, a driver with nothing but a
fast mouth and faster hands, working jobs for **Mara** while the Solmar Bay
Police Department tries to keep the city quiet.

Explore the city on foot or by car, steal whatever has wheels, outrun the
police, run story missions, pick up taxi fares, and build your name — and
your bankroll — one job at a time.

Play it free, and bring your friends: [https://make.fun/?ref=6gvkzysc](https://make.fun/?ref=6gvkzysc)

## What's in the game

- **A living city** — a seeded 3600×2600 coastal city with a road grid, beach
  and pier, parks, districts (Palm Court, Harbor Row, Marina District, Old
  Town, Sunset Strip) and day lighting.
- **On foot and by car** — walk with WASD, steal parked and traffic cars with
  E, drive with arcade physics (acceleration, braking, steering, drift).
- **Traffic and pedestrians** — cars follow the roads and turn at
  intersections; pedestrians walk the sidewalks and run from danger.
- **Wanted level** — 1–5 stars that rise when you steal cars, hit
  pedestrians or shoot. SBPD cruisers spawn, chase and ram you; the heat
  fades only once you are out of sight.
- **Story missions** — three jobs for Mara with objectives, markers,
  dialogue and completion/fail states:
  1. *First Wheels* — steal a car and deliver it to the chop shop.
  2. *Bay Run* — hit four checkpoints across the city against the clock.
  3. *Heat on the Bay* — reach three stars, then shake the heat and reach
     the safehouse.
- **Taxi fares** — a repeatable side job that pays per ride after your first
  mission.
- **Combat** — aim with the mouse, shoot the pistol, or punch with F.
- **HUD and minimap** — health, money, wanted stars, mission objective,
  clock, ammo, and a live minimap of the whole city.
- **Menus and saving** — title screen, pause, Wasted/Busted screens,
  restart, and a localStorage save with continue.
- **Sound** — fully synthesized WebAudio: engine hum, two-tone sirens,
  pickup blips, gunshots and crashes. No audio files.
- **Deterministic world** — a seeded generator builds the same city every
  time, so the game and its screenshots repeat exactly.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive the car |
| E | Enter / exit a car (steal it) |
| Mouse + click | Aim and shoot the pistol |
| F | Punch |
| P / Esc | Pause |
| M | Retry the current mission |
| Enter | Start / restart |

On foot you can also pick up cash lying on the sidewalks. Stealing a car or
hurting someone raises your wanted level — lose the police by getting far
away and staying quiet until the stars fade.

## Run it

```sh
node serve.ts
```

Then open [http://localhost:8080](http://localhost:8080) in a desktop
browser. No build step, no network — everything is static files under
`game/`.

Screenshots are staged scenes of the real game (`?shot=start|drive|chase|mission`),
played forward from a seeded world by an autopilot that follows the real
rules. See `shots.json`.

## Structure

- `game/index.html` — the page, one canvas.
- `game/src/config.js` — tuning and constants.
- `game/src/random.js` — the seeded generator.
- `game/src/world.js` — the city, the state, geometry helpers.
- `game/src/traffic.js` — traffic cars, pedestrians, driving physics.
- `game/src/police.js` — wanted level and SBPD cruisers.
- `game/src/missions.js` — story missions and taxi fares.
- `game/src/combat.js` — pistol, melee, bullets, pickups.
- `game/src/render.js` — drawing the city, cars and screens.
- `game/src/hud.js` — HUD and live minimap.
- `game/src/audio.js` — synthesized WebAudio sound.
- `game/src/input.js` — keyboard and mouse.
- `game/src/game.js` — one fixed step of the whole game.
- `game/src/shots.js` — the screenshot autopilot.
- `game/src/main.js` — boot, the loop, screens and saving.
- `main.ts` — the entry program (copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json`).

## License

MIT — see [LICENSE](LICENSE). All names, characters, places and art are
original works for this entry.
