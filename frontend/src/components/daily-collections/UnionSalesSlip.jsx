/**
 * UnionSalesSlip — MilkSales-style design (white header, cards, colored buttons)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Group, Stack, Text, Badge, Button, ActionIcon,
  NumberInput, TextInput, Table, ScrollArea, Loader, Center,
  Checkbox, Card, Divider, Select, Modal, Progress,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus, IconEdit, IconX, IconSearch, IconRefresh,
  IconTrash, IconPrinter, IconMilk, IconFilter,
  IconDeviceFloppy, IconCheck, IconReceipt, IconDroplet,
  IconAlertTriangle, IconHistory, IconBan, IconUpload,
} from '@tabler/icons-react';
import { SegmentedControl } from '@mantine/core';
import { unionSalesSlipAPI } from '../../services/api';
import ImportModal from '../common/ImportModal';
import dayjs from 'dayjs';

/* ── helpers ── */
const fmt2 = v => parseFloat(v || 0).toFixed(2);
const fmt3 = v => parseFloat(v || 0).toFixed(3);
const fmtInr = v => `₹${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const toDate = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d?.toDate === 'function') return d.toDate(); // dayjs
  return new Date(d);
};

const isSameDate = (a, b) => {
  const da = toDate(a), db = toDate(b);
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth()    === db.getMonth()    &&
         da.getDate()     === db.getDate();
};

const months = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2010 + 2 }, (_, i) => {
  const y = 2011 + i;
  return { value: String(y), label: String(y) };
}).reverse(); // newest first

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function UnionSalesSlip() {

  const initForm = () => ({
    date: new Date(), time: 'AM',
    qty: '', fat: '', snf: '',
    rate: '', spoilage: false, unionSpoilage: '', transportationSpoilage: '',
  });
  const [form, setForm] = useState(initForm());
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const amount = parseFloat(
    ((parseFloat(form.qty) || 0) * (parseFloat(form.rate) || 0)).toFixed(2)
  );

  const [editingId,     setEditingId]     = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selRow,        setSelRow]        = useState(null);
  const [entries,       setEntries]       = useState([]);
  const [totals,        setTotals]        = useState({ totalQty: 0, totalAmount: 0, totalUnionSpoilage: 0, totalTransportationSpoilage: 0 });
  const [filterMonth,   setFilterMonth]   = useState(String(new Date().getMonth() + 1));
  const [filterYear,    setFilterYear]    = useState(String(new Date().getFullYear()));
  const [monthMode,     setMonthMode]     = useState(false);

  // ── Import state ─────────────────────────────────────────────────────────
  const [importStatus, setImportStatus] = useState('idle'); // idle|uploading|done|error
  const [rawImportOpen, setRawImportOpen] = useState(false);
  const [importPct,    setImportPct]    = useState(0);
  const [importResult, setImportResult] = useState(null);

  const qtyRef    = useRef(null);
  const fatRef    = useRef(null);
  const snfRef    = useRef(null);
  const rateRef   = useRef(null);
  const uSpoilRef = useRef(null);
  const tSpoilRef = useRef(null);

  const focusRef = r => setTimeout(() => r?.current?.querySelector?.('input')?.focus(), 30);
  const moveOn   = nextRef => e => { if (e.key === 'Enter') { e.preventDefault(); focusRef(nextRef); } };

  const loadEntries = useCallback(async (month = filterMonth, year = filterYear, asMonthMode = true) => {
    setLoading(true);
    setMonthMode(asMonthMode);
    try {
      const res = await unionSalesSlipAPI.getAll({ month, year, limit: 2000, sortField: 'date', sortOrder: 'desc' });
      setEntries(res?.data || []);
      setTotals(res?.totals || { totalQty: 0, totalAmount: 0, totalUnionSpoilage: 0, totalTransportationSpoilage: 0 });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to load' });
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear]);

  // Load by specific date: fetches the whole month then filters frontend by date+shift
  const loadByDate = (d) => {
    const dt = toDate(d);
    const m  = String(dt.getMonth() + 1);
    const y  = String(dt.getFullYear());
    setFilterMonth(m);
    setFilterYear(y);
    loadEntries(m, y, false); // false = date mode, frontend filters by date+shift
  };

  // On mount load today; reload when form date changes
  useEffect(() => { loadByDate(new Date()); }, []); // eslint-disable-line
  useEffect(() => { loadByDate(form.date); }, [form.date]); // eslint-disable-line

  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortTh = ({ label, sk }) => (
    <Table.Th
      onClick={() => sk && handleSort(sk)}
      style={{ fontWeight:800, fontSize:10, textTransform:'uppercase', letterSpacing:'0.5px',
               color:'#4c1d95', whiteSpace:'nowrap', padding:'9px 12px',
               borderBottom:'2px solid #c4b5fd', cursor: sk ? 'pointer' : 'default',
               userSelect:'none' }}
    >
      {label}{sk && sortKey === sk ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </Table.Th>
  );

  const filteredEntries = historySearch.trim()
    ? entries.filter(e =>
        (e.slipNo || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        dayjs(e.date).format('DD MMM YYYY').toLowerCase().includes(historySearch.toLowerCase()) ||
        (e.time || '').toLowerCase().includes(historySearch.toLowerCase())
      )
    : monthMode
      ? entries
      : entries.filter(e => e.date && isSameDate(e.date, form.date) && e.time === form.time);

  const sortedEntries = (() => {
    if (!sortKey) {
      // In detailed search mode, default to ascending date order
      if (showSearch) return [...filteredEntries].sort((a, b) => new Date(a.date||0) - new Date(b.date||0));
      return filteredEntries;
    }
    const d = sortDir === 'asc' ? 1 : -1;
    return [...filteredEntries].sort((a, b) => {
      const numFields = ['qty','fat','snf','rate','amount','unionSpoilage','transportationSpoilage'];
      if (numFields.includes(sortKey)) return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * d;
      if (sortKey === 'date') return (new Date(a.date||0) - new Date(b.date||0)) * d;
      return String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')) * d;
    });
  })();

  const handleClear = () => { setForm(initForm()); setEditingId(null); setSelRow(null); focusRef(qtyRef); };

  const handleSave = async () => {
    const f = form;
    if (!f.qty || !f.rate) return notifications.show({ color: 'red', message: 'Qty and Rate are required' });

    const payload = {
      date:                   dayjs(f.date).format('YYYY-MM-DD'),
      time:                   f.time,
      qty:                    parseFloat(f.qty) || 0,
      fat:                    parseFloat(f.fat) || 0,
      snf:                    parseFloat(f.snf) || 0,
      rate:                   parseFloat(f.rate) || 0,
      amount:                 parseFloat(((parseFloat(f.qty) || 0) * (parseFloat(f.rate) || 0)).toFixed(2)),
      spoilage:               f.spoilage,
      unionSpoilage:          f.spoilage ? (parseFloat(f.unionSpoilage) || 0) : 0,
      transportationSpoilage: f.spoilage ? (parseFloat(f.transportationSpoilage) || 0) : 0,
    };

    setSaving(true);
    try {
      if (editingId) {
        const res = await unionSalesSlipAPI.update(editingId, payload);
        setEntries(prev => prev.map(e => e._id === editingId ? (res?.data || { ...e, ...payload }) : e));
        notifications.show({ color: 'teal', message: 'Record updated', icon: <IconCheck size={14} /> });
      } else {
        const res = await unionSalesSlipAPI.create(payload);
        setEntries(prev => [res?.data || { ...payload, _id: Date.now().toString() }, ...prev]);
        notifications.show({ color: 'green', message: 'Record saved', icon: <IconCheck size={14} /> });
      }
      handleClear();
      loadEntries();
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleLastEnter = e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } };

  // ── Dairy DB file import handler ──────────────────────────────────────────
  const handleDairyFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportPct(0);
    setImportStatus('uploading');
    setImportResult(null);
    try {
      const response = await unionSalesSlipAPI.fileImport(file, (evt) => {
        if (evt.total) setImportPct(Math.round((evt.loaded / evt.total) * 100));
      });
      setImportPct(100);
      setImportStatus('done');
      setImportResult(response.data);
      const { created, skipped, errors } = response.data;
      if (errors.length === 0) {
        notifications.show({ message: `Import successful! ${created} created, ${skipped} skipped.`, color: 'green' });
      } else {
        notifications.show({ message: `Import done: ${created} created, ${skipped} skipped, ${errors.length} errors.`, color: 'yellow' });
      }
      // Auto-switch to the imported data's month so all records are visible
      const sample = response.data?.debugSample?.[0];
      if (sample?.date) {
        const d = new Date(sample.date);
        const importYear = String(d.getFullYear());
        const importMonth = String(d.getMonth() + 1);
        setFilterYear(importYear);
        setFilterMonth(importMonth);
        loadEntries(importMonth, importYear, true);
      } else {
        loadEntries(filterMonth, filterYear, true);
      }
    } catch (err) {
      setImportStatus('error');
      notifications.show({ message: err?.message || 'Import failed', color: 'red' });
    }
  };

  // Raw Zibitt DB import — frontend parses Excel, backend transforms + upserts
  const handleZibittRawImportSlip = async (rawRows) => {
    const CHUNK = 500;
    let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;
    for (let i = 0; i < rawRows.length; i += CHUNK) {
      const batch = rawRows.slice(i, i + CHUNK);
      const res = await unionSalesSlipAPI.zibittRawImport(batch);
      totalCreated  += res?.data?.created  ?? 0;
      totalUpdated  += res?.data?.updated  ?? 0;
      totalSkipped  += res?.data?.skipped  ?? 0;
    }
    notifications.show({
      color: totalSkipped && !totalCreated && !totalUpdated ? 'orange' : 'teal',
      message: `${totalCreated} created, ${totalUpdated} updated${totalSkipped ? `, ${totalSkipped} skipped` : ''}`,
      autoClose: 4000
    });
    // Try to detect the imported month from the first raw row
    const firstDate = rawRows[0]?.date_entry || rawRows[0]?.SalesDate || rawRows[0]?.date;
    if (firstDate) {
      const d = new Date(typeof firstDate === 'number' ? Math.round((firstDate - 25569) * 86400000) : firstDate);
      if (!isNaN(d.getTime())) {
        const m = String(d.getMonth() + 1);
        const y = String(d.getFullYear());
        setFilterMonth(m);
        setFilterYear(y);
        loadEntries(m, y, true);
        return;
      }
    }
    loadEntries(filterMonth, filterYear, true);
  };

  const handleEdit = (row) => {
    const r = row || selRow;
    if (!r) return notifications.show({ color: 'yellow', message: 'Select a row to edit' });
    setEditingId(r._id);
    setSelRow(r);
    setForm({
      date:                   r.date ? new Date(r.date) : new Date(),
      time:                   r.time || 'AM',
      qty:                    String(r.qty ?? ''),
      fat:                    String(r.fat ?? ''),
      snf:                    String(r.snf ?? ''),
      rate:                   String(r.rate ?? ''),
      spoilage:               r.spoilage ?? false,
      unionSpoilage:          String(r.unionSpoilage ?? ''),
      transportationSpoilage: String(r.transportationSpoilage ?? ''),
    });
    focusRef(qtyRef);
  };

  const handleDelete = (row) => {
    const r = row || selRow;
    if (!r) return notifications.show({ color: 'yellow', message: 'Select a row to delete' });
    modals.openConfirmModal({
      title: 'Delete Record',
      children: (
        <Text size="sm">Delete slip <b>{r.slipNo}</b> for <b>{dayjs(r.date).format('DD MMM YYYY')}</b> - <b>{r.time}</b>?</Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await unionSalesSlipAPI.delete(r._id);
          setEntries(prev => prev.filter(e => e._id !== r._id));
          if (selRow?._id === r._id) handleClear();
          notifications.show({ color: 'orange', message: 'Deleted' });
          loadEntries();
        } catch (err) {
          notifications.show({ color: 'red', message: err?.message || 'Delete failed' });
        }
      },
    });
  };

  const handlePrint = (row) => {
    const r = row || selRow;
    if (!r) return notifications.show({ color: 'yellow', message: 'Select a row to print' });
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`
      <html><head><title>Union Sales Slip</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 20px; }
        h2 { text-align: center; margin: 0 0 8px; font-size: 16px; }
        .sub { text-align: center; color: #666; font-size: 10px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px 8px; border-bottom: 1px dashed #ccc; }
        td:last-child { text-align: right; font-weight: bold; }
        .total { border-top: 2px solid #000; font-size: 14px; }
        .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #888; }
      </style></head><body>
      <h2>UNION SALES SLIP</h2>
      <div class="sub">Dairy Society Management System</div>
      <table>
        <tr><td>Slip No</td><td>${r.slipNo || '—'}</td></tr>
        <tr><td>Date</td><td>${dayjs(r.date).format('DD/MM/YYYY')}</td></tr>
        <tr><td>Session</td><td>${r.time}</td></tr>
        <tr><td>Quantity</td><td>${fmt3(r.qty)} L</td></tr>
        <tr><td>FAT</td><td>${fmt2(r.fat)}</td></tr>
        <tr><td>SNF</td><td>${fmt2(r.snf)}</td></tr>
        <tr><td>Rate</td><td>₹${fmt2(r.rate)}/L</td></tr>
        <tr class="total"><td>Amount</td><td>${fmtInr(r.amount)}</td></tr>
        <tr><td>Union Spoilage</td><td>${fmt2(r.unionSpoilage)}</td></tr>
        <tr><td>Trans. Spoilage</td><td>${fmt2(r.transportationSpoilage)}</td></tr>
      </table>
      <div class="footer">Printed on ${dayjs().format('DD/MM/YYYY HH:mm')}</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  /* ══ RENDER ══════════════════════════════════════════════════════════════ */
  return (
    <>
    <Box style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <Box style={{ background: 'white', borderBottom: '1px solid #dbeafe', padding: '8px 20px', flexShrink: 0, boxShadow: '0 1px 6px rgba(37,99,235,0.08)' }}>
        <Group justify="space-between" align="center" wrap="nowrap">

          {/* LEFT */}
          <Group gap={12} align="center" wrap="nowrap" style={{ flex: 1 }}>
            <Box style={{ background: '#ede9fe', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <IconMilk size={22} color="#7c3aed" />
            </Box>
            <Box style={{ flexShrink: 0 }}>
              <Group gap={8} align="center">
                <Text size="16px" fw={800} c="#4c1d95" style={{ lineHeight: 1.1, letterSpacing: '-0.3px' }}>Union Sales Slip</Text>
                {editingId && <Badge color="orange" size="sm" variant="filled">EDIT MODE</Badge>}
              </Group>
              <Text size="10px" c="#64748b">Daily Union Sales Entry</Text>
            </Box>

            <Box style={{ width: 1, height: 36, background: '#dbeafe', flexShrink: 0 }} />

            {/* Date */}
            <Box style={{ flexShrink: 0 }}>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3} style={{ letterSpacing: '0.4px' }}>Date</Text>
              <DatePickerInput
                value={form.date} onChange={d => d && setField('date', d)} valueFormat="DD MMM YYYY"
                size="xs" radius="md" style={{ width: 120 }}
                styles={{ input: { fontWeight: 700, fontSize: 12, border: '1.5px solid #bfdbfe', height: 28 } }}
              />
            </Box>

            {/* Session */}
            <Box style={{ flexShrink: 0 }}>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3} style={{ letterSpacing: '0.4px' }}>Session</Text>
              <SegmentedControl
                value={form.time} onChange={v => setField('time', v)}
                data={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]}
                size="xs" radius="md"
                styles={{ root: { background: '#f1f5f9', border: '1.5px solid #bfdbfe' } }}
              />
            </Box>

            {/* Month filter */}
          
          </Group>

          {/* RIGHT */}
          <Button leftSection={<IconX size={14} />} onClick={handleClear} radius="md" size="sm" variant="default" style={{ fontWeight: 700, flexShrink: 0 }}>
            Clear
          </Button>
        </Group>
      </Box>

      {/* ══ CARD ROW ════════════════════════════════════════════════════════ */}
      <Box style={{ flexShrink: 0, padding: '8px 20px 0' }}>
        <Group gap={8} align="stretch" wrap="nowrap">

          {/* Card 1 — Slip Info */}
          <Card shadow="xs" radius="md" withBorder style={{ flex: '0 0 190px', borderColor: '#bfdbfe', borderTop: '3px solid #2563eb', padding: '8px 12px' }}>
            <Group gap={5} mb={7}>
              <Box style={{ background: '#dbeafe', borderRadius: 6, padding: '3px 5px' }}><IconReceipt size={13} color="#2563eb" /></Box>
              <Text size="11px" fw={800} c="#1e3a8a" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Slip Info</Text>
            </Group>
            <Stack gap={5}>
              <Box>
                <Text size="9px" fw={700} c="#64748b" mb={1} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Slip No</Text>
                <Text size="12px" fw={900} c="#2563eb" style={{ fontFamily: 'monospace' }}>
                  {selRow?.slipNo || (editingId ? '—' : 'AUTO')}
                </Text>
              </Box>
              <Box>
                <Text size="9px" fw={700} c="#64748b" mb={1} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Date</Text>
                <Text size="12px" fw={700} c="#1e293b">{dayjs(form.date).format('DD MMM YYYY')}</Text>
              </Box>
              <Badge
                color={form.time === 'AM' ? 'orange' : 'indigo'} size="sm" variant="filled"
                style={{ alignSelf: 'flex-start' }}
              >
                {form.time === 'AM' ? '☀ AM' : '🌙 PM'}
              </Badge>
            </Stack>
          </Card>

          {/* Card 2 — Qty & Quality */}
          <Card shadow="xs" radius="md" withBorder style={{ flex: 1, borderColor: '#c4b5fd', borderTop: '3px solid #7c3aed', padding: '8px 12px' }}>
            <Group gap={5} mb={7} justify="space-between">
              <Group gap={5}>
                <Box style={{ background: '#ede9fe', borderRadius: 6, padding: '3px 5px' }}><IconDroplet size={13} color="#7c3aed" /></Box>
                <Text size="11px" fw={800} c="#4c1d95" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Milk Qty &amp; Quality</Text>
              </Group>
              <Text size="9px" c="#94a3b8">Tab → Qty → FAT → SNF → Rate → Enter</Text>
            </Group>
            <Group gap={8} align="flex-end">
              <Box ref={qtyRef} style={{ flex: 1.3 }}>
                <Text size="9px" fw={700} c="#0369a1" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>Qty (L)</Text>
                <NumberInput
                  placeholder="0.000"
                  value={form.qty === '' ? '' : parseFloat(form.qty)}
                  onChange={v => setField('qty', String(v ?? ''))}
                  min={0} decimalScale={3} step={0.5} hideControls
                  styles={{ input: { height: 36, fontSize: 16, fontWeight: 900, background: '#f0f9ff', border: '2px solid #7dd3fc', color: '#0369a1', textAlign: 'center' } }}
                  onKeyDown={moveOn(fatRef)}
                />
              </Box>
              <Box ref={fatRef} style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#7c3aed" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>FAT</Text>
                <NumberInput
                  placeholder="0.0"
                  value={form.fat === '' ? '' : parseFloat(form.fat)}
                  onChange={v => setField('fat', String(v ?? ''))}
                  min={0} decimalScale={1} hideControls
                  styles={{ input: { height: 36, fontSize: 16, fontWeight: 900, background: '#f5f3ff', border: '2px solid #c4b5fd', color: '#7c3aed', textAlign: 'center' } }}
                  onKeyDown={moveOn(snfRef)}
                />
              </Box>
              <Box ref={snfRef} style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#0891b2" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>SNF</Text>
                <NumberInput
                  placeholder="0.0"
                  value={form.snf === '' ? '' : parseFloat(form.snf)}
                  onChange={v => setField('snf', String(v ?? ''))}
                  min={0} decimalScale={1} hideControls
                  styles={{ input: { height: 36, fontSize: 16, fontWeight: 900, background: '#ecfeff', border: '2px solid #67e8f9', color: '#0891b2', textAlign: 'center' } }}
                  onKeyDown={moveOn(rateRef)}
                />
              </Box>
              {/* Monthly totals mini */}
              <Box style={{ flex: '0 0 160px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}>
                <Text size="8px" fw={700} c="#94a3b8" tt="uppercase" mb={4} style={{ letterSpacing: '0.5px' }}>Monthly Totals</Text>
                <Group gap={6} grow>
                  {[
                    { label: 'Qty', val: fmt3(totals.totalQty), c: '#0369a1' },
                    { label: 'FAT', val: '—', c: '#7c3aed' },
                    { label: 'SNF', val: '—', c: '#0891b2' },
                  ].map(({ label, val, c }) => (
                    <Box key={label} style={{ textAlign: 'center' }}>
                      <Text size="8px" fw={600} c="#94a3b8" tt="uppercase">{label}</Text>
                      <Text size="12px" fw={800} style={{ color: c }}>{val}</Text>
                    </Box>
                  ))}
                </Group>
              </Box>
            </Group>
          </Card>

          {/* Card 3 — Rate & Spoilage */}
          <Card shadow="xs" radius="md" withBorder style={{ flex: '0 0 300px', borderColor: '#fde68a', borderTop: '3px solid #d97706', padding: '8px 12px' }}>
            <Group gap={5} mb={7}>
              <Box style={{ background: '#fef9c3', borderRadius: 6, padding: '3px 5px' }}><IconAlertTriangle size={13} color="#d97706" /></Box>
              <Text size="11px" fw={800} c="#78350f" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Rate &amp; Spoilage</Text>
            </Group>

            {/* Rate + Amount */}
            <Group gap={8} align="flex-end" mb={8}>
              <Box ref={rateRef} style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#c2410c" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>Rate ₹/L</Text>
                <NumberInput
                  placeholder="0.00"
                  value={form.rate === '' ? '' : parseFloat(form.rate)}
                  onChange={v => setField('rate', String(v ?? ''))}
                  min={0} decimalScale={2} hideControls
                  styles={{ input: { height: 36, fontSize: 15, fontWeight: 900, background: '#fff7ed', border: '2px solid #fdba74', color: '#c2410c', textAlign: 'center' } }}
                  onKeyDown={form.spoilage ? moveOn(uSpoilRef) : handleLastEnter}
                />
              </Box>
              <Box style={{ flex: 1.2 }}>
                <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={2} style={{ letterSpacing: '0.4px' }}>Amount (Auto)</Text>
                <Box style={{
                  height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg,#1e3a5f,#1e40af)',
                  borderRadius: 6, fontSize: 15, fontWeight: 900, color: 'white',
                }}>
                  {fmtInr(amount)}
                </Box>
              </Box>
            </Group>

            {/* Spoilage */}
            <Group gap={6} align="flex-end">
              <Box style={{ flexShrink: 0, paddingBottom: 2 }}>
                <Text size="8px" fw={700} c="#64748b" mb={3} tt="uppercase" style={{ letterSpacing: '0.3px' }}>Spoilage</Text>
                <Checkbox
                  checked={form.spoilage}
                  onChange={e => setField('spoilage', e.currentTarget.checked)}
                  label={<Text size="11px" fw={700} c={form.spoilage ? '#16a34a' : '#94a3b8'}>{form.spoilage ? 'Yes' : 'No'}</Text>}
                  size="sm" color="green"
                />
              </Box>
              <Box ref={uSpoilRef} style={{ flex: 1 }}>
                <Text size="8px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.3px' }}>Union Spoilage</Text>
                <NumberInput
                  placeholder="0.00"
                  value={form.unionSpoilage === '' ? '' : parseFloat(form.unionSpoilage)}
                  onChange={v => setField('unionSpoilage', String(v ?? ''))}
                  min={0} decimalScale={2} disabled={!form.spoilage} hideControls
                  styles={{ input: { height: 28, fontSize: 12, fontWeight: 700, border: '1.5px solid #fecaca', color: '#dc2626', textAlign: 'center', opacity: form.spoilage ? 1 : 0.4 } }}
                  onKeyDown={moveOn(tSpoilRef)}
                />
              </Box>
              <Box ref={tSpoilRef} style={{ flex: 1 }}>
                <Text size="8px" fw={700} c="#64748b" mb={2} tt="uppercase" style={{ letterSpacing: '0.3px' }}>Trans. Spoilage</Text>
                <NumberInput
                  placeholder="0.00"
                  value={form.transportationSpoilage === '' ? '' : parseFloat(form.transportationSpoilage)}
                  onChange={v => setField('transportationSpoilage', String(v ?? ''))}
                  min={0} decimalScale={2} disabled={!form.spoilage} hideControls
                  styles={{ input: { height: 28, fontSize: 12, fontWeight: 700, border: '1.5px solid #fecaca', color: '#dc2626', textAlign: 'center', opacity: form.spoilage ? 1 : 0.4 } }}
                  onKeyDown={handleLastEnter}
                />
              </Box>
            </Group>
          </Card>

        </Group>
      </Box>

      {/* ══ TABLE SECTION ═══════════════════════════════════════════════════ */}
      <Box style={{ flex: 1, overflow: 'hidden', minHeight: 0, padding: '10px 20px 12px', display: 'flex', flexDirection: 'column' }}>

        {/* Table header bar */}
        <Box style={{ background: '#1e1b4b', borderRadius: '10px 10px 0 0', padding: '7px 14px' }}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap={8} style={{ flexShrink: 0 }}>
              <Text fw={700} size="12px" c="white" style={{ letterSpacing: '0.3px' }}>Union Sales Register</Text>
              <Badge size="sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#c4b5fd', border: '1px solid rgba(255,255,255,0.2)' }}>
                {loading ? <Loader size={10} color="white" /> : `${filteredEntries.length}${historySearch ? ` / ${entries.length}` : ''} records`}
              </Badge>
              {editingId && <Badge size="sm" color="yellow" variant="filled" radius="sm">EDIT MODE</Badge>}
              {monthMode && <Badge size="sm" color="violet" variant="filled" radius="sm">{months.find(m => m.value === filterMonth)?.label} {filterYear}</Badge>}
              <Group gap={4} wrap="nowrap">
                <Select
                  data={months} value={filterMonth} onChange={v => v && setFilterMonth(v)}
                  size="xs" radius="md" style={{ width: 110 }}
                  styles={{ input: { fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', height: 28, fontSize: 11 } }}
                />
                <Select
                  data={years} value={filterYear} onChange={v => v && setFilterYear(v)}
                  size="xs" radius="md" style={{ width: 72 }}
                  styles={{ input: { fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', height: 28, fontSize: 11 } }}
                />
                <Button
                  leftSection={<IconFilter size={11} />} onClick={() => loadEntries(filterMonth, filterYear, true)}
                  size="xs" radius="md"
                  style={{ height: 28, padding: '0 10px', fontSize: 10, fontWeight: 700, background: '#6d28d9', color: 'white' }}
                >
                  Go
                </Button>
                {monthMode && (
                  <Button
                    size="xs" radius="md"
                    onClick={() => loadByDate(form.date)}
                    style={{ height: 28, padding: '0 8px', fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    Today
                  </Button>
                )}
              </Group>
            </Group>

            <Group gap={4} wrap="nowrap">
              {showSearch && (
                <TextInput
                  placeholder="Search slip, date, session..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.currentTarget.value)}
                  size="xs" radius="sm" style={{ width: 210 }}
                  leftSection={<IconSearch size={12} color="#c4b5fd" />}
                  rightSection={historySearch ? <ActionIcon size={14} variant="subtle" onClick={() => setHistorySearch('')}><IconX size={10} color="white" /></ActionIcon> : null}
                  styles={{ input: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontSize: 11, height: 24 } }}
                  autoFocus
                />
              )}

              {/* Save — emerald */}
              <Button leftSection={saving ? <Loader size={10} color="white" /> : <IconDeviceFloppy size={12} />}
                onClick={handleSave} disabled={saving} size="compact-xs" radius="sm"
                style={{ background: editingId ? '#b45309' : '#059669', border: '1px solid #34d399', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {editingId ? 'Update' : 'Save'}
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* New — indigo */}
              <Button leftSection={<IconPlus size={12} />} onClick={handleClear} size="compact-xs" radius="sm"
                style={{ background: '#4f46e5', border: '1px solid #818cf8', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                New
              </Button>
              {/* Edit — amber */}
              <Button leftSection={<IconEdit size={12} />} disabled={!selRow} onClick={() => handleEdit(null)} size="compact-xs" radius="sm"
                style={{ background: selRow ? '#d97706' : 'rgba(255,255,255,0.07)', border: selRow ? '1px solid #fbbf24' : 'none', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Edit
              </Button>
              {/* Clear — slate */}
              <Button leftSection={<IconBan size={12} />} onClick={handleClear} size="compact-xs" radius="sm"
                style={{ background: editingId ? '#b45309' : '#475569', border: '1px solid #94a3b8', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {editingId ? 'Cancel Edit' : 'Clear'}
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* Search — teal */}
              <Button leftSection={<IconHistory size={12} />} onClick={() => { if (showSearch) { setShowSearch(false); setHistorySearch(''); } else { setShowSearch(true); setSortKey('date'); setSortDir('asc'); } }} size="compact-xs" radius="sm"
                style={{ background: showSearch ? '#0f766e' : '#0d9488', border: '1px solid #2dd4bf', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                {showSearch ? 'Hide' : 'Search'}
              </Button>
              {/* Refresh — cyan */}
              <Button leftSection={<IconRefresh size={12} />} onClick={() => loadEntries()} size="compact-xs" radius="sm"
                style={{ background: '#0891b2', border: '1px solid #67e8f9', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Refresh
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* Print — rose */}
              <Button leftSection={<IconPrinter size={12} />} disabled={!selRow}
                onClick={() => handlePrint(null)}
                size="compact-xs" radius="sm"
                style={{ background: selRow ? '#e11d48' : 'rgba(255,255,255,0.07)', border: selRow ? '1px solid #fb7185' : 'none', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Print
              </Button>
              {/* Delete — deep red */}
              <Button leftSection={<IconTrash size={12} />} disabled={!selRow}
                onClick={() => handleDelete(null)}
                size="compact-xs" radius="sm"
                style={{ background: selRow ? '#991b1b' : 'rgba(255,255,255,0.07)', border: selRow ? '1px solid #f87171' : 'none', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Delete
              </Button>

              <Divider orientation="vertical" color="rgba(255,255,255,0.2)" style={{ height: 20 }} />

              {/* Import Dairy DB — green */}
              <Button leftSection={<IconUpload size={12} />}
                onClick={() => document.getElementById('union-dairy-file-input').click()}
                size="compact-xs" radius="sm"
                style={{ background: '#15803d', border: '1px solid #4ade80', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Import Dairy
              </Button>
              <input id="union-dairy-file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleDairyFileSelect} />
              {/* Import Zibitt Raw DB — fuchsia */}
              <Button leftSection={<IconUpload size={12} />} onClick={() => setRawImportOpen(true)}
                size="compact-xs" radius="sm"
                style={{ background: '#a21caf', border: '1px solid #e879f9', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                Import DB
              </Button>
            </Group>
          </Group>
        </Box>

        {/* Table */}
        <Box style={{ flex: 1, overflow: 'hidden', background: 'white', borderRadius: '0 0 10px 10px', border: '1px solid #c4b5fd', borderTop: 'none' }}>
          <ScrollArea h="100%" type="auto">
            {loading ? (
              <Center py="xl"><Loader size="sm" color="violet" /></Center>
            ) : (
              <Table striped highlightOnHover stickyHeader withColumnBorders style={{ fontSize: 12 }}>
                <Table.Thead style={{ background: 'linear-gradient(180deg,#ede9fe 0%,#ddd6fe 100%)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <Table.Tr>
                    <SortTh label="#"           sk={null} />
                    <SortTh label="Slip No"     sk="slipNo" />
                    <SortTh label="Date"        sk="date" />
                    <SortTh label="Session"     sk="time" />
                    <SortTh label="Qty (L)"     sk="qty" />
                    <SortTh label="FAT"         sk="fat" />
                    <SortTh label="SNF"         sk="snf" />
                    <SortTh label="Rate ₹"      sk="rate" />
                    <SortTh label="Amount ₹"    sk="amount" />
                    <SortTh label="Union Spg"   sk="unionSpoilage" />
                    <SortTh label="Trans Spg"   sk="transportationSpoilage" />
                    <SortTh label="Actions"     sk={null} />
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {filteredEntries.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={12}>
                        <Center py="xl">
                          <Stack align="center" gap={6}>
                            <IconMilk size={48} color="#ddd6fe" />
                            <Text c="dimmed" size="sm" fw={600}>{historySearch ? `No results for "${historySearch}"` : 'No slips found for this month'}</Text>
                          </Stack>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : filteredEntries.map((e, idx) => {
                    const isSel   = selRow?._id === e._id;
                    const isEdit  = editingId === e._id;
                    return (
                      <Table.Tr key={e._id} onClick={() => setSelRow(isSel ? null : e)}
                        style={{ cursor: 'pointer', background: isEdit ? '#fffbeb' : isSel ? '#f5f3ff' : undefined, borderLeft: isEdit ? '3px solid #d97706' : isSel ? '3px solid #7c3aed' : '3px solid transparent', transition: 'background 0.1s' }}>
                        <Table.Td style={{ padding: '6px 12px', fontWeight: 700, color: '#94a3b8', width: 32 }}>{idx + 1}</Table.Td>
                        <Table.Td style={{ padding: '6px 12px', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{e.slipNo}</Table.Td>
                        <Table.Td style={{ padding: '6px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{dayjs(e.date).format('DD MMM YYYY')}</Table.Td>
                        <Table.Td style={{ padding: '6px 12px' }}>
                          <Badge size="xs" color={e.time === 'AM' ? 'orange' : 'indigo'} variant="light">{e.time}</Badge>
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 12px', fontWeight: 800, color: '#0369a1', textAlign: 'right' }}>{fmt3(e.qty)}</Table.Td>
                        <Table.Td style={{ padding: '6px 12px', color: '#7c3aed', textAlign: 'right' }}>{fmt2(e.fat)}</Table.Td>
                        <Table.Td style={{ padding: '6px 12px', color: '#0891b2', textAlign: 'right' }}>{fmt2(e.snf)}</Table.Td>
                        <Table.Td style={{ padding: '6px 12px', color: '#c2410c', textAlign: 'right' }}>₹{fmt2(e.rate)}</Table.Td>
                        <Table.Td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          <Text size="13px" fw={800} c="violet.7">{fmtInr(e.amount)}</Text>
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 12px', color: '#dc2626', textAlign: 'right' }}>
                          {e.spoilage ? fmt2(e.unionSpoilage) : <Badge size="xs" color="gray" variant="dot">—</Badge>}
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 12px', color: '#dc2626', textAlign: 'right' }}>
                          {e.spoilage ? fmt2(e.transportationSpoilage) : <Badge size="xs" color="gray" variant="dot">—</Badge>}
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 8px' }}>
                          <Group gap={3} wrap="nowrap">
                            <ActionIcon size={22} variant="light" color="orange" onClick={ev => { ev.stopPropagation(); handleEdit(e); }} title="Edit">
                              <IconEdit size={11} />
                            </ActionIcon>
                            <ActionIcon size={22} variant="light" color="blue" onClick={ev => { ev.stopPropagation(); handlePrint(e); }} title="Print">
                              <IconPrinter size={11} />
                            </ActionIcon>
                            <ActionIcon size={22} variant="light" color="red" onClick={ev => { ev.stopPropagation(); handleDelete(e); }} title="Delete">
                              <IconTrash size={11} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>

                {filteredEntries.length > 0 && (
                  <Table.Tfoot>
                    <Table.Tr style={{ background: '#1e1b4b' }}>
                      <Table.Td colSpan={4} style={{ padding: '8px 12px', fontWeight: 700, color: '#c4b5fd', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Totals &amp; Summary
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', fontWeight: 900, color: '#7dd3fc', textAlign: 'right', fontSize: 13 }}>{fmt3(totals.totalQty)}</Table.Td>
                      <Table.Td colSpan={3} />
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <Text size="14px" fw={900} c="white">{fmtInr(totals.totalAmount)}</Text>
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', fontWeight: 700, color: '#fca5a5', textAlign: 'right' }}>{fmt2(totals.totalUnionSpoilage)}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', fontWeight: 700, color: '#fca5a5', textAlign: 'right' }}>{fmt2(totals.totalTransportationSpoilage)}</Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  </Table.Tfoot>
                )}
              </Table>
            )}
          </ScrollArea>
        </Box>

        {/* Footer Summary Strip */}
        <Box style={{ background: 'white', border: '1px solid #c4b5fd', borderTop: '2px solid #ddd6fe', borderRadius: '0 0 10px 10px', padding: '8px 16px' }}>
          <Group gap={10} wrap="nowrap" align="center">
            <Box style={{ flexShrink: 0 }}>
              <Text size="10px" fw={800} c="#4c1d95" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Summary</Text>
              <Text size="9px" c="#94a3b8">{entries.length} records · {months.find(m => m.value === filterMonth)?.label} {filterYear}</Text>
            </Box>
            <Divider orientation="vertical" style={{ height: 36 }} />
            {[
              { label: 'Total Qty',     val: `${fmt3(totals.totalQty)} L`,          c: '#0369a1', bg: '#f0f9ff',  border: '#bae6fd' },
              { label: 'Total Amt',     val: fmtInr(totals.totalAmount),             c: 'white',   bg: '#1e1b4b',  border: '#1e1b4b', bold: true },
              { label: 'Union Spg',     val: fmt2(totals.totalUnionSpoilage),        c: '#dc2626', bg: '#fef2f2',  border: '#fecaca' },
              { label: 'Trans Spg',     val: fmt2(totals.totalTransportationSpoilage), c: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
              { label: 'Mode',          val: editingId ? 'EDIT' : 'NEW',             c: editingId ? '#d97706' : '#059669', bg: editingId ? '#fffbeb' : '#f0fdf4', border: editingId ? '#fde68a' : '#bbf7d0' },
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

    {/* ══ ZIBITT RAW DB IMPORT MODAL ══════════════════════════════════════ */}
    <ImportModal
      isOpen={rawImportOpen}
      onClose={() => setRawImportOpen(false)}
      onImport={handleZibittRawImportSlip}
      entityType="Union Sales Slip (Zibitt DB — ms_id/ms_date/ms_time/qty_ltr)"
      requiredFields={['dcs_id', 'ms_id', 'ms_date', 'ms_time', 'qty_ltr', 'fat', 'snf', 'rate', 'amount']}
      maxFileSizeMB={50}
    />

    {/* ══ DAIRY IMPORT MODAL ══════════════════════════════════════════════ */}
    <Modal
      opened={importStatus === 'uploading' || importStatus === 'done' || importStatus === 'error'}
      onClose={() => setImportStatus('idle')}
      title="Dairy DB Import — Union Sales"
      size="sm"
      closeOnClickOutside={importStatus !== 'uploading'}
    >
      <Stack gap="md">
        {importStatus === 'uploading' && (
          <>
            <Text size="sm">Uploading & processing file on server...</Text>
            <Progress value={importPct} animated size="lg" color="green" />
            <Text size="xs" c="dimmed" ta="center">{importPct}% uploaded</Text>
          </>
        )}

        {importStatus === 'done' && importResult && (
          <>
            <Group grow>
              <Box ta="center" p="xs" style={{ background: '#f0fdf4', borderRadius: 8 }}>
                <Text size="xs" c="dimmed">Created</Text>
                <Text size="xl" fw={800} c="green">{importResult.created}</Text>
              </Box>
              <Box ta="center" p="xs" style={{ background: '#fafafa', borderRadius: 8 }}>
                <Text size="xs" c="dimmed">Skipped</Text>
                <Text size="xl" fw={800} c="gray">{importResult.skipped}</Text>
              </Box>
              <Box ta="center" p="xs" style={{ background: '#fff7ed', borderRadius: 8 }}>
                <Text size="xs" c="dimmed">Errors</Text>
                <Text size="xl" fw={800} c="orange">{importResult.errors?.length || 0}</Text>
              </Box>
            </Group>

            {/* Skip reasons */}
            {importResult.skipped > 0 && importResult.skipReasons && Object.keys(importResult.skipReasons).length > 0 && (
              <Box style={{ background: '#fff7ed', borderRadius: 8, padding: 8 }}>
                <Text size="xs" fw={700} c="orange" mb={4}>Skip Reasons:</Text>
                {Object.entries(importResult.skipReasons).map(([reason, count]) => (
                  <Text key={reason} size="xs" c="dimmed">
                    • {reason === 'duplicate_date_time' ? 'Duplicate date+shift already exists' :
                       reason === 'qty_zero' ? 'Qty is 0 (check ToQTY/FromQTY columns)' :
                       reason === 'date_null' ? 'Date could not be parsed (check DDate column)' :
                       reason}: {count} rows
                  </Text>
                ))}
              </Box>
            )}

            {/* Debug sample */}
            {importResult.debugSample?.length > 0 && (
              <Box style={{ background: '#f0f9ff', borderRadius: 8, padding: 8 }}>
                <Text size="xs" fw={700} c="blue" mb={4}>First parsed row (debug):</Text>
                {(() => { const s = importResult.debugSample[0]; return (
                  <Text size="xs" c="dimmed">
                    date={s.date} | time={s.time} | qty={s.qty} | fat={s.fat} | snf={s.snf} | rate={s.rate} | amt={s.amount}
                  </Text>
                ); })()}
              </Box>
            )}

            {importResult.errors?.length > 0 && (
              <Box style={{ maxHeight: 100, overflowY: 'auto', background: '#fef2f2', borderRadius: 8, padding: 8 }}>
                {importResult.errors.slice(0, 5).map((e, i) => (
                  <Text key={i} size="xs" c="red">Row {e.row}: {e.message}</Text>
                ))}
              </Box>
            )}
            <Button fullWidth color="green" onClick={() => setImportStatus('idle')}>Done</Button>
          </>
        )}

        {importStatus === 'error' && (
          <>
            <Text c="red" size="sm">Import failed. Check that your file has columns: DDate, Shift, ToQTY/FromQTY, ToFAT/FromFAT, ToSNF/FromSNF, ToRate/FromRate.</Text>
            <Button fullWidth onClick={() => setImportStatus('idle')}>Close</Button>
          </>
        )}
      </Stack>
    </Modal>
    </>
  );
}
