import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import './DDDMISReport.css';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const now = new Date();

// ── Empty form skeleton ────────────────────────────────────────────────────────
const makeDefault = () => ({
  reportDate:  '',
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DDDMISReport() {
  const navigate = useNavigate();
  const { companyInfo } = useCompany();
  const printRef = useRef();

  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [form,    setForm]    = useState(makeDefault());
  const [savedId, setSavedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ type: '', text: '' });

  // ── Nested setter ─────────────────────────────────────────────────────────
  const set = useCallback((sec, rk, sk, val) => {
    setForm(prev => ({
      ...prev,
      [sec]: {
        ...prev[sec],
        [rk]: sk !== undefined
          ? { ...prev[sec][rk], [sk]: val }
          : val,
      },
    }));
  }, []);
  const setTop = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // ── Populate API response → string form ───────────────────────────────────
  const populate = useCallback((src, def) => {
    if (!src || typeof src !== 'object') return def;
    const out = { ...def };
    Object.keys(def).forEach(k => {
      const v = src[k];
      if (v !== undefined && v !== null) {
        if (typeof def[k] === 'object' && !Array.isArray(def[k])) {
          out[k] = populate(v, def[k]);
        } else {
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
      const d = res.data, def = makeDefault();
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
      if (!silent) setMsg({ type: 'ok', text: 'Data loaded from database.' });
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Failed to load data.' });
    } finally {
      setLoading(false);
    }
  }, [month, year, populate, companyInfo]);

  useEffect(() => { loadFromDB(true); }, [month, year]); // eslint-disable-line

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveReport = async () => {
    setSaving(true); setMsg({ type: '', text: '' });
    try {
      const payload = { month, year, ...form };
      const res = savedId
        ? await reportAPI.updateDddMisReport(savedId, payload)
        : await reportAPI.saveDddMisReport(payload);
      if (!res.success) throw new Error(res.message || 'Save failed');
      setSavedId(res.data?._id || savedId);
      setMsg({ type: 'ok', text: 'Report saved.' });
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Save error.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>DDD MIS Report</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:8px;color:#000;margin:0;padding:0}
      .hdr{text-align:center;border-bottom:2.5px double #000;padding-bottom:5px;margin-bottom:0}
      .hdr1{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6b}
      .hdr2{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-top:2px}
      .irow{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border:1px solid #000;border-top:none}
      .icell{padding:2px 5px;border-right:1px solid #000;font-size:8px;font-weight:600}
      .icell:last-child{border-right:none}
      .icell input{border:none;background:transparent;font-size:8px;font-weight:700;color:#000;width:80px}
      .stb{background:#1a3a6b;color:#fff;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;padding:3px 6px;text-align:center;border:1px solid #000;margin-top:4px}
      .str{background:#8b0000;color:#fff;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;padding:3px 6px;text-align:center;border:1px solid #000;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:7.5px}
      th{border:1px solid #000;padding:2px 4px;text-align:center;font-weight:800;font-size:7.5px;text-transform:uppercase;white-space:nowrap}
      th.b{background:#d9e8ff} th.r{background:#ffe0e0}
      td{border:1px solid #000;padding:1px 3px;font-size:7.5px;vertical-align:middle;color:#000}
      td.c{text-align:center} td.rv{text-align:right} td.lv{text-align:left} td.fw{font-weight:700}
      td.t{background:#e8f0fe;font-weight:800}
      tr.tr td{background:#e0eaff;font-weight:800;border-top:1.5px solid #000}
      tr.sr td{background:#fffbe6;font-weight:700}
      .ci{border:none;background:transparent;width:100%;font-size:7.5px;font-family:inherit;color:#000;padding:0}
      .ftr{display:flex;justify-content:space-between;border-top:1.5px solid #000;margin-top:8px;padding-top:6px;font-size:8px;font-weight:600}
      .sig{text-align:right;font-weight:700;font-size:9px;border-top:1px solid #000;padding-top:2px;min-width:130px;margin-top:auto}
      @page{size:A4 portrait;margin:7mm 9mm}
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 350);
  };

  // ── Export Excel (TSV) ─────────────────────────────────────────────────────
  const exportExcel = () => {
    const rows = [];
    const p = (...c) => rows.push(c.join('\t'));
    const s = form, ml = MONTHS[month - 1];

    p('DAIRY DEVELOPMENT DEPARTMENT'); p('MANAGEMENT INFORMATION SYSTEM');
    p(`Month: ${ml}`, `Year: ${year}`, `Society: ${s.societyName}`, `Date: ${s.reportDate}`);
    p('');
    p('Sl No','Item','Members','Non Members','Total');
    [
      ['01','Total Registered Members','totalRegisteredMembers'],
      ['02','Milk Pouring Members','milkPouringMembers'],
      ['03','Total Milk Purchase (Ltr)','totalMilkPurchaseLtr'],
      ['04','Total Milk Purchase Value','totalMilkPurchaseValue'],
    ].forEach(([sl,lbl,k]) => p(sl,lbl,s.section1[k].members,s.section1[k].nonMembers,s.section1[k].total));
    p(''); p('MILK PURCHASE BY CATEGORY');
    p('Item','SC','ST','Female','Male','Total');
    p('Nos',s.section2.nos.sc,s.section2.nos.st,s.section2.nos.female,s.section2.nos.male,s.section2.nos.total);
    p('Milk Quantity',s.section2.milkQuantity.sc,s.section2.milkQuantity.st,s.section2.milkQuantity.female,s.section2.milkQuantity.male,s.section2.milkQuantity.total);
    p(''); p('MILK SALES'); p('Sl No','Item','Quantity','Value','Avg L/Day');
    [
      ['06','Local Sales','localSales'],['07','School & Anganavadi Sales','schoolSales'],
      ['08','Product Unit Sales','productUnitSales'],['09(a)','To Dairy','toDairy'],
      ['09(b)','From Dairy','fromDairy'],['10','Total Sales','totalSales'],
      ['10.1','Milk Sales Income','milkSalesIncome'],
    ].forEach(([sl,lbl,k]) => p(sl,lbl,s.section3[k].quantity,s.section3[k].value,s.section3[k].avgLDay));
    p(''); p('MILK QUALITY'); p('Sl No','Item','FAT','SNF','Avg Price/Ltr');
    p('11','Quality from Milma',s.section4.qualityFromMilma.fat,s.section4.qualityFromMilma.snf,s.section4.qualityFromMilma.avgPriceLtr);
    p('12','Society wise quality',s.section4.societyWiseQuality.fat,s.section4.societyWiseQuality.snf,s.section4.societyWiseQuality.avgPriceLtr);
    p(''); p('OTHER BUSINESS'); p('Sl No','Item','Cattle Feeds','Mineral Sales','Total');
    [
      ['13','Purchased this month','purchasedThisMonth'],['14','Opening Stock','openingStock'],
      ['15','Sales this Month','salesThisMonth'],['16','Closing Stock','closingStock'],
    ].forEach(([sl,lbl,k]) => p(sl,lbl,s.section5[k].cattleFeeds,s.section5[k].mineralSales,s.section5[k].total));
    p(''); p('MONTHLY BALANCE'); p('Sl No','Item','Last Month','During Month','Total');
    [
      ['17','Other Sales Income','otherSalesIncome'],['18','Total Trade Income','totalTradeIncome'],
      ['19','Trade Expense','tradeExpense'],['19.1(Amt)','Trade Profit - Amount','tradeProfitAmt'],
      ['19.1(%)','Trade Profit - Percentage','tradeProfitPct'],['20','Salary & Allowances','salaryAllowances'],
      ['21','Other Expenses','otherExpenses'],['22','Net Profit','netProfit'],
      ['23','Welfare Fund','welfareFund'],['24','Welfare Fund Paid Amount','welfareFundPaid'],
      ['25','Welfare Fund Paid Date','welfareFundDate'],
    ].forEach(([sl,lbl,k]) => p(sl,lbl,s.section6[k].lastMonth,s.section6[k].duringMonth,s.section6[k].total));
    p(''); p('BOARD MEETING DETAILS'); p('Sl No','Item','Last Month','This Month');
    [
      ['1','Board Meeting Date','boardMeetingDate'],['2','Number of Participants','numberOfParticipants'],
      ['3','Milk Pouring Board Members','milkPouringBoardMembers'],['4','Milk Pouring Producers above 20 L','milkAbove20L'],
      ['5','Number of Agendas','numberOfAgendas'],['6','Number of Decisions','numberOfDecisions'],
      ['7','Complaints Received','complaintsReceived'],['8','Solved Complaints','solvedComplaints'],
      ['9','Year of Last Audit','yearOfLastAudit'],['10','Audit Classification','auditClassification'],
      ['11','Date of Last Election','dateOfLastElection'],
    ].forEach(([sl,lbl,k]) => p(sl,lbl,s.section7[k]?.lastMonth||'',s.section7[k]?.month||''));
    p(''); p('MILK TESTING DETAILS');
    p('1','Date of Calibration of Lactometer & Butrometer',s.section8.calibrationDate);
    p('2','Date of Calibration of Milk Analyser',s.section8.milkAnalyserDate);
    p('3','Society M.B.R.T',s.section8.societyMBRT);
    p('4','Date of Mastitis Control Check',s.section8.mastitisDate);
    p('5','Date of Farmer Training Program',s.section8.farmerTrainingDate);
    p('6','No. of Farmers Producing Sub-Standard Milk',s.section8.subStandardFarmers);

    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `DDD_MIS_${ml}_${year}.xls`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Input cell helpers ─────────────────────────────────────────────────────
  const CI = ({ sec, rk, sk, align = 'right' }) => (
    <input className="ci" style={{ textAlign: align }}
      value={form[sec]?.[rk]?.[sk] ?? ''}
      onChange={e => set(sec, rk, sk, e.target.value)} />
  );
  const CT = ({ k, width = 100 }) => (
    <input className="ci-top" style={{ width }}
      value={form[k] ?? ''}
      onChange={e => setTop(k, e.target.value)} />
  );
  const C8 = ({ k, align = 'left' }) => (
    <input className="ci" style={{ textAlign: align }}
      value={form.section8?.[k] ?? ''}
      onChange={e => set('section8', k, undefined, e.target.value)} />
  );
  const C7 = ({ k, sub }) => (
    <input className="ci" style={{ textAlign: 'center' }}
      value={form.section7?.[k]?.[sub] ?? ''}
      onChange={e => set('section7', k, sub, e.target.value)} />
  );

  // ── InfoRow (Date / Month / Society / Year) ───────────────────────────────
  const InfoRow = () => (
    <div className="irow">
      <div className="icell"><span className="ilab">Date:</span> <CT k="reportDate" width={88} /></div>
      <div className="icell"><span className="ilab">Month:</span> <strong>{MONTHS[month - 1]}</strong></div>
      <div className="icell"><span className="ilab">Society:</span> <CT k="societyName" width={115} /></div>
      <div className="icell"><span className="ilab">Year:</span> <strong>{year}</strong></div>
    </div>
  );

  const yearOpts = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="ddd-wrap">

      {/* ── Action bar ── */}
      <div className="act-bar">
        <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
        <h2 className="pg-title">DDD MIS Report — Dairy Development Department</h2>
        <div className="act-btns">
          <button className="btn btn-print"   onClick={handlePrint}>🖨 Print</button>
          <button className="btn btn-excel"   onClick={exportExcel}>⬇ Excel</button>
          <button className="btn btn-save"    onClick={saveReport} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="fil-bar">
        <div className="fil-field">
          <label>Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} disabled={loading}>
            {MONTHS.map((ml, i) => <option key={i} value={i + 1}>{ml}</option>)}
          </select>
        </div>
        <div className="fil-field">
          <label>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} disabled={loading}>
            {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn btn-load" onClick={() => loadFromDB(false)} disabled={loading}>
          {loading ? '⏳ Loading…' : '🔄 Refresh from DB'}
        </button>
      </div>

      {msg.text && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}

      {/* ── Report body with loading overlay ── */}
      <div style={{ position: 'relative' }}>
        {loading && (
          <div className="ovl">
            <div className="ovl-box"><span className="spin" /> Loading {MONTHS[month - 1]} {year}…</div>
          </div>
        )}

        <div ref={printRef} className="rpt" style={{ opacity: loading ? 0.35 : 1 }}>

          {/* ════ HEADER ════ */}
          <div className="hdr">
            <div className="hdr1">Dairy Development Department</div>
            <div className="hdr2">Management Information System</div>
          </div>
          <InfoRow />

          {/* ════ SECTION 1 ════ */}
          <div className="stb">Section 1 — Milk Purchase Summary</div>
          <table>
            <thead>
              <tr>
                <th className="b" style={{ width: 44 }}>Sl No</th>
                <th className="b" style={{ width: '38%', textAlign: 'left' }}>Item</th>
                <th className="b">Members</th>
                <th className="b">Non Members</th>
                <th className="b t">Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['01', 'Total Registered Members',          'totalRegisteredMembers', false],
                ['02', 'Milk Pouring Members',               'milkPouringMembers',     false],
                ['03', 'Total Milk Purchase (Ltr)',          'totalMilkPurchaseLtr',   false],
                ['04', 'Total Milk Purchase Value (Rs)',     'totalMilkPurchaseValue', true ],
              ].map(([sl, lbl, k, isTot]) => (
                <tr key={k} className={isTot ? 'tr' : ''}>
                  <td className="c fw">{sl}</td>
                  <td className="lv">{lbl}</td>
                  <td className="rv"><CI sec="section1" rk={k} sk="members"    /></td>
                  <td className="rv"><CI sec="section1" rk={k} sk="nonMembers" /></td>
                  <td className="rv t"><CI sec="section1" rk={k} sk="total"   /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ════ SECTION 2 ════ */}
          <div className="stb">Section 2 — Milk Purchase by Category</div>
          <table>
            <thead>
              <tr>
                <th className="b" style={{ width: '22%', textAlign: 'left' }}>Item</th>
                <th className="b">SC</th>
                <th className="b">ST</th>
                <th className="b">Female</th>
                <th className="b">Male</th>
                <th className="b t">Total</th>
              </tr>
            </thead>
            <tbody>
              {[['Nos', 'nos'], ['Milk Quantity', 'milkQuantity']].map(([lbl, k]) => (
                <tr key={k}>
                  <td className="lv fw">{lbl}</td>
                  {['sc','st','female','male'].map(sub => (
                    <td key={sub} className="rv"><CI sec="section2" rk={k} sk={sub} /></td>
                  ))}
                  <td className="rv t"><CI sec="section2" rk={k} sk="total" /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ════ SECTION 3 ════ */}
          <div className="str">Section 3 — Milk Sales</div>
          <table>
            <thead>
              <tr>
                <th className="r" style={{ width: 50 }}>Sl No</th>
                <th className="r" style={{ width: '40%', textAlign: 'left' }}>Item</th>
                <th className="r">Quantity (Ltr)</th>
                <th className="r">Value (Rs)</th>
                <th className="r">Avg L / Day</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['06',    'Local Sales',                        'localSales',       false],
                ['07',    'School & Anganavadi Sales',          'schoolSales',      false],
                ['08',    'Product Unit Sales',                 'productUnitSales', false],
                ['09(a)', 'To Dairy',                          'toDairy',          false],
                ['09(b)', 'From Dairy',                        'fromDairy',        false],
                ['10',    'Total Sales  (6 + 7 + 8 + 9b)',     'totalSales',       true ],
                ['10.1',  'Milk Sales Income  (10 – 4)',        'milkSalesIncome',  true ],
              ].map(([sl, lbl, k, isTot]) => (
                <tr key={k} className={isTot ? 'tr' : ''}>
                  <td className="c fw">{sl}</td>
                  <td className="lv">{lbl}</td>
                  <td className="rv"><CI sec="section3" rk={k} sk="quantity" /></td>
                  <td className="rv"><CI sec="section3" rk={k} sk="value"    /></td>
                  <td className="rv"><CI sec="section3" rk={k} sk="avgLDay"  /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ════ SECTION 4 ════ */}
          <div className="stb">Section 4 — Milk Quality</div>
          <table>
            <thead>
              <tr>
                <th className="b" style={{ width: 44 }}>Sl No</th>
                <th className="b" style={{ width: '42%', textAlign: 'left' }}>Item</th>
                <th className="b">FAT (%)</th>
                <th className="b">SNF (%)</th>
                <th className="b">Avg Price / Ltr (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['11', 'Quality from Milma',    'qualityFromMilma'],
                ['12', 'Society wise quality',  'societyWiseQuality'],
              ].map(([sl, lbl, k]) => (
                <tr key={k}>
                  <td className="c fw">{sl}</td>
                  <td className="lv">{lbl}</td>
                  <td className="rv"><CI sec="section4" rk={k} sk="fat"         /></td>
                  <td className="rv"><CI sec="section4" rk={k} sk="snf"         /></td>
                  <td className="rv"><CI sec="section4" rk={k} sk="avgPriceLtr" /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ════ SECTION 5 ════ */}
          <div className="str">Section 5 — Other Business</div>
          <table>
            <thead>
              <tr>
                <th className="r" style={{ width: 44 }}>Sl No</th>
                <th className="r" style={{ width: '37%', textAlign: 'left' }}>Item</th>
                <th className="r">Cattle Feeds (Rs)</th>
                <th className="r">Mineral Sales (Rs)</th>
                <th className="r t">Total (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['13', 'Purchased this month (Amount)', 'purchasedThisMonth'],
                ['14', 'Opening Stock (Amount)',         'openingStock'],
                ['15', 'Sales this Month (Amount)',      'salesThisMonth'],
                ['16', 'Closing Stock (Amount)',         'closingStock'],
              ].map(([sl, lbl, k]) => (
                <tr key={k}>
                  <td className="c fw">{sl}</td>
                  <td className="lv">{lbl}</td>
                  <td className="rv"><CI sec="section5" rk={k} sk="cattleFeeds"  /></td>
                  <td className="rv"><CI sec="section5" rk={k} sk="mineralSales" /></td>
                  <td className="rv t"><CI sec="section5" rk={k} sk="total"      /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ════ SECTION 6 ════ */}
          <div className="stb" style={{ marginTop: 10 }}>Section 6 — Monthly Balance</div>
          <InfoRow />
          <table>
            <thead>
              <tr>
                <th className="b" style={{ width: 46 }}>Sl No</th>
                <th className="b" style={{ width: '43%', textAlign: 'left' }}>Item</th>
                <th className="b">Last Month (Rs)</th>
                <th className="b">During Month (Rs)</th>
                <th className="b t">Total (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {/* Rows 17–19 */}
              {[
                ['17', 'Other Sales Income  (CF Comm + Inc + BMC Income + Milk Products Commission)', 'otherSalesIncome'],
                ['18', 'Total Trade Income  (10.1 + 17)',   'totalTradeIncome'],
                ['19', 'Trade Expense',                     'tradeExpense'],
              ].map(([sl, lbl, k]) => (
                <tr key={k}>
                  <td className="c fw">{sl}</td>
                  <td className="lv">{lbl}</td>
                  <td className="rv"><CI sec="section6" rk={k} sk="lastMonth"   /></td>
                  <td className="rv"><CI sec="section6" rk={k} sk="duringMonth" /></td>
                  <td className="rv t"><CI sec="section6" rk={k} sk="total"     /></td>
                </tr>
              ))}

              {/* Row 19.1 — two sub-rows, rowSpan on Sl cell */}
              <tr className="sr">
                <td className="c fw" rowSpan={2} style={{ verticalAlign: 'middle' }}>19.1</td>
                <td className="lv">Trade Profit  (18 – 19) — Amount (Rs)</td>
                <td className="rv"><CI sec="section6" rk="tradeProfitAmt" sk="lastMonth"   /></td>
                <td className="rv"><CI sec="section6" rk="tradeProfitAmt" sk="duringMonth" /></td>
                <td className="rv t"><CI sec="section6" rk="tradeProfitAmt" sk="total"     /></td>
              </tr>
              <tr className="sr">
                <td className="lv">Trade Profit — Percentage (%)</td>
                <td className="rv"><CI sec="section6" rk="tradeProfitPct" sk="lastMonth"   /></td>
                <td className="rv"><CI sec="section6" rk="tradeProfitPct" sk="duringMonth" /></td>
                <td className="rv t"><CI sec="section6" rk="tradeProfitPct" sk="total"     /></td>
              </tr>

              {/* Rows 20–24 */}
              {[
                ['20', 'Salary & Allowances',                'salaryAllowances', false],
                ['21', 'Other Expenses',                     'otherExpenses',    false],
                ['22', 'Net Profit  (19.1 – 20 – 21)',       'netProfit',        true ],
                ['23', 'Welfare Fund',                       'welfareFund',      false],
                ['24', 'Welfare Fund Paid Amount',           'welfareFundPaid',  false],
              ].map(([sl, lbl, k, isTot]) => (
                <tr key={k} className={isTot ? 'tr' : ''}>
                  <td className="c fw">{sl}</td>
                  <td className="lv">{lbl}</td>
                  <td className="rv"><CI sec="section6" rk={k} sk="lastMonth"   /></td>
                  <td className="rv"><CI sec="section6" rk={k} sk="duringMonth" /></td>
                  <td className="rv t"><CI sec="section6" rk={k} sk="total"     /></td>
                </tr>
              ))}

              {/* Row 25 — date text */}
              <tr>
                <td className="c fw">25</td>
                <td className="lv">Welfare Fund Paid Date</td>
                <td><CI sec="section6" rk="welfareFundDate" sk="lastMonth"   align="center" /></td>
                <td><CI sec="section6" rk="welfareFundDate" sk="duringMonth" align="center" /></td>
                <td className="t"><CI sec="section6" rk="welfareFundDate" sk="total" align="center" /></td>
              </tr>
            </tbody>
          </table>

          {/* ════ SECTION 7 ════ */}
          <div className="stb" style={{ marginTop: 10 }}>Section 7 — Society Board Meeting Details</div>
          <table>
            <thead>
              <tr>
                <th className="b" style={{ width: 44 }}>Sl No</th>
                <th className="b" style={{ width: '57%', textAlign: 'left' }}>Item</th>
                <th className="b">Last Month</th>
                <th className="b">This Month</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1',  'Board Meeting Date (Last Month)',               'boardMeetingDate'],
                ['2',  'Number of Participants',                        'numberOfParticipants'],
                ['3',  'Milk Pouring Board Members',                    'milkPouringBoardMembers'],
                ['4',  'Milk Pouring Producers above 20 Litres',       'milkAbove20L'],
                ['5',  'Number of Agendas',                            'numberOfAgendas'],
                ['6',  'Number of Decisions made',                     'numberOfDecisions'],
                ['7',  'Number of Complaints Received',                'complaintsReceived'],
                ['8',  'Number of Solved Complaints',                  'solvedComplaints'],
                ['9',  'Year of Last Audit',                           'yearOfLastAudit'],
                ['10', 'Audit Classification',                         'auditClassification'],
                ['11', 'Date of Last Election',                        'dateOfLastElection'],
              ].map(([sl, lbl, k]) => (
                <tr key={k}>
                  <td className="c fw">{sl}</td>
                  <td className="lv">{lbl}</td>
                  <td className="c"><C7 k={k} sub="lastMonth" /></td>
                  <td className="c"><C7 k={k} sub="month"     /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ════ SECTION 8 ════ */}
          <div className="str" style={{ marginTop: 10 }}>Section 8 — Society Milk Testing Details</div>
          <InfoRow />
          <table>
            <thead>
              <tr>
                <th className="r" style={{ width: 44 }}>Sl No</th>
                <th className="r" style={{ width: '62%', textAlign: 'left' }}>Item</th>
                <th className="r">Details / Date</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1', 'Date of Calibration of Lactometer & Butrometer', 'calibrationDate',    false],
                ['2', 'Date of Calibration of Milk Analyser',           'milkAnalyserDate',   false],
                ['3', 'Society M.B.R.T',                                'societyMBRT',        false],
                ['4', 'Date of Mastitis Control Check',                 'mastitisDate',       false],
                ['5', 'Date of Farmer Training Program',                'farmerTrainingDate', false],
                ['6', 'Number of Farmers Producing Sub-Standard Milk',  'subStandardFarmers', true ],
              ].map(([sl, lbl, k, isNum]) => (
                <tr key={k}>
                  <td className="c fw">{sl}</td>
                  <td className="lv">{lbl}</td>
                  <td className={isNum ? 'rv' : ''}>
                    <C8 k={k} align={isNum ? 'right' : 'left'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ════ FOOTER ════ */}
          <div className="ftr">
            <div className="ftr-l">
              <div>Place: ________________________________</div>
              <div style={{ marginTop: 10 }}>Date: &nbsp;&nbsp; ________________________________</div>
            </div>
            <div className="ftr-sig">Secretary</div>
          </div>

        </div>{/* end .rpt */}
      </div>
    </div>
  );
}
