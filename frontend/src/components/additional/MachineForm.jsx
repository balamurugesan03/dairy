import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Stack, Paper, Grid, TextInput,
  Select, Textarea, NumberInput, ActionIcon, Loader, Center, Box
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { machineAPI, supplierAPI, warrantyAPI } from '../../services/api';
import dayjs from 'dayjs';

const MachineForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [suppliers, setSuppliers] = useState([]);
  const [warranties, setWarranties] = useState([]);

  const [machineName, setMachineName] = useState('');
  const [category, setCategory] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(null);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [warrantyId, setWarrantyId] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState(null);
  const [location, setLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('Active');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadMasterData();
    if (isEdit) loadMachine();
  }, [id]);

  const loadMasterData = async () => {
    try {
      const [supRes, warRes] = await Promise.all([
        supplierAPI.getAll({ limit: 300 }),
        warrantyAPI.getAll({ limit: 300, status: 'Active' })
      ]);
      setSuppliers(Array.isArray(supRes?.data) ? supRes.data : supRes?.data?.data || []);
      const warData = Array.isArray(warRes?.data) ? warRes.data : warRes?.data?.data || [];
      setWarranties(warData);
    } catch { /* silent */ }
  };

  const loadMachine = async () => {
    setLoading(true);
    try {
      const res = await machineAPI.getById(id);
      const m = res?.data || res;
      setMachineName(m.machineName || '');
      setCategory(m.category || '');
      setMake(m.make || '');
      setModel(m.model || '');
      setManufacturer(m.manufacturer || '');
      setSerialNumber(m.serialNumber || '');
      setModelNumber(m.modelNumber || '');
      setPurchaseDate(m.purchaseDate ? new Date(m.purchaseDate) : null);
      setPurchasePrice(m.purchasePrice || 0);
      setSupplierId(m.supplierId?._id || m.supplierId || '');
      setSupplierName(m.supplierName || '');
      setWarrantyId(m.warrantyId?._id || m.warrantyId || '');
      setWarrantyExpiry(m.warrantyExpiry ? new Date(m.warrantyExpiry) : null);
      setLocation(m.location || '');
      setDepartment(m.department || '');
      setAssignedTo(m.assignedTo || '');
      setStatus(m.status || 'Active');
      setDescription(m.description || '');
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSelect = (val) => {
    setSupplierId(val || '');
    const sup = suppliers.find(s => s._id === val);
    if (sup) setSupplierName(sup.name || sup.supplierName || '');
  };

  const handleWarrantySelect = (val) => {
    setWarrantyId(val || '');
    const war = warranties.find(w => w._id === val);
    if (war) setWarrantyExpiry(war.warrantyEndDate ? new Date(war.warrantyEndDate) : null);
  };

  const handleSave = async () => {
    if (!machineName) { notifications.show({ title: 'Validation', message: 'Machine name required', color: 'yellow' }); return; }
    setSaving(true);
    try {
      const payload = {
        machineName, category, make, model, manufacturer,
        serialNumber, modelNumber, purchaseDate, purchasePrice,
        supplierId: supplierId || undefined, supplierName,
        warrantyId: warrantyId || undefined, warrantyExpiry,
        location, department, assignedTo, status, description
      };
      if (isEdit) {
        await machineAPI.update(id, payload);
        notifications.show({ title: 'Updated', message: 'Machine updated', color: 'green' });
      } else {
        await machineAPI.create(payload);
        notifications.show({ title: 'Created', message: 'Machine added', color: 'green' });
      }
      navigate('/');
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Center h={300}><Loader/></Center>;

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => navigate('/machines')}><IconArrowLeft size={18}/></ActionIcon>
          <Box>
            <Title order={2} fw={700}>{isEdit ? 'Edit Machine' : 'Add Machine / Asset'}</Title>
            <Text size="sm" c="dimmed">Register a machine or asset with full details</Text>
          </Box>
        </Group>
        <Group>
          <Button variant="default" onClick={() => navigate('/machines')}>Cancel</Button>
          <Button leftSection={<IconDeviceFloppy size={16}/>} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save Machine'}
          </Button>
        </Group>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          {/* Machine Specs */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Text fw={600} mb="sm">Machine Specifications</Text>
            <Stack gap="sm">
              <TextInput label="Machine Name" value={machineName} onChange={e => setMachineName(e.target.value)} required/>
              <Grid>
                <Grid.Col span={6}><TextInput label="Category" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Processing, Packaging"/></Grid.Col>
                <Grid.Col span={6}><Select label="Status" value={status} onChange={setStatus} data={['Active', 'Under Maintenance', 'Disposed', 'Sold', 'Inactive']}/></Grid.Col>
                <Grid.Col span={6}><TextInput label="Make / Brand" value={make} onChange={e => setMake(e.target.value)}/></Grid.Col>
                <Grid.Col span={6}><TextInput label="Model" value={model} onChange={e => setModel(e.target.value)}/></Grid.Col>
                <Grid.Col span={6}><TextInput label="Manufacturer" value={manufacturer} onChange={e => setManufacturer(e.target.value)}/></Grid.Col>
                <Grid.Col span={6}><TextInput label="Model Number" value={modelNumber} onChange={e => setModelNumber(e.target.value)}/></Grid.Col>
                <Grid.Col span={6}><TextInput label="Serial Number" value={serialNumber} onChange={e => setSerialNumber(e.target.value)}/></Grid.Col>
              </Grid>
              <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={3}/>
            </Stack>
          </Paper>

          {/* Location */}
          <Paper withBorder radius="md" p="md">
            <Text fw={600} mb="sm">Location & Assignment</Text>
            <Grid>
              <Grid.Col span={6}><TextInput label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Building / Section"/></Grid.Col>
              <Grid.Col span={6}><TextInput label="Department" value={department} onChange={e => setDepartment(e.target.value)}/></Grid.Col>
              <Grid.Col span={12}><TextInput label="Assigned To" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Person responsible"/></Grid.Col>
            </Grid>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          {/* Purchase Details */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Text fw={600} mb="sm">Purchase Details</Text>
            <Stack gap="sm">
              <Grid>
                <Grid.Col span={6}><DatePickerInput label="Purchase Date" value={purchaseDate} onChange={setPurchaseDate}/></Grid.Col>
                <Grid.Col span={6}><NumberInput label="Purchase Price (₹)" value={purchasePrice} onChange={setPurchasePrice} min={0} decimalScale={2} prefix="₹"/></Grid.Col>
              </Grid>
              <Select
                label="Supplier"
                placeholder="Select supplier..."
                searchable clearable
                data={suppliers.map(s => ({ value: s._id, label: s.name || s.supplierName || '' }))}
                value={supplierId}
                onChange={handleSupplierSelect}
              />
              {!supplierId && (
                <TextInput label="Supplier Name (manual)" value={supplierName} onChange={e => setSupplierName(e.target.value)}/>
              )}
            </Stack>
          </Paper>

          {/* Warranty Link */}
          <Paper withBorder radius="md" p="md">
            <Text fw={600} mb="sm">Warranty (Optional)</Text>
            <Stack gap="sm">
              <Select
                label="Link Warranty"
                placeholder="Search warranty..."
                searchable clearable
                data={warranties.map(w => ({ value: w._id, label: `${w.warrantyNumber} - ${w.itemName}` }))}
                value={warrantyId}
                onChange={handleWarrantySelect}
              />
              <DatePickerInput
                label="Warranty Expiry"
                value={warrantyExpiry}
                onChange={setWarrantyExpiry}
                description="Auto-filled from warranty, or set manually"
              />
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  );
};

export default MachineForm;
