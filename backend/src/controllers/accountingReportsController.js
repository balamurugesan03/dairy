import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import MilkSales from '../models/MilkSales.js';
import Sales from '../models/Sales.js';
import FarmerPayment from '../models/FarmerPayment.js';
import Advance from '../models/Advance.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import BankTransfer from '../models/BankTransfer.js';
import MilkCollection from '../models/MilkCollection.js';
import { getDateRange } from '../utils/dateFilters.js';
import {
  calculateOpeningBalance,
  calculateClosingBalance,
  isDebitNatureLedger,
  getBalanceType,
  getLedgerCategory
} from '../utils/balanceCalculator.js';

// 1. CASH BOOK REPORT
export const getCashBook = async (req, res) => {
  try {
    const { startDate, endDate, filterType, customStart, customEnd } = req.query;

    // Get date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      dateFilter = getDateRange('thisMonth');
    }

    // Validate dates
    if (isNaN(dateFilter.startDate.getTime()) || isNaN(dateFilter.endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameters provided'
      });
    }

    // Find cash ledger — auto-create if missing
    let cashLedger = await Ledger.findOne({ ledgerType: 'Cash', status: 'Active', companyId: req.companyId });
    if (!cashLedger) {
      cashLedger = new Ledger({
        ledgerName: 'Cash in Hand',
        ledgerType: 'Cash',
        openingBalance: 0,
        currentBalance: 0,
        balanceType: 'Dr',
        companyId: req.companyId
      });
      await cashLedger.save();
    }

    // Calculate opening balance
    const openingBalance = await calculateOpeningBalance(
      Ledger,
      Voucher,
      cashLedger._id,
      dateFilter.startDate,
      req.companyId
    );

    // Get all vouchers affecting cash in the period
    const vouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': cashLedger._id
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    // Direct cash receipts — Milk Sales (Cash)
    const milkSalesCash = await MilkSales.find({
      companyId: req.companyId,
      date: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentType: 'Cash',
      amount: { $gt: 0 }
    }).sort({ date: 1 });

    // Direct cash receipts — Item Sales (Cash)
    const itemSalesCash = await Sales.find({
      companyId: req.companyId,
      billDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      paidAmount: { $gt: 0 }
    }).sort({ billDate: 1 });

    // Direct cash payments — Farmer Payments (Cash)
    const farmerPaymentsCash = await FarmerPayment.find({
      companyId: req.companyId,
      paymentDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      paidAmount: { $gt: 0 }
    }).sort({ paymentDate: 1 }).populate('farmerId', 'farmerName farmerNumber');

    // Direct cash payments — Advances to Farmers (Cash)
    const advancesCash = await Advance.find({
      companyId: req.companyId,
      advanceDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      advanceAmount: { $gt: 0 }
    }).sort({ advanceDate: 1 }).populate('farmerId', 'farmerName farmerNumber');

    // Direct cash payments — Producer Receipts/Loans (Cash)
    const producerReceiptsCash = await ProducerReceipt.find({
      companyId: req.companyId,
      receiptDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      paymentMode: 'Cash',
      amount: { $gt: 0 }
    }).sort({ receiptDate: 1 }).populate('farmerId', 'farmerName farmerNumber');

    // Completed Bank Transfers — Payment side
    const completedBankTransfers = await BankTransfer.find({
      companyId: req.companyId,
      status: 'Completed',
      applyDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
      totalTransferAmount: { $gt: 0 }
    }).sort({ applyDate: 1 });

    // Milk Purchase day totals — Payment side (one entry per day)
    const milkPurchaseDayTotals = await MilkCollection.aggregate([
      {
        $match: {
          companyId: req.companyId,
          date: { $gte: dateFilter.startDate, $lte: dateFilter.endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalAmount: { $sum: '$amount' },
          totalQty: { $sum: '$qty' },
          farmerCount: { $addToSet: '$farmer' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Collect raw transactions before sorting
    const rawTransactions = [];

    // From vouchers (existing accounting entries)
    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId._id.toString() === cashLedger._id.toString()) {
          const isReceipt = entry.debitAmount > 0;
          const amount = isReceipt ? entry.debitAmount : entry.creditAmount;
          const contraEntry = voucher.entries.find(
            e => e.ledgerId._id.toString() !== cashLedger._id.toString()
          );
          rawTransactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            particulars: isReceipt
              ? `From ${contraEntry?.ledgerId?.ledgerName || 'Various'}`
              : `To ${contraEntry?.ledgerId?.ledgerName || 'Various'}`,
            voucherId: voucher._id,
            debit: isReceipt ? amount : 0,
            credit: isReceipt ? 0 : amount,
            narration: entry.narration || voucher.narration
          });
        }
      });
    });

    // Milk Sales — Cash Receipts
    milkSalesCash.forEach(ms => {
      rawTransactions.push({
        date: ms.date,
        voucherNumber: ms.billNumber || ms.invoiceNumber || `MS-${ms._id.toString().slice(-6)}`,
        voucherType: 'MilkSales',
        particulars: `Milk Sales — ${ms.agentName || ms.creditorName || 'Cash Customer'}`,
        debit: ms.amount,
        credit: 0,
        narration: 'Milk Sales (Cash)'
      });
    });

    // Item Sales — Cash Receipts
    itemSalesCash.forEach(sale => {
      rawTransactions.push({
        date: sale.billDate,
        voucherNumber: sale.billNumber || sale.invoiceNumber || `SAL-${sale._id.toString().slice(-6)}`,
        voucherType: 'Sale',
        particulars: `Sales — ${sale.customerName || 'Cash Customer'}`,
        debit: sale.paidAmount,
        credit: 0,
        narration: sale.narration || 'Item Sales (Cash)'
      });
    });

    // Farmer Payments — Cash Payments
    farmerPaymentsCash.forEach(fp => {
      const farmerName = fp.farmerId?.farmerName || fp.farmerId?.farmerNumber || 'Farmer';
      rawTransactions.push({
        date: fp.paymentDate,
        voucherNumber: fp.paymentNumber || `FP-${fp._id.toString().slice(-6)}`,
        voucherType: 'FarmerPayment',
        particulars: `Farmer Payment — ${farmerName}`,
        debit: 0,
        credit: fp.paidAmount,
        narration: fp.narration || 'Farmer Payment (Cash)'
      });
    });

    // Advances — Cash Payments
    advancesCash.forEach(adv => {
      const farmerName = adv.farmerId?.farmerName || adv.farmerId?.farmerNumber || 'Farmer';
      rawTransactions.push({
        date: adv.advanceDate,
        voucherNumber: adv.advanceNumber || `ADV-${adv._id.toString().slice(-6)}`,
        voucherType: 'Advance',
        particulars: `Advance — ${farmerName}`,
        debit: 0,
        credit: adv.advanceAmount,
        narration: adv.narration || 'Advance to Farmer (Cash)'
      });
    });

    // Producer Receipts/Loans — Cash Payments
    producerReceiptsCash.forEach(pr => {
      const farmerName = pr.farmerId?.farmerName || pr.farmerId?.farmerNumber || 'Producer';
      rawTransactions.push({
        date: pr.receiptDate,
        voucherNumber: pr.receiptNumber || `PR-${pr._id.toString().slice(-6)}`,
        voucherType: 'ProducerLoan',
        particulars: `${pr.receiptType || 'Loan'} — ${farmerName}`,
        debit: 0,
        credit: pr.amount,
        narration: pr.narration || `${pr.receiptType || 'Producer Loan'} (Cash)`
      });
    });

    // Completed Bank Transfers — Payment side
    completedBankTransfers.forEach(bt => {
      rawTransactions.push({
        date: bt.applyDate,
        voucherNumber: bt.transferNumber || `BT-${bt._id.toString().slice(-6)}`,
        voucherType: 'BankTransfer',
        particulars: `Producer Due — ${bt.transferNumber} (${bt.totalApproved} producers)`,
        debit: 0,
        credit: bt.totalTransferAmount,
        narration: bt.remarks || `Bank Transfer Payment — ${bt.totalApproved} producers`
      });
    });

    // Milk Purchase day totals — Payment side
    milkPurchaseDayTotals.forEach(day => {
      rawTransactions.push({
        date: new Date(day._id),
        voucherNumber: `MKP-${day._id.replace(/-/g, '')}`,
        voucherType: 'MilkPurchase',
        particulars: `Milk Purchase — ${day.farmerCount.length} farmers (${day.totalQty.toFixed(2)} L)`,
        debit: 0,
        credit: day.totalAmount,
        narration: `Milk Purchase Day Total — ${day._id}`
      });
    });

    // Sort all by date
    rawTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    const transactions = [];
    let runningBalance = openingBalance;
    rawTransactions.forEach(txn => {
      runningBalance += (txn.debit || 0) - (txn.credit || 0);
      transactions.push({ ...txn, balance: runningBalance });
    });

    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);
    const closingBalance = runningBalance;

    res.status(200).json({
      success: true,
      data: {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        openingBalance,
        closingBalance,
        transactions,
        summary: {
          totalReceipts: totalDebits,
          totalPayments: totalCredits,
          netChange: totalDebits - totalCredits
        }
      }
    });
  } catch (error) {
    console.error('Error generating cash book:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating cash book'
    });
  }
};

// 2. GENERAL LEDGER REPORT
export const getGeneralLedger = async (req, res) => {
  try {
    const { ledgerId, startDate, endDate, filterType, customStart, customEnd } = req.query;

    if (!ledgerId) {
      return res.status(400).json({
        success: false,
        message: 'Ledger ID is required'
      });
    }

    // Get date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999); // include the full end date
      dateFilter = { startDate: start, endDate: end };
    } else {
      dateFilter = getDateRange('thisMonth');
    }

    // Validate dates
    if (isNaN(dateFilter.startDate.getTime()) || isNaN(dateFilter.endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameters provided'
      });
    }

    // Get ledger details
    const ledger = await Ledger.findOne({ _id: ledgerId, companyId: req.companyId });
    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    // Calculate opening balance
    const openingBalance = await calculateOpeningBalance(
      Ledger,
      Voucher,
      ledgerId,
      dateFilter.startDate,
      req.companyId
    );

    // Get all voucher entries for this ledger in the period
    const vouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': ledgerId
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    const isDebitNature = isDebitNatureLedger(ledger.ledgerType);

    // Process transactions with running balance
    const transactions = [];
    let runningBalance = openingBalance;

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId._id.toString() === ledgerId.toString()) {
          // Calculate new balance
          const netChange = entry.debitAmount - entry.creditAmount;
          if (isDebitNature) {
            runningBalance += netChange;
          } else {
            runningBalance -= netChange;
          }

          // Find contra ledger (the other side of the entry)
          const contraEntry = voucher.entries.find(
            e => e.ledgerId._id.toString() !== ledgerId.toString()
          );

          transactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            particulars: contraEntry ? contraEntry.ledgerName : 'Various',
            voucherId: voucher._id,
            debit: entry.debitAmount,
            credit: entry.creditAmount,
            balance: Math.abs(runningBalance),
            balanceType: getBalanceType(runningBalance, isDebitNature),
            narration: entry.narration || voucher.narration
          });
        }
      });
    });

    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);

    res.status(200).json({
      success: true,
      data: {
        ledger: {
          id: ledger._id,
          name: ledger.ledgerName,
          type: ledger.ledgerType
        },
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        openingBalance: Math.abs(openingBalance),
        openingBalanceType: getBalanceType(openingBalance, isDebitNature),
        closingBalance: Math.abs(runningBalance),
        closingBalanceType: getBalanceType(runningBalance, isDebitNature),
        transactions,
        summary: {
          totalDebits,
          totalCredits,
          difference: totalDebits - totalCredits
        }
      }
    });
  } catch (error) {
    console.error('Error generating general ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating general ledger'
    });
  }
};

// 3. GENERAL LEDGER ABSTRACT
export const getGeneralLedgerAbstract = async (req, res) => {
  try {
    const { startDate, endDate, filterType, customStart, customEnd, ledgerType } = req.query;

    // Get date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      dateFilter = getDateRange('thisMonth');
    }

    // Validate dates
    if (isNaN(dateFilter.startDate.getTime()) || isNaN(dateFilter.endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameters provided'
      });
    }

    // Get ledgers (optionally filtered by type)
    const query = { status: 'Active', companyId: req.companyId };
    if (ledgerType) query.ledgerType = ledgerType;

    const ledgers = await Ledger.find(query).sort({ ledgerName: 1 });

    // Process each ledger
    const abstract = await Promise.all(
      ledgers.map(async ledger => {
        // Calculate opening balance
        const openingBalance = await calculateOpeningBalance(
          Ledger,
          Voucher,
          ledger._id,
          dateFilter.startDate,
          req.companyId
        );

        // Get transactions in period
        const vouchers = await Voucher.find({
          companyId: req.companyId,
          voucherDate: {
            $gte: dateFilter.startDate,
            $lte: dateFilter.endDate
          },
          'entries.ledgerId': ledger._id
        });

        let totalDebits = 0;
        let totalCredits = 0;

        vouchers.forEach(voucher => {
          voucher.entries.forEach(entry => {
            if (entry.ledgerId.toString() === ledger._id.toString()) {
              totalDebits += entry.debitAmount;
              totalCredits += entry.creditAmount;
            }
          });
        });

        const isDebitNature = isDebitNatureLedger(ledger.ledgerType);
        const closingBalance = calculateClosingBalance(openingBalance, totalDebits, totalCredits, isDebitNature);

        return {
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          ledgerType: ledger.ledgerType,
          category: getLedgerCategory(ledger.ledgerType),
          openingBalance: Math.abs(openingBalance),
          openingBalanceType: getBalanceType(openingBalance, isDebitNature),
          totalDebits,
          totalCredits,
          closingBalance: Math.abs(closingBalance),
          closingBalanceType: getBalanceType(closingBalance, isDebitNature)
        };
      })
    );

    // Calculate totals
    const summary = {
      totalLedgers: abstract.length,
      totalOpeningDebit: abstract
        .filter(a => a.openingBalanceType === 'Dr')
        .reduce((sum, a) => sum + a.openingBalance, 0),
      totalOpeningCredit: abstract
        .filter(a => a.openingBalanceType === 'Cr')
        .reduce((sum, a) => sum + a.openingBalance, 0),
      totalDebits: abstract.reduce((sum, a) => sum + a.totalDebits, 0),
      totalCredits: abstract.reduce((sum, a) => sum + a.totalCredits, 0),
      totalClosingDebit: abstract
        .filter(a => a.closingBalanceType === 'Dr')
        .reduce((sum, a) => sum + a.closingBalance, 0),
      totalClosingCredit: abstract
        .filter(a => a.closingBalanceType === 'Cr')
        .reduce((sum, a) => sum + a.closingBalance, 0)
    };

    res.status(200).json({
      success: true,
      data: {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        abstract,
        summary
      }
    });
  } catch (error) {
    console.error('Error generating ledger abstract:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating ledger abstract'
    });
  }
};

// 4. RECEIPTS & DISBURSEMENT - ENHANCED WITH MULTIPLE FORMATS
export const getReceiptsDisbursementEnhanced = async (req, res) => {
  try {
    const { startDate, endDate, filterType, customStart, customEnd, format = 'threeColumn' } = req.query;

    // Get date range
    let dateFilter;
    if (filterType) {
      dateFilter = getDateRange(filterType, customStart, customEnd);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter = { startDate: start, endDate: end };
    } else {
      // Default to current month if no dates provided
      dateFilter = getDateRange('thisMonth');
    }

    // Validate dates
    if (isNaN(dateFilter.startDate.getTime()) || isNaN(dateFilter.endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameters provided'
      });
    }

    // Get cash/bank ledgers
    const cashBankLedgers = await Ledger.find({
      ledgerType: { $in: ['Cash', 'Bank'] },
      status: 'Active',
      companyId: req.companyId
    });

    const ledgerIds = cashBankLedgers.map(l => l._id);

    // Calculate opening balance for all cash/bank ledgers
    let openingBalance = 0;
    for (const ledger of cashBankLedgers) {
      openingBalance += await calculateOpeningBalance(Ledger, Voucher, ledger._id, dateFilter.startDate, req.companyId);
    }

    // Get all vouchers affecting cash/bank in the period
    const vouchers = await Voucher.find({
      companyId: req.companyId,
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': { $in: ledgerIds }
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    // Categorize by ledger heads
    const receiptsByHead = {};
    const paymentsByHead = {};
    const receiptsData = [];
    const paymentsData = [];

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (!entry.ledgerId?._id) return; // null guard — deleted ledger
        const isCashBank = ledgerIds.some(id => id.toString() === entry.ledgerId._id.toString());

        if (isCashBank) {
          // Find contra ledger (null guard on each entry's ledgerId)
          const contraEntry = voucher.entries.find(
            e => e.ledgerId?._id && !ledgerIds.some(id => id.toString() === e.ledgerId._id.toString())
          );

          const contraLedgerName = contraEntry?.ledgerName || 'Various';
          const contraLedgerType = contraEntry?.ledgerId?.ledgerType || 'Other';

          if (entry.debitAmount > 0) {
            // Receipt
            receiptsData.push({
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              particulars: contraLedgerName,
              ledgerType: contraLedgerType,
              amount: entry.debitAmount,
              narration: entry.narration || voucher.narration
            });

            if (!receiptsByHead[contraLedgerType]) {
              receiptsByHead[contraLedgerType] = [];
            }
            receiptsByHead[contraLedgerType].push({
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              particulars: contraLedgerName,
              amount: entry.debitAmount
            });
          } else if (entry.creditAmount > 0) {
            // Payment
            paymentsData.push({
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              particulars: contraLedgerName,
              ledgerType: contraLedgerType,
              amount: entry.creditAmount,
              narration: entry.narration || voucher.narration
            });

            if (!paymentsByHead[contraLedgerType]) {
              paymentsByHead[contraLedgerType] = [];
            }
            paymentsByHead[contraLedgerType].push({
              date: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber,
              particulars: contraLedgerName,
              amount: entry.creditAmount
            });
          }
        }
      });
    });

    const totalReceipts = receiptsData.reduce((sum, r) => sum + r.amount, 0);
    const totalPayments = paymentsData.reduce((sum, p) => sum + p.amount, 0);
    const closingBalance = openingBalance + totalReceipts - totalPayments;

    // Format-specific data
    let formattedData = {};

    if (format === 'singleColumn') {
      // Single column: chronological order
      const allTransactions = [
        ...receiptsData.map(r => ({ ...r, type: 'Receipt' })),
        ...paymentsData.map(p => ({ ...p, type: 'Payment' }))
      ].sort((a, b) => new Date(a.date) - new Date(b.date));

      formattedData = { transactions: allTransactions };
    } else if (format === 'threeColumn') {
      // Three column: Receipts | Payments | Balance
      const transactions = [];
      let balance = openingBalance;

      const allDates = [
        ...new Set([
          ...receiptsData.map(r => r.date.toISOString()),
          ...paymentsData.map(p => p.date.toISOString())
        ])
      ].sort();

      allDates.forEach(dateStr => {
        const date = new Date(dateStr);
        const dayReceipts = receiptsData.filter(r => r.date.toISOString() === dateStr);
        const dayPayments = paymentsData.filter(p => p.date.toISOString() === dateStr);

        const receiptTotal = dayReceipts.reduce((sum, r) => sum + r.amount, 0);
        const paymentTotal = dayPayments.reduce((sum, p) => sum + p.amount, 0);
        balance = balance + receiptTotal - paymentTotal;

        transactions.push({
          date,
          receipts: dayReceipts,
          payments: dayPayments,
          receiptTotal,
          paymentTotal,
          balance
        });
      });

      formattedData = { transactions };
    } else if (format === 'classified') {
      // Classified by ledger heads
      const receiptHeads = Object.keys(receiptsByHead).map(head => ({
        ledgerType: head,
        transactions: receiptsByHead[head],
        total: receiptsByHead[head].reduce((sum, t) => sum + t.amount, 0)
      }));

      const paymentHeads = Object.keys(paymentsByHead).map(head => ({
        ledgerType: head,
        transactions: paymentsByHead[head],
        total: paymentsByHead[head].reduce((sum, t) => sum + t.amount, 0)
      }));

      formattedData = {
        receiptsByHead: receiptHeads,
        paymentsByHead: paymentHeads
      };
    } else if (format === 'threeColumnLedgerwise') {
      // Three Column Ledger-wise format
      // Uses CUMULATIVE CASH FLOWS (not balance sheet values) so that
      // endOfMonth = uptoMonth + duringMonth is always guaranteed.

      // Step 1: Get cash/bank ledger IDs
      const cashBankLedgers = await Ledger.find({
        ledgerType: { $in: ['Cash', 'Bank'] },
        status: 'Active',
        companyId: req.companyId
      });
      const cashBankIds = new Set(cashBankLedgers.map(l => l._id.toString()));
      const cashBankObjectIds = cashBankLedgers.map(l => l._id);

      // Step 2: Financial year start (April 1) — uptoMonth = FY start → period start (exclusive)
      const fyStartYear = dateFilter.startDate.getUTCMonth() >= 3
        ? dateFilter.startDate.getUTCFullYear()
        : dateFilter.startDate.getUTCFullYear() - 1;
      const fyStart = new Date(Date.UTC(fyStartYear, 3, 1, 0, 0, 0, 0)); // April 1

      // Step 3: Fetch vouchers for both windows (only cash/bank involved vouchers)
      const [vouchersBefore, vouchersDuring] = await Promise.all([
        Voucher.find({
          companyId: req.companyId,
          voucherDate: { $gte: fyStart, $lt: dateFilter.startDate },
          'entries.ledgerId': { $in: cashBankObjectIds }
        }).populate('entries.ledgerId', 'ledgerName ledgerType'),

        Voucher.find({
          companyId: req.companyId,
          voucherDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
          'entries.ledgerId': { $in: cashBankObjectIds }
        }).populate('entries.ledgerId', 'ledgerName ledgerType')
      ]);

      // Step 4: Aggregate cash flows per contra ledger
      // receipt = cash DEBITED (money came IN), payment = cash CREDITED (money went OUT)
      const contraMap = {};

      const aggregateVouchers = (vouchers, isBefore) => {
        vouchers.forEach(voucher => {
          voucher.entries.forEach(entry => {
            // Null guard: populated ledgerId can be null if ledger was deleted
            if (!entry.ledgerId?._id) return;

            const entryLedgerId = entry.ledgerId._id.toString();
            if (!cashBankIds.has(entryLedgerId)) return; // skip non-cash entries

            // Find the contra (non-cash) side — guard against null ledgerIds in same loop
            const contraEntry = voucher.entries.find(e =>
              e.ledgerId?._id && !cashBankIds.has(e.ledgerId._id.toString())
            );
            if (!contraEntry) return; // contra voucher (cash↔bank) — skip

            const key = contraEntry.ledgerId._id.toString();
            if (!contraMap[key]) {
              const lType = contraEntry.ledgerId.ledgerType || 'Other';
              contraMap[key] = {
                ledgerName: contraEntry.ledgerName || contraEntry.ledgerId.ledgerName || 'Unknown',
                ledgerType: lType,
                category: getLedgerCategory(lType),
                receipt: { uptoMonth: 0, duringMonth: 0 },
                payment: { uptoMonth: 0, duringMonth: 0 }
              };
            }

            const col = contraMap[key];
            if (entry.debitAmount > 0) {
              // Cash DEBITED → RECEIPT
              if (isBefore) col.receipt.uptoMonth  += entry.debitAmount;
              else          col.receipt.duringMonth += entry.debitAmount;
            } else if (entry.creditAmount > 0) {
              // Cash CREDITED → PAYMENT
              if (isBefore) col.payment.uptoMonth  += entry.creditAmount;
              else          col.payment.duringMonth += entry.creditAmount;
            }
          });
        });
      };

      aggregateVouchers(vouchersBefore, true);
      aggregateVouchers(vouchersDuring, false);

      // Step 5: Derive endOfMonth = uptoMonth + duringMonth (GUARANTEED by construction)
      const activeLedgers = Object.values(contraMap)
        .filter(l =>
          l.receipt.uptoMonth > 0 || l.receipt.duringMonth > 0 ||
          l.payment.uptoMonth > 0 || l.payment.duringMonth > 0
        )
        .map(l => ({
          ledgerName: l.ledgerName,
          ledgerType: l.ledgerType,
          category: l.category,
          receipt: {
            uptoMonth:   l.receipt.uptoMonth,
            duringMonth: l.receipt.duringMonth,
            endOfMonth:  l.receipt.uptoMonth + l.receipt.duringMonth   // always correct
          },
          payment: {
            uptoMonth:   l.payment.uptoMonth,
            duringMonth: l.payment.duringMonth,
            endOfMonth:  l.payment.uptoMonth + l.payment.duringMonth   // always correct
          }
        }));

      // Step 6: Group by section
      const sectionMap = {
        'LIABILITIES': { name: 'Advance due by Society (LIABILITY)', ledgers: [], order: 1 },
        'ASSETS':      { name: 'Advance due to Society (ASSET)',      ledgers: [], order: 2 },
        'EXPENSES':    { name: 'Contingencies/Expenses',              ledgers: [], order: 3 },
        'INCOME':      { name: 'Income Accounts',                     ledgers: [], order: 4 },
        'CAPITAL':     { name: 'Capital & Reserves',                  ledgers: [], order: 5 },
        'OTHER':       { name: 'Other Accounts',                      ledgers: [], order: 6 }
      };

      activeLedgers.forEach(ledger => {
        const section = sectionMap[ledger.category] || sectionMap['OTHER'];
        section.ledgers.push(ledger);
      });

      // Step 7: Section totals — sum uptoMonth and duringMonth; endOfMonth = their sum
      const sections = Object.values(sectionMap)
        .filter(s => s.ledgers.length > 0)
        .sort((a, b) => a.order - b.order)
        .map(section => {
          const groupTotal = section.ledgers.reduce((acc, l) => ({
            receipt: {
              uptoMonth:   acc.receipt.uptoMonth   + l.receipt.uptoMonth,
              duringMonth: acc.receipt.duringMonth + l.receipt.duringMonth,
              endOfMonth:  acc.receipt.endOfMonth  + l.receipt.endOfMonth
            },
            payment: {
              uptoMonth:   acc.payment.uptoMonth   + l.payment.uptoMonth,
              duringMonth: acc.payment.duringMonth + l.payment.duringMonth,
              endOfMonth:  acc.payment.endOfMonth  + l.payment.endOfMonth
            }
          }), { receipt: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 },
                payment: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 } });

          return { sectionName: section.name, ledgers: section.ledgers, groupTotal };
        });

      // Step 8: Grand total — same guarantee flows up
      const grandTotal = sections.reduce((acc, s) => ({
        receipt: {
          uptoMonth:   acc.receipt.uptoMonth   + s.groupTotal.receipt.uptoMonth,
          duringMonth: acc.receipt.duringMonth + s.groupTotal.receipt.duringMonth,
          endOfMonth:  acc.receipt.endOfMonth  + s.groupTotal.receipt.endOfMonth
        },
        payment: {
          uptoMonth:   acc.payment.uptoMonth   + s.groupTotal.payment.uptoMonth,
          duringMonth: acc.payment.duringMonth + s.groupTotal.payment.duringMonth,
          endOfMonth:  acc.payment.endOfMonth  + s.groupTotal.payment.endOfMonth
        }
      }), { receipt: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 },
            payment: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 } });

      // FY end = March 31 of next year
      const fyEnd = new Date(Date.UTC(fyStartYear + 1, 2, 31, 23, 59, 59, 999));

      formattedData = { sections, grandTotal, fyStart, fyEnd };
    } else if (format === 'twoColumnMonthly') {
      // Two-Column Side-by-Side format
      // Cash/Bank ledgers are the tracked accounts; contra entries form the sections.
      // Split each contra ledger by: cash (via Cash-type entry) vs adjustment (via Bank-type entry).

      const cashBankLedgersAll = await Ledger.find({
        ledgerType: { $in: ['Cash', 'Bank'] },
        status: 'Active',
        companyId: req.companyId
      });
      const cashIds  = new Set(cashBankLedgersAll.filter(l => l.ledgerType === 'Cash').map(l => l._id.toString()));
      const bankIds  = new Set(cashBankLedgersAll.filter(l => l.ledgerType === 'Bank').map(l => l._id.toString()));
      const allCBIds = new Set(cashBankLedgersAll.map(l => l._id.toString()));
      const allCBObjectIds = cashBankLedgersAll.map(l => l._id);

      const duringVouchers2 = await Voucher.find({
        companyId: req.companyId,
        voucherDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
        'entries.ledgerId': { $in: allCBObjectIds }
      }).populate('entries.ledgerId', 'ledgerName ledgerType');

      const contraMap2 = {};

      duringVouchers2.forEach(voucher => {
        // Find the cash/bank entry that drove this voucher
        const cashBankEntry = voucher.entries.find(e =>
          e.ledgerId?._id && allCBIds.has(e.ledgerId._id.toString())
        );
        if (!cashBankEntry) return;

        const isCash = cashIds.has(cashBankEntry.ledgerId._id.toString());

        // Find the contra (non-cash/bank) entry
        const contraEntry = voucher.entries.find(e =>
          e.ledgerId?._id && !allCBIds.has(e.ledgerId._id.toString())
        );
        if (!contraEntry) return; // contra voucher — skip

        const key = contraEntry.ledgerId._id.toString();
        if (!contraMap2[key]) {
          contraMap2[key] = {
            ledgerName: contraEntry.ledgerName || contraEntry.ledgerId.ledgerName || 'Unknown',
            ledgerType: contraEntry.ledgerId.ledgerType || 'Other',
            category:   getLedgerCategory(contraEntry.ledgerId.ledgerType || 'Other'),
            receiptCash: 0, receiptAdj: 0,
            paymentCash: 0, paymentAdj: 0
          };
        }
        const rec = contraMap2[key];
        if (cashBankEntry.debitAmount > 0) {
          if (isCash) rec.receiptCash += cashBankEntry.debitAmount;
          else        rec.receiptAdj  += cashBankEntry.debitAmount;
        } else if (cashBankEntry.creditAmount > 0) {
          if (isCash) rec.paymentCash += cashBankEntry.creditAmount;
          else        rec.paymentAdj  += cashBankEntry.creditAmount;
        }
      });

      // Group into sections
      const secMap2 = {
        'LIABILITIES': { name: 'Advance due by Society', subtitle: '(LIABILITY)', ledgers: [], order: 1 },
        'ASSETS':      { name: 'Advance due to Society', subtitle: '(ASSET)',      ledgers: [], order: 2 },
        'EXPENSES':    { name: 'Contingencies/Expenses',  subtitle: '',            ledgers: [], order: 3 },
        'INCOME':      { name: 'Income Accounts',         subtitle: '',            ledgers: [], order: 4 },
        'CAPITAL':     { name: 'Capital & Reserves',      subtitle: '',            ledgers: [], order: 5 },
        'OTHER':       { name: 'Other Accounts',          subtitle: '',            ledgers: [], order: 6 }
      };

      Object.values(contraMap2).forEach(l => {
        if (l.receiptCash + l.receiptAdj + l.paymentCash + l.paymentAdj === 0) return;
        const sec = secMap2[l.category] || secMap2['OTHER'];
        sec.ledgers.push({
          ledgerName:   l.ledgerName,
          receiptAdj:   l.receiptAdj,
          receiptCash:  l.receiptCash,
          receiptTotal: l.receiptAdj + l.receiptCash,
          paymentAdj:   l.paymentAdj,
          paymentCash:  l.paymentCash,
          paymentTotal: l.paymentAdj + l.paymentCash
        });
      });

      const sections2 = Object.values(secMap2)
        .filter(s => s.ledgers.length > 0)
        .sort((a, b) => a.order - b.order)
        .map(sec => {
          const groupTotal = sec.ledgers.reduce((acc, l) => ({
            receiptAdj:   acc.receiptAdj   + l.receiptAdj,
            receiptCash:  acc.receiptCash  + l.receiptCash,
            receiptTotal: acc.receiptTotal + l.receiptTotal,
            paymentAdj:   acc.paymentAdj   + l.paymentAdj,
            paymentCash:  acc.paymentCash  + l.paymentCash,
            paymentTotal: acc.paymentTotal + l.paymentTotal
          }), { receiptAdj: 0, receiptCash: 0, receiptTotal: 0, paymentAdj: 0, paymentCash: 0, paymentTotal: 0 });
          return { sectionName: sec.name, subtitle: sec.subtitle, ledgers: sec.ledgers, groupTotal };
        });

      const grandTotal2 = sections2.reduce((acc, s) => ({
        receiptAdj:   acc.receiptAdj   + s.groupTotal.receiptAdj,
        receiptCash:  acc.receiptCash  + s.groupTotal.receiptCash,
        receiptTotal: acc.receiptTotal + s.groupTotal.receiptTotal,
        paymentAdj:   acc.paymentAdj   + s.groupTotal.paymentAdj,
        paymentCash:  acc.paymentCash  + s.groupTotal.paymentCash,
        paymentTotal: acc.paymentTotal + s.groupTotal.paymentTotal
      }), { receiptAdj: 0, receiptCash: 0, receiptTotal: 0, paymentAdj: 0, paymentCash: 0, paymentTotal: 0 });

      formattedData = { sections: sections2, grandTotal: grandTotal2 };
    } else if (format === 'singleColumnMonthly') {
      // Single Column Monthly format - Only during month transactions
      // Exclude Cash/Bank ledgers — they are the account being tracked; show only contra entries
      const allLedgers = await Ledger.find({
        status: 'Active',
        companyId: req.companyId,
        ledgerType: { $nin: ['Cash', 'Bank'] }
      }).sort({ ledgerName: 1 });

      // Process each ledger for during-month transactions only
      const ledgerData = await Promise.all(
        allLedgers.map(async ledger => {
          // Get transactions during the period
          const vouchers = await Voucher.find({
            companyId: req.companyId,
            voucherDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
            'entries.ledgerId': ledger._id
          });

          // Aggregate debits and credits during period
          let duringMonthDebit = 0;
          let duringMonthCredit = 0;
          vouchers.forEach(voucher => {
            voucher.entries.forEach(entry => {
              if (entry.ledgerId.toString() === ledger._id.toString()) {
                duringMonthDebit += entry.debitAmount;
                duringMonthCredit += entry.creditAmount;
              }
            });
          });

          // Skip ledgers with no activity
          if (duringMonthDebit === 0 && duringMonthCredit === 0) {
            return null;
          }

          // NET: each ledger appears on ONE side only
          // Net credit → Receipt side; Net debit → Payment side
          const net = duringMonthCredit - duringMonthDebit;
          if (net === 0) return null; // perfectly offset — skip

          return {
            ledgerId: ledger._id,
            ledgerName: ledger.ledgerName,
            ledgerType: ledger.ledgerType,
            category: getLedgerCategory(ledger.ledgerType),
            receipt: net > 0 ? net : 0,   // only on receipt side if net credit
            payment: net < 0 ? -net : 0   // only on payment side if net debit
          };
        })
      );

      // Filter out null entries (no activity)
      const activeLedgers = ledgerData.filter(l => l !== null);

      // Group by specific sections
      const sectionMap = {
        'LIABILITY': { name: 'Liability', ledgers: [], order: 1 },
        'ASSET': { name: 'Asset', ledgers: [], order: 2 },
        'BANK': { name: 'Bank Accounts', ledgers: [], order: 3 },
        'EXPENSE': { name: 'Contingencies / Expense', ledgers: [], order: 4 }
      };

      activeLedgers.forEach(ledger => {
        if (ledger.ledgerType === 'Bank') {
          sectionMap['BANK'].ledgers.push(ledger);
        } else if (ledger.category === 'LIABILITIES') {
          sectionMap['LIABILITY'].ledgers.push(ledger);
        } else if (ledger.category === 'ASSETS') {
          sectionMap['ASSET'].ledgers.push(ledger);
        } else {
          // All other ledgers (EXPENSES, INCOME, etc.) go to Contingencies / Expense
          sectionMap['EXPENSE'].ledgers.push(ledger);
        }
      });

      // Build sections with totals
      const sections = Object.values(sectionMap)
        .filter(section => section.ledgers.length > 0)
        .sort((a, b) => a.order - b.order)
        .map(section => {
          const groupTotal = section.ledgers.reduce((total, ledger) => ({
            receipt: total.receipt + ledger.receipt,
            payment: total.payment + ledger.payment
          }), { receipt: 0, payment: 0 });

          return {
            sectionName: section.name,
            ledgers: section.ledgers,
            groupTotal
          };
        });

      // Calculate grand totals
      const grandTotal = sections.reduce((total, section) => ({
        receipt: total.receipt + section.groupTotal.receipt,
        payment: total.payment + section.groupTotal.payment
      }), { receipt: 0, payment: 0 });

      formattedData = { sections, grandTotal };
    }

    res.status(200).json({
      success: true,
      data: {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        format,
        openingBalance,
        closingBalance,
        receipts: receiptsData,
        payments: paymentsData,
        summary: {
          totalReceipts,
          totalPayments,
          netCashFlow: totalReceipts - totalPayments
        },
        formatted: formattedData
      }
    });
  } catch (error) {
    console.error('Error generating R&D report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating R&D report'
    });
  }
};

// 5. GET ALL LEDGERS FOR DROPDOWN
export const getLedgersForDropdown = async (req, res) => {
  try {
    const { type } = req.query;

    const query = { status: 'Active', companyId: req.companyId };
    if (type) query.ledgerType = type;

    const ledgers = await Ledger.find(query)
      .select('_id ledgerName ledgerType')
      .sort({ ledgerName: 1 });

    res.status(200).json({
      success: true,
      data: ledgers
    });
  } catch (error) {
    console.error('Error fetching ledgers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching ledgers'
    });
  }
};

export default {
  getCashBook,
  getGeneralLedger,
  getGeneralLedgerAbstract,
  getReceiptsDisbursementEnhanced,
  getLedgersForDropdown
};
