import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { Key, Eye, EyeOff, ExternalLink } from 'lucide-react';

const PORTAL_CATEGORIES = [
  { value: 'email',      label: 'Email / Workspace',  color: 'bg-blue-100 text-blue-700' },
  { value: 'tax',        label: 'Tax & Compliance',   color: 'bg-orange-100 text-orange-700' },
  { value: 'banking',    label: 'Banking & Finance',  color: 'bg-green-100 text-green-700' },
  { value: 'erp',        label: 'ERP / Software',     color: 'bg-purple-100 text-purple-700' },
  { value: 'cloud',      label: 'Cloud / Hosting',    color: 'bg-sky-100 text-sky-700' },
  { value: 'social',     label: 'Social Media',       color: 'bg-pink-100 text-pink-700' },
  { value: 'government', label: 'Government Portal',  color: 'bg-red-100 text-red-700' },
  { value: 'other',      label: 'Other',              color: 'bg-slate-100 text-slate-600' },
];

function getCategoryInfo(value) {
  return PORTAL_CATEGORIES.find(c => c.value === value) || PORTAL_CATEGORIES[PORTAL_CATEGORIES.length - 1];
}

function CategoryBadge({ category }) {
  const info = getCategoryInfo(category);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${info.color}`}>
      {info.label}
    </span>
  );
}

function MaskedPassword({ password }) {
  const [show, setShow] = useState(false);
  if (!password) return <span className="text-slate-400 italic text-xs">not set</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm tracking-wider">{show ? password : '••••••••'}</span>
      <button
        onClick={() => setShow(v => !v)}
        className="p-0.5 rounded text-slate-400 hover:text-slate-600"
        title={show ? 'Hide password' : 'Reveal password'}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}

function CredentialCard({ cred, badge }) {
  const portal = cred.portal || {};
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{portal.name || 'Unknown Portal'}</span>
            <CategoryBadge category={portal.category || 'other'} />
            {badge}
          </div>
          {cred.displayName && (
            <div className="text-sm font-semibold text-blue-700 mt-0.5">{cred.displayName}</div>
          )}
          {cred.label && !cred.displayName && (
            <div className="text-xs text-slate-500 mt-0.5">{cred.label}</div>
          )}
        </div>
        {portal.url && (
          <a href={portal.url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50">
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm">
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
          <span className="text-xs font-medium text-slate-500 w-20 shrink-0">Username</span>
          <span className="font-mono text-slate-800 text-xs break-all">{cred.username}</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
          <span className="text-xs font-medium text-slate-500 w-20 shrink-0">Password</span>
          <MaskedPassword password={cred.password} />
        </div>
      </div>

      {cred.notes && (
        <div className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">{cred.notes}</div>
      )}
    </div>
  );
}

export default function MyCredentials() {
  const { data, loading, error: fetchErr } = useFetch('/credentials/my-credentials', { individual: [], shared: [] });

  const individual = data?.individual || [];
  const shared = data?.shared || [];
  const hasAny = individual.length > 0 || shared.length > 0;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-600" /> My Credentials
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Portal credentials assigned to you. Passwords are read-only — contact your admin to update.</p>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      {!hasAny && !fetchErr && (
        <EmptyState icon="🔑" title="No credentials assigned" subtitle="Ask your admin to assign portal credentials to you" />
      )}

      {individual.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span> Individual Credentials
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {individual.map(cred => (
              <CredentialCard key={cred.id} cred={cred} badge={
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Individual</span>
              } />
            ))}
          </div>
        </section>
      )}

      {shared.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-violet-500"></span> Shared Credentials
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shared.map(cred => (
              <CredentialCard key={cred.id} cred={cred} badge={
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">Shared</span>
              } />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
