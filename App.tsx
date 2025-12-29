
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Users, Footprints, Package, Menu, X, User, LogOut, Save, ArrowLeft, Database } from 'lucide-react';
import { AppView, UserProfile } from './types';
import { fetchDb, getSession, getUserProfile, saveUserProfile, signOut, type DbState } from './db';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import FamilyManager from './components/FamilyManager';
import VisitManager from './components/VisitManager';
import DeliveryManager from './components/DeliveryManager';
import Auth from './components/Auth';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const savedView = localStorage.getItem('ssvp_currentView');
    return (savedView as AppView) || 'dashboard';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [data, setData] = useState<DbState>({ families: [], members: [], visits: [], deliveries: [] });
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(getUserProfile());
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(() => {
    return localStorage.getItem('ssvp_selectedFamilyId');
  });
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [editName, setEditName] = useState(userProfile.name);
  const [editConference, setEditConference] = useState(userProfile.conference);

  const reload = async () => {
    if (!session) return;
    setIsDataLoading(true);
    try {
      const db = await fetchDb();
      setData(db);
    } catch (e) {
      console.error(e);
      alert('Falha ao carregar dados do Supabase. Verifique a conexão e o schema.');
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const s = await getSession();
        if (cancelled) return;
        if (s) {
          setSession(s);
          updateProfileFromSession(s);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) updateProfileFromSession(newSession);
      if (!newSession) setData({ families: [], members: [], visits: [], deliveries: [] });
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const updateProfileFromSession = (session: any) => {
    const meta = session.user.user_metadata;
    if (meta) {
      const name = meta.full_name || 'Vicentino';
      const conference = meta.conference || 'Conferência SSVP';
      const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
      const newProfile = { name, conference, initials };
      setUserProfile(newProfile);
      setEditName(name);
      setEditConference(conference);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setSession(null);
    setIsUserMenuOpen(false);
    // Limpar localStorage ao fazer logout
    localStorage.removeItem('ssvp_currentView');
    localStorage.removeItem('ssvp_selectedFamilyId');
  };

  // Salvar currentView no localStorage sempre que mudar
  useEffect(() => {
    if (session) {
      localStorage.setItem('ssvp_currentView', currentView);
    }
  }, [currentView, session]);

  // Salvar selectedFamilyId no localStorage sempre que mudar
  useEffect(() => {
    if (selectedFamilyId) {
      localStorage.setItem('ssvp_selectedFamilyId', selectedFamilyId);
    } else {
      localStorage.removeItem('ssvp_selectedFamilyId');
    }
  }, [selectedFamilyId]);

  useEffect(() => {
    if (session) void reload();
  }, [session]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const initials = editName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const newProfile = {
      name: editName,
      conference: editConference,
      initials: initials || 'V'
    };
    await saveUserProfile(newProfile);
    setUserProfile(newProfile);
    setIsEditProfileModalOpen(false);
    setIsUserMenuOpen(false);
  };

  const navigation = [
    { name: 'Painel', view: 'dashboard', icon: LayoutDashboard },
    { name: 'Famílias', view: 'families', icon: Users },
    { name: 'Visitas', view: 'visits', icon: Footprints },
    { name: 'Entregas', view: 'deliveries', icon: Package },
  ];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth onSuccess={(newSession) => setSession(newSession)} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            data={data} 
            onViewFamilies={() => setCurrentView('families')} 
            onViewVisits={() => setCurrentView('visits')}
            onViewDeliveries={() => setCurrentView('deliveries')}
          />
        );
      case 'families':
        return (
          <FamilyManager 
            families={data.families} 
            members={data.members}
            onViewDetails={(id) => {
              setSelectedFamilyId(id);
              setCurrentView('family-details');
            }}
            onRefresh={() => void reload()}
          />
        );
      case 'family-details':
        const family = data.families.find(f => f.id === selectedFamilyId);
        if (!family) {
          // Se a família não for encontrada, voltar para a lista
          setCurrentView('families');
          return <div className="p-8 text-center text-slate-500">Família não encontrada</div>;
        }
        return (
          <div className="space-y-6">
            <button 
              onClick={() => setCurrentView('families')}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"
            >
              <ArrowLeft size={16} /> Voltar para lista
            </button>
            <FamilyManager 
              viewMode="details" 
              family={family} 
              members={data.members.filter(m => m.familyId === family.id)}
              visits={data.visits.filter(v => v.familyId === family.id)}
              deliveries={data.deliveries.filter(d => d.familyId === family.id)}
              onRefresh={() => void reload()}
            />
          </div>
        );
      case 'visits':
        return <VisitManager visits={data.visits} families={data.families} members={data.members} onRefresh={() => void reload()} />;
      case 'deliveries':
        return <DeliveryManager deliveries={data.deliveries} families={data.families} onRefresh={() => void reload()} />;
      default:
        return <Dashboard data={data} onViewFamilies={() => setCurrentView('families')} onViewVisits={() => setCurrentView('visits')} onViewDeliveries={() => setCurrentView('deliveries')} />;
    }
  };

  return (
    <div className="h-full w-full flex bg-slate-50 overflow-hidden">
      {/* Modal Perfil */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 glass-overlay">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User size={24} />
                <h4 className="font-bold text-lg">Perfil do Usuário</h4>
              </div>
              <button onClick={() => setIsEditProfileModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="ssvp-input"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Conferência</label>
                <input 
                  type="text" 
                  value={editConference}
                  onChange={(e) => setEditConference(e.target.value)}
                  className="ssvp-input"
                  required
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditProfileModalOpen(false)} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2 py-3"><Save size={18} /> Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar Desktop/Mobile */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30 transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:static`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg">V</div>
            <div>
              <h1 className="font-bold text-slate-800 leading-tight">SSVP Brasil</h1>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight line-clamp-1">{userProfile.conference}</p>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.view}
                  onClick={() => { setCurrentView(item.view as AppView); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentView === item.view ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon size={18} />
                  {item.name}
                </button>
              );
            })}
          </nav>
          <div className="p-4 bg-slate-50 border-t border-slate-100">
             <div className="flex items-center gap-2 text-slate-400">
                <Database size={12} />
                <span className="text-[10px] font-bold uppercase">{isDataLoading ? 'Sincronizando...' : 'Supabase Ativo'}</span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-600" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold text-slate-800 capitalize">
              {navigation.find(n => n.view === currentView)?.name || 'Perfil'}
            </h2>
          </div>
          <div className="relative" ref={userMenuRef}>
            <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200 hover:border-blue-300 transition-all">
              {userProfile.initials}
            </button>
            {isUserMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 animate-fade-in">
                <button onClick={() => { setIsEditProfileModalOpen(true); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg">
                  <User size={16} /> Meu Perfil
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg">
                  <LogOut size={16} /> Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {renderView()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
