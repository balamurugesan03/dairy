import { useState, useEffect, useMemo, Fragment } from 'react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { farmerAPI, collectionCenterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

/* Producer Report — compact admin-dashboard layout: four collapsible filter
   cards on the left (~33%), one data-table card on the right (~65%).
   Data comes from GET /farmers/producer-report (all rows, paged here). */

const PAGE_SIZE = 30;

const COND_OPTIONS = ['>=', '<=', '>', '<', '='];
const ENROLL_OPTIONS = [{ value: 'yes', label: 'Enrolled' }, { value: 'no', label: 'Not Enrolled' }];

const INIT_FILTERS = {
  collectionCenter: '', memberType: '', farmerNumberFrom: '', farmerNumberTo: '',
  activeOnly: false, localLanguage: false,
  gender: 'Male', caste: '', occupation: '', category: '',
  dbtHas: 'yes', welfareHas: 'yes', mobileHas: 'yes', bankHas: 'yes',
  localBody: '', wards: [],
  fromDate: '', toDate: '',
  daysCondition: '>=', daysValue: '', daysQtyLogic: 'AND', qtyCondition: '>=', qtyValue: '',
};
// Advanced / Local Body filters only apply while their checkbox is ticked
const TICKABLE = ['gender', 'caste', 'occupation', 'category', 'dbtHas', 'welfareHas', 'mobileHas', 'bankHas', 'localBody', 'wards'];
const INIT_TICKED = TICKABLE.reduce((a, k) => ({ ...a, [k]: false }), {});

const COLUMNS = [
  { key: 'farmerNumber', label: 'Pro ID',            get: r => r.farmerNumber, numeric: true },
  { key: 'memberId',     label: 'Mem No',            get: r => r.memberId },
  { key: 'name',         label: 'Name',              get: r => r.personalDetails?.name },
  { key: 'fatherName',   label: 'Father/Hus Name',   get: r => r.personalDetails?.fatherName },
  { key: 'houseName',    label: 'House Name',        get: r => r.address?.houseName },
  { key: 'post',         label: 'Post',              get: r => r.address?.post },
  { key: 'place',        label: 'Place',             get: r => r.address?.place },
  { key: 'sex',          label: 'Sex',               get: r => (r.personalDetails?.gender || '').charAt(0) },
  { key: 'phone',        label: 'Mobile No',         get: r => r.personalDetails?.phone },
  { key: 'dbt',          label: 'DBT Enroll No',     get: r => r.identityDetails?.ksheerasreeId },
  { key: 'welfare',      label: 'Welfare Enroll No', get: r => r.identityDetails?.welfareNo },
];

// Fields that don't fit on screen — shown in the (+) detail row
const DETAIL_FIELDS = [
  ['Collection Centre', r => r._center?.centerName],
  ['Status',            r => r.status],
  ['Member Type',       r => (r.isMembership ? 'Member' : 'Non-Member')],
  ['Local Body',        r => r.address?.panchayat],
  ['Ward',              r => r.address?.ward],
  ['Village',           r => r.address?.village],
  ['PIN',               r => r.address?.pin],
  ['Caste',             r => r.personalDetails?.caste],
  ['Occupation',        r => r.farmerType],
  ['Category',          r => r.cowType],
  ['Bank A/C',          r => r.bankDetails?.accountNumber],
  ['Bank / IFSC',       r => [r.bankDetails?.bankName, r.bankDetails?.ifsc].filter(Boolean).join(' / ')],
  ['Pouring Days',      r => (r._pouringDays != null ? String(r._pouringDays) : '')],
  ['Quantity (L)',      r => (r._totalQty != null ? Number(r._totalQty).toFixed(2) : '')],
];

const val = (v) => (v == null ? '' : String(v));

const CSS = `
.pr-root { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333; background: #ecf0f5;
  padding: 10px; display: flex; gap: 12px; align-items: flex-start; min-height: calc(100vh - 60px); box-sizing: border-box; }
.pr-left  { flex: 0 0 33%; max-width: 33%; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.pr-right { flex: 1 1 65%; min-width: 0; }
.pr-card { background: #fff; border: 1px solid #d2d6de; border-radius: 3px; box-shadow: 0 1px 1px rgba(0,0,0,.08); }
.pr-card-h { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px;
  border-bottom: 1px solid #d2d6de; cursor: pointer; user-select: none; }
.pr-card-h h3 { margin: 0; font-size: 13px; font-weight: 700; color: #333; }
.pr-card-h .pr-tools { display: flex; gap: 8px; font-size: 13px; color: #555; }
.pr-card-h .pr-tools button { background: none; border: 0; padding: 0 2px; cursor: pointer; color: #555; font-size: 14px; line-height: 1; }
.pr-blue  { background: #d9edf7; } .pr-green { background: #dff0d8; } .pr-red { background: #f2dede; } .pr-gray { background: #f4f4f4; }
.pr-card-b { padding: 8px 10px 10px; }
.pr-row { display: flex; gap: 10px; margin-bottom: 7px; }
.pr-row > * { flex: 1; min-width: 0; }
.pr-lbl { display: block; font-size: 11px; font-weight: 700; margin-bottom: 2px; }
.pr-in, .pr-sel { width: 100%; box-sizing: border-box; height: 26px; padding: 2px 6px; font-size: 12px;
  font-family: inherit; border: 1px solid #ccc; border-radius: 0; background: #fff; color: #333; }
.pr-in:focus, .pr-sel:focus { border-color: #3c8dbc; outline: none; }
.pr-sel[multiple] { height: 44px; padding: 1px 4px; }
.pr-chk { display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; }
.pr-chk input { margin: 0; }
.pr-adv { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.pr-adv .pr-chk, .pr-adv .pr-advlbl { flex: 1; min-width: 0; }
.pr-adv .pr-advlbl { font-size: 12px; padding-left: 18px; }
.pr-adv .pr-sel { flex: 0 0 55%; width: 55%; }
.pr-btns { display: flex; justify-content: center; gap: 8px; margin-top: 4px; }
.pr-btn { background: #3c8dbc; border: 1px solid #367fa9; color: #fff; font-size: 12px; font-family: inherit;
  padding: 4px 14px; border-radius: 3px; cursor: pointer; }
.pr-btn:hover { background: #367fa9; }
.pr-btn:disabled { opacity: .6; cursor: default; }
.pr-btn.pr-btn-def { background: #f4f4f4; border-color: #ddd; color: #444; }
.pr-btn.pr-btn-def:hover { background: #e7e7e7; }
.pr-pd { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 6px 8px; align-items: center; }
.pr-pd3 { display: grid; grid-template-columns: 62px 64px 1fr 70px; gap: 6px; align-items: center; margin-top: 7px; }
.pr-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.pr-toolbar .pr-search { display: flex; align-items: center; gap: 5px; }
.pr-toolbar .pr-search input { width: 170px; }
.pr-tblwrap { overflow-x: auto; }
.pr-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.pr-tbl th { background: #f4f4f4; font-weight: 700; text-align: left; vertical-align: bottom; padding: 5px 16px 5px 5px;
  border-bottom: 2px solid #ddd; position: relative; cursor: pointer; white-space: normal; line-height: 1.2; min-width: 42px; }
.pr-tbl th.pr-nosort { cursor: default; padding-right: 5px; width: 22px; min-width: 22px; }
.pr-tbl th .pr-sort { position: absolute; right: 3px; bottom: 5px; font-size: 8px; line-height: 7px; color: #bbb; display: flex; flex-direction: column; }
.pr-tbl th .pr-sort .on { color: #333; }
.pr-tbl td { padding: 4px 5px; border-top: 1px solid #eee; text-transform: uppercase; text-align: left; vertical-align: middle; }
.pr-tbl tbody tr.pr-r:hover td { background: #f5f5f5; }
.pr-plus { width: 15px; height: 15px; border-radius: 50%; background: #00a65a; color: #fff; border: 1px solid #fff;
  box-shadow: 0 0 2px #444; font: bold 12px/13px 'Courier New', monospace; text-align: center; cursor: pointer; padding: 0; }
.pr-plus.open { background: #d33333; }
.pr-detail td { background: #fafafa; text-transform: none; }
.pr-detail ul { list-style: none; margin: 0; padding: 2px 0 2px 22px; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 3px 16px; }
.pr-detail b { display: inline-block; min-width: 110px; }
.pr-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; font-size: 12px; }
.pr-pager { display: flex; }
.pr-pager button { border: 1px solid #ddd; margin-left: -1px; background: #fff; color: #337ab7; font-size: 12px;
  font-family: inherit; padding: 4px 10px; cursor: pointer; }
.pr-pager button:first-child { border-radius: 3px 0 0 3px; } .pr-pager button:last-child { border-radius: 0 3px 3px 0; }
.pr-pager button.on { background: #337ab7; border-color: #337ab7; color: #fff; cursor: default; position: relative; }
.pr-pager button:disabled:not(.on) { color: #999; cursor: default; }
.pr-pager span { border: 1px solid #ddd; margin-left: -1px; padding: 4px 8px; color: #999; }
.pr-empty { text-align: center; color: #777; padding: 18px 0 !important; text-transform: none !important; }
@media (max-width: 900px) {
  .pr-root { flex-direction: column; padding: 8px 16px; }
  .pr-left, .pr-right { flex: 1 1 auto; max-width: 100%; width: 100%; }
}
`;

function Card({ title, tone, open, onToggle, tools, children }) {
  return (
    <div className="pr-card">
      <div className={`pr-card-h ${tone}`} onClick={onToggle}>
        <h3>{title}</h3>
        <div className="pr-tools" onClick={e => e.stopPropagation()}>
          {tools}
          <button type="button" title={open ? 'Collapse' : 'Expand'} onClick={onToggle}>{open ? '˅' : '˄'}</button>
        </div>
      </div>
      {open && <div className="pr-card-b">{children}</div>}
    </div>
  );
}

// "‹ Previous [1] 2 3 Next ›" with ellipses for long ranges
function Pager({ page, pages, onPage }) {
  if (pages < 1) return null;
  const nums = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <div className="pr-pager">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Previous</button>
      {nums.map((n, i) => n === '…'
        ? <span key={`e${i}`}>…</span>
        : <button type="button" key={n} className={n === page ? 'on' : ''} onClick={() => n !== page && onPage(n)}>{n}</button>)}
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}

export default function ProducerReport() {
  const { selectedCompany } = useCompany();
  const [filters, setFilters] = useState(INIT_FILTERS);
  const [ticked, setTicked]   = useState(INIT_TICKED);
  const [open, setOpen]       = useState({ centre: true, advanced: true, local: true, pouring: true, table: true });
  const [centers, setCenters] = useState([]);
  const [options, setOptions] = useState({ castes: [], occupations: [], categories: [], localBodies: [] });
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [search, setSearch]   = useState('');
  const [sort, setSort]       = useState({ key: 'farmerNumber', dir: 'asc' });
  const [page, setPage]       = useState(1);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    collectionCenterAPI.getAll({ limit: 500 })
      .then(res => setCenters((res?.data || res || []).map(c => ({ value: c._id, label: c.centerName }))))
      .catch(() => {});
    farmerAPI.getProducerReportOptions()
      .then(res => {
        const o = res?.data || {};
        setOptions({ castes: o.castes || [], occupations: o.occupations || [], categories: o.categories || [], localBodies: o.localBodies || [] });
        // Default the Local Body dropdown to the first one on record
        if (o.localBodies?.length) setFilters(f => (f.localBody ? f : { ...f, localBody: o.localBodies[0].name }));
      })
      .catch(() => {});
  }, [selectedCompany]);

  const setF = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const tick = (k) => setTicked(p => ({ ...p, [k]: !p[k] }));
  const toggle = (k) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const wardOptions = useMemo(
    () => options.localBodies.find(b => b.name === filters.localBody)?.wards || [],
    [options.localBodies, filters.localBody]);

  const buildParams = () => {
    const f = filters;
    const p = { page: 1, limit: 9999 };
    if (f.collectionCenter) p.collectionCenter = f.collectionCenter;
    if (f.memberType) p.memberType = f.memberType;
    if (f.farmerNumberFrom) p.farmerNumberFrom = f.farmerNumberFrom;
    if (f.farmerNumberTo) p.farmerNumberTo = f.farmerNumberTo;
    if (f.activeOnly) p.activeOnly = 'true';
    if (ticked.gender && f.gender) p.gender = f.gender;
    if (ticked.caste && f.caste) p.caste = f.caste;
    if (ticked.occupation && f.occupation) p.farmerType = f.occupation;
    if (ticked.category && f.category) p.cowType = f.category;
    if (ticked.dbtHas) p.dbtHas = f.dbtHas;
    if (ticked.welfareHas) p.welfareHas = f.welfareHas;
    if (ticked.mobileHas) p.mobileHas = f.mobileHas;
    if (ticked.bankHas) p.bankHas = f.bankHas;
    if (ticked.localBody && f.localBody) p.localBody = f.localBody;
    if (ticked.wards && f.wards.length) p.ward = f.wards.join(',');
    if (f.fromDate && f.toDate) {
      p.fromDate = f.fromDate; p.toDate = f.toDate;
      if (f.daysValue !== '') { p.daysCondition = f.daysCondition; p.daysValue = f.daysValue; }
      if (f.qtyValue !== '')  { p.qtyCondition = f.qtyCondition;  p.qtyValue = f.qtyValue; }
      p.daysQtyLogic = f.daysQtyLogic;
    }
    return p;
  };

  const handleDisplay = async () => {
    if ((filters.daysValue !== '' || filters.qtyValue !== '') && !(filters.fromDate && filters.toDate)) {
      notifications.show({ color: 'yellow', message: 'Select From and To dates to filter by pouring days / quantity' });
      return;
    }
    setLoading(true);
    try {
      const res = await farmerAPI.getProducerReport(buildParams());
      setData(res?.data || []);
      setSearched(true); setPage(1); setExpanded(new Set());
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to load report' });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFilters({ ...INIT_FILTERS, localBody: options.localBodies[0]?.name || '' });
    setTicked(INIT_TICKED);
    setData([]); setSearched(false); setSearch(''); setPage(1); setExpanded(new Set());
  };

  // Search box → sort → page
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? data.filter(r => COLUMNS.some(c => val(c.get(r)).toLowerCase().includes(q)))
      : data.slice();
    const col = COLUMNS.find(c => c.key === sort.key);
    if (col) {
      const sign = sort.dir === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        const x = val(col.get(a)), y = val(col.get(b));
        if (col.numeric) {
          const nx = parseInt(x, 10), ny = parseInt(y, 10);
          if (!isNaN(nx) && !isNaN(ny) && nx !== ny) return (nx - ny) * sign;
        }
        return x.localeCompare(y, undefined, { numeric: true }) * sign;
      });
    }
    return list;
  }, [data, search, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const pageRows = rows.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const from = rows.length ? (curPage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(curPage * PAGE_SIZE, rows.length);

  const onSort = (key) => setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const toggleRow = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Download / Export / Export PDF (all filtered rows, current sort) ────
  const companyName = selectedCompany?.companyName || selectedCompany?.name || 'Dairy Cooperative Society';
  const exportRows = () => rows.map(r => COLUMNS.map(c => val(c.get(r)).toUpperCase()));
  const stamp = () => dayjs().format('YYYYMMDD_HHmm');
  const guard = () => {
    if (rows.length) return true;
    notifications.show({ color: 'yellow', message: 'No data — click Display first' });
    return false;
  };

  // Download → Excel workbook, with the detail-row fields too
  const handleDownload = () => {
    if (!guard()) return;
    const sheet = rows.map(r => {
      const o = {};
      COLUMNS.forEach(c => { o[c.label] = val(c.get(r)).toUpperCase(); });
      DETAIL_FIELDS.forEach(([label, get]) => { o[label] = val(get(r)); });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(sheet);
    ws['!cols'] = Object.keys(sheet[0]).map(k => ({ wch: Math.max(k.length + 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producer Report');
    XLSX.writeFile(wb, `producer_report_${stamp()}.xlsx`);
  };

  // Export → CSV of the table columns
  const handleExport = () => {
    if (!guard()) return;
    const csv = [COLUMNS.map(c => c.label), ...exportRows()]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `producer_report_${stamp()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (!guard()) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(companyName.toUpperCase(), w / 2, 12, { align: 'center' });
    doc.setFontSize(10);
    doc.text('PRODUCER REPORT', w / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const period = filters.fromDate && filters.toDate
      ? `Period: ${dayjs(filters.fromDate).format('DD/MM/YYYY')} - ${dayjs(filters.toDate).format('DD/MM/YYYY')}   |   ` : '';
    doc.text(`${period}Total: ${rows.length} producers   |   Printed: ${dayjs().format('DD/MM/YYYY HH:mm')}`, w / 2, 23, { align: 'center' });
    autoTable(doc, {
      startY: 27,
      head: [['Sl', ...COLUMNS.map(c => c.label)]],
      body: exportRows().map((r, i) => [i + 1, ...r]),
      styles: { fontSize: 7, cellPadding: 1.4, lineColor: [210, 210, 210], lineWidth: 0.1 },
      headStyles: { fillColor: [244, 244, 244], textColor: 30, fontStyle: 'bold' },
      margin: { left: 8, right: 8 },
    });
    doc.save(`producer_report_${stamp()}.pdf`);
  };

  const sel = (key, list, disabled) => (
    <select className="pr-sel" value={filters[key]} disabled={disabled} onChange={e => setF(key, e.target.value)}>
      {list.map(o => (typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
  const advRow = (key, label, list) => (
    <div className="pr-adv" key={key}>
      <label className="pr-chk"><input type="checkbox" checked={ticked[key]} onChange={() => tick(key)} />{label}</label>
      {sel(key, list, !ticked[key])}
    </div>
  );
  const withAll = (list) => [{ value: '', label: 'ALL' }, ...list.map(v => ({ value: v, label: v.toUpperCase() }))];

  return (
    <div className="pr-root">
      <style>{CSS}</style>

      {/* ═════ LEFT — FILTER CARDS ═════ */}
      <div className="pr-left">
        <Card title="Collection Center" tone="pr-blue" open={open.centre} onToggle={() => toggle('centre')}>
          <div className="pr-row">
            <div>
              <label className="pr-lbl">Collection Center</label>
              {sel('collectionCenter', [{ value: '', label: 'ALL' }, ...centers])}
            </div>
            <div>
              <label className="pr-lbl">Member Type</label>
              {sel('memberType', [{ value: '', label: 'ALL' }, { value: 'Member', label: 'MEMBER' }, { value: 'NonMember', label: 'NON-MEMBER' }])}
            </div>
          </div>
          <div className="pr-row">
            <div>
              <label className="pr-lbl">Prod No From</label>
              <input className="pr-in" inputMode="numeric" value={filters.farmerNumberFrom} onChange={e => setF('farmerNumberFrom', e.target.value)} />
            </div>
            <div>
              <label className="pr-lbl">Prod No To</label>
              <input className="pr-in" inputMode="numeric" value={filters.farmerNumberTo} onChange={e => setF('farmerNumberTo', e.target.value)} />
            </div>
          </div>
          <div className="pr-row">
            <label className="pr-chk"><input type="checkbox" checked={filters.activeOnly} onChange={e => setF('activeOnly', e.target.checked)} />Active Producer</label>
            <label className="pr-chk"><input type="checkbox" checked={filters.localLanguage} onChange={e => setF('localLanguage', e.target.checked)} />Local Language</label>
          </div>
          <div className="pr-btns">
            <button type="button" className="pr-btn" onClick={handleDisplay} disabled={loading}>{loading ? 'Loading…' : 'Display'}</button>
            <button type="button" className="pr-btn" onClick={handleClear}>Clear</button>
          </div>
        </Card>

        <Card title="Advanced Filter" tone="pr-green" open={open.advanced} onToggle={() => toggle('advanced')}>
          {advRow('gender', 'Sex', [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }])}
          {advRow('caste', 'Caste', withAll(options.castes))}
          {advRow('occupation', 'Occupation', withAll(options.occupations))}
          {advRow('category', 'Category', withAll(options.categories))}
          {advRow('dbtHas', 'DBT', ENROLL_OPTIONS)}
          {advRow('welfareHas', 'Welfare Fund', ENROLL_OPTIONS)}
          {advRow('mobileHas', 'Mobile Number', ENROLL_OPTIONS)}
          {advRow('bankHas', 'Bank A/C', ENROLL_OPTIONS)}
          <div className="pr-adv">
            <span className="pr-advlbl">Select Scheme</span>
            <select className="pr-sel" defaultValue="DBT (CF)"><option>DBT (CF)</option></select>
          </div>
        </Card>

        <Card title="Local Body & Wards" tone="pr-red" open={open.local} onToggle={() => toggle('local')}>
          <div className="pr-adv">
            <label className="pr-chk"><input type="checkbox" checked={ticked.localBody} onChange={() => tick('localBody')} />Local Body</label>
            <select className="pr-sel" value={filters.localBody} disabled={!ticked.localBody}
              onChange={e => setFilters(p => ({ ...p, localBody: e.target.value, wards: [] }))}>
              {options.localBodies.length === 0 && <option value="">—</option>}
              {options.localBodies.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div className="pr-adv" style={{ alignItems: 'flex-start' }}>
            <label className="pr-chk" style={{ paddingTop: 3 }}><input type="checkbox" checked={ticked.wards} onChange={() => tick('wards')} />Wards</label>
            <select className="pr-sel" multiple value={filters.wards} disabled={!ticked.wards}
              onChange={e => setF('wards', Array.from(e.target.selectedOptions, o => o.value))}>
              {wardOptions.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </Card>

        <Card title="Pouring Days & Quantity" tone="pr-red" open={open.pouring} onToggle={() => toggle('pouring')}>
          <div className="pr-pd">
            <span>From</span>
            <input className="pr-in" type="date" value={filters.fromDate} onChange={e => setF('fromDate', e.target.value)} />
            <span>To</span>
            <input className="pr-in" type="date" value={filters.toDate} onChange={e => setF('toDate', e.target.value)} />
          </div>
          <div className="pr-pd3">
            <span>Days</span>
            {sel('daysCondition', COND_OPTIONS)}
            <input className="pr-in" type="number" min="0" value={filters.daysValue} onChange={e => setF('daysValue', e.target.value)} />
            {sel('daysQtyLogic', ['AND', 'OR'])}
          </div>
          <div className="pr-pd3">
            <span>Quantity</span>
            {sel('qtyCondition', COND_OPTIONS)}
            <input className="pr-in" type="number" min="0" step="0.01" value={filters.qtyValue} onChange={e => setF('qtyValue', e.target.value)} />
            <span />
          </div>
        </Card>
      </div>

      {/* ═════ RIGHT — DATA TABLE CARD ═════ */}
      <div className="pr-right">
        <Card title="Producer Report" tone="pr-gray" open={open.table} onToggle={() => toggle('table')}
          tools={<button type="button" title="Close — clear the results" onClick={() => { setData([]); setSearched(false); setExpanded(new Set()); }}>×</button>}>
          <div className="pr-toolbar">
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="pr-btn pr-btn-def" onClick={handleDownload} title="Download as Excel (.xlsx)">Download</button>
              <button type="button" className="pr-btn pr-btn-def" onClick={handleExport} title="Export as CSV">Export</button>
              <button type="button" className="pr-btn pr-btn-def" onClick={handleExportPDF} title="Export as PDF">Export PDF</button>
            </div>
            <label className="pr-search">Search:
              <input className="pr-in" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </label>
          </div>

          <div className="pr-tblwrap">
            <table className="pr-tbl">
              <thead>
                <tr>
                  <th className="pr-nosort" />
                  {COLUMNS.map(c => (
                    <th key={c.key} onClick={() => onSort(c.key)}>
                      {c.label}
                      <span className="pr-sort">
                        <span className={sort.key === c.key && sort.dir === 'asc' ? 'on' : ''}>▲</span>
                        <span className={sort.key === c.key && sort.dir === 'desc' ? 'on' : ''}>▼</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="pr-empty" colSpan={COLUMNS.length + 1}>Loading…</td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td className="pr-empty" colSpan={COLUMNS.length + 1}>
                    {searched ? 'No matching records found' : 'Set the filters and click Display'}
                  </td></tr>
                ) : pageRows.map(r => {
                  const isOpen = expanded.has(r._id);
                  return (
                    <Fragment key={r._id}>
                      <tr className="pr-r">
                        <td>
                          <button type="button" className={`pr-plus${isOpen ? ' open' : ''}`} onClick={() => toggleRow(r._id)}
                            aria-label={isOpen ? 'Hide details' : 'Show details'}>{isOpen ? '−' : '+'}</button>
                        </td>
                        {COLUMNS.map(c => <td key={c.key}>{val(c.get(r))}</td>)}
                      </tr>
                      {isOpen && (
                        <tr className="pr-detail">
                          <td colSpan={COLUMNS.length + 1}>
                            <ul>
                              {DETAIL_FIELDS.map(([label, get]) => (
                                <li key={label}><b>{label}</b> {val(get(r))}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pr-foot">
            <span>Showing {from} to {to} of {rows.length} entries{search && data.length !== rows.length ? ` (filtered from ${data.length} total entries)` : ''}</span>
            <Pager page={curPage} pages={pages} onPage={setPage} />
          </div>
        </Card>
      </div>
    </div>
  );
}
