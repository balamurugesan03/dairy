import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './MISReport.css';

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtL = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';

const fmtN = (n, dec = 2) => Number(n || 0).toFixed(dec);

const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const STORAGE_KEY = 'mis_report_params';

export default function MISReport() {
  const navigate = useNavigate();
  const { companyInfo } = useCompany();

  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } })();

  const [fromDate,     setFromDate]     = useState(saved.fromDate     || firstOfMonth());
  const [toDate,       setToDate]       = useState(saved.toDate       || today());
  const [reportTitle,  setReportTitle]  = useState(saved.reportTitle  || 'MIS REPORT');
  const [preparedBy,   setPreparedBy]   = useState(saved.preparedBy   || '');
  const [remarks,      setRemarks]      = useState(saved.remarks       || '');

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const printRef = useRef();

  // Persist params
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fromDate, toDate, reportTitle, preparedBy, remarks }));
  }, [fromDate, toDate, reportTitle, preparedBy, remarks]);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportAPI.misReport({ startDate: fromDate, endDate: toDate });
      if (res.success) setData(res.data);
      else setError(res.message || 'Failed to load report');
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>${reportTitle}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 20px; }
        h1 { text-align: center; font-size: 16px; margin-bottom: 2px; }
        h2 { text-align: center; font-size: 13px; margin: 0 0 4px; font-weight: normal; }
        .period { text-align: center; font-size: 11px; color: #444; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        th { background: #dde3ec; font-size: 11px; text-transform: uppercase; padding: 5px 8px; border: 1px solid #999; text-align: left; }
        td { padding: 4px 8px; border: 1px solid #ccc; font-size: 11px; }
        .section-head td { background: #ecf0f7; font-weight: bold; font-size: 12px; }
        .total-row td { background: #f5f7fa; font-weight: bold; }
        .right { text-align: right; }
        .footer { margin-top: 20px; font-size: 10px; color: #666; display: flex; justify-content: space-between; }
        @media print { body { margin: 10px; } }
      </style></head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleExportPDF = () => {
    if (!data) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const m = 14;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo?.companyName || 'Company Name', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(12);
    doc.text(reportTitle, pageW / 2, 25, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${fromDate} to ${toDate}`, pageW / 2, 31, { align: 'center' });
    doc.line(m, 34, pageW - m, 34);

    let y = 38;

    const addSection = (title, rows) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title, m, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Particulars', 'Value']],
        body: rows,
        margin: { left: m, right: m },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [221, 227, 236], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
        theme: 'grid'
      });
      y = doc.lastAutoTable.finalY + 6;
    };

    const { milkProcurement: mp, milkSales: ms, farmerSummary: fs,
            paymentSummary: ps, financialSummary: fin, stockSummary: ss, ratios: r } = data;

    addSection('1. MILK PROCUREMENT', [
      ['Total Milk Received', fmtL(mp.totalQty)],
      ['Morning Session', fmtL(mp.morningQty)],
      ['Evening Session', fmtL(mp.eveningQty)],
      ['Average Fat', fmtN(mp.avgFat) + ' %'],
      ['Average SNF', fmtN(mp.avgSNF) + ' %'],
      ['Average Rate', fmt(mp.avgRate) + ' /L'],
      ['Total Procurement Amount', fmt(mp.totalAmount)],
      ['Active Suppliers', String(mp.activeFarmers)]
    ]);

    addSection('2. MILK SALES', [
      ['Total Milk Sold', fmtL(ms.totalLitre)],
      ['Local Sales', fmtL(ms.bySaleMode?.LOCAL?.litre || 0) + '   ' + fmt(ms.bySaleMode?.LOCAL?.amount || 0)],
      ['Credit Sales', fmtL(ms.bySaleMode?.CREDIT?.litre || 0) + '   ' + fmt(ms.bySaleMode?.CREDIT?.amount || 0)],
      ['Sample Sales', fmtL(ms.bySaleMode?.SAMPLE?.litre || 0) + '   ' + fmt(ms.bySaleMode?.SAMPLE?.amount || 0)],
      ['Total Sales Amount', fmt(ms.totalAmount)],
      ['Net Revenue (Sales − Procurement)', fmt(r.netRevenue)]
    ]);

    addSection('3. FARMER / MEMBER SUMMARY', [
      ['Total Registered Members', String(fs.totalRegistered)],
      ['Active Suppliers (this period)', String(fs.activeSuppliers)],
      ['Farmers Paid (this period)', String(fs.farmersPaid)]
    ]);

    addSection('4. PAYMENT SUMMARY', [
      ['Gross Amount', fmt(ps.grossAmount)],
      ['Total Deductions', fmt(ps.totalDeductions)],
      ['Net Payable', fmt(ps.netPayable)],
      ['Amount Paid', fmt(ps.paidAmount)],
      ['Pending Amount', fmt(ps.pendingAmount)]
    ]);

    addSection('5. FINANCIAL SUMMARY', [
      ['Total Receipts', fmt(fin.totalReceipts)],
      ['Total Payments', fmt(fin.totalPayments)],
      ['Net Cash Position', fmt(fin.netCash)]
    ]);

    addSection('6. STOCK SUMMARY', [
      ['Total Items in Stock', String(ss.totalItems)],
      ['Total Stock Value', fmt(ss.totalStockValue)]
    ]);

    addSection('7. KEY RATIOS', [
      ['Procurement as % of Sales', fmtN(r.procurementPct) + ' %'],
      ['Payment as % of Procurement', fmtN(r.paymentPct) + ' %']
    ]);

    if (preparedBy || remarks) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      if (preparedBy) doc.text(`Prepared by: ${preparedBy}`, m, y);
      if (remarks)    doc.text(`Remarks: ${remarks}`, m, y + 5);
    }

    doc.save(`MIS_Report_${fromDate}_${toDate}.pdf`);
  };

  const d = data;

  return (
    <div className="mis-wrap">
      {/* ── Top Bar ── */}
      <div className="mis-topbar">
        <button className="mis-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2 className="mis-page-title">MIS Report</h2>
        <div className="mis-actions">
          {d && (
            <>
              <button className="mis-btn mis-btn-outline" onClick={handlePrint}>🖨 Print</button>
              <button className="mis-btn mis-btn-primary" onClick={handleExportPDF}>⬇ PDF</button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="mis-filter-card">
        <div className="mis-filter-grid">
          <div className="mis-field">
            <label>Report Title</label>
            <input value={reportTitle} onChange={e => setReportTitle(e.target.value)} />
          </div>
          <div className="mis-field">
            <label>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="mis-field">
            <label>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="mis-field">
            <label>Prepared By</label>
            <input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="Name / Designation" />
          </div>
          <div className="mis-field mis-field-wide">
            <label>Remarks</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional remarks" />
          </div>
        </div>
        <div className="mis-filter-footer">
          <div className="mis-quick-btns">
            <button onClick={() => { const d = new Date(); setFromDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setToDate(d.toISOString().split('T')[0]); }}>This Month</button>
            <button onClick={() => { const d = new Date(); setFromDate(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]); setToDate(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]); }}>Last Month</button>
            <button onClick={() => { const d = new Date(); const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; setFromDate(`${fy}-04-01`); setToDate(`${fy + 1}-03-31`); }}>This FY</button>
          </div>
          <button className="mis-btn mis-btn-generate" onClick={fetchReport} disabled={loading}>
            {loading ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && <div className="mis-error">{error}</div>}

      {/* ── Report Body ── */}
      {d && (
        <div ref={printRef} className="mis-report-body">

          {/* Report Header */}
          <div className="mis-report-header">
            <div className="mis-company-name">{companyInfo?.companyName || 'Company Name'}</div>
            <div className="mis-report-title">{reportTitle}</div>
            <div className="mis-report-period">Period: {fromDate} &nbsp;to&nbsp; {toDate}</div>
            {(companyInfo?.address || companyInfo?.district) && (
              <div className="mis-report-addr">{[companyInfo.address, companyInfo.district, companyInfo.state].filter(Boolean).join(', ')}</div>
            )}
          </div>

          {/* ── Summary Cards ── */}
          <div className="mis-summary-row">
            <SummaryCard label="Total Milk Purchased" value={fmtL(d.milkProcurement.totalQty)} sub={fmt(d.milkProcurement.totalAmount)} color="blue" />
            <SummaryCard label="Total Milk Sold" value={fmtL(d.milkSales.totalLitre)} sub={fmt(d.milkSales.totalAmount)} color="green" />
            <SummaryCard label="Net Revenue" value={fmt(d.ratios.netRevenue)} sub="Sales − Procurement" color={d.ratios.netRevenue >= 0 ? 'teal' : 'red'} />
            <SummaryCard label="Total Payments" value={fmt(d.paymentSummary.netPayable)} sub={`Paid: ${fmt(d.paymentSummary.paidAmount)}`} color="orange" />
          </div>

          {/* ── Section 1: Milk Procurement ── */}
          <Section title="1. Milk Procurement Summary">
            <table className="mis-table">
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th className="right">Morning (AM)</th>
                  <th className="right">Evening (PM)</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Quantity (Litres)</td>
                  <td className="right">{fmtL(d.milkProcurement.morningQty)}</td>
                  <td className="right">{fmtL(d.milkProcurement.eveningQty)}</td>
                  <td className="right bold">{fmtL(d.milkProcurement.totalQty)}</td>
                </tr>
                <tr>
                  <td>Average Fat (%)</td>
                  <td className="right">—</td>
                  <td className="right">—</td>
                  <td className="right">{fmtN(d.milkProcurement.avgFat)} %</td>
                </tr>
                <tr>
                  <td>Average SNF (%)</td>
                  <td className="right">—</td>
                  <td className="right">—</td>
                  <td className="right">{fmtN(d.milkProcurement.avgSNF)} %</td>
                </tr>
                <tr>
                  <td>Average Rate (₹/L)</td>
                  <td className="right">—</td>
                  <td className="right">—</td>
                  <td className="right">{fmt(d.milkProcurement.avgRate)}</td>
                </tr>
                <tr className="total-row">
                  <td>Total Procurement Amount</td>
                  <td className="right">—</td>
                  <td className="right">—</td>
                  <td className="right bold">{fmt(d.milkProcurement.totalAmount)}</td>
                </tr>
                <tr>
                  <td>Active Suppliers</td>
                  <td className="right">—</td>
                  <td className="right">—</td>
                  <td className="right">{d.milkProcurement.activeFarmers} farmers</td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ── Section 2: Milk Sales ── */}
          <Section title="2. Milk Sales Summary">
            <table className="mis-table">
              <thead>
                <tr>
                  <th>Sale Mode</th>
                  <th className="right">Quantity (L)</th>
                  <th className="right">Amount (₹)</th>
                  <th className="right">Avg Rate (₹/L)</th>
                </tr>
              </thead>
              <tbody>
                {['LOCAL', 'CREDIT', 'SAMPLE'].map(mode => {
                  const row = d.milkSales.bySaleMode?.[mode] || { litre: 0, amount: 0 };
                  const ar  = row.litre > 0 ? row.amount / row.litre : 0;
                  return (
                    <tr key={mode}>
                      <td>{mode} Sales</td>
                      <td className="right">{fmtL(row.litre)}</td>
                      <td className="right">{fmt(row.amount)}</td>
                      <td className="right">{fmt(ar)}</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td>Total</td>
                  <td className="right bold">{fmtL(d.milkSales.totalLitre)}</td>
                  <td className="right bold">{fmt(d.milkSales.totalAmount)}</td>
                  <td className="right bold">
                    {fmt(d.milkSales.totalLitre > 0 ? d.milkSales.totalAmount / d.milkSales.totalLitre : 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ── Section 3 & 4: Farmer + Payment ── */}
          <div className="mis-two-col">
            <Section title="3. Farmer / Member Summary">
              <table className="mis-table">
                <tbody>
                  <LRow label="Total Registered Members" value={d.farmerSummary.totalRegistered} />
                  <LRow label="Active Suppliers (this period)" value={d.farmerSummary.activeSuppliers} />
                  <LRow label="Farmers Paid (this period)" value={d.farmerSummary.farmersPaid} />
                </tbody>
              </table>
            </Section>

            <Section title="4. Payment Summary">
              <table className="mis-table">
                <tbody>
                  <LRow label="Gross Amount" value={fmt(d.paymentSummary.grossAmount)} />
                  <LRow label="Total Deductions" value={fmt(d.paymentSummary.totalDeductions)} />
                  <LRow label="Net Payable" value={fmt(d.paymentSummary.netPayable)} bold />
                  <LRow label="Amount Paid" value={fmt(d.paymentSummary.paidAmount)} />
                  <LRow label="Pending Amount" value={fmt(d.paymentSummary.pendingAmount)}
                    valueClass={d.paymentSummary.pendingAmount > 0 ? 'red' : 'green'} />
                </tbody>
              </table>
            </Section>
          </div>

          {/* ── Section 5 & 6: Financial + Stock ── */}
          <div className="mis-two-col">
            <Section title="5. Financial Summary (Cash / Bank)">
              <table className="mis-table">
                <tbody>
                  <LRow label="Total Receipts" value={fmt(d.financialSummary.totalReceipts)} valueClass="green" />
                  <LRow label="Total Payments" value={fmt(d.financialSummary.totalPayments)} valueClass="red" />
                  <LRow label="Net Cash Position" value={fmt(d.financialSummary.netCash)}
                    bold valueClass={d.financialSummary.netCash >= 0 ? 'green' : 'red'} />
                </tbody>
              </table>
            </Section>

            <Section title="6. Stock Summary">
              <table className="mis-table">
                <tbody>
                  <LRow label="Total Items in Stock" value={d.stockSummary.totalItems} />
                  <LRow label="Total Stock Value" value={fmt(d.stockSummary.totalStockValue)} bold />
                </tbody>
              </table>
            </Section>
          </div>

          {/* ── Section 7: Key Ratios ── */}
          <Section title="7. Key Performance Ratios">
            <table className="mis-table">
              <thead>
                <tr>
                  <th>Ratio</th>
                  <th className="right">Value</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Procurement Cost Ratio</td>
                  <td className="right">{fmtN(d.ratios.procurementPct)} %</td>
                  <td>Procurement as % of Total Sales</td>
                </tr>
                <tr>
                  <td>Payment Disbursement Ratio</td>
                  <td className="right">{fmtN(d.ratios.paymentPct)} %</td>
                  <td>Payments as % of Procurement</td>
                </tr>
                <tr className="total-row">
                  <td>Net Revenue</td>
                  <td className={`right bold ${d.ratios.netRevenue >= 0 ? 'green' : 'red'}`}>{fmt(d.ratios.netRevenue)}</td>
                  <td>Sales Amount − Procurement Amount</td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Footer */}
          <div className="mis-footer">
            <div>{preparedBy ? `Prepared by: ${preparedBy}` : ''}</div>
            <div>{remarks ? `Remarks: ${remarks}` : ''}</div>
            <div className="mis-footer-right">Generated on {new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>
      )}

      {!d && !loading && (
        <div className="mis-empty">
          <div className="mis-empty-icon">📊</div>
          <p>Configure the filters above and click <strong>Generate Report</strong></p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className={`mis-card mis-card-${color}`}>
      <div className="mis-card-label">{label}</div>
      <div className="mis-card-value">{value}</div>
      <div className="mis-card-sub">{sub}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mis-section">
      <div className="mis-section-head">{title}</div>
      {children}
    </div>
  );
}

function LRow({ label, value, bold, valueClass }) {
  return (
    <tr>
      <td>{label}</td>
      <td className={`right${bold ? ' bold' : ''}${valueClass ? ' ' + valueClass : ''}`}>{value}</td>
    </tr>
  );
}
