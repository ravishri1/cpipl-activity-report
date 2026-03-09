import { useState } from 'react';
import { Plus, Users, Briefcase, ChevronRight, X, ArrowRight, Pencil, Trash2, Calendar } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { formatDate } from '../../utils/formatters';
import {
  CANDIDATE_STAGE_STYLES, JOB_STATUS_STYLES,
  CANDIDATE_STAGES, JOB_TYPES, EMPLOYMENT_MODES
} from '../../utils/constants';

const TAB_JOBS = 'jobs';
const TAB_CANDIDATES = 'candidates';
const TAB_INTERVIEWS = 'interviews';
const TAB_OFFERS = 'offers';

const INTERVIEW_RESULT_STYLES = {
  pending:  'bg-slate-100 text-slate-600 border-slate-200',
  passed:   'bg-green-100 text-green-700 border-green-200',
  failed:   'bg-red-100 text-red-700 border-red-200',
  on_hold:  'bg-amber-100 text-amber-700 border-amber-200',
};

const OFFER_STATUS_STYLES = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
  sent:      'bg-blue-100 text-blue-700 border-blue-200',
  accepted:  'bg-green-100 text-green-700 border-green-200',
  declined:  'bg-red-100 text-red-700 border-red-200',
  withdrawn: 'bg-slate-100 text-slate-500 border-slate-200',
};

const EMPTY_JOB = {
  title: '', department: '', location: '', jobType: 'full_time',
  employmentMode: 'on_site', vacancies: 1, description: '',
  requirements: '', salaryMin: '', salaryMax: '', status: 'open',
};

const EMPTY_CANDIDATE = {
  name: '', email: '', phone: '', jobOpeningId: '',
  source: '', resumeUrl: '', notes: '',
};

function JobFormModal({ job, onClose, onSave, saving }) {
  const [form, setForm] = useState(job || EMPTY_JOB);
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800">{job ? 'Edit Job Opening' : 'New Job Opening'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[['Job Title', 'title'], ['Department', 'department'], ['Location', 'location']].map(([label, key]) => (
            <div key={key} className={key === 'title' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input value={form[key] || ''} onChange={e => setField(key, e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Job Type</label>
            <select value={form.jobType} onChange={e => setField('jobType', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {JOB_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
            <select value={form.employmentMode} onChange={e => setField('employmentMode', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {EMPLOYMENT_MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vacancies</label>
            <input type="number" min="1" value={form.vacancies} onChange={e => setField('vacancies', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {['draft','open','closed','hold'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Salary Min (₹)</label>
            <input type="number" value={form.salaryMin || ''} onChange={e => setField('salaryMin', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 300000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Salary Max (₹)</label>
            <input type="number" value={form.salaryMax || ''} onChange={e => setField('salaryMax', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 600000" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Job Description</label>
            <textarea value={form.description || ''} onChange={e => setField('description', e.target.value)} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Requirements</label>
            <textarea value={form.requirements || ''} onChange={e => setField('requirements', e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Job Opening'}
          </button>
          <button onClick={onClose} className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function CandidateFormModal({ jobs, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY_CANDIDATE);
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800">Add Candidate</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[['Full Name', 'name', 'text'], ['Email', 'email', 'email'], ['Phone', 'phone', 'tel'], ['Source', 'source', 'text'], ['Resume URL', 'resumeUrl', 'url']].map(([label, key, type]) => (
            <div key={key} className={key === 'resumeUrl' || key === 'name' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input type={type} value={form[key] || ''} onChange={e => setField(key, e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={key === 'source' ? 'e.g. LinkedIn, Naukri, Referral' : ''} />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Job Opening</label>
            <select value={form.jobOpeningId} onChange={e => setField('jobOpeningId', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select job...</option>
              {jobs.filter(j => j.status === 'open').map(j => (
                <option key={j.id} value={j.id}>{j.title} — {j.department}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={e => setField('notes', e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add Candidate'}
          </button>
          <button onClick={onClose} className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ScheduleInterviewModal({ candidates, users, editInterview, onClose, onSave, saving }) {
  const EMPTY = { candidateId: '', round: 1, scheduledAt: '', mode: 'online', conductorId: '', notes: '' };
  const [form, setForm] = useState(editInterview ? {
    candidateId: editInterview.candidateId,
    round: editInterview.round,
    scheduledAt: editInterview.scheduledAt ? editInterview.scheduledAt.slice(0, 16) : '',
    mode: editInterview.mode || 'online',
    conductorId: editInterview.conductorId || '',
    notes: editInterview.notes || '',
  } : EMPTY);
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800">{editInterview ? 'Edit Interview' : 'Schedule Interview'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {!editInterview && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Candidate</label>
              <select value={form.candidateId} onChange={e => setField('candidateId', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select candidate...</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.jobOpening?.title || 'No job'}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Round</label>
            <input type="number" min="1" value={form.round} onChange={e => setField('round', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
            <select value={form.mode} onChange={e => setField('mode', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {['online','on_site','phone'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Scheduled At</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={e => setField('scheduledAt', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Interviewer</label>
            <select value={form.conductorId} onChange={e => setField('conductorId', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select interviewer...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={e => setField('notes', e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : editInterview ? 'Update Interview' : 'Schedule Interview'}
          </button>
          <button onClick={onClose} className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function CreateOfferModal({ candidates, onClose, onSave, saving }) {
  const EMPTY_OFFER = { candidateId: '', ctcOffered: '', joiningDate: '', notes: '' };
  const [form, setForm] = useState(EMPTY_OFFER);
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
  const eligible = candidates.filter(c => ['shortlisted','interview','offered'].includes(c.stage));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800">Create Offer</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Candidate</label>
            <select value={form.candidateId} onChange={e => setField('candidateId', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select candidate...</option>
              {eligible.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.jobOpening?.title || 'No job'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">CTC Offered (₹)</label>
            <input type="number" value={form.ctcOffered} onChange={e => setField('ctcOffered', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 500000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Joining Date</label>
            <input type="date" value={form.joiningDate} onChange={e => setField('joiningDate', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={e => setField('notes', e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Offer'}
          </button>
          <button onClick={onClose} className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function RecruitmentManager() {
  const [tab, setTab] = useState(TAB_JOBS);
  const [jobStatusFilter, setJobStatusFilter] = useState('open');
  const [stageFilter, setStageFilter] = useState('');
  const { data: jobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } =
    useFetch(`/recruitment/openings?status=${jobStatusFilter}`, []);
  const { data: candidates, loading: candsLoading, error: candsError, refetch: refetchCands } =
    useFetch(`/recruitment/candidates${stageFilter ? `?stage=${stageFilter}` : ''}`, []);
  const { data: interviews, loading: intvLoading, error: intvError, refetch: refetchIntvs } =
    useFetch('/recruitment/interviews', []);
  const { data: offers, loading: offersLoading, error: offersError, refetch: refetchOffers } =
    useFetch('/recruitment/offers', []);
  const { data: users } = useFetch('/users?status=active', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [showJobForm, setShowJobForm] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [showCandForm, setShowCandForm] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [editInterview, setEditInterview] = useState(null);
  const [showOfferForm, setShowOfferForm] = useState(false);

  async function saveJob(form) {
    if (editJob) {
      await execute(() => api.put(`/recruitment/openings/${editJob.id}`, form), 'Job updated!');
    } else {
      await execute(() => api.post('/recruitment/openings', form), 'Job created!');
    }
    setShowJobForm(false); setEditJob(null); refetchJobs();
  }

  async function closeJob(id) {
    if (!window.confirm('Close this job opening?')) return;
    await execute(() => api.put(`/recruitment/openings/${id}`, { status: 'closed' }), 'Job closed.');
    refetchJobs();
  }

  async function addCandidate(form) {
    await execute(() => api.post('/recruitment/candidates', form), 'Candidate added!');
    setShowCandForm(false); refetchCands();
  }

  async function moveStage(candidateId, newStage) {
    await execute(() => api.put(`/recruitment/candidates/${candidateId}/stage`, { stage: newStage }), 'Stage updated!');
    refetchCands();
  }

  async function scheduleInterview(form) {
    if (editInterview) {
      await execute(() => api.put(`/recruitment/interviews/${editInterview.id}`, form), 'Interview updated!');
    } else {
      await execute(() => api.post('/recruitment/interviews', form), 'Interview scheduled!');
    }
    setShowInterviewForm(false); setEditInterview(null); refetchIntvs();
  }

  async function deleteInterview(id) {
    if (!window.confirm('Delete this interview?')) return;
    await execute(() => api.delete(`/recruitment/interviews/${id}`), 'Interview deleted.');
    refetchIntvs();
  }

  async function createOffer(form) {
    await execute(() => api.post('/recruitment/offers', form), 'Offer created!');
    setShowOfferForm(false); refetchOffers(); refetchCands();
  }

  async function updateOfferStatus(id, status) {
    await execute(() => api.put(`/recruitment/offers/${id}`, { status }), 'Offer updated!');
    refetchOffers(); refetchCands();
  }

  const loading = tab === TAB_JOBS ? jobsLoading : tab === TAB_CANDIDATES ? candsLoading : tab === TAB_INTERVIEWS ? intvLoading : offersLoading;
  const error = tab === TAB_JOBS ? jobsError : tab === TAB_CANDIDATES ? candsError : tab === TAB_INTERVIEWS ? intvError : offersError;

  return (
    <div className="p-6">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 pb-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Recruitment</h1>
            <p className="text-sm text-slate-500 mt-1">Manage job openings and candidate pipeline</p>
          </div>
          <div className="flex gap-2">
            {tab === TAB_JOBS && (
              <button onClick={() => { setEditJob(null); setShowJobForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                <Plus className="w-4 h-4" /> New Job
              </button>
            )}
            {tab === TAB_CANDIDATES && (
              <button onClick={() => setShowCandForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                <Plus className="w-4 h-4" /> Add Candidate
              </button>
            )}
            {tab === TAB_INTERVIEWS && (
              <button onClick={() => { setEditInterview(null); setShowInterviewForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                <Plus className="w-4 h-4" /> Schedule Interview
              </button>
            )}
            {tab === TAB_OFFERS && (
              <button onClick={() => setShowOfferForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
                <Plus className="w-4 h-4" /> Create Offer
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {[{ id: TAB_JOBS, label: 'Job Openings', icon: Briefcase }, { id: TAB_CANDIDATES, label: 'Candidates', icon: Users }, { id: TAB_INTERVIEWS, label: 'Interviews', icon: Calendar }, { id: TAB_OFFERS, label: 'Offers', icon: ChevronRight }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
          {tab === TAB_JOBS && (
            <select value={jobStatusFilter} onChange={e => setJobStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {['draft','open','closed','hold'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {tab === TAB_CANDIDATES && (
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All stages</option>
              {CANDIDATE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {!loading && tab === TAB_JOBS && (
        <>
          {jobs.length === 0 && <EmptyState icon="💼" title="No job openings" subtitle="Create a new job opening to start hiring" />}
          <div className="grid grid-cols-1 gap-4">
            {jobs.map(job => (
              <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-slate-800 text-lg">{job.title}</h3>
                      <StatusBadge status={job.status} styles={JOB_STATUS_STYLES} />
                    </div>
                    <p className="text-sm text-slate-500">{job.department} · {job.location} · {job.jobType?.replace('_', ' ')} · {job.employmentMode?.replace('_', ' ')}</p>
                    {(job.salaryMin || job.salaryMax) && (
                      <p className="text-sm text-green-700 mt-1">
                        ₹{Number(job.salaryMin || 0).toLocaleString('en-IN')} – ₹{Number(job.salaryMax || 0).toLocaleString('en-IN')} / year
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-blue-700">{job._count?.candidates || 0}</p>
                    <p className="text-xs text-slate-400">candidates</p>
                    <p className="text-xs text-slate-400 mt-1">{job.vacancies} vacancies</p>
                  </div>
                </div>
                {job.description && <p className="text-sm text-slate-600 mt-3 line-clamp-2">{job.description}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <span>Posted {formatDate(job.createdAt)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setEditJob(job); setShowJobForm(true); }}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Edit</button>
                  {job.status === 'open' && (
                    <button onClick={() => closeJob(job.id)}
                      className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">Close Job</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && tab === TAB_CANDIDATES && (
        <>
          {candidates.length === 0 && <EmptyState icon="👤" title="No candidates" subtitle="Add candidates to your pipeline" />}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Name','Email','Phone','Job','Stage','Source','Added','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.jobOpening?.title || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.stage} styles={CANDIDATE_STAGE_STYLES} /></td>
                    <td className="px-4 py-3 text-slate-500">{c.source || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {CANDIDATE_STAGES.indexOf(c.stage) < CANDIDATE_STAGES.length - 1 && !['joined','rejected','withdrawn'].includes(c.stage) && (
                          <button onClick={() => moveStage(c.id, CANDIDATE_STAGES[CANDIDATE_STAGES.indexOf(c.stage) + 1])}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100">
                            <ArrowRight className="w-3 h-3" /> Next
                          </button>
                        )}
                        {!['rejected','withdrawn','joined'].includes(c.stage) && (
                          <button onClick={() => moveStage(c.id, 'rejected')}
                            className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100">Reject</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === TAB_INTERVIEWS && (
        <>
          {interviews.length === 0 && <EmptyState icon="📅" title="No interviews" subtitle="Schedule interviews for shortlisted candidates" />}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Candidate','Email','Round','Scheduled At','Mode','Interviewer','Result','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {interviews.map(iv => (
                  <tr key={iv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{iv.candidate?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{iv.candidate?.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">Round {iv.round}</td>
                    <td className="px-4 py-3 text-slate-600">{iv.scheduledAt ? formatDate(iv.scheduledAt) : '—'}</td>
                    <td className="px-4 py-3 text-slate-500 capitalize">{iv.mode?.replace('_', ' ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{iv.conductor?.name || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={iv.result || 'pending'} styles={INTERVIEW_RESULT_STYLES} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditInterview(iv); setShowInterviewForm(true); }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteInterview(iv.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === TAB_OFFERS && (
        <>
          {offers.length === 0 && <EmptyState icon="📄" title="No offers" subtitle="Create offers for shortlisted candidates" />}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Candidate','Email','CTC Offered','Joining Date','Status','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map(offer => (
                  <tr key={offer.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{offer.candidate?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{offer.candidate?.email || '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">₹{Number(offer.ctcOffered || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-slate-600">{offer.joiningDate ? formatDate(offer.joiningDate) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={offer.status} styles={OFFER_STATUS_STYLES} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {offer.status === 'draft' && (
                          <button onClick={() => updateOfferStatus(offer.id, 'sent')}
                            className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100">Send</button>
                        )}
                        {offer.status === 'sent' && (
                          <>
                            <button onClick={() => updateOfferStatus(offer.id, 'accepted')}
                              className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs hover:bg-green-100">Accept</button>
                            <button onClick={() => updateOfferStatus(offer.id, 'declined')}
                              className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100">Decline</button>
                          </>
                        )}
                        {['draft','sent'].includes(offer.status) && (
                          <button onClick={() => updateOfferStatus(offer.id, 'withdrawn')}
                            className="px-2 py-1 bg-slate-50 text-slate-600 rounded text-xs hover:bg-slate-100">Withdraw</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showJobForm && <JobFormModal job={editJob} onClose={() => { setShowJobForm(false); setEditJob(null); }} onSave={saveJob} saving={saving} />}
      {showCandForm && <CandidateFormModal jobs={jobs} onClose={() => setShowCandForm(false)} onSave={addCandidate} saving={saving} />}
      {showInterviewForm && <ScheduleInterviewModal candidates={candidates} users={users} editInterview={editInterview} onClose={() => { setShowInterviewForm(false); setEditInterview(null); }} onSave={scheduleInterview} saving={saving} />}
      {showOfferForm && <CreateOfferModal candidates={candidates} onClose={() => setShowOfferForm(false)} onSave={createOffer} saving={saving} />}
    </div>
  );
}
