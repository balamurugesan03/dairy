/**
 * Milk Purchase → Can No
 * Sub centres bring their milk to the main centre in cans; each can is entered
 * here by Can No (instead of Farmer No) with its own test. Cans are not farmer
 * bills — the sub centre's farmers are billed from their own collections — so
 * the panel compares each sub centre's cans with those bills, and the server
 * turns the cans into the route's Milk Receipt for Milk Receipt & Shortage.
 * Keyboard: Can No ⏎ (sub centre filled from the can's last use) → Qty → FAT → CLR → SNF ⏎ save.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Group, Text, TextInput, Select, Button, Table, ScrollArea, ActionIcon, Badge, Card, Loader, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconEdit, IconTrash, IconDeviceFloppy, IconX, IconBucket } from '@tabler/icons-react';
import { milkCanAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import { POPUP_CHILD_Z } from '../../utils/milkPopup';

const EMPTY = { canNumber: '', centre: '', qty: '', fat: '', clr: '', snf: '' };
const n2 = (v) => (Number(v) || 0).toFixed(2);
const n3 = (v) => (Number(v) || 0).toFixed(3);
// Same SNF-from-CLR formula as Milk Purchase
const autoSnf = (fat, clr) => (clr ? (clr / 4 + 0.2 * fat + 0.5) : 0);
const decimalOnly = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

const STATUS_COLOR = { Shortage: 'red', Excess: 'orange', OK: 'green', 'Awaiting Data': 'gray' };
const th = { fontSize: 11, fontWeight: 700, color: '#1e3a8a', background: '#e0ecff', whiteSpace: 'nowrap', padding: '5px 8px' };
const td = { fontSize: 12, padding: '4px 8px', whiteSpace: 'nowrap' };
const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const Field = ({ label, children, w }) => (
  <Box style={{ flex: w ? `0 0 ${w}px` : 1, minWidth: 0 }}>
    <Text size="10px" fw={700} c="#64748b" mb={4} tt="uppercase" style={{ letterSpacing: '0.4px' }}>{label}</Text>
    {children}
  </Box>
);

const inputStyle = { input: { fontWeight: 800, border: '1.5px solid #bfdbfe', fontSize: 14 } };

export default function CanEntryPanel({ date, shift, centres = [], active = true }) {
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [data, setData] = useState({ cans: [], centres: [], total: null });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canRef = useRef(null);
  const centreRef = useRef(null);
  const qtyRef = useRef(null);
  const fatRef = useRef(null);
  const clrRef = useRef(null);
  const snfRef = useRef(null);

  const dateStr = localDateStr(date);
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await milkCanAPI.getAll({ date: dateStr, shift });
      setData(res.data || { cans: [], centres: [], total: null });
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Could not load cans' });
    } finally {
      setLoading(false);
    }
  }, [dateStr, shift]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (active) setTimeout(() => canRef.current?.focus(), 60); }, [active, dateStr, shift]);

  const reset = () => {
    setForm(f => ({ ...EMPTY, centre: f.centre }));   // keep the sub centre for the next can
    setEditingId(null);
    setTimeout(() => canRef.current?.focus(), 30);
  };

  // Can No ⏎ → sub centre from the can's last use, then Qty
  const onCanEnter = async () => {
    const canNumber = form.canNumber.trim().toUpperCase();
    if (!canNumber) return;
    const dup = data.cans.find(c => c.canNumber === canNumber && c._id !== editingId);
    if (dup) {
      notifications.show({ color: 'orange', message: `Can ${canNumber} is already entered for this shift — edit it from the list` });
      return;
    }
    try {
      const res = await milkCanAPI.lookup(canNumber);
      const last = res.data?.centre && String(res.data.centre);
      if (last && centres.some(c => c.value === last)) {
        setForm(f => ({ ...f, canNumber, centre: last }));
        qtyRef.current?.focus();
        return;
      }
    } catch { /* lookup is only a convenience */ }
    setForm(f => ({ ...f, canNumber }));
    (form.centre ? qtyRef : centreRef).current?.focus();
  };

  const save = async () => {
    if (saving) return;
    const fat = parseFloat(form.fat) || 0;
    const clr = parseFloat(form.clr) || 0;
    const payload = {
      date: dateStr,
      shift,
      canNumber: form.canNumber.trim(),
      centre: form.centre,
      qty: parseFloat(form.qty) || 0,
      fat,
      clr,
      snf: parseFloat(form.snf) || autoSnf(fat, clr),
    };
    if (!payload.canNumber) { canRef.current?.focus(); return; }
    if (!payload.centre) { centreRef.current?.focus(); return; }
    if (!(payload.qty > 0)) { qtyRef.current?.focus(); return; }
    setSaving(true);
    try {
      const res = editingId ? await milkCanAPI.update(editingId, payload) : await milkCanAPI.create(payload);
      notifications.show({ color: 'green', message: res.message || 'Saved', autoClose: 1500 });
      (res.warnings || []).forEach(w => notifications.show({ color: 'orange', message: w, autoClose: 7000 }));
      reset();
      load();
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const edit = (c) => {
    setEditingId(c._id);
    setForm({
      canNumber: c.canNumber, centre: String(c.centre),
      qty: String(c.qty ?? ''), fat: String(c.fat ?? ''), clr: c.clr ? String(c.clr) : '', snf: c.snf ? String(c.snf) : '',
    });
    setTimeout(() => qtyRef.current?.focus(), 30);
  };

  const remove = (c) => modals.openConfirmModal({
    title: `Delete Can ${c.canNumber}?`,
    children: <Text size="sm">{c.centreName} · {n2(c.qty)} L</Text>,
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    zIndex: POPUP_CHILD_Z,
    onConfirm: async () => {
      try {
        await milkCanAPI.delete(c._id);
        if (editingId === c._id) reset();
        load();
      } catch (err) {
        notifications.show({ color: 'red', message: err.message || 'Delete failed' });
      }
    },
  });

  // Enter moves to the next field; on SNF it saves
  const next = (ref) => (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (ref) ref.current?.focus(); else save();
  };

  const fatNum = parseFloat(form.fat) || 0;
  const clrNum = parseFloat(form.clr) || 0;
  const snfShown = form.snf || (clrNum ? autoSnf(fatNum, clrNum).toFixed(2) : '');
  const qtyNum = parseFloat(form.qty) || 0;

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, padding: '6px 10px', gap: 8 }}>
      {!active && (
        <Box style={{ background: '#eff6ff', border: '1.5px dashed #93c5fd', borderRadius: 8, padding: '6px 14px', flexShrink: 0 }}>
          <Text size="11px" fw={700} c="#1e40af" ta="center">Select date &amp; shift above, then click <b>OK</b> to enter cans.</Text>
        </Box>
      )}
      {/* ── Entry ── */}
      <Card shadow="xs" radius="lg" withBorder style={{ flexShrink: 0, borderColor: '#bfdbfe', borderTop: '3px solid #0891b2', padding: '8px 12px', opacity: active ? 1 : 0.4, pointerEvents: active ? 'all' : 'none' }}>
        <Group gap={6} mb={6}>
          <Box style={{ background: '#cffafe', borderRadius: 7, padding: '4px 6px' }}><IconBucket size={15} color="#0891b2" /></Box>
          <Text size="12px" fw={800} c="#155e75" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
            {editingId ? 'Edit Can' : 'Sub Centre Can Entry'}
          </Text>
          <Text size="11px" c="#64748b">— cans brought from sub centres; their farmers are billed from the sub centre's own entries</Text>
        </Group>
        <Group gap={8} wrap="nowrap" align="flex-end">
          <Field label="Can No" w={110}>
            <TextInput
              ref={canRef} placeholder="Can..." value={form.canNumber}
              onChange={e => set('canNumber')(e.currentTarget.value.toUpperCase().replace(/[^0-9A-Z/-]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCanEnter(); } }}
              size="sm" radius="md" styles={inputStyle}
            />
          </Field>
          <Field label="Sub Centre" w={200}>
            <Select
              ref={centreRef} data={centres} value={form.centre || null} searchable placeholder="Sub centre..."
              onChange={v => { set('centre')(v || ''); if (v) setTimeout(() => qtyRef.current?.focus(), 30); }}
              comboboxProps={{ zIndex: POPUP_CHILD_Z }}
              size="sm" radius="md" styles={{ input: { fontWeight: 700, border: '1.5px solid #bfdbfe' } }}
            />
          </Field>
          <Field label="Qty (L)" w={100}>
            <TextInput ref={qtyRef} inputMode="decimal" value={form.qty} onChange={e => set('qty')(decimalOnly(e.currentTarget.value))} onKeyDown={next(fatRef)} size="sm" radius="md" styles={inputStyle} />
          </Field>
          <Field label="FAT %" w={80}>
            <TextInput ref={fatRef} inputMode="decimal" value={form.fat} onChange={e => set('fat')(decimalOnly(e.currentTarget.value))} onKeyDown={next(clrRef)} size="sm" radius="md" styles={inputStyle} />
          </Field>
          <Field label="CLR" w={80}>
            <TextInput ref={clrRef} inputMode="decimal" value={form.clr} onChange={e => set('clr')(decimalOnly(e.currentTarget.value))} onKeyDown={next(snfRef)} size="sm" radius="md" styles={inputStyle} />
          </Field>
          <Field label="SNF %" w={80}>
            <TextInput ref={snfRef} inputMode="decimal" value={form.snf} placeholder={snfShown} onChange={e => set('snf')(decimalOnly(e.currentTarget.value))} onKeyDown={next(null)} size="sm" radius="md" styles={inputStyle} />
          </Field>
          <Field label="FAT kg / SNF kg" w={120}>
            <Text size="13px" fw={700} c="#0f766e" style={{ lineHeight: '36px' }}>
              {n3(qtyNum * fatNum / 100)} / {n3(qtyNum * (parseFloat(snfShown) || 0) / 100)}
            </Text>
          </Field>
          <Button leftSection={<IconDeviceFloppy size={15} />} onClick={save} loading={saving} color="cyan" size="sm" radius="md">
            {editingId ? 'Update' : 'Save'}
          </Button>
          {(editingId || form.canNumber) && (
            <Button leftSection={<IconX size={14} />} variant="light" color="gray" size="sm" radius="md" onClick={() => { setForm(EMPTY); setEditingId(null); canRef.current?.focus(); }}>
              Clear
            </Button>
          )}
        </Group>
      </Card>

      <Box style={{ flex: 1, display: 'flex', gap: 10, minHeight: 0 }}>
        {/* ── Cans of this shift ── */}
        <Card withBorder radius="md" style={{ flex: '1 1 52%', display: 'flex', flexDirection: 'column', padding: 0, minHeight: 0 }}>
          <Group justify="space-between" style={{ padding: '6px 10px', borderBottom: '1px solid #dbeafe' }}>
            <Text size="12px" fw={800} c="#1e3a8a">Cans — {date.toLocaleDateString('en-GB')} {shift}</Text>
            {loading ? <Loader size={14} /> : <Badge size="sm" variant="light">{data.cans.length} cans</Badge>}
          </Group>
          <ScrollArea style={{ flex: 1 }}>
            <Table striped highlightOnHover withColumnBorders stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={th}>#</Table.Th>
                  <Table.Th style={th}>Can No</Table.Th>
                  <Table.Th style={th}>Sub Centre</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>Qty</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>FAT</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>CLR</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>SNF</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>FAT kg</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>SNF kg</Table.Th>
                  <Table.Th style={th} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.cans.map((c, i) => (
                  <Table.Tr key={c._id} style={{ background: editingId === c._id ? '#fef9c3' : undefined }}>
                    <Table.Td style={td}>{i + 1}</Table.Td>
                    <Table.Td style={{ ...td, fontWeight: 800, color: '#0e7490' }}>{c.canNumber}</Table.Td>
                    <Table.Td style={td}>{c.centreName}</Table.Td>
                    <Table.Td style={num}>{n2(c.qty)}</Table.Td>
                    <Table.Td style={num}>{n2(c.fat)}</Table.Td>
                    <Table.Td style={num}>{c.clr ? n2(c.clr) : '—'}</Table.Td>
                    <Table.Td style={num}>{n2(c.snf)}</Table.Td>
                    <Table.Td style={num}>{n3(c.fatKg)}</Table.Td>
                    <Table.Td style={num}>{n3(c.snfKg)}</Table.Td>
                    <Table.Td style={td}>
                      <Group gap={2} wrap="nowrap">
                        <ActionIcon size="sm" variant="subtle" color="blue" onClick={() => edit(c)}><IconEdit size={14} /></ActionIcon>
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={() => remove(c)}><IconTrash size={14} /></ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!data.cans.length && (
                  <Table.Tr><Table.Td colSpan={10} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 18 }}>No cans entered for this shift</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
              {data.total && data.cans.length > 0 && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#1e3a8a' }}>
                    <Table.Td colSpan={3} style={{ ...td, color: 'white', fontWeight: 800 }}>Total</Table.Td>
                    <Table.Td style={{ ...num, color: 'white', fontWeight: 800 }}>{n2(data.total.qty)}</Table.Td>
                    <Table.Td style={{ ...num, color: 'white', fontWeight: 800 }}>{n2(data.total.fat)}</Table.Td>
                    <Table.Td style={{ ...num, color: 'white', fontWeight: 800 }}>{data.total.clr ? n2(data.total.clr) : '—'}</Table.Td>
                    <Table.Td style={{ ...num, color: 'white', fontWeight: 800 }}>{n2(data.total.snf)}</Table.Td>
                    <Table.Td style={{ ...num, color: 'white', fontWeight: 800 }}>{n3(data.total.fatKg)}</Table.Td>
                    <Table.Td style={{ ...num, color: 'white', fontWeight: 800 }}>{n3(data.total.snfKg)}</Table.Td>
                    <Table.Td style={td} />
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </ScrollArea>
        </Card>

        {/* ── Sub centre: cans received vs sub centre's farmer bills ── */}
        <Card withBorder radius="md" style={{ flex: '1 1 48%', display: 'flex', flexDirection: 'column', padding: 0, minHeight: 0 }}>
          <Box style={{ padding: '6px 10px', borderBottom: '1px solid #dbeafe' }}>
            <Text size="12px" fw={800} c="#1e3a8a">Sub Centre — Cans Received vs Farmer Bills</Text>
          </Box>
          <ScrollArea style={{ flex: 1 }}>
            <Table withColumnBorders stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={th}>Sub Centre</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>Cans</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>Can Qty</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>Bill Qty</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>Diff Qty</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>Diff FAT kg</Table.Th>
                  <Table.Th style={{ ...th, textAlign: 'right' }}>Diff SNF kg</Table.Th>
                  <Table.Th style={th}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.centres.map(c => {
                  const neg = (v) => ({ ...num, color: v < 0 ? '#dc2626' : v > 0 ? '#c2410c' : undefined, fontWeight: 700 });
                  return (
                    <Table.Tr key={c.centreId}>
                      <Table.Td style={td}>
                        <Text size="12px" fw={700}>{c.centreName}</Text>
                        {c.note && <Text size="10px" c="orange.8">{c.note}</Text>}
                      </Table.Td>
                      <Table.Td style={num}>{c.cans}</Table.Td>
                      <Table.Td style={num}>{n2(c.received.qty)}</Table.Td>
                      <Table.Td style={num}>{c.expected.qty ? n2(c.expected.qty) : '—'}</Table.Td>
                      <Table.Td style={c.diff ? neg(c.diff.qty) : num}>{c.diff ? n2(c.diff.qty) : '—'}</Table.Td>
                      <Table.Td style={c.diff ? neg(c.diff.fatKg) : num}>{c.diff ? n3(c.diff.fatKg) : '—'}</Table.Td>
                      <Table.Td style={c.diff ? neg(c.diff.snfKg) : num}>{c.diff ? n3(c.diff.snfKg) : '—'}</Table.Td>
                      <Table.Td style={td}>
                        <Tooltip label="Sub centre's farmer entries for this shift are not imported yet" disabled={c.status !== 'Awaiting Data'} withinPortal zIndex={POPUP_CHILD_Z}>
                          <Badge size="sm" color={STATUS_COLOR[c.status] || 'gray'} variant="light">{c.status}</Badge>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {!data.centres.length && (
                  <Table.Tr><Table.Td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 18 }}>—</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <Text size="10px" c="#64748b" style={{ padding: '4px 10px', borderTop: '1px solid #e2e8f0' }}>
            Cans also appear in Milk Receipt &amp; Shortage (route-wise). They are not farmer bills, so they don't change milk purchase totals, producer dues or union send qty.
          </Text>
        </Card>
      </Box>
    </Box>
  );
}
