import { useState, useRef } from 'react';
import {
  Box, Paper, Title, Text, Group, Button, Stack, ActionIcon,
  Badge, Divider, Alert, List, ThemeIcon, Progress, SimpleGrid, Card
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload, IconTrash, IconDownload, IconRefresh,
  IconAlertCircle, IconCircleCheck, IconMilk, IconShoppingCart,
  IconCalendar, IconFilter
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
        merged.push({
          Date:        fmtDate(session.date),
          Shift:       session.shift,
          mc_id:       String(row.mc_id ?? ''),
          producer_id: row.producer_id ?? findRowVal(row, 'producer_id', 'farmer_id', 'member_id') ?? '',
          slno:        row.slno ?? row.sl_no ?? row.slNo ?? '',
          qty:         num(row.qty),
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
  if (keys.includes('cust_id') && keys.includes('name'))      return 'customer';
  return null;
};

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
      const tables = { mc_master: [], sales_detail: [], customer: [], item: [] };
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

      // cust_id → name
      const custMap = new Map();
      tables.customer.forEach((row) => {
        const id = String(row.cust_id ?? '').trim();
        if (id) custMap.set(id, String(row.name ?? '').trim());
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

        const itemName = itemMap.get(itemId) ?? '';
        const saleType = itemName.trim().toLowerCase() === 'local sale' ? 'CASH' : 'CREDIT';

        merged.push({
          dcs_id:     row.dcs_id ?? '',
          mc_id:      mcId,
          slno:       row.slno ?? '',
          cust_id:    custId,
          cust_name:  custMap.get(custId) ?? '',
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

      setResult({
        rows: merged,
        stats: {
          mc_master:    tables.mc_master.length,
          customer:     tables.customer.length,
          item:         tables.item.length,
          sales_detail: tables.sales_detail.length,
          merged:       merged.length,
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
          <Text size="xs" c="dimmed">Join 4 Zibitt tables: Customer + MC Master + Item + Sales Detail</Text>
        </div>
      </Group>

      <Alert icon={<IconAlertCircle size={14} />} color="teal" variant="light" mb="md" p="xs">
        <Text size="xs">
          Upload all 4 Zibitt export files (customer, mc_master, item, sales_detail) — separately or in one Excel with multiple sheets.
          The tool auto-detects each table and joins them on mc_id / cust_id / item_id.
        </Text>
      </Alert>

      <FileListBox
        label="Customer + MC Master + Item + Sales Detail Files"
        color="teal"
        files={files}
        onAdd={addFiles}
        onRemove={removeFile}
      />

      {status === 'done' && result && (
        <Alert icon={<IconCircleCheck size={14} />} color="green" variant="light" mt="md" p="xs">
          <Stack gap={2}>
            <Text size="xs">MC Master rows: <strong>{result.stats.mc_master}</strong></Text>
            <Text size="xs">Customer rows: <strong>{result.stats.customer}</strong></Text>
            <Text size="xs">Item rows: <strong>{result.stats.item}</strong></Text>
            <Text size="xs">Sales Detail rows: <strong>{result.stats.sales_detail}</strong></Text>
            <Divider my={4} />
            <Text size="xs" fw={700} c="green">Merged output: {result.stats.merged} rows</Text>
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
      <MilkPurchaseSection />
      <MilkSalesSection />
    </Stack>
  </Box>
);

export default OpenLyssaMergeTool;
