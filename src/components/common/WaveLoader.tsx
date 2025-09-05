import React, { useState, useEffect } from 'react';

/**
 * Props for WaveLoader component
 */
interface WaveLoaderProps {
  /** Whether the loader is active */
  isActive: boolean;
  /** Current audio level for visualization */
  audioLevel: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Wave loader component for audio visualization
 * 
 * @example
 * ```tsx
 * <WaveLoader 
 *   isActive={true}
 *   audioLevel={0.5}
 *   className="wave-loader--recording"
 * />
 * ```
 */
export const WaveLoader: React.FC<WaveLoaderProps> = ({ 
  isActive, 
  audioLevel, 
  className = '' 
}) => {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 150);
    
    return () => clearInterval(interval);
  }, [isActive]);
  
  const finalClassName = className ? `wave-loader ${className}` : 'wave-loader';
  
  return (
    <div className={finalClassName}>
      <div className="wave-loader__bars">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`wave-loader__bar ${
              isActive && animationPhase === index ? 'wave-loader__bar--active' : ''
            }`}
            style={{
              height: isActive ? `${Math.max(4, audioLevel * 20)}px` : '4px'
            }}
          />
        ))}
      </div>
    </div>
  );
};
