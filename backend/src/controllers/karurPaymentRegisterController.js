/**
 * Producer Dues → Regional Payment Bar Report → Payment Register (Karur, Tamil Nadu)
 * ─────────────────────────────────────────────────────────────────────────────
 * Pays a SETTLED payment cycle in Cash or through a Bank ledger.
 *
 *  • Cycle     — the cycles saved in Payment Register (settled) / Detailed
 *                (same register Bank Transfer reads); before any is saved the
 *                cycle comes from Payment Settings (paymentFromDate + days).
 *  • Amounts   — previous balance, milk, deductions and net payable are read
 *                from the saved register entries as they are. Nothing is
 *                recalculated, so they always match the settled register.
 *  • Producers — Centre Code + Farmer Number (C1-001), sorted centre-wise,
 *                then by farmer number. Bank details from Farmer Management.
 *  • Save      — pays each producer's FarmerPayment of the cycle and posts ONE
 *                Payment voucher Dr PRODUCERS DUES / Cr Cash in Hand | bank
 *                ledger (referenceType 'BankTransfer' — the Producer Dues
 *                payment convention the Day Book / Cash Book / GL already use).
 *  • Duplicates — a producer already paid for the cycle (here, by Bank
 *                Transfer or by Payment to Producer) is never paid again.
 */
import { loadPayees, PAYEE_SELECT } from '../utils/farmerPayee.js';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import KarurPaymentRegister from '../models/KarurPaymentRegister.js';
import MilkCollection from '../models/MilkCollection.js';
import PaymentRegister from '../models/PaymentRegister.js';
import FarmerPayment from '../models/FarmerPayment.js';
import ProducerPayment from '../models/ProducerPayment.js';
import Farmer from '../models/Farmer.js';
import CollectionCenter from '../models/CollectionCenter.js';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';
import DairySettings from '../models/DairySettings.js';
import { generateCode } from '../models/Counter.js';
import { createProducerDuesPaymentVoucher, updateLedgerBalances } from '../utils/accountingHelper.js';
import { computeCycleFromMilkPurchase } from './milkBillController.js';

const DAY = 86400000;
const BANK_LEDGER_TYPES = ['Bank', 'Bank Accounts', 'Bank Account'];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const companyOf = (req) => oid(req.companyId || req.userCompany);
const around = (d) => { const t = new Date(d).getTime(); return { $gte: new Date(t - 2 * DAY), $lte: new Date(t + 2 * DAY) }; };
const norm = (s) => String(s || '').trim().toLowerCase();
const fmtD = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '');
const userName = (req) => req.user?.name || req.user?.username || req.user?.companyName || req.user?.email || '';

class HttpError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}
const fail = (res, err, label) => {
  if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message, data: err.data });
  console.error(`karurPaymentRegister ${label}:`, err);
  return res.status(500).json({ success: false, message: err.message });
};

// Centre code order: C1 < C2 < C10; producers without a centre last
const codeRank = (code) => {
  const m = /^([A-Za-z]*)(\d+)$/.exec(String(code || '').trim());
  return m ? [0, m[1].toUpperCase(), Number(m[2])] : [code ? 1 : 2, String(code || ''), 0];
};
const cmpRows = (a, b) => {
  const ra = codeRank(a.centerCode), rb = codeRank(b.centerCode);
  for (let i = 0; i < 3; i++) {
    if (ra[i] < rb[i]) return -1;
    if (ra[i] > rb[i]) return 1;
  }
  return String(a.farmerNumber).localeCompare(String(b.farmerNumber), undefined, { numeric: true });
};
const producerIdOf = (centerCode, farmerNumber) => {
  const num = String(farmerNumber || '').trim();
  const padded = /^\d+$/.test(num) ? num.padStart(3, '0') : num;
  return centerCode ? `${centerCode}-${padded}` : padded;
};

// Saved register entry → the deduction columns of this report.
// Total Deductions = Milk Value + Previous Balance − Net Payable, i.e. exactly what the
// register deducted, so every row adds up. The named columns come from the register; "Other"
// is the rest. (A Producers register does not deduct its 'deductions' field from Net Pay, so
// adding it — as before — overstated Total Deductions; Ledger registers net their earnings.)
const entryAmounts = (e, type) => {
  const isLedger = type === 'Ledger';
  const welfare     = r2(e.welfare);
  const loanRec     = r2(isLedger ? e.loanRec : e.loanAdv);
  const advance     = r2(e.cfRec);
  const cashAdvance = r2(isLedger ? e.cashRec : e.cashPocket);
  const milkValue       = r2(e.milkValue);
  const previousBalance = r2(e.previousBalance);
  const netPayable      = r2(e.netPay);
  const totalDeductions = r2(milkValue + previousBalance - netPayable);
  const otherRec        = r2(totalDeductions - (welfare + loanRec + advance + cashAdvance));
  return {
    previousBalance,
    qty:             r2(e.qty),
    milkValue,
    welfare, loanRec, advance, cashAdvance, otherRec,
    totalDeductions,
    netPayable,
  };
};

/**
 * Milk Purchase quantity / value per farmer for the cycle (IST days, as Milk Purchase saves them).
 * @returns Map<farmerId, { qty, amount }>
 */
const milkPurchaseOf = async (companyId, fromDate, toDate, farmerIds) => {
  const start = new Date(fromDate); start.setHours(0, 0, 0, 0);
  const end = new Date(toDate); end.setHours(23, 59, 59, 999);
  const agg = await MilkCollection.aggregate([
    { $match: { companyId, farmer: { $in: farmerIds.map(oid) }, date: { $gte: start, $lte: end } } },
    { $group: { _id: '$farmer', qty: { $sum: '$qty' }, amount: { $sum: '$amount' } } },
  ]);
  return new Map(agg.map((a) => [String(a._id), { qty: r2(a.qty), amount: r2(a.amount) }]));
};

// Saved settled register of a cycle (newest update wins — same as Bank Transfer)
const findSourceRegister = (companyId, fromDate, toDate) => PaymentRegister.findOne({
  companyId,
  registerType: { $in: ['Producers', 'Ledger'] },
  status:       { $in: ['Saved', 'Printed'] },
  fromDate:     around(fromDate),
  toDate:       around(toDate),
}).sort({ updatedAt: -1 }).lean();

/**
 * Producers already paid for the cycle by any payment path.
 * @returns Map<farmerId, string> — where it was paid
 */
const paidElsewhere = async (companyId, source, excludeRegisterId) => {
  const paid = new Map();
  const karur = await KarurPaymentRegister.find({
    companyId,
    status: 'Saved',
    $or: [
      ...(source._id ? [{ sourceRegisterId: source._id }] : []),
      { fromDate: around(source.fromDate), toDate: around(source.toDate) },
    ],
    ...(excludeRegisterId ? { _id: { $ne: excludeRegisterId } } : {}),
  }).select('registerNumber paymentType entries.farmerId').lean();
  karur.forEach((k) => k.entries.forEach((e) => paid.set(String(e.farmerId), `Payment Register (Karur) ${k.registerNumber} — ${k.paymentType}`)));

  const bt = await FarmerPayment.find({
    companyId,
    status: 'Paid',
    'paymentPeriod.fromDate': around(source.fromDate),
    'paymentPeriod.toDate':   around(source.toDate),
    $or: [{ paymentSource: 'BankTransfer' }, { bankTransferId: { $ne: null } }],
  }).select('farmerId').lean();
  bt.forEach((p) => p.farmerId && !paid.has(String(p.farmerId)) && paid.set(String(p.farmerId), 'Bank Transfer'));

  const ptp = await ProducerPayment.find({
    companyId,
    status: { $ne: 'Cancelled' },
    'processingPeriod.fromDate': around(source.fromDate),
    'processingPeriod.toDate':   around(source.toDate),
  }).select('farmerId refNo').lean();
  ptp.forEach((p) => p.farmerId && !paid.has(String(p.farmerId)) && paid.set(String(p.farmerId), 'Payment to Producer'));
  return paid;
};

/**
 * Build the register rows for a cycle + filters (used by Generate and Save,
 * so what is saved is always the server's figures, never the browser's).
 */
const buildRows = async (companyId, { fromDate, toDate, paymentType, centerId, bank, cashScope, excludeRegisterId }) => {
  if (!fromDate || !toDate) throw new HttpError(400, 'Payment cycle From Date and To Date are required');
  if (!['Cash', 'Bank'].includes(paymentType)) throw new HttpError(400, 'Select the Payment Type (Cash or Bank)');

  let source = await findSourceRegister(companyId, fromDate, toDate);
  if (!source) {
    // Not settled yet → provisional figures straight from Milk Purchase (every
    // entry dated inside the cycle). Preview / print only: paying waits for the
    // settled register, which creates the FarmerPayments this register pays.
    const live = await computeCycleFromMilkPurchase(companyId, fromDate, toDate);
    source = {
      _id: null,
      registerType: 'MilkPurchase',
      provisional: true,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      entries: live.map(({ farmer, summary: s }) => ({
        farmerId: farmer._id,
        previousBalance: s.previousBalance,
        qty: s.totalMilkQty,
        milkValue: s.totalMilkAmt,
        cfRec: r2(s.totalCattleFeed),                      // cattle feed sold in the cycle
        cashPocket: s.totalPayments,                       // paid during the cycle
        deductions: r2(s.totalDeductions),                 // individual deductions
        netPay: s.netAmount,
      })),
    };
  }

  const farmerIds = [...new Set(source.entries.filter((e) => e.farmerId).map((e) => String(e.farmerId)))];
  const farmers = await Farmer.find({ companyId, _id: { $in: farmerIds.map(oid) } })
    .select(PAYEE_SELECT + ' collectionCenter')
    .populate('collectionCenter', 'centerCode centerName')
    .lean();
  const farmerMap = new Map(farmers.map((f) => [String(f._id), f]));
  // Account each farmer is paid into: own Primary / Secondary, or the parent's (Parent Grouping)
  const { payeeOf } = await loadPayees(companyId, farmers);
  const paid = await paidElsewhere(companyId, source, excludeRegisterId);
  // Milk Purchase for the cycle — a settled register saved before later milk entries / rate
  // changes would otherwise show stale quantities without anyone noticing
  const purchase = await milkPurchaseOf(companyId, source.fromDate, source.toDate, farmerIds);


  const rows = [];
  const alreadyPaid = [];
  const skipped = { notPayable: 0, otherCentre: 0, noBankAccount: 0, hasBankAccount: 0, otherBank: 0, noFarmer: 0 };
  const bankNames = new Map();
  const seen = new Set();

  for (const e of source.entries) {
    const fid = e.farmerId ? String(e.farmerId) : '';
    if (!fid || seen.has(fid)) continue;
    seen.add(fid);
    const f = farmerMap.get(fid);
    if (!f) { skipped.noFarmer += 1; continue; }

    const centre = f.collectionCenter || null;
    const centerCode = centre?.centerCode || '';
    const payee = payeeOf(f);
    const bd = payee.bank;
    const row = {
      farmerId:      fid,
      payKey:        `${fid}|${source._id}`,
      centerId:      centre?._id ? String(centre._id) : null,
      centerCode,
      centerName:    centre?.centerName || '',
      farmerNumber:  f.farmerNumber || e.productId || e.producerId || '',
      producerId:    producerIdOf(centerCode, f.farmerNumber || e.productId || e.producerId),
      producerName:  f.personalDetails?.name || e.productName || e.producerName || '',
      ...entryAmounts(e, source.registerType),
      ...(() => {
        const mp = purchase.get(fid) || { qty: 0, amount: 0 };
        const mismatch = Math.abs(mp.qty - r2(e.qty)) > 0.01 || Math.abs(mp.amount - r2(e.milkValue)) > 0.5;

        return { purchaseQty: mp.qty, purchaseAmount: mp.amount, milkMismatch: mismatch };
      })(),
      bankName:      (bd.bankName || '').trim(),
      accountNumber: (bd.accountNumber || '').trim(),
      ifsc:          (bd.ifsc || '').trim().toUpperCase(),
      branch:        (bd.branch || '').trim(),
      bankAccount:   payee.account,
      viaParent:     payee.viaParent,
      holderNumber:  payee.viaParent ? payee.holderNumber : '',
      holderName:    payee.viaParent ? payee.holderName : '',
    };

    if (centerId && centerId !== 'all' && row.centerId !== String(centerId)) { skipped.otherCentre += 1; continue; }
    if (row.bankName) bankNames.set(norm(row.bankName), row.bankName);
    if (row.netPayable <= 0) { skipped.notPayable += 1; continue; }
    if (paid.has(fid)) { alreadyPaid.push({ producerId: row.producerId, producerName: row.producerName, netPayable: row.netPayable, paidBy: paid.get(fid) }); continue; }

    if (paymentType === 'Bank') {
      if (!row.accountNumber) { skipped.noBankAccount += 1; continue; }
      if (bank && norm(bank) !== norm(row.bankName)) { skipped.otherBank += 1; continue; }
    } else if (cashScope !== 'all' && row.accountNumber) {
      skipped.hasBankAccount += 1;
      continue;
    }
    rows.push(row);
  }

  rows.sort(cmpRows);
  alreadyPaid.sort((a, b) => a.producerId.localeCompare(b.producerId, undefined, { numeric: true }));
  return {
    source: {
      _id: source._id, registerType: source.registerType, fromDate: source.fromDate, toDate: source.toDate,
      provisional: !!source.provisional,
    },
    rows,
    alreadyPaid,
    skipped,
    banks: [...bankNames.values()].sort((a, b) => a.localeCompare(b)),
    milkCheck: { mismatches: rows.filter((r) => r.milkMismatch).length },
  };
};

const resolveBankLedger = async (companyId, paymentType, bankLedgerId) => {
  if (paymentType !== 'Bank') return null;
  if (!bankLedgerId || !mongoose.isValidObjectId(bankLedgerId)) throw new HttpError(400, 'Select the Bank Ledger');
  const ledger = await Ledger.findOne({ _id: bankLedgerId, companyId, ledgerType: { $in: BANK_LEDGER_TYPES } }).lean();
  if (!ledger) throw new HttpError(400, 'The selected Bank Ledger was not found under Accounts → Ledgers');
  return ledger;
};

const validateHeader = (body) => {
  const { paymentType, paymentDate, chequeNumber } = body;
  if (!paymentDate || Number.isNaN(new Date(paymentDate).getTime())) throw new HttpError(400, 'Enter the Payment Date');
  if (paymentType === 'Bank' && !String(chequeNumber || '').trim()) throw new HttpError(400, 'Enter the Cheque Number for the Bank payment');
};

// ── Posting: pay the cycle's FarmerPayments + one Payment voucher ────────────
const postRegister = async (reg, req) => {
  const companyId = reg.companyId;
  const isBank = reg.paymentType === 'Bank';

  if (reg.totalAmount > 0) {
    const narration = [
      `Payment Register (Karur) ${reg.registerNumber}`,
      `${fmtD(reg.fromDate)}–${fmtD(reg.toDate)}`,
      `${reg.paymentType} | ${reg.producerCount} producer(s)`,
      reg.centerLabel && reg.centerLabel !== 'All Centers' ? reg.centerLabel : '',
      isBank && reg.chequeNumber ? `Cheque No ${reg.chequeNumber}` : '',
      isBank && reg.chequeDetails ? reg.chequeDetails : '',
    ].filter(Boolean).join(' | ');
    const voucher = await createProducerDuesPaymentVoucher({
      amount:        reg.totalAmount,
      paymentDate:   reg.paymentDate,
      paymentMode:   isBank ? 'Bank' : 'Cash',
      bankLedgerId:  reg.bankLedgerId,
      companyId,
      narration,
      referenceType: 'BankTransfer',
      referenceId:   reg._id,
      createdBy:     req.user?._id,
    });
    if (voucher) {
      await Voucher.updateOne({ _id: voucher._id }, { $set: { referenceNumber: reg.registerNumber } });
      reg.voucherId = voucher._id;
      reg.voucherNumber = voucher.voucherNumber;
    }
  }

  for (const e of reg.entries) {
    const fp = await FarmerPayment.findOne({
      companyId,
      farmerId: e.farmerId,
      status:   { $in: ['Pending', 'Partial'] },
      paymentSource: { $ne: 'BankTransfer' },
      'paymentPeriod.fromDate': around(reg.fromDate),
      'paymentPeriod.toDate':   around(reg.toDate),
    }).sort({ createdAt: -1 });
    if (!fp) continue;
    const outstanding = fp.balanceAmount > 0 ? fp.balanceAmount : fp.netPayable - (fp.paidAmount || 0);
    const apply = r2(Math.max(0, Math.min(e.netPayable, outstanding)));
    if (apply <= 0) continue;
    e.farmerPaymentId = fp._id;
    e.appliedAmount = apply;
    e.fpPrev = { paymentMode: fp.paymentMode, bankLedgerId: fp.bankLedgerId || null, voucherId: fp.voucherId || null };
    fp.paidAmount = r2((fp.paidAmount || 0) + apply);
    fp.paymentMode = isBank ? 'Bank' : 'Cash';
    if (isBank) {
      fp.bankLedgerId = reg.bankLedgerId;
      fp.bankDetails = {
        ...(fp.bankDetails || {}),
        bankName: e.bankName, accountNumber: e.accountNumber, ifscCode: e.ifsc,
        chequeNumber: reg.chequeNumber, chequeDate: reg.paymentDate,
      };
    }
    // voucherId keeps the Cash Book from listing this payment a second time
    if (reg.voucherId) fp.voucherId = reg.voucherId;
    await fp.save();   // pre-save recomputes balanceAmount + status
  }
};

// Undo postRegister: give back the FarmerPayment amounts, remove the voucher
const unpostRegister = async (reg) => {
  for (const e of reg.entries) {
    if (!e.farmerPaymentId || !e.appliedAmount) continue;
    const fp = await FarmerPayment.findById(e.farmerPaymentId);
    if (!fp || fp.status === 'Cancelled') continue;
    fp.paidAmount = r2(Math.max(0, (fp.paidAmount || 0) - e.appliedAmount));
    if (e.fpPrev?.paymentMode) fp.paymentMode = e.fpPrev.paymentMode;
    if (String(fp.voucherId || '') === String(reg.voucherId || '')) fp.voucherId = e.fpPrev?.voucherId || undefined;
    if (reg.paymentType === 'Bank') fp.bankLedgerId = e.fpPrev?.bankLedgerId || undefined;
    await fp.save();
    e.farmerPaymentId = undefined;
    e.appliedAmount = 0;
  }
  const vouchers = await Voucher.find({ companyId: reg.companyId, referenceType: 'BankTransfer', referenceId: reg._id });
  for (const v of vouchers) {
    const reversed = (v.entries || []).map((x) => ({
      ledgerId: x.ledgerId, ledgerName: x.ledgerName, debitAmount: x.creditAmount || 0, creditAmount: x.debitAmount || 0,
    }));
    if (reversed.length) await updateLedgerBalances(reversed, null, reg.companyId);
    await Voucher.deleteOne({ _id: v._id });
  }
  reg.voucherId = null;
  reg.voucherNumber = '';
};

const pickRows = (rows, farmerIds) => {
  if (!Array.isArray(farmerIds)) return rows;
  const want = new Set(farmerIds.map(String));
  return rows.filter((r) => want.has(r.farmerId));
};

const toEntries = (rows) => rows.map((r) => ({
  ...r,
  farmerId: oid(r.farmerId),
  centerId: r.centerId ? oid(r.centerId) : undefined,
}));

const centreLabel = async (companyId, centerId) => {
  if (!mongoose.isValidObjectId(centerId)) return 'All Centers';
  const c = await CollectionCenter.findOne({ _id: centerId, companyId }).select('centerCode centerName').lean();
  return c ? [c.centerCode, c.centerName].filter(Boolean).join(' - ') : 'Centre';
};

const dupError = (err) => err?.code === 11000
  ? new HttpError(409, 'One or more producers were just paid for this cycle in another register. Generate again to see the current list.')
  : err;

// ═════════════════════════════════════════════════════════════════════════════
//  GET /karur-payment-register/options
// ═════════════════════════════════════════════════════════════════════════════
export const getOptions = async (req, res) => {
  try {
    const companyId = companyOf(req);
    const [settings, registers, centres, bankLedgers, banks, paidRuns] = await Promise.all([
      DairySettings.findOne({ companyId }).lean(),
      PaymentRegister.find({ companyId, registerType: { $in: ['Producers', 'Ledger'] }, status: { $in: ['Saved', 'Printed'] } })
        .select('fromDate toDate registerType updatedAt totalNetPay entries.farmerId').sort({ fromDate: -1, updatedAt: -1 }).limit(120).lean(),
      CollectionCenter.find({ companyId }).select('centerCode centerName').lean(),
      Ledger.find({ companyId, ledgerType: { $in: BANK_LEDGER_TYPES }, status: { $ne: 'Inactive' } }).select('ledgerName').sort({ ledgerName: 1 }).lean(),
      Promise.all([
        Farmer.distinct('bankDetails.bankName', { companyId, 'bankDetails.bankName': { $nin: [null, ''] } }),
        Farmer.distinct('secondaryBankDetails.bankName', { companyId, 'secondaryBankDetails.bankName': { $nin: [null, ''] } }),
      ]).then(([a, b]) => [...new Set([...a, ...b])]),
      KarurPaymentRegister.find({ companyId, status: 'Saved' }).select('sourceRegisterId producerCount').lean(),
    ]);

    // One cycle per period (newest saved register of it), newest cycle first
    const paidBySource = {};
    paidRuns.forEach((k) => { paidBySource[k.sourceRegisterId] = (paidBySource[k.sourceRegisterId] || 0) + (k.producerCount || 0); });
    const cycles = [];
    const keyOf = (d) => Math.round(new Date(d).getTime() / DAY);
    for (const r of registers) {
      if (cycles.some((c) => Math.abs(c._f - keyOf(r.fromDate)) <= 2 && Math.abs(c._t - keyOf(r.toDate)) <= 2)) continue;
      cycles.push({
        _f: keyOf(r.fromDate), _t: keyOf(r.toDate),
        sourceRegisterId: r._id, registerType: r.registerType,
        fromDate: r.fromDate, toDate: r.toDate,
        producers: r.entries?.length || 0,
        paidProducers: paidBySource[r._id] || 0,
      });
    }
    cycles.forEach((c) => { delete c._f; delete c._t; });

    // Active cycle: newest settled cycle; before any is saved, Payment Settings
    const paymentDays = settings?.paymentDays || 15;
    let settingsCycle = null;
    if (settings?.paymentFromDate) {
      const f = new Date(settings.paymentFromDate);
      settingsCycle = { fromDate: f, toDate: new Date(f.getTime() + (paymentDays - 1) * DAY) };
    }
    // Cycles not settled yet: after the newest settled cycle (or from Payment
    // Settings) in steps of the cycle length, up to the cycle running today.
    // Generate reads these straight from Milk Purchase.
    const pendingCycles = [];
    {
      const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
      let f = cycles[0] ? dayStart(new Date(cycles[0].toDate).getTime() + DAY) : settingsCycle ? dayStart(settingsCycle.fromDate) : null;
      if (f && settingsCycle && dayStart(settingsCycle.fromDate) > f) f = dayStart(settingsCycle.fromDate);
      const today = dayStart(new Date());
      while (f && f <= today && pendingCycles.length < 12) {
        const t = dayStart(f.getTime() + (paymentDays - 1) * DAY + DAY / 2);
        if (!cycles.some((c) => Math.abs(keyOf(c.fromDate) - keyOf(f)) <= 2 && Math.abs(keyOf(c.toDate) - keyOf(t)) <= 2)) {
          pendingCycles.push({ fromDate: f, toDate: t });
        }
        f = dayStart(t.getTime() + DAY + DAY / 2);
      }
      pendingCycles.reverse();                    // newest first
    }

    const activeCycle = cycles[0]
      ? { fromDate: cycles[0].fromDate, toDate: cycles[0].toDate, source: 'settled' }
      : settingsCycle ? { ...settingsCycle, source: 'settings' } : null;

    centres.sort((a, b) => cmpRows({ centerCode: a.centerCode, farmerNumber: '' }, { centerCode: b.centerCode, farmerNumber: '' }));
    res.json({
      success: true,
      data: {
        paymentDays,
        settingsCycle,
        activeCycle,
        cycles,
        pendingCycles,
        centres: centres.map((c) => ({ _id: c._id, centerCode: c.centerCode || '', centerName: c.centerName || '' })),
        bankLedgers: bankLedgers.map((l) => ({ _id: l._id, ledgerName: l.ledgerName })),
        banks: [...banks.reduce((m, b) => (m.has(norm(b)) ? m : m.set(norm(b), String(b).trim())), new Map()).values()]
          .sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (err) { fail(res, err, 'getOptions'); }
};

// ═════════════════════════════════════════════════════════════════════════════
//  POST /karur-payment-register/generate
// ═════════════════════════════════════════════════════════════════════════════
export const generate = async (req, res) => {
  try {
    const companyId = companyOf(req);
    const data = await buildRows(companyId, { ...req.body, excludeRegisterId: req.body.editId || null });
    res.json({ success: true, data });
  } catch (err) { fail(res, err, 'generate'); }
};

// ═════════════════════════════════════════════════════════════════════════════
//  POST /karur-payment-register — Save (pay + post)
// ═════════════════════════════════════════════════════════════════════════════
export const createRegister = async (req, res) => {
  const companyId = companyOf(req);
  let reg = null;
  try {
    const b = req.body;
    validateHeader(b);
    const ledger = await resolveBankLedger(companyId, b.paymentType, b.bankLedgerId);
    const built = await buildRows(companyId, b);
    if (built.source.provisional) {
      throw new HttpError(400,
        `${fmtD(b.fromDate)} – ${fmtD(b.toDate)} is not settled yet — the figures shown are provisional from Milk Purchase. `
        + 'Save the cycle in Producer Dues → Payments → Payment Register (settled), then Generate and Save here.');
    }
    const rows = pickRows(built.rows, b.farmerIds);
    if (!rows.length) throw new HttpError(400, 'No payable producers to save for this selection');
    if (Array.isArray(b.farmerIds) && rows.length < new Set(b.farmerIds.map(String)).size) {
      throw new HttpError(409, 'Some producers in the grid were paid meanwhile or are no longer payable. Generate again before saving.');
    }

    reg = new KarurPaymentRegister({
      companyId,
      registerNumber:     await generateCode('KPR', companyId),
      fromDate:           built.source.fromDate,
      toDate:             built.source.toDate,
      sourceRegisterId:   built.source._id,
      sourceRegisterType: built.source.registerType,
      paymentType:        b.paymentType,
      paymentDate:        new Date(b.paymentDate),
      centerId:           mongoose.isValidObjectId(b.centerId) ? oid(b.centerId) : null,
      centerLabel:        await centreLabel(companyId, b.centerId),
      bankFilter:         b.paymentType === 'Bank' ? (b.bank || '') : '',
      cashScope:          b.cashScope === 'all' ? 'all' : 'withoutBank',
      bankLedgerId:       ledger?._id || null,
      bankLedgerName:     ledger?.ledgerName || '',
      chequeNumber:       b.paymentType === 'Bank' ? String(b.chequeNumber || '').trim() : '',
      chequeDetails:      b.paymentType === 'Bank' ? String(b.chequeDetails || '').trim() : '',
      remarks:            String(b.remarks || '').trim(),
      entries:            toEntries(rows),
      createdBy:          req.user?._id,
      audit: [{
        action: 'Created', by: req.user?._id, byName: userName(req),
        details: `${b.paymentType} payment of ${rows.length} producer(s), ₹${r2(rows.reduce((s, r) => s + r.netPayable, 0)).toFixed(2)}`,
      }],
    });
    try { await reg.save(); } catch (e) { reg = null; throw dupError(e); }   // unique index = duplicate guard

    try {
      await postRegister(reg, req);
      await reg.save();
    } catch (postErr) {
      await unpostRegister(reg).catch(() => {});
      await KarurPaymentRegister.deleteOne({ _id: reg._id });
      throw postErr;
    }
    res.status(201).json({ success: true, data: reg, message: `Saved ${reg.registerNumber} — ${reg.producerCount} producer(s), voucher ${reg.voucherNumber || '-'}` });
  } catch (err) { fail(res, err, 'create'); }
};

// ═════════════════════════════════════════════════════════════════════════════
//  GET /karur-payment-register — Payment Log
// ═════════════════════════════════════════════════════════════════════════════
export const listRegisters = async (req, res) => {
  try {
    const companyId = companyOf(req);
    const { fromDate, toDate, paymentType, status } = req.query;
    const filter = { companyId };
    if (fromDate && toDate) { filter.fromDate = around(fromDate); filter.toDate = around(toDate); }
    if (paymentType) filter.paymentType = paymentType;
    if (status) filter.status = status;
    const list = await KarurPaymentRegister.find(filter)
      .select('-entries.fpPrev -entries.payKey')
      .sort({ createdAt: -1 }).limit(300).lean();
    res.json({ success: true, data: list });
  } catch (err) { fail(res, err, 'list'); }
};

export const getRegister = async (req, res) => {
  try {
    const reg = await KarurPaymentRegister.findOne({ _id: req.params.id, companyId: companyOf(req) }).lean();
    if (!reg) return res.status(404).json({ success: false, message: 'Payment register not found' });
    reg.entries.sort(cmpRows);
    res.json({ success: true, data: reg });
  } catch (err) { fail(res, err, 'get'); }
};

// ═════════════════════════════════════════════════════════════════════════════
//  PUT /karur-payment-register/:id — Edit (re-pays with the new details)
//  Payment Type / Centre / Bank filter define the register and stay as saved;
//  date, bank ledger, cheque, remarks and the producer list can change.
// ═════════════════════════════════════════════════════════════════════════════
export const updateRegister = async (req, res) => {
  try {
    const companyId = companyOf(req);
    const reg = await KarurPaymentRegister.findOne({ _id: req.params.id, companyId });
    if (!reg) throw new HttpError(404, 'Payment register not found');
    if (reg.status !== 'Saved') throw new HttpError(400, 'A cancelled register cannot be edited');

    const b = { ...req.body, paymentType: reg.paymentType };
    validateHeader(b);
    const ledger = await resolveBankLedger(companyId, reg.paymentType, b.bankLedgerId);
    const built = await buildRows(companyId, {
      fromDate: reg.fromDate, toDate: reg.toDate, paymentType: reg.paymentType,
      centerId: reg.centerId ? String(reg.centerId) : 'all', bank: reg.bankFilter, cashScope: reg.cashScope,
      excludeRegisterId: reg._id,
    });
    const farmerIds = Array.isArray(b.farmerIds) ? b.farmerIds : reg.entries.map((e) => String(e.farmerId));
    const rows = pickRows(built.rows, farmerIds);
    if (!rows.length) throw new HttpError(400, 'Keep at least one producer — use Cancel to withdraw the whole register');
    if (rows.length < new Set(farmerIds.map(String)).size) {
      throw new HttpError(409, 'Some producers were paid elsewhere or are no longer payable. Reload the register and try again.');
    }

    // Audit: what changed
    const before = {
      paymentDate: fmtD(reg.paymentDate), bankLedgerName: reg.bankLedgerName, chequeNumber: reg.chequeNumber,
      chequeDetails: reg.chequeDetails, remarks: reg.remarks, total: reg.totalAmount,
    };
    const oldIds = new Set(reg.entries.map((e) => String(e.farmerId)));
    const newIds = new Set(rows.map((r) => r.farmerId));
    const oldById = new Map(reg.entries.map((e) => [String(e.farmerId), e]));
    const changes = [];
    const after = {
      paymentDate: fmtD(b.paymentDate), bankLedgerName: ledger?.ledgerName || '',
      chequeNumber: reg.paymentType === 'Bank' ? String(b.chequeNumber || '').trim() : '',
      chequeDetails: reg.paymentType === 'Bank' ? String(b.chequeDetails || '').trim() : '',
      remarks: String(b.remarks || '').trim(),
    };
    const LABEL = { paymentDate: 'Payment Date', bankLedgerName: 'Bank Ledger', chequeNumber: 'Cheque No', chequeDetails: 'Cheque Details', remarks: 'Remarks' };
    Object.keys(after).forEach((k) => { if ((before[k] || '') !== (after[k] || '')) changes.push(`${LABEL[k]}: "${before[k] || '-'}" → "${after[k] || '-'}"`); });
    const removed = reg.entries.filter((e) => !newIds.has(String(e.farmerId))).map((e) => e.producerId);
    const added = rows.filter((r) => !oldIds.has(r.farmerId)).map((r) => r.producerId);
    const amountChanged = rows.filter((r) => oldById.has(r.farmerId) && r2(oldById.get(r.farmerId).netPayable) !== r.netPayable).map((r) => r.producerId);
    if (removed.length) changes.push(`Removed: ${removed.join(', ')}`);
    if (added.length) changes.push(`Added: ${added.join(', ')}`);
    if (amountChanged.length) changes.push(`Amount refreshed from settled register: ${amountChanged.join(', ')}`);

    const original = {
      entries: reg.entries.map((e) => e.toObject()),
      paymentDate: reg.paymentDate, bankLedgerId: reg.bankLedgerId, bankLedgerName: reg.bankLedgerName,
      chequeNumber: reg.chequeNumber, chequeDetails: reg.chequeDetails, remarks: reg.remarks,
    };
    await unpostRegister(reg);
    original.entries.forEach((e) => { e.farmerPaymentId = undefined; e.appliedAmount = 0; });
    const restore = async () => {      // put the saved payment back as it was
      Object.assign(reg, original);
      reg.markModified('entries');
      await postRegister(reg, req);
      await reg.save();
    };
    reg.paymentDate = new Date(b.paymentDate);
    reg.bankLedgerId = ledger?._id || null;
    reg.bankLedgerName = after.bankLedgerName;
    reg.chequeNumber = after.chequeNumber;
    reg.chequeDetails = after.chequeDetails;
    reg.remarks = after.remarks;
    reg.entries = toEntries(rows);
    reg.markModified('entries');
    try {
      await reg.save();
      await postRegister(reg, req);
    } catch (e) {
      await unpostRegister(reg).catch(() => {});
      await restore().catch((re) => console.error('karur edit restore failed:', re.message));
      throw dupError(e);
    }
    const newTotal = r2(reg.entries.reduce((s, e) => s + (e.netPayable || 0), 0));
    if (r2(before.total) !== newTotal) changes.push(`Total: ₹${r2(before.total).toFixed(2)} → ₹${newTotal.toFixed(2)}`);
    reg.audit.push({ action: 'Edited', by: req.user?._id, byName: userName(req), details: changes.join('; ') || 'Saved again without changes' });
    await reg.save();
    res.json({ success: true, data: reg, message: `${reg.registerNumber} updated` });
  } catch (err) { fail(res, err, 'update'); }
};

// ═════════════════════════════════════════════════════════════════════════════
//  POST /karur-payment-register/:id/cancel — keeps the record, reverses posting
// ═════════════════════════════════════════════════════════════════════════════
export const cancelRegister = async (req, res) => {
  try {
    const reg = await KarurPaymentRegister.findOne({ _id: req.params.id, companyId: companyOf(req) });
    if (!reg) throw new HttpError(404, 'Payment register not found');
    if (reg.status === 'Cancelled') throw new HttpError(400, 'Already cancelled');
    await unpostRegister(reg);
    reg.status = 'Cancelled';
    reg.audit.push({ action: 'Cancelled', by: req.user?._id, byName: userName(req), details: String(req.body?.reason || '').trim().slice(0, 300) || 'Cancelled' });
    reg.markModified('entries');
    await reg.save();
    res.json({ success: true, data: reg, message: `${reg.registerNumber} cancelled — payments and voucher reversed` });
  } catch (err) { fail(res, err, 'cancel'); }
};

// ═════════════════════════════════════════════════════════════════════════════
//  POST /karur-payment-register/email  { to, cc, subject, message, attachments }
// ═════════════════════════════════════════════════════════════════════════════
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const ALLOWED_TYPES = { 'application/pdf': '.pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx' };
const splitEmails = (v) => String(v || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const emailReport = async (req, res) => {
  try {
    const to = splitEmails(req.body.to);
    const cc = splitEmails(req.body.cc);
    if (!to.length) throw new HttpError(400, 'Enter the recipient email address');
    const bad = [...to, ...cc].filter((e) => !EMAIL_RE.test(e));
    if (bad.length) throw new HttpError(400, `Invalid email address: ${bad.join(', ')}`);
    if (to.length + cc.length > 10) throw new HttpError(400, 'Up to 10 recipients');

    const list = Array.isArray(req.body.attachments) ? req.body.attachments.slice(0, 2) : [];
    if (!list.length) throw new HttpError(400, 'Attach the PDF and/or the Excel file');
    let bytes = 0;
    const attachments = list.map((a) => {
      const ext = ALLOWED_TYPES[a?.contentType];
      if (!ext || typeof a.contentBase64 !== 'string') throw new HttpError(400, 'Only PDF and Excel attachments are allowed');
      const content = Buffer.from(a.contentBase64, 'base64');
      bytes += content.length;
      let filename = String(a.filename || `Payment_Register${ext}`).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
      if (!filename.toLowerCase().endsWith(ext)) filename += ext;
      return { filename, content, contentType: a.contentType };
    });
    if (bytes > 24 * 1024 * 1024) throw new HttpError(413, 'Attachments are larger than 24 MB');

    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
      throw new HttpError(500, 'SMTP not configured. Please update SMTP_USER and SMTP_PASS in .env file.');
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const subject = String(req.body.subject || 'Payment Register (Karur, Tamil Nadu)').slice(0, 200);
    const message = String(req.body.message || '').slice(0, 5000);
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Dairy Society ERP'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: to.join(', '),
      ...(cc.length ? { cc: cc.join(', ') } : {}),
      subject,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
        ${message ? `<p>${escHtml(message).replace(/\n/g, '<br/>')}</p>` : '<p>Please find the Payment Register attached.</p>'}
        <p style="color:#888;font-size:12px">Attached: ${attachments.map((a) => escHtml(a.filename)).join(', ')}</p></div>`,
      attachments,
    });
    res.json({ success: true, message: `Email sent to ${to.join(', ')}` });
  } catch (err) {
    if (err instanceof HttpError) return fail(res, err, 'email');
    res.status(500).json({ success: false, message: `Email could not be sent: ${err.message}` });
  }
};

// Used by the other payment paths so they never pay a producer paid here
export const karurPaidFarmerIds = async (companyId, fromDate, toDate) => {
  const regs = await KarurPaymentRegister.find({
    companyId: oid(companyId), status: 'Saved', fromDate: around(fromDate), toDate: around(toDate),
  }).select('entries.farmerId').lean();
  return new Set(regs.flatMap((r) => r.entries.map((e) => String(e.farmerId))));
};
