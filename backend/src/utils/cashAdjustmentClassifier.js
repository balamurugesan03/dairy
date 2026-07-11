import Ledger from '../models/Ledger.js';

/**
 * Cash/Bank ledger id lookup for a company. Used to classify a voucher's
 * driving leg as a real cash movement ("cash" column) vs a non-cash book
 * entry ("adjustment" column) across the Accounts reports.
 */
export async function getCashBankLedgerIds(companyId) {
  const cashBankLedgers = await Ledger.find({
    companyId,
    ledgerType: { $in: ['Cash', 'Bank'] },
    status: 'Active'
  }).select('_id ledgerType');

  const cashIds = new Set();
  const bankIds = new Set();
  const allIds = new Set();
  const allObjectIds = [];

  for (const l of cashBankLedgers) {
    const id = l._id.toString();
    allIds.add(id);
    allObjectIds.push(l._id);
    if (l.ledgerType === 'Cash') cashIds.add(id);
    else if (l.ledgerType === 'Bank') bankIds.add(id);
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
  const drivingEntry = entries.find(e => {
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
