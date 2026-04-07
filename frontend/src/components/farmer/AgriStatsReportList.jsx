import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Group, Text, Title, TextInput, Select, Badge,
  Table, ActionIcon, Tooltip, Modal, Loader, Center, Paper,
  Pagination, Stack
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconPrinter } from '@tabler/icons-react';
import { agriStatsAPI } from '../../services/api';
import AgriStatsReportForm from './AgriStatsReportForm';
import AgriStatsReportPrint from './AgriStatsReportPrint';

const STATUS_COLORS = { Draft: 'gray', Submitted: 'blue', Approved: 'green' };

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function AgriStatsReportList() {
  const [reports, setReports]         = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [loading, setLoading]         = useState(false);
  const [formOpen, setFormOpen]       = useState(false);
  const [printOpen, setPrintOpen]     = useState(false);
  const [editId, setEditId]           = useState(null);
  const [printId, setPrintId]         = useState(null);
  const LIMIT = 15;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agriStatsAPI.getAll({
        search, status: statusFilter, month: monthFilter, page, limit: LIMIT
      });
      if (res?.success) {
        setReports(res.data.reports || []);
        setTotal(res.data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, monthFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd  = () => { setEditId(null); setFormOpen(true); };
  const openEdit = (id) => { setEditId(id); setFormOpen(true); };
  const openPrint = (id) => { setPrintId(id); setPrintOpen(true); };

  const handleDelete = (id) => {
    modals.openConfirmModal({
      title: 'Delete Report',
      children: <Text size="sm">Delete this monthly report? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const res = await agriStatsAPI.delete(id);
        if (res?.success) {
          notifications.show({ message: 'Report deleted', color: 'green' });
          fetchData();
        }
      }
    });
  };

  const rows = reports.map((r) => (
    <Table.Tr key={r._id}>
      <Table.Td>{r.reportNo}</Table.Td>
      <Table.Td>{r.district || '—'}</Table.Td>
      <Table.Td>{r.month}</Table.Td>
      <Table.Td>{r.year}</Table.Td>
      <Table.Td>
        <Badge color={STATUS_COLORS[r.status]} size="sm">{r.status}</Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="center">
          <Tooltip label="Print Report">
            <ActionIcon size="sm" variant="light" color="blue" onClick={() => openPrint(r._id)}>
              <IconPrinter size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Edit">
            <ActionIcon size="sm" variant="light" color="orange" onClick={() => openEdit(r._id)}>
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon size="sm" variant="light" color="red" onClick={() => handleDelete(r._id)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>Monthly Agricultural Statistics Reports</Title>
        <Button leftSection={<IconPlus size={14} />} onClick={openAdd} size="sm">
          New Report
        </Button>
      </Group>

      <Paper withBorder p="sm" mb="md">
        <Group>
          <TextInput
            placeholder="Search district, report no..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1 }}
            size="sm"
          />
          <Select
            placeholder="All Months"
            data={MONTHS.map(m => ({ value: m, label: m }))}
            value={monthFilter}
            onChange={(v) => { setMonthFilter(v || ''); setPage(1); }}
            clearable size="sm" w={140}
          />
          <Select
            placeholder="All Status"
            data={[
              { value: 'Draft',     label: 'Draft' },
              { value: 'Submitted', label: 'Submitted' },
              { value: 'Approved',  label: 'Approved' }
            ]}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
            clearable size="sm" w={140}
          />
        </Group>
      </Paper>

      {loading ? (
        <Center h={200}><Loader /></Center>
      ) : reports.length === 0 ? (
        <Center h={200}>
          <Stack align="center" gap="xs">
            <Text c="dimmed">No reports found</Text>
            <Button variant="subtle" onClick={openAdd}>Create first report</Button>
          </Stack>
        </Center>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="xs" fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Report No</Table.Th>
                <Table.Th>District</Table.Th>
                <Table.Th>Month</Table.Th>
                <Table.Th>Year</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
          {total > LIMIT && (
            <Group justify="center" mt="md">
              <Pagination total={Math.ceil(total / LIMIT)} value={page} onChange={setPage} size="sm" />
            </Group>
          )}
        </>
      )}

      {/* Form Modal */}
      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title={editId ? 'Edit Monthly Report' : 'New Monthly Agricultural Statistics Report'}
        size="90%"
        overlayProps={{ opacity: 0.4 }}
        styles={{ body: { padding: 0 } }}
      >
        <AgriStatsReportForm
          reportId={editId}
          onClose={() => { setFormOpen(false); fetchData(); }}
        />
      </Modal>

      {/* Print Modal */}
      <Modal
        opened={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Report Preview"
        size="960px"
        overlayProps={{ opacity: 0.4 }}
      >
        {printId && <AgriStatsReportPrint reportId={printId} />}
      </Modal>
    </Box>
  );
}
