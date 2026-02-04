import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  Title,
  Text,
  Table,
  ActionIcon,
  Badge,
  Divider,
  Paper,
  Card
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPlus,
  IconTrash,
  IconPackageImport,
  IconCalendar,
  IconFileInvoice,
  IconCurrencyRupee,
  IconUser
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { businessStockAPI, businessItemAPI, supplierAPI, ledgerAPI } from '../../services/api';

const BusinessStockInModal = ({ isOpen, onClose, onSuccess, editData }) => {
  const [formData, setFormData] = useState({
    items: [{ itemId: '', quantity: 0, rate: 0, salesRate: 0, freeQty: 0 }],
    purchaseDate: new Date(),
    invoiceDate: null,
    invoiceNumber: '',
    supplierId: '',
    paymentMode: 'Credit',
    paidAmount: 0,
    referenceType: 'Purchase',
    notes: '',
    ledgerEntries: []
  });

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const isEditMode = !!editData;

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      fetchSuppliers();
      fetchLedgers();

      if (editData) {
        setFormData({
          items: [{
            itemId: editData.itemId?._id || editData.itemId || '',
            quantity: editData.quantity || 0,
            rate: editData.rate || 0,
            salesRate: editData.salesRate || editData.itemId?.salesRate || 0,
            freeQty: editData.freeQty || 0
          }],
          purchaseDate: editData.purchaseDate ? new Date(editData.purchaseDate) : new Date(),
          invoiceDate: editData.invoiceDate ? new Date(editData.invoiceDate) : null,
          invoiceNumber: editData.invoiceNumber || '',
          supplierId: editData.supplierId?._id || editData.supplierId || '',
          paymentMode: editData.paymentMode || 'Credit',
          paidAmount: editData.paidAmount || 0,
          referenceType: editData.referenceType || 'Purchase',
          notes: editData.notes || '',
          ledgerEntries: (editData.ledgerEntries || []).map(entry => ({
            ledgerId: entry.ledgerId?._id || entry.ledgerId || '',
            amount: entry.amount || 0,
            narration: entry.narration || ''
          }))
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, editData]);

  const resetForm = () => {
    setFormData({
      items: [{ itemId: '', quantity: 0, rate: 0, salesRate: 0, freeQty: 0 }],
      purchaseDate: new Date(),
      invoiceDate: null,
      invoiceNumber: '',
      supplierId: '',
      paymentMode: 'Credit',
      paidAmount: 0,
      referenceType: 'Purchase',
      notes: '',
      ledgerEntries: []
    });
    setErrors({});
  };

  const fetchItems = async () => {
    try {
      const response = await businessItemAPI.getAll({ status: 'Active', limit: 1000 });
      const itemsData = response.data || [];
      setItems(itemsData.map(item => ({
        value: item._id,
        label: `${item.itemCode} - ${item.itemName}`,
        ...item
      })));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch items',
        color: 'red'
      });
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await supplierAPI.getAll({ status: 'Active', limit: 1000 });
      const suppliersData = response.data || [];
      setSuppliers(suppliersData.map(supplier => ({
        value: supplier._id,
        label: `${supplier.supplierId} - ${supplier.name}`,
        ...supplier
      })));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch suppliers',
        color: 'red'
      });
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await ledgerAPI.getAll({ status: 'Active' });
      const ledgersData = response.data || [];
      setLedgers(ledgersData.map(ledger => ({
        value: ledger._id,
        label: `${ledger.ledgerName} (${ledger.ledgerType})`,
        ...ledger
      })));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch ledgers',
        color: 'red'
      });
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    if (['quantity', 'rate', 'salesRate', 'freeQty'].includes(field)) {
      newItems[index][field] = value === '' || value === undefined || value === null ? 0 : value;
    } else {
      newItems[index][field] = value;
    }

    if (field === 'itemId' && value) {
      const selectedItem = items.find(item => item.value === value);
      if (selectedItem) {
        newItems[index].salesRate = selectedItem.salesRate || 0;
        newItems[index].rate = selectedItem.purchasePrice || 0;
      }
    }

    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { itemId: '', quantity: 0, rate: 0, salesRate: 0, freeQty: 0 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, items: newItems }));
    }
  };

  const addLedgerEntry = () => {
    setFormData(prev => ({
      ...prev,
      ledgerEntries: [...prev.ledgerEntries, { ledgerId: '', amount: 0, narration: '' }]
    }));
  };

  const removeLedgerEntry = (index) => {
    const newLedgerEntries = formData.ledgerEntries.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, ledgerEntries: newLedgerEntries }));
  };

  const handleLedgerEntryChange = (index, field, value) => {
    const newLedgerEntries = [...formData.ledgerEntries];
    if (field === 'amount') {
      newLedgerEntries[index][field] = value === '' || value === undefined || value === null ? 0 : value;
    } else {
      newLedgerEntries[index][field] = value;
    }
    setFormData(prev => ({ ...prev, ledgerEntries: newLedgerEntries }));
  };

  const calculateTotal = () => {
    const grossTotal = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0));
    }, 0);

    const discount = 0;
    const gstAmount = 0;
    const netTotal = grossTotal - discount + gstAmount;

    return { grossTotal, discount, gstAmount, netTotal };
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.items.length === 0) {
      newErrors.items = 'At least one item is required';
    }

    formData.items.forEach((item, index) => {
      if (!item.itemId) {
        newErrors[`item_${index}_itemId`] = 'Item is required';
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = 'Quantity must be greater than 0';
      }
    });

    if (!formData.purchaseDate) {
      newErrors.purchaseDate = 'Purchase date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the errors in the form',
        color: 'red'
      });
      return;
    }

    setLoading(true);

    try {
      const { grossTotal, discount, gstAmount, netTotal } = calculateTotal();

      const submitData = {
        ...formData,
        items: formData.items.map(item => ({
          itemId: item.itemId,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.rate),
          salesRate: parseFloat(item.salesRate || 0),
          purchasePrice: parseFloat(item.rate || 0),
          freeQty: parseFloat(item.freeQty || 0)
        })),
        paidAmount: parseFloat(formData.paidAmount || 0),
        ledgerEntries: formData.ledgerEntries.map(entry => ({
          ledgerId: entry.ledgerId,
          amount: parseFloat(entry.amount || 0),
          narration: entry.narration || ''
        })),
        grossTotal,
        discount,
        gstAmount,
        netTotal
      };

      if (isEditMode) {
        await businessStockAPI.update(editData._id, {
          itemId: formData.items[0].itemId,
          quantity: parseFloat(formData.items[0].quantity),
          rate: parseFloat(formData.items[0].rate),
          salesRate: parseFloat(formData.items[0].salesRate || 0),
          freeQty: parseFloat(formData.items[0].freeQty || 0),
          purchaseDate: formData.purchaseDate,
          invoiceDate: formData.invoiceDate,
          invoiceNumber: formData.invoiceNumber,
          supplierId: formData.supplierId,
          paymentMode: formData.paymentMode,
          paidAmount: parseFloat(formData.paidAmount || 0),
          referenceType: formData.referenceType,
          notes: formData.notes,
          ledgerEntries: formData.ledgerEntries.map(entry => ({
            ledgerId: entry.ledgerId,
            amount: parseFloat(entry.amount || 0),
            narration: entry.narration || ''
          })),
          grossTotal,
          discount,
          gstAmount,
          netTotal
        });

        notifications.show({
          title: 'Success',
          message: 'Transaction updated successfully',
          color: 'green'
        });
      } else {
        await businessStockAPI.stockIn(submitData);

        notifications.show({
          title: 'Success',
          message: 'Business stock added successfully',
          color: 'green'
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || `Failed to ${isEditMode ? 'update' : 'add'} stock`,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const { grossTotal, netTotal } = calculateTotal();

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <IconPackageImport size={24} />
          <div>
            <Title order={4}>{isEditMode ? 'Edit Business Stock In' : 'Business Stock In - Purchase'}</Title>
            <Text size="sm" c="dimmed">
              {isEditMode ? 'Update business stock purchase' : 'Add new business stock purchases'}
            </Text>
          </div>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="md">
        {/* Purchase Details */}
        <Title order={5}>Purchase Details</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label="Purchase Date"
              placeholder="Select purchase date"
              leftSection={<IconCalendar size={16} />}
              value={formData.purchaseDate}
              onChange={(value) => setFormData(prev => ({ ...prev, purchaseDate: value }))}
              error={errors.purchaseDate}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label="Invoice Date"
              placeholder="Select invoice date"
              leftSection={<IconCalendar size={16} />}
              value={formData.invoiceDate}
              onChange={(value) => setFormData(prev => ({ ...prev, invoiceDate: value }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Invoice Number"
              placeholder="Enter invoice number"
              leftSection={<IconFileInvoice size={16} />}
              value={formData.invoiceNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Reference Type"
              data={[
                { value: 'Purchase', label: 'Purchase' },
                { value: 'Return', label: 'Return' },
                { value: 'Opening', label: 'Opening Stock' },
                { value: 'Adjustment', label: 'Adjustment' },
                { value: 'Transfer', label: 'Transfer' }
              ]}
              value={formData.referenceType}
              onChange={(value) => setFormData(prev => ({ ...prev, referenceType: value }))}
            />
          </Grid.Col>
        </Grid>

        <Divider />

        {/* Supplier */}
        <Grid>
          <Grid.Col span={12}>
            <Select
              label="Supplier"
              placeholder="Select supplier"
              leftSection={<IconUser size={16} />}
              data={suppliers}
              value={formData.supplierId}
              onChange={(value) => setFormData(prev => ({ ...prev, supplierId: value }))}
              searchable
              clearable
              error={errors.supplierId}
            />
          </Grid.Col>
        </Grid>

        <Divider />

        {/* Items Section */}
        <div>
          <Group justify="space-between" mb="sm">
            <Title order={5}>Items</Title>
            {!isEditMode && (
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addItem}>
                Add Item
              </Button>
            )}
          </Group>

          <Paper withBorder p="sm">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Item</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Rate</Table.Th>
                  <Table.Th>Free Qty</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  {!isEditMode && <Table.Th>Action</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {formData.items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Select
                        placeholder="Select item"
                        data={items}
                        value={item.itemId}
                        onChange={(value) => handleItemChange(index, 'itemId', value)}
                        searchable
                        error={errors[`item_${index}_itemId`]}
                        style={{ minWidth: 200 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Qty"
                        min={0}
                        value={item.quantity}
                        onChange={(value) => handleItemChange(index, 'quantity', value)}
                        error={errors[`item_${index}_quantity`]}
                        style={{ width: 100 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Rate"
                        min={0}
                        decimalScale={2}
                        value={item.rate}
                        onChange={(value) => handleItemChange(index, 'rate', value)}
                        error={errors[`item_${index}_rate`]}
                        style={{ width: 100 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Free"
                        min={0}
                        value={item.freeQty}
                        onChange={(value) => handleItemChange(index, 'freeQty', value)}
                        style={{ width: 80 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>
                        Rs.{((item.quantity || 0) * (item.rate || 0)).toFixed(2)}
                      </Text>
                    </Table.Td>
                    {!isEditMode && (
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </div>

        <Divider />

        {/* Payment Details */}
        <Title order={5}>Payment Details</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Payment Mode"
              data={[
                { value: 'Credit', label: 'Credit' },
                { value: 'Cash', label: 'Cash' },
                { value: 'Bank', label: 'Bank Transfer' },
                { value: 'UPI', label: 'UPI' },
                { value: 'N/A', label: 'N/A' }
              ]}
              value={formData.paymentMode}
              onChange={(value) => setFormData(prev => ({ ...prev, paymentMode: value }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Paid Amount"
              placeholder="0.00"
              leftSection={<IconCurrencyRupee size={16} />}
              min={0}
              decimalScale={2}
              value={formData.paidAmount}
              onChange={(value) => setFormData(prev => ({ ...prev, paidAmount: value || 0 }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Balance Due"
              value={netTotal - (formData.paidAmount || 0)}
              disabled
              decimalScale={2}
              leftSection={<IconCurrencyRupee size={16} />}
            />
          </Grid.Col>
        </Grid>

        <Divider />

        {/* Notes */}
        <Textarea
          label="Notes"
          placeholder="Additional notes..."
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          minRows={2}
        />

        {/* Bill Summary */}
        <Card withBorder p="md" bg="gray.0">
          <Title order={5} mb="sm">Bill Summary</Title>
          <Grid>
            <Grid.Col span={6}>
              <Text size="sm" c="dimmed">Gross Total:</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm" fw={500} ta="right">Rs.{grossTotal.toFixed(2)}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm" c="dimmed">Paid Amount:</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm" fw={500} ta="right" c="green">Rs.{(formData.paidAmount || 0).toFixed(2)}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm" fw={700}>Net Payable:</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="lg" fw={700} ta="right" c="blue">Rs.{netTotal.toFixed(2)}</Text>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftSection={<IconPackageImport size={16} />}
            onClick={handleSubmit}
            loading={loading}
          >
            {isEditMode ? 'Update Transaction' : 'Add Stock'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default BusinessStockInModal;
