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
  Box,
  Popover,
  Card,
  ThemeIcon
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
  IconDiscount,
  IconBook,
  IconNotes,
  IconInfoCircle,
  IconTag
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { stockAPI, itemAPI, supplierAPI, subsidyAPI, ledgerAPI } from '../../services/api';

const StockInModal = ({ isOpen, onClose, onSuccess, editData }) => {
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
    subsidies: [],
    ledgerEntries: []
  });

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedItemInfo, setSelectedItemInfo] = useState({});
  const [pricePopoverOpened, setPricePopoverOpened] = useState({});

  const isEditMode = !!editData;

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      fetchSuppliers();
      fetchSubsidies();
      fetchLedgers();

      if (editData) {
        const existingSubsidies = editData.subsidies || [];
        if (!existingSubsidies.length && editData.subsidy?.subsidyId) {
          existingSubsidies.push({
            subsidyId: editData.subsidy.subsidyId,
            productId: editData.subsidy.productId || '',
            amount: editData.subsidy.amount || 0
          });
        }
        const existingLedgerEntries = editData.ledgerEntries || [];
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
          subsidies: existingSubsidies,
          ledgerEntries: existingLedgerEntries.map(entry => ({
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
      subsidies: [],
      ledgerEntries: []
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

  const fetchLedgers = async () => {
    try {
      const response = await ledgerAPI.getAll({ status: 'Active' });
      const ledgersData = response.data || [];
      setLedgers(ledgersData.map(ledger => ({
        value: ledger._id,
        label: `${ledger.ledgerName} (${ledger.ledgerType})`,
        ledgerType: ledger.ledgerType,
        currentBalance: ledger.currentBalance,
        balanceType: ledger.balanceType,
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
    // For numeric fields, ensure value is a number (default to 0 if empty/undefined)
    if (['quantity', 'rate', 'salesRate', 'freeQty'].includes(field)) {
      newItems[index][field] = value === '' || value === undefined || value === null ? 0 : value;
    } else {
      newItems[index][field] = value;
    }

    // When item is selected, auto-fill salesRate and show price info
    if (field === 'itemId' && value) {
      const selectedItem = items.find(item => item.value === value);
      if (selectedItem) {
        // Auto-fill the salesRate from item master
        newItems[index].salesRate = selectedItem.salesRate || 0;

        // Store selected item info for displaying in popover
        setSelectedItemInfo(prev => ({
          ...prev,
          [index]: {
            itemName: selectedItem.itemName,
            salesRate: selectedItem.salesRate || 0,
            currentBalance: selectedItem.currentBalance || 0,
            unit: selectedItem.measurement || selectedItem.unit || ''
          }
        }));

        // Open the price popover for this index
        setPricePopoverOpened(prev => ({ ...prev, [index]: true }));

        // Auto-close the popover after 3 seconds
        setTimeout(() => {
          setPricePopoverOpened(prev => ({ ...prev, [index]: false }));
        }, 3000);
      }
    }

    // Clear item info when item is deselected
    if (field === 'itemId' && !value) {
      newItems[index].salesRate = 0;
      setSelectedItemInfo(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
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

  // Subsidy handlers
  const addSubsidy = () => {
    setFormData(prev => ({
      ...prev,
      subsidies: [...prev.subsidies, { subsidyId: '', productId: '', amount: 0 }]
    }));
  };

  const removeSubsidy = (index) => {
    const newSubsidies = formData.subsidies.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, subsidies: newSubsidies }));
  };

  const handleSubsidyChange = (index, field, value) => {
    const newSubsidies = [...formData.subsidies];
    // For amount field, ensure value is a number (default to 0 if empty/undefined)
    if (field === 'amount') {
      newSubsidies[index][field] = value === '' || value === undefined || value === null ? 0 : value;
    } else {
      newSubsidies[index][field] = value;
    }
    setFormData(prev => ({ ...prev, subsidies: newSubsidies }));
  };

  // Ledger Entry handlers
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
    // For amount field, ensure value is a number (default to 0 if empty/undefined)
    if (field === 'amount') {
      newLedgerEntries[index][field] = value === '' || value === undefined || value === null ? 0 : value;
    } else {
      newLedgerEntries[index][field] = value;
    }
    setFormData(prev => ({ ...prev, ledgerEntries: newLedgerEntries }));
  };

  // Calculate total ledger entry amount (amount * total quantity)
  const calculateLedgerTotal = () => {
    const totalQuantity = formData.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    return formData.ledgerEntries.reduce((sum, entry) => {
      return sum + (parseFloat(entry.amount || 0) * totalQuantity);
    }, 0);
  };

  // Calculate total subsidy amount
  const calculateSubsidyTotal = () => {
    return formData.subsidies.reduce((sum, subsidy) => {
      return sum + parseFloat(subsidy.amount || 0);
    }, 0);
  };

  // Get product options from items in the purchase
  const getProductOptionsForSubsidy = () => {
    return formData.items
      .filter(item => item.itemId)
      .map(item => {
        const itemData = items.find(i => i.value === item.itemId);
        const salesRate = item.salesRate || itemData?.salesRate || 0;
        return {
          value: item.itemId,
          label: itemData?.label || item.itemId,
          itemAmount: parseFloat(item.quantity || 0) * parseFloat(salesRate)
        };
      });
  };

  const calculateTotal = () => {
    // Calculate gross total using Sales Rate (not purchase rate)
    const grossTotal = formData.items.reduce((sum, item, index) => {
      const salesRate = item.salesRate || selectedItemInfo[index]?.salesRate || 0;
      return sum + (parseFloat(item.quantity || 0) * parseFloat(salesRate));
    }, 0);

    const subsidyAmount = calculateSubsidyTotal();
    const ledgerDeduction = calculateLedgerTotal();

    // Net Total = Gross Total - Ledger Deduction (Subsidy is NOT subtracted)
    const netTotal = grossTotal - ledgerDeduction;

    return { grossTotal, subsidyAmount, ledgerDeduction, netTotal };
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

    if (formData.paymentMode !== 'N/A' && formData.paymentMode !== 'Credit' && !formData.supplierId) {
      newErrors.supplierId = 'Supplier is required for payment transactions';
    }

    formData.subsidies.forEach((subsidy, index) => {
      if (!subsidy.subsidyId) {
        newErrors[`subsidy_${index}_subsidyId`] = 'Subsidy type is required';
      }
      if (!subsidy.productId) {
        newErrors[`subsidy_${index}_productId`] = 'Product is required';
      }
      if (!subsidy.amount || subsidy.amount <= 0) {
        newErrors[`subsidy_${index}_amount`] = 'Amount must be greater than 0';
      }
    });

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
      const { grossTotal, subsidyAmount, ledgerDeduction, netTotal } = calculateTotal();

      const submitData = {
        ...formData,
        items: formData.items.map(item => ({
          itemId: item.itemId,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.rate),
          salesRate: parseFloat(item.salesRate || 0),
          freeQty: parseFloat(item.freeQty || 0)
        })),
        paidAmount: parseFloat(formData.paidAmount || 0),
        subsidies: formData.subsidies.map(subsidy => ({
          subsidyId: subsidy.subsidyId,
          productId: subsidy.productId,
          amount: parseFloat(subsidy.amount || 0)
        })),
        ledgerEntries: formData.ledgerEntries.map(entry => ({
          ledgerId: entry.ledgerId,
          amount: parseFloat(entry.amount || 0),
          narration: entry.narration || ''
        })),
        grossTotal,
        subsidyAmount,
        ledgerDeduction,
        netTotal
      };

      if (isEditMode) {
        await stockAPI.update(editData._id, {
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
          subsidies: formData.subsidies.map(subsidy => ({
            subsidyId: subsidy.subsidyId,
            productId: subsidy.productId,
            amount: parseFloat(subsidy.amount || 0)
          })),
          ledgerEntries: formData.ledgerEntries.map(entry => ({
            ledgerId: entry.ledgerId,
            amount: parseFloat(entry.amount || 0),
            narration: entry.narration || ''
          })),
          grossTotal,
          subsidyAmount,
          ledgerDeduction,
          netTotal
        });

        notifications.show({
          title: 'Success',
          message: 'Transaction updated successfully',
          color: 'green'
        });
      } else {
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

  const { grossTotal, subsidyAmount, ledgerDeduction, netTotal } = calculateTotal();

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
        {/* 1. Purchase Details */}
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

        <Divider />

      
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

        {/* 3. Add Items Section */}
        <div>
          <Group justify="space-between" mb="sm">
            <Title order={5}>{isEditMode ? 'Item Details' : 'Add Items'}</Title>
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
                <Table.Th>Purchase Rate (Rs.)</Table.Th>
                <Table.Th>Sales Rate (Rs.)</Table.Th>
                <Table.Th>Free Qty</Table.Th>
                <Table.Th>Amount (Sales)</Table.Th>
                {!isEditMode && <Table.Th>Action</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {formData.items.map((item, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Select
                        placeholder="Select item"
                        data={items}
                        value={item.itemId}
                        onChange={(value) => handleItemChange(index, 'itemId', value)}
                        searchable
                        error={errors[`item_${index}_itemId`]}
                        styles={{ root: { minWidth: 180 } }}
                      />
                      {item.itemId && selectedItemInfo[index] && (
                        <Popover
                          opened={pricePopoverOpened[index]}
                          onChange={(opened) => setPricePopoverOpened(prev => ({ ...prev, [index]: opened }))}
                          position="right"
                          withArrow
                          shadow="md"
                        >
                          <Popover.Target>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => setPricePopoverOpened(prev => ({ ...prev, [index]: !prev[index] }))}
                            >
                              <IconInfoCircle size={16} />
                            </ActionIcon>
                          </Popover.Target>
                          <Popover.Dropdown>
                            <Card p="xs" withBorder={false}>
                              <Stack gap={4}>
                                <Text size="xs" fw={600} c="dimmed">
                                  {selectedItemInfo[index]?.itemName}
                                </Text>
                                <Divider />
                                <Group gap="xs">
                                  <ThemeIcon size="xs" variant="light" color="green">
                                    <IconTag size={10} />
                                  </ThemeIcon>
                                  <Text size="xs">
                                    Sales Rate: <Text span fw={600} c="green">Rs.{selectedItemInfo[index]?.salesRate}</Text>
                                  </Text>
                                </Group>
                                <Group gap="xs">
                                  <ThemeIcon size="xs" variant="light" color="orange">
                                    <IconCurrencyRupee size={10} />
                                  </ThemeIcon>
                                  <Text size="xs">
                                    Purchase Rate: <Text span fw={600} c="orange">{item.rate ? `Rs.${item.rate}` : 'Not set'}</Text>
                                  </Text>
                                </Group>
                                <Group gap="xs">
                                  <ThemeIcon size="xs" variant="light" color="blue">
                                    <IconCurrencyRupee size={10} />
                                  </ThemeIcon>
                                  <Text size="xs">
                                    Stock: <Text span fw={600}>{selectedItemInfo[index]?.currentBalance} {selectedItemInfo[index]?.unit}</Text>
                                  </Text>
                                </Group>
                              </Stack>
                            </Card>
                          </Popover.Dropdown>
                        </Popover>
                      )}
                    </Group>
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
                      placeholder="Purchase Rate"
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
                      placeholder="Sales Rate"
                      value={item.salesRate || selectedItemInfo[index]?.salesRate || 0}
                      onChange={(value) => handleItemChange(index, 'salesRate', value)}
                      min={0}
                      decimalScale={2}
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
                      Rs.{(parseFloat(item.quantity || 0) * parseFloat(item.salesRate || selectedItemInfo[index]?.salesRate || 0)).toFixed(2)}
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
          </Table>
        </div>

        <Divider />

        {/* 4. Subsidies Section */}
       

        <Divider />

        {/* 5. Ledger Entries Section */}
        <div>
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconBook size={20} />
              <Title order={5}>Ledger Deduction</Title>
              {formData.ledgerEntries.length > 0 && (
                <Badge color="red" variant="light" size="sm">
                  {formData.ledgerEntries.length} Entries | Rs.{calculateLedgerTotal().toFixed(2)}
                </Badge>
              )}
            </Group>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={addLedgerEntry}
              variant="light"
              color="blue"
            >
              Add Ledger
            </Button>
          </Group>

          {formData.ledgerEntries.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="md">
              Click "Add Ledger" to add ledger deductions
            </Text>
          )}

          {formData.ledgerEntries.length > 0 && (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ledger Account</Table.Th>
                  <Table.Th>Amount (Rs.)</Table.Th>
                  <Table.Th>Narration</Table.Th>
                  <Table.Th>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {formData.ledgerEntries.map((entry, index) => {
                  const selectedLedger = ledgers.find(l => l.value === entry.ledgerId);
                  return (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Select
                          placeholder="Select ledger"
                          data={ledgers}
                          value={entry.ledgerId}
                          onChange={(value) => handleLedgerEntryChange(index, 'ledgerId', value)}
                          searchable
                          error={errors[`ledger_${index}_ledgerId`]}
                          styles={{ root: { minWidth: 220 } }}
                        />
                        {selectedLedger && (
                          <Text size="xs" c="dimmed" mt={4}>
                            Balance: Rs.{selectedLedger.currentBalance?.toFixed(2) || '0.00'} ({selectedLedger.balanceType})
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="Amount"
                          value={entry.amount}
                          onChange={(value) => handleLedgerEntryChange(index, 'amount', value)}
                          min={0}
                          decimalScale={2}
                          error={errors[`ledger_${index}_amount`]}
                          styles={{ root: { minWidth: 120 } }}
                          leftSection={<IconCurrencyRupee size={14} />}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="Narration (optional)"
                          value={entry.narration}
                          onChange={(e) => handleLedgerEntryChange(index, 'narration', e.target.value)}
                          styles={{ root: { minWidth: 150 } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => removeLedgerEntry(index)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </div>

        <Divider />

        {/* 6. Notes Section */}
       

        <Divider />

        {/* 7. Summary Section - Below Notes */}
        <Paper p="md" withBorder bg="gray.0">
          <Title order={5} mb="sm">Bill Summary</Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Gross Total:</Text>
              <Text fw={600} size="lg">Rs.{grossTotal.toFixed(2)}</Text>
            </Group>
            {/* {subsidyAmount > 0 && (
              <Group justify="space-between">
                <Text fw={500} c="green">Subsidy Amount:</Text>
                <Text fw={600} c="green">Rs.{subsidyAmount.toFixed(2)}</Text>
              </Group>
            )} */}
            {ledgerDeduction > 0 && (
              <Group justify="space-between">
                <Text fw={500} c="red">Ledger Deduction:</Text>
                <Text fw={600} c="red">- Rs.{ledgerDeduction.toFixed(2)}</Text>
              </Group>
            )}
            <Divider />
            <Group justify="space-between">
              <Text fw={700} size="lg">Total:</Text>
              <Text fw={700} size="lg" c="blue">Rs.{netTotal.toFixed(2)}</Text>
            </Group>
          </Stack>
        </Paper>

        <Divider />
         <div>
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconDiscount size={20} />
              <Title order={5}>Subsidy</Title>
              {formData.subsidies.length > 0 && (
                <Badge color="green" variant="light" size="sm">
                  {formData.subsidies.length} Applied
                </Badge>
              )}
            </Group>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={addSubsidy}
              variant="light"
              color="green"
              disabled={getProductOptionsForSubsidy().length === 0}
            >
              Add Subsidy
            </Button>
          </Group>

          {getProductOptionsForSubsidy().length === 0 && formData.subsidies.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="md">
              Select products above to add subsidies
            </Text>
          )}

          {formData.subsidies.length > 0 && (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Subsidy Type</Table.Th>
                  <Table.Th>Amount (Rs.)</Table.Th>
                  <Table.Th>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {formData.subsidies.map((subsidy, index) => {
                  const productOptions = getProductOptionsForSubsidy();
                  const selectedProduct = productOptions.find(p => p.value === subsidy.productId);
                  return (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Select
                          placeholder="Select product"
                          data={productOptions}
                          value={subsidy.productId}
                          onChange={(value) => handleSubsidyChange(index, 'productId', value)}
                          searchable
                          error={errors[`subsidy_${index}_productId`]}
                          styles={{ root: { minWidth: 180 } }}
                        />
                        {selectedProduct && (
                          <Text size="xs" c="dimmed" mt={4}>
                            Product Amount: Rs.{selectedProduct.itemAmount.toFixed(2)}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Select
                          placeholder="Select subsidy"
                          data={subsidies}
                          value={subsidy.subsidyId}
                          onChange={(value) => handleSubsidyChange(index, 'subsidyId', value)}
                          searchable
                          error={errors[`subsidy_${index}_subsidyId`]}
                          styles={{ root: { minWidth: 180 } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="Amount"
                          value={subsidy.amount}
                          onChange={(value) => handleSubsidyChange(index, 'amount', value)}
                          min={0}
                          decimalScale={2}
                          error={errors[`subsidy_${index}_amount`]}
                          styles={{ root: { minWidth: 120 } }}
                          leftSection={<IconCurrencyRupee size={14} />}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => removeSubsidy(index)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </div>

        {/* 8. Payment Mode & Paid Amount */}
        <Title order={5}>Payment Details</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Payment Mode"
              data={[
                { value: 'Credit', label: 'Credit' },
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
              onChange={(value) => setFormData(prev => ({ ...prev, paidAmount: value === '' || value === undefined || value === null ? 0 : value }))}
              min={0}
              decimalScale={2}
            />
          </Grid.Col>
        </Grid>
         <Group gap="xs" mb="sm">
            <IconNotes size={20} />
            <Title order={5}>Notes</Title>
          </Group>
           <div>
         
          <Textarea
            placeholder="Enter any additional notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={2}
          />
        </div>

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
            {isEditMode ? 'Update Stock' : 'Save Stock'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default StockInModal;
