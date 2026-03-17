import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';

// Get Day Book report with date-wise grouping
export const getDayBook = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const companyId = req.companyId;

    // Fetch all vouchers in date range for this company
    const vouchers = await Voucher.find({
      companyId,
      voucherDate: { $gte: start, $lte: end }
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    // --- Calculate opening balance from Cash/Bank ledgers before startDate ---
    const cashBankLedgers = await Ledger.find({
      companyId,
      ledgerType: { $in: ['Cash', 'Bank'] },
      status: 'Active'
    });

    // Start with ledger opening balances (Dr = positive, Cr = negative for asset accounts)
    let openingBalance = 0;
    for (const ledger of cashBankLedgers) {
      const bal = ledger.openingBalance || 0;
      openingBalance += ledger.openingBalanceType === 'Dr' ? bal : -bal;
    }

    // Add net effect of all vouchers before startDate on Cash/Bank accounts
    const cashBankLedgerIds = cashBankLedgers.map(l => l._id.toString());

    const preVouchers = await Voucher.find({
      companyId,
      voucherDate: { $lt: start }
    }).populate('entries.ledgerId', 'ledgerName ledgerType');

    for (const voucher of preVouchers) {
      for (const entry of voucher.entries) {
        const ledgerId = entry.ledgerId?._id?.toString();
        if (ledgerId && cashBankLedgerIds.includes(ledgerId)) {
          // For asset accounts: debit increases, credit decreases
          openingBalance += (entry.debitAmount || 0) - (entry.creditAmount || 0);
        }
      }
    }

    // --- Categorize entries into Receipt and Payment, grouped by date ---
    const dateMap = {};
    const receiptSide = []; // All credit entries (flat list for backward compat)
    const paymentSide = []; // All debit entries (flat list for backward compat)

    for (const voucher of vouchers) {
      const dateKey = voucher.voucherDate.toISOString().split('T')[0];

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          receiptSide: [],
          paymentSide: [],
          totalReceipts: 0,
          totalPayments: 0
        };
      }

      for (const entry of voucher.entries) {
        const entryData = {
          date: voucher.voucherDate,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType,
          ledgerName: entry.ledgerName,
          ledgerType: entry.ledgerId?.ledgerType,
          narration: entry.narration || voucher.narration,
          voucherId: voucher._id
        };

        // Debit entries → payment side
        if (entry.debitAmount > 0) {
          const paymentEntry = { ...entryData, amount: entry.debitAmount };
          dateMap[dateKey].paymentSide.push(paymentEntry);
          dateMap[dateKey].totalPayments += entry.debitAmount;
          paymentSide.push(paymentEntry);
        }

        // Credit entries → receipt side
        if (entry.creditAmount > 0) {
          const receiptEntry = { ...entryData, amount: entry.creditAmount };
          dateMap[dateKey].receiptSide.push(receiptEntry);
          dateMap[dateKey].totalReceipts += entry.creditAmount;
          receiptSide.push(receiptEntry);
        }
      }
    }

    // --- Build dayWiseData with chained opening/closing balances ---
    const sortedDates = Object.keys(dateMap).sort();
    const dayWiseData = [];
    let runningBalance = openingBalance;

    for (const dateKey of sortedDates) {
      const day = dateMap[dateKey];
      day.openingBalance = runningBalance;
      day.closingBalance = runningBalance + day.totalReceipts - day.totalPayments;
      runningBalance = day.closingBalance;
      dayWiseData.push(day);
    }

    // --- Summary ---
    const totalReceipts = receiptSide.reduce((sum, e) => sum + e.amount, 0);
    const totalPayments = paymentSide.reduce((sum, e) => sum + e.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        startDate,
        endDate,
        dayWiseData,
        receiptSide,
        paymentSide,
        summary: {
          openingBalance,
          closingBalance: openingBalance + totalReceipts - totalPayments,
          totalReceipts,
          totalPayments
        }
      }
    });
  } catch (error) {
    console.error('Error generating day book:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating day book'
    });
  }
};

export default {
  getDayBook
};
