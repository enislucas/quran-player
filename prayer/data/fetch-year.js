/*
 * Downloads a full year of official Diyanet prayer times for Mangalia.
 *
 *   node prayer/data/fetch-year.js            (the year currently published)
 *   node prayer/data/fetch-year.js 2027
 *
 * Writes prayer/data/mangalia-diyanet-<year>.json, which build-times.js then
 * prefers over everything else. Diyanet publishes one calendar year at a time,
 * usually late in the preceding year, so this is worth re-running once a year.
 *
 * Mangalia is Diyanet district 15952:
 *   https://namazvakitleri.diyanet.gov.tr/en-US/15952/mangalia-prayer-time
 * The endpoint below is a public mirror of that same data (no key needed).
 * It was checked against the Diyanet PDF sheets in prayer/data: 192 of 192
 * values identical.
 */
const fs = require('fs');
const path = require('path');

const DISTRICT = 15952;
const URL = `https://ezanvakti.imsakiyem.com/api/prayer-times/${DISTRICT}/yearly?limit=400`;
const FIELDS = ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'];

(async () => {
  const wanted = process.argv[2] ? Number(process.argv[2]) : null;
  process.stdout.write(`fetching district ${DISTRICT} ... `);
  const r = await fetch(URL, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const payload = await r.json();
  const rows = Array.isArray(payload) ? payload : payload.data;
  if (!Array.isArray(rows) || !rows.length) throw new Error('no rows returned');
  console.log(`${rows.length} rows`);

  const byYear = new Map();
  for (const row of rows) {
    if (!row || !row.times || !row.date) continue;
    const d = new Date(row.date);
    const year = d.getUTCFullYear();
    const key = String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    const times = {};
    for (const f of FIELDS) {
      const v = row.times[f];
      if (!/^\d{2}:\d{2}$/.test(v || '')) throw new Error(`bad time "${v}" on ${key}`);
      times[f] = v;
    }
    // must be in order, or the source is not what we think it is
    const mins = FIELDS.map((f) => +times[f].slice(0, 2) * 60 + +times[f].slice(3));
    for (let i = 1; i < mins.length; i++) {
      if (mins[i] <= mins[i - 1]) throw new Error(`times out of order on ${year}-${key}`);
    }
    if (!byYear.has(year)) byYear.set(year, {});
    byYear.get(year)[key] = times;
  }

  const years = [...byYear.keys()].sort();
  console.log('years present:', years.join(', '));
  const year = wanted || years[years.length - 1];
  const days = byYear.get(year);
  if (!days) throw new Error(`year ${year} is not published yet (got ${years.join(', ')})`);
  const count = Object.keys(days).length;
  if (count < 300) throw new Error(`only ${count} days for ${year}, refusing to write a partial year`);

  const out = path.join(__dirname, `mangalia-diyanet-${year}.json`);
  fs.writeFileSync(out, JSON.stringify({
    place: 'MANGALIA', districtId: DISTRICT, year,
    source: 'T.C. Diyanet İşleri Başkanlığı (Namaz Vaktim), via ezanvakti.imsakiyem.com',
    fetched: new Date().toISOString().slice(0, 10),
    days,
  }, null, 0));
  console.log(`wrote ${path.basename(out)}: ${count} days of ${year}`);
  console.log('now run:  node prayer/data/build-times.js');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
