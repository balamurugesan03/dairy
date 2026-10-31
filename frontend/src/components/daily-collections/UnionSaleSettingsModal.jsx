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
import { IconTrash, IconUpload, IconInfoCircle, IconBuildingStore, IconBuildingFactory2, IconCheck, IconPencil } from '@tabler/icons-react';
import { unionSalesSlipAPI } from '../../services/api';
import { findTsPeriod } from '../../utils/rateChart';
import { parseDateInput } from '../../utils/dateUtils';

const emptySide = { tsEnabled: false };

// "TS Rate Settings (Society Name, State)" — read from the company configuration
// (Super Admin), never entered here
const tsTitle = (label) => `TS Rate Settings${label ? ` (${label})` : ''}`;

const emptyEntry = { fromDate: null, useToDate: false, toDate: null, tsRate: '', remarks: '' };
const fmt = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
const ymd = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : null);

const toPeriods = (list) => (list || []).map((r) => ({
  _id: r._id, fromDate: new Date(r.fromDate), toDate: r.toDate ? new Date(r.toDate) : null,
  useToDate: !!r.useToDate, tsRate: r.tsRate, remarks: r.remarks || '',
}));

/**
 * Union Sales → Settings
 *   From Dairy: its OWN TS rates — never the Milk Purchase TS rate. Qty / FAT / SNF / TS
 *               come from the milk purchase data.
 *   To Dairy:   its own TS rates; Qty / FAT / SNF from the Union Sales slips.
 *   Both sides use the same rate form: each rate is applied on its own (Apply), the same
 *   From Date replaces it, history is kept. Same formula: rate = (FAT + SNF) × TS rate ÷ 100.
 *
 * `side` = 'from' | 'to' opens just that dairy's form (the From Dairy / To Dairy buttons
 * next to Session on the Union Sales page); without it both are shown (Settings).
 */
// Read-only dairy name, fetched from the existing configuration
function ConfiguredName({ side = {}, source }) {
  return (
    <Paper withBorder radius="sm" p="xs" bg="gray.0">
      <Text size="xs" c="dimmed">Dairy</Text>
      <Text size="sm" fw={600}>{side.name ? `${side.code ? `${side.code} - ` : ''}${side.name}` : 'Not configured'}</Text>
      <Text size="xs" c="dimmed" mt={4}>From: {source}</Text>
    </Paper>
  );
}

// From Date / Use To Date / TS Rate / Remarks + Apply, and the rate history — one per dairy
function TsRatePanel({ title, color, rates, onApply, onDelete, extra, children }) {
  const [entry, setEntry] = useState(emptyEntry);
  const [applying, setApplying] = useState(false);

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
      await onApply({
        fromDate: ymd(entry.fromDate),
        useToDate: entry.useToDate,
        toDate: entry.useToDate ? ymd(entry.toDate) : null,
        tsRate: Number(entry.tsRate),
        remarks: entry.remarks,
      });
      setEntry(emptyEntry);
    } catch {
      // already shown by onApply — keep the entry so it can be corrected
    } finally {
      setApplying(false);
    }
  };

  const edit = (r) => setEntry({
    fromDate: r.fromDate, useToDate: r.useToDate, toDate: r.useToDate ? r.toDate : null, tsRate: r.tsRate, remarks: r.remarks,
  });

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" mb={2} wrap="nowrap">
        <Text fw={700} size="sm">{title}</Text>
        {extra}
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        A rate runs from its From Date until the next rate starts. Tick "Use To Date" only to end it on a fixed date.
        Applying a rate with an existing From Date replaces that rate; older rates stay as history.
        {children}
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
          onChange={(e) => { const remarks = e.currentTarget.value; setEntry((p) => ({ ...p, remarks })); }} />
        <Button color={color} leftSection={<IconCheck size={14} />} loading={applying} onClick={handleApply}>Apply</Button>
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
          {rates.length === 0 ? (
            <Table.Tr><Table.Td colSpan={5} ta="center" c="dimmed">No TS rates yet — enter a From Date and TS Rate, then Apply.</Table.Td></Table.Tr>
          ) : [...rates].sort((a, b) => b.fromDate - a.fromDate).map((r) => (
            <Table.Tr key={r._id || ymd(r.fromDate)}>
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
                  <ActionIcon variant="light" onClick={() => edit(r)} title="Edit"><IconPencil size={14} /></ActionIcon>
                  <ActionIcon color="red" variant="light" onClick={() => onDelete(r)} title="Delete"><IconTrash size={14} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

export default function UnionSaleSettingsModal({ opened, onClose, onSaved, side = null }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromDairy, setFromDairy] = useState(emptySide);
  const [names, setNames] = useState({ fromDairy: {}, toDairy: {} }); // configured names (read-only)
  const [toDairy, setToDairy] = useState(emptySide);
  const [toRates, setToRates] = useState([]);     // saved To Dairy periods
  const [fromRates, setFromRates] = useState([]); // saved From Dairy periods
  const fileRef = useRef(null);
  const showFrom = side !== 'to';
  const showTo = side !== 'from';

  const loadRates = (d) => {
    setFromRates(toPeriods(d?.fromDairy?.tsRates));
    setToRates(toPeriods(d?.toDairy?.tsRates));
  };

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    unionSalesSlipAPI.getSettings().catch(() => ({})).then((s) => {
      const d = s?.data || {};
      const flags = (x = {}) => ({ tsEnabled: !!x.tsEnabled });
      setNames(d.names || { fromDairy: {}, toDairy: {} });
      setFromDairy(flags(d.fromDairy));
      setToDairy(flags(d.toDairy));
      loadRates(d);
    }).finally(() => setLoading(false));
  }, [opened]);

  // ── Apply / Delete one TS rate (same From Date replaces it) ──
  const applyRate = (which) => async (payload) => {
    const api = which === 'from' ? unionSalesSlipAPI.applyFromDairyRate : unionSalesSlipAPI.applyToDairyRate;
    try {
      const res = await api(payload);
      loadRates(res?.data);
      notifications.show({
        title: 'Applied',
        message: res?.message || `${which === 'from' ? 'From' : 'To'} Dairy TS rate ₹${payload.tsRate.toFixed(2)} from ${fmt(payload.fromDate)}`,
        color: 'teal', autoClose: 6000,
      });
      onSaved?.();
    } catch (err) {
      notifications.show({ title: 'Not applied', message: err.message || 'Failed', color: 'red' });
      throw err;
    }
  };

  const deleteRate = (which) => (r) => modals.openConfirmModal({
    title: `Delete ${which === 'from' ? 'From' : 'To'} Dairy TS rate`,
    children: <Text size="sm">Delete the TS rate ₹{Number(r.tsRate).toFixed(2)} from {fmt(r.fromDate)}? The previous rate will then run on until the next one.</Text>,
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    zIndex: 1200,
    onConfirm: async () => {
      try {
        const api = which === 'from' ? unionSalesSlipAPI.deleteFromDairyRate : unionSalesSlipAPI.deleteToDairyRate;
        const res = await api(r._id);
        loadRates(res?.data);
        if (which === 'to' && res?.data?.toDairy && !res.data.toDairy.tsEnabled) setToDairy((p) => ({ ...p, tsEnabled: false }));
        notifications.show({ title: 'Deleted', message: res?.message || 'TS rate deleted', color: 'teal', autoClose: 6000 });
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

  // Excel upload of To Dairy rates: columns "From Date" + "TS Rate" (+ optional "Remarks").
  // Replaces the whole To Dairy rate list after a confirmation.
  const handleUpload = async (file) => {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const pick = (row, ...keys) => {
        const key = Object.keys(row).find((k) => keys.includes(k.trim().toLowerCase()));
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
      modals.openConfirmModal({
        title: 'Upload To Dairy TS rates',
        children: <Text size="sm">Replace the {toRates.length} saved To Dairy TS rate(s) with the {parsed.length} rate(s) from this file?</Text>,
        labels: { confirm: 'Replace', cancel: 'Cancel' },
        zIndex: 1200,
        onConfirm: async () => {
          try {
            const res = await unionSalesSlipAPI.saveSettings({
              fromDairy,
              toDairy: { ...toDairy, tsRates: parsed.map((r) => ({ fromDate: ymd(r.fromDate), tsRate: r.tsRate, remarks: r.remarks })) },
            });
            loadRates(res?.data);
            notifications.show({ title: 'Uploaded', message: `${parsed.length} To Dairy TS rate(s) saved`, color: 'teal' });
            onSaved?.();
          } catch (err) {
            notifications.show({ title: 'Upload failed', message: err.message, color: 'red' });
          }
        },
      });
    } catch (err) {
      notifications.show({ title: 'Upload failed', message: err.message, color: 'red' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Save = the Enable switches (rates are already saved by Apply / Delete / Upload)
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await unionSalesSlipAPI.saveSettings({ fromDairy, toDairy });
      notifications.show({ title: 'Saved', message: res?.message || 'Union Sales settings saved', color: 'teal', autoClose: 6000 });
      onSaved?.();
      onClose();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Save failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const fromRateNow = findTsPeriod(fromRates, new Date())?.tsRate ?? null;
  const toRateNow = findTsPeriod(toRates, new Date())?.tsRate ?? null;
  const rateNowText = (rate, label) => (rate !== null ? `${label} TS rate now: ₹${Number(rate).toFixed(2)}` : `No ${label} TS rate applied yet.`);
  const title = side === 'from' ? 'From Dairy Settings' : side === 'to' ? 'To Dairy Settings' : 'Union Sales Settings';

  const fromCard = (
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
            onChange={(e) => { const tsEnabled = e.currentTarget.checked; setFromDairy((p) => ({ ...p, tsEnabled })); }} />
        </Group>
        <ConfiguredName side={names.fromDairy} source="Company configuration (Super Admin): Society Name" />
        <Alert color="teal" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
          <Text size="xs">
            Qty, FAT, SNF and TS are taken from the milk purchase data; the rate is calculated as
            TS × TS rate ÷ 100 using the From Dairy TS Rates below — separate from the Milk Purchase TS rate.
          </Text>
          <Text size="xs" fw={700} mt={4}>{rateNowText(fromRateNow, 'From Dairy')}</Text>
        </Alert>
      </Stack>
    </Paper>
  );

  const toCard = (
    <Paper withBorder radius="md" p="md">
      <Group gap="xs" mb="sm">
        <IconBuildingFactory2 size={18} color="#7c3aed" />
        <Text fw={700}>To Dairy</Text>
        <Badge size="sm" variant="light" color="grape">Own TS Rates</Badge>
      </Group>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm">{tsTitle(names.toDairy?.label)}</Text>
          <Switch label="Enable" checked={toDairy.tsEnabled}
            onChange={(e) => { const tsEnabled = e.currentTarget.checked; setToDairy((p) => ({ ...p, tsEnabled })); }} />
        </Group>
        <ConfiguredName side={names.toDairy} source="To Dairy in Machine Configuration" />
        <Alert color="grape" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
          <Text size="xs">
            Qty, FAT and SNF come from the Union Sales slips you enter or upload; the rate is calculated as
            TS × TS rate ÷ 100 using the To Dairy TS Rates below.
          </Text>
          <Text size="xs" fw={700} mt={4}>{rateNowText(toRateNow, 'To Dairy')}</Text>
        </Alert>
      </Stack>
    </Paper>
  );

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>{title}</Text>} size={side ? 'lg' : 'xl'} centered zIndex={1000}>
      {loading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : (
        <Stack gap="md">
          {side ? (side === 'from' ? fromCard : toCard) : (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">{fromCard}{toCard}</SimpleGrid>
          )}

          {showFrom && (fromDairy.tsEnabled || side === 'from') && (
            <TsRatePanel
              title="From Dairy TS Rates" color="teal" rates={fromRates}
              onApply={applyRate('from')} onDelete={deleteRate('from')}
              extra={fromDairy.tsEnabled && (
                <Tooltip multiline w={320} label="Creates / refreshes one Union Sales entry per date and session from the milk purchase data, using the TS rate of that date. Safe to run again — nothing is duplicated, and entries typed or imported by hand are never changed.">
                  <Button size="xs" variant="light" color="teal" loading={generating} onClick={handleGenerate}>
                    Generate Union Sales entries
                  </Button>
                </Tooltip>
              )}
            >
              {' '}Union Sales entries are generated automatically from the milk purchase of each date + session
              (Qty, average FAT / SNF, Rate = TS × TS rate ÷ 100) and kept up to date as purchases change.
            </TsRatePanel>
          )}

          {showTo && (
            <TsRatePanel
              title="To Dairy TS Rates" color="grape" rates={toRates}
              onApply={applyRate('to')} onDelete={deleteRate('to')}
              extra={(
                <>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
                  <Tooltip label='Excel columns: "From Date", "TS Rate", "Remarks"'>
                    <Button size="xs" variant="light" color="grape" leftSection={<IconUpload size={14} />} onClick={() => fileRef.current?.click()}>
                      Upload
                    </Button>
                  </Tooltip>
                </>
              )}
            >
              {' '}With To Dairy enabled, the slip rate is filled in from FAT + SNF × the To Dairy TS rate of the slip date.
            </TsRatePanel>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={saving}>Close</Button>
            <Button color="teal" onClick={handleSave} loading={saving}>Save Settings</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
