import Supplier from '../models/Supplier.js';

// Create new supplier
export const createSupplier = async (req, res) => {
  try {
    const supplierData = req.body;

    // Check for duplicate supplierId
    const existingSupplier = await Supplier.findOne({
      supplierId: supplierData.supplierId
    });

    if (existingSupplier) {
      return res.status(400).json({
        success: false,
        message: 'Supplier ID already exists'
      });
    }

    // Check for duplicate phone
    const existingPhone = await Supplier.findOne({
      phone: supplierData.phone
    });

    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    // Create supplier
    const supplier = new Supplier(supplierData);
    await supplier.save();

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating supplier'
    });
  }
};

// Get all suppliers with pagination, search, and filter
export const getAllSuppliers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      active = ''
    } = req.query;

    const query = {};

    // Search by supplierId, name, phone, or email
    if (search) {
      query.$or = [
        { supplierId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (active !== '') {
      query.active = active === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const suppliers = await Supplier.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Supplier.countDocuments(query);

    res.status(200).json({
      success: true,
      data: suppliers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching suppliers'
    });
  }
};

// Get supplier by ID
export const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching supplier'
    });
  }
};

// Update supplier
export const updateSupplier = async (req, res) => {
  try {
    // Check if supplierId is being changed and if it's already taken
    if (req.body.supplierId) {
      const existingSupplier = await Supplier.findOne({
        supplierId: req.body.supplierId,
        _id: { $ne: req.params.id }
      });

      if (existingSupplier) {
        return res.status(400).json({
          success: false,
          message: 'Supplier ID already exists'
        });
      }
    }

    // Check if phone is being changed and if it's already taken
    if (req.body.phone) {
      const existingPhone = await Supplier.findOne({
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

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating supplier'
    });
  }
};

// Delete/Deactivate supplier
export const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Soft delete by setting active to false
    supplier.active = false;
    await supplier.save();

    res.status(200).json({
      success: true,
      message: 'Supplier deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting supplier'
    });
  }
};

// Search supplier by supplierId, name, or phone
export const searchSupplier = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const suppliers = await Supplier.find({
      $or: [
        { supplierId: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ],
      active: true
    }).limit(10);

    res.status(200).json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Error searching supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error searching supplier'
    });
  }
};

// Get supplier by supplierId (for lookups)
export const getSupplierBySupplierId = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      supplierId: req.params.supplierId,
      active: true
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching supplier'
    });
  }
};
