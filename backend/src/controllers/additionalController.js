import Warranty from '../models/Warranty.js';
import Machine from '../models/Machine.js';
import Quotation from '../models/Quotation.js';
import Promotion from '../models/Promotion.js';

// WARRANTY CONTROLLERS
export const createWarranty = async (req, res) => {
  try {
    const warranty = new Warranty(req.body);
    await warranty.save();
    res.status(201).json({ success: true, message: 'Warranty created successfully', data: warranty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllWarranties = async (req, res) => {
  try {
    const { status = '' } = req.query;
    const query = status ? { status } : {};
    const warranties = await Warranty.find(query).sort({ warrantyEndDate: 1 });
    res.status(200).json({ success: true, data: warranties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWarrantyById = async (req, res) => {
  try {
    const warranty = await Warranty.findById(req.params.id);
    if (!warranty) return res.status(404).json({ success: false, message: 'Warranty not found' });
    res.status(200).json({ success: true, data: warranty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateWarranty = async (req, res) => {
  try {
    const warranty = await Warranty.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!warranty) return res.status(404).json({ success: false, message: 'Warranty not found' });
    res.status(200).json({ success: true, message: 'Warranty updated successfully', data: warranty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteWarranty = async (req, res) => {
  try {
    const warranty = await Warranty.findByIdAndDelete(req.params.id);
    if (!warranty) return res.status(404).json({ success: false, message: 'Warranty not found' });
    res.status(200).json({ success: true, message: 'Warranty deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// MACHINE CONTROLLERS
export const createMachine = async (req, res) => {
  try {
    const machine = new Machine(req.body);
    await machine.save();
    res.status(201).json({ success: true, message: 'Machine created successfully', data: machine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllMachines = async (req, res) => {
  try {
    const { status = '' } = req.query;
    const query = status ? { status } : {};
    const machines = await Machine.find(query).sort({ machineName: 1 });
    res.status(200).json({ success: true, data: machines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMachineById = async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.status(200).json({ success: true, data: machine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMachine = async (req, res) => {
  try {
    const machine = await Machine.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.status(200).json({ success: true, message: 'Machine updated successfully', data: machine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMachine = async (req, res) => {
  try {
    const machine = await Machine.findByIdAndDelete(req.params.id);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.status(200).json({ success: true, message: 'Machine deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// QUOTATION CONTROLLERS
export const createQuotation = async (req, res) => {
  try {
    const quotationData = req.body;

    // Generate quotation number
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const lastQuotation = await Quotation.findOne().sort({ createdAt: -1 }).limit(1);
    let sequence = 1;
    if (lastQuotation && lastQuotation.quotationNumber.startsWith(`QT${year}`)) {
      sequence = parseInt(lastQuotation.quotationNumber.slice(-4)) + 1;
    }
    quotationData.quotationNumber = `QT${year}${sequence.toString().padStart(4, '0')}`;

    const quotation = new Quotation(quotationData);
    await quotation.save();
    res.status(201).json({ success: true, message: 'Quotation created successfully', data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllQuotations = async (req, res) => {
  try {
    const { status = '' } = req.query;
    const query = status ? { status } : {};
    const quotations = await Quotation.find(query).sort({ quotationDate: -1 });
    res.status(200).json({ success: true, data: quotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.status(200).json({ success: true, message: 'Quotation updated successfully', data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.status(200).json({ success: true, message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PROMOTION CONTROLLERS
export const createPromotion = async (req, res) => {
  try {
    const promotion = new Promotion(req.body);
    await promotion.save();
    res.status(201).json({ success: true, message: 'Promotion created successfully', data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllPromotions = async (req, res) => {
  try {
    const { promotionType = '' } = req.query;
    const query = promotionType ? { promotionType } : {};
    const promotions = await Promotion.find(query).sort({ promotionDate: -1 });
    res.status(200).json({ success: true, data: promotions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPromotionById = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.status(200).json({ success: true, data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.status(200).json({ success: true, message: 'Promotion updated successfully', data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findByIdAndDelete(req.params.id);
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.status(200).json({ success: true, message: 'Promotion deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createWarranty, getAllWarranties, getWarrantyById, updateWarranty, deleteWarranty,
  createMachine, getAllMachines, getMachineById, updateMachine, deleteMachine,
  createQuotation, getAllQuotations, getQuotationById, updateQuotation, deleteQuotation,
  createPromotion, getAllPromotions, getPromotionById, updatePromotion, deletePromotion
};
