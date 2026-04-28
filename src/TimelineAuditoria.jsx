import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { 
  Zap, Plus, Edit3, Trash2, ArrowUpRight, ArrowDownLeft, 
  User, CheckCircle2, AlertCircle, Clock, History
} from 'lucide-react';

export default function TimelineAuditoria({ triggerAtualizacao }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('log_auditoria')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        setLogs(data || []);
      } catch (error) {
        console.error("Erro ao buscar logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [triggerAtualizacao]);

  const getIcon = (acao) => {
    const act = (acao || '').toUpperCase();
    if (act.includes('CRIOU')) return { icon: Plus, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (act.includes('EDITOU')) return { icon: Edit3, color: 'text-blue-500', bg: 'bg-blue-500/10' };
    if (act.includes('EXCLUIU') || act.includes('DELETOU')) return { icon: Trash2, color: 'text-red-500', bg: 'bg-red-500/10' };
    if (act.includes('APROVOU') || act.includes('SAÍDA')) return { icon: ArrowUpRight, color: 'text-purple-500', bg: 'bg-purple-500/10' };
    if (act.includes('DEVOLVEU') || act.includes('RECEBEU') || act.includes('FECHOU')) return { icon: ArrowDownLeft, color: 'text-orange-500', bg: 'bg-orange-500/10' };
    return { icon: Zap, color: 'text-slate-500', bg: 'bg-[var(--bg-page)]0/10' };
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // segundos
    if (diff < 60) return 'agora';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString('pt-BR');
  };

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5 shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-2 bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5 rounded w-1/4"></div>
              <div className="p-3.5 bg-[var(--bg-soft)]  rounded-2xl text-[#254E70] shrink-0"><History size={24} strokeWidth={1.5} /></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-card)] rounded-[2rem] overflow-hidden">
      <div className="p-6 flex items-center justify-between bg-[var(--bg-page)]/30 dark:bg-transparent shrink-0">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Pulso do Sistema</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Atividade em tempo real</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="relative ml-3 pl-8 space-y-8">
          {logs.map((log, idx) => {
            const { icon: Icon, color, bg } = getIcon(log.acao);
            return (
              <div key={log.id} className="relative group">
                {/* Indicador de Timeline */}
                <div className={`absolute -left-[45px] top-0 w-8 h-8 rounded-full ${bg} ${color} flex items-center justify-center border-4 border-white dark:border-[var(--bg-card-dark)] transition-transform group-hover:scale-110`}>
                   <Icon size={14} />
                </div>

                <div className="flex flex-col">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>
                      {log.acao}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                      <Clock size={10} /> {formatTime(log.created_at)}
                    </span>
                  </div>
                  
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {log.item_nome || 'Sistema'}
                  </p>
                  
                  {log.detalhes && (
                    <p className="text-[11px] text-slate-500 dark:text-[#A0A0A0] mt-1 line-clamp-2 italic">
                      {log.detalhes}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-2 opacity-60">
                    <User size={10} className="text-slate-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {log.tecnico || 'Automação'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {logs.length === 0 && !loading && (
            <div className="text-center py-10 opacity-50">
              <Clock size={24} className="mx-auto mb-2" />
              <p className="text-[10px] font-bold uppercase">Nenhuma atividade registrada.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 bg-[var(--bg-page)]/50 /30 shrink-0">
         <p className="text-[8px] text-center font-black uppercase tracking-[0.2em] text-slate-400">Monitoramento Ativo de Auditoria</p>
      </div>
    </div>
  );
}
