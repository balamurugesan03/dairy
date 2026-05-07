import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import {
  Container, Paper, Text, Group, LoadingOverlay, Button,
  Title, Divider, Menu, Badge, Stack, Box, Table, Center, Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCash, IconPrinter, IconFileTypePdf,
  IconFileSpreadsheet, IconCalendar,
  IconDownload, IconSearch, IconX
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

const CashBook = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState('thisMonth');
  const [dateRange, setDateRange] = useState(getPresetRange('thisMonth'));
  const [reportData, setReportData] = useState(null);
  const printRef = useRef();

  const [fromDate, toDate] = dateRange;

  const handlePresetChange = (val) => {
    setPreset(val);
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';

  const fetchCashBook = async (start, end) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const response = await reportAPI.cashBook({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD')
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch cash book');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => fetchCashBook(fromDate, toDate);

  const fmt = (amount) => {
    const num = parseFloat(amount || 0);
    if (num === 0) return '';
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtAlways = (amount) => {
    const num = parseFloat(amount || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const formatDateLong  = (d) => dayjs(d).format('dddd, DD MMMM YYYY');
  const formatDateShort = (d) => dayjs(d).format('DD MMM YYYY');

  const dayCards = useMemo(() => {
    if (!reportData) return [];
    const dayMap = new Map();
    for (const txn of (reportData.transactions || [])) {
      const dateKey = dayjs(txn.date).format('YYYY-MM-DD');
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, { receipts: [], payments: [] });
      const group = dayMap.get(dateKey);
      if (txn.debit > 0) {
        group.receipts.push({
          description: txn.particulars || 'Cash Receipt',
          voucherNumber: txn.voucherNumber || '',
          amount: txn.debit,
          narration: txn.narration || ''
        });
      }
      if (txn.credit > 0) {
        group.payments.push({
          description: txn.particulars || 'Cash Payment',
          voucherNumber: txn.voucherNumber || '',
          amount: txn.credit,
          narration: txn.narration || ''
        });
      }
    }

    const cards = [];
    const start = dayjs(fromDate).startOf('day');
    const end   = dayjs(toDate).startOf('day');
    let cursor = start;
    let prevClosing = reportData.openingBalance || 0;

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
        receipts, payments,
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

  const renderSideTable = (side, entries, total, openBal, closeBal) => {
    const isReceipt = side === 'receipt';
    const headerBg = isReceipt
      ? 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)'
      : 'linear-gradient(135deg, #fce4ec 0%, #fff3e0 100%)';
    const headerColor = isReceipt ? '#2e7d32' : '#c62828';
    const headerBorder = isReceipt ? '#a5d6a7' : '#ef9a9a';
    const totalBg = isReceipt ? '#e8f5e9' : '#fce4ec';
    const closingBg = isReceipt ? '#c8e6c9' : '#ffcdd2';

    return (
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Side header */}
        <Group
          gap={8}
          px={14}
          py={8}
          style={{
            background: headerBg,
            color: headerColor,
            borderBottom: `2px solid ${headerBorder}`,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          <Text fw={700} fz={12}>{isReceipt ? 'DEBIT (Dr)' : 'CREDIT (Cr)'}</Text>
          <Text fz={10} fw={400} style={{ letterSpacing: 0.5, opacity: 0.7 }}>
            {isReceipt ? '(Income / Receipts)' : '(Expenses / Payments)'}
          </Text>
        </Group>

        {/* Body table */}
        <Box style={{ flex: 1, minHeight: 80 }}>
          <Table withColumnBorders striped highlightOnHover style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ textAlign: 'left', width: '50%', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Description
                </Table.Th>
                <Table.Th style={{ textAlign: 'center', width: '20%', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {isReceipt ? 'Receipt No' : 'Voucher No'}
                </Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '30%', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Cash (₹)
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={3} style={{ border: 'none' }}>
                    <Center py={30}>
                      <Text c="dimmed" fz={13} fs="italic">No transactions</Text>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : (
                entries.map((entry, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td title={entry.description} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>
                      <Text fz={12} fw={500} truncate>{entry.description}</Text>
                      {entry.narration && (
                        <Text fz={10} c="dimmed" fs="italic" truncate>{entry.narration}</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center', fontFamily: 'Consolas, monospace', fontSize: 11 }}>
                      <Text c="dimmed" fz={11}>{entry.voucherNumber}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {fmt(entry.amount)}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>

        {/* Footer totals */}
        <Box style={{ borderTop: '2px solid var(--mantine-color-dark-3)' }}>
          <Table withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Tbody>
              <Table.Tr style={{ background: totalBg }}>
                <Table.Td style={{ textAlign: 'left', fontWeight: 600, width: '50%' }}>Day Total</Table.Td>
                <Table.Td style={{ width: '20%' }}></Table.Td>
                <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums', width: '30%' }}>
                  {fmtAlways(total)}
                </Table.Td>
              </Table.Tr>
              <Table.Tr style={{ background: 'var(--mantine-color-gray-0)' }}>
                <Table.Td style={{ textAlign: 'left', fontWeight: 600 }}>
                  {isReceipt ? 'Opening Balance' : 'Closing Balance'}
                </Table.Td>
                <Table.Td></Table.Td>
                <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtAlways(isReceipt ? openBal : closeBal)}
                </Table.Td>
              </Table.Tr>
              <Table.Tr style={{ background: closingBg, borderTop: '2px solid var(--mantine-color-dark-4)', borderBottom: '3px double var(--mantine-color-dark-4)' }}>
                <Table.Td style={{ textAlign: 'left', fontWeight: 700 }}>Closing Balance</Table.Td>
                <Table.Td></Table.Td>
                <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtAlways(closeBal)}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          {/* Signatures */}
          <Box px="md" py="sm">
            <Text c="dimmed" fz={10} ta="left">
              Generated on {dayjs().format('DD/MM/YYYY HH:mm:ss')} | By ADM
            </Text>
            <Group justify="space-between" mt="xl" px="xl">
              <Box style={{ borderTop: '1px solid var(--mantine-color-dark-4)', minWidth: 110, textAlign: 'center', paddingTop: 4 }}>
                <Text fz={11} fw={600}>President</Text>
              </Box>
              <Box style={{ borderTop: '1px solid var(--mantine-color-dark-4)', minWidth: 110, textAlign: 'center', paddingTop: 4 }}>
                <Text fz={11} fw={600}>Secretary</Text>
              </Box>
            </Group>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderDayCard = (card) => (
    <Paper key={card.date} withBorder shadow="sm" radius="md" mb="lg" style={{ overflow: 'hidden', breakInside: 'avoid' }}>
      {/* Header */}
      <Box
        ta="center"
        px="lg" pt="md" pb={10}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          background: 'linear-gradient(180deg, var(--mantine-color-gray-0) 0%, var(--mantine-color-body) 100%)',
        }}
      >
        <Text fz={18} fw={700} tt="uppercase" style={{ letterSpacing: 2 }}>
          {companyName}
        </Text>
        <Box mt={6} mb={4}>
          <Text
            component="span"
            display="inline-block"
            fz={14}
            fw={700}
            c="blue.7"
            tt="uppercase"
            px={20}
            py={3}
            style={{
              letterSpacing: 6,
              borderTop: '2px solid var(--mantine-color-blue-4)',
              borderBottom: '2px solid var(--mantine-color-blue-4)',
            }}
          >
            CASH BOOK
          </Text>
        </Box>
        <Text fz={13} fw={600} mt={4}>{formatDateLong(card.date)}</Text>
        <Group justify="space-between" px={40} mt={6} style={{ fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>
          <Text fz={12} c="dimmed" fw={500}>Opening: ₹{fmtAlways(card.openingBalance)}</Text>
          <Text fz={12} c="dimmed" fw={500}>Closing: ₹{fmtAlways(card.closingBalance)}</Text>
        </Group>
      </Box>

      {/* Body — two side panels */}
      <Group gap={0} align="stretch" wrap="nowrap" style={{ borderTop: 0 }}>
        <Box style={{ flex: 1, borderRight: '2px solid var(--mantine-color-default-border)' }}>
          {renderSideTable('receipt', card.receipts, card.receiptTotal, card.openingBalance, card.closingBalance)}
        </Box>
        <Box style={{ flex: 1 }}>
          {renderSideTable('payment', card.payments, card.paymentTotal, card.openingBalance, card.closingBalance)}
        </Box>
      </Group>
    </Paper>
  );

  // PRINT / PDF / EXCEL — unchanged
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
    .mantine-Paper-root { page-break-after: always; padding: 10mm; border: none !important; box-shadow: none !important; }
    .mantine-Paper-root:last-child { page-break-after: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 3px 5px; font-size: 9.5px; }
    th { background: #f5f5fa; font-weight: 700; font-size: 8.5px; text-transform: uppercase; }
    @page { size: A4 portrait; margin: 6mm; }
  </style>
</head>
<body>${content.innerHTML}</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  const handlePDFExport = () => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const halfW = (pageWidth - 30) / 2;

    const head = [['Description', 'No', 'Cash (₹)']];
    const colStyles = {
      0: { halign: 'left',   cellWidth: halfW * 0.50 },
      1: { halign: 'center', cellWidth: halfW * 0.20 },
      2: { halign: 'right',  cellWidth: halfW * 0.30, fontStyle: 'bold' }
    };

    const buildBody = (entries, total, balLabel, balAmt, closeBal) => {
      const body = entries.map(e => [e.description || '', e.voucherNumber || '', fmt(e.amount)]);
      const bold = { fontStyle: 'bold' };
      const boldRight = { halign: 'right', fontStyle: 'bold' };
      const bg1 = [240, 240, 245];
      const bg2 = [232, 232, 240];
      body.push([
        { content: 'Day Total', styles: { ...bold, fillColor: bg1 } },
        { content: '',          styles: { fillColor: bg1 } },
        { content: fmtAlways(total), styles: { ...boldRight, fillColor: bg1 } }
      ]);
      body.push([
        { content: balLabel, styles: bold }, '',
        { content: fmtAlways(balAmt), styles: boldRight }
      ]);
      body.push([
        { content: 'Closing Balance', styles: { ...bold, fillColor: bg2, fontSize: 8 } },
        { content: '',                styles: { fillColor: bg2 } },
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
    <Container size="xl" py="md" style={{ maxWidth: 1400 }}>
      {/* Toolbar */}
      <Paper p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <Group gap="xs" align="center">
              <IconCash size={22} color="var(--mantine-color-blue-6)" />
              <Title order={4}>Cash Book</Title>
              <Divider orientation="vertical" style={{ height: 24, margin: '0 4px' }} />
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
            {reportData && (
              <Badge variant="light" size="lg" radius="md">
                {daysWithData} / {totalDays} days
              </Badge>
            )}
            <Button
              variant="light" size="xs" radius="md"
              leftSection={<IconPrinter size={14} />}
              onClick={handlePrint}
              disabled={!reportData}
            >
              Print
            </Button>
            <Menu shadow="md" width={160} position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light" color="gray" size="xs" radius="md"
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
      <Box pos="relative">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && dayCards.length > 0 && (
          <Stack ref={printRef} gap={0}>
            {dayCards.map((card) => renderDayCard(card))}
          </Stack>
        )}

        {!reportData && !loading && (
          <Paper radius="md" withBorder shadow="sm" py={80} ta="center">
            <Stack align="center" gap="xs">
              <IconCash size={56} stroke={1.2} opacity={0.25} />
              <Text c="dimmed" size="md" fw={500}>Select a date range and click Generate</Text>
              <Text c="dimmed" size="xs">Each date will display as a separate printable page</Text>
            </Stack>
          </Paper>
        )}

        {reportData && !loading && dayCards.length === 0 && (
          <Paper radius="md" withBorder shadow="sm" py={80} ta="center">
            <Stack align="center" gap="xs">
              <IconCash size={56} stroke={1.2} opacity={0.25} />
              <Text c="dimmed" size="md" fw={500}>No dates in selected range</Text>
            </Stack>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default CashBook;
