import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Warranty from '../models/Warranty.js';
import Machine from '../models/Machine.js';
import Quotation from '../models/Quotation.js';
import Promotion from '../models/Promotion.js';
import BusinessSales from '../models/BusinessSales.js';
import BusinessItem from '../models/BusinessItem.js';
import BusinessStockTransaction from '../models/BusinessStockTransaction.js';
import { generateInvoiceNumber } from './businessSalesController.js';
import { generateCode } from '../models/Counter.js';

// ─── WARRANTY CONTROLLERS ────────────────────────────────────────────────────

export const createWarranty = async (req, res) => {
  const companyId = req.companyId;
  let { warrantyEndDate, warrantyStartDate, warrantyPeriod } = req.body;
  if (!warrantyEndDate && warrantyStartDate && warrantyPeriod) {
    const start = new Date(warrantyStartDate);
    start.setMonth(start.getMonth() + Number(warrantyPeriod));
    warrantyEndDate = start;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const warrantyNumber = await generateCode('WRT', companyId);
      const warranty = new Warranty({ ...req.body, warrantyNumber, warrantyEndDate, companyId });
      await warranty.save();
      return res.status(201).json({ success: true, message: 'Warranty created successfully', data: warranty });
    } catch (error) {
      if (error.code === 11000 && attempt < 4) continue;
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

export const getAllWarranties = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { status, search, page = 1, limit = 50 } = req.query;

    // Auto-expire warranties past end date
    await Warranty.updateMany(
      { companyId, status: 'Active', warrantyEndDate: { $lt: new Date() } },
      { $set: { status: 'Expired' } }
    );

    const query = { companyId };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { warrantyNumber: { $regex: search, $options: 'i' } },
        { itemName: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [warranties, total] = await Promise.all([
      Warranty.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Warranty.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: warranties,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWarrantyById = async (req, res) => {
  try {
    const warranty = await Warranty.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('itemId', 'itemName category')
      .populate('customerId', 'name phone email');
    if (!warranty) return res.status(404).json({ success: false, message: 'Warranty not found' });
    res.status(200).json({ success: true, data: warranty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateWarranty = async (req, res) => {
  try {
    // Recompute end date if period changed
    let update = { ...req.body };
    if (update.warrantyPeriod && update.warrantyStartDate && !update.warrantyEndDate) {
      const start = new Date(update.warrantyStartDate);
      start.setMonth(start.getMonth() + Number(update.warrantyPeriod));
      update.warrantyEndDate = start;
    }
    const warranty = await Warranty.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      update,
      { new: true, runValidators: true }
    );
    if (!warranty) return res.status(404).json({ success: false, message: 'Warranty not found' });
    res.status(200).json({ success: true, message: 'Warranty updated successfully', data: warranty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteWarranty = async (req, res) => {
  try {
    const warranty = await Warranty.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!warranty) return res.status(404).json({ success: false, message: 'Warranty not found' });
    res.status(200).json({ success: true, message: 'Warranty deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a warranty claim
export const addWarrantyClaim = async (req, res) => {
  try {
    const warranty = await Warranty.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!warranty) return res.status(404).json({ success: false, message: 'Warranty not found' });
    if (warranty.status === 'Expired') return res.status(400).json({ success: false, message: 'Cannot add claim on expired warranty' });

    warranty.claims.push(req.body);
    if (req.body.status === 'Resolved') warranty.status = 'Claimed';
    await warranty.save();
    res.status(200).json({ success: true, message: 'Claim added successfully', data: warranty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a specific claim
export const updateWarrantyClaim = async (req, res) => {
  try {
    const warranty = await Warranty.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!warranty) return res.status(404).json({ success: false, message: 'Warranty not found' });

    const claim = warranty.claims.id(req.params.claimId);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    Object.assign(claim, req.body);
    await warranty.save();
    res.status(200).json({ success: true, message: 'Claim updated successfully', data: warranty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── MACHINE CONTROLLERS ─────────────────────────────────────────────────────

export const createMachine = async (req, res) => {
  const companyId = req.companyId;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const machineCode = await generateCode('MCH', companyId);
      const machine = new Machine({ ...req.body, machineCode, companyId });
      await machine.save();
      return res.status(201).json({ success: true, message: 'Machine created successfully', data: machine });
    } catch (error) {
      if (error.code === 11000 && attempt < 4) continue;
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

export const getAllMachines = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { status, search, category, page = 1, limit = 50 } = req.query;

    const query = { companyId };
    if (status) query.status = status;
    if (category) query.category = { $regex: category, $options: 'i' };
    if (search) {
      query.$or = [
        { machineCode: { $regex: search, $options: 'i' } },
        { machineName: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { assignedTo: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [machines, total] = await Promise.all([
      Machine.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Machine.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: machines,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMachineById = async (req, res) => {
  try {
    const machine = await Machine.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('supplierId', 'name phone')
      .populate('warrantyId', 'warrantyNumber warrantyEndDate status');
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.status(200).json({ success: true, data: machine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMachine = async (req, res) => {
  try {
    const machine = await Machine.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.status(200).json({ success: true, message: 'Machine updated successfully', data: machine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMachine = async (req, res) => {
  try {
    const machine = await Machine.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.status(200).json({ success: true, message: 'Machine deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a maintenance log
export const addMaintenanceLog = async (req, res) => {
  try {
    const machine = await Machine.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });

    machine.maintenanceLogs.push(req.body);
    // Update machine status based on maintenance
    if (req.body.status === 'In Progress') machine.status = 'Under Maintenance';
    else if (req.body.status === 'Completed' && machine.status === 'Under Maintenance') machine.status = 'Active';
    await machine.save();
    res.status(200).json({ success: true, message: 'Maintenance log added', data: machine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a specific maintenance log
export const updateMaintenanceLog = async (req, res) => {
  try {
    const machine = await Machine.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });

    const log = machine.maintenanceLogs.id(req.params.logId);
    if (!log) return res.status(404).json({ success: false, message: 'Maintenance log not found' });

    Object.assign(log, req.body);
    await machine.save();
    res.status(200).json({ success: true, message: 'Maintenance log updated', data: machine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── QUOTATION CONTROLLERS ───────────────────────────────────────────────────

export const createQuotation = async (req, res) => {
  const companyId = req.companyId;
  const validUntil = req.body.validUntil || (() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d;
  })();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const quotationNumber = await generateCode('EST', companyId);
      const quotation = new Quotation({
        ...req.body, quotationNumber, validUntil, companyId, createdBy: req.user?._id
      });
      await quotation.save();
      return res.status(201).json({ success: true, message: 'Quotation created successfully', data: quotation });
    } catch (error) {
      if (error.code === 11000 && attempt < 4) continue;
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

export const getAllQuotations = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { status, search, startDate, endDate, page = 1, limit = 50 } = req.query;

    // Auto-expire quotations
    await Quotation.updateMany(
      { companyId, status: { $in: ['Draft', 'Sent'] }, validUntil: { $lt: new Date() } },
      { $set: { status: 'Expired' } }
    );

    const query = { companyId };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { quotationNumber: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } },
        { partyPhone: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      query.quotationDate = {};
      if (startDate) query.quotationDate.$gte = new Date(startDate);
      if (endDate) { const d = new Date(endDate); d.setHours(23,59,59,999); query.quotationDate.$lte = d; }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [quotations, total] = await Promise.all([
      Quotation.find(query).sort({ quotationDate: -1 }).skip(skip).limit(parseInt(limit)),
      Quotation.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: quotations,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('partyId', 'name phone email address gstin state');
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.status(200).json({ success: true, message: 'Quotation updated successfully', data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.status(200).json({ success: true, message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send Quotation via WhatsApp or Email
export const sendQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const { method, email, phone, customMessage } = req.body;

    // ── WhatsApp ────────────────────────────────────────────────────────────
    if (method === 'whatsapp') {
      const rawPhone = (phone || quotation.partyPhone || '').replace(/\D/g, '');
      if (!rawPhone) return res.status(400).json({ success: false, message: 'Phone number is required for WhatsApp' });

      // Add country code if missing (default India +91)
      const phoneWithCC = rawPhone.startsWith('91') && rawPhone.length === 12 ? rawPhone
        : rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

      const dateStr = new Date(quotation.quotationDate).toLocaleDateString('en-IN');
      const validStr = new Date(quotation.validUntil).toLocaleDateString('en-IN');
      const itemLines = quotation.items
        .map((it, i) => `  ${i + 1}. ${it.itemName} – ${it.quantity} ${it.unit} × ₹${(it.rate || 0).toFixed(2)} = ₹${(it.totalAmount || 0).toFixed(2)}`)
        .join('\n');

      const defaultMsg =
        `Hello ${quotation.partyName || 'Sir/Madam'},\n\n` +
        `Please find your *Quotation / Estimate* details below:\n\n` +
        `📋 *Quotation No:* ${quotation.quotationNumber}\n` +
        `📅 *Date:* ${dateStr}\n` +
        `⏳ *Valid Until:* ${validStr}\n\n` +
        `*Items:*\n${itemLines}\n\n` +
        `💰 *Grand Total: ₹${(quotation.grandTotal || 0).toFixed(2)}*\n\n` +
        (quotation.notes ? `📝 *Notes:* ${quotation.notes}\n\n` : '') +
        `Thank you for your business! 🙏`;

      const text = customMessage || defaultMsg;
      const waUrl = `https://wa.me/${phoneWithCC}?text=${encodeURIComponent(text)}`;

      // Auto-mark as Sent
      if (quotation.status === 'Draft') {
        quotation.status = 'Sent';
        await quotation.save();
      }

      return res.json({ success: true, data: { waUrl }, message: 'WhatsApp link generated' });
    }

    // ── Email ────────────────────────────────────────────────────────────────
    if (method === 'email') {
      const toEmail = email || quotation.partyEmail;
      if (!toEmail) return res.status(400).json({ success: false, message: 'Email address is required' });

      if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
        return res.status(500).json({ success: false, message: 'SMTP not configured. Please update SMTP_USER and SMTP_PASS in .env file.' });
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });

      const dateStr = new Date(quotation.quotationDate).toLocaleDateString('en-IN');
      const validStr = new Date(quotation.validUntil).toLocaleDateString('en-IN');

      const itemsHtml = quotation.items.map((item, i) => `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:8px 6px;">${i + 1}</td>
          <td style="padding:8px 6px;">${item.itemName}${item.itemCode ? `<br/><small style="color:#888">${item.itemCode}</small>` : ''}</td>
          <td style="padding:8px 6px;">${item.hsnCode || '—'}</td>
          <td style="padding:8px 6px;text-align:right;">${item.quantity} ${item.unit}</td>
          <td style="padding:8px 6px;text-align:right;">₹${(item.rate || 0).toFixed(2)}</td>
          <td style="padding:8px 6px;text-align:right;">${item.discountPercent || 0}%</td>
          <td style="padding:8px 6px;text-align:right;">${item.gstPercent || 0}%</td>
          <td style="padding:8px 6px;text-align:right;font-weight:bold;">₹${(item.totalAmount || 0).toFixed(2)}</td>
        </tr>`).join('');

      const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:700px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#1971c2;color:#fff;padding:24px 28px;">
    <h2 style="margin:0 0 4px;">QUOTATION / ESTIMATE</h2>
    <p style="margin:0;opacity:0.85;font-size:14px;">${quotation.quotationNumber}</p>
  </div>
  <div style="padding:24px 28px;">
    <table width="100%" style="margin-bottom:20px;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <strong>Bill To:</strong><br/>
          <span style="font-size:16px;font-weight:bold;">${quotation.partyName || '—'}</span><br/>
          ${quotation.partyPhone ? `📱 ${quotation.partyPhone}<br/>` : ''}
          ${quotation.partyEmail ? `✉️ ${quotation.partyEmail}<br/>` : ''}
          ${quotation.partyAddress ? `📍 ${quotation.partyAddress}<br/>` : ''}
          ${quotation.partyGstin ? `GSTIN: ${quotation.partyGstin}` : ''}
        </td>
        <td style="text-align:right;vertical-align:top;">
          <table>
            <tr><td style="color:#666;padding:2px 0;">Date:</td><td style="padding:2px 0 2px 12px;font-weight:bold;">${dateStr}</td></tr>
            <tr><td style="color:#666;padding:2px 0;">Valid Until:</td><td style="padding:2px 0 2px 12px;font-weight:bold;">${validStr}</td></tr>
          </table>
        </td>
      </tr>
    </table>
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <thead>
        <tr style="background:#f1f3f5;">
          <th style="padding:10px 6px;text-align:left;">#</th>
          <th style="padding:10px 6px;text-align:left;">Item</th>
          <th style="padding:10px 6px;text-align:left;">HSN</th>
          <th style="padding:10px 6px;text-align:right;">Qty</th>
          <th style="padding:10px 6px;text-align:right;">Rate</th>
          <th style="padding:10px 6px;text-align:right;">Disc%</th>
          <th style="padding:10px 6px;text-align:right;">GST%</th>
          <th style="padding:10px 6px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <table style="margin-left:auto;min-width:280px;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:5px 10px;color:#666;">Gross Amount</td><td style="padding:5px 10px;text-align:right;">₹${(quotation.grossAmount || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:5px 10px;color:#666;">Item Discount</td><td style="padding:5px 10px;text-align:right;color:#e03131;">- ₹${(quotation.itemDiscount || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:5px 10px;color:#666;">Bill Discount</td><td style="padding:5px 10px;text-align:right;color:#e03131;">- ₹${(quotation.billDiscount || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:5px 10px;color:#666;">CGST</td><td style="padding:5px 10px;text-align:right;">₹${(quotation.totalCgst || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:5px 10px;color:#666;">SGST</td><td style="padding:5px 10px;text-align:right;">₹${(quotation.totalSgst || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:5px 10px;color:#666;">Round Off</td><td style="padding:5px 10px;text-align:right;">₹${(quotation.roundOff || 0).toFixed(2)}</td></tr>
      <tr style="border-top:2px solid #333;font-size:16px;font-weight:bold;">
        <td style="padding:10px;">Grand Total</td>
        <td style="padding:10px;text-align:right;color:#1971c2;">₹${(quotation.grandTotal || 0).toFixed(2)}</td>
      </tr>
    </table>
    ${quotation.notes ? `<p style="margin-top:20px;"><strong>Notes:</strong> ${quotation.notes}</p>` : ''}
    ${quotation.termsAndConditions ? `<p><strong>Terms & Conditions:</strong> ${quotation.termsAndConditions}</p>` : ''}
    ${customMessage ? `<p style="margin-top:16px;padding:12px;background:#f8f9fa;border-radius:6px;">${customMessage}</p>` : ''}
  </div>
  <div style="background:#f8f9fa;padding:14px 28px;font-size:12px;color:#888;text-align:center;">
    This is a computer-generated quotation.
  </div>
</div>
</body>
</html>`;

      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Dairy Society ERP'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `Quotation ${quotation.quotationNumber} – ₹${(quotation.grandTotal || 0).toFixed(2)}`,
        html: htmlBody
      });

      // Auto-mark as Sent
      if (quotation.status === 'Draft') {
        quotation.status = 'Sent';
        await quotation.save();
      }

      return res.json({ success: true, message: `Email sent successfully to ${toEmail}` });
    }

    return res.status(400).json({ success: false, message: 'Invalid method. Use "email" or "whatsapp"' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Convert Quotation → Business Sales Invoice
export const convertQuotationToInvoice = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (quotation.status === 'Converted') {
      return res.status(400).json({ success: false, message: 'Quotation already converted to invoice' });
    }

    // Generate invoice number (atomic — shared counter with businessSalesController)
    const invoiceNumber = await generateInvoiceNumber('INV', req.companyId);

    const { paymentMode = 'Credit', paidAmount = 0 } = req.body;

    const saleData = {
      invoiceNumber,
      invoiceDate: new Date(),
      invoiceType: 'Tax Invoice',
      partyId: quotation.partyId,
      partyName: quotation.partyName,
      partyOrganization: quotation.partyOrganization,
      partyPhone: quotation.partyPhone,
      partyEmail: quotation.partyEmail,
      partyAddress: quotation.partyAddress,
      partyGstin: quotation.partyGstin,
      partyState: quotation.partyState,
      salesmanId: quotation.salesmanId,
      salesmanName: quotation.salesmanName,
      items: quotation.items,
      totalQty: quotation.totalQty,
      grossAmount: quotation.grossAmount,
      itemDiscount: quotation.itemDiscount,
      billDiscount: quotation.billDiscount,
      billDiscountPercent: quotation.billDiscountPercent,
      taxableAmount: quotation.taxableAmount,
      totalCgst: quotation.totalCgst,
      totalSgst: quotation.totalSgst,
      totalIgst: quotation.totalIgst,
      totalGst: quotation.totalGst,
      roundOff: quotation.roundOff,
      grandTotal: quotation.grandTotal,
      paymentMode,
      paidAmount: Number(paidAmount),
      balanceAmount: quotation.grandTotal - Number(paidAmount),
      paymentStatus: Number(paidAmount) >= quotation.grandTotal ? 'Paid' : Number(paidAmount) > 0 ? 'Partial' : 'Unpaid',
      notes: quotation.notes,
      termsAndConditions: quotation.termsAndConditions,
      companyId: req.companyId
    };

    const sale = new BusinessSales(saleData);
    await sale.save();

    // Update stock for each item
    for (const item of quotation.items) {
      if (item.itemId) {
        const totalQty = item.quantity + (item.freeQty || 0);
        await BusinessItem.findOneAndUpdate(
          { _id: item.itemId, companyId: req.companyId },
          { $inc: { currentBalance: -totalQty } }
        );
        await BusinessStockTransaction.create({
          itemId: item.itemId,
          transactionType: 'Stock Out',
          quantity: totalQty,
          rate: item.rate,
          referenceType: 'Sale',
          referenceId: sale._id,
          invoiceNumber,
          date: new Date(),
          companyId: req.companyId
        });
      }
    }

    // Mark quotation as converted
    quotation.status = 'Converted';
    quotation.convertedToInvoice = { invoiceId: sale._id, invoiceNumber, convertedDate: new Date() };
    await quotation.save();

    res.status(200).json({
      success: true,
      message: 'Quotation converted to invoice successfully',
      data: { quotation, invoice: sale }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PROMOTION CONTROLLERS (kept as-is) ────────────────────────────────────

export const createPromotion = async (req, res) => {
  try {
    const promotion = new Promotion({ ...req.body, companyId: req.companyId });
    await promotion.save();
    res.status(201).json({ success: true, message: 'Promotion created successfully', data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllPromotions = async (req, res) => {
  try {
    const { promotionType = '' } = req.query;
    const query = { companyId: req.companyId };
    if (promotionType) query.promotionType = promotionType;
    const promotions = await Promotion.find(query).sort({ promotionDate: -1 });
    res.status(200).json({ success: true, data: promotions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPromotionById = async (req, res) => {
  try {
    const promotion = await Promotion.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.status(200).json({ success: true, data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true }
    );
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.status(200).json({ success: true, message: 'Promotion updated successfully', data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.status(200).json({ success: true, message: 'Promotion deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
