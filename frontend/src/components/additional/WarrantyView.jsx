import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Stack, Paper, Grid, Badge,
  ActionIcon, Divider, Box, Table, Loader, Center, Modal, Select,
  Textarea, ThemeIcon, Alert, NumberInput, TextInput
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconEdit, IconPlus, IconShield, IconShieldCheck,
  IconShieldOff, IconAlertCircle, IconUser, IconTag
} from '@tabler/icons-react';
import { warrantyAPI } from '../../services/api';
import dayjs from 'dayjs';

const STATUS_CONFIG = {
  Active:  { color: 'green',  label: 'Active',  icon: <IconShieldCheck size={14}/> },
  Expired: { color: 'red',    label: 'Expired', icon: <IconShieldOff size={14}/> },
  Claimed: { color: 'orange', label: 'Claimed', icon: <IconAlertCircle size={14}/> },
  Void:    { color: 'gray',   label: 'Void',    icon: <IconShield size={14}/> }
};

const CLAIM_STATUS_COLOR = { Pending: 'yellow', 'In Progress': 'blue', Resolved: 'green', Rejected: 'red' };

const WarrantyView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [warranty, setWarranty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimModal, setClaimModal] = useState(false);
  const [editClaimModal, setEditClaimModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [saving, setSaving] = useState(false);

  const [claimForm, setClaimForm] = useState({
    claimDate: new Date(),
    description: '',
    claimType: 'Repair',
    status: 'Pending',
    technicianName: '',
    cost: 0,
    resolution: '',
    resolvedDate: null
  });

  useEffect(() => { fetchWarranty(); }, [id]);

  const fetchWarranty = async () => {
    setLoading(true);
    try {
      const res = await warrantyAPI.getById(id);
      setWarranty(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
      navigate('/warranty');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClaim = async () => {
    if (!claimForm.description) { notifications.show({ title: 'Validation', message: 'Claim description required', color: 'yellow' }); return; }
    setSaving(true);
    try {
      await warrantyAPI.addClaim(id, claimForm);
      notifications.show({ title: 'Added', message: 'Claim added successfully', color: 'green' });
      setClaimModal(false);
      setClaimForm({ claimDate: new Date(), description: '', claimType: 'Repair', status: 'Pending', technicianName: '', cost: 0, resolution: '', resolvedDate: null });
      fetchWarranty();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateClaim = async () => {
    setSaving(true);
    try {
      await warrantyAPI.updateClaim(id, selectedClaim._id, claimForm);
      notifications.show({ title: 'Updated', message: 'Claim updated', color: 'green' });
      setEditClaimModal(false);
      fetchWarranty();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const openEditClaim = (claim) => {
    setSelectedClaim(claim);
    setClaimForm({
      claimDate: claim.claimDate ? new Date(claim.claimDate) : new Date(),
      description: claim.description || '',
      claimType: claim.claimType || 'Repair',
      status: claim.status || 'Pending',
      technicianName: claim.technicianName || '',
      cost: claim.cost || 0,
      resolution: claim.resolution || '',
      resolvedDate: claim.resolvedDate ? new Date(claim.resolvedDate) : null
    });
    setEditClaimModal(true);
  };

  if (loading) return <Center h={400}><Loader/></Center>;
  if (!warranty) return null;

  const w = warranty;
  const statusCfg = STATUS_CONFIG[w.status] || { color: 'gray', label: w.status };
  const daysLeft = dayjs(w.warrantyEndDate).diff(dayjs(), 'day');
  const canClaim = w.status === 'Active';

  const ClaimFormFields = () => (
    <Stack gap="sm">
      <Grid>
        <Grid.Col span={6}><DatePickerInput label="Claim Date" value={claimForm.claimDate} onChange={v => setClaimForm(f => ({ ...f, claimDate: v }))}/></Grid.Col>
        <Grid.Col span={6}><Select label="Type" value={claimForm.claimType} onChange={v => setClaimForm(f => ({ ...f, claimType: v }))} data={['Repair', 'Replacement', 'Refund', 'Other']}/></Grid.Col>
      </Grid>
      <Textarea label="Issue Description" value={claimForm.description} onChange={e => setClaimForm(f => ({ ...f, description: e.target.value }))} required rows={3}/>
      <Grid>
        <Grid.Col span={6}><TextInput label="Technician" value={claimForm.technicianName} onChange={e => setClaimForm(f => ({ ...f, technicianName: e.target.value }))}/></Grid.Col>
        <Grid.Col span={6}><NumberInput label="Repair Cost (₹)" value={claimForm.cost} onChange={v => setClaimForm(f => ({ ...f, cost: v }))} min={0} decimalScale={2}/></Grid.Col>
      </Grid>
      <Select label="Status" value={claimForm.status} onChange={v => setClaimForm(f => ({ ...f, status: v }))} data={['Pending', 'In Progress', 'Resolved', 'Rejected']}/>
      {(claimForm.status === 'Resolved' || claimForm.status === 'Rejected') && <>
        <DatePickerInput label="Resolved Date" value={claimForm.resolvedDate} onChange={v => setClaimForm(f => ({ ...f, resolvedDate: v }))}/>
        <Textarea label="Resolution" value={claimForm.resolution} onChange={e => setClaimForm(f => ({ ...f, resolution: e.target.value }))} rows={2}/>
      </>}
    </Stack>
  );

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => navigate('/warranty')}><IconArrowLeft size={18}/></ActionIcon>
          <Box>
            <Title order={2} fw={700}>{w.warrantyNumber}</Title>
            <Text size="sm" c="dimmed">{w.itemName}</Text>
          </Box>
          <Badge color={statusCfg.color} size="lg" variant="light" leftSection={statusCfg.icon}>{statusCfg.label}</Badge>
          {daysLeft > 0 && <Badge color={daysLeft < 30 ? 'orange' : 'green'} variant="dot">{daysLeft} days left</Badge>}
        </Group>
        <Group>
          <Button size="sm" variant="default" leftSection={<IconEdit size={14}/>} onClick={() => navigate(`/warranty/edit/${id}`)}>Edit</Button>
          {canClaim && (
            <Button size="sm" leftSection={<IconPlus size={14}/>} onClick={() => setClaimModal(true)}>Add Claim</Button>
          )}
        </Group>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          {/* Item Details */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Group gap="xs" mb="sm"><ThemeIcon size="sm" variant="light" color="blue"><IconTag size={14}/></ThemeIcon><Text fw={600} size="sm">Item Details</Text></Group>
            <Grid>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Item Name</Text><Text size="sm" fw={500}>{w.itemName}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Category</Text><Text size="sm">{w.category || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Serial Number</Text><Text size="sm">{w.serialNumber || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Batch Number</Text><Text size="sm">{w.batchNumber || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Warranty Type</Text><Badge variant="light" size="sm">{w.warrantyType}</Badge></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Period</Text><Text size="sm">{w.warrantyPeriod} months</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Start Date</Text><Text size="sm">{w.warrantyStartDate ? dayjs(w.warrantyStartDate).format('DD MMM YYYY') : '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">End Date</Text><Text size="sm" c={daysLeft < 0 ? 'red' : daysLeft < 30 ? 'orange' : undefined}>{w.warrantyEndDate ? dayjs(w.warrantyEndDate).format('DD MMM YYYY') : '—'}</Text></Grid.Col>
            </Grid>
          </Paper>

          {/* Customer */}
          <Paper withBorder radius="md" p="md">
            <Group gap="xs" mb="sm"><ThemeIcon size="sm" variant="light" color="teal"><IconUser size={14}/></ThemeIcon><Text fw={600} size="sm">Customer Details</Text></Group>
            <Grid>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Customer</Text><Text size="sm" fw={500}>{w.customerName || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Phone</Text><Text size="sm">{w.customerPhone || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Invoice No</Text><Text size="sm">{w.invoiceNumber || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Sale Date</Text><Text size="sm">{w.saleDate ? dayjs(w.saleDate).format('DD MMM YYYY') : '—'}</Text></Grid.Col>
            </Grid>
            {w.description && <><Divider my="xs"/><Text size="xs" c="dimmed">Description</Text><Text size="sm">{w.description}</Text></>}
            {w.termsAndConditions && <><Text size="xs" c="dimmed" mt="xs">Terms</Text><Text size="sm">{w.termsAndConditions}</Text></>}
          </Paper>
        </Grid.Col>

        {/* Claims */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <Group justify="space-between" p="sm" style={{ background: 'var(--mantine-color-gray-0)' }}>
              <Text fw={600} size="sm">Claims ({w.claims?.length || 0})</Text>
              {canClaim && <Button size="xs" leftSection={<IconPlus size={12}/>} variant="light" onClick={() => setClaimModal(true)}>Add</Button>}
            </Group>
            {!w.claims?.length ? (
              <Center p="xl"><Stack align="center" gap="xs"><IconShield size={32} opacity={0.3}/><Text c="dimmed" size="sm">No claims yet</Text></Stack></Center>
            ) : (
              <Stack gap={0}>
                {w.claims.map((claim, i) => (
                  <Box key={claim._id || i} p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <Badge color={CLAIM_STATUS_COLOR[claim.status] || 'gray'} size="sm" variant="light">{claim.status}</Badge>
                        <Badge size="sm" variant="outline">{claim.claimType}</Badge>
                        <Text size="xs" c="dimmed">{dayjs(claim.claimDate).format('DD MMM YYYY')}</Text>
                      </Group>
                      <ActionIcon size="xs" variant="subtle" onClick={() => openEditClaim(claim)}><IconEdit size={12}/></ActionIcon>
                    </Group>
                    <Text size="sm">{claim.description}</Text>
                    {claim.technicianName && <Text size="xs" c="dimmed">Tech: {claim.technicianName} | Cost: ₹{claim.cost || 0}</Text>}
                    {claim.resolution && <Text size="xs" c="green" mt={2}>{claim.resolution}</Text>}
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Add Claim Modal */}
      <Modal opened={claimModal} onClose={() => setClaimModal(false)} title="Add Warranty Claim" size="md">
        <ClaimFormFields/>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setClaimModal(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleAddClaim}>Add Claim</Button>
        </Group>
      </Modal>

      {/* Edit Claim Modal */}
      <Modal opened={editClaimModal} onClose={() => setEditClaimModal(false)} title="Update Claim" size="md">
        <ClaimFormFields/>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setEditClaimModal(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleUpdateClaim}>Update Claim</Button>
        </Group>
      </Modal>
    </Container>
  );
};

export default WarrantyView;
