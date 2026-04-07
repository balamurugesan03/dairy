import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Group, Text, Title, TextInput, Select, Badge,
  Table, ActionIcon, Tooltip, Modal, Loader, Center, Paper,
  Pagination, Stack
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconPrinter } from '@tabler/icons-react';
import { cropStatementAPI } from '../../services/api';
import CropStatementForm from './CropStatementForm';
import CropStatementPrint from './CropStatementPrint';

const STATUS_COLORS = { Draft: 'gray', Submitted: 'blue', Approved: 'green' };

export default function CropStatementList() {
  const [statements, setStatements]   = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading]         = useState(false);
  const [formOpen, setFormOpen]       = useState(false);
  const [printOpen, setPrintOpen]     = useState(false);
  const [editId, setEditId]           = useState(null);
  const [viewId, setViewId]           = useState(null);
  const LIMIT = 15;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cropStatementAPI.getAll({ search, status: statusFilter, page, limit: LIMIT });
      if (res?.success) {
        setStatements(res.data.statements || []);
        setTotal(res.data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => { setEditId(null); setFormOpen(true); };
  const openEdit = (id) => { setEditId(id); setFormOpen(true); };
  const openPrint = (id) => { setViewId(id); setPrintOpen(true); };

  const handleDelete = (id) => {
    modals.openConfirmModal({
      title: 'Delete Statement',
      children: <Text size="sm">Are you sure you want to delete this statement? This action cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const res = await cropStatementAPI.delete(id);
        if (res?.success) {
          notifications.show({ message: 'Statement deleted', color: 'green' });
          fetchData();
        } else {
          notifications.show({ message: 'Failed to delete', color: 'red' });
        }
      }
    });
  };

  const rows = statements.map((s) => (
    <Table.Tr key={s._id}>
      <Table.Td>{s.statementNo}</Table.Td>
      <Table.Td>{s.farmerName}</Table.Td>
      <Table.Td>{s.bankName || '—'}</Table.Td>
      <Table.Td>{s.loanAccountNumber || '—'}</Table.Td>
      <Table.Td>{s.mobileNumber || '—'}</Table.Td>
      <Table.Td>
        <Badge color={STATUS_COLORS[s.status]} size="sm">{s.status}</Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="center">
          <Tooltip label="Print Statement">
            <ActionIcon size="sm" variant="light" color="blue" onClick={() => openPrint(s._id)}>
              <IconPrinter size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Edit">
            <ActionIcon size="sm" variant="light" color="orange" onClick={() => openEdit(s._id)}>
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon size="sm" variant="light" color="red" onClick={() => handleDelete(s._id)}>
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
        <Title order={4}>Crop Damage Statements</Title>
        <Button leftSection={<IconPlus size={14} />} onClick={openAdd} size="sm">
          New Statement
        </Button>
      </Group>

      <Paper withBorder p="sm" mb="md">
        <Group>
          <TextInput
            placeholder="Search farmer, statement no, bank..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1 }}
            size="sm"
          />
          <Select
            placeholder="All Status"
            data={[
              { value: '',          label: 'All Status' },
              { value: 'Draft',     label: 'Draft' },
              { value: 'Submitted', label: 'Submitted' },
              { value: 'Approved',  label: 'Approved' }
            ]}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
            clearable
            size="sm"
            w={150}
          />
        </Group>
      </Paper>

      {loading ? (
        <Center h={200}><Loader /></Center>
      ) : statements.length === 0 ? (
        <Center h={200}>
          <Stack align="center" gap="xs">
            <Text c="dimmed">No statements found</Text>
            <Button variant="subtle" onClick={openAdd}>Create first statement</Button>
          </Stack>
        </Center>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="xs" fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Statement No</Table.Th>
                <Table.Th>Farmer Name</Table.Th>
                <Table.Th>Bank Name</Table.Th>
                <Table.Th>Loan A/C No</Table.Th>
                <Table.Th>Mobile</Table.Th>
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
        title={editId ? 'Edit Statement' : 'New Crop Damage Statement'}
        size="90%"
        overlayProps={{ opacity: 0.4 }}
        styles={{ body: { padding: 0 } }}
      >
        <CropStatementForm
          statementId={editId}
          onClose={() => { setFormOpen(false); fetchData(); }}
        />
      </Modal>

      {/* Print Modal */}
      <Modal
        opened={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Statement Preview"
        size="900px"
        overlayProps={{ opacity: 0.4 }}
      >
        {viewId && <CropStatementPrint statementId={viewId} />}
      </Modal>
    </Box>
  );
}
