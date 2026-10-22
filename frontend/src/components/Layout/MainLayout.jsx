import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
  Modal,
  Center,
  Loader,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconHome, IconUsers, IconBox, IconShoppingCart, IconBook,
  IconCash, IconFileReport, IconShield, IconTool, IconSearch,
  IconSpeakerphone, IconBriefcase, IconChevronDown, IconChevronRight, IconMenu2, IconLogout, IconUser,
  IconUserCog, IconBuildingStore, IconSettings, IconMilk, IconBuildingCommunity,
  IconCalendarEvent, IconAdjustments, IconReportAnalytics, IconX
} from '@tabler/icons-react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemeSwitcherCompact } from '../common/ThemeSwitcher';
import CompanySwitcher from '../company/CompanySwitcher';
import { MILK_POPUP_EVENT, MILK_POPUP_ROUTES } from '../../utils/milkPopup';

const MilkPurchase = lazy(() => import('../daily-collections/MilkPurchase'));
const MilkSales    = lazy(() => import('../daily-collections/MilkSales'));

const MainLayout = () => {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();

  const ITEMS_VISIBLE = 10;

  const [menuOrders, setMenuOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dairy_menu_orders') || '{}'); }
    catch { return {}; }
  });

  const getOrderedChildren = (item) => {
    if (!item.children) return [];
    const saved = menuOrders[item.key];
    if (!saved || saved.length === 0) return item.children;
    const map = Object.fromEntries(item.children.map(c => [c.key, c]));
    const ordered = saved.map(k => map[k]).filter(Boolean);
    const inSaved = new Set(saved);
    item.children.forEach(c => { if (!inSaved.has(c.key)) ordered.push(c); });
    return ordered;
  };

  const promoteToFront = (menuKey, childKey, allChildren) => {
    const keys = allChildren.map(c => c.key);
    const newOrder = [childKey, ...keys.filter(k => k !== childKey)];
    setMenuOrders(prev => {
      const updated = { ...prev, [menuKey]: newOrder };
      localStorage.setItem('dairy_menu_orders', JSON.stringify(updated));
      return updated;
    });
  };
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompany, selectedBusinessType } = useCompany();
  const { user, logout, isAdmin, isUser, isCentreLogin } = useAuth();
  const { colorScheme, currentThemeConfig } = useTheme();

  const isDark = colorScheme === 'dark';

  const isBankTransferPage = location.pathname === '/payments/bank-transfer';

  // Milk Purchase / Milk Sales popups — the ONE way both screens open (F2/F3,
  // P/S, menu, other pages via openMilkPopup). They are independent: both can
  // be open, opening/swapping only changes which is in front, and closing one
  // never touches the other.
  const [purchasePopupOpen, setPurchasePopupOpen] = useState(false);
  const [salesPopupOpen,    setSalesPopupOpen]    = useState(false);
  const [milkFront,         setMilkFront]         = useState('purchase');
  const setMilkPopup = useCallback((which) => {
    if (which === 'sales') setSalesPopupOpen(true);
    else                   setPurchasePopupOpen(true);
    setMilkFront(which === 'sales' ? 'sales' : 'purchase');
  }, []);
  const closePurchasePopup = useCallback(() => {
    setPurchasePopupOpen(false);
    setMilkFront('sales');
  }, []);
  const closeSalesPopup = useCallback(() => {
    setSalesPopupOpen(false);
    setMilkFront('purchase');
  }, []);
  const purchaseInFront = purchasePopupOpen && (milkFront === 'purchase' || !salesPopupOpen);
  const salesInFront    = salesPopupOpen    && (milkFront === 'sales'    || !purchasePopupOpen);

  // Other pages open the popups through this event (see utils/milkPopup.js)
  useEffect(() => {
    const onOpen = (e) => setMilkPopup(e.detail);
    window.addEventListener(MILK_POPUP_EVENT, onOpen);
    return () => window.removeEventListener(MILK_POPUP_EVENT, onOpen);
  }, [setMilkPopup]);

  // The old full-page routes (bookmarks, typed URLs) now open the popup instead
  useEffect(() => {
    const which = MILK_POPUP_ROUTES[location.pathname];
    if (!which) return;
    setMilkPopup(which); // eslint-disable-line react-hooks/set-state-in-effect
    navigate('/', { replace: true });
  }, [location.pathname, navigate, setMilkPopup]);

  // ── Global hotkeys ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      // F2 / F3 work everywhere (even inside inputs)
      // F2 / F3 open Milk Purchase / Milk Sales as a popup over the current page
      if (e.key === 'F2') { e.preventDefault(); setMilkPopup('purchase'); return; }
      if (e.key === 'F3') { e.preventDefault(); setMilkPopup('sales'); return; }
      if (e.key === 'F4') { e.preventDefault(); navigate('/sales/new'); return; }
      // F5 also carries a one-shot "open the New Cash Advance form" signal via
      // navigation state, so a single press opens the form directly instead
      // of needing a first F5 to land on the page and a second F5 (now
      // caught by that page's own listener) to actually open it.
      if (e.key === 'F5') { e.preventDefault(); navigate('/payments/cash-advance/voucher', { state: { openNewCashAdvance: true } }); return; }

      // Other shortcuts: ignore when typing inside an input / textarea / select
      const ae  = document.activeElement;
      const tag = ae?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ae?.isContentEditable) return;

      // P / S open Milk Purchase / Milk Sales. Once a milk popup is open it owns
      // P/S itself (swap), and any other open dialog keeps its own keys.
      const k = e.key?.toLowerCase();
      if ((k === 'p' || k === 's') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
        if (document.querySelector('[data-milk-popup], [role="dialog"]')) return;
        e.preventDefault();
        setMilkPopup(k === 's' ? 'sales' : 'purchase');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, setMilkPopup]);

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
        { key: '/agents', label: 'Agent Management' },
        { key: '/customers', label: 'Customer' },
        { key: '/farmer-bank-details', label: 'Farmer Bank Details' },
        
        { key: '/daily-collections/producer-report',        label: 'Producer Report' },
           { key: '/farmers/member-register', label: 'Member Register' },
        { key: '/farmers/report', label: 'Producer Report' },
      ]
    }] : []),
    // PRIVATE FIRM - Customer Module Only
    ...(selectedBusinessType === 'Private Firm' ? [{
      key: 'customer-menu',
      icon: <IconUsers size={18} />,
      label: 'Customer',
      color: 'green',
      children: [
        { key: '/business-customers', label: 'Customer Details' },
        { key: '/business-inventory/salesman', label: 'Salesman' },
      ]
    }] : []),
    // DAIRY COOPERATIVE - Daily Collections
    // ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
    //   key: 'daily-collections-menu',
    //   icon: <IconMilk size={18} />,
    //   label: 'Daily Collections',
    //   color: 'teal',
    //   children: [
     
    //   ]
    // }] : []),
    // DAIRY COOPERATIVE - Milk Purchase & Sales
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'sales-menu',
      icon: <IconShoppingCart size={18} />,
      label: 'Milk purchase & Sales',
      color: 'teal',
      children: [
        { key: '/daily-collections/milk-purchase', label: 'Milk Purchase' },
        { key: '/daily-collections/list',           label: 'Daily Collection List' },
        { key: '/daily-collections/milk-sales',     label: 'Milk Sales' },
        { key: '/daily-collections/union-sales-slip', label: 'Union Sales' },
        { key: '/daily-collections/farmer-wise-summary',   label: 'Farmer-Wise Summary' },
       
       
        { key: '/reports/salesman-balance', label: 'Salesman/Customer Ledger' },
        {
          key: 'milk-settings-sub',
          label: 'Settings & Configuration',
          children: [
            // Rate Chart Settings is not available to restricted (newly created) users
            ...(isUser ? [] : [{ key: '/daily-collections/rate-chart-settings', label: 'Rate Chart Settings' }]),
            { key: '/daily-collections/milk-purchase-settings', label: 'Machine Configuration' },
            { key: '/daily-collections/rate-charge-table',      label: 'Rate Charge Table'      },
            { key: '/daily-collections/milk-sales-rate',        label: 'Milk Sales Rate'        },
            { key: '/daily-collections/shift-incentive',        label: 'Shift Incentive'        },
            { key: '/daily-collections/time-incentive',         label: 'Time Incentive'         },
            { key: '/daily-collections/producer-openings',      label: 'Producer Openings'      },
          ]
        },
        
         {
          key: 'Reports',
          label: 'Reports',
          children: [
             { key: '/reports/dairy-register',      label: 'Dairy Register' },
             { key: '/reports/dairy-abstract',      label: 'Dairy Abstract' },
             { key: '/reports/milk-purchase-report', label: 'Milk Purchase Report' },
             { key: '/reports/milk-sales-report',    label: 'Milk Sales Report'    },
             { key: '/reports/union-sales-report',   label: 'Union Sales Report'   },
          ]
        },
      ]
    }] : []),
    // DAIRY INVENTORY - Only show for Dairy Cooperative Society
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'inventory-menu',
      icon: <IconBox size={18} />,
      label: 'Dairy Inventory',
      color: 'orange',
      children: [
        { key: '/suppliers', label: 'Supplier' },
        { key: '/inventory/items', label: 'Add Items' },
        { key: '/inventory/stock-in', label: 'Inventory Purchase' },
        { key: '/sales/new', label: 'Inventory Sales' },
        { key: '/sales/list', label: 'Sales List' },
        { key: '/inventory/stock-out', label: 'Stock Returns' },
        { key: '/inventory/purchase-returns/new', label: 'Purchase Return (Debit Note)' },
        { key: '/inventory/purchase-returns/list', label: 'Purchase Return List' },
        { key: '/inventory/sales-returns/list', label: 'Sales Return List' },
        
        { key: '/subsidies', label: 'Subsidy' },
        {
          key: 'inventory-reports-sub',
          label: 'Reports',
          children: [
            { key: '/reports/purchase-register', label: 'Purchase Report' },
            { key: '/reports/sales',             label: 'Sales Report' },
            { key: '/inventory/report',          label: 'Stock Report' },
            { key: '/reports/stock-register',    label: 'Stock Register' },
            { key: '/reports/subsidy',           label: 'Subsidy Register' },
            { key: '/reports/cf-abstract',       label: 'CF Abstract' },
          ]
        },
      ]
    }] : []),
    // BUSINESS INVENTORY - Only show for Private Firm
    ...(selectedBusinessType === 'Private Firm' ? [{

      






      
      key: 'business-inventory-menu',
      icon: <IconBox size={18} />,
      
      label: 'Business Inventory',
      color: 'orange',
      children: [
        { key: '/business-suppliers', label: 'Supplier' },
        { key: '/business-inventory/items', label: 'Item Master' },
        { key: '/business-inventory/stock-in', label: 'Purchase / Stock In' },
        { key: '/business-inventory/sales/new', label: 'Create Invoice' },
        { key: '/business-inventory/sales/list', label: 'Sales Invoices' },
        { key: '/business-inventory/stock-out', label: 'Stock Out / Returns' },
        { key: '/business-inventory/purchase-returns/new', label: 'Purchase Return' },
        { key: '/business-inventory/purchase-returns/list', label: 'Purchase Return List' },
        { key: '/business-inventory/sales-returns/list', label: 'Sales Return List' },
        { key: '/business-inventory/stock-report', label: 'Stock Report' },
        { key: '/reports/vyapar/stock-summary', label: 'Stock Summary' },
        { key: '/reports/vyapar/stock-statement', label: 'Stock Statement' },
        { key: '/reports/vyapar/low-stock', label: 'Low Stock Alert' }
      ]
    }] : []),
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
    
        { key: '/reports/vyapar/bill-profit', label: 'Bill Wise Party Report' },
        { key: '/reports/vyapar/party-profit', label: 'Party Wise Profit' },
        { key: '/reports/vyapar/item-profit', label: 'Item Wise Profit' },
        { key: '/reports/vyapar/item-by-party', label: 'Item by Party' },
              { key: '/reports/vyapar/bank-statement', label: 'Bank Statement' },
        { key: '/reports/vyapar/gstr1', label: 'GSTR-1' },
        { key: '/reports/vyapar/gstr2', label: 'GSTR-2' },
       
      ]
    }] : []),
    // DAIRY COOPERATIVE - Producers dues (Only for Dairy)
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'payments-menu',
      icon: <IconCash size={18} />,
      label: 'Producers dues',
      color: 'cyan',
      children: [
        
        { key: '/payments/receipts', label: ' Producer Receipts' },
        {
          key: 'payments-sub',
          label: 'Payments',
          children: [
            { key: '/payments/creditor-bill', label: 'Payment Register ' },
            { key: '/payments/register-ledger', label: 'Payment Register Detailed' },
            { key: '/payments/producer-payment', label: 'Payment Register (setteled)' },
            // { key: '/payments/register', label: 'Individual Payment' },
           
            { key: '/payments/bank-transfer', label: 'Bank Transfer' },
            { key: '/payments/ledger-history',  label: 'Ledger Payment History' },
            { key: '/payments/individual', label: 'Individual Payment' },
           
           
            { key: '/payments/payment-to-producer', label: 'Payment to Producer' },
          ]
        },
        {
          key: 'deductions-sub',
          label: 'Deductions / Earnings',
          children: [
            { key: '/payments/earning-deduction-master', label: 'Earnings / Deductions Master' },
            { key: '/payments/individual-deduction-earning', label: 'Individual' },
            { key: '/payments/historical-deduction-earning', label: 'Historical' },
            { key: '/payments/periodical-deduction-earning', label: 'Periodical Settings' },
          ]
        },
        {
          key: 'recoveries-sub',
          label: 'Recoveries',
          children: [
            { key: '/payments/loans',                label: 'Loans' },
            { key: '/payments/cash-advance',         label: 'Cash Advance' },
            { key: '/payments/cattle-feed-advance',  label: 'Cattle Feed Advance' },
          ]
        },
        {
          key: 'registers-sub',
          label: 'Registers / Reports',
          children: [
            { key: '/payments/producer-register',          label: 'Producer Register' },
            { key: '/payments/producer-register-summary',  label: 'Producer Summary' },
            { key: '/reports/milk-bill-report',            label: 'Milk Bill (Producer)' },
            { key: '/payments/farmer-ledger',              label: 'Producer Ledger' },
            { key: '/payments/payment-register-report',    label: 'Payment Register' },
            { key: '/payments/payment-paid-report',        label: 'Payment Paid Report' },
            { key: '/payments/payment-report',             label: 'Payment Report' },
          ]
        },
      ]
    }] : []),
  
    // DAIRY COOPERATIVE - Accounts with all reports
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'accounting-menu',
      icon: <IconBook size={18} />,
      label: 'Accounts',
      color: 'violet',
      children: [
        { key: '/accounting/ledgers',     label: 'Ledgers' },
        { key: '/accounting/receipt',     label: 'Receipt Voucher' },
        { key: '/accounting/payment',     label: 'Payment Voucher' },
        { key: '/accounting/cash-book-entry', label: 'Cash Book Entry' },
        { key: '/accounting/journal',     label: 'Adjustment/Journal Entry' },
        { key: '/accounting/vouchers',    label: 'Vouchers Management' },
        {
          key: 'accounts-reports-sub',
          label: 'Reports',
          children: [
            { key: '/reports/daybook',               label: 'Day Book' },
            { key: '/reports/cash-book',             label: 'Cash Book' },
            { key: '/reports/general-ledger',        label: 'General Ledger' },
            { key: '/reports/ledger-abstract',       label: 'Ledger Abstract' },
            { key: '/accounting/outstanding',        label: 'Outstanding Report' },
            { key: '/reports/rd-enhanced',           label: 'Receipt and Disbursements' },
            { key: '/reports/milk-bill-abstract',    label: 'Milk Bill Abstract' },
            // Inactive: kept in the menu (greyed, not clickable) so they can be re-activated later.
            { key: '/reports/trial-balance',         label: 'Trial Balance',       inactive: true },
            { key: '/reports/receipts-payments',     label: 'Receipts & Payments', inactive: true },
            { key: '/reports/final-accounts',        label: 'Final Accounts' },
          ]
        },
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
        { key: '/business-accounting/vouchers', label: 'Vouchers Management' },
         { key: '/reports/vyapar/day-book', label: 'Day Book' },
        { key: '/reports/vyapar/cash-book', label: 'Cash Book' },
         { key: '/reports/cooperative-rd', label: 'R&D Report (Receipt & Disbursement' },
        // { key: '/reports/vyapar/rd', label: 'Receipt & Disbursement' },
        
        { key: '/reports/vyapar/trading-account', label: 'Trading Account' },
        
            { key: '/reports/vyapar/profit-loss', label: 'Profit & Loss' },
        { key: '/reports/vyapar/balance-sheet', label: 'Balance Sheet' },
        { key: '/reports/vyapar/trial-balance', label: 'Trial Balance' }
       
      ]
    }] : []),
   
    // DAIRY COOPERATIVE REPORTS - Only show for Dairy Cooperative
    ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
      key: 'dairy-reports-menu',
      icon: <IconFileReport size={18} />,
      label: 'Dairy Reports',
      color: 'pink',


      children: [
       
        { key: '/reports/mis-report',          label: 'MIS Report' },
        { key: '/reports/monthly-mis-report',  label: 'Monthly MIS Report' },
        // { key: '/reports/ddd-mis-report',   label: 'DDD MIS Report' },
        { key: '/mis-department/report',      label: 'MIS Report Department' },
        { key: '/reports/inspection-report',     label: 'Inspection Report' },
        { key: '/reports/milk-statement',       label: 'Milk Statement' },
        { key: '/reports/cc-operating-cost',  label: 'BMCC Operating Cost'      },
         { key: '/daily-collections/farmer-criteria-report', label: 'Customized Quality Report' },
        { key: '/daily-collections/collection-analysis',    label: 'Milk Quality  Analysis' },
         { key: '/daily-collections/intelligent-query',     label: 'Intelligent Query'   },
        { key: '/farmers/crop-statements',   label: 'Crop Damage Statements' },
        { key: '/farmers/agri-stats',        label: 'Monthly Agri Statistics' },
        { key: '/daily-collections/incentive-register', label: 'Incentive Register' },
        { key: '/daily-collections/bonus-register',     label: 'Bonus Register' },

      ]
    }] : []),

    // // MIS REPORT DEPARTMENT - Separate standalone module for Dairy Cooperative
    // ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
    //   key: 'mis-department-menu',
    //   icon: <IconReportAnalytics size={18} />,
    //   label: 'MIS Report Department',
    //   color: 'red',
    //   children: [
    //     { key: '/mis-department/report', label: 'DDD MIS Report' },
    //   ]
    // }] : []),
    // BUSINESS (VYAPAR) REPORTS - Only show for Private Firm
   
 
     {
      key: 'quotations-menu',
      icon: <IconSearch size={18} />,
      label: 'Quotations',
      color: 'lime',
      children: [
          { key: '/quotations/add', label: 'Add Quotation' },
        { key: '/quotations', label: 'Quotation List' }
      
      ]
    },
    {
      key: 'machines-menu',
      icon: <IconTool size={18} />,
      label: 'Machines',
      color: 'indigo',
      children: [
         { key: '/machines/add', label: 'Add Machine' },
        { key: '/machines', label: 'Machine List' }
       
      ]
    },
       {
      key: 'warranty-menu',
      icon: <IconShield size={18} />,
      label: 'Warranty',
      color: 'grape',
      children: [
        { key: '/warranty/add', label: 'Add Warranty' },
        { key: '/warranty', label: 'Warranty List' },
        
  
        
      ]
    },
   
    // DAIRY COOPERATIVE - Basic Promotions
    // ...(selectedBusinessType === 'Dairy Cooperative Society' ? [{
    //   key: 'promotions-menu',
    //   icon: <IconSpeakerphone size={18} />,
    //   label: 'Promotions',
    //   color: 'yellow',
    //   children: [
    //     { key: '/promotions', label: 'Promotion List' },
    //     { key: '/promotions/add', label: 'Add Promotion' }
    //   ]
    // }] : []),
    // PRIVATE FIRM - Vyapar-style Business Promotions
    ...(selectedBusinessType === 'Private Firm' ? [{
      key: 'business-promotions-menu',
      icon: <IconSpeakerphone size={18} />,
      label: 'Promotions',
      color: 'yellow',
      children: [
        { key: '/business-promotions', label: 'Dashboard' },
        { key: '/business-promotions/coupons', label: 'Discount Coupons' },
        { key: '/business-promotions/offers', label: 'Offers & Schemes' },
        { key: '/business-promotions/campaigns', label: 'Campaigns' },
        { key: '/business-promotions/templates', label: 'Message Templates' }
      ]
    }] : []),
    {
      key: 'hrm-menu',
      icon: <IconBriefcase size={18} />,
      label: 'Human Resources',
      color: 'red',
      children: [
        { key: '/hrm/employees', label: 'Employees' },
        { key: '/hrm/attendance', label: 'Attendance' },
        { key: '/hrm/leaves', label: 'Leave Management' },
        { key: '/hrm/salary', label: 'Payroll' },
        { key: '/hrm/loans', label: 'Loans / Advance' }
      ]
    },
    // Settings — visible to everyone; restricted (newly created) users only get
    // Payment Settings, admins/superadmins see the full list.
    {
      key: 'settings-menu',
      icon: <IconAdjustments size={18} />,
      label: 'Settings',
      color: 'violet',
      children: isAdmin ? [
        { key: '/society-info',     label: 'Society Info' },
        { key: '/financial-year',   label: 'Financial Year' },
        { key: '/payment-settings', label: 'Payment Settings' },
        { key: '/openlyssa-merge',  label: 'OpenLyssa Merge Tool' },
        { key: '/user-management',  label: 'User Management' },
      ] : [
        { key: '/payment-settings', label: 'Payment Settings' },
      ]
    }
    ];

    // Sub-centre login: only Milk Collection + Milk Sales
    if (isCentreLogin) {
      return allMenuItems.filter(item => ['/', 'sales-menu'].includes(item.key)).map(item => {
        if (item.key !== 'sales-menu') return item;
        // Restrict sales-menu children to milk purchase, list, and milk sales only
        return {
          ...item,
          children: (item.children || []).filter(c =>
            ['/daily-collections/milk-purchase', '/daily-collections/list', '/daily-collections/milk-sales'].includes(c.key)
          )
        };
      });
    }

    // Filter menu items based on selected business type
    if (selectedBusinessType === 'Dairy Cooperative Society') {
      return allMenuItems.filter(item => {
        if (item.adminOnly && isAdmin) return true;
        const allowedKeys = [
          '/',
          'party-menu',
          'sales-menu',
          'inventory-menu',
          'accounting-menu',
          'payments-menu',
          'dairy-reports-menu',
          'hrm-menu',
          'settings-menu',
        ];
        return allowedKeys.includes(item.key);
      });
    } else if (selectedBusinessType === 'Private Firm') {
      return allMenuItems.filter(item => {
        if (item.adminOnly && isAdmin) return true;
        const allowedKeys = [
          '/',
          'customer-menu',
          'business-inventory-menu',
          'accounting-menu',
          'vyapar-reports-menu',
          'warranty-menu',
          'machines-menu',
          'quotations-menu',
          'business-promotions-menu',
          'hrm-menu',
          'settings-menu',
        ];
        return allowedKeys.includes(item.key);
      });
    }

    return allMenuItems;
  };

  const allMenuItems = getFilteredMenuItems();
  // Separate right-floated items (HRM, User Management)
  const rightKeys = ['hrm-menu', 'settings-menu'];
  const menuItems = allMenuItems.filter(item => !rightKeys.includes(item.key));
  const rightMenuItems = allMenuItems.filter(item => rightKeys.includes(item.key));

  const handleMenuClick = (key) => {
    // Milk Purchase / Milk Sales open the same popups as F2 / F3
    if (MILK_POPUP_ROUTES[key]) setMilkPopup(MILK_POPUP_ROUTES[key]);
    else navigate(key);
    if (mobileOpened) {
      toggleMobile();
    }
  };

  // Renders menu children with "More" flyout for items beyond 10.
  // Sub-menu groups (e.g. Dairy Inventory → Reports) are never tucked under
  // "More" — they always render directly, after the plain items.
  const renderMenuChildren = (item) => {
    const ordered = getOrderedChildren(item);
    const leaves = ordered.filter(c => !c.children);
    const groups = item.children.filter(c => c.children);
    const visible = leaves.slice(0, ITEMS_VISIBLE);
    const hidden = leaves.slice(ITEMS_VISIBLE);

    return (
      <>
        {visible.map(child => renderDropdownItem(child, item.color, item.key, ordered))}
        {groups.map(child => renderDropdownItem(child, item.color, item.key, ordered))}
        {hidden.length > 0 && (
          <Menu trigger="hover" position="right-start" offset={0} shadow="lg" width={230}>
            <Menu.Target>
              <Menu.Item
                rightSection={<IconChevronRight size={14} />}
                style={{
                  borderRadius: '8px',
                  margin: '4px',
                  fontWeight: 600,
                  color: `var(--mantine-color-${item.color}-6)`,
                  borderTop: '1px dashed var(--mantine-color-default-border)',
                  marginTop: '6px',
                }}
              >
                More ({hidden.length})
              </Menu.Item>
            </Menu.Target>
            <Menu.Dropdown style={{ border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', borderRadius: '12px' }}>
              {hidden.map(child =>
                child.children
                  ? renderDropdownItem(child, item.color, item.key, ordered)
                  : (
                    <Menu.Item
                      key={child.key}
                      onMouseDown={() => {
                        promoteToFront(item.key, child.key, ordered);
                        handleMenuClick(child.key);
                      }}
                      style={{
                        borderRadius: '8px',
                        margin: '4px',
                        fontWeight: location.pathname === child.key ? 600 : 400,
                        backgroundColor: location.pathname === child.key ? `var(--mantine-color-${item.color}-1)` : undefined,
                        color: location.pathname === child.key ? `var(--mantine-color-${item.color}-7)` : undefined,
                      }}
                    >
                      {child.label}
                    </Menu.Item>
                  )
              )}
            </Menu.Dropdown>
          </Menu>
        )}
      </>
    );
  };

  // Renders a single dropdown item — supports one level of nested sub-menus
  const renderDropdownItem = (child, parentColor, parentMenuKey, allSiblings) => {
    const isChildActive = location.pathname === child.key;

    if (child.children) {
      const isSubActive = child.children.some(s => location.pathname === s.key);
      return (
        <Menu key={child.key} trigger="hover" position="right-start" offset={0} shadow="lg" width={220}>
          <Menu.Target>
            <Menu.Item
              rightSection={<IconChevronRight size={14} />}
              onClick={() => handleMenuClick(child.children[0].key)}
              style={{
                borderRadius: '8px',
                margin: '4px',
                fontWeight: isSubActive ? 600 : 400,
                backgroundColor: isSubActive ? `var(--mantine-color-${parentColor}-1)` : undefined,
                color: isSubActive ? `var(--mantine-color-${parentColor}-7)` : undefined,
              }}
            >
              {child.label}
            </Menu.Item>
          </Menu.Target>
          <Menu.Dropdown style={{ border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', borderRadius: '12px' }}>
            {child.children.map((sub) => sub.inactive ? (
              <Menu.Item
                key={sub.key}
                disabled
                rightSection={<Text size="xs" c="dimmed">Inactive</Text>}
                style={{ borderRadius: '8px', margin: '4px' }}
              >
                {sub.label}
              </Menu.Item>
            ) : (
              <Menu.Item
                key={sub.key}
                onMouseDown={() => handleMenuClick(sub.key)}
                style={{
                  borderRadius: '8px',
                  margin: '4px',
                  fontWeight: location.pathname === sub.key ? 600 : 400,
                  backgroundColor: location.pathname === sub.key ? `var(--mantine-color-${parentColor}-1)` : undefined,
                  color: location.pathname === sub.key ? `var(--mantine-color-${parentColor}-7)` : undefined,
                }}
              >
                {sub.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      );
    }

    return (
      <Menu.Item
        key={child.key}
        onClick={() => handleMenuClick(child.key)}
        style={{
          borderRadius: '8px',
          margin: '4px',
          fontWeight: isChildActive ? 600 : 400,
          backgroundColor: isChildActive ? `var(--mantine-color-${parentColor}-1)` : undefined,
          color: isChildActive ? `var(--mantine-color-${parentColor}-7)` : undefined,
        }}
      >
        {child.label}
      </Menu.Item>
    );
  };

  const renderHorizontalMenuItem = (item) => {
    const isActive = location.pathname === item.key ||
      (item.children && item.children.some(child =>
        location.pathname === child.key ||
        (child.children && child.children.some(sub => location.pathname === sub.key))
      ));

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
            {renderMenuChildren(item)}
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
    <AppShell header={{ height: { base: 60, md: 120 } }} padding="md">
      <AppShell.Header style={{ border: 'none' }}>
        {/* Top Header - Gradient Background */}
        <Box
          style={{
            background: headerGradient,
            padding: '6px 20px',
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
            <Group gap="md" wrap="nowrap">
              <Box visibleFrom="md"><CompanySwitcher /></Box>

              <Box
                visibleFrom="md"
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
                    onClick={() => navigate('/financial-year')}
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

        {/* Menu Bar - Colorful Gradient Background — desktop only */}
        <Box
          visibleFrom="md"
          style={{
            background: menuBarBg,
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(102, 126, 234, 0.15)',
            boxShadow: isDark ? '0 2px 15px rgba(0,0,0,0.3)' : '0 2px 15px rgba(102, 126, 234, 0.1)',
          }}
        >
          <ScrollArea scrollbarSize={4}>
            <Group h={52} px="md" gap={6} wrap="nowrap" justify="space-between" visibleFrom="md">
              <Group gap={6} wrap="nowrap">
                {menuItems.map(renderHorizontalMenuItem)}
              </Group>
              {rightMenuItems.length > 0 && (
                <Group gap={6} wrap="nowrap">
                  {rightMenuItems.map(renderHorizontalMenuItem)}
                </Group>
              )}
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
            {[...menuItems, ...rightMenuItems].map((item) => {
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
                      {item.children.map((child) => {
                        if (child.children) {
                          return (
                            <Box key={child.key}>
                              <Text size="xs" fw={600} c="dimmed" tt="uppercase" pl={4} mb={2}>
                                {child.label}
                              </Text>
                              <Stack gap={2} pl="sm">
                                {child.children.map((sub) => (
                                  <Button
                                    key={sub.key}
                                    variant={location.pathname === sub.key ? 'light' : 'subtle'}
                                    color={location.pathname === sub.key ? item.color : 'gray'}
                                    disabled={sub.inactive}
                                    rightSection={sub.inactive ? <Text size="xs" c="dimmed">Inactive</Text> : undefined}
                                    onClick={() => handleMenuClick(sub.key)}
                                    fullWidth
                                    justify="flex-start"
                                    size="xs"
                                    radius="md"
                                    styles={{ root: { fontWeight: location.pathname === sub.key ? 600 : 400 } }}
                                  >
                                    {sub.label}
                                  </Button>
                                ))}
                              </Stack>
                            </Box>
                          );
                        }
                        return (
                          <Button
                            key={child.key}
                            variant={location.pathname === child.key ? 'light' : 'subtle'}
                            color={location.pathname === child.key ? item.color : 'gray'}
                            onClick={() => handleMenuClick(child.key)}
                            fullWidth
                            justify="flex-start"
                            size="sm"
                            radius="md"
                            styles={{ root: { fontWeight: location.pathname === child.key ? 600 : 400 } }}
                          >
                            {child.label}
                          </Button>
                        );
                      })}
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
        {/* No Back button on any page — only the Bank Transfer page keeps its Close button */}
        {isBankTransferPage && (
          <Box px="md" pt="sm" pb={0}>
            <Button
              variant="gradient"
              gradient={{ from: 'red', to: 'pink', deg: 135 }}
              size="sm"
              radius="xl"
              leftSection={<IconX size={16} />}
              onClick={() => navigate('/')}
              styles={{ root: { fontWeight: 700, letterSpacing: 0.5 } }}
            >
              Close
            </Button>
          </Box>
        )}
        <Outlet />
      </AppShell.Main>

      {/* Milk Purchase popup (F2 / P / menu) — the larger one. Whichever popup
          is in front sits on top; the other stays open behind it. */}
      <Modal
        opened={purchasePopupOpen}
        onClose={closePurchasePopup}
        withCloseButton={false}
        closeOnEscape={false}
        closeOnClickOutside={false}
        trapFocus={purchaseInFront}
        returnFocus={false}
        centered
        radius="md"
        padding={0}
        size="97vw"
        zIndex={purchaseInFront ? 210 : 200}
        transitionProps={{ transition: 'fade', duration: 120 }}
        overlayProps={purchaseInFront && salesPopupOpen ? { backgroundOpacity: 0.3, blur: 0 } : { backgroundOpacity: 0.55, blur: 2 }}
        styles={{
          content: {
            height: '95vh', maxHeight: '95vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '3px solid #2563eb',
            boxShadow: '0 24px 60px rgba(15,23,42,0.45)',
          },
          body: { flex: 1, minHeight: 0, padding: 0, overflowY: 'auto', overflowX: 'hidden' },
        }}
      >
        <Box data-milk-popup="purchase" data-milk-front={purchaseInFront || undefined} style={{ height: '100%' }}>
          <Suspense fallback={<Center h="100%"><Loader /></Center>}>
            <MilkPurchase asPopup inFront={purchaseInFront} onSwap={setMilkPopup} onClose={closePurchasePopup} />
          </Suspense>
        </Box>
      </Modal>

      {/* Milk Sales popup (F3 / S / menu) — smaller than Purchase */}
      <Modal
        opened={salesPopupOpen}
        onClose={closeSalesPopup}
        withCloseButton={false}
        closeOnEscape={false}
        closeOnClickOutside={false}
        trapFocus={salesInFront}
        returnFocus={false}
        centered
        radius="md"
        padding={0}
        size="84vw"
        zIndex={salesInFront ? 210 : 200}
        transitionProps={{ transition: 'fade', duration: 120 }}
        // Lighter dim when stacked so the popup behind still shows
        overlayProps={salesInFront && purchasePopupOpen ? { backgroundOpacity: 0.3, blur: 0 } : { backgroundOpacity: 0.55, blur: 2 }}
        styles={{
          content: {
            height: '84vh', maxHeight: '84vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '3px solid #16a34a',
            boxShadow: '0 24px 60px rgba(15,23,42,0.55)',
          },
          body: { flex: 1, minHeight: 0, padding: 0, overflowY: 'auto', overflowX: 'hidden' },
        }}
      >
        <Box data-milk-popup="sales" data-milk-front={salesInFront || undefined} style={{ height: '100%' }}>
          <Suspense fallback={<Center h="100%"><Loader /></Center>}>
            <MilkSales asPopup inFront={salesInFront} onSwap={setMilkPopup} onClose={closeSalesPopup} />
          </Suspense>
        </Box>
      </Modal>
    </AppShell>
  );
};

export default MainLayout;