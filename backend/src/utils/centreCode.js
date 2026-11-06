import CollectionCenter from '../models/CollectionCenter.js';
import FarmerSettings from '../models/FarmerSettings.js';
import Farmer from '../models/Farmer.js';
import Ledger from '../models/Ledger.js';

// ══════════════════════════════════════════════════════════════════════════════
//  Collection Centre codes — C<number> per company.
//
//  • The 'C' prefix is fixed; only the number is chosen/edited by the user.
//  • New centres are numbered from FarmerSettings.centreCodeStart (default 1):
//    the first free number is the highest code at/above the start + 1, or the
//    start itself (start 100 with C1..C3 in use → C100, C101 …).
//  • A code may be edited later (unique per company). Farmers and every module
//    link to the centre by _id, so nothing has to be re-linked; only text that
//    embeds the code (farmer ledger names "Name (C1/12)") is rewritten.
//
//  ensureCentreCodes() heals existing data: valid, unique codes are kept; centres
//  without one (or with a duplicate / malformed code) get the next free code —
//  Head Office first, then oldest centre first.  It runs for every company at
//  server start and lazily before centre lists are read.
// ══════════════════════════════════════════════════════════════════════════════

const CODE_RE = /^C(\d+)$/i;
export const centreCodeNumber = (code) => {
  const m = String(code || '').trim().match(CODE_RE);
  return m ? parseInt(m[1], 10) : 0;
};

// '100' | 100 | 'c100' | 'C0100' → 'C100'; anything else → null
export const normaliseCentreCode = (input) => {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/^C/i, '');
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n > 0 ? `C${n}` : null;
};

const byHierarchy = (a, b) => {
  const ho = (c) => (c.centerType === 'Head Office' ? 0 : 1);
  if (ho(a) !== ho(b)) return ho(a) - ho(b);
  return new Date(a.createdAt || a.startDate || 0) - new Date(b.createdAt || b.startDate || 0)
    || String(a._id).localeCompare(String(b._id));
};

export async function getCentreCodeStart(companyId) {
  const s = await FarmerSettings.findOne({ companyId }).select('centreCodeStart').lean();
  const n = parseInt(s?.centreCodeStart, 10);
  return n > 0 ? n : 1;
}

// First number to hand out given the numbers in use and the starting number
const nextNumber = (used, start) => {
  let max = 0;
  for (const n of used) if (n >= start && n > max) max = n;
  let n = max ? max + 1 : start;
  while (used.has(n)) n += 1;
  return n;
};

// Throttle the lazy heal — a company's centres rarely change
const lastHeal = new Map();

export async function ensureCentreCodes(companyId, { force = false } = {}) {
  if (!companyId) return 0;
  const key = String(companyId);
  if (!force && Date.now() - (lastHeal.get(key) || 0) < 60 * 1000) return 0;
  lastHeal.set(key, Date.now());

  const centres = await CollectionCenter.find({ companyId })
    .select('centerCode centerType startDate createdAt').lean();
  centres.sort(byHierarchy);

  const used = new Set();
  const missing = [];
  const fixes = [];
  for (const c of centres) {
    const n = centreCodeNumber(c.centerCode);
    if (n && !used.has(n)) {
      used.add(n);
      if (c.centerCode !== `C${n}`) fixes.push({ id: c._id, code: `C${n}` }); // c2 / " C2" → C2
    } else {
      missing.push(c);
    }
  }

  if (missing.length) {
    const start = await getCentreCodeStart(companyId);
    for (const c of missing) {
      const n = nextNumber(used, start);
      used.add(n);
      fixes.push({ id: c._id, code: `C${n}` });
    }
  }

  if (!fixes.length) return 0;
  // Clear first, then assign — a code being freed by one centre (c3 → C3, duplicate C3 → C5)
  // must not collide with another centre's new code on the unique index mid-way
  await CollectionCenter.updateMany({ _id: { $in: fixes.map(f => f.id) } }, { $unset: { centerCode: 1 } });
  for (const f of fixes) {
    await CollectionCenter.updateOne({ _id: f.id }, { $set: { centerCode: f.code } });
  }
  return fixes.length;
}

export async function ensureAllCentreCodes() {
  const companies = await CollectionCenter.distinct('companyId');
  let total = 0;
  for (const companyId of companies) total += await ensureCentreCodes(companyId, { force: true });
  return total;
}

// Next code(s) for new centres. count > 1 gives a run (DP import creating several centres).
export async function nextCentreCodes(companyId, count = 1, { reserved = [] } = {}) {
  const rows = await CollectionCenter.find({ companyId }).select('centerCode').lean();
  const used = new Set(rows.map(r => centreCodeNumber(r.centerCode)).filter(Boolean));
  for (const c of reserved) { const n = centreCodeNumber(c); if (n) used.add(n); }
  const start = await getCentreCodeStart(companyId);
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = nextNumber(used, start);
    used.add(n);
    out.push(`C${n}`);
  }
  return out;
}

export async function nextCentreCode(companyId) {
  return (await nextCentreCodes(companyId, 1))[0];
}

export async function centreCodeTaken(companyId, code, excludeId) {
  const filter = { companyId, centerCode: code };
  if (excludeId) filter._id = { $ne: excludeId };
  return !!(await CollectionCenter.exists(filter));
}

// Rewrite the text that embeds a centre code after it changed: farmer ledger names
// "Name (C1/12)" → "Name (C100/12)". Farmer records themselves link by _id and keep
// their numbers; reports/screens read the code through that link.
export async function syncCentreCodeChange(companyId, centreId, oldCode, newCode) {
  if (!oldCode || !newCode || oldCode === newCode) return { ledgers: 0 };
  const farmers = await Farmer.find({ companyId, collectionCenter: centreId, ledgerId: { $ne: null } })
    .select('ledgerId farmerNumber').lean();
  if (!farmers.length) return { ledgers: 0 };
  const ledgers = await Ledger.find({ _id: { $in: farmers.map(f => f.ledgerId) } }).select('ledgerName').lean();
  const oldTag = `(${oldCode}/`;
  const ops = [];
  for (const l of ledgers) {
    const name = l.ledgerName || '';
    if (!name.includes(oldTag)) continue;
    ops.push({ updateOne: { filter: { _id: l._id }, update: { $set: { ledgerName: name.split(oldTag).join(`(${newCode}/`) } } } });
  }
  if (ops.length) await Ledger.bulkWrite(ops, { ordered: false });
  return { ledgers: ops.length };
}
