
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Package, Calendar, CheckCircle, User, Users, Search, X, Ban, History, Plus, ArrowLeft, Info, UserCheck, Clock, ChevronRight, AlertTriangle, Trash2, FileDown } from 'lucide-react';
import { Delivery, Family } from '../types';
import { addDelivery, deleteDeliveryByFamilyAndDate } from '../db';
import { generateDeliveriesPDF } from '../utils/pdfUtils';


interface DeliveryManagerProps {
  deliveries: Delivery[];
  families: Family[];
  onRefresh: () => void;
}

const DeliveryManager: React.FC<DeliveryManagerProps> = ({ deliveries, families, onRefresh }) => {
  const [view, setView] = useState<'history' | 'new-delivery'>('history');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Delivery | null>(null);
  const [deliveryToUndo, setDeliveryToUndo] = useState<{ delivery: Delivery; familyName: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState('');
  const [selectedType, setSelectedType] = useState('Cesta Básica (Padrão)');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const activeFamiliesSorted = useMemo(() => {
    return families
      .filter(f => f.status === 'Ativo' && (f.nomeAssistido.toLowerCase().includes(searchTerm.toLowerCase()) || f.ficha.includes(searchTerm)))
      .sort((a, b) => a.nomeAssistido.localeCompare(b.nomeAssistido));
  }, [families, searchTerm]);

  const dayDeliveriesMap = useMemo(() => {
    const map = new Map<string, Delivery>();
    deliveries.filter(d => d.data === selectedDate).forEach(d => map.set(d.familyId, d));
    return map;
  }, [deliveries, selectedDate]);

  // Filtrar e ordenar entregas do histórico
  const filteredHistory = useMemo(() => {
    return deliveries
      .filter(d => {
        if (!searchHistory) return true;
        const familyName = families.find(f => f.id === d.familyId)?.nomeAssistido?.toLowerCase() || '';
        const dateStr = new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR').toLowerCase();
        const status = d.status?.toLowerCase() || '';
        const searchLower = searchHistory.toLowerCase();
        return familyName.includes(searchLower) || dateStr.includes(searchLower) || status.includes(searchLower);
      })
      .sort((a,b) => b.data.localeCompare(a.data));
  }, [deliveries, families, searchHistory]);

  // Paginação
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = itemsPerPage === -1 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === -1 ? filteredHistory.length : startIndex + itemsPerPage;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  // Resetar página quando mudar filtro ou itens por página
  useEffect(() => {
    setCurrentPage(1);
  }, [searchHistory, itemsPerPage]);

  const handleMarkAsDelivered = (family: Family, status: 'Entregue' | 'Não Entregue', retiradoPor?: 'Próprio' | 'Outros', detalhe?: string) => {
    const newDelivery: Delivery = {
      id: Date.now().toString(),
      familyId: family.id,
      data: selectedDate,
      tipo: selectedType,
      responsavel: 'Vicentino',
      status: status,
      retiradoPor: status === 'Entregue' ? retiradoPor : undefined,
      retiradoPorDetalhe: detalhe,
      observacoes: status === 'Entregue' ? `Entregue para ${retiradoPor === 'Próprio' ? 'Próprio' : detalhe}` : `Falta: ${detalhe || 'Não compareceu'}`
    };
    (async () => {
      try {
        await addDelivery(newDelivery);
        onRefresh();
      } catch (e: any) {
        alert(e?.message || 'Falha ao registrar entrega.');
      }
    })();
  };

  const handleUndoDelivery = (familyId: string) => {
    const delivery = deliveries.find(d => d.familyId === familyId && d.data === selectedDate);
    if (delivery) {
      const familyName = getFamilyName(familyId);
      setDeliveryToUndo({ delivery, familyName });
    }
  };

  const handleConfirmUndoDelivery = async () => {
    if (!deliveryToUndo) return;
    (async () => {
      try {
        await deleteDeliveryByFamilyAndDate(deliveryToUndo.delivery.familyId, deliveryToUndo.delivery.data);
        setDeliveryToUndo(null);
        setSelectedHistoryItem(null);
        onRefresh();
      } catch (e: any) {
        alert(e?.message || 'Falha ao estornar entrega.');
      }
    })();
  };

  const getFamilyName = (familyId: string) => {
    return families.find(f => f.id === familyId)?.nomeAssistido || 'Família não encontrada';
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Modal de Confirmação de Estorno */}
      {deliveryToUndo && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h4 className="text-2xl font-black text-slate-800 mb-4">Confirmar Estorno de Entrega</h4>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                <p className="text-slate-700 text-base font-semibold mb-2">
                  Você tem certeza que deseja estornar a entrega de:
                </p>
                <p className="text-rose-700 text-lg font-black mb-1">
                  "{deliveryToUndo.familyName}"
                </p>
                <p className="text-slate-600 text-sm">
                  Data: {new Date(deliveryToUndo.delivery.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
                <p className="text-slate-600 text-sm">
                  Tipo: {deliveryToUndo.delivery.tipo}
                </p>
              </div>
              <p className="text-rose-600 text-xs font-bold">
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setDeliveryToUndo(null)} 
                className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all"
              >
                Não, cancelar
              </button>
              <button 
                onClick={handleConfirmUndoDelivery}
                className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Sim, estornar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Modal de Detalhes da Entrega */}
      {selectedHistoryItem && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-orange-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Package size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Detalhes da Entrega</h4>
                  <p className="text-white/80 text-xs uppercase font-bold tracking-widest">
                    {getFamilyName(selectedHistoryItem.familyId)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedHistoryItem(null)} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Data da Entrega</label>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Calendar size={16} className="text-orange-500" />
                    {new Date(selectedHistoryItem.data + 'T00:00:00').toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Tipo de Entrega</label>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Package size={16} className="text-orange-500" />
                    {selectedHistoryItem.tipo}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Status</label>
                  <div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${
                      selectedHistoryItem.status === 'Entregue' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {selectedHistoryItem.status || 'Não definido'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Responsável</label>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <User size={16} className="text-orange-500" />
                    {selectedHistoryItem.responsavel}
                  </div>
                </div>
                {selectedHistoryItem.retiradoPor && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Retirado Por</label>
                    <div className="flex items-center gap-2 text-slate-800 font-semibold">
                      <UserCheck size={16} className="text-orange-500" />
                      {selectedHistoryItem.retiradoPor === 'Próprio' ? 'Próprio' : 'Terceiros'}
                    </div>
                  </div>
                )}
                {selectedHistoryItem.retiradoPorDetalhe && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Detalhe de Quem Retirou</label>
                    <div className="text-slate-800 font-semibold">
                      {selectedHistoryItem.retiradoPorDetalhe}
                    </div>
                  </div>
                )}
              </div>
              {selectedHistoryItem.observacoes && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Observações</label>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-slate-700 text-sm leading-relaxed">
                      {selectedHistoryItem.observacoes}
                    </p>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => {
                    setDeliveryToUndo({ 
                      delivery: selectedHistoryItem, 
                      familyName: getFamilyName(selectedHistoryItem.familyId) 
                    });
                  }}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2"
                >
                  <Ban size={18} /> Estornar Entrega
                </button>
                <button 
                  onClick={() => setSelectedHistoryItem(null)} 
                  className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-300 transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {view === 'history' ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex items-center gap-3">
              <History className="text-blue-600" size={24} />
              <h3 className="text-xl font-bold">Histórico de Atendimento</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  try {
                    generateDeliveriesPDF(deliveries, families);
                  } catch (error) {
                    console.error('Erro ao gerar PDF:', error);
                    alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
                  }
                }}
                className="flex items-center justify-center w-10 h-10 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-md shadow-purple-100"
                title="Download PDF - Lista de Entregas"
              >
                <FileDown size={20} />
              </button>
              <button onClick={() => setView('new-delivery')} className="flex items-center justify-center w-10 h-10 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-all shadow-md shadow-orange-100" title="Nova Entrega">
                <Plus size={20} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" 
              placeholder="Buscar por família ou data..."
            />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Data</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Família</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedHistory.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedHistoryItem(d)}>
                    <td className="px-6 py-4 text-sm font-medium">{new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 text-sm font-bold">{families.find(f => f.id === d.familyId)?.nomeAssistido}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === 'Entregue' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right"><Info size={16} className="text-slate-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Controles de Paginação */}
          {filteredHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 font-medium">Itens por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>Todos</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">
                  Mostrando <span className="font-bold text-slate-800">{startIndex + 1}</span> a{' '}
                  <span className="font-bold text-slate-800">{Math.min(endIndex, filteredHistory.length)}</span> de{' '}
                  <span className="font-bold text-slate-800">{filteredHistory.length}</span>
                </span>
                {itemsPerPage !== -1 && totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="text-sm text-slate-600 font-semibold">
                      Página <span className="text-slate-800">{currentPage}</span> de <span className="text-slate-800">{totalPages}</span>
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('history')} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={20}/></button>
              <h3 className="text-xl font-bold">Registrar Entregas</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
               <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                 <option>Cesta Básica (Padrão)</option>
                 <option>Cesta Especial</option>
                 <option>Leite</option>
                 <option>Fraldas</option>
               </select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Buscar família..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Família</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Status Hoje</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeFamiliesSorted.map(family => (
                  <FamilyListRow 
                    key={family.id} 
                    family={family} 
                    recordedDelivery={dayDeliveriesMap.get(family.id)} 
                    onDeliver={handleMarkAsDelivered} 
                    onUndo={() => handleUndoDelivery(family.id)} 
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

type FamilyListRowProps = {
  family: Family;
  recordedDelivery?: Delivery;
  onDeliver: (family: Family, status: 'Entregue' | 'Não Entregue', retiradoPor?: 'Próprio' | 'Outros', detalhe?: string) => void;
  onUndo: () => void;
};

const FamilyListRow: React.FC<FamilyListRowProps> = ({ family, recordedDelivery, onDeliver, onUndo }) => {
  const [isExpanding, setIsExpanding] = useState(false);
  const [step, setStep] = useState<'status' | 'detail'>('status');
  const [retiradoPor, setRetiradoPor] = useState<'Próprio' | 'Outros' | null>(null);

  const reset = () => { setIsExpanding(false); setStep('status'); setRetiradoPor(null); };

  return (
    <>
      <tr onClick={() => !recordedDelivery && setIsExpanding(true)} className={`cursor-pointer transition-colors ${recordedDelivery ? (recordedDelivery.status === 'Entregue' ? 'bg-emerald-50/30' : 'bg-rose-50/30') : 'hover:bg-slate-50'}`}>
        <td className="px-6 py-4 font-bold text-slate-800">{family.nomeAssistido}</td>
        <td className="px-6 py-4">
          {!recordedDelivery ? <span className="text-[10px] font-bold text-slate-400 uppercase">Pendente</span> : 
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${recordedDelivery.status === 'Entregue' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{recordedDelivery.status}</span>}
        </td>
        <td className="px-6 py-4 text-right">
          {recordedDelivery ? <button onClick={e => { e.stopPropagation(); onUndo(); }} className="text-[10px] font-bold text-rose-600 uppercase border border-rose-200 px-3 py-1 rounded-lg">Estornar</button> : <ChevronRight size={18} className="text-slate-300" />}
        </td>
      </tr>
      {isExpanding && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-lg">Registrar Entrega: {family.nomeAssistido}</h4>
              <button onClick={reset}><X size={24}/></button>
            </div>
            {step === 'status' ? (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setStep('detail')} className="p-6 bg-emerald-50 text-emerald-700 rounded-2xl font-bold flex flex-col items-center gap-2"><CheckCircle size={32}/> Entregue</button>
                <button onClick={() => { onDeliver(family, 'Não Entregue'); reset(); }} className="p-6 bg-rose-50 text-rose-700 rounded-2xl font-bold flex flex-col items-center gap-2"><Ban size={32}/> Falta</button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="font-bold text-sm uppercase text-slate-500">Quem retirou?</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setRetiradoPor('Próprio')} className={`p-4 border-2 rounded-xl font-bold ${retiradoPor === 'Próprio' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 text-slate-600'}`}>Próprio</button>
                  <button onClick={() => setRetiradoPor('Outros')} className={`p-4 border-2 rounded-xl font-bold ${retiradoPor === 'Outros' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 text-slate-600'}`}>Terceiros</button>
                </div>
                <button disabled={!retiradoPor} onClick={() => { onDeliver(family, 'Entregue', retiradoPor!); reset(); }} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50">Confirmar</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default DeliveryManager;
