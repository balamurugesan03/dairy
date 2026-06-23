import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Paper, Title, Text, Button, Group, Stack,
  Select, NumberInput, Checkbox, TextInput, Divider,
  Table, Pagination, Center, Loader, ThemeIcon, Collapse,
  SegmentedControl, ActionIcon, Badge, ScrollArea, SimpleGrid,
  Tooltip, Popover,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconFileTypePdf, IconFileTypeXls, IconFilter,
  IconDroplet, IconMilk, IconDatabase,
  IconChevronDown, IconChevronUp, IconX, IconPlayerPlay,
  IconCalendar, IconUsers, IconRefresh, IconChartBar,
  IconCurrencyRupee, IconFlask, IconStack2, IconColumns,
  IconPrinter, IconChartPie,
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { milkCollectionAPI, collectionCenterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import dayjs from 'dayjs';

// ── Formatters ─────────────────────────────────────────────────────────────────
const f2  = v => Number(v || 0).toFixed(2);
const f3  = v => Number(v || 0).toFixed(3);
const f1  = v => Number(v || 0).toFixed(1);
const PAGE_SIZE = 15;

// ── Column Definitions ────────────────────────────────────────────────────────
// ml = Malayalam label (shown in table, print, excel)
// en = English label (used in PDF since jsPDF lacks Malayalam font support)
const ALL_COLUMNS = [
  { key: 'sl',           ml: '#',                en: '#',             mandatory: true,  w: 40,  align: 'center' },
  { key: 'farmerNumber', ml: 'പ്രൊ. ഐഡി',      en: 'Pro Id',        mandatory: true,  w: 70,  align: 'center' },
  { key: 'memberId',     ml: 'അംഗ നം.',          en: 'Mem No.',       mandatory: true,  w: 70,  align: 'center' },
  { key: 'farmerName',   ml: 'കർഷകൻ്റെ പേര്',  en: 'Producer Name', mandatory: true,  w: null,align: 'left'   },
  { key: 'houseName',    ml: 'വീട്ടുപേര്',       en: 'House Name',    mandatory: false, w: 120, align: 'left'   },
  { key: 'totalDays',    ml: 'ദിവസം',            en: 'Days',          mandatory: false, w: 52,  align: 'right'  },
  { key: 'totalQty',     ml: 'അളവ് (ലി.)',       en: 'Qty (L)',       mandatory: true,  w: 88,  align: 'right'  },
  { key: 'avgClr',       ml: 'CLR',               en: 'CLR',           mandatory: false, w: 56,  align: 'right'  },
  { key: 'avgFat',       ml: 'FAT (%)',            en: 'FAT (%)',       mandatory: false, w: 56,  align: 'right'  },
  { key: 'avgSnf',       ml: 'SNF (%)',            en: 'SNF (%)',       mandatory: false, w: 56,  align: 'right'  },
  { key: 'solids',       ml: 'ഖര പദാർഥം',        en: 'Solids',        mandatory: false, w: 64,  align: 'right'  },
  { key: 'avgRate',      ml: 'നിരക്ക് (₹)',      en: 'Rate (Rs)',     mandatory: false, w: 70,  align: 'right'  },
  { key: 'totalAmount',  ml: 'തുക (₹)',           en: 'Amount (Rs)',   mandatory: true,  w: 100, align: 'right'  },
];

const MANDATORY_KEYS  = new Set(ALL_COLUMNS.filter(c => c.mandatory).map(c => c.key));
const LS_COL_KEY      = 'dairy_analysis_visible_cols_v1';

// ── Condition helpers ─────────────────────────────────────────────────────────
const COND_OPS  = ['>', '<', '>=', '<=', '='].map(v => ({ value: v, label: v }));
const LOGIC_OPS = [{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }];

const applyOp = (actual, op, threshold) => {
  if (threshold === '' || threshold === null || threshold === undefined) return true;
  const n = Number(actual ?? 0), t = Number(threshold);
  if (op === '>')  return n > t;
  if (op === '<')  return n < t;
  if (op === '>=') return n >= t;
  if (op === '<=') return n <= t;
  if (op === '=')  return Math.abs(n - t) < 0.0001;
  return true;
};

const chainConditions = checks => {
  const active = checks.filter(c => c.threshold !== '' && c.threshold !== null && c.threshold !== undefined);
  if (!active.length) return true;
  let result = applyOp(active[0].actual, active[0].op, active[0].threshold);
  for (let i = 1; i < active.length; i++) {
    const ok = applyOp(active[i].actual, active[i].op, active[i].threshold);
    result = active[i - 1].logic === 'OR' ? result || ok : result && ok;
  }
  return result;
};

// ── Sub-components ────────────────────────────────────────────────────────────
const CondRow = ({ label, op, value, logic, onOp, onValue, onLogic, showLogic = true }) => (
  <Box>
    <Text size="xs" fw={600} c="dimmed" mb={3} style={{ letterSpacing: '0.3px' }}>{label}</Text>
    <Group gap={4} wrap="nowrap">
      <Select data={COND_OPS} value={op} onChange={v => onOp(v || '>')} size="xs" w={62}
        styles={{ input: { padding: '0 4px', fontWeight: 800, textAlign: 'center', fontSize: 13 } }} />
      <NumberInput value={value} onChange={onValue} size="xs" style={{ flex: 1 }} hideControls
        decimalScale={2} placeholder="—" styles={{ input: { fontWeight: 600 } }} />
      {showLogic && (
        <Select data={LOGIC_OPS} value={logic} onChange={v => onLogic(v || 'AND')} size="xs" w={62}
          styles={{ input: {
            textAlign: 'center', fontWeight: 800, fontSize: 10,
            background: logic === 'AND' ? '#dbeafe' : '#fef9c3',
            color:      logic === 'AND' ? '#1d4ed8' : '#92400e',
            border:    `1px solid ${logic === 'AND' ? '#93c5fd' : '#fcd34d'}`,
            borderRadius: 4,
          } }} />
      )}
    </Group>
  </Box>
);

const FilterCard = ({ icon: Icon, title, bg, borderColor, bgBody, count, collapsible, open, onToggle, children }) => (
  <Paper radius="md" mb="xs" style={{ border: `1px solid ${borderColor}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
    <Box px="sm" py={8} style={{ background: bg, cursor: collapsible ? 'pointer' : 'default' }} onClick={collapsible ? onToggle : undefined}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap={6}>
          <Icon size={14} color="#fff" />
          <Text size="xs" fw={700} style={{ color: '#fff', letterSpacing: '0.4px' }}>{title}</Text>
          {count > 0 && (
            <Badge size="xs" variant="filled" radius="xl"
              style={{ background: 'rgba(255,255,255,0.28)', color: '#fff', minWidth: 18, padding: '0 5px' }}>
              {count}
            </Badge>
          )}
        </Group>
        {collapsible && (open ? <IconChevronUp size={13} color="rgba(255,255,255,0.8)" /> : <IconChevronDown size={13} color="rgba(255,255,255,0.8)" />)}
      </Group>
    </Box>
    <Collapse in={collapsible ? open : true}>
      <Box p="sm" style={{ background: bgBody }}>{children}</Box>
    </Collapse>
  </Paper>
);

const KpiCard = ({ label, value, sub, icon: Icon, color }) => (
  <Paper withBorder radius="md" p="sm"
    style={{ borderLeft: `3px solid ${color}`, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Box>
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.45px', lineHeight: 1 }} mb={3}>{label}</Text>
        <Text fw={900} size="lg" style={{ color, lineHeight: 1.1 }}>{value}</Text>
        {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
      </Box>
      <ThemeIcon size={34} radius="md" variant="light" style={{ background: `${color}18`, color, flexShrink: 0 }}>
        <Icon size={17} />
      </ThemeIcon>
    </Group>
  </Paper>
);

// ══════════════════════════════════════════════════════════════════════════════
export default function MilkCollectionAnalysis() {
  const { selectedCompany } = useCompany();

  // ── Column visibility ────────────────────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_COL_KEY));
      if (Array.isArray(saved) && saved.length) {
        return ALL_COLUMNS.map(c => c.key).filter(k => MANDATORY_KEYS.has(k) || saved.includes(k));
      }
    } catch {}
    return ALL_COLUMNS.map(c => c.key);
  });

  useEffect(() => {
    localStorage.setItem(LS_COL_KEY, JSON.stringify(visibleCols));
  }, [visibleCols]);

  const toggleCol = key => {
    if (MANDATORY_KEYS.has(key)) return;
    setVisibleCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const activeColumns = useMemo(() => ALL_COLUMNS.filter(c => visibleCols.includes(c.key)), [visibleCols]);
  const optionalCols  = ALL_COLUMNS.filter(c => !c.mandatory && c.key !== 'sl');

  // ── Basic Filters ────────────────────────────────────────────────────────────
  const [fromDate,     setFromDate]     = useState(null);
  const [toDate,       setToDate]       = useState(null);
  const [centre,       setCentre]       = useState('');
  const [producerType, setProducerType] = useState('all');
  const [shift,        setShift]        = useState('Both');
  const [centres,      setCentres]      = useState([{ value: '', label: 'All Centres' }]);

  useEffect(() => {
    collectionCenterAPI.getAll()
      .then(res => {
        const list = res?.data || [];
        setCentres([
          { value: '', label: 'All Centres' },
          ...list.map(c => ({ value: c._id, label: c.centerName || c.name || 'Unnamed Centre' })),
        ]);
      })
      .catch(() => {});
  }, []);

  // ── Quality Filters ──────────────────────────────────────────────────────────
  const [qualityOpen, setQualityOpen] = useState(true);
  const [clrOp,    setClrOp]    = useState('>'); const [clrVal,   setClrVal]   = useState(''); const [clrLogic,  setClrLogic]  = useState('AND');
  const [fatOp,    setFatOp]    = useState('>'); const [fatVal,   setFatVal]   = useState(''); const [fatLogic,  setFatLogic]  = useState('AND');
  const [snfOp,    setSnfOp]    = useState('>'); const [snfVal,   setSnfVal]   = useState(''); const [snfLogic,  setSnfLogic]  = useState('AND');
  const [solidOp,  setSolidOp]  = useState('>'); const [solidVal, setSolidVal] = useState('');

  // ── Days/Qty Filters ─────────────────────────────────────────────────────────
  const [daysOp,   setDaysOp]   = useState('>'); const [daysVal,  setDaysVal]  = useState(''); const [daysLogic, setDaysLogic] = useState('AND');
  const [qtyOp,    setQtyOp]    = useState('>'); const [qtyVal,   setQtyVal]   = useState('');

  // ── Advanced Filters ─────────────────────────────────────────────────────────
  const [useGender,     setUseGender]     = useState(false); const [gender,     setGender]     = useState('');
  const [useCaste,      setUseCaste]      = useState(false); const [caste,      setCaste]      = useState('');
  const [useOccupation, setUseOccupation] = useState(false); const [occupation, setOccupation] = useState('');
  const [useCategory,   setUseCategory]   = useState(false); const [category,   setCategory]   = useState('');

  // ── Report State ─────────────────────────────────────────────────────────────
  const [rawRows,  setRawRows]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);

  const handleReset = () => {
    setClrVal(''); setFatVal(''); setSnfVal(''); setSolidVal('');
    setClrOp('>'); setFatOp('>'); setSnfOp('>'); setSolidOp('>');
    setClrLogic('AND'); setFatLogic('AND'); setSnfLogic('AND');
    setDaysVal(''); setQtyVal(''); setDaysOp('>'); setQtyOp('>'); setDaysLogic('AND');
    setUseGender(false); setGender('');
    setUseCaste(false);  setCaste('');
    setUseOccupation(false); setOccupation('');
    setUseCategory(false);   setCategory('');
    setSearch(''); setPage(1);
  };

  const handlePreview = useCallback(async () => {
    if (!fromDate || !toDate) {
      notifications.show({ color: 'red', message: 'From, To തീയതി തിരഞ്ഞെടുക്കുക', autoClose: 3000 });
      return;
    }
    setLoading(true);
    try {
      const params = {
        fromDate:   dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:     dayjs(toDate).format('YYYY-MM-DD'),
        memberType: producerType,
        ...(shift !== 'Both' && { shift }),
        ...(centre && { collectionCenter: centre }),
      };
      const res = await milkCollectionAPI.getCollectionAnalysis(params);
      setRawRows(res?.data || []);
      setSearched(true);
      setPage(1);
      setSearch('');
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'റിപ്പോർട്ട് ലോഡ് ചെയ്യുന്നതിൽ പരാജയപ്പെട്ടു' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, producerType, shift, centre]);

  // ── Client-side filtering ────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let r = rawRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(row =>
        (row.farmerName  || '').toLowerCase().includes(q) ||
        String(row.farmerNumber || '').toLowerCase().includes(q) ||
        (row.memberId    || '').toLowerCase().includes(q) ||
        (row.houseName   || '').toLowerCase().includes(q)
      );
    }
    r = r.filter(row => chainConditions([
      { actual: row.avgClr || 0,                 op: clrOp,   threshold: clrVal,   logic: clrLogic  },
      { actual: row.avgFat || 0,                 op: fatOp,   threshold: fatVal,   logic: fatLogic  },
      { actual: row.avgSnf || 0,                 op: snfOp,   threshold: snfVal,   logic: snfLogic  },
      { actual: (row.avgFat||0)+(row.avgSnf||0), op: solidOp, threshold: solidVal, logic: 'AND'     },
    ]));
    r = r.filter(row => chainConditions([
      { actual: row.totalDays || 0, op: daysOp, threshold: daysVal, logic: daysLogic },
      { actual: row.totalQty  || 0, op: qtyOp,  threshold: qtyVal,  logic: 'AND'    },
    ]));
    if (useGender     && gender)     r = r.filter(row => row.gender     === gender);
    if (useCaste      && caste)      r = r.filter(row => row.caste      === caste);
    if (useOccupation && occupation) r = r.filter(row => row.farmerType === occupation);
    if (useCategory   && category)   r = r.filter(row => row.cowType    === category);
    return r;
  }, [
    rawRows, search,
    clrOp, clrVal, clrLogic, fatOp, fatVal, fatLogic,
    snfOp, snfVal, snfLogic, solidOp, solidVal,
    daysOp, daysVal, daysLogic, qtyOp, qtyVal,
    useGender, gender, useCaste, caste,
    useOccupation, occupation, useCategory, category,
  ]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Aggregates ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => filteredRows.reduce(
    (acc, r) => ({ days: acc.days + (r.totalDays||0), qty: acc.qty + (r.totalQty||0), amount: acc.amount + (r.totalAmount||0) }),
    { days: 0, qty: 0, amount: 0 }
  ), [filteredRows]);

  const memberCount    = useMemo(() => filteredRows.filter(r => r.isMember).length, [filteredRows]);
  const totalIncentive = useMemo(() => filteredRows.reduce((s, r) => s + (r.totalIncentive || 0), 0), [filteredRows]);

  const avgClrAll  = filteredRows.length ? filteredRows.reduce((s, r) => s + (r.avgClr  || 0), 0) / filteredRows.length : 0;
  const avgFatAll  = filteredRows.length ? filteredRows.reduce((s, r) => s + (r.avgFat  || 0), 0) / filteredRows.length : 0;
  const avgSnfAll  = filteredRows.length ? filteredRows.reduce((s, r) => s + (r.avgSnf  || 0), 0) / filteredRows.length : 0;
  const avgRateAll = filteredRows.length ? filteredRows.reduce((s, r) => s + (r.avgRate || 0), 0) / filteredRows.length : 0;

  const companyName = selectedCompany?.companyName || '';
  const period      = fromDate && toDate
    ? `${dayjs(fromDate).format('DD/MM/YYYY')} - ${dayjs(toDate).format('DD/MM/YYYY')}`
    : '';

  const qualityCount = [clrVal, fatVal, snfVal, solidVal].filter(v => v !== '').length;
  const daysQtyCount = [daysVal, qtyVal].filter(v => v !== '').length;
  const advCount     = [useGender&&gender, useCaste&&caste, useOccupation&&occupation, useCategory&&category].filter(Boolean).length;
  const hasFiltered  = filteredRows.length !== rawRows.length;

  // ── Cell / footer value getters ───────────────────────────────────────────────
  const getCellValue = useCallback((row, key) => {
    switch (key) {
      case 'farmerNumber': return row.farmerNumber || '';
      case 'memberId':     return row.memberId || '—';
      case 'farmerName':   return row.farmerName || '';
      case 'houseName':    return row.houseName || '—';
      case 'totalDays':    return row.totalDays || 0;
      case 'totalQty':     return f3(row.totalQty);
      case 'avgClr':       return f1(row.avgClr || 0);
      case 'avgFat':       return f2(row.avgFat || 0);
      case 'avgSnf':       return f2(row.avgSnf || 0);
      case 'solids':       return f2((row.avgFat || 0) + (row.avgSnf || 0));
      case 'avgRate':      return f2(row.avgRate || 0);
      case 'totalAmount':  return f2(row.totalAmount);
      default:             return '';
    }
  }, []);

  const getFooterValue = useCallback((key) => {
    switch (key) {
      case 'totalDays':   return totals.days;
      case 'totalQty':    return f3(totals.qty);
      case 'avgClr':      return f1(avgClrAll);
      case 'avgFat':      return f2(avgFatAll);
      case 'avgSnf':      return f2(avgSnfAll);
      case 'solids':      return f2(avgFatAll + avgSnfAll);
      case 'avgRate':     return f2(avgRateAll);
      case 'totalAmount': return f2(totals.amount);
      default:            return '';
    }
  }, [totals, avgClrAll, avgFatAll, avgSnfAll, avgRateAll]);

  const isNonNumericKey = key => ['farmerNumber', 'memberId', 'farmerName', 'houseName'].includes(key);

  // ── PDF Export ────────────────────────────────────────────────────────────────
  // Uses English headers since jsPDF lacks Malayalam Unicode font support.
  const handlePDF = () => {
    if (!filteredRows.length) return;
    const cols = activeColumns.filter(c => c.key !== 'sl');
    const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W    = doc.internal.pageSize.getWidth();
    let y = 13;

    doc.setFontSize(13).setFont(undefined, 'bold').setTextColor(21, 128, 61);
    doc.text(companyName, W / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(11).setTextColor(30, 30, 30);
    doc.text('Milk Collection Analysis Report', W / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(8).setFont(undefined, 'normal').setTextColor(100, 100, 100);
    doc.text(`Period: ${period}`, W / 2, y, { align: 'center' }); y += 4;
    if (shift !== 'Both') { doc.text(`Shift: ${shift}`, W / 2, y, { align: 'center' }); y += 4; }
    doc.setDrawColor(21, 128, 61); doc.setLineWidth(0.4); doc.line(14, y, W - 14, y); y += 3;

    const head = [['#', ...cols.map(c => c.en)]];
    const body = filteredRows.map((r, i) => [
      i + 1,
      ...cols.map(c => {
        if (c.key === 'farmerName') return r.farmerName + (r.isMember ? ' *' : '');
        return getCellValue(r, c.key);
      }),
    ]);
    const footRow = [
      'TOTAL',
      ...cols.map(c => (isNonNumericKey(c.key) ? '' : getFooterValue(c.key))),
    ];

    autoTable(doc, {
      startY: y,
      head,
      body,
      foot: [footRow],
      styles:             { fontSize: 6.5, cellPadding: 1.4 },
      headStyles:         { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      footStyles:         { fillColor: [220, 252, 231], textColor: [21, 128, 61], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        ...Object.fromEntries(cols.map((c, i) => [
          i + 1,
          { halign: c.align, ...(c.w ? { cellWidth: Math.round(c.w / 3.78) } : {}) },
        ])),
      },
    });

    let finalY = doc.lastAutoTable.finalY + 8;
    // Summary block
    doc.setFontSize(9).setFont(undefined, 'bold').setTextColor(21, 128, 61);
    doc.text('Summary', 14, finalY); finalY += 5;
    doc.setFontSize(7.5).setFont(undefined, 'normal').setTextColor(50);
    const col3 = (W - 28) / 3;
    [
      [`Total Farmers: ${filteredRows.length}`,   `Members: ${memberCount}`,         `Non-Members: ${filteredRows.length - memberCount}`],
      [`Total Days: ${totals.days}`,               `Total Qty: ${f3(totals.qty)} L`,  `Total Amount: Rs.${f2(totals.amount)}`],
      [`Avg CLR: ${f1(avgClrAll)}`,                `Avg FAT: ${f2(avgFatAll)}%`,      `Avg SNF: ${f2(avgSnfAll)}%`],
      [`Avg Solids: ${f2(avgFatAll+avgSnfAll)}%`,  `Avg Rate: Rs.${f2(avgRateAll)}`,  `Total Incentive: Rs.${f2(totalIncentive)}`],
    ].forEach(row => {
      row.forEach((item, i) => doc.text(item, 14 + i * col3, finalY));
      finalY += 5;
    });
    finalY += 3;
    doc.setFontSize(7.5).setTextColor(120);
    doc.text(`Generated: ${dayjs().format('DD/MM/YYYY HH:mm')}`, 14, finalY);
    doc.text('Secretary / Authorized Signatory', W - 14, finalY, { align: 'right' });

    doc.save(`milk-collection-analysis-${dayjs().format('YYYYMMDD')}.pdf`);
  };

  // ── Excel Export ──────────────────────────────────────────────────────────────
  const handleExcel = async () => {
    if (!filteredRows.length) return;
    const XLSX = await import('xlsx');
    const cols = activeColumns.filter(c => c.key !== 'sl');
    const numericKeys = ['totalDays','totalQty','avgClr','avgFat','avgSnf','solids','avgRate','totalAmount'];

    const rows = [
      [companyName],
      ['ക്ഷീര ശേഖരണ വിശകലന റിപ്പോർട്ട്'],
      [`കാലയളവ്: ${period}${shift !== 'Both' ? `  |  ഷിഫ്റ്റ്: ${shift}` : ''}`],
      [],
      ['#', ...cols.map(c => c.ml)],
      ...filteredRows.map((r, i) => [
        i + 1,
        ...cols.map(c => {
          if (c.key === 'farmerName') return r.farmerName + (r.isMember ? ' ★' : '');
          const v = getCellValue(r, c.key);
          return numericKeys.includes(c.key) ? +v : v;
        }),
      ]),
      [],
      [
        'ആകെ',
        ...cols.map(c => {
          if (isNonNumericKey(c.key)) return '';
          const v = getFooterValue(c.key);
          return v === '' ? '' : +v;
        }),
      ],
      [],
      ['—— സംഗ്രഹം (Summary) ——'],
      ['ആകെ കർഷകർ (Total Farmers)',            filteredRows.length],
      ['അംഗങ്ങൾ (Members)',                      memberCount],
      ['അംഗമല്ലാത്തവർ (Non-Members)',             filteredRows.length - memberCount],
      ['ആകെ ദിവസം (Total Days)',                  totals.days],
      ['ആകെ അളവ്  (Total Qty - L)',              +f3(totals.qty)],
      ['ആകെ ഇൻസെൻ്റീവ് (Total Incentive - Rs)', +f2(totalIncentive)],
      ['ആകെ തുക (Total Amount - Rs)',             +f2(totals.amount)],
      ['ശരാശരി CLR (Avg CLR)',                    +f1(avgClrAll)],
      ['ശരാശരി FAT % (Avg FAT)',                  +f2(avgFatAll)],
      ['ശരാശരി SNF % (Avg SNF)',                  +f2(avgSnfAll)],
      ['ശരാശരി ഖര പദാർഥം % (Avg Solids)',        +f2(avgFatAll + avgSnfAll)],
      ['ശരാശരി നിരക്ക് (Avg Rate - Rs)',          +f2(avgRateAll)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [6, ...cols.map(c => {
      if (c.key === 'farmerName') return { wch: 28 };
      if (c.key === 'houseName')  return { wch: 20 };
      return { wch: c.w ? Math.round(c.w / 6) : 12 };
    })];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: cols.length } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: cols.length } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: cols.length } },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'വിശകലനം');
    XLSX.writeFile(wb, `ksheera-vishakalanm-${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  // ── Print ─────────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!filteredRows.length) return;
    const cols = activeColumns;

    const thCells = cols.map(c =>
      `<th style="background:#14532d;color:#fff;padding:6px 8px;border:1px solid #0f3d20;font-size:10px;white-space:nowrap;text-align:${c.align}">${c.ml}</th>`
    ).join('');

    const tbodyRows = filteredRows.map((r, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f0fdf4';
      const cells = cols.map(c => {
        let val;
        if      (c.key === 'sl')         val = i + 1;
        else if (c.key === 'farmerName') val = r.farmerName + (r.isMember ? ' <sup style="color:#15803d;font-weight:bold">★</sup>' : '');
        else                              val = getCellValue(r, c.key);
        return `<td style="text-align:${c.align};padding:4px 7px;border:1px solid #d1fae5;font-size:10px">${val}</td>`;
      }).join('');
      return `<tr style="background:${bg}">${cells}</tr>`;
    }).join('');

    const tfootCells = cols.map(c => {
      let val;
      if      (c.key === 'sl')          val = 'ആകെ';
      else if (isNonNumericKey(c.key))  val = '';
      else                               val = getFooterValue(c.key);
      return `<td style="text-align:${c.align};padding:6px 8px;border:1px solid #86efac;background:#dcfce7;color:#14532d;font-weight:bold;font-size:10px">${val}</td>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ക്ഷീര ശേഖരണ വിശകലനം</title>
  <style>
    @page { margin: 12mm; size: A4 landscape; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, 'Noto Sans Malayalam', sans-serif; font-size:11px; color:#1a1a1a; }
    .hdr { text-align:center; margin-bottom:10px; }
    .hdr .co { font-size:16px; font-weight:bold; color:#14532d; }
    .hdr .ti { font-size:13px; font-weight:bold; margin:3px 0; }
    .hdr .pe { font-size:10px; color:#555; }
    hr.g { border:none; border-top:2px solid #14532d; margin:8px 0; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    .smbox { margin-top:14px; border:1px solid #d1fae5; border-radius:4px; padding:10px; background:#f0fdf4; }
    .smbox h3 { font-size:11px; color:#14532d; font-weight:bold; margin-bottom:8px; }
    .smgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
    .si { background:#fff; border:1px solid #d1fae5; padding:6px 8px; border-radius:3px; }
    .si .lb { font-size:8.5px; color:#666; margin-bottom:2px; }
    .si .vl { font-size:13px; font-weight:bold; color:#14532d; }
    .pftr { margin-top:16px; display:flex; justify-content:space-between; font-size:9px; color:#666; border-top:1px solid #ccc; padding-top:6px; }
  </style>
</head>
<body>
  <div class="hdr">
    <div class="co">${companyName}</div>
    <div class="ti">ക്ഷീര ശേഖരണ വിശകലന റിപ്പോർട്ട്</div>
    <div class="pe">കാലയളവ്: ${period}${shift !== 'Both' ? `&nbsp;&nbsp;|&nbsp;&nbsp;ഷിഫ്റ്റ്: ${shift}` : ''}</div>
  </div>
  <hr class="g">
  <table>
    <thead><tr>${thCells}</tr></thead>
    <tbody>${tbodyRows}</tbody>
    <tfoot><tr>${tfootCells}</tr></tfoot>
  </table>
  <div class="smbox">
    <h3>സംഗ്രഹം (Summary)</h3>
    <div class="smgrid">
      <div class="si"><div class="lb">ആകെ കർഷകർ</div><div class="vl">${filteredRows.length}</div></div>
      <div class="si"><div class="lb">അംഗങ്ങൾ / അംഗമല്ലാത്തവർ</div><div class="vl">${memberCount} / ${filteredRows.length - memberCount}</div></div>
      <div class="si"><div class="lb">ആകെ ദിവസം</div><div class="vl">${totals.days}</div></div>
      <div class="si"><div class="lb">ആകെ അളവ്</div><div class="vl">${f3(totals.qty)} ലി.</div></div>
      <div class="si"><div class="lb">ശരാശരി CLR</div><div class="vl">${f1(avgClrAll)}</div></div>
      <div class="si"><div class="lb">ശരാശരി FAT%</div><div class="vl">${f2(avgFatAll)}</div></div>
      <div class="si"><div class="lb">ശരാശരി SNF%</div><div class="vl">${f2(avgSnfAll)}</div></div>
      <div class="si"><div class="lb">ആകെ ഇൻസെൻ്റീവ്</div><div class="vl">₹${f2(totalIncentive)}</div></div>
      <div class="si"><div class="lb">ശരാശരി നിരക്ക്</div><div class="vl">₹${f2(avgRateAll)}</div></div>
      <div class="si"><div class="lb">ആകെ തുക</div><div class="vl" style="color:#15803d">₹${f2(totals.amount)}</div></div>
    </div>
  </div>
  <div class="pftr">
    <span>തയ്യാറാക്കിയത്: ${dayjs().format('DD/MM/YYYY HH:mm')}</span>
    <span>സെക്രട്ടറി / ചുമതലപ്പെട്ട ഉദ്യോഗസ്ഥർ</span>
  </div>
  <script>setTimeout(()=>window.print(),350);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      notifications.show({ color: 'orange', message: 'Pop-up blocked. Please allow pop-ups for this site.' });
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box style={{ background: '#f4f6fb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Page Header ── */}
      <Box px="lg" py="xs" style={{
        background: 'linear-gradient(135deg, #14532d 0%, #15803d 60%, #16a34a 100%)',
        boxShadow: '0 3px 16px rgba(21,128,61,0.30)', flexShrink: 0,
      }}>
        <Group justify="space-between" align="center">
          <Group gap="sm" wrap="nowrap">
            <Box style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconMilk size={20} color="#fff" />
            </Box>
            <Stack gap={0}>
              <Title order={5} style={{ color: '#fff', lineHeight: 1.2, fontWeight: 800 }}>
                ക്ഷീര ശേഖരണ വിശകലനം
              </Title>
              <Text size="xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
                Milk Collection Analysis Report
              </Text>
            </Stack>
          </Group>
          <Group gap="xs" wrap="nowrap">
            {searched && filteredRows.length > 0 && (
              <>
                <Tooltip label="Print Report" withArrow>
                  <Button size="xs" variant="white" radius="md" c="#374151"
                    leftSection={<IconPrinter size={14} />} onClick={handlePrint}>
                    Print
                  </Button>
                </Tooltip>
                <Tooltip label="Export as PDF" withArrow>
                  <Button size="xs" variant="white" radius="md" c="#dc2626"
                    leftSection={<IconFileTypePdf size={14} />} onClick={handlePDF}>
                    PDF
                  </Button>
                </Tooltip>
                <Tooltip label="Export as Excel" withArrow>
                  <Button size="xs" variant="white" radius="md" c="#15803d"
                    leftSection={<IconFileTypeXls size={14} />} onClick={handleExcel}>
                    Excel
                  </Button>
                </Tooltip>
              </>
            )}
            {companyName && (
              <Badge variant="filled" size="sm" radius="md"
                style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', maxWidth: 220 }}>
                {companyName}
              </Badge>
            )}
          </Group>
        </Group>
      </Box>

      {/* ── Body ── */}
      <Box style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ════════ LEFT PANEL ════════ */}
        <Box style={{
          width: 292, flexShrink: 0,
          background: '#fff', borderRight: '1px solid #e8edf4',
          overflowY: 'auto', height: 'calc(100vh - 58px)',
        }}>
          <ScrollArea h="100%" type="scroll">
            <Box p="md" pb="xl">
              <Group gap={6} mb="sm">
                <IconCalendar size={13} color="#6b7280" />
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.7px' }}>
                  Date &amp; Centre
                </Text>
              </Group>

              <Stack gap="xs" mb="sm">
                <DatePickerInput label="From Date" placeholder="DD/MM/YYYY"
                  value={fromDate} onChange={setFromDate} valueFormat="DD/MM/YYYY"
                  size="xs" clearable leftSection={<IconCalendar size={13} color="#9ca3af" />} />
                <DatePickerInput label="To Date" placeholder="DD/MM/YYYY"
                  value={toDate} onChange={setToDate} valueFormat="DD/MM/YYYY"
                  size="xs" clearable leftSection={<IconCalendar size={13} color="#9ca3af" />} />
                <Select label="Collection Center" data={centres} value={centre}
                  onChange={v => setCentre(v || '')} size="xs" clearable searchable placeholder="All Centres" />
                <Select label="Producer Type"
                  data={[
                    { value: 'all',       label: 'All Producers' },
                    { value: 'member',    label: 'Member Only' },
                    { value: 'nonMember', label: 'Non-Member Only' },
                  ]}
                  value={producerType} onChange={v => setProducerType(v || 'all')} size="xs" />
                <Box>
                  <Text size="xs" fw={600} c="dimmed" mb={4} style={{ letterSpacing: '0.3px' }}>Shift</Text>
                  <SegmentedControl data={['Both', 'AM', 'PM']} value={shift} onChange={setShift}
                    size="xs" fullWidth color="green" styles={{ root: { background: '#f1f5f9' } }} />
                </Box>
              </Stack>

              <Button fullWidth size="sm" radius="md" color="green"
                leftSection={<IconPlayerPlay size={14} />}
                onClick={handlePreview} loading={loading}
                style={{ fontWeight: 700, marginBottom: 4 }}>
                Preview Report
              </Button>
              {searched && (
                <Button fullWidth size="xs" variant="subtle" color="gray" radius="md"
                  leftSection={<IconRefresh size={13} />} mt={4}
                  onClick={() => { handleReset(); setRawRows([]); setSearched(false); }}>
                  Clear All
                </Button>
              )}

              <Divider my="md" color="#f1f5f9" />

              {/* Milk Quality */}
              <FilterCard icon={IconDroplet} title="Milk Quality Filters"
                bg="#15803d" borderColor="#bbf7d0" bgBody="#f0fdf4"
                count={qualityCount} collapsible open={qualityOpen} onToggle={() => setQualityOpen(o => !o)}>
                <Stack gap="xs">
                  <CondRow label="CLR" op={clrOp} value={clrVal} logic={clrLogic}
                    onOp={setClrOp} onValue={setClrVal} onLogic={setClrLogic} />
                  <CondRow label="FAT (%)" op={fatOp} value={fatVal} logic={fatLogic}
                    onOp={setFatOp} onValue={setFatVal} onLogic={setFatLogic} />
                  <CondRow label="SNF (%)" op={snfOp} value={snfVal} logic={snfLogic}
                    onOp={setSnfOp} onValue={setSnfVal} onLogic={setSnfLogic} />
                  <CondRow label="Total Solids (FAT + SNF)" op={solidOp} value={solidVal}
                    onOp={setSolidOp} onValue={setSolidVal} showLogic={false} />
                </Stack>
              </FilterCard>

              {/* Days & Qty */}
              <FilterCard icon={IconStack2} title="Pouring Days & Quantity"
                bg="#b91c1c" borderColor="#fecaca" bgBody="#fff5f5" count={daysQtyCount}>
                <Stack gap="xs">
                  <CondRow label="Pouring Days" op={daysOp} value={daysVal} logic={daysLogic}
                    onOp={setDaysOp} onValue={setDaysVal} onLogic={setDaysLogic} />
                  <CondRow label="Quantity (Litres)" op={qtyOp} value={qtyVal}
                    onOp={setQtyOp} onValue={setQtyVal} showLogic={false} />
                </Stack>
              </FilterCard>

              {/* Advanced */}
              <FilterCard icon={IconFilter} title="Advanced Filters"
                bg="#b45309" borderColor="#fde68a" bgBody="#fffbeb" count={advCount}>
                <Stack gap="sm">
                  {[
                    { key: 'gender',     label: 'Gender',       use: useGender,     setUse: setUseGender,     val: gender,     setVal: setGender,     data: ['Male', 'Female', 'Other'] },
                    { key: 'caste',      label: 'Caste',        use: useCaste,      setUse: setUseCaste,      val: caste,      setVal: setCaste,      data: ['General', 'OBC', 'SC', 'ST', 'Other'] },
                    { key: 'occupation', label: 'Occupation',   use: useOccupation, setUse: setUseOccupation, val: occupation, setVal: setOccupation, data: ['Farmer', 'Dairy', 'Agriculture', 'Business', 'Government', 'Daily Wage', 'Other'] },
                    { key: 'category',   label: 'Cow Category', use: useCategory,   setUse: setUseCategory,   val: category,   setVal: setCategory,   data: ['HF', 'Jersey', 'Local', 'Mixed', 'Cross Breed'] },
                  ].map(f => (
                    <Box key={f.key}>
                      <Group gap={6} mb={3}>
                        <Checkbox checked={f.use} onChange={e => { f.setUse(e.currentTarget.checked); if (!e.currentTarget.checked) f.setVal(''); }} size="xs" color="orange" />
                        <Text size="xs" fw={f.use ? 700 : 500} c={f.use ? 'dark' : 'dimmed'}
                          onClick={() => f.setUse(u => !u)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {f.label}
                        </Text>
                      </Group>
                      <Select data={f.data} value={f.val} onChange={v => f.setVal(v || '')}
                        size="xs" disabled={!f.use} placeholder={`Select ${f.label.toLowerCase()}…`}
                        clearable styles={!f.use ? { input: { opacity: 0.38 } } : {}} />
                    </Box>
                  ))}
                </Stack>
              </FilterCard>
            </Box>
          </ScrollArea>
        </Box>

        {/* ════════ RIGHT PANEL ════════ */}
        <Box style={{ flex: 1, overflowY: 'auto', height: 'calc(100vh - 58px)', minWidth: 0 }}>

          {loading && (
            <Center py={120}>
              <Stack align="center" gap="sm">
                <Loader size="lg" color="green" type="dots" />
                <Text size="sm" fw={500} c="dimmed">ഡാറ്റ ലോഡ് ചെയ്യുന്നു…</Text>
              </Stack>
            </Center>
          )}

          {!loading && !searched && (
            <Center py={120}>
              <Stack align="center" gap="lg" maw={340}>
                <Box style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(21,128,61,0.18)' }}>
                  <IconChartBar size={40} color="#15803d" />
                </Box>
                <Stack align="center" gap={6}>
                  <Text size="lg" fw={800} c="dark" ta="center">ക്ഷീര ശേഖരണ വിശകലനം</Text>
                  <Text size="sm" c="dimmed" ta="center" lh={1.6}>
                    ഇടതുവശത്തെ ഫിൽട്ടറുകൾ ക്രമീകരിച്ച് <strong>Preview Report</strong> ക്ലിക്ക് ചെയ്യുക.
                  </Text>
                </Stack>
                <SimpleGrid cols={3} spacing="xs" w="100%">
                  {[
                    { label: 'CLR ഫിൽട്ടർ', icon: IconFlask,         color: '#15803d' },
                    { label: 'FAT / SNF',     icon: IconDroplet,       color: '#0369a1' },
                    { label: 'ആകെ തുക',       icon: IconCurrencyRupee, color: '#be185d' },
                  ].map(({ label, icon: Icon, color }) => (
                    <Paper key={label} withBorder radius="md" p="xs" ta="center"
                      style={{ borderColor: `${color}30`, background: `${color}08` }}>
                      <Icon size={18} color={color} />
                      <Text size="xs" c="dimmed" mt={3}>{label}</Text>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            </Center>
          )}

          {!loading && searched && filteredRows.length === 0 && (
            <Center py={120}>
              <Stack align="center" gap="md">
                <ThemeIcon size={80} variant="light" color="gray" radius="xl">
                  <IconDatabase size={38} />
                </ThemeIcon>
                <Stack align="center" gap={6}>
                  <Text size="md" fw={700} c="dimmed">ഡാറ്റ ലഭ്യമല്ല</Text>
                  <Text size="sm" c="dimmed" ta="center">
                    {rawRows.length > 0
                      ? `${rawRows.length} റെക്കോർഡുകൾ ലഭിച്ചു, എന്നാൽ ഫിൽട്ടർ കൊണ്ട് ഒഴിവാക്കപ്പെട്ടു.`
                      : 'തിരഞ്ഞെടുത്ത തീയതി ശ്രേണിയിൽ ഡാറ്റ ഇല്ല.'}
                  </Text>
                </Stack>
                <Group gap="xs">
                  {rawRows.length > 0 && (
                    <Button variant="light" color="green" size="xs" onClick={handleReset}>
                      ഫിൽട്ടർ മായ്ക്കുക
                    </Button>
                  )}
                  <Button variant="light" color="gray" size="xs"
                    onClick={() => { setRawRows([]); setSearched(false); handleReset(); }}>
                    Reset All
                  </Button>
                </Group>
              </Stack>
            </Center>
          )}

          {!loading && searched && filteredRows.length > 0 && (
            <Box p="md">

              {/* ── Toolbar ── */}
              <Group justify="space-between" mb="sm" wrap="wrap" gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <TextInput placeholder="തിരയുക — പേര്, Pro ID, അംഗ നം…"
                    leftSection={<IconSearch size={14} />}
                    value={search} onChange={e => { setSearch(e.currentTarget.value); setPage(1); }}
                    size="xs" style={{ minWidth: 230 }}
                    rightSection={search
                      ? <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => { setSearch(''); setPage(1); }}>
                          <IconX size={12} />
                        </ActionIcon>
                      : null} />
                  <Badge variant="filled" color="green" size="sm" radius="md">
                    {filteredRows.length} കർഷകർ{hasFiltered && ` / ${rawRows.length}`}
                  </Badge>
                  {period && <Badge variant="light" color="gray" size="sm" radius="sm">{period}</Badge>}
                  {shift !== 'Both' && <Badge variant="light" color="blue" size="sm">{shift} Shift</Badge>}
                </Group>
                <Group gap="xs">
                  {/* Column Picker */}
                  <Popover width={260} position="bottom-end" withArrow shadow="xl" radius="md">
                    <Popover.Target>
                      <Tooltip label="Customize Columns" withArrow>
                        <Button size="xs" variant="light" color="violet" radius="md"
                          leftSection={<IconColumns size={13} />}>
                          Columns
                          {visibleCols.length < ALL_COLUMNS.length && (
                            <Badge size="xs" variant="filled" color="violet" ml={4} radius="xl"
                              style={{ minWidth: 16, padding: '0 4px' }}>
                              {ALL_COLUMNS.length - visibleCols.length}
                            </Badge>
                          )}
                        </Button>
                      </Tooltip>
                    </Popover.Target>
                    <Popover.Dropdown p="sm">
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={700} c="dimmed">Column Customization</Text>
                        <Button size="xs" variant="subtle" color="green"
                          onClick={() => setVisibleCols(ALL_COLUMNS.map(c => c.key))}>
                          Show All
                        </Button>
                      </Group>
                      <Stack gap={6}>
                        {ALL_COLUMNS.filter(c => c.key !== 'sl').map(c => (
                          <Group key={c.key} gap={8} justify="space-between" wrap="nowrap">
                            <Group gap={6} wrap="nowrap">
                              <Checkbox
                                checked={visibleCols.includes(c.key)}
                                onChange={() => toggleCol(c.key)}
                                disabled={MANDATORY_KEYS.has(c.key)}
                                size="xs"
                                color="green"
                              />
                              <Box>
                                <Text size="xs" fw={500} style={{ lineHeight: 1.2 }}>{c.ml}</Text>
                                <Text size="10px" c="dimmed" style={{ lineHeight: 1.2 }}>{c.en}</Text>
                              </Box>
                            </Group>
                            {MANDATORY_KEYS.has(c.key) && (
                              <Badge size="xs" variant="outline" color="orange" style={{ flexShrink: 0 }}>
                                Required
                              </Badge>
                            )}
                          </Group>
                        ))}
                      </Stack>
                    </Popover.Dropdown>
                  </Popover>

                  <Button size="xs" variant="light" color="dark" radius="md"
                    leftSection={<IconPrinter size={13} />} onClick={handlePrint}>
                    Print
                  </Button>
                  <Button size="xs" variant="light" color="red" radius="md"
                    leftSection={<IconFileTypePdf size={13} />} onClick={handlePDF}>
                    PDF
                  </Button>
                  <Button size="xs" variant="light" color="teal" radius="md"
                    leftSection={<IconFileTypeXls size={13} />} onClick={handleExcel}>
                    Excel
                  </Button>
                </Group>
              </Group>

              {/* ── KPI Cards ── */}
              <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="sm" spacing="sm">
                <KpiCard label="കർഷകർ"      value={filteredRows.length}      icon={IconUsers}         color="#15803d" sub={`${memberCount} അംഗങ്ങൾ`} />
                <KpiCard label="ദിവസം"       value={totals.days}              icon={IconCalendar}      color="#0369a1" />
                <KpiCard label="അളവ് (ലി.)"  value={f3(totals.qty)}           icon={IconDroplet}       color="#7c3aed" />
                <KpiCard label="ശരാശരി CLR"  value={f1(avgClrAll)}            icon={IconFlask}         color="#0f766e" />
                <KpiCard label="ശരാശരി FAT%" value={f2(avgFatAll)}            icon={IconDroplet}       color="#b45309" />
                <KpiCard label="ആകെ തുക (₹)" value={`₹${f2(totals.amount)}`} icon={IconCurrencyRupee} color="#be185d" />
              </SimpleGrid>

              {/* ── Summary Box ── */}
              <Paper withBorder radius="md" p="sm" mb="sm"
                style={{ borderLeft: '3px solid #15803d', background: '#f0fdf4' }}>
                <Group mb={8} gap={6}>
                  <IconChartPie size={14} color="#15803d" />
                  <Text size="xs" fw={800} tt="uppercase" c="green" style={{ letterSpacing: '0.5px' }}>
                    സംഗ്രഹം (Report Summary)
                  </Text>
                </Group>
                <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="xs">
                  {[
                    { label: 'ആകെ കർഷകർ',      value: filteredRows.length,                                   color: '#15803d' },
                    { label: 'അംഗങ്ങൾ',          value: `${memberCount} / ${filteredRows.length - memberCount} (Non)`, color: '#0369a1' },
                    { label: 'ആകെ ദിവസം',        value: totals.days,                                           color: '#6d28d9' },
                    { label: 'ആകെ അളവ്',          value: `${f3(totals.qty)} ലി.`,                              color: '#0f766e' },
                    { label: 'ആകെ ഇൻസെൻ്റീവ്',  value: `₹${f2(totalIncentive)}`,                             color: '#b45309' },
                    { label: 'ശരാശരി CLR',        value: f1(avgClrAll),                                         color: '#0f766e' },
                    { label: 'ശരാശരി FAT%',       value: f2(avgFatAll),                                         color: '#b45309' },
                    { label: 'ശരാശരി SNF%',       value: f2(avgSnfAll),                                         color: '#7c3aed' },
                    { label: 'ശരാശരി ഖര പദാർഥം', value: `${f2(avgFatAll + avgSnfAll)}%`,                      color: '#0891b2' },
                    { label: 'ആകെ തുക',           value: `₹${f2(totals.amount)}`,                              color: '#be185d' },
                  ].map(({ label, value, color }) => (
                    <Box key={label}
                      style={{ background: '#fff', borderRadius: 6, padding: '6px 10px', border: `1px solid ${color}20` }}>
                      <Text size="10px" c="dimmed" mb={1}>{label}</Text>
                      <Text fw={700} size="xs" style={{ color }}>{value}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Paper>

              {/* ── Table ── */}
              <Paper withBorder radius="md" style={{ overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                <ScrollArea>
                  <Table withColumnBorders fz={12} style={{ minWidth: 800 }}>
                    <Table.Thead>
                      <Table.Tr>
                        {activeColumns.map(col => (
                          <Table.Th key={col.key} ta={col.align}
                            style={{
                              background: '#15803d', color: '#fff', fontWeight: 700,
                              fontSize: 11, whiteSpace: 'nowrap', padding: '9px 10px',
                              position: 'sticky', top: 0, zIndex: 2,
                              ...(col.w ? { width: col.w } : {}),
                            }}>
                            {col.ml}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pageRows.map((r, i) => {
                        const idx  = (page - 1) * PAGE_SIZE + i;
                        const even = idx % 2 === 0;
                        return (
                          <Table.Tr key={r.farmerNumber || idx}
                            style={{ background: even ? '#fff' : '#f9fafb', cursor: 'default' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                            onMouseLeave={e => (e.currentTarget.style.background = even ? '#fff' : '#f9fafb')}>
                            {activeColumns.map(col => {
                              if (col.key === 'sl') return (
                                <Table.Td key="sl" ta="center" c="dimmed" style={{ padding: '6px 10px', fontSize: 11 }}>
                                  {idx + 1}
                                </Table.Td>
                              );
                              if (col.key === 'farmerName') return (
                                <Table.Td key="farmerName" fw={600} style={{ padding: '6px 10px' }}>
                                  {r.farmerName}
                                  {r.isMember && (
                                    <Badge size="xs" variant="dot" color="green" ml={5}
                                      style={{ verticalAlign: 'middle' }}>അം</Badge>
                                  )}
                                </Table.Td>
                              );
                              if (col.key === 'totalAmount') return (
                                <Table.Td key="totalAmount" ta="right" fw={700}
                                  style={{ padding: '6px 10px', color: '#15803d' }}>
                                  {f2(r.totalAmount)}
                                </Table.Td>
                              );
                              if (col.key === 'solids') return (
                                <Table.Td key="solids" ta="right" fw={500}
                                  style={{ padding: '6px 10px', color: '#0f766e' }}>
                                  {f2((r.avgFat || 0) + (r.avgSnf || 0))}
                                </Table.Td>
                              );
                              return (
                                <Table.Td key={col.key} ta={col.align}
                                  style={{ padding: '6px 10px', color: col.align === 'center' ? '#374151' : undefined }}>
                                  {getCellValue(r, col.key)}
                                </Table.Td>
                              );
                            })}
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr style={{ background: '#dcfce7' }}>
                        {activeColumns.map((col, ci) => {
                          if (col.key === 'sl') return (
                            <Table.Td key="sl" ta="right" fw={700}
                              style={{ padding: '8px 10px', color: '#15803d', fontSize: 12 }}>
                              ആകെ
                            </Table.Td>
                          );
                          if (isNonNumericKey(col.key) && col.key !== 'farmerName') return (
                            <Table.Td key={col.key} style={{ padding: '8px 10px' }} />
                          );
                          if (col.key === 'farmerName') return (
                            <Table.Td key="farmerName" fw={700}
                              style={{ padding: '8px 10px', color: '#15803d', fontSize: 12 }}>
                              {filteredRows.length} കർഷകർ
                            </Table.Td>
                          );
                          const fv = getFooterValue(col.key);
                          const isAmt = col.key === 'totalAmount';
                          return (
                            <Table.Td key={col.key} ta="right" fw={isAmt ? 800 : 600}
                              style={{ padding: '8px 10px', color: isAmt ? '#15803d' : '#0f766e', fontSize: isAmt ? 13 : 12 }}>
                              {isAmt ? `₹${fv}` : fv}
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </ScrollArea>
              </Paper>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <Group justify="space-between" mt="sm" align="center" wrap="wrap" gap="xs">
                  <Text size="xs" c="dimmed">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} / {filteredRows.length} കർഷകർ
                  </Text>
                  <Pagination total={totalPages} value={page} onChange={p => setPage(p)}
                    size="sm" color="green" radius="md" boundaries={1} siblings={1} />
                </Group>
              )}

              {/* ── Footer ── */}
              <Group justify="space-between" mt="sm" wrap="wrap">
                <Text size="xs" c="dimmed">CLR മൂല്യങ്ങൾ ഓരോ കർഷകനും ശരാശരി കണക്കാക്കിയിരിക്കുന്നു</Text>
                <Text size="xs" c="dimmed">തയ്യാറാക്കിയത്: {dayjs().format('DD/MM/YYYY HH:mm')}</Text>
              </Group>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
