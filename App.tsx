
import React, { useState, useEffect, useMemo } from 'react';
import { AnimatedTitle } from './components/AnimatedTitle';
import { AppView, TimeSession, User } from './types';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { AuthScreen } from './components/AuthScreen';
import { formatDuration, formatDurationShort, formatDate } from './utils/formatTime';
import { User as UserIcon } from 'lucide-react';
import { supabase } from './lib/supabase';


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [currentProjectName, setCurrentProjectName] = useState('');
  const [activeSessionStartTime, setActiveSessionStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [editingSession, setEditingSession] = useState<TimeSession | null>(null);
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectsViewMode, setProjectsViewMode] = useState<'cards' | 'list'>('cards');
  const [logForm, setLogForm] = useState({
    projectName: '',
    date: new Date().toISOString().split('T')[0],
    durationHours: 0,
    durationMinutes: 0
  });
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logDurationMinH, setLogDurationMinH] = useState('');
  const [logDurationMaxH, setLogDurationMaxH] = useState('');
  const [activeLogFilters, setActiveLogFilters] = useState<Set<'name' | 'date' | 'duration'>>(new Set());
  const [sortField, setSortField] = useState<'projectName' | 'createdAt' | 'durationMs'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<string | null>(null);
  const [editingProjectCard, setEditingProjectCard] = useState<string | null>(null);
  const [editingProjectNewName, setEditingProjectNewName] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setSessions([]);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load sessions from Supabase when user is set
  useEffect(() => {
    if (!user) return;
    setIsLoadingSessions(true);
    supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSessions(
          (data ?? []).map(r => ({
            id: r.id,
            projectName: r.project_name,
            startTime: r.start_time,
            endTime: r.end_time,
            durationMs: r.duration_ms,
            createdAt: r.created_at,
          }))
        );
        setIsLoadingSessions(false);
      });
  }, [user]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setShowStopConfirm(false);
        setPendingDeleteId(null);
      }
      if (e.key === ' ' && view === AppView.TIMER && !showStopConfirm) {
        e.preventDefault();
        setShowStopConfirm(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, showStopConfirm]);

  // Clear log filters when leaving log view
  useEffect(() => {
    if (view !== AppView.LOG) {
      setLogSearchQuery('');
      setActiveLogFilters(new Set());
    }
  }, [view]);

  // Timer effect
  useEffect(() => {
    let interval: number;
    if (activeSessionStartTime) {
      interval = window.setInterval(() => {
        setElapsed(Date.now() - activeSessionStartTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSessionStartTime]);

  // Aggregate stats by project
  const projectStats = useMemo(() => {
    const stats: Record<string, { totalMs: number; lastActive: string; startDate: string; count: number }> = {};
    
    sessions.forEach(s => {
      const name = s.projectName;
      if (!stats[name]) {
        stats[name] = { totalMs: 0, lastActive: s.createdAt, startDate: s.createdAt, count: 0 };
      }
      stats[name].totalMs += s.durationMs;
      stats[name].count += 1;
      
      const sessionDate = new Date(s.createdAt);
      if (sessionDate > new Date(stats[name].lastActive)) {
        stats[name].lastActive = s.createdAt;
      }
      if (sessionDate < new Date(stats[name].startDate)) {
        stats[name].startDate = s.createdAt;
      }
    });

    return Object.entries(stats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
  }, [sessions]);

  const filteredProjects = useMemo(() => {
    return projectStats.filter(p => 
      p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())
    );
  }, [projectStats, projectSearchQuery]);

  // Calculate total time previously spent on the current project
  const accumulatedTimeForProject = useMemo(() => {
    if (!currentProjectName) return 0;
    return sessions
      .filter(s => s.projectName.toLowerCase() === currentProjectName.toLowerCase())
      .reduce((acc, curr) => acc + curr.durationMs, 0);
  }, [currentProjectName, sessions]);

  // Get unique recent projects for quick start
  const recentProjects = useMemo(() => {
    const unique = new Set<string>();
    const list: string[] = [];
    for (const session of sessions) {
      if (!unique.has(session.projectName.toLowerCase())) {
        unique.add(session.projectName.toLowerCase());
        list.push(session.projectName);
      }
      if (list.length >= 5) break;
    }
    return list;
  }, [sessions]);

  const sortedSessions = useMemo(() => {
    const filtered = sessions.filter(s => {
      if (!s.projectName.toLowerCase().includes(logSearchQuery.toLowerCase())) return false;
      const date = new Date(s.createdAt);
      if (logDateFrom && date < new Date(logDateFrom + 'T00:00:00')) return false;
      if (logDateTo && date > new Date(logDateTo + 'T23:59:59')) return false;
      const minMs = parseInt(logDurationMinH || '0') * 3600000;
      const maxMs = parseInt(logDurationMaxH || '0') * 3600000;
      if (logDurationMinH && s.durationMs < minMs) return false;
      if (logDurationMaxH && s.durationMs > maxMs) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'projectName') {
        comparison = a.projectName.localeCompare(b.projectName);
      } else if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'durationMs') {
        comparison = a.durationMs - b.durationMs;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sessions, logSearchQuery, logDateFrom, logDateTo, logDurationMinH, logDurationMaxH, sortField, sortDirection]);

  const toggleSort = (field: 'projectName' | 'createdAt' | 'durationMs') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleStartProject = (name?: string) => {
    const finalName = name || currentProjectName;
    if (!finalName.trim()) return;
    
    setCurrentProjectName(finalName);
    setActiveSessionStartTime(Date.now());
    setElapsed(0);
    setShowStopConfirm(false);
    setView(AppView.TIMER);
  };

  const handleStopProject = async () => {
    if (!activeSessionStartTime || !user) return;

    const endTime = Date.now();
    const newSession: TimeSession = {
      id: crypto.randomUUID(),
      projectName: currentProjectName,
      startTime: activeSessionStartTime,
      endTime,
      durationMs: endTime - activeSessionStartTime,
      createdAt: new Date().toISOString()
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSessionStartTime(null);
    setElapsed(0);
    setCurrentProjectName('');
    setView(AppView.LOG);

    await supabase.from('sessions').insert({
      id: newSession.id,
      user_id: user.id,
      project_name: newSession.projectName,
      start_time: newSession.startTime,
      end_time: newSession.endTime,
      duration_ms: newSession.durationMs,
    });
  };

  const deleteSession = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    await supabase.from('sessions').delete().eq('id', id);
  };

  const handleSignOut = () => supabase.auth.signOut();

  const deleteProject = async (name: string) => {
    setSessions(prev => prev.filter(s => s.projectName !== name));
    await supabase.from('sessions').delete().eq('project_name', name);
  };

  const renameProject = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setEditingProjectCard(null); return; }
    setSessions(prev => prev.map(s => s.projectName === oldName ? { ...s, projectName: newName } : s));
    setEditingProjectCard(null);
    await supabase.from('sessions').update({ project_name: newName }).eq('project_name', oldName);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const durationMs = (logForm.durationHours * 60 + logForm.durationMinutes) * 60 * 1000;
    const createdAt = new Date(logForm.date + 'T00:00:00').toISOString();

    if (editingSession) {
      setSessions(prev => prev.map(s =>
        s.id === editingSession.id
          ? { ...s, projectName: logForm.projectName, durationMs, createdAt }
          : s
      ));
      setEditingSession(null);
      await supabase.from('sessions').update({
        project_name: logForm.projectName,
        duration_ms: durationMs,
        created_at: createdAt,
      }).eq('id', editingSession.id);
    } else {
      const newSession: TimeSession = {
        id: crypto.randomUUID(),
        projectName: logForm.projectName,
        startTime: Date.now() - durationMs,
        durationMs,
        createdAt
      };
      setSessions(prev => [newSession, ...prev]);
      setIsAddingLog(false);
      await supabase.from('sessions').insert({
        id: newSession.id,
        user_id: user.id,
        project_name: newSession.projectName,
        start_time: newSession.startTime,
        duration_ms: newSession.durationMs,
        created_at: newSession.createdAt,
      });
    }
    setLogForm({ projectName: '', date: new Date().toISOString().split('T')[0], durationHours: 0, durationMinutes: 0 });
  };

  const startEditing = (session: TimeSession) => {
    setEditingSession(session);
    const totalMinutes = Math.round(session.durationMs / 60000);
    setLogForm({
      projectName: session.projectName,
      date: new Date(session.createdAt).toISOString().split('T')[0],
      durationHours: Math.floor(totalMinutes / 60),
      durationMinutes: totalMinutes % 60
    });
  };

  const startAddingLog = () => {
    setIsAddingLog(true);
    setLogForm({
      projectName: logSearchQuery || '',
      date: new Date().toISOString().split('T')[0],
      durationHours: 0,
      durationMinutes: 0
    });
  };

  const renderLanding = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center max-w-xl mx-auto space-y-12 px-4 md:px-0">
      <div className="space-y-1">
        <AnimatedTitle
          text="SLOGGING"
          style={{ letterSpacing: '0rem', fontWeight: 300, fontSize: 'clamp(2.5rem, 18vw, 16rem)', color: '#f5f5f5', lineHeight: 1 }}
        />
        <p className="text-white/60 text-lg">Log the Slog and Get Your Mooney</p>
      </div>

      <div className="w-full space-y-8">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleStartProject(); }} 
          className="w-full space-y-6"
        >
          <div className="relative">
            <input
              type="text"
              placeholder="What are you working on?"
              value={currentProjectName}
              onChange={(e) => setCurrentProjectName(e.target.value)}
              maxLength={30}
              className="w-full bg-transparent border-b border-white/20 text-2xl md:text-3xl py-4 px-2 focus:outline-none focus:border-white transition-colors placeholder:text-white/30 text-center"
            />
            {currentProjectName.length === 30 && (
              <p className="absolute -bottom-6 left-0 right-0 text-[10px] text-white/50 uppercase tracking-widest text-center">
                Maximum 30 characters reached
              </p>
            )}
          </div>
          <Button 
            type="submit" 
            disabled={!currentProjectName.trim()}
            className="w-full md:w-auto"
          >
            Start Session
          </Button>
        </form>

        {recentProjects.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] tracking-widest text-white/40 uppercase font-bold">Quick Start</p>
            <div className="flex flex-wrap justify-center gap-2">
              {recentProjects.map(name => (
                <button
                  key={name}
                  onClick={() => handleStartProject(name)}
                  className="px-4 py-2 rounded-full border border-white/20 text-white/60 hover:text-white hover:border-gray-500 transition-all text-sm"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );

  const renderTimer = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-16">
      <div className="text-center space-y-4">
        <span className="text-white/50 text-sm tracking-widest uppercase font-semibold">Active Session</span>
        <h2 className="text-3xl font-medium text-white">{currentProjectName}</h2>
        {accumulatedTimeForProject > 0 && (
          <p className="text-white/50 text-sm">
            Already Logged: {formatDurationShort(accumulatedTimeForProject)}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="mono text-8xl md:text-[10rem] font-light text-white tracking-tighter tabular-nums animate-pulse-soft px-4">
          {formatDuration(elapsed)}
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          variant="primary"
          onClick={() => setShowStopConfirm(true)}
          className="px-12 py-4"
        >
          Stop
        </Button>
      </div>
    </div>
  );

  const renderLog = () => (
    <div className="max-w-4xl mx-auto pt-12 flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] px-4 md:px-0">
      <div className="flex-shrink-0 space-y-8 pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-light">Time Log</h2>
          <button
            onClick={startAddingLog}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border-2 border-white/20 transition-all rounded-full text-[10px] font-bold uppercase tracking-widest group/btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add missing Time Log
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex-shrink-0">Filter by</span>
            {(['name', 'date', 'duration'] as const).map(f => {
              const labels = { name: 'Project', date: 'Date', duration: 'Duration' };
              const active = activeLogFilters.has(f);
              return (
                <button
                  key={f}
                  onClick={() => {
                    const next = new Set(activeLogFilters);
                    if (active) {
                      next.delete(f);
                      if (f === 'name') setLogSearchQuery('');
                      if (f === 'date') { setLogDateFrom(''); setLogDateTo(''); }
                      if (f === 'duration') { setLogDurationMinH(''); setLogDurationMaxH(''); }
                    } else {
                      next.add(f);
                    }
                    setActiveLogFilters(next);
                  }}
                  className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    active
                      ? 'border-white text-white bg-white/10'
                      : 'border-white/20 text-white/40 hover:border-gray-600 hover:text-white/60'
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {activeLogFilters.size > 0 && <div className="border border-white/20 rounded-2xl p-4 space-y-3">

          {activeLogFilters.has('name') && (
            <div className="relative">
              <input
                autoFocus
                type="text"
                placeholder="Project name..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 text-sm py-2 px-2 focus:outline-none focus:border-white transition-colors placeholder:text-white/30 text-gray-300"
              />
              {logSearchQuery && (
                <button
                  onClick={() => setLogSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-[10px] uppercase tracking-widest font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {(activeLogFilters.has('date') || activeLogFilters.has('duration')) && (
            <div className="flex items-center gap-4 flex-wrap">
              {activeLogFilters.has('date') && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="date"
                    value={logDateFrom}
                    onChange={e => setLogDateFrom(e.target.value)}
                    className="bg-transparent border-b border-white/20 text-sm py-2 px-2 focus:outline-none focus:border-white transition-colors text-white/60 flex-1 min-w-0"
                  />
                  <span className="text-gray-700 text-xs flex-shrink-0">—</span>
                  <input
                    type="date"
                    value={logDateTo}
                    onChange={e => setLogDateTo(e.target.value)}
                    className="bg-transparent border-b border-white/20 text-sm py-2 px-2 focus:outline-none focus:border-white transition-colors text-white/60 flex-1 min-w-0"
                  />
                  {(logDateFrom || logDateTo) && (
                    <button
                      onClick={() => { setLogDateFrom(''); setLogDateTo(''); }}
                      className="text-white/40 hover:text-white text-[10px] uppercase tracking-widest font-bold flex-shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              {activeLogFilters.has('date') && activeLogFilters.has('duration') && (
                <span className="text-gray-800 text-xs flex-shrink-0">|</span>
              )}
              {activeLogFilters.has('duration') && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Min</span>
                  <div className="relative w-16">
                    <input type="number" min="0" placeholder="0" value={logDurationMinH}
                      onChange={e => setLogDurationMinH(e.target.value)}
                      className="w-full bg-transparent border-b border-white/20 text-sm py-2 px-2 focus:outline-none focus:border-white transition-colors text-white/60 pr-8"
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-white/40 text-xs">hrs</span>
                  </div>
                  <span className="text-gray-700 text-xs">—</span>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Max</span>
                  <div className="relative w-16">
                    <input type="number" min="0" placeholder="0" value={logDurationMaxH}
                      onChange={e => setLogDurationMaxH(e.target.value)}
                      className="w-full bg-transparent border-b border-white/20 text-sm py-2 px-2 focus:outline-none focus:border-white transition-colors text-white/60 pr-8"
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-white/40 text-xs">hrs</span>
                  </div>
                  {(logDurationMinH || logDurationMaxH) && (
                    <button
                      onClick={() => { setLogDurationMinH(''); setLogDurationMaxH(''); }}
                      className="text-white/40 hover:text-white text-[10px] uppercase tracking-widest font-bold flex-shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          </div>}
        </div>

        {(isAddingLog || editingSession) && (
          <Card className="p-6 border border-white/20">
            <form onSubmit={handleSaveLog} className="space-y-6">
              <h3 className="text-lg font-medium text-white">
                {editingSession ? 'Edit Time Log Entry' : 'Add Missing Time Log'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Project Name</label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    list="project-names"
                    value={logForm.projectName}
                    onChange={e => setLogForm(prev => ({ ...prev, projectName: e.target.value }))}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  />
                  <datalist id="project-names">
                    {projectStats.map(p => <option key={p.name} value={p.name} />)}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Date</label>
                  <input
                    type="date"
                    required
                    value={logForm.date}
                    onChange={e => setLogForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Duration</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={logForm.durationHours || ''}
                        onChange={e => setLogForm(prev => ({ ...prev, durationHours: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-xs">hrs</span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="0"
                        value={logForm.durationMinutes || ''}
                        onChange={e => setLogForm(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-xs">min</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" type="button" onClick={() => { setIsAddingLog(false); setEditingSession(null); }}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={logForm.durationHours === 0 && logForm.durationMinutes === 0}>
                  Save Time Log
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {sessions.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            No logged sessions yet.
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            No entries match your filters.
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px] md:grid-cols-[1fr_150px_140px_120px] gap-4 px-6 py-3 text-[10px] uppercase tracking-widest text-white/50 border-b border-white/20 sticky top-0 bg-[#4F4C82]">
              <button
                onClick={() => toggleSort('projectName')}
                className="flex items-center gap-1 hover:text-white transition-colors text-left"
              >
                PROJECT NAME
                {sortField === 'projectName' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <button
                onClick={() => toggleSort('createdAt')}
                className="hidden md:flex items-center gap-1 hover:text-white transition-colors text-left"
              >
                DATE
                {sortField === 'createdAt' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <button
                onClick={() => toggleSort('durationMs')}
                className="flex items-center gap-1 hover:text-white transition-colors justify-center"
              >
                TIME
                {sortField === 'durationMs' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <div className="hidden md:block"></div>
            </div>
            {/* Rows */}
            {sortedSessions.map((session) => (
              <div key={session.id}>
                {/* Row */}
                <div
                  className="grid grid-cols-[1fr_80px] md:grid-cols-[1fr_150px_140px_120px] gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors rounded-xl md:cursor-default cursor-pointer overflow-hidden"
                  onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                  onMouseEnter={() => setHoveredSessionId(session.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                >
                  <div className="text-white font-medium truncate">{session.projectName}</div>
                  <div className="hidden md:block text-white/50 text-sm">{formatDate(session.createdAt)}</div>
                  <div className="mono text-white/80 text-center">{formatDurationShort(session.durationMs)}</div>
                  {/* Desktop actions */}
                  <div className={`hidden md:flex justify-end gap-1 transition-opacity opacity-0 ${hoveredSessionId === session.id ? 'opacity-100' : ''}`}>
                    <button onClick={(e) => { e.stopPropagation(); handleStartProject(session.projectName); }} className="text-white/50 hover:text-green-400 p-1.5 transition-colors" title="Continue">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); startEditing(session); }} className="text-white/50 hover:text-blue-400 p-1.5 transition-colors" title="Edit">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setPendingDeleteId(session.id); }} className="text-white/50 hover:text-red-500 p-1.5 transition-colors" title="Delete">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
                {/* Mobile expanded actions */}
                {expandedSessionId === session.id && (
                  <div className="md:hidden flex gap-4 px-6 pb-4 -mt-2">
                    <button onClick={() => { handleStartProject(session.projectName); setExpandedSessionId(null); }} className="flex items-center gap-2 text-white/60 hover:text-green-400 text-xs uppercase tracking-widest font-bold transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Play
                    </button>
                    <button onClick={() => { startEditing(session); setExpandedSessionId(null); }} className="flex items-center gap-2 text-white/60 hover:text-blue-400 text-xs uppercase tracking-widest font-bold transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button onClick={() => { setPendingDeleteId(session.id); setExpandedSessionId(null); }} className="flex items-center gap-2 text-white/60 hover:text-red-500 text-xs uppercase tracking-widest font-bold transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            {/* Footer total */}
            <div className="grid grid-cols-[1fr_80px] md:grid-cols-[1fr_150px_140px_120px] gap-4 px-6 py-3 items-center border-t border-white/20 mt-2 sticky bottom-0 bg-[#4F4C82]">
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                {sortedSessions.length} {sortedSessions.length === 1 ? 'entry' : 'entries'}
              </div>
              <div className="hidden md:block"></div>
              <div className="mono text-white/60 text-center text-sm">
                {formatDurationShort(sortedSessions.reduce((acc, s) => acc + s.durationMs, 0))}
              </div>
              <div className="hidden md:block"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderProjects = () => (
    <div className="max-w-4xl mx-auto pt-12 flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] px-4 md:px-0">
      <div className="flex-shrink-0 space-y-6 pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-light">Projects</h2>
          <button
            onClick={() => { setIsAddingProject(true); setNewProjectName(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border-2 border-white/20 transition-all rounded-full text-[10px] font-bold uppercase tracking-widest group/btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add new Project
          </button>
        </div>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Search projects..."
            value={projectSearchQuery}
            onChange={(e) => setProjectSearchQuery(e.target.value)}
            className="w-full bg-transparent border-b border-white/20 text-xl py-3 px-2 focus:outline-none focus:border-white transition-colors placeholder:text-white/30 text-left"
          />
          {projectSearchQuery && (
            <button 
              onClick={() => setProjectSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs uppercase tracking-widest font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {isAddingProject && (
          <Card className="p-6 border border-white/20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProjectName.trim()) return;
                setIsAddingProject(false);
                handleStartProject(newProjectName.trim());
              }}
              className="space-y-6"
            >
              <h3 className="text-lg font-medium text-white">New Project</h3>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Project Name</label>
                <input
                  autoFocus
                  type="text"
                  required
                  maxLength={30}
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="What are you working on?"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/30"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" type="button" onClick={() => setIsAddingProject(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={!newProjectName.trim()}>
                  Start Session
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 text-white/50 bg-white/5 rounded-3xl border border-dashed border-white/20">
            {projectSearchQuery ? "No projects match your search." : "No projects tracked yet."}
          </div>
        ) : projectsViewMode === 'cards' ? (
          filteredProjects.map((project) => (
            <Card key={project.name} className="flex flex-col md:flex-row md:items-center justify-between gap-6 group">
              <div className="flex-1 space-y-4 pl-4">
                <div>
                  {editingProjectCard === project.name ? (
                    <form onSubmit={(e) => { e.preventDefault(); renameProject(project.name, editingProjectNewName); }} className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        maxLength={30}
                        value={editingProjectNewName}
                        onChange={e => setEditingProjectNewName(e.target.value)}
                        className="bg-white/10 border-b border-white text-xl font-medium text-white focus:outline-none px-1 w-full max-w-[280px]"
                      />
                      <button type="submit" className="text-green-400 text-xs font-bold uppercase tracking-widest">Save</button>
                      <button type="button" onClick={() => setEditingProjectCard(null)} className="text-white/40 text-xs font-bold uppercase tracking-widest">Cancel</button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-xl font-medium text-white truncate max-w-[280px] cursor-pointer"
                        title={project.name}
                        onClick={() => { setLogSearchQuery(project.name); setActiveLogFilters(new Set(['name'])); setView(AppView.LOG); }}
                      >
                        {project.name}
                      </h3>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingProjectCard(project.name); setEditingProjectNewName(project.name); }}
                          className="text-white/40 hover:text-blue-400 p-1 transition-colors"
                          title="Rename"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => setPendingDeleteProject(project.name)}
                          className="text-white/40 hover:text-red-400 p-1 transition-colors"
                          title="Delete project"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="mt-2">
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest border border-white/40 px-3 py-0.5 rounded-full">
                      {project.count} {project.count === 1 ? 'Session' : 'Sessions'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-white/50 text-xs">
                    Last active on {formatDate(project.lastActive)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-4 min-w-[180px]">
                <div className="text-left">
                  <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Total Project Time</div>
                  <div className="text-4xl text-white" style={{ fontWeight: 300, letterSpacing: '0.1rem' }}>
                    {formatDurationShort(project.totalMs)}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleStartProject(project.name); }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border-2 border-white/20 hover:border-green-400 transition-all rounded-full text-[10px] font-bold uppercase tracking-widest group/btn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Continue
                </button>
              </div>
            </Card>
          ))
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_130px_100px] gap-4 px-4 py-3 text-[10px] uppercase tracking-widest text-white/50 border-b border-white/20 sticky top-0 bg-[#4F4C82]">
              <span>Project Name</span>
              <span>Sessions</span>
              <span>Last Active</span>
              <span className="text-right">Total Time</span>
            </div>
            {filteredProjects.map((project) => (
              <div
                key={project.name}
                className="grid grid-cols-[1fr_80px_130px_100px] gap-4 px-4 py-3 items-center hover:bg-white/5 transition-colors rounded-xl cursor-pointer"
                onClick={() => { setLogSearchQuery(project.name); setActiveLogFilters(new Set(['name'])); setView(AppView.LOG); }}
              >
                <span className="text-white font-medium truncate">{project.name}</span>
                <span className="text-white/50 text-sm">{project.count}</span>
                <span className="text-white/50 text-sm">{formatDate(project.lastActive)}</span>
                <span className="mono text-gray-200 text-sm text-right">{formatDurationShort(project.totalMs)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!user) return <AuthScreen />;

  if (isLoadingSessions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/50 text-sm tracking-widest uppercase font-bold animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 selection:bg-white selection:text-[#6461A0]">
      <nav className="fixed top-0 left-0 right-0 h-20 px-8 flex items-center justify-between pointer-events-none z-50">
        <div
          className="font-bold text-xl cursor-pointer pointer-events-auto opacity-20 hover:opacity-70 transition-opacity duration-[1000ms]" style={{ letterSpacing: '0rem' }}
          onClick={() => { view !== AppView.TIMER && setView(AppView.LANDING); setShowMobileMenu(false); }}
        >
          SLOGGING
        </div>
        {!activeSessionStartTime && (
          <>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-10 pointer-events-auto">
              <button onClick={() => setView(AppView.LANDING)} className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-all hover:text-white ${view === AppView.LANDING ? 'text-white' : 'text-white/50'}`}>Home</button>
              <button onClick={() => setView(AppView.PROJECTS)} className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-all hover:text-white ${view === AppView.PROJECTS ? 'text-white' : 'text-white/50'}`}>Projects</button>
              <button onClick={() => setView(AppView.LOG)} className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-all hover:text-white ${view === AppView.LOG ? 'text-white' : 'text-white/50'}`}>Time Log</button>
              <button onClick={() => setShowSignOutConfirm(true)} className="text-white/50 transition-all hover:text-white p-1" title="Sign out"><UserIcon size={18} /></button>
            </div>
            {/* Mobile hamburger */}
            <button
              className="md:hidden pointer-events-auto text-white/50 hover:text-white transition-colors p-1"
              onClick={() => setShowMobileMenu(prev => !prev)}
            >
              {showMobileMenu
                ? <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              }
            </button>
          </>
        )}
      </nav>

      {/* Mobile menu overlay */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-40 flex items-start justify-end pt-16 px-4" onClick={() => setShowMobileMenu(false)}>
          <div className="glass rounded-3xl p-8 flex flex-col gap-6 border border-white/10 min-w-[180px]" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setView(AppView.LANDING); setShowMobileMenu(false); }} className={`text-left text-[10px] uppercase tracking-[0.2em] font-bold transition-all hover:text-white ${view === AppView.LANDING ? 'text-white' : 'text-white/50'}`}>Home</button>
            <button onClick={() => { setView(AppView.PROJECTS); setShowMobileMenu(false); }} className={`text-left text-[10px] uppercase tracking-[0.2em] font-bold transition-all hover:text-white ${view === AppView.PROJECTS ? 'text-white' : 'text-white/50'}`}>Projects</button>
            <button onClick={() => { setView(AppView.LOG); setShowMobileMenu(false); }} className={`text-left text-[10px] uppercase tracking-[0.2em] font-bold transition-all hover:text-white ${view === AppView.LOG ? 'text-white' : 'text-white/50'}`}>Time Log</button>
            <button onClick={() => { setShowSignOutConfirm(true); setShowMobileMenu(false); }} className="text-left text-[10px] uppercase tracking-[0.2em] font-bold text-white/50 hover:text-white transition-all">Sign Out</button>
          </div>
        </div>
      )}

      <main className="pt-16 max-w-7xl mx-auto">
        {view === AppView.LANDING && renderLanding()}
        {view === AppView.TIMER && renderTimer()}
        {view === AppView.LOG && renderLog()}
        {view === AppView.PROJECTS && renderProjects()}
      </main>

      {pendingDeleteId && (() => {
        const session = sessions.find(s => s.id === pendingDeleteId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-[#4F4C82]/60 backdrop-blur-sm" onClick={() => setPendingDeleteId(null)} />
            <div className="relative glass rounded-3xl p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4 border border-white/10">
              <div className="space-y-3 text-center">
                <h3 className="text-xl font-medium text-white">Delete entry?</h3>
                {session && (
                  <p className="text-white/50 text-sm">
                    <span className="text-gray-300">{session.projectName}</span> · {formatDate(session.createdAt)} · {formatDurationShort(session.durationMs)}
                  </p>
                )}
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="danger" className="flex-1" onClick={() => { deleteSession(pendingDeleteId); setPendingDeleteId(null); }}>Delete</Button>
                <Button variant="ghost" className="flex-1" onClick={() => setPendingDeleteId(null)}>Keep</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {pendingDeleteProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[#6461A0]/60 backdrop-blur-sm" onClick={() => setPendingDeleteProject(null)} />
          <div className="relative glass rounded-3xl p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4 border border-white/10">
            <div className="space-y-3 text-center">
              <h3 className="text-xl font-medium text-white">Delete project?</h3>
              <p className="text-white/50 text-sm">
                This will permanently delete <span className="text-white">{pendingDeleteProject}</span> and all its sessions.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="danger" className="flex-1" onClick={() => { deleteProject(pendingDeleteProject); setPendingDeleteProject(null); }}>Delete</Button>
              <Button variant="ghost" className="flex-1" onClick={() => setPendingDeleteProject(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[#4F4C82]/60 backdrop-blur-sm" onClick={() => setShowSignOutConfirm(false)} />
          <div className="relative glass rounded-3xl p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4 border border-white/10">
            <div className="space-y-3 text-center">
              <h3 className="text-xl font-medium text-white">Sign out?</h3>
              <p className="text-white/50 text-sm">You'll need to sign back in to access your sessions.</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="danger" className="flex-1" onClick={() => { setShowSignOutConfirm(false); handleSignOut(); }}>Sign Out</Button>
              <Button variant="ghost" className="flex-1" onClick={() => setShowSignOutConfirm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {showStopConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[#4F4C82]/60 backdrop-blur-sm" onClick={() => setShowStopConfirm(false)} />
          <div className="relative glass rounded-3xl p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4 border border-white/10">
            {elapsed < 600000 ? (
              <div className="space-y-3 text-center">
                <h3 className="text-xl font-medium text-white">Stopping already?</h3>
                <p className="text-white/50 text-sm">You gotta work for at least 10 minutes for this session to count.</p>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <h3 className="text-xl font-medium text-white">Stop session?</h3>
                <p className="mono text-4xl text-white tracking-tighter">{formatDurationShort(elapsed)}</p>
                <p className="text-white/50 text-sm">will be saved to <span className="text-gray-300">{currentProjectName}</span></p>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <Button variant="danger" className="flex-1" onClick={() => {
                setShowStopConfirm(false);
                setActiveSessionStartTime(null);
                setCurrentProjectName('');
                setElapsed(0);
                setView(AppView.LANDING);
              }}>
                End Session
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => {
                if (elapsed >= 600000) {
                  setShowStopConfirm(false);
                  handleStopProject();
                } else {
                  setShowStopConfirm(false);
                }
              }}>
                {elapsed >= 600000 ? 'Save' : 'Keep Going'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
