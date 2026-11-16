import mongoose from 'mongoose';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';
import { getDefaultVoucherType } from './balanceCalculator.js';

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

// ─── Account Settings → Cash in Hand opening (single source) ─────────────────
// Accounts → Payment and Settings → Account Settings → "Account Start Date
// Opening Balance" is THE Cash in Hand opening. It is written onto the primary
// Cash in Hand ledger, which every report reads (Day Book, Cash Book, Cash Book
// Entry, General Ledger, Ledger Abstract, R&D, Final Accounts, Balance Sheet).

export const CASH_LEDGER_TYPES = ['Cash', 'Cash in Hand'];
// Names that all mean the society's one cash account ("Cash in Hand", "CASH IN HAND", "Cash")
export const CASH_IN_HAND_NAME_RE = /^cash(\s*in\s*hand)?$/i;
export const isCashInHandName = (name) => CASH_IN_HAND_NAME_RE.test(String(name || '').trim());

/** The society's main cash ledger: named "Cash in Hand" first, then any active cash ledger. */
export const getPrimaryCashLedger = async (companyIdRaw, session = null) => {
  const companyId = new mongoose.Types.ObjectId(String(companyIdRaw));
  let q = Ledger.find({ companyId, ledgerType: { $in: CASH_LEDGER_TYPES } }).sort({ createdAt: 1, _id: 1 });
  if (session) q = q.session(session);
  const cashLedgers = await q;
  return cashLedgers.find(l => /^cash\s*in\s*hand$/i.test((l.ledgerName || '').trim()) && l.status !== 'Inactive')
    || cashLedgers.find(l => l.status !== 'Inactive')
    || cashLedgers[0]
    || null;
};

// ─── The ONE place a Cash in Hand ledger may be created ──────────────────────
// Every posting path (sales, purchases, bank transfer, bonus, incentive,
// transport, share capital, admission fee …) resolves its cash leg here.
// The old per-module lookups matched only ledgerType 'Cash' (or the exact
// name 'Cash in Hand'), so a society whose cash ledger was typed 'Cash in
// Hand' — or named in capitals — got a second "Cash in Hand" ledger
// auto-created on the next cash posting. That was the duplicate.
const creating = new Map(); // companyId → in-flight create (same-process race guard)

export const getOrCreateCashLedger = async (companyIdRaw, session = null) => {
  if (!companyIdRaw) throw new Error('companyId is required to resolve the Cash in Hand ledger');
  const existing = await getPrimaryCashLedger(companyIdRaw, session);
  if (existing) return existing;

  const key = String(companyIdRaw);
  if (!creating.has(key)) {
    creating.set(key, (async () => {
      try {
        const again = await getPrimaryCashLedger(companyIdRaw, session);
        if (again) return again;
        const ledger = new Ledger({
          ledgerName: 'Cash in Hand',
          ledgerType: 'Cash',
          parentGroup: 'ASSET',
          openingBalance: 0,
          openingBalanceType: 'Dr',
          currentBalance: 0,
          balanceType: 'Dr',
          voucherType: getDefaultVoucherType('Cash'),
          status: 'Active',
          companyId: new mongoose.Types.ObjectId(key),
        });
        if (session) await ledger.save({ session }); else await ledger.save();
        return ledger;
      } finally {
        creating.delete(key);
      }
    })());
  }
  const created = await creating.get(key);
  // Pick up the Account Settings opening on the freshly created ledger
  try { await syncCashOpeningFromSettings(companyIdRaw); } catch { /* never block a posting */ }
  return (await getPrimaryCashLedger(companyIdRaw, session)) || created;
};

// ─── Merge duplicate Cash in Hand ledgers (one-time repair, idempotent) ──────
// Every cash-typed ledger NAMED "Cash in Hand" / "Cash" (any case) is the same
// account. All but the primary are folded into the primary:
//   • every reference (voucher entries, stock-transaction ledger entries,
//     payment-ledger fields) is re-pointed to the primary — amounts untouched;
//   • one opening is kept (Account Settings when saved, else the primary's,
//     else a duplicate's) — copies are never added together;
//   • the now-unreferenced duplicate ledger record is removed.
// Differently named cash ledgers (e.g. "Petty Cash") are left alone.
const LEDGER_REF_FIELDS = [
  // [model name, field] — single ObjectId fields that may hold the cash ledger
  ['ProducerLoan', 'bankLedgerId'],
  ['Payroll', 'bankLedgerId'],
  ['ProducerPayment', 'bankLedgerId'],
  ['TransportBill', 'bankLedgerId'],
  ['FarmerPayment', 'bankLedgerId'],
  ['BonusRegister', 'bankLedgerId'],
  ['IncentiveRegister', 'bankLedgerId'],
  ['KarurPaymentRegister', 'bankLedgerId'],
  ['Farmer', 'bankLedgerId'],
];

const signedDr = (amount, type) => (type === 'Cr' ? -1 : 1) * (Number(amount) || 0);

export const mergeDuplicateCashLedgers = async (companyIdRaw) => {
  if (!companyIdRaw) return { merged: 0 };
  const companyId = new mongoose.Types.ObjectId(String(companyIdRaw));
  const primary = await getPrimaryCashLedger(companyId);
  // Only fold into a ledger that is itself the Cash in Hand account
  if (!primary || !isCashInHandName(primary.ledgerName)) return { merged: 0 };

  const all = await Ledger.find({ companyId, ledgerType: { $in: CASH_LEDGER_TYPES } }).lean();
  const dups = all.filter(l => String(l._id) !== String(primary._id) && isCashInHandName(l.ledgerName));
  if (!dups.length) return { merged: 0 };
  const dupIds = dups.map(d => d._id);

  // 1. Voucher entries → primary (ledgerId + its denormalised name)
  await Voucher.collection.updateMany(
    { companyId, 'entries.ledgerId': { $in: dupIds } },
    { $set: { 'entries.$[e].ledgerId': primary._id, 'entries.$[e].ledgerName': primary.ledgerName } },
    { arrayFilters: [{ 'e.ledgerId': { $in: dupIds } }] }
  );

  // 2. Stock-transaction ledger entries
  const StockTransaction = mongoose.models.StockTransaction;
  if (StockTransaction) {
    await StockTransaction.collection.updateMany(
      { companyId, 'ledgerEntries.ledgerId': { $in: dupIds } },
      { $set: { 'ledgerEntries.$[e].ledgerId': primary._id } },
      { arrayFilters: [{ 'e.ledgerId': { $in: dupIds } }] }
    );
  }

  // 3. Single ledger-reference fields on other documents
  for (const [modelName, path] of LEDGER_REF_FIELDS) {
    const M = mongoose.models[modelName];
    if (!M) continue;
    await M.collection.updateMany({ [path]: { $in: dupIds } }, { $set: { [path]: primary._id } });
  }

  // 4. ONE opening for the account — never the sum of the copies (a duplicate
  //    usually repeats the same opening; adding them doubled the Cash in Hand
  //    opening in Day Book / Cash Book). The primary's own opening is kept;
  //    if it is 0, the first non-zero duplicate's. A saved Account Settings
  //    value overrides both in step 6. currentBalance keeps every posting
  //    (they are distinct transactions) plus that one opening.
  const ledgersAll = [primary, ...dups];
  const chosen = ledgersAll.find(l => (Number(l.openingBalance) || 0) !== 0) || primary;
  const opening = signedDr(chosen.openingBalance, chosen.openingBalanceType);
  const postings = ledgersAll.reduce((s, l) =>
    s + signedDr(l.currentBalance, l.balanceType) - signedDr(l.openingBalance, l.openingBalanceType), 0);
  const current = postings + opening;
  await Ledger.updateOne({ _id: primary._id }, { $set: {
    openingBalance: Math.abs(opening), openingBalanceType: opening < 0 ? 'Cr' : 'Dr',
    currentBalance: Math.abs(current), balanceType: current < 0 ? 'Cr' : 'Dr',
    ...(primary.status === 'Inactive' ? { status: 'Active' } : {}),
  } });

  // 5. Remove the duplicates — nothing references them any more
  await Ledger.deleteMany({ _id: { $in: dupIds }, companyId });

  // 6. One opening value everywhere: a saved Account Settings value wins;
  //    if Account Settings was never saved, it takes the folded ledger value
  //    so Payment Settings shows what the reports already showed.
  const synced = await syncCashOpeningFromSettings(companyId);
  if (!synced) {
    const fresh = await Ledger.findById(primary._id);
    if (fresh) await syncSettingsFromCashLedger(fresh);
  }
  return { merged: dups.length, primaryId: primary._id };
};

/** Run the merge for every company that has more than one Cash in Hand ledger. */
export const mergeDuplicateCashLedgersAllCompanies = async () => {
  const groups = await Ledger.aggregate([
    { $match: { ledgerType: { $in: CASH_LEDGER_TYPES }, ledgerName: { $regex: CASH_IN_HAND_NAME_RE } } },
    { $group: { _id: '$companyId', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  let merged = 0;
  for (const g of groups) {
    try { merged += (await mergeDuplicateCashLedgers(g._id)).merged; }
    catch (e) { console.error(`Cash in Hand merge failed for company ${g._id}:`, e.message); }
  }
  return merged;
};

/**
 * Copy the Account Settings opening onto the primary cash ledger when they differ.
 * Only once the settings have been saved by a user (lastUpdatedBy) — a never-saved
 * default 0 must not wipe an opening entered on the ledger itself.
 */
export const syncCashOpeningFromSettings = async (companyIdRaw) => {
  if (!companyIdRaw) return null;
  const { default: DairySettings } = await import('../models/DairySettings.js');
  const settings = await DairySettings.findOne({ companyId: companyIdRaw }).lean();
  if (!settings?.lastUpdatedBy) return null;
  const ledger = await getPrimaryCashLedger(companyIdRaw);
  if (!ledger) return null;
  const amount = Number(settings.accountStartDateOpeningBalance) || 0;
  const type = settings.accountStartDateOpeningBalanceType || 'Dr';
  if ((ledger.openingBalance || 0) !== amount || (ledger.openingBalanceType || 'Dr') !== type) {
    await Ledger.updateOne({ _id: ledger._id }, { $set: { openingBalance: amount, openingBalanceType: type } });
  }
  return ledger;
};

/** The reverse: the primary cash ledger's opening was edited (Ledger / Ledger Abstract). */
export const syncSettingsFromCashLedger = async (ledger) => {
  if (!ledger?.companyId || !['Cash', 'Cash in Hand'].includes(ledger.ledgerType)) return;
  const primary = await getPrimaryCashLedger(ledger.companyId);
  if (!primary || String(primary._id) !== String(ledger._id)) return;
  const { default: DairySettings } = await import('../models/DairySettings.js');
  await DairySettings.updateOne(
    { companyId: ledger.companyId },
    { $set: {
      accountStartDateOpeningBalance: Number(ledger.openingBalance) || 0,
      accountStartDateOpeningBalanceType: ledger.openingBalanceType || 'Dr',
      lastUpdatedBy: 'Ledger opening balance'
    } },
    { upsert: true }
  );
};

/** Express middleware for the accounting reports — never blocks the report. */
const mergedCompanies = new Set(); // duplicate check once per company per process
export const ensureCashLedgersMerged = async (companyId) => {
  const key = String(companyId || '');
  if (!key || mergedCompanies.has(key)) return;
  await mergeDuplicateCashLedgers(companyId);
  mergedCompanies.add(key);
};

export const ensureCashOpeningSynced = async (req, res, next) => {
  try {
    await ensureCashLedgersMerged(req.companyId);
    await syncCashOpeningFromSettings(req.companyId);
  } catch (e) { console.error('Cash opening sync:', e.message); }
  next();
};
