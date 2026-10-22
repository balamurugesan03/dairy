/**
 * RateChargeTable.jsx
 * ─────────────────────────────────────────────────────────────────
 * Full rate / charge table for a rate chart type, used both as the
 * "Rate Charge Table" page and embedded in Machine Configuration.
 *
 *   TS Rate / Apply Formula → FAT (rows) × SNF (columns) rate matrix
 *   Manual / Low / Slab / Add-Less / Milma → saved records
 *
 * The grid renders only the rows in view, so very large charts
 * (FAT 1–40 × SNF 5–20 ≈ 59k rates) stay smooth. Download Chart (PDF)
 * and Export (Excel) always write the complete table.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Paper, Title, Text, Group, Button, Select, NumberInput,
  SegmentedControl, Badge, ThemeIcon, Center, Loader, Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTable, IconDownload, IconFileSpreadsheet, IconInfoCircle
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import { rateChartAPI, milkPurchaseSettingsAPI, milmaChartAPI } from '../../services/api';
import { formulaRate, tsRateValue, findTsPeriod, tenthSteps, MILK_PRESETS, CHART_TYPES } from '../../utils/rateChart';

const LOADERS = {
  TSRate:        () => rateChartAPI.getTsRates(),
  ApplyFormula:  () => rateChartAPI.getFormulas(),
  ManualEntry:   () => rateChartAPI.getManualEntries(),
  LowChart:      () => rateChartAPI.getLowCharts(),
  SlabRate:      () => rateChartAPI.getSlabRates(),
  GoldLessChart: () => rateChartAPI.getGoldLessCharts(),
  MilmaChart:    () => milmaChartAPI.getMasters(),
};

const MATRIX_TYPES = ['TSRate', 'ApplyFormula'];
const fmtDate = d => (d ? dayjs(d).format('DD-MM-YYYY') : '');
const periodLabel = r => `${fmtDate(r.fromDate)} → ${r.toDate ? fmtDate(r.toDate) : 'Open'}`;
const typeLabel = t => CHART_TYPES.find(c => c.value === t)?.label || t;

// ─── Virtualised grid: sticky header row + sticky first column ────────────────
const ROW_H = 28;

// Callers pass a key that changes with the data, so a new table starts scrolled to the top
function VirtualGrid({ head, body, height }) {
  const ref = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH,     setViewH]     = useState(1000); // refined on first scroll; the 20-row buffer covers the rest

  // height may be a CSS calc(), so the visible window uses the measured height
  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 10);
  const last  = Math.min(body.length, first + Math.ceil(viewH / ROW_H) + 20);

  const cell = {
    padding: '0 10px', height: ROW_H, whiteSpace: 'nowrap', textAlign: 'right',
    borderRight: '1px solid var(--mantine-color-gray-3)',
    borderBottom: '1px solid var(--mantine-color-gray-3)',
    fontSize: 12, fontVariantNumeric: 'tabular-nums',
  };
  const headCell = {
    ...cell, position: 'sticky', top: 0, zIndex: 2, fontWeight: 700,
    background: 'var(--mantine-color-teal-1)', color: 'var(--mantine-color-teal-9)',
  };
  const firstCol = {
    position: 'sticky', left: 0, zIndex: 1, fontWeight: 700, textAlign: 'left',
    background: 'var(--mantine-color-gray-0)',
  };

  return (
    <Box
      ref={ref}
      onScroll={e => { setScrollTop(e.currentTarget.scrollTop); setViewH(e.currentTarget.clientHeight); }}
      style={{
        height, minHeight: 300, overflow: 'auto', border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 6, background: 'var(--mantine-color-white)',
      }}
    >
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={i === 0 ? { ...headCell, ...firstCol, zIndex: 3, background: 'var(--mantine-color-teal-2)' } : headCell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {first > 0 && <tr style={{ height: first * ROW_H }}><td colSpan={head.length} /></tr>}
          {body.slice(first, last).map((row, i) => (
            <tr key={first + i} style={{ background: (first + i) % 2 ? 'var(--mantine-color-gray-0)' : 'transparent' }}>
              {row.map((v, j) => (
                <td key={j} style={j === 0 ? { ...cell, ...firstCol } : cell}>{v}</td>
              ))}
            </tr>
          ))}
          {last < body.length && <tr style={{ height: (body.length - last) * ROW_H }}><td colSpan={head.length} /></tr>}
        </tbody>
      </table>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
//  chartType — fixes the chart (embedded use); omitted → user picks, default = active
// ══════════════════════════════════════════════════════════════════════════════
export default function RateChargeTable({ chartType: fixedType, embedded = false }) {
  const [activeType, setActiveType] = useState(null);
  const [type,       setType]       = useState(fixedType || null);
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [recordId,   setRecordId]   = useState(null);
  const [preset,     setPreset]     = useState('Cow');
  const [range,      setRange]      = useState(MILK_PRESETS.Cow);
  const [exporting,  setExporting]  = useState(false);

  useEffect(() => { if (fixedType) setType(fixedType); }, [fixedType]);

  // Active chart from Machine Configuration — default selection on the standalone page
  useEffect(() => {
    milkPurchaseSettingsAPI.getSummary()
      .then(res => {
        const t = res?.data?.activeRateChartType;
        setActiveType(t || null);
        if (!fixedType) setType(prev => prev || (LOADERS[t] ? t : 'TSRate'));
      })
      .catch(() => { if (!fixedType) setType(prev => prev || 'TSRate'); });
  }, [fixedType]);

  useEffect(() => {
    if (!type || !LOADERS[type]) return;
    let live = true;
    setLoading(true);
    setRecords([]);
    LOADERS[type]()
      .then(res => {
        if (!live) return;
        const rows = res?.data || [];
        setRecords(rows);
        // Default period: the one in force today, else the latest
        if (type === 'TSRate') setRecordId((findTsPeriod(rows) || rows[0])?._id || null);
        else if (type === 'ApplyFormula') {
          const today = dayjs().format('YYYY-MM-DD');
          const eff = rows.find(r => dayjs(r.fromDate).format('YYYY-MM-DD') <= today);
          setRecordId((eff || rows[0])?._id || null);
        } else setRecordId(null);
      })
      .catch(() => { if (live) setRecords([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [type]);

  const record   = records.find(r => r._id === recordId) || null;
  const isMatrix = MATRIX_TYPES.includes(type);

  // Formula ranges come from the saved Min/Max FAT & SNF; TS ranges are chosen here
  const formulaRangeMissing = type === 'ApplyFormula' && record &&
    !(record.maxFAT > 0 && record.maxSNF > 0);
  const effRange = type === 'ApplyFormula' && record && !formulaRangeMissing
    ? { fatMin: record.minFAT, fatMax: record.maxFAT, snfMin: record.minSNF, snfMax: record.maxSNF }
    : range;

  // ── Build the complete table (head + body) ─────────────────────────────────
  const table = useMemo(() => {
    if (isMatrix) {
      if (!record) return { head: [], body: [], numeric: [] };
      const fats = tenthSteps(effRange.fatMin, effRange.fatMax);
      const snfs = tenthSteps(effRange.snfMin, effRange.snfMax);
      const rateOf = type === 'TSRate'
        ? (f, s) => tsRateValue(f, s, record.tsRate)
        : (f, s) => formulaRate(f, s, record);
      const numeric = fats.map(f => [f, ...snfs.map(s => Math.round(rateOf(f, s) * 100) / 100)]);
      return {
        head: ['FAT \\ SNF', ...snfs.map(s => s.toFixed(1))],
        body: numeric.map(r => [r[0].toFixed(1), ...r.slice(1).map(v => v.toFixed(2))]),
        numeric,
        fats: fats.length, snfs: snfs.length,
      };
    }
    const cols = {
      ManualEntry:   [['From Date', r => fmtDate(r.fromDate)], ['CLR', r => r.clr], ['FAT', r => r.fat], ['SNF', r => r.snf], ['Rate', r => r.rate]],
      LowChart:      [['From Date', r => fmtDate(r.fromDate)], ['CLR', r => r.clr], ['FAT', r => r.fat], ['SNF', r => r.snf], ['Rate', r => r.rate]],
      SlabRate:      [['From Date', r => fmtDate(r.fromDate)], ['Slab Rate', r => r.slabRate]],
      GoldLessChart: [['From Date', r => fmtDate(r.fromDate)], ['Chart Type', r => r.chartType], ['Value', r => r.value], ['Add / Less', r => (r.toggle === 'Less' ? 'Less' : 'Add')]],
      MilmaChart:    [['Chart ID', r => r.chartId], ['Effective From', r => fmtDate(r.dateFrom)], ['SNF Rate', r => r.rateSNF], ['FAT Rate', r => r.rateFAT],
                      ['SNF Low <', r => r.subSNF], ['TS Low <', r => r.subTotalSolids], ['SNF High ≥', r => r.bestSNF], ['TS High ≥', r => r.bestTotalSolids],
                      ['Rows', r => r.rowCount], ['Remarks', r => r.remarks || '']],
    }[type] || [];
    const numeric = records.map(r => cols.map(([, get]) => get(r) ?? ''));
    return {
      head: ['#', ...cols.map(([h]) => h)],
      body: numeric.map((r, i) => [i + 1, ...r]),
      numeric: numeric.map((r, i) => [i + 1, ...r]),
    };
  }, [isMatrix, type, record, records, effRange.fatMin, effRange.fatMax, effRange.snfMin, effRange.snfMax]);

  const subtitle = !record ? '' : type === 'TSRate'
    ? `TS Rate ₹${record.tsRate} / kg · Period ${periodLabel(record)} · Rate = (FAT + SNF) × ${record.tsRate} / 100`
    : `From ${fmtDate(record.fromDate)} · Fat Rate ${record.fatRate} · SNF Rate ${record.snfRate} · Rate = FAT × ${record.fatRate}/100 + SNF × ${record.snfRate}/100`;

  const fileBase = `${typeLabel(type).replace(/[^A-Za-z0-9]+/g, '_')}_${dayjs().format('YYYY-MM-DD')}`;

  // ── Export (Excel) — every row and column, numbers kept numeric ────────────
  const handleExport = () => {
    if (!table.body.length) return;
    const aoa = [[typeLabel(type)], ...(subtitle ? [[subtitle]] : []), [], table.head, ...table.numeric];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = table.head.map((_, i) => ({ wch: i === 0 ? 12 : 10 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rate Chart');
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  };

  // ── Download Chart (PDF) — wide matrices split across pages, FAT column repeated
  const handleDownload = async () => {
    if (!table.body.length) return;
    setExporting(true);
    await new Promise(r => setTimeout(r, 30)); // let the button show its loader
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(13);
      doc.text(typeLabel(type), 10, 12);
      if (subtitle) { doc.setFontSize(8); doc.text(subtitle, 10, 17); }
      autoTable(doc, {
        head: [table.head.map(String)],
        body: table.body.map(r => r.map(String)),
        startY: 21,
        margin: { left: 8, right: 8 },
        styles: { fontSize: isMatrix ? 6.5 : 8, cellPadding: 1, halign: 'right' },
        headStyles: { fillColor: [13, 148, 136], textColor: 255, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'left', fillColor: [241, 245, 249] } },
        horizontalPageBreak: isMatrix,
        horizontalPageBreakRepeat: 0,
      });
      doc.save(`${fileBase}.pdf`);
    } catch (e) {
      notifications.show({ color: 'red', message: e?.message || 'Could not create the PDF' });
    } finally { setExporting(false); }
  };

  const applyPreset = (p) => { setPreset(p); setRange(MILK_PRESETS[p]); };
  const setRangeField = (k, v) => { setPreset(null); setRange(prev => ({ ...prev, [k]: Number(v) || 0 })); };

  const gridHeight = embedded ? 420 : 'calc(100vh - 360px)';
  const cellCount  = table.fats && table.snfs ? table.fats * table.snfs : 0;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <Box p={embedded ? 0 : 'md'} style={embedded ? undefined : { minHeight: '100vh', background: 'var(--mantine-color-gray-0)' }}>
      {!embedded && (
        <Paper radius="md" p="md" mb="md"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)', boxShadow: '0 4px 16px rgba(13,148,136,0.18)' }}>
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon color="white" variant="transparent" size={40}><IconTable size={28} /></ThemeIcon>
              <Box>
                <Title order={4} c="white" fw={700}>Rate Charge Table</Title>
                <Text size="xs" c="teal.0">Complete rate / charge table for the selected rate chart configuration</Text>
              </Box>
            </Group>
            {activeType && (
              <Badge color="teal.0" c="teal.9" variant="filled" size="lg" radius="md">
                Active in Milk Purchase: {typeLabel(activeType)}
              </Badge>
            )}
          </Group>
        </Paper>
      )}

      <Paper radius="md" p="md" withBorder>
        {/* ── Controls ── */}
        <Group gap="sm" align="flex-end" mb="sm" wrap="wrap">
          {!fixedType && (
            <Select
              label="Rate Chart"
              data={CHART_TYPES.map(c => ({ ...c, label: c.value === activeType ? `${c.label}  (Active)` : c.label }))}
              value={type}
              onChange={v => v && setType(v)}
              allowDeselect={false}
              w={260}
              radius="md"
            />
          )}
          {isMatrix && records.length > 0 && (
            <Select
              label={type === 'TSRate' ? 'TS Rate Period' : 'Formula (From Date)'}
              data={records.map(r => ({
                value: r._id,
                label: type === 'TSRate' ? `${periodLabel(r)}  ·  ₹${r.tsRate}` : `${fmtDate(r.fromDate)}  ·  Fat ${r.fatRate} / SNF ${r.snfRate}`,
              }))}
              value={recordId}
              onChange={v => v && setRecordId(v)}
              allowDeselect={false}
              w={300}
              radius="md"
            />
          )}
          {isMatrix && (type === 'TSRate' || formulaRangeMissing) && (
            <>
              <Box>
                <Text size="sm" fw={500} mb={4}>Milk Type</Text>
                <SegmentedControl
                  value={preset || ''}
                  onChange={applyPreset}
                  data={Object.keys(MILK_PRESETS).map(k => ({ value: k, label: MILK_PRESETS[k].label }))}
                  color="teal"
                  radius="md"
                />
              </Box>
              {[['fatMin', 'FAT From'], ['fatMax', 'FAT To'], ['snfMin', 'SNF From'], ['snfMax', 'SNF To']].map(([k, l]) => (
                <NumberInput key={k} label={l} value={range[k]} onChange={v => setRangeField(k, v)}
                  decimalScale={1} step={0.1} min={0} max={99} w={92} radius="md" />
              ))}
            </>
          )}
        </Group>

        {formulaRangeMissing && (
          <Alert color="yellow" radius="md" mb="sm" icon={<IconInfoCircle size={16} />}>
            This formula has no Min/Max FAT and SNF saved, so the range below is chosen here. Save the range in Rate Chart Settings → Apply Formula to fix it.
          </Alert>
        )}
        {subtitle && <Text size="xs" c="dimmed" mb="xs">{subtitle}</Text>}

        {/* ── Table ── */}
        {loading ? (
          <Center h={200}><Loader size="sm" color="teal" /></Center>
        ) : !table.body.length ? (
          <Center h={160}>
            <Text size="sm" c="dimmed">
              {isMatrix && !records.length
                ? `No ${type === 'TSRate' ? 'TS rate' : 'formula'} saved yet — add one in Rate Chart Settings`
                : 'No records to show'}
            </Text>
          </Center>
        ) : (
          <VirtualGrid
            key={[type, recordId, effRange.fatMin, effRange.fatMax, effRange.snfMin, effRange.snfMax].join('|')}
            head={table.head} body={table.body} height={gridHeight}
          />
        )}

        {/* ── Footer: count + Download Chart / Export ── */}
        <Group justify="space-between" mt="sm">
          <Text size="xs" c="dimmed">
            {cellCount
              ? `${table.fats} FAT × ${table.snfs} SNF = ${cellCount.toLocaleString()} rates`
              : `${table.body.length.toLocaleString()} record${table.body.length === 1 ? '' : 's'}`}
          </Text>
          <Group gap="sm">
            <Button leftSection={<IconDownload size={16} />} color="teal" radius="md"
              onClick={handleDownload} loading={exporting} disabled={!table.body.length}>
              Download Chart
            </Button>
            <Button leftSection={<IconFileSpreadsheet size={16} />} color="green" variant="light" radius="md"
              onClick={handleExport} disabled={!table.body.length}>
              Export
            </Button>
          </Group>
        </Group>
      </Paper>
    </Box>
  );
}
