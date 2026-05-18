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
  IconFileTypeXls, IconFileTypePdf, IconChevronDown, IconX,
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { milkCollectionAPI, collectionCenterAPI, milkSalesAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import dayjs from 'dayjs';

const PAGE_SIZE = 50;

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
  const [records,    setRecords]    = useState([]);   // ALL records for current filters
  const [centers,    setCenters]    = useState([]);
  const [page,       setPage]       = useState(1);
  const [salesSummary, setSalesSummary] = useState({
    local:  { qty: 0, amt: 0 },
    credit: { qty: 0, amt: 0 },
    school: { qty: 0, amt: 0 },
    sample: { qty: 0, amt: 0 },
  });

  const [date,   setDate]   = useState(new Date());
  const [shift,  setShift]  = useState('');
  const [center, setCenter] = useState('');
  const [search, setSearch] = useState('');
  const [sortStatus, setSortStatus] = useState({ columnAccessor: 'farmer', direction: 'asc' });

  // Load centers
  useEffect(() => {
    collectionCenterAPI.getAll({ status: 'Active', limit: 200 })
      .then(res => setCenters((res?.data || []).map(c => ({ value: c._id, label: c.centerName }))))
      .catch(() => {});
  }, []);

  // Fetch ALL records for the selected date/shift/center (no server-side pagination)
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = date ? dayjs(date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      const params = { limit: 2000, date: dateStr };
      if (shift)  params.shift            = shift;
      if (center) params.collectionCenter = center;

      const salesParams = { limit: 1000, date: dateStr };
      if (shift) salesParams.session = shift;

      const [collRes, salesRes] = await Promise.all([
        milkCollectionAPI.getAll(params),
        milkSalesAPI.getAll(salesParams).catch(() => ({ data: [] })),
      ]);

      setRecords(collRes?.data || []);

      const salesList = salesRes?.data || [];
      const sm = {
        local:  { qty: 0, amt: 0 },
        credit: { qty: 0, amt: 0 },
        school: { qty: 0, amt: 0 },
        sample: { qty: 0, amt: 0 },
      };
      salesList.forEach(s => {
        const mode = (s.saleMode || '').toUpperCase();
        const key = mode === 'LOCAL' ? 'local' : mode === 'CREDIT' ? 'credit' : mode === 'SCHOOL' ? 'school' : mode === 'SAMPLE' ? 'sample' : null;
        if (key) { sm[key].qty += (s.litre || 0); sm[key].amt += (s.amount || 0); }
      });
      setSalesSummary(sm);

      setPage(1);
    } catch (err) {
      notifications.show({ message: err?.message || 'Failed to load records', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [date, shift, center]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── Client-side search filter ──────────────────────────────────────────────
  const filteredRecords = search.trim()
    ? records.filter(r => {
        const q = search.trim().toLowerCase();
        return r.farmerNumber?.toLowerCase().includes(q) ||
               r.farmerName?.toLowerCase().includes(q);
      })
    : records;

  // ── Client-side sort ───────────────────────────────────────────────────────
  const getSortedRecords = (list) => {
    const { columnAccessor: col, direction: dir } = sortStatus;
    if (!col) return list;
    const d = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let av, bv;
      if (col === 'billNo')     { av = a.billNo;        bv = b.billNo; }
      else if (col === 'date')  { av = new Date(a.date||0); bv = new Date(b.date||0); }
      else if (col === 'shift') { av = a.shift;         bv = b.shift; }
      else if (col === 'farmer') {
        const na = parseInt(a.farmerNumber, 10);
        const nb = parseInt(b.farmerNumber, 10);
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * d;
        return String(a.farmerNumber || '').localeCompare(String(b.farmerNumber || '')) * d;
      }
      else if (col === 'qty')      { av = a.qty    ?? 0; bv = b.qty    ?? 0; }
      else if (col === 'fat')      { av = a.fat    ?? 0; bv = b.fat    ?? 0; }
      else if (col === 'clr')      { av = a.clr    ?? 0; bv = b.clr    ?? 0; }
      else if (col === 'snf')      { av = a.snf    ?? 0; bv = b.snf    ?? 0; }
      else if (col === 'rate')     { av = a.rate   ?? 0; bv = b.rate   ?? 0; }
      else if (col === 'incentive'){ av = a.incentive ?? 0; bv = b.incentive ?? 0; }
      else if (col === 'amount')   { av = a.amount ?? 0; bv = b.amount ?? 0; }
      else return 0;
      if (av == null) return d; if (bv == null) return -d;
      if (typeof av === 'string') return av.localeCompare(bv) * d;
      return (av > bv ? 1 : av < bv ? -1 : 0) * d;
    });
  };

  const sortedRecords = getSortedRecords(filteredRecords);
  const totalPages    = Math.ceil(sortedRecords.length / PAGE_SIZE);
  const pagedRecords  = sortedRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Stats — always from ALL records (not filtered/paged) ──────────────────
  const totalQty = records.reduce((s, r) => s + (r.qty    || 0), 0);
  const totalAmt = records.reduce((s, r) => s + (r.amount || 0), 0);
  const avgFat   = records.length ? records.reduce((s, r) => s + (r.fat || 0), 0) / records.length : 0;
  const avgClr   = records.length ? records.reduce((s, r) => s + (r.clr || 0), 0) / records.length : 0;
  const avgSnf   = records.length ? records.reduce((s, r) => s + (r.snf || 0), 0) / records.length : 0;
  const amCount     = records.filter(r => r.shift === 'AM').length;
  const pmCount     = records.filter(r => r.shift === 'PM').length;
  const memberCount    = records.filter(r => r.isMembership !== false).length;
  const nonMemberCount = records.filter(r => r.isMembership === false).length;

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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const companyName = selectedCompany?.name || 'Dairy Cooperative Society';
  const dateLabel   = dayjs(date).format('DD MMM YYYY');
  const shiftLabel  = shift ? `${shift} Shift` : 'All Shifts';
  const centerLabel = centers.find(c => c.value === center)?.label || 'All Centers';

  // ── Excel Export ───────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!records.length) {
      notifications.show({ message: 'No records to export', color: 'yellow' });
      return;
    }

    const exportList = getSortedRecords(records);
    const rows = [
      [companyName],
      [`Daily Milk Collection Register — ${dateLabel} · ${shiftLabel}`],
      [`Center: ${centerLabel}`],
      [],
      ['Sl', 'Bill No', 'Date', 'Shift', 'Farmer No', 'Farmer Name', 'Qty (L)', 'FAT %', 'CLR', 'SNF %', 'Rate (₹)', 'Incentive (₹)', 'Amount (₹)'],
      ...exportList.map((r, i) => [
        i + 1, r.billNo,
        dayjs(r.date).format('DD/MM/YYYY'), r.shift,
        r.farmerNumber, r.farmerName || '',
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
        parseFloat(totalQty.toFixed(2)), '', '', '', '', '',
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

    const exportList = getSortedRecords(records);
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw  = doc.internal.pageSize.width;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(companyName, pw / 2, 13, { align: 'center' });
    doc.setFontSize(11);
    doc.text('Daily Milk Collection Register', pw / 2, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`Date: ${dateLabel}   Shift: ${shiftLabel}   Center: ${centerLabel}`, pw / 2, 27, { align: 'center' });
    doc.text(`Printed: ${dayjs().format('DD MMM YYYY HH:mm')}`, pw / 2, 33, { align: 'center' });

    autoTable(doc, {
      startY: 37,
      head: [['Sl', 'Bill No', 'Date', 'Shift', 'Farmer No', 'Farmer Name', 'Qty(L)', 'FAT%', 'CLR', 'SNF%', 'Rate', 'Incentive', 'Amount']],
      body: [
        ...exportList.map((r, i) => [
          i + 1, r.billNo,
          dayjs(r.date).format('DD/MM/YY'), r.shift,
          r.farmerNumber, r.farmerName || '—',
          (r.qty       || 0).toFixed(2),
          (r.fat       || 0).toFixed(2),
          (r.clr       || 0).toFixed(1),
          (r.snf       || 0).toFixed(2),
          `₹${(r.rate      || 0).toFixed(2)}`,
          `₹${(r.incentive || 0).toFixed(2)}`,
          `₹${(r.amount    || 0).toFixed(2)}`,
        ]),
        [
          { content: 'TOTAL', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: totalQty.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: avgFat.toFixed(2),   styles: { fontStyle: 'bold', halign: 'right' } },
          { content: avgClr.toFixed(1),   styles: { fontStyle: 'bold', halign: 'right' } },
          { content: avgSnf.toFixed(2),   styles: { fontStyle: 'bold', halign: 'right' } },
          '', '',
          { content: `₹${totalAmt.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } },
        ],
      ],
      styles:      { fontSize: 8, cellPadding: 2 },
      headStyles:  { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
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
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(7); doc.setTextColor(150);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, pw / 2, doc.internal.pageSize.height - 5, { align: 'center' });
      },
    });

    doc.save(`Daily_Collection_${dayjs(date).format('YYYY-MM-DD')}_${shift || 'ALL'}.pdf`);
    notifications.show({ message: 'PDF exported successfully', color: 'green' });
  };

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!records.length) {
      notifications.show({ message: 'No records to print', color: 'yellow' });
      return;
    }

    const printList  = getSortedRecords(records);
    const members    = printList.filter(r => r.isMembership !== false);
    const nonMembers = printList.filter(r => r.isMembership === false);
    const totalLtr   = printList.reduce((s, r) => s + (r.qty || 0), 0);
    const totalAmt_  = printList.reduce((s, r) => s + (r.amount || 0), 0);
    const mLtr       = members.reduce((s, r) => s + (r.qty || 0), 0);
    const mAmt       = members.reduce((s, r) => s + (r.amount || 0), 0);
    const nmLtr      = nonMembers.reduce((s, r) => s + (r.qty || 0), 0);
    const nmAmt      = nonMembers.reduce((s, r) => s + (r.amount || 0), 0);

    const buildColRows = (list) => list.map((r, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td class="c">${(r.farmerNumber || '')}</td>
      <td class="l">${(r.farmerName || '').substring(0, 11)}</td>
      <td class="r">${(r.fat  || 0).toFixed(2)}</td>
      <td class="r">${(r.clr  || 0).toFixed(1)}</td>
      <td class="r">${(r.snf  || 0).toFixed(2)}</td>
      <td class="r">${(r.qty  || 0).toFixed(2)}</td>
      <td class="r">${(r.rate || 0).toFixed(2)}</td>
      <td class="r bold">${(r.amount || 0).toFixed(2)}</td>
    </tr>`).join('');

    const colPanel = (title, list, ltr, amt, isNm) => {
      if (!list.length) return `
        <div class="panel">
          <div class="panel-hdr ${isNm ? 'nm' : ''}">${title} (0)</div>
          <p style="font-size:8px;text-align:center;padding:4px;color:#888;">No records</p>
        </div>`;
      return `
        <div class="panel">
          <div class="panel-hdr ${isNm ? 'nm' : ''}">${title} (${list.length})</div>
          <table>
            <thead><tr>
              <th class="c" style="width:14px">Sl</th>
              <th class="c" style="width:20px">F.No</th>
              <th class="l" style="width:36px">Name</th>
              <th class="r" style="width:15px">FAT</th>
              <th class="r" style="width:13px">CLR</th>
              <th class="r" style="width:15px">SNF</th>
              <th class="r" style="width:17px">Ltr</th>
              <th class="r" style="width:16px">Rate</th>
              <th class="r" style="width:22px">Amt</th>
            </tr></thead>
            <tbody>
              ${buildColRows(list)}
              <tr class="sub">
                <td colspan="6" class="r bold">Sub Total :</td>
                <td class="r bold">${ltr.toFixed(2)}</td>
                <td></td>
                <td class="r bold">${amt.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    };

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Milk Purchase Report</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; padding:6px; }
  .paper { background:#fff; font-family:'Courier New',monospace; font-size:8px; color:#1a1a1a; width:194mm; }
  .hdr { text-align:center; margin-bottom:2mm; }
  .hdr .society { font-size:13px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
  .hdr .addr    { font-size:8px; margin-top:1px; }
  .dash { border:none; border-top:1.5px dashed #444; margin:1.5mm 0; }
  .title-line { text-align:center; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; text-decoration:underline; margin:1.5mm 0; }
  .meta { font-size:8px; margin-bottom:2mm; }
  .meta span { margin-right:5mm; }
  /* ── Two-column layout ── */
  .two-col { display:flex; gap:2mm; align-items:flex-start; }
  .panel { flex:1; min-width:0; }
  .col-sep { width:1px; background:#aaa; align-self:stretch; flex-shrink:0; }
  .panel-hdr { font-weight:700; font-size:8px; letter-spacing:0.8px; text-transform:uppercase;
               padding:2px 4px; text-align:center; border:1.5px solid #333;
               background:#dbeafe; color:#1a3c6e; margin-bottom:1px; }
  .panel-hdr.nm { background:#f3f4f6; color:#374151; }
  table { width:100%; border-collapse:collapse; font-size:7.5px; }
  thead tr th { border-top:1px solid #333; border-bottom:1px solid #555; padding:1.5px 2px;
                font-weight:700; font-size:7px; letter-spacing:0.2px; text-transform:uppercase; }
  tbody tr td { padding:1px 2px; border-bottom:1px dotted #ccc; }
  tbody tr:nth-child(odd) td { background:#f7f7f7; }
  .sub td { border-top:1px solid #555; font-weight:700; font-size:7.5px; background:#e5e7eb; }
  /* ── Grand total ── */
  .grand-row { margin-top:2mm; }
  .grand-row table { font-size:8.5px; }
  .grand td { border-top:2px solid #333; border-bottom:1.5px solid #333; font-weight:700; font-size:9px; background:#d1fae5; padding:2px 3px; }
  /* ── Summary ── */
  .summary { margin-top:2mm; font-size:8px; }
  .summary .dash2 { border:none; border-top:1px solid #555; margin:1.5mm 0; }
  .summary-row { display:flex; justify-content:space-between; padding:1px 0; }
  .summary-row .lbl { width:55mm; }
  .summary-row .val  { font-weight:700; text-align:right; width:28mm; }
  .summary-row .val2 { font-weight:700; text-align:right; width:28mm; }
  .sig { margin-top:5mm; display:flex; justify-content:space-between; font-size:8px; }
  .sig div { border-top:1px solid #555; width:55mm; text-align:center; padding-top:1mm; }
  .printed { text-align:center; font-size:7px; margin-top:3mm; color:#6b7280; }
  .c { text-align:center; } .r { text-align:right; } .l { text-align:left; } .bold { font-weight:700; }
  @media print { body { padding:0; } }
</style>
</head>
<body>
<div class="paper">
  <div class="hdr">
    <div class="society">${companyName}</div>
    ${centerLabel !== 'All Centers' ? `<div class="addr">${centerLabel}</div>` : ''}
  </div>
  <hr class="dash"/>
  <div class="title-line">*** MILK PURCHASE REPORT ***</div>
  <hr class="dash"/>
  <div class="meta">
    <span>Date : ${dayjs(date).format('DD/MM/YYYY')}</span>
    <span>Shift : ${shiftLabel}</span>
    <span>Members : ${members.length}</span>
    <span>Non-Members : ${nonMembers.length}</span>
    <span>Total : ${printList.length}</span>
  </div>

  <div class="two-col">
    ${colPanel('MEMBER LIST', members, mLtr, mAmt, false)}
    <div class="col-sep"></div>
    ${colPanel('NON-MEMBER LIST', nonMembers, nmLtr, nmAmt, true)}
  </div>

  <div class="grand-row">
    <table>
      <tbody>
        <tr class="grand">
          <td style="width:60%" class="r">TOTAL PURCHASE (${printList.length} entries) :</td>
          <td style="width:15%" class="r">${totalLtr.toFixed(2)} L</td>
          <td style="width:25%" class="r bold">Rs. ${totalAmt_.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="summary">
    <hr class="dash2"/>
    <div class="summary-row">
      <span class="lbl">Total Purchase (Litre)</span>
      <span class="val">${totalLtr.toFixed(3)} L</span>
      <span class="val2">Rs. ${totalAmt_.toFixed(2)}</span>
    </div>
    <div class="summary-row"><span class="lbl">Milk Sales — Local</span><span class="val">${salesSummary.local.qty.toFixed(3)} L</span><span class="val2">Rs. ${salesSummary.local.amt.toFixed(2)}</span></div>
    <div class="summary-row"><span class="lbl">Milk Sales — Sample</span><span class="val">${salesSummary.sample.qty.toFixed(3)} L</span><span class="val2">Rs. ${salesSummary.sample.amt.toFixed(2)}</span></div>
    <div class="summary-row"><span class="lbl">Milk Sales — School / Credit</span><span class="val">${(salesSummary.school.qty + salesSummary.credit.qty).toFixed(3)} L</span><span class="val2">Rs. ${(salesSummary.school.amt + salesSummary.credit.amt).toFixed(2)}</span></div>
    <hr class="dash2"/>
    <div class="summary-row bold">
      <span class="lbl">Send to Dairy (Milma)</span>
      <span class="val">${(totalLtr - salesSummary.local.qty - salesSummary.sample.qty - salesSummary.school.qty - salesSummary.credit.qty).toFixed(3)} L</span>
      <span class="val2"></span>
    </div>
    <hr class="dash2"/>
    <div style="font-size:7.5px; color:#444;">
      Avg FAT: ${avgFat.toFixed(2)} &nbsp;|&nbsp; Avg CLR: ${avgClr.toFixed(1)} &nbsp;|&nbsp; Avg SNF: ${avgSnf.toFixed(2)} &nbsp;|&nbsp; AM: ${amCount} &nbsp;|&nbsp; PM: ${pmCount}
    </div>
  </div>
  <div class="sig">
    <div>Prepared By</div>
    <div>Checked By</div>
    <div>Secretary</div>
  </div>
  <div class="printed">Printed: ${dayjs().format('DD/MM/YYYY HH:mm')} &nbsp;|&nbsp; ${companyName}</div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400);</script>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">

      {/* ── Header ── */}
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={2} fw={700}>Daily Collection List</Title>
          <Text c="dimmed" size="sm">
            {dateLabel} · {shiftLabel} · {records.length} records
          </Text>
        </Box>
        <Group gap="xs">
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
              <Menu.Item leftSection={<IconFileTypeXls size={14} color="#217346" />} onClick={handleExportExcel}>
                Export Excel (.xlsx)
              </Menu.Item>
              <Menu.Item leftSection={<IconFileTypePdf size={14} color="#e53935" />} onClick={handleExportPDF}>
                Export PDF
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Print</Menu.Label>
              <Menu.Item leftSection={<IconPrinter size={14} />} onClick={handlePrint}>
                Print (A4 Portrait)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/daily-collections/milk-purchase')}>
            New Entry
          </Button>
          <Button leftSection={<IconX size={16} />} variant="default" onClick={() => navigate('/')}>
            Close
          </Button>
        </Group>
      </Group>

      {/* ── Stats — from ALL records ── */}
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
            onChange={v => { setDate(v); setPage(1); }}
            leftSection={<IconCalendar size={14} />}
            valueFormat="DD MMM YYYY"
            size="sm" style={{ width: 150 }}
          />
          <Select
            label="Shift"
            placeholder="All Shifts"
            data={[{ value: 'AM', label: '☀ AM Shift' }, { value: 'PM', label: '🌙 PM Shift' }]}
            value={shift}
            onChange={v => { setShift(v || ''); setPage(1); }}
            clearable size="sm" style={{ width: 140 }}
          />
          <Select
            label="Center"
            placeholder="All Centers"
            data={centers}
            value={center}
            onChange={v => { setCenter(v || ''); setPage(1); }}
            leftSection={<IconBuildingStore size={14} />}
            clearable searchable size="sm" style={{ width: 180 }}
          />
          <TextInput
            label="Search Farmer"
            placeholder="Farmer no. or name..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
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
              onClick={() => { setShift(''); setCenter(''); setSearch(''); setPage(1); }}
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
          records={pagedRecords}
          fetching={loading}
          minHeight={300}
          noRecordsText="No collection entries found for this date/shift"
          striped
          highlightOnHover
          sortStatus={sortStatus}
          onSortStatusChange={(s) => { setSortStatus(s); setPage(1); }}
          columns={[
            {
              accessor: 'billNo', title: 'Bill No', width: 130, sortable: true,
              render: r => <Text size="sm" fw={700} c="blue">{r.billNo}</Text>,
            },
            {
              accessor: 'date', title: 'Date', width: 110, sortable: true,
              render: r => <Text size="sm">{dayjs(r.date).format('DD MMM YY')}</Text>,
            },
            {
              accessor: 'shift', title: 'Shift', width: 80, sortable: true,
              render: r => (
                <Badge size="sm" color={r.shift === 'AM' ? 'yellow' : 'indigo'} variant="light">
                  {r.shift === 'AM' ? '☀ AM' : '🌙 PM'}
                </Badge>
              ),
            },
            {
              accessor: 'farmer', title: 'Farmer', sortable: true,
              render: r => (
                <Box>
                  <Group gap={4} wrap="nowrap">
                    <Badge size="xs" color="green" variant="filled" radius="sm">{r.farmerNumber}</Badge>
                    <Badge size="xs" color={r.isMembership !== false ? 'blue' : 'gray'} variant="light" radius="sm">
                      {r.isMembership !== false ? 'Member' : 'Non-Member'}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={1}>{r.farmerName || '—'}</Text>
                </Box>
              ),
            },
            {
              accessor: 'qty', title: 'Qty (L)', width: 80, textAlign: 'right', sortable: true,
              render: r => <Text size="sm" fw={700} c="blue">{(r.qty || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'fat', title: 'FAT %', width: 75, textAlign: 'right', sortable: true,
              render: r => <Text size="sm" fw={600} c="orange">{(r.fat || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'clr', title: 'CLR', width: 70, textAlign: 'right', sortable: true,
              render: r => <Text size="sm" c="violet">{(r.clr || 0).toFixed(1)}</Text>,
            },
            {
              accessor: 'snf', title: 'SNF %', width: 75, textAlign: 'right', sortable: true,
              render: r => <Text size="sm" c="green">{(r.snf || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'rate', title: 'Rate', width: 80, textAlign: 'right', sortable: true,
              render: r => <Text size="sm" fw={600}>₹{(r.rate || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'incentive', title: 'Incentive', width: 85, textAlign: 'right', sortable: true,
              render: r => <Text size="sm" c="teal">₹{(r.incentive || 0).toFixed(2)}</Text>,
            },
            {
              accessor: 'amount', title: 'Amount', width: 100, textAlign: 'right', sortable: true,
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
      </Paper>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            total={totalPages}
            value={page}
            onChange={setPage}
          />
        </Group>
      )}

      {/* ── ONE global summary — always from ALL records, never per-page ── */}
      {records.length > 0 && (
        <Box mt="md" style={{ background: 'linear-gradient(90deg,#e8eaf6,#e3f2fd)', borderRadius: 8, border: '2px solid #90caf9', padding: '10px 16px' }}>
          <Group gap="xl" wrap="wrap">
            <Text size="xs" fw={800} c="dark.4" tt="uppercase" style={{ letterSpacing: '0.4px' }}>
              Total Summary ({records.length} records)
            </Text>
            <Divider orientation="vertical" />
            {[
              { label: 'Total Entries', val: records.length,                    c: 'blue'   },
              { label: 'Total Qty',     val: `${totalQty.toFixed(2)} L`,        c: 'blue'   },
              { label: 'Total Amount',  val: `₹${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, c: 'green.8' },
              { label: 'Avg FAT %',     val: avgFat.toFixed(2),                 c: 'orange' },
              { label: 'Avg CLR',       val: avgClr.toFixed(1),                 c: 'violet' },
              { label: 'Avg SNF %',     val: avgSnf.toFixed(2),                 c: 'green'  },
              { label: 'AM Entries',    val: amCount,                            c: 'yellow.7' },
              { label: 'PM Entries',    val: pmCount,                            c: 'indigo' },
              { label: 'Members',       val: memberCount,                        c: 'blue'   },
              { label: 'Non-Members',   val: nonMemberCount,                     c: 'gray'   },
            ].map(({ label, val, c }) => (
              <Box key={label} ta="center">
                <Text size="9px" c="dimmed" tt="uppercase">{label}</Text>
                <Text size="sm" fw={800} c={c}>{val}</Text>
              </Box>
            ))}
          </Group>
        </Box>
      )}

    </Container>
  );
};

export default DailyCollectionList;
