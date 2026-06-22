import { useState, useRef } from 'react';
import {
  Box, Group, Text, Button, Badge, Paper, Stack, Title,
  SimpleGrid, Select, SegmentedControl, Loader, Center,
  ThemeIcon, ActionIcon, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconRefresh, IconPrinter, IconFileExport, IconMilk,
  IconCurrencyRupee, IconDroplet, IconCalendar,
  IconListDetails, IconChartBar,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { unionSalesSlipAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { localDateStr } from '../../utils/dateUtils';
import { printVyaparReport } from '../../utils/printReport';

// ── Formatters ──────────────────────────────────────────────────
const f2  = v => Number(v || 0).toFixed(2);
const f3  = v => Number(v || 0).toFixed(3);
const fz2 = v => { const n = Number(v || 0); return n === 0 ? '' : n.toFixed(2); };
const fz3 = v => { const n = Number(v || 0); return n === 0 ? '' : n.toFixed(3); };
const fmtDate  = d => d ? dayjs(d).format('DD/MM/YYYY') : '';
const fmtMonth = ym => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return dayjs(`${y}-${m}-01`).format('MMM YYYY');
};
const toISO = d => d instanceof Date ? localDateStr(d) : d;

const BRAND  = '#1a5276';
const BRAND2 = '#2e86c1';

const SHIFT_OPTS = [
  { value: '', label: 'All Shifts' },
  { value: 'AM', label: 'AM Only' },
  { value: 'PM', label: 'PM Only' },
];

const VIEW_OPTS = [
  { value: 'date',   label: 'Date Wise'  },
  { value: 'month',  label: 'Month Wise' },
  { value: 'year',   label: 'Year Wise'  },
  { value: 'detail', label: 'Detail'     },
];

// ── Shared table styles ──────────────────────────────────────────
const TH   = { background: BRAND, color: '#fff', padding: '6px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center', border: `1px solid ${BRAND}` };
const THL  = { ...TH, textAlign: 'left' };
const TD   = { border: '1px solid #ddd', padding: '5px 8px', fontSize: 11 };
const TDR  = { ...TD, textAlign: 'right', fontFamily: 'monospace' };
const TDC  = { ...TD, textAlign: 'center' };
const TOT  = { ...TD, background: BRAND, color: '#fff', fontWeight: 800 };
const TOTR = { ...TDR, background: BRAND, color: '#fff', fontWeight: 800 };
const TODC = { ...TDC, background: BRAND, color: '#fff', fontWeight: 800 };

// ── Stat card ────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, color = BRAND }) => (
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

// ── Summary group row ─────────────────────────────────────────────
const GroupRow = ({ label, row, idx }) => (
  <tr style={{ background: idx % 2 === 0 ? '#fff' : '#f0f4f8' }}>
    <td style={TDC}>{idx + 1}</td>
    <td style={TD}>{label}</td>
    <td style={TDR}>{fz3(row.amQty)}</td>
    <td style={TDR}>{fz2(row.amAmount)}</td>
    <td style={TDR}>{fz3(row.pmQty)}</td>
    <td style={TDR}>{fz2(row.pmAmount)}</td>
    <td style={{ ...TDR, fontWeight: 700 }}>{f3(row.totalQty)}</td>
    <td style={{ ...TDR, fontWeight: 700 }}>{f2(row.totalAmount)}</td>
    <td style={TDC}>{row.avgFat > 0 ? f2(row.avgFat) : ''}</td>
    <td style={TDC}>{row.avgSnf > 0 ? f2(row.avgSnf) : ''}</td>
    <td style={TDR}>{fz2(row.unionSpoilage)}</td>
    <td style={TDR}>{fz2(row.transportSpoilage)}</td>
    <td style={TDC}>{row.count}</td>
  </tr>
);

const TotalRow = ({ s }) => (
  <tr>
    <td colSpan={2} style={{ ...TOT, textAlign: 'right', paddingRight: 12 }}>TOTAL</td>
    <td style={TOTR}>{f3(s.amQty)}</td>
    <td style={TOTR}>{f2(s.amAmount)}</td>
    <td style={TOTR}>{f3(s.pmQty)}</td>
    <td style={TOTR}>{f2(s.pmAmount)}</td>
    <td style={TOTR}>{f3(s.totalQty)}</td>
    <td style={TOTR}>{f2(s.totalAmount)}</td>
    <td style={TODC}>{s.avgFat > 0 ? f2(s.avgFat) : ''}</td>
    <td style={TODC}>{s.avgSnf > 0 ? f2(s.avgSnf) : ''}</td>
    <td style={TOTR}>{f2(s.unionSpoilage)}</td>
    <td style={TOTR}>{f2(s.transportSpoilage)}</td>
    <td style={TODC}>{s.count}</td>
  </tr>
);

const GroupHeader = ({ firstColLabel }) => (
  <thead>
    <tr>
      <th style={{ ...TH, minWidth: 36 }}>#</th>
      <th style={{ ...THL, minWidth: 110 }}>{firstColLabel}</th>
      <th style={{ ...TH, minWidth: 70 }}>AM Ltr</th>
      <th style={{ ...TH, minWidth: 80 }}>AM Amt (₹)</th>
      <th style={{ ...TH, minWidth: 70 }}>PM Ltr</th>
      <th style={{ ...TH, minWidth: 80 }}>PM Amt (₹)</th>
      <th style={{ ...TH, minWidth: 75 }}>Total Ltr</th>
      <th style={{ ...TH, minWidth: 90 }}>Total Amt (₹)</th>
      <th style={{ ...TH, minWidth: 55 }}>Avg FAT</th>
      <th style={{ ...TH, minWidth: 55 }}>Avg SNF</th>
      <th style={{ ...TH, minWidth: 75 }}>Union Sp.</th>
      <th style={{ ...TH, minWidth: 80 }}>Trans Sp.</th>
      <th style={{ ...TH, minWidth: 46 }}>Slips</th>
    </tr>
  </thead>
);

const DetailHeader = () => (
  <thead>
    <tr>
      <th style={{ ...TH, minWidth: 36 }}>#</th>
      <th style={{ ...TH, minWidth: 90 }}>Date</th>
      <th style={{ ...TH, minWidth: 50 }}>Shift</th>
      <th style={{ ...TH, minWidth: 115 }}>Slip No</th>
      <th style={{ ...TH, minWidth: 75 }}>Litres</th>
      <th style={{ ...TH, minWidth: 55 }}>FAT %</th>
      <th style={{ ...TH, minWidth: 55 }}>SNF %</th>
      <th style={{ ...TH, minWidth: 65 }}>Rate</th>
      <th style={{ ...TH, minWidth: 90 }}>Amount (₹)</th>
      <th style={{ ...TH, minWidth: 55 }}>Spoilage</th>
      <th style={{ ...TH, minWidth: 75 }}>Union Sp.</th>
      <th style={{ ...TH, minWidth: 80 }}>Trans Sp.</th>
    </tr>
  </thead>
);

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export default function UnionSalesReport() {
  const { company } = useCompany();
  const printRef    = useRef(null);

  const today        = localDateStr(new Date());
  const firstOfMonth = today.slice(0, 8) + '01';

  const [fromDate, setFromDate] = useState(new Date(firstOfMonth));
  const [toDate,   setToDate]   = useState(new Date(today));
  const [shift,    setShift]    = useState('');
  const [view,     setView]     = useState('date');
  const [loading,  setLoading]  = useState(false);
  const [data,     setData]     = useState(null);
  const [errMsg,   setErrMsg]   = useState('');

  const handleLoad = async () => {
    setLoading(true); setErrMsg(''); setData(null);
    try {
      const params = { fromDate: toISO(fromDate), toDate: toISO(toDate) };
      if (shift) params.time = shift;
      const res = await unionSalesSlipAPI.getReport(params);
      if (res?.success) setData(res.data);
      else setErrMsg(res?.message || 'Failed to load');
    } catch (e) {
      setErrMsg(e.message || 'Error loading report');
    } finally {
      setLoading(false);
    }
  };

  const s            = data?.summary;
  const societyName  = company?.name || 'Dairy Society';
  const periodLabel  = `${fmtDate(toISO(fromDate))} to ${fmtDate(toISO(toDate))}`;
  const shiftLabel   = shift ? ` · ${shift} Shift` : ' · All Shifts';

  // ── Active rows ───────────────────────────────────────────────
  const activeRows = data
    ? view === 'month'  ? data.byMonth
    : view === 'year'   ? data.byYear
    : view === 'detail' ? data.records
    : data.byDate
    : [];

  // ── Export Excel ──────────────────────────────────────────────
  const handleExport = () => {
    if (!data) return;
    const rows = [];

    if (view === 'detail') {
      rows.push(['#', 'Date', 'Shift', 'Slip No', 'Litres', 'FAT%', 'SNF%', 'Rate', 'Amount (₹)', 'Spoilage', 'Union Spoilage', 'Transport Spoilage']);
      (data.records || []).forEach((r, i) => rows.push([
        i + 1, fmtDate(r.date), r.time, r.slipNo,
        r.qty, r.fat, r.snf, r.rate, r.amount,
        r.spoilage ? 'Yes' : 'No', r.unionSpoilage || 0, r.transportationSpoilage || 0,
      ]));
      rows.push(['', '', '', 'TOTAL', f3(s.totalQty), '', '', '', f2(s.totalAmount), '', f2(s.unionSpoilage), f2(s.transportSpoilage)]);
    } else {
      const labelCol = view === 'date' ? 'Date' : view === 'month' ? 'Month' : 'Year';
      rows.push(['#', labelCol, 'AM Litres', 'AM Amount', 'PM Litres', 'PM Amount', 'Total Litres', 'Total Amount', 'Avg FAT', 'Avg SNF', 'Union Spoilage', 'Trans Spoilage', 'Slips']);
      activeRows.forEach((r, i) => {
        const label = view === 'date' ? fmtDate(r.date) : view === 'month' ? fmtMonth(r.month) : r.year;
        rows.push([i + 1, label, r.amQty, r.amAmount, r.pmQty, r.pmAmount, r.totalQty, r.totalAmount, r.avgFat || '', r.avgSnf || '', r.unionSpoilage, r.transportSpoilage, r.count]);
      });
      rows.push(['', 'TOTAL', s.amQty, s.amAmount, s.pmQty, s.pmAmount, s.totalQty, s.totalAmount, s.avgFat || '', s.avgSnf || '', s.unionSpoilage, s.transportSpoilage, s.count]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Union Sales');
    XLSX.writeFile(wb, `UnionSalesReport_${toISO(fromDate)}_${toISO(toDate)}.xlsx`);
  };

  // ── Print ─────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!data) return;
    printVyaparReport(printRef, {
      title: `Union Sales Report — ${firstColLabel} Wise`,
      companyName: societyName,
      period: periodLabel + shiftLabel,
      orientation: 'landscape',
      extraCss: `
        @page { size: A4 landscape; margin: 8mm; }
        table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
        th, td { border: 1px solid #ccc !important; padding: 4px 7px !important; font-size: 10px !important; }
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
            <tr key={r._id} style={{ background: i % 2 === 0 ? '#fff' : '#f0f4f8' }}>
              <td style={TDC}>{i + 1}</td>
              <td style={TDC}>{fmtDate(r.date)}</td>
              <td style={TDC}>
                <Badge size="xs" color={r.time === 'AM' ? 'blue' : 'orange'} variant="light">{r.time}</Badge>
              </td>
              <td style={TD}>{r.slipNo}</td>
              <td style={TDR}>{f3(r.qty)}</td>
              <td style={TDC}>{f2(r.fat)}</td>
              <td style={TDC}>{f2(r.snf)}</td>
              <td style={TDR}>{f2(r.rate)}</td>
              <td style={{ ...TDR, fontWeight: 700 }}>{f2(r.amount)}</td>
              <td style={TDC}>
                {r.spoilage
                  ? <Badge size="xs" color="red" variant="light">Yes</Badge>
                  : <Badge size="xs" color="gray" variant="light">No</Badge>}
              </td>
              <td style={TDR}>{fz2(r.unionSpoilage)}</td>
              <td style={TDR}>{fz2(r.transportationSpoilage)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ ...TOT, textAlign: 'right', paddingRight: 12 }}>TOTAL</td>
            <td style={TOTR}>{f3(s.totalQty)}</td>
            <td style={TODC}>—</td>
            <td style={TODC}>—</td>
            <td style={TODC}>—</td>
            <td style={TOTR}>{f2(s.totalAmount)}</td>
            <td style={TODC}>—</td>
            <td style={TOTR}>{f2(s.unionSpoilage)}</td>
            <td style={TOTR}>{f2(s.transportSpoilage)}</td>
          </tr>
        </tbody>
      );
    }

    const getLabelAndRow = (r) => {
      if (view === 'month') return { label: fmtMonth(r.month), row: r };
      if (view === 'year')  return { label: r.year, row: r };
      return { label: fmtDate(r.date), row: r };
    };

    return (
      <tbody>
        {activeRows.map((r, i) => {
          const { label } = getLabelAndRow(r);
          return <GroupRow key={i} label={label} row={r} idx={i} />;
        })}
        <TotalRow s={s} />
      </tbody>
    );
  };

  const firstColLabel =
    view === 'month' ? 'Month'
    : view === 'year'  ? 'Year'
    : 'Date';

  return (
    <Box p="md" ref={printRef}>
      {/* ── Header ────────────────────────────────────────────── */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: `2px solid ${BRAND}` }} data-no-print>
        <Box style={{ background: `linear-gradient(90deg, ${BRAND} 0%, ${BRAND2} 100%)`, padding: '12px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <IconMilk size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Union Sales Report</Title>
                <Text size="xs" c="rgba(255,255,255,0.8)">Date / Month / Year wise — with FAT, SNF & Spoilage breakdown</Text>
              </Box>
            </Group>
            {data && (
              <Badge size="lg" variant="white" color="blue">
                {s.count} Slips · {f3(s.totalQty)} Ltr · ₹{f2(s.totalAmount)}
              </Badge>
            )}
          </Group>
        </Box>
      </Paper>

      {/* ── Filters ───────────────────────────────────────────── */}
      <Paper radius="md" mb="md" withBorder p="md" data-no-print>
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
            style={{ flex: '1 1 140px' }}
            size="sm"
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={handleLoad}
            loading={loading}
            size="sm"
            style={{ background: BRAND, alignSelf: 'flex-end' }}
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
      </Paper>

      {/* ── Summary cards ─────────────────────────────────────── */}
      {s && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="md">
          <StatCard label="Total Slips"   value={s.count}                  icon={IconListDetails}    color={BRAND} />
          <StatCard label="Total Litres"  value={f3(s.totalQty)}           icon={IconDroplet}        color="#1a5fa8" />
          <StatCard label="Total Amount"  value={`₹${f2(s.totalAmount)}`}  icon={IconCurrencyRupee}  color="#166534" />
          <StatCard label="AM Litres"     value={f3(s.amQty)}              sub={`₹${f2(s.amAmount)}`}  icon={IconMilk} color="#7c3aed" />
          <StatCard label="PM Litres"     value={f3(s.pmQty)}              sub={`₹${f2(s.pmAmount)}`}  icon={IconMilk} color="#b45309" />
          <StatCard label="Avg FAT / SNF" value={`${f2(s.avgFat)}% / ${f2(s.avgSnf)}%`} icon={IconChartBar} color="#0f766e" />
        </SimpleGrid>
      )}

      {/* ── Table area ────────────────────────────────────────── */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        {/* Toolbar */}
        <Box style={{ background: `linear-gradient(90deg, ${BRAND} 0%, ${BRAND2} 100%)`, padding: '10px 16px' }} data-no-print>
          <Group justify="space-between">
            <Group gap="sm">
              <IconMilk size={16} color="white" />
              <Text fw={700} size="sm" c="white">Union Sales — {firstColLabel} Wise{shiftLabel}</Text>
              {data && <Text size="xs" c="rgba(255,255,255,0.75)">{periodLabel}</Text>}
            </Group>
            {data && (
              <SegmentedControl
                value={view}
                onChange={setView}
                data={VIEW_OPTS}
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
              {view === 'detail' ? <DetailHeader /> : <GroupHeader firstColLabel={firstColLabel} />}
              {renderBody()}
            </table>
          </Box>
        )}

        {/* Legend */}
        {data && (
          <Box px="md" py="xs" style={{ borderTop: '1px solid #eee', background: '#f8f8ff' }} data-no-print>
            <Group gap="xl" wrap="wrap">
              <Text size="xs" c="dimmed">Period: {periodLabel}</Text>
              {shift ? <Text size="xs" c="dimmed">Shift: {shift}</Text> : <Text size="xs" c="dimmed">Shift: All</Text>}
              <Text size="xs" c="dimmed">Sp. = Spoilage</Text>
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
