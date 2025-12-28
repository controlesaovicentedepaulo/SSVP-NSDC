
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Footprints, Plus, Search, Calendar, User, MessageCircle, Edit, X, ChevronDown, Check, Info, ShieldCheck, UserCog, Trash2, AlertTriangle, FileDown } from 'lucide-react';
import { Visit, Family, Member } from '../types';
import { addVisit, updateFamily, updateVisit, deleteVisit } from '../db';
import { generateVisitsPDF } from '../utils/pdfUtils';

import FamilyManager from './FamilyManager';

interface VisitManagerProps {
  visits: Visit[];
  families: Family[];
  members: Member[];
  onRefresh: () => void;
}

const VisitManager: React.FC<VisitManagerProps> = ({ visits, families, members, onRefresh }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<Visit | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [searchVisits, setSearchVisits] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Estados para o Searchable Select
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Novos estados para Motivo e Status
  const [motivo, setMotivo] = useState('');
  const [outroMotivo, setOutroMotivo] = useState('');
  const [newFamilyStatus, setNewFamilyStatus] = useState<Family['status']>('Ativo');

  // Estado para o Modal de Atualização de Cadastro
  const [isUpdatingFamily, setIsUpdatingFamily] = useState(false);

  const getFamilyName = (id: string) => families.find(f => f.id === id)?.nomeAssistido || 'Desconhecido';

  // Filtrar visitas baseado na busca
  const filteredVisits = visits.filter(v => {
    if (!searchVisits) return true;
    const familyName = getFamilyName(v.familyId).toLowerCase();
    const motivo = v.motivo?.toLowerCase() || '';
    const relato = v.relato?.toLowerCase() || '';
    const searchLower = searchVisits.toLowerCase();
    return familyName.includes(searchLower) || motivo.includes(searchLower) || relato.includes(searchLower);
  });

  // Ordenar visitas por data (mais recente primeiro)
  const sortedVisits: Visit[] = [...filteredVisits].sort((a, b) => 
    new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  // Paginação
  const totalPages: number = itemsPerPage === -1 ? 1 : Math.ceil(sortedVisits.length / itemsPerPage);
  const startIndex: number = itemsPerPage === -1 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex: number = itemsPerPage === -1 ? sortedVisits.length : startIndex + itemsPerPage;
  const paginatedVisits: Visit[] = sortedVisits.slice(startIndex, endIndex);

  // Resetar página quando mudar filtro ou itens por página
  useEffect(() => {
    setCurrentPage(1);
  }, [searchVisits, itemsPerPage]);

  // Sincronizar estado inicial ao editar ou selecionar família
  useEffect(() => {
    if (editingVisit) {
      const fam = families.find(f => f.id === editingVisit.familyId);
      if (fam) {
        setSelectedFamily(fam);
        setNewFamilyStatus(fam.status);
      }
      
      const predefinedMotivos = ["Visita de Cadastro", "Visita de Rotina", "Visita de Emergência"];
      if (editingVisit.motivo && predefinedMotivos.includes(editingVisit.motivo)) {
        setMotivo(editingVisit.motivo);
        setOutroMotivo('');
      } else if (editingVisit.motivo) {
        setMotivo('Outros');
        setOutroMotivo(editingVisit.motivo);
      }
    } else if (selectedFamily) {
      // Quando selecionamos uma família, atualizamos o status baseado no que está no DB
      // Mas se o vicentino alterar no form, o estado newFamilyStatus prevalece
      const currentFam = families.find(f => f.id === selectedFamily.id);
      if (currentFam) {
        setNewFamilyStatus(currentFam.status);
      }
    }
  }, [editingVisit, families, selectedFamily?.id]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEdit = (visit: Visit) => {
    setEditingVisit(visit);
    setIsAdding(true);
  };

  const handleCloseForm = () => {
    setIsAdding(false);
    setEditingVisit(null);
    setSearchTerm('');
    setSelectedFamily(null);
    setMotivo('');
    setOutroMotivo('');
  };

  const handleConfirmDeleteVisit = () => {
    if (!visitToDelete) return;
    (async () => {
      try {
        await deleteVisit(visitToDelete.id);
        setVisitToDelete(null);
        onRefresh();
      } catch (e: any) {
        alert(e?.message || 'Falha ao deletar visita.');
      }
    })();
  };

  const filteredFamilies = families.filter(f => 
    f.nomeAssistido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.ficha.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Modal de Atualização de Cadastro da Família */}
      {isUpdatingFamily && selectedFamily && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
             <FamilyManager 
                initialEdit={true}
                family={selectedFamily}
                members={members.filter(m => m.familyId === selectedFamily.id)}
                onRefresh={() => {
                  onRefresh();
                }}
                onCancelEdit={() => setIsUpdatingFamily(false)}
             />
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            value={searchVisits}
            onChange={(e) => setSearchVisits(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
            placeholder="Buscar por família, motivo ou relato..."
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              try {
                generateVisitsPDF(visits, families);
              } catch (error) {
                console.error('Erro ao gerar PDF:', error);
                alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
              }
            }}
            className="flex items-center justify-center w-10 h-10 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-md shadow-purple-100"
            title="Download PDF - Lista de Visitas"
          >
            <FileDown size={20} />
          </button>
        <button 
          onClick={() => {
            setEditingVisit(null);
            setIsAdding(true);
          }}
            className="flex items-center justify-center w-10 h-10 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
            title="Registrar Visita"
        >
            <Plus size={20} />
        </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-100 shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-800">{editingVisit ? 'Editar Visita' : 'Novo Registro de Visita'}</h4>
            <button onClick={handleCloseForm} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!selectedFamily) {
              alert('Por favor, selecione uma família.');
              return;
            }
            const formData = new FormData(e.currentTarget);
            
            const finalMotivo = motivo === 'Outros' ? outroMotivo : motivo;
            
            const visitData: Visit = {
              id: editingVisit ? editingVisit.id : Date.now().toString(),
              familyId: selectedFamily.id,
              data: formData.get('data') as string,
              vicentinos: (formData.get('vicentinos') as string).split(',').map(v => v.trim()),
              relato: formData.get('relato') as string,
              motivo: finalMotivo,
              necessidadesIdentificadas: editingVisit ? editingVisit.necessidadesIdentificadas : []
            };

            (async () => {
              try {
                // Atualizar status da família se houver mudança
                if (selectedFamily.status !== newFamilyStatus) {
                  await updateFamily({
                    ...selectedFamily,
                    status: newFamilyStatus
                  });
                }

                if (editingVisit) {
                  await updateVisit(visitData);
                } else {
                  await addVisit(visitData);
                }

                handleCloseForm();
                onRefresh();
              } catch (e: any) {
                alert(e?.message || 'Falha ao salvar visita.');
              }
            })();
          }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Searchable Family Select */}
              <div className="space-y-1 relative md:col-span-2" ref={dropdownRef}>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Família Assistida</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`flex-1 p-2.5 bg-slate-50 border ${isDropdownOpen ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'} rounded-xl flex items-center justify-between cursor-pointer transition-all`}
                  >
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-slate-400" />
                      <span className={`text-sm ${selectedFamily ? 'text-slate-800 font-bold' : 'text-slate-400'}`}>
                        {selectedFamily ? selectedFamily.nomeAssistido : 'Selecione a família visitada...'}
                      </span>
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {selectedFamily && (
                    <button 
                      type="button"
                      onClick={() => setIsUpdatingFamily(true)}
                      className="px-4 py-2.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-all shrink-0"
                    >
                      <UserCog size={16} /> Atualizar Cadastro
                    </button>
                  )}
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95">
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        autoFocus
                        type="text"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Digite o nome ou ficha..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {filteredFamilies.length > 0 ? (
                        filteredFamilies.map(f => (
                          <div 
                            key={f.id}
                            onClick={() => {
                              setSelectedFamily(f);
                              setIsDropdownOpen(false);
                              setSearchTerm('');
                            }}
                            className={`p-2 rounded-lg text-sm cursor-pointer flex items-center justify-between ${selectedFamily?.id === f.id ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                          >
                            <div className="flex flex-col">
                              <span>{f.nomeAssistido}</span>
                              <span className="text-[10px] text-slate-400 uppercase font-bold">Ficha N° {f.ficha} • {f.bairro}</span>
                            </div>
                            {selectedFamily?.id === f.id && <Check size={14} />}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-400 italic">Nenhuma família encontrada</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Data da Visita</label>
                <input 
                  name="data" 
                  type="date" 
                  required 
                  defaultValue={editingVisit?.data || new Date().toISOString().split('T')[0]}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" 
                />
              </div>

              {/* Motivo da Visita */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Motivo da Visita</label>
                <select 
                  value={motivo} 
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                  required
                >
                  <option value="">Selecione o motivo...</option>
                  <option value="Visita de Cadastro">Visita de Cadastro</option>
                  <option value="Visita de Rotina">Visita de Rotina</option>
                  <option value="Visita de Emergência">Visita de Emergência</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {/* Status da Família */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  Status da Família <ShieldCheck size={12} className="text-blue-500" />
                </label>
                <select 
                  value={newFamilyStatus} 
                  onChange={(e) => setNewFamilyStatus(e.target.value as Family['status'])}
                  className={`w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold ${
                    newFamilyStatus === 'Ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    newFamilyStatus === 'Inativo' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                  disabled={!selectedFamily}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Pendente">Pendente</option>
                </select>
              </div>

              {motivo === 'Outros' && (
                <div className="md:col-span-1 space-y-1 animate-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Especifique o Motivo</label>
                  <input 
                    type="text"
                    value={outroMotivo}
                    onChange={(e) => setOutroMotivo(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" 
                    placeholder="Digite o motivo aqui..."
                  />
                </div>
              )}

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Vicentinos Presentes (separados por vírgula)</label>
                <input 
                  name="vicentinos" 
                  placeholder="Ex: João, Maria..." 
                  defaultValue={editingVisit?.vicentinos.join(', ') || ''}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" 
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Relato da Visita</label>
                <textarea 
                  name="relato" 
                  rows={4} 
                  defaultValue={editingVisit?.relato || ''}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm leading-relaxed" 
                  placeholder="O que foi observado na visita sobre a situação da família, moradia, necessidades identificadas..."
                ></textarea>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
              <button type="button" onClick={handleCloseForm} className="px-6 py-2.5 text-sm text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
              <button type="submit" className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2">
                <Check size={18} /> {editingVisit ? 'Salvar Alterações' : 'Finalizar Registro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Detalhes da Visita */}
      {selectedVisit && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Footprints size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Detalhes da Visita</h4>
                  <p className="text-white/80 text-xs uppercase font-bold tracking-widest">
                    {getFamilyName(selectedVisit.familyId)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVisit(null)} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Data da Visita</label>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Calendar size={16} className="text-emerald-500" />
                    {new Date(selectedVisit.data + 'T00:00:00').toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Motivo da Visita</label>
                  <div>
                    {selectedVisit.motivo ? (
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase">
                        <Info size={12} /> {selectedVisit.motivo}
                    </span>
                    ) : (
                      <span className="text-slate-400 text-sm">Não informado</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Vicentinos Presentes</label>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <User size={16} className="text-emerald-500" />
                    {selectedVisit.vicentinos.join(', ')}
                  </div>
                </div>
              </div>
              {selectedVisit.relato && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Relato da Visita</label>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 w-full overflow-hidden">
                    <div className="flex items-start gap-2 w-full">
                      <MessageCircle size={16} className="text-slate-400 mt-0.5 shrink-0 flex-shrink-0" />
                      <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words flex-1 min-w-0 overflow-wrap-break-word" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {selectedVisit.relato}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => {
                    setSelectedVisit(null);
                    handleEdit(selectedVisit);
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <Edit size={18} /> Editar Visita
                </button>
                <button 
                  onClick={() => {
                    setSelectedVisit(null);
                    setVisitToDelete(selectedVisit);
                  }}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> Deletar Visita
                </button>
                <button 
                  onClick={() => setSelectedVisit(null)} 
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

      {/* Modal de Confirmação de Exclusão de Visita */}
      {visitToDelete && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h4 className="text-2xl font-black text-slate-800 mb-4">Confirmar Exclusão de Visita</h4>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                <p className="text-slate-700 text-base font-semibold mb-2">
                  Você tem certeza que deseja deletar a visita de:
                </p>
                <p className="text-rose-700 text-lg font-black mb-1">
                  "{getFamilyName(visitToDelete.familyId)}"
                </p>
                <p className="text-slate-600 text-sm">
                  Data: {visitToDelete.data}
                </p>
              </div>
              <p className="text-rose-600 text-xs font-bold">
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setVisitToDelete(null)} 
                className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all"
              >
                Não, cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteVisit}
                className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Sim, deletar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Data</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Família</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Motivo</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedVisits.map((v: Visit) => (
              <tr key={v.id} className="hover:bg-slate-50 group cursor-pointer" onClick={() => setSelectedVisit(v)}>
                <td className="px-6 py-4 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    {new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800">{getFamilyName(v.familyId)}</div>
                </td>
                <td className="px-6 py-4">
                  {v.motivo ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase">
                      <Info size={10} /> {v.motivo}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(v);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Editar visita"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setVisitToDelete(v);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Deletar visita"
                    >
                      <Trash2 size={16} />
                    </button>
                    <Info size={16} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                    <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                      <Footprints size={16} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredVisits.length === 0 && visits.length > 0 && (
          <div className="py-12 text-center text-slate-400 italic border-t border-slate-100">
            Nenhuma visita encontrada com o termo "{searchVisits}".
          </div>
        )}
        {visits.length === 0 && (
          <div className="py-12 text-center text-slate-400 italic border-t border-slate-100">
            Nenhuma visita registrada ainda.
          </div>
        )}
      </div>

      {/* Controles de Paginação */}
      {filteredVisits.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 font-medium">Itens por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
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
              <span className="font-bold text-slate-800">{Math.min(endIndex, sortedVisits.length)}</span> de{' '}
              <span className="font-bold text-slate-800">{sortedVisits.length}</span>
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
  );
};

export default VisitManager;
