import { useState, useEffect } from 'react';
import {
  Container, Card, Paper, Title, Text, Group, Stack, Grid, Box,
  Button, Select, Checkbox, Table, ScrollArea, Badge, NumberInput,
  Loader, Center, Tabs, ActionIcon, Menu, Pagination, Modal
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { bankTransferAPI, producerPaymentAPI } from '../../services/api';
import {
  IconBuildingBank, IconCash, IconCheck, IconX, IconEye,
  IconRefresh, IconPrinter, IconDotsVertical,
  IconChevronLeft, IconChevronRight, IconCoins, IconTrash, IconEdit, IconDeviceFloppy
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

const PAYMENT_MODES = [
  { value: 'Bank Transfer',   label: 'Bank',        short: 'Bk',  color: 'blue'   },
  { value: 'Cash',            label: 'Cash',        short: 'Ca',  color: 'green'  },
  { value: 'All Cheque',      label: 'All Chq',     short: 'AC',  color: 'violet' },
  { value: 'Personal Cheque', label: 'Per Chq',     short: 'PC',  color: 'grape'  },
];
// Keep for edit modal Select
const MODES = PAYMENT_MODES.map(m => ({ value: m.value, label: m.label }));

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
  const [dueByList,        setDueByList]        = useState(false);

  /* data */
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [applying,   setApplying]   = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  /* payment cycles (from PaymentRegister) */
  const [paymentCycles,       setPaymentCycles]       = useState([]);
  const [selectedPaymentCycle, setSelectedPaymentCycle] = useState(null); // { fromDate, toDate, label }
  const [cashPaidIds,         setCashPaidIds]         = useState(new Set());
  const [cashPaidRows,        setCashPaidRows]        = useState([]); // ProducerPayment rows for this cycle

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
  const [rowsPage,     setRowsPage]     = useState(1);
  const [rowsPageSize, setRowsPageSize] = useState(20);
  const [logFilters, setLogFilters] = useState({ status: '', fromDate: null, toDate: null });

  /* modals */
  const [viewModal,   setViewModal]   = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [printModal,  setPrintModal]  = useState(false);
  const [printMode,   setPrintMode]   = useState('all');

  /* edit modal */
  const [editModal,    setEditModal]    = useState(false);
  const [editLog,      setEditLog]      = useState(null);   // full BankTransfer doc
  const [editDate,     setEditDate]     = useState(null);
  const [editDetails,  setEditDetails]  = useState([]);     // [{...detail, transferAmount, paymentMode}]
  const [editSaving,   setEditSaving]   = useState(false);

  // ── init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadDropdowns();
    loadPaymentCycles();
  }, []);

  // reload cycles whenever transfer tab is opened
  useEffect(() => {
    if (activeTab === 'transfer') loadPaymentCycles();
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
    clearData(t);
  };

  const navigatePeriod = (dir) => {
    const ref = dir === 'next'
      ? dayjs(toDate).add(1, 'day').toDate()
      : dayjs(fromDate).subtract(1, 'day').toDate();
    const [f, t] = getCyclePeriod(cycle, ref);
    setFromDate(f);
    setToDate(t);
    clearData(t);
  };

  const clearData = (newTo) => {
    setRows([]);
    setRowsPage(1);
    setDataLoaded(false);
    // auto-advance applyDate to day after new toDate if needed
    const refTo = newTo || toDate;
    if (refTo) {
      const minApply = dayjs(refTo).add(1, 'day').toDate();
      setApplyDate(prev => (prev && prev >= minApply ? prev : minApply));
    }
  };

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
    clearData(t);
  };

  const periodLabel = fromDate && toDate
    ? `${dayjs(fromDate).format('DD/MM/YY')} – ${dayjs(toDate).format('DD/MM/YY')}`
    : '';

  // ── core load helper (takes explicit dates to avoid stale-state closures) ───
  const performLoad = async (from, to, opts = {}) => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const rd = opts.roundDown ?? roundDown;
      const res = await bankTransferAPI.retrieve({
        transferBasis:   'As on Date Balance',
        asOnDate:        toISO(to),
        applyDate:       toISO(opts.applyDate || applyDate || dayjs(to).add(1, 'day').toDate()),
        collectionCenter: opts.collectionCenter ?? collectionCenter,
        bank:            opts.bank ?? bankFilter,
        roundDownAmount: rd,
        dueByList:       opts.dueByList ?? dueByList,
      });
      if (res?.success) {
        const newRows = res.data.map(d => {
          const hasBank = d.bankDetails?.accountNumber && d.bankDetails.accountNumber !== '-';
          return {
            ...d,
            paymentAmount: (rd > 0 && d.netPayable > 0)
              ? Math.floor(d.netPayable / rd) * rd
              : (d.netPayable > 0 ? d.netPayable : 0),
            mode:     d.paymentMode || (hasBank ? 'Bank Transfer' : 'Cash'),
            approved: false,
          };
        });
        setRows(newRows);
        setRowsPage(1);
        setDataLoaded(true);
        notifications.show({ message: `Loaded ${newRows.length} producers`, color: 'green' });
        await loadCashPaidForCycle(from, to);
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // ── load PaymentRegister cycles ───────────────────────────────────────────
  const loadPaymentCycles = async () => {
    try {
      const res = await producerPaymentAPI.getCycles();
      if (res?.success) {
        setPaymentCycles(res.data || []);
        // If a cycle was already selected keep it; otherwise auto-select latest
        if (!selectedPaymentCycle && res.data?.length > 0) {
          const latest = res.data[0];
          const f  = new Date(latest.fromDate);
          const t  = new Date(latest.toDate);
          const ap = dayjs(t).add(1, 'day').toDate();
          setSelectedPaymentCycle({ fromDate: f, toDate: t, label: latest.label });
          setFromDate(f);
          setToDate(t);
          setApplyDate(prev => (prev && prev >= ap ? prev : ap));
          await performLoad(f, t, { applyDate: ap });
        }
      }
    } catch { /* silent */ }
  };

  // ── load farmers already paid (cash) via Payment to Producer for this cycle
  const loadCashPaidForCycle = async (from, to) => {
    if (!from || !to) { setCashPaidIds(new Set()); setCashPaidRows([]); return; }
    try {
      const res = await producerPaymentAPI.getAll({
        cycleFromDate: dayjs(from).format('YYYY-MM-DD'),
        cycleToDate:   dayjs(to).format('YYYY-MM-DD'),
        limit: 10000,
      });
      const rows = (res?.data || []).filter(p => p.status !== 'Cancelled');
      const ids  = new Set(rows.map(p => p.farmerId?._id?.toString() || p.farmerId?.toString() || '').filter(Boolean));
      setCashPaidIds(ids);
      setCashPaidRows(rows);
    } catch {
      setCashPaidIds(new Set());
      setCashPaidRows([]);
    }
  };

  // ── load pending periods — kept for deleteTransfer refresh ────────────────
  const loadPendingPeriods = async () => {
    try {
      const res = await bankTransferAPI.getPendingPeriods();
      if (res?.success) setPendingPeriods(res.data || []);
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
          ...cRes.data.map(c => ({ value: String(c._id), label: c.name || c.centerName || 'Center' })),
        ]);
      }
      if (bRes?.success) {
        setBanks([
          { value: 'all', label: 'All Banks' },
          ...bRes.data
            .filter(b => b.name && typeof b.name === 'string')
            .map(b => ({ value: b.name, label: `${b.name} (${b.count || 0})` })),
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
    await performLoad(fromDate, toDate);
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
          paymentMode:    r.mode || 'Bank Transfer',
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

  // ── delete transfer (reverses FarmerPayments back to pending) ────────────
  const deleteTransfer = async (log) => {
    if (!confirm(`Delete transfer ${log.transferNumber}? This will reverse all payments back to pending.`)) return;
    try {
      const res = await bankTransferAPI.delete(log._id);
      if (res?.success) {
        notifications.show({ title: 'Deleted', message: res.message, color: 'red' });
        loadLogs();
        loadPaymentCycles();
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Delete failed', color: 'red' });
    }
  };

  // ── open edit modal ───────────────────────────────────────────────────────
  const openEdit = async (log) => {
    const res = await bankTransferAPI.getById(log._id);
    if (!res?.success) return;
    const doc = res.data;
    setEditLog(doc);
    setEditDate(doc.applyDate ? new Date(doc.applyDate) : new Date());
    setEditDetails(doc.transferDetails.map(d => {
      const hasBank = d.bankDetails?.accountNumber && d.bankDetails.accountNumber !== '-';
      const mode    = d.paymentMode || (hasBank ? 'Bank Transfer' : 'Cash');
      return {
        _id:            d._id,
        farmerId:       d.farmerId?._id || d.farmerId,
        producerId:     d.producerId,
        producerName:   d.producerName,
        netPayable:     d.netPayable,
        transferAmount: d.transferAmount,
        paymentMode:    mode,
        transferStatus: d.transferStatus,
      };
    }));
    setEditModal(true);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      const res = await bankTransferAPI.update(editLog._id, {
        applyDate:       editDate?.toISOString(),
        transferDetails: editDetails.map(d => ({
          _id:            d._id,
          farmerId:       d.farmerId,
          transferAmount: d.transferAmount,
          paymentMode:    d.paymentMode,
        })),
      });
      if (res?.success) {
        notifications.show({ title: 'Saved', message: 'Bank transfer updated', color: 'green' });
        setEditModal(false);
        loadLogs();
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Save failed', color: 'red' });
    } finally {
      setEditSaving(false);
    }
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
    total:          rows.length,
    approved:       rows.filter(r => r.approved).length,
    netPayable:     rows.reduce((s, r) => s + (r.netPayable || 0), 0),
    bankAmt:        rows.filter(r => r.approved && r.mode === 'Bank Transfer').reduce((s, r) => s + r.paymentAmount, 0),
    cashAmt:        rows.filter(r => r.approved && r.mode === 'Cash').reduce((s, r) => s + r.paymentAmount, 0),
    allChequeAmt:   rows.filter(r => r.approved && r.mode === 'All Cheque').reduce((s, r) => s + r.paymentAmount, 0),
    perChequeAmt:   rows.filter(r => r.approved && r.mode === 'Personal Cheque').reduce((s, r) => s + r.paymentAmount, 0),
    bankCount:      rows.filter(r => r.mode === 'Bank Transfer').length,
    cashCount:      rows.filter(r => r.mode === 'Cash').length,
    allChequeCount: rows.filter(r => r.mode === 'All Cheque').length,
    perChequeCount: rows.filter(r => r.mode === 'Personal Cheque').length,
  };
  summ.grandTotal = summ.bankAmt + summ.cashAmt + summ.allChequeAmt + summ.perChequeAmt;

  const rowsTotalPages = Math.max(1, Math.ceil(rows.length / rowsPageSize));
  const pagedRows = rows.slice((rowsPage - 1) * rowsPageSize, rowsPage * rowsPageSize);

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

                  {/* Payment Cycle dropdown (from saved PaymentRegister) */}
                  <Group gap="xs" align="flex-end" wrap="wrap">
                    <Select
                      label="Payment Cycle"
                      placeholder="Select cycle…"
                      value={selectedPaymentCycle
                        ? `${dayjs(selectedPaymentCycle.fromDate).format('YYYY-MM-DD')}|${dayjs(selectedPaymentCycle.toDate).format('YYYY-MM-DD')}`
                        : null}
                      onChange={async (val) => {
                        if (!val) {
                          setSelectedPaymentCycle(null);
                          clearData();
                          setCashPaidIds(new Set());
                          setCashPaidRows([]);
                          return;
                        }
                        const [fromStr, toStr] = val.split('|');
                        const found = paymentCycles.find(c =>
                          dayjs(c.fromDate).format('YYYY-MM-DD') === fromStr &&
                          dayjs(c.toDate).format('YYYY-MM-DD') === toStr
                        );
                        if (!found) return;
                        const f  = new Date(found.fromDate);
                        const t  = new Date(found.toDate);
                        const ap = dayjs(t).add(1, 'day').toDate();
                        setSelectedPaymentCycle({ fromDate: f, toDate: t, label: found.label });
                        setFromDate(f);
                        setToDate(t);
                        setApplyDate(prev => (prev && prev >= ap ? prev : ap));
                        clearData(t);
                        await performLoad(f, t, { applyDate: ap });
                      }}
                      data={paymentCycles.map(c => ({
                        value: `${dayjs(c.fromDate).format('YYYY-MM-DD')}|${dayjs(c.toDate).format('YYYY-MM-DD')}`,
                        label: c.label,
                      }))}
                      clearable
                      searchable
                      nothingFoundMessage="No saved cycles found"
                      style={{ minWidth: 280 }}
                      size="sm"
                    />
                    {selectedPaymentCycle && (
                      <Badge color="teal" variant="light" size="lg" style={{ marginBottom: 4 }}>
                        {selectedPaymentCycle.label}
                      </Badge>
                    )}
                  </Group>

                  {/* Cycle buttons + period nav */}
                  {/* <Group gap="xs" wrap="wrap" align="center">
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
                  </Group> */}

                  {/* Filters row */}
                  <Grid>
                    {/* <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <DatePickerInput
                        label="From Date"
                        value={fromDate}
                        onChange={v => { setFromDate(v); clearData(); }}
                      />
                    </Grid.Col> */}
                    {/* <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <DatePickerInput
                        label="To Date"
                        value={toDate}
                        onChange={v => { setToDate(v); clearData(); }}
                      />
                    </Grid.Col> */}
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <DatePickerInput
                        label="Apply Date"
                        value={applyDate}
                        onChange={setApplyDate}
                        minDate={toDate ? dayjs(toDate).add(1, 'day').toDate() : undefined}
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
                    { label: 'Total Producers',             value: summ.total,             color: 'gray'   },
                    { label: 'Net Payable',                 value: fmt(summ.netPayable),   color: 'blue'   },
                    { label: `Bank (${summ.bankCount})`,    value: fmt(summ.bankAmt),      color: 'indigo' },
                    { label: `Cash (${summ.cashCount})`,    value: fmt(summ.cashAmt),      color: 'orange' },
                    { label: `All Chq (${summ.allChequeCount})`,  value: fmt(summ.allChequeAmt),  color: 'violet' },
                    { label: `Per Chq (${summ.perChequeCount})`,  value: fmt(summ.perChequeAmt),  color: 'grape'  },
                    { label: 'Grand Total',                 value: fmt(summ.grandTotal),   color: 'green', bold: true },
                  ].map((s, i) => (
                    <Grid.Col key={i} span={{ base: 6, sm: 4, md: 'auto' }}>
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
                          <Table.Th style={{ width: 105 }}>Pay Amount</Table.Th>
                          <Table.Th style={{ width: 220 }}>
                            <Group gap={6} wrap="nowrap" align="center">
                              <Text size="xs" fw={600}>Mode</Text>
                              {PAYMENT_MODES.map(m => (
                                <Checkbox
                                  key={m.value}
                                  size="xs"
                                  color={m.color}
                                  label={<Text size={9} fw={700}>{m.short}</Text>}
                                  checked={rows.length > 0 && rows.every(r => r.mode === m.value)}
                                  onChange={() => setRows(prev => prev.map(r => ({ ...r, mode: m.value })))}
                                  title={`Set all to ${m.label}`}
                                  styles={{ input: { cursor: 'pointer' } }}
                                />
                              ))}
                            </Group>
                          </Table.Th>
                          <Table.Th ta="center" style={{ width: 50 }}>✓</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {pagedRows.map((row, idx) => {
                          const absIdx = (rowsPage - 1) * rowsPageSize + idx;
                          return (
                          <Table.Tr
                            key={row.farmerId || absIdx}
                            style={row.approved ? { background: 'var(--mantine-color-green-0)' } : {}}
                          >
                            <Table.Td ta="center">
                              <Text size="xs">{absIdx + 1}</Text>
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
                                onChange={v => setRowField(absIdx, 'paymentAmount', v || 0)}
                                min={0}
                                hideControls
                                disabled={row.netPayable <= 0}
                                styles={{ input: { textAlign: 'right' } }}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="nowrap">
                                {PAYMENT_MODES.map(m => (
                                  <Checkbox
                                    key={m.value}
                                    size="xs"
                                    color={m.color}
                                    label={<Text size={9} fw={600}>{m.short}</Text>}
                                    checked={row.mode === m.value}
                                    onChange={() => setRowField(absIdx, 'mode', m.value)}
                                    styles={{ input: { cursor: 'pointer' } }}
                                  />
                                ))}
                              </Group>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Checkbox
                                checked={row.approved}
                                onChange={() => toggleApprove(absIdx)}
                                disabled={row.paymentAmount <= 0}
                              />
                            </Table.Td>
                          </Table.Tr>
                          );
                        })}
                      </Table.Tbody>

                      {/* ── Cash-paid rows (from Payment to Producer) ──── */}
                      {cashPaidRows.length > 0 && (
                        <>
                          <Table.Tbody>
                            <Table.Tr style={{ background: 'var(--mantine-color-yellow-0)' }}>
                              <Table.Td colSpan={10} py={4}>
                                <Group gap="xs">
                                  <IconCash size={13} color="var(--mantine-color-orange-6)" />
                                  <Text size="xs" fw={700} c="orange.7">
                                    Already Paid via Cash / Payment to Producer ({cashPaidRows.length} farmer{cashPaidRows.length > 1 ? 's' : ''})
                                  </Text>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                            {cashPaidRows.map((row, idx) => (
                              <Table.Tr key={row._id} style={{ background: 'var(--mantine-color-yellow-0)', color: '#666' }}>
                                <Table.Td ta="center"><Text size="xs" c="dimmed">{idx + 1}</Text></Table.Td>
                                <Table.Td><Text size="xs">{row.producerNumber || '-'}</Text></Table.Td>
                                <Table.Td><Text size="xs">{row.producerName || '-'}</Text></Table.Td>
                                <Table.Td><Text size="xs" c="dimmed">—</Text></Table.Td>
                                <Table.Td><Text size="xs" c="dimmed">—</Text></Table.Td>
                                <Table.Td><Text size="xs" c="dimmed">—</Text></Table.Td>
                                <Table.Td ta="right"><Text size="xs" fw={500}>{fmt(row.amountPaid)}</Text></Table.Td>
                                <Table.Td ta="right"><Text size="xs" c="dimmed">—</Text></Table.Td>
                                <Table.Td>
                                  <Badge size="xs" color="orange" variant="filled" leftSection={<IconCash size={9} />}>
                                    Cash Paid
                                  </Badge>
                                </Table.Td>
                                <Table.Td ta="center">
                                  <Badge size="xs" color="green" variant="light">Paid</Badge>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </>
                      )}
                    </Table>
                  </ScrollArea>

                  {/* Footer summary bar */}
                  <Box p="md" style={{ borderTop: '2px solid var(--mantine-color-gray-3)' }}>
                    <Grid>
                      <Grid.Col span={{ base: 6, sm: 2 }}>
                        <Text size="xs" c="dimmed">Net Payable</Text>
                        <Text fw={600}>{fmt(summ.netPayable)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 2 }}>
                        <Text size="xs" c="dimmed">Bank (approved)</Text>
                        <Text fw={600} c="indigo">{fmt(summ.bankAmt)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 2 }}>
                        <Text size="xs" c="dimmed">Cash (approved)</Text>
                        <Text fw={600} c="orange">{fmt(summ.cashAmt)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 2 }}>
                        <Text size="xs" c="dimmed">All Chq (approved)</Text>
                        <Text fw={600} c="violet">{fmt(summ.allChequeAmt)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 2 }}>
                        <Text size="xs" c="dimmed">Per Chq (approved)</Text>
                        <Text fw={600} c="grape">{fmt(summ.perChequeAmt)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 2 }}>
                        <Text size="xs" c="dimmed">Grand Total (approved)</Text>
                        <Text fw={700} c="green" size="lg">{fmt(summ.grandTotal)}</Text>
                      </Grid.Col>
                    </Grid>
                    <Group justify="space-between" align="center" mt="sm">
                      <Group gap="xs" align="center">
                        <Text size="xs" c="dimmed">Rows per page:</Text>
                        <Select
                          size="xs"
                          w={70}
                          data={['10','20','30','50','100']}
                          value={String(rowsPageSize)}
                          onChange={v => { setRowsPageSize(Number(v)); setRowsPage(1); }}
                          allowDeselect={false}
                        />
                        <Text size="xs" c="dimmed">
                          {rows.length === 0 ? '0' : `${(rowsPage - 1) * rowsPageSize + 1}–${Math.min(rowsPage * rowsPageSize, rows.length)}`} of {rows.length}
                        </Text>
                      </Group>
                      {rowsTotalPages > 1 && (
                        <Pagination
                          total={rowsTotalPages}
                          value={rowsPage}
                          onChange={setRowsPage}
                          size="xs"
                        />
                      )}
                    </Group>
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
                                    <Menu.Item
                                      leftSection={<IconEdit size={14} />}
                                      color="blue"
                                      onClick={() => openEdit(log)}
                                    >
                                      Edit
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
                                          color="orange"
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
                                    <Menu.Divider />
                                    <Menu.Item
                                      leftSection={<IconTrash size={14} />}
                                      color="red"
                                      onClick={() => deleteTransfer(log)}
                                    >
                                      Delete & Reverse
                                    </Menu.Item>
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

        {/* ═══════════════════ EDIT MODAL ══════════════════════════════════ */}
        <Modal
          opened={editModal}
          onClose={() => setEditModal(false)}
          title={
            <Group gap="xs">
              <IconEdit size={18} />
              <Text fw={600}>Edit Transfer — {editLog?.transferNumber}</Text>
            </Group>
          }
          size="xl"
        >
          {editLog && (
            <Stack gap="md">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <DatePickerInput
                    label="Apply Date"
                    value={editDate}
                    onChange={setEditDate}
                    minDate={editLog?.asOnDate ? dayjs(editLog.asOnDate).add(1, 'day').toDate() : undefined}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Text size="sm" c="dimmed" mt={4}>Status</Text>
                  <Badge color={STATUS_COLOR[editLog.status] || 'gray'} size="lg">{editLog.status}</Badge>
                </Grid.Col>
              </Grid>

              <ScrollArea h={360}>
                <Table striped withColumnBorders size="sm" style={{ minWidth: 620 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 36 }}>SN</Table.Th>
                      <Table.Th style={{ width: 80 }}>Prod ID</Table.Th>
                      <Table.Th>Producer Name</Table.Th>
                      <Table.Th ta="right" style={{ width: 110 }}>Net Payable</Table.Th>
                      <Table.Th ta="right" style={{ width: 130 }}>Transfer Amount</Table.Th>
                      <Table.Th style={{ width: 130 }}>Mode</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {editDetails.map((d, i) => (
                      <Table.Tr key={d._id || i}>
                        <Table.Td ta="center"><Text size="xs">{i + 1}</Text></Table.Td>
                        <Table.Td><Text size="xs">{d.producerId}</Text></Table.Td>
                        <Table.Td><Text size="xs">{d.producerName}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="xs">{fmt(d.netPayable)}</Text></Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            hideControls
                            decimalScale={2}
                            value={d.transferAmount}
                            onChange={v => setEditDetails(prev => prev.map((r, ri) =>
                              ri === i ? { ...r, transferAmount: v ?? 0 } : r
                            ))}
                            styles={{ input: { textAlign: 'right' } }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            size="xs"
                            value={d.paymentMode}
                            onChange={v => setEditDetails(prev => prev.map((r, ri) =>
                              ri === i ? { ...r, paymentMode: v } : r
                            ))}
                            data={MODES}
                          />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              <Group justify="flex-end" gap="xs">
                <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
                <Button
                  leftSection={<IconDeviceFloppy size={15} />}
                  loading={editSaving}
                  onClick={saveEdit}
                  color="blue"
                >
                  Save Changes
                </Button>
              </Group>
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
