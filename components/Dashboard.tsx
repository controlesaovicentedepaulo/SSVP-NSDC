
import React, { useState, useMemo } from 'react';
import { Users, Footprints, Package, TrendingUp, BarChart3, HeartHandshake } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Family, Visit, Delivery } from '../types';

interface DashboardProps {
  data: {
    families: Family[];
    visits: Visit[];
    deliveries: Delivery[];
  };
  onViewFamilies: () => void;
  onViewVisits: () => void;
  onViewDeliveries: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  onViewFamilies, 
  onViewVisits, 
  onViewDeliveries
}) => {
  const [period, setPeriod] = useState<'6months' | 'year'>('6months');

  const activeFamiliesCount = data.families.filter(f => f.status === 'Ativo').length;
  const recentVisits = data.visits.length;
  const deliveriesCount = data.deliveries.length;

  // Lógica para contar famílias que buscaram cestas no mês atual
  const now = new Date();
  const currentMonthPrefix = now.toISOString().slice(0, 7); // "YYYY-MM"
  
  const deliveriesThisMonth = data.deliveries.filter(d => 
    d.data.startsWith(currentMonthPrefix) && 
    d.tipo.toLowerCase().includes('cesta')
  );
  
  const uniqueFamiliesThisMonth = new Set(deliveriesThisMonth.map(d => d.familyId)).size;

  const stats = [
    { 
      label: 'Famílias Ativas', 
      value: activeFamiliesCount, 
      icon: Users, 
      color: 'bg-blue-500', 
      trend: 'No cadastro' 
    },
    { 
      label: 'Atendidas (Mês)', 
      value: uniqueFamiliesThisMonth, 
      icon: HeartHandshake, 
      color: 'bg-rose-500', 
      trend: 'Cestas básicas' 
    },
    { 
      label: 'Visitas (Total)', 
      value: recentVisits, 
      icon: Footprints, 
      color: 'bg-emerald-500', 
      trend: 'Acompanhamento' 
    },
    { 
      label: 'Cestas Entregues', 
      value: deliveriesCount, 
      icon: Package, 
      color: 'bg-orange-500', 
      trend: 'Histórico total' 
    },
  ];

  // Função para calcular dados mensais reais
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    let monthsToShow: { month: number; year: number; name: string }[] = [];
    
    if (period === '6months') {
      // Últimos 6 meses
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        monthsToShow.push({
          month: date.getMonth(),
          year: date.getFullYear(),
          name: months[date.getMonth()]
        });
      }
    } else {
      // Este ano (todos os meses até o mês atual)
      for (let i = 0; i <= currentMonth; i++) {
        monthsToShow.push({
          month: i,
          year: currentYear,
          name: months[i]
        });
      }
    }

    return monthsToShow.map(({ month, year, name }) => {
      const monthStr = String(month + 1).padStart(2, '0');
      const yearMonthPrefix = `${year}-${monthStr}`;
      
      // Contar cestas entregues neste mês
      const cestasNoMes = data.deliveries.filter(d => 
        d.data.startsWith(yearMonthPrefix) && 
        d.tipo.toLowerCase().includes('cesta')
      ).length;
      
      // Contar famílias ativas cadastradas até este mês (crescimento acumulado)
      const familiasAtivasAteMes = data.families.filter(f => {
        if (f.status !== 'Ativo') return false;
        if (!f.dataCadastro) {
          // Se não tem data de cadastro, considera como cadastrada antes do período
          return true;
        }
        try {
          const cadastroDate = new Date(f.dataCadastro);
          return cadastroDate.getFullYear() < year || 
                 (cadastroDate.getFullYear() === year && cadastroDate.getMonth() <= month);
        } catch {
          // Se houver erro ao parsear a data, considera como cadastrada antes
          return true;
        }
      }).length;
      
      return {
        name,
        cestas: cestasNoMes,
        ativas: familiasAtivasAteMes
      };
    });
  }, [data.deliveries, data.families, period]);

  const statusData = [
    { name: 'Ativo', value: activeFamiliesCount },
    { name: 'Inativo', value: data.families.filter(f => f.status === 'Inativo').length },
    { name: 'Pendente', value: data.families.filter(f => f.status === 'Pendente').length },
  ];

  const COLORS = ['#3b82f6', '#94a3b8', '#fbbf24'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-xl text-white`}>
                <stat.icon size={24} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full uppercase tracking-wider">{stat.trend}</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
            <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-slate-800">Atividades Recentes</h3>
              <p className="text-xs text-slate-400 font-medium">Cestas Entregues vs. Crescimento de Famílias</p>
            </div>
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value as '6months' | 'year')}
              className="text-sm border-slate-200 rounded-lg bg-slate-50 px-2 py-1 focus:outline-none"
            >
              <option value="6months">Últimos 6 meses</option>
              <option value="year">Este ano</option>
            </select>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="cestas" name="Cestas Entregues" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="ativas" name="Famílias Ativas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-8">Status das Famílias</h3>
          <div className="h-64 flex flex-col items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 w-full">
              {statusData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}} />
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-800">Ações Rápidas</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <button onClick={onViewFamilies} className="p-4 border border-blue-100 bg-blue-50/50 rounded-xl hover:bg-blue-50 transition-colors flex flex-col items-center gap-2 text-blue-700">
            <Users size={24} />
            <span className="text-xs font-semibold text-center">Nova Família</span>
          </button>
          <button onClick={onViewVisits} className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl hover:bg-emerald-50 transition-colors flex flex-col items-center gap-2 text-emerald-700">
            <Footprints size={24} />
            <span className="text-xs font-semibold text-center">Registrar Visita</span>
          </button>
          <button onClick={onViewDeliveries} className="p-4 border border-orange-100 bg-orange-50/50 rounded-xl hover:bg-orange-50 transition-colors flex flex-col items-center gap-2 text-orange-700">
            <Package size={24} />
            <span className="text-xs font-semibold text-center">Nova Entrega</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
