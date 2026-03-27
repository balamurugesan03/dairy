import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Group, Text, Button, Select, Paper, Container, Loader, Center, Alert,
} from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPrinter, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { milkBillAPI, farmerAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

/* ── Formatting ────────────────────────────────────────────────────────────── */
const f1  = (v) => (v == null || v === 0) ? '' : (+v).toFixed(1);
const f2  = (v) => (v == null || v === 0) ? '' : (+v).toFixed(2);
const fN  = (v) => (+(v || 0)).toFixed(2);   // always show two decimals
const fI  = (v) => (v == null || v === 0) ? '' : Math.round(+v); // integer (CLR)

/* ── Style constants (grayscale / print-like) ──────────────────────────────── */
const FONT = "'Courier New', Courier, monospace";
const B    = '1px solid #555';
const BH   = '1.5px solid #111';
const BL   = '1px solid #aaa';
const FS   = 9;

const thSec = (extra = {}) => ({
  background:    '#c8c8c8',
  color:         '#000',
  fontWeight:    700,
  fontSize:      FS + 0.5,
  textAlign:     'center',
  border:        BH,
  padding:       '3px 2px',
  letterSpacing: 0.8,
  fontFamily:    FONT,
  ...extra,
});

const thCol = (extra = {}) => ({
  background:  '#e4e4e4',
  color:       '#111',
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
  height:        17,
  lineHeight:    '17px',
  ...extra,
});

const tdDay = {
  ...td(),
  textAlign:  'center',
  fontWeight: 600,
  background: '#f0f0f0',
  border:     B,
  width:      22,
};

const tdTot = {
  ...td(),
  fontWeight:  700,
  background:  '#ddd',
  border:      BH,
  fontSize:    FS + 0.5,
};

const sumLbl = (bold) => ({
  fontFamily: FONT,
  fontSize:   FS + 0.5,
  fontWeight: bold ? 700 : 400,
  color:      '#000',
  padding:    '2px 4px 2px 0',
  textAlign:  'left',
  whiteSpace: 'nowrap',
});

const sumVal = (bold) => ({
  fontFamily: FONT,
  fontSize:   FS + 0.5,
  fontWeight: bold ? 700 : 400,
  color:      '#000',
  padding:    '2px 0 2px 8px',
  textAlign:  'right',
  whiteSpace: 'nowrap',
  minWidth:   80,
});

/* ── Print CSS ─────────────────────────────────────────────────────────────── */
const PRINT_CSS = `
  @media print {
    body * { visibility: hidden !important; }
    #milk-bill-print, #milk-bill-print * { visibility: visible !important; }
    #milk-bill-print { position: fixed; inset: 0; padding: 5mm; }
    .no-print { display: none !important; }
    .show-on-print { display: block !important; }
    @page { size: A4 landscape; margin: 5mm; }
    table { border-collapse: collapse !important; }
  }
  .show-on-print { display: none; }
`;

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
const MilkBillReport = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef();

  /* ── controls ────────────────────────────────────────────────────────────── */
  const [month,      setMonth]      = useState(dayjs().startOf('month').toDate());
  const [farmers,    setFarmers]    = useState([]);
  const [farmerId,   setFarmerId]   = useState(null);
  const [loadingF,   setLoadingF]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [billData,   setBillData]   = useState(null);
  const [error,      setError]      = useState('');

  /* ── load farmers on mount ───────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setLoadingF(true);
      try {
        const res = await farmerAPI.getAll({ status: 'Active', limit: 1000 });
        const list = res.farmers || res.data?.farmers || res.data || [];
        setFarmers(
          list.map((f) => ({
            value: f._id,
            label: `${f.farmerNumber} — ${f.personalDetails?.name || ''}`,
          }))
        );
      } catch (e) {
        notifications.show({ title: 'Error', message: 'Could not load farmers', color: 'red' });
      } finally {
        setLoadingF(false);
      }
    };
    load();
  }, []);

  /* ── fetch bill ──────────────────────────────────────────────────────────── */
  const handleFetch = useCallback(async () => {
    if (!farmerId) {
      notifications.show({ title: 'Select farmer', message: 'Choose a producer first', color: 'orange' });
      return;
    }
    setLoading(true);
    setError('');
    setBillData(null);
    try {
      const m = dayjs(month).month() + 1;
      const y = dayjs(month).year();
      const res = await milkBillAPI.get(farmerId, { month: m, year: y });
      if (!res.success) throw new Error(res.message || 'Failed');
      setBillData(res);
    } catch (e) {
      setError(e.message || 'Failed to load milk bill');
    } finally {
      setLoading(false);
    }
  }, [farmerId, month]);

  /* ── print ────────────────────────────────────────────────────────────────── */
  const handlePrint = useReactToPrint({
    content:       () => printRef.current,
    documentTitle: billData
      ? `MilkBill_${billData.farmer.number}_${dayjs(month).format('MMYYYY')}`
      : 'MilkBill',
  });

  /* ── compute totals from billData.days ──────────────────────────────────── */
  const totals = useMemo(() => {
    if (!billData) return null;
    let mQty = 0, mAmt = 0, eQty = 0, eAmt = 0;
    billData.days.forEach(({ am, pm }) => {
      if (am) { mQty += am.qty; mAmt += am.amount; }
      if (pm) { eQty += pm.qty; eAmt += pm.amount; }
    });
    const totQty = mQty + eQty;
    const totAmt = mAmt + eAmt;
    const avgRate = totQty > 0 ? totAmt / totQty : 0;
    return { mQty, mAmt, eQty, eAmt, totQty, totAmt, avgRate };
  }, [billData]);

  /* ── summary calculations ────────────────────────────────────────────────── */
  const summary = useMemo(() => {
    if (!billData || !totals) return null;
    const { openingBalance, cattleFeed, paymentBank } = billData;
    const milkTotal  = totals.totAmt;
    const grossTotal = milkTotal + (openingBalance > 0 ? openingBalance : 0);
    const prevOwed   = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    const totalDeduct = paymentBank + cattleFeed + prevOwed;
    const finalDue    = milkTotal + openingBalance - paymentBank - cattleFeed;
    return { milkTotal, grossTotal, openingBalance, totalDeduct, paymentBank, cattleFeed, prevOwed, finalDue };
  }, [billData, totals]);

  const monthLabel = dayjs(month).format('MMMM YYYY').toUpperCase();
  const lastDay    = dayjs(month).endOf('month').format('DD/MM/YYYY');
  const societyName = selectedCompany?.companyName?.toUpperCase() || 'DAIRY COOPERATIVE SOCIETY';

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <Container fluid px="md" py="sm">
      <style>{PRINT_CSS}</style>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <Paper withBorder p="sm" radius="md" mb="md" className="no-print"
        style={{ background: '#f8f9fa' }}>
        <Group wrap="wrap" gap="sm" align="flex-end">

          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>Producer</Text>
            <Select
              data={farmers}
              value={farmerId}
              onChange={setFarmerId}
              placeholder={loadingF ? 'Loading...' : 'Select producer...'}
              searchable
              clearable
              style={{ minWidth: 280 }}
              size="sm"
              disabled={loadingF}
              rightSection={loadingF ? <Loader size={14} /> : undefined}
            />
          </Box>

          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>Month</Text>
            <MonthPickerInput
              value={month}
              onChange={setMonth}
              valueFormat="MMMM YYYY"
              style={{ minWidth: 160 }}
              size="sm"
            />
          </Box>

          <Button
            leftSection={<IconRefresh size={14} />}
            size="sm"
            color="blue"
            loading={loading}
            onClick={handleFetch}
          >
            Load Bill
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

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <Center py="xl" className="no-print">
          <Loader size="md" />
        </Center>
      )}

      {/* ── No data placeholder ───────────────────────────────────────── */}
      {!loading && !billData && !error && (
        <Center py="xl" className="no-print">
          <Text c="dimmed" size="sm">Select a producer and month, then click <strong>Load Bill</strong>.</Text>
        </Center>
      )}

      {/* ══ BILL AREA ══════════════════════════════════════════════════ */}
      {billData && totals && summary && (
        <Paper
          withBorder p={0} radius={0}
          style={{ background: '#fff', border: '2px solid #333', maxWidth: 1060, margin: '0 auto' }}
        >
          <Box id="milk-bill-print" ref={printRef} p="xs"
            style={{ background: '#fff', minWidth: 860 }}>

            {/* ── HEADER ── */}
            <Box ta="center" mb={5}>
              <Text fw={900} style={{ fontSize: 15, letterSpacing: 2, fontFamily: FONT, color: '#000', textDecoration: 'underline' }}>
                {societyName}
              </Text>
              <Text fw={700} style={{ fontSize: 12, fontFamily: FONT, color: '#000', letterSpacing: 1 }}>
                MILK BILL
              </Text>
              <Text fw={600} style={{ fontSize: 10.5, fontFamily: FONT, color: '#000' }}>
                {monthLabel}
              </Text>
            </Box>

            {/* ── MEMBER INFO BAR ── */}
            <Box style={{
              border:          BH,
              padding:         '3px 8px',
              background:      '#f0f0f0',
              marginBottom:    5,
              display:         'flex',
              justifyContent:  'space-between',
              alignItems:      'center',
              flexWrap:        'wrap',
              gap:             6,
            }}>
              <Text style={{ fontSize: 10, fontFamily: FONT, fontWeight: 700, color: '#000' }}>
                PRODUCERS DUES,&nbsp;&nbsp;
                {billData.farmer.name.toUpperCase()}
                {billData.farmer.house ? `, ${billData.farmer.house.toUpperCase()}` : ''}
              </Text>
              <Group gap="xl">
                <Text style={{ fontSize: 10, fontFamily: FONT, color: '#000' }}>
                  Depot Name :&nbsp;<strong>{societyName}</strong>
                </Text>
                <Text style={{ fontSize: 10, fontFamily: FONT, color: '#000' }}>
                  Member No :&nbsp;<strong>{billData.farmer.memberId || billData.farmer.number}</strong>
                </Text>
              </Group>
            </Box>

            {/* ── MAIN TABLE ── */}
            <Box style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 820 }}>
                <colgroup>
                  <col style={{ width: 24 }} />   {/* Date */}
                  {/* Morning: Qty CLR FAT SNF Rate */}
                  <col style={{ width: 48 }} />
                  <col style={{ width: 28 }} />
                  <col style={{ width: 34 }} />
                  <col style={{ width: 34 }} />
                  <col style={{ width: 42 }} />
                  {/* Evening: Qty CLR FAT SNF Rate */}
                  <col style={{ width: 48 }} />
                  <col style={{ width: 28 }} />
                  <col style={{ width: 34 }} />
                  <col style={{ width: 34 }} />
                  <col style={{ width: 42 }} />
                  {/* Total: Qty Rate Amt Feed */}
                  <col style={{ width: 54 }} />
                  <col style={{ width: 42 }} />
                  <col style={{ width: 66 }} />
                  <col style={{ width: 58 }} />
                </colgroup>

                <thead>
                  {/* Section headers */}
                  <tr>
                    <th style={thSec({ border: BH })} rowSpan={2}></th>
                    <th style={thSec()} colSpan={5}>MORNING</th>
                    <th style={thSec()} colSpan={5}>EVENING</th>
                    <th style={thSec()} colSpan={4}>TOTAL</th>
                  </tr>
                  {/* Column sub-headers */}
                  <tr>
                    <th style={thCol()}>Qty</th>
                    <th style={thCol()}>CLR</th>
                    <th style={thCol()}>FAT</th>
                    <th style={thCol()}>SNF</th>
                    <th style={thCol()}>Rate</th>
                    <th style={thCol()}>Qty</th>
                    <th style={thCol()}>CLR</th>
                    <th style={thCol()}>FAT</th>
                    <th style={thCol()}>SNF</th>
                    <th style={thCol()}>Rate</th>
                    <th style={thCol()}>Qty</th>
                    <th style={thCol()}>Rate</th>
                    <th style={thCol()}>Amt</th>
                    <th style={thCol()}>Cattle Feed</th>
                  </tr>
                </thead>

                <tbody>
                  {billData.days.map(({ day, am, pm }) => {
                    const totQty = (am?.qty || 0) + (pm?.qty || 0);
                    const totAmt = (am?.amount || 0) + (pm?.amount || 0);
                    const avgR   = totQty > 0 ? totAmt / totQty : 0;
                    const isEven = day % 2 === 0;
                    const rowBg  = isEven ? '#fafafa' : '#fff';

                    return (
                      <tr key={day} style={{ background: rowBg }}>
                        {/* Day */}
                        <td style={tdDay}>{day}</td>

                        {/* Morning */}
                        <td style={td()}>{f1(am?.qty)}</td>
                        <td style={td({ textAlign: 'center' })}>{fI(am?.clr)}</td>
                        <td style={td({ textAlign: 'center' })}>{f1(am?.fat)}</td>
                        <td style={td({ textAlign: 'center' })}>{f1(am?.snf)}</td>
                        <td style={td()}>{f2(am?.rate)}</td>

                        {/* Evening */}
                        <td style={td()}>{f1(pm?.qty)}</td>
                        <td style={td({ textAlign: 'center' })}>{fI(pm?.clr)}</td>
                        <td style={td({ textAlign: 'center' })}>{f1(pm?.fat)}</td>
                        <td style={td({ textAlign: 'center' })}>{f1(pm?.snf)}</td>
                        <td style={td()}>{f2(pm?.rate)}</td>

                        {/* Day total */}
                        <td style={td({ fontWeight: totQty ? 600 : 400 })}>{f1(totQty || null)}</td>
                        <td style={td()}>{totQty ? f2(avgR) : ''}</td>
                        <td style={td({ fontWeight: totQty ? 600 : 400 })}>{totAmt ? fN(totAmt) : ''}</td>
                        <td style={td()}></td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* ── Totals row ── */}
                <tfoot>
                  <tr>
                    <td style={{ ...tdTot, textAlign: 'center', background: '#bbb', fontSize: FS }}>
                      TOTAL
                    </td>
                    {/* Morning */}
                    <td style={{ ...tdTot, borderLeft: BH }}>{fN(totals.mQty)}</td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    {/* Evening */}
                    <td style={{ ...tdTot, borderLeft: BH }}>{fN(totals.eQty)}</td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    <td style={tdTot}></td>
                    {/* Grand */}
                    <td style={{ ...tdTot, borderLeft: BH }}>{fN(totals.totQty)}</td>
                    <td style={tdTot}>{fN(totals.avgRate)}</td>
                    <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(totals.totAmt)}</td>
                    <td style={tdTot}>{summary.cattleFeed > 0 ? fN(summary.cattleFeed) : ''}</td>
                  </tr>
                </tfoot>
              </table>
            </Box>

            {/* ── SUMMARY SECTION ── */}
            <Box mt={6} style={{ display: 'flex', gap: 0, border: BH }}>

              {/* Left: Milk Qty & Amount */}
              <Box style={{ flex: 1, borderRight: BH, padding: '5px 8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={sumLbl()}>Total Milk Quantity</td>
                      <td style={sumVal()}>{fN(totals.totQty)}&nbsp;Ltr</td>
                    </tr>
                    <tr>
                      <td style={sumLbl()}>Total Amount</td>
                      <td style={sumVal()}>{fN(totals.totAmt)}</td>
                    </tr>
                  </tbody>
                </table>
              </Box>

              {/* Middle: Earnings */}
              <Box style={{ flex: 1.2, borderRight: BH, padding: '5px 8px' }}>
                <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000', marginBottom: 3, textDecoration: 'underline', textTransform: 'uppercase' }}>
                  Earnings
                </Text>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={sumLbl()}>Previous Balance</td>
                      <td style={sumVal()}>
                        {fN(Math.abs(summary.openingBalance))}
                        {summary.openingBalance < 0 ? ' (Dr)' : summary.openingBalance > 0 ? ' (Cr)' : ''}
                      </td>
                    </tr>
                    <tr>
                      <td style={sumLbl()}>Milk Total</td>
                      <td style={sumVal()}>{fN(summary.milkTotal)}</td>
                    </tr>
                    <tr style={{ borderTop: B }}>
                      <td style={sumLbl(true)}>Total</td>
                      <td style={sumVal(true)}>{fN(summary.milkTotal + Math.max(0, summary.openingBalance))}</td>
                    </tr>
                  </tbody>
                </table>
              </Box>

              {/* Right: Deductions & Due */}
              <Box style={{ flex: 1.4, padding: '5px 8px' }}>
                <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000', marginBottom: 3, textDecoration: 'underline', textTransform: 'uppercase' }}>
                  Deductions
                </Text>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={sumLbl()}>Payment / Bank</td>
                      <td style={sumVal()}>{fN(summary.paymentBank)}</td>
                    </tr>
                    <tr>
                      <td style={sumLbl()}>Cattle Feed</td>
                      <td style={sumVal()}>{fN(summary.cattleFeed)}</td>
                    </tr>
                    {summary.prevOwed > 0 && (
                      <tr>
                        <td style={sumLbl()}>Previous Balance (Dr)</td>
                        <td style={sumVal()}>{fN(summary.prevOwed)}</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: B }}>
                      <td style={sumLbl(true)}>Total Deduction</td>
                      <td style={sumVal(true)}>{fN(summary.totalDeduct)}</td>
                    </tr>
                    <tr style={{
                      borderTop: BH,
                      background: summary.finalDue >= 0 ? '#d8f0d8' : '#f0d8d8',
                    }}>
                      <td style={{ ...sumLbl(true), fontSize: FS + 1.5 }}>
                        {summary.finalDue >= 0 ? 'Amount Due (Payable)' : 'Amount Due (Receivable)'}
                      </td>
                      <td style={{ ...sumVal(true), fontSize: FS + 2 }}>
                        Rs.&nbsp;{fN(Math.abs(summary.finalDue))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Box>
            </Box>

            {/* ── FOOTER ── */}
            <Box mt={5} style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'flex-end',
              borderTop:      BH,
              paddingTop:     5,
              paddingLeft:    4,
              paddingRight:   4,
            }}>
              <Text style={{ fontSize: 9.5, fontFamily: FONT, color: '#000' }}>
                Date: {lastDay}
              </Text>
              <Box ta="center">
                <Box style={{ width: 160, borderBottom: B, marginBottom: 2 }} />
                <Text style={{ fontSize: 9.5, fontFamily: FONT, color: '#000' }}>
                  Clerk / Secretary
                </Text>
              </Box>
            </Box>

          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default MilkBillReport;
