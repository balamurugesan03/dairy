import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';

// Get Day Book report
export const getDayBook = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Build query
    const query = {
      voucherDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Fetch all vouchers in date range
    const vouchers = await Voucher.find(query)
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    // Categorize entries into Receipt (Credits) and Payment (Debits)
    const receiptSide = []; // Credit entries
    const paymentSide = []; // Debit entries

    for (const voucher of vouchers) {
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

        // Add to payment side if debit
        if (entry.debitAmount > 0) {
          paymentSide.push({
            ...entryData,
            amount: entry.debitAmount
          });
        }

        // Add to receipt side if credit
        if (entry.creditAmount > 0) {
          receiptSide.push({
            ...entryData,
            amount: entry.creditAmount
          });
        }
      }
    }

    // Calculate opening and closing balances (Cash + Bank)
    const cashLedger = await Ledger.findOne({ ledgerName: 'Cash', ledgerType: 'Cash' });
    const bankLedger = await Ledger.findOne({ ledgerName: 'Bank', ledgerType: 'Bank' });

    // Get balances at start date
    const openingBalance = (cashLedger?.currentBalance || 0) + (bankLedger?.currentBalance || 0);

    // Calculate closing balance from opening + receipts - payments (cash/bank only)
    const cashReceipts = receiptSide
      .filter(e => e.ledgerType === 'Cash' || e.ledgerType === 'Bank')
      .reduce((sum, e) => sum + e.amount, 0);

    const cashPayments = paymentSide
      .filter(e => e.ledgerType === 'Cash' || e.ledgerType === 'Bank')
      .reduce((sum, e) => sum + e.amount, 0);

    const closingBalance = openingBalance + cashReceipts - cashPayments;

    // Calculate totals
    const totalReceipts = receiptSide.reduce((sum, e) => sum + e.amount, 0);
    const totalPayments = paymentSide.reduce((sum, e) => sum + e.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        startDate,
        endDate,
        receiptSide, // All credit entries
        paymentSide, // All debit entries
        summary: {
          openingBalance,
          closingBalance,
          totalReceipts,
          totalPayments,
          cashReceipts,
          cashPayments
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
