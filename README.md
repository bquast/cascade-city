# Cascade City

A GTA3-flavoured open world (240 pedestrians, 120 vehicles) in vanilla three.js. A 12x12-block city with districts (downtown towers, residential streets with pitched roofs, an industrial container yard) sits in a 2.4 km procedural countryside: rolling hills, pine and broadleaf forests, a lake, and country roads to the horizon. Walk, jack cars (or the Wasp motorcycle), shoot — on foot or drive-by — blow things up, hit the stunt ramps, earn wanted stars, and try to lose the cops in the hills. No frameworks, no build step, no CDN — everything, including the vendored three.js, sits flat in the project root.

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
- **Mouse** — aim; the crosshair is exactly where bullets go, full look up/down. Click to shoot (works while driving too). Click the game once to capture the mouse, Esc releases it
- **1 / 2 / 3** — fists / pistol / SMG
- **Shift** — sprint
- **E** — enter / exit vehicle (when stopped)
- **Space** — handbrake (drift)
- **H** — horn (pedestrians have opinions)

Vehicles have hit points: crashes, bullets and cop rams wear them down until they explode (chain reactions included — don't park next to a burning taxi). Three marked stunt ramps live in the countryside: one on each country road and one aimed across the lake. Cresting a hill at speed also gets you airborne.

Crime raises your wanted level (stars, top right). Cops pursue, ram, and arrest you if they corner you on foot — BUSTED respawns you at the station, WASTED (health depleted) at the hospital. Stay clean and the heat fades.

## Structure

Flat root, per house style — every module lives next to index.html:

    index.html          entry + import map (maps "three" to the local file)
    style.css           HUD + start screen
    config.js           world dimensions, districts, ramps — tweak to grow the map
    main.js             loop, aim rig, foot/drive state machine, health
    city.js             procedural districts, deterministic seed, collision grid
    terrain.js          countryside: noise hills, forests, lake, country roads
    stunts.js           ramps + their height contribution
    world.js            one collision + ground-height API over everything
    vehicle.js          car & bike meshes, arcade physics, airborne jumps, HP
    player.js           on-foot character, gun-in-hand
    weapons.js          pistol/SMG hip-fire, tracers, occlusion
    police.js           wanted stars, pursuit AI, arrests
    effects.js          explosions, chain detonations, wrecks
    traffic.js          AI cars on the road graph, pedestrians
    hud.js              scrolling world minimap, stars, health, speed, toasts
    audio.js            synthesized engine/horn/gunshots/siren/boom
    input.js            keyboard state
    three.module.min.js, three.core.min.js — vendored three.js r185


All geometry and audio are procedural, so the entire game is ~90 KB of our code + three.js. Target: 60 fps on an M3 MacBook Air in Chrome.
