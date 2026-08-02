// The places the weather panel watches. Edit this list and restart the server.
// Region entries (Florida, Spain, France) use a representative city, named in
// `note` so the card never pretends to speak for a whole state or country.
export const WATCH = [
  { name: 'Murrieta',    region: 'CA',       lat: 33.5539, lon: -117.2139, note: '' },
  { name: 'Los Angeles', region: 'CA',       lat: 34.0522, lon: -118.2437, note: '' },
  { name: 'San Diego',   region: 'CA',       lat: 32.7157, lon: -117.1611, note: '' },
  { name: 'New York',    region: 'NY',       lat: 40.7128, lon: -74.0060,  note: '' },
  { name: 'Florida',     region: 'Miami',    lat: 25.7617, lon: -80.1918,  note: 'shown for Miami' },
  { name: 'Spain',       region: 'Madrid',   lat: 40.4168, lon: -3.7038,   note: 'shown for Madrid' },
  { name: 'France',      region: 'Paris',    lat: 48.8566, lon: 2.3522,    note: 'shown for Paris' },
];

// WMO weather codes -> plain words.
export const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
};

// Live news channels. The handle is what gets checked; the id is the fallback
// used by YouTube's channel-level live embed if the check cannot find a video.
export const CHANNELS = [
  { key: 'abc',  name: 'ABC News Live', handle: '@ABCNews',           id: 'UCBi2mrWuNuyYy4gbM6fU18Q' },
  { key: 'cnn',  name: 'CNN',           handle: '@CNN',               id: 'UCupvZG-5ko_eiXAupbDfxWw' },
  { key: 'ajz',  name: 'Al Jazeera',    handle: '@aljazeeraenglish',  id: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
];

// Grid used for the temperature heat map: continental US plus western Europe.
export const HEAT_GRID = (() => {
  const pts = [];
  for (let la = 25; la <= 49; la += 2) for (let lo = -124; lo <= -67; lo += 4) pts.push([la, lo]);
  for (let la = 36; la <= 55; la += 2) for (let lo = -9; lo <= 20; lo += 4) pts.push([la, lo]);
  return pts;
})();
