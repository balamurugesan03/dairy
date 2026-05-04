import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { milkCollectionAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import './MilkPurchaseReport.css';

const f2  = v => Number(v || 0).toFixed(2);
const f3  = v => Number(v || 0).toFixed(3);
const fz2 = v => { const n = Number(v || 0); return n === 0 ? '' : n.toFixed(2); };
const fz3 = v => { const n = Number(v || 0); return n === 0 ? '' : n.toFixed(3); };

const fmtDate = d => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const dayName = d => {
  if (!d) return '';
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d).getDay()];
};

export default function MilkPurchaseReport() {
  const navigate    = useNavigate();
  const { company } = useCompany();
  const printRef    = useRef(null);

  const today        = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [tab,      setTab]      = useState('date');
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate,   setToDate]   = useState(today);
  const [loading,  setLoading]  = useState(false);
  const [rows,     setRows]     = useState([]);
  const [loaded,   setLoaded]   = useState(false);
  const [errMsg,   setErrMsg]   = useState('');

  const handleLoad = async () => {
    setLoading(true); setErrMsg(''); setRows([]);
    try {
      const params = { fromDate, toDate };
      const res = tab === 'farmer'
        ? await milkCollectionAPI.getFarmerWiseSummary(params)
        : await milkCollectionAPI.getDateWiseSummary(params);
      if (res?.success) { setRows(res.data || []); setLoaded(true); }
      else setErrMsg(res?.message || 'Failed to load data');
    } catch (e) {
      setErrMsg(e.message || 'Error loading data');
    } finally { setLoading(false); }
  };

  const switchTab = t => { setTab(t); setRows([]); setLoaded(false); setErrMsg(''); };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = rows.reduce((acc, r) => {
    if (tab === 'farmer') {
      acc.totalEntries   += r.totalEntries   || 0;
      acc.amEntries      += r.amEntries      || 0;
      acc.pmEntries      += r.pmEntries      || 0;
      acc.totalQty       += r.totalQty       || 0;
      acc.totalIncentive += r.totalIncentive || 0;
      acc.totalAmount    += r.totalAmount    || 0;
      acc.memCount       += r.isMember ? 1 : 0;
      acc.nonMemCount    += r.isMember ? 0 : 1;
    } else {
      acc.memNos    += r.memNos    || 0;
      acc.memQty    += Number(r.memQty    || 0);
      acc.memAmt    += Number(r.memAmt    || 0);
      acc.nonMemNos += r.nonMemNos || 0;
      acc.nonMemQty += Number(r.nonMemQty || 0);
      acc.nonMemAmt += Number(r.nonMemAmt || 0);
      acc.totalNos  += r.totalNos  || 0;
      acc.totalQty  += Number(r.totalQty  || 0);
      acc.totalAmt  += Number(r.totalAmt  || 0);
      acc.localQty  += Number(r.localQty  || 0);
      acc.localAmt  += Number(r.localAmt  || 0);
      acc.creditQty += Number(r.creditQty || 0);
      acc.creditAmt += Number(r.creditAmt || 0);
      acc.schoolQty += Number(r.schoolQty || 0);
      acc.schoolAmt += Number(r.schoolAmt || 0);
      acc.sampleQty += Number(r.sampleQty || 0);
      acc.sampleAmt += Number(r.sampleAmt || 0);
    }
    return acc;
  }, {
    totalEntries: 0, amEntries: 0, pmEntries: 0, totalQty: 0, totalIncentive: 0, totalAmount: 0,
    memCount: 0, nonMemCount: 0,
    memNos: 0, memQty: 0, memAmt: 0,
    nonMemNos: 0, nonMemQty: 0, nonMemAmt: 0,
    totalNos: 0, totalAmt: 0,
    localQty: 0, localAmt: 0, creditQty: 0, creditAmt: 0,
    schoolQty: 0, schoolAmt: 0, sampleQty: 0, sampleAmt: 0,
  });

  const avgRate = tab === 'farmer'
    ? (totals.totalQty > 0 ? totals.totalAmount / totals.totalQty : 0)
    : (totals.totalQty > 0 ? totals.totalAmt    / totals.totalQty : 0);

  const societyName  = company?.name || 'Dairy Society';
  const periodLabel  = `${fmtDate(fromDate)} to ${fmtDate(toDate)}`;

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Milk Purchase Report</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:6mm 8mm;font-family:Arial,sans-serif;font-size:9px;color:#000}
.mpr-hdr{text-align:center;border-bottom:2.5px double #000;padding-bottom:5px;margin-bottom:0}
.mpr-hdr-dept{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6b}
.mpr-hdr-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:3px}
.mpr-hdr-meta{display:flex;justify-content:space-between;font-size:9px;font-weight:600;margin-top:4px;border-top:1px solid #bbb;padding-top:3px}
.mpr-subhdr{background:#1a3a6b;color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;padding:3px 8px;margin-top:5px;text-align:center}
table{width:100%;border-collapse:collapse;font-size:8px;margin-top:0}
th{background:#1a3a6b;color:#fff;border:1px solid #000;padding:2px 3px;font-size:8px;font-weight:800;text-align:center;text-transform:uppercase;white-space:nowrap;vertical-align:middle}
th.mem{background:#14532d} th.nonmem{background:#7c2d12} th.tot{background:#1e3a8a}
th.local{background:#065f46} th.credit{background:#1e40af} th.school{background:#78350f} th.sample{background:#4c1d95}
td{border:1px solid #999;padding:2px 3px;font-size:8px;vertical-align:middle;white-space:nowrap}
td.c{text-align:center} td.r{text-align:right} td.nm{font-weight:700;background:#fafafa}
tr.tot-row td{background:#1a3a6b;color:#fff;font-weight:800;border:1.5px solid #000}
.mpr-summary{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.mpr-card{border:1px solid #000;padding:3px 8px;flex:1;min-width:90px;text-align:center}
.mpr-card-label{font-size:7.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;display:block}
.mpr-card-value{font-size:11px;font-weight:900;color:#1a3a6b;display:block;margin-top:1px}
.mpr-footer{display:flex;justify-content:space-between;border-top:2px solid #000;margin-top:10px;padding-top:6px;font-size:9px}
.mpr-footer-sig{text-align:right;font-weight:700;border-top:1px solid #000;padding-top:3px;min-width:140px;align-self:flex-end}
@page{size:A4 landscape;margin:6mm 8mm}
</style></head><body>
${el.innerHTML}
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 350);
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleCSV = () => {
    let csv = '';
    if (tab === 'farmer') {
      csv = 'S.No,Type,Farmer No,Farmer Name,AM,PM,Sessions,Qty (L),Avg Fat,Avg CLR,Avg SNF,Avg Rate,Incentive (₹),Amount (₹)\n';
      rows.forEach((r, i) => {
        csv += `${i+1},${r.isMember?'Member':'Non-Member'},${r.farmerNo},"${r.farmerName}",${r.amEntries},${r.pmEntries},${r.totalEntries},${f3(r.totalQty)},${f2(r.avgFat)},${f2(r.avgClr||0)},${f2(r.avgSnf)},${f2(r.avgRate)},${f2(r.totalIncentive)},${f2(r.totalAmount)}\n`;
      });
    } else {
      csv = 'Date,Day,Mem Nos,Mem Qty,Mem Amt,NonMem Nos,NonMem Qty,NonMem Amt,Total Nos,Total Qty,Total Amt,Avg Rate,Local Qty,Local Amt,Credit Qty,Credit Amt,School Qty,School Amt,Sample Qty,Sample Amt\n';
      rows.forEach(r => {
        csv += `${fmtDate(r.date)},${dayName(r.date)},${r.memNos},${f3(r.memQty)},${f2(r.memAmt)},${r.nonMemNos},${f3(r.nonMemQty)},${f2(r.nonMemAmt)},${r.totalNos},${f3(r.totalQty)},${f2(r.totalAmt)},${f2(r.avgRate)},${f3(r.localQty)},${f2(r.localAmt)},${f3(r.creditQty)},${f2(r.creditAmt)},${f3(r.schoolQty)},${f2(r.schoolAmt)},${f3(r.sampleQty)},${f2(r.sampleAmt)}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `MilkPurchaseReport_${fromDate}_${toDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handlePDF = () => {
    const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 12;
    doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.setTextColor(26, 58, 107);
    doc.text(societyName.toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 6; doc.setFontSize(11); doc.setTextColor(0);
    doc.text('MILK PURCHASE REPORT', pageW / 2, y, { align: 'center' });
    y += 5; doc.setFontSize(8); doc.setFont(undefined, 'normal');
    doc.text(`Period: ${periodLabel}`, 14, y);
    doc.text(`Mode: ${tab === 'farmer' ? 'Farmer-wise' : 'Date-wise'}`, pageW - 14, y, { align: 'right' });
    y += 3; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(14, y, pageW - 14, y); y += 4;

    if (tab === 'farmer') {
      autoTable(doc, {
        startY: y,
        head: [['#','Type','Farmer No','Farmer Name','AM','PM','Sessions','Qty (L)','Fat','CLR','SNF','Rate','Incentive','Amount (₹)']],
        body: [
          ...rows.map((r, i) => [i+1, r.isMember?'Member':'Non-Member', r.farmerNo, r.farmerName,
            r.amEntries, r.pmEntries, r.totalEntries, f3(r.totalQty), f2(r.avgFat), f2(r.avgClr||0),
            f2(r.avgSnf), f2(r.avgRate), f2(r.totalIncentive), f2(r.totalAmount)]),
          ['TOTAL','',`${totals.memCount}M / ${totals.nonMemCount}NM`,'',totals.amEntries,totals.pmEntries,totals.totalEntries,
            f3(totals.totalQty),'','',  '', f2(avgRate),f2(totals.totalIncentive),f2(totals.totalAmount)],
        ],
        styles: { fontSize: 6, cellPadding: 1.2, halign: 'center' },
        headStyles: { fillColor: [26,58,107], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 3: { halign: 'left' } },
        didParseCell: d => {
          if (d.row.index === rows.length) { d.cell.styles.fillColor=[26,58,107]; d.cell.styles.textColor=255; d.cell.styles.fontStyle='bold'; }
          else if (d.section==='body' && rows[d.row.index]?.isMember===false && d.column.index===1)
            d.cell.styles.textColor = [124,45,18];
        },
      });
    } else {
      autoTable(doc, {
        startY: y,
        head: [
          ['Date','Day','Mem\nNos','Mem\nQty','Mem\nAmt','NonMem\nNos','NonMem\nQty','NonMem\nAmt',
           'Total\nNos','Total\nQty','Total\nAmt','Rate',
           'Local\nQty','Local\nAmt','Credit\nQty','Credit\nAmt','School\nQty','School\nAmt','Sample\nQty','Sample\nAmt'],
        ],
        body: [
          ...rows.map(r => [fmtDate(r.date), dayName(r.date),
            r.memNos, f3(r.memQty), f2(r.memAmt),
            r.nonMemNos, f3(r.nonMemQty), f2(r.nonMemAmt),
            r.totalNos, f3(r.totalQty), f2(r.totalAmt), f2(r.avgRate),
            fz3(r.localQty), fz2(r.localAmt), fz3(r.creditQty), fz2(r.creditAmt),
            fz3(r.schoolQty), fz2(r.schoolAmt), fz3(r.sampleQty), fz2(r.sampleAmt),
          ]),
          ['TOTAL','',totals.memNos,f3(totals.memQty),f2(totals.memAmt),
            totals.nonMemNos,f3(totals.nonMemQty),f2(totals.nonMemAmt),
            totals.totalNos,f3(totals.totalQty),f2(totals.totalAmt),f2(avgRate),
            f3(totals.localQty),f2(totals.localAmt),f3(totals.creditQty),f2(totals.creditAmt),
            f3(totals.schoolQty),f2(totals.schoolAmt),f3(totals.sampleQty),f2(totals.sampleAmt)],
        ],
        styles: { fontSize: 6, cellPadding: 1.2, halign: 'center' },
        headStyles: { fillColor: [26,58,107], textColor: 255, fontStyle: 'bold' },
        didParseCell: d => {
          if (d.row.index === rows.length) { d.cell.styles.fillColor=[26,58,107]; d.cell.styles.textColor=255; d.cell.styles.fontStyle='bold'; }
        },
      });
    }
    doc.save(`MilkPurchaseReport_${fromDate}_${toDate}.pdf`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mpr-wrap">
      {/* Action Bar */}
      <div className="mpr-bar">
        <p className="mpr-bar-title">Milk Purchase Report</p>
        <div className="mpr-btns">
          <button className="mpr-btn mpr-btn-back"  onClick={() => navigate(-1)}>← Back</button>
          <button className="mpr-btn mpr-btn-load"  onClick={handleLoad} disabled={loading}>
            {loading ? 'Loading…' : 'Load'}
          </button>
          <button className="mpr-btn mpr-btn-print" onClick={handlePrint} disabled={!loaded}>Print</button>
          <button className="mpr-btn mpr-btn-pdf"   onClick={handlePDF}   disabled={!loaded}>Export PDF</button>
          <button className="mpr-btn mpr-btn-csv"   onClick={handleCSV}   disabled={!loaded}>Export CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="mpr-filter">
        <div className="mpr-field"><label>From Date</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
        <div className="mpr-field"><label>To Date</label>  <input type="date" value={toDate}   onChange={e => setToDate(e.target.value)}   /></div>
      </div>

      {/* Tabs */}
      <div className="mpr-tabs">
        <div className={`mpr-tab${tab === 'date'   ? ' active' : ''}`} onClick={() => switchTab('date')}>Date-wise Summary</div>
        <div className={`mpr-tab${tab === 'farmer' ? ' active' : ''}`} onClick={() => switchTab('farmer')}>Farmer-wise Summary</div>
      </div>

      {errMsg && <div className="mpr-msg mpr-msg-err">{errMsg}</div>}
      {!loaded && !loading && <div className="mpr-empty">Select date range and click <strong>Load</strong> to generate report.</div>}
      {loaded && rows.length === 0 && <div className="mpr-empty">No records found for the selected period.</div>}

      {loaded && rows.length > 0 && (
        <div className="mpr-rpt" ref={printRef}>
          {/* Header */}
          <div className="mpr-hdr">
            <div className="mpr-hdr-dept">{societyName}</div>
            <div className="mpr-hdr-title">Milk Purchase Report</div>
            <div className="mpr-hdr-meta">
              <span>Period: <span>{periodLabel}</span></span>
              <span>Mode: <span>{tab === 'farmer' ? 'Farmer-wise Summary' : 'Date-wise Summary'}</span></span>
              <span>Generated: <span>{fmtDate(today)}</span></span>
            </div>
          </div>

          {/* ── DATE-WISE TABLE ── */}
          {tab === 'date' && (
            <>
              <div className="mpr-subhdr">Date-wise Milk Collection Summary — Member / Non-Member with Sales</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="mpr-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Date</th>
                      <th rowSpan={2}>Day</th>
                      <th colSpan={3} className="mem">Member Purchase</th>
                      <th colSpan={3} className="nonmem">Non-Member Purchase</th>
                      <th colSpan={4} className="tot">Total Purchase</th>
                      <th colSpan={2} className="local">Local Sales</th>
                      <th colSpan={2} className="credit">Credit Sales</th>
                      <th colSpan={2} className="school">School Sales</th>
                      <th colSpan={2} className="sample">Sample Sales</th>
                    </tr>
                    <tr>
                      <th className="mem">Nos</th><th className="mem">Qty (L)</th><th className="mem">Amt (₹)</th>
                      <th className="nonmem">Nos</th><th className="nonmem">Qty (L)</th><th className="nonmem">Amt (₹)</th>
                      <th className="tot">Nos</th><th className="tot">Qty (L)</th><th className="tot">Amt (₹)</th><th className="tot">Rate</th>
                      <th className="local">Qty</th><th className="local">Amt (₹)</th>
                      <th className="credit">Qty</th><th className="credit">Amt (₹)</th>
                      <th className="school">Qty</th><th className="school">Amt (₹)</th>
                      <th className="sample">Qty</th><th className="sample">Amt (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.date || i}>
                        <td className="c">{fmtDate(r.date)}</td>
                        <td className="c">{dayName(r.date)}</td>
                        <td className="c" style={{ color: '#14532d', fontWeight: 700 }}>{r.memNos}</td>
                        <td className="r" style={{ color: '#14532d' }}>{fz3(r.memQty)}</td>
                        <td className="r" style={{ color: '#14532d' }}>{fz2(r.memAmt)}</td>
                        <td className="c" style={{ color: '#7c2d12', fontWeight: 700 }}>{r.nonMemNos || ''}</td>
                        <td className="r" style={{ color: '#7c2d12' }}>{fz3(r.nonMemQty)}</td>
                        <td className="r" style={{ color: '#7c2d12' }}>{fz2(r.nonMemAmt)}</td>
                        <td className="c" style={{ fontWeight: 700 }}>{r.totalNos}</td>
                        <td className="r" style={{ fontWeight: 700 }}>{f3(r.totalQty)}</td>
                        <td className="r" style={{ fontWeight: 700 }}>{f2(r.totalAmt)}</td>
                        <td className="r">{f2(r.avgRate)}</td>
                        <td className="r" style={{ color: '#065f46' }}>{fz3(r.localQty)}</td>
                        <td className="r" style={{ color: '#065f46' }}>{fz2(r.localAmt)}</td>
                        <td className="r" style={{ color: '#1e40af' }}>{fz3(r.creditQty)}</td>
                        <td className="r" style={{ color: '#1e40af' }}>{fz2(r.creditAmt)}</td>
                        <td className="r" style={{ color: '#78350f' }}>{fz3(r.schoolQty)}</td>
                        <td className="r" style={{ color: '#78350f' }}>{fz2(r.schoolAmt)}</td>
                        <td className="r" style={{ color: '#4c1d95' }}>{fz3(r.sampleQty)}</td>
                        <td className="r" style={{ color: '#4c1d95' }}>{fz2(r.sampleAmt)}</td>
                      </tr>
                    ))}
                    <tr className="tot-row">
                      <td colSpan={2} className="c">GRAND TOTAL</td>
                      <td className="c">{totals.memNos}</td>
                      <td className="r">{f3(totals.memQty)}</td>
                      <td className="r">{f2(totals.memAmt)}</td>
                      <td className="c">{totals.nonMemNos}</td>
                      <td className="r">{f3(totals.nonMemQty)}</td>
                      <td className="r">{f2(totals.nonMemAmt)}</td>
                      <td className="c">{totals.totalNos}</td>
                      <td className="r">{f3(totals.totalQty)}</td>
                      <td className="r">{f2(totals.totalAmt)}</td>
                      <td className="r">{f2(avgRate)}</td>
                      <td className="r">{f3(totals.localQty)}</td>
                      <td className="r">{f2(totals.localAmt)}</td>
                      <td className="r">{f3(totals.creditQty)}</td>
                      <td className="r">{f2(totals.creditAmt)}</td>
                      <td className="r">{f3(totals.schoolQty)}</td>
                      <td className="r">{f2(totals.schoolAmt)}</td>
                      <td className="r">{f3(totals.sampleQty)}</td>
                      <td className="r">{f2(totals.sampleAmt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary Cards */}
              <div className="mpr-summary">
                {[
                  { label: 'Total Days',     value: rows.length },
                  { label: 'Member Farmers', value: totals.memNos,    sub: `₹${f2(totals.memAmt)}` },
                  { label: 'Non-Member',     value: totals.nonMemNos, sub: `₹${f2(totals.nonMemAmt)}` },
                  { label: 'Total Qty (L)',  value: f3(totals.totalQty) },
                  { label: 'Avg Rate',       value: `₹${f2(avgRate)}` },
                  { label: 'Total Amt (₹)',  value: `₹${f2(totals.totalAmt)}` },
                  { label: 'Local Sales',    value: f3(totals.localQty),  sub: `₹${f2(totals.localAmt)}` },
                  { label: 'Credit Sales',   value: f3(totals.creditQty), sub: `₹${f2(totals.creditAmt)}` },
                  { label: 'School Sales',   value: f3(totals.schoolQty), sub: `₹${f2(totals.schoolAmt)}` },
                  { label: 'Sample Sales',   value: f3(totals.sampleQty), sub: `₹${f2(totals.sampleAmt)}` },
                ].map((c, i) => (
                  <div key={i} className="mpr-card">
                    <span className="mpr-card-label">{c.label}</span>
                    <span className="mpr-card-value">{c.value}</span>
                    {c.sub && <span className="mpr-card-label" style={{ color: '#1a3a6b' }}>{c.sub}</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── FARMER-WISE TABLE ── */}
          {tab === 'farmer' && (
            <>
              <div className="mpr-subhdr">Farmer-wise Milk Collection Summary</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="mpr-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>#</th>
                      <th rowSpan={2}>Type</th>
                      <th rowSpan={2}>Farmer No</th>
                      <th rowSpan={2}>Farmer Name</th>
                      <th colSpan={3}>Sessions</th>
                      <th rowSpan={2}>Qty (L)</th>
                      <th rowSpan={2}>Avg Fat</th>
                      <th rowSpan={2}>Avg CLR</th>
                      <th rowSpan={2}>Avg SNF</th>
                      <th rowSpan={2}>Avg Rate</th>
                      <th rowSpan={2}>Incentive (₹)</th>
                      <th rowSpan={2}>Amount (₹)</th>
                    </tr>
                    <tr>
                      <th>AM</th><th>PM</th><th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.farmerNo || i}>
                        <td className="c">{i + 1}</td>
                        <td className="c" style={{ fontWeight: 700, color: r.isMember ? '#14532d' : '#7c2d12', fontSize: 9 }}>
                          {r.isMember ? 'M' : 'NM'}
                        </td>
                        <td className="c">{r.farmerNo}</td>
                        <td className="nm l">{r.farmerName}</td>
                        <td className="c">{r.amEntries}</td>
                        <td className="c">{r.pmEntries}</td>
                        <td className="c">{r.totalEntries}</td>
                        <td className="r">{f3(r.totalQty)}</td>
                        <td className="c">{f2(r.avgFat)}</td>
                        <td className="c">{f2(r.avgClr || 0)}</td>
                        <td className="c">{f2(r.avgSnf)}</td>
                        <td className="r">{f2(r.avgRate)}</td>
                        <td className="r">{f2(r.totalIncentive)}</td>
                        <td className="r">{f2(r.totalAmount)}</td>
                      </tr>
                    ))}
                    <tr className="tot-row">
                      <td colSpan={2} className="c">TOTAL</td>
                      <td colSpan={2} className="c">{totals.memCount} Member / {totals.nonMemCount} Non-Member</td>
                      <td className="c">{totals.amEntries}</td>
                      <td className="c">{totals.pmEntries}</td>
                      <td className="c">{totals.totalEntries}</td>
                      <td className="r">{f3(totals.totalQty)}</td>
                      <td className="c">—</td><td className="c">—</td><td className="c">—</td>
                      <td className="r">{f2(avgRate)}</td>
                      <td className="r">{f2(totals.totalIncentive)}</td>
                      <td className="r">{f2(totals.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary Cards */}
              <div className="mpr-summary">
                {[
                  { label: 'Total Farmers',  value: rows.length },
                  { label: 'Members',        value: totals.memCount },
                  { label: 'Non-Members',    value: totals.nonMemCount },
                  { label: 'Total Sessions', value: totals.totalEntries },
                  { label: 'Total Qty (L)',  value: f3(totals.totalQty) },
                  { label: 'Avg Rate',       value: `₹${f2(avgRate)}` },
                  { label: 'Incentive (₹)',  value: `₹${f2(totals.totalIncentive)}` },
                  { label: 'Total Amt (₹)', value: `₹${f2(totals.totalAmount)}` },
                ].map((c, i) => (
                  <div key={i} className="mpr-card">
                    <span className="mpr-card-label">{c.label}</span>
                    <span className="mpr-card-value">{c.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mpr-footer">
            <div>
              <div>Society: <strong>{societyName}</strong></div>
              <div>Report Period: <strong>{periodLabel}</strong></div>
              <div>Total Records: <strong>{rows.length}</strong></div>
            </div>
            <div className="mpr-footer-sig">Secretary / Authorized Signatory</div>
          </div>
        </div>
      )}
    </div>
  );
}
