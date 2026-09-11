import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Plus, Trash2, Copy, Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Euro, Target, BarChart3, History, CalendarDays, Search, LogOut, Loader2, AlertCircle, Key, X, Check, Cloud, CloudOff, FileText, Receipt, Printer, Menu, RefreshCw, Settings, AlertTriangle, FileSpreadsheet, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

// ============== CONFIG ==============
const SUPABASE_URL = 'https://yxfanlgklvpdpsrzcoqy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SA4vTbf1FfOH2YNHtw3LJg_geqlOxpV';
const APP_VERSION = '3.0';
const CACHE_KEY = 'stats_leads_cache_v3';
const SESSION_KEY = 'stats_leads_session_v2';

const PRODUCTS = [
  { key: 'ITE', label: 'ITE', icon: '📥', color: 'cyan' },
  { key: 'PV', label: 'PV', icon: '☀️', color: 'orange' },
  { key: 'PAC', label: 'PAC', icon: '🔥', color: 'red' },
];
const DAYS = [
  { key: 'leads_mon', label: 'Lun', full: 'Lundi' },
  { key: 'leads_tue', label: 'Mar', full: 'Mardi' },
  { key: 'leads_wed', label: 'Mer', full: 'Mercredi' },
  { key: 'leads_thu', label: 'Jeu', full: 'Jeudi' },
  { key: 'leads_fri', label: 'Ven', full: 'Vendredi' },
  { key: 'leads_sat', label: 'Sam', full: 'Samedi' },
  { key: 'leads_sun', label: 'Dim', full: 'Dimanche' },
];

// ============== API ==============
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
  t() { return this._session?.token; },
  async login(username, password) {
    const data = await this._rpc('login_v2', { p_username: username.trim(), p_password: password, p_user_agent: navigator.userAgent.slice(0, 200) }, { silentSave: true });
    if (!data || data.length === 0) throw new Error('Identifiants incorrects');
    const session = { token: data[0].token, user_id: data[0].user_id, username: data[0].username, display_name: data[0].display_name };
    this.setSession(session); return session;
  },
  async logout() { if (this.t()) { try { await this._rpc('logout_v2', { p_token: this.t() }, { silentSave: true }); } catch (e) {} } this.setSession(null); },
  async getWeeks() { return this._rpc('get_my_weeks', { p_token: this.t() }, { silentSave: true }); },
  async createWeek(s, e) { return this._rpc('create_week', { p_token: this.t(), p_start_date: s, p_end_date: e || null }); },
  async duplicateWeek(src, s, e) { return this._rpc('duplicate_week', { p_token: this.t(), p_source_week_id: src, p_new_start_date: s, p_new_end_date: e || null }); },
  async updateWeek(id, patch) { return this._rpc('update_week', { p_token: this.t(), p_week_id: id, p_patch: patch }); },
  async deleteWeek(id) { return this._rpc('delete_week', { p_token: this.t(), p_week_id: id }); },
  async addLeadSource(w, c, n) { return this._rpc('add_lead_source', { p_token: this.t(), p_week_id: w, p_category: c, p_source_name: n }); },
  async addSale(w, c, n) { return this._rpc('add_sale', { p_token: this.t(), p_week_id: w, p_category: c, p_client_name: n }); },
  async updateLeadSource(id, patch) { return this._rpc('update_lead_source', { p_token: this.t(), p_id: id, p_patch: patch }); },
  async updateSale(id, patch) { return this._rpc('update_sale', { p_token: this.t(), p_id: id, p_patch: patch }); },
  async deleteLeadSource(id) { return this._rpc('delete_lead_source', { p_token: this.t(), p_id: id }); },
  async deleteSale(id) { return this._rpc('delete_sale', { p_token: this.t(), p_id: id }); },
  async changePassword(o, n) { return this._rpc('change_password_v2', { p_token: this.t(), p_old_password: o, p_new_password: n }, { silentSave: true }); },
  async getDefaults() { return this._rpc('get_defaults', { p_token: this.t() }, { silentSave: true }); },
  async saveDefaultClient(c) { return this._rpc('save_default_client', { p_token: this.t(), p_id: c.id || null, p_category: c.category, p_client_name: c.client_name, p_price: Number(c.price_per_lead) || 0, p_active: c.active !== false }); },
  async deleteDefaultClient(id) { return this._rpc('delete_default_client', { p_token: this.t(), p_id: id }); },
  async saveDefaultSource(s) { return this._rpc('save_default_source', { p_token: this.t(), p_id: s.id || null, p_category: s.category, p_source_name: s.source_name, p_active: s.active !== false }); },
  async deleteDefaultSource(id) { return this._rpc('delete_default_source', { p_token: this.t(), p_id: id }); },
};
api.init();

// ============== HELPERS ==============
const fmtEur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n || 0);
const fmtEurShort = (n) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k€` : `${(n || 0).toFixed(0)}€`;
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;
const margeColor = (n) => n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-400';
const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toIsoDate = (d) => typeof d === 'string' ? d : localIso(d);
const parseDate = (s) => new Date(s + 'T00:00:00');
const formatDate = (s) => { const d = parseDate(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return localIso(d); };
const weekEnd = (w) => w.end_date || addDays(w.start_date, 7);
const getWeekRange = (w) => ({ start: formatDate(w.start_date), end: formatDate(weekEnd(w)) });
const getCurrentMonday = () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); return localIso(d); };
const getMonthKey = (s) => s.slice(0, 7);
const getMonthLabel = (key) => { const [y, m] = key.split('-'); return `${MOIS_FR[parseInt(m) - 1]} ${y}`; };
const rowDays = (x) => DAYS.reduce((s, d) => s + (Number(x[d.key]) || 0), 0);
const rowCA = (x) => rowDays(x) * (Number(x.price_per_lead) || 0);
const downloadFile = (name, content, type) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };
const csvLine = (arr) => arr.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';');
const num = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');

const computeProductStats = (w, category) => {
  const sum = (arr, key) => arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  const leads = w.lead_sources?.filter(x => x.category === category) || [];
  const sales = w.sales?.filter(x => x.category === category) || [];
  const cost = sum(leads, 'cost');
  const leadsCount = sum(leads, 'leads');
  const ca = sales.reduce((s, x) => s + rowCA(x), 0);
  const salesLeads = sales.reduce((s, x) => s + rowDays(x), 0);
  const marge = ca - cost;
  return { leads, sales, cost, leadsCount, ca, salesLeads, marge, cm: leadsCount > 0 ? cost / leadsCount : 0, margePct: cost > 0 ? (marge / cost) * 100 : 0 };
};

const computeWeekStats = (w) => {
  const ite = computeProductStats(w, 'ITE'), pv = computeProductStats(w, 'PV'), pac = computeProductStats(w, 'PAC');
  const totalLeadsCost = ite.cost + pv.cost + pac.cost;
  const totalSalesLeads = ite.salesLeads + pv.salesLeads + pac.salesLeads;
  const cesarCost = totalLeadsCost * 0.10;   // 10 % du coût total des leads
  const sachaCost = totalSalesLeads * 0.50;  // 0,50 € par lead vendu
  const totalCA = ite.ca + pv.ca + pac.ca;
  const totalCost = totalLeadsCost + cesarCost + sachaCost;
  const totalMarge = totalCA - totalCost;
  return { ite, pv, pac, cesarCost, sachaCost, cesarMarge: -cesarCost, sachaMarge: -sachaCost, totalCA, totalCost, totalMarge, totalLeads: ite.leadsCount + pv.leadsCount + pac.leadsCount, totalSalesLeads, totalLeadsCost, totalMargePct: totalCost > 0 ? (totalMarge / totalCost) * 100 : 0 };
};

// ============== TOAST ==============
const ToastContext = React.createContext(() => {});
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = 'info') => { const id = Math.random(); setToasts(t => [...t, { id, msg, type }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000); }, []);
  return (
    <ToastContext.Provider value={show}>{children}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
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

// ============== APP ==============
export default function App() { return <ToastProvider><AppInner /></ToastProvider>; }
function AppInner() {
  const [session, setSession] = useState(api.getSession());
  useEffect(() => api.onSessionChange(setSession), []);
  if (!session) return <LoginScreen />;
  return <StatsLeads session={session} />;
}

// ============== LOGIN ==============
function LoginScreen() {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async () => { setError(''); setLoading(true); try { await api.login(username, password); } catch (e) { setError(e.message); } setLoading(false); };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 mb-3"><BarChart3 size={28} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-slate-100">Stats Leads</h1>
          <p className="text-sm text-slate-400 mt-1">Connecte-toi à ton tableau de bord</p>
          <p className="text-[10px] text-slate-600 mt-1">v{APP_VERSION}</p>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Prénom</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none" placeholder="greg, sacha, elie..." autoComplete="username" autoCapitalize="none" /></div>
          <div><label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:border-cyan-500 focus:outline-none" placeholder="••••••••" autoComplete="current-password" /></div>
          {error && <div className="bg-rose-900/30 border border-rose-800/50 rounded-lg px-3 py-2 text-sm text-rose-300 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>}
          <button onClick={submit} disabled={loading || !username || !password} className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">{loading && <Loader2 size={16} className="animate-spin" />}Se connecter</button>
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
    try { await api.changePassword(oldPwd, newPwd); toast('Mot de passe changé !', 'success'); onClose(); } catch (e) { setError(e.message); }
    setLoading(false);
  };
  const inp = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none";
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><Key size={18} className="text-cyan-400" /> Changer mon mot de passe</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={18} /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 mb-1 block">Mot de passe actuel</label><input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} className={inp} /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Nouveau mot de passe</label><input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className={inp} /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Confirmer</label><input type="password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className={inp} /></div>
          {error && <div className="bg-rose-900/30 border border-rose-800/50 rounded-lg px-3 py-2 text-sm text-rose-300">{error}</div>}
          <button onClick={submit} disabled={loading || !oldPwd || !newPwd || !newPwd2} className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 flex items-center justify-center gap-2">{loading && <Loader2 size={16} className="animate-spin" />}Changer</button>
        </div>
      </div>
    </div>
  );
}

// ============== MAIN ==============
function StatsLeads({ session }) {
  const toast = useToast();
  const canWrite = (session.username || '').toLowerCase() === 'sacha';
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
  const [pdfMode, setPdfMode] = useState(null);
  const [newWeekModal, setNewWeekModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    const u = api.onSaveStatusChange(setSaveStatus);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { u(); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => { try { if (weeks.length) localStorage.setItem(CACHE_KEY, JSON.stringify(weeks)); } catch (e) {} }, [weeks]);
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(''), 8000); return () => clearTimeout(t); }, [error]);

  const loadWeeks = useCallback(async () => {
    try {
      const data = await api.getWeeks();
      setWeeks(data || []); setLastSync(new Date());
      if (data?.length > 0) { if (!currentWeekId || !data.find(w => w.id === currentWeekId)) setCurrentWeekId(data[0].id); }
      else if (canWrite) { const w = await api.createWeek(getCurrentMonday()); const fresh = await api.getWeeks(); setWeeks(fresh || []); setCurrentWeekId(w.id); }
    } catch (e) { setError(e.message); toast(e.message, 'error'); }
    setLoading(false);
  }, [currentWeekId, toast, canWrite]);
  useEffect(() => { loadWeeks(); }, [session.user_id]); // eslint-disable-line

  const refresh = useCallback(async (silent = false) => {
    if (refreshing) return;
    setRefreshing(true);
    try { const data = await api.getWeeks(); setWeeks(data || []); setLastSync(new Date()); if (!silent) toast('Données actualisées', 'success'); }
    catch (e) { if (!silent) toast(e.message, 'error'); }
    setRefreshing(false);
  }, [refreshing, toast]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(true); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = !canWrite ? setInterval(() => { if (document.visibilityState === 'visible') refresh(true); }, 60000) : null;
    return () => { document.removeEventListener('visibilitychange', onVisible); if (interval) clearInterval(interval); };
  }, [refresh, canWrite]);

  const currentWeek = useMemo(() => weeks.find(w => w.id === currentWeekId), [weeks, currentWeekId]);
  const calc = useMemo(() => currentWeek ? computeWeekStats(currentWeek) : null, [currentWeek]);
  const sortedWeekIds = useMemo(() => weeks.map(w => w.id), [weeks]);
  const currentIdx = sortedWeekIds.indexOf(currentWeekId);
  const prevWeek = currentIdx >= 0 ? weeks[currentIdx + 1] : null; // liste triée du plus récent au plus ancien
  const prevCalc = useMemo(() => prevWeek ? computeWeekStats(prevWeek) : null, [prevWeek]);

  const optimistic = (mutator, serverCall) => { if (!canWrite) return; setWeeks(mutator); serverCall().catch(e => { setError(e.message); toast(e.message, 'error'); loadWeeks(); }); };
  const patchWeek = (id, patch) => optimistic(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w), () => api.updateWeek(id, patch));
  const updateRow = (table, rowId, patch) => optimistic(prev => prev.map(w => ({ ...w, [table]: w[table]?.map(r => r.id === rowId ? { ...r, ...patch } : r) })), () => table === 'lead_sources' ? api.updateLeadSource(rowId, patch) : api.updateSale(rowId, patch));
  const deleteRow = (table, rowId, weekId) => {
    if (!canWrite) return;
    const row = weeks.find(w => w.id === weekId)?.[table]?.find(r => r.id === rowId);
    setConfirm({ title: `Supprimer « ${row?.client_name || row?.source_name || 'cette ligne'} » ?`, message: table === 'sales' ? 'Les leads saisis pour ce client cette semaine seront perdus.' : 'Le coût saisi pour cette source cette semaine sera perdu.', danger: true, confirmText: 'Supprimer',
      onConfirm: () => optimistic(prev => prev.map(w => w.id === weekId ? { ...w, [table]: w[table].filter(r => r.id !== rowId) } : w), () => table === 'lead_sources' ? api.deleteLeadSource(rowId) : api.deleteSale(rowId)) });
  };
  const addLeadSource = async (weekId, category) => { if (!canWrite) return; try { const row = await api.addLeadSource(weekId, category, 'Nouvelle source'); setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, lead_sources: [...(w.lead_sources || []), row] } : w)); } catch (e) { setError(e.message); toast(e.message, 'error'); } };
  const addSaleRow = async (weekId, category) => { if (!canWrite) return; try { const row = await api.addSale(weekId, category, 'Nouveau client'); setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, sales: [...(w.sales || []), row] } : w)); } catch (e) { setError(e.message); toast(e.message, 'error'); } };
  const openNewWeekModal = () => { if (!canWrite || !currentWeek) return; const s = addDays(currentWeek.start_date, 7); setNewWeekModal({ mode: 'new', defaultStart: s, defaultEnd: addDays(s, 7) }); };
  const openDuplicateModal = () => { if (!canWrite || !currentWeek) return; const s = addDays(currentWeek.start_date, 7); setNewWeekModal({ mode: 'duplicate', defaultStart: s, defaultEnd: addDays(s, 7) }); };
  const confirmNewWeek = async (startDate, endDate) => {
    const existing = weeks.find(w => w.start_date === startDate);
    if (existing) { setCurrentWeekId(existing.id); setNewWeekModal(null); return; }
    try {
      const w = newWeekModal.mode === 'duplicate' ? await api.duplicateWeek(currentWeek.id, startDate, endDate) : await api.createWeek(startDate, endDate);
      const fresh = await api.getWeeks(); setWeeks(fresh || []); setCurrentWeekId(w.id);
      toast(newWeekModal.mode === 'duplicate' ? 'Semaine dupliquée' : 'Nouvelle semaine créée', 'success'); setNewWeekModal(null);
    } catch (e) { setError(e.message); toast(e.message, 'error'); }
  };
  const changeWeekDate = async (id, patch) => { if (!canWrite) return; try { await api.updateWeek(id, patch); const fresh = await api.getWeeks(); setWeeks(fresh || []); toast('Date modifiée', 'success'); } catch (e) { setError(e.message); toast(e.message, 'error'); } };
  const deleteWeek = (id) => {
    if (!canWrite) return;
    setConfirm({ title: 'Supprimer cette semaine ?', message: 'Cette action est définitive.', danger: true, confirmText: 'Supprimer',
      onConfirm: async () => { try { await api.deleteWeek(id); const nw = weeks.filter(w => w.id !== id); setWeeks(nw); if (currentWeekId === id) { if (nw.length > 0) setCurrentWeekId(nw[0].id); else { const w = await api.createWeek(getCurrentMonday()); const fresh = await api.getWeeks(); setWeeks(fresh || []); setCurrentWeekId(w.id); } } toast('Semaine supprimée', 'success'); } catch (e) { setError(e.message); toast(e.message, 'error'); } } });
  };
  const exportJSON = () => { downloadFile(`stats-leads-${session.username}-${toIsoDate(new Date())}.json`, JSON.stringify(weeks, null, 2), 'application/json'); toast('Export JSON téléchargé', 'success'); };
  const exportWeekCSV = () => {
    if (!currentWeek) return;
    const r = getWeekRange(currentWeek);
    const lines = [csvLine(['Semaine', r.start, r.end]), '', csvLine(['Type', 'Produit', 'Nom', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim', 'Leads', 'Prix/lead', 'CA', 'Coût'])];
    PRODUCTS.forEach(p => {
      const s = calc[p.key.toLowerCase()];
      s.sales.forEach(c => lines.push(csvLine(['Vente', p.label, c.client_name, ...DAYS.map(d => Number(c[d.key]) || 0), rowDays(c), num(c.price_per_lead), num(rowCA(c)), ''])));
      s.leads.forEach(l => lines.push(csvLine(['Source', p.label, l.source_name, '', '', '', '', '', '', '', l.leads, '', '', num(l.cost)])));
    });
    lines.push('', csvLine(['Totaux', '', '', '', '', '', '', '', '', '', calc.totalSalesLeads, '', num(calc.totalCA), num(calc.totalCost)]), csvLine(['Cesar (10%)', '', '', '', '', '', '', '', '', '', '', '', '', num(calc.cesarCost)]), csvLine(['Sacha (0,50€/lead)', '', '', '', '', '', '', '', '', '', '', '', '', num(calc.sachaCost)]), csvLine(['Marge', '', '', '', '', '', '', '', '', '', '', '', num(calc.totalMarge), '']));
    downloadFile(`semaine-${currentWeek.start_date}.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
    toast('CSV de la semaine téléchargé', 'success');
  };

  useEffect(() => {
    const h = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'n') { e.preventDefault(); openNewWeekModal(); }
      if (e.key === 'd') { e.preventDefault(); openDuplicateModal(); }
      if (e.key === 'p') { e.preventDefault(); setPdfMode('week'); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }); // eslint-disable-line

  if (loading && weeks.length === 0) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="text-cyan-400 animate-spin" size={32} /></div>;
  if (!currentWeek || !calc) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4 p-6 text-center">
      <div>{canWrite ? 'Initialisation...' : 'Aucune donnée disponible pour le moment.'}</div>
      {!canWrite && <button onClick={() => api.logout()} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm border border-slate-700 flex items-center gap-2"><LogOut size={15} /> Déconnexion</button>}
    </div>
  );
  const range = getWeekRange(currentWeek);
  const TABS = [
    { key: 'week', label: 'Semaine', icon: <Calendar size={15} /> },
    { key: 'stats', label: 'Stats', icon: <BarChart3 size={15} /> },
    { key: 'history', label: 'Historique', icon: <History size={15} /> },
    { key: 'monthly', label: 'Mensuel', icon: <CalendarDays size={15} /> },
    ...(canWrite ? [{ key: 'settings', label: 'Réglages', icon: <Settings size={15} /> }] : []),
  ];

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
                <div className="text-xs text-slate-400">Connecté : <span className="text-cyan-300 font-medium">{session.display_name}</span>{!canWrite && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-900/40 border border-amber-700/40 text-amber-300 text-[10px] uppercase tracking-wide">Lecture seule</span>}</div>
              </div>
            </div>
            <div className="md:hidden relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700" aria-label="Menu"><Menu size={16} /></button>
              {showMenu && (<>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[210px] z-30">
                  <MenuItem icon={<RefreshCw size={14} />} onClick={() => { refresh(); setShowMenu(false); }}>Actualiser</MenuItem>
                  <div className="border-t border-slate-800 my-1"></div>
                  <MenuItem icon={<FileText size={14} />} onClick={() => { setPdfMode('week'); setShowMenu(false); }}>PDF semaine</MenuItem>
                  <MenuItem icon={<Receipt size={14} />} onClick={() => { setPdfMode('invoice'); setShowMenu(false); }}>À facturer</MenuItem>
                  <MenuItem icon={<FileSpreadsheet size={14} />} onClick={() => { exportWeekCSV(); setShowMenu(false); }}>CSV semaine</MenuItem>
                  <div className="border-t border-slate-800 my-1"></div>
                  <MenuItem icon={<Download size={14} />} onClick={() => { exportJSON(); setShowMenu(false); }}>Export JSON</MenuItem>
                  <MenuItem icon={<Key size={14} />} onClick={() => { setShowChangePwd(true); setShowMenu(false); }}>Mot de passe</MenuItem>
                  <div className="border-t border-slate-800 my-1"></div>
                  <MenuItem icon={<LogOut size={14} />} onClick={() => api.logout()} danger>Déconnexion</MenuItem>
                </div>
              </>)}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {TABS.map(t => <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} icon={t.icon}>{t.label}</TabButton>)}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <IconBtn onClick={() => refresh()} disabled={refreshing} title={lastSync ? `Dernière maj ${lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Actualiser'}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></IconBtn>
            <button onClick={() => setPdfMode('week')} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg flex items-center gap-1.5 text-sm font-medium" title="PDF Semaine (Ctrl+P)"><FileText size={15} /> PDF</button>
            <button onClick={() => setPdfMode('invoice')} className="px-3 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg flex items-center gap-1.5 text-sm font-medium" title="À facturer"><Receipt size={15} /> Factures</button>
            <IconBtn onClick={exportWeekCSV} title="Export CSV de la semaine"><FileSpreadsheet size={15} /></IconBtn>
            <IconBtn onClick={exportJSON} title="Export JSON (sauvegarde)"><Download size={15} /></IconBtn>
            <IconBtn onClick={() => setShowChangePwd(true)} title="Mot de passe"><Key size={15} /></IconBtn>
            <IconBtn onClick={() => api.logout()} title="Déconnexion"><LogOut size={15} /></IconBtn>
          </div>
        </div>
        {error && <div className="bg-rose-900/30 border-t border-rose-800/50 px-4 py-2 text-sm text-rose-300 flex items-center gap-2"><AlertCircle size={14} /> {error}<button onClick={() => setError('')} className="ml-auto text-xs hover:text-rose-100">×</button></div>}
      </div>

      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6 pb-24 md:pb-6">
        {activeTab === 'week' && <WeekView canWrite={canWrite} currentWeek={currentWeek} calc={calc} prevCalc={prevCalc} prevWeek={prevWeek} range={range} sortedWeekIds={sortedWeekIds} currentIdx={currentIdx} setCurrentWeekId={setCurrentWeekId} duplicateWeek={openDuplicateModal} newWeek={openNewWeekModal} changeWeekDate={changeWeekDate} patchWeek={patchWeek} updateRow={updateRow} deleteRow={deleteRow} addLeadSource={addLeadSource} addSale={addSaleRow} />}
        {activeTab === 'stats' && <StatsView weeks={weeks} setCurrentWeekId={setCurrentWeekId} setActiveTab={setActiveTab} />}
        {activeTab === 'history' && <HistoryView canWrite={canWrite} weeks={weeks} currentWeekId={currentWeekId} setCurrentWeekId={setCurrentWeekId} setActiveTab={setActiveTab} deleteWeek={deleteWeek} />}
        {activeTab === 'monthly' && <MonthlyView weeks={weeks} />}
        {activeTab === 'settings' && canWrite && <SettingsView />}
      </div>

      <div className="text-center text-xs text-slate-500 py-6 pb-24 md:pb-6">v{APP_VERSION} • {weeks.length} semaine{weeks.length > 1 ? 's' : ''}{lastSync && <> • maj {lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>} • <span className="hidden md:inline">Ctrl+N nouvelle, Ctrl+D dupliquer, Ctrl+P PDF</span></div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className={`grid ${TABS.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {TABS.map(t => { const active = activeTab === t.key; return (
            <button key={t.key} onClick={() => { setActiveTab(t.key); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition ${active ? 'text-cyan-300' : 'text-slate-500'}`}>
              <span className={`p-1.5 rounded-xl transition ${active ? 'bg-gradient-to-br from-cyan-600/40 to-violet-600/40' : ''}`}>{React.cloneElement(t.icon, { size: 20 })}</span>{t.label}
            </button>); })}
        </div>
      </nav>
    </div>
  );
}

function MenuItem({ icon, onClick, children, danger }) { return <button onClick={onClick} className={`w-full px-4 py-2 text-sm text-left hover:bg-slate-800 flex items-center gap-2 ${danger ? 'text-rose-300' : ''}`}>{icon} {children}</button>; }
function IconBtn({ onClick, title, disabled, children }) { return <button onClick={onClick} disabled={disabled} title={title} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 text-sm border border-slate-700">{children}</button>; }
function SaveBadge({ status, online }) {
  if (!online) return <span title="Hors ligne"><CloudOff size={12} className="text-amber-400" /></span>;
  if (status === 'saving') return <span title="Sauvegarde"><Cloud size={12} className="text-cyan-400 animate-pulse" /></span>;
  if (status === 'saved') return <span title="Sauvegardé"><Check size={12} className="text-emerald-400" /></span>;
  if (status === 'error') return <span title="Erreur"><AlertCircle size={12} className="text-rose-400" /></span>;
  return null;
}
function TabButton({ active, onClick, children, icon }) { return <button onClick={onClick} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all ${active ? 'bg-gradient-to-br from-cyan-600 to-violet-600 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{icon}<span>{children}</span></button>; }

// ============== WEEK VIEW ==============
function WeekView({ canWrite, currentWeek, calc, prevCalc, prevWeek, range, sortedWeekIds, currentIdx, setCurrentWeekId, duplicateWeek, newWeek, changeWeekDate, patchWeek, updateRow, deleteRow, addLeadSource, addSale }) {
  const [editingDate, setEditingDate] = useState(false);
  const [mobileProduct, setMobileProduct] = useState(null);
  const endIso = weekEnd(currentWeek);
  const todayIso = localIso(new Date());
  const weekHasToday = todayIso >= currentWeek.start_date && todayIso <= endIso;
  const todayIdx = useMemo(() => { if (!weekHasToday) return -1; const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }, [weekHasToday]);
  const dayDates = useMemo(() => {
    const start = parseDate(currentWeek.start_date); const dow = start.getDay();
    const monday = new Date(start); monday.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); const iso = localIso(d); return (iso >= currentWeek.start_date && iso <= endIso) ? String(d.getDate()).padStart(2, '0') : null; });
  }, [currentWeek.start_date, endIso]);

  // Alertes : jours passés sans aucune saisie, marge négative
  const missingDays = useMemo(() => {
    if (!weekHasToday) return [];
    const allSales = currentWeek.sales || [];
    return DAYS.map((d, i) => ({ ...d, i })).filter(d => d.i < todayIdx && dayDates[d.i] !== null && allSales.reduce((s, x) => s + (Number(x[d.key]) || 0), 0) === 0);
  }, [currentWeek.sales, todayIdx, dayDates, weekHasToday]);

  const delta = (cur, prev) => prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800/50 to-slate-900 rounded-2xl border border-slate-700/50 p-4 md:p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-400 mb-1 flex items-center gap-2"><Calendar size={14} /> Semaine {weekHasToday && <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 text-[10px] normal-case tracking-normal">en cours</span>}</div>
            {editingDate && canWrite ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2"><span className="text-sm text-slate-400">Du</span><input type="date" defaultValue={currentWeek.start_date} onBlur={async (e) => { if (e.target.value !== currentWeek.start_date) await changeWeekDate(currentWeek.id, { start_date: e.target.value }); }} className="bg-slate-800 border border-cyan-500 rounded-lg px-3 py-1.5 text-slate-100 text-sm" /></div>
                <div className="flex items-center gap-2"><span className="text-sm text-slate-400">au</span><input type="date" defaultValue={endIso} onBlur={async (e) => { if (e.target.value !== currentWeek.end_date) await changeWeekDate(currentWeek.id, { end_date: e.target.value }); }} className="bg-slate-800 border border-violet-500 rounded-lg px-3 py-1.5 text-slate-100 text-sm" /></div>
                <button onClick={() => setEditingDate(false)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">OK</button>
              </div>
            ) : (
              <h2 className={`text-xl md:text-3xl font-bold transition ${canWrite ? 'cursor-pointer hover:text-cyan-300' : ''}`} onClick={() => canWrite && setEditingDate(true)} title={canWrite ? 'Cliquer pour modifier les dates' : ''}>
                Du <span className="text-cyan-300">{range.start}</span> au <span className="text-violet-300">{range.end}</span>{canWrite && <span className="text-xs text-slate-500 ml-2 font-normal">(modifier)</span>}
              </h2>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => currentIdx < sortedWeekIds.length - 1 && setCurrentWeekId(sortedWeekIds[currentIdx + 1])} disabled={currentIdx >= sortedWeekIds.length - 1} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg flex items-center gap-1 text-sm border border-slate-700"><ChevronLeft size={16} /><span className="hidden sm:inline">Préc.</span></button>
            <button onClick={() => currentIdx > 0 && setCurrentWeekId(sortedWeekIds[currentIdx - 1])} disabled={currentIdx <= 0} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg flex items-center gap-1 text-sm border border-slate-700"><span className="hidden sm:inline">Suiv.</span><ChevronRight size={16} /></button>
            {canWrite && <>
              <button onClick={duplicateWeek} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1 text-sm font-medium shadow-lg shadow-indigo-500/20"><Copy size={16} /> Dupliquer</button>
              <button onClick={newWeek} className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-lg flex items-center gap-1 text-sm font-medium shadow-lg shadow-cyan-500/20"><Plus size={16} /> Nouvelle</button>
            </>}
          </div>
        </div>
      </div>

      {(missingDays.length > 0 || calc.totalMarge < 0) && (
        <div className="space-y-2">
          {missingDays.length > 0 && <div className="flex items-start gap-2 rounded-xl border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>Aucun lead saisi pour : <span className="font-semibold">{missingDays.map(d => `${d.label} ${dayDates[d.i]}`).join(', ')}</span>. Pense à compléter si des leads ont été livrés.</div></div>}
          {calc.totalMarge < 0 && <div className="flex items-start gap-2 rounded-xl border border-rose-700/50 bg-rose-900/20 px-4 py-3 text-sm text-rose-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>Marge négative cette semaine : <span className="font-semibold">{fmtEur(calc.totalMarge)}</span>. Les coûts dépassent le CA pour l'instant.</div></div>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Euro size={18} />} label="CA Total" value={fmtEur(calc.totalCA)} color="cyan" delta={prevCalc ? delta(calc.totalCA, prevCalc.totalCA) : null} />
        <KPI icon={<Target size={18} />} label="Coût Total" value={fmtEur(calc.totalCost)} color="amber" delta={prevCalc ? delta(calc.totalCost, prevCalc.totalCost) : null} inverse />
        <KPI icon={calc.totalMarge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge" value={fmtEur(calc.totalMarge)} color={calc.totalMarge >= 0 ? 'emerald' : 'rose'} delta={prevCalc ? delta(calc.totalMarge, prevCalc.totalMarge) : null} />
        <KPI icon={<BarChart3 size={18} />} label="Leads vendus" value={calc.totalSalesLeads.toLocaleString('fr-FR')} sub={`Marge ${fmtPct(calc.totalMargePct)}`} color="violet" delta={prevCalc ? delta(calc.totalSalesLeads, prevCalc.totalSalesLeads) : null} />
      </div>
      {prevWeek && <div className="text-[11px] text-slate-500 -mt-2 px-1">Variations vs semaine du {formatDate(prevWeek.start_date)}</div>}

      <div className="md:hidden space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ key: null, label: 'Tous' }, ...PRODUCTS.map(p => ({ key: p.key, label: `${p.icon} ${p.label}` }))].map(c => (
            <button key={c.key || 'all'} onClick={() => setMobileProduct(c.key)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${mobileProduct === c.key ? 'bg-gradient-to-r from-cyan-600 to-violet-600 border-transparent text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>{c.label}</button>
          ))}
        </div>
        {mobileProduct === null && (
          <div className="grid grid-cols-1 gap-2">
            {PRODUCTS.map(prod => { const s = calc[prod.key.toLowerCase()]; const ring = { cyan: 'border-cyan-700/50', orange: 'border-orange-700/50', red: 'border-red-700/50' }[prod.color]; return (
              <button key={prod.key} onClick={() => setMobileProduct(prod.key)} className={`w-full text-left bg-slate-900/70 rounded-xl border ${ring} px-3 py-2.5 active:scale-[0.99] transition`}>
                <div className="flex items-center justify-between mb-1.5"><span className="font-bold text-sm">{prod.icon} {prod.label}</span><span className={`text-sm font-bold ${margeColor(s.marge)}`}>{s.marge >= 0 ? '+' : ''}{fmtEurShort(s.marge)} <span className="text-[10px] font-normal opacity-70">({fmtPct(s.margePct)})</span></span></div>
                <div className="grid grid-cols-3 gap-2 text-[11px]"><div><div className="text-slate-500">Leads vendus</div><div className="text-violet-300 font-semibold">{s.salesLeads}</div></div><div><div className="text-slate-500">CA</div><div className="text-cyan-300 font-semibold">{fmtEurShort(s.ca)}</div></div><div><div className="text-slate-500">Coût</div><div className="text-amber-300 font-semibold">{fmtEurShort(s.cost)}</div></div></div>
              </button>); })}
          </div>
        )}
      </div>

      {PRODUCTS.filter(p => !mobileProduct || p.key === mobileProduct).map(prod => {
        const stats = calc[prod.key.toLowerCase()];
        return (
          <div key={prod.key} className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">
            <Card title={`${prod.label} — Leads`} accent={prod.color} icon={prod.icon}><LeadTable canWrite={canWrite} rows={stats.leads} onUpdate={(id, patch) => updateRow('lead_sources', id, patch)} onDelete={(id) => deleteRow('lead_sources', id, currentWeek.id)} onAdd={() => addLeadSource(currentWeek.id, prod.key)} totalCost={stats.cost} totalLeads={stats.leadsCount} cm={stats.cm} accent={prod.color} /></Card>
            <Card title={`${prod.label} — Ventes`} accent="emerald" icon="💰"><SalesTable canWrite={canWrite} todayIdx={todayIdx} dayDates={dayDates} rows={stats.sales} onUpdate={(id, patch) => updateRow('sales', id, patch)} onDelete={(id) => deleteRow('sales', id, currentWeek.id)} onAdd={() => addSale(currentWeek.id, prod.key)} totalCA={stats.ca} marge={stats.marge} margePct={stats.margePct} /></Card>
          </div>
        );
      })}

      <Card title="Coûts annexes (calcul auto)" accent="fuchsia" icon="⚙️">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40"><div className="flex justify-between items-center mb-1"><span className="text-sm text-slate-300 font-medium">Coût Cesar</span><span className="text-lg font-bold text-fuchsia-300">{fmtEur(calc.cesarCost)}</span></div><div className="text-xs text-slate-500">10 % du coût total des leads ({fmtEur(calc.totalLeadsCost)})</div></div>
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40"><div className="flex justify-between items-center mb-1"><span className="text-sm text-slate-300 font-medium">Coût Sacha</span><span className="text-lg font-bold text-fuchsia-300">{fmtEur(calc.sachaCost)}</span></div><div className="text-xs text-slate-500">0,50 € × {calc.totalSalesLeads} leads vendus</div></div>
        </div>
      </Card>

      <MargeGlobale calc={calc} title="Marge Globale" />
    </div>
  );
}

function MargeGlobale({ calc, title }) {
  return (
    <div className="bg-gradient-to-br from-violet-950 via-purple-950/80 to-fuchsia-950 rounded-2xl border border-violet-700/40 p-5 shadow-2xl">
      <div className="flex items-center gap-2 mb-4"><span className="text-2xl">🏆</span><h2 className="text-xl font-bold text-violet-100">{title}</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-violet-300 border-b border-violet-800/50"><th className="text-left py-2 px-3 font-medium">Tableau</th><th className="text-right py-2 px-3 font-medium">CA</th><th className="text-right py-2 px-3 font-medium">Coût</th><th className="text-right py-2 px-3 font-medium">Marge</th><th className="text-right py-2 px-3 font-medium">%</th></tr></thead>
          <tbody>
            {PRODUCTS.map(prod => { const s = calc[prod.key.toLowerCase()]; return <MargeRow key={prod.key} label={prod.label} ca={s.ca} cost={s.cost} marge={s.marge} pct={s.cost > 0 ? (s.marge / s.cost) * 100 : 0} />; })}
            <MargeRow label="CESAR (10%)" ca={0} cost={calc.cesarCost} marge={-calc.cesarCost} pct={calc.cesarCost > 0 ? -100 : 0} />
            <MargeRow label="SACHA (0,50€/lead)" ca={0} cost={calc.sachaCost} marge={-calc.sachaCost} pct={calc.sachaCost > 0 ? -100 : 0} />
            <tr className="border-t-2 border-violet-700 font-bold bg-violet-900/40"><td className="py-3 px-3 text-violet-100">TOTAL</td><td className="py-3 px-3 text-right text-violet-100">{fmtEur(calc.totalCA)}</td><td className="py-3 px-3 text-right text-violet-100">{fmtEur(calc.totalCost)}</td><td className={`py-3 px-3 text-right ${margeColor(calc.totalMarge)}`}>{fmtEur(calc.totalMarge)}</td><td className={`py-3 px-3 text-right ${margeColor(calc.totalMargePct)}`}>{fmtPct(calc.totalMargePct)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== NEW WEEK MODAL ==============
function NewWeekModal({ mode, defaultStart, defaultEnd, onClose, onConfirm }) {
  const [startDate, setStartDate] = useState(defaultStart); const [endDate, setEndDate] = useState(defaultEnd); const [error, setError] = useState('');
  const handleStartChange = (s) => { setStartDate(s); if (s >= endDate) setEndDate(addDays(s, 7)); };
  const submit = () => { if (!startDate || !endDate) return setError('Les deux dates sont obligatoires'); if (endDate <= startDate) return setError('La date de fin doit être après la date de début'); onConfirm(startDate, endDate); };
  const duration = startDate && endDate ? Math.round((parseDate(endDate) - parseDate(startDate)) / 86400000) : 0;
  const inp = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none";
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold flex items-center gap-2">{mode === 'duplicate' ? <Copy size={18} className="text-indigo-400" /> : <Plus size={18} className="text-cyan-400" />}{mode === 'duplicate' ? 'Dupliquer la semaine' : 'Nouvelle semaine'}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={18} /></button></div>
        <p className="text-sm text-slate-400 mb-4">{mode === 'duplicate' ? 'Les sources, clients et prix de la semaine actuelle seront copiés, montants remis à zéro.' : 'Les clients et sources définis dans Réglages seront créés automatiquement.'}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Date de début</label><input type="date" value={startDate} onChange={(e) => handleStartChange(e.target.value)} className={`${inp} focus:border-cyan-500`} /></div>
          <div><label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Date de fin</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inp} focus:border-violet-500`} /></div>
          {duration > 0 && <div className="text-xs text-slate-500 text-center">Durée : <span className="text-slate-300 font-medium">{duration} jour{duration > 1 ? 's' : ''}</span></div>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEndDate(addDays(startDate, 4))} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">Lun→Ven</button>
            <button onClick={() => setEndDate(addDays(startDate, 7))} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">+7 jours</button>
            <button onClick={() => { const d = parseDate(startDate); setEndDate(localIso(new Date(d.getFullYear(), d.getMonth() + 1, 0))); }} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">Fin du mois</button>
          </div>
          {error && <div className="bg-rose-900/30 border border-rose-800/50 rounded-lg px-3 py-2 text-sm text-rose-300">{error}</div>}
          <div className="flex gap-2 justify-end pt-2"><button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">Annuler</button><button onClick={submit} className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${mode === 'duplicate' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}>{mode === 'duplicate' ? 'Dupliquer' : 'Créer'}</button></div>
        </div>
      </div>
    </div>
  );
}

// ============== PDF (téléchargement direct + secours impression) ==============
const PRINT_CSS = `@media print { .no-print { display: none !important; } body { background: white !important; margin: 0 !important; } .pdf-page { color: black !important; box-shadow: none !important; margin: 0 !important; padding: 8mm !important; max-width: none !important; page-break-inside: avoid; } .pdf-page * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } } @page { size: A4 portrait; margin: 0; }`;
let html2pdfLoader = null;
function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (!html2pdfLoader) html2pdfLoader = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'; s.onload = () => res(window.html2pdf); s.onerror = () => { html2pdfLoader = null; rej(new Error('Chargement PDF impossible')); }; document.head.appendChild(s); });
  return html2pdfLoader;
}
function PdfShell({ title, icon, accent, fileName, onClose, children }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const h2p = await loadHtml2Pdf();
      const el = document.getElementById('pdf-root');
      await h2p().set({ margin: 8, filename: fileName, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['avoid-all'] } }).from(el).save();
      toast('PDF téléchargé', 'success');
    } catch (e) { toast('Téléchargement direct indisponible, ouverture de l\'impression', 'info'); window.print(); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-auto">
      <style>{PRINT_CSS}</style>
      <div className="no-print sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10 gap-2">
        <h2 className="font-bold flex items-center gap-2 text-sm md:text-base">{icon} {title}</h2>
        <div className="flex gap-2 items-center">
          <button onClick={download} disabled={busy} className={`px-4 py-2 ${accent} disabled:opacity-60 rounded-lg flex items-center gap-2 text-sm font-medium`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Télécharger PDF</button>
          <button onClick={() => window.print()} className="hidden md:flex px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg items-center gap-2 text-sm" title="Imprimer"><Printer size={16} /></button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">Fermer</button>
        </div>
      </div>
      <div id="pdf-root" className="pdf-page bg-white text-slate-900 max-w-[210mm] mx-auto my-4 p-6 shadow-2xl" style={{ fontSize: '9px', lineHeight: '1.3' }}>{children}</div>
    </div>
  );
}

function WeekPdfModal({ currentWeek, calc, range, session, onClose }) {
  return (
    <PdfShell title={`Semaine du ${range.start}`} icon={<FileText size={18} />} accent="bg-emerald-600 hover:bg-emerald-500" fileName={`stats-semaine-${currentWeek.start_date}.pdf`} onClose={onClose}>
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-2 mb-3">
        <div><h1 className="text-xl font-bold text-slate-900 leading-tight">Stats Leads</h1><p className="text-[10px] text-slate-600">Rapport hebdomadaire — {session.display_name}</p></div>
        <div className="text-right"><div className="bg-slate-100 px-2 py-1 rounded text-[10px] inline-block"><span className="font-bold">Du {range.start} au {range.end}</span></div><div className="text-[8px] text-slate-500 mt-0.5">Édité le {new Date().toLocaleDateString('fr-FR')}</div></div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <PdfKPI label="CA" value={fmtEur(calc.totalCA)} color="#0891b2" /><PdfKPI label="Coût" value={fmtEur(calc.totalCost)} color="#d97706" />
        <PdfKPI label="Marge" value={fmtEur(calc.totalMarge)} color={calc.totalMarge >= 0 ? '#059669' : '#dc2626'} /><PdfKPI label="Leads vendus" value={String(calc.totalSalesLeads)} color="#7c3aed" />
      </div>
      {PRODUCTS.map(prod => {
        const s = calc[prod.key.toLowerCase()];
        if (s.leads.length === 0 && s.sales.length === 0) return null;
        return (
          <div key={prod.key} className="mb-2">
            <h2 className="text-[11px] font-bold text-slate-900 border-b border-slate-400 pb-0.5 mb-1">{prod.icon} {prod.label}</h2>
            <div className="grid grid-cols-2 gap-2">
              <table className="w-full border border-slate-300" style={{ fontSize: '8px' }}>
                <thead className="bg-slate-100"><tr><th className="text-left px-1 py-0.5 border-b border-slate-300">Source</th><th className="text-right px-1 py-0.5 border-b border-slate-300">€</th><th className="text-right px-1 py-0.5 border-b border-slate-300">Lds</th><th className="text-right px-1 py-0.5 border-b border-slate-300">€/L</th></tr></thead>
                <tbody>
                  {[...s.leads].sort((a, b) => a.position - b.position).map(r => <tr key={r.id} className="border-b border-slate-200"><td className="px-1 py-0.5">{r.source_name}</td><td className="text-right px-1 py-0.5">{fmtEurShort(r.cost)}</td><td className="text-right px-1 py-0.5">{r.leads}</td><td className="text-right px-1 py-0.5">{r.leads > 0 ? fmtEurShort(r.cost / r.leads) : '—'}</td></tr>)}
                  <tr className="bg-slate-100 font-bold"><td className="px-1 py-0.5">TOTAL</td><td className="text-right px-1 py-0.5">{fmtEurShort(s.cost)}</td><td className="text-right px-1 py-0.5">{s.leadsCount}</td><td className="text-right px-1 py-0.5">{fmtEurShort(s.cm)}</td></tr>
                </tbody>
              </table>
              <table className="w-full border border-slate-300" style={{ fontSize: '8px' }}>
                <thead className="bg-slate-100"><tr><th className="text-left px-1 py-0.5 border-b border-slate-300">Client</th><th className="text-right px-1 py-0.5 border-b border-slate-300">Lds</th><th className="text-right px-1 py-0.5 border-b border-slate-300">€/L</th><th className="text-right px-1 py-0.5 border-b border-slate-300">CA</th></tr></thead>
                <tbody>
                  {[...s.sales].sort((a, b) => a.position - b.position).map(r => { const l = rowDays(r), p = Number(r.price_per_lead) || 0; if (l === 0 && p === 0) return null; return <tr key={r.id} className="border-b border-slate-200"><td className="px-1 py-0.5">{r.client_name}</td><td className="text-right px-1 py-0.5">{l}</td><td className="text-right px-1 py-0.5">{p > 0 ? fmtEur(p) : '—'}</td><td className="text-right px-1 py-0.5 font-medium">{fmtEurShort(l * p)}</td></tr>; })}
                  <tr className="bg-slate-100 font-bold"><td className="px-1 py-0.5">TOTAL</td><td className="text-right px-1 py-0.5">{s.salesLeads}</td><td className="text-right px-1 py-0.5">—</td><td className="text-right px-1 py-0.5">{fmtEurShort(s.ca)}</td></tr>
                  <tr className={s.marge >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}><td className="px-1 py-0.5 font-bold">Marge ({fmtPct(s.margePct)})</td><td colSpan={3} className={`text-right px-1 py-0.5 font-bold ${s.marge >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtEurShort(s.marge)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="border border-slate-300 px-2 py-1 rounded flex justify-between items-center text-[9px]"><span className="text-slate-600">Cesar (10 % coût leads)</span><span className="font-bold text-rose-700">{fmtEur(calc.cesarCost)}</span></div>
        <div className="border border-slate-300 px-2 py-1 rounded flex justify-between items-center text-[9px]"><span className="text-slate-600">Sacha (0,50 €/lead)</span><span className="font-bold text-rose-700">{fmtEur(calc.sachaCost)}</span></div>
      </div>
      <h2 className="text-[11px] font-bold text-slate-900 border-b border-slate-400 pb-0.5 mb-1">🏆 Synthèse marge globale</h2>
      <table className="w-full border border-slate-300" style={{ fontSize: '9px' }}>
        <thead className="bg-slate-800 text-white"><tr><th className="text-left px-2 py-1">Tableau</th><th className="text-right px-2 py-1">CA</th><th className="text-right px-2 py-1">Coût</th><th className="text-right px-2 py-1">Marge</th><th className="text-right px-2 py-1">%</th></tr></thead>
        <tbody>
          {PRODUCTS.map(prod => { const s = calc[prod.key.toLowerCase()]; return <PdfMargeRow key={prod.key} label={prod.label} ca={s.ca} cost={s.cost} marge={s.marge} pct={s.margePct} />; })}
          <PdfMargeRow label="CESAR" ca={0} cost={calc.cesarCost} marge={-calc.cesarCost} pct={calc.cesarCost > 0 ? -100 : 0} />
          <PdfMargeRow label="SACHA" ca={0} cost={calc.sachaCost} marge={-calc.sachaCost} pct={calc.sachaCost > 0 ? -100 : 0} />
          <tr className="bg-slate-200 font-bold border-t-2 border-slate-800"><td className="px-2 py-1">TOTAL</td><td className="text-right px-2 py-1">{fmtEur(calc.totalCA)}</td><td className="text-right px-2 py-1">{fmtEur(calc.totalCost)}</td><td className={`text-right px-2 py-1 ${calc.totalMarge >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtEur(calc.totalMarge)}</td><td className={`text-right px-2 py-1 ${calc.totalMargePct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtPct(calc.totalMargePct)}</td></tr>
        </tbody>
      </table>
    </PdfShell>
  );
}
function PdfKPI({ label, value, color }) { return <div className="border-2 rounded px-2 py-1" style={{ borderColor: color }}><div className="text-[8px] uppercase tracking-wider" style={{ color }}>{label}</div><div className="text-[12px] font-bold" style={{ color }}>{value}</div></div>; }
function PdfMargeRow({ label, ca, cost, marge, pct }) { return <tr className="border-b border-slate-200"><td className="px-2 py-1 font-medium">{label}</td><td className="text-right px-2 py-1">{fmtEur(ca)}</td><td className="text-right px-2 py-1">{fmtEur(cost)}</td><td className={`text-right px-2 py-1 font-medium ${marge >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtEur(marge)}</td><td className={`text-right px-2 py-1 font-medium ${pct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtPct(pct)}</td></tr>; }

function InvoicePdfModal({ currentWeek, calc, range, session, onClose }) {
  const allClients = PRODUCTS.flatMap(prod => calc[prod.key.toLowerCase()].sales.filter(s => rowCA(s) > 0));
  const total = allClients.reduce((s, c) => s + rowCA(c), 0);
  return (
    <PdfShell title={`À facturer — ${range.start}`} icon={<Receipt size={18} />} accent="bg-amber-600 hover:bg-amber-500" fileName={`a-facturer-${currentWeek.start_date}.pdf`} onClose={onClose}>
      <div className="flex justify-between items-end border-b-2 border-amber-600 pb-2 mb-3">
        <div><span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">État à facturer</span><h1 className="text-xl font-bold text-slate-900 mt-1 leading-tight">Récapitulatif de facturation</h1><p className="text-[10px] text-slate-600">Semaine du {range.start} au {range.end}</p></div>
        <div className="text-right text-[9px]"><div className="font-bold text-slate-900">{session.display_name}</div><div className="text-slate-500">Édité le {new Date().toLocaleDateString('fr-FR')}</div></div>
      </div>
      <div className="bg-amber-50 border-2 border-amber-300 rounded p-3 mb-3"><div className="flex justify-between items-center"><div><div className="text-[9px] uppercase tracking-wider text-amber-800 font-bold">Total à réclamer</div><div className="text-2xl font-bold text-amber-900">{fmtEur(total)}</div><div className="text-[9px] text-amber-700">{allClients.length} client{allClients.length > 1 ? 's' : ''} • {calc.totalSalesLeads} leads vendus</div></div><Receipt size={36} className="text-amber-300" /></div></div>
      {allClients.length === 0 ? <div className="text-center py-8 text-slate-500 italic text-[10px]">Aucun client à facturer pour cette semaine.</div> : (<>
        {PRODUCTS.map(prod => {
          const clients = calc[prod.key.toLowerCase()].sales.filter(s => rowCA(s) > 0); if (clients.length === 0) return null;
          return (
            <div key={prod.key} className="mb-2">
              <h2 className="text-[11px] font-bold text-slate-900 border-b border-slate-300 pb-0.5 mb-1 flex items-center justify-between"><span>{prod.icon} {prod.label}</span><span className="text-[10px] font-normal text-slate-600">{fmtEur(clients.reduce((s, c) => s + rowCA(c), 0))}</span></h2>
              <table className="w-full border border-slate-300" style={{ fontSize: '9px' }}>
                <thead className="bg-slate-100"><tr><th className="text-left px-2 py-1 border-b border-slate-300">Client</th><th className="text-right px-2 py-1 border-b border-slate-300 w-12">Leads</th><th className="text-right px-2 py-1 border-b border-slate-300 w-16">€/Lead</th><th className="text-right px-2 py-1 border-b border-slate-300 w-24">Montant</th></tr></thead>
                <tbody>{[...clients].sort((a, b) => a.position - b.position).map(c => <tr key={c.id} className="border-b border-slate-200"><td className="px-2 py-1 font-medium">{c.client_name}</td><td className="text-right px-2 py-1">{rowDays(c)}</td><td className="text-right px-2 py-1">{fmtEur(Number(c.price_per_lead) || 0)}</td><td className="text-right px-2 py-1 font-bold text-amber-700">{fmtEur(rowCA(c))}</td></tr>)}</tbody>
              </table>
            </div>
          );
        })}
        <div className="mt-3 pt-2 border-t-2 border-amber-600"><table className="w-full"><tbody><tr><td className="text-right px-2 py-0.5 text-slate-600 text-[9px]">Sous-total HT</td><td className="text-right px-2 py-0.5 w-32 font-bold text-[10px]">{fmtEur(total)}</td></tr><tr className="text-[8px] text-slate-500"><td className="text-right px-2 py-0.5 italic">(TVA non incluse)</td><td></td></tr><tr className="bg-amber-100 font-bold"><td className="text-right px-2 py-1.5 text-[11px]">TOTAL À FACTURER</td><td className="text-right px-2 py-1.5 text-amber-900 text-[12px]">{fmtEur(total)}</td></tr></tbody></table></div>
      </>)}
    </PdfShell>
  );
}

// ============== STATS VIEW ==============
function StatsView({ weeks, setCurrentWeekId, setActiveTab }) {
  const toast = useToast();
  const [period, setPeriod] = useState('week');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const allYears = useMemo(() => { const y = new Set(weeks.map(w => parseInt(w.start_date.slice(0, 4)))); if (y.size === 0) y.add(new Date().getFullYear()); return [...y].sort((a, b) => b - a); }, [weeks]);
  const all = useMemo(() => weeks.map(w => ({ ...w, stats: computeWeekStats(w), year: parseInt(w.start_date.slice(0, 4)), month: parseInt(w.start_date.slice(5, 7)) - 1 })), [weeks]);
  const rows = useMemo(() => {
    const mk = (label, ws, extra = {}) => { const ca = ws.reduce((s, w) => s + w.stats.totalCA, 0), cost = ws.reduce((s, w) => s + w.stats.totalCost, 0), marge = ca - cost; return { label, ca, cost, marge, leads: ws.reduce((s, w) => s + w.stats.totalSalesLeads, 0), margePct: cost > 0 ? (marge / cost) * 100 : 0, count: ws.length, empty: ws.length === 0, ...extra }; };
    if (period === 'week') return all.filter(w => w.year === selectedYear).sort((a, b) => a.start_date.localeCompare(b.start_date)).map(w => { const r = getWeekRange(w); return mk(`${r.start} → ${r.end}`, [w], { id: w.id, weekId: w.id }); });
    if (period === 'month') return Array.from({ length: 12 }, (_, i) => mk(MOIS_FR[i], all.filter(w => w.year === selectedYear && w.month === i), { id: i }));
    return allYears.map(y => mk(String(y), all.filter(w => w.year === y), { id: y }));
  }, [period, all, selectedYear, allYears]);
  const totals = useMemo(() => rows.reduce((a, r) => ({ ca: a.ca + r.ca, cost: a.cost + r.cost, marge: a.marge + r.marge, leads: a.leads + r.leads }), { ca: 0, cost: 0, marge: 0, leads: 0 }), [rows]);
  const totalMargePct = totals.cost > 0 ? (totals.marge / totals.cost) * 100 : 0;
  const label = period === 'week' ? 'Semaine' : period === 'month' ? 'Mois' : 'Année';
  const exportCSV = () => {
    const lines = [csvLine([label, 'CA', 'Coût', 'Marge', 'Marge %', 'Leads vendus']), ...rows.filter(r => !r.empty).map(r => csvLine([r.label, num(r.ca), num(r.cost), num(r.marge), num(r.margePct), r.leads])), csvLine(['TOTAL', num(totals.ca), num(totals.cost), num(totals.marge), num(totalMargePct), totals.leads])];
    downloadFile(`stats-${period}-${period === 'year' ? 'toutes' : selectedYear}.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8'); toast('CSV téléchargé', 'success');
  };
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/50 rounded-2xl border border-slate-700/50 p-5 flex items-center justify-between gap-3">
        <div><h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="text-violet-400" /> Statistiques</h2><p className="text-sm text-slate-400 mt-1">Vue récapitulative de toutes tes données</p></div>
        <button onClick={exportCSV} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 text-sm border border-slate-700 shrink-0"><FileSpreadsheet size={15} /><span className="hidden sm:inline">Export CSV</span></button>
      </div>
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit mx-auto">
        {[['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']].map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === k ? 'bg-gradient-to-br from-cyan-600 to-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>)}
      </div>
      {period !== 'year' && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => { const i = allYears.indexOf(selectedYear); if (i < allYears.length - 1) setSelectedYear(allYears[i + 1]); }} disabled={allYears.indexOf(selectedYear) >= allYears.length - 1} className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg"><ChevronLeft size={16} /></button>
          <span className="text-xl font-bold text-cyan-300 min-w-[80px] text-center">{selectedYear}</span>
          <button onClick={() => { const i = allYears.indexOf(selectedYear); if (i > 0) setSelectedYear(allYears[i - 1]); }} disabled={allYears.indexOf(selectedYear) <= 0} className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg"><ChevronRight size={16} /></button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Euro size={18} />} label="CA Total" value={fmtEur(totals.ca)} color="cyan" /><KPI icon={<Target size={18} />} label="Coût Total" value={fmtEur(totals.cost)} color="amber" />
        <KPI icon={totals.marge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge" value={fmtEur(totals.marge)} color={totals.marge >= 0 ? 'emerald' : 'rose'} /><KPI icon={<BarChart3 size={18} />} label="Leads vendus" value={totals.leads.toLocaleString('fr-FR')} color="violet" />
      </div>
      <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 border-b border-slate-700/50"><h3 className="text-lg font-bold text-cyan-300">{period === 'week' ? `Semaines de ${selectedYear}` : period === 'month' ? `Mois de ${selectedYear}` : 'Toutes les années'}</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 border-b border-slate-700 bg-slate-900/50"><th className="text-left py-3 px-4 font-semibold">{label}</th><th className="text-right py-3 px-4 font-semibold">CA</th><th className="text-right py-3 px-4 font-semibold">Coût</th><th className="text-right py-3 px-4 font-semibold">Marge</th><th className="text-right py-3 px-4 font-semibold">Marge %</th><th className="text-right py-3 px-4 font-semibold">Leads</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">Aucune donnée pour cette période</td></tr>}
              {rows.map(r => { const clickable = period === 'week' && r.weekId; return (
                <tr key={r.id} onClick={() => clickable && (setCurrentWeekId(r.weekId), setActiveTab('week'))} className={`border-b border-slate-800/50 transition ${clickable ? 'cursor-pointer hover:bg-slate-800/40' : ''} ${r.empty ? 'opacity-40' : ''}`}>
                  <td className="py-3 px-4 font-medium text-slate-200">{r.label}</td>
                  <td className={`py-3 px-4 text-right ${r.ca > 0 ? 'text-cyan-300 font-medium' : 'text-slate-500'}`}>{fmtEur(r.ca)}</td>
                  <td className={`py-3 px-4 text-right ${r.cost > 0 ? 'text-amber-300 font-medium' : 'text-slate-500'}`}>{fmtEur(r.cost)}</td>
                  <td className={`py-3 px-4 text-right font-medium ${r.marge !== 0 ? margeColor(r.marge) : 'text-slate-500'}`}>{fmtEur(r.marge)}</td>
                  <td className={`py-3 px-4 text-right font-medium ${r.margePct !== 0 ? margeColor(r.margePct) : 'text-slate-500'}`}>{fmtPct(r.margePct)}</td>
                  <td className={`py-3 px-4 text-right ${r.leads > 0 ? 'text-violet-300 font-medium' : 'text-slate-500'}`}>{r.leads}</td>
                </tr>); })}
              {rows.length > 0 && <tr className="bg-gradient-to-r from-violet-900/40 to-fuchsia-900/40 border-t-2 border-violet-700 font-bold"><td className="py-4 px-4 text-violet-100">TOTAL</td><td className="py-4 px-4 text-right text-cyan-200">{fmtEur(totals.ca)}</td><td className="py-4 px-4 text-right text-amber-200">{fmtEur(totals.cost)}</td><td className={`py-4 px-4 text-right ${margeColor(totals.marge)}`}>{fmtEur(totals.marge)}</td><td className={`py-4 px-4 text-right ${margeColor(totalMargePct)}`}>{fmtPct(totalMargePct)}</td><td className="py-4 px-4 text-right text-violet-200">{totals.leads.toLocaleString('fr-FR')}</td></tr>}
            </tbody>
          </table>
        </div>
        {period === 'week' && rows.length > 0 && <div className="bg-slate-900/80 px-5 py-2 text-xs text-slate-500 text-center border-t border-slate-800">💡 Clique sur une semaine pour l'ouvrir</div>}
      </div>
    </div>
  );
}

// ============== HISTORY VIEW ==============
function HistoryView({ canWrite, weeks, currentWeekId, setCurrentWeekId, setActiveTab, deleteWeek }) {
  const [search, setSearch] = useState(''); const [yearFilter, setYearFilter] = useState('all');
  const grouped = useMemo(() => { const g = {}; weeks.forEach(w => { const mk = getMonthKey(w.start_date); if (!g[mk]) g[mk] = []; g[mk].push({ ...w, stats: computeWeekStats(w) }); }); return g; }, [weeks]);
  const allYears = useMemo(() => [...new Set(Object.keys(grouped).map(k => k.slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [grouped]);
  const filtered = useMemo(() => Object.keys(grouped).filter(mk => yearFilter === 'all' || mk.startsWith(yearFilter)).filter(mk => { if (!search) return true; if (getMonthLabel(mk).toLowerCase().includes(search.toLowerCase())) return true; return grouped[mk].some(w => { const r = getWeekRange(w); return r.start.includes(search) || r.end.includes(search); }); }).sort((a, b) => b.localeCompare(a)), [grouped, yearFilter, search]);
  const totals = useMemo(() => weeks.reduce((a, w) => { const s = computeWeekStats(w); return { ca: a.ca + s.totalCA, cost: a.cost + s.totalCost, marge: a.marge + s.totalMarge, leads: a.leads + s.totalSalesLeads }; }, { ca: 0, cost: 0, marge: 0, leads: 0 }), [weeks]);
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/50 rounded-2xl border border-slate-700/50 p-5"><h2 className="text-2xl font-bold flex items-center gap-2"><History className="text-cyan-400" /> Historique</h2><p className="text-sm text-slate-400 mt-1">{weeks.length} semaine{weeks.length > 1 ? 's' : ''} • {Object.keys(grouped).length} mois</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Euro size={18} />} label="CA cumulé" value={fmtEur(totals.ca)} color="cyan" /><KPI icon={<Target size={18} />} label="Coût cumulé" value={fmtEur(totals.cost)} color="amber" />
        <KPI icon={totals.marge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge cumulée" value={fmtEur(totals.marge)} color={totals.marge >= 0 ? 'emerald' : 'rose'} /><KPI icon={<BarChart3 size={18} />} label="Leads vendus" value={totals.leads.toLocaleString('fr-FR')} color="violet" />
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none" /></div>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none"><option value="all">Toutes années</option>{allYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
      </div>
      {filtered.length === 0 && <div className="text-center py-12 text-slate-500">Aucune semaine</div>}
      {filtered.map(mk => {
        const ws = grouped[mk]; const ms = ws.reduce((a, w) => ({ ca: a.ca + w.stats.totalCA, cost: a.cost + w.stats.totalCost, marge: a.marge + w.stats.totalMarge }), { ca: 0, cost: 0, marge: 0 });
        return (
          <div key={mk} className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-700/50">
              <h3 className="text-lg font-bold text-cyan-300">{getMonthLabel(mk)}</h3>
              <div className="flex flex-wrap gap-3 text-xs"><span className="text-slate-400">{ws.length} sem.</span><span><span className="text-slate-500">CA:</span> <span className="text-cyan-300 font-medium">{fmtEur(ms.ca)}</span></span><span><span className="text-slate-500">Coût:</span> <span className="text-amber-300 font-medium">{fmtEur(ms.cost)}</span></span><span><span className="text-slate-500">Marge:</span> <span className={`font-medium ${margeColor(ms.marge)}`}>{fmtEur(ms.marge)}</span></span></div>
            </div>
            <div className="divide-y divide-slate-800/70">
              {ws.map(w => { const r = getWeekRange(w); const isActive = w.id === currentWeekId; return (
                <div key={w.id} className={`px-5 py-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-800/40 transition ${isActive ? 'bg-cyan-900/20' : ''}`}>
                  <button onClick={() => { setCurrentWeekId(w.id); setActiveTab('week'); }} className="flex-1 text-left flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-600'}`}></div><div className="font-medium text-sm">{r.start} → {r.end}</div></button>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Pill label="CA" value={fmtEurShort(w.stats.totalCA)} color="cyan" /><Pill label="Coût" value={fmtEurShort(w.stats.totalCost)} color="amber" /><Pill label="Marge" value={fmtEurShort(w.stats.totalMarge)} color={w.stats.totalMarge >= 0 ? 'emerald' : 'rose'} /><Pill label="Leads" value={w.stats.totalSalesLeads} color="violet" />
                    {canWrite && <button onClick={() => deleteWeek(w.id)} className="text-rose-400 hover:text-rose-300 ml-2"><Trash2 size={15} /></button>}
                  </div>
                </div>); })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============== MONTHLY VIEW ==============
function MonthlyView({ weeks }) {
  const monthly = useMemo(() => {
    const m = {};
    weeks.forEach(w => { const mk = getMonthKey(w.start_date); if (!m[mk]) m[mk] = []; m[mk].push(computeWeekStats(w)); });
    const out = {};
    Object.keys(m).forEach(mk => {
      const st = m[mk]; const sumProd = (k) => st.reduce((a, s) => ({ cost: a.cost + s[k].cost, leadsCount: a.leadsCount + s[k].leadsCount, ca: a.ca + s[k].ca, salesLeads: a.salesLeads + s[k].salesLeads, marge: a.marge + s[k].marge }), { cost: 0, leadsCount: 0, ca: 0, salesLeads: 0, marge: 0 });
      const sum = (k) => st.reduce((a, s) => a + s[k], 0);
      out[mk] = { ite: sumProd('ite'), pv: sumProd('pv'), pac: sumProd('pac'), cesarCost: sum('cesarCost'), sachaCost: sum('sachaCost'), totalCA: sum('totalCA'), totalCost: sum('totalCost'), totalMarge: sum('totalMarge'), totalSalesLeads: sum('totalSalesLeads') };
      out[mk].totalMargePct = out[mk].totalCost > 0 ? (out[mk].totalMarge / out[mk].totalCost) * 100 : 0;
    });
    return out;
  }, [weeks]);
  const keys = useMemo(() => Object.keys(monthly).sort((a, b) => b.localeCompare(a)), [monthly]);
  const [sel, setSel] = useState(keys[0]);
  useEffect(() => { if (!keys.includes(sel) && keys.length > 0) setSel(keys[0]); }, [keys, sel]);
  if (keys.length === 0) return <div className="text-center py-12 text-slate-500">Aucune donnée</div>;
  const stats = monthly[sel]; const idx = keys.indexOf(sel); const prev = keys[idx + 1] ? monthly[keys[idx + 1]] : null;
  const variation = (c, p) => p > 0 ? ((c - p) / p) * 100 : null;
  const chart = [...keys].reverse().map(mk => ({ label: getMonthLabel(mk).split(' ')[0].slice(0, 3), ca: monthly[mk].totalCA, cost: monthly[mk].totalCost, marge: monthly[mk].totalMarge, isSelected: mk === sel }));
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/50 rounded-2xl border border-slate-700/50 p-5"><h2 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="text-violet-400" /> Récap mensuel</h2><p className="text-sm text-slate-400 mt-1">{keys.length} mois enregistré{keys.length > 1 ? 's' : ''}</p></div>
      <div className="flex flex-wrap gap-2">{keys.map(mk => <button key={mk} onClick={() => setSel(mk)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mk === sel ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'}`}>{getMonthLabel(mk)}</button>)}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Euro size={18} />} label="CA Total" value={fmtEur(stats.totalCA)} delta={prev ? variation(stats.totalCA, prev.totalCA) : null} color="cyan" />
        <KPI icon={<Target size={18} />} label="Coût Total" value={fmtEur(stats.totalCost)} delta={prev ? variation(stats.totalCost, prev.totalCost) : null} color="amber" inverse />
        <KPI icon={stats.totalMarge >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Marge" value={fmtEur(stats.totalMarge)} delta={prev ? variation(stats.totalMarge, prev.totalMarge) : null} color={stats.totalMarge >= 0 ? 'emerald' : 'rose'} />
        <KPI icon={<BarChart3 size={18} />} label="Leads vendus" value={stats.totalSalesLeads.toLocaleString('fr-FR')} delta={prev ? variation(stats.totalSalesLeads, prev.totalSalesLeads) : null} color="violet" />
      </div>
      {prev && <div className="text-[11px] text-slate-500 -mt-2 px-1">Variations vs {getMonthLabel(keys[idx + 1])}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {PRODUCTS.map(prod => { const s = stats[prod.key.toLowerCase()]; return <Card key={prod.key} title={`${prod.label} — Synthèse`} accent={prod.color} icon={prod.icon}><DetailRow label="Coût total" value={fmtEur(s.cost)} /><DetailRow label="Leads achetés" value={s.leadsCount.toLocaleString('fr-FR')} /><DetailRow label="Coût moyen / lead" value={fmtEur(s.leadsCount > 0 ? s.cost / s.leadsCount : 0)} /><DetailRow label="Leads vendus" value={s.salesLeads.toLocaleString('fr-FR')} /><DetailRow label="CA généré" value={fmtEur(s.ca)} /><DetailRow label="Marge" value={fmtEur(s.marge)} highlight={s.marge} /></Card>; })}
      </div>
      <Card title="Coûts annexes du mois" accent="fuchsia" icon="⚙️"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40 flex justify-between items-center"><span className="text-sm text-slate-400">Cesar (10 %)</span><span className="text-lg font-bold text-rose-300">{fmtEur(stats.cesarCost)}</span></div><div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40 flex justify-between items-center"><span className="text-sm text-slate-400">Sacha (0,50 €/lead)</span><span className="text-lg font-bold text-rose-300">{fmtEur(stats.sachaCost)}</span></div></div></Card>
      <MargeGlobale calc={stats} title={`Synthèse — ${getMonthLabel(sel)}`} />
      {chart.length >= 2 && <Card title="Évolution mensuelle" accent="indigo" icon="📈"><MonthlyBarChart data={chart} /></Card>}
    </div>
  );
}

// ============== SETTINGS VIEW ==============
function SettingsView() {
  const toast = useToast();
  const [defaults, setDefaults] = useState(null);
  const [tab, setTab] = useState('clients');
  const [confirm, setConfirm] = useState(null);
  const load = useCallback(async () => { try { setDefaults(await api.getDefaults()); } catch (e) { toast(e.message, 'error'); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const saveClient = async (c) => { try { const id = await api.saveDefaultClient(c); await load(); if (!c.id) toast('Client ajouté', 'success'); return id; } catch (e) { toast(e.message, 'error'); } };
  const saveSource = async (s) => { try { await api.saveDefaultSource(s); await load(); if (!s.id) toast('Source ajoutée', 'success'); } catch (e) { toast(e.message, 'error'); } };
  const delClient = (c) => setConfirm({ title: `Retirer « ${c.client_name} » (${c.category}) des réglages ?`, message: 'Il ne sera plus créé automatiquement dans les nouvelles semaines. Les semaines existantes ne changent pas.', danger: true, confirmText: 'Retirer', onConfirm: async () => { try { await api.deleteDefaultClient(c.id); await load(); } catch (e) { toast(e.message, 'error'); } } });
  const delSource = (s) => setConfirm({ title: `Retirer « ${s.source_name} » (${s.category}) ?`, message: 'Elle ne sera plus créée automatiquement dans les nouvelles semaines.', danger: true, confirmText: 'Retirer', onConfirm: async () => { try { await api.deleteDefaultSource(s.id); await load(); } catch (e) { toast(e.message, 'error'); } } });
  if (!defaults) return <div className="flex justify-center py-12"><Loader2 className="text-cyan-400 animate-spin" size={28} /></div>;
  return (
    <div className="space-y-5">
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} {...(confirm || {})} />
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/50 rounded-2xl border border-slate-700/50 p-5"><h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-cyan-400" /> Réglages</h2><p className="text-sm text-slate-400 mt-1">Clients, prix et sources créés automatiquement à chaque nouvelle semaine. Les semaines déjà existantes ne sont pas modifiées.</p></div>
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {[['clients', 'Clients & prix'], ['sources', 'Sources']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === k ? 'bg-gradient-to-br from-cyan-600 to-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>)}
      </div>
      {PRODUCTS.map(prod => {
        const items = tab === 'clients' ? defaults.clients.filter(c => c.category === prod.key) : defaults.sources.filter(s => s.category === prod.key);
        return (
          <Card key={prod.key} title={`${prod.label} — ${tab === 'clients' ? 'Clients' : 'Sources'}`} accent={prod.color} icon={prod.icon}>
            <div className="space-y-2">
              {items.length === 0 && <div className="text-sm text-slate-500 italic py-2">Aucun élément</div>}
              {items.map(it => tab === 'clients'
                ? <SettingRow key={it.id} item={it} nameKey="client_name" withPrice onSave={saveClient} onDelete={() => delClient(it)} />
                : <SettingRow key={it.id} item={it} nameKey="source_name" onSave={saveSource} onDelete={() => delSource(it)} />)}
              <AddRow category={prod.key} withPrice={tab === 'clients'} onAdd={(v) => tab === 'clients' ? saveClient({ category: prod.key, client_name: v.name, price_per_lead: v.price, active: true }) : saveSource({ category: prod.key, source_name: v.name, active: true })} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
function SettingRow({ item, nameKey, withPrice, onSave, onDelete }) {
  const [name, setName] = useState(item[nameKey]); const [price, setPrice] = useState(item.price_per_lead ?? 0);
  useEffect(() => { setName(item[nameKey]); setPrice(item.price_per_lead ?? 0); }, [item, nameKey]);
  const commit = () => { const changed = name !== item[nameKey] || (withPrice && Number(price) !== Number(item.price_per_lead)); if (changed && name.trim()) onSave({ ...item, [nameKey]: name.trim(), price_per_lead: Number(price) || 0 }); };
  const box = "h-9 bg-slate-800/60 border border-slate-700/70 rounded-lg px-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30";
  return (
    <div className={`flex items-center gap-2 ${item.active === false ? 'opacity-50' : ''}`}>
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} className={`${box} flex-1 min-w-0 font-medium`} />
      {withPrice && <div className="relative"><input type="number" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onFocus={(e) => e.target.select()} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} className={`${box} w-24 text-right pr-6 tabular-nums ${Number(price) > 0 ? 'text-amber-200 border-amber-600/50' : ''}`} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">€</span></div>}
      <button onClick={() => onSave({ ...item, active: item.active === false })} title={item.active === false ? 'Réactiver' : 'Désactiver (garde en mémoire)'} className={`h-9 px-2 rounded-lg border text-xs ${item.active === false ? 'border-slate-700 text-slate-400' : 'border-emerald-700/50 text-emerald-300 bg-emerald-900/20'}`}>{item.active === false ? 'Off' : 'On'}</button>
      <button onClick={onDelete} className="h-9 w-9 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-900/30" title="Retirer"><Trash2 size={15} /></button>
    </div>
  );
}
function AddRow({ withPrice, onAdd }) {
  const [name, setName] = useState(''); const [price, setPrice] = useState('');
  const submit = () => { if (!name.trim()) return; onAdd({ name: name.trim(), price: Number(price) || 0 }); setName(''); setPrice(''); };
  const box = "h-9 bg-slate-900/60 border border-dashed border-slate-700 rounded-lg px-2 text-sm text-slate-100 outline-none focus:border-cyan-400 placeholder:text-slate-600";
  return (
    <div className="flex items-center gap-2 pt-1">
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={withPrice ? 'Nouveau client…' : 'Nouvelle source…'} className={`${box} flex-1 min-w-0`} />
      {withPrice && <input type="number" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="€/lead" className={`${box} w-24 text-right`} />}
      <button onClick={submit} disabled={!name.trim()} className="h-9 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-1"><Plus size={14} /> Ajouter</button>
    </div>
  );
}

// ============== TABLES ==============
function DebouncedInput({ value, onCommit, type = 'text', step, className, readOnly = false }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  if (readOnly) return <div className={`${className} cursor-default`}>{type === 'number' ? (Number(value) || 0) : value}</div>;
  const commit = () => { const v = type === 'number' ? (Number(local) || 0) : local; if (v !== value) onCommit(v); };
  return <input type={type} step={step} value={local ?? ''} inputMode={type === 'number' ? (step ? 'decimal' : 'numeric') : undefined} onChange={(e) => setLocal(e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } if (e.key === 'Escape') { setLocal(value); e.target.blur(); } }} onBlur={commit} className={className} />;
}

function LeadTable({ canWrite, rows, onUpdate, onDelete, onAdd, totalCost, totalLeads, cm, accent }) {
  const accentText = { cyan: 'text-cyan-300', orange: 'text-orange-300', red: 'text-red-300' }[accent];
  const accentBg = { cyan: 'bg-cyan-500/15', orange: 'bg-orange-500/15', red: 'bg-red-500/15' }[accent];
  const sorted = [...rows].sort((a, b) => (a.position || 0) - (b.position || 0));
  const box = (val, focus) => `w-full h-9 flex items-center justify-end rounded-lg border px-2 text-right text-sm font-semibold tabular-nums outline-none transition border-slate-700/70 bg-slate-800/60 ${Number(val) > 0 ? 'text-slate-50' : 'text-slate-500'} ${focus === 'amber' ? 'focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30' : 'focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'} focus:bg-slate-800`;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="border-separate" style={{ borderSpacing: '0 6px', minWidth: '100%' }}>
        <thead><tr>
          <th className="text-left text-xs font-medium text-slate-400 pb-1 pl-1 sticky left-0 bg-slate-900 z-10 min-w-[120px]">Source</th>
          <th className="w-28 pb-1 text-right text-xs font-semibold text-amber-300 pr-2">Coût</th><th className="w-20 pb-1 text-right text-xs font-semibold text-slate-200 pr-2">Leads</th><th className="w-24 pb-1 text-right text-xs font-semibold text-slate-400 pr-1">€/Lead</th><th className="w-7"></th>
        </tr></thead>
        <tbody>
          {sorted.map(r => { const cpl = r.leads > 0 ? r.cost / r.leads : 0; return (
            <tr key={r.id} className="group">
              <td className="sticky left-0 bg-slate-900 z-10 pr-2 pl-1"><DebouncedInput readOnly={!canWrite} value={r.source_name} onCommit={(v) => onUpdate(r.id, { source_name: v })} className="w-full h-9 flex items-center bg-transparent text-slate-100 text-sm font-medium px-1 rounded-md outline-none truncate focus:bg-slate-800 focus:ring-1 focus:ring-slate-600" /></td>
              <td className="px-1"><DebouncedInput readOnly={!canWrite} type="number" step="0.01" value={r.cost} onCommit={(v) => onUpdate(r.id, { cost: v })} className={box(r.cost, 'amber')} /></td>
              <td className="px-1"><DebouncedInput readOnly={!canWrite} type="number" value={r.leads} onCommit={(v) => onUpdate(r.id, { leads: v })} className={box(r.leads, 'cyan')} /></td>
              <td className={`text-right pr-1 text-sm tabular-nums whitespace-nowrap ${cpl > 0 ? 'text-slate-300' : 'text-slate-600'}`}>{cpl > 0 ? fmtEur(cpl) : '—'}</td>
              <td className="text-center">{canWrite && <button onClick={() => onDelete(r.id)} className="md:opacity-0 md:group-hover:opacity-100 text-rose-400 hover:text-rose-300 p-1 transition" title="Supprimer"><Trash2 size={14} /></button>}</td>
            </tr>); })}
          <tr>
            <td className={`sticky left-0 bg-slate-900 z-10 pl-1 pr-2 text-xs font-bold uppercase tracking-wide ${accentText}`}>Total</td>
            <td className="px-1"><div className={`h-8 flex items-center justify-end px-2 rounded-lg text-sm font-black tabular-nums ${accentBg} text-slate-50`}>{fmtEur(totalCost)}</div></td>
            <td className="px-1"><div className={`h-8 flex items-center justify-end px-2 rounded-lg text-sm font-black tabular-nums ${accentBg} text-slate-50`}>{totalLeads}</div></td>
            <td className="text-right pr-1 text-sm font-bold tabular-nums text-slate-200 whitespace-nowrap">{fmtEur(cm)}</td><td></td>
          </tr>
          <tr><td colSpan={5}><div className="mt-1 flex items-center justify-between rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700/50"><span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Coût moyen du lead</span><span className="text-base font-black tabular-nums text-slate-100">{fmtEur(cm)}</span></div></td></tr>
        </tbody>
      </table>
      {canWrite && <button onClick={onAdd} className="mt-1 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><Plus size={12} /> Ajouter une source</button>}
    </div>
  );
}

function SalesTable({ canWrite, rows, onUpdate, onDelete, onAdd, totalCA, marge, margePct, todayIdx = -1, dayDates = [] }) {
  const sorted = [...rows].sort((a, b) => (a.position || 0) - (b.position || 0));
  const sumDay = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const grandTotal = rows.reduce((s, r) => s + rowDays(r), 0);
  const inWeek = (i) => dayDates.length === 0 || dayDates[i] !== null;
  const isToday = (i) => i === todayIdx;
  const cellBox = (val, i) => `w-11 h-9 mx-auto flex items-center justify-center rounded-lg border text-center text-[15px] font-semibold tabular-nums transition outline-none ${isToday(i) ? 'border-cyan-500/70 bg-cyan-500/10' : 'border-slate-700/70 bg-slate-800/60'} ${Number(val) > 0 ? 'text-slate-50' : 'text-slate-500'} focus:border-cyan-400 focus:bg-slate-800 focus:ring-2 focus:ring-cyan-500/30`;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="border-separate" style={{ borderSpacing: '0 6px', minWidth: '100%' }}>
        <thead><tr>
          <th className="text-left text-xs font-medium text-slate-400 pb-1 pl-1 sticky left-0 bg-slate-900 z-10 min-w-[130px]">Client</th>
          {DAYS.map((d, i) => <th key={i} className={`w-12 pb-1 text-center align-bottom ${inWeek(i) ? '' : 'opacity-35'}`}><div className={`inline-flex flex-col items-center leading-tight px-1.5 py-0.5 rounded-md ${isToday(i) ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300'}`}><span className="text-[11px] font-semibold uppercase">{d.label}</span>{dayDates[i] && <span className={`text-[10px] ${isToday(i) ? 'text-cyan-300' : 'text-slate-500'}`}>{dayDates[i]}</span>}</div></th>)}
          <th className="w-14 pb-1 text-center text-xs font-semibold text-slate-200">Total</th><th className="w-20 pb-1 text-center text-xs font-semibold text-amber-300">€/Lead</th><th className="w-24 pb-1 text-right text-xs font-semibold text-emerald-300 pr-1">CA</th><th className="w-7"></th>
        </tr></thead>
        <tbody>
          {sorted.map(r => { const total = rowDays(r); const ppl = Number(r.price_per_lead) || 0; const ca = total * ppl; return (
            <tr key={r.id} className="group">
              <td className="sticky left-0 bg-slate-900 z-10 pr-2 pl-1"><DebouncedInput readOnly={!canWrite} value={r.client_name} onCommit={(v) => onUpdate(r.id, { client_name: v })} className="w-full h-9 flex items-center bg-transparent text-slate-100 text-sm font-medium px-1 rounded-md outline-none truncate focus:bg-slate-800 focus:ring-1 focus:ring-slate-600" /></td>
              {DAYS.map((d, i) => <td key={i} className={`px-0.5 ${inWeek(i) ? '' : 'opacity-35'}`}><DebouncedInput readOnly={!canWrite} type="number" value={r[d.key]} onCommit={(v) => onUpdate(r.id, { [d.key]: v })} className={cellBox(r[d.key], i)} /></td>)}
              <td className="px-1"><div className={`h-9 flex items-center justify-center rounded-lg text-[15px] font-bold tabular-nums ${total > 0 ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30' : 'bg-slate-800/40 text-slate-500 border border-slate-800'}`}>{total}</div></td>
              <td className="px-1"><DebouncedInput readOnly={!canWrite} type="number" step="0.01" value={r.price_per_lead || 0} onCommit={(v) => onUpdate(r.id, { price_per_lead: v, ca: total * v })} className={`w-full h-9 flex items-center justify-center rounded-lg border text-center text-sm font-semibold tabular-nums outline-none transition ${ppl > 0 ? 'border-amber-600/50 bg-amber-500/10 text-amber-200' : 'border-slate-700/70 bg-slate-800/60 text-slate-500'} focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30`} /></td>
              <td className={`text-right pr-1 text-sm font-bold tabular-nums whitespace-nowrap ${ca > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>{fmtEur(ca)}</td>
              <td className="text-center">{canWrite && <button onClick={() => onDelete(r.id)} className="md:opacity-0 md:group-hover:opacity-100 text-rose-400 hover:text-rose-300 p-1 transition" title="Supprimer"><Trash2 size={14} /></button>}</td>
            </tr>); })}
          <tr>
            <td className="sticky left-0 bg-slate-900 z-10 pl-1 pr-2 text-xs font-bold uppercase tracking-wide text-emerald-300">Total</td>
            {DAYS.map((d, i) => { const v = sumDay(d.key); return <td key={i} className={`px-0.5 ${inWeek(i) ? '' : 'opacity-35'}`}><div className={`w-11 h-8 mx-auto flex items-center justify-center rounded-lg text-sm font-bold tabular-nums ${v > 0 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800/30 text-slate-600'} ${isToday(i) ? 'ring-1 ring-cyan-500/40' : ''}`}>{v}</div></td>; })}
            <td className="px-1"><div className={`h-8 flex items-center justify-center rounded-lg text-base font-black tabular-nums ${grandTotal > 0 ? 'bg-emerald-500/25 text-emerald-100' : 'bg-slate-800/40 text-slate-500'}`}>{grandTotal}</div></td>
            <td></td><td className="text-right pr-1 text-sm font-black tabular-nums text-emerald-200 whitespace-nowrap">{fmtEur(totalCA)}</td><td></td>
          </tr>
          <tr><td colSpan={DAYS.length + 5}><div className={`mt-1 flex items-center justify-between rounded-lg px-3 py-2 border ${marge >= 0 ? 'bg-emerald-900/30 border-emerald-700/40' : 'bg-rose-900/30 border-rose-700/40'}`}><span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Marge auto <span className="text-slate-500 normal-case font-normal">(CA − coût leads)</span></span><span className={`text-base font-black tabular-nums ${marge >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtEur(marge)} <span className="text-xs font-semibold opacity-80">({fmtPct(margePct)})</span></span></div></td></tr>
        </tbody>
      </table>
      {canWrite && <button onClick={onAdd} className="mt-1 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><Plus size={12} /> Ajouter un client</button>}
    </div>
  );
}

// ============== UI ==============
const KPI_COLORS = { cyan: 'from-cyan-900/40 to-cyan-800/10 border-cyan-700/40 text-cyan-300', amber: 'from-amber-900/40 to-amber-800/10 border-amber-700/40 text-amber-300', emerald: 'from-emerald-900/40 to-emerald-800/10 border-emerald-700/40 text-emerald-300', rose: 'from-rose-900/40 to-rose-800/10 border-rose-700/40 text-rose-300', violet: 'from-violet-900/40 to-violet-800/10 border-violet-700/40 text-violet-300' };
function KPI({ icon, label, value, sub, color, delta = null, inverse = false }) {
  const good = delta === null ? null : (inverse ? delta < 0 : delta > 0);
  const Icon = delta === null || delta === 0 ? Minus : (delta > 0 ? ArrowUpRight : ArrowDownRight);
  return (
    <div className={`bg-gradient-to-br ${KPI_COLORS[color]} rounded-xl border p-4 shadow-lg`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80 mb-1">{icon}<span>{label}</span></div>
      <div className="text-xl md:text-2xl font-bold text-slate-100 tabular-nums">{value}</div>
      <div className="flex items-center justify-between mt-1 min-h-[16px]">
        {sub ? <span className="text-[11px] text-slate-400">{sub}</span> : <span />}
        {delta !== null && <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${delta === 0 ? 'text-slate-400 bg-slate-800/60' : good ? 'text-emerald-300 bg-emerald-900/40' : 'text-rose-300 bg-rose-900/40'}`}><Icon size={12} />{Math.abs(delta).toFixed(0)}%</span>}
      </div>
    </div>
  );
}
function Card({ title, accent, icon, children }) {
  const accents = { cyan: 'border-cyan-700/40', orange: 'border-orange-700/40', emerald: 'border-emerald-700/40', fuchsia: 'border-fuchsia-700/40', indigo: 'border-indigo-700/40', red: 'border-red-700/40' };
  const titleColors = { cyan: 'text-cyan-300', orange: 'text-orange-300', emerald: 'text-emerald-300', fuchsia: 'text-fuchsia-300', indigo: 'text-indigo-300', red: 'text-red-300' };
  return <div className={`bg-slate-900/50 rounded-2xl border ${accents[accent]} p-4 md:p-5 shadow-xl`}><div className="flex items-center gap-2 mb-4"><span className="text-xl">{icon}</span><h2 className={`text-lg font-bold ${titleColors[accent]}`}>{title}</h2></div>{children}</div>;
}
function MargeRow({ label, ca, cost, marge, pct }) { return <tr className="border-b border-violet-900/30 hover:bg-violet-900/20"><td className="py-2 px-3 text-violet-200 font-medium">{label}</td><td className="py-2 px-3 text-right">{fmtEur(ca)}</td><td className="py-2 px-3 text-right">{fmtEur(cost)}</td><td className={`py-2 px-3 text-right font-medium ${margeColor(marge)}`}>{fmtEur(marge)}</td><td className={`py-2 px-3 text-right font-medium ${margeColor(pct)}`}>{fmtPct(pct)}</td></tr>; }
function Pill({ label, value, color }) { const c = { cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-700/30', amber: 'bg-amber-500/10 text-amber-300 border-amber-700/30', emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-700/30', rose: 'bg-rose-500/10 text-rose-300 border-rose-700/30', violet: 'bg-violet-500/10 text-violet-300 border-violet-700/30' }; return <div className={`px-2 py-0.5 rounded-md border text-xs font-medium ${c[color]}`}><span className="opacity-70 mr-1">{label}</span><span>{value}</span></div>; }
function DetailRow({ label, value, highlight }) { return <div className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0"><span className="text-sm text-slate-400">{label}</span><span className={`font-medium ${highlight !== undefined ? margeColor(highlight) : 'text-slate-100'}`}>{value}</span></div>; }
function MonthlyBarChart({ data }) {
  const w = 700, h = 280, pad = { l: 50, r: 20, t: 20, b: 50 };
  const max = Math.max(...data.map(d => Math.max(d.ca, d.cost, Math.abs(d.marge)))); const min = Math.min(0, ...data.map(d => d.marge)); const range = max - min || 1;
  const groupW = (w - pad.l - pad.r) / data.length; const barW = Math.min(20, groupW / 4);
  const y = (v) => pad.t + ((max - v) / range) * (h - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ minWidth: 500 }}>
        {ticks.map((v, i) => <g key={i}><line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="#334155" strokeDasharray="2,3" /><text x={pad.l - 8} y={y(v) + 3} fill="#64748b" fontSize="10" textAnchor="end">{fmtEurShort(v)}</text></g>)}
        {min < 0 && <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke="#475569" strokeWidth="1.5" />}
        {data.map((d, i) => { const cx = pad.l + (i + 0.5) * groupW; return <g key={i} opacity={d.isSelected ? 1 : 0.5}>
          <rect x={cx - barW * 1.5} y={y(Math.max(0, d.ca))} width={barW} height={Math.abs(y(d.ca) - y(0))} fill="#22d3ee" rx="2" /><rect x={cx - barW * 0.5} y={y(Math.max(0, d.cost))} width={barW} height={Math.abs(y(d.cost) - y(0))} fill="#fbbf24" rx="2" /><rect x={cx + barW * 0.5} y={d.marge >= 0 ? y(d.marge) : y(0)} width={barW} height={Math.abs(y(d.marge) - y(0))} fill={d.marge >= 0 ? '#34d399' : '#f87171'} rx="2" />
          <text x={cx} y={h - pad.b + 16} fill={d.isSelected ? '#cbd5e1' : '#94a3b8'} fontSize="11" textAnchor="middle" fontWeight={d.isSelected ? 'bold' : 'normal'}>{d.label}</text></g>; })}
      </svg>
      <div className="flex flex-wrap gap-4 justify-center mt-3 text-xs">{[['#22d3ee', 'CA'], ['#fbbf24', 'Coût'], ['#34d399', 'Marge +'], ['#f87171', 'Marge −']].map(([c, l]) => <div key={l} className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: c }}></div><span className="text-slate-400">{l}</span></div>)}</div>
    </div>
  );
}
