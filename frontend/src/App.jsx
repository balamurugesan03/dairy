import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import MainLayout from './components/Layout/MainLayout';
import CompanySelection from './components/company/CompanySelection';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import './styles/theme.css';

// Loading fallback component
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    background: 'var(--bg-base)'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid var(--border-color)',
      borderTopColor: 'var(--primary-color)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }}></div>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Lazy load all page components
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Farmer Components
const FarmerManagement = lazy(() => import('./components/farmer/FarmerManagement'));
const FarmerView = lazy(() => import('./components/farmer/FarmerView'));
const MemberList = lazy(() => import('./components/farmer/MemberList'));

// Customer Components
const CustomerManagement = lazy(() => import('./components/customer/CustomerManagement'));

// Supplier Components
const SupplierList = lazy(() => import('./components/supplier/SupplierList'));
const SupplierForm = lazy(() => import('./components/supplier/SupplierForm'));
const SupplierView = lazy(() => import('./components/supplier/SupplierView'));

// Inventory Components (Dairy)
const ItemList = lazy(() => import('./components/inventory/ItemList'));
const StockInManagement = lazy(() => import('./components/inventory/StockInManagement'));
const StockOutManagement = lazy(() => import('./components/inventory/StockOutManagement'));
const StockReport = lazy(() => import('./components/inventory/StockReport'));
const StockDashboard = lazy(() => import('./components/inventory/StockDashboard'));

// Business Inventory Components (Private Firm / Vyapar)
const BusinessItemList = lazy(() => import('./components/business-inventory/BusinessItemList'));
const BusinessStockInManagement = lazy(() => import('./components/business-inventory/BusinessStockInManagement'));
const BusinessStockReport = lazy(() => import('./components/business-inventory/BusinessStockReport'));
const BusinessBillingForm = lazy(() => import('./components/business-inventory/BusinessBillingForm'));
const BusinessSalesList = lazy(() => import('./components/business-inventory/BusinessSalesList'));

// Business Accounting Components (Private Firm - Separate from Dairy)
const BusinessLedgerList = lazy(() => import('./components/business-accounting/BusinessLedgerList'));
const BusinessIncomeVoucher = lazy(() => import('./components/business-accounting/BusinessIncomeVoucher'));
const BusinessExpenseVoucher = lazy(() => import('./components/business-accounting/BusinessExpenseVoucher'));
const BusinessJournalVoucher = lazy(() => import('./components/business-accounting/BusinessJournalVoucher'));
const BusinessVoucherList = lazy(() => import('./components/business-accounting/BusinessVoucherList'));

// Sales Components
const BillingForm = lazy(() => import('./components/sales/BillingForm'));
const SalesList = lazy(() => import('./components/sales/SalesList'));
const SalesView = lazy(() => import('./components/sales/SalesView'));

// Accounting Components
const VoucherList = lazy(() => import('./components/accounting/VoucherList'));
const LedgerList = lazy(() => import('./components/accounting/LedgerList'));
const LedgerView = lazy(() => import('./components/accounting/LedgerView'));
const ReceiptVoucher = lazy(() => import('./components/accounting/ReceiptVoucher'));
const PaymentVoucher = lazy(() => import('./components/accounting/PaymentVoucher'));
const JournalVoucher = lazy(() => import('./components/accounting/JournalVoucher'));
const OutstandingReport = lazy(() => import('./components/accounting/OutstandingReport'));

// Payment Components
const IndividualMilkPayment = lazy(() => import('./components/payments/IndividualMilkPayment'));
const MilkPaymentRegister = lazy(() => import('./components/payments/MilkPaymentRegister'));

const ProducerLoanManagement = lazy(() => import('./components/payments/ProducerLoanManagement'));
const ProducerLoanView = lazy(() => import('./components/payments/ProducerLoanView'));
const CashAdvanceVoucher = lazy(() => import('./components/payments/CashAdvanceVoucher'));
const ProducerReceiptManagement = lazy(() => import('./components/payments/ProducerReceiptManagement'));
const FarmerLedgerView = lazy(() => import('./components/payments/FarmerLedgerView'));
const ProducerRegister = lazy(() => import('./components/payments/ProducerRegister'));
const ProducerRegisterSummary = lazy(() => import('./components/payments/ProducerRegisterSummary'));
const BankTransferManagement = lazy(() => import('./components/payments/BankTransferManagement'));

// Report Components
const ReportsDashboard = lazy(() => import('./components/reports/ReportsDashboard'));
const FinancialReports = lazy(() => import('./components/reports/FinancialReports'));
const SalesReportView = lazy(() => import('./components/reports/SalesReportView'));
const StockReportView = lazy(() => import('./components/reports/StockReportView'));
const SubsidyReport = lazy(() => import('./components/reports/SubsidyReport'));
const DayBook = lazy(() => import('./components/reports/DayBook'));
const CashBook = lazy(() => import('./components/reports/CashBook'));
const GeneralLedger = lazy(() => import('./components/reports/GeneralLedger'));
const LedgerAbstract = lazy(() => import('./components/reports/LedgerAbstract'));
const ReceiptsDisbursement = lazy(() => import('./components/reports/ReceiptsDisbursement'));
const FinalAccounts = lazy(() => import('./components/reports/FinalAccounts'));
const BalanceSheet = lazy(() => import('./components/reports/BalanceSheet'));
const StockRegister = lazy(() => import('./components/reports/StockRegister'));
const InventoryPurchaseRegister = lazy(() => import('./components/reports/InventoryPurchaseRegister'));
const MilkBillAbstract = lazy(() => import('./components/reports/MilkBillAbstract'));

// Vyapar Report Components - Private Firm
const VyaparReportsHub = lazy(() => import('./components/reports/vyapar/VyaparReportsHub'));
const VyaparSaleReport = lazy(() => import('./components/reports/vyapar/VyaparSaleReport'));
const VyaparLowStockSummary = lazy(() => import('./components/reports/vyapar/VyaparLowStockSummary'));
const VyaparPartyStatement = lazy(() => import('./components/reports/vyapar/VyaparPartyStatement'));
const VyaparAllParties = lazy(() => import('./components/reports/vyapar/VyaparAllParties'));
const VyaparProfitLoss = lazy(() => import('./components/reports/vyapar/VyaparProfitLoss'));
const VyaparPurchaseReport = lazy(() => import('./components/reports/vyapar/VyaparPurchaseReport'));
const VyaparCashflowReport = lazy(() => import('./components/reports/vyapar/VyaparCashflowReport'));
const VyaparAllTransactions = lazy(() => import('./components/reports/vyapar/VyaparAllTransactions'));
const VyaparBalanceSheet = lazy(() => import('./components/reports/vyapar/VyaparBalanceSheet'));
const VyaparBillWiseProfit = lazy(() => import('./components/reports/vyapar/VyaparBillWiseProfit'));
const VyaparPartyWiseProfit = lazy(() => import('./components/reports/vyapar/VyaparPartyWiseProfit'));
const VyaparTrialBalance = lazy(() => import('./components/reports/vyapar/VyaparTrialBalance'));
const VyaparStockSummary = lazy(() => import('./components/reports/vyapar/VyaparStockSummary'));
const VyaparItemReportByParty = lazy(() => import('./components/reports/vyapar/VyaparItemReportByParty'));
const VyaparItemWiseProfit = lazy(() => import('./components/reports/vyapar/VyaparItemWiseProfit'));
const VyaparBankStatement = lazy(() => import('./components/reports/vyapar/VyaparBankStatement'));
const VyaparCashInHand = lazy(() => import('./components/reports/vyapar/VyaparCashInHand'));
const VyaparGSTR1 = lazy(() => import('./components/reports/vyapar/VyaparGSTR1'));
const VyaparGSTR2 = lazy(() => import('./components/reports/vyapar/VyaparGSTR2'));

// Additional Module Components
const WarrantyList = lazy(() => import('./components/additional/WarrantyList'));
const WarrantyForm = lazy(() => import('./components/additional/WarrantyForm'));
const WarrantyView = lazy(() => import('./components/additional/WarrantyView'));
const MachineList = lazy(() => import('./components/additional/MachineList'));
const MachineForm = lazy(() => import('./components/additional/MachineForm'));
const MachineView = lazy(() => import('./components/additional/MachineView'));
const QuotationList = lazy(() => import('./components/additional/QuotationList'));
const QuotationForm = lazy(() => import('./components/additional/QuotationForm'));
const QuotationView = lazy(() => import('./components/additional/QuotationView'));
const PromotionList = lazy(() => import('./components/additional/PromotionList'));
const PromotionForm = lazy(() => import('./components/additional/PromotionForm'));
const PromotionView = lazy(() => import('./components/additional/PromotionView'));

// Subsidy Components
const SubsidyList = lazy(() => import('./components/subsidy/SubsidyList'));
const SubsidyView = lazy(() => import('./components/subsidy/SubsidyView'));

// Collection Center Components
const CollectionCenterManagement = lazy(() => import('./components/collectioncenter/CollectionCenterManagement'));

// HRM Components
const EmployeeList = lazy(() => import('./components/hrm/EmployeeList'));
const EmployeeForm = lazy(() => import('./components/hrm/EmployeeForm'));
const EmployeeView = lazy(() => import('./components/hrm/EmployeeView'));
const DepartmentList = lazy(() => import('./components/hrm/DepartmentList'));
const DesignationList = lazy(() => import('./components/hrm/DesignationList'));
const AttendanceList = lazy(() => import('./components/hrm/AttendanceList'));
const MarkAttendance = lazy(() => import('./components/hrm/MarkAttendance'));
const LeaveList = lazy(() => import('./components/hrm/LeaveList'));
const SalaryList = lazy(() => import('./components/hrm/SalaryList'));

// User Management
const UserManagement = lazy(() => import('./pages/UserManagement'));

// App content component that uses auth and company context
const AppContent = () => {
  const { isAuthenticated, isSuperAdmin, loading: authLoading } = useAuth();
  const { selectedCompany, selectedBusinessType, loading: companyLoading } = useCompany();

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-base)'
      }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%' }}></div>
      </div>
    );
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    // Check if trying to access admin route
    if (window.location.pathname === '/admin') {
      return <Login />;
    }
    return <Login />;
  }

  // If superadmin, check if accessing admin route specifically
  // Only show admin dashboard if accessed via /admin route
  if (isSuperAdmin) {
    if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin')) {
      return <SuperAdminDashboard />;
    }
    // For regular routes, redirect superadmin to admin dashboard
    window.location.href = '/admin';
    return null;
  }

  // Show loading state while checking for saved company
  if (companyLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-base)'
      }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%' }}></div>
      </div>
    );
  }

  // If no company is selected, show company selection screen
  if (!selectedCompany || !selectedBusinessType) {
    return <CompanySelection />;
  }

  // Otherwise, show the main app
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<MainLayout />}>
              {/* Dashboard */}
              <Route index element={<Dashboard />} />

              {/* Farmer Management Routes */}
              <Route path="farmers">
                <Route index element={<FarmerManagement />} />
                <Route path="view/:id" element={<FarmerView />} />
                <Route path="members" element={<MemberList />} />
              </Route>

              {/* Customer Management Routes */}
              <Route path="customers">
                <Route index element={<CustomerManagement />} />
              </Route>

              {/* Supplier Management Routes */}
              <Route path="suppliers">
                <Route index element={<SupplierList />} />
                <Route path="add" element={<SupplierForm />} />
                <Route path="edit/:id" element={<SupplierForm />} />
                <Route path="view/:id" element={<SupplierView />} />
              </Route>

              {/* Inventory Routes (Dairy) */}
              <Route path="inventory">
                <Route index element={<StockDashboard />} />
                <Route path="items" element={<ItemList />} />
                <Route path="stock-in" element={<StockInManagement />} />
                <Route path="stock-out" element={<StockOutManagement />} />
                <Route path="report" element={<StockReport />} />
              </Route>

              {/* Business Inventory Routes (Private Firm / Vyapar) */}
              <Route path="business-inventory">
                <Route index element={<BusinessItemList />} />
                <Route path="items" element={<BusinessItemList />} />
                <Route path="stock-in" element={<BusinessStockInManagement />} />
                <Route path="stock-out" element={<BusinessStockInManagement />} />
                <Route path="stock-report" element={<BusinessStockReport />} />
                {/* Business Sales - Vyapar Style Billing */}
                <Route path="sales/new" element={<BusinessBillingForm />} />
                <Route path="sales/list" element={<BusinessSalesList />} />
                <Route path="sales/edit/:id" element={<BusinessBillingForm />} />
                <Route path="sales/:id" element={<BusinessBillingForm />} />
              </Route>

              {/* Sales & Billing Routes */}
              <Route path="sales">
                <Route path="new" element={<BillingForm />} />
                <Route path="list" element={<SalesList />} />
                <Route path="view/:id" element={<SalesView />} />
              </Route>

              {/* Accounting Routes (Dairy) */}
              <Route path="accounting">
                <Route path="vouchers" element={<VoucherList />} />
                <Route path="ledgers" element={<LedgerList />} />
                <Route path="ledgers/:id" element={<LedgerView />} />
                <Route path="receipt" element={<ReceiptVoucher />} />
                <Route path="payment" element={<PaymentVoucher />} />
                <Route path="journal" element={<JournalVoucher />} />
                <Route path="outstanding" element={<OutstandingReport />} />
              </Route>

              {/* Business Accounting Routes (Private Firm - Separate Data) */}
              <Route path="business-accounting">
                <Route path="ledgers" element={<BusinessLedgerList />} />
                <Route path="ledgers/:id" element={<BusinessLedgerList />} />
                <Route path="income" element={<BusinessIncomeVoucher />} />
                <Route path="expense" element={<BusinessExpenseVoucher />} />
                <Route path="journal" element={<BusinessJournalVoucher />} />
                <Route path="vouchers" element={<BusinessVoucherList />} />
              </Route>

              {/* Farmer Payments Routes */}
              <Route path="payments">
                <Route index element={<Navigate to="/payments/register" replace />} />
                <Route path="register" element={<MilkPaymentRegister />} />
                <Route path="individual" element={<IndividualMilkPayment />} />
                <Route path="loans" element={<ProducerLoanManagement />} />
                <Route path="loans/:id" element={<ProducerLoanView />} />
                <Route path="cash-advance" element={<CashAdvanceVoucher />} />
                <Route path="receipts" element={<ProducerReceiptManagement />} />
                <Route path="farmer-ledger" element={<FarmerLedgerView />} />
                <Route path="producer-register" element={<ProducerRegister />} />
                <Route path="producer-register-summary" element={<ProducerRegisterSummary />} />
                <Route path="bank-transfer" element={<BankTransferManagement />} />
              </Route>

              {/* Reports Routes */}
              <Route path="reports">
                <Route index element={<ReportsDashboard />} />
                {/* Vyapar Reports Hub and Individual Reports - Private Firm */}
                <Route path="vyapar" element={<VyaparReportsHub />} />
                <Route path="vyapar/sale-report" element={<VyaparSaleReport />} />
                <Route path="vyapar/purchase-report" element={<VyaparPurchaseReport />} />
                <Route path="vyapar/low-stock" element={<VyaparLowStockSummary />} />
                <Route path="vyapar/party-statement" element={<VyaparPartyStatement />} />
                <Route path="vyapar/all-parties" element={<VyaparAllParties />} />
                <Route path="vyapar/profit-loss" element={<VyaparProfitLoss />} />
                <Route path="vyapar/cashflow" element={<VyaparCashflowReport />} />
                <Route path="vyapar/all-transactions" element={<VyaparAllTransactions />} />
                <Route path="vyapar/balance-sheet" element={<VyaparBalanceSheet />} />
                <Route path="vyapar/bill-profit" element={<VyaparBillWiseProfit />} />
                <Route path="vyapar/party-profit" element={<VyaparPartyWiseProfit />} />
                <Route path="vyapar/trial-balance" element={<VyaparTrialBalance />} />
                <Route path="vyapar/stock-summary" element={<VyaparStockSummary />} />
                <Route path="vyapar/item-by-party" element={<VyaparItemReportByParty />} />
                <Route path="vyapar/item-profit" element={<VyaparItemWiseProfit />} />
                <Route path="vyapar/bank-statement" element={<VyaparBankStatement />} />
                <Route path="vyapar/cash-in-hand" element={<VyaparCashInHand />} />
                <Route path="vyapar/gstr1" element={<VyaparGSTR1 />} />
                <Route path="vyapar/gstr2" element={<VyaparGSTR2 />} />

                {/* Dairy Society Reports */}
                <Route path="cash-book" element={<CashBook />} />
                <Route path="general-ledger" element={<GeneralLedger />} />
                <Route path="ledger-abstract" element={<LedgerAbstract />} />
                <Route path="rd-enhanced" element={<ReceiptsDisbursement />} />
                <Route path="final-accounts" element={<FinalAccounts />} />
                <Route path="daybook" element={<DayBook />} />
                <Route path="rd" element={<FinancialReports reportType="rd" />} />
                <Route path="trading" element={<FinancialReports reportType="trading" />} />
                <Route path="pl" element={<FinancialReports reportType="pl" />} />
                <Route path="balance-sheet" element={<BalanceSheet />} />
                <Route path="sales" element={<SalesReportView />} />
                <Route path="stock" element={<StockReportView />} />
                <Route path="subsidy" element={<SubsidyReport />} />
                <Route path="stock-register" element={<StockRegister />} />
                <Route path="purchase-register" element={<InventoryPurchaseRegister />} />
                <Route path="milk-bill-abstract" element={<MilkBillAbstract />} />
              </Route>

              {/* Warranty Routes */}
              <Route path="warranty">
                <Route index element={<WarrantyList />} />
                <Route path="add" element={<WarrantyForm />} />
                <Route path="edit/:id" element={<WarrantyForm />} />
                <Route path="view/:id" element={<WarrantyView />} />
              </Route>

              {/* Machine Routes */}
              <Route path="machines">
                <Route index element={<MachineList />} />
                <Route path="add" element={<MachineForm />} />
                <Route path="edit/:id" element={<MachineForm />} />
                <Route path="view/:id" element={<MachineView />} />
              </Route>

              {/* Quotation Routes */}
              <Route path="quotations">
                <Route index element={<QuotationList />} />
                <Route path="add" element={<QuotationForm />} />
                <Route path="edit/:id" element={<QuotationForm />} />
                <Route path="view/:id" element={<QuotationView />} />
              </Route>

              {/* Promotion Routes */}
              <Route path="promotions">
                <Route index element={<PromotionList />} />
                <Route path="add" element={<PromotionForm />} />
                <Route path="edit/:id" element={<PromotionForm />} />
                <Route path="view/:id" element={<PromotionView />} />
              </Route>

       

              {/* Subsidy Routes */}
              <Route path="subsidies">
                <Route index element={<SubsidyList />} />
                <Route path="view/:id" element={<SubsidyView />} />
              </Route>

              {/* Collection Center Routes */}
              <Route path="collection-centers">
                <Route index element={<CollectionCenterManagement />} />
              </Route>

              {/* HRM Routes */}
              <Route path="hrm">
                {/* Employee Routes */}
                <Route path="employees">
                  <Route index element={<EmployeeList />} />
                  <Route path="add" element={<EmployeeForm />} />
                  <Route path=":id" element={<EmployeeView />} />
                  <Route path=":id/edit" element={<EmployeeForm />} />
                </Route>

                {/* Department Routes */}
                <Route path="departments">
                  <Route index element={<DepartmentList />} />
                </Route>

                {/* Designation Routes */}
                <Route path="designations">
                  <Route index element={<DesignationList />} />
                </Route>

                {/* Attendance Routes */}
                <Route path="attendance">
                  <Route index element={<AttendanceList />} />
                  <Route path="mark" element={<MarkAttendance />} />
                </Route>

                {/* Leave Routes */}
                <Route path="leaves">
                  <Route index element={<LeaveList />} />
                </Route>

                {/* Salary Routes */}
                <Route path="salary">
                  <Route index element={<SalaryList />} />
                </Route>
              </Route>

              {/* User Management - Admin Only */}
              <Route path="user-management" element={<UserManagement />} />
            </Route>
        </Routes>
      </Suspense>
    </Router>
  );
};

// Main App component with providers
// Note: ThemeProvider is now in main.jsx wrapping MantineProvider
function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}

export default App;
