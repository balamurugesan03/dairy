/**
 * MilkPurchase — Modern Card-Based Professional Layout
 * Header | [Bill Info] [10-Day Avg] [Current Entry] | Table
 * Keyboard: Member No Enter→lookup, Tab→LTR→FAT→CLR→SNF, Enter=Save, Enter again=Print
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@tabler/icons-react';
import {
  agentAPI, collectionCenterAPI, farmerAPI,
  milkCollectionAPI, milkPurchaseSettingsAPI, rateChartAPI, milkSalesAPI,
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

const calcValues = (qty, fat, clr, snf, chartType, chartRows) => {
  if (!qty || !fat) return { snf: snf || 0, incentive: 0, rate: 0, amount: 0 };
  const chartRate = calcRateFromChart(fat, clr || 0, snf || 0, chartType, chartRows);
  const rate = chartRate !== null ? chartRate : fallbackRate(fat, clr || 0);
  const incentive = qty >= 10 ? 3.0 : qty >= 5 ? 2.0 : 1.0;
  const amount = parseFloat((qty * rate + incentive).toFixed(2));
  const autoSnf = snf || parseFloat(((fat / 0.21) * 0.125 + 0.082 * (clr || 26)).toFixed(2));
  return { snf: autoSnf, incentive, rate: parseFloat(rate.toFixed(2)), amount };
};

// ── Print Slip ───────────────────────────────────────────────────────────────
const printBill = (entry, dateStr, shift, centerName) => {
  const html = `<html><head><title>Milk Receipt</title>
  <style>
    body{font-family:monospace;font-size:13px;padding:14px;width:300px;margin:0}
    h3{text-align:center;margin:0 0 2px;font-size:15px;letter-spacing:1px}
    .sub{text-align:center;font-size:11px;color:#555;margin-bottom:8px}
    .line{border-top:1px dashed #000;margin:7px 0}
    .row{display:flex;justify-content:space-between;margin:3px 0}
    .bold{font-weight:bold}
    .total{font-size:18px;font-weight:900}
    .foot{text-align:center;font-size:10px;color:#777;margin-top:6px}
    @media print{body{margin:0}}
  </style></head><body>
  <h3>MILK PURCHASE RECEIPT</h3>
  <div class="sub">${dateStr} | ${shift} Shift${centerName ? `<br>${centerName}` : ''}</div>
  <div class="line"></div>
  <div class="row"><span>Bill No</span><span class="bold">${entry.billNo}</span></div>
  <div class="row"><span>Member No</span><span class="bold">${entry.producerNo}</span></div>
  <div class="row"><span>Name</span><span>${entry.producerName}</span></div>
  <div class="line"></div>
  <div class="row"><span>Litres</span><span class="bold">${entry.qty.toFixed(2)} L</span></div>
  <div class="row"><span>FAT %</span><span>${entry.fat.toFixed(2)}</span></div>
  <div class="row"><span>CLR</span><span>${entry.clr.toFixed(1)}</span></div>
  <div class="row"><span>SNF %</span><span>${entry.snf.toFixed(2)}</span></div>
  <div class="row"><span>Rate / Ltr</span><span>&#8377; ${entry.rate.toFixed(2)}</span></div>
  <div class="row"><span>Incentive</span><span>&#8377; ${entry.incentive.toFixed(2)}</span></div>
  <div class="line"></div>
  <div class="row total"><span>AMOUNT</span><span>&#8377; ${entry.amount.toFixed(2)}</span></div>
  <div class="line"></div>
  <div class="foot">Thank You</div>
  </body></html>`;
  const win = window.open('', '_blank', 'width=340,height=520');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
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

  const clrAutoSetRef  = useRef(false);   // prevents SNF recompute when CLR is auto-filled from SNF
  const autoSaveRef    = useRef(false);   // triggers auto-save after SNF/CLR is computed
  const tableScrollRef = useRef(null);
  const justSavedRef  = useRef(false);
  const lastEntryRef  = useRef(null);
  const centerNameRef = useRef('');
  const formRef       = useRef({});
  formRef.current = { producer, ltr, water, fat, clr, snf, date, shift, center, agent, calcResult, editingId, speakEnabled, entries, dupBlocked };

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadTodayEntries = async (d, sh, ct) => {
    setLoadingEntries(true);
    try {
      const res = await milkCollectionAPI.getAll({ date: d.toISOString().slice(0, 10), shift: sh, collectionCenter: ct || undefined, limit: 500 });
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

  const filteredAgents = useCallback(() => {
    if (!center) return agentsData;
    const f = agentsData.filter(a => !a.centerId || a.centerId === center);
    return f.length ? f : agentsData;
  }, [center, agentsData]);

  // SNF = (CLR/4) + (0.20 × FAT) + 0.50
  // Debounced 600ms — waits until user stops typing CLR before computing SNF + auto-save
  useEffect(() => {
    if (clrAutoSetRef.current) { clrAutoSetRef.current = false; return; }
    const fatVal = parseFloat(fat);
    const clrVal = parseFloat(clr);
    if (!clrVal) { setSnf(''); return; }
    if (!fatVal) return;
    const timer = setTimeout(() => {
      setSnf(((clrVal / 4) + (0.20 * fatVal) + 0.50).toFixed(2));
      autoSaveRef.current = true;
    }, 600);
    return () => clearTimeout(timer);
  }, [clr, fat]); // eslint-disable-line

  // CLR = (4 × SNF) − (0.8 × FAT) − 2
  // Debounced 600ms — waits until user stops typing SNF before computing CLR + auto-save
  useEffect(() => {
    const fatVal = parseFloat(fat);
    const snfVal = parseFloat(snf);
    if (!snfVal || !fatVal || clr) return;
    const timer = setTimeout(() => {
      clrAutoSetRef.current = true;
      autoSaveRef.current = true;
      setClr(((4 * snfVal) - (0.8 * fatVal) - 2).toFixed(1));
    }, 600);
    return () => clearTimeout(timer);
  }, [snf, fat]); // eslint-disable-line

  // Auto-save after SNF or CLR is computed
  useEffect(() => {
    if (!autoSaveRef.current) return;
    autoSaveRef.current = false;
    const timer = setTimeout(() => {
      const f = formRef.current;
      if (f.producer && f.ltr && f.fat && !f.dupBlocked && !f.editingId) {
        handleSave();
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [snf, clr]); // eslint-disable-line

  // Auto-calc — Net LTR → KG (× 1.03), then calc rate/amount
  useEffect(() => {
    const grossLtr = parseFloat(ltr) || 0;
    const waterLtr = parseFloat(water) || 0;
    const netLtr   = Math.max(0, grossLtr - waterLtr);
    const netKg    = parseFloat((netLtr * 1.03).toFixed(3));
    setCalcResult(calcValues(netKg, parseFloat(fat) || 0, parseFloat(clr) || 0, parseFloat(snf) || 0, activeChart, chartRows));
  }, [ltr, water, fat, clr, snf, activeChart, chartRows]);

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
    setMemberInput(farmer.farmerNumber);
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
      const exact = farmers.find(f => f.farmerNumber?.toLowerCase() === query.trim().toLowerCase());
      if (exact) { selectProducer(exact); }
      else if (farmers.length === 1) { selectProducer(farmers[0]); }
      else { setSearchResults(farmers); setShowDropdown(farmers.length > 0); }
    } catch { /* silent */ }
    finally { setSearchLoading(false); }
  };

  // ── Save / Update ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    const { producer: p, ltr: q, water: w, fat: f, clr: c, snf: s, date: d, shift: sh, center: ct, agent: ag, calcResult: cr, editingId: eid } = formRef.current;
    if (formRef.current.dupBlocked) return;
    if (!p || !q || !f) { notifications.show({ message: 'Member, Litres and FAT are required', color: 'red', autoClose: 2500 }); return; }
    setSaving(true);
    const grossLtr = parseFloat(q) || 0;
    const waterLtr = parseFloat(w) || 0;
    const netLtr   = Math.max(0, grossLtr - waterLtr);
    const netKg    = parseFloat((netLtr * 1.03).toFixed(3));
    try {
      const payload = { date: d.toISOString(), shift: sh, collectionCenter: ct || undefined, agent: ag || undefined, farmer: p._id, farmerNumber: p.no, farmerName: p.name, qty: netKg, ltr: netLtr, clr: parseFloat(c) || 0, fat: parseFloat(f), snf: parseFloat(s) || cr.snf || 0, addedWater: waterLtr, rate: cr.rate, incentive: cr.incentive, amount: cr.amount };

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
        justSavedRef.current = true;
        setTimeout(() => { justSavedRef.current = false; }, 2000);
        notifications.show({ message: `Saved: ${saved.billNo} \u2014 \u20B9${saved.amount.toFixed(2)}  |  Press Enter to print`, color: 'teal', autoClose: 2000 });
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
    } catch (err) {
      notifications.show({ message: err?.message || 'Save failed', color: 'red', icon: <IconAlertCircle size={14} /> });
    } finally { setSaving(false); }
  };

  const handleClear = () => {
    setMemberInput(''); setProducer(null); setSearchResults([]); setShowDropdown(false);
    setLtr(''); setWater(''); setFat(''); setClr(''); setSnf('');
    setSelectedRow(null); setEditingId(null);
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
      if (match) setProducer(prev => ({ ...prev, _id: match._id, memberId: match.memberId || '', phone: match.personalDetails?.phone || '' }));
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
      if (!memberInput.trim() && justSavedRef.current && lastEntryRef.current) {
        printBill(lastEntryRef.current, formRef.current.date.toLocaleDateString('en-IN'), formRef.current.shift, centerNameRef.current);
        justSavedRef.current = false;
      } else { lookupMember(memberInput); }
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
            value={date} onChange={v => v && setDate(v)} valueFormat="DD MMM YYYY"
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
                            <Badge size="xs" color="blue" radius="sm">{f.farmerNumber}</Badge>
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
          <Card shadow="xs" radius="lg" withBorder style={{ flex: 1, borderColor: '#fde68a', borderTop: '3px solid #d97706', padding: '8px 12px' }}>
            <Group gap={6} mb={6} justify="space-between">
              <Group gap={6}>
                <Box style={{ background: '#fef9c3', borderRadius: 7, padding: '4px 6px' }}><IconMilk size={15} color="#d97706" /></Box>
                <Text size="12px" fw={800} c="#78350f" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Current Entry</Text>
              </Group>
              <Text size="9px" c="#94a3b8">Tab to move · Enter to save</Text>
            </Group>

            {/* Input row */}
            <Group gap={8} mb={6} wrap="nowrap" align="flex-end">
              {[
                { label: 'LTR',   ref: ltrRef,   value: ltr,   setter: setLtr,   next: fatRef,   color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', step: 0.1,  dec: 2 },
                { label: 'FAT %', ref: fatRef,   value: fat,   setter: setFat,   next: clrRef,   color: '#c2410c', bg: '#fff7ed', border: '#fdba74', step: 0.01, dec: 2 },
                { label: 'CLR',   ref: clrRef,   value: clr,   setter: setClr,   next: snfRef,   color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', step: 0.1,  dec: 1 },
                { label: 'SNF %', ref: snfRef,   value: snf,   setter: setSnf,   next: waterRef, color: '#166534', bg: '#f0fdf4', border: '#86efac', step: 0.01, dec: 2 },
                { label: 'Water', ref: waterRef, value: water, setter: setWater, next: null,     color: '#be123c', bg: '#fff1f2', border: '#fda4af', step: 0.1,  dec: 2 },
              ].map(({ label, ref: iRef, value, setter, next, color, bg, border, step, dec }) => (
                <Box key={label} style={{ flex: 1 }}>
                  <Text size="10px" fw={700} mb={4} tt="uppercase" style={{ color, letterSpacing: '0.4px' }}>{label}</Text>
                  <NumberInput
                    ref={iRef} value={value}
                    onChange={v => setter(String(v ?? ''))}
                    onKeyDown={next ? focusNext(next) : onLastEnter}
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
                  {[
                    { label: 'SNF (Auto)',  val: calcResult.snf ? calcResult.snf.toFixed(2) : snf || '—', c: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
                    { label: 'Rate / KG',  val: `\u20B9 ${calcResult.rate.toFixed(2)}`,                   c: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
                    { label: 'Incentive',  val: `\u20B9 ${calcResult.incentive.toFixed(2)}`,              c: '#92400e', bg: '#fffbeb', border: '#fde68a' },
                    { label: 'Amount',     val: `\u20B9 ${calcResult.amount.toFixed(2)}`,                 c: 'white',   bg: '#1e40af', border: '#1e40af', bold: true, large: true },
                  ].map(({ label, val, c, bg, border, bold, large }) => (
                    <Box key={label} style={{ flex: large ? 1.3 : 1, background: bg, border: `1.5px solid ${border}`, borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
                      <Text size="9px" fw={600} style={{ color: large ? 'rgba(255,255,255,0.75)' : '#64748b' }} tt="uppercase">{label}</Text>
                      <Text size={large ? '18px' : '14px'} fw={large ? 900 : 700} style={{ color: c, lineHeight: 1.2 }}>{val}</Text>
                    </Box>
                  ))}
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
                      <Table.Td style={{ padding: '6px 12px', fontWeight: 700, color: '#c2410c', textAlign: 'right' }}>{entry.fat.toFixed(2)}</Table.Td>
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
                    <Table.Td style={{ padding: '8px 12px', fontWeight: 700, color: '#fdba74', textAlign: 'right' }}>{avgFat.toFixed(2)}</Table.Td>
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
              { label: 'FAT Avg',   val: avgFat.toFixed(2),              c: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
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
                  onChange={e => setCpMode(prev => e.target.checked ? [...prev, opt] : prev.filter(x => x !== opt))}
                  style={{ accentColor: '#006064', width: 12, height: 12 }}
                />
                <span style={{ color: '#004d40', fontWeight: 600 }}>{opt}</span>
              </label>
            ))}
          </Box>
        </Box>

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
