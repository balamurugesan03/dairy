/**
 * MainLayout - Professional Navigation Design
 * ============================================
 *
 * Attractive gradient header with modern menu styling.
 * Clean, professional, and responsive design.
 */

import { useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  AppShell,
  Group,
  Text,
  Menu,
  Button,
  Drawer,
  ActionIcon,
  Tooltip,
  Box,
  Avatar,
  Badge,
  Divider,
  Stack,
  Paper,
  ScrollArea,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconHome, IconUsers, IconBox, IconShoppingCart, IconBook,
  IconCash, IconFileReport, IconShield, IconTool, IconSearch,
  IconSpeakerphone, IconBriefcase, IconChevronDown, IconMenu2, IconLogout, IconUser,
  IconUserCog, IconBuildingStore, IconSettings
} from '@tabler/icons-react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemeSwitcherCompact } from '../common/ThemeSwitcher';
import CompanySwitcher from '../company/CompanySwitcher';

const MainLayout = () => {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompany, selectedBusinessType } = useCompany();
  const { user, logout, isAdmin } = useAuth();
  const { colorScheme, currentThemeConfig } = useTheme();

  const isDark = colorScheme === 'dark';

  // Header gradient based on theme
  const headerGradient = isDark
    ? 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)'
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  // Menu bar gradient - attractive light blue/teal gradient
  const menuBarBg = isDark
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
    : 'linear-gradient(135deg, #e0f7fa 0%, #e8eaf6 100%)';

  // Menu text color
  const menuTextColor = isDark ? '#e0e0e0' : '#4a5568';

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  // Function to filter menu items based on business type
  const getFilteredMenuItems = () => {
    const allMenuItems = [
    {
      key: '/',
      icon: <IconHome size={18} />,
      label: 'Dashboard',
      color: 'blue'
    },
    // DAIRY COOPERATIVE - Farmers Management (Producer, Collection Centre, Customer)
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'party-menu',
      icon: <IconUsers size={18} />,
      label: 'Farmers Management',
      color: 'green',
      children: [
        { key: '/farmers', label: 'Producer Management' },
        { key: '/collection-centers', label: 'Collection Centre' },
        { key: '/customers', label: 'Customer' },
      ]
    }] : []),
    // PRIVATE FIRM - Customer Module Only
    ...(selectedBusinessType === 'Private Firm' ? [{
      key: 'customer-menu',
      icon: <IconUsers size={18} />,
      label: 'Customer',
      color: 'green',
      children: [
        { key: '/customers', label: 'Customer Details' },
      ]
    }] : []),
    // DAIRY COOPERATIVE - Milk Purchase & Sales
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'sales-menu',
      icon: <IconShoppingCart size={18} />,
      label: 'Milk purchase & Sales',
      color: 'teal',
      children: []
    }] : []),
    // DAIRY INVENTORY - Only show for Dairy Cooperative Society
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'inventory-menu',
      icon: <IconBox size={18} />,
      label: 'Dairy Inventory',
      color: 'orange',
      children: [
        { key: '/inventory/items', label: 'Add Items' },
        { key: '/inventory/stock-in', label: 'Inventory Purchase' },
        { key: '/sales/new', label: 'Inventory Sales' },
        { key: '/inventory/stock-out', label: 'Stock Returns' },
        { key: '/suppliers', label: 'Supplier' },
        { key: '/subsidies', label: 'Subsidy' },
        { key: '/sales/list', label: 'Sales Report' },
        { key: '/inventory/report', label: 'Stock Report' },
        { key: '/reports/purchase-register', label: 'Purchase Register' },
        { key: '/reports/sales', label: 'Sales Register' },
        { key: '/reports/stock', label: 'Stock Register' },
        { key: '/reports/subsidy', label: 'Subsidy Register' }
      ]
    }] : []),
    // BUSINESS INVENTORY - Only show for Private Firm
    ...(selectedBusinessType === 'Private Firm' ? [{
      key: 'business-inventory-menu',
      icon: <IconBox size={18} />,
      label: 'Business Inventory',
      color: 'orange',
      children: [
        { key: '/business-inventory/items', label: 'Item Master' },
        { key: '/business-inventory/stock-in', label: 'Purchase / Stock In' },
        { key: '/business-inventory/sales/new', label: 'Create Invoice' },
        { key: '/business-inventory/sales/list', label: 'Sales Invoices' },
        { key: '/business-inventory/stock-out', label: 'Stock Out / Returns' },
        { key: '/suppliers', label: 'Supplier' },
        { key: '/business-inventory/stock-report', label: 'Stock Report' }
      ]
    }] : []),
    // DAIRY COOPERATIVE - Producers dues (Only for Dairy)
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'payments-menu',
      icon: <IconCash size={18} />,
      label: 'Producers dues',
      color: 'cyan',
      children: [
        { key: '/payments/register', label: 'Milk Payment Register' },
        { key: '/payments/individual', label: 'Individual Payment' },
        { key: '/payments/producer-register', label: 'Producer Register' },
        { key: '/payments/producer-register-summary', label: 'Producer Summary' },
        { key: '/payments/bank-transfer', label: 'Bank Transfer' },
        { key: '/payments/loans', label: 'Loans' },
        { key: '/payments/cash-advance', label: 'Cash Advance' },
        { key: '/payments/receipts', label: 'Receipts' },
        { key: '/payments/farmer-ledger', label: 'Farmer Ledger' }
      ]
    }] : []),
  
    // DAIRY COOPERATIVE - Accounts with all reports
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'accounting-menu',
      icon: <IconBook size={18} />,
      label: 'Accounts',
      color: 'violet',
      children: [
        { key: '/accounting/ledgers', label: 'Ledgers' },
        { key: '/accounting/receipt', label: 'Receipt Voucher' },
        { key: '/accounting/payment', label: 'Payment Voucher' },
        { key: '/accounting/journal', label: 'Adjustment/Journal Entry' },
        { key: '/accounting/vouchers', label: 'Vouchers Management' },
        { key: '/accounting/outstanding', label: 'Outstanding Report' },
        { key: '/reports/cash-book', label: 'Cash Book' },
        { key: '/reports/daybook', label: 'Day Book' },
        { key: '/reports/general-ledger', label: 'General Ledger' },
        { key: '/reports/ledger-abstract', label: 'Ledger Abstract' },
        { key: '/reports/rd-enhanced', label: 'R&D Enhanced' },
        { key: '/reports/final-accounts', label: 'Final Accounts' },
        { key: '/reports/balance-sheet', label: 'Balance Sheet' },
        { key: '/reports/milk-bill-abstract', label: 'Milk Bill Abstract' }
      ]
    }] : []),
    // PRIVATE FIRM - Business Accounts (Separate from Dairy)
    ...(selectedBusinessType === 'Private Firm' ? [{
      key: 'accounting-menu',
      icon: <IconBook size={18} />,
      label: 'Accounts',
      color: 'violet',
      children: [
        { key: '/business-accounting/ledgers', label: 'Ledger' },
        { key: '/business-accounting/income', label: 'Income Voucher' },
        { key: '/business-accounting/expense', label: 'Expense Voucher' },
        { key: '/business-accounting/journal', label: 'Adjustment/Journal Entry' },
        { key: '/business-accounting/vouchers', label: 'Vouchers Management' }
      ]
    }] : []),
   
    // DAIRY COOPERATIVE REPORTS - Only show for Dairy Cooperative
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'dairy-reports-menu',
      icon: <IconFileReport size={18} />,
      label: 'Dairy Reports',
      color: 'pink',
      children: [
        { key: '/reports/sales', label: 'Sales Report' },
        { key: '/reports/stock', label: 'Stock Report' },
        { key: '/reports/stock-register', label: 'Stock Register' },
        { key: '/reports/purchase-register', label: 'Purchase Register' },
        { key: '/reports/subsidy', label: 'Subsidy Report' },
        { key: '/reports/milk-bill-abstract', label: 'Milk Bill Abstract' },
        { key: '/reports/rd-enhanced', label: 'R&D Statement' },
        { key: '/reports/final-accounts', label: 'Final Accounts' },
        { key: '/reports/balance-sheet', label: 'Balance Sheet' }
      ]
    }] : []),
    // BUSINESS (VYAPAR) REPORTS - Only show for Private Firm
    ...(selectedBusinessType === 'Private Firm' ? [{
      key: 'vyapar-reports-menu',
      icon: <IconFileReport size={18} />,
      label: 'Business Reports',
      color: 'pink',
      children: [
        { key: '/reports/vyapar/sale-report', label: 'Sale Report' },
        { key: '/reports/vyapar/purchase-report', label: 'Purchase Report' },
        { key: '/reports/vyapar/party-statement', label: 'Party Statement' },
        { key: '/reports/vyapar/all-parties', label: 'All Parties' },
         { key: '/reports/vyapar/cash-in-hand', label: 'CashFlow' },
        // { key: '/reports/vyapar/cashflow', label: 'Cashflow' },
        { key: '/reports/vyapar/all-transactions', label: 'All Transactions' },
        { key: '/reports/vyapar/profit-loss', label: 'Profit & Loss' },
        { key: '/reports/vyapar/balance-sheet', label: 'Balance Sheet' },
        { key: '/reports/vyapar/trial-balance', label: 'Trial Balance' },
        { key: '/reports/vyapar/bill-profit', label: 'Bill Wise Party Report' },
        { key: '/reports/vyapar/party-profit', label: 'Party Wise Profit' },
        { key: '/reports/vyapar/item-profit', label: 'Item Wise Profit' },
        { key: '/reports/vyapar/stock-summary', label: 'Stock Summary' },
        { key: '/reports/vyapar/low-stock', label: 'Low Stock Alert' },
        { key: '/reports/vyapar/item-by-party', label: 'Item by Party' },
        
      ]
    }] : []),
    {
      key: 'warranty-menu',
      icon: <IconShield size={18} />,
      label: 'Warranty',
      color: 'grape',
      children: [
        { key: '/warranty', label: 'Warranty List' },
        { key: '/warranty/add', label: 'Add Warranty' },
        { key: '/reports/vyapar/bank-statement', label: 'Bank Statement' },
        { key: '/reports/vyapar/gstr1', label: 'GSTR-1' },
        { key: '/reports/vyapar/gstr2', label: 'GSTR-2' }
        
      ]
    },
    {
      key: 'machines-menu',
      icon: <IconTool size={18} />,
      label: 'Machines',
      color: 'indigo',
      children: [
        { key: '/machines', label: 'Machine List' },
        { key: '/machines/add', label: 'Add Machine' }
      ]
    },
    {
      key: 'quotations-menu',
      icon: <IconSearch size={18} />,
      label: 'Quotations',
      color: 'lime',
      children: [
        { key: '/quotations', label: 'Quotation List' },
        { key: '/quotations/add', label: 'Add Quotation' }
      ]
    },
    {
      key: 'promotions-menu',
      icon: <IconSpeakerphone size={18} />,
      label: 'Promotions',
      color: 'yellow',
      children: [
        { key: '/promotions', label: 'Promotion List' },
        { key: '/promotions/add', label: 'Add Promotion' }
      ]
    },
    {
      key: 'hrm-menu',
      icon: <IconBriefcase size={18} />,
      label: 'Human Resources',
      color: 'red',
      children: [
        { key: '/hrm/employees', label: 'Employees' },
        { key: '/hrm/departments', label: 'Departments' },
        { key: '/hrm/designations', label: 'Designations' },
        { key: '/hrm/attendance', label: 'Attendance' },
        { key: '/hrm/leaves', label: 'Leave Management' },
        { key: '/hrm/salary', label: 'Salary Management' }
      ]
    },
    // User Management - Only show for admins
    ...(isAdmin ? [{
      key: '/user-management',
      icon: <IconUserCog size={18} />,
      label: 'User Management',
      color: 'gray',
      adminOnly: true
    }] : [])
    ];

    // Filter menu items based on selected business type
    if (selectedBusinessType === 'Dairy Cooperative Society') {
      return allMenuItems.filter(item => {
        if (item.adminOnly && isAdmin) return true;
        const allowedKeys = [
          '/',
          'party-menu',
          'inventory-menu',  // Dairy inventory
          'sales-menu',
          'accounting-menu',
          'cashbook-menu',
          'payments-menu',
          'dairy-reports-menu',
          'subsidies-menu',
          'hrm-menu'
        ];
        return allowedKeys.includes(item.key);
      });
    } else if (selectedBusinessType === 'Private Firm') {
      return allMenuItems.filter(item => {
        if (item.adminOnly && isAdmin) return true;
        const allowedKeys = [
          '/',
          'customer-menu',  // Only Customer module (NOT Farmers Management)
          'business-inventory-menu',  // Business inventory (NOT dairy inventory)
          'accounting-menu',
          'cashbook-menu',
          'vyapar-reports-menu',
          'warranty-menu',
          'machines-menu',
          'quotations-menu',
          'promotions-menu',
          'hrm-menu'
        ];
        return allowedKeys.includes(item.key);
      });
    }

    return allMenuItems;
  };

  const menuItems = getFilteredMenuItems();

  const handleMenuClick = (key) => {
    navigate(key);
    if (mobileOpened) {
      toggleMobile();
    }
  };

  const renderHorizontalMenuItem = (item) => {
    const isActive = location.pathname === item.key ||
      (item.children && item.children.some(child => location.pathname === child.key));

    if (item.children) {
      return (
        <Menu key={item.key} trigger="hover" openDelay={100} closeDelay={200} shadow="lg" width={220}>
          <Menu.Target>
            <Button
              variant={isActive ? 'filled' : 'subtle'}
              leftSection={item.icon}
              rightSection={<IconChevronDown size={14} />}
              size="sm"
              radius="md"
              color={isActive ? item.color : undefined}
              styles={{
                root: {
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  color: isActive ? undefined : menuTextColor,
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(102, 126, 234, 0.15)',
                    color: isDark ? '#fff' : '#667eea',
                  },
                },
              }}
            >
              {item.label}
            </Button>
          </Menu.Target>
          <Menu.Dropdown
            style={{
              border: 'none',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              borderRadius: '12px',
            }}
          >
            {item.children.map((child) => (
              <Menu.Item
                key={child.key}
                onClick={() => handleMenuClick(child.key)}
                style={{
                  borderRadius: '8px',
                  margin: '4px',
                  fontWeight: location.pathname === child.key ? 600 : 400,
                  backgroundColor: location.pathname === child.key
                    ? `var(--mantine-color-${item.color}-1)`
                    : undefined,
                  color: location.pathname === child.key
                    ? `var(--mantine-color-${item.color}-7)`
                    : undefined,
                }}
              >
                {child.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      );
    }

    return (
      <Button
        key={item.key}
        variant={isActive ? 'filled' : 'subtle'}
        leftSection={item.icon}
        onClick={() => handleMenuClick(item.key)}
        size="sm"
        radius="md"
        color={isActive ? item.color : undefined}
        styles={{
          root: {
            fontWeight: 600,
            transition: 'all 0.2s ease',
            color: isActive ? undefined : menuTextColor,
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(102, 126, 234, 0.15)',
              color: isDark ? '#fff' : '#667eea',
            },
          },
        }}
      >
        {item.label}
      </Button>
    );
  };

  return (
    <AppShell header={{ height: 120 }} padding="md">
      <AppShell.Header style={{ border: 'none' }}>
        {/* Top Header - Gradient Background */}
        <Box
          style={{
            background: headerGradient,
            padding: '12px 20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}
        >
          <Group justify="space-between" align="center">
            {/* Logo & Title */}
            <Group gap="md">
              <Button
                variant="white"
                onClick={toggleMobile}
                hiddenFrom="md"
                size="sm"
                leftSection={<IconMenu2 size={18} />}
                style={{ color: '#667eea' }}
              >
                Menu
              </Button>
              <Group gap="sm">
                <ThemeIcon
                  size={42}
                  radius="xl"
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <IconBuildingStore size={24} color="white" />
                </ThemeIcon>
                <Box>
                  <Text fw={700} size="lg" c="white" style={{ lineHeight: 1.2 }}>
                    {selectedCompany?.companyName || 'Dairy Cooperative'}
                  </Text>
                  <Text size="xs" c="rgba(255,255,255,0.8)">
                    Management System
                  </Text>
                </Box>
              </Group>
            </Group>

            {/* Right Section */}
            <Group gap="md">
              <CompanySwitcher />

              <Box
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <ThemeSwitcherCompact />
              </Box>

              {/* User Menu */}
              <Menu position="bottom-end" shadow="lg" width={200}>
                <Menu.Target>
                  <Button
                    variant="white"
                    leftSection={
                      <Avatar
                        size={28}
                        radius="xl"
                        color="violet"
                        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                      >
                        {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
                      </Avatar>
                    }
                    rightSection={<IconChevronDown size={14} />}
                    size="sm"
                    radius="xl"
                    styles={{
                      root: {
                        paddingLeft: 4,
                        background: 'rgba(255,255,255,0.9)',
                        color: '#333',
                        '&:hover': {
                          background: 'white',
                        },
                      },
                    }}
                  >
                    {user?.displayName || user?.username || 'User'}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown style={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
                  <Box p="sm">
                    <Text size="sm" fw={600}>{user?.displayName || user?.username}</Text>
                    <Text size="xs" c="dimmed">{user?.email || 'User'}</Text>
                    {isAdmin && (
                      <Badge size="xs" color="violet" mt={4}>Admin</Badge>
                    )}
                  </Box>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconSettings size={16} />}
                    style={{ borderRadius: '8px', margin: '4px' }}
                  >
                    Settings
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    color="red"
                    onClick={handleLogout}
                    style={{ borderRadius: '8px', margin: '4px' }}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Box>

        {/* Menu Bar - Colorful Gradient Background */}
        <Box
          style={{
            background: menuBarBg,
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(102, 126, 234, 0.15)',
            boxShadow: isDark ? '0 2px 15px rgba(0,0,0,0.3)' : '0 2px 15px rgba(102, 126, 234, 0.1)',
          }}
        >
          <ScrollArea scrollbarSize={4}>
            <Group h={52} px="md" gap={6} wrap="nowrap" visibleFrom="md">
              {menuItems.map(renderHorizontalMenuItem)}
            </Group>
          </ScrollArea>
        </Box>
      </AppShell.Header>

      {/* Mobile Drawer */}
      <Drawer
        opened={mobileOpened}
        onClose={toggleMobile}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" color="violet">
              <IconBuildingStore size={20} />
            </ThemeIcon>
            <Text fw={600}>Menu</Text>
          </Group>
        }
        hiddenFrom="md"
        size="xs"
        styles={{
          header: {
            background: isDark ? '#1e1e2e' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          },
          title: { color: 'white' },
          close: { color: 'white' },
        }}
      >
        <ScrollArea h="calc(100vh - 80px)" type="auto">
          <Stack gap="xs" p="xs">
            {menuItems.map((item) => {
              if (item.children) {
                return (
                  <Box key={item.key}>
                    <Group gap="xs" mb={8}>
                      <ThemeIcon size="sm" variant="light" color={item.color} radius="md">
                        {item.icon}
                      </ThemeIcon>
                      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                        {item.label}
                      </Text>
                    </Group>
                    <Stack gap={4} pl="md">
                      {item.children.map((child) => (
                        <Button
                          key={child.key}
                          variant={location.pathname === child.key ? 'light' : 'subtle'}
                          color={location.pathname === child.key ? item.color : 'gray'}
                          onClick={() => handleMenuClick(child.key)}
                          fullWidth
                          justify="flex-start"
                          size="sm"
                          radius="md"
                          styles={{
                            root: { fontWeight: location.pathname === child.key ? 600 : 400 },
                          }}
                        >
                          {child.label}
                        </Button>
                      ))}
                    </Stack>
                    <Divider my="sm" />
                  </Box>
                );
              }
              return (
                <Button
                  key={item.key}
                  variant={location.pathname === item.key ? 'light' : 'subtle'}
                  color={location.pathname === item.key ? item.color : 'gray'}
                  leftSection={item.icon}
                  onClick={() => handleMenuClick(item.key)}
                  fullWidth
                  justify="flex-start"
                  size="sm"
                  radius="md"
                  styles={{
                    root: { fontWeight: location.pathname === item.key ? 600 : 400 },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </ScrollArea>
      </Drawer>

      <AppShell.Main
        style={{
          background: isDark
            ? 'var(--mantine-color-dark-8)'
            : '#E3F2FD',
          minHeight: 'calc(100vh - 120px)',
        }}
      >
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};

export default MainLayout;
