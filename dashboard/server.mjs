// World Intel Dashboard - local server.
// Node 18+ only, zero npm dependencies. Start with: node server.mjs
//
// Why a server instead of a plain HTML file: several of these sources
// (FRED, Stooq, weather.gov) either block browser cross-origin requests or
// require a User-Agent header the browser will not let a page set. The server
// fetches them, caches them, and reports honestly when a source goes dark.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { STATES, FIPS } from './us-states.mjs';
import { WATCH, WMO, HEAT_GRID, CHANNELS } from './locations.mjs';
import { GLOBAL_GRID, GRID_STEP_DEG, CONFLICTS, CONFLICTS_REVIEWED, FOSSIL } from './world.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 8787 is already used by the MCP bridge on this machine, so the dashboard sits on 8791.
const PORT = Number(process.env.DASH_PORT || 8791);

// ---------------------------------------------------------------- env / keys

function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const ENV = {
  ...loadEnvFile(path.join(HERE, '..', '.env')),
  ...loadEnvFile(path.join(HERE, '.env')),
  ...process.env,
};
const FRED_KEY = (ENV.FRED_API_KEY || '').trim();

// ------------------------------------------------------------------- caching

const CACHE = new Map(); // key -> { at, data, error }

async function cached(key, ttlMs, fn) {
  const hit = CACHE.get(key);
  const now = Date.now();
  if (hit && !hit.error && now - hit.at < ttlMs) return hit;
  try {
    const data = await fn();
    const entry = { at: now, data, error: null };
    CACHE.set(key, entry);
    return entry;
  } catch (err) {
    // Serve stale data rather than nothing, but keep the error visible so the
    // tile can grey itself out instead of quietly showing yesterday as today.
    const entry = {
      at: hit ? hit.at : now,
      data: hit ? hit.data : null,
      error: String(err && err.message ? err.message : err),
    };
    CACHE.set(key, entry);
    return entry;
  }
}

const UA = 'JohnMCP-WorldIntelDashboard/1.0 (fpvjohnt@gmail.com)';

async function get(url, { as = 'json', timeout = 20000, headers = {}, method, body } = {}) {
  const res = await fetch(url, {
    method: method || 'GET',
    body,
    headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : '*/*', ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return as === 'json' ? res.json() : res.text();
}

// Small concurrency limiter so a 200-series FRED sweep stays under its rate cap.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch (err) {
        out[idx] = { error: String(err && err.message ? err.message : err) };
      }
    }
  });
  await Promise.all(workers);
  return out;
}

// --------------------------------------------------------------------- FRED

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

// FRED documents 120 requests a minute, but sustaining that across a 233-request
// sweep got this IP blocked outright - 403 with an empty body, which is an edge
// block rather than an API error. Half the documented rate keeps it happy; a
// full sweep then takes about four minutes, which is fine for something that
// runs twice a day and is cached to disk.
const FRED_PER_MIN = 60;
const fredHits = [];
async function fredGate() {
  for (;;) {
    const now = Date.now();
    while (fredHits.length && now - fredHits[0] > 60_000) fredHits.shift();
    if (fredHits.length < FRED_PER_MIN) { fredHits.push(now); return; }
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function fredSeries(id, { limit = 60, label = id, units = '' } = {}) {
  if (!FRED_KEY) return { id, label, units, ok: false, error: 'no FRED_API_KEY set' };
  const url =
    `${FRED_BASE}?series_id=${encodeURIComponent(id)}&api_key=${FRED_KEY}` +
    `&file_type=json&sort_order=desc&limit=${limit}`;
  let json;
  // A 403 is a temporary throttle, so back off and try again rather than
  // reporting the series as missing.
  for (let attempt = 0; ; attempt++) {
    await fredGate();
    try {
      json = await get(url);
      break;
    } catch (err) {
      const msg = String(err.message || err);
      if (msg.includes('400')) {
        return { id, label, units, ok: false, error: 'FRED rejected the key', badKey: true };
      }
      if (msg.includes('403') && attempt < 2) {
        await new Promise((r) => setTimeout(r, 20_000 * (attempt + 1)));
        continue;
      }
      return {
        id, label, units, ok: false,
        error: msg.includes('403') ? 'FRED throttled this request' : msg,
        throttled: msg.includes('403'),
      };
    }
  }
  const obs = (json.observations || [])
    .filter((o) => o.value !== '.' && o.value !== '')
    .map((o) => ({ d: o.date, v: Number(o.value) }));
  if (!obs.length) return { id, label, units, ok: false, error: 'no observations' };
  const latest = obs[0];
  const prev = obs[1] || null;
  const yearAgoIdx = obs.findIndex((o) => o.d <= shiftYear(latest.d, -1));
  const yearAgo = yearAgoIdx > 0 ? obs[yearAgoIdx] : null;
  return {
    id,
    label,
    units,
    ok: true,
    latest,
    prev,
    yearAgo,
    chg: prev ? round(latest.v - prev.v) : null,
    chgPct: prev && prev.v ? round(((latest.v - prev.v) / Math.abs(prev.v)) * 100, 2) : null,
    yoyPct: yearAgo && yearAgo.v ? round(((latest.v - yearAgo.v) / Math.abs(yearAgo.v)) * 100, 2) : null,
    history: obs.slice().reverse(), // oldest -> newest, for sparklines
  };
}

function shiftYear(dateStr, years) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}
function round(n, p = 2) {
  return n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** p) / 10 ** p;
}

// The national jobless picture, widest angle FRED gives without a paid feed.
const NATIONAL = [
  ['ICSA', 'Initial jobless claims (weekly, SA)', 'claims'],
  ['IC4WSA', 'Initial claims, 4-week average', 'claims'],
  ['ICNSA', 'Initial claims (not seasonally adj.)', 'claims'],
  ['CCSA', 'Continued claims (still on benefits)', 'claims'],
  ['UNRATE', 'Unemployment rate (U-3)', '%'],
  ['U6RATE', 'Underemployment rate (U-6)', '%'],
  ['UNEMPLOY', 'People unemployed', 'thousands'],
  ['UEMPMED', 'Median weeks unemployed', 'weeks'],
  ['UEMP27OV', 'Unemployed 27+ weeks', 'thousands'],
  ['CIVPART', 'Labor force participation', '%'],
  ['EMRATIO', 'Employment-population ratio', '%'],
  ['PAYEMS', 'Total nonfarm payrolls', 'thousands'],
  ['JTSJOL', 'Job openings (JOLTS)', 'thousands'],
  ['JTSHIR', 'Hires rate', '%'],
  ['JTSQUR', 'Quits rate', '%'],
  ['JTSLDR', 'Layoffs & discharges rate', '%'],
  ['SAHMREALTIME', 'Sahm recession indicator', 'pts'],
  ['AWHAETP', 'Average weekly hours', 'hours'],
];

const SECTORS = [
  ['MANEMP', 'Manufacturing'],
  ['USCONS', 'Construction'],
  ['USTPU', 'Trade, transport & utilities'],
  ['USTRADE', 'Retail trade'],
  ['USINFO', 'Information'],
  ['USFIRE', 'Financial activities'],
  ['USPBS', 'Professional & business svcs'],
  ['USEHS', 'Education & health'],
  ['USLAH', 'Leisure & hospitality'],
  ['USMINE', 'Mining & logging'],
  ['USGOVT', 'Government'],
];

// ---- state-level sources that are not FRED --------------------------------

// BLS public API v1 needs no key: 25 series per POST, 25 POSTs a day. 51 states
// x 2 series = 102 series = 5 posts, well inside that.
async function blsSeries(ids) {
  const j = await get('https://api.bls.gov/publicAPI/v1/timeseries/data/', {
    method: 'POST', body: JSON.stringify({ seriesid: ids, startyear: String(new Date().getUTCFullYear() - 1), endyear: String(new Date().getUTCFullYear()) }),
    headers: { 'Content-Type': 'application/json' }, timeout: 45000,
  });
  if (j.status !== 'REQUEST_SUCCEEDED') throw new Error((j.message || []).join(' ') || 'BLS refused');
  return j.Results?.series || [];
}

async function blsStates() {
  const wanted = [];
  for (const s of STATES) {
    const f = FIPS[s.code];
    if (!f) continue;
    wanted.push([`ur_${s.code}`, `LASST${f}0000000000003`, s.name + ' unemployment rate', '%']);
    wanted.push([`pay_${s.code}`, `SMS${f}000000000000001`, s.name + ' nonfarm payrolls', 'thousands']);
  }
  const chunks = [];
  for (let i = 0; i < wanted.length; i += 25) chunks.push(wanted.slice(i, i + 25));
  const out = {};
  const got = await mapLimit(chunks, 2, (c) => blsSeries(c.map((w) => w[1])));
  got.forEach((series, ci) => {
    if (!Array.isArray(series)) return;
    for (const sr of series) {
      const meta = chunks[ci].find((w) => w[1] === sr.seriesID);
      if (!meta) continue;
      // BLS returns newest first; keep a short history for the sparkline
      const obs = (sr.data || [])
        .filter((d) => d.value !== '-' && d.period?.startsWith('M'))
        .map((d) => ({ d: `${d.year}-${d.period.slice(1)}-01`, v: Number(d.value) }));
      if (!obs.length) continue;
      const latest = obs[0], prev = obs[1] || null;
      const yearAgo = obs.find((o) => o.d <= shiftYear(latest.d, -1)) || null;
      out[meta[0]] = {
        id: sr.seriesID, label: meta[2], units: meta[3], ok: true,
        latest, prev, yearAgo,
        chg: prev ? round(latest.v - prev.v) : null,
        yoyPct: yearAgo && yearAgo.v ? round(((latest.v - yearAgo.v) / Math.abs(yearAgo.v)) * 100, 2) : null,
        history: obs.slice().reverse(),
        source: 'BLS',
      };
    }
  });
  return out;
}

// The Labor Department's ETA 539 file carries every state's weekly claims.
// Column layout verified against FRED for week ending 2026-07-18: the initial
// claims column summed to 192,806 against FRED's 192,296, and the continued
// column to 1,841,316 against 1,796,000.
const DOL_IC = 4, DOL_CC = 9, DOL_WEEK = 3;
async function dolClaims() {
  const csv = await get('https://oui.doleta.gov/unemploy/csv/ar539.csv',
    { as: 'text', timeout: 90000, headers: { 'User-Agent': BROWSER_UA } });
  const rows = csv.trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
  const byState = {};
  for (const r of rows) {
    const code = r[0];
    if (!code) continue;
    (byState[code] ||= []).push({
      week: r[DOL_WEEK],
      ic: Number(r[DOL_IC]) || 0,
      cc: Number(r[DOL_CC]) || 0,
      t: new Date(r[DOL_WEEK]).getTime(),
    });
  }
  const out = {};
  for (const [code, list] of Object.entries(byState)) {
    list.sort((a, b) => a.t - b.t);
    const recent = list.slice(-52);
    const last = recent[recent.length - 1], prior = recent[recent.length - 2];
    if (!last) continue;
    const mk = (key, label) => ({
      ok: true, label, units: 'claims', source: 'US Dept of Labor',
      latest: { d: new Date(last.t).toISOString().slice(0, 10), v: last[key] },
      prev: prior ? { d: new Date(prior.t).toISOString().slice(0, 10), v: prior[key] } : null,
      chg: prior ? last[key] - prior[key] : null,
      history: recent.map((x) => ({ d: new Date(x.t).toISOString().slice(0, 10), v: x[key] })),
    });
    out[code] = { initial: mk('ic', 'initial claims'), continued: mk('cc', 'continued claims') };
  }
  return out;
}

// A full sweep takes a bit over two minutes because of the rate gate, so the
// result is kept on disk too - a server restart should not cost another two
// minutes of waiting.
const JOBLESS_FILE = () => path.join(CACHE_DIR, 'jobless.json');

async function joblessPayload(force = false) {
  if (!force) {
    try {
      const f = JOBLESS_FILE();
      if (Date.now() - fs.statSync(f).mtimeMs < 8 * 3600e3) {
        return JSON.parse(fs.readFileSync(f, 'utf8'));
      }
    } catch { /* no usable copy on disk, build it */ }
  }
  const payload = await buildJobless();

  // Never let a throttled sweep overwrite a good copy. If almost nothing came
  // back but a previous build is on disk, keep that and say it is stale.
  const thin = payload.coverage.nationalOk === 0 && payload.coverage.statesWithRate === 0;
  if (thin) {
    try {
      const old = JSON.parse(fs.readFileSync(JOBLESS_FILE(), 'utf8'));
      return { ...old, stale: true, staleReason: 'FRED throttled the refresh; showing the last good pull' };
    } catch { /* nothing better to fall back to */ }
    return payload;
  }
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(JOBLESS_FILE(), JSON.stringify(payload));
  } catch { /* cache is an optimisation, not a requirement */ }
  return payload;
}

async function buildJobless() {
  const national = await mapLimit(NATIONAL, 5, ([id, label, units]) =>
    fredSeries(id, { label, units, limit: 120 }),
  );
  const sectors = await mapLimit(SECTORS, 5, ([id, label]) =>
    fredSeries(id, { label, units: 'thousands', limit: 26 }),
  );
  // State data does NOT come from FRED. Doing so meant 204 separate requests,
  // which got this machine blocked at the edge (403, empty body) partway through.
  // BLS takes 25 series per POST and the Labor Department publishes every state's
  // weekly claims in a single CSV, so the same picture costs 6 requests.
  const [blsRates, claims] = await Promise.all([blsStates(), dolClaims()]);
  const stateJobs = STATES.map((s) => ({
    ...s,
    ur: blsRates[`ur_${s.code}`] || { ok: false, error: 'BLS did not return this state' },
    payrolls: blsRates[`pay_${s.code}`] || { ok: false, error: 'BLS did not return this state' },
    initialClaims: claims[s.code]?.initial || { ok: false, error: 'not in the DOL weekly file' },
    continuedClaims: claims[s.code]?.continued || { ok: false, error: 'not in the DOL weekly file' },
  }));
  const okStates = stateJobs.filter((s) => s.ur && s.ur.ok);
  return {
    national,
    sectors,
    states: stateJobs,
    // One clear reason at the top beats the same error repeated on 200 tiles.
    needsKey: !FRED_KEY,
    keyRejected: Boolean(FRED_KEY) && national.every((s) => s.badKey),
    envPath: path.join(HERE, '.env'),
    coverage: {
      statesRequested: STATES.length,
      statesWithRate: okStates.length,
      nationalOk: national.filter((s) => s.ok).length,
      nationalRequested: NATIONAL.length,
      sectorsOk: sectors.filter((s) => s.ok).length,
      sectorsRequested: SECTORS.length,
      statesWithClaims: stateJobs.filter((s) => s.initialClaims?.ok).length,
      sources: 'national + industries: FRED · state rates: BLS · state claims: US DoL',
    },
  };
}

// ------------------------------------------------------------------- markets

// Stooq now sits behind a JavaScript bot check and Google/GDELT rate-limit hard,
// so quotes come from Yahoo's chart endpoint and crypto from CoinGecko.
const TICKERS = [
  ['^GSPC', 'S&P 500'],
  ['^DJI', 'Dow Jones'],
  ['^IXIC', 'Nasdaq'],
  ['^RUT', 'Russell 2000'],
  ['^VIX', 'VIX (fear index)'],
  ['GC=F', 'Gold'],
  ['CL=F', 'Crude oil (WTI)'],
  ['DX-Y.NYB', 'US dollar index'],
];

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

// Two calls per ticker, on purpose. meta.chartPreviousClose means "the close
// before the requested range starts", so on a 1-month range it is the price a
// month ago - that is what made crude oil read +17% on the day. Only the 1-day
// intraday call returns a true prior-session close. The monthly call is kept
// purely for the sparkline. Daily bars cannot stand in: Yahoo leaves the most
// recent completed session null often enough to skew the comparison.
async function yahooQuote(symbol, label) {
  try {
    const enc = encodeURIComponent(symbol);
    const [day, month] = await Promise.all([
      get(`https://query1.finance.yahoo.com/v8/finance/chart/${enc}?range=1d&interval=5m`,
        { headers: { 'User-Agent': BROWSER_UA } }),
      get(`https://query1.finance.yahoo.com/v8/finance/chart/${enc}?range=1mo&interval=1d`,
        { headers: { 'User-Agent': BROWSER_UA } }).catch(() => null),
    ]);
    const r = day.chart?.result?.[0];
    const m = r?.meta;
    if (!m || m.regularMarketPrice == null) throw new Error('no price in response');
    const price = m.regularMarketPrice;
    const prev = m.previousClose ?? m.chartPreviousClose ?? null;
    const mr = month?.chart?.result?.[0];
    const closes = (mr?.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === 'number');
    const stamps = (mr?.timestamp || []).filter(
      (_, i) => typeof mr?.indicators?.quote?.[0]?.close?.[i] === 'number',
    );
    return {
      symbol,
      label,
      close: price,
      prevClose: prev,
      chg: prev != null ? round(price - prev, 2) : null,
      chgPct: prev ? round(((price - prev) / prev) * 100, 2) : null,
      date: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
      state: m.marketState || null,
      history: closes.map((v, i) => ({
        d: stamps[i] ? new Date(stamps[i] * 1000).toISOString().slice(0, 10) : String(i),
        v,
      })),
      ok: true,
    };
  } catch (err) {
    return { symbol, label, ok: false, error: String(err.message || err) };
  }
}

async function marketsPayload() {
  const rows = await mapLimit(TICKERS, 4, ([s, label]) => yahooQuote(s, label));

  // Crypto: CoinGecko's keyless simple-price endpoint.
  try {
    const cg = await get(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
    );
    for (const [id, label] of [['bitcoin', 'Bitcoin'], ['ethereum', 'Ethereum']]) {
      const c = cg[id];
      rows.push(
        c
          ? {
              symbol: id,
              label,
              close: c.usd,
              chgPct: round(c.usd_24h_change, 2),
              date: new Date().toISOString(),
              ok: true,
            }
          : { symbol: id, label, ok: false, error: 'not returned by CoinGecko' },
      );
    }
  } catch (err) {
    for (const label of ['Bitcoin', 'Ethereum']) {
      rows.push({ symbol: label, label, ok: false, error: String(err.message || err) });
    }
  }
  // Rates come from FRED because Stooq does not carry Treasury yields.
  const rates = FRED_KEY
    ? await mapLimit(
        [
          ['DGS10', '10-year Treasury', '%'],
          ['DGS2', '2-year Treasury', '%'],
          ['T10Y2Y', '10y minus 2y spread', '%'],
          ['DFF', 'Fed funds rate', '%'],
          ['MORTGAGE30US', '30-year mortgage', '%'],
          ['CPIAUCSL', 'CPI index (inflation)', 'index'],
        ],
        3,
        ([id, label, units]) => fredSeries(id, { label, units, limit: 60 }),
      )
    : [];
  return { quotes: rows, rates };
}

// ------------------------------------------------------- weather / climate

// Open-Meteo takes many coordinates in one request and covers Europe as well as
// the US, so the whole watch list is a single call. weather.gov is still used
// for the alert polygons on the map, but it stops at the US border.
async function watchPayload() {
  const lats = WATCH.map((w) => w.lat).join(',');
  const lons = WATCH.map((w) => w.lon).join(',');
  const j = await get(
    'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lats}&longitude=${lons}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
      '&hourly=temperature_2m' +
      '&timezone=auto&forecast_days=5&temperature_unit=fahrenheit&wind_speed_unit=mph',
  );
  const rows = Array.isArray(j) ? j : [j];
  if (rows.length !== WATCH.length) throw new Error(`asked for ${WATCH.length} places, got ${rows.length}`);
  return WATCH.map((w, i) => {
    const r = rows[i];
    const c = r.current || {};
    return {
      ...w,
      timezone: r.timezone,
      current: {
        time: c.time,
        tempF: c.temperature_2m,
        feelsF: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        windMph: c.wind_speed_10m,
        code: c.weather_code,
        text: WMO[c.weather_code] || 'Unknown',
        isDay: c.is_day === 1,
      },
      daily: (r.daily?.time || []).map((d, k) => ({
        date: d,
        maxF: r.daily.temperature_2m_max[k],
        minF: r.daily.temperature_2m_min[k],
        rainPct: r.daily.precipitation_probability_max?.[k] ?? null,
        code: r.daily.weather_code[k],
        text: WMO[r.daily.weather_code[k]] || '',
      })),
      hourly: (r.hourly?.time || []).slice(0, 24).map((t, k) => ({
        t, v: r.hourly.temperature_2m[k],
      })),
    };
  });
}

// Temperature grid behind the heat map. Chunked because a request carries only
// so many coordinates before the URL gets unwieldy.
async function heatPayload() {
  const CHUNK = 100;
  const chunks = [];
  for (let i = 0; i < HEAT_GRID.length; i += CHUNK) chunks.push(HEAT_GRID.slice(i, i + CHUNK));
  const results = await mapLimit(chunks, 2, async (pts) => {
    const j = await get(
      'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${pts.map((p) => p[0]).join(',')}&longitude=${pts.map((p) => p[1]).join(',')}` +
        '&current=temperature_2m,apparent_temperature&temperature_unit=fahrenheit',
    );
    const rows = Array.isArray(j) ? j : [j];
    return rows.map((r, i) => ({
      lat: pts[i][0], lon: pts[i][1],
      tempF: r.current?.temperature_2m ?? null,
      feelsF: r.current?.apparent_temperature ?? null,
    }));
  });
  const points = results.filter(Array.isArray).flat().filter((p) => p.tempF != null);
  if (!points.length) throw new Error('temperature grid came back empty');
  const temps = points.map((p) => p.tempF);
  const feels = points.map((p) => p.feelsF).filter((v) => v != null);
  return {
    points,
    min: Math.min(...temps),
    max: Math.max(...temps),
    feelsMin: feels.length ? Math.min(...feels) : null,
    feelsMax: feels.length ? Math.max(...feels) : null,
    requested: HEAT_GRID.length,
    returned: points.length,
  };
}

// ---------------------------------------------------------- world-scale data

// One grid, two fields. Temperature comes from the forecast model, CO2 ppm from
// the CAMS atmospheric model behind Open-Meteo's air-quality endpoint. Both take
// comma-separated coordinate lists, so 2,088 points cost ~21 requests.
async function globalHeatPayload(metric = 'temp') {
  const CHUNK = 100;
  const chunks = [];
  for (let i = 0; i < GLOBAL_GRID.length; i += CHUNK) chunks.push(GLOBAL_GRID.slice(i, i + CHUNK));

  const results = await mapLimit(chunks, 3, async (pts) => {
    const lat = pts.map((p) => p[0]).join(',');
    const lon = pts.map((p) => p[1]).join(',');
    const field = metric === 'feels' ? 'apparent_temperature' : 'temperature_2m';
    const url = metric === 'co2'
      ? `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=carbon_dioxide`
      : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${field}&temperature_unit=fahrenheit`;
    const j = await get(url, { timeout: 40000 });
    const rows = Array.isArray(j) ? j : [j];
    return rows.map((r, i) => ({
      lat: pts[i][0],
      lon: pts[i][1],
      v: metric === 'co2' ? (r.current?.carbon_dioxide ?? null) : (r.current?.[field] ?? null),
    }));
  });

  const points = results.filter(Array.isArray).flat().filter((p) => p.v != null);
  if (!points.length) throw new Error('global grid came back empty');
  const vals = points.map((p) => p.v).sort((a, b) => a - b);
  const pct = (q) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))];
  return {
    metric,
    unit: metric === 'co2' ? 'ppm' : '°F',
    points,
    min: vals[0],
    max: vals[vals.length - 1],
    // 5th/95th percentiles drive the colour ramp so a single extreme cell cannot
    // wash the whole planet into one colour.
    lo: pct(0.05),
    hi: pct(0.95),
    stepDeg: GRID_STEP_DEG,
    requested: GLOBAL_GRID.length,
    returned: points.length,
  };
}

// NOAA Global Monitoring Lab publishes these as plain text with '#' comments.
function parseNoaaTable(txt) {
  return txt.split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => l.trim().split(/\s+/).map(Number));
}

async function carbonPayload() {
  const out = {};
  try {
    const txt = await get('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_trend_gl.txt', { as: 'text' });
    // year month day cycle trend
    const rows = parseNoaaTable(txt).filter((r) => r.length >= 5 && Number.isFinite(r[4]));
    const last = rows[rows.length - 1];
    const yearAgo = rows[Math.max(0, rows.length - 366)];
    out.co2 = {
      date: `${last[0]}-${String(last[1]).padStart(2, '0')}-${String(last[2]).padStart(2, '0')}`,
      ppm: last[3],
      trendPpm: last[4],
      yearAgoPpm: yearAgo ? yearAgo[4] : null,
      growthPpm: yearAgo ? round(last[4] - yearAgo[4], 2) : null,
      history: rows.slice(-730).filter((_, i) => i % 7 === 0)
        .map((r) => ({ d: `${r[0]}-${r[1]}-${r[2]}`, v: r[4] })),
      source: 'NOAA GML global average',
    };
  } catch (err) { out.co2 = { error: String(err.message || err) }; }

  try {
    const txt = await get('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt', { as: 'text' });
    // year month decimal average deinterpolated trend ndays
    const rows = parseNoaaTable(txt).filter((r) => r.length >= 5 && r[3] > 0);
    const last = rows[rows.length - 1];
    out.mauna = {
      month: `${last[0]}-${String(last[1]).padStart(2, '0')}`,
      ppm: last[3],
      preindustrial: 280,
      risePct: round(((last[3] - 280) / 280) * 100, 1),
    };
  } catch (err) { out.mauna = { error: String(err.message || err) }; }

  try {
    const txt = await get('https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_mm_gl.txt', { as: 'text' });
    const rows = parseNoaaTable(txt).filter((r) => r.length >= 4 && r[3] > 0);
    const last = rows[rows.length - 1];
    const prior = rows[Math.max(0, rows.length - 13)];
    out.methane = {
      month: `${last[0]}-${String(last[1]).padStart(2, '0')}`,
      ppb: last[3],
      growthPpb: prior ? round(last[3] - prior[3], 1) : null,
    };
  } catch (err) { out.methane = { error: String(err.message || err) }; }

  if (out.co2?.error && out.mauna?.error && out.methane?.error) throw new Error('NOAA GML unreachable');
  return out;
}

// Climate Reanalyzer publishes daily world series as {name: year, data: [365]}.
async function reanalyzerSeries(url) {
  const arr = await get(url, { timeout: 40000, headers: { 'User-Agent': BROWSER_UA } });
  const years = arr.filter((s) => /^\d{4}$/.test(s.name));
  const latest = years[years.length - 1];
  const data = latest?.data || [];
  let idx = -1;
  for (let i = data.length - 1; i >= 0; i--) if (typeof data[i] === 'number') { idx = i; break; }
  if (idx < 0) throw new Error('no current value in series');
  const baseline = years.filter((s) => Number(s.name) >= 1991 && Number(s.name) <= 2020)
    .map((s) => s.data[idx]).filter((v) => typeof v === 'number');
  const mean = baseline.length ? baseline.reduce((a, b) => a + b, 0) / baseline.length : null;
  // A daily series whose newest year is not the current one is an archived copy;
  // say so rather than passing old numbers off as today's.
  const currentYear = new Date().getUTCFullYear();
  return {
    year: latest.name,
    dayIndex: idx,
    value: round(data[idx], 2),
    baseline: mean == null ? null : round(mean, 2),
    anomalyC: mean == null ? null : round(data[idx] - mean, 2),
    baselineYears: baseline.length,
    stale: Number(latest.name) < currentYear,
  };
}

async function climateGlobalPayload() {
  const out = {};
  const jobs = [
    ['airTemp', 'https://climatereanalyzer.org/clim/t2_daily/json/era5_world_t2_day.json'],
    // json/ still serves an archived copy that stops in 2024; json_2clim/ is the
    // one that is still being updated. Using the stale file would have shown a
    // two-year-old ocean temperature as today's.
    ['seaSurface', 'https://climatereanalyzer.org/clim/sst_daily/json_2clim/oisst2.1_world2_sst_day.json'],
  ];
  await Promise.all(jobs.map(async ([key, url]) => {
    try { out[key] = await reanalyzerSeries(url); }
    catch (err) { out[key] = { error: String(err.message || err) }; }
  }));
  try { out.noaa = await noaaGlobalAnomaly(); } catch (err) { out.noaa = { error: String(err.message || err) }; }
  try { out.enso = await ensoState(); } catch (err) { out.enso = { error: String(err.message || err) }; }
  // Sea-ice extent is deliberately absent: NSIDC's public CSV paths 404 and
  // Climate Reanalyzer serves HTML there, so there is nothing honest to show.
  out.missing = ['sea ice extent (no working public feed)'];
  return out;
}

// Live conflict picture: a hand-reviewed list of theatres, each with a fresh
// count of how much coverage it is drawing in the last two days.
async function conflictsPayload() {
  const rows = await mapLimit(CONFLICTS, 3, async (c) => {
    try {
      const xml = await get(
        `https://news.google.com/rss/search?q=${encodeURIComponent(c.query)}+when:2d&hl=en-US&gl=US&ceid=US:en`,
        { as: 'text', timeout: 30000, headers: { 'User-Agent': BROWSER_UA } },
      );
      const items = xml.split(/<item[\s>]/i).slice(1);
      const headlines = items.slice(0, 4).map((raw) => {
        const block = '<item ' + raw;
        const pub = tag(block, 'pubDate');
        return {
          title: tag(block, 'title'),
          url: tag(block, 'link'),
          published: pub ? new Date(pub).toISOString() : null,
        };
      }).filter((h) => h.title);
      return { ...c, ok: true, coverage: items.length, headlines };
    } catch (err) {
      return { ...c, ok: false, coverage: 0, headlines: [], error: String(err.message || err) };
    }
  });
  const ok = rows.filter((r) => r.ok);
  return {
    theatres: rows,
    reviewed: CONFLICTS_REVIEWED,
    checked: ok.length,
    total: rows.length,
    maxCoverage: ok.reduce((m, r) => Math.max(m, r.coverage), 0),
  };
}

// WRI's Global Power Plant Database: ~35,000 plants, downloaded once and kept
// on disk because it is 12 MB and only changes with a new release.
const CACHE_DIR = path.join(HERE, 'cache');
const PLANTS_FILE = path.join(CACHE_DIR, 'global_power_plant_database.csv');

function splitCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function energyPayload(minMw = 300) {
  if (!fs.existsSync(PLANTS_FILE)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const csv = await get(
      'https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv',
      { as: 'text', timeout: 120000 },
    );
    fs.writeFileSync(PLANTS_FILE, csv);
  }
  const text = fs.readFileSync(PLANTS_FILE, 'utf8');
  const lines = text.split(/\r?\n/);
  const head = splitCsvLine(lines[0]);
  const col = (n) => head.indexOf(n);
  const iCountry = col('country_long'), iName = col('name'), iMw = col('capacity_mw');
  const iLat = col('latitude'), iLon = col('longitude'), iFuel = col('primary_fuel');

  const all = [];
  const byFuel = {}, byCountry = {};
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = splitCsvLine(lines[i]);
    const mw = Number(c[iMw]), lat = Number(c[iLat]), lon = Number(c[iLon]);
    const fuel = c[iFuel] || 'Other';
    if (!Number.isFinite(mw) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    byFuel[fuel] = (byFuel[fuel] || 0) + mw;
    const country = c[iCountry] || '?';
    byCountry[country] = (byCountry[country] || 0) + mw;
    if (mw >= minMw) all.push({ n: c[iName], c: country, lat, lon, mw: Math.round(mw), f: fuel });
  }
  const totalMw = Object.values(byFuel).reduce((a, b) => a + b, 0);
  const fossilMw = Object.entries(byFuel)
    .filter(([f]) => FOSSIL.has(f)).reduce((a, [, mw]) => a + mw, 0);
  return {
    plants: all.sort((a, b) => b.mw - a.mw),
    minMw,
    shown: all.length,
    totalPlants: lines.length - 2,
    mix: Object.entries(byFuel).map(([fuel, mw]) => ({
      fuel, mw: Math.round(mw), pct: round((mw / totalMw) * 100, 1),
    })).sort((a, b) => b.mw - a.mw),
    fossilPct: round((fossilMw / totalMw) * 100, 1),
    topCountries: Object.entries(byCountry).map(([country, mw]) => ({ country, mw: Math.round(mw) }))
      .sort((a, b) => b.mw - a.mw).slice(0, 12),
    note: 'WRI Global Power Plant Database v1.3.0 - a snapshot, not a live feed',
  };
}

// ------------------------------------------------------------- road cameras
// Three public feeds, no keys. Each hands back a URL that really is a live
// image - checked: Caltrans JPEG, 511NY PNG, NYC DOT JPEG. Caltrans also
// publishes an HLS stream per camera.
const CAMS_FILE = () => path.join(CACHE_DIR, 'cameras.json');

async function camerasPayload(force = false) {
  if (!force) {
    try {
      const f = CAMS_FILE();
      if (Date.now() - fs.statSync(f).mtimeMs < 12 * 3600e3) return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch { /* build it */ }
  }

  const cams = [];
  const sources = {};

  // Caltrans, district by district
  const districts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const dRes = await mapLimit(districts, 4, async (d) => {
    const dd = String(d).padStart(2, '0');
    const j = await get(`https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${dd}.json`, { timeout: 45000 });
    return (j.data || []).map((row) => row.cctv).filter(Boolean).map((c) => ({
      n: c.location?.locationName || 'Caltrans camera',
      lat: Number(c.location?.latitude), lon: Number(c.location?.longitude),
      img: c.imageData?.static?.currentImageURL || null,
      stream: c.imageData?.streamingVideoURL || null,
      src: `Caltrans D${d}`,
      road: c.location?.route || '',
      up: c.inService === 'true' || c.inService === true,
    }));
  });
  let ct = 0;
  dRes.forEach((list) => { if (Array.isArray(list)) { cams.push(...list); ct += list.length; } });
  sources.caltrans = { ok: ct > 0, count: ct };

  try {
    const ny = await get('https://511ny.org/api/getcameras?key=demo&format=json',
      { timeout: 45000, headers: { 'User-Agent': BROWSER_UA } });
    const list = ny.filter((c) => c.Disabled === false && c.Blocked === false).map((c) => ({
      n: c.Name, lat: Number(c.Latitude), lon: Number(c.Longitude),
      img: c.Url, stream: c.VideoUrl || null, src: '511 New York', road: c.RoadwayName || '', up: true,
    }));
    cams.push(...list);
    sources.ny511 = { ok: true, count: list.length };
  } catch (err) { sources.ny511 = { ok: false, error: String(err.message || err) }; }

  try {
    const nyc = await get('https://webcams.nyctmc.org/api/cameras/',
      { timeout: 45000, headers: { 'User-Agent': BROWSER_UA } });
    const list = nyc.filter((c) => String(c.isOnline) === 'true').map((c) => ({
      n: c.name, lat: Number(c.latitude), lon: Number(c.longitude),
      img: c.imageUrl, stream: null, src: 'NYC DOT', road: c.area || '', up: true,
    }));
    cams.push(...list);
    sources.nycdot = { ok: true, count: list.length };
  } catch (err) { sources.nycdot = { ok: false, error: String(err.message || err) }; }

  const clean = cams.filter((c) => c.img && Number.isFinite(c.lat) && Number.isFinite(c.lon));
  if (!clean.length) throw new Error('no camera feed answered');
  const payload = {
    cameras: clean, total: clean.length, sources,
    note: 'Public transport-department feeds. US only - a worldwide set needs a Windy webcams key.',
  };
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CAMS_FILE(), JSON.stringify(payload));
  } catch { /* optional */ }
  return payload;
}

// Click-anywhere lookup for the map.
async function pointPayload(lat, lon) {
  const j = await get(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
      '&daily=temperature_2m_max,temperature_2m_min&forecast_days=2' +
      '&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph',
  );
  const c = j.current || {};
  // Air chemistry for the same spot, best-effort: a missing CO2 reading should
  // not cost the weather popup.
  let air = null;
  try {
    const a = await get(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
        '&current=carbon_dioxide,pm2_5,carbon_monoxide,nitrogen_dioxide',
      { timeout: 12000 },
    );
    air = {
      co2Ppm: a.current?.carbon_dioxide ?? null,
      pm25: a.current?.pm2_5 ?? null,
      co: a.current?.carbon_monoxide ?? null,
      no2: a.current?.nitrogen_dioxide ?? null,
    };
  } catch { /* air-quality model does not cover every point */ }
  return {
    lat: j.latitude, lon: j.longitude, timezone: j.timezone,
    tempF: c.temperature_2m, feelsF: c.apparent_temperature,
    humidity: c.relative_humidity_2m, windMph: c.wind_speed_10m,
    text: WMO[c.weather_code] || 'Unknown',
    todayMax: j.daily?.temperature_2m_max?.[0] ?? null,
    todayMin: j.daily?.temperature_2m_min?.[0] ?? null,
    air,
  };
}

async function weatherPayload(lat, lon) {
  const point = await get(`https://api.weather.gov/points/${lat},${lon}`);
  const props = point.properties || {};
  const [forecast, hourly, obsStations] = await Promise.all([
    get(props.forecast).catch((e) => ({ error: String(e.message || e) })),
    get(props.forecastHourly).catch((e) => ({ error: String(e.message || e) })),
    get(props.observationStations).catch(() => null),
  ]);
  let current = null;
  try {
    const stationId = obsStations?.features?.[0]?.properties?.stationIdentifier;
    if (stationId) {
      const latest = await get(`https://api.weather.gov/stations/${stationId}/observations/latest`);
      const p = latest.properties || {};
      current = {
        station: stationId,
        time: p.timestamp,
        text: p.textDescription,
        tempC: p.temperature?.value ?? null,
        humidity: p.relativeHumidity?.value ?? null,
        windKph: p.windSpeed?.value ?? null,
        pressurePa: p.barometricPressure?.value ?? null,
      };
    }
  } catch {
    /* observation stations are the flakiest part of weather.gov; forecast still stands */
  }
  return {
    place: `${props.relativeLocation?.properties?.city || '?'}, ${props.relativeLocation?.properties?.state || '?'}`,
    gridId: props.gridId,
    current,
    periods: (forecast.properties?.periods || []).slice(0, 8),
    hourly: (hourly.properties?.periods || []).slice(0, 24),
  };
}

async function climatePayload(lat, lon) {
  // Local anomaly: last 30 days vs the same calendar window averaged over 30 years.
  const end = new Date(Date.now() - 5 * 864e5); // ERA5 archive lags a few days
  const start = new Date(end.getTime() - 29 * 864e5);
  const iso = (d) => d.toISOString().slice(0, 10);
  const recent = await get(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${iso(start)}&end_date=${iso(end)}` +
      `&daily=temperature_2m_mean,precipitation_sum&timezone=UTC`,
  );
  const mmdd = (d) => d.slice(5);
  const normalYears = [];
  for (let y = end.getUTCFullYear() - 30; y < end.getUTCFullYear(); y++) normalYears.push(y);
  const normals = await mapLimit(normalYears, 4, async (y) => {
    const s = new Date(Date.UTC(y, start.getUTCMonth(), start.getUTCDate()));
    const e = new Date(s.getTime() + 29 * 864e5);
    const j = await get(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${iso(s)}&end_date=${iso(e)}&daily=temperature_2m_mean,precipitation_sum&timezone=UTC`,
    );
    return j.daily;
  });
  const mean = (arr) => {
    const v = arr.filter((x) => typeof x === 'number');
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const sum = (arr) => arr.filter((x) => typeof x === 'number').reduce((a, b) => a + b, 0);
  const recentTemp = mean(recent.daily?.temperature_2m_mean || []);
  const recentPrecip = sum(recent.daily?.precipitation_sum || []);
  const normalTemps = normals.filter((n) => n && n.temperature_2m_mean).map((n) => mean(n.temperature_2m_mean));
  const normalPrecips = normals.filter((n) => n && n.precipitation_sum).map((n) => sum(n.precipitation_sum));
  const baselineTemp = mean(normalTemps);
  const baselinePrecip = mean(normalPrecips);

  // Global context: NOAA land+ocean monthly anomaly, and ENSO state.
  let global = null;
  try { global = await noaaGlobalAnomaly(); }
  catch (err) { global = { error: String(err.message || err) }; }
  let enso = null;
  try { enso = await ensoState(); }
  catch (err) { enso = { error: String(err.message || err) }; }

  return {
    window: { start: iso(start), end: iso(end), baselineYears: normalYears.length },
    local: {
      recentMeanTempC: round(recentTemp, 2),
      baselineMeanTempC: round(baselineTemp, 2),
      tempAnomalyC: recentTemp != null && baselineTemp != null ? round(recentTemp - baselineTemp, 2) : null,
      recentPrecipMm: round(recentPrecip, 1),
      baselinePrecipMm: round(baselinePrecip, 1),
      precipAnomalyPct:
        baselinePrecip ? round(((recentPrecip - baselinePrecip) / baselinePrecip) * 100, 1) : null,
    },
    global,
    enso,
  };
}

async function noaaGlobalAnomaly() {
  const g = await get(
    'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/land_ocean/1/0/data.json',
  );
  const keys = Object.keys(g.data || {}).sort();
  const lastKey = keys[keys.length - 1];         // keys look like "202605"
  const row = g.data[lastKey];
  return {
    month: `${lastKey.slice(0, 4)}-${lastKey.slice(4)}`,
    anomalyC: Number(row?.departure ?? row),
    baseline: g.description?.base_period || '1901-2000',
    description: g.description?.title || 'NOAA global land+ocean anomaly',
  };
}

async function ensoState() {
  const txt = await get('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt', { as: 'text' });
  const rows = txt.trim().split(/\r?\n/).slice(1).map((r) => r.trim().split(/\s+/));
  const last = rows[rows.length - 1];
  const oni = Number(last[3]);
  return {
    season: last[0],
    year: last[1],
    oni,
    phase: oni >= 0.5 ? 'El Nino' : oni <= -0.5 ? 'La Nina' : 'Neutral',
  };
}

// ------------------------------------------------------------ world events

// GDELT rate-limits an unauthenticated caller almost immediately, so world news
// comes from wire-service RSS instead. Enough regex to read well-formed RSS.
const FEEDS = [
  ['BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
  ['NPR', 'https://feeds.npr.org/1004/rss.xml'],
  ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
  ['Sky News World', 'https://feeds.skynews.com/feeds/rss/world.xml'],
  ['Reuters via Google News', 'https://news.google.com/rss/search?q=when:24h+world&hl=en-US&gl=US&ceid=US:en'],
];

function unescapeXml(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .trim();
}
function tag(block, name) {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? unescapeXml(m[1]) : '';
}

async function newsPayload() {
  const results = await mapLimit(FEEDS, 3, async ([source, url]) => {
    const xml = await get(url, { as: 'text', headers: { 'User-Agent': BROWSER_UA } });
    const items = xml.split(/<item[\s>]/i).slice(1, 21);
    const list = items.map((raw) => {
      const block = '<item ' + raw;
      const pub = tag(block, 'pubDate');
      return {
        source,
        title: tag(block, 'title'),
        url: tag(block, 'link') || (/<link[^>]*href="([^"]+)"/i.exec(block) || [])[1] || '',
        published: pub ? new Date(pub).toISOString() : null,
        summary: tag(block, 'description').slice(0, 220),
      };
    }).filter((a) => a.title);
    if (!list.length) throw new Error(`${source} returned no items`);
    return list;
  });
  const ok = results.filter((r) => Array.isArray(r));
  if (!ok.length) throw new Error('every news feed failed');
  const merged = ok.flat().sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  return {
    articles: merged.slice(0, 60),
    feedsOk: ok.length,
    feedsTried: FEEDS.length,
    feedsFailed: results.filter((r) => !Array.isArray(r)).length,
  };
}

// Market news, split the way John reads it: US, Europe, Asia. Google News RSS
// takes a plain query and needs no key.
const MARKET_FEEDS = {
  // CNBC's RSS endpoints answer 200 with an empty body, so MarketWatch carries
  // the US wire instead.
  us: [
    ['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories'],
    ['Google News', 'https://news.google.com/rss/search?q=US+stock+market+OR+Wall+Street+when:1d&hl=en-US&gl=US&ceid=US:en'],
  ],
  europe: [
    ['Google News', 'https://news.google.com/rss/search?q=European+stock+markets+OR+FTSE+OR+DAX+when:1d&hl=en-US&gl=US&ceid=US:en'],
  ],
  asia: [
    ['Google News', 'https://news.google.com/rss/search?q=Asian+stock+markets+OR+Nikkei+OR+Hang+Seng+when:1d&hl=en-US&gl=US&ceid=US:en'],
  ],
};

async function readFeed(source, url) {
  const xml = await get(url, { as: 'text', headers: { 'User-Agent': BROWSER_UA } });
  const items = xml.split(/<item[\s>]/i).slice(1, 16);
  const out = items.map((raw) => {
    const block = '<item ' + raw;
    const pub = tag(block, 'pubDate');
    return {
      source,
      title: tag(block, 'title'),
      url: tag(block, 'link') || (/<link[^>]*href="([^"]+)"/i.exec(block) || [])[1] || '',
      published: pub ? new Date(pub).toISOString() : null,
    };
  }).filter((a) => a.title);
  // A 200 with an empty body is a failed feed, not a quiet news day - throw so
  // the "N of M feeds answered" line stays truthful.
  if (!out.length) throw new Error(`${source} returned no items`);
  return out;
}

async function marketNewsPayload() {
  const regions = Object.keys(MARKET_FEEDS);
  const out = {};
  await Promise.all(regions.map(async (region) => {
    const got = await mapLimit(MARKET_FEEDS[region], 2, ([src, url]) => readFeed(src, url));
    const ok = got.filter(Array.isArray);
    out[region] = {
      articles: ok.flat()
        .sort((a, b) => (b.published || '').localeCompare(a.published || ''))
        .slice(0, 12),
      feedsOk: ok.length,
      feedsTried: MARKET_FEEDS[region].length,
    };
  }));
  if (!regions.some((r) => out[r].articles.length)) throw new Error('no market feed answered');
  return out;
}

// Kalshi's public market data is keyless for reads. Prices come back as string
// dollars ("0.3300") on this API version, with the older integer-cent fields
// left empty - read the dollars field first, same as kalshi-mcp does.
const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const KALSHI_SERIES = [
  ['KXFED', 'Fed funds rate'],
  ['KXCPIYOY', 'Inflation (CPI year/year)'],
  ['KXPAYROLLS', 'Monthly jobs added'],
  ['KXIMFRECESS', 'Global recession'],
  ['KXINXU', 'S&P 500 today'],
  ['KXNASDAQ100U', 'Nasdaq-100 today'],
  ['KXBTCD', 'Bitcoin today'],
  ['KXAAAGASM', 'Gas prices'],
];

function kalshiPrice(m, base) {
  const dollars = m[`${base}_dollars`];
  if (typeof dollars === 'string' && dollars.trim() !== '') {
    const n = Number.parseFloat(dollars);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  const cents = m[base];
  return typeof cents === 'number' && Number.isFinite(cents) ? Math.round(cents) : null;
}

async function kalshiPayload() {
  const rows = await mapLimit(KALSHI_SERIES, 3, async ([series, label]) => {
    try {
      const j = await get(`${KALSHI_BASE}/markets?series_ticker=${series}&status=open&limit=200`);
      const markets = (j.markets || [])
        .map((m) => ({
          ticker: m.ticker,
          // Kalshi leaves markdown asterisks in some titles ("**gas prices**")
          title: String(m.title || '').replace(/\*\*/g, ''),
          subtitle: m.yes_sub_title || m.subtitle || '',
          closes: m.close_time,
          yes: kalshiPrice(m, 'yes_bid'),
          ask: kalshiPrice(m, 'yes_ask'),
          volume: m.volume ?? null,
        }))
        .filter((m) => m.yes != null && m.yes > 2 && m.yes < 98);
      if (!markets.length) return { series, label, ok: false, error: 'no live contract in play' };
      // The contract nearest a coin flip is the one carrying real information;
      // a ladder of strikes pinned at 0 or 100 says nothing.
      markets.sort((a, b) => Math.abs(a.yes - 50) - Math.abs(b.yes - 50));
      return { series, label, ok: true, market: markets[0], candidates: markets.length };
    } catch (err) {
      return { series, label, ok: false, error: String(err.message || err) };
    }
  });
  return { rows, asked: KALSHI_SERIES.length, live: rows.filter((r) => r.ok).length };
}

// Live news channels. Resolving the current video id means the card can say
// whether a channel is actually live instead of showing a dead embed.
async function liveTvPayload() {
  const rows = await mapLimit(CHANNELS, 3, async (ch) => {
    try {
      const html = await get(`https://www.youtube.com/${ch.handle}/live`, {
        as: 'text', headers: { 'User-Agent': BROWSER_UA },
      });
      const videoId = (/"videoId":"([\w-]{11})"/.exec(html) || [])[1] || null;
      const isLive = /"isLiveNow":true/.test(html);
      const title = ((/<title>([^<]{0,120})<\/title>/.exec(html) || [])[1] || '')
        .replace(/ - YouTube$/, '').trim();
      return { ...ch, videoId, isLive, title, ok: Boolean(videoId) };
    } catch (err) {
      return { ...ch, ok: false, isLive: false, videoId: null, error: String(err.message || err) };
    }
  });
  return { channels: rows, liveNow: rows.filter((r) => r.isLive).length };
}

// Geocoded world events: NASA EONET (wildfires, storms, volcanoes, floods) plus
// GDACS (the UN/EC global disaster alert feed, which carries a severity colour).
async function eventsPayload() {
  const out = { type: 'FeatureCollection', features: [], sources: {} };

  try {
    const j = await get('https://eonet.gsfc.nasa.gov/api/v3/events?days=14&status=open&limit=300');
    let n = 0;
    for (const e of j.events || []) {
      const geo = (e.geometry || [])[e.geometry.length - 1];
      if (!geo) continue;
      const coords = geo.type === 'Point' ? geo.coordinates : centroid(geo.coordinates);
      if (!coords) continue;
      out.features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          kind: 'eonet',
          title: e.title,
          category: (e.categories || [])[0]?.title || 'Natural event',
          date: geo.date,
          link: e.link,
        },
      });
      n++;
    }
    out.sources.eonet = { ok: true, count: n };
  } catch (err) {
    out.sources.eonet = { ok: false, error: String(err.message || err) };
  }

  try {
    const xml = await get('https://www.gdacs.org/xml/rss.xml', {
      as: 'text', timeout: 40000, headers: { 'User-Agent': BROWSER_UA },
    });
    const items = xml.split(/<item[\s>]/i).slice(1);
    let n = 0;
    for (const raw of items.slice(0, 200)) {
      const block = '<item ' + raw;
      const lat = Number(tag(block, 'geo:lat') || tag(block, 'geo:Point'));
      const lon = Number(tag(block, 'geo:long'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      out.features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          kind: 'gdacs',
          title: tag(block, 'title'),
          category: tag(block, 'gdacs:eventtype') || 'Disaster',
          level: tag(block, 'gdacs:alertlevel') || 'Green',
          country: tag(block, 'gdacs:country'),
          date: tag(block, 'pubDate'),
          link: tag(block, 'link'),
        },
      });
      n++;
    }
    out.sources.gdacs = { ok: true, count: n };
  } catch (err) {
    out.sources.gdacs = { ok: false, error: String(err.message || err) };
  }

  if (!out.features.length) throw new Error('no event source answered');
  return out;
}

function centroid(coords) {
  const flat = [];
  (function walk(c) {
    if (typeof c[0] === 'number') flat.push(c);
    else c.forEach(walk);
  })(coords);
  if (!flat.length) return null;
  return [
    flat.reduce((a, p) => a + p[0], 0) / flat.length,
    flat.reduce((a, p) => a + p[1], 0) / flat.length,
  ];
}

async function alertsPayload() {
  const json = await get('https://api.weather.gov/alerts/active?status=actual');
  const feats = (json.features || []).filter((f) => {
    const sev = f.properties?.severity;
    return sev === 'Extreme' || sev === 'Severe' || sev === 'Moderate';
  });
  return { type: 'FeatureCollection', features: feats.slice(0, 400), total: (json.features || []).length };
}

async function quakesPayload() {
  return get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
}

async function radarPayload() {
  const meta = await get('https://api.rainviewer.com/public/weather-maps.json');
  const past = meta.radar?.past || [];
  const nowcast = meta.radar?.nowcast || [];
  const latest = past[past.length - 1];
  return {
    host: meta.host || 'https://tilecache.rainviewer.com',
    latest: latest || null,
    frames: [...past.slice(-6), ...nowcast.slice(0, 2)],
  };
}

async function geocode(name) {
  const j = await get(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`,
  );
  return (j.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

// -------------------------------------------------------------------- routes
// ttl is how long a cached copy is reused; the page's own 8-hour cycle sits on
// top of this. "Refresh now" in the UI sends ?fresh=1 and bypasses the cache.

const ROUTES = {
  '/api/news': { ttl: 60 * 60e3, fn: () => newsPayload() },
  '/api/events': { ttl: 60 * 60e3, fn: () => eventsPayload() },
  '/api/alerts': { ttl: 10 * 60e3, fn: () => alertsPayload() },
  '/api/quakes': { ttl: 15 * 60e3, fn: () => quakesPayload() },
  '/api/radar': { ttl: 5 * 60e3, fn: () => radarPayload() },
  '/api/watch': { ttl: 30 * 60e3, fn: () => watchPayload() },
  '/api/heat': { ttl: 30 * 60e3, fn: () => heatPayload() },
  '/api/globalheat': { ttl: 3 * 3600e3, fn: (q) => globalHeatPayload(q.get('metric') || 'temp') },
  '/api/carbon': { ttl: 6 * 3600e3, fn: () => carbonPayload() },
  '/api/climateglobal': { ttl: 6 * 3600e3, fn: () => climateGlobalPayload() },
  '/api/conflicts': { ttl: 2 * 3600e3, fn: () => conflictsPayload() },
  '/api/energy': { ttl: 24 * 3600e3, fn: (q) => energyPayload(Number(q.get('minMw') || 300)) },
  '/api/cameras': { ttl: 12 * 3600e3, fn: (q) => camerasPayload(q.get('fresh') === '1') },
  '/api/point': { ttl: 15 * 60e3, fn: (q) => pointPayload(q.get('lat'), q.get('lon')) },
  '/api/weather': { ttl: 60 * 60e3, fn: (q) => weatherPayload(q.get('lat') || 32.78, q.get('lon') || -96.8) },
  '/api/climate': { ttl: 12 * 3600e3, fn: (q) => climatePayload(q.get('lat') || 32.78, q.get('lon') || -96.8) },
  '/api/markets': { ttl: 60 * 60e3, fn: () => marketsPayload() },
  '/api/marketnews': { ttl: 60 * 60e3, fn: () => marketNewsPayload() },
  '/api/kalshi': { ttl: 30 * 60e3, fn: () => kalshiPayload() },
  '/api/livetv': { ttl: 15 * 60e3, fn: () => liveTvPayload() },
  '/api/jobless': { ttl: 8 * 3600e3, fn: (q) => joblessPayload(q.get('fresh') === '1') },
  '/api/geocode': { ttl: 24 * 3600e3, fn: (q) => geocode(q.get('name') || '') },
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mjs': 'text/javascript' };

// ---- imagery proxy ---------------------------------------------------------
// Esri answers HTTP 200 with a 2,521-byte JPEG reading "Zoom level not
// supported" whenever you pass the deepest level it holds for that tile. The
// browser cannot tell that from real imagery, and neither ?blankTile=false nor a
// maxNativeZoom cap removed it for good, because the depth varies tile by tile
// and old copies linger in the browser cache. So every imagery tile now comes
// through here: if the bytes are that exact image, a transparent pixel goes back
// instead and the map layer underneath shows through. The card cannot render.
const ESRI_ERROR_MD5 = 'f27d9de7f80c13501f470595e327aa6d';
const ESRI_ERROR_BYTES = 2521;
const CLEAR_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const TILE_SERVICES = {
  imagery: 'World_Imagery',
  topo: 'World_Topo_Map',
  terrain: 'World_Terrain_Base',
  natgeo: 'NatGeo_World_Map',
  ocean: 'Ocean/World_Ocean_Base',
  labels: 'Reference/World_Boundaries_and_Places',
  transport: 'Reference/World_Transportation',
};
const tileStats = { served: 0, blanked: 0, missing: 0, failed: 0 };

async function serveTile(res, service, z, y, x) {
  const svc = TILE_SERVICES[service];
  const blank = () => {
    tileStats.blanked++;
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    res.end(CLEAR_PNG);
  };
  if (!svc) return blank();
  try {
    const r = await fetch(
      `https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/${z}/${y}/${x}?blankTile=false`,
      { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(20000) },
    );
    if (!r.ok) { tileStats.missing++; return blank(); }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length === ESRI_ERROR_BYTES &&
        crypto.createHash('md5').update(buf).digest('hex') === ESRI_ERROR_MD5) {
      return blank();
    }
    tileStats.served++;
    res.writeHead(200, {
      'Content-Type': r.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(buf);
  } catch {
    tileStats.failed++;
    blank();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (code, body, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };

  // /api/tile/<service>/<z>/<y>/<x>
  const tile = /^\/api\/tile\/([a-z]+)\/(\d+)\/(\d+)\/(\d+)$/.exec(url.pathname);
  if (tile) return serveTile(res, tile[1], tile[2], tile[3], tile[4]);

  if (url.pathname === '/api/health') {
    return send(200, {
      ok: true,
      fredKey: FRED_KEY ? 'present' : 'MISSING',
      serverTime: new Date().toISOString(),
      tiles: tileStats,
      cachedKeys: [...CACHE.keys()],
    });
  }

  const route = ROUTES[url.pathname];
  if (route) {
    const key = url.pathname + '?' + [...url.searchParams.entries()].filter(([k]) => k !== 'fresh').join('&');
    if (url.searchParams.get('fresh') === '1') CACHE.delete(key);
    const entry = await cached(key, route.ttl, () => route.fn(url.searchParams));
    return send(entry.error && !entry.data ? 502 : 200, {
      ok: !entry.error,
      error: entry.error,
      fetchedAt: new Date(entry.at).toISOString(),
      ageSec: Math.round((Date.now() - entry.at) / 1000),
      ttlSec: Math.round(route.ttl / 1000),
      stale: Date.now() - entry.at > route.ttl,
      data: entry.data,
    });
  }

  // static files
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const file = path.join(HERE, rel);
  if (!file.startsWith(HERE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(404, 'Not found', 'text/plain');
  }
  return send(200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  World Intel Dashboard  ->  http://localhost:${PORT}`);
  console.log(`  FRED API key: ${FRED_KEY ? 'loaded' : 'MISSING - jobless panels will stay grey'}`);
  console.log('  Ctrl+C to stop.\n');
});
