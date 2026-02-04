import BusinessLedger from '../models/BusinessLedger.js';
import BusinessVoucher from '../models/BusinessVoucher.js';

// ==================== LEDGER CONTROLLERS ====================

// Generate Ledger Code
const generateLedgerCode = async (group) => {
  const prefix = group.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  const count = await BusinessLedger.countDocuments({ group });
  return `B${prefix}${(count + 1).toString().padStart(4, '0')}`;
};

// Create Business Ledger
export const createBusinessLedger = async (req, res) => {
  try {
    const { name, group, type, openingBalance, openingBalanceType, description, partyDetails, bankDetails } = req.body;

    // Check if ledger name already exists
    const existing = await BusinessLedger.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: 'Ledger with this name already exists' });
    }

    const code = await generateLedgerCode(group);

    const ledger = new BusinessLedger({
      name,
      code,
      group,
      type,
      openingBalance: openingBalance || 0,
      openingBalanceType: openingBalanceType || 'Debit',
      currentBalance: openingBalance || 0,
      description,
      partyDetails,
      bankDetails,
      businessType: 'Private Firm'
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

    const query = { businessType: 'Private Firm' };

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

// Get Business Ledger by ID
export const getBusinessLedgerById = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const ledger = await BusinessLedger.findById(req.params.id);
    if (!ledger) {
      return res.status(404).json({ message: 'Ledger not found' });
    }

    // Get voucher entries for this ledger
    const voucherQuery = {
      'entries.ledgerId': req.params.id,
      status: 'Posted'
    };

    if (startDate || endDate) {
      voucherQuery.date = {};
      if (startDate) voucherQuery.date.$gte = new Date(startDate);
      if (endDate) voucherQuery.date.$lte = new Date(endDate);
    }

    const vouchers = await BusinessVoucher.find(voucherQuery)
      .sort({ date: 1 })
      .lean();

    // Extract entries for this ledger
    const transactions = [];
    let runningBalance = ledger.openingBalance || 0;

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId.toString() === req.params.id) {
          if (entry.type === 'debit') {
            runningBalance += entry.amount;
          } else {
            runningBalance -= entry.amount;
          }

          transactions.push({
            date: voucher.date,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            narration: voucher.narration,
            debit: entry.type === 'debit' ? entry.amount : 0,
            credit: entry.type === 'credit' ? entry.amount : 0,
            balance: runningBalance
          });
        }
      });
    });

    res.json({
      ledger,
      transactions,
      closingBalance: runningBalance
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

    // Check for duplicate name
    if (name && name !== ledger.name) {
      const existing = await BusinessLedger.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ message: 'Ledger with this name already exists' });
      }
    }

    // Calculate balance difference if opening balance changed
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
    // Check if ledger has any voucher entries
    const hasEntries = await BusinessVoucher.exists({ 'entries.ledgerId': req.params.id });
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

// Generate Voucher Number
const generateVoucherNumber = async (voucherType) => {
  const prefix = voucherType === 'Income' ? 'BIN' :
                 voucherType === 'Expense' ? 'BEX' :
                 voucherType === 'Journal' ? 'BJV' :
                 voucherType === 'Contra' ? 'BCT' : 'BV';

  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  const lastVoucher = await BusinessVoucher.findOne({
    voucherNumber: { $regex: `^${prefix}${year}${month}` }
  }).sort({ voucherNumber: -1 });

  let sequence = 1;
  if (lastVoucher) {
    const lastSequence = parseInt(lastVoucher.voucherNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
};

// Create Business Voucher (Income/Expense/Journal)
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
      partyName
    } = req.body;

    if (!entries || entries.length < 2) {
      return res.status(400).json({ message: 'At least two entries are required' });
    }

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;

    entries.forEach(entry => {
      if (entry.type === 'debit') {
        totalDebit += entry.amount;
      } else {
        totalCredit += entry.amount;
      }
    });

    // Verify debit = credit
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ message: 'Debit and Credit amounts must be equal' });
    }

    const voucherNumber = await generateVoucherNumber(voucherType);

    // Populate ledger names
    const processedEntries = [];
    for (const entry of entries) {
      const ledger = await BusinessLedger.findById(entry.ledgerId);
      if (!ledger) {
        return res.status(404).json({ message: `Ledger not found: ${entry.ledgerId}` });
      }
      processedEntries.push({
        ledgerId: entry.ledgerId,
        ledgerName: ledger.name,
        type: entry.type,
        amount: entry.amount,
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
      referenceType: 'Manual',
      status: 'Posted',
      businessType: 'Private Firm'
    });

    await voucher.save();

    // Update ledger balances
    for (const entry of processedEntries) {
      const ledger = await BusinessLedger.findById(entry.ledgerId);
      if (entry.type === 'debit') {
        ledger.currentBalance += entry.amount;
      } else {
        ledger.currentBalance -= entry.amount;
      }
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

    const query = { businessType: 'Private Firm' };

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
        .populate('entries.ledgerId', 'name code')
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
    const voucher = await BusinessVoucher.findById(req.params.id)
      .populate('entries.ledgerId', 'name code group type')
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

// Delete/Cancel Business Voucher
export const deleteBusinessVoucher = async (req, res) => {
  try {
    const voucher = await BusinessVoucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    // Reverse ledger balances
    for (const entry of voucher.entries) {
      const ledger = await BusinessLedger.findById(entry.ledgerId);
      if (ledger) {
        if (entry.type === 'debit') {
          ledger.currentBalance -= entry.amount;
        } else {
          ledger.currentBalance += entry.amount;
        }
        await ledger.save();
      }
    }

    await BusinessVoucher.findByIdAndDelete(req.params.id);
    res.json({ message: 'Voucher deleted successfully' });
  } catch (error) {
    console.error('Delete business voucher error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create Income Voucher (simplified)
export const createIncomeVoucher = async (req, res) => {
  req.body.voucherType = 'Income';
  return createBusinessVoucher(req, res);
};

// Create Expense Voucher (simplified)
export const createExpenseVoucher = async (req, res) => {
  req.body.voucherType = 'Expense';
  return createBusinessVoucher(req, res);
};

// Create Journal Voucher (simplified)
export const createJournalVoucher = async (req, res) => {
  req.body.voucherType = 'Journal';
  return createBusinessVoucher(req, res);
};

export default {
  // Ledger
  createBusinessLedger,
  getAllBusinessLedgers,
  getBusinessLedgerById,
  updateBusinessLedger,
  deleteBusinessLedger,
  // Voucher
  createBusinessVoucher,
  getAllBusinessVouchers,
  getBusinessVoucherById,
  deleteBusinessVoucher,
  createIncomeVoucher,
  createExpenseVoucher,
  createJournalVoucher
};
