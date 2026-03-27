import FinancialYear from '../models/FinancialYear.js';

/**
 * Middleware factory — blocks write operations when the transaction date
 * falls inside a frozen (closed) financial year.
 *
 * Usage: router.post('/', checkFrozenPeriod('date'), createHandler)
 *
 * @param {string|string[]} dateFields - req.body field(s) to check (default: 'date')
 */
export const checkFrozenPeriod = (dateFields = 'date') => async (req, res, next) => {
  try {
    const fields = Array.isArray(dateFields) ? dateFields : [dateFields];
    let date;
    for (const f of fields) {
      if (req.body[f]) { date = req.body[f]; break; }
    }
    if (!date) return next(); // no date in body — skip check

    const frozen = await FinancialYear.findOne({
      companyId: req.companyId,
      isFrozen:  true,
      startDate: { $lte: new Date(date) },
      endDate:   { $gte: new Date(date) }
    }).select('name');

    if (frozen) {
      return res.status(403).json({
        success: false,
        message: `Period is frozen — Financial Year "${frozen.name}" is closed. Unfreeze it to make changes.`
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};
