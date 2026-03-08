import { useState, useMemo, useRef } from 'react';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Table, ScrollArea, Stack, SimpleGrid, Loader, Center,
  Badge, SegmentedControl, ThemeIcon, Divider
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconBook2, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox, IconLayersIntersect
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

// ── Helpers ───────────────────────────────────────────────────────────────
const f2 = (n) => parseFloat(n || 0).toFixed(2);
const fz = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toFixed(2); };
const fmtDate = (d) => d ? dayjs(d).format('DD-MM-YYYY') : '-';

// ── Presets ───────────────────────────────────────────────────────────────
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

// ── Category display config ───────────────────────────────────────────────
const CATEGORY_CONFIG = {
  ASSETS:      { label: 'Assets',              color: '#1d4ed8', bg: '#dbeafe', badge: 'blue'   },
  LIABILITIES: { label: 'Liabilities',         color: '#dc2626', bg: '#fee2e2', badge: 'red'    },
  INCOME:      { label: 'Income',              color: '#166534', bg: '#dcfce7', badge: 'green'  },
  EXPENSES:    { label: 'Expenses',            color: '#92400e', bg: '#fef3c7', badge: 'yellow' },
  CAPITAL:     { label: 'Capital & Reserves',  color: '#6d28d9', bg: '#ede9fe', badge: 'violet' },
  OTHER:       { label: 'Other',               color: '#374151', bg: '#f3f4f6', badge: 'gray'   }
};

const getCatConf = (cat) => CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.OTHER;

// ── Ledger type filter options ────────────────────────────────────────────
const LEDGER_TYPE_OPTS = [
  { value: '', label: 'All Ledger Types' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank', label: 'Bank' },
  { value: 'Asset', label: 'Asset' },
  { value: 'Liability', label: 'Liability' },
  { value: 'Income', label: 'Income' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Capital', label: 'Capital' },
  { value: 'Purchases A/c', label: 'Purchases A/c' },
  { value: 'Sales A/c', label: 'Sales A/c' },
  { value: 'Trade Expenses', label: 'Trade Expenses' },
  { value: 'Trade Income', label: 'Trade Income' }
];

// ── Design tokens ─────────────────────────────────────────────────────────
const INDIGO  = '#312e81';
const INDIGO2 = '#4338ca';
const TH_BG   = '#eef2ff';

const thBase = {
  padding: '8px 10px', fontSize: 11, fontWeight: 700,
  color: INDIGO, background: TH_BG,
  border: '1px solid #c7d2fe', whiteSpace: 'nowrap', textAlign: 'center'
};
const thLeft = { ...thBase, textAlign: 'left' };
const tdBase = { padding: '6px 10px', fontSize: 12, border: '1px solid #e5e7eb' };
const tdRight = { ...tdBase, textAlign: 'right', fontFamily: 'monospace' };

// ── Main component ────────────────────────────────────────────────────────
const LedgerAbstract = () => {
  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset]         = useState('financialYear');
  const [dateRange, setDateRange]   = useState(getPresetRange('financialYear'));
  const [ledgerType, setLedgerType] = useState('');
  const printRef = useRef(null);
  const [view, setView]             = useState('grouped'); // grouped | flat

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
      const params = {
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD')
      };
      if (ledgerType) params.ledgerType = ledgerType;
      const res = await reportAPI.ledgerAbstract(params);
      setReportData(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // ── Group abstract by category ──────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!reportData?.abstract) return {};
    const map = {};
    reportData.abstract.forEach(item => {
      const cat = item.category || 'OTHER';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [reportData]);

  const catOrder = ['ASSETS', 'LIABILITIES', 'INCOME', 'EXPENSES', 'CAPITAL', 'OTHER'];
  const sortedCats = catOrder.filter(c => grouped[c]?.length);

  // ── Category subtotals ──────────────────────────────────────────────────
  const catTotals = (items) =>
    items.reduce((acc, it) => {
      if (it.openingBalanceType === 'Dr') acc.obDr += it.openingBalance;
      else                                 acc.obCr += it.openingBalance;
      acc.debit   += it.totalDebits;
      acc.credit  += it.totalCredits;
      if (it.closingBalanceType === 'Dr') acc.clDr += it.closingBalance;
      else                                 acc.clCr += it.closingBalance;
      return acc;
    }, { obDr: 0, obCr: 0, debit: 0, credit: 0, clDr: 0, clCr: 0 });

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!reportData?.abstract?.length) return;
    const rows = reportData.abstract.map(item => ({
      'Category':          item.category,
      'Ledger Name':       item.ledgerName,
      'Ledger Type':       item.ledgerType,
      'Opening Dr':        item.openingBalanceType === 'Dr' ? f2(item.openingBalance) : '',
      'Opening Cr':        item.openingBalanceType === 'Cr' ? f2(item.openingBalance) : '',
      'Total Debit':       f2(item.totalDebits),
      'Total Credit':      f2(item.totalCredits),
      'Closing Dr':        item.closingBalanceType === 'Dr' ? f2(item.closingBalance) : '',
      'Closing Cr':        item.closingBalanceType === 'Cr' ? f2(item.closingBalance) : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger Abstract');
    XLSX.writeFile(wb, `ledger_abstract_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Ledger Abstract exported to Excel', color: 'green' });
  };

  const s = reportData?.summary;
  const abstract = reportData?.abstract || [];

  // ── Render grouped table rows ───────────────────────────────────────────
  const renderGrouped = () => {
    const rows = [];
    sortedCats.forEach((cat, ci) => {
      const items = grouped[cat];
      const conf  = getCatConf(cat);
      const tot   = catTotals(items);

      // Category header
      rows.push(
        <Table.Tr key={`cat-${ci}`} style={{ background: conf.bg }}>
          <Table.Td colSpan={7} style={{ ...tdBase, fontWeight: 800, color: conf.color, fontSize: 12, paddingLeft: 14 }}>
            <Group gap="xs">
              <Badge size="sm" color={conf.badge} variant="filled">{items.length}</Badge>
              {conf.label}
            </Group>
          </Table.Td>
        </Table.Tr>
      );

      // Ledger rows
      items.forEach((item, ii) => {
        rows.push(
          <Table.Tr key={`item-${ci}-${ii}`} style={{ background: ii % 2 === 0 ? '#fff' : '#fafafa' }}>
            <Table.Td style={{ ...tdBase, paddingLeft: 28, color: '#374151' }}>{item.ledgerName}</Table.Td>
            <Table.Td style={{ ...tdBase, textAlign: 'center' }}>
              <Badge size="xs" variant="light" color={getCatConf(item.category).badge} style={{ fontSize: 9 }}>
                {item.ledgerType}
              </Badge>
            </Table.Td>
            {/* Opening */}
            <Table.Td style={{ ...tdRight, color: '#1d4ed8' }}>{item.openingBalanceType === 'Dr' ? fz(item.openingBalance) : ''}</Table.Td>
            <Table.Td style={{ ...tdRight, color: '#dc2626' }}>{item.openingBalanceType === 'Cr' ? fz(item.openingBalance) : ''}</Table.Td>
            {/* During */}
            <Table.Td style={{ ...tdRight }}>{fz(item.totalDebits)}</Table.Td>
            <Table.Td style={{ ...tdRight }}>{fz(item.totalCredits)}</Table.Td>
            {/* Closing */}
            <Table.Td style={{ ...tdRight, fontWeight: 700, color: item.closingBalanceType === 'Dr' ? '#1d4ed8' : '#dc2626' }}>
              {item.closingBalanceType === 'Dr'
                ? (fz(item.closingBalance) ? fz(item.closingBalance) + ' Dr' : '')
                : (fz(item.closingBalance) ? fz(item.closingBalance) + ' Cr' : '')}
            </Table.Td>
          </Table.Tr>
        );
      });

      // Category sub-total
      rows.push(
        <Table.Tr key={`tot-${ci}`} style={{ background: conf.bg, borderTop: `2px solid ${conf.color}33` }}>
          <Table.Td colSpan={2} style={{ ...tdBase, fontWeight: 800, color: conf.color, textAlign: 'right', paddingRight: 12 }}>
            Sub-total — {conf.label}
          </Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 800, color: '#1d4ed8' }}>{f2(tot.obDr)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 800, color: '#dc2626' }}>{f2(tot.obCr)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 800 }}>{f2(tot.debit)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 800 }}>{f2(tot.credit)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 800, color: conf.color }}>
            {tot.clDr > 0 ? f2(tot.clDr) + ' Dr' : tot.clCr > 0 ? f2(tot.clCr) + ' Cr' : '0.00'}
          </Table.Td>
        </Table.Tr>
      );
    });

    return rows;
  };

  // ── Render flat table rows ──────────────────────────────────────────────
  const renderFlat = () =>
    abstract.map((item, idx) => (
      <Table.Tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
        <Table.Td style={tdBase}>{item.ledgerName}</Table.Td>
        <Table.Td style={{ ...tdBase, textAlign: 'center' }}>
          <Badge size="xs" variant="light" color={getCatConf(item.category).badge} style={{ fontSize: 9 }}>
            {item.ledgerType}
          </Badge>
        </Table.Td>
        <Table.Td style={{ ...tdRight, color: '#1d4ed8' }}>{item.openingBalanceType === 'Dr' ? fz(item.openingBalance) : ''}</Table.Td>
        <Table.Td style={{ ...tdRight, color: '#dc2626' }}>{item.openingBalanceType === 'Cr' ? fz(item.openingBalance) : ''}</Table.Td>
        <Table.Td style={tdRight}>{fz(item.totalDebits)}</Table.Td>
        <Table.Td style={tdRight}>{fz(item.totalCredits)}</Table.Td>
        <Table.Td style={{ ...tdRight, fontWeight: 700, color: item.closingBalanceType === 'Dr' ? '#1d4ed8' : '#dc2626' }}>
          {item.closingBalanceType === 'Dr'
            ? (fz(item.closingBalance) ? fz(item.closingBalance) + ' Dr' : '')
            : (fz(item.closingBalance) ? fz(item.closingBalance) + ' Cr' : '')}
        </Table.Td>
      </Table.Tr>
    ));

  return (
    <Box p="md" ref={printRef}>
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: '1px solid #c7d2fe' }}>
        <Box style={{ background: `linear-gradient(90deg, ${INDIGO} 0%, ${INDIGO2} 60%, #6366f1 100%)`, padding: '12px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <IconBook2 size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>General Ledger — Abstract</Title>
                <Text size="xs" c="rgba(255,255,255,0.75)">
                  All ledger balances with opening, movement and closing — grouped by category
                </Text>
              </Box>
            </Group>
            {reportData && (
              <Badge size="lg" variant="white" color="indigo">
                {abstract.length} Ledger{abstract.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {sortedCats.length} Group{sortedCats.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </Group>
        </Box>

        {/* Summary cards */}
        {s && (
          <Box px="xl" py="sm" style={{ background: 'linear-gradient(135deg, #eef2ff, #f0f9ff)' }}>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              {[
                { label: 'Total Ledgers',  value: s.totalLedgers,                              color: 'indigo.8' },
                { label: 'Opening Debit',  value: `₹${f2(s.totalOpeningDebit)}`,               color: 'blue.8'   },
                { label: 'Opening Credit', value: `₹${f2(s.totalOpeningCredit)}`,              color: 'red.7'    },
                { label: 'Total Debit',    value: `₹${f2(s.totalDebits)}`,                    color: 'violet.8' },
                { label: 'Total Credit',   value: `₹${f2(s.totalCredits)}`,                   color: 'teal.8'   }
              ].map(stat => (
                <Box key={stat.label} style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">{stat.label}</Text>
                  <Text fw={800} c={stat.color} size="sm">{stat.value}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Paper>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <Paper radius="md" p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select label="Period" value={preset} onChange={handlePresetChange} data={PRESETS} style={{ flex: '1 1 140px' }} size="sm" />
          <DatePickerInput
            type="range" label="Date Range" value={dateRange}
            onChange={(val) => { setDateRange(val); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '2 1 240px' }} size="sm"
          />
          <Select
            label="Ledger Type"
            value={ledgerType}
            onChange={setLedgerType}
            data={LEDGER_TYPE_OPTS}
            style={{ flex: '1 1 160px' }}
            size="sm"
            clearable
          />
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} size="sm" style={{ background: INDIGO2 }}>
            Generate
          </Button>
          {abstract.length > 0 && (
            <>
              <Button leftSection={<IconFileExport size={16} />} variant="light" color="violet" onClick={handleExport} size="sm">
                Export Excel
              </Button>
              <Button leftSection={<IconPrinter size={16} />} variant="light" color="gray" onClick={() => printReport(printRef, { title: 'Ledger Abstract', orientation: 'landscape' })} size="sm">
                Print
              </Button>
            </>
          )}
        </Group>
      </Paper>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        {/* Table bar */}
        <Box style={{ background: `linear-gradient(90deg, ${INDIGO} 0%, ${INDIGO2} 100%)`, padding: '10px 16px' }}>
          <Group justify="space-between">
            <Group gap="sm">
              <IconLayersIntersect size={16} color="white" />
              <Text fw={700} size="sm" c="white">Ledger Abstract</Text>
            </Group>
            <Group gap="sm">
              {dateRange[0] && dateRange[1] && (
                <Text size="xs" c="rgba(255,255,255,0.8)">{fmtDate(dateRange[0])} — {fmtDate(dateRange[1])}</Text>
              )}
              {abstract.length > 0 && (
                <SegmentedControl
                  value={view}
                  onChange={setView}
                  data={[
                    { value: 'grouped', label: 'Grouped' },
                    { value: 'flat',    label: 'All Ledgers' }
                  ]}
                  size="xs"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                  styles={{ label: { color: '#fff', fontSize: 11 }, indicator: { background: 'rgba(255,255,255,0.3)' } }}
                />
              )}
            </Group>
          </Group>
        </Box>

        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="md" color="indigo" /></Center>
          ) : !reportData ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconBook2 size={48} color="#bdbdbd" />
                <Text c="dimmed" size="sm">Select a period and click Generate to view the ledger abstract</Text>
              </Stack>
            </Center>
          ) : abstract.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconInbox size={48} color="#bdbdbd" />
                <Text c="dimmed" size="sm">No ledger data found for this period</Text>
              </Stack>
            </Center>
          ) : (
            <Table withColumnBorders style={{ fontSize: 12, borderCollapse: 'collapse' }}>
              {/* Double-row header */}
              <Table.Thead>
                <Table.Tr>
                  <Table.Th rowSpan={2} style={{ ...thLeft, minWidth: 180, verticalAlign: 'middle' }}>Ledger Name</Table.Th>
                  <Table.Th rowSpan={2} style={{ ...thBase, minWidth: 110, verticalAlign: 'middle' }}>Type</Table.Th>
                  <Table.Th colSpan={2} style={{ ...thBase, background: '#dbeafe', color: '#1d4ed8', borderBottom: '1px solid #93c5fd' }}>Opening Balance</Table.Th>
                  <Table.Th colSpan={2} style={{ ...thBase, background: '#f3f4f6', color: '#374151', borderBottom: '1px solid #d1d5db' }}>During Period</Table.Th>
                  <Table.Th rowSpan={2} style={{ ...thBase, minWidth: 110, background: '#ede9fe', color: '#6d28d9', verticalAlign: 'middle' }}>Closing Balance</Table.Th>
                </Table.Tr>
                <Table.Tr>
                  <Table.Th style={{ ...thBase, minWidth: 95, background: '#dbeafe', color: '#1d4ed8', fontSize: 10 }}>Dr.</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 95, background: '#fee2e2', color: '#dc2626', fontSize: 10 }}>Cr.</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 95, background: '#f3f4f6', color: '#374151', fontSize: 10 }}>Debit</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 95, background: '#f3f4f6', color: '#374151', fontSize: 10 }}>Credit</Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {view === 'grouped' ? renderGrouped() : renderFlat()}
              </Table.Tbody>

              {/* Grand total footer */}
              {s && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#ede9fe' }}>
                    <Table.Td colSpan={2} style={{ ...tdBase, fontWeight: 900, color: INDIGO, fontSize: 12, textAlign: 'right', paddingRight: 12 }}>
                      GRAND TOTAL — {s.totalLedgers} Ledger{s.totalLedgers !== 1 ? 's' : ''}
                    </Table.Td>
                    <Table.Td style={{ ...tdRight, fontWeight: 900, color: '#1d4ed8', fontSize: 12 }}>{f2(s.totalOpeningDebit)}</Table.Td>
                    <Table.Td style={{ ...tdRight, fontWeight: 900, color: '#dc2626', fontSize: 12 }}>{f2(s.totalOpeningCredit)}</Table.Td>
                    <Table.Td style={{ ...tdRight, fontWeight: 900, fontSize: 12 }}>{f2(s.totalDebits)}</Table.Td>
                    <Table.Td style={{ ...tdRight, fontWeight: 900, fontSize: 12 }}>{f2(s.totalCredits)}</Table.Td>
                    <Table.Td style={{ ...tdRight, fontWeight: 900, color: INDIGO, fontSize: 12 }}>
                      {s.totalClosingDebit > s.totalClosingCredit
                        ? f2(s.totalClosingDebit) + ' Dr'
                        : f2(s.totalClosingCredit) + ' Cr'}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          )}
        </ScrollArea>

        {/* Category legend */}
        {abstract.length > 0 && (
          <Box p="sm" style={{ borderTop: '1px solid #e5e7eb', background: '#f8f8ff' }}>
            <Group gap="sm" wrap="wrap" mb={6}>
              {Object.entries(CATEGORY_CONFIG).filter(([k]) => sortedCats.includes(k)).map(([k, v]) => (
                <Badge key={k} size="sm" color={v.badge} variant="light">{v.label}: {grouped[k]?.length || 0}</Badge>
              ))}
            </Group>
            <Divider mb={6} />
            <Group gap="xl" wrap="wrap">
              <Text size="xs" c="dimmed">Dr = Debit balance (Asset/Expense nature)</Text>
              <Text size="xs" c="dimmed">Cr = Credit balance (Liability/Income nature)</Text>
              <Text size="xs" c="dimmed">During Period = total debits and credits within selected date range</Text>
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default LedgerAbstract;
