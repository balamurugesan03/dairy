/**
 * Payment Register Report
 * Select Cycle → Generate → Print / Cancel / Close
 * Shows the saved Ledger-type PaymentRegister for the chosen cycle.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Group, Text, Select, Button, Badge, Loader,
  ScrollArea, Table, Center, Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconReportMoney, IconSearch, IconPrinter, IconX, IconArrowLeft,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { paymentRegisterAPI, producerPaymentAPI } from '../../services/api';

const fmt   = (v) => (parseFloat(v) || 0).toFixed(2);
const fmtD  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

// ── shared cell styles ────────────────────────────────────────────────────────
const TH = ({ children, right }) => (
  <th style={{
    fontSize: 9, fontWeight: 800, background: '#1a365d', color: '#fff',
    padding: '6px 7px', textAlign: right ? 'right' : 'center',
    border: '1px solid #2d4a7a', whiteSpace: 'nowrap',
  }}>{children}</th>
);
const TD = ({ children, right, bold, c }) => (
  <td style={{
    fontSize: 11, padding: '4px 6px', border: '1px solid #e2e8f0',
    textAlign: right ? 'right' : 'center', verticalAlign: 'middle',
    fontWeight: bold ? 700 : 400, color: c || undefined,
  }}>{children}</td>
);

// ── printable table ───────────────────────────────────────────────────────────
const RegisterTable = ({ reg }) => {
  const entries = reg?.entries || [];
  const isLedger = reg?.registerType === 'Ledger';

  const totals = entries.reduce((a, e) => ({
    qty:    a.qty    + (parseFloat(e.qty)             || 0),
    milk:   a.milk   + (parseFloat(e.milkValue)       || 0),
    prev:   a.prev   + (parseFloat(e.previousBalance) || 0),
    earn:   a.earn   + (parseFloat(e.totalEarnings)   || 0),
    ded:    a.ded    + (parseFloat(e.totalDed)        || 0),
    net:    a.net    + (parseFloat(e.netPay)          || 0),
    paid:   a.paid   + (parseFloat(e.paidAmount)      || 0),
    cfAdv:  a.cfAdv  + (parseFloat(e.cfAdv)           || 0),
    cfRec:  a.cfRec  + (parseFloat(e.cfRec)           || 0),
    cashAdv:a.cashAdv+ (parseFloat(e.cashAdv)         || 0),
    cashRec:a.cashRec+ (parseFloat(e.cashRec)         || 0),
    loanAdv:a.loanAdv+ (parseFloat(e.loanAdv)         || 0),
    loanRec:a.loanRec+ (parseFloat(e.loanRec)         || 0),
    other:  a.other  + (parseFloat(e.otherDed)        || 0),
  }), { qty:0, milk:0, prev:0, earn:0, ded:0, net:0, paid:0, cfAdv:0, cfRec:0, cashAdv:0, cashRec:0, loanAdv:0, loanRec:0, other:0 });

  if (isLedger) {
    return (
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1200 }}>
        <thead>
          <tr>
            <TH>SN</TH><TH>ID</TH><TH>Name</TH><TH>Qty</TH><TH right>Milk Val</TH>
            <TH right>Prev Bal</TH><TH right>Other Earn</TH><TH right>Total Earn</TH>
            <TH right>Welfare</TH><TH right>CF Adv</TH><TH right>CF Rec</TH>
            <TH right>Cash Adv</TH><TH right>Cash Rec</TH>
            <TH right>Loan Adv</TH><TH right>Loan Rec</TH>
            <TH right>Other Ded</TH><TH right>Total Ded</TH>
            <TH right>Net Pay</TH><TH right>Paid Amt</TH>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7fafc' }}>
              <TD>{e.slNo || i+1}</TD>
              <TD>{e.producerId || e.productId || '—'}</TD>
              <TD>{e.producerName || e.productName || '—'}</TD>
              <TD right>{fmt(e.qty)}</TD>
              <TD right>{fmt(e.milkValue)}</TD>
              <TD right>{fmt(e.previousBalance)}</TD>
              <TD right>{fmt(e.otherEarnings)}</TD>
              <TD right>{fmt(e.totalEarnings)}</TD>
              <TD right>{fmt(e.welfare)}</TD>
              <TD right>{fmt(e.cfAdv)}</TD>
              <TD right>{fmt(e.cfRec)}</TD>
              <TD right>{fmt(e.cashAdv)}</TD>
              <TD right>{fmt(e.cashRec)}</TD>
              <TD right>{fmt(e.loanAdv)}</TD>
              <TD right>{fmt(e.loanRec)}</TD>
              <TD right>{fmt(e.otherDed)}</TD>
              <TD right>{fmt(e.totalDed)}</TD>
              <TD right bold c="#276749">{fmt(e.netPay)}</TD>
              <TD right bold c="#2b6cb0">{fmt(e.paidAmount)}</TD>
            </tr>
          ))}
          <tr style={{ background: '#ebf8ff', fontWeight: 700 }}>
            <td colSpan={3} style={{ padding:'5px 6px', border:'1px solid #bee3f8', textAlign:'right', fontWeight:700 }}>TOTAL</td>
            <TD right bold>{totals.qty.toFixed(2)}</TD>
            <TD right bold>{fmt(totals.milk)}</TD>
            <TD right bold>{fmt(totals.prev)}</TD>
            <TD right bold>—</TD>
            <TD right bold>{fmt(totals.earn)}</TD>
            <TD right bold>—</TD>
            <TD right bold>{fmt(totals.cfAdv)}</TD>
            <TD right bold>{fmt(totals.cfRec)}</TD>
            <TD right bold>{fmt(totals.cashAdv)}</TD>
            <TD right bold>{fmt(totals.cashRec)}</TD>
            <TD right bold>{fmt(totals.loanAdv)}</TD>
            <TD right bold>{fmt(totals.loanRec)}</TD>
            <TD right bold>{fmt(totals.other)}</TD>
            <TD right bold>{fmt(totals.ded)}</TD>
            <TD right bold c="#276749">{fmt(totals.net)}</TD>
            <TD right bold c="#2b6cb0">{fmt(totals.paid)}</TD>
          </tr>
        </tbody>
      </table>
    );
  }

  // Producers type
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
      <thead>
        <tr>
          <TH>SN</TH><TH>ID</TH><TH>Name</TH><TH>Center</TH>
          <TH right>Qty</TH><TH right>Milk Val</TH>
          <TH right>Prev Bal</TH><TH right>Welfare</TH>
          <TH right>CF Rec</TH><TH right>Loan Adv</TH><TH right>Cash Pocket</TH>
          <TH right>Net Pay</TH><TH right>Paid Amt</TH>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7fafc' }}>
            <TD>{e.slNo || i+1}</TD>
            <TD>{e.producerId || e.productId || '—'}</TD>
            <TD>{e.producerName || e.productName || '—'}</TD>
            <TD>{e.center || '—'}</TD>
            <TD right>{fmt(e.qty)}</TD>
            <TD right>{fmt(e.milkValue)}</TD>
            <TD right>{fmt(e.previousBalance)}</TD>
            <TD right>{fmt(e.welfare)}</TD>
            <TD right>{fmt(e.cfRec)}</TD>
            <TD right>{fmt(e.loanAdv)}</TD>
            <TD right>{fmt(e.cashPocket)}</TD>
            <TD right bold c="#276749">{fmt(e.netPay)}</TD>
            <TD right bold c="#2b6cb0">{fmt(e.paidAmount)}</TD>
          </tr>
        ))}
        <tr style={{ background: '#ebf8ff', fontWeight: 700 }}>
          <td colSpan={4} style={{ padding:'5px 6px', border:'1px solid #bee3f8', textAlign:'right', fontWeight:700 }}>TOTAL</td>
          <TD right bold>{totals.qty.toFixed(2)}</TD>
          <TD right bold>{fmt(totals.milk)}</TD>
          <TD right bold>{fmt(totals.prev)}</TD>
          <TD right bold>—</TD>
          <TD right bold>—</TD>
          <TD right bold>—</TD>
          <TD right bold>—</TD>
          <TD right bold c="#276749">{fmt(totals.net)}</TD>
          <TD right bold c="#2b6cb0">{fmt(totals.paid)}</TD>
        </tr>
      </tbody>
    </table>
  );
};

// ── print styles ──────────────────────────────────────────────────────────────
const PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    .pr-print-area, .pr-print-area * { visibility: visible !important; }
    .pr-print-area { position: fixed; inset: 0; padding: 10px; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; font-size: 8px; padding: 3px 4px; }
    th { background: #1a365d !important; color: #fff !important;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 6mm; }
  }
`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PaymentRegisterReport() {
  const navigate = useNavigate();
  const printRef = useRef();

  const [cycles,     setCycles]     = useState([]);     // available cycles
  const [selCycle,   setSelCycle]   = useState(null);   // selected cycle key "fromDate|toDate"
  const [register,   setRegister]   = useState(null);   // loaded register
  const [loading,    setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load cycle list on mount
  useEffect(() => {
    producerPaymentAPI.getCycles().then(res => {
      const list = (res?.data || []).map(c => ({
        value: `${new Date(c.fromDate).toISOString().slice(0,10)}|${new Date(c.toDate).toISOString().slice(0,10)}`,
        label: c.label,
        fromDate: c.fromDate,
        toDate:   c.toDate,
      }));
      setCycles(list);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selCycle) { notifications.show({ color: 'orange', message: 'Select a cycle first' }); return; }
    const [fromDate, toDate] = selCycle.split('|');
    setGenerating(true);
    try {
      const res = await paymentRegisterAPI.getAll({ registerType: 'Ledger', fromDate, toDate, limit: 5 });
      const regs = res?.data || [];
      if (!regs.length) {
        // Try Producers type
        const res2 = await paymentRegisterAPI.getAll({ registerType: 'Producers', fromDate, toDate, limit: 5 });
        const regs2 = res2?.data || [];
        if (!regs2.length) {
          notifications.show({ color: 'yellow', message: 'No saved register found for this cycle' });
          setRegister(null);
          return;
        }
        // Fetch with entries
        const full = await paymentRegisterAPI.getById(regs2[0]._id);
        setRegister(full?.data || null);
      } else {
        const full = await paymentRegisterAPI.getById(regs[0]._id);
        setRegister(full?.data || null);
      }
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to load register' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: register ? `PaymentRegister_${fmtD(register.fromDate)}_${fmtD(register.toDate)}` : 'PaymentRegister',
  });

  const handleCancel = () => { setRegister(null); setSelCycle(null); };

  const cycleInfo = register ? `${fmtD(register.fromDate)}  —  ${fmtD(register.toDate)}` : '';
  const entryCount = register?.entries?.length || 0;
  const totalNet   = (register?.entries || []).reduce((s, e) => s + (parseFloat(e.netPay) || 0), 0);
  const totalPaid  = (register?.entries || []).reduce((s, e) => s + (parseFloat(e.paidAmount) || 0), 0);

  return (
    <Box style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>
      <style>{PRINT_STYLE}</style>

      {/* ── HEADER ── */}
      <Box style={{ background: 'white', borderBottom: '1px solid #dbeafe', padding: '8px 20px', flexShrink: 0, boxShadow: '0 1px 6px rgba(37,99,235,0.08)' }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap={12} align="center" wrap="nowrap">
            <Box style={{ background: '#dbeafe', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center' }}>
              <IconReportMoney size={22} color="#2563eb" />
            </Box>
            <Box>
              <Text size="16px" fw={800} c="#1e3a8a" style={{ lineHeight: 1.1 }}>Payment Register</Text>
              <Text size="10px" c="#64748b">Select cycle → Generate → Print</Text>
            </Box>

            <Box style={{ width: 1, height: 36, background: '#dbeafe' }} />

            {/* Cycle selector */}
            <Box style={{ minWidth: 260 }}>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3} style={{ letterSpacing: '0.4px' }}>Cycle</Text>
              <Select
                data={cycles}
                value={selCycle}
                onChange={setSelCycle}
                placeholder="Select payment cycle..."
                searchable clearable size="xs" radius="md"
                style={{ width: 260 }}
                styles={{ input: { fontWeight: 700, border: '1.5px solid #bfdbfe', height: 28, fontSize: 12 } }}
              />
            </Box>

            <Button
              leftSection={generating ? <Loader size={12} color="white" /> : <IconSearch size={14} />}
              onClick={handleGenerate}
              disabled={generating || !selCycle}
              size="sm" radius="md"
              style={{ background: '#2563eb', fontWeight: 700 }}
            >
              Generate
            </Button>
          </Group>

          <Group gap={8} className="no-print">
            {register && (
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

        {!register && !generating && (
          <Center style={{ flex: 1 }}>
            <Stack align="center" gap={8}>
              <IconReportMoney size={56} color="#bfdbfe" />
              <Text c="dimmed" fw={600}>Select a cycle and click Generate</Text>
            </Stack>
          </Center>
        )}

        {generating && <Center style={{ flex: 1 }}><Loader size="md" color="blue" /></Center>}

        {register && !generating && (
          <>
            {/* summary bar */}
            <Box style={{ background: '#1e3a8a', borderRadius: '10px 10px 0 0', padding: '8px 16px' }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={12}>
                  <Text fw={700} size="13px" c="white">Payment Register</Text>
                  <Badge size="sm" color="blue" variant="filled">{register.registerType}</Badge>
                  <Badge size="sm" color="teal" variant="filled">{register.status}</Badge>
                  <Text size="12px" c="#93c5fd" fw={600}>{cycleInfo}</Text>
                </Group>
                <Group gap={16}>
                  <Box style={{ textAlign: 'center' }}>
                    <Text size="9px" c="rgba(255,255,255,0.6)" tt="uppercase">Farmers</Text>
                    <Text size="14px" fw={800} c="#7dd3fc">{entryCount}</Text>
                  </Box>
                  <Box style={{ textAlign: 'center' }}>
                    <Text size="9px" c="rgba(255,255,255,0.6)" tt="uppercase">Net Payable</Text>
                    <Text size="14px" fw={800} c="#86efac">₹{fmt(totalNet)}</Text>
                  </Box>
                  <Box style={{ textAlign: 'center' }}>
                    <Text size="9px" c="rgba(255,255,255,0.6)" tt="uppercase">Total Paid</Text>
                    <Text size="14px" fw={800} c="#fde68a">₹{fmt(totalPaid)}</Text>
                  </Box>
                </Group>
              </Group>
            </Box>

            <Box style={{ flex: 1, overflow: 'hidden', background: 'white', borderRadius: '0 0 10px 10px', border: '1px solid #bfdbfe', borderTop: 'none' }}>
              <div ref={printRef} className="pr-print-area">
                {/* print header */}
                <Box style={{ display: 'none' }} className="print-header-only"
                  sx={{ '@media print': { display: 'block', textAlign: 'center', marginBottom: 8 } }}>
                  <Text fw={900} size="14px">PAYMENT REGISTER — {cycleInfo}</Text>
                </Box>

                <ScrollArea h="100%" type="auto">
                  <RegisterTable reg={register} />
                </ScrollArea>
              </div>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
