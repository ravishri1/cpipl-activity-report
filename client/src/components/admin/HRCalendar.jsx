import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';

const EVENT_COLORS = {
  holiday:     'bg-red-100 text-red-700 border-red-200',
  leave:       'bg-amber-100 text-amber-700 border-amber-200',
  wfh:         'bg-blue-100 text-blue-700 border-blue-200',
  birthday:    'bg-pink-100 text-pink-700 border-pink-200',
  anniversary: 'bg-purple-100 text-purple-700 border-purple-200',
};

const DOT_COLORS = {
  holiday:     'bg-red-400',
  leave:       'bg-amber-400',
  wfh:         'bg-blue-400',
  birthday:    'bg-pink-400',
  anniversary: 'bg-purple-400',
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}
function pad(n) { return String(n).padStart(2, '0'); }

export default function HRCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(null);

  const monthStr = `${year}-${pad(month + 1)}`;
  const { data, loading, error } = useFetch(`/api/dashboard/calendar-events?month=${monthStr}`, null);

  // Build a map: { "YYYY-MM-DD": [events] }
  const eventsByDay = {};

  if (data) {
    data.holidays?.forEach(h => {
      (eventsByDay[h.date] ??= []).push({ type: 'holiday', label: h.name, icon: '🏖️' });
    });

    data.leaves?.forEach(l => {
      // Add entry for each day in the leave range within this month
      const start = l.startDate;
      const end   = l.endDate;
      let cur = start;
      while (cur <= end && cur.startsWith(monthStr)) {
        (eventsByDay[cur] ??= []).push({ type: 'leave', label: `${l.user?.name} (${l.leaveType?.name})`, icon: '🏖' });
        const d = new Date(cur);
        d.setDate(d.getDate() + 1);
        cur = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
    });

    data.wfh?.forEach(w => {
      (eventsByDay[w.date] ??= []).push({ type: 'wfh', label: `${w.user?.name} (WFH)`, icon: '🏠' });
    });

    data.birthdays?.forEach(b => {
      (eventsByDay[b.date] ??= []).push({ type: 'birthday', label: `🎂 ${b.name}`, icon: '🎂' });
    });

    data.anniversaries?.forEach(a => {
      (eventsByDay[a.date] ??= []).push({ type: 'anniversary', label: `🏆 ${a.name} — ${a.years}yr`, icon: '🏆' });
    });
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month); // 0=Sun

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setSelectedDay(null); };

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const selectedDateStr = selectedDay ? `${year}-${pad(month + 1)}-${pad(selectedDay)}` : null;
  const selectedEvents  = selectedDateStr ? (eventsByDay[selectedDateStr] || []) : [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">HR Calendar</h1>
          <p className="text-slate-500 text-sm mt-0.5">Leaves, holidays, WFH, birthdays, and anniversaries</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">‹</button>
          <span className="font-semibold text-slate-800 min-w-36 text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">›</button>
        </div>
      </div>

      {error && <AlertMessage type="error" message={error} />}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[['Holiday','bg-red-400'],['Leave','bg-amber-400'],['WFH','bg-blue-400'],['Birthday','bg-pink-400'],['Anniversary','bg-purple-400']].map(([l, cls]) => (
          <span key={l} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />{l}
          </span>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells before month starts */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-slate-50" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr   = `${year}-${pad(month + 1)}-${pad(day)}`;
              const events    = eventsByDay[dateStr] || [];
              const isToday   = dateStr === todayStr;
              const isSelected = day === selectedDay;
              const isSunday  = (firstDay + day - 1) % 7 === 0;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`min-h-[80px] p-1.5 border-b border-r border-slate-50 cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-50' : isSunday ? 'bg-slate-50/50' : 'hover:bg-slate-50'}
                  `}
                >
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1
                    ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'}`}>
                    {day}
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {events.slice(0, 4).map((e, idx) => (
                      <span key={idx} className={`w-2 h-2 rounded-full ${DOT_COLORS[e.type]}`} title={e.label} />
                    ))}
                    {events.length > 4 && <span className="text-[9px] text-slate-400">+{events.length - 4}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day detail panel */}
      {selectedDay && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">
            {MONTH_NAMES[month]} {selectedDay}, {year}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-slate-400 text-sm">No events</p>
          ) : (
            <div className="space-y-1.5">
              {selectedEvents.map((e, idx) => (
                <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${EVENT_COLORS[e.type]}`}>
                  <span>{e.icon}</span>
                  <span>{e.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
