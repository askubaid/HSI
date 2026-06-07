import React, { useState } from 'react';

export default function Accordion({ title, children, defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div style={{ margin: '20px 0', border: '1px solid #333', borderRadius: '8px', backgroundColor: '#111', overflow: 'hidden' }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          padding: '15px 20px', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          backgroundColor: '#1a1a1a', 
          userSelect: 'none'
        }}
      >
        <h4 style={{ margin: 0, color: '#e0e0e0', fontSize: '16px' }}>{title}</h4>
        <span style={{ color: '#e0e0e0', fontSize: '12px' }}>{isExpanded ? '▼ COLLAPSE' : '▲ EXPAND'}</span>
      </div>
      {isExpanded && (
        <div style={{ borderTop: '1px solid #333' }}>
          {children}
        </div>
      )}
    </div>
  );
}
