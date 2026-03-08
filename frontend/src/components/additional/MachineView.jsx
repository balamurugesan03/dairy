import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Stack, Paper, Grid, Badge,
  ActionIcon, Divider, Box, Loader, Center, Modal, Select,
  Textarea, ThemeIcon, NumberInput, TextInput
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconEdit, IconPlus, IconTool, IconEngine,
  IconMapPin, IconCalendar, IconCurrencyRupee, IconUser
} from '@tabler/icons-react';
import { machineAPI } from '../../services/api';
import dayjs from 'dayjs';

const STATUS_CONFIG = {
  Active:              { color: 'green',  label: 'Active' },
  'Under Maintenance': { color: 'orange', label: 'Under Maintenance' },
  Disposed:            { color: 'red',    label: 'Disposed' },
  Sold:                { color: 'gray',   label: 'Sold' },
  Inactive:            { color: 'gray',   label: 'Inactive' }
};

const MAINT_TYPE_COLOR = { Preventive: 'blue', Corrective: 'orange', Emergency: 'red', 'Annual Service': 'teal' };

const MachineView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maintModal, setMaintModal] = useState(false);
  const [editMaintModal, setEditMaintModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [saving, setSaving] = useState(false);

  const [maintForm, setMaintForm] = useState({
    date: new Date(),
    maintenanceType: 'Preventive',
    description: '',
    cost: 0,
    nextMaintenanceDate: null,
    technicianName: '',
    partsReplaced: '',
    status: 'Completed'
  });

  useEffect(() => { fetchMachine(); }, [id]);

  const fetchMachine = async () => {
    setLoading(true);
    try {
      const res = await machineAPI.getById(id);
      setMachine(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
      navigate('/machines');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaintenance = async () => {
    if (!maintForm.description) { notifications.show({ title: 'Validation', message: 'Description required', color: 'yellow' }); return; }
    setSaving(true);
    try {
      await machineAPI.addMaintenance(id, maintForm);
      notifications.show({ title: 'Added', message: 'Maintenance log added', color: 'green' });
      setMaintModal(false);
      resetMaintForm();
      fetchMachine();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMaintenance = async () => {
    setSaving(true);
    try {
      await machineAPI.updateMaintenance(id, selectedLog._id, maintForm);
      notifications.show({ title: 'Updated', message: 'Maintenance log updated', color: 'green' });
      setEditMaintModal(false);
      fetchMachine();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const resetMaintForm = () => setMaintForm({
    date: new Date(), maintenanceType: 'Preventive', description: '',
    cost: 0, nextMaintenanceDate: null, technicianName: '', partsReplaced: '', status: 'Completed'
  });

  const openEditLog = (log) => {
    setSelectedLog(log);
    setMaintForm({
      date: log.date ? new Date(log.date) : new Date(),
      maintenanceType: log.maintenanceType || 'Preventive',
      description: log.description || '',
      cost: log.cost || 0,
      nextMaintenanceDate: log.nextMaintenanceDate ? new Date(log.nextMaintenanceDate) : null,
      technicianName: log.technicianName || '',
      partsReplaced: log.partsReplaced || '',
      status: log.status || 'Completed'
    });
    setEditMaintModal(true);
  };

  if (loading) return <Center h={400}><Loader/></Center>;
  if (!machine) return null;

  const m = machine;
  const statusCfg = STATUS_CONFIG[m.status] || { color: 'gray', label: m.status };
  const lastLog = m.maintenanceLogs?.slice(-1)[0];
  const nextMaint = lastLog?.nextMaintenanceDate;
  const daysToNext = nextMaint ? dayjs(nextMaint).diff(dayjs(), 'day') : null;
  const totalMaintCost = m.maintenanceLogs?.reduce((s, l) => s + (l.cost || 0), 0) || 0;

  const MaintFormFields = () => (
    <Stack gap="sm">
      <Grid>
        <Grid.Col span={6}><DatePickerInput label="Date" value={maintForm.date} onChange={v => setMaintForm(f => ({ ...f, date: v }))}/></Grid.Col>
        <Grid.Col span={6}><Select label="Type" value={maintForm.maintenanceType} onChange={v => setMaintForm(f => ({ ...f, maintenanceType: v }))} data={['Preventive', 'Corrective', 'Emergency', 'Annual Service']}/></Grid.Col>
      </Grid>
      <Textarea label="Description" value={maintForm.description} onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} required rows={3}/>
      <Grid>
        <Grid.Col span={6}><TextInput label="Technician" value={maintForm.technicianName} onChange={e => setMaintForm(f => ({ ...f, technicianName: e.target.value }))}/></Grid.Col>
        <Grid.Col span={6}><NumberInput label="Cost (₹)" value={maintForm.cost} onChange={v => setMaintForm(f => ({ ...f, cost: v }))} min={0} decimalScale={2}/></Grid.Col>
      </Grid>
      <TextInput label="Parts Replaced" value={maintForm.partsReplaced} onChange={e => setMaintForm(f => ({ ...f, partsReplaced: e.target.value }))}/>
      <Grid>
        <Grid.Col span={6}><DatePickerInput label="Next Maintenance" value={maintForm.nextMaintenanceDate} onChange={v => setMaintForm(f => ({ ...f, nextMaintenanceDate: v }))} clearable/></Grid.Col>
        <Grid.Col span={6}><Select label="Status" value={maintForm.status} onChange={v => setMaintForm(f => ({ ...f, status: v }))} data={['Completed', 'Pending', 'In Progress']}/></Grid.Col>
      </Grid>
    </Stack>
  );

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => navigate('/machines')}><IconArrowLeft size={18}/></ActionIcon>
          <Box>
            <Title order={2} fw={700}>{m.machineName}</Title>
            <Text size="sm" c="dimmed">{m.machineCode} {m.category ? `· ${m.category}` : ''}</Text>
          </Box>
          <Badge color={statusCfg.color} size="lg" variant="light">{statusCfg.label}</Badge>
          {daysToNext !== null && daysToNext < 7 && (
            <Badge color={daysToNext < 0 ? 'red' : 'orange'} variant="dot">
              {daysToNext < 0 ? 'Maintenance overdue' : `Next maintenance in ${daysToNext}d`}
            </Badge>
          )}
        </Group>
        <Group>
          <Button size="sm" variant="default" leftSection={<IconEdit size={14}/>} onClick={() => navigate(`/machines/edit/${id}`)}>Edit</Button>
          <Button size="sm" leftSection={<IconPlus size={14}/>} onClick={() => setMaintModal(true)}>Log Maintenance</Button>
        </Group>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          {/* Machine Info */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Group gap="xs" mb="sm"><ThemeIcon size="sm" variant="light" color="blue"><IconEngine size={14}/></ThemeIcon><Text fw={600} size="sm">Machine Details</Text></Group>
            <Grid>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Make</Text><Text size="sm" fw={500}>{m.make || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Model</Text><Text size="sm">{m.model || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Manufacturer</Text><Text size="sm">{m.manufacturer || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Model No.</Text><Text size="sm">{m.modelNumber || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Serial No.</Text><Text size="sm">{m.serialNumber || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Purchase Date</Text><Text size="sm">{m.purchaseDate ? dayjs(m.purchaseDate).format('DD MMM YYYY') : '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Purchase Price</Text><Text size="sm">₹{(m.purchasePrice || 0).toLocaleString()}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Supplier</Text><Text size="sm">{m.supplierName || '—'}</Text></Grid.Col>
            </Grid>
            {m.description && <><Divider my="xs"/><Text size="xs" c="dimmed">Description</Text><Text size="sm">{m.description}</Text></>}
          </Paper>

          {/* Location */}
          <Paper withBorder radius="md" p="md">
            <Group gap="xs" mb="sm"><ThemeIcon size="sm" variant="light" color="teal"><IconMapPin size={14}/></ThemeIcon><Text fw={600} size="sm">Location & Warranty</Text></Group>
            <Grid>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Location</Text><Text size="sm">{m.location || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Department</Text><Text size="sm">{m.department || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Assigned To</Text><Text size="sm">{m.assignedTo || '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Warranty Expiry</Text><Text size="sm" c={m.warrantyExpiry && new Date(m.warrantyExpiry) < new Date() ? 'red' : undefined}>{m.warrantyExpiry ? dayjs(m.warrantyExpiry).format('DD MMM YYYY') : '—'}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Total Maint. Cost</Text><Text size="sm" fw={600}>₹{totalMaintCost.toLocaleString()}</Text></Grid.Col>
              <Grid.Col span={6}><Text size="xs" c="dimmed">Next Maintenance</Text><Text size="sm" c={daysToNext !== null && daysToNext < 7 ? 'orange' : undefined}>{nextMaint ? dayjs(nextMaint).format('DD MMM YYYY') : '—'}</Text></Grid.Col>
            </Grid>
          </Paper>
        </Grid.Col>

        {/* Maintenance Logs */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <Group justify="space-between" p="sm" style={{ background: 'var(--mantine-color-gray-0)' }}>
              <Text fw={600} size="sm">Maintenance Logs ({m.maintenanceLogs?.length || 0})</Text>
              <Button size="xs" leftSection={<IconPlus size={12}/>} variant="light" onClick={() => setMaintModal(true)}>Add</Button>
            </Group>
            {!m.maintenanceLogs?.length ? (
              <Center p="xl"><Stack align="center" gap="xs"><IconTool size={32} opacity={0.3}/><Text c="dimmed" size="sm">No maintenance logs yet</Text></Stack></Center>
            ) : (
              <Stack gap={0}>
                {[...m.maintenanceLogs].reverse().map((log, i) => (
                  <Box key={log._id || i} p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <Badge color={MAINT_TYPE_COLOR[log.maintenanceType] || 'gray'} size="sm" variant="light">{log.maintenanceType}</Badge>
                        <Text size="xs" c="dimmed">{dayjs(log.date).format('DD MMM YYYY')}</Text>
                        {log.cost > 0 && <Text size="xs" c="dimmed">₹{log.cost}</Text>}
                      </Group>
                      <ActionIcon size="xs" variant="subtle" onClick={() => openEditLog(log)}><IconEdit size={12}/></ActionIcon>
                    </Group>
                    <Text size="sm">{log.description}</Text>
                    {log.technicianName && <Text size="xs" c="dimmed">Technician: {log.technicianName}</Text>}
                    {log.partsReplaced && <Text size="xs" c="dimmed">Parts: {log.partsReplaced}</Text>}
                    {log.nextMaintenanceDate && <Text size="xs" c="blue">Next: {dayjs(log.nextMaintenanceDate).format('DD MMM YYYY')}</Text>}
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Add Maintenance Modal */}
      <Modal opened={maintModal} onClose={() => setMaintModal(false)} title="Log Maintenance" size="md">
        <MaintFormFields/>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setMaintModal(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleAddMaintenance}>Save Log</Button>
        </Group>
      </Modal>

      {/* Edit Maintenance Modal */}
      <Modal opened={editMaintModal} onClose={() => setEditMaintModal(false)} title="Update Maintenance Log" size="md">
        <MaintFormFields/>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setEditMaintModal(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleUpdateMaintenance}>Update</Button>
        </Group>
      </Modal>
    </Container>
  );
};

export default MachineView;
