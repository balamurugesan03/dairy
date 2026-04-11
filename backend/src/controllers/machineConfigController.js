import MachineConfig from '../models/MachineConfig.js';
import {
  startAnalyzer, stopAnalyzer, getStatus, listPorts,
  startScale, stopScale, getScaleStatus, sendScaleTare,
  startDisplay, stopDisplay, getDisplayStatus, sendToDisplay, sendRawToDisplay,
} from '../services/serialPortService.js';
import MilkPurchaseSettings from '../models/MilkPurchaseSettings.js';
import { io } from '../server.js';

// GET /api/machine-config
export const getConfig = async (req, res) => {
  try {
    const config = await MachineConfig.findOne({ companyId: req.companyId });
    const status = getStatus();
    res.json({ success: true, data: config, analyzerRunning: status.isOpen, portPath: status.portPath });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config  — save / upsert config
export const saveConfig = async (req, res) => {
  try {
    const { deviceName, port, baudRate } = req.body;
    if (!deviceName || !port || !baudRate) {
      return res.status(400).json({ success: false, message: 'deviceName, port and baudRate are required' });
    }
    const config = await MachineConfig.findOneAndUpdate(
      { companyId: req.companyId },
      { deviceName, port, baudRate: parseInt(baudRate, 10), companyId: req.companyId },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/start  — accepts { port, baudRate } in body OR reads saved MachineConfig
export const startAnalyzerHandler = async (req, res) => {
  try {
    let portPath = req.body.port;
    let baudRate = req.body.baudRate;

    // If not supplied in body, fall back to saved MachineConfig
    if (!portPath || !baudRate) {
      const config = await MachineConfig.findOne({ companyId: req.companyId });
      if (!config) {
        return res.status(404).json({ success: false, message: 'Port and baud rate are required. Save configuration first or pass them in the request.' });
      }
      portPath = config.port;
      baudRate = config.baudRate;
    }

    const result = await startAnalyzer({ port: portPath, baudRate }, io);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/stop
export const stopAnalyzerHandler = async (req, res) => {
  try {
    stopAnalyzer();
    res.json({ success: true, message: 'Analyzer stopped' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/machine-config/ports  — list available COM ports
export const listPortsHandler = async (req, res) => {
  try {
    const ports = await listPorts();
    res.json({ success: true, data: ports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/machine-config/status
export const getStatusHandler = async (req, res) => {
  try {
    const status = getStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/scale/start  — start weight scale using weighingScaleConfig from settings
export const startScaleHandler = async (req, res) => {
  try {
    let portPath = req.body.port;
    let baudRate = req.body.baudRate;

    // If not supplied, read from MilkPurchaseSettings.weighingScaleConfig
    if (!portPath || !baudRate) {
      const settings = await MilkPurchaseSettings.findOne({ companyId: req.companyId });
      if (!settings?.weighingScaleConfig?.comPort) {
        return res.status(404).json({
          success: false,
          message: 'Weighing scale port not configured. Go to Milk Purchase Settings → Weighing Scale and save.',
        });
      }
      portPath = settings.weighingScaleConfig.comPort;
      baudRate = settings.weighingScaleConfig.baudRate || 9600;
    }

    const result = await startScale({ port: portPath, baudRate }, io);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/scale/stop
export const stopScaleHandler = async (req, res) => {
  try {
    stopScale();
    res.json({ success: true, message: 'Scale stopped' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/machine-config/scale/status
export const getScaleStatusHandler = async (req, res) => {
  try {
    const status = getScaleStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/scale/tare  — send tare (zero) command to scale
export const scaleTareHandler = async (req, res) => {
  try {
    // Get tare string from settings (default 'T')
    let tareString = 'T';
    const settings = await MilkPurchaseSettings.findOne({ companyId: req.companyId });
    if (settings?.weighingScaleConfig?.tareString) {
      tareString = settings.weighingScaleConfig.tareString;
    }
    const result = sendScaleTare(tareString);
    if (result.success) {
      res.json({ success: true, message: `Tare sent: ${JSON.stringify(tareString)}` });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/display/start  — open LED display serial port
export const startDisplayHandler = async (req, res) => {
  try {
    let portPath = req.body.port;
    let baudRate = req.body.baudRate;

    if (!portPath || !baudRate) {
      const settings = await MilkPurchaseSettings.findOne({ companyId: req.companyId });
      if (!settings?.ledDisplayConfig?.comPort) {
        return res.status(404).json({
          success: false,
          message: 'LED display port not configured. Go to Milk Purchase Settings → LED Display and save.',
        });
      }
      portPath = settings.ledDisplayConfig.comPort;
      baudRate = settings.ledDisplayConfig.baudRate || 9600;
    }

    const result = await startDisplay({ port: portPath, baudRate });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/display/stop
export const stopDisplayHandler = async (req, res) => {
  try {
    stopDisplay();
    res.json({ success: true, message: 'Display stopped' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/machine-config/display/status
export const getDisplayStatusHandler = async (req, res) => {
  try {
    const status = getDisplayStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/display/send  — format and send RS232 frame to display
export const sendDisplayHandler = async (req, res) => {
  try {
    const { id, fat, snf, clr, qty, rate, amount, water } = req.body;
    const result = await sendToDisplay({ id, fat, snf, clr, qty, rate, amount, water });
    if (result.success) {
      res.json({ success: true, frame: result.frame });
    } else {
      res.status(400).json({ success: false, message: result.message, frame: result.frame });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-config/display/test
// body: { terminator: 'none'|'cr'|'crlf'|'lf', raw: '...' }
export const testDisplayHandler = async (req, res) => {
  try {
    const raw        = req.body.raw        || '(A 0001)(F 04.2 08.1 26.5)(S 000010.00)(J 28.50)(G 00285.00)(W 00.0)';
    const terminator = req.body.terminator || 'none';
    const result     = await sendRawToDisplay(raw, terminator);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
