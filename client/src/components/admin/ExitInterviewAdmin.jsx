import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';

const INTERVIEW_STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

const RATING_LABELS = { 1: 'Very Poor', 2: 'Poor', 3: 'Average', 4: 'Good', 5: 'Excellent' };

function RatingBar({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-slate-700">{value}/5 · {RATING_LABELS[value]}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  );
}

function DetailModal({ id, onClose }) {
  const { data: interview, loading, error } = useFetch(`/api/exit-interviews/${id}`, null);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-800">Exit Interview Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4">
          {error && <AlertMessage type="error" message={error} />}
          {loading ? <LoadingSpinner /> : !interview ? null : (
            <div className="space-y-5">
              {/* Employee info */}
              <div className="bg-slate-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-slate-400 text-xs block">Employee</span>{interview.employee?.name}</div>
                <div><span className="text-slate-400 text-xs block">Department</span>{interview.employee?.department}</div>
                <div><span className="text-slate-400 text-xs block">Designation</span>{interview.employee?.designation}</div>
                <div><span className="text-slate-400 text-xs block">Joined</span>{interview.employee?.dateOfJoining ? formatDate(interview.employee.dateOfJoining) : '—'}</div>
                <div><span className="text-slate-400 text-xs block">Separation Type</span>{interview.separation?.type}</div>
                <div><span className="text-slate-400 text-xs block">Last Working Day</span>{interview.separation?.lastWorkingDate ? formatDate(interview.separation.lastWorkingDate) : '—'}</div>
              </div>

              {/* Ratings */}
              {interview.status === 'completed' && (
                <>
                  <div>
                    <h4 className="font-medium text-slate-800 mb-3">Ratings</h4>
                    <div className="space-y-2.5">
                      <RatingBar label="Overall Experience" value={interview.overallExperience} />
                      <RatingBar label="Management & Leadership" value={interview.managementRating} />
                      <RatingBar label="Work Environment" value={interview.workEnvironmentRating} />
                      <RatingBar label="Compensation & Benefits" value={interview.compensationRating} />
                      <RatingBar label="Growth Opportunities" value={interview.growthRating} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="text-slate-500">Would Rejoin:</span>
                      <span className={`font-semibold ${interview.wouldRejoin === true ? 'text-green-600' : 'text-red-600'}`}>
                        {interview.wouldRejoin === true ? '✓ Yes' : interview.wouldRejoin === false ? '✗ No' : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Qualitative */}
                  <div className="space-y-3 text-sm">
                    {interview.reasonForLeaving && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <span className="text-xs font-semibold text-amber-700 block mb-1">REASON FOR LEAVING</span>
                        <p className="text-slate-700">{interview.reasonForLeaving}</p>
                      </div>
                    )}
                    {interview.bestAspect && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <span className="text-xs font-semibold text-green-700 block mb-1">BEST ASPECT</span>
                        <p className="text-slate-700">{interview.bestAspect}</p>
                      </div>
                    )}
                    {interview.improvementSuggestion && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <span className="text-xs font-semibold text-blue-700 block mb-1">SUGGESTIONS FOR IMPROVEMENT</span>
                        <p className="text-slate-700">{interview.improvementSuggestion}</p>
                      </div>
                    )}
                    {interview.additionalComments && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <span className="text-xs font-semibold text-slate-600 block mb-1">ADDITIONAL COMMENTS</span>
                        <p className="text-slate-700">{interview.additionalComments}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              {interview.status === 'pending' && (
                <div className="text-center py-6 text-slate-400 text-sm">Waiting for employee to complete the interview form.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InitiateModal({ onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const { data: separations } = useFetch('/lifecycle/separations?status=approved', []);
  const [separationId, setSeparationId] = useState('');

  const handleSubmit = async () => {
    try {
      await execute(() => api.post('/exit-interviews', { separationId }), 'Exit interview created!');
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Initiate Exit Interview</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Separation *</label>
            <select value={separationId} onChange={e => setSeparationId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">— Select employee separation —</option>
              {(Array.isArray(separations) ? separations : []).map(s => (
                <option key={s.id} value={s.id}>{s.user?.name} · {s.type} · {formatDate(s.requestDate)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !separationId} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExitInterviewAdmin() {
  const [statusFilter, setStatusFilter] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [showInitiate, setShowInitiate] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  const { data: interviews, loading, error: fetchErr, refetch } = useFetch(`/exit-interviews?${params}`, []);
  const { data: stats, error: statsErr } = useFetch('/exit-interviews/stats/summary', null);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Exit Interviews</h1>
          <p className="text-slate-500 text-sm mt-0.5">Structured feedback from departing employees</p>
        </div>
        <button onClick={() => setShowInitiate(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Initiate Interview
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6">
        {[['list','All Interviews'],['stats','Analytics']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${activeTab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {activeTab === 'stats' && stats && (
        <div className="space-y-4">
          {statsErr && <AlertMessage type="error" message={statsErr} />}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Total Completed', stats.total, 'bg-blue-50 text-blue-700'],
              ['Overall Avg', stats.averages.overall ? `${stats.averages.overall}/5` : '—', 'bg-amber-50 text-amber-700'],
              ['Would Rejoin', `${stats.wouldRejoin.yes} yes / ${stats.wouldRejoin.no} no`, 'bg-green-50 text-green-700'],
              ['Mgmt Avg', stats.averages.management ? `${stats.averages.management}/5` : '—', 'bg-purple-50 text-purple-700'],
            ].map(([label, value, cls]) => (
              <div key={label} className={`rounded-xl p-4 ${cls}`}>
                <div className="text-xs font-medium uppercase opacity-70">{label}</div>
                <div className="text-2xl font-bold mt-1">{value}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Average Ratings</h3>
            <div className="space-y-3">
              {[
                ['Overall Experience', stats.averages.overall],
                ['Management & Leadership', stats.averages.management],
                ['Work Environment', stats.averages.workEnvironment],
                ['Compensation & Benefits', stats.averages.compensation],
                ['Growth Opportunities', stats.averages.growth],
              ].map(([label, avg]) => avg && (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-medium">{avg}/5</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${avg >= 4 ? 'bg-green-500' : avg >= 3 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${(avg / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <>
          {fetchErr && <AlertMessage type="error" message={fetchErr} />}
          <div className="flex flex-wrap gap-2 mb-4">
            {['','pending','completed'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-xs rounded-full border font-medium ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : interviews.length === 0 ? (
            <EmptyState icon="📋" title="No exit interviews" subtitle="Initiate one for a departing employee" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Employee','Dept','Separation','Last Day','Status','Ratings',''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {interviews.map(iv => (
                    <tr key={iv.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium">{iv.employee?.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{iv.employee?.department}</td>
                      <td className="px-3 py-2.5 text-slate-500 capitalize">{iv.separation?.type}</td>
                      <td className="px-3 py-2.5 text-slate-500">{iv.separation?.lastWorkingDate ? formatDate(iv.separation.lastWorkingDate) : '—'}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={iv.status} styles={INTERVIEW_STATUS_STYLES} /></td>
                      <td className="px-3 py-2.5">
                        {iv.status === 'completed' && iv.overallExperience ? (
                          <span className="text-amber-600 font-semibold">{iv.overallExperience}/5 ⭐</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setDetailId(iv.id)} className="px-2.5 py-1 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
      {showInitiate && <InitiateModal onClose={() => setShowInitiate(false)} onDone={refetch} />}
    </div>
  );
}
