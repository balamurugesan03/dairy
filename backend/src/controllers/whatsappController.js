import * as wa from '../services/whatsappWebService.js';

// GET /api/whatsapp/status
export const getStatus = (req, res) => {
  res.json({ success: true, data: wa.getStatus() });
};

// POST /api/whatsapp/connect
export const connect = (req, res) => {
  wa.startClient();
  res.json({ success: true, message: 'WhatsApp client starting — scan the QR code' });
};

// POST /api/whatsapp/disconnect
export const disconnect = async (req, res) => {
  await wa.stopClient();
  res.json({ success: true, message: 'WhatsApp disconnected' });
};

// POST /api/whatsapp/send
export const sendWhatsApp = async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ success: false, message: 'phone and message are required' });
  }
  try {
    await wa.sendMessage(phone, message);
    res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/whatsapp/test
export const testWhatsApp = async (req, res) => {
  const phone = req.query.phone || '';
  if (!phone) return res.status(400).json({ success: false, message: 'phone query param required' });
  try {
    await wa.sendMessage(phone, '✅ WhatsApp integration test from DairyERP. Connection successful!');
    res.json({ success: true, message: 'Test message sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
