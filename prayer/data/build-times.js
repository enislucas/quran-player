/*
 * Builds prayer/times.json for the prayer app.
 *
 *   node prayer/data/build-times.js
 *
 * Sources, in order of precedence:
 *   1. mangalia-diyanet-<year>.json  — a whole year published by Diyanet,
 *      downloaded by fetch-year.js. This is the ground truth.
 *   2. mangalia-prayer-times-365.md  — the Diyanet PDF sheets, typed up by
 *      hand. Covers whatever the yearly feed happens to be missing.
 *   3. a calibrated solar model      — only for days neither source has.
 *
 * Why this script exists
 * ----------------------
 * The markdown source only covers part of the year, and it stores LOCAL clock
 * times, which silently break at daylight-saving boundaries (the switch lands
 * on a different calendar date each year). This script fixes both problems:
 *
 *  1. Every official time is converted to UTC using the DST offset that was
 *     actually in force on its source date, so the app can re-apply the
 *     CURRENT year's Romanian DST rules and stay correct forever.
 *  2. Days missing from the markdown are computed astronomically with a solar
 *     model calibrated against the official days (residual sd < 1 minute), so
 *     the app never has a blank day. Each day is tagged with its origin.
 *
 * When new official sheets arrive: update the markdown table, re-run this
 * script, bump CACHE_VERSION in prayer/sw.js, commit and push.
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const MD = path.join(HERE, 'mangalia-prayer-times-365.md');
const OUT = path.join(HERE, '..', 'times.json');

// Mangalia, Romania
const LAT = 43.8167, LON = 28.5833;
const REFERENCE_YEAR = 2026;   // year used when computing missing days
const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;

// ---------------------------------------------------------------- astronomy
function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function solar(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C = Math.sin(rad(M)) * (1.914602 - 0.004817 * T - 0.000014 * T * T)
          + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T)
          + Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eot = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M))
            + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0))
            - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  return { decl, eot };
}
function noonUT(y, m, d) {
  const jd0 = julian(y, m, d);
  let t = 0.5;
  for (let k = 0; k < 3; k++) { const { eot } = solar(jd0 + t); t = (720 - 4 * LON - eot) / 1440; }
  return t * 1440;
}
function altEventUT(y, m, d, alt, dir) {   // dir: -1 before noon, +1 after
  const jd0 = julian(y, m, d);
  let t = 0.5;
  for (let k = 0; k < 4; k++) {
    const { decl, eot } = solar(jd0 + t);
    const noon = (720 - 4 * LON - eot) / 1440;
    const cosH = (Math.sin(rad(alt)) - Math.sin(rad(LAT)) * Math.sin(rad(decl)))
               / (Math.cos(rad(LAT)) * Math.cos(rad(decl)));
    if (cosH > 1 || cosH < -1) return null;   // sun never reaches that altitude
    t = noon + dir * (4 * deg(Math.acos(cosH))) / 1440;
  }
  return t * 1440;
}
function asrUT(y, m, d, shadow) {
  const jd0 = julian(y, m, d);
  let t = 0.6;
  for (let i = 0; i < 4; i++) {
    const { decl, eot } = solar(jd0 + t);
    const alt = deg(Math.atan(1 / (shadow + Math.tan(Math.abs(rad(LAT - decl))))));
    const noon = (720 - 4 * LON - eot) / 1440;
    const cosH = (Math.sin(rad(alt)) - Math.sin(rad(LAT)) * Math.sin(rad(decl)))
               / (Math.cos(rad(LAT)) * Math.cos(rad(decl)));
    if (cosH > 1 || cosH < -1) return null;
    t = noon + (4 * deg(Math.acos(cosH))) / 1440;
  }
  return t * 1440;
}
// raw model, before the per-prayer calibration offsets are applied
function rawModel(y, m, d, p) {
  return {
    fajr: altEventUT(y, m, d, -p.fajrAngle, -1),
    sunrise: altEventUT(y, m, d, -0.8333, -1),
    dhuhr: noonUT(y, m, d),
    asr: asrUT(y, m, d, 1),                       // standard Asr, not Hanafi
    maghrib: altEventUT(y, m, d, -0.8333, +1),
    isha: altEventUT(y, m, d, -p.ishaAngle, +1),
  };
}

// ------------------------------------------------------------- DST handling
// EU rule: last Sunday of March 01:00 UTC .. last Sunday of October 01:00 UTC
function lastSunday(year, month) {
  const d = new Date(Date.UTC(year, month, 0));           // last day of month
  return d.getUTCDate() - d.getUTCDay();
}
function offsetHours(year, month, day) {
  const ms = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 2, lastSunday(year, 3));
  const end = Date.UTC(year, 9, lastSunday(year, 10));
  return (ms >= start && ms < end) ? 3 : 2;
}

// ------------------------------------------------------------------- parse
const rows = [];
for (const line of fs.readFileSync(MD, 'utf8').split(/\r?\n/)) {
  const m = /^\|\s*(\d{2})\.(\d{2})\s*\|(.+)\|\s*$/.exec(line);
  if (!m) continue;
  const cells = m[3].split('|').map((s) => s.trim());
  if (cells.length < 7) continue;
  rows.push({ day: +m[1], month: +m[2], vals: cells.slice(0, 6), src: cells[6] });
}
if (rows.length !== 365) throw new Error(`expected 365 rows, parsed ${rows.length}`);

const official = new Map();
for (const r of rows) {
  const key = String(r.month).padStart(2, '0') + '-' + String(r.day).padStart(2, '0');
  if (r.vals.some((v) => v === 'N/A')) continue;
  if (!/^\d{4}$/.test(r.src)) throw new Error(`row ${key} has times but no source year`);
  const year = +r.src;
  const off = offsetHours(year, r.month, r.day) * 60;
  const ut = {};
  r.vals.forEach((v, i) => {
    const t = /^(\d{2}):(\d{2})$/.exec(v);
    if (!t) throw new Error(`bad time "${v}" on ${key}`);
    ut[KEYS[i]] = +t[1] * 60 + +t[2] - off;        // -> minutes UTC
  });
  for (let i = 1; i < KEYS.length; i++) {
    if (ut[KEYS[i]] <= ut[KEYS[i - 1]]) throw new Error(`non-monotonic times on ${key}`);
  }
  official.set(key, { ut, year, month: r.month, day: r.day });
}

// ------------------------------------------- official whole years (ground truth)
// Anything Diyanet has published for a full year outranks the typed-up sheets.
const FEED_FIELDS = ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'];
let fromFeed = 0, feedYears = [];
for (const file of fs.readdirSync(HERE).filter((n) => /^mangalia-diyanet-\d{4}\.json$/.test(n)).sort()) {
  const feed = JSON.parse(fs.readFileSync(path.join(HERE, file), 'utf8'));
  feedYears.push(feed.year);
  for (const [key, times] of Object.entries(feed.days)) {
    const mo = +key.slice(0, 2), dy = +key.slice(3);
    const off = offsetHours(feed.year, mo, dy) * 60;
    const ut = {};
    KEYS.forEach((k, i) => {
      const t = times[FEED_FIELDS[i]];
      if (!/^\d{2}:\d{2}$/.test(t || '')) throw new Error(`bad time "${t}" on ${key} in ${file}`);
      ut[k] = +t.slice(0, 2) * 60 + +t.slice(3) - off;      // -> minutes UTC
    });
    for (let i = 1; i < KEYS.length; i++) {
      if (ut[KEYS[i]] <= ut[KEYS[i - 1]]) throw new Error(`non-monotonic times on ${key} in ${file}`);
    }
    official.set(key, { ut, year: feed.year, month: mo, day: dy });
    fromFeed++;
  }
}

// --------------------------------------------------------------- calibrate
// Fit a depression angle + constant offset per prayer against the official
// days; the offsets absorb Diyanet's "temkin" safety margins.
function residuals(prayer, params) {
  const out = [];
  for (const [, v] of official) {
    const model = rawModel(v.year, v.month, v.day, params);
    if (model[prayer] == null) continue;
    out.push(v.ut[prayer] - model[prayer]);
  }
  return out;
}
function sd(a) {
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  return { mean, sd: Math.sqrt(a.reduce((t, v) => t + (v - mean) ** 2, 0) / a.length) };
}
function fitAngle(prayer, lo, hi) {
  let best = null;
  for (let ang = lo; ang <= hi + 1e-9; ang += 0.05) {
    const params = { fajrAngle: ang, ishaAngle: ang };
    const s = sd(residuals(prayer, params));
    if (!best || s.sd < best.sd) best = { angle: +ang.toFixed(2), ...s };
  }
  return best;
}
const fajrFit = fitAngle('fajr', 16, 20);
const ishaFit = fitAngle('isha', 14, 19);
const PARAMS = { fajrAngle: fajrFit.angle, ishaAngle: ishaFit.angle };
const OFFSETS = {};
const report = {};
for (const k of KEYS) {
  const s = sd(residuals(k, PARAMS));
  OFFSETS[k] = Math.round(s.mean * 10) / 10;
  report[k] = s;
}

// ------------------------------------------------------------------ build
function modelDay(year, month, day) {
  const raw = rawModel(year, month, day, PARAMS);
  const out = {};
  for (const k of KEYS) {
    if (raw[k] == null) return null;
    out[k] = Math.round(raw[k] + OFFSETS[k]);
  }
  for (let i = 1; i < KEYS.length; i++) if (out[KEYS[i]] <= out[KEYS[i - 1]]) return null;
  return out;
}

const DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];   // 29 Feb included
const days = {};
let nOfficial = 0, nComputed = 0;
for (let mo = 1; mo <= 12; mo++) {
  for (let dy = 1; dy <= DIM[mo - 1]; dy++) {
    const key = String(mo).padStart(2, '0') + '-' + String(dy).padStart(2, '0');
    const off = official.get(key);
    if (off) {
      days[key] = { ...roundAll(off.ut), src: 'd' };            // d = Diyanet sheet
      nOfficial++;
    } else {
      // 29 February is computed in a leap year; everything else in the reference year
      const y = (mo === 2 && dy === 29) ? 2028 : REFERENCE_YEAR;
      const m = modelDay(y, mo, dy);
      if (!m) throw new Error(`could not compute ${key}`);
      days[key] = { ...m, src: 'c' };                            // c = computed
      nComputed++;
    }
  }
}
function roundAll(o) {
  const r = {};
  for (const k of KEYS) r[k] = Math.round(o[k]);
  return r;
}

const out = {
  place: 'Mangalia, România',
  timeZone: 'Europe/Bucharest',
  note: 'Times are minutes after 00:00 UTC on the given calendar day. The app converts them to local Romanian time, so daylight saving is always applied correctly. src: d = official Diyanet sheet, c = computed astronomically.',
  method: {
    fajrAngle: PARAMS.fajrAngle, ishaAngle: PARAMS.ishaAngle,
    asr: 'standard (shadow factor 1, not Hanafi)',
    offsetsMinutes: OFFSETS,
  },
  generated: new Date().toISOString().slice(0, 10),
  days,
};
fs.writeFileSync(OUT, JSON.stringify(out));

// ----------------------------------------------------------------- report
console.log(`fitted fajr angle ${PARAMS.fajrAngle}deg  isha angle ${PARAMS.ishaAngle}deg`);
for (const k of KEYS) {
  console.log(`  ${k.padEnd(8)} offset ${String(OFFSETS[k]).padStart(6)} min   residual sd ${report[k].sd.toFixed(2)} min`);
}
console.log(`sources: ${fromFeed} days from the Diyanet ${feedYears.join('/')} feed, `
          + `${nOfficial - fromFeed} more from the PDF sheets, ${nComputed} computed`);
console.log(`days: ${nOfficial} official + ${nComputed} computed = ${Object.keys(days).length}`);

// seam continuity: a computed day next to an official day must line up
const order = Object.keys(days);
let worst = { gap: 0 };
for (let i = 1; i < order.length; i++) {
  const a = days[order[i - 1]], b = days[order[i]];
  if (a.src === b.src) continue;
  for (const k of KEYS) {
    const gap = Math.abs((b[k] - a[k]) - expectedDelta(order[i - 1], order[i], k));
    if (gap > worst.gap) worst = { gap, at: `${order[i - 1]}->${order[i]}`, k };
  }
}
function expectedDelta(k1, k2, key) {
  const [m1, d1] = k1.split('-').map(Number), [m2, d2] = k2.split('-').map(Number);
  const a = modelDay(REFERENCE_YEAR, m1, d1), b = modelDay(REFERENCE_YEAR, m2, d2);
  return (a && b) ? b[key] - a[key] : 0;
}
console.log(`worst official/computed seam mismatch: ${worst.gap.toFixed(1)} min (${worst.at || 'n/a'} ${worst.k || ''})`);
console.log(`times.json written: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
