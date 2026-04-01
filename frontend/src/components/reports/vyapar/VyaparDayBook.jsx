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
  IconBook, IconPrinter, IconFileSpreadsheet, IconCalendar,
  IconDownload, IconArrowDown, IconArrowUp,
  IconSearch, IconRectangle, IconRectangleVertical
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import '../DayBook.css';

const VyaparDayBook = () => {
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
      const response = await reportAPI.vyaparDayBook({
        filterType: 'custom',
        customStart: dayjs(start).format('YYYY-MM-DD'),
        customEnd: dayjs(end).format('YYYY-MM-DD')
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch day book');
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

  // --- Build base day-wise cards from API data ---
  const dayCards = useMemo(() => {
    if (!reportData?.transactions) return [];

    const dayMap = new Map();
    for (const txn of reportData.transactions) {
      const dateKey = dayjs(txn.date).format('YYYY-MM-DD');
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, { receipts: [], payments: [] });
      const group = dayMap.get(dateKey);
      const label = txn.description || txn.particulars || txn.ledgerName || 'Entry';
      const isCash = !!txn.isCashEntry;

      if (txn.isAdjustment) {
        // Non-cash journal/adjustment → go into receipts or payments with cashAmount=0
        if ((txn.adjustmentDr || 0) > 0) {
          group.receipts.push({
            description: label,
            voucherNumber: txn.voucherNumber || '',
            account: txn.account || txn.ledgerName || '',
            cashAmount: 0,
            adjustmentAmount: txn.adjustmentDr,
            totalAmount: txn.adjustmentDr,
            isCash: false
          });
        }
        if ((txn.adjustmentCr || 0) > 0) {
          group.payments.push({
            description: label,
            voucherNumber: txn.voucherNumber || '',
            account: txn.account || txn.ledgerName || '',
            cashAmount: 0,
            adjustmentAmount: txn.adjustmentCr,
            totalAmount: txn.adjustmentCr,
            isCash: false
          });
        }
      } else {
        // Regular transaction — cash vs non-cash (credit sale/purchase)
        if ((txn.debitAmount || 0) > 0) {
          group.receipts.push({
            description: label,
            voucherNumber: txn.voucherNumber || '',
            account: txn.account || txn.ledgerName || '',
            cashAmount: isCash ? txn.debitAmount : 0,
            adjustmentAmount: isCash ? 0 : txn.debitAmount,
            totalAmount: txn.debitAmount,
            isCash
          });
        }
        if ((txn.creditAmount || 0) > 0) {
          group.payments.push({
            description: label,
            voucherNumber: txn.voucherNumber || '',
            account: txn.account || txn.ledgerName || '',
            cashAmount: isCash ? txn.creditAmount : 0,
            adjustmentAmount: isCash ? 0 : txn.creditAmount,
            totalAmount: txn.creditAmount,
            isCash
          });
        }
      }
    }

    const cards = [];
    const start = dayjs(fromDate).startOf('day');
    const end = dayjs(toDate).startOf('day');
    let cursor = start;
    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      const dateKey = cursor.format('YYYY-MM-DD');
      const dayData = dayMap.get(dateKey);
      cards.push({
        date: dateKey,
        receipts: dayData?.receipts || [],
        payments: dayData?.payments || []
      });
      cursor = cursor.add(1, 'day');
    }
    return cards;
  }, [reportData, fromDate, toDate]);

  // --- Recompute running balances per day ---
  const effectiveCards = useMemo(() => {
    let runningBalance = reportData?.openingBalance || 0;
    return dayCards.map(card => {
      const receipts = card.receipts;
      const payments = card.payments;

      // Only cash amounts affect the running balance
      const debitTotal  = receipts.reduce((s, e) => s + (e.cashAmount || 0), 0);
      const creditTotal = payments.reduce((s, e) => s + (e.cashAmount || 0), 0);
      const adjReceiptTotal = receipts.reduce((s, e) => s + (e.adjustmentAmount || 0), 0);
      const adjPaymentTotal = payments.reduce((s, e) => s + (e.adjustmentAmount || 0), 0);

      const openingBalance = runningBalance;
      const closingBalance = openingBalance + debitTotal - creditTotal;
      runningBalance = closingBalance;

      return {
        date: card.date,
        hasData: receipts.length > 0 || payments.length > 0,
        receipts,
        payments,
        debitTotal,
        creditTotal,
        adjReceiptTotal,
        adjPaymentTotal,
        openingBalance,
        closingBalance
      };
    });
  }, [dayCards, reportData]);

  // --- Render a side table (Dr or Cr) ---
  const renderSideTable = (side, entries, cashTotal, adjTotal, openingBalance = 0, closingBalance = 0) => {
    const isReceipt = side === 'receipt';
    const total = cashTotal + adjTotal;
    const sideGrandTotal = isReceipt ? openingBalance + total : total + closingBalance;

    return (
      <div className={`db-side db-side--${side}`}>
        <div className="db-side__header">
          <span className={`db-side__icon db-side__icon--${side}`}>
            {isReceipt ? <IconArrowDown size={14} /> : <IconArrowUp size={14} />}
          </span>
          <span className="db-side__title">{isReceipt ? 'RECEIPT (Dr.)' : 'PAYMENT (Cr.)'}</span>
          <span className="db-side__subtitle">{isReceipt ? '(Money In)' : '(Money Out)'}</span>
        </div>

        <div className="db-side__body">
          <table className="db-ledger">
            <thead>
              <tr>
                <th className="db-col-vno">Voucher No</th>
                <th className="db-col-desc">Account Description</th>
                <th className="db-col-total">Cash (₹)</th>
                <th className="db-col-total">Adjustment (₹)</th>
                <th className="db-col-total">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr className="db-empty-row">
                  <td colSpan={5}>
                    <div className="db-no-data">No entries</div>
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={idx} className={`db-data-row ${idx % 2 === 0 ? 'db-row-even' : 'db-row-odd'}`}>
                    <td className="db-cell-vno">{entry.voucherNumber}</td>
                    <td className="db-cell-desc" title={entry.description}>
                      {entry.account && <span style={{ color: 'var(--mantine-color-violet-6)', fontWeight: 600, marginRight: 4 }}>{entry.account}</span>}
                      {entry.description}
                    </td>
                    <td className="db-cell-total">{fmt(entry.cashAmount)}</td>
                    <td className="db-cell-total" style={{ color: '#7c3aed' }}>{fmt(entry.adjustmentAmount)}</td>
                    <td className="db-cell-total" style={{ fontWeight: 600 }}>{fmt(entry.totalAmount)}</td>
                    {false && (
                      <td style={{ display: 'none' }}>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="db-side__footer">
          <table className="db-ledger db-ledger--footer">
            <tbody>
              {isReceipt ? (
                <>
                  <tr className="db-summary-row db-balance-row">
                    <td className="db-footer-label">Opening Balance (b/d)</td>
                    <td className="db-footer-total">{fmtAlways(openingBalance)}</td>
                    <td className="db-footer-total"></td>
                    <td className="db-footer-total">{fmtAlways(openingBalance)}</td>
                  </tr>
                  <tr className="db-summary-row db-day-total">
                    <td className="db-footer-label">Total Receipts</td>
                    <td className="db-footer-total">{fmtAlways(cashTotal)}</td>
                    <td className="db-footer-total">{fmtAlways(adjTotal)}</td>
                    <td className="db-footer-total">{fmtAlways(total)}</td>
                  </tr>
                  <tr className="db-summary-row db-closing-row">
                    <td className="db-footer-label">Total</td>
                    <td className="db-footer-total">{fmtAlways(openingBalance + cashTotal)}</td>
                    <td className="db-footer-total">{fmtAlways(adjTotal)}</td>
                    <td className="db-footer-total">{fmtAlways(sideGrandTotal)}</td>
                  </tr>
                </>
              ) : (
                <>
                  <tr className="db-summary-row db-day-total">
                    <td className="db-footer-label">Total Payments</td>
                    <td className="db-footer-total">{fmtAlways(cashTotal)}</td>
                    <td className="db-footer-total">{fmtAlways(adjTotal)}</td>
                    <td className="db-footer-total">{fmtAlways(total)}</td>
                  </tr>
                  <tr className="db-summary-row db-balance-row">
                    <td className="db-footer-label">Closing Balance (c/d)</td>
                    <td className="db-footer-total">{fmtAlways(closingBalance)}</td>
                    <td className="db-footer-total"></td>
                    <td className="db-footer-total">{fmtAlways(closingBalance)}</td>
                  </tr>
                  <tr className="db-summary-row db-closing-row">
                    <td className="db-footer-label">Total</td>
                    <td className="db-footer-total">{fmtAlways(cashTotal + closingBalance)}</td>
                    <td className="db-footer-total">{fmtAlways(adjTotal)}</td>
                    <td className="db-footer-total">{fmtAlways(sideGrandTotal)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };


  // --- Render a single day card ---
  const renderDayCard = (card) => (
    <div className="db-card">
      <div className="db-card__header">
        <div className="db-card__company">{companyName}</div>
        <div className="db-card__title-row">
          <span className="db-card__title">DAY BOOK</span>
        </div>
        <div className="db-card__date">{formatDateLong(card.date)}</div>
        <div className="db-card__meta">
          <span>Opening: {fmtAlways(card.openingBalance)}</span>
          <span>Dr Total: {fmtAlways(card.debitTotal)}</span>
          <span>Cr Total: {fmtAlways(card.creditTotal)}</span>
          <span>Closing: {fmtAlways(card.closingBalance)}</span>
          {(card.adjReceiptTotal > 0 || card.adjPaymentTotal > 0) && (
            <span style={{ color: '#7c3aed' }}>Adj: ₹{fmtAlways(card.adjReceiptTotal + card.adjPaymentTotal)}</span>
          )}
        </div>
      </div>
      <div className="db-card__body">
        {renderSideTable('receipt', card.receipts, card.debitTotal, card.adjReceiptTotal, card.openingBalance, card.closingBalance)}
        {renderSideTable('payment', card.payments, card.creditTotal, card.adjPaymentTotal, card.openingBalance, card.closingBalance)}
      </div>
    </div>
  );

  // --- PRINT ---
  const handlePrint = (orientation = 'landscape') => {
    const content = printRef.current;
    if (!content) return;
    const isPortrait = orientation === 'portrait';
    const fontSize = isPortrait ? '9px' : '11px';
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
    .db-side--adjustment .db-side__header { background: #f3e8ff; color: #7c3aed; }
    .db-side--adjustment { border-top: 2px dashed #9c6fe4; margin-top: 8px; }
    .db-side__icon { display: none; }
    .db-side__subtitle { font-size: ${isPortrait ? '7px' : '8px'}; font-weight: 400; letter-spacing: 0; }
    .db-side__body { min-height: ${isPortrait ? '60px' : '100px'}; }
    .db-ledger { width: 100%; border-collapse: collapse; font-size: 9.5px; }
    .db-ledger thead th { background: #f5f5fa; border: 1px solid #ccc; padding: ${isPortrait ? '2px 3px' : '3px 5px'}; font-weight: 700; font-size: ${isPortrait ? '7.5px' : '8.5px'}; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }
    .db-ledger thead th.db-col-desc { text-align: left; }
    .db-ledger tbody td { border: 1px solid #e0e0e0; padding: ${isPortrait ? '1.5px 3px' : '2px 5px'}; font-size: ${isPortrait ? '8px' : '9px'}; }
    .db-cell-desc { text-align: left; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .db-cell-vno { text-align: center; color: #666; font-size: 8.5px; }
    .db-cell-total { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
    .db-row-even { background: #fff; }
    .db-row-odd { background: #fafafa; }
    .db-side__footer { border-top: 2px solid #333; }
    .db-ledger--footer td { border: 1px solid #ccc; padding: ${isPortrait ? '2px 3px' : '3px 5px'}; font-size: ${isPortrait ? '8px' : '9px'}; }
    .db-footer-label { text-align: left; font-weight: 600; }
    .db-footer-vno { text-align: center; }
    .db-footer-total { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .db-balance-row td { background: #f5f5fa; font-weight: 500; font-style: italic; }
    .db-side--receipt .db-day-total td { background: #e8f5e9; font-weight: 600; }
    .db-side--payment .db-day-total td { background: #fce4ec; font-weight: 600; }
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

    const head = [['Description', 'Voucher No', 'Amount (₹)']];
    const colStyles = {
      0: { halign: 'left', cellWidth: halfW * 0.5 },
      1: { halign: 'center', cellWidth: halfW * 0.2 },
      2: { halign: 'right', cellWidth: halfW * 0.3, fontStyle: 'bold' }
    };

    const buildBody = (entries, total, openingBalance, closingBalance, isReceipt) => {
      const body = entries.map(e => [e.description || '', e.voucherNumber || '', fmt(e.amount)]);
      const grandTotal = isReceipt ? openingBalance + total : total + closingBalance;
      if (isReceipt) {
        body.push([
          { content: 'Opening Balance (b/d)', styles: { fontStyle: 'italic', fillColor: [245, 245, 250] } },
          { content: '', styles: { fillColor: [245, 245, 250] } },
          { content: fmtAlways(openingBalance), styles: { halign: 'right', fillColor: [245, 245, 250] } }
        ]);
        body.push([
          { content: 'Day Total (Dr)', styles: { fontStyle: 'bold', fillColor: [232, 245, 233] } },
          { content: '', styles: { fillColor: [232, 245, 233] } },
          { content: fmtAlways(total), styles: { halign: 'right', fontStyle: 'bold', fillColor: [232, 245, 233] } }
        ]);
      } else {
        body.push([
          { content: 'Day Total (Cr)', styles: { fontStyle: 'bold', fillColor: [252, 228, 236] } },
          { content: '', styles: { fillColor: [252, 228, 236] } },
          { content: fmtAlways(total), styles: { halign: 'right', fontStyle: 'bold', fillColor: [252, 228, 236] } }
        ]);
        body.push([
          { content: 'Closing Balance (c/d)', styles: { fontStyle: 'italic', fillColor: [245, 245, 250] } },
          { content: '', styles: { fillColor: [245, 245, 250] } },
          { content: fmtAlways(closingBalance), styles: { halign: 'right', fillColor: [245, 245, 250] } }
        ]);
      }
      body.push([
        { content: 'Total', styles: { fontStyle: 'bold', fillColor: [232, 232, 240] } },
        { content: '', styles: { fillColor: [232, 232, 240] } },
        { content: fmtAlways(grandTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [232, 232, 240] } }
      ]);
      return body;
    };

    effectiveCards.filter(c => c.hasData).forEach((card, idx) => {
      if (idx > 0) doc.addPage();
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
      doc.setFontSize(8);
      doc.text(`Opening: ${fmtAlways(card.openingBalance)}  |  Dr Total: ${fmtAlways(card.debitTotal)}`, margin, 29);
      doc.text(`Cr Total: ${fmtAlways(card.creditTotal)}  |  Closing: ${fmtAlways(card.closingBalance)}`, pageWidth - margin, 29, { align: 'right' });

      const tableY = 33;
      const commonOpts = {
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: baseFontSize, cellPadding: isPortrait ? 1.5 : 2, lineColor: [180, 180, 180], lineWidth: 0.15 },
        headStyles: { fillColor: [240, 240, 245], textColor: [30, 30, 50], fontStyle: 'bold', fontSize: baseFontSize },
        columnStyles: colStyles
      };

      doc.setFontSize(isPortrait ? 8 : 9);
      doc.setFont('helvetica', 'bold');
      doc.text('DEBIT ENTRIES (Dr.)', margin, tableY - 1);
      autoTable(doc, {
        head,
        body: buildBody(card.receipts, card.debitTotal, card.openingBalance, card.closingBalance, true),
        startY: tableY,
        margin: { left: margin, right: pageWidth / 2 + 1 },
        tableWidth: halfW,
        ...commonOpts,
        headStyles: { ...commonOpts.headStyles, fillColor: [232, 245, 233] }
      });

      doc.text('CREDIT ENTRIES (Cr.)', pageWidth / 2 + 2, tableY - 1);
      autoTable(doc, {
        head,
        body: buildBody(card.payments, card.creditTotal, card.openingBalance, card.closingBalance, false),
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

    for (const card of effectiveCards.filter(c => c.hasData)) {
      rows.push([`Date: ${formatDateLong(card.date)}`]);
      rows.push([`Opening Balance: ${fmtAlways(card.openingBalance)}`, '', '', '', `Closing Balance: ${fmtAlways(card.closingBalance)}`, '', '']);
      rows.push(['DEBIT ENTRIES', '', '', '', 'CREDIT ENTRIES', '', '']);
      rows.push(['Description', 'Voucher No', 'Amount (₹)', '', 'Description', 'Voucher No', 'Amount (₹)']);

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
      rows.push(['Opening Balance (b/d)', '', card.openingBalance, '', 'Day Total (Cr)', '', card.creditTotal]);
      rows.push(['Day Total (Dr)', '', card.debitTotal, '', 'Closing Balance (c/d)', '', card.closingBalance]);
      rows.push(['Total', '', card.openingBalance + card.debitTotal, '', 'Total', '', card.creditTotal + card.closingBalance]);
      rows.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 28 }, { wch: 14 }, { wch: 16 },
      { wch: 3 },
      { wch: 28 }, { wch: 14 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Day Book');
    XLSX.writeFile(wb, `day_book_${dayjs(fromDate).format('YYYY-MM-DD')}_to_${dayjs(toDate).format('YYYY-MM-DD')}.xlsx`);
  };

  const totalDays = effectiveCards.length;
  const daysWithData = effectiveCards.filter(c => c.hasData).length;

  return (
    <Container size="xl" py="md" className="db-container">
      {/* Toolbar */}
      <Paper className="db-toolbar" p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group align="center" gap="sm" wrap="wrap">
            <IconBook size={22} className="db-toolbar__icon" />
            <Title order={4} className="db-toolbar__title">Day Book</Title>
            <Divider orientation="vertical" className="db-toolbar__divider" />

            <DatePickerInput
              label="From Date"
              value={fromDate}
              onChange={setFromDate}
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
              onChange={setToDate}
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
                  disabled={!reportData}
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
                  disabled={!reportData}
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
          </Group>
        </Group>
      </Paper>

      {/* Cards area */}
      <div className="db-cards-area" style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && effectiveCards.filter(c => c.hasData).length > 0 && (
          <div ref={printRef}>
            {effectiveCards.filter(c => c.hasData).map((card) => (
              <div key={card.date}>{renderDayCard(card)}</div>
            ))}
          </div>
        )}

        {!reportData && !loading && (
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

        {reportData && !loading && effectiveCards.filter(c => c.hasData).length === 0 && (
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

export default VyaparDayBook;
