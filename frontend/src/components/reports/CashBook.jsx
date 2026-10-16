import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI, dayBookAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import {
  Container, Paper, Text, Group, LoadingOverlay, Button,
  Title, Divider, Menu, Badge, Stack, Box, Select, ActionIcon
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCash, IconPrinter, IconFileTypePdf,
  IconFileSpreadsheet, IconCalendar,
  IconDownload, IconSearch, IconX, IconTrash,
  IconRectangle, IconRectangleVertical
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import A4PrintPreview from './shared/A4PrintPreview';
import { buildCashBookPrintHtml } from './cashBookPrint';

const CB_FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const CB_LINE = '1px solid #9AA0A6';
const CB_RULE = '1.5px solid #3A3F47';

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
  const [preset,     setPreset]    = useState('thisMonth');
  const [dateRange,  setDateRange]  = useState(getPresetRange('thisMonth'));
  const [dateMode,   setDateMode]   = useState('range');   // 'range' | 'single'
  const [singleDate, setSingleDate] = useState(new Date());
  const [reportData, setReportData] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [generatedDate, setGeneratedDate] = useState(new Date());
  const [printOrientation, setPrintOrientation] = useState(null); // preview open when set

  const [fromDate, toDate] = dateRange;

  const handlePresetChange = (val) => {
    setPreset(val);
    setDateMode('range');
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const handleSingleDateChange = (val) => {
    if (!val) return;
    setSingleDate(val);
    setPreset('custom');
    setDateRange([dayjs(val).startOf('day').toDate(), dayjs(val).endOf('day').toDate()]);
  };

  const companyName = selectedCompany?.societyName || selectedCompany?.companyName || 'Dairy Co-operative Society';
  const societyCode = selectedCompany?.societyCode || '';
  const societyPlace = selectedCompany?.address || selectedCompany?.district || '';

  const fetchCashBook = async (start, end) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const response = await reportAPI.cashBook({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD')
      });
      setReportData(response.data);
      setGeneratedDate(new Date());
    } catch (error) {
      message.error(error.message || 'Failed to fetch cash book');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => fetchCashBook(fromDate, toDate);

  const handleDeleteEntry = (entry) => {
    const key = entry.voucherId || `${entry.voucherType}-${entry.entryDate}`;
    modals.openConfirmModal({
      title: 'Delete Entry',
      children: <Text size="sm">Delete &ldquo;{entry.description}&rdquo;? This will permanently remove the underlying data and cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setDeletingId(key);
        try {
          await dayBookAPI.deleteEntry({
            voucherId: entry.voucherId || undefined,
            voucherType: entry.voucherType,
            date: entry.entryDate
          });
          notifications.show({ title: 'Deleted', message: 'Entry deleted successfully', color: 'teal' });
          fetchCashBook(fromDate, toDate);
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message || 'Failed to delete', color: 'red' });
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

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
          narration: txn.narration || '',
          voucherId: txn.voucherId || null,
          voucherType: txn.voucherType || null,
          entryDate: dateKey
        });
      }
      if (txn.credit > 0) {
        group.payments.push({
          description: txn.particulars || 'Cash Payment',
          voucherNumber: txn.voucherNumber || '',
          amount: txn.credit,
          narration: txn.narration || '',
          voucherId: txn.voucherId || null,
          voucherType: txn.voucherType || null,
          entryDate: dateKey
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

  // Grid: only the header rows are shaded; entry rows stay plain, with clear
  // column / row rules. Balance and total rows are set apart by weight + rules.
  const renderSideTable = (side, entries, total, openBal, closeBal) => {
    const isReceipt = side === 'receipt';
    const cell = { fontFamily: CB_FONT, fontSize: 13, border: CB_LINE, padding: '5px 8px', background: '#fff', color: '#1a1a1a' };
    const head = { ...cell, background: '#E9ECEF', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 };
    const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
    const bold = { fontWeight: 700 };
    const balLabel = isReceipt ? 'Opening Balance' : 'Closing Balance';
    const balAmt = isReceipt ? openBal : closeBal;

    return (
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', flex: 1 }}>
          <colgroup>
            <col style={{ width: '50%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '26%' }} />
            <col className="cb-no-print" style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={4} style={{ ...head, fontSize: 13, letterSpacing: 2, textAlign: 'center' }}>
                {isReceipt ? 'Receipt (Dr)' : 'Payment (Cr)'}
              </th>
            </tr>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>Description</th>
              <th style={{ ...head, textAlign: 'center' }}>{isReceipt ? 'Receipt No' : 'Voucher No'}</th>
              <th style={{ ...head, textAlign: 'right' }}>Cash</th>
              <th className="cb-no-print" style={{ ...head, padding: 0 }} />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...cell, textAlign: 'center', padding: '28px 8px', color: '#777', fontStyle: 'italic' }}>
                  No transactions
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => (
                <tr key={idx}>
                  <td title={entry.description} style={{ ...cell, overflow: 'hidden', maxWidth: 0 }}>
                    <Text className="cb-desc" fz={13} fw={500} truncate style={{ fontFamily: CB_FONT }}>{entry.description}</Text>
                    {entry.narration && (
                      <Text className="cb-narr" fz={11.5} c="dimmed" fs="italic" style={{ whiteSpace: 'pre-line', fontFamily: CB_FONT }}>{entry.narration}</Text>
                    )}
                  </td>
                  <td style={{ ...cell, textAlign: 'center', color: '#555' }}>{entry.voucherNumber}</td>
                  <td style={{ ...cell, ...num, fontWeight: 600 }}>{fmt(entry.amount)}</td>
                  <td className="cb-no-print" style={{ ...cell, textAlign: 'center', padding: 2 }}>
                    <ActionIcon
                      size="xs"
                      color="red"
                      variant="light"
                      loading={deletingId === (entry.voucherId || `${entry.voucherType}-${entry.entryDate}`)}
                      onClick={() => handleDeleteEntry(entry)}
                      title="Delete entry"
                    >
                      <IconTrash size={13} />
                    </ActionIcon>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {/* Footer — same rows as the Day Book: Opening (receipt side) and
              Closing (payment side) on one row, the day's transactions, then
              a Grand Total where both sides balance:
              Opening + Receipts = Payments + Closing. */}
          <tfoot>
            <tr>
              <td colSpan={2} style={{ ...cell, ...bold, borderTop: CB_RULE }}>{balLabel}</td>
              <td style={{ ...cell, ...num, ...bold, borderTop: CB_RULE }}>{fmtAlways(balAmt)}</td>
              <td className="cb-no-print" style={{ ...cell, borderTop: CB_RULE }} />
            </tr>
            <tr>
              <td colSpan={2} style={{ ...cell, ...bold }}>Transactions</td>
              <td style={{ ...cell, ...num, ...bold }}>{fmtAlways(total)}</td>
              <td className="cb-no-print" style={cell} />
            </tr>
            <tr>
              <td colSpan={2} style={{ ...cell, ...bold, borderTop: CB_RULE, borderBottom: '3px double #3A3F47' }}>Grand Total</td>
              <td style={{ ...cell, ...num, ...bold, borderTop: CB_RULE, borderBottom: '3px double #3A3F47' }}>{fmtAlways(balAmt + total)}</td>
              <td className="cb-no-print" style={{ ...cell, borderTop: CB_RULE, borderBottom: '3px double #3A3F47' }} />
            </tr>
          </tfoot>
        </table>
      </Box>
    );
  };

  const renderDayCard = (card) => (
    <Paper
      key={card.date}
      withBorder shadow="sm" radius="md" mb="lg"
      style={{ overflow: 'hidden', breakInside: 'avoid', background: '#fff', fontFamily: CB_FONT }}
    >
      {/* Header */}
      <Box ta="center" px="lg" pt="md" pb={10} style={{ borderBottom: CB_RULE, color: '#1a1a1a' }}>
        <Text fz={18} fw={700} tt="uppercase" style={{ letterSpacing: 1.5, fontFamily: CB_FONT }}>
          {companyName}
        </Text>
        {societyCode && <Text fz={12} fw={500} style={{ fontFamily: CB_FONT }}>Society Code: {societyCode}</Text>}
        {societyPlace && <Text fz={12} fw={500} style={{ fontFamily: CB_FONT }}>{societyPlace}</Text>}
        <Box mt={6} mb={4}>
          <Text
            component="span"
            display="inline-block"
            fz={14}
            fw={700}
            tt="uppercase"
            px={20}
            py={3}
            style={{
              fontFamily: CB_FONT,
              letterSpacing: 6,
              borderTop: CB_RULE,
              borderBottom: CB_RULE,
            }}
          >
            CASH BOOK
          </Text>
        </Box>
        <Text fz={15} fw={600} mt={4} style={{ fontFamily: CB_FONT }}>{dayjs(card.date).format('DD / MM / YYYY  (dddd)')}</Text>
        <Group justify="space-between" px={40} mt={6} style={{ fontVariantNumeric: 'tabular-nums' }}>
          <Text fz={12.5} fw={600} style={{ fontFamily: CB_FONT }}>Opening: {fmtAlways(card.openingBalance)}</Text>
          <Text fz={12.5} fw={600} style={{ fontFamily: CB_FONT }}>Closing: {fmtAlways(card.closingBalance)}</Text>
        </Group>
      </Box>

      {/* Body — two side panels */}
      <Group gap={0} align="stretch" wrap="nowrap" style={{ display: 'flex' }}>
        <Box style={{ flex: 1, borderRight: '2px solid #3A3F47', display: 'flex' }}>
          {renderSideTable('receipt', card.receipts, card.receiptTotal, card.openingBalance, card.closingBalance)}
        </Box>
        <Box style={{ flex: 1, display: 'flex' }}>
          {renderSideTable('payment', card.payments, card.paymentTotal, card.openingBalance, card.closingBalance)}
        </Box>
      </Group>

      {/* Signatures under every date — President centred, Secretary beside it */}
      <Box style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', padding: '26px 24px 10px', borderTop: CB_LINE }}>
        <Box style={{ gridColumn: 2, minWidth: 150, borderTop: '1px solid #3A3F47', paddingTop: 3, textAlign: 'center', fontSize: 12.5, fontWeight: 600 }}>
          President
        </Box>
        <Box style={{ gridColumn: 3, justifySelf: 'start', marginLeft: 60, minWidth: 150, borderTop: '1px solid #3A3F47', paddingTop: 3, textAlign: 'center', fontSize: 12.5, fontWeight: 600 }}>
          Secretary
        </Box>
      </Box>
    </Paper>
  );

  // PRINT — same dedicated B&W A4 layout as the Day Book (one date per page,
  // signatures under every date). The Print menu opens a preview of this
  // exact document; printing goes from there.
  const printHtml = useMemo(() => {
    if (!printOrientation) return '';
    return buildCashBookPrintHtml(dayCards, {
      societyName: companyName,
      societyCode,
      place: societyPlace,
      generatedOn: `${dayjs(generatedDate).format('DD/MM/YYYY HH:mm:ss')} | By ADM`,
      title: `Cash Book - ${formatDateShort(fromDate)} to ${formatDateShort(toDate)}`
    }, printOrientation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printOrientation, dayCards, companyName, societyCode, societyPlace, generatedDate]);

  const handlePrint = (orientation = 'portrait') => setPrintOrientation(orientation);

  const handlePDFExport = () => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const halfW = (pageWidth - 30) / 2;

    const head = [['Description', 'No', 'Cash']];
    const colStyles = {
      0: { halign: 'left',   cellWidth: halfW * 0.50 },
      1: { halign: 'center', cellWidth: halfW * 0.20 },
      2: { halign: 'right',  cellWidth: halfW * 0.30, fontStyle: 'bold' }
    };

    const buildBody = (entries, total, balLabel, balAmt) => {
      const body = entries.map(e => [e.description || '', e.voucherNumber || '', fmt(e.amount)]);
      const bold = { fontStyle: 'bold' };
      const boldRight = { halign: 'right', fontStyle: 'bold' };
      const bg1 = [240, 240, 245];
      const bg2 = [232, 232, 240];
      body.push([
        { content: balLabel, styles: { ...bold, fillColor: bg1 } },
        { content: '',       styles: { fillColor: bg1 } },
        { content: fmtAlways(balAmt), styles: { ...boldRight, fillColor: bg1 } }
      ]);
      body.push([
        { content: 'Transactions', styles: bold }, '',
        { content: fmtAlways(total), styles: boldRight }
      ]);
      body.push([
        { content: 'Grand Total', styles: { ...bold, fillColor: bg2, fontSize: 8 } },
        { content: '',      styles: { fillColor: bg2 } },
        { content: fmtAlways(total + balAmt), styles: { ...boldRight, fillColor: bg2, fontSize: 8 } }
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
        body: buildBody(card.receipts, card.receiptTotal, 'Opening Balance', card.openingBalance),
        startY: tableY,
        margin: { left: 14, right: pageWidth / 2 + 1 },
        tableWidth: halfW,
        ...commonOpts,
        headStyles: { ...commonOpts.headStyles, fillColor: [232, 245, 233] }
      });

      doc.text('PAYMENTS (Money Out)', pageWidth / 2 + 2, tableY - 1);
      autoTable(doc, {
        head,
        body: buildBody(card.payments, card.paymentTotal, 'Closing Balance', card.closingBalance),
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
      rows.push(['Description', 'Receipt No', 'Cash', '', 'Description', 'Voucher No', 'Cash']);

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

      rows.push(['Opening Balance', '', card.openingBalance, '', 'Closing Balance', '', card.closingBalance]);
      rows.push(['Transactions', '', card.receiptTotal, '', 'Transactions', '', card.paymentTotal]);
      rows.push(['Grand Total', '', card.openingBalance + card.receiptTotal, '', 'Grand Total', '', card.paymentTotal + card.closingBalance]);
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

            <Group gap={4} align="flex-end">
              {dateMode === 'single' ? (
                <DatePickerInput
                  label="Single Date"
                  value={singleDate}
                  onChange={handleSingleDateChange}
                  valueFormat="DD/MM/YYYY"
                  size="xs"
                  leftSection={<IconCalendar size={14} />}
                  w={150}
                  radius="md"
                  clearable={false}
                />
              ) : (
                <>
                  <DatePickerInput
                    label="From Date"
                    value={fromDate}
                    onChange={(val) => { setDateRange([val, toDate]); setPreset('custom'); }}
                    valueFormat="DD/MM/YYYY"
                    size="xs"
                    leftSection={<IconCalendar size={14} />}
                    w={130}
                    radius="md"
                    clearable={false}
                  />
                  <DatePickerInput
                    label="To Date"
                    value={toDate}
                    onChange={(val) => { setDateRange([fromDate, val]); setPreset('custom'); }}
                    valueFormat="DD/MM/YYYY"
                    size="xs"
                    leftSection={<IconCalendar size={14} />}
                    w={130}
                    radius="md"
                    clearable={false}
                  />
                </>
              )}
              <Button.Group>
                <Button size="xs" radius="md" variant={dateMode === 'range' ? 'filled' : 'default'}
                  onClick={() => setDateMode('range')} style={{ fontSize: 11, height: 30 }}>Range</Button>
                <Button size="xs" radius="md" variant={dateMode === 'single' ? 'filled' : 'default'}
                  onClick={() => { setDateMode('single'); handleSingleDateChange(singleDate); }}
                  style={{ fontSize: 11, height: 30 }}>Single</Button>
              </Button.Group>
            </Group>

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
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light" size="xs" radius="md"
                  leftSection={<IconPrinter size={14} />}
                  disabled={!reportData || !dayCards.length}
                >
                  Print
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Print Orientation</Menu.Label>
                <Menu.Item leftSection={<IconRectangleVertical size={16} color="var(--mantine-color-blue-6)" />} onClick={() => handlePrint('portrait')}>
                  A4 Portrait
                </Menu.Item>
                <Menu.Item leftSection={<IconRectangle size={16} color="var(--mantine-color-blue-6)" />} onClick={() => handlePrint('landscape')}>
                  A4 Landscape
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
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
          <Stack gap={0}>
            {dayCards.map((card) => renderDayCard(card))}

            {/* Signatures now sit under each date card; only the generated-on line remains here */}
            <Text c="dimmed" fz={11} ta="left" mb={8} style={{ fontFamily: CB_FONT }}>
              Generated On : {dayjs(generatedDate).format('DD/MM/YYYY HH:mm:ss')} | By ADM
            </Text>
          </Stack>
        )}

        {/* Print preview — the iframe shows the exact A4 document that gets printed */}
        <A4PrintPreview
          html={printHtml}
          orientation={printOrientation}
          title="Cash Book"
          onClose={() => setPrintOrientation(null)}
        />

        {!reportData && !loading && (
          <Paper radius="md" withBorder shadow="sm" py={80} ta="center">
            <Stack align="center" gap="xs">
              <IconCash size={56} stroke={1.2} opacity={0.25} />
              <Text c="dimmed" size="md" fw={500}>Select a date range and click Generate</Text>
              <Text c="dimmed" size="xs">Each date's entries print together — never split across pages</Text>
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
