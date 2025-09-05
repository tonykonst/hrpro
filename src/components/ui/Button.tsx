import React from 'react';

/**
 * Button component variants
 */
export type ButtonVariant = 'start' | 'stop' | 'primary';

/**
 * Props for Button component
 */
interface ButtonProps {
  /** Button variant */
  variant: ButtonVariant;
  /** Click handler */
  onClick: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Button content */
  children: React.ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Mouse enter handler */
  onMouseEnter?: () => void;
  /** Mouse leave handler */
  onMouseLeave?: () => void;
}

/**
 * Reusable Button component with different variants
 * 
 * @example
 * ```tsx
 * <Button variant="start" onClick={handleStart}>
 *   Start Recording
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({ 
  variant, 
  onClick, 
  disabled = false, 
  children, 
  className = '',
  onMouseEnter,
  onMouseLeave
}) => {
  const baseClasses = `${variant}-button`;
  const finalClassName = className ? `${baseClasses} ${className}` : baseClasses;

  return (
    <button 
      className={finalClassName} 
      onClick={onClick} 
      disabled={disabled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{WebkitAppRegion: 'no-drag'} as any}
    >
      {children}
    </button>
  );
};
