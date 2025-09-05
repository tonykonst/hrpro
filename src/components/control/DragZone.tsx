import React from 'react';

/**
 * DragZone component for window dragging functionality
 * 
 * @example
 * ```tsx
 * <DragZone />
 * ```
 */
export const DragZone: React.FC = () => {
  return (
    <div 
      className="control-panel__drag-zone"
      style={{WebkitAppRegion: 'drag'} as any}
    >
      <div className="drag-dots">
        <div className="drag-dots__dot"></div>
        <div className="drag-dots__dot"></div>
        <div className="drag-dots__dot"></div>
        <div className="drag-dots__dot"></div>
      </div>
    </div>
  );
};
