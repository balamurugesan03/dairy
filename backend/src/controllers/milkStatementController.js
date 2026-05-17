import mongoose from 'mongoose';
import MilkCollection from '../models/MilkCollection.js';
import MilkSales from '../models/MilkSales.js';
import Farmer from '../models/Farmer.js';
import PaymentRegister from '../models/PaymentRegister.js';
import Company from '../models/Company.js';

export const getMilkStatement = async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    const companyId = req.userCompany;
    const cid = new mongoose.Types.ObjectId(companyId);

    if (!month) return res.status(400).json({ success: false, message: 'month is required (YYYY-MM)' });

    const [year, monthNum] = month.split('-').map(Number);
    const start = new Date(year, monthNum - 1, 1);
    const end   = new Date(year, monthNum, 0, 23, 59, 59, 999);

    // 1. Society name
    const company = await Company.findById(companyId).select('companyName societyName').lean();
    const societyName = company?.societyName || company?.companyName || '';

    // 2. Registered member / non-member counts
    const [totalMembers, totalNonMembers] = await Promise.all([
      Farmer.countDocuments({ companyId, status: 'Active', isMembership: true }),
      Farmer.countDocuments({ companyId, status: 'Active', isMembership: false }),
    ]);

    // 3. Milk-pouring members / non-members this month (distinct farmers)
    const pouringAgg = await MilkCollection.aggregate([
      { $match: { companyId: cid, date: { $gte: start, $lte: end } } },
      { $lookup: { from: 'farmers', localField: 'farmer', foreignField: '_id', as: 'fd' } },
      { $addFields: { isMember: { $ifNull: [{ $arrayElemAt: ['$fd.isMembership', 0] }, false] } } },
      { $group: {
        _id: null,
        memberIds:    { $addToSet: { $cond: ['$isMember',        '$farmer', '$$REMOVE'] } },
        nonMemberIds: { $addToSet: { $cond: [{ $not: ['$isMember'] }, '$farmer', '$$REMOVE'] } },
      }},
    ]);
    const pouringMembers    = (pouringAgg[0]?.memberIds    || []).filter(Boolean).length;
    const pouringNonMembers = (pouringAgg[0]?.nonMemberIds || []).filter(Boolean).length;

    // 4. Total collected milk
    const [collectedAgg] = await MilkCollection.aggregate([
      { $match: { companyId: cid, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, qty: { $sum: '$qty' }, amount: { $sum: '$amount' } } },
    ]);

    // 5. Sales by mode (LOCAL, CREDIT, SAMPLE)
    const salesByMode = await MilkSales.aggregate([
      { $match: { companyId: cid, date: { $gte: start, $lte: end } } },
      { $group: { _id: '$saleMode', qty: { $sum: '$litre' }, amount: { $sum: '$amount' } } },
    ]);
    const sm = {};
    salesByMode.forEach(s => { sm[s._id] = { qty: s.qty || 0, amount: s.amount || 0 }; });

    // 6. Welfare from PaymentRegisters whose cycle falls in this month
    const [welfareAgg] = await PaymentRegister.aggregate([
      { $match: { companyId: cid, toDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalWelfare: { $sum: '$totalWelfare' } } },
    ]);

    res.json({
      success: true,
      data: {
        societyName,
        totalMembers,
        totalNonMembers,
        pouringMembers,
        pouringNonMembers,
        collectedQty:     parseFloat((collectedAgg?.qty    || 0).toFixed(2)),
        collectedAmount:  parseFloat((collectedAgg?.amount || 0).toFixed(2)),
        localSalesQty:    parseFloat(((sm.LOCAL  || {}).qty    || 0).toFixed(2)),
        localSalesAmount: parseFloat(((sm.LOCAL  || {}).amount || 0).toFixed(2)),
        creditSalesQty:   parseFloat(((sm.CREDIT || {}).qty    || 0).toFixed(2)),
        creditSalesAmount:parseFloat(((sm.CREDIT || {}).amount || 0).toFixed(2)),
        sampleSalesQty:   parseFloat(((sm.SAMPLE || {}).qty    || 0).toFixed(2)),
        farmerWelfare:    parseFloat((welfareAgg?.totalWelfare || 0).toFixed(2)),
      },
    });
  } catch (err) {
    console.error('getMilkStatement error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
