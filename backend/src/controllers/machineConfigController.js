import MachineConfig from '../models/MachineConfig.js';
import { startAnalyzer, stopAnalyzer, getStatus, listPorts } from '../services/serialPortService.js';
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
