import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Container, Box, Group, Text, Title, Button, TextInput,
  NumberInput, Paper, Badge, Divider, ActionIcon, Tooltip,
  LoadingOverlay, Stack, Grid, ThemeIcon, ScrollArea, Select,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar, IconSearch, IconRefresh, IconDeviceFloppy,
  IconPrinter, IconFileSpreadsheet, IconPlus, IconTrash,
  IconDownload, IconCurrencyRupee, IconCheck, IconAlertCircle,
  IconTable,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { paymentRegisterAPI, dairySettingsAPI, milkPurchaseSettingsAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

/* ─── helpers ────────────────────────────────────────────────────────────────── */
const fmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const n = (v) => parseFloat(v) || 0;

const calcNet = (r) => n(r.milkValue) + n(r.previousBalance) + n(r.otherEarnings) - n(r.welfare) - n(r.deductions);

const emptyRow = (slNo = 1) => ({
  _localId: Date.now() + slNo,
  slNo,
  productId:       '',
  productName:     '',
  center:          '',
  qty:             '',
  milkValue:       '',
  previousBalance: '',
  otherEarnings:   '',
  welfare:         '',
  deductions:      '',
  netPay:          0,
});

/* ─── Print styles ───────────────────────────────────────────────────────────── */
const PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    #pr-print-area, #pr-print-area * { visibility: visible !important; }
    #pr-print-area { position: fixed; inset: 0; padding: 12px; }
    table { page-break-inside: auto; }
    tr    { page-break-inside: avoid; }
    @page  { size: A4 landscape; margin: 10mm; }
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
const PaymentRegisterCreditor = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef();

  const [paymentDays,  setPaymentDays]  = useState(15);
  const [quantityUnit, setQuantityUnit] = useState('Litre');
  const [activeChart,  setActiveChart]  = useState('');

  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate,   setToDate]   = useState(dayjs().startOf('month').add(14, 'day').toDate());
  const [search,   setSearch]   = useState('');
  const [rows,     setRows]     = useState([emptyRow(1)]);
  const [saving,   setSaving]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedId,  setSavedId]  = useState(null);

  /* ── Load dairy settings & milk purchase settings on mount ───────────────── */
  useEffect(() => {
    Promise.all([
      dairySettingsAPI.get(),
      milkPurchaseSettingsAPI.getSummary(),
    ]).then(([ds, ms]) => {
      const days = ds?.data?.paymentDays ?? 15;
      setPaymentDays(days);
      setQuantityUnit(ms?.data?.quantityUnit ?? 'Litre');
      setActiveChart(ms?.data?.activeRateChartType ?? '');

      // Auto-set toDate based on paymentDays
      setToDate(dayjs(fromDate).add(days - 1, 'day').toDate());
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── When fromDate changes, shift toDate by paymentDays ──────────────────── */
  const handleFromDateChange = (date) => {
    setFromDate(date);
    setToDate(dayjs(date).add(paymentDays - 1, 'day').toDate());
  };

  /* ── derived / filtered ──────────────────────────────────────────────────── */
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.productId   || '').toLowerCase().includes(q) ||
      (r.productName || '').toLowerCase().includes(q)
    );
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.qty             += n(r.qty);
      acc.milkValue       += n(r.milkValue);
      acc.previousBalance += n(r.previousBalance);
      acc.otherEarnings   += n(r.otherEarnings);
      acc.welfare         += n(r.welfare);
      acc.deductions      += n(r.deductions);
      acc.netPay          += n(r.netPay);
      return acc;
    },
    { qty: 0, milkValue: 0, previousBalance: 0, otherEarnings: 0, welfare: 0, deductions: 0, netPay: 0 }
  );

  /* ── row helpers ─────────────────────────────────────────────────────────── */
  const updateRow = useCallback((localId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._localId !== localId) return r;
        const updated = { ...r, [field]: value };
        updated.netPay = calcNet(updated);
        return updated;
      })
    );
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length + 1)]);
  };

  const deleteRow = (localId) => {
    setRows((prev) => {
      const next = prev.filter((r) => r._localId !== localId);
      return next.map((r, i) => ({ ...r, slNo: i + 1 }));
    });
  };

  /* ── Generate from milk collections ─────────────────────────────────────── */
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await paymentRegisterAPI.generate({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
      });
      if (!res.success) throw new Error(res.message || 'Generate failed');

      const generated = (res.data.entries || []).map((e, i) => ({
        _localId:        Date.now() + i,
        slNo:            i + 1,
        productId:       e.productId       || '',
        productName:     e.productName     || '',
        center:          e.center          || '',
        qty:             e.qty             || 0,
        milkValue:       e.milkValue       || 0,
        previousBalance: e.previousBalance || 0,
        otherEarnings:   e.otherEarnings   || 0,
        welfare:         e.welfare         || 0,
        deductions:      e.deductions      || 0,
        netPay:          calcNet(e),
        farmerId:        e.farmerId,
      }));

      setRows(generated.length > 0 ? generated : [emptyRow(1)]);
      setSavedId(null);

      notifications.show({
        title: 'Generated',
        message: `${generated.length} producer(s) loaded for ${dayjs(fromDate).format('DD/MM/YYYY')} – ${dayjs(toDate).format('DD/MM/YYYY')}`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setGenerating(false);
    }
  };

  /* ── Save ─────────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (rows.length === 0 || rows.every((r) => !r.productId && !r.milkValue)) {
      notifications.show({ title: 'Validation', message: 'Add at least one entry', color: 'orange' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
        entries: rows.map(({ _localId, ...r }) => r),
        status: 'Saved',
      };

      let res;
      if (savedId) {
        res = await paymentRegisterAPI.update(savedId, payload);
      } else {
        res = await paymentRegisterAPI.create(payload);
      }

      if (!res.success) throw new Error(res.message || 'Save failed');
      setSavedId(res.data._id);

      notifications.show({ title: 'Saved', message: 'Payment register saved', color: 'green', icon: <IconCheck size={16} /> });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Print ────────────────────────────────────────────────────────────────── */
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Payment_Register_${dayjs(fromDate).format('MMYYYY')}`,
  });

  /* ── Reset ────────────────────────────────────────────────────────────────── */
  const handleReset = () => {
    setRows([emptyRow(1)]);
    setSavedId(null);
    setSearch('');
  };

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <Container fluid px="md" py="sm">
      <style>{PRINT_STYLE}</style>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <Box mb="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Box>
            <Group gap="xs" mb={4}>
              <ThemeIcon variant="light" size="lg" radius="md" color="green">
                <IconTable size={18} />
              </ThemeIcon>
              <Title order={3} fw={700}>Payment Register (Creditor Bill)</Title>
            </Group>
            <Text c="dimmed" size="sm">
              Milk value, deductions and net pay register for all producers
            </Text>
          </Box>

          {/* Status badge */}
          {savedId && (
            <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={12} />}>
              Saved
            </Badge>
          )}
        </Group>
      </Box>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <Paper withBorder shadow="sm" p="sm" radius="md" mb="md">
        <Group gap="xs" mb="xs">
          <Badge variant="light" color="cyan" size="sm">
            Payment cycle: {paymentDays === 30 ? '1 Month' : `${paymentDays} Days`}
          </Badge>
          <Badge variant="light" color="indigo" size="sm">
            Unit: {quantityUnit}
          </Badge>
          {activeChart && (
            <Badge variant="light" color="grape" size="sm">
              Rate: {activeChart}
            </Badge>
          )}
        </Group>
        <Group wrap="wrap" gap="sm" align="flex-end">
          <DatePickerInput
            label="From Date"
            value={fromDate}
            onChange={handleFromDateChange}
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
            label="Search"
            placeholder="Product ID / Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<IconSearch size={15} />}
            style={{ minWidth: 200 }}
            size="sm"
          />

          <Box style={{ flex: 1 }} />

          <Button
            leftSection={<IconRefresh size={15} />}
            variant="light"
            color="teal"
            size="sm"
            loading={generating}
            onClick={handleGenerate}
          >
            Generate
          </Button>

          <Button
            leftSection={<IconPlus size={15} />}
            variant="light"
            size="sm"
            onClick={addRow}
          >
            Add Row
          </Button>

          <Button
            leftSection={<IconDeviceFloppy size={15} />}
            color="green"
            size="sm"
            loading={saving}
            onClick={handleSave}
          >
            Save
          </Button>

          <Button
            leftSection={<IconPrinter size={15} />}
            variant="outline"
            size="sm"
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

      {/* ── Register Table ───────────────────────────────────────────────── */}
      <Paper withBorder shadow="sm" radius="md" style={{ position: 'relative', overflow: 'hidden' }}>
        <LoadingOverlay visible={generating || saving} />

        <ScrollArea>
          <Box id="pr-print-area" ref={printRef} p="md">
            {/* Print Header */}
            <Box ta="center" mb="sm" className="print-only" style={{ display: 'none' }}>
              <Text fw={700} size="lg">{selectedCompany?.companyName || 'Dairy Society'}</Text>
              <Text fw={600} size="md">PAYMENT REGISTER (CREDITOR BILL)</Text>
              <Text size="sm">
                Period: {dayjs(fromDate).format('DD/MM/YYYY')} to {dayjs(toDate).format('DD/MM/YYYY')}
              </Text>
              <Divider my="xs" />
            </Box>

            {/* Screen header inside table area */}
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm" c="dimmed">
                Period: {dayjs(fromDate).format('DD MMM YYYY')} – {dayjs(toDate).format('DD MMM YYYY')}
              </Text>
              <Badge variant="light" color="blue">{filtered.length} producers</Badge>
            </Group>

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
                fontFamily: 'Arial, sans-serif',
              }}
            >
              {/* ── THEAD ── */}
              <thead>
                <tr style={{ background: '#1c4e80', color: '#fff' }}>
                  {[
                    'SL No', 'Product ID', 'Product Name', 'Center', `Qty (${quantityUnit === 'KG' ? 'KG' : 'L'})`,
                    'Milk Value', 'Prev. Balance', 'Other Earnings', 'Welfare', 'Deductions',
                    'Net Pay', 'Signature',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        border: '1px solid #1a4070',
                        padding: '7px 8px',
                        textAlign: h === 'SL No' ? 'center' : 'right',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        fontSize: 11,
                        letterSpacing: 0.5,
                        ...(h === 'Product Name' || h === 'Product ID' || h === 'Center' ? { textAlign: 'left' } : {}),
                        ...(h === 'SL No' || h === 'Signature' ? { width: h === 'SL No' ? 48 : 100 } : {}),
                      }}
                    >
                      {h}
                    </th>
                  ))}
                  <th style={{ border: '1px solid #1a4070', padding: '7px 4px', textAlign: 'center', width: 36 }} />
                </tr>
              </thead>

              {/* ── TBODY ── */}
              <tbody>
                {(search ? filtered : rows).map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={row._localId}
                      style={{ background: isEven ? '#fff' : '#f7fbff' }}
                    >
                      {/* SL No */}
                      <td style={tdStyle('center')}>{row.slNo}</td>

                      {/* Product ID */}
                      <td style={tdStyle('left', 0)}>
                        <input
                          value={row.productId}
                          onChange={(e) => updateRow(row._localId, 'productId', e.target.value)}
                          style={inputStyle()}
                          placeholder="ID"
                        />
                      </td>

                      {/* Product Name */}
                      <td style={tdStyle('left', 0)}>
                        <input
                          value={row.productName}
                          onChange={(e) => updateRow(row._localId, 'productName', e.target.value)}
                          style={{ ...inputStyle(), minWidth: 160 }}
                          placeholder="Name"
                        />
                      </td>

                      {/* Center */}
                      <td style={tdStyle('left', 0)}>
                        <input
                          value={row.center}
                          onChange={(e) => updateRow(row._localId, 'center', e.target.value)}
                          style={{ ...inputStyle(), minWidth: 100 }}
                          placeholder="Center"
                        />
                      </td>

                      {/* Qty */}
                      <td style={tdStyle('right', 0)}>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => updateRow(row._localId, 'qty', e.target.value)}
                          style={inputStyle('right')}
                          placeholder="0.00"
                          min={0}
                        />
                      </td>

                      {/* Milk Value */}
                      <td style={tdStyle('right', 0)}>
                        <input
                          type="number"
                          value={row.milkValue}
                          onChange={(e) => updateRow(row._localId, 'milkValue', e.target.value)}
                          style={inputStyle('right')}
                          placeholder="0.00"
                          min={0}
                        />
                      </td>

                      {/* Previous Balance */}
                      <td style={tdStyle('right', 0)}>
                        <input
                          type="number"
                          value={row.previousBalance}
                          onChange={(e) => updateRow(row._localId, 'previousBalance', e.target.value)}
                          style={inputStyle('right')}
                          placeholder="0.00"
                        />
                      </td>

                      {/* Other Earnings */}
                      <td style={tdStyle('right', 0)}>
                        <input
                          type="number"
                          value={row.otherEarnings}
                          onChange={(e) => updateRow(row._localId, 'otherEarnings', e.target.value)}
                          style={inputStyle('right')}
                          placeholder="0.00"
                          min={0}
                        />
                      </td>

                      {/* Welfare */}
                      <td style={tdStyle('right', 0)}>
                        <input
                          type="number"
                          value={row.welfare}
                          onChange={(e) => updateRow(row._localId, 'welfare', e.target.value)}
                          style={inputStyle('right')}
                          placeholder="0.00"
                          min={0}
                        />
                      </td>

                      {/* Deductions */}
                      <td style={tdStyle('right', 0)}>
                        <input
                          type="number"
                          value={row.deductions}
                          onChange={(e) => updateRow(row._localId, 'deductions', e.target.value)}
                          style={inputStyle('right')}
                          placeholder="0.00"
                          min={0}
                        />
                      </td>

                      {/* Net Pay — auto calculated */}
                      <td
                        style={{
                          ...tdStyle('right'),
                          fontWeight: 700,
                          color: row.netPay >= 0 ? '#1c7a3c' : '#c0392b',
                          background: isEven ? '#f0fff4' : '#e6f7ee',
                          whiteSpace: 'nowrap',
                          padding: '4px 8px',
                        }}
                      >
                        {fmt(row.netPay)}
                      </td>

                      {/* Signature */}
                      <td style={{ ...tdStyle('center'), minWidth: 90 }}>&nbsp;</td>

                      {/* Delete */}
                      <td style={{ ...tdStyle('center'), padding: 2 }}>
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => deleteRow(row._localId)}
                          title="Delete row"
                        >
                          <IconTrash size={13} />
                        </ActionIcon>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ── TOTALS ROW ── */}
              <tfoot>
                <tr style={{ background: '#1c4e80', color: '#fff', fontWeight: 700 }}>
                  <td style={tfStyle('center')} colSpan={4}>TOTAL</td>
                  <td style={tfStyle('right')}>{fmt(totals.qty)}</td>
                  <td style={tfStyle('right')}>{fmt(totals.milkValue)}</td>
                  <td style={tfStyle('right')}>{fmt(totals.previousBalance)}</td>
                  <td style={tfStyle('right')}>{fmt(totals.otherEarnings)}</td>
                  <td style={tfStyle('right')}>{fmt(totals.welfare)}</td>
                  <td style={tfStyle('right')}>{fmt(totals.deductions)}</td>
                  <td style={{ ...tfStyle('right'), color: '#7fffb5' }}>{fmt(totals.netPay)}</td>
                  <td style={tfStyle('center')} />
                  <td style={tfStyle('center')} />
                </tr>
              </tfoot>
            </table>

            {/* Net Pay formula note */}
            <Group mt="sm" gap="lg" wrap="wrap">
              <Text size="xs" c="dimmed">
                Net Pay = Milk Value + Previous Balance + Other Earnings − Welfare − Deductions
              </Text>
              {savedId && (
                <Badge color="green" size="xs" variant="dot">Saved to database</Badge>
              )}
            </Group>

            {/* Print Signature Section */}
            <Box mt="xl" style={{ pageBreakInside: 'avoid' }}>
              <Grid>
                <Grid.Col span={4} ta="center">
                  <Box pt={40}>
                    <Divider mx="xl" />
                    <Text size="xs" mt="xs">Prepared By</Text>
                  </Box>
                </Grid.Col>
                <Grid.Col span={4} ta="center">
                  <Box pt={40}>
                    <Divider mx="xl" />
                    <Text size="xs" mt="xs">Verified By</Text>
                  </Box>
                </Grid.Col>
                <Grid.Col span={4} ta="center">
                  <Box pt={40}>
                    <Divider mx="xl" />
                    <Text size="xs" mt="xs">Authorised Signatory</Text>
                  </Box>
                </Grid.Col>
              </Grid>
            </Box>
          </Box>
        </ScrollArea>
      </Paper>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <Grid mt="md" gutter="sm">
        {[
          { label: 'Total Milk Value',       value: totals.milkValue,       color: 'green' },
          { label: 'Total Previous Balance', value: totals.previousBalance, color: 'orange' },
          { label: 'Total Other Earnings',   value: totals.otherEarnings,   color: 'blue' },
          { label: 'Total Welfare',          value: totals.welfare,         color: 'red' },
          { label: 'Total Deductions',       value: totals.deductions,      color: 'grape' },
          { label: 'Total Net Pay',          value: totals.netPay,          color: 'teal' },
        ].map((s) => (
          <Grid.Col key={s.label} span={{ base: 6, sm: 4, md: 2 }}>
            <Paper withBorder p="sm" radius="md" ta="center">
              <Text size="xs" c="dimmed" mb={4}>{s.label}</Text>
              <Text fw={700} c={s.color} size="sm">₹ {fmt(s.value)}</Text>
            </Paper>
          </Grid.Col>
        ))}
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Paper withBorder p="sm" radius="md" ta="center">
            <Text size="xs" c="dimmed" mb={4}>Producers</Text>
            <Text fw={700} c="blue" size="sm">{rows.filter(r => r.productId || r.milkValue).length}</Text>
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  );
};

/* ─── table cell style helpers ─────────────────────────────────────────────── */
const BORDER = '1px solid #d0d7de';

const tdStyle = (align = 'right', padding = 4) => ({
  border: BORDER,
  padding,
  textAlign: align,
  verticalAlign: 'middle',
});

const tfStyle = (align = 'right') => ({
  border: '1px solid #1a4070',
  padding: '7px 8px',
  textAlign: align,
  fontSize: 12,
});

const inputStyle = (align = 'left') => ({
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  textAlign: align,
  fontSize: 12,
  padding: '4px 6px',
  fontFamily: 'inherit',
});

export default PaymentRegisterCreditor;
