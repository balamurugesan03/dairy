import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Container, Box, Group, Text, Title, Button, TextInput,
  Paper, Badge, Divider, ActionIcon, Tooltip,
  LoadingOverlay, Grid, ThemeIcon, ScrollArea, Pagination, Center, Modal,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar, IconSearch, IconRefresh,
  IconPrinter, IconFileSpreadsheet, IconTrash, IconCheck,
  IconReportMoney, IconHistory, IconDeviceFloppy,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { printReport } from '../../utils/printReport';
import dayjs from 'dayjs';
import { paymentRegisterAPI, farmerAPI, dairySettingsAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const fmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const n = (v) => parseFloat(v) || 0;

const calcNet = (r) =>
  n(r.milkValue) + n(r.previousBalance) - n(r.welfare) - n(r.cfRec) - n(r.cashPocket) - n(r.loanAdv);

const deriveStatus = (net) =>
  net > 0 ? 'Payable' : net < 0 ? 'Receivable' : 'Settled';

const emptyRow = (slNo = 1) => ({
  _localId:        Date.now() + slNo + Math.random(),
  slNo,
  productId:       '',
  productName:     '',
  previousBalance: '',
  qty:             '',
  milkValue:       '',
  welfare:         '',
  cfRec:           '',
  loanAdv:         '',
  cashPocket:      '',
  netPayable:      0,
  payStatus:       '',
});

const PAGE_SIZE = 20;


/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
const PaymentRegisterProducers = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef();

  const [fromDate,    setFromDate]    = useState(dayjs().startOf('month').toDate());
  const [toDate,      setToDate]      = useState(dayjs().endOf('month').toDate());
  const [paymentDays, setPaymentDays] = useState(15);

  // Seed cycle from Payment Settings (first cycle) or auto-advance from the
  // last saved Producers register (subsequent cycles).
  useEffect(() => {
    Promise.all([
      dairySettingsAPI.get(),
      paymentRegisterAPI.getLatestProducers(),
    ]).then(([dsRes, lpRes]) => {
      const days = dsRes?.data?.paymentDays || 15;
      setPaymentDays(days);
      const latestToDate = lpRes?.data?.toDate;
      if (latestToDate) {
        const fd = dayjs(latestToDate).add(1, 'day').startOf('day').toDate();
        const td = dayjs(fd).add(days - 1, 'day').toDate();
        setFromDate(fd); setToDate(td);
      } else if (dsRes?.data?.paymentFromDate) {
        const fd = dayjs(dsRes.data.paymentFromDate).startOf('day').toDate();
        const td = dayjs(fd).add(days - 1, 'day').toDate();
        setFromDate(fd); setToDate(td);
      }
    }).catch(() => {});
  }, []);
  const [search,      setSearch]      = useState('');
  const [rows,        setRows]        = useState([emptyRow(1)]);
  const [generating,  setGenerating]  = useState(false);
  const [savedId,       setSavedId]       = useState(null);
  const [page,          setPage]          = useState(1);
  const [cycleGenerated, setCycleGenerated] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [editingId,     setEditingId]     = useState(null);
  const [showLog,       setShowLog]       = useState(false);
  const [logData,       setLogData]       = useState([]);
  const [logLoading,    setLogLoading]    = useState(false);
  // Per-row farmer search: { [localId]: { query, results, open } }
  const [rowSearch,   setRowSearch]   = useState({});

  /* ── filtered / paginated rows ─────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q   = search.trim().toLowerCase();
    const num = /^\d+$/.test(q);
    return rows.filter((r) =>
      num
        ? (r.productId || '').trim() === q
        : (r.productName || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── column totals ──────────────────────────────────────────────────────── */
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.qty             += n(r.qty);
          acc.milkValue       += n(r.milkValue);
          acc.previousBalance += n(r.previousBalance);
          acc.welfare         += n(r.welfare);
          acc.cfRec           += n(r.cfRec);
          acc.loanAdv         += n(r.loanAdv);
          acc.cashPocket      += n(r.cashPocket);
          acc.netPayable      += n(r.netPayable);
          if (n(r.netPayable) >= 0) acc.payableCount++;
          else acc.receivableCount++;
          return acc;
        },
        {
          qty: 0, milkValue: 0, previousBalance: 0,
          welfare: 0, cfRec: 0, loanAdv: 0, cashPocket: 0,
          netPayable: 0, payableCount: 0, receivableCount: 0,
        }
      ),
    [rows]
  );

  /* ── row helpers ────────────────────────────────────────────────────────── */
  const updateRow = useCallback((localId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._localId !== localId) return r;
        const updated      = { ...r, [field]: value };
        updated.netPayable = calcNet(updated);
        updated.payStatus  = deriveStatus(updated.netPayable);
        return updated;
      })
    );
  }, []);

  /* ── Duplicate-farmer guard (called on productId blur) ─────────────────── */
  const checkDuplicateProductId = useCallback((localId, value) => {
    if (!value?.trim()) return;
    setRows((prev) => {
      const duplicate = prev.find(
        (r) => r._localId !== localId && r.productId?.trim().toLowerCase() === value.trim().toLowerCase()
      );
      if (duplicate) {
        notifications.show({
          title:   'Duplicate Entry',
          message: `Producer ID "${value}" is already added in this cycle. Cannot add the same farmer twice.`,
          color:   'red',
          autoClose: 4000,
        });
        // Clear the duplicate row's productId and productName
        return prev.map((r) =>
          r._localId === localId ? { ...r, productId: '', productName: '' } : r
        );
      }
      return prev;
    });
  }, []);

  /* ── Farmer inline search ───────────────────────────────────────────────── */
  const searchTimers = useRef({});

  const handleFarmerQuery = (localId, query) => {
    setRowSearch(prev => ({ ...prev, [localId]: { ...prev[localId], query, open: true, results: prev[localId]?.results || [] } }));
    clearTimeout(searchTimers.current[localId]);
    if (!query.trim()) {
      setRowSearch(prev => ({ ...prev, [localId]: { query, open: false, results: [] } }));
      return;
    }
    searchTimers.current[localId] = setTimeout(async () => {
      try {
        const res = await farmerAPI.search(query);
        const results = res?.data || [];
        setRowSearch(prev => ({ ...prev, [localId]: { ...prev[localId], results, open: true } }));
      } catch { /* ignore */ }
    }, 300);
  };

  const selectFarmer = (localId, farmer) => {
    // Check duplicate
    const isDup = rows.some(
      r => r._localId !== localId && r.productId?.trim() === (farmer.farmerNumber || '').trim()
    );
    if (isDup) {
      notifications.show({
        title: 'Duplicate Entry',
        message: `"${farmer.personalDetails?.name}" is already in this cycle.`,
        color: 'red', autoClose: 4000,
      });
      setRowSearch(prev => ({ ...prev, [localId]: { query: '', results: [], open: false } }));
      return;
    }
    setRows(prev => prev.map(r => {
      if (r._localId !== localId) return r;
      const updated = {
        ...r,
        productId:   farmer.farmerNumber || '',
        productName: farmer.personalDetails?.name || '',
        farmerId:    farmer._id,
      };
      updated.netPayable = calcNet(updated);
      updated.payStatus  = deriveStatus(updated.netPayable);
      return updated;
    }));
    setRowSearch(prev => ({ ...prev, [localId]: { query: '', results: [], open: false } }));
  };

  const closeSearch = (localId) => {
    setRowSearch(prev => ({ ...prev, [localId]: { ...prev[localId], open: false } }));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length + 1)]);
  };

  const deleteRow = (localId) => {
    setRows((prev) => {
      const next = prev.filter((r) => r._localId !== localId);
      return next.map((r, i) => ({ ...r, slNo: i + 1 }));
    });
  };

  /* ── Generate from backend ──────────────────────────────────────────────── */
  const handleGenerate = async () => {
    // When NOT editing an existing register, block if a register already exists for this period
    if (!editingId) {
      const fd = dayjs(fromDate).format('YYYY-MM-DD');
      const td = dayjs(toDate).format('YYYY-MM-DD');
      const existing = await paymentRegisterAPI.getProducersForPeriod({ fromDate: fd, toDate: td });
      if (existing?.data) {
        notifications.show({
          title:   'Already Exists',
          message: `A Payment Register already exists for ${dayjs(fromDate).format('DD/MM/YYYY')} – ${dayjs(toDate).format('DD/MM/YYYY')}. Cannot generate again for the same cycle.`,
          color:   'red',
          autoClose: 5000,
        });
        return;
      }
    }

    setGenerating(true);
    try {
      const res = await paymentRegisterAPI.generateProducers({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
      });
      if (!res.success) throw new Error(res.message || 'Generate failed');

      const generated = (res.data.entries || [])
        .map((e, i) => ({
          _localId:        Date.now() + i,
          slNo:            i + 1,
          productId:       e.productId       || '',
          productName:     e.productName     || '',
          previousBalance: e.previousBalance ?? 0,
          qty:             e.qty             ?? 0,
          milkValue:       e.milkValue       ?? 0,
          welfare:         e.welfare         ?? 0,
          cfRec:           e.cfRec           ?? 0,
          loanAdv:         e.loanAdv         ?? 0,
          cashPocket:      e.cashPocket      ?? 0,
          netPayable:      calcNet(e),
          payStatus:       deriveStatus(calcNet(e)),
          farmerId:        e.farmerId,
          _cfZero:         !e.cfRec,
          _loanZero:       !e.loanAdv,
          _cashZero:       !e.cashPocket,
        }))
        .sort((a, b) => (a.productId || '').localeCompare(b.productId || '', undefined, { numeric: true }))
        .map((e, i) => ({ ...e, slNo: i + 1 }));

      setRows(generated.length > 0 ? generated : [emptyRow(1)]);
      setSavedId(null);
      setPage(1);
      setCycleGenerated(true);
      setEditingId(null);

      notifications.show({
        title:   'Generated',
        message: `${generated.length} producer(s) loaded for ${dayjs(fromDate).format('DD/MM/YYYY')} – ${dayjs(toDate).format('DD/MM/YYYY')}`,
        color:   'teal',
        icon:    <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setGenerating(false);
    }
  };

  /* ── Save & Post ────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    const valid = rows.filter(r => r.farmerId || r.productId);
    if (valid.length === 0) {
      notifications.show({ title: 'Validation', message: 'Generate entries first', color: 'orange' });
      return;
    }
    const missing = valid.filter(r => !r.farmerId);
    if (missing.length > 0) {
      notifications.show({
        title:   'Incomplete rows',
        message: `${missing.length} row(s) have no farmer selected. Add farmers or skip them.`,
        color:   'orange',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fromDate:   dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:     dayjs(toDate).format('YYYY-MM-DD'),
        registerId: editingId || undefined,
        entries:    valid.map(({ _localId, payStatus, netPayable, ...r }) => ({ ...r, netPay: netPayable })),
      };
      const res = await paymentRegisterAPI.saveAndPost(payload);
      if (!res?.success) throw new Error(res?.message || 'Save failed');
      setSavedId(res.data._id);
      setCycleGenerated(false);
      setEditingId(null);
      // Advance to next cycle
      const cycleDays = dayjs(toDate).diff(dayjs(fromDate), 'day') + 1;
      const nextFrom  = dayjs(toDate).add(1, 'day').toDate();
      const nextTo    = dayjs(nextFrom).add(cycleDays - 1, 'day').toDate();
      setFromDate(nextFrom);
      setToDate(nextTo);
      setRows([emptyRow(1)]);
      setPage(1);
      notifications.show({
        title:   'Saved & Posted',
        message: `${res.postedCount || 0} entries posted to ledgers. Next cycle: ${dayjs(nextFrom).format('DD/MM/YYYY')} – ${dayjs(nextTo).format('DD/MM/YYYY')}`,
        color:   'green',
        icon:    <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Payment Log ─────────────────────────────────────────────────────────── */
  const handleLoadLog = async () => {
    setLogLoading(true);
    try {
      const res = await paymentRegisterAPI.getProducersHistory();
      setLogData(res?.data || []);
      setShowLog(true);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load history', color: 'red' });
    } finally {
      setLogLoading(false);
    }
  };

  const handleEditLog = async (reg) => {
    const res = await paymentRegisterAPI.getById(reg._id);
    if (!res?.success) return;
    const savedReg = res.data;
    const loaded = (savedReg.entries || [])
      .map((e, i) => ({
        _localId:        Date.now() + i + Math.random(),
        slNo:            i + 1,
        productId:       e.productId       || '',
        productName:     e.productName     || '',
        farmerId:        e.farmerId,
        previousBalance: e.previousBalance ?? 0,
        qty:             e.qty             ?? 0,
        milkValue:       e.milkValue       ?? 0,
        welfare:         e.welfare         ?? 0,
        cfRec:           e.cfRec           ?? 0,
        loanAdv:         e.loanAdv         ?? 0,
        cashPocket:      e.cashPocket      ?? 0,
        netPayable:      calcNet(e),
        payStatus:       deriveStatus(calcNet(e)),
      }))
      .sort((a, b) => (a.productId || '').localeCompare(b.productId || '', undefined, { numeric: true }))
      .map((e, i) => ({ ...e, slNo: i + 1 }));
    setFromDate(new Date(savedReg.fromDate));
    setToDate(new Date(savedReg.toDate));
    setRows(loaded.length > 0 ? loaded : [emptyRow(1)]);
    setEditingId(reg._id);
    setCycleGenerated(true);
    setSavedId(reg._id);
    setPage(1);
    setShowLog(false);
    notifications.show({
      title:   'Loaded for Edit',
      message: `Editing cycle ${dayjs(savedReg.fromDate).format('DD/MM/YYYY')} – ${dayjs(savedReg.toDate).format('DD/MM/YYYY')}`,
      color:   'blue',
    });
  };

  const handleDeleteLog = async (reg) => {
    if (!window.confirm(`Delete cycle ${dayjs(reg.fromDate).format('DD/MM/YYYY')} – ${dayjs(reg.toDate).format('DD/MM/YYYY')}? This will reverse all ledger postings.`)) return;
    try {
      const res = await paymentRegisterAPI.reverse(reg._id);
      if (!res?.success) throw new Error(res?.message || 'Delete failed');
      setLogData(prev => prev.filter(r => r._id !== reg._id));
      notifications.show({ title: 'Deleted', message: res.message || 'Cycle reversed', color: 'teal' });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  /* ── Export to Excel ────────────────────────────────────────────────────── */
  const handleExport = () => {
    const data = rows
      .filter((r) => r.productId || n(r.milkValue))
      .map((r) => ({
        'Sl No':            r.slNo,
        'Producer ID':      r.productId,
        'Producer Name':    r.productName,
        'Previous Balance': n(r.previousBalance),
        'QTY (L)':          n(r.qty),
        'Milk Value (₹)':   n(r.milkValue),
        'Welfare (₹)':      n(r.welfare),
        'C/F Rec (₹)':      n(r.cfRec),
        'Loan Adv (₹)':     n(r.loanAdv),
        'Cash Pocket (₹)':  n(r.cashPocket),
        'Net Payable (₹)':  n(r.netPayable),
        'Status':           r.payStatus,
      }));

    data.push({
      'Sl No':            '',
      'Producer ID':      '',
      'Producer Name':    'TOTAL',
      'Previous Balance': totals.previousBalance,
      'QTY (L)':          totals.qty,
      'Milk Value (₹)':   totals.milkValue,
      'Welfare (₹)':      totals.welfare,
      'C/F Rec (₹)':      totals.cfRec,
      'Loan Adv (₹)':     totals.loanAdv,
      'Cash Pocket (₹)':  totals.cashPocket,
      'Net Payable (₹)':  totals.netPayable,
      'Status':           '',
    });

    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 16 },
      { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Register');
    XLSX.writeFile(wb, `Payment_Register_Producers_${dayjs(fromDate).format('MMYYYY')}.xlsx`);

    notifications.show({ title: 'Exported', message: 'Excel file downloaded', color: 'teal' });
  };

  /* ── Print ──────────────────────────────────────────────────────────────── */
  const handlePrint = () => {
    printReport(printRef, {
      title: `Payment Register (Producers) — ${dayjs(fromDate).format('DD/MM/YYYY')} to ${dayjs(toDate).format('DD/MM/YYYY')}`,
      orientation: 'portrait',
      extraCss: `
        @page { size: A4 portrait; margin: 10mm 8mm; }
        body { font-size: 10px; }
        .no-print { display: none !important; }
        .print-header { display: block !important; }
        input {
          display: block !important;
          border: none !important;
          background: transparent !important;
          font-size: 9px !important;
          font-family: Arial, sans-serif !important;
          padding: 1px 2px !important;
          width: 100% !important;
          height: auto !important;
        }
        table { font-size: 9px !important; min-width: unset !important; width: 100% !important; }
        thead th { position: static !important; font-size: 8px !important; padding: 4px 3px !important; }
        td, tfoot td { padding: 3px 3px !important; font-size: 9px !important; }
        col { width: auto !important; }
      `,
    });
  };

  /* ── Reset ──────────────────────────────────────────────────────────────── */
  const handleReset = () => {
    setRows([emptyRow(1)]);
    setSavedId(null);
    setSearch('');
    setPage(1);
    setCycleGenerated(false);
    setEditingId(null);
  };

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════════════════════ */
  return (
    <Container fluid px="md" py="sm" id="prp-root">
      {/* Remove number-input spinners & style scrollbar */}
      <style>{`
        #prp-root input[type=number]::-webkit-outer-spin-button,
        #prp-root input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        #prp-root input[type=number] { -moz-appearance: textfield; }
        #prp-root .mantine-ScrollArea-scrollbar { background: #444 !important; border-radius: 4px; }
        #prp-root .mantine-ScrollArea-scrollbar[data-orientation="horizontal"] { height: 12px !important; }
        #prp-root .mantine-ScrollArea-scrollbar[data-orientation="vertical"] { width: 12px !important; }
        #prp-root .mantine-ScrollArea-thumb { background: #888 !important; border-radius: 4px; }
        #prp-root .mantine-ScrollArea-thumb:hover { background: #aaa !important; }
      `}</style>

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <Box mb="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Box>
            <Group gap="xs" mb={4}>
              <ThemeIcon variant="light" size="lg" radius="md" color="blue">
                <IconReportMoney size={18} />
              </ThemeIcon>
              <Title order={3} fw={700}>Payment Register (Producers)</Title>
            </Group>
            <Text c="dimmed" size="sm">
              Milk value, welfare deductions, C/F recovery &amp; net payable for all producers
            </Text>
          </Box>

          {savedId && (
            <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={12} />}>
              Saved
            </Badge>
          )}
        </Group>
      </Box>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <Paper withBorder shadow="sm" p="sm" radius="md" mb="md" className="no-print">
        <Group wrap="wrap" gap="sm" align="flex-end">
          {cycleGenerated ? (
            <Paper withBorder p="xs" radius="sm" style={{ minWidth: 300 }}>
              <Text size="xs" c="dimmed">Period (locked — save to advance)</Text>
              <Text fw={600} size="sm">
                {dayjs(fromDate).format('DD/MM/YYYY')} – {dayjs(toDate).format('DD/MM/YYYY')}
              </Text>
            </Paper>
          ) : (
            <>
              <DatePickerInput
                label="From Date"
                value={fromDate}
                onChange={(v) => {
                  if (!v) return;
                  setFromDate(v);
                  setToDate(dayjs(v).add(paymentDays - 1, 'day').toDate());
                }}
                leftSection={<IconCalendar size={15} />}
                valueFormat="DD/MM/YYYY"
                style={{ minWidth: 140 }}
                size="sm"
              />
              <DatePickerInput
                label="To Date"
                value={toDate}
                onChange={setToDate}
                leftSection={<IconCalendar size={15} />}
                valueFormat="DD/MM/YYYY"
                minDate={fromDate}
                style={{ minWidth: 140 }}
                size="sm"
              />
            </>
          )}

          <TextInput
            label="Search Producer"
            placeholder="ID or Name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            leftSection={<IconSearch size={15} />}
            style={{ minWidth: 200 }}
            size="sm"
          />

          <Box style={{ flex: 1 }} />

          <Button
            leftSection={<IconRefresh size={15} />}
            variant="light" color="teal" size="sm"
            loading={generating}
            onClick={handleGenerate}
            disabled={cycleGenerated && !editingId}
          >
            Generate
          </Button>

          <Button
            leftSection={<IconDeviceFloppy size={15} />}
            color="green" size="sm"
            loading={saving}
            onClick={handleSave}
            disabled={!cycleGenerated}
          >
            Save &amp; Post
          </Button>
          <Button
            leftSection={<IconHistory size={15} />}
            variant="light" color="violet" size="sm"
            loading={logLoading}
            onClick={handleLoadLog}
          >
            Payment Log
          </Button>

          <Button
            leftSection={<IconFileSpreadsheet size={15} />}
            variant="light" color="teal" size="sm"
            onClick={handleExport}
          >
            Export Excel
          </Button>

          <Button
            leftSection={<IconPrinter size={15} />}
            variant="filled" color="blue" size="sm"
            onClick={handlePrint}
          >
            Print
          </Button>

          <Tooltip label="Reset form">
            <ActionIcon variant="subtle" color="gray" size="lg" onClick={handleReset}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <Paper withBorder shadow="sm" radius="md" style={{ position: 'relative', overflow: 'hidden' }}>
        <LoadingOverlay visible={generating} />

        <ScrollArea type="always" scrollbarSize={12}>
          <Box id="prp-print-area" ref={printRef} p="md">

            {/* Print-only header */}
            <Box
              ta="center" mb="sm"
              className="print-header"
              style={{ display: 'none' }}
            >
              <Text fw={700} size="lg">{selectedCompany?.companyName || 'Dairy Cooperative Society'}</Text>
              <Text fw={600} size="md">PAYMENT REGISTER (PRODUCERS)</Text>
              <Text size="sm">
                Period: {dayjs(fromDate).format('DD/MM/YYYY')} to {dayjs(toDate).format('DD/MM/YYYY')}
              </Text>
              <Divider my="xs" />
            </Box>

            {/* Screen period label */}
            <Group justify="space-between" mb="xs" className="no-print">
              <Text fw={600} size="sm" c="dimmed">
                Period: {dayjs(fromDate).format('DD MMM YYYY')} – {dayjs(toDate).format('DD MMM YYYY')}
              </Text>
              <Group gap="xs">
                <Badge variant="light" color="blue" size="sm">
                  {rows.filter((r) => r.productId || n(r.milkValue)).length} producers
                </Badge>
                <Badge variant="light" color="green" size="sm">
                  Payable: {totals.payableCount}
                </Badge>
                <Badge variant="light" color="red" size="sm">
                  Receivable: {totals.receivableCount}
                </Badge>
              </Group>
            </Group>

            {/* ── Main Table ── */}
            <table style={TABLE_STYLE}>
              {/* ── colgroup ── */}
              <colgroup>
                <col style={{ width: 46 }} />   {/* Sl No */}
                <col style={{ width: 280 }} />  {/* Producer ID + Name (merged search) */}
                <col style={{ width: 100 }} />  {/* Prev Balance */}
                <col style={{ width: 80 }} />   {/* QTY */}
                <col style={{ width: 100 }} />  {/* Milk Value */}
                <col style={{ width: 84 }} />   {/* Welfare */}
                <col style={{ width: 84 }} />   {/* C/F Rec */}
                <col style={{ width: 84 }} />   {/* Loan Adv */}
                <col style={{ width: 90 }} />   {/* Cash Pocket */}
                <col style={{ width: 112 }} />  {/* Net Payable */}
                <col style={{ width: 80 }} />   {/* Status */}
                <col style={{ width: 88 }} />   {/* Sign */}
              </colgroup>

              {/* ── STICKY THEAD ── */}
              <thead>
                {/* Section row */}
                <tr style={{ background: '#0d3b6e', color: '#fff' }}>
                  <th style={TH_BASE} rowSpan={2}>Sl No</th>
                  <th style={{ ...TH_BASE, textAlign: 'left' }} rowSpan={2} colSpan={2}>Producer ID / Name</th>
                  <th style={{ ...TH_BASE, background: '#174a7c' }} rowSpan={2}>Prev. Balance</th>
                  {/* Milk section */}
                  <th style={{ ...TH_BASE, background: '#1a5276', textAlign: 'center' }} colSpan={2}>
                    MILK DETAILS
                  </th>
                  {/* Deductions */}
                  <th style={{ ...TH_BASE, background: '#6e2c00', textAlign: 'center' }} colSpan={4}>
                    DEDUCTIONS
                  </th>
                  {/* Net */}
                  <th style={{ ...TH_BASE, background: '#0e5e3f', textAlign: 'center' }} colSpan={2}>
                    NET PAYABLE
                  </th>
                  <th style={{ ...TH_BASE, background: '#2d3748' }} rowSpan={2}>Sign</th>
                </tr>

                <tr style={{ background: '#1c4e80', color: '#e8f1ff' }}>
                  {/* Milk sub-headers */}
                  <th style={{ ...TH_SUB, background: '#1a5276' }}>QTY (L)</th>
                  <th style={{ ...TH_SUB, background: '#1a5276' }}>Milk Value</th>
                  {/* Deduction sub-headers */}
                  <th style={{ ...TH_SUB, background: '#7e3200' }}>Welfare</th>
                  <th style={{ ...TH_SUB, background: '#7e3200' }}>C/F Rec</th>
                  <th style={{ ...TH_SUB, background: '#7e3200' }}>Loan Adv</th>
                  <th style={{ ...TH_SUB, background: '#7e3200' }}>Cash Pocket</th>
                  {/* Net sub-headers */}
                  <th style={{ ...TH_SUB, background: '#117a56' }}>Amount</th>
                  <th style={{ ...TH_SUB, background: '#117a56' }}>Status</th>
                </tr>
              </thead>

              {/* ── TBODY ── */}
              <tbody>
                {paginatedRows.map((row, idx) => {
                  const isEven   = idx % 2 === 0;
                  const rowBg    = isEven ? '#ffffff' : '#f5f9ff';
                  const netColor = n(row.netPayable) >= 0 ? '#155724' : '#721c24';
                  const netBg    = isEven
                    ? (n(row.netPayable) >= 0 ? '#d4edda' : '#f8d7da')
                    : (n(row.netPayable) >= 0 ? '#c3e6cb' : '#f5c6cb');

                  return (
                    <tr key={row._localId} style={{ background: rowBg }}>
                      {/* Sl No */}
                      <td style={TD_CENTER}>{row.slNo}</td>

                      {/* Producer ID + Name — unified search cell */}
                      <td style={{ ...TD_LEFT, padding: 0, position: 'relative' }} colSpan={2}>
                        {row.productId ? (
                          /* Farmer already selected — show locked display */
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', height: 30 }}>
                            <span style={{ fontSize: 11, color: '#1a365d', fontWeight: 700, minWidth: 70 }}>{row.productId}</span>
                            <span style={{ fontSize: 11, color: '#2d3748', flex: 1 }}>{row.productName}</span>
                          </div>
                        ) : (
                          /* Search mode */
                          <div style={{ position: 'relative' }}>
                            <input
                              value={rowSearch[row._localId]?.query || ''}
                              onChange={(e) => handleFarmerQuery(row._localId, e.target.value)}
                              onBlur={() => setTimeout(() => closeSearch(row._localId), 200)}
                              style={{ ...INPUT_LEFT, minWidth: 240, paddingLeft: 22 }}
                              placeholder="Search by name or member ID…"
                            />
                            <span style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', color: '#a0aec0', fontSize: 11, pointerEvents: 'none' }}>🔍</span>
                            {rowSearch[row._localId]?.open && (rowSearch[row._localId]?.results || []).length > 0 && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 999,
                                background: '#fff', border: '1px solid #cbd5e0', borderRadius: 4,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: 280, maxHeight: 180, overflowY: 'auto',
                              }}>
                                {rowSearch[row._localId].results.map(f => (
                                  <div
                                    key={f._id}
                                    onMouseDown={() => selectFarmer(row._localId, f)}
                                    style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#ebf8ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                  >
                                    <span style={{ fontWeight: 700, color: '#2b6cb0', minWidth: 60 }}>{f.farmerNumber}</span>
                                    <span style={{ color: '#2d3748' }}>{f.personalDetails?.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {rowSearch[row._localId]?.open && (rowSearch[row._localId]?.query || '').length > 0 && (rowSearch[row._localId]?.results || []).length === 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4, padding: '6px 12px', fontSize: 11, color: '#718096', minWidth: 200 }}>
                                No farmer found
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Previous Balance */}
                      <td style={{ ...TD_RIGHT, padding: 0, background: isEven ? '#fefefe' : '#f0f7ff' }}>
                        <input
                          type="number"
                          value={row.previousBalance}
                          onChange={(e) => updateRow(row._localId, 'previousBalance', e.target.value)}
                          style={INPUT_RIGHT}
                          placeholder="0.00"
                        />
                      </td>

                      {/* QTY */}
                      <td style={{ ...TD_RIGHT, padding: 0 }}>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => updateRow(row._localId, 'qty', e.target.value)}
                          style={INPUT_RIGHT}
                          placeholder="0.000"
                          min={0}
                        />
                      </td>

                      {/* Milk Value */}
                      <td style={{ ...TD_RIGHT, padding: 0 }}>
                        <input
                          type="number"
                          value={row.milkValue}
                          onChange={(e) => updateRow(row._localId, 'milkValue', e.target.value)}
                          style={INPUT_RIGHT}
                          placeholder="0.00"
                          min={0}
                        />
                      </td>

                      {/* Welfare */}
                      <td style={{ ...TD_RIGHT, padding: 0, background: isEven ? '#fff9f0' : '#fef3e2' }}>
                        <input
                          type="number"
                          value={row.welfare}
                          onChange={(e) => updateRow(row._localId, 'welfare', e.target.value)}
                          style={{ ...INPUT_RIGHT, color: '#7b341e' }}
                          placeholder="0.00"
                          min={0}
                        />
                      </td>

                      {/* C/F Rec */}
                      <td style={{ ...TD_RIGHT, padding: 0, background: isEven ? '#fff9f0' : '#fef3e2' }}>
                        <input
                          type="number"
                          value={row.cfRec}
                          onChange={(e) => updateRow(row._localId, 'cfRec', e.target.value)}
                          style={{ ...INPUT_RIGHT, color: '#7b341e', ...(row._cfZero ? { background: '#f0f0f0', cursor: 'not-allowed', opacity: 0.6 } : {}) }}
                          placeholder="0.00"
                          min={0}
                          disabled={!!row._cfZero}
                        />
                      </td>

                      {/* Loan Adv */}
                      <td style={{ ...TD_RIGHT, padding: 0, background: isEven ? '#fff9f0' : '#fef3e2' }}>
                        <input
                          type="number"
                          value={row.loanAdv}
                          onChange={(e) => updateRow(row._localId, 'loanAdv', e.target.value)}
                          style={{ ...INPUT_RIGHT, color: '#7b341e', ...(row._loanZero ? { background: '#f0f0f0', cursor: 'not-allowed', opacity: 0.6 } : {}) }}
                          placeholder="0.00"
                          min={0}
                          disabled={!!row._loanZero}
                        />
                      </td>

                      {/* Cash Pocket */}
                      <td style={{ ...TD_RIGHT, padding: 0, background: isEven ? '#fff9f0' : '#fef3e2' }}>
                        <input
                          type="number"
                          value={row.cashPocket}
                          onChange={(e) => updateRow(row._localId, 'cashPocket', e.target.value)}
                          style={{ ...INPUT_RIGHT, color: '#7b341e', ...(row._cashZero ? { background: '#f0f0f0', cursor: 'not-allowed', opacity: 0.6 } : {}) }}
                          placeholder="0.00"
                          min={0}
                          disabled={!!row._cashZero}
                        />
                      </td>

                      {/* Net Payable — auto calculated */}
                      <td
                        style={{
                          ...TD_RIGHT,
                          fontWeight: 700,
                          color: netColor,
                          background: netBg,
                          padding: '4px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ₹ {fmt(row.netPayable)}
                      </td>

                      {/* Pay Status badge */}
                      <td style={{ ...TD_CENTER, padding: '2px 4px' }}>
                        {row.payStatus && (() => {
                          const isPayable    = row.payStatus === 'Payable';
                          const isReceivable = row.payStatus === 'Receivable';
                          const color      = isPayable ? '#155724' : isReceivable ? '#721c24' : '#555';
                          const background = isPayable ? '#d4edda' : isReceivable ? '#f8d7da' : '#e2e3e5';
                          const border     = isPayable ? '#c3e6cb' : isReceivable ? '#f5c6cb' : '#ccc';
                          return (
                            <span style={{
                              display:       'inline-block',
                              fontSize:      10,
                              fontWeight:    700,
                              letterSpacing: 0.4,
                              color,
                              background,
                              border:        `1px solid ${border}`,
                              padding:       '2px 7px',
                              borderRadius:  4,
                            }}>
                              {row.payStatus}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Sign */}
                      <td style={{ ...TD_CENTER, minWidth: 80 }}>&nbsp;</td>

                    </tr>
                  );
                })}

                {/* Empty state */}
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '24px', color: '#adb5bd', fontStyle: 'italic', fontSize: 13 }}>
                      No records found. Click <strong>Generate</strong> to load producer data.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* ── TOTALS FOOTER ── */}
              <tfoot>
                <tr style={{ background: '#0d3b6e', color: '#fff', fontWeight: 700, fontSize: 12 }}>
                  <td style={{ ...TF, textAlign: 'center' }} colSpan={3}>
                    TOTAL ({rows.filter((r) => r.productId || n(r.milkValue)).length} Producers)
                  </td>
                  <td style={{ ...TF, textAlign: 'right' }}>{fmt(totals.previousBalance)}</td>
                  <td style={{ ...TF, textAlign: 'right' }}>{fmt(totals.qty)}</td>
                  <td style={{ ...TF, textAlign: 'right' }}>{fmt(totals.milkValue)}</td>
                  <td style={{ ...TF, textAlign: 'right', color: '#ffcba4' }}>{fmt(totals.welfare)}</td>
                  <td style={{ ...TF, textAlign: 'right', color: '#ffcba4' }}>{fmt(totals.cfRec)}</td>
                  <td style={{ ...TF, textAlign: 'right', color: '#ffcba4' }}>{fmt(totals.loanAdv)}</td>
                  <td style={{ ...TF, textAlign: 'right', color: '#ffcba4' }}>{fmt(totals.cashPocket)}</td>
                  <td style={{ ...TF, textAlign: 'right', color: '#7fffb5', fontSize: 13 }}>
                    ₹ {fmt(totals.netPayable)}
                  </td>
                  <td style={{ ...TF, textAlign: 'center', fontSize: 11 }}>
                    <div style={{ color: '#7fffb5' }}>Pay: {totals.payableCount}</div>
                    <div style={{ color: '#ff9a9a' }}>Rec: {totals.receivableCount}</div>
                  </td>
                  <td style={TF} />
                </tr>
              </tfoot>
            </table>

            {/* Formula note */}
            <Group mt="sm" gap="md" wrap="wrap">
              <Text size="xs" c="dimmed">
                <strong>Formula:</strong> Net Payable = Milk Value − Welfare − C/F Rec − Loan Adv − Cash Pocket + Previous Balance
              </Text>
              {savedId && (
                <Badge color="green" size="xs" variant="dot">Saved to database</Badge>
              )}
            </Group>

            {/* Print Signature Block */}
            <Box mt="xl" style={{ pageBreakInside: 'avoid' }}>
              <Grid>
                {['Prepared By', 'Checked By', 'Authorised Signatory'].map((label) => (
                  <Grid.Col key={label} span={4} ta="center">
                    <Box pt={44}>
                      <Divider mx="xl" />
                      <Text size="xs" mt={6} c="dimmed">{label}</Text>
                    </Box>
                  </Grid.Col>
                ))}
              </Grid>
            </Box>
          </Box>
        </ScrollArea>
      </Paper>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <Center mt="md" className="no-print">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Center>
      )}

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <Grid mt="md" gutter="sm" className="no-print">
        {[
          { label: 'Total Qty (L)',      value: totals.qty,             color: 'blue',   prefix: '',  isLitre: true },
          { label: 'Total Milk Value',   value: totals.milkValue,       color: 'green',  prefix: '₹' },
          { label: 'Prev. Balance',      value: totals.previousBalance, color: 'orange', prefix: '₹' },
          { label: 'Total Welfare',      value: totals.welfare,         color: 'red',    prefix: '₹' },
          { label: 'Total C/F Rec',      value: totals.cfRec,           color: 'grape',  prefix: '₹' },
          { label: 'Total Loan Adv',     value: totals.loanAdv,         color: 'violet', prefix: '₹' },
          { label: 'Total Cash Pocket',  value: totals.cashPocket,      color: 'indigo', prefix: '₹' },
          { label: 'Total Net Payable',  value: totals.netPayable,      color: 'teal',   prefix: '₹' },
        ].map((s) => (
          <Grid.Col key={s.label} span={{ base: 6, sm: 4, md: 3 }}>
            <Paper withBorder p="sm" radius="md" ta="center">
              <Text size="xs" c="dimmed" mb={4}>{s.label}</Text>
              <Text fw={700} c={s.color} size="sm">
                {s.prefix} {fmt(s.value)}{s.isLitre ? ' L' : ''}
              </Text>
            </Paper>
          </Grid.Col>
        ))}
      </Grid>
      {/* ── Payment Log Modal ───────────────────────────────────────────────── */}
      <Modal
        opened={showLog}
        onClose={() => setShowLog(false)}
        title="Payment Log — Producers Cycles"
        size="xl"
      >
        {logData.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">No saved cycles found.</Text>
        ) : (
          <ScrollArea>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0d3b6e', color: '#fff' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Period</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Milk Value</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Welfare</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Payable</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Posted</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logData.map((reg, i) => (
                  <tr key={reg._id} style={{ background: i % 2 === 0 ? '#fff' : '#f7fafc' }}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0' }}>
                      {dayjs(reg.fromDate).format('DD/MM/YYYY')} – {dayjs(reg.toDate).format('DD/MM/YYYY')}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                      ₹ {fmt(reg.totalMilkValue)}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                      ₹ {fmt(reg.totalWelfare)}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                      ₹ {fmt(reg.totalNetPay)}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      {reg.autoPosted ? (
                        <Badge color="green" size="xs">Yes</Badge>
                      ) : (
                        <Badge color="gray" size="xs">No</Badge>
                      )}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      <Group gap="xs" justify="center">
                        <Button size="xs" variant="light" color="blue" onClick={() => handleEditLog(reg)}>Edit</Button>
                        <Button size="xs" variant="light" color="red" onClick={() => handleDeleteLog(reg)}>Delete</Button>
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Modal>

    </Container>
  );
};

/* ─── Style constants ──────────────────────────────────────────────────────── */
const BORDER      = '1px solid #d0d7de';
const BORDER_HEAD = '1px solid #1a4070';

const TABLE_STYLE = {
  width:           '100%',
  borderCollapse:  'collapse',
  fontSize:        12,
  fontFamily:      'Arial, sans-serif',
  minWidth:        1100,
};

const TH_BASE = {
  border:         BORDER_HEAD,
  padding:        '7px 8px',
  textAlign:      'right',
  whiteSpace:     'nowrap',
  fontWeight:     600,
  fontSize:       11,
  letterSpacing:  0.5,
  position:       'sticky',
  top:            0,
  zIndex:         10,
};

const TH_SUB = {
  ...TH_BASE,
  fontSize:   10,
  fontWeight: 500,
  top:        33,
};

const TD_CENTER = {
  border:         BORDER,
  padding:        4,
  textAlign:      'center',
  verticalAlign:  'middle',
};

const TD_RIGHT = {
  border:         BORDER,
  padding:        4,
  textAlign:      'right',
  verticalAlign:  'middle',
};

const TD_LEFT = {
  border:         BORDER,
  padding:        4,
  textAlign:      'left',
  verticalAlign:  'middle',
};

const TF = {
  border:         BORDER_HEAD,
  padding:        '8px 8px',
  fontSize:       12,
  verticalAlign:  'middle',
};

const INPUT_BASE = {
  width:      '100%',
  border:     'none',
  outline:    'none',
  background: 'transparent',
  fontSize:   12,
  padding:    '4px 6px',
  fontFamily: 'inherit',
  height:     28,
};

const INPUT_LEFT  = { ...INPUT_BASE, textAlign: 'left'  };
const INPUT_RIGHT = { ...INPUT_BASE, textAlign: 'right' };

export default PaymentRegisterProducers;
