import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const SCORE_EMOJIS  = ['', '😟', '😕', '😐', '😊', '🤩'];
const SCORE_COLORS  = ['', 'bg-red-100 text-red-600', 'bg-orange-100 text-orange-600', 'bg-amber-100 text-amber-600', 'bg-green-100 text-green-600', 'bg-emerald-100 text-emerald-700'];
const SCORE_LABELS  = ['', 'Rough week', 'Below average', 'Average', 'Good week', 'Amazing week!'];
const BAR_COLORS    = ['', 'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-green-400', 'bg-emerald-500'];

export default function PulseDashboard() {
  const [tab, setTab] = useState('trends');

  const { data: trends, loading: tLoading, error: tErr } = useFetch('/api/pulse/trends', []);
  const { data: current, loading: cLoading, error: cErr } = useFetch('/api/pulse/current', null);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Weekly Pulse Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Team sentiment over time</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[['trends', 'Trends'], ['current', 'Current Week']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-sm rounded-full font-medium border transition-colors ${tab === k ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>{l}</button>
        ))}
      </div>

      {tab === 'trends' && (
        <>
          {tErr && <AlertMessage type="error" message={tErr} />}
          {tLoading ? <LoadingSpinner /> : trends.length === 0 ? (
            <EmptyState icon="📊" title="No data yet" subtitle="Pulse responses will appear here once employees submit" />
          ) : (
            <div className="space-y-4">
              {/* Summary cards for last week */}
              {trends.length > 0 && (() => {
                const latest = trends[trends.length - 1];
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                    {[
                      ['Week', latest.week.replace('-W', ' · W'), 'bg-blue-50 text-blue-700'],
                      ['Avg Score', latest.avgScore?.toFixed(1) ?? '—', 'bg-green-50 text-green-700'],
                      ['Responses', latest.count, 'bg-indigo-50 text-indigo-700'],
                      ['Top Mood', SCORE_EMOJIS[Math.round(latest.avgScore || 0)], 'bg-amber-50 text-amber-700'],
                    ].map(([l, v, cls]) => (
                      <div key={l} className={`rounded-xl p-4 ${cls}`}>
                        <div className="text-2xl font-bold">{v}</div>
                        <div className="text-xs font-medium mt-0.5 opacity-70">{l}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Trend chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-800 mb-4">Score Trend (Last 12 Weeks)</h2>
                <div className="flex items-end gap-2 h-32">
                  {trends.slice(-12).map(w => {
                    const h = w.avgScore ? Math.round((w.avgScore / 5) * 100) : 4;
                    const scoreRound = Math.round(w.avgScore || 0);
                    return (
                      <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-slate-400">{w.avgScore?.toFixed(1) ?? '—'}</span>
                        <div
                          className={`w-full rounded-t-lg ${BAR_COLORS[scoreRound] || 'bg-slate-200'}`}
                          style={{ height: `${Math.max(h, 4)}%` }}
                          title={`${w.week}: avg ${w.avgScore?.toFixed(2)}, ${w.count} responses`}
                        />
                        <span className="text-[10px] text-slate-400 truncate w-full text-center">W{w.week.slice(-2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Distribution table */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-x-auto">
                <h2 className="font-semibold text-slate-800 mb-4">Weekly Distribution</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">Week</th>
                      <th className="text-center text-xs font-semibold text-slate-500 uppercase px-2 py-2">Avg</th>
                      <th className="text-center text-xs font-semibold text-slate-500 uppercase px-2 py-2">Count</th>
                      {[1,2,3,4,5].map(n => (
                        <th key={n} className="text-center text-xs font-semibold text-slate-500 uppercase px-2 py-2">{SCORE_EMOJIS[n]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...trends].reverse().slice(0, 12).map(w => (
                      <tr key={w.week} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700">{w.week.replace('-W', ' · W')}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SCORE_COLORS[Math.round(w.avgScore || 0)]}`}>
                            {w.avgScore?.toFixed(1) ?? '—'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center text-slate-500">{w.count}</td>
                        {[1,2,3,4,5].map(n => (
                          <td key={n} className="px-2 py-2 text-center text-slate-500">{w.distribution?.[n] || 0}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'current' && (
        <>
          {cErr && <AlertMessage type="error" message={cErr} />}
          {cLoading ? <LoadingSpinner /> : !current ? (
            <EmptyState icon="📋" title="No data" subtitle="No pulse data for this week yet" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50 text-blue-700 rounded-xl p-4">
                  <div className="text-2xl font-bold">{current.responses?.length ?? 0}</div>
                  <div className="text-xs font-medium mt-0.5 opacity-70">Responded</div>
                </div>
                <div className="bg-amber-50 text-amber-700 rounded-xl p-4">
                  <div className="text-2xl font-bold">{current.notResponded?.length ?? 0}</div>
                  <div className="text-xs font-medium mt-0.5 opacity-70">Pending</div>
                </div>
                <div className="bg-green-50 text-green-700 rounded-xl p-4">
                  <div className="text-2xl font-bold">{current.avgScore?.toFixed(1) ?? '—'}</div>
                  <div className="text-xs font-medium mt-0.5 opacity-70">Avg Score</div>
                </div>
              </div>

              {/* Score distribution */}
              {current.responses?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="font-semibold text-slate-800 mb-3">Score Distribution</h2>
                  <div className="flex gap-4 flex-wrap">
                    {[1,2,3,4,5].map(n => {
                      const cnt = current.responses.filter(r => r.score === n).length;
                      return (
                        <div key={n} className={`flex-1 min-w-[80px] rounded-xl p-3 text-center ${SCORE_COLORS[n]}`}>
                          <div className="text-2xl">{SCORE_EMOJIS[n]}</div>
                          <div className="text-lg font-bold mt-1">{cnt}</div>
                          <div className="text-xs opacity-70">{SCORE_LABELS[n]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Responses list */}
              {current.responses?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="font-semibold text-slate-800 mb-3">Responses This Week</h2>
                  <div className="space-y-2">
                    {current.responses.map(r => (
                      <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                        <span className="text-2xl">{SCORE_EMOJIS[r.score]}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-slate-800">{r.user?.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCORE_COLORS[r.score]}`}>{r.score}/5</span>
                          </div>
                          {r.comment && <p className="text-sm text-slate-500 mt-0.5">{r.comment}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Not responded */}
              {current.notResponded?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="font-semibold text-slate-800 mb-3">Not Responded ({current.notResponded.length})</h2>
                  <div className="flex flex-wrap gap-2">
                    {current.notResponded.map(u => (
                      <span key={u.id} className="px-3 py-1 text-sm bg-slate-100 text-slate-600 rounded-full">{u.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
