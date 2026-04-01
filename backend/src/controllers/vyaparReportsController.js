import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import BusinessLedger from '../models/BusinessLedger.js';
import BusinessVoucher from '../models/BusinessVoucher.js';
import BusinessSales from '../models/BusinessSales.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import StockTransaction from '../models/StockTransaction.js';
import BusinessItem from '../models/BusinessItem.js';
import BusinessCustomer from '../models/BusinessCustomer.js';
import BusinessSupplier from '../models/BusinessSupplier.js';
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
      companyId: req.companyId,
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
      date: { $gte: startDate, $lte: endDate },
      companyId: req.companyId
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
      const supplier = await BusinessSupplier.findById(partyId).select('name supplierId phone');
      partyName = supplier?.name || '';

      // Fetch purchase stock transactions
      const supplierQuery = { supplierId: partyId, referenceType: 'Purchase', date: { $gte: startDate, $lte: endDate }, companyId: req.companyId };
      if (!partyName) {
        const anyPurchase = await BusinessStockTransaction.findOne({ supplierId: partyId, companyId: req.companyId });
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
        date: { $gte: startDate, $lte: endDate },
        companyId: req.companyId
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
        invoiceDate: { $gte: startDate, $lte: endDate },
        companyId: req.companyId
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
        date: { $gte: startDate, $lte: endDate },
        companyId: req.companyId
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
      companyId: req.companyId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale',
      ...modeFilter,
      paidAmount: { $gt: 0 }
    }).sort({ invoiceDate: 1 });

    // Fetch Business Purchases in period (Outflows)
    const rawPurchases = await BusinessStockTransaction.find({
      companyId: req.companyId,
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

    const companyId = req.companyId;

    // ─── 1. Cash Sales (Cash In) ──────────────────────────────────────
    const [salesInPeriod, salesBefore] = await Promise.all([
      BusinessSales.find({
        companyId,
        invoiceDate: { $gte: start, $lte: end },
        paymentMode: 'Cash',
        paidAmount: { $gt: 0 },
        invoiceType: 'Sale'
      }).sort({ invoiceDate: 1 }),
      BusinessSales.find({
        companyId,
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
        companyId,
        date: { $gte: start, $lte: end },
        transactionType: 'Stock In',
        paymentMode: 'Cash',
        paidAmount: { $gt: 0 }
      }).sort({ date: 1, invoiceNumber: 1 }),
      BusinessStockTransaction.find({
        companyId,
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
    const cashBizLedger = await BusinessLedger.findOne({ group: 'Cash-in-Hand', status: 'Active', companyId: req.companyId });
    let vouchersInPeriod = [];
    let vouchersBefore = [];

    if (cashBizLedger) {
      [vouchersInPeriod, vouchersBefore] = await Promise.all([
        BusinessVoucher.find({
          companyId,
          date: { $gte: start, $lte: end },
          'entries.ledgerId': cashBizLedger._id,
          status: 'Posted'
        }).populate('entries.ledgerId').sort({ date: 1 }),
        BusinessVoucher.find({
          companyId,
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
    const { filterType, customStart, customEnd, voucherType, search } = req.query;
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);
    const cid = req.companyId;

    const wantAll      = !voucherType || voucherType === 'All Transaction';
    const wantSale     = wantAll || voucherType === 'Sale';
    const wantPurchase = wantAll || voucherType === 'Purchase';
    const wantOther    = wantAll || ['Receipt','Payment','Journal','Contra'].includes(voucherType);

    // ── Fetch all sources in parallel ──────────────────────────────────────────
    const [salesData, purchaseRaw, voucherData] = await Promise.all([
      // 1. Business Sales
      wantSale ? BusinessSales.find({
        invoiceDate: { $gte: startDate, $lte: endDate },
        invoiceType: 'Sale',
        companyId: cid
      }).select('_id invoiceNumber invoiceDate partyName grandTotal paidAmount balanceAmount paymentStatus').lean() : [],

      // 2. Business Purchases (BusinessStockTransaction — one row per item, group by invoice)
      wantPurchase ? BusinessStockTransaction.find({
        date: { $gte: startDate, $lte: endDate },
        referenceType: 'Purchase',
        transactionType: 'Stock In',
        companyId: cid
      }).select('_id invoiceNumber date supplierName supplierId totalAmount paidAmount netTotal paymentMode')
        .populate('supplierId', 'name').lean() : [],

      // 3. Accounting vouchers (Receipt / Payment / Journal / Contra)
      wantOther ? BusinessVoucher.find({
        companyId: cid,
        status: { $ne: 'Cancelled' },
        date: { $gte: startDate, $lte: endDate },
        voucherType: wantAll
          ? { $in: ['Receipt', 'Payment', 'Journal', 'Contra'] }
          : voucherType
      }).select('_id voucherNumber voucherType date partyName narration totalDebit totalCredit paymentMode referenceType referenceId referenceNumber').lean() : []
    ]);

    const transactions = [];

    // ── 1. Sales rows ──────────────────────────────────────────────────────────
    if (wantSale) {
      for (const s of salesData) {
        transactions.push({
          _id: s._id,
          date: s.invoiceDate,
          refNo: s.invoiceNumber,
          partyName: s.partyName || '-',
          categoryName: 'Sales',
          type: 'Sale',
          total: s.grandTotal || 0,
          received: s.paidAmount || 0,
          balance: s.balanceAmount || 0,
          referenceType: 'BusinessSales',
          referenceId: s._id
        });
      }
    }

    // ── 2. Purchase rows (deduplicate by invoiceNumber, accumulate totals) ───────
    if (wantPurchase) {
      const invoiceMap = new Map();
      for (const p of purchaseRaw) {
        const key = p.invoiceNumber || p._id.toString();
        const supplierName = p.supplierName || p.supplierId?.name || '-';
        const rowNet  = p.netTotal   || p.totalAmount || 0;
        const rowPaid = p.paidAmount || 0;
        if (!invoiceMap.has(key)) {
          invoiceMap.set(key, {
            _id:          p._id,
            date:         p.date,
            refNo:        p.invoiceNumber || `PUR-${p._id.toString().slice(-6)}`,
            partyName:    supplierName,
            categoryName: 'Purchase',
            type:         'Purchase',
            total:        rowNet,
            received:     rowPaid,
            balance:      Math.max(rowNet - rowPaid, 0),
            referenceType: 'BusinessPurchase',
            referenceId:   p._id
          });
        } else {
          // Same invoice — accumulate (multiple items on same bill)
          const existing = invoiceMap.get(key);
          existing.total    += rowNet;
          existing.received += rowPaid;
          existing.balance   = Math.max(existing.total - existing.received, 0);
          // Use supplier name if not already set
          if (existing.partyName === '-' && supplierName !== '-') {
            existing.partyName = supplierName;
          }
        }
      }
      transactions.push(...invoiceMap.values());
    }

    // ── 3. Accounting voucher rows ─────────────────────────────────────────────
    if (wantOther) {
      for (const v of voucherData) {
        const amount = v.totalDebit || v.totalCredit || 0;
        transactions.push({
          _id: v._id,
          date: v.date,
          refNo: v.referenceNumber || v.voucherNumber,
          partyName: v.partyName || v.narration || '-',
          categoryName: v.voucherType,
          type: v.voucherType,
          total: amount,
          received: v.voucherType === 'Receipt' ? amount : 0,
          balance: v.voucherType === 'Receipt' ? 0 : amount,
          referenceType: v.referenceType || 'Manual',
          referenceId: v.referenceId
        });
      }
    }

    // ── Sort by date desc ──────────────────────────────────────────────────────
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // ── Search filter ──────────────────────────────────────────────────────────
    const filtered = search?.trim()
      ? transactions.filter(t => {
          const q = search.toLowerCase();
          return t.partyName?.toLowerCase().includes(q) ||
                 t.refNo?.toLowerCase().includes(q) ||
                 t.type?.toLowerCase().includes(q);
        })
      : transactions;

    // ── Summary ────────────────────────────────────────────────────────────────
    const summary = {
      totalTransactions: filtered.length,
      totalAmount:   filtered.reduce((s, t) => s + t.total,    0),
      totalReceived: filtered.reduce((s, t) => s + t.received, 0),
      totalBalance:  filtered.reduce((s, t) => s + t.balance,  0)
    };

    res.json({
      success: true,
      data: {
        summary,
        transactions: filtered,
        voucherTypes: ['All Transaction', 'Sale', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra'],
        filters: { filterType, startDate, endDate }
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

    // Helper: sum BusinessVoucher entry amounts for given BusinessLedger groups
    // isDebitNormal=true for expense groups, false for income groups
    const getBusinessLedgerAmount = async (groups, isDebitNormal) => {
      let total = 0;
      const items = [];

      const ledgers = await BusinessLedger.find({
        group: { $in: groups },
        companyId: req.companyId,
        status: 'Active'
      }).lean();

      for (const ledger of ledgers) {
        const vouchers = await BusinessVoucher.find({
          date: { $gte: startDate, $lte: endDate },
          companyId: req.companyId,
          'entries.ledgerId': ledger._id
        }).lean();

        let amount = 0;
        vouchers.forEach(voucher => {
          voucher.entries.forEach(entry => {
            if (entry.ledgerId.toString() === ledger._id.toString()) {
              if (isDebitNormal) {
                // Debit normal (expense): debit adds, credit subtracts
                amount += entry.type === 'debit' ? entry.amount : -entry.amount;
              } else {
                // Credit normal (income): credit adds, debit subtracts
                amount += entry.type === 'credit' ? entry.amount : -entry.amount;
              }
            }
          });
        });

        if (Math.abs(amount) > 0.01) {
          items.push({
            ledgerId: ledger._id,
            name: ledger.name,
            group: ledger.group,
            amount: Math.abs(amount)
          });
          total += Math.abs(amount);
        }
      }

      return { total, items };
    };

    // ===== INCOME SECTION =====
    // Sale (+) from BusinessSales
    const salesData = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale',
      companyId: req.companyId
    }).lean();
    const saleAmount = salesData.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);

    // Credit Note (-) - Sales Returns (Sale Return type)
    const saleReturnData = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale Return',
      companyId: req.companyId
    }).lean();
    const creditNoteAmount = saleReturnData.reduce((sum, v) => sum + (v.grandTotal || 0), 0);

    const saleFA = 0;
    const totalIncome = saleAmount - creditNoteAmount + saleFA;

    // ===== PURCHASE & DIRECT COST SECTION =====
    // Purchase (-) - Use BusinessStockTransaction for Business inventory
    const purchaseTransactions = await BusinessStockTransaction.find({
      date: { $gte: startDate, $lte: endDate },
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      companyId: req.companyId
    }).lean();
    const purchaseAmount = purchaseTransactions.reduce((sum, tx) =>
      sum + ((tx.quantity || 0) * (tx.rate || 0)), 0);

    // Debit Note (+) - Purchase returns (Stock Out referenceType='Return')
    const purchaseReturnTxns = await BusinessStockTransaction.find({
      date: { $gte: startDate, $lte: endDate },
      transactionType: 'Stock Out',
      referenceType: 'Return',
      companyId: req.companyId
    }).lean();
    const debitNoteAmount = purchaseReturnTxns.reduce((sum, tx) =>
      sum + ((tx.quantity || 0) * (tx.rate || 0)), 0);

    const purchaseFA = 0;
    const totalPurchaseDirectCost = purchaseAmount - debitNoteAmount + purchaseFA;

    // ===== DIRECT EXPENSES SECTION =====
    // From BusinessVoucher entries for Direct Expenses ledgers
    const directExpensesData = await getBusinessLedgerAmount(['Direct Expenses'], true);

    // Also include Expense-type vouchers that are not linked to a specific ledger group
    // (catch-all: Expense voucher total debit entries on non-purchase ledgers)
    const totalDirectExpenses = directExpensesData.total;

    // ===== TAX PAYABLE / RECEIVABLE SECTION =====
    // From BusinessLedger group 'Duties & Taxes' — credit balance = payable, debit balance = receivable
    const taxLedgers = await BusinessLedger.find({
      group: 'Duties & Taxes',
      companyId: req.companyId,
      status: 'Active'
    }).lean();

    let gstPayable = 0, tcsPayable = 0, tdsPayable = 0;
    let gstReceivable = 0, tcsReceivable = 0, tdsReceivable = 0;

    for (const ledger of taxLedgers) {
      const vouchers = await BusinessVoucher.find({
        date: { $gte: startDate, $lte: endDate },
        companyId: req.companyId,
        'entries.ledgerId': ledger._id
      }).lean();

      // Duties & Taxes is credit-normal (liability)
      let netBalance = 0;
      vouchers.forEach(v => {
        v.entries.forEach(e => {
          if (e.ledgerId.toString() === ledger._id.toString()) {
            netBalance += e.type === 'credit' ? e.amount : -e.amount;
          }
        });
      });

      const lowerName = ledger.name.toLowerCase();
      if (lowerName.includes('gst') || lowerName.includes('cgst') || lowerName.includes('sgst') || lowerName.includes('igst')) {
        if (netBalance >= 0) gstPayable += netBalance;
        else gstReceivable += Math.abs(netBalance);
      } else if (lowerName.includes('tcs')) {
        if (netBalance >= 0) tcsPayable += netBalance;
        else tcsReceivable += Math.abs(netBalance);
      } else if (lowerName.includes('tds')) {
        if (netBalance >= 0) tdsPayable += netBalance;
        else tdsReceivable += Math.abs(netBalance);
      } else {
        if (netBalance >= 0) gstPayable += netBalance;
        else gstReceivable += Math.abs(netBalance);
      }
    }

    const totalTaxPayable = gstPayable + tcsPayable + tdsPayable;
    const totalTaxReceivable = gstReceivable + tcsReceivable + tdsReceivable;

    // ===== STOCK ADJUSTMENTS SECTION =====
    // Single aggregation replaces N*4 individual queries (one per item, in+out, open+close)
    const items = await BusinessItem.find({ status: 'Active', companyId: req.companyId })
      .select('_id purchasePrice costPrice').lean();

    const itemPriceMap = new Map();
    items.forEach(i => itemPriceMap.set(i._id.toString(), i.purchasePrice || i.costPrice || 0));

    const [openingAgg, closingAgg] = await Promise.all([
      BusinessStockTransaction.aggregate([
        { $match: { companyId: req.companyId, date: { $lt: startDate } } },
        { $group: {
          _id: '$itemId',
          qtyIn:  { $sum: { $cond: [{ $eq: ['$transactionType', 'Stock In']  }, '$quantity', 0] } },
          qtyOut: { $sum: { $cond: [{ $eq: ['$transactionType', 'Stock Out'] }, '$quantity', 0] } }
        }}
      ]),
      BusinessStockTransaction.aggregate([
        { $match: { companyId: req.companyId, date: { $lte: endDate } } },
        { $group: {
          _id: '$itemId',
          qtyIn:  { $sum: { $cond: [{ $eq: ['$transactionType', 'Stock In']  }, '$quantity', 0] } },
          qtyOut: { $sum: { $cond: [{ $eq: ['$transactionType', 'Stock Out'] }, '$quantity', 0] } }
        }}
      ])
    ]);

    let openingStock = 0;
    openingAgg.forEach(r => {
      const price = itemPriceMap.get(r._id?.toString()) || 0;
      openingStock += (r.qtyIn - r.qtyOut) * price;
    });

    let closingStock = 0;
    closingAgg.forEach(r => {
      const price = itemPriceMap.get(r._id?.toString()) || 0;
      closingStock += (r.qtyIn - r.qtyOut) * price;
    });

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
    // From BusinessLedger groups: Direct Incomes, Indirect Incomes (via BusinessVoucher)
    const indirectIncomeData = await getBusinessLedgerAmount(['Direct Incomes', 'Indirect Incomes'], false);

    // ===== INDIRECT EXPENSES =====
    // From BusinessLedger group: Indirect Expenses (via BusinessVoucher)
    const indirectExpensesData = await getBusinessLedgerAmount(['Indirect Expenses'], true);

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
    const companyId = req.companyId;

    // Balance Sheet is always CUMULATIVE — all transactions from beginning up to asOnDate
    const endDate = asOnDate ? new Date(asOnDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch all active BusinessLedgers for this company
    const ledgers = await BusinessLedger.find({ companyId, status: 'Active' }).lean();

    // Single aggregation: sum ALL BusinessVoucher entries up to endDate per ledger (cumulative)
    const voucherAgg = await BusinessVoucher.aggregate([
      { $match: { companyId, date: { $lte: endDate }, status: 'Posted' } },
      { $unwind: '$entries' },
      {
        $group: {
          _id: '$entries.ledgerId',
          totalDebit:  { $sum: { $cond: [{ $eq: ['$entries.type', 'debit']  }, '$entries.amount', 0] } },
          totalCredit: { $sum: { $cond: [{ $eq: ['$entries.type', 'credit'] }, '$entries.amount', 0] } }
        }
      }
    ]);
    const voucherMap = new Map(voucherAgg.map(v => [v._id.toString(), v]));

    const ASSET_GROUPS     = new Set(['Cash-in-Hand','Bank Accounts','Sundry Debtors','Stock-in-Hand','Fixed Assets','Current Assets','Loans & Advances','Investments']);
    const LIABILITY_GROUPS = new Set(['Sundry Creditors','Current Liabilities','Duties & Taxes','Provisions','Suspense Account']);
    const CAPITAL_GROUPS   = new Set(['Capital Account','Reserves & Surplus']);
    const PL_INCOME_GROUPS = new Set(['Sales Accounts','Direct Incomes','Indirect Incomes']);
    const PL_EXPENSE_GROUPS= new Set(['Purchase Accounts','Direct Expenses','Indirect Expenses']);

    const assets = [], liabilities = [], capital = [];
    let totalAssets = 0, totalLiabilities = 0, totalCapital = 0;
    let totalIncome = 0, totalExpenses = 0;

    for (const ledger of ledgers) {
      const txn = voucherMap.get(ledger._id.toString()) || { totalDebit: 0, totalCredit: 0 };
      const ob   = ledger.openingBalance || 0;
      const obDr = (ledger.openingBalanceType || 'Debit') === 'Debit';

      // Compute running balance in natural direction
      let balance;
      if (ASSET_GROUPS.has(ledger.group) || PL_EXPENSE_GROUPS.has(ledger.group)) {
        // Debit normal
        const obVal = obDr ? ob : -ob;
        balance = obVal + txn.totalDebit - txn.totalCredit;
      } else {
        // Credit normal (liabilities, capital, income)
        const obVal = obDr ? -ob : ob;
        balance = obVal + txn.totalCredit - txn.totalDebit;
      }

      if (ASSET_GROUPS.has(ledger.group)) {
        if (Math.abs(balance) > 0.01) {
          assets.push({ ledgerId: ledger._id, ledgerName: ledger.name, group: ledger.group, balance, balanceType: balance >= 0 ? 'Dr' : 'Cr' });
          if (balance > 0) totalAssets += balance;
        }
      } else if (LIABILITY_GROUPS.has(ledger.group)) {
        if (Math.abs(balance) > 0.01) {
          liabilities.push({ ledgerId: ledger._id, ledgerName: ledger.name, group: ledger.group, balance, balanceType: balance >= 0 ? 'Cr' : 'Dr' });
          if (balance > 0) totalLiabilities += balance;
        }
      } else if (CAPITAL_GROUPS.has(ledger.group)) {
        if (Math.abs(balance) > 0.01) {
          capital.push({ ledgerId: ledger._id, ledgerName: ledger.name, group: ledger.group, balance, balanceType: balance >= 0 ? 'Cr' : 'Dr' });
          if (balance > 0) totalCapital += balance;
        }
      } else if (PL_INCOME_GROUPS.has(ledger.group)) {
        totalIncome += balance;
      } else if (PL_EXPENSE_GROUPS.has(ledger.group)) {
        totalExpenses += balance;
      }
    }

    // Net P&L from income/expense ledgers → added to capital side
    const netPL = totalIncome - totalExpenses;
    if (Math.abs(netPL) > 0.01) {
      capital.push({
        ledgerId: 'net-pl',
        ledgerName: netPL >= 0 ? 'Net Profit (Current Period)' : 'Net Loss (Current Period)',
        group: 'Capital Account',
        balance: Math.abs(netPL),
        balanceType: netPL >= 0 ? 'Cr' : 'Dr',
        isNetPL: true
      });
      totalCapital += Math.abs(netPL);
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalAssets,
          totalLiabilities,
          totalCapital,
          liabilitiesAndCapital: totalLiabilities + totalCapital,
          difference: totalAssets - (totalLiabilities + totalCapital),
          netPL,
          isProfit: netPL >= 0
        },
        assets:      assets.sort((a, b) => b.balance - a.balance),
        liabilities: liabilities.sort((a, b) => b.balance - a.balance),
        capital:     capital.sort((a, b) => b.balance - a.balance),
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
      invoiceType: 'Sale',
      companyId: req.companyId
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
      date: { $gte: startDate, $lte: endDate },
      companyId: req.companyId
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
      invoiceType: 'Sale',
      companyId: req.companyId
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
      date: { $gte: startDate, $lte: endDate },
      companyId: req.companyId
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
    const companyId = req.companyId;

    // Get date range
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    const ASSET_GROUPS      = new Set(['Cash-in-Hand','Bank Accounts','Sundry Debtors','Stock-in-Hand','Fixed Assets','Current Assets','Loans & Advances','Investments']);
    const LIABILITY_GROUPS  = new Set(['Sundry Creditors','Current Liabilities','Duties & Taxes','Provisions','Suspense Account']);
    const CAPITAL_GROUPS    = new Set(['Capital Account','Reserves & Surplus']);
    const INCOME_GROUPS     = new Set(['Sales Accounts','Direct Incomes','Indirect Incomes']);
    const EXPENSE_GROUPS    = new Set(['Purchase Accounts','Direct Expenses','Indirect Expenses']);

    const isDebitNatureGroup = (group) => ASSET_GROUPS.has(group) || EXPENSE_GROUPS.has(group);

    const getCategory = (group) => {
      if (ASSET_GROUPS.has(group))     return 'Assets';
      if (LIABILITY_GROUPS.has(group)) return 'Liabilities';
      if (CAPITAL_GROUPS.has(group))   return 'Capital';
      if (INCOME_GROUPS.has(group))    return 'Income';
      if (EXPENSE_GROUPS.has(group))   return 'Expenses';
      return 'Other';
    };

    // Fetch all active BusinessLedgers for this company
    const ledgers = await BusinessLedger.find({ companyId, status: 'Active' }).lean();

    // Opening balance: all BusinessVoucher entries BEFORE startDate
    const openingAgg = await BusinessVoucher.aggregate([
      { $match: { companyId, date: { $lt: startDate }, status: 'Posted' } },
      { $unwind: '$entries' },
      {
        $group: {
          _id: '$entries.ledgerId',
          totalDebit:  { $sum: { $cond: [{ $eq: ['$entries.type', 'debit']  }, '$entries.amount', 0] } },
          totalCredit: { $sum: { $cond: [{ $eq: ['$entries.type', 'credit'] }, '$entries.amount', 0] } }
        }
      }
    ]);
    const openingMap = new Map(openingAgg.map(v => [v._id.toString(), v]));

    // Period transactions: BusinessVoucher entries within startDate–endDate
    const periodAgg = await BusinessVoucher.aggregate([
      { $match: { companyId, date: { $gte: startDate, $lte: endDate }, status: 'Posted' } },
      { $unwind: '$entries' },
      {
        $group: {
          _id: '$entries.ledgerId',
          totalDebit:  { $sum: { $cond: [{ $eq: ['$entries.type', 'debit']  }, '$entries.amount', 0] } },
          totalCredit: { $sum: { $cond: [{ $eq: ['$entries.type', 'credit'] }, '$entries.amount', 0] } }
        }
      }
    ]);
    const periodMap = new Map(periodAgg.map(v => [v._id.toString(), v]));

    const records = [];
    let totalOpeningDr = 0, totalOpeningCr = 0;
    let totalDebitAmount = 0, totalCreditAmount = 0;
    let totalClosingDr = 0, totalClosingCr = 0;

    const categoryGroups = { Assets: [], Liabilities: [], Income: [], Expenses: [], Capital: [], Other: [] };

    for (const ledger of ledgers) {
      const debitNature = isDebitNatureGroup(ledger.group);
      const category    = getCategory(ledger.group);

      // Opening balance from ledger record (before any vouchers)
      const ob    = ledger.openingBalance || 0;
      const obDr  = (ledger.openingBalanceType || 'Debit') === 'Debit';
      const obVal = debitNature ? (obDr ? ob : -ob) : (obDr ? -ob : ob);

      // Opening running balance from vouchers before startDate
      const obTxn = openingMap.get(ledger._id.toString()) || { totalDebit: 0, totalCredit: 0 };
      const openingRunning = debitNature
        ? obVal + obTxn.totalDebit - obTxn.totalCredit
        : obVal + obTxn.totalCredit - obTxn.totalDebit;

      const openingDr = openingRunning >= 0 && debitNature  ? openingRunning :
                        openingRunning < 0  && !debitNature ? Math.abs(openingRunning) : 0;
      const openingCr = openingRunning >= 0 && !debitNature ? openingRunning :
                        openingRunning < 0  && debitNature  ? Math.abs(openingRunning) : 0;

      // Period debits/credits
      const pTxn = periodMap.get(ledger._id.toString()) || { totalDebit: 0, totalCredit: 0 };
      const periodDebits  = pTxn.totalDebit;
      const periodCredits = pTxn.totalCredit;

      // Closing balance
      const closingRunning = debitNature
        ? openingRunning + periodDebits - periodCredits
        : openingRunning + periodCredits - periodDebits;

      const closingDr = closingRunning >= 0 && debitNature  ? closingRunning :
                        closingRunning < 0  && !debitNature ? Math.abs(closingRunning) : 0;
      const closingCr = closingRunning >= 0 && !debitNature ? closingRunning :
                        closingRunning < 0  && debitNature  ? Math.abs(closingRunning) : 0;

      // Include ledger if it has any activity (opening balance or period transactions)
      const hasActivity = Math.abs(openingRunning) > 0.01 || periodDebits > 0.01 || periodCredits > 0.01;
      if (!hasActivity) continue;

      const record = {
        ledgerId:    ledger._id,
        ledgerName:  ledger.name,
        ledgerType:  ledger.group,
        category,
        openingDr,
        openingCr,
        debitAmount: periodDebits,
        creditAmount: periodCredits,
        closingDr,
        closingCr
      };

      records.push(record);
      const groupKey = categoryGroups[category] ? category : 'Other';
      categoryGroups[groupKey].push(record);

      totalOpeningDr    += openingDr;
      totalOpeningCr    += openingCr;
      totalDebitAmount  += periodDebits;
      totalCreditAmount += periodCredits;
      totalClosingDr    += closingDr;
      totalClosingCr    += closingCr;
    }

    Object.keys(categoryGroups).forEach(key => {
      categoryGroups[key].sort((a, b) => a.ledgerName.localeCompare(b.ledgerName));
    });

    const isBalanced = Math.abs(totalClosingDr - totalClosingCr) < 0.01;

    res.json({
      success: true,
      data: {
        summary: {
          totalLedgers: records.length,
          openingDebit:  totalOpeningDr,
          openingCredit: totalOpeningCr,
          totalDebit:    totalDebitAmount,
          totalCredit:   totalCreditAmount,
          closingDebit:  totalClosingDr,
          closingCredit: totalClosingCr,
          difference:    Math.abs(totalClosingDr - totalClosingCr),
          isBalanced
        },
        ledgers: records.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName)),
        groupedLedgers: categoryGroups,
        filters: { filterType, startDate, endDate }
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
    const itemQuery = { status: 'Active', companyId: req.companyId };
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
        date: { $lte: endDate },
        companyId: req.companyId
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
    const allItems = await BusinessItem.find({ status: 'Active', companyId: req.companyId }).lean();

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
      invoiceType: 'Sale',
      companyId: req.companyId
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
      voucherDate: { $gte: startDate, $lte: endDate },
      companyId: req.companyId
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
      date: { $gte: startDate, $lte: endDate },
      companyId: req.companyId
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
      voucherDate: { $gte: startDate, $lte: endDate },
      companyId: req.companyId
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
      date: { $lt: startOfPeriod },
      companyId: req.companyId
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
    const items = await BusinessItem.find({ status: 'Active', companyId: req.companyId }).lean();

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
      ledger = await Ledger.findOne({ _id: ledgerId, companyId: req.companyId });
    }
    if (!ledger) {
      ledger = await Ledger.findOne({ ledgerType: 'Bank', status: 'Active', companyId: req.companyId });
    }

    // Bank payment modes — non-cash transactions
    const bankModes = ['Bank', 'UPI', 'Card', 'Cheque'];

    // Deposits: Business Sales paid via bank
    const sales = await BusinessSales.find({
      companyId: req.companyId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale',
      paymentMode: { $in: bankModes },
      paidAmount: { $gt: 0 }
    }).sort({ invoiceDate: 1 });

    // Withdrawals: Business Purchases paid via bank
    const purchases = await BusinessStockTransaction.find({
      companyId: req.companyId,
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
    const companyId = req.companyId;

    const { startDate, endDate } = getDateRange(filterType || 'thisYear', customStart, customEnd);

    const parties = [];
    let totalReceivable = 0;
    let totalPayable = 0;
    let customerCount = 0;
    let supplierCount = 0;

    // ── CUSTOMERS (Receivable) ──
    if (!type || type === 'customers') {
      const customers = await BusinessCustomer.find({ companyId, active: true }).lean();

      // Aggregate outstanding balances per customer from BusinessSales
      const customerBalances = await BusinessSales.aggregate([
        {
          $match: {
            companyId: companyId,
            invoiceType: 'Sale',
            invoiceDate: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$partyId',
            totalSales: { $sum: '$grandTotal' },
            totalPaid: { $sum: '$paidAmount' },
            balance: { $sum: '$balanceAmount' }
          }
        }
      ]);

      const balanceMap = new Map(
        customerBalances.map(b => [b._id?.toString(), b])
      );

      for (const customer of customers) {
        const bal = balanceMap.get(customer._id.toString()) || { totalSales: 0, totalPaid: 0, balance: 0 };
        const closingBalance = bal.balance;

        parties.push({
          ledgerId: customer._id,
          name: customer.name,
          type: 'Customer',
          phone: customer.phone || '',
          email: customer.email || '',
          creditLimit: customer.creditLimit || 0,
          openingBalance: customer.openingBalance || 0,
          totalSales: bal.totalSales,
          totalPurchases: 0,
          totalPayments: bal.totalPaid,
          totalReceipts: 0,
          closingBalance,
          closingBalanceType: closingBalance >= 0 ? 'Dr' : 'Cr'
        });

        customerCount++;
        if (closingBalance > 0) totalReceivable += closingBalance;
        else if (closingBalance < 0) totalPayable += Math.abs(closingBalance);
      }
    }

    // ── SUPPLIERS (Payable) ──
    if (!type || type === 'suppliers') {
      const suppliers = await BusinessSupplier.find({ companyId, active: true }).lean();

      // Aggregate outstanding balances per supplier from BusinessStockTransaction (purchases)
      const supplierBalances = await BusinessStockTransaction.aggregate([
        {
          $match: {
            companyId: companyId,
            referenceType: 'Purchase',
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$supplierId',
            totalPurchases: { $sum: '$netTotal' },
            totalPaid: { $sum: '$paidAmount' },
            balance: { $sum: { $subtract: ['$netTotal', '$paidAmount'] } }
          }
        }
      ]);

      const supplierBalanceMap = new Map(
        supplierBalances.map(b => [b._id?.toString(), b])
      );

      for (const supplier of suppliers) {
        const bal = supplierBalanceMap.get(supplier._id.toString()) || { totalPurchases: 0, totalPaid: 0, balance: 0 };
        // Payable is negative (we owe money)
        const closingBalance = -(bal.balance);

        parties.push({
          ledgerId: supplier._id,
          name: supplier.name,
          type: 'Supplier',
          phone: supplier.phone || '',
          email: supplier.email || '',
          creditLimit: supplier.creditLimit || 0,
          openingBalance: supplier.openingBalance || 0,
          totalSales: 0,
          totalPurchases: bal.totalPurchases,
          totalPayments: 0,
          totalReceipts: bal.totalPaid,
          closingBalance,
          closingBalanceType: closingBalance >= 0 ? 'Dr' : 'Cr'
        });

        supplierCount++;
        if (closingBalance < 0) totalPayable += Math.abs(closingBalance);
        else if (closingBalance > 0) totalReceivable += closingBalance;
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalParties: parties.length,
          customers: customerCount,
          suppliers: supplierCount,
          totalReceivable,
          totalPayable,
          netBalance: totalReceivable - totalPayable,
          partiesWithCredit: parties.filter(p => p.closingBalance > 0).length,
          partiesWithDebit: parties.filter(p => p.closingBalance < 0).length
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
      invoiceType: 'Sale',
      companyId: req.companyId
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
      companyId: req.companyId,
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: startDate, $lte: endDate }
    }).populate('supplierId').populate('itemId').sort({ date: 1 });

    // Also fetch purchase vouchers for additional details
    const purchaseVouchers = await Voucher.find({
      companyId: req.companyId,
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
    const itemQuery = { status: 'Active', companyId: req.companyId };
    if (category && category !== 'all') {
      itemQuery.category = category;
    }

    // Fetch all Business items
    const items = await BusinessItem.find(itemQuery).sort({ itemName: 1 });

    // Fetch transactions BEFORE the date range (for opening stock)
    const priorTransactions = await BusinessStockTransaction.find({
      date: { $lt: startDate },
      companyId: req.companyId
    });

    // Fetch transactions WITHIN the date range
    const periodTransactions = await BusinessStockTransaction.find({
      date: { $gte: startDate, $lte: endDate },
      companyId: req.companyId
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
    const companyId = req.companyId;

    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Opening balance: net debit-credit of all cash/bank ledgers before startDate
    const cashBankLedgers = await BusinessLedger.find({
      companyId, group: { $in: ['Cash-in-Hand', 'Bank Accounts'] }, status: 'Active'
    }).lean();

    const openingAgg = await BusinessVoucher.aggregate([
      { $match: { companyId, date: { $lt: startDate }, status: 'Posted' } },
      { $unwind: '$entries' },
      { $match: { 'entries.ledgerId': { $in: cashBankLedgers.map(l => l._id) } } },
      { $group: {
        _id: null,
        totalDebit:  { $sum: { $cond: [{ $eq: ['$entries.type', 'debit']  }, '$entries.amount', 0] } },
        totalCredit: { $sum: { $cond: [{ $eq: ['$entries.type', 'credit'] }, '$entries.amount', 0] } }
      }}
    ]);
    const openingBalance = openingAgg.length > 0
      ? openingAgg[0].totalDebit - openingAgg[0].totalCredit : 0;

    // Cash/Bank ledger IDs for filtering
    const cashBankIds = new Set(cashBankLedgers.map(l => l._id.toString()));

    // Fetch ALL BusinessVouchers for the period
    const bvQuery = {
      companyId,
      date: { $gte: startDate, $lte: endDate },
      status: 'Posted'
    };
    if (voucherType && voucherType !== 'All') bvQuery.voucherType = voucherType;

    const vouchers = await BusinessVoucher.find(bvQuery).sort({ date: 1, voucherNumber: 1 }).lean();

    const transactions = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const voucher of vouchers) {
      const cashEntry = voucher.entries.find(e => cashBankIds.has(e.ledgerId?.toString()));

      // Primary entry: prefer cash/bank, else first non-GST non-stock entry
      const primaryEntry = cashEntry ||
        voucher.entries.find(e => !e.isGSTLine && !e.isStockLine) ||
        voucher.entries[0];

      if (!primaryEntry) continue;

      // Contra entry for description (party/account opposite to primary)
      const contraEntry = voucher.entries.find(e =>
        e.ledgerId?.toString() !== primaryEntry.ledgerId?.toString() &&
        !e.isGSTLine && !e.isStockLine
      );

      // Voucher type label (same as Cash Book)
      const voucherLabel =
        voucher.voucherType === 'Sales'      ? (voucher.referenceType === 'SalesReturn' ? 'Sale Return' : 'Sale') :
        voucher.voucherType === 'Payment'    ? (voucher.referenceType === 'BusinessPurchase' ? 'Purchase' : 'Payment') :
        voucher.voucherType === 'Journal'    ? (voucher.referenceType === 'BusinessPurchase' ? 'Purchase' : 'Journal') :
        voucher.voucherType === 'CreditNote' ? 'Sale Return' :
        voucher.voucherType === 'DebitNote'  ? 'Purchase Return' :
        voucher.voucherType;

      const party = voucher.partyName || contraEntry?.ledgerName || voucher.narration || '';
      const description = party ? `${voucherLabel} — ${party}` : voucherLabel;

      // Net amounts (exclude GST/stock lines for the total)
      const totalDr = voucher.entries
        .filter(e => e.type === 'debit'  && !e.isGSTLine && !e.isStockLine)
        .reduce((s, e) => s + (e.amount || 0), 0);
      const totalCr = voucher.entries
        .filter(e => e.type === 'credit' && !e.isGSTLine && !e.isStockLine)
        .reduce((s, e) => s + (e.amount || 0), 0);
      const netAmt = Math.max(totalDr, totalCr);

      let debitAmount  = 0;
      let creditAmount = 0;
      let isAdjustment = false;

      if (cashEntry) {
        // Cash/Bank transaction — use cash entry amount & direction
        debitAmount  = cashEntry.type === 'debit'  ? cashEntry.amount : 0;
        creditAmount = cashEntry.type === 'credit' ? cashEntry.amount : 0;
      } else if (voucher.voucherType === 'Sales' || voucher.voucherType === 'CreditNote') {
        // Sales / Sale Return — always show on receipt (Dr) side with invoice amount
        debitAmount = netAmt;
      } else if (
        voucher.voucherType === 'Purchase' ||
        (voucher.voucherType === 'Payment' && voucher.referenceType === 'BusinessPurchase') ||
        (voucher.voucherType === 'Journal' && voucher.referenceType === 'BusinessPurchase') ||
        voucher.voucherType === 'DebitNote'
      ) {
        // Purchase / Purchase Return — always show on payment (Cr) side with invoice amount
        creditAmount = netAmt;
      } else {
        // Receipt / Payment / Journal / Contra without cash entry → Adjustment
        isAdjustment = true;
      }

      // Account = cash/bank account name (if cash txn) else primary ledger
      const account = cashEntry?.ledgerName || primaryEntry?.ledgerName || '';

      transactions.push({
        _id:           voucher._id,
        date:          voucher.date,
        voucherNumber: voucher.voucherNumber,
        voucherType:   voucherLabel,
        ledgerName:    primaryEntry.ledgerName,
        account,
        description,
        particulars:   party || voucherLabel,
        debitAmount,
        creditAmount,
        isAdjustment,
        adjustmentDr:  isAdjustment ? totalDr : 0,
        adjustmentCr:  isAdjustment ? totalCr : 0,
        isCashEntry:   !!cashEntry,
        rawNetAmt:     netAmt
      });

      totalDebit  += debitAmount;
      totalCredit += creditAmount;
    }

    // ── Direct BusinessSales fallback ──
    // Include sales that have no corresponding BusinessVoucher (silent voucher creation failures)
    const voucherSaleIdSet = new Set(
      vouchers
        .filter(v => v.referenceType === 'BusinessSales')
        .map(v => v.referenceId?.toString())
    );

    const CASH_MODES_DB = ['Cash', 'UPI', 'Card', 'Bank', 'Cheque'];
    const directSalesDB = await BusinessSales.find({
      companyId,
      invoiceType: 'Sale',
      invoiceDate: { $gte: startDate, $lte: endDate }
    }).select('_id invoiceNumber invoiceDate partyName grandTotal paidAmount paymentMode').lean();

    for (const s of directSalesDB) {
      if (voucherSaleIdSet.has(s._id.toString())) continue; // already covered by voucher
      // Only skip if a specific non-Sales voucherType filter was requested
      if (voucherType && voucherType !== 'All' && voucherType !== 'Sales') continue;

      const isCash = CASH_MODES_DB.includes(s.paymentMode) && (s.paidAmount || 0) > 0;
      const amount = s.grandTotal || 0;
      transactions.push({
        _id:           s._id,
        date:          s.invoiceDate,
        voucherNumber: s.invoiceNumber,
        voucherType:   'Sale',
        ledgerName:    isCash ? (s.paymentMode || 'Cash') : 'Sundry Debtors',
        account:       isCash ? (s.paymentMode || 'Cash') : '',
        description:   `Sale — ${s.partyName || 'Walk-in Customer'}`,
        particulars:   s.partyName || 'Walk-in Customer',
        debitAmount:   amount,
        creditAmount:  0,
        isAdjustment:  false,
        adjustmentDr:  0,
        adjustmentCr:  0,
        isCashEntry:   isCash
      });
      totalDebit += amount;
    }

    // Sort chronologically
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Search filter
    let filteredTransactions = transactions;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredTransactions = transactions.filter(t =>
        t.description?.toLowerCase().includes(searchLower) ||
        t.voucherNumber?.toLowerCase().includes(searchLower) ||
        t.particulars?.toLowerCase().includes(searchLower) ||
        t.voucherType?.toLowerCase().includes(searchLower) ||
        t.ledgerName?.toLowerCase().includes(searchLower)
      );
    }

    // Day-wise summary
    const dayWiseSummary = {};
    filteredTransactions.forEach(t => {
      const dateKey = new Date(t.date).toISOString().split('T')[0];
      if (!dayWiseSummary[dateKey]) {
        dayWiseSummary[dateKey] = { date: dateKey, totalDebit: 0, totalCredit: 0, count: 0 };
      }
      dayWiseSummary[dateKey].totalDebit  += t.debitAmount;
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
 * Vyapar Cash Book - Combined Cash & Bank Book
 * Fetches ALL cash/bank transactions from BusinessVouchers (the single source of truth)
 * + BusinessSales Sale Returns (which don't create BusinessVouchers)
 * GET /api/reports/vyapar/cash-book
 */
export const getVyaparCashBook = async (req, res) => {
  try {
    const { filterType, customStart, customEnd } = req.query;
    const companyId = req.companyId;

    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // ── 1. Get all Cash & Bank ledgers ──
    const cbLedgers = await BusinessLedger.find({
      companyId,
      group: { $in: ['Cash-in-Hand', 'Bank Accounts'] },
      status: 'Active'
    }).lean();
    const cbIdSet = new Set(cbLedgers.map(l => l._id.toString()));

    // ── 2. Opening Balance ──
    // Computed from actual source data (same pattern as getCashInHandReport)
    // to handle cases where BusinessVoucher was not created for a transaction.
    const CASH_BANK_MODES = ['Cash', 'UPI', 'Card', 'Bank', 'Cheque'];

    // 2a. Pre-period cash/bank sales → cash IN
    const salesBefore = await BusinessSales.find({
      companyId,
      invoiceDate: { $lt: startDate },
      invoiceType: 'Sale',
      paymentMode: { $in: CASH_BANK_MODES },
      paidAmount: { $gt: 0 }
    }).lean();
    let openingBalance = salesBefore.reduce((s, r) => s + (r.paidAmount || 0), 0);

    // 2b. Pre-period cash/bank purchases → cash OUT (deduplicated by invoiceNumber)
    const purchTxnBefore = await BusinessStockTransaction.find({
      companyId,
      date: { $lt: startDate },
      transactionType: 'Stock In',
      paymentMode: { $in: CASH_BANK_MODES },
      paidAmount: { $gt: 0 }
    }).lean();
    const seenPurchInv = new Set();
    for (const t of purchTxnBefore) {
      const key = t.invoiceNumber || t._id.toString();
      if (!seenPurchInv.has(key)) {
        seenPurchInv.add(key);
        openingBalance -= (t.paidAmount || 0);
      }
    }

    // 2c. Pre-period manual BusinessVouchers (Receipt/Payment/Contra/Journal etc.)
    //     that are NOT auto-created from sales/purchases (to avoid double-counting)
    if (cbLedgers.length > 0) {
      const manualVouchersBefore = await BusinessVoucher.find({
        companyId,
        date: { $lt: startDate },
        status: 'Posted',
        referenceType: { $nin: ['BusinessSales', 'BusinessPurchase'] }
      }).lean();
      for (const v of manualVouchersBefore) {
        for (const e of v.entries) {
          if (cbIdSet.has(e.ledgerId?.toString())) {
            openingBalance += e.type === 'debit' ? (e.amount || 0) : -(e.amount || 0);
          }
        }
      }
    }

    // ── 3. Fetch ALL posted BusinessVouchers in the period ──
    const vouchers = await BusinessVoucher.find({
      companyId,
      date: { $gte: startDate, $lte: endDate },
      status: 'Posted'
    }).sort({ date: 1, voucherNumber: 1 }).lean();

    const receiptSide = [];
    const paymentSide = [];

    for (const v of vouchers) {
      // Find the cash/bank leg — this determines if it's a receipt or payment
      const cashEntry = v.entries.find(e => cbIdSet.has(e.ledgerId?.toString()));
      if (!cashEntry || cashEntry.amount <= 0) continue;

      // For Contra: show descriptive label (Cash from Bank / Cash to Bank)
      let particulars = v.partyName || '';
      if (v.voucherType === 'Contra') {
        particulars = cashEntry.type === 'debit' ? 'Cash received from Bank' : 'Cash deposited to Bank';
      } else if (!particulars) {
        // Fallback: narration or contra ledger name
        const otherEntry = v.entries.find(e =>
          e.ledgerId?.toString() !== cashEntry.ledgerId?.toString() &&
          !e.isGSTLine && !e.isStockLine
        );
        particulars = v.narration || otherEntry?.ledgerName || v.voucherType;
      }

      // Map internal voucherType to readable label
      const voucherLabel =
        v.voucherType === 'Sales'     ? (v.referenceType === 'SalesReturn' ? 'Sale Return' : 'Sale') :
        v.voucherType === 'Payment'   ? (v.referenceType === 'BusinessPurchase' ? 'Purchase' : 'Payment') :
        v.voucherType === 'Journal'   ? (v.referenceType === 'BusinessPurchase' ? 'Purchase' : 'Journal') :
        v.voucherType === 'CreditNote'? 'Sale Return' :
        v.voucherType === 'DebitNote' ? 'Purchase Return' :
        v.voucherType; // Receipt, Payment, Contra, Income, Expense, etc.

      const entry = {
        date:          v.date,
        voucherNumber: v.voucherNumber,
        voucherType:   voucherLabel,
        particulars,
        amount:        cashEntry.amount,
        account:       cashEntry.ledgerName || 'Cash',
        referenceType: v.referenceType || v.voucherType,
        referenceId:   v._id
      };

      // cash/bank debited → money IN → Receipt side
      // cash/bank credited → money OUT → Payment side
      if (cashEntry.type === 'debit')  receiptSide.push(entry);
      else                             paymentSide.push(entry);
    }

    // ── 4. Direct BusinessSales fallback ──
    // Also query BusinessSales directly so cash sales appear even if voucher creation failed
    const CASH_MODES = ['Cash', 'UPI', 'Card', 'Bank', 'Cheque'];

    // Track which BusinessSales IDs are already covered by a voucher
    // Vouchers with referenceType='BusinessSales' have referenceId = the sale's _id
    const voucherSaleIds = new Set(
      vouchers
        .filter(v => v.referenceType === 'BusinessSales')
        .map(v => v.referenceId?.toString())
    );

    // Fetch all cash Sales from BusinessSales directly
    const directSales = await BusinessSales.find({
      companyId,
      invoiceType: 'Sale',
      invoiceDate: { $gte: startDate, $lte: endDate },
      paymentMode: { $in: CASH_MODES },
      paidAmount: { $gt: 0 }
    }).sort({ invoiceDate: 1 }).lean();

    for (const s of directSales) {
      if (!voucherSaleIds.has(s._id.toString())) {
        // Not already covered by a voucher — add directly
        receiptSide.push({
          date:          s.invoiceDate,
          voucherNumber: s.invoiceNumber,
          voucherType:   'Sale',
          particulars:   s.partyName || 'Walk-in Customer',
          amount:        s.paidAmount,
          account:       s.paymentMode || 'Cash',
          referenceType: 'BusinessSales',
          referenceId:   s._id
        });
      }
    }

    // Sale Returns (refunds) always go to payment side
    const saleReturns = await BusinessSales.find({
      companyId,
      invoiceType: 'Sale Return',
      invoiceDate: { $gte: startDate, $lte: endDate },
      paymentMode: { $in: CASH_MODES },
      paidAmount: { $gt: 0 }
    }).sort({ invoiceDate: 1 }).lean();

    for (const sr of saleReturns) {
      paymentSide.push({
        date:          sr.invoiceDate,
        voucherNumber: sr.invoiceNumber,
        voucherType:   'Sale Return',
        particulars:   sr.partyName || 'Customer',
        amount:        sr.paidAmount,
        account:       sr.paymentMode || 'Cash',
        referenceType: 'SalesReturn',
        referenceId:   sr._id
      });
    }

    // ── 5. Sort both sides chronologically ──
    receiptSide.sort((a, b) => new Date(a.date) - new Date(b.date));
    paymentSide.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalReceipts = receiptSide.reduce((s, r) => s + r.amount, 0);
    const totalPayments = paymentSide.reduce((s, p) => s + p.amount, 0);
    const closingBalance = openingBalance + totalReceipts - totalPayments;

    // ── 6. Combined entries with running balance ──
    const allEntries = [
      ...receiptSide.map(r => ({ ...r, debitAmount: r.amount, creditAmount: 0 })),
      ...paymentSide.map(p => ({ ...p, debitAmount: 0, creditAmount: p.amount }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let running = openingBalance;
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
          openingBalance,
          closingBalance,
          totalReceipts,
          totalPayments,
          netChange: closingBalance - openingBalance,
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

    // ===== OPENING & CLOSING STOCK — aggregation replaces N*4 individual queries =====
    const taItems = await BusinessItem.find({ status: 'Active', companyId: req.companyId })
      .select('_id purchasePrice costPrice').lean();
    const taPriceMap = new Map(taItems.map(i => [i._id.toString(), i.purchasePrice || i.costPrice || 0]));

    const [taOpenAgg, taCloseAgg] = await Promise.all([
      BusinessStockTransaction.aggregate([
        { $match: { companyId: req.companyId, date: { $lt: startDate } } },
        { $group: { _id: '$itemId',
          qtyIn:  { $sum: { $cond: [{ $eq: ['$transactionType', 'Stock In']  }, '$quantity', 0] } },
          qtyOut: { $sum: { $cond: [{ $eq: ['$transactionType', 'Stock Out'] }, '$quantity', 0] } }
        }}
      ]),
      BusinessStockTransaction.aggregate([
        { $match: { companyId: req.companyId, date: { $lte: endDate } } },
        { $group: { _id: '$itemId',
          qtyIn:  { $sum: { $cond: [{ $eq: ['$transactionType', 'Stock In']  }, '$quantity', 0] } },
          qtyOut: { $sum: { $cond: [{ $eq: ['$transactionType', 'Stock Out'] }, '$quantity', 0] } }
        }}
      ])
    ]);

    let openingStock = 0;
    taOpenAgg.forEach(row => {
      const price = taPriceMap.get(row._id?.toString()) || 0;
      openingStock += Math.max(0, row.qtyIn - row.qtyOut) * price;
    });

    let closingStock = 0;
    taCloseAgg.forEach(row => {
      const price = taPriceMap.get(row._id?.toString()) || 0;
      closingStock += Math.max(0, row.qtyIn - row.qtyOut) * price;
    });

    // ===== PURCHASES =====
    const purchaseTransactions = await BusinessStockTransaction.find({
      transactionType: 'Stock In',
      referenceType: 'Purchase',
      date: { $gte: startDate, $lte: endDate },
      companyId: req.companyId
    });
    let totalPurchases = 0;
    purchaseTransactions.forEach(tx => {
      totalPurchases += tx.totalAmount || ((tx.quantity || 0) * (tx.rate || 0));
    });

    // Purchase Returns - from PurchaseReturn model
    const purchaseReturnDocs = await PurchaseReturn.find({
      returnDate: { $gte: startDate, $lte: endDate },
      status: 'Active',
      companyId: req.companyId
    });
    const purchaseReturnAmount = purchaseReturnDocs.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

    // ===== SALES =====
    const sales = await BusinessSales.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      invoiceType: 'Sale',
      companyId: req.companyId
    });
    const totalSales = sales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    // Sales Returns - from SalesReturn model
    const salesReturnDocs = await SalesReturn.find({
      returnDate: { $gte: startDate, $lte: endDate },
      status: 'Active',
      companyId: req.companyId
    });
    const totalSalesReturn = salesReturnDocs.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

    // ===== DIRECT EXPENSES (from BusinessLedger + BusinessVoucher) =====
    const directExpenseLedgers = await BusinessLedger.find({
      status: 'Active',
      companyId: req.companyId,
      group: 'Direct Expenses'
    }).lean();

    let totalDirectExpenses = 0;
    const directExpenseItems = [];

    if (directExpenseLedgers.length > 0) {
      const ledgerIds = directExpenseLedgers.map(l => l._id);
      const deAgg = await BusinessVoucher.aggregate([
        {
          $match: {
            companyId: req.companyId,
            date: { $gte: startDate, $lte: endDate },
            status: 'Posted',
            'entries.ledgerId': { $in: ledgerIds }
          }
        },
        { $unwind: '$entries' },
        {
          $match: {
            'entries.ledgerId': { $in: ledgerIds },
            'entries.type': 'debit'
          }
        },
        {
          $group: {
            _id: '$entries.ledgerId',
            amount: { $sum: '$entries.amount' }
          }
        }
      ]);

      const ledgerNameMap = new Map(directExpenseLedgers.map(l => [l._id.toString(), l.name]));
      for (const row of deAgg) {
        if (row.amount > 0) {
          directExpenseItems.push({ name: ledgerNameMap.get(row._id.toString()) || 'Expense', amount: row.amount });
          totalDirectExpenses += row.amount;
        }
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

/**
 * Vyapar R&D (Receipt & Disbursement) Report - Private Firm
 * GET /api/reports/vyapar/rd
 * Cash Book style: receipts (cash/bank in) + disbursements (cash/bank out) + opening/closing balance
 */
export const getVyaparRD = async (req, res) => {
  try {
    const { filterType, customStart, customEnd } = req.query;
    const companyId = req.companyId;
    const { startDate, endDate } = getDateRange(filterType || 'thisMonth', customStart, customEnd);

    // Get Cash/Bank ledgers for this company
    const cashBankLedgers = await BusinessLedger.find({
      companyId,
      group: { $in: ['Cash-in-Hand', 'Bank Accounts'] },
      status: 'Active'
    }).lean();
    const cashBankIds = cashBankLedgers.map(l => l._id);

    // Opening balance = cumulative Cash/Bank Dr - Cr before startDate
    const openingAgg = await BusinessVoucher.aggregate([
      { $match: { companyId, date: { $lt: startDate }, status: 'Posted' } },
      { $unwind: '$entries' },
      { $match: { 'entries.ledgerId': { $in: cashBankIds } } },
      { $group: {
        _id: null,
        dr: { $sum: { $cond: [{ $eq: ['$entries.type', 'debit']  }, '$entries.amount', 0] } },
        cr: { $sum: { $cond: [{ $eq: ['$entries.type', 'credit'] }, '$entries.amount', 0] } }
      }}
    ]);
    const openingBalance = openingAgg.length > 0
      ? openingAgg[0].dr - openingAgg[0].cr : 0;

    // Period vouchers that touch Cash/Bank
    const vouchers = await BusinessVoucher.find({
      companyId,
      date: { $gte: startDate, $lte: endDate },
      status: 'Posted'
    }).lean();

    const cashBankIdSet = new Set(cashBankIds.map(id => id.toString()));
    const receipts = [];
    const disbursements = [];

    for (const v of vouchers) {
      for (const entry of v.entries) {
        if (!cashBankIdSet.has(entry.ledgerId?.toString())) continue;

        // Contra entry name = what the money is for
        const contra = v.entries.find(e =>
          e.ledgerId?.toString() !== entry.ledgerId?.toString() &&
          !e.isGSTLine && !e.isStockLine
        ) || v.entries.find(e => e.ledgerId?.toString() !== entry.ledgerId?.toString());

        const row = {
          date: v.date,
          voucherNumber: v.voucherNumber,
          voucherType: v.voucherType,
          particulars: v.partyName || contra?.ledgerName || v.narration || v.voucherType,
          narration: v.narration || '',
          amount: entry.amount
        };

        if (entry.type === 'debit') {
          receipts.push(row);
        } else {
          disbursements.push(row);
        }
      }
    }

    // Sort by date
    receipts.sort((a, b) => new Date(a.date) - new Date(b.date));
    disbursements.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0);
    const totalDisbursements = disbursements.reduce((s, r) => s + r.amount, 0);
    const closingBalance = openingBalance + totalReceipts - totalDisbursements;

    res.json({
      success: true,
      data: {
        openingBalance,
        receipts,
        disbursements,
        totalReceipts,
        totalDisbursements,
        closingBalance,
        filters: { filterType, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error in getVyaparRD:', error);
    res.status(500).json({ success: false, message: 'Failed to generate R&D report', error: error.message });
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
  getVyaparTradingAccount,
  getVyaparRD
};
