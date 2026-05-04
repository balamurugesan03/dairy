/**
 * MilkPurchaseSettings.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Professional Enterprise-Level Admin Dashboard — Milk Purchase Settings
 * Module  : Daily Collections → Milk Purchase Settings
 * Stack   : React 19 · Mantine v8 · Tabler Icons
 *
 * Layout:
 *   LEFT  — Rate Chart Menu sidebar (Milk Chart, KG Chart, SNS, CLR, Formula, Slab, Manual)
 *   RIGHT — Settings Panel:
 *             • Quantity Settings        (SegmentedControl: Litre / KG)
 *             • Manual Entry Combination (SegmentedControl: CLR+Fat / Fat+SNS)
 *             • Print Configuration      (Radio Group: 2in / 3in / Dot Matrix / Laser)
 *             • Machine Configuration    (Switch toggles for 4 devices)
 *             • Hardware Config Cards    (Weighing Scale, LED Display, Milk Analyzer, Other Analyzer)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Paper, Title, Text, Group, Stack, Button,
  Select, TextInput, NumberInput, Radio, Switch, Badge,
  Divider, Loader, Alert, Tooltip, NavLink, SegmentedControl, ActionIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconMilk,
  IconWeight,
  IconChartBar,
  IconPalette,
  IconCalculator,
  IconTable,
  IconPencil,
  IconScale,
  IconDeviceDesktop,
  IconDroplet,
  IconAdjustments,
  IconCpu,
  IconWifi,
  IconDeviceFloppy,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconSettings2,
  IconPrinter,
  IconChevronRight,
  IconPlug,
  IconPlugConnectedX,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react';
import { milkPurchaseSettingsAPI, machineConfigAPI, milmaChartAPI, whatsappAPI } from '../../services/api';
import { useInterval } from '@mantine/hooks';
import dayjs from 'dayjs';

// ─── Theme tokens ──────────────────────────────────────────────────────────────
const TEAL        = '#0d9488';
const TEAL_LIGHT  = '#ccfbf1';
const TEAL_BORDER = '#99f6e4';
const BLUE_SOFT   = '#e0f2fe';
const PAGE_BG     = '#f8f9fa';
const CARD_BG     = '#ffffff';
const TITLE_COLOR = '#0f766e';
const TEXT_MUTED  = '#64748b';
const GREEN_HINT  = '#16a34a';

// ─── Options ──────────────────────────────────────────────────────────────────
const COM_PORTS = [
  'ttyS0','ttyS1','ttyS2','ttyS3',
  'ttyUSB0','ttyUSB1','ttyUSB2',
  'COM1','COM2','COM3','COM4','COM5',
];
const BAUD_RATES       = ['1200','2400','4800','9600','19200','38400','57600','115200'];
const LED_DEVICES      = ['COMIENZ','ARIES','GENERIC','NONE'];
const ANALYZER_DEVICES = ['LACTO SURE ECO','LACTO STAR','MILKO TESTER','EKOMILK','NONE'];
const PRINT_OPTIONS    = ['2 inch','3 inch','Dot Matrix','Laser Printer'];

// ─── Sidebar menu configuration ───────────────────────────────────────────────
const MENU_ITEMS = [
  { id: 'milk-chart',  label: 'Milma Chart',       icon: IconMilk,       desc: 'Fat based milk rate'    },
  { id: 'kg-chart',    label: 'KG Chart',          icon: IconWeight,     desc: 'Weight based rate'      },
  { id: 'sns-chart',   label: 'SNF Chart',         icon: IconChartBar,   desc: 'SNF parameter rate'     },
  { id: 'clr-chart',   label: 'CLR Chart',         icon: IconPalette,    desc: 'CLR based rate chart'   },
  { id: 'formula',     label: 'Formula',           icon: IconCalculator, desc: 'Formula based rate'     },
  { id: 'slab-rate',   label: 'Slab Rate',         icon: IconTable,      desc: 'Slab based pricing'     },
  { id: 'manual-rate', label: 'Manual Rate Entry', icon: IconPencil,     desc: 'Litrex Rate'            },
];

// ─── Machine device list ───────────────────────────────────────────────────────
const MACHINE_LIST = [
  { key: 'weighingScale',      label: 'Weighing Scale',      icon: IconScale,         desc: 'COM-based weight sensor'     },
  { key: 'milkAnalyzer',       label: 'Milk Analyzer',       icon: IconDroplet,       desc: 'FAT / SNF analyzer unit'     },
  { key: 'digitalDisplay',     label: 'Digital Display',     icon: IconDeviceDesktop, desc: 'Customer-facing LED display' },
  { key: 'announcementSystem', label: 'Announcement System', icon: IconWifi,          desc: 'Audio announcement speaker'  },
];

// ═════════════════════════════════════════════════════════════════════════════
//  SectionCard — styled card wrapper used for every settings section
// ═════════════════════════════════════════════════════════════════════════════
function SectionCard({ icon: Icon, title, badge, children }) {
  return (
    <Paper
      radius="md"
      p={0}
      style={{
        background   : CARD_BG,
        border       : `1.5px solid ${TEAL_BORDER}`,
        overflow     : 'hidden',
        boxShadow    : '0 2px 8px rgba(13,148,136,0.07)',
        height       : '100%',
        display      : 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Card header */}
      <Box
        px="md"
        py="sm"
        style={{
          background  : `linear-gradient(135deg, ${TEAL_LIGHT} 0%, ${BLUE_SOFT} 100%)`,
          borderBottom: `1.5px solid ${TEAL_BORDER}`,
        }}
      >
        <Group gap="xs" align="center">
          <Box
            style={{
              background    : TEAL,
              borderRadius  : '6px',
              width         : 28,
              height        : 28,
              display       : 'flex',
              alignItems    : 'center',
              justifyContent: 'center',
              flexShrink    : 0,
            }}
          >
            <Icon size={15} color="#fff" />
          </Box>
          <Title
            order={6}
            style={{ color: TITLE_COLOR, fontWeight: 700, fontSize: 13, margin: 0, letterSpacing: '0.02em' }}
          >
            {title}
          </Title>
          {badge && (
            <Badge size="xs" color="teal" variant="light" ml="auto">
              {badge}
            </Badge>
          )}
        </Group>
      </Box>

      {/* Card body */}
      <Box p="md" style={{ flex: 1 }}>
        {children}
      </Box>
    </Paper>
  );
}

// ─── Field label ───────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <Text
      size="xs"
      fw={600}
      style={{ color: TEXT_MUTED, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}
    >
      {children}
    </Text>
  );
}

// ─── Status hint box ───────────────────────────────────────────────────────────
function HintBox({ children }) {
  return (
    <Box
      p="xs"
      style={{
        background  : '#f0fdfa',
        borderRadius: 6,
        border      : `1px solid ${TEAL_BORDER}`,
        marginTop   : 8,
      }}
    >
      <Group gap="xs" align="flex-start">
        <IconCheck size={13} color={TEAL} style={{ marginTop: 1, flexShrink: 0 }} />
        <Text size="xs" style={{ color: TITLE_COLOR, lineHeight: 1.5 }}>
          {children}
        </Text>
      </Group>
    </Box>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function MilkPurchaseSettings() {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [resetting,  setResetting]  = useState(false);
  const [error,      setError]      = useState(null);
  const [activeMenu,   setActiveMenu]   = useState('milk-chart');
  const [milmaLocked,  setMilmaLocked]  = useState(false);
    const [milmaMasters, setMilmaMasters] = useState([]);

  // ── WhatsApp QR state ──────────────────────────────────────────────────────
  const [waStatus,      setWaStatus]      = useState({ connected: false, initializing: false, qr: null });
  const [waConnecting,  setWaConnecting]  = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);

  const pollWaStatus = async () => {
    try {
      const res = await whatsappAPI.status();
      if (res?.data) setWaStatus(res.data);
    } catch { /* silent */ }
  };

  // poll every 3 s while initializing (waiting for QR scan)
  const waPoller = useInterval(pollWaStatus, 3000);

  useEffect(() => {
    if (waStatus.initializing || waStatus.qr) {
      waPoller.start();
    } else {
      waPoller.stop();
    }
    return waPoller.stop;
  }, [waStatus.initializing, waStatus.qr]);

  const handleWaConnect = async () => {
    setWaConnecting(true);
    try {
      await whatsappAPI.connect();
      pollWaStatus();
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to start WhatsApp client' });
    } finally { setWaConnecting(false); }
  };

  const handleWaDisconnect = async () => {
    setWaDisconnecting(true);
    try {
      await whatsappAPI.disconnect();
      setWaStatus({ connected: false, initializing: false, qr: null });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to disconnect' });
    } finally { setWaDisconnecting(false); }
  };

  // ── Analyzer start/stop state ───────────────────────────────────────────────
  const [analyzerRunning,  setAnalyzerRunning]  = useState(false);
  const [analyzerStarting, setAnalyzerStarting] = useState(false);
  const [analyzerStopping, setAnalyzerStopping] = useState(false);
  const [dynamicPorts,     setDynamicPorts]     = useState([]);
  const [portsLoading,     setPortsLoading]     = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [whatsAppTestPhone, setWhatsAppTestPhone] = useState('');
  const [whatsAppTesting,   setWhatsAppTesting]   = useState(false);

  const [form, setForm] = useState({
    // General purchase settings
    quantityUnit           : 'Litre',
    manualEntryCombination : 'CLR-FAT',
    manualEntryMode        : 'litre-x-rate',
    activeRateChartType    : 'ApplyFormula',
    printSize              : '3 inch',
    whatsApp: {
      enabled        : false,
      apiType        : 'ultramsg',
      instanceId     : '',
      token          : '',
      apiUrl         : '',
      messageTemplate: '🐄 Milk Bill\nDate: {date} {shift}\nBill No: {billNo}\nFarmer: {name} ({farmerNo})\nQty: {qty} Ltr\nFat: {fat} | CLR: {clr} | SNF: {snf}\nRate: ₹{rate}/Kg\nAmount: ₹{amount}',
    },

    // Hardware device toggles
    machines: {
      weighingScale      : false,
      milkAnalyzer       : false,
      digitalDisplay     : false,
      announcementSystem : false,
    },

    // Weighing Scale COM config
    weighingScaleConfig: {
      comPort   : 'COM2',
      baudRate  : 9600,
      tareString: 'T',
      ctrlChar  : '#',
      length    : 0,
    },

    // LED Display config
    ledDisplayConfig: {
      device  : 'COMIENZ',
      comPort : 'COM3',
      baudRate: 9600,
    },

    // Milk Analyzer config
    milkAnalyzerConfig: {
      deviceName            : '',
      device                : 'LACTO SURE ECO',
      comPort               : 'COM11',
      baudRate              : 9600,
      manualEntryCombination: 'FAT-SNF',
    },

    // Other analyzer manual config
    otherAnalyzerConfig: {
      fatPosStart: 0,
      fatPosEnd  : 0,
      snfPosStart: 0,
      snfPosEnd  : 0,
      outputLen  : 0,
    },
  });

  // ── Load settings from server ──────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await milkPurchaseSettingsAPI.getSettings();
      if (res?.data) mergeServerData(res.data);
    } catch (err) {
      setError(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    milkPurchaseSettingsAPI.fixComPorts();
    loadSettings();
    loadAnalyzerStatus();
    fetchDynamicPorts();
    pollWaStatus();
  }, [loadSettings]);

   useEffect(() => { loadSettings(); loadAnalyzerStatus(); fetchDynamicPorts(); loadMilmaMasters(); }, [loadSettings]);
  
    const loadMilmaMasters = async () => {
      try {
        const res = await milmaChartAPI.getMasters();
        setMilmaMasters(res?.data || []);
      } catch { /* silent — no milma charts uploaded yet */ }
    };

  // ── Analyzer helpers ────────────────────────────────────────────────────────
  const loadAnalyzerStatus = async () => {
    try {
      const res = await machineConfigAPI.getStatus();
      setAnalyzerRunning(res?.isOpen || false);
    } catch { /* silent */ }
  };

  const fetchDynamicPorts = async () => {
    setPortsLoading(true);
    try {
      const res = await machineConfigAPI.listPorts();
      const list = (res?.data || []).map(p => p.path);
      setDynamicPorts(list);
    } catch { setDynamicPorts([]); }
    finally { setPortsLoading(false); }
  };

  const handleStartAnalyzer = async () => {
    setAnalyzerStarting(true);
    try {
      const res = await machineConfigAPI.start({
        port    : form.milkAnalyzerConfig.comPort,
        baudRate: form.milkAnalyzerConfig.baudRate,
      });
      if (res?.success) {
        setAnalyzerRunning(true);
        notifications.show({ color: 'teal', title: 'Analyzer Started', message: res.message });
      } else {
        notifications.show({ color: 'red', title: 'Failed', message: res?.message || 'Could not start analyzer' });
      }
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err?.message || 'Failed to start analyzer' });
    } finally {
      setAnalyzerStarting(false);
    }
  };

  const handleStopAnalyzer = async () => {
    setAnalyzerStopping(true);
    try {
      await machineConfigAPI.stop();
      setAnalyzerRunning(false);
      notifications.show({ color: 'orange', title: 'Analyzer Stopped', message: 'Serial port closed' });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err?.message || 'Failed to stop analyzer' });
    } finally {
      setAnalyzerStopping(false);
    }
  };

  function mergeServerData(data) {
    setForm(prev => ({
      ...prev,
      quantityUnit           : data.quantityUnit            ?? prev.quantityUnit,
      manualEntryCombination : data.manualEntryCombination  ?? prev.manualEntryCombination,
      manualEntryMode        : data.manualEntryMode         ?? prev.manualEntryMode,
      activeRateChartType    : data.activeRateChartType     ?? prev.activeRateChartType,
      printSize              : data.printSize               ?? prev.printSize,
      whatsApp: {
        ...prev.whatsApp,
        ...(data.whatsApp || {}),
        messageTemplate: data.whatsApp?.messageTemplate || prev.whatsApp.messageTemplate,
      },
      machines: {
        ...prev.machines,
        ...(data.machines || {}),
      },
      weighingScaleConfig: {
        ...prev.weighingScaleConfig,
        ...(data.weighingScaleConfig || {}),
        baudRate: Number(data.weighingScaleConfig?.baudRate ?? prev.weighingScaleConfig.baudRate),
      },
      ledDisplayConfig: {
        ...prev.ledDisplayConfig,
        ...(data.ledDisplayConfig || {}),
        baudRate: Number(data.ledDisplayConfig?.baudRate ?? prev.ledDisplayConfig.baudRate),
      },
      milkAnalyzerConfig: {
        ...prev.milkAnalyzerConfig,
        ...(data.milkAnalyzerConfig || {}),
        baudRate  : Number(data.milkAnalyzerConfig?.baudRate   ?? prev.milkAnalyzerConfig.baudRate),
        deviceName: data.milkAnalyzerConfig?.deviceName ?? prev.milkAnalyzerConfig.deviceName,
      },
      otherAnalyzerConfig: {
        ...prev.otherAnalyzerConfig,
        ...(data.otherAnalyzerConfig || {}),
      },
    }));
  }

  // ── Field helpers ──────────────────────────────────────────────────────────
  const setTop     = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const setSub     = (section, field, value) =>
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  const setMachine = (key, value) =>
    setForm(prev => ({ ...prev, machines: { ...prev.machines, [key]: value } }));
  const setWA = (field, value) =>
    setForm(prev => ({ ...prev, whatsApp: { ...prev.whatsApp, [field]: value } }));

  const handleTestWhatsApp = async () => {
    if (!whatsAppTestPhone) { notifications.show({ color: 'red', message: 'Enter a phone number to test' }); return; }
    setWhatsAppTesting(true);
    try {
      const res = await whatsappAPI.test(whatsAppTestPhone);
      if (res?.success) notifications.show({ color: 'teal', title: 'Test Sent', message: 'WhatsApp test message sent successfully!' });
      else notifications.show({ color: 'red', title: 'Test Failed', message: res?.message || 'Failed to send test message' });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err?.message || 'Test failed' });
    } finally { setWhatsAppTesting(false); }
  };

  // ── Save all settings ──────────────────────────────────────────────────────
  async function handleSave() {
    try {
      setSaving(true);
      await milkPurchaseSettingsAPI.saveSettings(form);
      notifications.show({
        title  : 'Settings Saved',
        message: 'All milk purchase settings saved successfully.',
        color  : 'teal',
        icon   : <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({
        title  : 'Save Failed',
        message: err?.message || 'Could not save settings.',
        color  : 'red',
        icon   : <IconAlertCircle size={16} />,
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Reset to factory defaults ──────────────────────────────────────────────
  async function handleReset() {
    try {
      setResetting(true);
      const res = await milkPurchaseSettingsAPI.resetSettings();
      if (res?.data) mergeServerData(res.data);
      notifications.show({
        title  : 'Reset Complete',
        message: 'All settings restored to factory defaults.',
        color  : 'orange',
        icon   : <IconRefresh size={16} />,
      });
    } catch (err) {
      notifications.show({
        title  : 'Reset Failed',
        message: err?.message || 'Could not reset settings.',
        color  : 'red',
      });
    } finally {
      setResetting(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box
        style={{
          background    : PAGE_BG,
          minHeight     : '100vh',
          display       : 'flex',
          alignItems    : 'center',
          justifyContent: 'center',
        }}
      >
        <Stack align="center" gap="md">
          <Loader color="teal" size="lg" />
          <Text size="sm" c="dimmed">Loading milk purchase settings…</Text>
        </Stack>
      </Box>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Box p="xl" style={{ background: PAGE_BG, minHeight: '100vh' }}>
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Failed to Load Settings">
          {error}
          <Button size="xs" mt="sm" color="red" variant="outline" onClick={loadSettings}>
            Retry
          </Button>
        </Alert>
      </Box>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box style={{ background: PAGE_BG, minHeight: '100vh', padding: '20px 24px 40px' }}>

      {/* ════════════════════════════════════════════════════════════════════
          PAGE HEADER
      ════════════════════════════════════════════════════════════════════ */}
      <Box mb="lg">
        <Group justify="space-between" align="flex-start">

          {/* Title + description */}
          <Group gap="sm" align="flex-start">
            <Box
              style={{
                background    : TEAL,
                borderRadius  : '10px',
                width         : 42,
                height        : 42,
                display       : 'flex',
                alignItems    : 'center',
                justifyContent: 'center',
                flexShrink    : 0,
                boxShadow     : '0 4px 12px rgba(13,148,136,0.30)',
              }}
            >
              <IconSettings2 size={22} color="#fff" />
            </Box>
            <Box>
              <Group gap="sm" align="center" mb={2}>
                <Title order={4} style={{ color: TITLE_COLOR, fontWeight: 800, margin: 0 }}>
                  Milk Purchase Settings
                </Title>
                <Badge color="teal" variant="dot" size="sm">Dairy System</Badge>
              </Group>
              <Text size="xs" style={{ color: TEXT_MUTED }}>
                Configure rate charts, entry parameters, print options &amp; hardware peripherals — all in one place
              </Text>
            </Box>
          </Group>

          {/* Action buttons */}
          <Group gap="sm">
            <Tooltip label="Reset all settings to factory defaults" position="bottom">
              <Button
                size="sm"
                variant="light"
                color="orange"
                leftSection={<IconRefresh size={15} />}
                loading={resetting}
                onClick={handleReset}
                radius="md"
              >
                Reset
              </Button>
            </Tooltip>
            <Button
              size="sm"
              color="teal"
              radius="md"
              style={{ background: TEAL }}
              leftSection={<IconDeviceFloppy size={15} />}
              loading={saving}
              onClick={handleSave}
            >
              Save Settings
            </Button>
          </Group>
        </Group>
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          MAIN GRID — Left sidebar + Right settings panel
      ════════════════════════════════════════════════════════════════════ */}
      <Grid gutter="md">

        {/* ══════════════════════════════════════════
            LEFT SIDEBAR — RATE CHART MENU
        ══════════════════════════════════════════ */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Paper
            radius="md"
            p={0}
            style={{
              background: CARD_BG,
              border    : `1.5px solid ${TEAL_BORDER}`,
              boxShadow : '0 2px 8px rgba(13,148,136,0.07)',
              overflow  : 'hidden',
              position  : 'sticky',
              top       : 20,
            }}
          >
            {/* Sidebar header */}
            <Box
              px="md"
              py="sm"
              style={{
                background: `linear-gradient(135deg, ${TEAL} 0%, #0891b2 100%)`,
              }}
            >
              <Group gap="xs" mb={2}>
                <IconTable size={16} color="#fff" />
                <Text size="sm" fw={700} style={{ color: '#fff', letterSpacing: '0.05em' }}>
                  RATE CHART MENU
                </Text>
              </Group>
              <Text size="xs" style={{ color: 'rgba(255,255,255,0.70)' }}>
                Select chart type to configure
              </Text>
            </Box>

            {/* Navigation items */}
            <Box py={4}>
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.id;
                const isMilma  = item.id === 'milk-chart';
                const isDisabled = milmaLocked && !isMilma;
                return (
                  <NavLink
                    key={item.id}
                    onClick={() => !isDisabled && setActiveMenu(item.id)}
                    active={isActive}
                    disabled={isDisabled}
                    label={
                      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <Box>
                          <Text
                            size="sm"
                            fw={isActive ? 700 : 500}
                            style={{ color: isDisabled ? '#cbd5e1' : isActive ? TEAL : '#1e293b', lineHeight: 1.3 }}
                          >
                            {item.label}
                          </Text>
                          <Text size="xs" style={{ color: isDisabled ? '#e2e8f0' : TEXT_MUTED, lineHeight: 1.2 }}>
                            {item.desc}
                          </Text>
                        </Box>
                        {isMilma && (
                          <input
                            type="checkbox"
                            checked={milmaLocked}
                            title={milmaLocked ? 'Disable Milma Chart lock' : 'Enable Milma Chart (disables others)'}
                            onChange={e => {
                              e.stopPropagation();
                              setMilmaLocked(e.target.checked);
                              if (e.target.checked) setActiveMenu('milk-chart');
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: 15, height: 15, accentColor: TEAL, cursor: 'pointer', flexShrink: 0 }}
                          />
                        )}
                      </Box>
                    }
                    leftSection={
                      <Box
                        style={{
                          width         : 32,
                          height        : 32,
                          borderRadius  : 7,
                          background    : isDisabled ? '#f8fafc' : isActive ? TEAL_LIGHT : '#f8fafc',
                          border        : `1px solid ${isDisabled ? '#f1f5f9' : isActive ? TEAL_BORDER : '#e2e8f0'}`,
                          display       : 'flex',
                          alignItems    : 'center',
                          justifyContent: 'center',
                          flexShrink    : 0,
                          transition    : 'all 0.2s',
                          opacity       : isDisabled ? 0.4 : 1,
                        }}
                      >
                        <Icon size={15} color={isDisabled ? '#cbd5e1' : isActive ? TEAL : '#94a3b8'} />
                      </Box>
                    }
                    rightSection={isActive && !isMilma ? <IconChevronRight size={13} color={TEAL} /> : null}
                    styles={{
                      root: {
                        padding    : '9px 12px',
                        borderLeft : `3px solid ${isActive ? TEAL : 'transparent'}`,
                        background : isActive ? '#f0fdfa' : 'transparent',
                        transition : 'all 0.15s',
                        cursor     : isDisabled ? 'not-allowed' : 'pointer',
                        opacity    : isDisabled ? 0.5 : 1,
                      },
                    }}
                  />
                );
              })}
            </Box>

            {/* Sidebar footer */}
            <Box
              px="md"
              py="sm"
              style={{
                borderTop : `1px solid ${TEAL_LIGHT}`,
                background: '#f8fafc',
              }}
            >
              <Text size="xs" style={{ color: TEXT_MUTED, lineHeight: 1.5 }}>
                Settings on the right apply to all milk purchase operations
              </Text>
            </Box>
          </Paper>
        </Grid.Col>

        {/* ══════════════════════════════════════════
            RIGHT PANEL — ALL SETTINGS SECTIONS
        ══════════════════════════════════════════ */}
        <Grid.Col span={{ base: 12, md: 9 }}>
          <Stack gap="md">

            {/* ──────────────────────────────────────
                ROW 0 — Active Rate Chart Type
            ────────────────────────────────────── */}
            <SectionCard icon={IconCalculator} title="Active Rate Chart Type" badge="Calculation">
              <Stack gap="sm">
                <FieldLabel>Select which rate chart is used to calculate milk purchase rate</FieldLabel>
                <Select
                  value={form.activeRateChartType}
                  onChange={v => setTop('activeRateChartType', v)}
                  data={[
                    { value: 'MilmaChart',    label: 'Milma Chart — FAT + CLR table uploaded by admin' },
                    { value: 'ManualEntry',   label: 'Manual Entry — Table lookup (CLR / FAT / SNF)' },
                    { value: 'ApplyFormula',  label: 'Apply Formula — Fat Rate × FAT + SNF Rate × SNF' },
                    { value: 'LowChart',      label: 'Low Chart — Table lookup for below-standard milk' },
                    { value: 'GoldLessChart', label: 'Add / Less Chart — Adjust existing chart by ±value' },
                    { value: 'SlabRate',      label: 'Slab Rate — Fixed flat rate per litre' },
                  ]}
                  radius="sm"
                  size="sm"
                  styles={{ input: { fontWeight: 600 } }}
                />
                <HintBox>
                  Active chart: <strong>{form.activeRateChartType}</strong> — configure its records in <em>Rate Chart Settings</em>
                </HintBox>
                {/* ── Milma Chart versions panel (shown only when MilmaChart is active) ── */}
                                {form.activeRateChartType === 'MilmaChart' && (
                                  <Box
                                    mt="xs"
                                    p="sm"
                                    style={{
                                      background  : '#f0fdfa',
                                      borderRadius: 8,
                                      border      : `1px solid ${TEAL_BORDER}`,
                                    }}
                                  >
                                    <Group justify="space-between" mb="xs">
                                      <Text size="sm" fw={700} c="teal.8">Milma Rate Chart Versions</Text>
                                      <Badge color="teal" variant="light" size="sm">
                                        {milmaMasters.length} version{milmaMasters.length !== 1 ? 's' : ''} loaded
                                      </Badge>
                                    </Group>
                
                                    {milmaMasters.length === 0 ? (
                                      <Text size="xs" c="dimmed">
                                        No Milma chart has been uploaded yet. Please ask the super admin to upload the Excel file from the Super Admin panel.
                                      </Text>
                                    ) : (
                                      <Box style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                          <thead>
                                            <tr style={{ background: TEAL_LIGHT }}>
                                              {['Chart ID', 'Effective From', 'SNF Rate', 'FAT Rate', 'SNF Low <', 'TS Low <', 'SNF High ≥', 'TS High ≥', 'Rows', 'Remarks'].map(h => (
                                                <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: TITLE_COLOR, fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${TEAL_BORDER}` }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {milmaMasters.map((m, i) => (
                                              <tr key={m._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fffd' }}>
                                                <td style={{ padding: '4px 8px', fontWeight: 700, color: TEAL }}>{m.chartId}</td>
                                                <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{dayjs(m.dateFrom).format('DD-MM-YYYY')}</td>
                                                <td style={{ padding: '4px 8px' }}>{m.rateSNF}</td>
                                                <td style={{ padding: '4px 8px' }}>{m.rateFAT}</td>
                                                <td style={{ padding: '4px 8px' }}>{m.subSNF}</td>
                                                <td style={{ padding: '4px 8px' }}>{m.subTotalSolids}</td>
                                                <td style={{ padding: '4px 8px' }}>{m.bestSNF}</td>
                                                <td style={{ padding: '4px 8px' }}>{m.bestTotalSolids}</td>
                                                <td style={{ padding: '4px 8px' }}>{m.rowCount?.toLocaleString()}</td>
                                                <td style={{ padding: '4px 8px', color: TEXT_MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.remarks || '—'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </Box>
                                    )}
                                  </Box>
                                )}
              </Stack>
            </SectionCard>

            {/* ──────────────────────────────────────
                Manual Rate Entry Mode (shown when manual-rate sidebar is active)
            ────────────────────────────────────── */}
            {activeMenu === 'manual-rate' && (
              <SectionCard icon={IconPencil} title="Manual Rate Entry Mode" badge="Calculation">
                <Stack gap="sm">
                  <FieldLabel>How should amount be calculated during manual entry?</FieldLabel>
                  <SegmentedControl
                    data={[
                      { value: 'litre-x-rate',      label: 'Litre × Rate  →  Amount (auto)' },
                      { value: 'litre-and-amount',  label: 'Litre & Amount  →  Rate (auto)' },
                    ]}
                    value={form.manualEntryMode}
                    onChange={v => setTop('manualEntryMode', v)}
                    size="sm"
                    radius="sm"
                    color="teal"
                    fullWidth
                    styles={{
                      root : { background: TEAL_LIGHT, border: `1px solid ${TEAL_BORDER}` },
                      label: { fontSize: 13, fontWeight: 600 },
                    }}
                  />
                  <HintBox>
                    {form.manualEntryMode === 'litre-x-rate'
                      ? 'Enter Litre and Rate — Amount is auto-calculated (Litre × Rate)'
                      : 'Enter Litre and Amount — Rate is auto-calculated (Amount ÷ Litre)'}
                  </HintBox>
                </Stack>
              </SectionCard>
            )}

            {/* ──────────────────────────────────────
                ROW 1 — Quantity Settings + Manual Entry Combination
            ────────────────────────────────────── */}
            <Grid gutter="md">

              {/* Quantity Settings */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SectionCard icon={IconMilk} title="Quantity Settings" badge="Unit">
                  <Stack gap="sm">
                    <FieldLabel>Select Quantity Unit</FieldLabel>
                    <SegmentedControl
                      data={['Litre', 'KG']}
                      value={form.quantityUnit}
                      onChange={v => setTop('quantityUnit', v)}
                      size="sm"
                      radius="sm"
                      color="teal"
                      fullWidth
                      styles={{
                        root : { background: TEAL_LIGHT, border: `1px solid ${TEAL_BORDER}` },
                        label: { fontSize: 13, fontWeight: 600 },
                      }}
                    />
                    <HintBox>
                      Currently: <strong>{form.quantityUnit}</strong> — applied to all milk collection entries
                    </HintBox>
                  </Stack>
                </SectionCard>
              </Grid.Col>

              {/* Manual Entry Combination */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SectionCard icon={IconAdjustments} title="Manual Entry Combination" badge="Parameters">
                  <Stack gap="sm">
                    <FieldLabel>Select Parameter Combination</FieldLabel>
                    <SegmentedControl
                      data={[{ value: 'CLR-FAT', label: 'CLR + Fat' }, { value: 'FAT-SNF', label: 'Fat + SNF' }]}
                      value={form.manualEntryCombination}
                      onChange={v => setTop('manualEntryCombination', v)}
                      size="sm"
                      radius="sm"
                      color="teal"
                      fullWidth
                      styles={{
                        root : { background: TEAL_LIGHT, border: `1px solid ${TEAL_BORDER}` },
                        label: { fontSize: 13, fontWeight: 600 },
                      }}
                    />
                    <HintBox>
                      Selected: <strong>{form.manualEntryCombination}</strong>
                    </HintBox>
                  </Stack>
                </SectionCard>
              </Grid.Col>
            </Grid>

            {/* ──────────────────────────────────────
                ROW 2 — Print Configuration + Machine Configuration Toggles
            ────────────────────────────────────── */}
            <Grid gutter="md">

              {/* Print Configuration */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SectionCard icon={IconPrinter} title="Print Configuration" badge="Paper Type">
                  <Stack gap="xs">
                    <FieldLabel>Select Printer / Paper Type</FieldLabel>
                    <Radio.Group
                      value={form.printSize}
                      onChange={v => setTop('printSize', v)}
                    >
                      <Stack gap="xs">
                        {PRINT_OPTIONS.map((opt) => (
                          <Box
                            key={opt}
                            px="sm"
                            py={8}
                            style={{
                              background  : form.printSize === opt ? '#f0fdfa' : '#f8fafc',
                              border      : `1px solid ${form.printSize === opt ? TEAL_BORDER : '#e2e8f0'}`,
                              borderRadius: 7,
                              cursor      : 'pointer',
                              transition  : 'all 0.15s',
                            }}
                          >
                            <Radio
                              value={opt}
                              label={
                                <Text
                                  size="sm"
                                  fw={500}
                                  style={{ color: form.printSize === opt ? TITLE_COLOR : '#1e293b' }}
                                >
                                  {opt}
                                </Text>
                              }
                              color="teal"
                              size="sm"
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Radio.Group>
                  </Stack>
                </SectionCard>
              </Grid.Col>

              {/* Machine Configuration — toggle switches */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SectionCard icon={IconCpu} title="Machine Configuration" badge="Enable / Disable">
                  <Stack gap={0}>
                    {MACHINE_LIST.map((item, idx) => {
                      const Icon    = item.icon;
                      const enabled = form.machines[item.key];
                      return (
                        <Box
                          key={item.key}
                          py="sm"
                          style={{
                            borderBottom: idx < MACHINE_LIST.length - 1
                              ? `1px solid ${TEAL_LIGHT}`
                              : 'none',
                          }}
                        >
                          <Group justify="space-between" align="center">
                            <Group gap="sm">
                              <Box
                                style={{
                                  width         : 34,
                                  height        : 34,
                                  borderRadius  : 7,
                                  background    : enabled ? TEAL_LIGHT : '#f1f5f9',
                                  border        : `1px solid ${enabled ? TEAL_BORDER : '#e2e8f0'}`,
                                  display       : 'flex',
                                  alignItems    : 'center',
                                  justifyContent: 'center',
                                  transition    : 'all 0.2s',
                                  flexShrink    : 0,
                                }}
                              >
                                <Icon size={16} color={enabled ? TEAL : '#94a3b8'} />
                              </Box>
                              <Box>
                                <Text
                                  size="sm"
                                  fw={600}
                                  style={{ color: enabled ? '#1e293b' : '#64748b', lineHeight: 1.3 }}
                                >
                                  {item.label}
                                </Text>
                                <Text size="xs" style={{ color: TEXT_MUTED, lineHeight: 1.2 }}>
                                  {item.desc}
                                </Text>
                              </Box>
                            </Group>
                            <Switch
                              checked={enabled}
                              onChange={e => setMachine(item.key, e.currentTarget.checked)}
                              color="teal"
                              size="md"
                              thumbIcon={enabled ? <IconCheck size={10} color={TEAL} /> : null}
                            />
                          </Group>
                        </Box>
                      );
                    })}
                  </Stack>
                </SectionCard>
              </Grid.Col>
            </Grid>

            {/* ──────────────────────────────────────
                WhatsApp Integration — QR Scan
            ────────────────────────────────────── */}
            <SectionCard icon={IconWifi} title="WhatsApp Bill Messaging" badge="QR Link">
              <Stack gap="sm">

                {/* Enable toggle */}
                <Group justify="space-between" align="center">
                  <Box>
                    <Text size="sm" fw={600} style={{ color: TITLE_COLOR }}>Enable WhatsApp Bills</Text>
                    <Text size="xs" style={{ color: TEXT_MUTED }}>Send bill to farmer's WhatsApp after every save</Text>
                  </Box>
                  <Switch
                    checked={form.whatsApp.enabled}
                    onChange={e => setWA('enabled', e.currentTarget.checked)}
                    color="teal"
                    size="md"
                    thumbIcon={form.whatsApp.enabled ? <IconCheck size={10} color={TEAL} /> : null}
                  />
                </Group>

                {form.whatsApp.enabled && (
                  <Stack gap="sm">
                    <Divider color={TEAL_BORDER} />

                    {/* Connection status badge */}
                    <Group gap="xs" align="center">
                      {waStatus.connected ? (
                        <Badge color="teal" variant="filled" size="md" leftSection={<IconCircleCheck size={12} />}>
                          Connected
                        </Badge>
                      ) : waStatus.initializing || waStatus.qr ? (
                        <Badge color="yellow" variant="filled" size="md" leftSection={<Loader size={10} color="white" />}>
                          Waiting for QR scan…
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="filled" size="md" leftSection={<IconCircleX size={12} />}>
                          Not Connected
                        </Badge>
                      )}

                      {/* Connect / Disconnect buttons */}
                      {!waStatus.connected && !waStatus.initializing && !waStatus.qr && (
                        <Button
                          size="xs" color="teal" radius="sm"
                          leftSection={<IconPlug size={13} />}
                          loading={waConnecting}
                          onClick={handleWaConnect}
                        >
                          Connect WhatsApp
                        </Button>
                      )}
                      {waStatus.connected && (
                        <Button
                          size="xs" color="red" variant="outline" radius="sm"
                          leftSection={<IconPlugConnectedX size={13} />}
                          loading={waDisconnecting}
                          onClick={handleWaDisconnect}
                        >
                          Disconnect
                        </Button>
                      )}
                    </Group>

                    {/* QR Code display */}
                    {waStatus.qr && (
                      <Box
                        p="sm"
                        style={{
                          background  : '#f0fdfa',
                          border      : `1.5px solid ${TEAL_BORDER}`,
                          borderRadius: 10,
                          textAlign   : 'center',
                        }}
                      >
                        <Text size="xs" fw={600} style={{ color: TITLE_COLOR, marginBottom: 8 }}>
                          Scan this QR code with WhatsApp on your phone
                        </Text>
                        <Text size="xs" style={{ color: TEXT_MUTED, marginBottom: 10 }}>
                          Open WhatsApp → ⋮ Menu → Linked Devices → Link a Device
                        </Text>
                        <img
                          src={waStatus.qr}
                          alt="WhatsApp QR"
                          style={{ width: 220, height: 220, borderRadius: 8, border: `1px solid ${TEAL_BORDER}` }}
                        />
                        <Text size="xs" mt={8} style={{ color: TEXT_MUTED }}>
                          QR refreshes automatically every 20 seconds
                        </Text>
                      </Box>
                    )}

                    {/* Message template */}
                    <Box>
                      <FieldLabel>Message Template</FieldLabel>
                      <Text size="xs" style={{ color: TEXT_MUTED, marginBottom: 4 }}>
                        Variables: {'{name}'} {'{farmerNo}'} {'{date}'} {'{shift}'} {'{billNo}'} {'{qty}'} {'{fat}'} {'{clr}'} {'{snf}'} {'{rate}'} {'{amount}'}
                      </Text>
                      <textarea
                        value={form.whatsApp.messageTemplate}
                        onChange={e => setWA('messageTemplate', e.target.value)}
                        rows={6}
                        style={{
                          width: '100%', borderRadius: 6, fontSize: 12, fontFamily: 'monospace',
                          padding: '8px', border: `1px solid ${TEAL_BORDER}`, resize: 'vertical',
                          outline: 'none', lineHeight: 1.6,
                        }}
                      />
                    </Box>

                    {/* Test message (only when connected) */}
                    {waStatus.connected && (
                      <>
                        <Divider color={TEAL_BORDER} label="Test Connection" labelPosition="left" />
                        <Group gap="sm">
                          <TextInput
                            placeholder="91XXXXXXXXXX"
                            value={whatsAppTestPhone}
                            onChange={e => setWhatsAppTestPhone(e.target.value)}
                            size="sm" radius="sm"
                            styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                            style={{ flex: 1 }}
                          />
                          <Button
                            size="sm" color="teal" radius="sm"
                            loading={whatsAppTesting}
                            onClick={handleTestWhatsApp}
                            leftSection={<IconWifi size={14} />}
                          >
                            Send Test
                          </Button>
                        </Group>
                      </>
                    )}
                  </Stack>
                )}
              </Stack>
            </SectionCard>

            {/* ──────────────────────────────────────
                SECTION DIVIDER — Hardware Configuration
            ────────────────────────────────────── */}
            <Divider
              label={
                <Group gap="xs">
                  <IconCpu size={14} color={TEAL} />
                  <Text
                    size="xs"
                    fw={700}
                    style={{ color: TITLE_COLOR, textTransform: 'uppercase', letterSpacing: '0.07em' }}
                  >
                    Hardware Configuration
                  </Text>
                </Group>
              }
              labelPosition="left"
              color={TEAL_BORDER}
            />

            {/* ──────────────────────────────────────
                ROW 3 — Weighing Scale + LED Display
            ────────────────────────────────────── */}
            <Grid gutter="md">

              {/* Weighing Scale Config */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <SectionCard icon={IconScale} title="Weighing Scale" badge="COM Config">
                  <Stack gap="sm">
                    <Box>
                      <FieldLabel>Com Port</FieldLabel>
                      <Select
                        data={COM_PORTS}
                        value={form.weighingScaleConfig.comPort}
                        onChange={v => setSub('weighingScaleConfig', 'comPort', v)}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>
                    <Box>
                      <FieldLabel>Baud Rate</FieldLabel>
                      <Select
                        data={BAUD_RATES}
                        value={String(form.weighingScaleConfig.baudRate)}
                        onChange={v => setSub('weighingScaleConfig', 'baudRate', Number(v))}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>
                    <Grid gutter="sm">
                      <Grid.Col span={6}>
                        <FieldLabel>Tare String</FieldLabel>
                        <TextInput
                          value={form.weighingScaleConfig.tareString}
                          onChange={e => setSub('weighingScaleConfig', 'tareString', e.currentTarget.value)}
                          size="sm"
                          radius="sm"
                          maxLength={10}
                          styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13, fontFamily: 'monospace' } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <FieldLabel>Ctrl Char</FieldLabel>
                        <TextInput
                          value={form.weighingScaleConfig.ctrlChar}
                          onChange={e => setSub('weighingScaleConfig', 'ctrlChar', e.currentTarget.value)}
                          size="sm"
                          radius="sm"
                          maxLength={5}
                          styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13, fontFamily: 'monospace' } }}
                        />
                      </Grid.Col>
                    </Grid>
                    <Box>
                      <FieldLabel>Length</FieldLabel>
                      <NumberInput
                        value={form.weighingScaleConfig.length}
                        onChange={v => setSub('weighingScaleConfig', 'length', v ?? 0)}
                        min={0}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                      {form.weighingScaleConfig.length === 0 && (
                        <Text size="xs" mt={5} style={{ color: GREEN_HINT, fontStyle: 'italic' }}>
                          ✓ Auto configure activated when Length is 0
                        </Text>
                      )}
                    </Box>
                  </Stack>
                </SectionCard>
              </Grid.Col>

              {/* LED Display Config */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <SectionCard icon={IconDeviceDesktop} title="LED Display" badge="COM Config">
                  <Stack gap="sm">
                    <Box>
                      <FieldLabel>Device</FieldLabel>
                      <Select
                        data={LED_DEVICES}
                        value={form.ledDisplayConfig.device}
                        onChange={v => setSub('ledDisplayConfig', 'device', v)}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>
                    <Box>
                      <FieldLabel>Com Port</FieldLabel>
                      <Select
                        data={COM_PORTS}
                        value={form.ledDisplayConfig.comPort}
                        onChange={v => setSub('ledDisplayConfig', 'comPort', v)}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>
                    <Box>
                      <FieldLabel>Baud Rate</FieldLabel>
                      <Select
                        data={BAUD_RATES}
                        value={String(form.ledDisplayConfig.baudRate)}
                        onChange={v => setSub('ledDisplayConfig', 'baudRate', Number(v))}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>
                  </Stack>
                </SectionCard>
              </Grid.Col>
            </Grid>

            {/* ──────────────────────────────────────
                ROW 4 — Milk Analyzer + Other Analyzer
            ────────────────────────────────────── */}
            <Grid gutter="md">

              {/* Milk Analyzer Config */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <SectionCard icon={IconDroplet} title="Milk Analyzer" badge="COM Config">
                  <Stack gap="sm">

                    {/* Status indicator */}
                    <Box
                      px="sm" py={6}
                      style={{
                        background  : analyzerRunning ? '#f0fff4' : '#fff8f0',
                        border      : `1px solid ${analyzerRunning ? '#4caf50' : '#ff9800'}`,
                        borderRadius: 6,
                      }}
                    >
                      <Group gap={6}>
                        {analyzerRunning
                          ? <IconCircleCheck size={14} color="#4caf50" />
                          : <IconCircleX    size={14} color="#ff9800" />}
                        <Text size="xs" fw={700} c={analyzerRunning ? 'green.7' : 'orange.7'}>
                          {analyzerRunning ? 'Analyzer Running' : 'Analyzer Stopped'}
                        </Text>
                      </Group>
                    </Box>

                    <Box>
                      <FieldLabel>Device Name</FieldLabel>
                      <TextInput
                        placeholder="e.g., Lactoscan SMA, Milkotester"
                        value={form.milkAnalyzerConfig.deviceName}
                        onChange={e => setSub('milkAnalyzerConfig', 'deviceName', e.target.value)}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>

                    <Box>
                      <FieldLabel>Device Model</FieldLabel>
                      <Select
                        data={ANALYZER_DEVICES}
                        value={form.milkAnalyzerConfig.device}
                        onChange={v => setSub('milkAnalyzerConfig', 'device', v)}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>

                    <Box>
                      <Group justify="space-between" mb={4}>
                        <FieldLabel>Com Port</FieldLabel>
                        <Tooltip label="Refresh port list">
                          <ActionIcon size="xs" variant="light" color="teal" onClick={fetchDynamicPorts} loading={portsLoading}>
                            <IconRefresh size={12} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                      <Select
                        data={dynamicPorts.length > 0
                          ? dynamicPorts
                          : COM_PORTS}
                        value={form.milkAnalyzerConfig.comPort}
                        onChange={v => setSub('milkAnalyzerConfig', 'comPort', v)}
                        searchable
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                        placeholder="Select or type port"
                      />
                    </Box>

                    <Box>
                      <FieldLabel>Baud Rate</FieldLabel>
                      <Select
                        data={BAUD_RATES}
                        value={String(form.milkAnalyzerConfig.baudRate)}
                        onChange={v => setSub('milkAnalyzerConfig', 'baudRate', Number(v))}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>

                    <Divider color={TEAL_BORDER} my={2} />

                    {/* Start / Stop buttons */}
                    <Group gap="xs" grow>
                      <Button
                        size="xs"
                        color="teal"
                        leftSection={<IconPlug size={13} />}
                        disabled={analyzerRunning}
                        loading={analyzerStarting}
                        onClick={handleStartAnalyzer}
                      >
                        Start Analyzer
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        variant="outline"
                        leftSection={<IconPlugConnectedX size={13} />}
                        disabled={!analyzerRunning}
                        loading={analyzerStopping}
                        onClick={handleStopAnalyzer}
                      >
                        Stop Analyzer
                      </Button>
                    </Group>

                  </Stack>
                </SectionCard>
              </Grid.Col>

              {/* Other Analyzer — Manual Configuration */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <SectionCard icon={IconAdjustments} title="Other Analyzer — Manual Config" badge="Position Config">
                  <Stack gap="sm">
                    <Grid gutter="sm">
                      <Grid.Col span={6}>
                        <FieldLabel>FAT Pos Start</FieldLabel>
                        <NumberInput
                          value={form.otherAnalyzerConfig.fatPosStart}
                          onChange={v => setSub('otherAnalyzerConfig', 'fatPosStart', v ?? 0)}
                          min={0}
                          size="sm"
                          radius="sm"
                          styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <FieldLabel>FAT Pos End</FieldLabel>
                        <NumberInput
                          value={form.otherAnalyzerConfig.fatPosEnd}
                          onChange={v => setSub('otherAnalyzerConfig', 'fatPosEnd', v ?? 0)}
                          min={0}
                          size="sm"
                          radius="sm"
                          styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <FieldLabel>SNF Pos Start</FieldLabel>
                        <NumberInput
                          value={form.otherAnalyzerConfig.snfPosStart}
                          onChange={v => setSub('otherAnalyzerConfig', 'snfPosStart', v ?? 0)}
                          min={0}
                          size="sm"
                          radius="sm"
                          styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <FieldLabel>SNF Pos End</FieldLabel>
                        <NumberInput
                          value={form.otherAnalyzerConfig.snfPosEnd}
                          onChange={v => setSub('otherAnalyzerConfig', 'snfPosEnd', v ?? 0)}
                          min={0}
                          size="sm"
                          radius="sm"
                          styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                        />
                      </Grid.Col>
                    </Grid>
                    <Box>
                      <FieldLabel>Output Length</FieldLabel>
                      <NumberInput
                        value={form.otherAnalyzerConfig.outputLen}
                        onChange={v => setSub('otherAnalyzerConfig', 'outputLen', v ?? 0)}
                        min={0}
                        size="sm"
                        radius="sm"
                        styles={{ input: { borderColor: TEAL_BORDER, fontSize: 13 } }}
                      />
                    </Box>

                    {/* Buffer diagram hint */}
                    <Box
                      p="xs"
                      style={{
                        background  : '#f8fafc',
                        border      : `1px dashed ${TEAL_BORDER}`,
                        borderRadius: 6,
                        marginTop   : 4,
                      }}
                    >
                      <Text
                        size="xs"
                        style={{ color: TEXT_MUTED, fontFamily: 'monospace', lineHeight: 1.8 }}
                      >
                        Buffer:&nbsp;
                        <span style={{ color: TEAL, fontWeight: 700 }}>
                          [ 0 1 2 3 4 5 6 7 8 9 … ]
                        </span>
                        <br />
                        FAT: start → end &nbsp;|&nbsp; SNF: start → end
                      </Text>
                    </Box>
                  </Stack>
                </SectionCard>
              </Grid.Col>
            </Grid>

          </Stack>
        </Grid.Col>
      </Grid>

      {/* ════════════════════════════════════════════════════════════════════
          FOOTER SAVE BAR
      ════════════════════════════════════════════════════════════════════ */}
      <Box
        mt="lg"
        p="md"
        style={{
          background  : CARD_BG,
          border      : `1.5px solid ${TEAL_BORDER}`,
          borderRadius: 10,
          boxShadow   : '0 2px 8px rgba(13,148,136,0.08)',
        }}
      >
        <Group justify="space-between" align="center">
          <Text size="xs" style={{ color: TEXT_MUTED }}>
            All settings are saved per company. Restart the collection session after modifying hardware configuration.
          </Text>
          <Group gap="sm">
            <Button
              size="sm"
              variant="light"
              color="orange"
              radius="md"
              leftSection={<IconRefresh size={15} />}
              loading={resetting}
              onClick={handleReset}
            >
              Reset to Defaults
            </Button>
            <Button
              size="sm"
              color="teal"
              radius="md"
              style={{ background: TEAL }}
              leftSection={<IconDeviceFloppy size={15} />}
              loading={saving}
              onClick={handleSave}
            >
              Save All Settings
            </Button>
          </Group>
        </Group>
      </Box>

    </Box>
  );
}
