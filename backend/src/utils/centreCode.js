import CollectionCenter from '../models/CollectionCenter.js';

// ══════════════════════════════════════════════════════════════════════════════
//  Collection Centre codes — C1, C2, C3 … per company, always system-generated.
//
//  ensureCentreCodes() heals existing data: valid, unique codes are kept; centres
//  without one (or with a duplicate / malformed code) are numbered after the
//  highest code in use — Head Office first, then oldest centre first.  It runs
//  for every company at server start and lazily before centre lists are read,
//  so existing databases and new companies follow the same rule.
// ══════════════════════════════════════════════════════════════════════════════

const CODE_RE = /^C(\d+)$/i;
export const centreCodeNumber = (code) => {
  const m = String(code || '').trim().match(CODE_RE);
  return m ? parseInt(m[1], 10) : 0;
};

const byHierarchy = (a, b) => {
  const ho = (c) => (c.centerType === 'Head Office' ? 0 : 1);
  if (ho(a) !== ho(b)) return ho(a) - ho(b);
  return new Date(a.createdAt || a.startDate || 0) - new Date(b.createdAt || b.startDate || 0)
    || String(a._id).localeCompare(String(b._id));
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

  let next = used.size ? Math.max(...used) : 0;
  for (const c of missing) fixes.push({ id: c._id, code: `C${++next}` });

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

export async function nextCentreCode(companyId) {
  const rows = await CollectionCenter.find({ companyId }).select('centerCode').lean();
  const max = rows.reduce((m, r) => Math.max(m, centreCodeNumber(r.centerCode)), 0);
  return `C${max + 1}`;
}
