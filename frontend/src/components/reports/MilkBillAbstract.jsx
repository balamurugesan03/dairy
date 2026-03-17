import { useState, useRef } from 'react';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Table, ScrollArea, Stack, SimpleGrid, Loader, Center, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconMilk, IconCalendar, IconRefresh, IconPrinter, IconFileExport, IconInbox
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

// ── Deduction column definitions (keys match backend) ──────────────────────
const DEDUCTION_COLS = [
  { key: 'floodRelief',    label: 'Flood Relief\nFund' },
  { key: 'licPremium',     label: 'LIC GI\nPremium' },
  { key: 'milkValueAdv',   label: 'Milk Value\nAddl. Adv.' },
  { key: 'milmaFeeds',     label: 'Milma\nFeeds' },
  { key: 'mineralMixture', label: 'Mineral\nMixture' },
  { key: 'mdi',            label: 'MDI' },
  { key: 'roundingDiff',   label: 'Rounding\nDiff.' },
  { key: 'shareInMilma',   label: 'Share in\nMilma' },
  { key: 'silageFactory',  label: 'Silage\nFactory' },
  { key: 'unionBank',      label: 'Union\nBank A/c' },
];

const fmt2  = (n) => parseFloat(n || 0).toFixed(2);
const fmt3  = (n) => parseFloat(n || 0).toFixed(3);
const fmtD  = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toFixed(2); };
const fmtDate = (d) => d ? dayjs(d).format('DD-MM-YYYY') : '-';

const PRESETS = [
  { value: 'thisMonth',     label: 'This Month' },
  { value: 'lastMonth',     label: 'Last Month' },
  { value: 'thisQuarter',   label: 'This Quarter' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom',        label: 'Custom Range' }
];

const getPresetRange = (preset) => {
  const now = dayjs();
  switch (preset) {
    case 'thisMonth':     return [now.startOf('month').toDate(), now.endOf('month').toDate()];
    case 'lastMonth':     return [now.subtract(1,'month').startOf('month').toDate(), now.subtract(1,'month').endOf('month').toDate()];
    case 'thisQuarter':   return [now.startOf('quarter').toDate(), now.endOf('quarter').toDate()];
    case 'financialYear': {
      const fy = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

// ── Design tokens ─────────────────────────────────────────────────────────
const NAVY  = '#0f2d5c';
const NAVY2 = '#1a4480';

const thBase = {
  padding: '6px 8px', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', color: '#fff', whiteSpace: 'pre-line',
  textAlign: 'center', background: NAVY2,
  border: '1px solid #3b6bc4', lineHeight: 1.3
};
const thBaseR = { ...thBase, textAlign: 'right' };
const tdBase  = { padding: '5px 8px', fontSize: 11, border: '1px solid #e2e8f0' };
const tdRight = { ...tdBase, textAlign: 'right', fontFamily: 'monospace' };
const tdCtr   = { ...tdBase, textAlign: 'center' };

// ── Component ─────────────────────────────────────────────────────────────
const MilkBillAbstract = () => {
  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset]         = useState('thisMonth');
  const [dateRange, setDateRange]   = useState(getPresetRange('thisMonth'));
  const printRef = useRef(null);

  const handlePresetChange = (val) => {
    setPreset(val);
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const fetchReport = async () => {
    const [start, end] = dateRange;
    if (!start || !end) {
      notifications.show({ title: 'Error', message: 'Select a date range', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await reportAPI.milkBillAbstract({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD')
      });
      setReportData(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!months.length) return;
    const rows = [];
    months.forEach(m => {
      m.rows.forEach((r, ri) => {
        const row = {
          'Month/Year': ri === 0 ? m.monthLabel : '',
          'Date': fmtDate(r.date),
          'Shift': r.shift || '',
          'Farmer No': r.farmerNumber,
          'Farmer Name': r.farmerName,
          'Qty (L)': fmt3(r.qty),
          'FAT': fmt2(r.fat),
          'SNF': fmt2(r.snf),
          'Rate': fmt2(r.rate),
          'Incentive': fmt2(r.incentive),
          'Milk Amount': fmt2(r.amount)
        };
        DEDUCTION_COLS.forEach(c => { row[c.label.replace('\n', ' ')] = fmtD(r.deductions?.[c.key]); });
        row['Net Payable'] = fmt2(r.netPayable);
        rows.push(row);
      });
      const tot = {
        'Month/Year': `${m.monthLabel} — TOTAL`, 'Date': '', 'Shift': '',
        'Farmer No': `${m.rows.length} entries`, 'Farmer Name': '',
        'Qty (L)': fmt3(m.totalQty), 'FAT': '', 'SNF': '', 'Rate': '', 'Incentive': '',
        'Milk Amount': fmt2(m.totalAmount)
      };
      DEDUCTION_COLS.forEach(c => { tot[c.label.replace('\n', ' ')] = fmt2(m.totals?.[c.key]); });
      tot['Net Payable'] = fmt2(m.totalPayment);
      rows.push(tot);
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Milk Bill Abstract');
    XLSX.writeFile(wb, `milk_bill_abstract_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Excel file downloaded', color: 'green' });
  };

  const months = reportData?.months || [];
  const gt     = reportData?.grandTotals;
  const totalRows = months.reduce((s, m) => s + m.rows.length, 0);

  // ── Render table body ─────────────────────────────────────────────────
  const renderRows = () => {
    const result = [];

    months.forEach((m, mi) => {
      // Month section header
      result.push(
        <Table.Tr key={`mhdr-${mi}`} style={{ background: NAVY }}>
          <Table.Td
            colSpan={11 + DEDUCTION_COLS.length + 1}
            style={{ padding: '6px 14px', color: '#fff', fontWeight: 800, fontSize: 12 }}
          >
            {m.monthLabel} &nbsp;—&nbsp; {m.rows.length} Collection{m.rows.length !== 1 ? 's' : ''} &nbsp;|&nbsp;
            Total Qty: {fmt3(m.totalQty)} L &nbsp;|&nbsp; Milk Value: ₹{fmt2(m.totalAmount)}
          </Table.Td>
        </Table.Tr>
      );

      // Individual collection rows
      m.rows.forEach((row, ri) => {
        result.push(
          <Table.Tr key={`r-${mi}-${ri}`} style={{ background: ri % 2 === 0 ? '#ffffff' : '#f0f7ff' }}>
            {/* Month/Year — show only in first row */}
            <Table.Td style={{ ...tdCtr, fontWeight: ri === 0 ? 700 : 400, color: ri === 0 ? NAVY : '#9ca3af', fontSize: ri === 0 ? 11 : 10 }}>
              {ri === 0 ? m.monthLabel : ''}
            </Table.Td>
            <Table.Td style={{ ...tdBase, whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</Table.Td>
            <Table.Td style={tdCtr}>
              <Badge size="xs" variant="light" color={row.shift === 'AM' ? 'yellow' : 'indigo'}>{row.shift || '-'}</Badge>
            </Table.Td>
            <Table.Td style={tdCtr}>{row.farmerNumber}</Table.Td>
            <Table.Td style={{ ...tdBase, fontWeight: 600 }}>{row.farmerName}</Table.Td>
            <Table.Td style={{ ...tdRight, color: '#0369a1', fontWeight: 600 }}>{fmt3(row.qty)}</Table.Td>
            <Table.Td style={tdRight}>{fmt2(row.fat)}</Table.Td>
            <Table.Td style={tdRight}>{fmt2(row.snf)}</Table.Td>
            <Table.Td style={tdRight}>₹{fmt2(row.rate)}</Table.Td>
            <Table.Td style={{ ...tdRight, color: '#166534' }}>{fmtD(row.incentive)}</Table.Td>
            <Table.Td style={{ ...tdRight, fontWeight: 700 }}>₹{fmt2(row.amount)}</Table.Td>
            {DEDUCTION_COLS.map(c => (
              <Table.Td key={c.key} style={{ ...tdRight, color: '#dc2626' }}>
                {fmtD(row.deductions?.[c.key])}
              </Table.Td>
            ))}
            <Table.Td style={{ ...tdRight, fontWeight: 800, color: '#065f46' }}>
              ₹{fmt2(row.netPayable)}
            </Table.Td>
          </Table.Tr>
        );
      });

      // Month total row
      result.push(
        <Table.Tr key={`mtot-${mi}`} style={{ background: '#cfe2ff' }}>
          <Table.Td colSpan={2} style={{ ...tdBase, fontWeight: 800, color: NAVY, textAlign: 'right', paddingRight: 10 }}>
            {m.monthLabel} Total
          </Table.Td>
          <Table.Td colSpan={3} style={{ ...tdBase, color: '#374151', fontWeight: 600 }}>
            {m.rows.length} entries
          </Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 800, color: '#0369a1' }}>{fmt3(m.totalQty)}</Table.Td>
          <Table.Td style={tdBase} />
          <Table.Td style={tdBase} />
          <Table.Td style={tdBase} />
          <Table.Td style={tdBase} />
          <Table.Td style={{ ...tdRight, fontWeight: 800 }}>₹{fmt2(m.totalAmount)}</Table.Td>
          {DEDUCTION_COLS.map(c => (
            <Table.Td key={c.key} style={{ ...tdRight, fontWeight: 800, color: '#b91c1c' }}>
              {fmt2(m.totals?.[c.key])}
            </Table.Td>
          ))}
          <Table.Td style={{ ...tdRight, fontWeight: 900, color: '#064e3b', fontSize: 12 }}>
            ₹{fmt2(m.totalPayment)}
          </Table.Td>
        </Table.Tr>
      );
    });

    // Grand total
    if (gt && months.length > 0) {
      result.push(
        <Table.Tr key="grand" style={{ background: '#9ec5fe' }}>
          <Table.Td colSpan={2} style={{ ...tdBase, fontWeight: 900, color: NAVY, textAlign: 'right', paddingRight: 10, fontSize: 12 }}>
            GRAND TOTAL
          </Table.Td>
          <Table.Td colSpan={3} style={{ ...tdBase, fontWeight: 700, color: '#374151' }}>
            {months.length} month{months.length !== 1 ? 's' : ''} · {totalRows} entries
          </Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 900, color: '#0369a1', fontSize: 12 }}>{fmt3(gt.qty)}</Table.Td>
          <Table.Td style={tdBase} />
          <Table.Td style={tdBase} />
          <Table.Td style={tdBase} />
          <Table.Td style={tdBase} />
          <Table.Td style={{ ...tdRight, fontWeight: 900, fontSize: 12 }}>₹{fmt2(gt.amount)}</Table.Td>
          {DEDUCTION_COLS.map(c => (
            <Table.Td key={c.key} style={{ ...tdRight, fontWeight: 900, color: '#991b1b', fontSize: 12 }}>
              {fmt2(gt.deductions?.[c.key])}
            </Table.Td>
          ))}
          <Table.Td style={{ ...tdRight, fontWeight: 900, color: '#064e3b', fontSize: 13 }}>
            ₹{fmt2(gt.payment)}
          </Table.Td>
        </Table.Tr>
      );
    }

    return result;
  };

  return (
    <Box p="md" ref={printRef}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: '1px solid #3b6bc4' }}>
        <Box style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY2} 60%, #2563eb 100%)`, padding: '12px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Box style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 10px' }}>
                <IconMilk size={26} color="white" />
              </Box>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Milk Bill Abstract</Title>
                <Text size="xs" c="rgba(255,255,255,0.75)">
                  Daily milk collection register — purchase flow with deduction summary
                </Text>
              </Box>
            </Group>
            {reportData && (
              <Badge size="lg" variant="white" color="blue">
                {months.length} Month{months.length !== 1 ? 's' : ''} · {totalRows} Entries
              </Badge>
            )}
          </Group>
        </Box>

        {gt && (
          <Box px="xl" py="sm" style={{ background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)' }}>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              {[
                { label: 'Total Collections', value: totalRows,              color: 'blue.8' },
                { label: 'Total Qty (L)',      value: fmt3(gt.qty),          color: 'cyan.8' },
                { label: 'Milk Value',         value: `₹${fmt2(gt.amount)}`,color: 'green.8' },
                { label: 'Total Deductions',   value: `₹${fmt2(DEDUCTION_COLS.reduce((s,c) => s + parseFloat(gt.deductions?.[c.key]||0), 0))}`, color: 'red.7' },
                { label: 'Net Payable',        value: `₹${fmt2(gt.payment)}`,color: 'teal.8' }
              ].map(s => (
                <Box key={s.label} style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">{s.label}</Text>
                  <Text fw={800} c={s.color} size="sm">{s.value}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Paper>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <Paper radius="md" p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select label="Period" value={preset} onChange={handlePresetChange} data={PRESETS} style={{ flex: '1 1 150px' }} size="sm" />
          <DatePickerInput
            type="range" label="Date Range" value={dateRange}
            onChange={(val) => { setDateRange(val); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '2 1 250px' }} size="sm"
          />
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} size="sm" style={{ background: NAVY2 }}>
            Generate
          </Button>
          {months.length > 0 && (
            <>
              <Button leftSection={<IconFileExport size={16} />} variant="light" color="teal" onClick={handleExport} size="sm">Export Excel</Button>
              <Button leftSection={<IconPrinter size={16} />} variant="light" color="gray" onClick={() => printReport(printRef, { title: 'Milk Bill Abstract', orientation: 'landscape' })} size="sm">Print</Button>
            </>
          )}
        </Group>
      </Paper>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <Box style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY2} 100%)`, padding: '10px 16px' }}>
          <Group justify="space-between">
            <Text fw={700} size="sm" c="white">MILK BILL ABSTRACT — Daily Collection & Deduction Register</Text>
            {dateRange[0] && dateRange[1] && (
              <Text size="xs" c="rgba(255,255,255,0.8)">{fmtDate(dateRange[0])} — {fmtDate(dateRange[1])}</Text>
            )}
          </Group>
        </Box>

        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="md" color="blue" /></Center>
          ) : !reportData ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconMilk size={48} color="#bdbdbd" />
                <Text c="dimmed" size="sm">Select a period and click Generate</Text>
              </Stack>
            </Center>
          ) : months.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconInbox size={48} color="#bdbdbd" />
                <Text c="dimmed" size="sm">No milk collection records found for this period</Text>
              </Stack>
            </Center>
          ) : (
            <Table withColumnBorders style={{ fontSize: 11, borderCollapse: 'collapse' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ ...thBase, minWidth: 75 }}>{'Month /\nYear'}</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 90 }}>{'Trans.\nDate'}</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 55 }}>Shift</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 65 }}>{'Farmer\nNo'}</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 120 }}>Farmer Name</Table.Th>
                  <Table.Th style={{ ...thBaseR, minWidth: 75 }}>{'Qty\n(Litre)'}</Table.Th>
                  <Table.Th style={{ ...thBaseR, minWidth: 55 }}>FAT</Table.Th>
                  <Table.Th style={{ ...thBaseR, minWidth: 55 }}>SNF</Table.Th>
                  <Table.Th style={{ ...thBaseR, minWidth: 65 }}>Rate</Table.Th>
                  <Table.Th style={{ ...thBaseR, minWidth: 70 }}>Incentive</Table.Th>
                  <Table.Th style={{ ...thBaseR, minWidth: 85 }}>{'Milk\nAmount'}</Table.Th>
                  {DEDUCTION_COLS.map(c => (
                    <Table.Th key={c.key} style={{ ...thBaseR, minWidth: 75 }}>{c.label}</Table.Th>
                  ))}
                  <Table.Th style={{ ...thBaseR, minWidth: 90, background: '#0a1f42' }}>{'Payment\nTotal'}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{renderRows()}</Table.Tbody>
            </Table>
          )}
        </ScrollArea>

        {months.length > 0 && (
          <Box p="sm" style={{ borderTop: '1px solid #e5e7eb', background: '#f8faff' }}>
            <Group gap="xl" wrap="wrap">
              <Text size="xs" c="dimmed">Dark blue rows = Month sections &nbsp;·&nbsp; Light blue = Month totals &nbsp;·&nbsp; Bold blue = Grand total</Text>
              <Text size="xs" c="dimmed">Net Payable = Milk Amount − All Deductions &nbsp;·&nbsp; Empty deduction cells = No deduction entered</Text>
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default MilkBillAbstract;
