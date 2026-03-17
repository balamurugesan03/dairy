/**
 * Serial Port Service — Milk Analyzer Integration
 *
 * Primary format: 31-char ASCII frame  (XXXXXXXXXXXXXXXXXXXXXXXXXXXXX)
 *   char[0]   = '('
 *   char[30]  = ')'
 *   inside[0..3]  = FAT raw (÷100)  e.g. "1025" → 10.25
 *   inside[4..7]  = SNF raw (÷100)  e.g. "0954" → 9.54
 *   inside[8..11] = Density         e.g. "0002" → 2
 *   inside[12..13]= Added Water %   e.g. "00"   → 0
 *   inside[14..28]= reserved
 *
 * Fallback formats (other machines):
 *   Lactoscan:  F=4.50 SNF=8.35 D=26.50 L=5.000 W=0.0
 *   CSV:        5.00,4.50,26.5,8.30
 *   Key=Value:  FAT:4.5 CLR:26.5 SNF:8.3 LTR:5.0
 */

import { SerialPort } from 'serialport';

let activePort   = null;
let currentPath  = null;
let currentBaud  = null;
let dataBuffer   = '';   // raw character buffer

// ── Parse 31-char frame  (XXXXXXXXXXXXXXXXXXXXXXXXXXXXX) ──────────────────────
function parse31Char(frame) {
  if (frame.length !== 31) return null;
  if (frame[0] !== '(' || frame[30] !== ')') return null;
  const inner = frame.slice(1, 30); // 29 chars
  if (inner.length < 14) return null;

  const fatRaw      = parseInt(inner.slice(0, 4),  10);
  const snfRaw      = parseInt(inner.slice(4, 8),  10);
  const densityRaw  = parseInt(inner.slice(8, 12), 10);
  const waterRaw    = parseInt(inner.slice(14, 16),10);  // positions 15-16

  if (isNaN(fatRaw) || isNaN(snfRaw)) return null;

  return {
    fat:        parseFloat((fatRaw / 100).toFixed(2)),
    snf:        parseFloat((snfRaw / 100).toFixed(2)),
    clr:        null,
    ltr:        null,
    density:    isNaN(densityRaw) ? null : densityRaw,
    addedWater: isNaN(waterRaw)   ? 0    : waterRaw,
    rawData:    frame,
  };
}

// ── Parse fallback formats ─────────────────────────────────────────────────────
function parseFallback(text) {
  const t = text.trim();
  if (!t) return null;

  let ltrVal, fatVal, clrVal, snfVal, waterVal;

  // Lactoscan: F=4.50 SNF=8.35 D=26.50 L=5.000 W=0.0
  if (/\bF=\d/.test(t)) {
    const g = (re) => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };
    fatVal   = g(/\bF=(\d+\.?\d*)/i);
    snfVal   = g(/\bSNF=(\d+\.?\d*)/i);
    clrVal   = g(/\bD=(\d+\.?\d*)/i);
    ltrVal   = g(/\bL=(\d+\.?\d*)/i);
    waterVal = g(/\bW=(\d+\.?\d*)/i);
  }
  // CSV: 5.00,4.50,26.5,8.30
  else if (/^\d+\.?\d*,\d/.test(t) && !t.includes(':')) {
    const parts = t.split(',').map(parseFloat);
    if (parts.length >= 4) [ltrVal, fatVal, clrVal, snfVal, waterVal] = parts;
  }
  // Key:Value — FAT:4.5 CLR:26.5 SNF:8.3 LTR:5.0
  else if (/FAT:|CLR:|SNF:/i.test(t)) {
    const g = (re) => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };
    fatVal   = g(/FAT:(\d+\.?\d*)/i);
    clrVal   = g(/CLR:(\d+\.?\d*)/i);
    snfVal   = g(/SNF:(\d+\.?\d*)/i);
    ltrVal   = g(/LTR:(\d+\.?\d*)/i);
    waterVal = g(/WATER:(\d+\.?\d*)/i);
  }

  if (fatVal == null) return null;

  return {
    fat:        fatVal  != null ? parseFloat(fatVal.toFixed(2))  : null,
    snf:        snfVal  != null ? parseFloat(snfVal.toFixed(2))  : null,
    clr:        clrVal  != null ? parseFloat(clrVal.toFixed(1))  : null,
    ltr:        ltrVal  != null ? parseFloat(ltrVal.toFixed(3))  : null,
    density:    null,
    addedWater: waterVal != null && waterVal > 0 ? parseFloat(waterVal.toFixed(2)) : 0,
    rawData:    t,
  };
}

// ── Master parser — tries 31-char first, then fallback ────────────────────────
function parseAnalyzerData(text) {
  // Try 31-char frame first
  const idx = text.indexOf('(');
  if (idx !== -1 && text.length >= idx + 31) {
    const frame = text.substring(idx, idx + 31);
    const result = parse31Char(frame);
    if (result) return result;
  }
  // Fallback
  return parseFallback(text);
}

// ── Process buffer — extract complete frames ───────────────────────────────────
function processBuffer(io) {
  // 1. Try 31-char format first: look for (...)
  let start;
  while ((start = dataBuffer.indexOf('(')) !== -1) {
    const end = dataBuffer.indexOf(')', start);
    if (end === -1) break; // incomplete frame — wait for more data

    const frame = dataBuffer.substring(start, end + 1);
    dataBuffer  = dataBuffer.substring(end + 1);

    const parsed = parse31Char(frame);
    if (parsed) {
      console.log(`[SerialPort] 31-char: FAT=${parsed.fat} SNF=${parsed.snf} Density=${parsed.density} Water=${parsed.addedWater}`);
      io.emit('milk-analyzer-data', { ...parsed, timestamp: new Date().toISOString() });
      return; // processed one frame — loop will continue
    }
    // Not a valid 31-char frame, keep going
  }

  // 2. Fallback: look for \r\n delimited lines
  const lines = dataBuffer.split(/[\r\n]+/);
  dataBuffer = lines.pop(); // keep last partial line
  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseFallback(line);
    if (parsed) {
      console.log(`[SerialPort] Fallback: FAT=${parsed.fat} SNF=${parsed.snf} CLR=${parsed.clr}`);
      io.emit('milk-analyzer-data', { ...parsed, timestamp: new Date().toISOString() });
    }
  }

  // Safety: trim buffer to prevent unbounded growth
  if (dataBuffer.length > 500) {
    dataBuffer = dataBuffer.slice(-200);
  }
}

// ── Start analyzer ─────────────────────────────────────────────────────────────
export function startAnalyzer({ port: portPath, baudRate }, io) {
  return new Promise((resolve) => {
    // Force-close any existing port first
    if (activePort) {
      try { if (activePort.isOpen) activePort.close(); } catch {}
      try { activePort.destroy(); } catch {}
    }
    activePort  = null;
    dataBuffer  = '';
    currentPath = null;
    currentBaud = null;

    // Wait longer to let OS release the port
    setTimeout(() => openPort(), 800);

    function openPort() {
      try {
        const port = new SerialPort({
          path:     portPath,
          baudRate: parseInt(baudRate, 10),
          dataBits: 8,
          parity:   'none',
          stopBits: 1,
          autoOpen: false,
        });

        port.open((err) => {
          if (err) {
            console.warn(`[SerialPort] Cannot open ${portPath}: ${err.message}`);
            let msg = `Cannot open ${portPath}: ${err.message}`;
            if (err.message.includes('Access denied') || err.message.includes('EACCES') || err.message.includes('121')) {
              msg = `Access Denied on ${portPath} — port is used by another app. Close other serial programs and restart the backend server, then try again.`;
            } else if (err.message.includes('File not found') || err.message.includes('ENOENT')) {
              msg = `${portPath} not found — check if the device is connected and select the correct COM port.`;
            }
            return resolve({ success: false, message: msg });
          }

          activePort  = port;
          currentPath = portPath;
          currentBaud = parseInt(baudRate, 10);
          dataBuffer  = '';

          console.log(`[SerialPort] Analyzer started — ${portPath} @ ${baudRate} baud`);

          // Raw data event — accumulate into buffer and process
          port.on('data', (chunk) => {
            dataBuffer += chunk.toString('ascii');
            processBuffer(io);
          });

          port.on('error', (err) => {
            console.error(`[SerialPort] Error: ${err.message}`);
          });

          port.on('close', () => {
            console.warn('[SerialPort] Port closed.');
            currentPath = null;
            currentBaud = null;
            dataBuffer  = '';
          });

          resolve({ success: true, message: `Analyzer started on ${portPath} @ ${baudRate} baud` });
        });
      } catch (err) {
        resolve({ success: false, message: err.message });
      }
    }
  });
}

// ── Stop analyzer ──────────────────────────────────────────────────────────────
export function stopAnalyzer() {
  if (activePort && activePort.isOpen) {
    try { activePort.close(); } catch {}
    console.log('[SerialPort] Analyzer stopped.');
  }
  activePort  = null;
  currentPath = null;
  currentBaud = null;
  dataBuffer  = '';
}

// ── Status ─────────────────────────────────────────────────────────────────────
export function getStatus() {
  return {
    isOpen:   activePort ? activePort.isOpen : false,
    portPath: currentPath,
    baudRate: currentBaud,
  };
}

// ── List available COM ports ───────────────────────────────────────────────────
export async function listPorts() {
  return SerialPort.list();
}
