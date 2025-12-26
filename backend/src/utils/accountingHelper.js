import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';

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
    if (['Asset', 'Expense'].includes(ledger.ledgerType)) {
      ledger.currentBalance += netChange;
      ledger.balanceType = ledger.currentBalance >= 0 ? 'Dr' : 'Cr';
    } else if (['Liability', 'Income', 'Capital'].includes(ledger.ledgerType)) {
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

export default {
  generateVoucherNumber,
  createSalesVoucher,
  updateLedgerBalances,
  createPaymentVoucher
};
