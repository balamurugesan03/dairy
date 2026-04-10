import { useState, useEffect } from 'react';
import {
  Container, Card, Paper, Title, Text, Group, Stack, Grid, Box,
  Button, Select, Checkbox, Table, ScrollArea, Badge, NumberInput,
  Loader, Center, Tabs, ActionIcon, Menu, Pagination, Modal
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { bankTransferAPI } from '../../services/api';
import {
  IconBuildingBank, IconCash, IconCheck, IconX, IconEye,
  IconRefresh, IconPrinter, IconDotsVertical,
  IconChevronLeft, IconChevronRight, IconCoins
} from '@tabler/icons-react';

// ─── helpers ────────────────────────────────────────────────────────────────
const getCyclePeriod = (cycle, refDate) => {
  const d   = dayjs(refDate);
  const yr  = d.year();
  const mo  = d.month();
  const day = d.date();
  const eom = dayjs(new Date(yr, mo + 1, 0));
  if (cycle === '7d') {
    if (day <= 7)  return [new Date(yr, mo, 1),  new Date(yr, mo, 7)];
    if (day <= 14) return [new Date(yr, mo, 8),  new Date(yr, mo, 14)];
    if (day <= 21) return [new Date(yr, mo, 15), new Date(yr, mo, 21)];
    return            [new Date(yr, mo, 22), eom.toDate()];
  }
  if (cycle === '10d') {
    if (day <= 10) return [new Date(yr, mo, 1),  new Date(yr, mo, 10)];
    if (day <= 20) return [new Date(yr, mo, 11), new Date(yr, mo, 20)];
    return            [new Date(yr, mo, 21), eom.toDate()];
  }
  if (cycle === '15d') {
    if (day <= 15) return [new Date(yr, mo, 1),  new Date(yr, mo, 15)];
    return            [new Date(yr, mo, 16), eom.toDate()];
  }
  return [new Date(yr, mo, 1), eom.toDate()];
};

const fmt = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

const STATUS_COLOR = { Draft: 'gray', Retrieved: 'blue', Applied: 'yellow', Completed: 'green', Cancelled: 'red' };

const MODES = [
  { value: 'Bank Transfer', label: 'Bank' },
  { value: 'Cash',          label: 'Cash' },
  { value: 'Cheque',        label: 'Cheque' },
];

const CYCLES = [
  { value: '7d',  label: '7 Days'  },
  { value: '10d', label: '10 Days' },
  { value: '15d', label: '15 Days' },
  { value: '1m',  label: '1 Month' },
];

// ─── component ──────────────────────────────────────────────────────────────
const BankTransferManagement = () => {
  const [activeTab, setActiveTab] = useState('transfer');

  /* date / cycle */
  const [cycle,     setCycle]     = useState('15d');
  const [fromDate,  setFromDate]  = useState(null);
  const [toDate,    setToDate]    = useState(null);
  const [applyDate, setApplyDate] = useState(new Date());

  // safely convert dayjs or Date → ISO string
  const toISO = (d) => { if (!d) return undefined; return (typeof d.toISOString === 'function') ? d.toISOString() : d.toDate ? d.toDate().toISOString() : new Date(d).toISOString(); };

  /* filters */
  const [collectionCenter, setCollectionCenter] = useState('all');
  const [bankFilter,       setBankFilter]       = useState('all');
  const [roundDown,        setRoundDown]        = useState(0);
  const [dueByList,        setDueByList]        = useState(true);

  /* data */
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [applying,   setApplying]   = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  /* dropdown options */
  const [centers,        setCenters]        = useState([]);
  const [banks,          setBanks]          = useState([]);
  const [pendingPeriods, setPendingPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  /* log tab */
  const [logs,       setLogs]       = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage,    setLogPage]    = useState(1);
  const [logPages,   setLogPages]   = useState(1);
  const [logFilters, setLogFilters] = useState({ status: '', fromDate: null, toDate: null });

  /* modals */
  const [viewModal,  setViewModal]  = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [printModal, setPrintModal] = useState(false);
  const [printMode,  setPrintMode]  = useState('all');

  // ── init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const [f, t] = getCyclePeriod('15d', new Date());
    setFromDate(f);
    setToDate(t);
    loadDropdowns();
  }, []);

  // reload pending periods whenever transfer tab is opened
  useEffect(() => {
    if (activeTab === 'transfer') loadPendingPeriods();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'log') loadLogs();
  }, [activeTab, logPage, logFilters]);

  // ── cycle helpers ─────────────────────────────────────────────────────────
  const applyCycle = (c) => {
    setCycle(c);
    const ref = fromDate || new Date();
    const [f, t] = getCyclePeriod(c, ref);
    setFromDate(f);
    setToDate(t);
    clearData();
  };

  const navigatePeriod = (dir) => {
    const ref = dir === 'next'
      ? dayjs(toDate).add(1, 'day').toDate()
      : dayjs(fromDate).subtract(1, 'day').toDate();
    const [f, t] = getCyclePeriod(cycle, ref);
    setFromDate(f);
    setToDate(t);
    clearData();
  };

  const clearData = () => { setRows([]); setDataLoaded(false); };

  // ── select a pending period from dropdown → auto-set dates ───────────────
  const selectPeriod = (val) => {
    setSelectedPeriod(val);
    if (!val) return;
    const p = pendingPeriods.find(
      (x) => `${x.fromDate}|${x.toDate}` === val
    );
    if (!p) return;
    const f = new Date(p.fromDate);
    const t = new Date(p.toDate);
    setFromDate(f);
    setToDate(t);
    setApplyDate(new Date());
    clearData();
  };

  const periodLabel = fromDate && toDate
    ? `${dayjs(fromDate).format('DD/MM/YY')} – ${dayjs(toDate).format('DD/MM/YY')}`
    : '';

  // ── load pending periods from register-ledger ─────────────────────────────
  const loadPendingPeriods = async () => {
    try {
      const res = await bankTransferAPI.getPendingPeriods();
      if (res?.success && res.data?.length > 0) {
        setPendingPeriods(res.data);
      } else {
        setPendingPeriods([]);
      }
    } catch { /* silent */ }
  };

  // ── load dropdowns ────────────────────────────────────────────────────────
  const loadDropdowns = async () => {
    try {
      const [cRes, bRes] = await Promise.all([
        bankTransferAPI.getCollectionCenters(),
        bankTransferAPI.getBanks(),
      ]);
      if (cRes?.success) {
        setCenters([
          { value: 'all', label: 'All Centers' },
          ...cRes.data.map(c => ({ value: c._id, label: c.name || c.centerName || 'Center' })),
        ]);
      }
      if (bRes?.success) {
        setBanks([
          { value: 'all', label: 'All Banks' },
          ...bRes.data.map(b => ({ value: b.name, label: `${b.name} (${b.count || 0})` })),
        ]);
      }
    } catch { /* silent */ }
  };

  // ── load data ─────────────────────────────────────────────────────────────
  const loadData = async () => {
    if (!fromDate || !toDate) {
      notifications.show({ title: 'Select dates', message: 'Choose From and To dates first', color: 'orange' });
      return;
    }
    setLoading(true);
    try {
      const res = await bankTransferAPI.retrieve({
        transferBasis:    'As on Date Balance',
        asOnDate:         toISO(toDate),
        applyDate:        toISO(applyDate),
        collectionCenter,
        bank:             bankFilter,
        roundDownAmount:  roundDown,
        dueByList,
      });
      if (res?.success) {
        const newRows = res.data.map(d => {
          const hasBank = d.bankDetails?.accountNumber && d.bankDetails.accountNumber !== '-';
          return {
            ...d,
            paymentAmount: (roundDown > 0 && d.netPayable > 0)
              ? Math.floor(d.netPayable / roundDown) * roundDown
              : (d.netPayable > 0 ? d.netPayable : 0),
            mode:     hasBank ? 'Bank Transfer' : 'Cash',
            approved: false,
          };
        });
        setRows(newRows);
        setDataLoaded(true);
        notifications.show({ message: `Loaded ${newRows.length} producers`, color: 'green' });
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // ── row edits ─────────────────────────────────────────────────────────────
  const setRowField = (idx, field, val) =>
    setRows(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: val }; return u; });

  const toggleApprove = (idx) => setRowField(idx, 'approved', !rows[idx].approved);

  const selectAll = () => {
    const allOn = rows.every(r => r.approved || r.paymentAmount <= 0);
    setRows(prev => prev.map(r => ({ ...r, approved: r.paymentAmount > 0 ? !allOn : false })));
  };

  // ── auto pay ──────────────────────────────────────────────────────────────
  const autoPay = () => {
    setRows(prev => prev.map(r => {
      const amt = r.netPayable > 0
        ? (roundDown > 0 ? Math.floor(r.netPayable / roundDown) * roundDown : r.netPayable)
        : 0;
      return { ...r, paymentAmount: amt, approved: amt > 0 };
    }));
    notifications.show({ message: 'Auto-pay applied to all positive balance producers', color: 'blue' });
  };

  // ── apply payment ─────────────────────────────────────────────────────────
  const applyPayment = async () => {
    const approved = rows.filter(r => r.approved && r.paymentAmount > 0);
    if (!approved.length) {
      notifications.show({ message: 'No approved rows to apply', color: 'orange' });
      return;
    }
    setApplying(true);
    try {
      const res = await bankTransferAPI.apply({
        transferBasis:         'As on Date Balance',
        asOnDate:              toISO(toDate),
        applyDate:             toISO(applyDate),
        collectionCenter,
        collectionCenterName:  centers.find(c => c.value === collectionCenter)?.label || 'All',
        bank:                  bankFilter,
        bankName:              banks.find(b => b.value === bankFilter)?.label || 'All',
        roundDownAmount:       roundDown,
        dueByList,
        transferDetails:       approved.map(r => ({
          ...r,
          transferAmount: r.paymentAmount,
          paymentMode:    r.mode,
        })),
      });
      if (res?.success) {
        notifications.show({ title: 'Success', message: res.message, color: 'green' });
        clearData();
        setActiveTab('log');
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to apply', color: 'red' });
    } finally {
      setApplying(false);
    }
  };

  // ── log tab ───────────────────────────────────────────────────────────────
  const loadLogs = async () => {
    setLogLoading(true);
    try {
      const res = await bankTransferAPI.getAll({
        page:     logPage,
        limit:    10,
        status:   logFilters.status || undefined,
        fromDate: toISO(logFilters.fromDate),
        toDate:   toISO(logFilters.toDate),
      });
      if (res?.success) {
        setLogs(res.data);
        setLogPages(res.pagination?.pages || 1);
      }
    } catch { /* silent */ }
    setLogLoading(false);
  };

  // ── print ─────────────────────────────────────────────────────────────────
  const openPrint = (mode) => { setPrintMode(mode); setPrintModal(true); };

  const printRows = (() => {
    const approved = rows.filter(r => r.approved && r.paymentAmount > 0);
    if (printMode === 'bank')   return approved.filter(r => r.mode === 'Bank Transfer');
    if (printMode === 'cash')   return approved.filter(r => r.mode === 'Cash');
    if (printMode === 'cheque') return approved.filter(r => r.mode === 'Cheque');
    return approved;
  })();

  const showBankCols = printMode === 'bank' || printMode === 'all';

  // ── summary ───────────────────────────────────────────────────────────────
  const summ = {
    total:         rows.length,
    approved:      rows.filter(r => r.approved).length,
    netPayable:    rows.reduce((s, r) => s + (r.netPayable || 0), 0),
    bankAmt:       rows.filter(r => r.approved && r.mode === 'Bank Transfer').reduce((s, r) => s + r.paymentAmount, 0),
    cashAmt:       rows.filter(r => r.approved && r.mode === 'Cash').reduce((s, r) => s + r.paymentAmount, 0),
    chequeAmt:     rows.filter(r => r.approved && r.mode === 'Cheque').reduce((s, r) => s + r.paymentAmount, 0),
    bankCount:     rows.filter(r => r.mode === 'Bank Transfer').length,
    cashCount:     rows.filter(r => r.mode === 'Cash').length,
    chequeCount:   rows.filter(r => r.mode === 'Cheque').length,
  };
  summ.grandTotal = summ.bankAmt + summ.cashAmt + summ.chequeAmt;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Box>
            <Title order={2}>Bank Transfer & Payment</Title>
            <Text c="dimmed" size="sm">Manage producer payments — Bank, Cash, or Cheque</Text>
          </Box>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="transfer" leftSection={<IconBuildingBank size={16} />}>
              Bank Transfer
            </Tabs.Tab>
            <Tabs.Tab value="log" leftSection={<IconCash size={16} />}>
              Transfer Log
            </Tabs.Tab>
          </Tabs.List>

          {/* ═══════════════════ TRANSFER TAB ════════════════════════════ */}
          <Tabs.Panel value="transfer" pt="md">
            <Stack gap="md">

              {/* Filter Card */}
              <Card withBorder p="md">
                <Stack gap="sm">

                  {/* Pending period dropdown from register-ledger */}
                  {pendingPeriods.length > 0 && (
                    <Group gap="xs" align="flex-end" wrap="wrap">
                      <Select
                        label="Pending Period (from Register-Ledger)"
                        placeholder="Select cycle period…"
                        value={selectedPeriod}
                        onChange={selectPeriod}
                        data={pendingPeriods.map(p => ({
                          value: `${p.fromDate}|${p.toDate}`,
                          label: `${dayjs(p.fromDate).format('DD/MM/YYYY')} – ${dayjs(p.toDate).format('DD/MM/YYYY')}  (${p.count} producers · ₹${(p.totalAmt || 0).toFixed(0)})`,
                        }))}
                        clearable
                        style={{ minWidth: 380 }}
                        size="sm"
                      />
                      <Badge color="orange" variant="light" size="lg" style={{ marginBottom: 4 }}>
                        {pendingPeriods.length} pending cycle{pendingPeriods.length > 1 ? 's' : ''}
                      </Badge>
                    </Group>
                  )}

                  {/* Cycle buttons + period nav */}
                  <Group gap="xs" wrap="wrap" align="center">
                    <Text size="sm" fw={500} c="dimmed">Cycle:</Text>
                    {CYCLES.map(c => (
                      <Button
                        key={c.value}
                        size="xs"
                        variant={cycle === c.value ? 'filled' : 'outline'}
                        color="blue"
                        onClick={() => applyCycle(c.value)}
                      >
                        {c.label}
                      </Button>
                    ))}
                    <ActionIcon variant="subtle" onClick={() => navigatePeriod('prev')} title="Previous period">
                      <IconChevronLeft size={16} />
                    </ActionIcon>
                    {periodLabel && (
                      <Badge variant="light" color="blue" size="md">{periodLabel}</Badge>
                    )}
                    <ActionIcon variant="subtle" onClick={() => navigatePeriod('next')} title="Next period">
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>

                  {/* Filters row */}
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <DatePickerInput
                        label="From Date"
                        value={fromDate}
                        onChange={v => { setFromDate(v); clearData(); }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <DatePickerInput
                        label="To Date"
                        value={toDate}
                        onChange={v => { setToDate(v); clearData(); }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <DatePickerInput
                        label="Apply Date"
                        value={applyDate}
                        onChange={setApplyDate}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Select
                        label="Collection Center"
                        data={centers}
                        value={collectionCenter}
                        onChange={v => { setCollectionCenter(v || 'all'); clearData(); }}
                        searchable
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Select
                        label="Bank Filter"
                        data={banks}
                        value={bankFilter}
                        onChange={v => { setBankFilter(v || 'all'); clearData(); }}
                        searchable
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <NumberInput
                        label="Round Down (₹)"
                        value={roundDown}
                        onChange={v => setRoundDown(v ?? 0)}
                        min={0}
                        max={1000}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                      <Checkbox
                        label="Due By List Only"
                        checked={dueByList}
                        onChange={e => setDueByList(e.currentTarget.checked)}
                      />
                    </Grid.Col>
                  </Grid>

                  {/* Action buttons */}
                  <Group gap="xs" wrap="wrap">
                    <Button
                      leftSection={<IconRefresh size={16} />}
                      onClick={loadData}
                      loading={loading}
                      color="green"
                    >
                      Load Data
                    </Button>

                    {dataLoaded && (
                      <>
                        <Button
                          leftSection={<IconCoins size={16} />}
                          onClick={autoPay}
                          variant="light"
                          color="blue"
                        >
                          Auto Pay
                        </Button>
                        <Button
                          leftSection={<IconBuildingBank size={16} />}
                          onClick={applyPayment}
                          loading={applying}
                          color="indigo"
                        >
                          Apply Payment
                        </Button>
                        <Button
                          leftSection={<IconPrinter size={16} />}
                          onClick={() => openPrint('bank')}
                          variant="outline"
                          color="blue"
                        >
                          Print Bank List
                        </Button>
                        <Button
                          leftSection={<IconPrinter size={16} />}
                          onClick={() => openPrint('cash')}
                          variant="outline"
                          color="orange"
                        >
                          Print Cash List
                        </Button>
                        <Button
                          leftSection={<IconPrinter size={16} />}
                          onClick={() => openPrint('all')}
                          variant="outline"
                        >
                          Print All
                        </Button>
                        <Button
                          leftSection={<IconX size={16} />}
                          onClick={clearData}
                          variant="outline"
                          color="red"
                        >
                          Clear
                        </Button>
                      </>
                    )}
                  </Group>
                </Stack>
              </Card>

              {/* Summary Cards */}
              {dataLoaded && (
                <Grid>
                  {[
                    { label: 'Total Producers', value: summ.total,                         color: 'gray'   },
                    { label: 'Net Payable',      value: fmt(summ.netPayable),               color: 'blue'   },
                    { label: `Bank (${summ.bankCount})`,   value: fmt(summ.bankAmt),   color: 'indigo'  },
                    { label: `Cash (${summ.cashCount})`,   value: fmt(summ.cashAmt),   color: 'orange'  },
                    { label: `Cheque (${summ.chequeCount})`, value: fmt(summ.chequeAmt), color: 'violet' },
                    { label: 'Grand Total',      value: fmt(summ.grandTotal),               color: 'green', bold: true },
                  ].map((s, i) => (
                    <Grid.Col key={i} span={{ base: 6, sm: 4, md: 2 }}>
                      <Paper withBorder p="sm" ta="center">
                        <Text size="xs" c="dimmed">{s.label}</Text>
                        <Text size={s.bold ? 'lg' : 'md'} fw={s.bold ? 700 : 600} c={s.color}>
                          {s.value}
                        </Text>
                      </Paper>
                    </Grid.Col>
                  ))}
                </Grid>
              )}

              {/* Loading */}
              {loading && <Center p="xl"><Loader /></Center>}

              {/* Empty after load */}
              {!loading && dataLoaded && rows.length === 0 && (
                <Card withBorder p="xl">
                  <Center><Text c="dimmed">No producers found for the selected criteria</Text></Center>
                </Card>
              )}

              {/* Table */}
              {!loading && rows.length > 0 && (
                <Card withBorder p={0}>
                  {/* Table header bar */}
                  <Box
                    p="sm"
                    style={{
                      background: 'var(--mantine-color-indigo-0)',
                      borderBottom: '1px solid var(--mantine-color-indigo-2)',
                    }}
                  >
                    <Group justify="space-between" wrap="wrap">
                      <Group gap="xs">
                        <Text fw={600} c="indigo.8">Payment Details</Text>
                        <Badge color="blue">{rows.length} Producers</Badge>
                        <Badge color="green">{summ.approved} Approved</Badge>
                      </Group>
                      <Group gap="xs">
                        <Button size="xs" variant="light" onClick={selectAll}>
                          {rows.every(r => r.approved || r.paymentAmount <= 0) ? 'Deselect All' : 'Select All'}
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="green"
                          onClick={() => setRows(p => p.map(r => ({ ...r, approved: r.netPayable > 0 })))}
                        >
                          Select Positive
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={() => setRows(p => p.map(r => ({ ...r, approved: false })))}
                        >
                          Clear All
                        </Button>
                      </Group>
                    </Group>
                  </Box>

                  <ScrollArea>
                    <Table striped highlightOnHover withColumnBorders size="sm" style={{ minWidth: 900 }}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th ta="center" style={{ width: 42 }}>SN</Table.Th>
                          <Table.Th style={{ width: 90 }}>Prod ID</Table.Th>
                          <Table.Th>Producer Name</Table.Th>
                          <Table.Th style={{ width: 140 }}>Account No</Table.Th>
                          <Table.Th style={{ width: 100 }}>IFSC</Table.Th>
                          <Table.Th style={{ width: 110 }}>Branch / Bank</Table.Th>
                          <Table.Th ta="right" style={{ width: 105 }}>Net Payable</Table.Th>
                          <Table.Th style={{ width: 110 }}>Pay Amount</Table.Th>
                          <Table.Th style={{ width: 115 }}>Mode</Table.Th>
                          <Table.Th ta="center" style={{ width: 50 }}>✓</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {rows.map((row, idx) => (
                          <Table.Tr
                            key={row.farmerId || idx}
                            style={row.approved ? { background: 'var(--mantine-color-green-0)' } : {}}
                          >
                            <Table.Td ta="center">
                              <Text size="xs">{idx + 1}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" fw={500}>{row.producerId}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">{row.producerName}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c={row.bankDetails?.accountNumber && row.bankDetails.accountNumber !== '-' ? 'inherit' : 'dimmed'}>
                                {row.bankDetails?.accountNumber || '—'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">{row.bankDetails?.ifscCode || '—'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">{row.bankDetails?.bankName || '—'}</Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text size="xs" fw={500} c={row.netPayable < 0 ? 'red' : 'inherit'}>
                                {fmt(row.netPayable)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <NumberInput
                                size="xs"
                                value={row.paymentAmount}
                                onChange={v => setRowField(idx, 'paymentAmount', v || 0)}
                                min={0}
                                hideControls
                                disabled={row.netPayable <= 0}
                                styles={{ input: { textAlign: 'right' } }}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Select
                                size="xs"
                                data={MODES}
                                value={row.mode}
                                onChange={v => setRowField(idx, 'mode', v)}
                                allowDeselect={false}
                                styles={{ input: { fontSize: '11px', paddingLeft: 6 } }}
                              />
                            </Table.Td>
                            <Table.Td ta="center">
                              <Checkbox
                                checked={row.approved}
                                onChange={() => toggleApprove(idx)}
                                disabled={row.paymentAmount <= 0}
                              />
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>

                  {/* Footer summary bar */}
                  <Box p="md" style={{ borderTop: '2px solid var(--mantine-color-gray-3)' }}>
                    <Grid>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <Text size="xs" c="dimmed">Total Net Payable</Text>
                        <Text fw={600}>{fmt(summ.netPayable)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <Text size="xs" c="dimmed">Bank Transfer (approved)</Text>
                        <Text fw={600} c="indigo">{fmt(summ.bankAmt)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <Text size="xs" c="dimmed">Cash + Cheque (approved)</Text>
                        <Text fw={600} c="orange">{fmt(summ.cashAmt + summ.chequeAmt)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <Text size="xs" c="dimmed">Grand Total (approved)</Text>
                        <Text fw={700} c="green" size="lg">{fmt(summ.grandTotal)}</Text>
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Card>
              )}

              {/* Prompt when no data loaded */}
              {!loading && !dataLoaded && (
                <Card withBorder p="xl">
                  <Center>
                    <Stack align="center" gap="xs">
                      <IconBuildingBank size={48} color="var(--mantine-color-gray-4)" />
                      <Text c="dimmed">Select date range and click "Load Data" to begin</Text>
                    </Stack>
                  </Center>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>

          {/* ═══════════════════ LOG TAB ══════════════════════════════════ */}
          <Tabs.Panel value="log" pt="md">
            <Stack gap="md">
              <Card withBorder p="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Select
                      placeholder="Status"
                      data={['Draft', 'Applied', 'Completed', 'Cancelled'].map(s => ({ value: s, label: s }))}
                      value={logFilters.status}
                      onChange={v => setLogFilters(p => ({ ...p, status: v || '' }))}
                      clearable
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <DatePickerInput
                      placeholder="From Date"
                      value={logFilters.fromDate}
                      onChange={v => setLogFilters(p => ({ ...p, fromDate: v }))}
                      clearable
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <DatePickerInput
                      placeholder="To Date"
                      value={logFilters.toDate}
                      onChange={v => setLogFilters(p => ({ ...p, toDate: v }))}
                      clearable
                    />
                  </Grid.Col>
                </Grid>
              </Card>

              <Card withBorder>
                {logLoading ? (
                  <Center p="xl"><Loader /></Center>
                ) : logs.length === 0 ? (
                  <Center p="xl"><Text c="dimmed">No transfer logs found</Text></Center>
                ) : (
                  <>
                    <ScrollArea>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Transfer No</Table.Th>
                            <Table.Th>Apply Date</Table.Th>
                            <Table.Th>Transfer Basis</Table.Th>
                            <Table.Th>Center</Table.Th>
                            <Table.Th ta="right">Producers</Table.Th>
                            <Table.Th ta="right">Amount</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th style={{ width: 40 }}></Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {logs.map(log => (
                            <Table.Tr key={log._id}>
                              <Table.Td>
                                <Text size="sm" fw={500}>{log.transferNumber}</Text>
                              </Table.Td>
                              <Table.Td>{fmtDate(log.applyDate)}</Table.Td>
                              <Table.Td>
                                <Text size="xs" c="dimmed">{log.transferBasis}</Text>
                              </Table.Td>
                              <Table.Td>{log.collectionCenterName || 'All'}</Table.Td>
                              <Table.Td ta="right">
                                <Badge variant="light">{log.totalApproved}</Badge>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text size="sm" fw={500}>{fmt(log.totalTransferAmount)}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge color={STATUS_COLOR[log.status] || 'gray'}>{log.status}</Badge>
                              </Table.Td>
                              <Table.Td>
                                <Menu position="bottom-end">
                                  <Menu.Target>
                                    <ActionIcon variant="subtle">
                                      <IconDotsVertical size={16} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    <Menu.Item
                                      leftSection={<IconEye size={14} />}
                                      onClick={async () => {
                                        const res = await bankTransferAPI.getById(log._id);
                                        if (res?.success) { setSelectedLog(res.data); setViewModal(true); }
                                      }}
                                    >
                                      View Details
                                    </Menu.Item>
                                    {log.status === 'Applied' && (
                                      <>
                                        <Menu.Item
                                          leftSection={<IconCheck size={14} />}
                                          color="green"
                                          onClick={async () => {
                                            await bankTransferAPI.complete(log._id);
                                            notifications.show({ message: 'Marked as completed', color: 'green' });
                                            loadLogs();
                                          }}
                                        >
                                          Mark Completed
                                        </Menu.Item>
                                        <Menu.Item
                                          leftSection={<IconX size={14} />}
                                          color="red"
                                          onClick={async () => {
                                            if (!confirm('Cancel this transfer?')) return;
                                            await bankTransferAPI.cancel(log._id);
                                            notifications.show({ message: 'Transfer cancelled', color: 'orange' });
                                            loadLogs();
                                          }}
                                        >
                                          Cancel Transfer
                                        </Menu.Item>
                                      </>
                                    )}
                                  </Menu.Dropdown>
                                </Menu>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                    {logPages > 1 && (
                      <Group justify="center" p="md">
                        <Pagination total={logPages} value={logPage} onChange={setLogPage} />
                      </Group>
                    )}
                  </>
                )}
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* ═══════════════════ VIEW MODAL ══════════════════════════════════ */}
        <Modal
          opened={viewModal}
          onClose={() => setViewModal(false)}
          title={
            <Group gap="xs">
              <IconBuildingBank size={18} />
              <Text fw={600}>Transfer Details — {selectedLog?.transferNumber}</Text>
            </Group>
          }
          size="xl"
        >
          {selectedLog && (
            <Stack gap="md">
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Apply Date</Text>
                  <Text fw={500}>{fmtDate(selectedLog.applyDate)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Status</Text>
                  <Badge color={STATUS_COLOR[selectedLog.status] || 'gray'}>{selectedLog.status}</Badge>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Transfer Basis</Text>
                  <Text fw={500}>{selectedLog.transferBasis}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Collection Center</Text>
                  <Text fw={500}>{selectedLog.collectionCenterName || 'All'}</Text>
                </Grid.Col>
              </Grid>

              <Paper withBorder p="md" bg="blue.0">
                <Grid>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Total Producers</Text>
                    <Text size="lg" fw={600}>{selectedLog.totalApproved}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Net Payable</Text>
                    <Text size="lg" fw={600}>{fmt(selectedLog.totalNetPayable)}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Transfer Amount</Text>
                    <Text size="lg" fw={700} c="blue">{fmt(selectedLog.totalTransferAmount)}</Text>
                  </Grid.Col>
                </Grid>
              </Paper>

              <ScrollArea h={300}>
                <Table striped size="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>SN</Table.Th>
                      <Table.Th>Producer ID</Table.Th>
                      <Table.Th>Producer Name</Table.Th>
                      <Table.Th ta="right">Net Payable</Table.Th>
                      <Table.Th ta="right">Transfer Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedLog.transferDetails?.map((d, i) => (
                      <Table.Tr key={d._id || i}>
                        <Table.Td>{i + 1}</Table.Td>
                        <Table.Td>{d.producerId}</Table.Td>
                        <Table.Td>{d.producerName}</Table.Td>
                        <Table.Td ta="right" c={d.netPayable < 0 ? 'red' : 'inherit'}>
                          {fmt(d.netPayable)}
                        </Table.Td>
                        <Table.Td ta="right">{fmt(d.transferAmount)}</Table.Td>
                        <Table.Td>
                          <Badge
                            size="sm"
                            color={
                              d.transferStatus === 'Transferred' ? 'green' :
                              d.transferStatus === 'Failed'      ? 'red'   :
                              d.transferStatus === 'Cancelled'   ? 'gray'  : 'yellow'
                            }
                          >
                            {d.transferStatus}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          )}
        </Modal>

        {/* ═══════════════════ PRINT MODAL ═════════════════════════════════ */}
        <Modal
          opened={printModal}
          onClose={() => setPrintModal(false)}
          title={
            printMode === 'bank'   ? 'Print — Bank Transfer List' :
            printMode === 'cash'   ? 'Print — Cash Payment List'  :
            printMode === 'cheque' ? 'Print — Cheque Payment List' :
                                     'Print — All Payments'
          }
          size="xl"
        >
          <Stack gap="md">
            {/* Print header info */}
            <Group gap="md">
              <Text size="sm" c="dimmed">Period: <strong>{periodLabel}</strong></Text>
              <Text size="sm" c="dimmed">Producers: <strong>{printRows.length}</strong></Text>
              <Text size="sm" c="dimmed">
                Total: <strong>{fmt(printRows.reduce((s, r) => s + r.paymentAmount, 0))}</strong>
              </Text>
            </Group>

            <ScrollArea h={420}>
              <Table striped withColumnBorders size="sm" style={{ minWidth: 600 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>SN</Table.Th>
                    <Table.Th style={{ width: 90 }}>Prod ID</Table.Th>
                    <Table.Th>Producer Name</Table.Th>
                    {showBankCols && (
                      <>
                        <Table.Th>Account No</Table.Th>
                        <Table.Th>IFSC</Table.Th>
                        <Table.Th>Branch</Table.Th>
                      </>
                    )}
                    <Table.Th ta="right" style={{ width: 110 }}>Amount</Table.Th>
                    {printMode === 'all' && <Table.Th style={{ width: 100 }}>Mode</Table.Th>}
                    <Table.Th style={{ width: 80 }}>Sign</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {printRows.map((r, i) => (
                    <Table.Tr key={r.farmerId || i}>
                      <Table.Td>{i + 1}</Table.Td>
                      <Table.Td><Text size="xs">{r.producerId}</Text></Table.Td>
                      <Table.Td><Text size="xs">{r.producerName}</Text></Table.Td>
                      {showBankCols && (
                        <>
                          <Table.Td><Text size="xs">{r.bankDetails?.accountNumber || '—'}</Text></Table.Td>
                          <Table.Td><Text size="xs">{r.bankDetails?.ifscCode || '—'}</Text></Table.Td>
                          <Table.Td><Text size="xs">{r.bankDetails?.bankName || '—'}</Text></Table.Td>
                        </>
                      )}
                      <Table.Td ta="right">
                        <Text size="xs" fw={600}>{fmt(r.paymentAmount)}</Text>
                      </Table.Td>
                      {printMode === 'all' && (
                        <Table.Td><Text size="xs">{r.mode}</Text></Table.Td>
                      )}
                      <Table.Td></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr style={{ background: 'var(--mantine-color-gray-1)' }}>
                    <Table.Th
                      colSpan={
                        3 +
                        (showBankCols ? 3 : 0) +
                        (printMode === 'all' ? 1 : 0)
                      }
                    >
                      Total ({printRows.length} Producers)
                    </Table.Th>
                    <Table.Th ta="right">
                      {fmt(printRows.reduce((s, r) => s + r.paymentAmount, 0))}
                    </Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </ScrollArea>

            <Group justify="flex-end">
              <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()} color="blue">
                Print
              </Button>
              <Button variant="outline" onClick={() => setPrintModal(false)}>Close</Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
};

export default BankTransferManagement;
