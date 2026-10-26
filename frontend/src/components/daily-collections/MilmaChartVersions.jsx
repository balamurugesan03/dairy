import { useRef, useState } from 'react';
import {
  Box, Group, Text, Badge, Button, Modal, Stack, Select, NumberInput, TextInput, ActionIcon, Tooltip, Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconPlus, IconUpload, IconTrash, IconInfoCircle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { milmaChartAPI } from '../../services/api';

const TEAL = '#0d9488';
const TEAL_LIGHT = '#ccfbf1';
const TEAL_BORDER = '#99f6e4';

/**
 * Machine Configuration → Milma Chart versions for the logged-in society.
 *   • Imported versions (uploaded by the super admin from the previous system) are
 *     read-only — never changed or deleted here.
 *   • The society adds its own versions: a copy of an existing version's rate table
 *     with a ₹/L adjustment and a new Effective From date, or an Excel upload in the
 *     same 2-sheet format (versions whose date already exists are skipped).
 *   • Only the society's own versions can be deleted.
 * The rate in force on a date is always the version with the latest Effective From ≤ that date.
 */
export default function MilmaChartVersions({ masters = [], onChanged }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const latest = [...masters].sort((a, b) => new Date(b.dateFrom) - new Date(a.dateFrom))[0];
  const [form, setForm] = useState({ dateFrom: null, copyFrom: '', rateAdjust: 0, remarks: '' });

  const openNew = () => {
    setForm({ dateFrom: null, copyFrom: latest ? String(latest.chartId) : '', rateAdjust: 0, remarks: '' });
    setOpen(true);
  };

  const handleCreate = async () => {
    if (!form.dateFrom) { notifications.show({ message: 'Effective From date is required', color: 'red' }); return; }
    setSaving(true);
    try {
      const res = await milmaChartAPI.createVersion({
        dateFrom: dayjs(form.dateFrom).format('YYYY-MM-DD'),
        copyFromChartId: form.copyFrom ? Number(form.copyFrom) : undefined,
        rateAdjust: Number(form.rateAdjust) || 0,
        remarks: form.remarks,
      });
      notifications.show({ title: 'Chart created', message: res?.message || 'New chart version saved', color: 'teal' });
      setOpen(false);
      onChanged?.();
    } catch (err) {
      notifications.show({ title: 'Not created', message: err.message || 'Failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await milmaChartAPI.uploadOwn(file);
      notifications.show({ title: 'Upload', message: res?.message || 'Uploaded', color: res?.created ? 'teal' : 'orange', autoClose: 8000 });
      onChanged?.();
    } catch (err) {
      notifications.show({ title: 'Upload failed', message: err.message || 'Failed', color: 'red' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = (m) => modals.openConfirmModal({
    title: 'Delete chart version',
    children: <Text size="sm">Delete chart {m.chartId} (effective {dayjs(m.dateFrom).format('DD-MM-YYYY')})? The previous version will apply again from that date.</Text>,
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        const res = await milmaChartAPI.deleteVersion(m.chartId);
        notifications.show({ message: res?.message || 'Deleted', color: 'teal' });
        onChanged?.();
      } catch (err) {
        notifications.show({ title: 'Not deleted', message: err.message || 'Failed', color: 'red' });
      }
    },
  });

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Group gap={6}>
          <Text size="sm" fw={700} c="teal.8">Milma Rate Chart Versions</Text>
          <Badge color="teal" variant="light" size="sm">
            {masters.length} version{masters.length !== 1 ? 's' : ''} loaded
          </Badge>
        </Group>
        <Group gap={6}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
          <Tooltip multiline w={300} label="Excel with 2 sheets: rate chart detail (chart_id, fat, clr, snf, rate) and chart master (chart_id, date_from, rate_snf, rate_fat …). Versions whose Effective From date already exists are skipped.">
            <Button size="xs" variant="light" color="teal" leftSection={<IconUpload size={14} />} loading={uploading} onClick={() => fileRef.current?.click()}>
              Upload Excel
            </Button>
          </Tooltip>
          <Tooltip label={latest ? 'Copy an existing version with a new date and rate change' : 'Upload a chart first — a new version is copied from an existing one'}>
            <Button size="xs" color="teal" leftSection={<IconPlus size={14} />} onClick={openNew} disabled={!latest}>
              New Version
            </Button>
          </Tooltip>
        </Group>
      </Group>

      {masters.length === 0 ? (
        <Text size="xs" c="dimmed">
          No Milma chart yet. Upload your chart Excel here, or ask the super admin to upload it from the Super Admin panel.
        </Text>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: TEAL_LIGHT }}>
                {['Chart ID', 'Effective From', 'SNF Rate', 'FAT Rate', 'SNF Low <', 'TS Low <', 'SNF High ≥', 'TS High ≥', 'Rows', 'Source', 'Remarks', ''].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: '#134e4a', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${TEAL_BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {masters.map((m, i) => {
                const own = m.source === 'Society';
                return (
                  <tr key={m._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fffd' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 700, color: TEAL }}>{m.chartId}</td>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{dayjs(m.dateFrom).format('DD-MM-YYYY')}</td>
                    <td style={{ padding: '4px 8px' }}>{m.rateSNF}</td>
                    <td style={{ padding: '4px 8px' }}>{m.rateFAT}</td>
                    <td style={{ padding: '4px 8px' }}>{m.subSNF}</td>
                    <td style={{ padding: '4px 8px' }}>{m.subTotalSolids}</td>
                    <td style={{ padding: '4px 8px' }}>{m.bestSNF}</td>
                    <td style={{ padding: '4px 8px' }}>{m.bestTotalSolids}</td>
                    <td style={{ padding: '4px 8px' }}>{m.rowCount?.toLocaleString()}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <Badge size="xs" variant="light" color={own ? 'teal' : 'gray'}>{own ? 'Society' : 'Imported'}</Badge>
                    </td>
                    <td style={{ padding: '4px 8px', color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.remarks || '—'}</td>
                    <td style={{ padding: '2px 8px' }}>
                      {own && (
                        <ActionIcon size="sm" color="red" variant="light" title="Delete this version" onClick={() => handleDelete(m)}>
                          <IconTrash size={13} />
                        </ActionIcon>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      )}

      <Modal opened={open} onClose={() => setOpen(false)} title={<Text fw={700}>New Milma Chart Version</Text>} centered>
        <Stack gap="sm">
          <Alert color="teal" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
            <Text size="xs">
              Copies the rate table of the chosen version into a new version. Every rate changes by the adjustment
              below. The chosen version (imported or your own) is not modified.
            </Text>
          </Alert>
          <DatePickerInput label="Effective From" withAsterisk valueFormat="DD/MM/YYYY" placeholder="Select date"
            value={form.dateFrom} onChange={(v) => setForm(p => ({ ...p, dateFrom: v ? new Date(v) : null }))} />
          <Select label="Copy rates from" allowDeselect={false}
            data={[...masters].sort((a, b) => new Date(b.dateFrom) - new Date(a.dateFrom)).map(m => ({
              value: String(m.chartId),
              label: `Chart ${m.chartId} — from ${dayjs(m.dateFrom).format('DD-MM-YYYY')} (${m.source === 'Society' ? 'Society' : 'Imported'})`,
            }))}
            value={form.copyFrom} onChange={(v) => setForm(p => ({ ...p, copyFrom: v || '' }))} />
          <NumberInput label="Rate adjustment (₹ / litre)" description="Added to every rate — use a negative value to reduce"
            decimalScale={2} step={0.5} value={form.rateAdjust} onChange={(v) => setForm(p => ({ ...p, rateAdjust: v }))} />
          <TextInput label="Remarks" placeholder="e.g. Milma revision Oct 2026" value={form.remarks}
            onChange={(e) => setForm(p => ({ ...p, remarks: e.currentTarget.value }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button color="teal" onClick={handleCreate} loading={saving}>Create Version</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
