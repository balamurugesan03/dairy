import { useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { AppShell, Group, Text, Menu, Button, Drawer, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconHome, IconUsers, IconBox, IconShoppingCart, IconBook,
  IconCash, IconFileReport, IconShield, IconTool, IconSearch,
  IconSpeakerphone, IconBriefcase, IconChevronDown, IconMenu2, IconLogout, IconUser,
  IconUserCog
} from '@tabler/icons-react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../common/ThemeToggle';
import CompanySwitcher from '../company/CompanySwitcher';

const MainLayout = () => {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedBusinessType } = useCompany();
  const { user, logout, isAdmin } = useAuth();

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
      icon: <IconHome size={20} />,
      label: 'Dashboard'
    },
    {
      key: 'party-menu',
      icon: <IconUsers size={20} />,
      label: 'Party Creation',
      children: [
        { key: '/farmers', label: 'Farmer Management' },
        { key: '/customers', label: 'Customer Management' },
        { key: '/suppliers', label: 'Supplier Management' },
        { key: '/collection-centers', label: 'Collection Centre Management' },
        { key: '/subsidies', label: 'Subsidy Management' }
      ]
    },
    {
      key: 'inventory-menu',
      icon: <IconBox size={20} />,
      label: 'Inventory',
      children: [
        { key: '/inventory/items', label: 'Item Master' },
        { key: '/inventory/stock-in', label: 'Stock In/ Purchase' },
        { key: '/inventory/stock-out', label: 'Stock Out / Sale' },
        { key: '/inventory/report', label: 'Stock Report' }
      ]
    },
    {
      key: 'sales-menu',
      icon: <IconShoppingCart size={20} />,
      label: 'Sales & Billing',
      children: [
        { key: '/sales/new', label: 'Sales Bill' },
        { key: '/sales/list', label: 'Sales Report' }
      ]
    },
    {
      key: 'accounting-menu',
      icon: <IconBook size={20} />,
      label: 'Accounting',
      children: [
        
        { key: '/accounting/ledgers', label: 'Ledgers' },
        { key: '/accounting/receipt', label: 'Receipt Voucher' },
        { key: '/accounting/payment', label: 'Payment Voucher' },
        { key: '/accounting/journal', label: 'Journal Voucher' },
        { key: '/accounting/vouchers', label: 'Vouchers Management' },
        { key: '/accounting/outstanding', label: 'Outstanding Report' }
      ]
    },
   
    {
      key: 'payments-menu',
      icon: <IconCash size={20} />,
      label: 'Farmer Payments',
      children: [
        { key: '/payments/milk', label: 'Milk Payment' },
        { key: '/payments/advance', label: 'Give Advance' },
        { key: '/payments/advances', label: 'Advance List' },
        { key: '/payments/history', label: 'Payment History' }
      ]
    },
    {
      key: 'reports-menu',
      icon: <IconFileReport size={20} />,
      label: 'Reports',
      children: selectedBusinessType === 'Private Firm'
        ? [
            { key: '/reports/vyapar/sale-report', label: 'Sale Report' },
            { key: '/reports/vyapar/purchase-report', label: 'Purchase Report' },
            { key: '/reports/vyapar/party-statement', label: 'Party Statement' },
            { key: '/reports/vyapar/cashflow', label: 'Cashflow' },
            { key: '/reports/vyapar/all-transactions', label: 'All Transactions' },
            { key: '/reports/vyapar/profit-loss', label: 'Profit & Loss' },
            { key: '/reports/vyapar/balance-sheet', label: 'Balance Sheet' },
            { key: '/reports/vyapar/bill-profit', label: 'Bill Wise Profit' },
            { key: '/reports/vyapar/party-profit', label: 'Party Wise Profit' },
            { key: '/reports/vyapar/trial-balance', label: 'Trial Balance' },
            { key: '/reports/vyapar/stock-summary', label: 'Stock Summary' },
            { key: '/reports/vyapar/item-by-party', label: 'Item by Party' },
            { key: '/reports/vyapar/item-profit', label: 'Item Wise Profit' },
            { key: '/reports/vyapar/low-stock', label: 'Low Stock' },
            { key: '/reports/vyapar/bank-statement', label: 'Bank Statement' },
            { key: '/reports/vyapar/all-parties', label: 'All Parties' }
          ]
        : [
            { key: '/reports/cash-book', label: 'Cash Book' },
            { key: '/reports/daybook', label: 'Day Book' },
            { key: '/reports/general-ledger', label: 'General Ledger' },
            { key: '/reports/ledger-abstract', label: 'Ledger Abstract' },
            { key: '/reports/rd-enhanced', label: 'R&D Enhanced' },
            { key: '/reports/final-accounts', label: 'Final Accounts' },
            // { key: '/reports/trading', label: 'Trading Account' },
            // { key: '/reports/pl', label: 'Profit & Loss' },
            { key: '/reports/balance-sheet', label: 'Balance Sheet' },
            { key: '/reports/sales', label: 'Sales Report' },
            { key: '/reports/stock', label: 'Stock Report' },
            { key: '/reports/subsidy', label: 'Subsidy Report' },
            { key: '/reports/purchase-register', label: 'Purchase Register' }
          ]
    },
    {
      key: 'warranty-menu',
      icon: <IconShield size={20} />,
      label: 'Warranty',
      children: [
        { key: '/warranty', label: 'Warranty List' },
        { key: '/warranty/add', label: 'Add Warranty' }
      ]
    },
    {
      key: 'machines-menu',
      icon: <IconTool size={20} />,
      label: 'Machines',
      children: [
        { key: '/machines', label: 'Machine List' },
        { key: '/machines/add', label: 'Add Machine' }
      ]
    },
    {
      key: 'quotations-menu',
      icon: <IconSearch size={20} />,
      label: 'Quotations',
      children: [
        { key: '/quotations', label: 'Quotation List' },
        { key: '/quotations/add', label: 'Add Quotation' }
      ]
    },
    {
      key: 'promotions-menu',
      icon: <IconSpeakerphone size={20} />,
      label: 'Promotions',
      children: [
        { key: '/promotions', label: 'Promotion List' },
        { key: '/promotions/add', label: 'Add Promotion' }
      ]
    },
    
    {
      key: 'hrm-menu',
      icon: <IconBriefcase size={20} />,
      label: 'Human Resources',
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
      icon: <IconUserCog size={20} />,
      label: 'User Management',
      adminOnly: true
    }] : [])
    ];

    // Filter menu items based on selected business type
    if (selectedBusinessType === 'Dairy Cooperative Society') {
      return allMenuItems.filter(item => {
        // Always include User Management for admins
        if (item.adminOnly && isAdmin) return true;

        const allowedKeys = [
          '/',
          'party-menu',
          'inventory-menu',
          'sales-menu',
          'accounting-menu',
          'cashbook-menu',
          'payments-menu',
          'reports-menu',
          'subsidies-menu',
          'hrm-menu'
        ];
        return allowedKeys.includes(item.key);
      });
    } else if (selectedBusinessType === 'Private Firm') {
      return allMenuItems.filter(item => {
        // Always include User Management for admins
        if (item.adminOnly && isAdmin) return true;

        const allowedKeys = [
          '/',
          'party-menu',
          'inventory-menu',
          'sales-menu',
          'accounting-menu',
          'cashbook-menu',
          'reports-menu',
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
    if (item.children) {
      return (
        <Menu key={item.key} trigger="click" closeOnItemClick={true}>
          <Menu.Target>
            <Button
              variant="subtle"
              leftSection={item.icon}
              rightSection={<IconChevronDown size={16} />}
              size="sm"
              styles={{
                root: {
                  color: 'inherit',
                  '&:hover': {
                    backgroundColor: 'var(--mantine-color-gray-1)',
                  },
                },
              }}
            >
              {item.label}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {item.children.map((child) => (
              <Menu.Item
                key={child.key}
                onClick={() => handleMenuClick(child.key)}
                style={{
                  backgroundColor: location.pathname === child.key ? 'var(--mantine-color-blue-1)' : undefined,
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
        variant={location.pathname === item.key ? 'light' : 'subtle'}
        leftSection={item.icon}
        onClick={() => handleMenuClick(item.key)}
        size="sm"
        styles={{
          root: {
            color: 'inherit',
          },
        }}
      >
        {item.label}
      </Button>
    );
  };

  return (
    <AppShell header={{ height: 110 }} padding="md">
      <AppShell.Header>
        <div style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Group h={60} px="md" justify="space-between">
            <Group>
              <Button
                variant="subtle"
                onClick={toggleMobile}
                hiddenFrom="md"
                size="sm"
                leftSection={<IconMenu2 size={18} />}
              >
                Menu
              </Button>
              <Text fw={600} size="lg">Dairy Cooperative Management System</Text>
            </Group>
            <Group gap="md">
              <CompanySwitcher />
              <ThemeToggle />
              <Menu position="bottom-end" shadow="md">
                <Menu.Target>
                  <Button
                    variant="subtle"
                    leftSection={<IconUser size={18} />}
                    rightSection={<IconChevronDown size={14} />}
                    size="sm"
                  >
                    {user?.displayName || user?.username || 'User'}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Account</Menu.Label>
                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    color="red"
                    onClick={handleLogout}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </div>

        <Group h={50} px="md" gap="xs" visibleFrom="md" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {menuItems.map(renderHorizontalMenuItem)}
        </Group>
      </AppShell.Header>

      <Drawer
        opened={mobileOpened}
        onClose={toggleMobile}
        title="Menu"
        hiddenFrom="md"
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {menuItems.map((item) => {
            if (item.children) {
              return (
                <div key={item.key}>
                  <Text size="sm" fw={600} mb="xs" c="dimmed">
                    {item.label}
                  </Text>
                  {item.children.map((child) => (
                    <Button
                      key={child.key}
                      variant={location.pathname === child.key ? 'light' : 'subtle'}
                      onClick={() => handleMenuClick(child.key)}
                      fullWidth
                      justify="flex-start"
                      size="sm"
                      mb={4}
                    >
                      {child.label}
                    </Button>
                  ))}
                </div>
              );
            }
            return (
              <Button
                key={item.key}
                variant={location.pathname === item.key ? 'light' : 'subtle'}
                leftSection={item.icon}
                onClick={() => handleMenuClick(item.key)}
                fullWidth
                justify="flex-start"
                size="sm"
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </Drawer>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};

export default MainLayout;
