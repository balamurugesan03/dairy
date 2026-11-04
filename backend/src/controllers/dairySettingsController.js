import DairySettings from '../models/DairySettings.js';
import { syncCashOpeningFromSettings } from '../utils/cashInHandOpening.js';

// ── GET settings (returns existing or creates defaults) ──────────────────────
export const getSettings = async (req, res) => {
  try {
    const settings = await DairySettings.getOrCreate(req.companyId);
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPSERT settings ──────────────────────────────────────────────────────────
export const upsertSettings = async (req, res) => {
  try {
    const {
      paymentDays,
      paymentFromDate,
      accountStartDate,
      accountStartDateOpeningBalance,
      accountStartDateOpeningBalanceType,
      financialYearOpeningBalance,
      financialYearOpeningBalanceType,
    } = req.body;

    const update = { lastUpdatedBy: req.user?.displayName || req.company?.companyName || 'System' };

    if (paymentDays !== undefined)                         update.paymentDays = paymentDays;
    if (paymentFromDate !== undefined)                     update.paymentFromDate = paymentFromDate || null;
    if (accountStartDate !== undefined)                    update.accountStartDate = accountStartDate || null;
    if (accountStartDateOpeningBalance !== undefined)      update.accountStartDateOpeningBalance = accountStartDateOpeningBalance;
    if (accountStartDateOpeningBalanceType !== undefined)  update.accountStartDateOpeningBalanceType = accountStartDateOpeningBalanceType;
    if (financialYearOpeningBalance !== undefined)         update.financialYearOpeningBalance = financialYearOpeningBalance;
    if (financialYearOpeningBalanceType !== undefined)     update.financialYearOpeningBalanceType = financialYearOpeningBalanceType;

    const settings = await DairySettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    // Account Settings opening is THE Cash in Hand opening. Copy it onto the
    // primary Cash in Hand ledger (either cash ledger type; prefers the one named
    // "Cash in Hand") so every accounting report shows the same figure. The old
    // lookup only matched ledgerType 'Cash' and silently skipped 'Cash in Hand'.
    await syncCashOpeningFromSettings(req.companyId);

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
