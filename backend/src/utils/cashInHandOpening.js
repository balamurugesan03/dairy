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

// ─── Account Settings → Cash in Hand opening (single source) ─────────────────
// Accounts → Payment and Settings → Account Settings → "Account Start Date
// Opening Balance" is THE Cash in Hand opening. It is written onto the primary
// Cash in Hand ledger, which every report reads (Day Book, Cash Book, Cash Book
// Entry, General Ledger, Ledger Abstract, R&D, Final Accounts, Balance Sheet).

/** The society's main cash ledger: named "Cash in Hand" first, then any active cash ledger. */
export const getPrimaryCashLedger = async (companyIdRaw) => {
  const companyId = new mongoose.Types.ObjectId(String(companyIdRaw));
  const cashLedgers = await Ledger.find({ companyId, ledgerType: { $in: ['Cash', 'Cash in Hand'] } })
    .sort({ createdAt: 1 });
  return cashLedgers.find(l => /^cash\s*in\s*hand$/i.test((l.ledgerName || '').trim()) && l.status !== 'Inactive')
    || cashLedgers.find(l => l.status !== 'Inactive')
    || cashLedgers[0]
    || null;
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
export const ensureCashOpeningSynced = async (req, res, next) => {
  try { await syncCashOpeningFromSettings(req.companyId); } catch (e) { console.error('Cash opening sync:', e.message); }
  next();
};
