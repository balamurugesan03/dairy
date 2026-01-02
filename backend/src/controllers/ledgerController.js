import Ledger from '../models/Ledger.js';

// Get all ledgers
export const getAllLedgers = async (req, res) => {
  try {
    const {
      ledgerType = '',
      status = 'Active',
      search = ''
    } = req.query;

    const query = {};

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
      .select('ledgerName ledgerType currentBalance balanceType');

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

    // Check for duplicate ledger name
    const existingLedger = await Ledger.findOne({
      ledgerName: ledgerData.ledgerName,
      status: 'Active'
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
    const ledger = await Ledger.findById(req.params.id);

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
    const ledger = await Ledger.findByIdAndUpdate(
      req.params.id,
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
    const ledger = await Ledger.findById(req.params.id);

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

export default {
  getAllLedgers,
  createLedger,
  getLedgerById,
  updateLedger,
  deleteLedger
};
