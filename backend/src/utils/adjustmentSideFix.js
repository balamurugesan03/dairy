import Voucher from '../models/Voucher.js';
import { updateLedgerBalances } from './accountingHelper.js';

// One-time correction for Adjustment Entry (manual Journal) vouchers saved
// before 2026-11-06. The screen used to save its Receipt section as Debit and
// its Payment section as Credit, but every report (Day Book, General Ledger,
// Ledger Abstract, R&D, Receipts & Payments) and every module-posted Journal
// read a non-cash ledger as Credit = Receipt, Debit = Payment — so manual
// Adjustment entries showed on the opposite side.
//
// For every manual Journal not yet marked adjSides 'v2': swap each leg's
// debit/credit, mark it 'v2', and move the ledger running balances by the same
// change (reverse the old legs, apply the new ones). Idempotent: marked
// vouchers are never touched again. Journals can't contain Cash/Bank legs
// (createVoucher forbids it), so the swap never affects cash.
export const fixAdjustmentEntrySides = async () => {
  const filter = {
    voucherType: 'Journal',
    $or: [{ referenceType: 'Manual' }, { referenceType: { $exists: false } }, { referenceType: null }],
    adjSides: { $ne: 'v2' },
    // demo seed scripts post proper Dr/Cr journals — never flip those
    referenceNumber: { $nin: ['DEMO-SEED', 'UNION-BILL-DEMO'] }
  };
  const vouchers = await Voucher.find(filter);
  let fixed = 0;
  for (const v of vouchers) {
    try {
    const oldLegs = v.entries.map(e => ({
      ledgerId: e.ledgerId, debitAmount: e.debitAmount || 0, creditAmount: e.creditAmount || 0
    }));
    v.entries.forEach(e => {
      const dr = e.debitAmount || 0;
      e.debitAmount = e.creditAmount || 0;
      e.creditAmount = dr;
    });
    const td = v.totalDebit;
    v.totalDebit = v.totalCredit;
    v.totalCredit = td;
    v.adjSides = 'v2';
    await v.save();
    if (v.status !== 'Cancelled') {
      // undo old legs, apply swapped legs  ==  apply the swapped legs twice
      const swapped = oldLegs.map(e => ({ ledgerId: e.ledgerId, debitAmount: e.creditAmount, creditAmount: e.debitAmount }));
      await updateLedgerBalances(swapped, null, v.companyId);
      await updateLedgerBalances(swapped, null, v.companyId);
    }
    fixed++;
    } catch (e) {
      console.warn(`Adjustment side fix skipped voucher ${v.voucherNumber || v._id}:`, e.message);
    }
  }
  return fixed;
};
