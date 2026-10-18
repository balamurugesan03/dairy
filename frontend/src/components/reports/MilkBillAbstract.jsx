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
// Payment = their Cr legs, shown as one tabular grid (Union Bill Tabular
// layout): Month - Year | Transaction Date | one column per Head of
// Account (A→Z) | PAYMENT TOTAL, with a cyan subtotal row
// per month (as in the Union Bill Tabular Report reference).

// Amounts: 2 decimals, no thousand separators, blank when zero.
const fmtD = (n) => { const v = parseFloat(n || 0); return Math.abs(v) < 0.005 ? '' : v.toFixed(2); };
const fmtDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '';

const financialYearRange = () => {
  const now = dayjs();
  const fy = now.month() >= 3 ? now.year() : now.year() - 1;
  return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
};

// Only the Payment side, as in the Union Bill Tabular Report reference.
const SECTIONS = [
  { key: 'payment', title: 'PAYMENT', totalLabel: 'PAYMENT TOTAL' }
];

// Rows (one per date) → month blocks with their own column totals.
const groupByMonth = (data) => {
  const blocks = [];
  (data.rows || []).forEach(r => {
    const mk = String(r.date).slice(0, 7);
    let b = blocks[blocks.length - 1];
    if (!b || b.key !== mk) {
      const d = dayjs(r.date);
      b = { key: mk, label: d.format('MMM - YYYY'), subLabel: d.format('MMM YYYY'), rows: [], totals: {}, total: 0 };
      blocks.push(b);
    }
    b.rows.push(r);
    Object.entries(r.amounts || {}).forEach(([k, v]) => { b.totals[k] = (b.totals[k] || 0) + v; });
    b.total += r.total || 0;
  });
  return blocks;
};

// Shared by screen (scoped under .mbt) and print, so both look the same.
const gridCss = (fontSize, headSizes) => `
  .mbt table { width: 100%; border-collapse: collapse; table-layout: fixed;
    font-family: 'Times New Roman', Times, serif; font-size: ${fontSize}; color: #000; background: #fff; }
  .mbt th, .mbt td { border: 1px solid #222; padding: 2px 4px; }
  .mbt th { font-weight: 400; text-align: right; vertical-align: top; text-transform: uppercase;
    line-height: 1.15; overflow-wrap: anywhere; word-break: break-word; }
  .mbt th.l { text-align: left; text-transform: none; }
  .mbt th.blank { border: none; }
  .mbt th.sup { text-align: center; font-weight: 700; }
  .mbt th.tot { font-weight: 700; }
  .mbt tr.spacer td { border: none; height: 8px; padding: 0; }
  .mbt td.amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .mbt td.date { padding-left: 6px; white-space: nowrap; }
  .mbt td.month { background: #fff; vertical-align: top; white-space: nowrap; }
  .mbt td.b { font-weight: 700; }
  .mbt tbody.mblock { break-inside: avoid; page-break-inside: avoid; }
  .mbt tr.sub td:not(.month) { background: #80E8F8; font-weight: 700; }
  .mbt thead { display: table-header-group; }
  /* Heading sits centred over the ledger columns (right of the Month / Date columns). */
  .mbt-head { margin-left: 14%; text-align: center; font-family: 'Times New Roman', Times, serif;
    color: #000; font-weight: 400; margin-bottom: 10px; }
  .mbt-head > div + div { margin-top: 2px; }
  .mbt-head__org { font-size: ${headSizes.org}; text-transform: uppercase; }
  .mbt-head__title { font-size: ${headSizes.title}; }
  .mbt-head__fy { font-size: ${headSizes.fy}; }
`;

// Column widths: Month 6.5%, Date 7.5%, the rest shared equally.
const colGroupHtml = (n) => {
  const w = (86 / (n + 1)).toFixed(3);
  return `<colgroup><col style="width:6.5%"><col style="width:7.5%">${
    Array.from({ length: n + 1 }, () => `<col style="width:${w}%">`).join('')}</colgroup>`;
};

const sectionTableHtml = (sec, data) => {
  const heads = data.heads || [];
  const blocks = groupByMonth(data);
  const cells = (amounts, total, bold) =>
    heads.map(h => `<td class="amt${bold ? ' b' : ''}">${fmtD(amounts[h.key])}</td>`).join('') +
    `<td class="amt b">${fmtD(total)}</td>`;
  const body = blocks.map(b => `<tbody class="mblock">
      ${b.rows.map((r, i) => `<tr>
        ${i === 0 ? `<td class="month" rowspan="${b.rows.length + 1}">${b.label}</td>` : ''}
        <td class="date">${dayjs(r.date).format('DD-MMM-YYYY')}</td>
        ${cells(r.amounts, r.total)}
      </tr>`).join('')}
      <tr class="sub"><td class="b">${b.subLabel}</td>${cells(b.totals, b.total, true)}</tr>
    </tbody>`).join('');
  return `<table>
    ${colGroupHtml(heads.length)}
    <thead>
      <tr>
        <th class="blank"></th><th class="blank"></th>
        <th class="sup" colspan="${heads.length + 1}">${sec.title}</th>
      </tr>
      <tr>
        <th class="l">Month -<br>Year</th>
        <th class="l">Transaction<br>Date</th>
        ${heads.map(h => `<th>${escapeHtml(h.name)}</th>`).join('')}<th class="tot">${sec.totalLabel}</th>
      </tr>
      <tr class="spacer"><td colspan="${heads.length + 3}"></td></tr>
    </thead>
    ${body}
  </table>`;
};

const headerHtml = (orgName, range) => `
  <div class="mbt-head">
    <div class="mbt-head__org">${escapeHtml(orgName)}</div>
    <div class="mbt-head__title">Union Bill Tabular Report</div>
    <div class="mbt-head__fy">For the financial year ${fmtDate(range[0])}-${fmtDate(range[1])}</div>
  </div>`;

// A4 landscape content box in CSS px (297×210mm less the 10mm × 8mm @page margins).
const PAGE_PX = { w: 1060, h: 712 };

// Shrink each section to fit its page; past MIN_ZOOM it flows onto further
// pages with the header rows repeating and month blocks kept whole.
const fitScript = `
<script>
  (function () {
    var MIN_ZOOM = 0.7;
    document.querySelectorAll('.mb-fit').forEach(function (el) {
      var z = Math.min(1, ${PAGE_PX.w} / el.scrollWidth, (${PAGE_PX.h} * 0.98) / el.scrollHeight);
      if (z < 1) el.style.zoom = Math.max(z, MIN_ZOOM);
    });
  })();
</script>`;

const PRINT_CSS = `
  ${gridCss('8pt', { org: '12pt', title: '11pt', fy: '8pt' })}
  body { font-family: 'Times New Roman', Times, serif; }
  .mb-page { page-break-after: always; break-after: page; }
  .mb-page:last-child { page-break-after: auto; break-after: auto; }
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

  const sections = SECTIONS.filter(sec => reportData?.[sec.key]?.rows?.length);
  const hasData = sections.length > 0;

  const handlePrint = () => {
    if (!hasData) return;
    const pages = sections.map(sec => `
      <div class="mb-page"><div class="mb-fit mbt" style="width:${PAGE_PX.w}px">
        ${headerHtml(orgName, loadedRange)}
        ${sectionTableHtml(sec, reportData[sec.key])}
      </div></div>`).join('');
    openA4Print({
      title: 'Union Bill Tabular Report',
      orientation: 'landscape',
      css: PRINT_CSS,
      bodyHtml: pages + fitScript
    });
  };

  const handleExport = () => {
    if (!hasData) return;
    const num = (v) => (Math.abs(v || 0) < 0.005 ? '' : Math.round(v * 100) / 100);
    const wb = XLSX.utils.book_new();
    sections.forEach(sec => {
      const data = reportData[sec.key];
      const vals = (amounts, total) => [...data.heads.map(h => num(amounts[h.key])), num(total)];
      const aoa = [
        ['Month - Year', 'Transaction Date', sec.title],
        ['', '', ...data.heads.map(h => h.name.toUpperCase()), sec.totalLabel]
      ];
      groupByMonth(data).forEach(b => {
        b.rows.forEach((r, i) => aoa.push([i === 0 ? b.label : '', dayjs(r.date).format('DD-MMM-YYYY'), ...vals(r.amounts, r.total)]));
        aoa.push(['', b.subLabel, ...vals(b.totals, b.total)]);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [{ s: { r: 0, c: 2 }, e: { r: 0, c: data.heads.length + 2 } }];
      XLSX.utils.book_append_sheet(wb, ws, sec.title);
    });
    XLSX.writeFile(wb, `milk_bill_abstract_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Excel file downloaded', color: 'green' });
  };

  const renderSection = (sec) => {
    const data = reportData[sec.key];
    const heads = data.heads;
    const blocks = groupByMonth(data);
    const amountCells = (amounts, total, bold) => (
      <>
        {heads.map(h => <td key={h.key} className={`amt${bold ? ' b' : ''}`}>{fmtD(amounts[h.key])}</td>)}
        <td className="amt b">{fmtD(total)}</td>
      </>
    );
    const colW = `${(86 / (heads.length + 1)).toFixed(3)}%`;
    return (
      <ScrollArea key={sec.key} type="auto" mb="lg">
        <Box style={{ minWidth: 200 + (heads.length + 1) * 90 }}>
          <div dangerouslySetInnerHTML={{ __html: headerHtml(orgName, loadedRange) }} />
          <table>
            <colgroup>
              <col style={{ width: '6.5%' }} />
              <col style={{ width: '7.5%' }} />
              {Array.from({ length: heads.length + 1 }, (_, i) => <col key={i} style={{ width: colW }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="blank" /><th className="blank" />
                <th className="sup" colSpan={heads.length + 1}>{sec.title}</th>
              </tr>
              <tr>
                <th className="l">Month -<br />Year</th>
                <th className="l">Transaction<br />Date</th>
                {heads.map(h => <th key={h.key}>{h.name}</th>)}
                <th className="tot">{sec.totalLabel}</th>
              </tr>
              <tr className="spacer"><td colSpan={heads.length + 3} /></tr>
            </thead>
            {blocks.map(b => (
              <tbody key={b.key} className="mblock">
                {b.rows.map((r, i) => (
                  <tr key={r.date}>
                    {i === 0 && <td className="month" rowSpan={b.rows.length + 1}>{b.label}</td>}
                    <td className="date">{dayjs(r.date).format('DD-MMM-YYYY')}</td>
                    {amountCells(r.amounts, r.total)}
                  </tr>
                ))}
                <tr className="sub">
                  <td className="b">{b.subLabel}</td>
                  {amountCells(b.totals, b.total, true)}
                </tr>
              </tbody>
            ))}
          </table>
        </Box>
      </ScrollArea>
    );
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
          {sections.map(renderSection)}
        </Paper>
      )}
    </Box>
  );
};

export default MilkBillAbstract;
