import { useState, useCallback } from 'react';
import {
  Container, Title, Text, Button, Group, Paper, TextInput,
  Box, Stack, ScrollArea, Table, Loader, Center, Divider, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconCalendar, IconPrinter, IconFileTypePdf, IconX, IconRefresh
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { milkCollectionAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import dayjs from 'dayjs';

// ── helpers ──────────────────────────────────────────────────────────────────
const n2  = v => (v != null && v !== '') ? Number(v).toFixed(2) : '';
const n1  = v => (v != null && v !== '') ? Number(v).toFixed(1) : '';
const fmtD = d => dayjs(d).format('DD/MM');
const fmtFull = d => dayjs(d).format('DD/MM/YYYY');

// ── single farmer preview block ────────────────────────────────────────────
const FarmerBlock = ({ farmer }) => {
  const t = farmer.totals;

  return (
    <Box mb={4}>
      {/* Farmer header */}
      <Box
        style={{
          background: 'var(--mantine-color-blue-1)',
          borderLeft: '4px solid var(--mantine-color-blue-6)',
          padding: '4px 10px',
          fontWeight: 700,
          fontSize: 13
        }}
      >
        {farmer.farmerNumber} — {farmer.farmerName}
      </Box>

      <Table
        withTableBorder
        withColumnBorders
        fz={11}
        style={{ minWidth: 1100 }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th rowSpan={2} ta="center" style={{ verticalAlign: 'middle', background: '#1a237e', color: '#fff', minWidth: 52 }}>DATE</Table.Th>
            <Table.Th colSpan={7} ta="center" style={{ background: '#283593', color: '#fff' }}>AM SESSION</Table.Th>
            <Table.Th colSpan={7} ta="center" style={{ background: '#1565c0', color: '#fff' }}>PM SESSION</Table.Th>
            <Table.Th colSpan={2} ta="center" style={{ background: '#1a237e', color: '#fff' }}>TOTAL</Table.Th>
          </Table.Tr>
          <Table.Tr>
            {['QTY','CLR','FAT','SNF','RATE','INC','VALUE','QTY','CLR','FAT','SNF','RATE','INC','VALUE','QTY','VALUE'].map((h, i) => (
              <Table.Th key={i} ta="right" style={{ background: i < 7 ? '#3949ab' : i < 14 ? '#1976d2' : '#283593', color: '#fff', minWidth: 52, fontSize: 10 }}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {farmer.rows.map((row, i) => (
            <Table.Tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f5f7ff' }}>
              <Table.Td ta="center" fw={600}>{fmtD(row.date)}</Table.Td>
              {/* AM */}
              <Table.Td ta="right">{row.am ? n2(row.am.qty)    : ''}</Table.Td>
              <Table.Td ta="right">{row.am ? n1(row.am.clr)    : ''}</Table.Td>
              <Table.Td ta="right">{row.am ? n2(row.am.fat)    : ''}</Table.Td>
              <Table.Td ta="right">{row.am ? n2(row.am.snf)    : ''}</Table.Td>
              <Table.Td ta="right">{row.am ? n2(row.am.rate)   : ''}</Table.Td>
              <Table.Td ta="right">{row.am ? n2(row.am.incentive) : ''}</Table.Td>
              <Table.Td ta="right" fw={600}>{row.am ? n2(row.am.value)  : ''}</Table.Td>
              {/* PM */}
              <Table.Td ta="right">{row.pm ? n2(row.pm.qty)    : ''}</Table.Td>
              <Table.Td ta="right">{row.pm ? n1(row.pm.clr)    : ''}</Table.Td>
              <Table.Td ta="right">{row.pm ? n2(row.pm.fat)    : ''}</Table.Td>
              <Table.Td ta="right">{row.pm ? n2(row.pm.snf)    : ''}</Table.Td>
              <Table.Td ta="right">{row.pm ? n2(row.pm.rate)   : ''}</Table.Td>
              <Table.Td ta="right">{row.pm ? n2(row.pm.incentive) : ''}</Table.Td>
              <Table.Td ta="right" fw={600}>{row.pm ? n2(row.pm.value)  : ''}</Table.Td>
              {/* Total */}
              <Table.Td ta="right" fw={700} c="blue">{n2(row.totalQty)}</Table.Td>
              <Table.Td ta="right" fw={700} c="green.8">{n2(row.totalValue)}</Table.Td>
            </Table.Tr>
          ))}

          {/* Farmer totals row */}
          <Table.Tr style={{ background: '#dce8fb', fontWeight: 700, borderTop: '2px solid #3949ab' }}>
            <Table.Td ta="center" fw={800} style={{ fontSize: 10 }}>TOTAL</Table.Td>
            <Table.Td ta="right" fw={700}>{n2(t.amQty)}</Table.Td>
            <Table.Td ta="right">{n1(t.amClr)}</Table.Td>
            <Table.Td ta="right">{n2(t.amFat)}</Table.Td>
            <Table.Td ta="right">{n2(t.amSnf)}</Table.Td>
            <Table.Td ta="right">{n2(t.amRate)}</Table.Td>
            <Table.Td ta="right" fw={700}>{n2(t.amIncentive)}</Table.Td>
            <Table.Td ta="right" fw={700}>{n2(t.amValue)}</Table.Td>
            <Table.Td ta="right" fw={700}>{n2(t.pmQty)}</Table.Td>
            <Table.Td ta="right">{n1(t.pmClr)}</Table.Td>
            <Table.Td ta="right">{n2(t.pmFat)}</Table.Td>
            <Table.Td ta="right">{n2(t.pmSnf)}</Table.Td>
            <Table.Td ta="right">{n2(t.pmRate)}</Table.Td>
            <Table.Td ta="right" fw={700}>{n2(t.pmIncentive)}</Table.Td>
            <Table.Td ta="right" fw={700}>{n2(t.pmValue)}</Table.Td>
            <Table.Td ta="right" fw={800} c="blue">{n2(t.totalQty)}</Table.Td>
            <Table.Td ta="right" fw={800} c="green.8">{n2(t.totalValue)}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const FarmerWiseSummary = () => {
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || selectedCompany?.name || 'Dairy Cooperative Society';

  const [fromDate,     setFromDate]     = useState(new Date());
  const [toDate,       setToDate]       = useState(new Date());
  const [searchFarmer, setSearchFarmer] = useState('');
  const [data,         setData]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [generated,    setGenerated]    = useState(false);

  const fromLabel = fmtFull(fromDate);
  const toLabel   = fmtFull(toDate);

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await milkCollectionAPI.getFarmerWiseStatement({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD')
      });
      setData(res?.data || []);
      setGenerated(true);
      if (!res?.data?.length) notifications.show({ message: 'No records found for selected period', color: 'yellow' });
    } catch (err) {
      notifications.show({ message: err?.message || 'Failed to fetch data', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  // ── Client-side search filter ─────────────────────────────────────────────
  const filteredData = searchFarmer.trim()
    ? data.filter(f =>
        f.farmerNumber?.toLowerCase().includes(searchFarmer.toLowerCase()) ||
        f.farmerName?.toLowerCase().includes(searchFarmer.toLowerCase())
      )
    : data;

  // ── Grand totals ──────────────────────────────────────────────────────────
  const grand = filteredData.reduce((acc, f) => ({
    amQty:       acc.amQty       + f.totals.amQty,
    amIncentive: acc.amIncentive + f.totals.amIncentive,
    amValue:     acc.amValue     + f.totals.amValue,
    pmQty:       acc.pmQty       + f.totals.pmQty,
    pmIncentive: acc.pmIncentive + f.totals.pmIncentive,
    pmValue:     acc.pmValue     + f.totals.pmValue,
    totalQty:    acc.totalQty    + f.totals.totalQty,
    totalValue:  acc.totalValue  + f.totals.totalValue
  }), { amQty:0, amIncentive:0, amValue:0, pmQty:0, pmIncentive:0, pmValue:0, totalQty:0, totalValue:0 });

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = () => { setData([]); setGenerated(false); setSearchFarmer(''); };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!filteredData.length) {
      notifications.show({ message: 'No data to print', color: 'yellow' }); return;
    }

    const bodyRows = filteredData.map(farmer => {
      const fHdr = `<tr class="f-hdr"><td colspan="17">${farmer.farmerNumber} &mdash; ${farmer.farmerName}</td></tr>`;

      const dateRows = farmer.rows.map((row, i) => `
        <tr class="${i%2===0?'':'alt'}">
          <td class="c">${fmtD(row.date)}</td>
          <td>${row.am ? n2(row.am.qty)       : ''}</td>
          <td>${row.am ? n1(row.am.clr)       : ''}</td>
          <td>${row.am ? n2(row.am.fat)       : ''}</td>
          <td>${row.am ? n2(row.am.snf)       : ''}</td>
          <td>${row.am ? n2(row.am.rate)      : ''}</td>
          <td>${row.am ? n2(row.am.incentive) : ''}</td>
          <td class="b">${row.am ? n2(row.am.value)     : ''}</td>
          <td>${row.pm ? n2(row.pm.qty)       : ''}</td>
          <td>${row.pm ? n1(row.pm.clr)       : ''}</td>
          <td>${row.pm ? n2(row.pm.fat)       : ''}</td>
          <td>${row.pm ? n2(row.pm.snf)       : ''}</td>
          <td>${row.pm ? n2(row.pm.rate)      : ''}</td>
          <td>${row.pm ? n2(row.pm.incentive) : ''}</td>
          <td class="b">${row.pm ? n2(row.pm.value)     : ''}</td>
          <td class="b blue">${n2(row.totalQty)}</td>
          <td class="b green">${n2(row.totalValue)}</td>
        </tr>`).join('');

      const t = farmer.totals;
      const totRow = `
        <tr class="f-tot">
          <td class="c">TOTAL</td>
          <td class="b">${n2(t.amQty)}</td><td>${n1(t.amClr)}</td><td>${n2(t.amFat)}</td><td>${n2(t.amSnf)}</td>
          <td>${n2(t.amRate)}</td><td class="b">${n2(t.amIncentive)}</td><td class="b">${n2(t.amValue)}</td>
          <td class="b">${n2(t.pmQty)}</td><td>${n1(t.pmClr)}</td><td>${n2(t.pmFat)}</td><td>${n2(t.pmSnf)}</td>
          <td>${n2(t.pmRate)}</td><td class="b">${n2(t.pmIncentive)}</td><td class="b">${n2(t.pmValue)}</td>
          <td class="b blue">${n2(t.totalQty)}</td><td class="b green">${n2(t.totalValue)}</td>
        </tr>`;
      return fHdr + dateRows + totRow;
    }).join('');

    const gt = grand;
    const grandRow = `
      <tr class="g-tot">
        <td class="c">GRAND<br>TOTAL</td>
        <td class="b">${n2(gt.amQty)}</td><td></td><td></td><td></td><td></td>
        <td class="b">${n2(gt.amIncentive)}</td><td class="b">${n2(gt.amValue)}</td>
        <td class="b">${n2(gt.pmQty)}</td><td></td><td></td><td></td><td></td>
        <td class="b">${n2(gt.pmIncentive)}</td><td class="b">${n2(gt.pmValue)}</td>
        <td class="b blue">${n2(gt.totalQty)}</td><td class="b green">${n2(gt.totalValue)}</td>
      </tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Milk Collection Statement</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 7px; color: #111;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hdr    { text-align: center; margin-bottom: 3mm; }
  .hdr h1 { font-size: 12px; font-weight: 800; letter-spacing: .3px; }
  .hdr h2 { font-size: 9.5px; font-weight: 600; margin-top: 1.5mm; }
  .hdr p  { font-size: 7px; color: #555; margin-top: 1mm; }
  table   { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 2mm; }
  colgroup col { width: 7.5% }
  th, td  { border: .4pt solid #aaa; padding: 1.5px 2px; text-align: right; overflow: hidden; }
  td.c    { text-align: center; }
  td.b    { font-weight: 700; }
  td.blue { color: #1565c0; }
  td.green{ color: #2e7d32; }
  th      { font-size: 6.5px; font-weight: 700; text-align: center; text-transform: uppercase; }
  th.g1   { background: #1a237e; color: #fff; }
  th.g-am { background: #283593; color: #fff; }
  th.g-pm { background: #1565c0; color: #fff; }
  th.g-t  { background: #1a237e; color: #fff; }
  th.sub  { font-size: 6px; }
  th.sub-am { background: #3949ab; color: #fff; }
  th.sub-pm { background: #1976d2; color: #fff; }
  th.sub-t  { background: #283593; color: #fff; }
  tr.alt td   { background: #f5f7ff; }
  tr.f-hdr td { background: #e8eaf6; font-weight: 700; font-size: 7.5px; padding: 2px 4px;
                text-align: left; border-top: 1pt solid #555; border-bottom: .5pt solid #9fa8da; }
  tr.f-tot td { background: #dce8fb; font-weight: 700; border-top: 1pt solid #3949ab; }
  tr.g-tot td { background: #bbdefb; font-weight: 800; font-size: 7.5px; border-top: 1.5pt solid #1565c0; }
  .sigs   { display: flex; justify-content: space-between; margin-top: 12mm; }
  .sig    { text-align: center; font-size: 8px; }
  .sig hr { width: 40mm; border: none; border-top: .5pt solid #333; margin: 0 auto 2mm; }
</style>
</head><body>
<div class="hdr">
  <h1>${companyName}</h1>
  <h2>Milk Collection Statement &mdash; Producer Wise</h2>
  <p>Period&nbsp;: ${fromLabel} &nbsp;to&nbsp; ${toLabel}
     &nbsp;&nbsp;|&nbsp;&nbsp; Farmers&nbsp;: ${filteredData.length}
     &nbsp;&nbsp;|&nbsp;&nbsp; Printed&nbsp;: ${dayjs().format('DD MMM YYYY HH:mm')}</p>
</div>
<table>
  <colgroup>
    <col style="width:7.3%">
    <col style="width:5.7%"><col style="width:4.5%"><col style="width:4.5%"><col style="width:4.5%"><col style="width:5.2%"><col style="width:5.5%"><col style="width:6.5%">
    <col style="width:5.7%"><col style="width:4.5%"><col style="width:4.5%"><col style="width:4.5%"><col style="width:5.2%"><col style="width:5.5%"><col style="width:6.5%">
    <col style="width:5.7%"><col style="width:6.9%">
  </colgroup>
  <thead>
    <tr>
      <th class="g1" rowspan="2" style="vertical-align:middle">DATE</th>
      <th class="g-am" colspan="7">AM SESSION</th>
      <th class="g-pm" colspan="7">PM SESSION</th>
      <th class="g-t"  colspan="2">TOTAL</th>
    </tr>
    <tr>
      <th class="sub sub-am">QTY</th><th class="sub sub-am">CLR</th>
      <th class="sub sub-am">FAT</th><th class="sub sub-am">SNF</th>
      <th class="sub sub-am">RATE</th><th class="sub sub-am">INC</th><th class="sub sub-am">VALUE</th>
      <th class="sub sub-pm">QTY</th><th class="sub sub-pm">CLR</th>
      <th class="sub sub-pm">FAT</th><th class="sub sub-pm">SNF</th>
      <th class="sub sub-pm">RATE</th><th class="sub sub-pm">INC</th><th class="sub sub-pm">VALUE</th>
      <th class="sub sub-t">QTY</th><th class="sub sub-t">VALUE</th>
    </tr>
  </thead>
  <tbody>
    ${bodyRows}
    ${grandRow}
  </tbody>
</table>
<div class="sigs">
  <div class="sig"><hr>President</div>
  <div class="sig"><hr>Secretary</div>
</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { notifications.show({ message: 'Pop-up blocked — please allow pop-ups', color: 'orange' }); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (!filteredData.length) {
      notifications.show({ message: 'No data to export', color: 'yellow' }); return;
    }

    const doc  = new jsPDF('p', 'mm', 'a4');
    const pw   = doc.internal.pageSize.width;   // 210
    const ph   = doc.internal.pageSize.height;  // 297
    const mg   = 8;
    const topH = 27; // height reserved for page header

    const drawHdr = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(companyName, pw/2, 10, { align: 'center' });
      doc.setFontSize(9);
      doc.text('Milk Collection Statement — Producer Wise', pw/2, 16, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(`Period: ${fromLabel} to ${toLabel}`, pw/2, 21.5, { align: 'center' });
      doc.setFontSize(6.5); doc.setTextColor(120);
      doc.text(`Printed: ${dayjs().format('DD MMM YYYY HH:mm')}`, pw/2, 26, { align: 'center' });
      doc.setTextColor(0);
    };

    // Build one flat body array for all farmers
    const body = [];

    for (const farmer of filteredData) {
      // Farmer header row
      body.push([{
        content: `${farmer.farmerNumber}  —  ${farmer.farmerName}`,
        colSpan: 17,
        styles: { fillColor: [232,234,246], fontStyle: 'bold', fontSize: 7.5, halign: 'left', cellPadding: [1.5,3,1.5,3] }
      }]);

      // Date rows
      for (const row of farmer.rows) {
        body.push([
          fmtD(row.date),
          row.am ? n2(row.am.qty)       : '', row.am ? n1(row.am.clr) : '',
          row.am ? n2(row.am.fat)       : '', row.am ? n2(row.am.snf) : '',
          row.am ? n2(row.am.rate)      : '',
          row.am ? n2(row.am.incentive) : '',
          row.am ? n2(row.am.value)     : '',
          row.pm ? n2(row.pm.qty)       : '', row.pm ? n1(row.pm.clr) : '',
          row.pm ? n2(row.pm.fat)       : '', row.pm ? n2(row.pm.snf) : '',
          row.pm ? n2(row.pm.rate)      : '',
          row.pm ? n2(row.pm.incentive) : '',
          row.pm ? n2(row.pm.value)     : '',
          n2(row.totalQty),
          n2(row.totalValue)
        ]);
      }

      // Farmer totals row
      const t = farmer.totals;
      const totStyle = { fontStyle: 'bold', fillColor: [200,220,255] };
      body.push([
        { content: 'TOTAL', styles: { ...totStyle, halign: 'center' } },
        { content: n2(t.amQty),       styles: totStyle },
        { content: n1(t.amClr),       styles: { fillColor: [200,220,255] } },
        { content: n2(t.amFat),       styles: { fillColor: [200,220,255] } },
        { content: n2(t.amSnf),       styles: { fillColor: [200,220,255] } },
        { content: n2(t.amRate),      styles: { fillColor: [200,220,255] } },
        { content: n2(t.amIncentive), styles: totStyle },
        { content: n2(t.amValue),     styles: totStyle },
        { content: n2(t.pmQty),       styles: totStyle },
        { content: n1(t.pmClr),       styles: { fillColor: [200,220,255] } },
        { content: n2(t.pmFat),       styles: { fillColor: [200,220,255] } },
        { content: n2(t.pmSnf),       styles: { fillColor: [200,220,255] } },
        { content: n2(t.pmRate),      styles: { fillColor: [200,220,255] } },
        { content: n2(t.pmIncentive), styles: totStyle },
        { content: n2(t.pmValue),     styles: totStyle },
        { content: n2(t.totalQty),    styles: totStyle },
        { content: n2(t.totalValue),  styles: totStyle }
      ]);
    }

    // Grand total row
    const gt = grand;
    const gStyle = { fontStyle: 'bold', fillColor: [187,222,251], fontSize: 7.5 };
    body.push([
      { content: 'GRAND TOTAL', styles: { ...gStyle, halign: 'center' } },
      { content: n2(gt.amQty),       styles: gStyle },
      { content: '',                  styles: { fillColor: [187,222,251] } },
      { content: '',                  styles: { fillColor: [187,222,251] } },
      { content: '',                  styles: { fillColor: [187,222,251] } },
      { content: '',                  styles: { fillColor: [187,222,251] } },
      { content: n2(gt.amIncentive), styles: gStyle },
      { content: n2(gt.amValue),     styles: gStyle },
      { content: n2(gt.pmQty),       styles: gStyle },
      { content: '',                  styles: { fillColor: [187,222,251] } },
      { content: '',                  styles: { fillColor: [187,222,251] } },
      { content: '',                  styles: { fillColor: [187,222,251] } },
      { content: '',                  styles: { fillColor: [187,222,251] } },
      { content: n2(gt.pmIncentive), styles: gStyle },
      { content: n2(gt.pmValue),     styles: gStyle },
      { content: n2(gt.totalQty),    styles: gStyle },
      { content: n2(gt.totalValue),  styles: gStyle }
    ]);

    autoTable(doc, {
      startY: topH,
      margin: { left: mg, right: mg, top: topH },
      head: [
        [
          { content: 'DATE', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [26,35,126] } },
          { content: 'AM SESSION',  colSpan: 7, styles: { halign: 'center', fillColor: [40,53,147] } },
          { content: 'PM SESSION',  colSpan: 7, styles: { halign: 'center', fillColor: [21,101,192] } },
          { content: 'TOTAL',       colSpan: 2, styles: { halign: 'center', fillColor: [26,35,126] } }
        ],
        [
          'QTY','CLR','FAT','SNF','RATE','INC','VALUE',
          'QTY','CLR','FAT','SNF','RATE','INC','VALUE',
          'QTY','VALUE'
        ]
      ],
      body,
      styles:             { fontSize: 7, cellPadding: 1.5, halign: 'right', lineColor: [180,180,180], lineWidth: 0.2 },
      headStyles:         { fillColor: [26,35,126], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center', cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [249,250,252] },
      columnStyles: {
        0:  { cellWidth: 14, halign: 'center' },
        1:  { cellWidth: 11 }, 2:  { cellWidth: 9  }, 3:  { cellWidth: 9  },
        4:  { cellWidth: 9  }, 5:  { cellWidth: 10 }, 6:  { cellWidth: 11 }, 7:  { cellWidth: 13 },
        8:  { cellWidth: 11 }, 9:  { cellWidth: 9  }, 10: { cellWidth: 9  },
        11: { cellWidth: 9  }, 12: { cellWidth: 10 }, 13: { cellWidth: 11 }, 14: { cellWidth: 13 },
        15: { cellWidth: 11 }, 16: { cellWidth: 13 }
      },
      willDrawPage: (data) => { drawHdr(); },
      didDrawPage:  (data) => {
        const total = doc.internal.getNumberOfPages();
        doc.setFontSize(7); doc.setTextColor(150);
        doc.text(`Page ${data.pageNumber} / ${total}`, pw/2, ph-4, { align: 'center' });
        doc.setTextColor(0);
      }
    });

    // Signatures
    const finalY = doc.lastAutoTable.finalY + 8;
    let sigY = finalY;
    if (sigY > ph - 22) { doc.addPage(); drawHdr(); sigY = topH + 15; }

    const c1 = mg + 22, c2 = pw - mg - 22;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.line(c1 - 18, sigY, c1 + 18, sigY);
    doc.text('President', c1, sigY + 5, { align: 'center' });
    doc.line(c2 - 18, sigY, c2 + 18, sigY);
    doc.text('Secretary', c2, sigY + 5, { align: 'center' });

    doc.save(`Milk_Statement_${dayjs(fromDate).format('YYYYMMDD')}_${dayjs(toDate).format('YYYYMMDD')}.pdf`);
    notifications.show({ message: 'PDF exported successfully', color: 'green' });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">

      {/* ── Page title ── */}
      <Box mb="sm">
        <Title order={2} fw={700}>Milk Collection Statement — Producer Wise</Title>
        <Text c="dimmed" size="sm">Date-wise AM / PM breakdown grouped by farmer</Text>
      </Box>

      {/* ── Filter form ── */}
      <Paper withBorder p="sm" radius="md" mb="md">
        <Group gap="sm" wrap="wrap" align="flex-end">

          <DatePickerInput
            label="From Date"
            value={fromDate}
            onChange={v => v && setFromDate(v)}
            leftSection={<IconCalendar size={14} />}
            valueFormat="DD/MM/YYYY"
            size="sm"
            style={{ width: 155 }}
          />

          <DatePickerInput
            label="To Date"
            value={toDate}
            onChange={v => v && setToDate(v)}
            leftSection={<IconCalendar size={14} />}
            valueFormat="DD/MM/YYYY"
            size="sm"
            style={{ width: 155 }}
          />

          <TextInput
            label="Search Farmer"
            placeholder="Name or Farmer No."
            leftSection={<IconSearch size={14} />}
            value={searchFarmer}
            onChange={e => setSearchFarmer(e.currentTarget.value)}
            size="sm"
            style={{ width: 200 }}
          />

          <Button
            leftSection={<IconRefresh size={14} />}
            size="sm"
            onClick={handleGenerate}
            loading={loading}
          >
            Generate
          </Button>

          <Button
            leftSection={<IconPrinter size={14} />}
            variant="light"
            color="teal"
            size="sm"
            onClick={handlePrint}
            disabled={!filteredData.length}
          >
            Print
          </Button>

          <Button
            leftSection={<IconFileTypePdf size={14} />}
            variant="light"
            color="red"
            size="sm"
            onClick={handleExportPDF}
            disabled={!filteredData.length}
          >
            Export PDF
          </Button>

          {generated && (
            <Button
              leftSection={<IconX size={14} />}
              variant="subtle"
              color="gray"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
        </Group>
      </Paper>

      {/* ── Report preview ── */}
      {loading && (
        <Center py="xl"><Loader /></Center>
      )}

      {!loading && generated && filteredData.length === 0 && (
        <Center py="xl">
          <Text c="dimmed">No records found for the selected period / farmer.</Text>
        </Center>
      )}

      {!loading && filteredData.length > 0 && (
        <Stack gap={0}>
          {/* Report header */}
          <Paper withBorder p="sm" radius="md" mb="xs" style={{ textAlign: 'center' }}>
            <Text fw={800} size="md">{companyName}</Text>
            <Text fw={600} size="sm">Milk Collection Statement — Producer Wise</Text>
            <Text size="xs" c="dimmed">
              Period: {fromLabel} to {toLabel} &nbsp;|&nbsp; Farmers: {filteredData.length}
            </Text>
          </Paper>

          {/* One block per farmer */}
          <ScrollArea type="always">
            <Box style={{ minWidth: 1120 }} px={2}>
              {filteredData.map(farmer => (
                <FarmerBlock key={farmer.farmerNumber} farmer={farmer} />
              ))}

              {/* Grand total */}
              <Box mt={2}>
                <Table withTableBorder withColumnBorders fz={11} style={{ minWidth: 1100 }}>
                  <Table.Tbody>
                    <Table.Tr style={{ background: '#bbdefb' }}>
                      <Table.Td ta="center" fw={800} style={{ width: 52, fontSize: 10 }}>GRAND<br/>TOTAL</Table.Td>
                      <Table.Td ta="right" fw={800}>{n2(grand.amQty)}</Table.Td>
                      <Table.Td /><Table.Td /><Table.Td /><Table.Td />
                      <Table.Td ta="right" fw={700}>{n2(grand.amIncentive)}</Table.Td>
                      <Table.Td ta="right" fw={800}>{n2(grand.amValue)}</Table.Td>
                      <Table.Td ta="right" fw={800}>{n2(grand.pmQty)}</Table.Td>
                      <Table.Td /><Table.Td /><Table.Td /><Table.Td />
                      <Table.Td ta="right" fw={700}>{n2(grand.pmIncentive)}</Table.Td>
                      <Table.Td ta="right" fw={800}>{n2(grand.pmValue)}</Table.Td>
                      <Table.Td ta="right" fw={800} c="blue">{n2(grand.totalQty)}</Table.Td>
                      <Table.Td ta="right" fw={800} c="green.8">{n2(grand.totalValue)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Box>
            </Box>
          </ScrollArea>

          {/* Summary badges */}
          <Group mt="xs" gap="xs" wrap="wrap">
            <Badge size="sm" color="blue"  variant="light">Farmers: {filteredData.length}</Badge>
            <Badge size="sm" color="teal"  variant="light">Total Qty: {n2(grand.totalQty)} L</Badge>
            <Badge size="sm" color="green" variant="light">Total Value: ₹{Number(grand.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Badge>
            <Badge size="sm" color="indigo" variant="light">AM Value: ₹{Number(grand.amValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Badge>
            <Badge size="sm" color="violet" variant="light">PM Value: ₹{Number(grand.pmValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Badge>
          </Group>
        </Stack>
      )}
    </Container>
  );
};

export default FarmerWiseSummary;
