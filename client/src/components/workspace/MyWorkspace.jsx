import { useState } from 'react';
import { Package, FolderOpen, LayoutDashboard, CheckCircle, Clock, CreditCard, FileText } from 'lucide-react';
import MyAssets from '../assets/MyAssets';
import MyFiles from '../files/MyFiles';
import { useFetch } from '../../hooks/useFetch';
import { formatINR, formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { LEAVE_STATUS_STYLES, EXPENSE_STATUS_STYLES } from '../../utils/constants';

const TABS = [
  { key: 'summary', label: 'My Summary', icon: LayoutDashboard },
  { key: 'assets', label: 'My Assets', icon: Package },
  { key: 'files', label: 'My Files', icon: FolderOpen },
];

function MySummary() {
  const { data: leaveBalances, loading: lbLoading, error: lbErr } = useFetch('/leave/my-balance', []);
  const { data: leaveRequests, loading: lrLoading, error: lrErr } = useFetch('/leave/my-requests', []);
  const { data: expenses, loading: exLoading, error: exErr } = useFetch('/expenses/my', []);
  const { data: payslips, loading: psLoading, error: psErr } = useFetch('/payroll/my-payslips', []);

  const loading = lbLoading || lrLoading || exLoading || psLoading;
  if (loading) return <LoadingSpinner />;

  const pendingLeaves = (leaveRequests || []).filter(l => l.status === 'pending');
  const recentExpenses = (expenses || []).slice(0, 3);
  const pendingExpenses = (expenses || []).filter(e => e.status === 'pending');
  const latestPayslip = (payslips || []).length > 0 ? payslips[0] : null;

  return (
    <div className="p-6 space-y-6">
      {(lbErr || lrErr || exErr || psErr) && (
        <AlertMessage type="error" message={lbErr || lrErr || exErr || psErr} />
      )}

      {/* Leave Balances */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <h2 className="font-semibold text-slate-800 text-sm">Leave Balances</h2>
        </div>
        <div className="p-4">
          {leaveBalances.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">No leave balances configured</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {leaveBalances.map((b) => (
                <div key={b.id} className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1 truncate">{b.leaveType?.name || 'Leave'}</p>
                  <p className="text-2xl font-bold text-blue-600">{b.balance ?? 0}</p>
                  <p className="text-xs text-slate-400">days left</p>
                  {b.used > 0 && <p className="text-xs text-slate-400 mt-0.5">{b.used} used</p>}
                </div>
              ))}
            </div>
          )}
          {pendingLeaves.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-amber-600 mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {pendingLeaves.length} pending request(s)
              </p>
              {pendingLeaves.map(l => (
                <div key={l.id} className="flex items-center justify-between text-xs text-slate-600 py-1">
                  <span>{l.leaveType?.name || 'Leave'} — {formatDate(l.startDate)} to {formatDate(l.endDate)}</span>
                  <StatusBadge status={l.status} styles={LEAVE_STATUS_STYLES} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-600" />
            <h2 className="font-semibold text-slate-800 text-sm">Expense Claims</h2>
          </div>
          {pendingExpenses.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {pendingExpenses.length} pending
            </span>
          )}
        </div>
        <div className="p-4">
          {recentExpenses.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">No expense claims yet</p>
          ) : (
            <div className="space-y-2">
              {recentExpenses.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.title || e.description || 'Expense'}</p>
                    <p className="text-xs text-slate-400">{formatDate(e.expenseDate || e.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{formatINR(e.amount)}</span>
                    <StatusBadge status={e.status} styles={EXPENSE_STATUS_STYLES} />
                  </div>
                </div>
              ))}
              {expenses.length > 3 && (
                <p className="text-xs text-slate-400 text-center pt-1">+{expenses.length - 3} more — view all in Expense Claims</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Latest Payslip */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-slate-800 text-sm">Latest Payslip</h2>
        </div>
        <div className="p-4">
          {!latestPayslip ? (
            <p className="text-sm text-slate-400 text-center py-2">No payslips available yet</p>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{latestPayslip.month} {latestPayslip.year}</p>
                <p className="text-xs text-slate-400 mt-0.5">Generated: {formatDate(latestPayslip.generatedAt || latestPayslip.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">{formatINR(latestPayslip.netPay || latestPayslip.netSalary || 0)}</p>
                <p className="text-xs text-slate-400">Net Pay</p>
              </div>
            </div>
          )}
          {payslips.length > 1 && (
            <p className="text-xs text-slate-400 mt-3 text-center">{payslips.length} payslip(s) total — view all in Payroll</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyWorkspace() {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="flex px-6 pt-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {activeTab === 'summary' && <MySummary />}
      {activeTab === 'assets' && <MyAssets />}
      {activeTab === 'files' && <MyFiles />}
    </div>
  );
}
