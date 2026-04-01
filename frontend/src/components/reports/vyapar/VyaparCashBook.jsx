import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../../services/api';
import { useCompany } from '../../../context/CompanyContext';
import {
  Container, Paper, Text, Group, LoadingOverlay, Button,
  Title, Divider, Menu, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCash, IconPrinter, IconFileTypePdf, IconFileSpreadsheet,
  IconCalendar, IconDownload, IconArrowDown, IconArrowUp, IconSearch
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import '../CashBook.css';

const VyaparCashBook = () => {
  const { selectedCompany, selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(new Date());
  const [reportData, setReportData] = useState(null);
  const printRef = useRef();

  const companyName = selectedCompany?.companyName || 'Private Firm';

  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  const fetchReport = async (start, end) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const response = await reportAPI.vyaparCashBook({
        filterType: 'custom',
        customStart: dayjs(start).format('YYYY-MM-DD'),
        customEnd: dayjs(end).format('YYYY-MM-DD')
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch cash book');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => fetchReport(fromDate, toDate);

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

  const formatDateLong = (date) => dayjs(date).format('dddd, DD MMMM YYYY');
  const formatDateShort = (date) => dayjs(date).format('DD MMM YYYY');

  // --- Build day-wise cards from receiptSide / paymentSide ---
  const dayCards = useMemo(() => {
    if (!reportData) return [];

    // Group by date
    const dayMap = new Map();
    const makeDesc = (entry, fallback) => {
      const type = entry.voucherType ? `${entry.voucherType}` : '';
      const party = entry.particulars || '';
      if (type && party && party !== type) return `${type} — ${party}`;
      return type || party || fallback;
    };

    for (const entry of (reportData.receiptSide || [])) {
      const dateKey = dayjs(entry.date).format('YYYY-MM-DD');
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, { receipts: [], payments: [] });
      dayMap.get(dateKey).receipts.push({
        description: makeDesc(entry, 'Cash Receipt'),
        voucherNumber: entry.voucherNumber || '',
        amount: entry.amount,
        account: entry.account || 'Cash'
      });
    }
    for (const entry of (reportData.paymentSide || [])) {
      const dateKey = dayjs(entry.date).format('YYYY-MM-DD');
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, { receipts: [], payments: [] });
      dayMap.get(dateKey).payments.push({
        description: makeDesc(entry, 'Cash Payment'),
        voucherNumber: entry.voucherNumber || '',
        amount: entry.amount,
        account: entry.account || 'Cash'
      });
    }

    const cards = [];
    const start = dayjs(fromDate).startOf('day');
    const end = dayjs(toDate).startOf('day');
    let cursor = start;
    let prevClosing = reportData.summary?.openingBalance ?? 0;

    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      const dateKey = cursor.format('YYYY-MM-DD');
      const dayData = dayMap.get(dateKey);
      const receipts = dayData?.receipts || [];
      const payments = dayData?.payments || [];
      const totalReceipts = receipts.reduce((s, e) => s + (e.amount || 0), 0);
      const totalPayments = payments.reduce((s, e) => s + (e.amount || 0), 0);
      const openBal = prevClosing;
      const closeBal = openBal + totalReceipts - totalPayments;

      cards.push({
        date: dateKey,
        hasData: !!dayData,
        receipts,
        payments,
        receiptTotal: totalReceipts,
        paymentTotal: totalPayments,
        openingBalance: openBal,
        closingBalance: closeBal
      });

      prevClosing = closeBal;
      cursor = cursor.add(1, 'day');
    }

    return cards;
  }, [reportData, fromDate, toDate]);

  // --- Render a side table ---
  const renderSideTable = (side, entries, total, openBal, closeBal) => {
    const isReceipt = side === 'receipt';
    const balanceLabel = isReceipt ? 'Opening Balance' : 'Closing Balance';
    const balanceAmount = isReceipt ? openBal : closeBal;

    return (
      <div className={`cb-side cb-side--${side}`}>
        <div className="cb-side__header">
          <span className={`cb-side__icon cb-side__icon--${side}`}>
            {isReceipt ? <IconArrowDown size={14} /> : <IconArrowUp size={14} />}
          </span>
          <span className="cb-side__title">{isReceipt ? 'RECEIPTS (Dr)' : 'PAYMENTS (Cr)'}</span>
          <span className="cb-side__subtitle">{isReceipt ? '(Money In)' : '(Money Out)'}</span>
        </div>

        <div className="cb-side__body">
          <table className="cb-ledger">
            <thead>
              <tr>
                <th className="cb-col-vno">Voucher No</th>
                <th className="cb-col-vno">Account</th>
                <th className="cb-col-desc">Description / Party</th>
                <th className="cb-col-amt">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr className="cb-empty-row">
                  <td colSpan={4}>
                    <div className="cb-no-data">No transactions</div>
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={idx} className={`cb-data-row ${idx % 2 === 0 ? 'cb-row-even' : 'cb-row-odd'}`}>
                    <td className="cb-cell-vno">{entry.voucherNumber}</td>
                    <td className="cb-cell-vno" style={{ color: 'var(--mantine-color-violet-6)', fontSize: 11 }}>{entry.account || 'Cash'}</td>
                    <td className="cb-cell-desc" title={entry.description}>{entry.description}</td>
                    <td className="cb-cell-amt">{fmt(entry.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="cb-side__footer">
          <table className="cb-ledger cb-ledger--footer">
            <tbody>
              <tr className="cb-summary-row cb-day-total">
                <td className="cb-footer-label">Day Total</td>
                <td className="cb-footer-vno"></td>
                <td className="cb-footer-vno"></td>
                <td className="cb-footer-amt">{fmtAlways(total)}</td>
              </tr>
              <tr className="cb-summary-row cb-balance-row">
                <td className="cb-footer-label">{balanceLabel}</td>
                <td className="cb-footer-vno"></td>
                <td className="cb-footer-vno"></td>
                <td className="cb-footer-amt">{fmtAlways(balanceAmount)}</td>
              </tr>
              <tr className="cb-summary-row cb-closing-row">
                <td className="cb-footer-label">Closing Balance</td>
                <td className="cb-footer-vno"></td>
                <td className="cb-footer-vno"></td>
                <td className="cb-footer-amt">{fmtAlways(closeBal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- Render a single day card ---
  const renderDayCard = (card) => (
    <div key={card.date} className="cb-card">
      <div className="cb-card__header">
        <div className="cb-card__company">{companyName}</div>
        <div className="cb-card__title-row">
          <span className="cb-card__title">CASH BOOK</span>
        </div>
        <div className="cb-card__date">{formatDateLong(card.date)}</div>
        <div className="cb-card__meta">
          <span>Opening: ₹{fmtAlways(card.openingBalance)}</span>
          <span>Closing: ₹{fmtAlways(card.closingBalance)}</span>
        </div>
      </div>
      <div className="cb-card__body">
        {renderSideTable('receipt', card.receipts, card.receiptTotal, card.openingBalance, card.closingBalance)}
        {renderSideTable('payment', card.payments, card.paymentTotal, card.openingBalance, card.closingBalance)}
      </div>
    </div>
  );

  // --- PRINT ---
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Cash Book - ${formatDateShort(fromDate)} to ${formatDateShort(toDate)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; color: #1a1a2e; background: #fff; font-size: 11px; }
    .cb-card { page-break-after: always; padding: 10mm; }
    .cb-card:last-child { page-break-after: auto; }
    .cb-card__header { text-align: center; padding-bottom: 8px; border-bottom: 2px solid #1a1a2e; margin-bottom: 8px; }
    .cb-card__company { font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .cb-card__title-row { margin: 4px 0; }
    .cb-card__title { font-size: 13px; font-weight: 700; letter-spacing: 5px; text-transform: uppercase; padding: 2px 16px; border-top: 2px solid #4a4a6a; border-bottom: 2px solid #4a4a6a; color: #4a4a6a; }
    .cb-card__date { font-size: 11px; margin-top: 4px; font-weight: 600; }
    .cb-card__meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 4px; padding: 0 20px; }
    .cb-card__body { display: flex; gap: 8px; }
    .cb-side { flex: 1; }
    .cb-side__header { display: flex; align-items: center; gap: 6px; padding: 5px 8px; font-weight: 700; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; border-bottom: 2px solid #333; }
    .cb-side--receipt .cb-side__header { background: #e8f5e9; color: #2e7d32; }
    .cb-side--payment .cb-side__header { background: #fce4ec; color: #c62828; }
    .cb-side__icon { display: none; }
    .cb-side__subtitle { font-size: 8px; font-weight: 400; letter-spacing: 0; }
    .cb-side__body { min-height: 100px; }
    .cb-ledger { width: 100%; border-collapse: collapse; font-size: 9.5px; }
    .cb-ledger thead th { background: #f5f5fa; border: 1px solid #ccc; padding: 3px 5px; font-weight: 700; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }
    .cb-ledger thead th.cb-col-desc { text-align: left; }
    .cb-ledger tbody td { border: 1px solid #e0e0e0; padding: 2px 5px; font-size: 9px; }
    .cb-cell-desc { text-align: left; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cb-cell-vno { text-align: center; color: #666; font-size: 8.5px; }
    .cb-cell-amt { text-align: right; font-weight: 500; font-variant-numeric: tabular-nums; }
    .cb-row-even { background: #fff; }
    .cb-row-odd { background: #fafafa; }
    .cb-side__footer { border-top: 2px solid #333; }
    .cb-ledger--footer td { border: 1px solid #ccc; padding: 3px 5px; font-size: 9px; }
    .cb-footer-label { text-align: left; font-weight: 600; }
    .cb-footer-vno { text-align: center; }
    .cb-footer-amt { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .cb-day-total td { background: #f0f0f5; font-weight: 600; }
    .cb-balance-row td { background: #fafaf5; }
    .cb-closing-row td { background: #e8e8f0; font-weight: 700; border-top: 1.5px solid #333; border-bottom: 3px double #333; }
    .cb-no-data { text-align: center; padding: 20px; color: #999; font-style: italic; font-size: 10px; }
    .cb-empty-row td { border: none !important; }
    @page { size: A4 portrait; margin: 6mm; }
  </style>
</head>
<body>${content.innerHTML}</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  // --- PDF Export ---
  const handlePDFExport = () => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const halfW = (pageWidth - 30) / 2;

    const head = [['Description', 'No', 'Cash (₹)']];
    const colStyles = {
      0: { halign: 'left', cellWidth: halfW * 0.50 },
      1: { halign: 'center', cellWidth: halfW * 0.20 },
      2: { halign: 'right', cellWidth: halfW * 0.30, fontStyle: 'bold' }
    };

    const buildBody = (entries, total, balLabel, balAmt, closeBal) => {
      const body = entries.map(e => [e.description || '', e.voucherNumber || '', fmt(e.amount)]);
      const bold = { fontStyle: 'bold' };
      const boldRight = { halign: 'right', fontStyle: 'bold' };
      const bg1 = [240, 240, 245];
      const bg2 = [232, 232, 240];
      body.push([
        { content: 'Day Total', styles: { ...bold, fillColor: bg1 } },
        { content: '', styles: { fillColor: bg1 } },
        { content: fmtAlways(total), styles: { ...boldRight, fillColor: bg1 } }
      ]);
      body.push([{ content: balLabel, styles: bold }, '', { content: fmtAlways(balAmt), styles: boldRight }]);
      body.push([
        { content: 'Closing Balance', styles: { ...bold, fillColor: bg2, fontSize: 8 } },
        { content: '', styles: { fillColor: bg2 } },
        { content: fmtAlways(closeBal), styles: { ...boldRight, fillColor: bg2, fontSize: 8 } }
      ]);
      return body;
    };

    dayCards.forEach((card, idx) => {
      if (idx > 0) doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(companyName.toUpperCase(), pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(11);
      doc.text('CASH BOOK', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDateLong(card.date), pageWidth / 2, 23, { align: 'center' });
      doc.setLineWidth(0.4);
      doc.line(14, 25, pageWidth - 14, 25);
      doc.setFontSize(8);
      doc.text(`Opening: ${fmtAlways(card.openingBalance)}`, 14, 29);
      doc.text(`Closing: ${fmtAlways(card.closingBalance)}`, pageWidth - 14, 29, { align: 'right' });

      const tableY = 33;
      const commonOpts = {
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 7, cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.15 },
        headStyles: { fillColor: [240, 240, 245], textColor: [30, 30, 50], fontStyle: 'bold', fontSize: 7 },
        columnStyles: colStyles
      };

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('RECEIPTS (Money In)', 14, tableY - 1);
      autoTable(doc, {
        head,
        body: buildBody(card.receipts, card.receiptTotal, 'Opening Balance', card.openingBalance, card.closingBalance),
        startY: tableY,
        margin: { left: 14, right: pageWidth / 2 + 1 },
        tableWidth: halfW,
        ...commonOpts,
        headStyles: { ...commonOpts.headStyles, fillColor: [232, 245, 233] }
      });

      doc.text('PAYMENTS (Money Out)', pageWidth / 2 + 2, tableY - 1);
      autoTable(doc, {
        head,
        body: buildBody(card.payments, card.paymentTotal, 'Closing Balance', card.closingBalance, card.closingBalance),
        startY: tableY,
        margin: { left: pageWidth / 2 + 2, right: 14 },
        tableWidth: halfW,
        ...commonOpts,
        headStyles: { ...commonOpts.headStyles, fillColor: [252, 228, 236] }
      });
    });

    doc.save(`cash_book_${dayjs(fromDate).format('YYYY-MM-DD')}_to_${dayjs(toDate).format('YYYY-MM-DD')}.pdf`);
  };

  // --- Excel Export ---
  const handleExcelExport = () => {
    const rows = [];
    rows.push([companyName.toUpperCase()]);
    rows.push([`CASH BOOK: ${formatDateShort(fromDate)} to ${formatDateShort(toDate)}`]);
    rows.push([]);

    for (const card of dayCards) {
      rows.push([`Date: ${formatDateLong(card.date)}`]);
      rows.push(['RECEIPTS', '', '', '', 'PAYMENTS', '', '']);
      rows.push(['Description', 'Receipt No', 'Cash (₹)', '', 'Description', 'Voucher No', 'Cash (₹)']);

      const maxRows = Math.max(card.receipts.length, card.payments.length, 1);
      for (let i = 0; i < maxRows; i++) {
        const r = card.receipts[i];
        const p = card.payments[i];
        rows.push([
          r?.description || '', r?.voucherNumber || '', r?.amount || '',
          '',
          p?.description || '', p?.voucherNumber || '', p?.amount || ''
        ]);
      }
      rows.push(['Day Total', '', card.receiptTotal, '', 'Day Total', '', card.paymentTotal]);
      rows.push(['Opening Balance', '', card.openingBalance, '', 'Closing Balance', '', card.closingBalance]);
      rows.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 28 }, { wch: 14 }, { wch: 16 },
      { wch: 3 },
      { wch: 28 }, { wch: 14 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash Book');
    XLSX.writeFile(wb, `cash_book_${dayjs(fromDate).format('YYYY-MM-DD')}_to_${dayjs(toDate).format('YYYY-MM-DD')}.xlsx`);
  };

  const totalDays = dayCards.length;
  const daysWithData = dayCards.filter(c => c.hasData).length;

  return (
    <Container size="xl" py="md" className="cb-container">
      {/* Toolbar */}
      <Paper className="cb-toolbar" p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group align="center" gap="sm" wrap="wrap">
            <IconCash size={22} className="cb-toolbar__icon" />
            <Title order={4} className="cb-toolbar__title">Cash Book</Title>
            <Divider orientation="vertical" className="cb-toolbar__divider" />

            <DatePickerInput
              label="From Date"
              value={fromDate}
              onChange={(v) => { setFromDate(v); setReportData(null); }}
              valueFormat="DD/MM/YYYY"
              size="xs"
              leftSection={<IconCalendar size={14} />}
              w={160}
              clearable={false}
              radius="md"
              maxDate={toDate}
            />
            <DatePickerInput
              label="To Date"
              value={toDate}
              onChange={(v) => { setToDate(v); setReportData(null); }}
              valueFormat="DD/MM/YYYY"
              size="xs"
              leftSection={<IconCalendar size={14} />}
              w={160}
              clearable={false}
              radius="md"
              minDate={fromDate}
            />
            <Button
              size="xs"
              radius="md"
              leftSection={<IconSearch size={14} />}
              onClick={handleGenerate}
              loading={loading}
              mt={18}
            >
              Generate
            </Button>
          </Group>

          <Group gap="xs">
            {reportData && (
              <>
                <Badge variant="light" color="teal" size="sm" radius="md">
                  Opening: ₹{fmtAlways(reportData.summary?.openingBalance)}
                </Badge>
                <Badge variant="light" color="blue" size="sm" radius="md">
                  {daysWithData} / {totalDays} days
                </Badge>
                <Badge variant="filled" color="blue" size="sm" radius="md">
                  Closing: ₹{fmtAlways(reportData.summary?.closingBalance)}
                </Badge>
              </>
            )}
            <Button
              variant="light"
              size="xs"
              radius="md"
              leftSection={<IconPrinter size={14} />}
              onClick={handlePrint}
              disabled={!reportData}
            >
              Print
            </Button>
            <Menu shadow="md" width={160} position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  radius="md"
                  leftSection={<IconDownload size={14} />}
                  disabled={!reportData}
                >
                  Export
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconFileTypePdf size={16} color="var(--mantine-color-red-6)" />}
                  onClick={handlePDFExport}
                >
                  Export as PDF
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileSpreadsheet size={16} color="var(--mantine-color-green-6)" />}
                  onClick={handleExcelExport}
                >
                  Export as Excel
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {/* Cards area */}
      <div className="cb-cards-area" style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && dayCards.filter(c => c.hasData).length > 0 && (
          <div ref={printRef}>
            {dayCards.filter(c => c.hasData).map((card) => renderDayCard(card))}
          </div>
        )}

        {!reportData && !loading && (
          <Paper radius="md" withBorder shadow="sm" className="cb-empty-state">
            <IconCash size={56} stroke={1.2} opacity={0.25} />
            <Text c="dimmed" size="md" mt="sm" fw={500}>
              Select a date range and click Generate
            </Text>
            <Text c="dimmed" size="xs" mt={4}>
              Each date will display as a separate printable page
            </Text>
          </Paper>
        )}

        {reportData && !loading && dayCards.filter(c => c.hasData).length === 0 && (
          <Paper radius="md" withBorder shadow="sm" className="cb-empty-state">
            <IconCash size={56} stroke={1.2} opacity={0.25} />
            <Text c="dimmed" size="md" mt="sm" fw={500}>
              No cash transactions in selected range
            </Text>
          </Paper>
        )}
      </div>
    </Container>
  );
};

export default VyaparCashBook;
