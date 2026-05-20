import express from 'express';
import {
  getStatus,
  connect,
  disconnect,
  sendWhatsApp,
  testWhatsApp,
  sendGroupWhatsApp,
} from '../controllers/whatsappController.js';

const router = express.Router();

router.get('/status',      getStatus);
router.post('/connect',    connect);
router.post('/disconnect', disconnect);
router.post('/send',       sendWhatsApp);
router.post('/send-group', sendGroupWhatsApp);
router.get('/test',        testWhatsApp);

export default router;
