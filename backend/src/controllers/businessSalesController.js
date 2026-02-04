import BusinessSales from '../models/BusinessSales.js';
import BusinessItem from '../models/BusinessItem.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import Customer from '../models/Customer.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';

// Generate Invoice Number
const generateInvoiceNumber = async (prefix = 'INV') => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  const lastSale = await BusinessSales.findOne({
    invoiceNumber: { $regex: `^${prefix}${year}${month}` }
  }).sort({ invoiceNumber: -1 });

  let sequence = 1;
  if (lastSale) {
    const lastSequence = parseInt(lastSale.invoiceNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
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
      previousBalance
    } = req.body;

    // Generate invoice number
    const prefix = invoiceType === 'Sale Return' ? 'SRN' :
                   invoiceType === 'Estimate' ? 'EST' :
                   invoiceType === 'Delivery Challan' ? 'DC' :
                   invoiceType === 'Proforma' ? 'PI' : 'INV';
    const invoiceNumber = await generateInvoiceNumber(prefix);

    // Calculate totals
    let totalQty = 0;
    let grossAmount = 0;
    let itemDiscount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const processedItems = [];

    for (const item of items) {
      const businessItem = await BusinessItem.findById(item.itemId);
      if (!businessItem) {
        return res.status(404).json({ message: `Item not found: ${item.itemId}` });
      }

      // Check stock availability (skip for returns)
      if (invoiceType !== 'Sale Return' && item.quantity > businessItem.currentBalance) {
        return res.status(400).json({
          message: `Insufficient stock for ${businessItem.itemName}. Available: ${businessItem.currentBalance}`
        });
      }

      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || businessItem.salesRate || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const gstPercent = parseFloat(item.gstPercent) || businessItem.gstPercent || 0;

      const amount = qty * rate;
      const discountAmount = (amount * discountPercent) / 100;
      const taxable = amount - discountAmount;

      // Calculate GST (split into CGST/SGST for same state, IGST for different)
      const isInterState = partyState && partyState !== 'Tamil Nadu'; // Assuming business is in TN
      let cgst = 0, sgst = 0, igst = 0;

      if (isInterState) {
        igst = (taxable * gstPercent) / 100;
      } else {
        cgst = (taxable * gstPercent) / 200;
        sgst = (taxable * gstPercent) / 200;
      }

      const totalAmount = taxable + cgst + sgst + igst;

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

    // Determine payment status
    let paymentStatus = 'Unpaid';
    if (paid >= totalDue) {
      paymentStatus = 'Paid';
    } else if (paid > 0) {
      paymentStatus = 'Partial';
    }

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
      businessType: 'Private Firm'
    });

    await sale.save();

    // Update stock for each item (skip for estimates/proforma)
    if (invoiceType === 'Sale' || invoiceType === 'Sale Return') {
      for (const item of processedItems) {
        const businessItem = await BusinessItem.findById(item.itemId);
        const totalQtyWithFree = item.quantity + (item.freeQty || 0);

        if (invoiceType === 'Sale') {
          // Reduce stock for sales
          businessItem.currentBalance -= totalQtyWithFree;
        } else {
          // Increase stock for returns
          businessItem.currentBalance += totalQtyWithFree;
        }
        await businessItem.save();

        // Create stock transaction
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

    // Create accounting voucher (for Sales only)
    if (invoiceType === 'Sale' && grandTotal > 0) {
      try {
        // Find or create necessary ledgers
        let salesLedger = await Ledger.findOne({ name: 'Sales Account' });
        if (!salesLedger) {
          salesLedger = await Ledger.create({
            name: 'Sales Account',
            code: 'SALES',
            group: 'Sales Accounts',
            type: 'Income',
            openingBalance: 0,
            currentBalance: 0
          });
        }

        let partyLedger = null;
        if (partyId) {
          const customer = await Customer.findById(partyId);
          if (customer && customer.ledgerId) {
            partyLedger = await Ledger.findById(customer.ledgerId);
          }
        }

        if (!partyLedger) {
          partyLedger = await Ledger.findOne({ name: 'Cash Account' });
          if (!partyLedger) {
            partyLedger = await Ledger.create({
              name: 'Cash Account',
              code: 'CASH',
              group: 'Cash-in-Hand',
              type: 'Asset',
              openingBalance: 0,
              currentBalance: 0
            });
          }
        }

        // Create voucher entries
        const voucherEntries = [
          {
            ledgerId: partyLedger._id,
            ledgerName: partyLedger.name,
            type: 'debit',
            amount: grandTotal
          },
          {
            ledgerId: salesLedger._id,
            ledgerName: salesLedger.name,
            type: 'credit',
            amount: taxableAmount - calculatedBillDiscount
          }
        ];

        // Add GST entries if applicable
        if (totalCgst > 0) {
          let cgstLedger = await Ledger.findOne({ name: 'CGST Payable' });
          if (!cgstLedger) {
            cgstLedger = await Ledger.create({
              name: 'CGST Payable',
              code: 'CGST-PAY',
              group: 'Duties & Taxes',
              type: 'Liability',
              openingBalance: 0,
              currentBalance: 0
            });
          }
          voucherEntries.push({
            ledgerId: cgstLedger._id,
            ledgerName: cgstLedger.name,
            type: 'credit',
            amount: totalCgst
          });
        }

        if (totalSgst > 0) {
          let sgstLedger = await Ledger.findOne({ name: 'SGST Payable' });
          if (!sgstLedger) {
            sgstLedger = await Ledger.create({
              name: 'SGST Payable',
              code: 'SGST-PAY',
              group: 'Duties & Taxes',
              type: 'Liability',
              openingBalance: 0,
              currentBalance: 0
            });
          }
          voucherEntries.push({
            ledgerId: sgstLedger._id,
            ledgerName: sgstLedger.name,
            type: 'credit',
            amount: totalSgst
          });
        }

        if (totalIgst > 0) {
          let igstLedger = await Ledger.findOne({ name: 'IGST Payable' });
          if (!igstLedger) {
            igstLedger = await Ledger.create({
              name: 'IGST Payable',
              code: 'IGST-PAY',
              group: 'Duties & Taxes',
              type: 'Liability',
              openingBalance: 0,
              currentBalance: 0
            });
          }
          voucherEntries.push({
            ledgerId: igstLedger._id,
            ledgerName: igstLedger.name,
            type: 'credit',
            amount: totalIgst
          });
        }

        const voucher = new Voucher({
          voucherNumber: `SV-${invoiceNumber}`,
          voucherType: 'Sales',
          date: invoiceDate || new Date(),
          entries: voucherEntries,
          narration: `Sales Invoice ${invoiceNumber} - ${partyName || 'Walk-in Customer'}`,
          referenceType: 'BusinessSales',
          referenceId: sale._id
        });
        await voucher.save();

        // Update ledger balances
        for (const entry of voucherEntries) {
          const ledger = await Ledger.findById(entry.ledgerId);
          if (ledger) {
            if (entry.type === 'debit') {
              ledger.currentBalance += entry.amount;
            } else {
              ledger.currentBalance -= entry.amount;
            }
            await ledger.save();
          }
        }

        sale.voucherId = voucher._id;
        sale.ledgerEntries.push(voucher._id);
        await sale.save();
      } catch (voucherError) {
        console.error('Voucher creation error:', voucherError);
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

    const query = {};

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } },
        { partyPhone: { $regex: search, $options: 'i' } }
      ];
    }

    if (invoiceType) {
      query.invoiceType = invoiceType;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (partyId) {
      query.partyId = partyId;
    }

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) {
        query.invoiceDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.invoiceDate.$lte = new Date(endDate);
      }
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

      // Delete old stock transactions
      await BusinessStockTransaction.deleteMany({
        referenceType: sale.invoiceType === 'Sale' ? 'Sale' : 'Return',
        referenceId: sale._id
      });
    }

    // Process new items (similar to create)
    const { items, ...updateData } = req.body;

    if (items && items.length > 0) {
      let totalQty = 0;
      let grossAmount = 0;
      let itemDiscount = 0;
      let taxableAmount = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

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
          itemId: item.itemId,
          itemCode: businessItem.itemCode,
          itemName: businessItem.itemName,
          hsnCode: businessItem.hsnCode,
          quantity: qty,
          freeQty: parseFloat(item.freeQty) || 0,
          unit: businessItem.unit,
          mrp: businessItem.mrp || 0,
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

        // Update stock
        if (sale.invoiceType === 'Sale' || sale.invoiceType === 'Sale Return') {
          const totalQtyWithFree = qty + (parseFloat(item.freeQty) || 0);
          if (sale.invoiceType === 'Sale') {
            businessItem.currentBalance -= totalQtyWithFree;
          } else {
            businessItem.currentBalance += totalQtyWithFree;
          }
          await businessItem.save();

          const stockTransaction = new BusinessStockTransaction({
            itemId: item.itemId,
            transactionType: sale.invoiceType === 'Sale' ? 'Stock Out' : 'Stock In',
            quantity: totalQtyWithFree,
            rate,
            balanceAfter: businessItem.currentBalance,
            referenceType: sale.invoiceType === 'Sale' ? 'Sale' : 'Return',
            referenceId: sale._id,
            date: updateData.invoiceDate || sale.invoiceDate,
            notes: `${sale.invoiceType} - ${sale.invoiceNumber} (Updated)`
          });
          await stockTransaction.save();
        }
      }

      const totalGst = totalCgst + totalSgst + totalIgst;
      const calculatedBillDiscount = updateData.billDiscountPercent
        ? (taxableAmount * updateData.billDiscountPercent) / 100
        : (parseFloat(updateData.billDiscount) || 0);

      const netAmount = taxableAmount - calculatedBillDiscount + totalGst;
      const finalRoundOff = parseFloat(updateData.roundOff) || (Math.round(netAmount) - netAmount);
      const grandTotal = netAmount + finalRoundOff;

      const prevBalance = parseFloat(updateData.previousBalance) || 0;
      const totalDue = grandTotal + prevBalance;
      const paid = parseFloat(updateData.paidAmount) || 0;
      const balance = totalDue - paid;

      let paymentStatus = 'Unpaid';
      if (paid >= totalDue) {
        paymentStatus = 'Paid';
      } else if (paid > 0) {
        paymentStatus = 'Partial';
      }

      Object.assign(sale, {
        ...updateData,
        items: processedItems,
        totalQty,
        grossAmount,
        itemDiscount,
        billDiscount: calculatedBillDiscount,
        taxableAmount,
        totalCgst,
        totalSgst,
        totalIgst,
        totalGst,
        roundOff: finalRoundOff,
        grandTotal,
        previousBalance: prevBalance,
        totalDue,
        paymentStatus,
        paidAmount: paid,
        balanceAmount: balance
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

    // Reverse stock for each item
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

      // Delete stock transactions
      await BusinessStockTransaction.deleteMany({
        referenceId: sale._id
      });
    }

    // Delete voucher if exists
    if (sale.voucherId) {
      await Voucher.findByIdAndDelete(sale.voucherId);
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
      invoiceType: 'Sale'
    })
    .select('invoiceNumber invoiceDate grandTotal paidAmount balanceAmount paymentStatus')
    .sort({ invoiceDate: -1 });

    const totalBalance = sales.reduce((sum, sale) => sum + (sale.balanceAmount || 0), 0);

    res.json({
      sales,
      totalBalance
    });
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

    const matchQuery = Object.keys(dateFilter).length > 0
      ? { invoiceDate: dateFilter, invoiceType: 'Sale' }
      : { invoiceType: 'Sale' };

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
        totalSales: 0,
        totalPaid: 0,
        totalBalance: 0,
        totalInvoices: 0,
        totalItems: 0
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
