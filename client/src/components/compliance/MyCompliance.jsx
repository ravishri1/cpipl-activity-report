import { useState } from 'react';
import { Shield, ClipboardList } from 'lucide-react';
import PolicyAcceptance from '../policies/PolicyAcceptance';
import MySurveys from '../surveys/MySurveys';

const TABS = [
  { key: 'policies', label: 'Policies', icon: Shield },
  { key: 'surveys', label: 'Surveys', icon: ClipboardList },
];

export default function MyCompliance() {
  const [activeTab, setActiveTab] = useState('policies');

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
      {activeTab === 'policies' && <PolicyAcceptance />}
      {activeTab === 'surveys' && <MySurveys />}
    </div>
  );
}
