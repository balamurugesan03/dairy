import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Group, Text, Title, Box,
  Button, Badge, Table, ScrollArea, Loader,
  Collapse, Divider, ActionIcon, Tooltip,
  Modal, TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconChevronDown, IconChevronRight, IconRefresh, IconCalendar,
  IconPrinter, IconEdit, IconTrash, IconArrowBackUp, IconCheck,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import { useNavigate } from 'react-router-dom';
import { paymentRegisterAPI } from '../../services/api';

const CYCLES = [5, 10, 15, 30];

const fmt  = (v) => (parseFloat(v) || 0).toFixed(2);
const fmtD = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '—';

const th = {
  fontSize: 10, fontWeight: 700, background: '#1a365d', color: '#fff',
  padding: '5px 6px', textAlign: 'center', border: '1px solid #2d4a7a',
  whiteSpace: 'nowrap',
};
const tdStyle = (align = 'center') => ({
  fontSize: 11, padding: '4px 6px', border: '1px solid #e2e8f0',
  textAlign: align, verticalAlign: 'middle',
});

const PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    .lph-print-area, .lph-print-area * { visibility: visible !important; }
    .lph-print-area { position: fixed; inset: 0; padding: 10px; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; font-size: 9px; padding: 3px 5px; }
    th { background: #1a365d !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .tot-row td { background: #ebf8ff !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 8mm; }
  }
`;

/* ── Table body shared between screen and print ── */
const CycleTable = ({ entries }) => (
  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
    <thead>
      <tr>
        <th style={th}>SN</th>
        <th style={th}>ID</th>
        <th style={{ ...th, textAlign: 'left' }}>Name</th>
        <th style={th}>Qty</th>
        <th style={th}>Milk Value</th>
        <th style={th}>Prev Bal</th>
        <th style={th}>Other Earn</th>
        <th style={th}>Total Earn</th>
        <th style={th}>Welfare</th>
        <th style={th}>CF Adv</th>
        <th style={th}>CF Rec</th>
        <th style={th}>Cash Adv</th>
        <th style={th}>Cash Rec</th>
        <th style={th}>Loan Adv</th>
        <th style={th}>Loan Rec</th>
        <th style={th}>Other Ded</th>
        <th style={th}>Total Ded</th>
        <th style={th}>Net Pay</th>
        <th style={th}>Paid Amt</th>
        <th style={th}>Mode</th>
      </tr>
    </thead>
    <tbody>
      {entries.map((e, i) => {
        const mode = e.payMode || e.paymentMode || 'Cash';
        return (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7fafc' }}>
            <td style={tdStyle()}>{e.slNo || i + 1}</td>
            <td style={tdStyle()}>{e.producerId || e.productId || '—'}</td>
            <td style={tdStyle('left')}>{e.producerName || e.productName || '—'}</td>
            <td style={tdStyle()}>{fmt(e.qty)}</td>
            <td style={tdStyle()}>{fmt(e.milkValue)}</td>
            <td style={tdStyle()}>{fmt(e.previousBalance)}</td>
            <td style={tdStyle()}>{fmt(e.otherEarnings)}</td>
            <td style={tdStyle()}>{fmt(e.totalEarnings)}</td>
            <td style={tdStyle()}>{fmt(e.welfare)}</td>
            <td style={tdStyle()}>{fmt(e.cfAdv)}</td>
            <td style={tdStyle()}>{fmt(e.cfRec)}</td>
            <td style={tdStyle()}>{fmt(e.cashAdv)}</td>
            <td style={tdStyle()}>{fmt(e.cashRec)}</td>
            <td style={tdStyle()}>{fmt(e.loanAdv)}</td>
            <td style={tdStyle()}>{fmt(e.loanRec)}</td>
            <td style={tdStyle()}>{fmt(e.otherDed)}</td>
            <td style={tdStyle()}>{fmt(e.totalDed)}</td>
            <td style={{ ...tdStyle(), fontWeight: 700, color: '#276749' }}>{fmt(e.netPay)}</td>
            <td style={{ ...tdStyle(), fontWeight: 700, color: '#2b6cb0' }}>{fmt(e.paidAmount)}</td>
            <td style={tdStyle()}>{mode}</td>
          </tr>
        );
      })}
      {/* totals row */}
      <tr className="tot-row" style={{ background: '#ebf8ff', fontWeight: 700 }}>
        <td colSpan={3} style={{ ...tdStyle('right'), fontWeight: 700 }}>TOTAL</td>
        <td style={tdStyle()}>{entries.reduce((s,e)=>s+(parseFloat(e.qty)||0),0).toFixed(2)}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.milkValue)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.previousBalance)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.otherEarnings)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.totalEarnings)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.welfare)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.cfAdv)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.cfRec)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.cashAdv)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.cashRec)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.loanAdv)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.loanRec)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.otherDed)||0),0))}</td>
        <td style={tdStyle()}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.totalDed)||0),0))}</td>
        <td style={{ ...tdStyle(), color: '#276749' }}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.netPay)||0),0))}</td>
        <td style={{ ...tdStyle(), color: '#2b6cb0' }}>{fmt(entries.reduce((s,e)=>s+(parseFloat(e.paidAmount)||0),0))}</td>
        <td style={tdStyle()} />
      </tr>
    </tbody>
  </table>
);

/* ── Single cycle card ── */
const CycleCard = ({ rec, companyName, onEdit, onReverse, reversing }) => {
  const [open, setOpen] = useState(false);
  const printRef = useRef();
  const entries   = rec.entries || [];
  const totalNet  = entries.reduce((s, e) => s + (parseFloat(e.netPay)     || 0), 0);
  const totalPaid = entries.reduce((s, e) => s + (parseFloat(e.paidAmount) || 0), 0);
  const totalQty  = entries.reduce((s, e) => s + (parseFloat(e.qty)        || 0), 0);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `LedgerHistory_${fmtD(rec.fromDate)}_${fmtD(rec.toDate)}`,
  });

  return (
    <Paper withBorder shadow="xs" mb="sm" style={{ overflow: 'hidden' }}>
      {/* ── cycle header ── */}
      <Group
        justify="space-between" px="md" py="xs"
        style={{ background: '#ebf8ff' }}
      >
        <Group gap="sm" style={{ cursor: 'pointer', flex: 1 }} onClick={() => setOpen(p => !p)}>
          {open ? <IconChevronDown size={16} color="#2b6cb0" /> : <IconChevronRight size={16} color="#2b6cb0" />}
          <Box>
            <Text fw={700} size="sm" c="#1a365d">
              {fmtD(rec.fromDate)} &nbsp;—&nbsp; {fmtD(rec.toDate)}
            </Text>
            <Text size="xs" c="dimmed">
              {entries.length} farmers &nbsp;|&nbsp;
              Qty: {totalQty.toFixed(2)} &nbsp;|&nbsp;
              Net Pay: ₹{fmt(totalNet)} &nbsp;|&nbsp;
              Paid: ₹{fmt(totalPaid)}
            </Text>
          </Box>
        </Group>
        <Group gap="xs" className="no-print">
          <Badge color="teal"  variant="light" size="sm">{entries.length} entries</Badge>
          <Badge color="gray"  variant="outline" size="xs">Saved: {fmtD(rec.createdAt)}</Badge>

          {/* Edit button */}
          <Tooltip label="Edit Remarks">
            <ActionIcon
              variant="light"
              color="blue"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onEdit(rec); }}
            >
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>

          {/* Reverse / Delete button */}
          <Tooltip label="Delete & Reverse — cancels payments, re-opens in Detailed Ledger">
            <ActionIcon
              variant="light"
              color="red"
              size="sm"
              loading={reversing}
              onClick={(e) => { e.stopPropagation(); onReverse(rec); }}
            >
              <IconArrowBackUp size={14} />
            </ActionIcon>
          </Tooltip>

          {/* Print button */}
          <Button
            size="xs" variant="light" color="blue"
            leftSection={<IconPrinter size={13} />}
            className="no-print"
            onClick={(e) => { e.stopPropagation(); handlePrint(); }}
          >
            Print
          </Button>
        </Group>
      </Group>

      {/* ── hidden print area ── */}
      <div ref={printRef} className="lph-print-area" style={{ display: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{companyName || 'Dairy Cooperative Society'}</div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>LEDGER PAYMENT HISTORY</div>
          <div style={{ fontSize: 11 }}>Period: {fmtD(rec.fromDate)} — {fmtD(rec.toDate)}</div>
          <div style={{ fontSize: 10, color: '#555' }}>{entries.length} Farmers | Net Pay: ₹{fmt(totalNet)} | Paid: ₹{fmt(totalPaid)}</div>
        </div>
        <CycleTable entries={entries} />
      </div>

      {/* ── detail table (screen) ── */}
      <Collapse in={open}>
        <Divider />
        <ScrollArea>
          <CycleTable entries={entries} />
        </ScrollArea>
      </Collapse>
    </Paper>
  );
};

/* ════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════ */
const LedgerPaymentHistory = () => {
  const navigate = useNavigate();

  const [fromDate,    setFromDate]    = useState(dayjs().startOf('month').toDate());
  const [toDate,      setToDate]      = useState(dayjs().endOf('month').toDate());
  const [allRecords,  setAllRecords]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [activeCycle, setActiveCycle] = useState(null);
  const printAllRef = useRef();

  /* ── edit modal ── */
  const [editModal,   setEditModal]   = useState(false);
  const [editRec,     setEditRec]     = useState(null);
  const [editRemarks, setEditRemarks] = useState('');
  const [editSaving,  setEditSaving]  = useState(false);

  /* ── reverse state ── */
  const [reversingId, setReversingId] = useState(null);

  const handlePrintAll = useReactToPrint({
    content: () => printAllRef.current,
    documentTitle: `LedgerHistory_All_${dayjs(fromDate).format('DDMMYYYY')}`,
  });

  const applyCycle = (days) => {
    setActiveCycle(days);
    const from = dayjs().startOf('month').toDate();
    const to   = dayjs(from).add(days - 1, 'day').toDate();
    setFromDate(from);
    setToDate(to);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await paymentRegisterAPI.getAll({ registerType: 'Ledger', limit: 1000 });
      if (res?.success) {
        setAllRecords(res.data || []);
      } else {
        notifications.show({ title: 'Error', message: res?.message || 'Failed to load', color: 'red' });
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  // Client-side filter by selected date range
  const records = allRecords.filter(r => {
    const d  = dayjs(r.fromDate).startOf('day');
    const fd = dayjs(fromDate).startOf('day');
    const td = dayjs(toDate).startOf('day');
    return !d.isBefore(fd) && !d.isAfter(td);
  });

  /* ── Open edit remarks modal ── */
  const openEdit = (rec) => {
    setEditRec(rec);
    setEditRemarks(rec.remarks || '');
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editRec) return;
    setEditSaving(true);
    try {
      const res = await paymentRegisterAPI.update(editRec._id, { remarks: editRemarks });
      if (res?.success) {
        setAllRecords(prev => prev.map(r => r._id === editRec._id ? { ...r, remarks: editRemarks } : r));
        notifications.show({ message: 'Remarks updated', color: 'teal', icon: <IconCheck size={14} /> });
        setEditModal(false);
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setEditSaving(false);
    }
  };

  /* ── Delete & Reverse ── */
  const handleReverse = (rec) => {
    const label = `${fmtD(rec.fromDate)} – ${fmtD(rec.toDate)}`;
    if (!window.confirm(
      `Delete & Reverse — ${label}?\n\n` +
      `This will:\n` +
      `• Cancel all pending FarmerPayments for this period\n` +
      `• Delete this register log\n` +
      `• Go to Payment Register Detailed for the same dates\n\n` +
      `Payments already applied via Bank Transfer will NOT be reversed.`
    )) return;

    doReverse(rec);
  };

  const doReverse = async (rec) => {
    setReversingId(rec._id);
    try {
      const res = await paymentRegisterAPI.reverse(rec._id);
      if (res?.success) {
        notifications.show({
          title:   'Reversed',
          message: res.message || 'Register reversed. Redirecting to Detailed Ledger…',
          color:   'orange',
          icon:    <IconArrowBackUp size={14} />,
          autoClose: 3000,
        });
        // Remove from local list
        setAllRecords(prev => prev.filter(r => r._id !== rec._id));
        // Navigate to Payment Register Detailed with the same dates pre-filled
        const from = dayjs(res.data?.fromDate || rec.fromDate).format('YYYY-MM-DD');
        const to   = dayjs(res.data?.toDate   || rec.toDate).format('YYYY-MM-DD');
        setTimeout(() => {
          navigate(`/payments/register-ledger?from=${from}&to=${to}`);
        }, 1200);
      } else {
        notifications.show({ title: 'Error', message: res?.message || 'Reverse failed', color: 'red' });
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setReversingId(null);
    }
  };

  return (
    <Container fluid p="md" style={{ background: '#f0f2f5', minHeight: '100vh' }}>
      <style>{PRINT_STYLE}</style>

      {/* ── header ── */}
      <Paper withBorder shadow="sm" p="md" mb="md">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Title order={4} style={{ color: '#1a365d' }}>Ledger Payment History</Title>

          <Group gap="sm" align="flex-end" wrap="wrap">
            {/* cycle preset buttons */}
            <Box>
              <Text size="xs" c="dimmed" mb={4}>Cycle</Text>
              <Group gap={4}>
                {CYCLES.map(d => (
                  <Button
                    key={d}
                    size="xs"
                    variant={activeCycle === d ? 'filled' : 'outline'}
                    color="blue"
                    onClick={() => applyCycle(d)}
                  >
                    {d}D
                  </Button>
                ))}
              </Group>
            </Box>

            <DateInput
              label="From"
              value={fromDate}
              onChange={v => { setFromDate(v); setActiveCycle(null); }}
              leftSection={<IconCalendar size={14} />}
              size="xs"
              w={140}
            />
            <DateInput
              label="To"
              value={toDate}
              onChange={v => { setToDate(v); setActiveCycle(null); }}
              leftSection={<IconCalendar size={14} />}
              size="xs"
              w={140}
            />
            <Button
              size="xs"
              leftSection={<IconRefresh size={14} />}
              onClick={fetchAll}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              size="xs"
              variant="outline"
              color="blue"
              leftSection={<IconPrinter size={14} />}
              onClick={handlePrintAll}
              disabled={records.length === 0}
              className="no-print"
            >
              Print All
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* ── content ── */}
      {loading ? (
        <Group justify="center" mt="xl"><Loader /></Group>
      ) : records.length === 0 ? (
        <Paper withBorder p="xl" ta="center">
          <Text c="dimmed">No records found for {dayjs(fromDate).format('DD/MM/YYYY')} — {dayjs(toDate).format('DD/MM/YYYY')}</Text>
        </Paper>
      ) : (
        <>
          <Text size="sm" c="dimmed" mb="sm">
            {records.length} cycle{records.length > 1 ? 's' : ''} — {dayjs(fromDate).format('DD/MM/YYYY')} to {dayjs(toDate).format('DD/MM/YYYY')}
          </Text>

          {records.map(rec => (
            <CycleCard
              key={rec._id}
              rec={rec}
              companyName={undefined}
              onEdit={openEdit}
              onReverse={handleReverse}
              reversing={reversingId === rec._id}
            />
          ))}

          {/* ── hidden print-all area ── */}
          <div ref={printAllRef} className="lph-print-area" style={{ display: 'none' }}>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Dairy Cooperative Society</div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>LEDGER PAYMENT HISTORY</div>
              <div style={{ fontSize: 11 }}>
                {dayjs(fromDate).format('DD/MM/YYYY')} — {dayjs(toDate).format('DD/MM/YYYY')}
              </div>
            </div>
            {records.map((rec) => {
              const entries = rec.entries || [];
              const totalNet  = entries.reduce((s,e)=>s+(parseFloat(e.netPay)||0),0);
              const totalPaid = entries.reduce((s,e)=>s+(parseFloat(e.paidAmount)||0),0);
              return (
                <div key={rec._id} style={{ marginBottom: 20, pageBreakInside: 'avoid' }}>
                  <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, background: '#ebf8ff', padding: '4px 8px' }}>
                    Period: {fmtD(rec.fromDate)} — {fmtD(rec.toDate)} &nbsp;|&nbsp;
                    {entries.length} Farmers &nbsp;|&nbsp; Net: ₹{fmt(totalNet)} &nbsp;|&nbsp; Paid: ₹{fmt(totalPaid)}
                  </div>
                  <CycleTable entries={entries} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Edit remarks modal ── */}
      <Modal
        opened={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit — ${editRec ? fmtD(editRec.fromDate) + ' – ' + fmtD(editRec.toDate) : ''}`}
        size="sm"
      >
        <TextInput
          label="Remarks"
          placeholder="Optional remarks for this cycle"
          value={editRemarks}
          onChange={e => setEditRemarks(e.currentTarget.value)}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" size="sm" onClick={() => setEditModal(false)}>Cancel</Button>
          <Button size="sm" color="teal" loading={editSaving} onClick={saveEdit}>
            Save
          </Button>
        </Group>
      </Modal>
    </Container>
  );
};

export default LedgerPaymentHistory;
