import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Item from '../models/Item.js';
import Subsidy from '../models/Subsidy.js';
import { getNextSequence } from '../models/Counter.js';

const VOUCHER_PREFIX_MAP = {
  'Receipt':         'RV',
  'Payment':         'PV',
  'Journal':         'JV',
  'Contra':          'CT',
  'Purchase':        'PUR',
  'Sales':           'SAL',
  'MilkPurchase':    'MKP',
  'MilkSales':       'MKS',
  'FarmerPayment':   'FPY',
  'LoanDisbursal':   'LDN',
  'AdvancePayment':  'ADV',
  'OpeningBalance':  'OPB',
  'ProducerDue':     'PDU',
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
  const companyId = saleData.companyId;
  const grandTotal  = parseFloat(saleData.grandTotal)  || 0;
  const paidAmount  = parseFloat(saleData.paidAmount)  || 0;
  const balanceAmount = Math.max(0, grandTotal - paidAmount);

  const saveLedger = async (l) => {
    if (session) await l.save({ session }); else await l.save();
    return l;
  };

  // ── Helper: get/create sales income ledger — prefers "CATTLE FEED SALES" ──
  const getDefaultSalesLedger = async () => {
    // Try the named ledger from accounts management first
    let l = await Ledger.findOne({
      ledgerName: { $regex: /^cattle\s*feed\s*sales$/i },
      ...(companyId && { companyId })
    });
    if (!l) {
      // Fall back to generic "Sales" ledger if it already exists
      l = await Ledger.findOne({
        ledgerName: 'Sales',
        ledgerType: 'Income',
        ...(companyId && { companyId })
      });
    }
    if (!l) {
      l = await saveLedger(new Ledger({
        ledgerName: 'CATTLE FEED SALES',
        ledgerType: 'Income',
        openingBalance: 0,
        currentBalance: 0,
        balanceType: 'Cr',
        companyId
      }));
    }
    return l;
  };

  // ── Helper: get/create CATTLE FEED ADVANCE ledger (debit side for credit sales) ─
  const getAdvanceLedger = async () => {
    let l = await Ledger.findOne({
      ledgerName: { $regex: /^cattle\s*feed\s*advance$/i },
      ...(companyId && { companyId })
    });
    if (!l) {
      l = await saveLedger(new Ledger({
        ledgerName: 'CATTLE FEED ADVANCE',
        ledgerType: 'Other Receivable',
        openingBalance: 0,
        currentBalance: 0,
        balanceType: 'Dr',
        companyId
      }));
    }
    return l;
  };

  // ── Credit: per-item salesLedger (groups items by their linked sales ledger) ─
  // Each item contributes its full pre-subsidy amount (qty*rate + gst). The
  // subsidy is posted separately on the debit side as an expenditure of the
  // society (see Subsidy block below). Discount / round-off residual goes
  // into the generic "Sales" ledger so the voucher always balances.
  const ledgerGroups = {}; // ledgerId -> { ledgerId, ledgerName, amount }
  let unmappedAmount = 0;

  const itemIds = (saleData.items || []).map(i => i.itemId).filter(Boolean);
  const itemDocs = itemIds.length
    ? await Item.find({ _id: { $in: itemIds } }).populate('salesLedger').lean()
    : [];
  const itemDocById = new Map(itemDocs.map(d => [d._id.toString(), d]));

  for (const lineItem of (saleData.items || [])) {
    const lineAmount = (parseFloat(lineItem.quantity) || 0) * (parseFloat(lineItem.rate) || 0);
    const gst        = parseFloat(lineItem.gstAmount)     || 0;
    const contribution = lineAmount + gst;
    if (contribution <= 0) continue;

    const doc = itemDocById.get(String(lineItem.itemId));
    const linkedLedger = doc?.salesLedger;
    if (linkedLedger?._id) {
      const key = linkedLedger._id.toString();
      if (!ledgerGroups[key]) {
        ledgerGroups[key] = {
          ledgerId: linkedLedger._id,
          ledgerName: linkedLedger.ledgerName,
          amount: 0
        };
      }
      ledgerGroups[key].amount += contribution;
    } else {
      unmappedAmount += contribution;
    }
  }

  // ── Debit: Subsidy expenditure (per subsidy ledger) ─────────────────────
  // Each item.subsidyAmount is recorded as society's expenditure under the
  // subsidy's own ledger (looked up by subsidyName, auto-created if missing).
  const subsidyGroups = {}; // key -> { ledgerId, ledgerName, amount }
  const subsidyIds = (saleData.items || [])
    .map(i => i.subsidyId)
    .filter(Boolean);
  const subsidyDocs = subsidyIds.length
    ? await Subsidy.find({ _id: { $in: subsidyIds } }).lean()
    : [];
  const subsidyDocById = new Map(subsidyDocs.map(d => [d._id.toString(), d]));

  for (const lineItem of (saleData.items || [])) {
    const sub = parseFloat(lineItem.subsidyAmount) || 0;
    if (sub <= 0) continue;
    const subDoc = lineItem.subsidyId ? subsidyDocById.get(String(lineItem.subsidyId)) : null;
    const subName = subDoc?.subsidyName || 'Subsidy';
    const subLedgerType = subDoc?.ledgerGroup || 'Trade Expenses';
    const key = subDoc?._id?.toString() || subName.toLowerCase();
    if (!subsidyGroups[key]) {
      let l = await Ledger.findOne({
        ledgerName: subName,
        ...(companyId && { companyId })
      });
      if (!l) {
        l = await saveLedger(new Ledger({
          ledgerName: subName,
          ledgerType: subLedgerType,
          openingBalance: 0,
          currentBalance: 0,
          balanceType: 'Dr',
          companyId
        }));
      }
      subsidyGroups[key] = { ledgerId: l._id, ledgerName: l.ledgerName, amount: 0 };
    }
    subsidyGroups[key].amount += sub;
  }

  const totalSubsidyAmount = Object.values(subsidyGroups).reduce((s, g) => s + g.amount, 0);

  // Residual: balance the voucher. Cr side will be allocated + residual;
  // Dr side will be (paidAmount + balanceAmount + totalSubsidyAmount) = grandTotal + totalSubsidyAmount.
  // So required Cr total = grandTotal + totalSubsidyAmount.
  const allocated = Object.values(ledgerGroups).reduce((s, g) => s + g.amount, 0) + unmappedAmount;
  const residual  = (grandTotal + totalSubsidyAmount) - allocated; // covers discount/roundOff

  if (unmappedAmount > 0 || residual !== 0) {
    const fallback = await getDefaultSalesLedger();
    const key = fallback._id.toString();
    if (!ledgerGroups[key]) {
      ledgerGroups[key] = { ledgerId: fallback._id, ledgerName: fallback.ledgerName, amount: 0 };
    }
    ledgerGroups[key].amount += unmappedAmount + residual;
  }

  // Push Cr (income) entries
  for (const g of Object.values(ledgerGroups)) {
    if (g.amount > 0) {
      entries.push({ ledgerId: g.ledgerId, ledgerName: g.ledgerName, debitAmount: 0, creditAmount: g.amount });
    } else if (g.amount < 0) {
      // Negative residual (e.g., heavy discount) — record as debit to keep voucher balanced
      entries.push({ ledgerId: g.ledgerId, ledgerName: g.ledgerName, debitAmount: -g.amount, creditAmount: 0 });
    }
  }

  // Push Dr (subsidy expenditure) entries
  for (const g of Object.values(subsidyGroups)) {
    if (g.amount > 0) {
      entries.push({ ledgerId: g.ledgerId, ledgerName: g.ledgerName, debitAmount: g.amount, creditAmount: 0 });
    }
  }

  // ── Debit: Cash/Bank for the paid portion ────────────────────────────────
  if (paidAmount > 0) {
    const paymentLedgerType = saleData.paymentMode === 'Cash' ? 'Cash' : 'Bank';
    let paymentLedger = await Ledger.findOne({
      ledgerType: paymentLedgerType,
      ...(companyId && { companyId })
    });
    if (!paymentLedger) {
      paymentLedger = await saveLedger(new Ledger({
        ledgerName: paymentLedgerType === 'Cash' ? 'Cash in Hand' : 'Bank Account',
        ledgerType: paymentLedgerType,
        openingBalance: 0,
        currentBalance: 0,
        balanceType: 'Dr',
        companyId
      }));
    }
    entries.push({ ledgerId: paymentLedger._id, ledgerName: paymentLedger.ledgerName, debitAmount: paidAmount, creditAmount: 0 });
  }

  // ── Debit: CATTLE FEED ADVANCE for the unpaid balance (credit / debt sale only) ─
  // Cash sales are fully settled at point of sale — never post to CATTLE FEED ADVANCE.
  if (balanceAmount > 0 && saleData.paymentMode !== 'Cash') {
    const advanceLedger = await getAdvanceLedger();
    entries.push({
      ledgerId: advanceLedger._id,
      ledgerName: advanceLedger.ledgerName,
      debitAmount: balanceAmount,
      creditAmount: 0
    });
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('Sales', saleData.companyId);

  // Build narration: item name, qty, rate, bill number (as the user requires)
  const itemSummary = (saleData.items || [])
    .map(i => `${i.itemName} Qty:${parseFloat(i.quantity) || 0} @ Rs.${parseFloat(i.rate) || 0}`)
    .join('; ');
  const saleNarration = itemSummary
    ? `${itemSummary} | Bill No: ${saleData.billNumber}`
    : `Sales | Bill No: ${saleData.billNumber} | ${saleData.customerName || 'Walk-in'}`;

  const voucher = new Voucher({
    voucherType: 'Sales',
    voucherNumber,
    voucherDate: saleData.billDate,
    entries,
    totalDebit,
    totalCredit,
    narration: saleNarration,
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

  // Credit: Cash/Bank — try company-scoped first, then global fallback
  const paymentLedgerType = paymentData.paymentMode === 'Cash' ? 'Cash' : 'Bank';
  const paymentLedger =
    (companyId
      ? await Ledger.findOne({ ledgerType: paymentLedgerType, companyId })
      : null) ||
    await Ledger.findOne({ ledgerType: paymentLedgerType }) ||
    // Last-resort: search by name containing 'Cash' or 'Bank'
    (companyId
      ? await Ledger.findOne({ ledgerName: new RegExp(paymentLedgerType, 'i'), companyId })
      : null) ||
    await Ledger.findOne({ ledgerName: new RegExp(paymentLedgerType, 'i') });

  if (!farmerLedger || !paymentLedger) {
    console.warn(
      `createPaymentVoucher: skipping — farmerLedger=${!!farmerLedger}, paymentLedger(${paymentLedgerType})=${!!paymentLedger}`
    );
    return null;
  }

  // Debit: farmer payable ledger
  entries.push({
    ledgerId: farmerLedger._id,
    ledgerName: farmerLedger.ledgerName,
    debitAmount: paidAmt,
    creditAmount: 0,
  });

  // Credit: Cash/Bank ledger
  entries.push({
    ledgerId: paymentLedger._id,
    ledgerName: paymentLedger.ledgerName,
    debitAmount: 0,
    creditAmount: paidAmt,
  });

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
// Always fires: companyId is required for Day Book / Cash Book filtering
export const createPurchaseVoucher = async (purchaseData, session = null) => {
  const entries = [];
  const companyId = purchaseData.companyId;

  const itemsWithLedgers = await Item.find({
    _id: { $in: purchaseData.items.map(i => i.itemId) }
  }).populate('purchaseLedger');

  // ── Helper: find/create a fallback "Purchase" ledger ────────────────────
  const getDefaultPurchaseLedger = async () => {
    let led = await Ledger.findOne({ ledgerName: 'Purchase', ledgerType: 'Purchases A/c', ...(companyId && { companyId }) });
    if (!led) {
      led = new Ledger({
        ledgerName: 'Purchase', ledgerType: 'Purchases A/c',
        parentGroup: 'Purchase Accounts',
        openingBalance: 0, currentBalance: 0,
        balanceType: 'Dr', openingBalanceType: 'Dr',
        status: 'Active', ...(companyId && { companyId }),
      });
      if (session) await led.save({ session }); else await led.save();
    }
    return led;
  };

  // ── Helper: find/create "Sundry Creditors" as fallback credit account ───
  const getSundryCreditors = async () => {
    let led = await Ledger.findOne({ ledgerName: 'Sundry Creditors', ...(companyId && { companyId }) });
    if (!led) {
      led = new Ledger({
        ledgerName: 'Sundry Creditors',
        ledgerType: 'Accounts Due To (Sundry Creditors)',
        parentGroup: 'Current Liabilities',
        openingBalance: 0, currentBalance: 0,
        balanceType: 'Cr', openingBalanceType: 'Cr',
        status: 'Active', ...(companyId && { companyId }),
      });
      if (session) await led.save({ session }); else await led.save();
    }
    return led;
  };

  const ledgerGroups = {};
  let totalGst = 0;

  for (const purchaseItem of purchaseData.items) {
    const item = itemsWithLedgers.find(i => i._id.toString() === purchaseItem.itemId.toString());
    if (!item) continue;

    const gstPercent = item.gstPercent || 0;
    const itemTotal  = purchaseItem.quantity * purchaseItem.rate;
    const baseAmount = gstPercent > 0 ? itemTotal / (1 + gstPercent / 100) : itemTotal;
    const gstAmount  = itemTotal - baseAmount;
    totalGst += gstAmount;

    // Use item's purchase ledger; fall back to a default if not set
    let ledgerId   = item.purchaseLedger?._id;
    let ledgerName = item.purchaseLedger?.ledgerName;
    if (!ledgerId) {
      const def = await getDefaultPurchaseLedger();
      ledgerId   = def._id;
      ledgerName = def.ledgerName;
    }

    const key = ledgerId.toString();
    if (!ledgerGroups[key]) ledgerGroups[key] = { ledgerId, ledgerName, amount: 0 };
    ledgerGroups[key].amount += baseAmount;
  }

  // Debit: purchase ledgers
  for (const group of Object.values(ledgerGroups)) {
    if (group.amount > 0) {
      entries.push({ ledgerId: group.ledgerId, ledgerName: group.ledgerName, debitAmount: group.amount, creditAmount: 0 });
    }
  }

  // Debit: GST Input (if applicable)
  if (totalGst > 0) {
    const gstLedger = await Ledger.findOne({ ledgerName: 'GST Input', ...(companyId && { companyId }) });
    if (gstLedger) {
      entries.push({ ledgerId: gstLedger._id, ledgerName: gstLedger.ledgerName, debitAmount: totalGst, creditAmount: 0 });
    }
  }

  const totalAmount  = purchaseData.totalAmount || 0;
  const paidAmount   = purchaseData.paidAmount  || 0;
  const paymentMode  = purchaseData.paymentMode || 'Credit';

  // Credit: ledger deduction entries (amount per unit × total quantity)
  const ledgerEntriesInput = purchaseData.ledgerEntries || [];
  const totalQuantity = (purchaseData.items || []).reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
  let totalLedgerDeduction = 0;

  for (const entry of ledgerEntriesInput) {
    if (!entry.ledgerId || !entry.amount) continue;
    const deductionAmt = parseFloat(entry.amount) * totalQuantity;
    if (deductionAmt <= 0) continue;
    totalLedgerDeduction += deductionAmt;
    const dedLedger = await Ledger.findById(entry.ledgerId);
    if (dedLedger) {
      entries.push({ ledgerId: dedLedger._id, ledgerName: dedLedger.ledgerName, debitAmount: 0, creditAmount: deductionAmt });
    }
  }

  const balanceAfterDeductions = Math.max(0, totalAmount - totalLedgerDeduction);
  const supplierBalance = Math.max(0, balanceAfterDeductions - paidAmount);

  // Credit: Cash/Bank for paid portion
  if (paidAmount > 0) {
    const isBank = paymentMode === 'Bank' || paymentMode === 'NEFT' || paymentMode === 'RTGS' || paymentMode === 'Cheque';
    const payLedger = isBank
      ? await Ledger.findOne({ ledgerType: 'Bank', ...(companyId && { companyId }) })
      : await Ledger.findOne({ ledgerType: 'Cash', ...(companyId && { companyId }) });
    if (payLedger) {
      entries.push({ ledgerId: payLedger._id, ledgerName: payLedger.ledgerName, debitAmount: 0, creditAmount: paidAmount });
    }
  }

  // Credit: supplier ledger or Sundry Creditors for unpaid balance
  if (supplierBalance > 0 || paymentMode === 'Adjustment' || paymentMode === 'Credit') {
    const creditAmt = paymentMode === 'Adjustment' ? totalAmount : supplierBalance;
    if (creditAmt > 0) {
      // Try linked supplier ledger first
      const supplierLedger = purchaseData.supplierId
        ? await Ledger.findOne({
            'linkedEntity.entityType': 'Supplier',
            'linkedEntity.entityId': purchaseData.supplierId,
            ...(companyId && { companyId }),
          })
        : null;

      const creditLedger = supplierLedger || await getSundryCreditors();
      entries.push({ ledgerId: creditLedger._id, ledgerName: creditLedger.ledgerName, debitAmount: 0, creditAmount: creditAmt });
    }
  }

  // Skip saving if no entries were built (e.g. zero-value purchase)
  if (entries.length === 0) return null;

  const totalDebit  = entries.reduce((sum, e) => sum + (e.debitAmount  || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.creditAmount || 0), 0);

  const voucherNumber = await generateVoucherNumber('Purchase', companyId);
  const narration = purchaseData.invoiceNumber
    ? `Purchase from ${purchaseData.supplierName || 'Supplier'} — Invoice ${purchaseData.invoiceNumber}`
    : `Purchase from ${purchaseData.supplierName || 'Supplier'}`;

  const voucher = new Voucher({
    voucherType:   'Purchase',
    voucherNumber,
    voucherDate:   purchaseData.purchaseDate || new Date(),
    entries,
    totalDebit,
    totalCredit,
    narration,
    referenceType: 'Purchase',
    referenceId:   purchaseData.referenceId,
    ...(companyId && { companyId }),
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

// Auto-post a "Producer Dues" payment voucher (Day Book / Cash Book).
//   Cash mode  → Dr PRODUCERS DUES / Cr Cash in Hand
//   Bank/Cheque/UPI/NEFT/RTGS → Dr PRODUCERS DUES / Cr Bank Account
// Used by: Payment to Producer, Individual Milk Payment, Bank Transfer.
export const createProducerDuesPaymentVoucher = async ({
  amount,
  paymentDate,
  paymentMode,
  companyId,
  narration,
  referenceType,
  referenceId,
  createdBy,
  bankLedgerName,
}, session = null) => {
  if (!amount || amount <= 0 || !companyId) return null;

  const producerDuesLedger = await findOrCreateLedger(
    'PRODUCERS DUES', 'Other Payable', 'LIABILITY', 'Cr', companyId, session
  );

  const isCash = (paymentMode || 'Cash') === 'Cash';
  let payLedger;
  if (isCash) {
    payLedger = await Ledger.findOne({ ledgerType: 'Cash', companyId });
    if (!payLedger) {
      payLedger = await findOrCreateLedger('Cash in Hand', 'Cash', 'Cash', 'Dr', companyId, session);
    }
  } else {
    if (bankLedgerName && bankLedgerName !== 'All') {
      payLedger = await findOrCreateLedger(bankLedgerName, 'Bank', 'Bank Accounts', 'Dr', companyId, session);
    } else {
      payLedger = await Ledger.findOne({ ledgerType: 'Bank', companyId });
      if (!payLedger) {
        payLedger = await findOrCreateLedger('Bank Account', 'Bank', 'Bank Accounts', 'Dr', companyId, session);
      }
    }
  }

  const entries = [
    { ledgerId: producerDuesLedger._id, ledgerName: producerDuesLedger.ledgerName, debitAmount: amount, creditAmount: 0 },
    { ledgerId: payLedger._id, ledgerName: payLedger.ledgerName, debitAmount: 0, creditAmount: amount },
  ];

  const voucher = new Voucher({
    voucherType: 'Payment',
    voucherNumber: await generateVoucherNumber('Payment', companyId),
    voucherDate: paymentDate || new Date(),
    companyId,
    entries,
    totalDebit: amount,
    totalCredit: amount,
    narration: narration || `Producers Dues Payment — ${paymentMode || 'Cash'}`,
    referenceType,
    referenceId,
    createdBy,
  });

  if (session) await voucher.save({ session });
  else await voucher.save();

  await updateLedgerBalances(entries, session, companyId);
  return voucher;
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

// ─── Producer Opening → Ledger opening balances ──────────────────────────────
// Call on create:  applyProducerOpeningLedgers(newData, null, companyId)
// Call on update:  applyProducerOpeningLedgers(newData, oldData, companyId)
// Call on delete:  applyProducerOpeningLedgers(null,    oldData, companyId)
export const applyProducerOpeningLedgers = async (newData, oldData, companyId, session = null) => {
  // Category ledger map: field → { ledgerName, balanceType }
  const CATEGORY_LEDGERS = [
    { field: 'cfAdvance',     name: 'Cattle Feed Advance',  type: 'Other Receivable', group: 'Assets',      bal: 'Dr' },
    { field: 'cashAdvance',   name: 'Farmers Cash Advance', type: 'Other Receivable', group: 'Assets',      bal: 'Dr' },
    { field: 'loanAdvance',   name: 'Farmers Loan A/c',     type: 'Other Receivable', group: 'Assets',      bal: 'Dr' },
    { field: 'revolvingFund', name: 'Revolving Fund',       type: 'Other Receivable', group: 'Assets',      bal: 'Dr' },
  ];

  const save = (doc) => session ? doc.save({ session }) : doc.save();

  // Helper to apply a signed delta to a ledger's opening + current balance
  const applyDelta = async (ledger, delta, isDebitNormal) => {
    if (!ledger || delta === 0) return;
    // debitNormal: + delta increases Dr balance; creditNormal: + delta increases Cr balance
    const sign = isDebitNormal ? 1 : -1;
    ledger.openingBalance  = (ledger.openingBalance  || 0) + sign * delta;
    ledger.currentBalance  = (ledger.currentBalance  || 0) + sign * delta;
    // Recalculate balanceType
    if (isDebitNormal) {
      ledger.openingBalanceType = ledger.openingBalance >= 0 ? 'Dr' : 'Cr';
      ledger.balanceType        = ledger.currentBalance  >= 0 ? 'Dr' : 'Cr';
    } else {
      ledger.openingBalanceType = ledger.openingBalance >= 0 ? 'Cr' : 'Dr';
      ledger.balanceType        = ledger.currentBalance  >= 0 ? 'Cr' : 'Dr';
    }
    await save(ledger);
  };

  // 1. Farmer's linked ledger → dueAmount (Credit normal — we owe the farmer)
  const farmerId = newData?.farmerId || oldData?.farmerId;
  if (farmerId) {
    const farmerLedger = await Ledger.findOne({
      'linkedEntity.entityType': 'Farmer',
      'linkedEntity.entityId': farmerId,
      companyId,
    });
    if (farmerLedger) {
      const newAmt = newData?.dueAmount || 0;
      const oldAmt = oldData?.dueAmount || 0;
      const delta  = newAmt - oldAmt;
      await applyDelta(farmerLedger, delta, false); // creditNormal
    }
  }

  // 2. Category ledgers (all Debit normal — farmer owes us)
  for (const cat of CATEGORY_LEDGERS) {
    const newAmt = newData?.[cat.field] || 0;
    const oldAmt = oldData?.[cat.field] || 0;
    const delta  = newAmt - oldAmt;
    if (delta === 0) continue;

    const ledger = await findOrCreateLedger(cat.name, cat.type, cat.group, cat.bal, companyId, session);
    await applyDelta(ledger, delta, true); // debitNormal
  }
};

// Create journal voucher for advance recovery deductions (CF/Cash/Loan/Welfare)
// Dr PRODUCERS DUES  /  Cr Recovery Ledger (Cattle Feed / Cash / Loan / Welfare)
export const createRecoveryVoucher = async (paymentData, session = null) => {
  const farmerId  = paymentData.farmerId;
  const companyId = paymentData.companyId;

  const RECOVERY_LEDGER_MAP = {
    'CF Recovery':      { name: 'Cattle Feed Advance',  type: 'Other Receivable',         group: 'Assets',      bal: 'Dr' },
    'CF Advance':       { name: 'Cattle Feed Advance',  type: 'Other Receivable',         group: 'Assets',      bal: 'Dr' },
    'Cash Recovery':    { name: 'Farmers Cash Advance', type: 'Other Receivable',         group: 'Assets',      bal: 'Dr' },
    'Cash Advance':     { name: 'Farmers Cash Advance', type: 'Other Receivable',         group: 'Assets',      bal: 'Dr' },
    'Loan Recovery':    { name: 'Farmers Loan A/c',     type: 'Other Receivable',         group: 'Assets',      bal: 'Dr' },
    'Loan Advance':     { name: 'Farmers Loan A/c',     type: 'Other Receivable',         group: 'Assets',      bal: 'Dr' },
    'Welfare Recovery': { name: 'KDF WELFARE FUND',     type: 'Other Liabilities',        group: 'Liabilities', bal: 'Cr' },
    'Welfare':          { name: 'KDF WELFARE FUND',     type: 'Other Liabilities',        group: 'Liabilities', bal: 'Cr' },
  };

  const recoveries = (paymentData.deductions || []).filter(
    d => RECOVERY_LEDGER_MAP[d.type] && (d.amount || 0) > 0
  );
  if (recoveries.length === 0) return null;

  // Producer-side ledger for the Dr leg. Prefer the farmer-linked ledger so
  // per-farmer balances stay accurate, but fall back to the generic
  // "PRODUCERS DUES" ledger when the farmer has no linked ledger yet — that
  // way the voucher always posts and shows up in the Day Book.
  let producerDuesLedger = await Ledger.findOne({
    'linkedEntity.entityType': 'Farmer',
    'linkedEntity.entityId':   farmerId,
    ...(companyId && { companyId }),
  });
  if (!producerDuesLedger) {
    producerDuesLedger = await findOrCreateLedger(
      'PRODUCERS DUES', 'Other Payable', 'LIABILITY', 'Cr', companyId, session
    );
  }

  // For Welfare, prefer an existing ledger that matches "KDF WELFARE FUND"
  // (or any "WELFARE" name) — that's the ledger seeded automatically from
  // the deduction/earning master.
  const findWelfareLedger = async () => {
    let l = await Ledger.findOne({
      ledgerName: { $regex: /^kdf\s*welfare\s*fund$/i },
      ...(companyId && { companyId }),
    });
    if (!l) {
      l = await Ledger.findOne({
        ledgerName: { $regex: /welfare/i },
        ...(companyId && { companyId }),
      });
    }
    return l;
  };

  // Accumulate per-ledger debit/credit
  const ledgerTotals = {}; // key: ledgerId string → { ledgerId, ledgerName, debitAmount, creditAmount }

  const accum = (id, name, dr, cr) => {
    const k = id.toString();
    if (!ledgerTotals[k]) ledgerTotals[k] = { ledgerId: id, ledgerName: name, debitAmount: 0, creditAmount: 0 };
    ledgerTotals[k].debitAmount  += dr;
    ledgerTotals[k].creditAmount += cr;
  };

  for (const ded of recoveries) {
    const linfo = RECOVERY_LEDGER_MAP[ded.type];
    let crLedger = null;
    if (ded.type === 'Welfare Recovery' || ded.type === 'Welfare') {
      crLedger = await findWelfareLedger();
    }
    if (!crLedger) {
      crLedger = await findOrCreateLedger(linfo.name, linfo.type, linfo.group, linfo.bal, companyId, session);
    }
    // Dr PRODUCERS DUES (generic display name regardless of which underlying
    // ledger backs it — keeps balance tracking but reads cleanly in reports).
    // Cr recovery ledger (Cattle Feed / Cash / Loan / KDF WELFARE FUND).
    accum(producerDuesLedger._id, 'PRODUCERS DUES',     ded.amount, 0);
    accum(crLedger._id,           crLedger.ledgerName,  0,          ded.amount);
  }

  const entries     = Object.values(ledgerTotals);
  const totalDebit  = entries.reduce((s, e) => s + e.debitAmount,  0);
  const totalCredit = entries.reduce((s, e) => s + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('Journal', companyId);

  const voucher = new Voucher({
    voucherType:   'Journal',
    voucherNumber,
    voucherDate:   paymentData.paymentDate || new Date(),
    entries,
    totalDebit,
    totalCredit,
    narration:     `Advance Recovery${paymentData.paymentNumber ? ` | ${paymentData.paymentNumber}` : ''}`,
    referenceType: 'FarmerPayment',
    referenceId:   paymentData._id,
    ...(companyId && { companyId }),
  });

  if (session) await voucher.save({ session });
  else await voucher.save();

  await updateLedgerBalances(entries, session, companyId);
  return voucher;
};

export default {
  generateVoucherNumber,
  getFinancialYear,
  createSalesVoucher,
  updateLedgerBalances,
  reverseLedgerBalances,
  createPaymentVoucher,
  createProducerDuesPaymentVoucher,
  createRecoveryVoucher,
  createPurchaseVoucher,
  createShareCapitalVoucher,
  createAdmissionFeeVoucher,
  applyProducerOpeningLedgers,
};
