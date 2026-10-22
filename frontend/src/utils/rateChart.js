import dayjs from 'dayjs';

// Rate chart types that have a Rate Charge Table (values match MilkPurchaseSettings.activeRateChartType)
export const CHART_TYPES = [
  { value: 'TSRate',        label: 'TS Rate Chart (Total Solid)' },
  { value: 'ApplyFormula',  label: 'Apply Formula' },
  { value: 'ManualEntry',   label: 'Manual Entry' },
  { value: 'LowChart',      label: 'Low Chart' },
  { value: 'SlabRate',      label: 'Slab Rate' },
  { value: 'GoldLessChart', label: 'Add / Less Chart' },
  { value: 'MilmaChart',    label: 'Milma Chart' },
];

// ── Rate formulas shared by Rate Chart Settings, Rate Charge Table and Milk Purchase ──

// Apply Formula: A = FAT × Fat Rate / 100, B = SNF × SNF Rate / 100, Rate = A + B
export const formulaRate = (fat, snf, f) =>
  (Number(fat) || 0) * (Number(f?.fatRate) || 0) / 100 +
  (Number(snf) || 0) * (Number(f?.snfRate) || 0) / 100;

// TS (Total Solid): TS% = FAT% + SNF%, Rate = TS% × TS Rate / 100
export const tsRateValue = (fat, snf, tsRate) =>
  ((Number(fat) || 0) + (Number(snf) || 0)) * (Number(tsRate) || 0) / 100;

// The TS rate period in force on `date` (fromDate ≤ date ≤ toDate; no toDate = open-ended)
export const findTsPeriod = (rows, date = new Date()) => {
  const d = dayjs(date).format('YYYY-MM-DD');
  return (rows || [])
    .filter(r => dayjs(r.fromDate).format('YYYY-MM-DD') <= d &&
                 (!r.toDate || dayjs(r.toDate).format('YYYY-MM-DD') >= d))
    .sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate))[0] || null;
};

// min..max inclusive in 0.1 steps, built from integer tenths so values never drift (8.299999…)
export const tenthSteps = (min, max) => {
  const lo = Math.round(Number(min) * 10);
  const hi = Math.round(Number(max) * 10);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return [];
  const out = [];
  for (let i = lo; i <= hi; i++) out.push(i / 10);
  return out;
};

// FAT / SNF range presets for the TS Rate Chart (standard Indian cooperative bands)
export const MILK_PRESETS = {
  Cow:     { label: 'Cow',     fatMin: 3.0, fatMax: 5.0,  snfMin: 8.0, snfMax: 9.0  },
  Buffalo: { label: 'Buffalo', fatMin: 6.0, fatMax: 10.0, snfMin: 8.8, snfMax: 10.0 },
  Mixed:   { label: 'Mixed',   fatMin: 4.0, fatMax: 6.0,  snfMin: 8.5, snfMax: 9.5  },
  Full:    { label: 'Full',    fatMin: 1.0, fatMax: 40.0, snfMin: 5.0, snfMax: 20.0 },
};
