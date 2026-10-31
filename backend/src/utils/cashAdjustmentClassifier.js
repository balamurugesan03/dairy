import Ledger from '../models/Ledger.js';

/**
 * Cash/Bank ledger id lookup for a company. Used to classify a voucher's
 * driving leg as a real cash movement ("cash" column) vs a non-cash book
 * entry ("adjustment" column) across the Accounts reports.
 */
const CASH_TYPES = ['Cash', 'Cash in Hand'];
const BANK_TYPES = ['Bank', 'Bank Accounts'];

export async function getCashBankLedgerIds(companyId) {
  // Every cash / bank ledger, active or not — an entry posted to an inactive or
  // 'Cash in Hand'-typed cash ledger is still cash (it used to fall through to
  // Adjustment, so the General Ledger disagreed with Cash Book / Day Book)
  const cashBankLedgers = await Ledger.find({
    companyId,
    ledgerType: { $in: [...CASH_TYPES, ...BANK_TYPES] }
  }).select('_id ledgerType');

  const cashIds = new Set();
  const bankIds = new Set();
  const allIds = new Set();
  const allObjectIds = [];

  for (const l of cashBankLedgers) {
    const id = l._id.toString();
    allIds.add(id);
    allObjectIds.push(l._id);
    if (CASH_TYPES.includes(l.ledgerType)) cashIds.add(id);
    else bankIds.add(id);
  }

  return { cashIds, bankIds, allIds, allObjectIds };
}

function entryLedgerId(entry) {
  if (!entry.ledgerId) return null;
  return entry.ledgerId._id ? entry.ledgerId._id.toString() : entry.ledgerId.toString();
}

/**
 * Classifies a voucher's entries as 'cash' or 'adjustment'.
 *
 * Rule: the entry touching a Cash-type ledger is a real cash movement
 * (Receipt/Payment Voucher against Cash in Hand). An entry touching a
 * Bank-type ledger, or a voucher with no Cash/Bank leg at all (a pure
 * Journal / Adjustment entry), is a non-cash adjustment.
 *
 * `entries` is a voucher's `entries` array (ledgerId may be populated or
 * a bare ObjectId). Returns the driving cash/bank leg and its contra leg.
 */
export function classifyVoucherEntry(entries, cashBankIds) {
  // A cash leg wins over a bank leg (cash deposited to / withdrawn from bank is cash)
  const drivingEntry = entries.find(e => {
    const id = entryLedgerId(e);
    return id && cashBankIds.cashIds.has(id);
  }) || entries.find(e => {
    const id = entryLedgerId(e);
    return id && cashBankIds.allIds.has(id);
  });

  if (!drivingEntry) {
    return { column: 'adjustment', drivingEntry: null, contraEntry: null };
  }

  const drivingId = entryLedgerId(drivingEntry);
  const column = cashBankIds.cashIds.has(drivingId) ? 'cash' : 'adjustment';
  const contraEntry = entries.find(e => entryLedgerId(e) !== drivingId) || null;

  return { column, drivingEntry, contraEntry };
}
