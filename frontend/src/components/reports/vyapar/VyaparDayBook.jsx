import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  IconSearch, IconRectangle, IconRectangleVertical, IconArrowsTransferDown
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
  // manualAdjusts: Map<dateKey, { receipts: Set<idx>, payments: Set<idx> }>
  const [manualAdjusts, setManualAdjusts] = useState(new Map());
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

  useEffect(() => {
    fetchReport(fromDate, toDate);
  }, []);

  // Reset manual adjustments whenever new report data is loaded
  useEffect(() => {
    setManualAdjusts(new Map());
  }, [reportData]);

  const handleGenerate = () => fetchReport(fromDate, toDate);

  // Move an entry from receipts/payments into the Adjustment section
  const handleAdjust = useCallback((dateKey, side, idx) => {
    setManualAdjusts(prev => {
      const next = new Map(prev);
      const day = next.get(dateKey) || { receipts: new Set(), payments: new Set() };
      const newDay = { receipts: new Set(day.receipts), payments: new Set(day.payments) };
      if (side === 'receipt') newDay.receipts.add(idx);
      else newDay.payments.add(idx);
      next.set(dateKey, newDay);
      return next;
    });
  }, []);

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
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, { receipts: [], payments: [], adjustments: [] });
      const group = dayMap.get(dateKey);
      const label = txn.description || txn.particulars || txn.ledgerName || 'Entry';

      if (txn.isAdjustment) {
        group.adjustments.push({
          description: label,
          voucherNumber: txn.voucherNumber || '',
          voucherType: txn.voucherType || '',
          account: txn.account || txn.ledgerName || '',
          drAmount: txn.adjustmentDr || 0,
          crAmount: txn.adjustmentCr || 0
        });
      } else {
        if ((txn.debitAmount || 0) > 0) {
          group.receipts.push({
            description: label,
            voucherNumber: txn.voucherNumber || '',
            account: txn.account || txn.ledgerName || '',
            amount: txn.debitAmount
          });
        }
        if ((txn.creditAmount || 0) > 0) {
          group.payments.push({
            description: label,
            voucherNumber: txn.voucherNumber || '',
            account: txn.account || txn.ledgerName || '',
            amount: txn.creditAmount
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
        payments: dayData?.payments || [],
        adjustments: dayData?.adjustments || []
      });
      cursor = cursor.add(1, 'day');
    }
    return cards;
  }, [reportData, fromDate, toDate]);

  // --- Apply manual adjustments + recompute running balances ---
  const effectiveCards = useMemo(() => {
    let runningBalance = reportData?.openingBalance || 0;
    return dayCards.map(card => {
      const dayAdj = manualAdjusts.get(card.date);
      const adjRIdxs = dayAdj?.receipts || new Set();
      const adjPIdxs = dayAdj?.payments || new Set();

      const receipts   = card.receipts.filter((_, i) => !adjRIdxs.has(i));
      const payments   = card.payments.filter((_, i) => !adjPIdxs.has(i));

      // Entries moved manually to adjustment section
      const manualEntries = [
        ...card.receipts
          .filter((_, i) => adjRIdxs.has(i))
          .map(e => ({ description: e.description, voucherNumber: e.voucherNumber,
                       voucherType: 'Adjusted', account: e.account,
                       drAmount: e.amount, crAmount: 0 })),
        ...card.payments
          .filter((_, i) => adjPIdxs.has(i))
          .map(e => ({ description: e.description, voucherNumber: e.voucherNumber,
                       voucherType: 'Adjusted', account: e.account,
                       drAmount: 0, crAmount: e.amount }))
      ];
      const adjustments = [...card.adjustments, ...manualEntries];

      const debitTotal          = receipts.reduce((s, e) => s + (e.amount || 0), 0);
      const creditTotal         = payments.reduce((s, e) => s + (e.amount || 0), 0);
      const adjustmentDrTotal   = adjustments.reduce((s, e) => s + (e.drAmount || 0), 0);
      const adjustmentCrTotal   = adjustments.reduce((s, e) => s + (e.crAmount || 0), 0);
      const openingBalance      = runningBalance;
      const closingBalance      = openingBalance + debitTotal - creditTotal;
      runningBalance = closingBalance;

      return {
        date: card.date,
        hasData: receipts.length > 0 || payments.length > 0 || adjustments.length > 0,
        receipts, payments, adjustments,
        debitTotal, creditTotal,
        adjustmentDrTotal, adjustmentCrTotal,
        openingBalance, closingBalance
      };
    });
  }, [dayCards, manualAdjusts, reportData]);

  // --- Render a side table (Dr or Cr) ---
  const renderSideTable = (side, entries, total, openingBalance = 0, closingBalance = 0, dateKey = '', onAdjust = null) => {
    const isReceipt = side === 'receipt';
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
                <th className="db-col-vno">Account</th>
                <th className="db-col-desc">Description</th>
                <th className="db-col-total">Amount (₹)</th>
                {onAdjust && <th className="db-col-vno" style={{ width: 36 }}>Adj</th>}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr className="db-empty-row">
                  <td colSpan={onAdjust ? 5 : 4}>
                    <div className="db-no-data">No entries</div>
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={idx} className={`db-data-row ${idx % 2 === 0 ? 'db-row-even' : 'db-row-odd'}`}>
                    <td className="db-cell-vno">{entry.voucherNumber}</td>
                    <td className="db-cell-vno" style={{ color: 'var(--mantine-color-violet-6)', fontSize: 11 }}>{entry.account}</td>
                    <td className="db-cell-desc" title={entry.description}>{entry.description}</td>
                    <td className="db-cell-total">{fmt(entry.amount)}</td>
                    {onAdjust && (
                      <td className="db-cell-vno" style={{ padding: '1px 2px', textAlign: 'center' }}>
                        <button
                          title="Move to Adjustment Entries"
                          onClick={() => onAdjust(dateKey, side, idx)}
                          style={{
                            background: 'none', border: '1px solid #9c6fe4', borderRadius: 4,
                            cursor: 'pointer', padding: '1px 3px', display: 'inline-flex',
                            alignItems: 'center', color: '#7c3aed'
                          }}
                        >
                          <IconArrowsTransferDown size={11} />
                        </button>
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
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-total">{fmtAlways(openingBalance)}</td>
                    {onAdjust && <td></td>}
                  </tr>
                  <tr className="db-summary-row db-day-total">
                    <td className="db-footer-label">Total Receipts</td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-total">{fmtAlways(total)}</td>
                    {onAdjust && <td></td>}
                  </tr>
                  <tr className="db-summary-row db-closing-row">
                    <td className="db-footer-label">Total</td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-total">{fmtAlways(sideGrandTotal)}</td>
                    {onAdjust && <td></td>}
                  </tr>
                </>
              ) : (
                <>
                  <tr className="db-summary-row db-day-total">
                    <td className="db-footer-label">Total Payments</td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-total">{fmtAlways(total)}</td>
                    {onAdjust && <td></td>}
                  </tr>
                  <tr className="db-summary-row db-balance-row">
                    <td className="db-footer-label">Closing Balance (c/d)</td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-total">{fmtAlways(closingBalance)}</td>
                    {onAdjust && <td></td>}
                  </tr>
                  <tr className="db-summary-row db-closing-row">
                    <td className="db-footer-label">Total</td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-vno"></td>
                    <td className="db-footer-total">{fmtAlways(sideGrandTotal)}</td>
                    {onAdjust && <td></td>}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- Render adjustment (Journal) entries table ---
  const renderAdjustmentTable = (adjustments, drTotal, crTotal) => {
    if (adjustments.length === 0) return null;
    return (
      <div className="db-side db-side--adjustment" style={{ marginTop: 8, borderTop: '2px dashed #9c6fe4' }}>
        <div className="db-side__header" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
          <span className="db-side__title">ADJUSTMENT ENTRIES (Journal)</span>
          <span className="db-side__subtitle" style={{ marginLeft: 8 }}>(Non-cash)</span>
        </div>
        <div className="db-side__body">
          <table className="db-ledger">
            <thead>
              <tr>
                <th className="db-col-vno">Voucher No</th>
                <th className="db-col-vno">Account</th>
                <th className="db-col-desc">Description</th>
                <th className="db-col-total">Dr (₹)</th>
                <th className="db-col-total">Cr (₹)</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((entry, idx) => (
                <tr key={idx} className={`db-data-row ${idx % 2 === 0 ? 'db-row-even' : 'db-row-odd'}`}>
                  <td className="db-cell-vno">
                    <div>{entry.voucherNumber}</div>
                    <div style={{ fontSize: 9, color: '#7c3aed', fontWeight: 600 }}>{entry.voucherType}</div>
                  </td>
                  <td className="db-cell-vno" style={{ color: 'var(--mantine-color-violet-6)', fontSize: 11 }}>{entry.account}</td>
                  <td className="db-cell-desc" title={entry.description}>{entry.description}</td>
                  <td className="db-cell-total" style={{ color: '#1565c0' }}>{fmt(entry.drAmount)}</td>
                  <td className="db-cell-total" style={{ color: '#c62828' }}>{fmt(entry.crAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="db-side__footer">
          <table className="db-ledger db-ledger--footer">
            <tbody>
              <tr className="db-summary-row db-day-total">
                <td className="db-footer-label" colSpan={3}>Adjustment Total</td>
                <td className="db-footer-total">{fmtAlways(drTotal)}</td>
                <td className="db-footer-total">{fmtAlways(crTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- Render a single day card ---
  const renderDayCard = (card) => (
    <div key={card.date} className="db-card">
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
          {card.adjustments.length > 0 && (
            <span style={{ color: '#7c3aed' }}>Adj: {card.adjustments.length} entries</span>
          )}
        </div>
      </div>
      <div className="db-card__body">
        {renderSideTable('receipt', card.receipts, card.debitTotal, card.openingBalance, card.closingBalance, card.date, handleAdjust)}
        {renderSideTable('payment', card.payments, card.creditTotal, card.openingBalance, card.closingBalance, card.date, handleAdjust)}
      </div>
      {renderAdjustmentTable(card.adjustments, card.adjustmentDrTotal, card.adjustmentCrTotal)}
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
            {effectiveCards.filter(c => c.hasData).map((card) => renderDayCard(card))}
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
