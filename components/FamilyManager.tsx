
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronRight, Phone, MapPin, Calendar, User, FileText, Activity, Home, Heart, Trash2, Edit, Info, Users, Footprints, Package, Search, X, CreditCard, ShieldCheck, UserPlus, Briefcase, DollarSign, Activity as HealthIcon, Save, UserCheck, AlertTriangle, Upload, CheckCircle, FileDown } from 'lucide-react';
import { Family, Member, Visit, Delivery } from '../types';
import { addMemberToFamily, removeMemberFromFamily, upsertFamilyWithMembers, deleteFamily } from '../db';
import { generateFamiliesPDF, generateFamilyProfilePDF } from '../utils/pdfUtils';


interface FamilyManagerProps {
  viewMode?: 'list' | 'details' | 'form';
  families?: Family[];
  family?: Family;
  members?: Member[];
  visits?: Visit[];
  deliveries?: Delivery[];
  onViewDetails?: (id: string) => void;
  onRefresh: () => void;
  initialEdit?: boolean;
  onCancelEdit?: () => void;
}

const FamilyManager: React.FC<FamilyManagerProps> = ({ 
  viewMode = 'list', 
  families = [], 
  family, 
  members = [], 
  visits = [], 
  deliveries = [],
  onViewDetails,
  onRefresh,
  initialEdit = false,
  onCancelEdit
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(initialEdit);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [showDeleteFamilyModal, setShowDeleteFamilyModal] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<{ total: number; processed: number; success: number; errors: number } | null>(null);
  const [search, setSearch] = useState('');
  const [nextFicha, setNextFicha] = useState('1');
  const [totalMoradores, setTotalMoradores] = useState(1);
  const [temRendaAssistido, setTemRendaAssistido] = useState(false);
  const [temComorbidadeAssistido, setTemComorbidadeAssistido] = useState(false);
  
  // Estados para o Modal de Adicionar Membro Avulso
  const [newMemberRendaVisible, setNewMemberRendaVisible] = useState(false);
  const [newMemberComorbidadeVisible, setNewMemberComorbidadeVisible] = useState(false);
  const [newMemberRendaValue, setNewMemberRendaValue] = useState('');
  const [newMemberNascimento, setNewMemberNascimento] = useState('');
  const [newMemberIdadeCalculada, setNewMemberIdadeCalculada] = useState<number | ''>('');
  const [newMemberNascimentoDesconhecido, setNewMemberNascimentoDesconhecido] = useState(false);

  // Estados para controlar a visibilidade de campos condicionais de membros no form principal
  const [membrosRendaVisivel, setMembrosRendaVisivel] = useState<{ [key: number]: boolean }>({});
  const [membrosComorbidadeVisivel, setMembrosComorbidadeVisivel] = useState<{ [key: number]: boolean }>({});

  // Estados controlados para manter valores dos selects durante re-renderizações
  const [ocupacaoAssistido, setOcupacaoAssistido] = useState('');
  const [ocupacoesMembros, setOcupacoesMembros] = useState<{ [key: number]: string }>({});

  // Estados controlados para campos formatados
  const [cpfValue, setCpfValue] = useState('');
  const [rgValue, setRgValue] = useState('');
  const [telefoneValue, setTelefoneValue] = useState('');
  const [rendaAssistidoValue, setRendaAssistidoValue] = useState('');
  const [rendasMembros, setRendasMembros] = useState<{ [key: number]: string }>({});
  
  // Estados para data de nascimento e idade calculada
  const [nascimentoAssistido, setNascimentoAssistido] = useState('');
  const [idadeAssistidoCalculada, setIdadeAssistidoCalculada] = useState<number | ''>('');
  const [nascimentoAssistidoDesconhecido, setNascimentoAssistidoDesconhecido] = useState(false);
  const [nascimentosMembros, setNascimentosMembros] = useState<{ [key: number]: string }>({});
  const [idadesMembrosCalculadas, setIdadesMembrosCalculadas] = useState<{ [key: number]: number | '' }>({});
  const [nascimentosMembrosDesconhecidos, setNascimentosMembrosDesconhecidos] = useState<{ [key: number]: boolean }>({});
  
  // Estado para data de cadastro
  const [dataCadastro, setDataCadastro] = useState(new Date().toISOString().split('T')[0]);
  
  // Ref para rastrear se já inicializamos os valores
  const initializedRef = useRef<string | null>(null);
  
  // Função para calcular idade a partir da data de nascimento
  const calculateAge = (birthDate: string): number | '' => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : '';
  };

  // Funções de formatação
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return value;
  };

  const formatRG = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 9) {
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1})$/, '$1-$2');
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length <= 10) {
        return numbers
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        return numbers
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2');
      }
    }
    return value;
  };

  const formatCurrency = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    if (numbers === '') return '';
    
    // Converte para número e divide por 100 para ter centavos
    const amount = parseInt(numbers, 10) / 100;
    
    // Formata como moeda brasileira
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const parseCurrencyToDisplay = (value: string): string => {
    // Se já está formatado, retorna como está
    if (value.includes('R$')) return value;
    
    // Se é apenas número, formata
    const numbers = value.replace(/\D/g, '');
    if (numbers === '' || numbers === '0') return 'R$ 0,00';
    
    const amount = parseInt(numbers, 10) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Funções para formatar CPF e RG na exibição
  const formatCPFForDisplay = (value: string | undefined): string => {
    if (!value) return 'Não Informado';
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 11) {
      return formatCPF(numbers);
    }
    return value; // Se já está formatado ou não tem 11 dígitos, retorna como está
  };

  const formatRGForDisplay = (value: string | undefined): string => {
    if (!value) return 'Não Informado';
    const numbers = value.replace(/\D/g, '');
    if (numbers.length >= 7 && numbers.length <= 9) {
      return formatRG(numbers);
    }
    return value; // Se já está formatado ou não tem tamanho válido, retorna como está
  };

  const formatPhoneForDisplay = (value: string | undefined): string => {
    if (!value) return 'Sem Telefone';
    const numbers = value.replace(/\D/g, '');
    if (numbers.length >= 10 && numbers.length <= 11) {
      return formatPhone(numbers);
    }
    return value; // Se já está formatado ou não tem tamanho válido, retorna como está
  };

  useEffect(() => {
    const currentKey = family?.id || (isAdding ? 'new' : null);
    
    // Evitar re-inicialização se já inicializamos para esta família
    if ((isEditing || initialEdit) && family && initializedRef.current !== family.id) {
      setTotalMoradores(family.moradoresCount || 1);
      setTemRendaAssistido(family.renda !== 'R$ 0,00' && family.renda !== '');
      setTemComorbidadeAssistido(family.comorbidade !== 'Não possui' && family.comorbidade !== '');
      
      // Inicializar data de cadastro
      if (family.dataCadastro) {
        setDataCadastro(family.dataCadastro);
      } else {
        setDataCadastro(new Date().toISOString().split('T')[0]);
      }
      
      // Inicializar ocupação do assistido
      if (members[0]?.ocupacao) {
        setOcupacaoAssistido(members[0].ocupacao);
      }
      
      // Inicializar campos formatados
      if (family.cpf) {
        setCpfValue(formatCPF(family.cpf.replace(/\D/g, '')));
      } else {
        setCpfValue('');
      }
      if (family.rg) {
        setRgValue(formatRG(family.rg.replace(/\D/g, '')));
      } else {
        setRgValue('');
      }
      if (family.telefone) {
        setTelefoneValue(formatPhone(family.telefone.replace(/\D/g, '')));
      } else {
        setTelefoneValue('');
      }
      
      const rendaVis: { [key: number]: boolean } = {};
      const comoVis: { [key: number]: boolean } = {};
      const ocupacoes: { [key: number]: string } = {};
      members.forEach((m, idx) => {
        if (idx > 0) {
          rendaVis[idx] = m.renda !== 'R$ 0,00' && m.renda !== '';
          comoVis[idx] = m.comorbidade !== 'Não possui' && m.comorbidade !== '';
          ocupacoes[idx] = m.ocupacao || '';
        }
      });
      setMembrosRendaVisivel(rendaVis);
      setMembrosComorbidadeVisivel(comoVis);
      setOcupacoesMembros(ocupacoes);
      
      initializedRef.current = family.id;
    } else if (isAdding && !isEditing && initializedRef.current !== 'new') {
      // Resetar estados ao iniciar novo cadastro
      setOcupacaoAssistido('');
      setOcupacoesMembros({});
      setCpfValue('');
      setRgValue('');
      setTelefoneValue('');
      setNascimentoAssistido('');
      setIdadeAssistidoCalculada('');
      setNascimentoAssistidoDesconhecido(false);
      setNascimentosMembros({});
      setIdadesMembrosCalculadas({});
      setNascimentosMembrosDesconhecidos({});
      setDataCadastro(new Date().toISOString().split('T')[0]); // Sempre usar data atual como padrão
      initializedRef.current = 'new';
    } else if (!isAdding && !isEditing) {
      // Resetar quando não está editando nem adicionando
      initializedRef.current = null;
    }
  }, [isEditing, initialEdit, family?.id, members?.length, isAdding]);

  // Calcular próximo número de ficha sempre que families mudar ou quando abrir o formulário
  useEffect(() => {
    if (families.length > 0) {
      const numbers = families.map(f => {
        const num = parseInt(f.ficha);
        return isNaN(num) ? 0 : num;
      });
      const max = Math.max(...numbers, 0);
      setNextFicha((max + 1).toString());
    } else {
      setNextFicha('1');
    }
  }, [families, isAdding]);

  const filteredFamilies = families.filter(f => 
    f.nomeAssistido.toLowerCase().includes(search.toLowerCase()) || 
    f.bairro.toLowerCase().includes(search.toLowerCase())
  );

  const OcupacaoOptions = () => (
    <>
      <option value="">Selecione...</option>
      <option value="Estudante">Estudante</option>
      <option value="Empregado">Empregado</option>
      <option value="Beneficiario">Beneficiário</option>
      <option value="Desempregado">Desempregado</option>
      <option value="Autônomo">Autônomo / Bico</option>
      <option value="Aposentado">Aposentado / Pensionista</option>
    </>
  );

  const handleMemberRendaChange = (idx: number, value: string) => {
    setMembrosRendaVisivel(prev => ({ ...prev, [idx]: value === 'Sim' }));
  };

  const handleMemberComorbidadeChange = (idx: number, value: string) => {
    setMembrosComorbidadeVisivel(prev => ({ ...prev, [idx]: value === 'Sim' }));
  };

  const handleConfirmRemoveMember = () => {
    if (!family || !memberToDelete) return;
    (async () => {
      try {
        await removeMemberFromFamily({ family, member: memberToDelete });
        setMemberToDelete(null);
        onRefresh();
      } catch (e: any) {
        alert(e?.message || 'Falha ao remover membro.');
      }
    })();
  };

  const handleConfirmDeleteFamily = () => {
    if (!family) return;
    (async () => {
      try {
        await deleteFamily(family.id);
        setShowDeleteFamilyModal(false);
        onRefresh();
      } catch (e: any) {
        alert(e?.message || 'Falha ao deletar família.');
      }
    })();
  };

  // Função para converter data do formato brasileiro (DD/MM/YYYY) para ISO (YYYY-MM-DD)
  const convertDateToISO = (dateStr: string): string => {
    if (!dateStr || dateStr.trim() === '') return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  };

  // Função para limpar CPF (remover pontos e traços)
  const cleanCPF = (cpf: string): string => {
    return cpf ? cpf.replace(/[.\-]/g, '') : '';
  };

  // Função para limpar telefone
  const cleanPhone = (phone: string): string => {
    return phone ? phone.replace(/[()\s\-]/g, '') : '';
  };

  // Função para converter "Sim"/"Não" para boolean
  const parseBoolean = (value: string): boolean => {
    return value?.toLowerCase().trim() === 'sim';
  };

  // Função para processar CSV/TSV
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    // Detectar se é TSV (tab) ou CSV (vírgula)
    const isTSV = lines[0].includes('\t');
    const delimiter = isTSV ? '\t' : ',';
    
    // Parsear header
    const headers = lines[0].split(delimiter).map(h => h.trim());
    
    // Parsear linhas
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      // Só adiciona se tiver tipo definido (FAMÍLIA ou MEMBRO)
      if (row['Tipo'] && (row['Tipo'].trim() === 'FAMÍLIA' || row['Tipo'].trim() === 'MEMBRO')) {
        rows.push(row);
      }
    }
    return rows;
  };

  // Função para carregar biblioteca XLSX
  const loadXLSX = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      if (window.XLSX) {
        // @ts-ignore
        resolve(window.XLSX);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
      script.onload = () => {
        // @ts-ignore
        resolve(window.XLSX);
      };
      script.onerror = () => {
        reject(new Error('Falha ao carregar biblioteca XLSX'));
      };
      document.head.appendChild(script);
    });
  };

  // Função para processar arquivo Excel (XLSX)
  const parseXLSX = async (file: File): Promise<any[]> => {
    try {
      const XLSX = await loadXLSX();
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Pegar a primeira planilha
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Converter para JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      // Filtrar apenas linhas com tipo FAMÍLIA ou MEMBRO
      return jsonData.filter((row: any) => {
        const tipo = row['Tipo']?.toString().trim();
        return tipo === 'FAMÍLIA' || tipo === 'MEMBRO';
      });
    } catch (error) {
      console.error('Erro ao processar arquivo Excel:', error);
      throw new Error('Erro ao processar arquivo Excel. Verifique se o formato está correto.');
    }
  };

  // Função para processar e importar dados
  const handleImportFile = async (file: File) => {
    let rows: any[] = [];
    
    // Detectar tipo de arquivo
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    
    try {
      if (isExcel) {
        rows = await parseXLSX(file);
      } else {
        const text = await file.text();
        rows = parseCSV(text);
      }
    } catch (error: any) {
      alert(error?.message || 'Erro ao processar arquivo. Verifique o formato.');
      return;
    }
    
    if (rows.length === 0) {
      alert('Arquivo vazio ou formato inválido.');
      return;
    }

    setImportProgress({ total: rows.length, processed: 0, success: 0, errors: 0 });
    setIsImportModalOpen(true);

    const familiesMap = new Map<string, { family: Family; members: Member[] }>();
    let currentFamilyId = '';
    let currentFamilyData: any = null;

    // Processar cada linha
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tipo = row['Tipo']?.trim();
      
      if (tipo === 'FAMÍLIA') {
        // Salvar família anterior se existir
        if (currentFamilyId && currentFamilyData) {
          familiesMap.set(currentFamilyId, currentFamilyData);
        }

        // Criar nova família
        const ficha = row['Ficha']?.trim() || '';
        currentFamilyId = `import-${ficha}-${Date.now()}-${i}`;
        
        const family: Family = {
          id: currentFamilyId,
          ficha: ficha,
          dataCadastro: convertDateToISO(row['Data de Cadastro'] || ''),
          nomeAssistido: row['Nome']?.trim() || '',
          estadoCivil: row['Estado Civil']?.trim() || '',
          nascimento: convertDateToISO(row['Data de Nascimento'] || ''),
          idade: parseInt(row['Idade'] || '0') || 0,
          endereco: row['Endereço']?.trim() || '',
          bairro: row['Bairro']?.trim() || '',
          telefone: cleanPhone(row['Telefone'] || ''),
          whatsapp: parseBoolean(row['WhatsApp'] || ''),
          cpf: cleanCPF(row['CPF'] || ''),
          rg: row['RG']?.trim() || '',
          filhos: parseBoolean(row['Filhos'] || ''),
          filhosCount: parseInt(row['Qtd. Filhos'] || '0') || 0,
          moradoresCount: parseInt(row['Total de Moradores'] || '1') || 1,
          renda: row['Renda']?.trim() || '',
          comorbidade: row['Comorbidade']?.trim() || '',
          situacaoImovel: row['Situação do Imóvel']?.trim() || '',
          observacao: row['Observação']?.trim() || '',
          status: (row['Status']?.trim() || 'Ativo') as 'Ativo' | 'Inativo' | 'Pendente',
        };

        // Criar membro assistido
        const assistidoMember: Member = {
          id: `${currentFamilyId}-assistido`,
          familyId: currentFamilyId,
          nome: family.nomeAssistido,
          parentesco: 'Próprio(a)',
          nascimento: family.nascimento,
          idade: family.idade,
          ocupacao: row['Ocupação']?.trim() || '',
          observacaoOcupacao: row['Observação Ocupação']?.trim() || '',
          renda: family.renda,
          comorbidade: family.comorbidade,
        };

        currentFamilyData = {
          family,
          members: [assistidoMember]
        };
      } else if (tipo === 'MEMBRO' && currentFamilyId && currentFamilyData) {
        // Adicionar membro à família atual
        const member: Member = {
          id: `${currentFamilyId}-member-${currentFamilyData.members.length}`,
          familyId: currentFamilyId,
          nome: row['Nome']?.trim() || '',
          parentesco: row['Parentesco']?.trim() || '',
          nascimento: convertDateToISO(row['Data de Nascimento'] || ''),
          idade: parseInt(row['Idade'] || '0') || 0,
          ocupacao: row['Ocupação']?.trim() || '',
          observacaoOcupacao: row['Observação Ocupação']?.trim() || '',
          renda: row['Renda']?.trim() || '',
          comorbidade: row['Comorbidade']?.trim() || '',
        };
        currentFamilyData.members.push(member);
      }

      setImportProgress(prev => prev ? { ...prev, processed: i + 1 } : null);
    }

    // Salvar última família
    if (currentFamilyId && currentFamilyData) {
      familiesMap.set(currentFamilyId, currentFamilyData);
    }

    // Importar todas as famílias
    let successCount = 0;
    let errorCount = 0;

    for (const [familyId, { family, members }] of familiesMap.entries()) {
      try {
        await upsertFamilyWithMembers(family, members);
        successCount++;
      } catch (e: any) {
        console.error(`Erro ao importar família ${family.ficha}:`, e);
        errorCount++;
      }
      setImportProgress(prev => prev ? { ...prev, success: successCount, errors: errorCount } : null);
    }

    if (successCount > 0) {
      onRefresh();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportProgress(null);
        alert(`Importação concluída! ${successCount} família(s) importada(s) com sucesso.${errorCount > 0 ? ` ${errorCount} erro(s).` : ''}`);
      }, 1000);
    } else {
      alert('Nenhuma família foi importada. Verifique o formato do arquivo.');
      setIsImportModalOpen(false);
      setImportProgress(null);
    }
  };

  const handleQuickAddMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!family) return;

    const formData = new FormData(e.currentTarget);
    const possuiRenda = formData.get('possui_renda') === 'Sim';
    const possuiComorbidade = formData.get('possui_comorbidade') === 'Sim';

    const newMember: Member = {
      id: `m_${Date.now()}`,
      familyId: family.id,
      nome: formData.get('nome') as string,
      idade: newMemberIdadeCalculada !== '' ? Number(newMemberIdadeCalculada) : 0,
      parentesco: formData.get('parentesco') as string,
      nascimento: newMemberNascimento,
      ocupacao: formData.get('ocupacao') as string,
      observacaoOcupacao: formData.get('obs_ocupacao') as string,
      renda: possuiRenda ? parseCurrencyToDisplay(newMemberRendaValue) : 'R$ 0,00',
      comorbidade: possuiComorbidade ? (formData.get('comorbidade_detalhe') as string) : 'Não possui'
    };
    (async () => {
      try {
        await addMemberToFamily({ family, member: newMember });
        setIsAddMemberModalOpen(false);
        setNewMemberRendaVisible(false);
        setNewMemberComorbidadeVisible(false);
        setNewMemberRendaValue('');
        setNewMemberNascimento('');
        setNewMemberIdadeCalculada('');
        setNewMemberNascimentoDesconhecido(false);
        onRefresh();
      } catch (e: any) {
        alert(e?.message || 'Falha ao adicionar membro.');
      }
    })();
  };

  if (isAdding || isEditing) {
    const targetFamily = isEditing ? family : null;
    const targetMembers = isEditing ? members : [];

    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Cadastro' : 'Novo Cadastro SSVP'}</h3>
            <p className="text-slate-500 text-sm">Atualize os dados socioeconômicos da família e de seus membros.</p>
          </div>
          <button onClick={() => { setIsAdding(false); setIsEditing(false); onCancelEdit?.(); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form className="space-y-10" onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const familyId = isEditing ? (family?.id || Date.now().toString()) : Date.now().toString();
          const nomeAssistido = formData.get('nome') as string;
          const idadeAssistido = idadeAssistidoCalculada !== '' ? Number(idadeAssistidoCalculada) : 0;
          
          const ocupacaoAssistido = (formData.get('ocupacao_assistido') as string)?.trim() || '';
          const obsOcupacaoAssistido = (formData.get('obs_ocupacao_assistido') as string)?.trim() || '';
          
          const formMembers: Member[] = [{
            id: isEditing ? (targetMembers[0]?.id || `${familyId}_head`) : `${familyId}_head`,
            familyId: familyId,
            nome: nomeAssistido,
            idade: idadeAssistido,
            parentesco: 'Próprio(a)',
            nascimento: nascimentoAssistido,
            ocupacao: ocupacaoAssistido && ocupacaoAssistido !== 'Selecione...' ? ocupacaoAssistido : '',
            observacaoOcupacao: obsOcupacaoAssistido,
            renda: temRendaAssistido ? parseCurrencyToDisplay(rendaAssistidoValue) : 'R$ 0,00',
            comorbidade: temComorbidadeAssistido ? (formData.get('comorbidade_detalhe_assistido') as string) : 'Não possui'
          }];

          if (totalMoradores > 1) {
            for (let i = 1; i < totalMoradores; i++) {
              const nome = formData.get(`member_nome_${i}`) as string;
              if (nome) {
                const possuiRenda = formData.get(`member_possui_renda_${i}`) === 'Sim';
                const possuiComorbidade = formData.get(`member_possui_comorbidade_${i}`) === 'Sim';
                const ocupacaoMember = ocupacoesMembros[i] || '';
                const ocupacaoMemberFinal = ocupacaoMember && ocupacaoMember !== 'Selecione...' ? ocupacaoMember : '';
                const obsOcupacaoMember = (formData.get(`member_obs_ocupacao_${i}`) as string)?.trim() || '';
                
                formMembers.push({
                  id: isEditing && targetMembers[i] ? targetMembers[i].id : `${familyId}_m_${i}`,
                  familyId: familyId,
                  nome: nome,
                  idade: idadesMembrosCalculadas[i] !== '' ? Number(idadesMembrosCalculadas[i]) : 0,
                  parentesco: formData.get(`member_parentesco_${i}`) as string,
                  nascimento: nascimentosMembros[i] || '',
                  ocupacao: ocupacaoMemberFinal,
                  observacaoOcupacao: obsOcupacaoMember,
                  renda: possuiRenda ? parseCurrencyToDisplay(rendasMembros[i] || '') : 'R$ 0,00',
                  comorbidade: possuiComorbidade ? (formData.get(`member_comorbidade_detalhe_${i}`) as string) : 'Não possui'
                });
              }
            }
          }

          const savedFamily: Family = {
            id: familyId,
            ficha: formData.get('ficha') as string,
            dataCadastro: dataCadastro || new Date().toISOString().split('T')[0],
            nomeAssistido: nomeAssistido,
            estadoCivil: formData.get('estadoCivil') as string,
            nascimento: nascimentoAssistido,
            idade: idadeAssistido,
            endereco: formData.get('endereco') as string,
            bairro: formData.get('bairro') as string,
            telefone: telefoneValue.replace(/\D/g, ''),
            whatsapp: formData.get('whatsapp') === 'on',
            cpf: cpfValue.replace(/\D/g, ''),
            rg: rgValue.replace(/\D/g, ''),
            filhos: formMembers.length > 1,
            filhosCount: formMembers.filter(m => m.parentesco === 'Filho(a)').length,
            moradoresCount: totalMoradores,
            renda: temRendaAssistido ? parseCurrencyToDisplay(rendaAssistidoValue) : 'R$ 0,00',
            comorbidade: temComorbidadeAssistido ? (formData.get('comorbidade_detalhe_assistido') as string) : 'Não possui',
            situacaoImovel: formData.get('imovel') as string,
            observacao: formData.get('obs') as string,
            status: formData.get('status') as 'Ativo' | 'Inativo' | 'Pendente'
          };
          (async () => {
            try {
              await upsertFamilyWithMembers(savedFamily, formMembers);
              setIsAdding(false);
              setIsEditing(false);
              onRefresh();
              onCancelEdit?.();
            } catch (e: any) {
              alert(e?.message || 'Falha ao salvar família.');
            }
          })();
        }}>
          
          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-wider">
              <User size={16} /> 1. Dados do Assistido (Chefe de Família)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Ficha N°</label>
                <input 
                  name="ficha" 
                  defaultValue={isEditing ? targetFamily?.ficha : nextFicha} 
                  key={isEditing ? `edit-${targetFamily?.id}` : `new-${nextFicha}`}
                  required 
                  className="w-full px-4 py-2 bg-blue-50/50 border border-blue-100 rounded-lg font-bold text-blue-700 outline-none" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Data de Cadastro</label>
                <input 
                  name="dataCadastro" 
                  type="date"
                  value={dataCadastro}
                  onChange={(e) => setDataCadastro(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-700">Nome Completo</label>
                <input name="nome" defaultValue={isEditing ? targetFamily?.nomeAssistido : ''} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Data de Nascimento</label>
                <input 
                  name="nascimento" 
                  type="date" 
                  value={nascimentoAssistido}
                  onChange={(e) => {
                    setNascimentoAssistido(e.target.value);
                    setIdadeAssistidoCalculada(calculateAge(e.target.value));
                  }}
                  disabled={nascimentoAssistidoDesconhecido}
                  className={`w-full px-4 py-2 border border-slate-200 rounded-lg outline-none ${
                    nascimentoAssistidoDesconhecido 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-slate-50 focus:ring-2 focus:ring-blue-500'
                  }`}
                />
                <div className="flex items-center gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    id="nascimento_desconhecido_assistido"
                    checked={nascimentoAssistidoDesconhecido}
                    onChange={(e) => {
                      setNascimentoAssistidoDesconhecido(e.target.checked);
                      if (e.target.checked) {
                        setNascimentoAssistido('');
                        setIdadeAssistidoCalculada('');
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="nascimento_desconhecido_assistido" className="text-xs font-medium text-slate-600 cursor-pointer">
                    Não sei a data de nascimento
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Idade</label>
                <input 
                  name="idade_assistido" 
                  type="number" 
                  value={idadeAssistidoCalculada}
                  onChange={(e) => {
                    if (nascimentoAssistidoDesconhecido) {
                      setIdadeAssistidoCalculada(e.target.value === '' ? '' : Number(e.target.value));
                    }
                  }}
                  readOnly={!nascimentoAssistidoDesconhecido}
                  required 
                  className={`w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                    nascimentoAssistidoDesconhecido 
                      ? 'bg-slate-50' 
                      : 'bg-slate-100 cursor-not-allowed'
                  }`}
                  placeholder={nascimentoAssistidoDesconhecido ? "Digite a idade" : ""}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">CPF (Opcional)</label>
                <input 
                  name="cpf" 
                  value={cpfValue}
                  onChange={(e) => setCpfValue(formatCPF(e.target.value))}
                  placeholder="000.000.000-00" 
                  maxLength={14}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">RG (Opcional)</label>
                <input 
                  name="rg" 
                  value={rgValue}
                  onChange={(e) => setRgValue(formatRG(e.target.value))}
                  placeholder="00.000.000-0" 
                  maxLength={12}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Ocupação Atual</label>
                <select 
                  name="ocupacao_assistido" 
                  value={ocupacaoAssistido}
                  onChange={(e) => setOcupacaoAssistido(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <OcupacaoOptions />
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Observação Ocupação</label>
                <input name="obs_ocupacao_assistido" defaultValue={isEditing ? targetMembers[0]?.observacaoOcupacao : ''} placeholder="Ex: Vendedor de balas, BPC, etc" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Possui Renda?</label>
                <select 
                  onChange={(e) => setTemRendaAssistido(e.target.value === 'Sim')}
                  value={temRendaAssistido ? 'Sim' : 'Não'}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </div>
              {temRendaAssistido && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-700">Valor da Renda</label>
                  <input 
                    name="renda_valor_assistido" 
                    value={rendaAssistidoValue}
                    onChange={(e) => setRendaAssistidoValue(formatCurrency(e.target.value))}
                    placeholder="R$ 0,00" 
                    className="w-full px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Possui Comorbidade?</label>
                <select 
                  onChange={(e) => setTemComorbidadeAssistido(e.target.value === 'Sim')}
                  value={temComorbidadeAssistido ? 'Sim' : 'Não'}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </div>
              {temComorbidadeAssistido && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-700">Quais?</label>
                  <input name="comorbidade_detalhe_assistido" defaultValue={isEditing ? targetFamily?.comorbidade : ''} placeholder="Descreva as comorbidades" className="w-full px-4 py-2 bg-rose-50 border border-rose-100 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none" />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Estado Civil</label>
                <select name="estadoCivil" defaultValue={isEditing ? targetFamily?.estadoCivil : ''} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option>Solteiro(a)</option>
                  <option>Casado(a)</option>
                  <option>União Estável</option>
                  <option>Divorciado(a)</option>
                  <option>Viúvo(a)</option>
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-wider">
              <Home size={16} /> 2. Situação Habitacional e Social
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Bairro</label>
                <input name="bairro" defaultValue={isEditing ? targetFamily?.bairro : ''} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Endereço Completo</label>
                <input name="endereco" defaultValue={isEditing ? targetFamily?.endereco : ''} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Situação do Imóvel</label>
                <select name="imovel" defaultValue={isEditing ? targetFamily?.situacaoImovel : ''} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option>Própria</option>
                  <option>Alugada</option>
                  <option>Cedida / Favor</option>
                  <option>Financiada</option>
                  <option>Ocupação</option>
                  <option>Situação de Rua</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Telefone / Celular</label>
                <input 
                  name="telefone" 
                  value={telefoneValue}
                  onChange={(e) => setTelefoneValue(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000" 
                  maxLength={15}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-wider">
                <Users size={16} /> 3. Outros Residentes no Imóvel
              </h4>
              <div className="flex items-center gap-4">
                <label className="text-xs font-bold text-slate-500 uppercase">Total de Pessoas (Inc. Assistido):</label>
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                   <button type="button" onClick={() => setTotalMoradores(Math.max(1, totalMoradores - 1))} className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold">-</button>
                   <span className="px-4 py-1 bg-white font-bold text-blue-600 min-w-[40px] text-center">{totalMoradores}</span>
                   <button type="button" onClick={() => setTotalMoradores(totalMoradores + 1)} className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold">+</button>
                </div>
              </div>
            </div>
            
            {totalMoradores > 1 ? (
              <div className="space-y-4">
                {Array.from({ length: totalMoradores - 1 }).map((_, i) => {
                  const idx = i + 1;
                  const memberData = isEditing ? targetMembers[idx] : null;
                  return (
                    <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-2 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                            {idx + 1}°
                          </span>
                          <span className="text-xs font-bold text-slate-500 uppercase">Residente Adicional</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Completo</label>
                          <input name={`member_nome_${idx}`} defaultValue={memberData?.nome || ''} required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Nome do familiar" />
                        </div>
                        <div className="md:col-span-1 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Parentesco</label>
                          <select name={`member_parentesco_${idx}`} defaultValue={memberData?.parentesco || 'Filho(a)'} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                            <option>Filho(a)</option>
                            <option>Cônjuge</option>
                            <option>Neto(a)</option>
                            <option>Enteado(a)</option>
                            <option>Pai / Mãe</option>
                            <option>Irmão(ã)</option>
                            <option>Outro</option>
                          </select>
                        </div>
                        <div className="md:col-span-1 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Data Nasc.</label>
                          <input 
                            name={`member_nascimento_${idx}`}
                            type="date"
                            value={nascimentosMembros[idx] || ''}
                            onChange={(e) => {
                              setNascimentosMembros(prev => ({ ...prev, [idx]: e.target.value }));
                              setIdadesMembrosCalculadas(prev => ({ ...prev, [idx]: calculateAge(e.target.value) }));
                            }}
                            disabled={nascimentosMembrosDesconhecidos[idx] || false}
                            className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm ${
                              nascimentosMembrosDesconhecidos[idx] 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-white'
                            }`}
                          />
                          <div className="flex items-center gap-1.5 mb-1">
                            <input 
                              type="checkbox" 
                              id={`member_nascimento_desconhecido_${idx}`}
                              checked={nascimentosMembrosDesconhecidos[idx] || false}
                              onChange={(e) => {
                                setNascimentosMembrosDesconhecidos(prev => ({ ...prev, [idx]: e.target.checked }));
                                if (e.target.checked) {
                                  setNascimentosMembros(prev => ({ ...prev, [idx]: '' }));
                                  setIdadesMembrosCalculadas(prev => ({ ...prev, [idx]: '' }));
                                }
                              }}
                              className="w-3 h-3 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor={`member_nascimento_desconhecido_${idx}`} className="text-[9px] font-medium text-slate-500 cursor-pointer">
                              Não sei
                            </label>
                          </div>
                        </div>
                        <div className="md:col-span-1 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Idade</label>
                          <input 
                            name={`member_idade_${idx}`} 
                            value={idadesMembrosCalculadas[idx] || ''} 
                            type="number" 
                            onChange={(e) => {
                              if (nascimentosMembrosDesconhecidos[idx]) {
                                setIdadesMembrosCalculadas(prev => ({ ...prev, [idx]: e.target.value === '' ? '' : Number(e.target.value) }));
                              }
                            }}
                            readOnly={!nascimentosMembrosDesconhecidos[idx]}
                            required 
                            className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm ${
                              nascimentosMembrosDesconhecidos[idx] 
                                ? 'bg-white' 
                                : 'bg-slate-100 cursor-not-allowed'
                            }`}
                            placeholder={nascimentosMembrosDesconhecidos[idx] ? "Digite" : ""}
                          />
                        </div>
                        <div className="md:col-span-1 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Ocupação</label>
                          <select 
                            name={`member_ocupacao_${idx}`} 
                            value={ocupacoesMembros[idx] || ''}
                            onChange={(e) => setOcupacoesMembros(prev => ({ ...prev, [idx]: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                          >
                            <OcupacaoOptions />
                          </select>
                        </div>
                        <div className="md:col-span-1 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Possui Renda?</label>
                          <select 
                            name={`member_possui_renda_${idx}`}
                            value={membrosRendaVisivel[idx] ? 'Sim' : 'Não'}
                            onChange={(e) => handleMemberRendaChange(idx, e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                          >
                            <option value="Não">Não</option>
                            <option value="Sim">Sim</option>
                          </select>
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Possui Comorbidade?</label>
                          <select 
                            name={`member_possui_comorbidade_${idx}`}
                            value={membrosComorbidadeVisivel[idx] ? 'Sim' : 'Não'}
                            onChange={(e) => handleMemberComorbidadeChange(idx, e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                          >
                            <option value="Não">Não</option>
                            <option value="Sim">Sim</option>
                          </select>
                        </div>
                        <div className="md:col-span-4 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Observação Ocupação</label>
                          <input name={`member_obs_ocupacao_${idx}`} defaultValue={memberData?.observacaoOcupacao || ''} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Ex: Escola X, Bico" />
                        </div>
                        
                        {membrosRendaVisivel[idx] && (
                          <div className="md:col-span-3 space-y-1 animate-in slide-in-from-left-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Valor da Renda</label>
                            <input 
                              name={`member_renda_valor_${idx}`} 
                              value={rendasMembros[idx] || ''}
                              onChange={(e) => setRendasMembros(prev => ({ ...prev, [idx]: formatCurrency(e.target.value) }))}
                              className="w-full px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-sm font-bold text-emerald-700" 
                              placeholder="R$ 0,00" 
                            />
                          </div>
                        )}

                        {membrosComorbidadeVisivel[idx] && (
                          <div className="md:col-span-3 space-y-1 animate-in slide-in-from-left-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Qual Comorbidade?</label>
                            <input name={`member_comorbidade_detalhe_${idx}`} defaultValue={memberData?.comorbidade || ''} className="w-full px-3 py-2 bg-rose-50 border border-rose-100 rounded-lg text-sm font-bold text-rose-700" placeholder="Descreva a comorbidade" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400">Nenhum outro morador registrado além do assistido.</p>
                <button type="button" onClick={() => setTotalMoradores(2)} className="mt-2 text-xs font-bold text-blue-600 hover:underline">+ Adicionar Morador</button>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Status do Cadastro</label>
              <select name="status" defaultValue={isEditing ? targetFamily?.status : 'Ativo'} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Pendente">Pendente</option>
              </select>
            </div>
            <div className="md:col-span-4 space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <FileText size={14} /> Histórico / Relato Social da Conferência
              </label>
              <textarea name="obs" defaultValue={isEditing ? targetFamily?.observacao : ''} rows={4} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Relato breve sobre a situação de vulnerabilidade..."></textarea>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button type="button" onClick={() => { setIsAdding(false); setIsEditing(false); onCancelEdit?.(); }} className="px-6 py-2.5 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors">Cancelar</button>
            <button type="submit" className={`px-8 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all flex items-center gap-2 ${isEditing ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700' : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'}`}>
              {isEditing ? <Save size={18} /> : <UserPlus size={18} />} 
              {isEditing ? 'Salvar Alterações' : 'Finalizar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (viewMode === 'details' && family) {
    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        {/* Modal de Confirmação de Remoção de Membro */}
        {memberToDelete && createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle size={40} />
                </div>
                <h4 className="text-2xl font-black text-slate-800 mb-2">Confirmar Exclusão</h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Você tem certeza que deseja remover <span className="font-bold text-slate-700">{memberToDelete.nome}</span>? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setMemberToDelete(null)} 
                  className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all"
                >
                  Não, cancelar
                </button>
                <button 
                  onClick={handleConfirmRemoveMember}
                  className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> Sim, remover
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal de Confirmação de Exclusão de Família */}
        {showDeleteFamilyModal && family && createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle size={40} />
                </div>
                <h4 className="text-2xl font-black text-slate-800 mb-4">Confirmar Exclusão de Família</h4>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                  <p className="text-slate-700 text-base font-semibold mb-2">
                    Você tem certeza que deseja deletar a família:
                  </p>
                  <p className="text-rose-700 text-lg font-black">
                    "{family.nomeAssistido}"
                  </p>
                </div>
                <p className="text-rose-600 text-xs font-bold mb-1">
                  ⚠️ Esta ação irá deletar a família e <span className="underline">todos os {members.length} membros</span> associados.
                </p>
                <p className="text-rose-600 text-xs font-bold">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setShowDeleteFamilyModal(false)} 
                  className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all"
                >
                  Não, cancelar
                </button>
                <button 
                  onClick={handleConfirmDeleteFamily}
                  className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> Sim, deletar tudo
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal de Adicionar Novo Membro Avulso */}
        {isAddMemberModalOpen && createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Adicionar Novo Membro</h4>
                    <p className="text-white/80 text-xs uppercase font-bold tracking-widest">Família: {family.nomeAssistido}</p>
                  </div>
                </div>
                <button onClick={() => setIsAddMemberModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleQuickAddMember} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
                    <input name="nome" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" placeholder="Nome do membro" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Parentesco</label>
                    <select name="parentesco" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium">
                      <option>Filho(a)</option>
                      <option>Cônjuge</option>
                      <option>Neto(a)</option>
                      <option>Enteado(a)</option>
                      <option>Pai / Mãe</option>
                      <option>Irmão(ã)</option>
                      <option>Outro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Data de Nascimento</label>
                    <input 
                      name="nascimento" 
                      type="date" 
                      value={newMemberNascimento}
                      onChange={(e) => {
                        setNewMemberNascimento(e.target.value);
                        setNewMemberIdadeCalculada(calculateAge(e.target.value));
                      }}
                      disabled={newMemberNascimentoDesconhecido}
                      className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none text-sm font-medium ${
                        newMemberNascimentoDesconhecido 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-slate-50 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    <div className="flex items-center gap-2 mb-2">
                      <input 
                        type="checkbox" 
                        id="new_member_nascimento_desconhecido"
                        checked={newMemberNascimentoDesconhecido}
                        onChange={(e) => {
                          setNewMemberNascimentoDesconhecido(e.target.checked);
                          if (e.target.checked) {
                            setNewMemberNascimento('');
                            setNewMemberIdadeCalculada('');
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="new_member_nascimento_desconhecido" className="text-xs font-medium text-slate-600 cursor-pointer">
                        Não sei a data de nascimento
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Idade</label>
                    <input 
                      name="idade" 
                      type="number" 
                      value={newMemberIdadeCalculada}
                      onChange={(e) => {
                        if (newMemberNascimentoDesconhecido) {
                          setNewMemberIdadeCalculada(e.target.value === '' ? '' : Number(e.target.value));
                        }
                      }}
                      readOnly={!newMemberNascimentoDesconhecido}
                      required 
                      className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium ${
                        newMemberNascimentoDesconhecido 
                          ? 'bg-slate-50' 
                          : 'bg-slate-100 cursor-not-allowed'
                      }`}
                      placeholder={newMemberNascimentoDesconhecido ? "Digite a idade" : "Calculada automaticamente"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ocupação</label>
                    <select name="ocupacao" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium">
                      <OcupacaoOptions />
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Observação Ocupação</label>
                    <input name="obs_ocupacao" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" placeholder="Ex: Escola X, Desempregado há 2 meses..." />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Possui Renda?</label>
                    <select 
                      name="possui_renda"
                      onChange={(e) => setNewMemberRendaVisible(e.target.value === 'Sim')}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Possui Comorbidade?</label>
                    <select 
                      name="possui_comorbidade"
                      onChange={(e) => setNewMemberComorbidadeVisible(e.target.value === 'Sim')}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </div>

                  {newMemberRendaVisible && (
                    <div className="space-y-2 animate-in slide-in-from-left-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Valor da Renda</label>
                      <input 
                        name="renda_valor" 
                        value={newMemberRendaValue}
                        onChange={(e) => setNewMemberRendaValue(formatCurrency(e.target.value))}
                        required 
                        className="w-full px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500" 
                        placeholder="R$ 0,00" 
                      />
                    </div>
                  )}

                  {newMemberComorbidadeVisible && (
                    <div className="space-y-2 animate-in slide-in-from-left-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Qual Comorbidade?</label>
                      <input name="comorbidade_detalhe" required className="w-full px-4 py-2.5 bg-rose-50 border border-rose-100 rounded-xl text-sm font-bold text-rose-700 outline-none focus:ring-2 focus:ring-rose-500" placeholder="Descreva a comorbidade..." />
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-slate-100 flex gap-3">
                  <button type="button" onClick={() => setIsAddMemberModalOpen(false)} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                    <UserCheck size={18} /> Salvar Membro
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between gap-6">
          <div className="flex gap-6">
            <div className="w-24 h-24 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <User size={48} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold text-slate-800">{family.nomeAssistido}</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  family.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 
                  family.status === 'Inativo' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                }`}>
                  {family.status}
                </span>
              </div>
              <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
                <FileText size={16} /> Ficha N° {family.ficha}
              </p>
              <div className="flex flex-wrap gap-4 mt-4">
                <span className="flex items-center gap-1.5 text-sm text-slate-600 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <Phone size={14} className="text-blue-500" /> {formatPhoneForDisplay(family.telefone)}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-slate-600 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <MapPin size={14} className="text-red-500" /> {family.endereco ? `${family.endereco}, ${family.bairro}` : family.bairro}
                </span>
                {family.cpf && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-600 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                    <CreditCard size={14} className="text-purple-500" /> CPF: {formatCPFForDisplay(family.cpf)}
                  </span>
                )}
                {family.rg && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-600 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                    <ShieldCheck size={14} className="text-indigo-500" /> RG: {formatRGForDisplay(family.rg)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <button 
              onClick={() => {
                try {
                  if (family && members && visits && deliveries) {
                    generateFamilyProfilePDF(family, members, visits, deliveries);
                  } else {
                    alert('Dados não disponíveis para gerar PDF');
                  }
                } catch (error) {
                  console.error('Erro ao gerar PDF:', error);
                  alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
                }
              }}
              className="h-10 w-10 rounded-lg bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-all shadow-sm shadow-purple-200"
              title="Download PDF - Perfil da Família"
            >
              <FileDown size={18} />
            </button>
            <button 
              onClick={() => setIsEditing(true)}
              className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200"
              title="Editar Cadastro"
            >
              <Edit size={18} />
            </button>
            <button 
              onClick={() => setShowDeleteFamilyModal(true)}
              className="h-10 w-10 rounded-lg bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-all shadow-sm shadow-rose-200"
              title="Deletar Família"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Info size={18} className="text-blue-500" /> Informações Socioeconômicas
              </h3>
              <dl className="space-y-4">
                <div className="grid grid-cols-2">
                  <dt className="text-xs font-bold text-slate-400 uppercase">Situação Moradia</dt>
                  <dd className="text-sm text-slate-700 font-semibold text-right">{family.situacaoImovel}</dd>
                </div>
                <div className="grid grid-cols-2">
                  <dt className="text-xs font-bold text-slate-400 uppercase">Renda Assistido</dt>
                  <dd className="text-sm text-emerald-700 font-bold text-right">{parseCurrencyToDisplay(family.renda)}</dd>
                </div>
                <div className="grid grid-cols-2">
                  <dt className="text-xs font-bold text-slate-400 uppercase">Comorbidade</dt>
                  <dd className="text-sm text-rose-700 font-bold text-right">{family.comorbidade}</dd>
                </div>
                <div className="grid grid-cols-2 border-t border-slate-50 pt-2">
                   <dt className="text-xs font-bold text-slate-400 uppercase">Total Moradores</dt>
                   <dd className="text-sm text-slate-700 font-semibold text-right">{family.moradoresCount} pessoas</dd>
                </div>
                <div className="border-t border-slate-50 pt-4">
                  <dt className="text-xs font-bold text-slate-400 uppercase mb-2">Relato / Obs.</dt>
                  <dd className="text-sm text-slate-600 leading-relaxed italic">{family.observacao || 'Nenhum relato cadastrado.'}</dd>
                </div>
              </dl>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Users size={18} className="text-blue-500" /> Membros da Casa ({members.length})
                </h3>
                <button 
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  title="Adicionar Membro"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {members.map((m, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 relative group/item">
                    {/* Botão de Remover Membro */}
                    {m.parentesco !== 'Próprio(a)' && i !== 0 && (
                      <button 
                        onClick={() => setMemberToDelete(m)}
                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all"
                        title="Remover Membro"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    
                    <div className="flex justify-between items-center pr-6">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{m.nome}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{m.parentesco} • {m.idade} anos</p>
                      </div>
                      <div className="text-right">
                         <p className="text-emerald-700 font-bold text-xs">{parseCurrencyToDisplay(m.renda || 'R$ 0,00')}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                          m.ocupacao === 'Empregado' ? 'bg-emerald-100 text-emerald-700' :
                          m.ocupacao === 'Estudante' ? 'bg-blue-100 text-blue-700' :
                          m.ocupacao === 'Desempregado' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          <Briefcase size={8} /> {m.ocupacao || 'N/A'}
                        </span>
                        {m.comorbidade && m.comorbidade !== 'Não possui' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700">
                            <HealthIcon size={8} /> {m.comorbidade}
                          </span>
                        )}
                    </div>
                    {m.observacaoOcupacao && (
                      <p className="text-[10px] text-slate-500 bg-white/60 p-1.5 rounded-lg border border-slate-50 italic">
                        {m.observacaoOcupacao}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setIsAddMemberModalOpen(true)}
                className="w-full mt-4 py-2 bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Adicionar Membro
              </button>
            </section>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Activity size={18} className="text-blue-500" /> Linha do Tempo de Atendimento
              </h3>
              <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-slate-100">
                {[...visits, ...deliveries].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map((item, i) => {
                  const isVisit = 'vicentinos' in item;
                  return (
                    <div key={i} className="relative pl-10 animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${isVisit ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                        {isVisit ? <Footprints size={12} className="text-white" /> : <Package size={12} className="text-white" />}
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-white transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                             <p className="text-sm font-bold text-slate-800">{isVisit ? 'Visita Domiciliar' : 'Entrega efetuada'}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">{item.data}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed italic bg-white/50 p-2 rounded-lg border border-slate-50 break-words overflow-wrap-anywhere whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          {isVisit ? (item as Visit).relato : (item as Delivery).tipo}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal de Importação */}
      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Upload size={40} />
              </div>
              <h4 className="text-2xl font-black text-slate-800 mb-4">Importando Planilha</h4>
              {importProgress && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Processando...</span>
                      <span className="font-bold">{importProgress.processed} / {importProgress.total}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${(importProgress.processed / importProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="bg-emerald-50 rounded-xl p-4">
                      <div className="text-2xl font-black text-emerald-600">{importProgress.success}</div>
                      <div className="text-xs text-emerald-700 font-bold uppercase">Sucesso</div>
                    </div>
                    <div className="bg-rose-50 rounded-xl p-4">
                      <div className="text-2xl font-black text-rose-600">{importProgress.errors}</div>
                      <div className="text-xs text-rose-700 font-bold uppercase">Erros</div>
                    </div>
                  </div>
                  {importProgress.processed === importProgress.total && (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold pt-2">
                      <CheckCircle size={20} /> Importação concluída!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Buscar por nome ou bairro..."
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              try {
                if (families && members) {
                  generateFamiliesPDF(families, members);
                } else {
                  alert('Dados não disponíveis para gerar PDF');
                }
              } catch (error) {
                console.error('Erro ao gerar PDF:', error);
                alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
              }
            }}
            className="flex items-center justify-center w-10 h-10 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-md shadow-purple-100"
            title="Download PDF - Lista de Famílias"
          >
            <FileDown size={20} />
          </button>
          <label className="flex items-center justify-center w-10 h-10 bg-slate-600 text-white rounded-xl font-semibold hover:bg-slate-700 transition-all shadow-md shadow-slate-100 cursor-pointer" title="Importar Planilha">
            <Upload size={20} />
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportFile(file);
                }
                e.target.value = '';
              }}
            />
          </label>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
            title="Nova Família"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ficha / Assistido</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Bairro</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Membros</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFamilies.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                        {f.nomeAssistido.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{f.nomeAssistido}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">N° {f.ficha}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-sm text-slate-600 flex items-center gap-1">
                      <MapPin size={14} className="text-slate-400" /> {f.bairro}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                     <div className="flex items-center gap-1 text-slate-600">
                        <Users size={14} className="text-slate-400" />
                        <span className="text-sm font-medium">{f.moradoresCount}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      f.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 
                      f.status === 'Inativo' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onViewDetails?.(f.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-sm"
                    >
                      Ver Perfil <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FamilyManager;

