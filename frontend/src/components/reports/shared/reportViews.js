// Report View options shared by Receipts and Disbursements and Ledger Abstract.
// Grouping and A→Z ordering are done server-side by the same helper
// (backend utils/reportSections.js), so both reports always agree.

export const GROUP_BY_OPTS = [
  { value: 'accountGroup', label: 'Account Group Wise' },
  { value: 'ledger',       label: 'Ledger Wise' },
  { value: 'category',     label: 'Category Wise' }
];

export const CATEGORY_LABELS = {
  ASSETS: 'Assets', LIABILITIES: 'Liabilities', INCOME: 'Income',
  EXPENSES: 'Expenses', CAPITAL: 'Capital & Reserves', OTHER: 'Other'
};

// Section heading text: "Trade Income (INCOME)" for Account Group Wise,
// the category label for Category Wise, the plain name otherwise.
export const sectionLabel = (groupBy, sec) => {
  if (groupBy === 'category') return CATEGORY_LABELS[sec.sectionName] || sec.sectionName;
  if (groupBy === 'accountGroup' && sec.parentGroup) return `${sec.sectionName} (${sec.parentGroup})`;
  return sec.sectionName;
};
