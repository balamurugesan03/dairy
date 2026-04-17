import { useState, useEffect, useRef } from 'react';
import { farmerAPI, advanceAPI, producerOpeningAPI } from '../../services/api';
import {
  Container, Paper, Group, Text, Title, Box, Badge,
  Button, Select, ScrollArea, LoadingOverlay,
  ActionIcon, Tooltip, Stack, Modal, NumberInput,
  Textarea, TextInput, SimpleGrid, Divider, ThemeIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar, IconSearch, IconRefresh,
  IconPrinter, IconFileSpreadsheet, IconCheck,
  IconPlus, IconCurrencyRupee, IconUser,
  IconCash, IconArrowUpRight, IconAlertCircle,
  IconClipboardText, IconBuildingBank,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

/* ─── Style constants ─── */
const TH = (bg = '#0d3b6e') => ({
  background: bg, color: '#fff', padding: '7px 8px',
  textAlign: 'center', fontSize: 11, fontWeight: 700,
  border: '1px solid #1a4a7c', whiteSpace: 'nowrap',
  userSelect: 'none',
});
const TD = (extra = {}) => ({
  border: '1px solid #dde', padding: '5px 8px',
  fontSize: 11, verticalAlign: 'middle', ...extra,
});
const TD_NUM = (extra = {}) => ({
  ...TD({ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...extra }),
});

const fmt = (v) =>
  (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Balance Summary Card ─── */
const BalanceCard = ({ label, value, color, icon, note }) => {
  const colorMap = {
    gray:   { bg: '#f8f9fa', border: '#dee2e6', text: '#495057', badge: 'gray'   },
    blue:   { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', badge: 'blue'   },
    orange: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', badge: 'orange' },
    green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: 'green'  },
  };
  const c = colorMap[color] || colorMap.gray;
  return (
    <Box
      style={{
        background: c.bg,
        border: `1.5px solid ${c.border}`,
        borderRadius: 12,
        padding: '14px 18px',
        minWidth: 150,
      }}
    >
      <Group gap={8} mb={4}>
        <ThemeIcon size={28} radius="md" color={c.badge} variant="light">
          {icon}
        </ThemeIcon>
        <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      </Group>
      <Text fw={800} size="lg" c={c.text} style={{ fontVariantNumeric: 'tabular-nums' }}>
        ₹ {fmt(value)}
      </Text>
      {note && <Text size="10px" c="dimmed" mt={2}>{note}</Text>}
    </Box>
  );
};

/* ════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════ */
const CashAdvanceVoucher = () => {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Cash_Advance_${dayjs().format('DDMMYYYY')}`,
  });

  /* ── Report state ── */
  const [fromDate,  setFromDate]  = useState(dayjs().startOf('month').toDate());
  const [toDate,    setToDate]    = useState(dayjs().endOf('month').toDate());
  const [farmers,   setFarmers]   = useState([]);
  const [farmerId,  setFarmerId]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [rows,      setRows]      = useState([]);
  const [totals,    setTotals]    = useState(null);

  /* ── Form modal state ── */
  const [modalOpen,       setModalOpen]       = useState(false);
  const [submitting,      setSubmitting]       = useState(false);
  const [openingBalance,  setOpeningBalance]   = useState(null);  // from producerOpenings.cashAdvance
  const [outstanding,     setOutstanding]      = useState(0);     // from advanceAPI.getStats
  const [statsLoading,    setStatsLoading]     = useState(false);

  const emptyForm = {
    farmerId:               null,
    advanceDate:            new Date(),
    advanceType:            'Cash',
    advanceAmount:          '',
    paymentMode:            'Cash',
    repaymentType:          'Per Payment Deduction',
    monthlyDeductionAmount: '',
    purpose:                '',
    remarks:                '',
  };
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  /* ── Load farmer list ── */
  useEffect(() => {
    farmerAPI.getAll({ status: 'Active', limit: 500 })
      .then(res => {
        const list = res?.data || [];
        setFarmers(list.map(f => ({
          value: f._id,
          label: `${f.farmerNumber} — ${f.personalDetails?.name || ''}`,
        })));
      }).catch(() => {});
  }, []);

  /* ── When form farmer changes → load opening + outstanding ── */
  useEffect(() => {
    if (!form.farmerId) {
      setOpeningBalance(null);
      setOutstanding(0);
      return;
    }
    setStatsLoading(true);
    Promise.all([
      producerOpeningAPI.getByFarmer(form.farmerId).catch(() => null),
      advanceAPI.getStats({ farmerId: form.farmerId }).catch(() => null),
    ]).then(([openingRes, statsRes]) => {
      // cashAdvance from Producer Openings page
      const openingData = openingRes?.data || openingRes;
      setOpeningBalance(openingData ? Number(openingData.cashAdvance) || 0 : null);
      // total outstanding from Advance records
      setOutstanding(statsRes?.data?.totalOutstanding ?? statsRes?.totalOutstanding ?? 0);
    }).finally(() => setStatsLoading(false));
  }, [form.farmerId]);

  /* ── Generate Report ── */
  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await advanceAPI.getCashSummary({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
        ...(farmerId ? { farmerId } : {}),
      });
      if (!res.success) throw new Error(res.message || 'Failed');
      setRows(res.data.rows || []);
      setTotals(res.data.grandTotals || null);
      notifications.show({
        title: 'Loaded', color: 'teal', icon: <IconCheck size={14} />,
        message: `${res.data.rows?.length || 0} producer(s) loaded`,
      });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  /* ── Export ── */
  const exportExcel = () => {
    const data = rows.map(r => ({
      'SN':                   r.slNo,
      'Farmer ID':            r.farmerNumber,
      'Farmer Name':          r.farmerName,
      'Opening Balance (₹)':  r.opening,
      'Advances Given (₹)':   r.advanced,
      'Recovery (₹)':         r.recovery,
      'Balance (₹)':          r.balance,
    }));
    if (totals) {
      data.push({
        'SN': '', 'Farmer ID': '', 'Farmer Name': 'TOTAL',
        'Opening Balance (₹)':  totals.opening,
        'Advances Given (₹)':   totals.advanced,
        'Recovery (₹)':         totals.recovery,
        'Balance (₹)':          totals.balance,
      });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Cash Advance');
    XLSX.writeFile(wb, `Cash_Advance_${dayjs(fromDate).format('MMYYYY')}.xlsx`);
  };

  /* ── Form helpers ── */
  const setField = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.farmerId)     e.farmerId     = 'Select a producer';
    if (!form.advanceDate)  e.advanceDate  = 'Date is required';
    if (!form.advanceAmount || Number(form.advanceAmount) <= 0)
                            e.advanceAmount = 'Enter a valid amount';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    try {
      const payload = {
        farmerId:       form.farmerId,
        advanceDate:    dayjs(form.advanceDate).format('YYYY-MM-DD'),
        advanceType:    form.advanceType,
        advanceAmount:  Number(form.advanceAmount),
        advanceCategory:'Cash Advance',
        paymentMode:    form.paymentMode,
        repaymentType:  form.repaymentType,
        monthlyDeductionAmount: form.monthlyDeductionAmount ? Number(form.monthlyDeductionAmount) : 0,
        purpose:        form.purpose,
        remarks:        form.remarks,
      };
      const res = await advanceAPI.create(payload);
      if (!res.success) throw new Error(res.message || 'Failed to save');
      notifications.show({
        title: 'Cash Advance Added',
        message: `Advance ${res.data?.advanceNumber || ''} recorded successfully`,
        color: 'teal',
        icon: <IconCheck size={14} />,
      });
      setModalOpen(false);
      setForm(emptyForm);
      setErrors({});
      setOpeningBalance(null);
      setOutstanding(0);
      // Refresh report if already loaded
      if (rows.length > 0) fetchReport();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed', color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setForm(emptyForm);
    setErrors({});
    setOpeningBalance(null);
    setOutstanding(0);
  };

  /* ── Derived balance values for the form ── */
  const thisAmount  = Number(form.advanceAmount) || 0;
  const totalDue    = (openingBalance ?? 0) + outstanding + thisAmount;
  const dueColor    = totalDue > 0 ? 'orange' : 'green';

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <Container fluid px="md" py="sm">

      <Group justify="space-between" align="flex-end" mb="sm">
        <Box>
          <Title order={3} fw={700} c="#0d3b6e">Cash Advance</Title>
          <Text c="dimmed" size="sm">
            Producer-wise Cash Advance — Opening, Advances Given, Recovery &amp; Balance
          </Text>
        </Box>
        <Button
          leftSection={<IconPlus size={16} />}
          size="sm"
          radius="md"
          style={{
            background: 'linear-gradient(135deg, #0d3b6e 0%, #1a5fa8 100%)',
            boxShadow: '0 4px 14px rgba(13,59,110,0.35)',
          }}
          onClick={() => setModalOpen(true)}
        >
          New Cash Advance
        </Button>
      </Group>

      {/* ── Toolbar ── */}
      <Paper withBorder shadow="xs" p="sm" radius="md" mb="md">
        <Group wrap="wrap" gap="sm" align="flex-end">
          <DatePickerInput
            label="From Date" value={fromDate} onChange={setFromDate}
            leftSection={<IconCalendar size={15} />} valueFormat="DD/MM/YYYY"
            style={{ minWidth: 140 }} size="sm"
          />
          <DatePickerInput
            label="To Date" value={toDate} onChange={setToDate}
            leftSection={<IconCalendar size={15} />} valueFormat="DD/MM/YYYY"
            minDate={fromDate} style={{ minWidth: 140 }} size="sm"
          />
          <Select
            label="Producer (optional)"
            placeholder="All producers"
            data={farmers}
            value={farmerId}
            onChange={setFarmerId}
            searchable clearable
            style={{ minWidth: 260 }} size="sm"
          />
          <Box style={{ flex: 1 }} />
          <Button
            leftSection={<IconSearch size={15} />} size="sm"
            onClick={fetchReport} loading={loading} color="blue"
          >
            Generate
          </Button>
          <Button
            leftSection={<IconFileSpreadsheet size={15} />} size="sm"
            variant="light" color="teal"
            onClick={exportExcel} disabled={rows.length === 0}
          >
            Export Excel
          </Button>
          <Button
            leftSection={<IconPrinter size={15} />} size="sm"
            variant="outline"
            onClick={handlePrint} disabled={rows.length === 0}
          >
            Print
          </Button>
          <Tooltip label="Clear">
            <ActionIcon variant="subtle" color="gray" size="lg"
              onClick={() => { setRows([]); setTotals(null); }}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      {/* ── Report Table ── */}
      <Paper withBorder shadow="sm" radius="md" style={{ position: 'relative', overflow: 'hidden' }}>
        <LoadingOverlay visible={loading} />

        <Box px="sm" py="xs" style={{ background: '#0d3b6e', borderRadius: '8px 8px 0 0' }}>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text fw={700} size="sm" c="white">Cash Advance Report</Text>
              <Badge color="white" c="#0d3b6e" variant="filled" size="sm" radius="sm">
                {rows.length} Producers
              </Badge>
            </Group>
            <Text size="xs" c="white" opacity={0.8}>
              {dayjs(fromDate).format('DD MMM YYYY')} – {dayjs(toDate).format('DD MMM YYYY')}
            </Text>
          </Group>
        </Box>

        <div id="cash-advance-print" ref={printRef}>
          <ScrollArea type="hover" scrollbarSize={6}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }}>
              <colgroup>
                <col style={{ width: 46 }} />
                <col style={{ width: 100 }} />
                <col />
                <col style={{ width: 140 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 140 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={TH()}>SN</th>
                  <th style={{ ...TH(), textAlign: 'left' }}>Farmer ID</th>
                  <th style={{ ...TH(), textAlign: 'left' }}>Farmer Name</th>
                  <th style={TH('#174a7c')}>Opening Balance</th>
                  <th style={TH('#155724')}>Advances Given</th>
                  <th style={TH('#6e2c00')}>Recovery</th>
                  <th style={TH('#0e5e3f')}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={TD({ textAlign: 'center', padding: '32px', color: '#999' })}>
                      <Stack align="center" gap={4}>
                        <Text size="sm">Select date range and click Generate to load report</Text>
                      </Stack>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const rowBg  = idx % 2 === 0 ? '#fff' : '#f5f9ff';
                    const balClr = row.balance > 0 ? '#721c24' : row.balance < 0 ? '#276749' : '#555';
                    return (
                      <tr key={row.farmerId} style={{ background: rowBg }}>
                        <td style={TD({ textAlign: 'center', color: '#666' })}>{row.slNo}</td>
                        <td style={TD({ fontWeight: 600, color: '#0d3b6e' })}>{row.farmerNumber}</td>
                        <td style={TD({ fontWeight: 600 })}>{row.farmerName}</td>
                        <td style={TD_NUM({ color: '#2b6cb0' })}>₹ {fmt(row.opening)}</td>
                        <td style={TD_NUM({ color: '#276749' })}>₹ {fmt(row.advanced)}</td>
                        <td style={TD_NUM({ color: '#7b341e' })}>₹ {fmt(row.recovery)}</td>
                        <td style={TD_NUM({ fontWeight: 700, color: balClr })}>₹ {fmt(row.balance)}</td>
                      </tr>
                    );
                  })
                )}
                {totals && (
                  <tr style={{ borderTop: '2px solid #0d3b6e', background: '#edf2f7' }}>
                    <td colSpan={3} style={TD({ fontWeight: 700, textAlign: 'center', background: '#2d3748', color: '#fff', letterSpacing: 1 })}>
                      TOTAL
                    </td>
                    <td style={TD_NUM({ fontWeight: 700, color: '#2b6cb0', background: '#ebf8ff' })}>₹ {fmt(totals.opening)}</td>
                    <td style={TD_NUM({ fontWeight: 700, color: '#276749', background: '#f0fff4' })}>₹ {fmt(totals.advanced)}</td>
                    <td style={TD_NUM({ fontWeight: 700, color: '#7b341e', background: '#fff5eb' })}>₹ {fmt(totals.recovery)}</td>
                    <td style={TD_NUM({ fontWeight: 700, background: '#b2f5ea' })}>₹ {fmt(totals.balance)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </Paper>

      {/* ════════════════════════════════════════════════════════
          NEW CASH ADVANCE MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal
        opened={modalOpen}
        onClose={handleModalClose}
        title={
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" style={{ background: 'linear-gradient(135deg,#0d3b6e,#1a5fa8)' }}>
              <IconCash size={20} color="white" />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md">New Cash Advance</Text>
              <Text size="xs" c="dimmed">Record advance given to producer</Text>
            </Box>
          </Group>
        }
        size="lg"
        radius="lg"
        padding="xl"
        styles={{
          header: { borderBottom: '1px solid #eee', paddingBottom: 12 },
          body:   { paddingTop: 16 },
        }}
      >
        <Stack gap="md">

          {/* ── Balance Summary Cards ── */}
          {form.farmerId && (
            <Box>
              <Group justify="space-between" align="center" mb={8}>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.5 }}>
                  Producer Balance Summary
                </Text>
                {statsLoading && (
                  <Text size="xs" c="dimmed">Loading…</Text>
                )}
              </Group>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                <BalanceCard
                  label="Opening Cash Advance"
                  value={openingBalance ?? 0}
                  color="gray"
                  icon={<IconCurrencyRupee size={16} />}
                  note={openingBalance === null ? 'No opening record' : 'From Producer Openings'}
                />
                <BalanceCard
                  label="Outstanding Advances"
                  value={outstanding}
                  color="blue"
                  icon={<IconArrowUpRight size={16} />}
                  note="Pending from advance records"
                />
                <BalanceCard
                  label="This Advance"
                  value={thisAmount}
                  color="blue"
                  icon={<IconCash size={16} />}
                  note="Amount being given now"
                />
                <BalanceCard
                  label="Total Due"
                  value={totalDue}
                  color={dueColor}
                  icon={<IconAlertCircle size={16} />}
                  note={totalDue > 0 ? 'Pending recovery' : 'Fully cleared'}
                />
              </SimpleGrid>
            </Box>
          )}

          {form.farmerId && <Divider />}

          {/* ── Producer & Date ── */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Producer"
              placeholder="Search and select producer"
              data={farmers}
              value={form.farmerId}
              onChange={v => setField('farmerId', v)}
              searchable clearable
              leftSection={<IconUser size={16} color="#666" />}
              error={errors.farmerId}
              required
              styles={{ input: { borderRadius: 8 } }}
            />
            <DatePickerInput
              label="Advance Date"
              value={form.advanceDate}
              onChange={v => setField('advanceDate', v)}
              leftSection={<IconCalendar size={16} color="#666" />}
              valueFormat="DD/MM/YYYY"
              error={errors.advanceDate}
              required
              styles={{ input: { borderRadius: 8 } }}
            />
          </SimpleGrid>

          {/* ── Type & Amount ── */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Advance Type"
              value="Cash"
              readOnly
              styles={{ input: { borderRadius: 8, background: '#f5f5f5', cursor: 'default' } }}
            />
            <NumberInput
              label="Advance Amount (₹)"
              placeholder="0.00"
              value={form.advanceAmount}
              onChange={v => setField('advanceAmount', v)}
              leftSection={<IconCurrencyRupee size={16} color="#666" />}
              min={1}
              decimalScale={2}
              thousandSeparator=","
              error={errors.advanceAmount}
              required
              styles={{ input: { borderRadius: 8, fontWeight: 600 } }}
            />
          </SimpleGrid>

          {/* ── Payment Mode & Repayment ── */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Payment Mode"
              data={['Cash','Bank','UPI','Cheque']}
              value={form.paymentMode}
              onChange={v => setField('paymentMode', v)}
              leftSection={<IconBuildingBank size={16} color="#666" />}
              styles={{ input: { borderRadius: 8 } }}
            />
            <Select
              label="Repayment Type"
              data={['Lump Sum','Monthly Deduction','Per Payment Deduction','Custom']}
              value={form.repaymentType}
              onChange={v => setField('repaymentType', v)}
              styles={{ input: { borderRadius: 8 } }}
            />
          </SimpleGrid>

          {/* ── Monthly deduction (conditional) ── */}
          {form.repaymentType === 'Monthly Deduction' && (
            <NumberInput
              label="Monthly Deduction Amount (₹)"
              placeholder="0.00"
              value={form.monthlyDeductionAmount}
              onChange={v => setField('monthlyDeductionAmount', v)}
              leftSection={<IconCurrencyRupee size={16} color="#666" />}
              min={0}
              decimalScale={2}
              thousandSeparator=","
              styles={{ input: { borderRadius: 8 } }}
            />
          )}

          {/* ── Purpose & Remarks ── */}
          <TextInput
            label="Purpose"
            placeholder="e.g. Festival expense, medical emergency…"
            value={form.purpose}
            onChange={e => setField('purpose', e.target.value)}
            leftSection={<IconClipboardText size={16} color="#666" />}
            styles={{ input: { borderRadius: 8 } }}
          />
          <Textarea
            label="Remarks"
            placeholder="Additional notes (optional)"
            value={form.remarks}
            onChange={e => setField('remarks', e.target.value)}
            minRows={2}
            autosize
            styles={{ input: { borderRadius: 8 } }}
          />

          <Divider />

          {/* ── Actions ── */}
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" radius="md" onClick={handleModalClose}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              radius="md"
              loading={submitting}
              onClick={handleSubmit}
              style={{ background: 'linear-gradient(135deg,#0d3b6e,#1a5fa8)', minWidth: 140 }}
            >
              Save Advance
            </Button>
          </Group>

        </Stack>
      </Modal>

    </Container>
  );
};

export default CashAdvanceVoucher;
