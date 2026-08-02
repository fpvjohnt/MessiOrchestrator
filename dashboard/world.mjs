// Global grid, conflict theatres and energy config for the world view.

// 10-degree grid over the inhabited latitudes = 540 points. The size is set by
// Open-Meteo's limit of 600 locations per minute: a 5-degree grid (2,088 points)
// silently came back only 29% filled. 540 fits in one pass, so the planet is
// either fully covered or visibly not. The step is printed in the legend so the
// map never looks more precise than it is; zooming in swaps to the finer
// regional grid over the US and Europe.
export const GLOBAL_GRID = (() => {
  const pts = [];
  for (let la = -60; la <= 80; la += 10) for (let lo = -180; lo < 180; lo += 10) pts.push([la, lo]);
  return pts;
})();
export const GRID_STEP_DEG = 10;

// Curated conflict theatres. This list changes on the scale of months, so it is
// reviewed by hand and stamped; the LIVE part is the news count next to each
// entry, which is fetched fresh. A theatre with no recent coverage says so
// rather than implying quiet.
export const CONFLICTS_REVIEWED = '2026-07-28';
export const CONFLICTS = [
  { key: 'ukraine',  name: 'Ukraine',            kind: 'war',        lat: 48.4,  lon: 35.0,   parties: 'Russia — Ukraine',                 query: 'Ukraine Russia war' },
  { key: 'gaza',     name: 'Gaza / Israel',      kind: 'war',        lat: 31.4,  lon: 34.4,   parties: 'Israel — Hamas',                   query: 'Gaza Israel' },
  { key: 'lebanon',  name: 'Lebanon border',     kind: 'war',        lat: 33.3,  lon: 35.5,   parties: 'Israel — Hezbollah',               query: 'Lebanon Israel Hezbollah' },
  { key: 'syria',    name: 'Syria',              kind: 'insurgency', lat: 35.0,  lon: 38.5,   parties: 'multiple factions',                query: 'Syria conflict' },
  { key: 'yemen',    name: 'Yemen / Red Sea',    kind: 'war',        lat: 15.4,  lon: 44.2,   parties: 'Houthis — coalition',              query: 'Yemen Houthi Red Sea' },
  { key: 'sudan',    name: 'Sudan',              kind: 'war',        lat: 15.5,  lon: 32.5,   parties: 'SAF — RSF',                        query: 'Sudan war RSF' },
  { key: 'drc',      name: 'DR Congo (east)',    kind: 'war',        lat: -1.7,  lon: 29.2,   parties: 'DRC — M23 and militias',           query: 'DR Congo M23 conflict' },
  { key: 'sahel',    name: 'Sahel',              kind: 'insurgency', lat: 14.5,  lon: -2.0,   parties: 'Mali/Burkina/Niger — jihadist groups', query: 'Sahel Mali Burkina Faso attack' },
  { key: 'nigeria',  name: 'Nigeria',            kind: 'insurgency', lat: 11.0,  lon: 12.0,   parties: 'Nigeria — Boko Haram, banditry',   query: 'Nigeria Boko Haram attack' },
  { key: 'somalia',  name: 'Somalia',            kind: 'insurgency', lat: 3.5,   lon: 45.5,   parties: 'Somalia — al-Shabaab',             query: 'Somalia al-Shabaab' },
  { key: 'ethiopia', name: 'Ethiopia',           kind: 'insurgency', lat: 11.5,  lon: 38.5,   parties: 'federal forces — regional militias', query: 'Ethiopia conflict Amhara' },
  { key: 'myanmar',  name: 'Myanmar',            kind: 'war',        lat: 21.0,  lon: 96.0,   parties: 'junta — resistance groups',        query: 'Myanmar civil war' },
  { key: 'haiti',    name: 'Haiti',              kind: 'insurgency', lat: 18.6,  lon: -72.3,  parties: 'state — armed gangs',              query: 'Haiti gang violence' },
  { key: 'pakafg',   name: 'Pakistan / Afghan border', kind: 'insurgency', lat: 32.5, lon: 69.5, parties: 'Pakistan — TTP',                query: 'Pakistan Afghanistan border militants' },
  { key: 'kashmir',  name: 'Kashmir',            kind: 'tension',    lat: 34.1,  lon: 74.8,   parties: 'India — Pakistan',                 query: 'Kashmir India Pakistan' },
  { key: 'taiwan',   name: 'Taiwan Strait',      kind: 'tension',    lat: 24.5,  lon: 120.0,  parties: 'China — Taiwan',                   query: 'Taiwan Strait China military' },
  { key: 'scs',      name: 'South China Sea',    kind: 'tension',    lat: 13.0,  lon: 115.0,  parties: 'China — Philippines and others',   query: 'South China Sea Philippines' },
  { key: 'korea',    name: 'Korean peninsula',   kind: 'tension',    lat: 38.3,  lon: 127.0,  parties: 'North Korea — South Korea',        query: 'North Korea missile' },
];

// Fuel colours for the energy layer, warm for fossil, cool for low-carbon.
export const FUEL_COLORS = {
  Coal: '#ff2d2d', Oil: '#f0883e', Gas: '#ffd24a', Petcoke: '#f0883e',
  Nuclear: '#c58cff', Hydro: '#31c8ff', Wind: '#7ee787', Solar: '#ffe066',
  Geothermal: '#ff9db1', Biomass: '#8fd694', Waste: '#a1a1aa', Storage: '#79c0ff',
  'Wave and Tidal': '#31c8ff', Cogeneration: '#d0a679', Other: '#8b949e',
};
export const FOSSIL = new Set(['Coal', 'Oil', 'Gas', 'Petcoke', 'Cogeneration']);
