/**
 * RateChartSettings.jsx
 * ─────────────────────────────────────────────────────────────────
 * Professional Rate Chart Settings page for Dairy ERP
 * Mantine v8 · Tabler Icons · Daily-Collections module
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Paper, Title, Text, Group, Stack, Button,
  NumberInput, Select, Table, Badge, Divider, ThemeIcon,
  ActionIcon, Tooltip, SegmentedControl, Center, ScrollArea,
  SimpleGrid, Alert, Loader
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconUpload, IconFileSpreadsheet, IconPlus, IconTrash, IconEdit,
  IconX, IconCheck, IconChartBar, IconCalculator, IconTable,
  IconStar, IconLayersIntersect, IconCurrencyRupee, IconCalendar,
  IconRefresh, IconChevronDown, IconFilter, IconSettings
} from '@tabler/icons-react';
import { rateChartAPI } from '../../services/api';
import dayjs from 'dayjs';

// ─── Shared card wrapper ──────────────────────────────────────────────────────
const SectionCard = ({ icon, title, color = 'blue', children }) => (
  <Paper
    radius="md"
    p="lg"
    shadow="sm"
    style={{
      border: '1px solid var(--mantine-color-gray-2)',
      background: 'var(--mantine-color-white)',
      overflow: 'visible'
    }}
  >
    <Group mb="md" gap="sm">
      <ThemeIcon variant="light" color={color} size={36} radius="md">
        {icon}
      </ThemeIcon>
      <Title order={5} c="dark.7" fw={700}>
        {title}
      </Title>
    </Group>
    <Divider mb="md" color="gray.1" />
    {children}
  </Paper>
);

// ─── Compact data table ───────────────────────────────────────────────────────
const DataGrid = ({ columns, rows, onEdit, onDelete, loading }) => {
  if (loading) return <Center py="xl"><Loader size="sm" /></Center>;
  if (!rows.length)
    return (
      <Center py="md">
        <Text size="sm" c="dimmed">No records found</Text>
      </Center>
    );
  return (
    <ScrollArea>
      <Table
        striped
        highlightOnHover
        withTableBorder
        withColumnBorders
        verticalSpacing="xs"
        fz="sm"
        styles={{ th: { background: 'var(--mantine-color-blue-0)', fontWeight: 700 } }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            {columns.map(c => <Table.Th key={c.key}>{c.label}</Table.Th>)}
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, i) => (
            <Table.Tr key={row._id || i}>
              <Table.Td>{i + 1}</Table.Td>
              {columns.map(c => (
                <Table.Td key={c.key}>
                  {c.key === 'fromDate'
                    ? dayjs(row[c.key]).format('DD-MM-YYYY')
                    : row[c.key] ?? '-'}
                </Table.Td>
              ))}
              <Table.Td>
                <Group gap={4}>
                  <Tooltip label="Edit" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="blue"
                      onClick={() => onEdit(row)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="red"
                      onClick={() => onDelete(row._id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const RateChartSettings = () => {
  // ── Upload state ────────────────────────────────────────────────────────────
  const [uploadFile,    setUploadFile]    = useState(null);
  const [uploadDate,    setUploadDate]    = useState(null);
  const [uploading,     setUploading]     = useState(false);

  // ── Manual Entry state ──────────────────────────────────────────────────────
  const [manualRows,    setManualRows]    = useState([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [editingManual, setEditingManual] = useState(null);

  // ── Formula state ───────────────────────────────────────────────────────────
  const [formulaRows,    setFormulaRows]    = useState([]);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [editingFormula, setEditingFormula] = useState(null);
  const [calcResult,     setCalcResult]     = useState(null);

  // ── Low Chart state ─────────────────────────────────────────────────────────
  const [lowRows,      setLowRows]      = useState([]);
  const [lowLoading,   setLowLoading]   = useState(false);
  const [editingLow,   setEditingLow]   = useState(null);

  // ── Gold/Less state ─────────────────────────────────────────────────────────
  const [glRows,     setGlRows]     = useState([]);
  const [glLoading,  setGlLoading]  = useState(false);
  const [editingGl,  setEditingGl]  = useState(null);

  // ── Slab Rate state ─────────────────────────────────────────────────────────
  const [slabRows,   setSlabRows]   = useState([]);
  const [slabLoading,setSlabLoading]= useState(false);
  const [editingSlab,setEditingSlab]= useState(null);

  // ── Forms ────────────────────────────────────────────────────────────────────
  const manualForm = useForm({
    initialValues: { fromDate: null, clr: '', fat: '', snf: '', rate: '' },
    validate: {
      fromDate: v => !v ? 'From Date is required' : null,
      rate:     v => (v === '' || v === null) ? 'Rate is required' : null
    }
  });

  const formulaForm = useForm({
    initialValues: {
      fromDate: null, minFAT: '', maxFAT: '',
      minSNF: '', maxSNF: '', fatRate: '', snfRate: ''
    },
    validate: {
      fromDate: v => !v ? 'From Date is required' : null,
      fatRate:  v => (v === '' || v === null) ? 'Fat Rate is required' : null,
      snfRate:  v => (v === '' || v === null) ? 'SNF Rate is required' : null
    }
  });

  const lowForm = useForm({
    initialValues: { fromDate: null, clr: '', fat: '', snf: '', rate: '' },
    validate: {
      fromDate: v => !v ? 'From Date is required' : null,
      rate:     v => (v === '' || v === null) ? 'Rate is required' : null
    }
  });

  const glForm = useForm({
    initialValues: {
      chartType: 'Low Chart', value: '', fromDate: null, toggle: '100'
    },
    validate: {
      fromDate: v => !v ? 'From Date is required' : null,
      value:    v => (v === '' || v === null) ? 'Value is required' : null
    }
  });

  const slabForm = useForm({
    initialValues: { slabRate: '', fromDate: null },
    validate: {
      fromDate: v => !v ? 'From Date is required' : null,
      slabRate: v => (v === '' || v === null) ? 'Slab Rate is required' : null
    }
  });

  // ── Formula live calculation ─────────────────────────────────────────────────
  const { fatRate, snfRate } = formulaForm.values;
  const A = fatRate  ? ((28.5 / 100) * 11.5 * Number(fatRate)).toFixed(4)  : null;
  const B = snfRate  ? ((8.7  / 100) * 11.0 * Number(snfRate)).toFixed(4)  : null;
  const formulaResult = (A && B) ? (Number(A) + Number(B)).toFixed(4) : null;

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadManual = useCallback(async () => {
    setManualLoading(true);
    try {
      const res = await rateChartAPI.getManualEntries();
      setManualRows(res.data || []);
    } catch { /* silent */ }
    finally { setManualLoading(false); }
  }, []);

  const loadLow = useCallback(async () => {
    setLowLoading(true);
    try {
      const res = await rateChartAPI.getLowCharts();
      setLowRows(res.data || []);
    } catch { /* silent */ }
    finally { setLowLoading(false); }
  }, []);

  const loadGl = useCallback(async () => {
    setGlLoading(true);
    try {
      const res = await rateChartAPI.getGoldLessCharts();
      setGlRows(res.data || []);
    } catch { /* silent */ }
    finally { setGlLoading(false); }
  }, []);

  const loadFormulas = useCallback(async () => {
    setFormulaLoading(true);
    try {
      const res = await rateChartAPI.getFormulas();
      setFormulaRows(res.data || []);
    } catch { /* silent */ }
    finally { setFormulaLoading(false); }
  }, []);

  const loadSlab = useCallback(async () => {
    setSlabLoading(true);
    try {
      const res = await rateChartAPI.getSlabRates();
      setSlabRows(res.data || []);
    } catch { /* silent */ }
    finally { setSlabLoading(false); }
  }, []);

  useEffect(() => {
    loadManual();
    loadFormulas();
    loadLow();
    loadGl();
    loadSlab();
  }, [loadManual, loadFormulas, loadLow, loadGl, loadSlab]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const notify = (msg, color = 'green') =>
    notifications.show({
      message: msg,
      color,
      icon: color === 'green' ? <IconCheck size={16} /> : <IconX size={16} />
    });

  // ── Upload handler ────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile) { notify('Please select a file', 'red'); return; }
    if (!uploadDate) { notify('Please select From Date', 'red'); return; }
    setUploading(true);
    // Simulate upload (replace with actual multipart API call)
    await new Promise(r => setTimeout(r, 1500));
    setUploading(false);
    notify('Rate chart uploaded successfully');
    setUploadFile(null);
    setUploadDate(null);
  };

  const handleRemoveUpload = () => {
    setUploadFile(null);
    setUploadDate(null);
  };

  // ── Manual Entry CRUD ─────────────────────────────────────────────────────────
  const handleManualSave = async () => {
    const { hasErrors } = manualForm.validate();
    if (hasErrors) return;
    const payload = { ...manualForm.values, fromDate: manualForm.values.fromDate };
    try {
      if (editingManual) {
        await rateChartAPI.updateManualEntry(editingManual._id, payload);
        notify('Entry updated');
        setEditingManual(null);
      } else {
        await rateChartAPI.createManualEntry(payload);
        notify('Entry saved');
      }
      manualForm.reset();
      loadManual();
    } catch (e) { notify(e.message || 'Error saving entry', 'red'); }
  };

  const handleManualEdit = (row) => {
    setEditingManual(row);
    manualForm.setValues({
      fromDate: new Date(row.fromDate),
      clr: row.clr, fat: row.fat, snf: row.snf, rate: row.rate
    });
  };

  const handleManualDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await rateChartAPI.deleteManualEntry(id);
      notify('Deleted');
      loadManual();
    } catch (e) { notify(e.message || 'Error deleting', 'red'); }
  };

  // ── Formula CRUD ──────────────────────────────────────────────────────────────
  const handleFormulaSave = async () => {
    const { hasErrors } = formulaForm.validate();
    if (hasErrors) return;
    try {
      if (editingFormula) {
        await rateChartAPI.updateFormula(editingFormula._id, formulaForm.values);
        notify('Formula updated');
        setEditingFormula(null);
      } else {
        await rateChartAPI.createFormula(formulaForm.values);
        notify('Formula saved');
      }
      formulaForm.reset();
      setCalcResult(null);
      loadFormulas();
    } catch (e) { notify(e.message || 'Error saving formula', 'red'); }
  };

  const handleFormulaEdit = (row) => {
    setEditingFormula(row);
    formulaForm.setValues({
      fromDate: new Date(row.fromDate),
      minFAT: row.minFAT, maxFAT: row.maxFAT,
      minSNF: row.minSNF, maxSNF: row.maxSNF,
      fatRate: row.fatRate, snfRate: row.snfRate
    });
  };

  const handleFormulaDelete = async (id) => {
    if (!window.confirm('Delete this formula?')) return;
    try {
      await rateChartAPI.deleteFormula(id);
      notify('Deleted');
      loadFormulas();
    } catch (e) { notify(e.message || 'Error deleting', 'red'); }
  };

  // ── Low Chart CRUD ────────────────────────────────────────────────────────────
  const handleLowSave = async () => {
    const { hasErrors } = lowForm.validate();
    if (hasErrors) return;
    const payload = { ...lowForm.values };
    try {
      if (editingLow) {
        await rateChartAPI.updateLowChart(editingLow._id, payload);
        notify('Updated');
        setEditingLow(null);
      } else {
        await rateChartAPI.createLowChart(payload);
        notify('Saved');
      }
      lowForm.reset();
      loadLow();
    } catch (e) { notify(e.message || 'Error', 'red'); }
  };

  const handleLowEdit = (row) => {
    setEditingLow(row);
    lowForm.setValues({ fromDate: new Date(row.fromDate), clr: row.clr, fat: row.fat, snf: row.snf, rate: row.rate });
  };

  const handleLowDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await rateChartAPI.deleteLowChart(id); notify('Deleted'); loadLow(); }
    catch (e) { notify(e.message || 'Error', 'red'); }
  };

  // ── Gold/Less CRUD ────────────────────────────────────────────────────────────
  const handleGlSave = async () => {
    const { hasErrors } = glForm.validate();
    if (hasErrors) return;
    try {
      if (editingGl) {
        await rateChartAPI.updateGoldLessChart(editingGl._id, glForm.values);
        notify('Updated'); setEditingGl(null);
      } else {
        await rateChartAPI.createGoldLessChart(glForm.values);
        notify('Saved');
      }
      glForm.reset();
      loadGl();
    } catch (e) { notify(e.message || 'Error', 'red'); }
  };

  const handleGlEdit = (row) => {
    setEditingGl(row);
    glForm.setValues({ chartType: row.chartType, value: row.value, fromDate: new Date(row.fromDate), toggle: row.toggle });
  };

  const handleGlDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await rateChartAPI.deleteGoldLessChart(id); notify('Deleted'); loadGl(); }
    catch (e) { notify(e.message || 'Error', 'red'); }
  };

  // ── Slab Rate CRUD ────────────────────────────────────────────────────────────
  const handleSlabSave = async () => {
    const { hasErrors } = slabForm.validate();
    if (hasErrors) return;
    try {
      if (editingSlab) {
        await rateChartAPI.updateSlabRate(editingSlab._id, slabForm.values);
        notify('Updated'); setEditingSlab(null);
      } else {
        await rateChartAPI.createSlabRate(slabForm.values);
        notify('Saved');
      }
      slabForm.reset();
      loadSlab();
    } catch (e) { notify(e.message || 'Error', 'red'); }
  };

  const handleSlabEdit = (row) => {
    setEditingSlab(row);
    slabForm.setValues({ slabRate: row.slabRate, fromDate: new Date(row.fromDate) });
  };

  const handleSlabDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await rateChartAPI.deleteSlabRate(id); notify('Deleted'); loadSlab(); }
    catch (e) { notify(e.message || 'Error', 'red'); }
  };

  // ── Shared input style helper ─────────────────────────────────────────────────
  const inputSx = { flex: 1, minWidth: 110 };

  // ────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <Box
      p="md"
      style={{ minHeight: '100vh', background: 'var(--mantine-color-gray-0)' }}
    >
      {/* ── Page Header ── */}
      <Paper
        radius="md"
        p="md"
        mb="lg"
        style={{
          background: 'linear-gradient(135deg, #1971c2 0%, #0c8599 100%)',
          boxShadow: '0 4px 16px rgba(25,113,194,0.18)'
        }}
      >
        <Group justify="space-between">
          <Group gap="sm">
            <ThemeIcon color="white" variant="transparent" size={40}>
              <IconSettings size={28} />
            </ThemeIcon>
            <Box>
              <Title order={4} c="white" fw={700}>Rate Chart Settings</Title>
              <Text size="xs" c="blue.1">
                Configure milk purchase rate charts for daily collections
              </Text>
            </Box>
          </Group>
          <Badge color="blue.1" variant="light" size="lg" radius="md">
            Daily Collections
          </Badge>
        </Group>
      </Paper>

      <Stack gap="lg">

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1 ─ Upload Rate Chart Table
        ══════════════════════════════════════════════════════════════════ */}
        <SectionCard
          icon={<IconUpload size={20} />}
          title="Upload Rate Chart Table"
          color="blue"
        >
          <Grid gutter="md" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <DatePickerInput
                label="From Date"
                placeholder="Select date"
                leftSection={<IconCalendar size={16} />}
                value={uploadDate}
                onChange={setUploadDate}
                valueFormat="DD-MM-YYYY"
                radius="md"
                clearable
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 8 }}>
              {uploadFile ? (
                <Alert
                  icon={<IconFileSpreadsheet size={18} />}
                  color="teal"
                  radius="md"
                  title={uploadFile.name}
                  withCloseButton
                  onClose={() => setUploadFile(null)}
                >
                  <Text size="xs" c="dimmed">
                    {(uploadFile.size / 1024).toFixed(1)} KB · Ready to upload
                  </Text>
                </Alert>
              ) : (
                <Dropzone
                  onDrop={files => setUploadFile(files[0])}
                  accept={['application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/csv']}
                  maxSize={5 * 1024 * 1024}
                  radius="md"
                  styles={{
                    root: {
                      border: '2px dashed var(--mantine-color-blue-3)',
                      borderRadius: 'var(--mantine-radius-md)',
                      background: 'var(--mantine-color-blue-0)',
                      cursor: 'pointer'
                    }
                  }}
                >
                  <Group justify="center" gap="sm" py="sm">
                    <Dropzone.Accept>
                      <IconCheck size={28} color="var(--mantine-color-teal-6)" />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                      <IconX size={28} color="var(--mantine-color-red-6)" />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                      <IconFileSpreadsheet size={28} color="var(--mantine-color-blue-5)" />
                    </Dropzone.Idle>
                    <Box>
                      <Text size="sm" fw={600} c="blue.7">
                        Drag & drop or click to select
                      </Text>
                      <Text size="xs" c="dimmed">
                        Excel (.xlsx, .xls) or CSV · Max 5 MB
                      </Text>
                    </Box>
                  </Group>
                </Dropzone>
              )}
            </Grid.Col>

            <Grid.Col span={12}>
              <Group gap="sm">
                <Button
                  leftSection={<IconUpload size={16} />}
                  color="blue"
                  radius="md"
                  loading={uploading}
                  onClick={handleUpload}
                >
                  Upload
                </Button>
                <Button
                  leftSection={<IconX size={16} />}
                  variant="outline"
                  color="red"
                  radius="md"
                  onClick={handleRemoveUpload}
                  disabled={!uploadFile && !uploadDate}
                >
                  Remove
                </Button>
              </Group>
            </Grid.Col>
          </Grid>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 ─ Manual Entry
        ══════════════════════════════════════════════════════════════════ */}
        <SectionCard
          icon={<IconTable size={20} />}
          title="Manual Entry"
          color="teal"
        >
          {editingManual && (
            <Alert color="blue" radius="md" mb="sm" icon={<IconEdit size={16} />}>
              Editing record — make changes below and click Save
            </Alert>
          )}

          <Grid gutter="sm" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="From Date"
                placeholder="DD-MM-YYYY"
                leftSection={<IconCalendar size={16} />}
                valueFormat="DD-MM-YYYY"
                radius="md"
                clearable
                {...manualForm.getInputProps('fromDate')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="CLR"
                placeholder="0.00"
                decimalScale={2}
                radius="md"
                {...manualForm.getInputProps('clr')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="FAT"
                placeholder="0.00"
                decimalScale={2}
                radius="md"
                {...manualForm.getInputProps('fat')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="SNF"
                placeholder="0.00"
                decimalScale={2}
                radius="md"
                {...manualForm.getInputProps('snf')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="Rate"
                placeholder="0.00"
                decimalScale={4}
                leftSection={<IconCurrencyRupee size={14} />}
                radius="md"
                {...manualForm.getInputProps('rate')}
              />
            </Grid.Col>
          </Grid>

          <Group mt="md" gap="sm">
            <Button
              leftSection={<IconCheck size={16} />}
              color="teal"
              radius="md"
              onClick={handleManualSave}
            >
              {editingManual ? 'Update' : 'Save'}
            </Button>
            {editingManual && (
              <Button
                variant="outline"
                color="gray"
                radius="md"
                leftSection={<IconX size={16} />}
                onClick={() => { setEditingManual(null); manualForm.reset(); }}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              color="red"
              radius="md"
              leftSection={<IconX size={16} />}
              onClick={() => { setEditingManual(null); manualForm.reset(); }}
            >
              Close
            </Button>
          </Group>

          <Box mt="lg">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dark.5">Rate Chart Records</Text>
              <ActionIcon variant="light" color="teal" onClick={loadManual}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
            <DataGrid
              columns={[
                { key: 'fromDate', label: 'From Date' },
                { key: 'clr',     label: 'CLR' },
                { key: 'fat',     label: 'FAT' },
                { key: 'snf',     label: 'SNF' },
                { key: 'rate',    label: 'Rate' }
              ]}
              rows={manualRows}
              onEdit={handleManualEdit}
              onDelete={handleManualDelete}
              loading={manualLoading}
            />
          </Box>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 ─ Apply Formula
        ══════════════════════════════════════════════════════════════════ */}
        <SectionCard
          icon={<IconCalculator size={20} />}
          title="Apply Formula"
          color="violet"
        >
          {editingFormula && (
            <Alert color="violet" radius="md" mb="sm" icon={<IconEdit size={16} />}>
              Editing formula record — make changes below and click Save
            </Alert>
          )}

          <Grid gutter="sm" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="From Date"
                placeholder="DD-MM-YYYY"
                leftSection={<IconCalendar size={16} />}
                valueFormat="DD-MM-YYYY"
                radius="md"
                clearable
                {...formulaForm.getInputProps('fromDate')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="Min FAT"
                placeholder="0.00"
                decimalScale={2}
                radius="md"
                {...formulaForm.getInputProps('minFAT')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="Max FAT"
                placeholder="0.00"
                decimalScale={2}
                radius="md"
                {...formulaForm.getInputProps('maxFAT')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="Min SNF"
                placeholder="0.00"
                decimalScale={2}
                radius="md"
                {...formulaForm.getInputProps('minSNF')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="Max SNF"
                placeholder="0.00"
                decimalScale={2}
                radius="md"
                {...formulaForm.getInputProps('maxSNF')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="Fat Rate"
                placeholder="0.00"
                decimalScale={4}
                leftSection={<IconCurrencyRupee size={14} />}
                radius="md"
                {...formulaForm.getInputProps('fatRate')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="SNF Rate"
                placeholder="0.00"
                decimalScale={4}
                leftSection={<IconCurrencyRupee size={14} />}
                radius="md"
                {...formulaForm.getInputProps('snfRate')}
              />
            </Grid.Col>
          </Grid>

          {/* Formula Preview Box */}
          <Paper
            radius="md"
            p="md"
            mt="lg"
            style={{
              background: 'linear-gradient(135deg, #f3f0ff 0%, #e8f4fd 100%)',
              border: '1px solid var(--mantine-color-violet-2)'
            }}
          >
            <Group gap="sm" mb="sm">
              <ThemeIcon color="violet" variant="light" size={28} radius="sm">
                <IconCalculator size={16} />
              </ThemeIcon>
              <Text size="sm" fw={700} c="violet.8">Formula Preview</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Box>
                <Text size="xs" c="dimmed" mb={2}>A (Fat Component)</Text>
                <Paper p="xs" radius="sm" style={{ background: 'white', border: '1px solid var(--mantine-color-violet-2)' }}>
                  <Text size="xs" c="dark.5" style={{ fontFamily: 'monospace' }}>
                    A = Fat/100 × 11.5 × Fat Rate
                  </Text>
                  {A && (
                    <Text size="sm" fw={700} c="violet.7" mt={2}>= {A}</Text>
                  )}
                </Paper>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" mb={2}>B (SNF Component)</Text>
                <Paper p="xs" radius="sm" style={{ background: 'white', border: '1px solid var(--mantine-color-violet-2)' }}>
                  <Text size="xs" c="dark.5" style={{ fontFamily: 'monospace' }}>
                    B = SNF/100 × 11.0 × SNF Rate
                  </Text>
                  {B && (
                    <Text size="sm" fw={700} c="violet.7" mt={2}>= {B}</Text>
                  )}
                </Paper>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" mb={2}>Result</Text>
                <Paper
                  p="xs"
                  radius="sm"
                  style={{
                    background: formulaResult
                      ? 'linear-gradient(135deg, #7950f2, #4dabf7)'
                      : 'white',
                    border: '1px solid var(--mantine-color-violet-3)'
                  }}
                >
                  <Text size="xs" c={formulaResult ? 'white' : 'dark.5'} style={{ fontFamily: 'monospace' }}>
                    Result = A + B
                  </Text>
                  {formulaResult ? (
                    <Text size="lg" fw={900} c="white" mt={2}>
                      ₹ {formulaResult}
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">Enter Fat Rate &amp; SNF Rate</Text>
                  )}
                </Paper>
              </Box>
            </SimpleGrid>
          </Paper>

          <Group mt="md" gap="sm">
            <Button
              leftSection={<IconCheck size={16} />}
              color="violet"
              radius="md"
              onClick={handleFormulaSave}
              loading={formulaLoading}
            >
              {editingFormula ? 'Update Formula' : 'Save Formula'}
            </Button>
            {editingFormula && (
              <Button
                variant="outline"
                color="gray"
                radius="md"
                leftSection={<IconX size={16} />}
                onClick={() => { setEditingFormula(null); formulaForm.reset(); setCalcResult(null); }}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              color="gray"
              radius="md"
              leftSection={<IconX size={16} />}
              onClick={() => { setEditingFormula(null); formulaForm.reset(); setCalcResult(null); }}
            >
              Close
            </Button>
          </Group>

          <Box mt="lg">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dark.5">Saved Formulas</Text>
              <ActionIcon variant="light" color="violet" onClick={loadFormulas}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
            <DataGrid
              columns={[
                { key: 'fromDate', label: 'From Date' },
                { key: 'minFAT',  label: 'Min FAT' },
                { key: 'maxFAT',  label: 'Max FAT' },
                { key: 'minSNF',  label: 'Min SNF' },
                { key: 'maxSNF',  label: 'Max SNF' },
                { key: 'fatRate', label: 'Fat Rate' },
                { key: 'snfRate', label: 'SNF Rate' }
              ]}
              rows={formulaRows}
              onEdit={handleFormulaEdit}
              onDelete={handleFormulaDelete}
              loading={formulaLoading}
            />
          </Box>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4 ─ Low Chart
        ══════════════════════════════════════════════════════════════════ */}
        <SectionCard
          icon={<IconChartBar size={20} />}
          title="Low Chart"
          color="orange"
        >
          {editingLow && (
            <Alert color="orange" radius="md" mb="sm" icon={<IconEdit size={16} />}>
              Editing Low Chart record
            </Alert>
          )}

          <Grid gutter="sm" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="From Date"
                placeholder="DD-MM-YYYY"
                leftSection={<IconCalendar size={16} />}
                valueFormat="DD-MM-YYYY"
                radius="md"
                clearable
                {...lowForm.getInputProps('fromDate')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput label="CLR" placeholder="0.00" decimalScale={2} radius="md"
                {...lowForm.getInputProps('clr')} />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput label="FAT" placeholder="0.00" decimalScale={2} radius="md"
                {...lowForm.getInputProps('fat')} />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput label="SNF" placeholder="0.00" decimalScale={2} radius="md"
                {...lowForm.getInputProps('snf')} />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="Rate"
                placeholder="0.00"
                decimalScale={4}
                leftSection={<IconCurrencyRupee size={14} />}
                radius="md"
                {...lowForm.getInputProps('rate')}
              />
            </Grid.Col>
          </Grid>

          <Group mt="md" gap="sm">
            <Button leftSection={<IconCheck size={16} />} color="orange" radius="md" onClick={handleLowSave}>
              {editingLow ? 'Update' : 'Save'}
            </Button>
            {editingLow && (
              <Button variant="outline" color="gray" radius="md" leftSection={<IconX size={16} />}
                onClick={() => { setEditingLow(null); lowForm.reset(); }}>
                Cancel
              </Button>
            )}
            <Button variant="outline" color="red" radius="md" leftSection={<IconX size={16} />}
              onClick={() => { setEditingLow(null); lowForm.reset(); }}>
              Close
            </Button>
          </Group>

          <Box mt="lg">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dark.5">Low Chart Records</Text>
              <ActionIcon variant="light" color="orange" onClick={loadLow}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
            <DataGrid
              columns={[
                { key: 'fromDate', label: 'From Date' },
                { key: 'clr',     label: 'CLR' },
                { key: 'fat',     label: 'FAT' },
                { key: 'snf',     label: 'SNF' },
                { key: 'rate',    label: 'Rate' }
              ]}
              rows={lowRows}
              onEdit={handleLowEdit}
              onDelete={handleLowDelete}
              loading={lowLoading}
            />
          </Box>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5 ─ Gold / Less / Existing Rate Chart
        ══════════════════════════════════════════════════════════════════ */}
        <SectionCard
          icon={<IconStar size={20} />}
          title="Gold / Less / Existing Rate Chart"
          color="yellow"
        >
          {editingGl && (
            <Alert color="yellow" radius="md" mb="sm" icon={<IconEdit size={16} />}>
              Editing record
            </Alert>
          )}

          <Grid gutter="sm" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                label="Chart Type"
                placeholder="Select chart"
                data={["Milma chart", "Low Chart", "KG Chart", "SNF Chart"]}
                radius="md"
                leftSection={<IconChevronDown size={14} />}
                {...glForm.getInputProps('chartType')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <NumberInput
                label="Value"
                placeholder="0.00"
                decimalScale={4}
                leftSection={<IconCurrencyRupee size={14} />}
                radius="md"
                {...glForm.getInputProps('value')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="From Date"
                placeholder="DD-MM-YYYY"
                leftSection={<IconCalendar size={16} />}
                valueFormat="DD-MM-YYYY"
                radius="md"
                clearable
                {...glForm.getInputProps('fromDate')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Box>
                <Text size="xs" fw={500} c="dark.5" mb={6}>Toggle</Text>
                <SegmentedControl
                  data={[
                    { label: 'Add', value: 'add' },
                    { label: 'Less', value: 'Less' }
                  ]}
                  color="yellow"
                  radius="md"
                  {...glForm.getInputProps('toggle')}
                />
              </Box>
            </Grid.Col>
          </Grid>

          <Group mt="md" gap="sm">
            <Button leftSection={<IconCheck size={16} />} color="yellow" radius="md" onClick={handleGlSave}>
              {editingGl ? 'Update' : 'Save'}
            </Button>
            {editingGl && (
              <Button variant="outline" color="gray" radius="md" leftSection={<IconX size={16} />}
                onClick={() => { setEditingGl(null); glForm.reset(); }}>
                Cancel
              </Button>
            )}
            <Button variant="outline" color="gray" radius="md" leftSection={<IconX size={16} />}
              onClick={() => { setEditingGl(null); glForm.reset(); }}>
              Close
            </Button>
          </Group>

          <Box mt="lg">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dark.5">Rate Chart Records</Text>
              <ActionIcon variant="light" color="yellow" onClick={loadGl}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
            <DataGrid
              columns={[
                { key: 'fromDate',  label: 'From Date' },
                { key: 'chartType', label: 'Chart Type' },
                { key: 'value',     label: 'Value' },
                { key: 'toggle',    label: 'Toggle' }
              ]}
              rows={glRows}
              onEdit={handleGlEdit}
              onDelete={handleGlDelete}
              loading={glLoading}
            />
          </Box>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6 ─ Slab Rate
        ══════════════════════════════════════════════════════════════════ */}
        <SectionCard
          icon={<IconLayersIntersect size={20} />}
          title="Slab Rate"
          color="green"
        >
          {editingSlab && (
            <Alert color="green" radius="md" mb="sm" icon={<IconEdit size={16} />}>
              Editing Slab Rate
            </Alert>
          )}

          <Grid gutter="sm" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
              <NumberInput
                label="Slab Rate"
                placeholder="0.0000"
                decimalScale={4}
                leftSection={<IconCurrencyRupee size={14} />}
                radius="md"
                {...slabForm.getInputProps('slabRate')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
              <DatePickerInput
                label="From Date"
                placeholder="DD-MM-YYYY"
                leftSection={<IconCalendar size={16} />}
                valueFormat="DD-MM-YYYY"
                radius="md"
                clearable
                {...slabForm.getInputProps('fromDate')}
              />
            </Grid.Col>
          </Grid>

          <Group mt="md" gap="sm">
            <Button leftSection={<IconCheck size={16} />} color="green" radius="md" onClick={handleSlabSave}>
              {editingSlab ? 'Update' : 'Save'}
            </Button>
            {editingSlab && (
              <Button variant="outline" color="gray" radius="md" leftSection={<IconX size={16} />}
                onClick={() => { setEditingSlab(null); slabForm.reset(); }}>
                Cancel
              </Button>
            )}
            <Button variant="outline" color="gray" radius="md" leftSection={<IconX size={16} />}
              onClick={() => { setEditingSlab(null); slabForm.reset(); }}>
              Close
            </Button>
          </Group>

          <Box mt="lg">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dark.5">Slab Rate Records</Text>
              <ActionIcon variant="light" color="green" onClick={loadSlab}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
            <DataGrid
              columns={[
                { key: 'fromDate', label: 'From Date' },
                { key: 'slabRate', label: 'Slab Rate' }
              ]}
              rows={slabRows}
              onEdit={handleSlabEdit}
              onDelete={handleSlabDelete}
              loading={slabLoading}
            />
          </Box>
        </SectionCard>

      </Stack>
    </Box>
  );
};

export default RateChartSettings;
