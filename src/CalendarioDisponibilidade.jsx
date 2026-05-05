// src/CalendarioDisponibilidade.jsx
// Calendário de disponibilidade inline para o Portal do Colaborador
// Layout de 2 colunas: Calendário (8/12) e Sidebar de Horário (4/12)

import React, { useState, useEffect } from 'react';
import { api } from './utils/apiClient';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ArrowLeft, Plus, User, AlertTriangle, ArrowRight } from 'lucide-react';

const mesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Slots representativos do horário comercial principal (7h–18h = 12 slots)
const SLOTS_VERIFICACAO = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
// Para definir "totalmente bloqueado" usamos apenas o horário COMERCIAL (7h-18h)
const SLOTS_COMERCIAIS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export default function CalendarioDisponibilidade({ item, onVoltar, onReservar }) {
  const [mesAtual, setMesAtual] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [horaReserva, setHoraReserva] = useState('08:00');
  const [horaRetornoCustom, setHoraRetornoCustom] = useState('18:00');
  const [ags, setAgs] = useState([]);
  const [emps, setEmps] = useState([]);

  // SELEÇÃO DE INTERVALO: 1º clique = retirada, 2º clique = retorno
  const [diaSelecionado, setDiaSelecionado] = useState(null);   // dia de retirada
  const [diaRetorno, setDiaRetorno] = useState(null);           // dia de retorno
  const [etapa, setEtapa] = useState('retirada');               // 'retirada' | 'retorno'

  const wrap = (obj) => {
    if (!obj) return null;
    return {
      ...obj,
      id: obj.id,
      createdAt: new Date(obj.created_at || obj.createdAt),
      get: (field) => {
        if ((field === 'data_reserva' || field === 'data_inicio' || field === 'data_inicio_prevista') && (obj.data_inicio_prevista || obj.data_inicio || obj.data_reserva)) return new Date(obj.data_inicio_prevista || obj.data_inicio || obj.data_reserva);
        if (field === 'data_devolucao_prevista' && obj.data_devolucao_prevista) return new Date(obj.data_devolucao_prevista);
        if (field === 'data_hora_retorno') return obj.data_hora_retorno ? new Date(obj.data_hora_retorno) : null;
        if (field === 'quantidade') return obj.quantidade_emprestada || obj.quantidade || 1;
        if (field === 'solicitante') return obj.nome_solicitante || obj.solicitante;
        return obj[field];
      }
    };
  };

  const patrimonio = item?.patrimonio_total || (typeof item?.get === 'function' ? item.get('quantidade') : item?.quantidade) || 1;

  // Empréstimos ativos bloqueiam desde o início previsto até o fim previsto
  const calcOcupadoEm = (hora, minuto, dia, agendamentos, emprestimos) => {
    const ts = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, minuto, 0);
    let qtd = 0;
    
    const todos = [...agendamentos, ...emprestimos];
    
    for (const obj of todos) {
      const status = obj.get('status_emprestimo');
      
      let ini;
      if (status === 'Aberto') {
        // Item fisicamente fora: bloqueado desde o momento da retirada real (created_at)
        // não desde o horário agendado originalmente
        ini = obj.createdAt || new Date();
      } else {
        ini = obj.get('data_inicio_prevista') || obj.createdAt;
      }
      
      const fimRaw = obj.get('data_hora_retorno') || obj.get('data_devolucao_prevista');
      const fim = fimRaw || (status === 'Aberto' ? new Date(2100,0,1) : ini);
      
      if (ini <= ts && fim >= ts) qtd += obj.get('quantidade');
    }
    return qtd;
  };

  const getOcupacoesDoDia = (dia) => {
    if (!dia) return [];
    const dIn = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, 0, 0);
    const dFim = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 59, 59);
    const resultado = [];
    
    const todos = [...ags, ...emps];
    for (const obj of todos) {
      const status = obj.get('status_emprestimo');
      
      let ini;
      if (status === 'Aberto') {
        // Item fisicamente fora: considera desde o momento real da retirada
        ini = obj.createdAt || new Date();
      } else {
        ini = obj.get('data_inicio_prevista') || obj.createdAt;
      }
      
      const fimRaw = obj.get('data_hora_retorno') || obj.get('data_devolucao_prevista');
      const fim = fimRaw || (status === 'Aberto' ? new Date(2100,0,1) : ini);
      
      if (ini <= dFim && fim >= dIn) {
        resultado.push({
          tipo: status === 'Aberto' ? 'emprestimo' : 'agendamento',
          nome: obj.get('solicitante'),
          setor: obj.get('setor_solicitante') || '',
          inicio: ini, fim: fim,
          quantidade: obj.get('quantidade'),
        });
      }
    }
    return resultado;
  };

  const fetchDados = async () => {
    if (!item) return;
    setLoading(true);
    try {
      const itemId = item.id;
      // Unified query just from emprestimo
      const { data, error } = await api.emprestimos.list({
        item_id: itemId,
        in_status: 'Aprovado,Pendente,Aberto'
      });
      if (error) throw new Error(error);
      
      setEmps((data || []).map(e => wrap(e)));
      setAgs([]); // we leave ags empty since we unified
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDados(); }, [mesAtual, item]);

  const getInfoDia = (dia) => {
    if (!dia) return null;
    let maxOcup = 0;
    let slotsComercLotados = 0;
    for (const h of SLOTS_VERIFICACAO) {
      const oc = calcOcupadoEm(h, 0, dia, ags, emps);
      if (oc > maxOcup) maxOcup = oc;
    }
    // Verifica apenas horário comercial para definir "totalmente bloqueado"
    for (const h of SLOTS_COMERCIAIS) {
      const oc = calcOcupadoEm(h, 0, dia, ags, emps);
      if (oc >= patrimonio) slotsComercLotados++;
    }
    if (maxOcup === 0 && getOcupacoesDoDia(dia).length > 0) maxOcup = 1;
    // Totalmente bloqueado = todos os slots comerciais (7h-18h) estão lotados
    const totalmenteBloq = slotsComercLotados === SLOTS_COMERCIAIS.length && maxOcup >= patrimonio;
    return { maxOcup, totalmenteBloq };
  };

  const mudarMes = (dir) => {
    const novo = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + dir, 1);
    setMesAtual(novo);
    setDiaSelecionado(null);
    setDiaRetorno(null);
    setEtapa('retirada');
  };

  const isMesmoDia = (d1, d2) => d1 && d2 && d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const isNoPeriodo = (dia) => diaSelecionado && diaRetorno && dia > diaSelecionado && dia < diaRetorno;

  const primDiaSem = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).getDay();
  const dNoMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate();
  const dias = [];
  for (let i = 0; i < primDiaSem; i++) dias.push(null);
  for (let d = 1; d <= dNoMes; d++) dias.push(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), d));

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  // Clique no calendário com lógica de 2 etapas
  const handleClickDia = (dia) => {
    if (etapa === 'retirada') {
      setDiaSelecionado(dia);
      setDiaRetorno(null);
      setEtapa('retorno');
    } else {
      // Clique na etapa de retorno
      if (dia < diaSelecionado) {
        // Se clicou antes da retirada, reinicia
        setDiaSelecionado(dia);
        setDiaRetorno(null);
        setEtapa('retorno');
      } else if (isMesmoDia(dia, diaSelecionado)) {
        // Mesmo dia = retorno no mesmo dia
        setDiaRetorno(dia);
        setEtapa('retirada');
      } else {
        setDiaRetorno(dia);
        setEtapa('retirada');
      }
    }
  };

  const [horaH, horaM] = horaReserva.split(':').map(Number);
  const ocupadoNoHorario = diaSelecionado ? calcOcupadoEm(horaH, horaM || 0, diaSelecionado, ags, emps) : 0;
  const livreNoHorario = patrimonio - ocupadoNoHorario;
  
  const isPassado = diaSelecionado ? new Date(diaSelecionado.getFullYear(), diaSelecionado.getMonth(), diaSelecionado.getDate(), horaH, horaM || 0, 0) < new Date() : false;
  const podereservar = diaSelecionado && livreNoHorario > 0 && diaSelecionado >= hoje && diaRetorno && !isPassado;

  const ocupacoesDoDiaSelecionado = diaSelecionado ? getOcupacoesDoDia(diaSelecionado) : [];

  const handleReservar = () => {
    if (!podereservar) return;
    const dateStr = diaSelecionado.toISOString().split('T')[0];
    const dataRetStr = diaRetorno.toISOString().split('T')[0];
    if (onReservar) onReservar({ data: dateStr, hora: horaReserva, dataRetorno: dataRetStr, horaRetorno: horaRetornoCustom, item });
  };

  const formatDataHora = (date) => {
    if (!date) return '--';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 h-full animate-in fade-in duration-500 pb-0 transition-colors duration-300 overflow-y-auto xl:overflow-hidden">
      {/* Coluna 1: Calendário (8/12) */}
      <div className="xl:col-span-8 bg-[var(--bg-card)] rounded-[2rem] xl:rounded-[2.5rem] p-4 sm:p-6 flex flex-col transition-colors duration-300 h-auto xl:h-[calc(100vh-130px)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 xl:mb-6 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={onVoltar} className="p-2 sm:p-2.5 bg-[var(--bg-page)] text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all"><ArrowLeft size={16}/></button>
            <div className="p-2 sm:p-3 bg-[var(--bg-page)] rounded-2xl text-[#10B981]"><CalendarDays size={20} strokeWidth={1.5} /></div>
            <div>
              <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight line-clamp-1">{typeof item?.get === 'function' ? item.get('nome_equipamento') : item?.nome_equipamento}</h2>
              <div className="flex items-center gap-3 sm:gap-4 mt-0.5 sm:mt-1">
                <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-[#606060] font-bold uppercase tracking-widest">{mesNomes[mesAtual.getMonth()]} {mesAtual.getFullYear()} · {patrimonio} un.</p>
                <div className="hidden sm:flex items-center gap-3 border-l border-white/10 pl-4">
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Livre</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div><span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Parcial</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div><span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Indispon.</span></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between md:justify-end gap-3">
            {/* Instrução Dinâmica */}
            <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${etapa === 'retirada' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'}`}>
              {etapa === 'retirada' ? <><CalendarDays size={10} /> 1º Clique: Retirada</> : <><ArrowRight size={10} /> 2º Clique: Retorno</>}
            </div>

            {/* Navegação */}
            <div className="flex items-center gap-1 bg-[var(--bg-page)] p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-white/5 shadow-sm">
              <button onClick={() => mudarMes(-1)} className="p-2 sm:p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg sm:rounded-xl transition-all hover:bg-white/5"><ChevronLeft size={14}/></button>
              <button onClick={() => mudarMes(1)} className="p-2 sm:p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg sm:rounded-xl transition-all hover:bg-white/5"><ChevronRight size={14}/></button>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg-page)] rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 transition-colors duration-300 flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 gap-1 sm:gap-4 mb-2 sm:mb-3 text-center shrink-0">
            {diasSemana.map(d => <div key={d} className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-[#606060]">{d}</div>)}
          </div>
          {loading ? (
            <div className="flex items-center justify-center flex-1 py-10"><div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <div className="grid grid-cols-7 gap-1 flex-1 h-full min-h-[300px]">
              {dias.map((dia, index) => {
                if (!dia) return <div key={`e${index}`} className="h-full min-h-[45px] sm:min-h-[60px] rounded-lg sm:rounded-xl bg-transparent"></div>;
                const info = getInfoDia(dia);
                const passado = dia < hoje;
                const isRetirada = isMesmoDia(dia, diaSelecionado);
                const isRetorno = isMesmoDia(dia, diaRetorno);
                const noIntervalo = isNoPeriodo(dia);
                const isToday = isMesmoDia(dia, new Date());

                let bgClass = 'bg-[var(--bg-card)] ';
                let dotColor = '#10B981';
                let label = 'Livre';

                if (info) {
                  if (info.maxOcup > 0) {
                    if (info.totalmenteBloq) {
                      bgClass = 'bg-red-50/60 dark:bg-red-900/10 cursor-pointer hover:bg-red-100/60 dark:hover:bg-red-900/20';
                      dotColor = '#EF4444'; label = 'Indispon.';
                    } else {
                      bgClass = 'bg-amber-50/60 dark:bg-amber-900/10';
                      dotColor = '#F59E0B'; label = `${Math.max(0, patrimonio - info.maxOcup)}/${patrimonio}`;
                    }
                  } else {
                    bgClass = 'bg-emerald-50/60 dark:bg-emerald-900/10';
                  }
                }

                if (passado) {
                  bgClass = 'bg-[var(--bg-page)] opacity-30 cursor-not-allowed';
                } else if (isRetirada) {
                  bgClass = 'bg-[#10B981] cursor-pointer shadow-lg shadow-emerald-500/20';
                } else if (isRetorno) {
                  bgClass = 'bg-amber-500 cursor-pointer shadow-lg shadow-amber-500/20';
                } else if (noIntervalo) {
                  bgClass = 'bg-[#10B981]/10 cursor-pointer';
                } else if (etapa === 'retorno' && diaSelecionado && dia >= diaSelecionado) {
                  bgClass += ' hover:bg-amber-500/20 cursor-pointer';
                } else if (!info?.totalmenteBloq) {
                  bgClass += ' hover:ring-1 hover:ring-slate-300 dark:hover:ring-white/10 cursor-pointer';
                }

                if (isToday && !isRetirada && !isRetorno) bgClass += ' ring-1 ring-inset ring-slate-300 dark:ring-white/10';

                const clickavel = !passado;

                return (
                  <div
                    key={index}
                    onClick={() => clickavel && handleClickDia(dia)}
                    className={`h-full min-h-[45px] sm:min-h-[60px] rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 flex flex-col justify-between transition-all ${bgClass}`}
                  >
                    <span className={`text-[10px] sm:text-xs font-bold ${isRetirada || isRetorno ? 'text-white' : isToday ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#A0A0A0]'}`}>
                      {dia.getDate()}
                    </span>
                    {!passado && info && !isRetirada && !isRetorno && (
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full" style={{background: dotColor}}></div>
                        <span className="text-[6px] sm:text-[7px] font-black" style={{color: dotColor}}>{label}</span>
                      </div>
                    )}
                    {isRetirada && <span className="text-[6px] sm:text-[7px] font-black text-white uppercase tracking-tighter">Saída</span>}
                    {isRetorno && <span className="text-[6px] sm:text-[7px] font-black text-white uppercase tracking-tighter">Volta</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Coluna 2: Sidebar (4/12) */}
      <div className="xl:col-span-4 flex flex-col gap-5 h-auto xl:h-full xl:overflow-y-auto custom-scrollbar pb-10 xl:pb-0">
        <div className="bg-[var(--bg-card)] rounded-[2rem] xl:rounded-[2.5rem] p-6 flex flex-col transition-colors duration-300 shrink-0">
          <div className="pb-3 mb-3 border-b border-white/5 shrink-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Disponibilidade e Horário</h3>
            <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${etapa === 'retirada' ? 'text-[#10B981]' : 'text-amber-400'}`}>
              {!diaSelecionado
                ? 'Selecione o dia de retirada'
                : etapa === 'retorno'
                  ? 'Escolha o dia de retorno'
                  : diaSelecionado.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
            </p>
          </div>

          <div className="space-y-4">
            {!diaSelecionado ? (
              <div className="text-center py-6 flex flex-col items-center opacity-30">
                <CalendarDays size={24} className="text-slate-300 dark:text-[#404040] mb-3"/>
                <p className="text-[9px] text-slate-400 dark:text-[#606060] font-bold uppercase tracking-widest">Selecione uma data</p>
              </div>
            ) : (
              <>
                <div className="bg-[var(--bg-page)] p-3 rounded-xl flex items-center gap-2">
                  <div className="flex-1 text-center">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[#10B981] mb-0.5">Retirada</p>
                    <p className="text-xs font-black text-slate-900 dark:text-white">
                      {diaSelecionado.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-slate-400 shrink-0" />
                  <div className="flex-1 text-center">
                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-400 mb-0.5">Retorno</p>
                    <p className={`text-xs font-black ${diaRetorno ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#404040]'}`}>
                      {diaRetorno ? diaRetorno.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--'}
                    </p>
                  </div>
                </div>

                <div className="bg-[var(--bg-page)] p-4 rounded-xl space-y-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#606060] mb-1.5">Hora de Retirada</p>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-[#10B981] shrink-0"/>
                      <input type="time" value={horaReserva} onChange={e => setHoraReserva(e.target.value)} className="w-full bg-transparent border-b border-white/10 text-slate-900 dark:text-white py-1 outline-none text-xs font-bold" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#606060] mb-1.5">Hora de Retorno</p>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-amber-400 shrink-0"/>
                      <input type="time" value={horaRetornoCustom} onChange={e => setHoraRetornoCustom(e.target.value)} className="w-full bg-transparent border-b border-white/10 text-slate-900 dark:text-white py-1 outline-none text-xs font-bold" />
                    </div>
                  </div>

                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${livreNoHorario <= 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${livreNoHorario <= 0 ? 'bg-red-500' : 'bg-emerald-500'}`}/>
                    {livreNoHorario <= 0 ? 'Indisponível' : `${livreNoHorario} un. livre`}
                  </div>
                </div>

                {ocupacoesDoDiaSelecionado.length > 0 && (
                  <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {ocupacoesDoDiaSelecionado.map((oc, idx) => (
                      <div key={idx} className="bg-[var(--bg-page)] rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate">{oc.nome}</p>
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${oc.tipo === 'emprestimo' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {oc.tipo === 'emprestimo' ? 'SAÍDA' : 'AGENDA'}
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-500 font-bold mt-1">Até {formatDataHora(oc.fim)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleReservar}
                  disabled={!podereservar}
                  className="w-full py-3.5 bg-[#10B981] text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all hover:bg-[#059669] disabled:opacity-30"
                >
                  {!diaRetorno ? 'Selecione o Retorno' : 'Adicionar ao Carrinho'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
