[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/adamavrianno/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/adamavrianno/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

# Porto Verde: Neon Tide

A 3D open-world crime game for the [Make GTA 6 bounty](https://make.fun/c/gta6-01) on make.fun.
Dante Cole, a former courier, is pulled back into Porto Verde's underworld — a sun-soaked
coastal city with six districts to explore on foot and by car.

## The city

- **Old Harbor** — docks, cranes and warehouses on the western waterfront
- **Neon Strip** — the bright nightlife avenue at the city's heart
- **Hillside Villas** — winding roads and big houses on the north-east rise
- **Industrial Docks** — container stacks and trucks in the north-west
- **University Quarter** — campus, plaza and clock tower
- **Beachfront** — promenade, pier and the Casino Verde on the southern sand

## What you can do

- **Explore on foot and by car** — walk, run and jump in third person; steal five
  vehicle types (compact, sedan, sports, van, truck), each with its own handling.
  Traffic cars and pedestrians fill the streets.
- **Wanted system (0–5 stars)** — stealing cars, hitting pedestrians and shooting
  raise the heat. Police cars and officers respond with escalating numbers and
  aggression; break line of sight to cool down. Get busted or wasted and you retry.
- **Six story missions** — a timed courier pickup, stealing a sports car off the
  Neon Strip, escaping a police dragnet, protecting a witness, gathering heist gear,
  and the final Casino Verde heist with a four-star getaway. Missions pay out and
  unlock the next one.
- **Side work** — taxi fares (press T while driving) and a stunt jump on the
  beachfront avenue.
- **Combat** — pistol with aim, ammo and reload, melee up close, mission gunmen,
  and a health system.
- **HUD** — live circular minimap (player, mission marker, police, traffic),
  wanted stars, money, mission objective, health bar and speedometer.
- **Menus & saving** — start screen with controls, pause menu, and automatic
  localStorage saves (money, mission progress, best stats) with a Continue option.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look (click to lock the pointer) |
| E | Enter / exit car |
| Space | Jump on foot · handbrake in a car |
| Shift | Run |
| F | Fire pistol / melee up close |
| V | Melee |
| R | Reload |
| M | Start next mission |
| T | Take a taxi fare (while driving) |
| P / Esc | Pause |

## Play it

No build step — just static files under `game/` (three.js r160 is vendored at
`game/vendor/three.module.min.js`, and every sound is synthesised live with the
Web Audio API, so the game makes zero network requests).

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

## Layout

- `game/index.html` — page shell, import map, HUD and menus
- `game/src/main.js` — bootstrap, game loop, camera, entering cars, fail states
- `game/src/city.js` — districts, road grid, buildings, landmarks, collision
- `game/src/player.js` — on-foot movement
- `game/src/vehicles.js` — vehicle types, spawning, driving physics
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted level, pursuit cars, officers, bust
- `game/src/missions.js` — six story missions, taxi fares, stunt jumps
- `game/src/combat.js` — pistol, melee, enemies, health
- `game/src/hud.js` — HUD, minimap, toasts
- `game/src/audio.js` — synthesised engine, sirens, gunfire and music loops
- `game/src/save.js` — localStorage save / load
- `game/src/state.js` — shared state, districts, vehicle specs
- `game/src/shots.js` — screenshot staging (`?shot=chase|street|drive|mission`)
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output
  directory and writes `dossier.json`

## License

MIT — see `LICENSE`.
