import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import BusinessLedger from '../models/BusinessLedger.js';
import BusinessVoucher from '../models/BusinessVoucher.js';
import BusinessSales from '../models/BusinessSales.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import StockTransaction from '../models/StockTransaction.js';
import BusinessItem from '../models/BusinessItem.js';
import BusinessCustomer from '../models/BusinessCustomer.js';
import Supplier from '../models/Supplier.js';
import SalesReturn from '../models/SalesReturn.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import {
  calculateOpeningBalance,
  calculateClosingBalance,
  isDebitNatureLedger,
  getBalanceType,
  calculateRunningBalance,
  getLedgerCategory
} from '../utils/balanceCalculator.js';
import { getDateRange } from '../utils/dateFilters.js';

/**
 * Sale Report - All sales transactions with filtering
 * GET /api/reports/vyapar/sale-report
 * Query params: filterType, customStart, customEnd, partyId, itemId, paymentStatus
 */
export const getSaleReport = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, partyId, itemId, paymentStatus } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query - use BusinessSales model with invoiceDate field
    const query = {
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    };

    if (partyId) query.partyId = partyId;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (itemId) query['items.itemId'] = itemId;

    // Fetch sales from BusinessSales (Private Firm)
    const sales = await BusinessSales.find(query)
      .populate('partyId', 'name phone customerId')
      .sort({ invoiceDate: -1 });

    // Calculate summary
    const summary = {
      totalSales: 0,
      totalTax: 0,
      paidAmount: 0,
      pendingAmount: 0,
      totalBills: sales.length
    };

    sales.forEach(sale => {
      summary.totalSales += sale.grandTotal || 0;
      summary.totalTax += sale.totalGst || 0;
      summary.paidAmount += sale.paidAmount || 0;
      summary.pendingAmount += sale.balanceAmount || 0;
    });

    // Format records
    const records = sales.map(sale => ({
      _id: sale._id,
      date: sale.invoiceDate,
      invoiceNumber: sale.invoiceNumber,
      partyName: sale.partyName || 'Cash Sale',
      itemCount: sale.items?.length || 0,
      subtotal: sale.taxableAmount || 0,
      tax: sale.totalGst || 0,
      total: sale.grandTotal || 0,
      paid: sale.paidAmount || 0,
      balance: sale.balanceAmount || 0,
      paymentStatus: sale.paymentStatus,
      paymentMode: sale.paymentMode
    }));

    res.json({
      success: true,
      data: {
        summary,
        records,
        filters: { filterType, startDate, endDate, partyId, itemId, paymentStatus }
      }
    });
  } catch (error) {
    console.error('Error in getSaleReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sale report',
      error: error.message
    });
  }
};

/**
 * Purchase Report - All purchase transactions with filtering
 * GET /api/reports/vyapar/purchase-report
 * Query params: filterType, customStart, customEnd, partyId, itemId, paymentStatus, inventoryType
 */
export const getPurchaseReport = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, partyId, itemId, paymentStatus, inventoryType } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query for stock-in transactions (purchases)
    const query = {
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: startDate, $lte: endDate }
    };

    if (partyId) query.supplierId = partyId;
    if (itemId) query.itemId = itemId;

    // Use BusinessStockTransaction for Business inventory (Vyapar/Private Firm),
    // StockTransaction for Dairy inventory
    const useBusinessModel = !inventoryType || inventoryType === 'Business';
    const Model = useBusinessModel ? BusinessStockTransaction : StockTransaction;

    // Only add inventoryType filter for Dairy model (StockTransaction) which has that field
    if (!useBusinessModel) {
      query.inventoryType = inventoryType;
    }

    // Fetch purchase transactions - populate with correct item model ref
    const transactions = await Model.find(query)
      .populate('itemId')
      .populate('supplierId')
      .sort({ date: -1 });

    // Group transactions by invoice number to create purchase records
    const invoiceMap = new Map();

    transactions.forEach(txn => {
      const invoiceKey = txn.invoiceNumber || `TXN-${txn._id}`;

      if (!invoiceMap.has(invoiceKey)) {
        invoiceMap.set(invoiceKey, {
          _id: txn._id,
          date: txn.date,
          invoiceNumber: txn.invoiceNumber || `PUR-${txn._id.toString().slice(-6)}`,
          invoiceDate: txn.invoiceDate || txn.date,
          supplierId: txn.supplierId?._id,
          supplierName: txn.supplierName || txn.supplierId?.name || 'Cash Purchase',
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0,
          paid: 0,
          balance: 0,
          paymentStatus: 'Pending',
          paymentMode: txn.paymentMode
        });
      }

      const invoice = invoiceMap.get(invoiceKey);
      const itemAmount = txn.quantity * txn.rate;

      invoice.items.push({
        itemId: txn.itemId?._id,
        itemName: txn.itemId?.itemName,
        quantity: txn.quantity,
        freeQty: txn.freeQty || 0,
        rate: txn.rate,
        amount: itemAmount
      });

      invoice.subtotal += itemAmount;
      invoice.total = txn.totalAmount || invoice.subtotal;
      invoice.paid += txn.paidAmount || 0;
    });

    // Convert to records array and calculate balances
    const records = [];

    invoiceMap.forEach(invoice => {
      invoice.itemCount = invoice.items.length;
      invoice.balance = invoice.total - invoice.paid;

      // Determine payment status
      if (invoice.paid >= invoice.total) {
        invoice.paymentStatus = 'Paid';
      } else if (invoice.paid > 0) {
        invoice.paymentStatus = 'Partial';
      } else {
        invoice.paymentStatus = 'Pending';
      }

      // Apply payment status filter
      if (paymentStatus && invoice.paymentStatus !== paymentStatus) {
        return;
      }

      records.push(invoice);
    });

    // Calculate summary
    const summary = {
      totalPurchases: records.reduce((sum, r) => sum + r.total, 0),
      totalTax: records.reduce((sum, r) => sum + r.tax, 0),
      paidAmount: records.reduce((sum, r) => sum + r.paid, 0),
      pendingAmount: records.reduce((sum, r) => sum + r.balance, 0),
      totalBills: records.length
    };

    res.json({
      success: true,
      data: {
        summary,
        records,
        filters: { filterType, startDate, endDate, partyId, itemId, paymentStatus }
      }
    });
  } catch (error) {
    console.error('Error in getPurchaseReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate purchase report',
      error: error.message
    });
  }
};

/**
 * Party Statement - Individual party account statement (Enhanced for Vyapar-style UI)
 * GET /api/reports/vyapar/party-statement
 * Query params: ledgerId, filterType, customStart, customEnd
 */
export const getPartyStatement = async (req, res) => {
  try {
    const { partyId, partyType, filterType, customStart, customEnd } = req.query;

    if (!partyId) {
      return res.status(400).json({ success: false, message: 'Party ID is required' });
    }

    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    const transactions = [];
    let partyName = '';
    let totalSale = 0;
    let totalPurchase = 0;
    let totalReceived = 0;
    let totalPaid = 0;
    let runningBalance = 0;

    if (partyType === 'supplier') {
      // ── Supplier: get supplier name ──
      const supplier = await Supplier.findById(partyId).select('name supplierId phone');
      partyName = supplier?.name || '';

      // Fetch purchase stock transactions
      const supplierQuery = { supplierId: partyId, referenceType: 'Purchase', date: { $gte: startDate, $lte: endDate } };
      if (!partyName) {
        const anyPurchase = await BusinessStockTransaction.findOne({ supplierId: partyId });
        partyName = anyPurchase?.supplierName || 'Supplier';
      }

      // Also build OR query: match by supplierId OR by supplierName for backward compat
      const purchases = await BusinessStockTransaction.find(supplierQuery).sort({ date: 1 });

      purchases.forEach(p => {
        const invoiceTotal = p.totalAmount || p.netTotal || 0;
        const paid = p.paidAmount || 0;
        const due = invoiceTotal - paid;
        totalPurchase += invoiceTotal;
        totalPaid += paid;
        runningBalance += due;

        transactions.push({
          date: p.date,
          transactionType: 'Purchase',
          referenceNo: p.invoiceNumber || `PUR-${p._id.toString().slice(-6)}`,
          paymentType: p.paymentMode || 'Credit',
          totalAmount: invoiceTotal,
          receivedAmount: paid,
          transactionBalance: due,
          receivableBalance: 0,
          payableBalance: runningBalance > 0 ? runningBalance : 0,
          paymentStatus: paid >= invoiceTotal ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'
        });
      });

      // Also include Expense vouchers linked to this supplier (payments made)
      const expenseVouchers = await BusinessVoucher.find({
        partyId: partyId,
        voucherType: 'Expense',
        status: 'Posted',
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });

      expenseVouchers.forEach(v => {
        const amount = v.totalDebit || v.totalCredit || 0;
        totalPaid += amount;
        runningBalance -= amount;
        transactions.push({
          date: v.date,
          transactionType: 'Payment',
          referenceNo: v.voucherNumber,
          paymentType: v.paymentMode || 'Cash',
          totalAmount: amount,
          receivedAmount: amount,
          transactionBalance: 0,
          receivableBalance: 0,
          payableBalance: runningBalance > 0 ? runningBalance : 0,
          paymentStatus: 'Paid'
        });
      });

      // Sort all transactions by date
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Recalculate running balance in order
      runningBalance = 0;
      transactions.forEach(t => {
        if (t.transactionType === 'Purchase') {
          runningBalance += t.totalAmount - t.receivedAmount;
        } else if (t.transactionType === 'Payment') {
          runningBalance -= t.totalAmount;
        }
        t.payableBalance = runningBalance > 0 ? runningBalance : 0;
      });

      const totalPayable = totalPurchase - totalPaid;

      return res.json({
        success: true,
        data: {
          party: { _id: partyId, name: partyName, type: 'Supplier' },
          summary: {
            totalPurchase,
            totalPaid,
            totalPayable: totalPayable > 0 ? totalPayable : 0,
            totalReceivable: 0,
            closingBalance: totalPayable > 0 ? totalPayable : 0,
            closingBalanceType: 'Cr',
            totalDebits: totalPurchase,
            totalCredits: totalPaid
          },
          transactions,
          filters: { filterType, startDate, endDate }
        }
      });

    } else {
      // ── Customer: get customer name for fallback search ──
      const customer = await BusinessCustomer.findById(partyId).select('name phone');
      partyName = customer?.name || '';

      // Search by partyId OR partyName (backward compat for old sales that had dairy customer ID)
      const salesOrQuery = [{ partyId: partyId }];
      if (partyName) {
        salesOrQuery.push({ partyId: null, partyName: { $regex: `^${partyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
        salesOrQuery.push({ partyName: { $regex: `^${partyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      }

      const sales = await BusinessSales.find({
        $or: salesOrQuery,
        invoiceType: { $in: ['Sale', 'Estimate', 'Delivery Challan', 'Proforma'] },
        invoiceDate: { $gte: startDate, $lte: endDate }
      }).sort({ invoiceDate: 1 });

      // Deduplicate (same _id can match multiple $or conditions)
      const seenIds = new Set();
      const uniqueSales = sales.filter(s => {
        const id = s._id.toString();
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });

      if (!partyName && uniqueSales.length > 0) {
        partyName = uniqueSales[0].partyName || 'Customer';
      }

      uniqueSales.forEach(sale => {
        const invoiceTotal = sale.grandTotal || 0;
        const paid = sale.paidAmount || 0;
        const due = sale.balanceAmount ?? (invoiceTotal - paid);
        totalSale += invoiceTotal;
        totalReceived += paid;
        runningBalance += due;

        transactions.push({
          date: sale.invoiceDate,
          transactionType: sale.invoiceType === 'Sale' ? 'Sale' : sale.invoiceType,
          referenceNo: sale.invoiceNumber,
          paymentType: sale.paymentMode || 'Credit',
          totalAmount: invoiceTotal,
          receivedAmount: paid,
          transactionBalance: due,
          receivableBalance: runningBalance > 0 ? runningBalance : 0,
          payableBalance: 0,
          paymentStatus: sale.paymentStatus || (paid >= invoiceTotal ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid')
        });
      });

      // Also include Income vouchers (receipts from customer)
      const receiptVouchers = await BusinessVoucher.find({
        partyId: partyId,
        voucherType: 'Income',
        status: 'Posted',
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });

      receiptVouchers.forEach(v => {
        const amount = v.totalCredit || v.totalDebit || 0;
        totalReceived += amount;
        runningBalance -= amount;
        transactions.push({
          date: v.date,
          transactionType: 'Receipt',
          referenceNo: v.voucherNumber,
          paymentType: v.paymentMode || 'Cash',
          totalAmount: amount,
          receivedAmount: amount,
          transactionBalance: 0,
          receivableBalance: runningBalance > 0 ? runningBalance : 0,
          payableBalance: 0,
          paymentStatus: 'Paid'
        });
      });

      // Sort all transactions by date
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Recalculate running receivable balance in order
      runningBalance = 0;
      transactions.forEach(t => {
        if (t.transactionType === 'Sale' || t.transactionType === 'Estimate' || t.transactionType === 'Delivery Challan' || t.transactionType === 'Proforma') {
          runningBalance += t.transactionBalance;
        } else if (t.transactionType === 'Receipt') {
          runningBalance -= t.totalAmount;
        }
        t.receivableBalance = runningBalance > 0 ? runningBalance : 0;
      });

      const totalReceivable = totalSale - totalReceived;

      return res.json({
        success: true,
        data: {
          party: { _id: partyId, name: partyName || 'Customer', type: 'Customer' },
          summary: {
            totalSale,
            totalReceived,
            totalReceivable: totalReceivable > 0 ? totalReceivable : 0,
            totalPayable: 0,
            closingBalance: totalReceivable > 0 ? totalReceivable : 0,
            closingBalanceType: 'Dr',
            totalDebits: totalSale,
            totalCredits: totalReceived
          },
          transactions,
          filters: { filterType, startDate, endDate }
        }
      });
    }

  } catch (error) {
    console.error('Error in getPartyStatement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate party statement',
      error: error.message
    });
  }
};

/**
 * Cashflow Report - Private Firm cash inflows/outflows
 * Uses BusinessSales (inflows) + BusinessStockTransaction (outflows) — no dairy data
 * GET /api/reports/vyapar/cashflow
 * Query params: filterType, customStart, customEnd
 */
export const getCashflowReport = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, paymentMode } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build payment mode filter ('Cash', 'Bank Transfer', or 'All' / undefined = All)
    const modeFilter = paymentMode && paymentMode !== 'All' ? { paymentMode } : {};

    // Fetch Business Sales in period (Inflows)
    const sales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale',
      ...modeFilter,
      paidAmount: { $gt: 0 }
    }).sort({ invoiceDate: 1 });

    // Fetch Business Purchases in period (Outflows)
    const rawPurchases = await BusinessStockTransaction.find({
      date: { $gte: startDate, $lte: endDate },
      referenceType: 'Purchase',
      ...modeFilter,
      $or: [{ paidAmount: { $gt: 0 } }, { netTotal: { $gt: 0 } }]
    }).sort({ date: 1 });

    // Deduplicate: each purchase creates one transaction per item — group into one per invoice
    const seenPurchaseKeys = new Set();
    const purchases = rawPurchases.filter(p => {
      const key = (p.invoiceNumber && p.invoiceNumber.trim())
        ? p.invoiceNumber.trim()
        : `${p.date?.toISOString().substring(0, 10)}_${p.supplierName || ''}_${p.paidAmount || p.netTotal || 0}`;
      if (seenPurchaseKeys.has(key)) return false;
      seenPurchaseKeys.add(key);
      return true;
    });

    const records = [];

    // Build inflow records from sales
    sales.forEach(sale => {
      records.push({
        date: sale.invoiceDate,
        voucherNumber: sale.invoiceNumber,
        type: 'Inflow',
        mode: sale.paymentMode || 'Cash',
        category: 'Sales',
        particulars: sale.partyName || 'Walk-in Customer',
        amount: sale.paidAmount,
        narration: `Sale Invoice: ${sale.invoiceNumber}`,
        referenceType: 'Sale',
        referenceId: sale._id
      });
    });

    // Build outflow records from purchases (use paidAmount if set, else netTotal for old records)
    purchases.forEach(purchase => {
      const amount = purchase.paidAmount > 0 ? purchase.paidAmount : (purchase.netTotal || 0);
      if (amount <= 0) return;
      records.push({
        date: purchase.date,
        voucherNumber: purchase.invoiceNumber || `PUR-${purchase._id.toString().slice(-6)}`,
        type: 'Outflow',
        mode: purchase.paymentMode || 'Cash',
        category: 'Purchases',
        particulars: purchase.supplierName || 'Supplier',
        amount,
        narration: `Purchase: ${purchase.invoiceNumber || ''}`,
        referenceType: 'Purchase',
        referenceId: purchase._id
      });
    });

    // Sort all records by date
    records.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance and totals
    let totalInflow = 0;
    let totalOutflow = 0;
    let runningBalance = 0;
    records.forEach(record => {
      if (record.type === 'Inflow') {
        totalInflow += record.amount;
        runningBalance += record.amount;
      } else {
        totalOutflow += record.amount;
        runningBalance -= record.amount;
      }
      record.balance = runningBalance;
    });

    res.json({
      success: true,
      data: {
        summary: {
          openingBalance: 0,
          totalInflow,
          inflowCount: records.filter(r => r.type === 'Inflow').length,
          totalOutflow,
          outflowCount: records.filter(r => r.type === 'Outflow').length,
          closingBalance: totalInflow - totalOutflow,
          netCashflow: totalInflow - totalOutflow,
          totalTransactions: records.length
        },
        transactions: records,
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getCashflowReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate cashflow report',
      error: error.message
    });
  }
};

/**
 * Cash-in-Hand Report - Business cash book tracking all cash transactions
 * Sources: BusinessSales (cash receipts), BusinessStockTransaction (cash payments), BusinessVoucher (manual entries)
 * GET /api/reports/vyapar/cash-in-hand
 * Query params: filterType, customStart, customEnd, search
 */
export const getCashInHandReport = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, search } = req.query;

    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // ─── 1. Cash Sales (Cash In) ──────────────────────────────────────
    const [salesInPeriod, salesBefore] = await Promise.all([
      BusinessSales.find({
        invoiceDate: { $gte: start, $lte: end },
        paymentMode: 'Cash',
        paidAmount: { $gt: 0 },
        invoiceType: 'Sale'
      }).sort({ invoiceDate: 1 }),
      BusinessSales.find({
        invoiceDate: { $lt: start },
        paymentMode: 'Cash',
        paidAmount: { $gt: 0 },
        invoiceType: 'Sale'
      })
    ]);

    // ─── 2. Cash Purchases (Cash Out) ─────────────────────────────────
    // Group by invoiceNumber to avoid per-item duplication
    const [purchaseTxnInPeriod, purchaseTxnBefore] = await Promise.all([
      BusinessStockTransaction.find({
        date: { $gte: start, $lte: end },
        transactionType: 'Stock In',
        paymentMode: 'Cash',
        paidAmount: { $gt: 0 }
      }).sort({ date: 1, invoiceNumber: 1 }),
      BusinessStockTransaction.find({
        date: { $lt: start },
        transactionType: 'Stock In',
        paymentMode: 'Cash',
        paidAmount: { $gt: 0 }
      })
    ]);

    // Deduplicate purchases by invoiceNumber (one cash-out per invoice, not per item)
    const deduplicatePurchases = (txns) => {
      const seen = new Set();
      return txns.filter(txn => {
        const key = txn.invoiceNumber || txn._id.toString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const purchasesInPeriod = deduplicatePurchases(purchaseTxnInPeriod);
    const purchasesBefore = deduplicatePurchases(purchaseTxnBefore);

    // ─── 3. Manual Business Vouchers ─────────────────────────────────
    const cashBizLedger = await BusinessLedger.findOne({ group: 'Cash-in-Hand', status: 'Active' });
    let vouchersInPeriod = [];
    let vouchersBefore = [];

    if (cashBizLedger) {
      [vouchersInPeriod, vouchersBefore] = await Promise.all([
        BusinessVoucher.find({
          date: { $gte: start, $lte: end },
          'entries.ledgerId': cashBizLedger._id,
          status: 'Posted'
        }).populate('entries.ledgerId').sort({ date: 1 }),
        BusinessVoucher.find({
          date: { $lt: start },
          'entries.ledgerId': cashBizLedger._id,
          status: 'Posted'
        }).populate('entries.ledgerId')
      ]);
    }

    // ─── 4. Opening Balance ───────────────────────────────────────────
    let openingCash = 0;

    // Cash in from sales before period
    for (const s of salesBefore) {
      openingCash += (s.paidAmount || 0);
    }
    // Cash out from purchases before period
    for (const p of purchasesBefore) {
      openingCash -= (p.paidAmount || 0);
    }
    // Manual voucher entries before period
    if (cashBizLedger) {
      for (const v of vouchersBefore) {
        for (const e of v.entries) {
          if (e.ledgerId && e.ledgerId._id.toString() === cashBizLedger._id.toString()) {
            if (e.type === 'debit') openingCash += (e.amount || 0);
            else openingCash -= (e.amount || 0);
          }
        }
      }
    }

    // ─── 5. Build Transaction List ────────────────────────────────────
    const transactions = [];

    // Cash Sales → Cash In
    for (const sale of salesInPeriod) {
      transactions.push({
        _id: sale._id,
        date: sale.invoiceDate,
        refNo: sale.invoiceNumber,
        partyName: sale.partyName || 'Walk-in Customer',
        category: 'Sales',
        type: 'Receipt',
        cashIn: sale.paidAmount || 0,
        cashOut: 0,
        narration: `Cash sale - ${sale.invoiceNumber}`,
        source: 'sale'
      });
    }

    // Cash Purchases → Cash Out
    for (const purchase of purchasesInPeriod) {
      transactions.push({
        _id: purchase._id,
        date: purchase.date || purchase.purchaseDate,
        refNo: purchase.invoiceNumber || '-',
        partyName: purchase.supplierName || 'Supplier',
        category: 'Purchase',
        type: 'Payment',
        cashIn: 0,
        cashOut: purchase.paidAmount || 0,
        narration: `Cash purchase - ${purchase.invoiceNumber || ''}`.trim().replace(/- $/, ''),
        source: 'purchase'
      });
    }

    // Manual Vouchers (Receipt/Payment)
    for (const voucher of vouchersInPeriod) {
      if (!cashBizLedger) continue;
      const cashEntry = voucher.entries.find(e =>
        e.ledgerId && e.ledgerId._id.toString() === cashBizLedger._id.toString()
      );
      if (!cashEntry || !cashEntry.amount) continue;

      const isCashIn = cashEntry.type === 'debit';
      const contraEntry = voucher.entries.find(e =>
        e.ledgerId && e.ledgerId._id.toString() !== cashBizLedger._id.toString()
      );
      const partyName = contraEntry?.ledgerId?.name || 'Voucher Entry';
      const partyGroup = contraEntry?.ledgerId?.group || '';

      let category = 'General';
      if (partyGroup === 'Sundry Debtors') category = 'Customer Receipt';
      else if (partyGroup === 'Sundry Creditors') category = 'Supplier Payment';
      else if (partyGroup === 'Bank Accounts') category = 'Bank Transfer';
      else if (partyGroup.includes('Expenses')) category = 'Expense';
      else if (partyGroup.includes('Incomes')) category = 'Income';
      else if (partyGroup === 'Capital Account') category = 'Capital';

      transactions.push({
        _id: voucher._id,
        date: voucher.date,
        refNo: voucher.voucherNumber,
        partyName,
        category,
        type: isCashIn ? 'Receipt' : 'Payment',
        cashIn: isCashIn ? (cashEntry.amount || 0) : 0,
        cashOut: !isCashIn ? (cashEntry.amount || 0) : 0,
        narration: voucher.narration || '',
        source: 'voucher'
      });
    }

    // ─── 6. Sort by date then refNo ───────────────────────────────────
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // ─── 7. Running Balance ───────────────────────────────────────────
    let runningBalance = openingCash;
    let totalCashIn = 0;
    let totalCashOut = 0;

    const txnsWithBalance = transactions.map(t => {
      totalCashIn += t.cashIn;
      totalCashOut += t.cashOut;
      runningBalance += t.cashIn - t.cashOut;
      return { ...t, runningBalance };
    });

    // ─── 8. Apply Search Filter ───────────────────────────────────────
    let filteredTransactions = txnsWithBalance;
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filteredTransactions = txnsWithBalance.filter(t =>
        t.partyName?.toLowerCase().includes(q) ||
        t.refNo?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.narration?.toLowerCase().includes(q)
      );
    }

    // ─── 9. Category Summary ──────────────────────────────────────────
    const categorySummary = {};
    transactions.forEach(t => {
      if (!categorySummary[t.category]) {
        categorySummary[t.category] = { cashIn: 0, cashOut: 0, count: 0 };
      }
      categorySummary[t.category].cashIn += t.cashIn;
      categorySummary[t.category].cashOut += t.cashOut;
      categorySummary[t.category].count++;
    });

    res.json({
      success: true,
      data: {
        summary: {
          openingCash,
          totalCashIn,
          totalCashOut,
          closingBalance: openingCash + totalCashIn - totalCashOut,
          totalTransactions: transactions.length,
          salesCount: transactions.filter(t => t.source === 'sale').length,
          purchaseCount: transactions.filter(t => t.source === 'purchase').length,
          voucherCount: transactions.filter(t => t.source === 'voucher').length
        },
        categorySummary,
        transactions: filteredTransactions,
        period: { startDate, endDate, filterType }
      }
    });
  } catch (error) {
    console.error('Error in getCashInHandReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate cash-in-hand report',
      error: error.message
    });
  }
};

/**
 * All Transactions - Complete transaction register (Enhanced Vyapar/Tally style)
 * GET /api/reports/vyapar/all-transactions
 * Query params: filterType, customStart, customEnd, voucherType, partyId, minAmount, maxAmount, search, firm
 */
export const getAllTransactions = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, voucherType, partyId, minAmount, maxAmount, search, firm } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query
    const query = {
      voucherDate: { $gte: startDate, $lte: endDate }
    };

    if (voucherType && voucherType !== 'All Transaction') {
      query.voucherType = voucherType;
    }
    if (partyId) query['entries.ledgerId'] = partyId;
    if (minAmount || maxAmount) {
      query.totalDebit = {};
      if (minAmount) query.totalDebit.$gte = parseFloat(minAmount);
      if (maxAmount) query.totalDebit.$lte = parseFloat(maxAmount);
    }

    // Fetch vouchers with detailed info
    const vouchers = await Voucher.find(query)
      .populate('entries.ledgerId')
      .sort({ voucherDate: -1, voucherNumber: -1 });

    // Also fetch sales data for comprehensive view
    const salesQuery = {
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    };
    const salesData = await BusinessSales.find(salesQuery)
      .populate('partyId')
      .sort({ invoiceDate: -1 });

    // Create a map of sales for quick lookup
    const salesMap = new Map();
    salesData.forEach(sale => {
      salesMap.set(sale._id.toString(), sale);
    });

    // Calculate summary
    const summary = {
      totalTransactions: 0,
      totalAmount: 0,
      totalReceived: 0,
      totalBalance: 0,
      byVoucherType: {}
    };

    const transactions = [];

    // Process vouchers into transaction format
    for (const voucher of vouchers) {
      // Find the party entry (non-cash/bank entry)
      let partyEntry = null;
      let cashBankEntry = null;

      for (const entry of voucher.entries) {
        const ledgerType = entry.ledgerId?.ledgerType || '';
        if (ledgerType === 'Cash' || ledgerType === 'Bank') {
          cashBankEntry = entry;
        } else {
          partyEntry = entry;
        }
      }

      // Determine party name
      const partyName = partyEntry?.ledgerId?.ledgerName ||
                        partyEntry?.ledgerName ||
                        cashBankEntry?.ledgerId?.ledgerName ||
                        'Cash Transaction';

      // Determine category based on ledger type or voucher type
      let categoryName = 'General';
      const ledgerType = partyEntry?.ledgerId?.ledgerType || '';

      if (voucher.referenceType === 'Sales') {
        categoryName = 'Sales';
      } else if (voucher.referenceType === 'Purchase') {
        categoryName = 'Purchase';
      } else if (ledgerType.includes('Expense')) {
        categoryName = 'Expense';
      } else if (ledgerType === 'Sundry Debtors' || ledgerType === 'Customer') {
        categoryName = 'Customer';
      } else if (ledgerType === 'Sundry Creditors' || ledgerType === 'Supplier') {
        categoryName = 'Supplier';
      } else if (ledgerType.includes('Income')) {
        categoryName = 'Income';
      } else if (ledgerType === 'Bank') {
        categoryName = 'Bank';
      } else if (voucher.voucherType === 'Journal') {
        categoryName = 'Journal';
      } else if (voucher.voucherType === 'Receipt') {
        categoryName = 'Receipt';
      } else if (voucher.voucherType === 'Payment') {
        categoryName = 'Payment';
      }

      // Calculate amounts
      const totalAmount = voucher.totalDebit || 0;
      let receivedAmount = 0;
      let balanceAmount = totalAmount;

      // For sales-related vouchers, get the actual payment status
      if (voucher.referenceId && voucher.referenceType === 'Sales') {
        const sale = salesMap.get(voucher.referenceId.toString());
        if (sale) {
          receivedAmount = sale.paidAmount || 0;
          balanceAmount = sale.balanceAmount || 0;
        }
      } else if (voucher.voucherType === 'Receipt') {
        receivedAmount = totalAmount;
        balanceAmount = 0;
      }

      const transaction = {
        _id: voucher._id,
        date: voucher.voucherDate,
        refNo: voucher.voucherNumber,
        partyName: partyName,
        categoryName: categoryName,
        type: voucher.voucherType,
        total: totalAmount,
        received: receivedAmount,
        balance: balanceAmount,
        narration: voucher.narration,
        referenceType: voucher.referenceType,
        referenceId: voucher.referenceId,
        entries: voucher.entries.map(e => ({
          ledgerId: e.ledgerId?._id,
          ledgerName: e.ledgerName || e.ledgerId?.ledgerName,
          ledgerType: e.ledgerId?.ledgerType,
          debitAmount: e.debitAmount || 0,
          creditAmount: e.creditAmount || 0
        }))
      };

      // Apply search filter
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        const matchesSearch =
          transaction.partyName?.toLowerCase().includes(searchLower) ||
          transaction.refNo?.toLowerCase().includes(searchLower) ||
          transaction.categoryName?.toLowerCase().includes(searchLower) ||
          transaction.type?.toLowerCase().includes(searchLower) ||
          transaction.narration?.toLowerCase().includes(searchLower);

        if (!matchesSearch) continue;
      }

      transactions.push(transaction);

      // Update summary
      summary.totalTransactions++;
      summary.totalAmount += totalAmount;
      summary.totalReceived += receivedAmount;
      summary.totalBalance += balanceAmount;

      // Count by voucher type
      if (!summary.byVoucherType[voucher.voucherType]) {
        summary.byVoucherType[voucher.voucherType] = {
          count: 0,
          totalAmount: 0
        };
      }
      summary.byVoucherType[voucher.voucherType].count++;
      summary.byVoucherType[voucher.voucherType].totalAmount += totalAmount;
    }

    // Get available voucher types for filter dropdown
    const voucherTypes = ['All Transaction', 'Receipt', 'Payment', 'Journal', 'Sale', 'Purchase', 'Contra'];

    res.json({
      success: true,
      data: {
        summary,
        transactions,
        voucherTypes,
        filters: {
          filterType,
          startDate,
          endDate,
          voucherType: voucherType || 'All Transaction',
          partyId,
          minAmount,
          maxAmount,
          search,
          firm
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllTransactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate all transactions report',
      error: error.message
    });
  }
};

/**
 * Profit & Loss Report (Enhanced - Tally/Vyapar Style)
 * GET /api/reports/vyapar/profit-loss
 * Query params: filterType, customStart, customEnd, viewMode
 */
export const getVyaparProfitLoss = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, viewMode = 'vyapar' } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Helper function to get ledger amount for a specific type
    const getLedgerAmount = async (ledgerTypes, isCredit = true) => {
      let total = 0;
      const items = [];

      for (const ledgerType of ledgerTypes) {
        const ledgers = await Ledger.find({
          status: 'Active',
          ledgerType: ledgerType
        });

        for (const ledger of ledgers) {
          const vouchers = await Voucher.find({
            voucherDate: { $gte: startDate, $lte: endDate },
            'entries.ledgerId': ledger._id
          });

          let amount = 0;
          vouchers.forEach(voucher => {
            voucher.entries.forEach(entry => {
              if (entry.ledgerId.toString() === ledger._id.toString()) {
                if (isCredit) {
                  amount += (entry.creditAmount || 0) - (entry.debitAmount || 0);
                } else {
                  amount += (entry.debitAmount || 0) - (entry.creditAmount || 0);
                }
              }
            });
          });

          if (Math.abs(amount) > 0.01) {
            items.push({
              ledgerId: ledger._id,
              name: ledger.ledgerName,
              ledgerType: ledger.ledgerType,
              amount: Math.abs(amount)
            });
            total += Math.abs(amount);
          }
        }
      }

      return { total, items };
    };

    // ===== INCOME SECTION =====
    // Sale (+)
    const salesData = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    });
    const saleAmount = salesData.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);

    // Credit Note (-) - Returns/Credit notes from vouchers
    const creditNoteVouchers = await Voucher.find({
      voucherDate: { $gte: startDate, $lte: endDate },
      voucherType: 'Credit Note'
    });
    const creditNoteAmount = creditNoteVouchers.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

    // Sale FA (Fixed Assets Sale) - placeholder
    const saleFA = 0;

    const totalIncome = saleAmount - creditNoteAmount + saleFA;

    // ===== PURCHASE & DIRECT COST SECTION =====
    // Purchase (-) - Use BusinessStockTransaction for Business inventory
    // Only include referenceType='Purchase' to exclude Opening Stock / Adjustments
    // Use item-level (quantity * rate) to avoid multi-item invoice triple-counting from totalAmount field
    const purchaseTransactions = await BusinessStockTransaction.find({
      date: { $gte: startDate, $lte: endDate },
      transactionType: 'Stock In',
      referenceType: 'Purchase'
    });
    const purchaseAmount = purchaseTransactions.reduce((sum, tx) =>
      sum + ((tx.quantity || 0) * (tx.rate || 0)), 0);

    // Debit Note (+) - Returns to supplier
    const debitNoteVouchers = await Voucher.find({
      voucherDate: { $gte: startDate, $lte: endDate },
      voucherType: 'Debit Note'
    });
    const debitNoteAmount = debitNoteVouchers.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

    // Purchase FA (Fixed Assets Purchase) - placeholder
    const purchaseFA = 0;

    const totalPurchaseDirectCost = purchaseAmount - debitNoteAmount + purchaseFA;

    // ===== DIRECT EXPENSES SECTION =====
    const directExpenseTypes = ['Trade Expenses'];
    const directExpensesData = await getLedgerAmount(directExpenseTypes, false);

    // Payment-in Discount - from vouchers
    const paymentDiscountVouchers = await Voucher.find({
      voucherDate: { $gte: startDate, $lte: endDate },
      'entries.particulars': { $regex: /discount/i }
    });
    let paymentDiscount = 0;
    paymentDiscountVouchers.forEach(v => {
      v.entries.forEach(entry => {
        if (entry.particulars && entry.particulars.toLowerCase().includes('discount')) {
          paymentDiscount += entry.debitAmount || 0;
        }
      });
    });

    const totalDirectExpenses = directExpensesData.total + paymentDiscount;

    // ===== TAX PAYABLE SECTION =====
    // GST Payable
    const gstPayableLedgers = await Ledger.find({
      status: 'Active',
      ledgerName: { $regex: /gst.*payable|cgst.*payable|sgst.*payable|igst.*payable/i }
    });
    let gstPayable = 0;
    for (const ledger of gstPayableLedgers) {
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });
      vouchers.forEach(v => {
        v.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            gstPayable += (entry.creditAmount || 0) - (entry.debitAmount || 0);
          }
        });
      });
    }
    gstPayable = Math.max(0, gstPayable);

    // TCS Payable
    const tcsPayableLedgers = await Ledger.find({
      status: 'Active',
      ledgerName: { $regex: /tcs.*payable/i }
    });
    let tcsPayable = 0;
    for (const ledger of tcsPayableLedgers) {
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });
      vouchers.forEach(v => {
        v.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            tcsPayable += (entry.creditAmount || 0) - (entry.debitAmount || 0);
          }
        });
      });
    }
    tcsPayable = Math.max(0, tcsPayable);

    // TDS Payable
    const tdsPayableLedgers = await Ledger.find({
      status: 'Active',
      ledgerName: { $regex: /tds.*payable/i }
    });
    let tdsPayable = 0;
    for (const ledger of tdsPayableLedgers) {
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });
      vouchers.forEach(v => {
        v.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            tdsPayable += (entry.creditAmount || 0) - (entry.debitAmount || 0);
          }
        });
      });
    }
    tdsPayable = Math.max(0, tdsPayable);

    const totalTaxPayable = gstPayable + tcsPayable + tdsPayable;

    // ===== TAX RECEIVABLE SECTION =====
    // GST Receivable (Input GST)
    const gstReceivableLedgers = await Ledger.find({
      status: 'Active',
      ledgerName: { $regex: /gst.*receivable|input.*gst|cgst.*input|sgst.*input|igst.*input/i }
    });
    let gstReceivable = 0;
    for (const ledger of gstReceivableLedgers) {
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });
      vouchers.forEach(v => {
        v.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            gstReceivable += (entry.debitAmount || 0) - (entry.creditAmount || 0);
          }
        });
      });
    }
    gstReceivable = Math.max(0, gstReceivable);

    // TCS Receivable
    const tcsReceivableLedgers = await Ledger.find({
      status: 'Active',
      ledgerName: { $regex: /tcs.*receivable/i }
    });
    let tcsReceivable = 0;
    for (const ledger of tcsReceivableLedgers) {
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });
      vouchers.forEach(v => {
        v.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            tcsReceivable += (entry.debitAmount || 0) - (entry.creditAmount || 0);
          }
        });
      });
    }
    tcsReceivable = Math.max(0, tcsReceivable);

    // TDS Receivable
    const tdsReceivableLedgers = await Ledger.find({
      status: 'Active',
      ledgerName: { $regex: /tds.*receivable/i }
    });
    let tdsReceivable = 0;
    for (const ledger of tdsReceivableLedgers) {
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });
      vouchers.forEach(v => {
        v.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            tdsReceivable += (entry.debitAmount || 0) - (entry.creditAmount || 0);
          }
        });
      });
    }
    tdsReceivable = Math.max(0, tdsReceivable);

    const totalTaxReceivable = gstReceivable + tcsReceivable + tdsReceivable;

    // ===== STOCK ADJUSTMENTS SECTION =====
    // Get all Business items for stock calculation (Vyapar reports use Business inventory)
    const items = await BusinessItem.find({ status: 'Active' });

    // Opening Stock - Calculate stock value at start date
    let openingStock = 0;
    for (const item of items) {
      const stockInBefore = await BusinessStockTransaction.find({
        itemId: item._id,
        transactionType: 'Stock In',
        date: { $lt: startDate }
      });
      const stockOutBefore = await BusinessStockTransaction.find({
        itemId: item._id,
        transactionType: 'Stock Out',
        date: { $lt: startDate }
      });

      const qtyIn = stockInBefore.reduce((sum, tx) => sum + (tx.quantity || 0), 0);
      const qtyOut = stockOutBefore.reduce((sum, tx) => sum + (tx.quantity || 0), 0);
      const openingQty = qtyIn - qtyOut;
      openingStock += openingQty * (item.purchasePrice || item.costPrice || 0);
    }

    // Closing Stock - Calculate stock value at end date
    let closingStock = 0;
    for (const item of items) {
      const stockInBefore = await BusinessStockTransaction.find({
        itemId: item._id,
        transactionType: 'Stock In',
        date: { $lte: endDate }
      });
      const stockOutBefore = await BusinessStockTransaction.find({
        itemId: item._id,
        transactionType: 'Stock Out',
        date: { $lte: endDate }
      });

      const qtyIn = stockInBefore.reduce((sum, tx) => sum + (tx.quantity || 0), 0);
      const qtyOut = stockOutBefore.reduce((sum, tx) => sum + (tx.quantity || 0), 0);
      const closingQty = qtyIn - qtyOut;
      closingStock += closingQty * (item.purchasePrice || item.costPrice || 0);
    }

    // Fixed Assets Stock - placeholder for now
    const openingStockFA = 0;
    const closingStockFA = 0;

    const netStockAdjustment = (closingStock - openingStock) + (closingStockFA - openingStockFA);

    // ===== GROSS PROFIT CALCULATION =====
    const grossProfit = totalIncome
      - totalPurchaseDirectCost
      - totalDirectExpenses
      - totalTaxPayable
      + totalTaxReceivable
      + netStockAdjustment;

    // ===== INDIRECT INCOME (OTHER INCOME) =====
    const indirectIncomeTypes = ['Miscellaneous Income', 'Other Revenue', 'Trade Income'];
    const indirectIncomeData = await getLedgerAmount(indirectIncomeTypes, true);

    // ===== INDIRECT EXPENSES =====
    const indirectExpenseTypes = ['Establishment Charges', 'Miscellaneous Expenses'];
    const indirectExpensesData = await getLedgerAmount(indirectExpenseTypes, false);

    // ===== NET PROFIT CALCULATION =====
    const netProfit = grossProfit + indirectIncomeData.total - indirectExpensesData.total;

    // ===== RESPONSE =====
    res.json({
      success: true,
      data: {
        // Income Section
        income: {
          sale: saleAmount,
          creditNote: creditNoteAmount,
          saleFA: saleFA,
          total: totalIncome
        },

        // Purchase & Direct Cost Section
        purchaseDirectCost: {
          purchase: purchaseAmount,
          debitNote: debitNoteAmount,
          purchaseFA: purchaseFA,
          total: totalPurchaseDirectCost
        },

        // Direct Expenses Section
        directExpenses: {
          otherDirect: directExpensesData.total,
          paymentDiscount: paymentDiscount,
          total: totalDirectExpenses,
          items: directExpensesData.items
        },

        // Tax Payable Section
        taxPayable: {
          gst: gstPayable,
          tcs: tcsPayable,
          tds: tdsPayable,
          total: totalTaxPayable
        },

        // Tax Receivable Section
        taxReceivable: {
          gst: gstReceivable,
          tcs: tcsReceivable,
          tds: tdsReceivable,
          total: totalTaxReceivable
        },

        // Stock Adjustments Section
        stockAdjustments: {
          openingStock: openingStock,
          closingStock: closingStock,
          openingStockFA: openingStockFA,
          closingStockFA: closingStockFA,
          netAdjustment: netStockAdjustment
        },

        // Gross Profit
        grossProfit: grossProfit,

        // Indirect Income (Other Income)
        indirectIncome: {
          total: indirectIncomeData.total,
          items: indirectIncomeData.items
        },

        // Indirect Expenses
        indirectExpenses: {
          total: indirectExpensesData.total,
          items: indirectExpensesData.items
        },

        // Net Profit
        netProfit: netProfit,

        // Summary
        summary: {
          totalIncome,
          totalExpenses: totalPurchaseDirectCost + totalDirectExpenses + indirectExpensesData.total,
          grossProfit,
          netProfit,
          profitMargin: totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0,
          grossMargin: totalIncome > 0 ? ((grossProfit / totalIncome) * 100).toFixed(2) : 0
        },

        // Filters
        filters: {
          filterType,
          startDate,
          endDate,
          viewMode
        }
      }
    });
  } catch (error) {
    console.error('Error in getVyaparProfitLoss:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate profit & loss report',
      error: error.message
    });
  }
};

/**
 * Balance Sheet (Enhanced) - Assets, Liabilities, Capital
 * GET /api/reports/vyapar/balance-sheet
 * Query params: asOnDate
 */
export const getVyaparBalanceSheet = async (req, res) => {
  try {
    const { asOnDate } = req.query;
    const endDate = asOnDate ? new Date(asOnDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch all ledgers
    const ledgers = await Ledger.find({ status: 'Active' });

    const assets = [];
    const liabilities = [];
    const capital = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalCapital = 0;

    for (const ledger of ledgers) {
      const category = getLedgerCategory(ledger.ledgerType);
      const isDebitNature = isDebitNatureLedger(ledger.ledgerType);

      // Calculate balance as on date
      const openingBalance = await calculateOpeningBalance(
        Ledger,
        Voucher,
        ledger._id,
        new Date(0) // From beginning
      );

      const vouchers = await Voucher.find({
        voucherDate: { $lte: endDate },
        'entries.ledgerId': ledger._id
      });

      let totalDebits = 0;
      let totalCredits = 0;

      vouchers.forEach(voucher => {
        voucher.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            totalDebits += entry.debitAmount || 0;
            totalCredits += entry.creditAmount || 0;
          }
        });
      });

      const balance = calculateClosingBalance(openingBalance, totalDebits, totalCredits, isDebitNature);

      if (Math.abs(balance) > 0.01) {
        const item = {
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          ledgerType: ledger.ledgerType,
          balance: Math.abs(balance),
          balanceType: getBalanceType(balance, isDebitNature)
        };

        if (category === 'ASSETS') {
          assets.push(item);
          totalAssets += Math.abs(balance);
        } else if (category === 'LIABILITIES') {
          liabilities.push(item);
          totalLiabilities += Math.abs(balance);
        } else if (category === 'CAPITAL') {
          capital.push(item);
          totalCapital += Math.abs(balance);
        }
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalAssets,
          totalLiabilities,
          totalCapital,
          liabilitiesAndCapital: totalLiabilities + totalCapital,
          difference: totalAssets - (totalLiabilities + totalCapital)
        },
        assets: assets.sort((a, b) => b.balance - a.balance),
        liabilities: liabilities.sort((a, b) => b.balance - a.balance),
        capital: capital.sort((a, b) => b.balance - a.balance),
        filters: { asOnDate: endDate }
      }
    });
  } catch (error) {
    console.error('Error in getVyaparBalanceSheet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate balance sheet',
      error: error.message
    });
  }
};

/**
 * Bill Wise Party Report - Bills grouped by party (Vyapar style)
 * GET /api/reports/vyapar/bill-profit
 * Query params: filterType, customStart, customEnd, partyType, search
 *
 * Features:
 * - Groups all bills (sales and purchases) by party name
 * - Shows bill number, date, type, total amount, discount, GST, paid, balance
 * - Calculates party-wise totals
 * - Chronological order within each party
 */
export const getBillWiseProfit = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, partyType, search } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Initialize party map
    const partyMap = new Map();

    // Helper to initialize or get party
    const getOrCreateParty = (partyId, partyName, type) => {
      const key = partyId || partyName || 'Unknown';
      if (!partyMap.has(key)) {
        partyMap.set(key, {
          partyId: key,
          partyName: partyName || 'Unknown Party',
          partyType: type,
          bills: [],
          totals: {
            totalBills: 0,
            totalAmount: 0,
            totalDiscount: 0,
            totalGst: 0,
            totalPaid: 0,
            totalBalance: 0
          }
        });
      }
      return partyMap.get(key);
    };

    // 1. Fetch all sales within date range - Business Sales
    const sales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    })
      .populate('partyId')
      .sort({ invoiceDate: 1 });

    for (const sale of sales) {
      const partyId = sale.partyId?._id?.toString() || sale.partyName || 'cash';
      const partyName = sale.partyName || 'Cash Sales';

      // Apply party type filter
      if (partyType === 'Supplier') continue;

      const party = getOrCreateParty(partyId, partyName, 'Customer');

      const billAmount = sale.grandTotal || sale.taxableAmount || 0;
      const discount = sale.billDiscount || sale.itemDiscount || 0;
      const gstAmount = sale.totalGst || 0;
      const paidAmount = sale.paidAmount || 0;
      const balanceAmount = sale.balanceAmount || (billAmount - paidAmount);

      party.bills.push({
        _id: sale._id,
        billNumber: sale.invoiceNumber,
        billDate: sale.invoiceDate,
        billType: 'Sales',
        totalAmount: billAmount,
        discount: discount,
        gstAmount: gstAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        itemCount: sale.items?.length || 0,
        paymentMode: sale.paymentMode || 'Credit',
        status: balanceAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid'
      });

      // Update party totals
      party.totals.totalBills++;
      party.totals.totalAmount += billAmount;
      party.totals.totalDiscount += discount;
      party.totals.totalGst += gstAmount;
      party.totals.totalPaid += paidAmount;
      party.totals.totalBalance += balanceAmount;
    }

    // 2. Fetch all purchases (Stock In transactions) within date range - Business inventory
    const purchases = await BusinessStockTransaction.find({
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: startDate, $lte: endDate }
    })
      .populate('supplierId')
      .populate('itemId')
      .sort({ date: 1 });

    // Group purchases by invoice number
    const purchaseInvoiceMap = new Map();

    for (const purchase of purchases) {
      const invoiceKey = purchase.invoiceNumber || `PUR-${purchase._id.toString().slice(-6)}`;

      if (!purchaseInvoiceMap.has(invoiceKey)) {
        purchaseInvoiceMap.set(invoiceKey, {
          invoiceNumber: purchase.invoiceNumber || invoiceKey,
          invoiceDate: purchase.invoiceDate || purchase.date,
          supplierId: purchase.supplierId?._id?.toString() || 'unknown',
          supplierName: purchase.supplierName || purchase.supplierId?.name || 'Unknown Supplier',
          totalAmount: 0,
          discount: 0,
          gstAmount: 0,
          paidAmount: 0,
          balanceAmount: 0,
          itemCount: 0,
          paymentMode: purchase.paymentMode || 'Credit'
        });
      }

      const invoice = purchaseInvoiceMap.get(invoiceKey);
      const itemAmount = (purchase.quantity || 0) * (purchase.rate || 0);
      const itemGst = purchase.gstAmount || 0;

      invoice.totalAmount += purchase.totalAmount || itemAmount;
      invoice.gstAmount += itemGst;
      invoice.paidAmount += purchase.paidAmount || 0;
      invoice.itemCount++;
    }

    // Process grouped purchases
    for (const [invoiceKey, invoice] of purchaseInvoiceMap) {
      // Apply party type filter
      if (partyType === 'Customer') continue;

      const party = getOrCreateParty(invoice.supplierId, invoice.supplierName, 'Supplier');

      const balanceAmount = invoice.totalAmount - invoice.paidAmount;

      party.bills.push({
        _id: invoiceKey,
        billNumber: invoice.invoiceNumber,
        billDate: invoice.invoiceDate,
        billType: 'Purchase',
        totalAmount: invoice.totalAmount,
        discount: invoice.discount,
        gstAmount: invoice.gstAmount,
        paidAmount: invoice.paidAmount,
        balanceAmount: balanceAmount,
        itemCount: invoice.itemCount,
        paymentMode: invoice.paymentMode,
        status: balanceAmount <= 0 ? 'Paid' : invoice.paidAmount > 0 ? 'Partial' : 'Pending'
      });

      // Update party totals
      party.totals.totalBills++;
      party.totals.totalAmount += invoice.totalAmount;
      party.totals.totalDiscount += invoice.discount;
      party.totals.totalGst += invoice.gstAmount;
      party.totals.totalPaid += invoice.paidAmount;
      party.totals.totalBalance += balanceAmount;
    }

    // Convert to array and apply search filter
    let parties = Array.from(partyMap.values());

    // Apply search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      parties = parties.filter(party =>
        party.partyName.toLowerCase().includes(searchLower) ||
        party.bills.some(bill =>
          bill.billNumber?.toLowerCase().includes(searchLower)
        )
      );
    }

    // Sort bills within each party by date (chronological)
    parties.forEach(party => {
      party.bills.sort((a, b) => new Date(a.billDate) - new Date(b.billDate));
    });

    // Sort parties by total amount descending
    parties.sort((a, b) => b.totals.totalAmount - a.totals.totalAmount);

    // Calculate overall summary
    const summary = {
      totalParties: parties.length,
      totalCustomers: parties.filter(p => p.partyType === 'Customer').length,
      totalSuppliers: parties.filter(p => p.partyType === 'Supplier').length,
      totalBills: parties.reduce((sum, p) => sum + p.totals.totalBills, 0),
      totalSalesBills: parties.filter(p => p.partyType === 'Customer').reduce((sum, p) => sum + p.totals.totalBills, 0),
      totalPurchaseBills: parties.filter(p => p.partyType === 'Supplier').reduce((sum, p) => sum + p.totals.totalBills, 0),
      totalAmount: parties.reduce((sum, p) => sum + p.totals.totalAmount, 0),
      totalSalesAmount: parties.filter(p => p.partyType === 'Customer').reduce((sum, p) => sum + p.totals.totalAmount, 0),
      totalPurchaseAmount: parties.filter(p => p.partyType === 'Supplier').reduce((sum, p) => sum + p.totals.totalAmount, 0),
      totalDiscount: parties.reduce((sum, p) => sum + p.totals.totalDiscount, 0),
      totalGst: parties.reduce((sum, p) => sum + p.totals.totalGst, 0),
      totalPaid: parties.reduce((sum, p) => sum + p.totals.totalPaid, 0),
      totalBalance: parties.reduce((sum, p) => sum + p.totals.totalBalance, 0),
      totalReceivable: parties.filter(p => p.partyType === 'Customer').reduce((sum, p) => sum + p.totals.totalBalance, 0),
      totalPayable: parties.filter(p => p.partyType === 'Supplier').reduce((sum, p) => sum + p.totals.totalBalance, 0),
      paidBills: parties.reduce((sum, p) => sum + p.bills.filter(b => b.status === 'Paid').length, 0),
      partialBills: parties.reduce((sum, p) => sum + p.bills.filter(b => b.status === 'Partial').length, 0),
      pendingBills: parties.reduce((sum, p) => sum + p.bills.filter(b => b.status === 'Pending').length, 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        parties,
        filters: { filterType, startDate, endDate, partyType, search }
      }
    });
  } catch (error) {
    console.error('Error in getBillWiseProfit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate bill wise party report',
      error: error.message
    });
  }
};

/**
 * Party Wise Profit & Loss - Comprehensive profitability by customer/supplier
 * GET /api/reports/vyapar/party-profit
 * Query params: filterType, customStart, customEnd, partyType
 *
 * Features:
 * - Groups all transactions by party name
 * - Calculates total sales, purchases, sales returns, purchase returns
 * - Computes related expenses, GST impact
 * - Calculates net sales, COGS, gross profit, net profit/loss
 * - Shows receivable and payable balances separately
 */
export const getPartyWiseProfit = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, partyType } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Initialize party map to hold all party data
    const partyMap = new Map();

    // Helper function to initialize party record
    const initParty = (partyId, partyName, type) => {
      if (!partyMap.has(partyId)) {
        partyMap.set(partyId, {
          partyId,
          partyName,
          partyType: type, // 'Customer' or 'Supplier'
          // Sales metrics
          totalSales: 0,
          salesCount: 0,
          salesGst: 0,
          // Purchase metrics
          totalPurchases: 0,
          purchaseCount: 0,
          purchaseGst: 0,
          // Returns
          salesReturns: 0,
          purchaseReturns: 0,
          // Cost of goods sold
          costOfGoodsSold: 0,
          // Expenses related to party
          relatedExpenses: 0,
          // Payment tracking
          paidByParty: 0,      // Amount received from party
          paidToParty: 0,      // Amount paid to party
          // Balances
          receivable: 0,       // Party owes us
          payable: 0,          // We owe party
          // Opening balance
          openingBalance: 0,
          openingBalanceType: 'Dr'
        });
      }
      return partyMap.get(partyId);
    };

    // 1. Fetch all sales within date range - Business Sales
    const sales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    }).populate('items.itemId').populate('partyId');

    for (const sale of sales) {
      const partyId = sale.partyId ? sale.partyId._id?.toString() || sale.partyId.toString() : 'cash';
      const partyName = sale.partyName || 'Cash Sales';
      const party = initParty(partyId, partyName, 'Customer');

      // Calculate sale revenue and cost
      const saleRevenue = sale.taxableAmount || 0;
      const saleGst = sale.totalGst || 0;
      let saleCost = 0;

      for (const item of sale.items) {
        if (item.itemId && (item.itemId.purchasePrice || item.itemId.costPrice)) {
          saleCost += (item.itemId.purchasePrice || item.itemId.costPrice) * item.quantity;
        }
      }

      party.totalSales += saleRevenue;
      party.salesGst += saleGst;
      party.salesCount++;
      party.costOfGoodsSold += saleCost;
      party.paidByParty += sale.paidAmount || 0;
      party.receivable += sale.balanceAmount || 0;
    }

    // 2. Fetch all purchases (Stock In transactions) within date range - Business inventory
    const purchases = await BusinessStockTransaction.find({
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: startDate, $lte: endDate }
    }).populate('itemId').populate('supplierId');

    // Group purchases by invoice to avoid double counting
    const purchaseInvoiceMap = new Map();
    for (const purchase of purchases) {
      const invoiceKey = purchase.invoiceNumber || purchase._id.toString();
      if (!purchaseInvoiceMap.has(invoiceKey)) {
        purchaseInvoiceMap.set(invoiceKey, {
          supplierId: purchase.supplierId?._id?.toString() || 'unknown',
          supplierName: purchase.supplierName || 'Unknown Supplier',
          totalAmount: 0,
          paidAmount: 0,
          items: []
        });
      }
      const invoice = purchaseInvoiceMap.get(invoiceKey);
      // Use item-level (quantity * rate) to avoid multi-item invoice over-counting from totalAmount
      invoice.totalAmount += (purchase.quantity || 0) * (purchase.rate || 0);
      invoice.paidAmount += purchase.paidAmount || 0;
      invoice.items.push(purchase);
    }

    // Process grouped purchases
    for (const [invoiceKey, invoice] of purchaseInvoiceMap) {
      const partyId = invoice.supplierId;
      const partyName = invoice.supplierName;
      const party = initParty(partyId, partyName, 'Supplier');

      party.totalPurchases += invoice.totalAmount;
      party.purchaseCount++;
      party.paidToParty += invoice.paidAmount;
      party.payable += (invoice.totalAmount - invoice.paidAmount);
    }

    // 3. Fetch vouchers for returns and expenses
    const vouchers = await Voucher.find({
      voucherDate: { $gte: startDate, $lte: endDate }
    }).populate('entries.ledgerId');

    for (const voucher of vouchers) {
      for (const entry of voucher.entries) {
        if (!entry.ledgerId) continue;

        const ledger = entry.ledgerId;
        const ledgerType = ledger.ledgerType;

        // Check if this ledger is linked to a party
        if (ledger.linkedEntity && ledger.linkedEntity.entityId) {
          const partyId = ledger.linkedEntity.entityId.toString();
          const entityType = ledger.linkedEntity.entityType;

          if (partyMap.has(partyId)) {
            const party = partyMap.get(partyId);

            // Sales Returns (Credit Notes)
            if (ledgerType === 'Sales A/c' && entry.debitAmount > 0) {
              party.salesReturns += entry.debitAmount;
            }

            // Purchase Returns (Debit Notes)
            if (ledgerType === 'Purchases A/c' && entry.creditAmount > 0) {
              party.purchaseReturns += entry.creditAmount;
            }

            // Related expenses
            if (ledgerType === 'Trade Expenses' || ledgerType === 'Miscellaneous Expenses') {
              party.relatedExpenses += entry.debitAmount || 0;
            }
          }
        }
      }
    }

    // 4. Fetch opening balances from ledgers for customers and suppliers
    const customerLedgers = await Ledger.find({
      'linkedEntity.entityType': { $in: ['Customer', 'Supplier'] },
      status: 'Active'
    });

    for (const ledger of customerLedgers) {
      if (ledger.linkedEntity && ledger.linkedEntity.entityId) {
        const partyId = ledger.linkedEntity.entityId.toString();
        if (partyMap.has(partyId)) {
          const party = partyMap.get(partyId);

          // Calculate opening balance as of startDate
          const openingBal = await calculateOpeningBalance(
            Ledger,
            Voucher,
            ledger._id,
            startDate
          );

          const isDebitNature = isDebitNatureLedger(ledger.ledgerType);
          party.openingBalance = Math.abs(openingBal);
          party.openingBalanceType = getBalanceType(openingBal, isDebitNature);
        }
      }
    }

    // 5. Calculate derived metrics for each party
    const records = Array.from(partyMap.values()).map(party => {
      // Net Sales = Total Sales - Sales Returns
      const netSales = party.totalSales - party.salesReturns;

      // Net Purchases = Total Purchases - Purchase Returns
      const netPurchases = party.totalPurchases - party.purchaseReturns;

      // Gross Profit = Net Sales - COGS (for customers)
      // For suppliers, we track purchase margin
      const grossProfit = party.partyType === 'Customer'
        ? netSales - party.costOfGoodsSold
        : 0;

      // Net GST Impact = Sales GST - Purchase GST
      const netGstImpact = party.salesGst - party.purchaseGst;

      // Net Profit = Gross Profit - Related Expenses + Purchase Returns (if supplier)
      const netProfit = party.partyType === 'Customer'
        ? grossProfit - party.relatedExpenses
        : party.purchaseReturns - party.relatedExpenses;

      // Profit margin percentage
      const profitMargin = netSales > 0
        ? ((netProfit / netSales) * 100)
        : 0;

      // Closing Balance calculation
      let closingBalance = party.openingBalance;
      if (party.openingBalanceType === 'Dr') {
        closingBalance += (party.totalSales + party.salesGst - party.salesReturns - party.paidByParty);
      } else {
        closingBalance = closingBalance - (party.totalSales + party.salesGst - party.salesReturns - party.paidByParty);
      }

      // Determine if in profit or loss
      const status = netProfit > 0 ? 'Profit' : netProfit < 0 ? 'Loss' : 'Break-even';

      return {
        ...party,
        netSales,
        netPurchases,
        grossProfit,
        netGstImpact,
        netProfit,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        closingBalance: Math.abs(closingBalance),
        closingBalanceType: closingBalance >= 0 ? 'Dr' : 'Cr',
        status,
        averageOrderValue: party.salesCount > 0
          ? parseFloat((party.totalSales / party.salesCount).toFixed(2))
          : 0,
        totalTransactions: party.salesCount + party.purchaseCount
      };
    });

    // Filter by party type if specified
    const filteredRecords = partyType
      ? records.filter(r => r.partyType === partyType)
      : records;

    // 6. Calculate summary statistics
    const customers = filteredRecords.filter(r => r.partyType === 'Customer');
    const suppliers = filteredRecords.filter(r => r.partyType === 'Supplier');

    const summary = {
      // Overall
      totalParties: filteredRecords.length,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,

      // Sales Summary
      totalSales: filteredRecords.reduce((sum, p) => sum + p.totalSales, 0),
      totalSalesReturns: filteredRecords.reduce((sum, p) => sum + p.salesReturns, 0),
      netSales: filteredRecords.reduce((sum, p) => sum + p.netSales, 0),
      totalSalesGst: filteredRecords.reduce((sum, p) => sum + p.salesGst, 0),

      // Purchase Summary
      totalPurchases: filteredRecords.reduce((sum, p) => sum + p.totalPurchases, 0),
      totalPurchaseReturns: filteredRecords.reduce((sum, p) => sum + p.purchaseReturns, 0),
      netPurchases: filteredRecords.reduce((sum, p) => sum + p.netPurchases, 0),
      totalPurchaseGst: filteredRecords.reduce((sum, p) => sum + p.purchaseGst, 0),

      // Profit Summary
      totalCogs: filteredRecords.reduce((sum, p) => sum + p.costOfGoodsSold, 0),
      totalGrossProfit: filteredRecords.reduce((sum, p) => sum + p.grossProfit, 0),
      totalExpenses: filteredRecords.reduce((sum, p) => sum + p.relatedExpenses, 0),
      totalNetProfit: filteredRecords.reduce((sum, p) => sum + p.netProfit, 0),

      // Balance Summary
      totalReceivable: filteredRecords.reduce((sum, p) => sum + p.receivable, 0),
      totalPayable: filteredRecords.reduce((sum, p) => sum + p.payable, 0),
      netBalance: filteredRecords.reduce((sum, p) => sum + p.receivable - p.payable, 0),

      // Transaction counts
      totalSalesBills: filteredRecords.reduce((sum, p) => sum + p.salesCount, 0),
      totalPurchaseBills: filteredRecords.reduce((sum, p) => sum + p.purchaseCount, 0),

      // Profit/Loss counts
      partiesInProfit: filteredRecords.filter(r => r.status === 'Profit').length,
      partiesInLoss: filteredRecords.filter(r => r.status === 'Loss').length,
      partiesBreakEven: filteredRecords.filter(r => r.status === 'Break-even').length
    };

    res.json({
      success: true,
      data: {
        summary,
        parties: filteredRecords.sort((a, b) => b.netProfit - a.netProfit),
        filters: { filterType, startDate, endDate, partyType }
      }
    });
  } catch (error) {
    console.error('Error in getPartyWiseProfit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate party wise profit report',
      error: error.message
    });
  }
};

/**
 * Trial Balance - Vyapar/Tally Style with Opening, Transactions, and Closing
 * GET /api/reports/vyapar/trial-balance
 * Query params: filterType, customStart, customEnd
 */
export const getTrialBalance = async (req, res) => {
  try {
    const { filterType, customStart, customEnd } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Fetch all active ledgers
    const ledgers = await Ledger.find({ status: 'Active' });

    const records = [];
    let totalOpeningDr = 0;
    let totalOpeningCr = 0;
    let totalDebitAmount = 0;
    let totalCreditAmount = 0;
    let totalClosingDr = 0;
    let totalClosingCr = 0;

    // Category-wise grouping
    const categoryGroups = {
      'Assets': [],
      'Liabilities': [],
      'Income': [],
      'Expenses': [],
      'Capital': [],
      'Other': []
    };

    for (const ledger of ledgers) {
      const isDebitNature = isDebitNatureLedger(ledger.ledgerType);
      const category = getLedgerCategory(ledger.ledgerType);

      // Calculate opening balance (before startDate)
      const openingBalance = await calculateOpeningBalance(
        Ledger,
        Voucher,
        ledger._id,
        startDate
      );

      // Get transactions within the period
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });

      let periodDebits = 0;
      let periodCredits = 0;

      vouchers.forEach(voucher => {
        voucher.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            periodDebits += entry.debitAmount || 0;
            periodCredits += entry.creditAmount || 0;
          }
        });
      });

      // Calculate closing balance
      const closingBalance = calculateClosingBalance(
        openingBalance,
        periodDebits,
        periodCredits,
        isDebitNature
      );

      // Determine balance types
      const openingType = getBalanceType(openingBalance, isDebitNature);
      const closingType = getBalanceType(closingBalance, isDebitNature);

      const openingDr = openingType === 'Dr' ? Math.abs(openingBalance) : 0;
      const openingCr = openingType === 'Cr' ? Math.abs(openingBalance) : 0;
      const closingDr = closingType === 'Dr' ? Math.abs(closingBalance) : 0;
      const closingCr = closingType === 'Cr' ? Math.abs(closingBalance) : 0;

      // Only include ledgers that have transactions in the selected period
      // If no transactions in period, don't show the ledger (even if it has opening/closing balance)
      if (periodDebits > 0.01 || periodCredits > 0.01) {
        const record = {
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          ledgerType: ledger.ledgerType,
          category,
          openingDr,
          openingCr,
          debitAmount: periodDebits,
          creditAmount: periodCredits,
          closingDr,
          closingCr
        };

        records.push(record);

        // Add to category group
        const groupKey = categoryGroups[category] ? category : 'Other';
        categoryGroups[groupKey].push(record);

        // Update totals
        totalOpeningDr += openingDr;
        totalOpeningCr += openingCr;
        totalDebitAmount += periodDebits;
        totalCreditAmount += periodCredits;
        totalClosingDr += closingDr;
        totalClosingCr += closingCr;
      }
    }

    // Sort records within each category
    Object.keys(categoryGroups).forEach(key => {
      categoryGroups[key].sort((a, b) => a.ledgerName.localeCompare(b.ledgerName));
    });

    // Check if balanced
    const isBalanced = Math.abs(totalClosingDr - totalClosingCr) < 0.01;

    res.json({
      success: true,
      data: {
        summary: {
          totalLedgers: records.length,
          openingDebit: totalOpeningDr,
          openingCredit: totalOpeningCr,
          totalDebit: totalDebitAmount,
          totalCredit: totalCreditAmount,
          closingDebit: totalClosingDr,
          closingCredit: totalClosingCr,
          difference: Math.abs(totalClosingDr - totalClosingCr),
          isBalanced
        },
        ledgers: records.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName)),
        groupedLedgers: categoryGroups,
        filters: {
          filterType,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error in getTrialBalance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate trial balance',
      error: error.message
    });
  }
};

/**
 * Stock Summary - Current stock levels by item (Tally/Vyapar style)
 * GET /api/reports/vyapar/stock-summary
 * Query params: category, asOfDate, showOnlyInStock, inventoryType
 */
export const getStockSummary = async (req, res) => {
  try {
    const { category, asOfDate, showOnlyInStock, inventoryType } = req.query;

    // Build query for active Business items for Vyapar reports
    const itemQuery = { status: 'Active' };
    if (category && category !== 'all') {
      itemQuery.category = category;
    }

    // Fetch all Business items
    const items = await BusinessItem.find(itemQuery).sort({ itemName: 1 });

    // If asOfDate is provided, we need to calculate stock as of that date
    // by considering stock transactions up to that date
    let stockByItem = new Map();

    if (asOfDate) {
      const endDate = new Date(asOfDate);
      endDate.setHours(23, 59, 59, 999);

      // Get all business stock transactions up to the date
      const transactions = await BusinessStockTransaction.find({
        date: { $lte: endDate }
      });

      // Calculate stock for each item from transactions only
      // Do NOT start with item.openingBalance because the opening balance already
      // creates a Stock In transaction (referenceType='Opening'), which would double-count
      items.forEach(item => {
        let stockQty = 0;

        transactions.forEach(txn => {
          if (txn.itemId && txn.itemId.toString() === item._id.toString()) {
            if (txn.transactionType === 'Stock In') {
              stockQty += txn.quantity || 0;
            } else if (txn.transactionType === 'Stock Out') {
              stockQty -= txn.quantity || 0;
            }
          }
        });

        stockByItem.set(item._id.toString(), stockQty);
      });
    }

    const records = [];
    let totalStockQty = 0;
    let totalStockValue = 0;
    let inStockCount = 0;
    let outOfStockCount = 0;

    items.forEach(item => {
      // Get stock quantity
      let stockQty;
      if (asOfDate) {
        stockQty = stockByItem.get(item._id.toString()) || 0;
      } else {
        stockQty = item.currentBalance || 0;
      }

      // Apply "show only in stock" filter
      if (showOnlyInStock === 'true' && stockQty <= 0) {
        return;
      }

      // Get prices - use salesRate for sale price, purchasePrice for cost
      const salePrice = item.salesRate || item.retailPrice || 0;
      const purchasePrice = item.purchasePrice || item.wholesalePrice || 0;

      // Calculate stock value based on purchase price (cost-based valuation)
      const stockValue = stockQty * purchasePrice;

      records.push({
        itemId: item._id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category || 'Uncategorized',
        unit: item.unit || item.measurement,
        salePrice,
        purchasePrice,
        stockQty,
        stockValue
      });

      totalStockQty += stockQty;
      totalStockValue += stockValue;

      if (stockQty > 0) {
        inStockCount++;
      } else {
        outOfStockCount++;
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalItems: records.length,
          inStockCount,
          outOfStockCount,
          totalStockQty,
          totalStockValue
        },
        items: records,
        filters: {
          category: category || 'all',
          asOfDate: asOfDate || null,
          showOnlyInStock: showOnlyInStock === 'true'
        }
      }
    });
  } catch (error) {
    console.error('Error in getStockSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate stock summary',
      error: error.message
    });
  }
};

/**
 * Item Report by Party - Party-wise item movement
 * GET /api/reports/vyapar/item-by-party
 * Query params: filterType, customStart, customEnd, itemId
 */
export const getItemByParty = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, itemId, categoryId, searchParty } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build sales query - Business Sales
    const salesQuery = {
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    };
    if (itemId) salesQuery['items.itemId'] = itemId;

    // Build purchase query (Business stock transactions)
    const purchaseQuery = {
      date: { $gte: startDate, $lte: endDate },
      transactionType: 'Stock In',
      referenceType: 'Purchase'
    };
    if (itemId) purchaseQuery.itemId = itemId;

    // Fetch sales and purchases in parallel
    const [sales, purchases, allItems] = await Promise.all([
      BusinessSales.find(salesQuery).populate('items.itemId'),
      BusinessStockTransaction.find(purchaseQuery).populate('itemId').populate('supplierId'),
      BusinessItem.find({ status: 'Active' }).select('itemName category')
    ]);

    // Get unique categories from items
    const categories = [...new Set(allItems.map(item => item.category).filter(Boolean))];

    // Group by party (combining both customers and suppliers)
    const partyMap = new Map();

    // Process sales - grouped by customer/party
    sales.forEach(sale => {
      const partyKey = sale.partyId ? sale.partyId.toString() : 'cash-customer';
      const partyName = sale.partyName || 'Cash Sales';

      // Filter by category if provided
      let filteredItems = sale.items;
      if (categoryId) {
        filteredItems = sale.items.filter(item =>
          item.itemId && item.itemId.category === categoryId
        );
      }

      filteredItems.forEach(item => {
        if (!partyMap.has(partyKey)) {
          partyMap.set(partyKey, {
            partyId: partyKey,
            partyName,
            partyType: sale.partyId ? 'Customer' : 'Cash',
            saleQty: 0,
            saleAmount: 0,
            purchaseQty: 0,
            purchaseAmount: 0,
            saleBillCount: 0,
            purchaseBillCount: 0
          });
        }

        const record = partyMap.get(partyKey);
        record.saleQty += item.quantity || 0;
        record.saleAmount += item.totalAmount || 0;
        record.saleBillCount++;
      });
    });

    // Process purchases - grouped by supplier
    purchases.forEach(purchase => {
      // Filter by category if provided
      if (categoryId && purchase.itemId && purchase.itemId.category !== categoryId) {
        return;
      }

      const partyKey = purchase.supplierId ? purchase.supplierId._id.toString() : 'cash-supplier';
      const partyName = purchase.supplierId ? (purchase.supplierId.name || purchase.supplierName || 'Direct Purchase') : (purchase.supplierName || 'Direct Purchase');

      if (!partyMap.has(partyKey)) {
        partyMap.set(partyKey, {
          partyId: partyKey,
          partyName,
          partyType: 'Supplier',
          saleQty: 0,
          saleAmount: 0,
          purchaseQty: 0,
          purchaseAmount: 0,
          saleBillCount: 0,
          purchaseBillCount: 0
        });
      }

      const record = partyMap.get(partyKey);
      record.purchaseQty += purchase.quantity || 0;
      record.purchaseAmount += purchase.totalAmount || (purchase.quantity * purchase.rate) || 0;
      record.purchaseBillCount++;
    });

    // Convert to array and filter by search term
    let records = Array.from(partyMap.values());

    if (searchParty) {
      const searchLower = searchParty.toLowerCase();
      records = records.filter(r =>
        r.partyName.toLowerCase().includes(searchLower)
      );
    }

    // Calculate summary
    const summary = {
      totalParties: records.length,
      totalSaleQty: records.reduce((sum, r) => sum + r.saleQty, 0),
      totalSaleAmount: records.reduce((sum, r) => sum + r.saleAmount, 0),
      totalPurchaseQty: records.reduce((sum, r) => sum + r.purchaseQty, 0),
      totalPurchaseAmount: records.reduce((sum, r) => sum + r.purchaseAmount, 0),
      totalSaleBills: records.reduce((sum, r) => sum + r.saleBillCount, 0),
      totalPurchaseBills: records.reduce((sum, r) => sum + r.purchaseBillCount, 0)
    };

    // Sort by total transaction amount (sale + purchase)
    records.sort((a, b) => (b.saleAmount + b.purchaseAmount) - (a.saleAmount + a.purchaseAmount));

    res.json({
      success: true,
      data: {
        summary,
        records,
        categories,
        items: allItems.map(item => ({ _id: item._id, itemName: item.itemName, category: item.category })),
        filters: { filterType, startDate, endDate, itemId, categoryId, searchParty }
      }
    });
  } catch (error) {
    console.error('Error in getItemByParty:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate party report by item',
      error: error.message
    });
  }
};

/**
 * Item Wise Profit & Loss Report (Tally/Vyapar Style)
 * GET /api/reports/vyapar/item-profit
 * Query params: filterType, customStart, customEnd, itemsHavingSale
 */
export const getItemWiseProfit = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, itemsHavingSale } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);
    const startOfPeriod = new Date(startDate);
    startOfPeriod.setHours(0, 0, 0, 0);

    // Get all Business items (Vyapar reports use Business inventory)
    const allItems = await BusinessItem.find({ status: 'Active' });

    // Create item map with all items
    const itemMap = new Map();
    allItems.forEach(item => {
      itemMap.set(item._id.toString(), {
        itemId: item._id.toString(),
        itemName: item.itemName,
        category: item.category || 'General',
        unit: item.unit || item.measurement || 'Pcs',
        costPrice: item.purchasePrice || item.costPrice || 0,
        sellingPrice: item.salesRate || item.sellingPrice || 0,
        gstRate: item.gstPercent || item.gstRate || 0,
        // Initialize all values
        sale: 0,
        saleQty: 0,
        creditNote: 0,
        creditNoteQty: 0,
        purchase: 0,
        purchaseQty: 0,
        debitNote: 0,
        debitNoteQty: 0,
        openingStock: 0,
        openingStockValue: 0,
        closingStock: 0,
        closingStockValue: 0,
        taxReceivable: 0,
        taxPayable: 0,
        mfgCost: 0,
        consumptionCost: 0,
        netProfitLoss: 0
      });
    });

    // 1. Fetch Sales (Sale amount) - Business Sales
    const sales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    }).populate('items.itemId');

    sales.forEach(sale => {
      if (!sale.items) return;
      sale.items.forEach(saleItem => {
        const itemId = saleItem.itemId ? saleItem.itemId._id.toString() : null;
        if (!itemId || !itemMap.has(itemId)) return;

        const record = itemMap.get(itemId);
        const saleAmount = saleItem.totalAmount || saleItem.taxableAmount || (saleItem.quantity * saleItem.rate) || 0;
        const gstAmount = (saleItem.cgstAmount || 0) + (saleItem.sgstAmount || 0) + (saleItem.igstAmount || 0);

        record.sale += saleAmount;
        record.saleQty += saleItem.quantity || 0;
        record.taxReceivable += gstAmount; // GST collected on sales
      });
    });

    // 2. Fetch Credit Notes / Sale Returns (reduce from sale)
    const creditNoteVouchers = await Voucher.find({
      voucherType: { $in: ['Credit Note', 'Sales Return'] },
      voucherDate: { $gte: startDate, $lte: endDate }
    });

    creditNoteVouchers.forEach(voucher => {
      // Try to match with items if voucher has item details
      if (voucher.items && voucher.items.length > 0) {
        voucher.items.forEach(item => {
          const itemId = item.itemId?.toString();
          if (itemId && itemMap.has(itemId)) {
            const record = itemMap.get(itemId);
            record.creditNote += item.amount || 0;
            record.creditNoteQty += item.quantity || 0;
          }
        });
      } else if (voucher.ledgerEntries) {
        // Distribute credit note amount proportionally if no item details
        voucher.ledgerEntries.forEach(entry => {
          if (entry.debitAmount > 0) {
            // This is a credit note reducing sales
          }
        });
      }
    });

    // 3. Fetch Stock In (Purchases) - Business inventory
    // Only referenceType='Purchase' to exclude Opening Stock and Adjustments
    const stockInTransactions = await BusinessStockTransaction.find({
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: startDate, $lte: endDate }
    });

    stockInTransactions.forEach(txn => {
      const itemId = txn.itemId?.toString();
      if (!itemId || !itemMap.has(itemId)) return;

      const record = itemMap.get(itemId);
      // Use item-level (quantity * rate) instead of totalAmount to avoid multi-item invoice over-counting
      const purchaseAmount = (txn.quantity || 0) * (txn.rate || txn.costPrice || 0);

      record.purchase += purchaseAmount;
      record.purchaseQty += txn.quantity || 0;
      record.taxPayable += txn.gstAmount || 0; // GST paid on purchases
    });

    // 4. Fetch Debit Notes / Purchase Returns
    const debitNoteVouchers = await Voucher.find({
      voucherType: { $in: ['Debit Note', 'Purchase Return'] },
      voucherDate: { $gte: startDate, $lte: endDate }
    });

    debitNoteVouchers.forEach(voucher => {
      if (voucher.items && voucher.items.length > 0) {
        voucher.items.forEach(item => {
          const itemId = item.itemId?.toString();
          if (itemId && itemMap.has(itemId)) {
            const record = itemMap.get(itemId);
            record.debitNote += item.amount || 0;
            record.debitNoteQty += item.quantity || 0;
          }
        });
      }
    });

    // 5. Calculate Opening Stock (Stock before the period) - Business inventory
    const openingStockTransactions = await BusinessStockTransaction.find({
      date: { $lt: startOfPeriod }
    });

    // Group opening stock by item
    const openingStockMap = new Map();
    openingStockTransactions.forEach(txn => {
      const itemId = txn.itemId?.toString();
      if (!itemId) return;

      if (!openingStockMap.has(itemId)) {
        openingStockMap.set(itemId, { qty: 0, value: 0 });
      }

      const openingRecord = openingStockMap.get(itemId);
      const qty = txn.quantity || 0;
      const rate = txn.rate || txn.costPrice || 0;

      if (txn.transactionType === 'Stock In') {
        openingRecord.qty += qty;
        openingRecord.value += qty * rate;
      } else if (txn.transactionType === 'Stock Out') {
        openingRecord.qty -= qty;
        openingRecord.value -= qty * rate;
      }
    });

    // Apply opening stock to items
    openingStockMap.forEach((openingRecord, itemId) => {
      if (itemMap.has(itemId)) {
        const record = itemMap.get(itemId);
        record.openingStock = Math.max(0, openingRecord.qty);
        record.openingStockValue = Math.max(0, openingRecord.value);
      }
    });

    // Also check item's opening balance if set
    allItems.forEach(item => {
      const itemId = item._id.toString();
      if (itemMap.has(itemId)) {
        const record = itemMap.get(itemId);
        // If item has opening balance and no calculated opening stock
        if (item.openingBalance && record.openingStock === 0) {
          record.openingStock = item.openingBalance || 0;
          record.openingStockValue = (item.openingBalance || 0) * (item.purchasePrice || item.costPrice || 0);
        }
      }
    });

    // 6. Calculate Closing Stock (current balance from Item model or calculated)
    allItems.forEach(item => {
      const itemId = item._id.toString();
      if (itemMap.has(itemId)) {
        const record = itemMap.get(itemId);
        // Use current balance from item model
        record.closingStock = item.currentBalance || 0;
        record.closingStockValue = (item.currentBalance || 0) * (item.purchasePrice || item.costPrice || 0);
      }
    });

    // 7. Fetch Stock Out for Consumption/Manufacturing - Business inventory
    const stockOutTransactions = await BusinessStockTransaction.find({
      transactionType: 'Stock Out',
      date: { $gte: startDate, $lte: endDate }
    });

    stockOutTransactions.forEach(txn => {
      const itemId = txn.itemId?.toString();
      if (!itemId || !itemMap.has(itemId)) return;

      const record = itemMap.get(itemId);
      const costAmount = txn.totalAmount || (txn.quantity * (record.costPrice || 0));

      // Check reference type to determine if it's manufacturing or consumption
      if (txn.referenceType === 'Manufacturing' || txn.purpose === 'Manufacturing') {
        record.mfgCost += costAmount;
      } else if (txn.referenceType === 'Sale' || txn.referenceId) {
        // This is stock out for sales - already counted in COGS
      } else {
        record.consumptionCost += costAmount;
      }
    });

    // 8. Calculate Net Profit/Loss for each item
    // Formula: Sale - Credit Note - Purchase + Debit Note + Opening Stock - Closing Stock + Tax Receivable - Tax Payable - Mfg Cost - Consumption Cost
    // Simplified: Net Revenue - Net Cost
    itemMap.forEach((record, itemId) => {
      // Net Sales = Sale - Credit Notes
      const netSales = record.sale - record.creditNote;

      // Net Purchases = Purchase - Debit Notes
      const netPurchases = record.purchase - record.debitNote;

      // Stock Adjustment = Opening Stock - Closing Stock (positive means consumed)
      const stockAdjustment = record.openingStockValue - record.closingStockValue;

      // Cost of Goods Sold = Net Purchases + Stock Adjustment + Mfg Cost + Consumption Cost
      const cogs = netPurchases + stockAdjustment + record.mfgCost + record.consumptionCost;

      // Tax Adjustment = Tax Receivable - Tax Payable
      const taxAdjustment = record.taxReceivable - record.taxPayable;

      // Net Profit/Loss = Net Sales - COGS + Tax Adjustment
      record.netProfitLoss = netSales - cogs + taxAdjustment;
    });

    // Convert map to array and filter if needed
    let items = Array.from(itemMap.values());

    // Apply "Items Having Sale" filter
    if (itemsHavingSale === 'true' || itemsHavingSale === true) {
      items = items.filter(item => item.sale > 0);
    }

    // Sort by item name by default
    items.sort((a, b) => a.itemName.localeCompare(b.itemName));

    // Calculate summary totals
    const summary = {
      totalItems: items.length,
      totalSale: items.reduce((sum, i) => sum + i.sale, 0),
      totalCreditNote: items.reduce((sum, i) => sum + i.creditNote, 0),
      totalPurchase: items.reduce((sum, i) => sum + i.purchase, 0),
      totalDebitNote: items.reduce((sum, i) => sum + i.debitNote, 0),
      totalOpeningStock: items.reduce((sum, i) => sum + i.openingStockValue, 0),
      totalClosingStock: items.reduce((sum, i) => sum + i.closingStockValue, 0),
      totalTaxReceivable: items.reduce((sum, i) => sum + i.taxReceivable, 0),
      totalTaxPayable: items.reduce((sum, i) => sum + i.taxPayable, 0),
      totalMfgCost: items.reduce((sum, i) => sum + i.mfgCost, 0),
      totalConsumptionCost: items.reduce((sum, i) => sum + i.consumptionCost, 0),
      totalNetProfitLoss: items.reduce((sum, i) => sum + i.netProfitLoss, 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        items,
        filters: { filterType, startDate, endDate, itemsHavingSale }
      }
    });
  } catch (error) {
    console.error('Error in getItemWiseProfit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate item wise profit report',
      error: error.message
    });
  }
};

/**
 * Low Stock Summary - Items below reorder level
 * GET /api/reports/vyapar/low-stock
 * Query params: inventoryType
 */
export const getLowStockSummary = async (req, res) => {
  try {
    const { inventoryType } = req.query;
    // Fetch all active Business items for Vyapar reports
    const items = await BusinessItem.find({ status: 'Active' });

    const records = [];
    let totalStockValue = 0;

    items.forEach(item => {
      const currentBalance = item.currentBalance || 0;
      const reorderLevel = item.lowStockAlert || item.reorderLevel || 0;

      if (currentBalance <= reorderLevel) {
        const sellingPrice = item.salesRate || item.sellingPrice || 0;
        const stockValue = currentBalance * sellingPrice;
        const shortage = reorderLevel - currentBalance;

        records.push({
          itemId: item._id,
          itemName: item.itemName,
          category: item.category,
          currentBalance,
          currentStock: currentBalance,
          reorderLevel,
          minStock: reorderLevel,
          shortage,
          unit: item.unit || item.measurement,
          sellingPrice,
          stockValue,
          status: currentBalance === 0 ? 'Out of Stock' : (currentBalance <= reorderLevel * 0.25 ? 'Critical' : 'Low Stock')
        });

        totalStockValue += stockValue;
      }
    });

    const sortedRecords = records.sort((a, b) => a.shortage - b.shortage);
    res.json({
      success: true,
      data: {
        summary: {
          criticalItems: records.filter(r => r.status === 'Critical').length,
          lowStockItems: records.length,
          totalLowStockItems: records.length,
          outOfStock: records.filter(r => r.status === 'Out of Stock').length,
          outOfStockItems: records.filter(r => r.status === 'Out of Stock').length,
          totalValue: totalStockValue,
          totalStockValue
        },
        items: sortedRecords,
        records: sortedRecords,
        filters: {}
      }
    });
  } catch (error) {
    console.error('Error in getLowStockSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate low stock summary',
      error: error.message
    });
  }
};

/**
 * Bank Statement - Bank ledger transactions
 * GET /api/reports/vyapar/bank-statement
 * Query params: ledgerId, filterType, customStart, customEnd
 */
export const getBankStatement = async (req, res) => {
  try {
    const { ledgerId, filterType, customStart, customEnd } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Get ledger details if provided (for display name only)
    let ledger = null;
    if (ledgerId) {
      ledger = await Ledger.findById(ledgerId);
    }
    if (!ledger) {
      ledger = await Ledger.findOne({ ledgerType: 'Bank', status: 'Active' });
    }

    // Bank payment modes — non-cash transactions
    const bankModes = ['Bank', 'UPI', 'Card', 'Cheque'];

    // Deposits: Business Sales paid via bank
    const sales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale',
      paymentMode: { $in: bankModes },
      paidAmount: { $gt: 0 }
    }).sort({ invoiceDate: 1 });

    // Withdrawals: Business Purchases paid via bank
    const purchases = await BusinessStockTransaction.find({
      date: { $gte: startDate, $lte: endDate },
      referenceType: 'Purchase',
      paymentMode: { $in: bankModes },
      paidAmount: { $gt: 0 }
    }).sort({ date: 1 });

    const transactions = [];

    sales.forEach(sale => {
      transactions.push({
        date: sale.invoiceDate,
        voucherNumber: sale.invoiceNumber,
        voucherType: 'Sale',
        particulars: sale.partyName || 'Walk-in Customer',
        mode: sale.paymentMode,
        deposit: sale.paidAmount,
        withdrawal: 0,
        referenceType: 'Sale',
        referenceId: sale._id
      });
    });

    purchases.forEach(purchase => {
      transactions.push({
        date: purchase.date,
        voucherNumber: purchase.invoiceNumber || `PUR-${purchase._id.toString().slice(-6)}`,
        voucherType: 'Purchase',
        particulars: purchase.supplierName || 'Supplier',
        mode: purchase.paymentMode,
        deposit: 0,
        withdrawal: purchase.paidAmount,
        referenceType: 'Purchase',
        referenceId: purchase._id
      });
    });

    // Sort by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance and totals
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let runningBalance = 0;

    const transactionsWithBalance = transactions.map(txn => {
      totalDeposits += txn.deposit;
      totalWithdrawals += txn.withdrawal;
      runningBalance = runningBalance + txn.deposit - txn.withdrawal;
      return { ...txn, balance: runningBalance };
    });

    res.json({
      success: true,
      data: {
        ledger: ledger
          ? { _id: ledger._id, ledgerName: ledger.ledgerName, ledgerType: ledger.ledgerType }
          : { ledgerName: 'Bank Account' },
        summary: {
          openingBalance: 0,
          totalDeposits,
          totalWithdrawals,
          closingBalance: totalDeposits - totalWithdrawals,
          netChange: totalDeposits - totalWithdrawals
        },
        transactions: transactionsWithBalance,
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getBankStatement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate bank statement',
      error: error.message
    });
  }
};

/**
 * All Parties Report - List of all parties with outstanding balances
 * GET /api/reports/vyapar/all-parties
 * Query params: type, filterType, customStart, customEnd
 */
export const getAllPartiesReport = async (req, res) => {
  try {
    const { type, filterType, customStart, customEnd } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query for party ledgers
    const query = {
      status: 'Active',
      ledgerType: { $in: ['Sundry Debtors', 'Sundry Creditors', 'Customer', 'Supplier'] }
    };

    // Also get ledgers with linked entities
    const linkedEntityQuery = {
      status: 'Active',
      'linkedEntity.entityType': { $in: ['Customer', 'Supplier'] }
    };

    // Fetch ledgers from both queries
    const [partyLedgers, linkedLedgers] = await Promise.all([
      Ledger.find(query).populate('linkedEntity.entityId'),
      Ledger.find(linkedEntityQuery).populate('linkedEntity.entityId')
    ]);

    // Combine and deduplicate
    const ledgerMap = new Map();
    [...partyLedgers, ...linkedLedgers].forEach(ledger => {
      ledgerMap.set(ledger._id.toString(), ledger);
    });

    const allLedgers = Array.from(ledgerMap.values());

    const parties = [];
    let totalReceivable = 0;
    let totalPayable = 0;
    let customers = 0;
    let suppliers = 0;
    let partiesWithCredit = 0;
    let partiesWithDebit = 0;

    for (const ledger of allLedgers) {
      // Determine party type
      let partyType = 'Customer';
      if (ledger.linkedEntity?.entityType === 'Supplier' ||
          ledger.ledgerType === 'Sundry Creditors' ||
          ledger.ledgerType === 'Supplier') {
        partyType = 'Supplier';
      }

      // Apply type filter
      if (type === 'customers' && partyType !== 'Customer') continue;
      if (type === 'suppliers' && partyType !== 'Supplier') continue;

      const isDebitNature = isDebitNatureLedger(ledger.ledgerType);

      // Calculate opening balance
      const openingBalance = await calculateOpeningBalance(Ledger, Voucher, ledger._id, startDate);

      // Get transactions in the period
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });

      let totalDebits = 0;
      let totalCredits = 0;

      vouchers.forEach(voucher => {
        voucher.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            totalDebits += entry.debitAmount || 0;
            totalCredits += entry.creditAmount || 0;
          }
        });
      });

      // Calculate sales and purchases from voucher references
      let totalSales = 0;
      let totalPurchases = 0;
      let totalPayments = 0;
      let totalReceipts = 0;

      vouchers.forEach(voucher => {
        const entry = voucher.entries.find(e => e.ledgerId.toString() === ledger._id.toString());
        if (!entry) return;

        if (voucher.referenceType === 'Sales') {
          totalSales += entry.debitAmount || 0;
        } else if (voucher.referenceType === 'Purchase') {
          totalPurchases += entry.creditAmount || 0;
        } else if (voucher.voucherType === 'Receipt') {
          totalReceipts += entry.creditAmount || 0;
        } else if (voucher.voucherType === 'Payment') {
          totalPayments += entry.debitAmount || 0;
        }
      });

      // Calculate closing balance
      const closingBalance = calculateClosingBalance(openingBalance, totalDebits, totalCredits, isDebitNature);
      const balanceType = getBalanceType(closingBalance, isDebitNature);

      // Get contact info from linked entity
      const linkedEntity = ledger.linkedEntity?.entityId;
      const phone = linkedEntity?.phone || linkedEntity?.mobileNumber || '';
      const email = linkedEntity?.email || '';

      // Get credit limit from linked entity if available
      const creditLimit = linkedEntity?.creditLimit || 0;

      parties.push({
        ledgerId: ledger._id,
        name: ledger.ledgerName,
        type: partyType,
        phone,
        email,
        creditLimit,
        openingBalance: Math.abs(openingBalance),
        openingBalanceType: getBalanceType(openingBalance, isDebitNature),
        totalSales,
        totalPurchases,
        totalPayments,
        totalReceipts,
        closingBalance: closingBalance,
        closingBalanceType: balanceType
      });

      // Update summary counts
      if (partyType === 'Customer') customers++;
      else suppliers++;

      if (closingBalance > 0) {
        totalReceivable += closingBalance;
        partiesWithCredit++;
      } else if (closingBalance < 0) {
        totalPayable += Math.abs(closingBalance);
        partiesWithDebit++;
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalParties: parties.length,
          customers,
          suppliers,
          totalReceivable,
          totalPayable,
          netBalance: totalReceivable - totalPayable,
          partiesWithCredit,
          partiesWithDebit
        },
        parties: parties.sort((a, b) => Math.abs(b.closingBalance) - Math.abs(a.closingBalance)),
        filters: { type, filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getAllPartiesReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate all parties report',
      error: error.message
    });
  }
};

/**
 * GSTR-1 Report - Outward Supplies Return (Vyapar/Tally Style)
 * GET /api/reports/vyapar/gstr1
 * Query params: filterType, customStart, customEnd, returnPeriod (MMYYYY)
 */
export const getGSTR1Report = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, returnPeriod } = req.query;

    // Get date range
    let startDate, endDate;

    if (returnPeriod) {
      // Parse return period (MMYYYY format)
      const month = parseInt(returnPeriod.substring(0, 2)) - 1;
      const year = parseInt(returnPeriod.substring(2));
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    } else {
      const dateRange = getDateRange(filterType || 'thisMonth', customStart, customEnd);
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    }

    // Fetch all sales within the period - Business Sales
    const sales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    }).populate('partyId').sort({ invoiceDate: 1 });

    // GSTR-1 Sections
    const b2bInvoices = [];      // B2B - Business to Business (with GSTIN)
    const b2clInvoices = [];     // B2C Large - Invoice > 2.5 lakhs (without GSTIN)
    const b2csInvoices = [];     // B2C Small - Invoice <= 2.5 lakhs (without GSTIN)
    const exportInvoices = [];   // Exports
    const creditNotes = [];      // Credit Notes
    const debitNotes = [];       // Debit Notes
    const nilRatedSupplies = []; // Nil Rated, Exempt, Non-GST

    // Summary totals
    let totalB2B = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, invoiceValue: 0 };
    let totalB2CL = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, invoiceValue: 0 };
    let totalB2CS = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, invoiceValue: 0 };
    let totalExports = { count: 0, taxableValue: 0, igst: 0, invoiceValue: 0 };
    let totalCreditNotes = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, invoiceValue: 0 };
    let totalDebitNotes = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, invoiceValue: 0 };
    let totalNilRated = { count: 0, nilRated: 0, exempt: 0, nonGst: 0 };

    // B2C Large threshold (2.5 lakhs)
    const B2CL_THRESHOLD = 250000;

    // Company state code (assuming same state for CGST/SGST, different for IGST)
    const COMPANY_STATE_CODE = '33'; // Tamil Nadu - can be configured

    for (const sale of sales) {
      const customer = sale.partyId;
      const gstin = sale.partyGstin || customer?.gstNumber || '';
      const customerState = sale.partyState || customer?.state || '';
      const stateCode = customerState ? customerState.substring(0, 2) : '';

      // Calculate GST breakdown - use actual values from BusinessSales
      const taxableValue = sale.taxableAmount || 0;
      const totalGst = sale.totalGst || 0;
      const isInterState = stateCode && stateCode !== COMPANY_STATE_CODE;

      const cgst = sale.totalCgst || (isInterState ? 0 : totalGst / 2);
      const sgst = sale.totalSgst || (isInterState ? 0 : totalGst / 2);
      const igst = sale.totalIgst || (isInterState ? totalGst : 0);
      const invoiceValue = sale.grandTotal || 0;

      const invoiceData = {
        _id: sale._id,
        invoiceNumber: sale.invoiceNumber,
        invoiceDate: sale.invoiceDate,
        partyName: sale.partyName || customer?.name || 'Cash Sale',
        gstin: gstin,
        placeOfSupply: customerState || 'Tamil Nadu',
        stateCode: stateCode || COMPANY_STATE_CODE,
        taxableValue: taxableValue,
        cgst: cgst,
        sgst: sgst,
        igst: igst,
        cess: 0,
        invoiceValue: invoiceValue,
        gstRate: taxableValue > 0 ? ((totalGst / taxableValue) * 100).toFixed(2) : '0',
        items: sale.items?.map(item => ({
          itemName: item.itemName,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.totalAmount || item.taxableAmount || 0,
          gstAmount: (item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0)
        })) || []
      };

      // Categorize based on GSTIN and invoice value
      if (gstin && gstin.length === 15) {
        // B2B - Has valid GSTIN
        b2bInvoices.push(invoiceData);
        totalB2B.count++;
        totalB2B.taxableValue += taxableValue;
        totalB2B.cgst += cgst;
        totalB2B.sgst += sgst;
        totalB2B.igst += igst;
        totalB2B.invoiceValue += invoiceValue;
      } else if (invoiceValue > B2CL_THRESHOLD) {
        // B2C Large - No GSTIN but invoice > 2.5 lakhs
        b2clInvoices.push(invoiceData);
        totalB2CL.count++;
        totalB2CL.taxableValue += taxableValue;
        totalB2CL.cgst += cgst;
        totalB2CL.sgst += sgst;
        totalB2CL.igst += igst;
        totalB2CL.invoiceValue += invoiceValue;
      } else if (totalGst > 0) {
        // B2C Small - No GSTIN and invoice <= 2.5 lakhs (with GST)
        b2csInvoices.push(invoiceData);
        totalB2CS.count++;
        totalB2CS.taxableValue += taxableValue;
        totalB2CS.cgst += cgst;
        totalB2CS.sgst += sgst;
        totalB2CS.igst += igst;
        totalB2CS.invoiceValue += invoiceValue;
      } else {
        // Nil Rated / Exempt / Non-GST supplies
        nilRatedSupplies.push({
          ...invoiceData,
          supplyType: 'Nil Rated'
        });
        totalNilRated.count++;
        totalNilRated.nilRated += invoiceValue;
      }
    }

    // Group B2CS by rate and place of supply (as per GSTR-1 format)
    const b2csGrouped = {};
    b2csInvoices.forEach(inv => {
      const key = `${inv.stateCode}_${inv.gstRate}`;
      if (!b2csGrouped[key]) {
        b2csGrouped[key] = {
          placeOfSupply: inv.placeOfSupply,
          stateCode: inv.stateCode,
          gstRate: inv.gstRate,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0,
          invoiceCount: 0
        };
      }
      b2csGrouped[key].taxableValue += inv.taxableValue;
      b2csGrouped[key].cgst += inv.cgst;
      b2csGrouped[key].sgst += inv.sgst;
      b2csGrouped[key].igst += inv.igst;
      b2csGrouped[key].invoiceCount++;
    });

    // Calculate grand totals
    const grandTotal = {
      invoiceCount: totalB2B.count + totalB2CL.count + totalB2CS.count + totalNilRated.count,
      taxableValue: totalB2B.taxableValue + totalB2CL.taxableValue + totalB2CS.taxableValue,
      cgst: totalB2B.cgst + totalB2CL.cgst + totalB2CS.cgst,
      sgst: totalB2B.sgst + totalB2CL.sgst + totalB2CS.sgst,
      igst: totalB2B.igst + totalB2CL.igst + totalB2CS.igst,
      cess: 0,
      totalTax: (totalB2B.cgst + totalB2CL.cgst + totalB2CS.cgst) +
                (totalB2B.sgst + totalB2CL.sgst + totalB2CS.sgst) +
                (totalB2B.igst + totalB2CL.igst + totalB2CS.igst),
      invoiceValue: totalB2B.invoiceValue + totalB2CL.invoiceValue + totalB2CS.invoiceValue + totalNilRated.nilRated
    };

    res.json({
      success: true,
      data: {
        returnPeriod: {
          month: startDate.getMonth() + 1,
          year: startDate.getFullYear(),
          startDate,
          endDate,
          periodString: `${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`
        },
        sections: {
          b2b: {
            title: 'B2B Invoices - 4A, 4B, 4C, 6B, 6C',
            description: 'Taxable outward supplies made to registered persons',
            invoices: b2bInvoices,
            summary: totalB2B
          },
          b2cl: {
            title: 'B2C Large Invoices - 5A, 5B',
            description: 'Taxable outward inter-state supplies to unregistered persons (Invoice value > ₹2.5 Lakhs)',
            invoices: b2clInvoices,
            summary: totalB2CL
          },
          b2cs: {
            title: 'B2C Small Supplies - 7',
            description: 'Taxable outward supplies to unregistered persons (other than above)',
            invoices: b2csInvoices,
            grouped: Object.values(b2csGrouped),
            summary: totalB2CS
          },
          exports: {
            title: 'Exports - 6A',
            description: 'Export invoices',
            invoices: exportInvoices,
            summary: totalExports
          },
          creditNotes: {
            title: 'Credit/Debit Notes - 9B',
            description: 'Credit notes and debit notes',
            creditNotes: creditNotes,
            debitNotes: debitNotes,
            summaryCN: totalCreditNotes,
            summaryDN: totalDebitNotes
          },
          nilRated: {
            title: 'Nil Rated, Exempt & Non-GST - 8A, 8B, 8C, 8D',
            description: 'Nil rated, exempted and non-GST outward supplies',
            supplies: nilRatedSupplies,
            summary: totalNilRated
          }
        },
        grandTotal,
        filters: {
          filterType,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error in getGSTR1Report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate GSTR-1 report',
      error: error.message
    });
  }
};

/**
 * GSTR-2 Report - Inward Supplies (Purchases) for GST Return
 * GET /api/reports/vyapar/gstr2
 * Query params: returnPeriod (MMYYYY format)
 */
export const getGSTR2Report = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, returnPeriod } = req.query;

    // Get date range
    let startDate, endDate;

    if (returnPeriod) {
      // Parse return period (MMYYYY format)
      const month = parseInt(returnPeriod.substring(0, 2)) - 1;
      const year = parseInt(returnPeriod.substring(2));
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    } else {
      const dateRange = getDateRange(filterType || 'thisMonth', customStart, customEnd);
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    }

    // Fetch all purchase transactions within the period (Business inventory)
    const purchases = await BusinessStockTransaction.find({
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: startDate, $lte: endDate }
    }).populate('supplierId').populate('itemId').sort({ date: 1 });

    // Also fetch purchase vouchers for additional details
    const purchaseVouchers = await Voucher.find({
      referenceType: 'Purchase',
      voucherDate: { $gte: startDate, $lte: endDate }
    }).sort({ voucherDate: 1 });

    // GSTR-2 Sections
    const b2bInvoices = [];      // B2B - Purchases from registered suppliers (with GSTIN)
    const importGoods = [];       // Import of Goods
    const importServices = [];    // Import of Services
    const creditNotes = [];       // Credit Notes received
    const debitNotes = [];        // Debit Notes received
    const nilRatedSupplies = [];  // Nil Rated, Exempt purchases

    // Summary totals
    let totalB2B = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, invoiceValue: 0, itcCgst: 0, itcSgst: 0, itcIgst: 0 };
    let totalImportGoods = { count: 0, taxableValue: 0, igst: 0, invoiceValue: 0, itcIgst: 0 };
    let totalImportServices = { count: 0, taxableValue: 0, igst: 0, invoiceValue: 0, itcIgst: 0 };
    let totalCreditNotes = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, invoiceValue: 0 };
    let totalDebitNotes = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, invoiceValue: 0 };
    let totalNilRated = { count: 0, nilRated: 0, exempt: 0, nonGst: 0 };

    // ITC Summary
    let itcSummary = {
      eligible: { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 },
      availed: { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 },
      reversed: { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 },
      net: { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 }
    };

    // Company state code (assuming same state for CGST/SGST, different for IGST)
    const COMPANY_STATE_CODE = '33'; // Tamil Nadu - can be configured

    // Group purchases by invoice number for combining items
    const invoiceMap = new Map();

    for (const purchase of purchases) {
      const supplier = purchase.supplierId;
      const item = purchase.itemId;
      const gstin = supplier?.gstNumber || '';
      const supplierState = supplier?.state || '';
      const stateCode = supplierState ? supplierState.substring(0, 2) : '';

      const invoiceKey = purchase.invoiceNumber || `PUR-${purchase._id}`;

      if (!invoiceMap.has(invoiceKey)) {
        invoiceMap.set(invoiceKey, {
          _id: purchase._id,
          invoiceNumber: purchase.invoiceNumber || invoiceKey,
          invoiceDate: purchase.invoiceDate || purchase.date,
          purchaseDate: purchase.purchaseDate || purchase.date,
          supplierName: purchase.supplierName || supplier?.name || 'Unknown Supplier',
          supplierId: supplier?.supplierId || '',
          gstin: gstin,
          state: supplierState || 'Tamil Nadu',
          stateCode: stateCode || COMPANY_STATE_CODE,
          items: [],
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0,
          invoiceValue: 0,
          itcEligible: true,
          itcReason: ''
        });
      }

      const invoice = invoiceMap.get(invoiceKey);

      // Calculate item values
      const quantity = purchase.quantity + (purchase.freeQty || 0);
      const rate = purchase.rate || 0;
      const itemAmount = quantity * rate;
      const subsidyAmount = purchase.subsidyAmount || 0;
      const netAmount = itemAmount - subsidyAmount;

      // Assume 18% GST as default (can be item-specific)
      const gstRate = item?.gstPercent || item?.gstRate || 18;
      const gstAmount = (netAmount * gstRate) / 100;
      const isInterState = stateCode && stateCode !== COMPANY_STATE_CODE;

      const cgst = isInterState ? 0 : gstAmount / 2;
      const sgst = isInterState ? 0 : gstAmount / 2;
      const igst = isInterState ? gstAmount : 0;

      invoice.items.push({
        itemName: item?.itemName || 'Unknown Item',
        itemCode: item?.itemCode || '',
        hsnCode: item?.hsnCode || '',
        quantity: quantity,
        unit: item?.unit || item?.measurement || 'Pcs',
        rate: rate,
        amount: itemAmount,
        gstRate: gstRate,
        cgst: cgst,
        sgst: sgst,
        igst: igst
      });

      invoice.taxableValue += netAmount;
      invoice.cgst += cgst;
      invoice.sgst += sgst;
      invoice.igst += igst;
      invoice.invoiceValue += netAmount + cgst + sgst + igst;
    }

    // Categorize invoices
    for (const [key, invoice] of invoiceMap) {
      const gstRate = invoice.taxableValue > 0 ?
        (((invoice.cgst + invoice.sgst + invoice.igst) / invoice.taxableValue) * 100).toFixed(2) : '0';
      invoice.gstRate = gstRate;

      // Calculate ITC (100% eligible for business purchases by default)
      const itcCgst = invoice.cgst;
      const itcSgst = invoice.sgst;
      const itcIgst = invoice.igst;

      if (invoice.gstin && invoice.gstin.length === 15) {
        // B2B - Has valid GSTIN
        b2bInvoices.push({
          ...invoice,
          itcCgst,
          itcSgst,
          itcIgst,
          itcTotal: itcCgst + itcSgst + itcIgst
        });
        totalB2B.count++;
        totalB2B.taxableValue += invoice.taxableValue;
        totalB2B.cgst += invoice.cgst;
        totalB2B.sgst += invoice.sgst;
        totalB2B.igst += invoice.igst;
        totalB2B.invoiceValue += invoice.invoiceValue;
        totalB2B.itcCgst += itcCgst;
        totalB2B.itcSgst += itcSgst;
        totalB2B.itcIgst += itcIgst;

        // Add to ITC summary
        itcSummary.eligible.cgst += itcCgst;
        itcSummary.eligible.sgst += itcSgst;
        itcSummary.eligible.igst += itcIgst;
      } else if (invoice.cgst + invoice.sgst + invoice.igst > 0) {
        // Unregistered supplier with GST - ITC not eligible
        b2bInvoices.push({
          ...invoice,
          itcCgst: 0,
          itcSgst: 0,
          itcIgst: 0,
          itcTotal: 0,
          itcEligible: false,
          itcReason: 'Unregistered Supplier'
        });
        totalB2B.count++;
        totalB2B.taxableValue += invoice.taxableValue;
        totalB2B.cgst += invoice.cgst;
        totalB2B.sgst += invoice.sgst;
        totalB2B.igst += invoice.igst;
        totalB2B.invoiceValue += invoice.invoiceValue;
      } else {
        // Nil Rated / Exempt
        nilRatedSupplies.push({
          ...invoice,
          supplyType: 'Nil Rated'
        });
        totalNilRated.count++;
        totalNilRated.nilRated += invoice.invoiceValue;
      }
    }

    // Calculate ITC totals
    itcSummary.eligible.total = itcSummary.eligible.cgst + itcSummary.eligible.sgst + itcSummary.eligible.igst;

    // Assume all eligible ITC is availed (can be customized)
    itcSummary.availed = { ...itcSummary.eligible };

    // No reversal by default
    itcSummary.reversed = { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 };

    // Net ITC
    itcSummary.net = {
      cgst: itcSummary.availed.cgst - itcSummary.reversed.cgst,
      sgst: itcSummary.availed.sgst - itcSummary.reversed.sgst,
      igst: itcSummary.availed.igst - itcSummary.reversed.igst,
      cess: itcSummary.availed.cess - itcSummary.reversed.cess,
      total: itcSummary.availed.total - itcSummary.reversed.total
    };

    // Calculate grand totals
    const grandTotal = {
      invoiceCount: totalB2B.count + totalImportGoods.count + totalImportServices.count + totalNilRated.count,
      taxableValue: totalB2B.taxableValue + totalImportGoods.taxableValue + totalImportServices.taxableValue,
      cgst: totalB2B.cgst,
      sgst: totalB2B.sgst,
      igst: totalB2B.igst + totalImportGoods.igst + totalImportServices.igst,
      cess: 0,
      totalTax: totalB2B.cgst + totalB2B.sgst + totalB2B.igst + totalImportGoods.igst + totalImportServices.igst,
      invoiceValue: totalB2B.invoiceValue + totalImportGoods.invoiceValue + totalImportServices.invoiceValue + totalNilRated.nilRated,
      totalITC: itcSummary.net.total
    };

    res.json({
      success: true,
      data: {
        returnPeriod: {
          month: startDate.getMonth() + 1,
          year: startDate.getFullYear(),
          startDate,
          endDate,
          periodString: `${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`
        },
        sections: {
          b2b: {
            title: 'B2B Invoices - 3, 4A',
            description: 'Inward supplies from registered suppliers',
            invoices: b2bInvoices,
            summary: totalB2B
          },
          importGoods: {
            title: 'Import of Goods - 4B',
            description: 'Import of goods from overseas',
            invoices: importGoods,
            summary: totalImportGoods
          },
          importServices: {
            title: 'Import of Services - 4C',
            description: 'Import of services from overseas',
            invoices: importServices,
            summary: totalImportServices
          },
          creditNotes: {
            title: 'Credit Notes - 6C',
            description: 'Credit notes received from suppliers',
            invoices: creditNotes,
            summary: totalCreditNotes
          },
          debitNotes: {
            title: 'Debit Notes - 6C',
            description: 'Debit notes received from suppliers',
            invoices: debitNotes,
            summary: totalDebitNotes
          },
          nilRated: {
            title: 'Nil Rated, Exempt & Non-GST - 5',
            description: 'Nil rated, exempted and non-GST inward supplies',
            supplies: nilRatedSupplies,
            summary: totalNilRated
          }
        },
        itcSummary,
        grandTotal,
        filters: {
          filterType,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error in getGSTR2Report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate GSTR-2 report',
      error: error.message
    });
  }
};

/**
 * Stock Statement - Period-wise stock movement report
 * GET /api/reports/vyapar/stock-statement
 * Query params: filterType, customStart, customEnd, category
 */
export const getStockStatement = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, category } = req.query;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Build query for active Business items
    const itemQuery = { status: 'Active' };
    if (category && category !== 'all') {
      itemQuery.category = category;
    }

    // Fetch all Business items
    const items = await BusinessItem.find(itemQuery).sort({ itemName: 1 });

    // Fetch transactions BEFORE the date range (for opening stock)
    const priorTransactions = await BusinessStockTransaction.find({
      date: { $lt: startDate }
    });

    // Fetch transactions WITHIN the date range
    const periodTransactions = await BusinessStockTransaction.find({
      date: { $gte: startDate, $lte: endDate }
    });

    // Build maps for quick lookup
    const priorByItem = new Map();
    priorTransactions.forEach(txn => {
      const key = txn.itemId?.toString();
      if (!key) return;
      if (!priorByItem.has(key)) priorByItem.set(key, []);
      priorByItem.get(key).push(txn);
    });

    const periodByItem = new Map();
    periodTransactions.forEach(txn => {
      const key = txn.itemId?.toString();
      if (!key) return;
      if (!periodByItem.has(key)) periodByItem.set(key, []);
      periodByItem.get(key).push(txn);
    });

    const records = [];
    let totalOpening = 0, totalPurchase = 0, totalPurchaseReturn = 0;
    let totalSales = 0, totalSalesReturn = 0, totalClosing = 0, totalStockValue = 0;

    items.forEach(item => {
      const itemId = item._id.toString();

      // Calculate opening stock from transactions only (do NOT add item.openingBalance separately
      // because the opening balance already creates a Stock In transaction with referenceType='Opening')
      let openingStock = 0;
      const priorTxns = priorByItem.get(itemId) || [];
      priorTxns.forEach(txn => {
        if (txn.transactionType === 'Stock In') {
          openingStock += txn.quantity || 0;
        } else if (txn.transactionType === 'Stock Out') {
          openingStock -= txn.quantity || 0;
        }
      });

      // Calculate period movements
      let purchaseQty = 0, purchaseReturn = 0, salesQty = 0, salesReturn = 0;
      const periodTxns = periodByItem.get(itemId) || [];
      periodTxns.forEach(txn => {
        const qty = txn.quantity || 0;
        if (txn.transactionType === 'Stock In' && txn.referenceType === 'Purchase') {
          purchaseQty += qty;
        } else if (txn.transactionType === 'Stock Out' && txn.referenceType === 'Return') {
          purchaseReturn += qty;
        } else if (txn.transactionType === 'Stock Out' && txn.referenceType === 'Sale') {
          salesQty += qty;
        } else if (txn.transactionType === 'Stock In' && (txn.referenceType === 'Return' || txn.referenceType === 'Sales Return')) {
          salesReturn += qty;
        }
      });

      // Closing stock = Opening + Purchase + Sales Return - Sales - Purchase Return
      const closingStock = openingStock + purchaseQty + salesReturn - salesQty - purchaseReturn;

      // Stock value = closing stock × purchase price
      const purchasePrice = item.purchasePrice || item.wholesalePrice || 0;
      const stockValue = closingStock * purchasePrice;

      records.push({
        itemId: item._id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category || 'Uncategorized',
        unit: item.unit || item.measurement,
        purchasePrice,
        openingStock,
        purchaseQty,
        purchaseReturn,
        salesQty,
        salesReturn,
        closingStock,
        stockValue
      });

      totalOpening += openingStock;
      totalPurchase += purchaseQty;
      totalPurchaseReturn += purchaseReturn;
      totalSales += salesQty;
      totalSalesReturn += salesReturn;
      totalClosing += closingStock;
      totalStockValue += stockValue;
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalItems: records.length,
          totalOpening,
          totalPurchase,
          totalPurchaseReturn,
          totalSales,
          totalSalesReturn,
          totalClosing,
          totalStockValue
        },
        items: records,
        filters: {
          filterType: filterType || 'thisMonth',
          startDate,
          endDate,
          category: category || 'all'
        }
      }
    });
  } catch (error) {
    console.error('Error in getStockStatement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate stock statement',
      error: error.message
    });
  }
};

/**
 * Vyapar Day Book - All voucher entries chronologically grouped by date
 * GET /api/reports/vyapar/day-book
 * Query params: filterType, customStart, customEnd, voucherType, search
 */
export const getVyaparDayBook = async (req, res) => {
  try {
    const { filterType, customStart, customEnd, voucherType, search } = req.query;

    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Opening balance: net (Dr - Cr) from all vouchers before startDate
    const openingVouchers = await Voucher.find({ voucherDate: { $lt: startDate } }).select('entries');
    let openingBalance = 0;
    for (const v of openingVouchers) {
      for (const e of v.entries) {
        openingBalance += (e.debitAmount || 0) - (e.creditAmount || 0);
      }
    }

    // Build query
    const query = {
      voucherDate: { $gte: startDate, $lte: endDate }
    };
    if (voucherType && voucherType !== 'All') {
      query.voucherType = voucherType;
    }

    // Fetch vouchers
    const vouchers = await Voucher.find(query)
      .populate('entries.ledgerId')
      .sort({ voucherDate: 1, voucherNumber: 1 });

    // Also fetch sales not linked to vouchers
    const salesQuery = {
      invoiceDate: { $gte: startDate, $lte: endDate }
    };
    const salesData = await BusinessSales.find(salesQuery)
      .populate('partyId')
      .sort({ invoiceDate: 1 });

    // Track voucher-linked sales
    const linkedSaleIds = new Set();
    vouchers.forEach(v => {
      if (v.referenceType === 'Sales' && v.referenceId) {
        linkedSaleIds.add(v.referenceId.toString());
      }
    });

    const transactions = [];
    let totalDebit = 0;
    let totalCredit = 0;

    // Process vouchers
    for (const voucher of vouchers) {
      for (const entry of voucher.entries) {
        const ledgerName = entry.ledgerId?.ledgerName || 'Unknown';
        const debit = entry.debitAmount || 0;
        const credit = entry.creditAmount || 0;

        // Find contra entry for particulars
        const contraEntry = voucher.entries.find(e =>
          e.ledgerId && e.ledgerId._id.toString() !== (entry.ledgerId?._id?.toString() || '')
        );
        const contraName = contraEntry?.ledgerId?.ledgerName || '';

        transactions.push({
          _id: voucher._id,
          date: voucher.voucherDate,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType,
          ledgerName,
          contraName,
          particulars: entry.narration || voucher.narration || ledgerName,
          debitAmount: debit,
          creditAmount: credit,
          referenceType: voucher.referenceType,
          referenceId: voucher.referenceId
        });

        totalDebit += debit;
        totalCredit += credit;
      }
    }

    // Add unlinked sales as Sale entries
    for (const sale of salesData) {
      if (!linkedSaleIds.has(sale._id.toString())) {
        const amount = sale.grandTotal || 0;
        transactions.push({
          _id: sale._id,
          date: sale.invoiceDate,
          voucherNumber: sale.invoiceNumber || '',
          voucherType: 'Sale',
          ledgerName: sale.partyName || sale.partyId?.name || 'Cash Sale',
          contraName: 'Sales',
          particulars: `Sale Invoice ${sale.invoiceNumber || ''}`,
          debitAmount: amount,
          creditAmount: 0,
          referenceType: 'Sales',
          referenceId: sale._id
        });
        totalDebit += amount;

        transactions.push({
          _id: sale._id + '_cr',
          date: sale.invoiceDate,
          voucherNumber: sale.invoiceNumber || '',
          voucherType: 'Sale',
          ledgerName: 'Sales',
          contraName: sale.partyName || sale.partyId?.name || 'Cash Sale',
          particulars: `Sale Invoice ${sale.invoiceNumber || ''}`,
          debitAmount: 0,
          creditAmount: amount,
          referenceType: 'Sales',
          referenceId: sale._id
        });
        totalCredit += amount;
      }
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Apply search filter
    let filteredTransactions = transactions;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredTransactions = transactions.filter(t =>
        t.ledgerName?.toLowerCase().includes(searchLower) ||
        t.voucherNumber?.toLowerCase().includes(searchLower) ||
        t.particulars?.toLowerCase().includes(searchLower) ||
        t.voucherType?.toLowerCase().includes(searchLower) ||
        t.contraName?.toLowerCase().includes(searchLower)
      );
    }

    // Group by date for day-wise summary
    const dayWiseSummary = {};
    filteredTransactions.forEach(t => {
      const dateKey = new Date(t.date).toISOString().split('T')[0];
      if (!dayWiseSummary[dateKey]) {
        dayWiseSummary[dateKey] = { date: dateKey, totalDebit: 0, totalCredit: 0, count: 0 };
      }
      dayWiseSummary[dateKey].totalDebit += t.debitAmount;
      dayWiseSummary[dateKey].totalCredit += t.creditAmount;
      dayWiseSummary[dateKey].count++;
    });

    res.json({
      success: true,
      data: {
        openingBalance,
        closingBalance: openingBalance + totalDebit - totalCredit,
        transactions: filteredTransactions,
        dayWiseSummary: Object.values(dayWiseSummary),
        summary: {
          totalDebit,
          totalCredit,
          transactionCount: filteredTransactions.length,
          voucherCount: vouchers.length
        },
        filters: { filterType, startDate, endDate, voucherType }
      }
    });
  } catch (error) {
    console.error('Error in getVyaparDayBook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate day book',
      error: error.message
    });
  }
};

/**
 * Vyapar Cash Book - Traditional double-column cash book with receipts and payments
 * GET /api/reports/vyapar/cash-book
 * Query params: filterType, customStart, customEnd, includeBank
 */
export const getVyaparCashBook = async (req, res) => {
  try {
    const { filterType, customStart, customEnd } = req.query;

    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Receipt side: BusinessSales paid by Cash
    const cashSales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale',
      paymentMode: 'Cash',
      paidAmount: { $gt: 0 }
    }).sort({ invoiceDate: 1 });

    // Payment side: BusinessStockTransaction purchases paid by Cash
    const cashPurchases = await BusinessStockTransaction.find({
      date: { $gte: startDate, $lte: endDate },
      referenceType: 'Purchase',
      paymentMode: 'Cash',
      paidAmount: { $gt: 0 }
    }).sort({ date: 1 });

    const receiptSide = cashSales.map(sale => ({
      date: sale.invoiceDate,
      voucherNumber: sale.invoiceNumber,
      voucherType: 'Sale',
      particulars: sale.partyName || 'Walk-in Customer',
      amount: sale.paidAmount,
      account: 'Cash',
      referenceType: 'Sale',
      referenceId: sale._id
    }));

    const paymentSide = cashPurchases.map(p => ({
      date: p.date,
      voucherNumber: p.invoiceNumber || `PUR-${p._id.toString().slice(-6)}`,
      voucherType: 'Purchase',
      particulars: p.supplierName || 'Supplier',
      amount: p.paidAmount,
      account: 'Cash',
      referenceType: 'Purchase',
      referenceId: p._id
    }));

    const totalReceipts = receiptSide.reduce((s, r) => s + r.amount, 0);
    const totalPayments = paymentSide.reduce((s, p) => s + p.amount, 0);
    const closingBalance = totalReceipts - totalPayments;

    // Build combined entries with running balance
    const allEntries = [
      ...receiptSide.map(r => ({ ...r, debitAmount: r.amount, creditAmount: 0 })),
      ...paymentSide.map(p => ({ ...p, debitAmount: 0, creditAmount: p.amount }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let running = 0;
    allEntries.forEach(e => {
      running += (e.debitAmount || 0) - (e.creditAmount || 0);
      e.runningBalance = running;
    });

    res.json({
      success: true,
      data: {
        receiptSide,
        paymentSide,
        entries: allEntries,
        summary: {
          openingBalance: 0,
          closingBalance,
          totalReceipts,
          totalPayments,
          netChange: closingBalance,
          receiptCount: receiptSide.length,
          paymentCount: paymentSide.length
        },
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getVyaparCashBook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate cash book',
      error: error.message
    });
  }
};

/**
 * Vyapar Trading Account - Standard Trading Account (Dr/Cr format)
 * GET /api/reports/vyapar/trading-account
 * Query params: filterType, customStart, customEnd
 */
export const getVyaparTradingAccount = async (req, res) => {
  try {
    const { filterType, customStart, customEnd } = req.query;

    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // ===== OPENING STOCK =====
    const items = await BusinessItem.find({ status: 'Active' });
    let openingStock = 0;
    for (const item of items) {
      const stockInBefore = await BusinessStockTransaction.find({
        itemId: item._id,
        transactionType: 'Stock In',
        date: { $lt: startDate }
      });
      const stockOutBefore = await BusinessStockTransaction.find({
        itemId: item._id,
        transactionType: 'Stock Out',
        date: { $lt: startDate }
      });
      const qtyIn = stockInBefore.reduce((sum, tx) => sum + (tx.quantity || 0), 0);
      const qtyOut = stockOutBefore.reduce((sum, tx) => sum + (tx.quantity || 0), 0);
      const openingQty = qtyIn - qtyOut;
      openingStock += openingQty * (item.purchasePrice || item.costPrice || 0);
    }

    // ===== CLOSING STOCK =====
    let closingStock = 0;
    for (const item of items) {
      const stockInBefore = await BusinessStockTransaction.find({
        itemId: item._id,
        transactionType: 'Stock In',
        date: { $lte: endDate }
      });
      const stockOutBefore = await BusinessStockTransaction.find({
        itemId: item._id,
        transactionType: 'Stock Out',
        date: { $lte: endDate }
      });
      const qtyIn = stockInBefore.reduce((sum, tx) => sum + (tx.quantity || 0), 0);
      const qtyOut = stockOutBefore.reduce((sum, tx) => sum + (tx.quantity || 0), 0);
      const closingQty = qtyIn - qtyOut;
      closingStock += closingQty * (item.purchasePrice || item.costPrice || 0);
    }

    // ===== PURCHASES =====
    const purchaseTransactions = await BusinessStockTransaction.find({
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: startDate, $lte: endDate }
    });
    let totalPurchases = 0;
    purchaseTransactions.forEach(tx => {
      totalPurchases += tx.totalAmount || ((tx.quantity || 0) * (tx.rate || 0));
    });

    // Purchase Returns - from PurchaseReturn model
    const purchaseReturnDocs = await PurchaseReturn.find({
      returnDate: { $gte: startDate, $lte: endDate },
      status: 'Active'
    });
    const purchaseReturnAmount = purchaseReturnDocs.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

    // ===== SALES =====
    const sales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale'
    });
    const totalSales = sales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    // Sales Returns - from SalesReturn model
    const salesReturnDocs = await SalesReturn.find({
      returnDate: { $gte: startDate, $lte: endDate },
      status: 'Active'
    });
    const totalSalesReturn = salesReturnDocs.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

    // ===== DIRECT EXPENSES =====
    const directExpenseLedgers = await Ledger.find({
      status: 'Active',
      $or: [
        { ledgerType: { $regex: /Direct.*Expense|Trade.*Expense|Manufacturing.*Expense/i } },
        { ledgerName: { $regex: /freight|carriage|wages|power|fuel|factory/i } }
      ]
    });
    let totalDirectExpenses = 0;
    const directExpenseItems = [];
    for (const ledger of directExpenseLedgers) {
      const vouchers = await Voucher.find({
        voucherDate: { $gte: startDate, $lte: endDate },
        'entries.ledgerId': ledger._id
      });
      let amount = 0;
      vouchers.forEach(v => {
        v.entries.forEach(entry => {
          if (entry.ledgerId.toString() === ledger._id.toString()) {
            amount += (entry.debitAmount || 0) - (entry.creditAmount || 0);
          }
        });
      });
      if (amount !== 0) {
        directExpenseItems.push({ name: ledger.ledgerName, amount: Math.abs(amount) });
        totalDirectExpenses += Math.max(0, amount);
      }
    }

    // ===== GROSS PROFIT / LOSS =====
    const debitSideTotal = openingStock + totalPurchases - purchaseReturnAmount + totalDirectExpenses;
    const creditSideTotal = totalSales - totalSalesReturn + closingStock;
    const grossProfit = creditSideTotal - debitSideTotal;

    res.json({
      success: true,
      data: {
        debitSide: {
          openingStock,
          purchases: totalPurchases,
          purchaseReturns: purchaseReturnAmount,
          netPurchases: totalPurchases - purchaseReturnAmount,
          directExpenses: totalDirectExpenses,
          directExpenseItems,
          grossProfit: grossProfit > 0 ? grossProfit : 0, // Gross Profit shown on debit side when profit
          total: debitSideTotal + (grossProfit > 0 ? grossProfit : 0) // Balance with credit side
        },
        creditSide: {
          sales: totalSales,
          salesReturns: totalSalesReturn,
          netSales: totalSales - totalSalesReturn,
          closingStock,
          grossLoss: grossProfit < 0 ? Math.abs(grossProfit) : 0, // Gross Loss shown on credit side when loss
          total: creditSideTotal + (grossProfit < 0 ? Math.abs(grossProfit) : 0)
        },
        summary: {
          grossProfit: grossProfit > 0 ? grossProfit : 0,
          grossLoss: grossProfit < 0 ? Math.abs(grossProfit) : 0,
          grossAmount: grossProfit,
          grossMarginPercent: totalSales > 0 ? ((grossProfit / totalSales) * 100) : 0,
          isProfit: grossProfit >= 0
        },
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getVyaparTradingAccount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate trading account',
      error: error.message
    });
  }
};

export default {
  getSaleReport,
  getPurchaseReport,
  getPartyStatement,
  getCashflowReport,
  getCashInHandReport,
  getAllTransactions,
  getVyaparProfitLoss,
  getVyaparBalanceSheet,
  getBillWiseProfit,
  getPartyWiseProfit,
  getTrialBalance,
  getStockSummary,
  getItemByParty,
  getItemWiseProfit,
  getLowStockSummary,
  getBankStatement,
  getAllPartiesReport,
  getGSTR1Report,
  getGSTR2Report,
  getStockStatement,
  getVyaparDayBook,
  getVyaparCashBook,
  getVyaparTradingAccount
};
