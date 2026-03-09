import { useState } from 'react';
import {
  Users, TrendingDown, Clock, Calendar, BarChart3,
  UserCheck, UserX,
} from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

// ── Precomputed month options ──────────────────────────────────────────────────
const MONTH_OPTIONS = (() => {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    opts.push({ value: val, label });
  }
  return opts;
})();
const THIS_MONTH = MONTH_OPTIONS[0].value;

// ── Shared: DistributionBar ────────────────────────────────────────────────────
function DistributionBar({ label, count, total, color = 'bg-blue-500' }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-32 text-sm text-slate-600 truncate" title={label}>{label}</div>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-10 text-right text-sm font-medium text-slate-700">{count}</div>
      <div className="w-10 text-right text-xs text-slate-400">{pct}%</div>
    </div>
  );
}

// ── Shared: StatCard ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-blue-600', bg = 'bg-blue-50' }) {
  return (
    <div className={`${bg} rounded-xl p-4 flex items-start gap-3`}>
      <div className={`${color} mt-0.5`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: hc, loading: hcLoading, error: hcErr } = useFetch('/api/analytics/headcount', null);
  const { data: gd, loading: gdLoading, error: gdErr } = useFetch('/api/analytics/gender-diversity', null);

  if (hcLoading || gdLoading) return <LoadingSpinner />;
  if (hcErr || gdErr) return <AlertMessage type="error" message={hcErr || gdErr} />;
  if (!hc || !gd) return null;

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={UserCheck} label="Active Employees" value={hc.totalActive}
          bg="bg-green-50" color="text-green-700"
        />
        <StatCard
          icon={UserX} label="Inactive Employees" value={hc.totalInactive}
          bg="bg-red-50" color="text-red-600"
        />
        <StatCard
          icon={Users} label="Male" value={`${gd.percentages?.male ?? 0}%`}
          sub={`${gd.male} employees`} bg="bg-blue-50" color="text-blue-700"
        />
        <StatCard
          icon={Users} label="Female" value={`${gd.percentages?.female ?? 0}%`}
          sub={`${gd.female} employees`} bg="bg-pink-50" color="text-pink-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* By department */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            By Department
          </h3>
          {!hc.byDepartment?.length
            ? <EmptyState icon="🏢" title="No department data" subtitle="" />
            : hc.byDepartment.map(d => (
                <DistributionBar
                  key={d.department}
                  label={d.department}
                  count={d.count}
                  total={hc.totalActive}
                  color="bg-blue-500"
                />
              ))}
        </div>

        {/* By employment type + company */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">By Employment Type</h3>
            {hc.byEmploymentType?.map(e => (
              <DistributionBar
                key={e.type}
                label={e.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                count={e.count}
                total={hc.totalActive}
                color="bg-purple-500"
              />
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">By Company</h3>
            {hc.byCompany?.map(c => (
              <DistributionBar
                key={c.company}
                label={c.company}
                count={c.count}
                total={hc.totalActive}
                color="bg-teal-500"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Attrition ─────────────────────────────────────────────────────────────
function AttritionTab() {
  const [months, setMonths] = useState(6);
  const { data: attrition, loading, error } = useFetch(
    `/api/analytics/attrition?months=${months}`,
    []
  );

  const maxVal = attrition.length > 0
    ? Math.max(...attrition.map(d => Math.max(d.joiners, d.leavers)), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">Period:</span>
        {[3, 6, 12].map(m => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              months === m
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {m} months
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {!loading && !error && (
        <>
          {/* Visual bar chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-x-auto">
            <div
              className="flex items-end gap-2"
              style={{ minWidth: `${Math.max(attrition.length * 80, 400)}px`, height: 160 }}
            >
              {attrition.map(d => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end gap-0.5" style={{ height: 120 }}>
                    <div
                      className="flex-1 bg-green-400 rounded-t transition-all"
                      style={{
                        height: `${(d.joiners / maxVal) * 100}%`,
                        minHeight: d.joiners > 0 ? 4 : 0,
                      }}
                      title={`Joiners: ${d.joiners}`}
                    />
                    <div
                      className="flex-1 bg-red-400 rounded-t transition-all"
                      style={{
                        height: `${(d.leavers / maxVal) * 100}%`,
                        minHeight: d.leavers > 0 ? 4 : 0,
                      }}
                      title={`Leavers: ${d.leavers}`}
                    />
                  </div>
                  <span className="text-xs text-slate-500 text-center">
                    {d.label?.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 justify-end">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-400" />
                <span className="text-xs text-slate-500">Joiners</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-400" />
                <span className="text-xs text-slate-500">Leavers</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 uppercase tracking-wide">Joiners</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-red-500 uppercase tracking-wide">Leavers</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Net</th>
                </tr>
              </thead>
              <tbody>
                {attrition.map(d => {
                  const net = d.joiners - d.leavers;
                  return (
                    <tr key={d.month} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{d.label}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">{d.joiners}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-500">{d.leavers}</td>
                      <td className={`px-4 py-3 text-right font-bold ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {net > 0 ? '+' : ''}{net}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Attendance ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  present:  { label: 'Present',  bg: 'bg-green-50',  border: 'border-green-200',  color: 'text-green-700'  },
  absent:   { label: 'Absent',   bg: 'bg-red-50',    border: 'border-red-200',    color: 'text-red-600'    },
  half_day: { label: 'Half Day', bg: 'bg-amber-50',  border: 'border-amber-200',  color: 'text-amber-700'  },
  late:     { label: 'Late',     bg: 'bg-orange-50', border: 'border-orange-200', color: 'text-orange-700' },
  on_leave: { label: 'On Leave', bg: 'bg-blue-50',   border: 'border-blue-200',   color: 'text-blue-700'   },
  holiday:  { label: 'Holiday',  bg: 'bg-purple-50', border: 'border-purple-200', color: 'text-purple-700' },
  weekend:  { label: 'Weekend',  bg: 'bg-slate-50',  border: 'border-slate-200',  color: 'text-slate-600'  },
};

function AttendanceTab() {
  const [month, setMonth] = useState(THIS_MONTH);
  const { data, loading, error } = useFetch(
    `/api/analytics/attendance-summary?month=${month}`,
    null
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600">Month:</label>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTH_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {!loading && !error && data && (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div
                key={key}
                className={`${cfg.bg} border ${cfg.border} rounded-xl p-3 text-center`}
              >
                <p className="text-xs text-slate-500 mb-1">{cfg.label}</p>
                <p className={`text-xl font-bold ${cfg.color}`}>
                  {data.statusCounts?.[key] ?? 0}
                </p>
              </div>
            ))}
          </div>

          {/* LOP banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-700">
              Total LOP Days (all employees):&nbsp;
              <strong className="text-amber-900">{data.totalLopDays ?? 0}</strong>
            </p>
          </div>

          {/* Dept breakdown */}
          {data.byDepartment?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">By Department</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-green-600 uppercase tracking-wide">Present</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-red-500 uppercase tracking-wide">Absent</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-amber-600 uppercase tracking-wide">Half Day</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-orange-600 uppercase tracking-wide">Late</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-blue-600 uppercase tracking-wide">On Leave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDepartment.map(d => (
                      <tr key={d.department} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{d.department}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{d.total}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-green-600">{d.present}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-red-500">{d.absent}</td>
                        <td className="px-4 py-2.5 text-right text-amber-600">{d.half_day}</td>
                        <td className="px-4 py-2.5 text-right text-orange-600">{d.late}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600">{d.on_leave}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: Leave ─────────────────────────────────────────────────────────────────
function LeaveTab() {
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(THIS_MONTH);
  const [year, setYear] = useState(new Date().getFullYear());

  const YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

  const url = mode === 'month'
    ? `/api/analytics/leave-summary?month=${month}`
    : `/api/analytics/leave-summary?year=${year}`;

  const { data, loading, error } = useFetch(url, null);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {['month', 'year'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        {mode === 'month'
          ? (
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )
        }
      </div>

      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {!loading && !error && data && (
        <>
          {/* Utilization banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-slate-500">Total Allocated</p>
                <p className="text-xl font-bold text-blue-700">{data.utilization?.totalAllocated ?? 0} days</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Used</p>
                <p className="text-xl font-bold text-blue-700">{data.utilization?.totalUsed ?? 0} days</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Utilization Rate</p>
                <p className="text-xl font-bold text-blue-700">{data.utilization?.utilizationRate ?? 0}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Requests</p>
                <p className="text-xl font-bold text-slate-700">{data.totalRequests ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Status cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: 'approved',  label: 'Approved',  bg: 'bg-green-50', color: 'text-green-700'  },
              { key: 'pending',   label: 'Pending',   bg: 'bg-amber-50', color: 'text-amber-700'  },
              { key: 'rejected',  label: 'Rejected',  bg: 'bg-red-50',   color: 'text-red-600'    },
              { key: 'cancelled', label: 'Cancelled', bg: 'bg-slate-50', color: 'text-slate-600'  },
            ].map(s => (
              <div key={s.key} className={`${s.bg} rounded-xl p-4 text-center`}>
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{data.byStatus?.[s.key] ?? 0}</p>
              </div>
            ))}
          </div>

          {/* By type */}
          {data.byType?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">By Leave Type</h3>
              {data.byType.map(t => (
                <DistributionBar
                  key={t.type}
                  label={`${t.type}${t.code ? ` (${t.code})` : ''}`}
                  count={t.count}
                  total={data.totalRequests}
                  color="bg-green-500"
                />
              ))}
            </div>
          )}

          {/* Dept table */}
          {data.byDepartment?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">By Department</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Requests</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Days</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-green-600 uppercase tracking-wide">Approved</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-amber-600 uppercase tracking-wide">Pending</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-red-500 uppercase tracking-wide">Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDepartment.map(d => (
                      <tr key={d.department} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{d.department}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{d.count}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{d.totalDays}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-green-600">{d.approved}</td>
                        <td className="px-4 py-2.5 text-right text-amber-600">{d.pending}</td>
                        <td className="px-4 py-2.5 text-right text-red-500">{d.rejected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: Demographics ──────────────────────────────────────────────────────────
const GENDER_COLORS = {
  male:        'bg-blue-500',
  female:      'bg-pink-500',
  other:       'bg-purple-500',
  notSpecified:'bg-slate-400',
};

function DemographicsTab() {
  const { data: gd,     loading: l1, error: e1 } = useFetch('/api/analytics/gender-diversity',    null);
  const { data: age,    loading: l2, error: e2 } = useFetch('/api/analytics/age-distribution',    null);
  const { data: tenure, loading: l3, error: e3 } = useFetch('/api/analytics/tenure-distribution', null);

  if (l1 || l2 || l3) return <LoadingSpinner />;
  const err = e1 || e2 || e3;
  if (err) return <AlertMessage type="error" message={err} />;

  return (
    <div className="space-y-8">
      {/* Gender */}
      {gd && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Gender Diversity&nbsp;
            <span className="font-normal text-slate-400">({gd.total} employees)</span>
          </h3>
          {['male', 'female', 'other', 'notSpecified'].map(g => (
            <DistributionBar
              key={g}
              label={g === 'notSpecified' ? 'Not Specified' : g.charAt(0).toUpperCase() + g.slice(1)}
              count={gd[g] ?? 0}
              total={gd.total}
              color={GENDER_COLORS[g]}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Age distribution */}
        {age && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Age Distribution&nbsp;
              <span className="font-normal text-slate-400">({age.total} employees)</span>
            </h3>
            {age.distribution?.map(d => (
              <DistributionBar
                key={d.range}
                label={d.range}
                count={d.count}
                total={age.total}
                color="bg-orange-400"
              />
            ))}
          </div>
        )}

        {/* Tenure distribution */}
        {tenure && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Tenure Distribution&nbsp;
              <span className="font-normal text-slate-400">({tenure.total} employees)</span>
            </h3>
            {tenure.distribution?.map(d => (
              <DistributionBar
                key={d.range}
                label={d.range}
                count={d.count}
                total={tenure.total}
                color="bg-teal-500"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Birthdays ─────────────────────────────────────────────────────────────
function BirthdaysTab() {
  const { data, loading, error } = useFetch('/api/analytics/birthday-calendar', null);

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;
  if (!data) return null;

  // Today in MM-DD format for "today" highlight
  const todayStr = (() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const thisMonth = data.birthdays?.filter(b => b.isThisMonth) ?? [];
  const nextMonth  = data.birthdays?.filter(b => !b.isThisMonth) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎂</span>
        <div>
          <h3 className="font-semibold text-slate-800">Birthday Calendar</h3>
          <p className="text-sm text-slate-500">{data.total} upcoming birthdays</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[
          { title: 'This Month', items: thisMonth, headerCls: 'bg-amber-50 border-amber-200' },
          { title: 'Next Month', items: nextMonth,  headerCls: 'bg-blue-50  border-blue-200'  },
        ].map(({ title, items, headerCls }) => (
          <div key={title} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className={`px-4 py-3 border-b ${headerCls} flex items-center justify-between`}>
              <h3 className="font-semibold text-slate-700">{title}</h3>
              <span className="text-xs text-slate-500">{items.length} birthdays</span>
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No birthdays this period</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map(b => {
                  const isToday = b.birthDay === todayStr;
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-3 px-4 py-3 ${isToday ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {b.name?.charAt(0)?.toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{b.name}</p>
                          {isToday && (
                            <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                              Today! 🎂
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {b.department || '—'}{b.company ? ` · ${b.company}` : ''} · Age {b.age}
                        </p>
                      </div>

                      {/* Date */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-slate-600">
                          {b.birthDay?.replace('-', '/')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',    label: 'Overview',      icon: Users        },
  { key: 'attrition',  label: 'Attrition',     icon: TrendingDown },
  { key: 'attendance', label: 'Attendance',     icon: Clock        },
  { key: 'leave',      label: 'Leave',          icon: Calendar     },
  { key: 'demos',      label: 'Demographics',   icon: BarChart3    },
  { key: 'birthdays',  label: 'Birthdays',      icon: UserCheck    },
];

export default function HRAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <h1 className="text-xl font-bold text-slate-800">HR Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Workforce insights and trends</p>

        <div className="flex gap-1 mt-4 overflow-x-auto pb-px">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview'    && <OverviewTab />}
      {activeTab === 'attrition'  && <AttritionTab />}
      {activeTab === 'attendance' && <AttendanceTab />}
      {activeTab === 'leave'      && <LeaveTab />}
      {activeTab === 'demos'      && <DemographicsTab />}
      {activeTab === 'birthdays'  && <BirthdaysTab />}
    </div>
  );
}
