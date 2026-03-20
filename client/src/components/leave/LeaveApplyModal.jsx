import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { X, CalendarOff, Send, AlertTriangle, Users, UserCheck } from 'lucide-react';

export default function LeaveApplyModal({ onClose, onSuccess, balances, fyYear }) {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    session: 'full_day',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [overlap, setOverlap] = useState(null);
  const [approver, setApprover] = useState(null);

  useEffect(() => {
    api.get('/leave/types').then((res) => setLeaveTypes(res.data)).catch(() => {});
    api.get('/leave/my-approver').then((res) => setApprover(res.data)).catch(() => {});
  }, []);

  // Check overlap when dates change
  useEffect(() => {
    if (form.startDate && form.endDate && form.endDate >= form.startDate) {
      api.get(`/leave/check-overlap?startDate=${form.startDate}&endDate=${form.endDate}`)
        .then((res) => setOverlap(res.data))
        .catch(() => {});
    } else {
      setOverlap(null);
    }
  }, [form.startDate, form.endDate]);

  const selectedBalance = useMemo(() => {
    return balances?.find((b) => b.leaveTypeId === parseInt(form.leaveTypeId));
  }, [balances, form.leaveTypeId]);

  // Auto-set endDate when session is half-day
  useEffect(() => {
    if (form.session !== 'full_day' && form.startDate) {
      setForm(f => ({ ...f, endDate: f.startDate }));
    }
  }, [form.session, form.startDate]);

  const isHalfDay = form.session === 'first_half' || form.session === 'second_half';
  const isCompOff = selectedBalance?.leaveType?.code === 'COF';
  const todayStr = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await api.post('/leave/apply', {
        leaveTypeId: parseInt(form.leaveTypeId),
        startDate: form.startDate,
        endDate: form.endDate,
        session: form.session,
        reason: form.reason,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply for leave.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 sticky top-0">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800">Apply for Leave</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Approver info */}
          {approver && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 rounded-lg border border-blue-100">
              <UserCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="text-xs text-blue-600 font-medium">Approver:</span>
              {approver.driveProfilePhotoUrl || approver.profilePhotoUrl ? (
                <img
                  src={approver.driveProfilePhotoUrl || approver.profilePhotoUrl}
                  alt={approver.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-700">
                  {approver.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-xs font-semibold text-blue-800">{approver.name}</span>
                {approver.designation && (
                  <span className="text-[10px] text-blue-500 ml-1">({approver.designation})</span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type *</label>
            <select
              value={form.leaveTypeId}
              onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select leave type</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>
            {selectedBalance && (
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-blue-600">Available Balance</span>
                <span className="text-sm font-bold text-blue-700">
                  {selectedBalance.available} day{selectedBalance.available !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Session Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Session</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'full_day', label: 'Full Day' },
                { value: 'first_half', label: '1st Half' },
                { value: 'second_half', label: '2nd Half' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, session: opt.value })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.session === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className={`grid gap-3 ${isHalfDay ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isHalfDay ? 'Date *' : 'From Date *'}
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({
                  ...form,
                  startDate: e.target.value,
                  endDate: isHalfDay ? e.target.value : form.endDate,
                })}
                required
                min={isCompOff ? todayStr : undefined}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {isCompOff && <p className="text-xs text-amber-600 mt-1">Comp-Off can only be used for today or future dates</p>}
            </div>
            {!isHalfDay && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To Date *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                  min={isCompOff ? (form.startDate || todayStr) : (form.startDate || '')}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Overlap warning */}
          {overlap && overlap.hasOverlap && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">
                  {overlap.count} teammate{overlap.count > 1 ? 's' : ''} on leave
                </span>
              </div>
              <div className="space-y-1">
                {overlap.colleagues.slice(0, 3).map((c, i) => (
                  <p key={i} className="text-xs text-amber-600">
                    {c.name} — {c.leaveType} ({c.dates})
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
              rows={3}
              minLength={5}
              placeholder="Enter reason for leave (minimum 5 characters)..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.leaveTypeId || !form.startDate || (!isHalfDay && !form.endDate)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
