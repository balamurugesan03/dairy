import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Container,
  Group,
  Title,
  Button,
  TextInput,
  Select,
  Modal,
  Stack,
  Text,
  Badge,
  NumberInput,
  ActionIcon,
  Pagination,
  Paper,
  Table,
  Tooltip,
  Box,
  Divider,
  Grid,
  ThemeIcon,
  Tabs,
  SegmentedControl,
  Checkbox,
  Textarea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconRefresh,
  IconTruck,
  IconRoute,
  IconArrowDown,
  IconFlag,
  IconCalculator,
  IconFileSpreadsheet,
  IconBook,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { transportRouteAPI, collectionCenterAPI, ledgerAPI } from '../../services/api';

const PAGE_SIZE = 15;

const emptyStop = () => ({ centre: '', km: '' });

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');
const fmt2 = (n) => Number(n || 0).toFixed(2);
const toYMD = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export default function TransportRouteList() {
  const [tab, setTab] = useState('routes');

  // ── List state ──────────────────────────────────────────────
  const [routes, setRoutes] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterChargeType, setFilterChargeType] = useState('');
  const [listLoading, setListLoading] = useState(false);

  // ── Centres ─────────────────────────────────────────────────
  const [centres, setCentres] = useState([]);

  // ── Modal state ─────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Charges state ───────────────────────────────────────────
  const [chargeRange, setChargeRange] = useState(() => {
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth(), 1), now];
  });
  const [chargeRouteId, setChargeRouteId] = useState('');
  const [allRoutes, setAllRoutes] = useState([]);
  const [charges, setCharges] = useState(null);
  const [chargesLoading, setChargesLoading] = useState(false);

  // ── Ledger posting state ────────────────────────────────────
  const [postDate, setPostDate] = useState(() => new Date());
  const [payMode, setPayMode] = useState('Credit');
  const [bankLedgerId, setBankLedgerId] = useState('');
  const [bankLedgers, setBankLedgers] = useState([]);
  const [posting, setPosting] = useState(false);

  // ── Posted bills state ──────────────────────────────────────
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billRange, setBillRange] = useState(() => {
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth() - 2, 1), now];
  });

  const form = useForm({
    initialValues: {
      routeCode: '',
      routeName: '',
      vehicleNumber: '',
      vehicleType: '',
      driverName: '',
      driverMobile: '',
      ownerName: '',
      ownerMobile: '',
      stops: [emptyStop()],
      destination: '',
      chargeType: 'KM',
      ratePerKm: '',
      ratePerLitre: '',
      shifts: ['AM', 'PM'],
      wefDate: new Date(),
      status: 'Active',
      remarks: '',
    },
    validate: {
      routeName: (v) => (!v?.trim() ? 'Route name is required' : null),
      vehicleNumber: (v) => (!v?.trim() ? 'Van number is required' : null),
      destination: (v) => (!v ? 'Select final destination' : null),
      wefDate: (v) => (!v ? 'Date W.E.F is required' : null),
      shifts: (v) => (!v?.length ? 'Select at least one shift' : null),
      ratePerKm: (v, values) => (values.chargeType === 'KM' && !(Number(v) > 0) ? 'Enter rate per KM' : null),
      ratePerLitre: (v, values) => (values.chargeType === 'Litre' && !(Number(v) > 0) ? 'Enter rate per litre' : null),
    },
  });

  // ── Fetch centres ───────────────────────────────────────────
  useEffect(() => {
    collectionCenterAPI.getAll({ limit: 1000, status: 'Active' })
      .then((res) => setCentres(res.data || []))
      .catch(() => setCentres([]));
  }, []);

  const centreOptions = centres.map((c) => ({
    value: c._id,
    label: `${c.centerName}${c.centerType === 'Head Office' ? ' (Head Office)' : ''}`,
  }));
  const subCentreOptions = centres
    .filter((c) => c.centerType !== 'Head Office')
    .map((c) => ({ value: c._id, label: c.centerName }));
  const headOffice = centres.find((c) => c.centerType === 'Head Office');

  // ── Fetch routes ────────────────────────────────────────────
  const fetchRoutes = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (filterChargeType) params.chargeType = filterChargeType;
      const res = await transportRouteAPI.getAll(params);
      setRoutes(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load routes', color: 'red' });
    } finally {
      setListLoading(false);
    }
  }, [page, search, filterChargeType]);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  useEffect(() => {
    if (tab !== 'charges') return;
    transportRouteAPI.getAll({ limit: 1000 })
      .then((res) => setAllRoutes(res.data || []))
      .catch(() => setAllRoutes([]));
    ledgerAPI.getAll({ ledgerType: 'Bank', status: 'Active', limit: 100 })
      .then((res) => setBankLedgers((res?.data || []).map((l) => ({ value: l._id, label: l.ledgerName }))))
      .catch(() => setBankLedgers([]));
  }, [tab]);

  const fetchBills = useCallback(async () => {
    const [from, to] = billRange || [];
    setBillsLoading(true);
    try {
      const params = {};
      if (from) params.fromDate = toYMD(from);
      if (to) params.toDate = toYMD(to);
      const res = await transportRouteAPI.getBills(params);
      setBills(res.data || []);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load posted bills', color: 'red' });
    } finally {
      setBillsLoading(false);
    }
  }, [billRange]);

  useEffect(() => {
    if (tab === 'bills') fetchBills();
  }, [tab, fetchBills]);

  // ── Modal open helpers ──────────────────────────────────────
  const openAdd = () => {
    setEditRecord(null);
    form.reset();
    if (headOffice) form.setFieldValue('destination', headOffice._id);
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditRecord(r);
    form.setValues({
      routeCode: r.routeCode || '',
      routeName: r.routeName || '',
      vehicleNumber: r.vehicleNumber || '',
      vehicleType: r.vehicleType || '',
      driverName: r.driverName || '',
      driverMobile: r.driverMobile || '',
      ownerName: r.ownerName || '',
      ownerMobile: r.ownerMobile || '',
      stops: r.stops?.length ? r.stops.map((s) => ({ centre: s.centre, km: s.km })) : [emptyStop()],
      destination: r.destination || '',
      chargeType: r.chargeType || 'KM',
      ratePerKm: r.ratePerKm || '',
      ratePerLitre: r.ratePerLitre || '',
      shifts: r.shifts?.length ? r.shifts : ['AM', 'PM'],
      wefDate: r.wefDate ? new Date(r.wefDate) : new Date(),
      status: r.status || 'Active',
      remarks: r.remarks || '',
    });
    setModalOpen(true);
  };

  const formTotalKm = form.values.stops.reduce((s, st) => s + (Number(st.km) || 0), 0);

  const handleSubmit = async (values) => {
    const stops = values.stops.filter((s) => s.centre);
    if (!stops.length) {
      notifications.show({ title: 'Route', message: 'Add at least one sub centre', color: 'orange' });
      return;
    }
    const ids = stops.map((s) => s.centre);
    if (new Set(ids).size !== ids.length) {
      notifications.show({ title: 'Route', message: 'A sub centre is added twice', color: 'orange' });
      return;
    }
    if (ids.includes(values.destination)) {
      notifications.show({ title: 'Route', message: 'Destination cannot also be a pickup stop', color: 'orange' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...values,
        stops: stops.map((s) => ({ centre: s.centre, km: Number(s.km) || 0 })),
        ratePerKm: Number(values.ratePerKm) || 0,
        ratePerLitre: Number(values.ratePerLitre) || 0,
        wefDate: toYMD(values.wefDate),
      };
      if (editRecord) {
        await transportRouteAPI.update(editRecord._id, payload);
        notifications.show({ title: 'Updated', message: 'Route updated', color: 'teal' });
      } else {
        await transportRouteAPI.create(payload);
        notifications.show({ title: 'Saved', message: 'Route added', color: 'teal' });
      }
      setModalOpen(false);
      fetchRoutes();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Save failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (r) => {
    modals.openConfirmModal({
      title: 'Delete Route',
      children: <Text size="sm">Delete route <b>{r.routeName}</b> ({r.vehicleNumber})?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await transportRouteAPI.delete(r._id);
          notifications.show({ title: 'Deleted', message: 'Route deleted', color: 'teal' });
          fetchRoutes();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message || 'Delete failed', color: 'red' });
        }
      },
    });
  };

  // ── Charges ─────────────────────────────────────────────────
  const loadCharges = async () => {
    const [from, to] = chargeRange || [];
    if (!from || !to) {
      notifications.show({ title: 'Period', message: 'Select from and to dates', color: 'orange' });
      return;
    }
    setChargesLoading(true);
    try {
      const params = { fromDate: toYMD(from), toDate: toYMD(to) };
      if (chargeRouteId) params.routeId = chargeRouteId;
      const res = await transportRouteAPI.getCharges(params);
      // Remember the calculated period so posting can't use a range edited after Calculate
      setCharges({ ...res.data, fromDate: params.fromDate, toDate: params.toDate });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to calculate', color: 'red' });
    } finally {
      setChargesLoading(false);
    }
  };

  const postableRows = (charges?.rows || []).filter((r) => r.amount > 0 && !r.postedBills?.length);
  const postableTotal = postableRows.reduce((s, r) => s + r.amount, 0);

  const postToLedger = () => {
    if (!postableRows.length) return;
    if (payMode === 'Bank' && !bankLedgerId) {
      notifications.show({ title: 'Bank', message: 'Select a bank ledger', color: 'orange' });
      return;
    }
    const creditSide = payMode === 'Credit' ? 'TRANSPORT CHARGES PAYABLE'
      : payMode === 'Cash' ? 'Cash in Hand'
      : bankLedgers.find((b) => b.value === bankLedgerId)?.label;
    modals.openConfirmModal({
      title: 'Post Transport Charges to Ledger',
      children: (
        <Stack gap={4}>
          <Text size="sm">
            Period {fmtDate(charges.fromDate)} – {fmtDate(charges.toDate)}: {postableRows.length} route(s),
            total <b>₹{fmt2(postableTotal)}</b>, voucher date {fmtDate(postDate)}.
          </Text>
          <Text size="sm">Dr <b>TRANSPORT CHARGES</b> / Cr <b>{creditSide}</b></Text>
          <Text size="xs" c="dimmed">One {payMode === 'Credit' ? 'Journal' : 'Payment'} voucher per route.</Text>
        </Stack>
      ),
      labels: { confirm: 'Post', cancel: 'Cancel' },
      confirmProps: { color: 'teal' },
      onConfirm: async () => {
        setPosting(true);
        try {
          const res = await transportRouteAPI.postCharges({
            fromDate: charges.fromDate,
            toDate: charges.toDate,
            voucherDate: toYMD(postDate),
            payMode,
            bankLedgerId: payMode === 'Bank' ? bankLedgerId : undefined,
            routeIds: postableRows.map((r) => r.routeId),
          });
          const skipped = res.data?.skipped || [];
          notifications.show({
            title: 'Posted',
            message: res.message + (skipped.length ? ` — ${skipped.map((s) => `${s.routeName}: ${s.reason}`).join('; ')}` : ''),
            color: skipped.length ? 'orange' : 'teal',
            autoClose: skipped.length ? 8000 : 4000,
          });
          loadCharges();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message || 'Posting failed', color: 'red' });
        } finally {
          setPosting(false);
        }
      },
    });
  };

  const reverseBill = (b) => {
    modals.openConfirmModal({
      title: 'Reverse Posting',
      children: (
        <Text size="sm">
          Reverse voucher <b>{b.voucherNumber}</b> for {b.routeName} ({fmtDate(b.fromDate)} – {fmtDate(b.toDate)}),
          ₹{fmt2(b.amount)}? The voucher will be deleted and ledger balances reversed.
        </Text>
      ),
      labels: { confirm: 'Reverse', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await transportRouteAPI.deleteBill(b._id);
          notifications.show({ title: 'Reversed', message: 'Posting reversed', color: 'teal' });
          fetchBills();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message || 'Reverse failed', color: 'red' });
        }
      },
    });
  };

  const exportCharges = () => {
    if (!charges?.rows?.length) return;
    const data = charges.rows.map((r, i) => ({
      'Sl.No': i + 1,
      'Route': r.routeName,
      'Van No': r.vehicleNumber,
      'Driver': r.driverName || '',
      'Sub Centres': r.centres.map((c) => c.centreName).join(' → '),
      'Destination': r.destinationName || '',
      'Charge Type': r.chargeType === 'KM' ? 'Per KM' : 'Per Litre',
      'Rate': r.rate,
      'Route KM': r.totalKm,
      'Trips': r.trips,
      'Total KM': r.km,
      'Litres': r.litres,
      'Amount': r.amount,
    }));
    data.push({
      'Sl.No': '', 'Route': 'TOTAL', 'Trips': charges.totals.trips,
      'Total KM': Number(fmt2(charges.totals.km)), 'Litres': Number(fmt2(charges.totals.litres)),
      'Amount': Number(fmt2(charges.totals.amount)),
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transport Charges');
    XLSX.writeFile(wb, `Transport_Charges_${toYMD(chargeRange[0])}_to_${toYMD(chargeRange[1])}.xlsx`);
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">
      <Paper shadow="sm" radius="md" p="lg" withBorder>
        <Group justify="space-between" mb="md" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" color="teal" variant="light">
              <IconTruck size={22} />
            </ThemeIcon>
            <Box>
              <Title order={3} lh={1}>Transport</Title>
              <Text size="xs" c="dimmed">
                Milk van routes from sub centres to main centre — KM wise or Litre wise pricing
              </Text>
            </Box>
          </Group>
          {tab === 'routes' && (
            <Group gap="sm">
              <Text size="sm" c="dimmed" fw={500}>
                {total} {total === 1 ? 'route' : 'routes'}
              </Text>
              <Button leftSection={<IconPlus size={16} />} color="teal" radius="md" onClick={openAdd}>
                Add Route
              </Button>
            </Group>
          )}
        </Group>

        <Tabs value={tab} onChange={setTab} color="teal">
          <Tabs.List mb="md">
            <Tabs.Tab value="routes" leftSection={<IconRoute size={15} />}>Routes</Tabs.Tab>
            <Tabs.Tab value="charges" leftSection={<IconCalculator size={15} />}>Transport Charges</Tabs.Tab>
            <Tabs.Tab value="bills" leftSection={<IconBook size={15} />}>Posted Bills</Tabs.Tab>
          </Tabs.List>

          {/* ═════════════ ROUTES ═════════════ */}
          <Tabs.Panel value="routes">
            <Grid mb="md" gutter="sm">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Select
                  placeholder="All Charge Types"
                  data={[
                    { value: '', label: 'All Charge Types' },
                    { value: 'KM', label: 'Per KM' },
                    { value: 'Litre', label: 'Per Litre' },
                  ]}
                  value={filterChargeType}
                  onChange={(v) => { setFilterChargeType(v || ''); setPage(1); }}
                  radius="md"
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 7 }}>
                <TextInput
                  placeholder="Search by route, van number, driver..."
                  leftSection={<IconSearch size={15} />}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  radius="md"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 1 }}>
                <Tooltip label="Refresh">
                  <ActionIcon
                    variant="light"
                    color="teal"
                    size="lg"
                    onClick={fetchRoutes}
                    loading={listLoading}
                    radius="md"
                    style={{ width: '100%', height: 36 }}
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              </Grid.Col>
            </Grid>

            <Box style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={55}>Sl.No</Table.Th>
                    <Table.Th>Route</Table.Th>
                    <Table.Th>Van No</Table.Th>
                    <Table.Th>Driver</Table.Th>
                    <Table.Th>From (Sub Centres) → To</Table.Th>
                    <Table.Th ta="right">KM</Table.Th>
                    <Table.Th>Pricing</Table.Th>
                    <Table.Th>Shifts</Table.Th>
                    <Table.Th>W.E.F</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th w={80}>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {listLoading ? (
                    <Table.Tr>
                      <Table.Td colSpan={11} ta="center" py="xl" c="dimmed">Loading...</Table.Td>
                    </Table.Tr>
                  ) : routes.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={11} ta="center" py="xl" c="dimmed">
                        No routes found.{' '}
                        <Text span c="teal" style={{ cursor: 'pointer' }} onClick={openAdd}>Add the first one.</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : routes.map((r, i) => (
                    <Table.Tr key={r._id}>
                      <Table.Td>{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{r.routeName}</Text>
                        {r.routeCode && <Text size="xs" c="dimmed">{r.routeCode}</Text>}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>{r.vehicleNumber}</Text>
                        {r.vehicleType && <Text size="xs" c="dimmed">{r.vehicleType}</Text>}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{r.driverName || '-'}</Text>
                        {r.driverMobile && <Text size="xs" c="dimmed">{r.driverMobile}</Text>}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {r.stops.map((s) => s.centreName).join(' → ')}
                          {' → '}<b>{r.destinationName || '-'}</b>
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">{fmt2(r.totalKm)}</Table.Td>
                      <Table.Td>
                        {r.chargeType === 'KM' ? (
                          <Badge color="blue" variant="light">₹{fmt2(r.ratePerKm)} / KM</Badge>
                        ) : (
                          <Badge color="grape" variant="light">₹{fmt2(r.ratePerLitre)} / Litre</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>{(r.shifts || []).join(', ')}</Table.Td>
                      <Table.Td>{fmtDate(r.wefDate)}</Table.Td>
                      <Table.Td>
                        <Badge color={r.status === 'Active' ? 'teal' : 'gray'} variant="light">{r.status}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Edit">
                            <ActionIcon variant="light" color="blue" onClick={() => openEdit(r)}>
                              <IconEdit size={15} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon variant="light" color="red" onClick={() => confirmDelete(r)}>
                              <IconTrash size={15} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>

            {totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination value={page} onChange={setPage} total={totalPages} color="teal" radius="md" />
              </Group>
            )}
          </Tabs.Panel>

          {/* ═════════════ CHARGES ═════════════ */}
          <Tabs.Panel value="charges">
            <Grid mb="md" gutter="sm" align="flex-end">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <DatePickerInput
                  type="range"
                  label="Period"
                  valueFormat="DD/MM/YYYY"
                  value={chargeRange}
                  onChange={setChargeRange}
                  radius="md"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Select
                  label="Route"
                  placeholder="All active routes"
                  data={allRoutes.map((r) => ({ value: r._id, label: `${r.routeName} (${r.vehicleNumber})` }))}
                  value={chargeRouteId}
                  onChange={(v) => setChargeRouteId(v || '')}
                  searchable
                  clearable
                  radius="md"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Group gap="sm">
                  <Button leftSection={<IconCalculator size={16} />} color="teal" radius="md" onClick={loadCharges} loading={chargesLoading}>
                    Calculate
                  </Button>
                  <Button
                    leftSection={<IconFileSpreadsheet size={16} />}
                    variant="light"
                    color="green"
                    radius="md"
                    onClick={exportCharges}
                    disabled={!charges?.rows?.length}
                  >
                    Excel
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>

            <Text size="xs" c="dimmed" mb="sm">
              Per KM: trips × route KM × rate (one trip = one date + shift with milk collected at the route's sub centres).
              Per Litre: litres collected at the route's sub centres × rate. Counted from each route's W.E.F date.
            </Text>

            <Box style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={55}>Sl.No</Table.Th>
                    <Table.Th>Route / Van</Table.Th>
                    <Table.Th>Sub Centres (Litres)</Table.Th>
                    <Table.Th>Destination</Table.Th>
                    <Table.Th>Pricing</Table.Th>
                    <Table.Th ta="right">Trips</Table.Th>
                    <Table.Th ta="right">Total KM</Table.Th>
                    <Table.Th ta="right">Litres</Table.Th>
                    <Table.Th ta="right">Amount (₹)</Table.Th>
                    <Table.Th>Ledger</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {!charges ? (
                    <Table.Tr>
                      <Table.Td colSpan={10} ta="center" py="xl" c="dimmed">Select a period and click Calculate.</Table.Td>
                    </Table.Tr>
                  ) : charges.rows.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={10} ta="center" py="xl" c="dimmed">No active routes.</Table.Td>
                    </Table.Tr>
                  ) : charges.rows.map((r, i) => (
                    <Table.Tr key={r.routeId}>
                      <Table.Td>{i + 1}</Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{r.routeName}</Text>
                        <Text size="xs" c="dimmed">{r.vehicleNumber}{r.driverName ? ` · ${r.driverName}` : ''}</Text>
                      </Table.Td>
                      <Table.Td>
                        {r.centres.map((c) => (
                          <Text size="xs" key={c.centreName}>{c.centreName}: {fmt2(c.litres)} L</Text>
                        ))}
                      </Table.Td>
                      <Table.Td>{r.destinationName || '-'}</Table.Td>
                      <Table.Td>
                        {r.chargeType === 'KM'
                          ? <Badge color="blue" variant="light">₹{fmt2(r.rate)} / KM × {fmt2(r.totalKm)} KM</Badge>
                          : <Badge color="grape" variant="light">₹{fmt2(r.rate)} / Litre</Badge>}
                      </Table.Td>
                      <Table.Td ta="right">{r.trips}</Table.Td>
                      <Table.Td ta="right">{fmt2(r.km)}</Table.Td>
                      <Table.Td ta="right">{fmt2(r.litres)}</Table.Td>
                      <Table.Td ta="right" fw={600}>{fmt2(r.amount)}</Table.Td>
                      <Table.Td>
                        {r.postedBills?.length ? (
                          r.postedBills.map((b) => (
                            <Tooltip key={b._id} label={`${fmtDate(b.fromDate)} – ${fmtDate(b.toDate)} · ₹${fmt2(b.amount)}`}>
                              <Badge color="teal" variant="light" size="sm">{b.voucherNumber || 'Posted'}</Badge>
                            </Tooltip>
                          ))
                        ) : r.amount > 0 ? (
                          <Badge color="orange" variant="light" size="sm">Not posted</Badge>
                        ) : '-'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                {charges?.rows?.length > 0 && (
                  <Table.Tfoot>
                    <Table.Tr style={{ fontWeight: 700 }}>
                      <Table.Td colSpan={5} ta="right">TOTAL</Table.Td>
                      <Table.Td ta="right">{charges.totals.trips}</Table.Td>
                      <Table.Td ta="right">{fmt2(charges.totals.km)}</Table.Td>
                      <Table.Td ta="right">{fmt2(charges.totals.litres)}</Table.Td>
                      <Table.Td ta="right">{fmt2(charges.totals.amount)}</Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  </Table.Tfoot>
                )}
              </Table>
            </Box>

            {charges?.rows?.length > 0 && (
              <Paper withBorder radius="md" p="md" mt="md" bg="gray.0">
                <Group gap="xs" mb="sm">
                  <IconBook size={16} />
                  <Text fw={600} size="sm">Post to Ledger</Text>
                  <Text size="xs" c="dimmed">
                    — Dr TRANSPORT CHARGES / Cr {payMode === 'Credit' ? 'TRANSPORT CHARGES PAYABLE' : payMode === 'Cash' ? 'Cash in Hand' : 'Bank'}
                  </Text>
                </Group>
                <Grid gutter="sm" align="flex-end">
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <DatePickerInput
                      label="Voucher Date"
                      valueFormat="DD/MM/YYYY"
                      value={postDate}
                      onChange={setPostDate}
                      radius="md"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <Select
                      label="Payment"
                      data={[
                        { value: 'Credit', label: 'Credit (Payable)' },
                        { value: 'Cash', label: 'Cash' },
                        { value: 'Bank', label: 'Bank' },
                      ]}
                      value={payMode}
                      onChange={(v) => setPayMode(v || 'Credit')}
                      allowDeselect={false}
                      radius="md"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    {payMode === 'Bank' && (
                      <Select
                        label="Bank Ledger"
                        placeholder="Select bank"
                        data={bankLedgers}
                        value={bankLedgerId}
                        onChange={(v) => setBankLedgerId(v || '')}
                        searchable
                        radius="md"
                      />
                    )}
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <Button
                      fullWidth
                      color="teal"
                      radius="md"
                      leftSection={<IconBook size={16} />}
                      onClick={postToLedger}
                      loading={posting}
                      disabled={!postableRows.length || !postDate}
                    >
                      Post ₹{fmt2(postableTotal)}
                    </Button>
                  </Grid.Col>
                </Grid>
                {!postableRows.length && (
                  <Text size="xs" c="dimmed" mt="xs">Nothing to post — every route is already posted or has no charges.</Text>
                )}
              </Paper>
            )}
          </Tabs.Panel>

          {/* ═════════════ POSTED BILLS ═════════════ */}
          <Tabs.Panel value="bills">
            <Grid mb="md" gutter="sm" align="flex-end">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <DatePickerInput
                  type="range"
                  label="Voucher Date"
                  valueFormat="DD/MM/YYYY"
                  value={billRange}
                  onChange={setBillRange}
                  radius="md"
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 1 }}>
                <Tooltip label="Refresh">
                  <ActionIcon
                    variant="light"
                    color="teal"
                    size="lg"
                    onClick={fetchBills}
                    loading={billsLoading}
                    radius="md"
                    style={{ width: '100%', height: 36 }}
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              </Grid.Col>
            </Grid>

            <Box style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={55}>Sl.No</Table.Th>
                    <Table.Th>Voucher</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Route / Van</Table.Th>
                    <Table.Th>Period</Table.Th>
                    <Table.Th>Basis</Table.Th>
                    <Table.Th>Payment</Table.Th>
                    <Table.Th ta="right">Amount (₹)</Table.Th>
                    <Table.Th w={70}>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {billsLoading ? (
                    <Table.Tr>
                      <Table.Td colSpan={9} ta="center" py="xl" c="dimmed">Loading...</Table.Td>
                    </Table.Tr>
                  ) : bills.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={9} ta="center" py="xl" c="dimmed">No posted bills in this period.</Table.Td>
                    </Table.Tr>
                  ) : bills.map((b, i) => (
                    <Table.Tr key={b._id}>
                      <Table.Td>{i + 1}</Table.Td>
                      <Table.Td fw={500}>{b.voucherNumber || '-'}</Table.Td>
                      <Table.Td>{fmtDate(b.voucherDate)}</Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{b.routeName}</Text>
                        <Text size="xs" c="dimmed">{b.vehicleNumber}</Text>
                      </Table.Td>
                      <Table.Td>{fmtDate(b.fromDate)} – {fmtDate(b.toDate)}</Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {b.chargeType === 'KM'
                            ? `${b.trips} trips · ${fmt2(b.km)} KM @ ₹${fmt2(b.rate)}`
                            : `${fmt2(b.litres)} L @ ₹${fmt2(b.rate)}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {b.payMode === 'Bank' ? `Bank — ${b.bankLedgerId?.ledgerName || ''}` : b.payMode === 'Credit' ? 'Credit (Payable)' : 'Cash'}
                      </Table.Td>
                      <Table.Td ta="right" fw={600}>{fmt2(b.amount)}</Table.Td>
                      <Table.Td>
                        <Tooltip label="Reverse posting">
                          <ActionIcon variant="light" color="red" onClick={() => reverseBill(b)}>
                            <IconArrowBackUp size={15} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                {bills.length > 0 && (
                  <Table.Tfoot>
                    <Table.Tr style={{ fontWeight: 700 }}>
                      <Table.Td colSpan={7} ta="right">TOTAL</Table.Td>
                      <Table.Td ta="right">{fmt2(bills.reduce((s, b) => s + b.amount, 0))}</Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  </Table.Tfoot>
                )}
              </Table>
            </Box>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      {/* ═════════════ ADD / EDIT MODAL ═════════════ */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text fw={700}>{editRecord ? 'Edit Route' : 'Add Route'}</Text>}
        size="xl"
        radius="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="sm">
            <Divider label="Route & Vehicle" labelPosition="left" />
            <Grid gutter="sm">
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput label="Route Code" placeholder="R01" {...form.getInputProps('routeCode')} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 5 }}>
                <TextInput label="Route Name" withAsterisk placeholder="North Route" {...form.getInputProps('routeName')} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput label="Van Number" withAsterisk placeholder="TN 00 AB 1234" {...form.getInputProps('vehicleNumber')} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput label="Vehicle Type" placeholder="Tempo / Pickup" {...form.getInputProps('vehicleType')} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 5 }}>
                <TextInput label="Driver Name" {...form.getInputProps('driverName')} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput label="Driver Mobile" {...form.getInputProps('driverMobile')} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 8 }}>
                <TextInput label="Owner / Contractor" {...form.getInputProps('ownerName')} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput label="Owner Mobile" {...form.getInputProps('ownerMobile')} />
              </Grid.Col>
            </Grid>

            <Divider label="Route Details (pickup order)" labelPosition="left" mt="xs" />
            <Text size="xs" c="dimmed">
              Add sub centres in the order the van collects milk. KM = distance from that centre to the next stop
              (for the last centre, to the destination).
            </Text>
            {form.values.stops.map((stop, idx) => (
              <Group key={idx} gap="xs" align="flex-end" wrap="nowrap">
                <Badge variant="light" color="teal" w={36} mb={8}>{idx + 1}</Badge>
                <Select
                  style={{ flex: 1 }}
                  label={idx === 0 ? 'From (Sub Centre)' : undefined}
                  placeholder="Select sub centre"
                  data={subCentreOptions}
                  searchable
                  {...form.getInputProps(`stops.${idx}.centre`)}
                />
                <NumberInput
                  w={130}
                  label={idx === 0 ? 'KM to next' : undefined}
                  min={0}
                  decimalScale={2}
                  hideControls
                  {...form.getInputProps(`stops.${idx}.km`)}
                />
                <ActionIcon
                  color="red"
                  variant="light"
                  size="lg"
                  mb={2}
                  disabled={form.values.stops.length === 1}
                  onClick={() => form.removeListItem('stops', idx)}
                >
                  <IconTrash size={15} />
                </ActionIcon>
              </Group>
            ))}
            <Group justify="space-between">
              <Button
                variant="subtle"
                color="teal"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => form.insertListItem('stops', emptyStop())}
              >
                Add Sub Centre
              </Button>
              <IconArrowDown size={16} color="gray" />
              <Text size="sm" fw={600}>Total KM: {fmt2(formTotalKm)}</Text>
            </Group>
            <Select
              label="To (Final Destination)"
              withAsterisk
              leftSection={<IconFlag size={15} />}
              placeholder="Main centre"
              data={centreOptions}
              searchable
              {...form.getInputProps('destination')}
            />

            <Divider label="Pricing" labelPosition="left" mt="xs" />
            <Grid gutter="sm" align="flex-end">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Text size="sm" fw={500} mb={4}>Charge Type</Text>
                <SegmentedControl
                  fullWidth
                  color="teal"
                  data={[{ value: 'KM', label: 'Per KM' }, { value: 'Litre', label: 'Per Litre' }]}
                  {...form.getInputProps('chargeType')}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                {form.values.chargeType === 'KM' ? (
                  <NumberInput
                    label="Rate per KM (₹)"
                    withAsterisk
                    min={0}
                    decimalScale={2}
                    hideControls
                    {...form.getInputProps('ratePerKm')}
                  />
                ) : (
                  <NumberInput
                    label="Rate per Litre (₹)"
                    withAsterisk
                    min={0}
                    decimalScale={3}
                    hideControls
                    {...form.getInputProps('ratePerLitre')}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <DatePickerInput
                  label="Date W.E.F"
                  withAsterisk
                  valueFormat="DD/MM/YYYY"
                  {...form.getInputProps('wefDate')}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Checkbox.Group label="Shifts (trips)" {...form.getInputProps('shifts')}>
                  <Group mt={6}>
                    <Checkbox value="AM" label="Morning" />
                    <Checkbox value="PM" label="Evening" />
                  </Group>
                </Checkbox.Group>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Select
                  label="Status"
                  data={['Active', 'Inactive']}
                  allowDeselect={false}
                  {...form.getInputProps('status')}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                {form.values.chargeType === 'KM' && (
                  <Text size="sm" c="dimmed">
                    Per trip: ₹{fmt2(formTotalKm * (Number(form.values.ratePerKm) || 0))}
                  </Text>
                )}
              </Grid.Col>
            </Grid>
            <Textarea label="Remarks" autosize minRows={1} {...form.getInputProps('remarks')} />

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" color="teal" loading={saving}>{editRecord ? 'Update' : 'Save'}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
