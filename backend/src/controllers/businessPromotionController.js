import mongoose from 'mongoose';
import BusinessPromotion from '../models/BusinessPromotion.js';
import PromotionRedemption from '../models/PromotionRedemption.js';
import PromotionTemplate from '../models/PromotionTemplate.js';

// ==================== PROMOTION CRUD ====================

export const createPromotion = async (req, res) => {
  try {
    const data = { ...req.body, companyId: req.userCompany };

    if (data.promotionType === 'Coupon' && data.couponCode) {
      const existing = await BusinessPromotion.findOne({
        companyId: req.userCompany,
        couponCode: data.couponCode.toUpperCase()
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Coupon code already exists' });
      }
    }

    const promotion = new BusinessPromotion(data);
    await promotion.save();

    res.status(201).json({ success: true, data: promotion });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllPromotions = async (req, res) => {
  try {
    const { promotionType, status, startDate, endDate, search } = req.query;
    const filter = { companyId: req.userCompany };

    if (promotionType) filter.promotionType = promotionType;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { couponCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const promotions = await BusinessPromotion.find(filter)
      .sort({ createdAt: -1 })
      .populate('applicableItems', 'itemName itemCode')
      .populate('linkedPromotions', 'name promotionType');

    res.json({ success: true, data: promotions });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPromotionById = async (req, res) => {
  try {
    const promotion = await BusinessPromotion.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    })
      .populate('applicableItems', 'itemName itemCode')
      .populate('targetCustomers', 'name phone')
      .populate('linkedPromotions', 'name promotionType status');

    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }

    res.json({ success: true, data: promotion });
  } catch (error) {
    console.error('Error fetching promotion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePromotion = async (req, res) => {
  try {
    const promotion = await BusinessPromotion.findOneAndUpdate(
      { _id: req.params.id, companyId: req.userCompany },
      req.body,
      { new: true, runValidators: true }
    );

    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }

    res.json({ success: true, data: promotion });
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const promotion = await BusinessPromotion.findOneAndDelete({
      _id: req.params.id,
      companyId: req.userCompany
    });

    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }

    // Delete associated redemptions
    await PromotionRedemption.deleteMany({ promotionId: req.params.id });

    res.json({ success: true, message: 'Promotion deleted successfully' });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== COUPON LOGIC ====================

export const validateCoupon = async (req, res) => {
  try {
    const { couponCode, orderAmount, customerId } = req.body;

    if (!couponCode) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const promotion = await BusinessPromotion.findOne({
      companyId: req.userCompany,
      couponCode: couponCode.toUpperCase(),
      promotionType: 'Coupon',
      status: 'Active'
    });

    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code' });
    }

    const now = new Date();
    if (now < promotion.startDate || now > promotion.endDate) {
      return res.status(400).json({ success: false, message: 'Coupon is not valid at this time' });
    }

    if (promotion.usageLimit > 0 && promotion.currentUsageCount >= promotion.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    if (promotion.minOrderAmount > 0 && orderAmount < promotion.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ${promotion.minOrderAmount}`
      });
    }

    if (customerId && promotion.usageLimitPerCustomer > 0) {
      const customerUsage = await PromotionRedemption.countDocuments({
        promotionId: promotion._id,
        customerId
      });
      if (customerUsage >= promotion.usageLimitPerCustomer) {
        return res.status(400).json({ success: false, message: 'You have reached the usage limit for this coupon' });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promotion.discountType === 'Percentage') {
      discountAmount = (orderAmount * promotion.discountValue) / 100;
      if (promotion.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
      }
    } else {
      discountAmount = promotion.discountValue;
    }

    discountAmount = Math.min(discountAmount, orderAmount);

    res.json({
      success: true,
      data: {
        promotionId: promotion._id,
        couponCode: promotion.couponCode,
        name: promotion.name,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        discountAmount: Math.round(discountAmount * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const redeemPromotion = async (req, res) => {
  try {
    const { promotionId, salesId, invoiceNumber, customerId, customerName, discountAmount, orderAmount } = req.body;

    const promotion = await BusinessPromotion.findOne({
      _id: promotionId,
      companyId: req.userCompany
    });

    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }

    const redemption = new PromotionRedemption({
      companyId: req.userCompany,
      promotionId,
      salesId,
      invoiceNumber,
      customerId,
      customerName,
      discountAmount,
      orderAmount
    });
    await redemption.save();

    // Update promotion counters
    await BusinessPromotion.findByIdAndUpdate(promotionId, {
      $inc: {
        currentUsageCount: 1,
        totalRedemptions: 1,
        totalRevenueGenerated: orderAmount,
        totalDiscountGiven: discountAmount
      }
    });

    res.status(201).json({ success: true, data: redemption });
  } catch (error) {
    console.error('Error redeeming promotion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ANALYTICS ====================

export const getPromotionAnalytics = async (req, res) => {
  try {
    const filter = { companyId: req.userCompany };

    const [activeCoupons, activeOffers, activeCampaigns, allPromotions, recentRedemptions] = await Promise.all([
      BusinessPromotion.countDocuments({ ...filter, promotionType: 'Coupon', status: 'Active' }),
      BusinessPromotion.countDocuments({ ...filter, promotionType: 'Offer', status: 'Active' }),
      BusinessPromotion.countDocuments({ ...filter, promotionType: 'Campaign', status: 'Active' }),
      BusinessPromotion.find(filter).sort({ totalRedemptions: -1 }).limit(10).lean(),
      PromotionRedemption.find({ companyId: req.userCompany })
        .sort({ redemptionDate: -1 })
        .limit(20)
        .populate('promotionId', 'name promotionType couponCode')
        .lean()
    ]);

    const totals = await BusinessPromotion.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(req.userCompany) } },
      {
        $group: {
          _id: null,
          totalRevenueImpact: { $sum: '$totalRevenueGenerated' },
          totalDiscountsGiven: { $sum: '$totalDiscountGiven' },
          totalRedemptions: { $sum: '$totalRedemptions' }
        }
      }
    ]);

    const stats = totals[0] || { totalRevenueImpact: 0, totalDiscountsGiven: 0, totalRedemptions: 0 };

    res.json({
      success: true,
      data: {
        activeCoupons,
        activeOffers,
        activeCampaigns,
        totalRevenueImpact: stats.totalRevenueImpact,
        totalDiscountsGiven: stats.totalDiscountsGiven,
        totalRedemptions: stats.totalRedemptions,
        topPromotions: allPromotions,
        recentRedemptions
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REDEMPTIONS ====================

export const getPromotionRedemptions = async (req, res) => {
  try {
    const redemptions = await PromotionRedemption.find({
      companyId: req.userCompany,
      promotionId: req.params.id
    })
      .sort({ redemptionDate: -1 })
      .populate('customerId', 'name phone');

    res.json({ success: true, data: redemptions });
  } catch (error) {
    console.error('Error fetching redemptions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TEMPLATE CRUD ====================

export const createTemplate = async (req, res) => {
  try {
    const template = new PromotionTemplate({
      ...req.body,
      companyId: req.userCompany
    });
    await template.save();

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllTemplates = async (req, res) => {
  try {
    const { channel, category } = req.query;
    const filter = { companyId: req.userCompany };
    if (channel) filter.channel = channel;
    if (category) filter.category = category;

    const templates = await PromotionTemplate.find(filter).sort({ createdAt: -1 });

    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTemplateById = async (req, res) => {
  try {
    const template = await PromotionTemplate.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const template = await PromotionTemplate.findOneAndUpdate(
      { _id: req.params.id, companyId: req.userCompany },
      req.body,
      { new: true, runValidators: true }
    );

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const template = await PromotionTemplate.findOneAndDelete({
      _id: req.params.id,
      companyId: req.userCompany
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const previewTemplate = async (req, res) => {
  try {
    const template = await PromotionTemplate.findOne({
      _id: req.params.id,
      companyId: req.userCompany
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const sampleData = req.body || {};
    let preview = template.messageBody;

    // Replace placeholders with sample data
    const defaults = {
      customerName: 'John Doe',
      couponCode: 'SAMPLE20',
      discount: '20%',
      storeName: 'Your Store',
      expiryDate: '31-Mar-2026',
      minOrder: '500',
      phone: '9876543210'
    };

    const mergedData = { ...defaults, ...sampleData };
    for (const [key, value] of Object.entries(mergedData)) {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    res.json({
      success: true,
      data: {
        original: template.messageBody,
        preview,
        charCount: preview.length,
        smsSegments: Math.ceil(preview.length / 160)
      }
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
