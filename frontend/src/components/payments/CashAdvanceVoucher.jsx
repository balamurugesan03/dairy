import { useState, useEffect, useRef } from 'react';
import { farmerAPI, advanceAPI } from '../../services/api';
import {
  Container, Paper, Group, Text, Title, Box, Badge,
  Button, Select, ScrollArea, LoadingOverlay,
  ActionIcon, Tooltip, Stack,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar, IconSearch, IconRefresh,
  IconPrinter, IconFileSpreadsheet, IconCheck,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

/* ─── Style constants (matches Cattle Feed Advance) ─── */
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

/* ════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════ */
const CashAdvanceVoucher = () => {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Cash_Advance_${dayjs().format('DDMMYYYY')}`,
  });

  /* ── state ── */
  const [fromDate,  setFromDate]  = useState(dayjs().startOf('month').toDate());
  const [toDate,    setToDate]    = useState(dayjs().endOf('month').toDate());
  const [farmers,   setFarmers]   = useState([]);
  const [farmerId,  setFarmerId]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [rows,      setRows]      = useState([]);
  const [totals,    setTotals]    = useState(null);

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

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <Container fluid px="md" py="sm">

      <Box mb="sm">
        <Title order={3} fw={700} c="#0d3b6e">Cash Advance</Title>
        <Text c="dimmed" size="sm">
          Producer-wise Cash Advance report — Opening, Advances Given, Recovery &amp; Balance
        </Text>
      </Box>

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

        {/* Header bar */}
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

                {/* Total row */}
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

    </Container>
  );
};

export default CashAdvanceVoucher;
