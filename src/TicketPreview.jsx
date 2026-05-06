import React from 'react';
import { Clock, User, FileText, MessageSquare, AlertTriangle, ShieldCheck } from 'lucide-react';
import LogoImg from './assets/logo.jpg';

// 👇 Adicionada a URL base dinâmica puxando do .env do Vite
const API_BASE_URL = import.meta.env.VITE_CHAMADOS_API_BASE || 'http://localhost:3000/api';

export default function TicketPreview({ dados }) {
  // Variável com a exata estilização do sidebar (Tamanho, peso, cor, Sem uppercase)
  const titleSidebarStyle = "text-[13px] font-bold tracking-tight text-slate-500 dark:text-[#606060] block mb-2 normal-case";

  if (!dados) return null;

  const { 
    protocolo, assunto, status, nome, email, 
    created_at, criado_em, data, 
    observacao, prioridade, descricao, 
    telefone, numero, cpf 
  } = dados;

  const getStatusColor = (s) => {
    switch (s) {
      case 'Aberto': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20';
      case 'Em Atendimento': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20';
      case 'Concluído': return 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-500/10 border-neutral-200 dark:border-white/5';
      default: return 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-500/10 border-neutral-200 dark:border-white/5';
    }
  };

  // 👇 Função segura para data, evita erro de "Invalid Date" se o campo vier vazio
  const getSafeDate = (dateString) => {
    if (!dateString) return null;
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
  };

  const dataAbertura = getSafeDate(data) || getSafeDate(criado_em) || getSafeDate(created_at);

  return (
    <div className="ticket-container bg-[var(--bg-card)] backdrop-blur-xl flex flex-col flex-1 relative overflow-hidden min-h-full">
      {/* BRANDING COMPACTO */}
      <div className="text-center pt-6 px-6 md:px-10 pb-4 shrink-0 flex justify-between items-end border-b border-slate-200 dark:border-white/5">
        <div className="text-left">
          <h4 className={titleSidebarStyle}>Ordem de Serviço Técnica</h4>
          <p className="text-xl font-black text-slate-900 dark:text-white italic tracking-tighter">HELP DESK.</p>
        </div>
        <div className="text-right">
          <p className={titleSidebarStyle}>Protocolo</p>
          <p className="text-base font-black text-slate-900 dark:text-white">#{protocolo || 'N/A'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-6 md:px-10 py-4 space-y-4">
        {/* HEADER DATA COMPACTO */}
        <div className="bg-[var(--bg-soft)] p-5 rounded-[1.25rem]">
          <div className="flex justify-between items-start">
            <div className="space-y-3 text-[11px] text-slate-800 dark:text-slate-200 font-medium selection:bg-[#254E70] selection:text-white">
              <p className="font-bold text-slate-900 dark:text-white mb-2">Dados para inserir no chamado do INSS</p>

              <div className="space-y-1">
                <p>Nome: {nome || ''}</p>
                <p>OAB: {numero || ''}</p>
                <p>CPF: {cpf || ''}</p>
                <p>Email: {email || ''}</p>
                <p>Telefone: {telefone || ''}</p>
              </div>

              <div className="pt-2">
                <p>Ordem dos Advogados do Brasil - Secção Ceará</p>
                <p>07375512000181</p>
              </div>
            </div>

            <div className="text-right shrink-0 pl-4">
              <p className={titleSidebarStyle}>Abertura do Chamado</p>
              {dataAbertura ? (
                <p className="font-bold text-slate-900 dark:text-white text-[11px]">
                  {dataAbertura.toLocaleDateString('pt-BR')} às {dataAbertura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              ) : (
                <p className="font-bold text-slate-400 text-[11px]">Data indisponível</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 flex justify-between items-center">
            <div>
              <p className={titleSidebarStyle}>Situação Atual</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(status)}`}>
                {status}
              </span>
            </div>
            <div className="text-right">
              <p className={titleSidebarStyle}>Prioridade</p>
              <span className={`text-[9px] font-black uppercase tracking-widest ${prioridade === 'Urgente' ? 'text-red-500' : 'text-slate-400'}`}>
                {prioridade || 'Normal'}
              </span>
            </div>
          </div>
        </div>

        {/* CONTENT COMPACTO */}
        <div className="space-y-4">
          <div>
            <h4 className={titleSidebarStyle}>Assunto & Descrição</h4>
            <div className="bg-[var(--bg-soft)] p-5 rounded-[1.25rem]">
              <p className="font-black text-slate-900 dark:text-white text-xs mb-3 uppercase tracking-tight">{assunto}</p>
              <p className="text-slate-700 dark:text-[#A0A0A0] text-xs leading-relaxed italic whitespace-pre-wrap">"{descricao || 'Nenhuma descrição detalhada fornecida via portal.'}"</p>
            </div>
          </div>

          {observacao && (
            <div>
              <h4 className={titleSidebarStyle}>Resolução / Parecer</h4>
              <div className="bg-blue-50/50 dark:bg-[#254E70]/10 p-4 rounded-[1.25rem]">
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{observacao}</p>
              </div>
            </div>
          )}


        </div>
      </div>

      {/* FOOTER AUDIT COMPACTO */}
      <div className="pt-4 pb-6 px-6 md:px-10 shrink-0 flex justify-between items-center opacity-50 border-t border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span className="text-[8px] font-bold uppercase tracking-widest">Documento Auditado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm overflow-hidden">
            <img src={LogoImg} className="w-full h-full object-cover" alt="Logo" />
          </div>
          <p className="text-[8px] font-medium italic">TI LEND Management</p>
        </div>
      </div>
    </div>
  );
}