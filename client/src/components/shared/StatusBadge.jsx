import { STATUS_STYLES } from '../../utils/constants';

const LABELS = {
  in_progress: 'In Progress',
  non_working: 'Non-Working',
  fnf_pending: 'FnF Pending',
  notice_period: 'Notice Period',
};

/**
 * Reusable status badge with consistent color mapping.
 *
 * Usage:
 *   <StatusBadge status="approved" />
 *   <StatusBadge status="urgent" styleMap={TICKET_PRIORITY_STYLES} />
 *   <StatusBadge status="custom" label="Custom Label" className="text-base" />
 */
export default function StatusBadge({ status, styleMap, label, className = '' }) {
  if (!status) return null;
  const styles = styleMap || STATUS_STYLES;
  const displayLabel =
    label ||
    LABELS[status] ||
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const colorClass = styles[status] || 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${className}`}
    >
      {displayLabel}
    </span>
  );
}
