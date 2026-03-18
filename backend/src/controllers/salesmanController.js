import Salesman from '../models/Salesman.js';
import Ledger from '../models/Ledger.js';

// Generate auto salesmanId: SLSM0001, SLSM0002, ...
const generateSalesmanId = async (companyId) => {
  const last = await Salesman.findOne({ companyId }).sort({ salesmanId: -1 });
  if (!last) return 'SLSM0001';
  const num = parseInt(last.salesmanId.replace('SLSM', ''), 10);
  return `SLSM${String(num + 1).padStart(4, '0')}`;
};

// Create Salesman
export const createSalesman = async (req, res) => {
  try {
    const { name, phone, email, commission, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Salesman name is required' });
    }

    // Check duplicate phone within same company
    if (phone) {
      const existing = await Salesman.findOne({ phone, companyId: req.companyId });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A salesman with this phone number already exists' });
      }
    }

    const salesmanId = await generateSalesmanId(req.companyId);

    const salesman = new Salesman({
      salesmanId,
      name,
      phone,
      email,
      commission: commission || 0,
      status: status || 'Active',
      companyId: req.companyId
    });

    await salesman.save();

    // Auto-create linked Ledger (Party type)
    try {
      const ledger = new Ledger({
        ledgerName: `Salesman - ${name} (${salesmanId})`,
        ledgerType: 'Party',
        linkedEntity: { entityType: 'None' },
        status: 'Active',
        companyId: req.companyId
      });
      await ledger.save();
      salesman.ledgerId = ledger._id;
      await salesman.save();
    } catch (ledgerError) {
      console.error('Warning: Could not create ledger for salesman:', ledgerError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Salesman created successfully',
      data: salesman
    });
  } catch (error) {
    console.error('Error creating salesman:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Salesman with this ID already exists' });
    }
    res.status(400).json({ success: false, message: error.message || 'Error creating salesman' });
  }
};

// Get all salesmen with pagination, search, and filters
export const getAllSalesman = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = ''
    } = req.query;

    const query = { companyId: req.companyId };

    if (status) query.status = status;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { salesmanId: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Salesman.countDocuments(query);
    const salesmen = await Salesman.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: salesmen.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: salesmen
    });
  } catch (error) {
    console.error('Error fetching salesmen:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching salesmen' });
  }
};

// Search salesmen for invoice typeahead (top 10 active)
export const searchSalesman = async (req, res) => {
  try {
    const { query = '' } = req.query;

    const filter = {
      companyId: req.companyId,
      status: 'Active'
    };

    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { salesmanId: { $regex: query, $options: 'i' } }
      ];
    }

    const salesmen = await Salesman.find(filter).sort({ name: 1 }).limit(10);

    res.status(200).json({
      success: true,
      count: salesmen.length,
      data: salesmen
    });
  } catch (error) {
    console.error('Error searching salesmen:', error);
    res.status(500).json({ success: false, message: error.message || 'Error searching salesmen' });
  }
};

// Get salesman by ID
export const getSalesmanById = async (req, res) => {
  try {
    const salesman = await Salesman.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!salesman) {
      return res.status(404).json({ success: false, message: 'Salesman not found' });
    }
    res.status(200).json({ success: true, data: salesman });
  } catch (error) {
    console.error('Error fetching salesman:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching salesman' });
  }
};

// Update salesman
export const updateSalesman = async (req, res) => {
  try {
    const { name, phone, email, commission, status } = req.body;

    const salesman = await Salesman.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!salesman) {
      return res.status(404).json({ success: false, message: 'Salesman not found' });
    }

    // Check duplicate phone (excluding self)
    if (phone && phone !== salesman.phone) {
      const existing = await Salesman.findOne({ phone, companyId: req.companyId, _id: { $ne: salesman._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A salesman with this phone number already exists' });
      }
    }

    const oldName = salesman.name;
    if (name) salesman.name = name;
    if (phone !== undefined) salesman.phone = phone;
    if (email !== undefined) salesman.email = email;
    if (commission !== undefined) salesman.commission = commission;
    if (status) salesman.status = status;

    await salesman.save();

    // Update ledger name if salesman name changed
    if (name && name !== oldName && salesman.ledgerId) {
      try {
        await Ledger.findByIdAndUpdate(salesman.ledgerId, {
          ledgerName: `Salesman - ${name} (${salesman.salesmanId})`
        });
      } catch (ledgerError) {
        console.error('Warning: Could not update ledger name:', ledgerError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Salesman updated successfully',
      data: salesman
    });
  } catch (error) {
    console.error('Error updating salesman:', error);
    res.status(500).json({ success: false, message: error.message || 'Error updating salesman' });
  }
};

// Delete salesman (soft delete - set inactive)
export const deleteSalesman = async (req, res) => {
  try {
    const salesman = await Salesman.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!salesman) {
      return res.status(404).json({ success: false, message: 'Salesman not found' });
    }

    salesman.status = 'Inactive';
    await salesman.save();

    res.status(200).json({
      success: true,
      message: 'Salesman deactivated successfully',
      data: salesman
    });
  } catch (error) {
    console.error('Error deleting salesman:', error);
    res.status(500).json({ success: false, message: error.message || 'Error deleting salesman' });
  }
};
