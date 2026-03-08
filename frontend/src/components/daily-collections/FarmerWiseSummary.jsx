import { useState, useEffect, useCallback } from 'react';
import {
  Container, Title, Text, Button, Group, Paper, TextInput, Select,
  Badge, ActionIcon, Box, Card, ThemeIcon, Tooltip,
  Divider, SimpleGrid, Menu,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconRefresh, IconMilk, IconDroplet, IconFlame,
  IconScale, IconCurrencyRupee, IconCalendar, IconFilter,
  IconBuildingStore, IconPrinter, IconFileTypeXls,
  IconFileTypePdf, IconChevronDown, IconUsers,
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { milkCollectionAPI, collectionCenterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import dayjs from 'dayjs';

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color, icon }) => (
  <Card withBorder radius="md" p="sm">
    <Group gap="xs" wrap="nowrap">
      <ThemeIcon size={38} variant="light" color={color} radius="md">{icon}</ThemeIcon>
      <Box>
        <Text size="xs" c="dimmed" fw={500}>{label}</Text>
        <Text fw={800} size="lg" lh={1.2}>{value}</Text>
        {sub && <Text size="10px" c="dimmed">{sub}</Text>}
      </Box>
    </Group>
  </Card>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const FarmerWiseSummary = () => {
  const { selectedCompany } = useCompany();

  const [loading,  setLoading]  = useState(false);
  const [rows,     setRows]     = useState([]);
  const [centers,  setCenters]  = useState([]);

  // Filters — default: today
  const [dateRange, setDateRange] = useState([new Date(), new Date()]);
  const [shift,     setShift]     = useState('');
  const [center,    setCenter]    = useState('');
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    collectionCenterAPI.getAll({ status: 'Active', limit: 200 })
      .then(res => setCenters((res?.data || []).map(c => ({ value: c._id, label: c.centerName }))))
      .catch(() => {});
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange[0]) params.fromDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
      if (dateRange[1]) params.toDate   = dayjs(dateRange[1]).format('YYYY-MM-DD');
      if (shift)        params.shift    = shift;
      if (center)       params.collectionCenter = center;

      const res  = await milkCollectionAPI.getFarmerWiseSummary(params);
      let   list = res?.data || [];

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(r =>
          r.farmerNumber?.toLowerCase().includes(q) ||
          r.farmerName?.toLowerCase().includes(q)
        );
      }

      setRows(list);
    } catch (err) {
      notifications.show({ message: err?.message || 'Failed to load summary', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [dateRange, shift, center, search]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // ── Grand totals ────────────────────────────────────────────────────────────
  const grandEntries   = rows.reduce((s, r) => s + r.totalEntries,   0);
  const grandQty       = rows.reduce((s, r) => s + r.totalQty,       0);
  const grandAmt       = rows.reduce((s, r) => s + r.totalAmount,    0);
  const grandIncentive = rows.reduce((s, r) => s + r.totalIncentive, 0);
  const grandAvgFat    = rows.length ? rows.reduce((s, r) => s + r.avgFat, 0) / rows.length : 0;
  const grandAvgClr    = rows.length ? rows.reduce((s, r) => s + r.avgClr, 0) / rows.length : 0;
  const grandAvgSnf    = rows.length ? rows.reduce((s, r) => s + r.avgSnf, 0) / rows.length : 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const companyName  = selectedCompany?.name || 'Dairy Cooperative Society';
  const fromLabel    = dateRange[0] ? dayjs(dateRange[0]).format('DD MMM YYYY') : '—';
  const toLabel      = dateRange[1] ? dayjs(dateRange[1]).format('DD MMM YYYY') : '—';
  const rangeLabel   = fromLabel === toLabel ? fromLabel : `${fromLabel} to ${toLabel}`;
  const shiftLabel   = shift ? `${shift} Shift` : 'All Shifts';
  const centerLabel  = centers.find(c => c.value === center)?.label || 'All Centers';
  const reportTitle  = `Farmer-Wise Collection Summary — ${rangeLabel}`;

  // ── Excel Export ────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!rows.length) { notifications.show({ message: 'No data to export', color: 'yellow' }); return; }

    const data = [
      [companyName],
      ['Farmer-Wise Milk Collection Summary'],
      [`Period: ${rangeLabel}   Shift: ${shiftLabel}   Center: ${centerLabel}`],
      [],
      ['Sl', 'Farmer No', 'Farmer Name', 'AM', 'PM', 'Total Entries',
       'Total Qty (L)', 'Avg FAT %', 'Avg CLR', 'Avg SNF %',
       'Avg Rate (₹)', 'Incentive (₹)', 'Total Amount (₹)'],
      ...rows.map((r, i) => [
        i + 1,
        r.farmerNumber,
        r.farmerName,
        r.amEntries,
        r.pmEntries,
        r.totalEntries,
        r.totalQty,
        r.avgFat,
        r.avgClr,
        r.avgSnf,
        r.avgRate,
        r.totalIncentive,
        r.totalAmount,
      ]),
      [],
      ['', '', 'GRAND TOTAL', '', '', grandEntries,
       parseFloat(grandQty.toFixed(2)),
       parseFloat(grandAvgFat.toFixed(2)),
       parseFloat(grandAvgClr.toFixed(1)),
       parseFloat(grandAvgSnf.toFixed(2)),
       '',
       parseFloat(grandIncentive.toFixed(2)),
       parseFloat(grandAmt.toFixed(2)),
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 5  }, { wch: 13 }, { wch: 22 }, { wch: 6 }, { wch: 6 },
      { wch: 13 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 10 },
      { wch: 12 }, { wch: 13 }, { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Farmer Summary');
    XLSX.writeFile(wb, `Farmer_Summary_${dayjs(dateRange[0]).format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ message: 'Excel exported successfully', color: 'green' });
  };

  // ── PDF Export ──────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (!rows.length) { notifications.show({ message: 'No data to export', color: 'yellow' }); return; }

    const doc = new jsPDF('l', 'mm', 'a4');
    const pw  = doc.internal.pageSize.width;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(companyName, pw / 2, 13, { align: 'center' });
    doc.setFontSize(11);
    doc.text('Farmer-Wise Milk Collection Summary', pw / 2, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Period: ${rangeLabel}   Shift: ${shiftLabel}   Center: ${centerLabel}`, pw / 2, 27, { align: 'center' });
    doc.text(`Printed: ${dayjs().format('DD MMM YYYY HH:mm')}`, pw / 2, 33, { align: 'center' });

    autoTable(doc, {
      startY: 37,
      head: [['Sl', 'Farmer No', 'Farmer Name', 'AM', 'PM', 'Total', 'Qty (L)', 'FAT%', 'CLR', 'SNF%', 'Avg Rate', 'Incentive', 'Amount']],
      body: [
        ...rows.map((r, i) => [
          i + 1,
          r.farmerNumber,
          r.farmerName || '—',
          r.amEntries,
          r.pmEntries,
          r.totalEntries,
          r.totalQty.toFixed(2),
          r.avgFat.toFixed(2),
          r.avgClr.toFixed(1),
          r.avgSnf.toFixed(2),
          `₹${r.avgRate.toFixed(2)}`,
          `₹${r.totalIncentive.toFixed(2)}`,
          `₹${r.totalAmount.toFixed(2)}`,
        ]),
        // Grand total row
        [
          { content: 'TOTAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: grandEntries,                         styles: { fontStyle: 'bold', halign: 'center' } },
          { content: grandQty.toFixed(2),                  styles: { fontStyle: 'bold', halign: 'right'  } },
          { content: grandAvgFat.toFixed(2),               styles: { fontStyle: 'bold', halign: 'right'  } },
          { content: grandAvgClr.toFixed(1),               styles: { fontStyle: 'bold', halign: 'right'  } },
          { content: grandAvgSnf.toFixed(2),               styles: { fontStyle: 'bold', halign: 'right'  } },
          '',
          { content: `₹${grandIncentive.toFixed(2)}`,      styles: { fontStyle: 'bold', halign: 'right'  } },
          { content: `₹${grandAmt.toFixed(2)}`,            styles: { fontStyle: 'bold', halign: 'right'  } },
        ],
      ],
      styles:             { fontSize: 8, cellPadding: 2 },
      headStyles:         { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 8  },
        1:  { halign: 'center', cellWidth: 20 },
        2:  { halign: 'left',   cellWidth: 35 },
        3:  { halign: 'center', cellWidth: 11 },
        4:  { halign: 'center', cellWidth: 11 },
        5:  { halign: 'center', cellWidth: 13 },
        6:  { halign: 'right',  cellWidth: 15 },
        7:  { halign: 'right',  cellWidth: 13 },
        8:  { halign: 'right',  cellWidth: 12 },
        9:  { halign: 'right',  cellWidth: 13 },
        10: { halign: 'right',  cellWidth: 18 },
        11: { halign: 'right',  cellWidth: 18 },
        12: { halign: 'right',  cellWidth: 22 },
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, pw / 2, doc.internal.pageSize.height - 5, { align: 'center' });
      },
    });

    doc.save(`Farmer_Summary_${dayjs(dateRange[0]).format('YYYY-MM-DD')}.pdf`);
    notifications.show({ message: 'PDF exported successfully', color: 'green' });
  };

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!rows.length) { notifications.show({ message: 'No data to print', color: 'yellow' }); return; }

    const tableRows = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.farmerNumber}</td>
        <td>${r.farmerName || '—'}</td>
        <td class="num">${r.amEntries}</td>
        <td class="num">${r.pmEntries}</td>
        <td class="num bold">${r.totalEntries}</td>
        <td class="num bold">${r.totalQty.toFixed(2)}</td>
        <td class="num">${r.avgFat.toFixed(2)}</td>
        <td class="num">${r.avgClr.toFixed(1)}</td>
        <td class="num">${r.avgSnf.toFixed(2)}</td>
        <td class="num">₹${r.avgRate.toFixed(2)}</td>
        <td class="num">₹${r.totalIncentive.toFixed(2)}</td>
        <td class="num bold">₹${r.totalAmount.toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Farmer-Wise Summary — ${rangeLabel}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:10px; color:#111; }
    .header { text-align:center; margin-bottom:10px; }
    .header h1 { font-size:15px; font-weight:800; }
    .header h2 { font-size:12px; font-weight:600; margin-top:2px; }
    .header p  { font-size:9px; color:#555; margin-top:3px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th { background:#1565c0; color:#fff; padding:5px 6px; font-size:9px; text-align:center; font-weight:700; text-transform:uppercase; }
    td { padding:4px 6px; border-bottom:1px solid #e0e0e0; font-size:9.5px; }
    tr:nth-child(even) td { background:#f5f7fa; }
    .num  { text-align:right; }
    .bold { font-weight:700; }
    .total-row td { background:#e3f2fd !important; font-weight:700; border-top:2px solid #1565c0; }
    .summary { margin-top:12px; display:flex; gap:16px; flex-wrap:wrap; font-size:9px; color:#444; }
    .summary span { background:#f0f4ff; padding:3px 8px; border-radius:4px; }
    @page { size:A4 landscape; margin:10mm; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName}</h1>
    <h2>Farmer-Wise Milk Collection Summary</h2>
    <p>Period: ${rangeLabel} &nbsp;|&nbsp; Shift: ${shiftLabel} &nbsp;|&nbsp; Center: ${centerLabel} &nbsp;|&nbsp; Printed: ${dayjs().format('DD MMM YYYY HH:mm')}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Sl</th><th>Farmer No</th><th>Farmer Name</th>
        <th>AM</th><th>PM</th><th>Total</th>
        <th>Qty (L)</th><th>FAT %</th><th>CLR</th><th>SNF %</th>
        <th>Avg Rate</th><th>Incentive</th><th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">GRAND TOTAL →</td>
        <td class="num">${rows.reduce((s,r)=>s+r.amEntries,0)}</td>
        <td class="num">${rows.reduce((s,r)=>s+r.pmEntries,0)}</td>
        <td class="num">${grandEntries}</td>
        <td class="num">${grandQty.toFixed(2)}</td>
        <td class="num">${grandAvgFat.toFixed(2)}</td>
        <td class="num">${grandAvgClr.toFixed(1)}</td>
        <td class="num">${grandAvgSnf.toFixed(2)}</td>
        <td></td>
        <td class="num">₹${grandIncentive.toFixed(2)}</td>
        <td class="num">₹${grandAmt.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <div class="summary">
    <span>Farmers: <b>${rows.length}</b></span>
    <span>Total Entries: <b>${grandEntries}</b></span>
    <span>Total Qty: <b>${grandQty.toFixed(2)} L</b></span>
    <span>Avg FAT: <b>${grandAvgFat.toFixed(2)}%</b></span>
    <span>Avg CLR: <b>${grandAvgClr.toFixed(1)}</b></span>
    <span>Avg SNF: <b>${grandAvgSnf.toFixed(2)}%</b></span>
    <span>Total Amount: <b>₹${grandAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">

      {/* ── Header ── */}
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={2} fw={700}>Farmer-Wise Collection Summary</Title>
          <Text c="dimmed" size="sm">
            {rangeLabel} · {shiftLabel} · {rows.length} farmers · {grandEntries} entries
          </Text>
        </Box>
        <Menu shadow="md" width={190} position="bottom-end">
          <Menu.Target>
            <Button
              variant="default"
              rightSection={<IconChevronDown size={14} />}
              leftSection={<IconPrinter size={16} />}
              disabled={rows.length === 0}
            >
              Print / Export
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Export</Menu.Label>
            <Menu.Item leftSection={<IconFileTypeXls size={14} color="#217346" />} onClick={handleExportExcel}>
              Export Excel (.xlsx)
            </Menu.Item>
            <Menu.Item leftSection={<IconFileTypePdf size={14} color="#e53935" />} onClick={handleExportPDF}>
              Export PDF
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>Print</Menu.Label>
            <Menu.Item leftSection={<IconPrinter size={14} />} onClick={handlePrint}>
              Print (A4 Landscape)
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* ── Stats ── */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="md">
        <StatCard label="Farmers"     value={rows.length}                color="blue"   icon={<IconUsers size={20} />} />
        <StatCard label="Total Entries" value={grandEntries}             color="indigo" icon={<IconMilk size={20} />} />
        <StatCard label="Total Qty"   value={`${grandQty.toFixed(1)} L`} color="teal"   icon={<IconScale size={20} />} />
        <StatCard label="Total Amt"   value={`₹${grandAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="green" icon={<IconCurrencyRupee size={20} />} />
        <StatCard label="Avg FAT %"   value={grandAvgFat.toFixed(2)}     color="orange" icon={<IconFlame size={20} />} />
        <StatCard label="Avg CLR"     value={grandAvgClr.toFixed(1)}     color="violet" icon={<IconDroplet size={20} />} />
      </SimpleGrid>

      {/* ── Filters ── */}
      <Paper withBorder p="sm" mb="md" radius="md">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <DatePickerInput
            type="range"
            label="Date Range"
            value={dateRange}
            onChange={setDateRange}
            leftSection={<IconCalendar size={14} />}
            valueFormat="DD MMM YYYY"
            size="sm"
            style={{ minWidth: 230 }}
          />
          <Select
            label="Shift"
            placeholder="All Shifts"
            data={[{ value: 'AM', label: '☀ AM Shift' }, { value: 'PM', label: '🌙 PM Shift' }]}
            value={shift}
            onChange={v => setShift(v || '')}
            clearable size="sm" style={{ width: 140 }}
          />
          <Select
            label="Center"
            placeholder="All Centers"
            data={centers}
            value={center}
            onChange={v => setCenter(v || '')}
            leftSection={<IconBuildingStore size={14} />}
            clearable searchable size="sm" style={{ width: 180 }}
          />
          <TextInput
            label="Search Farmer"
            placeholder="Farmer no. or name..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="sm" style={{ flex: 1, minWidth: 180 }}
          />
          <Tooltip label="Refresh">
            <ActionIcon variant="light" size="lg" onClick={fetchSummary}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          {(shift || center || search) && (
            <Button
              variant="subtle" color="gray" size="sm"
              onClick={() => { setShift(''); setCenter(''); setSearch(''); }}
              leftSection={<IconFilter size={14} />}
            >
              Clear
            </Button>
          )}
        </Group>
      </Paper>

      {/* ── Table ── */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <DataTable
          records={rows}
          fetching={loading}
          minHeight={300}
          noRecordsText="No collection data found for the selected period"
          striped
          highlightOnHover
          columns={[
            {
              accessor: 'sl', title: 'Sl', width: 50,
              render: (_, idx) => <Text size="sm" c="dimmed">{idx + 1}</Text>,
            },
            {
              accessor: 'farmerNumber', title: 'Farmer No', width: 120,
              render: r => (
                <Badge size="sm" color="green" variant="filled" radius="sm">{r.farmerNumber}</Badge>
              ),
            },
            {
              accessor: 'farmerName', title: 'Farmer Name',
              render: r => <Text size="sm" fw={600}>{r.farmerName || '—'}</Text>,
            },
            {
              accessor: 'amEntries', title: 'AM', width: 60, textAlign: 'center',
              render: r => <Text size="sm" c="yellow.7" fw={600}>{r.amEntries}</Text>,
            },
            {
              accessor: 'pmEntries', title: 'PM', width: 60, textAlign: 'center',
              render: r => <Text size="sm" c="indigo" fw={600}>{r.pmEntries}</Text>,
            },
            {
              accessor: 'totalEntries', title: 'Total', width: 70, textAlign: 'center',
              render: r => (
                <Badge size="sm" color="blue" variant="light">{r.totalEntries}</Badge>
              ),
            },
            {
              accessor: 'totalQty', title: 'Qty (L)', width: 90, textAlign: 'right',
              render: r => <Text size="sm" fw={700} c="blue">{r.totalQty.toFixed(2)}</Text>,
            },
            {
              accessor: 'avgFat', title: 'Avg FAT%', width: 85, textAlign: 'right',
              render: r => <Text size="sm" fw={600} c="orange">{r.avgFat.toFixed(2)}</Text>,
            },
            {
              accessor: 'avgClr', title: 'Avg CLR', width: 80, textAlign: 'right',
              render: r => <Text size="sm" c="violet">{r.avgClr.toFixed(1)}</Text>,
            },
            {
              accessor: 'avgSnf', title: 'Avg SNF%', width: 85, textAlign: 'right',
              render: r => <Text size="sm" c="green">{r.avgSnf.toFixed(2)}</Text>,
            },
            {
              accessor: 'avgRate', title: 'Avg Rate', width: 85, textAlign: 'right',
              render: r => <Text size="sm" fw={600}>₹{r.avgRate.toFixed(2)}</Text>,
            },
            {
              accessor: 'totalIncentive', title: 'Incentive', width: 90, textAlign: 'right',
              render: r => <Text size="sm" c="teal">₹{r.totalIncentive.toFixed(2)}</Text>,
            },
            {
              accessor: 'totalAmount', title: 'Amount', width: 110, textAlign: 'right',
              render: r => (
                <Text size="sm" fw={800} c="green.8">
                  ₹{r.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              ),
            },
          ]}
        />

        {/* Grand total footer */}
        {rows.length > 0 && (
          <Box style={{ background: 'linear-gradient(90deg,#e8eaf6,#e3f2fd)', borderTop: '2px solid #90caf9', padding: '8px 16px' }}>
            <Group gap="xl" wrap="wrap">
              <Text size="xs" fw={800} c="dark.4" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Grand Total</Text>
              <Divider orientation="vertical" />
              {[
                { label: 'Farmers',    val: rows.length,                 c: 'blue'    },
                { label: 'Entries',    val: grandEntries,                c: 'indigo'  },
                { label: 'Total Qty',  val: `${grandQty.toFixed(2)} L`,  c: 'blue'    },
                { label: 'Avg FAT %',  val: grandAvgFat.toFixed(2),      c: 'orange'  },
                { label: 'Avg CLR',    val: grandAvgClr.toFixed(1),      c: 'violet'  },
                { label: 'Avg SNF %',  val: grandAvgSnf.toFixed(2),      c: 'green'   },
                { label: 'Incentive',  val: `₹${grandIncentive.toFixed(2)}`, c: 'teal' },
                { label: 'Total Amt',  val: `₹${grandAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, c: 'green.8' },
              ].map(({ label, val, c }) => (
                <Box key={label} ta="center">
                  <Text size="9px" c="dimmed" tt="uppercase">{label}</Text>
                  <Text size="sm" fw={800} c={c}>{val}</Text>
                </Box>
              ))}
            </Group>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default FarmerWiseSummary;
