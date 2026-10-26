// Farmer lookup by a typed number.
// With the Center-wise series the same number exists in several centres (C1 → 1, C2 → 1),
// so a bare number can be ambiguous; the user then types the centre code too: "C2/15".
// farmerAPI.search understands that form and returns only that centre's farmer.

// Strip a leading centre code: "C2/15" → "15"
export const bareFarmerNumber = (typed) => String(typed || '').trim().replace(/^C\d+\s*[/-]\s*/i, '');

// { farmer } for a unique exact number match, { ambiguous: [...] } when centres share it
export function pickFarmerByNumber(list = [], typed) {
  const q = bareFarmerNumber(typed).toLowerCase();
  const exact = list.filter((f) => String(f.farmerNumber || '').toLowerCase() === q);
  if (exact.length > 1) return { farmer: null, ambiguous: exact };
  return { farmer: exact[0] || null, ambiguous: null };
}

// "C2/15" when the farmer's centre has a code, else the plain number
export const farmerRef = (f) => (f?.collectionCenter?.centerCode
  ? `${f.collectionCenter.centerCode}/${f.farmerNumber}`
  : (f?.farmerNumber || ''));

export const ambiguousMessage = (list) =>
  `Farmer No ${list[0]?.farmerNumber} exists in ${list.length} centres — type it with the centre code: ${list.map(farmerRef).join(', ')}`;
