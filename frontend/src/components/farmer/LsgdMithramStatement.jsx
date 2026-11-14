/**
 * Dairy Reports → LSGD Reports → LSGD Milk Statement (formerly "LSGD Mithram Statement")
 *
 * Panchayat (+ ward) producers with month-wise milk from Milk Purchase for the
 * selected From–To period (one column per month, generated from the dates),
 * Total Milk × subsidy ₹/litre = Total Amount, an editable Subsidy Allotted and an
 * editable Last Subsidy Allotted (pre-filled from the latest earlier saved statement).
 *
 * The Panchayat can be picked from the Kerala list / Farmer Management or typed:
 * the server matches it loosely, falls back to village / place / post / taluk, and
 * can list every producer when Panchayat is not recorded at all.
 *
 * Rows can be ticked and removed from the statement (never from Farmer Management),
 * columns hidden; the statement can be saved and opened again. Preview, print, PDF,
 * Excel and email all use the same rows/columns and the Malayalam footer note.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Group, Text, Title, Paper, SimpleGrid, NumberInput, Autocomplete, TextInput,
  Checkbox, Table, ActionIcon, Tooltip, Badge, Popover, Stack, Divider, ScrollArea, Center, Loader,
  Modal, Textarea, Alert, SegmentedControl
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconFileSpreadsheet, IconFileTypePdf, IconPrinter, IconMail, IconTrash, IconColumns, IconRefresh,
  IconArrowBackUp, IconEye, IconPlayerPlay, IconAlertTriangle, IconPencil, IconDeviceFloppy,
  IconFolderOpen, IconUsers, IconInfoCircle, IconEdit
} from '@tabler/icons-react';
import { farmerFormAPI, lsgdMithramAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import {
  DETAIL_COLUMNS, AMOUNT_COLUMNS, DEFAULT_HIDDEN, DEFAULT_FOOTER_NOTE, MALAYALAM_FONT_STACK, PRIMARY_BANK_COLUMNS, SECONDARY_BANK_COLUMNS,
  monthColumns, visibleColumns, computeRows, computeTotals, cellValue, dmy,
  totalValue, fmtQty, fmtAmt, headerFacts, buildStatementHtml, printStatement, buildStatementPdf,
  buildStatementWorkbook, collectDocuments, reportFileName, arrayBufferToBase64, PDF_TYPE, XLSX_TYPE, r2
} from '../../utils/lsgdMithramReport';
import {
  findKeralaPanchayat, panchayatAliases, panchayatOptions, wardOptions, wardNumberFor
} from '../../utils/keralaPanchayat';
import { hasAnyDocument } from '../../utils/farmerDocumentsPrint';
import FarmerDetailsSyncModal from './FarmerDetailsSyncModal';

const REPORT_NAME = 'LSGD Milk Statement';

const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toYmd = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  return ymdOf(v);
};
const today = new Date();
const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
const DEFAULT_FROM = `${fyStartYear}-04-01`;
const DEFAULT_TO = ymdOf(today);

const HIDDEN_KEY = 'lsgdMilk:hiddenColumns';
const OLD_HIDDEN_KEY = 'lsgdMithram:hiddenColumns';
const noteKey = (companyId) => `lsgdMilk:footerNote:${companyId || ''}`;
const editsKey = (companyId, p) => `lsgdMithram:edits:${companyId || ''}:${[p.panchayat, p.ward, p.fromDate, p.toDate].map((s) => String(s || '').trim().toUpperCase()).join('|')}`;
const readJson = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
// Columns added later start hidden for users who already have saved column settings
const KNOWN_KEY = 'lsgdMilk:knownColumns';
const initialHidden = () => {
  const saved = readJson(HIDDEN_KEY, null);
  if (!saved) return new Set([...readJson(OLD_HIDDEN_KEY, []), ...DEFAULT_HIDDEN]);
  const known = new Set(readJson(KNOWN_KEY, ['sl', 'producerNo', 'name', 'ward', 'listNo', 'accountNumber', 'ifsc', 'aadhaar']));
  return new Set([...saved, ...DEFAULT_HIDDEN.filter((k) => !known.has(k))]);
};
const sameText = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

export default function LsgdMithramStatement() {
  const { selectedCompany } = useCompany() || {};
  const companyId = selectedCompany?._id;

  // ── Filters ────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(DEFAULT_FROM);
  const [toDate, setToDate] = useState(DEFAULT_TO);
  const [rate, setRate] = useState(0);
  const [scope, setScope] = useState('panchayat');   // 'panchayat' | 'all'
  const [panchayat, setPanchayat] = useState('');
  const [recordedPanchayats, setRecordedPanchayats] = useState([]);
  const [wards, setWards] = useState([]);
  const [ward, setWard] = useState('');
  const [wardNumber, setWardNumber] = useState('');
  const [members, setMembers] = useState([]);
  const [wardMember, setWardMember] = useState('');
  const [onlySuppliers, setOnlySuppliers] = useState(true);

  // ── Report + user edits ────────────────────────────────────────
  const [report, setReport] = useState(null);       // { months, rows, meta }
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState({});   // farmerId → Subsidy Allotted
  const [lastEdits, setLastEdits] = useState({});   // farmerId → Last Subsidy Allotted
  const [removed, setRemoved] = useState([]);       // farmerIds dropped from this statement
  const [selected, setSelected] = useState(() => new Set());
  const [hidden, setHidden] = useState(initialHidden);
  const [withDocs, setWithDocs] = useState(true);   // Include attached documents — on by default
  const [footerNote, setFooterNote] = useState(DEFAULT_FOOTER_NOTE);
  const [busy, setBusy] = useState('');             // 'print' | 'pdf' | 'excel' | 'email' | 'save'
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  // ── Saved statement ────────────────────────────────────────────
  const [saved, setSaved] = useState(null);         // { _id, title, updatedAt, panchayat, ward, fromDate, toDate }
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedListOpen, setSavedListOpen] = useState(false);
  const [editId, setEditId] = useState(null);     // farmerId whose details / documents are being edited

  useEffect(() => {
    farmerFormAPI.getPanchayats().then((r) => setRecordedPanchayats(r?.data || [])).catch(() => {});
    const n = localStorage.getItem(noteKey(companyId));
    if (n !== null) setFooterNote(n);
  }, [companyId]);

  const aliases = useMemo(() => panchayatAliases(panchayat), [panchayat]);
  const keralaPanchayat = useMemo(() => findKeralaPanchayat(panchayat), [panchayat]);
  const pOptions = useMemo(() => panchayatOptions(recordedPanchayats), [recordedPanchayats]);

  // Wards of the Panchayat (from Farmer Management + saved ward members)
  useEffect(() => {
    const p = panchayat.trim();
    if (!p || scope === 'all') { setWards([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      lsgdMithramAPI.getWards(p, panchayatAliases(p)).then((r) => { if (alive) setWards(r?.data || []); }).catch(() => { if (alive) setWards([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [panchayat, scope]);

  // Ward → saved ward members (+ ward number)
  useEffect(() => {
    const p = panchayat.trim();
    if (!p || !ward.trim()) { setMembers([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      lsgdMithramAPI.getWardMembers({ panchayat: p, ward: ward.trim() }).then((r) => {
        if (!alive) return;
        const list = r?.data || [];
        setMembers(list);
        if (list[0]) {
          setWardMember((cur) => cur || list[0].memberName);
          if (list[0].wardNumber) setWardNumber((cur) => cur || list[0].wardNumber);
        }
      }).catch(() => { if (alive) setMembers([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [ward, panchayat]);

  const wOptions = useMemo(() => wardOptions(wards), [wards]);
  const onWardChange = (v) => {
    setWard(v);
    setWardMember('');
    setWardNumber(v ? wardNumberFor(v, wards) : '');
  };

  // ── Generate ───────────────────────────────────────────────────
  /** @param opts.scopeOverride / onlySuppliersOverride — from the "no producers" helpers */
  const generate = async ({ keepEdits = false, scopeOverride, onlySuppliersOverride } = {}) => {
    const f = toYmd(fromDate);
    const t = toYmd(toDate);
    const sc = scopeOverride || scope;
    const os = onlySuppliersOverride ?? onlySuppliers;
    if (!f || !t) return notifications.show({ color: 'orange', message: 'Select From Date and To Date' });
    if (f > t) return notifications.show({ color: 'orange', message: 'From Date must be on or before To Date' });
    if (sc !== 'all' && !panchayat.trim()) return notifications.show({ color: 'orange', message: 'Select or type a Panchayat' });
    if (scopeOverride) setScope(scopeOverride);
    if (onlySuppliersOverride !== undefined) setOnlySuppliers(onlySuppliersOverride);
    // A different statement than the saved one that is open → saving creates a new one
    const sameAsSaved = saved && sameText(saved.panchayat, sc === 'all' ? 'All Producers' : panchayat)
      && sameText(saved.ward, ward) && saved.fromDate === f && saved.toDate === t;
    if (saved && !sameAsSaved) setSaved(null);
    setLoading(true);
    try {
      const params = {
        fromDate: f, toDate: t, panchayat: sc === 'all' ? '' : panchayat.trim(), aliases: aliases.join(','),
        ward: sc === 'all' ? '' : ward.trim(), wardNumber: sc === 'all' ? '' : wardNumber.trim(),
        rate: Number(rate) || 0, onlySuppliers: os, scope: sc,
        ...(sameAsSaved ? { excludeId: saved._id } : {}),
      };
      const res = await lsgdMithramAPI.getStatement(params);
      const data = res?.data;
      setReport(data);
      setSelected(new Set());
      const ids = new Set((data?.rows || []).map((r) => r.farmerId));
      const keep = (o) => Object.fromEntries(Object.entries(o || {}).filter(([id]) => ids.has(id)));
      if (keepEdits || sameAsSaved) {
        // Refresh: keep what the user changed
        setOverrides((o) => keep(o));
        setLastEdits((o) => keep(o));
        setRemoved((list) => list.filter((id) => ids.has(id)));
      } else {
        // Unsaved edits of this same statement are kept across reloads
        const draft = readJson(editsKey(companyId, { ...params, panchayat: data?.meta?.panchayat }), null);
        setOverrides(keep(draft?.overrides));
        setLastEdits(keep(draft?.lastEdits));
        setRemoved((draft?.removed || []).filter((id) => ids.has(id)));
      }
      if (ward.trim() && wardMember.trim() && sc !== 'all') {
        lsgdMithramAPI.saveWardMember({ panchayat: panchayat.trim(), ward: ward.trim(), wardNumber, memberName: wardMember.trim() })
          .then(() => lsgdMithramAPI.getWardMembers({ panchayat: panchayat.trim(), ward: ward.trim() }))
          .then((r) => setMembers(r?.data || []))
          .catch(() => {});
      }
      if (data?.rows?.length) {
        notifications.show({ color: 'green', message: `${data.rows.length} producers loaded` });
      }
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Could not generate the statement' });
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  // Persist unsaved edits for this statement (drafts)
  const editParams = report?.meta ? { panchayat: report.meta.panchayat, ward: report.meta.ward, fromDate: report.meta.fromDate, toDate: report.meta.toDate } : null;
  useEffect(() => {
    if (!editParams) return;
    const k = editsKey(companyId, editParams);
    if (!Object.keys(overrides).length && !Object.keys(lastEdits).length && !removed.length) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify({ overrides, lastEdits, removed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, lastEdits, removed, companyId, editParams?.panchayat, editParams?.ward, editParams?.fromDate, editParams?.toDate]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
    localStorage.setItem(KNOWN_KEY, JSON.stringify(DETAIL_COLUMNS.map((c) => c.key)));
  }, [hidden]);
  // Include Primary / Secondary Bank Details: switch each bank column group on / off
  const bankShown = (keys) => keys.some((k) => !hidden.has(k));
  const setBankShown = (keys, on) => setHidden((h) => { const n = new Set(h); keys.forEach((k) => (on ? n.delete(k) : n.add(k))); return n; });
  const changeNote = (v) => { setFooterNote(v); localStorage.setItem(noteKey(companyId), v); };

  // ── Derived ────────────────────────────────────────────────────
  const months = useMemo(() => report?.months || [], [report]);
  const removedSet = useMemo(() => new Set(removed), [removed]);
  const rows = useMemo(() => computeRows(report?.rows || [], rate, overrides, removedSet, lastEdits), [report, rate, overrides, removedSet, lastEdits]);
  const totals = useMemo(() => computeTotals(rows, months), [rows, months]);
  const baseLast = useMemo(() => new Map((report?.rows || []).map((r) => [r.farmerId, r.lastSubsidy || 0])), [report]);
  const columns = useMemo(() => visibleColumns(months, hidden), [months, hidden]);
  const facts = useMemo(() => headerFacts({
    meta: report?.meta, ward: report?.meta?.ward, wardNumber: report?.meta?.scope === 'all' ? '' : wardNumber, wardMember: wardMember.trim(), rate, footerNote,
  }), [report, wardNumber, wardMember, rate, footerNote]);
  const missingBank = rows.filter((r) => !r.accountNumber || !r.ifsc).length;
  const missingAadhaar = rows.filter((r) => !r.aadhaar).length;
  const withDocCount = rows.filter((r) => hasAnyDocument(r.docs)).length;
  const manualCount = rows.filter((r) => r.manual || r.lastManual).length;
  const canExport = !!report && columns.length > 0;
  const selectedVisible = rows.filter((r) => selected.has(r.farmerId));
  const allSelected = rows.length > 0 && selectedVisible.length === rows.length;

  // ── Row edits ──────────────────────────────────────────────────
  const setAmount = (setter) => (id, v) => {
    if (v === '' || v === null || v === undefined) {
      setter((o) => { const n = { ...o }; delete n[id]; return n; });
      return;
    }
    const num = Number(v);
    if (!Number.isFinite(num) || num < 0) return;
    setter((o) => ({ ...o, [id]: r2(num) }));
  };
  const setAllotted = setAmount(setOverrides);
  const setLastSubsidy = setAmount(setLastEdits);
  const resetOne = (setter, id) => setter((o) => { const n = { ...o }; delete n[id]; return n; });

  // Details / documents saved to Farmers Management from a row → show them on the statement too
  const editRow = editId ? rows.find((r) => r.farmerId === editId) || null : null;
  const patchRow = (id, patch) => setReport((rep) => (rep ? {
    ...rep, rows: rep.rows.map((x) => (x.farmerId === id ? { ...x, ...patch } : x)),
  } : rep));

  const toggleRow = (id, on) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const toggleAll = (on) => setSelected(on ? new Set(rows.map((r) => r.farmerId)) : new Set());

  const confirmRemove = (list) => modals.openConfirmModal({
    title: 'Remove producers from statement',
    children: (
      <Text size="sm">
        {list.length === 1
          ? <>Remove <b>{list[0].producerNo} – {list[0].name}</b> ({fmtQty(list[0].totalMilk)} L) from this statement?</>
          : <>Remove the <b>{list.length} selected producers</b> ({fmtQty(list.reduce((s, r) => s + r.totalMilk, 0))} L) from this statement?</>}
        {' '}Totals are recalculated. The farmer records in Farmer Management are <b>not</b> deleted.
      </Text>
    ),
    labels: { confirm: 'Remove', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: () => {
      const ids = list.map((r) => r.farmerId);
      setRemoved((cur) => [...new Set([...cur, ...ids])]);
      setSelected((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
    },
  });

  const resetEdits = () => modals.openConfirmModal({
    title: 'Reset changes',
    children: <Text size="sm">Restore all removed producers and set every Subsidy Allotted / Last Subsidy Allotted back to the calculated amount?</Text>,
    labels: { confirm: 'Reset', cancel: 'Cancel' },
    onConfirm: () => { setOverrides({}); setLastEdits({}); setRemoved([]); },
  });

  // ── Column settings ────────────────────────────────────────────
  const toggleCol = (key, on) => setHidden((h) => { const n = new Set(h); if (on) n.delete(key); else n.add(key); return n; });
  const setAllCols = (on, keys) => setHidden((h) => { const n = new Set(h); keys.forEach((k) => (on ? n.delete(k) : n.add(k))); return n; });
  const monthCols = monthColumns(months);
  const allKeys = [...DETAIL_COLUMNS, ...monthCols, ...AMOUNT_COLUMNS].map((c) => c.key);

  // ── Save / open ────────────────────────────────────────────────
  const defaultTitle = () => `${facts.panchayat || 'Panchayat'}${report?.meta?.ward ? ` - ${report.meta.ward}` : ''} - ${facts.period}`;
  const payload = (title) => ({
    title,
    fromDate: report.meta.fromDate, toDate: report.meta.toDate, rate: Number(rate) || 0,
    panchayat: report.meta.panchayat, ward: report.meta.ward || '', wardNumber: wardNumber.trim(), wardMember: wardMember.trim(),
    onlySuppliers: report.meta.onlySuppliers !== false, scope: report.meta.scope || 'panchayat',
    months: report.months, rows: report.rows, meta: report.meta,
    removed, overrides, lastSubsidy: lastEdits, hiddenColumns: [...hidden], withDocs, footerNote,
  });
  const doSave = async (title, asNew = false) => {
    if (!report) return;
    setBusy('save');
    try {
      const body = payload(title);
      const res = saved && !asNew ? await lsgdMithramAPI.updateSaved(saved._id, body) : await lsgdMithramAPI.createSaved(body);
      setSaved({ _id: res.data._id, updatedAt: res.data.updatedAt, title, panchayat: body.panchayat, ward: body.ward, fromDate: body.fromDate, toDate: body.toDate });
      localStorage.removeItem(editsKey(companyId, editParams));   // the saved copy is now the record
      notifications.show({ color: 'green', message: res?.message || 'Statement saved' });
      setSaveOpen(false);
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Could not save the statement' });
    } finally {
      setBusy('');
    }
  };

  const openSaved = async (id) => {
    setLoading(true);
    try {
      const res = await lsgdMithramAPI.getSaved(id);
      const d = res?.data;
      if (!d) throw new Error('Saved statement not found');
      setFromDate(d.fromDate); setToDate(d.toDate); setRate(d.rate || 0);
      setScope(d.scope || 'panchayat');
      setPanchayat(d.scope === 'all' ? '' : d.panchayat);
      setWard(d.ward || ''); setWardNumber(d.wardNumber || ''); setWardMember(d.wardMember || '');
      setOnlySuppliers(d.onlySuppliers !== false);
      setReport({ months: d.months || [], rows: d.rows || [], meta: { ...(d.meta || {}), panchayat: d.panchayat, ward: d.ward || '' } });
      setOverrides(d.overrides || {}); setLastEdits(d.lastSubsidy || {}); setRemoved(d.removed || []);
      setSelected(new Set());
      if (Array.isArray(d.hiddenColumns)) setHidden(new Set(d.hiddenColumns));
      setWithDocs(d.withDocs !== false);
      if (typeof d.footerNote === 'string' && d.footerNote.trim()) setFooterNote(d.footerNote);
      setSaved({ _id: d._id, updatedAt: d.updatedAt, title: d.title, panchayat: d.panchayat, ward: d.ward || '', fromDate: d.fromDate, toDate: d.toDate });
      setSavedListOpen(false);
      notifications.show({ color: 'blue', message: `Opened “${d.title || 'saved statement'}” — Refresh to update milk figures from Milk Purchase` });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Could not open the saved statement' });
    } finally {
      setLoading(false);
    }
  };

  // ── Outputs ────────────────────────────────────────────────────
  const output = { facts, columns, rows, totals };
  const docProgress = (done, total) => notifications.update({ id: 'lsgd-docs', loading: true, autoClose: false, message: `Loading documents ${done}/${total}…` });
  const loadDocs = async () => {
    if (!withDocs || !withDocCount) return [];
    notifications.show({ id: 'lsgd-docs', loading: true, autoClose: false, message: `Loading documents of ${withDocCount} producers…` });
    try {
      const res = await collectDocuments(rows, docProgress);
      notifications.update({ id: 'lsgd-docs', loading: false, autoClose: 3000, color: res.failed.length ? 'orange' : 'green',
        message: res.failed.length ? `Documents could not be loaded for: ${res.failed.join(', ')}` : `${res.groups.length} producers' documents added` });
      return res.groups;
    } catch {
      notifications.update({ id: 'lsgd-docs', loading: false, autoClose: 4000, color: 'orange', message: 'Documents could not be loaded — statement only' });
      return [];
    }
  };

  const doPrint = async () => {
    setBusy('print');
    try {
      if (withDocs && withDocCount) notifications.show({ id: 'lsgd-docs', loading: true, autoClose: false, message: 'Loading documents…' });
      const r = await printStatement({ ...output, withDocuments: withDocs && withDocCount > 0, onProgress: docProgress });
      if (withDocs && withDocCount) notifications.hide('lsgd-docs');
      if (!r.ok) notifications.show({ color: 'red', message: r.message });
      else if (r.failed?.length) notifications.show({ color: 'orange', message: `Documents could not be loaded for: ${r.failed.join(', ')}` });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Printing failed' });
    } finally {
      setBusy('');
    }
  };

  const makePdf = async () => buildStatementPdf({ ...output, docGroups: await loadDocs() });
  const makeExcel = async () => {
    const { XLSX, wb } = await buildStatementWorkbook(output);
    return { XLSX, wb };
  };

  const doPdf = async () => {
    setBusy('pdf');
    try {
      const doc = await makePdf();
      doc.save(reportFileName(facts, '.pdf'));
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'PDF export failed' });
    } finally {
      setBusy('');
    }
  };

  const doExcel = async () => {
    setBusy('excel');
    try {
      const { XLSX, wb } = await makeExcel();
      XLSX.writeFile(wb, reportFileName(facts, '.xlsx'));
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Excel export failed' });
    } finally {
      setBusy('');
    }
  };

  const sendEmail = async ({ to, cc, subject, message, attachPdf, attachExcel }) => {
    setBusy('email');
    try {
      const attachments = [];
      if (attachPdf) {
        const doc = await makePdf();
        attachments.push({ filename: reportFileName(facts, '.pdf'), contentType: PDF_TYPE, contentBase64: arrayBufferToBase64(doc.output('arraybuffer')) });
      }
      if (attachExcel) {
        const { XLSX, wb } = await makeExcel();
        attachments.push({ filename: reportFileName(facts, '.xlsx'), contentType: XLSX_TYPE, contentBase64: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) });
      }
      const res = await lsgdMithramAPI.email({ to, cc, subject, message, attachments });
      notifications.show({ color: 'green', message: res?.message || 'Email sent' });
      setEmailOpen(false);
    } catch (err) {
      notifications.show({ color: 'red', autoClose: 8000, message: err?.message || 'Email could not be sent' });
    } finally {
      setBusy('');
    }
  };

  const previewHtml = useMemo(() => (previewOpen ? buildStatementHtml(output) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewOpen, facts, columns, rows, totals]);

  // ── Render ─────────────────────────────────────────────────────
  const leadText = columns.findIndex((c) => c.type !== 'text');
  const textCount = leadText === -1 ? columns.length : leadText;
  const meta = report?.meta || {};

  const editableCell = (r, c, value, isManual, calcLabel, onChange, onReset) => (
    <Table.Td key={c.key} style={{ minWidth: 130 }}>
      <Group gap={2} wrap="nowrap">
        <NumberInput size="xs" value={value} min={0} decimalScale={2} hideControls
          thousandSeparator="," onChange={(v) => onChange(r.farmerId, v)}
          styles={{ input: { textAlign: 'right', fontWeight: isManual ? 700 : 400, color: isManual ? 'var(--mantine-color-orange-8)' : undefined } }}
          leftSection={isManual ? <IconPencil size={11} /> : null} w={110} />
        {isManual && (
          <Tooltip label={calcLabel}>
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={onReset}><IconArrowBackUp size={13} /></ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Table.Td>
  );

  return (
    <Box p="md">
      <Group justify="space-between" mb="md" wrap="wrap">
        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Dairy Reports · LSGD Reports</Text>
          <Group gap="xs">
            <Title order={4}>{REPORT_NAME}</Title>
            {saved && <Badge variant="light" color="green" leftSection={<IconDeviceFloppy size={11} />}>Saved: {saved.title || 'statement'}</Badge>}
          </Group>
        </div>
        <Group gap="xs" wrap="wrap">
          <Checkbox size="xs" label="Primary bank details" checked={bankShown(PRIMARY_BANK_COLUMNS)}
            onChange={(e) => setBankShown(PRIMARY_BANK_COLUMNS, e.currentTarget.checked)} />
          <Checkbox size="xs" label="Secondary bank details" checked={bankShown(SECONDARY_BANK_COLUMNS)}
            onChange={(e) => setBankShown(SECONDARY_BANK_COLUMNS, e.currentTarget.checked)} />
          <Checkbox size="xs" label={`Include attached documents${report ? ` (${withDocCount})` : ''}`} checked={withDocs}
            onChange={(e) => setWithDocs(e.currentTarget.checked)} />
          <Button size="xs" variant="default" leftSection={<IconFolderOpen size={14} />} onClick={() => setSavedListOpen(true)}>Saved Statements</Button>
          <Button size="xs" color="teal" leftSection={<IconDeviceFloppy size={14} />} disabled={!report} loading={busy === 'save'}
            onClick={() => setSaveOpen(true)}>Save</Button>
          <Button size="xs" variant="default" leftSection={<IconEye size={14} />} disabled={!canExport} onClick={() => setPreviewOpen(true)}>Preview</Button>
          <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} disabled={!canExport} loading={busy === 'print'} onClick={doPrint}>Print</Button>
          <Button size="xs" variant="light" color="red" leftSection={<IconFileTypePdf size={14} />} disabled={!canExport} loading={busy === 'pdf'} onClick={doPdf}>PDF</Button>
          <Button size="xs" variant="light" color="green" leftSection={<IconFileSpreadsheet size={14} />} disabled={!canExport} loading={busy === 'excel'} onClick={doExcel}>Excel</Button>
          <Button size="xs" variant="light" color="grape" leftSection={<IconMail size={14} />} disabled={!canExport} onClick={() => setEmailOpen(true)}>Share by Email</Button>
        </Group>
      </Group>

      <Paper withBorder p="sm" mb="md">
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
          <DateInput label="From Date" valueFormat="DD-MM-YYYY" value={fromDate} onChange={(v) => setFromDate(toYmd(v))} required />
          <DateInput label="To Date" valueFormat="DD-MM-YYYY" value={toDate} onChange={(v) => setToDate(toYmd(v))} minDate={fromDate || undefined} required />
          <NumberInput label="Subsidy Amount (₹ per litre)" value={rate} onChange={(v) => setRate(v === '' ? 0 : Number(v))}
            min={0} decimalScale={2} step={0.5} leftSection="₹" />
          <Autocomplete label="Panchayat" placeholder="Select or type the Panchayat" data={pOptions} limit={60} maxDropdownHeight={300}
            value={panchayat} disabled={scope === 'all'}
            onChange={(v) => { setPanchayat(v); setWard(''); setWardNumber(''); setWardMember(''); }}
            description={scope === 'all' ? 'All producers of the society'
              : (panchayat.trim() ? (keralaPanchayat ? `${keralaPanchayat.district} district · ${keralaPanchayat.ml}` : 'Typed name — matched loosely') : 'Kerala list, or type any name')}
            required={scope !== 'all'} />
          <Autocomplete label="Ward" placeholder={scope === 'all' ? 'All wards' : (panchayat.trim() ? 'All wards — select or type' : 'Select Panchayat first')}
            data={wOptions} limit={60} maxDropdownHeight={300} value={ward} onChange={onWardChange} disabled={scope === 'all' || !panchayat.trim()}
            description={wards.length ? `${wards.length} ward(s) in Farmer Management` : null} />
          <TextInput label="Ward Number" value={wardNumber} onChange={(e) => setWardNumber(e.currentTarget.value)}
            placeholder="Auto from ward" disabled={scope === 'all'} description={ward ? null : 'Optional — filter by number'} />
          <Autocomplete label="Ward Member Name (optional)" placeholder={members.length ? 'Select or type' : 'Type the ward member name'}
            data={[...new Set(members.map((m) => m.memberName))]} value={wardMember} onChange={setWardMember}
            description={ward ? (members.length ? 'Saved for this ward' : 'Saved for the ward on Generate') : 'Printed under Ward Member'} />
          <Stack gap={6} justify="flex-end">
            <SegmentedControl size="xs" value={scope} onChange={setScope}
              data={[{ value: 'panchayat', label: 'Panchayat' }, { value: 'all', label: 'All producers' }]} />
            <Checkbox size="xs" label="Only producers who supplied milk in the period" checked={onlySuppliers}
              onChange={(e) => setOnlySuppliers(e.currentTarget.checked)} />
            <Button leftSection={<IconPlayerPlay size={14} />} onClick={() => generate()} loading={loading}>Generate</Button>
          </Stack>
        </SimpleGrid>
      </Paper>

      {loading && <Center h={200}><Loader /></Center>}

      {!loading && !report && (
        <Center h={160}><Text c="dimmed" size="sm">Select the period and Panchayat, then click Generate</Text></Center>
      )}

      {!loading && report && (
        <Paper withBorder p="sm">
          {/* Why nothing / how it was matched */}
          {meta.matchedBy === 'none' && (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />} mb="sm" title={`No farmer found for “${meta.panchayat}”`}>
              <Text size="sm">No farmer in Farmer Management has this Panchayat (Village, Place, Post and Taluk were checked too).
                Set the Panchayat on the farmers (Farmer Management → Add / Edit Farmer → Address), or list every producer of the society.</Text>
              <Button mt="xs" size="xs" leftSection={<IconUsers size={14} />} onClick={() => generate({ scopeOverride: 'all' })}>Show all producers</Button>
            </Alert>
          )}
          {meta.matchedBy !== 'none' && meta.farmersInWard === 0 && meta.farmersInPanchayat > 0 && (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />} mb="sm">
              {meta.farmersInPanchayat} farmers found for {meta.panchayat}, but none in ward “{meta.ward || meta.wardNumber}”. Clear the Ward to see all of them.
            </Alert>
          )}
          {meta.farmersInWard > 0 && (report.rows || []).length === 0 && (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />} mb="sm">
              {meta.farmersInWard} farmers found, but none supplied milk from {dmy(meta.fromDate)} to {dmy(meta.toDate)}.
              <Button ml="sm" size="compact-xs" variant="light" onClick={() => generate({ onlySuppliersOverride: false })}>Include producers without milk</Button>
            </Alert>
          )}
          {meta.matchedBy === 'address' && (report.rows || []).length > 0 && (
            <Alert color="blue" icon={<IconInfoCircle size={16} />} mb="sm" py={6}>
              No farmer has “{meta.panchayat}” as Panchayat, so producers were matched on Village / Place / Post / Taluk. Check the list and remove anyone not in this Panchayat.
            </Alert>
          )}

          <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
            <Group gap="xs" wrap="wrap">
              <Badge variant="light">{facts.panchayat}{meta.ward ? ` · ${meta.ward}` : ''}{wardNumber ? ` · No. ${wardNumber}` : ''}</Badge>
              <Badge variant="light" color="gray">{facts.period}</Badge>
              <Badge variant="light" color="gray">FY {facts.financialYear}</Badge>
              <Badge variant="light" color="teal">{rows.length} producers</Badge>
              {removed.length > 0 && <Badge variant="light" color="red">{removed.length} removed</Badge>}
              {manualCount > 0 && <Badge variant="light" color="orange">{manualCount} amounts edited</Badge>}
              {missingBank > 0 && <Badge variant="outline" color="orange">{missingBank} without bank details</Badge>}
              {missingAadhaar > 0 && <Badge variant="outline" color="orange">{missingAadhaar} without Aadhaar</Badge>}
            </Group>
            <Group gap="xs">
              {selectedVisible.length > 0 && (
                <Button size="xs" color="red" variant="light" leftSection={<IconTrash size={14} />} onClick={() => confirmRemove(selectedVisible)}>
                  Remove selected ({selectedVisible.length})
                </Button>
              )}
              {(removed.length > 0 || manualCount > 0) && (
                <Button size="xs" variant="subtle" color="gray" leftSection={<IconArrowBackUp size={14} />} onClick={resetEdits}>Reset changes</Button>
              )}
              <Tooltip label="Fetch milk figures again — your removed rows and edited amounts are kept">
                <Button size="xs" variant="subtle" leftSection={<IconRefresh size={14} />} onClick={() => generate({ keepEdits: true })}>Refresh</Button>
              </Tooltip>
              <ColumnSettings monthCols={monthCols} hidden={hidden} toggleCol={toggleCol} setAllCols={setAllCols} allKeys={allKeys} />
            </Group>
          </Group>

          {columns.length === 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />}>Every column is hidden — select columns in Column Settings.</Alert>
          ) : (
            <ScrollArea type="auto" offsetScrollbars>
              <Table withTableBorder withColumnBorders striped highlightOnHover fz="xs" verticalSpacing={4} style={{ minWidth: 900 }}>
                <Table.Thead>
                  <HeadRows columns={columns}
                    selectAll={<Checkbox size="xs" aria-label="Select all producers" checked={allSelected}
                      indeterminate={selectedVisible.length > 0 && !allSelected} onChange={(e) => toggleAll(e.currentTarget.checked)} />} />
                </Table.Thead>
                <Table.Tbody>
                  {rows.length === 0 && (
                    <Table.Tr><Table.Td colSpan={columns.length + 2}><Text ta="center" c="dimmed" size="sm" py="md">No producers in this statement</Text></Table.Td></Table.Tr>
                  )}
                  {rows.map((r, i) => (
                    <Table.Tr key={r.farmerId} bg={selected.has(r.farmerId) ? 'var(--mantine-color-red-0)' : undefined}>
                      <Table.Td w={32} ta="center">
                        <Checkbox size="xs" aria-label={`Select ${r.producerNo}`} checked={selected.has(r.farmerId)}
                          onChange={(e) => toggleRow(r.farmerId, e.currentTarget.checked)} />
                      </Table.Td>
                      {columns.map((c) => {
                        if (c.key === 'subsidyAllotted') {
                          return editableCell(r, c, r.subsidyAllotted, r.manual, `Back to calculated ₹${fmtAmt(r.totalAmount)}`,
                            setAllotted, () => resetOne(setOverrides, r.farmerId));
                        }
                        if (c.key === 'lastSubsidy') {
                          return editableCell(r, c, r.lastSubsidy, r.lastManual,
                            `Back to ₹${fmtAmt(baseLast.get(r.farmerId) || 0)}${r.lastSubsidyPeriod ? ` (saved statement ${r.lastSubsidyPeriod})` : ''}`,
                            setLastSubsidy, () => resetOne(setLastEdits, r.farmerId));
                        }
                        const v = cellValue(r, c, i);
                        if (c.type === 'text') {
                          const missing = !v && ['accountNumber', 'ifsc', 'aadhaar'].includes(c.key);
                          return (
                            <Table.Td key={c.key} ta={c.align === 'center' ? 'center' : 'left'} style={{ whiteSpace: c.key === 'name' ? 'normal' : 'nowrap' }}>
                              {missing ? (
                                <Tooltip label="Add in Farmers Management">
                                  <Text span size="xs" c="orange" td="underline" style={{ cursor: 'pointer' }} onClick={() => setEditId(r.farmerId)}>missing</Text>
                                </Tooltip>
                              ) : v}
                            </Table.Td>
                          );
                        }
                        return (
                          <Table.Td key={c.key} ta="right" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {c.type === 'qty' ? fmtQty(v) : fmtAmt(v)}
                          </Table.Td>
                        );
                      })}
                      <Table.Td w={64} ta="center">
                        <Group gap={2} wrap="nowrap" justify="center">
                          <Tooltip label="Farmer details & documents (saved to Farmers Management)">
                            <ActionIcon size="sm" variant="subtle" onClick={() => setEditId(r.farmerId)}><IconEdit size={14} /></ActionIcon>
                          </Tooltip>
                          <Tooltip label="Remove from this statement">
                            <ActionIcon size="sm" variant="subtle" color="red" onClick={() => confirmRemove([r])}><IconTrash size={14} /></ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr style={{ background: 'var(--mantine-color-gray-1)', fontWeight: 700 }}>
                    <Table.Td />
                    {textCount > 0 && <Table.Td colSpan={textCount} ta="center" fw={700}>GRAND TOTAL</Table.Td>}
                    {columns.slice(textCount).map((c) => {
                      const v = totalValue(totals, c);
                      return (
                        <Table.Td key={c.key} ta="right" fw={700} style={{ whiteSpace: 'nowrap' }}>
                          {v == null ? '' : (c.type === 'qty' ? fmtQty(v) : `₹ ${fmtAmt(v)}`)}
                        </Table.Td>
                      );
                    })}
                    <Table.Td />
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </ScrollArea>
          )}

          <Divider my="xs" />
          <Group gap="lg" wrap="wrap">
            <Text size="sm">Total Milk: <b>{fmtQty(totals.totalMilk)} L</b></Text>
            <Text size="sm">Total Amount: <b>₹ {fmtAmt(totals.totalAmount)}</b></Text>
            <Text size="sm">Last Subsidy Allotted: <b>₹ {fmtAmt(totals.lastSubsidy)}</b></Text>
            <Text size="sm">Subsidy Allotted: <b>₹ {fmtAmt(totals.subsidyAllotted)}</b></Text>
            {removed.length > 0 && (
              <Button size="compact-xs" variant="subtle" color="red" onClick={() => setRemoved([])}>Restore {removed.length} removed</Button>
            )}
          </Group>

          <Textarea mt="sm" label="Footer note (Malayalam) — printed above the signatures"
            description="Shown in Preview, Print, PDF and Excel. Leave empty to print no note."
            autosize minRows={2} maxRows={6} value={footerNote} onChange={(e) => changeNote(e.currentTarget.value)}
            styles={{ input: { fontFamily: MALAYALAM_FONT_STACK, fontSize: 14, lineHeight: 1.6 } }}
            rightSection={footerNote !== DEFAULT_FOOTER_NOTE ? (
              <Tooltip label="Default wording"><ActionIcon size="sm" variant="subtle" color="gray" onClick={() => changeNote(DEFAULT_FOOTER_NOTE)}><IconArrowBackUp size={13} /></ActionIcon></Tooltip>
            ) : null} />
        </Paper>
      )}

      <Modal opened={previewOpen} onClose={() => setPreviewOpen(false)} title={`Print Preview — ${REPORT_NAME}`} size="95%" centered>
        <Text size="xs" c="dimmed" mb={6}>Same layout as Print / PDF{withDocs ? ' (attached documents are added when printing)' : ''}.</Text>
        <iframe title={`${REPORT_NAME} preview`} srcDoc={previewHtml}
          style={{ width: '100%', height: '75vh', border: '1px solid var(--mantine-color-gray-4)', background: '#fff' }} />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button leftSection={<IconPrinter size={14} />} loading={busy === 'print'} onClick={doPrint}>Print</Button>
        </Group>
      </Modal>

      {saveOpen && report && (
        <SaveModal
          saved={saved}
          defaultTitle={saved?.title || defaultTitle()}
          summary={`${rows.length} producers · ${fmtQty(totals.totalMilk)} L · Subsidy Allotted ₹ ${fmtAmt(totals.subsidyAllotted)}`}
          saving={busy === 'save'}
          onClose={() => setSaveOpen(false)}
          onSave={doSave}
        />
      )}

      {editRow && (
        <FarmerDetailsSyncModal row={editRow} panchayats={recordedPanchayats} onClose={() => setEditId(null)}
          onSaved={(patch) => patchRow(editRow.farmerId, patch)} />
      )}

      {savedListOpen && (
        <SavedListModal currentId={saved?._id} onClose={() => setSavedListOpen(false)} onOpen={openSaved}
          onDeleted={(id) => { if (saved?._id === id) setSaved(null); }} />
      )}

      {emailOpen && (
        <EmailModal
          onClose={() => setEmailOpen(false)}
          onSend={sendEmail}
          sending={busy === 'email'}
          withDocs={withDocs && withDocCount > 0}
          defaultSubject={`${REPORT_NAME} - ${facts.panchayat}${facts.ward ? ` - ${facts.ward}` : ''} - ${facts.period}`}
          defaultMessage={`Please find attached the ${REPORT_NAME} of ${facts.society || 'the society'} for ${facts.panchayat}${facts.ward ? `, ${facts.ward}` : ''}, period ${facts.period}.\n\nProducers: ${rows.length}\nTotal Milk: ${fmtQty(totals.totalMilk)} litres\nSubsidy Allotted: Rs. ${fmtAmt(totals.subsidyAllotted)}`}
        />
      )}
    </Box>
  );
}

function HeadRows({ columns, selectAll }) {
  const months = columns.filter((c) => c.group);
  const th = { textAlign: 'center', verticalAlign: 'middle', background: 'var(--mantine-color-gray-1)', whiteSpace: 'normal' };
  if (!months.length) {
    return (
      <Table.Tr>
        <Table.Th style={th} w={32}>{selectAll}</Table.Th>
        {columns.map((c) => <Table.Th key={c.key} style={th}>{c.label}</Table.Th>)}
        <Table.Th style={th} />
      </Table.Tr>
    );
  }
  const firstMonth = months[0].key;
  return (
    <>
      <Table.Tr>
        <Table.Th rowSpan={2} style={th} w={32}>{selectAll}</Table.Th>
        {columns.map((c) => {
          if (c.group) {
            if (c.key !== firstMonth) return null;
            return <Table.Th key="grp" colSpan={months.length} style={th}>{c.group}</Table.Th>;
          }
          return <Table.Th key={c.key} rowSpan={2} style={th}>{c.label}</Table.Th>;
        })}
        <Table.Th rowSpan={2} style={th} />
      </Table.Tr>
      <Table.Tr>
        {months.map((c) => <Table.Th key={c.key} style={th}>{c.label}</Table.Th>)}
      </Table.Tr>
    </>
  );
}

function ColumnSettings({ monthCols, hidden, toggleCol, setAllCols, allKeys }) {
  const groups = [
    { title: 'Producer details', cols: DETAIL_COLUMNS },
    { title: 'Monthly milk (Litre)', cols: monthCols },
    { title: 'Amounts', cols: AMOUNT_COLUMNS },
  ];
  const shown = allKeys.filter((k) => !hidden.has(k)).length;
  return (
    <Popover width={300} position="bottom-end" shadow="md" withinPortal>
      <Popover.Target>
        <Button size="xs" variant="light" leftSection={<IconColumns size={14} />}>Column Settings ({shown}/{allKeys.length})</Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Group justify="space-between" mb="xs">
          <Button size="compact-xs" variant="subtle" onClick={() => setAllCols(true, allKeys)}>Select all</Button>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setAllCols(false, allKeys)}>Deselect all</Button>
        </Group>
        <ScrollArea.Autosize mah={380}>
          <Stack gap="xs">
            {groups.map((g) => g.cols.length > 0 && (
              <div key={g.title}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">{g.title}</Text>
                  <Checkbox size="xs" label="All"
                    checked={g.cols.every((c) => !hidden.has(c.key))}
                    indeterminate={g.cols.some((c) => !hidden.has(c.key)) && !g.cols.every((c) => !hidden.has(c.key))}
                    onChange={(e) => setAllCols(e.currentTarget.checked, g.cols.map((c) => c.key))} />
                </Group>
                <SimpleGrid cols={2} spacing={4} verticalSpacing={4}>
                  {g.cols.map((c) => (
                    <Checkbox key={c.key} size="xs" label={c.label} checked={!hidden.has(c.key)} onChange={(e) => toggleCol(c.key, e.currentTarget.checked)} />
                  ))}
                </SimpleGrid>
              </div>
            ))}
          </Stack>
        </ScrollArea.Autosize>
        <Text size="xs" c="dimmed" mt="xs">Applies to the screen, Print, PDF, Excel and email, and is saved with the statement. Totals do not change.</Text>
      </Popover.Dropdown>
    </Popover>
  );
}

function SaveModal({ saved, defaultTitle, summary, saving, onClose, onSave }) {
  const [title, setTitle] = useState(defaultTitle);
  return (
    <Modal opened onClose={saving ? () => {} : onClose} title={saved ? `Save ${REPORT_NAME}` : `Save new ${REPORT_NAME}`} centered>
      <Stack gap="sm">
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
        <Text size="xs" c="dimmed">{summary}</Text>
        <Text size="xs" c="dimmed">Saves the Panchayat, ward, ward member, producer rows, removed producers, edited Subsidy Allotted / Last Subsidy Allotted amounts, column settings, documents option and footer note.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={saving}>Cancel</Button>
          {saved && <Button variant="light" loading={saving} onClick={() => onSave(title.trim(), true)}>Save as new</Button>}
          <Button color="teal" leftSection={<IconDeviceFloppy size={14} />} loading={saving} onClick={() => onSave(title.trim(), false)}>
            {saved ? 'Save changes' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function SavedListModal({ currentId, onClose, onOpen, onDeleted }) {
  const [list, setList] = useState(null);
  const [search, setSearch] = useState('');
  const load = useCallback(() => {
    lsgdMithramAPI.listSaved().then((r) => setList(r?.data || [])).catch((err) => {
      setList([]);
      notifications.show({ color: 'red', message: err?.message || 'Could not load saved statements' });
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = (s) => modals.openConfirmModal({
    title: 'Delete saved statement',
    children: <Text size="sm">Delete “{s.title || `${s.panchayat} ${dmy(s.fromDate)}`}”? Only the saved statement is deleted — farmers and milk records are not touched.</Text>,
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await lsgdMithramAPI.deleteSaved(s._id);
        onDeleted(s._id);
        load();
      } catch (err) {
        notifications.show({ color: 'red', message: err?.message || 'Could not delete' });
      }
    },
  });

  const q = search.trim().toLowerCase();
  const shown = (list || []).filter((s) => !q || [s.title, s.panchayat, s.ward, s.wardMember].some((v) => String(v || '').toLowerCase().includes(q)));

  return (
    <Modal opened onClose={onClose} title={`Saved ${REPORT_NAME}s`} size="xl" centered>
      <TextInput mb="sm" placeholder="Search title, Panchayat, ward…" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
      {list === null ? <Center h={120}><Loader size="sm" /></Center> : shown.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center" py="lg">No saved statements</Text>
      ) : (
        <ScrollArea.Autosize mah="60vh">
          <Table striped highlightOnHover fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th><Table.Th>Panchayat / Ward</Table.Th><Table.Th>Period</Table.Th>
                <Table.Th ta="right">Producers</Table.Th><Table.Th ta="right">Subsidy (₹)</Table.Th><Table.Th>Saved</Table.Th><Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((s) => (
                <Table.Tr key={s._id} bg={s._id === currentId ? 'var(--mantine-color-green-0)' : undefined}>
                  <Table.Td>{s.title || '-'}</Table.Td>
                  <Table.Td>{s.panchayat}{s.ward ? ` · ${s.ward}` : ''}{s.wardNumber ? ` (No. ${s.wardNumber})` : ''}</Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{dmy(s.fromDate)} – {dmy(s.toDate)}</Table.Td>
                  <Table.Td ta="right">{s.producerCount}</Table.Td>
                  <Table.Td ta="right">{fmtAmt(s.subsidyAllotted)}</Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{new Date(s.updatedAt).toLocaleString('en-IN')}{s.updatedBy ? ` · ${s.updatedBy}` : ''}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button size="compact-xs" leftSection={<IconFolderOpen size={12} />} onClick={() => onOpen(s._id)}>Open</Button>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => remove(s)}><IconTrash size={13} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}
    </Modal>
  );
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const splitEmails = (v) => String(v || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
const RECENT_KEY = 'lsgdMithram:recentEmails';

function EmailModal({ onClose, onSend, sending, withDocs, defaultSubject, defaultMessage }) {
  const recent = readJson(RECENT_KEY, []);
  const [to, setTo] = useState(recent[0] || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [attachPdf, setAttachPdf] = useState(true);
  const [attachExcel, setAttachExcel] = useState(true);
  const [error, setError] = useState('');

  const submit = useCallback(() => {
    const list = splitEmails(to);
    const ccList = splitEmails(cc);
    if (!list.length) return setError('Enter the recipient email address');
    const bad = [...list, ...ccList].filter((e) => !EMAIL_RE.test(e));
    if (bad.length) return setError(`Invalid email address: ${bad.join(', ')}`);
    if (!attachPdf && !attachExcel) return setError('Attach the PDF and/or the Excel file');
    setError('');
    localStorage.setItem(RECENT_KEY, JSON.stringify([...new Set([list.join(', '), ...recent])].slice(0, 8)));
    return onSend({ to: list.join(','), cc: ccList.join(','), subject, message, attachPdf, attachExcel });
  }, [to, cc, subject, message, attachPdf, attachExcel, onSend, recent]);

  return (
    <Modal opened onClose={sending ? () => {} : onClose} title={`Share ${REPORT_NAME} by Email`} size="lg" centered>
      <Stack gap="sm">
        <Autocomplete label="To" placeholder="name@example.com (several: separate with commas)" data={recent} value={to} onChange={setTo} required />
        <TextInput label="CC" placeholder="Optional" value={cc} onChange={(e) => setCc(e.currentTarget.value)} />
        <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
        <Textarea label="Message" autosize minRows={4} maxRows={10} value={message} onChange={(e) => setMessage(e.currentTarget.value)} />
        <Group>
          <Checkbox label={`Attach PDF${withDocs ? ' (with attached documents)' : ''}`} checked={attachPdf} onChange={(e) => setAttachPdf(e.currentTarget.checked)} />
          <Checkbox label="Attach Excel" checked={attachExcel} onChange={(e) => setAttachExcel(e.currentTarget.checked)} />
        </Group>
        {error && <Alert color="red" py={6}>{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button leftSection={<IconMail size={14} />} loading={sending} onClick={submit}>Send</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
