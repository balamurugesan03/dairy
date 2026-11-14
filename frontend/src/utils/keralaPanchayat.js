/**
 * Kerala Grama Panchayat lookups shared by Farmer Management (address) and the
 * LSGD reports. Matching is spelling-tolerant — same rule as the backend
 * (backend/src/utils/panchayatMatch.js placeKey) — so "MADAKATHARA GP",
 * "Madakkathara Grama Panchayath" and "മാടക്കത്തറ" are the same Panchayat.
 */
import { KERALA_PANCHAYATS } from '../data/keralaPanchayats';

/** Spelling-tolerant key. Keep in step with backend/src/utils/panchayatMatch.js */
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
  k = k.replace(/th/g, 't').replace(/dh/g, 'd').replace(/w/g, 'v').replace(/oo/g, 'u').replace(/ee/g, 'i')
    .replace(/([a-z])\1+/g, '$1');
  return k;
};

// A few names exist in two districts — their option value carries the district so values stay unique
const nameCount = KERALA_PANCHAYATS.reduce((m, [en]) => m.set(en, (m.get(en) || 0) + 1), new Map());
export const PANCHAYATS = KERALA_PANCHAYATS.map(([name, ml, district]) => ({
  name, ml, district, value: nameCount.get(name) > 1 ? `${name} (${district})` : name,
}));

const byKey = new Map();
const byExact = new Map();   // exact name first: "Velur" and "Velloor" share a loose key
for (const p of PANCHAYATS) {
  for (const s of [p.value, p.name, p.ml]) { const e = String(s).trim().toUpperCase(); if (!byExact.has(e)) byExact.set(e, p); }
  for (const k of [placeKey(p.name), placeKey(p.ml)]) if (k && !byKey.has(k)) byKey.set(k, p);
}

/** Kerala Panchayat for a typed / stored name, or null */
export const findKeralaPanchayat = (name) => {
  const s = String(name || '').trim();
  if (!s) return null;
  return byExact.get(s.toUpperCase()) || byKey.get(placeKey(s)) || null;
};

/** Other spellings to send with a lookup (English + Malayalam name of the matched Panchayat) */
export const panchayatAliases = (name) => {
  const p = findKeralaPanchayat(name);
  if (!p) return [];
  const own = placeKey(name);
  return [...new Set([p.name, p.ml])].filter((s) => s && placeKey(s) !== own);
};

/**
 * Autocomplete data: Panchayats already used in Farmer Management first, then all
 * Kerala Panchayats grouped by district.
 * @param recorded  Panchayat names from Farmer Management
 */
export const panchayatOptions = (recorded = []) => {
  const seen = new Set();
  const own = [];
  for (const r of recorded) {
    const v = String(r || '').trim();
    const k = v.toUpperCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    own.push(v);
  }
  const groups = new Map();
  for (const p of PANCHAYATS) {
    if (seen.has(p.value.toUpperCase())) continue;
    seen.add(p.value.toUpperCase());
    if (!groups.has(p.district)) groups.set(p.district, []);
    groups.get(p.district).push(p.value);
  }
  return [
    ...(own.length ? [{ group: 'In Farmer Management', items: own.sort((a, b) => a.localeCompare(b)) }] : []),
    ...[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([group, items]) => ({ group: `${group} District`, items })),
  ];
};

/** "5", "Ward 5", "W-05 Kanjiram" → "5" */
export const wardNumberOf = (ward) => {
  const m = String(ward || '').match(/\d+/);
  return m ? String(Number(m[0])) : '';
};

// Kerala Grama Panchayats have up to 24 wards (2025 delimitation)
export const MAX_WARDS = 24;

/**
 * Ward Autocomplete data: wards recorded for the Panchayat's farmers, then Ward 1…24.
 * @param known [{ ward, wardNumber, farmers }]
 */
export const wardOptions = (known = []) => {
  const recorded = [];
  const seen = new Set();
  const nums = new Set();
  for (const w of known) {
    const v = String(w.ward || '').trim();
    if (!v || seen.has(v.toUpperCase())) continue;
    seen.add(v.toUpperCase());
    recorded.push(v);
    const n = w.wardNumber || wardNumberOf(v);
    if (n) nums.add(n);
  }
  const numbered = [];
  for (let i = 1; i <= MAX_WARDS; i += 1) if (!nums.has(String(i)) && !seen.has(`WARD ${i}`)) numbered.push(`Ward ${i}`);
  return [
    ...(recorded.length ? [{ group: 'Wards of this Panchayat (Farmer Management)', items: recorded }] : []),
    { group: 'Ward numbers', items: numbered },
  ];
};

/** Ward number for a chosen ward label, using the recorded wards first */
export const wardNumberFor = (ward, known = []) => {
  const w = known.find((x) => String(x.ward).trim().toUpperCase() === String(ward || '').trim().toUpperCase());
  return (w && w.wardNumber) || wardNumberOf(ward);
};

/**
 * PIN-code post office → address. Block / Taluk goes to address.taluk (it is not the
 * Grama Panchayat). The Panchayat is filled only when it is empty and the post office
 * carries a Kerala Panchayat's name.
 */
export const applyPostOffice = (form, office) => {
  if (!office) return;
  const block = office.Block && office.Block !== 'NA' ? office.Block : '';
  form.setFieldValue('address.taluk', block || office.Taluk || '');
  if (!String(form.values.address?.panchayat || '').trim()) {
    const p = findKeralaPanchayat(office.Name);
    if (p) form.setFieldValue('address.panchayat', p.value);
  }
};
