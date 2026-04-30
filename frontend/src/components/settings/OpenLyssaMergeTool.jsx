import { useState, useRef } from 'react';
import {
  Box, Paper, Title, Text, Group, Button, Stack, ActionIcon,
  Badge, Divider, Alert, List, ThemeIcon, Progress, SimpleGrid, Card
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload, IconTrash, IconDownload, IconRefresh,
  IconAlertCircle, IconCircleCheck, IconMilk, IconShoppingCart
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
  const m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
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
        const wb = XLSX.read(e.target.result, { type: 'binary' });
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

// Detect if a sheet's rows look like mc_proc_master or mc_proc_detail
const detectSheetType = (rows) => {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).map((k) => k.toLowerCase());
  if (keys.includes('mc_date') || keys.includes('mc_time') || keys.includes('shift_id')) return 'master';
  if (keys.includes('producer_id') || keys.includes('qty') || keys.includes('fat')) return 'detail';
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
  const [files, setFiles] = useState([]);        // all uploaded files (auto-detect master/detail)
  const [status, setStatus] = useState(null);    // null | 'processing' | 'done' | 'error'
  const [result, setResult] = useState(null);    // { rows, stats }

  const addFiles = (picked) => setFiles((prev) => [...prev, ...picked]);
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  const reset = () => { setFiles([]); setStatus(null); setResult(null); };

  const handleConvert = async () => {
    if (!files.length) {
      notifications.show({ title: 'No Files', message: 'Please select master and detail files', color: 'orange' });
      return;
    }
    setStatus('processing');
    setResult(null);

    try {
      const masterRows = [];
      const detailRows = [];

      for (const file of files) {
        const { sheets } = await readFileSheets(file);
        let foundMaster = false, foundDetail = false;

        for (const [sheetName, rows] of Object.entries(sheets)) {
          const type = detectSheetType(rows);
          if (type === 'master') { masterRows.push(...rows); foundMaster = true; }
          else if (type === 'detail') { detailRows.push(...rows); foundDetail = true; }
        }

        if (!foundMaster && !foundDetail) {
          notifications.show({
            title: `Unrecognised: ${file.name}`,
            message: 'Could not detect master or detail columns. Expected mc_date / producer_id columns.',
            color: 'red'
          });
        }
      }

      if (!masterRows.length || !detailRows.length) {
        setStatus('error');
        notifications.show({
          title: 'Missing Data',
          message: `Found ${masterRows.length} master rows and ${detailRows.length} detail rows. Both are required.`,
          color: 'red'
        });
        return;
      }

      // Build mc_id → { date, shift } from master
      const masterMap = new Map();
      masterRows.forEach((row) => {
        const mcId = String(row.mc_id ?? '').trim();
        if (!mcId || mcId === '0') return;
        const date = parseDate(row.mc_date);
        const t = String(row.mc_time ?? '').trim().toUpperCase();
        const shift = t === 'AM' ? 'AM' : t === 'PM' ? 'PM'
          : Number(row.shift_id) === 1 ? 'AM' : Number(row.shift_id) === 2 ? 'PM' : null;
        if (date && shift) masterMap.set(mcId, { date, shift });
      });

      // Join detail with master
      const merged = [];
      let skipped = 0;
      detailRows.forEach((row) => {
        const mcId = String(row.mc_id ?? '').trim();
        const session = masterMap.get(mcId);
        if (!session) { skipped++; return; }

        merged.push({
          Date:        fmtDate(session.date),
          Shift:       session.shift,
          mc_id:       mcId,
          producer_id: row.producer_id,
          slno:        row.slno ?? row.sl_no ?? '',
          qty:         num(row.qty),
          fat:         num(row.fat),
          clr:         num(row.clr),
          snf:         num(row.snf),
          rate:        num(row.rate),
          amount:      num(row.amount),
          incentive:   num(row.incentive),
        });
      });

      setResult({
        rows: merged,
        stats: {
          masterRows: masterRows.length,
          detailRows: detailRows.length,
          merged: merged.length,
          skipped
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
    downloadExcel(result.rows, `milk_purchase_merged_${Date.now()}.xlsx`, 'Milk Purchase');
    notifications.show({ title: 'Downloaded', message: `${result.rows.length} rows exported`, color: 'green' });
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md">
        <ThemeIcon color="blue" variant="light" size="lg">
          <IconMilk size={20} />
        </ThemeIcon>
        <div>
          <Title order={4}>Milk Purchase</Title>
          <Text size="xs" c="dimmed">Merge mc_proc_master + mc_proc_detail files (multiple months)</Text>
        </div>
      </Group>

      <Alert icon={<IconAlertCircle size={14} />} color="blue" variant="light" mb="md" p="xs">
        <Text size="xs">
          Select Excel files containing <strong>mc_proc_master</strong> and <strong>mc_proc_detail</strong> sheets (or separate files).
          The tool auto-detects each sheet type and joins them on mc_id.
        </Text>
      </Alert>

      <FileListBox
        label="Master + Detail Files"
        color="blue"
        files={files}
        onAdd={addFiles}
        onRemove={removeFile}
      />

      {status === 'done' && result && (
        <Alert icon={<IconCircleCheck size={14} />} color="green" variant="light" mt="md" p="xs">
          <Text size="xs">
            Master rows: <strong>{result.stats.masterRows}</strong> &nbsp;|&nbsp;
            Detail rows: <strong>{result.stats.detailRows}</strong> &nbsp;|&nbsp;
            Merged: <strong>{result.stats.merged}</strong> &nbsp;|&nbsp;
            Skipped (no master): <strong>{result.stats.skipped}</strong>
          </Text>
        </Alert>
      )}

      <Group mt="md">
        <Button
          color="blue"
          leftSection={<IconRefresh size={16} />}
          onClick={handleConvert}
          loading={status === 'processing'}
          disabled={!files.length}
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
        {(files.length > 0 || result) && (
          <Button variant="subtle" color="gray" size="xs" onClick={reset}>
            Clear
          </Button>
        )}
      </Group>
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
          if (type) { tables[type].push(...rows); matched = true; }
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
