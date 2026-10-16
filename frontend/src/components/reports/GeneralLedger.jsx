import { Fragment, useState, useEffect, useRef, useMemo } from 'react';
import {
  Box, Button, Center, Container, Divider, Group, Loader,
  Menu, Paper, Select, Stack, Text, Title, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconBook2, IconCalendar, IconDownload, IconFileSpreadsheet,
  IconPrinter, IconRectangle, IconRectangleVertical,
  IconSearch
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import A4PrintPreview from './shared/A4PrintPreview';
import { buildGeneralLedgerPrintHtml } from './generalLedgerPrint';

/* ── number formatting ──────────────────────────────────────── */
const fmt = (v) => {
  const n = parseFloat(v || 0);
  if (n === 0) return '';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtA = (v) =>
  parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── register grid styles ───────────────────────────────────────
   Only the header row is shaded; data rows stay plain white. Month, total
   and balance rows are set apart with bold text and heavier rules. */
const FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const LINE = '1px solid #9AA0A6';
const RULE = '1.5px solid #3A3F47';

const S = {
  base: {
    fontFamily: FONT,
    fontSize: 13,
    padding: '5px 8px',
    verticalAlign: 'middle',
    border: LINE,
    background: '#fff',
    color: '#1a1a1a',
  },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  day: { textAlign: 'center', fontWeight: 600 },
  desc: { textAlign: 'left' },
  bal: { fontWeight: 700 },
  balType: { fontSize: 11, fontWeight: 600, marginLeft: 4 },
  total: { fontWeight: 700, borderTop: RULE, borderBottom: RULE },
  grand: { fontWeight: 700, borderTop: RULE, borderBottom: '3px double #3A3F47' },
};

const TH = {
  background: '#E9ECEF',
  border: LINE,
  padding: '7px 6px',
  fontFamily: FONT,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: '#1a1a1a',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const GeneralLedger = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(new Date());
  const [printOrientation, setPrintOrientation] = useState(null); // preview open when set
  const ledgerInputRef = useRef(null);

  const companyName = selectedCompany?.societyName || selectedCompany?.companyName || 'Dairy Co-operative Society';
  const societyCode = selectedCompany?.societyCode || '';
  const societyPlace = selectedCompany?.address || selectedCompany?.district || '';

  // Cursor starts in the Ledger Account field when the page opens.
  useEffect(() => {
    const t = setTimeout(() => ledgerInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

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
      setGeneratedAt(new Date());
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
    // Use the explicit isDebitNature flag from backend when available — avoids
    // edge cases where openingBalanceType is 'Dr' on a credit-normal ledger
    // (e.g. zero opening balance, or unusual negative balance).
    const isDebit = reportData.isDebitNature !== undefined
      ? reportData.isDebitNature
      : openBalType === 'Dr';

    let progR = 0, progP = 0;
    const months = [];
    let cur = null;

    txns.forEach(t => {
      const mKey   = dayjs(t.date).format('MMM-YYYY');
      // Receipt/Payment Voucher entries preserve the side they were entered
      // on (see backend receiptAmount/paymentAmount); other voucher types
      // fall back to raw Dr/Cr amounts.
      const receipt = t.receiptAmount ?? t.debit  ?? 0;
      const payment = t.paymentAmount ?? t.credit ?? 0;
      progR += receipt;
      progP += payment;

      const row = {
        ...t, receipt, payment, progReceipt: progR, progPayment: progP,
        runningBalance: t.balance || 0,
        balType: t.balanceType || openBalType,
        column: t.column || 'cash'
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
  // Dedicated black & white A4 layout built from the register data. The Print
  // menu opens a preview of this exact document; printing goes from there.
  const printHtml = useMemo(() => {
    if (!printOrientation || !processedData) return '';
    return buildGeneralLedgerPrintHtml(processedData, {
      societyName: companyName,
      societyCode,
      place: societyPlace,
      period: `${formatDate(fromDate)} to ${formatDate(toDate)}`,
      financialYear: getFinancialYear(),
      generatedOn: dayjs(generatedAt).format('DD/MM/YYYY HH:mm:ss'),
      title: `General Ledger - ${processedData.ledgerName}`
    }, printOrientation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printOrientation, processedData, companyName, societyCode, societyPlace, generatedAt]);

  const handlePrint = (orientation = 'landscape') => setPrintOrientation(orientation);

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
      head: [['Day', 'Receipt', 'Prog. Receipt', 'Payment', 'Prog. Payment', 'Balance', 'Description']],
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
    ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger');
    XLSX.writeFile(wb, `general_ledger_${processedData.ledgerName.replace(/\s+/g, '_')}_${dayjs(fromDate).format('YYYY-MM-DD')}.xlsx`);
  };

  /* ── register renderer ────────────────────────────────────── */
  const renderRegister = () => {
    if (!processedData) return null;

    const blank = (n, extra = {}) =>
      Array.from({ length: n }, (_, i) => <td key={i} style={{ ...S.base, ...extra }} />);

    return (
      <Box
        style={{
          border: '1.5px solid #3A3F47',
          borderRadius: 4,
          background: '#fff',
          fontFamily: FONT,
          color: '#1a1a1a',
        }}
      >
        {/* ── HEADER ── */}
        <Box style={{ textAlign: 'center', padding: '16px 24px 12px', borderBottom: '1.5px solid #3A3F47' }}>
          <Text style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1.3 }}>
            {companyName}
          </Text>
          {societyCode && <Text style={{ fontFamily: FONT, fontSize: 13 }}>Society Code: {societyCode}</Text>}
          {societyPlace && <Text style={{ fontFamily: FONT, fontSize: 13 }}>{societyPlace}</Text>}
          <Box my={8}>
            <Text
              component="span"
              style={{
                display: 'inline-block',
                fontFamily: FONT,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 6,
                textTransform: 'uppercase',
                padding: '3px 22px',
                borderTop: '1.5px solid #3A3F47',
                borderBottom: '1.5px solid #3A3F47',
              }}
            >
              GENERAL LEDGER
            </Text>
          </Box>
          <Group justify="space-between" align="flex-end" pt={6} px={4}>
            <Stack gap={2} style={{ textAlign: 'left' }}>
              <Text style={{ fontFamily: FONT, fontSize: 15 }}>
                <Text component="span" fw={600} inherit>Head of Account : </Text>
                <Text component="span" fw={700} tt="uppercase" inherit style={{ fontSize: 17, letterSpacing: 0.5 }}>
                  {processedData.ledgerName}
                </Text>
              </Text>
              <Text style={{ fontFamily: FONT, fontSize: 13 }} c="dimmed">
                Period : {formatDate(fromDate)} to {formatDate(toDate)}
              </Text>
            </Stack>
            <Stack gap={2} style={{ textAlign: 'right' }}>
              <Text style={{ fontFamily: FONT, fontSize: 14 }}>
                <Text component="span" fw={600} inherit>F.Y. : </Text>
                <Text component="span" fw={700} inherit>{getFinancialYear()}</Text>
              </Text>
              <Text style={{ fontFamily: FONT, fontSize: 13 }} c="dimmed">Ledger Type : {processedData.ledgerType}</Text>
            </Stack>
          </Group>
        </Box>

        {/* ── TABLE ── (fixed layout fits the width, so no scroll container) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '36%' }} />
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th style={TH}>Day</th>
              <th style={TH}>Receipt</th>
              <th style={TH}>Prog. Receipt</th>
              <th style={TH}>Payment</th>
              <th style={TH}>Prog. Payment</th>
              <th style={TH}>Balance</th>
              <th style={{ ...TH, textAlign: 'left', paddingLeft: 10 }}>Description</th>
            </tr>
          </thead>

          <tbody>
            {/* Opening Balance */}
            <tr>
              {blank(5)}
              <td style={{ ...S.base, ...S.num, ...S.bal }}>
                {fmtA(processedData.openBal)}
                <span style={S.balType}>{processedData.openBalType}</span>
              </td>
              <td style={{ ...S.base, ...S.desc, ...S.bal }}>Opening Balance — Brought Forward</td>
            </tr>

            {/* No transactions */}
            {processedData.months.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...S.base, textAlign: 'center', padding: 24, color: '#777', fontStyle: 'italic' }}>
                  No transactions in the selected period
                </td>
              </tr>
            )}

            {/* Monthly groups */}
            {processedData.months.map((month) => (
              <Fragment key={month.key}>
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      ...S.base,
                      textAlign: 'center',
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      padding: '6px 10px',
                      borderTop: RULE,
                    }}
                  >
                    Month :&nbsp;&nbsp;{month.key}
                  </td>
                </tr>

                {month.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td style={{ ...S.base, ...S.day }}>{formatDay(row.date)}</td>
                    <td style={{ ...S.base, ...S.num }}>{fmt(row.receipt)}</td>
                    <td style={{ ...S.base, ...S.num }}>{row.receipt > 0 ? fmtA(row.progReceipt) : ''}</td>
                    <td style={{ ...S.base, ...S.num }}>{fmt(row.payment)}</td>
                    <td style={{ ...S.base, ...S.num }}>{row.payment > 0 ? fmtA(row.progPayment) : ''}</td>
                    <td style={{ ...S.base, ...S.num, ...S.bal }}>
                      {fmtA(row.runningBalance)}
                      <span style={S.balType}>{row.balType}</span>
                    </td>
                    <td
                      style={{ ...S.base, ...S.desc, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 }}
                      title={row.particulars}
                    >
                      {row.particulars}
                      {row.narration && (
                        <span style={{ display: 'block', fontSize: 11.5, color: '#555', fontStyle: 'italic', marginTop: 1 }}>
                          {row.narration}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Month total */}
                <tr>
                  {blank(1, S.total)}
                  <td style={{ ...S.base, ...S.num, ...S.total }}>{fmtA(month.monthReceipt)}</td>
                  {blank(1, S.total)}
                  <td style={{ ...S.base, ...S.num, ...S.total }}>{fmtA(month.monthPayment)}</td>
                  {blank(2, S.total)}
                  <td style={{ ...S.base, ...S.desc, ...S.total }}>Total : {month.key}</td>
                </tr>
              </Fragment>
            ))}

            {/* Closing Balance */}
            <tr>
              {blank(5, { borderTop: RULE })}
              <td style={{ ...S.base, ...S.num, ...S.bal, borderTop: RULE }}>
                {fmtA(processedData.closeBal)}
                <span style={S.balType}>{processedData.closeBalType}</span>
              </td>
              <td style={{ ...S.base, ...S.desc, ...S.bal, borderTop: RULE }}>Closing Balance — Carried Forward</td>
            </tr>

            {/* Grand Total */}
            <tr>
              {blank(1, S.grand)}
              <td style={{ ...S.base, ...S.num, ...S.grand }}>{fmtA(processedData.totalReceipts)}</td>
              {blank(1, S.grand)}
              <td style={{ ...S.base, ...S.num, ...S.grand }}>{fmtA(processedData.totalPayments)}</td>
              {blank(2, S.grand)}
              <td style={{ ...S.base, ...S.desc, ...S.grand }}>GRAND TOTAL</td>
            </tr>
          </tbody>
        </table>

        {/* ── FOOTER: President centred, Secretary beside it, Generated On ── */}
        <Box style={{ padding: '30px 24px 10px', borderTop: '1.5px solid #3A3F47', fontFamily: FONT }}>
          <Box style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}>
            <Box style={{ gridColumn: 2, minWidth: 150, borderTop: '1px solid #3A3F47', paddingTop: 3, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
              President
            </Box>
            <Box style={{ gridColumn: 3, justifySelf: 'start', marginLeft: 60, minWidth: 150, borderTop: '1px solid #3A3F47', paddingTop: 3, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
              Secretary
            </Box>
          </Box>
          <Text mt={8} style={{ fontFamily: FONT, fontSize: 11.5, color: '#555' }}>
            Generated On : {dayjs(generatedAt).format('DD/MM/YYYY HH:mm:ss')}
          </Text>
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
              ref={ledgerInputRef}
              label="Ledger Account"
              value={selectedLedger}
              onChange={setSelectedLedger}
              placeholder="-- Select Ledger --"
              data={ledgers.map(l => ({ value: l._id, label: `${l.ledgerName} (${l.ledgerType})` }))}
              searchable
              clearable
              size="xs"
              w={340}
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

      {/* Print preview — the iframe shows the exact A4 document that gets printed */}
      <A4PrintPreview
        html={printHtml}
        orientation={printOrientation}
        title="General Ledger"
        onClose={() => setPrintOrientation(null)}
      />

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
