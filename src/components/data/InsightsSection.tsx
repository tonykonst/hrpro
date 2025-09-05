import React from 'react';
import { Insights } from '../ui/Insights';
import { LegacyInsight } from '../../types/events';

/**
 * Props for InsightsSection component
 */
interface InsightsSectionProps {
  /** Array of insights to display */
  insights: LegacyInsight[];
  /** Section title */
  title?: string;
}

/**
 * Insights section component for displaying AI analysis results
 * 
 * @example
 * ```tsx
 * <InsightsSection 
 *   insights={insightsArray}
 *   title="Insights"
 * />
 * ```
 */
export const InsightsSection: React.FC<InsightsSectionProps> = ({ 
  insights, 
  title = 'Insights' 
}) => {
  if (insights.length === 0) return null;
  
  return (
    <div className="insights-section">
      <div className="insights-section__header">
        <h3>{title}</h3>
      </div>
      <div className="insights-section__content">
        <Insights insights={insights} />
      </div>
    </div>
  );
};
