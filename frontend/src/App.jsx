import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './components/Layout/MainLayout';
import './styles/theme.css';

// Pages
import Dashboard from './pages/Dashboard';

// Farmer Components
import FarmerList from './components/farmer/FarmerList';
import FarmerForm from './components/farmer/FarmerForm';
import FarmerView from './components/farmer/FarmerView';

// Customer Components
import CustomerList from './components/customer/CustomerList';
import CustomerForm from './components/customer/CustomerForm';
import CustomerView from './components/customer/CustomerView';

// Supplier Components
import SupplierList from './components/supplier/SupplierList';
import SupplierForm from './components/supplier/SupplierForm';
import SupplierView from './components/supplier/SupplierView';

// Inventory Components
import ItemList from './components/inventory/ItemList';
import StockInForm from './components/inventory/StockInForm';
import StockOutForm from './components/inventory/StockOutForm';
import StockReport from './components/inventory/StockReport';

// Sales Components
import BillingForm from './components/sales/BillingForm';
import SalesList from './components/sales/SalesList';
import SalesView from './components/sales/SalesView';

// Accounting Components
import VoucherList from './components/accounting/VoucherList';
import LedgerList from './components/accounting/LedgerList';
import LedgerView from './components/accounting/LedgerView';
import ReceiptVoucher from './components/accounting/ReceiptVoucher';
import PaymentVoucher from './components/accounting/PaymentVoucher';
import JournalVoucher from './components/accounting/JournalVoucher';
import OutstandingReport from './components/accounting/OutstandingReport';

// Payment Components
import MilkPaymentForm from './components/payments/MilkPaymentForm';
import AdvanceForm from './components/payments/AdvanceForm';
import AdvanceView from './components/payments/AdvanceView';
import PaymentHistory from './components/payments/PaymentHistory';
import AdvanceList from './components/payments/AdvanceList';

// Report Components
import FinancialReports from './components/reports/FinancialReports';
import SalesReportView from './components/reports/SalesReportView';
import StockReportView from './components/reports/StockReportView';
import SubsidyReport from './components/reports/SubsidyReport';

// Additional Module Components
import WarrantyList from './components/additional/WarrantyList';
import WarrantyForm from './components/additional/WarrantyForm';
import WarrantyView from './components/additional/WarrantyView';
import MachineList from './components/additional/MachineList';
import MachineForm from './components/additional/MachineForm';
import MachineView from './components/additional/MachineView';
import QuotationList from './components/additional/QuotationList';
import QuotationForm from './components/additional/QuotationForm';
import QuotationView from './components/additional/QuotationView';
import PromotionList from './components/additional/PromotionList';
import PromotionForm from './components/additional/PromotionForm';
import PromotionView from './components/additional/PromotionView';

// Cash Book Components
import ClassifiedReceiptForm from './components/cashbook/ClassifiedReceiptForm';
import ClassifiedDisbursementForm from './components/cashbook/ClassifiedDisbursementForm';
import CashBookView from './components/cashbook/CashBookView';
import ClassificationReports from './components/cashbook/ClassificationReports';

// Subsidy Components
import SubsidyList from './components/subsidy/SubsidyList';
import SubsidyView from './components/subsidy/SubsidyView';

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <Router>
            <Routes>
              <Route path="/" element={<MainLayout />}>
              {/* Dashboard */}
              <Route index element={<Dashboard />} />

              {/* Farmer Management Routes */}
              <Route path="farmers">
                <Route index element={<FarmerList />} />
                <Route path="add" element={<FarmerForm />} />
                <Route path="edit/:id" element={<FarmerForm />} />
                <Route path="view/:id" element={<FarmerView />} />
              </Route>

              {/* Customer Management Routes */}
              <Route path="customers">
                <Route index element={<CustomerList />} />
                <Route path="add" element={<CustomerForm />} />
                <Route path="edit/:id" element={<CustomerForm />} />
                <Route path="view/:id" element={<CustomerView />} />
              </Route>

              {/* Supplier Management Routes */}
              <Route path="suppliers">
                <Route index element={<SupplierList />} />
                <Route path="add" element={<SupplierForm />} />
                <Route path="edit/:id" element={<SupplierForm />} />
                <Route path="view/:id" element={<SupplierView />} />
              </Route>

              {/* Inventory Routes */}
              <Route path="inventory">
                <Route path="items" element={<ItemList />} />
                <Route path="stock-in" element={<StockInForm />} />
                <Route path="stock-out" element={<StockOutForm />} />
                <Route path="report" element={<StockReport />} />
              </Route>

              {/* Sales & Billing Routes */}
              <Route path="sales">
                <Route path="new" element={<BillingForm />} />
                <Route path="list" element={<SalesList />} />
                <Route path="view/:id" element={<SalesView />} />
              </Route>

              {/* Accounting Routes */}
              <Route path="accounting">
                <Route path="vouchers" element={<VoucherList />} />
                <Route path="ledgers" element={<LedgerList />} />
                <Route path="ledgers/:id" element={<LedgerView />} />
                <Route path="receipt" element={<ReceiptVoucher />} />
                <Route path="payment" element={<PaymentVoucher />} />
                <Route path="journal" element={<JournalVoucher />} />
                <Route path="outstanding" element={<OutstandingReport />} />
              </Route>

              {/* Farmer Payments Routes */}
              <Route path="payments">
                <Route path="milk" element={<MilkPaymentForm />} />
                <Route path="advance" element={<AdvanceForm />} />
                <Route path="advances" element={<AdvanceList />} />
                <Route path="advances/view/:id" element={<AdvanceView />} />
                <Route path="history" element={<PaymentHistory />} />
              </Route>

              {/* Reports Routes */}
              <Route path="reports">
                <Route path="rd" element={<FinancialReports reportType="rd" />} />
                <Route path="trading" element={<FinancialReports reportType="trading" />} />
                <Route path="pl" element={<FinancialReports reportType="pl" />} />
                <Route path="balance-sheet" element={<FinancialReports reportType="balance-sheet" />} />
                <Route path="sales" element={<SalesReportView />} />
                <Route path="stock" element={<StockReportView />} />
                <Route path="subsidy" element={<SubsidyReport />} />
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

              {/* Cash Book Routes */}
              <Route path="cashbook">
                <Route index element={<CashBookView />} />
                <Route path="transactions" element={<CashBookView />} />
                <Route path="receipt" element={<ClassifiedReceiptForm />} />
                <Route path="receipts/new" element={<ClassifiedReceiptForm />} />
                <Route path="disbursement" element={<ClassifiedDisbursementForm />} />
                <Route path="disbursements/new" element={<ClassifiedDisbursementForm />} />
                <Route path="reports" element={<ClassificationReports />} />
              </Route>

              {/* Subsidy Routes */}
              <Route path="subsidies">
                <Route index element={<SubsidyList />} />
                <Route path="view/:id" element={<SubsidyView />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
