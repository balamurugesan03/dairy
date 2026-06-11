import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Group, Text, Button, Select, Paper, Container, Loader, Center, Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPrinter, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { milkBillAPI, farmerAPI, paymentRegisterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const f1  = (v) => (v == null || v === 0) ? '' : (+v).toFixed(1);
const f2  = (v) => (v == null || v === 0) ? '' : (+v).toFixed(2);
const fN  = (v) => (+(v || 0)).toFixed(2);
const fI  = (v) => (v == null || v === 0) ? '' : Math.round(+v);
const fD  = (d) => dayjs(d).format('DD/MM/YYYY');

/* ── Print-clean styles ─────────────────────────────────────────────────────── */
const FONT = "'Courier New', Courier, monospace";
const B    = '1px solid #555';
const BH   = '1.5px solid #000';
const BL   = '1px solid #bbb';
const FS   = 9;

const thSec = (extra = {}) => ({
  background:    '#ddd',
  color:         '#000',
  fontWeight:    700,
  fontSize:      FS + 0.5,
  textAlign:     'center',
  border:        BH,
  padding:       '3px 2px',
  letterSpacing: 0.6,
  fontFamily:    FONT,
  ...extra,
});

const thCol = (extra = {}) => ({
  background:  '#eee',
  color:       '#000',
  fontWeight:  700,
  fontSize:    FS,
  textAlign:   'center',
  border:      B,
  padding:     '2px 2px',
  whiteSpace:  'nowrap',
  fontFamily:  FONT,
  ...extra,
});

const td = (extra = {}) => ({
  border:        BL,
  padding:       '1px 3px',
  fontSize:      FS,
  fontFamily:    FONT,
  textAlign:     'right',
  verticalAlign: 'middle',
  height:        16,
  lineHeight:    '16px',
  ...extra,
});

const tdDay = { ...td(), textAlign: 'center', fontWeight: 600, background: '#f5f5f5', border: B, width: 32 };
const tdTot = { ...td(), fontWeight: 700, background: '#ddd', border: BH, fontSize: FS + 0.5 };

const sumLbl = (bold) => ({
  fontFamily: FONT, fontSize: FS + 0.5, fontWeight: bold ? 700 : 400,
  color: '#000', padding: '2px 4px 2px 0', textAlign: 'left', whiteSpace: 'nowrap',
});
const sumVal = (bold) => ({
  fontFamily: FONT, fontSize: FS + 0.5, fontWeight: bold ? 700 : 400,
  color: '#000', padding: '2px 0 2px 8px', textAlign: 'right', whiteSpace: 'nowrap', minWidth: 80,
});

const PRINT_CSS = `
  @media print {
    body * { visibility: hidden !important; }
    #milk-bill-print, #milk-bill-print * { visibility: visible !important; }
    #milk-bill-print { position: fixed; inset: 0; padding: 5mm; background: #fff !important; }
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 6mm; }
    table { border-collapse: collapse !important; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
const MilkBillReport = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef();

  const [farmers,    setFarmers]    = useState([]);
  const [cycles,     setCycles]     = useState([]);
  const [farmerId,   setFarmerId]   = useState(null);
  const [cycleId,    setCycleId]    = useState(null);
  const [loadingF,   setLoadingF]   = useState(false);
  const [loadingC,   setLoadingC]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [billData,   setBillData]   = useState(null);
  const [error,      setError]      = useState('');

  /* ── Load farmers ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setLoadingF(true);
      try {
        const res = await farmerAPI.getAll({ status: 'Active', limit: 2000 });
        const list = res.data || [];
        setFarmers(list.map((f) => ({
          value: f._id,
          label: `${f.farmerNumber} — ${f.personalDetails?.name || ''}`,
          farmerNumber: f.farmerNumber,
        })));
      } catch {
        notifications.show({ title: 'Error', message: 'Could not load farmers', color: 'red' });
      } finally {
        setLoadingF(false);
      }
    };
    load();
  }, []);

  /* ── Load saved Producers cycles ─────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setLoadingC(true);
      try {
        // Load both Saved and Printed cycles
        const [savedRes, printedRes] = await Promise.all([
          paymentRegisterAPI.getAll({ registerType: 'Producers', status: 'Saved',   limit: 200 }),
          paymentRegisterAPI.getAll({ registerType: 'Producers', status: 'Printed', limit: 200 }),
        ]);
        const res = { data: [...(savedRes.data || []), ...(printedRes.data || [])] };
        res.data.sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));
        const list = res.data || [];
        setCycles(
          list.map((c) => ({
            value: c._id,
            label: `${fD(c.fromDate)} – ${fD(c.toDate)}`,
            fromDate: c.fromDate,
            toDate:   c.toDate,
          }))
        );
      } catch {
        notifications.show({ title: 'Error', message: 'Could not load cycles', color: 'red' });
      } finally {
        setLoadingC(false);
      }
    };
    load();
  }, []);

  /* ── Selected cycle object ───────────────────────────────────────────────── */
  const selectedCycle = useMemo(
    () => cycles.find((c) => c.value === cycleId) || null,
    [cycles, cycleId]
  );

  /* ── Fetch bill ──────────────────────────────────────────────────────────── */
  const handleFetch = useCallback(async () => {
    if (!farmerId) {
      notifications.show({ title: 'Select producer', message: 'Choose a producer first', color: 'orange' });
      return;
    }
    if (!selectedCycle) {
      notifications.show({ title: 'Select cycle', message: 'Choose a payment cycle', color: 'orange' });
      return;
    }
    setLoading(true);
    setError('');
    setBillData(null);
    try {
      const res = await milkBillAPI.getByCycle(farmerId, {
        fromDate: selectedCycle.fromDate,
        toDate:   selectedCycle.toDate,
      });
      if (!res.success) throw new Error(res.message || 'Failed');
      setBillData(res);
    } catch (e) {
      setError(e.message || 'Failed to load milk bill');
    } finally {
      setLoading(false);
    }
  }, [farmerId, selectedCycle]);

  /* ── Print ────────────────────────────────────────────────────────────────── */
  const handlePrint = useReactToPrint({
    content:       () => printRef.current,
    documentTitle: billData
      ? `MilkBill_${billData.farmer.number}_${fD(selectedCycle?.fromDate)}`
      : 'MilkBill',
  });

  const societyName = selectedCompany?.companyName?.toUpperCase() || 'DAIRY COOPERATIVE SOCIETY';

  /* ─────────────────────────────────────────────────────────────────────────
     Derived data from billData
  ───────────────────────────────────────────────────────────────────────── */
  const { days = [], cattleFeedRows = [], deductionRows = [], paymentRows = [], summary = {}, farmer = {} } = billData || {};

  // Group cattle feed by date for inline display in milk table
  const cattleByDate = useMemo(() => {
    const m = {};
    cattleFeedRows.forEach((r) => {
      if (!m[r.date]) m[r.date] = [];
      m[r.date].push(r);
    });
    return m;
  }, [cattleFeedRows]);

  // Day label: just the DD portion of YYYY-MM-DD
  const dayLabel = (dateStr) => dateStr?.slice(8) || '';

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <Container fluid px="md" py="sm">
      <style>{PRINT_CSS}</style>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <Paper withBorder p="sm" radius="md" mb="md" className="no-print" style={{ background: '#f8f9fa' }}>
        <Group wrap="wrap" gap="sm" align="flex-end">

          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>Producer Number</Text>
            <Select
              data={farmers}
              value={farmerId}
              onChange={(v) => { setFarmerId(v); setBillData(null); }}
              placeholder={loadingF ? 'Loading...' : 'Search producer...'}
              searchable clearable
              style={{ minWidth: 280 }}
              size="sm"
              disabled={loadingF}
              rightSection={loadingF ? <Loader size={14} /> : undefined}
            />
          </Box>

          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>Cycle</Text>
            <Select
              data={cycles}
              value={cycleId}
              onChange={(v) => { setCycleId(v); setBillData(null); }}
              placeholder={loadingC ? 'Loading...' : 'Select cycle...'}
              searchable clearable
              style={{ minWidth: 220 }}
              size="sm"
              disabled={loadingC}
              rightSection={loadingC ? <Loader size={14} /> : undefined}
              nothingFoundMessage="No saved cycles found"
            />
          </Box>

          <Button
            leftSection={<IconRefresh size={14} />}
            size="sm"
            color="blue"
            loading={loading}
            onClick={handleFetch}
          >
            Generate Report
          </Button>

          <Button
            leftSection={<IconPrinter size={14} />}
            size="sm"
            variant="outline"
            disabled={!billData}
            onClick={handlePrint}
          >
            Print
          </Button>
        </Group>
      </Paper>

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" className="no-print">
          {error}
        </Alert>
      )}

      {loading && (
        <Center py="xl" className="no-print"><Loader size="md" /></Center>
      )}

      {!loading && !billData && !error && (
        <Center py="xl" className="no-print">
          <Text c="dimmed" size="sm">
            Select a producer and a payment cycle, then click <strong>Generate Report</strong>.
          </Text>
        </Center>
      )}

      {/* ══ BILL AREA ══════════════════════════════════════════════════ */}
      {billData && (
        <Paper withBorder p={0} radius={0}
          style={{ background: '#fff', border: '1px solid #999', maxWidth: 820, margin: '0 auto' }}>
          <Box id="milk-bill-print" ref={printRef} p="xs" style={{ background: '#fff' }}>

            {/* ── HEADER ── */}
            <Box ta="center" mb={4} style={{ borderBottom: BH, paddingBottom: 4 }}>
              <Text fw={900} style={{ fontSize: 14, letterSpacing: 2, fontFamily: FONT, color: '#000', textDecoration: 'underline' }}>
                {societyName}
              </Text>
              <Text fw={700} style={{ fontSize: 12, fontFamily: FONT, color: '#000', letterSpacing: 1 }}>
                MILK BILL — PRODUCER STATEMENT
              </Text>
            </Box>

            {/* ── PRODUCER INFO BAR ── */}
            <Box style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
              gap: 4, borderBottom: B, paddingBottom: 4, marginBottom: 6 }}>
              <Text style={{ fontSize: 9.5, fontFamily: FONT, fontWeight: 700, color: '#000' }}>
                Name: {farmer.name?.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 9.5, fontFamily: FONT, color: '#000' }}>
                Producer No: <strong>{farmer.number}</strong>
                {farmer.memberId && farmer.memberId !== farmer.number
                  ? `  |  Member No: ${farmer.memberId}` : ''}
              </Text>
              <Text style={{ fontSize: 9.5, fontFamily: FONT, color: '#000' }}>
                Cycle: <strong>{fD(selectedCycle?.fromDate)} to {fD(selectedCycle?.toDate)}</strong>
              </Text>
            </Box>

            {/* ══ SECTION 1: MILK COLLECTION ══ */}
            <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000',
              borderBottom: BH, paddingBottom: 2, marginBottom: 4, textTransform: 'uppercase',
              letterSpacing: 1 }}>
              1. Milk Collection Details
            </Text>

            <Box style={{ overflowX: 'auto', marginBottom: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 32 }} />
                  <col style={{ width: 50 }} />
                  <col style={{ width: 26 }} />
                  <col style={{ width: 30 }} />
                  <col style={{ width: 30 }} />
                  <col style={{ width: 40 }} />
                  <col style={{ width: 50 }} />
                  <col style={{ width: 26 }} />
                  <col style={{ width: 30 }} />
                  <col style={{ width: 30 }} />
                  <col style={{ width: 40 }} />
                  <col style={{ width: 50 }} />
                  <col style={{ width: 40 }} />
                  <col style={{ width: 62 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={thSec({ border: BH })} rowSpan={2}>Date</th>
                    <th style={thSec()} colSpan={5}>MORNING (AM)</th>
                    <th style={thSec()} colSpan={5}>EVENING (PM)</th>
                    <th style={thSec()} colSpan={3}>TOTAL</th>
                  </tr>
                  <tr>
                    <th style={thCol()}>Ltr</th>
                    <th style={thCol()}>CLR</th>
                    <th style={thCol()}>FAT</th>
                    <th style={thCol()}>SNF</th>
                    <th style={thCol()}>Rate</th>
                    <th style={thCol()}>Ltr</th>
                    <th style={thCol()}>CLR</th>
                    <th style={thCol()}>FAT</th>
                    <th style={thCol()}>SNF</th>
                    <th style={thCol()}>Rate</th>
                    <th style={thCol()}>Ltr</th>
                    <th style={thCol()}>Rate</th>
                    <th style={thCol()}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map(({ date, am, pm }) => {
                    const totQty = (am?.qty || 0) + (pm?.qty || 0);
                    const totAmt = (am?.amount || 0) + (pm?.amount || 0);
                    const avgR   = totQty > 0 ? totAmt / totQty : 0;
                    return (
                      <tr key={date} style={{ background: '#fff' }}>
                        <td style={tdDay}>{fD(date)}</td>
                        <td style={td()}>{f1(am?.qty)}</td>
                        <td style={td({ textAlign: 'center' })}>{fI(am?.clr)}</td>
                        <td style={td({ textAlign: 'center' })}>{f1(am?.fat)}</td>
                        <td style={td({ textAlign: 'center' })}>{f1(am?.snf)}</td>
                        <td style={td()}>{f2(am?.rate)}</td>
                        <td style={td()}>{f1(pm?.qty)}</td>
                        <td style={td({ textAlign: 'center' })}>{fI(pm?.clr)}</td>
                        <td style={td({ textAlign: 'center' })}>{f1(pm?.fat)}</td>
                        <td style={td({ textAlign: 'center' })}>{f1(pm?.snf)}</td>
                        <td style={td()}>{f2(pm?.rate)}</td>
                        <td style={td({ fontWeight: totQty ? 600 : 400 })}>{f1(totQty || null)}</td>
                        <td style={td()}>{totQty ? f2(avgR) : ''}</td>
                        <td style={td({ fontWeight: totQty ? 600 : 400 })}>{totAmt ? fN(totAmt) : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...tdTot, textAlign: 'center' }}>TOTAL</td>
                    <td style={tdTot}>{fN(summary.amQty)}</td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}>{fN(summary.pmQty)}</td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}>{fN(summary.totalMilkQty)}</td>
                    <td style={tdTot}>{summary.totalMilkQty > 0 ? f2(summary.totalMilkAmt / summary.totalMilkQty) : ''}</td>
                    <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(summary.totalMilkAmt)}</td>
                  </tr>
                </tfoot>
              </table>
            </Box>

            {/* ══ SECTION 2: CATTLE FEED ══ */}
            {cattleFeedRows.length > 0 && (
              <>
                <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000',
                  borderBottom: BH, paddingBottom: 2, marginBottom: 4, textTransform: 'uppercase',
                  letterSpacing: 1, marginTop: 8 }}>
                  2. Cattle Feed Purchase Details
                </Text>
                <Box style={{ overflowX: 'auto', marginBottom: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thCol({ textAlign: 'left', width: 80 })}>Date</th>
                        <th style={thCol({ textAlign: 'left' })}>Item</th>
                        <th style={thCol({ width: 50 })}>Bill No</th>
                        <th style={thCol({ width: 50 })}>Qty</th>
                        <th style={thCol({ width: 50 })}>Rate</th>
                        <th style={thCol({ width: 72 })}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cattleFeedRows.map((row, i) => (
                        <tr key={i} style={{ background: '#fff' }}>
                          <td style={td({ textAlign: 'left' })}>{fD(row.date)}</td>
                          <td style={td({ textAlign: 'left' })}>{row.itemName}</td>
                          <td style={td({ textAlign: 'center' })}>{row.billNumber}</td>
                          <td style={td()}>{row.quantity}</td>
                          <td style={td()}>{f2(row.rate)}</td>
                          <td style={td({ fontWeight: 600 })}>{fN(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ ...tdTot, textAlign: 'right' }}>Total Cattle Feed</td>
                        <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(summary.totalCattleFeed)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </Box>
              </>
            )}

            {/* ══ SECTION 3: DEDUCTIONS ══ */}
            {deductionRows.length > 0 && (
              <>
                <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000',
                  borderBottom: BH, paddingBottom: 2, marginBottom: 4, textTransform: 'uppercase',
                  letterSpacing: 1, marginTop: 8 }}>
                  {cattleFeedRows.length > 0 ? '3.' : '2.'} Other Deductions
                </Text>
                <Box style={{ overflowX: 'auto', marginBottom: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thCol({ textAlign: 'left', width: 80 })}>Date</th>
                        <th style={thCol({ textAlign: 'left' })}>Description</th>
                        <th style={thCol({ width: 80 })}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deductionRows.map((row, i) => (
                        <tr key={i} style={{ background: '#fff' }}>
                          <td style={td({ textAlign: 'left' })}>{fD(row.date)}</td>
                          <td style={td({ textAlign: 'left' })}>{row.itemName}</td>
                          <td style={td({ fontWeight: 600 })}>{fN(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={{ ...tdTot, textAlign: 'right' }}>Total Deductions</td>
                        <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(summary.totalDeductions)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </Box>
              </>
            )}

            {/* ══ SECTION 4: PAYMENTS ══ */}
            {paymentRows.length > 0 && (
              <>
                <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000',
                  borderBottom: BH, paddingBottom: 2, marginBottom: 4, textTransform: 'uppercase',
                  letterSpacing: 1, marginTop: 8 }}>
                  {2 + (cattleFeedRows.length > 0 ? 1 : 0) + (deductionRows.length > 0 ? 1 : 0)}. Payments Made
                </Text>
                <Box style={{ overflowX: 'auto', marginBottom: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thCol({ textAlign: 'left', width: 80 })}>Date</th>
                        <th style={thCol({ textAlign: 'left' })}>Mode</th>
                        <th style={thCol({ textAlign: 'left' })}>Reference</th>
                        <th style={thCol({ width: 80 })}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRows.map((row, i) => (
                        <tr key={i} style={{ background: '#fff' }}>
                          <td style={td({ textAlign: 'left' })}>{fD(row.date)}</td>
                          <td style={td({ textAlign: 'left' })}>{row.mode}</td>
                          <td style={td({ textAlign: 'left' })}>{row.refNo}</td>
                          <td style={td({ fontWeight: 600 })}>{fN(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ ...tdTot, textAlign: 'right' }}>Total Payments</td>
                        <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(summary.totalPayments)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </Box>
              </>
            )}

            {/* ══ SUMMARY ══ */}
            <Box mt={8} style={{ border: BH }}>
              <Box style={{ background: '#ddd', padding: '3px 6px', borderBottom: BH }}>
                <Text style={{ fontFamily: FONT, fontSize: FS + 1, fontWeight: 700, color: '#000',
                  textTransform: 'uppercase', letterSpacing: 1 }}>
                  Summary
                </Text>
              </Box>

              <Box style={{ display: 'flex', gap: 0 }}>
                {/* Left: Earnings */}
                <Box style={{ flex: 1, borderRight: BH, padding: '5px 8px' }}>
                  <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000',
                    marginBottom: 3, textDecoration: 'underline' }}>
                    EARNINGS
                  </Text>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={sumLbl()}>Milk Total ({fN(summary.totalMilkQty)} Ltr)</td>
                        <td style={sumVal()}>{fN(summary.totalMilkAmt)}</td>
                      </tr>
                      {summary.previousBalance !== 0 && (
                        <tr>
                          <td style={sumLbl()}>
                            Previous Balance {summary.previousBalance > 0 ? '(Cr)' : '(Dr)'}
                          </td>
                          <td style={sumVal()}>
                            {summary.previousBalance < 0 ? '− ' : '+ '}
                            {fN(Math.abs(summary.previousBalance))}
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderTop: B }}>
                        <td style={sumLbl(true)}>Gross Total</td>
                        <td style={sumVal(true)}>
                          {fN(summary.totalMilkAmt + Math.max(0, summary.previousBalance))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Box>

                {/* Right: Deductions & Net */}
                <Box style={{ flex: 1.2, padding: '5px 8px' }}>
                  <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000',
                    marginBottom: 3, textDecoration: 'underline' }}>
                    DEDUCTIONS & PAYMENTS
                  </Text>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {summary.previousBalance < 0 && (
                        <tr>
                          <td style={sumLbl()}>Previous Due (Dr)</td>
                          <td style={sumVal()}>{fN(Math.abs(summary.previousBalance))}</td>
                        </tr>
                      )}
                      {summary.totalCattleFeed > 0 && (
                        <tr>
                          <td style={sumLbl()}>Cattle Feed</td>
                          <td style={sumVal()}>{fN(summary.totalCattleFeed)}</td>
                        </tr>
                      )}
                      {summary.totalDeductions > 0 && (
                        <tr>
                          <td style={sumLbl()}>Other Deductions</td>
                          <td style={sumVal()}>{fN(summary.totalDeductions)}</td>
                        </tr>
                      )}
                      {summary.totalBankPay > 0 && (
                        <tr>
                          <td style={sumLbl()}>Bank Payment</td>
                          <td style={sumVal()}>{fN(summary.totalBankPay)}</td>
                        </tr>
                      )}
                      {summary.totalCashPay > 0 && (
                        <tr>
                          <td style={sumLbl()}>Cash Payment</td>
                          <td style={sumVal()}>{fN(summary.totalCashPay)}</td>
                        </tr>
                      )}
                      <tr style={{ borderTop: B }}>
                        <td style={sumLbl(true)}>Total Deductions</td>
                        <td style={sumVal(true)}>
                          {fN((summary.previousBalance < 0 ? Math.abs(summary.previousBalance) : 0)
                            + summary.totalCattleFeed + summary.totalDeductions + summary.totalPayments)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Net amount row */}
                  <Box style={{
                    marginTop: 4,
                    borderTop: BH,
                    padding: '4px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: summary.netAmount >= 0 ? '#e8f5e9' : '#fce4ec',
                  }}>
                    <Text style={{ fontFamily: FONT, fontSize: FS + 2, fontWeight: 700, color: '#000', paddingLeft: 4 }}>
                      {summary.netAmount >= 0 ? 'Net Payable (To Producer)' : 'Net Due (From Producer)'}
                    </Text>
                    <Text style={{ fontFamily: FONT, fontSize: FS + 3, fontWeight: 900, color: '#000', paddingRight: 4 }}>
                      Rs.&nbsp;{fN(Math.abs(summary.netAmount))}
                    </Text>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* ── FOOTER ── */}
            <Box mt={6} style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-end', borderTop: BH, paddingTop: 5 }}>
              <Text style={{ fontSize: 9, fontFamily: FONT, color: '#000' }}>
                Statement Date: {dayjs().format('DD/MM/YYYY')}
              </Text>
              <Box ta="center">
                <Box style={{ width: 140, borderBottom: B, marginBottom: 2 }} />
                <Text style={{ fontSize: 9, fontFamily: FONT, color: '#000' }}>Clerk / Secretary</Text>
              </Box>
              <Box ta="center">
                <Box style={{ width: 140, borderBottom: B, marginBottom: 2 }} />
                <Text style={{ fontSize: 9, fontFamily: FONT, color: '#000' }}>Producer Signature</Text>
              </Box>
            </Box>

          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default MilkBillReport;
