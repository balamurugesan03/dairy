import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

let client       = null;
let qrBase64     = null;
let connected    = false;
let initializing = false;

export const getStatus = () => ({ connected, initializing, qr: qrBase64 });

export const startClient = () => {
  if (client || initializing) return;
  initializing = true;
  qrBase64     = null;
  connected    = false;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer   : { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  client.on('qr', async (qr) => {
    qrBase64  = await qrcode.toDataURL(qr);
    connected = false;
  });

  client.on('ready', () => {
    connected    = true;
    initializing = false;
    qrBase64     = null;
  });

  client.on('authenticated', () => {
    qrBase64 = null;
  });

  client.on('auth_failure', () => {
    connected    = false;
    initializing = false;
    qrBase64     = null;
    client       = null;
  });

  client.on('disconnected', () => {
    connected    = false;
    initializing = false;
    qrBase64     = null;
    client       = null;
  });

  client.initialize().catch(() => {
    connected    = false;
    initializing = false;
    qrBase64     = null;
    client       = null;
  });
};

export const stopClient = async () => {
  if (client) {
    try { await client.destroy(); } catch { /* ignore */ }
    client = null;
  }
  connected    = false;
  initializing = false;
  qrBase64     = null;
};

export const sendMessage = async (phone, message) => {
  if (!connected || !client) throw new Error('WhatsApp not connected. Scan the QR code first.');
  const digits = phone.replace(/\D/g, '');
  const chatId = (digits.startsWith('91') ? digits : `91${digits}`) + '@c.us';
  await client.sendMessage(chatId, message);
};
