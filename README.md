# Solmarina — Streets of Gold

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/adamavrianno/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/adamavrianno/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game that runs in desktop Chrome from static files — no
network, no build step. Serve `game/` with any static server and open
`index.html`.

## The game

Maya Reyes came back to **Solmarina** — a sun-soaked fictional coastal city
of pastel towers, palm avenues, a beach, a pier and a ferris wheel — with
nothing but a borrowed jacket and a debt to collect. Explore the city on foot
or behind the wheel, steal cars, outrun the Solmarina Police Department, and
run jobs for the Marbella crew to take the city back, one street at a time.

- **Open world**: a 9×9 avenue grid with ~120 buildings, a park, a plaza, a
  beach and a pier, all built from geometry and procedural canvas textures.
- **On foot and by car**: walk, sprint and jump; steal any of six fictional
  cars (Marlin Sedan, Comet GT, Palma Cruiser, Tortuga Van, Vela Roadster,
  Sol Pickup) and drive with arcade handling, handbrake slides and damage.
- **Traffic and pedestrians**: 16 AI cars cruise the avenues and turn at
  intersections; 34 pedestrians stroll the sidewalks and scatter when shots
  are fired.
- **Wanted level and police**: stealing, shooting and hitting pedestrians
  raise a 0–5 star wanted level. SPPD interceptors with flashing light bars
  chase and ram you; officers try to bust you on foot. Break line of sight
  and stay quiet to cool the heat off.
- **Missions and story**: six jobs with beacons, timers and paydays — steal a
  car for the pier, a timed three-drop courier run, a shakedown against the
  Red Vipers, a getaway, a crate setup and a final yacht job. Cash and respect
  reward play; 20 sun coins and health packs are scattered around the city.
- **Combat**: pistol with tracers and hit sparks, rival crew shooters who
  fight back, busted / wasted endings with fees and respawn.
- **HUD and menus**: wanted stars, cash, health, a live circular minimap
  (roads, traffic, police, enemies, mission beacon), speedometer, mission
  banners and toasts, a start screen, pause, and localStorage saving
  (H to save, Continue on the menu).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse drag | Look / orbit camera |
| Shift | Sprint |
| Space | Jump / handbrake |
| E | Steal / enter / exit a car |
| Click | Shoot (on foot) |
| M | Start next mission |
| P / Esc | Pause |
| H | Save game |
| C | Camera distance |

## Structure

The game's own source lives in `game/src/`, one job per file:

- `main.js` — bootstrap, input, third-person camera, frame loop, screenshots
- `city.js` — Solmarina itself: roads, buildings, park, plaza, beach, pier
- `player.js` — the on-foot character, entering/exiting cars, health
- `vehicles.js` — car models, spawning, arcade driving physics
- `traffic.js` — AI traffic cars and pedestrians
- `police.js` — wanted level, SPPD interceptors and officers
- `missions.js` — the six-job story, beacons, timers, paydays
- `combat.js` — shooting, tracers, rival crew, hit feedback
- `hud.js` — HUD, minimap, banners, menus, pause, busted/wasted
- `audio.js` — procedural WebAudio sound (engine, sirens, shots, pickups)
- `save.js` — localStorage save / load
- `state.js` — the shared game state every system reads and writes

Three.js is vendored as `game/vendor/three.module.min.js`. Everything else is
original: the city, characters, story, vehicle names and art are invented for
this game — nothing from any commercial game.

## Play it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Screenshot staging modes (used to take the four screenshots in
`screenshots/`): `?shot=chase`, `?shot=foot`, `?shot=drive`, `?shot=mission`.
