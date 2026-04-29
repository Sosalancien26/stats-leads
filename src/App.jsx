import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Plus, Trash2, Copy, Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Euro, Target, BarChart3, History, CalendarDays, Search, LogOut, Loader2, AlertCircle } from 'lucide-react';

// ============== SUPABASE CONFIG ==============
const SUPABASE_URL = 'https://yxfanlgklvpdpsrzcoqy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SA4vTbf1FfOH2YNHtw3LJg_geqlOxpV';

// Mini Supabase client (pas de SDK, fetch direct)
const sb = {
  _session: null,
  _listeners: [],
  init() {
    try {
      const raw = localStorage.getItem('sb_session');
      if (raw) this._session = JSON.parse(raw);
    } catch (e) {}
  },
  setSession(s) {
    this._session = s;
    if (s) localStorage.setItem('sb_session', JSON.stringify(s));
    else localStorage.removeItem('sb_session');
    this._listeners.forEach(cb => cb(s));
  },
  onChange(cb) { this._listeners.push(cb); return () => { this._listeners = this._listeners.filter(x => x !== cb); }; },
  getUser() { return this._session?.user || null; },
  getToken() { return this._session?.access_token || null; },

  async _authFetch(path, body) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || data.error || 'Erreur authentification');
    return data;
  },
  async signUp(email, password) {
    const data = await this._authFetch('signup', { email, password });
    if (data.access_token) this.setSession(data);
    return data;
  },
  async signIn(email, password) {
    const data = await this._authFetch('token?grant_type=password', { email, password });
    this.setSession(data);
    return data;
  },
  async signOut() {
    if (this._session?.access_token) {
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${this._session.access_token}` },
        });
      } catch (e) {}
    }
    this.setSession(null);
  },
  async refreshSession() {
    if (!this._session?.refresh_token) return null;
    try {
      const data = await this._authFetch('token?grant_type=refresh_token', { refresh_token: this._session.refresh_token });
      this.setSession(data);
      return data;
    } catch (e) {
      this.setSession(null);
      return null;
    }
  },

  async db(method, path, { body, headers = {} } = {}) {
    let token = this.getToken();
    const doFetch = async (tk) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${tk}`,
        Prefer: 'return=representation',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let r = await doFetch(token);
    if (r.status === 401) {
      const refreshed = await this.refreshSession();
      if (refreshed) r = await doFetch(refreshed.access_token);
    }
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`DB ${r.status}: ${txt}`);
    }
    if (r.status === 204) return null;
    return r.json();
  },
};
sb.init();

// ============== HELPERS ==============
const fmtEur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n || 0);
const fmtEurShort = (n) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k€` : `${(n || 0).toFixed(0)}€`;
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;
const margeColor = (n) => n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-400';

const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const toIsoDate = (d) => {
  if (typeof d === 'string') return d;
  return d.toISOString().split('T')[0];
};
const formatDate = (d) => {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};
const getWeekRange = (startDate) => {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start: formatDate(start), end: formatDate(end) };
};
const getCurrentMonday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
};
const getMonthKey = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const getMonthLabel = (key) => {
  const [year, month] = key.split('-');
  return `${MOIS_FR[parseInt(month) - 1]} ${year}`;
};

const computeWeekStats = (w) => {
  const sum = (arr, key) => arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  const iteLeads = w.lead_sources?.filter(x => x.category === 'ITE') || [];
  const pvLeads = w.lead_sources?.filter(x => x.category === 'PV') || [];
  const iteSales = w.sales?.filter(x => x.category === 'ITE') || [];
  const pvSales = w.sales?.filter(x => x.category === 'PV') || [];

  const iteCost = sum(iteLeads, 'cost');
  const iteLeadsCount = sum(iteLeads, 'leads');
  const iteCA = sum(iteSales, 'ca');
  const iteMarge = sum(iteSales, 'marge');
  const pvCost = sum(pvLeads, 'cost');
  const pvLeadsCount = sum(pvLeads, 'leads');
  const pvCA = sum(pvSales, 'ca');
  const cesarCost = Number(w.cesar_cost) || 0;
  const sachaCost = Number(w.sacha_cost) || 0;
  const totalCA = iteCA + pvCA;
  const totalCost = iteCost + pvCost + cesarCost + sachaCost;
  const totalMarge = totalCA - totalCost;
  return {
    iteCost, iteLeadsCount, iteCA, iteMarge,
    pvCost, pvLeadsCount, pvCA,
    pvMarge: pvCA - pvCost,
    cesarCost, sachaCost,
    cesarMarge: -cesarCost, sachaMarge: -sachaCost,
    totalCA, totalCost, totalMarge,
    totalLeads: iteLeadsCount + pvLeadsCount,
    cmIte: iteLeadsCount > 0 ? iteCost / iteLeadsCount : 0,
    cmPv: pvLeadsCount > 0 ? pvCost / pvLeadsCount : 0,
    iteMargePct: iteCost > 0 ? (iteMarge / iteCost) * 100 : 0,
    pvMargePct: pvCost > 0 ? ((pvCA - pvCost) / pvCost) * 100 : 0,
    totalMargePct: totalCost > 0 ? (totalMarge / totalCost) * 100 : 0,
    iteLeads, pvLeads, iteSales, pvSales,
  };
};

// ============== APP ==============
export default function App() {
  const [user, setUser] = useState(sb.getUser());

  useEffect(() => sb.onChange((s) => setUser(s?.user || null)), []);

  // Try refresh on mount if session exists
  useEffect(() => {
    if (sb.getUser()) sb.refreshSession();
  }, []);

  if (!user) return <AuthScreen />;
  return <StatsLeads user={user} />;
}

// ============== AUTH SCREEN ==============
function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'signin') {
        await sb.signIn(email, password);
      } else {
        const data = await sb.signUp(email, password);
        if (!data.access_token) {
          setInfo('Compte créé ! Vérifie tes emails pour confirmer ton adresse, puis connecte-toi.');
          setMode('signin');
        }
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 mb-3">
            <BarChart3 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Stats Leads</h1>
          <p className="text-sm text-slate-400 mt-1">{mode === 'signin' ? 'Connexion à ton tableau de bord' : 'Crée ton compte'}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
              placeholder="ton@email.com" autoComplete="email" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
              placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </div>

          {error && <div className="bg-rose-900/30 border border-rose-800/50 rounded-lg px-3 py-2 text-sm text-rose-300 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>}
          {info && <div className="bg-cyan-900/30 border border-cyan-800/50 rounded-lg px-3 py-2 text-sm text-cyan-300">{info}</div>}

          <button onClick={submit} disabled={loading || !email || !password}
            className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signin' ? 'Se connecter' : 'Créer le compte'}
          </button>

          <div className="text-center pt-2">
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo(''); }}
              className="text-sm text-slate-400 hover:text-slate-200">
              {mode === 'signin' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== MAIN APP ==============
function StatsLeads({ user }) {
  const [weeks, setWeeks] = useState([]);
  const [currentWeekId, setCurrentWeekId] = useState(null);
  const [activeTab, setActiveTab] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const defaultIteSources = ['GOOGLE - ITE CESAR PREMIUM (ELS 3)', 'PREMIUM SEARCH ITE (ELS 2)', 'FACEBOOK'];
  const defaultPvSources = ['LEAD PV NEW (ELS 2)', 'PANNEAU SOLAIRE AIDES (ELS 3)', 'PREMIUM SEARCH PV', 'FACEBOOK'];

  const loadWeeks = useCallback(async () => {
    try {
      const data = await sb.db('GET', 'weeks?select=*,lead_sources(*),sales(*)&order=start_date.desc');
      setWeeks(data || []);
      if (data?.length > 0 && !currentWeekId) setCurrentWeekId(data[0].id);
      else if (data?.length === 0) {
        // Create initial week
        const monday = getCurrentMonday();
        await createWeekWithDefaults(monday);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [currentWeekId]);

  useEffect(() => { loadWeeks(); }, []); // eslint-disable-line

  const createWeekWithDefaults = async (startDate) => {
    try {
      const [w] = await sb.db('POST', 'weeks', {
        body: [{ user_id: user.id, start_date: startDate, cesar_cost: 0, sacha_cost: 0 }],
      });
      const sourcesPayload = [
        ...defaultIteSources.map((name, i) => ({ week_id: w.id, category: 'ITE', source_name: name, cost: 0, leads: 0, position: i })),
        ...defaultPvSources.map((name, i) => ({ week_id: w.id, category: 'PV', source_name: name, cost: 0, leads: 0, position: i })),
      ];
      const salesPayload = [
        { week_id: w.id, category: 'ITE', client_name: 'GSH', ca: 0, marge: 0, leads: 0, position: 0 },
        { week_id: w.id, category: 'PV', client_name: 'ALPHA CONNECT', ca: 0, marge: 0, leads: 0, position: 0 },
      ];
      await sb.db('POST', 'lead_sources', { body: sourcesPayload });
      await sb.db('POST', 'sales', { body: salesPayload });
      await loadWeeks();
      setCurrentWeekId(w.id);
    } catch (e) {
      setError(e.message);
    }
  };

  const currentWeek = useMemo(() => weeks.find(w => w.id === currentWeekId), [weeks, currentWeekId]);
  const calc = useMemo(() => currentWeek ? computeWeekStats(currentWeek) : null, [currentWeek]);

  const sortedWeekIds = useMemo(() => weeks.map(w => w.id), [weeks]);
  const currentIdx = sortedWeekIds.indexOf(currentWeekId);

  // Local optimistic update + DB sync
  const patchWeek = async (weekId, patch) => {
    setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, ...patch } : w));
    try {
      await sb.db('PATCH', `weeks?id=eq.${weekId}`, { body: patch });
    } catch (e) { setError(e.message); loadWeeks(); }
  };

  const updateRow = async (table, rowId, patch) => {
    setWeeks(prev => prev.map(w => ({
      ...w,
      [table]: w[table]?.map(r => r.id === rowId ? { ...r, ...patch } : r),
    })));
    try {
      await sb.db('PATCH', `${table}?id=eq.${rowId}`, { body: patch });
    } catch (e) { setError(e.message); loadWeeks(); }
  };

  const deleteRow = async (table, rowId, weekId) => {
    setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, [table]: w[table].filter(r => r.id !== rowId) } : w));
    try {
      await sb.db('DELETE', `${table}?id=eq.${rowId}`);
    } catch (e) { setError(e.message); loadWeeks(); }
  };

  const addLeadSource = async (weekId, category) => {
    try {
      const week = weeks.find(w => w.id === weekId);
      const maxPos = Math.max(-1, ...(week?.lead_sources?.filter(x => x.category === category).map(x => x.position) || []));
      const [row] = await sb.db('POST', 'lead_sources', {
        body: [{ week_id: weekId, category, source_name: 'Nouvelle source', cost: 0, leads: 0, position: maxPos + 1 }],
      });
      setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, lead_sources: [...(w.lead_sources || []), row] } : w));
    } catch (e) { setError(e.message); }
  };

  const addSale = async (weekId, category) => {
    try {
      const week = weeks.find(w => w.id === weekId);
      const maxPos = Math.max(-1, ...(week?.sales?.filter(x => x.category === category).map(x => x.position) || []));
      const [row] = await sb.db('POST', 'sales', {
        body: [{ week_id: weekId, category, client_name: 'Nouveau client', ca: 0, marge: 0, leads: 0, position: maxPos + 1 }],
      });
      setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, sales: [...(w.sales || []), row] } : w));
    } catch (e) { setError(e.message); }
  };

  const newWeek = async () => {
    if (!currentWeek) return;
    const lastDate = new Date(currentWeek.start_date);
    lastDate.setDate(lastDate.getDate() + 7);
    const newDate = toIsoDate(lastDate);
    const existing = weeks.find(w => w.start_date === newDate);
    if (existing) return setCurrentWeekId(existing.id);
    await createWeekWithDefaults(newDate);
  };

  const duplicateWeek = async () => {
    if (!currentWeek) return;
    const lastDate = new Date(currentWeek.start_date);
    lastDate.setDate(lastDate.getDate() + 7);
    const newDate = toIsoDate(lastDate);
    const existing = weeks.find(w => w.start_date === newDate);
    if (existing) return setCurrentWeekId(existing.id);
    try {
      const [w] = await sb.db('POST', 'weeks', {
        body: [{ user_id: user.id, start_date: newDate, cesar_cost: 0, sacha_cost: 0 }],
      });
      const sourcesPayload = (currentWeek.lead_sources || []).map(s => ({
        week_id: w.id, category: s.category, source_name: s.source_name, cost: 0, leads: 0, position: s.position,
      }));
      const salesPayload = (currentWeek.sales || []).map(s => ({
        week_id: w.id, category: s.category, client_name: s.client_name, ca: 0, marge: 0, leads: 0, position: s.position,
      }));
      if (sourcesPayload.length) await sb.db('POST', 'lead_sources', { body: sourcesPayload });
      if (salesPayload.length) await sb.db('POST', 'sales', { body: salesPayload });
      await loadWeeks();
      setCurrentWeekId(w.id);
    } catch (e) { setError(e.message); }
  };

  const changeWeekDate = async (weekId, newDate) => {
    const conflict = weeks.find(w => w.id !== weekId && w.start_date === newDate);
    if (conflict) {
      setError('Une semaine existe déjà à cette date.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    await patchWeek(weekId, { start_date: newDate });
    // re-sort
    setWeeks(prev => [...prev].sort((a, b) => b.start_date.localeCompare(a.start_date)));
  };

  const deleteWeek = async (weekId) => {
    if (!confirm('Supprimer cette semaine définitivement ?')) return;
    try {
      await sb.db('DELETE', `weeks?id=eq.${weekId}`);
      const newWeeks = weeks.filter(w => w.id !== weekId);
      setWeeks(newWeeks);
      if (currentWeekId === weekId) {
        if (newWeeks.length > 0) setCurrentWeekId(newWeeks[0].id);
        else { await createWeekWithDefaults(getCurrentMonday()); }
      }
    } catch (e) { setError(e.message); }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(weeks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats-leads-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="text-cyan-400 animate-spin" size={32} />
      </div>
    );
  }

  if (!currentWeek || !calc) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div>Initialisation...</div>
      </div>
    );
  }

  const range = getWeekRange(currentWeek.start_date);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* TOP BAR */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Stats Leads</h1>
              <div className="text-xs text-slate-400 truncate max-w-[200px]">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <TabButton active={activeTab === 'week'} onClick={() => setActiveTab('week')} icon={<Calendar size={15} />}>Semaine</TabButton>
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={15} />}>Historique</TabButton>
            <TabButton active={activeTab === 'monthly'} onClick={() => setActiveTab('monthly')} icon={<CalendarDays size={15} />}>Mensuel</TabButton>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={exportJSON} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 text-sm border border-slate-700">
              <Download size={15} /> Export
            </button>
            <button onClick={() => sb.signOut()} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 text-sm border border-slate-700">
              <LogOut size={15} />
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-rose-900/30 border-t border-rose-800/50 px-4 py-2 text-sm text-rose-300 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
            <button onClick={() => setError('')} className="ml-auto text-xs hover:text-rose-100">×</button>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'week' && (
          <WeekView
            currentWeek={currentWeek} calc={calc} range={range}
            sortedWeekIds={sortedWeekIds} currentIdx={currentIdx} setCurrentWeekId={setCurrentWeekId}
            duplicateWeek={duplicateWeek} newWeek={newWeek}
            changeWeekDate={changeWeekDate}
            patchWeek={patchWeek} updateRow={updateRow} deleteRow={deleteRow}
            addLeadSource={addLeadSource} addSale={addSale}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView weeks={weeks} currentWeekId={currentWeekId} setCurrentWeekId={setCurrentWeekId}
            setActiveTab={setActiveTab} deleteWeek={deleteWeek} />
        )}
        {activeTab === 'monthly' && (
          <MonthlyView weeks={weeks} />
        )}
      </div>

      <div className="text-center text-xs text-slate-500 py-6">
        Données stockées sur Supabase • {weeks.length} semaine{weeks.length > 1 ? 's' : ''} enregistrée{weeks.length > 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ============== TAB BUTTON ==============
function TabButton({ active, onClick, children, icon }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all ${
        active ? 'bg-gradient-to-br from-cyan-600 to-violet-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}>
      {icon}<span className="hidden sm:inline">{children}</span>
    </button>
  );
}

// ============== WEEK VIEW ==============
function WeekView({ currentWeek, calc, range, sortedWeekIds, currentIdx, setCurrentWeekId, duplicateWeek, newWeek, changeWeekDate, patchWeek, updateRow, deleteRow, addLeadSource, addSale }) {
  const [editingDate, setEditingDate] = useState(false);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800/50 to-slate-900 rounded-2xl border border-slate-700/50 p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-400 mb-1 flex items-center gap-2">
              <Calendar size={14} /> Semaine en cours
            </div>
            {editingDate ? (
              <div className="flex items-center gap-2">
                <input type="date" defaultValue={currentWeek.start_date}
                  onBlur={async (e) => { await changeWeekDate(currentWeek.id, e.target.value); setEditingDate(false); }}
                  onKeyDown={async (e) => { if (e.key === 'Enter') { await changeWeekDate(currentWeek.id, e.target.value); setEditingDate(false); } if (e.key === 'Escape') setEditingDate(false); }}
                  autoFocus
                  className="bg-slate-800 border border-cyan-500 rounded-lg px-3 py-1.5 text-slate-100" />
                <button onClick={() => setEditingDate(false)} className="text-xs text-slate-400">Annuler</button>
              </div>
            ) : (
              <h2 className="text-2xl md:text-3xl font-bold cursor-pointer hover:text-cyan-300 transition" onClick={() => setEditingDate(true)} title="Cliquer pour modifier la date de début">
                Du <span className="text-cyan-300">{range.start}</span> au <span className="text-violet-300">{range.end}</span>
              </h2>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => currentIdx < sortedWeekIds.length - 1 && setCurrentWeekId(sortedWeekIds[currentIdx + 1])}
              disabled={currentIdx >= sortedWeekIds.length - 1}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg flex items-center gap-1 text-sm border border-slate-700">
              <ChevronLeft size={16} /> Précédente
            </button>
            <button onClick={() => currentIdx > 0 && setCurrentWeekId(sortedWeekIds[currentIdx - 1])}
              disabled={currentIdx <= 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg flex items-center gap-1 text-sm border border-slate-700">
              Suivante <ChevronRight size={16} />
            </button>
            <button onClick={duplicateWeek} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1 text-sm font-medium shadow-lg shadow-indigo-500/20">
              <Copy size={16} /> Dupliquer
            </button>
            <button onClick={newWeek} className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-lg flex items-center gap-1 text-sm font-medium shadow-lg shadow-cyan-500/20">
              <Plus size={16} /> Nouvelle
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Euro size={18} />} label="CA Total" value={fmtEur(calc.totalCA)} color="cyan" />
        <KPI icon={<Target size={18} />} label="Coût Total" value={fmtEur(calc.totalCost)} color="amber" />
        <KPI icon={calc.totalMarge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge" value={fmtEur(calc.totalMarge)} color={calc.totalMarge >= 0 ? 'emerald' : 'rose'} />
        <KPI icon={<BarChart3 size={18} />} label="Marge %" value={fmtPct(calc.totalMargePct)} color={calc.totalMargePct >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="ITE — Leads" accent="cyan" icon="📥">
          <LeadTable rows={calc.iteLeads}
            onUpdate={(id, patch) => updateRow('lead_sources', id, patch)}
            onDelete={(id) => deleteRow('lead_sources', id, currentWeek.id)}
            onAdd={() => addLeadSource(currentWeek.id, 'ITE')}
            totalCost={calc.iteCost} totalLeads={calc.iteLeadsCount} cm={calc.cmIte} accent="cyan" />
        </Card>
        <Card title="ITE — Ventes" accent="emerald" icon="💰">
          <SalesTableIte rows={calc.iteSales}
            onUpdate={(id, patch) => updateRow('sales', id, patch)}
            onDelete={(id) => deleteRow('sales', id, currentWeek.id)}
            onAdd={() => addSale(currentWeek.id, 'ITE')} />
        </Card>
        <Card title="PV — Leads" accent="orange" icon="☀️">
          <LeadTable rows={calc.pvLeads}
            onUpdate={(id, patch) => updateRow('lead_sources', id, patch)}
            onDelete={(id) => deleteRow('lead_sources', id, currentWeek.id)}
            onAdd={() => addLeadSource(currentWeek.id, 'PV')}
            totalCost={calc.pvCost} totalLeads={calc.pvLeadsCount} cm={calc.cmPv} accent="orange" />
        </Card>
        <Card title="PV — Ventes" accent="emerald" icon="💰">
          <SalesTablePv rows={calc.pvSales}
            onUpdate={(id, patch) => updateRow('sales', id, patch)}
            onDelete={(id) => deleteRow('sales', id, currentWeek.id)}
            onAdd={() => addSale(currentWeek.id, 'PV')} />
        </Card>
      </div>

      <Card title="Coûts annexes" accent="fuchsia" icon="⚙️">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CostInput label="Coût Cesar (€)" value={currentWeek.cesar_cost} onChange={(v) => patchWeek(currentWeek.id, { cesar_cost: v })} />
          <CostInput label="Coût Sacha (€)" value={currentWeek.sacha_cost} onChange={(v) => patchWeek(currentWeek.id, { sacha_cost: v })} />
        </div>
      </Card>

      <div className="bg-gradient-to-br from-violet-950 via-purple-950/80 to-fuchsia-950 rounded-2xl border border-violet-700/40 p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏆</span>
          <h2 className="text-xl font-bold text-violet-100">Marge Globale</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-violet-300 border-b border-violet-800/50">
                <th className="text-left py-2 px-3 font-medium">Tableau</th>
                <th className="text-right py-2 px-3 font-medium">CA Total</th>
                <th className="text-right py-2 px-3 font-medium">Coût Total</th>
                <th className="text-right py-2 px-3 font-medium">Marge (€)</th>
                <th className="text-right py-2 px-3 font-medium">Marge (%)</th>
              </tr>
            </thead>
            <tbody>
              <MargeRow label="ITE" ca={calc.iteCA} cost={calc.iteCost} marge={calc.iteCA - calc.iteCost} pct={calc.iteCost > 0 ? ((calc.iteCA - calc.iteCost) / calc.iteCost) * 100 : 0} />
              <MargeRow label="PV" ca={calc.pvCA} cost={calc.pvCost} marge={calc.pvMarge} pct={calc.pvMargePct} />
              <MargeRow label="CESAR" ca={0} cost={calc.cesarCost} marge={calc.cesarMarge} pct={calc.cesarCost > 0 ? -100 : 0} />
              <MargeRow label="SACHA" ca={0} cost={calc.sachaCost} marge={calc.sachaMarge} pct={calc.sachaCost > 0 ? -100 : 0} />
              <tr className="border-t-2 border-violet-700 font-bold bg-violet-900/40">
                <td className="py-3 px-3 text-violet-100">TOTAL GLOBAL</td>
                <td className="py-3 px-3 text-right text-violet-100">{fmtEur(calc.totalCA)}</td>
                <td className="py-3 px-3 text-right text-violet-100">{fmtEur(calc.totalCost)}</td>
                <td className={`py-3 px-3 text-right ${margeColor(calc.totalMarge)}`}>{fmtEur(calc.totalMarge)}</td>
                <td className={`py-3 px-3 text-right ${margeColor(calc.totalMargePct)}`}>{fmtPct(calc.totalMargePct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============== HISTORY VIEW ==============
function HistoryView({ weeks, currentWeekId, setCurrentWeekId, setActiveTab, deleteWeek }) {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');

  const grouped = useMemo(() => {
    const g = {};
    weeks.forEach(w => {
      const mk = getMonthKey(w.start_date);
      if (!g[mk]) g[mk] = [];
      g[mk].push({ ...w, stats: computeWeekStats(w) });
    });
    return g;
  }, [weeks]);

  const allYears = useMemo(() => [...new Set(Object.keys(grouped).map(k => k.split('-')[0]))].sort((a, b) => b.localeCompare(a)), [grouped]);

  const filteredMonths = useMemo(() =>
    Object.keys(grouped)
      .filter(mk => yearFilter === 'all' || mk.startsWith(yearFilter))
      .filter(mk => {
        if (!search) return true;
        const label = getMonthLabel(mk).toLowerCase();
        if (label.includes(search.toLowerCase())) return true;
        return grouped[mk].some(w => {
          const r = getWeekRange(w.start_date);
          return r.start.includes(search) || r.end.includes(search);
        });
      })
      .sort((a, b) => b.localeCompare(a)),
    [grouped, yearFilter, search]
  );

  const totalStats = useMemo(() => {
    const all = weeks.map(w => computeWeekStats(w));
    return all.reduce((acc, s) => ({
      ca: acc.ca + s.totalCA, cost: acc.cost + s.totalCost, marge: acc.marge + s.totalMarge, leads: acc.leads + s.totalLeads,
    }), { ca: 0, cost: 0, marge: 0, leads: 0 });
  }, [weeks]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
        <h2 className="text-2xl font-bold flex items-center gap-2"><History className="text-cyan-400" /> Historique complet</h2>
        <p className="text-sm text-slate-400 mt-1">{weeks.length} semaine{weeks.length > 1 ? 's' : ''} • {Object.keys(grouped).length} mois</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Euro size={18} />} label="CA cumulé" value={fmtEur(totalStats.ca)} color="cyan" />
        <KPI icon={<Target size={18} />} label="Coût cumulé" value={fmtEur(totalStats.cost)} color="amber" />
        <KPI icon={totalStats.marge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge cumulée" value={fmtEur(totalStats.marge)} color={totalStats.marge >= 0 ? 'emerald' : 'rose'} />
        <KPI icon={<BarChart3 size={18} />} label="Leads totaux" value={totalStats.leads.toLocaleString('fr-FR')} color="violet" />
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Rechercher par mois ou date..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none" />
        </div>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none">
          <option value="all">Toutes les années</option>
          {allYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {filteredMonths.length === 0 && <div className="text-center py-12 text-slate-500">Aucune semaine trouvée</div>}
      {filteredMonths.map(mk => {
        const monthWeeks = grouped[mk];
        const monthStats = monthWeeks.reduce((acc, w) => ({
          ca: acc.ca + w.stats.totalCA, cost: acc.cost + w.stats.totalCost, marge: acc.marge + w.stats.totalMarge, leads: acc.leads + w.stats.totalLeads,
        }), { ca: 0, cost: 0, marge: 0, leads: 0 });
        return (
          <div key={mk} className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-700/50">
              <h3 className="text-lg font-bold text-cyan-300">{getMonthLabel(mk)}</h3>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="text-slate-400">{monthWeeks.length} sem.</span>
                <span><span className="text-slate-500">CA:</span> <span className="text-cyan-300 font-medium">{fmtEur(monthStats.ca)}</span></span>
                <span><span className="text-slate-500">Coût:</span> <span className="text-amber-300 font-medium">{fmtEur(monthStats.cost)}</span></span>
                <span><span className="text-slate-500">Marge:</span> <span className={`font-medium ${margeColor(monthStats.marge)}`}>{fmtEur(monthStats.marge)}</span></span>
              </div>
            </div>
            <div className="divide-y divide-slate-800/70">
              {monthWeeks.map(w => {
                const r = getWeekRange(w.start_date);
                const isActive = w.id === currentWeekId;
                return (
                  <div key={w.id} className={`px-5 py-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-800/40 transition ${isActive ? 'bg-cyan-900/20' : ''}`}>
                    <button onClick={() => { setCurrentWeekId(w.id); setActiveTab('week'); }} className="flex-1 text-left flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-600'}`}></div>
                      <div className="font-medium text-sm">{r.start} → {r.end}</div>
                    </button>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <Pill label="CA" value={fmtEurShort(w.stats.totalCA)} color="cyan" />
                      <Pill label="Coût" value={fmtEurShort(w.stats.totalCost)} color="amber" />
                      <Pill label="Marge" value={fmtEurShort(w.stats.totalMarge)} color={w.stats.totalMarge >= 0 ? 'emerald' : 'rose'} />
                      <Pill label="Leads" value={w.stats.totalLeads} color="violet" />
                      <Pill label="Marge %" value={fmtPct(w.stats.totalMargePct)} color={w.stats.totalMargePct >= 0 ? 'emerald' : 'rose'} />
                      <button onClick={() => deleteWeek(w.id)} className="text-rose-400 hover:text-rose-300 ml-2"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============== MONTHLY VIEW ==============
function MonthlyView({ weeks }) {
  const monthlyData = useMemo(() => {
    const m = {};
    weeks.forEach(w => {
      const mk = getMonthKey(w.start_date);
      if (!m[mk]) m[mk] = { weeks: [], stats: null };
      m[mk].weeks.push(w);
    });
    Object.keys(m).forEach(mk => {
      const stats = m[mk].weeks.map(w => computeWeekStats(w));
      m[mk].stats = stats.reduce((acc, s) => ({
        iteCost: acc.iteCost + s.iteCost, iteLeadsCount: acc.iteLeadsCount + s.iteLeadsCount, iteCA: acc.iteCA + s.iteCA, iteMarge: acc.iteMarge + s.iteMarge,
        pvCost: acc.pvCost + s.pvCost, pvLeadsCount: acc.pvLeadsCount + s.pvLeadsCount, pvCA: acc.pvCA + s.pvCA, pvMarge: acc.pvMarge + s.pvMarge,
        cesarCost: acc.cesarCost + s.cesarCost, sachaCost: acc.sachaCost + s.sachaCost,
        totalCA: acc.totalCA + s.totalCA, totalCost: acc.totalCost + s.totalCost, totalMarge: acc.totalMarge + s.totalMarge, totalLeads: acc.totalLeads + s.totalLeads,
      }), { iteCost: 0, iteLeadsCount: 0, iteCA: 0, iteMarge: 0, pvCost: 0, pvLeadsCount: 0, pvCA: 0, pvMarge: 0, cesarCost: 0, sachaCost: 0, totalCA: 0, totalCost: 0, totalMarge: 0, totalLeads: 0 });
    });
    return m;
  }, [weeks]);

  const sortedMonthKeys = useMemo(() => Object.keys(monthlyData).sort((a, b) => b.localeCompare(a)), [monthlyData]);
  const [selectedMonth, setSelectedMonth] = useState(sortedMonthKeys[0]);

  useEffect(() => {
    if (!sortedMonthKeys.includes(selectedMonth) && sortedMonthKeys.length > 0) setSelectedMonth(sortedMonthKeys[0]);
  }, [sortedMonthKeys, selectedMonth]);

  if (sortedMonthKeys.length === 0) return <div className="text-center py-12 text-slate-500">Aucune donnée</div>;

  const current = monthlyData[selectedMonth];
  const stats = current.stats;
  const cmIte = stats.iteLeadsCount > 0 ? stats.iteCost / stats.iteLeadsCount : 0;
  const cmPv = stats.pvLeadsCount > 0 ? stats.pvCost / stats.pvLeadsCount : 0;
  const margePct = stats.totalCost > 0 ? (stats.totalMarge / stats.totalCost) * 100 : 0;

  const currentIdx = sortedMonthKeys.indexOf(selectedMonth);
  const prevKey = sortedMonthKeys[currentIdx + 1];
  const prev = prevKey ? monthlyData[prevKey].stats : null;
  const variation = (curr, p) => p > 0 ? ((curr - p) / p) * 100 : null;

  const chartData = [...sortedMonthKeys].reverse().map(mk => ({
    label: getMonthLabel(mk).split(' ')[0].slice(0, 3),
    ca: monthlyData[mk].stats.totalCA, cost: monthlyData[mk].stats.totalCost, marge: monthlyData[mk].stats.totalMarge,
    isSelected: mk === selectedMonth,
  }));

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
        <h2 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="text-violet-400" /> Récap mensuel</h2>
        <p className="text-sm text-slate-400 mt-1">{sortedMonthKeys.length} mois enregistré{sortedMonthKeys.length > 1 ? 's' : ''}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {sortedMonthKeys.map(mk => (
          <button key={mk} onClick={() => setSelectedMonth(mk)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mk === selectedMonth ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20'
                                   : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
            }`}>
            {getMonthLabel(mk)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIBig icon={<Euro size={18} />} label="CA Total" value={fmtEur(stats.totalCA)} variation={prev ? variation(stats.totalCA, prev.totalCA) : null} color="cyan" />
        <KPIBig icon={<Target size={18} />} label="Coût Total" value={fmtEur(stats.totalCost)} variation={prev ? variation(stats.totalCost, prev.totalCost) : null} color="amber" inverseColor />
        <KPIBig icon={stats.totalMarge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge" value={fmtEur(stats.totalMarge)} variation={prev ? variation(stats.totalMarge, prev.totalMarge) : null} color={stats.totalMarge >= 0 ? 'emerald' : 'rose'} />
        <KPIBig icon={<BarChart3 size={18} />} label="Leads" value={stats.totalLeads.toLocaleString('fr-FR')} variation={prev ? variation(stats.totalLeads, prev.totalLeads) : null} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="ITE — Synthèse mensuelle" accent="cyan" icon="📥">
          <DetailRow label="Coût total" value={fmtEur(stats.iteCost)} />
          <DetailRow label="Leads" value={stats.iteLeadsCount.toLocaleString('fr-FR')} />
          <DetailRow label="Coût moyen / lead" value={fmtEur(cmIte)} />
          <DetailRow label="CA généré" value={fmtEur(stats.iteCA)} />
          <DetailRow label="Marge" value={fmtEur(stats.iteCA - stats.iteCost)} highlight={stats.iteCA - stats.iteCost} />
        </Card>
        <Card title="PV — Synthèse mensuelle" accent="orange" icon="☀️">
          <DetailRow label="Coût total" value={fmtEur(stats.pvCost)} />
          <DetailRow label="Leads" value={stats.pvLeadsCount.toLocaleString('fr-FR')} />
          <DetailRow label="Coût moyen / lead" value={fmtEur(cmPv)} />
          <DetailRow label="CA généré" value={fmtEur(stats.pvCA)} />
          <DetailRow label="Marge" value={fmtEur(stats.pvCA - stats.pvCost)} highlight={stats.pvCA - stats.pvCost} />
        </Card>
      </div>

      <Card title="Coûts annexes du mois" accent="fuchsia" icon="⚙️">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40 flex justify-between items-center">
            <span className="text-sm text-slate-400">Cesar</span>
            <span className="text-lg font-bold text-rose-300">{fmtEur(stats.cesarCost)}</span>
          </div>
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40 flex justify-between items-center">
            <span className="text-sm text-slate-400">Sacha</span>
            <span className="text-lg font-bold text-rose-300">{fmtEur(stats.sachaCost)}</span>
          </div>
        </div>
      </Card>

      <div className="bg-gradient-to-br from-violet-950 via-purple-950/80 to-fuchsia-950 rounded-2xl border border-violet-700/40 p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏆</span>
          <h3 className="text-xl font-bold text-violet-100">Synthèse — {getMonthLabel(selectedMonth)}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-violet-300 border-b border-violet-800/50">
                <th className="text-left py-2 px-3 font-medium">Tableau</th>
                <th className="text-right py-2 px-3 font-medium">CA Total</th>
                <th className="text-right py-2 px-3 font-medium">Coût Total</th>
                <th className="text-right py-2 px-3 font-medium">Marge (€)</th>
                <th className="text-right py-2 px-3 font-medium">Marge (%)</th>
              </tr>
            </thead>
            <tbody>
              <MargeRow label="ITE" ca={stats.iteCA} cost={stats.iteCost} marge={stats.iteCA - stats.iteCost} pct={stats.iteCost > 0 ? ((stats.iteCA - stats.iteCost) / stats.iteCost) * 100 : 0} />
              <MargeRow label="PV" ca={stats.pvCA} cost={stats.pvCost} marge={stats.pvCA - stats.pvCost} pct={stats.pvCost > 0 ? ((stats.pvCA - stats.pvCost) / stats.pvCost) * 100 : 0} />
              <MargeRow label="CESAR" ca={0} cost={stats.cesarCost} marge={-stats.cesarCost} pct={stats.cesarCost > 0 ? -100 : 0} />
              <MargeRow label="SACHA" ca={0} cost={stats.sachaCost} marge={-stats.sachaCost} pct={stats.sachaCost > 0 ? -100 : 0} />
              <tr className="border-t-2 border-violet-700 font-bold bg-violet-900/40">
                <td className="py-3 px-3 text-violet-100">TOTAL MENSUEL</td>
                <td className="py-3 px-3 text-right text-violet-100">{fmtEur(stats.totalCA)}</td>
                <td className="py-3 px-3 text-right text-violet-100">{fmtEur(stats.totalCost)}</td>
                <td className={`py-3 px-3 text-right ${margeColor(stats.totalMarge)}`}>{fmtEur(stats.totalMarge)}</td>
                <td className={`py-3 px-3 text-right ${margeColor(margePct)}`}>{fmtPct(margePct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {chartData.length >= 2 && (
        <Card title="Évolution mensuelle" accent="indigo" icon="📈">
          <MonthlyBarChart data={chartData} />
        </Card>
      )}
    </div>
  );
}

// ============== UI COMPONENTS ==============
function KPI({ icon, label, value, color }) {
  const colors = {
    cyan: 'from-cyan-900/40 to-cyan-800/10 border-cyan-700/40 text-cyan-300',
    amber: 'from-amber-900/40 to-amber-800/10 border-amber-700/40 text-amber-300',
    emerald: 'from-emerald-900/40 to-emerald-800/10 border-emerald-700/40 text-emerald-300',
    rose: 'from-rose-900/40 to-rose-800/10 border-rose-700/40 text-rose-300',
    violet: 'from-violet-900/40 to-violet-800/10 border-violet-700/40 text-violet-300',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl border p-4 shadow-lg`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80 mb-1">{icon}<span>{label}</span></div>
      <div className="text-xl md:text-2xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

function KPIBig({ icon, label, value, variation, color, inverseColor }) {
  const colors = {
    cyan: 'from-cyan-900/40 to-cyan-800/10 border-cyan-700/40 text-cyan-300',
    amber: 'from-amber-900/40 to-amber-800/10 border-amber-700/40 text-amber-300',
    emerald: 'from-emerald-900/40 to-emerald-800/10 border-emerald-700/40 text-emerald-300',
    rose: 'from-rose-900/40 to-rose-800/10 border-rose-700/40 text-rose-300',
    violet: 'from-violet-900/40 to-violet-800/10 border-violet-700/40 text-violet-300',
  };
  const varColor = variation === null ? 'text-slate-500'
    : (inverseColor ? (variation < 0 ? 'text-emerald-400' : 'text-rose-400')
                    : (variation > 0 ? 'text-emerald-400' : variation < 0 ? 'text-rose-400' : 'text-slate-500'));
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl border p-4 shadow-lg`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80 mb-1">{icon}<span>{label}</span></div>
      <div className="text-xl md:text-2xl font-bold text-slate-100">{value}</div>
      {variation !== null && (
        <div className={`text-xs mt-1 font-medium ${varColor}`}>
          {variation > 0 ? '↑' : variation < 0 ? '↓' : '='} {Math.abs(variation).toFixed(1)}% vs mois précédent
        </div>
      )}
    </div>
  );
}

function Card({ title, accent, icon, children }) {
  const accents = { cyan: 'border-cyan-700/40', orange: 'border-orange-700/40', emerald: 'border-emerald-700/40', fuchsia: 'border-fuchsia-700/40', indigo: 'border-indigo-700/40' };
  const titleColors = { cyan: 'text-cyan-300', orange: 'text-orange-300', emerald: 'text-emerald-300', fuchsia: 'text-fuchsia-300', indigo: 'text-indigo-300' };
  return (
    <div className={`bg-slate-900/50 rounded-2xl border ${accents[accent]} p-4 md:p-5 shadow-xl`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <h2 className={`text-lg font-bold ${titleColors[accent]}`}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CostInput({ label, value, onChange }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40">
      <label className="text-sm text-slate-300 font-medium">{label}</label>
      <input type="number" step="0.01" value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { const n = Number(local) || 0; if (n !== Number(value)) onChange(n); }}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right w-40 focus:border-fuchsia-500 focus:outline-none" />
    </div>
  );
}

function DebouncedInput({ value, onCommit, type = 'text', step, className }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input type={type} step={step} value={local ?? ''}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const newVal = type === 'number' ? (Number(local) || 0) : local;
        if (newVal !== value) onCommit(newVal);
      }}
      className={className} />
  );
}

function LeadTable({ rows, onUpdate, onDelete, onAdd, totalCost, totalLeads, cm, accent }) {
  const accentBg = accent === 'cyan' ? 'bg-cyan-900/30' : 'bg-orange-900/30';
  const sorted = [...rows].sort((a, b) => (a.position || 0) - (b.position || 0));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left py-2 px-2 font-medium">Source</th>
            <th className="text-right py-2 px-2 font-medium w-28">Coût (€)</th>
            <th className="text-right py-2 px-2 font-medium w-20">Leads</th>
            <th className="text-right py-2 px-2 font-medium w-28">Coût/Lead</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => {
            const cpl = r.leads > 0 ? r.cost / r.leads : 0;
            return (
              <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
                <td className="py-1.5 px-2">
                  <DebouncedInput value={r.source_name} onCommit={(v) => onUpdate(r.id, { source_name: v })}
                    className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-slate-600" />
                </td>
                <td className="py-1.5 px-2">
                  <DebouncedInput type="number" step="0.01" value={r.cost} onCommit={(v) => onUpdate(r.id, { cost: v })}
                    className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" />
                </td>
                <td className="py-1.5 px-2">
                  <DebouncedInput type="number" value={r.leads} onCommit={(v) => onUpdate(r.id, { leads: v })}
                    className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" />
                </td>
                <td className="py-1.5 px-2 text-right text-slate-400">{fmtEur(cpl)}</td>
                <td className="py-1.5 px-1">
                  <button onClick={() => onDelete(r.id)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition"><Trash2 size={14} /></button>
                </td>
              </tr>
            );
          })}
          <tr className={`${accentBg} font-semibold`}>
            <td className="py-2 px-2">TOTAL</td>
            <td className="py-2 px-2 text-right">{fmtEur(totalCost)}</td>
            <td className="py-2 px-2 text-right">{totalLeads}</td>
            <td className="py-2 px-2 text-right text-slate-300">—</td>
            <td></td>
          </tr>
          <tr className="text-slate-400 italic text-xs">
            <td className="py-1.5 px-2">CM du lead</td>
            <td colSpan={3} className="py-1.5 px-2 text-right font-medium text-slate-300">{fmtEur(cm)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <button onClick={onAdd} className="mt-2 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><Plus size={12} /> Ajouter une source</button>
    </div>
  );
}

function SalesTableIte({ rows, onUpdate, onDelete, onAdd }) {
  const sorted = [...rows].sort((a, b) => (a.position || 0) - (b.position || 0));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left py-2 px-2 font-medium">Client</th>
            <th className="text-right py-2 px-2 font-medium w-28">CA (€)</th>
            <th className="text-right py-2 px-2 font-medium w-28">Marge (€)</th>
            <th className="text-right py-2 px-2 font-medium w-20">Leads</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
              <td className="py-1.5 px-2"><DebouncedInput value={r.client_name} onCommit={(v) => onUpdate(r.id, { client_name: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-2"><DebouncedInput type="number" step="0.01" value={r.ca} onCommit={(v) => onUpdate(r.id, { ca: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-2"><DebouncedInput type="number" step="0.01" value={r.marge} onCommit={(v) => onUpdate(r.id, { marge: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-2"><DebouncedInput type="number" value={r.leads} onCommit={(v) => onUpdate(r.id, { leads: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-1"><button onClick={() => onDelete(r.id)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition"><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onAdd} className="mt-2 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><Plus size={12} /> Ajouter un client</button>
    </div>
  );
}

function SalesTablePv({ rows, onUpdate, onDelete, onAdd }) {
  const sorted = [...rows].sort((a, b) => (a.position || 0) - (b.position || 0));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left py-2 px-2 font-medium">Client</th>
            <th className="text-right py-2 px-2 font-medium w-28">CA (€)</th>
            <th className="text-right py-2 px-2 font-medium w-20">Leads</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
              <td className="py-1.5 px-2"><DebouncedInput value={r.client_name} onCommit={(v) => onUpdate(r.id, { client_name: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-2"><DebouncedInput type="number" step="0.01" value={r.ca} onCommit={(v) => onUpdate(r.id, { ca: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-2"><DebouncedInput type="number" value={r.leads} onCommit={(v) => onUpdate(r.id, { leads: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-1"><button onClick={() => onDelete(r.id)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition"><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onAdd} className="mt-2 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><Plus size={12} /> Ajouter un client</button>
    </div>
  );
}

function MargeRow({ label, ca, cost, marge, pct }) {
  return (
    <tr className="border-b border-violet-900/30 hover:bg-violet-900/20">
      <td className="py-2 px-3 text-violet-200 font-medium">{label}</td>
      <td className="py-2 px-3 text-right">{fmtEur(ca)}</td>
      <td className="py-2 px-3 text-right">{fmtEur(cost)}</td>
      <td className={`py-2 px-3 text-right font-medium ${margeColor(marge)}`}>{fmtEur(marge)}</td>
      <td className={`py-2 px-3 text-right font-medium ${margeColor(pct)}`}>{fmtPct(pct)}</td>
    </tr>
  );
}

function Pill({ label, value, color }) {
  const colors = {
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-700/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-700/30',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-700/30',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-700/30',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-700/30',
  };
  return (
    <div className={`px-2 py-0.5 rounded-md border text-xs font-medium ${colors[color]}`}>
      <span className="opacity-70 mr-1">{label}</span><span>{value}</span>
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-medium ${highlight !== undefined ? margeColor(highlight) : 'text-slate-100'}`}>{value}</span>
    </div>
  );
}

function MonthlyBarChart({ data }) {
  const w = 700, h = 280, pad = { l: 50, r: 20, t: 20, b: 50 };
  const max = Math.max(...data.map(d => Math.max(d.ca, d.cost, Math.abs(d.marge))));
  const min = Math.min(0, ...data.map(d => d.marge));
  const range = max - min || 1;
  const groupW = (w - pad.l - pad.r) / data.length;
  const barW = Math.min(20, groupW / 4);
  const yScale = (v) => pad.t + ((max - v) / range) * (h - pad.t - pad.b);
  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => min + (range * i) / ticks);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ minWidth: 500 }}>
        {tickValues.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={yScale(v)} y2={yScale(v)} stroke="#334155" strokeDasharray="2,3" />
            <text x={pad.l - 8} y={yScale(v) + 3} fill="#64748b" fontSize="10" textAnchor="end">{fmtEurShort(v)}</text>
          </g>
        ))}
        {min < 0 && <line x1={pad.l} x2={w - pad.r} y1={yScale(0)} y2={yScale(0)} stroke="#475569" strokeWidth="1.5" />}
        {data.map((d, i) => {
          const cx = pad.l + (i + 0.5) * groupW;
          return (
            <g key={i} opacity={d.isSelected ? 1 : 0.5}>
              <rect x={cx - barW * 1.5} y={yScale(Math.max(0, d.ca))} width={barW} height={Math.abs(yScale(d.ca) - yScale(0))} fill="#22d3ee" rx="2" />
              <rect x={cx - barW * 0.5} y={yScale(Math.max(0, d.cost))} width={barW} height={Math.abs(yScale(d.cost) - yScale(0))} fill="#fbbf24" rx="2" />
              <rect x={cx + barW * 0.5} y={d.marge >= 0 ? yScale(d.marge) : yScale(0)} width={barW} height={Math.abs(yScale(d.marge) - yScale(0))} fill={d.marge >= 0 ? '#34d399' : '#f87171'} rx="2" />
              <text x={cx} y={h - pad.b + 16} fill={d.isSelected ? '#cbd5e1' : '#94a3b8'} fontSize="11" textAnchor="middle" fontWeight={d.isSelected ? 'bold' : 'normal'}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-4 justify-center mt-3 text-xs">
        <Legend color="#22d3ee" label="CA" />
        <Legend color="#fbbf24" label="Coût" />
        <Legend color="#34d399" label="Marge +" />
        <Legend color="#f87171" label="Marge −" />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: color }}></div><span className="text-slate-400">{label}</span></div>;
}
