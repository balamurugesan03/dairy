import express from 'express';
import {
  getConfig,
  saveConfig,
  startAnalyzerHandler,
  stopAnalyzerHandler,
  listPortsHandler,
  getStatusHandler,
} from '../controllers/machineConfigController.js';

const router = express.Router();

router.get('/ports',  listPortsHandler);
router.get('/status', getStatusHandler);
router.get('/',       getConfig);
router.post('/',      saveConfig);
router.post('/start', startAnalyzerHandler);
router.post('/stop',  stopAnalyzerHandler);

export default router;
