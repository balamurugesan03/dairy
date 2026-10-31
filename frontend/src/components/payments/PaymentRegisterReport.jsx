/**
 * Payment Register Report
 * Select Cycle → Generate → Print / Cancel / Close
 * Shows the saved Ledger-type PaymentRegister for the chosen cycle.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Group, Text, Select, Button, Badge, Loader,
  ScrollArea, Table, Center, Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconReportMoney, IconSearch, IconPrinter, IconX, IconArrowLeft,
} from '@tabler/icons-react';
import { paymentRegisterAPI, producerPaymentAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import { useCompany } from '../../context/CompanyContext';
import { openA4Print, a4Header, a4Signatures, escapeHtml } from '../../utils/printA4';

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

// ── A4 LANDSCAPE print, built from the data (the screen table sits in a scroll
// area, which used to clip the printout). [heading, width %, value, total key]
const num = (k) => (e) => parseFloat(e[k]) || 0;
const PRINT_COLS = {
  Ledger: [
    ['SN', 3, (e, i) => e.slNo || i + 1], ['ID', 4.5, (e) => e.producerId || e.productId || ''],
    ['Name', 13, (e) => e.producerName || e.productName || ''],
    ['Qty', 5, num('qty'), 'qty'], ['Milk Val', 6, num('milkValue'), 'milk'], ['Prev Bal', 5.5, num('previousBalance'), 'prev'],
    ['Other Earn', 5, num('otherEarnings'), 'otherEarn'], ['Total Earn', 6, num('totalEarnings'), 'earn'],
    ['Welfare', 4.5, num('welfare'), 'welfare'], ['CF Adv', 4.5, num('cfAdv'), 'cfAdv'], ['CF Rec', 4.5, num('cfRec'), 'cfRec'],
    ['Cash Adv', 4.5, num('cashAdv'), 'cashAdv'], ['Cash Rec', 4.5, num('cashRec'), 'cashRec'],
    ['Loan Adv', 4.5, num('loanAdv'), 'loanAdv'], ['Loan Rec', 4.5, num('loanRec'), 'loanRec'],
    ['Other Ded', 4.5, num('otherDed'), 'other'], ['Total Ded', 5, num('totalDed'), 'ded'],
    ['Net Pay', 6, num('netPay'), 'net'], ['Paid Amt', 6, num('paidAmount'), 'paid'],
  ],
  Producers: [
    ['SN', 3.5, (e, i) => e.slNo || i + 1], ['ID', 5.5, (e) => e.producerId || e.productId || ''],
    ['Name', 18, (e) => e.producerName || e.productName || ''], ['Center', 11, (e) => e.center || ''],
    ['Qty', 6.5, num('qty'), 'qty'], ['Milk Val', 7.5, num('milkValue'), 'milk'], ['Prev Bal', 7, num('previousBalance'), 'prev'],
    ['Welfare', 6, num('welfare'), 'welfare'], ['CF Rec', 6, num('cfRec'), 'cfRec'], ['Loan Adv', 6, num('loanAdv'), 'loanAdv'],
    ['Cash Pocket', 6.5, num('cashPocket'), 'cashPocket'], ['Net Pay', 8, num('netPay'), 'net'], ['Paid Amt', 8.5, num('paidAmount'), 'paid'],
  ],
};
const PRINT_CSS = `
  @page { size: A4 landscape; margin: 8mm 7mm; }
  body { font-size: 9.5px; }
  .a4-header__org { font-size: 16px; }
  .a4-header__title { font-size: 12.5px; }
  .a4-header__meta { font-size: 10px; }
  table.a4 th { font-size: 8.5px; text-transform: none; line-height: 1.15; }
  table.a4 td { font-size: 9.5px; padding: 2.5px 3px; vertical-align: middle; }
`;
const pAmt = (v) => (v ? fmt(v) : '');

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PaymentRegisterReport() {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const societyName = selectedCompany?.societyName || selectedCompany?.companyName || 'Dairy Society';

  const [cycles,     setCycles]     = useState([]);     // available cycles
  const [selCycle,   setSelCycle]   = useState(null);   // selected cycle key "fromDate|toDate"
  const [register,   setRegister]   = useState(null);   // loaded register
  const [loading,    setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load cycle list on mount
  useEffect(() => {
    producerPaymentAPI.getCycles().then(res => {
      const list = (res?.data || []).map(c => ({
        value: `${localDateStr(new Date(c.fromDate))}|${localDateStr(new Date(c.toDate))}`,
        label: c.label,
        fromDate: c.fromDate,
        toDate:   c.toDate,
      }));
      setCycles(list);
      // Latest cycle (newest first from the API) is selected by default
      if (list.length) setSelCycle(prev => prev || list[0].value);
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

  const handlePrint = () => {
    if (!register) return;
    const cols = PRINT_COLS[register.registerType === 'Ledger' ? 'Ledger' : 'Producers'];
    const entries = register.entries || [];
    const totals = {};
    const isAmt = (c) => !!c[3];
    const body = entries.map((e, i) => `<tr>${cols.map(c => {
      const v = c[2](e, i);
      if (isAmt(c)) totals[c[3]] = (totals[c[3]] || 0) + v;
      return isAmt(c) ? `<td class="amt${c[3] === 'net' || c[3] === 'paid' ? ' b' : ''}">${pAmt(v)}</td>`
        : `<td${c[0] === 'Name' || c[0] === 'Center' ? '' : ' class="ctr"'}>${escapeHtml(v)}</td>`;
    }).join('')}</tr>`).join('');
    const labelCols = cols.filter(c => !isAmt(c)).length;
    const totalRow = `<tr class="row-grand"><td colspan="${labelCols}" class="amt">TOTAL (${entries.length} producers)</td>${
      cols.filter(isAmt).map(c => `<td class="amt">${fmt(totals[c[3]] || 0)}</td>`).join('')}</tr>`;
    openA4Print({
      title: `Payment Register ${cycleInfo}`,
      orientation: 'landscape',
      css: PRINT_CSS,
      bodyHtml: a4Header({ orgName: societyName, title: 'Payment Register', period: cycleInfo,
          extra: `${escapeHtml(register.registerType)} · ${entries.length} producers` })
        + `<table class="a4"><colgroup>${cols.map(c => `<col style="width:${c[1]}%">`).join('')}</colgroup>
          <thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead>
          <tbody>${body}${totalRow}</tbody></table>`
        + a4Signatures(['Secretary', 'President'], new Date().toLocaleString('en-IN')),
    });
  };

  const handleCancel = () => { setRegister(null); setSelCycle(null); };

  const cycleInfo = register ? `${fmtD(register.fromDate)}  —  ${fmtD(register.toDate)}` : '';
  const entryCount = register?.entries?.length || 0;
  const totalNet   = (register?.entries || []).reduce((s, e) => s + (parseFloat(e.netPay) || 0), 0);
  const totalPaid  = (register?.entries || []).reduce((s, e) => s + (parseFloat(e.paidAmount) || 0), 0);

  return (
    <Box style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>

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
              <div style={{ height: '100%' }}>
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

