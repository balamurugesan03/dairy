import { useState, useEffect, useCallback } from 'react';
import {
  Container, Title, Button, Group, Modal, TextInput, Select,
  Table, ActionIcon, Text, Box, Stack, Loader, Center, Autocomplete,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconEdit, IconTrash, IconBuildingBank } from '@tabler/icons-react';
import { bankMasterAPI, ledgerAPI } from '../../services/api';
import { INDIAN_BANKS } from '../../utils/indianBanks';

const emptyForm = { bankName: '', branch: '', ifsc: '', micr: '', bankLedgerId: '' };

export default function BankMasterList() {
  const [banks, setBanks]       = useState([]);
  const [ledgers, setLedgers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editRow, setEditRow]   = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [formOpened, formHandlers]     = useDisclosure(false);
  const [confirmOpened, confirmHandlers] = useDisclosure(false);

  const form = useForm({
    initialValues: emptyForm,
    validate: {
      bankName: (v) => v.trim() ? null : 'Bank name is required',
    },
  });

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bankMasterAPI.getAll();
      setBanks(res?.data || []);
    } catch {
      notifications.show({ color: 'red', message: 'Failed to load banks' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLedgers = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        ledgerAPI.getAll({ ledgerType: 'Bank Accounts', status: 'Active' }).catch(() => ({})),
        ledgerAPI.getAll({ ledgerType: 'Bank',          status: 'Active' }).catch(() => ({})),
      ]);
      const combined = [...(r1?.data || []), ...(r2?.data || [])];
      const unique = combined.filter((l, i, arr) => arr.findIndex(x => x._id === l._id) === i);
      setLedgers(unique.map(l => ({ value: l._id, label: l.ledgerName })));
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchBanks();
    fetchLedgers();
  }, [fetchBanks, fetchLedgers]);

  const openAdd = () => {
    setEditRow(null);
    form.setValues(emptyForm);
    form.clearErrors();
    formHandlers.open();
  };

  const openEdit = (bank) => {
    setEditRow(bank);
    form.setValues({
      bankName:    bank.bankName    || '',
      branch:      bank.branch      || '',
      ifsc:        bank.ifsc        || '',
      micr:        bank.micr        || '',
      bankLedgerId: bank.bankLedgerId?._id || bank.bankLedgerId || '',
    });
    form.clearErrors();
    formHandlers.open();
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = {
        bankName:    values.bankName.trim(),
        branch:      values.branch.trim(),
        ifsc:        values.ifsc.trim().toUpperCase(),
        micr:        values.micr.trim(),
        bankLedgerId: values.bankLedgerId || null,
      };
      if (editRow) {
        await bankMasterAPI.update(editRow._id, payload);
        notifications.show({ color: 'green', message: 'Bank updated successfully' });
      } else {
        await bankMasterAPI.create(payload);
        notifications.show({ color: 'green', message: 'Bank added successfully' });
      }
      formHandlers.close();
      fetchBanks();
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id) => {
    setDeleteId(id);
    confirmHandlers.open();
  };

  const handleDelete = async () => {
    try {
      await bankMasterAPI.delete(deleteId);
      notifications.show({ color: 'green', message: 'Bank deleted' });
      confirmHandlers.close();
      fetchBanks();
    } catch {
      notifications.show({ color: 'red', message: 'Delete failed' });
    }
  };

  const rows = banks.map((b) => (
    <Table.Tr key={b._id}>
      <Table.Td>{b.bankName}</Table.Td>
      <Table.Td>{b.branch || '—'}</Table.Td>
      <Table.Td>{b.ifsc   || '—'}</Table.Td>
      <Table.Td>{b.micr   || '—'}</Table.Td>
      <Table.Td>{b.bankLedgerId?.ledgerName || '—'}</Table.Td>
      <Table.Td>
        <Group gap={4} justify="center">
          <ActionIcon variant="light" color="blue" onClick={() => openEdit(b)}>
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon variant="light" color="red" onClick={() => confirmDelete(b._id)}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Group gap={8}>
          <IconBuildingBank size={24} color="var(--mantine-color-blue-6)" />
          <Title order={3}>Farmer Bank Details</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
          Add Banks
        </Button>
      </Group>

      {loading ? (
        <Center h={200}><Loader /></Center>
      ) : banks.length === 0 ? (
        <Center h={200}>
          <Stack align="center" gap={8}>
            <IconBuildingBank size={40} color="gray" />
            <Text c="dimmed">No banks added yet. Click "Add Banks" to get started.</Text>
          </Stack>
        </Center>
      ) : (
        <Box style={{ border: '1px solid #e9ecef', borderRadius: 8, overflow: 'hidden' }}>
          <Table striped highlightOnHover withTableBorder={false}>
            <Table.Thead style={{ background: '#f8f9fa' }}>
              <Table.Tr>
                <Table.Th>Bank Name</Table.Th>
                <Table.Th>Branch</Table.Th>
                <Table.Th>IFSC Code</Table.Th>
                <Table.Th>MICR Code</Table.Th>
                <Table.Th>Bank Ledger</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Box>
      )}

      {/* Add / Edit Modal */}
      <Modal
        opened={formOpened}
        onClose={formHandlers.close}
        title={editRow ? 'Edit Bank' : 'Add Bank'}
        size="md"
        centered
      >
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack gap="sm">
            <Autocomplete
              label="Bank Name"
              placeholder="Select or type bank name"
              required
              data={INDIAN_BANKS}
              value={form.values.bankName}
              onChange={(val) => form.setFieldValue('bankName', val)}
              error={form.errors.bankName}
            />
            <TextInput
              label="Branch"
              placeholder="e.g. Chennai Main Branch"
              {...form.getInputProps('branch')}
            />
            <TextInput
              label="IFSC Code"
              placeholder="e.g. SBIN0001234"
              {...form.getInputProps('ifsc')}
            />
            <TextInput
              label="MICR Code"
              placeholder="e.g. 600002001"
              {...form.getInputProps('micr')}
            />
            <Select
              label="Bank Ledger"
              placeholder="Select bank ledger"
              data={ledgers}
              searchable
              clearable
              {...form.getInputProps('bankLedgerId')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={formHandlers.close}>Cancel</Button>
              <Button type="submit" loading={saving}>
                {editRow ? 'Update' : 'Save'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={confirmOpened}
        onClose={confirmHandlers.close}
        title="Confirm Delete"
        size="sm"
        centered
      >
        <Text>Are you sure you want to delete this bank?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={confirmHandlers.close}>Cancel</Button>
          <Button color="red" onClick={handleDelete}>Delete</Button>
        </Group>
      </Modal>
    </Container>
  );
}
