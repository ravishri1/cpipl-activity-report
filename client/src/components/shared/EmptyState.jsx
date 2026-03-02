/**
 * Reusable empty state placeholder.
 * Usage: <EmptyState title="No expenses yet" subtitle="Submit your first claim" />
 * Usage: <EmptyState icon={FileText} title="No documents" />
 */
export default function EmptyState({ icon: Icon, title = 'No data found', subtitle, className = '' }) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />}
      <p className="text-slate-500 font-medium">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}
