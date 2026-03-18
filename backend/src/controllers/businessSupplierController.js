import BusinessSupplier from '../models/BusinessSupplier.js';

const generateSupplierId = async (companyId) => {
  const last = await BusinessSupplier.findOne({ companyId })
    .sort({ createdAt: -1 })
    .select('supplierId');
  if (!last || !last.supplierId) return 'BSUP0001';
  const num = parseInt(last.supplierId.replace('BSUP', '')) || 0;
  return `BSUP${String(num + 1).padStart(4, '0')}`;
};

export const createBusinessSupplier = async (req, res) => {
  try {
    const data = { ...req.body, companyId: req.companyId };
    if (!data.supplierId) data.supplierId = await generateSupplierId(req.companyId);

    const dupId = await BusinessSupplier.findOne({ supplierId: data.supplierId, companyId: req.companyId });
    if (dupId) return res.status(400).json({ success: false, message: 'Supplier ID already exists' });

    const dupPhone = await BusinessSupplier.findOne({ phone: data.phone, companyId: req.companyId });
    if (dupPhone) return res.status(400).json({ success: false, message: 'Phone number already exists' });

    const supplier = new BusinessSupplier(data);
    await supplier.save();
    res.status(201).json({ success: true, message: 'Supplier created successfully', data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error creating supplier' });
  }
};

export const getAllBusinessSuppliers = async (req, res) => {
  try {
    const { page = 1, limit = 15, search = '', active = '' } = req.query;
    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { supplierId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (active !== '') query.active = active === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [suppliers, total] = await Promise.all([
      BusinessSupplier.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      BusinessSupplier.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: suppliers,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching suppliers' });
  }
};

export const getBusinessSupplierById = async (req, res) => {
  try {
    const supplier = await BusinessSupplier.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching supplier' });
  }
};

export const updateBusinessSupplier = async (req, res) => {
  try {
    if (req.body.supplierId) {
      const dup = await BusinessSupplier.findOne({ supplierId: req.body.supplierId, companyId: req.companyId, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ success: false, message: 'Supplier ID already exists' });
    }
    if (req.body.phone) {
      const dup = await BusinessSupplier.findOne({ phone: req.body.phone, companyId: req.companyId, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ success: false, message: 'Phone number already exists' });
    }

    const supplier = await BusinessSupplier.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, message: 'Supplier updated successfully', data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error updating supplier' });
  }
};

export const deleteBusinessSupplier = async (req, res) => {
  try {
    const supplier = await BusinessSupplier.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    supplier.active = false;
    await supplier.save();
    res.json({ success: true, message: 'Supplier deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error deleting supplier' });
  }
};

export const searchBusinessSupplier = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, message: 'Search query is required' });

    const suppliers = await BusinessSupplier.find({
      companyId: req.companyId,
      $or: [
        { supplierId: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ],
      active: true
    }).limit(10);

    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error searching suppliers' });
  }
};

export const getNextBusinessSupplierId = async (req, res) => {
  try {
    const nextId = await generateSupplierId(req.companyId);
    res.json({ success: true, data: { supplierId: nextId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error generating ID' });
  }
};
