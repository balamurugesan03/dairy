import { useState, useRef } from 'react';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Table, ScrollArea, Loader, Center, Badge, ThemeIcon
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconScale, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox, IconCheck, IconAlertTriangle
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI, ledgerAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

// ── Helpers ───────────────────────────────────────────────────────────────
const f2 = (n) => parseFloat(n || 0).toFixed(2);
const fz = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toFixed(2); };
const fmtDate = (d) => d ? dayjs(d).format('DD-MM-YYYY') : '-';

// ── Presets — mirrors LedgerAbstract's convention, "Financial Year" default
// matches this report's backend default (getDateRange('financialYear')) ────
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
    case 'lastMonth':     return [now.subtract(1, 'month').startOf('month').toDate(), now.subtract(1, 'month').endOf('month').toDate()];
    case 'thisQuarter':   return [now.startOf('quarter').toDate(), now.endOf('quarter').toDate()];
    case 'financialYear': {
      const fy = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

// ── Parent-group display config — same palette as LedgerAbstract / Balance
// Sheet V2 so a ledger reads the same colour everywhere in the app ─────────
const PG_CONFIG = {
  ASSET:     { label: 'Assets',      color: '#1d4ed8', bg: '#dbeafe', badge: 'blue'   },
  LIABILITY: { label: 'Liabilities', color: '#dc2626', bg: '#fee2e2', badge: 'red'    },
  INCOME:    { label: 'Income',      color: '#166534', bg: '#dcfce7', badge: 'green'  },
  EXPENSE:   { label: 'Expenses',    color: '#92400e', bg: '#fef3c7', badge: 'yellow' },
  STOCK:     { label: 'Stock',       color: '#0e7490', bg: '#cffafe', badge: 'cyan'   },
  PL:        { label: 'P&L Carried Forward', color: '#6d28d9', bg: '#ede9fe', badge: 'violet' },
  OTHER:     { label: 'Other',       color: '#374151', bg: '#f3f4f6', badge: 'gray'   }
};
const pgConf = (pg) => PG_CONFIG[pg] || PG_CONFIG.OTHER;

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
const TrialBalance = () => {
  const [loading, setLoading]       = useState(false);
  const [ledgersLoading, setLedgersLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset]         = useState('financialYear');
  const [dateRange, setDateRange]   = useState(getPresetRange('financialYear'));
  const [group, setGroup]           = useState('');
  const [ledgerId, setLedgerId]     = useState('');
  const [allLedgers, setAllLedgers] = useState([]); // for the Group / Ledger filter dropdowns
  const printRef = useRef(null);

  const handlePresetChange = (val) => {
    setPreset(val);
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const ensureLedgersLoaded = async () => {
    if (allLedgers.length) return;
    setLedgersLoading(true);
    try {
      const response = await ledgerAPI.getAll({ status: 'Active' });
      setAllLedgers(response.data || []);
    } catch {
      // Non-fatal — Group/Ledger dropdowns simply stay empty; report itself still works.
    } finally {
      setLedgersLoading(false);
    }
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
      if (group)    params.group = group;
      if (ledgerId) params.ledgerId = ledgerId;
      const res = await reportAPI.trialBalance(params);
      setReportData(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch Trial Balance', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // Distinct Account Group names (ledgerType), sorted — populates the Group filter.
  const groupOptions = [
    { value: '', label: 'All Account Groups' },
    ...[...new Set(allLedgers.map(l => l.ledgerType).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map(t => ({ value: t, label: t }))
  ];

  const ledgerOptions = [
    { value: '', label: 'All Ledgers' },
    ...allLedgers
      .filter(l => !group || l.ledgerType === group)
      .sort((a, b) => a.ledgerName.localeCompare(b.ledgerName))
      .map(l => ({ value: l._id, label: `${l.ledgerName} (${l.ledgerType})` }))
  ];

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!reportData?.groups?.length) return;
    const rows = [];
    reportData.groups.forEach(pg => {
      pg.accountGroups.forEach(ag => {
        ag.ledgers.forEach(l => {
          rows.push({
            'Parent Group':  pg.parentGroup,
            'Account Group': ag.accountGroup,
            'Ledger Name':   l.ledgerName,
            'Opening Dr':    l.openingBalanceType === 'Dr' ? f2(l.openingBalance) : '',
            'Opening Cr':    l.openingBalanceType === 'Cr' ? f2(l.openingBalance) : '',
            'Period Debit':  f2(l.periodDebit),
            'Period Credit': f2(l.periodCredit),
            'Closing Dr':    l.closingBalanceType === 'Dr' ? f2(l.closingBalance) : '',
            'Closing Cr':    l.closingBalanceType === 'Cr' ? f2(l.closingBalance) : ''
          });
        });
      });
    });
    rows.push({ 'Parent Group': '', 'Account Group': '', 'Ledger Name': 'GRAND TOTAL (all ledgers, unfiltered)',
      'Opening Dr': '', 'Opening Cr': '', 'Period Debit': '', 'Period Credit': '',
      'Closing Dr': f2(reportData.grandDebitTotal), 'Closing Cr': f2(reportData.grandCreditTotal) });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
    XLSX.writeFile(wb, `trial_balance_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Trial Balance exported to Excel', color: 'green' });
  };

  const groups = reportData?.groups || [];
  const totalLedgerCount = groups.reduce((s, pg) => s + pg.accountGroups.reduce((s2, ag) => s2 + ag.ledgers.length, 0), 0);

  return (
    <Box p="md" ref={printRef}>
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: '1px solid #c7d2fe' }}>
        <Box style={{ background: `linear-gradient(90deg, ${INDIGO} 0%, ${INDIGO2} 60%, #6366f1 100%)`, padding: '12px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <IconScale size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Trial Balance</Title>
                <Text size="xs" c="rgba(255,255,255,0.75)">
                  Every ledger's Dr/Cr closing balance, grouped by Account Group
                </Text>
              </Box>
            </Group>
            {reportData && (
              <Group gap="xs">
                <Badge size="lg" variant="white" color="indigo">
                  {totalLedgerCount} Ledger{totalLedgerCount !== 1 ? 's' : ''}
                </Badge>
                <Badge
                  size="lg"
                  variant="filled"
                  color={reportData.isTallied ? 'green' : 'red'}
                  leftSection={reportData.isTallied ? <IconCheck size={14} /> : <IconAlertTriangle size={14} />}
                >
                  {reportData.isTallied ? 'Tallied' : 'Not Tallied'}
                </Badge>
              </Group>
            )}
          </Group>
        </Box>
      </Paper>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <Paper radius="md" p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select label="Period" value={preset} onChange={handlePresetChange} data={PRESETS} style={{ flex: '1 1 140px' }} size="sm" />
          <DatePickerInput
            label="From Date" value={dateRange[0]}
            onChange={(val) => { setDateRange([val, dateRange[1]]); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '1 1 140px' }} size="sm"
          />
          <DatePickerInput
            label="To Date" value={dateRange[1]}
            onChange={(val) => { setDateRange([dateRange[0], val]); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '1 1 140px' }} size="sm"
          />
          <Select
            label="Group"
            placeholder="All Account Groups"
            value={group}
            onChange={(val) => { setGroup(val || ''); setLedgerId(''); }}
            onDropdownOpen={ensureLedgersLoaded}
            data={groupOptions}
            style={{ flex: '1 1 180px' }}
            size="sm"
            searchable
            clearable
            rightSection={ledgersLoading ? <Loader size={14} /> : undefined}
          />
          <Select
            label="Ledger"
            placeholder="All Ledgers"
            value={ledgerId}
            onChange={(val) => setLedgerId(val || '')}
            onDropdownOpen={ensureLedgersLoaded}
            data={ledgerOptions}
            style={{ flex: '1 1 220px' }}
            size="sm"
            searchable
            clearable
          />
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} size="sm" style={{ background: INDIGO2 }}>
            Generate
          </Button>
          {groups.length > 0 && (
            <>
              <Button leftSection={<IconFileExport size={16} />} variant="light" color="violet" onClick={handleExport} size="sm">
                Export Excel
              </Button>
              <Button leftSection={<IconPrinter size={16} />} variant="light" color="gray" onClick={() => printReport(printRef, { title: 'Trial Balance', orientation: 'landscape' })} size="sm">
                Print
              </Button>
            </>
          )}
        </Group>
      </Paper>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <Box style={{ background: `linear-gradient(90deg, ${INDIGO} 0%, ${INDIGO2} 100%)`, padding: '10px 16px' }}>
          <Group justify="space-between">
            <Group gap="sm">
              <IconScale size={16} color="white" />
              <Text fw={700} size="sm" c="white">Trial Balance</Text>
            </Group>
            {dateRange[0] && dateRange[1] && (
              <Text size="xs" c="rgba(255,255,255,0.8)">{fmtDate(dateRange[0])} — {fmtDate(dateRange[1])}</Text>
            )}
          </Group>
        </Box>

        {loading ? (
          <Center py="xl"><Loader /></Center>
        ) : !reportData ? (
          <Center py="xl">
            <Box ta="center">
              <IconInbox size={40} color="#c7d2fe" />
              <Text c="dimmed" size="sm" mt="xs">Select a period and click Generate</Text>
            </Box>
          </Center>
        ) : groups.length === 0 ? (
          <Center py="xl">
            <Text c="dimmed" size="sm">No ledger activity for the selected filters</Text>
          </Center>
        ) : (
          <ScrollArea>
            <Table style={{ minWidth: 900, borderCollapse: 'collapse' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={thLeft}>Ledger Name</Table.Th>
                  <Table.Th style={thBase}>Account Group</Table.Th>
                  <Table.Th style={thBase}>Opening Dr</Table.Th>
                  <Table.Th style={thBase}>Opening Cr</Table.Th>
                  <Table.Th style={thBase}>Period Debit</Table.Th>
                  <Table.Th style={thBase}>Period Credit</Table.Th>
                  <Table.Th style={thBase}>Closing Dr</Table.Th>
                  <Table.Th style={thBase}>Closing Cr</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {groups.map((pg, pgi) => {
                  const conf = pgConf(pg.parentGroup);
                  return (
                    <Box component="tbody" key={`pg-${pgi}`} style={{ display: 'table-row-group' }}>
                      <Table.Tr style={{ background: conf.bg }}>
                        <Table.Td colSpan={8} style={{ ...tdBase, fontWeight: 800, color: conf.color, fontSize: 12, paddingLeft: 12 }}>
                          <Group gap="xs">
                            <Badge size="sm" color={conf.badge} variant="filled">
                              {pg.accountGroups.reduce((s, ag) => s + ag.ledgers.length, 0)}
                            </Badge>
                            {conf.label}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                      {pg.accountGroups.map((ag, agi) => (
                        <Box component="tbody" key={`ag-${pgi}-${agi}`} style={{ display: 'table-row-group' }}>
                          <Table.Tr style={{ background: '#fafafa' }}>
                            <Table.Td colSpan={8} style={{ ...tdBase, fontWeight: 700, color: '#4b5563', paddingLeft: 24, fontSize: 11.5 }}>
                              {ag.accountGroup}
                            </Table.Td>
                          </Table.Tr>
                          {ag.ledgers.map((l, li) => (
                            <Table.Tr key={`l-${pgi}-${agi}-${li}`} style={{ background: li % 2 === 0 ? '#fff' : '#fcfcfd' }}>
                              <Table.Td style={{ ...tdBase, paddingLeft: 36, color: '#374151' }}>{l.ledgerName}</Table.Td>
                              <Table.Td style={{ ...tdBase, textAlign: 'center' }}>
                                <Badge size="xs" variant="light" color={conf.badge} style={{ fontSize: 9 }}>{l.ledgerType}</Badge>
                              </Table.Td>
                              <Table.Td style={{ ...tdRight, color: '#1d4ed8' }}>{l.openingBalanceType === 'Dr' ? fz(l.openingBalance) : ''}</Table.Td>
                              <Table.Td style={{ ...tdRight, color: '#dc2626' }}>{l.openingBalanceType === 'Cr' ? fz(l.openingBalance) : ''}</Table.Td>
                              <Table.Td style={tdRight}>{fz(l.periodDebit)}</Table.Td>
                              <Table.Td style={tdRight}>{fz(l.periodCredit)}</Table.Td>
                              <Table.Td style={{ ...tdRight, fontWeight: 700, color: '#6d28d9' }}>{l.closingBalanceType === 'Dr' ? fz(l.closingBalance) : ''}</Table.Td>
                              <Table.Td style={{ ...tdRight, fontWeight: 700, color: '#9333ea' }}>{l.closingBalanceType === 'Cr' ? fz(l.closingBalance) : ''}</Table.Td>
                            </Table.Tr>
                          ))}
                          <Table.Tr style={{ background: conf.bg + '55' }}>
                            <Table.Td colSpan={2} style={{ ...tdBase, fontWeight: 700, color: conf.color, textAlign: 'right', paddingRight: 12 }}>
                              Sub-total — {ag.accountGroup}
                            </Table.Td>
                            <Table.Td colSpan={4} style={tdBase}></Table.Td>
                            <Table.Td style={{ ...tdRight, fontWeight: 800, color: '#6d28d9' }}>{ag.totalDebit > 0 ? f2(ag.totalDebit) : ''}</Table.Td>
                            <Table.Td style={{ ...tdRight, fontWeight: 800, color: '#9333ea' }}>{ag.totalCredit > 0 ? f2(ag.totalCredit) : ''}</Table.Td>
                          </Table.Tr>
                        </Box>
                      ))}
                    </Box>
                  );
                })}
              </Table.Tbody>
              <Table.Tfoot>
                {reportData.filters?.group || reportData.filters?.ledgerId ? (
                  <Table.Tr style={{ background: '#f1f5f9' }}>
                    <Table.Td colSpan={6} style={{ ...tdBase, fontWeight: 700, textAlign: 'right', paddingRight: 12 }}>
                      Filtered Total (current view)
                    </Table.Td>
                    <Table.Td style={{ ...tdRight, fontWeight: 800, color: '#6d28d9' }}>{f2(reportData.filteredDebitTotal)}</Table.Td>
                    <Table.Td style={{ ...tdRight, fontWeight: 800, color: '#9333ea' }}>{f2(reportData.filteredCreditTotal)}</Table.Td>
                  </Table.Tr>
                ) : null}
                <Table.Tr style={{ background: INDIGO, color: 'white' }}>
                  <Table.Td colSpan={6} style={{ ...tdBase, fontWeight: 800, color: 'white', textAlign: 'right', paddingRight: 12, border: 'none' }}>
                    GRAND TOTAL — Debit Total = Credit Total (all ledgers, unfiltered)
                  </Table.Td>
                  <Table.Td style={{ ...tdRight, fontWeight: 800, color: 'white', border: 'none' }}>{f2(reportData.grandDebitTotal)}</Table.Td>
                  <Table.Td style={{ ...tdRight, fontWeight: 800, color: 'white', border: 'none' }}>{f2(reportData.grandCreditTotal)}</Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </ScrollArea>
        )}
      </Paper>
    </Box>
  );
};

export default TrialBalance;
