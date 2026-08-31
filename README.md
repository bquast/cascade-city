# Cascade City

A GTA3-flavoured open world in vanilla three.js. A 12x12-block city with districts (downtown towers, residential streets with pitched roofs, an industrial container yard) sits in a 2.4 km procedural countryside: rolling hills, pine and broadleaf forests, a lake, and country roads to the horizon. Walk, jack cars, shoot, earn wanted stars, and try to lose the cops in the hills. No frameworks, no build step, no CDN — three.js is vendored in `js/lib/`.

## Deploy to Cloudflare Pages

No build configuration needed:

1. Push this folder to a Git repo (or drag-and-drop it in the dashboard: Workers & Pages > Create > Pages > Upload assets).
2. Build command: none. Build output directory: `/` (root).
3. Done. Every file is well under the 25 MiB per-asset limit (largest is three.js at ~380 KB).

No `wrangler.toml`, no `_headers`, no Functions needed — it's fully static. If we later add a leaderboard or cloud saves, that goes in `/functions/api/` with bindings set in the dashboard (Pages > Settings > Functions).

## Run locally

Any static server from the project root, e.g.:

    python3 -m http.server 8000

then open http://localhost:8000. (Opening index.html via file:// won't work — ES modules need http.)

## Controls

- **WASD / arrows** — walk or drive
- **Mouse** — look; click to shoot (click the game once to capture the mouse, Esc releases it)
- **1 / 2 / 3** — fists / pistol / SMG
- **Shift** — sprint
- **E** — enter / exit vehicle (when stopped)
- **Space** — handbrake (drift)
- **H** — horn (pedestrians have opinions)

Crime raises your wanted level (stars, top right). Cops pursue, ram, and arrest you if they corner you on foot — BUSTED respawns you at the station, WASTED (health depleted) at the hospital. Stay clean and the heat fades.

## Structure

    index.html          entry + import map (maps "three" to the local file)
    style.css           HUD + start screen
    js/config.js        world dimensions, districts — tweak N_BLOCKS / WORLD_HALF to grow the map
    js/main.js          loop, mouse camera, foot/drive state machine, health
    js/city.js          procedural districts, deterministic seed, collision grid
    js/terrain.js       countryside: noise hills, forests (with collisions), lake, country roads
    js/world.js         one collision + ground-height API over city and terrain
    js/vehicle.js       car meshes + arcade physics, terrain tilt (5 vehicle types incl. police)
    js/player.js        on-foot character, gun-in-hand
    js/weapons.js       pistol/SMG hip-fire, tracers, occlusion
    js/police.js        wanted stars, pursuit AI, arrests
    js/traffic.js       AI cars on the road graph, pedestrians
    js/hud.js           scrolling world minimap, stars, health, speed, toasts
    js/audio.js         synthesized engine/horn/gunshots/siren — zero audio assets
    js/lib/             vendored three.js (module + core, r185)

All geometry and audio are procedural, so the entire game is ~90 KB of our code + three.js. Target: 60 fps on an M3 MacBook Air in Chrome.
