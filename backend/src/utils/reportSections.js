// Report View grouping + alphabetical ordering shared by Receipts and
// Disbursements and Ledger Abstract, so both reports always group and sort
// identically:
//   accountGroup → one section per Account Group (ledgerType)
//   category     → one section per category (ASSETS, LIABILITIES, …)
//   ledger       → a single "All Ledgers" section
// Section headings A→Z, ledgers inside each section A→Z (case-insensitive).

export const REPORT_VIEWS = ['accountGroup', 'ledger', 'category'];

/** Case-insensitive A→Z name order. */
export const byNameCI = (a = '', b = '') =>
  String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });

export const sectionKeyOf = (record, groupBy) =>
  groupBy === 'category' ? (record.category || 'OTHER')
    : groupBy === 'ledger' ? 'All Ledgers'
    : (record.ledgerType || 'Other'); // accountGroup (default)

/**
 * @param {object[]} records  one per ledger: { ledgerName, ledgerType, parentGroup, category, … }
 * @param {string}   groupBy  accountGroup | ledger | category
 * @returns {{ sectionName: string, parentGroup: string, ledgers: object[] }[]}
 */
export const groupIntoSections = (records, groupBy = 'accountGroup') => {
  const view = REPORT_VIEWS.includes(groupBy) ? groupBy : 'accountGroup';
  const map = {};
  records.forEach(r => {
    const key = sectionKeyOf(r, view);
    if (!map[key]) map[key] = { sectionName: key, parentGroup: r.parentGroup, ledgers: [] };
    map[key].ledgers.push(r);
  });
  const sections = Object.values(map);
  sections.forEach(s => s.ledgers.sort((a, b) => byNameCI(a.ledgerName, b.ledgerName)));
  return sections.sort((a, b) => byNameCI(a.sectionName, b.sectionName));
};
