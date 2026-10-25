import { Fragment, useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Container,
  Group,
  Title,
  Button,
  TextInput,
  Select,
  Stack,
  Text,
  Badge,
  NumberInput,
  ActionIcon,
  Paper,
  Table,
  Tooltip,
  Box,
  Grid,
  ThemeIcon,
  Tabs,
  SegmentedControl,
  Textarea,
  SimpleGrid,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconScale,
  IconClipboardCheck,
  IconReportAnalytics,
  IconDeviceFloppy,
  IconTrash,
  IconRefresh,
  IconFileSpreadsheet,
  IconChevronDown,
  IconChevronRight,
  IconAlertTriangle,
  IconInfoCircle,
} from '@tabler/icons-react';
import { milkReceiptAPI, transportRouteAPI } from '../../services/api';

// ────────────────────────────────────────────────────────────────
//  Helpers — same maths as the backend
// ────────────────────────────────────────────────────────────────
const f2 = (n) => Number(n || 0).toFixed(2);
const f3 = (n) => Number(n || 0).toFixed(3);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');
const toYMD = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const shiftLabel = (s) => (s === 'AM' ? 'Morning' : 'Evening');

// SNF from CLR when not entered — same formula as Milk Purchase
const autoSnf = (fat, clr) => (clr ? Number((clr / 4 + 0.20 * fat + 0.50).toFixed(2)) : 0);

const reading = ({ qty, fat, clr, snf }) => {
  const q = Number(qty) || 0;
  const ft = Number(fat) || 0;
  const c = Number(clr) || 0;
  const s = Number(snf) || autoSnf(ft, c);
  return { qty: q, fat: ft, clr: c, snf: s, fatKg: (q * ft) / 100, snfKg: (q * s) / 100 };
};

const combine = (list) => {
  const qty = list.reduce((s, r) => s + r.qty, 0);
  const w = (k) => (qty ? list.reduce((s, r) => s + r.qty * r[k], 0) / qty : 0);
  return {
    qty,
    fat: w('fat'),
    clr: w('clr'),
    snf: w('snf'),
    fatKg: list.reduce((s, r) => s + r.fatKg, 0),
    snfKg: list.reduce((s, r) => s + r.snfKg, 0),
  };
};

const diffColor = (v) => (v < 0 ? 'red' : v > 0 ? 'teal' : undefined);
const STATUS_COLOR = { Shortage: 'red', Excess: 'blue', OK: 'teal', 'Not Received': 'orange', 'Awaiting Data': 'gray' };

const DiffCell = ({ value, digits = 2 }) => (
  <Table.Td ta="right" c={diffColor(Number(value))} fw={Number(value) < 0 ? 700 : undefined}>
    {value === null || value === undefined ? '-' : (Number(value) > 0 ? '+' : '') + Number(value).toFixed(digits)}
  </Table.Td>
);

const emptyTotal = { qty: '', fat: '', clr: '', snf: '' };

export default function MilkReceiptShortage() {
  const [tab, setTab] = useState('entry');
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    transportRouteAPI.getAll({ limit: 1000 })
      .then((res) => setRoutes(res.data || []))
      .catch(() => setRoutes([]));
  }, []);

  const routeOptions = routes.map((r) => ({ value: r._id, label: `${r.routeName} (${r.vehicleNumber})` }));

  // ══════════════ ENTRY STATE ══════════════
  const [date, setDate] = useState(() => new Date());
  const [shift, setShift] = useState(() => (new Date().getHours() < 12 ? 'AM' : 'PM'));
  const [routeId, setRouteId] = useState('');
  const [expected, setExpected] = useState(null); // { route, centres, total, receipt }
  const [loadingExpected, setLoadingExpected] = useState(false);
  const [entryMode, setEntryMode] = useState('Centre');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [totalReading, setTotalReading] = useState(emptyTotal);
  const [lines, setLines] = useState({}); // centreId → { qty, fat, clr, snf }
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [dayReceipts, setDayReceipts] = useState([]);

  const fetchDayReceipts = useCallback(async () => {
    if (!date) return;
    try {
      const res = await milkReceiptAPI.getAll({ fromDate: toYMD(date), toDate: toYMD(date) });
      setDayReceipts(res.data || []);
    } catch {
      setDayReceipts([]);
    }
  }, [date]);

  useEffect(() => { fetchDayReceipts(); }, [fetchDayReceipts]);

  const loadExpected = useCallback(async () => {
    if (!date || !shift || !routeId) { setExpected(null); return; }
    setLoadingExpected(true);
    try {
      const res = await milkReceiptAPI.getExpected({ date: toYMD(date), shift, routeId });
      const data = res.data;
      setExpected(data);
      const rc = data.receipt;
      setVehicleNumber(rc?.vehicleNumber || data.route.vehicleNumber || '');
      setDriverName(rc?.driverName || data.route.driverName || '');
      setRemarks(rc?.remarks || '');
      setEntryMode(rc?.entryMode || 'Centre');
      setTotalReading(rc && rc.entryMode !== 'Centre'
        ? { qty: rc.qty, fat: rc.fat, clr: rc.clr || '', snf: rc.snf }
        : emptyTotal);
      const ln = {};
      for (const l of rc?.lines || []) ln[String(l.centre)] = { qty: l.qty, fat: l.fat, clr: l.clr || '', snf: l.snf };
      setLines(ln);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load sub centre totals', color: 'red' });
      setExpected(null);
    } finally {
      setLoadingExpected(false);
    }
  }, [date, shift, routeId]);

  useEffect(() => { loadExpected(); }, [loadExpected]);

  const setLine = (centreId, key, val) =>
    setLines((prev) => ({ ...prev, [centreId]: { ...(prev[centreId] || emptyTotal), [key]: val } }));

  // Live received figures
  const receivedCentres = (expected?.centres || []).map((c) => reading(lines[String(c.centre)] || emptyTotal));
  const received = entryMode === 'Centre' ? combine(receivedCentres) : reading(totalReading);
  const exp = expected?.total;
  // Sub centre Excel usually arrives days later — until then there's nothing to compare against
  const awaitingCentre = (i) => receivedCentres[i]?.qty > 0 && !(expected.centres[i].qty > 0);
  const awaitingData = !!exp && received.qty > 0 && (
    !(exp.qty > 0) || (entryMode === 'Centre' && (expected?.centres || []).some((_, i) => awaitingCentre(i)))
  );
  const liveDiff = exp && received.qty > 0 && !awaitingData
    ? { qty: received.qty - exp.qty, fatKg: received.fatKg - exp.fatKg, snfKg: received.snfKg - exp.snfKg }
    : null;
  const liveShort = liveDiff && (liveDiff.qty < -0.005 || liveDiff.fatKg < -0.0005 || liveDiff.snfKg < -0.0005);

  const saveReceipt = async () => {
    if (!expected) return;
    if (!(received.qty > 0)) {
      notifications.show({ title: 'Receipt', message: 'Enter received qty', color: 'orange' });
      return;
    }
    const payload = {
      date: toYMD(date),
      shift,
      routeId,
      vehicleNumber,
      driverName,
      entryMode,
      remarks,
      ...(entryMode === 'Total'
        ? totalReading
        : { lines: expected.centres.map((c) => ({ centre: c.centre, ...(lines[String(c.centre)] || emptyTotal) })) }),
    };
    setSaving(true);
    try {
      if (expected.receipt?._id) {
        await milkReceiptAPI.update(expected.receipt._id, payload);
        notifications.show({ title: 'Updated', message: 'Receipt updated', color: 'teal' });
      } else {
        await milkReceiptAPI.create(payload);
        notifications.show({ title: 'Saved', message: 'Receipt saved', color: 'teal' });
      }
      await loadExpected();
      fetchDayReceipts();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Save failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const deleteReceipt = () => {
    const rc = expected?.receipt;
    if (!rc) return;
    modals.openConfirmModal({
      title: 'Delete Receipt',
      children: <Text size="sm">Delete the main centre receipt for {rc.routeName}, {fmtDate(rc.date)} {shiftLabel(rc.shift)}?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await milkReceiptAPI.delete(rc._id);
          notifications.show({ title: 'Deleted', message: 'Receipt deleted', color: 'teal' });
          await loadExpected();
          fetchDayReceipts();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message || 'Delete failed', color: 'red' });
        }
      },
    });
  };

  // ══════════════ REPORT STATE ══════════════
  const [range, setRange] = useState(() => {
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth(), 1), now];
  });
  const [repShift, setRepShift] = useState('');
  const [repRoute, setRepRoute] = useState('');
  const [qtyTol, setQtyTol] = useState(0);
  const [kgTol, setKgTol] = useState(0);
  const [onlyShortage, setOnlyShortage] = useState(false);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [view, setView] = useState('trip');

  const loadReport = async () => {
    const [from, to] = range || [];
    if (!from || !to) {
      notifications.show({ title: 'Period', message: 'Select from and to dates', color: 'orange' });
      return;
    }
    setReportLoading(true);
    try {
      const params = { fromDate: toYMD(from), toDate: toYMD(to), qtyTolerance: qtyTol || 0, kgTolerance: kgTol || 0 };
      if (repShift) params.shift = repShift;
      if (repRoute) params.routeId = repRoute;
      const res = await milkReceiptAPI.getShortageReport(params);
      setReport({ ...res.data, fromDate: params.fromDate, toDate: params.toDate });
      setExpanded({});
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load report', color: 'red' });
    } finally {
      setReportLoading(false);
    }
  };

  const tripRows = (report?.rows || []).filter((r) => !onlyShortage || r.status === 'Shortage' || r.status === 'Not Received');

  const exportReport = () => {
    if (!report) return;
    const wb = XLSX.utils.book_new();
    const trips = [];
    for (const r of report.rows) {
      const base = { 'Date': r.date, 'Shift': shiftLabel(r.shift), 'Route': r.routeName, 'Van No': r.vehicleNumber };
      trips.push({
        ...base, 'Sub Centre': 'VAN TOTAL', 'Status': r.status,
        'Sent Qty': r.expected.qty, 'Sent FAT': r.expected.fat, 'Sent SNF': r.expected.snf,
        'Recd Qty': r.received?.qty ?? '', 'Recd FAT': r.received?.fat ?? '', 'Recd SNF': r.received?.snf ?? '',
        'Diff Qty': r.diff?.qty ?? '', 'Diff FAT Kg': r.diff?.fatKg ?? '', 'Diff SNF Kg': r.diff?.snfKg ?? '',
      });
      for (const c of r.centres) {
        trips.push({
          ...base, 'Sub Centre': c.centreName, 'Status': c.status || '',
          'Sent Qty': c.expected.qty, 'Sent FAT': c.expected.fat, 'Sent SNF': c.expected.snf,
          'Recd Qty': c.received?.qty ?? '', 'Recd FAT': c.received?.fat ?? '', 'Recd SNF': c.received?.snf ?? '',
          'Diff Qty': c.diff?.qty ?? '', 'Diff FAT Kg': c.diff?.fatKg ?? '', 'Diff SNF Kg': c.diff?.snfKg ?? '',
        });
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trips), 'Trip-wise');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.byRoute.map((r) => ({
      'Route': r.routeName, 'Van No': r.vehicleNumber, 'Trips': r.trips, 'Receipts Entered': r.received,
      'Not Received': r.notReceived, 'Awaiting Data': r.awaiting, 'Sent Qty': r.expectedQty, 'Recd Qty': r.receivedQty,
      'Short Qty': r.shortQty, 'Short FAT Kg': r.shortFatKg, 'Short SNF Kg': r.shortSnfKg, 'Shortage Trips': r.shortageTrips,
    }))), 'Route-wise');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.byCentre.map((c) => ({
      'Sub Centre': c.centreName, 'Route': c.routeName, 'Van No': c.vehicleNumber, 'Sent Qty': c.expectedQty,
      'Tested Separately': c.tested, 'Van Total Only': c.vanTotalOnly, 'Awaiting Data': c.awaiting,
      'Short Qty': c.shortQty, 'Short FAT Kg': c.shortFatKg, 'Short SNF Kg': c.shortSnfKg, 'Shortage Trips': c.shortageTrips,
    }))), 'Sub Centre-wise');
    XLSX.writeFile(wb, `Milk_Shortage_${report.fromDate}_to_${report.toDate}.xlsx`);
  };

  // ══════════════ RENDER ══════════════
  const numIn = (value, onChange, decimals = 2) => (
    <NumberInput size="xs" min={0} decimalScale={decimals} hideControls value={value} onChange={onChange} />
  );

  return (
    <Container size="xl" py="md">
      <Paper shadow="sm" radius="md" p="lg" withBorder>
        <Group gap="sm" mb="md">
          <ThemeIcon size={40} radius="md" color="teal" variant="light">
            <IconScale size={22} />
          </ThemeIcon>
          <Box>
            <Title order={3} lh={1}>Milk Receipt &amp; Shortage</Title>
            <Text size="xs" c="dimmed">
              Main centre weighment/test vs sub centre bills — shortage by route, van and sub centre
            </Text>
          </Box>
        </Group>

        <Tabs value={tab} onChange={setTab} color="teal">
          <Tabs.List mb="md">
            <Tabs.Tab value="entry" leftSection={<IconClipboardCheck size={15} />}>Receipt Entry</Tabs.Tab>
            <Tabs.Tab value="report" leftSection={<IconReportAnalytics size={15} />}>Shortage Report</Tabs.Tab>
          </Tabs.List>

          {/* ═════════════ RECEIPT ENTRY ═════════════ */}
          <Tabs.Panel value="entry">
            {routes.length === 0 && (
              <Alert color="orange" icon={<IconInfoCircle size={16} />} mb="md">
                No routes yet. Add routes under Transport first — each route lists the sub centres its van collects from.
              </Alert>
            )}
            <Grid gutter="sm" align="flex-end" mb="md">
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <DatePickerInput label="Date" valueFormat="DD/MM/YYYY" value={date} onChange={setDate} radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <Text size="sm" fw={500} mb={4}>Shift</Text>
                <SegmentedControl
                  fullWidth
                  color="teal"
                  value={shift}
                  onChange={setShift}
                  data={[{ value: 'AM', label: 'Morning' }, { value: 'PM', label: 'Evening' }]}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Select
                  label="Route / Van"
                  placeholder="Select route"
                  data={routeOptions}
                  value={routeId}
                  onChange={(v) => setRouteId(v || '')}
                  searchable
                  radius="md"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 2 }}>
                <Button fullWidth variant="light" color="teal" radius="md" leftSection={<IconRefresh size={16} />}
                  onClick={loadExpected} loading={loadingExpected} disabled={!routeId}>
                  Reload
                </Button>
              </Grid.Col>
            </Grid>

            {expected && (
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text fw={600}>{expected.route.routeName}</Text>
                    <Text size="sm" c="dimmed">
                      {expected.centres.map((c) => c.centreName).join(' → ')} → {expected.route.destinationName || 'Main Centre'}
                    </Text>
                  </Group>
                  {expected.receipt
                    ? <Badge color="teal" variant="light">Receipt entered — editing</Badge>
                    : <Badge color="orange" variant="light">New receipt</Badge>}
                </Group>

                <Grid gutter="sm">
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="Van Number" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="Driver" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Text size="sm" fw={500} mb={4}>Main centre test</Text>
                    <SegmentedControl
                      fullWidth
                      color="teal"
                      value={entryMode}
                      onChange={setEntryMode}
                      data={[{ value: 'Centre', label: 'Sub Centre-wise' }, { value: 'Total', label: 'Van Total' }]}
                    />
                  </Grid.Col>
                </Grid>

                {/* Sub centre bills (from Daily Collection List) + received */}
                <Box style={{ overflowX: 'auto' }}>
                  <Table withTableBorder withColumnBorders fz="sm" striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th rowSpan={2}>Sub Centre</Table.Th>
                        <Table.Th colSpan={7} ta="center" bg="blue.0">Sent — sub centre bill (Daily Collection List)</Table.Th>
                        {entryMode === 'Centre' && <Table.Th colSpan={4} ta="center" bg="teal.0">Received at main centre</Table.Th>}
                        {entryMode === 'Centre' && <Table.Th colSpan={3} ta="center" bg="red.0">Difference</Table.Th>}
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Th ta="right">Farmers</Table.Th>
                        <Table.Th ta="right">Qty</Table.Th>
                        <Table.Th ta="right">FAT</Table.Th>
                        <Table.Th ta="right">CLR</Table.Th>
                        <Table.Th ta="right">SNF</Table.Th>
                        <Table.Th ta="right">FAT Kg</Table.Th>
                        <Table.Th ta="right">SNF Kg</Table.Th>
                        {entryMode === 'Centre' && (
                          <>
                            <Table.Th w={95}>Qty</Table.Th>
                            <Table.Th w={75}>FAT</Table.Th>
                            <Table.Th w={75}>CLR</Table.Th>
                            <Table.Th w={75}>SNF</Table.Th>
                            <Table.Th ta="right">Qty</Table.Th>
                            <Table.Th ta="right">FAT Kg</Table.Th>
                            <Table.Th ta="right">SNF Kg</Table.Th>
                          </>
                        )}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {expected.centres.map((c, i) => {
                        const id = String(c.centre);
                        const ln = lines[id] || emptyTotal;
                        const rd = receivedCentres[i];
                        const has = rd.qty > 0;
                        return (
                          <Table.Tr key={id}>
                            <Table.Td fw={500}>{c.centreName}</Table.Td>
                            <Table.Td ta="right">{c.farmers}</Table.Td>
                            <Table.Td ta="right">{f2(c.qty)}</Table.Td>
                            <Table.Td ta="right">{f2(c.fat)}</Table.Td>
                            <Table.Td ta="right">{f2(c.clr)}</Table.Td>
                            <Table.Td ta="right">{f2(c.snf)}</Table.Td>
                            <Table.Td ta="right">{f3(c.fatKg)}</Table.Td>
                            <Table.Td ta="right">{f3(c.snfKg)}</Table.Td>
                            {entryMode === 'Centre' && (
                              <>
                                <Table.Td>{numIn(ln.qty, (v) => setLine(id, 'qty', v))}</Table.Td>
                                <Table.Td>{numIn(ln.fat, (v) => setLine(id, 'fat', v))}</Table.Td>
                                <Table.Td>{numIn(ln.clr, (v) => setLine(id, 'clr', v), 1)}</Table.Td>
                                <Table.Td>
                                  <NumberInput size="xs" min={0} decimalScale={2} hideControls value={ln.snf}
                                    placeholder={rd.snf ? f2(rd.snf) : ''} onChange={(v) => setLine(id, 'snf', v)} />
                                </Table.Td>
                                {has && !(c.qty > 0) ? (
                                  <Table.Td colSpan={3} ta="center">
                                    <Badge color="gray" variant="light" size="sm">Awaiting sub centre data</Badge>
                                  </Table.Td>
                                ) : (
                                  <>
                                    <DiffCell value={has ? rd.qty - c.qty : null} />
                                    <DiffCell value={has ? rd.fatKg - c.fatKg : null} digits={3} />
                                    <DiffCell value={has ? rd.snfKg - c.snfKg : null} digits={3} />
                                  </>
                                )}
                              </>
                            )}
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr style={{ fontWeight: 700 }}>
                        <Table.Td>TOTAL SENT</Table.Td>
                        <Table.Td ta="right">{exp.farmers}</Table.Td>
                        <Table.Td ta="right">{f2(exp.qty)}</Table.Td>
                        <Table.Td ta="right">{f2(exp.fat)}</Table.Td>
                        <Table.Td ta="right">{f2(exp.clr)}</Table.Td>
                        <Table.Td ta="right">{f2(exp.snf)}</Table.Td>
                        <Table.Td ta="right">{f3(exp.fatKg)}</Table.Td>
                        <Table.Td ta="right">{f3(exp.snfKg)}</Table.Td>
                        {entryMode === 'Centre' && (
                          <>
                            <Table.Td ta="right">{f2(received.qty)}</Table.Td>
                            <Table.Td ta="right">{f2(received.fat)}</Table.Td>
                            <Table.Td ta="right">{f2(received.clr)}</Table.Td>
                            <Table.Td ta="right">{f2(received.snf)}</Table.Td>
                            <DiffCell value={liveDiff?.qty ?? null} />
                            <DiffCell value={liveDiff?.fatKg ?? null} digits={3} />
                            <DiffCell value={liveDiff?.snfKg ?? null} digits={3} />
                          </>
                        )}
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </Box>
                {(exp.qty === 0 || awaitingData) && (
                  <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                    {exp.qty === 0
                      ? `Sub centre data for ${fmtDate(date)} ${shiftLabel(shift)} isn't imported yet.`
                      : 'Some sub centres tested here have no imported data yet.'}{' '}
                    Enter and save the main centre measurement now — once the sub centres' Excel is imported into the
                    Daily Collection List, the Shortage Report compares it date-wise automatically.
                  </Alert>
                )}

                {entryMode === 'Total' && (
                  <Paper withBorder radius="md" p="md" bg="teal.0">
                    <Text fw={600} size="sm" mb="xs">Received at main centre — van total</Text>
                    <Grid gutter="sm">
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <NumberInput label="Qty" min={0} decimalScale={2} hideControls value={totalReading.qty}
                          onChange={(v) => setTotalReading((p) => ({ ...p, qty: v }))} />
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <NumberInput label="FAT" min={0} decimalScale={2} hideControls value={totalReading.fat}
                          onChange={(v) => setTotalReading((p) => ({ ...p, fat: v }))} />
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <NumberInput label="CLR" min={0} decimalScale={1} hideControls value={totalReading.clr}
                          onChange={(v) => setTotalReading((p) => ({ ...p, clr: v }))} />
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <NumberInput label="SNF" min={0} decimalScale={2} hideControls value={totalReading.snf}
                          placeholder={received.snf ? f2(received.snf) : 'auto from CLR'}
                          onChange={(v) => setTotalReading((p) => ({ ...p, snf: v }))} />
                      </Grid.Col>
                    </Grid>
                  </Paper>
                )}

                {/* Live comparison */}
                {liveDiff && (
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    {[
                      { label: 'Qty', sent: exp.qty, recd: received.qty, diff: liveDiff.qty, d: 2 },
                      { label: 'FAT Kg', sent: exp.fatKg, recd: received.fatKg, diff: liveDiff.fatKg, d: 3 },
                      { label: 'SNF Kg', sent: exp.snfKg, recd: received.snfKg, diff: liveDiff.snfKg, d: 3 },
                    ].map((x) => (
                      <Paper key={x.label} withBorder radius="md" p="sm">
                        <Text size="xs" c="dimmed">{x.label}: sent {x.sent.toFixed(x.d)} · received {x.recd.toFixed(x.d)}</Text>
                        <Text fw={700} size="lg" c={diffColor(Number(x.diff.toFixed(x.d)))}>
                          {x.diff < 0 ? 'Shortage ' : x.diff > 0 ? 'Excess +' : ''}{Math.abs(x.diff).toFixed(x.d)}
                        </Text>
                      </Paper>
                    ))}
                  </SimpleGrid>
                )}
                {liveShort && entryMode === 'Total' && expected.centres.length > 1 && (
                  <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                    Shortage on van {vehicleNumber}. With a van-total test it can't be pinned to one sub centre — switch to
                    “Sub Centre-wise” if the cans were tested separately.
                  </Alert>
                )}

                <Textarea label="Remarks" autosize minRows={1} value={remarks} onChange={(e) => setRemarks(e.target.value)} />

                <Group justify="flex-end">
                  {expected.receipt && (
                    <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={deleteReceipt}>Delete</Button>
                  )}
                  <Button color="teal" leftSection={<IconDeviceFloppy size={16} />} onClick={saveReceipt} loading={saving}>
                    {expected.receipt ? 'Update Receipt' : 'Save Receipt'}
                  </Button>
                </Group>
              </Stack>
            )}

            {/* Receipts already entered for the day */}
            <Text fw={600} size="sm" mt="lg" mb="xs">Receipts entered on {fmtDate(date)}</Text>
            <Table withTableBorder withColumnBorders fz="sm" striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Shift</Table.Th>
                  <Table.Th>Route</Table.Th>
                  <Table.Th>Van</Table.Th>
                  <Table.Th>Test</Table.Th>
                  <Table.Th ta="right">Qty</Table.Th>
                  <Table.Th ta="right">FAT</Table.Th>
                  <Table.Th ta="right">SNF</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dayReceipts.length === 0 ? (
                  <Table.Tr><Table.Td colSpan={7} ta="center" c="dimmed">None yet.</Table.Td></Table.Tr>
                ) : dayReceipts.map((r) => (
                  <Table.Tr key={r._id} style={{ cursor: 'pointer' }}
                    onClick={() => { setShift(r.shift); setRouteId(String(r.routeId)); }}>
                    <Table.Td>{shiftLabel(r.shift)}</Table.Td>
                    <Table.Td>{r.routeName}</Table.Td>
                    <Table.Td>{r.vehicleNumber}</Table.Td>
                    <Table.Td>{r.entryMode === 'Centre' ? 'Sub Centre-wise' : 'Van Total'}</Table.Td>
                    <Table.Td ta="right">{f2(r.qty)}</Table.Td>
                    <Table.Td ta="right">{f2(r.fat)}</Table.Td>
                    <Table.Td ta="right">{f2(r.snf)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* ═════════════ SHORTAGE REPORT ═════════════ */}
          <Tabs.Panel value="report">
            <Grid gutter="sm" align="flex-end" mb="md">
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <DatePickerInput type="range" label="Period" valueFormat="DD/MM/YYYY" value={range} onChange={setRange} radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 2 }}>
                <Select label="Shift" data={[{ value: '', label: 'Both' }, { value: 'AM', label: 'Morning' }, { value: 'PM', label: 'Evening' }]}
                  value={repShift} onChange={(v) => setRepShift(v || '')} radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Select label="Route" placeholder="All routes" data={routeOptions} value={repRoute}
                  onChange={(v) => setRepRoute(v || '')} clearable searchable radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 1 }}>
                <NumberInput label="Qty tol." min={0} decimalScale={2} hideControls value={qtyTol} onChange={setQtyTol} radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 1 }}>
                <NumberInput label="Kg tol." min={0} decimalScale={3} hideControls value={kgTol} onChange={setKgTol} radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 2 }}>
                <Group gap="xs" wrap="nowrap">
                  <Button color="teal" radius="md" onClick={loadReport} loading={reportLoading}>Show</Button>
                  <Tooltip label="Excel">
                    <ActionIcon size="lg" variant="light" color="green" onClick={exportReport} disabled={!report}>
                      <IconFileSpreadsheet size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Grid.Col>
            </Grid>

            {report && (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 2, sm: 6 }}>
                  {[
                    { label: 'Sent Qty', value: f2(report.totals.expectedQty) },
                    { label: 'Received Qty', value: f2(report.totals.receivedQty) },
                    { label: 'Short Qty', value: f2(report.totals.shortQty), red: report.totals.shortQty > 0 },
                    { label: 'Short FAT Kg', value: f3(report.totals.shortFatKg), red: report.totals.shortFatKg > 0 },
                    { label: 'Short SNF Kg', value: f3(report.totals.shortSnfKg), red: report.totals.shortSnfKg > 0 },
                    { label: 'Shortage / Not Recd / Awaiting', value: `${report.totals.shortageCount} / ${report.totals.notReceivedCount} / ${report.totals.awaitingCount}`, red: report.totals.shortageCount > 0 },
                  ].map((s) => (
                    <Paper key={s.label} withBorder radius="md" p="sm">
                      <Text size="xs" c="dimmed">{s.label}</Text>
                      <Text fw={700} size="lg" c={s.red ? 'red' : undefined}>{s.value}</Text>
                    </Paper>
                  ))}
                </SimpleGrid>
                <Text size="xs" c="dimmed">
                  Totals compare only trips where both sides are entered. “Not Received” = sub centres collected milk but no main centre receipt was entered. “Awaiting Data” = main centre receipt entered, sub centre Excel not imported yet.
                </Text>

                <Group justify="space-between">
                  <SegmentedControl
                    color="teal"
                    value={view}
                    onChange={setView}
                    data={[
                      { value: 'trip', label: 'Trip-wise' },
                      { value: 'route', label: 'Route / Van-wise' },
                      { value: 'centre', label: 'Sub Centre-wise' },
                    ]}
                  />
                  {view === 'trip' && (
                    <SegmentedControl
                      size="xs"
                      value={onlyShortage ? 'short' : 'all'}
                      onChange={(v) => setOnlyShortage(v === 'short')}
                      data={[{ value: 'all', label: 'All trips' }, { value: 'short', label: 'Shortage / Not received only' }]}
                    />
                  )}
                </Group>

                {view === 'trip' && (
                  <Box style={{ overflowX: 'auto' }}>
                    <Table withTableBorder withColumnBorders fz="sm" highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th w={30} />
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Shift</Table.Th>
                          <Table.Th>Route / Van</Table.Th>
                          <Table.Th ta="right">Sent Qty</Table.Th>
                          <Table.Th ta="right">Sent FAT/SNF</Table.Th>
                          <Table.Th ta="right">Recd Qty</Table.Th>
                          <Table.Th ta="right">Recd FAT/SNF</Table.Th>
                          <Table.Th ta="right">Diff Qty</Table.Th>
                          <Table.Th ta="right">Diff FAT Kg</Table.Th>
                          <Table.Th ta="right">Diff SNF Kg</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {tripRows.length === 0 ? (
                          <Table.Tr><Table.Td colSpan={12} ta="center" py="xl" c="dimmed">No trips in this period.</Table.Td></Table.Tr>
                        ) : tripRows.map((r) => {
                          const key = `${r.date}|${r.shift}|${r.routeId}`;
                          const open = !!expanded[key];
                          return (
                            <Fragment key={key}>
                              <Table.Tr style={{ cursor: 'pointer' }} bg={r.status === 'Shortage' ? 'red.0' : undefined}
                                onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}>
                                <Table.Td>{open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}</Table.Td>
                                <Table.Td>{fmtDate(r.date)}</Table.Td>
                                <Table.Td>{shiftLabel(r.shift)}</Table.Td>
                                <Table.Td>
                                  <Text size="sm" fw={600}>{r.routeName}</Text>
                                  <Text size="xs" c="dimmed">{r.vehicleNumber}{r.driverName ? ` · ${r.driverName}` : ''}</Text>
                                </Table.Td>
                                <Table.Td ta="right">{f2(r.expected.qty)}</Table.Td>
                                <Table.Td ta="right">{f2(r.expected.fat)} / {f2(r.expected.snf)}</Table.Td>
                                <Table.Td ta="right">{r.received ? f2(r.received.qty) : '-'}</Table.Td>
                                <Table.Td ta="right">{r.received ? `${f2(r.received.fat)} / ${f2(r.received.snf)}` : '-'}</Table.Td>
                                <DiffCell value={r.diff?.qty ?? null} />
                                <DiffCell value={r.diff?.fatKg ?? null} digits={3} />
                                <DiffCell value={r.diff?.snfKg ?? null} digits={3} />
                                <Table.Td>
                                  <Badge color={STATUS_COLOR[r.status]} variant="light">{r.status}</Badge>
                                  {r.entryMode && <Text size="xs" c="dimmed">{r.entryMode === 'Centre' ? 'Centre-wise test' : 'Van total test'}</Text>}
                                  {r.entryMode === 'Total' && r.status !== 'Awaiting Data' && r.noDataCentres?.length > 0 && (
                                    <Text size="xs" c="orange">No data yet: {r.noDataCentres.join(', ')}</Text>
                                  )}
                                </Table.Td>
                              </Table.Tr>
                              {open && r.centres.map((c) => (
                                <Table.Tr key={`${key}|${c.centreId}`} bg="gray.0">
                                  <Table.Td />
                                  <Table.Td colSpan={3} pl="xl">
                                    <Text size="xs">↳ {c.centreName} <Text span c="dimmed">({c.expected.farmers} farmers)</Text></Text>
                                  </Table.Td>
                                  <Table.Td ta="right">{f2(c.expected.qty)}</Table.Td>
                                  <Table.Td ta="right">{f2(c.expected.fat)} / {f2(c.expected.snf)}</Table.Td>
                                  <Table.Td ta="right">{c.received ? f2(c.received.qty) : '-'}</Table.Td>
                                  <Table.Td ta="right">{c.received ? `${f2(c.received.fat)} / ${f2(c.received.snf)}` : '-'}</Table.Td>
                                  <DiffCell value={c.diff?.qty ?? null} />
                                  <DiffCell value={c.diff?.fatKg ?? null} digits={3} />
                                  <DiffCell value={c.diff?.snfKg ?? null} digits={3} />
                                  <Table.Td>
                                    {c.status
                                      ? <Badge size="sm" color={STATUS_COLOR[c.status]} variant="light">{c.status}</Badge>
                                      : <Text size="xs" c="dimmed">{r.received ? 'in van total' : '-'}</Text>}
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Box>
                )}

                {view === 'route' && (
                  <Box style={{ overflowX: 'auto' }}>
                    <Table withTableBorder withColumnBorders fz="sm" striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Route</Table.Th>
                          <Table.Th>Van No</Table.Th>
                          <Table.Th ta="right">Trips</Table.Th>
                          <Table.Th ta="right">Not Recd</Table.Th>
                          <Table.Th ta="right">Awaiting</Table.Th>
                          <Table.Th ta="right">Sent Qty</Table.Th>
                          <Table.Th ta="right">Recd Qty</Table.Th>
                          <Table.Th ta="right">Short Qty</Table.Th>
                          <Table.Th ta="right">Short FAT Kg</Table.Th>
                          <Table.Th ta="right">Short SNF Kg</Table.Th>
                          <Table.Th ta="right">Shortage Trips</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {report.byRoute.map((r) => (
                          <Table.Tr key={r.routeName + r.vehicleNumber}>
                            <Table.Td fw={600}>{r.routeName}</Table.Td>
                            <Table.Td>{r.vehicleNumber}</Table.Td>
                            <Table.Td ta="right">{r.trips}</Table.Td>
                            <Table.Td ta="right" c={r.notReceived ? 'orange' : undefined}>{r.notReceived}</Table.Td>
                            <Table.Td ta="right" c={r.awaiting ? 'dimmed' : undefined}>{r.awaiting}</Table.Td>
                            <Table.Td ta="right">{f2(r.expectedQty)}</Table.Td>
                            <Table.Td ta="right">{f2(r.receivedQty)}</Table.Td>
                            <Table.Td ta="right" c={r.shortQty ? 'red' : undefined} fw={700}>{f2(r.shortQty)}</Table.Td>
                            <Table.Td ta="right" c={r.shortFatKg ? 'red' : undefined} fw={700}>{f3(r.shortFatKg)}</Table.Td>
                            <Table.Td ta="right" c={r.shortSnfKg ? 'red' : undefined} fw={700}>{f3(r.shortSnfKg)}</Table.Td>
                            <Table.Td ta="right">{r.shortageTrips}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Box>
                )}

                {view === 'centre' && (
                  <Box style={{ overflowX: 'auto' }}>
                    <Text size="xs" c="dimmed" mb="xs">
                      Shortage is pinned to a sub centre only on trips where its cans were tested separately (Sub Centre-wise).
                      “Van total only” trips are in the Route / Van-wise view.
                    </Text>
                    <Table withTableBorder withColumnBorders fz="sm" striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Sub Centre</Table.Th>
                          <Table.Th>Route / Van</Table.Th>
                          <Table.Th ta="right">Sent Qty</Table.Th>
                          <Table.Th ta="right">Tested Separately</Table.Th>
                          <Table.Th ta="right">Van Total Only</Table.Th>
                          <Table.Th ta="right">Awaiting</Table.Th>
                          <Table.Th ta="right">Short Qty</Table.Th>
                          <Table.Th ta="right">Short FAT Kg</Table.Th>
                          <Table.Th ta="right">Short SNF Kg</Table.Th>
                          <Table.Th ta="right">Shortage Trips</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {report.byCentre.map((c) => (
                          <Table.Tr key={c.centreName + c.routeName}>
                            <Table.Td fw={600}>{c.centreName}</Table.Td>
                            <Table.Td>{c.routeName} <Text span size="xs" c="dimmed">({c.vehicleNumber})</Text></Table.Td>
                            <Table.Td ta="right">{f2(c.expectedQty)}</Table.Td>
                            <Table.Td ta="right">{c.tested}</Table.Td>
                            <Table.Td ta="right">{c.vanTotalOnly}</Table.Td>
                            <Table.Td ta="right">{c.awaiting}</Table.Td>
                            <Table.Td ta="right" c={c.shortQty ? 'red' : undefined} fw={700}>{f2(c.shortQty)}</Table.Td>
                            <Table.Td ta="right" c={c.shortFatKg ? 'red' : undefined} fw={700}>{f3(c.shortFatKg)}</Table.Td>
                            <Table.Td ta="right" c={c.shortSnfKg ? 'red' : undefined} fw={700}>{f3(c.shortSnfKg)}</Table.Td>
                            <Table.Td ta="right">{c.shortageTrips}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Box>
                )}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}
