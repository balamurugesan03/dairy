import express from 'express';
import {
  getStatus,
  connect,
  disconnect,
  sendWhatsApp,
  testWhatsApp,
} from '../controllers/whatsappController.js';

const router = express.Router();

router.get('/status',     getStatus);
router.post('/connect',   connect);
router.post('/disconnect', disconnect);
router.post('/send',      sendWhatsApp);
router.get('/test',       testWhatsApp);

export default router;
