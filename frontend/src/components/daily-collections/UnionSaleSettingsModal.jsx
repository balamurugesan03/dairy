import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  Modal, Stack, Group, Text, Switch, TextInput, Paper, Badge, Button, Table, NumberInput, ActionIcon,
  Alert, Loader, Center, SimpleGrid, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconUpload, IconInfoCircle, IconBuildingStore, IconBuildingFactory2 } from '@tabler/icons-react';
import { unionSalesSlipAPI, rateChartAPI } from '../../services/api';
import { findTsPeriod } from '../../utils/rateChart';
import { parseDateInput } from '../../utils/dateUtils';

const emptySide = { tsEnabled: false, regionName: '', fromDate: null };

// "TS Rate Settings (Tamil Nadu)" — the region / dairy name in brackets
const tsTitle = (region) => `TS Rate Settings${region ? ` (${region})` : ''}`;

/**
 * Union Sales → Settings
 *   From Dairy: TS rate taken automatically from Machine Configuration (TS Rate Chart);
 *               Qty / FAT / SNF / TS come from the milk purchase data.
 *   To Dairy:   same structure, but the TS rates are entered / uploaded here by the user;
 *               Qty / FAT / SNF come from the Union Sales slips.
 */
export default function UnionSaleSettingsModal({ opened, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromDairy, setFromDairy] = useState(emptySide);
  const [toDairy, setToDairy] = useState(emptySide);
  const [toRates, setToRates] = useState([]); // { fromDate, tsRate, remarks }
  const [machineTsRates, setMachineTsRates] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    Promise.all([
      unionSalesSlipAPI.getSettings().catch(() => ({})),
      rateChartAPI.getTsRates().catch(() => ({})),
    ]).then(([s, ts]) => {
      const d = s?.data || {};
      const side = (x = {}) => ({ tsEnabled: !!x.tsEnabled, regionName: x.regionName || '', fromDate: x.fromDate ? new Date(x.fromDate) : null });
      setFromDairy(side(d.fromDairy));
      setToDairy(side(d.toDairy));
      setToRates((d.toDairy?.tsRates || []).map((r) => ({ fromDate: new Date(r.fromDate), tsRate: r.tsRate, remarks: r.remarks || '' })));
      setMachineTsRates(ts?.data || []);
    }).finally(() => setLoading(false));
  }, [opened]);

  const machineRateOn = (date) => findTsPeriod(machineTsRates, date || new Date())?.tsRate ?? null;

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
      const ymd = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : null);
      await unionSalesSlipAPI.saveSettings({
        fromDairy: { ...fromDairy, fromDate: ymd(fromDairy.fromDate) },
        toDairy: {
          ...toDairy,
          fromDate: ymd(toDairy.fromDate),
          tsRates: toRates.filter((r) => r.fromDate && r.tsRate !== '' && r.tsRate !== null)
            .map((r) => ({ fromDate: ymd(r.fromDate), tsRate: Number(r.tsRate), remarks: r.remarks })),
        },
      });
      notifications.show({ title: 'Saved', message: 'Union Sales settings saved', color: 'teal' });
      onSaved?.();
      onClose();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Save failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const fromRateNow = machineRateOn(fromDairy.fromDate && fromDairy.fromDate > new Date() ? fromDairy.fromDate : new Date());

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
                <Badge size="sm" variant="light" color="teal">Automatic</Badge>
              </Group>
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} size="sm">{tsTitle(fromDairy.regionName)}</Text>
                  <Switch label="Enable" checked={fromDairy.tsEnabled}
                    onChange={(e) => setFromDairy((p) => ({ ...p, tsEnabled: e.currentTarget.checked }))} />
                </Group>
                <TextInput label="Region / Dairy name" placeholder="e.g. Tamil Nadu" value={fromDairy.regionName}
                  onChange={(e) => setFromDairy((p) => ({ ...p, regionName: e.currentTarget.value }))} />
                <DatePickerInput label="From Date" placeholder="TS rate applies from" valueFormat="DD/MM/YYYY" clearable
                  value={fromDairy.fromDate} onChange={(v) => setFromDairy((p) => ({ ...p, fromDate: v ? new Date(v) : null }))}
                  withAsterisk={fromDairy.tsEnabled} popoverProps={{ zIndex: 1100 }} />
                <Alert color="teal" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
                  <Text size="xs">
                    Qty, FAT, SNF and TS are taken from the milk purchase data; the rate is calculated as
                    TS × TS rate ÷ 100 using the TS rate in Machine Configuration (TS Rate Chart).
                  </Text>
                  <Text size="xs" fw={700} mt={4}>
                    {fromRateNow !== null ? `Machine Configuration TS rate now: ₹${fromRateNow}` : 'No TS rate set in Machine Configuration yet.'}
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
                  <Text fw={600} size="sm">{tsTitle(toDairy.regionName)}</Text>
                  <Switch label="Enable" checked={toDairy.tsEnabled}
                    onChange={(e) => setToDairy((p) => ({ ...p, tsEnabled: e.currentTarget.checked }))} />
                </Group>
                <TextInput label="Region / Dairy name" placeholder="e.g. Tamil Nadu" value={toDairy.regionName}
                  onChange={(e) => setToDairy((p) => ({ ...p, regionName: e.currentTarget.value }))} />
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
