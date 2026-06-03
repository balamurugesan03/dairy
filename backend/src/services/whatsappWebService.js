import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

let client       = null;
let qrBase64     = null;
let connected    = false;
let initializing = false;
let lastError    = null;

export const getStatus = () => ({ connected, initializing, qr: qrBase64, error: lastError });

const resetState = () => {
  connected    = false;
  initializing = false;
  qrBase64     = null;
  client       = null;
};

export const startClient = () => {
  if (client || initializing) return;
  initializing = true;
  qrBase64     = null;
  connected    = false;
  lastError    = null;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',   // critical on Linux servers (small /dev/shm)
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-accelerated-2d-canvas',
        '--disable-extensions',
      ],
    },
  });

  client.on('qr', async (qr) => {
    qrBase64     = await qrcode.toDataURL(qr);
    initializing = false;
    connected    = false;
  });

  client.on('ready', () => {
    connected    = true;
    initializing = false;
    qrBase64     = null;
    lastError    = null;
  });

  client.on('authenticated', () => {
    qrBase64  = null;
    lastError = null;
  });

  client.on('auth_failure', (msg) => {
    lastError = msg || 'Authentication failed';
    resetState();
  });

  client.on('disconnected', (reason) => {
    lastError = reason || 'Disconnected';
    resetState();
  });

  client.initialize().catch((err) => {
    lastError = err?.message || 'Failed to start WhatsApp client';
    resetState();
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

export const sendGroupMessage = async (groupId, message) => {
  if (!connected || !client) throw new Error('WhatsApp not connected. Scan the QR code first.');
  const chatId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
  await client.sendMessage(chatId, message);
};
