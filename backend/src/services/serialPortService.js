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

// ── Weight Scale state ─────────────────────────────────────────────────────────
let scalePort    = null;
let scalePath    = null;
let scaleBaud    = null;
let scaleBuffer  = '';
let scaleDebounceTimer = null;
let scaleLastValue     = null;

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
    fat:        parseFloat((fatRaw / 100).toFixed(1)),
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

// ── Common baud rates to auto-try when Error 31 occurs ────────────────────────
const COMMON_BAUDS = [9600, 2400, 4800, 19200, 38400, 115200, 1200];

// ── Try opening a port with given settings, returns Promise<{port}|{error}> ───
function tryOpenPort(portPath, baud) {
  return new Promise((resolve) => {
    try {
      const port = new SerialPort({
        path:     portPath,
        baudRate: baud,
        dataBits: 8,
        parity:   'none',
        stopBits: 1,
        rtscts:   false,
        xon:      false,
        xoff:     false,
        autoOpen: false,
      });
      port.open((err) => {
        if (err) resolve({ error: err });
        else     resolve({ port });
      });
    } catch (err) {
      resolve({ error: err });
    }
  });
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

    async function openPort() {
      const requestedBaud = parseInt(baudRate, 10);

      // Build baud list: requested first, then fallbacks (excluding the one already tried)
      const baudList = [requestedBaud, ...COMMON_BAUDS.filter(b => b !== requestedBaud)];

      let lastErr = null;
      let openedPort = null;
      let openedBaud = null;

      for (const baud of baudList) {
        const result = await tryOpenPort(portPath, baud);
        if (result.port) {
          openedPort = result.port;
          openedBaud = baud;
          break;
        }
        lastErr = result.error;
        const isError31 = lastErr.message.includes('31') ||
          lastErr.message.toLowerCase().includes('gen_failure') ||
          lastErr.message.toLowerCase().includes('unknown error code 31');
        // Only auto-retry on Error 31; stop immediately on other errors
        if (!isError31) break;
        console.warn(`[SerialPort] ${portPath} @ ${baud} baud → Error 31, trying next baud rate…`);
        await new Promise(r => setTimeout(r, 300)); // brief pause between attempts
      }

      if (!openedPort) {
        console.warn(`[SerialPort] Cannot open ${portPath}: ${lastErr.message}`);
        let msg = `Cannot open ${portPath}: ${lastErr.message}`;
        if (lastErr.message.includes('Access denied') || lastErr.message.includes('EACCES') || lastErr.message.includes('121')) {
          msg = `Access Denied on ${portPath} — port is used by another app. Close other serial programs and restart the backend server, then try again.`;
        } else if (lastErr.message.includes('File not found') || lastErr.message.includes('ENOENT')) {
          msg = `${portPath} not found — check if the device is connected and select the correct COM port.`;
        } else if (lastErr.message.includes('31') || lastErr.message.toLowerCase().includes('gen_failure') || lastErr.message.toLowerCase().includes('unknown error code 31')) {
          msg = `Cannot configure ${portPath} (Error 31) — tried baud rates ${baudList.join(', ')} and all failed. Reconnect the USB-Serial adapter or reinstall its driver.`;
        }
        return resolve({ success: false, message: msg });
      }

      activePort  = openedPort;
      currentPath = portPath;
      currentBaud = openedBaud;
      dataBuffer  = '';

      const note = openedBaud !== requestedBaud ? ` (auto-detected; configured was ${requestedBaud})` : '';
      console.log(`[SerialPort] Analyzer started — ${portPath} @ ${openedBaud} baud${note}`);

      // Raw data event — accumulate into buffer and process
      openedPort.on('data', (chunk) => {
        dataBuffer += chunk.toString('ascii');
        processBuffer(io);
      });

      openedPort.on('error', (err) => {
        console.error(`[SerialPort] Error: ${err.message}`);
      });

      openedPort.on('close', () => {
        console.warn('[SerialPort] Port closed.');
        currentPath = null;
        currentBaud = null;
        dataBuffer  = '';
      });

      const msg = openedBaud !== requestedBaud
        ? `Analyzer started on ${portPath} @ ${openedBaud} baud (auto-detected — configured baud ${requestedBaud} failed with Error 31). Update your saved baud rate to ${openedBaud}.`
        : `Analyzer started on ${portPath} @ ${openedBaud} baud`;

      resolve({ success: true, message: msg, baudRate: openedBaud });
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

// ── Weight Scale: parse one ASCII line from encoder/scale ─────────────────────
// Accepts:  "L0002.10"  "L 0002.1"  "U0002.1"  etc.
// Returns:  { stable: bool, value: float } or null
function parseScaleLine(line) {
  const text = line.trim();
  if (!text) return null;
  const match = text.match(/^([A-Za-z])\s*(\d+\.?\d*)/);
  if (!match) return null;
  const stable = match[1].toUpperCase() === 'L';
  const value  = parseFloat(match[2]);
  if (isNaN(value)) return null;
  return { stable, value };
}

// ── Weight Scale: process buffer → emit debounced stable reading ───────────────
function processScaleBuffer(io) {
  const lines = scaleBuffer.split(/[\r\n]+/);
  scaleBuffer = lines.pop(); // keep partial last segment

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseScaleLine(line);
    if (!parsed) continue;

    // Always emit raw (unstable too) so frontend can show live weight
    io.emit('weight-scale-data', {
      stable: parsed.stable,
      value:  parsed.value,
      raw:    line.trim(),
      timestamp: new Date().toISOString(),
    });

    if (parsed.stable) {
      // Only emit once per NEW stable value.
      // scaleLastValue resets to null on every unstable reading,
      // so when the scale settles on a new weight it fires exactly once.
      if (scaleLastValue === parsed.value) continue; // same value already sent — skip

      clearTimeout(scaleDebounceTimer);
      scaleDebounceTimer = setTimeout(() => {
        scaleLastValue = parsed.value;
        io.emit('weight-scale-stable', { value: parsed.value, timestamp: new Date().toISOString() });
        console.log(`[ScalePort] Stable weight: ${parsed.value} kg`);
      }, 300);
    } else {
      // Weight is changing (unstable) — reset so the next stable fires again
      clearTimeout(scaleDebounceTimer);
      scaleLastValue = null;
    }
  }

  // Prevent unbounded buffer growth
  if (scaleBuffer.length > 200) scaleBuffer = scaleBuffer.slice(-100);
}

// ── Start weight scale ─────────────────────────────────────────────────────────
export function startScale({ port: portPath, baudRate }, io) {
  return new Promise((resolve) => {
    // Close any existing scale port first
    if (scalePort) {
      try { if (scalePort.isOpen) scalePort.close(); } catch {}
      try { scalePort.destroy(); } catch {}
    }
    scalePort   = null;
    scaleBuffer = '';
    scalePath   = null;
    scaleBaud   = null;
    clearTimeout(scaleDebounceTimer);
    scaleLastValue = null;

    setTimeout(() => openScalePort(), 500);

    async function openScalePort() {
      const requestedBaud = parseInt(baudRate, 10);
      const baudList = [requestedBaud, ...COMMON_BAUDS.filter(b => b !== requestedBaud)];

      let lastErr = null;
      let openedPort = null;
      let openedBaud = null;

      for (const baud of baudList) {
        const result = await tryOpenPort(portPath, baud);
        if (result.port) { openedPort = result.port; openedBaud = baud; break; }
        lastErr = result.error;
        const isError31 = lastErr.message.includes('31') ||
          lastErr.message.toLowerCase().includes('gen_failure') ||
          lastErr.message.toLowerCase().includes('unknown error code 31');
        if (!isError31) break;
        console.warn(`[ScalePort] ${portPath} @ ${baud} baud → Error 31, trying next…`);
        await new Promise(r => setTimeout(r, 300));
      }

      if (!openedPort) {
        let msg = `Cannot open scale port ${portPath}: ${lastErr.message}`;
        if (lastErr.message.includes('Access denied') || lastErr.message.includes('EACCES') || lastErr.message.includes('121')) {
          msg = `Access Denied on ${portPath} — port is used by another app. Close other serial programs and try again.`;
        } else if (lastErr.message.includes('File not found') || lastErr.message.includes('ENOENT')) {
          msg = `${portPath} not found — check the USB-Serial adapter is connected.`;
        } else if (lastErr.message.includes('31') || lastErr.message.toLowerCase().includes('gen_failure') || lastErr.message.toLowerCase().includes('unknown error code 31')) {
          msg = `Cannot configure scale port ${portPath} (Error 31) — tried baud rates ${baudList.join(', ')} and all failed. Reconnect the USB-Serial adapter or reinstall its driver.`;
        }
        console.warn(`[ScalePort] ${msg}`);
        return resolve({ success: false, message: msg });
      }

      scalePort   = openedPort;
      scalePath   = portPath;
      scaleBaud   = openedBaud;
      scaleBuffer = '';

      const note = openedBaud !== requestedBaud ? ` (auto-detected; configured was ${requestedBaud})` : '';
      console.log(`[ScalePort] Scale started — ${portPath} @ ${openedBaud} baud${note}`);

      openedPort.on('data', (chunk) => {
        scaleBuffer += chunk.toString('ascii');
        processScaleBuffer(io);
      });

      openedPort.on('error', (err) => {
        console.error(`[ScalePort] Error: ${err.message}`);
        io.emit('weight-scale-error', { message: err.message });
      });

      openedPort.on('close', () => {
        console.warn('[ScalePort] Scale port closed.');
        scalePath   = null;
        scaleBaud   = null;
        scaleBuffer = '';
        clearTimeout(scaleDebounceTimer);
        io.emit('weight-scale-disconnected', {});
      });

      const msg = openedBaud !== requestedBaud
        ? `Scale started on ${portPath} @ ${openedBaud} baud (auto-detected — configured baud ${requestedBaud} failed). Update saved baud rate to ${openedBaud}.`
        : `Scale started on ${portPath} @ ${openedBaud} baud`;

      resolve({ success: true, message: msg, baudRate: openedBaud });
    }
  });
}

// ── Send tare command to scale ─────────────────────────────────────────────────
// tareString comes from MilkPurchaseSettings.weighingScaleConfig.tareString (default 'T')
export function sendScaleTare(tareString = 'T') {
  if (!scalePort || !scalePort.isOpen) {
    return { success: false, message: 'Scale port is not open' };
  }
  try {
    const cmd = Buffer.from(tareString + '\r\n', 'ascii');
    scalePort.write(cmd, (err) => {
      if (err) console.error('[ScalePort] Tare write error:', err.message);
      else console.log(`[ScalePort] Tare sent: ${JSON.stringify(tareString)}`);
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ── Stop weight scale ──────────────────────────────────────────────────────────
export function stopScale() {
  clearTimeout(scaleDebounceTimer);
  if (scalePort && scalePort.isOpen) {
    try { scalePort.close(); } catch {}
    console.log('[ScalePort] Scale stopped.');
  }
  scalePort   = null;
  scalePath   = null;
  scaleBaud   = null;
  scaleBuffer = '';
  scaleLastValue = null;
}

// ── Scale status ───────────────────────────────────────────────────────────────
export function getScaleStatus() {
  return {
    isOpen:   scalePort ? scalePort.isOpen : false,
    portPath: scalePath,
    baudRate: scaleBaud,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  LED DISPLAY — RS232 format
//  Frame: (A 0058)(DC)(F 03.8 07.8 00.0)(S 000006.40)(J 25.89)(G 00165.70)(W 00.0)
//  Fixed-length fields, blank = spaces, decimal positions must not change.
// ══════════════════════════════════════════════════════════════════════════════

let displayPort  = null;
let displayPath  = null;
let displayBaud  = null;

// ── Fixed-width field formatters ───────────────────────────────────────────────
// fix4   : 4 chars  e.g. 2.8→"02.8"  26.0→"26.0"  null→"    "
// fixRate: 5 chars  e.g. 29.30→"29.30" 5.0→"05.00"  null→"     "
// fixQty : 9 chars  e.g. 20→"000020.00"             null→"         "
// fixAmt : 8 chars  e.g. 603.58→"00603.58"           null→"        "

function fix4(value) {
  if (value == null || value === '' || isNaN(Number(value))) return '    ';
  return Number(value).toFixed(1).padStart(4, '0');
}
function fixRate(value) {
  if (value == null || value === '' || isNaN(Number(value))) return '     ';
  return Number(value).toFixed(2).padStart(5, '0');
}
function fixQty(value) {
  if (value == null || value === '' || isNaN(Number(value))) return '         ';
  return Number(value).toFixed(2).padStart(9, '0');
}
function fixAmt(value) {
  if (value == null || value === '' || isNaN(Number(value))) return '        ';
  return Number(value).toFixed(2).padStart(8, '0');
}

// ── Validate data before sending to display ────────────────────────────────────
// Returns { valid: bool, reason: string }
export function validateDisplayData({ fat, snf, clr } = {}) {
  const hasFat = fat != null && fat !== '' && !isNaN(Number(fat));
  const hasSnf = snf != null && snf !== '' && !isNaN(Number(snf));
  const hasClr = clr != null && clr !== '' && !isNaN(Number(clr));

  if (hasFat && !hasSnf && !hasClr) return { valid: false, reason: 'FAT entered but SNF and CLR missing — partial F-block rejected' };
  if (hasFat && !hasSnf)            return { valid: false, reason: 'FAT entered but SNF missing — partial F-block rejected' };
  if (hasFat && !hasClr)            return { valid: false, reason: 'FAT entered but CLR missing — partial F-block rejected' };
  return { valid: true };
}

// ── Build RS232 display string ─────────────────────────────────────────────────
// Format : (A 0077)(F 02.8 07.6 26.0)(S 000020.00)(J 29.30)(G 00603.58)(W     )
// Sent as : 68-char frame + \r = 69 bytes total
// (DC) removed — frame is 68 chars fixed. Display reads by character position.
// FAT/SNF/CLR are atomic: all three must be present or all are sent as spaces.
export function formatRS232Display({ id, fat, snf, clr, qty, rate, amount, water } = {}) {
  const fId = String(id != null ? id : '').padStart(4, '0').slice(-4);  // "0077"

  // FAT/SNF/CLR atomic group — partial block corrupts display character positions
  const hasFat = fat   != null && fat   !== '' && !isNaN(Number(fat));
  const hasSnf = snf   != null && snf   !== '' && !isNaN(Number(snf));
  const hasClr = clr   != null && clr   !== '' && !isNaN(Number(clr));
  const fatOk  = hasFat && hasSnf && hasClr;

  const fFat = fatOk ? fix4(fat) : '    ';   // "02.8" or 4 spaces
  const fSnf = fatOk ? fix4(snf) : '    ';   // "07.6" or 4 spaces
  const fClr = fatOk ? fix4(clr) : '    ';   // "26.0" or 4 spaces

  const fQty    = fixQty(qty);     // "000020.00"  or 9 spaces
  const fRate   = fixRate(rate);   // "29.30"      or 5 spaces
  const fAmount = fixAmt(amount);  // "00603.58"   or 8 spaces
  const fWater  = (water != null && water !== '' && !isNaN(Number(water)) && Number(water) > 0)
    ? fix4(water) : '    ';        // "00.0"       or 4 spaces

  // No (DC) — removed to maintain correct 72-byte fixed length
  return `(A ${fId})(F ${fFat} ${fSnf} ${fClr})(S ${fQty})(J ${fRate})(G ${fAmount})(W ${fWater})`;
}

// ── Parse incoming RS232 string → JSON ────────────────────────────────────────
export function parseRS232String(str) {
  if (!str) return null;
  const g = (re) => { const m = str.match(re); return m ? m[1].trim() : null; };

  const idRaw     = g(/\(A\s+([^\)]+)\)/);
  const fBlock    = g(/\(F\s+([^\)]+)\)/);
  const qtyRaw    = g(/\(S\s+([^\)]+)\)/);
  const rateRaw   = g(/\(J\s+([^\)]+)\)/);
  const amountRaw = g(/\(G\s+([^\)]+)\)/);
  const waterRaw  = g(/\(W\s+([^\)]+)\)/);

  let fat = null, snf = null, clr = null;
  if (fBlock) {
    const parts = fBlock.trim().split(/\s+/);
    fat = parts[0] ? parseFloat(parts[0]) : null;
    snf = parts[1] ? parseFloat(parts[1]) : null;
    clr = parts[2] ? parseFloat(parts[2]) : null;
  }

  return {
    id:     idRaw   ? idRaw.replace(/^0+/, '') || '0' : null,
    fat:    fat,
    snf:    snf,
    clr:    clr,
    qty:    qtyRaw   ? parseFloat(qtyRaw)   : null,
    rate:   rateRaw  ? parseFloat(rateRaw)  : null,
    amount: amountRaw ? parseFloat(amountRaw) : null,
    water:  waterRaw ? parseFloat(waterRaw) : null,
    raw:    str,
  };
}

// ── Start LED display port ─────────────────────────────────────────────────────
export function startDisplay({ port: portPath, baudRate }) {
  return new Promise((resolve) => {
    if (displayPort) {
      try { if (displayPort.isOpen) displayPort.close(); } catch {}
      try { displayPort.destroy(); } catch {}
    }
    displayPort = null;
    displayPath = null;
    displayBaud = null;

    setTimeout(() => openDisplayPort(), 500);

    async function openDisplayPort() {
      const requestedBaud = parseInt(baudRate, 10);
      const baudList = [requestedBaud, ...COMMON_BAUDS.filter(b => b !== requestedBaud)];

      let lastErr = null;
      let openedPort = null;
      let openedBaud = null;

      for (const baud of baudList) {
        const result = await tryOpenPort(portPath, baud);
        if (result.port) { openedPort = result.port; openedBaud = baud; break; }
        lastErr = result.error;
        const isError31 = lastErr.message.includes('31') ||
          lastErr.message.toLowerCase().includes('gen_failure') ||
          lastErr.message.toLowerCase().includes('unknown error code 31');
        if (!isError31) break;
        console.warn(`[DisplayPort] ${portPath} @ ${baud} baud → Error 31, trying next…`);
        await new Promise(r => setTimeout(r, 300));
      }

      if (!openedPort) {
        let msg = `Cannot open display port ${portPath}: ${lastErr.message}`;
        if (lastErr.message.includes('Access denied') || lastErr.message.includes('121')) {
          msg = `Access Denied on ${portPath} — port in use by another app.`;
        } else if (lastErr.message.includes('File not found') || lastErr.message.includes('ENOENT')) {
          msg = `${portPath} not found — check the USB-Serial adapter.`;
        } else if (lastErr.message.includes('31') || lastErr.message.toLowerCase().includes('gen_failure') || lastErr.message.toLowerCase().includes('unknown error code 31')) {
          msg = `Cannot configure display port ${portPath} (Error 31) — tried baud rates ${baudList.join(', ')} and all failed. Reconnect the USB-Serial adapter or reinstall its driver.`;
        }
        console.warn(`[DisplayPort] ${msg}`);
        return resolve({ success: false, message: msg });
      }

      displayPort = openedPort;
      displayPath = portPath;
      displayBaud = openedBaud;

      const note = openedBaud !== requestedBaud ? ` (auto-detected; configured was ${requestedBaud})` : '';
      console.log(`[DisplayPort] Started — ${portPath} @ ${openedBaud} baud${note}`);

      openedPort.on('error', (err) => {
        console.error(`[DisplayPort] Error: ${err.message}`);
      });

      openedPort.on('close', () => {
        console.warn('[DisplayPort] Port closed.');
        displayPath = null;
        displayBaud = null;
      });

      const msg = openedBaud !== requestedBaud
        ? `Display started on ${portPath} @ ${openedBaud} baud (auto-detected — configured baud ${requestedBaud} failed). Update saved baud rate to ${openedBaud}.`
        : `Display started on ${portPath} @ ${openedBaud} baud`;

      resolve({ success: true, message: msg, baudRate: openedBaud });
    }
  });
}

// ── Low-level write helper ─────────────────────────────────────────────────────
function writeAndDrain(port, buf) {
  return new Promise((resolve, reject) => {
    port.write(buf, (err) => {
      if (err) return reject(err);
      port.drain((derr) => {
        if (derr) return reject(derr);
        resolve();
      });
    });
  });
}

// ── Send data to LED display ───────────────────────────────────────────────────
export async function sendToDisplay(data) {
  if (!displayPort || !displayPort.isOpen) {
    return { success: false, message: 'Display port is not open' };
  }

  // Validate: reject partial FAT block before any write
  const check = validateDisplayData(data);
  if (!check.valid) {
    console.warn(`[DisplayPort] Skipped — ${check.reason}`);
    return { success: false, skipped: true, reason: check.reason };
  }

  try {
    const str = formatRS232Display(data);

    // Assert 68-char frame before writing — any other length means a field width bug
    if (str.length !== 68) {
      const msg = `FRAME LENGTH ERROR: expected 68 chars, got ${str.length} — "${str}"`;
      console.error(`[DisplayPort] ${msg}`);
      return { success: false, message: msg };
    }

    const buf = Buffer.from(str + '\r', 'ascii');  // 68 + CR = 69 bytes
    console.log(`[DisplayPort] TX (68+CR=69 bytes): ${str}`);
    await writeAndDrain(displayPort, buf);
    console.log(`[DisplayPort] Sent OK`);
    return { success: true, frame: str };
  } catch (err) {
    console.error('[DisplayPort] sendToDisplay error:', err.message);
    return { success: false, message: err.message };
  }
}

// ── Send raw string to display with configurable terminator ───────────────────
// terminator: 'none' | 'cr' | 'crlf' | 'lf'  (default: 'none')
export async function sendRawToDisplay(rawStr, terminator = 'none') {
  if (!displayPort || !displayPort.isOpen) {
    return { success: false, message: 'Display port is not open' };
  }
  const suffix = terminator === 'cr' ? '\r' : terminator === 'crlf' ? '\r\n' : terminator === 'lf' ? '\n' : '';
  const full   = rawStr + suffix;
  const buf    = Buffer.from(full, 'ascii');
  console.log(`[DisplayPort] RAW write term=${terminator} (${buf.length} bytes): ${rawStr}`);
  console.log(`[DisplayPort] RAW HEX: ${buf.toString('hex')}`);
  try {
    await writeAndDrain(displayPort, buf);
    console.log(`[DisplayPort] RAW Sent OK`);
    return { success: true, frame: rawStr, terminator, hex: buf.toString('hex') };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ── Stop LED display port ──────────────────────────────────────────────────────
export function stopDisplay() {
  if (displayPort && displayPort.isOpen) {
    try { displayPort.close(); } catch {}
    console.log('[DisplayPort] Stopped.');
  }
  displayPort = null;
  displayPath = null;
  displayBaud = null;
}

// ── Display status ─────────────────────────────────────────────────────────────
export function getDisplayStatus() {
  return {
    isOpen:   displayPort ? displayPort.isOpen : false,
    portPath: displayPath,
    baudRate: displayBaud,
  };
}
