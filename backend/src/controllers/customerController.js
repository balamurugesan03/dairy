import Customer from '../models/Customer.js';
import Ledger from '../models/Ledger.js';

// Helper function to generate next customer ID
const generateCustomerId = async (companyId) => {
  try {
    // Find the last customer by sorting in descending order within this company
    const lastCustomer = await Customer.findOne({ companyId })
      .sort({ createdAt: -1 })
      .select('customerId');

    if (!lastCustomer || !lastCustomer.customerId) {
      return 'CUST0001';
    }

    // Extract the numeric part from the last customer ID (e.g., CUST0001 -> 1)
    const lastNumber = parseInt(lastCustomer.customerId.replace('CUST', ''));
    const nextNumber = lastNumber + 1;

    // Generate new customer ID with zero padding (e.g., CUST0002)
    return `CUST${String(nextNumber).padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating customer ID:', error);
    return 'CUST0001';
  }
};

// Create new customer
export const createCustomer = async (req, res) => {
  try {
    const companyId = req.companyId;
    const customerData = { ...req.body, companyId };

    // Auto-generate customer ID if not provided
    if (!customerData.customerId) {
      customerData.customerId = await generateCustomerId(companyId);
    }

    // Check for duplicate customerId within this company
    const existingCustomer = await Customer.findOne({
      customerId: customerData.customerId,
      companyId
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID already exists'
      });
    }

    // Check for duplicate phone within this company
    const existingPhone = await Customer.findOne({
      phone: customerData.phone,
      companyId
    });

    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    // Create customer
    const customer = new Customer(customerData);
    await customer.save();

    // Create Ledger 1: "Due to Society" - Credit balance (Liability)
    const dueToSocietyLedger = new Ledger({
      ledgerName: `${customerData.name} - Due to Society (${customerData.customerId})`,
      ledgerType: 'Liability',
      linkedEntity: {
        entityType: 'Customer',
        entityId: customer._id
      },
      openingBalance: 0,
      openingBalanceType: 'Cr',
      currentBalance: 0,
      balanceType: 'Cr',
      parentGroup: 'Current Liabilities',
      status: 'Active',
      companyId
    });

    await dueToSocietyLedger.save();

    // Create Ledger 2: "Due By" - Debit balance (Asset/Receivable)
    const dueByLedger = new Ledger({
      ledgerName: `${customerData.name} - Due By (${customerData.customerId})`,
      ledgerType: 'Asset',
      linkedEntity: {
        entityType: 'Customer',
        entityId: customer._id
      },
      openingBalance: customerData.openingBalance || 0,
      openingBalanceType: 'Dr',
      currentBalance: customerData.openingBalance || 0,
      balanceType: 'Dr',
      parentGroup: customerData.category || 'Sundry Debtors',
      status: 'Active',
      companyId
    });

    await dueByLedger.save();

    // Link both ledgers to customer
    customer.ledgerId = dueByLedger._id; // Primary ledger for receivables
    customer.dueToSocietyLedgerId = dueToSocietyLedger._id; // Secondary ledger for dues to society
    await customer.save();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully with ledger accounts',
      data: customer
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating customer'
    });
  }
};

// Get all customers with pagination, search, and filter
export const getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      active = '',
      category = '',
      state = '',
      district = '',
      minBalance = '',
      maxBalance = ''
    } = req.query;

    const query = { companyId: req.companyId };

    // Search by customerId, name, phone, or email
    if (search) {
      query.$or = [
        { customerId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (active !== '') {
      query.active = active === 'true';
    }

    if (category) query.category = category;
    if (state) query.state = { $regex: state, $options: 'i' };
    if (district) query.district = { $regex: district, $options: 'i' };
    if (minBalance !== '' || maxBalance !== '') {
      query.openingBalance = {};
      if (minBalance !== '') query.openingBalance.$gte = parseFloat(minBalance);
      if (maxBalance !== '') query.openingBalance.$lte = parseFloat(maxBalance);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Customer.countDocuments(query);

    res.status(200).json({
      success: true,
      data: customers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching customers'
    });
  }
};

// Get customer by ID
export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching customer'
    });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    // Check if customerId is being changed and if it's already taken
    if (req.body.customerId) {
      const existingCustomer = await Customer.findOne({
        customerId: req.body.customerId,
        companyId: req.companyId,
        _id: { $ne: req.params.id }
      });

      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID already exists'
        });
      }
    }

    // Check if phone is being changed and if it's already taken
    if (req.body.phone) {
      const existingPhone = await Customer.findOne({
        phone: req.body.phone,
        companyId: req.companyId,
        _id: { $ne: req.params.id }
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating customer'
    });
  }
};

// Delete/Deactivate customer
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Soft delete by setting active to false
    customer.active = false;
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Customer deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting customer'
    });
  }
};

// Search customer by customerId, name, or phone
export const searchCustomer = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const customers = await Customer.find({
      $or: [
        { customerId: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ],
      active: true,
      companyId: req.companyId
    }).limit(10);

    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error searching customer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error searching customer'
    });
  }
};

// Bulk import customers from OpenLyssa
export const bulkImportCustomers = async (req, res) => {
  try {
    const { customers } = req.body;
    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ success: false, message: 'Customers array is required' });
    }

    const CATEGORY_MAP = {
      '1': 'Others', '2': 'Others', '3': 'Anganwadi',
      '4': 'Others', '5': 'Hotel', '6': 'Others',
      '7': 'Others', '8': 'Others', '9': 'School'
    };

    const results = { total: customers.length, created: 0, updated: 0, errors: [] };

    for (let i = 0; i < customers.length; i++) {
      const row = customers[i];
      const rowNumber = i + 2;
      try {
        if (!row.customerId || !row.name) {
          results.errors.push({ row: rowNumber, customerId: row.customerId || 'N/A', message: 'customerId and name required' });
          continue;
        }

        const data = {
          customerId:    String(row.customerId),
          name:          String(row.name).trim(),
          address:       row.address  || undefined,
          category:      CATEGORY_MAP[String(row.catId || '')] || 'Others',
          active:        row.active !== false && row.active !== 'false',
          dateOfJoining: row.dateOfJoining ? new Date(row.dateOfJoining) : undefined,
          companyId:     req.companyId,
        };

        const existing = await Customer.findOne({ customerId: data.customerId, companyId: req.companyId });
        if (existing) {
          await Customer.findByIdAndUpdate(existing._id, { $set: data });
          results.updated++;
        } else {
          await Customer.create(data);
          results.created++;
        }
      } catch (err) {
        results.errors.push({ row: rowNumber, customerId: row.customerId || 'N/A', message: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Import done: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
      data: results
    });
  } catch (error) {
    console.error('Bulk import customers error:', error);
    res.status(500).json({ success: false, message: error.message || 'Bulk import failed' });
  }
};

// Get customer by customerId (for lookups)
export const getCustomerByCustomerId = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      customerId: req.params.customerId,
      active: true,
      companyId: req.companyId
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching customer'
    });
  }
};
