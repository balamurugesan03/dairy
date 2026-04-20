/**
 * MilkPurchase — Modern Card-Based Professional Layout
 * Header | [Bill Info] [10-Day Avg] [Current Entry] | Table
 * Keyboard: Member No Enter→lookup, Tab→LTR→FAT→CLR→SNF, Enter=Save, Enter again=Print
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io as socketIO } from 'socket.io-client';
import {
  Box, Group, Text, TextInput, NumberInput, Select, Button,
  Table, ScrollArea, ActionIcon, Badge, Divider, Center,
  Loader, Avatar, Card, SimpleGrid, Stack, Checkbox,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';
import {
  IconSearch, IconUser, IconDeviceFloppy,
  IconTrash, IconPrinter, IconX, IconMilk, IconBuilding,
  IconAlertCircle, IconRefresh, IconId, IconReceipt,
  IconDroplet, IconFlame, IconChartBar,
  IconPlus, IconEdit, IconBan, IconHistory,
  IconPlugConnected, IconPlugConnectedX, IconScale,
} from '@tabler/icons-react';
import {
  agentAPI, collectionCenterAPI, farmerAPI,
  milkCollectionAPI, milkPurchaseSettingsAPI, rateChartAPI, milkSalesAPI,
  thermalPrintAPI, machineConfigAPI, timeIncentiveAPI, shiftIncentiveAPI,
} from '../../services/api';

// ── Rate Calculation ─────────────────────────────────────────────────────────
const fallbackRate = (fat, clr) =>
  parseFloat((fat * 5.5 + (clr || 26) * 0.15 + 10).toFixed(2));

const calcRateFromChart = (fat, clr, snf, chartType, chartRows) => {
  if (!chartRows?.length) return null;
  const today = new Date();
  const effective = chartRows.filter(r => new Date(r.fromDate) <= today);
  if (!effective.length) return null;
  const sorted = [...effective].sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));
  if (chartType === 'ApplyFormula') {
    const f = sorted[0];
    const fatOk = (!f.minFAT || fat >= f.minFAT) && (!f.maxFAT || fat <= f.maxFAT);
    const snfOk = (!f.minSNF || (snf || 0) >= f.minSNF) && (!f.maxSNF || (snf || 0) <= f.maxSNF);
    if (!fatOk || !snfOk) return null;
    return parseFloat((fat * f.fatRate + (snf || 0) * f.snfRate).toFixed(4));
  }
  if (chartType === 'SlabRate') return parseFloat(sorted[0].slabRate);
  if (chartType === 'ManualEntry' || chartType === 'LowChart') {
    const best = sorted.reduce((prev, row) => {
      const d = Math.abs(row.clr - clr) + Math.abs(row.fat - fat);
      const pd = Math.abs(prev.clr - clr) + Math.abs(prev.fat - fat);
      return d < pd ? row : prev;
    });
    return parseFloat(best.rate);
  }
  if (chartType === 'GoldLessChart') {
    const g = sorted[0];
    const adj = g.toggle === 'Less' ? -g.value : g.value;
    return parseFloat((fallbackRate(fat, clr) + adj).toFixed(2));
  }
  return null;
};

// ── Shift Incentive amount calculator ──────────────────────────────────────────
const calcShiftIncentiveAmt = (incentives, netKg, netLtr, fat, snf, baseAmount) => {
  if (!incentives || incentives.length === 0) return 0;
  let total = 0;
  for (const inc of incentives) {
    if (inc.rateBased?.enabled) {
      if (inc.rateBased.qty)    total += inc.rateBased.rate * netKg;
      else if (inc.rateBased.amount) total += inc.rateBased.rate;
    }
    if (inc.percentageBased?.enabled) {
      if (inc.percentageBased.qty)    total += (inc.percentageBased.rate / 100) * netKg;
      else if (inc.percentageBased.amount) total += (inc.percentageBased.rate / 100) * baseAmount;
    }
    if (inc.parameterBased?.enabled) {
      const { belowFat, belowSnf, belowAmount, aboveFat, aboveSnf, aboveAmount } = inc.parameterBased;
      if (fat > 0 && snf > 0) {
        if (fat < belowFat && snf < belowSnf) total += belowAmount;
        else if (fat >= aboveFat && snf >= aboveSnf) total += aboveAmount;
      }
    }
  }
  return parseFloat(total.toFixed(2));
};

const calcValues = (qty, fat, clr, snf, chartType, chartRows) => {
  if (!qty || !fat) return { snf: snf || 0, incentive: 0, rate: 0, amount: 0 };
  const chartRate = calcRateFromChart(fat, clr || 0, snf || 0, chartType, chartRows);
  const rate = chartRate !== null ? chartRate : fallbackRate(fat, clr || 0);
  const incentive = 0;
  const amount = parseFloat((qty * rate).toFixed(2));
  const autoSnf = snf || parseFloat(((fat / 0.21) * 0.125 + 0.082 * (clr || 26)).toFixed(2));
  return { snf: autoSnf, incentive, rate: parseFloat(rate.toFixed(2)), amount };
};

// ── Thermal Print — fires ESC/POS via backend → USB port, zero dialog ─────────
const printBill = (entry, dateStr, shift, centerName) => {
  thermalPrintAPI.milkReceipt({
    billNo:       entry.billNo,
    producerNo:   entry.producerNo,
    producerName: entry.producerName,
    qty:          entry.qty,
    fat:          entry.fat,
    clr:          entry.clr,
    snf:          entry.snf,
    water:        entry.addedWater || 0,
    rate:         entry.rate,
    incentive:    entry.incentive,
    amount:       entry.amount,
    dateStr,
    shift,
    centerName:   centerName || ''
  }).catch(err => {
    // Show the actual error so user can fix PRINTER_NAME in .env
    const msg = err?.response?.data?.message || err.message || 'Thermal print failed';
    console.warn('[ThermalPrint] API failed:', msg);
    notifications.show({ color: 'orange', title: 'Thermal Print Failed — using PDF fallback', message: msg, autoClose: 8000 });
    const html = `<html><head><title>Milk Receipt</title>
    <style>
      @page{size:58mm auto;margin:2mm 3mm}
      body{font-family:'Courier New',monospace;font-size:10px;width:52mm;margin:0}
      h3{text-align:center;margin:0 0 1px;font-size:11px;font-weight:900}
      .sub{text-align:center;font-size:9px;color:#444;margin-bottom:4px}
      .line{border-top:1px dashed #000;margin:3px 0}
      .row{display:flex;justify-content:space-between;margin:2px 0}
      .val{font-weight:bold;white-space:nowrap}
      .big{font-size:12px;font-weight:900}
      .foot{text-align:center;font-size:9px;color:#666;margin-top:4px}
    </style></head><body>
    <h3>MILK RECEIPT</h3>
    <div class="sub">${dateStr} | ${shift}${centerName ? `<br>${centerName}` : ''}</div>
    <div class="line"></div>
    <div class="row"><span>Bill No</span><span class="val">${entry.billNo}</span></div>
    <div class="row"><span>Mem No</span><span class="val">${entry.producerNo}</span></div>
    <div class="row"><span colspan="2">${entry.producerName}</span></div>
    <div class="line"></div>
    <div class="row"><span>Litres</span><span class="val">${Number(entry.qty).toFixed(2)} L</span></div>
    <div class="row"><span>FAT %</span><span>${Number(entry.fat).toFixed(1)}</span></div>
    <div class="row"><span>CLR</span><span>${Number(entry.clr).toFixed(1)}</span></div>
    <div class="row"><span>SNF %</span><span>${Number(entry.snf).toFixed(2)}</span></div>
    ${Number(entry.addedWater || 0) > 0 ? `<div class="row"><span>Water</span><span>${Number(entry.addedWater).toFixed(2)} L</span></div>` : ''}
    <div class="row"><span>Rate/Ltr</span><span class="val">Rs.${Number(entry.rate).toFixed(2)}</span></div>
    ${Number(entry.incentive || 0) > 0 ? `<div class="row"><span>Incentive</span><span>Rs.${Number(entry.incentive).toFixed(2)}</span></div>` : ''}
    <div class="line"></div>
    <div class="row big"><span>AMOUNT</span><span>Rs.${Number(entry.amount).toFixed(2)}</span></div>
    <div class="line"></div>
    <div class="foot">Thank You</div>
    </body></html>`;
    const old = document.getElementById('__milk_print_frame__');
    if (old) old.remove();
    const iframe = document.createElement('iframe');
    iframe.id = '__milk_print_frame__';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:58mm;height:1px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 1000); }, 250);
  });
};

// ── Small stat card for 10-day avg ───────────────────────────────────────────
const AvgCard = ({ label, value, unit, icon, color, bg }) => (
  <Box style={{ background: bg, border: `1.5px solid ${color}33`, borderRadius: 10, padding: '10px 14px', textAlign: 'center', flex: 1 }}>
    <Group gap={4} justify="center" mb={4}>{icon}<Text size="10px" fw={700} c={color} tt="uppercase" style={{ letterSpacing: '0.5px' }}>{label}</Text></Group>
    <Text size="22px" fw={900} style={{ color, lineHeight: 1 }}>{value}</Text>
    {unit && <Text size="9px" c="dimmed" mt={2}>{unit}</Text>}
  </Box>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
// Convert any date-like value (Date, dayjs, string) to a native JS Date
const toDate = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d?.toDate === 'function') return d.toDate(); // dayjs / moment
  return new Date(d);
};

const MilkPurchase = () => {
  const [centersData, setCentersData] = useState([]);
  const [agentsData,  setAgentsData]  = useState([]);
  const [date,   setDate]   = useState(new Date());
  const navigate = useNavigate();
  const [shift,  setShift]  = useState('AM');
  const [center, setCenter] = useState('');
  const [agent,  setAgent]  = useState('');

  const [memberInput,   setMemberInput]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [producer,      setProducer]      = useState(null);
  const [billNo,        setBillNo]        = useState('');

  const [ltr, setLtr] = useState('');
  const [water, setWater] = useState('');
  const [fat, setFat] = useState('');
  const [clr, setClr] = useState('');
  const [snf, setSnf] = useState('');

  const [calcResult,  setCalcResult]  = useState({ snf: 0, incentive: 0, rate: 0, amount: 0 });
  const [activeChart, setActiveChart] = useState('ApplyFormula');
  const [chartRows,   setChartRows]   = useState([]);

  const [entries,        setEntries]        = useState([]);
  const [selectedRow,    setSelectedRow]    = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [editingId,      setEditingId]      = useState(null);   // row being edited
  const [historySearch,  setHistorySearch]  = useState('');     // filter text
  const [showHistory,    setShowHistory]    = useState(false);  // search bar toggle

  const memberRef   = useRef(null);
  const dropdownRef = useRef(null);
  const ltrRef      = useRef(null);
  const waterRef    = useRef(null);
  const fatRef      = useRef(null);
  const clrRef      = useRef(null);
  const snfRef      = useRef(null);

  // ── Control Panel State ────────────────────────────────────────────────────
  const [salesSummary, setSalesSummary] = useState({ localLtr: 0, localAmt: 0, creditLtr: 0, creditAmt: 0, sampleLtr: 0, sampleAmt: 0 });
  const [dupBlocked,  setDupBlocked]  = useState(false);
  const [dupInfo,     setDupInfo]     = useState(null); // { name, billNo, amount, center }
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [cpMode,      setCpMode]      = useState([]);
  const [paramCombo,  setParamCombo]  = useState('CLR-FAT'); // 'CLR-FAT' | 'FAT-SNF'
  const [qtyUnit,     setQtyUnit]     = useState('Litre');   // 'Litre' | 'KG'
  // Keep ref in sync so the socket handler (which captures nothing) can read latest value
  useEffect(() => { analyzerModeRef.current = cpMode.includes('Analyzer'); }, [cpMode]);
  const [entryMode,   setEntryMode]   = useState('chart'); // 'chart' = auto from rate chart | 'rate' = manual rate→auto amount | 'amount' = manual amount→auto rate
  const [manualRate,  setManualRate]  = useState('');
  const [manualAmount,setManualAmount]= useState('');
  const manualRateRef   = useRef(null);
  const manualAmountRef = useRef(null);

  const [activeTimeIncentive,   setActiveTimeIncentive]   = useState(null);
  const [activeShiftIncentives, setActiveShiftIncentives] = useState([]);

  const clrAutoSetRef  = useRef(false);   // prevents SNF recompute when CLR is auto-filled from SNF
  const autoSaveRef    = useRef(false);   // triggers auto-save after SNF/CLR is computed
  const tableScrollRef = useRef(null);
  const justSavedRef  = useRef(false);
  const lastEntryRef  = useRef(null);
  const centerNameRef = useRef('');
  const formRef       = useRef({});

  // ── Machine / Analyzer State ───────────────────────────────────────────────
  const [machineConnected,   setMachineConnected]   = useState(false);
  const [machineStatus,      setMachineStatus]      = useState('');
  const [socketConnected,    setSocketConnected]    = useState(false);
  const [analyzerDeviceName, setAnalyzerDeviceName] = useState('');
  const [analyzerRunning,    setAnalyzerRunning]    = useState(false);
  const [analyzerStarting,   setAnalyzerStarting]   = useState(false);
  const [liveAnalyzerData,   setLiveAnalyzerData]   = useState(null); // { fat, snf, density, addedWater, timestamp }
  const [availablePorts,     setAvailablePorts]     = useState([]);
  const [portsLoading,       setPortsLoading]       = useState(false);
  const [selectedPort,       setSelectedPort]       = useState('COM2');
  const [selectedBaud,       setSelectedBaud]       = useState('2400');
  const [portError,          setPortError]          = useState('');
  const analyzerModeRef         = useRef(false);  // tracks cpMode.includes('Analyzer') for use inside socket handler
  const analyzerDeviceNameRef   = useRef('');
  const analyzerDataCapturedRef = useRef(false);  // true after reading captured — blocks re-fill until NEW reading
  const lastCapturedReadingRef  = useRef(null);   // rawData key of last captured reading — skip same reading after save
  useEffect(() => { analyzerDeviceNameRef.current = analyzerDeviceName; }, [analyzerDeviceName]);
  const serialPortRef   = useRef(null);
  const serialReaderRef = useRef(null);
  const machineBufferRef = useRef('');    // accumulate partial serial data
  const scaleLastFilledRef = useRef(null); // last kg value filled into LTR — skip same value to avoid overwrite

  // ── Weight Scale (CH340 / rotary encoder via backend Socket.io) state ───────
  const [scaleConnected,   setScaleConnected]   = useState(false);
  const [scaleStatus,      setScaleStatus]      = useState('');
  const [scaleStarting,    setScaleStarting]    = useState(false);
  // ── LED Display state ────────────────────────────────────────────────────────
  const [displayConnected, setDisplayConnected] = useState(false);
  const [displayStarting,  setDisplayStarting]  = useState(false);
  const displaySendTimerRef = useRef(null);  // debounce for display sends
  formRef.current = { producer, ltr, water, fat, clr, snf, date, shift, center, agent, calcResult, editingId, speakEnabled, entries, dupBlocked, entryMode, manualRate, manualAmount, activeTimeIncentive, activeShiftIncentives, cpMode, scaleConnected, displayConnected };

  // ── Send to LED Display whenever entry values change ──────────────────────
  useEffect(() => {
    if (!displayConnected) return;

    // FAT/SNF/CLR must ALL be present or ALL absent — never partial
    const hasFat = fat !== '' && !isNaN(Number(fat));
    const hasSnf = snf !== '' && !isNaN(Number(snf));
    const hasClr = clr !== '' && !isNaN(Number(clr));
    const fatGroupOk = (hasFat && hasSnf && hasClr) || (!hasFat && !hasSnf && !hasClr);
    if (!fatGroupOk) return; // still typing — wait for all three

    clearTimeout(displaySendTimerRef.current);
    displaySendTimerRef.current = setTimeout(() => {
      machineConfigAPI.sendDisplay({
        id:     producer?.no || producer?.memberNo || '',
        fat:    hasFat ? Number(fat)   : null,
        snf:    hasSnf ? Number(snf)   : null,
        clr:    hasClr ? Number(clr)   : null,
        qty:    ltr   !== '' ? Number(ltr)   : null,
        rate:   calcResult.rate   > 0 ? calcResult.rate   : null,
        amount: calcResult.amount > 0 ? calcResult.amount : null,
        water:  water !== '' ? Number(water) : null,
      }).catch(() => {});
    }, 200);
  }, [displayConnected, producer, ltr, fat, clr, snf, water, calcResult]);

  // ── Machine Serial Data Parser ────────────────────────────────────────────
  // Format 0: 31-char ASCII  (XXXXXXXXXXXXXXXXXXXXXXXXXXXXX)
  //   inside[0..3]=FAT/100  inside[4..7]=SNF/100  inside[8..11]=Density  inside[12..13]=Water%
  // Format 1: Lactoscan      F=4.50 SNF=8.35 D=26.50 L=5.000 W=0.0
  // Format 2: CSV            5.00,4.50,26.5,8.30,0.00  (LTR,FAT,CLR,SNF,WATER)
  // Format 3: Key:Value      FAT:4.5 CLR:26.5 SNF:8.3 LTR:5.0
  const parseMachineData = useCallback((raw) => {
    const text = raw.trim();
    if (!text) return;

    let ltrVal, fatVal, clrVal, snfVal, waterVal;

    // Format 0 — 31-char frame: (XXXXXXXXXXXXXXXXXXXXXXXXXXXXX)
    const frameIdx = text.indexOf('(');
    if (frameIdx !== -1) {
      const closeIdx = text.indexOf(')', frameIdx);
      if (closeIdx !== -1 && closeIdx - frameIdx === 30) {
        const inner = text.slice(frameIdx + 1, frameIdx + 30);
        const fat4  = parseInt(inner.slice(0, 4),  10);
        const snf4  = parseInt(inner.slice(4, 8),  10);
        const water2= parseInt(inner.slice(14, 16),10);  // positions 15-16
        if (!isNaN(fat4) && !isNaN(snf4)) {
          fatVal   = fat4 / 100;
          snfVal   = snf4 / 100;
          waterVal = isNaN(water2) ? 0 : water2;
          // no CLR or LTR in this format
        }
      }
    }

    // Format 1 — Lactoscan
    if (fatVal == null && /\bF=\d/.test(text)) {
      const g = (re) => { const m = text.match(re); return m ? parseFloat(m[1]) : null; };
      fatVal   = g(/\bF=(\d+\.?\d*)/i);
      snfVal   = g(/\bSNF=(\d+\.?\d*)/i);
      clrVal   = g(/\bD=(\d+\.?\d*)/i);
      ltrVal   = g(/\bL=(\d+\.?\d*)/i);
      waterVal = g(/\bW=(\d+\.?\d*)/i);
    }
    // Format 2 — CSV
    else if (fatVal == null && /^\d+\.?\d*,\d/.test(text) && !text.includes(':')) {
      const parts = text.split(',').map(parseFloat);
      if (parts.length >= 4) [ltrVal, fatVal, clrVal, snfVal, waterVal] = parts;
    }
    // Format 3 — Key:Value
    else if (fatVal == null && /FAT:|CLR:|SNF:/i.test(text)) {
      const g = (re) => { const m = text.match(re); return m ? parseFloat(m[1]) : null; };
      fatVal   = g(/FAT:(\d+\.?\d*)/i);
      clrVal   = g(/CLR:(\d+\.?\d*)/i);
      snfVal   = g(/SNF:(\d+\.?\d*)/i);
      ltrVal   = g(/LTR:(\d+\.?\d*)/i);
      waterVal = g(/WATER:(\d+\.?\d*)/i);
    }

    if (fatVal == null) return; // unrecognised format

    if (ltrVal   != null) setLtr(String(parseFloat(ltrVal).toFixed(2)));
    if (fatVal   != null) setFat(String(parseFloat(fatVal).toFixed(1)));
    if (clrVal   != null) setClr(String(parseFloat(clrVal).toFixed(1)));
    if (snfVal   != null) setSnf(String(parseFloat(snfVal).toFixed(2)));
    if (waterVal != null && waterVal > 0) setWater(String(parseFloat(waterVal).toFixed(2)));

    const status = `FAT:${parseFloat(fatVal).toFixed(1)}  SNF:${parseFloat(snfVal ?? 0).toFixed(2)}${clrVal != null ? `  CLR:${parseFloat(clrVal).toFixed(1)}` : ''}`;
    setMachineStatus(status);
    notifications.show({ title: 'Machine Reading', message: `FAT ${parseFloat(fatVal).toFixed(1)} | SNF ${parseFloat(snfVal ?? 0).toFixed(2)}${waterVal > 0 ? ` | Water ${waterVal}%` : ''}`, color: 'green', autoClose: 2000 });

    if (!formRef.current.producer) memberRef.current?.focus();
  }, []);

  // ── Machine Connect / Disconnect ──────────────────────────────────────────
  const connectMachine = useCallback(async () => {
    if (!('serial' in navigator)) {
      notifications.show({ title: 'Not Supported', message: 'Web Serial API requires Chrome/Edge browser (HTTPS or localhost)', color: 'red' });
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      serialPortRef.current = port;

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      serialReaderRef.current = reader;

      setMachineConnected(true);
      setMachineStatus('Connected — waiting for reading…');
      notifications.show({ title: 'Machine Connected', message: 'Serial port opened. Send reading from machine.', color: 'teal' });

      // Read loop
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            machineBufferRef.current += value;
            // Process complete lines
            const lines = machineBufferRef.current.split(/[\r\n]+/);
            machineBufferRef.current = lines.pop(); // keep partial last line
            lines.forEach(line => { if (line.trim()) parseMachineData(line); });
          }
        } catch {
          // port closed or error — already handled by disconnect
        } finally {
          setMachineConnected(false);
          setMachineStatus('');
        }
      })();
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        notifications.show({ title: 'Connection Failed', message: err.message, color: 'red' });
      }
    }
  }, [parseMachineData]);

  const disconnectMachine = useCallback(async () => {
    try { serialReaderRef.current?.cancel(); } catch {}
    try { await serialPortRef.current?.close(); } catch {}
    serialPortRef.current  = null;
    serialReaderRef.current = null;
    machineBufferRef.current = '';
    setMachineConnected(false);
    setMachineStatus('');
    notifications.show({ title: 'Machine Disconnected', color: 'orange', autoClose: 1500 });
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { disconnectMachine(); }, [disconnectMachine]);

  // ── Weight Scale: connect via backend (Socket.io + serialport) ──────────────
  // Backend reads the port configured in MilkPurchaseSettings → weighingScaleConfig
  // and emits 'weight-scale-stable' when a stable reading is confirmed (debounced).
  const connectScale = useCallback(async () => {
    setScaleStarting(true);
    try {
      const res = await machineConfigAPI.startScale();
      if (res?.success) {
        setScaleConnected(true);
        setScaleStatus('Connected — waiting for reading…');
        notifications.show({ title: 'Scale Connected', message: res.message, color: 'teal', autoClose: 3000 });
      } else {
        notifications.show({ title: 'Scale Failed', message: res?.message || 'Could not open scale port', color: 'red', autoClose: 6000 });
      }
    } catch (err) {
      notifications.show({ title: 'Scale Error', message: err.message, color: 'red' });
    } finally {
      setScaleStarting(false);
    }
  }, []);

  const disconnectScale = useCallback(async () => {
    try { await machineConfigAPI.stopScale(); } catch {}
    setScaleConnected(false);
    setScaleStatus('');
    notifications.show({ title: 'Scale Disconnected', color: 'orange', autoClose: 1500 });
  }, []);

  const sendTare = useCallback(async () => {
    try {
      await machineConfigAPI.scaleTare();
      scaleLastFilledRef.current = null; // reset so next stable reading fills LTR again
      setScaleStatus('⚖ Tare sent — scale zeroed');
    } catch (err) {
      notifications.show({ title: 'Tare Failed', message: err.message, color: 'red', autoClose: 3000 });
    }
  }, []);

  // ── LED Display: connect / disconnect ────────────────────────────────────
  const connectDisplay = useCallback(async () => {
    setDisplayStarting(true);
    try {
      const res = await machineConfigAPI.startDisplay();
      if (res?.success) {
        setDisplayConnected(true);
        notifications.show({ title: 'Display Connected', message: res.message, color: 'teal', autoClose: 3000 });
      } else {
        notifications.show({ title: 'Display Failed', message: res?.message || 'Could not open display port', color: 'red', autoClose: 6000 });
      }
    } catch (err) {
      notifications.show({ title: 'Display Error', message: err.message, color: 'red' });
    } finally {
      setDisplayStarting(false);
    }
  }, []);

  const disconnectDisplay = useCallback(async () => {
    try { await machineConfigAPI.stopDisplay(); } catch {}
    setDisplayConnected(false);
    notifications.show({ title: 'Display Disconnected', color: 'orange', autoClose: 1500 });
  }, []);



  // ── Start backend analyzer via API ────────────────────────────────────────
  const handleStartAnalyzer = async () => {
    if (!selectedPort) {
      setPortError('Select a COM port first');
      return;
    }
    setPortError('');
    setAnalyzerStarting(true);
    try {
      const res = await machineConfigAPI.start({ port: selectedPort, baudRate: parseInt(selectedBaud, 10) });
      if (res?.success) {
        setAnalyzerRunning(true);
        notifications.show({ color: 'teal', title: 'Analyzer Started', message: res.message, autoClose: 3000 });
      } else {
        setPortError(res?.message || 'Failed to open port');
        notifications.show({ color: 'red', title: 'Start Failed', message: res?.message, autoClose: 5000 });
      }
    } catch (err) {
      const msg = err?.message || 'Failed to start analyzer';
      setPortError(msg);
      notifications.show({ color: 'red', title: 'Error', message: msg, autoClose: 5000 });
    } finally {
      setAnalyzerStarting(false);
    }
  };

  const handleScanPorts = async () => {
    setPortsLoading(true);
    try {
      const res = await machineConfigAPI.listPorts();
      const list = (res?.data || []).map(p => p.path);
      setAvailablePorts(list);
      if (list.length && !selectedPort) setSelectedPort(list[0]);
      if (!list.length) setPortError('No COM ports found. Check USB/RS-232 cable.');
      else setPortError('');
    } catch { /* silent */ }
    finally { setPortsLoading(false); }
  };

  const handleStopAnalyzer = async () => {
    try {
      await machineConfigAPI.stop();
      setAnalyzerRunning(false);
      setLiveAnalyzerData(null);
      notifications.show({ color: 'orange', title: 'Analyzer Stopped', autoClose: 2000 });
    } catch { /* silent */ }
  };

  // ── Socket.io — Backend Serial Port ───────────────────────────────────────
  // Receives data from Node.js serialport service and feeds into parseMachineData
  useEffect(() => {
    const socket = socketIO('http://localhost:5000');

    socket.on('connect', () => {
      setSocketConnected(true);
    });
    socket.on('disconnect', () => {
      setSocketConnected(false);
      setMachineStatus('');
    });

    socket.on('milk-analyzer-data', (data) => {
      // Always store live reading regardless of Analyzer mode toggle
      setLiveAnalyzerData({
        fat:        data.fat,
        snf:        data.snf,
        clr:        data.clr,
        ltr:        data.ltr,
        density:    data.density,
        addedWater: data.addedWater ?? 0,
        timestamp:  data.timestamp,
        rawData:    data.rawData,
      });
      setAnalyzerRunning(true);

      // Only fill the form when "Analyzer" is ticked in MODE panel
      if (!analyzerModeRef.current) return;

      // Use rawData (or fat-snf) as a unique key for this reading
      const readingKey = data.rawData || `${data.fat}-${data.snf}`;

      // If machine sends a NEW different reading, unlock capture for next entry
      if (analyzerDataCapturedRef.current && readingKey !== lastCapturedReadingRef.current) {
        analyzerDataCapturedRef.current = false;
      }

      // Block re-fill for the SAME reading (already captured / just saved)
      if (analyzerDataCapturedRef.current) return;
      analyzerDataCapturedRef.current = true;
      lastCapturedReadingRef.current  = readingKey;

      const f = data;
      if (f.fat  != null) setFat(String(parseFloat(f.fat).toFixed(1)));
      if (f.snf  != null) setSnf(String(parseFloat(f.snf).toFixed(2)));
      if (f.ltr  != null) setLtr(String(parseFloat(f.ltr).toFixed(2)));
      if (f.addedWater != null && f.addedWater > 0) setWater(String(parseFloat(f.addedWater).toFixed(2)));
      // CLR: use machine value if given; otherwise auto-calculate from FAT+SNF
      if (f.clr != null) {
        setClr(String(parseFloat(f.clr).toFixed(1)));
      } else if (f.fat != null && f.snf != null) {
        const autoClr = parseFloat(((4 * f.snf) - (0.8 * f.fat) - 2).toFixed(1));
        setClr(String(autoClr));
      }

      const status = `FAT:${f.fat ?? '-'}  SNF:${f.snf ?? '-'}  CLR:${f.clr != null ? f.clr : (f.fat != null && f.snf != null ? parseFloat(((4*f.snf)-(0.8*f.fat)-2).toFixed(1)) : '-')}`;
      setMachineStatus(status);
      notifications.show({ title: `${analyzerDeviceNameRef.current || 'Analyzer'} Reading`, message: `FAT ${f.fat ?? '-'} | SNF ${f.snf ?? '-'}${f.addedWater > 0 ? ` | Water ${f.addedWater}%` : ''}`, color: 'green', autoClose: 2000 });

      if (!formRef.current.producer) memberRef.current?.focus();
    });

    // ── Weight scale socket events ───────────────────────────────────────────
    // Helper: fill LTR from kg — called from both stable events
   const fillLtrFromKg = (kg) => {
  if (isNaN(kg) || kg < 0.0) return;  // ✅ 0.0, minus, noise எல்லாம் block
  if (scaleLastFilledRef.current === kg) return;
  scaleLastFilledRef.current = kg;
  setLtr(String(parseFloat(kg)));
  setTimeout(() => fatRef.current?.focus(), 80);
};

    socket.on('weight-scale-data', (data) => {
      const kg = Number(data.value);
      setScaleStatus(`${data.stable ? '⚖ Stable' : '~ Unstable'} — ${kg.toFixed(2)} kg`);
      if (!data.stable) scaleLastFilledRef.current = null;
      if (data.stable) fillLtrFromKg(kg);
    });

    socket.on('weight-scale-stable', (data) => {
      // Primary path: backend-debounced stable event → fill LTR
      fillLtrFromKg(Number(data.value));
    });

    socket.on('weight-scale-disconnected', () => {
      setScaleConnected(false);
      setScaleStatus('');
    });

    socket.on('weight-scale-error', (data) => {
      setScaleStatus(`Scale error: ${data.message}`);
      notifications.show({ title: 'Scale Error', message: data.message, color: 'red', autoClose: 4000 });
    });

    return () => socket.disconnect();
  }, [parseMachineData]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadTodayEntries = async (d, sh, ct) => {
    setLoadingEntries(true);
    try {
      const res = await milkCollectionAPI.getAll({ date: toDate(d).toISOString().slice(0, 10), shift: sh, collectionCenter: ct || undefined, limit: 500 });
      const records = res?.data || [];
      setEntries(records.map((r, i) => {
        return {
          id: r._id, sl: i + 1, billNo: r.billNo,
          producerNo: r.farmerNumber, producerName: r.farmerName || '',
          qty: r.qty, ltr: r.ltr ?? parseFloat((r.qty / 1.03).toFixed(2)),
          clr: r.clr, fat: r.fat, snf: r.snf,
          incentive: r.incentive, rate: r.rate, amount: r.amount,
          addedWater: r.addedWater || 0,
        };
      }));
    } catch { setEntries([]); }
    finally { setLoadingEntries(false); }
  };

  const loadChartData = useCallback(async (chartType) => {
    try {
      const loaders = { ManualEntry: () => rateChartAPI.getManualEntries(), ApplyFormula: () => rateChartAPI.getFormulas(), LowChart: () => rateChartAPI.getLowCharts(), GoldLessChart: () => rateChartAPI.getGoldLessCharts(), SlabRate: () => rateChartAPI.getSlabRates() };
      const loader = loaders[chartType];
      if (loader) { const res = await loader(); setChartRows(res.data || []); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [centerRes, agentRes, settingsRes] = await Promise.all([
          collectionCenterAPI.getAll({ status: 'Active', limit: 200 }),
          agentAPI.getAllActive(),
          milkPurchaseSettingsAPI.getSummary(),
        ]);
        const cl = (centerRes.data || []).map(c => ({ value: c._id, label: c.centerName }));
        setCentersData(cl);
        const firstCenter = cl[0]?.value || '';
        if (firstCenter) { setCenter(firstCenter); centerNameRef.current = cl[0].label; }
        const al = (agentRes.data || []).map(a => ({ value: a._id, label: a.agentName, centerId: a.collectionCenterId?._id || a.collectionCenterId }));
        setAgentsData(al);
        if (al.length) setAgent(al[0].value);
        const chartType = settingsRes?.data?.activeRateChartType || 'ApplyFormula';
        setActiveChart(chartType);
        await loadChartData(chartType);
        await loadTodayEntries(new Date(), 'AM', firstCenter);

        // Sync parameter combo + quantity unit from settings
        if (settingsRes?.data?.manualEntryCombination) setParamCombo(settingsRes.data.manualEntryCombination);
        if (settingsRes?.data?.quantityUnit)           setQtyUnit(settingsRes.data.quantityUnit);

        // Sync cpMode checkboxes from machine toggles saved in settings
        const machines = settingsRes?.data?.machines || {};
        const enabledModes = [];
        if (machines.weighingScale)      enabledModes.push('Weight');
        if (machines.milkAnalyzer)       enabledModes.push('Analyzer');
        if (machines.digitalDisplay)     enabledModes.push('DISP');
        if (machines.announcementSystem) enabledModes.push('SMS');
        if (enabledModes.length) setCpMode(enabledModes);
        // Auto-connect scale if weighingScale is enabled in settings
        if (machines.weighingScale) connectScale();
        // Auto-connect LED display if digitalDisplay is enabled in settings
        if (machines.digitalDisplay) connectDisplay();

        // Load analyzer device config + scan ports
        try {
          const [cfgRes, portsRes] = await Promise.all([
            machineConfigAPI.getConfig(),
            machineConfigAPI.listPorts(),
          ]);
          const portList = (portsRes?.data || []).map(p => p.path);
          setAvailablePorts(portList);

          const savedPort = cfgRes?.data?.port || settingsRes?.data?.milkAnalyzerConfig?.comPort || '';
          const savedBaud = String(cfgRes?.data?.baudRate || settingsRes?.data?.milkAnalyzerConfig?.baudRate || 9600);
          if (savedPort) setSelectedPort(savedPort);
          if (savedBaud) setSelectedBaud(savedBaud);

          const devName = cfgRes?.data?.deviceName || settingsRes?.data?.milkAnalyzerConfig?.deviceName || '';
          if (devName) setAnalyzerDeviceName(devName);
          setAnalyzerRunning(cfgRes?.analyzerRunning || false);
        } catch { /* silent */ }
      } catch { /* silent */ }
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (center) {
      loadTodayEntries(date, shift, center);
      const found = centersData.find(c => c.value === center);
      if (found) centerNameRef.current = found.label;
    }
  }, [date, shift, center]); // eslint-disable-line

  // Load milk sales summary for the day
  useEffect(() => {
    const fetchSalesSummary = async () => {
      try {
        const res = await milkSalesAPI.getDailySummary({ date: date.toISOString().slice(0, 10) });
        const rows = res?.data || [];
        let localLtr = 0, localAmt = 0, creditLtr = 0, creditAmt = 0, sampleLtr = 0, sampleAmt = 0;
        rows.forEach(r => {
          if (r._id?.saleMode === 'LOCAL')  { localLtr  += r.totalLitre;  localAmt  += r.totalAmount; }
          if (r._id?.saleMode === 'CREDIT') { creditLtr += r.totalLitre;  creditAmt += r.totalAmount; }
          if (r._id?.saleMode === 'SAMPLE') { sampleLtr += r.totalLitre;  sampleAmt += r.totalAmount; }
        });
        setSalesSummary({ localLtr, localAmt, creditLtr, creditAmt, sampleLtr, sampleAmt });
      } catch { /* silent */ }
    };
    fetchSalesSummary();
  }, [date]); // eslint-disable-line

  // ── Auto-detect active time incentive for current center + shift + date ───
  useEffect(() => {
    const fetch = async () => {
      const centerName = centerNameRef.current;
      if (!centerName && !center) { setActiveTimeIncentive(null); return; }
      try {
        const res = await timeIncentiveAPI.getActive({
          shift,
          center: centerName || '',
          date: date instanceof Date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        });
        setActiveTimeIncentive(res?.data || null);
      } catch {
        setActiveTimeIncentive(null);
      }
    };
    fetch();
    // Re-check every minute so time window changes are reflected
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [center, shift, date]); // eslint-disable-line

  // ── Auto-detect active shift incentives for current center + shift + date ──
  useEffect(() => {
    const fetch = async () => {
      const centerName = centerNameRef.current;
      if (!centerName && !center) { setActiveShiftIncentives([]); return; }
      try {
        const res = await shiftIncentiveAPI.getActive({
          shift,
          center: centerName || '',
          date: date instanceof Date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        });
        setActiveShiftIncentives(res?.data || []);
      } catch {
        setActiveShiftIncentives([]);
      }
    };
    fetch();
  }, [center, shift, date]); // eslint-disable-line

  const filteredAgents = useCallback(() => {
    if (!center) return agentsData;
    const f = agentsData.filter(a => !a.centerId || a.centerId === center);
    return f.length ? f : agentsData;
  }, [center, agentsData]);

  // SNF = (CLR/4) + (0.20 × FAT) + 0.50
  // CLR defaults to 26 if empty (standard cow milk value)
  // Debounced 600ms — auto-computes SNF when FAT or CLR is typed; does NOT auto-save
  // Only runs in CLR-FAT mode (in FAT-SNF mode, SNF is entered manually)
  useEffect(() => {
    if (paramCombo === 'FAT-SNF') return;
    if (clrAutoSetRef.current) { clrAutoSetRef.current = false; return; }
    if (analyzerDataCapturedRef.current) return; // analyzer set SNF directly — don't overwrite
    const fatVal = parseFloat(fat);
    if (!fatVal) { setSnf(''); return; }
    const clrVal = parseFloat(clr) || 26; // default CLR = 26 when empty
    const timer = setTimeout(() => {
      if (!clr) setClr('26');  // auto-fill CLR field with default
      setSnf(((clrVal / 4) + (0.20 * fatVal) + 0.50).toFixed(2));
    }, 600);
    return () => clearTimeout(timer);
  }, [clr, fat, paramCombo]); // eslint-disable-line

  // CLR = (4 × SNF) − (0.8 × FAT) − 2
  // Debounced 600ms — auto-computes CLR when FAT+SNF are typed; does NOT auto-save
  // Only runs in FAT-SNF mode (in CLR-FAT mode, CLR is entered manually)
  useEffect(() => {
    if (paramCombo !== 'FAT-SNF') return;
    if (analyzerDataCapturedRef.current) return; // analyzer mode — no CLR auto-calc
    const fatVal = parseFloat(fat);
    const snfVal = parseFloat(snf);
    if (!snfVal || !fatVal) { setClr(''); return; }
    const timer = setTimeout(() => {
      clrAutoSetRef.current = true;
      setClr(((4 * snfVal) - (0.8 * fatVal) - 2).toFixed(1));
    }, 600);
    return () => clearTimeout(timer);
  }, [snf, fat, paramCombo]); // eslint-disable-line

  // Auto-save when LTR is manually entered in analyzer mode (machine gave FAT+SNF, user types LTR)
  useEffect(() => {
    if (!analyzerDataCapturedRef.current) return;
    if (!ltr) return;
    const timer = setTimeout(() => {
      const f = formRef.current;
      if (f.producer && f.ltr && f.fat && f.snf && !f.dupBlocked && !f.editingId) {
        handleSave();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [ltr]); // eslint-disable-line

  // Auto-calc — Net LTR → KG (× 1.03), then calc rate/amount
  useEffect(() => {
    const grossLtr = parseFloat(ltr) || 0;
    const waterLtr = parseFloat(water) || 0;
    const netLtr   = Math.max(0, grossLtr - waterLtr);
    const netKg    = parseFloat((netLtr * 1.03).toFixed(3));
    const base = calcValues(netKg, parseFloat(fat) || 0, parseFloat(clr) || 0, parseFloat(snf) || 0, activeChart, chartRows);
    if (entryMode === 'rate' && manualRate !== '') {
      const rate = parseFloat(manualRate) || 0;
      const amount = parseFloat((netKg * rate + base.incentive).toFixed(2));
      setCalcResult({ ...base, rate, amount });
    } else if (entryMode === 'amount' && manualAmount !== '') {
      const amount = parseFloat(manualAmount) || 0;
      const rate = netKg > 0 ? parseFloat((amount / netKg).toFixed(2)) : 0;
      setCalcResult({ ...base, rate, amount });
    } else {
      setCalcResult(base);
    }
  }, [ltr, water, fat, clr, snf, activeChart, chartRows, entryMode, manualRate, manualAmount]); // eslint-disable-line

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target) && memberRef.current && !memberRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Block all keyboard input while duplicate warning is active
  useEffect(() => {
    if (!dupBlocked) return;
    const block = (e) => {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') return; // allow OK button focus via keyboard
      e.stopPropagation();
      e.preventDefault();
    };
    document.addEventListener('keydown', block, true);
    return () => document.removeEventListener('keydown', block, true);
  }, [dupBlocked]);

  // Search debounce
  useEffect(() => {
    if (memberInput.trim().length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await farmerAPI.search(memberInput.trim());
        const list = res?.data || [];
        setSearchResults(list); setShowDropdown(list.length > 0);
      } catch { setSearchResults([]); setShowDropdown(false); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [memberInput]);

  const selectProducer = async (farmer) => {
    const base = { _id: farmer._id, no: farmer.farmerNumber, memberId: farmer.memberId || '', name: farmer.personalDetails?.name || '', phone: farmer.personalDetails?.phone || '', avg: { qty: 0, clr: 0, fat: 0 } };

    // Check if this member already has an entry today
    const existing = formRef.current.entries?.find(e => e.producerNo === farmer.farmerNumber);
    if (existing) {
      setDupBlocked(true);
      setDupInfo({ name: farmer.personalDetails?.name || farmer.farmerNumber, billNo: existing.billNo, amount: existing.amount, center: centerNameRef.current || '' });
      document.activeElement?.blur();
    }

    setProducer(base);
    setMemberInput(farmer.memberId || farmer.farmerNumber);
    setShowDropdown(false);
    setTimeout(() => ltrRef.current?.focus({ preventScroll: true }), 50);
    try {
      const statsRes = await milkCollectionAPI.getFarmerStats(farmer.farmerNumber, { days: 10 });
      const s = statsRes?.data;
      if (s) setProducer(prev => ({ ...prev, avg: { qty: parseFloat(s.avgQty || 0).toFixed(1), clr: parseFloat(s.avgClr || 0).toFixed(1), fat: parseFloat(s.avgFat || 0).toFixed(2) } }));
    } catch { /* keep 0 */ }
  };

  const lookupMember = async (query) => {
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      const res = await farmerAPI.search(query.trim());
      const farmers = res?.data || [];
      const exact = farmers.find(f => f.memberId?.toLowerCase() === query.trim().toLowerCase() || f.farmerNumber?.toLowerCase() === query.trim().toLowerCase());
      if (exact) { selectProducer(exact); }
      else if (farmers.length === 1) { selectProducer(farmers[0]); }
      else { setSearchResults(farmers); setShowDropdown(farmers.length > 0); }
    } catch { /* silent */ }
    finally { setSearchLoading(false); }
  };

  // ── Save / Update ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    const { producer: p, ltr: q, water: w, fat: f, clr: c, snf: s, date: d, shift: sh, center: ct, agent: ag, calcResult: cr, editingId: eid, entryMode: em, manualRate: mr, manualAmount: ma, activeTimeIncentive: ati, activeShiftIncentives: asi } = formRef.current;
    if (formRef.current.dupBlocked) return;
    if (!p || !q || !f) { notifications.show({ message: 'Member, Litres and FAT are required', color: 'red', autoClose: 2500 }); return; }
    setSaving(true);
    const grossLtr = parseFloat(q) || 0;
    const waterLtr = parseFloat(w) || 0;
    const netLtr   = Math.max(0, grossLtr - waterLtr);
    const netKg    = parseFloat((netLtr * 1.03).toFixed(3));
    // Always recalculate fresh to avoid stale calcResult (race condition on fast Enter)
    const fresh = calcValues(netKg, parseFloat(f) || 0, parseFloat(c) || 0, parseFloat(s) || 0, activeChart, chartRows);
    let freshRate   = fresh.rate;
    let freshAmount = fresh.amount;
    if (em === 'rate' && mr !== '') { freshRate = parseFloat(mr) || 0; freshAmount = parseFloat((netKg * freshRate).toFixed(2)); }
    if (em === 'amount' && ma !== '') { freshAmount = parseFloat(ma) || 0; freshRate = netKg > 0 ? parseFloat((freshAmount / netKg).toFixed(2)) : 0; }
    // Add time incentive if active
    const timeIncRate   = ati?.rate || 0;
    const timeIncAmount = parseFloat((timeIncRate * netLtr).toFixed(2));
    // Add shift incentive if active
    const shiftIncAmount = calcShiftIncentiveAmt(asi || [], netKg, netLtr, parseFloat(f) || 0, parseFloat(s) || fresh.snf || 0, freshAmount);
    freshAmount = parseFloat((freshAmount + timeIncAmount + shiftIncAmount).toFixed(2));
    try {
      const payload = { date: toDate(d).toISOString(), shift: sh, collectionCenter: ct || undefined, agent: ag || undefined, farmer: p._id, farmerNumber: p.no, farmerName: p.name, qty: netKg, ltr: netLtr, clr: parseFloat(c) || 0, fat: parseFloat(f), snf: parseFloat(s) || fresh.snf || 0, addedWater: waterLtr, rate: freshRate, incentive: fresh.incentive, timeIncentiveRate: timeIncRate || undefined, timeIncentiveAmount: timeIncAmount || undefined, shiftIncentiveAmount: shiftIncAmount || undefined, amount: freshAmount };

      if (eid) {
        // UPDATE existing entry
        const res = await milkCollectionAPI.update(eid, payload);
        const saved = res.data;
        setEntries(prev => prev.map(e => e.id !== eid ? e : { ...e, qty: saved.qty, ltr: saved.ltr ?? parseFloat((saved.qty / 1.03).toFixed(2)), clr: saved.clr, fat: saved.fat, snf: saved.snf, incentive: saved.incentive, rate: saved.rate, amount: saved.amount, producerName: saved.farmerName || p.name }));
        notifications.show({ message: `Updated: ${saved.billNo}`, color: 'blue', autoClose: 2000 });
      } else {
        // CREATE new entry
        const res = await milkCollectionAPI.create(payload);
        const saved = res.data;
        const newEntry = { id: saved._id, billNo: saved.billNo, producerNo: saved.farmerNumber, producerName: saved.farmerName || p.name, qty: saved.qty, ltr: saved.ltr ?? netLtr, clr: saved.clr, fat: saved.fat, snf: saved.snf, incentive: saved.incentive, rate: saved.rate, amount: saved.amount, addedWater: saved.addedWater || 0 };
        setBillNo(saved.billNo);
        setEntries(prev => [...prev, { ...newEntry, sl: prev.length + 1 }]);
        tableScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        lastEntryRef.current = newEntry;
        // Auto-print immediately after save — only if 'Milk Bill' mode is ticked
        const dateStr = toDate(formRef.current.date).toLocaleDateString('en-IN');
        const milkBillEnabled = formRef.current.cpMode?.includes('Milk Bill');
        if (milkBillEnabled) {
          printBill(newEntry, dateStr, formRef.current.shift, centerNameRef.current);
        }
        notifications.show({ message: `Saved${milkBillEnabled ? ' & Printing' : ''}: ${saved.billNo} \u2014 \u20B9${saved.amount.toFixed(2)}`, color: 'teal', autoClose: 2000 });
        if (formRef.current.speakEnabled) {
          const utterance = new SpeechSynthesisUtterance(
            `Fat ${saved.fat.toFixed(1)}. Rate ${saved.rate.toFixed(2)}. Amount ${saved.amount.toFixed(2)}.`
          );
          utterance.lang = 'en-IN';
          utterance.rate = 0.95;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      }
      handleClear();
      // Auto-tare scale after save so it resets to 0 for the next farmer
      if (formRef.current.cpMode?.includes('Weight') && formRef.current.scaleConnected) {
        scaleLastFilledRef.current = null; // reset so next farmer's weight fills LTR
        machineConfigAPI.scaleTare().catch(() => {});
      }
    } catch (err) {
      notifications.show({ message: err?.message || 'Save failed', color: 'red', icon: <IconAlertCircle size={14} /> });
    } finally { setSaving(false); }
  };

  const handleClear = () => {
    setMemberInput(''); setProducer(null); setSearchResults([]); setShowDropdown(false);
    setLtr(''); setWater(''); setFat(''); setClr(''); setSnf('');
    setManualRate(''); setManualAmount('');
    setSelectedRow(null); setEditingId(null);
    // analyzerDataCapturedRef stays true — only resets when machine sends a NEW different reading
    // Send blank frame to display so it clears for the next farmer
    if (formRef.current.displayConnected) {
      machineConfigAPI.sendDisplay({}).catch(() => {});
    }
    setTimeout(() => memberRef.current?.focus({ preventScroll: true }), 60);
  };

  // ── Edit selected row ─────────────────────────────────────────────────────
  const handleEdit = () => {
    if (!selectedRow) return;
    setEditingId(selectedRow.id);
    setBillNo(selectedRow.billNo);
    setLtr(String(selectedRow.qty));
    setWater(String(selectedRow.addedWater || ''));
    setFat(String(selectedRow.fat));
    setClr(String(selectedRow.clr));
    setSnf(String(selectedRow.snf));
    setMemberInput(selectedRow.producerNo);
    setProducer({ _id: null, no: selectedRow.producerNo, name: selectedRow.producerName, memberId: '', phone: '', avg: { qty: 0, clr: 0, fat: 0 } });
    // Load full producer data in background
    farmerAPI.search(selectedRow.producerNo).then(res => {
      const farmers = res?.data || [];
      const match = farmers.find(f => f.farmerNumber === selectedRow.producerNo);
      if (match) { setProducer(prev => ({ ...prev, _id: match._id, memberId: match.memberId || '', phone: match.personalDetails?.phone || '' })); setMemberInput(match.memberId || match.farmerNumber); }
    }).catch(() => {});
    setTimeout(() => ltrRef.current?.focus({ preventScroll: true }), 60);
    notifications.show({ message: `Editing: ${selectedRow.billNo} — modify values and press Save`, color: 'blue', autoClose: 3000 });
  };

  const handleDelete = async (id) => {
    try {
      await milkCollectionAPI.delete(id);
      setEntries(prev => prev.filter(e => e.id !== id).map((e, i) => ({ ...e, sl: i + 1 })));
      if (selectedRow?.id === id) setSelectedRow(null);
      notifications.show({ message: 'Entry deleted', color: 'orange', autoClose: 1500 });
    } catch (err) { notifications.show({ message: err?.message || 'Delete failed', color: 'red' }); }
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const handleMemberKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupMember(memberInput);
    }
  };
  const focusNext = (ref) => (e) => { if (e.key === 'Enter') { e.preventDefault(); ref.current?.focus(); } };
  const onLastEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } };

  // Filtered entries for history search
  const filteredEntries = historySearch.trim()
    ? entries.filter(e =>
        e.producerNo.toLowerCase().includes(historySearch.toLowerCase()) ||
        e.producerName.toLowerCase().includes(historySearch.toLowerCase()) ||
        e.billNo.toLowerCase().includes(historySearch.toLowerCase())
      )
    : entries;

  // Aggregates
  const totalQty = entries.reduce((s, e) => s + e.qty, 0);
  const totalLtr = entries.reduce((s, e) => s + (e.ltr ?? e.qty), 0);
  const totalAmt = entries.reduce((s, e) => s + e.amount, 0);
  const avgFat   = entries.length ? entries.reduce((s, e) => s + e.fat, 0) / entries.length : 0;
  const avgClr   = entries.length ? entries.reduce((s, e) => s + e.clr, 0) / entries.length : 0;
  const avgRate  = entries.length ? entries.reduce((s, e) => s + e.rate, 0) / entries.length : 0;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Box style={{ height: 'calc(100vh - 120px)', margin: 'calc(-1 * var(--mantine-spacing-md))', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <Box style={{ background: 'white', borderBottom: '1px solid #dbeafe', padding: '5px 16px', flexShrink: 0, boxShadow: '0 1px 6px rgba(37,99,235,0.08)' }}>
        <Group align="center" gap={12} wrap="nowrap">
          <Box style={{ background: '#dbeafe', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <IconMilk size={22} color="#2563eb" />
          </Box>
          <Box style={{ flexShrink: 0 }}>
            <Text size="16px" fw={800} c="#1e3a8a" style={{ lineHeight: 1.1, letterSpacing: '-0.3px' }}>Milk Purchase</Text>
            <Text size="10px" c="#64748b">Daily Collection Entry</Text>
          </Box>

          <DatePickerInput
            value={date} onChange={v => v && setDate(toDate(v))} valueFormat="DD MMM YYYY"
            size="sm" radius="md" style={{ width: 130 }}
            styles={{ input: { fontWeight: 700, fontSize: 13, border: '1.5px solid #bfdbfe' } }}
          />
          <Select
            value={shift} onChange={setShift}
            data={[{ value: 'AM', label: 'AM Shift' }, { value: 'PM', label: 'PM Shift' }]}
            size="sm" radius="md" style={{ width: 110 }}
            styles={{ input: { fontWeight: 700, border: '1.5px solid #bfdbfe' } }}
          />
          <Group gap={4} align="center" wrap="nowrap">
            <Text size="11px" fw={700} c="#1e3a8a" style={{ whiteSpace: 'nowrap' }}>Center</Text>
            <Select
              value={center} onChange={v => { setCenter(v); setAgent(''); }}
              data={centersData} placeholder="Center..." searchable
              leftSection={<IconBuilding size={14} color="#2563eb" />}
              size="sm" radius="md" style={{ width: 160 }}
              styles={{ input: { fontWeight: 600, border: '1.5px solid #bfdbfe' } }}
            />
          </Group>
          <Group gap={4} align="center" wrap="nowrap">
            <Text size="11px" fw={700} c="#1e3a8a" style={{ whiteSpace: 'nowrap' }}>Agent</Text>
            <Select
              value={agent} onChange={setAgent}
              data={filteredAgents()} placeholder="Agent..." searchable
              leftSection={<IconUser size={14} color="#2563eb" />}
              size="sm" radius="md" style={{ width: 140 }}
              styles={{ input: { fontWeight: 600, border: '1.5px solid #bfdbfe' } }}
            />
          </Group>
          <Button
            leftSection={<IconX size={14} />}
            onClick={() => navigate('/')}
            size="sm" radius="md" variant="light" color="red"
            style={{ marginLeft: 'auto', fontWeight: 700 }}
          >
            Close
          </Button>
        </Group>
      </Box>

      {/* ══ MAIN CONTENT (Card Row + Table + Right Panel) ═══════════════════ */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>

      {/* ── Left column (Card Row + Table) ── */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

      {/* ══ CARD ROW ════════════════════════════════════════════════════════ */}
      <Box style={{ flexShrink: 0, padding: '6px 14px 0' }}>

        {/* Duplicate inline alert */}
        {dupBlocked && dupInfo && (
          <Box style={{ background: '#fff7ed', border: '2px solid #f97316', borderRadius: 8, padding: '8px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Group gap={10} wrap="nowrap">
              <Text size="20px">⚠️</Text>
              <Box>
                <Text size="12px" fw={800} c="#92400e">Already Entered Today</Text>
                <Text size="11px" c="#78350f">
                  <b>{dupInfo.name}</b> — {dupInfo.center} &nbsp;|&nbsp; Bill: {dupInfo.billNo} &nbsp;|&nbsp; ₹{dupInfo.amount.toFixed(2)}
                </Text>
              </Box>
            </Group>
            <Button size="compact-sm" color="orange" variant="filled" onClick={() => { setDupBlocked(false); setDupInfo(null); }}>OK</Button>
          </Box>
        )}

        <Group gap={12} align="stretch" wrap="nowrap" style={{ pointerEvents: dupBlocked ? 'none' : 'all', opacity: dupBlocked ? 0.45 : 1, transition: 'opacity 0.2s' }}>

          {/* ── CARD 1: Bill Information ── */}
          <Card shadow="xs" radius="lg" withBorder style={{ flex: '0 0 280px', borderColor: '#bfdbfe', borderTop: '3px solid #2563eb', padding: '8px 12px' }}>
            <Group gap={6} mb={6}>
              <Box style={{ background: '#dbeafe', borderRadius: 7, padding: '4px 6px' }}><IconReceipt size={15} color="#2563eb" /></Box>
              <Text size="12px" fw={800} c="#1e3a8a" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Bill Information</Text>
            </Group>

            {/* Bill No */}
            <Box mb={5}>
              <Text size="10px" fw={700} c="#64748b" mb={4} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Bill No</Text>
              <TextInput
                value={billNo || '—'}
                readOnly
                size="sm" radius="md"
                styles={{ input: { fontWeight: 800, fontSize: 13, background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#2563eb' } }}
              />
            </Box>

            {/* Member No */}
            <Box mb={5} style={{ position: 'relative' }}>
              <Text size="10px" fw={700} c="#64748b" mb={4} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Member No / Name</Text>
              <TextInput
                ref={memberRef}
                placeholder="Type No or Name, press Enter..."
                value={memberInput}
                onChange={e => { setMemberInput(e.currentTarget.value); if (producer) setProducer(null); }}
                onKeyDown={handleMemberKeyDown}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                leftSection={searchLoading ? <Loader size={13} color="#2563eb" /> : <IconSearch size={14} color="#2563eb" />}
                rightSection={memberInput ? <ActionIcon size={18} variant="subtle" color="gray" onClick={() => { setMemberInput(''); setProducer(null); setShowDropdown(false); }}><IconX size={11} /></ActionIcon> : null}
                size="sm" radius="md"
                styles={{ input: { fontWeight: 600, border: '1.5px solid #bfdbfe', fontSize: 13 } }}
              />

              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <Box ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000, background: 'white', border: '1.5px solid #bfdbfe', borderRadius: 10, boxShadow: '0 8px 24px rgba(37,99,235,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 3 }}>
                  {searchResults.map((f, idx) => (
                    <Box key={f._id} onClick={() => selectProducer(f)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <Group gap={8} wrap="nowrap">
                        <Avatar size={26} radius="xl" color="blue" variant="light"><IconUser size={13} /></Avatar>
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text size="12px" fw={700} style={{ lineHeight: 1.2 }}>{f.personalDetails?.name || 'Unknown'}</Text>
                          <Group gap={4}>
                            <Badge size="xs" color="blue" radius="sm">{f.memberId || f.farmerNumber}</Badge>
                            {f.personalDetails?.phone && <Text size="9px" c="dimmed">{f.personalDetails.phone}</Text>}
                          </Group>
                        </Box>
                      </Group>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Name (auto-filled) */}
            <Box>
              <Text size="10px" fw={700} c="#64748b" mb={4} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Name <Text span size="8px" c="blue">(Auto)</Text></Text>
              <Box style={{ background: producer ? '#eff6ff' : '#f8fafc', border: '1.5px solid ' + (producer ? '#bfdbfe' : '#e2e8f0'), borderRadius: 8, padding: '8px 12px', minHeight: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
                {producer ? (
                  <Group gap={8} wrap="nowrap" style={{ width: '100%' }}>
                    <Avatar size={28} radius="xl" color="blue" variant="filled"><IconUser size={14} /></Avatar>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={800} size="13px" c="#1e3a8a" style={{ lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{producer.name}</Text>
                      <Text size="10px" c="#64748b">{producer.no}{producer.phone ? ` · ${producer.phone}` : ''}</Text>
                    </Box>
                  </Group>
                ) : (
                  <Text size="11px" c="#94a3b8">Select a member to auto-fill</Text>
                )}
              </Box>
            </Box>
          </Card>

          {/* ── CARD 2: Last 10-Day Average ── */}
          <Card shadow="xs" radius="lg" withBorder style={{ flex: '0 0 260px', borderColor: '#bbf7d0', borderTop: '3px solid #16a34a', padding: '8px 12px' }}>
            <Group gap={6} mb={6}>
              <Box style={{ background: '#dcfce7', borderRadius: 7, padding: '4px 6px' }}><IconChartBar size={15} color="#16a34a" /></Box>
              <Text size="12px" fw={800} c="#14532d" tt="uppercase" style={{ letterSpacing: '0.5px' }}>10-Day Average</Text>
            </Group>
            <Group gap={8} grow style={{ height: 68 }}>
              <AvgCard label="FAT" value={producer?.avg.fat || '—'} unit="%" icon={<IconFlame size={11} color="#c2410c" />} color="#c2410c" bg="#fff7ed" />
              <AvgCard label="CLR" value={producer?.avg.clr || '—'} unit="" icon={<IconDroplet size={11} color="#6d28d9" />} color="#6d28d9" bg="#f5f3ff" />
              <AvgCard label="LTR" value={producer?.avg.qty || '—'} unit="Litres" icon={<IconMilk size={11} color="#0369a1" />} color="#0369a1" bg="#f0f9ff" />
            </Group>

            {/* Member badge strip */}
            {producer && (
              <Box style={{ background: '#f0fdf4', borderRadius: 8, padding: '4px 8px', marginTop: 5 }}>
                <Group gap={4} wrap="wrap">
                  <Badge size="sm" color="green" variant="light" radius="sm">{producer.no}</Badge>
                  {producer.memberId && <Badge size="sm" color="blue" variant="light" radius="sm">ID: {producer.memberId}</Badge>}
                  <Badge size="sm" color="teal" variant="light" radius="sm" leftSection={<IconId size={10} />}>Member</Badge>
                </Group>
              </Box>
            )}
          </Card>

          {/* ── CARD 3: Current Entry ── */}
          <Card shadow="xs" radius="lg" withBorder style={{ flex: 1, borderColor: (machineConnected || socketConnected || scaleConnected) ? '#6ee7b7' : '#fde68a', borderTop: `3px solid ${(machineConnected || socketConnected) ? '#059669' : scaleConnected ? '#4338ca' : '#d97706'}`, padding: '8px 12px' }}>
            <Group gap={6} mb={6} justify="space-between">
              <Group gap={6}>
                <Box style={{ background: '#fef9c3', borderRadius: 7, padding: '4px 6px' }}><IconMilk size={15} color="#d97706" /></Box>
                <Text size="12px" fw={800} c="#78350f" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Current Entry</Text>
                {(machineConnected || socketConnected) && (
                  <Badge size="xs" color="teal" variant="filled" radius="sm"
                    leftSection={<Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />}>
                    MACHINE LIVE
                  </Badge>
                )}
                {scaleConnected && (
                  <Badge size="xs" color="indigo" variant="filled" radius="sm"
                    leftSection={<Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />}>
                    SCALE LIVE
                  </Badge>
                )}
                {activeTimeIncentive && (
                  <Badge size="xs" color="green" variant="filled" radius="sm"
                    title={`Time: ${activeTimeIncentive.timeFrom}–${activeTimeIncentive.timeTo}`}>
                    ⏱ TIME INC ₹{activeTimeIncentive.rate}/L
                  </Badge>
                )}
                {activeShiftIncentives.length > 0 && (
                  <Badge size="xs" color="orange" variant="filled" radius="sm"
                    title={`Shift incentive: ${activeShiftIncentives.length} active`}>
                    🔄 SHIFT INC ({activeShiftIncentives.length})
                  </Badge>
                )}
              </Group>
              <Group gap={6}>
                {machineStatus && <Text size="9px" c="teal.7" fw={600}>{machineStatus}</Text>}
                {scaleStatus && (
                  <Text size="9px" fw={600} c={scaleConnected ? 'indigo.7' : 'dimmed'}>{scaleStatus}</Text>
                )}
                {/* Backend serial port status (Socket.io) */}
                <Badge
                  size="xs"
                  color={socketConnected ? 'teal' : 'gray'}
                  variant={socketConnected ? 'filled' : 'outline'}
                  title="Backend serial port (Node.js)"
                >
                  {socketConnected ? 'COM ✓' : 'COM —'}
                </Badge>
                {/* Weight Scale connect button (backend Socket.io) */}
                <ActionIcon
                  size="sm" radius="sm"
                  variant={scaleConnected ? 'filled' : 'light'}
                  color={scaleConnected ? 'indigo' : 'gray'}
                  loading={scaleStarting}
                  title={scaleConnected ? 'Disconnect Weight Scale' : 'Connect Weighing Scale (uses port from Settings)'}
                  onClick={scaleConnected ? disconnectScale : connectScale}
                >
                  <IconScale size={14} />
                </ActionIcon>
                {/* Tare button — only shown when scale is connected */}
                {scaleConnected && (
                  <Button
                    size="compact-xs" radius="sm"
                    variant="filled" color="indigo"
                    title="Send Tare command — zeroes the scale"
                    onClick={sendTare}
                    style={{ fontWeight: 700, fontSize: 10, height: 22, padding: '0 7px' }}
                  >
                    Tare
                  </Button>
                )}
                {/* Milk Analyzer connect button (Web Serial API) */}
                <ActionIcon
                  size="sm" radius="sm" variant={machineConnected ? 'filled' : 'light'}
                  color={machineConnected ? 'teal' : 'gray'}
                  title={machineConnected ? 'Disconnect Milk Analyzer' : 'Connect Milk Analyzer via Web Serial API (Chrome/Edge)'}
                  onClick={machineConnected ? disconnectMachine : connectMachine}
                >
                  {machineConnected ? <IconPlugConnectedX size={14} /> : <IconPlugConnected size={14} />}
                </ActionIcon>
                <Text size="9px" c="#94a3b8">Tab to move · Enter to save</Text>
              </Group>
            </Group>

            {/* Input row — fields driven by paramCombo + qtyUnit from settings */}
            <Group gap={8} mb={6} wrap="nowrap" align="flex-end">
              {(() => {
                const ltrLabel = qtyUnit === 'KG' ? 'KG' : 'LTR';
                const clrFat = paramCombo === 'CLR-FAT';
                // CLR-FAT: LTR→FAT→CLR→Water (SNF auto)
                // FAT-SNF: LTR→FAT→SNF→Water (CLR auto)
                return clrFat ? [
                  { label: ltrLabel, ref: ltrRef,   value: ltr,   setter: setLtr,   next: fatRef,   color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', step: 0.1,  dec: 2 },
                  { label: 'FAT %',  ref: fatRef,   value: fat,   setter: setFat,   next: clrRef,   color: '#c2410c', bg: '#fff7ed', border: '#fdba74', step: 0.01, dec: 2 },
                  { label: 'CLR',    ref: clrRef,   value: clr,   setter: setClr,   next: waterRef, color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', step: 0.1,  dec: 1 },
                  { label: 'Water',  ref: waterRef, value: water, setter: setWater, next: null,     color: '#be123c', bg: '#fff1f2', border: '#fda4af', step: 0.1,  dec: 2 },
                ] : [
                  { label: ltrLabel, ref: ltrRef,   value: ltr,   setter: setLtr,   next: fatRef,   color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', step: 0.1,  dec: 2 },
                  { label: 'FAT %',  ref: fatRef,   value: fat,   setter: setFat,   next: snfRef,   color: '#c2410c', bg: '#fff7ed', border: '#fdba74', step: 0.01, dec: 2 },
                  { label: 'SNF %',  ref: snfRef,   value: snf,   setter: setSnf,   next: waterRef, color: '#166534', bg: '#f0fdf4', border: '#86efac', step: 0.01, dec: 2 },
                  { label: 'Water',  ref: waterRef, value: water, setter: setWater, next: null,     color: '#be123c', bg: '#fff1f2', border: '#fda4af', step: 0.1,  dec: 2 },
                ];
              })().map(({ label, ref: iRef, value, setter, next, color, bg, border, step, dec }) => (
                <Box key={label} style={{ flex: 1 }}>
                  <Text size="10px" fw={700} mb={4} tt="uppercase" style={{ color, letterSpacing: '0.4px' }}>{label}</Text>
                  <NumberInput
                    ref={iRef} value={value}
                    onChange={v => setter(String(v ?? ''))}
                    onKeyDown={
                      // LTR: in analyzer mode jump straight to save; otherwise go to FAT
                      label === 'LTR'
                        ? (e) => { if (e.key === 'Enter') { e.preventDefault(); analyzerDataCapturedRef.current ? handleSave() : fatRef.current?.focus(); } }
                        : (next ? focusNext(next) : onLastEnter)
                    }
                    step={step} decimalScale={dec} min={0}
                    size="sm" radius="md" hideControls
                    styles={{ input: { height: 36, fontSize: 15, fontWeight: 900, background: bg, border: `2px solid ${border}`, color, textAlign: 'center' } }}
                  />
                </Box>
              ))}
            </Group>

            {/* Calculated results row */}
            {(() => {
              const grossLtr = parseFloat(ltr) || 0;
              const waterLtr = parseFloat(water) || 0;
              const netLtr = Math.max(0, grossLtr - waterLtr);
              const netKg = parseFloat((netLtr * 1.03).toFixed(3));
              return (
                <Group gap={8} wrap="nowrap">
                  <Box style={{ flex: 1, background: '#fff1f2', border: '1.5px solid #fda4af', borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                    <Text size="9px" fw={600} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Net Ltr</Text>
                    <Text size="14px" fw={700} style={{ color: '#be123c', lineHeight: 1.2 }}>{netLtr.toFixed(2)}</Text>
                  </Box>
                  <Box style={{ flex: 1, background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                    <Text size="9px" fw={600} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px' }}>KG</Text>
                    <Text size="14px" fw={700} style={{ color: '#065f46', lineHeight: 1.2 }}>{netKg.toFixed(3)}</Text>
                  </Box>
                  {/* SNF (Auto) or CLR (Auto) depending on paramCombo */}
                  {paramCombo === 'CLR-FAT' ? (
                    <Box style={{ flex: 1, background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                      <Text size="9px" fw={600} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px' }}>SNF (Auto)</Text>
                      <Text size="14px" fw={700} style={{ color: '#166534', lineHeight: 1.2 }}>{calcResult.snf ? calcResult.snf.toFixed(2) : snf || '—'}</Text>
                    </Box>
                  ) : (
                    <Box style={{ flex: 1, background: '#f5f3ff', border: '1.5px solid #c4b5fd', borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                      <Text size="9px" fw={600} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px' }}>CLR (Auto)</Text>
                      <Text size="14px" fw={700} style={{ color: '#6d28d9', lineHeight: 1.2 }}>{clr || '—'}</Text>
                    </Box>
                  )}
                  {/* Rate — editable in 'rate' mode */}
                  <Box style={{ flex: 1, background: entryMode === 'rate' ? '#e0f2fe' : '#eff6ff', border: `2px solid ${entryMode === 'rate' ? '#0284c7' : '#bfdbfe'}`, borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                    <Text size="9px" fw={700} style={{ color: entryMode === 'rate' ? '#0284c7' : '#64748b' }} tt="uppercase">{entryMode === 'rate' ? '✏ Rate/KG' : 'Rate/KG'}</Text>
                    {entryMode === 'rate' ? (
                      <NumberInput
                        ref={manualRateRef}
                        value={manualRate === '' ? '' : parseFloat(manualRate)}
                        onChange={v => setManualRate(String(v ?? ''))}
                        step={0.01} decimalScale={2} min={0}
                        size="xs" hideControls
                        styles={{ input: { height: 22, fontSize: 14, fontWeight: 900, background: 'transparent', border: 'none', color: '#1e40af', textAlign: 'center', padding: '0 4px' } }}
                      />
                    ) : (
                      <Text size="14px" fw={700} style={{ color: '#1e40af', lineHeight: 1.2 }}>₹ {calcResult.rate.toFixed(2)}</Text>
                    )}
                  </Box>
                  {/* Incentive */}
                  <Box style={{ flex: 1, background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                    <Text size="9px" fw={600} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Incentive</Text>
                    <Text size="14px" fw={700} style={{ color: '#92400e', lineHeight: 1.2 }}>₹ {calcResult.incentive.toFixed(2)}</Text>
                  </Box>
                  {/* Time Incentive (shown only when active) */}
                  {activeTimeIncentive && (() => {
                    const grossLtr = parseFloat(ltr) || 0;
                    const waterLtr = parseFloat(water) || 0;
                    const netLtr   = Math.max(0, grossLtr - waterLtr);
                    const tAmt     = parseFloat((activeTimeIncentive.rate * netLtr).toFixed(2));
                    return (
                      <Box style={{ flex: 1, background: '#f0fdf4', border: '2px solid #4ade80', borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                        <Text size="9px" fw={700} c="#166534" tt="uppercase" style={{ letterSpacing: '0.4px' }}>⏱ Time Inc</Text>
                        <Text size="14px" fw={700} style={{ color: '#16a34a', lineHeight: 1.2 }}>₹ {tAmt.toFixed(2)}</Text>
                      </Box>
                    );
                  })()}
                  {/* Shift Incentive (shown only when active) */}
                  {activeShiftIncentives.length > 0 && (() => {
                    const grossLtr = parseFloat(ltr) || 0;
                    const waterLtr = parseFloat(water) || 0;
                    const netLtr   = Math.max(0, grossLtr - waterLtr);
                    const netKg    = parseFloat((netLtr * 1.03).toFixed(3));
                    const sAmt     = calcShiftIncentiveAmt(activeShiftIncentives, netKg, netLtr, parseFloat(fat) || 0, parseFloat(snf) || 0, calcResult.amount);
                    return (
                      <Box style={{ flex: 1, background: '#fff7ed', border: '2px solid #fb923c', borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                        <Text size="9px" fw={700} c="#9a3412" tt="uppercase" style={{ letterSpacing: '0.4px' }}>🔄 Shift Inc</Text>
                        <Text size="14px" fw={700} style={{ color: '#ea580c', lineHeight: 1.2 }}>₹ {sAmt.toFixed(2)}</Text>
                      </Box>
                    );
                  })()}
                  {/* Amount — editable in 'amount' mode */}
                  <Box style={{ flex: 1.3, background: entryMode === 'amount' ? '#fef3c7' : '#1e40af', border: `2px solid ${entryMode === 'amount' ? '#f59e0b' : '#1e40af'}`, borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                    <Text size="9px" fw={700} style={{ color: entryMode === 'amount' ? '#92400e' : 'rgba(255,255,255,0.75)' }} tt="uppercase">{entryMode === 'amount' ? '✏ Amount' : 'Amount'}</Text>
                    {entryMode === 'amount' ? (
                      <NumberInput
                        ref={manualAmountRef}
                        value={manualAmount === '' ? '' : parseFloat(manualAmount)}
                        onChange={v => setManualAmount(String(v ?? ''))}
                        step={1} decimalScale={2} min={0}
                        size="xs" hideControls
                        styles={{ input: { height: 22, fontSize: 16, fontWeight: 900, background: 'transparent', border: 'none', color: '#92400e', textAlign: 'center', padding: '0 4px' } }}
                      />
                    ) : (() => {
                      const grossLtr  = parseFloat(ltr) || 0;
                      const waterLtr  = parseFloat(water) || 0;
                      const netLtr    = Math.max(0, grossLtr - waterLtr);
                      const tAmt  = activeTimeIncentive ? parseFloat((activeTimeIncentive.rate * netLtr).toFixed(2)) : 0;
                      const netKgD = parseFloat((netLtr * 1.03).toFixed(3));
                      const sAmt  = calcShiftIncentiveAmt(activeShiftIncentives, netKgD, netLtr, parseFloat(fat) || 0, parseFloat(snf) || 0, calcResult.amount);
                      return <Text size="18px" fw={900} style={{ color: 'white', lineHeight: 1.2 }}>₹ {(calcResult.amount + tAmt + sAmt).toFixed(2)}</Text>;
                    })()}
                  </Box>
                </Group>
              );
            })()}
          </Card>

        </Group>
      </Box>

      {/* ══ TABLE SECTION ═══════════════════════════════════════════════════ */}
      <Box style={{ flex: 1, overflow: 'hidden', minHeight: 0, padding: '6px 14px 8px', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Table header bar */}
        <Box style={{ background: '#1e3a8a', borderRadius: '10px 10px 0 0', padding: '4px 10px' }}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap={8} style={{ flexShrink: 0 }}>
              <Text fw={700} size="12px" c="white" style={{ letterSpacing: '0.3px' }}>Purchase Register</Text>
              <Badge size="sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#93c5fd', border: '1px solid rgba(255,255,255,0.2)' }}>
                {loadingEntries ? <Loader size={10} color="white" /> : `${filteredEntries.length}${historySearch ? ` / ${entries.length}` : ''} records`}
              </Badge>
              {editingId && (
                <Badge size="sm" color="yellow" variant="filled" radius="sm">EDIT MODE</Badge>
              )}
            </Group>

            <Group gap={4} wrap="nowrap">
              {/* History search input */}
              {showHistory && (
                <TextInput
                  placeholder="Search by name, No, bill..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.currentTarget.value)}
                  size="xs" radius="sm"
                  style={{ width: 200 }}
                  leftSection={<IconSearch size={12} color="#93c5fd" />}
                  rightSection={historySearch ? <ActionIcon size={14} variant="subtle" onClick={() => setHistorySearch('')}><IconX size={10} color="white" /></ActionIcon> : null}
                  styles={{ input: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontSize: 11, height: 24 } }}
                  autoFocus
                />
              )}

              {/* SAVE */}
              <Button leftSection={<IconDeviceFloppy size={12} />} onClick={handleSave} loading={saving}
                size="compact-xs" radius="sm"
                style={{ background: '#16a34a', border: 'none', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Save
              </Button>

              {/* CLEAR */}
              <Button leftSection={<IconBan size={12} />} onClick={handleClear}
                size="compact-xs" radius="sm"
                style={{ background: editingId ? '#b45309' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {editingId ? 'Cancel Edit' : 'Clear'}
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* NEW */}
              <Button leftSection={<IconPlus size={12} />} onClick={handleClear}
                size="compact-xs" radius="sm"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                New
              </Button>

              {/* EDIT */}
              <Button leftSection={<IconEdit size={12} />} disabled={!selectedRow}
                onClick={handleEdit}
                size="compact-xs" radius="sm"
                style={{ background: selectedRow ? '#1d4ed8' : 'rgba(255,255,255,0.07)', border: 'none', fontWeight: 700, fontSize: 10, height: 24 }}>
                Edit
              </Button>

              {/* CANCEL / CLEAR */}
              <Button leftSection={<IconBan size={12} />} onClick={handleClear}
                size="compact-xs" radius="sm"
                style={{ background: editingId ? '#b45309' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {editingId ? 'Cancel Edit' : 'Clear'}
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* SEARCH / HISTORY */}
              <Button leftSection={<IconHistory size={12} />}
                onClick={() => { setShowHistory(v => !v); if (showHistory) setHistorySearch(''); }}
                size="compact-xs" radius="sm"
                style={{ background: showHistory ? '#1d4ed8' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {showHistory ? 'Hide' : 'Search'}
              </Button>

              {/* REFRESH */}
              <Button leftSection={<IconRefresh size={12} />} onClick={() => loadTodayEntries(date, shift, center)}
                size="compact-xs" radius="sm"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Refresh
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* PRINT */}
              <Button leftSection={<IconPrinter size={12} />} disabled={!selectedRow}
                onClick={() => selectedRow && printBill(selectedRow, date.toLocaleDateString('en-IN'), shift, centerNameRef.current)}
                size="compact-xs" radius="sm"
                style={{ background: selectedRow ? '#b91c1c' : 'rgba(255,255,255,0.07)', border: 'none', fontWeight: 700, fontSize: 10, height: 24 }}>
                Print
              </Button>

              {/* DELETE */}
              <Button leftSection={<IconTrash size={12} />} disabled={!selectedRow}
                onClick={() => selectedRow && handleDelete(selectedRow.id)}
                size="compact-xs" radius="sm"
                style={{ background: selectedRow ? '#7f1d1d' : 'rgba(255,255,255,0.07)', border: 'none', fontWeight: 700, fontSize: 10, height: 24 }}>
                Delete
              </Button>
            </Group>
          </Group>
        </Box>

        {/* Table */}
        <Box style={{ flex: 1, overflow: 'hidden', background: 'white', borderRadius: '0 0 10px 10px', border: '1px solid #bfdbfe', borderTop: 'none' }}>
          <ScrollArea h="100%" type="auto" viewportRef={tableScrollRef}>
            <Table striped highlightOnHover stickyHeader withColumnBorders style={{ fontSize: 12 }}>
              <Table.Thead style={{ background: 'linear-gradient(180deg,#dbeafe 0%,#bfdbfe 100%)', position: 'sticky', top: 0, zIndex: 10 }}>
                <Table.Tr>
                  {['#', 'Bill No', 'Mem. No', 'Member Name', 'Litres', 'KG', 'FAT %', 'CLR', 'SNF %', 'Incentive', 'Rate/L', 'Amount', ''].map(col => (
                    <Table.Th key={col} style={{ fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e40af', whiteSpace: 'nowrap', padding: '9px 12px', borderBottom: '2px solid #93c5fd' }}>
                      {col}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {filteredEntries.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={13}>
                      <Center py="xl">
                        <Stack align="center" gap={6}>
                          <IconMilk size={48} color="#bfdbfe" />
                          <Text c="dimmed" size="sm" fw={600}>
                            {historySearch ? `No results for "${historySearch}"` : `No entries for ${shift} shift`}
                          </Text>
                          <Text c="dimmed" size="xs">
                            {historySearch ? 'Try a different search term' : 'Search a member and fill in milk details above'}
                          </Text>
                        </Stack>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : filteredEntries.map(entry => {
                  const isSel = selectedRow?.id === entry.id;
                  const isEditing = editingId === entry.id;
                  return (
                    <Table.Tr key={entry.id} onClick={() => setSelectedRow(isSel ? null : entry)}
                      style={{ cursor: 'pointer', background: isEditing ? '#fffbeb' : isSel ? '#eff6ff' : undefined, borderLeft: isEditing ? '3px solid #d97706' : isSel ? '3px solid #2563eb' : '3px solid transparent', transition: 'background 0.1s' }}>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 700, color: '#94a3b8', width: 32, fontSize: 11 }}>{entry.sl}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 700, color: '#1e40af', whiteSpace: 'nowrap' }}>{entry.billNo}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px' }}><Badge size="sm" color="blue" variant="light" radius="sm">{entry.producerNo}</Badge></Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 600, color: '#1e293b' }}>{entry.producerName}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 800, color: '#0369a1', textAlign: 'right' }}>{(entry.ltr ?? entry.qty).toFixed(2)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 800, color: '#065f46', textAlign: 'right' }}>{entry.qty.toFixed(3)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 700, color: '#c2410c', textAlign: 'right' }}>{entry.fat.toFixed(1)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', color: '#6d28d9', textAlign: 'right' }}>{entry.clr.toFixed(1)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', color: '#166534', textAlign: 'right' }}>{entry.snf.toFixed(2)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', textAlign: 'right' }}>&#8377;{entry.incentive.toFixed(2)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 600, textAlign: 'right' }}>&#8377;{entry.rate.toFixed(2)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', textAlign: 'right' }}><Text size="13px" fw={800} c="blue.7">&#8377;{entry.amount.toFixed(2)}</Text></Table.Td>
                      <Table.Td style={{ padding: '6px 8px', width: 30 }}>
                        <ActionIcon size="xs" color="red" variant="subtle" radius="sm" onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}>
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>

              {entries.length > 0 && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#1e3a8a' }}>
                    <Table.Td colSpan={4} style={{ padding: '8px 12px', fontWeight: 700, color: '#93c5fd', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Totals &amp; Averages</Table.Td>
                    <Table.Td style={{ padding: '8px 12px', fontWeight: 900, color: '#7dd3fc', textAlign: 'right', fontSize: 13 }}>{totalLtr.toFixed(2)}</Table.Td>
                    <Table.Td style={{ padding: '8px 12px', fontWeight: 900, color: '#6ee7b7', textAlign: 'right', fontSize: 13 }}>{totalQty.toFixed(3)}</Table.Td>
                    <Table.Td style={{ padding: '8px 12px', fontWeight: 700, color: '#fdba74', textAlign: 'right' }}>{avgFat.toFixed(1)}</Table.Td>
                    <Table.Td colSpan={2} />
                    <Table.Td />
                    <Table.Td style={{ padding: '8px 12px', fontWeight: 700, color: '#e2e8f0', textAlign: 'right' }}>&#8377;{avgRate.toFixed(2)}</Table.Td>
                    <Table.Td style={{ padding: '8px 12px', textAlign: 'right' }}><Text size="14px" fw={900} c="white">&#8377;{totalAmt.toFixed(2)}</Text></Table.Td>
                    <Table.Td />
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </ScrollArea>
        </Box>

        {/* Footer summary strip */}
        <Box style={{ background: 'white', border: '1px solid #bfdbfe', borderTop: '2px solid #dbeafe', borderRadius: '0 0 10px 10px', padding: '4px 12px' }}>
          <Group gap={10} wrap="nowrap" align="center">
            <Box style={{ flexShrink: 0 }}>
              <Text size="10px" fw={800} c="#1e3a8a" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Summary</Text>
              <Text size="9px" c="#94a3b8">{entries.length} records</Text>
            </Box>
            <Divider orientation="vertical" style={{ height: 36 }} />
            {[
              { label: 'FAT Avg',   val: avgFat.toFixed(1),              c: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
              { label: 'CLR Avg',   val: avgClr.toFixed(1),              c: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
              { label: 'Rate Avg',  val: `\u20B9${avgRate.toFixed(2)}`,  c: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
              { label: 'Total Ltr', val: `${totalLtr.toFixed(2)} L`,     c: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
              { label: 'Total Amt', val: `\u20B9${totalAmt.toFixed(2)}`, c: 'white',   bg: '#1e40af', border: '#1e40af', bold: true },
            ].map(({ label, val, c, bg, border, bold }) => (
              <Box key={label} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 8, padding: '3px 12px', textAlign: 'center', flexShrink: 0 }}>
                <Text size="10px" fw={600} c={bold ? 'rgba(255,255,255,0.75)' : '#64748b'} tt="uppercase" style={{ letterSpacing: '0.4px' }}>{label}</Text>
                <Text size={bold ? '18px' : '16px'} fw={900} style={{ color: c, lineHeight: 1.2 }}>{val}</Text>
              </Box>
            ))}

            <Divider orientation="vertical" style={{ height: 36 }} />

            {/* Local & Credit Sales Summary */}
            {[
              { label: 'Local Sale',  ltr: salesSummary.localLtr,  amt: salesSummary.localAmt,  c: '#065f46', bg: '#ecfdf5', border: '#6ee7b7' },
              { label: 'Credit Sale', ltr: salesSummary.creditLtr, amt: salesSummary.creditAmt, c: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
              { label: 'Sample Sale', ltr: salesSummary.sampleLtr, amt: salesSummary.sampleAmt, c: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc' },
            ].map(({ label, ltr, amt, c, bg, border }) => (
              <Box key={label} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 8, padding: '5px 14px', textAlign: 'center', flexShrink: 0 }}>
                <Text size="10px" fw={700} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px' }}>{label}</Text>
                <Text size="13px" fw={800} style={{ color: c, lineHeight: 1.3 }}>{ltr.toFixed(2)} L</Text>
                <Text size="15px" fw={900} style={{ color: c, lineHeight: 1.2 }}>&#8377;{amt.toFixed(2)}</Text>
              </Box>
            ))}

            {/* Union Sale = Purchase - Local - Credit */}
            {(() => {
              const unionLtr = Math.max(0, totalLtr - salesSummary.localLtr - salesSummary.creditLtr - salesSummary.sampleLtr);
              return (
                <Box style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: 8, padding: '5px 14px', textAlign: 'center', flexShrink: 0 }}>
                  <Text size="10px" fw={700} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Union Sale</Text>
                  <Text size="10px" c="#94a3b8" style={{ lineHeight: 1.2 }}>{totalLtr.toFixed(2)} − {salesSummary.localLtr.toFixed(2)} − {salesSummary.creditLtr.toFixed(2)} − {salesSummary.sampleLtr.toFixed(2)}</Text>
                  <Text size="15px" fw={900} style={{ color: '#1e40af', lineHeight: 1.2 }}>{unionLtr.toFixed(2)} L</Text>
                </Box>
              );
            })()}

            {/* Best Farmer */}
            {entries.length > 0 && (() => {
              const best = entries.reduce((b, e) => e.amount > b.amount ? e : b, entries[0]);
              return (
                <Box style={{ background: 'linear-gradient(135deg,#fef9c3,#fde68a)', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '5px 12px', flexShrink: 0 }}>
                  <Text size="13px" fw={700} c="#78350f" tt="uppercase" style={{ letterSpacing: '0.4px' }}>⭐ Today's Best Farmer</Text>
                  <Text size="19px" fw={800} c="#92400e" style={{ lineHeight: 1.3, whiteSpace: 'nowrap' }}>{best.producerName}</Text>
                  <Group gap={4}>
                    <Badge size="xs" color="orange" variant="filled" radius="sm">{best.producerNo}</Badge>
                    <Text size="19px" fw={900} c="#b45309">&#8377;{best.rate.toFixed(2)}</Text>
                  </Group>
                </Box>
              );
            })()}
          </Group>
        </Box>
      </Box>

      {/* ── End left column ── */}
      </Box>

      {/* ══ RIGHT CONTROL PANEL ══════════════════════════════════════════════ */}
      <Box style={{
        width: 200, flexShrink: 0,
        background: 'linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 40%, #e0f2f1 100%)',
        borderLeft: '2px solid #80deea',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        fontSize: 11,
        overflowY: 'auto',
      }}>

        {/* Top Menu Bar */}
        <Box style={{ background: '#006064', padding: '3px 0', display: 'flex', gap: 0 }}>
          {['Administrator', 'Help'].map(m => (
            <Box key={m} style={{ padding: '2px 8px', color: '#e0f7fa', fontSize: 10, cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = '#00838f'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{m}</Box>
          ))}
        </Box>

        {/* Speak Button */}
        <Box style={{ padding: '8px 10px 4px' }}>
          <Box style={{
            width: 64, height: 64,
            background: speakEnabled
              ? 'linear-gradient(145deg, #a5f3a5, #4ade80)'
              : 'linear-gradient(145deg, #e0f7fa, #b2ebf2)',
            border: `2px solid ${speakEnabled ? '#15803d' : '#006064'}`,
            borderRadius: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', userSelect: 'none',
            boxShadow: speakEnabled
              ? 'inset 1px 1px 3px rgba(0,0,0,0.25), 0 0 6px rgba(74,222,128,0.5)'
              : '2px 2px 4px rgba(0,0,0,0.2), -1px -1px 2px rgba(255,255,255,0.8)',
            fontSize: 11, fontWeight: 700,
            color: speakEnabled ? '#14532d' : '#004d40',
            gap: 2,
          }}
            onClick={() => setSpeakEnabled(v => !v)}
          >
            <span style={{ fontSize: 18 }}>{speakEnabled ? '🔊' : '🔇'}</span>
            <span>{speakEnabled ? 'ON' : 'OFF'}</span>
          </Box>
        </Box>

        {/* MODE Section */}
        <Box style={{ margin: '6px 8px 0', borderRadius: 4, border: '1px solid #80deea', background: 'rgba(255,255,255,0.45)', overflow: 'hidden' }}>
          <Box style={{ background: '#006064', padding: '2px 8px', color: '#e0f7fa', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>MODE</Box>
          <Box style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['Weight', 'Analyzer', 'DISP', 'Milk Bill', 'SMS', 'WhatsApp'].map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox"
                  checked={cpMode.includes(opt)}
                  onChange={e => {
                    const checked = e.target.checked;
                    setCpMode(prev => checked ? [...prev, opt] : prev.filter(x => x !== opt));
                    if (opt === 'Weight') {
                      if (checked) connectScale();
                      else disconnectScale();
                    }
                    if (opt === 'DISP') {
                      if (checked) connectDisplay();
                      else disconnectDisplay();
                    }
                  }}
                  style={{ accentColor: '#006064', width: 12, height: 12 }}
                />
                <span style={{ color: '#004d40', fontWeight: 600 }}>{opt}</span>
                {opt === 'Analyzer' && cpMode.includes('Analyzer') && (
                  <Box style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: analyzerRunning ? '#22c55e' : '#f59e0b',
                    boxShadow: analyzerRunning ? '0 0 4px #22c55e' : 'none',
                    flexShrink: 0
                  }} title={analyzerRunning ? 'Analyzer running' : 'Analyzer not started'} />
                )}
                {opt === 'DISP' && cpMode.includes('DISP') && (
                  <>
                    <Box style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: displayConnected ? '#22c55e' : '#f59e0b',
                      boxShadow: displayConnected ? '0 0 4px #22c55e' : 'none',
                      flexShrink: 0
                    }} title={displayConnected ? 'Display connected' : 'Display not connected'} />
                    {displayConnected && (
                      <>
                        {['none','cr','crlf'].map(term => (
                          <span
                            key={term}
                            style={{ fontSize: 9, color: '#0369a1', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700, marginLeft: 2 }}
                            title={`Send test frame — terminator: ${term}`}
                            onClick={async (e) => {
                              e.preventDefault();
                              const res = await machineConfigAPI.testDisplay(undefined, term);
                              const label = term === 'none' ? 'no-term' : term.toUpperCase();
                              if (res?.success) {
                                notifications.show({ title: `TEST [${label}] sent`, message: `Check display. HEX tail: ...${res.hex?.slice(-6) || ''}`, color: 'teal', autoClose: 6000 });
                              } else {
                                notifications.show({ title: `TEST [${label}] FAILED`, message: res?.message, color: 'red', autoClose: 6000 });
                              }
                            }}
                          >{term === 'none' ? 'T1' : term === 'cr' ? 'T2' : 'T3'}</span>
                        ))}
                      </>
                    )}
                  </>
                )}
              </label>
            ))}
          </Box>
        </Box>

        {/* ANALYZER Panel — shown when Analyzer mode is checked */}
        {cpMode.includes('Analyzer') && (
          <Box style={{ margin: '6px 8px 0', borderRadius: 4, border: `1px solid ${analyzerRunning ? '#6ee7b7' : '#fde68a'}`, background: analyzerRunning ? 'rgba(240,255,244,0.9)' : 'rgba(255,251,235,0.9)', overflow: 'hidden' }}>
            {/* Header row */}
            <Box style={{ background: analyzerRunning ? '#059669' : '#d97706', padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Box style={{ width: 7, height: 7, borderRadius: '50%', background: analyzerRunning ? '#a7f3d0' : '#fef3c7', animation: analyzerRunning ? 'pulse 1.2s infinite' : 'none' }} />
                <Text size="10px" fw={800} c="white" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                  {analyzerDeviceName || 'Milk Analyzer'}
                </Text>
              </Box>
              <Text size="9px" c="white" style={{ opacity: 0.85 }}>
                {analyzerRunning ? 'LIVE' : 'STOPPED'}
              </Text>
            </Box>

            {/* Port selector + Baud (shown when not running) */}
            {!analyzerRunning && (
              <Box style={{ padding: '6px 8px 4px' }}>
                {/* Port row */}
                <Box style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <select
                    value={selectedPort}
                    onChange={e => { setSelectedPort(e.target.value); setPortError(''); }}
                    style={{
                      flex: 1, fontSize: 11, fontWeight: 700, padding: '3px 4px', borderRadius: 4,
                      border: portError ? '1.5px solid #dc2626' : '1.5px solid #d1d5db',
                      background: '#fff', color: selectedPort ? '#111' : '#9ca3af',
                    }}
                  >
                    <option value="">-- Select COM Port --</option>
                    {/* Always show COM1–COM10 */}
                    {['COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','COM10'].map(p => (
                      <option key={p} value={p}>{p}{availablePorts.includes(p) ? ' ✓' : ''}</option>
                    ))}
                    {/* Extra ports detected by scan that are outside COM1–COM10 */}
                    {availablePorts.filter(p => !['COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','COM10'].includes(p)).map(p => (
                      <option key={p} value={p}>{p} ✓</option>
                    ))}
                  </select>
                  <button
                    onClick={handleScanPorts}
                    disabled={portsLoading}
                    title="Scan available COM ports"
                    style={{
                      fontSize: 11, padding: '3px 6px', borderRadius: 4, cursor: 'pointer',
                      background: '#f0f9ff', border: '1px solid #7dd3fc', color: '#0369a1', fontWeight: 700,
                    }}
                  >
                    {portsLoading ? '…' : '⟳'}
                  </button>
                </Box>
                {/* Baud rate row */}
                <Box style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <Text size="9px" fw={700} c="dimmed" style={{ whiteSpace: 'nowrap' }}>Baud:</Text>
                  <select
                    value={selectedBaud}
                    onChange={e => setSelectedBaud(e.target.value)}
                    style={{ flex: 1, fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff' }}
                  >
                    {['1200','2400','4800','9600','19200','38400','57600','115200'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </Box>
                {/* Error message */}
                {portError && (
                  <Text size="9px" c="red" fw={600} mb={4} style={{ wordBreak: 'break-all' }}>{portError}</Text>
                )}
                {/* Available ports hint */}
                {availablePorts.length > 0 && !selectedPort && (
                  <Text size="9px" c="blue.6" fw={600}>
                    Found: {availablePorts.join(', ')}
                  </Text>
                )}
                {availablePorts.length === 0 && !portsLoading && (
                  <Text size="9px" c="dimmed">Click ⟳ to scan COM ports</Text>
                )}
              </Box>
            )}

            {/* Live values grid */}
            {liveAnalyzerData ? (
              <Box style={{ padding: '4px 8px 6px' }}>
                <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                  {[
                    { label: 'FAT',     value: liveAnalyzerData.fat != null ? `${parseFloat(liveAnalyzerData.fat).toFixed(1)}%` : '—', color: '#c2410c', bg: '#fff7ed' },
                    { label: 'SNF',     value: liveAnalyzerData.snf != null ? `${parseFloat(liveAnalyzerData.snf).toFixed(2)}%` : '—', color: '#166534', bg: '#f0fdf4' },
                    { label: 'Density', value: liveAnalyzerData.density != null ? String(liveAnalyzerData.density) : '—',             color: '#6d28d9', bg: '#f5f3ff' },
                    { label: 'Water',   value: liveAnalyzerData.addedWater != null ? `${liveAnalyzerData.addedWater}%` : '0%',         color: '#be123c', bg: '#fff1f2' },
                  ].map(({ label, value, color, bg }) => (
                    <Box key={label} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 4, padding: '3px 5px', textAlign: 'center' }}>
                      <Text size="8px" fw={700} tt="uppercase" style={{ color, opacity: 0.75, letterSpacing: '0.3px' }}>{label}</Text>
                      <Text size="12px" fw={900} style={{ color, lineHeight: 1.2 }}>{value}</Text>
                    </Box>
                  ))}
                </Box>
                {liveAnalyzerData.rawData && (() => {
                  const raw = liveAnalyzerData.rawData;
                  const inner = raw.length === 31 ? raw.slice(1, 30) : null;
                  return (
                    <Box style={{ background: '#f1f5f9', borderRadius: 4, padding: '4px 6px', marginTop: 4 }}>
                      <Text size="8px" fw={700} c="dimmed" mb={2}>RAW DATA</Text>
                      <Text size="9px" style={{ fontFamily: 'monospace', wordBreak: 'break-all', color: '#334155' }}>{raw}</Text>
                      {inner && (
                        <Box style={{ marginTop: 4 }}>
                          <Text size="8px" style={{ fontFamily: 'monospace', color: '#c2410c' }}>FAT  [{inner.slice(0,4)}] = {(parseInt(inner.slice(0,4),10)/100).toFixed(2)}</Text>
                          <Text size="8px" style={{ fontFamily: 'monospace', color: '#166534' }}>SNF  [{inner.slice(4,8)}] = {(parseInt(inner.slice(4,8),10)/100).toFixed(2)}</Text>
                          <Text size="8px" style={{ fontFamily: 'monospace', color: '#6d28d9' }}>DEN  [{inner.slice(8,12)}] = {parseInt(inner.slice(8,12),10)}</Text>
                          <Text size="8px" style={{ fontFamily: 'monospace', color: '#9ca3af' }}>??   [{inner.slice(12,14)}]</Text>
                          <Text size="8px" style={{ fontFamily: 'monospace', color: '#be123c' }}>WATER[{inner.slice(14,16)}] = {parseInt(inner.slice(14,16),10)}%</Text>
                          <Text size="8px" style={{ fontFamily: 'monospace', color: '#9ca3af' }}>REST [{inner.slice(16)}]</Text>
                        </Box>
                      )}
                    </Box>
                  );
                })()}
              </Box>
            ) : analyzerRunning ? (
              <Box style={{ padding: '4px 8px 6px' }}>
                <Text size="10px" c="teal.7" fw={600} ta="center">Waiting for reading…</Text>
              </Box>
            ) : null}

            {/* Start / Stop buttons */}
            <Box style={{ padding: '0 8px 8px', display: 'flex', gap: 4 }}>
              <button
                onClick={handleStartAnalyzer}
                disabled={analyzerRunning || analyzerStarting || !selectedPort}
                style={{
                  flex: 1, fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 4,
                  cursor: (analyzerRunning || !selectedPort) ? 'not-allowed' : 'pointer',
                  background: analyzerRunning ? '#d1fae5' : '#059669', color: analyzerRunning ? '#065f46' : 'white',
                  border: `1px solid ${analyzerRunning ? '#6ee7b7' : '#047857'}`,
                  opacity: (analyzerRunning || !selectedPort) ? 0.6 : 1,
                }}
              >
                {analyzerStarting ? '...' : analyzerRunning ? '● Running' : '▶ Start'}
              </button>
              <button
                onClick={handleStopAnalyzer}
                disabled={!analyzerRunning}
                style={{
                  flex: 1, fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 4, cursor: !analyzerRunning ? 'not-allowed' : 'pointer',
                  background: !analyzerRunning ? '#fef2f2' : '#dc2626', color: !analyzerRunning ? '#9ca3af' : 'white',
                  border: `1px solid ${!analyzerRunning ? '#fecaca' : '#b91c1c'}`, opacity: !analyzerRunning ? 0.5 : 1,
                }}
              >
                ■ Stop
              </button>
            </Box>
          </Box>
        )}


        {/* Spacer */}
        <Box style={{ flex: 1 }} />

        {/* Bottom Buttons: CAN + TARE */}
        <Box style={{ padding: '10px 10px 14px', display: 'flex', gap: 8 }}>
          {[
            { label: 'CAN', bg: '#b71c1c', hover: '#c62828' },
            { label: 'TARE', bg: '#1b5e20', hover: '#2e7d32' },
          ].map(({ label, bg, hover }) => (
            <Box key={label} style={{
              flex: 1, height: 32,
              background: bg,
              border: '1px solid rgba(0,0,0,0.3)',
              borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', userSelect: 'none',
              color: 'white', fontWeight: 700, fontSize: 11,
              boxShadow: '2px 2px 4px rgba(0,0,0,0.25), -1px -1px 2px rgba(255,255,255,0.1)',
            }}
              onMouseEnter={e => e.currentTarget.style.background = hover}
              onMouseLeave={e => e.currentTarget.style.background = bg}
              onMouseDown={e => e.currentTarget.style.boxShadow = 'inset 1px 1px 3px rgba(0,0,0,0.4)'}
              onMouseUp={e => e.currentTarget.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.25)'}
            >{label}</Box>
          ))}
        </Box>

      </Box>
      {/* ══ END RIGHT PANEL ══ */}

      </Box>
      {/* ══ END MAIN CONTENT ══ */}

    </Box>
  );
};

export default MilkPurchase;
