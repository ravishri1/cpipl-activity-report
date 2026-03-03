import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { driveImageUrl } from '../../utils/formatters';
import {
  Users,
  Search,
  User,
  Mail,
  Phone,
  Building2,
  LayoutGrid,
  List,
  UserCheck,
  MapPin,
} from 'lucide-react';

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [company, setCompany] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/companies').then((r) => setCompanies(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, deptRes] = await Promise.all([
          api.get('/users/directory', { params: { search, department, company } }),
          api.get('/users/departments'),
        ]);
        setEmployees(empRes.data.users || empRes.data);
        setDepartments(deptRes.data);
      } catch (err) {
        console.error('Directory error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [search, department, company]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Users className="w-6 h-6 text-blue-600" />
        Employee Directory
        <span className="text-sm font-normal text-slate-400 ml-1">({employees.length})</span>
      </h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
          ))}
        </select>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">No employees found.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <Link
              key={emp.id}
              to={`/employee/${emp.id}`}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(driveImageUrl(emp.driveProfilePhotoUrl) || emp.profilePhotoUrl) ? (
                    <img src={driveImageUrl(emp.driveProfilePhotoUrl) || emp.profilePhotoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    emp.name?.charAt(0)?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                    {emp.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{emp.designation || 'Employee'}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] text-slate-400">{emp.department}</span>
                    {emp.company?.shortName && (
                      <span className="text-[9px] font-mono bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded ml-1">{emp.company.shortName}</span>
                    )}
                  </div>
                </div>
                {emp.employeeId && (
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    {emp.employeeId}
                  </span>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  {emp.phone && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Phone className="w-3 h-3" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                </div>
                {emp.reportingManager && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <UserCheck className="w-3 h-3 text-blue-400" />
                    <span>Reports to <span className="text-slate-500 font-medium">{emp.reportingManager.name}</span></span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-medium text-slate-600">Employee</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">ID</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Department</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Designation</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 hidden lg:table-cell">Reports To</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/employee/${emp.id}`} className="flex items-center gap-2 hover:text-blue-700">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                        {(driveImageUrl(emp.driveProfilePhotoUrl) || emp.profilePhotoUrl)
                          ? <img src={driveImageUrl(emp.driveProfilePhotoUrl) || emp.profilePhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : emp.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-800">{emp.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{emp.employeeId || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{emp.department}</td>
                  <td className="px-4 py-2.5 text-slate-600">{emp.designation || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden lg:table-cell">
                    {emp.reportingManager ? (
                      <Link to={`/employee/${emp.reportingManager.id}`} className="text-blue-600 hover:underline text-xs">
                        {emp.reportingManager.name}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{emp.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
