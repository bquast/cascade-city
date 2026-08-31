# Cascade City v5 — "The Amalgamation"

A GTA-flavoured open world in vanilla three.js. No build step, no CDN, ~220 KB zipped.

## New this round
- **San Andreas-style world**: four settlements — Cascade City (downtown, rolling grades),
  Palm Flats (residential + cul-de-sacs), Dockside (industrial), Hickory Corner (redneck
  hamlet) — plus a golf course, linked by country roads.
- **Drivable open channel**: an LA-river concrete drain runs 2.1 km through the map.
  Drive down in at either end and follow it under the bridge and the overpass.
- **Overpass** with layered physics: real over/under — the golf road passes beneath it.
- **Wildlife**: dogs, coyotes, stags — and bears that will chase you on foot.
- **Missions (T in vehicle)**: taxi fares (Cabbie), vigilante (Patrol — yes, you can jack
  a stopped cop car), deliveries (Mule Van).
- **Radio (R while driving)**: three synthesized stations — lofi, synthwave, country.
- **Pickups & money**: weapons now start locked — find pistol/SMG spawns. Health packs,
  cash drops from peds, and 25 hidden packages ($500 each).
- Motorcycles get extra pop off crests — jump the hills.

## Controls
WASD move · mouse aim · E enter/exit · Space handbrake · H horn ·
T missions · R radio · 1/2/3 weapons · Shift sprint

## Deploy (Cloudflare Pages)
Drag this folder into Pages. Build command: none. Output dir: `/`.
Local test: `python3 -m http.server` then open localhost:8000.

All geometry procedural, all audio synthesized. Zero asset files, zero dependencies
beyond the vendored three.js (r185).
