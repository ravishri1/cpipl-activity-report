import { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  CalendarDays,
  Plus,
  Trash2,
  Sun,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

export default function HolidayManager() {
  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', isOptional: false });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchHolidays = async () => {
    try {
      const res = await api.get(`/holidays?year=${year}`);
      setHolidays(res.data);
    } catch (err) {
      console.error('Holidays error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchHolidays();
  }, [year]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      await api.post('/holidays', form);
      setForm({ name: '', date: '', isOptional: false });
      setShowAdd(false);
      fetchHolidays();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add holiday.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    try {
      await api.delete(`/holidays/${id}`);
      fetchHolidays();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const upcoming = holidays.filter((h) => h.date >= new Date().toISOString().split('T')[0]);

  return (
    <div className="space-y-0">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          Holiday Calendar
        </h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Holiday
        </button>
      </div>

      {/* Year navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => setYear(year - 1)} className="p-2 rounded-lg hover:bg-slate-200 bg-white border border-slate-200">
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        </button>
        <span className="text-lg font-semibold text-slate-700 w-16 text-center">{year}</span>
        <button onClick={() => setYear(year + 1)} className="p-2 rounded-lg hover:bg-slate-200 bg-white border border-slate-200">
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="bg-purple-50 rounded-xl px-4 py-3">
          <p className="text-xs text-purple-500 font-medium">Total Holidays</p>
          <p className="text-2xl font-bold text-purple-700">{holidays.length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-500 font-medium">Upcoming</p>
          <p className="text-2xl font-bold text-blue-700">{upcoming.length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-500 font-medium">Optional</p>
          <p className="text-2xl font-bold text-amber-700">{holidays.filter((h) => h.isOptional).length}</p>
        </div>
      </div>

      {/* Add holiday form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Add Holiday</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          {addError && (
            <div className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-3">{addError}</div>
          )}
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Republic Day"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={form.isOptional}
                onChange={(e) => setForm({ ...form, isOptional: e.target.checked })}
                className="rounded border-slate-300"
              />
              Optional
            </label>
            <button
              type="submit"
              disabled={addLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {addLoading ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      )}

      {/* Holidays table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-medium text-slate-600">Date</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Day</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Holiday</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Type</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.length > 0 ? holidays.map((h) => {
                const isPast = h.date < new Date().toISOString().split('T')[0];
                const dateObj = new Date(h.date + 'T00:00:00');
                return (
                  <tr key={h.id} className={`hover:bg-slate-50 ${isPast ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{h.date}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {dateObj.toLocaleDateString('en-IN', { weekday: 'long' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {h.isOptional ? (
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Sun className="w-3.5 h-3.5 text-purple-500" />
                        )}
                        <span className="font-medium text-slate-800">{h.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        h.isOptional ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {h.isOptional ? 'Optional' : 'Gazetted'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleDelete(h.id, h.name)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No holidays for {year}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
