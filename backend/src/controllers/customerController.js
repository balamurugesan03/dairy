import Customer from '../models/Customer.js';
import Ledger from '../models/Ledger.js';

// Create new customer
export const createCustomer = async (req, res) => {
  try {
    const customerData = req.body;

    // Check for duplicate customerId
    const existingCustomer = await Customer.findOne({
      customerId: customerData.customerId
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID already exists'
      });
    }

    // Check for duplicate phone
    const existingPhone = await Customer.findOne({
      phone: customerData.phone
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

    // Auto-create ledger for customer with "Advance / Due" as default parent group
    const ledger = new Ledger({
      ledgerName: `${customerData.name} (${customerData.customerId})`,
      ledgerType: 'Party',
      linkedEntity: {
        entityType: 'Customer',
        entityId: customer._id
      },
      openingBalance: customerData.openingBalance || 0,
      openingBalanceType: 'Dr',
      currentBalance: customerData.openingBalance || 0,
      balanceType: 'Dr',
      parentGroup: 'Advance / Due',
      status: 'Active'
    });

    await ledger.save();

    // Link ledger to customer
    customer.ledgerId = ledger._id;
    await customer.save();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
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
      active = ''
    } = req.query;

    const query = {};

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
    const customer = await Customer.findById(req.params.id);

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
    const customer = await Customer.findById(req.params.id);

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
      active: true
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

// Get customer by customerId (for lookups)
export const getCustomerByCustomerId = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      customerId: req.params.customerId,
      active: true
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
