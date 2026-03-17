import MilkAnalyzerReading from '../models/MilkAnalyzerReading.js';

// POST /api/milk-analyzer — Save a reading (manual or from serial)
export const saveReading = async (req, res) => {
  try {
    const { farmerName, fat, snf, clr, density, date, rawData, source } = req.body;

    if (!farmerName || fat == null || snf == null) {
      return res.status(400).json({ success: false, message: 'farmerName, fat, and snf are required' });
    }

    const reading = new MilkAnalyzerReading({
      farmerName,
      fat:      parseFloat(fat),
      snf:      parseFloat(snf),
      clr:      clr != null ? parseFloat(clr) : null,
      density:  density != null ? parseFloat(density) : null,
      date:     date ? new Date(date) : new Date(),
      rawData:  rawData || '',
      source:   source || 'manual',
      companyId: req.companyId
    });

    await reading.save();
    res.status(201).json({ success: true, data: reading });
  } catch (error) {
    console.error('Error saving milk analyzer reading:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/milk-analyzer — List readings (with optional date range and search)
export const getReadings = async (req, res) => {
  try {
    const { fromDate, toDate, search, page = 1, limit = 50 } = req.query;

    const filter = { companyId: req.companyId };

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        filter.date.$lte = to;
      }
    }

    if (search) {
      filter.farmerName = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [readings, total] = await Promise.all([
      MilkAnalyzerReading.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MilkAnalyzerReading.countDocuments(filter)
    ]);

    res.json({ success: true, data: readings, total, page: parseInt(page) });
  } catch (error) {
    console.error('Error fetching milk analyzer readings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/milk-analyzer/:id
export const deleteReading = async (req, res) => {
  try {
    const reading = await MilkAnalyzerReading.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId
    });

    if (!reading) {
      return res.status(404).json({ success: false, message: 'Reading not found' });
    }

    res.json({ success: true, message: 'Reading deleted' });
  } catch (error) {
    console.error('Error deleting milk analyzer reading:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
