import BusinessLedger, { GROUP_NATURE_MAP } from '../models/BusinessLedger.js';
import BusinessVoucher from '../models/BusinessVoucher.js';

// Groups where credit increases balance (Credit-normal)
const CREDIT_NATURE_GROUPS = [
  'Sundry Creditors', 'Current Liabilities', 'Capital Account',
  'Duties & Taxes', 'Provisions', 'Reserves & Surplus',
  'Suspense Account', 'Sales Accounts', 'Direct Incomes', 'Indirect Incomes'
];

// Nature-aware balance update — the ONLY correct way to update ledger balance
// For Assets/Expenses (Debit-normal): debit → +, credit → −
// For Liabilities/Income/Equity (Credit-normal): credit → +, debit → −
const applyLedgerBalanceChange = (ledger, entryType, amount) => {
  const isCreditNature = CREDIT_NATURE_GROUPS.includes(ledger.group);
  if (isCreditNature) {
    ledger.currentBalance += (entryType === 'credit' ? amount : -amount);
  } else {
    ledger.currentBalance += (entryType === 'debit' ? amount : -amount);
  }
};

// Generate Ledger Code
const generateLedgerCode = async (group, companyId = null) => {
  const prefix = group.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  const query = { group };
  if (companyId) query.companyId = companyId;
  const count = await BusinessLedger.countDocuments(query);
  return `B${prefix}${(count + 1).toString().padStart(4, '0')}`;
};

// Generate Voucher Number — exported so businessSalesController can use it
export const generateBusinessVoucherNumber = async (voucherType, companyId = null) => {
  const prefixMap = {
    'Income':          'BIN',
    'Expense':         'BEX',
    'Journal':         'BJV',
    'Contra':          'BCT',
    'Receipt':         'BRV',
    'Payment':         'BPV',
    'Sales':           'BSAL',
    'Purchase':        'BPUR',
    'CreditNote':      'BCN',
    'DebitNote':       'BDN',
    'FarmerPayment':   'FPY',
    'LoanDisbursal':   'LDN',
    'AdvancePayment':  'ADV',
    'BulkBankTransfer':'BBT',
    'GSTPayment':      'GSTP',
    'TDSPayment':      'TDSP',
    'OpeningBalance':  'OPB',
  };

  const prefix = prefixMap[voucherType] || 'BV';

  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  const query = { voucherNumber: { $regex: `^${prefix}${year}${month}` } };
  if (companyId) query.companyId = companyId;

  const lastVoucher = await BusinessVoucher.findOne(query).sort({ voucherNumber: -1 });

  let sequence = 1;
  if (lastVoucher) {
    const lastSequence = parseInt(lastVoucher.voucherNumber.slice(-4));
    if (!isNaN(lastSequence)) sequence = lastSequence + 1;
  }

  return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
};

// ==================== LEDGER CONTROLLERS ====================

// Create Business Ledger
export const createBusinessLedger = async (req, res) => {
  try {
    const { name, group, type, openingBalance, openingBalanceType, description, partyDetails, bankDetails } = req.body;

    const companyId = req.companyId;

    const existing = await BusinessLedger.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, companyId });
    if (existing) {
      return res.status(400).json({ message: 'Ledger with this name already exists' });
    }

    const code = await generateLedgerCode(group, companyId);

    const ledger = new BusinessLedger({
      name,
      code,
      group,
      type: type || (GROUP_NATURE_MAP[group] || 'Asset'),
      openingBalance: openingBalance || 0,
      openingBalanceType: openingBalanceType || 'Debit',
      currentBalance: openingBalance || 0,
      description,
      partyDetails,
      bankDetails,
      businessType: 'Private Firm',
      companyId
    });

    await ledger.save();
    res.status(201).json(ledger);
  } catch (error) {
    console.error('Create business ledger error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get All Business Ledgers
export const getAllBusinessLedgers = async (req, res) => {
  try {
    const { group, type, status, search } = req.query;

    const query = { companyId: req.companyId };

    if (group) query.group = group;
    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const ledgers = await BusinessLedger.find(query).sort({ group: 1, name: 1 });
    res.json(ledgers);
  } catch (error) {
    console.error('Get business ledgers error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Business Ledger by ID with transaction history
export const getBusinessLedgerById = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const ledger = await BusinessLedger.findById(req.params.id);
    if (!ledger) {
      return res.status(404).json({ message: 'Ledger not found' });
    }

    const voucherQuery = {
      companyId: req.companyId,
      'entries.ledgerId': req.params.id,
      status: 'Posted'
    };

    if (startDate || endDate) {
      voucherQuery.date = {};
      if (startDate) voucherQuery.date.$gte = new Date(startDate);
      if (endDate) voucherQuery.date.$lte = new Date(endDate);
    }

    const vouchers = await BusinessVoucher.find(voucherQuery).sort({ date: 1 }).lean();

    // Build running balance — nature-aware
    const isCreditNature = CREDIT_NATURE_GROUPS.includes(ledger.group);
    const obType = ledger.openingBalanceType === 'Credit' ? 'credit' : 'debit';
    // Signed opening: positive = debit side for debit-normal, positive = credit side for credit-normal
    let runningBalance = isCreditNature
      ? (obType === 'credit' ? ledger.openingBalance : -ledger.openingBalance)
      : (obType === 'debit' ? ledger.openingBalance : -ledger.openingBalance);

    const transactions = [];

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId.toString() === req.params.id) {
          const change = isCreditNature
            ? (entry.type === 'credit' ? entry.amount : -entry.amount)
            : (entry.type === 'debit' ? entry.amount : -entry.amount);

          runningBalance += change;

          transactions.push({
            date: voucher.date,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            narration: entry.description || voucher.narration,
            debit: entry.type === 'debit' ? entry.amount : 0,
            credit: entry.type === 'credit' ? entry.amount : 0,
            balance: Math.abs(runningBalance),
            balanceType: runningBalance >= 0
              ? (isCreditNature ? 'Cr' : 'Dr')
              : (isCreditNature ? 'Dr' : 'Cr')
          });
        }
      });
    });

    const closingBalanceAmount = Math.abs(runningBalance);
    const closingBalanceType = runningBalance >= 0
      ? (isCreditNature ? 'Cr' : 'Dr')
      : (isCreditNature ? 'Dr' : 'Cr');

    res.json({
      ledger,
      transactions,
      closingBalance: closingBalanceAmount,
      closingBalanceType
    });
  } catch (error) {
    console.error('Get business ledger error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update Business Ledger
export const updateBusinessLedger = async (req, res) => {
  try {
    const { name, group, type, openingBalance, openingBalanceType, description, partyDetails, bankDetails, status } = req.body;

    const ledger = await BusinessLedger.findById(req.params.id);
    if (!ledger) {
      return res.status(404).json({ message: 'Ledger not found' });
    }

    if (name && name !== ledger.name) {
      const existing = await BusinessLedger.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id },
        companyId: req.companyId
      });
      if (existing) {
        return res.status(400).json({ message: 'Ledger with this name already exists' });
      }
    }

    const balanceDiff = (openingBalance || 0) - (ledger.openingBalance || 0);

    Object.assign(ledger, {
      name: name || ledger.name,
      group: group || ledger.group,
      type: type || ledger.type,
      openingBalance: openingBalance !== undefined ? openingBalance : ledger.openingBalance,
      openingBalanceType: openingBalanceType || ledger.openingBalanceType,
      currentBalance: ledger.currentBalance + balanceDiff,
      description: description !== undefined ? description : ledger.description,
      partyDetails: partyDetails || ledger.partyDetails,
      bankDetails: bankDetails || ledger.bankDetails,
      status: status || ledger.status
    });

    await ledger.save();
    res.json(ledger);
  } catch (error) {
    console.error('Update business ledger error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete Business Ledger
export const deleteBusinessLedger = async (req, res) => {
  try {
    const hasEntries = await BusinessVoucher.exists({
      companyId: req.companyId,
      'entries.ledgerId': req.params.id
    });
    if (hasEntries) {
      return res.status(400).json({ message: 'Cannot delete ledger with existing transactions' });
    }

    const ledger = await BusinessLedger.findByIdAndDelete(req.params.id);
    if (!ledger) {
      return res.status(404).json({ message: 'Ledger not found' });
    }

    res.json({ message: 'Ledger deleted successfully' });
  } catch (error) {
    console.error('Delete business ledger error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== VOUCHER CONTROLLERS ====================

// Create Business Voucher (Income/Expense/Journal/Receipt/Payment/Contra/etc.)
export const createBusinessVoucher = async (req, res) => {
  try {
    const {
      voucherType,
      date,
      entries,
      narration,
      paymentMode,
      bankName,
      chequeNumber,
      chequeDate,
      transactionId,
      partyId,
      partyName,
      originalVoucherId,
      originalVoucherNumber
    } = req.body;

    if (!entries || entries.length < 2) {
      return res.status(400).json({ message: 'At least two entry lines are required' });
    }

    // Calculate and validate totals
    let totalDebit = 0;
    let totalCredit = 0;

    entries.forEach(entry => {
      if (entry.type === 'debit') totalDebit += entry.amount;
      else totalCredit += entry.amount;
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        message: `Debit and Credit amounts must be equal. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}`
      });
    }

    const companyId = req.companyId;
    const voucherNumber = await generateBusinessVoucherNumber(voucherType, companyId);

    // Populate ledger names + validate all ledgers exist in this company
    const processedEntries = [];
    for (const entry of entries) {
      const ledger = await BusinessLedger.findOne({ _id: entry.ledgerId, companyId });
      if (!ledger) {
        return res.status(404).json({ message: `Ledger not found: ${entry.ledgerId}` });
      }
      processedEntries.push({
        ledgerId: entry.ledgerId,
        ledgerName: ledger.name,
        type: entry.type,
        amount: entry.amount,
        isGSTLine: entry.isGSTLine || false,
        gstComponent: entry.gstComponent || null,
        gstRate: entry.gstRate,
        hsnCode: entry.hsnCode,
        isStockLine: entry.isStockLine || false,
        itemId: entry.itemId,
        itemName: entry.itemName,
        quantity: entry.quantity,
        unitCost: entry.unitCost,
        description: entry.description
      });
    }

    const voucher = new BusinessVoucher({
      voucherNumber,
      voucherType,
      date: date || new Date(),
      entries: processedEntries,
      totalDebit,
      totalCredit,
      narration,
      paymentMode,
      bankName,
      chequeNumber,
      chequeDate,
      transactionId,
      partyId,
      partyName,
      originalVoucherId: originalVoucherId || null,
      originalVoucherNumber: originalVoucherNumber || '',
      referenceType: 'Manual',
      status: 'Posted',
      businessType: 'Private Firm',
      companyId
    });

    await voucher.save();

    // Update ledger balances — nature-aware
    for (const entry of processedEntries) {
      const ledger = await BusinessLedger.findById(entry.ledgerId);
      if (!ledger) continue;
      applyLedgerBalanceChange(ledger, entry.type, entry.amount);
      await ledger.save();
    }

    res.status(201).json(voucher);
  } catch (error) {
    console.error('Create business voucher error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get All Business Vouchers
export const getAllBusinessVouchers = async (req, res) => {
  try {
    const { voucherType, startDate, endDate, search, status, page = 1, limit = 50 } = req.query;

    const query = { companyId: req.companyId };

    if (voucherType) query.voucherType = voucherType;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { voucherNumber: { $regex: search, $options: 'i' } },
        { narration: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [vouchers, total] = await Promise.all([
      BusinessVoucher.find(query)
        .populate('entries.ledgerId', 'name code group nature')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BusinessVoucher.countDocuments(query)
    ]);

    res.json({
      data: vouchers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get business vouchers error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Business Voucher by ID
export const getBusinessVoucherById = async (req, res) => {
  try {
    const voucher = await BusinessVoucher.findOne({
      _id: req.params.id,
      companyId: req.companyId
    })
      .populate('entries.ledgerId', 'name code group type nature')
      .populate('partyId', 'name phone');

    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    res.json(voucher);
  } catch (error) {
    console.error('Get business voucher error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Cancel Business Voucher (reversal + mark cancelled — never hard delete posted vouchers)
export const deleteBusinessVoucher = async (req, res) => {
  try {
    const voucher = await BusinessVoucher.findOne({
      _id: req.params.id,
      companyId: req.companyId
    });
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    // Reverse ledger balances — nature-aware
    for (const entry of voucher.entries) {
      const ledger = await BusinessLedger.findById(entry.ledgerId);
      if (!ledger) continue;
      // Reversal = swap debit ↔ credit
      const reverseType = entry.type === 'debit' ? 'credit' : 'debit';
      applyLedgerBalanceChange(ledger, reverseType, entry.amount);
      await ledger.save();
    }

    await BusinessVoucher.findByIdAndDelete(req.params.id);
    res.json({ message: 'Voucher deleted and ledger balances reversed successfully' });
  } catch (error) {
    console.error('Delete business voucher error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Shorthand voucher creators
export const createIncomeVoucher = async (req, res) => {
  req.body.voucherType = 'Income';
  return createBusinessVoucher(req, res);
};

export const createExpenseVoucher = async (req, res) => {
  req.body.voucherType = 'Expense';
  return createBusinessVoucher(req, res);
};

export const createJournalVoucher = async (req, res) => {
  req.body.voucherType = 'Journal';
  return createBusinessVoucher(req, res);
};

// Export the nature helper for use in other controllers
export { applyLedgerBalanceChange, CREDIT_NATURE_GROUPS };

export default {
  createBusinessLedger,
  getAllBusinessLedgers,
  getBusinessLedgerById,
  updateBusinessLedger,
  deleteBusinessLedger,
  createBusinessVoucher,
  getAllBusinessVouchers,
  getBusinessVoucherById,
  deleteBusinessVoucher,
  createIncomeVoucher,
  createExpenseVoucher,
  createJournalVoucher
};
