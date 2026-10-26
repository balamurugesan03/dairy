import { useState, useEffect } from 'react';
import {
  Modal, Stack, Box, Text, Radio, Group, Button, Switch, Paper, Table, Badge, Alert, Divider, Loader, Center,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import { farmerSettingsAPI, farmerAPI } from '../../services/api';

/**
 * Producer Management → Settings
 *   • Membership Function (existing)
 *   • Farmer Number Series — Existing Member Series / Center-wise Series (one enabled at a time)
 *
 * Default Centre / Agent is not set here: it comes from the logged-in user (User Management).
 */
export default function FarmerSettingsModal({ opened, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [membershipFunction, setMembershipFunction] = useState('SubmitLinks');
  const [numberSeries, setNumberSeries] = useState('Existing');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    Promise.all([
      farmerSettingsAPI.getSettings().catch(() => ({})),
      farmerAPI.getNumberSeriesPreview().catch(() => ({})),
    ]).then(([s, p]) => {
      const d = s?.data || {};
      setMembershipFunction(d.membershipFunction || 'SubmitLinks');
      setNumberSeries(d.numberSeries || 'Existing');
      setPreview(p?.data || null);
    }).finally(() => setLoading(false));
  }, [opened]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await farmerSettingsAPI.saveSettings({ membershipFunction, numberSeries });
      notifications.show({ title: 'Saved', message: 'Settings saved successfully', color: 'teal' });
      onSaved?.(res?.data);
      onClose();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to save settings', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>Producer Management Settings</Text>} size="lg" centered>
      {loading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : (
        <Stack gap="md">
          {/* ── Farmer Number Series ── */}
          <Box>
            <Text fw={600} mb={4}>Farmer Number Series</Text>
            <Text size="sm" c="dimmed" mb="sm">
              Decides the number given to NEW farmers. Existing farmer / member numbers are never changed.
            </Text>
            <Stack gap="xs">
              <Paper withBorder radius="md" p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Box>
                    <Text fw={600} size="sm">Existing Member Series</Text>
                    <Text size="xs" c="dimmed">
                      One common sequence for all centres: 1, 2, 3 …
                      {preview && <> — next: <b>{preview.nextExisting}</b></>}
                    </Text>
                  </Box>
                  <Switch
                    label="Enable"
                    checked={numberSeries === 'Existing'}
                    onChange={(e) => setNumberSeries(e.currentTarget.checked ? 'Existing' : 'Centre')}
                  />
                </Group>
              </Paper>

              <Paper withBorder radius="md" p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Box>
                    <Text fw={600} size="sm">Center-wise Series</Text>
                    <Text size="xs" c="dimmed">
                      Each centre numbers its own farmers 1, 2, 3 … (C1 → 1, 2 …; C2 → 1, 2 …).
                      The number is generated from the selected Center and cannot be edited.
                    </Text>
                  </Box>
                  <Switch
                    label="Enable"
                    checked={numberSeries === 'Centre'}
                    onChange={(e) => setNumberSeries(e.currentTarget.checked ? 'Centre' : 'Existing')}
                  />
                </Group>

                {numberSeries === 'Centre' && (
                  <Stack gap="xs" mt="sm">
                    <Table withTableBorder withColumnBorders fz="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Center</Table.Th>
                          <Table.Th>Center Code</Table.Th>
                          <Table.Th>Next Farmer No</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(preview?.perCentre || []).map((c) => (
                          <Table.Tr key={c.centreId}>
                            <Table.Td>
                              {c.centerName}
                              {c.centerType === 'Head Office' && <Badge ml={6} variant="light" size="xs">Head Office</Badge>}
                            </Table.Td>
                            <Table.Td>{c.code || '-'}</Table.Td>
                            <Table.Td>{c.next || '-'}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                    <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                      Milk Purchase finds a farmer number within the selected Center. Elsewhere, type the
                      centre code with the number (e.g. C2/15) when the same number exists in two centres.
                    </Alert>
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Box>

          <Divider />

          {/* ── Membership Function ── */}
          <Box>
            <Text fw={600} mb={4}>Membership Function</Text>
            <Text size="sm" c="dimmed" mb="sm">
              Controls what happens when a Non-Member is assigned Membership with a Member Number that differs from
              their existing Farmer Number. The selected option is applied automatically every time.
              {numberSeries === 'Centre' && ' With the Center-wise Series the Farmer Number is always kept.'}
            </Text>
            <Radio.Group value={membershipFunction} onChange={setMembershipFunction}>
              <Stack gap="sm">
                <Radio value="SubmitLinks" label="Submit Links"
                  description="Replace the Farmer Number with the Member Number on save." />
                <Radio value="OpenLinksAndOthers" label="Open Links & Others"
                  description="Keep the existing Farmer Number unchanged; store the Member Number separately." />
              </Stack>
            </Radio.Group>
          </Box>

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Settings</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
