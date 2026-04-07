import { useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Loader, Center, Text } from '@mantine/core';
import { IconPrinter, IconDownload } from '@tabler/icons-react';
import { agriStatsAPI } from '../../services/api';

/* ─── colour tokens (also used inline in print HTML) ──────────────────────── */
const BLUE  = '#1a5276';
const LBLUE = '#2980b9';
const RED   = '#c0392b';
const GREY  = '#f2f3f4';
const DGREY = '#d5d8dc';
const BLACK = '#111';

export default function AgriStatsReportPrint({ reportId }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef();

  useEffect(() => {
    agriStatsAPI.getById(reportId).then(res => {
      if (res?.success) setData(res.data);
      setLoading(false);
    });
  }, [reportId]);

  const triggerPrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(getPrintHTML(content));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  if (loading) return <Center h={200}><Loader /></Center>;
  if (!data)   return <Center h={200}><Text c="red">Report not found</Text></Center>;

  const n = (v) => (v !== null && v !== undefined && v !== '') ? v : '—';
  const nz = (v) => (v !== null && v !== undefined && v !== '') ? v : '';

  /* ── shared table styles (inline, survive print) ─────────────────────── */
  const tbl = { width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 10 };
  const TH  = (extra = {}) => ({
    border: `1px solid ${DGREY}`,
    padding: '5px 6px',
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 10,
    background: BLUE,
    color: '#fff',
    whiteSpace: 'nowrap',
    ...extra
  });
  const TD  = (extra = {}) => ({
    border: `1px solid ${DGREY}`,
    padding: '4px 6px',
    fontSize: 10,
    verticalAlign: 'middle',
    ...extra
  });
  const slTd  = TD({ textAlign: 'center', width: 30, color: '#555' });
  const numTd = TD({ textAlign: 'right',  paddingRight: 8 });
  const boldTd = TD({ fontWeight: 700 });
  const redTd  = TD({ textAlign: 'right', fontWeight: 700, color: RED, paddingRight: 8 });
  const totalTr = { background: '#fef9e7' };

  /* ── Section heading ─────────────────────────────────────────────────── */
  const SH = ({ num, title }) => (
    <div style={{
      background: BLUE, color: '#fff', fontWeight: 700,
      fontSize: 11, padding: '5px 10px', marginBottom: 0,
      letterSpacing: 0.5, textTransform: 'uppercase',
      borderLeft: `4px solid ${RED}`
    }}>
      Section {num} &nbsp;|&nbsp; {title}
    </div>
  );

  /* ── Row striping ─────────────────────────────────────────────────────── */
  const stripe = (i) => i % 2 === 0 ? '#fff' : '#f7f9fc';

  return (
    <Box>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPrinter size={14} />} onClick={triggerPrint} size="sm">
          Print / PDF
        </Button>
      </Group>

      {/* ── Preview pane ── */}
      <div ref={printRef}>
        <div id="agri-doc" style={{
          fontFamily: 'Arial, sans-serif',
          color: BLACK,
          background: '#fff',
          width: '100%',
          padding: '16px 20px',
          fontSize: 10
        }}>

          {/* ═══ HEADER ═══ */}
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            {/* Government logo row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{
                width: 52, height: 52, border: `2px solid ${BLUE}`,
                borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 9, color: BLUE, fontWeight: 700, textAlign: 'center', flexShrink: 0
              }}>
                GOVT.<br />SEAL
              </div>

              <div style={{ flex: 1, textAlign: 'center', padding: '0 10px' }}>
                <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, marginBottom: 2 }}>
                  GOVERNMENT OF INDIA &nbsp;|&nbsp; DEPARTMENT OF AGRICULTURE
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 900, color: BLUE,
                  letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1.2
                }}>
                  AGRICULTURAL STATISTICS
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 800, color: RED,
                  letterSpacing: 2, textTransform: 'uppercase'
                }}>
                  MONTHLY REPORT
                </div>
              </div>

              <div style={{
                background: BLUE, color: '#fff', padding: '6px 12px',
                fontSize: 10, fontWeight: 700, textAlign: 'center', borderRadius: 3,
                minWidth: 90, flexShrink: 0
              }}>
                <div style={{ color: '#aed6f1', fontSize: 9, marginBottom: 2 }}>Report No.</div>
                <div style={{ fontSize: 13 }}>{data.reportNo}</div>
              </div>
            </div>

            {/* Double rule */}
            <div style={{ height: 3, background: BLUE, marginBottom: 2 }} />
            <div style={{ height: 1, background: RED, marginBottom: 10 }} />
          </div>

          {/* ═══ TOP FIELDS ROW ═══ */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 14,
            padding: '8px 12px', border: `1px solid ${DGREY}`, background: GREY
          }}>
            {[
              ['DISTRICT', data.district],
              ['MONTH',    data.month],
              ['YEAR',     data.year]
            ].map(([label, value]) => (
              <div key={label} style={{
                flex: 1, border: `1.5px solid ${BLUE}`,
                background: '#fff', padding: '4px 10px', borderRadius: 2
              }}>
                <div style={{ fontSize: 9, color: LBLUE, fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>
                  {value || '—'}
                </div>
              </div>
            ))}
          </div>

          {/* ═══ SECTION 1 ═══ */}
          <SH num="1" title="General Information" />
          <table style={tbl}>
            <thead>
              <tr>
                {['Sl. No', 'Details', 'Value 1', 'Value 2', 'Value 3'].map(h => (
                  <th key={h} style={TH()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.generalInfo || []).map((row, i) => (
                <tr key={i} style={{ background: stripe(i) }}>
                  <td style={{ ...slTd, fontWeight: 700, color: BLUE }}>
                    {String(row.slNo).padStart(2, '0')}
                  </td>
                  <td style={{ ...boldTd, color: BLUE }}>{row.details}</td>
                  <td style={TD({ textAlign: 'center' })}>{nz(row.value1)}</td>
                  <td style={TD({ textAlign: 'center' })}>{nz(row.value2)}</td>
                  <td style={TD({ textAlign: 'center' })}>{nz(row.value3)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ═══ SECTION 2 ═══ */}
          <SH num="2" title="Population Details" />
          <table style={tbl}>
            <thead>
              <tr>
                {['Category', 'SC', 'ST', 'Female', 'Male', 'Total'].map(h => (
                  <th key={h} style={TH()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.populationDetails || []).map((row, i) => {
                const tot = (+(row.sc||0)) + (+(row.st||0)) + (+(row.female||0)) + (+(row.male||0));
                return (
                  <tr key={i} style={{ background: stripe(i) }}>
                    <td style={{ ...boldTd, color: BLUE }}>{row.category}</td>
                    <td style={numTd}>{nz(row.sc)}</td>
                    <td style={numTd}>{nz(row.st)}</td>
                    <td style={numTd}>{nz(row.female)}</td>
                    <td style={numTd}>{nz(row.male)}</td>
                    <td style={{ ...redTd }}>{row.total ?? (tot || '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ═══ SECTION 3 ═══ */}
          <SH num="3" title="Livestock / Production Details" />
          <table style={tbl}>
            <thead>
              <tr>
                {['Sl. No', 'Category', 'Unit', 'Monthly Value', 'Avg / Day'].map(h => (
                  <th key={h} style={TH()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.livestockProduction || []).map((row, i) => {
                const isTotal = row.category === 'Total Production';
                return (
                  <tr key={i} style={isTotal ? totalTr : { background: stripe(i) }}>
                    <td style={{ ...slTd, fontWeight: isTotal ? 700 : 400, color: isTotal ? RED : '#555' }}>
                      {isTotal ? '' : String(row.slNo).padStart(2, '0')}
                    </td>
                    <td style={{
                      ...boldTd,
                      color: isTotal ? RED : BLUE,
                      fontWeight: isTotal ? 700 : 600
                    }}>
                      {row.category}
                    </td>
                    <td style={TD({ textAlign: 'center', color: '#777' })}>{nz(row.unit)}</td>
                    <td style={isTotal ? redTd : numTd}>{nz(row.value)}</td>
                    <td style={isTotal ? redTd : numTd}>{nz(row.avgPerDay)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ═══ SECTION 4 ═══ */}
          <SH num="4" title="Price Details" />
          <table style={tbl}>
            <thead>
              <tr>
                {['Sl. No', 'Product', 'FAT (%)', 'SNF (%)', 'Avg Price / Ltr (₹)'].map(h => (
                  <th key={h} style={TH()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.priceDetails || []).map((row, i) => (
                <tr key={i} style={{ background: stripe(i) }}>
                  <td style={{ ...slTd, fontWeight: 700, color: BLUE }}>
                    {String(row.slNo).padStart(2, '0')}
                  </td>
                  <td style={{ ...boldTd, color: BLUE }}>{row.product}</td>
                  <td style={numTd}>{nz(row.fat)}</td>
                  <td style={numTd}>{nz(row.snf)}</td>
                  <td style={redTd}>{row.avgPriceLtr !== null && row.avgPriceLtr !== '' ? `₹ ${row.avgPriceLtr}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ═══ SECTION 5 ═══ */}
          <SH num="5" title="Additional Details" />
          <table style={tbl}>
            <thead>
              <tr>
                {['Sl. No', 'Description', 'Remarks 1', 'Remarks 2', 'Remarks 3'].map(h => (
                  <th key={h} style={TH()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.additionalDetails || []).map((row, i) => (
                <tr key={i} style={{ background: stripe(i) }}>
                  <td style={{ ...slTd, fontWeight: 700, color: BLUE }}>
                    {String(row.slNo).padStart(2, '0')}
                  </td>
                  <td style={TD({ minWidth: 120 })}>{nz(row.description)}</td>
                  <td style={TD({ minWidth: 80, color: '#555' })}>{nz(row.remarks1)}</td>
                  <td style={TD({ minWidth: 80, color: '#555' })}>{nz(row.remarks2)}</td>
                  <td style={TD({ minWidth: 80, color: '#555' })}>{nz(row.remarks3)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ═══ SIGNATURE BLOCK ═══ */}
          <div style={{
            height: 1.5, background: BLUE, margin: '14px 0 12px 0'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
            {[
              { label: 'Prepared By',   sub: '(Name & Designation)' },
              { label: 'Verified By',   sub: '(Senior Officer)' },
              { label: 'Approved By',   sub: '(with Official Seal)' }
            ].map(({ label, sub }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ borderBottom: `1.5px solid ${BLACK}`, marginBottom: 4, height: 36 }} />
                <div style={{ fontWeight: 700, fontSize: 10, color: BLUE }}>{label}</div>
                <div style={{ fontSize: 9, color: '#777' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ═══ FOOTER ═══ */}
          <div style={{
            marginTop: 16, borderTop: `1px solid ${DGREY}`,
            paddingTop: 6, display: 'flex', justifyContent: 'space-between',
            fontSize: 9, color: '#888'
          }}>
            <div>Department of Agriculture &nbsp;|&nbsp; Govt. Statistical Division</div>
            <div style={{ color: '#555', fontWeight: 700 }}>Page 1 of 1</div>
          </div>

        </div>
      </div>
    </Box>
  );
}

/* ── Print-window HTML wrapper ────────────────────────────────────────────── */
function getPrintHTML(body) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Agricultural Statistics Monthly Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 18mm 14mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #agri-doc { width: 100%; padding: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d5d8dc; padding: 4px 6px; font-size: 10px; }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}
