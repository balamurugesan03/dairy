import { useEffect, useState, useRef, useCallback } from 'react';
import { io as socketIO } from 'socket.io-client';
import {
  Box, Title, Text, Group, Stack, Paper, TextInput, Button,
  Badge, Table, ActionIcon, Tooltip, NumberInput, Grid,
  Divider, Alert, ThemeIcon, Loader
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconWifi, IconWifiOff, IconFlask, IconTrash,
  IconSearch, IconRefresh, IconAlertCircle, IconCheck,
  IconDeviceAnalytics
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import dayjs from 'dayjs';
import { milkAnalyzerAPI } from '../../services/api';

const SOCKET_URL = 'http://localhost:5000';
const PAGE_SIZE = 20;

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, unit, color = 'blue' }) => (
  <Paper withBorder p="md" radius="md" style={{ flex: 1, minWidth: 110 }}>
    <Text size="xs" c="dimmed" fw={500} tt="uppercase">{label}</Text>
    <Group align="baseline" gap={4} mt={4}>
      <Text size="xl" fw={700} c={color}>
        {value != null ? value : '—'}
      </Text>
      {unit && <Text size="xs" c="dimmed">{unit}</Text>}
    </Group>
  </Paper>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function MilkAnalyzerDashboard() {
  const [connected, setConnected]     = useState(false);
  const [liveData, setLiveData]       = useState(null);
  const [farmerName, setFarmerName]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [readings, setReadings]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [dateRange, setDateRange]     = useState([null, null]);

  // Manual entry state
  const [manualFat, setManualFat]     = useState('');
  const [manualSnf, setManualSnf]     = useState('');
  const [manualClr, setManualClr]     = useState('');
  const [manualDen, setManualDen]     = useState('');
  const [manualName, setManualName]   = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  const socketRef = useRef(null);

  // ── Socket.io connection ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketIO(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('[MilkAnalyzer] Socket connected');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('[MilkAnalyzer] Socket disconnected');
    });

    socket.on('milk-analyzer-data', (data) => {
      setLiveData(data);
      notifications.show({
        title: 'Milk Analyzer',
        message: `New reading: FAT ${data.fat}% | SNF ${data.snf}%`,
        color: 'teal',
        icon: <IconFlask size={16} />,
        autoClose: 4000
      });
    });

    return () => socket.disconnect();
  }, []);

  // ── Load readings ──────────────────────────────────────────────────────────
  const loadReadings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (dateRange[0]) params.fromDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
      if (dateRange[1]) params.toDate   = dayjs(dateRange[1]).format('YYYY-MM-DD');

      const res = await milkAnalyzerAPI.getAll(params);
      setReadings(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Failed to load readings' });
    } finally {
      setLoading(false);
    }
  }, [page, search, dateRange]);

  useEffect(() => { loadReadings(); }, [loadReadings]);

  // ── Save live reading ──────────────────────────────────────────────────────
  const handleSaveLive = async () => {
    if (!farmerName.trim()) {
      notifications.show({ color: 'orange', message: 'Enter farmer name before saving' });
      return;
    }
    if (!liveData) {
      notifications.show({ color: 'orange', message: 'No live data to save yet' });
      return;
    }
    setSaving(true);
    try {
      await milkAnalyzerAPI.save({
        farmerName: farmerName.trim(),
        fat:     liveData.fat,
        snf:     liveData.snf,
        clr:     liveData.clr,
        density: liveData.density,
        rawData: liveData.rawData,
        source:  'serial'
      });
      notifications.show({ color: 'green', message: 'Reading saved successfully', icon: <IconCheck size={16} /> });
      setFarmerName('');
      setLiveData(null);
      setPage(1);
      loadReadings();
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  // ── Save manual entry ──────────────────────────────────────────────────────
  const handleSaveManual = async () => {
    if (!manualName.trim() || !manualFat || !manualSnf) {
      notifications.show({ color: 'orange', message: 'Farmer name, FAT and SNF are required' });
      return;
    }
    setManualSaving(true);
    try {
      await milkAnalyzerAPI.save({
        farmerName: manualName.trim(),
        fat:     parseFloat(manualFat),
        snf:     parseFloat(manualSnf),
        clr:     manualClr ? parseFloat(manualClr) : null,
        density: manualDen ? parseFloat(manualDen) : null,
        source:  'manual'
      });
      notifications.show({ color: 'green', message: 'Manual reading saved', icon: <IconCheck size={16} /> });
      setManualName(''); setManualFat(''); setManualSnf(''); setManualClr(''); setManualDen('');
      setPage(1);
      loadReadings();
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Save failed' });
    } finally {
      setManualSaving(false);
    }
  };

  // ── Delete reading ─────────────────────────────────────────────────────────
  const handleDelete = (record) => {
    modals.openConfirmModal({
      title: 'Delete Reading',
      children: <Text size="sm">Delete reading for <b>{record.farmerName}</b>?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await milkAnalyzerAPI.delete(record._id);
          notifications.show({ color: 'green', message: 'Deleted' });
          loadReadings();
        } catch (err) {
          notifications.show({ color: 'red', message: err.message || 'Delete failed' });
        }
      }
    });
  };

  const columns = [
    { accessor: 'farmerName', title: 'Farmer Name', width: 180 },
    {
      accessor: 'fat', title: 'FAT (%)', width: 90, textAlign: 'right',
      render: (r) => <Text fw={600} c="blue">{r.fat?.toFixed(2)}</Text>
    },
    {
      accessor: 'snf', title: 'SNF (%)', width: 90, textAlign: 'right',
      render: (r) => <Text fw={600} c="teal">{r.snf?.toFixed(2)}</Text>
    },
    {
      accessor: 'clr', title: 'CLR', width: 80, textAlign: 'right',
      render: (r) => r.clr != null ? r.clr : '—'
    },
    {
      accessor: 'density', title: 'Density', width: 100, textAlign: 'right',
      render: (r) => r.density != null ? r.density.toFixed(3) : '—'
    },
    {
      accessor: 'date', title: 'Date & Time', width: 160,
      render: (r) => dayjs(r.date).format('DD-MM-YYYY HH:mm')
    },
    {
      accessor: 'source', title: 'Source', width: 90,
      render: (r) => (
        <Badge size="xs" color={r.source === 'serial' ? 'teal' : 'gray'} variant="light">
          {r.source}
        </Badge>
      )
    },
    {
      accessor: 'actions', title: '', width: 50, textAlign: 'center',
      render: (r) => (
        <Tooltip label="Delete">
          <ActionIcon color="red" variant="light" size="sm" onClick={() => handleDelete(r)}>
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      )
    }
  ];

  return (
    <Box p="md">
      {/* Header */}
      <Group mb="md" justify="space-between">
        <Group>
          <ThemeIcon size="lg" radius="md" color="teal">
            <IconDeviceAnalytics size={20} />
          </ThemeIcon>
          <Title order={3}>Milk Analyzer</Title>
        </Group>
        <Badge
          size="lg"
          color={connected ? 'teal' : 'red'}
          variant="light"
          leftSection={connected ? <IconWifi size={14} /> : <IconWifiOff size={14} />}
        >
          {connected ? 'Live Connected' : 'Disconnected'}
        </Badge>
      </Group>

      <Grid gutter="md">
        {/* ── Left: Live Reading Panel ───────────────────────── */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            {/* Live Data Card */}
            <Paper withBorder p="md" radius="md">
              <Text fw={600} mb="sm" size="sm">Live Reading (Serial Port)</Text>

              {!liveData ? (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="gray"
                  variant="light"
                  title="Waiting for analyzer data…"
                >
                  Connect the milk analyzer to the configured COM port. Readings will appear here automatically.
                </Alert>
              ) : (
                <>
                  <Group gap="xs" mb="sm" wrap="wrap">
                    <StatCard label="FAT"     value={liveData.fat}     unit="%" color="blue" />
                    <StatCard label="SNF"     value={liveData.snf}     unit="%" color="teal" />
                    <StatCard label="CLR"     value={liveData.clr}     unit=""  color="grape" />
                    <StatCard label="Density" value={liveData.density} unit=""  color="orange" />
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">
                    Received at: {dayjs(liveData.timestamp).format('DD-MM-YYYY HH:mm:ss')}
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm" style={{ fontFamily: 'monospace' }}>
                    Raw: {liveData.rawData}
                  </Text>
                </>
              )}

              <Divider my="sm" />
              <TextInput
                label="Farmer Name"
                placeholder="Enter farmer name to save this reading"
                value={farmerName}
                onChange={(e) => setFarmerName(e.currentTarget.value)}
                mb="sm"
                disabled={!liveData}
              />
              <Button
                fullWidth
                color="teal"
                onClick={handleSaveLive}
                loading={saving}
                disabled={!liveData || !farmerName.trim()}
                leftSection={<IconCheck size={16} />}
              >
                Save Reading
              </Button>
            </Paper>

            {/* Manual Entry Card */}
            <Paper withBorder p="md" radius="md">
              <Text fw={600} mb="sm" size="sm">Manual Entry</Text>
              <Stack gap="xs">
                <TextInput
                  label="Farmer Name"
                  placeholder="Farmer name"
                  value={manualName}
                  onChange={(e) => setManualName(e.currentTarget.value)}
                />
                <Grid gutter="xs">
                  <Grid.Col span={6}>
                    <TextInput label="FAT (%)" placeholder="4.2" value={manualFat}
                      onChange={(e) => setManualFat(e.currentTarget.value)} />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput label="SNF (%)" placeholder="8.5" value={manualSnf}
                      onChange={(e) => setManualSnf(e.currentTarget.value)} />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput label="CLR" placeholder="28" value={manualClr}
                      onChange={(e) => setManualClr(e.currentTarget.value)} />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput label="Density" placeholder="1.028" value={manualDen}
                      onChange={(e) => setManualDen(e.currentTarget.value)} />
                  </Grid.Col>
                </Grid>
                <Button
                  fullWidth
                  color="blue"
                  onClick={handleSaveManual}
                  loading={manualSaving}
                  disabled={!manualName.trim() || !manualFat || !manualSnf}
                >
                  Save Manual Entry
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>

        {/* ── Right: History Table ───────────────────────────── */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder p="md" radius="md">
            <Group mb="sm" justify="space-between">
              <Text fw={600} size="sm">Reading History</Text>
              <Tooltip label="Refresh">
                <ActionIcon variant="light" onClick={loadReadings} loading={loading}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Group mb="sm" gap="xs">
              <TextInput
                placeholder="Search farmer…"
                leftSection={<IconSearch size={14} />}
                value={search}
                onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
                style={{ flex: 1 }}
                size="xs"
              />
              <DatePickerInput
                type="range"
                placeholder="Date range"
                value={dateRange}
                onChange={(val) => { setDateRange(val); setPage(1); }}
                clearable
                size="xs"
                style={{ minWidth: 200 }}
              />
            </Group>

            <DataTable
              records={readings}
              columns={columns}
              totalRecords={total}
              recordsPerPage={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
              fetching={loading}
              minHeight={300}
              fontSize="xs"
              withTableBorder
              withColumnBorders
              striped
              highlightOnHover
              noRecordsText="No readings found"
              idAccessor="_id"
            />
          </Paper>
        </Grid.Col>
      </Grid>
    </Box>
  );
}
