import { useState, useRef } from 'react';
import {
  Box, Paper, Title, Text, Group, Button, Stack, ActionIcon,
  Badge, Divider, Alert, List, ThemeIcon, Progress, SimpleGrid, Card, TextInput
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload, IconTrash, IconDownload, IconRefresh,
  IconAlertCircle, IconCircleCheck, IconMilk, IconShoppingCart,
  IconCalendar, IconFilter, IconArrowsJoin, IconFile, IconPrinter,
  IconUsers, IconTransform
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';

// ─── Helpers ────────────────────────────────────────────────────────────────

const excelSerialToDate = (v) => {
  const n = Number(v);
  if (!n || n <= 0) return null;
  return new Date(Math.round((n - 25569) * 86400 * 1000));
};

const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === 'number') return excelSerialToDate(val);
  const str = String(val).trim();
  if (!str || str === '0000-00-00') return null;
  // DD-MM-YYYY (dashes)
  const m1 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) return new Date(`${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`);
  // DD/MM/YYYY (slashes — OpenLyssa default export format)
  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return new Date(`${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`);
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

const fmtDate = (d) => {
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN');
};

const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };

const readFileSheets = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
        const sheets = {};
        wb.SheetNames.forEach((name) => {
          sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });
        });
        resolve({ name: file.name, sheets });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });

const downloadExcel = (rows, filename, sheetName = 'Data') => {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
};

// Find a value from a row by checking column names (exact then partial, case-insensitive)
const findRowVal = (row, ...candidates) => {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const cl = cand.toLowerCase();
    const k = keys.find(k => k.toLowerCase() === cl) ?? keys.find(k => k.toLowerCase().includes(cl));
    if (k !== undefined && row[k] !== null && row[k] !== undefined) return row[k];
  }
  return null;
};

// Normalize a Nos/NonNos value for lookup.
// Returns a positive Number for pure-numeric values, an uppercase String for alphanumeric
// values like "E110", and null for empty/invalid entries.
const normalizeNos = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const str = String(v).trim();
  if (!str) return null;
  const n = Number(str);
  if (!isNaN(n) && n > 0) return n;          // numeric → Number key
  return str.toUpperCase() || null;           // alphanumeric (e.g. "E110") → String key
};

// Detect if a sheet's rows look like mc_proc_master, mc_proc_detail, or flat (combined)
const detectSheetType = (rows) => {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).map((k) => k.toLowerCase());
  const hasMaster = keys.some(k => k === 'mc_date' || k === 'mc_time' || k === 'shift_id');
  const hasDetail = keys.some(k => k === 'producer_id' || k === 'qty' || k === 'fat');
  if (hasMaster && hasDetail) return 'flat';   // combined single-sheet export
  if (hasMaster) return 'master';
  if (hasDetail) return 'detail';
  return null;
};

// ─── FileList sub-component ────────────────────────────────────────────────

const FileListBox = ({ label, color, files, onAdd, onRemove, accept = '.xlsx,.xls,.csv', multiple = true }) => {
  const ref = useRef(null);
  return (
    <Box>
      <Group mb="xs">
        <Text fw={600} size="sm">{label}</Text>
        <Badge color={color} size="sm">{files.length} file{files.length !== 1 ? 's' : ''}</Badge>
      </Group>
      <Paper withBorder p="sm" radius="md" style={{ minHeight: 80 }}>
        {files.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" pt="xs">No files selected</Text>
        ) : (
          <Stack gap={4}>
            {files.map((f, i) => (
              <Group key={i} justify="space-between" wrap="nowrap">
                <Text size="sm" truncate style={{ maxWidth: 260 }}>
                  <Text span c="dimmed" mr={4}>{i + 1}.</Text>
                  {f.name}
                </Text>
                <ActionIcon size="sm" color="red" variant="subtle" onClick={() => onRemove(i)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        )}
      </Paper>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        ref={ref}
        style={{ display: 'none' }}
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          if (picked.length) onAdd(picked);
          e.target.value = '';
        }}
      />
      <Button
        mt="xs"
        size="xs"
        variant="default"
        leftSection={<IconUpload size={14} />}
        onClick={() => ref.current?.click()}
      >
        Select Files
      </Button>
    </Box>
  );
};

// ─── MILK PURCHASE SECTION ─────────────────────────────────────────────────

const MilkPurchaseSection = () => {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(null); // null | 'scanning' | 'ready' | 'processing' | 'done' | 'error'
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYears, setSelectedYears] = useState(new Set());
  const [result, setResult] = useState(null);

  const addFiles = (picked) => {
    setFiles((prev) => [...prev, ...picked]);
    setStatus(null); setAvailableYears([]); setSelectedYears(new Set()); setResult(null);
  };
  const removeFile = (i) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setStatus(null); setAvailableYears([]); setSelectedYears(new Set()); setResult(null);
  };
  const reset = () => { setFiles([]); setStatus(null); setAvailableYears([]); setSelectedYears(new Set()); setResult(null); };

  const toggleYear = (y) => setSelectedYears(prev => {
    const next = new Set(prev);
    next.has(y) ? next.delete(y) : next.add(y);
    return next;
  });

  // Step 1 — scan BOTH master + detail to find years that actually have data
  const handleScanYears = async () => {
    if (!files.length) return;
    setStatus('scanning'); setAvailableYears([]); setSelectedYears(new Set()); setResult(null);
    try {
      const mcYearMap  = new Map(); // mc_id → year  (built from master)
      const yearCounts = new Map(); // year  → detail row count

      for (const file of files) {
        const { sheets } = await readFileSheets(file);
        for (const [, rows] of Object.entries(sheets)) {
          const type = detectSheetType(rows);

          if (type === 'master') {
            rows.forEach(row => {
              const mcId = String(row.mc_id ?? '').trim();
              const d = parseDate(findRowVal(row, 'mc_date', 'date', 'dt', 'entry_date', 'date_entry'));
              if (mcId && d) mcYearMap.set(mcId, d.getFullYear());
            });
          } else if (type === 'flat') {
            // flat has both date and detail — count directly
            rows.forEach(row => {
              const d = parseDate(findRowVal(row, 'mc_date', 'date', 'dt', 'entry_date', 'date_entry'));
              if (d) yearCounts.set(d.getFullYear(), (yearCounts.get(d.getFullYear()) ?? 0) + 1);
            });
          }
        }
      }

      // Second pass — count detail rows per year using master map
      for (const file of files) {
        const { sheets } = await readFileSheets(file);
        for (const [, rows] of Object.entries(sheets)) {
          const type = detectSheetType(rows);
          if (type === 'detail') {
            rows.forEach(row => {
              const mcId = String(row.mc_id ?? '').trim();
              const year = mcYearMap.get(mcId);
              if (year) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
            });
          }
        }
      }

      if (!yearCounts.size) {
        notifications.show({ title: 'No Data Found', message: 'Could not match detail rows to any year — check that master and detail files are both uploaded.', color: 'orange' });
        setStatus(null); return;
      }

      // yearsWithData = only years that have at least 1 matching detail row
      const sorted = [...yearCounts.entries()].sort((a, b) => a[0] - b[0]);
      setAvailableYears(sorted); // [ [year, count], ... ]
      setSelectedYears(new Set(sorted.map(([y]) => y)));
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      notifications.show({ title: 'Scan Error', message: err.message, color: 'red' });
    }
  };

  const handleConvert = async () => {
    if (!files.length) {
      notifications.show({ title: 'No Files', message: 'Please select master and detail files', color: 'orange' });
      return;
    }
    if (!selectedYears.size) {
      notifications.show({ title: 'No Year Selected', message: 'Select at least one year to convert.', color: 'orange' });
      return;
    }
    setStatus('processing');
    setResult(null);

    try {
      const masterRows = [];
      const detailRows = [];
      const flatRows   = [];
      const debugSheets = [];

      for (const file of files) {
        const { sheets } = await readFileSheets(file);
        let anyDetected = false;

        for (const [sheetName, rows] of Object.entries(sheets)) {
          if (!rows.length) continue;
          const type = detectSheetType(rows);
          const colNames = Object.keys(rows[0]).join(', ');
          debugSheets.push({ file: file.name, sheet: sheetName, type: type ?? 'unrecognised', rows: rows.length, cols: colNames });

          if (type === 'master')       { rows.forEach(r => masterRows.push(r)); anyDetected = true; }
          else if (type === 'detail')  { rows.forEach(r => detailRows.push(r)); anyDetected = true; }
          else if (type === 'flat')    { rows.forEach(r => flatRows.push(r));   anyDetected = true; }
        }

        if (!anyDetected) {
          notifications.show({
            title: `Unrecognised: ${file.name}`,
            message: 'No mc_date / producer_id columns found. Check the debug panel below.',
            color: 'orange'
          });
        }
      }

      const totalSourceRows = masterRows.length + detailRows.length + flatRows.length;
      if (!totalSourceRows) {
        setStatus('error');
        setResult({ rows: [], stats: { error: 'No rows detected', debugSheets } });
        return;
      }

      // Build mc_id → { date, shift } from master rows
      const masterMap = new Map();
      masterRows.forEach((row) => {
        const mcId = String(row.mc_id ?? '').trim();
        if (!mcId || mcId === '0') return;
        const date = parseDate(row.mc_date);
        const t = String(row.mc_time ?? '').trim().toUpperCase();
        const shiftId = Number(row.shift_id);
        const shift = t === 'AM' ? 'AM' : t === 'PM' ? 'PM'
          : shiftId === 1 ? 'AM' : shiftId === 2 ? 'PM' : null;
        if (date && shift) masterMap.set(mcId, { date, shift });
      });

      const masterMcIds   = [...masterMap.keys()].map(Number).filter(Boolean);
      const masterMcMin   = masterMcIds.length ? masterMcIds.reduce((a, b) => b < a ? b : a, Infinity) : null;
      const masterMcMax   = masterMcIds.length ? masterMcIds.reduce((a, b) => b > a ? b : a, -Infinity) : null;

      const merged = [];
      let skippedNoMaster = 0;
      let skippedNoDate   = 0;

      // Helper to build a row from session + detail row (respects year filter)
      const pushRow = (session, row) => {
        if (!selectedYears.has(session.date.getFullYear())) return;
        const kgVal  = num(row.qty);
        const clrVal = num(row.clr);
        // OpenLyssa stores qty in kg (weighing scale); our system stores qty in litres.
        // Convert: Ltr = KG / (1 + CLR/1000)
        const ltrVal = (clrVal > 0 && kgVal > 0)
          ? parseFloat((kgVal / (1 + clrVal / 1000)).toFixed(3))
          : kgVal;
        merged.push({
          Date:        fmtDate(session.date),
          Shift:       session.shift,
          mc_id:       String(row.mc_id ?? ''),
          producer_id: row.producer_id ?? findRowVal(row, 'producer_id', 'farmer_id', 'member_id') ?? '',
          slno:        row.slno ?? row.sl_no ?? row.slNo ?? '',
          qty:         ltrVal,   // litres (converted from kg)
          kg:          kgVal,    // original kg from OpenLyssa (reference column)
          fat:         num(row.fat),
          clr:         num(row.clr),
          snf:         num(row.snf),
          rate:        num(row.rate),
          amount:      num(row.amount),
          incentive:   num(row.incentive),
        });
      };

      // Process regular detail rows (join with master, fallback to row's own date)
      detailRows.forEach((row) => {
        const mcId = String(row.mc_id ?? '').trim();
        let session = masterMap.get(mcId);

        if (!session) {
          // Fallback: look for any date/shift column directly in the row
          const rawDate  = findRowVal(row, 'mc_date', 'date', 'dt', 'entry_date', 'date_entry', 'collection_date');
          const rawShiftStr = String(findRowVal(row, 'mc_time', 'shift', 'session', 'time') ?? '').trim().toUpperCase();
          const rawShiftId  = Number(findRowVal(row, 'shift_id') ?? 0);
          if (rawDate) {
            const d = parseDate(rawDate);
            const s = rawShiftStr === 'AM' ? 'AM' : rawShiftStr === 'PM' ? 'PM'
              : rawShiftId === 1 ? 'AM' : rawShiftId === 2 ? 'PM' : null;
            if (d && s) session = { date: d, shift: s };
            else        { skippedNoDate++; return; }
          } else {
            skippedNoMaster++; return;
          }
        }
        pushRow(session, row);
      });

      // Process flat rows (date + shift already in each row)
      flatRows.forEach((row) => {
        const rawDate     = findRowVal(row, 'mc_date', 'date', 'dt', 'entry_date', 'date_entry', 'collection_date');
        const rawShiftStr = String(findRowVal(row, 'mc_time', 'shift', 'session', 'time') ?? '').trim().toUpperCase();
        const rawShiftId  = Number(findRowVal(row, 'shift_id') ?? 0);
        const d = parseDate(rawDate);
        const s = rawShiftStr === 'AM' ? 'AM' : rawShiftStr === 'PM' ? 'PM'
          : rawShiftId === 1 ? 'AM' : rawShiftId === 2 ? 'PM' : null;
        if (!d || !s) { skippedNoDate++; return; }
        pushRow({ date: d, shift: s }, row);
      });

      const sourceRows = flatRows.length ? flatRows : detailRows;
      const detailMcIds = sourceRows.map(r => Number(r.mc_id)).filter(Boolean);
      const detailMcMin = detailMcIds.length ? detailMcIds.reduce((a, b) => b < a ? b : a, Infinity) : null;
      const detailMcMax = detailMcIds.length ? detailMcIds.reduce((a, b) => b > a ? b : a, -Infinity) : null;

      // Detect .xls 65535-row truncation and find missing date range from master
      const xlsTruncated = (detailRows.length + flatRows.length) === 65535;
      let missingDateMin = null, missingDateMax = null, missingMcCount = 0;
      if (xlsTruncated && masterMap.size > 0) {
        const presentMcIds = new Set(sourceRows.map(r => String(r.mc_id)));
        const missingEntries = [...masterMap.entries()].filter(([id]) => !presentMcIds.has(id));
        missingMcCount = missingEntries.length;
        const missingDates = missingEntries.map(([, v]) => v.date).filter(Boolean);
        if (missingDates.length) {
          missingDateMin = new Date(missingDates.reduce((a, b) => b.getTime() < a ? b.getTime() : a, Infinity));
          missingDateMax = new Date(missingDates.reduce((a, b) => b.getTime() > a ? b.getTime() : a, -Infinity));
        }
      }

      setResult({
        rows: merged,
        stats: {
          masterRows: masterRows.length,
          detailRows: detailRows.length,
          flatRows:   flatRows.length,
          merged:     merged.length,
          skippedNoMaster,
          skippedNoDate,
          masterMcMin, masterMcMax,
          detailMcMin, detailMcMax,
          xlsTruncated,
          missingMcCount,
          missingDateMin,
          missingDateMax,
          debugSheets,
        }
      });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const downloadYear = (year) => {
    if (!result?.rows?.length) return;
    const rows = year === 'all' ? result.rows : result.rows.filter(r => {
      const parts = String(r.Date).split('/');
      return parts.length === 3 && Number(parts[2]) === year;
    });
    if (!rows.length) { notifications.show({ title: 'No Data', message: `No rows for ${year}`, color: 'orange' }); return; }
    downloadExcel(rows, `milk_purchase_${year}_${Date.now()}.xlsx`, 'Milk Purchase');
    notifications.show({ title: 'Downloaded', message: `${rows.length} rows for ${year}`, color: 'green' });
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md">
        <ThemeIcon color="blue" variant="light" size="lg">
          <IconMilk size={20} />
        </ThemeIcon>
        <div>
          <Title order={4}>Milk Purchase</Title>
          <Text size="xs" c="dimmed">Merge mc_proc_master + mc_proc_detail — select year before converting</Text>
        </div>
      </Group>

      {/* Step 1: Upload files */}
      <FileListBox
        label="Step 1 — Upload Master + Detail Files"
        color="blue"
        files={files}
        onAdd={addFiles}
        onRemove={removeFile}
      />

      {/* Step 2: Scan years */}
      <Group mt="xs">
        <Button
          size="xs"
          variant="light"
          color="blue"
          leftSection={<IconCalendar size={14} />}
          onClick={handleScanYears}
          loading={status === 'scanning'}
          disabled={!files.length}
        >
          Scan Available Years
        </Button>
        {(files.length > 0 || result) && (
          <Button variant="subtle" color="gray" size="xs" onClick={reset}>Clear</Button>
        )}
      </Group>

      {/* Step 3: Year selector — only shows years that have actual detail data */}
      {availableYears.length > 0 && (
        <Paper withBorder p="sm" mt="sm" radius="sm">
          <Group mb="xs" justify="space-between">
            <Group gap={6}>
              <IconFilter size={14} />
              <Text size="xs" fw={600}>Step 2 — Select Years to Convert</Text>
            </Group>
            <Group gap={6}>
              <Button size="xs" variant="subtle" compact onClick={() => setSelectedYears(new Set(availableYears.map(([y]) => y)))}>All</Button>
              <Button size="xs" variant="subtle" compact onClick={() => setSelectedYears(new Set())}>None</Button>
            </Group>
          </Group>
          <Group gap="xs">
            {availableYears.map(([y, count]) => (
              <Badge
                key={y}
                size="lg"
                variant={selectedYears.has(y) ? 'filled' : 'outline'}
                color="blue"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleYear(y)}
              >
                {y} ({count.toLocaleString()})
              </Badge>
            ))}
          </Group>
          <Text size="xs" c="dimmed" mt={6}>
            {selectedYears.size} of {availableYears.length} year{availableYears.length !== 1 ? 's' : ''} selected
            &nbsp;— only years with actual detail data are shown
          </Text>
        </Paper>
      )}

      {/* Step 4: Convert */}
      {status === 'ready' || status === 'processing' || status === 'done' ? (
        <Group mt="sm">
          <Button
            color="blue"
            leftSection={<IconRefresh size={16} />}
            onClick={handleConvert}
            loading={status === 'processing'}
            disabled={!selectedYears.size}
          >
            Convert Selected Years
          </Button>
        </Group>
      ) : null}

      {/* Results */}
      {status === 'done' && result && (
        <Stack gap="xs" mt="md">
          <Alert icon={<IconCircleCheck size={14} />} color="green" variant="light" p="xs">
            <Stack gap={2}>
              <Text size="xs">
                Master rows: <strong>{result.stats.masterRows}</strong> &nbsp;|&nbsp;
                Detail rows: <strong>{result.stats.detailRows + (result.stats.flatRows ?? 0)}</strong>
                &nbsp;|&nbsp; <Text span c="green" fw={700}>Merged: {result.stats.merged} rows</Text>
                &nbsp;|&nbsp; Years: <strong>{[...selectedYears].sort().join(', ')}</strong>
              </Text>
              {result.stats.skippedNoMaster > 0 && (
                <Text size="xs" c="orange">Skipped {result.stats.skippedNoMaster} rows — mc_id not in master</Text>
              )}
            </Stack>
          </Alert>

          {/* Year-wise download buttons */}
          <Paper withBorder p="sm" radius="sm">
            <Text size="xs" fw={600} mb="xs">Download by Year</Text>
            <Group gap="xs" wrap="wrap">
              {[...selectedYears].sort().map(y => {
                const count = result.rows.filter(r => {
                  const parts = String(r.Date).split('/');
                  return parts.length === 3 && Number(parts[2]) === y;
                }).length;
                return (
                  <Button
                    key={y}
                    size="xs"
                    variant="light"
                    color="green"
                    leftSection={<IconDownload size={13} />}
                    onClick={() => downloadYear(y)}
                    disabled={!count}
                  >
                    {y} ({count})
                  </Button>
                );
              })}
              {selectedYears.size > 1 && (
                <Button
                  size="xs"
                  color="green"
                  leftSection={<IconDownload size={13} />}
                  onClick={() => downloadYear('all')}
                >
                  All Years ({result.rows.length})
                </Button>
              )}
            </Group>
          </Paper>

          {result.stats.debugSheets?.length > 0 && (
            <Alert icon={<IconAlertCircle size={14} />} color="gray" variant="light" p="xs">
              <Text size="xs" fw={600} mb={4}>Detected sheets:</Text>
              {result.stats.debugSheets.map((s, i) => (
                <Text size="xs" key={i} c={s.type === 'unrecognised' ? 'red' : 'dimmed'}>
                  [{s.type.toUpperCase()}] {s.file} › {s.sheet} ({s.rows} rows)
                </Text>
              ))}
            </Alert>
          )}
        </Stack>
      )}
    </Paper>
  );
};

// ─── MILK SALES SECTION ────────────────────────────────────────────────────
// Joins 4 Zibitt tables:
//   mc_master   → mc_id → date, shift
//   customer    → cust_id → name
//   item        → item_id → item_name
//   sales_detail (main) → mc_id + cust_id + item_id foreign keys

const detectSalesSheetType = (rows) => {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).map((k) => k.toLowerCase());
  if (keys.includes('mc_date') && keys.includes('shift_id')) return 'mc_master';
  if (keys.includes('source_id') && keys.includes('slno'))    return 'sales_detail';
  if (keys.includes('item_name'))                              return 'item';
  // category must be checked before customer — both have 'name', but category has cat_id not cust_id
  if (keys.includes('cat_id') && keys.includes('name'))       return 'category';
  if (keys.includes('cust_id') && keys.includes('name'))      return 'customer';
  return null;
};

// Categories that map to CASH sale type (case-insensitive)
const CASH_SALE_CATEGORIES = new Set(['local sale', 'local sales', 'sample sale', 'sample sales']);

const MilkSalesSection = () => {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);

  const addFiles = (picked) => setFiles((prev) => [...prev, ...picked]);
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  const reset = () => { setFiles([]); setStatus(null); setResult(null); };

  const handleConvert = async () => {
    if (!files.length) {
      notifications.show({ title: 'No Files', message: 'Please select files', color: 'orange' });
      return;
    }
    setStatus('processing');
    setResult(null);

    try {
      const tables = { mc_master: [], sales_detail: [], customer: [], item: [], category: [] };
      const unrecognised = [];

      for (const file of files) {
        const { sheets } = await readFileSheets(file);
        let matched = false;
        for (const [, rows] of Object.entries(sheets)) {
          const type = detectSalesSheetType(rows);
          if (type) { rows.forEach(r => tables[type].push(r)); matched = true; }
        }
        if (!matched) unrecognised.push(file.name);
      }

      if (unrecognised.length) {
        notifications.show({
          title: 'Unrecognised file(s)',
          message: unrecognised.join(', '),
          color: 'orange'
        });
      }

      if (!tables.sales_detail.length) {
        setStatus('error');
        notifications.show({ title: 'Missing Sales Detail', message: 'No sales detail rows found (needs source_id + slno columns)', color: 'red' });
        return;
      }

      // Build lookup maps
      // mc_id → { date string, shift }
      const mcMap = new Map();
      tables.mc_master.forEach((row) => {
        const mcId = String(row.mc_id ?? '').trim();
        if (!mcId) return;
        const date = parseDate(row.mc_date);
        const shiftId = Number(row.shift_id);
        const mcTime = String(row.mc_time ?? '').trim().toUpperCase();
        const shift = mcTime === 'AM' ? 'AM' : mcTime === 'PM' ? 'PM'
          : shiftId === 1 ? 'AM' : shiftId === 2 ? 'PM' : 'AM';
        if (date) {
          // Encode shift into time so the import backend can detect AM/PM via getSession
          const timeStr = shift === 'AM' ? '06:00' : '18:00';
          const dd = String(date.getDate()).padStart(2, '0');
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const yyyy = date.getFullYear();
          mcMap.set(mcId, { dateEntry: `${dd}-${mm}-${yyyy} ${timeStr}`, shift });
        }
      });

      // cat_id → category name
      const catMap = new Map();
      tables.category.forEach((row) => {
        const id   = String(row.cat_id ?? '').trim();
        const name = String(row.name ?? row.cat_name ?? '').trim();
        if (id && name) catMap.set(id, name);
      });

      // cust_id → { name, catId }
      const custMap = new Map();
      tables.customer.forEach((row) => {
        const id    = String(row.cust_id ?? '').trim();
        const name  = String(row.name    ?? '').trim();
        const catId = String(row.cat_id  ?? '').trim();
        if (id) custMap.set(id, { name, catId });
      });

      // item_id → item_name
      const itemMap = new Map();
      tables.item.forEach((row) => {
        const id = String(row.item_id ?? '').trim();
        if (id) itemMap.set(id, String(row.item_name ?? '').trim());
      });

      // Join
      const merged = [];
      let skippedNoQty = 0;

      tables.sales_detail.forEach((row) => {
        if (!row.qty && !row.amount) { skippedNoQty++; return; }

        const mcId    = String(row.mc_id   ?? '').trim();
        const custId  = String(row.cust_id ?? '').trim();
        const itemId  = String(row.item_id ?? '').trim();
        const mc      = mcMap.get(mcId);

        // Use mc_date for date_entry if available, else fall back to row's date_entry
        let dateEntry = mc?.dateEntry ?? '';
        if (!dateEntry && row.date_entry) {
          const d = parseDate(row.date_entry);
          if (d) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            dateEntry = `${dd}-${mm}-${d.getFullYear()} 06:00`;
          }
        }

        const custInfo  = custMap.get(custId) ?? { name: '', catId: '' };
        const catName   = catMap.get(custInfo.catId) ?? '';
        // Category OR item name: Local Sale / Sample Sale → CASH, all others → CREDIT
        const saleType  = (
          CASH_SALE_CATEGORIES.has(catName.trim().toLowerCase()) ||
          CASH_SALE_CATEGORIES.has(itemName.trim().toLowerCase())
        ) ? 'CASH' : 'CREDIT';
        const itemName  = itemMap.get(itemId) ?? '';

        merged.push({
          dcs_id:     row.dcs_id ?? '',
          mc_id:      mcId,
          slno:       row.slno ?? '',
          cust_id:    custId,
          cust_name:  custInfo.name,
          category:   catName,
          item_id:    itemId,
          item_name:  itemName,
          sale_type:  saleType,
          qty:        num(row.qty),
          rate:       num(row.rate),
          amount:     num(row.amount),
          source_id:  row.source_id ?? '',
          date_entry: dateEntry,
          shift:      mc?.shift ?? '',
        });
      });

      const cashRows   = merged.filter(r => r.sale_type === 'CASH').length;
      const creditRows = merged.filter(r => r.sale_type === 'CREDIT').length;

      setResult({
        rows: merged,
        stats: {
          mc_master:    tables.mc_master.length,
          customer:     tables.customer.length,
          category:     tables.category.length,
          item:         tables.item.length,
          sales_detail: tables.sales_detail.length,
          merged:       merged.length,
          cashRows,
          creditRows,
          skippedNoQty,
        }
      });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleDownload = () => {
    if (!result?.rows?.length) return;
    downloadExcel(result.rows, `milk_sales_merged_${Date.now()}.xlsx`, 'Milk Sales');
    notifications.show({ title: 'Downloaded', message: `${result.rows.length} rows exported`, color: 'green' });
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md">
        <ThemeIcon color="teal" variant="light" size="lg">
          <IconShoppingCart size={20} />
        </ThemeIcon>
        <div>
          <Title order={4}>Milk Sales</Title>
          <Text size="xs" c="dimmed">Join Zibitt tables: Category + Customer + MC Master + Item + Sales Detail</Text>
        </div>
      </Group>

      <Alert icon={<IconAlertCircle size={14} />} color="teal" variant="light" mb="md" p="xs">
        <Text size="xs">
          Upload all Zibitt export files (category, customer, mc_master, item, sales_detail) — separately or in one Excel with multiple sheets.
          The tool auto-detects each table and joins them. Sale type is set from the item name or customer category:
          <strong> Local Sale / Sample Sale → CASH</strong>, Customer Sale / Others → <strong>CREDIT</strong>.
        </Text>
      </Alert>

      <FileListBox
        label="Category + Customer + MC Master + Item + Sales Detail Files"
        color="teal"
        files={files}
        onAdd={addFiles}
        onRemove={removeFile}
      />

      {status === 'done' && result && (
        <Alert icon={<IconCircleCheck size={14} />} color="green" variant="light" mt="md" p="xs">
          <Stack gap={2}>
            <Text size="xs">MC Master rows: <strong>{result.stats.mc_master}</strong></Text>
            <Text size="xs">Category rows: <strong>{result.stats.category}</strong>{result.stats.category === 0 && <Text span c="orange"> — category file not uploaded; sale_type defaults to CREDIT</Text>}</Text>
            <Text size="xs">Customer rows: <strong>{result.stats.customer}</strong></Text>
            <Text size="xs">Item rows: <strong>{result.stats.item}</strong></Text>
            <Text size="xs">Sales Detail rows: <strong>{result.stats.sales_detail}</strong></Text>
            <Divider my={4} />
            <Text size="xs" fw={700} c="green">Merged output: {result.stats.merged} rows</Text>
            <Text size="xs">CASH: <strong>{result.stats.cashRows}</strong> &nbsp;|&nbsp; CREDIT: <strong>{result.stats.creditRows}</strong></Text>
            {result.stats.skippedNoQty > 0 && (
              <Text size="xs" c="dimmed">Skipped (no qty/amount): {result.stats.skippedNoQty}</Text>
            )}
          </Stack>
        </Alert>
      )}

      <Group mt="md">
        <Button
          color="teal"
          leftSection={<IconRefresh size={16} />}
          onClick={handleConvert}
          loading={status === 'processing'}
          disabled={!files.length}
        >
          Convert & Merge
        </Button>
        <Button
          color="green"
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={handleDownload}
          disabled={!result?.rows?.length}
        >
          Download ({result?.rows?.length ?? 0} rows)
        </Button>
        {(files.length > 0 || result) && (
          <Button variant="subtle" color="gray" size="xs" onClick={reset}>
            Clear
          </Button>
        )}
      </Group>
    </Paper>
  );
};

// ─── LYNZA MERGE — Attach NO+NAME (File 2) → Main Data (File 1) ──────────────

const SingleFilePicker = ({ label, color = 'blue', file, onAdd, onRemove }) => {
  const ref = useRef(null);
  return (
    <Box>
      <Text fw={600} size="sm" mb={6}>{label}</Text>
      <Paper withBorder p="sm" radius="md" style={{ minHeight: 60 }}>
        {file ? (
          <Group justify="space-between" wrap="nowrap">
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <IconFile size={15} style={{ flexShrink: 0, color: 'var(--mantine-color-' + color + '-6)' }} />
              <Text size="sm" truncate>{file.name}</Text>
            </Group>
            <ActionIcon size="sm" color="red" variant="subtle" onClick={onRemove}>
              <IconTrash size={13} />
            </ActionIcon>
          </Group>
        ) : (
          <Text c="dimmed" size="xs" ta="center" pt={6}>No file selected</Text>
        )}
      </Paper>
      <input type="file" accept=".xlsx,.xls,.csv" ref={ref} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ''; }} />
      <Button mt={6} size="xs" variant="default" color={color}
        leftSection={<IconUpload size={13} />} onClick={() => ref.current?.click()}>
        Select File
      </Button>
    </Box>
  );
};

const LynzAMergeSection = () => {
  const [file1, setFile1] = useState(null);   // Main data — NO Nos/Name columns
  const [file2, setFile2] = useState(null);   // Correct NO + NAME only
  const [societyName, setSocietyName] = useState('');
  const [societyAddr, setSocietyAddr] = useState('');
  const [reportTitle, setReportTitle] = useState('MEMBER / NONMEMBER REGISTER LIST - ALL');
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const printRef = useRef(null);

  const reset = () => { setFile1(null); setFile2(null); setStatus(null); setResult(null); };

  const handleMerge = async () => {
    if (!file1 || !file2) {
      notifications.show({ title: 'Missing Files', message: 'Upload both File 1 and File 2', color: 'orange' });
      return;
    }
    setStatus('processing'); setResult(null);
    try {
      const [{ sheets: s1 }, { sheets: s2 }] = await Promise.all([
        readFileSheets(file1), readFileSheets(file2),
      ]);

      const rows1 = Object.values(s1).find(r => r.length) ?? [];
      const rows2 = Object.values(s2).find(r => r.length) ?? [];
      if (!rows1.length) { notifications.show({ title: 'File 1 Empty', color: 'red' }); setStatus(null); return; }
      if (!rows2.length) { notifications.show({ title: 'File 2 Empty', color: 'red' }); setStatus(null); return; }

      const cols1 = Object.keys(rows1[0]);
      const cols2 = Object.keys(rows2[0]);

      // Detect NO col in File 2 (exact 'no' first, then serial-pattern, then col[0])
      const NOS_P = /^(nos?|sl\.?\s*no?\.?|s\.?\s*no?\.?|serial\.?\s*no?\.?|sr\.?\s*no?\.?)$/i;
      const lc2 = cols2.map(k => k.toLowerCase().trim());
      const noCol2   = cols2[lc2.indexOf('no')]   ?? cols2.find(k => NOS_P.test(k)) ?? cols2[0];
      const nameCol2 = cols2[lc2.indexOf('name')] ?? cols2.find(k => k.toLowerCase().includes('name')) ?? cols2[1];

      // Detect key display cols in File 1
      const lc1 = cols1.map(k => k.toLowerCase().trim());
      const houseCol  = cols1[lc1.indexOf('house')]  ?? cols1.find(k => k.toLowerCase().includes('house'))  ?? null;
      const placeCol  = cols1[lc1.indexOf('place')]  ?? cols1.find(k => k.toLowerCase().includes('place'))  ?? null;
      const shareCol  = cols1[lc1.indexOf('share')]  ?? cols1.find(k => k.toLowerCase().includes('share'))  ?? null;
      const amountCol = cols1[lc1.indexOf('amount')] ?? cols1.find(k => k.toLowerCase().includes('amount')) ?? null;

      // Filter File 2 to only rows with a valid positive integer NO value.
      // This removes blank rows, title rows, and header rows (e.g. rows containing
      // the literal text "NO" / "NAME") that appear in formatted register exports.
      const validRows2 = rows2.filter(r => {
        const v = r[noCol2];
        if (v === null || v === undefined || v === '') return false;
        const n = Number(v);
        return !isNaN(n) && n > 0 && Number.isInteger(n);
      });

      const matched = Math.min(rows1.length, validRows2.length);

      // Merge: match by sequential index against filtered File 2 rows
      const merged = rows1.map((row, i) => {
        const r2 = validRows2[i];
        return {
          NO:   r2 ? (r2[noCol2]   ?? '') : '',
          NAME: r2 ? (r2[nameCol2] ?? '') : '',
          ...row,
        };
      });

      setResult({
        rows: merged,
        cols: ['NO', 'NAME', ...cols1],
        houseCol, placeCol, shareCol, amountCol,
        stats: { total: merged.length, matched, skipped: rows2.length - validRows2.length, extra: Math.max(0, rows1.length - validRows2.length), noCol2, nameCol2 },
      });
      setStatus('done');
      notifications.show({ title: 'Merged!', message: `${merged.length} rows ready`, color: 'teal' });
    } catch (err) {
      setStatus('error');
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleDownload = () => {
    if (!result?.rows?.length) return;
    const exportRows = result.rows.map(({ NO, NAME, ...rest }) => {
      // File 1 (LinZA export) may already contain 'Nos'/'Name' columns with wrong values.
      // Strip any case-variant of nos/name from rest so they don't overwrite the correct
      // values we got from File 2.
      const cleanRest = Object.fromEntries(
        Object.entries(rest).filter(([k]) => {
          const lk = k.toLowerCase();
          return lk !== 'nos' && lk !== 'name';
        })
      );
      return { Nos: NO, Name: NAME, ...cleanRest };
    });
    downloadExcel(exportRows, `lynza_merged_${Date.now()}.xlsx`, 'Members');
    notifications.show({ title: 'Downloaded', message: `${result.rows.length} rows — ready for Farmer import`, color: 'green' });
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${reportTitle || 'Register'}</title>
    <style>
      body   { font-family: monospace; font-size: 11px; margin: 16px; }
      .hdr   { text-align:center; font-weight:700; font-size:14px; margin-bottom:2px; }
      .sub   { text-align:center; font-size:11px; margin-bottom:2px; }
      .title { text-align:center; font-weight:700; font-size:12px; margin:6px 0 10px; text-decoration:underline; }
      table  { border-collapse:collapse; width:100%; }
      th { border:1px solid #000; padding:4px 8px; background:#e0e0e0; text-align:center; }
      td { border:1px solid #aaa; padding:3px 8px; vertical-align:top; }
      .r { text-align:right; } .c { text-align:center; }
      .house { white-space:pre-line; }
      @media print { @page { margin:10mm; } }
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const tdB = { border: '1px solid #dee2e6', padding: '3px 8px', verticalAlign: 'top', fontSize: 12 };

  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md">
        <ThemeIcon color="teal" variant="light" size="lg">
          <IconArrowsJoin size={20} />
        </ThemeIcon>
        <div>
          <Title order={4}>LynzA Merge — Attach NO &amp; NAME to Member Data</Title>
          <Text size="xs" c="dimmed">File 1: data without Nos/Name &nbsp;+&nbsp; File 2: correct NO/NAME → merged register</Text>
        </div>
      </Group>

      <Alert icon={<IconAlertCircle size={14} />} color="teal" variant="light" mb="md" p="xs">
        <Text size="xs">
          <strong>File 1</strong> — House, Place, Share, Amount… (no Nos/Name columns).&nbsp;
          <strong>File 2</strong> — only NO and NAME columns.&nbsp;
          Rows matched by order (row 1 ↔ row 1). Output = NO, NAME + all File 1 columns.
        </Text>
      </Alert>

      {/* Header inputs */}
      <SimpleGrid cols={3} spacing="xs" mb="sm">
        <TextInput size="xs" label="Society Name" placeholder="ILLIKKODE KSS"
          value={societyName} onChange={e => setSocietyName(e.currentTarget.value.toUpperCase())} />
        <TextInput size="xs" label="Society Address" placeholder="ILLIKKODE, VENGAD (P.O)"
          value={societyAddr} onChange={e => setSocietyAddr(e.currentTarget.value.toUpperCase())} />
        <TextInput size="xs" label="Report Title"
          value={reportTitle} onChange={e => setReportTitle(e.currentTarget.value.toUpperCase())} />
      </SimpleGrid>

      {/* File pickers */}
      <SimpleGrid cols={2} spacing="md" mb="md">
        <SingleFilePicker
          label="File 1 — Main Data (no Nos/Name)"
          color="blue"
          file={file1}
          onAdd={setFile1}
          onRemove={() => setFile1(null)}
        />
        <SingleFilePicker
          label="File 2 — Correct NO + NAME"
          color="green"
          file={file2}
          onAdd={setFile2}
          onRemove={() => setFile2(null)}
        />
      </SimpleGrid>

      {/* Buttons */}
      <Group>
        <Button color="teal" leftSection={<IconArrowsJoin size={16} />}
          onClick={handleMerge} loading={status === 'processing'} disabled={!file1 || !file2}>
          Merge
        </Button>
        <Button color="green" variant="light" leftSection={<IconDownload size={16} />}
          onClick={handleDownload} disabled={!result?.rows?.length}>
          Download Excel ({result?.rows?.length ?? 0} rows)
        </Button>
        <Button color="teal" variant="light" leftSection={<IconPrinter size={16} />}
          onClick={handlePrint} disabled={!result?.rows?.length}>
          Print Register
        </Button>
        {(file1 || file2 || result) && (
          <Button variant="subtle" color="gray" size="xs" onClick={reset}>Clear</Button>
        )}
      </Group>

      {/* Stats + Preview */}
      {status === 'done' && result && (
        <Stack gap="xs" mt="md">
          <Alert icon={<IconCircleCheck size={14} />} color="green" variant="light" p="xs">
            <Group gap="xs" wrap="wrap">
              <Badge color="green">Total: {result.stats.total} rows</Badge>
              <Badge color="teal">Matched: {result.stats.matched}</Badge>
              {result.stats.skipped > 0 && <Badge color="gray">File 2 blank/header rows skipped: {result.stats.skipped}</Badge>}
              {result.stats.extra > 0 && <Badge color="orange">File 1 rows without NO/NAME: {result.stats.extra}</Badge>}
              <Text size="xs" c="dimmed">File 2 NO→<strong>"{result.stats.noCol2}"</strong> &nbsp; NAME→<strong>"{result.stats.nameCol2}"</strong></Text>
            </Group>
          </Alert>

          {/* Print preview — shows register format */}
          <Text size="xs" fw={600} c="dimmed">
            Register preview — first {Math.min(20, result.rows.length)} of {result.rows.length} rows
          </Text>
          <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
            <div ref={printRef} style={{ fontFamily: 'monospace', fontSize: 12, padding: 8 }}>
              {societyName && <div className="hdr" style={{ textAlign:'center', fontWeight:700, fontSize:14, marginBottom:2 }}>{societyName}</div>}
              {societyAddr && <div className="sub" style={{ textAlign:'center', fontSize:11, marginBottom:2 }}>{societyAddr}</div>}
              {reportTitle && <div className="title" style={{ textAlign:'center', fontWeight:700, fontSize:12, margin:'6px 0 10px', textDecoration:'underline' }}>{reportTitle}</div>}
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#e9e9e9' }}>
                    <th style={{ border:'1px solid #000', padding:'4px 8px', textAlign:'center', width:40 }}>NO</th>
                    <th style={{ border:'1px solid #000', padding:'4px 8px', textAlign:'left' }}>NAME</th>
                    <th style={{ border:'1px solid #000', padding:'4px 8px', textAlign:'left' }}>HOUSE</th>
                    <th style={{ border:'1px solid #000', padding:'4px 8px', textAlign:'right', width:80 }}>SHARE</th>
                    <th style={{ border:'1px solid #000', padding:'4px 8px', textAlign:'right', width:90 }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 20).map((r, i) => {
                    const house = result.houseCol  ? String(r[result.houseCol]  ?? '').trim().toUpperCase() : '';
                    const place = result.placeCol  ? String(r[result.placeCol]  ?? '').trim().toUpperCase() : '';
                    const share  = result.shareCol  ? num(r[result.shareCol]).toFixed(2)  : '0.00';
                    const amount = result.amountCol ? num(r[result.amountCol]).toFixed(2) : '0.00';
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ ...tdB, textAlign:'center', width:40 }}>{r.NO}</td>
                        <td style={tdB}>{String(r.NAME ?? '').trim().toUpperCase()}</td>
                        <td style={{ ...tdB, whiteSpace:'pre-line' }}>{house}{place ? '\n' + place : ''}</td>
                        <td style={{ ...tdB, textAlign:'right', width:80 }}>{share}</td>
                        <td style={{ ...tdB, textAlign:'right', width:90 }}>{amount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Paper>
          {result.rows.length > 20 && (
            <Text size="xs" c="dimmed" ta="center">… and {result.rows.length - 20} more rows — Download Excel to see all</Text>
          )}
        </Stack>
      )}
    </Paper>
  );
};

// ─── LINZA MILK SALES SECTION ─────────────────────────────────────────────
// Converts LinZA milk sales export → Zibitt-compatible format for MilkSales import
// LinZA columns: BillNo, Fnyear, BillDate, Shift, Rate, Ltr, Amt, Center, Vendor, TTYPE, BANK

const isLinZAMilkSales = (rows) => {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]).map(k => k.toLowerCase().trim());
  return (keys.includes('ltr') || keys.includes('litres') || keys.includes('litre')) &&
         (keys.includes('fnyear') || (keys.includes('billno') && keys.includes('shift')));
};

const parseLinZADate = (val) => {
  if (val == null || val === '' || val === '00:00.0') return null;
  // XLSX cellDates:true already returns a Date object — use it directly
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  // Excel serial number (e.g. 44567) — only raw numbers, not timestamps
  const n = Number(val);
  if (!isNaN(n) && n > 1 && n < 100000) return new Date(Math.round((n - 25569) * 86400000));
  if (typeof val === 'string') {
    const str = val.trim();
    if (!str || str === '0') return null;
    // DD-MM-YYYY or DD/MM/YYYY (LinZA default export format)
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      const d = new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const parseFallbackDateStr = (str) => {
  if (!str || !str.trim()) return null;
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(str);
  return isNaN(iso.getTime()) ? null : iso;
};

const LinZAMilkSalesSection = () => {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [fallbackDateStr, setFallbackDateStr] = useState('');

  const addFiles  = (picked) => { setFiles(prev => [...prev, ...picked]); setStatus(null); setResult(null); };
  const removeFile = (i) => { setFiles(prev => prev.filter((_, idx) => idx !== i)); setStatus(null); setResult(null); };
  const reset = () => { setFiles([]); setStatus(null); setResult(null); setFallbackDateStr(''); };

  const handleConvert = async () => {
    if (!files.length) return;
    setStatus('processing'); setResult(null);
    try {
      // Collect rows from ALL uploaded files (all sheets)
      const rows = [];
      for (const file of files) {
        const { sheets } = await readFileSheets(file);
        for (const sheetRows of Object.values(sheets)) {
          if (sheetRows.length && isLinZAMilkSales(sheetRows)) {
            sheetRows.forEach(r => rows.push(r));
          }
        }
      }

      if (!rows.length) {
        notifications.show({ title: 'No LinZA Data Found', message: 'No sheets matched LinZA format (need BillNo, Ltr, Shift columns)', color: 'orange' });
        setStatus(null); return;
      }

      const fallback = parseFallbackDateStr(fallbackDateStr);
      const converted = [];
      let missingDate = 0, withDate = 0, skipped = 0;

      rows.forEach((row, i) => {
        const ltr = num(getPartyColVal(row, 'Ltr', 'Litres', 'Litre', 'qty', 'Sales_Qty'));
        const amt = num(getPartyColVal(row, 'Amt', 'Amount', 'TotalAmt', 'total'));
        // Skip header-repeat rows and truly empty rows
        if (ltr === 0 && amt === 0) { skipped++; return; }

        const billNo  = String(getPartyColVal(row, 'BillNo', 'Bill No', 'bill_no', 'VoucherNo') || `LNZ-${i + 1}`).trim();
        const rawDate = getPartyColVal(row, 'BillDate', 'Bill Date', 'SalesDate', 'Date');
        const parsedDate = parseLinZADate(rawDate);
        const finalDate = parsedDate ?? fallback;

        if (!parsedDate) missingDate++;
        else withDate++;

        const shift  = String(getPartyColVal(row, 'Shift', 'SalesShift', 'session') ?? '0').trim();
        const rate   = num(getPartyColVal(row, 'Rate', 'RatePerLtr', 'rate'));
        const center = String(getPartyColVal(row, 'Center', 'Centre', 'Centercode') ?? '').trim();
        const vendor = String(getPartyColVal(row, 'Vendor', 'Creditor', 'cust_id', 'customer') ?? '').trim();
        const ttype  = String(getPartyColVal(row, 'TTYPE', 'TType', 'Type', 'SaleType') ?? 'CASH').trim().toUpperCase();
        const saleMode = (ttype === 'CREDIT' || ttype === 'CR') ? 'CREDIT' : 'LOCAL';

        converted.push({
          BillNo:     billNo,
          SalesDate:  finalDate,     // Date object — XLSX writes as serial
          SalesShift: shift === '1' ? 1 : 0,
          Sales_Qty:  ltr,
          RatePerLtr: rate,
          TotalAmt:   amt,
          Centercode: center,
          Vendor:     vendor,
          SaleMode:   saleMode,
        });
      });

      if (!converted.length) {
        notifications.show({ title: 'No Valid Rows', message: 'All rows skipped (zero qty and amount)', color: 'orange' });
        setStatus(null); return;
      }

      const localRows  = converted.filter(r => r.SaleMode === 'LOCAL');
      const creditRows = converted.filter(r => r.SaleMode === 'CREDIT');

      setResult({ rows: converted, localRows, creditRows, missingDate, withDate, skipped, fallbackUsed: missingDate > 0 && !!fallback });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleDownload = (subset = 'all') => {
    if (!result?.rows?.length) return;
    const rows = subset === 'local'  ? result.localRows
               : subset === 'credit' ? result.creditRows
               : result.rows;
    if (!rows.length) { notifications.show({ title: 'No rows', color: 'orange' }); return; }
    const label = subset === 'local' ? 'local' : subset === 'credit' ? 'credit' : 'all';
    downloadExcel(rows, `linza_milksales_${label}_${Date.now()}.xlsx`, 'Milk Sales');
    notifications.show({ title: 'Downloaded', message: `${rows.length} rows — import via MilkSales → Import (Zibitt)`, color: 'green' });
  };

  const previewRows = result?.rows?.slice(0, 12) ?? [];

  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md">
        <ThemeIcon color="green" variant="light" size="lg">
          <IconMilk size={20} />
        </ThemeIcon>
        <div>
          <Title order={4}>LinZA Milk Sales Convert</Title>
          <Text size="xs" c="dimmed">
            Convert LinZA milk sales (BillNo, Fnyear, Ltr, Shift…) → Zibitt-compatible import format
          </Text>
        </div>
      </Group>

      <Alert icon={<IconAlertCircle size={14} />} color="green" variant="light" mb="md" p="xs">
        <Text size="xs">
          Upload the LinZA milk sales Excel. BillDate is often missing (shows 00:00.0) — set a <strong>Fallback Date</strong>
          for those rows. After download, import via <strong>Milk Sales → Import (Zibitt Local Sales)</strong>.
        </Text>
      </Alert>

      {/* Files + Fallback date */}
      <SimpleGrid cols={2} spacing="md" mb="md">
        <FileListBox
          label="LinZA Milk Sales Files (select 1 or more)"
          color="green"
          files={files}
          onAdd={addFiles}
          onRemove={removeFile}
        />
        <Box>
          <TextInput
            label="Fallback Date (for missing BillDate rows)"
            placeholder="DD-MM-YYYY  e.g. 01-04-2022"
            value={fallbackDateStr}
            onChange={e => setFallbackDateStr(e.currentTarget.value)}
            size="sm"
            description="Applied when BillDate is 00:00.0 or blank"
          />
          {fallbackDateStr && (
            <Text size="xs" c={parseFallbackDateStr(fallbackDateStr) ? 'green' : 'red'} mt={4}>
              {parseFallbackDateStr(fallbackDateStr)
                ? `Parsed: ${parseFallbackDateStr(fallbackDateStr).toLocaleDateString('en-IN')}`
                : 'Invalid date format'}
            </Text>
          )}
        </Box>
      </SimpleGrid>

      {/* Actions */}
      <Group>
        <Button
          color="green"
          leftSection={<IconTransform size={16} />}
          onClick={handleConvert}
          loading={status === 'processing'}
          disabled={!files.length}
        >
          Convert
        </Button>
        {result?.rows?.length > 0 && (
          <>
            <Button color="green" variant="light" leftSection={<IconDownload size={16} />}
              onClick={() => handleDownload('all')}>
              All ({result.rows.length})
            </Button>
            {result.localRows.length > 0 && result.creditRows.length > 0 && (
              <>
                <Button color="teal" variant="light" leftSection={<IconDownload size={14} />}
                  onClick={() => handleDownload('local')}>
                  Local ({result.localRows.length})
                </Button>
                <Button color="violet" variant="light" leftSection={<IconDownload size={14} />}
                  onClick={() => handleDownload('credit')}>
                  Credit ({result.creditRows.length})
                </Button>
              </>
            )}
          </>
        )}
        {(files.length > 0 || result) && (
          <Button variant="subtle" color="gray" size="xs" onClick={reset}>Clear</Button>
        )}
      </Group>

      {/* Result */}
      {status === 'done' && result && (
        <Stack gap="xs" mt="md">
          <Alert icon={<IconCircleCheck size={14} />} color="green" variant="light" p="xs">
            <Group gap="xs" wrap="wrap">
              <Badge color="green">Converted: {result.rows.length}</Badge>
              <Badge color="teal">Local/Cash: {result.localRows.length}</Badge>
              {result.creditRows.length > 0 && <Badge color="violet">Credit: {result.creditRows.length}</Badge>}
              <Badge color="blue">With date: {result.withDate}</Badge>
              {result.missingDate > 0 && (
                <Badge color={result.fallbackUsed ? 'orange' : 'red'}>
                  Missing date: {result.missingDate}{result.fallbackUsed ? ' (fallback used)' : ' (no fallback!)'}
                </Badge>
              )}
              {result.skipped > 0 && <Badge color="gray">Skipped (empty): {result.skipped}</Badge>}
            </Group>
            {result.missingDate > 0 && !result.fallbackUsed && (
              <Text size="xs" c="red" mt={4}>
                Warning: {result.missingDate} rows have no date and no fallback date was set — set Fallback Date and re-convert.
              </Text>
            )}
          </Alert>

          {previewRows.length > 0 && (
            <>
              <Text size="xs" fw={600} c="dimmed">
                Preview — first {previewRows.length} of {result.rows.length} rows
              </Text>
              <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f1f3f5' }}>
                      {Object.keys(previewRows[0]).map(col => (
                        <th key={col} style={{ border: '1px solid #dee2e6', padding: '3px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        {Object.entries(row).map(([col, val], j) => (
                          <td key={j} style={{ border: '1px solid #dee2e6', padding: '2px 6px' }}>
                            {val instanceof Date ? val.toLocaleDateString('en-IN') : String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Paper>
              {result.rows.length > 12 && (
                <Text size="xs" c="dimmed" ta="center">… and {result.rows.length - 12} more rows</Text>
              )}
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
};

// ─── PARTY CONVERT SECTION ────────────────────────────────────────────────
// Converts OpenLyssa Creditor/Customer export → ERP Farmer / Customer import format
// Creditor columns: Nos, CreditorName, Center  → Farmer import
// Customer columns: Nos, Name, Center          → Customer import

const detectPartyType = (rows) => {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).map(k => k.toLowerCase().trim());
  if (keys.some(k => k === 'creditorname' || k === 'creditor name' || k === 'creditor_name')) return 'creditor';
  if (keys.some(k => k === 'name')) return 'customer';
  return null;
};

const getPartyColVal = (row, ...candidates) => {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const cl = cand.toLowerCase().trim();
    const k = keys.find(k => k.toLowerCase().trim() === cl) ?? keys.find(k => k.toLowerCase().trim().includes(cl));
    if (k !== undefined && row[k] !== null && row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
};

const PartyConvertSection = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [modeOverride, setModeOverride] = useState(null); // 'creditor' | 'customer' | null
  const fileRef = useRef(null);

  const reset = () => { setFile(null); setStatus(null); setResult(null); setModeOverride(null); };

  const handleFile = (f) => {
    setFile(f); setStatus(null); setResult(null); setModeOverride(null);
  };

  const handleConvert = async () => {
    if (!file) return;
    setStatus('processing'); setResult(null);
    try {
      const { sheets } = await readFileSheets(file);
      const rows = Object.values(sheets).find(r => r.length) ?? [];
      if (!rows.length) {
        notifications.show({ title: 'Empty File', message: 'No rows found in file', color: 'orange' });
        setStatus(null); return;
      }

      const autoMode = detectPartyType(rows);
      const mode = modeOverride ?? autoMode;

      if (!mode) {
        notifications.show({
          title: 'Cannot Detect Type',
          message: 'Expected columns: CreditorName (for farmers) or Name (for customers). Check the file.',
          color: 'red',
        });
        setStatus(null); return;
      }

      let converted = [];
      if (mode === 'creditor') {
        // → Farmer import: Farmer Number, Member ID, Name, Phone Number, Collection Center
        converted = rows
          .filter(row => {
            const nos = getPartyColVal(row, 'Nos', 'no', 'sl no', 'slno', 'number');
            return nos !== '' && !isNaN(Number(nos)) && Number(nos) > 0;
          })
          .map(row => {
            const nos    = String(getPartyColVal(row, 'Nos', 'no', 'sl no', 'slno', 'number')).trim();
            const name   = String(getPartyColVal(row, 'CreditorName', 'creditor name', 'creditor_name', 'name')).trim();
            const center = String(getPartyColVal(row, 'Center', 'centre', 'collection center', 'cc')).trim();
            return {
              'Farmer Number': nos,
              'Member ID':     nos,
              'Name':          name,
              'Phone Number':  '',
              'Collection Center': center,
            };
          });
      } else {
        // → Customer import: name, customerId, Center
        converted = rows
          .filter(row => {
            const nos = getPartyColVal(row, 'Nos', 'no', 'sl no', 'slno', 'number');
            return nos !== '' && !isNaN(Number(nos)) && Number(nos) > 0;
          })
          .map(row => {
            const nos    = String(getPartyColVal(row, 'Nos', 'no', 'sl no', 'slno', 'number')).trim();
            const name   = String(getPartyColVal(row, 'Name', 'customer name', 'customername', 'party name')).trim();
            const center = String(getPartyColVal(row, 'Center', 'centre', 'collection center', 'cc')).trim();
            return {
              'Customer Number': nos,
              'Name':            name,
              'Phone':           '',
              'Email':           '',
              'Address':         '',
              'Center':          center,
            };
          });
      }

      if (!converted.length) {
        notifications.show({ title: 'No Valid Rows', message: 'All rows were skipped (invalid Nos values)', color: 'orange' });
        setStatus(null); return;
      }

      setResult({ rows: converted, mode, total: rows.length, converted: converted.length, skipped: rows.length - converted.length });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleDownload = () => {
    if (!result?.rows?.length) return;
    const filename = result.mode === 'creditor'
      ? `farmer_import_${Date.now()}.xlsx`
      : `customer_import_${Date.now()}.xlsx`;
    const sheet = result.mode === 'creditor' ? 'Farmers' : 'Customers';
    downloadExcel(result.rows, filename, sheet);
    notifications.show({ title: 'Downloaded', message: `${result.rows.length} rows — ready for ERP import`, color: 'green' });
  };

  const detectedMode = result?.mode ?? modeOverride;
  const previewRows = result?.rows?.slice(0, 15) ?? [];

  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md">
        <ThemeIcon color="violet" variant="light" size="lg">
          <IconUsers size={20} />
        </ThemeIcon>
        <div>
          <Title order={4}>Party Convert — Creditor / Customer</Title>
          <Text size="xs" c="dimmed">
            Convert OpenLyssa Creditor or Customer export → ERP Farmer / Customer import format
          </Text>
        </div>
      </Group>

      <Alert icon={<IconAlertCircle size={14} />} color="violet" variant="light" mb="md" p="xs">
        <Text size="xs">
          Upload the OpenLyssa <strong>Creditor table</strong> (Nos, CreditorName, Center) → produces <strong>Farmer import</strong> file.&nbsp;
          Upload the <strong>Customer table</strong> (Nos, Name, Center) → produces <strong>Customer import</strong> file.
          The tool auto-detects the type from column names.
        </Text>
      </Alert>

      {/* File picker */}
      <SingleFilePicker
        label="OpenLyssa Creditor or Customer Excel"
        color="violet"
        file={file}
        onAdd={handleFile}
        onRemove={reset}
      />

      {/* Override mode selector */}
      {file && (
        <Group mt="sm" gap="xs">
          <Text size="xs" c="dimmed">Force type:</Text>
          {['creditor', 'customer'].map(m => (
            <Badge
              key={m}
              size="md"
              variant={modeOverride === m ? 'filled' : 'outline'}
              color={m === 'creditor' ? 'blue' : 'teal'}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setModeOverride(prev => prev === m ? null : m)}
            >
              {m === 'creditor' ? 'Farmer (Creditor)' : 'Customer'}
            </Badge>
          ))}
          {modeOverride && (
            <Text size="xs" c="dimmed">(auto-detect disabled)</Text>
          )}
        </Group>
      )}

      {/* Actions */}
      <Group mt="sm">
        <Button
          color="violet"
          leftSection={<IconTransform size={16} />}
          onClick={handleConvert}
          loading={status === 'processing'}
          disabled={!file}
        >
          Convert
        </Button>
        <Button
          color="green"
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={handleDownload}
          disabled={!result?.rows?.length}
        >
          Download ({result?.rows?.length ?? 0} rows)
        </Button>
        {(file || result) && (
          <Button variant="subtle" color="gray" size="xs" onClick={reset}>Clear</Button>
        )}
      </Group>

      {/* Result */}
      {status === 'done' && result && (
        <Stack gap="xs" mt="md">
          <Alert icon={<IconCircleCheck size={14} />} color="green" variant="light" p="xs">
            <Group gap="xs" wrap="wrap">
              <Badge color={result.mode === 'creditor' ? 'blue' : 'teal'}>
                {result.mode === 'creditor' ? 'Farmer (Creditor)' : 'Customer'} mode
              </Badge>
              <Badge color="green">Converted: {result.converted}</Badge>
              {result.skipped > 0 && <Badge color="gray">Skipped (blank/header): {result.skipped}</Badge>}
            </Group>
          </Alert>

          {previewRows.length > 0 && (
            <>
              <Text size="xs" fw={600} c="dimmed">
                Preview — first {previewRows.length} of {result.rows.length} rows
              </Text>
              <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f1f3f5' }}>
                      {Object.keys(previewRows[0]).map(col => (
                        <th key={col} style={{ border: '1px solid #dee2e6', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} style={{ border: '1px solid #dee2e6', padding: '3px 8px' }}>{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Paper>
              {result.rows.length > 15 && (
                <Text size="xs" c="dimmed" ta="center">… and {result.rows.length - 15} more rows — Download to see all</Text>
              )}
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
};

// ─── LINZA MILK PURCHASE MERGE SECTION ────────────────────────────────────
// File 1: LinZA milk purchase bills  (Billno, Nos, FnYear, Billdate, shift, Fat, Clr, Snf, Rate, Ltr, Incent, Amt…)
// File 2: Member master              (Nos/NonNos, Name, House, Place, phone…)
// Logic : match bill Nos → member NonNos (then Nos as fallback) — INDEX/MATCH equivalent

const LinZAMilkPurchaseMergeSection = () => {
  const [milkFile,     setMilkFile]     = useState(null);
  const [memberFiles,  setMemberFiles]  = useState([]);   // multiple member master files
  const [fallbackDateStr, setFallbackDateStr] = useState('');
  const [availableYears,  setAvailableYears]  = useState([]);   // [[year, count], …]
  const [selectedYears,   setSelectedYears]   = useState(new Set());
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [overrides, setOverrides] = useState({}); // { [nosKey]: { name, phone } }

  const resetMilk   = () => { setMilkFile(null); setStatus(null); setResult(null); setAvailableYears([]); setSelectedYears(new Set()); setOverrides({}); };
  const resetMember = () => { setMemberFiles([]); setStatus(null); setResult(null); setOverrides({}); };
  const reset       = () => { resetMilk(); resetMember(); setFallbackDateStr(''); };

  const toggleYear = (y) => setSelectedYears(prev => {
    const next = new Set(prev);
    next.has(y) ? next.delete(y) : next.add(y);
    return next;
  });

  // Scan FnYear values from milk file so user can filter by financial year
  const handleScanYears = async () => {
    if (!milkFile) return;
    setStatus('scanning'); setAvailableYears([]); setSelectedYears(new Set()); setResult(null);
    try {
      const { sheets } = await readFileSheets(milkFile);
      const yearCounts = new Map();
      for (const rows of Object.values(sheets)) {
        rows.forEach(row => {
          const fy = Number(getPartyColVal(row, 'FnYear', 'fnyear', 'fn_year', 'year', 'financial_year'));
          if (!isNaN(fy) && fy > 1990 && fy < 2100) {
            yearCounts.set(fy, (yearCounts.get(fy) ?? 0) + 1);
          }
        });
      }
      if (!yearCounts.size) {
        notifications.show({ title: 'No FnYear column', message: 'All rows will be included — no year filtering', color: 'orange' });
        setStatus('ready'); return;
      }
      const sorted = [...yearCounts.entries()].sort((a, b) => a[0] - b[0]);
      setAvailableYears(sorted);
      setSelectedYears(new Set(sorted.map(([y]) => y)));
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      notifications.show({ title: 'Scan Error', message: err.message, color: 'red' });
    }
  };

  const handleMerge = async () => {
    if (!milkFile || !memberFiles.length) {
      notifications.show({ title: 'Missing Files', message: 'Upload milk purchase file and at least one member master file', color: 'orange' });
      return;
    }
    setStatus('processing'); setResult(null);
    try {
      const [milkResult, ...memberResults] = await Promise.all([
        readFileSheets(milkFile),
        ...memberFiles.map(f => readFileSheets(f)),
      ]);
      const milkSheets = milkResult.sheets;

      // Collect all milk rows
      const milkRows = [];
      for (const rows of Object.values(milkSheets)) {
        if (rows.length) rows.forEach(r => milkRows.push(r));
      }
      if (!milkRows.length) {
        notifications.show({ title: 'Empty Milk File', message: 'No rows found', color: 'red' });
        setStatus(null); return;
      }

      // Build two lookup maps from ALL member master files combined:
      //   byNonNos — keyed on NonNos (LinZA farmer number, matches milk bill Nos)
      //   byNos    — keyed on Nos    (member register number, fallback)
      const byNonNos = new Map();
      const byNos    = new Map();
      const detectedMemberCols = new Set(); // track which column names were found in member files
      for (const { sheets: memberSheets } of memberResults) {
      for (const rows of Object.values(memberSheets)) {
        if (!rows.length) continue;
        // Record the actual column names present in this sheet for diagnostics
        Object.keys(rows[0]).forEach(k => detectedMemberCols.add(k));
        rows.forEach(row => {
          const nosVal    = normalizeNos(getPartyColVal(row, 'Nos',    'nos',    'no',    'sl no'));
          const nonNosVal = normalizeNos(getPartyColVal(row, 'NonNos', 'nonnos', 'non_nos', 'nonno', 'non nos', 'linza nos', 'linzanos', 'farmer no', 'farmer_no', 'farmerno'));
          const name  = String(getPartyColVal(row, 'Name', 'name', 'CreditorName') ?? '').trim();
          const phone = String(getPartyColVal(row, 'phone', 'Phone', 'mobile', 'Mobile') ?? '').trim();
          // memberNos = member register serial (Nos column) — the "correct" Nos for ERP
          const info  = { name, phone, memberNos: nosVal };
          if (nonNosVal !== null && !byNonNos.has(nonNosVal)) byNonNos.set(nonNosVal, info);
          // If Nos was corrected in member file, treat it as NonNos too for lookup
          if (nosVal    !== null && !byNonNos.has(nosVal))    byNonNos.set(nosVal,    info);
          if (nosVal    !== null && !byNos.has(nosVal))       byNos.set(nosVal,    info);
        });
      }
      }
      if (!byNonNos.size && !byNos.size) {
        notifications.show({ title: 'No Member Data', message: 'Member master must have Nos/NonNos + Name columns', color: 'red' });
        setStatus(null); return;
      }

      // Try NonNos map first (correct match for milk bill Nos), then Nos map as fallback
      const lookupMember = (nosKey) => byNonNos.get(nosKey) ?? byNos.get(nosKey) ?? null;

      const fallback = parseFallbackDateStr(fallbackDateStr);
      const merged   = [];
      let matchedCount = 0, noDateCount = 0, skippedYear = 0;
      const unmatchedNos = new Set();

      milkRows.forEach((row) => {
        // Year filter (skip if FnYear present and not selected)
        if (availableYears.length > 0 && selectedYears.size > 0) {
          const fy = Number(getPartyColVal(row, 'FnYear', 'fnyear', 'fn_year', 'year'));
          if (!isNaN(fy) && fy > 1990 && !selectedYears.has(fy)) { skippedYear++; return; }
        }

        // Nos lookup — bill's Nos matches member's NonNos
        const nosRaw = getPartyColVal(row, 'Nos', 'nos', 'no', 'farmer_id', 'member_id', 'producer_id');
        const nosKey = normalizeNos(nosRaw);
        const member = nosKey !== null ? lookupMember(nosKey) : null;
        if (member) matchedCount++;
        else if (nosKey !== null) unmatchedNos.add(nosKey);

        // Date: Billdate is often "00:00.0" in LinZA — use fallback
        const rawDate  = getPartyColVal(row, 'Billdate', 'BillDate', 'Bill_Date', 'Date', 'date_entry', 'saledate');
        const parsedDate = parseLinZADate(rawDate);
        const finalDate  = parsedDate ?? fallback;
        if (!parsedDate) noDateCount++;

        const shiftRaw = String(getPartyColVal(row, 'shift', 'Shift', 'session', 'time') ?? '').trim();
        const shiftNum = Number(shiftRaw);
        const shift = shiftRaw.toUpperCase() === 'AM' ? 'AM'
          : shiftRaw.toUpperCase() === 'PM' ? 'PM'
          : shiftNum === 0 ? 'AM' : shiftNum === 1 ? 'PM'
          : shiftRaw;

        merged.push({
          Nos:       member?.memberNos ?? nosKey ?? String(nosRaw ?? '').trim(),
          Name:     member?.name  ?? '',
          Phone:    member?.phone ?? '',
          BillNo:   String(getPartyColVal(row, 'Billno', 'BillNo', 'bill_no', 'billno') ?? '').trim(),
          FnYear:   String(getPartyColVal(row, 'FnYear', 'fnyear', 'year') ?? '').trim(),
          BillDate: finalDate ? finalDate.toLocaleDateString('en-IN') : '',
          Shift:    shift,
          Fat:      num(getPartyColVal(row, 'Fat',   'fat')),
          Clr:      num(getPartyColVal(row, 'Clr',   'clr',   'CLR')),
          Snf:      num(getPartyColVal(row, 'Snf',   'snf',   'SNF')),
          Rate:     num(getPartyColVal(row, 'Rate',  'rate')),
          Ltr:      num(getPartyColVal(row, 'Ltr',   'ltr',   'Litres', 'litres', 'qty')),
          Incent:   num(getPartyColVal(row, 'Incent','incent','incentive','Incentive')),
          Amt:      num(getPartyColVal(row, 'Amt',   'amt',   'Amount',  'amount')),
          Vendor:   String(getPartyColVal(row, 'Vendor', 'vendor') ?? '').trim(),
          Mode:     String(getPartyColVal(row, 'Mode',   'mode')   ?? '').trim(),
          Water:    num(getPartyColVal(row, 'Water', 'water')),
        });
      });

      setResult({
        rows: merged,
        stats: {
          milkRows:          milkRows.length,
          memberFiles:       memberFiles.length,
          memberKeys:        byNonNos.size || byNos.size,
          usedNonNos:        byNonNos.size > 0,
          merged:            merged.length,
          matched:           matchedCount,
          unmatched:         unmatchedNos.size,
          unmatchedList:     [...unmatchedNos],
          detectedMemberCols:[...detectedMemberCols],
          noDate:            noDateCount,
          fallbackUsed: noDateCount > 0 && !!fallback,
          skippedYear,
        },
      });
      setStatus('done');
      notifications.show({ title: 'Merged!', message: `${merged.length} rows — ${matchedCount} matched`, color: 'teal' });
    } catch (err) {
      setStatus('error');
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleApplyOverrides = () => {
    if (!result) return;
    const updatedRows = result.rows.map(row => {
      if (row.Name !== '') return row; // already matched — don't touch
      const key = String(row.Nos);
      const ov = overrides[key];
      if (!ov?.name) return row;
      const correctedNos = ov.memberNos?.trim() ? normalizeNos(ov.memberNos.trim()) ?? row.Nos : row.Nos;
      return { ...row, Nos: correctedNos, Name: ov.name.trim(), Phone: ov.phone?.trim() || row.Phone };
    });
    const newUnmatched = [...new Set(updatedRows.filter(r => r.Name === '').map(r => r.Nos))];
    setResult(prev => ({
      ...prev,
      rows: updatedRows,
      stats: {
        ...prev.stats,
        matched:       updatedRows.filter(r => r.Name !== '').length,
        unmatched:     newUnmatched.length,
        unmatchedList: newUnmatched,
      },
    }));
    setOverrides({});
    notifications.show({ title: 'Names Applied', message: 'Override names filled into merged rows', color: 'teal', autoClose: 2500 });
  };

  const handleDownload = (subset = 'all') => {
    if (!result?.rows?.length) return;
    const rows = subset === 'matched' ? result.rows.filter(r => r.Name !== '') : result.rows;
    if (!rows.length) { notifications.show({ title: 'No rows', color: 'orange' }); return; }
    const exportRows = rows.map(({ Name, Phone, ...rest }) => rest);
    downloadExcel(exportRows, `linza_milkpurchase_merged_${Date.now()}.xlsx`, 'Milk Purchase');
    notifications.show({ title: 'Downloaded', message: `${rows.length} rows`, color: 'green' });
  };

  const previewRows = result?.rows?.slice(0, 10) ?? [];

  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md">
        <ThemeIcon color="indigo" variant="light" size="lg">
          <IconArrowsJoin size={20} />
        </ThemeIcon>
        <div>
          <Title order={4}>LinZA Milk Purchase — Member Merge</Title>
          <Text size="xs" c="dimmed">
            Match bill Nos → member NonNos/Nos to attach Name (INDEX/MATCH equivalent)
          </Text>
        </div>
      </Group>

      <Alert icon={<IconAlertCircle size={14} />} color="indigo" variant="light" mb="md" p="xs">
        <Text size="xs">
          <strong>File 1</strong> — LinZA milk purchase bills (Nos, Billdate, Fat, Clr, Snf, Rate, Ltr, Amt…).&nbsp;
          <strong>File 2</strong> — Member master (Nos, NonNos, Name, House, Place…).&nbsp;
          Bill <em>Nos</em> is matched against member <em>NonNos</em> (LinZA farmer number) to attach the correct Name.
        </Text>
      </Alert>

      {/* File pickers */}
      <SimpleGrid cols={2} spacing="md" mb="md">
        <SingleFilePicker
          label="File 1 — LinZA Milk Purchase Bills"
          color="indigo"
          file={milkFile}
          onAdd={(f) => { setMilkFile(f); setStatus(null); setResult(null); setAvailableYears([]); setSelectedYears(new Set()); }}
          onRemove={resetMilk}
        />
        <FileListBox
          label="File 2 — Member Master (Nos + NonNos + Name)"
          color="green"
          files={memberFiles}
          onAdd={(picked) => { setMemberFiles(prev => [...prev, ...picked]); setStatus(null); setResult(null); }}
          onRemove={(i) => { setMemberFiles(prev => prev.filter((_, idx) => idx !== i)); setStatus(null); setResult(null); }}
        />
      </SimpleGrid>

      {/* Fallback date for missing Billdate */}
      <Box mb="sm">
        <TextInput
          label="Fallback Date (for rows where Billdate is 00:00.0 or blank)"
          placeholder="DD-MM-YYYY  e.g. 01-04-2022"
          value={fallbackDateStr}
          onChange={e => setFallbackDateStr(e.currentTarget.value)}
          size="sm"
          maw={300}
          description="Applied when Billdate is missing in LinZA export"
        />
        {fallbackDateStr && (
          <Text size="xs" c={parseFallbackDateStr(fallbackDateStr) ? 'green' : 'red'} mt={4}>
            {parseFallbackDateStr(fallbackDateStr)
              ? `Parsed: ${parseFallbackDateStr(fallbackDateStr).toLocaleDateString('en-IN')}`
              : 'Invalid date format — use DD-MM-YYYY'}
          </Text>
        )}
      </Box>

      {/* Scan FnYear */}
      <Group mb="sm">
        <Button size="xs" variant="light" color="indigo"
          leftSection={<IconCalendar size={14} />}
          onClick={handleScanYears}
          loading={status === 'scanning'}
          disabled={!milkFile}>
          Scan FnYears
        </Button>
        {(milkFile || memberFiles.length > 0 || result) && (
          <Button variant="subtle" color="gray" size="xs" onClick={reset}>Clear</Button>
        )}
      </Group>

      {/* Year filter */}
      {availableYears.length > 0 && (
        <Paper withBorder p="sm" mb="sm" radius="sm">
          <Group mb="xs" justify="space-between">
            <Group gap={6}>
              <IconFilter size={14} />
              <Text size="xs" fw={600}>Filter by FnYear</Text>
            </Group>
            <Group gap={6}>
              <Button size="xs" variant="subtle" compact onClick={() => setSelectedYears(new Set(availableYears.map(([y]) => y)))}>All</Button>
              <Button size="xs" variant="subtle" compact onClick={() => setSelectedYears(new Set())}>None</Button>
            </Group>
          </Group>
          <Group gap="xs">
            {availableYears.map(([y, count]) => (
              <Badge key={y} size="lg" variant={selectedYears.has(y) ? 'filled' : 'outline'}
                color="indigo" style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleYear(y)}>
                FY {y} ({count.toLocaleString()})
              </Badge>
            ))}
          </Group>
          <Text size="xs" c="dimmed" mt={6}>
            {selectedYears.size} of {availableYears.length} year{availableYears.length !== 1 ? 's' : ''} selected
          </Text>
        </Paper>
      )}

      {/* Merge + download buttons */}
      <Group>
        <Button color="indigo" leftSection={<IconArrowsJoin size={16} />}
          onClick={handleMerge} loading={status === 'processing'}
          disabled={!milkFile || !memberFiles.length}>
          Merge (Match by Nos)
        </Button>
        {result?.rows?.length > 0 && (
          <>
            <Button color="green" variant="light" leftSection={<IconDownload size={16} />}
              onClick={() => handleDownload('all')}>
              All ({result.rows.length})
            </Button>
            {result.stats.unmatched > 0 && (
              <Button color="teal" variant="light" leftSection={<IconDownload size={14} />}
                onClick={() => handleDownload('matched')}>
                Matched only ({result.stats.matched})
              </Button>
            )}
          </>
        )}
      </Group>

      {/* Result stats + preview */}
      {status === 'done' && result && (
        <Stack gap="xs" mt="md">
          <Alert icon={<IconCircleCheck size={14} />} color="green" variant="light" p="xs">
            <Stack gap={2}>
              <Text size="xs">
                Milk rows: <strong>{result.stats.milkRows}</strong> &nbsp;|&nbsp;
                Member files: <strong>{result.stats.memberFiles}</strong> &nbsp;|&nbsp;
                Member records: <strong>{result.stats.memberKeys}</strong>
                {result.stats.usedNonNos && <Text span c="dimmed"> (matched via NonNos)</Text>}
              </Text>
              <Text size="xs" fw={700} c="green">Merged: {result.stats.merged} rows</Text>
              <Text size="xs">Name matched: <strong>{result.stats.matched}</strong></Text>
              {result.stats.unmatched > 0 && (
                <Text size="xs" c="orange">
                  Nos not found in member master: <strong>{result.stats.unmatched}</strong>
                  {result.stats.unmatchedList.length > 0 && ` — e.g. ${result.stats.unmatchedList.join(', ')}${result.stats.unmatched > 20 ? '…' : ''}`}
                </Text>
              )}
              {result.stats.noDate > 0 && (
                <Text size="xs" c={result.stats.fallbackUsed ? 'orange' : 'red'}>
                  Missing Billdate: {result.stats.noDate}
                  {result.stats.fallbackUsed ? ' (fallback applied)' : ' — set Fallback Date and re-merge!'}
                </Text>
              )}
              {result.stats.skippedYear > 0 && (
                <Text size="xs" c="dimmed">Skipped by FnYear filter: {result.stats.skippedYear}</Text>
              )}
              {result.stats.detectedMemberCols?.length > 0 && (
                <Text size="xs" c="dimmed">
                  Member file columns: <strong>{result.stats.detectedMemberCols.join(', ')}</strong>
                </Text>
              )}
            </Stack>
          </Alert>

          {/* ── Manual name override for unmatched Nos ── */}
          {result.stats.unmatchedList.length > 0 && (
            <Paper withBorder p="sm" radius="sm" style={{ borderColor: '#fd7e14' }}>
              <Text size="xs" fw={700} c="orange" mb="xs">
                Enter names for {result.stats.unmatchedList.length} unmatched Nos — type name &amp; click Apply
              </Text>
              <Stack gap={6}>
                {result.stats.unmatchedList.map(nosKey => (
                  <Group key={nosKey} gap="xs" align="flex-end" wrap="nowrap">
                    <Text size="xs" fw={700} c="orange" style={{ width: 60, flexShrink: 0 }}>
                      Nos: {nosKey}
                    </Text>
                    <TextInput
                      size="xs"
                      placeholder="Member Name *"
                      style={{ flex: 1 }}
                      value={overrides[String(nosKey)]?.name || ''}
                      onChange={e => setOverrides(prev => ({ ...prev, [String(nosKey)]: { ...prev[String(nosKey)], name: e.target.value } }))}
                    />
                    <TextInput
                      size="xs"
                      placeholder="Actual Nos (e.g. 34)"
                      style={{ width: 130 }}
                      value={overrides[String(nosKey)]?.memberNos || ''}
                      onChange={e => setOverrides(prev => ({ ...prev, [String(nosKey)]: { ...prev[String(nosKey)], memberNos: e.target.value } }))}
                    />
                    <TextInput
                      size="xs"
                      placeholder="Phone"
                      style={{ width: 110 }}
                      value={overrides[String(nosKey)]?.phone || ''}
                      onChange={e => setOverrides(prev => ({ ...prev, [String(nosKey)]: { ...prev[String(nosKey)], phone: e.target.value } }))}
                    />
                  </Group>
                ))}
                <Button
                  size="xs"
                  color="orange"
                  onClick={handleApplyOverrides}
                  disabled={!Object.values(overrides).some(v => v?.name?.trim())}
                >
                  Apply Names
                </Button>
              </Stack>
            </Paper>
          )}

          {previewRows.length > 0 && (
            <>
              <Text size="xs" fw={600} c="dimmed">
                Preview — first {previewRows.length} of {result.rows.length} rows
              </Text>
              <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f1f3f5' }}>
                      {Object.keys(previewRows[0]).map(col => (
                        <th key={col} style={{ border: '1px solid #dee2e6', padding: '3px 6px', whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        {Object.entries(row).map(([col, val], j) => (
                          <td key={j} style={{ border: '1px solid #dee2e6', padding: '2px 6px',
                            color: col === 'Name' && !val ? '#fa5252' : undefined }}>
                            {String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Paper>
              {result.rows.length > 10 && (
                <Text size="xs" c="dimmed" ta="center">… and {result.rows.length - 10} more rows — Download to see all</Text>
              )}
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────

const OpenLyssaMergeTool = () => (
  <Box p="md" maw={820} mx="auto">
    <Paper p="md" mb="md" withBorder>
      <Group mb={4}>
        <Title order={2}>OpenLyssa Data Merge Tool</Title>
      </Group>
      <Text c="dimmed" size="sm">
        Merge multiple monthly export files from OpenLyssa into a single Excel file ready for import.
      </Text>
    </Paper>

    <Stack gap="md">
      <PartyConvertSection />
      <LinZAMilkSalesSection />
      <LinZAMilkPurchaseMergeSection />
      <LynzAMergeSection />
      <MilkPurchaseSection />
      <MilkSalesSection />
    </Stack>
  </Box>
);

export default OpenLyssaMergeTool;
