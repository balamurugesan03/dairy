import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Stack, Paper, Grid, TextInput,
  Select, Textarea, NumberInput, ActionIcon, Loader, Center, Box
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { warrantyAPI, customerAPI, businessItemAPI } from '../../services/api';
import dayjs from 'dayjs';

const WarrantyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);

  const [itemName, setItemName] = useState('');
  const [itemId, setItemId] = useState('');
  const [category, setCategory] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [saleDate, setSaleDate] = useState(null);
  const [warrantyStartDate, setWarrantyStartDate] = useState(new Date());
  const [warrantyPeriod, setWarrantyPeriod] = useState(12);
  const [warrantyEndDate, setWarrantyEndDate] = useState(null);
  const [warrantyType, setWarrantyType] = useState('Dealer');
  const [status, setStatus] = useState('Active');
  const [description, setDescription] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');

  useEffect(() => {
    loadMasterData();
    if (isEdit) loadWarranty();
  }, [id]);

  // Auto-compute end date
  useEffect(() => {
    if (warrantyStartDate && warrantyPeriod) {
      const d = new Date(warrantyStartDate);
      d.setMonth(d.getMonth() + Number(warrantyPeriod));
      setWarrantyEndDate(d);
    }
  }, [warrantyStartDate, warrantyPeriod]);

  const loadMasterData = async () => {
    try {
      const [custRes, itemRes] = await Promise.all([
        customerAPI.getAll({ limit: 500 }),
        businessItemAPI.getAll({ limit: 500, status: 'Active' })
      ]);
      setCustomers(Array.isArray(custRes?.data) ? custRes.data : custRes?.data?.data || []);
      setItems(Array.isArray(itemRes?.data) ? itemRes.data : itemRes?.data?.data || []);
    } catch { /* silent */ }
  };

  const loadWarranty = async () => {
    setLoading(true);
    try {
      const res = await warrantyAPI.getById(id);
      const w = res?.data || res;
      setItemName(w.itemName || '');
      setItemId(w.itemId?._id || w.itemId || '');
      setCategory(w.category || '');
      setSerialNumber(w.serialNumber || '');
      setBatchNumber(w.batchNumber || '');
      setCustomerId(w.customerId?._id || w.customerId || '');
      setCustomerName(w.customerName || '');
      setCustomerPhone(w.customerPhone || '');
      setCustomerEmail(w.customerEmail || '');
      setInvoiceNumber(w.invoiceNumber || '');
      setSaleDate(w.saleDate ? new Date(w.saleDate) : null);
      setWarrantyStartDate(w.warrantyStartDate ? new Date(w.warrantyStartDate) : new Date());
      setWarrantyPeriod(w.warrantyPeriod || 12);
      setWarrantyEndDate(w.warrantyEndDate ? new Date(w.warrantyEndDate) : null);
      setWarrantyType(w.warrantyType || 'Dealer');
      setStatus(w.status || 'Active');
      setDescription(w.description || '');
      setTermsAndConditions(w.termsAndConditions || '');
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (val) => {
    setItemId(val || '');
    const item = items.find(i => i._id === val);
    if (item) {
      setItemName(item.itemName);
      setCategory(item.category || '');
    }
  };

  const handleCustomerSelect = (val) => {
    setCustomerId(val || '');
    const cust = customers.find(c => c._id === val);
    if (cust) {
      setCustomerName(cust.name || cust.customerName || '');
      setCustomerPhone(cust.phone || cust.mobileNumber || '');
      setCustomerEmail(cust.email || '');
    }
  };

  const handleSave = async () => {
    if (!itemName) { notifications.show({ title: 'Validation', message: 'Item name required', color: 'yellow' }); return; }
    setSaving(true);
    try {
      const payload = {
        itemId: itemId || undefined, itemName, category, serialNumber, batchNumber,
        customerId: customerId || undefined, customerName, customerPhone, customerEmail,
        invoiceNumber, saleDate, warrantyStartDate, warrantyPeriod,
        warrantyEndDate, warrantyType, status, description, termsAndConditions
      };
      if (isEdit) {
        await warrantyAPI.update(id, payload);
        notifications.show({ title: 'Updated', message: 'Warranty updated', color: 'green' });
      } else {
        await warrantyAPI.create(payload);
        notifications.show({ title: 'Created', message: 'Warranty created', color: 'green' });
      }
      navigate('/warranty');
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
          <ActionIcon variant="subtle" onClick={() => navigate('/warranty')}><IconArrowLeft size={18}/></ActionIcon>
          <Box>
            <Title order={2} fw={700}>{isEdit ? 'Edit Warranty' : 'Add Warranty'}</Title>
            <Text size="sm" c="dimmed">Track product warranty for a customer</Text>
          </Box>
        </Group>
        <Group>
          <Button variant="default" onClick={() => navigate('/warranty')}>Cancel</Button>
          <Button leftSection={<IconDeviceFloppy size={16}/>} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save Warranty'}
          </Button>
        </Group>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          {/* Item Details */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Text fw={600} mb="sm">Item Details</Text>
            <Stack gap="sm">
              <Select label="Select Item" placeholder="Search item..." searchable clearable
                data={items.map(i => ({ value: i._id, label: i.itemName }))}
                value={itemId} onChange={handleItemSelect}/>
              <TextInput label="Item Name" value={itemName} onChange={e => setItemName(e.target.value)} required placeholder="Auto-filled or enter manually"/>
              <Grid>
                <Grid.Col span={6}><TextInput label="Category" value={category} onChange={e => setCategory(e.target.value)}/></Grid.Col>
                <Grid.Col span={6}><TextInput label="Serial Number" value={serialNumber} onChange={e => setSerialNumber(e.target.value)}/></Grid.Col>
                <Grid.Col span={6}><TextInput label="Batch Number" value={batchNumber} onChange={e => setBatchNumber(e.target.value)}/></Grid.Col>
              </Grid>
            </Stack>
          </Paper>

          {/* Customer */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Text fw={600} mb="sm">Customer Details</Text>
            <Stack gap="sm">
              <Select label="Select Customer" placeholder="Search customer..." searchable clearable
                data={customers.map(c => ({ value: c._id, label: c.name || c.customerName || '' }))}
                value={customerId} onChange={handleCustomerSelect}/>
              <TextInput label="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)}/>
              <Grid>
                <Grid.Col span={6}><TextInput label="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}/></Grid.Col>
                <Grid.Col span={6}><TextInput label="Email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}/></Grid.Col>
              </Grid>
              <Grid>
                <Grid.Col span={6}><TextInput label="Invoice Number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}/></Grid.Col>
                <Grid.Col span={6}><DatePickerInput label="Sale Date" value={saleDate} onChange={setSaleDate} clearable/></Grid.Col>
              </Grid>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          {/* Warranty Period */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Text fw={600} mb="sm">Warranty Period</Text>
            <Stack gap="sm">
              <Grid>
                <Grid.Col span={6}><Select label="Warranty Type" value={warrantyType} onChange={setWarrantyType} data={['Manufacturer', 'Dealer', 'Extended']}/></Grid.Col>
                <Grid.Col span={6}><Select label="Status" value={status} onChange={setStatus} data={['Active', 'Expired', 'Claimed', 'Void']}/></Grid.Col>
              </Grid>
              <DatePickerInput label="Warranty Start Date" value={warrantyStartDate} onChange={setWarrantyStartDate} required/>
              <NumberInput label="Warranty Period (months)" value={warrantyPeriod} onChange={setWarrantyPeriod} min={1} max={120}/>
              <DatePickerInput label="Warranty End Date (auto)" value={warrantyEndDate} onChange={setWarrantyEndDate}/>
            </Stack>
          </Paper>

          {/* Notes */}
          <Paper withBorder radius="md" p="md">
            <Text fw={600} mb="sm">Additional Info</Text>
            <Stack gap="sm">
              <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={3}/>
              <Textarea label="Terms & Conditions" value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} rows={3}/>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  );
};

export default WarrantyForm;
