import mongoose from 'mongoose';
import Farmer from '../models/Farmer.js';
import FarmerApplication from '../models/FarmerApplication.js';

// ════════════════════════════════════════════════════════════════
//  Loose Panchayat / ward matching for LSGD reports.
//
//  Panchayat names are typed by hand in many spellings ("Madakkathara",
//  "MADAKATHARA GP", "Madakkathara Grama Panchayath") and older farmer
//  records hold the PIN-code Block / Taluk in address.panchayat. Exact
//  matching therefore found nobody ("Panchayat missing"). Names are
//  compared on a spelling-tolerant key instead, and when no farmer has the
//  Panchayat itself the village / place / post / taluk fields are tried.
// ════════════════════════════════════════════════════════════════

/** Spelling-tolerant key: "Madakkathara Grama Panchayath" → "madakatara" */
export const placeKey = (s) => {
  let k = String(s ?? '').toLowerCase().normalize('NFC');
  k = k
    .replace(/\([^)]*\)/g, ' ')                          // "Thuravoor (Ernakulam)"
    .replace(/ഗ്രാമ\s*പഞ്ചായത്ത്|ഗ്രാമപഞ്ചായത്ത്|പഞ്ചായത്ത്/g, ' ')
    .replace(/\b(grama?|gramma)\s*-?\s*panch?ay[a]?th?\b/g, ' ')
    .replace(/\bgramapanch?ay[a]?th?\b/g, ' ')
    .replace(/\bpanch?ay[a]?th?\b/g, ' ')
    .replace(/\b(g\.\s?p\.?|gp)\b/g, ' ')
    .replace(/[^a-z0-9ഀ-ൿ]+/g, '');
  // Transliteration variants: th/t, dh/d, w/v, oo/u, ee/i, doubled letters
  k = k.replace(/th/g, 't').replace(/dh/g, 'd').replace(/w/g, 'v').replace(/oo/g, 'u').replace(/ee/g, 'i')
    .replace(/([a-z])\1+/g, '$1');
  return k;
};

/** "5", "Ward 5", "W-05 Kanjiram" → "5" */
export const wardNumberOf = (ward) => {
  const m = String(ward || '').match(/\d+/);
  return m ? String(Number(m[0])) : '';
};

const ADDRESS_FIELDS = ['taluk', 'village', 'place', 'post'];

/**
 * Farmers of a Panchayat.
 * @param companyId
 * @param panchayat  name as typed / selected
 * @param aliases    other spellings of the same Panchayat (e.g. the Malayalam name)
 * @param scope      'panchayat' (default) or 'all' — every farmer of the society
 * @returns { ids: ObjectId[], matchedBy: 'panchayat' | 'address' | 'all' | 'none', storedName }
 */
export const findPanchayatFarmerIds = async (companyId, panchayat, { aliases = [], scope = 'panchayat' } = {}) => {
  const cid = new mongoose.Types.ObjectId(String(companyId));
  const all = await Farmer.find({ companyId: cid })
    .select('address.panchayat address.taluk address.village address.place address.post').lean();
  if (scope === 'all') return { ids: all.map((f) => f._id), matchedBy: 'all', storedName: '' };

  const keys = new Set([panchayat, ...aliases].map(placeKey).filter((k) => k.length >= 2));
  if (!keys.size) return { ids: [], matchedBy: 'none', storedName: '' };

  // 1. Panchayat field — plus farmers who have an LSGD application for this Panchayat
  const byPanchayat = all.filter((f) => keys.has(placeKey(f.address?.panchayat)));
  const apps = await FarmerApplication.find({ companyId: cid }).select('farmerId panchayat').lean();
  const appIds = new Set(apps.filter((a) => a.farmerId && keys.has(placeKey(a.panchayat))).map((a) => String(a.farmerId)));
  const ids = new Map(byPanchayat.map((f) => [String(f._id), f._id]));
  for (const f of all) if (appIds.has(String(f._id))) ids.set(String(f._id), f._id);
  if (ids.size) {
    return { ids: [...ids.values()], matchedBy: 'panchayat', storedName: String(byPanchayat[0]?.address?.panchayat || '').trim() };
  }

  // 2. Nobody has the Panchayat itself → village / place / post / taluk
  const byAddress = all.filter((f) => ADDRESS_FIELDS.some((k) => keys.has(placeKey(f.address?.[k]))));
  if (byAddress.length) return { ids: byAddress.map((f) => f._id), matchedBy: 'address', storedName: '' };
  return { ids: [], matchedBy: 'none', storedName: '' };
};

/** Does the farmer's ward match the selected ward name and/or ward number? */
export const wardMatches = (address, ward, wardNumber) => {
  const w = String(ward || '').trim();
  const n = String(wardNumber || '').trim() ? wardNumberOf(wardNumber) : '';
  if (!w && !n) return true;
  const fw = address?.ward || '';
  const fn = wardNumberOf(address?.wardNumber) || wardNumberOf(fw);
  if (w && placeKey(fw) && placeKey(fw) === placeKey(w)) return true;
  // "Ward 5" picked from the numbered list ↔ farmer saved as "5" / "W-05"
  const wn = n || (/^\s*(ward|w)?\s*[-.]?\s*\d+\s*$/i.test(w) ? wardNumberOf(w) : '');
  return !!wn && fn === wn;
};

/**
 * Wards known for a Panchayat: from its farmers (ward name + number).
 * @returns [{ ward, wardNumber, farmers }]
 */
export const farmerWardsOf = async (companyId, panchayat, aliases = []) => {
  const { ids } = await findPanchayatFarmerIds(companyId, panchayat, { aliases });
  if (!ids.length) return [];
  const farmers = await Farmer.find({ _id: { $in: ids } }).select('address.ward address.wardNumber').lean();
  const byKey = new Map();
  for (const f of farmers) {
    const ward = String(f.address?.ward || '').trim();
    const num = wardNumberOf(f.address?.wardNumber) || wardNumberOf(ward);
    if (!ward && !num) continue;
    const label = ward || `Ward ${num}`;
    const k = placeKey(label) || label.toUpperCase();
    const cur = byKey.get(k);
    if (cur) { cur.farmers += 1; if (!cur.wardNumber && num) cur.wardNumber = num; }
    else byKey.set(k, { ward: label, wardNumber: num, farmers: 1 });
  }
  return [...byKey.values()];
};
