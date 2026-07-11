import { useState, useRef } from 'react';
import {
  Box, Button, Center, Container, Divider, Group, Loader,
  Paper, Stack, Table, Text, Title
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconArrowsLeftRight, IconCalendar, IconDownload,
  IconFileSpreadsheet, IconFileTypePdf, IconPrinter,
  IconRectangle, IconRectangleVertical, IconSearch
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ReceiptsPayments = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [fromDate, setFromDate] = useState(() => {
    const today = dayjs();
    return (today.month() >= 3
      ? dayjs().month(3).date(1)
      : dayjs().subtract(1, 'year').month(3).date(1)
    ).toDate();
  });
  const [toDate, setToDate] = useState(new Date());
  const printRef = useRef(null);

  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';
  const periodLabel = `${dayjs(fromDate).format('DD/MM/YYYY')} to ${dayjs(toDate).format('DD/MM/YYYY')}`;

  const fetchReport = async () => {
    if (!fromDate || !toDate) {
      notifications.show({ color: 'orange', message: 'Please select date range' });
      return;
    }
    setLoading(true);
    try {
      const res = await reportAPI.receiptsPayments({
        startDate: dayjs(fromDate).format('YYYY-MM-DD'),
        endDate: dayjs(toDate).format('YYYY-MM-DD'),
      });
      setReportData(res?.data || res);
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Failed to fetch report' });
    } finally {
      setLoading(false);
    }
  };

  /* ── Print ── */
  const handlePrint = (orientation = 'landscape') => {
    if (!printRef.current) return;
    const pw = window.open('', '_blank');
    pw.document.write(`<!DOCTYPE html><html><head>
      <title>Receipts & Payments — ${companyName}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',Tahoma,sans-serif;color:#1a1a2e;background:#fff}
        .rp-register{border:1.5px solid #000}
        .rp-header{text-align:center;padding:10mm 10mm 6mm;border-bottom:2px solid #000}
        .rp-header__society{font-size:17px;font-weight:800;letter-spacing:3px;text-transform:uppercase}
        .rp-header__title{display:inline-block;font-size:13px;font-weight:700;letter-spacing:7px;text-transform:uppercase;padding:3px 20px;border-top:2.5px double #000;border-bottom:2.5px double #000}
        .rp-header__info{display:flex;justify-content:space-between;padding:6px 0 0;font-size:10.5px}
        table{width:100%;border-collapse:collapse;font-size:9.5px}
        th,td{border:1px solid #aaa;padding:3px 6px}
        th{background:#eee;font-weight:700;text-align:center;font-size:8.5px;text-transform:uppercase}
        .td-label{text-align:left;font-size:9.5px}
        .td-num{text-align:right;font-family:Consolas,monospace;font-size:9.5px}
        .row-total td{background:#e8eaf6;font-weight:800;border-top:2.5px double #000;border-bottom:2.5px double #000}
        .row-balance td{background:#fffde7;font-weight:700}
        @page{size:A4 ${orientation};margin:8mm}
      </style></head><body>${printRef.current.innerHTML}</body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 300);
  };

  /* ── PDF ── */
  const handlePDF = (orientation = 'landscape') => {
    if (!reportData) return;
    const doc = new jsPDF(orientation, 'mm', 'a4');
    const pw = doc.internal.pageSize.width;
    const mg = orientation === 'portrait' ? 10 : 12;
    const fs = orientation === 'portrait' ? 6 : 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(orientation === 'portrait' ? 13 : 15);
    doc.text(companyName.toUpperCase(), pw / 2, 12, { align: 'center' });
    doc.setFontSize(orientation === 'portrait' ? 11 : 12);
    doc.text('RECEIPTS & PAYMENTS ACCOUNT', pw / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Period: ${periodLabel}`, mg, 24);
    doc.setLineWidth(0.4);
    doc.line(mg, 26, pw - mg, 26);

    const receipts = reportData.receiptItems || [];
    const payments = reportData.paymentItems || [];
    const maxRows  = Math.max(receipts.length, payments.length);
    const body = [];
    for (let i = 0; i < maxRows; i++) {
      const r = receipts[i] || { label: '', amount: 0 };
      const p = payments[i] || { label: '', amount: 0 };
      body.push([
        { content: r.label, styles: { halign: 'left' } },
        { content: r.amount > 0 ? fmt(r.amount) : '', styles: { halign: 'right' } },
        { content: p.label, styles: { halign: 'left' } },
        { content: p.amount > 0 ? fmt(p.amount) : '', styles: { halign: 'right' } },
      ]);
    }
    const bgB = [232, 234, 246];
    body.push([
      { content: 'TOTAL RECEIPTS', styles: { fontStyle: 'bold', halign: 'left', fillColor: bgB } },
      { content: fmt(reportData.totalReceipts), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgB } },
      { content: 'TOTAL PAYMENTS', styles: { fontStyle: 'bold', halign: 'left', fillColor: bgB } },
      { content: fmt(reportData.totalPayments), styles: { fontStyle: 'bold', halign: 'right', fillColor: bgB } },
    ]);

    autoTable(doc, {
      head: [['Receipt Particulars', 'Amount (₹)', 'Payment Particulars', 'Amount (₹)']],
      body,
      startY: 28,
      margin: { left: mg, right: mg },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: fs, cellPadding: 1.5, lineColor: [150, 150, 150], lineWidth: 0.15 },
      headStyles: { fillColor: [230, 230, 235], textColor: [26, 26, 46], fontStyle: 'bold', fontSize: fs, halign: 'center' },
      columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } }
    });

    doc.save(`receipts_payments_${dayjs(fromDate).format('YYYY-MM-DD')}.pdf`);
  };

  /* ── Excel ── */
  const handleExcel = () => {
    if (!reportData) return;
    const receipts = reportData.receiptItems || [];
    const payments = reportData.paymentItems || [];
    const maxRows  = Math.max(receipts.length, payments.length);
    const rows = [
      [companyName.toUpperCase()],
      ['RECEIPTS & PAYMENTS ACCOUNT'],
      [`Period: ${periodLabel}`],
      [],
      ['Receipt Particulars', 'Amount (₹)', 'Payment Particulars', 'Amount (₹)'],
    ];
    for (let i = 0; i < maxRows; i++) {
      const r = receipts[i] || { label: '', amount: 0 };
      const p = payments[i] || { label: '', amount: 0 };
      rows.push([r.label, r.amount > 0 ? r.amount : '', p.label, p.amount > 0 ? p.amount : '']);
    }
    rows.push(['TOTAL RECEIPTS', reportData.totalReceipts, 'TOTAL PAYMENTS', reportData.totalPayments]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 32 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Receipts & Payments');
    XLSX.writeFile(wb, `receipts_payments_${dayjs(fromDate).format('YYYY-MM-DD')}.xlsx`);
  };

  /* ── Table renderer ── */
  const renderTable = () => {
    if (!reportData) return null;
    const receipts  = reportData.receiptItems || [];
    const payments  = reportData.paymentItems || [];
    const maxRows   = Math.max(receipts.length, payments.length);
    const thStyle   = { background: '#ECEEF2', border: '1px solid #9FA6B2', padding: '7px 10px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#1a1a2e', letterSpacing: 0.8 };
    const tdBase    = { border: '1px solid #C8CDD2', padding: '5px 10px', fontSize: 12.5, verticalAlign: 'middle' };
    const tdNum     = { ...tdBase, textAlign: 'right', fontFamily: "'Consolas','Courier New',monospace", fontVariantNumeric: 'tabular-nums' };
    const divider   = { borderLeft: '2.5px solid #1a1a2e' };

    const rows = [];
    for (let i = 0; i < maxRows; i++) {
      const r = receipts[i];
      const p = payments[i];
      const bg = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
      rows.push(
        <tr key={i} style={{ background: bg }}>
          <td style={{ ...tdBase, color: r?.isAdjustment ? '#b45309' : '#1a4d2e', fontWeight: r ? 500 : 400, fontStyle: r?.isAdjustment ? 'italic' : 'normal' }}>
            {r ? `${i + 1}. ${r.label}` : ''}
          </td>
          <td style={{ ...tdNum, color: r?.isAdjustment ? '#b45309' : '#1a4d2e' }}>
            {r && r.amount > 0 ? fmt(r.amount) : ''}
          </td>
          <td style={{ ...tdBase, ...divider, color: p?.isAdjustment ? '#b45309' : '#4a1a1a', fontWeight: p ? 500 : 400, fontStyle: p?.isAdjustment ? 'italic' : 'normal' }}>
            {p ? `${i + 1}. ${p.label}` : ''}
          </td>
          <td style={{ ...tdNum, color: p?.isAdjustment ? '#b45309' : '#4a1a1a' }}>
            {p && p.amount > 0 ? fmt(p.amount) : ''}
          </td>
        </tr>
      );
    }

    const totalBg  = { background: '#E8EAF6', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e', fontWeight: 800, fontSize: 13 };
    const balance  = (reportData.totalReceipts || 0) - (reportData.totalPayments || 0);

    return (
      <Box
        ref={printRef}
        className="rp-register"
        style={{ border: '1.5px solid #1a1a2e', borderRadius: 4, background: '#fff', overflow: 'hidden' }}
      >
        {/* Header */}
        <Box style={{ textAlign: 'center', padding: '20px 30px 14px', borderBottom: '2px solid #1a1a2e' }}>
          <Text style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>
            {companyName}
          </Text>
          <Box my={8}>
            <Text component="span" style={{ display: 'inline-block', fontSize: 15, fontWeight: 700, letterSpacing: 8, textTransform: 'uppercase', padding: '4px 24px', borderTop: '2.5px double #1a1a2e', borderBottom: '2.5px double #1a1a2e' }}>
              RECEIPTS &amp; PAYMENTS ACCOUNT
            </Text>
          </Box>
          <Text size="sm" c="dimmed" mt={4}>Period : {periodLabel}</Text>
        </Box>

        {/* Two-column table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '38%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '38%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', color: '#1a4d2e', background: '#E8F5E9' }}>Receipt Particulars</th>
              <th style={{ ...thStyle, textAlign: 'right', color: '#1a4d2e', background: '#E8F5E9' }}>Amount (₹)</th>
              <th style={{ ...thStyle, textAlign: 'left', color: '#4a1a1a', background: '#FFEBEE', borderLeft: '2.5px solid #1a1a2e' }}>Payment Particulars</th>
              <th style={{ ...thStyle, textAlign: 'right', color: '#4a1a1a', background: '#FFEBEE' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows}
            {/* Balance row (if receipts > payments, balance is carried to payments side) */}
            {balance > 0 && (
              <tr style={{ background: '#FFFDE7' }}>
                <td style={{ ...tdBase, fontStyle: 'italic', color: '#666' }} />
                <td style={{ ...tdNum, fontStyle: 'italic', color: '#666' }} />
                <td style={{ ...tdBase, ...divider, fontStyle: 'italic', color: '#555', fontWeight: 600 }}>
                  Balance (Excess of Receipts)
                </td>
                <td style={{ ...tdNum, fontWeight: 600, color: '#555' }}>{fmt(balance)}</td>
              </tr>
            )}
            {balance < 0 && (
              <tr style={{ background: '#FFFDE7' }}>
                <td style={{ ...tdBase, fontStyle: 'italic', color: '#555', fontWeight: 600 }}>
                  Balance (Excess of Payments)
                </td>
                <td style={{ ...tdNum, fontWeight: 600, color: '#555' }}>{fmt(Math.abs(balance))}</td>
                <td style={{ ...tdBase, ...divider, fontStyle: 'italic', color: '#666' }} />
                <td style={{ ...tdNum, fontStyle: 'italic', color: '#666' }} />
              </tr>
            )}
            {/* Grand total row */}
            <tr>
              <td style={{ ...tdBase, ...totalBg, fontSize: 13 }}>TOTAL</td>
              <td style={{ ...tdNum, ...totalBg, fontSize: 13 }}>
                {fmt(balance >= 0 ? reportData.totalReceipts : reportData.totalReceipts - balance)}
              </td>
              <td style={{ ...tdBase, ...totalBg, ...divider, fontSize: 13 }}>TOTAL</td>
              <td style={{ ...tdNum, ...totalBg, fontSize: 13 }}>
                {fmt(balance <= 0 ? reportData.totalPayments : reportData.totalPayments + balance)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <Box style={{ borderTop: '2px solid #1a1a2e', padding: '20px 30px' }}>
          <Text ta="center" size="xs" c="dimmed" mb="xl" fs="italic">
            Generated on {dayjs().format('DD/MM/YYYY HH:mm:ss')} &nbsp;|&nbsp; Dairy Cooperative Management System
          </Text>
          <Group justify="space-between" px="xl">
            {['President', 'Secretary', 'Accountant'].map(sig => (
              <Stack key={sig} gap={0} align="center" style={{ minWidth: 140 }}>
                <Box style={{ borderTop: '1px solid #1a1a2e', marginTop: 40, paddingTop: 6, width: '100%' }}>
                  <Text ta="center" size="xs" fw={600} style={{ letterSpacing: 0.5 }}>{sig}</Text>
                </Box>
              </Stack>
            ))}
          </Group>
        </Box>
      </Box>
    );
  };

  return (
    <Container size="xl" py="md">
      {/* Toolbar */}
      <Paper p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <IconArrowsLeftRight size={22} style={{ marginBottom: 4, color: 'var(--mantine-color-teal-6)' }} />
            <Title order={4} style={{ marginBottom: 2 }}>Receipts &amp; Payments Account</Title>
            <Divider orientation="vertical" style={{ height: 24 }} />
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
              color="teal"
              leftSection={<IconSearch size={14} />}
              onClick={fetchReport}
              loading={loading}
              disabled={!fromDate || !toDate}
            >
              Generate
            </Button>
          </Group>

          <Group gap="xs">
            {/* Print */}
            {reportData && (
              <>
                <Button.Group>
                  <Button
                    variant="light"
                    size="xs"
                    radius="md"
                    leftSection={<IconPrinter size={14} />}
                    onClick={() => handlePrint('landscape')}
                  >
                    Print
                  </Button>
                </Button.Group>
                <Button.Group>
                  <Button
                    variant="light"
                    color="red"
                    size="xs"
                    radius="md"
                    leftSection={<IconFileTypePdf size={14} />}
                    onClick={() => handlePDF('landscape')}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="light"
                    color="green"
                    size="xs"
                    radius="md"
                    leftSection={<IconFileSpreadsheet size={14} />}
                    onClick={handleExcel}
                  >
                    Excel
                  </Button>
                </Button.Group>
              </>
            )}
          </Group>
        </Group>
      </Paper>

      {loading && (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="teal" />
            <Text size="md" fw={500} c="dimmed">Loading Receipts &amp; Payments Account...</Text>
          </Stack>
        </Center>
      )}

      {!loading && reportData && renderTable()}

      {!loading && !reportData && (
        <Paper radius="md" withBorder shadow="sm" p="xl" ta="center">
          <IconArrowsLeftRight size={56} stroke={1.2} opacity={0.25} />
          <Text c="dimmed" size="md" mt="sm" fw={500}>
            Select a date range and click Generate
          </Text>
          <Text c="dimmed" size="xs" mt={4}>
            Shows all cash receipts vs payments for the selected period
          </Text>
        </Paper>
      )}
    </Container>
  );
};

export default ReceiptsPayments;
