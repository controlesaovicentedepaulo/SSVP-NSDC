import jsPDF from 'jspdf';
import type { Family, Member, Visit, Delivery } from '../types';

// Cores do tema
const COLORS = {
  primary: { r: 59, g: 130, b: 246 }, // blue-500
  success: { r: 16, g: 185, b: 129 }, // emerald-500
  warning: { r: 251, g: 146, b: 60 }, // orange-500
  danger: { r: 239, g: 68, b: 68 }, // rose-500
  purple: { r: 147, g: 51, b: 234 }, // purple-600
  slate: { r: 71, g: 85, b: 105 }, // slate-500
  lightGray: { r: 241, g: 245, b: 249 }, // slate-100
  darkGray: { r: 51, g: 65, b: 85 }, // slate-700
};

// Função auxiliar para formatar data
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

// Função auxiliar para quebrar texto em múltiplas linhas
function splitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return ['-'];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    // Se a palavra sozinha é maior que maxWidth, quebrar a palavra
    const wordWidth = doc.getTextWidth(word);
    if (wordWidth > maxWidth) {
      // Quebrar palavra longa
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      // Quebrar a palavra em caracteres
      let charLine = '';
      for (const char of word) {
        const testCharLine = charLine + char;
        if (doc.getTextWidth(testCharLine) > maxWidth && charLine) {
          lines.push(charLine);
          charLine = char;
        } else {
          charLine = testCharLine;
        }
      }
      if (charLine) {
        currentLine = charLine;
      }
    } else {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.getTextWidth(testLine);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

// Função para adicionar cabeçalho com cor
function addColoredHeader(doc: jsPDF, title: string, color: { r: number; g: number; b: number }, yPos: number, margin: number, width: number): number {
  // Retângulo colorido de fundo
  doc.setFillColor(color.r, color.g, color.b);
  doc.rect(margin, yPos - 8, width, 12, 'F');
  
  // Texto branco
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 5, yPos);
  
  // Resetar cor do texto
  doc.setTextColor(0, 0, 0);
  
  return yPos + 10;
}

// Função para adicionar box colorido
function addColoredBox(doc: jsPDF, label: string, value: string, xPos: number, yPos: number, color: { r: number; g: number; b: number }, maxWidth: number): number {
  const boxHeight = 15;
  const padding = 3;
  
  // Box de fundo com cor clara
  const lightColor = {
    r: Math.min(255, color.r + 200),
    g: Math.min(255, color.g + 200),
    b: Math.min(255, color.b + 200)
  };
  doc.setFillColor(lightColor.r, lightColor.g, lightColor.b);
  doc.rect(xPos, yPos - boxHeight + padding, maxWidth, boxHeight, 'F');
  
  // Borda
  doc.setDrawColor(color.r, color.g, color.b);
  doc.setLineWidth(0.5);
  doc.rect(xPos, yPos - boxHeight + padding, maxWidth, boxHeight);
  
  // Label
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(color.r, color.g, color.b);
  doc.text(label, xPos + padding, yPos - boxHeight + padding + 5);
  
  // Value
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const valueLines = splitText(doc, value, maxWidth - padding * 2);
  valueLines.forEach((line, i) => {
    doc.text(line, xPos + padding, yPos - boxHeight + padding + 10 + (i * 4));
  });
  
  return yPos + Math.max(valueLines.length * 4, 5);
}

// Função para obter cor do status
function getStatusColor(status: string): { r: number; g: number; b: number } {
  switch (status?.toLowerCase()) {
    case 'ativo':
    case 'entregue':
      return COLORS.success;
    case 'inativo':
    case 'não entregue':
      return COLORS.danger;
    case 'pendente':
      return COLORS.warning;
    default:
      return COLORS.slate;
  }
}

// Gerar PDF da lista de famílias
export function generateFamiliesPDF(families: Family[], members: Member[]): void {
  try {
    const doc = new jsPDF();
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const maxWidth = 170;

  // Cabeçalho principal colorido
  yPos = addColoredHeader(doc, 'LISTA DE FAMÍLIAS', COLORS.primary, yPos, margin, maxWidth);
  yPos += 8;

  // Data de geração em box destacado
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 4, maxWidth, 6, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos - 4, maxWidth, 6);
  doc.setTextColor(80, 80, 80);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin + 3, yPos);
  yPos += 10;

  if (families.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Nenhuma família cadastrada.', margin, yPos);
    doc.save('lista-familias.pdf');
    return;
  }

  // Estatísticas em box destacado
  // Contar apenas membros que têm familyId válido
  const totalMembers = members.filter(m => {
    const familyId = m.familyId || (m as any)["familyId"];
    return familyId && String(familyId).trim() !== '';
  }).length;
  const activeFamilies = families.filter(f => f.status === 'Ativo').length;
  
  const lightPrimary = {
    r: Math.min(255, COLORS.primary.r + 240),
    g: Math.min(255, COLORS.primary.g + 240),
    b: Math.min(255, COLORS.primary.b + 240)
  };
  doc.setFillColor(lightPrimary.r, lightPrimary.g, lightPrimary.b);
  doc.rect(margin, yPos - 4, maxWidth, 8, 'F');
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.rect(margin, yPos - 4, maxWidth, 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.text(`Total: ${families.length} família${families.length !== 1 ? 's' : ''}  |  ${totalMembers} membro${totalMembers !== 1 ? 's' : ''}  |  ${activeFamilies} ativa${activeFamilies !== 1 ? 's' : ''}`, margin + 3, yPos);
  yPos += 12;

  // Cabeçalho da tabela melhorado
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.darkGray.r, COLORS.darkGray.g, COLORS.darkGray.b);
  doc.rect(margin, yPos - 6, maxWidth, 10, 'F');
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos - 6, maxWidth, 10);
  
  let xPos = margin + 4;
  doc.setTextColor(255, 255, 255);
  doc.text('FICHA', xPos, yPos);
  xPos += 20;
  doc.text('NOME', xPos, yPos);
  xPos += 68;
  doc.text('ENDEREÇO', xPos, yPos);
  xPos += 48;
  doc.text('STATUS', xPos, yPos);
  yPos += 12;

  // Dados com melhor formatação
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  families.forEach((family, index) => {
    // Verificar se precisa de nova página
    if (yPos > pageHeight - 45) {
      doc.addPage();
      yPos = 20;
      // Recriar cabeçalho da tabela na nova página
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(COLORS.darkGray.r, COLORS.darkGray.g, COLORS.darkGray.b);
      doc.rect(margin, yPos - 6, maxWidth, 10, 'F');
      doc.setDrawColor(150, 150, 150);
      doc.rect(margin, yPos - 6, maxWidth, 10);
      let headerX = margin + 4;
      doc.setTextColor(255, 255, 255);
      doc.text('FICHA', headerX, yPos);
      headerX += 20;
      doc.text('NOME', headerX, yPos);
      headerX += 68;
      doc.text('ENDEREÇO', headerX, yPos);
      headerX += 48;
      doc.text('STATUS', headerX, yPos);
      yPos += 12;
    }

    // Filtrar membros - o campo pode vir como "familyId" do banco
    const familyMembers = members.filter(m => {
      // Tentar todos os formatos possíveis do campo
      const memberFamilyId = m.familyId || (m as any)["familyId"] || (m as any)["FamilyId"] || (m as any).FamilyId;
      const familyIdStr = String(memberFamilyId || '').trim();
      const familyIdToMatch = String(family.id || '').trim();
      return familyIdStr === familyIdToMatch && familyIdStr !== '';
    });
    const memberCount = familyMembers.length;
    const statusColor = getStatusColor(family.status || '');

    // Fundo alternado para linhas (zebra)
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPos - 5, maxWidth, Math.max(12, 8), 'F');
    }

    // Ficha
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.text(`#${family.ficha || '-'}`, margin + 4, yPos);
    
    // Nome
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const nomeLines = splitText(doc, family.nomeAssistido || '-', 65);
    nomeLines.forEach((line, i) => {
      doc.text(line, margin + 24, yPos + (i * 4.5));
    });
    
    // Endereço
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const endereco = `${family.endereco || ''}${family.bairro ? ` - ${family.bairro}` : ''}`.trim() || '-';
    const enderecoLines = splitText(doc, endereco, 46);
    enderecoLines.forEach((line, i) => {
      doc.text(line, margin + 92, yPos + (i * 4.5));
    });
    
    // Status com cor melhorado
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const lightStatusColor = {
      r: Math.min(255, statusColor.r + 200),
      g: Math.min(255, statusColor.g + 200),
      b: Math.min(255, statusColor.b + 200)
    };
    doc.setFillColor(lightStatusColor.r, lightStatusColor.g, lightStatusColor.b);
    const statusText = family.status || '-';
    const statusWidth = Math.max(20, doc.getTextWidth(statusText) + 6);
    doc.rect(margin + 140, yPos - 4, statusWidth, 6, 'F');
    doc.setDrawColor(statusColor.r, statusColor.g, statusColor.b);
    doc.setLineWidth(0.3);
    doc.rect(margin + 140, yPos - 4, statusWidth, 6);
    doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
    doc.text(statusText, margin + 143, yPos);
    
    // Contador de membros abaixo do nome
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text(`${memberCount} membro${memberCount !== 1 ? 's' : ''}`, margin + 24, yPos + (nomeLines.length * 4.5) + 2);

    const maxHeight = Math.max(nomeLines.length * 4.5, enderecoLines.length * 4.5) + 8;
    yPos += maxHeight;
    
    // Linha separadora mais sutil
    if (index < families.length - 1) {
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos - 1, margin + maxWidth, yPos - 1);
      yPos += 2;
    }
  });

    doc.save('lista-familias.pdf');
  } catch (error) {
    console.error('Erro ao gerar PDF de famílias:', error);
    throw error;
  }
}

// Gerar PDF da lista de visitas
export function generateVisitsPDF(visits: Visit[], families: Family[]): void {
  try {
    const doc = new jsPDF();
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const maxWidth = 170;

  // Cabeçalho principal colorido
  yPos = addColoredHeader(doc, 'LISTA DE VISITAS', COLORS.success, yPos, margin, maxWidth);
  yPos += 8;

  // Data de geração em box destacado
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 4, maxWidth, 6, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos - 4, maxWidth, 6);
  doc.setTextColor(80, 80, 80);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin + 3, yPos);
  yPos += 10;

  if (visits.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Nenhuma visita registrada.', margin, yPos);
    doc.save('lista-visitas.pdf');
    return;
  }

  // Estatísticas em box destacado
  const lightSuccess = {
    r: Math.min(255, COLORS.success.r + 240),
    g: Math.min(255, COLORS.success.g + 240),
    b: Math.min(255, COLORS.success.b + 240)
  };
  doc.setFillColor(lightSuccess.r, lightSuccess.g, lightSuccess.b);
  doc.rect(margin, yPos - 4, maxWidth, 8, 'F');
  doc.setDrawColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
  doc.rect(margin, yPos - 4, maxWidth, 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
  doc.text(`Total: ${visits.length} visita${visits.length !== 1 ? 's' : ''} registrada${visits.length !== 1 ? 's' : ''}`, margin + 3, yPos);
  yPos += 12;

  // Ordenar por data (mais recente primeiro)
  const sortedVisits = [...visits].sort((a, b) => 
    new Date(b.data + 'T00:00:00').getTime() - new Date(a.data + 'T00:00:00').getTime()
  );

  sortedVisits.forEach((visit, index) => {
    // Verificar se precisa de nova página
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    const family = families.find(f => f.id === visit.familyId);
    const familyName = family?.nomeAssistido || 'Desconhecido';

    // Box do card da visita
    doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
    doc.rect(margin, yPos - 5, maxWidth, 45, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos - 5, maxWidth, 45);

    // Número da visita
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
    doc.text(`Visita #${index + 1}`, margin + 5, yPos);

    // Data
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Data:', margin + 5, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(visit.data), margin + 25, yPos + 7);

    // Família
    doc.setFont('helvetica', 'bold');
    doc.text('Família:', margin + 5, yPos + 13);
    doc.setFont('helvetica', 'normal');
    const familyLines = splitText(doc, familyName, maxWidth - 40);
    familyLines.forEach((line, i) => {
      doc.text(line, margin + 35, yPos + 13 + (i * 4));
    });
    const familyHeight = familyLines.length * 4;

    // Motivo
    if (visit.motivo) {
      doc.setFont('helvetica', 'bold');
      doc.text('Motivo:', margin + 5, yPos + 19 + familyHeight);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
      doc.text(visit.motivo, margin + 30, yPos + 19 + familyHeight);
      doc.setTextColor(0, 0, 0);
    }

    // Vicentinos
    if (visit.vicentinos && visit.vicentinos.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Vicentinos:', margin + 5, yPos + 25 + familyHeight);
      doc.setFont('helvetica', 'normal');
      doc.text(visit.vicentinos.join(', '), margin + 40, yPos + 25 + familyHeight);
    }

    // Relato (se houver espaço)
    if (visit.relato && yPos + 35 + familyHeight < pageHeight - 20) {
      doc.setFont('helvetica', 'bold');
      doc.text('Relato:', margin + 5, yPos + 31 + familyHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const relatoLines = splitText(doc, visit.relato.substring(0, 100) + (visit.relato.length > 100 ? '...' : ''), maxWidth - 10);
      relatoLines.forEach((line, i) => {
        doc.text(line, margin + 5, yPos + 35 + familyHeight + (i * 4));
      });
    }

    yPos += 50 + familyHeight;
    
    // Espaço entre visitas
    if (index < sortedVisits.length - 1) {
      yPos += 5;
    }
  });

    doc.save('lista-visitas.pdf');
  } catch (error) {
    console.error('Erro ao gerar PDF de visitas:', error);
    throw error;
  }
}

// Gerar PDF da lista de entregas
export function generateDeliveriesPDF(deliveries: Delivery[], families: Family[]): void {
  try {
    const doc = new jsPDF();
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const maxWidth = 170;

  // Cabeçalho principal colorido
  yPos = addColoredHeader(doc, 'LISTA DE ENTREGAS', COLORS.warning, yPos, margin, maxWidth);
  yPos += 8;

  // Data de geração em box destacado
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 4, maxWidth, 6, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos - 4, maxWidth, 6);
  doc.setTextColor(80, 80, 80);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin + 3, yPos);
  yPos += 10;

  if (deliveries.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Nenhuma entrega registrada.', margin, yPos);
    doc.save('lista-entregas.pdf');
    return;
  }

  // Estatísticas em box destacado
  const delivered = deliveries.filter(d => d.status === 'Entregue').length;
  const lightWarning = {
    r: Math.min(255, COLORS.warning.r + 240),
    g: Math.min(255, COLORS.warning.g + 240),
    b: Math.min(255, COLORS.warning.b + 240)
  };
  doc.setFillColor(lightWarning.r, lightWarning.g, lightWarning.b);
  doc.rect(margin, yPos - 4, maxWidth, 8, 'F');
  doc.setDrawColor(COLORS.warning.r, COLORS.warning.g, COLORS.warning.b);
  doc.rect(margin, yPos - 4, maxWidth, 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.warning.r, COLORS.warning.g, COLORS.warning.b);
  doc.text(`Total: ${deliveries.length} entrega${deliveries.length !== 1 ? 's' : ''}  |  ${delivered} entregue${delivered !== 1 ? 's' : ''}`, margin + 3, yPos);
  yPos += 12;

  // Ordenar por data (mais recente primeiro)
  const sortedDeliveries = [...deliveries].sort((a, b) => 
    new Date(b.data + 'T00:00:00').getTime() - new Date(a.data + 'T00:00:00').getTime()
  );

  sortedDeliveries.forEach((delivery, index) => {
    // Verificar se precisa de nova página
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    const family = families.find(f => f.id === delivery.familyId);
    const familyName = family?.nomeAssistido || 'Desconhecido';
    const statusColor = getStatusColor(delivery.status || '');

    // Box do card da entrega
    doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
    doc.rect(margin, yPos - 5, maxWidth, 50, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos - 5, maxWidth, 50);

    // Número da entrega
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.warning.r, COLORS.warning.g, COLORS.warning.b);
    doc.text(`Entrega #${index + 1}`, margin + 5, yPos);

    // Data
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Data:', margin + 5, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(delivery.data), margin + 25, yPos + 7);

    // Família
    doc.setFont('helvetica', 'bold');
    doc.text('Família:', margin + 5, yPos + 13);
    doc.setFont('helvetica', 'normal');
    const familyLines = splitText(doc, familyName, maxWidth - 40);
    familyLines.forEach((line, i) => {
      doc.text(line, margin + 35, yPos + 13 + (i * 4));
    });

    // Tipo e Status lado a lado
    if (delivery.tipo) {
      doc.setFont('helvetica', 'bold');
      doc.text('Tipo:', margin + 5, yPos + 19);
      doc.setFont('helvetica', 'normal');
      doc.text(delivery.tipo, margin + 30, yPos + 19);
    }

    if (delivery.status) {
      doc.setFont('helvetica', 'bold');
      doc.text('Status:', margin + 100, yPos + 19);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
      doc.text(delivery.status, margin + 125, yPos + 19);
      doc.setTextColor(0, 0, 0);
    }

    // Responsável
    if (delivery.responsavel) {
      doc.setFont('helvetica', 'bold');
      doc.text('Responsável:', margin + 5, yPos + 25);
      doc.setFont('helvetica', 'normal');
      doc.text(delivery.responsavel, margin + 50, yPos + 25);
    }

    // Retirado por
    if (delivery.retiradoPor) {
      doc.setFont('helvetica', 'bold');
      doc.text('Retirado por:', margin + 5, yPos + 31);
      doc.setFont('helvetica', 'normal');
      doc.text(delivery.retiradoPor, margin + 45, yPos + 31);
    }

    yPos += 55;
    
    // Espaço entre entregas
    if (index < sortedDeliveries.length - 1) {
      yPos += 5;
    }
  });

    doc.save('lista-entregas.pdf');
  } catch (error) {
    console.error('Erro ao gerar PDF de entregas:', error);
    throw error;
  }
}

// Gerar PDF do perfil da família
export function generateFamilyProfilePDF(
  family: Family,
  members: Member[],
  visits: Visit[],
  deliveries: Delivery[]
): void {
  try {
    const doc = new jsPDF();
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const maxWidth = 170;

  // Cabeçalho principal colorido
  yPos = addColoredHeader(doc, 'PERFIL DA FAMÍLIA', COLORS.purple, yPos, margin, maxWidth);
  yPos += 5;

  // Nome da família destacado
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.purple.r, COLORS.purple.g, COLORS.purple.b);
  const nomeLines = splitText(doc, family.nomeAssistido || 'Sem nome', maxWidth);
  nomeLines.forEach((line, i) => {
    doc.text(line, margin, yPos + (i * 7));
  });
  yPos += nomeLines.length * 7 + 3;

  // Ficha destacada
  if (family.ficha) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.text(`Ficha #${family.ficha}`, margin, yPos);
    yPos += 5;
  }

  // Data de geração
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin, yPos);
  yPos += 10;

  // ===== DADOS DA FAMÍLIA =====
  yPos = addColoredHeader(doc, 'DADOS DA FAMÍLIA', COLORS.primary, yPos, margin, maxWidth);
  yPos += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const familyData = [
    ['Data de Cadastro:', formatDate(family.dataCadastro || '')],
    ['Estado Civil:', family.estadoCivil || '-'],
    ['Data de Nascimento:', formatDate(family.nascimento || '')],
    ['Idade:', family.idade ? `${family.idade} anos` : '-'],
    ['CPF:', family.cpf || '-'],
    ['RG:', family.rg || '-'],
    ['Endereço:', family.endereco || '-'],
    ['Bairro:', family.bairro || '-'],
    ['Telefone:', family.telefone || '-'],
    ['WhatsApp:', family.whatsapp ? 'Sim' : 'Não'],
    ['Filhos:', family.filhos ? 'Sim' : 'Não'],
    ['Quantidade de Filhos:', family.filhosCount?.toString() || '-'],
    ['Total de Moradores:', family.moradoresCount?.toString() || '-'],
    ['Renda:', family.renda || '-'],
    ['Comorbidade:', family.comorbidade || '-'],
    ['Situação do Imóvel:', family.situacaoImovel || '-'],
  ];

  familyData.forEach(([label, value]) => {
    if (yPos > pageHeight - 35) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(label, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const valueLines = splitText(doc, value, maxWidth - 75);
    valueLines.forEach((line, i) => {
      doc.text(line, margin + 75, yPos + (i * 4.5));
    });
    yPos += Math.max(valueLines.length * 4.5, 7);
  });

  // Status destacado
  if (family.status) {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }
    const statusColor = getStatusColor(family.status);
    yPos = addColoredBox(doc, 'Status', family.status, margin, yPos, statusColor, maxWidth);
    yPos += 5;
  }

  // Observação
  if (family.observacao) {
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }
    yPos += 3;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Observação:', margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
    const obsLines = splitText(doc, family.observacao, maxWidth - 8);
    const obsHeight = Math.max(obsLines.length * 4 + 6, 12);
    doc.rect(margin, yPos - 3, maxWidth, obsHeight, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, yPos - 3, maxWidth, obsHeight);
    obsLines.forEach((line, i) => {
      doc.text(line, margin + 4, yPos + (i * 4));
    });
    yPos += obsHeight + 8;
  }

  // ===== MEMBROS =====
  if (members.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 8; // Espaçamento antes do cabeçalho da seção
    yPos = addColoredHeader(doc, `MEMBROS DA FAMÍLIA (${members.length})`, COLORS.success, yPos, margin, maxWidth);
    yPos += 2; // Espaçamento reduzido após o cabeçalho para ficar próximo do primeiro item

    doc.setFontSize(9);
    members.forEach((member, index) => {
      // Calcular altura necessária antes de desenhar
      const memberData = [
        ['Parentesco:', member.parentesco || '-'],
        ['Nascimento:', formatDate(member.nascimento || '')],
        ['Idade:', member.idade ? `${member.idade} anos` : '-'],
        ['Ocupação:', member.ocupacao || '-'],
        ['Renda:', member.renda || '-'],
        ['Comorbidade:', member.comorbidade || '-'],
        ['Escolaridade:', member.escolaridade || '-'],
        ['Trabalho:', member.trabalho || '-'],
      ];
      
      let estimatedHeight = 25; // Cabeçalho + espaçamento
      estimatedHeight += memberData.length * 5; // Dados
      if (member.observacaoOcupacao) {
        const obsLines = splitText(doc, member.observacaoOcupacao, maxWidth - 10);
        estimatedHeight += 6 + (obsLines.length * 3.5);
      }
      
      if (yPos + estimatedHeight > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }

      // Box do membro com altura dinâmica
      doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
      doc.rect(margin, yPos - 4, maxWidth, estimatedHeight, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(margin, yPos - 4, maxWidth, estimatedHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      doc.text(`Membro ${index + 1}: ${member.nome || '-'}`, margin + 4, yPos);
      yPos += 7;

      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      
      let memberYPos = yPos;
      memberData.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(label, margin + 5, memberYPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const valueLines = splitText(doc, value, maxWidth - 55);
        valueLines.forEach((line, i) => {
          doc.text(line, margin + 50, memberYPos + (i * 4));
        });
        memberYPos += Math.max(valueLines.length * 4, 5);
      });

      if (member.observacaoOcupacao) {
        memberYPos += 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text('Observação Ocupação:', margin + 5, memberYPos);
        memberYPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        const obsLines = splitText(doc, member.observacaoOcupacao, maxWidth - 10);
        obsLines.forEach((line, i) => {
          doc.text(line, margin + 5, memberYPos + (i * 3.5));
        });
        memberYPos += obsLines.length * 3.5;
      }

      yPos = memberYPos + 8;
      
      if (index < members.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, margin + maxWidth, yPos);
        yPos += 8;
      }
    });
  }

  // ===== VISITAS =====
  if (visits.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 8; // Espaçamento antes do cabeçalho da seção
    yPos = addColoredHeader(doc, `HISTÓRICO DE VISITAS (${visits.length})`, COLORS.success, yPos, margin, maxWidth);
    yPos += 2; // Espaçamento reduzido após o cabeçalho para ficar próximo do primeiro item

    doc.setFontSize(9);
    visits.sort((a, b) => 
      new Date(b.data + 'T00:00:00').getTime() - new Date(a.data + 'T00:00:00').getTime()
    ).forEach((visit, index) => {
      // Espaçamento antes da visita (exceto a primeira)
      if (index > 0) {
        yPos += 10;
      }
      
      // Calcular altura necessária com margem de segurança
      let estimatedHeight = 25; // Cabeçalho + espaçamento superior e inferior
      if (visit.motivo) {
        const motivoLines = splitText(doc, visit.motivo, maxWidth - 45);
        estimatedHeight += 8 + (motivoLines.length * 4.5);
      }
      if (visit.vicentinos && visit.vicentinos.length > 0) {
        const vicentinosText = visit.vicentinos.join(', ');
        const vicLines = splitText(doc, vicentinosText, maxWidth - 45);
        estimatedHeight += 8 + (vicLines.length * 4.5);
      }
      if (visit.relato) {
        const relatoLines = splitText(doc, visit.relato, maxWidth - 10);
        estimatedHeight += 10 + (relatoLines.length * 4);
      }
      
      // Verificar se precisa de nova página ANTES de desenhar
      if (yPos + estimatedHeight > pageHeight - 25) {
        doc.addPage();
        yPos = 20;
      }

      // Calcular posição inicial do box
      const boxStartY = yPos;

      // Desenhar box ANTES do conteúdo para não cobrir o texto
      doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
      doc.rect(margin, boxStartY - 4, maxWidth, estimatedHeight, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(margin, boxStartY - 4, maxWidth, estimatedHeight);

      // Cabeçalho da visita
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      doc.text(`Visita ${index + 1} - ${formatDate(visit.data)}`, margin + 4, yPos);
      yPos += 8;

      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      
      // Motivo com quebra de linha
      if (visit.motivo) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Motivo:', margin + 4, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
        const motivoLines = splitText(doc, visit.motivo, maxWidth - 45);
        motivoLines.forEach((line, i) => {
          doc.text(line, margin + 30, yPos + (i * 4.5));
        });
        doc.setTextColor(0, 0, 0);
        yPos += Math.max(motivoLines.length * 4.5, 7);
      }

      // Vicentinos com quebra de linha
      if (visit.vicentinos && visit.vicentinos.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Vicentinos:', margin + 4, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const vicentinosText = visit.vicentinos.join(', ');
        const vicLines = splitText(doc, vicentinosText, maxWidth - 45);
        vicLines.forEach((line, i) => {
          doc.text(line, margin + 40, yPos + (i * 4.5));
        });
        yPos += Math.max(vicLines.length * 4.5, 7);
      }

      // Relato com quebra de linha adequada
      if (visit.relato) {
        yPos += 3;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Relato:', margin + 4, yPos);
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        // Usar largura menor para garantir quebra adequada - reduzir ainda mais para palavras longas
        const relatoLines = splitText(doc, visit.relato, maxWidth - 12);
        relatoLines.forEach((line, i) => {
          // Verificar se precisa de nova página durante o relato
          if (yPos > pageHeight - 15) {
            doc.addPage();
            yPos = 20;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('(continuação)', margin + 4, yPos);
            yPos += 5;
          }
          // Verificar se a linha individual não ultrapassa
          const lineWidth = doc.getTextWidth(line);
          if (lineWidth > maxWidth - 12) {
            // Se ainda ultrapassar, quebrar mais
            const subLines = splitText(doc, line, maxWidth - 12);
            subLines.forEach((subLine, j) => {
              if (yPos > pageHeight - 15) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(subLine, margin + 4, yPos);
              yPos += 4;
            });
          } else {
            doc.text(line, margin + 4, yPos);
            yPos += 4;
          }
        });
        yPos += 4; // Espaçamento final do relato
      }

      yPos += 6; // Espaçamento final após o conteúdo
    });
  }

  // ===== ENTREGAS =====
  if (deliveries.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 8; // Espaçamento antes do cabeçalho da seção
    yPos = addColoredHeader(doc, `HISTÓRICO DE ENTREGAS (${deliveries.length})`, COLORS.warning, yPos, margin, maxWidth);
    yPos += 2; // Espaçamento reduzido após o cabeçalho para ficar próximo do primeiro item

    doc.setFontSize(9);
    deliveries.sort((a, b) => 
      new Date(b.data + 'T00:00:00').getTime() - new Date(a.data + 'T00:00:00').getTime()
    ).forEach((delivery, index) => {
      // Calcular altura necessária
      let estimatedHeight = 20; // Cabeçalho + espaçamento
      if (delivery.tipo) estimatedHeight += 6;
      if (delivery.status) estimatedHeight += 6;
      if (delivery.responsavel) estimatedHeight += 6;
      if (delivery.retiradoPor) estimatedHeight += 6;
      if (delivery.observacoes) {
        const obsLines = splitText(doc, delivery.observacoes, maxWidth - 12);
        estimatedHeight += 8 + (obsLines.length * 4);
      }
      
      if (yPos + estimatedHeight > pageHeight - 25) {
        doc.addPage();
        yPos = 20;
      }

      // Calcular posição inicial do box
      const boxStartY = yPos;

      // Desenhar box ANTES do conteúdo para não cobrir o texto
      doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
      doc.rect(margin, boxStartY - 4, maxWidth, estimatedHeight, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(margin, boxStartY - 4, maxWidth, estimatedHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(COLORS.warning.r, COLORS.warning.g, COLORS.warning.b);
      doc.text(`Entrega ${index + 1} - ${formatDate(delivery.data)}`, margin + 4, yPos);
      yPos += 8;

      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      if (delivery.tipo) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Tipo:', margin + 4, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const tipoLines = splitText(doc, delivery.tipo, maxWidth - 45);
        tipoLines.forEach((line, i) => {
          doc.text(line, margin + 28, yPos + (i * 4.5));
        });
        yPos += Math.max(tipoLines.length * 4.5, 7);
      }

      if (delivery.status) {
        const statusColor = getStatusColor(delivery.status);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Status:', margin + 4, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
        doc.text(delivery.status, margin + 30, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 6;
      }

      if (delivery.responsavel) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Responsável:', margin + 4, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const respLines = splitText(doc, delivery.responsavel, maxWidth - 45);
        respLines.forEach((line, i) => {
          doc.text(line, margin + 42, yPos + (i * 4.5));
        });
        yPos += Math.max(respLines.length * 4.5, 7);
      }

      if (delivery.retiradoPor) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Retirado por:', margin + 4, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const retiradoLines = splitText(doc, delivery.retiradoPor, maxWidth - 45);
        retiradoLines.forEach((line, i) => {
          doc.text(line, margin + 42, yPos + (i * 4.5));
        });
        yPos += Math.max(retiradoLines.length * 4.5, 7);
      }

      if (delivery.observacoes) {
        yPos += 3;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Observações:', margin + 4, yPos);
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        const obsLines = splitText(doc, delivery.observacoes, maxWidth - 12);
        obsLines.forEach((line, i) => {
          // Verificar se precisa de nova página
          if (yPos > pageHeight - 15) {
            doc.addPage();
            yPos = 20;
          }
          // Verificar se a linha individual não ultrapassa
          const lineWidth = doc.getTextWidth(line);
          if (lineWidth > maxWidth - 12) {
            const subLines = splitText(doc, line, maxWidth - 12);
            subLines.forEach((subLine, j) => {
              if (yPos > pageHeight - 15) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(subLine, margin + 4, yPos);
              yPos += 4;
            });
          } else {
            doc.text(line, margin + 4, yPos);
            yPos += 4;
          }
        });
        yPos += 4;
      }

      yPos += 6; // Espaçamento final após o conteúdo
    });
  }

    const fileName = `perfil-familia-${family.ficha || family.id}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Erro ao gerar PDF do perfil da família:', error);
    throw error;
  }
}
