const Dashboard = () => {
  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', background: 'var(--bg-elevated, #2d3548)', border: '1px solid var(--border-color, #3d4558)', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary, #b0b3b8)', marginBottom: '8px' }}>Total Farmers</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3f8600' }}>0</div>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg-elevated, #2d3548)', border: '1px solid var(--border-color, #3d4558)', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary, #b0b3b8)', marginBottom: '8px' }}>Total Items</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff' }}>0</div>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg-elevated, #2d3548)', border: '1px solid var(--border-color, #3d4558)', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary, #b0b3b8)', marginBottom: '8px' }}>Total Sales</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#cf1322' }}>0</div>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg-elevated, #2d3548)', border: '1px solid var(--border-color, #3d4558)', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary, #b0b3b8)', marginBottom: '8px' }}>Total Revenue</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#faad14' }}>0</div>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <div style={{ padding: '20px', background: 'var(--bg-elevated, #2d3548)', border: '1px solid var(--border-color, #3d4558)', borderRadius: '8px' }}>
          <h2>Welcome to Dairy Cooperative Management System</h2>
          <p>This is a comprehensive ERP system for dairy cooperative management.</p>
          <h3>Available Modules:</h3>
          <ul>
            <li><strong>Farmer Management:</strong> Manage farmer details, documents, and profiles</li>
            <li><strong>Inventory Management:</strong> Track items, stock in/out, and stock reports</li>
            <li><strong>Sales & Billing:</strong> Create bills, manage sales, and thermal printing</li>
            <li><strong>Accounting System:</strong> Vouchers, ledgers, and financial reports</li>
            <li><strong>Farmer Payments:</strong> Milk payments, advances, and payment history</li>
            <li><strong>Reports:</strong> R&D, Trading Account, P&L, Balance Sheet, and more</li>
            <li><strong>Additional Modules:</strong> Warranty, Machines, Quotations, Promotions</li>
          </ul>
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary, #1e2530)', borderRadius: '8px' }}>
            <h4>Getting Started:</h4>
            <ol>
              <li>Start MongoDB: <code>mongod</code></li>
              <li>Start Backend: <code>cd backend && npm run dev</code></li>
              <li>Start Frontend: <code>cd frontend && npm run dev</code></li>
              <li>Backend API: <code>http://localhost:5000</code></li>
              <li>Frontend App: <code>http://localhost:5173</code></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
