import React from 'react';
import { LegacyInsight } from '../../types/events';

/**
 * Props for Insights component
 */
interface InsightsProps {
  /** Array of insights to display */
  insights: LegacyInsight[];
  /** Additional CSS class */
  className?: string;
}

/**
 * Reusable Insights component for displaying AI analysis results
 * 
 * @example
 * ```tsx
 * <Insights 
 *   insights={insightsArray} 
 *   className="insights-content"
 * />
 * ```
 */
export const Insights: React.FC<InsightsProps> = ({ 
  insights, 
  className = 'insights-content' 
}) => {
  if (insights.length === 0) return null;
  
  return (
    <div className={className}>
      {insights.map((insight) => (
        <div 
          key={insight.id} 
          className={`insight insight--${insight.type}`}
        >
          {insight.text}
        </div>
      ))}
    </div>
  );
};
