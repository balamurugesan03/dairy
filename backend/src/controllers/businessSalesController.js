import BusinessSales from '../models/BusinessSales.js';
import BusinessItem from '../models/BusinessItem.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import BusinessVoucher from '../models/BusinessVoucher.js';
import BusinessLedger from '../models/BusinessLedger.js';
import {
  generateBusinessVoucherNumber,
  applyLedgerBalanceChange
} from './businessAccountingController.js';

// Generate Invoice Number
const generateInvoiceNumber = async (prefix = 'INV', companyId = null) => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  const query = { invoiceNumber: { $regex: `^${prefix}${year}${month}` } };
  if (companyId) query.companyId = companyId;

  const lastSale = await BusinessSales.findOne(query).sort({ invoiceNumber: -1 });

  let sequence = 1;
  if (lastSale) {
    const lastSequence = parseInt(lastSale.invoiceNumber.slice(-4));
    if (!isNaN(lastSequence)) sequence = lastSequence + 1;
  }

  return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
};

// Find or create a system ledger in BusinessLedger
const getOrCreateBusinessLedger = async (name, group, type, companyId) => {
  let ledger = await BusinessLedger.findOne({ name, companyId, status: 'Active' });
  if (!ledger) {
    ledger = new BusinessLedger({ name, group, type, companyId, businessType: 'Private Firm' });
    await ledger.save();
  }
  return ledger;
};

// Create Business Sale
export const createBusinessSale = async (req, res) => {
  try {
    const {
      invoiceDate,
      invoiceType,
      partyId,
      partyName,
      partyPhone,
      partyAddress,
      partyGstin,
      partyState,
      items,
      billDiscount,
      billDiscountPercent,
      roundOff,
      paymentMode,
      paidAmount,
      bankName,
      chequeNumber,
      chequeDate,
      transactionId,
      poNumber,
      poDate,
      ewaybillNumber,
      vehicleNumber,
      transportName,
      lrNumber,
      notes,
      termsAndConditions,
      previousBalance,
      salesmanId,
      salesmanName
    } = req.body;

    const companyId = req.companyId;

    // Generate invoice number
    const prefix = invoiceType === 'Sale Return' ? 'SRN' :
                   invoiceType === 'Estimate' ? 'EST' :
                   invoiceType === 'Delivery Challan' ? 'DC' :
                   invoiceType === 'Proforma' ? 'PI' : 'INV';
    const invoiceNumber = await generateInvoiceNumber(prefix, companyId);

    // Calculate totals
    let totalQty = 0;
    let grossAmount = 0;
    let itemDiscount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCOGS = 0;

    const processedItems = [];

    for (const item of items) {
      const businessItem = await BusinessItem.findById(item.itemId);
      if (!businessItem) {
        return res.status(404).json({ message: `Item not found: ${item.itemId}` });
      }

      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || businessItem.salesRate || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const gstPercent = parseFloat(item.gstPercent) || businessItem.gstPercent || 0;

      const amount = qty * rate;
      const discountAmount = (amount * discountPercent) / 100;
      const taxable = amount - discountAmount;

      // IGST for inter-state, CGST+SGST for intra-state
      const isInterState = partyState && partyState !== 'Tamil Nadu';
      let cgst = 0, sgst = 0, igst = 0;

      if (isInterState) {
        igst = (taxable * gstPercent) / 100;
      } else {
        cgst = (taxable * gstPercent) / 200;
        sgst = (taxable * gstPercent) / 200;
      }

      const totalAmount = taxable + cgst + sgst + igst;

      // COGS = purchase price × qty (perpetual inventory)
      const costPrice = businessItem.purchasePrice || 0;
      totalCOGS += costPrice * qty;

      processedItems.push({
        itemId: item.itemId,
        itemCode: businessItem.itemCode,
        itemName: businessItem.itemName,
        hsnCode: businessItem.hsnCode || item.hsnCode,
        quantity: qty,
        freeQty: parseFloat(item.freeQty) || 0,
        unit: businessItem.unit || item.unit,
        mrp: businessItem.mrp || item.mrp || 0,
        rate,
        discountPercent,
        discountAmount,
        taxableAmount: taxable,
        gstPercent,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount
      });

      totalQty += qty;
      grossAmount += amount;
      itemDiscount += discountAmount;
      taxableAmount += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
    }

    const totalGst = totalCgst + totalSgst + totalIgst;
    const calculatedBillDiscount = billDiscountPercent
      ? (taxableAmount * billDiscountPercent) / 100
      : (parseFloat(billDiscount) || 0);

    const netAmount = taxableAmount - calculatedBillDiscount + totalGst;
    const finalRoundOff = parseFloat(roundOff) || (Math.round(netAmount) - netAmount);
    const grandTotal = netAmount + finalRoundOff;

    const prevBalance = parseFloat(previousBalance) || 0;
    const totalDue = grandTotal + prevBalance;
    const paid = parseFloat(paidAmount) || 0;
    const balance = totalDue - paid;

    let paymentStatus = 'Unpaid';
    if (paid >= totalDue) paymentStatus = 'Paid';
    else if (paid > 0) paymentStatus = 'Partial';

    // Create sale record
    const sale = new BusinessSales({
      invoiceNumber,
      invoiceDate: invoiceDate || new Date(),
      invoiceType: invoiceType || 'Sale',
      partyId: partyId || null,
      partyName,
      partyPhone,
      partyAddress,
      partyGstin,
      partyState,
      items: processedItems,
      totalQty,
      grossAmount,
      itemDiscount,
      billDiscount: calculatedBillDiscount,
      billDiscountPercent: parseFloat(billDiscountPercent) || 0,
      taxableAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      roundOff: finalRoundOff,
      grandTotal,
      previousBalance: prevBalance,
      totalDue,
      paymentMode: paymentMode || 'Cash',
      paymentStatus,
      paidAmount: paid,
      balanceAmount: balance,
      bankName,
      chequeNumber,
      chequeDate,
      transactionId,
      poNumber,
      poDate,
      ewaybillNumber,
      vehicleNumber,
      transportName,
      lrNumber,
      notes,
      termsAndConditions,
      salesmanId: salesmanId || null,
      salesmanName: salesmanName || '',
      businessType: 'Private Firm',
      companyId
    });

    await sale.save();

    // Update stock for each item (skip for estimates/proforma)
    if (invoiceType === 'Sale' || invoiceType === 'Sale Return') {
      for (const item of processedItems) {
        const businessItem = await BusinessItem.findById(item.itemId);
        const totalQtyWithFree = item.quantity + (item.freeQty || 0);

        if (invoiceType === 'Sale') {
          businessItem.currentBalance -= totalQtyWithFree;
        } else {
          businessItem.currentBalance += totalQtyWithFree;
        }
        await businessItem.save();

        const stockTransaction = new BusinessStockTransaction({
          itemId: item.itemId,
          transactionType: invoiceType === 'Sale' ? 'Stock Out' : 'Stock In',
          quantity: totalQtyWithFree,
          rate: item.rate,
          balanceAfter: businessItem.currentBalance,
          referenceType: invoiceType === 'Sale' ? 'Sale' : 'Return',
          referenceId: sale._id,
          date: invoiceDate || new Date(),
          notes: `${invoiceType} - ${invoiceNumber} to ${partyName || 'Walk-in'}`
        });
        await stockTransaction.save();
      }
    }

    // ── Accounting Voucher (BusinessVoucher, not Voucher) ──
    if (invoiceType === 'Sale' && grandTotal > 0) {
      try {
        // Resolve all required BusinessLedger accounts
        const salesLedger = await getOrCreateBusinessLedger(
          'Business Sales', 'Sales Accounts', 'Income', companyId
        );
        const cogsLedger = await getOrCreateBusinessLedger(
          'Cost of Goods Sold', 'Direct Expenses', 'Expense', companyId
        );
        const stockLedger = await getOrCreateBusinessLedger(
          'Stock In Hand', 'Stock-in-Hand', 'Asset', companyId
        );

        const effectivePaymentMode = paymentMode || 'Cash';
        const voucherEntries = [];

        // ── Debit side: who pays us ──
        if (effectivePaymentMode === 'Cash' || effectivePaymentMode === 'UPI' || effectivePaymentMode === 'Card') {
          // Fully cash/digital — debit cash ledger
          const cashLedger = await BusinessLedger.findOne({
            group: 'Cash-in-Hand', status: 'Active', companyId
          });
          if (cashLedger && paid > 0) {
            voucherEntries.push({ ledgerId: cashLedger._id, ledgerName: cashLedger.name, type: 'debit', amount: paid });
          }
          if (balance > 0) {
            // Remaining goes to Sundry Debtors (walkthrough or partial credit)
            const debtorLedger = partyId
              ? await BusinessLedger.findOne({ 'partyDetails._id': partyId, companyId })
              : null;
            const fallbackDebtor = await getOrCreateBusinessLedger(
              partyName || 'Sundry Debtors', 'Sundry Debtors', 'Asset', companyId
            );
            const dl = debtorLedger || fallbackDebtor;
            voucherEntries.push({ ledgerId: dl._id, ledgerName: dl.name, type: 'debit', amount: balance });
          }
        } else if (effectivePaymentMode === 'Bank' || effectivePaymentMode === 'Cheque') {
          const bankLedger = await BusinessLedger.findOne({
            group: 'Bank Accounts', status: 'Active', companyId
          });
          if (bankLedger && paid > 0) {
            voucherEntries.push({ ledgerId: bankLedger._id, ledgerName: bankLedger.name, type: 'debit', amount: paid });
          }
          if (balance > 0) {
            const fallbackDebtor = await getOrCreateBusinessLedger(
              partyName || 'Sundry Debtors', 'Sundry Debtors', 'Asset', companyId
            );
            voucherEntries.push({ ledgerId: fallbackDebtor._id, ledgerName: fallbackDebtor.name, type: 'debit', amount: balance });
          }
        } else {
          // Credit sale — full amount to debtor
          const debtorLedger = await getOrCreateBusinessLedger(
            partyName || 'Sundry Debtors', 'Sundry Debtors', 'Asset', companyId
          );
          voucherEntries.push({ ledgerId: debtorLedger._id, ledgerName: debtorLedger.name, type: 'debit', amount: grandTotal });
        }

        // ── Credit side: revenue + GST output ──
        const netSalesAmount = taxableAmount - calculatedBillDiscount + finalRoundOff;
        voucherEntries.push({
          ledgerId: salesLedger._id, ledgerName: salesLedger.name,
          type: 'credit', amount: netSalesAmount
        });

        if (totalCgst > 0) {
          const cgstLedger = await getOrCreateBusinessLedger('CGST Output', 'Duties & Taxes', 'Liability', companyId);
          voucherEntries.push({
            ledgerId: cgstLedger._id, ledgerName: cgstLedger.name,
            type: 'credit', amount: totalCgst,
            isGSTLine: true, gstComponent: 'CGST'
          });
        }
        if (totalSgst > 0) {
          const sgstLedger = await getOrCreateBusinessLedger('SGST Output', 'Duties & Taxes', 'Liability', companyId);
          voucherEntries.push({
            ledgerId: sgstLedger._id, ledgerName: sgstLedger.name,
            type: 'credit', amount: totalSgst,
            isGSTLine: true, gstComponent: 'SGST'
          });
        }
        if (totalIgst > 0) {
          const igstLedger = await getOrCreateBusinessLedger('IGST Output', 'Duties & Taxes', 'Liability', companyId);
          voucherEntries.push({
            ledgerId: igstLedger._id, ledgerName: igstLedger.name,
            type: 'credit', amount: totalIgst,
            isGSTLine: true, gstComponent: 'IGST'
          });
        }

        // ── COGS entry — Dr COGS / Cr Stock (perpetual inventory) ──
        if (totalCOGS > 0) {
          voucherEntries.push({
            ledgerId: cogsLedger._id, ledgerName: cogsLedger.name,
            type: 'debit', amount: totalCOGS,
            isStockLine: true
          });
          voucherEntries.push({
            ledgerId: stockLedger._id, ledgerName: stockLedger.name,
            type: 'credit', amount: totalCOGS,
            isStockLine: true
          });
        }

        // Validate balance before saving
        const checkDebit = voucherEntries.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0);
        const checkCredit = voucherEntries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0);

        if (Math.abs(checkDebit - checkCredit) <= 0.01 && voucherEntries.length >= 2) {
          const voucherNumber = await generateBusinessVoucherNumber('Sales', companyId);

          const voucher = new BusinessVoucher({
            voucherNumber,
            voucherType: 'Sales',
            date: invoiceDate ? new Date(invoiceDate) : new Date(),
            entries: voucherEntries,
            totalDebit: checkDebit,
            totalCredit: checkCredit,
            narration: `Business Sales Invoice ${invoiceNumber} — ${partyName || 'Walk-in Customer'}`,
            referenceType: 'BusinessSales',
            referenceId: sale._id,
            referenceNumber: invoiceNumber,
            partyId: partyId || null,
            partyName: partyName || '',
            status: 'Posted',
            businessType: 'Private Firm',
            companyId
          });
          await voucher.save();

          // Update BusinessLedger balances — nature-aware
          for (const entry of voucherEntries) {
            const ledger = await BusinessLedger.findById(entry.ledgerId);
            if (!ledger) continue;
            applyLedgerBalanceChange(ledger, entry.type, entry.amount);
            await ledger.save();
          }

          sale.voucherId = voucher._id;
          if (sale.ledgerEntries) sale.ledgerEntries.push(voucher._id);
          await sale.save();
        } else {
          console.warn(`Sales voucher skipped — imbalanced: Dr=${checkDebit} Cr=${checkCredit}`);
        }
      } catch (voucherError) {
        console.error('Business sales voucher creation error:', voucherError.message);
        // Non-fatal — sale record is already saved
      }
    }

    res.status(201).json(sale);
  } catch (error) {
    console.error('Create business sale error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get All Business Sales
export const getAllBusinessSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      invoiceType,
      paymentStatus,
      startDate,
      endDate,
      partyId
    } = req.query;

    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } },
        { partyPhone: { $regex: search, $options: 'i' } }
      ];
    }
    if (invoiceType) query.invoiceType = invoiceType;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (partyId) query.partyId = partyId;
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sales, total] = await Promise.all([
      BusinessSales.find(query)
        .populate('partyId', 'name phone customerId')
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BusinessSales.countDocuments(query)
    ]);

    res.json({
      data: sales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all business sales error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Business Sale by ID
export const getBusinessSaleById = async (req, res) => {
  try {
    const sale = await BusinessSales.findById(req.params.id)
      .populate('partyId', 'name phone customerId address gstNumber')
      .populate('items.itemId', 'itemName itemCode hsnCode unit');

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Get business sale error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update Business Sale
export const updateBusinessSale = async (req, res) => {
  try {
    const sale = await BusinessSales.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Reverse stock transactions for original items
    if (sale.invoiceType === 'Sale' || sale.invoiceType === 'Sale Return') {
      for (const item of sale.items) {
        const businessItem = await BusinessItem.findById(item.itemId);
        if (businessItem) {
          const totalQtyWithFree = item.quantity + (item.freeQty || 0);
          if (sale.invoiceType === 'Sale') {
            businessItem.currentBalance += totalQtyWithFree;
          } else {
            businessItem.currentBalance -= totalQtyWithFree;
          }
          await businessItem.save();
        }
      }
      await BusinessStockTransaction.deleteMany({
        referenceType: sale.invoiceType === 'Sale' ? 'Sale' : 'Return',
        referenceId: sale._id
      });
    }

    const { items, ...updateData } = req.body;

    if (items && items.length > 0) {
      let totalQty = 0, grossAmount = 0, itemDiscount = 0;
      let taxableAmount = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

      const processedItems = [];

      for (const item of items) {
        const businessItem = await BusinessItem.findById(item.itemId);
        if (!businessItem) continue;

        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || businessItem.salesRate || 0;
        const discountPercent = parseFloat(item.discountPercent) || 0;
        const gstPercent = parseFloat(item.gstPercent) || businessItem.gstPercent || 0;

        const amount = qty * rate;
        const discountAmount = (amount * discountPercent) / 100;
        const taxable = amount - discountAmount;

        const isInterState = updateData.partyState && updateData.partyState !== 'Tamil Nadu';
        let cgst = 0, sgst = 0, igst = 0;
        if (isInterState) {
          igst = (taxable * gstPercent) / 100;
        } else {
          cgst = (taxable * gstPercent) / 200;
          sgst = (taxable * gstPercent) / 200;
        }

        const totalAmount = taxable + cgst + sgst + igst;
        processedItems.push({
          itemId: item.itemId, itemCode: businessItem.itemCode, itemName: businessItem.itemName,
          hsnCode: businessItem.hsnCode, quantity: qty, freeQty: parseFloat(item.freeQty) || 0,
          unit: businessItem.unit, mrp: businessItem.mrp || 0, rate, discountPercent, discountAmount,
          taxableAmount: taxable, gstPercent, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst, totalAmount
        });

        totalQty += qty; grossAmount += amount; itemDiscount += discountAmount;
        taxableAmount += taxable; totalCgst += cgst; totalSgst += sgst; totalIgst += igst;

        if (sale.invoiceType === 'Sale' || sale.invoiceType === 'Sale Return') {
          const totalQtyWithFree = qty + (parseFloat(item.freeQty) || 0);
          if (sale.invoiceType === 'Sale') businessItem.currentBalance -= totalQtyWithFree;
          else businessItem.currentBalance += totalQtyWithFree;
          await businessItem.save();

          await new BusinessStockTransaction({
            itemId: item.itemId,
            transactionType: sale.invoiceType === 'Sale' ? 'Stock Out' : 'Stock In',
            quantity: totalQtyWithFree, rate,
            balanceAfter: businessItem.currentBalance,
            referenceType: sale.invoiceType === 'Sale' ? 'Sale' : 'Return',
            referenceId: sale._id,
            date: updateData.invoiceDate || sale.invoiceDate,
            notes: `${sale.invoiceType} - ${sale.invoiceNumber} (Updated)`
          }).save();
        }
      }

      const totalGst = totalCgst + totalSgst + totalIgst;
      const calcBillDiscount = updateData.billDiscountPercent
        ? (taxableAmount * updateData.billDiscountPercent) / 100
        : (parseFloat(updateData.billDiscount) || 0);
      const netAmount = taxableAmount - calcBillDiscount + totalGst;
      const finalRoundOff = parseFloat(updateData.roundOff) || (Math.round(netAmount) - netAmount);
      const grandTotal = netAmount + finalRoundOff;
      const prevBalance = parseFloat(updateData.previousBalance) || 0;
      const totalDue = grandTotal + prevBalance;
      const paid = parseFloat(updateData.paidAmount) || 0;
      const balance = totalDue - paid;

      let paymentStatus = 'Unpaid';
      if (paid >= totalDue) paymentStatus = 'Paid';
      else if (paid > 0) paymentStatus = 'Partial';

      Object.assign(sale, {
        ...updateData, items: processedItems, totalQty, grossAmount, itemDiscount,
        billDiscount: calcBillDiscount, taxableAmount, totalCgst, totalSgst, totalIgst, totalGst,
        roundOff: finalRoundOff, grandTotal, previousBalance: prevBalance, totalDue,
        paymentStatus, paidAmount: paid, balanceAmount: balance
      });
    } else {
      Object.assign(sale, updateData);
    }

    await sale.save();
    res.json(sale);
  } catch (error) {
    console.error('Update business sale error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete Business Sale
export const deleteBusinessSale = async (req, res) => {
  try {
    const sale = await BusinessSales.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Reverse stock
    if (sale.invoiceType === 'Sale' || sale.invoiceType === 'Sale Return') {
      for (const item of sale.items) {
        const businessItem = await BusinessItem.findById(item.itemId);
        if (businessItem) {
          const totalQtyWithFree = item.quantity + (item.freeQty || 0);
          if (sale.invoiceType === 'Sale') businessItem.currentBalance += totalQtyWithFree;
          else businessItem.currentBalance -= totalQtyWithFree;
          await businessItem.save();
        }
      }
      await BusinessStockTransaction.deleteMany({ referenceId: sale._id });
    }

    // Reverse ledger balances and delete voucher
    if (sale.voucherId) {
      const voucher = await BusinessVoucher.findById(sale.voucherId);
      if (voucher) {
        for (const entry of voucher.entries) {
          const ledger = await BusinessLedger.findById(entry.ledgerId);
          if (!ledger) continue;
          const reverseType = entry.type === 'debit' ? 'credit' : 'debit';
          applyLedgerBalanceChange(ledger, reverseType, entry.amount);
          await ledger.save();
        }
        await BusinessVoucher.findByIdAndDelete(sale.voucherId);
      }
    }

    await BusinessSales.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    console.error('Delete business sale error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Party Sales History
export const getPartySalesHistory = async (req, res) => {
  try {
    const { partyId } = req.params;

    const sales = await BusinessSales.find({
      partyId,
      invoiceType: 'Sale',
      companyId: req.companyId
    })
    .select('invoiceNumber invoiceDate grandTotal paidAmount balanceAmount paymentStatus')
    .sort({ invoiceDate: -1 });

    const totalBalance = sales.reduce((sum, sale) => sum + (sale.balanceAmount || 0), 0);

    res.json({ sales, totalBalance });
  } catch (error) {
    console.error('Get party history error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get Sales Summary/Dashboard
export const getBusinessSalesSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchQuery = {
      invoiceType: 'Sale',
      companyId: req.companyId,
      ...(Object.keys(dateFilter).length > 0 && { invoiceDate: dateFilter })
    };

    const [summary] = await BusinessSales.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalBalance: { $sum: '$balanceAmount' },
          totalInvoices: { $sum: 1 },
          totalItems: { $sum: '$totalQty' }
        }
      }
    ]);

    const recentSales = await BusinessSales.find(matchQuery)
      .populate('partyId', 'name')
      .sort({ invoiceDate: -1 })
      .limit(10);

    res.json({
      summary: summary || {
        totalSales: 0, totalPaid: 0, totalBalance: 0, totalInvoices: 0, totalItems: 0
      },
      recentSales
    });
  } catch (error) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ message: error.message });
  }
};

export default {
  createBusinessSale,
  getAllBusinessSales,
  getBusinessSaleById,
  updateBusinessSale,
  deleteBusinessSale,
  getPartySalesHistory,
  getBusinessSalesSummary
};
