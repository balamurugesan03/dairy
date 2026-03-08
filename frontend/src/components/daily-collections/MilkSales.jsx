/**
 * MilkSales — Modern Card-Based Layout (matches MilkPurchase style)
 * Header | [Bill Info] [Party Info] [Qty & Amount] | Table
 * Keyboard: Tab→Litre→Rate, Enter=Save, Enter again=Print
 */

import { useState, useEffect, useRef } from 'react';
import {
  Box, Group, Text, TextInput, NumberInput, Select, Button,
  Table, ScrollArea, ActionIcon, Badge, Divider, Center,
  Loader, Card, Stack, SegmentedControl,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconMilk, IconReceipt, IconUser, IconBuilding,
  IconDeviceFloppy, IconX, IconPlus, IconEdit, IconBan,
  IconTrash, IconPrinter, IconRefresh, IconSearch, IconHistory,
  IconAlertCircle, IconCash, IconCreditCard,
} from '@tabler/icons-react';
import { customerAPI, collectionCenterAPI, milkSalesAPI, agentAPI } from '../../services/api';

// ── Bill No generator ─────────────────────────────────────────────────────────
const genBillNo = () => {
  const n = new Date();
  const yymm = `${String(n.getFullYear()).slice(-2)}${String(n.getMonth() + 1).padStart(2, '0')}`;
  return `MS-${yymm}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
};

// ── Print Slip ────────────────────────────────────────────────────────────────
const printSlip = (entry) => {
  const isLocal = entry.saleMode === 'LOCAL' || entry.saleMode === 'SAMPLE';
  const html = `<html><head><title>Milk Sales Receipt</title>
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
  <h3>MILK SALES RECEIPT</h3>
  <div class="sub">${entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : ''} | ${entry.session || ''} Shift | ${entry.saleMode || ''}</div>
  <div class="line"></div>
  <div class="row"><span>Bill No</span><span class="bold">${entry.billNo || ''}</span></div>
  <div class="row"><span>${isLocal ? 'Center' : 'Creditor'}</span><span>${isLocal ? (entry.centerName || '—') : (entry.creditorName || '—')}</span></div>
  ${!isLocal ? `<div class="row"><span>Opening Credit</span><span>&#8377; ${parseFloat(entry.openingCredit || 0).toFixed(2)}</span></div>` : ''}
  ${!isLocal && entry.centerName ? `<div class="row"><span>Center</span><span>${entry.centerName}</span></div>` : ''}
  ${!isLocal && entry.agentName ? `<div class="row"><span>Agent</span><span>${entry.agentName}</span></div>` : ''}
  <div class="line"></div>
  <div class="row"><span>Litres</span><span class="bold">${parseFloat(entry.litre || 0).toFixed(2)} L</span></div>
  <div class="row"><span>Rate / L</span><span>&#8377; ${parseFloat(entry.rate || 0).toFixed(2)}</span></div>
  ${isLocal ? `<div class="row"><span>Payment</span><span>${entry.paymentType || 'Cash'}</span></div>` : ''}
  <div class="line"></div>
  <div class="row total"><span>AMOUNT</span><span>&#8377; ${parseFloat(entry.amount || 0).toFixed(2)}</span></div>
  <div class="line"></div>
  <div class="foot">Thank You</div>
  </body></html>`;
  const win = window.open('', '_blank', 'width=340,height=480');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function MilkSales() {
  const [mode,    setMode]    = useState('LOCAL');
  const [session, setSession] = useState('AM');
  const [date,    setDate]    = useState(new Date());
  const [billNo,  setBillNo]  = useState(genBillNo);

  const [center,   setCenter]   = useState(null);
  const [agent,    setAgent]    = useState(null);
  const [category, setCategory] = useState(null);
  const [creditor, setCreditor] = useState(null);
  const [opCr,     setOpCr]     = useState('');
  const [litre,    setLitre]    = useState('');
  const [rate,     setRate]     = useState('');
  const [amount,   setAmount]   = useState(0);
  const [pType,    setPType]    = useState('Cash');

  const [customersRaw, setCustomersRaw] = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [centers,      setCenters]      = useState([]);
  const [agents,       setAgents]       = useState([]);
  const [entries,      setEntries]      = useState([]);
  const [selRow,       setSelRow]       = useState(null);
  const [editingId,    setEditingId]    = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [showHistory,   setShowHistory]   = useState(false);

  const isLocal = mode === 'LOCAL' || mode === 'SAMPLE';

  const litrRef   = useRef(null);
  const rateRef   = useRef(null);
  const justSavedRef = useRef(false);
  const lastEntryRef = useRef(null);
  const formRef      = useRef({});
  formRef.current = { mode, session, date, billNo, center, agent, category, creditor, opCr, litre, rate, amount, pType, editingId };

  // ── Auto-calc amount ──────────────────────────────────────────────────────
  useEffect(() => {
    setAmount(parseFloat(((parseFloat(litre) || 0) * (parseFloat(rate) || 0)).toFixed(2)));
  }, [litre, rate]);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadDropdowns();
    loadEntries();
  }, []);

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
      setCenters((cc?.data || []).map(x => ({ value: x._id, label: x.centerName || x.name || '—' })));
      setAgents((ag?.data || []).map(x => ({ value: x._id, label: x.agentName || '—' })));
    } catch { /* silent */ }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await milkSalesAPI.getAll({ date: new Date().toISOString().slice(0, 10), limit: 500 });
      setEntries(res?.data || []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleNew = () => {
    setEditingId(null); setSelRow(null);
    setBillNo(genBillNo());
    setCenter(null); setAgent(null); setCategory(null); setCreditor(null);
    setOpCr(''); setLitre(''); setRate(''); setAmount(0); setPType('Cash');
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
      date: d.toISOString().slice(0, 10),
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
        justSavedRef.current = true;
        setTimeout(() => { justSavedRef.current = false; }, 2000);
        notifications.show({ color: 'teal', message: `Saved: ${saved.billNo} — \u20B9${am.toFixed(2)}  |  Press Enter to print`, autoClose: 2000 });
        handleNew();
      }
    } catch {
      const local = { ...payload, _id: `local-${Date.now()}` };
      setEntries(p => [local, ...p]);
      notifications.show({ color: 'green', message: 'Saved (offline)', autoClose: 2000 });
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

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  const focusNext = (ref) => (e) => { if (e.key === 'Enter') { e.preventDefault(); ref.current?.focus(); } };

  const handleRateEnter = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
  };

  // Filtered entries
  const filteredEntries = historySearch.trim()
    ? entries.filter(e => [e.billNo, e.creditorName, e.centerName].some(v => (v || '').toLowerCase().includes(historySearch.toLowerCase())))
    : entries;

  // Aggregates
  const totL = filteredEntries.reduce((s, e) => s + (parseFloat(e.litre) || 0), 0);
  const totA = filteredEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const avgR = filteredEntries.length ? filteredEntries.reduce((s, e) => s + (parseFloat(e.rate) || 0), 0) / filteredEntries.length : 0;

  const modeColor = mode === 'LOCAL' ? '#16a34a' : mode === 'SAMPLE' ? '#0369a1' : '#7c3aed';
  const modeBg    = mode === 'LOCAL' ? '#f0fdf4' : mode === 'SAMPLE' ? '#f0f9ff' : '#f5f3ff';

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Box style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <Box style={{ background: 'white', borderBottom: '1px solid #dbeafe', padding: '8px 20px', flexShrink: 0, boxShadow: '0 1px 6px rgba(37,99,235,0.08)' }}>
        <Group justify="space-between" align="center" wrap="nowrap">

          {/* LEFT: icon + title + controls */}
          <Group gap={12} align="center" wrap="nowrap" style={{ flex: 1 }}>
            <Box style={{ background: '#dcfce7', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <IconMilk size={22} color="#16a34a" />
            </Box>
            <Box style={{ flexShrink: 0 }}>
              <Group gap={8} align="center">
                <Text size="16px" fw={800} c="#14532d" style={{ lineHeight: 1.1, letterSpacing: '-0.3px' }}>Milk Sales</Text>
                <Badge color={mode === 'LOCAL' ? 'green' : mode === 'SAMPLE' ? 'blue' : 'violet'} size="sm" variant="filled">{mode}</Badge>
                {editingId && <Badge color="orange" size="sm" variant="filled">EDIT MODE</Badge>}
              </Group>
              <Text size="10px" c="#64748b">Daily Sales Entry</Text>
            </Box>

            <Box style={{ width: 1, height: 36, background: '#dbeafe', flexShrink: 0 }} />

            {/* Date */}
            <Box style={{ flexShrink: 0 }}>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3} style={{ letterSpacing: '0.4px' }}>Date</Text>
              <DatePickerInput
                value={date} onChange={v => v && setDate(v)} valueFormat="DD MMM YYYY"
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
                value={mode} onChange={setMode}
                data={[{ value: 'LOCAL', label: 'Local' }, { value: 'CREDIT', label: 'Credit' }, { value: 'SAMPLE', label: 'Sample' }]}
                size="xs" radius="md"
                styles={{ root: { background: '#f1f5f9', border: '1.5px solid #bfdbfe' } }}
              />
            </Box>
          </Group>

          {/* RIGHT: Clear */}
          <Button leftSection={<IconX size={14} />} onClick={handleNew} radius="md" size="sm" variant="default" style={{ fontWeight: 700, flexShrink: 0 }}>
            Clear
          </Button>
        </Group>
      </Box>

      {/* ══ CARD ROW ════════════════════════════════════════════════════════ */}
      <Box style={{ flexShrink: 0, padding: '8px 20px 0' }}>
        <Group gap={8} align="stretch" wrap="nowrap">

          {/* ── CARD 1: Bill Information ── */}
          <Card shadow="xs" radius="md" withBorder style={{ flex: '0 0 200px', borderColor: '#bfdbfe', borderTop: '3px solid #2563eb', padding: '8px 12px' }}>
            <Group gap={5} mb={7}>
              <Box style={{ background: '#dbeafe', borderRadius: 6, padding: '3px 5px' }}><IconReceipt size={13} color="#2563eb" /></Box>
              <Text size="11px" fw={800} c="#1e3a8a" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Bill Info</Text>
            </Group>
            <Box mb={6}>
              <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Bill No</Text>
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
          <Card shadow="xs" radius="md" withBorder style={{ flex: '0 0 300px', borderColor: isLocal ? '#bbf7d0' : '#ddd6fe', borderTop: `3px solid ${modeColor}`, padding: '8px 12px' }}>
            <Group gap={5} mb={7}>
              <Box style={{ background: modeBg, borderRadius: 6, padding: '3px 5px' }}>
                {isLocal ? <IconBuilding size={13} color={modeColor} /> : <IconUser size={13} color={modeColor} />}
              </Box>
              <Text size="11px" fw={800} style={{ color: modeColor }} tt="uppercase" style={{ letterSpacing: '0.4px' }}>
                {isLocal ? 'Center Info' : 'Credit Party'}
              </Text>
            </Group>

            {isLocal ? (
              <Stack gap={6}>
                <Box>
                  <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Collection Center</Text>
                  <Select data={centers} value={center} onChange={setCenter} placeholder="Select center..." searchable clearable
                    size="xs" radius="sm" styles={{ input: { fontWeight: 600, border: '1.5px solid #86efac', height: 28 } }} />
                </Box>
                <Box>
                  <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Agent</Text>
                  <Select data={agents} value={agent} onChange={setAgent} placeholder="Select agent..." searchable clearable
                    size="xs" radius="sm" styles={{ input: { fontWeight: 600, border: '1.5px solid #86efac', height: 28 } }} />
                </Box>
              </Stack>
            ) : (
              <Stack gap={6}>
                <Box>
                  <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Category</Text>
                  <Select
                    data={[{ value: 'School', label: 'School' }, { value: 'Anganwadi', label: 'Anganwadi' }, { value: 'Hospital', label: 'Hospital' }, { value: 'Booth', label: 'Booth' }, { value: 'Hotel', label: 'Hotel' }, { value: 'Vendor Sales', label: 'Vendor Sales' }, { value: 'Others', label: 'Others' }]}
                    value={category} onChange={v => { setCategory(v); setCreditor(null); }}
                    placeholder="All categories" clearable size="xs" radius="sm"
                    styles={{ input: { fontWeight: 600, border: '1.5px solid #c4b5fd', height: 28 } }}
                  />
                </Box>
                <Box>
                  <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Creditor</Text>
                  <Select
                    data={category ? customers.filter(c => c.category === category) : customers}
                    value={creditor} onChange={setCreditor}
                    placeholder="Select creditor..." searchable clearable size="xs" radius="sm"
                    styles={{ input: { fontWeight: 600, border: '1.5px solid #c4b5fd', height: 28 } }}
                  />
                </Box>
                <Box>
                  <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Opening Credit (&#8377;)</Text>
                  <NumberInput value={opCr === '' ? '' : parseFloat(opCr)} onChange={v => setOpCr(String(v ?? ''))}
                    min={0} decimalScale={2} placeholder="0.00" size="xs" radius="sm"
                    styles={{ input: { fontWeight: 600, border: '1.5px solid #c4b5fd', height: 28 } }} />
                </Box>
                <Box>
                  <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Collection Center</Text>
                  <Select data={centers} value={center} onChange={setCenter} placeholder="Select center..." searchable clearable
                    size="xs" radius="sm" styles={{ input: { fontWeight: 600, border: '1.5px solid #c4b5fd', height: 28 } }} />
                </Box>
                <Box>
                  <Text size="9px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Agent</Text>
                  <Select data={agents} value={agent} onChange={setAgent} placeholder="Select agent..." searchable clearable
                    size="xs" radius="sm" styles={{ input: { fontWeight: 600, border: '1.5px solid #c4b5fd', height: 28 } }} />
                </Box>
              </Stack>
            )}
          </Card>

          {/* ── CARD 3: Qty & Amount ── */}
          <Card shadow="xs" radius="md" withBorder style={{ flex: 1, borderColor: '#fde68a', borderTop: '3px solid #d97706', padding: '8px 12px' }}>
            <Group gap={5} mb={7} justify="space-between">
              <Group gap={5}>
                <Box style={{ background: '#fef9c3', borderRadius: 6, padding: '3px 5px' }}><IconMilk size={13} color="#d97706" /></Box>
                <Text size="11px" fw={800} c="#78350f" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Qty &amp; Amount</Text>
              </Group>
              <Text size="9px" c="#94a3b8">Tab → Litre → Rate → Enter</Text>
            </Group>
            <Group gap={8} mb={8} align="flex-end">
              <Box style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#0369a1" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>Litres</Text>
                <NumberInput ref={litrRef} value={litre === '' ? '' : parseFloat(litre)}
                  onChange={v => setLitre(String(v ?? ''))} onKeyDown={focusNext(rateRef)}
                  min={0} decimalScale={2} placeholder="0.00" hideControls size="xs" radius="sm"
                  styles={{ input: { height: 36, fontSize: 16, fontWeight: 900, background: '#f0f9ff', border: '2px solid #7dd3fc', color: '#0369a1', textAlign: 'center' } }}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#c2410c" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>Rate / L (&#8377;)</Text>
                <NumberInput ref={rateRef} value={rate === '' ? '' : parseFloat(rate)}
                  onChange={v => setRate(String(v ?? ''))} onKeyDown={handleRateEnter}
                  min={0} decimalScale={2} placeholder="0.00" hideControls size="xs" radius="sm"
                  styles={{ input: { height: 36, fontSize: 16, fontWeight: 900, background: '#fff7ed', border: '2px solid #fdba74', color: '#c2410c', textAlign: 'center' } }}
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

      {/* ══ TABLE SECTION ═══════════════════════════════════════════════════ */}
      <Box style={{ flex: 1, overflow: 'hidden', minHeight: 0, padding: '10px 20px 12px', display: 'flex', flexDirection: 'column' }}>

        {/* Table header bar */}
        <Box style={{ background: '#14532d', borderRadius: '10px 10px 0 0', padding: '7px 14px' }}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap={8} style={{ flexShrink: 0 }}>
              <Text fw={700} size="12px" c="white" style={{ letterSpacing: '0.3px' }}>Sales Register</Text>
              <Badge size="sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#86efac', border: '1px solid rgba(255,255,255,0.2)' }}>
                {loading ? <Loader size={10} color="white" /> : `${filteredEntries.length}${historySearch ? ` / ${entries.length}` : ''} records`}
              </Badge>
              {editingId && <Badge size="sm" color="yellow" variant="filled" radius="sm">EDIT MODE</Badge>}
            </Group>

            <Group gap={4} wrap="nowrap">
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

              <Button leftSection={saving ? <Loader size={10} color="white" /> : <IconDeviceFloppy size={12} />}
                onClick={handleSave} disabled={saving} size="compact-xs" radius="sm"
                style={{ background: editingId ? '#b45309' : '#166534', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {editingId ? 'Update' : 'Save'}
              </Button>
              <Button leftSection={saving ? <Loader size={10} color="white" /> : <IconDeviceFloppy size={12} />}
                onClick={handleSaveClose} disabled={saving} size="compact-xs" radius="sm"
                style={{ background: '#0369a1', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Save &amp; Close
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              <Button leftSection={<IconPlus size={12} />} onClick={handleNew} size="compact-xs" radius="sm"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                New
              </Button>
              <Button leftSection={<IconEdit size={12} />} disabled={!selRow} onClick={handleEdit} size="compact-xs" radius="sm"
                style={{ background: selRow ? '#166534' : 'rgba(255,255,255,0.07)', border: 'none', fontWeight: 700, fontSize: 10, height: 24 }}>
                Edit
              </Button>
              <Button leftSection={<IconBan size={12} />} onClick={handleNew} size="compact-xs" radius="sm"
                style={{ background: editingId ? '#b45309' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {editingId ? 'Cancel Edit' : 'Clear'}
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              <Button leftSection={<IconHistory size={12} />} onClick={() => { setShowHistory(v => !v); if (showHistory) setHistorySearch(''); }} size="compact-xs" radius="sm"
                style={{ background: showHistory ? '#166534' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {showHistory ? 'Hide' : 'Search'}
              </Button>
              <Button leftSection={<IconRefresh size={12} />} onClick={loadEntries} size="compact-xs" radius="sm"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Refresh
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              <Button leftSection={<IconPrinter size={12} />} disabled={!selRow}
                onClick={() => selRow && printSlip(selRow)}
                size="compact-xs" radius="sm"
                style={{ background: selRow ? '#b91c1c' : 'rgba(255,255,255,0.07)', border: 'none', fontWeight: 700, fontSize: 10, height: 24 }}>
                Print
              </Button>
              <Button leftSection={<IconTrash size={12} />} disabled={!selRow}
                onClick={handleDelete}
                size="compact-xs" radius="sm"
                style={{ background: selRow ? '#7f1d1d' : 'rgba(255,255,255,0.07)', border: 'none', fontWeight: 700, fontSize: 10, height: 24 }}>
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
                  {['#', 'Bill No', 'Date', 'Sess', 'Mode', isLocal ? 'Center' : 'Creditor', ...(isLocal ? ['Agent'] : ['Op. Credit', 'Center', 'Agent']), 'Litres', 'Rate/L', 'Amount', isLocal ? 'Payment' : '', ''].map((col, i) => col !== undefined && (
                    <Table.Th key={i} style={{ fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#14532d', whiteSpace: 'nowrap', padding: '9px 12px', borderBottom: '2px solid #86efac' }}>
                      {col}
                    </Table.Th>
                  ))}
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
                          <Text c="dimmed" size="sm" fw={600}>{historySearch ? `No results for "${historySearch}"` : 'No sales entries today'}</Text>
                          <Text c="dimmed" size="xs">Fill in the form above and press Save</Text>
                        </Stack>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : filteredEntries.map((e, idx) => {
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
        <Box style={{ background: 'white', border: '1px solid #bbf7d0', borderTop: '2px solid #dcfce7', borderRadius: '0 0 10px 10px', padding: '8px 16px' }}>
          <Group gap={10} wrap="nowrap" align="center">
            <Box style={{ flexShrink: 0 }}>
              <Text size="10px" fw={800} c="#14532d" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Summary</Text>
              <Text size="9px" c="#94a3b8">{entries.length} records</Text>
            </Box>
            <Divider orientation="vertical" style={{ height: 36 }} />
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
    </Box>
  );
}
