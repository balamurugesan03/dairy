import mongoose from 'mongoose';
import ProducerOpening from '../models/ProducerOpening.js';
import Farmer from '../models/Farmer.js';
import { applyProducerOpeningLedgers } from '../utils/accountingHelper.js';

// ─── Get All Openings ──────────────────────────────────────────────────────────
export const getOpenings = async (req, res) => {
  try {
    const { page = 1, limit = 15, search } = req.query;
    const companyId = req.userCompany;

    const filter = { companyId: new mongoose.Types.ObjectId(companyId) };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ producerNumber: regex }, { producerName: regex }];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      ProducerOpening.find(filter)
        .populate('farmerId', 'farmerNumber personalDetails bankDetails status')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ProducerOpening.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('getOpenings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Create Opening ────────────────────────────────────────────────────────────
export const createOpening = async (req, res) => {
  try {
    const { farmerId, date, dueAmount, cfAdvance, loanAdvance, cashAdvance, revolvingFund } = req.body;
    const companyId = req.userCompany;

    if (!farmerId || !date) {
      return res.status(400).json({ success: false, message: 'farmerId and date are required' });
    }

    const farmer = await Farmer.findOne({
      _id: new mongoose.Types.ObjectId(farmerId),
      companyId: new mongoose.Types.ObjectId(companyId)
    }).select('farmerNumber personalDetails').lean();

    if (!farmer) {
      return res.status(404).json({ success: false, message: 'Farmer not found' });
    }

    const totalRecovery =
      (Number(cfAdvance)   || 0) +
      (Number(loanAdvance) || 0) +
      (Number(cashAdvance) || 0);

    const opening = new ProducerOpening({
      companyId,
      farmerId,
      producerNumber: farmer.farmerNumber,
      producerName: farmer.personalDetails?.name || '',
      date: new Date(date),
      dueAmount: Number(dueAmount) || 0,
      cfAdvance: Number(cfAdvance) || 0,
      loanAdvance: Number(loanAdvance) || 0,
      cashAdvance: Number(cashAdvance) || 0,
      revolvingFund: Number(revolvingFund) || 0,
      totalRecovery,
      createdBy: req.user?._id
    });

    await opening.save();

    // Sync ledger opening balances (create = delta from 0 to new amounts)
    try {
      await applyProducerOpeningLedgers(
        { farmerId, dueAmount: opening.dueAmount, cfAdvance: opening.cfAdvance, loanAdvance: opening.loanAdvance, cashAdvance: opening.cashAdvance, revolvingFund: opening.revolvingFund },
        null,
        companyId
      );
    } catch (e) { console.warn('ProducerOpening ledger sync failed:', e.message); }

    return res.status(201).json({ success: true, data: opening });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Opening balance already exists for this producer' });
    }
    console.error('createOpening error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Update Opening ────────────────────────────────────────────────────────────
export const updateOpening = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.userCompany;
    const { date, dueAmount, cfAdvance, loanAdvance, cashAdvance, revolvingFund } = req.body;

    const opening = await ProducerOpening.findOne({
      _id: id,
      companyId: new mongoose.Types.ObjectId(companyId)
    });

    if (!opening) {
      return res.status(404).json({ success: false, message: 'Opening record not found' });
    }

    // Snapshot old values before update (for ledger delta calculation)
    const oldSnapshot = {
      farmerId:      opening.farmerId,
      dueAmount:     opening.dueAmount,
      cfAdvance:     opening.cfAdvance,
      loanAdvance:   opening.loanAdvance,
      cashAdvance:   opening.cashAdvance,
      revolvingFund: opening.revolvingFund,
    };

    if (date) opening.date = new Date(date);
    opening.dueAmount     = Number(dueAmount)     ?? opening.dueAmount;
    opening.cfAdvance     = Number(cfAdvance)     ?? opening.cfAdvance;
    opening.loanAdvance   = Number(loanAdvance)   ?? opening.loanAdvance;
    opening.cashAdvance   = Number(cashAdvance)   ?? opening.cashAdvance;
    opening.revolvingFund = Number(revolvingFund) ?? opening.revolvingFund;
    opening.totalRecovery = opening.cfAdvance + opening.loanAdvance + opening.cashAdvance;

    await opening.save();

    // Sync ledger opening balances (delta = new - old)
    try {
      await applyProducerOpeningLedgers(
        { farmerId: opening.farmerId, dueAmount: opening.dueAmount, cfAdvance: opening.cfAdvance, loanAdvance: opening.loanAdvance, cashAdvance: opening.cashAdvance, revolvingFund: opening.revolvingFund },
        oldSnapshot,
        companyId
      );
    } catch (e) { console.warn('ProducerOpening ledger sync (update) failed:', e.message); }

    return res.json({ success: true, data: opening });
  } catch (error) {
    console.error('updateOpening error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Delete Opening ────────────────────────────────────────────────────────────
export const deleteOpening = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.userCompany;

    const opening = await ProducerOpening.findOneAndDelete({
      _id: id,
      companyId: new mongoose.Types.ObjectId(companyId)
    });

    if (!opening) {
      return res.status(404).json({ success: false, message: 'Opening record not found' });
    }

    // Reverse ledger opening balances (delete = delta from old to 0)
    try {
      await applyProducerOpeningLedgers(
        null,
        { farmerId: opening.farmerId, dueAmount: opening.dueAmount, cfAdvance: opening.cfAdvance, loanAdvance: opening.loanAdvance, cashAdvance: opening.cashAdvance, revolvingFund: opening.revolvingFund },
        companyId
      );
    } catch (e) { console.warn('ProducerOpening ledger sync (delete) failed:', e.message); }

    return res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('deleteOpening error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Opening by Farmer ─────────────────────────────────────────────────────
export const getOpeningByFarmer = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const companyId = req.userCompany;

    const opening = await ProducerOpening.findOne({
      farmerId: new mongoose.Types.ObjectId(farmerId),
      companyId: new mongoose.Types.ObjectId(companyId)
    }).lean();

    return res.json({ success: true, data: opening || null });
  } catch (error) {
    console.error('getOpeningByFarmer error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
