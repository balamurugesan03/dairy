import mongoose from 'mongoose';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';

// Opening balance of Cash in Hand on a date, shared by Day Book, Cash Book and
// Cash Book Entry so all three show the same figure:
//   Accounts → Ledger → Cash in Hand → Opening Balance
//   + every (non-cancelled) cash leg dated before `beforeDate`.
// Cash is debit-nature: a Dr opening adds, a Cr opening subtracts.
// Bank ledgers are deliberately excluded — this is the cash opening only.
export const getCashInHandOpening = async (companyIdRaw, beforeDate) => {
  const companyId = new mongoose.Types.ObjectId(String(companyIdRaw));
  const cashLedgers = await Ledger.find({ companyId, ledgerType: { $in: ['Cash', 'Cash in Hand'] } })
    .select('ledgerName ledgerType openingBalance openingBalanceType')
    .lean();
  const cashIds = cashLedgers.map(l => l._id);

  const ledgerOpening = cashLedgers.reduce((s, l) =>
    s + ((l.openingBalanceType === 'Cr' ? -1 : 1) * (l.openingBalance || 0)), 0);
  if (!cashIds.length) return { openingBalance: 0, ledgerOpening: 0, cashIds };

  const [prior] = await Voucher.aggregate([
    { $match: { companyId, status: { $ne: 'Cancelled' }, voucherDate: { $lt: beforeDate }, 'entries.ledgerId': { $in: cashIds } } },
    { $unwind: '$entries' },
    { $match: { 'entries.ledgerId': { $in: cashIds } } },
    { $group: { _id: null, dr: { $sum: '$entries.debitAmount' }, cr: { $sum: '$entries.creditAmount' } } }
  ]);
  return {
    openingBalance: ledgerOpening + (prior?.dr || 0) - (prior?.cr || 0),
    ledgerOpening,
    cashIds,
  };
};
