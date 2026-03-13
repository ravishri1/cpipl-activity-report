import { useState } from 'react';
import { Package, FolderOpen } from 'lucide-react';
import MyAssets from '../assets/MyAssets';
import MyFiles from '../files/MyFiles';

const TABS = [
  { key: 'assets', label: 'My Assets', icon: Package },
  { key: 'files', label: 'My Files', icon: FolderOpen },
];

export default function MyWorkspace() {
  const [activeTab, setActiveTab] = useState('assets');

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
      {activeTab === 'assets' && <MyAssets />}
      {activeTab === 'files' && <MyFiles />}
    </div>
  );
}
