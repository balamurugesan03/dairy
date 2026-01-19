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
  Checkbox
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconX,
  IconPackageImport,
  IconCalendar,
  IconFileInvoice,
  IconCurrencyRupee,
  IconUser,
  IconDiscount
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { stockAPI, itemAPI, supplierAPI, subsidyAPI } from '../../services/api';

const StockInModal = ({ isOpen, onClose, onSuccess, editData }) => {
  const [formData, setFormData] = useState({
    items: [{ itemId: '', quantity: 0, rate: 0, freeQty: 0 }],
    purchaseDate: new Date(),
    invoiceDate: null,
    invoiceNumber: '',
    supplierId: '',
    paymentMode: 'Cash',
    paidAmount: 0,
    referenceType: 'Purchase',
    notes: '',
    includeSubsidy: false,
    subsidyId: '',
    subsidyAmount: 0
  });

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const isEditMode = !!editData;

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      fetchSuppliers();
      fetchSubsidies();

      if (editData) {
        // Populate form with edit data
        setFormData({
          items: [{
            itemId: editData.itemId?._id || editData.itemId || '',
            quantity: editData.quantity || 0,
            rate: editData.rate || 0,
            freeQty: editData.freeQty || 0
          }],
          purchaseDate: editData.purchaseDate ? new Date(editData.purchaseDate) : new Date(),
          invoiceDate: editData.invoiceDate ? new Date(editData.invoiceDate) : null,
          invoiceNumber: editData.invoiceNumber || '',
          supplierId: editData.supplierId?._id || editData.supplierId || '',
          paymentMode: editData.paymentMode || 'Cash',
          paidAmount: editData.paidAmount || 0,
          referenceType: editData.referenceType || 'Purchase',
          notes: editData.notes || '',
          includeSubsidy: !!(editData.subsidy?.subsidyId),
          subsidyId: editData.subsidy?.subsidyId || '',
          subsidyAmount: editData.subsidy?.amount || 0
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, editData]);

  const resetForm = () => {
    setFormData({
      items: [{ itemId: '', quantity: 0, rate: 0, freeQty: 0 }],
      purchaseDate: new Date(),
      invoiceDate: null,
      invoiceNumber: '',
      supplierId: '',
      paymentMode: 'Cash',
      paidAmount: 0,
      referenceType: 'Purchase',
      notes: '',
      includeSubsidy: false,
      subsidyId: '',
      subsidyAmount: 0
    });
    setErrors({});
  };

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll({ status: 'Active', limit: 1000 });
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

  const fetchSubsidies = async () => {
    try {
      const response = await subsidyAPI.getAll({ status: 'Active' });
      const subsidiesData = response.data || [];
      setSubsidies(subsidiesData.map(subsidy => ({
        value: subsidy._id,
        label: `${subsidy.subsidyName} (${subsidy.subsidyType})`,
        ...subsidy
      })));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch subsidies',
        color: 'red'
      });
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { itemId: '', quantity: 0, rate: 0, freeQty: 0 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, items: newItems }));
    }
  };

  const calculateTotal = () => {
    const grossTotal = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0));
    }, 0);

    const subsidyAmount = formData.includeSubsidy ? parseFloat(formData.subsidyAmount || 0) : 0;
    const netTotal = grossTotal - subsidyAmount;

    return { grossTotal, subsidyAmount, netTotal };
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
      if (!item.rate || item.rate <= 0) {
        newErrors[`item_${index}_rate`] = 'Rate must be greater than 0';
      }
    });

    if (!formData.purchaseDate) {
      newErrors.purchaseDate = 'Purchase date is required';
    }

    if (formData.paymentMode !== 'N/A' && !formData.supplierId) {
      newErrors.supplierId = 'Supplier is required for payment transactions';
    }

    if (formData.includeSubsidy) {
      if (!formData.subsidyId) {
        newErrors.subsidyId = 'Subsidy type is required';
      }
      if (!formData.subsidyAmount || formData.subsidyAmount <= 0) {
        newErrors.subsidyAmount = 'Subsidy amount must be greater than 0';
      }
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
      const submitData = {
        ...formData,
        items: formData.items.map(item => ({
          itemId: item.itemId,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.rate),
          freeQty: parseFloat(item.freeQty || 0)
        })),
        paidAmount: parseFloat(formData.paidAmount || 0)
      };

      // Include subsidy data if checkbox is checked
      if (formData.includeSubsidy) {
        submitData.subsidy = {
          subsidyId: formData.subsidyId,
          amount: parseFloat(formData.subsidyAmount || 0)
        };
      }

      if (isEditMode) {
        // Update existing transaction
        await stockAPI.update(editData._id, {
          itemId: formData.items[0].itemId,
          quantity: parseFloat(formData.items[0].quantity),
          rate: parseFloat(formData.items[0].rate),
          freeQty: parseFloat(formData.items[0].freeQty || 0),
          purchaseDate: formData.purchaseDate,
          invoiceDate: formData.invoiceDate,
          invoiceNumber: formData.invoiceNumber,
          supplierId: formData.supplierId,
          paymentMode: formData.paymentMode,
          paidAmount: parseFloat(formData.paidAmount || 0),
          referenceType: formData.referenceType,
          notes: formData.notes,
          ...(formData.includeSubsidy && {
            subsidy: {
              subsidyId: formData.subsidyId,
              amount: parseFloat(formData.subsidyAmount || 0)
            }
          })
        });

        notifications.show({
          title: 'Success',
          message: 'Transaction updated successfully',
          color: 'green'
        });
      } else {
        // Create new transaction
        await stockAPI.stockIn(submitData);

        notifications.show({
          title: 'Success',
          message: 'Stock added successfully',
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

  const { grossTotal, subsidyAmount, netTotal } = calculateTotal();

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <IconPackageImport size={24} />
          <div>
            <Title order={4}>{isEditMode ? 'Edit Stock In' : 'Stock In - Purchase'}</Title>
            <Text size="sm" c="dimmed">
              {isEditMode ? 'Update stock purchase transaction' : 'Add new stock purchases to inventory'}
            </Text>
          </div>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="md">
        {/* Items Section */}
        <div>
          <Group justify="space-between" mb="sm">
            <Title order={5}>{isEditMode ? 'Item Details' : 'Items'}</Title>
            {!isEditMode && (
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={addItem}
                variant="light"
              >
                Add Item
              </Button>
            )}
          </Group>

          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Rate (₹)</Table.Th>
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
                      styles={{ root: { minWidth: 200 } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(value) => handleItemChange(index, 'quantity', value)}
                      min={0}
                      decimalScale={2}
                      error={errors[`item_${index}_quantity`]}
                      styles={{ root: { minWidth: 100 } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(value) => handleItemChange(index, 'rate', value)}
                      min={0}
                      decimalScale={2}
                      error={errors[`item_${index}_rate`]}
                      styles={{ root: { minWidth: 100 } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      placeholder="Free"
                      value={item.freeQty}
                      onChange={(value) => handleItemChange(index, 'freeQty', value)}
                      min={0}
                      decimalScale={2}
                      styles={{ root: { minWidth: 80 } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Badge color="blue" variant="light">
                      ₹{(parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)).toFixed(2)}
                    </Badge>
                  </Table.Td>
                  {!isEditMode && (
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="light"
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
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th colSpan={4} style={{ textAlign: 'right' }}>
                  <strong>Gross Total:</strong>
                </Table.Th>
                <Table.Th colSpan={2}>
                  <Badge color="blue" size="lg">
                    ₹{grossTotal.toFixed(2)}
                  </Badge>
                </Table.Th>
              </Table.Tr>
              {formData.includeSubsidy && subsidyAmount > 0 && (
                <>
                  <Table.Tr>
                    <Table.Th colSpan={4} style={{ textAlign: 'right' }}>
                      <strong>Subsidy Amount:</strong>
                    </Table.Th>
                    <Table.Th colSpan={2}>
                      <Badge color="orange" size="lg">
                        - ₹{subsidyAmount.toFixed(2)}
                      </Badge>
                    </Table.Th>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th colSpan={4} style={{ textAlign: 'right' }}>
                      <strong>Net Total:</strong>
                    </Table.Th>
                    <Table.Th colSpan={2}>
                      <Badge color="green" size="lg">
                        ₹{netTotal.toFixed(2)}
                      </Badge>
                    </Table.Th>
                  </Table.Tr>
                </>
              )}
            </Table.Tfoot>
          </Table>
        </div>

        <Divider />

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
                { value: 'Adjustment', label: 'Adjustment' }
              ]}
              value={formData.referenceType}
              onChange={(value) => setFormData(prev => ({ ...prev, referenceType: value }))}
            />
          </Grid.Col>
        </Grid>

        {/* Supplier & Payment Details */}
        <Title order={5} mt="md">Supplier & Payment Details</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Supplier"
              placeholder="Select supplier"
              leftSection={<IconUser size={16} />}
              data={suppliers}
              value={formData.supplierId}
              onChange={(value) => setFormData(prev => ({ ...prev, supplierId: value }))}
              searchable
              error={errors.supplierId}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Payment Mode"
              data={[
                { value: 'Cash', label: 'Cash' },
                { value: 'Adjustment', label: 'Adjustment' },
                { value: 'N/A', label: 'N/A' }
              ]}
              value={formData.paymentMode}
              onChange={(value) => setFormData(prev => ({ ...prev, paymentMode: value }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              label="Paid Amount"
              placeholder="Enter paid amount"
              leftSection={<IconCurrencyRupee size={16} />}
              value={formData.paidAmount}
              onChange={(value) => setFormData(prev => ({ ...prev, paidAmount: value }))}
              min={0}
              decimalScale={2}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Checkbox
              label="Include Subsidy"
              checked={formData.includeSubsidy}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                includeSubsidy: e.target.checked,
                subsidyId: e.target.checked ? prev.subsidyId : '',
                subsidyAmount: e.target.checked ? prev.subsidyAmount : 0
              }))}
            />
          </Grid.Col>
          {formData.includeSubsidy && (
            <>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label="Subsidy Type"
                  placeholder="Select subsidy"
                  leftSection={<IconDiscount size={16} />}
                  data={subsidies}
                  value={formData.subsidyId}
                  onChange={(value) => setFormData(prev => ({ ...prev, subsidyId: value }))}
                  searchable
                  error={errors.subsidyId}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  label="Subsidy Amount"
                  placeholder="Enter subsidy amount"
                  leftSection={<IconCurrencyRupee size={16} />}
                  value={formData.subsidyAmount}
                  onChange={(value) => setFormData(prev => ({ ...prev, subsidyAmount: value }))}
                  min={0}
                  decimalScale={2}
                  error={errors.subsidyAmount}
                  required
                />
              </Grid.Col>
            </>
          )}
          <Grid.Col span={12}>
            <Textarea
              label="Notes"
              placeholder="Enter any additional notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            leftSection={<IconX size={16} />}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={handleSubmit}
            loading={loading}
          >
            {isEditMode ? 'Update Stock' : 'Add Stock'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default StockInModal;
