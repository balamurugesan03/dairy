import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { dayBookAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import {
  Container, Paper, Text, Group, LoadingOverlay, Button,
  Title, Divider, Menu, Badge, Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconBook, IconPrinter, IconFileTypePdf,
  IconFileSpreadsheet, IconCalendar,
  IconDownload, IconArrowDown, IconArrowUp,
  IconSearch, IconRectangle, IconRectangleVertical, IconX
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './DayBook.css';

const PRESETS = [
  { value: 'today',         label: 'Today' },
  { value: 'thisWeek',      label: 'This Week' },
  { value: 'thisMonth',     label: 'This Month' },
  { value: 'lastMonth',     label: 'Last Month' },
  { value: 'thisQuarter',   label: 'This Quarter' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom',        label: 'Custom' }
];

const getPresetRange = (preset) => {
  const now = dayjs();
  switch (preset) {
    case 'today':       return [now.startOf('day').toDate(),   now.endOf('day').toDate()];
    case 'thisWeek':    return [now.startOf('week').toDate(),  now.endOf('week').toDate()];
    case 'thisMonth':   return [now.startOf('month').toDate(), now.endOf('month').toDate()];
    case 'lastMonth':   return [now.subtract(1, 'month').startOf('month').toDate(), now.subtract(1, 'month').endOf('month').toDate()];
    case 'thisQuarter': return [now.startOf('quarter').toDate(), now.endOf('quarter').toDate()];
    case 'financialYear': {
      const fyStart = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fyStart, 3, 1), new Date(fyStart + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

const DayBook = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState('thisMonth');
  const [dateRange, setDateRange] = useState(getPresetRange('thisMonth'));
  const [dayBookData, setDayBookData] = useState(null);
  const printRef = useRef();

  const [fromDate, toDate] = dateRange;

  const handlePresetChange = (val) => {
    setPreset(val);
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';

  // --- Fetch ---
  const fetchDayBook = async (start, end) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const response = await dayBookAPI.get({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD')
      });
      setDayBookData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch day book');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    fetchDayBook(fromDate, toDate);
  };

  // --- Format helpers ---
  const fmt = (amount) => {
    const num = parseFloat(amount || 0);
    if (num === 0) return '';
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtAlways = (amount) => {
    const num = parseFloat(amount || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');
  const formatDateLong = (date) => dayjs(date).format('dddd, DD MMMM YYYY');
  const formatDateShort = (date) => dayjs(date).format('DD MMM YYYY');

  // --- Build day-wise cards data ---
  // Fill in all dates in range (even dates with no data)
  const dayCards = useMemo(() => {
    if (!dayBookData?.dayWiseData) return [];

    const dayMap = new Map();
    for (const day of dayBookData.dayWiseData) {
      dayMap.set(day.date, day);
    }

    const cards = [];
    const start = dayjs(fromDate).startOf('day');
    const end = dayjs(toDate).startOf('day');
    let cursor = start;
    let prevClosing = dayBookData.summary?.openingBalance || 0;

    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      const dateKey = cursor.format('YYYY-MM-DD');
      const dayData = dayMap.get(dateKey);

      if (dayData) {
        // Build receipt/payment entries
        const mapEntry = (entry) => {
          const isMilkEntry = entry.voucherType === 'MilkPurchase' || entry.voucherType === 'ProducersDue';
          return {
            description: entry.ledgerName || entry.narration || 'Miscellaneous',
            narration: entry.narration || '',
            voucherNumber: entry.voucherNumber || '',
            cash: isMilkEntry ? 0 : entry.amount,
            adjustment: isMilkEntry ? entry.amount : 0,
            total: entry.amount,
            isMilkEntry
          };
        };

        const receipts = dayData.receiptSide.map(mapEntry);
        const payments = dayData.paymentSide.map(mapEntry);

        const rCash = receipts.reduce((s, e) => s + (e.cash || 0), 0);
        const rAdj = receipts.reduce((s, e) => s + (e.adjustment || 0), 0);
        const rTotal = receipts.reduce((s, e) => s + (e.total || 0), 0);
        const pCash = payments.reduce((s, e) => s + (e.cash || 0), 0);
        const pAdj = payments.reduce((s, e) => s + (e.adjustment || 0), 0);
        const pTotal = payments.reduce((s, e) => s + (e.total || 0), 0);

        cards.push({
          date: dateKey,
          hasData: true,
          receipts,
          payments,
          receiptTotals: { cash: rCash, adj: rAdj, total: rTotal },
          paymentTotals: { cash: pCash, adj: pAdj, total: pTotal },
          openingBalance: dayData.openingBalance,
          closingBalance: dayData.closingBalance
        });
        prevClosing = dayData.closingBalance;
      } else {
        // No transactions on this date
        cards.push({
          date: dateKey,
          hasData: false,
          receipts: [],
          payments: [],
          receiptTotals: { cash: 0, adj: 0, total: 0 },
          paymentTotals: { cash: 0, adj: 0, total: 0 },
          openingBalance: prevClosing,
          closingBalance: prevClosing
        });
      }

      cursor = cursor.add(1, 'day');
    }

    return cards;
  }, [dayBookData, fromDate, toDate]);

  // --- Render a side table (receipt or payment) ---
  const renderSideTable = (side, entries, totals, openBal, closeBal) => {
    const isReceipt = side === 'receipt';
    const balanceLabel = isReceipt ? 'Opening Balance' : 'Closing Balance';
    const balanceAmount = isReceipt ? openBal : closeBal;

    return (
      <div className={`db-side db-side--${side}`}>
        <div className="db-side__header">
          <span className={`db-side__icon db-side__icon--${side}`}>
            {isReceipt ? <IconArrowDown size={14} /> : <IconArrowUp size={14} />}
          </span>
          <span className="db-side__title">{isReceipt ? 'DEBIT (Dr)' : 'CREDIT (Cr)'}</span>
          <span className="db-side__subtitle">{isReceipt ? '(Receipts / Money In)' : '(Payments / Money Out)'}</span>
        </div>

        <div className="db-side__body">
          <table className="db-ledger">
            <thead>
              <tr>
                <th className="db-col-desc">Description</th>
                <th className="db-col-vno">{isReceipt ? 'Receipt No' : 'Voucher No'}</th>
                <th className="db-col-amt">Cash</th>
                <th className="db-col-amt">Adjustment</th>
                <th className="db-col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr className="db-empty-row">
                  <td colSpan={5}>
                    <div className="db-no-data">No transactions</div>
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={idx} className={`db-data-row ${entry.isMilkEntry ? 'db-row-milk' : idx % 2 === 0 ? 'db-row-even' : 'db-row-odd'}`}>
                    <td className="db-cell-desc" title={entry.description}>
                      {entry.description}
                      {entry.narration && <span className="db-cell-narration">{entry.narration}</span>}
                    </td>
                    <td className="db-cell-vno">{entry.voucherNumber}</td>
                    <td className="db-cell-amt">{fmt(entry.cash)}</td>
                    <td className="db-cell-amt">{fmt(entry.adjustment)}</td>
                    <td className="db-cell-total">{fmt(entry.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer totals */}
        <div className="db-side__footer">
          <table className="db-ledger db-ledger--footer">
            <tbody>
              <tr className="db-summary-row db-day-total">
                <td className="db-footer-label">Day Total</td>
                <td className="db-footer-vno"></td>
                <td className="db-footer-amt">{fmtAlways(totals.cash)}</td>
                <td className="db-footer-amt">{fmtAlways(totals.adj)}</td>
                <td className="db-footer-total">{fmtAlways(totals.total)}</td>
              </tr>
              <tr className="db-summary-row db-balance-row">
                <td className="db-footer-label">{balanceLabel}</td>
                <td className="db-footer-vno"></td>
                <td className="db-footer-amt">{fmtAlways(balanceAmount)}</td>
                <td className="db-footer-amt"></td>
                <td className="db-footer-total">{fmtAlways(balanceAmount)}</td>
              </tr>
              <tr className="db-summary-row db-closing-row">
                <td className="db-footer-label">Closing Balance</td>
                <td className="db-footer-vno"></td>
                <td className="db-footer-amt">{fmtAlways(closeBal)}</td>
                <td className="db-footer-amt"></td>
                <td className="db-footer-total">{fmtAlways(closeBal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- Render a single day card ---
  const renderDayCard = (card, idx) => (
    <div key={card.date} className="db-card">
      {/* Card Header */}
      <div className="db-card__header">
        <div className="db-card__company">{companyName}</div>
        <div className="db-card__title-row">
          <span className="db-card__title">DAY BOOK</span>
        </div>
        <div className="db-card__date">{formatDateLong(card.date)}</div>
        <div className="db-card__meta">
          <span>Opening: {fmtAlways(card.openingBalance)}</span>
          <span>Closing: {fmtAlways(card.closingBalance)}</span>
        </div>
      </div>

      {/* Card Body - Two panels */}
      <div className="db-card__body">
        {renderSideTable('receipt', card.receipts, card.receiptTotals, card.openingBalance, card.closingBalance)}
        {renderSideTable('payment', card.payments, card.paymentTotals, card.openingBalance, card.closingBalance)}
      </div>
    </div>
  );

  // --- PRINT ---
  const handlePrint = (orientation = 'landscape') => {
    const content = printRef.current;
    if (!content) return;

    const isPortrait = orientation === 'portrait';
    const fontSize = isPortrait ? '9px' : '11px';
    const descMax = isPortrait ? '100px' : '140px';
    const thFontSize = isPortrait ? '7.5px' : '8.5px';
    const tdFontSize = isPortrait ? '8px' : '9px';
    const ledgerFontSize = isPortrait ? '8.5px' : '9.5px';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Day Book - ${formatDateShort(fromDate)} to ${formatDateShort(toDate)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; color: #1a1a2e; background: #fff; font-size: ${fontSize}; }

    .db-card { page-break-after: always; padding: ${isPortrait ? '6mm' : '10mm'}; }
    .db-card:last-child { page-break-after: auto; }

    .db-card__header { text-align: center; padding-bottom: 8px; border-bottom: 2px solid #1a1a2e; margin-bottom: 8px; }
    .db-card__company { font-size: ${isPortrait ? '14px' : '16px'}; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .db-card__title-row { margin: 4px 0; }
    .db-card__title { font-size: ${isPortrait ? '11px' : '13px'}; font-weight: 700; letter-spacing: 5px; text-transform: uppercase; padding: 2px 16px; border-top: 2px solid #4a4a6a; border-bottom: 2px solid #4a4a6a; color: #4a4a6a; }
    .db-card__date { font-size: ${isPortrait ? '10px' : '11px'}; margin-top: 4px; font-weight: 600; }
    .db-card__meta { display: flex; justify-content: space-between; font-size: ${isPortrait ? '9px' : '10px'}; color: #555; margin-top: 4px; padding: 0 20px; }

    .db-card__body { display: flex; gap: ${isPortrait ? '4px' : '8px'}; }
    .db-side { flex: 1; }

    .db-side__header { display: flex; align-items: center; gap: 6px; padding: ${isPortrait ? '4px 6px' : '5px 8px'}; font-weight: 700; font-size: ${isPortrait ? '9px' : '11px'}; letter-spacing: 2px; text-transform: uppercase; border-bottom: 2px solid #333; }
    .db-side--receipt .db-side__header { background: #e8f5e9; color: #2e7d32; }
    .db-side--payment .db-side__header { background: #fce4ec; color: #c62828; }
    .db-side__icon { display: none; }
    .db-side__subtitle { font-size: ${isPortrait ? '7px' : '8px'}; font-weight: 400; letter-spacing: 0; }

    .db-side__body { min-height: ${isPortrait ? '60px' : '100px'}; }

    .db-ledger { width: 100%; border-collapse: collapse; font-size: ${ledgerFontSize}; }
    .db-ledger thead th { background: #f5f5fa; border: 1px solid #ccc; padding: ${isPortrait ? '2px 3px' : '3px 5px'}; font-weight: 700; font-size: ${thFontSize}; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }
    .db-ledger thead th.db-col-desc { text-align: left; }
    .db-ledger tbody td { border: 1px solid #e0e0e0; padding: ${isPortrait ? '1.5px 3px' : '2px 5px'}; font-size: ${tdFontSize}; }
    .db-cell-desc { text-align: left; max-width: ${descMax}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .db-cell-vno { text-align: center; color: #666; font-size: ${isPortrait ? '7.5px' : '8.5px'}; }
    .db-cell-amt { text-align: right; font-variant-numeric: tabular-nums; }
    .db-cell-total { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
    .db-row-even { background: #fff; }
    .db-row-odd { background: #fafafa; }

    .db-side__footer { border-top: 2px solid #333; }
    .db-ledger--footer td { border: 1px solid #ccc; padding: ${isPortrait ? '2px 3px' : '3px 5px'}; font-size: ${tdFontSize}; }
    .db-footer-label { text-align: left; font-weight: 600; }
    .db-footer-vno { text-align: center; }
    .db-footer-amt { text-align: right; font-variant-numeric: tabular-nums; }
    .db-footer-total { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }

    .db-day-total td { background: #f0f0f5; font-weight: 600; }
    .db-balance-row td { background: #fafaf5; }
    .db-closing-row td { background: #e8e8f0; font-weight: 700; border-top: 1.5px solid #333; border-bottom: 3px double #333; }

    .db-no-data { text-align: center; padding: 20px; color: #999; font-style: italic; font-size: 10px; }
    .db-empty-row td { border: none !important; }

    @page { size: A4 ${orientation}; margin: 6mm; }
  </style>
</head>
<body>${content.innerHTML}</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  // --- PDF Export ---
  const handlePDFExport = (orientation = 'landscape') => {
    const doc = new jsPDF(orientation, 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const isPortrait = orientation === 'portrait';
    const margin = isPortrait ? 10 : 14;
    const halfW = (pageWidth - margin * 2 - 2) / 2;
    const baseFontSize = isPortrait ? 6 : 7;
    const headFontSize = isPortrait ? 6 : 7;
    const closingFontSize = isPortrait ? 6.5 : 8;

    const head = [['Description', 'No', 'Cash', 'Adj', 'Total']];
    const colStyles = {
      0: { halign: 'left', cellWidth: halfW * 0.36 },
      1: { halign: 'center', cellWidth: halfW * 0.14 },
      2: { halign: 'right', cellWidth: halfW * 0.18 },
      3: { halign: 'right', cellWidth: halfW * 0.14 },
      4: { halign: 'right', cellWidth: halfW * 0.18, fontStyle: 'bold' }
    };

    const buildBody = (entries, totals, balLabel, balAmt, closeBal) => {
      const body = entries.map(e => [
        e.description || '', e.voucherNumber || '',
        fmt(e.cash), fmt(e.adjustment), fmt(e.total)
      ]);

      const bold = { fontStyle: 'bold' };
      const boldRight = { halign: 'right', fontStyle: 'bold' };
      const bg1 = [240, 240, 245];
      const bg2 = [232, 232, 240];

      body.push([
        { content: 'Day Total', styles: { ...bold, fillColor: bg1 } },
        { content: '', styles: { fillColor: bg1 } },
        { content: fmtAlways(totals.cash), styles: { ...boldRight, fillColor: bg1 } },
        { content: fmtAlways(totals.adj), styles: { ...boldRight, fillColor: bg1 } },
        { content: fmtAlways(totals.total), styles: { ...boldRight, fillColor: bg1 } }
      ]);
      body.push([
        { content: balLabel, styles: bold }, '',
        { content: fmtAlways(balAmt), styles: boldRight }, '',
        { content: fmtAlways(balAmt), styles: boldRight }
      ]);
      body.push([
        { content: 'Closing Balance', styles: { ...bold, fillColor: bg2, fontSize: closingFontSize } },
        { content: '', styles: { fillColor: bg2 } },
        { content: fmtAlways(closeBal), styles: { ...boldRight, fillColor: bg2, fontSize: closingFontSize } },
        { content: '', styles: { fillColor: bg2 } },
        { content: fmtAlways(closeBal), styles: { ...boldRight, fillColor: bg2, fontSize: closingFontSize } }
      ]);
      return body;
    };

    dayCards.forEach((card, idx) => {
      if (idx > 0) doc.addPage();

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isPortrait ? 12 : 14);
      doc.text(companyName.toUpperCase(), pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(isPortrait ? 10 : 11);
      doc.text('DAY BOOK', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(isPortrait ? 8 : 9);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDateLong(card.date), pageWidth / 2, 23, { align: 'center' });
      doc.setLineWidth(0.4);
      doc.line(margin, 25, pageWidth - margin, 25);

      doc.setFontSize(isPortrait ? 7 : 8);
      doc.text(`Opening: ${fmtAlways(card.openingBalance)}`, margin, 29);
      doc.text(`Closing: ${fmtAlways(card.closingBalance)}`, pageWidth - margin, 29, { align: 'right' });

      const tableY = 33;
      const commonOpts = {
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: baseFontSize, cellPadding: isPortrait ? 1.5 : 2, lineColor: [180, 180, 180], lineWidth: 0.15 },
        headStyles: { fillColor: [240, 240, 245], textColor: [30, 30, 50], fontStyle: 'bold', fontSize: headFontSize },
        columnStyles: colStyles
      };

      // Receipts
      doc.setFontSize(isPortrait ? 8 : 9);
      doc.setFont('helvetica', 'bold');
      doc.text('RECEIPTS (Money In)', margin, tableY - 1);
      autoTable(doc, {
        head,
        body: buildBody(card.receipts, card.receiptTotals, 'Opening Balance', card.openingBalance, card.closingBalance),
        startY: tableY,
        margin: { left: margin, right: pageWidth / 2 + 1 },
        tableWidth: halfW,
        ...commonOpts,
        headStyles: { ...commonOpts.headStyles, fillColor: [232, 245, 233] }
      });

      // Payments
      doc.text('PAYMENTS (Money Out)', pageWidth / 2 + 2, tableY - 1);
      autoTable(doc, {
        head,
        body: buildBody(card.payments, card.paymentTotals, 'Closing Balance', card.closingBalance, card.closingBalance),
        startY: tableY,
        margin: { left: pageWidth / 2 + 2, right: margin },
        tableWidth: halfW,
        ...commonOpts,
        headStyles: { ...commonOpts.headStyles, fillColor: [252, 228, 236] }
      });
    });

    doc.save(`day_book_${dayjs(fromDate).format('YYYY-MM-DD')}_to_${dayjs(toDate).format('YYYY-MM-DD')}.pdf`);
  };

  // --- Excel Export ---
  const handleExcelExport = () => {
    const rows = [];

    rows.push([companyName.toUpperCase()]);
    rows.push([`DAY BOOK: ${formatDateShort(fromDate)} to ${formatDateShort(toDate)}`]);
    rows.push([]);

    for (const card of dayCards) {
      rows.push([`Date: ${formatDateLong(card.date)}`]);
      rows.push([
        'RECEIPTS', '', '', '', '',
        '', 'PAYMENTS', '', '', '', ''
      ]);
      rows.push([
        'Description', 'Receipt No', 'Cash', 'Adjustment', 'Total',
        '', 'Description', 'Voucher No', 'Cash', 'Adjustment', 'Total'
      ]);

      const maxRows = Math.max(card.receipts.length, card.payments.length, 1);
      for (let i = 0; i < maxRows; i++) {
        const r = card.receipts[i];
        const p = card.payments[i];
        rows.push([
          r?.description || '', r?.voucherNumber || '', r?.cash || '', r?.adjustment || '', r?.total || '',
          '',
          p?.description || '', p?.voucherNumber || '', p?.cash || '', p?.adjustment || '', p?.total || ''
        ]);
      }

      const rt = card.receiptTotals;
      const pt = card.paymentTotals;
      rows.push([
        'Day Total', '', rt.cash, rt.adj, rt.total,
        '', 'Day Total', '', pt.cash, pt.adj, pt.total
      ]);
      rows.push([
        'Opening Balance', '', card.openingBalance, '', card.openingBalance,
        '', 'Closing Balance', '', card.closingBalance, '', card.closingBalance
      ]);
      rows.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 3 },
      { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Day Book');
    XLSX.writeFile(wb, `day_book_${dayjs(fromDate).format('YYYY-MM-DD')}_to_${dayjs(toDate).format('YYYY-MM-DD')}.xlsx`);
  };

  // --- Range label ---
  const rangeLabel = `${formatDateShort(fromDate)} to ${formatDateShort(toDate)}`;
  const totalDays = dayCards.length;
  const daysWithData = dayCards.filter(c => c.hasData).length;

  return (
    <Container size="xl" py="md" className="db-container">
      {/* Toolbar */}
      <Paper className="db-toolbar" p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <Group gap="xs" align="center">
              <IconBook size={22} className="db-toolbar__icon" />
              <Title order={4} className="db-toolbar__title">Day Book</Title>
              <Divider orientation="vertical" className="db-toolbar__divider" />
            </Group>

            <Select
              label="Period"
              value={preset}
              onChange={handlePresetChange}
              data={PRESETS}
              size="xs"
              radius="md"
              w={150}
            />

            <DatePickerInput
              type="range"
              label="Date Range"
              value={dateRange}
              onChange={(val) => { setDateRange(val); setPreset('custom'); }}
              valueFormat="DD/MM/YYYY"
              size="xs"
              leftSection={<IconCalendar size={14} />}
              w={260}
              radius="md"
              clearable={false}
            />

            <Button
              size="xs"
              radius="md"
              leftSection={<IconSearch size={14} />}
              onClick={handleGenerate}
              loading={loading}
            >
              Generate
            </Button>
          </Group>

          <Group gap="xs">
            {dayBookData && (
              <Badge variant="light" size="lg" radius="md">
                {daysWithData} / {totalDays} days
              </Badge>
            )}
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light"
                  size="xs"
                  radius="md"
                  leftSection={<IconPrinter size={14} />}
                  disabled={!dayBookData}
                >
                  Print
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Print Orientation</Menu.Label>
                <Menu.Item
                  leftSection={<IconRectangle size={16} color="var(--mantine-color-blue-6)" />}
                  onClick={() => handlePrint('landscape')}
                >
                  A4 Landscape
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconRectangleVertical size={16} color="var(--mantine-color-blue-6)" />}
                  onClick={() => handlePrint('portrait')}
                >
                  A4 Portrait
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  radius="md"
                  leftSection={<IconDownload size={14} />}
                  disabled={!dayBookData}
                >
                  Export
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>PDF Export</Menu.Label>
                <Menu.Item
                  leftSection={<IconRectangle size={16} color="var(--mantine-color-red-6)" />}
                  onClick={() => handlePDFExport('landscape')}
                >
                  PDF Landscape
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconRectangleVertical size={16} color="var(--mantine-color-red-6)" />}
                  onClick={() => handlePDFExport('portrait')}
                >
                  PDF Portrait
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconFileSpreadsheet size={16} color="var(--mantine-color-green-6)" />}
                  onClick={handleExcelExport}
                >
                  Export as Excel
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button
              variant="light" color="red" size="xs" radius="md"
              leftSection={<IconX size={14} />}
              onClick={() => navigate('/')}
            >
              Close
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Cards area */}
      <div className="db-cards-area" style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {dayBookData && !loading && dayCards.length > 0 && (
          <div ref={printRef}>
            {dayCards.map((card, idx) => renderDayCard(card, idx))}
          </div>
        )}

        {!dayBookData && !loading && (
          <Paper radius="md" withBorder shadow="sm" className="db-empty-state">
            <IconBook size={56} stroke={1.2} opacity={0.25} />
            <Text c="dimmed" size="md" mt="sm" fw={500}>
              Select a date range and click Generate
            </Text>
            <Text c="dimmed" size="xs" mt={4}>
              Each date will display as a separate printable page
            </Text>
          </Paper>
        )}

        {dayBookData && !loading && dayCards.length === 0 && (
          <Paper radius="md" withBorder shadow="sm" className="db-empty-state">
            <IconBook size={56} stroke={1.2} opacity={0.25} />
            <Text c="dimmed" size="md" mt="sm" fw={500}>
              No dates in selected range
            </Text>
          </Paper>
        )}
      </div>
    </Container>
  );
};

export default DayBook;
