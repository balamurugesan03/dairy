import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box, Button, Center, Container, Divider, Group, Loader,
  Menu, Paper, ScrollArea, Select, Stack, Table, Text, Title, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconBook2, IconCalendar, IconDownload, IconFileSpreadsheet,
  IconFileTypePdf, IconPrinter, IconRectangle, IconRectangleVertical,
  IconSearch
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/* ── number formatting ──────────────────────────────────────── */
const fmt = (v) => {
  const n = parseFloat(v || 0);
  if (n === 0) return '';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtA = (v) =>
  parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── shared table cell styles ───────────────────────────────── */
const S = {
  base: {
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: 12.5,
    padding: '4px 7px',
    verticalAlign: 'middle',
    borderColor: '#c8cdd2',
  },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  day: { textAlign: 'center', fontWeight: 700, fontSize: 12.5 },
  desc: { textAlign: 'left', fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 12.5 },
  bal: { fontWeight: 700 },
  prog: { color: '#666' },
  balType: { fontSize: 10, fontWeight: 700, marginLeft: 4, color: '#666' },
};

/* ── row backgrounds ────────────────────────────────────────── */
const BG = {
  opening: '#FFFDE7',
  closing: '#FFFDE7',
  month: '#E8EAF6',
  monthTotal: '#F0F0F5',
  grandTotal: '#E8EAF6',
  odd: '#FAFAFA',
  even: '#FFFFFF',
};

const GeneralLedger = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const printRef = useRef(null);

  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';

  useEffect(() => {
    fetchLedgers();
    const today = dayjs();
    const fyStart = today.month() >= 3
      ? dayjs().month(3).date(1)
      : dayjs().subtract(1, 'year').month(3).date(1);
    setFromDate(fyStart.toDate());
    setToDate(today.toDate());
  }, []);

  const fetchLedgers = async () => {
    try {
      const res = await reportAPI.ledgersDropdown();
      setLedgers(res?.data || res || []);
    } catch {
      notifications.show({ color: 'red', message: 'Failed to fetch ledgers' });
    }
  };

  const fetchReport = async () => {
    if (!selectedLedger) { notifications.show({ color: 'orange', message: 'Please select a ledger' }); return; }
    if (!fromDate || !toDate) { notifications.show({ color: 'orange', message: 'Please select date range' }); return; }
    setLoading(true);
    try {
      const res = await reportAPI.generalLedger({
        startDate: dayjs(fromDate).format('YYYY-MM-DD'),
        endDate: dayjs(toDate).format('YYYY-MM-DD'),
        ledgerId: selectedLedger
      });
      setReportData(res?.data || res);
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Failed to fetch general ledger' });
    } finally {
      setLoading(false);
    }
  };

  const formatDay  = (d) => dayjs(d).format('DD');
  const formatDate = (d) => dayjs(d).format('DD/MM/YYYY');

  const getFinancialYear = () => {
    if (!fromDate) return '';
    const s = dayjs(fromDate);
    const yr = s.month() >= 3 ? s.year() : s.year() - 1;
    return `${yr}-${(yr + 1).toString().slice(2)}`;
  };

  /* ── data processing ──────────────────────────────────────── */
  const processedData = useMemo(() => {
    if (!reportData) return null;
    const openBal     = reportData.openingBalance || 0;
    const openBalType = reportData.openingBalanceType || 'Dr';
    const txns        = reportData.transactions || [];
    const isDebit     = openBalType === 'Dr';

    let progR = 0, progP = 0;
    const months = [];
    let cur = null;

    txns.forEach(t => {
      const mKey   = dayjs(t.date).format('MMM-YYYY');
      const receipt = isDebit ? (t.debit || 0) : (t.credit || 0);
      const payment = isDebit ? (t.credit || 0) : (t.debit || 0);
      progR += receipt;
      progP += payment;

      const row = {
        ...t, receipt, payment, progReceipt: progR, progPayment: progP,
        runningBalance: t.balance || 0,
        balType: t.balanceType || openBalType
      };

      if (!cur || cur.key !== mKey) {
        cur = { key: mKey, rows: [], monthReceipt: 0, monthPayment: 0 };
        months.push(cur);
      }
      cur.rows.push(row);
      cur.monthReceipt += receipt;
      cur.monthPayment += payment;
    });

    return {
      openBal, openBalType,
      closeBal: reportData.closingBalance || 0,
      closeBalType: reportData.closingBalanceType || openBalType,
      totalReceipts: progR,
      totalPayments: progP,
      months,
      ledgerName: reportData.ledger?.name || '',
      ledgerType: reportData.ledger?.type || ''
    };
  }, [reportData]);

  /* ── print ───────────────────────────────────────────────── */
  const handlePrint = (orientation = 'landscape') => {
    const content = printRef.current;
    if (!content) return;
    const pw = window.open('', '_blank');
    pw.document.write(`<!DOCTYPE html><html><head>
      <title>General Ledger - ${processedData?.ledgerName || ''}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',Tahoma,sans-serif;color:#1a1a2e;background:#fff}
        .gl-register{border:1.5px solid #000}
        .gl-header{text-align:center;padding:10mm 10mm 6mm;border-bottom:2px solid #000}
        .gl-header__society{font-size:17px;font-weight:800;letter-spacing:3px;text-transform:uppercase}
        .gl-header__title{display:inline-block;font-size:13px;font-weight:700;letter-spacing:7px;text-transform:uppercase;padding:3px 20px;border-top:2.5px double #000;border-bottom:2.5px double #000}
        .gl-header__info{display:flex;justify-content:space-between;padding:6px 0 0;font-size:10.5px}
        table{width:100%;border-collapse:collapse;font-size:9.5px;table-layout:fixed}
        col.day{width:5%} col.num{width:12%} col.prog{width:13%} col.bal{width:14%} col.desc{width:29%}
        thead th{background:#eee;border:1px solid #888;padding:4px;font-weight:700;font-size:8.5px;letter-spacing:.5px;text-transform:uppercase;text-align:center}
        thead th.desc{text-align:left;padding-left:6px}
        tbody td{border:1px solid #aaa;padding:2.5px 4px;font-size:9px}
        .td-day{text-align:center;font-weight:600}
        .td-num{text-align:right;font-family:Consolas,monospace;padding-right:5px}
        .td-prog{color:#555}
        .td-bal{font-weight:700}
        .bal-type{font-size:8px;font-weight:700;color:#555;margin-left:3px}
        .td-desc{text-align:left;padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0}
        .row-even td{background:#fff} .row-odd td{background:#fafafa}
        .row-opening td,.row-closing td{background:#fffde7;font-weight:700}
        .row-month td{background:#e8eaf6;text-align:center;font-weight:700;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:#283593;border-top:1.5px solid #888;border-bottom:1.5px solid #888;padding:4px}
        .row-month-total td{background:#f0f0f5;font-weight:700;border-top:1.5px solid #888;border-bottom:1.5px solid #888}
        .row-grand-total td{background:#e8eaf6;font-weight:800;font-size:9.5px;border-top:2.5px double #000;border-bottom:2.5px double #000}
        .gl-footer{border-top:2px solid #000;padding:8mm 15mm}
        .gl-footer__ts{text-align:center;font-size:9px;color:#888;margin-bottom:15mm;font-style:italic}
        .gl-footer__sigs{display:flex;justify-content:space-between}
        .gl-footer__sig{text-align:center;min-width:100px}
        .gl-footer__sig-line{border-top:1px solid #000;margin-top:20mm;padding-top:4px;font-size:10px;font-weight:600}
        @page{size:A4 ${orientation};margin:6mm}
      </style></head><body>${content.innerHTML}</body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 300);
  };

  /* ── PDF ─────────────────────────────────────────────────── */
  const handlePDF = (orientation = 'landscape') => {
    if (!processedData) return;
    const doc = new jsPDF(orientation, 'mm', 'a4');
    const pw  = doc.internal.pageSize.width;
    const mg  = orientation === 'portrait' ? 10 : 12;
    const fs  = orientation === 'portrait' ? 6 : 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(orientation === 'portrait' ? 13 : 15);
    doc.text(companyName.toUpperCase(), pw / 2, 12, { align: 'center' });
    doc.setFontSize(orientation === 'portrait' ? 11 : 12);
    doc.text('GENERAL LEDGER', pw / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Head of Account: ${processedData.ledgerName}`, mg, 24);
    doc.text(`F.Y.: ${getFinancialYear()}`, pw - mg, 24, { align: 'right' });
    doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, mg, 28);
    doc.setLineWidth(0.4);
    doc.line(mg, 30, pw - mg, 30);

    const bold  = { fontStyle: 'bold' };
    const boldR = { halign: 'right', fontStyle: 'bold' };
    const byY   = [255, 253, 231];
    const bgB   = [232, 234, 246];
    const bgG   = [240, 240, 245];

    const body = [];
    body.push([
      { content: '', styles: { fillColor: byY } }, { content: '', styles: { fillColor: byY } },
      { content: '', styles: { fillColor: byY } }, { content: '', styles: { fillColor: byY } },
      { content: '', styles: { fillColor: byY } },
      { content: `${fmtA(processedData.openBal)} ${processedData.openBalType}`, styles: { ...boldR, fillColor: byY } },
      { content: 'Opening Balance - B/F', styles: { ...bold, fillColor: byY } }
    ]);

    processedData.months.forEach(m => {
      body.push([{ content: `Month :  ${m.key}`, colSpan: 7, styles: { halign: 'center', ...bold, fillColor: bgB, textColor: [40, 53, 147] } }]);
      m.rows.forEach(r => body.push([
        { content: formatDay(r.date), styles: { halign: 'center' } },
        { content: fmt(r.receipt),    styles: { halign: 'right' } },
        { content: r.receipt > 0 ? fmtA(r.progReceipt) : '', styles: { halign: 'right', textColor: [100, 100, 100] } },
        { content: fmt(r.payment),    styles: { halign: 'right' } },
        { content: r.payment > 0 ? fmtA(r.progPayment) : '', styles: { halign: 'right', textColor: [100, 100, 100] } },
        { content: `${fmtA(r.runningBalance)} ${r.balType}`, styles: { halign: 'right', fontStyle: 'bold' } },
        r.particulars + (r.narration ? ` - ${r.narration}` : '')
      ]));
      body.push([
        { content: '', styles: { fillColor: bgG } },
        { content: fmtA(m.monthReceipt), styles: { ...boldR, fillColor: bgG } },
        { content: '', styles: { fillColor: bgG } },
        { content: fmtA(m.monthPayment), styles: { ...boldR, fillColor: bgG } },
        { content: '', styles: { fillColor: bgG } },
        { content: '', styles: { fillColor: bgG } },
        { content: `Total : ${m.key}`, styles: { ...bold, fillColor: bgG } }
      ]);
    });

    body.push([
      { content: '', styles: { fillColor: byY } }, { content: '', styles: { fillColor: byY } },
      { content: '', styles: { fillColor: byY } }, { content: '', styles: { fillColor: byY } },
      { content: '', styles: { fillColor: byY } },
      { content: `${fmtA(processedData.closeBal)} ${processedData.closeBalType}`, styles: { ...boldR, fillColor: byY } },
      { content: 'Closing Balance - C/F', styles: { ...bold, fillColor: byY } }
    ]);
    body.push([
      { content: '', styles: { fillColor: bgB } },
      { content: fmtA(processedData.totalReceipts), styles: { ...boldR, fillColor: bgB } },
      { content: '', styles: { fillColor: bgB } },
      { content: fmtA(processedData.totalPayments), styles: { ...boldR, fillColor: bgB } },
      { content: '', styles: { fillColor: bgB } }, { content: '', styles: { fillColor: bgB } },
      { content: 'GRAND TOTAL', styles: { ...bold, fillColor: bgB } }
    ]);

    autoTable(doc, {
      head: [['Day', 'Receipt', 'Prog. Rcpt', 'Payment', 'Prog. Pymt', 'Balance', 'Description']],
      body,
      startY: 32,
      margin: { left: mg, right: mg },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: fs, cellPadding: 1.5, lineColor: [150, 150, 150], lineWidth: 0.15, overflow: 'ellipsize' },
      headStyles: { fillColor: [230, 230, 235], textColor: [26, 26, 46], fontStyle: 'bold', fontSize: fs, halign: 'center' },
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'left' } }
    });

    doc.save(`general_ledger_${processedData.ledgerName.replace(/\s+/g, '_')}_${dayjs(fromDate).format('YYYY-MM-DD')}.pdf`);
  };

  /* ── Excel ───────────────────────────────────────────────── */
  const handleExcel = () => {
    if (!processedData) return;
    const rows = [
      [companyName.toUpperCase()],
      ['GENERAL LEDGER'],
      [`Head of Account: ${processedData.ledgerName}`, '', '', '', '', '', `F.Y.: ${getFinancialYear()}`],
      [`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`],
      [],
      ['Day', 'Receipt', 'Prog. Receipt', 'Payment', 'Prog. Payment', 'Balance', 'Description'],
      ['', '', '', '', '', `${fmtA(processedData.openBal)} ${processedData.openBalType}`, 'Opening Balance - B/F'],
    ];

    processedData.months.forEach(m => {
      rows.push([`Month: ${m.key}`]);
      m.rows.forEach(r => rows.push([
        formatDay(r.date),
        r.receipt || '', r.receipt > 0 ? r.progReceipt : '',
        r.payment || '', r.payment > 0 ? r.progPayment : '',
        `${r.runningBalance} ${r.balType}`,
        `${r.particulars}${r.narration ? ' - ' + r.narration : ''}`
      ]));
      rows.push(['', m.monthReceipt, '', m.monthPayment, '', '', `Total: ${m.key}`]);
    });

    rows.push(['', '', '', '', '', `${fmtA(processedData.closeBal)} ${processedData.closeBalType}`, 'Closing Balance - C/F']);
    rows.push(['', processedData.totalReceipts, '', processedData.totalPayments, '', '', 'GRAND TOTAL']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 34 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger');
    XLSX.writeFile(wb, `general_ledger_${processedData.ledgerName.replace(/\s+/g, '_')}_${dayjs(fromDate).format('YYYY-MM-DD')}.xlsx`);
  };

  /* ── register renderer ────────────────────────────────────── */
  const renderRegister = () => {
    if (!processedData) return null;

    const colStyle = { padding: 0, border: 'none' };
    const thBase   = {
      background: '#ECEEF2',
      border: '1px solid #9FA6B2',
      padding: '7px 6px',
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: '#1a1a2e',
      textAlign: 'center',
      whiteSpace: 'nowrap',
    };

    return (
      <Box
        ref={printRef}
        className="gl-register"
        style={{
          border: '1.5px solid #1a1a2e',
          borderRadius: 4,
          background: '#fff',
          overflow: 'hidden',
          fontFamily: "'Segoe UI',system-ui,sans-serif",
          color: '#1a1a2e',
        }}
      >
        {/* ── HEADER ── */}
        <Box
          style={{
            textAlign: 'center',
            padding: '20px 30px 14px',
            borderBottom: '2px solid #1a1a2e',
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: 'uppercase',
              lineHeight: 1.3,
            }}
          >
            {companyName}
          </Text>
          <Box my={8}>
            <Text
              component="span"
              style={{
                display: 'inline-block',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 8,
                textTransform: 'uppercase',
                padding: '4px 24px',
                borderTop: '2.5px double #1a1a2e',
                borderBottom: '2.5px double #1a1a2e',
              }}
            >
              GENERAL LEDGER
            </Text>
          </Box>
          <Group justify="space-between" pt={6} px={4}>
            <Stack gap={2} style={{ textAlign: 'left' }}>
              <Text size="sm">
                <Text component="span" fw={600}>Head of Account : </Text>
                <Text component="span" fw={700} tt="uppercase" style={{ letterSpacing: 0.5 }}>
                  {processedData.ledgerName}
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                Period : {formatDate(fromDate)} to {formatDate(toDate)}
              </Text>
            </Stack>
            <Stack gap={2} style={{ textAlign: 'right' }}>
              <Text size="sm">
                <Text component="span" fw={600}>F.Y. : </Text>
                <Text component="span" fw={700}>{getFinancialYear()}</Text>
              </Text>
              <Text size="xs" c="dimmed">Ledger Type : {processedData.ledgerType}</Text>
            </Stack>
          </Group>
        </Box>

        {/* ── TABLE ── */}
        <ScrollArea>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '31%' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={thBase}>Day</th>
                <th style={thBase}>Receipt</th>
                <th style={thBase}>Progressive</th>
                <th style={thBase}>Payment</th>
                <th style={thBase}>Progressive</th>
                <th style={thBase}>Balance</th>
                <th style={{ ...thBase, textAlign: 'left', paddingLeft: 10 }}>Description</th>
              </tr>
            </thead>

            <tbody>
              {/* Opening Balance */}
              <tr>
                {['', '', '', '', ''].map((_, i) => (
                  <td key={i} style={{ ...S.base, background: BG.opening, border: '1px solid #C8CDD2' }} />
                ))}
                <td
                  style={{
                    ...S.base, ...S.num, ...S.bal,
                    background: BG.opening,
                    border: '1px solid #C8CDD2',
                    borderBottom: '1.5px solid #999',
                  }}
                >
                  {fmtA(processedData.openBal)}
                  <span style={S.balType}>{processedData.openBalType}</span>
                </td>
                <td
                  style={{
                    ...S.base, ...S.desc,
                    background: BG.opening,
                    border: '1px solid #C8CDD2',
                    borderBottom: '1.5px solid #999',
                    fontWeight: 600,
                  }}
                >
                  Opening Balance — Brought Forward
                </td>
              </tr>

              {/* No transactions */}
              {processedData.months.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      ...S.base, ...S.desc,
                      textAlign: 'center',
                      padding: '24px',
                      color: '#999',
                      fontStyle: 'italic',
                    }}
                  >
                    No transactions in the selected period
                  </td>
                </tr>
              )}

              {/* Monthly groups */}
              {processedData.months.map((month, mIdx) => (
                <>
                  {/* Month header */}
                  <tr key={`mh-${mIdx}`}>
                    <td
                      colSpan={7}
                      style={{
                        ...S.base,
                        background: BG.month,
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        color: '#283593',
                        padding: '7px 10px',
                        borderTop: '1.5px solid #999',
                        borderBottom: '1.5px solid #999',
                        border: '1px solid #9FA6B2',
                      }}
                    >
                      Month :&nbsp;&nbsp;{month.key}
                    </td>
                  </tr>

                  {/* Daily rows */}
                  {month.rows.map((row, rIdx) => (
                    <tr
                      key={`r-${mIdx}-${rIdx}`}
                      style={{ background: rIdx % 2 === 0 ? BG.even : BG.odd }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#EEF2FF'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = rIdx % 2 === 0 ? BG.even : BG.odd; }}
                    >
                      <td style={{ ...S.base, ...S.day, border: '1px solid #C8CDD2' }}>
                        {formatDay(row.date)}
                      </td>
                      <td style={{ ...S.base, ...S.num, border: '1px solid #C8CDD2' }}>
                        {fmt(row.receipt)}
                      </td>
                      <td style={{ ...S.base, ...S.num, ...S.prog, border: '1px solid #C8CDD2' }}>
                        {row.receipt > 0 ? fmtA(row.progReceipt) : ''}
                      </td>
                      <td style={{ ...S.base, ...S.num, border: '1px solid #C8CDD2' }}>
                        {fmt(row.payment)}
                      </td>
                      <td style={{ ...S.base, ...S.num, ...S.prog, border: '1px solid #C8CDD2' }}>
                        {row.payment > 0 ? fmtA(row.progPayment) : ''}
                      </td>
                      <td style={{ ...S.base, ...S.num, ...S.bal, border: '1px solid #C8CDD2' }}>
                        {fmtA(row.runningBalance)}
                        <span style={S.balType}>{row.balType}</span>
                      </td>
                      <td
                        style={{
                          ...S.base, ...S.desc,
                          border: '1px solid #C8CDD2',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 0,
                        }}
                        title={row.particulars}
                      >
                        {row.particulars}
                        {row.narration && (
                          <span style={{ display: 'block', fontSize: 10, color: '#777', fontStyle: 'italic', marginTop: 1 }}>
                            {row.narration}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Month total */}
                  <tr key={`mt-${mIdx}`}>
                    <td style={{ ...S.base, background: BG.monthTotal, border: '1px solid #C8CDD2', borderTop: '1.5px solid #999', borderBottom: '1.5px solid #999' }} />
                    <td style={{ ...S.base, ...S.num, ...S.bal, background: BG.monthTotal, border: '1px solid #C8CDD2', borderTop: '1.5px solid #999', borderBottom: '1.5px solid #999' }}>
                      {fmtA(month.monthReceipt)}
                    </td>
                    <td style={{ ...S.base, background: BG.monthTotal, border: '1px solid #C8CDD2', borderTop: '1.5px solid #999', borderBottom: '1.5px solid #999' }} />
                    <td style={{ ...S.base, ...S.num, ...S.bal, background: BG.monthTotal, border: '1px solid #C8CDD2', borderTop: '1.5px solid #999', borderBottom: '1.5px solid #999' }}>
                      {fmtA(month.monthPayment)}
                    </td>
                    <td style={{ ...S.base, background: BG.monthTotal, border: '1px solid #C8CDD2', borderTop: '1.5px solid #999', borderBottom: '1.5px solid #999' }} />
                    <td style={{ ...S.base, background: BG.monthTotal, border: '1px solid #C8CDD2', borderTop: '1.5px solid #999', borderBottom: '1.5px solid #999' }} />
                    <td style={{ ...S.base, ...S.desc, ...S.bal, background: BG.monthTotal, border: '1px solid #C8CDD2', borderTop: '1.5px solid #999', borderBottom: '1.5px solid #999' }}>
                      Total : {month.key}
                    </td>
                  </tr>
                </>
              ))}

              {/* Closing Balance */}
              <tr>
                {['', '', '', '', ''].map((_, i) => (
                  <td key={i} style={{ ...S.base, background: BG.closing, border: '1px solid #C8CDD2', borderTop: '2px solid #1a1a2e' }} />
                ))}
                <td style={{ ...S.base, ...S.num, ...S.bal, background: BG.closing, border: '1px solid #C8CDD2', borderTop: '2px solid #1a1a2e' }}>
                  {fmtA(processedData.closeBal)}
                  <span style={S.balType}>{processedData.closeBalType}</span>
                </td>
                <td style={{ ...S.base, ...S.desc, background: BG.closing, border: '1px solid #C8CDD2', borderTop: '2px solid #1a1a2e', fontWeight: 700 }}>
                  Closing Balance — Carried Forward
                </td>
              </tr>

              {/* Grand Total */}
              <tr>
                <td style={{ ...S.base, background: BG.grandTotal, border: '1px solid #9FA6B2', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e' }} />
                <td style={{ ...S.base, ...S.num, fontWeight: 800, fontSize: 12.5, background: BG.grandTotal, border: '1px solid #9FA6B2', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e' }}>
                  {fmtA(processedData.totalReceipts)}
                </td>
                <td style={{ ...S.base, background: BG.grandTotal, border: '1px solid #9FA6B2', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e' }} />
                <td style={{ ...S.base, ...S.num, fontWeight: 800, fontSize: 12.5, background: BG.grandTotal, border: '1px solid #9FA6B2', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e' }}>
                  {fmtA(processedData.totalPayments)}
                </td>
                <td style={{ ...S.base, background: BG.grandTotal, border: '1px solid #9FA6B2', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e' }} />
                <td style={{ ...S.base, background: BG.grandTotal, border: '1px solid #9FA6B2', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e' }} />
                <td style={{ ...S.base, ...S.desc, fontWeight: 800, fontSize: 12.5, color: '#283593', background: BG.grandTotal, border: '1px solid #9FA6B2', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e' }}>
                  GRAND TOTAL
                </td>
              </tr>
            </tbody>
          </table>
        </ScrollArea>

        {/* ── FOOTER ── */}
        <Box style={{ borderTop: '2px solid #1a1a2e', padding: '20px 30px' }}>
          <Text ta="center" size="xs" c="dimmed" mb="xl" fs="italic">
            Generated on {dayjs().format('DD/MM/YYYY HH:mm:ss')} &nbsp;|&nbsp; Dairy Cooperative Management System
          </Text>
          <Group justify="space-between" px="xl">
            <Stack gap={0} align="center" style={{ minWidth: 140 }}>
              <Box style={{ borderTop: '1px solid #1a1a2e', marginTop: 40, paddingTop: 6, width: '100%' }}>
                <Text ta="center" size="xs" fw={600} style={{ letterSpacing: 0.5 }}>President</Text>
              </Box>
            </Stack>
            <Stack gap={0} align="center" style={{ minWidth: 140 }}>
              <Box style={{ borderTop: '1px solid #1a1a2e', marginTop: 40, paddingTop: 6, width: '100%' }}>
                <Text ta="center" size="xs" fw={600} style={{ letterSpacing: 0.5 }}>Secretary</Text>
              </Box>
            </Stack>
          </Group>
        </Box>
      </Box>
    );
  };

  const txnCount = processedData?.months.reduce((s, m) => s + m.rows.length, 0) || 0;

  return (
    <Container size="xl" py="md">
      {/* ── TOOLBAR ── */}
      <Paper p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <IconBook2 size={22} style={{ marginBottom: 4, color: 'var(--mantine-color-indigo-6)' }} />
            <Title order={4} style={{ marginBottom: 2 }}>General Ledger</Title>
            <Divider orientation="vertical" style={{ height: 24 }} />

            <Select
              label="Ledger Account"
              value={selectedLedger}
              onChange={setSelectedLedger}
              placeholder="-- Select Ledger --"
              data={ledgers.map(l => ({ value: l._id, label: `${l.ledgerName} (${l.ledgerType})` }))}
              searchable
              clearable
              size="xs"
              w={260}
              radius="md"
            />
            <DatePickerInput
              label="From"
              value={fromDate}
              onChange={setFromDate}
              valueFormat="DD/MM/YYYY"
              size="xs"
              leftSection={<IconCalendar size={14} />}
              w={150}
              clearable={false}
              radius="md"
              maxDate={toDate}
            />
            <DatePickerInput
              label="To"
              value={toDate}
              onChange={setToDate}
              valueFormat="DD/MM/YYYY"
              size="xs"
              leftSection={<IconCalendar size={14} />}
              w={150}
              clearable={false}
              radius="md"
              minDate={fromDate}
            />
            <Button
              size="xs"
              radius="md"
              leftSection={<IconSearch size={14} />}
              onClick={fetchReport}
              loading={loading}
              disabled={!selectedLedger || !fromDate || !toDate}
            >
              Generate
            </Button>
          </Group>

          <Group gap="xs">
            {reportData && (
              <Badge variant="light" size="lg" radius="md" color="blue">
                {txnCount} entries
              </Badge>
            )}

            {/* Print */}
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Button variant="light" size="xs" radius="md" leftSection={<IconPrinter size={14} />} disabled={!reportData}>
                  Print
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Print Orientation</Menu.Label>
                <Menu.Item leftSection={<IconRectangle size={16} color="var(--mantine-color-blue-6)" />} onClick={() => handlePrint('landscape')}>
                  A4 Landscape
                </Menu.Item>
                <Menu.Item leftSection={<IconRectangleVertical size={16} color="var(--mantine-color-blue-6)" />} onClick={() => handlePrint('portrait')}>
                  A4 Portrait
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Export */}
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Button variant="light" color="gray" size="xs" radius="md" leftSection={<IconDownload size={14} />} disabled={!reportData}>
                  Export
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>PDF Export</Menu.Label>
                <Menu.Item leftSection={<IconRectangle size={16} color="var(--mantine-color-red-6)" />} onClick={() => handlePDF('landscape')}>
                  PDF Landscape
                </Menu.Item>
                <Menu.Item leftSection={<IconRectangleVertical size={16} color="var(--mantine-color-red-6)" />} onClick={() => handlePDF('portrait')}>
                  PDF Portrait
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconFileSpreadsheet size={16} color="var(--mantine-color-green-6)" />} onClick={handleExcel}>
                  Export as Excel
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {/* ── REPORT ── */}
      {loading && (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="md" fw={500} c="dimmed">Loading general ledger...</Text>
          </Stack>
        </Center>
      )}

      {!loading && reportData && renderRegister()}

      {!loading && !reportData && (
        <Paper radius="md" withBorder shadow="sm" p="xl" ta="center">
          <IconBook2 size={56} stroke={1.2} opacity={0.25} />
          <Text c="dimmed" size="md" mt="sm" fw={500}>
            Select a ledger account and date range, then click Generate
          </Text>
          <Text c="dimmed" size="xs" mt={4}>
            Traditional register-style report with month-wise grouping and progressive totals
          </Text>
        </Paper>
      )}
    </Container>
  );
};

export default GeneralLedger;
