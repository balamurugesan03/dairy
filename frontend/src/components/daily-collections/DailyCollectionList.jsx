import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Paper, TextInput, Select,
  Badge, ActionIcon, Box, Card, ThemeIcon, Tooltip,
  Pagination, Divider, SimpleGrid, Menu,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus, IconSearch, IconTrash, IconRefresh,
  IconMilk, IconDroplet, IconFlame, IconScale,
  IconCurrencyRupee, IconCalendar, IconFilter,
  IconSun, IconBuildingStore, IconPrinter,
  IconFileTypeXls, IconFileTypePdf, IconChevronDown,
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
const DailyCollectionList = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  const [loading,    setLoading]    = useState(false);
  const [records,    setRecords]    = useState([]);
  const [centers,    setCenters]    = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  const [date,   setDate]   = useState(new Date());
  const [shift,  setShift]  = useState('');
  const [center, setCenter] = useState('');
  const [search, setSearch] = useState('');

  // Load centers
  useEffect(() => {
    collectionCenterAPI.getAll({ status: 'Active', limit: 200 })
      .then(res => setCenters((res?.data || []).map(c => ({ value: c._id, label: c.centerName }))))
      .catch(() => {});
  }, []);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (date)   params.date             = dayjs(date).format('YYYY-MM-DD');
      if (shift)  params.shift            = shift;
      if (center) params.collectionCenter = center;

      const res  = await milkCollectionAPI.getAll(params);
      let   list = res?.data || [];

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(r =>
          r.farmerNumber?.toLowerCase().includes(q) ||
          r.farmerName?.toLowerCase().includes(q)
        );
      }

      setPagination(p => ({ ...p, total: res?.pagination?.total ?? list.length }));
      setRecords(list);
    } catch (err) {
      notifications.show({ message: err?.message || 'Failed to load records', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, date, shift, center, search]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (row) => {
    modals.openConfirmModal({
      title: 'Delete Entry',
      children: (
        <Text size="sm">
          Delete bill <b>{row.billNo}</b> for <b>{row.farmerName || row.farmerNumber}</b>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await milkCollectionAPI.delete(row._id);
          notifications.show({ message: `${row.billNo} deleted`, color: 'orange', autoClose: 2000 });
          fetchRecords();
        } catch (err) {
          notifications.show({ message: err?.message || 'Delete failed', color: 'red' });
        }
      },
    });
  };

  // ── Computed stats ─────────────────────────────────────────────────────────
  const totalQty = records.reduce((s, r) => s + (r.qty    || 0), 0);
  const totalAmt = records.reduce((s, r) => s + (r.amount || 0), 0);
  const avgFat   = records.length ? records.reduce((s, r) => s + (r.fat || 0), 0) / records.length : 0;
  const avgClr   = records.length ? records.reduce((s, r) => s + (r.clr || 0), 0) / records.length : 0;
  const avgSnf   = records.length ? records.reduce((s, r) => s + (r.snf || 0), 0) / records.length : 0;
  const amCount  = records.filter(r => r.shift === 'AM').length;
  const pmCount  = records.filter(r => r.shift === 'PM').length;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const companyName = selectedCompany?.name || 'Dairy Cooperative Society';
  const dateLabel   = dayjs(date).format('DD MMM YYYY');
  const shiftLabel  = shift ? `${shift} Shift` : 'All Shifts';
  const centerLabel = centers.find(c => c.value === center)?.label || 'All Centers';
  const reportTitle = `Daily Milk Collection Register — ${dateLabel} · ${shiftLabel}`;

  // ── Excel Export ───────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!records.length) {
      notifications.show({ message: 'No records to export', color: 'yellow' });
      return;
    }

    const rows = [
      [companyName],
      [reportTitle],
      [`Center: ${centerLabel}`],
      [],
      ['Sl', 'Bill No', 'Date', 'Shift', 'Farmer No', 'Farmer Name', 'Qty (L)', 'FAT %', 'CLR', 'SNF %', 'Rate (₹)', 'Incentive (₹)', 'Amount (₹)'],
      ...records.map((r, i) => [
        i + 1,
        r.billNo,
        dayjs(r.date).format('DD/MM/YYYY'),
        r.shift,
        r.farmerNumber,
        r.farmerName || '',
        parseFloat((r.qty       || 0).toFixed(2)),
        parseFloat((r.fat       || 0).toFixed(2)),
        parseFloat((r.clr       || 0).toFixed(1)),
        parseFloat((r.snf       || 0).toFixed(2)),
        parseFloat((r.rate      || 0).toFixed(2)),
        parseFloat((r.incentive || 0).toFixed(2)),
        parseFloat((r.amount    || 0).toFixed(2)),
      ]),
      [],
      ['', '', '', '', '', 'TOTALS',
        parseFloat(totalQty.toFixed(2)), '',  '',  '',  '',  '',
        parseFloat(totalAmt.toFixed(2)),
      ],
      ['', '', '', '', '', 'AVERAGES',
        '', parseFloat(avgFat.toFixed(2)), parseFloat(avgClr.toFixed(1)), parseFloat(avgSnf.toFixed(2)),
        '', '', '',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
      { wch: 20 }, { wch: 9 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 10 }, { wch: 13 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Collections');
    XLSX.writeFile(wb, `Daily_Collection_${dayjs(date).format('YYYY-MM-DD')}_${shift || 'ALL'}.xlsx`);

    notifications.show({ message: 'Excel exported successfully', color: 'green' });
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (!records.length) {
      notifications.show({ message: 'No records to export', color: 'yellow' });
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');
    const pw  = doc.internal.pageSize.width;

    // Title block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(companyName, pw / 2, 13, { align: 'center' });

    doc.setFontSize(11);
    doc.text('Daily Milk Collection Register', pw / 2, 20, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${dateLabel}   Shift: ${shiftLabel}   Center: ${centerLabel}`, pw / 2, 27, { align: 'center' });
    doc.text(`Printed: ${dayjs().format('DD MMM YYYY HH:mm')}`, pw / 2, 33, { align: 'center' });

    // Table
    autoTable(doc, {
      startY: 37,
      head: [['Sl', 'Bill No', 'Date', 'Shift', 'Farmer No', 'Farmer Name', 'Qty(L)', 'FAT%', 'CLR', 'SNF%', 'Rate', 'Incentive', 'Amount']],
      body: [
        ...records.map((r, i) => [
          i + 1,
          r.billNo,
          dayjs(r.date).format('DD/MM/YY'),
          r.shift,
          r.farmerNumber,
          r.farmerName || '—',
          (r.qty       || 0).toFixed(2),
          (r.fat       || 0).toFixed(2),
          (r.clr       || 0).toFixed(1),
          (r.snf       || 0).toFixed(2),
          `₹${(r.rate      || 0).toFixed(2)}`,
          `₹${(r.incentive || 0).toFixed(2)}`,
          `₹${(r.amount    || 0).toFixed(2)}`,
        ]),
        // Totals row
        [
          { content: 'TOTAL', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: totalQty.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: avgFat.toFixed(2),   styles: { fontStyle: 'bold', halign: 'right' } },
          { content: avgClr.toFixed(1),   styles: { fontStyle: 'bold', halign: 'right' } },
          { content: avgSnf.toFixed(2),   styles: { fontStyle: 'bold', halign: 'right' } },
          '',
          '',
          { content: `₹${totalAmt.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } },
        ],
      ],
      styles:      { fontSize: 8, cellPadding: 2 },
      headStyles:  { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      footStyles:  { fillColor: [232, 234, 246] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 8  },
        1:  { halign: 'center', cellWidth: 22 },
        2:  { halign: 'center', cellWidth: 18 },
        3:  { halign: 'center', cellWidth: 12 },
        4:  { halign: 'center', cellWidth: 20 },
        5:  { halign: 'left',   cellWidth: 32 },
        6:  { halign: 'right',  cellWidth: 15 },
        7:  { halign: 'right',  cellWidth: 13 },
        8:  { halign: 'right',  cellWidth: 12 },
        9:  { halign: 'right',  cellWidth: 13 },
        10: { halign: 'right',  cellWidth: 18 },
        11: { halign: 'right',  cellWidth: 18 },
        12: { halign: 'right',  cellWidth: 20 },
      },
      didDrawPage: (data) => {
        // Page number at bottom
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pw / 2,
          doc.internal.pageSize.height - 5,
          { align: 'center' }
        );
      },
    });

    doc.save(`Daily_Collection_${dayjs(date).format('YYYY-MM-DD')}_${shift || 'ALL'}.pdf`);
    notifications.show({ message: 'PDF exported successfully', color: 'green' });
  };

  // ── Print (browser) ────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!records.length) {
      notifications.show({ message: 'No records to print', color: 'yellow' });
      return;
    }

    const rows = records.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.billNo}</td>
        <td>${dayjs(r.date).format('DD/MM/YY')}</td>
        <td>${r.shift}</td>
        <td>${r.farmerNumber}</td>
        <td>${r.farmerName || '—'}</td>
        <td class="num">${(r.qty || 0).toFixed(2)}</td>
        <td class="num">${(r.fat || 0).toFixed(2)}</td>
        <td class="num">${(r.clr || 0).toFixed(1)}</td>
        <td class="num">${(r.snf || 0).toFixed(2)}</td>
        <td class="num">₹${(r.rate || 0).toFixed(2)}</td>
        <td class="num">₹${(r.incentive || 0).toFixed(2)}</td>
        <td class="num bold">₹${(r.amount || 0).toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Daily Collection — ${dateLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #111; }
    .header { text-align: center; margin-bottom: 10px; }
    .header h1 { font-size: 15px; font-weight: 800; }
    .header h2 { font-size: 12px; font-weight: 600; margin-top: 2px; }
    .header p  { font-size: 9px; color: #555; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #1565c0; color: #fff; padding: 5px 6px; font-size: 9px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    td { padding: 4px 6px; border-bottom: 1px solid #e0e0e0; font-size: 9.5px; }
    tr:nth-child(even) td { background: #f5f7fa; }
    .num  { text-align: right; }
    .bold { font-weight: 700; }
    .total-row td { background: #e3f2fd !important; font-weight: 700; border-top: 2px solid #1565c0; font-size: 10px; }
    .footer { margin-top: 14px; display: flex; gap: 24px; font-size: 9px; color: #444; }
    .footer span { background: #f0f4ff; padding: 3px 8px; border-radius: 4px; }
    @page { size: A4 landscape; margin: 10mm; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName}</h1>
    <h2>Daily Milk Collection Register</h2>
    <p>Date: ${dateLabel} &nbsp;|&nbsp; Shift: ${shiftLabel} &nbsp;|&nbsp; Center: ${centerLabel} &nbsp;|&nbsp; Printed: ${dayjs().format('DD MMM YYYY HH:mm')}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Sl</th><th>Bill No</th><th>Date</th><th>Shift</th>
        <th>Farmer No</th><th>Farmer Name</th>
        <th>Qty (L)</th><th>FAT %</th><th>CLR</th><th>SNF %</th>
        <th>Rate</th><th>Incentive</th><th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="6" style="text-align:right">TOTALS / AVERAGES →</td>
        <td class="num">${totalQty.toFixed(2)}</td>
        <td class="num">${avgFat.toFixed(2)}</td>
        <td class="num">${avgClr.toFixed(1)}</td>
        <td class="num">${avgSnf.toFixed(2)}</td>
        <td></td><td></td>
        <td class="num">₹${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <span>Entries: <b>${records.length}</b></span>
    <span>AM: <b>${amCount}</b></span>
    <span>PM: <b>${pmCount}</b></span>
    <span>Total Qty: <b>${totalQty.toFixed(2)} L</b></span>
    <span>Avg FAT: <b>${avgFat.toFixed(2)}%</b></span>
    <span>Avg CLR: <b>${avgClr.toFixed(1)}</b></span>
    <span>Avg SNF: <b>${avgSnf.toFixed(2)}%</b></span>
    <span>Total Amount: <b>₹${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">

      {/* ── Header ── */}
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={2} fw={700}>Daily Collection List</Title>
          <Text c="dimmed" size="sm">
            {dateLabel} · {shiftLabel} · {pagination.total} records
          </Text>
        </Box>
        <Group gap="xs">
          {/* Export / Print menu */}
          <Menu shadow="md" width={180} position="bottom-end">
            <Menu.Target>
              <Button
                variant="default"
                rightSection={<IconChevronDown size={14} />}
                leftSection={<IconPrinter size={16} />}
                disabled={records.length === 0}
              >
                Print / Export
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Export</Menu.Label>
              <Menu.Item
                leftSection={<IconFileTypeXls size={14} color="#217346" />}
                onClick={handleExportExcel}
              >
                Export Excel (.xlsx)
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileTypePdf size={14} color="#e53935" />}
                onClick={handleExportPDF}
              >
                Export PDF
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Print</Menu.Label>
              <Menu.Item
                leftSection={<IconPrinter size={14} />}
                onClick={handlePrint}
              >
                Print (A4 Landscape)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/daily-collections/milk-purchase')}
          >
            New Entry
          </Button>
        </Group>
      </Group>

      {/* ── Stats ── */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="md">
        <StatCard label="Entries"   value={records.length}             color="blue"   icon={<IconMilk size={20} />} />
        <StatCard label="Total Qty" value={`${totalQty.toFixed(1)} L`} color="teal"   icon={<IconScale size={20} />} />
        <StatCard label="Total Amt" value={`₹${totalAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="green" icon={<IconCurrencyRupee size={20} />} />
        <StatCard label="Avg FAT %" value={avgFat.toFixed(2)}          color="orange" icon={<IconFlame size={20} />} />
        <StatCard label="Avg CLR"   value={avgClr.toFixed(1)}          color="violet" icon={<IconDroplet size={20} />} />
        <StatCard label="AM / PM"   value={`${amCount} / ${pmCount}`}  color="gray"   sub="shift entries" icon={<IconSun size={20} />} />
      </SimpleGrid>

      {/* ── Filters ── */}
      <Paper withBorder p="sm" mb="md" radius="md">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <DatePickerInput
            label="Date"
            value={date}
            onChange={v => { setDate(v); setPagination(p => ({ ...p, page: 1 })); }}
            leftSection={<IconCalendar size={14} />}
            valueFormat="DD MMM YYYY"
            size="sm"
            style={{ width: 150 }}
          />
          <Select
            label="Shift"
            placeholder="All Shifts"
            data={[{ value: 'AM', label: '☀ AM Shift' }, { value: 'PM', label: '🌙 PM Shift' }]}
            value={shift}
            onChange={v => { setShift(v || ''); setPagination(p => ({ ...p, page: 1 })); }}
            clearable size="sm" style={{ width: 140 }}
          />
          <Select
            label="Center"
            placeholder="All Centers"
            data={centers}
            value={center}
            onChange={v => { setCenter(v || ''); setPagination(p => ({ ...p, page: 1 })); }}
            leftSection={<IconBuildingStore size={14} />}
            clearable searchable size="sm" style={{ width: 180 }}
          />
          <TextInput
            label="Search Farmer"
            placeholder="Farmer no. or name..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            size="sm" style={{ flex: 1, minWidth: 180 }}
          />
          <Tooltip label="Refresh">
            <ActionIcon variant="light" size="lg" onClick={fetchRecords}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          {(shift || center || search) && (
            <Button
              variant="subtle" color="gray" size="sm"
              onClick={() => { setShift(''); setCenter(''); setSearch(''); setPagination(p => ({ ...p, page: 1 })); }}
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
          records={records}
          fetching={loading}
          minHeight={300}
          noRecordsText="No collection entries found for this date/shift"
          striped
          highlightOnHover
          columns={[
            {
              accessor: 'billNo', title: 'Bill No', width: 130,
              render: r => <Text size="sm" fw={700} c="blue">{r.billNo}</Text>,
            },
            {
              accessor: 'date', title: 'Date', width: 110,
              render: r => <Text size="sm">{dayjs(r.date).format('DD MMM YY')}</Text>,
            },
            {
              accessor: 'shift', title: 'Shift', width: 80,
              render: r => (
                <Badge size="sm" color={r.shift === 'AM' ? 'yellow' : 'indigo'} variant="light">
                  {r.shift === 'AM' ? '☀ AM' : '🌙 PM'}
                </Badge>
              ),
            },
            {
              accessor: 'farmer', title: 'Farmer',
              render: r => (
                <Box>
                  <Badge size="xs" color="green" variant="filled" radius="sm">{r.farmerNumber}</Badge>
                  <Text size="xs" c="dimmed" mt={1}>{r.farmerName || '—'}</Text>
                </Box>
              ),
            },
            {
              accessor: 'qty', title: 'Qty (L)', width: 80, textAlign: 'right',
              render: r => <Text size="sm" fw={700} c="blue">{(r.qty || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'fat', title: 'FAT %', width: 75, textAlign: 'right',
              render: r => <Text size="sm" fw={600} c="orange">{(r.fat || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'clr', title: 'CLR', width: 70, textAlign: 'right',
              render: r => <Text size="sm" c="violet">{(r.clr || 0).toFixed(1)}</Text>,
            },
            {
              accessor: 'snf', title: 'SNF %', width: 75, textAlign: 'right',
              render: r => <Text size="sm" c="green">{(r.snf || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'rate', title: 'Rate', width: 80, textAlign: 'right',
              render: r => <Text size="sm" fw={600}>₹{(r.rate || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'incentive', title: 'Incentive', width: 85, textAlign: 'right',
              render: r => <Text size="sm" c="teal">₹{(r.incentive || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'amount', title: 'Amount', width: 100, textAlign: 'right',
              render: r => (
                <Text size="sm" fw={700} c="green.8">
                  ₹{(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              ),
            },
            {
              accessor: 'actions', title: '', width: 50,
              render: r => (
                <Tooltip label="Delete" withArrow>
                  <ActionIcon size="sm" color="red" variant="subtle" onClick={() => handleDelete(r)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              ),
            },
          ]}
        />

        {/* Totals footer */}
        {records.length > 0 && (
          <Box style={{ background: 'linear-gradient(90deg,#e8eaf6,#e3f2fd)', borderTop: '2px solid #90caf9', padding: '8px 16px' }}>
            <Group gap="xl" wrap="wrap">
              <Text size="xs" fw={800} c="dark.4" tt="uppercase" style={{ letterSpacing: '0.4px' }}>Totals</Text>
              <Divider orientation="vertical" />
              {[
                { label: 'Entries',      val: records.length,          c: 'blue'   },
                { label: 'Total Qty',    val: `${totalQty.toFixed(2)} L`, c: 'blue' },
                { label: 'Total Amount', val: `₹${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, c: 'green.8' },
                { label: 'Avg FAT %',   val: avgFat.toFixed(2),        c: 'orange' },
                { label: 'Avg CLR',     val: avgClr.toFixed(1),        c: 'violet' },
                { label: 'Avg SNF %',   val: avgSnf.toFixed(2),        c: 'green'  },
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            total={totalPages}
            value={pagination.page}
            onChange={p => setPagination(prev => ({ ...prev, page: p }))}
          />
        </Group>
      )}
    </Container>
  );
};

export default DailyCollectionList;
