/**
 * MilkSales — Modern Card-Based Layout (matches MilkPurchase style)
 * Header | [Bill Info] [Party Info] [Qty & Amount] | Table
 * Keyboard: Tab→Litre→Rate, Enter=Save, Enter again=Print
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { offlineQueue } from '../../utils/offlineQueue';
import { localDateStr } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import {
  Box, Group, Text, TextInput, NumberInput, Select, Button,
  Table, ScrollArea, ActionIcon, Badge, Divider, Center,
  Loader, Card, Stack, SegmentedControl, Checkbox,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconMilk, IconReceipt, IconUser, IconBuilding,
  IconDeviceFloppy, IconX, IconPlus, IconEdit, IconBan,
  IconTrash, IconPrinter, IconRefresh, IconSearch, IconHistory,
  IconAlertCircle, IconCash, IconCreditCard, IconUpload, IconFilter, IconBook, IconBrandWhatsapp,
} from '@tabler/icons-react';
import { customerAPI, collectionCenterAPI, milkSalesAPI, agentAPI, milkSalesRateAPI, thermalPrintAPI, whatsappAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ImportModal from '../common/ImportModal';

// ── Zibitt Local Sales → MilkSales schema ────────────────────────────────────
// Columns: BillNo, SalesDate, SalesShift (0=AM/1=PM), Sales_Qty, RatePerLtr,
//          TotalAmt, Description, Centercode, Agent, VoucherNo, VoucherID
//
// SalesDate arrives as an Excel serial number (e.g. 43556).
// Formula: (serial - 25569) * 86400000 ms from Unix epoch.
const excelSerialToDate = (val) => {
  if (val == null || val === '') return new Date();
  if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400000));
  return new Date(val);
};

const mapZibittRows = (rows) =>
  rows.map((row, i) => {
    const sm = row.SaleMode ? String(row.SaleMode).trim().toUpperCase() : 'LOCAL';
    const isCredit = sm === 'CREDIT' || sm === 'CR';
    return {
      billNo:      String(row.BillNo || row.VoucherNo || `IMP-${i + 1}`),
      date:        excelSerialToDate(row.SalesDate),
      session:     String(row.SalesShift) === '0' ? 'AM' : 'PM',
      saleMode:    isCredit ? 'CREDIT' : 'LOCAL',
      litre:       Number(row.Sales_Qty)  || 0,
      rate:        Number(row.RatePerLtr) || 0,
      amount:      Number(row.TotalAmt)   || 0,
      centerName:  row.Centercode ? String(row.Centercode) : undefined,
      agentName:   row.Agent      ? String(row.Agent)      : undefined,
      paymentType: isCredit ? 'Credit' : 'Cash',
    };
  });

// ── Month / Year filter data ──────────────────────────────────────────────────
const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' },   { value: '4', label: 'April' },
  { value: '5', label: 'May' },     { value: '6', label: 'June' },
  { value: '7', label: 'July' },    { value: '8', label: 'August' },
  { value: '9', label: 'September' },{ value: '10', label: 'October' },
  { value: '11', label: 'November' },{ value: '12', label: 'December' },
];
const YEARS = Array.from({ length: new Date().getFullYear() - 2010 + 2 }, (_, i) => {
  const y = 2011 + i; return { value: String(y), label: String(y) };
}).reverse();

// ── Bill No generator ─────────────────────────────────────────────────────────
const genBillNo = () => {
  const n = new Date();
  const yymm = `${String(n.getFullYear()).slice(-2)}${String(n.getMonth() + 1).padStart(2, '0')}`;
  return `MS-${yymm}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
};

// ── Thermal Print — fires ESC/POS via backend, falls back to iframe PDF ───────
const printSlip = (entry) => {
  const isLocal = entry.saleMode === 'LOCAL' || entry.saleMode === 'SAMPLE';
  const dateStr = entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '';

  thermalPrintAPI.milkSalesReceipt({
    billNo:       entry.billNo,
    dateStr,
    session:      entry.session,
    saleMode:     entry.saleMode,
    centerName:   entry.centerName  || '',
    agentName:    entry.agentName   || '',
    creditorName: entry.creditorName || '',
    litre:        entry.litre,
    rate:         entry.rate,
    amount:       entry.amount,
    paymentType:  entry.paymentType || 'Cash',
  }).catch(err => {
    // Fallback to iframe PDF print (no new window/dialog)
    const msg = err?.response?.data?.message || err.message || 'Thermal print failed';
    console.warn('[ThermalPrint] API failed:', msg);
    notifications.show({ color: 'orange', title: 'Thermal Print Failed — PDF fallback', message: msg, autoClose: 6000 });

    const html = `<html><head><title>Milk Sales Receipt</title>
    <style>
      @page{size:58mm auto;margin:2mm 3mm}
      body{font-family:'Courier New',monospace;font-size:10px;width:52mm;margin:0}
      h3{text-align:center;margin:0 0 1px;font-size:11px;font-weight:900}
      .sub{text-align:center;font-size:9px;color:#444;margin-bottom:4px}
      .line{border-top:1px dashed #000;margin:3px 0}
      .row{display:flex;justify-content:space-between;margin:2px 0}
      .val{font-weight:bold}
      .big{font-size:12px;font-weight:900}
      .foot{text-align:center;font-size:9px;color:#666;margin-top:4px}
    </style></head><body>
    <h3>MILK SALES</h3>
    <div class="sub">${dateStr} | ${entry.session || ''} | ${entry.saleMode || ''}</div>
    <div class="line"></div>
    <div class="row"><span>Bill No</span><span class="val">${entry.billNo || ''}</span></div>
    ${isLocal
      ? (entry.centerName ? `<div class="row"><span>Center</span><span>${entry.centerName}</span></div>` : '')
      : (entry.creditorName ? `<div class="row"><span>Creditor</span><span>${entry.creditorName}</span></div>` : '')}
    ${!isLocal && entry.centerName ? `<div class="row"><span>Center</span><span>${entry.centerName}</span></div>` : ''}
    ${!isLocal && entry.agentName  ? `<div class="row"><span>Agent</span><span>${entry.agentName}</span></div>`  : ''}
    <div class="line"></div>
    <div class="row"><span>Litres</span><span class="val">${parseFloat(entry.litre || 0).toFixed(2)} L</span></div>
    <div class="row"><span>Rate/Ltr</span><span>Rs.${parseFloat(entry.rate || 0).toFixed(2)}</span></div>
    ${isLocal ? `<div class="row"><span>Payment</span><span>${entry.paymentType || 'Cash'}</span></div>` : ''}
    <div class="line"></div>
    <div class="row big"><span>AMOUNT</span><span>Rs.${parseFloat(entry.amount || 0).toFixed(2)}</span></div>
    <div class="line"></div>
    <div class="foot">Thank You</div>
    </body></html>`;

    const old = document.getElementById('__milk_sales_print_frame__');
    if (old) old.remove();
    const iframe = document.createElement('iframe');
    iframe.id = '__milk_sales_print_frame__';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:58mm;height:1px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 1000); }, 250);
  });
};

// Convert dayjs / string / undefined to a native JS Date
const toDate = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d?.toDate === 'function') return d.toDate(); // dayjs
  return new Date(d);
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function MilkSales() {
  const navigate = useNavigate();
  const { userCenter, userAgent } = useAuth();

  // Keyboard swap:
  //   • Ctrl/⌘ + S | plain S → Milk Sales (this page)
  //   • Ctrl/⌘ + P | plain P → Milk Purchase
  // Plain-letter shortcuts only fire when focus is NOT in an input/textarea/
  // select/contenteditable element, so typing the letter in a field doesn't
  // hijack the page.
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key?.toLowerCase();
      if (k !== 's' && k !== 'p') return;

      const ae  = document.activeElement;
      const tag = ae?.tagName;
      const isFormEl = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ae?.isContentEditable;
      const withMod  = e.ctrlKey || e.metaKey;
      if (!withMod && isFormEl) return;     // typing letters in a field

      e.preventDefault();
      if (k === 's') navigate('/daily-collections/milk-sales');
      else           navigate('/daily-collections/milk-purchase');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  // Saved form fields helper (lazy — only parsed once per mount)
  const _msf = () => { try { return JSON.parse(sessionStorage.getItem('milkSales_form') || 'null') || {}; } catch { return {}; } };

  const [mode,    setMode]    = useState('LOCAL');
  const [session, setSession] = useState(() => _msf().session || (new Date().getHours() < 12 ? 'AM' : 'PM'));
  const [date,    setDate]    = useState(() => {
    try {
      const saved = sessionStorage.getItem('milkSales_date');
      if (saved) { const d = new Date(saved); if (!isNaN(d)) return d; }
    } catch { /* ignore */ }
    return new Date();
  });
  const [billNo,  setBillNo]  = useState(() => _msf().billNo || '');

  const [center,   setCenter]   = useState(() => _msf().center   ?? null);
  const [agent,    setAgent]    = useState(() => _msf().agent     ?? null);
  const [category, setCategory] = useState(() => _msf().category ?? null);
  const [creditor, setCreditor] = useState(() => _msf().creditor  ?? null);
  const [opCr,     setOpCr]     = useState('');
  const [litre,    setLitre]    = useState(() => _msf().litre || '');
  const [rate,     setRate]     = useState(() => _msf().rate  || '');
  const [amount,   setAmount]   = useState(0);
  const [pType,    setPType]    = useState(() => _msf().pType || 'Cash');

  const [customersRaw, setCustomersRaw] = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [centers,      setCenters]      = useState([]);
  const [agents,       setAgents]       = useState([]);
  const [entries,      setEntries]      = useState([]);
  const [selRow,       setSelRow]       = useState(null);
  const [editingId,    setEditingId]    = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [milkBill,     setMilkBill]     = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [showHistory,   setShowHistory]   = useState(false);
  const [importOpen,        setImportOpen]        = useState(false);
  const [rawImportOpen,     setRawImportOpen]     = useState(false);
  const [linzaImportOpen,   setLinzaImportOpen]   = useState(false);
  const [olImportOpen,      setOlImportOpen]      = useState(false);
  const [backfilling,   setBackfilling]   = useState(false);
  const [pendingCount,  setPendingCount]  = useState(() => offlineQueue.byType('milk-sales').length);
  const [filterMonth,   setFilterMonth]   = useState(String(new Date().getMonth() + 1));
  const [filterYear,    setFilterYear]    = useState(String(new Date().getFullYear()));
  const [monthMode,     setMonthMode]     = useState(false);

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const [waEnabled,      setWaEnabled]      = useState(false);
  const [waStatus,       setWaStatus]       = useState({ connected: false, initializing: false, qr: null });
  const [waBulkSending,  setWaBulkSending]  = useState(false);
  const [waBulkProgress, setWaBulkProgress] = useState({ done: 0, total: 0 });
  const [waSendType,     setWaSendType]     = useState('individual');
  const [waGroupId,      setWaGroupId]      = useState('');
  const whatsAppSettingsRef = useRef({ enabled: false, sendType: 'individual', groupId: '', messageTemplate: '' });

  const isLocal = mode === 'LOCAL' || mode === 'SAMPLE';

  // Persist date across Ctrl+S / Ctrl+P navigation
  useEffect(() => {
    try { sessionStorage.setItem('milkSales_date', date.toISOString()); } catch { /* ignore */ }
  }, [date]);

  // Persist unsaved form fields across navigation
  useEffect(() => {
    try {
      sessionStorage.setItem('milkSales_form', JSON.stringify({
        mode, session, billNo, center, agent, category, creditor, litre, rate, pType
      }));
    } catch { /* ignore */ }
  }, [mode, session, billNo, center, agent, category, creditor, litre, rate, pType]); // eslint-disable-line

  const litrRef   = useRef(null);
  const rateRef   = useRef(null);
  const lastEntryRef = useRef(null);
  const formRef      = useRef({});
  formRef.current = { mode, session, date, billNo, center, agent, category, creditor, opCr, litre, rate, amount, pType, editingId, waEnabled, waConnected: waStatus.connected };

  // ── Auto-calc amount ──────────────────────────────────────────────────────
  useEffect(() => {
    setAmount(parseFloat(((parseFloat(litre) || 0) * (parseFloat(rate) || 0)).toFixed(2)));
  }, [litre, rate]);

  // ── Auto-fetch rate from MilkSalesRate ────────────────────────────────────
  const fetchRate = async (overrides = {}) => {
    try {
      const m   = overrides.mode     ?? mode;
      const cr  = overrides.creditor !== undefined ? overrides.creditor : creditor;
      const ag  = overrides.agent    !== undefined ? overrides.agent    : agent;
      const dt  = overrides.date     ?? date;
      const base = toDate(dt);
      const dateStr = localDateStr(base);

      let salesItemKey = null;
      let partyId = null;

      if (m === 'CREDIT' && cr) {
        salesItemKey = 'Credit Sales';
        partyId = cr;
      } else if (m === 'LOCAL') {
        salesItemKey = 'Local Sales';
        partyId = ag || null;
      } else if (m === 'SAMPLE') {
        salesItemKey = 'Sample Sales';
        partyId = ag || null;
      }

      if (!salesItemKey) {
        setRate('');  // clear rate when mode has no valid sales item (e.g. CREDIT with no creditor)
        return;
      }

      let res = await milkSalesRateAPI.getLatest(partyId, salesItemKey, dateStr);
      // Fallback to general (null-party) rate when agent-specific rate not found
      if (res?.data?.rate == null && partyId && (m === 'LOCAL' || m === 'SAMPLE')) {
        res = await milkSalesRateAPI.getLatest(null, salesItemKey, dateStr);
      }
      if (res?.data?.rate != null) {
        setRate(String(res.data.rate));
        notifications.show({ color: 'blue', message: `Rate auto-filled: ₹${res.data.rate} (W.E.F ${new Date(res.data.wefDate).toLocaleDateString('en-IN')})`, autoClose: 2500 });
      } else {
        setRate('');  // no rate found — clear stale value
      }
    } catch { /* silent */ }
  };

  useEffect(() => { fetchRate(); }, [creditor, agent, mode, date]); // eslint-disable-line

  // ── Auto-fetch opening credit (outstanding balance) for CREDIT creditor ──
  const fetchOpCr = async (overrides = {}) => {
    const m  = overrides.mode     ?? mode;
    const cr = overrides.creditor !== undefined ? overrides.creditor : creditor;
    const dt = overrides.date     ?? date;
    if (m !== 'CREDIT' || !cr) { setOpCr(''); return; }
    try {
      const base    = toDate(dt);
      const dateStr = localDateStr(base);
      const res = await milkSalesAPI.getCreditorBalance(cr, dateStr);
      setOpCr(res?.data?.balance != null ? String(res.data.balance) : '');
    } catch { setOpCr(''); }
  };

  useEffect(() => { if (!editingId) fetchOpCr(); }, [creditor, mode, date, editingId]); // eslint-disable-line

  // WA status polling — every 3 s when enabled
  useEffect(() => {
    if (!waEnabled) { setWaStatus({ connected: false, initializing: false, qr: null }); return; }
    const poll = setInterval(async () => {
      try { const r = await whatsappAPI.status(); setWaStatus(r?.data || { connected: false, initializing: false, qr: null }); }
      catch { /* silent */ }
    }, 3000);
    return () => clearInterval(poll);
  }, [waEnabled]); // eslint-disable-line

  // Keep WA settings ref in sync
  useEffect(() => {
    whatsAppSettingsRef.current = { ...whatsAppSettingsRef.current, enabled: waEnabled, sendType: waSendType, groupId: waGroupId };
  }, [waEnabled, waSendType, waGroupId]);

  // Auto-select first center/agent for all modes when none is selected
  useEffect(() => {
    if (!center && centers.length) setCenter(centers[0].value);
    if (!agent  && agents.length)  setAgent(agents[0].value);
  }, [mode, centers, agents]); // eslint-disable-line

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadDropdowns();
    loadByDate(new Date(), session);
    fetchNextBillNo();
    // Auto-focus the litres field when the page opens (e.g. via Ctrl+S navigation)
    setTimeout(() => litrRef.current?.focus({ preventScroll: true }), 300);
  }, []); // eslint-disable-line

  // Reload table whenever date or session changes — pass session explicitly so the
  // API filters to only the selected shift (not both AM + PM for the date)
  useEffect(() => {
    const d = toDate(date);
    setFilterMonth(String(d.getMonth() + 1));
    setFilterYear(String(d.getFullYear()));
    loadByDate(d, session);
  }, [date, session]); // eslint-disable-line

  const fetchNextBillNo = async () => {
    try {
      const res = await milkSalesAPI.getNextBillNo();
      if (res?.data?.billNo) setBillNo(res.data.billNo);
    } catch { setBillNo(genBillNo()); }
  };

  const loadDropdowns = async () => {
    try {
      const [c, cc, ag] = await Promise.all([
        customerAPI.getAll({ limit: 500 }),
        collectionCenterAPI.getAll({ limit: 200 }),
        agentAPI.getAllActive(),
      ]);
      const raw = c?.data || [];
      setCustomersRaw(raw);
      setCustomers(raw.map(x => ({ value: x._id, label: x.name || x.customerName || '—', category: x.category || 'Others' })));
      const centerList = (cc?.data || []).map(x => ({ value: x._id, label: x.centerName || x.name || '—' }));
      const agentList  = (ag?.data || []).map(x => ({ value: x._id, label: x.agentName || '—' }));
      setCenters(centerList);
      setAgents(agentList);
      // Auto-select user's assigned center/agent (or first) for all modes
      if (!formRef.current.center) {
        const userCentreId = userCenter?._id?.toString() || userCenter?.toString();
        const preferred = userCentreId && centerList.find(c => c.value === userCentreId);
        if (preferred) setCenter(preferred.value);
        else if (centerList.length) setCenter(centerList[0].value);
      }
      if (!formRef.current.agent) {
        const userAgentId = userAgent?._id?.toString() || userAgent?.toString();
        const preferred = userAgentId && agentList.find(a => a.value === userAgentId);
        if (preferred) setAgent(preferred.value);
        else if (agentList.length) setAgent(agentList[0].value);
      }
    } catch { /* silent */ }
  };

  // Load entries for a specific date + session (default view)
  const loadByDate = async (d, ses) => {
    setLoading(true);
    setMonthMode(false);
    try {
      const dateStr = localDateStr(toDate(d));
      const currentSession = ses ?? formRef.current.session;
      const res = await milkSalesAPI.getAll({ date: dateStr, session: currentSession, limit: 500 });
      setEntries(res?.data || []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  };

  // Load entries for a month range (month view / import view / Go button)
  const loadEntries = async (month = filterMonth, year = filterYear) => {
    setLoading(true);
    setMonthMode(true);
    try {
      const res = await milkSalesAPI.getAll({ month, year, limit: 2000 });
      setEntries(res?.data || []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleNew = () => {
    setEditingId(null); setSelRow(null);
    fetchNextBillNo();
    const defaultCenter = centers[0]?.value || null;
    const defaultAgent  = agents[0]?.value  || null;
    setCenter(defaultCenter); setAgent(defaultAgent); setCategory(null); setCreditor(null);
    setOpCr(''); setLitre(''); setRate(''); setAmount(0); setPType('Cash');
    fetchRate({ mode, creditor: null, agent: defaultAgent, date });
    fetchOpCr({ mode, creditor: null, date });
    setTimeout(() => litrRef.current?.focus(), 60);
  };

  const handleSave = async () => {
    const { mode: m, session: ses, date: d, billNo: bn, center: ct, agent: ag, creditor: cr, opCr: oc, litre: lt, rate: rt, amount: am, pType: pt, editingId: eid } = formRef.current;
    if (!lt || !rt) { notifications.show({ color: 'red', message: 'Enter Litre & Rate' }); return; }
    const isLoc = m === 'LOCAL' || m === 'SAMPLE';
    if (!isLoc && !cr) { notifications.show({ color: 'orange', message: 'Select Creditor' }); return; }

    const ccLabel = centers.find(c => c.value === ct)?.label || '';
    const agLabel = agents.find(a => a.value === ag)?.label || '';
    const crLabel = customers.find(c => c.value === cr)?.label || '';

    const payload = {
      billNo: bn, session: ses, saleMode: m,
      date: localDateStr(toDate(d)),
      centerId: ct || undefined, centerName: ct ? ccLabel : undefined,
      agentId: ag || undefined, agentName: ag ? agLabel : undefined,
      creditorId: !isLoc ? cr : undefined, creditorName: !isLoc ? crLabel : undefined,
      openingCredit: !isLoc ? (parseFloat(oc) || 0) : undefined,
      litre: parseFloat(lt), rate: parseFloat(rt), amount: am,
      paymentType: isLoc ? pt : undefined,
    };

    setSaving(true);
    try {
      let result;
      if (eid) {
        result = await milkSalesAPI.update(eid, payload);
        setEntries(p => p.map(e => e._id === eid ? (result?.data || { ...e, ...payload }) : e));
        notifications.show({ color: 'blue', message: `Updated: ${bn}`, autoClose: 2000 });
        handleNew();
      } else {
        result = await milkSalesAPI.create(payload);
        const saved = result?.data || { ...payload, _id: Date.now().toString() };
        setEntries(p => [saved, ...p]);
        lastEntryRef.current = saved;
        if (milkBill) printSlip(saved);
        notifications.show({ color: 'teal', message: `Saved${milkBill ? ' & Printing' : ''}: ${saved.billNo} — \u20B9${am.toFixed(2)}`, autoClose: 2000 });

        // WhatsApp individual send
        const waRef = whatsAppSettingsRef.current;
        if (waRef.enabled && formRef.current.waConnected) {
          const WA_TPL = waRef.messageTemplate || String.fromCodePoint(0x1F95B) + ' *Milk Sales*\nBill No: {billNo}\nDate: {date} {session}\nMode: {mode}\n{party}\nLitres: {litre} L\nRate: {rate}/L\n{amount}\nPayment: {paymentType}';
          const dateStr = toDate(d).toLocaleDateString('en-IN');
          const partyLine = isLoc ? (agLabel ? `Agent: ${agLabel}` : '') : (crLabel ? `Creditor: ${crLabel}` : '');
          const msg = WA_TPL
            .replace(/{billNo}/g,      saved.billNo || '')
            .replace(/{date}/g,        dateStr)
            .replace(/{session}/g,     ses || '')
            .replace(/{mode}/g,        m || '')
            .replace(/{party}/g,       partyLine)
            .replace(/{litre}/g,       parseFloat(lt).toFixed(2))
            .replace(/{rate}/g,        parseFloat(rt).toFixed(2))
            .replace(/{amount}/g,      am.toFixed(2))
            .replace(/{paymentType}/g, pt || '');
          const sendType = waRef.sendType || 'individual';
          if (sendType === 'group' && waRef.groupId) {
            whatsappAPI.sendGroup(waRef.groupId, msg).then(res => {
              if (res?.success) notifications.show({ message: `WhatsApp sent to group`, color: 'green', autoClose: 2500 });
            }).catch(() => {});
          } else if (!isLoc && cr) {
            const credData = customersRaw.find(x => x._id === cr);
            const phone = credData?.phone || credData?.personalDetails?.phone || credData?.mobile;
            if (phone) {
              whatsappAPI.send(phone, msg).then(res => {
                if (res?.success) notifications.show({ message: `WhatsApp sent to ${phone}`, color: 'green', autoClose: 2500 });
              }).catch(() => {});
            }
          }
        }
        handleNew();
      }
    } catch {
      const item = offlineQueue.add('milk-sales', payload);
      const local = { ...payload, _id: item.localId, _offline: true };
      setEntries(p => [local, ...p]);
      const cnt = offlineQueue.byType('milk-sales').length;
      setPendingCount(cnt);
      notifications.show({ color: 'yellow', title: 'No Connection', message: `Saved offline — ${cnt} record(s) pending sync`, autoClose: 3000 });
      handleNew();
    } finally { setSaving(false); }
  };

  const handleSaveClose = async () => {
    await handleSave();
    window.history.back();
  };

  const handleEdit = () => {
    if (!selRow) { notifications.show({ color: 'yellow', message: 'Select a row to edit' }); return; }
    setEditingId(selRow._id);
    setBillNo(selRow.billNo || '');
    setDate(selRow.date ? new Date(selRow.date) : new Date());
    setSession(selRow.session || 'AM');
    setMode(selRow.saleMode || 'LOCAL');
    setCenter(selRow.centerId || null);
    setAgent(selRow.agentId || null);
    setCreditor(selRow.creditorId || null);
    setOpCr(String(selRow.openingCredit || ''));
    setLitre(String(selRow.litre || ''));
    setRate(String(selRow.rate || ''));
    setAmount(selRow.amount || 0);
    setPType(selRow.paymentType || 'Cash');
    setTimeout(() => litrRef.current?.focus(), 60);
    notifications.show({ color: 'blue', message: `Editing: ${selRow.billNo} — modify values and Save`, autoClose: 3000 });
  };

  const handleDelete = async () => {
    if (!selRow) { notifications.show({ color: 'yellow', message: 'Select a row to delete' }); return; }
    try {
      if (selRow._id && !String(selRow._id).startsWith('local-')) await milkSalesAPI.delete(selRow._id);
      setEntries(p => p.filter(e => e._id !== selRow._id));
      setSelRow(null); handleNew();
      notifications.show({ color: 'orange', message: 'Deleted', autoClose: 1500 });
    } catch { notifications.show({ color: 'red', message: 'Delete failed' }); }
  };

  const handleZibittImport = async (rawRows) => {
    const records = mapZibittRows(rawRows);
    const CHUNK = 500;
    let totalInserted = 0;
    for (let i = 0; i < records.length; i += CHUNK) {
      const batch = records.slice(i, i + CHUNK);
      const res = await milkSalesAPI.bulkImport(batch);
      totalInserted += res?.data?.inserted ?? batch.length;
    }
    notifications.show({ color: 'teal', message: `${totalInserted} of ${records.length} records imported`, autoClose: 3000 });
    loadEntries();
    fetchNextBillNo();
  };

  // Raw Zibitt DB import — backend does transformation + customer lookup
  const handleZibittRawImport = async (rawRows) => {
    const CHUNK = 500;
    let totalInserted = 0, totalSkipped = 0;
    for (let i = 0; i < rawRows.length; i += CHUNK) {
      const batch = rawRows.slice(i, i + CHUNK);
      const res = await milkSalesAPI.zibittRawImport(batch);
      totalInserted += res?.data?.inserted ?? 0;
      totalSkipped  += res?.data?.skipped  ?? 0;
    }
    notifications.show({
      color: totalSkipped ? 'yellow' : 'teal',
      message: `${totalInserted} imported${totalSkipped ? `, ${totalSkipped} skipped` : ''}`,
      autoClose: 4000
    });
    loadEntries();
    fetchNextBillNo();
  };

  // ── OpenLyssa Merged Excel import ────────────────────────────────────────
  // Columns: Date(DD-MM-YYYY), Shift, Cust_ID, Customer, Category,
  //          Sale_Type(CASH|CREDIT), Qty, Rate, Amount, MC_ID, Slno, DCS_ID
  const handleOpenLyssaExcelImport = async (rawRows) => {
    const parseDMY = (val) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      const n = Number(val);
      if (!isNaN(n) && n > 1 && n < 100000) return new Date(Math.round((n - 25569) * 86400000));
      const s = String(val).trim();
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
      const d = new Date(s); return isNaN(d.getTime()) ? null : d;
    };

    const records = rawRows
      .filter(row => row.Qty || row.Amount)
      .map(row => {
        const d     = parseDMY(row.Date);
        const shift = String(row.Shift || 'AM').trim().toUpperCase();
        const dd    = d ? String(d.getDate()).padStart(2,'0') : '01';
        const mm    = d ? String(d.getMonth()+1).padStart(2,'0') : '01';
        const yyyy  = d ? d.getFullYear() : new Date().getFullYear();
        const time  = shift === 'PM' ? '18:00' : '06:00';
        return {
          dcs_id:     String(row.DCS_ID ?? ''),
          mc_id:      String(row.MC_ID  ?? ''),
          slno:       String(row.Slno   ?? ''),
          cust_id:    String(row.Cust_ID ?? ''),
          cust_name:  String(row.Customer ?? ''),
          category:   String(row.Category ?? ''),
          qty:        Number(row.Qty)    || 0,
          rate:       Number(row.Rate)   || 0,
          amount:     Number(row.Amount) || 0,
          date_entry: `${dd}-${mm}-${yyyy} ${time}`,
          shift,
          sale_type:  String(row.Sale_Type || 'CREDIT').trim().toUpperCase() === 'CASH' ? 'CASH' : 'CREDIT',
        };
      });

    const CHUNK = 500;
    let totalInserted = 0, totalSkipped = 0;
    for (let i = 0; i < records.length; i += CHUNK) {
      const res = await milkSalesAPI.openLyssaImport(records.slice(i, i + CHUNK));
      totalInserted += res?.data?.inserted ?? 0;
      totalSkipped  += res?.data?.skipped  ?? 0;
    }
    notifications.show({
      color: totalSkipped ? 'yellow' : 'teal',
      message: `${totalInserted} imported${totalSkipped ? `, ${totalSkipped} skipped` : ''}`,
      autoClose: 4000
    });
    loadEntries();
    fetchNextBillNo();
  };

  // ── LinZA import — columns from the merge-tool output ────────────────────
  // Handles: BillNo, SalesDate (Date obj / NaN / serial), SalesShift, Sales_Qty,
  //          RatePerLtr, TotalAmt, Centercode, Vendor, SaleMode
  const handleLinZAImport = async (rawRows) => {
    const parseDate = (val) => {
      if (!val) return new Date();
      if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
      const n = Number(val);
      if (!isNaN(n) && n > 1 && n < 100000) return new Date(Math.round((n - 25569) * 86400000));
      if (typeof val === 'string') {
        const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
        const d = new Date(val); if (!isNaN(d.getTime())) return d;
      }
      return new Date();
    };
    const records = rawRows.map((row, i) => {
      const sm = String(row.SaleMode || 'LOCAL').trim().toUpperCase();
      const isCredit = sm === 'CREDIT' || sm === 'CR';
      return {
        billNo:      String(row.BillNo || `LNZ-${i + 1}`),
        date:        parseDate(row.SalesDate),
        session:     String(row.SalesShift ?? '0') === '1' ? 'PM' : 'AM',
        saleMode:    isCredit ? 'CREDIT' : 'LOCAL',
        litre:       Number(row.Sales_Qty)  || 0,
        rate:        Number(row.RatePerLtr) || 0,
        amount:      Number(row.TotalAmt)   || 0,
        centerName:  row.Centercode ? String(row.Centercode) : undefined,
        paymentType: isCredit ? 'Credit' : 'Cash',
      };
    });
    const CHUNK = 500;
    let totalInserted = 0;
    for (let i = 0; i < records.length; i += CHUNK) {
      const batch = records.slice(i, i + CHUNK);
      const res = await milkSalesAPI.bulkImport(batch);
      totalInserted += res?.data?.inserted ?? batch.length;
    }
    notifications.show({ color: 'teal', message: `${totalInserted} of ${records.length} LinZA records imported`, autoClose: 3000 });
    loadEntries();
    fetchNextBillNo();
  };

  // ── WhatsApp bulk send ────────────────────────────────────────────────────
  const handleWaBulkSend = async () => {
    const wa = whatsAppSettingsRef.current;
    const WA_TPL = wa.messageTemplate || String.fromCodePoint(0x1F95B) + ' *Milk Sales*\nBill No: {billNo}\nDate: {date} {session}\nMode: {mode}\n{party}\nLitres: {litre} L\nRate: ₹{rate}/L\n💰 Amount: ₹{amount}\nPayment: {paymentType}';
    const rows = filteredEntries;
    if (!rows.length) return;
    const sendType = wa.sendType || 'individual';
    setWaBulkSending(true);
    setWaBulkProgress({ done: 0, total: rows.length });
    try {
      const phoneMap = {};
      customersRaw.forEach(c => {
        const phone = c.phone || c.personalDetails?.phone || c.mobile;
        if (c._id && phone) phoneMap[c._id] = phone;
      });
      let done = 0, sent = 0;
      for (const entry of rows) {
        const dateStr = entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '';
        const partyLine = (entry.saleMode === 'LOCAL' || entry.saleMode === 'SAMPLE')
          ? (entry.agentName ? `Agent: ${entry.agentName}` : '')
          : (entry.creditorName ? `Creditor: ${entry.creditorName}` : '');
        const msg = WA_TPL
          .replace(/{billNo}/g,      entry.billNo || '')
          .replace(/{date}/g,        dateStr)
          .replace(/{session}/g,     entry.session || '')
          .replace(/{mode}/g,        entry.saleMode || '')
          .replace(/{party}/g,       partyLine)
          .replace(/{litre}/g,       parseFloat(entry.litre || 0).toFixed(2))
          .replace(/{rate}/g,        parseFloat(entry.rate || 0).toFixed(2))
          .replace(/{amount}/g,      parseFloat(entry.amount || 0).toFixed(2))
          .replace(/{paymentType}/g, entry.paymentType || '');
        if (sendType === 'group' && wa.groupId) {
          try { await whatsappAPI.sendGroup(wa.groupId, msg); sent++; } catch { /* skip */ }
        } else if (entry.creditorId) {
          const phone = phoneMap[entry.creditorId];
          if (phone) { try { await whatsappAPI.send(phone, msg); sent++; } catch { /* skip */ } }
        }
        done++;
        setWaBulkProgress({ done, total: rows.length });
      }
      const target = sendType === 'group' ? 'group' : `${sent} of ${rows.length} records`;
      notifications.show({ message: `📱 WhatsApp sent to ${target}`, color: 'green', autoClose: 4000 });
    } catch (err) {
      notifications.show({ message: err?.message || 'Bulk send failed', color: 'red' });
    } finally {
      setWaBulkSending(false);
    }
  };

  // ── Sync Day Book / Cash Book — back-post vouchers for any milk sale that lacks one
  const handleBackfillVouchers = async () => {
    if (backfilling) return;
    setBackfilling(true);
    try {
      const res = await milkSalesAPI.backfillVouchers();
      const r = res?.data || {};
      notifications.show({
        color: r.posted > 0 ? 'green' : 'blue',
        title: 'Day Book Sync',
        message: `${r.posted || 0} posted, ${r.skipped || 0} skipped (of ${r.total || 0} milk sales)`,
        autoClose: 4000,
      });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Sync failed' });
    } finally {
      setBackfilling(false);
    }
  };

  // ── Offline sync ──────────────────────────────────────────────────────────
  const syncQueue = useCallback(async () => {
    const pending = offlineQueue.byType('milk-sales');
    if (!pending.length || !navigator.onLine) return;
    let synced = 0;
    for (const item of pending) {
      try {
        await milkSalesAPI.create(item.payload);
        offlineQueue.remove(item.localId);
        synced++;
      } catch { break; }
    }
    if (synced > 0) {
      setPendingCount(offlineQueue.byType('milk-sales').length);
      notifications.show({ color: 'green', title: 'Offline Sync', message: `${synced} record(s) synced to server`, autoClose: 4000 });
      loadByDate(toDate(date), session);
    }
  }, [date, session]);

  useEffect(() => {
    window.addEventListener('online', syncQueue);
    return () => window.removeEventListener('online', syncQueue);
  }, [syncQueue]);

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  const focusNext = (ref) => (e) => { if (e.key === 'Enter') { e.preventDefault(); ref.current?.focus(); } };

  const handleRateEnter = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
  };

  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortTh = ({ label, sk, style = {} }) => (
    <Table.Th
      onClick={() => sk && handleSort(sk)}
      style={{ fontWeight:800, fontSize:10, textTransform:'uppercase', letterSpacing:'0.5px',
               color:'#14532d', whiteSpace:'nowrap', padding:'9px 12px',
               borderBottom:'2px solid #86efac', cursor: sk ? 'pointer' : 'default',
               userSelect:'none', ...style }}
    >
      {label}{sk && sortKey === sk ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </Table.Th>
  );

  // All loaded entries (date-filtered at API level); search filters on top
  const filteredEntries = historySearch.trim()
    ? entries.filter(e => [e.billNo, e.creditorName, e.centerName, e.agentName].some(v => (v || '').toLowerCase().includes(historySearch.toLowerCase())))
    : entries;

  const sortedEntries = (() => {
    if (!sortKey) return filteredEntries;
    const d = sortDir === 'asc' ? 1 : -1;
    return [...filteredEntries].sort((a, b) => {
      const numFields = ['litre', 'rate', 'amount', 'openingCredit'];
      if (numFields.includes(sortKey)) return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * d;
      if (sortKey === 'date') return (new Date(a.date||0) - new Date(b.date||0)) * d;
      return String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')) * d;
    });
  })();

  // Aggregates
  const totL = filteredEntries.reduce((s, e) => s + (parseFloat(e.litre) || 0), 0);
  const totA = filteredEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const avgR = filteredEntries.length ? filteredEntries.reduce((s, e) => s + (parseFloat(e.rate) || 0), 0) / filteredEntries.length : 0;

  const modeColor = mode === 'LOCAL' ? '#16a34a' : mode === 'SAMPLE' ? '#0369a1' : '#7c3aed';
  const modeBg    = mode === 'LOCAL' ? '#f0fdf4' : mode === 'SAMPLE' ? '#f0f9ff' : '#f5f3ff';

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Box className="ms-root" style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>
      <style>{`
        @media (max-width: 768px) {
          .ms-root { height: auto !important; min-height: calc(100dvh - 60px); overflow-y: auto !important; }

          /* Header */
          .ms-header-box { padding: 6px 10px !important; }
          .ms-header-group { flex-wrap: wrap !important; gap: 6px !important; }
          .ms-header-left { flex-wrap: wrap !important; gap: 6px !important; }
          .ms-header-title { display: none !important; }
          .ms-header-sep { display: none !important; }

          /* Cards */
          .ms-card-row { padding: 6px 8px 0 !important; }
          .ms-card-group > * { flex: 1 1 100% !important; min-width: 0 !important; }

          /* Table section */
          .ms-table-section { padding: 6px 6px 6px !important; overflow: visible !important; }

          /* Table bar — stack left and right */
          .ms-table-bar { flex-direction: column !important; align-items: flex-start !important; gap: 6px !important; padding: 8px 10px !important; }

          /* Left group: title + badges + month controls — wrap */
          .ms-table-bar-left { flex-wrap: wrap !important; flex-shrink: 1 !important; width: 100% !important; gap: 5px !important; }

          /* Month/Year selects + GO button */
          .ms-month-group { flex-wrap: wrap !important; width: 100% !important; gap: 5px !important; }
          .ms-month-group .mantine-Select-root { flex: 1 1 90px !important; min-width: 80px !important; }
          .ms-month-group .mantine-Select-input { font-size: 11px !important; height: 28px !important; color: white !important; }
          .ms-month-group button { flex: 0 0 auto !important; height: 28px !important; padding: 0 12px !important; font-size: 11px !important; }

          /* Right group: action buttons */
          .ms-table-bar-right { flex-wrap: wrap !important; gap: 4px !important; width: 100% !important; justify-content: flex-start !important; }
          .ms-table-bar-right .mantine-TextInput-root { width: 100% !important; min-width: 100% !important; margin-bottom: 4px !important; }
          .ms-table-bar-right .mantine-TextInput-input { font-size: 11px !important; height: 26px !important; }
          .ms-table-bar-right button { font-size: 10px !important; height: 26px !important; padding: 0 9px !important; }

          /* Footer */
          .ms-footer-box { padding: 6px 10px !important; }
          .ms-footer-strip { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; }
          .ms-summary-label { grid-column: 1 / -1 !important; }
          .ms-footer-divider { display: none !important; }
        }

        @media (max-width: 480px) {
          .ms-footer-strip { grid-template-columns: repeat(2, 1fr) !important; }
          .ms-month-group .mantine-Select-root { min-width: 72px !important; }
          .ms-table-bar-right button { font-size: 9px !important; padding: 0 7px !important; }
        }
      `}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <Box className="ms-header-box" style={{ background: 'white', borderBottom: '1px solid #dbeafe', padding: '8px 20px', flexShrink: 0, boxShadow: '0 1px 6px rgba(37,99,235,0.08)' }}>
        <Group className="ms-header-group" justify="space-between" align="center" wrap="wrap">

          {/* LEFT: icon + title + controls */}
          <Group className="ms-header-left" gap={12} align="center" wrap="wrap" style={{ flex: 1 }}>
            <Box style={{ background: '#dcfce7', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <IconMilk size={22} color="#16a34a" />
            </Box>
            <Box className="ms-header-title" style={{ flexShrink: 0 }}>
              <Group gap={8} align="center">
                <Text size="16px" fw={800} c="#14532d" style={{ lineHeight: 1.1, letterSpacing: '-0.3px' }}>Milk Sales</Text>
                <Badge color={mode === 'LOCAL' ? 'green' : mode === 'SAMPLE' ? 'blue' : 'violet'} size="sm" variant="filled">{mode}</Badge>
                {editingId && <Badge color="orange" size="sm" variant="filled">EDIT MODE</Badge>}
              </Group>
              <Text size="10px" c="#64748b">Daily Sales Entry</Text>
            </Box>

            <Box className="ms-header-sep" style={{ width: 1, height: 36, background: '#dbeafe', flexShrink: 0 }} />

            {/* Date */}
            <Box style={{ flexShrink: 0 }}>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3} style={{ letterSpacing: '0.4px' }}>Date</Text>
              <DatePickerInput
                value={date} onChange={v => v && setDate(toDate(v))} valueFormat="DD MMM YYYY"
                size="xs" radius="md" style={{ width: 120 }}
                styles={{ input: { fontWeight: 700, fontSize: 12, border: '1.5px solid #bfdbfe', height: 28 } }}
              />
            </Box>

            {/* Session */}
            <Box style={{ flexShrink: 0 }}>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3} style={{ letterSpacing: '0.4px' }}>Session</Text>
              <SegmentedControl
                value={session} onChange={setSession}
                data={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]}
                size="xs" radius="md"
                styles={{ root: { background: '#f1f5f9', border: '1.5px solid #bfdbfe' } }}
              />
            </Box>

            {/* Sale Type */}
            <Box style={{ flexShrink: 0 }}>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3} style={{ letterSpacing: '0.4px' }}>Sale Type</Text>
              <SegmentedControl
                value={mode} onChange={(v) => { setMode(v); setPType(v === 'CREDIT' ? 'Bank' : 'Cash'); }}
                data={[{ value: 'LOCAL', label: 'Local' }, { value: 'CREDIT', label: 'Credit' }, { value: 'SAMPLE', label: 'Sample' }]}
                size="xs" radius="md"
                styles={{ root: { background: '#f1f5f9', border: '1.5px solid #bfdbfe' } }}
              />
            </Box>

          </Group>

          {/* RIGHT: Offline badge + Sync + Clear */}
          <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
            {pendingCount > 0 && (
              <Button size="sm" radius="md" onClick={syncQueue}
                style={{ background: '#d97706', color: 'white', fontWeight: 700 }}
                leftSection={<Text size="11px" fw={900}>↑</Text>}>
                Sync {pendingCount}
              </Button>
            )}
            <Button leftSection={<IconX size={14} />} onClick={handleNew} radius="md" size="sm" variant="default" style={{ fontWeight: 700 }}>
              Clear
            </Button>
          </Group>
        </Group>
      </Box>

      {/* ══ CARD ROW ════════════════════════════════════════════════════════ */}
      <Box className="ms-card-row" style={{ flexShrink: 0, padding: '8px 20px 0' }}>
        <Group className="ms-card-group" gap={8} align="stretch" wrap="wrap">

          {/* ── CARD 1: Bill Information ── */}
          <Card shadow="xs" radius="md" withBorder style={{ flex: '0 0 200px', borderColor: '#bfdbfe', borderTop: '3px solid #2563eb', padding: '8px 12px' }}>
            <Group gap={5} mb={7}>
              <Box style={{ background: '#dbeafe', borderRadius: 6, padding: '3px 5px' }}><IconReceipt size={13} color="#2563eb" /></Box>
              <Text size="11px" fw={800} c="#1e3a8a" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Bill Info</Text>
            </Group>
            <Box mb={6}>
              <Group justify="space-between" mb={2}>
                <Text size="9px" fw={700} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Bill No</Text>
                <Checkbox
                  label="Milk Bill"
                  size="xs"
                  checked={milkBill}
                  onChange={e => setMilkBill(e.currentTarget.checked)}
                  styles={{ label: { fontSize: 10, fontWeight: 700, color: milkBill ? '#16a34a' : '#94a3b8' } }}
                />
                <Checkbox
                  label="WhatsApp"
                  size="xs"
                  checked={waEnabled}
                  onChange={e => {
                    setWaEnabled(e.currentTarget.checked);
                    if (e.currentTarget.checked) whatsappAPI.connect().catch(() => {});
                    else whatsappAPI.disconnect().then(() => setWaStatus({ connected: false, initializing: false, qr: null })).catch(() => {});
                  }}
                  styles={{ label: { fontSize: 10, fontWeight: 700, color: waEnabled ? '#15803d' : '#94a3b8' } }}
                  icon={() => <IconBrandWhatsapp size={9} />}
                />
              </Group>
              <TextInput value={billNo} onChange={e => setBillNo(e.target.value)} size="xs" radius="sm"
                styles={{ input: { fontWeight: 800, fontSize: 12, border: '1.5px solid #bfdbfe', color: '#2563eb', height: 28 } }} />
            </Box>
            <Box>
              <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Payment</Text>
              <Group gap={5}>
                {[{ val: 'Cash', icon: <IconCash size={11} />, color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
                  { val: 'Bank', icon: <IconCreditCard size={11} />, color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' }].map(({ val, icon, color, bg, border }) => (
                  <Box key={val} onClick={() => setPType(val)} style={{ cursor: 'pointer', flex: 1, background: pType === val ? bg : '#f8fafc', border: `1.5px solid ${pType === val ? border : '#e2e8f0'}`, borderRadius: 6, padding: '4px 6px', textAlign: 'center', transition: 'all 0.1s' }}>
                    <Group gap={3} justify="center">
                      <Box style={{ color: pType === val ? color : '#94a3b8' }}>{icon}</Box>
                      <Text size="11px" fw={700} style={{ color: pType === val ? color : '#94a3b8' }}>{val}</Text>
                    </Group>
                  </Box>
                ))}
              </Group>
            </Box>
          </Card>

          {/* ── CARD 2: Party Info ── */}
          <Card shadow="xs" radius="md" withBorder style={{ flex: '0 0 300px', borderColor: mode === 'CREDIT' ? '#ddd6fe' : '#bbf7d0', borderTop: `3px solid ${modeColor}`, padding: '8px 12px' }}>
            <Group gap={5} mb={7}>
              <Box style={{ background: modeBg, borderRadius: 6, padding: '3px 5px' }}>
                <IconBuilding size={13} color={modeColor} />
              </Box>
              <Text size="11px" fw={800} style={{ color: modeColor, letterSpacing: '0.4px' }} tt="uppercase">
                {mode === 'CREDIT' ? 'Credit Party' : 'Center Info'}
              </Text>
            </Group>

            <Stack gap={6}>
              <Box>
                <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Collection Center</Text>
                <Select data={centers} value={center} onChange={setCenter} placeholder="Select center..." searchable clearable
                  size="xs" radius="sm" styles={{ input: { fontWeight: 600, border: `1.5px solid ${mode === 'CREDIT' ? '#c4b5fd' : '#86efac'}`, height: 28 } }} />
              </Box>
              <Box>
                <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Collection Agent</Text>
                <Select data={agents} value={agent} onChange={setAgent} placeholder="Select agent..." searchable clearable
                  size="xs" radius="sm" styles={{ input: { fontWeight: 600, border: `1.5px solid ${mode === 'CREDIT' ? '#c4b5fd' : '#86efac'}`, height: 28 } }} />
              </Box>
              {mode === 'CREDIT' && (
                <>
                  <Box>
                    <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Creditor</Text>
                    <Select
                      data={customers}
                      value={creditor} onChange={setCreditor}
                      placeholder="Select creditor..." searchable clearable size="xs" radius="sm"
                      styles={{ input: { fontWeight: 600, border: '1.5px solid #c4b5fd', height: 28 } }}
                    />
                  </Box>
                  <Box>
                    <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Opening Credit (&#8377;) — Auto</Text>
                    <NumberInput value={opCr === '' ? '' : parseFloat(opCr)} readOnly
                      min={0} decimalScale={2} placeholder="0.00" size="xs" radius="sm"
                      styles={{ input: { fontWeight: 600, border: '1.5px solid #c4b5fd', height: 28, background: '#f5f3ff', cursor: 'default' } }} />
                  </Box>
                </>
              )}
            </Stack>
          </Card>

          {/* ── CARD 3: Qty & Amount ── */}
          <Card shadow="xs" radius="md" withBorder style={{ flex: 1, borderColor: '#fde68a', borderTop: '3px solid #d97706', padding: '8px 12px' }}>
            <Group gap={5} mb={7} justify="space-between">
              <Group gap={5}>
                <Box style={{ background: '#fef9c3', borderRadius: 6, padding: '3px 5px' }}><IconMilk size={13} color="#d97706" /></Box>
                <Text size="11px" fw={800} c="#78350f" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Qty &amp; Amount</Text>
              </Group>
              <Text size="9px" c="#94a3b8">Tab → Litre → Enter → Save</Text>
            </Group>
            <Group gap={8} mb={8} align="flex-end">
              <Box style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#0369a1" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>Litres</Text>
                <NumberInput ref={litrRef} value={litre === '' ? '' : parseFloat(litre)}
                  onChange={v => setLitre(String(v ?? ''))} onKeyDown={handleRateEnter}
                  min={0} decimalScale={2} placeholder="0.00" hideControls size="xs" radius="sm"
                  styles={{ input: { height: 36, fontSize: 16, fontWeight: 900, background: '#f0f9ff', border: '2px solid #7dd3fc', color: '#0369a1', textAlign: 'center' } }}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#c2410c" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>Rate / L (&#8377;)</Text>
                <NumberInput ref={rateRef} value={rate === '' ? '' : parseFloat(rate)}
                  readOnly onKeyDown={handleRateEnter}
                  min={0} decimalScale={2} placeholder="0.00" hideControls size="xs" radius="sm"
                  styles={{ input: { height: 36, fontSize: 16, fontWeight: 900, background: '#fff7ed', border: '2px solid #fdba74', color: '#c2410c', textAlign: 'center', cursor: 'default' } }}
                />
              </Box>
            </Group>
            <Box style={{ background: 'linear-gradient(135deg,#1e3a5f,#1e40af)', borderRadius: 8, padding: '7px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Text size="9px" c="rgba(255,255,255,0.7)" tt="uppercase" fw={600} style={{ letterSpacing: '0.4px' }}>Amount (Auto)</Text>
                <Text size="22px" fw={900} c="white" style={{ lineHeight: 1.1 }}>&#8377; {amount.toFixed(2)}</Text>
              </Box>
              <Box style={{ textAlign: 'right' }}>
                <Text size="9px" c="rgba(255,255,255,0.6)" tt="uppercase">Litres</Text>
                <Text size="12px" fw={700} c="#7dd3fc">{parseFloat(litre || 0).toFixed(2)} L</Text>
                <Text size="9px" c="rgba(255,255,255,0.6)" tt="uppercase" mt={1}>Rate</Text>
                <Text size="12px" fw={700} c="#fdba74">&#8377; {parseFloat(rate || 0).toFixed(2)}</Text>
              </Box>
            </Box>
          </Card>

        </Group>
      </Box>

      {/* ══ WHATSAPP PANEL ══════════════════════════════════════════════════ */}
      {waEnabled && (
        <Box style={{ margin: '4px 20px 0', borderRadius: 8, border: `1.5px solid ${waStatus.connected ? '#86efac' : '#fde68a'}`, background: waStatus.connected ? 'rgba(240,255,244,0.95)' : 'rgba(255,251,235,0.95)', overflow: 'hidden', flexShrink: 0 }}>
          <Box style={{ background: waStatus.connected ? '#15803d' : '#d97706', padding: '4px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Box style={{ width: 8, height: 8, borderRadius: '50%', background: waStatus.connected ? '#bbf7d0' : '#fef3c7', animation: waStatus.initializing ? 'pulse 1.2s infinite' : 'none' }} />
              <Text size="11px" fw={800} c="white" tt="uppercase" style={{ letterSpacing: '0.5px' }}>WhatsApp</Text>
            </Box>
            <Text size="10px" c="white" style={{ opacity: 0.85 }}>
              {waStatus.connected ? '✅ CONNECTED' : waStatus.initializing ? '⏳ SCANNING QR…' : '🔴 NOT CONNECTED'}
            </Text>
          </Box>
          <Box style={{ padding: '8px 14px', display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* QR / Status */}
            <Box style={{ minWidth: 120 }}>
              {waStatus.connected ? (
                <Text size="11px" fw={700} c="#15803d">Ready to send bills via WhatsApp</Text>
              ) : waStatus.qr ? (
                <Box>
                  <Text size="9px" c="dimmed" mb={4} fw={600}>Scan with WhatsApp</Text>
                  <img src={waStatus.qr} alt="WhatsApp QR" style={{ width: 120, borderRadius: 4, border: '1px solid #d1d5db' }} />
                </Box>
              ) : waStatus.initializing ? (
                <Box style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader size="xs" color="yellow" />
                  <Text size="10px" c="dimmed">Generating QR…</Text>
                </Box>
              ) : (
                <Text size="10px" c="dimmed" fw={600}>Click Connect to start</Text>
              )}
            </Box>
            {/* Send Type */}
            <Box>
              <Text size="9px" fw={700} c="#374151" mb={4} tt="uppercase" style={{ letterSpacing: '0.3px' }}>Send To</Text>
              <Box style={{ display: 'flex', gap: 12 }}>
                {['individual', 'group'].map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, fontWeight: waSendType === t ? 800 : 600, color: waSendType === t ? '#15803d' : '#6b7280' }}>
                    <input type="radio" name="ms_waSendType" value={t} checked={waSendType === t} onChange={() => setWaSendType(t)} style={{ accentColor: '#15803d' }} />
                    {t === 'individual' ? 'Individual' : 'Group'}
                  </label>
                ))}
              </Box>
              {waSendType === 'group' && (
                <input value={waGroupId} onChange={e => setWaGroupId(e.target.value)}
                  placeholder="Group ID (e.g. 120363...)"
                  style={{ marginTop: 5, fontSize: 11, padding: '3px 7px', borderRadius: 4, border: '1px solid #9ca3af', width: 200 }}
                />
              )}
            </Box>
            {/* Connect / Disconnect */}
            <Box style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => whatsappAPI.connect().catch(() => {})} disabled={waStatus.connected || waStatus.initializing}
                style={{ fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 6, cursor: (waStatus.connected || waStatus.initializing) ? 'not-allowed' : 'pointer', background: waStatus.connected ? '#d1fae5' : '#15803d', color: waStatus.connected ? '#065f46' : 'white', border: `1px solid ${waStatus.connected ? '#86efac' : '#166634'}`, opacity: (waStatus.connected || waStatus.initializing) ? 0.6 : 1 }}>
                {waStatus.initializing ? '⏳' : waStatus.connected ? '● Connected' : '▶ Connect'}
              </button>
              <button onClick={() => whatsappAPI.disconnect().then(() => setWaStatus({ connected: false, initializing: false, qr: null })).catch(() => {})} disabled={!waStatus.connected && !waStatus.initializing}
                style={{ fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 6, cursor: (!waStatus.connected && !waStatus.initializing) ? 'not-allowed' : 'pointer', background: (!waStatus.connected && !waStatus.initializing) ? '#fef2f2' : '#dc2626', color: (!waStatus.connected && !waStatus.initializing) ? '#9ca3af' : 'white', border: `1px solid ${(!waStatus.connected && !waStatus.initializing) ? '#fecaca' : '#b91c1c'}`, opacity: (!waStatus.connected && !waStatus.initializing) ? 0.5 : 1 }}>
                ■ Disconnect
              </button>
            </Box>
          </Box>
        </Box>
      )}

      {/* ══ TABLE SECTION ═══════════════════════════════════════════════════ */}
      <Box className="ms-table-section" style={{ flex: 1, overflow: 'hidden', minHeight: 0, padding: '10px 20px 12px', display: 'flex', flexDirection: 'column' }}>

        {/* Table header bar */}
        <Box style={{ background: '#14532d', borderRadius: '10px 10px 0 0', padding: '7px 14px' }}>
          <Group className="ms-table-bar" justify="space-between" align="center" wrap="wrap">
            <Group className="ms-table-bar-left" gap={8} style={{ flexShrink: 0 }}>
              <Text fw={700} size="12px" c="white" style={{ letterSpacing: '0.3px' }}>Sales Register</Text>
              <Badge size="sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#86efac', border: '1px solid rgba(255,255,255,0.2)' }}>
                {loading ? <Loader size={10} color="white" /> : `${filteredEntries.length}${historySearch ? ` / ${entries.length}` : ''} records`}
              </Badge>
              {editingId && <Badge size="sm" color="yellow" variant="filled" radius="sm">EDIT MODE</Badge>}
              {monthMode && <Badge size="sm" color="violet" variant="filled" radius="sm">{MONTHS.find(m => m.value === filterMonth)?.label} {filterYear}</Badge>}

              {/* Month / Year filter */}
              <Group className="ms-month-group" gap={4} wrap="nowrap">
                <Select
                  data={MONTHS} value={filterMonth} onChange={v => v && setFilterMonth(v)}
                  size="xs" radius="md" style={{ width: 108 }}
                  styles={{ input: { fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', height: 26, fontSize: 11 } }}
                />
                <Select
                  data={YEARS} value={filterYear} onChange={v => v && setFilterYear(v)}
                  size="xs" radius="md" style={{ width: 70 }}
                  styles={{ input: { fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', height: 26, fontSize: 11 } }}
                />
                <Button
                  leftSection={<IconFilter size={11} />}
                  onClick={() => loadEntries(filterMonth, filterYear)}
                  size="xs" radius="md"
                  style={{ height: 26, padding: '0 10px', fontSize: 10, fontWeight: 700, background: '#6d28d9', color: 'white', border: '1px solid #a78bfa' }}
                >
                  Go
                </Button>
                {monthMode && (
                  <Button
                    size="xs" radius="md"
                    onClick={() => loadByDate(toDate(date), session)}
                    style={{ height: 26, padding: '0 8px', fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    Today
                  </Button>
                )}
              </Group>
            </Group>

            <Group className="ms-table-bar-right" gap={4} wrap="wrap">
              {showHistory && (
                <TextInput
                  placeholder="Search bill, creditor, center..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.currentTarget.value)}
                  size="xs" radius="sm" style={{ width: 210 }}
                  leftSection={<IconSearch size={12} color="#86efac" />}
                  rightSection={historySearch ? <ActionIcon size={14} variant="subtle" onClick={() => setHistorySearch('')}><IconX size={10} color="white" /></ActionIcon> : null}
                  styles={{ input: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontSize: 11, height: 24 } }}
                  autoFocus
                />
              )}

              {/* Save — emerald green */}
              <Button leftSection={saving ? <Loader size={10} color="white" /> : <IconDeviceFloppy size={12} />}
                onClick={handleSave} disabled={saving} size="compact-xs" radius="sm"
                style={{ background: editingId ? '#b45309' : '#059669', border: '1px solid #34d399', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {editingId ? 'Update' : 'Save'}
              </Button>
              {/* Save & Close — sky blue */}
              <Button leftSection={saving ? <Loader size={10} color="white" /> : <IconDeviceFloppy size={12} />}
                onClick={handleSaveClose} disabled={saving} size="compact-xs" radius="sm"
                style={{ background: '#0284c7', border: '1px solid #38bdf8', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Save &amp; Close
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* New — indigo */}
              <Button leftSection={<IconPlus size={12} />} onClick={handleNew} size="compact-xs" radius="sm"
                style={{ background: '#4f46e5', border: '1px solid #818cf8', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                New
              </Button>
              {/* Edit — amber */}
              <Button leftSection={<IconEdit size={12} />} disabled={!selRow} onClick={handleEdit} size="compact-xs" radius="sm"
                style={{ background: selRow ? '#d97706' : 'rgba(255,255,255,0.07)', border: selRow ? '1px solid #fbbf24' : 'none', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Edit
              </Button>
              {/* Clear / Cancel — slate */}
              <Button leftSection={<IconBan size={12} />} onClick={handleNew} size="compact-xs" radius="sm"
                style={{ background: editingId ? '#b45309' : '#475569', border: '1px solid #94a3b8', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {editingId ? 'Cancel Edit' : 'Clear'}
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* Search — teal */}
              <Button leftSection={<IconHistory size={12} />} onClick={() => { setShowHistory(v => !v); if (showHistory) setHistorySearch(''); }} size="compact-xs" radius="sm"
                style={{ background: showHistory ? '#0f766e' : '#0d9488', border: '1px solid #2dd4bf', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {showHistory ? 'Hide' : 'Search'}
              </Button>
              {/* Refresh — cyan */}
              <Button leftSection={<IconRefresh size={12} />} onClick={loadEntries} size="compact-xs" radius="sm"
                style={{ background: '#0891b2', border: '1px solid #67e8f9', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Refresh
              </Button>
              {/* Import LinZA — green */}
              <Button leftSection={<IconUpload size={12} />} onClick={() => setLinzaImportOpen(true)} size="compact-xs" radius="sm"
                style={{ background: '#15803d', border: '1px solid #4ade80', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Import LinZA
              </Button>
              {/* Import Zibitt Local Sales — violet */}
              <Button leftSection={<IconUpload size={12} />} onClick={() => setImportOpen(true)} size="compact-xs" radius="sm"
                style={{ background: '#7c3aed', border: '1px solid #a78bfa', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Zibbit
              </Button>
              {/* Import OpenLyssa — orange */}
              <Button leftSection={<IconUpload size={12} />} onClick={() => setOlImportOpen(true)} size="compact-xs" radius="sm"
                style={{ background: '#c2410c', border: '1px solid #fb923c', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                OpenLyssa
              </Button>
              {/* Sync to Day Book */}
              <Button leftSection={backfilling ? <Loader size={10} color="white" /> : <IconBook size={12} />}
                onClick={handleBackfillVouchers} disabled={backfilling}
                size="compact-xs" radius="sm"
                style={{ background: '#0f172a', border: '1px solid #475569', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {backfilling ? 'Syncing…' : 'Sync Day Book'}
              </Button>

              {/* WhatsApp Bulk Send */}
              {waEnabled && waStatus.connected && (
                <Button
                  leftSection={waBulkSending ? <Loader size={10} color="white" /> : <IconBrandWhatsapp size={12} />}
                  onClick={handleWaBulkSend}
                  loading={false}
                  disabled={waBulkSending}
                  size="compact-xs" radius="sm"
                  title={`Send WhatsApp to all ${filteredEntries.length} records`}
                  style={{ background: '#15803d', border: '1px solid #4ade80', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}
                >
                  {waBulkSending ? `${waBulkProgress.done}/${waBulkProgress.total}` : `📱 Bulk (${filteredEntries.length})`}
                </Button>
              )}

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* Print — rose */}
              <Button leftSection={<IconPrinter size={12} />} disabled={!selRow}
                onClick={() => selRow && printSlip(selRow)}
                size="compact-xs" radius="sm"
                style={{ background: selRow ? '#e11d48' : 'rgba(255,255,255,0.07)', border: selRow ? '1px solid #fb7185' : 'none', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Print
              </Button>
              {/* Delete — deep red */}
              <Button leftSection={<IconTrash size={12} />} disabled={!selRow}
                onClick={handleDelete}
                size="compact-xs" radius="sm"
                style={{ background: selRow ? '#991b1b' : 'rgba(255,255,255,0.07)', border: selRow ? '1px solid #f87171' : 'none', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Delete
              </Button>
            </Group>
          </Group>
        </Box>

        {/* Table */}
        <Box style={{ flex: 1, overflow: 'hidden', background: 'white', borderRadius: '0 0 10px 10px', border: '1px solid #bbf7d0', borderTop: 'none' }}>
          <ScrollArea h="100%" type="auto">
            <Table striped highlightOnHover stickyHeader withColumnBorders style={{ fontSize: 12 }}>
              <Table.Thead style={{ background: 'linear-gradient(180deg,#dcfce7 0%,#bbf7d0 100%)', position: 'sticky', top: 0, zIndex: 10 }}>
                <Table.Tr>
                  <SortTh label="#"        sk={null} />
                  <SortTh label="Bill No"  sk="billNo" />
                  <SortTh label="Date"     sk="date" />
                  <SortTh label="Sess"     sk="session" />
                  <SortTh label="Mode"     sk="saleMode" />
                  <SortTh label="Party"    sk="creditorName" />
                  <SortTh label="Agent"    sk="agentName" />
                  <SortTh label="Litres"   sk="litre" />
                  <SortTh label="Rate/L"   sk="rate" />
                  <SortTh label="Amount"   sk="amount" />
                  <SortTh label="Type"     sk="paymentType" />
                  <SortTh label=""         sk={null} />
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {loading ? (
                  <Table.Tr><Table.Td colSpan={12}><Center py="xl"><Loader size="sm" color="green" /></Center></Table.Td></Table.Tr>
                ) : filteredEntries.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={12}>
                      <Center py="xl">
                        <Stack align="center" gap={6}>
                          <IconMilk size={48} color="#bbf7d0" />
                          <Text c="dimmed" size="sm" fw={600}>{historySearch ? `No results for "${historySearch}"` : `No sales for ${toDate(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}</Text>
                          <Text c="dimmed" size="xs">Fill in the form above and press Save</Text>
                        </Stack>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : sortedEntries.map((e, idx) => {
                  const isSel = selRow?._id === e._id;
                  const isEdit = editingId === e._id;
                  const rowIsLocal = e.saleMode === 'LOCAL' || e.saleMode === 'SAMPLE';
                  return (
                    <Table.Tr key={e._id} onClick={() => setSelRow(isSel ? null : e)}
                      style={{ cursor: 'pointer', background: isEdit ? '#fffbeb' : isSel ? '#f0fdf4' : undefined, borderLeft: isEdit ? '3px solid #d97706' : isSel ? '3px solid #16a34a' : '3px solid transparent', transition: 'background 0.1s' }}>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 700, color: '#94a3b8', width: 32 }}>{idx + 1}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 700, color: '#166534', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{e.billNo}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      </Table.Td>
                      <Table.Td style={{ padding: '6px 12px' }}>
                        <Badge size="xs" color={e.session === 'AM' ? 'orange' : 'indigo'} variant="light">{e.session || '—'}</Badge>
                      </Table.Td>
                      <Table.Td style={{ padding: '6px 12px' }}>
                        <Badge size="xs" color={e.saleMode === 'LOCAL' ? 'green' : e.saleMode === 'SAMPLE' ? 'blue' : 'violet'} variant="filled" style={{ fontSize: 9 }}>{e.saleMode || '—'}</Badge>
                      </Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 600, color: '#1e293b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rowIsLocal ? (e.centerName || '—') : (e.creditorName || '—')}
                      </Table.Td>
                      {isLocal ? (
                        <Table.Td style={{ padding: '6px 12px', color: '#0369a1', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.agentName || '—'}
                        </Table.Td>
                      ) : (
                        <>
                          <Table.Td style={{ padding: '6px 12px', color: '#6d28d9', textAlign: 'right' }}>
                            {e.openingCredit != null ? `\u20B9${parseFloat(e.openingCredit).toFixed(2)}` : '—'}
                          </Table.Td>
                          <Table.Td style={{ padding: '6px 12px', color: '#16a34a', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.centerName || '—'}
                          </Table.Td>
                          <Table.Td style={{ padding: '6px 12px', color: '#0369a1', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.agentName || '—'}
                          </Table.Td>
                        </>
                      )}
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 800, color: '#0369a1', textAlign: 'right' }}>{parseFloat(e.litre || 0).toFixed(2)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 600, color: '#c2410c', textAlign: 'right' }}>&#8377;{parseFloat(e.rate || 0).toFixed(2)}</Table.Td>
                      <Table.Td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <Text size="13px" fw={800} c="green.7">&#8377;{parseFloat(e.amount || 0).toFixed(2)}</Text>
                      </Table.Td>
                      {isLocal && (
                        <Table.Td style={{ padding: '6px 12px' }}>
                          <Badge size="xs" color={e.paymentType === 'Cash' ? 'teal' : 'blue'} variant="dot">{e.paymentType || '—'}</Badge>
                        </Table.Td>
                      )}
                      <Table.Td style={{ padding: '6px 8px', width: 30 }}>
                        <ActionIcon size="xs" color="red" variant="subtle" radius="sm" onClick={ev => { ev.stopPropagation(); setSelRow(e); handleDelete(); }}>
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>

              {filteredEntries.length > 0 && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#14532d' }}>
                    <Table.Td colSpan={isLocal ? 7 : 9} style={{ padding: '8px 12px', fontWeight: 700, color: '#86efac', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Totals &amp; Averages</Table.Td>
                    <Table.Td style={{ padding: '8px 12px', fontWeight: 900, color: '#7dd3fc', textAlign: 'right', fontSize: 13 }}>{totL.toFixed(2)}</Table.Td>
                    <Table.Td style={{ padding: '8px 12px', fontWeight: 700, color: '#fdba74', textAlign: 'right' }}>&#8377;{avgR.toFixed(2)}</Table.Td>
                    <Table.Td style={{ padding: '8px 12px', textAlign: 'right' }}><Text size="14px" fw={900} c="white">&#8377;{totA.toFixed(2)}</Text></Table.Td>
                    {isLocal && <Table.Td />}
                    <Table.Td />
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </ScrollArea>
        </Box>

        {/* Footer Summary Strip */}
        <Box className="ms-footer-box" style={{ background: 'white', border: '1px solid #bbf7d0', borderTop: '2px solid #dcfce7', borderRadius: '0 0 10px 10px', padding: '8px 16px' }}>
          <Group className="ms-footer-strip" gap={10} wrap="wrap" align="center">
            <Box className="ms-summary-label" style={{ flexShrink: 0 }}>
              <Text size="10px" fw={800} c="#14532d" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Summary</Text>
              <Text size="9px" c="#94a3b8">{entries.length} records · {monthMode ? `${MONTHS.find(m => m.value === filterMonth)?.label} ${filterYear}` : toDate(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            </Box>
            <Divider className="ms-footer-divider" orientation="vertical" style={{ height: 36 }} />
            {[
              { label: 'Mode',      val: mode,                           c: modeColor, bg: modeBg, border: `${modeColor}44` },
              { label: 'Session',   val: session,                        c: session === 'AM' ? '#c2410c' : '#4338ca', bg: session === 'AM' ? '#fff7ed' : '#eef2ff', border: session === 'AM' ? '#fdba74' : '#a5b4fc' },
              { label: 'Rate Avg',  val: `\u20B9${avgR.toFixed(2)}`,    c: '#c2410c', bg: '#fff7ed', border: '#fdba74' },
              { label: 'Total Ltr', val: `${totL.toFixed(2)} L`,        c: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
              { label: 'Total Amt', val: `\u20B9${totA.toFixed(2)}`,    c: 'white',   bg: '#14532d', border: '#14532d', bold: true },
            ].map(({ label, val, c, bg, border, bold }) => (
              <Box key={label} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 8, padding: '5px 18px', textAlign: 'center', flexShrink: 0 }}>
                <Text size="10px" fw={600} c={bold ? 'rgba(255,255,255,0.75)' : '#64748b'} tt="uppercase" style={{ letterSpacing: '0.4px' }}>{label}</Text>
                <Text size={bold ? '18px' : '16px'} fw={900} style={{ color: c, lineHeight: 1.2 }}>{val}</Text>
              </Box>
            ))}
          </Group>
        </Box>
      </Box>

      <ImportModal
        isOpen={linzaImportOpen}
        onClose={() => setLinzaImportOpen(false)}
        onImport={handleLinZAImport}
        entityType="Milk Sales (LinZA — BillNo, SalesDate, SalesShift, Sales_Qty, RatePerLtr, TotalAmt)"
        requiredFields={['BillNo', 'Sales_Qty', 'RatePerLtr', 'TotalAmt']}
        maxFileSizeMB={50}
      />

      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleZibittImport}
        entityType="Milk Sales (Zibitt Local Sales)"
        requiredFields={['BillNo', 'SalesDate', 'Sales_Qty', 'RatePerLtr', 'TotalAmt']}
        maxFileSizeMB={50}
      />

      <ImportModal
        isOpen={rawImportOpen}
        onClose={() => setRawImportOpen(false)}
        onImport={handleZibittRawImport}
        entityType="Milk Sales (Zibitt DB — dcs_id/mc_id/cust_id/qty/source_id)"
        requiredFields={[]}
        maxFileSizeMB={50}
      />

      <ImportModal
        isOpen={olImportOpen}
        onClose={() => setOlImportOpen(false)}
        onImport={handleOpenLyssaExcelImport}
        entityType="Milk Sales (OpenLyssa — Date/Shift/Cust_ID/Customer/Sale_Type/Qty/Rate/Amount)"
        requiredFields={['Date', 'Qty', 'Amount']}
        maxFileSizeMB={50}
      />
    </Box>
  );
}
