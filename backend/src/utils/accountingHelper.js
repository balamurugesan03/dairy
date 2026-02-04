import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Item from '../models/Item.js';

// Generate voucher number based on type and date
export const generateVoucherNumber = async (voucherType) => {
  const prefix = {
    'Receipt': 'RV',
    'Payment': 'PV',
    'Journal': 'JV'
  }[voucherType];

  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  const lastVoucher = await Voucher.findOne({ voucherType })
    .sort({ createdAt: -1 })
    .limit(1);

  let sequence = 1;
  if (lastVoucher && lastVoucher.voucherNumber.startsWith(`${prefix}${year}${month}`)) {
    const lastSeq = parseInt(lastVoucher.voucherNumber.slice(-4));
    sequence = lastSeq + 1;
  }

  return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
};

// Create accounting voucher for sales transaction
export const createSalesVoucher = async (saleData, session = null) => {
  const entries = [];

  // Entry 1: Debit Customer/Cash (if immediate payment) or Customer Ledger (if credit)
  if (saleData.customerId) {
    const farmerLedger = await Ledger.findOne({
      'linkedEntity.entityType': 'Farmer',
      'linkedEntity.entityId': saleData.customerId
    });

    if (farmerLedger) {
      entries.push({
        ledgerId: farmerLedger._id,
        ledgerName: farmerLedger.ledgerName,
        debitAmount: saleData.grandTotal,
        creditAmount: 0
      });
    } else if (saleData.customerId) {
      console.warn(`Warning: Farmer ledger not found for customer ${saleData.customerId}`);
    }
  }

  // Entry 2: Credit Sales Ledger
  const salesLedger = await Ledger.findOne({ ledgerName: 'Sales', ledgerType: 'Income' });
  if (!salesLedger) {
    throw new Error('Sales ledger not found. Please create a "Sales" ledger with type "Income" in your accounting setup.');
  }

  entries.push({
    ledgerId: salesLedger._id,
    ledgerName: salesLedger.ledgerName,
    debitAmount: 0,
    creditAmount: saleData.grandTotal
  });

  // Entry 3: If payment received, Debit Cash/Bank and Credit Customer
  if (saleData.paidAmount > 0) {
    const paymentLedgerName = saleData.paymentMode === 'Cash' ? 'Cash' : 'Bank';
    const paymentLedgerType = saleData.paymentMode === 'Cash' ? 'Cash' : 'Bank';

    const paymentLedger = await Ledger.findOne({
      ledgerName: paymentLedgerName,
      ledgerType: paymentLedgerType
    });

    if (!paymentLedger) {
      throw new Error(`${paymentLedgerName} ledger not found. Please create a "${paymentLedgerName}" ledger with type "${paymentLedgerType}" in your accounting setup.`);
    }

    if (saleData.customerId) {
      const farmerLedger = await Ledger.findOne({
        'linkedEntity.entityType': 'Farmer',
        'linkedEntity.entityId': saleData.customerId
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
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('Journal');

  const voucher = new Voucher({
    voucherType: 'Journal',
    voucherNumber,
    voucherDate: saleData.billDate,
    entries,
    totalDebit,
    totalCredit,
    narration: `Sales - Bill No: ${saleData.billNumber}`,
    referenceType: 'Sales',
    referenceId: saleData._id
  });

  if (session) {
    await voucher.save({ session });
  } else {
    await voucher.save();
  }

  // Update ledger balances
  await updateLedgerBalances(entries, session);

  return voucher;
};

// Update ledger balances based on voucher entries
export const updateLedgerBalances = async (entries, session = null) => {
  for (const entry of entries) {
    const ledger = await Ledger.findById(entry.ledgerId);
    if (!ledger) continue;

    const netChange = entry.debitAmount - entry.creditAmount;

    // Update current balance based on ledger type
    // Asset-like ledgers (debit increases balance): Asset, Expense, Cash, Bank, Other Receivable
    if (['Asset', 'Expense', 'Cash', 'Bank', 'Other Receivable'].includes(ledger.ledgerType)) {
      ledger.currentBalance += netChange;
      ledger.balanceType = ledger.currentBalance >= 0 ? 'Dr' : 'Cr';
    } else if (['Liability', 'Income', 'Capital', 'Other Payable'].includes(ledger.ledgerType)) {
      // Liability-like ledgers (credit increases balance)
      ledger.currentBalance -= netChange;
      ledger.balanceType = ledger.currentBalance >= 0 ? 'Cr' : 'Dr';
    } else if (ledger.ledgerType === 'Party') {
      ledger.currentBalance += netChange;
      ledger.balanceType = ledger.currentBalance >= 0 ? 'Dr' : 'Cr';
    }

    if (session) {
      await ledger.save({ session });
    } else {
      await ledger.save();
    }
  }
};

// Create farmer payment voucher
export const createPaymentVoucher = async (paymentData, session = null) => {
  const entries = [];
  const farmerId = paymentData.farmerId;

  // Entry 1: Debit Farmer Ledger
  const farmerLedger = await Ledger.findOne({
    'linkedEntity.entityType': 'Farmer',
    'linkedEntity.entityId': farmerId
  });

  if (farmerLedger) {
    entries.push({
      ledgerId: farmerLedger._id,
      ledgerName: farmerLedger.ledgerName,
      debitAmount: paymentData.netPayable,
      creditAmount: 0
    });
  }

  // Entry 2: Credit Cash/Bank
  const paymentLedger = await Ledger.findOne({
    ledgerName: paymentData.paymentMode === 'Cash' ? 'Cash' : 'Bank',
    ledgerType: paymentData.paymentMode === 'Cash' ? 'Cash' : 'Bank'
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

  const voucherNumber = await generateVoucherNumber('Payment');

  const voucher = new Voucher({
    voucherType: 'Payment',
    voucherNumber,
    voucherDate: paymentData.paymentDate,
    entries,
    totalDebit,
    totalCredit,
    narration: `Farmer Payment`,
    referenceType: 'Payment',
    referenceId: paymentData._id
  });

  if (session) {
    await voucher.save({ session });
  } else {
    await voucher.save();
  }

  await updateLedgerBalances(entries, session);

  return voucher;
};

// Create purchase voucher for stock-in transactions
export const createPurchaseVoucher = async (purchaseData, session = null) => {
  const entries = [];

  // Step 1: Fetch item details with purchase ledgers populated
  const itemsWithLedgers = await Item.find({
    _id: { $in: purchaseData.items.map(i => i.itemId) }
  }).populate('purchaseLedger');

  // Step 2: Group items by purchase ledger and calculate base amounts
  const ledgerGroups = {};
  let totalGst = 0;

  for (const purchaseItem of purchaseData.items) {
    const item = itemsWithLedgers.find(i => i._id.toString() === purchaseItem.itemId.toString());
    if (!item) continue;

    const gstPercent = item.gstPercent || 0;
    const itemTotal = purchaseItem.quantity * purchaseItem.rate;
    const baseAmount = itemTotal / (1 + gstPercent / 100);
    const gstAmount = itemTotal - baseAmount;

    totalGst += gstAmount;

    const ledgerId = item.purchaseLedger?._id;
    const ledgerName = item.purchaseLedger?.ledgerName || 'Purchase';

    if (ledgerId) {
      if (!ledgerGroups[ledgerId]) {
        ledgerGroups[ledgerId] = {
          ledgerId,
          ledgerName,
          amount: 0
        };
      }
      ledgerGroups[ledgerId].amount += baseAmount;
    }
  }

  // Step 3: Add debit entries for purchase ledgers
  for (const group of Object.values(ledgerGroups)) {
    entries.push({
      ledgerId: group.ledgerId,
      ledgerName: group.ledgerName,
      debitAmount: group.amount,
      creditAmount: 0
    });
  }

  // Step 4: Add debit entry for GST Input
  if (totalGst > 0) {
    const gstLedger = await Ledger.findOne({
      ledgerName: 'GST Input',
      ledgerType: 'Other Receivable'
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

  // Step 5: Add credit entries based on payment mode
  const totalAmount = purchaseData.totalAmount || 0;
  const paidAmount = purchaseData.paidAmount || 0;
  const balanceAmount = totalAmount - paidAmount;

  if (purchaseData.paymentMode === 'Cash' && paidAmount > 0) {
    const cashLedger = await Ledger.findOne({
      ledgerName: 'Cash',
      ledgerType: 'Cash'
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

  // Step 6: Add supplier credit entry if there's a balance or full credit purchase
  if (balanceAmount > 0 || purchaseData.paymentMode === 'Adjustment') {
    const supplierLedger = await Ledger.findOne({
      'linkedEntity.entityType': 'Supplier',
      'linkedEntity.entityId': purchaseData.supplierId
    });

    const creditAmount = purchaseData.paymentMode === 'Adjustment'
      ? totalAmount
      : balanceAmount;

    if (supplierLedger) {
      entries.push({
        ledgerId: supplierLedger._id,
        ledgerName: supplierLedger.ledgerName,
        debitAmount: 0,
        creditAmount: creditAmount
      });
    }
  }

  // Step 7: Calculate totals and create voucher
  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('Journal');

  const narration = purchaseData.invoiceNumber
    ? `Purchase from ${purchaseData.supplierName} - Invoice ${purchaseData.invoiceNumber}`
    : `Purchase from ${purchaseData.supplierName || 'Supplier'}`;

  const voucher = new Voucher({
    voucherType: 'Journal',
    voucherNumber,
    voucherDate: purchaseData.purchaseDate || new Date(),
    entries,
    totalDebit,
    totalCredit,
    narration,
    referenceType: 'Purchase',
    referenceId: purchaseData.referenceId
  });

  if (session) {
    await voucher.save({ session });
  } else {
    await voucher.save();
  }

  // Update ledger balances
  await updateLedgerBalances(entries, session);

  return voucher;
};

export default {
  generateVoucherNumber,
  createSalesVoucher,
  updateLedgerBalances,
  createPaymentVoucher,
  createPurchaseVoucher
};
