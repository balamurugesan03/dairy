import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Item from '../models/Item.js';

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

// Generate voucher number — always scoped by companyId to prevent cross-company collisions
export const generateVoucherNumber = async (voucherType, companyId = null) => {
  const prefix = VOUCHER_PREFIX_MAP[voucherType] || 'VCH';

  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const pattern = `${prefix}${year}${month}`;

  const query = {
    voucherNumber: { $regex: `^${pattern}` },
    voucherType
  };
  if (companyId) query.companyId = companyId;

  const lastVoucher = await Voucher.findOne(query).sort({ voucherNumber: -1 }).limit(1);

  let sequence = 1;
  if (lastVoucher) {
    const lastSeq = parseInt(lastVoucher.voucherNumber.slice(-4));
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }

  return `${pattern}${sequence.toString().padStart(4, '0')}`;
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

  // Debit: customer/cash ledger
  if (saleData.customerId) {
    const farmerLedger = await Ledger.findOne({
      'linkedEntity.entityType': 'Farmer',
      'linkedEntity.entityId': saleData.customerId,
      ...(saleData.companyId && { companyId: saleData.companyId })
    });

    if (farmerLedger) {
      entries.push({
        ledgerId: farmerLedger._id,
        ledgerName: farmerLedger.ledgerName,
        debitAmount: saleData.grandTotal,
        creditAmount: 0
      });
    }
  }

  // Credit: Sales ledger
  const salesLedger = await Ledger.findOne({
    ledgerName: 'Sales',
    ledgerType: 'Income',
    ...(saleData.companyId && { companyId: saleData.companyId })
  });
  if (!salesLedger) {
    throw new Error('Sales ledger not found. Create a "Sales" ledger with type "Income".');
  }

  entries.push({
    ledgerId: salesLedger._id,
    ledgerName: salesLedger.ledgerName,
    debitAmount: 0,
    creditAmount: saleData.grandTotal
  });

  // If payment received, add Cash/Bank debit and Customer credit
  if (saleData.paidAmount > 0 && saleData.customerId) {
    const paymentLedgerType = saleData.paymentMode === 'Cash' ? 'Cash' : 'Bank';
    const paymentLedger = await Ledger.findOne({
      ledgerType: paymentLedgerType,
      ...(saleData.companyId && { companyId: saleData.companyId })
    });

    if (!paymentLedger) {
      throw new Error(`${paymentLedgerType} ledger not found.`);
    }

    const farmerLedger = await Ledger.findOne({
      'linkedEntity.entityType': 'Farmer',
      'linkedEntity.entityId': saleData.customerId,
      ...(saleData.companyId && { companyId: saleData.companyId })
    });

    entries.push({
      ledgerId: paymentLedger._id,
      ledgerName: paymentLedger.ledgerName,
      debitAmount: saleData.paidAmount,
      creditAmount: 0
    });

    if (farmerLedger) {
      entries.push({
        ledgerId: farmerLedger._id,
        ledgerName: farmerLedger.ledgerName,
        debitAmount: 0,
        creditAmount: saleData.paidAmount
      });
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

  if (farmerLedger) {
    entries.push({
      ledgerId: farmerLedger._id,
      ledgerName: farmerLedger.ledgerName,
      debitAmount: paymentData.netPayable,
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
      creditAmount: paymentData.paidAmount
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
  createPurchaseVoucher
};
