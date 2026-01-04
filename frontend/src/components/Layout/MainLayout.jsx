import { useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import ThemeToggle from '../common/ThemeToggle';
import './MainLayout.css';

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState(['party-menu']);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: 'home',
      label: 'Dashboard'
    },
    {
      key: 'party-menu',
      icon: 'users',
      label: 'Party Creation',
      children: [
        { key: '/farmers', label: 'Farmer List' },
        { key: '/farmers/add', label: 'Add Farmer' },
        { key: '/customers', label: 'Customer List' },
        { key: '/customers/add', label: 'Add Customer' },
        { key: '/suppliers', label: 'Supplier List' },
        { key: '/suppliers/add', label: 'Add Supplier' },
        { key: '/collection-centers', label: 'Collection Centers' },
        { key: '/collection-centers/add', label: 'Add Collection Center' }
      ]
    },
    {
      key: 'inventory-menu',
      icon: 'inbox',
      label: 'Inventory',
      children: [
        { key: '/inventory/items', label: 'Item Master' },
        { key: '/inventory/stock-in', label: 'Stock In' },
        { key: '/inventory/stock-out', label: 'Stock Out' },
        { key: '/inventory/report', label: 'Stock Report' }
      ]
    },
    {
      key: 'sales-menu',
      icon: 'cart',
      label: 'Sales & Billing',
      children: [
        { key: '/sales/new', label: 'New Bill' },
        { key: '/sales/list', label: 'Sales List' }
      ]
    },
    {
      key: 'accounting-menu',
      icon: 'book',
      label: 'Accounting',
      children: [
        { key: '/accounting/vouchers', label: 'Vouchers' },
        { key: '/accounting/ledgers', label: 'Ledgers' },
        { key: '/accounting/receipt', label: 'Receipt Voucher' },
        { key: '/accounting/payment', label: 'Payment Voucher' },
        { key: '/accounting/journal', label: 'Journal Voucher' },
        { key: '/accounting/outstanding', label: 'Outstanding Report' }
      ]
    },
    {
      key: 'cashbook-menu',
      icon: 'dollar',
      label: 'Cash Book',
      children: [
        { key: '/cashbook/receipt', label: 'Classified Receipt' },
        { key: '/cashbook/disbursement', label: 'Classified Disbursement' },
        { key: '/cashbook/transactions', label: 'Cash Book View' },
        { key: '/cashbook/reports', label: 'Classification Reports' }
      ]
    },
    {
      key: 'payments-menu',
      icon: 'dollar',
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
      icon: 'file',
      label: 'Reports',
      children: [
        { key: '/reports/daybook', label: 'Day Book' },
        { key: '/reports/rd', label: 'Receipts & Disbursement' },
        { key: '/reports/trading', label: 'Trading Account' },
        { key: '/reports/pl', label: 'Profit & Loss' },
        { key: '/reports/balance-sheet', label: 'Balance Sheet' },
        { key: '/reports/sales', label: 'Sales Report' },
        { key: '/reports/stock', label: 'Stock Report' },
        { key: '/reports/subsidy', label: 'Subsidy Report' }
      ]
    },
    {
      key: 'warranty-menu',
      icon: 'shield',
      label: 'Warranty',
      children: [
        { key: '/warranty', label: 'Warranty List' },
        { key: '/warranty/add', label: 'Add Warranty' }
      ]
    },
    {
      key: 'machines-menu',
      icon: 'tool',
      label: 'Machines',
      children: [
        { key: '/machines', label: 'Machine List' },
        { key: '/machines/add', label: 'Add Machine' }
      ]
    },
    {
      key: 'quotations-menu',
      icon: 'search',
      label: 'Quotations',
      children: [
        { key: '/quotations', label: 'Quotation List' },
        { key: '/quotations/add', label: 'Add Quotation' }
      ]
    },
    {
      key: 'promotions-menu',
      icon: 'megaphone',
      label: 'Promotions',
      children: [
        { key: '/promotions', label: 'Promotion List' },
        { key: '/promotions/add', label: 'Add Promotion' }
      ]
    },
    {
      key: 'subsidies-menu',
      icon: 'dollar',
      label: 'Subsidies',
      children: [
        { key: '/subsidies', label: 'Subsidy List' }
      ]
    }
  ];

  const handleMenuClick = (key) => {
    navigate(key);
  };

  const toggleSubmenu = (key) => {
    setOpenMenus(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const getIcon = (iconName) => {
    const icons = {
      home: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      user: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      users: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      inbox: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="3 10 12 13 21 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      cart: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="9" cy="21" r="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="20" cy="21" r="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      book: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      dollar: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="12" y1="1" x2="12" y2="23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      file: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="13" x2="8" y2="13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="17" x2="8" y2="17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      shield: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      tool: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      search: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      megaphone: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 11l18-5v12L3 13v-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    };
    return icons[iconName] || icons.file;
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            {collapsed ? 'DMS' : 'Dairy Management'}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              {collapsed ? (
                <path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              ) : (
                <path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <div key={item.key} className="menu-item-wrapper">
              {item.children ? (
                <>
                  <button
                    className={`menu-item ${openMenus.includes(item.key) ? 'active' : ''}`}
                    onClick={() => toggleSubmenu(item.key)}
                  >
                    <span className="menu-icon">{getIcon(item.icon)}</span>
                    {!collapsed && (
                      <>
                        <span className="menu-label">{item.label}</span>
                        <svg
                          className={`menu-arrow ${openMenus.includes(item.key) ? 'open' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </>
                    )}
                  </button>
                  {!collapsed && openMenus.includes(item.key) && (
                    <div className="submenu">
                      {item.children.map((child) => (
                        <button
                          key={child.key}
                          className={`submenu-item ${location.pathname === child.key ? 'active' : ''}`}
                          onClick={() => handleMenuClick(child.key)}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button
                  className={`menu-item ${location.pathname === item.key ? 'active' : ''}`}
                  onClick={() => handleMenuClick(item.key)}
                >
                  <span className="menu-icon">{getIcon(item.icon)}</span>
                  {!collapsed && <span className="menu-label">{item.label}</span>}
                </button>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <div className="layout-main">
        <header className="layout-header">
          <div className="header-title">
            Dairy Cooperative Management System
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="header-info">
              No Authentication Required
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
