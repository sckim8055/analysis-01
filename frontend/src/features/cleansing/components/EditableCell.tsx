import React, { useState, useEffect } from 'react';

export const EditableCell = ({ getValue, row, column, table }: any) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  // When the external data changes, update the local state
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = () => {
    setIsEditing(false);
    if (value !== initialValue) {
      table.options.meta?.updateData(row.original.id, column.id, value);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onBlur();
    }
    if (e.key === 'Escape') {
      setValue(initialValue);
      setIsEditing(false);
    }
  };

  const isMissing = value === null || value === undefined || value === '';
  const isNumericOutlier = typeof value === 'number' && (value < 0 || value > 100);
  const isAbnormal = isMissing || isNumericOutlier;

  if (isEditing) {
    return (
      <input
        value={value === null ? '' : value}
        onChange={e => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        autoFocus
        style={{
          width: '100%',
          padding: '4px',
          border: '2px solid var(--primary)',
          borderRadius: '4px',
          background: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          outline: 'none'
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      style={{
        cursor: 'pointer',
        minHeight: '24px',
        padding: '4px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        background: isAbnormal ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
        border: isAbnormal ? '1px dashed var(--danger)' : '1px solid transparent',
        color: isMissing ? 'var(--danger)' : isNumericOutlier ? 'var(--warning)' : 'inherit',
        fontWeight: isAbnormal ? 'bold' : 'normal',
        transition: 'all 0.2s',
      }}
      title="더블클릭 또는 클릭하여 수정"
      onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseOut={(e) => e.currentTarget.style.background = isAbnormal ? 'rgba(239, 68, 68, 0.1)' : 'transparent'}
    >
      {isMissing ? '결측치' : value}
    </div>
  );
};
