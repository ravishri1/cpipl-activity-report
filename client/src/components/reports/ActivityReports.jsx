import { useState } from 'react';
import { ClipboardEdit, FileText } from 'lucide-react';
import ReportForm from './ReportForm';
import ReportHistory from './ReportHistory';

const TABS = [
  { key: 'submit', label: 'Submit Report', icon: ClipboardEdit },
  { key: 'history', label: 'Report History', icon: FileText },
];

export default function ActivityReports() {
  const [activeTab, setActiveTab] = useState('submit');

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
      {activeTab === 'submit' && <ReportForm />}
      {activeTab === 'history' && <ReportHistory />}
    </div>
  );
}
