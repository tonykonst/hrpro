import React from 'react';

/**
 * Props for Panel component
 */
interface PanelProps {
  /** Panel content */
  children: React.ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Panel variant */
  variant?: 'default' | 'recording';
}

/**
 * Reusable Panel component for containers and sections
 * 
 * @example
 * ```tsx
 * <Panel variant="recording" className="control-panel">
 *   <div>Panel content</div>
 * </Panel>
 * ```
 */
export const Panel: React.FC<PanelProps> = ({ 
  children, 
  className = '', 
  variant = 'default' 
}) => {
  const baseClasses = variant === 'recording' ? 'control-panel control-panel--recording' : 'control-panel';
  const finalClassName = className ? `${baseClasses} ${className}` : baseClasses;

  return (
    <div className={finalClassName}>
      {children}
    </div>
  );
};
