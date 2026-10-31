import { useState } from 'react';
import {
  Box, Paper, Group, Text, Title, Button, ScrollArea, Stack, Loader, Center, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconMilk, IconCalendar, IconRefresh, IconPrinter, IconFileExport, IconInbox
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { openA4Print, escapeHtml } from '../../utils/printA4';

// Only Adjustment Entries saved with "Milk Bill" ticked feed this report.
// Two sections side by side, sharing the Month - Year / Transaction Date rows
// so every date lines up across both (Union Bill Tabular layout):
//   LEFT  — PAYMENT: the Cr legs, one column per Head of Account (A→Z) + PAYMENT TOTAL
//   RIGHT — RECEIPT: the Dr legs, one column per Head of Account (A→Z) + RECEIPT TOTAL
// A cyan subtotal row closes each month. Screen and print use the same HTML.

// Amounts: 2 decimals, no thousand separators, blank when zero.
const fmtD = (n) => { const v = parseFloat(n || 0); return Math.abs(v) < 0.005 ? '' : v.toFixed(2); };
const fmtDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '';

const financialYearRange = () => {
  const now = dayjs();
  const fy = now.month() >= 3 ? now.year() : now.year() - 1;
  return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
};

// Left → right
const SECTIONS = [
  { key: 'payment', title: 'PAYMENT', totalLabel: 'PAYMENT TOTAL' },
  { key: 'receipt', title: 'RECEIPT', totalLabel: 'RECEIPT TOTAL' }
];

const emptySection = { heads: [], rows: [] };

// Every date of either section → month blocks; each block carries per-section
// amounts and totals so both sides read from the same row.
const buildBlocks = (report) => {
  const byDate = new Map();
  SECTIONS.forEach(sec => {
    (report[sec.key]?.rows || []).forEach(r => {
      if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date });
      byDate.get(r.date)[sec.key] = r;
    });
  });
  const blocks = [];
  [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(row => {
    const mk = String(row.date).slice(0, 7);
    let b = blocks[blocks.length - 1];
    if (!b || b.key !== mk) {
      const d = dayjs(row.date);
      b = { key: mk, label: d.format('MMM - YYYY'), subLabel: d.format('MMM YYYY'), rows: [], totals: {} };
      SECTIONS.forEach(sec => { b.totals[sec.key] = { amounts: {}, total: 0 }; });
      blocks.push(b);
    }
    b.rows.push(row);
    SECTIONS.forEach(sec => {
      const r = row[sec.key];
      if (!r) return;
      const t = b.totals[sec.key];
      Object.entries(r.amounts || {}).forEach(([k, v]) => { t.amounts[k] = (t.amounts[k] || 0) + v; });
      t.total += r.total || 0;
    });
  });
  return blocks;
};

// Compact fixed column widths (px) — the grid is only as wide as its columns.
const COL = { month: 64, date: 82, amt: 74, total: 84, gap: 10 };

// Shared by screen (scoped under .mbt) and print, so both look the same.
const gridCss = (fontSize, headSizes) => `
  .mbt table { width: auto; border-collapse: collapse; table-layout: fixed;
    font-family: 'Times New Roman', Times, serif; font-size: ${fontSize}; color: #000; background: #fff; }
  .mbt th, .mbt td { border: 1px solid #222; padding: 2px 4px; }
  .mbt th { font-weight: 400; text-align: right; vertical-align: top; text-transform: uppercase;
    line-height: 1.15; overflow-wrap: anywhere; word-break: break-word; }
  .mbt th.l { text-align: left; text-transform: none; }
  .mbt th.blank { border: none; }
  .mbt th.sup { text-align: center; font-weight: 700; }
  .mbt th.sup.pay { background: #fde8e8; }
  .mbt th.sup.rec { background: #e3f6e8; }
  .mbt th.tot { font-weight: 700; }
  .mbt th.gap, .mbt td.gap { border: none; background: #fff !important; padding: 0; }
  .mbt tr.spacer td { border: none; height: 8px; padding: 0; }
  .mbt td.amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .mbt td.date { padding-left: 6px; white-space: nowrap; }
  .mbt td.month { background: #fff; vertical-align: top; white-space: nowrap; }
  .mbt td.b { font-weight: 700; }
  .mbt td.none { text-align: center; color: #777; font-style: italic; }
  .mbt tbody.mblock { break-inside: avoid; page-break-inside: avoid; }
  .mbt tr.sub td:not(.month):not(.gap) { background: #80E8F8; font-weight: 700; }
  .mbt thead { display: table-header-group; }
  .mbt-head { text-align: center; font-family: 'Times New Roman', Times, serif;
    color: #000; font-weight: 400; margin-bottom: 10px; }
  .mbt-head > div + div { margin-top: 2px; }
  .mbt-head__org { font-size: ${headSizes.org}; text-transform: uppercase; }
  .mbt-head__title { font-size: ${headSizes.title}; }
  .mbt-head__fy { font-size: ${headSizes.fy}; }
`;

const headerHtml = (orgName, range) => `
  <div class="mbt-head">
    <div class="mbt-head__org">${escapeHtml(orgName)}</div>
    <div class="mbt-head__title">Union Bill Tabular Report</div>
    <div class="mbt-head__fy">For the financial year ${fmtDate(range[0])}-${fmtDate(range[1])}</div>
  </div>`;

// Columns of one section: its heads + total; a section with no entries keeps one
// "no entries" column so the side is still shown
const sectionCols = (data) => (data.heads.length ? data.heads.length + 1 : 1);

const reportHtml = (report) => {
  const data = Object.fromEntries(SECTIONS.map(sec => [sec.key, report[sec.key] || emptySection]));
  const blocks = buildBlocks(report);
  const widthOf = (d) => (d.heads.length ? d.heads.length * COL.amt + COL.total : COL.total);
  const tableW = COL.month + COL.date + SECTIONS.reduce((s, sec) => s + widthOf(data[sec.key]), 0) + COL.gap;

  const cols = `<colgroup><col style="width:${COL.month}px"><col style="width:${COL.date}px">${
    SECTIONS.map((sec, i) => {
      const d = data[sec.key];
      const c = d.heads.length
        ? d.heads.map(() => `<col style="width:${COL.amt}px">`).join('') + `<col style="width:${COL.total}px">`
        : `<col style="width:${COL.total}px">`;
      return (i ? `<col style="width:${COL.gap}px">` : '') + c;
    }).join('')}</colgroup>`;

  const cells = (sec, part, bold) => {
    const d = data[sec.key];
    if (!d.heads.length) return '<td class="amt"></td>';
    return d.heads.map(h => `<td class="amt${bold ? ' b' : ''}">${fmtD(part?.amounts?.[h.key])}</td>`).join('')
      + `<td class="amt b">${fmtD(part?.total)}</td>`;
  };
  const both = (fn) => SECTIONS.map((sec, i) => (i ? '<td class="gap"></td>' : '') + fn(sec)).join('');

  const head = `
    <tr>
      <th class="blank"></th><th class="blank"></th>
      ${SECTIONS.map((sec, i) => `${i ? '<th class="gap"></th>' : ''}<th class="sup ${sec.key === 'payment' ? 'pay' : 'rec'}" colspan="${sectionCols(data[sec.key])}">${sec.title}</th>`).join('')}
    </tr>
    <tr>
      <th class="l">Month -<br>Year</th>
      <th class="l">Transaction<br>Date</th>
      ${SECTIONS.map((sec, i) => {
        const d = data[sec.key];
        const ths = d.heads.length
          ? d.heads.map(h => `<th>${escapeHtml(h.name)}</th>`).join('') + `<th class="tot">${sec.totalLabel}</th>`
          : `<th class="tot">${sec.totalLabel}</th>`;
        return (i ? '<th class="gap"></th>' : '') + ths;
      }).join('')}
    </tr>
    <tr class="spacer"><td colspan="${2 + SECTIONS.reduce((s, sec) => s + sectionCols(data[sec.key]), 0) + 1}"></td></tr>`;

  const body = blocks.map(b => `<tbody class="mblock">
      ${b.rows.map((r, i) => `<tr>
        ${i === 0 ? `<td class="month" rowspan="${b.rows.length + 1}">${b.label}</td>` : ''}
        <td class="date">${dayjs(r.date).format('DD-MMM-YYYY')}</td>
        ${both(sec => cells(sec, r[sec.key]))}
      </tr>`).join('')}
      <tr class="sub"><td class="b">${b.subLabel}</td>${both(sec => cells(sec, b.totals[sec.key], true))}</tr>
    </tbody>`).join('');

  return { html: `<table style="width:${tableW}px">${cols}<thead>${head}</thead>${body}</table>`, width: tableW };
};

// A4 landscape content box in CSS px (297×210mm less the 10mm × 8mm @page margins).
const PAGE_PX = { w: 1060, h: 712 };

// Shrink the report to the page width; past MIN_ZOOM it flows onto further pages
// with the header rows repeating and month blocks kept whole.
const fitScript = `
<script>
  (function () {
    var MIN_ZOOM = 0.55;
    document.querySelectorAll('.mb-fit').forEach(function (el) {
      var z = Math.min(1, ${PAGE_PX.w} / el.scrollWidth);
      if (z < 1) el.style.zoom = Math.max(z, MIN_ZOOM);
    });
  })();
</script>`;

const PRINT_CSS = `
  ${gridCss('8pt', { org: '12pt', title: '11pt', fy: '8pt' })}
  body { font-family: 'Times New Roman', Times, serif; }
  .mb-fit { margin: 0 auto; }
`;

const MilkBillAbstract = () => {
  const { selectedCompany } = useCompany();
  const orgName = selectedCompany?.societyName || selectedCompany?.companyName || 'Dairy Co-operative Society';
  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange]   = useState(financialYearRange);
  const [loadedRange, setLoadedRange] = useState(null);

  const fetchReport = async () => {
    const [start, end] = dateRange;
    if (!start || !end) {
      notifications.show({ title: 'Error', message: 'Select From and To dates', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await reportAPI.milkBillAbstract({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD')
      });
      setReportData(res?.data || res);
      setLoadedRange([start, end]);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const hasData = SECTIONS.some(sec => reportData?.[sec.key]?.rows?.length);
  const report = hasData ? reportHtml(reportData) : null;

  const handlePrint = () => {
    if (!report) return;
    openA4Print({
      title: 'Union Bill Tabular Report',
      orientation: 'landscape',
      css: PRINT_CSS,
      bodyHtml: `<div class="mb-fit mbt" style="width:${Math.max(report.width, 600)}px">
          ${headerHtml(orgName, loadedRange)}
          ${report.html}
        </div>${fitScript}`
    });
  };

  // One sheet, same layout: Payment columns | blank | Receipt columns
  const handleExport = () => {
    if (!hasData) return;
    const num = (v) => (Math.abs(v || 0) < 0.005 ? '' : Math.round(v * 100) / 100);
    const data = Object.fromEntries(SECTIONS.map(sec => [sec.key, reportData[sec.key] || emptySection]));
    const vals = (sec, part) => {
      const d = data[sec.key];
      return d.heads.length ? [...d.heads.map(h => num(part?.amounts?.[h.key])), num(part?.total)] : [num(part?.total)];
    };
    const both = (fn) => SECTIONS.flatMap((sec, i) => [...(i ? [''] : []), ...fn(sec)]);
    const width = (sec) => sectionCols(data[sec.key]);
    const aoa = [
      ['Month - Year', 'Transaction Date', ...both(sec => [sec.title, ...Array(width(sec) - 1).fill('')])],
      ['', '', ...both(sec => (data[sec.key].heads.length
        ? [...data[sec.key].heads.map(h => h.name.toUpperCase()), sec.totalLabel]
        : [sec.totalLabel]))]
    ];
    buildBlocks(reportData).forEach(b => {
      b.rows.forEach((r, i) => aoa.push([i === 0 ? b.label : '', dayjs(r.date).format('DD-MMM-YYYY'), ...both(sec => vals(sec, r[sec.key]))]));
      aoa.push(['', b.subLabel, ...both(sec => vals(sec, b.totals[sec.key]))]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const payW = width(SECTIONS[0]);
    ws['!merges'] = [
      { s: { r: 0, c: 2 }, e: { r: 0, c: 1 + payW } },
      { s: { r: 0, c: 3 + payW }, e: { r: 0, c: 2 + payW + width(SECTIONS[1]) } }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Milk Bill Abstract');
    XLSX.writeFile(wb, `milk_bill_abstract_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Excel file downloaded', color: 'green' });
  };

  return (
    <Box p="md">
      <Paper radius="sm" p="sm" mb="md" withBorder>
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Group gap="sm" align="flex-end" wrap="nowrap">
            <Group gap={6} mr="sm" wrap="nowrap">
              <IconMilk size={22} color="var(--mantine-color-cyan-7)" />
              <Box>
                <Title order={5} style={{ lineHeight: 1.1 }}>Milk Bill Abstract</Title>
                <Text size="xs" c="dimmed">Adjustment Entries marked Milk Bill</Text>
              </Box>
            </Group>
            <DatePickerInput
              label="From Date" value={dateRange[0]}
              onChange={(val) => setDateRange([val, dateRange[1]])}
              leftSection={<IconCalendar size={12} />} leftSectionWidth={24}
              w={112} size="xs"
            />
            <DatePickerInput
              label="To Date" value={dateRange[1]}
              onChange={(val) => setDateRange([dateRange[0], val])}
              leftSection={<IconCalendar size={12} />} leftSectionWidth={24}
              w={112} size="xs"
            />
            <Button leftSection={<IconRefresh size={14} />} onClick={fetchReport} loading={loading} size="xs">
              Generate
            </Button>
          </Group>
          {hasData ? (
            <Group gap="xs">
              <Badge variant="light" size="md">{reportData.voucherCount} voucher{reportData.voucherCount !== 1 ? 's' : ''}</Badge>
              <Button leftSection={<IconFileExport size={14} />} variant="light" color="teal" onClick={handleExport} size="xs">Export Excel</Button>
              <Button leftSection={<IconPrinter size={14} />} variant="light" color="gray" onClick={handlePrint} size="xs">Print</Button>
            </Group>
          ) : null}
        </Group>
      </Paper>

      {loading ? (
        <Center py="xl"><Loader size="md" /></Center>
      ) : !reportData ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <IconMilk size={48} color="#bdbdbd" />
            <Text c="dimmed" size="sm">Select From / To dates and click Generate</Text>
          </Stack>
        </Center>
      ) : !hasData ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <IconInbox size={48} color="#bdbdbd" />
            <Text c="dimmed" size="sm">No Milk Bill adjustment entries for this period</Text>
          </Stack>
        </Center>
      ) : (
        <Paper radius="sm" p="md" withBorder className="mbt" style={{ background: '#fff' }}>
          <style>{gridCss('12px', { org: '17px', title: '15px', fy: '11px' })}</style>
          <ScrollArea type="auto">
            <Box style={{ width: 'max-content', minWidth: '100%' }}>
              <Box style={{ width: report.width, margin: '0 auto' }}>
                <div dangerouslySetInnerHTML={{ __html: headerHtml(orgName, loadedRange) + report.html }} />
              </Box>
            </Box>
          </ScrollArea>
        </Paper>
      )}
    </Box>
  );
};

export default MilkBillAbstract;
