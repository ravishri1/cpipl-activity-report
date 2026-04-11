import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';

const STATUS_LABELS = {
  pending_manager: { label: 'Awaiting Manager Approval', color: 'bg-yellow-100 text-yellow-800', step: 1 },
  pending_hr:      { label: 'Awaiting HR Confirmation',  color: 'bg-blue-100 text-blue-800',   step: 2 },
  notice_period:   { label: 'Notice Period Running',      color: 'bg-orange-100 text-orange-800', step: 3 },
  clearance:       { label: 'Clearance In Progress',      color: 'bg-purple-100 text-purple-800', step: 4 },
  fnf_pending:     { label: 'FnF Calculation Pending',    color: 'bg-pink-100 text-pink-800',   step: 5 },
  fnf_approved:    { label: 'FnF Approved',               color: 'bg-teal-100 text-teal-800',   step: 6 },
  completed:       { label: 'Exit Completed',             color: 'bg-green-100 text-green-800', step: 7 },
  rejected:        { label: 'Rejected',                   color: 'bg-red-100 text-red-800',     step: 0 },
  cancelled:       { label: 'Withdrawn',                  color: 'bg-gray-100 text-gray-600',   step: 0 },
};

const PIPELINE_STEPS = [
  { step: 1, label: 'Submitted' },
  { step: 2, label: 'Manager Approved' },
  { step: 3, label: 'HR Confirmed' },
  { step: 4, label: 'Notice Period' },
  { step: 5, label: 'Clearance' },
  { step: 6, label: 'FnF' },
  { step: 7, label: 'Completed' },
];

export default function MyResignation() {
  const { data: sep, loading, error: fetchErr, refetch } = useFetch('/api/separation/my', null);
  const { execute, loading: submitting, error: submitErr, success } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reason: '', preferredLWD: '' });

  const handleSubmitResignation = async () => {
    if (!window.confirm('Are you sure you want to submit your resignation? This action will be sent to your manager for approval.')) return;
    try {
      await execute(() => api.post('/api/separation/resign', form), 'Resignation submitted successfully!');
      refetch();
      setShowForm(false);
      setForm({ reason: '', preferredLWD: '' });
    } catch {}
  };

  const handleWithdraw = async () => {
    if (!window.confirm('Are you sure you want to withdraw your resignation?')) return;
    try {
      await execute(() => api.delete(`/api/separation/${sep.id}`), 'Resignation withdrawn.');
      refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  const statusInfo = sep ? (STATUS_LABELS[sep.status] || { label: sep.status, color: 'bg-gray-100 text-gray-600', step: 0 }) : null;
  const currentStep = statusInfo?.step || 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Resignation</h1>
        {!sep && (
          <button onClick={() => setShowForm(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium">
            Submit Resignation
          </button>
        )}
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {submitErr && <AlertMessage type="error" message={submitErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Resignation Form */}
      {showForm && !sep && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Submit Resignation</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <strong>⚠️ Please Read Before Submitting:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>All leaves during notice period will be treated as <strong>LOP</strong> and will extend your last working day</li>
              <li>Last 30 days salary will be held and processed 45 days after your last working day</li>
              <li>This cannot be undone after HR confirmation</li>
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Resignation *</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-red-500 focus:outline-none"
              rows={4}
              placeholder="Please provide your reason for resignation..."
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Last Working Day (optional)</label>
            <input
              type="date"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              value={form.preferredLWD}
              onChange={e => setForm(f => ({ ...f, preferredLWD: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Your notice period will be calculated from today. HR will confirm the final date.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmitResignation} disabled={submitting || !form.reason.trim()} className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Resignation'}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* No resignation */}
      {!sep && !showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📄</div>
          <h3 className="text-lg font-semibold text-gray-700">No Active Resignation</h3>
          <p className="text-gray-500 text-sm mt-1">You have not submitted a resignation. Click the button above to begin the process.</p>
        </div>
      )}

      {/* Active Resignation */}
      {sep && (
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo?.color}`}>
                  {statusInfo?.label}
                </span>
              </div>
              {['pending_manager', 'pending_hr'].includes(sep.status) && (
                <button onClick={handleWithdraw} disabled={submitting} className="text-sm text-gray-500 hover:text-red-600 underline">
                  Withdraw Resignation
                </button>
              )}
            </div>

            {/* Pipeline Progress */}
            {currentStep > 0 && (
              <div className="relative mt-6">
                <div className="flex items-center justify-between">
                  {PIPELINE_STEPS.map((s, i) => (
                    <div key={s.step} className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 relative ${
                        currentStep > s.step ? 'bg-green-500 text-white' :
                        currentStep === s.step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                        'bg-gray-200 text-gray-500'
                      }`}>
                        {currentStep > s.step ? '✓' : s.step}
                      </div>
                      <span className={`text-xs mt-1 text-center ${currentStep >= s.step ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {s.label}
                      </span>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <div className={`absolute top-4 h-0.5 ${currentStep > s.step ? 'bg-green-500' : 'bg-gray-200'}`}
                          style={{ left: `calc(${(i + 1) * (100 / PIPELINE_STEPS.length)}% - 16px)`, right: `calc(${(PIPELINE_STEPS.length - i - 2) * (100 / PIPELINE_STEPS.length)}% + 16px)` }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Key Dates */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Key Dates</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DateCard label="Resignation Submitted" value={sep.requestDate} />
              <DateCard label="Expected LWD" value={sep.expectedLWD} />
              {sep.adjustedLWD && sep.adjustedLWD !== sep.lastWorkingDate && (
                <DateCard label="Adjusted LWD" value={sep.adjustedLWD} highlight />
              )}
              {sep.lastWorkingDate && <DateCard label="Confirmed LWD" value={sep.lastWorkingDate} highlight />}
              {sep.salaryHoldUntil && <DateCard label="Salary Hold Until" value={sep.salaryHoldUntil} warning />}
            </div>

            {sep.daysRemainingInNotice > 0 && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800">
                <strong>⏳ {sep.daysRemainingInNotice} days remaining</strong> in your notice period
                {sep.leaveDaysDuringNotice > 0 && (
                  <span className="block mt-1">
                    ⚠️ {sep.leaveDaysDuringNotice} leave day(s) taken — your LWD has been extended accordingly
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Salary Hold Notice */}
          {sep.salaryHolds?.length > 0 && (
            <div className={`border rounded-xl p-6 ${sep.salaryReleased ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <h3 className={`text-base font-semibold mb-3 ${sep.salaryReleased ? 'text-green-800' : 'text-amber-800'}`}>
                {sep.salaryReleased ? '✅ Salary Released' : '🔒 Salary Hold Notice'}
              </h3>
              {!sep.salaryReleased && (
                <p className="text-sm text-amber-700 mb-3">
                  Your last 30 days of salary is on hold and will be processed after <strong>{sep.salaryHoldUntil}</strong>.
                  {sep.daysUntilSalaryRelease > 0 && ` (${sep.daysUntilSalaryRelease} days remaining)`}
                </p>
              )}
              <div className="space-y-2">
                {sep.salaryHolds.map(h => (
                  <div key={h.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-amber-100 text-sm">
                    <span className="text-gray-700">{h.description || h.month}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-800">{h.heldDays} days — ₹{h.heldAmount.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${h.released ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {h.released ? 'Released' : 'On Hold'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Total Held</span>
                <span className="text-gray-900">₹{sep.totalHeldAmount?.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * Salary amounts are recorded in your payslips for the respective months. The hold is on payment only — it appears in company books normally.
              </p>
            </div>
          )}

          {/* FnF Summary */}
          {sep.fnfItems?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Full & Final Settlement</h3>
              <div className="space-y-2">
                {sep.fnfItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
                    <span className="text-gray-700">{item.label}</span>
                    <span className={`font-medium ${item.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {item.amount < 0 ? '−' : '+'}₹{Math.abs(item.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-base font-bold">
                <span>Net FnF</span>
                <span className={sep.fnfNetAmount >= 0 ? 'text-green-700' : 'text-red-600'}>
                  ₹{(sep.fnfNetAmount || 0).toFixed(2)}
                </span>
              </div>
              {sep.fnfApprovedAt && (
                <p className="text-xs text-green-600 mt-2">✅ FnF approved on {formatDate(sep.fnfApprovedAt)}</p>
              )}
            </div>
          )}

          {/* Clearance Checklist */}
          {sep.checklist?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Clearance Checklist</h3>
              <div className="space-y-2">
                {['IT', 'Admin', 'Finance', 'Manager', 'HR'].map(dept => {
                  const items = sep.checklist.filter(c => c.department === dept);
                  if (!items.length) return null;
                  return (
                    <div key={dept}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">{dept}</p>
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 py-1.5 text-sm">
                          <span className={`text-base ${item.status === 'done' ? 'text-green-500' : item.status === 'na' ? 'text-gray-400' : 'text-gray-300'}`}>
                            {item.status === 'done' ? '✅' : item.status === 'na' ? '➖' : '⏳'}
                          </span>
                          <span className={item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}>{item.task}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DateCard({ label, value, highlight, warning }) {
  if (!value) return null;
  return (
    <div className={`rounded-lg p-3 border ${warning ? 'bg-amber-50 border-amber-200' : highlight ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${warning ? 'text-amber-800' : highlight ? 'text-blue-800' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}
