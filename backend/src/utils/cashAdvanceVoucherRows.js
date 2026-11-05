import mongoose from 'mongoose';
import Advance from '../models/Advance.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';

// Cash Advance module → Accounts screens (Receipt Voucher, Payment Voucher,
// Cash Book Entry, Adjustment Entry).
//
// The Cash Advance module stores its entries in Advance (disbursements) and
// ProducerReceipt (manual recoveries). Day Book and Cash Book already read those
// collections directly; the four voucher screens only read Voucher. Rather than
// posting a second copy as a Voucher (which Day Book / Cash Book / GL would then
// count twice), this builds read-only voucher-shaped rows on the fly:
//
//   Advance, paymentMode Cash          → Payment  (Dr Farmers Cash Advance / Cr Cash in Hand)
//   Advance, Bank / UPI / Cheque        → Journal  (Dr Farmers Cash Advance / Cr Bank)
//   ProducerReceipt 'Cash Advance', Cash → Receipt (Dr Cash in Hand / Cr Farmers Cash Advance)
//   ProducerReceipt, Bank / UPI / Cheque → Journal (Dr Bank / Cr Farmers Cash Advance)
//
// Anything that already has a real Voucher (Advance referenced by a voucher,
// ProducerReceipt with voucherId) is skipped, so nothing is listed twice.
// Recoveries deducted in the milk bill already post their own Journal voucher
// (createRecoveryVoucher) and are not repeated here.

export const CASH_ADVANCE_REF = 'CashAdvance';

const dayEndOf = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T23:59:59.999Z`) : new Date(d));
const dayStartOf = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00.000Z`) : new Date(d));

const farmerLabel = (f) => {
  const name = f?.personalDetails?.name || f?.farmerName || '';
  const no = f?.farmerNumber || '';
  return [no, name].filter(Boolean).join(' - ') || 'Producer';
};

/**
 * @param {string|ObjectId} companyIdRaw
 * @param {{ startDate?: string|Date, endDate?: string|Date, voucherTypes?: string[] }} opts
 *   voucherTypes: any of 'Payment', 'Receipt', 'Journal' (default all)
 * @returns {Promise<object[]>} voucher-shaped, read-only rows (isVirtual: true)
 */
export const getCashAdvanceVoucherRows = async (companyIdRaw, { startDate, endDate, voucherTypes } = {}) => {
  if (!companyIdRaw) return [];
  const companyId = new mongoose.Types.ObjectId(String(companyIdRaw));
  const want = new Set(voucherTypes?.length ? voucherTypes : ['Payment', 'Receipt', 'Journal']);
  const needAdvances = want.has('Payment') || want.has('Journal');
  const needReceipts = want.has('Receipt') || want.has('Journal');

  const dateRange = {};
  if (startDate) dateRange.$gte = startDate instanceof Date ? startDate : dayStartOf(startDate);
  if (endDate) dateRange.$lte = endDate instanceof Date ? endDate : dayEndOf(endDate);
  const hasRange = Object.keys(dateRange).length > 0;

  const [advances, receipts, ledgers] = await Promise.all([
    needAdvances ? Advance.find({
      companyId,
      advanceCategory: 'Cash Advance',
      advanceAmount: { $gt: 0 },
      status: { $ne: 'Cancelled' },
      ...(hasRange ? { advanceDate: dateRange } : {})
    }).populate('farmerId', 'farmerNumber personalDetails').lean() : [],
    needReceipts ? ProducerReceipt.find({
      companyId,
      receiptType: 'Cash Advance',
      amount: { $gt: 0 },
      status: { $ne: 'Cancelled' },
      $or: [{ voucherId: { $exists: false } }, { voucherId: null }],
      ...(hasRange ? { receiptDate: dateRange } : {})
    }).populate('farmerId', 'farmerNumber personalDetails').lean() : [],
    Ledger.find({ companyId, ledgerType: { $in: ['Cash', 'Cash in Hand', 'Bank', 'Bank Accounts'] } })
      .select('ledgerName ledgerType status createdAt').sort({ createdAt: 1 }).lean()
  ]);
  if (!advances.length && !receipts.length) return [];

  // Skip advances that already have a real voucher pointing at them
  const advIds = advances.map(a => a._id);
  const posted = advIds.length
    ? await Voucher.find({ companyId, referenceId: { $in: advIds }, status: { $ne: 'Cancelled' } }).select('referenceId').lean()
    : [];
  const postedSet = new Set(posted.map(v => String(v.referenceId)));

  const advLedger = await Ledger.findOne({ companyId, ledgerName: { $regex: /^farmers?\s*cash\s*advance$/i } })
    .select('ledgerName ledgerType').lean();
  const advHead = { _id: advLedger?._id || null, ledgerName: advLedger?.ledgerName || 'Farmers Cash Advance', ledgerType: advLedger?.ledgerType || 'Other Receivable' };

  const cashLedgers = ledgers.filter(l => ['Cash', 'Cash in Hand'].includes(l.ledgerType));
  const activeCash = cashLedgers.filter(l => l.status !== 'Inactive');
  const cashL = activeCash.find(l => /^cash\s*in\s*hand$/i.test((l.ledgerName || '').trim())) || activeCash[0] || cashLedgers[0];
  const cashHead = { _id: cashL?._id || null, ledgerName: cashL?.ledgerName || 'Cash in Hand', ledgerType: cashL?.ledgerType || 'Cash' };
  const bankLedgers = ledgers.filter(l => ['Bank', 'Bank Accounts'].includes(l.ledgerType));
  const bankByName = (name) => bankLedgers.find(l => l.ledgerName === name);
  const defaultBank = bankLedgers.find(l => l.status !== 'Inactive') || bankLedgers[0];
  const bankHead = (name) => {
    const l = (name && bankByName(name)) || defaultBank;
    return { _id: l?._id || null, ledgerName: name || l?.ledgerName || 'Bank', ledgerType: l?.ledgerType || 'Bank' };
  };

  const leg = (head, dr, cr, narration) => ({
    ledgerId: head._id ? { _id: head._id, ledgerName: head.ledgerName, ledgerType: head.ledgerType } : null,
    ledgerName: head.ledgerName,
    debitAmount: dr,
    creditAmount: cr,
    narration,
    isCashLeg: head === cashHead
  });

  const rows = [];

  for (const a of advances) {
    if (postedSet.has(String(a._id))) continue;
    const isCash = (a.paymentMode || 'Cash') === 'Cash';
    const type = isCash ? 'Payment' : 'Journal';
    if (!want.has(type)) continue;
    const amt = Number(a.advanceAmount) || 0;
    const who = farmerLabel(a.farmerId);
    const narration = `Cash Advance to ${who}${a.purpose ? ` — ${a.purpose}` : ''}${isCash ? '' : ` (${a.paymentMode})`}`;
    const contra = isCash ? cashHead : bankHead(null);
    rows.push({
      _id: `cashadv-${a._id}`,
      voucherNumber: a.advanceNumber || `ADV-${String(a._id).slice(-6)}`,
      voucherDate: a.advanceDate,
      voucherType: type,
      entries: [leg(advHead, amt, 0, narration), leg(contra, 0, amt, narration)],
      totalDebit: amt,
      totalCredit: amt,
      narration,
      status: 'Posted',
      referenceType: CASH_ADVANCE_REF,
      referenceId: a._id,
      referenceNumber: a.advanceNumber,
      paymentMode: a.paymentMode || 'Cash',
      farmerId: a.farmerId?._id || a.farmerId,
      farmerNumber: a.farmerId?.farmerNumber || '',
      farmerName: a.farmerId?.personalDetails?.name || '',
      createdAt: a.createdAt,
      isVirtual: true
    });
  }

  for (const r of receipts) {
    const isCash = (r.paymentMode || 'Cash') === 'Cash';
    const type = isCash ? 'Receipt' : 'Journal';
    if (!want.has(type)) continue;
    const amt = Number(r.amount) || 0;
    const who = farmerLabel(r.farmerId);
    const narration = `Cash Advance Recovery — ${who}${isCash ? '' : ` (${r.paymentMode})`}`;
    const contra = isCash ? cashHead : bankHead(r.bankLedgerName);
    rows.push({
      _id: `cashadvrec-${r._id}`,
      voucherNumber: r.receiptNumber || `PREC-${String(r._id).slice(-6)}`,
      voucherDate: r.receiptDate,
      voucherType: type,
      entries: [leg(contra, amt, 0, narration), leg(advHead, 0, amt, narration)],
      totalDebit: amt,
      totalCredit: amt,
      narration,
      status: 'Posted',
      referenceType: CASH_ADVANCE_REF,
      referenceId: r._id,
      referenceNumber: r.receiptNumber,
      paymentMode: r.paymentMode || 'Cash',
      farmerId: r.farmerId?._id || r.farmerId,
      farmerNumber: r.farmerId?.farmerNumber || '',
      farmerName: r.farmerId?.personalDetails?.name || '',
      createdAt: r.createdAt,
      isVirtual: true
    });
  }

  rows.sort((x, y) => new Date(x.voucherDate) - new Date(y.voucherDate)
    || new Date(x.createdAt || 0) - new Date(y.createdAt || 0));
  return rows;
};
