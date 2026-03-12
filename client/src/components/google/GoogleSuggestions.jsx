import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import {
  Calendar, CheckSquare, Loader2, Plus, ExternalLink, RefreshCw,
  Mail, MessageSquare, Unplug, ChevronRight, ChevronDown,
  AlertTriangle, BarChart3, ClipboardList, Bell, CheckCircle2,
} from 'lucide-react';

// ─── Category label + color mapping ───
const CATEGORY_STYLES = {
  internal: { label: 'Internal', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  vendor: { label: 'Vendor', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  government: { label: 'Government', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  other: { label: 'External', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

export default function GoogleSuggestions({ onAddTasks, onAddPlan }) {
  const [connected, setConnected] = useState(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [data, setData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [fetched, setFetched] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [activeTab, setActiveTab] = useState('work');
  const [expanded, setExpanded] = useState(new Set());
  const [pushingTasks, setPushingTasks] = useState(false);
  const [markingHandled, setMarkingHandled] = useState(new Set());

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get('/google/status');
        setConnected(res.data.connected);
        setStatusInfo(res.data);
      } catch {
        setConnected(false);
      } finally {
        setLoadingStatus(false);
      }
    };
    checkStatus();
  }, []);

  const handleConnect = async () => {
    try {
      setConnectError('');
      const res = await api.get('/google/auth-url');
      window.location.href = res.data.url;
    } catch (err) {
      console.error('Google auth error:', err);
      setConnectError(err.response?.data?.error || 'Failed to connect Google. Please try again.');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your Google account? You can reconnect anytime.')) return;
    setDisconnecting(true);
    try {
      await api.delete('/google/disconnect');
      setConnected(false);
      setData(null);
      setFetched(false);
      setSelected(new Set());
      setStatusInfo(null);
    } catch (err) {
      console.error('Google disconnect error:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const fetchAutoTasks = async () => {
    setLoadingData(true);
    try {
      const res = await api.get('/google/auto-tasks');
      setData(res.data);
      setFetched(true);
    } catch (err) {
      console.error('Fetch auto-tasks error:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const toggleItem = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleCompanyAll = (company) => {
    const threadKeys = company.threads.map(t => `email-${t.threadId}`);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = threadKeys.every(k => next.has(k));
      threadKeys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  // ─── Build selectable items from calendar + tasks ───
  const getCalendarTaskItems = useCallback(() => {
    if (!data) return [];
    const items = [];

    (data.calendar || []).forEach((e) => {
      const time = e.startTime
        ? new Date(e.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '';
      items.push({
        key: `cal-${e.id}`, source: 'calendar', icon: Calendar, iconColor: 'text-blue-500',
        label: e.title + (time ? ` (${time})` : ''),
        description: `[Meeting] ${e.title}`,
      });
    });

    (data.tasks || []).forEach((t) => {
      items.push({
        key: `task-${t.id}`, source: 'tasks', icon: CheckSquare, iconColor: 'text-green-500',
        label: t.title + (t.completed ? ' ✓ Done' : ''),
        description: `[Task] ${t.title}`,
        strikethrough: t.completed,
      });
    });

    // Split email into separate sent + received items (not one merged line)
    if (data.email) {
      if (data.email.sent > 0) {
        items.push({
          key: 'email-sent', source: 'email', icon: Mail, iconColor: 'text-indigo-500',
          label: `Sent ${data.email.sent} emails (${data.email.date})`,
          description: `[Email] Sent ${data.email.sent} emails`,
        });
      }
      if (data.email.received > 0) {
        items.push({
          key: 'email-received', source: 'email', icon: Mail, iconColor: 'text-indigo-400',
          label: `Received ${data.email.received} emails (${data.email.date})`,
          description: `[Email] Received ${data.email.received} emails`,
        });
      }
    }

    if (data.chat) {
      items.push({
        key: 'chat-summary', source: 'chat', icon: MessageSquare, iconColor: 'text-purple-500',
        label: `Sent ${data.chat.messagesSent} chat messages (${data.chat.date})`,
        description: `[Chat] Sent ${data.chat.messagesSent} chat messages`,
      });
    }

    return items;
  }, [data]);

  // ─── Add selected items as report tasks ───
  const addSelected = () => {
    const calTaskItems = getCalendarTaskItems();
    const selectedItems = [];

    // Calendar/task items
    calTaskItems
      .filter(item => selected.has(item.key))
      .forEach(item => selectedItems.push({ description: item.description, source: item.source }));

    // Email thread items
    if (data?.emailDetails) {
      for (const company of data.emailDetails.companies) {
        for (const thread of company.threads) {
          if (selected.has(`email-${thread.threadId}`)) {
            const catLabel = CATEGORY_STYLES[company.category]?.label || 'External';
            selectedItems.push({
              description: `[${catLabel}] ${company.company} — ${thread.subject} (${thread.emailCount} emails)`,
              source: 'email',
            });
          }
        }
      }
    }

    if (selectedItems.length > 0 && onAddTasks) {
      onAddTasks(selectedItems);
      // Mark added threads as handled
      const threadIds = [];
      if (data?.emailDetails) {
        for (const company of data.emailDetails.companies) {
          for (const thread of company.threads) {
            if (selected.has(`email-${thread.threadId}`)) threadIds.push(thread.threadId);
          }
        }
      }
      if (threadIds.length > 0) {
        api.post('/google/mark-handled', { threadIds, action: 'added_to_report' }).catch(() => {});
      }
    }
    setSelected(new Set());
  };

  // ─── Mark thread as handled ───
  const handleMarkHandled = async (threadId) => {
    setMarkingHandled(prev => new Set(prev).add(threadId));
    try {
      await api.post('/google/mark-handled', { threadIds: [threadId], action: 'marked_handled' });
      // Refresh data
      await fetchAutoTasks();
    } catch (err) {
      console.error('Mark handled error:', err);
    } finally {
      setMarkingHandled(prev => { const n = new Set(prev); n.delete(threadId); return n; });
    }
  };

  // ─── Add unreplied thread to plan ───
  const handleAddToPlan = (thread, company) => {
    if (!onAddPlan) return;
    const catLabel = CATEGORY_STYLES[company.category]?.label || 'External';
    onAddPlan([{
      description: `Reply to ${company.company} — ${thread.subject} (${thread.emailCount} email${thread.emailCount > 1 ? 's' : ''})`,
      source: 'email',
    }]);
    api.post('/google/mark-handled', { threadIds: [thread.threadId], action: 'added_to_report' }).catch(() => {});
  };

  // ─── Push unreplied threads to Google Tasks ───
  const handlePushToTasks = async (threads, companies) => {
    if (!threads || threads.length === 0) return;
    setPushingTasks(true);
    try {
      // Build thread data with company info
      const threadData = threads.map(t => {
        const comp = companies?.find(c => c.threads.some(ct => ct.threadId === t.threadId));
        return {
          threadId: t.threadId,
          category: comp?.category || 'other',
          company: comp?.company || 'Unknown',
          subject: t.subject,
          emailCount: t.emailCount,
          sentCount: t.sentCount,
          receivedCount: t.receivedCount,
        };
      });
      await api.post('/google/push-to-tasks', { threads: threadData });
      await fetchAutoTasks();
    } catch (err) {
      console.error('Push to tasks error:', err);
    } finally {
      setPushingTasks(false);
    }
  };

  // ─── Add all unreplied to plan ───
  const handleAddAllToPlan = () => {
    if (!onAddPlan || !data?.emailDetails?.unrepliedThreads) return;
    const items = data.emailDetails.unrepliedThreads.map(t => ({
      description: `Reply to ${t.company} — ${t.subject} (${t.emailCount} email${t.emailCount > 1 ? 's' : ''})`,
      source: 'email',
    }));
    if (items.length > 0) {
      onAddPlan(items);
      const threadIds = data.emailDetails.unrepliedThreads.map(t => t.threadId);
      api.post('/google/mark-handled', { threadIds, action: 'added_to_report' }).catch(() => {});
    }
  };

  // ─── Loading state ───
  if (loadingStatus) return null;

  // ─── Not connected ───
  if (!connected) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            Connect Google to auto-fill from Calendar, Tasks, Email & Chat
          </div>
          <button onClick={handleConnect}
            className="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Connect Google
          </button>
        </div>
        {connectError && <p className="mt-2 text-xs text-red-600">{connectError}</p>}
      </div>
    );
  }

  const emailDetails = data?.emailDetails;
  const unrepliedCount = emailDetails?.stats?.totalUnreplied || 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          Google Workspace
        </p>
        <div className="flex items-center gap-2">
          <button onClick={fetchAutoTasks} disabled={loadingData}
            className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1 disabled:opacity-50">
            {loadingData ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {fetched ? 'Refresh' : 'Load Activities'}
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="text-xs text-slate-400 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1 transition-colors disabled:opacity-50"
            title="Disconnect Google account">
            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unplug className="w-3 h-3" />}
            Disconnect
          </button>
        </div>
      </div>

      {/* Scope upgrade banner */}
      {statusInfo?.needsReconnect && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 flex items-center justify-between">
          <p className="text-xs text-amber-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Reconnect Google to enable email tracking (new permissions needed)
          </p>
          <button onClick={() => { handleDisconnect().then(() => setTimeout(handleConnect, 500)); }}
            className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded hover:bg-amber-200">
            Reconnect
          </button>
        </div>
      )}

      {fetched && (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 mb-3 -mx-4 px-4">
            {[
              { id: 'work', label: "Today's Work", icon: ClipboardList },
              { id: 'attention', label: 'Needs Attention', icon: Bell, badge: unrepliedCount },
              { id: 'summary', label: 'Summary', icon: BarChart3 },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`text-xs px-3 py-2 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Errors */}
          {data?.calendarError && <p className="text-xs text-amber-600 mb-2">Calendar: {data.calendarError}</p>}
          {data?.tasksError && <p className="text-xs text-amber-600 mb-2">Tasks: {data.tasksError}</p>}
          {data?.emailDetailsError && <p className="text-xs text-amber-600 mb-2">Email: {data.emailDetailsError}</p>}

          {/* ─── Tab A: Today's Work ─── */}
          {activeTab === 'work' && (
            <div className="space-y-0.5">
              {/* Calendar & task items */}
              {getCalendarTaskItems().map(item => {
                const Icon = item.icon;
                return (
                  <label key={item.key}
                    className="flex items-center gap-2.5 cursor-pointer hover:bg-white rounded-lg px-2.5 py-2 border border-transparent hover:border-slate-200 transition-colors">
                    <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggleItem(item.key)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 flex-shrink-0" />
                    <Icon className={`w-4 h-4 ${item.iconColor} flex-shrink-0`} />
                    <span className={`text-sm text-slate-700 leading-snug ${item.strikethrough ? 'line-through opacity-60' : ''}`}>
                      {item.label}
                    </span>
                  </label>
                );
              })}

              {/* Email company → thread groups */}
              {emailDetails?.companies?.length > 0 && (
                <>
                  {getCalendarTaskItems().length > 0 && <div className="border-t border-slate-200 my-3" />}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2.5 py-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email Activity
                  </p>
                  <div className="space-y-2">
                    {emailDetails.companies.map(company => {
                      const style = CATEGORY_STYLES[company.category] || CATEGORY_STYLES.other;
                      const isExpanded = expanded.has(company.domain);
                      const threadKeys = company.threads.map(t => `email-${t.threadId}`);
                      const allSelected = threadKeys.every(k => selected.has(k));

                      return (
                        <div key={company.domain} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          {/* Company header */}
                          <div className="flex items-center gap-2 py-2 px-3 hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => toggleExpand(company.domain)}>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.text} ${style.border} border`}>
                              {style.label}
                            </span>
                            <span className="text-sm font-medium text-slate-700">{company.company}</span>
                            <span className="text-xs text-slate-400">
                              {company.threads.length} topic{company.threads.length > 1 ? 's' : ''} · {company.totalEmails} email{company.totalEmails > 1 ? 's' : ''}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); toggleCompanyAll(company); }}
                              className="ml-auto text-xs text-blue-500 hover:text-blue-700 px-2 py-0.5 rounded hover:bg-blue-50">
                              {allSelected ? 'Deselect' : 'Select All'}
                            </button>
                          </div>

                          {/* Thread items (when expanded) */}
                          {isExpanded && (
                            <div className="border-t border-slate-100">
                              {company.threads.map(thread => (
                                <label key={thread.threadId}
                                  className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-50 px-3 py-2 border-b border-slate-50 last:border-0 transition-colors">
                                  <input type="checkbox" checked={selected.has(`email-${thread.threadId}`)}
                                    onChange={() => toggleItem(`email-${thread.threadId}`)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 leading-snug">{thread.subject}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      {thread.emailCount} email{thread.emailCount > 1 ? 's' : ''} · {thread.sentCount} sent · {thread.receivedCount} received
                                    </p>
                                  </div>
                                  {thread.replied
                                    ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" title="Replied" />
                                    : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" title="Unreplied" />
                                  }
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {getCalendarTaskItems().length === 0 && (!emailDetails || emailDetails.companies.length === 0) && (
                <p className="text-sm text-slate-400 text-center py-4">No activities found from Google Workspace today.</p>
              )}

              {/* Add selected button */}
              {selected.size > 0 && (
                <button onClick={addSelected}
                  className="w-full mt-3 text-sm bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5 font-medium shadow-sm">
                  <Plus className="w-4 h-4" /> Add {selected.size} item{selected.size > 1 ? 's' : ''} to report
                </button>
              )}
            </div>
          )}

          {/* ─── Tab B: Needs Attention ─── */}
          {activeTab === 'attention' && (
            <div className="space-y-3">
              {!emailDetails || unrepliedCount === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">All caught up!</p>
                  <p className="text-xs text-slate-400 mt-1">No unreplied emails need attention.</p>
                </div>
              ) : (
                <>
                  {/* Group unreplied by company */}
                  {emailDetails.companies
                    .filter(c => c.threads.some(t => !t.replied))
                    .map(company => {
                      const unreplied = company.threads.filter(t => !t.replied);
                      const style = CATEGORY_STYLES[company.category] || CATEGORY_STYLES.other;
                      return (
                        <div key={`attn-${company.domain}`} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.text} ${style.border} border`}>
                              {style.label}
                            </span>
                            <span className="text-sm font-medium text-slate-700">{company.company}</span>
                            <span className="text-xs text-slate-400">— {unreplied.length} unreplied</span>
                          </div>
                          {unreplied.map(thread => (
                            <div key={thread.threadId} className="flex items-start gap-2.5 px-3 py-2.5 border-b border-slate-100 last:border-0">
                              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 leading-snug">{thread.subject}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{thread.emailCount} email{thread.emailCount > 1 ? 's' : ''}</p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {onAddPlan && (
                                  <button onClick={() => handleAddToPlan(thread, company)}
                                    className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md hover:bg-blue-100 font-medium" title="Add to Plan for Tomorrow">
                                    Plan
                                  </button>
                                )}
                                <button onClick={() => handlePushToTasks([thread], emailDetails.companies)}
                                  disabled={pushingTasks}
                                  className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-md hover:bg-green-100 disabled:opacity-50 font-medium" title="Create Google Task">
                                  Task
                                </button>
                                <button onClick={() => handleMarkHandled(thread.threadId)}
                                  disabled={markingHandled.has(thread.threadId)}
                                  className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-md hover:bg-slate-200 disabled:opacity-50" title="Mark as handled">
                                  {markingHandled.has(thread.threadId) ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                  {/* Bulk actions */}
                  <div className="flex gap-2 pt-1">
                    {onAddPlan && (
                      <button onClick={handleAddAllToPlan}
                        className="flex-1 text-xs bg-blue-50 text-blue-600 py-2.5 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1.5 font-medium">
                        <Plus className="w-3.5 h-3.5" /> Add All to Plan
                      </button>
                    )}
                    <button onClick={() => handlePushToTasks(emailDetails.unrepliedThreads, emailDetails.companies)}
                      disabled={pushingTasks}
                      className="flex-1 text-xs bg-green-50 text-green-600 py-2.5 rounded-lg hover:bg-green-100 flex items-center justify-center gap-1.5 disabled:opacity-50 font-medium">
                      {pushingTasks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
                      Push All to Google Tasks
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Tab C: Summary ─── */}
          {activeTab === 'summary' && (
            <div className="space-y-3">
              {emailDetails?.stats ? (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Sent', value: emailDetails.stats.totalSent, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'Received', value: emailDetails.stats.totalReceived, color: 'text-green-600', bg: 'bg-green-50' },
                      { label: 'Threads', value: emailDetails.stats.totalThreads, color: 'text-slate-600', bg: 'bg-slate-100' },
                      { label: 'Unreplied', value: emailDetails.stats.totalUnreplied, color: unrepliedCount > 0 ? 'text-red-600' : 'text-green-600', bg: unrepliedCount > 0 ? 'bg-red-50' : 'bg-green-50' },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} rounded-lg p-2 text-center`}>
                        <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-slate-500">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Category breakdown */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">By Category</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(emailDetails.stats.byCategory)
                        .filter(([, count]) => count > 0)
                        .map(([cat, count]) => {
                          const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES.other;
                          return (
                            <span key={cat} className={`text-xs px-2 py-1 rounded ${style.bg} ${style.text} ${style.border} border`}>
                              {style.label}: {count} thread{count > 1 ? 's' : ''}
                            </span>
                          );
                        })}
                    </div>
                  </div>

                  {/* Company breakdown */}
                  {emailDetails.companies.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-500 mb-2">By Company</p>
                      <div className="space-y-1">
                        {emailDetails.companies.map(c => (
                          <div key={c.domain} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">{c.company}</span>
                            <span className="text-xs text-slate-400">
                              {c.threads.length} thread{c.threads.length > 1 ? 's' : ''} ({c.totalEmails} email{c.totalEmails > 1 ? 's' : ''})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">
                  {statusInfo?.hasGmailScope
                    ? 'Click "Load Activities" to see email summary.'
                    : 'Reconnect Google to enable email tracking.'}
                </p>
              )}

              {/* Reports API data note */}
              {(data?.email || data?.chat) && (
                <p className="text-xs text-slate-400">
                  Reports API data from {data.email?.date || data.chat?.date} (2-day delay)
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
