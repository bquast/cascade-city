# Cascade City v6 — "Two Point Oh" (the GTA V round)

4 km x 4 km. City on the south coast, wilderness rising north to a 150 m mountain,
desert in the northeast. Vanilla three.js, no build step, no assets.

## GTA V features
- **Three protagonists** — press Q to switch: MARCUS (downtown), FELIX (Palm Flats),
  BUCK (the Dusty Palms trailer park). Camera flies between them; each keeps their
  own position, health, and vehicle. Cash and weapons are shared.
- **Day/night cycle** (8 min/day): moving sun, dusk skies, stars, street lamps that
  come on at night, glowing AI headlights, and a spotlight headlight on your car.
- **5-star wanted level** — at 4 stars, police HELICOPTERS join with searchlights.
  You can still jack a stopped cruiser for vigilante work.
- **The map**: ocean + beach boulevard with palms, a drivable pier with a pavilion,
  Port Cascade with gantry cranes, the CASCADE sign on the foothill, a wind farm
  with spinning turbines, vineyards, a desert full of saguaros, Mount Cascade with
  a switchback road — and a stunt ramp at the summit pointing off the cliff.
- The concrete channel now empties into the sea. New rides: the Brawler muscle car
  and the Ranchero pickup. Water drowns you; drive in at your peril.

## Everything from before
Four+ settlements with cul-de-sacs and a trailer park, taxi/vigilante/delivery
missions (T), three synth radio stations (R), 30 hidden packages, weapon/health/cash
pickups, bears/stags/coyotes/dogs, golfers and rednecks, overpass + channel bridge
with true over/under physics.

## Controls
WASD · mouse aim · E enter/exit · Q switch character · T missions · R radio ·
H horn · Space handbrake · 1/2/3 weapons · Shift sprint

## Deploy
Drag the folder into Cloudflare Pages. Build command: none. Output dir: `/`.
Local: `python3 -m http.server`
