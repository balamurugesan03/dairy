import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  Modal, Stack, Group, Text, Switch, TextInput, Paper, Badge, Button, Table, NumberInput, ActionIcon,
  Alert, Loader, Center, SimpleGrid, Tooltip, Checkbox,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconPlus, IconTrash, IconUpload, IconInfoCircle, IconBuildingStore, IconBuildingFactory2, IconCheck, IconPencil } from '@tabler/icons-react';
import { unionSalesSlipAPI } from '../../services/api';
import { findTsPeriod } from '../../utils/rateChart';
import { parseDateInput } from '../../utils/dateUtils';

const emptySide = { tsEnabled: false, fromDate: null };

// "TS Rate Settings (Society Name, State)" — read from the company configuration
// (Super Admin), never entered here
const tsTitle = (label) => `TS Rate Settings${label ? ` (${label})` : ''}`;

const emptyEntry = { fromDate: null, useToDate: false, toDate: null, tsRate: '', remarks: '' };
const fmt = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
const ymd = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : null);

/**
 * Union Sales → Settings
 *   From Dairy: its OWN TS rates (From Dairy TS Rates below) — never the Milk Purchase TS
 *               rate. Qty / FAT / SNF / TS come from the milk purchase data. Each rate is
 *               applied on its own (Apply); history is kept.
 *   To Dairy:   TS rates entered / uploaded here; Qty / FAT / SNF from the Union Sales slips.
 *   Both use the same TS formula: rate = (FAT + SNF) × TS rate ÷ 100.
 */
// Read-only dairy name + state, fetched from the existing configuration
function ConfiguredName({ side = {}, source }) {
  return (
    <Paper withBorder radius="sm" p="xs" bg="gray.0">
      <Group gap="lg" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed">Dairy</Text>
          <Text size="sm" fw={600}>{side.name ? `${side.code ? `${side.code} - ` : ''}${side.name}` : 'Not configured'}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">Region</Text>
          <Text size="sm" fw={600}>{side.region || '—'}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">State</Text>
          <Text size="sm" fw={600}>{side.state || '—'}</Text>
        </div>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>From: {source}</Text>
    </Paper>
  );
}

export default function UnionSaleSettingsModal({ opened, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromDairy, setFromDairy] = useState(emptySide);
  const [names, setNames] = useState({ fromDairy: {}, toDairy: {} }); // configured names (read-only)
  const [toDairy, setToDairy] = useState(emptySide);
  const [toRates, setToRates] = useState([]); // { fromDate, tsRate, remarks }
  const [fromRates, setFromRates] = useState([]); // saved From Dairy periods
  const [entry, setEntry] = useState(emptyEntry);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef(null);

  const loadFromRates = (d) => setFromRates((d?.fromDairy?.tsRates || []).map((r) => ({
    _id: r._id, fromDate: new Date(r.fromDate), toDate: r.toDate ? new Date(r.toDate) : null,
    useToDate: !!r.useToDate, tsRate: r.tsRate, remarks: r.remarks || '',
  })));

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    setEntry(emptyEntry);
    unionSalesSlipAPI.getSettings().catch(() => ({})).then((s) => {
      const d = s?.data || {};
      const side = (x = {}) => ({ tsEnabled: !!x.tsEnabled, fromDate: x.fromDate ? new Date(x.fromDate) : null });
      setNames(d.names || { fromDairy: {}, toDairy: {} });
      setFromDairy(side(d.fromDairy));
      setToDairy(side(d.toDairy));
      setToRates((d.toDairy?.tsRates || []).map((r) => ({ fromDate: new Date(r.fromDate), tsRate: r.tsRate, remarks: r.remarks || '' })));
      loadFromRates(d);
    }).finally(() => setLoading(false));
  }, [opened]);

  // ── From Dairy TS rates: Apply one period at a time (same From Date replaces it) ──
  const handleApply = async () => {
    if (!entry.fromDate) { notifications.show({ message: 'From Date is required', color: 'red' }); return; }
    if (entry.tsRate === '' || entry.tsRate === null || Number(entry.tsRate) < 0) {
      notifications.show({ message: 'Enter the TS Rate', color: 'red' }); return;
    }
    if (entry.useToDate) {
      if (!entry.toDate) { notifications.show({ message: 'Select the To Date, or untick "Use To Date"', color: 'red' }); return; }
      if (dayjs(entry.toDate).isBefore(dayjs(entry.fromDate), 'day')) {
        notifications.show({ message: 'To Date cannot be before From Date', color: 'red' }); return;
      }
    }
    setApplying(true);
    try {
      const res = await unionSalesSlipAPI.applyFromDairyRate({
        fromDate: ymd(entry.fromDate),
        useToDate: entry.useToDate,
        toDate: entry.useToDate ? ymd(entry.toDate) : null,
        tsRate: Number(entry.tsRate),
        remarks: entry.remarks,
      });
      loadFromRates(res?.data);
      setEntry(emptyEntry);
      notifications.show({ title: 'Applied', message: res?.message || `From Dairy TS rate ₹${Number(entry.tsRate).toFixed(2)} from ${fmt(entry.fromDate)}`, color: 'teal', autoClose: 6000 });
      onSaved?.();
    } catch (err) {
      notifications.show({ title: 'Not applied', message: err.message || 'Failed', color: 'red' });
    } finally {
      setApplying(false);
    }
  };

  const handleDeleteFromRate = (r) => modals.openConfirmModal({
    title: 'Delete From Dairy TS rate',
    children: <Text size="sm">Delete the TS rate ₹{Number(r.tsRate).toFixed(2)} from {fmt(r.fromDate)}? The previous rate will then run on until the next one.</Text>,
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    zIndex: 1200,
    onConfirm: async () => {
      try {
        const res = await unionSalesSlipAPI.deleteFromDairyRate(r._id);
        loadFromRates(res?.data);
        notifications.show({ title: 'Deleted', message: res?.message || 'From Dairy TS rate deleted', color: 'teal', autoClose: 6000 });
        onSaved?.();
      } catch (err) {
        notifications.show({ title: 'Error', message: err.message || 'Delete failed', color: 'red' });
      }
    },
  });

  // Generate / refresh the automatic Union Sales entries from the purchase data (safe to repeat)
  const [generating, setGenerating] = useState(false);
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await unionSalesSlipAPI.syncFromDairy();
      notifications.show({ title: 'Union Sales entries', message: res?.message || 'Refreshed', color: 'teal', autoClose: 6000 });
      onSaved?.();
    } catch (err) {
      notifications.show({ title: 'Not generated', message: err.message || 'Failed', color: 'red' });
    } finally {
      setGenerating(false);
    }
  };

  const editFromRate = (r) => setEntry({
    fromDate: r.fromDate, useToDate: r.useToDate, toDate: r.useToDate ? r.toDate : null, tsRate: r.tsRate, remarks: r.remarks,
  });

  const setRate = (i, key, val) => setToRates((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: val } : r)));

  // Excel upload: columns "From Date" + "TS Rate" (+ optional "Remarks")
  const handleUpload = async (file) => {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const pick = (row, ...names) => {
        const key = Object.keys(row).find((k) => names.includes(k.trim().toLowerCase()));
        return key ? row[key] : '';
      };
      const parsed = rows.map((row) => {
        const rawDate = pick(row, 'from date', 'fromdate', 'date', 'w.e.f', 'wef');
        // Excel dates arrive as Date; typed text is read day-month-year (05/03/2026 = 5 March)
        const iso = rawDate instanceof Date ? null : parseDateInput(String(rawDate)) || (/^\d{4}-\d{2}-\d{2}/.test(String(rawDate)) ? String(rawDate).slice(0, 10) : null);
        const date = rawDate instanceof Date ? rawDate : (iso ? new Date(`${iso}T00:00:00`) : null);
        return { fromDate: date, tsRate: Number(pick(row, 'ts rate', 'tsrate', 'rate')), remarks: String(pick(row, 'remarks', 'remark') || '') };
      }).filter((r) => r.fromDate && !Number.isNaN(r.fromDate.getTime()) && r.tsRate > 0);
      if (!parsed.length) {
        notifications.show({ title: 'Upload', message: 'No rows found. Use columns "From Date" and "TS Rate".', color: 'orange' });
        return;
      }
      setToRates(parsed);
      notifications.show({ title: 'Uploaded', message: `${parsed.length} TS rate(s) loaded — click Save to apply`, color: 'teal' });
    } catch (err) {
      notifications.show({ title: 'Upload failed', message: err.message, color: 'red' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // From Dairy TS rates are not sent — they are saved one by one with Apply
      const res = await unionSalesSlipAPI.saveSettings({
        fromDairy: { ...fromDairy, fromDate: ymd(fromDairy.fromDate) },
        toDairy: {
          ...toDairy,
          fromDate: ymd(toDairy.fromDate),
          tsRates: toRates.filter((r) => r.fromDate && r.tsRate !== '' && r.tsRate !== null)
            .map((r) => ({ fromDate: ymd(r.fromDate), tsRate: Number(r.tsRate), remarks: r.remarks })),
        },
      });
      notifications.show({ title: 'Saved', message: res?.message || 'Union Sales settings saved', color: 'teal', autoClose: 6000 });
      onSaved?.();
      onClose();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Save failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const fromRateNow = findTsPeriod(fromRates, fromDairy.fromDate && fromDairy.fromDate > new Date() ? fromDairy.fromDate : new Date())?.tsRate ?? null;

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>Union Sales Settings</Text>} size="xl" centered zIndex={1000}>
      {loading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {/* ═════════ FROM DAIRY ═════════ */}
            <Paper withBorder radius="md" p="md">
              <Group gap="xs" mb="sm">
                <IconBuildingStore size={18} color="#0f766e" />
                <Text fw={700}>From Dairy</Text>
                <Badge size="sm" variant="light" color="teal">Own TS Rates</Badge>
              </Group>
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} size="sm">{tsTitle(names.fromDairy?.label)}</Text>
                  <Switch label="Enable" checked={fromDairy.tsEnabled}
                    onChange={(e) => setFromDairy((p) => ({ ...p, tsEnabled: e.currentTarget.checked }))} />
                </Group>
                <ConfiguredName side={names.fromDairy} source="Company configuration (Super Admin): Society Name, District, State" />
                <DatePickerInput label="From Date" placeholder="TS rate applies from" valueFormat="DD/MM/YYYY" clearable
                  value={fromDairy.fromDate} onChange={(v) => setFromDairy((p) => ({ ...p, fromDate: v ? new Date(v) : null }))}
                  withAsterisk={fromDairy.tsEnabled} popoverProps={{ zIndex: 1100 }} />
                <Alert color="teal" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
                  <Text size="xs">
                    Qty, FAT, SNF and TS are taken from the milk purchase data; the rate is calculated as
                    TS × TS rate ÷ 100 using the From Dairy TS Rates below — separate from the Milk Purchase TS rate.
                  </Text>
                  <Text size="xs" fw={700} mt={4}>
                    {fromRateNow !== null ? `From Dairy TS rate now: ₹${Number(fromRateNow).toFixed(2)}` : 'No From Dairy TS rate applied yet.'}
                  </Text>
                </Alert>
              </Stack>
            </Paper>

            {/* ═════════ TO DAIRY ═════════ */}
            <Paper withBorder radius="md" p="md">
              <Group gap="xs" mb="sm">
                <IconBuildingFactory2 size={18} color="#7c3aed" />
                <Text fw={700}>To Dairy</Text>
                <Badge size="sm" variant="light" color="grape">Manual</Badge>
              </Group>
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} size="sm">{tsTitle(names.toDairy?.label)}</Text>
                  <Switch label="Enable" checked={toDairy.tsEnabled}
                    onChange={(e) => setToDairy((p) => ({ ...p, tsEnabled: e.currentTarget.checked }))} />
                </Group>
                <ConfiguredName side={names.toDairy} source="To Dairy in Machine Configuration; Region / State from the company configuration" />
                <DatePickerInput label="From Date" placeholder="TS rate applies from" valueFormat="DD/MM/YYYY" clearable
                  value={toDairy.fromDate} onChange={(v) => setToDairy((p) => ({ ...p, fromDate: v ? new Date(v) : null }))}
                  withAsterisk={toDairy.tsEnabled} popoverProps={{ zIndex: 1100 }} />
                <Alert color="grape" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
                  <Text size="xs">
                    Not taken from Machine Configuration. Qty, FAT and SNF come from the Union Sales slips you enter or
                    upload; the TS rates below are entered or uploaded here. Slip rate = TS × TS rate ÷ 100.
                  </Text>
                </Alert>
              </Stack>
            </Paper>
          </SimpleGrid>

          {/* From Dairy TS rates — own periods, applied one at a time */}
          {fromDairy.tsEnabled && (
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start" mb={2} wrap="nowrap">
                <Text fw={700} size="sm">From Dairy TS Rates</Text>
                <Tooltip multiline w={320} label="Creates / refreshes one Union Sales entry per date and session from the milk purchase data, using the TS rate of that date. Safe to run again — nothing is duplicated, and entries typed or imported by hand are never changed.">
                  <Button size="xs" variant="light" color="teal" loading={generating} onClick={handleGenerate}>
                    Generate Union Sales entries
                  </Button>
                </Tooltip>
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                A rate runs from its From Date until the next rate starts. Tick "Use To Date" only to end it on a fixed date.
                Applying a rate with an existing From Date replaces that rate; older rates stay as history.
                Union Sales entries are generated automatically from the milk purchase of each date + session
                (Qty, average FAT / SNF, Rate = TS × TS rate ÷ 100) and kept up to date as purchases change.
              </Text>
              <Group align="flex-end" gap="sm" wrap="wrap" mb="sm">
                <DatePickerInput label="From Date" withAsterisk placeholder="Select" valueFormat="DD/MM/YYYY" w={150}
                  value={entry.fromDate} onChange={(v) => setEntry((p) => ({ ...p, fromDate: v ? new Date(v) : null }))}
                  popoverProps={{ zIndex: 1100 }} />
                <Stack gap={4}>
                  <Checkbox size="xs" label="Use To Date" checked={entry.useToDate}
                    onChange={(e) => { const on = e.currentTarget.checked; setEntry((p) => ({ ...p, useToDate: on, toDate: on ? p.toDate : null })); }} />
                  <DatePickerInput placeholder={entry.useToDate ? 'Select' : '— (continues)'} valueFormat="DD/MM/YYYY" w={150}
                    disabled={!entry.useToDate} minDate={entry.fromDate || undefined}
                    value={entry.toDate} onChange={(v) => setEntry((p) => ({ ...p, toDate: v ? new Date(v) : null }))}
                    popoverProps={{ zIndex: 1100 }} />
                </Stack>
                <NumberInput label="TS Rate (₹)" withAsterisk min={0} decimalScale={2} hideControls w={120}
                  value={entry.tsRate} onChange={(v) => setEntry((p) => ({ ...p, tsRate: v }))} />
                <TextInput label="Remarks" w={180} value={entry.remarks}
                  onChange={(e) => setEntry((p) => ({ ...p, remarks: e.currentTarget.value }))} />
                <Button color="teal" leftSection={<IconCheck size={14} />} loading={applying} onClick={handleApply}>Apply</Button>
              </Group>
              <Table withTableBorder withColumnBorders fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={130}>From Date</Table.Th>
                    <Table.Th w={170}>To Date</Table.Th>
                    <Table.Th w={120} ta="right">TS Rate (₹)</Table.Th>
                    <Table.Th>Remarks</Table.Th>
                    <Table.Th w={80} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {fromRates.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={5} ta="center" c="dimmed">No From Dairy TS rates yet — enter a From Date and TS Rate, then Apply.</Table.Td></Table.Tr>
                  ) : [...fromRates].sort((a, b) => b.fromDate - a.fromDate).map((r) => (
                    <Table.Tr key={r._id}>
                      <Table.Td>{fmt(r.fromDate)}</Table.Td>
                      <Table.Td>
                        {r.useToDate ? fmt(r.toDate)
                          : r.toDate ? <Text size="sm" c="dimmed">{fmt(r.toDate)} (next rate)</Text>
                          : <Text size="sm" c="dimmed">— (continues)</Text>}
                      </Table.Td>
                      <Table.Td ta="right" fw={600}>{Number(r.tsRate).toFixed(2)}</Table.Td>
                      <Table.Td>{r.remarks}</Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <ActionIcon variant="light" onClick={() => editFromRate(r)} title="Edit"><IconPencil size={14} /></ActionIcon>
                          <ActionIcon color="red" variant="light" onClick={() => handleDeleteFromRate(r)} title="Delete"><IconTrash size={14} /></ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {/* To Dairy TS rates — manual */}
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="xs">
              <Text fw={700} size="sm">To Dairy TS Rates</Text>
              <Group gap="xs">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
                <Tooltip label='Excel columns: "From Date", "TS Rate", "Remarks"'>
                  <Button size="xs" variant="light" color="grape" leftSection={<IconUpload size={14} />} onClick={() => fileRef.current?.click()}>
                    Upload
                  </Button>
                </Tooltip>
                <Button size="xs" variant="light" color="grape" leftSection={<IconPlus size={14} />}
                  onClick={() => setToRates((rows) => [...rows, { fromDate: new Date(), tsRate: '', remarks: '' }])}>
                  Add Rate
                </Button>
              </Group>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">
              Each rate runs from its date until the day before the next rate starts.
            </Text>
            <Table withTableBorder withColumnBorders fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={170}>From Date</Table.Th>
                  <Table.Th w={140}>TS Rate (₹)</Table.Th>
                  <Table.Th>Remarks</Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {toRates.length === 0 ? (
                  <Table.Tr><Table.Td colSpan={4} ta="center" c="dimmed">No To Dairy TS rates yet.</Table.Td></Table.Tr>
                ) : toRates.map((r, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <DatePickerInput size="xs" valueFormat="DD/MM/YYYY" value={r.fromDate}
                        onChange={(v) => setRate(i, 'fromDate', v ? new Date(v) : null)} popoverProps={{ zIndex: 1100 }} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" min={0} decimalScale={2} hideControls value={r.tsRate}
                        onChange={(v) => setRate(i, 'tsRate', v)} />
                    </Table.Td>
                    <Table.Td>
                      <TextInput size="xs" value={r.remarks} onChange={(e) => setRate(i, 'remarks', e.currentTarget.value)} />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" variant="light" onClick={() => setToRates((rows) => rows.filter((_, j) => j !== i))}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button color="teal" onClick={handleSave} loading={saving}>Save Settings</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
