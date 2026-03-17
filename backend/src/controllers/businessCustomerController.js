import BusinessCustomer from '../models/BusinessCustomer.js';

const generateCustomerId = async (companyId) => {
  try {
    const last = await BusinessCustomer.findOne({ companyId })
      .sort({ createdAt: -1 })
      .select('customerId');

    if (!last || !last.customerId) return 'BCUST0001';

    const num = parseInt(last.customerId.replace('BCUST', ''));
    return `BCUST${String(num + 1).padStart(4, '0')}`;
  } catch {
    return 'BCUST0001';
  }
};

export const createBusinessCustomer = async (req, res) => {
  try {
    const data = { ...req.body, companyId: req.companyId };

    if (!data.customerId) {
      data.customerId = await generateCustomerId(req.companyId);
    }

    const dupId = await BusinessCustomer.findOne({ customerId: data.customerId, companyId: req.companyId });
    if (dupId) return res.status(400).json({ success: false, message: 'Customer ID already exists' });

    const dupPhone = await BusinessCustomer.findOne({ phone: data.phone, companyId: req.companyId });
    if (dupPhone) return res.status(400).json({ success: false, message: 'Phone number already exists' });

    const customer = new BusinessCustomer(data);
    await customer.save();

    res.status(201).json({ success: true, message: 'Customer created successfully', data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error creating customer' });
  }
};

export const getAllBusinessCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 15, search = '', active = '', state = '', district = '' } = req.query;

    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { customerId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (active !== '') query.active = active === 'true';
    if (state) query.state = { $regex: state, $options: 'i' };
    if (district) query.district = { $regex: district, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const customers = await BusinessCustomer.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await BusinessCustomer.countDocuments(query);

    res.status(200).json({
      success: true,
      data: customers,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching customers' });
  }
};

export const getBusinessCustomerById = async (req, res) => {
  try {
    const customer = await BusinessCustomer.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching customer' });
  }
};

export const updateBusinessCustomer = async (req, res) => {
  try {
    if (req.body.customerId) {
      const dup = await BusinessCustomer.findOne({ customerId: req.body.customerId, companyId: req.companyId, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ success: false, message: 'Customer ID already exists' });
    }

    if (req.body.phone) {
      const dup = await BusinessCustomer.findOne({ phone: req.body.phone, companyId: req.companyId, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ success: false, message: 'Phone number already exists' });
    }

    const customer = await BusinessCustomer.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.status(200).json({ success: true, message: 'Customer updated successfully', data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error updating customer' });
  }
};

export const deleteBusinessCustomer = async (req, res) => {
  try {
    const customer = await BusinessCustomer.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    customer.active = false;
    await customer.save();
    res.status(200).json({ success: true, message: 'Customer deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error deleting customer' });
  }
};

export const searchBusinessCustomer = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, message: 'Search query is required' });

    const customers = await BusinessCustomer.find({
      companyId: req.companyId,
      $or: [
        { customerId: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ],
      active: true
    }).limit(10);

    res.status(200).json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error searching customers' });
  }
};
