import Farmer from '../models/Farmer.js';
import FarmerSettings from '../models/FarmerSettings.js';
import CollectionCenter from '../models/CollectionCenter.js';

// ══════════════════════════════════════════════════════════════════════════════
//  Farmer Number series (Producer Management → Settings)
//    Existing → one common sequence for the company: highest numeric number + 1
//    Centre   → each centre has its own sequence 1, 2, 3 … so the SAME number can
//               exist in two centres (C1 → 1 and C2 → 1).  A farmer is therefore
//               identified by (centre, number) — or by its _id — never by number alone.
//  Existing farmers are never renumbered.
// ══════════════════════════════════════════════════════════════════════════════

export async function getNumberSeries(companyId) {
  const s = await FarmerSettings.findOne({ companyId }).select('numberSeries').lean();
  return s?.numberSeries === 'Centre' ? 'Centre' : 'Existing';
}

const nextAfter = (numbers) => {
  const taken = new Set(numbers.map(String));
  let max = 0;
  for (const s of taken) if (/^\d+$/.test(s)) max = Math.max(max, parseInt(s, 10));
  let n = max + 1;
  while (taken.has(String(n))) n += 1;
  return String(n);
};

// Next number for a new farmer. In Centre mode the sequence is the centre's own.
export async function nextFarmerNumber(companyId, { series, centreId } = {}) {
  const mode = series || await getNumberSeries(companyId);
  const filter = { companyId };
  if (mode === 'Centre') filter.collectionCenter = centreId || null;
  const rows = await Farmer.find(filter).select('farmerNumber').lean();
  return nextAfter(rows.map(r => r.farmerNumber));
}

// Next number for every centre at once (Settings preview)
export async function nextFarmerNumbersByCentre(companyId) {
  const rows = await Farmer.find({ companyId }).select('farmerNumber collectionCenter').lean();
  const byCentre = new Map();
  for (const r of rows) {
    const k = String(r.collectionCenter || '');
    if (!byCentre.has(k)) byCentre.set(k, []);
    byCentre.get(k).push(r.farmerNumber);
  }
  return {
    existing: nextAfter(rows.map(r => r.farmerNumber)),
    forCentre: (centreId) => nextAfter(byCentre.get(String(centreId || '')) || []),
  };
}

// Is this number already taken? Existing → anywhere in the company; Centre → in that centre.
export async function farmerNumberTaken(companyId, number, { series, centreId, excludeId } = {}) {
  const mode = series || await getNumberSeries(companyId);
  const filter = { companyId, farmerNumber: String(number).trim() };
  if (mode === 'Centre') filter.collectionCenter = centreId || null;
  if (excludeId) filter._id = { $ne: excludeId };
  return !!(await Farmer.exists(filter));
}

// One farmer by number (Mongoose doc). With a centre the lookup is scoped to it; without
// one, a number used in several centres is an error rather than an arbitrary pick.
export async function findFarmerByNumber(companyId, number, { centreId, filter = {} } = {}) {
  const q = { ...filter, companyId, farmerNumber: String(number ?? '').trim() };
  if (centreId) return Farmer.findOne({ ...q, collectionCenter: centreId });
  const hits = await Farmer.find(q).limit(2);
  if (hits.length > 1) {
    throw new Error(`Farmer Number ${q.farmerNumber} exists in more than one centre — use the centre code (e.g. C2/${q.farmerNumber})`);
  }
  return hits[0] || null;
}

// Farmer reference for ledger names / labels: 'C1/12' in Centre mode, plain '12' otherwise
export async function farmerRefText(farmer, series) {
  const mode = series || await getNumberSeries(farmer.companyId);
  const centreId = farmer.collectionCenter?._id || farmer.collectionCenter;
  if (mode !== 'Centre' || !centreId) return String(farmer.farmerNumber);
  const c = await CollectionCenter.findById(centreId).select('centerCode').lean();
  return c?.centerCode ? `${c.centerCode}/${farmer.farmerNumber}` : String(farmer.farmerNumber);
}

// ── Number → farmer maps for imports ──────────────────────────────────────────
// Imported files carry only the farmer number. When centre-wise numbering makes a
// number ambiguous (same number in two centres) the row is left unlinked rather
// than attached to an arbitrary farmer.
//
//   addFarmerKeys(map, farmers, f => f.farmerNumber)            — primary keys
//   addFarmerKeys(map, farmers, f => f.memberId, { fallback })   — only fills keys not set yet
//
// Values are { id, name }; an ambiguous key holds null, which reads as "not found".
export function addFarmerKeys(map, farmers, keyOf, { fallback = false, numericAlias = false } = {}) {
  const before = fallback ? new Set(Object.keys(map)) : null;
  const put = (k, f) => {
    if (!k || (before && before.has(k))) return;
    const val = { id: f._id, name: f.personalDetails?.name || '' };
    if (!(k in map)) map[k] = val;
    else if (map[k] && String(map[k].id) !== String(f._id)) map[k] = null;
  };
  for (const f of farmers) {
    const k = String(keyOf(f) ?? '').trim();
    put(k, f);
    if (numericAlias && k) {
      const numeric = String(parseInt(k, 10));
      if (numeric !== k && numeric !== 'NaN') put(numeric, f);
    }
  }
  return map;
}

// Aggregation group key for "one row per farmer": the linked farmer, else the
// number (rows imported without a farmer link).
export const FARMER_KEY = { $ifNull: ['$farmer', '$farmerNumber'] };
