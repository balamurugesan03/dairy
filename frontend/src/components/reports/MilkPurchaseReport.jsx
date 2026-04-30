import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { milkCollectionAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import './MilkPurchaseReport.css';

const fmt2 = v => Number(v || 0).toFixed(2);
const fmt3 = v => Number(v || 0).toFixed(3);
const fmtDate = d => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const dayName = d => {
  if (!d) return '';
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days[new Date(d).getDay()];
};

export default function MilkPurchaseReport() {
  const navigate   = useNavigate();
  const { company } = useCompany();
  const printRef   = useRef(null);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [tab,      setTab]      = useState('farmer');   // 'farmer' | 'date'
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate,   setToDate]   = useState(today);
  const [loading,  setLoading]  = useState(false);
  const [rows,     setRows]     = useState([]);
  const [loaded,   setLoaded]   = useState(false);
  const [errMsg,   setErrMsg]   = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────
  const handleLoad = async () => {
    setLoading(true); setErrMsg(''); setRows([]);
    try {
      const params = { fromDate, toDate };
      const res = tab === 'farmer'
        ? await milkCollectionAPI.getFarmerWiseSummary(params)
        : await milkCollectionAPI.getDateWiseSummary(params);
      if (res?.success) {
        setRows(res.data || []);
        setLoaded(true);
      } else {
        setErrMsg(res?.message || 'Failed to load data');
      }
    } catch (e) {
      setErrMsg(e.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  // ── Tab switch resets data ─────────────────────────────────────────────────
  const switchTab = t => { setTab(t); setRows([]); setLoaded(false); setErrMsg(''); };

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = rows.reduce((acc, r) => {
    if (tab === 'farmer') {
      acc.totalEntries  += r.totalEntries  || 0;
      acc.amEntries     += r.amEntries     || 0;
      acc.pmEntries     += r.pmEntries     || 0;
      acc.totalQty      += r.totalQty      || 0;
      acc.totalIncentive+= r.totalIncentive|| 0;
      acc.totalAmount   += r.totalAmount   || 0;
    } else {
      acc.amNos   += r.amNos   || 0;
      acc.amQty   += r.amQty   || 0;
      acc.amAmt   += r.amAmt   || 0;
      acc.pmNos   += r.pmNos   || 0;
      acc.pmQty   += r.pmQty   || 0;
      acc.pmAmt   += r.pmAmt   || 0;
      acc.totalNos+= r.totalNos|| 0;
      acc.totalQty+= r.totalQty|| 0;
      acc.totalAmt+= r.totalAmt|| 0;
    }
    return acc;
  }, { totalEntries:0, amEntries:0, pmEntries:0, totalQty:0, totalIncentive:0, totalAmount:0,
       amNos:0, amQty:0, amAmt:0, pmNos:0, pmQty:0, pmAmt:0, totalNos:0, totalAmt:0 });

  const avgRate = tab === 'farmer'
    ? (totals.totalQty > 0 ? (totals.totalAmount / totals.totalQty) : 0)
    : (totals.totalQty > 0 ? (totals.totalAmt    / totals.totalQty) : 0);

  const societyName = company?.name || 'Dairy Society';
  const periodLabel = `${fmtDate(fromDate)} to ${fmtDate(toDate)}`;

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Milk Purchase Report</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:10mm 12mm;font-family:Arial,sans-serif;font-size:10px;color:#000}
.mpr-hdr{text-align:center;border-bottom:2.5px double #000;padding-bottom:6px;margin-bottom:0}
.mpr-hdr-dept{font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6b}
.mpr-hdr-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:3px}
.mpr-hdr-meta{display:flex;justify-content:space-between;font-size:9.5px;font-weight:600;margin-top:5px;border-top:1px solid #bbb;padding-top:4px}
.mpr-subhdr{background:#1a3a6b;color:#fff;font-size:9.5px;font-weight:800;text-transform:uppercase;padding:3px 8px;margin-top:5px;text-align:center}
table{width:100%;border-collapse:collapse;font-size:9px;margin-top:0}
thead tr:first-child th{background:#1a3a6b;color:#fff;border:1px solid #000;padding:3px 4px;font-size:9px;font-weight:800;text-align:center;text-transform:uppercase;white-space:nowrap}
thead tr:last-child th{background:#d9e8ff;color:#1a3a6b;border:1px solid #000;padding:2px 4px;font-size:8.5px;font-weight:700;text-align:center;white-space:nowrap}
td{border:1px solid #000;padding:2px 4px;font-size:9px;vertical-align:middle;white-space:nowrap}
td.c{text-align:center} td.r{text-align:right} td.nm{font-weight:600;background:#fafafa}
tr.tot-row td{background:#1a3a6b;color:#fff;font-weight:800;border:1.5px solid #000}
.mpr-summary{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.mpr-card{border:1px solid #000;padding:4px 10px;flex:1;min-width:100px;text-align:center}
.mpr-card-label{font-size:8px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;display:block}
.mpr-card-value{font-size:12px;font-weight:900;color:#1a3a6b;display:block;margin-top:2px}
.mpr-footer{display:flex;justify-content:space-between;border-top:2px solid #000;margin-top:12px;padding-top:8px;font-size:9.5px}
.mpr-footer-sig{text-align:right;font-weight:700;border-top:1px solid #000;padding-top:3px;min-width:150px;align-self:flex-end}
@page{size:A4 portrait;margin:8mm 10mm}
</style></head><body>
${el.innerHTML}
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 350);
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleCSV = () => {
    let csv = '';
    if (tab === 'farmer') {
      csv = 'S.No,Farmer No,Farmer Name,AM Sessions,PM Sessions,Total Sessions,Total Qty (L),Avg Fat,Avg CLR,Avg SNF,Avg Rate,Incentive (₹),Total Amount (₹)\n';
      rows.forEach((r, i) => {
        csv += `${i+1},${r.farmerNo},"${r.farmerName}",${r.amEntries},${r.pmEntries},${r.totalEntries},${fmt3(r.totalQty)},${fmt2(r.avgFat)},${fmt2(r.avgClr||0)},${fmt2(r.avgSnf)},${fmt2(r.avgRate)},${fmt2(r.totalIncentive)},${fmt2(r.totalAmount)}\n`;
      });
      csv += `TOTAL,,,${totals.amEntries},${totals.pmEntries},${totals.totalEntries},${fmt3(totals.totalQty)},,,${fmt2(avgRate)},${fmt2(totals.totalIncentive)},${fmt2(totals.totalAmount)}\n`;
    } else {
      csv = 'Date,Day,AM Nos,AM Qty (L),AM Amt (₹),PM Nos,PM Qty (L),PM Amt (₹),Total Nos,Total Qty (L),Total Amt (₹),Avg Rate\n';
      rows.forEach(r => {
        csv += `${fmtDate(r.date)},${dayName(r.date)},${r.amNos},${fmt3(r.amQty)},${fmt2(r.amAmt)},${r.pmNos},${fmt3(r.pmQty)},${fmt2(r.pmAmt)},${r.totalNos},${fmt3(r.totalQty)},${fmt2(r.totalAmt)},${fmt2(r.avgRate)}\n`;
      });
      csv += `TOTAL,,${totals.amNos},${fmt3(totals.amQty)},${fmt2(totals.amAmt)},${totals.pmNos},${fmt3(totals.pmQty)},${fmt2(totals.pmAmt)},${totals.totalNos},${fmt3(totals.totalQty)},${fmt2(totals.totalAmt)},${fmt2(avgRate)}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `MilkPurchaseReport_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handlePDF = () => {
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 12;

    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.setTextColor(26, 58, 107);
    doc.text(societyName.toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(11); doc.setTextColor(0);
    doc.text('MILK PURCHASE REPORT', pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8); doc.setFont(undefined, 'normal');
    doc.text(`Period: ${periodLabel}`, 14, y);
    doc.text(`Mode: ${tab === 'farmer' ? 'Farmer-wise Summary' : 'Date-wise Summary'}`, pageW - 14, y, { align: 'right' });
    y += 3;
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(14, y, pageW - 14, y);
    y += 4;

    if (tab === 'farmer') {
      autoTable(doc, {
        startY: y,
        head: [['S.No','Farmer No','Farmer Name','AM','PM','Sessions','Qty (L)','Fat','SNF','Rate','Incentive','Amount (₹)']],
        body: [
          ...rows.map((r, i) => [
            i + 1, r.farmerNo, r.farmerName,
            r.amEntries, r.pmEntries, r.totalEntries,
            fmt3(r.totalQty), fmt2(r.avgFat), fmt2(r.avgSnf),
            fmt2(r.avgRate), fmt2(r.totalIncentive), fmt2(r.totalAmount),
          ]),
          ['TOTAL','','', totals.amEntries, totals.pmEntries, totals.totalEntries,
            fmt3(totals.totalQty),'','', fmt2(avgRate), fmt2(totals.totalIncentive), fmt2(totals.totalAmount)],
        ],
        styles:      { fontSize: 7, cellPadding: 1.5, halign: 'center' },
        headStyles:  { fillColor: [26,58,107], textColor: 255, fontStyle: 'bold' },
        columnStyles:{ 2: { halign: 'left' }, 6: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' } },
        bodyStyles:  { textColor: 0 },
        didParseCell: d => {
          if (d.row.index === rows.length) {
            d.cell.styles.fillColor  = [26,58,107];
            d.cell.styles.textColor  = 255;
            d.cell.styles.fontStyle  = 'bold';
          }
        },
      });
    } else {
      autoTable(doc, {
        startY: y,
        head: [['Date','Day','AM Nos','AM Qty','AM Amt','PM Nos','PM Qty','PM Amt','Total Nos','Total Qty','Total Amt','Avg Rate']],
        body: [
          ...rows.map(r => [
            fmtDate(r.date), dayName(r.date),
            r.amNos, fmt3(r.amQty), fmt2(r.amAmt),
            r.pmNos, fmt3(r.pmQty), fmt2(r.pmAmt),
            r.totalNos, fmt3(r.totalQty), fmt2(r.totalAmt), fmt2(r.avgRate),
          ]),
          ['TOTAL','', totals.amNos, fmt3(totals.amQty), fmt2(totals.amAmt),
            totals.pmNos, fmt3(totals.pmQty), fmt2(totals.pmAmt),
            totals.totalNos, fmt3(totals.totalQty), fmt2(totals.totalAmt), fmt2(avgRate)],
        ],
        styles:     { fontSize: 7, cellPadding: 1.5, halign: 'center' },
        headStyles: { fillColor: [26,58,107], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { textColor: 0 },
        didParseCell: d => {
          if (d.row.index === rows.length) {
            d.cell.styles.fillColor = [26,58,107];
            d.cell.styles.textColor = 255;
            d.cell.styles.fontStyle = 'bold';
          }
        },
      });
    }

    doc.save(`MilkPurchaseReport_${fromDate}_${toDate}.pdf`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
        <div className="mpr-field">
          <label>From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="mpr-field">
          <label>To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mpr-tabs">
        <div className={`mpr-tab${tab === 'farmer' ? ' active' : ''}`} onClick={() => switchTab('farmer')}>
          Farmer-wise Summary
        </div>
        <div className={`mpr-tab${tab === 'date' ? ' active' : ''}`} onClick={() => switchTab('date')}>
          Date-wise Summary
        </div>
      </div>

      {errMsg && <div className="mpr-msg mpr-msg-err">{errMsg}</div>}

      {!loaded && !loading && (
        <div className="mpr-empty">Select date range and click <strong>Load</strong> to generate report.</div>
      )}

      {loaded && rows.length === 0 && (
        <div className="mpr-empty">No records found for the selected period.</div>
      )}

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

          {tab === 'farmer' ? (
            <>
              <div className="mpr-subhdr">Farmer-wise Milk Collection Summary</div>
              <table className="mpr-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>S.No</th>
                    <th rowSpan={2}>Farmer No</th>
                    <th rowSpan={2}>Farmer Name</th>
                    <th colSpan={3}>Sessions</th>
                    <th rowSpan={2}>Total Qty (L)</th>
                    <th rowSpan={2}>Avg Fat</th>
                    <th rowSpan={2}>Avg CLR</th>
                    <th rowSpan={2}>Avg SNF</th>
                    <th rowSpan={2}>Avg Rate</th>
                    <th rowSpan={2}>Incentive (₹)</th>
                    <th rowSpan={2}>Total Amt (₹)</th>
                  </tr>
                  <tr>
                    <th>AM</th>
                    <th>PM</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.farmerNo || i}>
                      <td className="sno c">{i + 1}</td>
                      <td className="c">{r.farmerNo}</td>
                      <td className="nm l">{r.farmerName}</td>
                      <td className="c">{r.amEntries}</td>
                      <td className="c">{r.pmEntries}</td>
                      <td className="c">{r.totalEntries}</td>
                      <td className="r">{fmt3(r.totalQty)}</td>
                      <td className="c">{fmt2(r.avgFat)}</td>
                      <td className="c">{fmt2(r.avgClr || 0)}</td>
                      <td className="c">{fmt2(r.avgSnf)}</td>
                      <td className="r">{fmt2(r.avgRate)}</td>
                      <td className="r">{fmt2(r.totalIncentive)}</td>
                      <td className="r">{fmt2(r.totalAmount)}</td>
                    </tr>
                  ))}
                  <tr className="tot-row">
                    <td colSpan={3} className="c">GRAND TOTAL</td>
                    <td className="c">{totals.amEntries}</td>
                    <td className="c">{totals.pmEntries}</td>
                    <td className="c">{totals.totalEntries}</td>
                    <td className="r">{fmt3(totals.totalQty)}</td>
                    <td className="c">—</td>
                    <td className="c">—</td>
                    <td className="c">—</td>
                    <td className="r">{fmt2(avgRate)}</td>
                    <td className="r">{fmt2(totals.totalIncentive)}</td>
                    <td className="r">{fmt2(totals.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Summary Cards */}
              <div className="mpr-summary">
                <div className="mpr-card">
                  <span className="mpr-card-label">Total Farmers</span>
                  <span className="mpr-card-value">{rows.length}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">Total Sessions</span>
                  <span className="mpr-card-value">{totals.totalEntries}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">Total Qty (L)</span>
                  <span className="mpr-card-value">{fmt3(totals.totalQty)}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">Avg Rate</span>
                  <span className="mpr-card-value">₹{fmt2(avgRate)}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">Total Incentive</span>
                  <span className="mpr-card-value">₹{fmt2(totals.totalIncentive)}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">Total Amount</span>
                  <span className="mpr-card-value">₹{fmt2(totals.totalAmount)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mpr-subhdr">Date-wise Milk Collection Summary</div>
              <table className="mpr-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Date</th>
                    <th rowSpan={2}>Day</th>
                    <th colSpan={3}>AM Session</th>
                    <th colSpan={3}>PM Session</th>
                    <th colSpan={3}>Total</th>
                    <th rowSpan={2}>Avg Rate</th>
                  </tr>
                  <tr>
                    <th>Nos</th><th>Qty (L)</th><th>Amt (₹)</th>
                    <th>Nos</th><th>Qty (L)</th><th>Amt (₹)</th>
                    <th>Nos</th><th>Qty (L)</th><th>Amt (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.date || i} className={i % 2 === 0 ? 'am-row' : 'pm-row'}>
                      <td className="c">{fmtDate(r.date)}</td>
                      <td className="c">{dayName(r.date)}</td>
                      <td className="c">{r.amNos}</td>
                      <td className="r">{fmt3(r.amQty)}</td>
                      <td className="r">{fmt2(r.amAmt)}</td>
                      <td className="c">{r.pmNos}</td>
                      <td className="r">{fmt3(r.pmQty)}</td>
                      <td className="r">{fmt2(r.pmAmt)}</td>
                      <td className="c">{r.totalNos}</td>
                      <td className="r">{fmt3(r.totalQty)}</td>
                      <td className="r">{fmt2(r.totalAmt)}</td>
                      <td className="r">{fmt2(r.avgRate)}</td>
                    </tr>
                  ))}
                  <tr className="tot-row">
                    <td colSpan={2} className="c">GRAND TOTAL</td>
                    <td className="c">{totals.amNos}</td>
                    <td className="r">{fmt3(totals.amQty)}</td>
                    <td className="r">{fmt2(totals.amAmt)}</td>
                    <td className="c">{totals.pmNos}</td>
                    <td className="r">{fmt3(totals.pmQty)}</td>
                    <td className="r">{fmt2(totals.pmAmt)}</td>
                    <td className="c">{totals.totalNos}</td>
                    <td className="r">{fmt3(totals.totalQty)}</td>
                    <td className="r">{fmt2(totals.totalAmt)}</td>
                    <td className="r">{fmt2(avgRate)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Summary Cards */}
              <div className="mpr-summary">
                <div className="mpr-card">
                  <span className="mpr-card-label">Total Days</span>
                  <span className="mpr-card-value">{rows.length}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">AM Farmers</span>
                  <span className="mpr-card-value">{totals.amNos}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">PM Farmers</span>
                  <span className="mpr-card-value">{totals.pmNos}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">Total Qty (L)</span>
                  <span className="mpr-card-value">{fmt3(totals.totalQty)}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">Avg Rate</span>
                  <span className="mpr-card-value">₹{fmt2(avgRate)}</span>
                </div>
                <div className="mpr-card">
                  <span className="mpr-card-label">Total Amount</span>
                  <span className="mpr-card-value">₹{fmt2(totals.totalAmt)}</span>
                </div>
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
