/**
 * Business Journal Voucher - For Private Firm
 * Adjustment/Journal entries with separate data
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Table,
  ActionIcon,
  Alert,
  ThemeIcon,
  Grid,
  Divider,
  Badge
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconCurrencyRupee,
  IconFileText,
  IconCalendar,
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconArrowsExchange
} from '@tabler/icons-react';
import { businessLedgerAPI, businessVoucherAPI } from '../../services/api';

const BusinessJournalVoucher = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState([]);

  const form = useForm({
    initialValues: {
      date: new Date(),
      narration: '',
      entries: [
        { ledgerId: '', type: 'debit', amount: '', description: '' },
        { ledgerId: '', type: 'credit', amount: '', description: '' }
      ]
    }
  });

  useEffect(() => {
    fetchLedgers();
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await businessLedgerAPI.getAll();
      const allLedgers = Array.isArray(response) ? response : response?.data || [];
      setLedgers(allLedgers.filter(l => l.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch ledgers',
        color: 'red'
      });
    }
  };

  const addEntry = () => {
    form.insertListItem('entries', { ledgerId: '', type: 'debit', amount: '', description: '' });
  };

  const removeEntry = (index) => {
    if (form.values.entries.length > 2) {
      form.removeListItem('entries', index);
    }
  };

  const calculateTotals = () => {
    let debitTotal = 0;
    let creditTotal = 0;

    form.values.entries.forEach(entry => {
      const amount = parseFloat(entry.amount) || 0;
      if (entry.type === 'debit') {
        debitTotal += amount;
      } else {
        creditTotal += amount;
      }
    });

    return { debitTotal, creditTotal, difference: Math.abs(debitTotal - creditTotal) };
  };

  const handleSubmit = async (values) => {
    const { debitTotal, creditTotal, difference } = calculateTotals();

    if (debitTotal <= 0 || creditTotal <= 0) {
      notifications.show({
        title: 'Error',
        message: 'Both debit and credit entries are required',
        color: 'red'
      });
      return;
    }

    if (difference > 0.01) {
      notifications.show({
        title: 'Error',
        message: 'Debit and Credit totals must be equal',
        color: 'red'
      });
      return;
    }

    // Validate all entries have ledger and amount
    const validEntries = values.entries.filter(e => e.ledgerId && parseFloat(e.amount) > 0);
    if (validEntries.length < 2) {
      notifications.show({
        title: 'Error',
        message: 'At least two entries are required',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const voucherEntries = validEntries.map(entry => ({
        ledgerId: entry.ledgerId,
        type: entry.type,
        amount: parseFloat(entry.amount),
        description: entry.description
      }));

      const payload = {
        voucherType: 'Journal',
        date: values.date,
        entries: voucherEntries,
        narration: values.narration
      };

      await businessVoucherAPI.createJournal(payload);

      notifications.show({
        title: 'Success',
        message: 'Journal voucher created successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      // Reset form
      form.reset();
      form.setFieldValue('date', new Date());
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create journal voucher',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const ledgerOptions = ledgers.map(l => ({
    value: l._id,
    label: `${l.code} - ${l.name}`
  }));

  const { debitTotal, creditTotal, difference } = calculateTotals();
  const isBalanced = difference < 0.01;

  return (
    <Container size="lg" py="md">
      {/* Header */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color="violet">
              <IconArrowsExchange size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Adjustment / Journal Voucher</Title>
              <Text size="sm" c="dimmed">Record adjustments and journal entries</Text>
            </div>
          </Group>
          <Button
            variant="light"
            onClick={() => navigate('/business-accounting/vouchers')}
          >
            View All Vouchers
          </Button>
        </Group>
      </Paper>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            {/* Basic Details */}
            <Grid gutter="md">
              <Grid.Col span={6}>
                <DateInput
                  label="Date"
                  placeholder="Select date"
                  required
                  leftSection={<IconCalendar size={16} />}
                  maxDate={new Date()}
                  {...form.getInputProps('date')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Group justify="flex-end" h="100%" align="flex-end">
                  <Badge
                    size="lg"
                    color={isBalanced ? 'green' : 'red'}
                    variant="light"
                  >
                    {isBalanced ? 'Balanced' : `Difference: ₹${difference.toFixed(2)}`}
                  </Badge>
                </Group>
              </Grid.Col>
            </Grid>

            <Divider label="Journal Entries" labelPosition="center" />

            {/* Journal Entries Table */}
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: '35%' }}>Account</Table.Th>
                  <Table.Th style={{ width: '15%' }}>Type</Table.Th>
                  <Table.Th style={{ width: '20%' }}>Amount</Table.Th>
                  <Table.Th style={{ width: '25%' }}>Description</Table.Th>
                  <Table.Th style={{ width: '5%' }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {form.values.entries.map((entry, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Select
                        placeholder="Select account"
                        data={ledgerOptions}
                        searchable
                        {...form.getInputProps(`entries.${index}.ledgerId`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        data={[
                          { value: 'debit', label: 'Debit (Dr)' },
                          { value: 'credit', label: 'Credit (Cr)' }
                        ]}
                        {...form.getInputProps(`entries.${index}.type`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="0.00"
                        min={0}
                        decimalScale={2}
                        leftSection={<IconCurrencyRupee size={14} />}
                        {...form.getInputProps(`entries.${index}.amount`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        placeholder="Description"
                        {...form.getInputProps(`entries.${index}.description`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => removeEntry(index)}
                        disabled={form.values.entries.length <= 2}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={addEntry}
              w="fit-content"
            >
              Add Row
            </Button>

            {/* Totals */}
            <Grid>
              <Grid.Col span={6}>
                <Paper withBorder p="md" bg="blue.0" radius="md">
                  <Group justify="space-between">
                    <Text fw={600}>Total Debit</Text>
                    <Text fw={700} size="lg" c="blue">
                      ₹ {debitTotal.toFixed(2)}
                    </Text>
                  </Group>
                </Paper>
              </Grid.Col>
              <Grid.Col span={6}>
                <Paper withBorder p="md" bg="orange.0" radius="md">
                  <Group justify="space-between">
                    <Text fw={600}>Total Credit</Text>
                    <Text fw={700} size="lg" c="orange">
                      ₹ {creditTotal.toFixed(2)}
                    </Text>
                  </Group>
                </Paper>
              </Grid.Col>
            </Grid>

            {!isBalanced && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                Debit and Credit totals must be equal. Current difference: ₹{difference.toFixed(2)}
              </Alert>
            )}

            {/* Narration */}
            <Textarea
              label="Narration"
              placeholder="Enter narration/remarks"
              rows={2}
              required
              {...form.getInputProps('narration')}
            />

            {/* Submit Button */}
            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => {
                  form.reset();
                  form.setFieldValue('date', new Date());
                }}
              >
                Clear
              </Button>
              <Button
                type="submit"
                loading={loading}
                leftSection={<IconDeviceFloppy size={16} />}
                color="violet"
                disabled={!isBalanced}
              >
                Save Journal Voucher
              </Button>
            </Group>
          </Stack>
        </Paper>
      </form>
    </Container>
  );
};

export default BusinessJournalVoucher;
