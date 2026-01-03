import Subsidy from '../models/Subsidy.js';
import Ledger from '../models/Ledger.js';

// Helper function to map subsidy ledger group to ledger type
const mapSubsidyLedgerGroupToLedgerType = (ledgerGroup) => {
  const mapping = {
    'Advance due to Society': 'Other Receivable',
    'Advance due by Society': 'Other Payable',
    'Contingencies': 'Contingency Fund',
    'Trade Expenses': 'Trade Expenses',
    'Trade Income': 'Trade Income',
    'Miscellaneous Income': 'Miscellaneous Income'
  };
  return mapping[ledgerGroup] || 'Miscellaneous Income';
};

// Get all subsidies
export const getAllSubsidies = async (req, res) => {
  try {
    const {
      subsidyType = '',
      ledgerGroup = '',
      status = 'Active',
      search = ''
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (subsidyType) {
      query.subsidyType = subsidyType;
    }

    if (ledgerGroup) {
      query.ledgerGroup = ledgerGroup;
    }

    if (search) {
      query.subsidyName = { $regex: search, $options: 'i' };
    }

    const subsidies = await Subsidy.find(query)
      .sort({ subsidyName: 1 });

    res.status(200).json({
      success: true,
      data: subsidies
    });
  } catch (error) {
    console.error('Error fetching subsidies:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching subsidies'
    });
  }
};

// Create new subsidy
export const createSubsidy = async (req, res) => {
  try {
    const subsidyData = req.body;

    // Check for duplicate subsidy name
    const existingSubsidy = await Subsidy.findOne({
      subsidyName: subsidyData.subsidyName,
      status: 'Active'
    });

    if (existingSubsidy) {
      return res.status(400).json({
        success: false,
        message: 'Subsidy with this name already exists'
      });
    }

    const subsidy = new Subsidy(subsidyData);
    await subsidy.save();

    // Auto-create ledger entry (account head) for the subsidy
    try {
      const ledgerType = mapSubsidyLedgerGroupToLedgerType(subsidyData.ledgerGroup);
      const ledger = new Ledger({
        ledgerName: subsidyData.subsidyName,
        ledgerType: ledgerType,
        openingBalance: 0,
        openingBalanceType: 'Dr',
        currentBalance: 0,
        balanceType: 'Dr',
        parentGroup: subsidyData.ledgerGroup,
        status: 'Active'
      });
      await ledger.save();
    } catch (ledgerError) {
      console.error('Error creating ledger for subsidy:', ledgerError);
      // Continue even if ledger creation fails
    }

    res.status(201).json({
      success: true,
      message: 'Subsidy created successfully',
      data: subsidy
    });
  } catch (error) {
    console.error('Error creating subsidy:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating subsidy'
    });
  }
};

// Get subsidy by ID
export const getSubsidyById = async (req, res) => {
  try {
    const subsidy = await Subsidy.findById(req.params.id);

    if (!subsidy) {
      return res.status(404).json({
        success: false,
        message: 'Subsidy not found'
      });
    }

    res.status(200).json({
      success: true,
      data: subsidy
    });
  } catch (error) {
    console.error('Error fetching subsidy:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching subsidy'
    });
  }
};

// Update subsidy
export const updateSubsidy = async (req, res) => {
  try {
    const subsidy = await Subsidy.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!subsidy) {
      return res.status(404).json({
        success: false,
        message: 'Subsidy not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subsidy updated successfully',
      data: subsidy
    });
  } catch (error) {
    console.error('Error updating subsidy:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating subsidy'
    });
  }
};

// Delete subsidy (soft delete)
export const deleteSubsidy = async (req, res) => {
  try {
    const subsidy = await Subsidy.findById(req.params.id);

    if (!subsidy) {
      return res.status(404).json({
        success: false,
        message: 'Subsidy not found'
      });
    }

    subsidy.status = 'Inactive';
    await subsidy.save();

    res.status(200).json({
      success: true,
      message: 'Subsidy deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting subsidy:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting subsidy'
    });
  }
};

export default {
  getAllSubsidies,
  createSubsidy,
  getSubsidyById,
  updateSubsidy,
  deleteSubsidy
};
