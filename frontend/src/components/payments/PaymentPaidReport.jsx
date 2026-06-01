/**
 * Payment Paid Report — Producer-wise summary
 * Shows amounts paid via Bank Transfer, Pay to Producer (Cash), and Individual Payment
 * for the selected cycle.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Group, Text, Select, Button, Badge, Loader,
  ScrollArea, Center, Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCashBanknote, IconSearch, IconPrinter, IconX, IconArrowLeft,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { paymentRegisterAPI, producerPaymentAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';

const fmt  = (v) => (parseFloat(v) || 0).toFixed(2);
const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const TH = ({ children, right }) => (
  <th style={{
    fontSize: 9, fontWeight: 800, background: '#14532d', color: '#fff',
    padding: '6px 8px', textAlign: right ? 'right' : 'center',
    border: '1px solid #166534', whiteSpace: 'nowrap',
  }}>{children}</th>
);
const TD = ({ children, right, bold, c, bg }) => (
  <td style={{
    fontSize: 11, padding: '5px 7px', border: '1px solid #e2e8f0',
    textAlign: right ? 'right' : 'center', verticalAlign: 'middle',
    fontWeight: bold ? 700 : 400, color: c || undefined,
    background: bg || undefined,
  }}>{children}</td>
);

const PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    .ppr-print-area, .ppr-print-area * { visibility: visible !important; }
    .ppr-print-area { position: fixed; inset: 0; padding: 10px; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; font-size: 8px; padding: 3px 4px; }
    th { background: #14532d !important; color: #fff !important;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .tot-row td { background: #dcfce7 !important; font-weight: 700;
                  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 6mm; }
  }
`;

export default function PaymentPaidReport() {
  const navigate = useNavigate();
  const printRef = useRef();

  const [cycles,     setCycles]     = useState([]);
  const [selCycle,   setSelCycle]   = useState(null);
  const [rows,       setRows]       = useState([]);
  const [generated,  setGenerated]  = useState(false);
  const [generating, setGenerating] = useState(false);
  const [cycleLabel, setCycleLabel] = useState('');
  const [fromDate,   setFromDate]   = useState('');
  const [toDate,     setToDate]     = useState('');

  useEffect(() => {
    producerPaymentAPI.getCycles().then(res => {
      const list = (res?.data || []).map(c => ({
        value: `${localDateStr(new Date(c.fromDate))}|${localDateStr(new Date(c.toDate))}`,
        label: c.label,
        fromDate: c.fromDate,
        toDate:   c.toDate,
      }));
      setCycles(list);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selCycle) { notifications.show({ color: 'orange', message: 'Select a cycle first' }); return; }
    const [fd, td] = selCycle.split('|');
    const cycleObj = cycles.find(c => c.value === selCycle);
    setGenerating(true);
    try {
      const res = await paymentRegisterAPI.getPaidReport({ fromDate: fd, toDate: td });
      setRows(res?.data?.rows || []);
      setFromDate(fd);
      setToDate(td);
      setCycleLabel(cycleObj?.label || `${fmtD(fd)} — ${fmtD(td)}`);
      setGenerated(true);
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to generate report' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `PaymentPaidReport_${fromDate}_${toDate}`,
  });

  const handleCancel = () => { setRows([]); setSelCycle(null); setGenerated(false); };

  // Totals
  const totals = rows.reduce((a, r) => ({
    netPayable:    a.netPayable    + (parseFloat(r.netPayable)    || 0),
    bankTransfer:  a.bankTransfer  + (parseFloat(r.bankTransfer)  || 0),
    payToProducer: a.payToProducer + (parseFloat(r.payToProducer) || 0),
    individual:    a.individual    + (parseFloat(r.individual)    || 0),
    totalPaid:     a.totalPaid     + (parseFloat(r.totalPaid)     || 0),
    balance:       a.balance       + (parseFloat(r.balance)       || 0),
  }), { netPayable:0, bankTransfer:0, payToProducer:0, individual:0, totalPaid:0, balance:0 });

  const paidCount = rows.filter(r => (parseFloat(r.totalPaid) || 0) > 0).length;

  return (
    <Box style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>
      <style>{PRINT_STYLE}</style>

      {/* ── HEADER ── */}
      <Box style={{ background: 'white', borderBottom: '1px solid #dbeafe', padding: '8px 20px', flexShrink: 0, boxShadow: '0 1px 6px rgba(37,99,235,0.08)' }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap={12} align="center" wrap="nowrap">
            <Box style={{ background: '#dcfce7', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center' }}>
              <IconCashBanknote size={22} color="#16a34a" />
            </Box>
            <Box>
              <Text size="16px" fw={800} c="#14532d" style={{ lineHeight: 1.1 }}>Payment Paid Report</Text>
              <Text size="10px" c="#64748b">Producer-wise payment summary by source</Text>
            </Box>

            <Box style={{ width: 1, height: 36, background: '#dbeafe' }} />

            <Box style={{ minWidth: 260 }}>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3} style={{ letterSpacing: '0.4px' }}>Cycle</Text>
              <Select
                data={cycles}
                value={selCycle}
                onChange={setSelCycle}
                placeholder="Select payment cycle..."
                searchable clearable size="xs" radius="md"
                style={{ width: 260 }}
                styles={{ input: { fontWeight: 700, border: '1.5px solid #bbf7d0', height: 28, fontSize: 12 } }}
              />
            </Box>

            <Button
              leftSection={generating ? <Loader size={12} color="white" /> : <IconSearch size={14} />}
              onClick={handleGenerate}
              disabled={generating || !selCycle}
              size="sm" radius="md"
              style={{ background: '#16a34a', fontWeight: 700 }}
            >
              Generate
            </Button>
          </Group>

          <Group gap={8} className="no-print">
            {generated && (
              <Button leftSection={<IconPrinter size={14} />} onClick={handlePrint} size="sm" radius="md"
                style={{ background: '#0369a1', fontWeight: 700 }}>
                Print
              </Button>
            )}
            <Button leftSection={<IconX size={14} />} onClick={handleCancel} size="sm" radius="md" variant="default"
              style={{ fontWeight: 700 }}>
              Cancel
            </Button>
            <Button leftSection={<IconArrowLeft size={14} />} onClick={() => navigate(-1)} size="sm" radius="md" variant="default"
              style={{ fontWeight: 700 }}>
              Close
            </Button>
          </Group>
        </Group>
      </Box>

      {/* ── CONTENT ── */}
      <Box style={{ flex: 1, overflow: 'hidden', padding: '12px 20px', display: 'flex', flexDirection: 'column' }}>

        {!generated && !generating && (
          <Center style={{ flex: 1 }}>
            <Stack align="center" gap={8}>
              <IconCashBanknote size={56} color="#bbf7d0" />
              <Text c="dimmed" fw={600}>Select a cycle and click Generate</Text>
              <Text c="dimmed" size="xs">Shows Bank Transfer, Pay to Producer, and Individual payment amounts per producer</Text>
            </Stack>
          </Center>
        )}

        {generating && <Center style={{ flex: 1 }}><Loader size="md" color="green" /></Center>}

        {generated && !generating && (
          <>
            {/* summary bar */}
            <Box style={{ background: '#14532d', borderRadius: '10px 10px 0 0', padding: '8px 16px' }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={12}>
                  <Text fw={700} size="13px" c="white">Payment Paid Report</Text>
                  <Text size="12px" c="#86efac" fw={600}>{cycleLabel}</Text>
                </Group>
                <Group gap={20}>
                  {[
                    { label: 'Producers', val: rows.length,           c: '#7dd3fc' },
                    { label: 'Paid',      val: paidCount,             c: '#86efac' },
                    { label: 'Net Payable',val: `₹${fmt(totals.netPayable)}`, c: '#fde68a' },
                    { label: 'Total Paid', val: `₹${fmt(totals.totalPaid)}`,  c: '#a7f3d0' },
                    { label: 'Balance',    val: `₹${fmt(totals.balance)}`,    c: '#fca5a5' },
                  ].map(({ label, val, c }) => (
                    <Box key={label} style={{ textAlign: 'center' }}>
                      <Text size="9px" c="rgba(255,255,255,0.6)" tt="uppercase">{label}</Text>
                      <Text size="13px" fw={800} c={c}>{val}</Text>
                    </Box>
                  ))}
                </Group>
              </Group>
            </Box>

            <Box style={{ flex: 1, overflow: 'hidden', background: 'white', borderRadius: '0 0 10px 10px', border: '1px solid #bbf7d0', borderTop: 'none' }}>
              <div ref={printRef} className="ppr-print-area">
                <ScrollArea h="100%" type="auto">
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                    <thead>
                      <tr>
                        <TH>SN</TH>
                        <TH>Producer No</TH>
                        <TH>Producer Name</TH>
                        <TH>Center</TH>
                        <TH right>Net Payable (₹)</TH>
                        <TH right>Bank Transfer (₹)</TH>
                        <TH right>Pay to Producer (₹)</TH>
                        <TH right>Individual Pay (₹)</TH>
                        <TH right>Total Paid (₹)</TH>
                        <TH right>Balance (₹)</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#64748b', fontSize: 12 }}>
                            No payment data found for this cycle
                          </td>
                        </tr>
                      ) : rows.map((r, i) => {
                        const hasPaid = (parseFloat(r.totalPaid) || 0) > 0;
                        const bal     = parseFloat(r.balance) || 0;
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f0fdf4' }}>
                            <TD>{r.slNo || i+1}</TD>
                            <TD>{r.producerId || '—'}</TD>
                            <TD>{r.producerName || '—'}</TD>
                            <TD>{r.center || '—'}</TD>
                            <TD right>{fmt(r.netPayable)}</TD>
                            <TD right bold={r.bankTransfer > 0} c={r.bankTransfer > 0 ? '#1d4ed8' : undefined}>
                              {r.bankTransfer > 0 ? fmt(r.bankTransfer) : '—'}
                            </TD>
                            <TD right bold={r.payToProducer > 0} c={r.payToProducer > 0 ? '#0369a1' : undefined}>
                              {r.payToProducer > 0 ? fmt(r.payToProducer) : '—'}
                            </TD>
                            <TD right bold={r.individual > 0} c={r.individual > 0 ? '#6d28d9' : undefined}>
                              {r.individual > 0 ? fmt(r.individual) : '—'}
                            </TD>
                            <TD right bold c={hasPaid ? '#166534' : '#94a3b8'}>
                              {hasPaid ? fmt(r.totalPaid) : '—'}
                            </TD>
                            <TD right bold c={bal > 0 ? '#b91c1c' : bal < 0 ? '#1d4ed8' : '#94a3b8'}
                              bg={bal > 0 ? '#fef2f2' : bal < 0 ? '#eff6ff' : undefined}>
                              {bal !== 0 ? fmt(bal) : '—'}
                            </TD>
                          </tr>
                        );
                      })}
                    </tbody>
                    {rows.length > 0 && (
                      <tfoot>
                        <tr className="tot-row" style={{ background: '#dcfce7' }}>
                          <td colSpan={4} style={{ padding:'6px 8px', fontWeight:700, color:'#14532d', border:'1px solid #86efac', textAlign:'right', fontSize:11 }}>
                            TOTAL ({rows.length} producers)
                          </td>
                          <TD right bold c="#14532d">{fmt(totals.netPayable)}</TD>
                          <TD right bold c="#1d4ed8">{fmt(totals.bankTransfer)}</TD>
                          <TD right bold c="#0369a1">{fmt(totals.payToProducer)}</TD>
                          <TD right bold c="#6d28d9">{fmt(totals.individual)}</TD>
                          <TD right bold c="#166534">{fmt(totals.totalPaid)}</TD>
                          <TD right bold c={totals.balance > 0 ? '#b91c1c' : '#1d4ed8'}>{fmt(totals.balance)}</TD>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </ScrollArea>
              </div>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
