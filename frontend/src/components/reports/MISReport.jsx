import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import './MISReport.css';

// ── Formatters ──────────────────────────────────────────────────────────────
const n2 = (v) => Number(v || 0).toFixed(2);
const fmtQ = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtA = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (v, d = 2) => Number(v || 0).toFixed(d);
const pct  = (v) => Number(v || 0).toFixed(1) + '%';

const today       = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };
const monthLabel  = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const STORAGE_KEY = 'mis_report_params_v2';

// ── Excel-like export via CSV ─────────────────────────────────────────────────
const exportToExcel = (data, period) => {
  const rows = [];
  const sep = '\t';
  const push = (...cols) => rows.push(cols.join(sep));

  push('MIS REPORT - MILK SOCIETY');
  push('Period:', `${period.startDate?.split('T')[0]} to ${period.endDate?.split('T')[0]}`);
  push('');

  // Section 1
  push('MILK PURCHASE');
  push('Member Type', 'Quantity (Ltr)', 'Value (Rs)', 'Avg Rate/Ltr', 'Avg FAT', 'Avg SNF');
  push('Members',    fmtQ(data.milkPurchase?.members?.qty),    fmtA(data.milkPurchase?.members?.value),    n2(data.milkPurchase?.members?.avgRate),    n2(data.milkPurchase?.members?.avgFat),    n2(data.milkPurchase?.members?.avgSNF));
  push('Non Members',fmtQ(data.milkPurchase?.nonMembers?.qty), fmtA(data.milkPurchase?.nonMembers?.value), n2(data.milkPurchase?.nonMembers?.avgRate), n2(data.milkPurchase?.nonMembers?.avgFat), n2(data.milkPurchase?.nonMembers?.avgSNF));
  push('Total',      fmtQ(data.milkPurchase?.total?.qty),      fmtA(data.milkPurchase?.total?.value),      n2(data.milkPurchase?.total?.avgRate),      n2(data.milkPurchase?.total?.avgFat),      n2(data.milkPurchase?.total?.avgSNF));
  push('');

  // Section 2
  push('DISPOSALS / SALES');
  push('Particulars', 'Quantity (Ltr)', 'Value (Rs)', '%');
  const d = data.disposals || {};
  push('Local Sales',  fmtQ(d.localSales?.qty),  fmtA(d.localSales?.value),  pct(d.localSales?.pct));
  push('Other Sales',  fmtQ(d.otherSales?.qty),  fmtA(d.otherSales?.value),  pct(d.otherSales?.pct));
  push('Products',     fmtQ(d.products?.qty),     fmtA(d.products?.value),    pct(d.products?.pct));
  push('By Product',   fmtQ(d.byProduct?.qty),    fmtA(d.byProduct?.value),   pct(d.byProduct?.pct));
  push('Stock',        fmtQ(d.stock?.qty),         fmtA(d.stock?.value),        '');
  push('Total',        fmtQ(d.total?.qty),         fmtA(d.total?.value),        pct(100));
  push('');
  push('UNION SALES DETAILS');
  push('Received Qty (Ltr)', fmtQ(d.unionDetails?.receivedQty));
  push('Amount (Rs)',         fmtA(d.unionDetails?.amount));
  push('Avg Rate/Ltr',        n2(d.unionDetails?.avgRate));
  push('Avg FAT',             n2(d.unionDetails?.avgFat));
  push('Avg SNF',             n2(d.unionDetails?.avgSNF));
  push('Spoilage',            fmtQ(d.unionDetails?.spoilage));
  push('');

  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `MIS_Report_${period.startDate?.split('T')[0]}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
export default function MISReport() {
  const navigate  = useNavigate();
  const { companyInfo } = useCompany();

  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } })();

  const [fromDate,   setFromDate]   = useState(saved.fromDate   || firstOfMonth());
  const [toDate,     setToDate]     = useState(saved.toDate     || today());
  const [milkCode,   setMilkCode]   = useState(saved.milkCode   || '');
  const [reportDate, setReportDate] = useState(saved.reportDate || '');

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const printRef = useRef();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fromDate, toDate, milkCode, reportDate }));
  }, [fromDate, toDate, milkCode, reportDate]);

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
      <html><head><title>MIS Report</title>
      <style>
        *{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:10mm;padding:0}
        .mis-hdr{text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}
        .mis-hdr-top{font-size:14px;font-weight:bold;letter-spacing:1px}
        .mis-hdr-sub{font-size:11px;font-weight:bold}
        .mis-hdr-row{display:flex;justify-content:space-between;font-size:9px;margin-top:4px}
        .sec-title{background:#d9d9d9;font-weight:bold;font-size:10px;padding:3px 6px;border:1px solid #999;margin-top:6px;text-transform:uppercase;text-align:center}
        table{width:100%;border-collapse:collapse;font-size:9px;margin:0}
        th{background:#e8e8e8;border:1px solid #999;padding:3px 5px;text-align:center;font-weight:bold}
        td{border:1px solid #bbb;padding:2px 5px}
        .r{text-align:right}.c{text-align:center}.b{font-weight:bold}
        .total-row td{background:#f0f0f0;font-weight:bold}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
        .side-box{border:1px solid #999;padding:4px}
        .side-box-title{font-weight:bold;font-size:9px;text-align:center;background:#e8e8e8;border-bottom:1px solid #999;margin:-4px -4px 4px;padding:3px}
        @page{size:A4;margin:10mm}
      </style></head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const d = data;

  return (
    <div className="mis-wrap">
      {/* ── Top Bar ── */}
      <div className="mis-topbar">
        <button className="mis-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2 className="mis-page-title">MIS Report — Milk Society</h2>
        <div className="mis-actions">
          {d && (
            <>
              <button className="mis-btn mis-btn-outline" onClick={handlePrint}>🖨 Print</button>
              <button className="mis-btn mis-btn-excel"  onClick={() => exportToExcel(d, d.period)}>⬇ Excel</button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="mis-filter-card">
        <div className="mis-filter-grid">
          <div className="mis-field">
            <label>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="mis-field">
            <label>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="mis-field">
            <label>Milk Code</label>
            <input value={milkCode} onChange={e => setMilkCode(e.target.value)} placeholder="e.g. 64124" />
          </div>
          <div className="mis-field">
            <label>Report Date</label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
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

          {/* ─── HEADER ─── */}
          <div className="mis-hdr">
            <div className="mis-hdr-top">{companyInfo?.companyName || 'MUKKOLA KSS M 24 (D)'}</div>
            <div className="mis-hdr-sub">Management Information System (MIS)</div>
            <div className="mis-hdr-row">
              <span>Milk Code: <strong>{milkCode || companyInfo?.milkCode || '—'}</strong></span>
              <span>Month &amp; Year: <strong>{monthLabel(fromDate)}</strong></span>
              <span>Date: <strong>{reportDate ? new Date(reportDate).toLocaleDateString('en-IN') : '____________'}</strong></span>
            </div>
          </div>

          {/* ─── SECTION 1: MILK PURCHASE ─── */}
          <div className="sec-title">MILK PURCHASE</div>
          <table className="mis-tbl">
            <thead>
              <tr>
                <Th>Member Type</Th>
                <Th>Quantity (Ltr)</Th>
                <Th>Value (Rs)</Th>
                <Th>Avg Rate / Ltr</Th>
                <Th>Avg FAT</Th>
                <Th>Avg SNF</Th>
              </tr>
            </thead>
            <tbody>
              <PurchRow label="Members"     row={d.milkPurchase?.members}    />
              <PurchRow label="Non Members" row={d.milkPurchase?.nonMembers}  />
              <PurchRow label="Total"       row={d.milkPurchase?.total} total />
            </tbody>
          </table>

          {/* ─── SECTION 2: DISPOSALS / SALES ─── */}
          <div className="sec-title">DISPOSALS / SALES</div>
          <div className="mis-two-col-sales">
            {/* Left: Sales Table */}
            <div>
              <div className="mis-sub-title">UNION SALES</div>
              <table className="mis-tbl">
                <thead>
                  <tr>
                    <Th>Particulars</Th>
                    <Th>Quantity (Ltr)</Th>
                    <Th>Value (Rs)</Th>
                    <Th>%</Th>
                  </tr>
                </thead>
                <tbody>
                  <SalesRow label="Local Sales"  row={d.disposals?.localSales}  />
                  <SalesRow label="Other Sales"  row={d.disposals?.otherSales}  />
                  <SalesRow label="Products"     row={d.disposals?.products}    />
                  <SalesRow label="By Product"   row={d.disposals?.byProduct}   />
                  <SalesRow label="Stock"        row={d.disposals?.stock}       hidePct />
                  <SalesRow label="Total"        row={d.disposals?.total}       total />
                </tbody>
              </table>
            </div>

            {/* Right: Union Details Box */}
            <div className="mis-union-box">
              <div className="mis-union-box-title">Details</div>
              <table className="mis-tbl mis-tbl-inner">
                <tbody>
                  <URow label="Received Qty (Ltr)" value={fmtQ(d.disposals?.unionDetails?.receivedQty)} />
                  <URow label="Amount (Rs)"         value={fmtA(d.disposals?.unionDetails?.amount)} />
                  <URow label="Avg Rate / Ltr"      value={fmtN(d.disposals?.unionDetails?.avgRate)} />
                  <URow label="Avg FAT"             value={fmtN(d.disposals?.unionDetails?.avgFat)} />
                  <URow label="Avg SNF"             value={fmtN(d.disposals?.unionDetails?.avgSNF)} />
                  <URow label="Spoilage"            value={fmtQ(d.disposals?.unionDetails?.spoilage)} />
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── SECTIONS 3 & 4: MILK POURING MEMBERS ─── */}
          <div className="sec-title">MILK POURING MEMBERS — COUNT</div>
          <div className="mis-two-col-equal">
            <div>
              <div className="mis-sub-title">MEMBERS COUNT</div>
              <MemberCountTable data={d.milkPouringCount?.members} />
            </div>
            <div>
              <div className="mis-sub-title">NON-MEMBERS COUNT</div>
              <MemberCountTable data={d.milkPouringCount?.nonMembers} />
            </div>
          </div>

          <div className="sec-title">MILK POURING MEMBERS — QUANTITY (Ltr)</div>
          <div className="mis-two-col-equal">
            <div>
              <div className="mis-sub-title">MEMBERS QTY</div>
              <MemberQtyTable data={d.milkPouringQty?.members} />
            </div>
            <div>
              <div className="mis-sub-title">NON-MEMBERS QTY</div>
              <MemberQtyTable data={d.milkPouringQty?.nonMembers} />
            </div>
          </div>

          {/* ─── SECTION 5: WELFARE FUND ─── */}
          <div className="sec-title">WELFARE FUND CONTRIBUTION</div>
          <table className="mis-tbl">
            <thead>
              <tr>
                <Th>Particulars</Th>
                <Th>Value / Rate</Th>
                <Th>WF Rate</Th>
                <Th>Amount (Rs)</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>Local Sales / Direct Sales / School Sales</Td>
                <Td r>{fmtA(d.welfareFund?.localSales?.value)}</Td>
                <Td r>{fmtN(d.welfareFund?.localSales?.wfRate)}</Td>
                <Td r>{fmtA(d.welfareFund?.localSales?.amount)}</Td>
              </tr>
              <tr>
                <Td>Union Sales</Td>
                <Td r>{fmtA(d.welfareFund?.unionSales?.value)}</Td>
                <Td r>{fmtN(d.welfareFund?.unionSales?.wfRate)}</Td>
                <Td r>{fmtA(d.welfareFund?.unionSales?.amount)}</Td>
              </tr>
              <tr>
                <Td>No of Milk Pouring Producers</Td>
                <Td r>{d.welfareFund?.memberCount?.value}</Td>
                <Td r>{fmtN(d.welfareFund?.memberCount?.wfRate)}</Td>
                <Td r>{fmtA(d.welfareFund?.memberCount?.amount)}</Td>
              </tr>
              <tr className="mis-total-row">
                <Td b>Total</Td>
                <Td />
                <Td />
                <Td r b>{fmtA(d.welfareFund?.total?.amount)}</Td>
              </tr>
            </tbody>
          </table>

          {/* ─── SECTION 6: CATTLE / FEED STOCK ─── */}
          <div className="sec-title">CATTLE / FEED STOCK</div>
          <table className="mis-tbl">
            <thead>
              <tr>
                <Th>Opening Stock (Qty)</Th>
                <Th>Opening Value (Rs)</Th>
                <Th>Purchase Qty</Th>
                <Th>Purchase Amount (Rs)</Th>
                <Th>Sales Qty</Th>
                <Th>Sales Amount (Rs)</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td r>{fmtQ(d.cattleFeedStock?.openingQty)}</Td>
                <Td r>{fmtA(d.cattleFeedStock?.openingValue)}</Td>
                <Td r>{fmtQ(d.cattleFeedStock?.purchaseQty)}</Td>
                <Td r>{fmtA(d.cattleFeedStock?.purchaseAmount)}</Td>
                <Td r>{fmtQ(d.cattleFeedStock?.salesQty)}</Td>
                <Td r>{fmtA(d.cattleFeedStock?.salesAmount)}</Td>
              </tr>
            </tbody>
          </table>

          {/* ─── SECTIONS 7 & 8: FINANCIAL DETAILS + P&L ─── */}
          <div className="mis-two-col-equal" style={{ marginTop: 8 }}>

            {/* Trading A/C */}
            <div>
              <div className="sec-title">FINANCIAL DETAILS (TRADING A/C)</div>
              <table className="mis-tbl">
                <thead>
                  <tr><Th colSpan={2}>Debit</Th><Th colSpan={2}>Credit</Th></tr>
                  <tr><Th>Particulars</Th><Th>Amount</Th><Th>Particulars</Th><Th>Amount</Th></tr>
                </thead>
                <tbody>
                  <tr>
                    <Td>Opening Stock</Td>
                    <Td r>{fmtA(d.tradingAc?.debit?.openingStock)}</Td>
                    <Td>Closing Stock</Td>
                    <Td r>{fmtA(d.tradingAc?.credit?.closingStock)}</Td>
                  </tr>
                  <tr>
                    <Td>Purchases</Td>
                    <Td r>{fmtA(d.tradingAc?.debit?.purchases)}</Td>
                    <Td>Total Sales</Td>
                    <Td r>{fmtA(d.tradingAc?.credit?.totalSales)}</Td>
                  </tr>
                  <tr>
                    <Td b>{d.tradingAc?.debit?.grossProfit > 0 ? 'Gross Profit' : ''}</Td>
                    <Td r b>{d.tradingAc?.debit?.grossProfit > 0 ? fmtA(d.tradingAc?.debit?.grossProfit) : ''}</Td>
                    <Td b>{d.tradingAc?.credit?.grossLoss > 0 ? 'Gross Loss' : 'Total Income'}</Td>
                    <Td r b>{fmtA(d.tradingAc?.credit?.totalIncome || d.tradingAc?.credit?.grossLoss)}</Td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* P&L A/C */}
            <div>
              <div className="sec-title">PROFIT &amp; LOSS A/C</div>
              <table className="mis-tbl">
                <thead>
                  <tr><Th>Particulars</Th><Th>Amount (Rs)</Th></tr>
                </thead>
                <tbody>
                  <tr><Td>Contingencies</Td><Td r>{fmtA(d.profitLoss?.contingencies)}</Td></tr>
                  <tr><Td>Gross Profit</Td><Td r>{fmtA(d.profitLoss?.grossProfit)}</Td></tr>
                  <tr><Td>Miscellaneous Income</Td><Td r>{fmtA(d.profitLoss?.miscIncome)}</Td></tr>
                  <tr className="mis-total-row">
                    <Td b>Net Profit</Td>
                    <Td r b className={d.profitLoss?.netProfit >= 0 ? 'mis-green' : 'mis-red'}>{fmtA(d.profitLoss?.netProfit)}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="mis-footer">
            <div>Generated on {new Date().toLocaleDateString('en-IN')}</div>
            <div style={{ textAlign: 'right' }}>Secretary / Authorised Signatory</div>
          </div>
        </div>
      )}

      {!d && !loading && (
        <div className="mis-empty">
          <div className="mis-empty-icon">📊</div>
          <p>Select date range and click <strong>Generate Report</strong></p>
        </div>
      )}
    </div>
  );
}

// ── Atom Components ──────────────────────────────────────────────────────────

function Th({ children, colSpan }) {
  return <th colSpan={colSpan} className="mis-th">{children}</th>;
}
function Td({ children, r, b, className, colSpan }) {
  return (
    <td colSpan={colSpan} className={['mis-td', r ? 'r' : '', b ? 'b' : '', className || ''].filter(Boolean).join(' ')}>
      {children}
    </td>
  );
}
function URow({ label, value }) {
  return (
    <tr>
      <td className="mis-td">{label}</td>
      <td className="mis-td r"><strong>{value}</strong></td>
    </tr>
  );
}

function PurchRow({ label, row, total }) {
  const cls = total ? 'mis-total-row' : '';
  return (
    <tr className={cls}>
      <Td b={total}>{label}</Td>
      <Td r b={total}>{fmtQ(row?.qty)}</Td>
      <Td r b={total}>{fmtA(row?.value)}</Td>
      <Td r>{fmtN(row?.avgRate)}</Td>
      <Td r>{fmtN(row?.avgFat)}</Td>
      <Td r>{fmtN(row?.avgSNF)}</Td>
    </tr>
  );
}

function SalesRow({ label, row, total, hidePct }) {
  const cls = total ? 'mis-total-row' : '';
  return (
    <tr className={cls}>
      <Td b={total}>{label}</Td>
      <Td r b={total}>{fmtQ(row?.qty)}</Td>
      <Td r b={total}>{fmtA(row?.value)}</Td>
      <Td r>{hidePct ? '—' : (total ? pct(100) : pct(row?.pct))}</Td>
    </tr>
  );
}

const CATS = ['OBC', 'General', 'SC/ST'];

function MemberCountTable({ data }) {
  return (
    <table className="mis-tbl">
      <thead>
        <tr>
          <Th>Category</Th>
          <Th>Male</Th>
          <Th>Female</Th>
          <Th>Total</Th>
        </tr>
      </thead>
      <tbody>
        {CATS.map(cat => (
          <tr key={cat}>
            <Td>{cat}</Td>
            <Td r>{data?.[cat]?.male ?? 0}</Td>
            <Td r>{data?.[cat]?.female ?? 0}</Td>
            <Td r>{data?.[cat]?.total ?? 0}</Td>
          </tr>
        ))}
        <tr className="mis-total-row">
          <Td b>Total</Td>
          <Td r b>{data?.total?.male ?? 0}</Td>
          <Td r b>{data?.total?.female ?? 0}</Td>
          <Td r b>{data?.total?.total ?? 0}</Td>
        </tr>
      </tbody>
    </table>
  );
}

function MemberQtyTable({ data }) {
  return (
    <table className="mis-tbl">
      <thead>
        <tr>
          <Th>Category</Th>
          <Th>Male (Ltr)</Th>
          <Th>Female (Ltr)</Th>
          <Th>Total (Ltr)</Th>
        </tr>
      </thead>
      <tbody>
        {CATS.map(cat => (
          <tr key={cat}>
            <Td>{cat}</Td>
            <Td r>{fmtQ(data?.[cat]?.male)}</Td>
            <Td r>{fmtQ(data?.[cat]?.female)}</Td>
            <Td r>{fmtQ(data?.[cat]?.total)}</Td>
          </tr>
        ))}
        <tr className="mis-total-row">
          <Td b>Total</Td>
          <Td r b>{fmtQ(data?.total?.male)}</Td>
          <Td r b>{fmtQ(data?.total?.female)}</Td>
          <Td r b>{fmtQ(data?.total?.total)}</Td>
        </tr>
      </tbody>
    </table>
  );
}
