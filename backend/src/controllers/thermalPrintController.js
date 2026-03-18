/**
 * Thermal Print Controller — Everycom EC58 / 58mm ESC/POS
 * Uses Windows Print Spooler (winspool.drv) via PowerShell -EncodedCommand.
 * No .ps1 file, no execution policy issues, no PDF, no dialog.
 *
 * .env:  PRINTER_NAME=Everycom-58-Series
 */

import { spawnSync } from 'child_process';
import fs            from 'fs';
import os            from 'os';
import path          from 'path';

// ── ESC/POS constants ──────────────────────────────────────────────────────────
const W   = 32;
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const b     = (...bytes) => Buffer.from(bytes);
const lf    = ()         => b(LF);
const ascii = (s, max = W) =>
  Buffer.from(String(s || '').replace(/[^\x20-\x7E]/g, '?').slice(0, max), 'ascii');

const row = (label, value) => {
  const r = String(value || '');
  const l = String(label || '').padEnd(W - r.length).slice(0, W - r.length);
  return Buffer.concat([ascii(l + r), lf()]);
};
const line   = (s) => Buffer.concat([ascii(String(s || '').padEnd(W)), lf()]);
const center = (s) => {
  const str = String(s || '').slice(0, W);
  return Buffer.concat([ascii(' '.repeat(Math.floor((W - str.length) / 2)) + str), lf()]);
};
const dashes = () => Buffer.concat([ascii('-'.repeat(W)), lf()]);

const CMD = {
  init:       b(ESC, 0x40),
  alignLeft:  b(ESC, 0x61, 0x00),
  alignCtr:   b(ESC, 0x61, 0x01),
  boldOn:     b(ESC, 0x45, 0x01),
  boldOff:    b(ESC, 0x45, 0x00),
  dblSize:    b(ESC, 0x21, 0x30),
  normSize:   b(ESC, 0x21, 0x00),
  feed:       (n) => b(ESC, 0x64, n),
  cut:        b(GS, 0x56, 0x42, 0x00)
};

// ── Build 58mm ESC/POS receipt ─────────────────────────────────────────────────
const buildMilkReceipt = (d) => Buffer.concat([
  CMD.init,
  CMD.alignCtr,
  CMD.boldOn, CMD.dblSize,
  ascii('MILK RECEIPT'), lf(),
  CMD.normSize, CMD.boldOff,
  center(d.dateStr + ' | ' + (d.shift || '')),
  d.centerName ? center(d.centerName) : b(),
  CMD.alignLeft,
  dashes(),
  row('Bill No',   d.billNo),
  row('Mem No',    d.producerNo),
  line(d.producerName),
  dashes(),
  row('Litres',    Number(d.qty      || 0).toFixed(2) + ' L'),
  row('FAT %',     Number(d.fat      || 0).toFixed(2)),
  row('CLR',       Number(d.clr      || 0).toFixed(1)),
  row('SNF %',     Number(d.snf      || 0).toFixed(2)),
  dashes(),
  Number(d.water || 0) > 0 ? row('Water',     Number(d.water || 0).toFixed(2) + ' L') : b(),
  row('Rate/Ltr',  'Rs.' + Number(d.rate      || 0).toFixed(2)),
  Number(d.incentive || 0) > 0 ? row('Incentive', 'Rs.' + Number(d.incentive || 0).toFixed(2)) : b(),
  dashes(),
  CMD.boldOn,
  row('AMOUNT', 'Rs.' + Number(d.amount || 0).toFixed(2)),
  CMD.boldOff,
  dashes(),
  CMD.alignCtr,
  center('Thank You'),
  CMD.feed(4),
  CMD.cut
]);

// ── Build PowerShell EncodedCommand ───────────────────────────────────────────
// Single-quoted here-string (@'...'@) is safe for C# — no PS variable expansion
const buildEncodedCommand = (tmpFile, printerName) => {
  // Escape single quotes in path/name for PS single-quoted here-string
  const safeFile    = tmpFile.replace(/'/g, "''");
  const safePrinter = printerName.replace(/'/g, "''");

  // CallingConvention.StdCall is required for all winspool.drv exports
  const ps = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrint2 {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFO {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", EntryPoint="OpenPrinterA",    SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
    [DllImport("winspool.drv", EntryPoint="ClosePrinter",                       CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern int  StartDocPrinter(IntPtr h, int l, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
    [DllImport("winspool.drv", EntryPoint="EndDocPrinter",                      CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="StartPagePrinter",                   CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="EndPagePrinter",                     CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="WritePrinter",    SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr h, IntPtr p, int c, out int w);
    public static string Go(string name, byte[] data) {
        IntPtr hp;
        if (!OpenPrinter(name, out hp, IntPtr.Zero))
            return "OpenPrinter failed (Win32=" + Marshal.GetLastWin32Error() + ") for: " + name;
        var di = new DOCINFO { pDocName="ESCPOS", pDataType="RAW" };
        int docId = StartDocPrinter(hp, 1, di);
        if (docId == 0) {
            int e = Marshal.GetLastWin32Error();
            ClosePrinter(hp);
            return "StartDocPrinter failed (Win32=" + e + ")";
        }
        if (!StartPagePrinter(hp)) {
            int e = Marshal.GetLastWin32Error();
            EndDocPrinter(hp); ClosePrinter(hp);
            return "StartPagePrinter failed (Win32=" + e + ")";
        }
        var ptr = Marshal.AllocHGlobal(data.Length);
        Marshal.Copy(data, 0, ptr, data.Length);
        int w; bool ok = WritePrinter(hp, ptr, data.Length, out w);
        int we = Marshal.GetLastWin32Error();
        Marshal.FreeHGlobal(ptr);
        EndPagePrinter(hp); EndDocPrinter(hp); ClosePrinter(hp);
        if (!ok) return "WritePrinter failed (Win32=" + we + ", wrote=" + w + "/" + data.Length + ")";
        return "OK";
    }
}
'@
$bytes  = [System.IO.File]::ReadAllBytes('${safeFile}')
$result = [RawPrint2]::Go('${safePrinter}', $bytes)
if ($result -ne 'OK') { Write-Error $result; exit 1 }
exit 0
`;

  // Encode as UTF-16LE base64 — required by PowerShell -EncodedCommand
  return Buffer.from(ps, 'utf16le').toString('base64');
};

// ── Get installed printer list ─────────────────────────────────────────────────
const getPrinterList = () => {
  const r = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive',
    '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'
  ], { timeout: 8000, windowsHide: true });
  return (r.stdout?.toString() || '').split('\n').map(s => s.trim()).filter(Boolean);
};

// ── Send raw bytes to printer ──────────────────────────────────────────────────
const sendRaw = (buffer) => {
  const printerName = (process.env.PRINTER_NAME || 'Everycom-58-Series').trim();

  // Pre-flight: verify printer is installed
  const printers = getPrinterList();
  const found = printers.some(n => n.toLowerCase() === printerName.toLowerCase());
  if (!found) {
    throw new Error(
      `Printer "${printerName}" not found in Windows. Available printers: [${printers.join(', ')}]. ` +
      `Update PRINTER_NAME in backend/.env to one of these names.`
    );
  }

  const tmpFile = path.join(os.tmpdir(), `escpos_${Date.now()}.bin`);

  try {
    fs.writeFileSync(tmpFile, buffer);

    const encoded = buildEncodedCommand(tmpFile, printerName);

    const result = spawnSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand', encoded
    ], { timeout: 30000, windowsHide: true });

    const stdout = result.stdout?.toString().trim();
    const stderr = result.stderr?.toString().trim();

    // Always log for server-side debugging
    if (stdout) console.log('[ThermalPrint stdout]', stdout);
    if (stderr) console.error('[ThermalPrint stderr]', stderr);

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(stderr || stdout || `PowerShell exit ${result.status}`);
    }
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
};

// ── Build 58mm ESC/POS receipt for Milk Sales ──────────────────────────────────
const buildMilkSalesReceipt = (d) => {
  const isLocal = d.saleMode === 'LOCAL' || d.saleMode === 'SAMPLE';
  return Buffer.concat([
    CMD.init,
    CMD.alignCtr,
    CMD.boldOn, CMD.dblSize,
    ascii('MILK SALES'), lf(),
    CMD.normSize, CMD.boldOff,
    center((d.dateStr || '') + ' | ' + (d.session || '') + ' | ' + (d.saleMode || '')),
    CMD.alignLeft,
    dashes(),
    row('Bill No',  d.billNo),
    isLocal
      ? (d.centerName ? row('Center', d.centerName) : b())
      : (d.creditorName ? row('Creditor', d.creditorName) : b()),
    !isLocal && d.centerName  ? row('Center', d.centerName)  : b(),
    !isLocal && d.agentName   ? row('Agent',  d.agentName)   : b(),
    dashes(),
    row('Litres',   Number(d.litre  || 0).toFixed(2) + ' L'),
    row('Rate/Ltr', 'Rs.' + Number(d.rate || 0).toFixed(2)),
    isLocal ? row('Payment', d.paymentType || 'Cash') : b(),
    dashes(),
    CMD.boldOn,
    row('AMOUNT', 'Rs.' + Number(d.amount || 0).toFixed(2)),
    CMD.boldOff,
    dashes(),
    CMD.alignCtr,
    center('Thank You'),
    CMD.feed(4),
    CMD.cut
  ]);
};

// ── Route handlers ─────────────────────────────────────────────────────────────

// POST /api/print/milk-receipt
export const printMilkReceipt = async (req, res) => {
  try {
    const buffer = buildMilkReceipt(req.body);
    sendRaw(buffer);   // synchronous — throws on error
    res.json({ success: true });
  } catch (err) {
    console.error('[ThermalPrint] FAILED:', err.message);
    // Return the full error so frontend can show useful notification
    res.status(500).json({ success: false, message: err.message, hint: 'Check PRINTER_NAME in backend/.env' });
  }
};

// POST /api/print/milk-sales-receipt
export const printMilkSalesReceipt = async (req, res) => {
  try {
    const buffer = buildMilkSalesReceipt(req.body);
    sendRaw(buffer);
    res.json({ success: true });
  } catch (err) {
    console.error('[ThermalPrint] FAILED:', err.message);
    res.status(500).json({ success: false, message: err.message, hint: 'Check PRINTER_NAME in backend/.env' });
  }
};

// GET /api/print/status  — lists all installed printers so you can verify PRINTER_NAME
export const printerStatus = async (req, res) => {
  const printerName = (process.env.PRINTER_NAME || '').trim();

  const r = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive',
    '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'
  ], { timeout: 6000, windowsHide: true });

  const list = (r.stdout?.toString() || '').split('\n').map(s => s.trim()).filter(Boolean);
  const found = list.some(n => n.toLowerCase() === printerName.toLowerCase());

  res.json({
    configured:  printerName || '(not set)',
    found,
    status:      found ? '✅ Ready' : '❌ Not found — check PRINTER_NAME in .env',
    allPrinters: list
  });
};
