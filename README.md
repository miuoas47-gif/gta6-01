# Solmar Bay — an open-world crime game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/miuoas47-gif/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/miuoas47-gif/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is a 2D top-down open-world crime game that runs entirely in
your browser from static files — no build step, no network, no downloads.
Explore a sun-soaked fictional coastal city on foot and by car, steal
wheels, outrun the Solmar Bay police, and run jobs for Mara.

You are **Rico Vega**, fresh off the boat in Solmar Bay with $120 and a
reputation to build. Mara, the fixer on Coral Row, has three jobs for you —
and the whole city in between.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Walk (hold Shift to run) or drive |
| E | Enter a car — or step out of one |
| Mouse | Aim Rico's pistol |
| Click | Shoot |
| F | Shove a pedestrian — or hail a taxi fare |
| Enter | Start the next mission |
| P / Esc | Pause |
| S (while paused) | Save game |
| C (title screen) | Continue a saved game |
| M | Mute / unmute |
| R (while paused) | Restart the day |

## The city

- **Explore on foot and by car** — a seeded grid city with roads, buildings,
  parks, a beach and the bay, all generated from one seed so every run
  builds the same Solmar Bay.
- **Traffic and pedestrians** — cars cruise the roads and turn at
  intersections; pedestrians stroll the sidewalks and scatter when a car
  bears down on them.
- **Steal and drive** — walk up to any parked or traffic car and press E.
  Stealing is a crime, and the city notices.
- **Wanted level** — one to five stars for stealing cars, hitting
  pedestrians and shooting. Police cruisers chase, ram and try to arrest
  Rico. Lose them and the heat cools off.
- **Three story missions** — *First Wheels* (steal a car and deliver it to
  Mara's garage), *Bay Run* (four checkpoints against the clock), and
  *Heat* (lose a 3-star wanted level and reach the safehouse).
- **Side work** — taxi fares and parcel pickups pay cash between jobs.
- **Combat** — a pistol aimed with the mouse, plus a shove on foot.
- **HUD** — health, money, ammo, wanted stars, mission objective, clock,
  and a live minimap with the mission marker, police and fares.
- **Sound** — engine hum, police sirens and pickup blips, all synthesised
  with WebAudio. No audio files.
- **Save** — your money, mission progress and position persist in
  localStorage; continue from the title screen.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser and press Enter.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game in
headless Chromium, staged by an autopilot that plays the game's own rules
forward from the seeded world (`?shot=start`, `?shot=drive`,
`?shot=chase`, `?shot=mission`).

## Play more make.fun bounties

https://make.fun/?ref=6gvkzysc

## License

MIT — see [LICENSE](LICENSE).
