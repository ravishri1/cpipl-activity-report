import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { IndianRupee, ScrollText, FolderOpen, LifeBuoy, User, LogOut } from 'lucide-react';

export default function AlumniPortal() {
  const { user, logout } = useAuth();

  const cards = [
    {
      to: `/employee/${user?.id}`,
      icon: User,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
      iconBg: 'bg-blue-100',
      title: 'My Profile',
      desc: 'View your employment record and personal details',
    },
    {
      to: '/payslips',
      icon: IndianRupee,
      color: 'bg-green-50 border-green-200 text-green-700',
      iconBg: 'bg-green-100',
      title: 'My Payslips',
      desc: 'Download payslips for ITR, loans, and tax filing',
    },
    {
      to: '/my-letters',
      icon: ScrollText,
      color: 'bg-purple-50 border-purple-200 text-purple-700',
      iconBg: 'bg-purple-100',
      title: 'My Letters',
      desc: 'Experience letter, relieving letter, and other documents',
    },
    {
      to: '/my-files',
      icon: FolderOpen,
      color: 'bg-orange-50 border-orange-200 text-orange-700',
      iconBg: 'bg-orange-100',
      title: 'My Files',
      desc: 'Documents uploaded during your tenure',
    },
    {
      to: '/my-support',
      icon: LifeBuoy,
      color: 'bg-slate-50 border-slate-200 text-slate-700',
      iconBg: 'bg-slate-100',
      title: 'Contact HR',
      desc: 'Raise a ticket for queries, reference requests, or corrections',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Welcome banner */}
      <div className="mb-8 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 mb-1">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm text-slate-500">
              Alumni access — your records are available for reference and downloads.
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            Alumni
          </span>
        </div>
        {user?.department && (
          <p className="mt-3 text-xs text-slate-400">
            {user.department}{user.designation ? ` · ${user.designation}` : ''}
            {user.employeeId ? ` · ${user.employeeId}` : ''}
          </p>
        )}
      </div>

      {/* Access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {cards.map(({ to, icon: Icon, color, iconBg, title, desc }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all hover:shadow-sm hover:-translate-y-0.5 ${color}`}
          >
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">{title}</div>
              <div className="text-xs opacity-75 mt-0.5 leading-snug">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <div className="text-center">
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
