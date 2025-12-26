const PlaceholderPage = ({ title }) => {
  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>{title}</h1>
      <div style={{ padding: '20px', background: 'var(--bg-elevated, #2d3548)', border: '1px solid var(--border-color, #3d4558)', borderRadius: '8px' }}>
        <div style={{ padding: '12px 16px', background: '#1890ff20', border: '1px solid #1890ff', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#1890ff' }}>Module Under Development</h3>
          <p style={{ margin: 0, color: 'var(--text-primary, #e4e6eb)' }}>
            The {title} module UI components are ready to be implemented. The backend API is fully functional and ready to use.
          </p>
        </div>
        <div>
          <h3>Available APIs for this module:</h3>
          <p>Check the <code>frontend/src/services/api.js</code> file for all available API methods.</p>
          <p>Refer to the <code>backend/src/controllers/</code> folder for backend implementation details.</p>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderPage;
