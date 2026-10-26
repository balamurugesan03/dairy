import mongoose from 'mongoose';
import MilkCollection from '../models/MilkCollection.js';
import Farmer from '../models/Farmer.js';
import { FARMER_KEY } from '../utils/farmerSeries.js';

// ── Date helpers ──────────────────────────────────────────────────────────────

const dayBounds = (dateStr) => {
  const d = new Date(dateStr);
  return {
    start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
    end:   new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  };
};

const prevRange = (dateStr, pouringDays) => {
  const d = new Date(dateStr);
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  return {
    start: new Date(y, m, day - pouringDays, 0, 0, 0, 0),
    end:   new Date(y, m, day - 1, 23, 59, 59, 999)
  };
};

// Safely cast to ObjectId for aggregation pipelines
const toObjId = (id) => {
  const s = id?.toString();
  return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : id;
};

// One key per farmer — numbers can repeat across centres (centre-wise series);
// rows without a farmer link fall back to the number. Matches FARMER_KEY.
const fkey = (r) => String(r.farmer?._id || r.farmer || r.farmerNumber);

// ── Shared record shape ───────────────────────────────────────────────────────

const enrichRecord = (rec, avg) => ({
  _id:          rec._id,
  farmerId:     rec.farmer?._id || null,
  farmerNumber: rec.farmerNumber,
  farmerName:   rec.farmerName,
  memberId:     rec.farmer?.memberId || '',
  houseName:    rec.farmer?.address?.houseName || '',
  shift:        rec.shift,
  qty:          rec.qty,
  fat:          rec.fat,
  snf:          rec.snf,
  clr:          rec.clr,
  rate:         rec.rate,
  amount:       rec.amount,
  center:       rec.collectionCenter?.centerName || '',
  agent:        rec.agent?.name || '',
  avgQty:       avg ? +avg.avgQty.toFixed(2) : null,
  avgFat:       avg ? +avg.avgFat.toFixed(2) : null,
  avgSnf:       avg ? +avg.avgSnf.toFixed(2) : null,
  avgClr:       avg ? +avg.avgClr.toFixed(2) : null,
  qtyDev:       avg ? +(rec.qty - avg.avgQty).toFixed(2) : null,
  fatDev:       avg ? +(rec.fat - avg.avgFat).toFixed(2) : null,
  snfDev:       avg ? +(rec.snf - avg.avgSnf).toFixed(2) : null,
  pouringCount: avg?.pouringCount || 0,
});

// ── Main report endpoint ──────────────────────────────────────────────────────

export const getReport = async (req, res) => {
  try {
    const { date, shift, pouringDays: pd = 20, reportType } = req.query;
    if (!date || !reportType) {
      return res.status(400).json({ success: false, message: 'date and reportType are required' });
    }

    const pouringDays  = parseInt(pd, 10);
    const companyId    = toObjId(req.companyId);
    const shiftFilter  = shift && shift !== 'ALL' ? { shift } : {};

    const { start: todayStart, end: todayEnd } = dayBounds(date);
    const { start: prevStart,  end: prevEnd  } = prevRange(date, pouringDays);

    // Parallel: today's detailed records + previous-period avg per farmer
    const [todayRecs, prevAgg] = await Promise.all([
      MilkCollection.find({
        companyId,
        date: { $gte: todayStart, $lte: todayEnd },
        ...shiftFilter
      })
        .populate('collectionCenter', 'centerName')
        .populate('agent', 'name')
        .populate('farmer', 'memberId address')
        .lean(),

      MilkCollection.aggregate([
        {
          $match: {
            companyId,
            date: { $gte: prevStart, $lte: prevEnd },
            ...shiftFilter
          }
        },
        {
          $group: {
            _id:          FARMER_KEY,
            avgQty:       { $avg: '$qty' },
            avgFat:       { $avg: '$fat' },
            avgSnf:       { $avg: '$snf' },
            avgClr:       { $avg: '$clr' },
            pouringCount: { $sum: 1 }
          }
        }
      ])
    ]);

    const prevMap = Object.fromEntries(prevAgg.map(p => [String(p._id), p]));

    let data;

    switch (reportType) {

      case 'abnormalQty': {
        // Qty differs > max(1.5 L, 30% of avg)
        data = todayRecs
          .filter(r => {
            const a = prevMap[fkey(r)];
            return a && Math.abs(r.qty - a.avgQty) > Math.max(1.5, 0.3 * a.avgQty);
          })
          .map(r => enrichRecord(r, prevMap[fkey(r)]));
        break;
      }

      case 'abnormalFat': {
        // FAT differs > 0.5 percentage points
        data = todayRecs
          .filter(r => {
            const a = prevMap[fkey(r)];
            return a && Math.abs(r.fat - a.avgFat) > 0.5;
          })
          .map(r => enrichRecord(r, prevMap[fkey(r)]));
        break;
      }

      case 'abnormalSnf': {
        // SNF differs > 0.3 percentage points
        data = todayRecs
          .filter(r => {
            const a = prevMap[fkey(r)];
            return a && Math.abs(r.snf - a.avgSnf) > 0.3;
          })
          .map(r => enrichRecord(r, prevMap[fkey(r)]));
        break;
      }

      case 'missingProducers': {
        const todayKeys  = new Set(todayRecs.map(fkey));
        const missingKeys = Object.keys(prevMap).filter(k => !todayKeys.has(k));

        if (!missingKeys.length) { data = []; break; }
        const missingIds = missingKeys.filter(k => mongoose.Types.ObjectId.isValid(k) && k.length === 24).map(toObjId);
        const missingNos = missingKeys.filter(k => !(mongoose.Types.ObjectId.isValid(k) && k.length === 24));

        // Get each missing farmer's most-recent collection from the prev period
        const lastRecs = await MilkCollection.aggregate([
          {
            $match: {
              companyId,
              date:         { $gte: prevStart, $lte: prevEnd },
              $or: [{ farmer: { $in: missingIds } }, { farmer: null, farmerNumber: { $in: missingNos } }],
              ...shiftFilter
            }
          },
          { $sort: { date: -1 } },
          { $group: { _id: FARMER_KEY, doc: { $first: '$$ROOT' } } },
          { $replaceRoot: { newRoot: '$doc' } },
          {
            $lookup: {
              from: 'collectioncenters', localField: 'collectionCenter',
              foreignField: '_id', as: 'collectionCenter'
            }
          },
          { $unwind: { path: '$collectionCenter', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'agents', localField: 'agent', foreignField: '_id', as: 'agent' } },
          { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'farmers', localField: 'farmer', foreignField: '_id', as: 'farmer' } },
          { $unwind: { path: '$farmer', preserveNullAndEmptyArrays: true } }
        ]);

        data = lastRecs.map(r => ({
          _id:             r._id,
          farmerId:        r.farmer?._id || null,
          farmerNumber:    r.farmerNumber,
          farmerName:      r.farmerName,
          memberId:        r.farmer?.memberId || '',
          houseName:       r.farmer?.address?.houseName || '',
          shift:           r.shift,
          qty:             r.qty,
          fat:             r.fat,
          snf:             r.snf,
          clr:             r.clr,
          rate:            r.rate,
          amount:          r.amount,
          center:          r.collectionCenter?.centerName || '',
          agent:           r.agent?.name || '',
          lastPouringDate: r.date,
          avgQty:          prevMap[fkey(r)] ? +prevMap[fkey(r)].avgQty.toFixed(2) : null,
          pouringCount:    prevMap[fkey(r)]?.pouringCount || 0
        }));
        break;
      }

      case 'newComers': {
        // Poured today but zero history in previous N days
        data = todayRecs
          .filter(r => !prevMap[fkey(r)])
          .map(r => enrichRecord(r, null));
        break;
      }

      case 'pouringOtherCenter': {
        // Find each farmer's most-common center in prev period
        const centerAgg = await MilkCollection.aggregate([
          {
            $match: {
              companyId,
              date: { $gte: prevStart, $lte: prevEnd },
              ...shiftFilter
            }
          },
          {
            $group: {
              _id:   { farmer: FARMER_KEY, center: '$collectionCenter' },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.farmer': 1, count: -1 } },
          {
            $group: {
              _id:         '$_id.farmer',
              usualCenter: { $first: '$_id.center' }
            }
          },
          {
            $lookup: {
              from: 'collectioncenters', localField: 'usualCenter',
              foreignField: '_id', as: 'usualCenterInfo'
            }
          },
          { $unwind: { path: '$usualCenterInfo', preserveNullAndEmptyArrays: true } }
        ]);

        const usualMap = Object.fromEntries(
          centerAgg.map(c => [String(c._id), {
            id:   c.usualCenter?.toString(),
            name: c.usualCenterInfo?.centerName || ''
          }])
        );

        data = todayRecs
          .filter(r => {
            const usual = usualMap[fkey(r)];
            return usual?.id && r.collectionCenter?._id?.toString() !== usual.id;
          })
          .map(r => ({
            ...enrichRecord(r, prevMap[fkey(r)]),
            usualCenter: usualMap[fkey(r)]?.name || ''
          }));
        break;
      }

      default:
        return res.status(400).json({ success: false, message: 'Invalid reportType' });
    }

    res.json({ success: true, data, total: data.length });
  } catch (err) {
    console.error('intelligentQuery getReport error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Producer detail for drawer ────────────────────────────────────────────────

export const getProducerDetail = async (req, res) => {
  try {
    const { farmerNumber } = req.params;
    const companyId = req.companyId;
    // ?farmerId= pins the farmer when the number is shared by two centres (centre-wise series)
    const farmerId = mongoose.Types.ObjectId.isValid(String(req.query.farmerId || '')) ? req.query.farmerId : null;

    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const [farmer, history] = await Promise.all([
      Farmer.findOne(farmerId ? { _id: farmerId, companyId } : { farmerNumber, companyId })
        .populate('collectionCenter', 'centerName centerCode')
        .lean(),
      MilkCollection.find({ companyId, farmerNumber, ...(farmerId ? { farmer: farmerId } : {}), date: { $gte: since } })
        .sort({ date: -1, shift: 1 })
        .lean()
    ]);

    const n      = history.length;
    const avg    = (field) => n ? +(history.reduce((s, r) => s + (r[field] || 0), 0) / n).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        farmer,
        history,
        analytics: {
          avgQty:           avg('qty'),
          avgFat:           avg('fat'),
          avgSnf:           avg('snf'),
          avgClr:           avg('clr'),
          totalCollections: n
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
