import express from 'express';
import {
  getConfig,
  saveConfig,
  startAnalyzerHandler,
  stopAnalyzerHandler,
  listPortsHandler,
  getStatusHandler,
  startScaleHandler,
  stopScaleHandler,
  getScaleStatusHandler,
  scaleTareHandler,
  startDisplayHandler,
  stopDisplayHandler,
  getDisplayStatusHandler,
  sendDisplayHandler,
  testDisplayHandler,
} from '../controllers/machineConfigController.js';

const router = express.Router();

router.get('/ports',            listPortsHandler);
router.get('/status',           getStatusHandler);
router.get('/scale/status',     getScaleStatusHandler);
router.get('/display/status',   getDisplayStatusHandler);
router.get('/',                 getConfig);
router.post('/',                saveConfig);
router.post('/start',           startAnalyzerHandler);
router.post('/stop',            stopAnalyzerHandler);
router.post('/scale/start',     startScaleHandler);
router.post('/scale/stop',      stopScaleHandler);
router.post('/scale/tare',      scaleTareHandler);
router.post('/display/start',   startDisplayHandler);
router.post('/display/stop',    stopDisplayHandler);
router.post('/display/send',    sendDisplayHandler);
router.post('/display/test',    testDisplayHandler);

export default router;
