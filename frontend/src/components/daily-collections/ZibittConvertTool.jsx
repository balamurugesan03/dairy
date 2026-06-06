import { useState, useRef } from 'react';
import {
  Modal, Button, Text, Group, Box, Stack, Badge, Alert,
  Progress, ThemeIcon, Paper
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload, IconFileSpreadsheet, IconDownload,
  IconCheck, IconAlertCircle, IconArrowRight
} from '@tabler/icons-react';

const ZibittConvertTool = ({ opened, onClose }) => {
  const [supplierFile,    setSupplierFile]    = useState(null);
  const [collectionFile,  setCollectionFile]  = useState(null);
  const [converting,      setConverting]      = useState(false);
  const [result,          setResult]          = useState(null);
  const supplierFileRef   = useRef(null);
  const collectionFileRef = useRef(null);

  const reset = () => {
    setSupplierFile(null);
    setCollectionFile(null);
    setResult(null);
    if (supplierFileRef.current)   supplierFileRef.current.value   = '';
    if (collectionFileRef.current) collectionFileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const parseFile = async (file) => {
    const XLSX = await import('xlsx');
    const ab   = await file.arrayBuffer();
    const wb   = XLSX.read(ab, { type: 'array', cellDates: false, sheetStubs: false, defval: '' });
    let rows   = [];
    for (const name of wb.SheetNames) {
      rows = rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }));
    }
    return rows.filter(r => Object.values(r).some(v => v !== '' && v !== null));
  };

  const handleConvert = async () => {
    if (!supplierFile || !collectionFile) {
      notifications.show({ color: 'orange', message: 'Please attach both Supplier and Daily Collection files' });
      return;
    }
    setConverting(true);
    setResult(null);
    try {
      // 1. Parse supplier file → Map: Supplier_Id → Supplier_No
      const supplierRows = await parseFile(supplierFile);
      const supplierMap  = {};
      for (const row of supplierRows) {
        const id  = String(row.Supplier_Id  ?? row.supplier_id  ?? row.SupplierID  ?? row.SUPPLIER_ID  ?? '').trim();
        const no  = String(row.Supplier_No  ?? row.supplier_no  ?? row.SupplierNo  ?? row.SUPPLIER_NO  ?? '').trim();
        if (id && no) supplierMap[id] = no;
      }

      // 2. Parse daily collection file
      const collectionRows = await parseFile(collectionFile);

      let matched = 0, unmatched = 0;
      const converted = collectionRows.map(row => {
        const rawId = String(
          row.Supplier_ID ?? row.supplier_id ?? row.SupplierID ?? row.SUPPLIER_ID ?? ''
        ).trim();
        const mappedNo = supplierMap[rawId];
        if (mappedNo) { matched++; } else { unmatched++; }
        return { ...row, Supplier_ID: mappedNo || rawId };
      });

      // 3. Export as XLSX
      const XLSX = await import('xlsx');
      const ws   = XLSX.utils.json_to_sheet(converted);
      const wb2  = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws, 'DailyCollection');
      XLSX.writeFile(wb2, 'ZibittConverted_DailyCollection.xlsx');

      setResult({ matched, unmatched, total: collectionRows.length, supplierCount: Object.keys(supplierMap).length });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Conversion Failed', message: err?.message || 'Error' });
    } finally {
      setConverting(false);
    }
  };

  const FilePicker = ({ label, file, inputRef, onChange, color }) => (
    <Paper withBorder p="md" radius="md" style={{ borderColor: file ? color : '#e2e8f0' }}>
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <ThemeIcon color={file ? 'teal' : 'gray'} variant="light" radius="md" size={36}>
            <IconFileSpreadsheet size={18} />
          </ThemeIcon>
          <Box>
            <Text size="13px" fw={700} c={file ? '#0f766e' : '#374151'}>{label}</Text>
            <Text size="11px" c="dimmed">{file ? file.name : 'CSV or XLSX'}</Text>
          </Box>
        </Group>
        {file
          ? <Badge color="teal" variant="light" leftSection={<IconCheck size={10} />}>Ready</Badge>
          : <Button size="xs" variant="light" color="blue" leftSection={<IconUpload size={12} />}
              onClick={() => inputRef.current?.click()}>
              Attach
            </Button>
        }
      </Group>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onChange} />
    </Paper>
  );

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <ThemeIcon color="violet" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }} size={32} radius="md">
            <IconFileSpreadsheet size={16} />
          </ThemeIcon>
          <Box>
            <Text size="14px" fw={800} c="#1e1b4b">Zibitt Convert Tool</Text>
            <Text size="11px" c="dimmed">Supplier_ID → Supplier_No converter</Text>
          </Box>
        </Group>
      }
      size="md"
      radius="lg"
    >
      <Stack gap="md">
        <Alert icon={<IconAlertCircle size={15} />} color="blue" variant="light" radius="md">
          <Text size="12px">
            Attach the <b>Supplier</b> file and <b>Daily Collection</b> file from Zibitt.
            The tool will replace each <code>Supplier_ID</code> with the matching <code>Supplier_No</code>
            and download the converted file.
          </Text>
        </Alert>

        <FilePicker
          label="1. Supplier File"
          file={supplierFile}
          inputRef={supplierFileRef}
          color="#0d9488"
          onChange={e => { const f = e.target.files?.[0]; if (f) setSupplierFile(f); setResult(null); }}
        />

        <Group justify="center">
          <ThemeIcon color="gray" variant="subtle" size={24}>
            <IconArrowRight size={14} />
          </ThemeIcon>
        </Group>

        <FilePicker
          label="2. Daily Collection File"
          file={collectionFile}
          inputRef={collectionFileRef}
          color="#2563eb"
          onChange={e => { const f = e.target.files?.[0]; if (f) setCollectionFile(f); setResult(null); }}
        />

        {result && (
          <Paper withBorder p="md" radius="md" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
            <Text size="13px" fw={700} c="#166534" mb={6}>Conversion Complete</Text>
            <Group gap="xs">
              <Badge color="teal"  variant="filled">{result.matched} matched</Badge>
              {result.unmatched > 0 && <Badge color="orange" variant="filled">{result.unmatched} unmatched (ID kept)</Badge>}
              <Badge color="blue"  variant="light">{result.total} total rows</Badge>
              <Badge color="gray"  variant="light">{result.supplierCount} suppliers loaded</Badge>
            </Group>
            <Text size="11px" c="#166534" mt={6}>File downloaded: <b>ZibittConverted_DailyCollection.xlsx</b></Text>
          </Paper>
        )}

        {converting && <Progress value={100} animated color="violet" radius="xl" size="sm" />}

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" color="gray" onClick={handleClose}>Close</Button>
          <Button
            leftSection={<IconDownload size={14} />}
            loading={converting}
            disabled={!supplierFile || !collectionFile}
            onClick={handleConvert}
            style={{ background: '#7c3aed' }}
          >
            Convert &amp; Download
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ZibittConvertTool;
