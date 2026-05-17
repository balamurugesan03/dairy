import React, { useState, useRef } from 'react';
import {
  Container, Group, Button, Select, Title, Text, Stack, Loader, Center, Box,
} from '@mantine/core';
import { IconPrinter, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { reportAPI } from '../../services/api';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmt2 = (v) => parseFloat(v || 0).toFixed(2);
const fmt0 = (v) => parseInt(v || 0);

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1; // 1-based
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
const MONTH_OPTIONS = MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label }));

/* ── print styles ────────────────────────────────────────────────────────── */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #milk-stmt-print, #milk-stmt-print * { visibility: visible !important; }
  #milk-stmt-print {
    position: fixed !important; inset: 0 !important;
    padding: 12mm 14mm !important; background: white !important;
  }
  .no-print { display: none !important; }
  @page { size: A4 portrait; margin: 0; }
}
`;

/* ── editable cell (plain number input, styled for the form) ─────────────── */
function EditCell({ value, onChange, width = 80, align = 'center', prefix = '' }) {
  return (
    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: align }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'center', gap: 2 }}>
        {prefix && <span style={{ fontSize: 11 }}>{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            textAlign: 'right',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 600,
          }}
          className="no-print-outline"
        />
      </div>
    </td>
  );
}

function ReadCell({ value, align = 'center', bold = false, prefix = '', colSpan = 1 }) {
  return (
    <td colSpan={colSpan} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: align, fontWeight: bold ? 700 : 400 }}>
      {prefix}{value}
    </td>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function MilkStatementReport() {
  const printRef = useRef();

  const [selYear,  setSelYear]  = useState(String(currentYear));
  const [selMonth, setSelMonth] = useState(String(currentMonth).padStart(2, '0'));
  const [loading,  setLoading]  = useState(false);
  const [data,     setData]     = useState(null);

  // Manual / overrideable fields
  const [boardMeetings,     setBoardMeetings]     = useState(0);
  const [membershipPaid,    setMembershipPaid]    = useState(0);
  const [excessMilk,        setExcessMilk]        = useState(0);
  const [shortageMilk,      setShortageMilk]      = useState(0);
  const [spoiledMilk,       setSpoiledMilk]       = useState(0);
  const [milmaLiters,       setMilmaLiters]       = useState(0);
  const [milmaAmount,       setMilmaAmount]       = useState(0);
  const [societyWelfare,    setSocietyWelfare]    = useState(0);

  const handleLoad = async () => {
    setLoading(true);
    try {
      const res = await reportAPI.milkStatement({ month: `${selYear}-${selMonth}` });
      if (res?.success) {
        setData(res.data);
        // Seed editable milma from credit sales (typical Milma = credit/union channel)
        setMilmaLiters(res.data.creditSalesQty    || 0);
        setMilmaAmount(res.data.creditSalesAmount  || 0);
      } else {
        notifications.show({ title: 'Error', message: res?.message || 'Failed to load', color: 'red' });
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Network error', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  // Derived calculations
  const collectedMilk = data?.collectedQty   || 0;
  const totalMilk     = Math.max(0, (collectedMilk + excessMilk) - (shortageMilk + spoiledMilk));
  const totalWelfare  = (data?.farmerWelfare || 0) + societyWelfare;
  const monthLabel    = `${MONTHS[(parseInt(selMonth) - 1)]} ${selYear}`;

  return (
    <Container fluid px="md" py="sm">
      <style>{PRINT_CSS}</style>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <Group justify="space-between" mb="md" className="no-print">
        <Title order={4} fw={700} c="blue.8">Milk Statement</Title>
        <Group gap="sm">
          <Select
            size="sm"
            label="Month"
            data={MONTH_OPTIONS}
            value={selMonth}
            onChange={v => setSelMonth(v || selMonth)}
            w={140}
          />
          <Select
            size="sm"
            label="Year"
            data={YEAR_OPTIONS}
            value={selYear}
            onChange={v => setSelYear(v || selYear)}
            w={100}
          />
          <Button
            mt={22}
            size="sm"
            leftSection={<IconSearch size={14} />}
            onClick={handleLoad}
            loading={loading}
          >
            Load
          </Button>
          {data && (
            <Button
              mt={22}
              size="sm"
              variant="light"
              color="teal"
              leftSection={<IconPrinter size={14} />}
              onClick={handlePrint}
            >
              Print
            </Button>
          )}
        </Group>
      </Group>

      {loading && <Center py="xl"><Loader /></Center>}

      {!loading && !data && (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text c="dimmed" size="sm">Select month and year, then click Load.</Text>
          </Stack>
        </Center>
      )}

      {/* ── Printable Document ───────────────────────────────────────────── */}
      {data && (
        <Box
          ref={printRef}
          id="milk-stmt-print"
          style={{
            background: 'white',
            fontFamily: '"Times New Roman", Times, serif',
            color: '#000',
            padding: '16px',
            maxWidth: 900,
            margin: '0 auto',
            border: '2px solid #000',
          }}
        >
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2, borderBottom: '3px double #000', paddingBottom: 6 }}>
              Milk Statement
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#333' }}>
              Dairy Co-operative Society — Monthly Report
            </div>
          </div>

          {/* ── Top Section (Form Details) ─────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 12 }}>
            <tbody>
              {/* Row 1: Society name | Month */}
              <tr>
                <td style={{ border: '1px solid #000', padding: '5px 8px', width: '25%', fontWeight: 700, background: '#f5f5f5' }}>
                  Name of Dairy Co-operative Society
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', width: '35%', fontWeight: 600 }}>
                  {data.societyName || '___________________________________'}
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', width: '15%', fontWeight: 700, background: '#f5f5f5', textAlign: 'center' }}>
                  Month
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', width: '25%', fontWeight: 600, textAlign: 'center' }}>
                  {monthLabel}
                </td>
              </tr>

              {/* Row 2: No. of Members | No. of Non-Members */}
              <tr>
                <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: 700, background: '#f5f5f5' }}>
                  Number of Members
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>
                  {fmt0(data.totalMembers)}
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: 700, background: '#f5f5f5', textAlign: 'center' }}>
                  Number of Non-Members
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>
                  {fmt0(data.totalNonMembers)}
                </td>
              </tr>

              {/* Row 3: Milk pouring members | Milk pouring non-members */}
              <tr>
                <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: 700, background: '#f5f5f5' }}>
                  Milk Pouring Members
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>
                  {fmt0(data.pouringMembers)}
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: 700, background: '#f5f5f5', textAlign: 'center' }}>
                  Milk Pouring Non-Members
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>
                  {fmt0(data.pouringNonMembers)}
                </td>
              </tr>

              {/* Row 4: Board meetings | Membership paid */}
              <tr>
                <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: 700, background: '#f5f5f5' }}>
                  Number of Board Meetings
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center' }}>
                  <input
                    type="number"
                    value={boardMeetings}
                    onChange={e => setBoardMeetings(parseInt(e.target.value) || 0)}
                    style={{ width: 60, border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}
                    className="no-print"
                  />
                  <span className="print-value">{boardMeetings}</span>
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: 700, background: '#f5f5f5', textAlign: 'center' }}>
                  Membership Paid per Month
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center' }}>
                  <input
                    type="number"
                    value={membershipPaid}
                    onChange={e => setMembershipPaid(parseInt(e.target.value) || 0)}
                    style={{ width: 60, border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}
                    className="no-print"
                  />
                  <span className="print-value">{membershipPaid}</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Main Data Table ─────────────────────────────────────────── */}
          <div style={{ fontWeight: 700, fontSize: 12, borderTop: '2px solid #000', paddingTop: 6, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Monthly Milk Details
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#e8e8e8' }}>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10 }}>
                  Collected<br />Milk (A)<br />(Litres)
                </th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10 }}>
                  Excess<br />Milk (B)<br />(Litres)
                </th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10 }}>
                  Shortage<br />Milk (C)<br />(Litres)
                </th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10 }}>
                  Spoiled<br />Milk (D)<br />(Litres)
                </th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10, background: '#d0d0d0' }}>
                  Total Milk<br />Litres<br />(A+B)-(C+D)
                </th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10 }}>
                  Milk to<br />Milma (F)<br />(Litres)
                </th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10 }}>
                  Price from<br />Milma (G)<br />(₹)
                </th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10 }}>
                  Local Sales<br />(H)<br />(Litres)
                </th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontSize: 10 }}>
                  Local Sales<br />Price (I)<br />(₹)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* A - Collected (auto) */}
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>
                  {fmt2(collectedMilk)}
                </td>
                {/* B - Excess (manual) */}
                <EditCell value={excessMilk}   onChange={setExcessMilk}   width={70} />
                {/* C - Shortage (manual) */}
                <EditCell value={shortageMilk} onChange={setShortageMilk} width={70} />
                {/* D - Spoiled (manual) */}
                <EditCell value={spoiledMilk}  onChange={setSpoiledMilk}  width={70} />
                {/* E - Total (calculated) */}
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right', fontWeight: 900, fontSize: 13, background: '#f0f0f0' }}>
                  {fmt2(totalMilk)}
                </td>
                {/* F - Milma liters (editable, seeded from credit sales) */}
                <EditCell value={milmaLiters} onChange={setMilmaLiters} width={70} />
                {/* G - Milma amount (editable) */}
                <EditCell value={milmaAmount} onChange={setMilmaAmount} width={80} prefix="₹" align="right" />
                {/* H - Local sales liters (auto) */}
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
                  {fmt2(data.localSalesQty)}
                </td>
                {/* I - Local sales amount (auto) */}
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
                  ₹{fmt2(data.localSalesAmount)}
                </td>
              </tr>
              {/* Empty rows for notes / additional entries */}
              {[1, 2].map(i => (
                <tr key={i}>
                  {Array(9).fill(null).map((_, j) => (
                    <td key={j} style={{ border: '1px solid #000', padding: '10px 4px' }}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Bottom Section: Welfare ─────────────────────────────────── */}
          <div style={{ fontWeight: 700, fontSize: 12, borderTop: '2px solid #000', paddingTop: 6, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Welfare Fund Details
          </div>
          <table style={{ width: '60%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 12 }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: 700, background: '#f5f5f5', width: '65%' }}>
                  Dairy Farmer's Welfare Fund
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                  ₹ {fmt2(data.farmerWelfare)}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: 700, background: '#f5f5f5' }}>
                  Society's Welfare Fund Contribution
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'right' }}>
                  <input
                    type="number"
                    value={societyWelfare}
                    onChange={e => setSocietyWelfare(parseFloat(e.target.value) || 0)}
                    style={{ width: 90, border: 'none', outline: 'none', background: 'transparent', textAlign: 'right', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}
                  />
                </td>
              </tr>
              <tr style={{ background: '#e0e0e0' }}>
                <td style={{ border: '2px solid #000', padding: '6px 8px', fontWeight: 900, fontSize: 13 }}>
                  Total Welfare Fund
                </td>
                <td style={{ border: '2px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 900, fontSize: 14 }}>
                  ₹ {fmt2(totalWelfare)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Signature Section ───────────────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 30, fontSize: 11 }}>
            <tbody>
              <tr>
                {['Prepared by', 'Checked by', 'Secretary', 'President'].map(role => (
                  <td key={role} style={{ padding: '0 10px', textAlign: 'center', width: '25%' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 30 }}>{role}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Box>
      )}
    </Container>
  );
}
