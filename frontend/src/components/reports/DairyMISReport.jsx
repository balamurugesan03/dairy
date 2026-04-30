import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import './DairyMISReport.css';

// ── Formatters ────────────────────────────────────────────────────────────────
const f2   = (v) => Number(v || 0).toFixed(2);
const fN   = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const now = new Date();

// ── Default empty form ────────────────────────────────────────────────────────
const makeDefault = () => ({
  reportDate: '',
  societyName: '',

  section1: {
    totalRegisteredMembers: { members: '', nonMembers: '', total: '' },
    milkPouringMembers:     { members: '', nonMembers: '', total: '' },
    totalMilkPurchaseLtr:   { members: '', nonMembers: '', total: '' },
    totalMilkPurchaseValue: { members: '', nonMembers: '', total: '' },
  },
  section2: {
    nos:          { sc: '', st: '', female: '', male: '', total: '' },
    milkQuantity: { sc: '', st: '', female: '', male: '', total: '' },
  },
  section3: {
    localSales:       { quantity: '', value: '', avgLDay: '' },
    schoolSales:      { quantity: '', value: '', avgLDay: '' },
    productUnitSales: { quantity: '', value: '', avgLDay: '' },
    toDairy:          { quantity: '', value: '', avgLDay: '' },
    fromDairy:        { quantity: '', value: '', avgLDay: '' },
    totalSales:       { quantity: '', value: '', avgLDay: '' },
    milkSalesIncome:  { quantity: '', value: '', avgLDay: '' },
  },
  section4: {
    qualityFromMilma:   { fat: '', snf: '', avgPriceLtr: '' },
    societyWiseQuality: { fat: '', snf: '', avgPriceLtr: '' },
  },
  section5: {
    purchasedThisMonth: { cattleFeeds: '', mineralSales: '', total: '' },
    openingStock:       { cattleFeeds: '', mineralSales: '', total: '' },
    salesThisMonth:     { cattleFeeds: '', mineralSales: '', total: '' },
    closingStock:       { cattleFeeds: '', mineralSales: '', total: '' },
  },
  section6: {
    otherSalesIncome: { lastMonth: '', duringMonth: '', total: '' },
    totalTradeIncome: { lastMonth: '', duringMonth: '', total: '' },
    tradeExpense:     { lastMonth: '', duringMonth: '', total: '' },
    tradeProfitAmt:   { lastMonth: '', duringMonth: '', total: '' },
    tradeProfitPct:   { lastMonth: '', duringMonth: '', total: '' },
    salaryAllowances: { lastMonth: '', duringMonth: '', total: '' },
    otherExpenses:    { lastMonth: '', duringMonth: '', total: '' },
    netProfit:        { lastMonth: '', duringMonth: '', total: '' },
    welfareFund:      { lastMonth: '', duringMonth: '', total: '' },
    welfareFundPaid:  { lastMonth: '', duringMonth: '', total: '' },
    welfareFundDate:  { lastMonth: '', duringMonth: '', total: '' },
  },
  section7: {
    boardMeetingDate:        { lastMonth: '', month: '' },
    numberOfParticipants:    { lastMonth: '', month: '' },
    milkPouringBoardMembers: { lastMonth: '', month: '' },
    milkAbove20L:            { lastMonth: '', month: '' },
    numberOfAgendas:         { lastMonth: '', month: '' },
    numberOfDecisions:       { lastMonth: '', month: '' },
    complaintsReceived:      { lastMonth: '', month: '' },
    solvedComplaints:        { lastMonth: '', month: '' },
    yearOfLastAudit:         { lastMonth: '', month: '' },
    auditClassification:     { lastMonth: '', month: '' },
    dateOfLastElection:      { lastMonth: '', month: '' },
  },
  section8: {
    calibrationDate:    '',
    milkAnalyserDate:   '',
    societyMBRT:        '',
    mastitisDate:       '',
    farmerTrainingDate: '',
    subStandardFarmers: '',
  },
});

// ── Main Component ────────────────────────────────────────────────────────────
export default function DairyMISReport() {
  const navigate = useNavigate();
  const { companyInfo } = useCompany();
  const printRef = useRef();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [form,  setForm]  = useState(makeDefault());
  const [savedId, setSavedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,    setMsg]    = useState({ type: '', text: '' });

  // ── Field setter (deep nested) ────────────────────────────────────────────
  const set = useCallback((section, key, subKey, value) => {
    setForm(prev => {
      if (subKey !== undefined) {
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [key]: { ...prev[section][key], [subKey]: value },
          },
        };
      }
      if (key !== undefined) {
        return { ...prev, [section]: { ...prev[section], [key]: value } };
      }
      return { ...prev, [section]: value };
    });
  }, []);

  const setTop = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // ── Populate helper: API values → display strings (preserves 0) ──────────
  const populate = useCallback((src, def) => {
    if (!src || typeof src !== 'object') return def;
    const out = { ...def };
    Object.keys(def).forEach(k => {
      const v = src[k];
      if (v !== undefined && v !== null) {
        if (typeof def[k] === 'object' && !Array.isArray(def[k])) {
          out[k] = populate(v, def[k]);
        } else {
          // Preserve 0 as '0', not as ''
          out[k] = (v === 0 || v === '0') ? '0' : (v ? String(v) : '');
        }
      }
    });
    return out;
  }, []);

  // ── Load from API ─────────────────────────────────────────────────────────
  const loadFromDB = useCallback(async (silent = false) => {
    setLoading(true);
    if (!silent) setMsg({ type: '', text: '' });
    try {
      const res = await reportAPI.dddMisReport({ month, year });
      if (!res.success) throw new Error(res.message || 'Load failed');
      const d   = res.data;
      const def = makeDefault();
      setSavedId(d._id || null);
      setForm({
        reportDate:  d.reportDate  || '',
        societyName: d.societyName || companyInfo?.companyName || '',
        section1: populate(d.section1, def.section1),
        section2: populate(d.section2, def.section2),
        section3: populate(d.section3, def.section3),
        section4: populate(d.section4, def.section4),
        section5: populate(d.section5, def.section5),
        section6: populate(d.section6, def.section6),
        section7: populate(d.section7, def.section7),
        section8: populate(d.section8, def.section8),
      });
      if (!silent) setMsg({ type: 'ok', text: 'Report data loaded from database.' });
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Failed to load report data.' });
    } finally {
      setLoading(false);
    }
  }, [month, year, populate, companyInfo]);

  // ── Auto-load whenever month or year changes ──────────────────────────────
  useEffect(() => {
    loadFromDB(true);          // silent = no green banner on first load
  }, [month, year]);            // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save to API ───────────────────────────────────────────────────────────
  const saveReport = async () => {
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      const payload = { month, year, ...form };
      let res;
      if (savedId) {
        res = await reportAPI.updateDddMisReport(savedId, payload);
      } else {
        res = await reportAPI.saveDddMisReport(payload);
      }
      if (!res.success) throw new Error(res.message || 'Save failed');
      setSavedId(res.data?._id || savedId);
      setMsg({ type: 'ok', text: 'Report saved successfully.' });
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Save error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>DDD MIS Report</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:9px;color:#000;margin:8mm;padding:0}
        .ddd-hdr{text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:4px}
        .ddd-hdr-line1{font-size:13px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#1a3a6b}
        .ddd-hdr-line2{font-size:11px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase}
        .ddd-info-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border:1px solid #000;border-top:none}
        .ddd-info-cell{padding:2px 5px;border-right:1px solid #000;font-size:8.5px;font-weight:600}
        .ddd-info-cell:last-child{border-right:none}
        .ddd-info-cell input{border:none;outline:none;background:transparent;font-size:8.5px;font-weight:700;color:#000;width:90px}
        .ddd-sec{background:#1a3a6b;color:#fff;font-weight:800;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;padding:3px 6px;text-align:center;border:1px solid #000;margin-top:5px}
        .ddd-sec-red{background:#8b0000;color:#fff;font-weight:800;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;padding:3px 6px;text-align:center;border:1px solid #000;margin-top:5px}
        .ddd-sec-sub{background:#c5d8f5;color:#000;font-weight:700;font-size:9px;text-transform:uppercase;padding:2px 6px;text-align:center;border:1px solid #000;border-top:none}
        table{width:100%;border-collapse:collapse;font-size:8.5px;border:1px solid #000}
        th{background:#d9e8ff;border:1px solid #000;padding:2px 4px;text-align:center;font-weight:800;font-size:8px;text-transform:uppercase;white-space:nowrap}
        th.red{background:#ffe0e0}
        td{border:1px solid #000;padding:1px 3px;font-size:8.5px;color:#000;vertical-align:middle}
        .sl{text-align:center;font-weight:700;width:28px}
        .lbl{text-align:left;font-weight:600}
        .r{text-align:right}
        .c{text-align:center}
        .tot{background:#f0f4ff;font-weight:800}
        .srow{background:#fff8dc;font-weight:700}
        .cell-inp{border:none;outline:none;background:transparent;width:100%;font-size:8.5px;font-family:inherit;color:#000;text-align:inherit;padding:0;min-width:30px}
        .ddd-footer{display:flex;justify-content:space-between;border-top:1.5px solid #000;margin-top:12px;padding-top:8px;font-size:9px}
        .ddd-footer-sig{text-align:right;font-weight:700;font-size:10px;border-top:1px solid #000;padding-top:3px;min-width:140px}
        @page{size:A4 portrait;margin:8mm 10mm}
      </style></head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  // ── Export Excel (TSV) ───────────────────────────────────────────────────
  const exportExcel = () => {
    const rows = [];
    const sep  = '\t';
    const p    = (...cols) => rows.push(cols.join(sep));
    const s    = form;
    const ml   = MONTHS[month - 1];

    p('DAIRY DEVELOPMENT DEPARTMENT');
    p('MANAGEMENT INFORMATION SYSTEM');
    p(`Month: ${ml}`, `Year: ${year}`, `Society: ${s.societyName}`, `Date: ${s.reportDate}`);
    p('');

    // Section 1
    p('Sl No','Item','Members','Non Members','Total');
    [
      ['01','Total Registered Members','section1','totalRegisteredMembers'],
      ['02','Milk Pouring Members','section1','milkPouringMembers'],
      ['03','Total Milk Purchase (Ltr)','section1','totalMilkPurchaseLtr'],
      ['04','Total Milk Purchase Value','section1','totalMilkPurchaseValue'],
    ].forEach(([sl, lbl, sec, key]) =>
      p(sl, lbl, s[sec][key].members, s[sec][key].nonMembers, s[sec][key].total));
    p('');

    // Section 2
    p('Milk Purchase by Category');
    p('','SC','ST','Female','Male','Total');
    p('Nos', s.section2.nos.sc, s.section2.nos.st, s.section2.nos.female, s.section2.nos.male, s.section2.nos.total);
    p('Milk Quantity', s.section2.milkQuantity.sc, s.section2.milkQuantity.st, s.section2.milkQuantity.female, s.section2.milkQuantity.male, s.section2.milkQuantity.total);
    p('');

    // Section 3
    p('Milk Sales');
    p('Sl No','Item','Quantity','Value','Avg L/Day');
    const s3Rows = [
      ['06','Local Sales','localSales'],
      ['07','School & Anganavadi Sales','schoolSales'],
      ['08','Product Unit Sales','productUnitSales'],
      ['09(a)','To Dairy','toDairy'],
      ['09(b)','From Dairy','fromDairy'],
      ['10','Total Sales','totalSales'],
      ['10.1','Milk Sales Income','milkSalesIncome'],
    ];
    s3Rows.forEach(([sl, lbl, key]) =>
      p(sl, lbl, s.section3[key].quantity, s.section3[key].value, s.section3[key].avgLDay));
    p('');

    // Section 4
    p('Milk Quality');
    p('Sl No','Item','FAT','SNF','Avg Price/Ltr');
    p('11','Quality from Milma', s.section4.qualityFromMilma.fat, s.section4.qualityFromMilma.snf, s.section4.qualityFromMilma.avgPriceLtr);
    p('12','Society wise quality', s.section4.societyWiseQuality.fat, s.section4.societyWiseQuality.snf, s.section4.societyWiseQuality.avgPriceLtr);
    p('');

    // Section 5
    p('Other Business');
    p('Sl No','Item','Cattle Feeds','Mineral Sales','Total');
    [
      ['13','Purchased this month','purchasedThisMonth'],
      ['14','Opening Stock','openingStock'],
      ['15','Sales this Month','salesThisMonth'],
      ['16','Closing Stock','closingStock'],
    ].forEach(([sl, lbl, key]) =>
      p(sl, lbl, s.section5[key].cattleFeeds, s.section5[key].mineralSales, s.section5[key].total));
    p('');

    // Section 6
    p('Monthly Balance');
    p('Sl No','Item','Last Month','During The Month','Total');
    const s6Rows = [
      ['17','Other Sales Income','otherSalesIncome'],
      ['18','Total Trade Income','totalTradeIncome'],
      ['19','Trade Expense','tradeExpense'],
      ['19.1(Amt)','Trade Profit - Amount','tradeProfitAmt'],
      ['19.1(%)','Trade Profit - Percentage','tradeProfitPct'],
      ['20','Salary & Allowances','salaryAllowances'],
      ['21','Other Expenses','otherExpenses'],
      ['22','Net Profit','netProfit'],
      ['23','Welfare Fund','welfareFund'],
      ['24','Welfare Fund Paid Amount','welfareFundPaid'],
      ['25','Welfare Fund Paid Date','welfareFundDate'],
    ];
    s6Rows.forEach(([sl, lbl, key]) =>
      p(sl, lbl, s.section6[key].lastMonth, s.section6[key].duringMonth, s.section6[key].total));
    p('');

    // Section 7
    p('Society Board Meeting Details');
    p('Sl No','Item','Last Month','Month');
    const s7Labels = [
      ['1','Board Meeting Date','boardMeetingDate'],
      ['2','Number of participants','numberOfParticipants'],
      ['3','Milk Pouring Board Members','milkPouringBoardMembers'],
      ['4','Milk Pouring Producers above 20 Litres','milkAbove20L'],
      ['5','Number of Agendas','numberOfAgendas'],
      ['6','Number of Decisions made','numberOfDecisions'],
      ['7','Number of complaints received','complaintsReceived'],
      ['8','Number of solved complaints','solvedComplaints'],
      ['9','Year of Last Audit','yearOfLastAudit'],
      ['10','Audit Classification','auditClassification'],
      ['11','Date of Last Election','dateOfLastElection'],
    ];
    s7Labels.forEach(([sl, lbl, key]) =>
      p(sl, lbl, s.section7[key]?.lastMonth || '', s.section7[key]?.month || ''));
    p('');

    // Section 8
    p('Society Milk Testing Details');
    p('Date of Calibration', s.section8.calibrationDate);
    p('Date of Calibration of Milk Analyser', s.section8.milkAnalyserDate);
    p('Society M.B.R.T', s.section8.societyMBRT);
    p('Date of Mastitis control check', s.section8.mastitisDate);
    p('Date of Farmer Training program', s.section8.farmerTrainingDate);
    p('Number of farmers producing sub-standard milk', s.section8.subStandardFarmers);

    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `DDD_MIS_${MONTHS[month - 1]}_${year}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Helpers for input cells ───────────────────────────────────────────────
  const CI = ({ section, rowKey, subKey, right, center }) => (
    <input
      className="cell-inp"
      style={{ textAlign: right ? 'right' : center ? 'center' : 'left' }}
      value={form[section]?.[rowKey]?.[subKey] ?? ''}
      onChange={e => set(section, rowKey, subKey, e.target.value)}
    />
  );

  const CITop = ({ k }) => (
    <input
      className="cell-inp"
      style={{ textAlign: 'left' }}
      value={form[k] ?? ''}
      onChange={e => setTop(k, e.target.value)}
    />
  );

  const CIS8 = ({ k }) => (
    <input
      className="cell-inp"
      value={form.section8?.[k] ?? ''}
      onChange={e => set('section8', k, undefined, e.target.value)}
    />
  );

  const CIS8num = ({ k }) => (
    <input
      className="cell-inp"
      style={{ textAlign: 'right' }}
      value={form.section8?.[k] ?? ''}
      onChange={e => set('section8', k, undefined, e.target.value)}
    />
  );

  const s7set = (key, sub, val) => set('section7', key, sub, val);

  // ── Info row renderer ─────────────────────────────────────────────────────
  const InfoRow = () => (
    <div className="ddd-info-row">
      <div className="ddd-info-cell">Date: <CITop k="reportDate" /></div>
      <div className="ddd-info-cell">Month: <strong>{MONTHS[month - 1]}</strong></div>
      <div className="ddd-info-cell">Society: <CITop k="societyName" /></div>
      <div className="ddd-info-cell">Year: <strong>{year}</strong></div>
    </div>
  );

  const yearOpts = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="ddd-wrap">

      {/* ── Action Bar ── */}
      <div className="ddd-action-bar">
        <button className="ddd-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2 className="ddd-page-title">DDD MIS Report — Dairy Development Department</h2>
        <div className="ddd-action-btns">
          <button className="ddd-btn ddd-btn-print"  onClick={handlePrint}>🖨 Print</button>
          <button className="ddd-btn ddd-btn-excel"  onClick={exportExcel}>⬇ Excel</button>
          <button className="ddd-btn ddd-btn-save"   onClick={saveReport} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* ── Filter Card ── */}
      <div className="ddd-filter-card">
        <div className="ddd-field">
          <label>Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} disabled={loading}>
            {MONTHS.map((ml, i) => <option key={i} value={i + 1}>{ml}</option>)}
          </select>
        </div>
        <div className="ddd-field">
          <label>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} disabled={loading}>
            {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="ddd-btn ddd-btn-load" onClick={() => loadFromDB(false)} disabled={loading}>
            {loading ? '⏳ Loading…' : '🔄 Refresh from DB'}
          </button>
          {loading && <span style={{ fontSize: 11, color: '#555' }}>Fetching dairy data…</span>}
        </div>
      </div>

      {msg.text && (
        <div className={`ddd-msg ddd-msg-${msg.type}`}>{msg.text}</div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          PRINTABLE REPORT BODY
      ════════════════════════════════════════════════════════════════════ */}
      <div style={{ position: 'relative' }}>
        {loading && (
          <div className="ddd-loading-overlay">
            <div className="ddd-loading-box">
              <div className="ddd-spinner" />
              <span>Loading dairy data for {MONTHS[month - 1]} {year}…</span>
            </div>
          </div>
        )}
      <div ref={printRef} className="ddd-report" style={{ opacity: loading ? 0.4 : 1 }}>

        {/* ── HEADER ── */}
        <div className="ddd-hdr">
          <div className="ddd-hdr-line1">Dairy Development Department</div>
          <div className="ddd-hdr-line2">Management Information System</div>
        </div>

        <InfoRow />

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1 — MAIN TABLE
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ddd-sec">Section 1 — Milk Purchase Summary</div>
        <table className="ddd-tbl">
          <thead>
            <tr>
              <th className="ddd-th" style={{ width: 40 }}>Sl No</th>
              <th className="ddd-th" style={{ width: '38%' }}>Item</th>
              <th className="ddd-th">Members</th>
              <th className="ddd-th">Non Members</th>
              <th className="ddd-th">Total</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['01', 'Total Registered Members',   'totalRegisteredMembers'],
              ['02', 'Milk Pouring Members',        'milkPouringMembers'],
              ['03', 'Total Milk Purchase (Ltr)',   'totalMilkPurchaseLtr'],
              ['04', 'Total Milk Purchase Value',   'totalMilkPurchaseValue'],
            ].map(([sl, lbl, key]) => (
              <tr key={key}>
                <td className="ddd-td ddd-td-sl">{sl}</td>
                <td className="ddd-td ddd-td-lbl">{lbl}</td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section1" rowKey={key} subKey="members" right />
                </td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section1" rowKey={key} subKey="nonMembers" right />
                </td>
                <td className="ddd-td ddd-td-num ddd-td-tot">
                  <CI section="section1" rowKey={key} subKey="total" right />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2 — MILK PURCHASE BY CATEGORY
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ddd-sec">Section 2 — Milk Purchase by Category</div>
        <div className="ddd-sec-sub">SC | ST | Female | Male | Total</div>
        <table className="ddd-tbl">
          <thead>
            <tr>
              <th className="ddd-th" style={{ width: '20%' }}>Item</th>
              <th className="ddd-th">SC</th>
              <th className="ddd-th">ST</th>
              <th className="ddd-th">Female</th>
              <th className="ddd-th">Male</th>
              <th className="ddd-th ddd-td-tot">Total</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Nos',           'nos'],
              ['Milk Quantity', 'milkQuantity'],
            ].map(([lbl, key]) => (
              <tr key={key}>
                <td className="ddd-td ddd-td-lbl" style={{ fontWeight: 700 }}>{lbl}</td>
                {['sc','st','female','male'].map(sub => (
                  <td key={sub} className="ddd-td ddd-td-num">
                    <CI section="section2" rowKey={key} subKey={sub} right />
                  </td>
                ))}
                <td className="ddd-td ddd-td-num ddd-td-tot">
                  <CI section="section2" rowKey={key} subKey="total" right />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3 — MILK SALES
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ddd-sec-red">Section 3 — Milk Sales</div>
        <table className="ddd-tbl">
          <thead>
            <tr>
              <th className="ddd-th-red" style={{ width: 40 }}>Sl No</th>
              <th className="ddd-th-red" style={{ width: '40%' }}>Item</th>
              <th className="ddd-th-red">Quantity (Ltr)</th>
              <th className="ddd-th-red">Value (Rs)</th>
              <th className="ddd-th-red">Avg L / Day</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['06',    'Local Sales',                       'localSales',       false],
              ['07',    'School & Anganavadi Sales',         'schoolSales',      false],
              ['08',    'Product Unit Sales',                'productUnitSales', false],
              ['09(a)', 'To Dairy',                         'toDairy',          false],
              ['09(b)', 'From Dairy',                       'fromDairy',        false],
              ['10',    'Total Sales (6+7+8+9b)',            'totalSales',       true],
              ['10.1',  'Milk Sales Income (10 – 4)',        'milkSalesIncome',  true],
            ].map(([sl, lbl, key, isTot]) => (
              <tr key={key}>
                <td className="ddd-td ddd-td-sl">{sl}</td>
                <td className={`ddd-td ddd-td-lbl ${isTot ? 'ddd-td-tot' : ''}`}>{lbl}</td>
                <td className={`ddd-td ddd-td-num ${isTot ? 'ddd-td-tot' : ''}`}>
                  <CI section="section3" rowKey={key} subKey="quantity" right />
                </td>
                <td className={`ddd-td ddd-td-num ${isTot ? 'ddd-td-tot' : ''}`}>
                  <CI section="section3" rowKey={key} subKey="value" right />
                </td>
                <td className={`ddd-td ddd-td-num ${isTot ? 'ddd-td-tot' : ''}`}>
                  <CI section="section3" rowKey={key} subKey="avgLDay" right />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 4 — MILK QUALITY
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ddd-sec">Section 4 — Milk Quality</div>
        <table className="ddd-tbl">
          <thead>
            <tr>
              <th className="ddd-th" style={{ width: 40 }}>Sl No</th>
              <th className="ddd-th" style={{ width: '40%' }}>Item</th>
              <th className="ddd-th">FAT (%)</th>
              <th className="ddd-th">SNF (%)</th>
              <th className="ddd-th">Avg Price / Ltr (Rs)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['11', 'Quality from Milma',    'qualityFromMilma'],
              ['12', 'Society wise quality',  'societyWiseQuality'],
            ].map(([sl, lbl, key]) => (
              <tr key={key}>
                <td className="ddd-td ddd-td-sl">{sl}</td>
                <td className="ddd-td ddd-td-lbl">{lbl}</td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section4" rowKey={key} subKey="fat" right />
                </td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section4" rowKey={key} subKey="snf" right />
                </td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section4" rowKey={key} subKey="avgPriceLtr" right />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 5 — OTHER BUSINESS
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ddd-sec-red">Section 5 — Other Business</div>
        <table className="ddd-tbl">
          <thead>
            <tr>
              <th className="ddd-th-red" style={{ width: 40 }}>Sl No</th>
              <th className="ddd-th-red" style={{ width: '35%' }}>Item</th>
              <th className="ddd-th-red">Cattle Feeds (Rs)</th>
              <th className="ddd-th-red">Mineral Sales (Rs)</th>
              <th className="ddd-th-red">Total (Rs)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['13', 'Purchased this month (Amount)', 'purchasedThisMonth'],
              ['14', 'Opening Stock (Amount)',         'openingStock'],
              ['15', 'Sales this Month (Amount)',      'salesThisMonth'],
              ['16', 'Closing Stock (Amount)',         'closingStock'],
            ].map(([sl, lbl, key]) => (
              <tr key={key}>
                <td className="ddd-td ddd-td-sl">{sl}</td>
                <td className="ddd-td ddd-td-lbl">{lbl}</td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section5" rowKey={key} subKey="cattleFeeds" right />
                </td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section5" rowKey={key} subKey="mineralSales" right />
                </td>
                <td className="ddd-td ddd-td-num ddd-td-tot">
                  <CI section="section5" rowKey={key} subKey="total" right />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 6 — MONTHLY BALANCE
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ddd-sec" style={{ marginTop: 12 }}>Section 6 — Monthly Balance</div>
        <InfoRow />
        <table className="ddd-tbl">
          <thead>
            <tr>
              <th className="ddd-th" style={{ width: 45 }}>Sl No</th>
              <th className="ddd-th" style={{ width: '40%' }}>Item</th>
              <th className="ddd-th">Last Month (Rs)</th>
              <th className="ddd-th">During The Month (Rs)</th>
              <th className="ddd-th">Total (Rs)</th>
            </tr>
          </thead>
          <tbody>

            {[
              ['17',       'Other Sales Income (CF Comm + Inc + BMC Income + Milk Products Commission)', 'otherSalesIncome', false],
              ['18',       'Total Trade Income (10.1 + 17)',    'totalTradeIncome',  false],
              ['19',       'Trade Expense',                     'tradeExpense',      false],
            ].map(([sl, lbl, key, isTot]) => (
              <tr key={key}>
                <td className="ddd-td ddd-td-sl">{sl}</td>
                <td className="ddd-td ddd-td-lbl">{lbl}</td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section6" rowKey={key} subKey="lastMonth" right />
                </td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section6" rowKey={key} subKey="duringMonth" right />
                </td>
                <td className="ddd-td ddd-td-num ddd-td-tot">
                  <CI section="section6" rowKey={key} subKey="total" right />
                </td>
              </tr>
            ))}

            {/* Row 19.1 — Trade Profit (Amount + Percentage sub-rows) */}
            <tr>
              <td className="ddd-td ddd-td-sl" rowSpan={2} style={{ verticalAlign: 'middle' }}>19.1</td>
              <td className="ddd-td ddd-td-lbl ddd-td-srow">Trade Profit (18 – 19) — Amount (Rs)</td>
              <td className="ddd-td ddd-td-num">
                <CI section="section6" rowKey="tradeProfitAmt" subKey="lastMonth" right />
              </td>
              <td className="ddd-td ddd-td-num">
                <CI section="section6" rowKey="tradeProfitAmt" subKey="duringMonth" right />
              </td>
              <td className="ddd-td ddd-td-num ddd-td-tot">
                <CI section="section6" rowKey="tradeProfitAmt" subKey="total" right />
              </td>
            </tr>
            <tr>
              <td className="ddd-td ddd-td-lbl ddd-td-srow">Trade Profit — Percentage (%)</td>
              <td className="ddd-td ddd-td-num">
                <CI section="section6" rowKey="tradeProfitPct" subKey="lastMonth" right />
              </td>
              <td className="ddd-td ddd-td-num">
                <CI section="section6" rowKey="tradeProfitPct" subKey="duringMonth" right />
              </td>
              <td className="ddd-td ddd-td-num ddd-td-tot">
                <CI section="section6" rowKey="tradeProfitPct" subKey="total" right />
              </td>
            </tr>

            {[
              ['20',  'Salary & Allowances',                'salaryAllowances'],
              ['21',  'Other Expenses',                     'otherExpenses'],
              ['22',  'Net Profit (19.1 – 20 – 21)',        'netProfit'],
              ['23',  'Welfare Fund',                       'welfareFund'],
              ['24',  'Welfare Fund Paid Amount',           'welfareFundPaid'],
            ].map(([sl, lbl, key]) => (
              <tr key={key}>
                <td className="ddd-td ddd-td-sl">{sl}</td>
                <td className="ddd-td ddd-td-lbl">{lbl}</td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section6" rowKey={key} subKey="lastMonth" right />
                </td>
                <td className="ddd-td ddd-td-num">
                  <CI section="section6" rowKey={key} subKey="duringMonth" right />
                </td>
                <td className="ddd-td ddd-td-num ddd-td-tot">
                  <CI section="section6" rowKey={key} subKey="total" right />
                </td>
              </tr>
            ))}

            {/* Row 25 — Welfare Fund Paid Date (text) */}
            <tr>
              <td className="ddd-td ddd-td-sl">25</td>
              <td className="ddd-td ddd-td-lbl">Welfare Fund Paid Date</td>
              <td className="ddd-td">
                <CI section="section6" rowKey="welfareFundDate" subKey="lastMonth" />
              </td>
              <td className="ddd-td">
                <CI section="section6" rowKey="welfareFundDate" subKey="duringMonth" />
              </td>
              <td className="ddd-td ddd-td-tot">
                <CI section="section6" rowKey="welfareFundDate" subKey="total" />
              </td>
            </tr>

          </tbody>
        </table>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 7 — BOARD MEETING DETAILS
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ddd-sec" style={{ marginTop: 12 }}>
          Section 7 — Society Board Meeting Details
        </div>
        <table className="ddd-tbl">
          <thead>
            <tr>
              <th className="ddd-th" style={{ width: 40 }}>Sl No</th>
              <th className="ddd-th" style={{ width: '55%' }}>Item</th>
              <th className="ddd-th">Last Month</th>
              <th className="ddd-th">This Month</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['1',  'Board Meeting Date',                                  'boardMeetingDate'],
              ['2',  'Number of Participants',                              'numberOfParticipants'],
              ['3',  'Milk Pouring Board Members',                          'milkPouringBoardMembers'],
              ['4',  'Milk Pouring Producers above 20 Litres',              'milkAbove20L'],
              ['5',  'Number of Agendas',                                   'numberOfAgendas'],
              ['6',  'Number of Decisions made',                            'numberOfDecisions'],
              ['7',  'Number of Complaints Received',                       'complaintsReceived'],
              ['8',  'Number of Solved Complaints',                         'solvedComplaints'],
              ['9',  'Year of Last Audit',                                  'yearOfLastAudit'],
              ['10', 'Audit Classification',                                'auditClassification'],
              ['11', 'Date of Last Election',                               'dateOfLastElection'],
            ].map(([sl, lbl, key]) => (
              <tr key={key}>
                <td className="ddd-td ddd-td-sl">{sl}</td>
                <td className="ddd-td ddd-td-lbl">{lbl}</td>
                <td className="ddd-td ddd-td-ctr">
                  <input
                    className="cell-inp"
                    style={{ textAlign: 'center' }}
                    value={form.section7?.[key]?.lastMonth ?? ''}
                    onChange={e => s7set(key, 'lastMonth', e.target.value)}
                  />
                </td>
                <td className="ddd-td ddd-td-ctr">
                  <input
                    className="cell-inp"
                    style={{ textAlign: 'center' }}
                    value={form.section7?.[key]?.month ?? ''}
                    onChange={e => s7set(key, 'month', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 8 — MILK TESTING DETAILS
        ═══════════════════════════════════════════════════════════════ */}
        <div className="ddd-sec-red" style={{ marginTop: 12 }}>
          Section 8 — Society Milk Testing Details
        </div>
        <InfoRow />
        <table className="ddd-tbl">
          <thead>
            <tr>
              <th className="ddd-th-red" style={{ width: 40 }}>Sl No</th>
              <th className="ddd-th-red" style={{ width: '60%' }}>Item</th>
              <th className="ddd-th-red">Details / Date</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['1', 'Date of Calibration of Lactometer & Butrometer', 'calibrationDate',    false],
              ['2', 'Date of Calibration of Milk Analyser',           'milkAnalyserDate',   false],
              ['3', 'Society M.B.R.T',                                'societyMBRT',        false],
              ['4', 'Date of Mastitis Control Check',                 'mastitisDate',       false],
              ['5', 'Date of Farmer Training Program',                'farmerTrainingDate', false],
              ['6', 'Number of Farmers Producing Sub-Standard Milk',  'subStandardFarmers', true],
            ].map(([sl, lbl, k, isNum]) => (
              <tr key={k}>
                <td className="ddd-td ddd-td-sl">{sl}</td>
                <td className="ddd-td ddd-td-lbl">{lbl}</td>
                <td className={`ddd-td ${isNum ? 'ddd-td-num' : ''}`}>
                  {isNum ? <CIS8num k={k} /> : <CIS8 k={k} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── FOOTER ── */}
        <div className="ddd-footer">
          <div className="ddd-footer-left">
            <div>Place: ____________________</div>
            <div>Date: &nbsp; ____________________</div>
          </div>
          <div className="ddd-footer-sig">Secretary</div>
        </div>

      </div>{/* end .ddd-report */}
      </div>{/* end loading wrapper */}
    </div>
  );
}
