# Cascade City

A tiny GTA3-flavoured open world in vanilla three.js. Walk, jack cars, drive badly, honk at pedestrians. No frameworks, no build step, no CDN — three.js is vendored in `js/lib/`.

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
- **Shift** — sprint
- **E** — enter / exit vehicle (when stopped)
- **Space** — handbrake (drift)
- **H** — horn (pedestrians have opinions)

## Structure

    index.html          entry + import map (maps "three" to the local file)
    style.css           HUD + start screen
    js/config.js        city dimensions — tweak N_BLOCKS to grow the map
    js/main.js          loop, camera, foot/drive state machine
    js/city.js          procedural city, deterministic seed, collision grid
    js/vehicle.js       car meshes + arcade physics (4 vehicle types)
    js/player.js        on-foot character
    js/traffic.js       AI cars on the road graph, pedestrians
    js/hud.js           minimap, speed, toasts
    js/audio.js         synthesized engine/horn/thud — zero audio assets
    js/lib/             vendored three.js (module + core, r185)

All geometry is procedural (instanced meshes), so the entire game is ~60 KB of our code + three.js. Target: 60 fps on an M3 MacBook Air in Chrome.
