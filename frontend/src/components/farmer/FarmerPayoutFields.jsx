/**
 * Add / Edit Farmer → Bank Details: the parts switched on in Farmer Settings.
 *
 *  • Secondary Bank (settings.secondaryBank): a second account + "Pay to: Primary / Secondary".
 *    Payments and bank transfers use the chosen account.
 *  • Parent Grouping (settings.parentGrouping): link this farmer under a parent farmer.
 *    The child keeps its own milk, bill and dues; its payments go to the PARENT's account.
 *    One level only — a parent can't have a parent, and a farmer with children can't be a child.
 *
 * Works with a @mantine/form `form` whose values have secondaryBankDetails, payTo, parentFarmer.
 */
import { useEffect, useMemo, useState } from 'react';
import { Grid, Select, TextInput, SegmentedControl, Divider, Text, Alert, Badge, Group, Stack } from '@mantine/core';
import { IconInfoCircle, IconUsers } from '@tabler/icons-react';
import { farmerFormAPI } from '../../services/api';

export default function FarmerPayoutFields({ form, settings = {}, bankMasterList = [], farmerId = null, children = [] }) {
  const [farmers, setFarmers] = useState([]);
  useEffect(() => {
    if (!settings.parentGrouping) return;
    farmerFormAPI.getFarmers().then((r) => setFarmers(r?.data || [])).catch(() => {});
  }, [settings.parentGrouping]);

  // Parent candidates: not this farmer, not a child of someone else
  const parentOptions = useMemo(() => farmers
    .filter((f) => String(f._id) !== String(farmerId) && !f.parentFarmer)
    .map((f) => ({
      value: String(f._id),
      label: `${f.centreCode ? `${f.centreCode}/` : ''}${f.farmerNumber || ''} – ${f.name || ''}`,
    })), [farmers, farmerId]);

  if (!settings.secondaryBank && !settings.parentGrouping) return null;

  const v = form.values;
  const sec = v.secondaryBankDetails || {};
  const parent = farmers.find((f) => String(f._id) === String(v.parentFarmer || ''));
  const parentPaysTo = parent && (parent.payTo === 'Secondary' && parent.secAccountNumber
    ? `${parent.secBankName || 'Secondary bank'} · A/c ${parent.secAccountNumber} (Secondary)`
    : (parent.accountNumber ? `${parent.bankName || 'Bank'} · A/c ${parent.accountNumber}` : 'no bank account yet'));

  const pickSecondaryBank = (id) => {
    const b = bankMasterList.find((x) => x._id === id);
    if (!b) {
      ['bankName', 'branch', 'ifsc', 'micr'].forEach((k) => form.setFieldValue(`secondaryBankDetails.${k}`, ''));
      form.setFieldValue('secondaryBankDetails.bankLedgerId', '');
      return;
    }
    form.setFieldValue('secondaryBankDetails.bankName', b.bankName || '');
    form.setFieldValue('secondaryBankDetails.branch', b.branch || '');
    form.setFieldValue('secondaryBankDetails.ifsc', (b.ifsc || '').toUpperCase());
    form.setFieldValue('secondaryBankDetails.micr', b.micr || '');
    form.setFieldValue('secondaryBankDetails.bankLedgerId', b.bankLedgerId?._id || b.bankLedgerId || '');
  };
  const secMasterId = bankMasterList.find((b) => b.bankName === sec.bankName
    && (!sec.ifsc || String(b.ifsc || '').toUpperCase() === String(sec.ifsc).toUpperCase()))?._id || null;

  return (
    <>
      {settings.secondaryBank && (
        <>
          <Grid.Col span={12}><Divider label="Secondary Bank Details" labelPosition="left" mt="xs" /></Grid.Col>
          <Grid.Col span={6}>
            <Select label="Bank Name" placeholder="Select bank" clearable searchable
              data={bankMasterList.map((b) => ({ value: b._id, label: [b.bankName, b.branch].filter(Boolean).join(' · ') }))}
              value={secMasterId} onChange={pickSecondaryBank} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Account Number" placeholder="Enter account number"
              {...form.getInputProps('secondaryBankDetails.accountNumber')}
              onChange={(e) => form.setFieldValue('secondaryBankDetails.accountNumber', e.currentTarget.value.replace(/\s+/g, ''))} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="Branch" {...form.getInputProps('secondaryBankDetails.branch')} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="IFSC Code" maxLength={11} {...form.getInputProps('secondaryBankDetails.ifsc')}
              onChange={(e) => form.setFieldValue('secondaryBankDetails.ifsc', e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="MICR Code" {...form.getInputProps('secondaryBankDetails.micr')} />
          </Grid.Col>
          <Grid.Col span={12}>
            <Text size="sm" fw={500} mb={4}>Pay to</Text>
            <SegmentedControl value={v.payTo || 'Primary'} onChange={(x) => form.setFieldValue('payTo', x)}
              data={[{ value: 'Primary', label: 'Primary bank' }, { value: 'Secondary', label: 'Secondary bank' }]} />
            <Text size="xs" c="dimmed" mt={4}>
              {v.payTo === 'Secondary' && !String(sec.accountNumber || '').trim()
                ? 'No secondary account number yet — payments use the Primary bank until one is entered.'
                : `Payments and bank transfers go to the ${v.payTo === 'Secondary' ? 'Secondary' : 'Primary'} bank account.`}
            </Text>
          </Grid.Col>
        </>
      )}

      {settings.parentGrouping && (
        <>
          <Grid.Col span={12}><Divider label="Parent Grouping" labelPosition="left" mt="xs" /></Grid.Col>
          {children.length > 0 ? (
            <Grid.Col span={12}>
              <Alert variant="light" color="teal" icon={<IconUsers size={16} />} title={`Parent of ${children.length} farmer(s)`}>
                <Stack gap={6}>
                  <Text size="sm">Payments of these farmers go to this farmer&apos;s bank account. A parent cannot itself be linked under another parent.</Text>
                  <Group gap={6}>
                    {children.map((c) => (
                      <Badge key={c._id} variant="light" color={c.status === 'Inactive' ? 'gray' : 'teal'}>
                        {c.farmerNumber} – {c.personalDetails?.name || ''}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              </Alert>
            </Grid.Col>
          ) : (
            <>
              <Grid.Col span={6}>
                <Select label="Parent Farmer" placeholder="None — paid to own account" searchable clearable
                  data={parentOptions} value={v.parentFarmer ? String(v.parentFarmer) : null} limit={100}
                  onChange={(x) => form.setFieldValue('parentFarmer', x || '')}
                  nothingFoundMessage="No farmer found" />
              </Grid.Col>
              <Grid.Col span={6}>
                {parent ? (
                  <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />} py={6}>
                    <Text size="sm">Payments go to <b>{parent.farmerNumber} – {parent.name}</b>: {parentPaysTo}.</Text>
                    <Text size="xs" c="dimmed">This farmer keeps its own milk, bills and dues.</Text>
                  </Alert>
                ) : (
                  <Text size="xs" c="dimmed" mt={28}>Link this farmer under a parent farmer to pay it into the parent&apos;s bank account.</Text>
                )}
              </Grid.Col>
            </>
          )}
        </>
      )}
    </>
  );
}
