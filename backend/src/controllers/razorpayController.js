import Razorpay from 'razorpay';
import crypto   from 'crypto';

const getRazorpay = () => {
  const key_id     = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error('Razorpay keys not configured in .env');
  return new Razorpay({ key_id, key_secret });
};

// POST /api/razorpay/create-order
export const createOrder = async (req, res) => {
  try {
    const { amount, receipt, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount:   Math.round(parseFloat(amount) * 100), // paise
      currency: 'INR',
      receipt:  receipt  || `dairy_${Date.now()}`,
      notes:    notes    || {},
    });

    res.json({
      success: true,
      data: {
        orderId:  order.id,
        amount:   order.amount,
        currency: order.currency,
        keyId:    process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/razorpay/verify
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ success: false, message: 'Missing payment details' });

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = hmac.digest('hex');

    if (digest !== razorpay_signature)
      return res.status(400).json({ success: false, message: 'Payment signature mismatch' });

    res.json({ success: true, data: { paymentId: razorpay_payment_id, orderId: razorpay_order_id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
