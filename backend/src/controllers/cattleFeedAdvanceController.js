import mongoose from 'mongoose';
import Farmer          from '../models/Farmer.js';
import ProducerOpening from '../models/ProducerOpening.js';
import Sales           from '../models/Sales.js';
import FarmerPayment   from '../models/FarmerPayment.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import Advance         from '../models/Advance.js';

const r2 = (v) => Math.round((v || 0) * 100) / 100;

// ─── Helper: build ledger entries array from all sources ─────────────────────
async function buildLedgerEntries(farmerId, companyId, start, end) {
  const fObjId = new mongoose.Types.ObjectId(farmerId);
  const cObjId = new mongoose.Types.ObjectId(companyId);

  const entries = [];

  // 1. Credit entries — Inventory Sales to farmer (Credit side = farmer owes society)
  const sales = await Sales.find({
    companyId:    cObjId,
    customerId:   fObjId,
    customerType: 'Farmer',
    billDate:     { $gte: start, $lte: end },
  }).lean();

  for (const sale of sales) {
    const itemNames = (sale.items || []).map(i => i.itemName).join(', ');
    entries.push({
      date:        sale.billDate,
      type:        'SALE',
      refNo:       sale.billNumber,
      description: `Inventory Sale${itemNames ? ' — ' + itemNames : ''}`,
      itemName:    itemNames,
      debit:       0,
      credit:      r2(sale.grandTotal || sale.totalDue || 0),
    });
  }

  // 2. Debit entries — CF Advance deductions in FarmerPayment
  const payments = await FarmerPayment.find({
    farmerId:    fObjId,
    companyId:   cObjId,
    paymentDate: { $gte: start, $lte: end },
    status:      { $ne: 'Cancelled' },
    'deductions.type': { $in: ['CF Advance', 'Cattle Feed'] },
  }).lean();

  for (const pmt of payments) {
    const cfDeds = (pmt.deductions || []).filter(d =>
      d.type === 'CF Advance' || d.type === 'Cattle Feed'
    );
    for (const ded of cfDeds) {
      if (!ded.amount) continue;
      entries.push({
        date:        pmt.paymentDate,
        type:        'PAYMENT_DEDUCTION',
        refNo:       pmt.paymentNumber,
        description: `CF Recovery — Payment (${ded.type})`,
        itemName:    '',
        debit:       r2(ded.amount),
        credit:      0,
      });
    }
  }

  // Also check advancesAdjusted for CF Advance category
  const paymentsAdj = await FarmerPayment.find({
    farmerId:    fObjId,
    companyId:   cObjId,
    paymentDate: { $gte: start, $lte: end },
    status:      { $ne: 'Cancelled' },
    'advancesAdjusted.0': { $exists: true },
  }).lean();

  // Get all CF Advance IDs for this farmer
  const cfAdvances = await Advance.find({
    farmerId:        fObjId,
    companyId:       cObjId,
    advanceCategory: 'CF Advance',
  }).select('_id').lean();
  const cfAdvIds = new Set(cfAdvances.map(a => a._id.toString()));

  for (const pmt of paymentsAdj) {
    for (const adj of (pmt.advancesAdjusted || [])) {
      if (!cfAdvIds.has(adj.advanceId?.toString())) continue;
      if (!adj.amount) continue;
      entries.push({
        date:        pmt.paymentDate,
        type:        'ADVANCE_ADJUSTMENT',
        refNo:       pmt.paymentNumber,
        description: `CF Advance Recovery — Payment adjustment`,
        itemName:    '',
        debit:       r2(adj.amount),
        credit:      0,
      });
    }
  }

  // 3. Debit entries — ProducerReceipt for CF Advance
  const receipts = await ProducerReceipt.find({
    farmerId:    fObjId,
    companyId:   cObjId,
    receiptType: 'CF Advance',
    receiptDate: { $gte: start, $lte: end },
    status:      { $ne: 'Cancelled' },
  }).lean();

  for (const rct of receipts) {
    entries.push({
      date:        rct.receiptDate,
      type:        'RECEIPT',
      refNo:       rct.receiptNumber,
      description: `CF Advance Receipt (${rct.paymentMode || 'Cash'})`,
      itemName:    '',
      debit:       r2(rct.amount),
      credit:      0,
    });
  }

  // Sort by date ascending
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  return entries;
}

// ─── GET Ledger for single farmer ────────────────────────────────────────────
export const getCFAdvanceLedger = async (req, res) => {
  try {
    const { farmerId, fromDate, toDate } = req.query;
    const companyId = req.companyId;

    if (!farmerId) {
      return res.status(400).json({ success: false, message: 'farmerId is required' });
    }

    const start = fromDate ? new Date(fromDate) : new Date('2000-01-01');
    const end   = toDate   ? new Date(toDate)   : new Date();
    end.setHours(23, 59, 59, 999);

    // Opening balance from ProducerOpening
    const opening = await ProducerOpening.findOne({
      farmerId:  new mongoose.Types.ObjectId(farmerId),
      companyId: new mongoose.Types.ObjectId(companyId),
    }).lean();
    const openingBalance = r2(opening?.cfAdvance || 0);

    // Also add any CF Advance balance from Advance model (not yet in opening)
    const advanceOpening = await Advance.aggregate([
      {
        $match: {
          farmerId:        new mongoose.Types.ObjectId(farmerId),
          companyId:       new mongoose.Types.ObjectId(companyId),
          advanceCategory: 'CF Advance',
          advanceDate:     { $lt: start },
          status:          { $in: ['Active', 'Partially Adjusted', 'Overdue'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$balanceAmount' } } },
    ]);
    const advOpeningAmt = r2(advanceOpening[0]?.total || 0);

    const effectiveOpening = openingBalance || advOpeningAmt;

    const entries = await buildLedgerEntries(farmerId, companyId, start, end);

    // Compute running balance
    let balance = effectiveOpening;
    const ledgerRows = entries.map(e => {
      balance = r2(balance + e.credit - e.debit);
      return { ...e, balance };
    });

    const totalCredit  = r2(entries.reduce((s, e) => s + e.credit, 0));
    const totalDebit   = r2(entries.reduce((s, e) => s + e.debit,  0));
    const closingBalance = r2(effectiveOpening + totalCredit - totalDebit);

    res.json({
      success: true,
      data: {
        openingBalance: effectiveOpening,
        entries:        ledgerRows,
        totalDebit,
        totalCredit,
        closingBalance,
      },
    });
  } catch (err) {
    console.error('getCFAdvanceLedger error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET Summary for all farmers ─────────────────────────────────────────────
export const getCFAdvanceSummary = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const companyId = req.companyId;
    const cObjId    = new mongoose.Types.ObjectId(companyId);

    const start = fromDate ? new Date(fromDate) : new Date('2000-01-01');
    const end   = toDate   ? new Date(toDate)   : new Date();
    end.setHours(23, 59, 59, 999);

    // 1. Opening balances per farmer (ProducerOpening)
    const openings = await ProducerOpening.find({ companyId: cObjId })
      .populate('farmerId', 'farmerNumber personalDetails')
      .lean();

    // 2. Credit per farmer — Sales to farmers in period
    const salesAgg = await Sales.aggregate([
      {
        $match: {
          companyId:    cObjId,
          customerType: 'Farmer',
          billDate:     { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id:        '$customerId',
          totalCredit: { $sum: '$grandTotal' },
          items:       { $push: '$items' },
        },
      },
    ]);
    const creditMap = {};
    salesAgg.forEach(s => {
      creditMap[s._id?.toString()] = {
        total: r2(s.totalCredit),
        items: s.items.flat().map(i => i.itemName).filter(Boolean).join(', '),
      };
    });

    // 3. Debit per farmer — FarmerPayment CF deductions in period
    const payDedAgg = await FarmerPayment.aggregate([
      {
        $match: {
          companyId:         cObjId,
          paymentDate:       { $gte: start, $lte: end },
          status:            { $ne: 'Cancelled' },
          'deductions.type': { $in: ['CF Advance', 'Cattle Feed'] },
        },
      },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: ['CF Advance', 'Cattle Feed'] } } },
      { $group: { _id: '$farmerId', totalDebit: { $sum: '$deductions.amount' } } },
    ]);
    const debitMap = {};
    payDedAgg.forEach(d => { debitMap[d._id?.toString()] = r2(d.totalDebit); });

    // 4. Debit per farmer — ProducerReceipt CF Advance in period
    const receiptAgg = await ProducerReceipt.aggregate([
      {
        $match: {
          companyId:   cObjId,
          receiptType: 'CF Advance',
          receiptDate: { $gte: start, $lte: end },
          status:      { $ne: 'Cancelled' },
        },
      },
      { $group: { _id: '$farmerId', totalDebit: { $sum: '$amount' } } },
    ]);
    receiptAgg.forEach(r => {
      const fid = r._id?.toString();
      debitMap[fid] = r2((debitMap[fid] || 0) + r.totalDebit);
    });

    // 5. Build summary rows
    const rows = openings
      .filter(o => o.farmerId)
      .map((o, i) => {
        const fid          = o.farmerId._id?.toString() || o.farmerId?.toString();
        const openingBal   = r2(o.cfAdvance || 0);
        const creditAmt    = r2(creditMap[fid]?.total  || 0);
        const debitAmt     = r2(debitMap[fid]          || 0);
        const closingBal   = r2(openingBal + creditAmt - debitAmt);
        const itemName     = creditMap[fid]?.items || '';
        const farmer       = typeof o.farmerId === 'object' ? o.farmerId : {};

        return {
          slNo:           i + 1,
          farmerId:       fid,
          producerId:     farmer.farmerNumber    || o.producerNumber || '',
          producerName:   farmer.personalDetails?.name || o.producerName || '',
          itemName,
          openingBalance: openingBal,
          debit:          debitAmt,
          credit:         creditAmt,
          balance:        closingBal,
        };
      })
      .filter(r => r.openingBalance !== 0 || r.credit !== 0 || r.debit !== 0);

    // Also include farmers who have sales but no opening record
    const openingFarmerIds = new Set(rows.map(r => r.farmerId));
    for (const [fid, salesData] of Object.entries(creditMap)) {
      if (openingFarmerIds.has(fid)) continue;
      const farmer = await Farmer.findById(fid).select('farmerNumber personalDetails').lean();
      if (!farmer) continue;
      const creditAmt  = salesData.total;
      const debitAmt   = r2(debitMap[fid] || 0);
      rows.push({
        slNo:           rows.length + 1,
        farmerId:       fid,
        producerId:     farmer.farmerNumber || '',
        producerName:   farmer.personalDetails?.name || '',
        itemName:       salesData.items,
        openingBalance: 0,
        debit:          debitAmt,
        credit:         creditAmt,
        balance:        r2(creditAmt - debitAmt),
      });
    }

    // Re-number
    rows.forEach((r, i) => { r.slNo = i + 1; });

    const grandTotals = {
      openingBalance: r2(rows.reduce((s, r) => s + r.openingBalance, 0)),
      debit:          r2(rows.reduce((s, r) => s + r.debit,          0)),
      credit:         r2(rows.reduce((s, r) => s + r.credit,         0)),
      balance:        r2(rows.reduce((s, r) => s + r.balance,        0)),
    };

    res.json({ success: true, data: { rows, grandTotals } });
  } catch (err) {
    console.error('getCFAdvanceSummary error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET farmer list (for autocomplete) ──────────────────────────────────────
export const getCFFarmers = async (req, res) => {
  try {
    const companyId = req.companyId;
    const farmers = await Farmer.find({ companyId, status: 'Active' })
      .select('farmerNumber personalDetails')
      .sort({ farmerNumber: 1 })
      .lean();

    const data = farmers.map(f => ({
      _id:          f._id,
      farmerNumber: f.farmerNumber,
      name:         f.personalDetails?.name || '',
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
