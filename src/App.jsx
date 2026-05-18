import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Plus, Trash2, Copy, Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Euro, Target, BarChart3, History, CalendarDays, Search, LogOut, Loader2, AlertCircle, Key, X, Check, Cloud, CloudOff, FileText, Receipt, Printer } from 'lucide-react';

const SUPABASE_URL = 'https://yxfanlgklvpdpsrzcoqy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SA4vTbf1FfOH2YNHtw3LJg_geqlOxpV';
const CACHE_KEY = 'stats_leads_cache_v3';
const SESSION_KEY = 'stats_leads_session_v2';

const PRODUCTS = [
  { key: 'ITE', label: 'ITE', icon: '📥', color: 'cyan' },
  { key: 'PV', label: 'PV', icon: '☀️', color: 'orange' },
  { key: 'PAC', label: 'PAC', icon: '🔥', color: 'red' },
];

const api = {
  _session: null, _listeners: [], _saveStatus: 'idle', _saveListeners: [],
  init() { try { const raw = localStorage.getItem(SESSION_KEY); if (raw) this._session = JSON.parse(raw); } catch (e) {} },
  getSession() { return this._session; },
  setSession(s) { this._session = s; if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(CACHE_KEY); } this._listeners.forEach(cb => cb(s)); },
  onSessionChange(cb) { this._listeners.push(cb); return () => { this._listeners = this._listeners.filter(x => x !== cb); }; },
  setSaveStatus(s) { this._saveStatus = s; this._saveListeners.forEach(cb => cb(s)); },
  onSaveStatusChange(cb) { this._saveListeners.push(cb); return () => { this._saveListeners = this._saveListeners.filter(x => x !== cb); }; },
  async _rpc(fn, body, { silentSave = false } = {}) {
    if (!silentSave) this.setSaveStatus('saving');
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) {
        if (data.code === 'P0002' || (typeof data.message === 'string' && data.message.includes('Session'))) { this.setSession(null); throw new Error('Session expirée. Reconnexion nécessaire.'); }
        throw new Error(data.message || data.error || 'Erreur serveur');
      }
      if (!silentSave) this.setSaveStatus('saved');
      return data;
    } catch (e) { if (!silentSave) this.setSaveStatus('error'); throw e; }
  },
  async login(username, password) {
    const data = await this._rpc('login_v2', { p_username: username.trim(), p_password: password, p_user_agent: navigator.userAgent.slice(0, 200) }, { silentSave: true });
    if (!data || data.length === 0) throw new Error('Identifiants incorrects');
    const session = { token: data[0].token, user_id: data[0].user_id, username: data[0].username, display_name: data[0].display_name };
    this.setSession(session); return session;
  },
  async logout() { if (this._session?.token) { try { await this._rpc('logout_v2', { p_token: this._session.token }, { silentSave: true }); } catch (e) {} } this.setSession(null); },
  async getWeeks() { return this._rpc('get_my_weeks', { p_token: this._session.token }, { silentSave: true }); },
  async createWeek(startDate, endDate) { return this._rpc('create_week', { p_token: this._session.token, p_start_date: startDate, p_end_date: endDate || null }); },
  async duplicateWeek(srcId, newStart, newEnd) { return this._rpc('duplicate_week', { p_token: this._session.token, p_source_week_id: srcId, p_new_start_date: newStart, p_new_end_date: newEnd || null }); },
  async updateWeek(weekId, patch) { return this._rpc('update_week', { p_token: this._session.token, p_week_id: weekId, p_patch: patch }); },
  async deleteWeek(weekId) { return this._rpc('delete_week', { p_token: this._session.token, p_week_id: weekId }); },
  async addLeadSource(weekId, category, name) { return this._rpc('add_lead_source', { p_token: this._session.token, p_week_id: weekId, p_category: category, p_source_name: name }); },
  async addSale(weekId, category, name) { return this._rpc('add_sale', { p_token: this._session.token, p_week_id: weekId, p_category: category, p_client_name: name }); },
  async updateLeadSource(id, patch) { return this._rpc('update_lead_source', { p_token: this._session.token, p_id: id, p_patch: patch }); },
  async updateSale(id, patch) { return this._rpc('update_sale', { p_token: this._session.token, p_id: id, p_patch: patch }); },
  async deleteLeadSource(id) { return this._rpc('delete_lead_source', { p_token: this._session.token, p_id: id }); },
  async deleteSale(id) { return this._rpc('delete_sale', { p_token: this._session.token, p_id: id }); },
  async changePassword(oldP, newP) { return this._rpc('change_password_v2', { p_token: this._session.token, p_old_password: oldP, p_new_password: newP }, { silentSave: true }); },
};
api.init();

const fmtEur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n || 0);
const fmtEurShort = (n) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k€` : `${(n || 0).toFixed(0)}€`;
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;
const margeColor = (n) => n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-400';
const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const toIsoDate = (d) => typeof d === 'string' ? d : d.toISOString().split('T')[0];
const formatDate = (d) => { const date = new Date(d); return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`; };
const getWeekRange = (w) => {
  // Si w est un objet avec start_date/end_date, on prend les vraies dates ; sinon legacy +7
  if (typeof w === 'object' && w !== null && w.end_date) {
    return { start: formatDate(w.start_date), end: formatDate(w.end_date) };
  }
  const startStr = typeof w === 'object' ? w.start_date : w;
  const start = new Date(startStr);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start: formatDate(start), end: formatDate(end) };
};
const getCurrentMonday = () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)).toISOString().split('T')[0]; };
const addDays = (dateStr, n) => { const d = new Date(dateStr); d.setDate(d.getDate() + n); return toIsoDate(d); };
const getMonthKey = (s) => { const d = new Date(s); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const getMonthLabel = (key) => { const [y, m] = key.split('-'); return `${MOIS_FR[parseInt(m) - 1]} ${y}`; };

const computeProductStats = (w, category) => {
  const sum = (arr, key) => arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  const sumDays = (arr) => arr.reduce((s, x) => s + (Number(x.leads_mon) || 0) + (Number(x.leads_tue) || 0) + (Number(x.leads_wed) || 0) + (Number(x.leads_thu) || 0) + (Number(x.leads_fri) || 0) + (Number(x.leads_sat) || 0) + (Number(x.leads_sun) || 0), 0);
  const rowDays = (x) => (Number(x.leads_mon) || 0) + (Number(x.leads_tue) || 0) + (Number(x.leads_wed) || 0) + (Number(x.leads_thu) || 0) + (Number(x.leads_fri) || 0) + (Number(x.leads_sat) || 0) + (Number(x.leads_sun) || 0);
  const leads = w.lead_sources?.filter(x => x.category === category) || [];
  const sales = w.sales?.filter(x => x.category === category) || [];
  const cost = sum(leads, 'cost');
  const leadsCount = sum(leads, 'leads');
  // CA calculé : pour chaque client, leads journaliers × prix unitaire
  const ca = sales.reduce((s, x) => s + (rowDays(x) * (Number(x.price_per_lead) || 0)), 0);
  const salesLeads = sumDays(sales);
  const marge = ca - cost;
  return {
    leads, sales, cost, leadsCount, ca, salesLeads, marge,
    cm: leadsCount > 0 ? cost / leadsCount : 0,
    margePct: cost > 0 ? (marge / cost) * 100 : 0,
  };
};

const computeWeekStats = (w) => {
  const ite = computeProductStats(w, 'ITE');
  const pv = computeProductStats(w, 'PV');
  const pac = computeProductStats(w, 'PAC');
  // Coûts annexes AUTO :
  // Cesar = 10% du coût total des leads
  // Sacha = 0.50€ × nombre de leads vendus (somme des jours, tous produits)
  const totalLeadsCost = ite.cost + pv.cost + pac.cost;
  const totalSalesLeads = ite.salesLeads + pv.salesLeads + pac.salesLeads;
  const cesarCost = totalLeadsCost * 0.10;
  const sachaCost = totalSalesLeads * 0.50;
  const totalCA = ite.ca + pv.ca + pac.ca;
  const totalCost = ite.cost + pv.cost + pac.cost + cesarCost + sachaCost;
  const totalMarge = totalCA - totalCost;
  return {
    ite, pv, pac, cesarCost, sachaCost,
    cesarMarge: -cesarCost, sachaMarge: -sachaCost,
    totalCA, totalCost, totalMarge,
    totalLeads: ite.leadsCount + pv.leadsCount + pac.leadsCount,
    totalSalesLeads,
    totalLeadsCost,
    totalMargePct: totalCost > 0 ? (totalMarge / totalCost) * 100 : 0,
  };
};

const ToastContext = React.createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = 'info') => { const id = Math.random(); setToasts(t => [...t, { id, msg, type }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000); }, []);
  return (
    <ToastContext.Provider value={show}>{children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-auto ${t.type === 'success' ? 'bg-emerald-600 text-white' : t.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-white'}`}>{t.msg}</div>)}
      </div>
    </ToastContext.Provider>
  );
}
const useToast = () => React.useContext(ToastContext);

function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Confirmer', danger = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        <p className="text-sm text-slate-300 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">Annuler</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`px-4 py-2 rounded-lg text-sm font-medium ${danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-cyan-600 hover:bg-cyan-500'} text-white`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() { return <ToastProvider><AppInner /></ToastProvider>; }

function AppInner() {
  const [session, setSession] = useState(api.getSession());
  useEffect(() => api.onSessionChange(setSession), []);
  if (!session) return <LoginScreen />;
  return <StatsLeads session={session} />;
}

function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => { setError(''); setLoading(true); try { await api.login(username, password); } catch (e) { setError(e.message); } setLoading(false); };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 mb-3"><BarChart3 size={28} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-slate-100">Stats Leads</h1>
          <p className="text-sm text-slate-400 mt-1">Connecte-toi à ton tableau de bord</p>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Prénom</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none" placeholder="greg, sacha, elie..." autoComplete="username" autoCapitalize="none" /></div>
          <div><label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none" placeholder="••••••••" autoComplete="current-password" /></div>
          {error && <div className="bg-rose-900/30 border border-rose-800/50 rounded-lg px-3 py-2 text-sm text-rose-300 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>}
          <button onClick={submit} disabled={loading || !username || !password} className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const toast = useToast();
  const [oldPwd, setOldPwd] = useState(''); const [newPwd, setNewPwd] = useState(''); const [newPwd2, setNewPwd2] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    if (newPwd !== newPwd2) return setError('Les mots de passe ne correspondent pas');
    if (newPwd.length < 6) return setError('Minimum 6 caractères');
    setLoading(true);
    try { await api.changePassword(oldPwd, newPwd); toast('Mot de passe changé !', 'success'); onClose(); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><Key size={18} className="text-cyan-400" /> Changer mon mot de passe</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 mb-1 block">Mot de passe actuel</label><input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Nouveau mot de passe</label><input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Confirmer</label><input type="password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none" /></div>
          {error && <div className="bg-rose-900/30 border border-rose-800/50 rounded-lg px-3 py-2 text-sm text-rose-300">{error}</div>}
          <button onClick={submit} disabled={loading || !oldPwd || !newPwd || !newPwd2} className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 flex items-center justify-center gap-2">{loading && <Loader2 size={16} className="animate-spin" />}Changer</button>
        </div>
      </div>
    </div>
  );
}

function StatsLeads({ session }) {
  const toast = useToast();
  const [weeks, setWeeks] = useState(() => { try { const c = localStorage.getItem(CACHE_KEY); return c ? JSON.parse(c) : []; } catch (e) { return []; } });
  const [currentWeekId, setCurrentWeekId] = useState(null);
  const [activeTab, setActiveTab] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [pdfMode, setPdfMode] = useState(null); // 'week' | 'invoice' | null

  useEffect(() => {
    const u = api.onSaveStatusChange(setSaveStatus);
    const goOnline = () => setOnline(true); const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline); window.addEventListener('offline', goOffline);
    return () => { u(); window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  useEffect(() => { try { if (weeks.length) localStorage.setItem(CACHE_KEY, JSON.stringify(weeks)); } catch (e) {} }, [weeks]);

  const loadWeeks = useCallback(async () => {
    try {
      const data = await api.getWeeks();
      setWeeks(data || []);
      if (data?.length > 0) { if (!currentWeekId || !data.find(w => w.id === currentWeekId)) setCurrentWeekId(data[0].id); }
      else { const w = await api.createWeek(getCurrentMonday()); const fresh = await api.getWeeks(); setWeeks(fresh || []); setCurrentWeekId(w.id); }
    } catch (e) { setError(e.message); toast(e.message, 'error'); }
    setLoading(false);
  }, [currentWeekId, toast]);

  useEffect(() => { loadWeeks(); }, [session.user_id]); // eslint-disable-line

  const currentWeek = useMemo(() => weeks.find(w => w.id === currentWeekId), [weeks, currentWeekId]);
  const calc = useMemo(() => currentWeek ? computeWeekStats(currentWeek) : null, [currentWeek]);
  const sortedWeekIds = useMemo(() => weeks.map(w => w.id), [weeks]);
  const currentIdx = sortedWeekIds.indexOf(currentWeekId);

  const [newWeekModal, setNewWeekModal] = useState(null); // { mode: 'new'|'duplicate', defaultStart, defaultEnd }

  const optimistic = (mutator, serverCall) => {
    setWeeks(mutator);
    serverCall().catch(e => { setError(e.message); toast(e.message, 'error'); loadWeeks(); });
  };
  const patchWeek = (weekId, patch) => optimistic(prev => prev.map(w => w.id === weekId ? { ...w, ...patch } : w), () => api.updateWeek(weekId, patch));
  const updateRow = (table, rowId, patch) => optimistic(prev => prev.map(w => ({ ...w, [table]: w[table]?.map(r => r.id === rowId ? { ...r, ...patch } : r) })), () => table === 'lead_sources' ? api.updateLeadSource(rowId, patch) : api.updateSale(rowId, patch));
  const deleteRow = (table, rowId, weekId) => optimistic(prev => prev.map(w => w.id === weekId ? { ...w, [table]: w[table].filter(r => r.id !== rowId) } : w), () => table === 'lead_sources' ? api.deleteLeadSource(rowId) : api.deleteSale(rowId));
  const addLeadSource = async (weekId, category) => { try { const row = await api.addLeadSource(weekId, category, 'Nouvelle source'); setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, lead_sources: [...(w.lead_sources || []), row] } : w)); } catch (e) { setError(e.message); toast(e.message, 'error'); } };
  const addSaleRow = async (weekId, category) => { try { const row = await api.addSale(weekId, category, 'Nouveau client'); setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, sales: [...(w.sales || []), row] } : w)); } catch (e) { setError(e.message); toast(e.message, 'error'); } };

  const openNewWeekModal = () => {
    if (!currentWeek) return;
    const defaultStart = addDays(currentWeek.start_date, 7);
    const defaultEnd = addDays(defaultStart, 7);
    setNewWeekModal({ mode: 'new', defaultStart, defaultEnd });
  };
  const openDuplicateModal = () => {
    if (!currentWeek) return;
    const defaultStart = addDays(currentWeek.start_date, 7);
    const defaultEnd = addDays(defaultStart, 7);
    setNewWeekModal({ mode: 'duplicate', defaultStart, defaultEnd });
  };

  const confirmNewWeek = async (startDate, endDate) => {
    const existing = weeks.find(w => w.start_date === startDate);
    if (existing) { setCurrentWeekId(existing.id); setNewWeekModal(null); return; }
    try {
      let w;
      if (newWeekModal.mode === 'duplicate') {
        w = await api.duplicateWeek(currentWeek.id, startDate, endDate);
      } else {
        w = await api.createWeek(startDate, endDate);
      }
      const fresh = await api.getWeeks();
      setWeeks(fresh || []);
      setCurrentWeekId(w.id);
      toast(newWeekModal.mode === 'duplicate' ? 'Semaine dupliquée' : 'Nouvelle semaine créée', 'success');
      setNewWeekModal(null);
    } catch (e) { setError(e.message); toast(e.message, 'error'); }
  };

  const changeWeekDate = async (weekId, patch) => {
    try { await api.updateWeek(weekId, patch); const fresh = await api.getWeeks(); setWeeks(fresh || []); toast('Date modifiée', 'success'); } catch (e) { setError(e.message); toast(e.message, 'error'); }
  };
  const deleteWeek = (weekId) => {
    setConfirm({ title: 'Supprimer cette semaine ?', message: 'Cette action est définitive.', danger: true, confirmText: 'Supprimer',
      onConfirm: async () => { try { await api.deleteWeek(weekId); const newWeeks = weeks.filter(w => w.id !== weekId); setWeeks(newWeeks); if (currentWeekId === weekId) { if (newWeeks.length > 0) setCurrentWeekId(newWeeks[0].id); else { const w = await api.createWeek(getCurrentMonday()); const fresh = await api.getWeeks(); setWeeks(fresh || []); setCurrentWeekId(w.id); } } toast('Semaine supprimée', 'success'); } catch (e) { setError(e.message); toast(e.message, 'error'); } }
    });
  };
  const exportJSON = () => { const blob = new Blob([JSON.stringify(weeks, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stats-leads-${session.username}-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url); toast('Export téléchargé', 'success'); };

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openNewWeekModal(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); openDuplicateModal(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); setPdfMode('week'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }); // eslint-disable-line

  if (loading && weeks.length === 0) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="text-cyan-400 animate-spin" size={32} /></div>;
  if (!currentWeek || !calc) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400"><div>Initialisation...</div></div>;
  const range = getWeekRange(currentWeek);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} {...(confirm || {})} />
      {newWeekModal && <NewWeekModal mode={newWeekModal.mode} defaultStart={newWeekModal.defaultStart} defaultEnd={newWeekModal.defaultEnd} onClose={() => setNewWeekModal(null)} onConfirm={confirmNewWeek} />}
      {pdfMode === 'week' && <WeekPdfModal currentWeek={currentWeek} calc={calc} range={range} session={session} onClose={() => setPdfMode(null)} />}
      {pdfMode === 'invoice' && <InvoicePdfModal currentWeek={currentWeek} calc={calc} range={range} session={session} onClose={() => setPdfMode(null)} />}

      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20"><BarChart3 size={20} className="text-white" /></div>
              <div>
                <h1 className="font-bold text-base leading-tight flex items-center gap-2">Stats Leads<SaveBadge status={saveStatus} online={online} /></h1>
                <div className="text-xs text-slate-400">Connecté : <span className="text-cyan-300 font-medium">{session.display_name}</span></div>
              </div>
            </div>
            <div className="md:hidden relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700"><BarChart3 size={16} /></button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[200px] z-30">
                  <button onClick={() => { setPdfMode('week'); setShowMenu(false); }} className="w-full px-4 py-2 text-sm text-left hover:bg-slate-800 flex items-center gap-2"><FileText size={14} /> PDF semaine</button>
                  <button onClick={() => { setPdfMode('invoice'); setShowMenu(false); }} className="w-full px-4 py-2 text-sm text-left hover:bg-slate-800 flex items-center gap-2"><Receipt size={14} /> À facturer</button>
                  <div className="border-t border-slate-800 my-1"></div>
                  <button onClick={() => { exportJSON(); setShowMenu(false); }} className="w-full px-4 py-2 text-sm text-left hover:bg-slate-800 flex items-center gap-2"><Download size={14} /> Export JSON</button>
                  <button onClick={() => { setShowChangePwd(true); setShowMenu(false); }} className="w-full px-4 py-2 text-sm text-left hover:bg-slate-800 flex items-center gap-2"><Key size={14} /> Mot de passe</button>
                  <div className="border-t border-slate-800 my-1"></div>
                  <button onClick={() => api.logout()} className="w-full px-4 py-2 text-sm text-left hover:bg-slate-800 flex items-center gap-2 text-rose-300"><LogOut size={14} /> Déconnexion</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <TabButton active={activeTab === 'week'} onClick={() => setActiveTab('week')} icon={<Calendar size={15} />}>Semaine</TabButton>
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={15} />}>Historique</TabButton>
            <TabButton active={activeTab === 'monthly'} onClick={() => setActiveTab('monthly')} icon={<CalendarDays size={15} />}>Mensuel</TabButton>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => setPdfMode('week')} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg flex items-center gap-1.5 text-sm font-medium" title="PDF Semaine (Ctrl+P)"><FileText size={15} /> PDF</button>
            <button onClick={() => setPdfMode('invoice')} className="px-3 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg flex items-center gap-1.5 text-sm font-medium" title="À facturer"><Receipt size={15} /> Factures</button>
            <button onClick={exportJSON} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 text-sm border border-slate-700"><Download size={15} /></button>
            <button onClick={() => setShowChangePwd(true)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 text-sm border border-slate-700"><Key size={15} /></button>
            <button onClick={() => api.logout()} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 text-sm border border-slate-700"><LogOut size={15} /></button>
          </div>
        </div>
        {error && (<div className="bg-rose-900/30 border-t border-rose-800/50 px-4 py-2 text-sm text-rose-300 flex items-center gap-2"><AlertCircle size={14} /> {error}<button onClick={() => setError('')} className="ml-auto text-xs hover:text-rose-100">×</button></div>)}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'week' && <WeekView currentWeek={currentWeek} calc={calc} range={range} sortedWeekIds={sortedWeekIds} currentIdx={currentIdx} setCurrentWeekId={setCurrentWeekId} duplicateWeek={openDuplicateModal} newWeek={openNewWeekModal} changeWeekDate={changeWeekDate} patchWeek={patchWeek} updateRow={updateRow} deleteRow={deleteRow} addLeadSource={addLeadSource} addSale={addSaleRow} />}
        {activeTab === 'history' && <HistoryView weeks={weeks} currentWeekId={currentWeekId} setCurrentWeekId={setCurrentWeekId} setActiveTab={setActiveTab} deleteWeek={deleteWeek} />}
        {activeTab === 'monthly' && <MonthlyView weeks={weeks} />}
      </div>

      <div className="text-center text-xs text-slate-500 py-6">{weeks.length} semaine{weeks.length > 1 ? 's' : ''} • Sécurisé par token • <span className="hidden md:inline">Ctrl+N (nouvelle), Ctrl+D (dupliquer), Ctrl+P (PDF)</span></div>
    </div>
  );
}

function SaveBadge({ status, online }) {
  if (!online) return <span title="Hors ligne"><CloudOff size={12} className="text-amber-400" /></span>;
  if (status === 'saving') return <span title="Sauvegarde"><Cloud size={12} className="text-cyan-400 animate-pulse" /></span>;
  if (status === 'saved') return <span title="Sauvegardé"><Check size={12} className="text-emerald-400" /></span>;
  if (status === 'error') return <span title="Erreur"><AlertCircle size={12} className="text-rose-400" /></span>;
  return null;
}

function TabButton({ active, onClick, children, icon }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all ${active ? 'bg-gradient-to-br from-cyan-600 to-violet-600 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{icon}<span className="hidden sm:inline">{children}</span></button>;
}

function WeekView({ currentWeek, calc, range, sortedWeekIds, currentIdx, setCurrentWeekId, duplicateWeek, newWeek, changeWeekDate, patchWeek, updateRow, deleteRow, addLeadSource, addSale }) {
  const [editingDate, setEditingDate] = useState(false);
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800/50 to-slate-900 rounded-2xl border border-slate-700/50 p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-400 mb-1 flex items-center gap-2"><Calendar size={14} /> Semaine en cours</div>
            {editingDate ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Du</span>
                  <input type="date" defaultValue={currentWeek.start_date}
                    onBlur={async (e) => { if (e.target.value !== currentWeek.start_date) await changeWeekDate(currentWeek.id, { start_date: e.target.value }); }}
                    className="bg-slate-800 border border-cyan-500 rounded-lg px-3 py-1.5 text-slate-100 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">au</span>
                  <input type="date" defaultValue={currentWeek.end_date || addDays(currentWeek.start_date, 7)}
                    onBlur={async (e) => { if (e.target.value !== currentWeek.end_date) await changeWeekDate(currentWeek.id, { end_date: e.target.value }); }}
                    className="bg-slate-800 border border-violet-500 rounded-lg px-3 py-1.5 text-slate-100 text-sm" />
                </div>
                <button onClick={() => setEditingDate(false)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">OK</button>
              </div>
            ) : (
              <h2 className="text-xl md:text-3xl font-bold cursor-pointer hover:text-cyan-300 transition" onClick={() => setEditingDate(true)} title="Cliquer pour modifier les dates">
                Du <span className="text-cyan-300">{range.start}</span> au <span className="text-violet-300">{range.end}</span>
                <span className="text-xs text-slate-500 ml-2 font-normal">(modifier)</span>
              </h2>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => currentIdx < sortedWeekIds.length - 1 && setCurrentWeekId(sortedWeekIds[currentIdx + 1])} disabled={currentIdx >= sortedWeekIds.length - 1} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg flex items-center gap-1 text-sm border border-slate-700"><ChevronLeft size={16} /> Préc.</button>
            <button onClick={() => currentIdx > 0 && setCurrentWeekId(sortedWeekIds[currentIdx - 1])} disabled={currentIdx <= 0} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg flex items-center gap-1 text-sm border border-slate-700">Suiv. <ChevronRight size={16} /></button>
            <button onClick={duplicateWeek} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1 text-sm font-medium shadow-lg shadow-indigo-500/20"><Copy size={16} /> Dupliquer</button>
            <button onClick={newWeek} className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-lg flex items-center gap-1 text-sm font-medium shadow-lg shadow-cyan-500/20"><Plus size={16} /> Nouvelle</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Euro size={18} />} label="CA Total" value={fmtEur(calc.totalCA)} color="cyan" />
        <KPI icon={<Target size={18} />} label="Coût Total" value={fmtEur(calc.totalCost)} color="amber" />
        <KPI icon={calc.totalMarge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge" value={fmtEur(calc.totalMarge)} color={calc.totalMarge >= 0 ? 'emerald' : 'rose'} />
        <KPI icon={<BarChart3 size={18} />} label="Marge %" value={fmtPct(calc.totalMargePct)} color={calc.totalMargePct >= 0 ? 'emerald' : 'rose'} />
      </div>

      {/* 3 produits : ITE / PV / PAC */}
      {PRODUCTS.map(prod => {
        const stats = calc[prod.key.toLowerCase()];
        return (
          <div key={prod.key} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title={`${prod.label} — Leads`} accent={prod.color} icon={prod.icon}>
              <LeadTable rows={stats.leads} onUpdate={(id, patch) => updateRow('lead_sources', id, patch)} onDelete={(id) => deleteRow('lead_sources', id, currentWeek.id)} onAdd={() => addLeadSource(currentWeek.id, prod.key)} totalCost={stats.cost} totalLeads={stats.leadsCount} cm={stats.cm} accent={prod.color} />
            </Card>
            <Card title={`${prod.label} — Ventes`} accent="emerald" icon="💰">
              <SalesTable rows={stats.sales} onUpdate={(id, patch) => updateRow('sales', id, patch)} onDelete={(id) => deleteRow('sales', id, currentWeek.id)} onAdd={() => addSale(currentWeek.id, prod.key)} totalCA={stats.ca} prodCost={stats.cost} marge={stats.marge} margePct={stats.margePct} />
            </Card>
          </div>
        );
      })}

      <Card title="Coûts annexes (calcul auto)" accent="fuchsia" icon="⚙️">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-slate-300 font-medium">Coût Cesar</span>
              <span className="text-lg font-bold text-fuchsia-300">{fmtEur(calc.cesarCost)}</span>
            </div>
            <div className="text-xs text-slate-500">10% du coût total des leads ({fmtEur(calc.totalLeadsCost)})</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-slate-300 font-medium">Coût Sacha</span>
              <span className="text-lg font-bold text-fuchsia-300">{fmtEur(calc.sachaCost)}</span>
            </div>
            <div className="text-xs text-slate-500">0,50 € × {calc.totalSalesLeads} leads vendus</div>
          </div>
        </div>
      </Card>

      <div className="bg-gradient-to-br from-violet-950 via-purple-950/80 to-fuchsia-950 rounded-2xl border border-violet-700/40 p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4"><span className="text-2xl">🏆</span><h2 className="text-xl font-bold text-violet-100">Marge Globale</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-violet-300 border-b border-violet-800/50"><th className="text-left py-2 px-3 font-medium">Tableau</th><th className="text-right py-2 px-3 font-medium">CA</th><th className="text-right py-2 px-3 font-medium">Coût</th><th className="text-right py-2 px-3 font-medium">Marge</th><th className="text-right py-2 px-3 font-medium">%</th></tr></thead>
            <tbody>
              {PRODUCTS.map(prod => { const s = calc[prod.key.toLowerCase()]; return <MargeRow key={prod.key} label={prod.label} ca={s.ca} cost={s.cost} marge={s.marge} pct={s.margePct} />; })}
              <MargeRow label="CESAR (10%)" ca={0} cost={calc.cesarCost} marge={calc.cesarMarge} pct={calc.cesarCost > 0 ? -100 : 0} />
              <MargeRow label="SACHA (0,50€/lead)" ca={0} cost={calc.sachaCost} marge={calc.sachaMarge} pct={calc.sachaCost > 0 ? -100 : 0} />
              <tr className="border-t-2 border-violet-700 font-bold bg-violet-900/40">
                <td className="py-3 px-3 text-violet-100">TOTAL</td>
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

// ============== NEW WEEK MODAL ==============
function NewWeekModal({ mode, defaultStart, defaultEnd, onClose, onConfirm }) {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [error, setError] = useState('');

  const handleStartChange = (newStart) => {
    setStartDate(newStart);
    // Si la nouvelle date de début est >= date de fin, on ajuste la fin (+7 jours)
    if (newStart >= endDate) setEndDate(addDays(newStart, 7));
  };

  const submit = () => {
    if (!startDate || !endDate) return setError('Les deux dates sont obligatoires');
    if (endDate <= startDate) return setError('La date de fin doit être après la date de début');
    onConfirm(startDate, endDate);
  };

  const duration = startDate && endDate ? Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {mode === 'duplicate' ? <Copy size={18} className="text-indigo-400" /> : <Plus size={18} className="text-cyan-400" />}
            {mode === 'duplicate' ? 'Dupliquer la semaine' : 'Nouvelle semaine'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
        </div>

        {mode === 'duplicate' && (
          <p className="text-sm text-slate-400 mb-4">Les sources et clients de la semaine actuelle seront copiés. Les montants seront remis à zéro.</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Date de début</label>
            <input type="date" value={startDate} onChange={(e) => handleStartChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Date de fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-violet-500 focus:outline-none" />
          </div>

          {duration > 0 && (
            <div className="text-xs text-slate-500 text-center">
              Durée : <span className="text-slate-300 font-medium">{duration} jour{duration > 1 ? 's' : ''}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setStartDate(defaultStart); setEndDate(addDays(defaultStart, 7)); }} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">Reset (+7 jours)</button>
            <button onClick={() => { setStartDate(defaultStart); setEndDate(addDays(defaultStart, 13)); }} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">2 semaines</button>
            <button onClick={() => { const d = new Date(defaultStart); const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0); setEndDate(toIsoDate(lastDay)); }} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">Fin du mois</button>
          </div>

          {error && <div className="bg-rose-900/30 border border-rose-800/50 rounded-lg px-3 py-2 text-sm text-rose-300">{error}</div>}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">Annuler</button>
            <button onClick={submit} className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${mode === 'duplicate' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}>
              {mode === 'duplicate' ? 'Dupliquer' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== PDF MODAL : SEMAINE ==============
function WeekPdfModal({ currentWeek, calc, range, session, onClose }) {
  const handlePrint = () => window.print();
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-auto">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .pdf-page { color: black !important; box-shadow: none !important; margin: 0 !important; padding: 8mm !important; max-width: none !important; min-height: auto !important; page-break-after: avoid; page-break-inside: avoid; }
          .pdf-page * { color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pdf-section { page-break-inside: avoid; }
        }
        @page { size: A4 portrait; margin: 0; }
      `}</style>
      <div className="no-print sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
        <h2 className="font-bold flex items-center gap-2"><FileText size={18} /> Semaine du {range.start}</h2>
        <div className="flex gap-2 items-center">
          <span className="hidden md:inline text-xs text-slate-400">💡 Choisir "Enregistrer en PDF" comme imprimante</span>
          <button onClick={handlePrint} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 text-sm font-medium"><Printer size={16} /> Télécharger PDF</button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">Fermer</button>
        </div>
      </div>
      <div className="pdf-page bg-white text-slate-900 max-w-[210mm] mx-auto my-4 p-6 shadow-2xl" style={{ fontSize: '9px', lineHeight: '1.3' }}>
        <div className="flex justify-between items-end border-b-2 border-slate-800 pb-2 mb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Stats Leads</h1>
            <p className="text-[10px] text-slate-600">Rapport hebdomadaire — {session.display_name}</p>
          </div>
          <div className="text-right">
            <div className="bg-slate-100 px-2 py-1 rounded text-[10px] inline-block">
              <span className="font-bold">Du {range.start} au {range.end}</span>
            </div>
            <div className="text-[8px] text-slate-500 mt-0.5">Édité le {new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3 pdf-section">
          <PdfKPI label="CA" value={fmtEur(calc.totalCA)} color="#0891b2" />
          <PdfKPI label="Coût" value={fmtEur(calc.totalCost)} color="#d97706" />
          <PdfKPI label="Marge" value={fmtEur(calc.totalMarge)} color={calc.totalMarge >= 0 ? '#059669' : '#dc2626'} />
          <PdfKPI label="Marge %" value={fmtPct(calc.totalMargePct)} color={calc.totalMargePct >= 0 ? '#059669' : '#dc2626'} />
        </div>

        {PRODUCTS.map(prod => {
          const s = calc[prod.key.toLowerCase()];
          const hasData = s.leads.length > 0 || s.sales.length > 0;
          if (!hasData) return null;
          return (
            <div key={prod.key} className="mb-2 pdf-section">
              <h2 className="text-[11px] font-bold text-slate-900 border-b border-slate-400 pb-0.5 mb-1">{prod.icon} {prod.label}</h2>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <table className="w-full border border-slate-300" style={{ fontSize: '8px' }}>
                    <thead className="bg-slate-100"><tr><th className="text-left px-1 py-0.5 border-b border-slate-300">Source</th><th className="text-right px-1 py-0.5 border-b border-slate-300">€</th><th className="text-right px-1 py-0.5 border-b border-slate-300">Lds</th><th className="text-right px-1 py-0.5 border-b border-slate-300">€/L</th></tr></thead>
                    <tbody>
                      {[...s.leads].sort((a, b) => a.position - b.position).map(r => (
                        <tr key={r.id} className="border-b border-slate-200">
                          <td className="px-1 py-0.5 truncate max-w-[120px]">{r.source_name}</td>
                          <td className="text-right px-1 py-0.5">{fmtEurShort(r.cost)}</td>
                          <td className="text-right px-1 py-0.5">{r.leads}</td>
                          <td className="text-right px-1 py-0.5">{r.leads > 0 ? fmtEurShort(r.cost / r.leads) : '—'}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold"><td className="px-1 py-0.5">TOTAL</td><td className="text-right px-1 py-0.5">{fmtEurShort(s.cost)}</td><td className="text-right px-1 py-0.5">{s.leadsCount}</td><td className="text-right px-1 py-0.5">{fmtEurShort(s.cm)}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <table className="w-full border border-slate-300" style={{ fontSize: '8px' }}>
                    <thead className="bg-slate-100"><tr><th className="text-left px-1 py-0.5 border-b border-slate-300">Client</th><th className="text-right px-1 py-0.5 border-b border-slate-300">Lds</th><th className="text-right px-1 py-0.5 border-b border-slate-300">€/L</th><th className="text-right px-1 py-0.5 border-b border-slate-300">CA</th></tr></thead>
                    <tbody>
                      {[...s.sales].sort((a, b) => a.position - b.position).map(r => {
                        const totalDays = (Number(r.leads_mon)||0)+(Number(r.leads_tue)||0)+(Number(r.leads_wed)||0)+(Number(r.leads_thu)||0)+(Number(r.leads_fri)||0)+(Number(r.leads_sat)||0)+(Number(r.leads_sun)||0);
                        const ppl = Number(r.price_per_lead) || 0;
                        const rowCA = totalDays * ppl;
                        if (totalDays === 0 && ppl === 0) return null;
                        return <tr key={r.id} className="border-b border-slate-200"><td className="px-1 py-0.5 truncate max-w-[100px]">{r.client_name}</td><td className="text-right px-1 py-0.5">{totalDays}</td><td className="text-right px-1 py-0.5">{ppl > 0 ? fmtEur(ppl) : '—'}</td><td className="text-right px-1 py-0.5 font-medium">{fmtEurShort(rowCA)}</td></tr>;
                      })}
                      <tr className="bg-slate-100 font-bold"><td className="px-1 py-0.5">TOTAL</td><td className="text-right px-1 py-0.5">{s.salesLeads}</td><td className="text-right px-1 py-0.5">—</td><td className="text-right px-1 py-0.5">{fmtEurShort(s.ca)}</td></tr>
                      <tr className={s.marge >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}>
                        <td className="px-1 py-0.5 font-bold">Marge ({fmtPct(s.margePct)})</td>
                        <td colSpan={3} className={`text-right px-1 py-0.5 font-bold ${s.marge >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtEurShort(s.marge)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}

        <div className="grid grid-cols-2 gap-2 mb-2 pdf-section">
          <div className="border border-slate-300 px-2 py-1 rounded flex justify-between items-center text-[9px]"><span className="text-slate-600">Coût Cesar</span><span className="font-bold text-rose-700">{fmtEur(calc.cesarCost)}</span></div>
          <div className="border border-slate-300 px-2 py-1 rounded flex justify-between items-center text-[9px]"><span className="text-slate-600">Coût Sacha</span><span className="font-bold text-rose-700">{fmtEur(calc.sachaCost)}</span></div>
        </div>

        <div className="pdf-section">
          <h2 className="text-[11px] font-bold text-slate-900 border-b border-slate-400 pb-0.5 mb-1">🏆 Synthèse marge globale</h2>
          <table className="w-full border border-slate-300" style={{ fontSize: '9px' }}>
            <thead className="bg-slate-800 text-white"><tr><th className="text-left px-2 py-1">Tableau</th><th className="text-right px-2 py-1">CA</th><th className="text-right px-2 py-1">Coût</th><th className="text-right px-2 py-1">Marge</th><th className="text-right px-2 py-1">%</th></tr></thead>
            <tbody>
              {PRODUCTS.map(prod => { const s = calc[prod.key.toLowerCase()]; return <PdfMargeRow key={prod.key} label={prod.label} ca={s.ca} cost={s.cost} marge={s.marge} pct={s.margePct} />; })}
              <PdfMargeRow label="CESAR" ca={0} cost={calc.cesarCost} marge={calc.cesarMarge} pct={calc.cesarCost > 0 ? -100 : 0} />
              <PdfMargeRow label="SACHA" ca={0} cost={calc.sachaCost} marge={calc.sachaMarge} pct={calc.sachaCost > 0 ? -100 : 0} />
              <tr className="bg-slate-200 font-bold border-t-2 border-slate-800">
                <td className="px-2 py-1">TOTAL</td>
                <td className="text-right px-2 py-1">{fmtEur(calc.totalCA)}</td>
                <td className="text-right px-2 py-1">{fmtEur(calc.totalCost)}</td>
                <td className={`text-right px-2 py-1 ${calc.totalMarge >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtEur(calc.totalMarge)}</td>
                <td className={`text-right px-2 py-1 ${calc.totalMargePct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtPct(calc.totalMargePct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PdfKPI({ label, value, color }) {
  return <div className="border-2 rounded px-2 py-1" style={{ borderColor: color }}>
    <div className="text-[8px] uppercase tracking-wider" style={{ color }}>{label}</div>
    <div className="text-[12px] font-bold" style={{ color }}>{value}</div>
  </div>;
}
function PdfMargeRow({ label, ca, cost, marge, pct }) {
  return <tr className="border-b border-slate-200">
    <td className="px-2 py-1 font-medium">{label}</td>
    <td className="text-right px-2 py-1">{fmtEur(ca)}</td>
    <td className="text-right px-2 py-1">{fmtEur(cost)}</td>
    <td className={`text-right px-2 py-1 font-medium ${marge >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtEur(marge)}</td>
    <td className={`text-right px-2 py-1 font-medium ${pct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtPct(pct)}</td>
  </tr>;
}

// ============== PDF MODAL : À FACTURER ==============
function InvoicePdfModal({ currentWeek, calc, range, session, onClose }) {
  const handlePrint = () => window.print();
  const rowDays = (x) => (Number(x.leads_mon)||0)+(Number(x.leads_tue)||0)+(Number(x.leads_wed)||0)+(Number(x.leads_thu)||0)+(Number(x.leads_fri)||0)+(Number(x.leads_sat)||0)+(Number(x.leads_sun)||0);
  const rowCA = (x) => rowDays(x) * (Number(x.price_per_lead) || 0);
  const allClients = PRODUCTS.flatMap(prod => {
    const stats = calc[prod.key.toLowerCase()];
    return stats.sales.filter(s => rowCA(s) > 0).map(s => ({ ...s, productLabel: prod.label, _ca: rowCA(s), _leads: rowDays(s) }));
  });
  const totalAFacturer = allClients.reduce((sum, c) => sum + c._ca, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-auto">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .pdf-page { color: black !important; box-shadow: none !important; margin: 0 !important; padding: 8mm !important; max-width: none !important; min-height: auto !important; page-break-after: avoid; page-break-inside: avoid; }
          .pdf-page * { color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pdf-section { page-break-inside: avoid; }
        }
        @page { size: A4 portrait; margin: 0; }
      `}</style>
      <div className="no-print sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
        <h2 className="font-bold flex items-center gap-2"><Receipt size={18} /> À facturer — {range.start}</h2>
        <div className="flex gap-2 items-center">
          <span className="hidden md:inline text-xs text-slate-400">💡 Choisir "Enregistrer en PDF"</span>
          <button onClick={handlePrint} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg flex items-center gap-2 text-sm font-medium"><Printer size={16} /> Télécharger PDF</button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">Fermer</button>
        </div>
      </div>
      <div className="pdf-page bg-white text-slate-900 max-w-[210mm] mx-auto my-4 p-6 shadow-2xl" style={{ fontSize: '10px', lineHeight: '1.3' }}>
        <div className="flex justify-between items-end border-b-2 border-amber-600 pb-2 mb-3">
          <div>
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">État à facturer</span>
            <h1 className="text-xl font-bold text-slate-900 mt-1 leading-tight">Récapitulatif de facturation</h1>
            <p className="text-[10px] text-slate-600">Semaine du {range.start} au {range.end}</p>
          </div>
          <div className="text-right text-[9px]">
            <div className="font-bold text-slate-900">{session.display_name}</div>
            <div className="text-slate-500">Édité le {new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        <div className="bg-amber-50 border-2 border-amber-300 rounded p-3 mb-3 pdf-section">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-amber-800 font-bold">Total à réclamer</div>
              <div className="text-2xl font-bold text-amber-900">{fmtEur(totalAFacturer)}</div>
              <div className="text-[9px] text-amber-700">{allClients.length} client{allClients.length > 1 ? 's' : ''} • {calc.totalSalesLeads} leads vendus</div>
            </div>
            <Receipt size={36} className="text-amber-300" />
          </div>
        </div>

        {allClients.length === 0 ? (
          <div className="text-center py-8 text-slate-500 italic text-[10px]">Aucun client à facturer pour cette semaine.</div>
        ) : (
          <>
            {PRODUCTS.map(prod => {
              const stats = calc[prod.key.toLowerCase()];
              const clients = stats.sales.filter(s => Number(s.ca) > 0);
              if (clients.length === 0) return null;
              const productTotal = clients.reduce((sum, c) => sum + Number(c.ca || 0), 0);
              return (
                <div key={prod.key} className="mb-2 pdf-section">
                  <h2 className="text-[11px] font-bold text-slate-900 border-b border-slate-300 pb-0.5 mb-1 flex items-center justify-between">
                    <span>{prod.icon} {prod.label}</span>
                    <span className="text-[10px] font-normal text-slate-600">{fmtEur(productTotal)}</span>
                  </h2>
                  <table className="w-full border border-slate-300" style={{ fontSize: '9px' }}>
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left px-2 py-1 border-b border-slate-300">Client</th>
                        <th className="text-right px-2 py-1 border-b border-slate-300 w-16">Leads</th>
                        <th className="text-right px-2 py-1 border-b border-slate-300 w-24">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...clients].sort((a, b) => a.position - b.position).map(c => (
                        <tr key={c.id} className="border-b border-slate-200">
                          <td className="px-2 py-1 font-medium">{c.client_name}</td>
                          <td className="text-right px-2 py-1">{c.leads}</td>
                          <td className="text-right px-2 py-1 font-bold text-amber-700">{fmtEur(c.ca)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div className="mt-3 pt-2 border-t-2 border-amber-600 pdf-section">
              <table className="w-full">
                <tbody>
                  <tr><td className="text-right px-2 py-0.5 text-slate-600 text-[9px]">Sous-total HT</td><td className="text-right px-2 py-0.5 w-32 font-bold text-[10px]">{fmtEur(totalAFacturer)}</td></tr>
                  <tr className="text-[8px] text-slate-500"><td className="text-right px-2 py-0.5 italic">(TVA non incluse)</td><td></td></tr>
                  <tr className="bg-amber-100 font-bold"><td className="text-right px-2 py-1.5 text-[11px]">TOTAL À FACTURER</td><td className="text-right px-2 py-1.5 text-amber-900 text-[12px]">{fmtEur(totalAFacturer)}</td></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============== HISTORY VIEW ==============
function HistoryView({ weeks, currentWeekId, setCurrentWeekId, setActiveTab, deleteWeek }) {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const grouped = useMemo(() => { const g = {}; weeks.forEach(w => { const mk = getMonthKey(w.start_date); if (!g[mk]) g[mk] = []; g[mk].push({ ...w, stats: computeWeekStats(w) }); }); return g; }, [weeks]);
  const allYears = useMemo(() => [...new Set(Object.keys(grouped).map(k => k.split('-')[0]))].sort((a, b) => b.localeCompare(a)), [grouped]);
  const filteredMonths = useMemo(() => Object.keys(grouped).filter(mk => yearFilter === 'all' || mk.startsWith(yearFilter)).filter(mk => { if (!search) return true; const label = getMonthLabel(mk).toLowerCase(); if (label.includes(search.toLowerCase())) return true; return grouped[mk].some(w => { const r = getWeekRange(w.start_date); return r.start.includes(search) || r.end.includes(search); }); }).sort((a, b) => b.localeCompare(a)), [grouped, yearFilter, search]);
  const totalStats = useMemo(() => { const all = weeks.map(w => computeWeekStats(w)); return all.reduce((acc, s) => ({ ca: acc.ca + s.totalCA, cost: acc.cost + s.totalCost, marge: acc.marge + s.totalMarge, leads: acc.leads + s.totalLeads }), { ca: 0, cost: 0, marge: 0, leads: 0 }); }, [weeks]);
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
        <h2 className="text-2xl font-bold flex items-center gap-2"><History className="text-cyan-400" /> Historique</h2>
        <p className="text-sm text-slate-400 mt-1">{weeks.length} semaine{weeks.length > 1 ? 's' : ''} • {Object.keys(grouped).length} mois</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Euro size={18} />} label="CA cumulé" value={fmtEur(totalStats.ca)} color="cyan" />
        <KPI icon={<Target size={18} />} label="Coût cumulé" value={fmtEur(totalStats.cost)} color="amber" />
        <KPI icon={totalStats.marge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge cumulée" value={fmtEur(totalStats.marge)} color={totalStats.marge >= 0 ? 'emerald' : 'rose'} />
        <KPI icon={<BarChart3 size={18} />} label="Leads totaux" value={totalStats.leads.toLocaleString('fr-FR')} color="violet" />
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none" /></div>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none"><option value="all">Toutes années</option>{allYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
      </div>
      {filteredMonths.length === 0 && <div className="text-center py-12 text-slate-500">Aucune semaine</div>}
      {filteredMonths.map(mk => {
        const monthWeeks = grouped[mk];
        const monthStats = monthWeeks.reduce((acc, w) => ({ ca: acc.ca + w.stats.totalCA, cost: acc.cost + w.stats.totalCost, marge: acc.marge + w.stats.totalMarge, leads: acc.leads + w.stats.totalLeads }), { ca: 0, cost: 0, marge: 0, leads: 0 });
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
                const r = getWeekRange(w);
                const isActive = w.id === currentWeekId;
                return (
                  <div key={w.id} className={`px-5 py-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-800/40 transition ${isActive ? 'bg-cyan-900/20' : ''}`}>
                    <button onClick={() => { setCurrentWeekId(w.id); setActiveTab('week'); }} className="flex-1 text-left flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-600'}`}></div><div className="font-medium text-sm">{r.start} → {r.end}</div></button>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <Pill label="CA" value={fmtEurShort(w.stats.totalCA)} color="cyan" />
                      <Pill label="Coût" value={fmtEurShort(w.stats.totalCost)} color="amber" />
                      <Pill label="Marge" value={fmtEurShort(w.stats.totalMarge)} color={w.stats.totalMarge >= 0 ? 'emerald' : 'rose'} />
                      <Pill label="Leads" value={w.stats.totalLeads} color="violet" />
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
    weeks.forEach(w => { const mk = getMonthKey(w.start_date); if (!m[mk]) m[mk] = { weeks: [], stats: null }; m[mk].weeks.push(w); });
    Object.keys(m).forEach(mk => {
      const allStats = m[mk].weeks.map(w => computeWeekStats(w));
      const empty = { cost: 0, leadsCount: 0, ca: 0, salesLeads: 0, marge: 0 };
      const sumProd = (key) => allStats.reduce((acc, s) => ({ cost: acc.cost + s[key].cost, leadsCount: acc.leadsCount + s[key].leadsCount, ca: acc.ca + s[key].ca, salesLeads: acc.salesLeads + s[key].salesLeads, marge: acc.marge + s[key].marge }), empty);
      m[mk].stats = {
        ite: sumProd('ite'), pv: sumProd('pv'), pac: sumProd('pac'),
        cesarCost: allStats.reduce((s, x) => s + x.cesarCost, 0),
        sachaCost: allStats.reduce((s, x) => s + x.sachaCost, 0),
        totalCA: allStats.reduce((s, x) => s + x.totalCA, 0),
        totalCost: allStats.reduce((s, x) => s + x.totalCost, 0),
        totalMarge: allStats.reduce((s, x) => s + x.totalMarge, 0),
        totalLeads: allStats.reduce((s, x) => s + x.totalLeads, 0),
      };
    });
    return m;
  }, [weeks]);
  const sortedMonthKeys = useMemo(() => Object.keys(monthlyData).sort((a, b) => b.localeCompare(a)), [monthlyData]);
  const [selectedMonth, setSelectedMonth] = useState(sortedMonthKeys[0]);
  useEffect(() => { if (!sortedMonthKeys.includes(selectedMonth) && sortedMonthKeys.length > 0) setSelectedMonth(sortedMonthKeys[0]); }, [sortedMonthKeys, selectedMonth]);
  if (sortedMonthKeys.length === 0) return <div className="text-center py-12 text-slate-500">Aucune donnée</div>;
  const stats = monthlyData[selectedMonth].stats;
  const margePct = stats.totalCost > 0 ? (stats.totalMarge / stats.totalCost) * 100 : 0;
  const currentIdx = sortedMonthKeys.indexOf(selectedMonth);
  const prev = sortedMonthKeys[currentIdx + 1] ? monthlyData[sortedMonthKeys[currentIdx + 1]].stats : null;
  const variation = (curr, p) => p > 0 ? ((curr - p) / p) * 100 : null;
  const chartData = [...sortedMonthKeys].reverse().map(mk => ({ label: getMonthLabel(mk).split(' ')[0].slice(0, 3), ca: monthlyData[mk].stats.totalCA, cost: monthlyData[mk].stats.totalCost, marge: monthlyData[mk].stats.totalMarge, isSelected: mk === selectedMonth }));

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
        <h2 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="text-violet-400" /> Récap mensuel</h2>
        <p className="text-sm text-slate-400 mt-1">{sortedMonthKeys.length} mois enregistré{sortedMonthKeys.length > 1 ? 's' : ''}</p>
      </div>
      <div className="flex flex-wrap gap-2">{sortedMonthKeys.map(mk => <button key={mk} onClick={() => setSelectedMonth(mk)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mk === selectedMonth ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'}`}>{getMonthLabel(mk)}</button>)}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIBig icon={<Euro size={18} />} label="CA Total" value={fmtEur(stats.totalCA)} variation={prev ? variation(stats.totalCA, prev.totalCA) : null} color="cyan" />
        <KPIBig icon={<Target size={18} />} label="Coût Total" value={fmtEur(stats.totalCost)} variation={prev ? variation(stats.totalCost, prev.totalCost) : null} color="amber" inverseColor />
        <KPIBig icon={stats.totalMarge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge" value={fmtEur(stats.totalMarge)} variation={prev ? variation(stats.totalMarge, prev.totalMarge) : null} color={stats.totalMarge >= 0 ? 'emerald' : 'rose'} />
        <KPIBig icon={<BarChart3 size={18} />} label="Leads" value={stats.totalLeads.toLocaleString('fr-FR')} variation={prev ? variation(stats.totalLeads, prev.totalLeads) : null} color="violet" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {PRODUCTS.map(prod => {
          const s = stats[prod.key.toLowerCase()];
          const cm = s.leadsCount > 0 ? s.cost / s.leadsCount : 0;
          return <Card key={prod.key} title={`${prod.label} — Synthèse`} accent={prod.color} icon={prod.icon}>
            <DetailRow label="Coût total" value={fmtEur(s.cost)} />
            <DetailRow label="Leads" value={s.leadsCount.toLocaleString('fr-FR')} />
            <DetailRow label="Coût moyen / lead" value={fmtEur(cm)} />
            <DetailRow label="CA généré" value={fmtEur(s.ca)} />
            <DetailRow label="Marge" value={fmtEur(s.marge)} highlight={s.marge} />
          </Card>;
        })}
      </div>
      <Card title="Coûts annexes" accent="fuchsia" icon="⚙️">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40 flex justify-between items-center"><span className="text-sm text-slate-400">Cesar</span><span className="text-lg font-bold text-rose-300">{fmtEur(stats.cesarCost)}</span></div>
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40 flex justify-between items-center"><span className="text-sm text-slate-400">Sacha</span><span className="text-lg font-bold text-rose-300">{fmtEur(stats.sachaCost)}</span></div>
        </div>
      </Card>
      <div className="bg-gradient-to-br from-violet-950 via-purple-950/80 to-fuchsia-950 rounded-2xl border border-violet-700/40 p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4"><span className="text-2xl">🏆</span><h3 className="text-xl font-bold text-violet-100">Synthèse — {getMonthLabel(selectedMonth)}</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-violet-300 border-b border-violet-800/50"><th className="text-left py-2 px-3 font-medium">Tableau</th><th className="text-right py-2 px-3 font-medium">CA</th><th className="text-right py-2 px-3 font-medium">Coût</th><th className="text-right py-2 px-3 font-medium">Marge</th><th className="text-right py-2 px-3 font-medium">%</th></tr></thead>
            <tbody>
              {PRODUCTS.map(prod => { const s = stats[prod.key.toLowerCase()]; return <MargeRow key={prod.key} label={prod.label} ca={s.ca} cost={s.cost} marge={s.marge} pct={s.cost > 0 ? (s.marge / s.cost) * 100 : 0} />; })}
              <MargeRow label="CESAR" ca={0} cost={stats.cesarCost} marge={-stats.cesarCost} pct={stats.cesarCost > 0 ? -100 : 0} />
              <MargeRow label="SACHA" ca={0} cost={stats.sachaCost} marge={-stats.sachaCost} pct={stats.sachaCost > 0 ? -100 : 0} />
              <tr className="border-t-2 border-violet-700 font-bold bg-violet-900/40"><td className="py-3 px-3 text-violet-100">TOTAL</td><td className="py-3 px-3 text-right text-violet-100">{fmtEur(stats.totalCA)}</td><td className="py-3 px-3 text-right text-violet-100">{fmtEur(stats.totalCost)}</td><td className={`py-3 px-3 text-right ${margeColor(stats.totalMarge)}`}>{fmtEur(stats.totalMarge)}</td><td className={`py-3 px-3 text-right ${margeColor(margePct)}`}>{fmtPct(margePct)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      {chartData.length >= 2 && <Card title="Évolution mensuelle" accent="indigo" icon="📈"><MonthlyBarChart data={chartData} /></Card>}
    </div>
  );
}

// ============== UI COMPONENTS ==============
function KPI({ icon, label, value, color }) {
  const colors = { cyan: 'from-cyan-900/40 to-cyan-800/10 border-cyan-700/40 text-cyan-300', amber: 'from-amber-900/40 to-amber-800/10 border-amber-700/40 text-amber-300', emerald: 'from-emerald-900/40 to-emerald-800/10 border-emerald-700/40 text-emerald-300', rose: 'from-rose-900/40 to-rose-800/10 border-rose-700/40 text-rose-300', violet: 'from-violet-900/40 to-violet-800/10 border-violet-700/40 text-violet-300', red: 'from-red-900/40 to-red-800/10 border-red-700/40 text-red-300', orange: 'from-orange-900/40 to-orange-800/10 border-orange-700/40 text-orange-300' };
  return <div className={`bg-gradient-to-br ${colors[color]} rounded-xl border p-4 shadow-lg`}><div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80 mb-1">{icon}<span>{label}</span></div><div className="text-xl md:text-2xl font-bold text-slate-100">{value}</div></div>;
}
function KPIBig({ icon, label, value, variation, color, inverseColor }) {
  const colors = { cyan: 'from-cyan-900/40 to-cyan-800/10 border-cyan-700/40 text-cyan-300', amber: 'from-amber-900/40 to-amber-800/10 border-amber-700/40 text-amber-300', emerald: 'from-emerald-900/40 to-emerald-800/10 border-emerald-700/40 text-emerald-300', rose: 'from-rose-900/40 to-rose-800/10 border-rose-700/40 text-rose-300', violet: 'from-violet-900/40 to-violet-800/10 border-violet-700/40 text-violet-300' };
  const varColor = variation === null ? 'text-slate-500' : (inverseColor ? (variation < 0 ? 'text-emerald-400' : 'text-rose-400') : (variation > 0 ? 'text-emerald-400' : variation < 0 ? 'text-rose-400' : 'text-slate-500'));
  return <div className={`bg-gradient-to-br ${colors[color]} rounded-xl border p-4 shadow-lg`}><div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80 mb-1">{icon}<span>{label}</span></div><div className="text-xl md:text-2xl font-bold text-slate-100">{value}</div>{variation !== null && <div className={`text-xs mt-1 font-medium ${varColor}`}>{variation > 0 ? '↑' : variation < 0 ? '↓' : '='} {Math.abs(variation).toFixed(1)}%</div>}</div>;
}
function Card({ title, accent, icon, children }) {
  const accents = { cyan: 'border-cyan-700/40', orange: 'border-orange-700/40', emerald: 'border-emerald-700/40', fuchsia: 'border-fuchsia-700/40', indigo: 'border-indigo-700/40', red: 'border-red-700/40' };
  const titleColors = { cyan: 'text-cyan-300', orange: 'text-orange-300', emerald: 'text-emerald-300', fuchsia: 'text-fuchsia-300', indigo: 'text-indigo-300', red: 'text-red-300' };
  return <div className={`bg-slate-900/50 rounded-2xl border ${accents[accent]} p-4 md:p-5 shadow-xl`}><div className="flex items-center gap-2 mb-4"><span className="text-xl">{icon}</span><h2 className={`text-lg font-bold ${titleColors[accent]}`}>{title}</h2></div>{children}</div>;
}
function CostInput({ label, value, onChange }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40"><label className="text-sm text-slate-300 font-medium">{label}</label><input type="number" step="0.01" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => { const n = Number(local) || 0; if (n !== Number(value)) onChange(n); }} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right w-40 focus:border-fuchsia-500 focus:outline-none" /></div>;
}
function DebouncedInput({ value, onCommit, type = 'text', step, className }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return <input type={type} step={step} value={local ?? ''} onChange={(e) => setLocal(e.target.value)} onBlur={() => { const newVal = type === 'number' ? (Number(local) || 0) : local; if (newVal !== value) onCommit(newVal); }} className={className} />;
}

function LeadTable({ rows, onUpdate, onDelete, onAdd, totalCost, totalLeads, cm, accent }) {
  const accentBg = { cyan: 'bg-cyan-900/30', orange: 'bg-orange-900/30', red: 'bg-red-900/30' }[accent] || 'bg-slate-800';
  const sorted = [...rows].sort((a, b) => (a.position || 0) - (b.position || 0));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-slate-400 border-b border-slate-700"><th className="text-left py-2 px-2 font-medium">Source</th><th className="text-right py-2 px-2 font-medium w-24">Coût</th><th className="text-right py-2 px-2 font-medium w-16">Leads</th><th className="text-right py-2 px-2 font-medium w-24">€/Lead</th><th className="w-8"></th></tr></thead>
        <tbody>
          {sorted.map(r => {
            const cpl = r.leads > 0 ? r.cost / r.leads : 0;
            return <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
              <td className="py-1.5 px-2"><DebouncedInput value={r.source_name} onCommit={(v) => onUpdate(r.id, { source_name: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-2"><DebouncedInput type="number" step="0.01" value={r.cost} onCommit={(v) => onUpdate(r.id, { cost: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-2"><DebouncedInput type="number" value={r.leads} onCommit={(v) => onUpdate(r.id, { leads: v })} className="w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-slate-600" /></td>
              <td className="py-1.5 px-2 text-right text-slate-400">{fmtEur(cpl)}</td>
              <td className="py-1.5 px-1"><button onClick={() => onDelete(r.id)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300"><Trash2 size={14} /></button></td>
            </tr>;
          })}
          <tr className={`${accentBg} font-semibold`}><td className="py-2 px-2">TOTAL</td><td className="py-2 px-2 text-right">{fmtEur(totalCost)}</td><td className="py-2 px-2 text-right">{totalLeads}</td><td className="py-2 px-2 text-right text-slate-300">—</td><td></td></tr>
          <tr className="text-slate-400 italic text-xs"><td className="py-1.5 px-2">CM du lead</td><td colSpan={3} className="py-1.5 px-2 text-right font-medium text-slate-300">{fmtEur(cm)}</td><td></td></tr>
        </tbody>
      </table>
      <button onClick={onAdd} className="mt-2 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><Plus size={12} /> Ajouter une source</button>
    </div>
  );
}

function SalesTable({ rows, onUpdate, onDelete, onAdd, totalCA, prodCost, marge, margePct }) {
  const sorted = [...rows].sort((a, b) => (a.position || 0) - (b.position || 0));
  const DAYS = [
    { key: 'leads_mon', label: 'L' },
    { key: 'leads_tue', label: 'M' },
    { key: 'leads_wed', label: 'M' },
    { key: 'leads_thu', label: 'J' },
    { key: 'leads_fri', label: 'V' },
    { key: 'leads_sat', label: 'S' },
    { key: 'leads_sun', label: 'D' },
  ];
  const sumDay = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const rowTotal = (r) => DAYS.reduce((s, d) => s + (Number(r[d.key]) || 0), 0);
  const grandTotalLeads = rows.reduce((s, r) => s + rowTotal(r), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-300 border-b border-slate-600">
            <th className="text-left py-2 px-1 font-medium">Client</th>
            {DAYS.map((d, i) => <th key={i} className="text-center py-2 px-1 font-semibold w-7 text-cyan-400" title={['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'][i]}>{d.label}</th>)}
            <th className="text-right py-2 px-1 font-semibold w-12 text-slate-200">Tot.</th>
            <th className="text-right py-2 px-1 font-medium w-16 text-amber-300">€/Lead</th>
            <th className="text-right py-2 px-1 font-medium w-20">CA</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => {
            const total = rowTotal(r);
            const ppl = Number(r.price_per_lead) || 0;
            const computedCA = total * ppl;
            return <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
              <td className="py-1 px-1"><DebouncedInput value={r.client_name} onCommit={(v) => onUpdate(r.id, { client_name: v })} className="w-full bg-transparent text-slate-100 focus:bg-slate-800 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-slate-600" /></td>
              {DAYS.map((d, i) => (
                <td key={i} className="py-1 px-0.5">
                  <DebouncedInput type="number" value={r[d.key]} onCommit={(v) => onUpdate(r.id, { [d.key]: v })} className="w-full bg-transparent text-slate-100 focus:bg-slate-800 px-0.5 py-0.5 rounded outline-none text-center focus:ring-1 focus:ring-slate-600" />
                </td>
              ))}
              <td className={`py-1 px-1 text-right font-bold bg-slate-800/50 ${total > 0 ? 'text-cyan-300' : 'text-slate-500'}`}>{total}</td>
              <td className="py-1 px-1">
                <DebouncedInput type="number" step="0.01" value={r.price_per_lead || 0} onCommit={(v) => onUpdate(r.id, { price_per_lead: v, ca: rowTotal(r) * v })}
                  className={`w-full bg-transparent focus:bg-slate-800 px-1 py-0.5 rounded outline-none text-right focus:ring-1 focus:ring-amber-600 ${ppl > 0 ? 'text-amber-300 font-medium' : 'text-slate-500'}`} />
              </td>
              <td className={`py-1 px-1 text-right font-medium ${computedCA > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>{fmtEur(computedCA)}</td>
              <td className="py-1 px-0"><button onClick={() => onDelete(r.id)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300"><Trash2 size={12} /></button></td>
            </tr>;
          })}
          <tr className="bg-emerald-900/40 font-bold border-t border-emerald-700/40">
            <td className="py-2 px-1 text-emerald-200">TOTAL</td>
            {DAYS.map((d, i) => {
              const v = sumDay(d.key);
              return <td key={i} className={`text-center py-2 px-1 ${v > 0 ? 'text-emerald-200' : 'text-slate-500'}`}>{v}</td>;
            })}
            <td className={`py-2 px-1 text-right bg-emerald-800/40 ${grandTotalLeads > 0 ? 'text-emerald-100' : 'text-slate-400'}`}>{grandTotalLeads}</td>
            <td className="py-2 px-1"></td>
            <td className="py-2 px-1 text-right text-emerald-100">{fmtEur(totalCA)}</td>
            <td></td>
          </tr>
          <tr className={`${marge >= 0 ? 'bg-emerald-900/50' : 'bg-rose-900/40'} font-bold border-t-2 border-slate-600`}>
            <td colSpan={DAYS.length + 2} className="py-2 px-1 text-xs uppercase tracking-wide text-slate-200">Marge auto ({fmtPct(margePct)})</td>
            <td className={`py-2 px-1 text-right ${marge >= 0 ? 'text-emerald-300' : 'text-rose-300'}`} colSpan={2}>{fmtEur(marge)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <button onClick={onAdd} className="mt-2 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><Plus size={12} /> Ajouter un client</button>
    </div>
  );
}

function MargeRow({ label, ca, cost, marge, pct }) {
  return <tr className="border-b border-violet-900/30 hover:bg-violet-900/20"><td className="py-2 px-3 text-violet-200 font-medium">{label}</td><td className="py-2 px-3 text-right">{fmtEur(ca)}</td><td className="py-2 px-3 text-right">{fmtEur(cost)}</td><td className={`py-2 px-3 text-right font-medium ${margeColor(marge)}`}>{fmtEur(marge)}</td><td className={`py-2 px-3 text-right font-medium ${margeColor(pct)}`}>{fmtPct(pct)}</td></tr>;
}
function Pill({ label, value, color }) {
  const colors = { cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-700/30', amber: 'bg-amber-500/10 text-amber-300 border-amber-700/30', emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-700/30', rose: 'bg-rose-500/10 text-rose-300 border-rose-700/30', violet: 'bg-violet-500/10 text-violet-300 border-violet-700/30' };
  return <div className={`px-2 py-0.5 rounded-md border text-xs font-medium ${colors[color]}`}><span className="opacity-70 mr-1">{label}</span><span>{value}</span></div>;
}
function DetailRow({ label, value, highlight }) {
  return <div className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0"><span className="text-sm text-slate-400">{label}</span><span className={`font-medium ${highlight !== undefined ? margeColor(highlight) : 'text-slate-100'}`}>{value}</span></div>;
}
function MonthlyBarChart({ data }) {
  const w = 700, h = 280, pad = { l: 50, r: 20, t: 20, b: 50 };
  const max = Math.max(...data.map(d => Math.max(d.ca, d.cost, Math.abs(d.marge))));
  const min = Math.min(0, ...data.map(d => d.marge));
  const range = max - min || 1;
  const groupW = (w - pad.l - pad.r) / data.length;
  const barW = Math.min(20, groupW / 4);
  const yScale = (v) => pad.t + ((max - v) / range) * (h - pad.t - pad.b);
  const tickValues = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ minWidth: 500 }}>
        {tickValues.map((v, i) => <g key={i}><line x1={pad.l} x2={w - pad.r} y1={yScale(v)} y2={yScale(v)} stroke="#334155" strokeDasharray="2,3" /><text x={pad.l - 8} y={yScale(v) + 3} fill="#64748b" fontSize="10" textAnchor="end">{fmtEurShort(v)}</text></g>)}
        {min < 0 && <line x1={pad.l} x2={w - pad.r} y1={yScale(0)} y2={yScale(0)} stroke="#475569" strokeWidth="1.5" />}
        {data.map((d, i) => {
          const cx = pad.l + (i + 0.5) * groupW;
          return <g key={i} opacity={d.isSelected ? 1 : 0.5}>
            <rect x={cx - barW * 1.5} y={yScale(Math.max(0, d.ca))} width={barW} height={Math.abs(yScale(d.ca) - yScale(0))} fill="#22d3ee" rx="2" />
            <rect x={cx - barW * 0.5} y={yScale(Math.max(0, d.cost))} width={barW} height={Math.abs(yScale(d.cost) - yScale(0))} fill="#fbbf24" rx="2" />
            <rect x={cx + barW * 0.5} y={d.marge >= 0 ? yScale(d.marge) : yScale(0)} width={barW} height={Math.abs(yScale(d.marge) - yScale(0))} fill={d.marge >= 0 ? '#34d399' : '#f87171'} rx="2" />
            <text x={cx} y={h - pad.b + 16} fill={d.isSelected ? '#cbd5e1' : '#94a3b8'} fontSize="11" textAnchor="middle" fontWeight={d.isSelected ? 'bold' : 'normal'}>{d.label}</text>
          </g>;
        })}
      </svg>
      <div className="flex flex-wrap gap-4 justify-center mt-3 text-xs"><Legend color="#22d3ee" label="CA" /><Legend color="#fbbf24" label="Coût" /><Legend color="#34d399" label="Marge +" /><Legend color="#f87171" label="Marge −" /></div>
    </div>
  );
}
function Legend({ color, label }) {
  return <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: color }}></div><span className="text-slate-400">{label}</span></div>;
}
