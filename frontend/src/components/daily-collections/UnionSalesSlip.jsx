/**
 * UnionSalesSlip.jsx — redesigned like MilkPurchase (card-based, keyboard-first)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Group, Stack, Text, Badge, Button, ActionIcon,
  NumberInput, TextInput, Table, ScrollArea, Loader, Center, Checkbox,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus, IconEdit, IconX, IconSearch, IconRefresh,
  IconTrash, IconPrinter, IconMilk, IconFilter,
  IconDeviceFloppy, IconCheck,
} from '@tabler/icons-react';
import { unionSalesSlipAPI } from '../../services/api';
import dayjs from 'dayjs';

/* ── small helpers ─────────────────────────────────────────────────────────── */
const fmt2 = v => parseFloat(v || 0).toFixed(2);
const fmt3 = v => parseFloat(v || 0).toFixed(3);
const fmtInr = v => `₹${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/* ── Session Pill ──────────────────────────────────────────────────────────── */
const SessionPill = ({ label, active, onClick }) => (
  <Box
    onClick={onClick}
    style={{
      cursor: 'pointer', userSelect: 'none',
      padding: '3px 14px', borderRadius: 4,
      fontWeight: 800, fontSize: 12,
      background: active
        ? (label === 'AM' ? '#fef08a' : '#c7d2fe')
        : 'rgba(255,255,255,0.12)',
      border: `2px solid ${active ? (label === 'AM' ? '#ca8a04' : '#4338ca') : 'rgba(255,255,255,0.25)'}`,
      color: active ? (label === 'AM' ? '#713f12' : '#1e1b4b') : 'white',
      transition: 'all 0.12s',
    }}
  >
    {label === 'AM' ? '☀ AM' : '🌙 PM'}
  </Box>
);

/* ── AvgCard ───────────────────────────────────────────────────────────────── */
const AvgCard = ({ label, value, unit, color }) => (
  <Box style={{
    flex: 1, textAlign: 'center', padding: '3px 6px',
    background: 'rgba(255,255,255,0.15)',
    border: '1.5px solid rgba(255,255,255,0.25)',
    borderRadius: 5,
  }}>
    <Text style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</Text>
    <Text style={{ fontSize: 13, fontWeight: 900, color, lineHeight: 1.15 }}>{value ?? '—'}</Text>
    {unit && <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)' }}>{unit}</Text>}
  </Box>
);

/* ── SummaryChip ───────────────────────────────────────────────────────────── */
const SummaryChip = ({ label, value, color, border }) => (
  <Box style={{
    padding: '5px 18px', borderRadius: 6, textAlign: 'center',
    background: 'rgba(255,255,255,0.12)',
    border: `2px solid ${border || 'rgba(255,255,255,0.2)'}`,
  }}>
    <Text style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</Text>
    <Text style={{ fontSize: 16, fontWeight: 900, color: color || 'white', lineHeight: 1.2 }}>{value}</Text>
  </Box>
);

/* ── TableBtn ──────────────────────────────────────────────────────────────── */
const TableBtn = ({ icon, label, onClick, color = '#fff', bg = 'rgba(255,255,255,0.09)', border = 'rgba(255,255,255,0.2)', loading: ld, badge }) => (
  <Box style={{ position: 'relative', display: 'inline-flex' }}>
    <Button
      size="xs"
      leftSection={icon}
      onClick={onClick}
      loading={ld}
      style={{
        height: 26, padding: '0 10px', fontSize: 10, fontWeight: 700,
        background: bg, border: `1.5px solid ${border}`,
        color, letterSpacing: '0.1px',
      }}
    >
      {label}
    </Button>
    {badge && (
      <Box style={{
        position: 'absolute', top: -5, right: -5,
        background: '#ef4444', color: 'white',
        borderRadius: 9, fontSize: 8, fontWeight: 800,
        padding: '0 4px', lineHeight: '14px', minWidth: 14, textAlign: 'center',
      }}>{badge}</Box>
    )}
  </Box>
);

const months = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - 2 + i;
  return { value: String(y), label: String(y) };
});

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function UnionSalesSlip() {

  /* ── form state ── */
  const initForm = () => ({
    date: new Date(), time: 'AM',
    qty: '', fat: '', snf: '',
    rate: '', spoilage: false, unionSpoilage: '', transportationSpoilage: '',
  });
  const [form, setForm] = useState(initForm());
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  /* auto-calc amount */
  const amount = parseFloat(
    ((parseFloat(form.qty) || 0) * (parseFloat(form.rate) || 0)).toFixed(2)
  );

  /* ── edit / UI state ── */
  const [editingId,    setEditingId]    = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showSearch,   setShowSearch]   = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selRow,       setSelRow]       = useState(null);

  /* ── table / filter state ── */
  const [entries,  setEntries]  = useState([]);
  const [totals,   setTotals]   = useState({ totalQty: 0, totalAmount: 0, totalUnionSpoilage: 0, totalTransportationSpoilage: 0 });
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear,  setFilterYear]  = useState(String(new Date().getFullYear()));

  /* ── refs for keyboard nav ── */
  const qtyRef  = useRef(null);
  const fatRef  = useRef(null);
  const snfRef  = useRef(null);
  const rateRef = useRef(null);
  const uSpoilRef = useRef(null);
  const tSpoilRef = useRef(null);

  /* focus helper */
  const focusRef = r => setTimeout(() => r?.current?.querySelector?.('input')?.focus(), 30);

  /* Tab → Enter navigation */
  const moveOn = nextRef => e => {
    if (e.key === 'Enter') { e.preventDefault(); focusRef(nextRef); }
  };

  /* ── load entries ── */
  const loadEntries = useCallback(async (month = filterMonth, year = filterYear) => {
    setLoading(true);
    try {
      const res = await unionSalesSlipAPI.getAll({ month, year, limit: 200, sortField: 'date', sortOrder: 'desc' });
      setEntries(res?.data || []);
      setTotals(res?.totals || { totalQty: 0, totalAmount: 0, totalUnionSpoilage: 0, totalTransportationSpoilage: 0 });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to load' });
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear]);

  useEffect(() => { loadEntries(); }, []); // eslint-disable-line

  /* ── filtered rows ── */
  const filteredEntries = historySearch.trim()
    ? entries.filter(e =>
        (e.slipNo || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        dayjs(e.date).format('DD MMM YYYY').toLowerCase().includes(historySearch.toLowerCase()) ||
        (e.time || '').toLowerCase().includes(historySearch.toLowerCase())
      )
    : entries;

  /* ── clear / new ── */
  const handleClear = () => {
    setForm(initForm());
    setEditingId(null);
    setSelRow(null);
  };

  /* ── save / update ── */
  const handleSave = async () => {
    const f = formRef.current;
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

  /* Enter on last field → save */
  const handleLastEnter = e => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
  };

  /* ── edit row ── */
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

  /* ── delete ── */
  const handleDelete = (row) => {
    const r = row || selRow;
    if (!r) return notifications.show({ color: 'yellow', message: 'Select a row to delete' });
    modals.openConfirmModal({
      title: 'Delete Record',
      children: (
        <Text size="sm">
          Delete slip <b>{r.slipNo}</b> for <b>{dayjs(r.date).format('DD MMM YYYY')}</b> - <b>{r.time}</b>?
        </Text>
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

  /* ── print slip ── */
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

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <Box style={{
      background: 'linear-gradient(150deg,#e8f5e9 0%,#c8e6c9 45%,#f1f8e9 100%)',
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
    }}>

      {/* ══ HEADER BAR ═════════════════════════════════════════════════════════ */}
      <Box style={{
        background: 'linear-gradient(135deg,#1b5e20 0%,#2e7d32 60%,#388e3c 100%)',
        flexShrink: 0, padding: '7px 16px',
        boxShadow: '0 3px 14px rgba(0,0,0,0.35)',
      }}>
        <Group justify="space-between" align="center">

          {/* Logo + Title */}
          <Group gap={10} align="center">
            <Box style={{
              background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)',
              borderRadius: 7, padding: '5px 8px', display: 'flex', alignItems: 'center',
            }}>
              <IconMilk size={18} color="white" />
            </Box>
            <Stack gap={0}>
              <Group gap={8} align="center">
                <Text style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: '2px', lineHeight: 1 }}>
                  UNION SALES SLIP
                </Text>
                {editingId && (
                  <Badge size="xs" color="orange" variant="filled" style={{ fontSize: 8, letterSpacing: '0.5px' }}>
                    EDIT MODE
                  </Badge>
                )}
              </Group>
              <Text size="8px" c="rgba(255,255,255,0.5)" style={{ letterSpacing: '1px' }}>
                MILK SOCIETY MANAGEMENT SYSTEM
              </Text>
            </Stack>
          </Group>

          {/* Date + Session */}
          <Group gap={14} align="center">
            <DatePickerInput
              value={form.date}
              onChange={d => d && setField('date', d)}
              valueFormat="DD MMM YYYY"
              size="xs"
              styles={{
                input: {
                  height: 28, fontSize: 12, fontWeight: 700,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  color: 'white', borderRadius: 5, width: 120,
                },
              }}
            />
            <Group gap={5}>
              <SessionPill label="AM" active={form.time === 'AM'} onClick={() => setField('time', 'AM')} />
              <SessionPill label="PM" active={form.time === 'PM'} onClick={() => setField('time', 'PM')} />
            </Group>
            <Box style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)' }} />
            <Group gap={6}>
              <Button
                size="xs"
                leftSection={<IconDeviceFloppy size={13} />}
                loading={saving}
                onClick={handleSave}
                style={{
                  height: 30, padding: '0 14px', fontSize: 11, fontWeight: 800,
                  background: editingId ? '#d97706' : '#16a34a',
                  border: 'none', color: 'white', letterSpacing: '0.3px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                {editingId ? 'Update' : 'Save'}
              </Button>
              <Button
                size="xs"
                leftSection={<IconX size={12} />}
                onClick={handleClear}
                style={{
                  height: 30, padding: '0 12px', fontSize: 11, fontWeight: 700,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  color: 'white',
                }}
              >
                Clear
              </Button>
            </Group>
          </Group>
        </Group>
      </Box>

      {/* ══ CARDS ══════════════════════════════════════════════════════════════ */}
      <Box style={{ flexShrink: 0, padding: '5px 12px 4px', display: 'flex', gap: 7 }}>

        {/* Card 1 — Slip Info (blue) */}
        <Box style={{
          background: 'linear-gradient(135deg,#1565c0 0%,#1976d2 100%)',
          borderRadius: 8, padding: '6px 10px', flexShrink: 0, width: 160,
          boxShadow: '0 2px 8px rgba(21,101,192,0.3)',
        }}>
          <Text style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>
            Slip Info
          </Text>
          <Stack gap={4}>
            <Box>
              <Text style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Slip No</Text>
              <Text style={{ fontSize: 12, fontWeight: 900, color: '#bfdbfe', fontFamily: 'monospace', lineHeight: 1.2 }}>
                {selRow?.slipNo || (editingId ? '—' : 'AUTO')}
              </Text>
            </Box>
            <Box>
              <Text style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Date</Text>
              <Text style={{ fontSize: 11, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                {dayjs(form.date).format('DD MMM YYYY')}
              </Text>
            </Box>
            <Box style={{
              display: 'inline-flex', alignItems: 'center',
              background: form.time === 'AM' ? 'rgba(254,240,138,0.22)' : 'rgba(199,210,254,0.22)',
              border: `1.5px solid ${form.time === 'AM' ? 'rgba(202,138,4,0.45)' : 'rgba(67,56,202,0.45)'}`,
              borderRadius: 4, padding: '2px 8px',
            }}>
              <Text style={{ fontSize: 10, fontWeight: 800, color: form.time === 'AM' ? '#fef08a' : '#c7d2fe' }}>
                {form.time === 'AM' ? '☀ AM' : '🌙 PM'}
              </Text>
            </Box>
          </Stack>
        </Box>

        {/* Card 2 — Qty & Quality (green) */}
        <Box style={{
          background: 'linear-gradient(135deg,#14532d 0%,#166534 100%)',
          borderRadius: 8, padding: '6px 10px', flex: 1,
          boxShadow: '0 2px 8px rgba(20,83,45,0.3)',
        }}>
          <Text style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>
            Milk Quantity &amp; Quality
          </Text>
          <Group gap={8} align="flex-start">
            <Box ref={qtyRef} style={{ flex: 1.3 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>Qty (L)</Text>
              <NumberInput
                placeholder="0.000"
                value={form.qty === '' ? '' : parseFloat(form.qty)}
                onChange={v => setField('qty', String(v ?? ''))}
                min={0} decimalScale={3} step={0.5}
                styles={{
                  input: { height: 34, fontSize: 15, fontWeight: 800, background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.22)', color: '#86efac', borderRadius: 5, textAlign: 'center' },
                }}
                onKeyDown={moveOn(fatRef)}
              />
            </Box>
            <Box ref={fatRef} style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>FAT</Text>
              <NumberInput
                placeholder="0.0"
                value={form.fat === '' ? '' : parseFloat(form.fat)}
                onChange={v => setField('fat', String(v ?? ''))}
                min={0} decimalScale={1}
                styles={{
                  input: { height: 34, fontSize: 15, fontWeight: 800, background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.22)', color: '#86efac', borderRadius: 5, textAlign: 'center' },
                }}
                onKeyDown={moveOn(snfRef)}
              />
            </Box>
            <Box ref={snfRef} style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>SNF</Text>
              <NumberInput
                placeholder="0.0"
                value={form.snf === '' ? '' : parseFloat(form.snf)}
                onChange={v => setField('snf', String(v ?? ''))}
                min={0} decimalScale={1}
                styles={{
                  input: { height: 34, fontSize: 15, fontWeight: 800, background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.22)', color: '#86efac', borderRadius: 5, textAlign: 'center' },
                }}
                onKeyDown={moveOn(rateRef)}
              />
            </Box>

            {/* Monthly Totals mini tiles */}
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 190 }}>
              <Text style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Totals</Text>
              <Group gap={5} grow>
                <AvgCard label="Qty" value={fmt3(totals.totalQty)} unit="L" color="#86efac" />
                <AvgCard label="FAT" value="—" unit="" color="#fde68a" />
                <AvgCard label="SNF" value="—" unit="" color="#bfdbfe" />
              </Group>
            </Box>
          </Group>
        </Box>

        {/* Card 3 — Rate & Spoilage (amber) */}
        <Box style={{
          background: 'linear-gradient(135deg,#92400e 0%,#b45309 100%)',
          borderRadius: 8, padding: '6px 10px', flexShrink: 0, width: 280,
          boxShadow: '0 2px 8px rgba(146,64,14,0.3)',
        }}>
          <Text style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>
            Rate &amp; Spoilage
          </Text>

          {/* Rate row */}
          <Group gap={8} align="flex-end" mb={5}>
            <Box ref={rateRef} style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>Rate ₹/L</Text>
              <NumberInput
                placeholder="0.00"
                value={form.rate === '' ? '' : parseFloat(form.rate)}
                onChange={v => setField('rate', String(v ?? ''))}
                min={0} decimalScale={2}
                styles={{
                  input: { height: 34, fontSize: 14, fontWeight: 800, background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.22)', color: '#fde68a', borderRadius: 5, textAlign: 'center' },
                }}
                onKeyDown={moveOn(uSpoilRef)}
              />
            </Box>
            {/* Amount display */}
            <Box style={{ flex: 1.2 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>Amount</Text>
              <Box style={{
                height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,193,7,0.45)',
                borderRadius: 5, fontSize: 16, fontWeight: 900, color: '#fbbf24',
              }}>
                {fmtInr(amount)}
              </Box>
            </Box>
          </Group>

          {/* Spoilage toggle + inputs */}
          <Group gap={6} align="flex-end">
            {/* Tick */}
            <Box style={{ flexShrink: 0, paddingBottom: 4 }}>
              <Text style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Spoilage</Text>
              <Checkbox
                checked={form.spoilage}
                onChange={e => setField('spoilage', e.currentTarget.checked)}
                label={<Text style={{ fontSize: 10, fontWeight: 700, color: form.spoilage ? '#86efac' : 'rgba(255,255,255,0.4)' }}>{form.spoilage ? 'Yes' : 'No'}</Text>}
                size="sm"
                color="green"
                styles={{
                  input: { background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.3)', cursor: 'pointer' },
                }}
              />
            </Box>

            <Box ref={uSpoilRef} style={{ flex: 1 }}>
              <Text style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>Union Spoilage</Text>
              <NumberInput
                placeholder="0.00"
                value={form.unionSpoilage === '' ? '' : parseFloat(form.unionSpoilage)}
                onChange={v => setField('unionSpoilage', String(v ?? ''))}
                min={0} decimalScale={2}
                disabled={!form.spoilage}
                styles={{
                  input: { height: 26, fontSize: 12, fontWeight: 700, background: form.spoilage ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${form.spoilage ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`, color: '#fca5a5', borderRadius: 4, textAlign: 'center', opacity: form.spoilage ? 1 : 0.4 },
                }}
                onKeyDown={moveOn(tSpoilRef)}
              />
            </Box>
            <Box ref={tSpoilRef} style={{ flex: 1 }}>
              <Text style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>Trans. Spoilage</Text>
              <NumberInput
                placeholder="0.00"
                value={form.transportationSpoilage === '' ? '' : parseFloat(form.transportationSpoilage)}
                onChange={v => setField('transportationSpoilage', String(v ?? ''))}
                min={0} decimalScale={2}
                disabled={!form.spoilage}
                styles={{
                  input: { height: 26, fontSize: 12, fontWeight: 700, background: form.spoilage ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${form.spoilage ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`, color: '#fca5a5', borderRadius: 4, textAlign: 'center', opacity: form.spoilage ? 1 : 0.4 },
                }}
                onKeyDown={handleLastEnter}
              />
            </Box>
          </Group>
        </Box>

      </Box>

      {/* ══ TABLE ACTION BAR ════════════════════════════════════════════════════ */}
      <Box style={{
        background: 'linear-gradient(90deg,#14532d 0%,#166534 100%)',
        flexShrink: 0, padding: '5px 12px',
        borderTop: '2px solid rgba(255,255,255,0.08)',
      }}>
        <Group justify="space-between" align="center">
          <Group gap={4}>
            <TableBtn
              icon={<IconPlus size={11} />}
              label="New"
              onClick={handleClear}
              bg="rgba(255,255,255,0.1)"
              border="rgba(255,255,255,0.2)"
            />
            <TableBtn
              icon={<IconEdit size={11} />}
              label={editingId ? 'EDIT MODE' : 'Edit'}
              onClick={() => handleEdit(null)}
              bg={editingId ? 'rgba(217,119,6,0.4)' : 'rgba(255,255,255,0.1)'}
              border={editingId ? '#d97706' : 'rgba(255,255,255,0.2)'}
            />
            <TableBtn
              icon={<IconX size={11} />}
              label={editingId ? 'Cancel Edit' : 'Clear'}
              onClick={handleClear}
              bg="rgba(255,255,255,0.08)"
              border="rgba(255,255,255,0.18)"
            />
            <Box style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
            <TableBtn
              icon={<IconSearch size={11} />}
              label="Search"
              onClick={() => setShowSearch(s => !s)}
              bg={showSearch ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}
              border={showSearch ? '#8b5cf6' : 'rgba(255,255,255,0.18)'}
              badge={showSearch && historySearch ? filteredEntries.length : null}
            />
            <TableBtn
              icon={<IconRefresh size={11} />}
              label="Refresh"
              onClick={() => loadEntries()}
              bg="rgba(255,255,255,0.08)"
              border="rgba(255,255,255,0.18)"
            />
            <Box style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
            {/* Month/Year filter inline */}
            <Group gap={4} align="center">
              <Text style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Month:</Text>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                style={{
                  height: 22, fontSize: 10, fontWeight: 600, borderRadius: 3,
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.1)', color: 'white',
                  padding: '0 4px', cursor: 'pointer',
                }}
              >
                {months.map(m => <option key={m.value} value={m.value} style={{ color: '#000', background: '#fff' }}>{m.label}</option>)}
              </select>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                style={{
                  height: 22, fontSize: 10, fontWeight: 600, borderRadius: 3,
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.1)', color: 'white',
                  padding: '0 4px', cursor: 'pointer',
                }}
              >
                {years.map(y => <option key={y.value} value={y.value} style={{ color: '#000', background: '#fff' }}>{y.label}</option>)}
              </select>
              <Button
                size="xs"
                leftSection={<IconFilter size={10} />}
                onClick={() => loadEntries(filterMonth, filterYear)}
                style={{ height: 22, padding: '0 10px', fontSize: 9, fontWeight: 800, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', color: 'white' }}
              >
                Go
              </Button>
            </Group>
            <Box style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
            <TableBtn
              icon={<IconPrinter size={11} />}
              label="Print"
              onClick={() => handlePrint(null)}
              bg="rgba(255,255,255,0.08)"
              border="rgba(255,255,255,0.18)"
            />
            <TableBtn
              icon={<IconTrash size={11} />}
              label="Delete"
              onClick={() => handleDelete(null)}
              bg="rgba(239,68,68,0.15)"
              border="rgba(239,68,68,0.35)"
              color="#fca5a5"
            />
          </Group>

          {/* Search input + count */}
          <Group gap={8} align="center">
            {showSearch && (
              <TextInput
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search slip / date…"
                size="xs"
                autoFocus
                leftSection={<IconSearch size={11} color="rgba(255,255,255,0.5)" />}
                rightSection={historySearch ? <IconX size={11} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }} onClick={() => setHistorySearch('')} /> : null}
                styles={{
                  root: { width: 190 },
                  input: { height: 24, fontSize: 11, background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.25)', color: 'white' },
                }}
              />
            )}
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {historySearch ? `${filteredEntries.length} / ${entries.length}` : entries.length} records
            </Text>
          </Group>
        </Group>
      </Box>

      {/* ══ TABLE ══════════════════════════════════════════════════════════════ */}
      <Box style={{ flex: 1, overflow: 'hidden', padding: '0 12px', minHeight: 0 }}>
        <Box style={{
          height: '100%', overflow: 'hidden',
          background: 'rgba(255,255,255,0.65)',
          border: '1.5px solid #81c784',
          borderRadius: 8,
          boxShadow: '0 1px 8px rgba(46,125,50,0.08)',
        }}>
          {loading ? (
            <Center h="100%">
              <Stack align="center" gap={6}>
                <Loader size="sm" color="green" />
                <Text size="10px" c="dimmed">Loading…</Text>
              </Stack>
            </Center>
          ) : (
            <ScrollArea h="100%" type="auto">
              <Table style={{ fontSize: 11, borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
                <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <Table.Tr style={{ background: 'linear-gradient(90deg,#1b5e20 0%,#2e7d32 100%)' }}>
                    {[
                      { label: '#',          w: '4%'  },
                      { label: 'Slip No',    w: '11%' },
                      { label: 'Date',       w: '10%' },
                      { label: 'Session',    w: '7%'  },
                      { label: 'Qty (L)',    w: '9%'  },
                      { label: 'FAT',        w: '6%'  },
                      { label: 'SNF',        w: '6%'  },
                      { label: 'Rate ₹',    w: '7%'  },
                      { label: 'Amount ₹', w: '11%' },
                      { label: 'Union Spg', w: '9%'  },
                      { label: 'Trans Spg', w: '9%'  },
                      { label: 'Actions',    w: '11%' },
                    ].map(col => (
                      <Table.Th key={col.label} style={{
                        width: col.w, padding: '7px 8px',
                        color: 'white', fontWeight: 700, fontSize: 9,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        borderBottom: '2px solid rgba(255,255,255,0.12)',
                        borderRight: '1px solid rgba(255,255,255,0.07)',
                        whiteSpace: 'nowrap',
                      }}>
                        {col.label}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {filteredEntries.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={12} style={{ textAlign: 'center', padding: 32 }}>
                        <Stack align="center" gap={6}>
                          <IconMilk size={28} style={{ color: '#9e9e9e', opacity: 0.4 }} />
                          <Text size="11px" c="dimmed">
                            {historySearch ? 'No records match your search.' : 'No slips found for this month.'}
                          </Text>
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  ) : filteredEntries.map((e, idx) => {
                    const isEditing = editingId === e._id;
                    const isSel = selRow?._id === e._id;
                    return (
                      <Table.Tr
                        key={e._id}
                        onClick={() => setSelRow(isSel ? null : e)}
                        style={{
                          cursor: 'pointer',
                          background: isEditing
                            ? '#fffbeb'
                            : isSel
                              ? 'rgba(46,125,50,0.1)'
                              : idx % 2 === 0 ? 'rgba(200,230,201,0.35)' : 'transparent',
                          borderLeft: isEditing ? '3px solid #d97706' : isSel ? '3px solid #2e7d32' : '3px solid transparent',
                        }}
                      >
                        <Table.Td style={{ padding: '4px 8px', color: '#9e9e9e', fontWeight: 600, fontSize: 10 }}>{idx + 1}</Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#1565c0', fontWeight: 700, fontFamily: 'monospace', fontSize: 10 }}>{e.slipNo}</Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#455a64', fontSize: 10 }}>{dayjs(e.date).format('DD MMM YYYY')}</Table.Td>
                        <Table.Td style={{ padding: '4px 8px' }}>
                          <Badge size="xs" color={e.time === 'AM' ? 'yellow' : 'indigo'} variant="light" style={{ fontSize: 8 }}>
                            {e.time === 'AM' ? '☀ AM' : '🌙 PM'}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#1565c0', fontWeight: 700, textAlign: 'right' }}>{fmt3(e.qty)}</Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#37474f', textAlign: 'right' }}>{fmt2(e.fat)}</Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#37474f', textAlign: 'right' }}>{fmt2(e.snf)}</Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#bf360c', textAlign: 'right' }}>{fmt2(e.rate)}</Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#1b5e20', fontWeight: 800, textAlign: 'right' }}>{fmtInr(e.amount)}</Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#880e4f', textAlign: 'right' }}>
                          {e.spoilage ? fmt2(e.unionSpoilage) : <Badge size="xs" color="gray" variant="dot" style={{ fontSize: 8 }}>—</Badge>}
                        </Table.Td>
                        <Table.Td style={{ padding: '4px 8px', color: '#880e4f', textAlign: 'right' }}>
                          {e.spoilage ? fmt2(e.transportationSpoilage) : <Badge size="xs" color="gray" variant="dot" style={{ fontSize: 8 }}>—</Badge>}
                        </Table.Td>
                        <Table.Td style={{ padding: '3px 6px' }}>
                          <Group gap={3} wrap="nowrap">
                            <ActionIcon
                              size={22} variant="light" color="orange"
                              onClick={ev => { ev.stopPropagation(); handleEdit(e); }}
                              title="Edit"
                            >
                              <IconEdit size={11} />
                            </ActionIcon>
                            <ActionIcon
                              size={22} variant="light" color="blue"
                              onClick={ev => { ev.stopPropagation(); handlePrint(e); }}
                              title="Print"
                            >
                              <IconPrinter size={11} />
                            </ActionIcon>
                            <ActionIcon
                              size={22} variant="light" color="red"
                              onClick={ev => { ev.stopPropagation(); handleDelete(e); }}
                              title="Delete"
                            >
                              <IconTrash size={11} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>

                {/* Totals footer row */}
                {filteredEntries.length > 0 && (
                  <Table.Tfoot>
                    <Table.Tr style={{ background: 'linear-gradient(90deg,#1b5e20,#2e7d32)', position: 'sticky', bottom: 0 }}>
                      <Table.Td colSpan={4} style={{ padding: '5px 8px', color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>
                        Totals ({filteredEntries.length})
                      </Table.Td>
                      <Table.Td style={{ padding: '5px 8px', color: '#86efac', fontWeight: 800, textAlign: 'right', fontSize: 11 }}>
                        {fmt3(totals.totalQty)}
                      </Table.Td>
                      <Table.Td colSpan={3} />
                      <Table.Td style={{ padding: '5px 8px', color: '#bbf7d0', fontWeight: 900, textAlign: 'right', fontSize: 12 }}>
                        {fmtInr(totals.totalAmount)}
                      </Table.Td>
                      <Table.Td style={{ padding: '5px 8px', color: '#fca5a5', fontWeight: 700, textAlign: 'right', fontSize: 11 }}>
                        {fmt2(totals.totalUnionSpoilage)}
                      </Table.Td>
                      <Table.Td style={{ padding: '5px 8px', color: '#fca5a5', fontWeight: 700, textAlign: 'right', fontSize: 11 }}>
                        {fmt2(totals.totalTransportationSpoilage)}
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  </Table.Tfoot>
                )}
              </Table>
            </ScrollArea>
          )}
        </Box>
      </Box>

      {/* ══ SUMMARY FOOTER ═════════════════════════════════════════════════════ */}
      <Box style={{
        background: 'linear-gradient(90deg,#1b5e20 0%,#2e7d32 50%,#1b5e20 100%)',
        flexShrink: 0, padding: '6px 16px',
        borderTop: '2px solid rgba(255,255,255,0.1)',
        boxShadow: '0 -3px 12px rgba(0,0,0,0.2)',
      }}>
        <Group justify="space-between" align="center">
          <Group gap={6}>
            <SummaryChip
              label="Total Qty"
              value={`${fmt3(totals.totalQty)} L`}
              color="#86efac"
              border="rgba(134,239,172,0.4)"
            />
            <SummaryChip
              label="Total Amount"
              value={fmtInr(totals.totalAmount)}
              color="#fbbf24"
              border="rgba(251,191,36,0.4)"
            />
            <SummaryChip
              label="Union Spoilage"
              value={fmt2(totals.totalUnionSpoilage)}
              color="#fca5a5"
              border="rgba(252,165,165,0.3)"
            />
            <SummaryChip
              label="Trans. Spoilage"
              value={fmt2(totals.totalTransportationSpoilage)}
              color="#fca5a5"
              border="rgba(252,165,165,0.3)"
            />
          </Group>

          {/* Status */}
          <Group gap={10} align="center">
            <Group gap={4} align="center">
              <Box style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                {editingId ? 'EDIT MODE' : 'NEW MODE'}
              </Text>
            </Group>
            {selRow && (
              <Badge size="xs" color="yellow" variant="light" style={{ fontSize: 8 }}>
                {selRow.slipNo}
              </Badge>
            )}
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
              {months.find(m => m.value === filterMonth)?.label} {filterYear}
            </Text>
          </Group>
        </Group>
      </Box>

    </Box>
  );
}
