import { useState, useEffect, useCallback } from 'react';
import {
  Modal, Stack, Box, Text, Radio, Group, Button, Switch, Paper, Select, Table, Badge, Alert, Divider, Loader, Center,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { farmerSettingsAPI, farmerAPI, collectionCenterAPI, agentAPI } from '../../services/api';
import { clearDefaultCentreAgentCache } from '../../utils/defaultCentreAgent';

/**
 * Producer Management → Settings
 *   • Membership Function (existing)
 *   • Farmer Number Series — Existing Member Series / Center-wise Series (one enabled at a time)
 *   • Default Centre & Agent preselected on entry forms for admin logins
 */
export default function FarmerSettingsModal({ opened, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [membershipFunction, setMembershipFunction] = useState('SubmitLinks');
  const [numberSeries, setNumberSeries] = useState('Existing');
  const [width, setWidth] = useState('3');
  const [defaultCentre, setDefaultCentre] = useState('');
  const [defaultAgent, setDefaultAgent] = useState('');
  const [centres, setCentres] = useState([]);
  const [agents, setAgents] = useState([]);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    Promise.all([
      farmerSettingsAPI.getSettings().catch(() => ({})),
      collectionCenterAPI.getAll({ status: 'Active', limit: 1000 }).catch(() => ({})),
      agentAPI.getAll({ limit: 1000 }).catch(() => ({})),
    ]).then(([s, c, a]) => {
      const d = s?.data || {};
      setMembershipFunction(d.membershipFunction || 'SubmitLinks');
      setNumberSeries(d.numberSeries || 'Existing');
      setWidth(String(d.centreSeriesWidth || 3));
      setDefaultCentre(d.defaultCentre || '');
      setDefaultAgent(d.defaultAgent || '');
      setCentres(c?.data || []);
      setAgents(a?.data || []);
    }).finally(() => setLoading(false));
  }, [opened]);

  const loadPreview = useCallback(() => {
    farmerAPI.getNumberSeriesPreview({ width })
      .then((res) => setPreview(res.data))
      .catch(() => setPreview(null));
  }, [width]);

  useEffect(() => { if (opened) loadPreview(); }, [opened, loadPreview]);

  const centreOptions = centres.map((c) => ({ value: c._id, label: c.centerName }));
  const agentOptions = agents
    .filter((a) => !defaultCentre || String(a.collectionCenterId?._id || a.collectionCenterId || '') === defaultCentre)
    .map((a) => ({ value: a._id, label: a.agentName }));

  const missingCodes = (preview?.perCentre || []).filter((c) => !c.code);
  const overlaps = (preview?.perCentre || []).filter((c) => c.overlapsExisting);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await farmerSettingsAPI.saveSettings({
        membershipFunction,
        numberSeries,
        centreSeriesWidth: Number(width),
        defaultCentre: defaultCentre || null,
        defaultAgent: defaultAgent || null,
      });
      notifications.show({ title: 'Saved', message: 'Settings saved successfully', color: 'teal' });
      clearDefaultCentreAgentCache();
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
              Decides the number suggested for NEW farmers. Existing farmer / member numbers are never changed.
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
                      Each centre has its own sequence, prefixed by the centre's Farmer No Code
                      (code 1 → {`1${'1'.padStart(Number(width), '0')}`}, {`1${'2'.padStart(Number(width), '0')}`} …).
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
                    <Select
                      label="Sequence digits"
                      description="Digits after the centre code"
                      data={['2', '3', '4', '5'].map((v) => ({ value: v, label: `${v} digits (code 1 → 1${'1'.padStart(Number(v), '0')})` }))}
                      value={width}
                      onChange={(v) => setWidth(v || '3')}
                      allowDeselect={false}
                      w={260}
                    />
                    <Table withTableBorder withColumnBorders fz="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Centre</Table.Th>
                          <Table.Th>Farmer No Code</Table.Th>
                          <Table.Th>Next Farmer No</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(preview?.perCentre || []).map((c) => (
                          <Table.Tr key={c.centreId}>
                            <Table.Td>{c.centerName}</Table.Td>
                            <Table.Td>{c.code || <Badge color="red" variant="light" size="sm">Not set</Badge>}</Table.Td>
                            <Table.Td>
                              {c.next || '-'}
                              {c.overlapsExisting && <Badge ml={6} color="orange" variant="light" size="sm">clashes with old numbers</Badge>}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                    {missingCodes.length > 0 && (
                      <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                        Set a Farmer No Code (digits) for {missingCodes.map((c) => c.centerName).join(', ')} under
                        Collection Centre → Edit before enabling the Center-wise Series.
                      </Alert>
                    )}
                    {overlaps.length > 0 && (
                      <Alert color="orange" icon={<IconInfoCircle size={16} />}>
                        Existing farmers already use numbers in this range (highest existing number: {preview.maxExisting}),
                        so those numbers will be skipped. Choose more digits so each centre's series starts above them.
                      </Alert>
                    )}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Box>

          <Divider />

          {/* ── Default Centre / Agent ── */}
          <Box>
            <Text fw={600} mb={4}>Default Centre &amp; Agent (Admin login)</Text>
            <Text size="sm" c="dimmed" mb="sm">
              Preselected on entry forms (Milk Purchase, Milk Sales, Farmer, Agent) when an admin logs in; any other
              centre / agent can still be chosen. Staff and agent logins always use their own assigned centre / agent.
            </Text>
            <Group grow>
              <Select
                label="Default Centre"
                placeholder="None"
                data={centreOptions}
                value={defaultCentre}
                onChange={(v) => { setDefaultCentre(v || ''); setDefaultAgent(''); }}
                clearable
                searchable
              />
              <Select
                label="Default Agent"
                placeholder="None"
                data={agentOptions}
                value={defaultAgent}
                onChange={(v) => setDefaultAgent(v || '')}
                clearable
                searchable
              />
            </Group>
          </Box>

          <Divider />

          {/* ── Membership Function ── */}
          <Box>
            <Text fw={600} mb={4}>Membership Function</Text>
            <Text size="sm" c="dimmed" mb="sm">
              Controls what happens when a Non-Member is assigned Membership with a Member Number that differs from
              their existing Farmer Number. The selected option is applied automatically every time.
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
            <Button onClick={handleSave} loading={saving}
              disabled={numberSeries === 'Centre' && missingCodes.length > 0}>
              Save Settings
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
