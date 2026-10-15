# AItower — Visual Style Guide

**Direction:** Cassette-futurism / dystopian-bureaucracy pixel art. The references are Terry Gilliam's
*Brazil* (ducts everywhere, forms in triplicate, the Ministry of Information) and *Mind Scanners*
(paranoid 1980s machinery, CRT diagnostics).

The fantasy: the AI boom, built with 1983 technology and run by a ministry that loves rubber stamps.

## 1. Aesthetic rules

### Racks & hardware: 1980s mainframes
- Tall cabinets in putty, beige or olive enamel with a darker kick-plate.
- Riveted brass corner fittings and a brass nameplate.
- A punch-card input slot, plus a small reel-to-reel or tape window on some models.
- A **flickering CRT telemetry panel**: a small green or amber screen with scanlines and a scrolling bar-graph.
  - It shows status: ok = green scroll, throttled = amber, tripped/failed = red, idle = dim.
- Rows of chunky indicator lamps (not modern LEDs): round, with a glow halo.
- DLC racks: copper manifold pipes on the side with brass valves.
- Storage racks: vertical tape-drive reels that spin while running.

### Logistics & cooling: exposed plumbing
- **Coolant conduits** are exposed **copper (supply) and verdigris/brass (return) pipes**.
  - Flanges every few tiles, pressure-gauge dials at joints, and a few drips.
- **Power conduits** are cloth-wrapped cable bundles in black and ochre on ceramic standoffs, inside a riveted cable tray.
- CRAH units are boxy enamel cabinets with **zip-tied desk fans** bolted on, louvres and a ribbon streamer that flutters.
- Chiller: a big riveted boiler-like tank, copper coils and a **steam vent** that puffs when loaded.
- CDU: a manifold of brass valves and wheel handles.
- Grid tie: Bakelite-and-porcelain insulators and a big knife switch.
- Genset: green-enamel diesel engine with an exhaust stack that coughs smoke when running.
- UPS: a lead-acid battery bank (glass jars) with an analog charge needle.
- Parts depot: wire cage with stamped crates labelled "FORM 27B/6".
- Bot charger: a brass dock with a pantograph arm.
- **Pneumatic tubes**: brass job-delivery tubes run along the ceiling, and a capsule zips along when a job starts or completes.
  This is decorative: the renderer can animate capsules toward racks that have a `jobId`.
- **Bots**: squat maintenance robots with a dome head, one camera eye and treads, in a filing-cabinet-grey body.
  They carry a crate and give off welding sparks while repairing.
- **Lifts**: an open cage lift with an accordion gate, brass frame and a dial floor indicator above the shaft.

### Building & world
- Walls: institutional green-grey tile, lower half darker (wainscot), with exposed ducts along the ceiling.
- Slabs: riveted steel I-beams.
- Sky: smoggy, with sodium-orange dusk, dirty teal day and a brown-black night with searchlights.
  The city silhouette is brutalist towers with blinking aircraft lamps and a giant "MINISTRY" sign.
- Earth below ground: dark soil with old pipes and cable runs.
- Optional scanline/vignette overlay at low opacity (≤ 8%) for the CRT feel; never hurt legibility.

### UI & HUD: control-room hardware
- Panels are **bakelite/enamel housings**: dark olive-brown or charcoal, bevelled edges, corner screws.
- Readouts sit **inside CRT screens** with a phosphor glow (`text-shadow`), faint scanlines and a curved inner shadow.
  - **Amber phosphor** is the default for numbers and data.
  - **Green phosphor** is for status and OK states.
  - Red is for alarms.
- **Analog needle gauges** for PUE, IT load and cash flow: cream dial face, black ticks, red needle, brass bezel.
  The needle eases with a slight overshoot.
- **Mechanical toggle switches** for overlays, mute and panel collapse; **chunky push buttons** for speed (lit when active).
- Labels look like stamped Dymo tape or typewritten form fields ("FORM AT-7: CONTRACT REQUISITION").
- Toasts arrive as teletype/telegram slips or rubber-stamped memos ("URGENT", "APPROVED", "DENIED").
- Bureaucratic copy is welcome in labels and descriptions, but numbers stay precise and readable.

## 2. Palette tokens
Use these exact hex values (CSS custom properties in the UI; constants in the renderer).

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0d0b08` | darkest background |
| `--housing` | `#2a261d` | panel body |
| `--housing-hi` | `#3b3528` | panel bevel highlight |
| `--housing-lo` | `#17140f` | panel bevel shadow |
| `--putty` | `#c9bc9c` | mainframe enamel |
| `--beige` | `#a8987a` | secondary enamel |
| `--olive` | `#5d6243` | enamel alt, wall tile |
| `--wall` | `#3d4a3f` | institutional green-grey |
| `--brass` | `#c8a248` | fittings, bezels |
| `--brass-dk` | `#7d6227` | brass shadow |
| `--copper` | `#c06a3b` | coolant supply pipe |
| `--verdigris` | `#4f9a85` | coolant return / patina |
| `--steel` | `#6f7473` | beams, cages |
| `--paper` | `#e8dfc6` | forms, dial faces |
| `--amber` | `#ffb000` | primary phosphor |
| `--amber-dim` | `#7a5400` | dim phosphor / grid lines |
| `--green` | `#33ff66` | OK phosphor |
| `--green-dim` | `#14662a` | dim green |
| `--red` | `#ff3b2f` | alarm lamp |
| `--sodium` | `#ff8a3d` | dusk sky, sodium lamps |
| `--smog` | `#4a5a55` | day sky |

Heat ramp (overlay): `#1b3a5c` (≤18 °C) → `#3f7f6a` (24) → `#ffb000` (30) → `#ff8a3d` (36) → `#ff3b2f` (42) → `#fff2c4` (≥50).

## 3. Fonts (self-hosted via `@fontsource`, loaded by `apps/web`)
| Family | CSS name | Use |
|---|---|---|
| VT323 | `"VT323"` | all CRT/phosphor readouts and numbers; Pixi text in the world |
| Special Elite | `"Special Elite"` | typewriter labels, form headings, memos, toasts |
| Silkscreen | `"Silkscreen"` | tiny stamped or Dymo labels (≤ 10 px), buttons |

Always add a fallback: `"VT323", ui-monospace, monospace`.
VT323 reads small, so use ≥ 18 px for primary numbers and ≥ 15 px for body text.

## 4. Pixel-art rules
- Integer zoom, nearest-neighbour sampling and no anti-aliasing, as before.
- 1 px dark outline on hardware silhouettes; a light rim on the top-left edge and a shadow on the bottom-right.
- At most 4–5 shades per material; use dithering (checkerboard) for gradients in sky and dials.
- Animated details stay subtle and readable: CRT flicker at 1–3 Hz, lamp blink, reel spin, steam puff, fan spin.
