import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Box, Group, Text, Button, Badge, Paper, Stack, Title,
  SimpleGrid, SegmentedControl, Loader, Center, ThemeIcon,
  Divider, ActionIcon, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconArrowLeft, IconRefresh, IconPrinter, IconFileTypePdf,
  IconFileTypeCsv, IconMilk, IconUsers, IconUser,
  IconCurrencyRupee, IconDroplet, IconChartBar,
  IconSchool, IconShoppingCart, IconBuildingStore, IconFlask,
  IconCalendar, IconTrendingUp,
} from '@tabler/icons-react';
import { milkCollectionAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { localDateStr } from '../../utils/dateUtils';
import './MilkPurchaseReport.css';

// ── Formatters ──────────────────────────────────────────────────────────────
const f2  = v => Number(v || 0).toFixed(2);
const f3  = v => Number(v || 0).toFixed(3);
const fz2 = v => { const n = Number(v || 0); return n === 0 ? '' : n.toFixed(2); };
const fz3 = v => { const n = Number(v || 0); return n === 0 ? '' : n.toFixed(3); };
const fmtDate = d => { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const dayName = d => { if (!d) return ''; return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d).getDay()]; };
const toISO = d => d instanceof Date ? localDateStr(d) : d;

// ── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, color = '#1c3d6e' }) => (
  <Paper withBorder radius="sm" p="sm" style={{ borderLeft: `4px solid ${color}`, borderTop: 'none', borderRight: 'none', borderBottom: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={2}>
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" lh={1.2} style={{ letterSpacing: '0.4px' }}>{label}</Text>
        <Text fw={900} size="lg" style={{ color, lineHeight: 1.1 }}>{value}</Text>
        {sub && <Text size="xs" c="dimmed" fw={500}>{sub}</Text>}
      </Stack>
      <ThemeIcon variant="light" size={38} radius="md" style={{ background: `${color}18`, color, flexShrink: 0 }}>
        <Icon size={20} />
      </ThemeIcon>
    </Group>
  </Paper>
);

export default function MilkPurchaseReport() {
  const navigate    = useNavigate();
  const { company } = useCompany();
  const printRef    = useRef(null);

  const today        = localDateStr(new Date());
  const firstOfMonth = today.slice(0, 8) + '01';

  const [tab,          setTab]          = useState('date');
  const [farmerFilter, setFarmerFilter] = useState('all');
  const [fromDate,     setFromDate]     = useState(new Date(firstOfMonth));
  const [toDate,       setToDate]       = useState(new Date(today));
  const [loading,      setLoading]      = useState(false);
  const [rows,         setRows]         = useState([]);
  const [loaded,       setLoaded]       = useState(false);
  const [errMsg,       setErrMsg]       = useState('');

  const handleLoad = async () => {
    setLoading(true); setErrMsg(''); setRows([]);
    try {
      const params = { fromDate: toISO(fromDate), toDate: toISO(toDate) };
      const res = tab === 'farmer'
        ? await milkCollectionAPI.getFarmerWiseSummary(params)
        : await milkCollectionAPI.getDateWiseSummary(params);
      if (res?.success) { setRows(res.data || []); setLoaded(true); }
      else setErrMsg(res?.message || 'Failed to load data');
    } catch (e) {
      setErrMsg(e.message || 'Error loading data');
    } finally { setLoading(false); }
  };

  const switchTab = t => { setTab(t); setRows([]); setLoaded(false); setErrMsg(''); setFarmerFilter('all'); };

  // ── Aggregated Totals ──────────────────────────────────────────────────────
  const totals = rows.reduce((acc, r) => {
    if (tab === 'farmer') {
      acc.totalEntries   += r.totalEntries   || 0;
      acc.amEntries      += r.amEntries      || 0;
      acc.pmEntries      += r.pmEntries      || 0;
      acc.totalQty       += r.totalQty       || 0;
      acc.totalIncentive += r.totalIncentive || 0;
      acc.totalAmount    += r.totalAmount    || 0;
      acc.memCount       += r.isMember ? 1 : 0;
      acc.nonMemCount    += r.isMember ? 0 : 1;
    } else {
      acc.memNos    += r.memNos    || 0;
      acc.memQty    += Number(r.memQty    || 0);
      acc.memAmt    += Number(r.memAmt    || 0);
      acc.nonMemNos += r.nonMemNos || 0;
      acc.nonMemQty += Number(r.nonMemQty || 0);
      acc.nonMemAmt += Number(r.nonMemAmt || 0);
      acc.totalNos  += r.totalNos  || 0;
      acc.totalQty  += Number(r.totalQty  || 0);
      acc.totalAmt  += Number(r.totalAmt  || 0);
      acc.localQty  += Number(r.localQty  || 0);
      acc.localAmt  += Number(r.localAmt  || 0);
      acc.creditQty += Number(r.creditQty || 0);
      acc.creditAmt += Number(r.creditAmt || 0);
      acc.schoolQty += Number(r.schoolQty || 0);
      acc.schoolAmt += Number(r.schoolAmt || 0);
      acc.sampleQty += Number(r.sampleQty || 0);
      acc.sampleAmt += Number(r.sampleAmt || 0);
    }
    return acc;
  }, {
    totalEntries: 0, amEntries: 0, pmEntries: 0, totalQty: 0, totalIncentive: 0, totalAmount: 0,
    memCount: 0, nonMemCount: 0,
    memNos: 0, memQty: 0, memAmt: 0,
    nonMemNos: 0, nonMemQty: 0, nonMemAmt: 0,
    totalNos: 0, totalAmt: 0,
    localQty: 0, localAmt: 0, creditQty: 0, creditAmt: 0,
    schoolQty: 0, schoolAmt: 0, sampleQty: 0, sampleAmt: 0,
  });

  const avgRate = tab === 'farmer'
    ? (totals.totalQty > 0 ? totals.totalAmount / totals.totalQty : 0)
    : (totals.totalQty > 0 ? totals.totalAmt    / totals.totalQty : 0);

  const societyName = company?.name || 'Dairy Society';
  const fromISO     = toISO(fromDate);
  const toISO_      = toISO(toDate);
  const periodLabel = `${fmtDate(fromISO)} to ${fmtDate(toISO_)}`;

  // Farmer-wise splits
  const memberRows    = rows.filter(r => r.isMember);
  const nonMemberRows = rows.filter(r => !r.isMember);

  const sumGroup = list => list.reduce((acc, r) => ({
    entries:   acc.entries   + (r.totalEntries   || 0),
    amEntries: acc.amEntries + (r.amEntries      || 0),
    pmEntries: acc.pmEntries + (r.pmEntries      || 0),
    qty:       acc.qty       + (r.totalQty       || 0),
    incentive: acc.incentive + (r.totalIncentive || 0),
    amount:    acc.amount    + (r.totalAmount    || 0),
  }), { entries: 0, amEntries: 0, pmEntries: 0, qty: 0, incentive: 0, amount: 0 });

  const memberTotals    = sumGroup(memberRows);
  const nonMemberTotals = sumGroup(nonMemberRows);

  // ── shared print style strings (must be before handlePrint) ──────────────────
  const thS    = 'background:#1c3d6e;color:#fff;border:1px solid #1c3d6e;padding:2px 4px;text-align:center;text-transform:uppercase;font-size:7px;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const thGS   = 'background:#2d5a9e;color:#fff;border:1px solid #2d5a9e;padding:2px 4px;text-align:center;font-size:7px;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const thSS   = 'background:#e8edf5;color:#1c3d6e;border:1px solid #c0cfe6;padding:2px 4px;text-align:center;font-size:6.5px;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const tdC    = 'border:1px solid #ccc;padding:2px 4px;text-align:center;font-size:8px;';
  const tdR    = 'border:1px solid #ccc;padding:2px 4px;text-align:right;font-size:8px;';
  const tdCB   = 'border:1px solid #ccc;padding:2px 4px;text-align:center;font-weight:700;font-size:8px;';
  const tdRB   = 'border:1px solid #ccc;padding:2px 4px;text-align:right;font-weight:700;font-size:8px;';
  const tdTot  = 'border:1px solid #1c3d6e;padding:2px 4px;text-align:center;background:#1c3d6e;color:#fff;font-weight:800;font-size:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const tdTotR = 'border:1px solid #1c3d6e;padding:2px 4px;text-align:right;background:#1c3d6e;color:#fff;font-weight:800;font-size:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const secHdr = 'padding:4px 6px;font-weight:800;font-size:8.5px;text-transform:uppercase;letter-spacing:0.5px;border-top:2px solid #1c3d6e;color:#1c3d6e;background:#f0f4fb;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const subHdr = 'border:1px solid #ccc;padding:2px 4px;background:#e8edf5;font-weight:800;font-size:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact';

  // ── Print (programmatic HTML) ──────────────────────────────────────────────
  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow popups for this site to use Print.'); return; }

    const filterLabel = farmerFilter === 'member' ? ' — Members Only'
      : farmerFilter === 'nonmember' ? ' — Non-Members Only' : '';

    const hdrHtml = `
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:5px;margin-bottom:8px">
        <div style="font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px">${societyName}</div>
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;margin-top:2px">Milk Purchase Report${tab === 'farmer' ? filterLabel : ''}</div>
        <div style="display:flex;justify-content:space-between;font-size:8.5px;font-weight:600;margin-top:4px;border-top:1px solid #ccc;padding-top:3px">
          <span>Period: ${periodLabel}</span>
          <span>Mode: ${tab === 'farmer' ? 'Farmer-wise Summary' : 'Date-wise Summary'}</span>
          <span>Generated: ${fmtDate(today)}</span>
        </div>
      </div>`;

    let tableHtml = '';
    if (tab === 'date') {
      tableHtml = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th rowspan="2" style="${thS}">Date</th>
              <th rowspan="2" style="${thS}">Day</th>
              <th colspan="3" style="${thGS}">Member Purchase</th>
              <th colspan="3" style="${thGS}">Non-Member Purchase</th>
              <th colspan="4" style="${thGS}">Total Purchase</th>
              <th colspan="2" style="${thGS}">Local Sales</th>
              <th colspan="2" style="${thGS}">Credit Sales</th>
              <th colspan="2" style="${thGS}">School Sales</th>
              <th colspan="2" style="${thGS}">Sample Sales</th>
            </tr>
            <tr>
              ${['Nos','Qty(L)','Amt(₹)','Nos','Qty(L)','Amt(₹)','Nos','Qty(L)','Amt(₹)','Rate','Ltr','Amt','Ltr','Amt','Ltr','Amt','Ltr','Amt'].map(h => `<th style="${thSS}">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td style="${tdCB}">${fmtDate(r.date)}</td>
              <td style="${tdC}">${dayName(r.date)}</td>
              <td style="${tdC}">${r.memNos}</td><td style="${tdR}">${fz3(r.memQty)}</td><td style="${tdR}">${fz2(r.memAmt)}</td>
              <td style="${tdC}">${r.nonMemNos||''}</td><td style="${tdR}">${fz3(r.nonMemQty)}</td><td style="${tdR}">${fz2(r.nonMemAmt)}</td>
              <td style="${tdCB}">${r.totalNos}</td><td style="${tdRB}">${f3(r.totalQty)}</td><td style="${tdRB}">${f2(r.totalAmt)}</td><td style="${tdR}">${f2(r.avgRate)}</td>
              <td style="${tdR}">${fz3(r.localQty)}</td><td style="${tdR}">${fz2(r.localAmt)}</td>
              <td style="${tdR}">${fz3(r.creditQty)}</td><td style="${tdR}">${fz2(r.creditAmt)}</td>
              <td style="${tdR}">${fz3(r.schoolQty)}</td><td style="${tdR}">${fz2(r.schoolAmt)}</td>
              <td style="${tdR}">${fz3(r.sampleQty)}</td><td style="${tdR}">${fz2(r.sampleAmt)}</td>
            </tr>`).join('')}
            <tr>
              <td colspan="2" style="${tdTot}">GRAND TOTAL</td>
              <td style="${tdTot}">${totals.memNos}</td><td style="${tdTotR}">${f3(totals.memQty)}</td><td style="${tdTotR}">${f2(totals.memAmt)}</td>
              <td style="${tdTot}">${totals.nonMemNos}</td><td style="${tdTotR}">${f3(totals.nonMemQty)}</td><td style="${tdTotR}">${f2(totals.nonMemAmt)}</td>
              <td style="${tdTot}">${totals.totalNos}</td><td style="${tdTotR}">${f3(totals.totalQty)}</td><td style="${tdTotR}">${f2(totals.totalAmt)}</td><td style="${tdTotR}">${f2(avgRate)}</td>
              <td style="${tdTotR}">${f3(totals.localQty)}</td><td style="${tdTotR}">${f2(totals.localAmt)}</td>
              <td style="${tdTotR}">${f3(totals.creditQty)}</td><td style="${tdTotR}">${f2(totals.creditAmt)}</td>
              <td style="${tdTotR}">${f3(totals.schoolQty)}</td><td style="${tdTotR}">${f2(totals.schoolAmt)}</td>
              <td style="${tdTotR}">${f3(totals.sampleQty)}</td><td style="${tdTotR}">${f2(totals.sampleAmt)}</td>
            </tr>
          </tbody>
        </table>`;
    } else {
      const fHead = `<tr>${['#','Farmer No','Farmer Name','AM','PM','Sessions','Qty (L)','Avg Fat','Avg CLR','Avg SNF','Avg Rate','Incentive','Amount (₹)'].map(h=>`<th style="${thS}">${h}</th>`).join('')}</tr>`;
      const fRows = (list, off) => list.map((r, i) => `<tr>
        <td style="${tdC}">${i+1+off}</td><td style="${tdC}">${r.farmerNo}</td>
        <td style="border:1px solid #ccc;padding:2px 4px;font-weight:600;font-size:8px">${r.farmerName}</td>
        <td style="${tdC}">${r.amEntries}</td><td style="${tdC}">${r.pmEntries}</td><td style="${tdCB}">${r.totalEntries}</td>
        <td style="${tdRB}">${f3(r.totalQty)}</td><td style="${tdC}">${f2(r.avgFat)}</td>
        <td style="${tdC}">${f2(r.avgClr||0)}</td><td style="${tdC}">${f2(r.avgSnf)}</td>
        <td style="${tdR}">${f2(r.avgRate)}</td><td style="${tdR}">${f2(r.totalIncentive)}</td>
        <td style="${tdRB}">${f2(r.totalAmount)}</td>
      </tr>`).join('');
      const subRow = (label, t) => `<tr>
        <td colspan="3" style="${subHdr};text-align:center;color:#1c3d6e">${label}</td>
        <td style="${subHdr};text-align:center">${t.amEntries}</td>
        <td style="${subHdr};text-align:center">${t.pmEntries}</td>
        <td style="${subHdr};text-align:center">${t.entries}</td>
        <td style="${subHdr};text-align:right">${f3(t.qty)}</td>
        <td colspan="3" style="${subHdr};text-align:center">—</td>
        <td style="${subHdr};text-align:right">${t.qty>0?f2(t.amount/t.qty):'—'}</td>
        <td style="${subHdr};text-align:right">${f2(t.incentive)}</td>
        <td style="${subHdr};text-align:right">${f2(t.amount)}</td>
      </tr>`;
      const grandTotRow = `<tr>
        <td colspan="3" style="${tdTot}">GRAND TOTAL — ${totals.memCount}M / ${totals.nonMemCount}NM</td>
        <td style="${tdTot}">${totals.amEntries}</td><td style="${tdTot}">${totals.pmEntries}</td><td style="${tdTot}">${totals.totalEntries}</td>
        <td style="${tdTotR}">${f3(totals.totalQty)}</td><td colspan="3" style="${tdTot}">—</td>
        <td style="${tdTotR}">${f2(avgRate)}</td><td style="${tdTotR}">${f2(totals.totalIncentive)}</td><td style="${tdTotR}">${f2(totals.totalAmount)}</td>
      </tr>`;

      const showMem    = farmerFilter !== 'nonmember';
      const showNonMem = farmerFilter !== 'member';

      tableHtml = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>${fHead}</thead>
          <tbody>
            ${showMem ? `
              <tr><td colspan="13" style="${secHdr}">Members (${memberRows.length})</td></tr>
              ${fRows(memberRows, 0)}
              ${subRow('Members Sub-Total', memberTotals)}
            ` : ''}
            ${showNonMem ? `
              <tr><td colspan="13" style="${secHdr}">Non-Members (${nonMemberRows.length})</td></tr>
              ${fRows(nonMemberRows, showMem ? memberRows.length : 0)}
              ${subRow('Non-Members Sub-Total', nonMemberTotals)}
            ` : ''}
            ${farmerFilter === 'all' ? grandTotRow : ''}
          </tbody>
        </table>`;
    }

    const footerHtml = `
      <div style="display:flex;justify-content:space-between;border-top:2px solid #000;margin-top:12px;padding-top:6px;font-size:8.5px">
        <div>
          <div>Society: <strong>${societyName}</strong></div>
          <div>Report Period: <strong>${periodLabel}</strong></div>
          <div>Total Records: <strong>${rows.length}</strong></div>
        </div>
        <div style="text-align:right;border-top:1.5px solid #000;padding-top:4px;min-width:160px;align-self:flex-end;font-weight:700">
          Secretary / Authorized Signatory<br/>
          <span style="font-size:8px;font-weight:400">Dairy Development Department</span>
        </div>
      </div>`;

    w.document.write(`<!DOCTYPE html><html><head><title>Milk Purchase Report</title>
      <style>
        *{box-sizing:border-box}
        body{margin:0;padding:5mm 7mm;font-family:Arial,sans-serif;font-size:8px;color:#000}
        @page{size:A4 landscape;margin:5mm 7mm}
      </style>
    </head><body>${hdrHtml}${tableHtml}${footerHtml}</body></html>`);
    w.document.close();
    w.focus();
    w.onload = () => { w.print(); };
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleCSV = () => {
    let csv = '';
    if (tab === 'farmer') {
      csv = 'S.No,Type,Farmer No,Farmer Name,AM,PM,Sessions,Qty (L),Avg Fat,Avg CLR,Avg SNF,Avg Rate,Incentive (₹),Amount (₹)\n';
      rows.forEach((r, i) => {
        csv += `${i+1},${r.isMember?'Member':'Non-Member'},${r.farmerNo},"${r.farmerName}",${r.amEntries},${r.pmEntries},${r.totalEntries},${f3(r.totalQty)},${f2(r.avgFat)},${f2(r.avgClr||0)},${f2(r.avgSnf)},${f2(r.avgRate)},${f2(r.totalIncentive)},${f2(r.totalAmount)}\n`;
      });
    } else {
      csv = 'Date,Day,Mem Nos,Mem Qty(L),Mem Amt,NonMem Nos,NonMem Qty(L),NonMem Amt,Total Nos,Total Qty(L),Total Amt,Avg Rate,Local Ltr,Local Amt,Credit Ltr,Credit Amt,School Ltr,School Amt,Sample Ltr,Sample Amt\n';
      rows.forEach(r => {
        csv += `${fmtDate(r.date)},${dayName(r.date)},${r.memNos},${f3(r.memQty)},${f2(r.memAmt)},${r.nonMemNos},${f3(r.nonMemQty)},${f2(r.nonMemAmt)},${r.totalNos},${f3(r.totalQty)},${f2(r.totalAmt)},${f2(r.avgRate)},${f3(r.localQty)},${f2(r.localAmt)},${f3(r.creditQty)},${f2(r.creditAmt)},${f3(r.schoolQty)},${f2(r.schoolAmt)},${f3(r.sampleQty)},${f2(r.sampleAmt)}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `MilkPurchaseReport_${fromISO}_${toISO_}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handlePDF = () => {
    const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 12;
    doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.setTextColor(28, 61, 110);
    doc.text(societyName.toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 6; doc.setFontSize(11); doc.setTextColor(0);
    doc.text('MILK PURCHASE REPORT', pageW / 2, y, { align: 'center' });
    y += 5; doc.setFontSize(8); doc.setFont(undefined, 'normal');
    doc.text(`Period: ${periodLabel}`, 14, y);
    doc.text(`Mode: ${tab === 'farmer' ? 'Farmer-wise' : 'Date-wise'}`, pageW - 14, y, { align: 'right' });
    y += 3; doc.setDrawColor(28, 61, 110); doc.setLineWidth(0.5); doc.line(14, y, pageW - 14, y); y += 4;

    const H = [28, 61, 110]; const S = [45, 90, 158]; const L = [232, 237, 245];
    const hS = { fillColor: H, textColor: 255, fontStyle: 'bold' };
    const bS = { fontSize: 6, cellPadding: 1.2, halign: 'center' };

    if (tab === 'farmer') {
      const head = [['#','Farmer No','Farmer Name','AM','PM','Sessions','Qty (L)','Fat','CLR','SNF','Rate','Incentive','Amount (₹)']];
      const mkRows = (list, off) => list.map((r, i) => [
        i+1+off, r.farmerNo, r.farmerName, r.amEntries, r.pmEntries, r.totalEntries,
        f3(r.totalQty), f2(r.avgFat), f2(r.avgClr||0), f2(r.avgSnf), f2(r.avgRate), f2(r.totalIncentive), f2(r.totalAmount)
      ]);
      const subRow = (label, t) => [label,'','',t.amEntries,t.pmEntries,t.entries,f3(t.qty),'','','',t.qty>0?f2(t.amount/t.qty):'—',f2(t.incentive),f2(t.amount)];

      doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(...H);
      doc.text(`MEMBERS (${memberRows.length})`, 14, y); y += 3;
      autoTable(doc, {
        startY: y, head, styles: bS, headStyles: hS,
        columnStyles: { 2: { halign: 'left' } },
        body: [...mkRows(memberRows, 0), subRow('Members Sub-Total', memberTotals)],
        didParseCell: d => { if (d.row.index === memberRows.length) { d.cell.styles.fillColor = L; d.cell.styles.textColor = H; d.cell.styles.fontStyle = 'bold'; } },
      });
      y = doc.lastAutoTable.finalY + 5;
      doc.setTextColor(...H); doc.text(`NON-MEMBERS (${nonMemberRows.length})`, 14, y); y += 3;
      autoTable(doc, {
        startY: y, head, styles: bS, headStyles: hS,
        columnStyles: { 2: { halign: 'left' } },
        body: [...mkRows(nonMemberRows, memberRows.length), subRow('Non-Members Sub-Total', nonMemberTotals)],
        didParseCell: d => { if (d.row.index === nonMemberRows.length) { d.cell.styles.fillColor = L; d.cell.styles.textColor = H; d.cell.styles.fontStyle = 'bold'; } },
      });
      y = doc.lastAutoTable.finalY + 3;
      autoTable(doc, {
        startY: y, styles: { ...bS, fillColor: H, textColor: 255, fontStyle: 'bold' },
        columnStyles: { 2: { halign: 'left' } },
        body: [[`GRAND TOTAL — ${totals.memCount}M / ${totals.nonMemCount}NM`,'','',
          totals.amEntries,totals.pmEntries,totals.totalEntries,
          f3(totals.totalQty),'','','',f2(avgRate),f2(totals.totalIncentive),f2(totals.totalAmount)]],
      });
    } else {
      autoTable(doc, {
        startY: y,
        head: [['Date','Day','Mem\nNos','Mem\nQty(L)','Mem\nAmt','NM\nNos','NM\nQty(L)','NM\nAmt','Tot\nNos','Tot\nQty(L)','Tot\nAmt','Rate','Loc\nLtr','Loc\nAmt','Crd\nLtr','Crd\nAmt','Sch\nLtr','Sch\nAmt','Smp\nLtr','Smp\nAmt']],
        body: [
          ...rows.map(r => [fmtDate(r.date),dayName(r.date),r.memNos,f3(r.memQty),f2(r.memAmt),r.nonMemNos,f3(r.nonMemQty),f2(r.nonMemAmt),r.totalNos,f3(r.totalQty),f2(r.totalAmt),f2(r.avgRate),fz3(r.localQty),fz2(r.localAmt),fz3(r.creditQty),fz2(r.creditAmt),fz3(r.schoolQty),fz2(r.schoolAmt),fz3(r.sampleQty),fz2(r.sampleAmt)]),
          ['TOTAL','',totals.memNos,f3(totals.memQty),f2(totals.memAmt),totals.nonMemNos,f3(totals.nonMemQty),f2(totals.nonMemAmt),totals.totalNos,f3(totals.totalQty),f2(totals.totalAmt),f2(avgRate),f3(totals.localQty),f2(totals.localAmt),f3(totals.creditQty),f2(totals.creditAmt),f3(totals.schoolQty),f2(totals.schoolAmt),f3(totals.sampleQty),f2(totals.sampleAmt)],
        ],
        styles: bS, headStyles: hS,
        didParseCell: d => { if (d.section==='body' && d.row.index===rows.length) { d.cell.styles.fillColor=H; d.cell.styles.textColor=255; d.cell.styles.fontStyle='bold'; } },
      });
    }
    doc.save(`MilkPurchaseReport_${fromISO}_${toISO_}.pdf`);
  };

  // ── Farmer table head & rows ───────────────────────────────────────────────
  const FarmerHead = () => (
    <thead>
      <tr>
        <th style={{ width: 32 }}>#</th>
        <th>Farmer No</th>
        <th className="sub" style={{ textAlign: 'left', width: '30%' }}>Farmer Name</th>
        <th className="grp" colSpan={3}>Sessions</th>
        <th>Qty (L)</th>
        <th>Avg Fat</th>
        <th>Avg CLR</th>
        <th>Avg SNF</th>
        <th>Avg Rate</th>
        <th>Incentive (₹)</th>
        <th>Amount (₹)</th>
      </tr>
      <tr>
        <th className="sub" colSpan={3}></th>
        <th className="sub">AM</th>
        <th className="sub">PM</th>
        <th className="sub">Total</th>
        <th className="sub" colSpan={7}></th>
      </tr>
    </thead>
  );

  const FarmerRows = ({ list, offset }) => list.map((r, i) => (
    <tr key={r.farmerNo || i}>
      <td className="c">{i + 1 + offset}</td>
      <td className="c">{r.farmerNo}</td>
      <td className="nm l">{r.farmerName}</td>
      <td className="c">{r.amEntries}</td>
      <td className="c">{r.pmEntries}</td>
      <td className="c bold">{r.totalEntries}</td>
      <td className="r bold">{f3(r.totalQty)}</td>
      <td className="c">{f2(r.avgFat)}</td>
      <td className="c">{f2(r.avgClr || 0)}</td>
      <td className="c">{f2(r.avgSnf)}</td>
      <td className="r">{f2(r.avgRate)}</td>
      <td className="r">{f2(r.totalIncentive)}</td>
      <td className="r bold">{f2(r.totalAmount)}</td>
    </tr>
  ));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box style={{ background: '#f0f4fb', minHeight: '100vh', padding: '14px' }}>

      {/* ── Action Bar ── */}
      <Paper radius="sm" p="xs" mb="sm" withBorder style={{ borderColor: '#dde3ee', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm">
            <ActionIcon variant="subtle" color="dark" onClick={() => navigate(-1)} size="lg" radius="sm">
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Stack gap={0}>
              <Title order={5} style={{ color: '#1c3d6e', lineHeight: 1.2 }}>Milk Purchase Report</Title>
              {loaded && <Text size="xs" c="dimmed">{periodLabel} · {tab === 'farmer' ? 'Farmer-wise' : 'Date-wise'}</Text>}
            </Stack>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Button
              leftSection={<IconRefresh size={14} />}
              onClick={handleLoad} loading={loading} variant="filled"
              color="blue" size="xs" radius="sm"
            >Load</Button>
            <Button
              leftSection={<IconPrinter size={14} />}
              onClick={handlePrint} disabled={!loaded} variant="light"
              color="dark" size="xs" radius="sm"
            >Print</Button>
            <Button
              leftSection={<IconFileTypePdf size={14} />}
              onClick={handlePDF} disabled={!loaded} variant="light"
              color="violet" size="xs" radius="sm"
            >PDF</Button>
            <Button
              leftSection={<IconFileTypeCsv size={14} />}
              onClick={handleCSV} disabled={!loaded} variant="light"
              color="teal" size="xs" radius="sm"
            >CSV</Button>
          </Group>
        </Group>
      </Paper>

      {/* ── Filter Bar ── */}
      <Paper radius="sm" p="md" mb="sm" withBorder style={{ borderColor: '#dde3ee' }}>
        <Group align="flex-end" gap="xl" wrap="wrap">
          <Group gap="sm" align="flex-end">
            <DatePickerInput
              label="From Date" value={fromDate} onChange={setFromDate}
              valueFormat="DD/MM/YYYY" size="xs" radius="sm"
              leftSection={<IconCalendar size={14} />}
              style={{ minWidth: 145 }}
            />
            <DatePickerInput
              label="To Date" value={toDate} onChange={setToDate}
              valueFormat="DD/MM/YYYY" size="xs" radius="sm"
              leftSection={<IconCalendar size={14} />}
              style={{ minWidth: 145 }}
            />
          </Group>
          <div>
            <Text size="xs" fw={600} c="dimmed" mb={4} tt="uppercase" style={{ letterSpacing: '0.4px' }}>View Mode</Text>
            <SegmentedControl
              size="xs" radius="sm"
              value={tab}
              onChange={switchTab}
              data={[
                { label: 'Date-wise Summary',   value: 'date'   },
                { label: 'Farmer-wise Summary', value: 'farmer' },
              ]}
              styles={{ root: { background: '#e8edf5' } }}
            />
          </div>
          {tab === 'farmer' && loaded && (
            <div>
              <Text size="xs" fw={600} c="dimmed" mb={4} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Show</Text>
              <SegmentedControl
                size="xs" radius="sm"
                value={farmerFilter}
                onChange={setFarmerFilter}
                data={[
                  { label: `All (${rows.length})`,                value: 'all'    },
                  { label: `Members (${memberRows.length})`,      value: 'member' },
                  { label: `Non-Members (${nonMemberRows.length})`, value: 'nonmember' },
                ]}
                styles={{
                  root: { background: '#e8edf5' },
                  label: { fontWeight: 600 },
                }}
                color={farmerFilter === 'member' ? 'green' : farmerFilter === 'nonmember' ? 'red' : 'blue'}
              />
            </div>
          )}
        </Group>
      </Paper>

      {/* ── States ── */}
      {errMsg && (
        <Paper p="sm" mb="sm" radius="sm" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <Text size="sm" c="red" fw={600}>{errMsg}</Text>
        </Paper>
      )}
      {loading && (
        <Center py={60}><Stack align="center" gap="xs">
          <Loader size="md" color="blue" /><Text size="sm" c="dimmed">Loading data…</Text>
        </Stack></Center>
      )}
      {!loaded && !loading && !errMsg && (
        <Center py={60}><Stack align="center" gap="xs">
          <ThemeIcon size={56} variant="light" color="blue" radius="xl"><IconMilk size={28} /></ThemeIcon>
          <Text size="sm" c="dimmed">Select date range and click <strong>Load</strong> to generate the report.</Text>
        </Stack></Center>
      )}
      {loaded && rows.length === 0 && (
        <Center py={60}><Text size="sm" c="dimmed">No records found for the selected period.</Text></Center>
      )}

      {/* ── Report Body ── */}
      {loaded && rows.length > 0 && (
        <Paper ref={printRef} radius="sm" p="xl" withBorder style={{ borderColor: '#dde3ee', boxShadow: '0 4px 20px rgba(28,61,110,0.08)' }}>

          {/* ── Report Header ── */}
          <Box
            p="md" mb="lg" style={{
              background: 'linear-gradient(135deg, #1c3d6e 0%, #2d5a9e 100%)',
              borderRadius: 8, color: '#fff',
            }}
          >
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Group gap="xs" align="center">
                  <ThemeIcon variant="white" color="blue" size={36} radius="md">
                    <IconMilk size={20} style={{ color: '#1c3d6e' }} />
                  </ThemeIcon>
                  <div>
                    <Text fw={900} size="lg" tt="uppercase" style={{ letterSpacing: '1px', lineHeight: 1.1 }}>{societyName}</Text>
                    <Text fw={700} size="sm" tt="uppercase" style={{ letterSpacing: '1.5px', opacity: 0.85 }}>Milk Purchase Report</Text>
                  </div>
                </Group>
              </Stack>
              <Stack gap={4} align="flex-end">
                <Badge variant="filled" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11 }} size="lg" radius="sm">
                  {tab === 'farmer' ? 'Farmer-wise' : 'Date-wise'}
                </Badge>
                <Text size="xs" style={{ opacity: 0.85 }}>Period: <strong>{periodLabel}</strong></Text>
                <Text size="xs" style={{ opacity: 0.75 }}>Generated: {fmtDate(today)}</Text>
              </Stack>
            </Group>
          </Box>

          {/* ── KPI Cards ── */}
          {tab === 'date' && (
            <>
              <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="md" spacing="sm">
                <StatCard label="Total Days"      value={rows.length}          icon={IconCalendar}      color="#1c3d6e" />
                <StatCard label="Total Qty (L)"   value={f3(totals.totalQty)}  icon={IconDroplet}       color="#0369a1" />
                <StatCard label="Total Amt (₹)"   value={`₹${f2(totals.totalAmt)}`} icon={IconCurrencyRupee} color="#166534" />
                <StatCard label="Avg Rate (₹/L)"  value={`₹${f2(avgRate)}`}   icon={IconTrendingUp}    color="#7c3aed" />
                <StatCard label="Member Qty (L)"  value={f3(totals.memQty)}    sub={`₹${f2(totals.memAmt)}`}    icon={IconUsers} color="#166534" />
                <StatCard label="Non-Mem Qty (L)" value={f3(totals.nonMemQty)} sub={`₹${f2(totals.nonMemAmt)}`} icon={IconUser}  color="#9f1239" />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg" spacing="sm">
                <StatCard label="Local Sales (Ltr)"  value={f3(totals.localQty)}  sub={`₹${f2(totals.localAmt)}`}  icon={IconBuildingStore} color="#0f766e" />
                <StatCard label="Credit Sales (Ltr)" value={f3(totals.creditQty)} sub={`₹${f2(totals.creditAmt)}`} icon={IconShoppingCart}  color="#1d4ed8" />
                <StatCard label="School Sales (Ltr)" value={f3(totals.schoolQty)} sub={`₹${f2(totals.schoolAmt)}`} icon={IconSchool}        color="#92400e" />
                <StatCard label="Sample Sales (Ltr)" value={f3(totals.sampleQty)} sub={`₹${f2(totals.sampleAmt)}`} icon={IconFlask}         color="#6b21a8" />
              </SimpleGrid>
            </>
          )}
          {tab === 'farmer' && (
            <SimpleGrid cols={{ base: 2, sm: 4, md: 8 }} mb="lg" spacing="sm">
              <StatCard label="Total Farmers"  value={rows.length}                  icon={IconUsers}        color="#1c3d6e" />
              <StatCard label="Members"        value={totals.memCount}    sub={`₹${f2(memberTotals.amount)}`}    icon={IconUsers} color="#166534" />
              <StatCard label="Non-Members"    value={totals.nonMemCount} sub={`₹${f2(nonMemberTotals.amount)}`} icon={IconUser}  color="#9f1239" />
              <StatCard label="Sessions"       value={totals.totalEntries}          icon={IconCalendar}     color="#0369a1" />
              <StatCard label="Total Qty (L)"  value={f3(totals.totalQty)}          icon={IconDroplet}      color="#0f766e" />
              <StatCard label="Avg Rate (₹/L)" value={`₹${f2(avgRate)}`}           icon={IconTrendingUp}   color="#7c3aed" />
              <StatCard label="Incentive (₹)"  value={`₹${f2(totals.totalIncentive)}`} icon={IconChartBar} color="#92400e" />
              <StatCard label="Total Amt (₹)"  value={`₹${f2(totals.totalAmount)}`}    icon={IconCurrencyRupee} color="#166534" />
            </SimpleGrid>
          )}

          <Divider mb="sm" />

          {/* ── Date-wise Table ── */}
          {tab === 'date' && (
            <Box style={{ overflowX: 'auto' }}>
              <table className="mpr-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Date</th>
                    <th rowSpan={2}>Day</th>
                    <th colSpan={3} className="grp">Member Purchase</th>
                    <th colSpan={3} className="grp">Non-Member Purchase</th>
                    <th colSpan={4} className="grp">Total Purchase</th>
                    <th colSpan={2} className="grp">Local Sales</th>
                    <th colSpan={2} className="grp">Credit Sales</th>
                    <th colSpan={2} className="grp">School Sales</th>
                    <th colSpan={2} className="grp">Sample Sales</th>
                  </tr>
                  <tr>
                    <th className="sub">Nos</th><th className="sub">Qty (L)</th><th className="sub">Amt (₹)</th>
                    <th className="sub">Nos</th><th className="sub">Qty (L)</th><th className="sub">Amt (₹)</th>
                    <th className="sub">Nos</th><th className="sub">Qty (L)</th><th className="sub">Amt (₹)</th><th className="sub">Rate</th>
                    <th className="sub">Ltr</th><th className="sub">Amt (₹)</th>
                    <th className="sub">Ltr</th><th className="sub">Amt (₹)</th>
                    <th className="sub">Ltr</th><th className="sub">Amt (₹)</th>
                    <th className="sub">Ltr</th><th className="sub">Amt (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.date || i}>
                      <td className="c bold">{fmtDate(r.date)}</td>
                      <td className="c">{dayName(r.date)}</td>
                      <td className="c">{r.memNos}</td>
                      <td className="r">{fz3(r.memQty)}</td>
                      <td className="r">{fz2(r.memAmt)}</td>
                      <td className="c">{r.nonMemNos || ''}</td>
                      <td className="r">{fz3(r.nonMemQty)}</td>
                      <td className="r">{fz2(r.nonMemAmt)}</td>
                      <td className="c bold">{r.totalNos}</td>
                      <td className="r bold">{f3(r.totalQty)}</td>
                      <td className="r bold">{f2(r.totalAmt)}</td>
                      <td className="r">{f2(r.avgRate)}</td>
                      <td className="r">{fz3(r.localQty)}</td>
                      <td className="r">{fz2(r.localAmt)}</td>
                      <td className="r">{fz3(r.creditQty)}</td>
                      <td className="r">{fz2(r.creditAmt)}</td>
                      <td className="r">{fz3(r.schoolQty)}</td>
                      <td className="r">{fz2(r.schoolAmt)}</td>
                      <td className="r">{fz3(r.sampleQty)}</td>
                      <td className="r">{fz2(r.sampleAmt)}</td>
                    </tr>
                  ))}
                  <tr className="tot-row">
                    <td colSpan={2} className="c">GRAND TOTAL</td>
                    <td className="c">{totals.memNos}</td>
                    <td className="r">{f3(totals.memQty)}</td>
                    <td className="r">{f2(totals.memAmt)}</td>
                    <td className="c">{totals.nonMemNos}</td>
                    <td className="r">{f3(totals.nonMemQty)}</td>
                    <td className="r">{f2(totals.nonMemAmt)}</td>
                    <td className="c">{totals.totalNos}</td>
                    <td className="r">{f3(totals.totalQty)}</td>
                    <td className="r">{f2(totals.totalAmt)}</td>
                    <td className="r">{f2(avgRate)}</td>
                    <td className="r">{f3(totals.localQty)}</td>
                    <td className="r">{f2(totals.localAmt)}</td>
                    <td className="r">{f3(totals.creditQty)}</td>
                    <td className="r">{f2(totals.creditAmt)}</td>
                    <td className="r">{f3(totals.schoolQty)}</td>
                    <td className="r">{f2(totals.schoolAmt)}</td>
                    <td className="r">{f3(totals.sampleQty)}</td>
                    <td className="r">{f2(totals.sampleAmt)}</td>
                  </tr>
                </tbody>
              </table>
            </Box>
          )}

          {/* ── Farmer-wise Table ── */}
          {tab === 'farmer' && (
            <Box style={{ overflowX: 'auto' }}>
              <table className="mpr-table">
                <FarmerHead />
                <tbody>
                  {/* Members section */}
                  {farmerFilter !== 'nonmember' && (
                    <>
                      <tr className="sec-hdr">
                        <td colSpan={13}>
                          <Group gap="xs">
                            <IconUsers size={14} />
                            Members — {memberRows.length} farmers · ₹{f2(memberTotals.amount)}
                          </Group>
                        </td>
                      </tr>
                      <FarmerRows list={memberRows} offset={0} />
                      {memberRows.length > 0 && (
                        <tr className="sub-row">
                          <td colSpan={3} className="c">Members Sub-Total</td>
                          <td className="c">{memberTotals.amEntries}</td>
                          <td className="c">{memberTotals.pmEntries}</td>
                          <td className="c">{memberTotals.entries}</td>
                          <td className="r">{f3(memberTotals.qty)}</td>
                          <td className="c">—</td><td className="c">—</td><td className="c">—</td>
                          <td className="r">{memberTotals.qty > 0 ? f2(memberTotals.amount / memberTotals.qty) : '—'}</td>
                          <td className="r">{f2(memberTotals.incentive)}</td>
                          <td className="r">{f2(memberTotals.amount)}</td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* Non-Members section */}
                  {farmerFilter !== 'member' && (
                    <>
                      <tr className="sec-hdr">
                        <td colSpan={13}>
                          <Group gap="xs">
                            <IconUser size={14} />
                            Non-Members — {nonMemberRows.length} farmers · ₹{f2(nonMemberTotals.amount)}
                          </Group>
                        </td>
                      </tr>
                      <FarmerRows list={nonMemberRows} offset={farmerFilter === 'all' ? memberRows.length : 0} />
                      {nonMemberRows.length > 0 && (
                        <tr className="sub-row">
                          <td colSpan={3} className="c">Non-Members Sub-Total</td>
                          <td className="c">{nonMemberTotals.amEntries}</td>
                          <td className="c">{nonMemberTotals.pmEntries}</td>
                          <td className="c">{nonMemberTotals.entries}</td>
                          <td className="r">{f3(nonMemberTotals.qty)}</td>
                          <td className="c">—</td><td className="c">—</td><td className="c">—</td>
                          <td className="r">{nonMemberTotals.qty > 0 ? f2(nonMemberTotals.amount / nonMemberTotals.qty) : '—'}</td>
                          <td className="r">{f2(nonMemberTotals.incentive)}</td>
                          <td className="r">{f2(nonMemberTotals.amount)}</td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* Grand Total — only when showing all */}
                  {farmerFilter === 'all' && (
                    <tr className="tot-row">
                      <td colSpan={3} className="c">GRAND TOTAL — {totals.memCount}M / {totals.nonMemCount}NM</td>
                      <td className="c">{totals.amEntries}</td>
                      <td className="c">{totals.pmEntries}</td>
                      <td className="c">{totals.totalEntries}</td>
                      <td className="r">{f3(totals.totalQty)}</td>
                      <td className="c">—</td><td className="c">—</td><td className="c">—</td>
                      <td className="r">{f2(avgRate)}</td>
                      <td className="r">{f2(totals.totalIncentive)}</td>
                      <td className="r">{f2(totals.totalAmount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Box>
          )}

          {/* ── Footer ── */}
          <Divider mt="lg" mb="sm" />
          <Group justify="space-between" align="flex-end">
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Society: <strong style={{ color: '#1c3d6e' }}>{societyName}</strong></Text>
              <Text size="xs" c="dimmed">Report Period: <strong style={{ color: '#1c3d6e' }}>{periodLabel}</strong></Text>
              <Text size="xs" c="dimmed">Total Records: <strong>{rows.length}</strong></Text>
            </Stack>
            <Box style={{ textAlign: 'right', borderTop: '1.5px solid #1c3d6e', paddingTop: 6, minWidth: 180 }}>
              <Text size="sm" fw={700} style={{ color: '#1c3d6e' }}>Secretary / Authorized Signatory</Text>
              <Text size="xs" c="dimmed">Dairy Development Department</Text>
            </Box>
          </Group>

        </Paper>
      )}
    </Box>
  );
}
