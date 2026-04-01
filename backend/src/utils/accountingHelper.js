import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Item from '../models/Item.js';
import { getNextSequence } from '../models/Counter.js';

const VOUCHER_PREFIX_MAP = {
  'Receipt':         'RV',
  'Payment':         'PV',
  'Journal':         'JV',
  'Contra':          'CT',
  'Purchase':        'PUR',
  'MilkPurchase':    'MKP',
  'MilkSales':       'MKS',
  'FarmerPayment':   'FPY',
  'LoanDisbursal':   'LDN',
  'AdvancePayment':  'ADV',
  'OpeningBalance':  'OPB',
};

// Generate voucher number — atomic, conflict-free for 100+ concurrent users
export const generateVoucherNumber = async (voucherType, companyId = null) => {
  const prefix = VOUCHER_PREFIX_MAP[voucherType] || 'VCH';
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const pattern = `${prefix}${yy}${mm}`;
  const seq = await getNextSequence(`voucher-${pattern}-${companyId || 'global'}`, 0);
  return `${pattern}${seq.toString().padStart(4, '0')}`;
};

// Helper: get Indian financial year string from a date
export const getFinancialYear = (date) => {
  const d = new Date(date || Date.now());
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed
  return month >= 4
    ? `${String(year).slice(-2)}${String(year + 1).slice(-2)}`   // Apr–Mar next year
    : `${String(year - 1).slice(-2)}${String(year).slice(-2)}`;  // Jan–Mar same year
};

// Create accounting voucher for dairy sales transaction
export const createSalesVoucher = async (saleData, session = null) => {
  const entries = [];
  const grandTotal  = parseFloat(saleData.grandTotal)  || 0;
  const paidAmount  = parseFloat(saleData.paidAmount)  || 0;
  const balanceAmount = Math.max(0, grandTotal - paidAmount);

  // ── Helper: find customer/farmer ledger ──────────────────────────────────
  const findCustomerLedger = async () => {
    if (!saleData.customerId) return null;
    // Try farmer-linked first, then customer-linked
    const linked = await Ledger.findOne({
      'linkedEntity.entityId': saleData.customerId,
      ...(saleData.companyId && { companyId: saleData.companyId })
    });
    if (linked) return linked;
    // Fall back to generic trade debtors ledger (auto-create)
    let debtors = await Ledger.findOne({
      ledgerName: 'Trade Debtors',
      ...(saleData.companyId && { companyId: saleData.companyId })
    });
    if (!debtors) {
      debtors = new Ledger({
        ledgerName: 'Trade Debtors',
        ledgerType: 'Party',
        openingBalance: 0,
        currentBalance: 0,
        balanceType: 'Dr',
        companyId: saleData.companyId
      });
      if (session) await debtors.save({ session }); else await debtors.save();
    }
    return debtors;
  };

  // ── Credit: Sales ledger (always) ────────────────────────────────────────
  let salesLedger = await Ledger.findOne({
    ledgerName: 'Sales',
    ledgerType: 'Income',
    ...(saleData.companyId && { companyId: saleData.companyId })
  });
  if (!salesLedger) {
    salesLedger = new Ledger({
      ledgerName: 'Sales',
      ledgerType: 'Income',
      openingBalance: 0,
      currentBalance: 0,
      balanceType: 'Cr',
      companyId: saleData.companyId
    });
    if (session) await salesLedger.save({ session }); else await salesLedger.save();
  }
  entries.push({ ledgerId: salesLedger._id, ledgerName: salesLedger.ledgerName, debitAmount: 0, creditAmount: grandTotal });

  // ── Debit: Cash/Bank for the paid portion ────────────────────────────────
  if (paidAmount > 0) {
    const paymentLedgerType = saleData.paymentMode === 'Cash' ? 'Cash' : 'Bank';
    let paymentLedger = await Ledger.findOne({
      ledgerType: paymentLedgerType,
      ...(saleData.companyId && { companyId: saleData.companyId })
    });
    if (!paymentLedger) {
      paymentLedger = new Ledger({
        ledgerName: paymentLedgerType === 'Cash' ? 'Cash in Hand' : 'Bank Account',
        ledgerType: paymentLedgerType,
        openingBalance: 0,
        currentBalance: 0,
        balanceType: 'Dr',
        companyId: saleData.companyId
      });
      if (session) await paymentLedger.save({ session }); else await paymentLedger.save();
    }
    entries.push({ ledgerId: paymentLedger._id, ledgerName: paymentLedger.ledgerName, debitAmount: paidAmount, creditAmount: 0 });
  }

  // ── Debit: Customer ledger for the unpaid balance ────────────────────────
  if (balanceAmount > 0) {
    const customerLedger = await findCustomerLedger();
    if (customerLedger) {
      entries.push({ ledgerId: customerLedger._id, ledgerName: customerLedger.ledgerName, debitAmount: balanceAmount, creditAmount: 0 });
    } else {
      // No customer ledger at all — put entire balance to cash to keep voucher balanced
      entries[entries.length - 1].debitAmount += balanceAmount;
    }
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('Journal', saleData.companyId);

  const voucher = new Voucher({
    voucherType: 'Journal',
    voucherNumber,
    voucherDate: saleData.billDate,
    entries,
    totalDebit,
    totalCredit,
    narration: `Sales — Bill No: ${saleData.billNumber}`,
    referenceType: 'Sales',
    referenceId: saleData._id,
    companyId: saleData.companyId
  });

  if (session) await voucher.save({ session });
  else await voucher.save();

  await updateLedgerBalances(entries, session, saleData.companyId);

  return voucher;
};

// Nature-aware ledger balance update for dairy Ledger model
export const updateLedgerBalances = async (entries, session = null, companyId = null) => {
  // Ledger types that are debit-normal (debit increases balance)
  const debitNormalTypes = [
    'Asset', 'Expense', 'Cash', 'Bank', 'Other Receivable', 'Party',
    'Fixed Assets', 'Movable Assets', 'Immovable Assets', 'Other Assets',
    'Purchases A/c', 'Trade Expenses', 'Establishment Charges', 'Miscellaneous Expenses',
    'Investment A/c', 'Other Investment', 'Government Securities'
  ];
  // Ledger types that are credit-normal (credit increases balance)
  const creditNormalTypes = [
    'Liability', 'Income', 'Capital', 'Other Payable',
    'Sales A/c', 'Trade Income', 'Miscellaneous Income', 'Other Revenue',
    'Grants & Aid', 'Subsidies', 'Accounts Due To (Sundry Creditors)',
    'Other Liabilities', 'Deposit A/c', 'Contingency Fund', 'Education Fund',
    'Share Capital', 'Profit & Loss A/c'
  ];

  for (const entry of entries) {
    const ledger = await Ledger.findById(entry.ledgerId);
    if (!ledger) continue;

    const netChange = (entry.debitAmount || 0) - (entry.creditAmount || 0);

    if (debitNormalTypes.includes(ledger.ledgerType)) {
      // Debit normal: debit increases (+), credit decreases (-)
      ledger.currentBalance += netChange;
      ledger.balanceType = ledger.currentBalance >= 0 ? 'Dr' : 'Cr';
    } else if (creditNormalTypes.includes(ledger.ledgerType)) {
      // Credit normal: credit increases (+), debit decreases (-)
      ledger.currentBalance -= netChange;
      ledger.balanceType = ledger.currentBalance >= 0 ? 'Cr' : 'Dr';
    }

    if (session) await ledger.save({ session });
    else await ledger.save();
  }
};

// Create farmer payment voucher
export const createPaymentVoucher = async (paymentData, session = null) => {
  const entries = [];
  const farmerId = paymentData.farmerId;
  const companyId = paymentData.companyId;

  // Debit: farmer payable ledger
  const farmerLedger = await Ledger.findOne({
    'linkedEntity.entityType': 'Farmer',
    'linkedEntity.entityId': farmerId,
    ...(companyId && { companyId })
  });

  const paidAmt = paymentData.paidAmount || 0;

  if (farmerLedger) {
    entries.push({
      ledgerId: farmerLedger._id,
      ledgerName: farmerLedger.ledgerName,
      debitAmount: paidAmt,
      creditAmount: 0
    });
  }

  // Credit: Cash/Bank
  const paymentLedgerType = paymentData.paymentMode === 'Cash' ? 'Cash' : 'Bank';
  const paymentLedger = await Ledger.findOne({
    ledgerType: paymentLedgerType,
    ...(companyId && { companyId })
  });

  if (paymentLedger) {
    entries.push({
      ledgerId: paymentLedger._id,
      ledgerName: paymentLedger.ledgerName,
      debitAmount: 0,
      creditAmount: paidAmt
    });
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('FarmerPayment', companyId);

  const voucher = new Voucher({
    voucherType: 'FarmerPayment',
    voucherNumber,
    voucherDate: paymentData.paymentDate,
    entries,
    totalDebit,
    totalCredit,
    narration: `Farmer payment — ${farmerLedger?.ledgerName || farmerId}`,
    referenceType: 'FarmerPayment',
    referenceId: paymentData._id,
    ...(companyId && { companyId })
  });

  if (session) await voucher.save({ session });
  else await voucher.save();

  await updateLedgerBalances(entries, session, companyId);

  return voucher;
};

// Create purchase voucher for stock-in transactions
export const createPurchaseVoucher = async (purchaseData, session = null) => {
  const entries = [];
  const companyId = purchaseData.companyId;

  const itemsWithLedgers = await Item.find({
    _id: { $in: purchaseData.items.map(i => i.itemId) }
  }).populate('purchaseLedger');

  const ledgerGroups = {};
  let totalGst = 0;

  for (const purchaseItem of purchaseData.items) {
    const item = itemsWithLedgers.find(i => i._id.toString() === purchaseItem.itemId.toString());
    if (!item) continue;

    const gstPercent = item.gstPercent || 0;
    const itemTotal = purchaseItem.quantity * purchaseItem.rate;
    // Back-calculate base amount from total (if rate includes GST)
    const baseAmount = gstPercent > 0 ? itemTotal / (1 + gstPercent / 100) : itemTotal;
    const gstAmount = itemTotal - baseAmount;

    totalGst += gstAmount;

    const ledgerId = item.purchaseLedger?._id;
    const ledgerName = item.purchaseLedger?.ledgerName || 'Purchase';

    if (ledgerId) {
      if (!ledgerGroups[ledgerId]) {
        ledgerGroups[ledgerId] = { ledgerId, ledgerName, amount: 0 };
      }
      ledgerGroups[ledgerId].amount += baseAmount;
    }
  }

  // Debit: purchase ledgers
  for (const group of Object.values(ledgerGroups)) {
    entries.push({
      ledgerId: group.ledgerId,
      ledgerName: group.ledgerName,
      debitAmount: group.amount,
      creditAmount: 0
    });
  }

  // Debit: GST Input
  if (totalGst > 0) {
    const gstLedger = await Ledger.findOne({
      ledgerName: 'GST Input',
      ...(companyId && { companyId })
    });
    if (gstLedger) {
      entries.push({
        ledgerId: gstLedger._id,
        ledgerName: gstLedger.ledgerName,
        debitAmount: totalGst,
        creditAmount: 0
      });
    }
  }

  const totalAmount = purchaseData.totalAmount || 0;
  const paidAmount = purchaseData.paidAmount || 0;
  const balanceAmount = totalAmount - paidAmount;

  // Credit: cash if paid
  if (paidAmount > 0) {
    const cashLedger = await Ledger.findOne({
      ledgerType: 'Cash',
      ...(companyId && { companyId })
    });
    if (cashLedger) {
      entries.push({
        ledgerId: cashLedger._id,
        ledgerName: cashLedger.ledgerName,
        debitAmount: 0,
        creditAmount: paidAmount
      });
    }
  }

  // Credit: supplier for unpaid balance
  if (balanceAmount > 0 || purchaseData.paymentMode === 'Adjustment') {
    const supplierLedger = await Ledger.findOne({
      'linkedEntity.entityType': 'Supplier',
      'linkedEntity.entityId': purchaseData.supplierId,
      ...(companyId && { companyId })
    });
    if (supplierLedger) {
      const creditAmount = purchaseData.paymentMode === 'Adjustment' ? totalAmount : balanceAmount;
      entries.push({
        ledgerId: supplierLedger._id,
        ledgerName: supplierLedger.ledgerName,
        debitAmount: 0,
        creditAmount: creditAmount
      });
    }
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('Purchase', companyId);
  const narration = purchaseData.invoiceNumber
    ? `Purchase from ${purchaseData.supplierName} — Invoice ${purchaseData.invoiceNumber}`
    : `Purchase from ${purchaseData.supplierName || 'Supplier'}`;

  const voucher = new Voucher({
    voucherType: 'Purchase',
    voucherNumber,
    voucherDate: purchaseData.purchaseDate || new Date(),
    entries,
    totalDebit,
    totalCredit,
    narration,
    referenceType: 'Purchase',
    referenceId: purchaseData.referenceId,
    ...(companyId && { companyId })
  });

  if (session) await voucher.save({ session });
  else await voucher.save();

  await updateLedgerBalances(entries, session, companyId);

  return voucher;
};

// Find or create a ledger by name and type
export const findOrCreateLedger = async (ledgerName, ledgerType, parentGroup, balanceType, companyId, session) => {
  let ledger = await Ledger.findOne({ ledgerName, companyId });
  if (!ledger) {
    ledger = new Ledger({
      ledgerName,
      ledgerType,
      parentGroup,
      openingBalance: 0,
      currentBalance: 0,
      balanceType,
      status: 'Active',
      companyId
    });
    if (session) await ledger.save({ session }); else await ledger.save();
  }
  return ledger;
};

// Create share capital journal voucher (called from addShareToFarmer)
export const createShareCapitalVoucher = async (data, session = null) => {
  const { farmerId, farmerLedgerName, totalValue, transactionType, resolutionNo, companyId, voucherDate } = data;

  const shareCapitalLedger = await findOrCreateLedger(
    'Share Capital', 'Share Capital', 'Capital', 'Cr', companyId, session
  );

  // Cash ledger — debit on allotment (cash received), credit on redemption (cash paid out)
  let cashLedger = await Ledger.findOne({ ledgerType: 'Cash', companyId });
  if (!cashLedger) {
    cashLedger = await findOrCreateLedger('Cash in Hand', 'Cash', 'Cash', 'Dr', companyId, session);
  }

  const isRedemption = transactionType === 'Redemption';
  // Allotment:  Dr Cash  /  Cr Share Capital
  // Redemption: Dr Share Capital  /  Cr Cash
  const entries = [
    {
      ledgerId: isRedemption ? shareCapitalLedger._id : cashLedger._id,
      ledgerName: isRedemption ? shareCapitalLedger.ledgerName : cashLedger.ledgerName,
      debitAmount: totalValue,
      creditAmount: 0
    },
    {
      ledgerId: isRedemption ? cashLedger._id : shareCapitalLedger._id,
      ledgerName: isRedemption ? cashLedger.ledgerName : shareCapitalLedger.ledgerName,
      debitAmount: 0,
      creditAmount: totalValue
    }
  ];

  const voucherNumber = await generateVoucherNumber('Receipt', companyId);
  const narration = `Share Capital — ${farmerLedgerName} | ${transactionType} | Resolution: ${resolutionNo} | Amount: ₹${totalValue}`;

  const voucher = new Voucher({
    voucherType: 'Receipt',
    voucherNumber,
    voucherDate: voucherDate || new Date(),
    entries,
    totalDebit: totalValue,
    totalCredit: totalValue,
    narration,
    referenceType: 'ShareCapital',
    referenceId: farmerId,
    companyId
  });

  if (session) await voucher.save({ session }); else await voucher.save();
  await updateLedgerBalances(entries, session, companyId);
  return voucher;
};

// Create admission fee journal voucher (called from createFarmer)
export const createAdmissionFeeVoucher = async (data, session = null) => {
  const { farmerId, farmerLedgerName, admissionFee, companyId, voucherDate } = data;

  const admissionFeeLedger = await findOrCreateLedger(
    'Admission Fee', 'Miscellaneous Income', 'Income', 'Cr', companyId, session
  );

  // Cash received for admission fee
  let cashLedger = await Ledger.findOne({ ledgerType: 'Cash', companyId });
  if (!cashLedger) {
    cashLedger = await findOrCreateLedger('Cash in Hand', 'Cash', 'Cash', 'Dr', companyId, session);
  }

  // Dr: Cash  /  Cr: Admission Fee
  const entries = [
    {
      ledgerId: cashLedger._id,
      ledgerName: cashLedger.ledgerName,
      debitAmount: admissionFee,
      creditAmount: 0
    },
    {
      ledgerId: admissionFeeLedger._id,
      ledgerName: admissionFeeLedger.ledgerName,
      debitAmount: 0,
      creditAmount: admissionFee
    }
  ];

  const voucherNumber = await generateVoucherNumber('Receipt', companyId);
  const narration = `Admission Fee — ${farmerLedgerName} | Amount: ₹${admissionFee}`;

  const voucher = new Voucher({
    voucherType: 'Receipt',
    voucherNumber,
    voucherDate: voucherDate || new Date(),
    entries,
    totalDebit: admissionFee,
    totalCredit: admissionFee,
    narration,
    referenceType: 'AdmissionFee',
    referenceId: farmerId,
    companyId
  });

  if (session) await voucher.save({ session }); else await voucher.save();
  await updateLedgerBalances(entries, session, companyId);
  return voucher;
};

// Reverse ledger balances (used when deleting/cancelling a voucher)
export const reverseLedgerBalances = async (entries, session = null, companyId = null) => {
  const reversed = entries.map(e => ({
    ...e,
    debitAmount: e.creditAmount,
    creditAmount: e.debitAmount
  }));
  return updateLedgerBalances(reversed, session, companyId);
};

export default {
  generateVoucherNumber,
  getFinancialYear,
  createSalesVoucher,
  updateLedgerBalances,
  reverseLedgerBalances,
  createPaymentVoucher,
  createPurchaseVoucher,
  createShareCapitalVoucher,
  createAdmissionFeeVoucher
};
