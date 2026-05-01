import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import './InspectionReport.css';

const TODAY = new Date().toISOString().slice(0, 10);

const makeDefault = () => ({
  district:                      '',
  society:                       '',
  dairyDevelopmentUnit:          '',
  nameOfSociety:                 '',
  dateOfInspection:              TODAY,
  membersMillingCount:           '',
  membersMilkQty:                '',
  nonMembersMillingCount:        '',
  nonMembersMilkQty:             '',
  nonMembersMilkPrice:           '',
  totalMilkQty:                  '',
  totalMilkAmount:               '',
  scStFarmersCount:              '',
  scStMilkQty:                   '',
  localSalesQty:                 '',
  localSalesPrice:               '',
  schoolSalesQty:                '',
  schoolSalesPrice:              '',
  productionUnitQty:             '',
  productionUnitPrice:           '',
  dairySalesQty:                 '',
  dairySalesPrice:               '',
  totalSalesQty:                 '',
  totalSalesAmount:              '',
  milkShortfallExcess:           '',
  dailyProfitMilkTrading:        '',
  cashBalanceAsOnDate:           '',
  bankBalancePreviousMonth:      '',
  cattleFeedAdvanceOutstanding:  '',
  producerDueAmountOutstanding:  '',
});

const n = (v) => parseFloat(v) || 0;
const fmt = (v) => {
  const num = parseFloat(v);
  if (isNaN(num)) return '';
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
};

export default function InspectionReport() {
  const navigate    = useNavigate();
  const { companyInfo } = useCompany();
  const printRef    = useRef();

  const [form,    setForm]    = useState(makeDefault);
  const [savedId, setSavedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ type: '', text: '' });

  const setF = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), []);

  // ── Auto-calculations ───────────────────────────────────────────────────────
  useEffect(() => {
    const totalMilkQty   = fmt(n(form.membersMilkQty) + n(form.nonMembersMilkQty));
    const totalMilkAmount= fmt(n(form.nonMembersMilkQty) * n(form.nonMembersMilkPrice));

    const totalSalesQty    = fmt(
      n(form.localSalesQty) + n(form.schoolSalesQty) +
      n(form.productionUnitQty) + n(form.dairySalesQty)
    );
    const totalSalesAmount = fmt(
      n(form.localSalesPrice) + n(form.schoolSalesPrice) +
      n(form.productionUnitPrice) + n(form.dairySalesPrice)
    );

    const milkShortfallExcess   = fmt(n(totalMilkQty) - n(totalSalesQty));
    const dailyProfitMilkTrading= fmt(n(totalSalesAmount) - n(totalMilkAmount));

    setForm(prev => ({
      ...prev,
      totalMilkQty,
      totalMilkAmount,
      totalSalesQty,
      totalSalesAmount,
      milkShortfallExcess,
      dailyProfitMilkTrading,
    }));
  }, [
    form.membersMilkQty, form.nonMembersMilkQty, form.nonMembersMilkPrice,
    form.localSalesQty,  form.localSalesPrice,
    form.schoolSalesQty, form.schoolSalesPrice,
    form.productionUnitQty, form.productionUnitPrice,
    form.dairySalesQty,  form.dairySalesPrice,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Populate API data into form ─────────────────────────────────────────────
  const populate = useCallback((src) => {
    const def = makeDefault();
    if (!src) return def;
    const out = { ...def };
    Object.keys(def).forEach(k => {
      if (src[k] !== undefined && src[k] !== null) {
        out[k] = k === 'dateOfInspection'
          ? String(src[k]).slice(0, 10)
          : (src[k] === 0 ? '0' : String(src[k]));
      }
    });
    return out;
  }, []);

  // ── Load from API (auto-populates from dairy data) ─────────────────────────
  const loadFromDB = useCallback(async (silent = false) => {
    if (!form.dateOfInspection) return;
    setLoading(true);
    if (!silent) setMsg({ type: '', text: '' });
    try {
      const res = await reportAPI.getInspectionReport({ date: form.dateOfInspection });
      if (!res.success) throw new Error(res.message || 'Load failed');
      const loaded = populate(res.data);
      setSavedId(res.data?._id || null);
      setForm(prev => ({
        ...loaded,
        // Preserve user-typed district/society; fall back to API value if empty
        district: prev.district || loaded.district,
        society:  prev.society  || loaded.society,
      }));
      if (!silent) {
        const hasSaved = !!res.data?._id;
        setMsg({
          type: 'ok',
          text: hasSaved
            ? 'Data loaded from saved report (dairy data merged).'
            : 'Dairy data auto-populated for this date. Review and save.',
        });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Failed to load data.' });
    } finally {
      setLoading(false);
    }
  }, [form.dateOfInspection, populate]);

  // Auto-load whenever date changes
  useEffect(() => { loadFromDB(true); }, [form.dateOfInspection]); // eslint-disable-line

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveReport = async () => {
    if (!form.dateOfInspection) {
      setMsg({ type: 'err', text: 'Please select a date of inspection.' });
      return;
    }
    setSaving(true); setMsg({ type: '', text: '' });
    try {
      const payload = { ...form };
      const res = savedId
        ? await reportAPI.updateInspectionReport(savedId, payload)
        : await reportAPI.saveInspectionReport(payload);
      if (!res.success) throw new Error(res.message || 'Save failed');
      setSavedId(res.data?._id || savedId);
      setMsg({ type: 'ok', text: 'Report saved successfully.' });
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Save error.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Inspection Report</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:9px;color:#000;margin:0;padding:0}
      .insp-hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px double #000;padding-bottom:8px;margin-bottom:0}
      .insp-hdr-left{flex:1}
      .insp-dept{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6b}
      .insp-report-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#000;margin-top:5px;text-align:center;border-top:1px solid #aaa;padding-top:4px}
      .insp-hdr-right{display:flex;flex-direction:column;gap:4px;min-width:200px}
      .insp-hdr-field{display:flex;align-items:center;gap:5px;border:1px solid #000;padding:2px 6px}
      .insp-hdr-field label{font-size:9px;font-weight:700;white-space:nowrap;min-width:45px;color:#333}
      .insp-hdr-field input{border:none;border-bottom:1px solid #666;font-size:9px;font-weight:700;font-family:inherit;color:#000;background:transparent;width:100%;padding:0 1px}
      .insp-table{width:100%;border-collapse:collapse;font-size:8.5px}
      .insp-table th{border:1px solid #000;padding:3px 5px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;text-align:center;background:#1a3a6b;color:#fff}
      .insp-table td{border:1px solid #000;padding:1.5px 5px;vertical-align:middle;color:#000;font-size:8.5px}
      td.sno{text-align:center;font-weight:700;width:35px;background:#f8f8f8;font-size:8px;color:#333}
      td.lbl{font-weight:600;width:60%;background:#fafafa}
      td.val{width:30%;background:#fff}
      td.val-db{width:30%;background:#eff6ff}
      td.val-auto{width:30%;background:#fffbeb}
      td.val-calc{width:30%;background:#e8f4e8}
      tr.sec-hdr td{background:#d9e8ff;font-weight:800;font-size:8.5px;text-transform:uppercase;color:#1a3a6b;border-top:2px solid #1a3a6b;padding:3px 6px}
      tr.sec-hdr-red td{background:#ffe0e0;font-weight:800;font-size:8.5px;text-transform:uppercase;color:#7b1a1a;border-top:2px solid #8b0000;padding:3px 6px}
      tr.sec-hdr-green td{background:#e0f0e0;font-weight:800;font-size:8.5px;text-transform:uppercase;color:#155724;border-top:2px solid #155724;padding:3px 6px}
      .insp-ci,.insp-ci-ro,.insp-ci-profit,.insp-ci-text,.insp-ci-date{border:none;background:transparent;width:100%;font-size:8.5px;font-family:inherit;color:#000;padding:0;text-align:right}
      .insp-ci-text{text-align:left}
      .insp-ci-ro{font-weight:700;color:#1a3a6b}
      .insp-ci-profit{font-weight:700}
      .insp-footer{display:flex;justify-content:space-between;border-top:2px solid #000;margin-top:12px;padding-top:8px;font-size:8px}
      .insp-footer-sig{text-align:right;font-weight:700;font-size:9px;border-top:1px solid #000;padding-top:2px;min-width:150px;margin-top:auto}
      @page{size:A4 portrait;margin:8mm 10mm}
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 350);
  };

  // ── Export PDF ──────────────────────────────────────────────────────────────
  const handlePDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;

    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.setTextColor(26, 58, 107);
    doc.text('DAIRY DEVELOPMENT DEPARTMENT', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(11); doc.setTextColor(0, 0, 0);
    doc.text('INSPECTION REPORT', pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(`District: ${form.district}   |   Society: ${form.society}   |   Date: ${form.dateOfInspection}`, pageW / 2, y, { align: 'center' });
    y += 4;
    doc.line(10, y, pageW - 10, y);
    y += 4;

    const rows = buildPDFRows();
    autoTable(doc, {
      startY: y,
      head: [['S.No', 'Description', 'Value']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [26, 58, 107], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold', fillColor: [248, 248, 248] },
        1: { cellWidth: 120, fillColor: [250, 250, 250] },
        2: { cellWidth: 45, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const raw = data.row.raw;
          if (raw[0] === '') {
            data.cell.styles.fillColor = [217, 232, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [26, 58, 107];
          } else if (['9','10','21','22'].includes(raw[0])) {
            data.cell.styles.fillColor = [255, 251, 235];
          } else if (['23','24'].includes(raw[0])) {
            data.cell.styles.fillColor = [224, 240, 224];
          }
        }
      },
      margin: { left: 10, right: 10 },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.text('Inspector Signature:', 10, finalY + 15);
    doc.line(40, finalY + 15, 90, finalY + 15);
    doc.text('Society Secretary:', pageW - 10, finalY + 15, { align: 'right' });

    doc.save(`Inspection_Report_${form.dateOfInspection}.pdf`);
  };

  const buildPDFRows = () => {
    const f = form;
    return [
      ['', 'BASIC INFORMATION', ''],
      ['1',  'Dairy Development Unit',                       f.dairyDevelopmentUnit],
      ['2',  'Name of the Society',                          f.nameOfSociety],
      ['3',  'Date of Inspection',                           f.dateOfInspection],
      ['', 'MILK COLLECTION – MEMBERS', ''],
      ['4',  'Number of Members Milking Daily',              f.membersMillingCount],
      ['5',  'Quantity of Milk Collected – From Members (Ltr)', f.membersMilkQty],
      ['', 'MILK COLLECTION – NON-MEMBERS', ''],
      ['6',  'Number of Non-Members Milking Daily',          f.nonMembersMillingCount],
      ['7',  'Quantity of Milk Collected – From Non-Members (Ltr)', f.nonMembersMilkQty],
      ['8',  'Price of Milk – From Non-Members (₹/Ltr)',     f.nonMembersMilkPrice],
      ['9',  'Total Daily Milk Collection (Qty Ltr) [Auto]', f.totalMilkQty],
      ['10', 'Total Daily Milk Collection (Amount ₹) [Auto]',f.totalMilkAmount],
      ['', 'SC/ST FARMERS', ''],
      ['11', 'Number of SC/ST Farmers Milking',              f.scStFarmersCount],
      ['12', 'Quantity of Milk Collected – SC/ST (Ltr)',     f.scStMilkQty],
      ['', 'MILK SALES', ''],
      ['13', 'Daily Local Sales – Quantity (Ltr)',           f.localSalesQty],
      ['14', 'Daily Local Sales – Amount (₹)',               f.localSalesPrice],
      ['15', 'Daily School/Anganwadi Sales – Quantity (Ltr)',f.schoolSalesQty],
      ['16', 'Daily School/Anganwadi Sales – Amount (₹)',    f.schoolSalesPrice],
      ['17', 'Daily Production Unit – Quantity (Ltr)',       f.productionUnitQty],
      ['18', 'Daily Production Unit – Amount (₹)',           f.productionUnitPrice],
      ['19', 'Daily Dairy Sales – Quantity (Ltr)',           f.dairySalesQty],
      ['20', 'Daily Dairy Sales – Amount (₹)',               f.dairySalesPrice],
      ['21', 'Total Daily Milk Sales (Qty Ltr) [Auto]',      f.totalSalesQty],
      ['22', 'Total Daily Milk Sales (Amount ₹) [Auto]',     f.totalSalesAmount],
      ['', 'TRADING SUMMARY', ''],
      ['23', 'Milk Procurement – Marketing Shortfall / Excess (Ltr)', f.milkShortfallExcess],
      ['24', 'Daily Profit from Milk Trading (₹)',           f.dailyProfitMilkTrading],
      ['', 'FINANCIAL POSITION', ''],
      ['25', 'Cash Balance as on Date (₹)',                  f.cashBalanceAsOnDate],
      ['26', 'Bank Balance as on Previous Month (₹)',        f.bankBalancePreviousMonth],
      ['27', 'Cattle Feed Advance Outstanding (₹)',          f.cattleFeedAdvanceOutstanding],
      ['28', 'Producer Due Amount Outstanding (₹)',          f.producerDueAmountOutstanding],
    ];
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  const numInput = (k) => (
    <input
      className="insp-ci"
      type="number"
      value={form[k]}
      onChange={e => setF(k, e.target.value)}
    />
  );
  const txtInput = (k) => (
    <input
      className="insp-ci-text"
      type="text"
      value={form[k]}
      onChange={e => setF(k, e.target.value)}
    />
  );
  const roVal = (k, isProfit = false) => (
    <input
      className={isProfit ? 'insp-ci-profit' : 'insp-ci-ro'}
      type="text"
      readOnly
      value={form[k]}
      style={isProfit && form[k] !== '' ? {
        color: parseFloat(form[k]) >= 0 ? '#155724' : '#721c24'
      } : {}}
    />
  );

  const profitLabel = (v) => {
    if (v === '' || v === undefined) return '';
    return parseFloat(v) >= 0 ? ' (Excess)' : ' (Shortfall)';
  };

  return (
    <div className="insp-wrap">
      {/* ── Action Bar ── */}
      <div className="act-bar">
        <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
        <h2 className="pg-title">Inspection Report</h2>
        <div className="act-btns">
          <button
            className="ibtn ibtn-load"
            onClick={() => loadFromDB(false)}
            disabled={loading}
          >{loading ? 'Loading…' : 'Load'}</button>
          <button className="ibtn ibtn-print" onClick={handlePrint}>Print</button>
          <button className="ibtn ibtn-pdf"   onClick={handlePDF}>Export PDF</button>
          <button
            className="ibtn ibtn-save"
            onClick={saveReport}
            disabled={saving}
          >{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {/* ── Date Filter Bar ── */}
      <div className="insp-filter">
        <div>
          <label>Date of Inspection</label>
          <input
            type="date"
            value={form.dateOfInspection}
            onChange={e => setF('dateOfInspection', e.target.value)}
          />
        </div>
        <div style={{ fontSize: 10, color: '#555', alignSelf: 'flex-end', paddingBottom: 2 }}>
          {loading
            ? '⏳ Loading dairy data…'
            : savedId
              ? `✓ Saved report found — dairy data merged (ID: …${savedId.slice(-6)})`
              : 'Auto-populated from dairy transactions — review and save'}
        </div>
      </div>

      {/* ── Status Message ── */}
      {msg.text && (
        <div className={`insp-msg ${msg.type === 'ok' ? 'insp-msg-ok' : 'insp-msg-err'}`}>
          {msg.text}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="insp-legend">
        <span style={{ fontSize: 10, fontWeight: 700, color: '#333' }}>Legend:</span>
        <span className="insp-legend-item">
          <span className="insp-legend-box" style={{ background: '#fff' }} />
          <span>Manual entry</span>
        </span>
        <span className="insp-legend-item">
          <span className="insp-legend-box" style={{ background: '#eff6ff' }} />
          <span>Auto-filled from dairy data</span>
        </span>
        <span className="insp-legend-item">
          <span className="insp-legend-box" style={{ background: '#fffbeb' }} />
          <span>Auto-calculated total</span>
        </span>
        <span className="insp-legend-item">
          <span className="insp-legend-box" style={{ background: '#e8f4e8' }} />
          <span>Trading summary</span>
        </span>
      </div>

      {/* ── Report Body ── */}
      <div ref={printRef} className="insp-rpt" style={{ marginTop: 10 }}>

        {/* ── Header ── */}
        <div className="insp-hdr">
          <div className="insp-hdr-left">
            <div className="insp-dept">Dairy Development Department</div>
            <div className="insp-report-title">Inspection Report</div>
          </div>
          <div className="insp-hdr-right">
            <div className="insp-hdr-field">
              <label>District:</label>
              <input
                type="text"
                value={form.district}
                onChange={e => setF('district', e.target.value)}
                placeholder="Enter district"
              />
            </div>
            <div className="insp-hdr-field">
              <label>Society:</label>
              <input
                type="text"
                value={form.society}
                onChange={e => setF('society', e.target.value)}
                placeholder="Enter society"
              />
            </div>
          </div>
        </div>

        {/* ── Form Table ── */}
        <table className="insp-table">
          <thead>
            <tr>
              <th style={{ width: 42 }}>S.No</th>
              <th style={{ width: '60%' }}>Description</th>
              <th style={{ width: '30%' }}>Value / Entry</th>
            </tr>
          </thead>
          <tbody>

            {/* ── Section A: Basic Information ── */}
            <tr className="sec-hdr">
              <td colSpan={3}>A. Basic Information</td>
            </tr>
            <tr>
              <td className="sno">1</td>
              <td className="lbl">Dairy Development Unit</td>
              <td className="val">{txtInput('dairyDevelopmentUnit')}</td>
            </tr>
            <tr>
              <td className="sno">2</td>
              <td className="lbl">Name of the Society</td>
              <td className="val">{txtInput('nameOfSociety')}</td>
            </tr>
            <tr>
              <td className="sno">3</td>
              <td className="lbl">Date of Inspection</td>
              <td className="val">
                <input
                  className="insp-ci-date"
                  type="date"
                  value={form.dateOfInspection}
                  onChange={e => setF('dateOfInspection', e.target.value)}
                />
              </td>
            </tr>

            {/* ── Section B: Milk Collection – Members ── */}
            <tr className="sec-hdr">
              <td colSpan={3}>B. Daily Milk Collection – Members</td>
            </tr>
            <tr>
              <td className="sno">4</td>
              <td className="lbl">Number of Members Milking Daily</td>
              <td className="val-db">{numInput('membersMillingCount')}</td>
            </tr>
            <tr>
              <td className="sno">5</td>
              <td className="lbl">Quantity of Milk Collected – From Members (Ltr)</td>
              <td className="val-db">{numInput('membersMilkQty')}</td>
            </tr>

            {/* ── Section C: Milk Collection – Non-Members ── */}
            <tr className="sec-hdr">
              <td colSpan={3}>C. Daily Milk Collection – Non-Members</td>
            </tr>
            <tr>
              <td className="sno">6</td>
              <td className="lbl">Number of Non-Members Milking Daily</td>
              <td className="val-db">{numInput('nonMembersMillingCount')}</td>
            </tr>
            <tr>
              <td className="sno">7</td>
              <td className="lbl">Quantity of Milk Collected – From Non-Members (Ltr)</td>
              <td className="val-db">{numInput('nonMembersMilkQty')}</td>
            </tr>
            <tr>
              <td className="sno">8</td>
              <td className="lbl">Price of Milk – From Non-Members (₹ / Ltr)</td>
              <td className="val-db">{numInput('nonMembersMilkPrice')}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td className="sno">9</td>
              <td className="lbl" style={{ fontWeight: 700 }}>
                Total Daily Milk Collection – Quantity (Ltr)
                <span style={{ fontSize: 9, fontWeight: 400, color: '#555', marginLeft: 6 }}>[Fields 5 + 7]</span>
              </td>
              <td className="val-auto">{roVal('totalMilkQty')}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td className="sno">10</td>
              <td className="lbl" style={{ fontWeight: 700 }}>
                Total Daily Milk Collection – Amount (₹)
                <span style={{ fontSize: 9, fontWeight: 400, color: '#555', marginLeft: 6 }}>[Field 7 × Field 8]</span>
              </td>
              <td className="val-auto">{roVal('totalMilkAmount')}</td>
            </tr>

            {/* ── Section D: SC/ST Farmers ── */}
            <tr className="sec-hdr">
              <td colSpan={3}>D. SC / ST Farmers</td>
            </tr>
            <tr>
              <td className="sno">11</td>
              <td className="lbl">Number of SC/ST Farmers Milking</td>
              <td className="val-db">{numInput('scStFarmersCount')}</td>
            </tr>
            <tr>
              <td className="sno">12</td>
              <td className="lbl">Quantity of Milk Collected – SC/ST Farmers (Ltr)</td>
              <td className="val-db">{numInput('scStMilkQty')}</td>
            </tr>

            {/* ── Section E: Milk Sales ── */}
            <tr className="sec-hdr-red">
              <td colSpan={3}>E. Daily Milk Sales</td>
            </tr>
            <tr>
              <td className="sno">13</td>
              <td className="lbl">Daily Local Sales – Quantity (Ltr)</td>
              <td className="val-db">{numInput('localSalesQty')}</td>
            </tr>
            <tr>
              <td className="sno">14</td>
              <td className="lbl">Daily Local Sales – Amount / Price (₹)</td>
              <td className="val-db">{numInput('localSalesPrice')}</td>
            </tr>
            <tr>
              <td className="sno">15</td>
              <td className="lbl">Daily School / Anganwadi Sales – Quantity (Ltr)</td>
              <td className="val-db">{numInput('schoolSalesQty')}</td>
            </tr>
            <tr>
              <td className="sno">16</td>
              <td className="lbl">Daily School / Anganwadi Sales – Amount / Price (₹)</td>
              <td className="val-db">{numInput('schoolSalesPrice')}</td>
            </tr>
            <tr>
              <td className="sno">17</td>
              <td className="lbl">Daily Production Unit – Quantity (Ltr)</td>
              <td className="val-db">{numInput('productionUnitQty')}</td>
            </tr>
            <tr>
              <td className="sno">18</td>
              <td className="lbl">Daily Production Unit – Amount / Price (₹)</td>
              <td className="val-db">{numInput('productionUnitPrice')}</td>
            </tr>
            <tr>
              <td className="sno">19</td>
              <td className="lbl">Daily Dairy Sales – Quantity (Ltr)</td>
              <td className="val-db">{numInput('dairySalesQty')}</td>
            </tr>
            <tr>
              <td className="sno">20</td>
              <td className="lbl">Daily Dairy Sales – Amount / Price (₹)</td>
              <td className="val-db">{numInput('dairySalesPrice')}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td className="sno">21</td>
              <td className="lbl" style={{ fontWeight: 700 }}>
                Total Daily Milk Sales – Quantity (Ltr)
                <span style={{ fontSize: 9, fontWeight: 400, color: '#555', marginLeft: 6 }}>[13+15+17+19]</span>
              </td>
              <td className="val-auto">{roVal('totalSalesQty')}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td className="sno">22</td>
              <td className="lbl" style={{ fontWeight: 700 }}>
                Total Daily Milk Sales – Amount (₹)
                <span style={{ fontSize: 9, fontWeight: 400, color: '#555', marginLeft: 6 }}>[14+16+18+20]</span>
              </td>
              <td className="val-auto">{roVal('totalSalesAmount')}</td>
            </tr>

            {/* ── Section F: Trading Summary ── */}
            <tr className="sec-hdr-green">
              <td colSpan={3}>F. Trading Summary</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td className="sno">23</td>
              <td className="lbl" style={{ fontWeight: 700 }}>
                Milk Procurement – Marketing Shortfall / Excess (Ltr)
                <span style={{ fontSize: 9, fontWeight: 400, color: '#555', marginLeft: 6 }}>
                  [Field 9 – Field 21{profitLabel(form.milkShortfallExcess)}]
                </span>
              </td>
              <td className="val-calc">{roVal('milkShortfallExcess', true)}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td className="sno">24</td>
              <td className="lbl" style={{ fontWeight: 700 }}>
                Daily Profit from Milk Trading (₹)
                <span style={{ fontSize: 9, fontWeight: 400, color: '#555', marginLeft: 6 }}>
                  [Field 22 – Field 10{profitLabel(form.dailyProfitMilkTrading)}]
                </span>
              </td>
              <td className="val-calc">{roVal('dailyProfitMilkTrading', true)}</td>
            </tr>

            {/* ── Section G: Financial Position ── */}
            <tr className="sec-hdr">
              <td colSpan={3}>G. Financial Position</td>
            </tr>
            <tr>
              <td className="sno">25</td>
              <td className="lbl">Cash Balance as on Date (₹)</td>
              <td className="val-db">{numInput('cashBalanceAsOnDate')}</td>
            </tr>
            <tr>
              <td className="sno">26</td>
              <td className="lbl">Bank Balance as on Previous Month (₹)</td>
              <td className="val-db">{numInput('bankBalancePreviousMonth')}</td>
            </tr>
            <tr>
              <td className="sno">27</td>
              <td className="lbl">Cattle Feed Advance Outstanding (₹)</td>
              <td className="val-db">{numInput('cattleFeedAdvanceOutstanding')}</td>
            </tr>
            <tr>
              <td className="sno">28</td>
              <td className="lbl">Producer Due Amount Outstanding (₹)</td>
              <td className="val-db">{numInput('producerDueAmountOutstanding')}</td>
            </tr>

          </tbody>
        </table>

        {/* ── Footer ── */}
        <div className="insp-footer">
          <div className="insp-footer-note">
            <div>Society: {form.nameOfSociety || form.society}</div>
            <div>District: {form.district}</div>
            <div>Date: {form.dateOfInspection}</div>
          </div>
          <div className="insp-footer-sig">
            Inspector / Dairy Development Officer
          </div>
        </div>

      </div>{/* end .insp-rpt */}
    </div>
  );
}
