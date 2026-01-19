import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
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
      dateFilter = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };
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

    // Find cash ledger
    const cashLedger = await Ledger.findOne({ ledgerType: 'Cash', status: 'Active' });
    if (!cashLedger) {
      return res.status(404).json({
        success: false,
        message: 'Cash ledger not found'
      });
    }

    // Calculate opening balance
    const openingBalance = await calculateOpeningBalance(
      Ledger,
      Voucher,
      cashLedger._id,
      dateFilter.startDate
    );

    // Get all vouchers affecting cash in the period
    const vouchers = await Voucher.find({
      voucherDate: {
        $gte: dateFilter.startDate,
        $lte: dateFilter.endDate
      },
      'entries.ledgerId': cashLedger._id
    })
      .sort({ voucherDate: 1, voucherNumber: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    // Process transactions
    const transactions = [];
    let runningBalance = openingBalance;

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId._id.toString() === cashLedger._id.toString()) {
          const isReceipt = entry.debitAmount > 0;
          const amount = isReceipt ? entry.debitAmount : entry.creditAmount;

          // Find contra ledger (the other side)
          const contraEntry = voucher.entries.find(
            e => e.ledgerId._id.toString() !== cashLedger._id.toString()
          );

          runningBalance += isReceipt ? amount : -amount;

          transactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            particulars: isReceipt
              ? `From ${contraEntry?.ledgerName || 'Various'}`
              : `To ${contraEntry?.ledgerName || 'Various'}`,
            voucherId: voucher._id,
            debit: isReceipt ? amount : 0,
            credit: isReceipt ? 0 : amount,
            balance: runningBalance,
            narration: entry.narration || voucher.narration
          });
        }
      });
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
      dateFilter = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };
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
    const ledger = await Ledger.findById(ledgerId);
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
      dateFilter.startDate
    );

    // Get all voucher entries for this ledger in the period
    const vouchers = await Voucher.find({
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
      dateFilter = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };
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
    const query = { status: 'Active' };
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
          dateFilter.startDate
        );

        // Get transactions in period
        const vouchers = await Voucher.find({
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
      dateFilter = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };
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
      status: 'Active'
    });

    const ledgerIds = cashBankLedgers.map(l => l._id);

    // Calculate opening balance for all cash/bank ledgers
    let openingBalance = 0;
    for (const ledger of cashBankLedgers) {
      openingBalance += await calculateOpeningBalance(Ledger, Voucher, ledger._id, dateFilter.startDate);
    }

    // Get all vouchers affecting cash/bank in the period
    const vouchers = await Voucher.find({
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
        const isCashBank = ledgerIds.some(id => id.toString() === entry.ledgerId._id.toString());

        if (isCashBank) {
          // Find contra ledger
          const contraEntry = voucher.entries.find(
            e => !ledgerIds.some(id => id.toString() === e.ledgerId._id.toString())
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
      // Fetch ALL active ledgers (not just cash/bank)
      const allLedgers = await Ledger.find({ status: 'Active' }).sort({ ledgerName: 1 });

      // Process each ledger to calculate opening, during, and end balances
      const ledgerData = await Promise.all(
        allLedgers.map(async ledger => {
          // Calculate opening balance at start of period
          const openingBalance = await calculateOpeningBalance(Ledger, Voucher, ledger._id, dateFilter.startDate);

          // Get transactions during the period
          const vouchers = await Voucher.find({
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

          // Classify to receipt/payment based on ledger nature
          const isDebitNature = isDebitNatureLedger(ledger.ledgerType);
          let receiptUptoMonth = 0, receiptDuringMonth = 0;
          let paymentUptoMonth = 0, paymentDuringMonth = 0;

          if (isDebitNature) {
            // Asset/Expense: Dr balance = Payment, Cr balance = Receipt
            if (openingBalance >= 0) {
              paymentUptoMonth = openingBalance;
            } else {
              receiptUptoMonth = Math.abs(openingBalance);
            }
            paymentDuringMonth = duringMonthDebit;
            receiptDuringMonth = duringMonthCredit;
          } else {
            // Liability/Income: Cr balance = Receipt, Dr balance = Payment
            if (openingBalance >= 0) {
              receiptUptoMonth = openingBalance;
            } else {
              paymentUptoMonth = Math.abs(openingBalance);
            }
            receiptDuringMonth = duringMonthCredit;
            paymentDuringMonth = duringMonthDebit;
          }

          return {
            ledgerId: ledger._id,
            ledgerName: ledger.ledgerName,
            ledgerType: ledger.ledgerType,
            category: getLedgerCategory(ledger.ledgerType),
            receipt: {
              uptoMonth: receiptUptoMonth,
              duringMonth: receiptDuringMonth,
              endOfMonth: receiptUptoMonth + receiptDuringMonth
            },
            payment: {
              uptoMonth: paymentUptoMonth,
              duringMonth: paymentDuringMonth,
              endOfMonth: paymentUptoMonth + paymentDuringMonth
            }
          };
        })
      );

      // Filter out zero-activity ledgers
      const activeLedgers = ledgerData.filter(l =>
        l.receipt.uptoMonth !== 0 || l.receipt.duringMonth !== 0 ||
        l.payment.uptoMonth !== 0 || l.payment.duringMonth !== 0
      );

      // Group by sections with custom names
      const sectionMap = {
        'LIABILITIES': { name: 'Advance due by Society (LIABILITY)', ledgers: [], order: 1 },
        'ASSETS': { name: 'Advance due to Society (ASSET)', ledgers: [], order: 2 },
        'EXPENSES': { name: 'Contingencies/Expenses', ledgers: [], order: 3 },
        'INCOME': { name: 'Income Accounts', ledgers: [], order: 4 },
        'CAPITAL': { name: 'Capital & Reserves', ledgers: [], order: 5 },
        'OTHER': { name: 'Other Accounts', ledgers: [], order: 6 }
      };

      activeLedgers.forEach(ledger => {
        const section = sectionMap[ledger.category] || sectionMap['OTHER'];
        section.ledgers.push(ledger);
      });

      // Calculate section totals and build sections array
      const sections = Object.values(sectionMap)
        .filter(section => section.ledgers.length > 0)
        .sort((a, b) => a.order - b.order)
        .map(section => {
          const groupTotal = section.ledgers.reduce((total, ledger) => ({
            receipt: {
              uptoMonth: total.receipt.uptoMonth + ledger.receipt.uptoMonth,
              duringMonth: total.receipt.duringMonth + ledger.receipt.duringMonth,
              endOfMonth: total.receipt.endOfMonth + ledger.receipt.endOfMonth
            },
            payment: {
              uptoMonth: total.payment.uptoMonth + ledger.payment.uptoMonth,
              duringMonth: total.payment.duringMonth + ledger.payment.duringMonth,
              endOfMonth: total.payment.endOfMonth + ledger.payment.endOfMonth
            }
          }), {
            receipt: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 },
            payment: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 }
          });

          return {
            sectionName: section.name,
            ledgers: section.ledgers,
            groupTotal
          };
        });

      // Calculate grand totals
      const grandTotal = sections.reduce((total, section) => ({
        receipt: {
          uptoMonth: total.receipt.uptoMonth + section.groupTotal.receipt.uptoMonth,
          duringMonth: total.receipt.duringMonth + section.groupTotal.receipt.duringMonth,
          endOfMonth: total.receipt.endOfMonth + section.groupTotal.receipt.endOfMonth
        },
        payment: {
          uptoMonth: total.payment.uptoMonth + section.groupTotal.payment.uptoMonth,
          duringMonth: total.payment.duringMonth + section.groupTotal.payment.duringMonth,
          endOfMonth: total.payment.endOfMonth + section.groupTotal.payment.endOfMonth
        }
      }), {
        receipt: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 },
        payment: { uptoMonth: 0, duringMonth: 0, endOfMonth: 0 }
      });

      formattedData = { sections, grandTotal };
    } else if (format === 'singleColumnMonthly') {
      // Single Column Monthly format - Only during month transactions
      // Get ALL active ledgers
      const allLedgers = await Ledger.find({ status: 'Active' }).sort({ ledgerName: 1 });

      // Process each ledger for during-month transactions only
      const ledgerData = await Promise.all(
        allLedgers.map(async ledger => {
          // Get transactions during the period
          const vouchers = await Voucher.find({
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

          return {
            ledgerId: ledger._id,
            ledgerName: ledger.ledgerName,
            ledgerType: ledger.ledgerType,
            category: getLedgerCategory(ledger.ledgerType),
            receipt: duringMonthCredit, // Credit = Receipt
            payment: duringMonthDebit   // Debit = Payment
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

    const query = { status: 'Active' };
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
