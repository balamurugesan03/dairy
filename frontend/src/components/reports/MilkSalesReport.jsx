import { useState, useRef, useEffect } from 'react';
import {
  Box, Group, Text, Button, Badge, Paper, Stack, Title,
  SimpleGrid, Select, SegmentedControl, Loader, Center,
  ThemeIcon, Divider, Tabs, ActionIcon, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconRefresh, IconPrinter, IconFileExport, IconMilk,
  IconCurrencyRupee, IconDroplet, IconCalendar,
  IconUsers, IconUser, IconBuildingStore, IconListDetails,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { milkSalesAPI, collectionCenterAPI, agentAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { localDateStr } from '../../utils/dateUtils';
import { printVyaparReport } from '../../utils/printReport';

// ── Formatters ──────────────────────────────────────────────────
const f2  = v => Number(v || 0).toFixed(2);
const f3  = v => Number(v || 0).toFixed(3);
const fz2 = v => { const n = Number(v || 0); return n === 0 ? '' : n.toFixed(2); };
const fmtDate = d => { if (!d) return ''; const dt = dayjs(d); return dt.format('DD/MM/YYYY'); };
const fmtDateShort = d => { if (!d) return ''; return dayjs(d).format('DD/MM/YY'); };
const toISO = d => d instanceof Date ? localDateStr(d) : d;

const SALE_MODES = [
  { value: 'LOCAL',  label: 'Local Sales',  color: '#1a5fa8', bg: '#dbeafe' },
  { value: 'CREDIT', label: 'Credit Sales', color: '#b45309', bg: '#fef3c7' },
  { value: 'SAMPLE', label: 'Sample Sales', color: '#6d28d9', bg: '#ede9fe' },
];

const SHIFT_OPTS = [
  { value: '', label: 'All Shifts' },
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

const VIEW_OPTS_LOCAL = [
  { value: 'date',   label: 'Date Wise' },
  { value: 'center', label: 'Center Wise' },
  { value: 'agent',  label: 'Agent Wise' },
  { value: 'detail', label: 'Detail' },
];
const VIEW_OPTS_CREDIT = [
  { value: 'date',     label: 'Date Wise' },
  { value: 'creditor', label: 'Customer Wise' },
  { value: 'detail',   label: 'Detail' },
];

// ── Stat card ────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, color = '#1c3d6e' }) => (
  <Paper withBorder radius="sm" p="sm" style={{ borderLeft: `4px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={2}>
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.4px' }}>{label}</Text>
        <Text fw={900} size="lg" style={{ color, lineHeight: 1.1 }}>{value}</Text>
        {sub && <Text size="xs" c="dimmed" fw={500}>{sub}</Text>}
      </Stack>
      <ThemeIcon variant="light" size={38} radius="md" style={{ background: `${color}18`, color, flexShrink: 0 }}>
        <Icon size={20} />
      </ThemeIcon>
    </Group>
  </Paper>
);

// ── Shared table styles ──────────────────────────────────────────
const TH = { background: '#1c3d6e', color: '#fff', padding: '6px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center', border: '1px solid #1c3d6e' };
const THL = { ...TH, textAlign: 'left' };
const TD = { border: '1px solid #ddd', padding: '5px 8px', fontSize: 11 };
const TDR = { ...TD, textAlign: 'right', fontFamily: 'monospace' };
const TOT = { ...TD, background: '#1c3d6e', color: '#fff', fontWeight: 800 };
const TOTR = { ...TDR, background: '#1c3d6e', color: '#fff', fontWeight: 800 };

// ── Column defs by view ──────────────────────────────────────────
const dateHeaders = (
  <tr>
    <th style={{ ...TH, minWidth: 36 }}>#</th>
    <th style={{ ...THL, minWidth: 90 }}>Date</th>
    <th style={{ ...TH, minWidth: 70 }}>AM Ltr</th>
    <th style={{ ...TH, minWidth: 80 }}>AM Amt (₹)</th>
    <th style={{ ...TH, minWidth: 70 }}>PM Ltr</th>
    <th style={{ ...TH, minWidth: 80 }}>PM Amt (₹)</th>
    <th style={{ ...TH, minWidth: 75 }}>Total Ltr</th>
    <th style={{ ...TH, minWidth: 90 }}>Total Amt (₹)</th>
    <th style={{ ...TH, minWidth: 50 }}>Bills</th>
  </tr>
);

const groupHeaders = (nameLabel) => (
  <tr>
    <th style={{ ...TH, minWidth: 36 }}>#</th>
    <th style={{ ...THL, minWidth: 160 }}>{nameLabel}</th>
    <th style={{ ...TH, minWidth: 70 }}>AM Ltr</th>
    <th style={{ ...TH, minWidth: 80 }}>AM Amt (₹)</th>
    <th style={{ ...TH, minWidth: 70 }}>PM Ltr</th>
    <th style={{ ...TH, minWidth: 80 }}>PM Amt (₹)</th>
    <th style={{ ...TH, minWidth: 75 }}>Total Ltr</th>
    <th style={{ ...TH, minWidth: 90 }}>Total Amt (₹)</th>
    <th style={{ ...TH, minWidth: 50 }}>Bills</th>
  </tr>
);

const detailHeaders = (mode) => (
  <tr>
    <th style={{ ...TH, minWidth: 36 }}>#</th>
    <th style={{ ...TH, minWidth: 90 }}>Date</th>
    <th style={{ ...TH, minWidth: 50 }}>Shift</th>
    <th style={{ ...TH, minWidth: 110 }}>Bill No</th>
    {mode === 'CREDIT'
      ? <th style={{ ...THL, minWidth: 150 }}>Customer</th>
      : <>
          <th style={{ ...THL, minWidth: 130 }}>Center</th>
          <th style={{ ...THL, minWidth: 120 }}>Agent</th>
        </>}
    <th style={{ ...TH, minWidth: 70 }}>Litres</th>
    <th style={{ ...TH, minWidth: 70 }}>Rate</th>
    <th style={{ ...TH, minWidth: 90 }}>Amount (₹)</th>
    <th style={{ ...TH, minWidth: 70 }}>Mode</th>
  </tr>
);

const GroupRow = ({ row, idx, nameKey }) => (
  <tr style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
    <td style={{ ...TD, textAlign: 'center' }}>{idx + 1}</td>
    <td style={TD}>{row[nameKey] || '—'}</td>
    <td style={TDR}>{fz2(row.amLitre)}</td>
    <td style={TDR}>{fz2(row.amAmount)}</td>
    <td style={TDR}>{fz2(row.pmLitre)}</td>
    <td style={TDR}>{fz2(row.pmAmount)}</td>
    <td style={{ ...TDR, fontWeight: 700 }}>{f3(row.totalLitre)}</td>
    <td style={{ ...TDR, fontWeight: 700 }}>{f2(row.totalAmount)}</td>
    <td style={{ ...TD, textAlign: 'center' }}>{row.count}</td>
  </tr>
);

const TotalRow = ({ s }) => (
  <tr>
    <td colSpan={2} style={{ ...TOT, textAlign: 'right', paddingRight: 12 }}>TOTAL</td>
    <td style={TOTR}>{f3(s.amLitre)}</td>
    <td style={TOTR}>{f2(s.amAmount)}</td>
    <td style={TOTR}>{f3(s.pmLitre)}</td>
    <td style={TOTR}>{f2(s.pmAmount)}</td>
    <td style={TOTR}>{f3(s.totalLitre)}</td>
    <td style={TOTR}>{f2(s.totalAmount)}</td>
    <td style={{ ...TOT, textAlign: 'center' }}>{s.count}</td>
  </tr>
);

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export default function MilkSalesReport() {
  const { company } = useCompany();
  const printRef    = useRef(null);

  const today        = localDateStr(new Date());
  const firstOfMonth = today.slice(0, 8) + '01';

  const [saleMode, setSaleMode] = useState('LOCAL');
  const [fromDate, setFromDate] = useState(new Date(firstOfMonth));
  const [toDate,   setToDate]   = useState(new Date(today));
  const [shift,    setShift]    = useState('');
  const [centerId, setCenterId] = useState('');
  const [agentId,  setAgentId]  = useState('');
  const [view,     setView]     = useState('date');
  const [loading,  setLoading]  = useState(false);
  const [data,     setData]     = useState(null);
  const [errMsg,   setErrMsg]   = useState('');

  const [centers,  setCenters]  = useState([]);
  const [agents,   setAgents]   = useState([]);

  // Load filter options
  useEffect(() => {
    collectionCenterAPI.getAll().then(r => {
      const list = r?.data || r || [];
      setCenters(list.map(c => ({ value: c._id, label: c.centerName })));
    }).catch(() => {});
    agentAPI.getAllActive().then(r => {
      const list = r?.data || r || [];
      setAgents(list.map(a => ({ value: a._id, label: a.agentName })));
    }).catch(() => {});
  }, []);

  // Reset view when saleMode changes
  useEffect(() => {
    setView('date');
    setData(null);
  }, [saleMode]);

  const handleLoad = async () => {
    setLoading(true); setErrMsg(''); setData(null);
    try {
      const params = {
        fromDate: toISO(fromDate),
        toDate:   toISO(toDate),
        saleMode,
      };
      if (shift)    params.session  = shift;
      if (centerId) params.centerId = centerId;
      if (agentId)  params.agentId  = agentId;

      const res = await milkSalesAPI.getReport(params);
      if (res?.success) setData(res.data);
      else setErrMsg(res?.message || 'Failed to load');
    } catch (e) {
      setErrMsg(e.message || 'Error loading report');
    } finally {
      setLoading(false);
    }
  };

  const modeConf = SALE_MODES.find(m => m.value === saleMode);
  const viewOpts = saleMode === 'CREDIT' ? VIEW_OPTS_CREDIT : VIEW_OPTS_LOCAL;
  const s        = data?.summary;
  const societyName = company?.name || 'Dairy Society';
  const periodLabel = `${fmtDate(toISO(fromDate))} to ${fmtDate(toISO(toDate))}`;

  // ── Active rows for current view ─────────────────────────────
  const activeRows = data
    ? view === 'date'     ? data.byDate
    : view === 'center'   ? data.byCenter
    : view === 'agent'    ? data.byAgent
    : view === 'creditor' ? data.byCreditor
    : data.records
    : [];

  // ── Export Excel ─────────────────────────────────────────────
  const handleExport = () => {
    if (!data) return;
    const rows = [];

    if (view === 'detail') {
      rows.push(['#', 'Date', 'Shift', 'Bill No',
        saleMode === 'CREDIT' ? 'Customer' : 'Center', 'Agent',
        'Litres', 'Rate', 'Amount (₹)', 'Payment']);
      (data.records || []).forEach((r, i) => {
        const row = [
          i + 1,
          fmtDate(r.date),
          r.session,
          r.billNo,
          saleMode === 'CREDIT' ? r.creditorName || '' : r.centerName || '',
        ];
        if (saleMode !== 'CREDIT') row.push(r.agentName || '');
        else row.push('');
        row.push(r.litre, r.rate, r.amount, r.paymentType || '');
        rows.push(row);
      });
    } else {
      const nameLabel =
        view === 'date'     ? 'Date'
        : view === 'center'   ? 'Center'
        : view === 'agent'    ? 'Agent'
        : 'Customer';
      const nameKey =
        view === 'date'     ? 'date'
        : view === 'center'   ? 'centerName'
        : view === 'agent'    ? 'agentName'
        : 'creditorName';
      rows.push(['#', nameLabel, 'AM Litres', 'AM Amount', 'PM Litres', 'PM Amount', 'Total Litres', 'Total Amount', 'Bills']);
      activeRows.forEach((r, i) => {
        rows.push([
          i + 1,
          view === 'date' ? fmtDate(r.date) : (r[nameKey] || '—'),
          r.amLitre, r.amAmount, r.pmLitre, r.pmAmount, r.totalLitre, r.totalAmount, r.count,
        ]);
      });
      rows.push(['', 'TOTAL', s.amLitre, s.amAmount, s.pmLitre, s.pmAmount, s.totalLitre, s.totalAmount, s.count]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modeConf.label);
    XLSX.writeFile(wb, `MilkSalesReport_${saleMode}_${toISO(fromDate)}_${toISO(toDate)}.xlsx`);
  };

  // ── Print ────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!data) return;
    printVyaparReport(printRef, {
      title: `Milk Sales Report — ${modeConf.label}`,
      companyName: societyName,
      period: periodLabel,
      orientation: 'landscape',
      extraCss: `
        @page { size: A4 landscape; margin: 6mm; }
        .vpr-header { padding-bottom: 4px !important; margin-bottom: 5px !important; }
        table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
        th, td { border: 1px solid #ccc !important; padding: 2px 5px !important; font-size: 10px !important; line-height: 1.2 !important; }
        .ms-rate-screen { display: none !important; }
        .ms-rate-print { display: inline !important; }
      `,
    });
  };

  // ── Render table body ─────────────────────────────────────────
  const renderBody = () => {
    if (!data) return null;

    if (view === 'detail') {
      return (
        <tbody>
          {(data.records || []).map((r, i) => (
            <tr key={r._id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
              <td style={{ ...TD, textAlign: 'center' }}>{i + 1}</td>
              <td style={TD}>{fmtDateShort(r.date)}</td>
              <td style={{ ...TD, textAlign: 'center' }}>
                <Badge size="xs" color={r.session === 'AM' ? 'blue' : 'orange'} variant="light">{r.session}</Badge>
              </td>
              <td style={TD}>{r.billNo}</td>
              {saleMode === 'CREDIT'
                ? <td style={TD}>{r.creditorName || '—'}</td>
                : <>
                    <td style={TD}>{r.centerName || 'Main'}</td>
                    <td style={TD}>{r.agentName  || '—'}</td>
                  </>}
              <td style={TDR}>{f3(r.litre)}</td>
              <td style={TDR}>
                <span className="ms-rate-screen">{f2(r.rate)}</span>
                <span className="ms-rate-print" style={{ display: 'none' }}>{Math.round(r.rate || 0)}</span>
              </td>
              <td style={{ ...TDR, fontWeight: 700 }}>{f2(r.amount)}</td>
              <td style={{ ...TD, textAlign: 'center' }}>
                <Badge size="xs" color={r.paymentType === 'Bank' ? 'teal' : 'gray'} variant="light">{r.paymentType || 'Cash'}</Badge>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={saleMode === 'CREDIT' ? 5 : 6} style={{ ...TOT, textAlign: 'right', paddingRight: 12 }}>TOTAL</td>
            <td style={TOTR}>{f3(s.totalLitre)}</td>
            <td style={TOT}></td>
            <td style={TOTR}>{f2(s.totalAmount)}</td>
            <td style={TOT}></td>
          </tr>
        </tbody>
      );
    }

    const nameKey =
      view === 'date'     ? 'date'
      : view === 'center'   ? 'centerName'
      : view === 'agent'    ? 'agentName'
      : 'creditorName';

    const displayName = (row) => view === 'date' ? fmtDate(row.date) : (row[nameKey] || '—');

    return (
      <tbody>
        {activeRows.map((row, i) => (
          <GroupRow key={i} row={{ ...row, [nameKey]: displayName(row) }} idx={i} nameKey={nameKey} />
        ))}
        <TotalRow s={s} />
      </tbody>
    );
  };

  const viewNameLabel =
    view === 'date'     ? 'Date'
    : view === 'center'   ? 'Center'
    : view === 'agent'    ? 'Agent'
    : view === 'creditor' ? 'Customer'
    : 'Bill';

  return (
    <Box p="md" ref={printRef}>
      {/* ── Header ────────────────────────────────────────────── */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: `2px solid ${modeConf.color}` }} data-no-print>
        <Box style={{ background: modeConf.color, padding: '12px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <IconMilk size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Milk Sales Report</Title>
                <Text size="xs" c="rgba(255,255,255,0.8)">Local · Credit · Sample — Shift, Center & Agent wise analysis</Text>
              </Box>
            </Group>
            {data && (
              <Badge size="lg" variant="white" color="dark">
                {s.count} Bills · {f3(s.totalLitre)} Ltr · ₹{f2(s.totalAmount)}
              </Badge>
            )}
          </Group>
        </Box>
      </Paper>

      {/* ── Report type tabs ───────────────────────────────────── */}
      <Paper radius="md" mb="md" withBorder data-no-print>
        <Tabs value={saleMode} onChange={setSaleMode} variant="pills" px="md" pt="sm" pb={0}>
          <Tabs.List>
            {SALE_MODES.map(m => (
              <Tabs.Tab
                key={m.value}
                value={m.value}
                style={saleMode === m.value ? { background: m.color, color: '#fff' } : {}}
              >
                {m.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        {/* Filters */}
        <Box px="md" py="sm">
          <Group gap="sm" wrap="wrap" align="flex-end">
            <DatePickerInput
              type="range"
              label="Date Range"
              value={[fromDate, toDate]}
              onChange={([f, t]) => { if (f) setFromDate(f); if (t) setToDate(t); }}
              leftSection={<IconCalendar size={14} />}
              style={{ flex: '2 1 220px' }}
              size="sm"
            />
            <Select
              label="Shift"
              data={SHIFT_OPTS}
              value={shift}
              onChange={v => setShift(v || '')}
              style={{ flex: '1 1 120px' }}
              size="sm"
            />
            {saleMode !== 'CREDIT' && (
              <Select
                label="Collection Center"
                data={[{ value: '', label: 'All Centers' }, ...centers]}
                value={centerId}
                onChange={v => setCenterId(v || '')}
                style={{ flex: '1 1 160px' }}
                size="sm"
                clearable
                searchable
              />
            )}
            {saleMode !== 'CREDIT' && (
              <Select
                label="Agent"
                data={[{ value: '', label: 'All Agents' }, ...agents]}
                value={agentId}
                onChange={v => setAgentId(v || '')}
                style={{ flex: '1 1 150px' }}
                size="sm"
                clearable
                searchable
              />
            )}
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={handleLoad}
              loading={loading}
              size="sm"
              style={{ background: modeConf.color, alignSelf: 'flex-end' }}
            >
              Generate
            </Button>
            {data && (
              <>
                <Tooltip label="Export Excel">
                  <ActionIcon variant="light" color="green" size="lg" onClick={handleExport} style={{ alignSelf: 'flex-end' }}>
                    <IconFileExport size={18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Print">
                  <ActionIcon variant="light" color="dark" size="lg" onClick={handlePrint} style={{ alignSelf: 'flex-end' }}>
                    <IconPrinter size={18} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
          </Group>
        </Box>
      </Paper>

      {/* ── Summary cards ─────────────────────────────────────── */}
      {s && (
        <SimpleGrid cols={{ base: 2, sm: 4, md: 6 }} mb="md">
          <StatCard label="Total Bills"   value={s.count}              icon={IconListDetails}    color={modeConf.color} />
          <StatCard label="Total Litres"  value={f3(s.totalLitre)}     icon={IconDroplet}         color="#1a5fa8" />
          <StatCard label="Total Amount"  value={`₹${f2(s.totalAmount)}`} icon={IconCurrencyRupee} color="#166534" />
          <StatCard label="AM Litres"     value={f3(s.amLitre)}        sub={`₹${f2(s.amAmount)}`}  icon={IconMilk}      color="#7c3aed" />
          <StatCard label="PM Litres"     value={f3(s.pmLitre)}        sub={`₹${f2(s.pmAmount)}`}  icon={IconMilk}      color="#b45309" />
          <StatCard label="Avg Rate"      value={`₹${s.totalLitre > 0 ? f2(s.totalAmount / s.totalLitre) : '0.00'}/L`} icon={IconCurrencyRupee} color="#0f766e" />
        </SimpleGrid>
      )}

      {/* ── Table area ────────────────────────────────────────── */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        {/* Table toolbar */}
        <Box style={{ background: modeConf.color, padding: '10px 16px' }} data-no-print>
          <Group justify="space-between">
            <Group gap="sm">
              <IconMilk size={16} color="white" />
              <Text fw={700} size="sm" c="white">{modeConf.label} — {viewNameLabel} Wise</Text>
              {data && <Text size="xs" c="rgba(255,255,255,0.75)">{periodLabel}</Text>}
            </Group>
            {data && (
              <SegmentedControl
                value={view}
                onChange={setView}
                data={viewOpts}
                size="xs"
                style={{ background: 'rgba(255,255,255,0.15)' }}
                styles={{ label: { color: '#fff', fontSize: 10 }, indicator: { background: 'rgba(255,255,255,0.3)' } }}
              />
            )}
          </Group>
        </Box>

        {loading ? (
          <Center py="xl"><Loader size="md" color="blue" /></Center>
        ) : errMsg ? (
          <Center py="xl"><Text c="red" size="sm">{errMsg}</Text></Center>
        ) : !data ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconMilk size={48} color="#bdbdbd" />
              <Text c="dimmed" size="sm">Select filters and click Generate to view the report</Text>
            </Stack>
          </Center>
        ) : activeRows.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconMilk size={48} color="#bdbdbd" />
              <Text c="dimmed" size="sm">No records found for the selected period and filters</Text>
            </Stack>
          </Center>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                {view === 'detail'
                  ? detailHeaders(saleMode)
                  : view === 'date'
                    ? dateHeaders
                    : groupHeaders(
                        view === 'center' ? 'Center'
                        : view === 'agent' ? 'Agent'
                        : 'Customer'
                      )}
              </thead>
              {renderBody()}
            </table>
          </Box>
        )}

        {/* Legend */}
        {data && (
          <Box px="md" py="xs" style={{ borderTop: '1px solid #eee', background: '#f8f8ff' }} data-no-print>
            <Group gap="xl" wrap="wrap">
              <Text size="xs" c="dimmed">Period: {periodLabel}</Text>
              <Text size="xs" c="dimmed">Mode: {modeConf.label}</Text>
              {shift && <Text size="xs" c="dimmed">Shift: {shift}</Text>}
              {centerId && <Text size="xs" c="dimmed">Center: {centers.find(c => c.value === centerId)?.label || centerId}</Text>}
              {agentId  && <Text size="xs" c="dimmed">Agent: {agents.find(a => a.value === agentId)?.label || agentId}</Text>}
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
