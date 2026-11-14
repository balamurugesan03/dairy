/**
 * Farmer Applications — Panchayat milk subsidy / incentive application forms,
 * Year- and Panchayat-wise. Each row prints the form + the farmer's uploaded
 * documents; "Print all" prints every application in the current filter.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Group, Text, Title, TextInput, Select, Badge, Table, ActionIcon, Tooltip,
  Modal, Loader, Center, Paper, Pagination, Stack, Checkbox
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconPrinter, IconFiles } from '@tabler/icons-react';
import { farmerApplicationAPI } from '../../services/api';
import FarmerApplicationForm from './FarmerApplicationForm';
import FarmerApplicationPreview from './FarmerApplicationPreview';
import { PanchayatInput, useFarmerFormData } from './FarmerReportSelectors';
import { FORM_TYPES, fyLabel, printApplications, SCHEME_YEAR_OPTIONS, currentSchemeYear } from '../../utils/farmerApplicationPrint';
import { panchayatAliases } from '../../utils/keralaPanchayat';

const STATUS_COLORS = { Draft: 'gray', Submitted: 'blue', Approved: 'green' };
const LIMIT = 15;

/** One LSGD report: formType 'SUBSIDY' (People's Planning Milk Subsidy) or 'INCENTIVE' (Annual Plan Milk Incentive). */
export default function FarmerApplicationList({ formType = 'SUBSIDY' }) {
  const report = FORM_TYPES.find(t => t.value === formType) || FORM_TYPES[0];
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(String(currentSchemeYear()));
  const [panchayat, setPanchayat] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const { panchayats } = useFarmerFormData();

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editId, setEditId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [withDocs, setWithDocs] = useState(true);

  // Panchayat matches loosely on the server; the Malayalam / English alias goes along
  const filters = { year, panchayat: panchayat.trim(), aliases: panchayatAliases(panchayat).join(','), formType, status, search };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await farmerApplicationAPI.getAll({ ...filters, page, limit: LIMIT });
      setRows(res?.data?.applications || []);
      setTotal(res?.data?.total || 0);
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Could not load applications' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, panchayat, formType, status, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openForm = (id) => { setEditId(id); setFormKey(k => k + 1); setFormOpen(true); };

  const printOne = async (a) => {
    setPrintingId(a._id);
    try {
      const r = await printApplications([a]);
      if (!r.ok) notifications.show({ color: 'red', message: r.message });
      else if (r.failed.length) notifications.show({ color: 'orange', message: `Could not load: ${r.failed.join(', ')}` });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Printing failed' });
    } finally {
      setPrintingId(null);
    }
  };

  // Panchayat-wise: every application in the current filter, one print
  const printAll = async () => {
    if (!total) return;
    if (total > 200) {
      notifications.show({ color: 'orange', message: `${total} applications — narrow the filter (Panchayat / form) to 200 or fewer` });
      return;
    }
    setBulkPrinting(true);
    try {
      // The print window opens inside the click; the list is fetched after
      const fetchAll = async () => (await farmerApplicationAPI.getAll({ ...filters, page: 1, limit: 200 }))?.data?.applications || [];
      const r = await printApplications(fetchAll, {
        withDocuments: withDocs,
        title: `${report.short} ${fyLabel(year)}${panchayat ? ` - ${panchayat}` : ''}`,
      });
      if (!r.ok) notifications.show({ color: 'red', message: r.message });
      else if (r.failed.length) notifications.show({ color: 'orange', autoClose: 9000, message: `Could not load: ${r.failed.join(', ')}` });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Printing failed' });
    } finally {
      setBulkPrinting(false);
    }
  };

  const handleDelete = (a) => {
    modals.openConfirmModal({
      title: 'Delete application',
      children: <Text size="sm">Delete application {a.applicationNo} of {a.applicantName}? The farmer record is not changed.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await farmerApplicationAPI.delete(a._id);
          notifications.show({ color: 'green', message: 'Application deleted' });
          fetchData();
        } catch (err) {
          notifications.show({ color: 'red', message: err?.message || 'Failed to delete' });
        }
      }
    });
  };

  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Dairy Reports · LSGD Reports</Text>
          <Title order={4}>{report.short}</Title>
        </div>
        <Group gap="xs">
          <Checkbox size="xs" label="With documents" checked={withDocs} onChange={e => setWithDocs(e.currentTarget.checked)} />
          <Button variant="light" leftSection={<IconFiles size={14} />} onClick={printAll} loading={bulkPrinting} disabled={!total}>
            Print all ({total})
          </Button>
          <Button leftSection={<IconPlus size={14} />} onClick={() => openForm(null)}>New Application</Button>
        </Group>
      </Group>

      <Paper withBorder p="sm" mb="md">
        <Group align="flex-end" wrap="wrap">
          <Select label="Year" data={[{ value: '', label: 'All years' }, ...SCHEME_YEAR_OPTIONS]} value={year}
            onChange={v => { setYear(v ?? ''); setPage(1); }} w={130} size="sm" allowDeselect={false} />
          <PanchayatInput value={panchayat} onChange={v => { setPanchayat(v); setPage(1); }} panchayats={panchayats}
            description={null} placeholder="All Panchayats" size="sm" w={220} />
          <Select label="Status" data={[{ value: '', label: 'All' }, 'Draft', 'Submitted', 'Approved']}
            value={status} onChange={v => { setStatus(v ?? ''); setPage(1); }} w={120} size="sm" allowDeselect={false} />
          <TextInput placeholder="Farmer name, number, application no" leftSection={<IconSearch size={14} />}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 200 }} size="sm" />
        </Group>
      </Paper>

      {loading ? (
        <Center h={200}><Loader /></Center>
      ) : rows.length === 0 ? (
        <Center h={200}>
          <Stack align="center" gap="xs">
            <Text c="dimmed">No applications for this filter</Text>
            <Button variant="subtle" onClick={() => openForm(null)}>Create an application</Button>
          </Stack>
        </Center>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="xs" fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>App No</Table.Th>
                <Table.Th>Year</Table.Th>
                <Table.Th>Farmer No</Table.Th>
                <Table.Th>Applicant</Table.Th>
                <Table.Th>Panchayat</Table.Th>
                <Table.Th>Ward</Table.Th>
                <Table.Th>Bank A/c</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map(a => (
                <Table.Tr key={a._id}>
                  <Table.Td>{a.applicationNo}</Table.Td>
                  <Table.Td>{fyLabel(a.year)}</Table.Td>
                  <Table.Td>{a.farmerNumber}</Table.Td>
                  <Table.Td>{a.applicantName}</Table.Td>
                  <Table.Td>{a.panchayat}</Table.Td>
                  <Table.Td>{a.ward || '—'}</Table.Td>
                  <Table.Td>{a.accountNumber ? `${a.accountNumber}${a.ifsc ? ` · ${a.ifsc}` : ''}` : <Text span c="orange" size="sm">missing</Text>}</Table.Td>
                  <Table.Td><Badge color={STATUS_COLORS[a.status]} size="sm">{a.status}</Badge></Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="center" wrap="nowrap">
                      <Tooltip label="Preview"><ActionIcon size="sm" variant="light" onClick={() => setPreview(a)}><IconEye size={14} /></ActionIcon></Tooltip>
                      <Tooltip label="Print with documents"><ActionIcon size="sm" variant="light" color="teal" loading={printingId === a._id} onClick={() => printOne(a)}><IconPrinter size={14} /></ActionIcon></Tooltip>
                      <Tooltip label="Edit"><ActionIcon size="sm" variant="light" color="orange" onClick={() => openForm(a._id)}><IconEdit size={14} /></ActionIcon></Tooltip>
                      <Tooltip label="Delete"><ActionIcon size="sm" variant="light" color="red" onClick={() => handleDelete(a)}><IconTrash size={14} /></ActionIcon></Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {total > LIMIT && (
            <Group justify="center" mt="md">
              <Pagination total={Math.ceil(total / LIMIT)} value={page} onChange={setPage} size="sm" />
            </Group>
          )}
        </>
      )}

      <Modal
        opened={formOpen}
        onClose={() => { setFormOpen(false); fetchData(); }}
        title={`${editId ? 'Edit' : 'New'} — ${report.short}`}
        size="90%"
        styles={{ body: { padding: 0 } }}
      >
        <FarmerApplicationForm
          lockedType={formType}
          key={formKey}
          applicationId={editId}
          onClose={() => { setFormOpen(false); fetchData(); }}
          onOpenExisting={(id) => openForm(id)}
        />
      </Modal>

      <FarmerApplicationPreview opened={!!preview} onClose={() => setPreview(null)} application={preview} />
    </Box>
  );
}
