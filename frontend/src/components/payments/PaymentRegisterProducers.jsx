import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Container, Box, Group, Text, Title, Button, TextInput,
  Paper, Badge, Divider, ActionIcon, Tooltip,
  LoadingOverlay, Grid, ThemeIcon, ScrollArea, Pagination, Center,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar, IconSearch, IconRefresh, IconDeviceFloppy,
  IconPrinter, IconFileSpreadsheet, IconPlus, IconTrash, IconCheck,
  IconReportMoney,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { paymentRegisterAPI, farmerAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const fmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const n = (v) => parseFloat(v) || 0;

// Net Payable = Milk Value − Welfare − C/F Rec − Loan Adv − Cash Pocket + Previous Balance
const calcNet = (r) =>
  n(r.milkValue) - n(r.welfare) - n(r.cfRec) - n(r.loanAdv) - n(r.cashPocket) + n(r.previousBalance);

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

/* ─── Print styles ─────────────────────────────────────────────────────────── */
const PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    #prp-print-area, #prp-print-area * { visibility: visible !important; }
    #prp-print-area { position: fixed; inset: 0; padding: 12px; }
    table { page-break-inside: auto; border-collapse: collapse; }
    tr    { page-break-inside: avoid; }
    @page { size: A4 landscape; margin: 10mm; }
    .no-print { display: none !important; }
    .print-header { display: block !important; }
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
const PaymentRegisterProducers = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef();

  const [fromDate,    setFromDate]    = useState(dayjs().startOf('month').toDate());
  const [toDate,      setToDate]      = useState(dayjs().endOf('month').toDate());
  const [search,      setSearch]      = useState('');
  const [rows,        setRows]        = useState([emptyRow(1)]);
  const [saving,      setSaving]      = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [savedId,     setSavedId]     = useState(null);
  const [page,        setPage]        = useState(1);
  // Dates for the CURRENT entries (may differ from picker if dates were advanced after Generate)
  const [entriesPeriod, setEntriesPeriod] = useState(null); // { from, to }
  // Per-row farmer search: { [localId]: { query, results, open } }
  const [rowSearch,   setRowSearch]   = useState({});

  /* ── filtered / paginated rows ─────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        (r.productId   || '').toLowerCase().includes(q) ||
        (r.productName || '').toLowerCase().includes(q)
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
        updated.payStatus  =
          updated.netPayable > 0 ? 'Payable' :
          updated.netPayable < 0 ? 'Receivable' : '';
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
      updated.payStatus  = updated.netPayable > 0 ? 'Payable' : updated.netPayable < 0 ? 'Receivable' : '';
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
    // Block if a register already exists for this period
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

    setGenerating(true);
    try {
      const res = await paymentRegisterAPI.generateProducers({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
      });
      if (!res.success) throw new Error(res.message || 'Generate failed');

      const generated = (res.data.entries || []).map((e, i) => ({
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
        payStatus:       e.payStatus       || '',
        farmerId:        e.farmerId,
        _cfZero:         !e.cfRec,
        _loanZero:       !e.loanAdv,
        _cashZero:       !e.cashPocket,
      }));

      // Capture the period these entries belong to BEFORE advancing dates
      const currentFrom = fromDate;
      const currentTo   = toDate;
      setEntriesPeriod({ from: currentFrom, to: currentTo });

      setRows(generated.length > 0 ? generated : [emptyRow(1)]);
      setSavedId(null);
      setPage(1);

      notifications.show({
        title:   'Generated',
        message: `${generated.length} producer(s) loaded for ${dayjs(currentFrom).format('DD/MM/YYYY')} – ${dayjs(currentTo).format('DD/MM/YYYY')}`,
        color:   'teal',
        icon:    <IconCheck size={16} />,
      });

      // Advance date picker to next cycle (entries period is preserved separately)
      const cycleDays = dayjs(currentTo).diff(dayjs(currentFrom), 'day') + 1;
      const nextFrom  = dayjs(currentTo).add(1, 'day').toDate();
      const nextTo    = dayjs(nextFrom).add(cycleDays - 1, 'day').toDate();
      setFromDate(nextFrom);
      setToDate(nextTo);
      notifications.show({
        title:   'Cycle Advanced',
        message: `Next period: ${dayjs(nextFrom).format('DD/MM/YYYY')} – ${dayjs(nextTo).format('DD/MM/YYYY')}`,
        color:   'blue',
      });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setGenerating(false);
    }
  };

  /* ── Save ───────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    const valid = rows.filter((r) => r.productId || n(r.milkValue));
    if (valid.length === 0) {
      notifications.show({ title: 'Validation', message: 'Add at least one entry', color: 'orange' });
      return;
    }
    // Duplicate farmer check before save
    const ids = valid.map(r => r.productId?.trim().toLowerCase()).filter(Boolean);
    const dupId = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dupId) {
      notifications.show({
        title:   'Duplicate Entry',
        message: `Producer ID "${dupId}" appears more than once. Remove the duplicate before saving.`,
        color:   'red',
        autoClose: 5000,
      });
      return;
    }
    setSaving(true);
    try {
      // Use entriesPeriod if dates were advanced after Generate; else use current picker dates
      const saveFrom = entriesPeriod ? dayjs(entriesPeriod.from).format('YYYY-MM-DD') : dayjs(fromDate).format('YYYY-MM-DD');
      const saveTo   = entriesPeriod ? dayjs(entriesPeriod.to).format('YYYY-MM-DD')   : dayjs(toDate).format('YYYY-MM-DD');

      const payload = {
        fromDate:     saveFrom,
        toDate:       saveTo,
        registerType: 'Producers',
        status:       'Saved',
        entries:      rows.map(({ _localId, payStatus, ...r }) => r),
      };

      let res;
      if (savedId) {
        res = await paymentRegisterAPI.update(savedId, payload);
      } else {
        res = await paymentRegisterAPI.create(payload);
      }

      if (!res.success) throw new Error(res.message || 'Save failed');
      setSavedId(res.data._id);
      setEntriesPeriod(null); // clear after successful save
      notifications.show({ title: 'Saved', message: 'Payment register saved successfully', color: 'green', icon: <IconCheck size={16} /> });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
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
  const handlePrint = useReactToPrint({
    content:       () => printRef.current,
    documentTitle: `Payment_Register_Producers_${dayjs(fromDate).format('MMYYYY')}`,
  });

  /* ── Reset ──────────────────────────────────────────────────────────────── */
  const handleReset = () => {
    setRows([emptyRow(1)]);
    setSavedId(null);
    setSearch('');
    setPage(1);
  };

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════════════════════ */
  return (
    <Container fluid px="md" py="sm">
      <style>{PRINT_STYLE}</style>

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
          <DatePickerInput
            label="From Date"
            value={fromDate}
            onChange={setFromDate}
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
          >
            Generate
          </Button>

          <Button
            leftSection={<IconPlus size={15} />}
            variant="light" size="sm"
            onClick={addRow}
          >
            Add Row
          </Button>

          <Button
            leftSection={<IconDeviceFloppy size={15} />}
            color="green" size="sm"
            loading={saving}
            onClick={handleSave}
          >
            Save
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
            variant="outline" size="sm"
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
        <LoadingOverlay visible={generating || saving} />

        <ScrollArea type="hover" scrollbarSize={6}>
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
                <col style={{ width: 36 }} />   {/* Delete */}
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
                  <th style={{ ...TH_BASE, background: '#2d3748', padding: '7px 4px' }} rowSpan={2} className="no-print" />
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
                            <button
                              onClick={() => { updateRow(row._localId, 'productId', ''); updateRow(row._localId, 'productName', ''); updateRow(row._localId, 'farmerId', ''); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: 13, lineHeight: 1, padding: '0 2px' }}
                              title="Clear farmer"
                            >✕</button>
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
                        {row.payStatus && (
                          <span style={{
                            display:      'inline-block',
                            fontSize:     10,
                            fontWeight:   700,
                            letterSpacing: 0.4,
                            color:        row.payStatus === 'Payable' ? '#155724' : '#721c24',
                            background:   row.payStatus === 'Payable' ? '#d4edda' : '#f8d7da',
                            border:       `1px solid ${row.payStatus === 'Payable' ? '#c3e6cb' : '#f5c6cb'}`,
                            padding:      '2px 7px',
                            borderRadius: 4,
                          }}>
                            {row.payStatus}
                          </span>
                        )}
                      </td>

                      {/* Sign */}
                      <td style={{ ...TD_CENTER, minWidth: 80 }}>&nbsp;</td>

                      {/* Delete */}
                      <td style={{ ...TD_CENTER, padding: 2 }} className="no-print">
                        <ActionIcon
                          size="sm" color="red" variant="subtle"
                          onClick={() => deleteRow(row._localId)}
                          title="Remove row"
                        >
                          <IconTrash size={13} />
                        </ActionIcon>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty state */}
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '24px', color: '#adb5bd', fontStyle: 'italic', fontSize: 13 }}>
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
                    <div style={{ color: '#7fffb5' }}>▲ {totals.payableCount}</div>
                    <div style={{ color: '#ff9a9a' }}>▼ {totals.receivableCount}</div>
                  </td>
                  <td style={TF} />
                  <td style={TF} className="no-print" />
                </tr>
              </tfoot>
            </table>

            {/* Formula note */}
            <Group mt="sm" gap="md" wrap="wrap">
              <Text size="xs" c="dimmed">
                <strong>Formula:</strong> Net Payable = Milk Value − Welfare − C/F Rec − Loan Adv − Cash Pocket + Previous Balance
              </Text>
              <Text size="xs" c="dimmed">
                ▲ Payable (society pays producer) &nbsp; ▼ Receivable (producer owes society)
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
