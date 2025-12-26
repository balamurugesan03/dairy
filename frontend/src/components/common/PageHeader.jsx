import React from 'react';
import './PageHeader.css';

const PageHeader = ({
  title,
  extra,
  subtitle,
  style = {}
}) => {
  return (
    <div className="page-header" style={style}>
      <div className="page-header-content">
        <h2 className="page-header-title">{title}</h2>
        {subtitle && (
          <p className="page-header-subtitle">{subtitle}</p>
        )}
      </div>
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  );
};

export default PageHeader;
