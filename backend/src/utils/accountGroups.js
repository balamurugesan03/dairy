/**
 * Account Group master — single source of truth for Final Accounts.
 *
 * Every ledger's account group (ledger.ledgerType) carries two attributes:
 *
 *   faType          BS = Balance Sheet   PL = Profit & Loss   TR = Trading Account
 *   defVoucherType  B  = Both sides      P  = Payment side    R  = Receipt side
 *
 * Final Accounts (Dynamic) never hard-codes groups: it looks a ledger's group
 * up here, sends it to the statement named by faType, and places it on the
 * side named by defVoucherType. Payment = debit side, Receipt = credit side;
 * on the Balance Sheet that is Assets (debit) / Liabilities (credit). A "B"
 * group goes to whichever side its closing balance falls on (Dr → Payment /
 * Assets, Cr → Receipt / Liabilities).
 *
 * The array order is the display order inside each statement.
 */
export const ACCOUNT_GROUPS = [
  // ── BS · ASSET ────────────────────────────────────────────────────────────
  { name: 'Cash in Hand',                        parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Bank Accounts',                       parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Share in Other Institutions',         parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Investment in Govt. Securities',      parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Other Investments',                   parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Loans & Advances to Members',         parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Interest Receivable',                 parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Other Assets',                        parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Fixed Assets - Movables',             parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Fixed Assets - Immovables',           parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Advance due to Society',              parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Closing Stock',                       parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Loss',                                parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Net Loss Brought From P&L A/c',       parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },

  // ── BS · LIABILITY ────────────────────────────────────────────────────────
  { name: 'Share Capital',                       parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Deposits',                            parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Borrowings (Loans, Cash Credits)',    parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Statutory Funds and Reserves',        parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Interest Payable',                    parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Grants and Subsidies',                parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Education Fund',                      parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Other Liabilities',                   parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Advance due by Society',              parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Profit',                              parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Net Profit Brought From P&L A/c',     parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },

  // ── TR · Trading Account ──────────────────────────────────────────────────
  { name: 'Opening Stock',                       parentGroup: 'EXPENSE',   faType: 'TR', defVoucherType: 'P' },
  { name: 'Purchases',                           parentGroup: 'EXPENSE',   faType: 'TR', defVoucherType: 'P' },
  { name: 'Trade Expenses',                      parentGroup: 'EXPENSE',   faType: 'TR', defVoucherType: 'P' },
  { name: 'Sales',                               parentGroup: 'INCOME',    faType: 'TR', defVoucherType: 'R' },
  { name: 'Trade Income',                        parentGroup: 'INCOME',    faType: 'TR', defVoucherType: 'R' },
  { name: 'Closing Stock (Trading)',             parentGroup: 'INCOME',    faType: 'TR', defVoucherType: 'R' },

  // ── PL · Profit & Loss ────────────────────────────────────────────────────
  { name: 'Establishment Charges',               parentGroup: 'EXPENSE',   faType: 'PL', defVoucherType: 'P' },
  { name: 'Contingencies',                       parentGroup: 'EXPENSE',   faType: 'PL', defVoucherType: 'P' },
  { name: 'Miscellaneous Income',                parentGroup: 'INCOME',    faType: 'PL', defVoucherType: 'R' },

  // ── Legacy / basic types (kept for older ledgers) ─────────────────────────
  { name: 'Cash',                                parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Bank',                                parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Asset',                               parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Fixed Assets',                        parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Movable Assets',                      parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Immovable Assets',                    parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Other Receivable',                    parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Investment A/c',                      parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Other Investment',                    parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Government Securities',               parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Party',                               parentGroup: 'ASSET',     faType: 'BS', defVoucherType: 'B' },
  { name: 'Liability',                           parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Capital',                             parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Accounts Due To (Sundry Creditors)',  parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Other Payable',                       parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Deposit A/c',                         parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Contingency Fund',                    parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Profit & Loss A/c',                   parentGroup: 'LIABILITY', faType: 'BS', defVoucherType: 'B' },
  { name: 'Purchases A/c',                       parentGroup: 'EXPENSE',   faType: 'TR', defVoucherType: 'P' },
  { name: 'Sales A/c',                           parentGroup: 'INCOME',    faType: 'TR', defVoucherType: 'R' },
  { name: 'Expense',                             parentGroup: 'EXPENSE',   faType: 'PL', defVoucherType: 'P' },
  { name: 'Miscellaneous Expenses',              parentGroup: 'EXPENSE',   faType: 'PL', defVoucherType: 'P' },
  { name: 'Income',                              parentGroup: 'INCOME',    faType: 'PL', defVoucherType: 'R' },
  { name: 'Other Revenue',                       parentGroup: 'INCOME',    faType: 'PL', defVoucherType: 'R' },
  { name: 'Grants & Aid',                        parentGroup: 'INCOME',    faType: 'PL', defVoucherType: 'R' },
  { name: 'Subsidies',                           parentGroup: 'INCOME',    faType: 'PL', defVoucherType: 'R' }
];

const GROUP_MAP = new Map(ACCOUNT_GROUPS.map((g, i) => [g.name, { ...g, order: i }]));

// Unknown group: fall back on the ledger's parentGroup (ASSET / LIABILITY →
// BS·B, INCOME → PL·R, EXPENSE → PL·P) so no ledger silently drops out.
const FALLBACK = {
  ASSET:     { faType: 'BS', defVoucherType: 'B' },
  LIABILITY: { faType: 'BS', defVoucherType: 'B' },
  INCOME:    { faType: 'PL', defVoucherType: 'R' },
  EXPENSE:   { faType: 'PL', defVoucherType: 'P' }
};

/** Look up a ledger's account group: { name, parentGroup, faType, defVoucherType, order }. */
export const getAccountGroup = (ledgerType, parentGroup) => {
  const g = GROUP_MAP.get(ledgerType);
  if (g) return g;
  const pg = FALLBACK[parentGroup] ? parentGroup : 'ASSET';
  return { name: ledgerType || 'Other', parentGroup: pg, ...FALLBACK[pg], order: ACCOUNT_GROUPS.length };
};
