# World Intel Dashboard

One page that shows what is happening right now: a live map, weather, climate
patterns, markets, world news, and the deepest free view of US unemployment.

## Start it

Double-click **start.cmd**. It opens <http://localhost:8791> in your browser.
Leave the black window open — that is the server. Closing it stops the dashboard.

Port 8791 is used because 8787 already belongs to the MCP bridge on this machine.

## The one thing it needs from you

The jobless panels use FRED (the St. Louis Fed's free data service). Until a key
is present those tiles stay grey and say `no FRED_API_KEY set`.

1. Get a free key: <https://fredaccount.stlouisfed.org/apikeys>
2. Copy `.env.example` to `.env` in this folder
3. Paste the key after `FRED_API_KEY=`
4. Restart start.cmd

Everything else needs no key at all.

## What is on it

| Panel | Where the data comes from | Key? |
|---|---|---|
| Map — rain radar (animated) | RainViewer | no |
| Map — severe weather alerts | api.weather.gov (National Weather Service) | no |
| Map — earthquakes, 2.5+ last 24h | USGS | no |
| Map — world events | NASA EONET + GDACS disaster alerts | no |
| Map — heat field | Open-Meteo world grid (temp + CO₂), FRED state rates, event density | temp/CO₂/events no |
| Map — conflicts | curated theatre list + live wire coverage | no |
| Map — power plants | WRI Global Power Plant Database (34,936 plants) | no |
| Planet check | ERA5 + NOAA OISST + NOAA NCEI + NOAA GML CO₂/CH₄ + CPC ENSO | no |
| Map — state jobless rate | FRED | yes |
| Weather (watched places) | Open-Meteo | no |
| Climate patterns | Open-Meteo ERA5, NOAA global anomaly, NOAA ENSO index | no |
| Markets | Yahoo Finance, CoinGecko, FRED for rates and CPI | rates only |
| Prediction markets | Kalshi public API | no |
| Market news (US/Europe/Asia) | MarketWatch + Google News | no |
| Live news TV | YouTube — ABC News Live, CNN, Al Jazeera | no |
| World events feed | BBC, NPR, Al Jazeera, Sky, Reuters via Google News | no |
| Road cameras | Caltrans (12 districts), 511 New York, NYC DOT — 6,320 live | no |
| Jobless — national + industries | FRED | yes |
| Jobless — state rates & payrolls | BLS public API | no |
| Jobless — state weekly claims | US Dept of Labor ETA 539 | no |

## Road cameras

Turn on **Road cameras** in the map's layer panel, then zoom in past level 9 —
below that there are too many to be useful, and the layer says `zoom in (6320)`
instead of drawing them. Only cameras in view are drawn, capped at 600.

Click one for its live picture, with links to the full image and, on Caltrans
cameras, an HLS video stream.

| Source | Cameras |
|---|---|
| Caltrans, all 12 districts | 3,474 |
| 511 New York (statewide) | 1,876 |
| NYC DOT | 970 |

US only. A worldwide set means Windy's webcam API, which needs a free key —
it returns 403 without one.

## Watched places

The weather panel covers Murrieta CA, Los Angeles, San Diego, New York, Florida,
Spain and France. Florida, Spain and France are shown for Miami, Madrid and
Paris — each card says so. To change the list, edit `locations.mjs` and restart.

Clicking a place centres the map on it and points the climate panel at it.

## Map controls

The map is a HUD: read-outs sit on the map itself. Top left is system status
(clock, zoom, how many feeds are live, time to next refresh, and the name of
anything that is down). Top right is the layer list with a live count beside
each one, plus the power-plant fuel filter. Bottom left is the field legend,
bottom right follows your cursor.

- **Base** — nine keyless styles in the dropdown: Dark, Light, Voyager, Streets,
  Topographic, Terrain, National Geographic, Ocean floor, OpenTopoMap. Zoom goes
  to level 22 on all of them. When you pass the real detail the SYSTEM panel says
  `IMAGERY upscaled past z21` — the picture is enlarged, not sharper.
- **Satellite** is a toggle, not a style. It rides *on top of* whichever map
  style you picked, so any tile the imagery lacks shows the map underneath
  instead of a hole — and you can blend the two with the opacity slider.
- **Labels** puts place names, boundaries and roads over the imagery, so
  satellite view stays readable.

### ⚙ Tiles — the adjust panel

Opens in the top-right HUD. Everything is remembered between visits.

| Control | What it does |
|---|---|
| Satellite | Opacity of the imagery over the map — 50% gives you both at once |
| Base map | Opacity of the map style underneath |
| Brightness / Contrast | Lift dark imagery, or harden edges |
| Colour | 0% is black-and-white, 250% is heavily saturated |
| Grayscale | Drains colour so the data layers on top stand out |
| Hue shift | Rotates the whole palette |
| sharp @2x tiles | Requests double-resolution tiles on high-DPI screens (CARTO styles) |
| crisp upscaling | Pixel-sharp instead of smoothed when zoomed past real detail |
| Reset tiles | Back to defaults, keeping your chosen style |

The six sliders are a **CSS filter over the tile layers** — they re-tune the
picture instantly without refetching a single tile. Only the style, satellite,
labels and @2x switches cause new tile requests.

### "Zoom level not supported" — killed properly

Esri answers **HTTP 200 with a 2,521-byte JPEG that has that sentence printed on
it** whenever you pass the deepest level it holds for a tile. The browser cannot
tell it from real imagery, so it gets painted on the map. Two earlier fixes only
narrowed it, because the depth varies *tile by tile* and old copies sit in the
browser cache.

The fix that actually removes it: **every Esri tile is fetched by our own server**
(`/api/tile/<service>/<z>/<y>/<x>`). The proxy hashes each response and, if the
bytes are that exact image (md5 `f27d9de7…`), returns a transparent pixel
instead. The card cannot reach the map — not at any zoom, not from any cache.
`/api/health` reports `tiles: {served, blanked, missing, failed}` so you can see
it working.

Measured imagery depth through the proxy: **Murrieta z19, Los Angeles z20,
New York z20**, nothing deeper anywhere tested. So the satellite layer upscales
from **z19**, which exists everywhere. Zoom runs to **24** — past z19 the picture
gets progressively softer, but it is always real imagery, never blank and never
an error card. The SYSTEM panel shows `imagery native z19` so you know when
you are looking at an enlargement.

The SYSTEM panel also shows a build number (`b7`). If it does not match what
this README describes, the browser is running a cached copy — hard-refresh.
- **Field** — the heat layer. Seven choices:
  - *Temperature*: air temperature on a 10° grid over the whole planet (540
    points). Zoom past 5 over the US or Europe and it swaps to a 2° grid
    (275 points) automatically.
  - *Feels like*: apparent temperature — heat index in summer, wind chill in
    winter. This is the one that matches how it actually feels outside.
  - *⚠ Danger*: **the "what to watch out for" view.** Paints only the places
    past a risk threshold and leaves everywhere comfortable blank, so the areas
    worth watching are the only thing on the map. Hot zones in reds, cold zones
    in blues, both read off the feels-like field. The legend counts how many
    grid cells are in each camp and names the worst on the planet right now,
    e.g. *Hottest 107°F — Extreme caution, Coldest -14°F — Frostbite risk*.
  - *CO₂ ppm*: ground-level carbon dioxide worldwide from the CAMS model.
  - *Jobless*: US state unemployment (needs the FRED key).
  - *Event density*: where alerts, quakes and disasters are clustering.
- **Colour ramp** — the dropdown beside the field buttons: Thermal (the familiar
  weather-map look), Ice ↔ Fire (diverging, so cold reads as loudly as hot),
  Viridis (colour-blind safe), Spectral. Remembered between visits.

Blob size is derived from the real spacing of the samples at your current zoom,
so the field stays continuous instead of breaking into dots. The legend always
names the grid resolution — it never looks sharper than it is.

### Danger thresholds

Read off feels-like temperature, matching the National Weather Service bands:

| Hot | | Cold | |
|---|---|---|---|
| 90°F | Caution | 32°F | Freezing |
| 103°F | Extreme caution | 15°F | Hard freeze |
| 115°F | Danger | 0°F | Frostbite risk |
| 125°F | Extreme danger | −20°F | Extreme cold |

This is a **current-conditions** view, not a forecast, and it is sampled on a
coarse grid — treat it as "which regions to look at", then click a spot for its
exact reading or check the NWS alert polygons for official warnings.
- **Whole planet** — jumps back out to the full globe.
- **Radar** — Play animates the last hour plus two forecast frames; the slider
  scrubs by hand and the timestamp marks forecast frames as such.
- **Opacity** — fades the radar over the base map.
- **Click anywhere** on the map for that spot's current weather.
- **Layers** button (top right) toggles each overlay; **Fullscreen** expands the map.
- Clicking a row in the state jobless table flies the map to that state.

## Conflict watch — what it does and does not tell you

The list of theatres in `world.mjs` is maintained by hand and stamped with the
date it was last reviewed. What is live is the number beside each one: how many
stories the wires filed about it in the last 48 hours. That is a measure of
**attention, not casualties** — a quiet war and a loud diplomatic spat can score
alike, and `100+` just means the feed hit its own cap.

There is no free, keyless, geocoded feed of live conflict events: ACLED needs a
key and UCDP's API now returns 401. So this panel is honest about being a
curated list plus a live attention signal, rather than pretending to be a
battle tracker.

## Energy

The map plots every plant of 300 MW or more (4,356 of 34,936) coloured by fuel
and sized by capacity; the filter narrows to fossil, low-carbon, or one fuel.
The panel shows global installed capacity by fuel and the biggest generators.
This is WRI's database — a periodic snapshot, not a live grid feed, and the
panel says so.

## Arranging the panels

Panels float freely — put any of them anywhere, at any size.

- **Move** — drag a panel by its title bar.
- **Resize** — drag any **corner** or **edge**. All eight grab zones are live;
  the bottom-right corner shows a small marker when you hover the panel.
- **Snap** — sizes and positions snap to a 24th of the page across and 10px down.
  Hold **Alt** while dragging to place it exactly where you like instead, or turn
  snapping off in the Layout menu.

Title-bar buttons, which appear on hover:

| Button | Does |
|---|---|
| ⌃ | Fold the panel down to just its title bar |
| ⤢ | Stretch it to the full width |
| ✕ | Hide it — bring it back from the Layout menu |

The **▦ Layout** button in the top bar has the rest:

- **Density** — Tiny, Compact, Normal or Large; scales text and padding everywhere.
- **Snap to grid** — on or off.
- **Panels** — checkboxes to show or hide any of the eleven.
- **Tidy up** — repacks everything into neat rows *at the sizes you gave them*,
  for when an arrangement has drifted into a mess.
- **Reset layout** — back to the shipped arrangement.

Positions are stored as a fraction of the page width, so the arrangement holds
its shape when the window changes size. Everything is saved in the browser.
Below 900px wide the panels stack one per row and resizing is switched off,
since free positioning stops making sense on a narrow screen.

## How to read it

- The **dot** next to each panel title is green when the data is fresh, amber
  when it is older than it should be, red when the source did not answer.
- Every tile carries its own date. A tile with no data says `no data` and greys
  out — it never shows an old number as if it were current.
- The jobless panel prints its own coverage line, e.g. `48/51 states reporting`.
  Missing states are shown greyed in the table, not silently dropped.
- In the jobless tiles, **green means the labor market got better** and red means
  it got worse — not simply up or down. Rising unemployment is red even though
  the number went up.

## Refresh

Auto-refreshes every 8 hours; the countdown is in the top right. "Refresh now"
forces a fresh pull past the cache.

## If something breaks

- Nothing loads at all → the server window probably closed. Run start.cmd again.
- One panel red, rest fine → that source is down. It will recover on its own.
- All jobless tiles grey → the FRED key is missing or wrong. Check `.env`.
- `server.err` in this folder holds crash output.
- Health check: <http://localhost:8791/api/health>

## Sources that did not work out

Stooq (quotes) now sits behind a JavaScript bot check, and GDELT rate-limits an
unauthenticated caller immediately. Both were replaced. ReliefWeb's public API
returns 410/403 and was dropped.
