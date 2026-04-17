import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';

// Get all ledgers
export const getAllLedgers = async (req, res) => {
  try {
    const {
      ledgerType = '',
      status = 'Active',
      search = ''
    } = req.query;

    const query = { companyId: req.companyId };

    if (status) {
      query.status = status;
    }

    if (ledgerType) {
      query.ledgerType = ledgerType;
    }

    if (search) {
      query.ledgerName = { $regex: search, $options: 'i' };
    }

    const ledgers = await Ledger.find(query)
      .sort({ ledgerName: 1 })
      .select('ledgerName ledgerType currentBalance balanceType linkedEntity parentGroup openingBalance openingBalanceType');

    res.status(200).json({
      success: true,
      data: ledgers
    });
  } catch (error) {
    console.error('Error fetching ledgers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching ledgers'
    });
  }
};

// Create new ledger
export const createLedger = async (req, res) => {
  try {
    const ledgerData = req.body;

    const companyId = req.companyId;

    // Check for duplicate ledger name per company
    const existingLedger = await Ledger.findOne({
      ledgerName: ledgerData.ledgerName,
      status: 'Active',
      companyId
    });

    if (existingLedger) {
      return res.status(400).json({
        success: false,
        message: 'Ledger with this name already exists'
      });
    }

    // Set current balance same as opening balance
    ledgerData.currentBalance = ledgerData.openingBalance || 0;
    ledgerData.balanceType = ledgerData.openingBalanceType || 'Dr';
    ledgerData.companyId = companyId;

    const ledger = new Ledger(ledgerData);
    await ledger.save();

    res.status(201).json({
      success: true,
      message: 'Ledger created successfully',
      data: ledger
    });
  } catch (error) {
    console.error('Error creating ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating ledger'
    });
  }
};

// Get ledger by ID
export const getLedgerById = async (req, res) => {
  try {
    const ledger = await Ledger.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    res.status(200).json({
      success: true,
      data: ledger
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching ledger'
    });
  }
};

// Update ledger
export const updateLedger = async (req, res) => {
  try {
    const ledger = await Ledger.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ledger updated successfully',
      data: ledger
    });
  } catch (error) {
    console.error('Error updating ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating ledger'
    });
  }
};

// Delete ledger (soft delete)
export const deleteLedger = async (req, res) => {
  try {
    const ledger = await Ledger.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    ledger.status = 'Inactive';
    await ledger.save();

    res.status(200).json({
      success: true,
      message: 'Ledger deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting ledger'
    });
  }
};

// Outstanding report — balance as of toDate (opening + voucher movements up to toDate)
export const getOutstandingReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const companyId = req.companyId;

    const partyTypes = [
      'Party',
      'Accounts Due To (Sundry Creditors)',
      'Accounts Due From (Sundry Debtors)'
    ];

    const partyLedgers = await Ledger.find({ companyId, ledgerType: { $in: partyTypes }, status: 'Active' });

    const dateFilter = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const voucherQuery = { companyId };
    if (fromDate || toDate) voucherQuery.voucherDate = dateFilter;

    const vouchers = await Voucher.find(voucherQuery).select('voucherDate entries');

    // Build ledger → net movements map from vouchers
    const movements = {};
    for (const v of vouchers) {
      for (const e of v.entries) {
        const key = e.ledgerId.toString();
        if (!movements[key]) movements[key] = { debit: 0, credit: 0 };
        movements[key].debit  += e.debitAmount  || 0;
        movements[key].credit += e.creditAmount || 0;
      }
    }

    const debitNormalTypes = ['Party', 'Accounts Due From (Sundry Debtors)'];

    const results = [];
    for (const ledger of partyLedgers) {
      const key = ledger._id.toString();
      const mv = movements[key] || { debit: 0, credit: 0 };

      if (mv.debit === 0 && mv.credit === 0) continue;

      const isDebitNormal = debitNormalTypes.includes(ledger.ledgerType);
      const netBalance = isDebitNormal
        ? mv.debit - mv.credit
        : mv.credit - mv.debit;

      if (Math.abs(netBalance) < 0.01) continue;

      results.push({
        _id: ledger._id,
        ledgerName: ledger.ledgerName,
        ledgerType: ledger.ledgerType,
        linkedEntity: ledger.linkedEntity,
        periodDebit: mv.debit,
        periodCredit: mv.credit,
        currentBalance: Math.abs(netBalance),
        balanceType: netBalance >= 0 ? 'Dr' : 'Cr'
      });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error in outstanding report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getAllLedgers,
  createLedger,
  getLedgerById,
  updateLedger,
  deleteLedger,
  getOutstandingReport
};
