// src/DashboardMetricas.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { Package, Repeat, Users, ListChecks, Search, Printer, Download, MoreHorizontal, RotateCcw, Zap, ShieldCheck, CalendarDays, ChevronRight, Activity, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

/** 
 * 🎨 SISTEMA REGRAVÁVEL DE CORES (MODERNIZAÇÃO TI LEND)
 * Altere os valores abaixo para mudar instantaneamente a identidade visual:
 * Isso afeta Donuts, Gráficos de Área e os Degradês (Glows) do Cockpit.
 */
const COLORS = {
  azul: "#254E70",      // Azul Corporativo (Inbound/Operações)
  vermelho: "#8D3046",  // Vermelho Corporativo (Outbound/Uso)
  sucesso: "#10B981",   // Verde Sucesso (Concluídos)
  pendente: "#254E70",  // Azul para Pendências (Agendamentos)
  glow: "#254E70",      // Brilho Atmosférico Sincronizado
  chart: "#254E70",
  muted: "rgba(120, 120, 120, 0.05)"
};

// Memoiza o componente para evitar re-renders por conta do heartbeat do usuário logado
const DashboardMetricas = React.memo(({ triggerAtualizacao, usuarioAtual, onOpenDetails }) => {
  const [metricasTopo, setMetricasTopo] = useState({ estoque: 0, emprestados: 0, setoresCount: 0, setoresLista: [], comparativoMensal: '0 ➔ 0', variacaoTrend: '0%', variacaoPositiva: true });
  const [frasesInteligentes, setFrasesInteligentes] = useState([]);
  const [dados, setDados] = useState({ timeline: [], setoresRanking: [], historicoCompleto: [], statusDonut: [], rankingSetoresPedidos: [], comparativoSetores: [], heatmapMap: {} });

  const [buscaGeral, setBuscaGeral] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroGrafico, setFiltroGrafico] = useState('mes');
  const [recibo, setRecibo] = useState(null);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Novos estados para a Sidebar
  const [agentes, setAgentes] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [logSelecionado, setLogSelecionado] = useState(null);

  const resEmpCache = React.useRef(null);
  const resItensCache = React.useRef(null);
  const lastFingerprint = React.useRef(""); // Digital do estado do banco
  const lastAgentesStr = React.useRef(""); // Digital da lista de agentes
  const lastAtividadesStr = React.useRef(""); // Digital dos logs

  useEffect(() => {
    const fetchEverything = async () => {
      try {
        const [resEmp, resItens] = await Promise.all([
          supabase.from('emprestimo').select('*, item(*)').order('updated_at', { ascending: false }).limit(2000),
          supabase.from('item').select('*').order('updated_at', { ascending: false })
        ]);

        let empsMock = (resEmp.data || []).map(e => ({
          ...e,
          createdAt: new Date(e.created_at),
          updatedAt: new Date(e.updated_at),
          get: (field) => {
            if (field === 'item') return e.item ? { ...e.item, get: (ifield) => e.item[ifield] } : null;
            if (field === 'data_hora_retorno' && e.data_hora_retorno) return new Date(e.data_hora_retorno);
            return e[field];
          }
        }));

        const itensMock = (resItens.data || []).map(i => ({
          ...i,
          createdAt: new Date(i.created_at),
          updatedAt: new Date(i.updated_at),
          get: (field) => i[field]
        }));

        resEmpCache.current = empsMock;
        resItensCache.current = itensMock;
        processarTudo(empsMock, itensMock);
      } catch (e) { console.error("Erro Dashboard Heavy Sync:", e); }
    };

    const fetchLightData = async () => {
      try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const [resUsers, resLogs, resProbeEmp, resProbeLog] = await Promise.all([
          supabase.from('perfil').select('*').neq('tipo_usuario', 'solicitante').limit(200),
          supabase.from('log_auditoria').select('*').gte('created_at', hoje.toISOString()).order('created_at', { ascending: false }).limit(14),
          supabase.from('emprestimo').select('updated_at').order('updated_at', { ascending: false }).limit(1).single(),
          supabase.from('log_auditoria').select('created_at').order('created_at', { ascending: false }).limit(1).single()
        ]);

        // VERIFICAÇÃO INTELIGENTE DE MUDANÇA (FINGERPRINT)
        const currentFingerprint = `${new Date(resProbeEmp.data?.updated_at).getTime() || 0}-${new Date(resProbeLog.data?.created_at).getTime() || 0}`;
        if (currentFingerprint !== lastFingerprint.current) {
          lastFingerprint.current = currentFingerprint;
          fetchEverything(); // Muda detectada: Sincronização Pesada
        }

        // Processar Agentes (Lógica Inteligente de Fallback)
        const agora = new Date();
        const mapaAgentes = {};

        // 1. Prioridade: Usuários retornados pela query (Apenas Técnicos/TI)
        if (resUsers.data) {
          resUsers.data.forEach(u => {
            const nome = u.username || 'Usuário';
            const updatedAt = new Date(u.updated_at);
            mapaAgentes[nome.toLowerCase()] = {
              id: u.id,
              nome: nome,
              tipo: u.tipo_usuario || 'Técnico',
              online: (agora - updatedAt) < (45 * 1000), // Status Online Real-Time (45s de tolerância)
              foto: u.foto_perfil
            };
          });
        }

        // 2. Fallback: Extrair técnicos dos Empréstimos (se houver cache)
        if (resEmpCache.current) {
          resEmpCache.current.forEach(e => {
            const nomes = [e.get('nome_tecnico_saida'), e.get('nome_tecnico_retorno')].filter(Boolean);
            nomes.forEach(n => {
              const chave = n.toLowerCase();
              if (!mapaAgentes[chave]) {
                mapaAgentes[chave] = { id: `ext-${chave}`, nome: n, tipo: 'Técnico', online: false, foto: null };
              }
            });
          });
        }

        // 3. Fallback: Extrair técnicos dos Logs de Auditoria
        if (resLogs.data) {
          resLogs.data.forEach(l => {
            const n = l.tecnico;
            if (n && n !== 'Sistema / Automático') {
              const chave = n.toLowerCase();
              if (!mapaAgentes[chave]) {
                mapaAgentes[chave] = { id: `log-${chave}`, nome: n, tipo: 'Técnico', online: false, foto: null };
              }
            }
          });
        }

        const novosAgentes = Object.values(mapaAgentes)
          .filter(ag => ag.nome.toLowerCase() !== 'antigravity')
          .map(ag => {
            if (usuarioAtual && ag.nome.toLowerCase() === usuarioAtual.get('username')?.toLowerCase()) {
              return { ...ag, online: true };
            }
            return ag;
          }).sort((a, b) => b.online - a.online || a.nome.localeCompare(b.nome));

        // ESTABILIZAÇÃO AGENTES: Só atualiza se mudar
        const agentesStr = JSON.stringify(novosAgentes.map(a => ({ id: a.id, online: a.online, foto: a.foto })));
        if (agentesStr !== lastAgentesStr.current) {
          lastAgentesStr.current = agentesStr;
          setAgentes(novosAgentes);
        }

        // Processar Atividades de Hoje
        if (resLogs.data) {
          const novasAtividades = resLogs.data.map(l => ({
            id: l.id,
            acao: l.acao || 'Ação',
            item: l.item_nome || 'Item do Sistema',
            detalhes: l.detalhes || 'Sem detalhes adicionais registrados.',
            tecnico: l.tecnico || 'Sistema / Automático',
            hora: new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            dataCompleta: new Date(l.created_at).toLocaleString('pt-BR'),
            fullObj: l
          }));

          // ESTABILIZAÇÃO ATIVIDADES: Só atualiza se mudar
          const atividadesStr = JSON.stringify(novasAtividades.map(at => at.id));
          if (atividadesStr !== lastAtividadesStr.current) {
            lastAtividadesStr.current = atividadesStr;
            setAtividades(novasAtividades);
          }
        }

      } catch (e) { console.error("Erro Dashboard Pulse:", e); }
    };


    fetchEverything();
    fetchLightData();

    // Pulso Ultra-Rápido para Agentes, Logs e Detecção de Mudanças (Smart Sync)
    const fastInterval = setInterval(fetchLightData, 5000);

    return () => {
      clearInterval(fastInterval);
    };
  }, [triggerAtualizacao, filtroGrafico, usuarioAtual]);

  const processarTudo = (emps, itens) => {
    const agora = new Date();
    const hojeStart = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const tresDiasAtras = new Date(agora);
    tresDiasAtras.setDate(agora.getDate() - 3);

    const mesAtualStart = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const mesPassadoStart = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const mesPassadoEnd = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);

    const pedidosAtual = emps.filter(e => e.createdAt >= mesAtualStart).length;
    const pedidosPassado = emps.filter(e => e.createdAt >= mesPassadoStart && e.createdAt <= mesPassadoEnd).length;

    let variacao = 0;
    if (pedidosPassado > 0) { variacao = ((pedidosAtual - pedidosPassado) / pedidosPassado) * 100; }
    else if (pedidosAtual > 0) { variacao = 100; }

    const insightsRaw = [];
    const itensCriticos = itens.filter(i => (i.get('quantidade') || 0) <= 2);
    if (itensCriticos.length > 0) {
      const ultimaAt = new Date(Math.max(...itensCriticos.map(i => i.updatedAt)));
      insightsRaw.push({ id: 'critico', count: itensCriticos.length, text: itensCriticos.length === 1 ? 'requer atenção' : 'requerem atenção', time: ultimaAt, isAlert: true });
    }
    const devolvidosHoje = emps.filter(e => e.get('status_emprestimo') === 'Devolvido' && e.get('data_hora_retorno') >= hojeStart);
    if (devolvidosHoje.length > 0) {
      const ultimaDev = new Date(Math.max(...devolvidosHoje.map(e => e.get('data_hora_retorno'))));
      insightsRaw.push({ id: 'devolvido', count: devolvidosHoje.length, text: devolvidosHoje.length === 1 ? 'item devolvido hoje' : 'itens devolvidos hoje', time: ultimaDev, isAlert: false });
    }
    const novosItens = itens.filter(i => i.createdAt >= tresDiasAtras);
    if (novosItens.length > 0) {
      const ultimaCriacao = new Date(Math.max(...novosItens.map(i => i.createdAt)));
      insightsRaw.push({ id: 'novo', count: novosItens.length, text: novosItens.length === 1 ? 'novo item no estoque' : 'novos itens no estoque', time: ultimaCriacao, isAlert: false });
    }
    const empHoje = emps.filter(e => e.createdAt >= hojeStart && e.get('status_emprestimo') === 'Aberto');
    if (empHoje.length > 0) {
      const ultimoEmp = new Date(Math.max(...empHoje.map(e => e.createdAt)));
      insightsRaw.push({ id: 'emprestado', count: empHoje.length, text: empHoje.length === 1 ? 'saída hoje' : 'saídas hoje', time: ultimoEmp, isAlert: false });
    }
    setFrasesInteligentes(insightsRaw.sort((a, b) => b.time - a.time).slice(0, 4));

    const ativosAgora = emps.filter(e => e.get('status_emprestimo') === 'Aberto');
    const totalEmprestados = ativosAgora.reduce((acc, e) => acc + Number(e.get('quantidade_emprestada') || 1), 0);
    const totalFisico = itens.reduce((acc, i) => acc + Number(i.get('quantidade') || 0), 0);

    setMetricasTopo({
      estoque: totalFisico, emprestados: totalEmprestados,
      setoresCount: new Set(ativosAgora.map(e => e.get('setor_solicitante'))).size,
      setoresLista: [...new Set(ativosAgora.map(e => e.get('setor_solicitante') || 'N/I'))].sort(),
      comparativoMensal: `${pedidosPassado} ➔ ${pedidosAtual}`, variacaoTrend: Math.abs(variacao).toFixed(1) + '%', variacaoPositiva: variacao >= 0
    });

    const timelineData = [];
    const formatarChave = (data) => {
      if (filtroGrafico === '24h') return data.getHours() + 'h';
      if (filtroGrafico === '7d') return data.toLocaleDateString('pt-BR', { weekday: 'short' });
      return data.getDate().toString().padStart(2, '0');
    };

    if (filtroGrafico === '24h') {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(agora);
        d.setHours(agora.getHours() - i, 0, 0, 0);
        timelineData.push({ label: formatarChave(d), timestamp: d.getTime(), saidas: 0, entradas: 0 });
      }
    } else if (filtroGrafico === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(agora);
        d.setDate(agora.getDate() - i);
        d.setHours(0, 0, 0, 0);
        timelineData.push({ label: formatarChave(d), timestamp: d.getTime(), saidas: 0, entradas: 0 });
      }
    } else {
      // Mês atual: do dia 1 ao último dia do mês
      const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= ultimoDiaMes; i++) {
        const d = new Date(agora.getFullYear(), agora.getMonth(), i, 0, 0, 0, 0);
        timelineData.push({ label: formatarChave(d), timestamp: d.getTime(), saidas: 0, entradas: 0 });
      }
    }

    const timelineMap = new Map();
    timelineData.forEach(p => timelineMap.set(p.timestamp, p));

    const totalPedidosSetorMap = {};
    let totalPedidosGeral = 0;
    const comparativoMap = {};
    const mapParaHeatmap = {};
    const pad = (n) => n.toString().padStart(2, '0');

    emps.forEach(e => {
      const q = Number(e.get('quantidade_emprestada') || 1);
      const s = e.get('setor_solicitante') || 'N/I';
      const dataSaida = e.createdAt;
      const dataEntrada = e.get('data_hora_retorno');

      if (dataSaida) {
        let tsSaida;
        if (filtroGrafico === '24h') {
          tsSaida = new Date(dataSaida.getFullYear(), dataSaida.getMonth(), dataSaida.getDate(), dataSaida.getHours(), 0, 0, 0).getTime();
        } else {
          tsSaida = new Date(dataSaida.getFullYear(), dataSaida.getMonth(), dataSaida.getDate(), 0, 0, 0, 0).getTime();
        }
        const pontoS = timelineMap.get(tsSaida);
        if (pontoS) pontoS.saidas += q;
      }

      if (e.get('status_emprestimo') === 'Devolvido' && dataEntrada) {
        let tsEntrada;
        if (filtroGrafico === '24h') {
          tsEntrada = new Date(dataEntrada.getFullYear(), dataEntrada.getMonth(), dataEntrada.getDate(), dataEntrada.getHours(), 0, 0, 0).getTime();
        } else {
          tsEntrada = new Date(dataEntrada.getFullYear(), dataEntrada.getMonth(), dataEntrada.getDate(), 0, 0, 0, 0).getTime();
        }
        const pontoE = timelineMap.get(tsEntrada);
        if (pontoE) pontoE.entradas += q;
      }

      totalPedidosSetorMap[s] = (totalPedidosSetorMap[s] || 0) + q;
      totalPedidosGeral += q;

      if (!comparativoMap[s]) comparativoMap[s] = { name: s, atual: 0, passado: 0, totalRank: 0 };
      if (dataSaida >= mesAtualStart) { comparativoMap[s].atual += q; comparativoMap[s].totalRank += q; }
      else if (dataSaida >= mesPassadoStart && dataSaida <= mesPassadoEnd) { comparativoMap[s].passado += q; comparativoMap[s].totalRank += q; }

      if (dataSaida) {
        const localDateStr = `${dataSaida.getFullYear()}-${pad(dataSaida.getMonth() + 1)}-${pad(dataSaida.getDate())}`;
        mapParaHeatmap[localDateStr] = (mapParaHeatmap[localDateStr] || 0) + q;
      }
    });

    const coresSetores = ['#254E70', '#404040', '#475569', '#64748b', '#A0A0A0'];
    const rankingSetoresPedidos = Object.entries(totalPedidosSetorMap).map(([name, value], index) => ({
      name, value, percentage: parseFloat((totalPedidosGeral > 0 ? (value / totalPedidosGeral) * 100 : 0).toFixed(1)), color: coresSetores[index % coresSetores.length]
    })).sort((a, b) => b.value - a.value).slice(0, 5);

    const comparativoSetores = Object.values(comparativoMap).sort((a, b) => b.totalRank - a.totalRank).slice(0, 5);

    const extractDateFromSignature = (signature) => {
      if (!signature) return null;
      const match = signature.match(/EM (\d{2}\/\d{2}\/\d{4}) ÀS (\d{2}:\d{2})/);
      if (match) {
        const [, dateStr, timeStr] = match;
        const [day, month, year] = dateStr.split('/');
        const [hour, min] = timeStr.split(':');
        return new Date(year, month - 1, day, hour, min);
      }
      return null;
    };

    const agruparHistorico = (lista) => {
      const gruposMap = new Map();
      const gruposSemProtocolo = []; // Fallback para itens sem protocolo

      lista.forEach(e => {
        const protocolo = e.protocolo;
        const nome = e.get('nome_solicitante') || e.get('solicitante');
        const dateFromSig = extractDateFromSignature(e.get('detalhes_assinatura') || e.get('verificado_por_agente'));
        const actualSaidaObj = dateFromSig || e.createdAt;
        const dataRef = actualSaidaObj.getTime();

        if (protocolo) {
          if (!gruposMap.has(protocolo)) {
            gruposMap.set(protocolo, { ...e, fullObj: e, itens: [e], actualSaidaObj });
          } else {
            const g = gruposMap.get(protocolo);
            g.itens.push(e);
            if (e.get('status_emprestimo') === 'Aberto') g.status_emprestimo = 'Aberto';
          }
        } else {
          // Itens sem protocolo agrupados por tempo (2 min window)
          let g = gruposSemProtocolo.find(gr => gr.solicitante === nome && Math.abs(gr.actualSaidaObj.getTime() - dataRef) < 120000);
          if (g) {
            g.itens.push(e);
            if (e.get('status_emprestimo') === 'Aberto') g.status_emprestimo = 'Aberto';
          } else {
            const novoGrupo = { ...e, fullObj: e, itens: [e], actualSaidaObj };
            gruposSemProtocolo.push(novoGrupo);
          }
        }
      });

      return [...gruposMap.values(), ...gruposSemProtocolo];
    };

    const historicoAgrupado = agruparHistorico(emps).map(g => {
      const primeiro = g.itens[0];
      const obs = primeiro?.get('observacoes') || '';
      const isGLPI = obs.includes('[GLPI]');

      let nomeGLPI = null;
      let serialGLPI = null;
      if (isGLPI) {
        const matchNome = obs.match(/\[GLPI\] (.*?) \| SN:/);
        const matchSerial = obs.match(/SN: (.*?)($|\n|---)/);
        nomeGLPI = matchNome ? matchNome[1].trim() : 'Equipamento GLPI';
        serialGLPI = matchSerial ? matchSerial[1].trim() : 'N/I';
      }

      const displayItem = g.itens.length > 1
        ? `${g.itens.length} ATIVOS VINCULADOS`
        : (isGLPI ? nomeGLPI : (primeiro?.get('item')?.get('nome_equipamento') || 'Excluído'));

      const displayModelo = g.itens.length > 1
        ? g.itens.map(i => {
          const iObs = i.get('observacoes') || '';
          if (iObs.includes('[GLPI]')) {
            const m = iObs.match(/\[GLPI\] (.*?) \| SN:/);
            return m ? m[1].trim() : 'Equipamento GLPI';
          }
          return i.get('item')?.get('nome_equipamento') || 'Excluído';
        }).join(', ')
        : (isGLPI ? 'GLPI Asset' : (primeiro?.get('item')?.get('modelo_detalhes') || 'N/I'));

      const protocoloValue = g.protocolo || g.get?.('protocolo') || null;

      return {
        id: g.id,
        protocolo: protocoloValue,
        item: displayItem,
        modelo: displayModelo,
        solicitante: g.get('nome_solicitante'),
        setor: g.get('setor_solicitante'),
        dataSaida: g.actualSaidaObj.toLocaleDateString('pt-BR'),
        horaSaida: g.actualSaidaObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        dataEntrada: g.get('data_hora_retorno') ? g.get('data_hora_retorno').toLocaleDateString('pt-BR') : '-',
        horaEntrada: g.get('data_hora_retorno') ? g.get('data_hora_retorno').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
        status: g.status_emprestimo || g.get('status_emprestimo'),
        fullObj: {
          ...g,
          numero_serie: g.itens.length === 1 ? (isGLPI ? serialGLPI : (primeiro?.get('item')?.get('numero_serie') || primeiro?.get('numero_serie'))) : null
        }
      };
    });
    setDados({
      timeline: timelineData,
      statusDonut: [{ name: 'Em Uso', value: totalEmprestados, color: COLORS.azul }, { name: 'Disponível', value: Math.max(0, totalFisico - totalEmprestados), color: COLORS.vermelho }],
      rankingSetoresPedidos, comparativoSetores, heatmapMap: mapParaHeatmap,
      setoresRanking: Object.entries(ativosAgora.reduce((acc, e) => { const s = e.get('setor_solicitante') || 'N/I'; acc[s] = (acc[s] || 0) + (e.get('quantidade_emprestada') || 1); return acc; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
      historicoCompleto: historicoAgrupado
    });
  };

  const historicoFiltrado = React.useMemo(() => {
    const termo = buscaGeral.toLowerCase();
    return dados.historicoCompleto.filter(h => {
      const matchStatus = (filtroStatus === 'todos' || h.status === filtroStatus);
      if (!matchStatus) return false;
      if (!termo) return true;
      return (h.item.toLowerCase().includes(termo) || h.solicitante.toLowerCase().includes(termo) || h.modelo.toLowerCase().includes(termo));
    });
  }, [dados.historicoCompleto, buscaGeral, filtroStatus]);

  const DonutCard = ({ label, value, total, color, percentage }) => (
    <div className="flex items-center justify-between gap-8 flex-1 group">
      <div className="z-10">
        <p className="text-[10px] font-black text-slate-500 dark:text-[#606060] uppercase tracking-[0.3em] mb-3">{label}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter transition-all group-hover:scale-105">{value}</h3>
          <span className="text-[10px] font-bold text-slate-400 dark:text-[#404040] uppercase tracking-wider">Total</span>
        </div>
      </div>

      <div className="relative w-32 h-32 z-10 transition-transform duration-700">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={[{ value: percentage }, { value: 100 - percentage }]}
              innerRadius={40}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill={percentage === 100 ? color : COLORS.muted} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-black text-slate-900 dark:text-white">{Math.round(percentage)}%</span>
        </div>
      </div>
    </div>
  );

  const MetricCard = ({ icon: Icon, label, value, trendValue, isPositive, isHighlighted, children }) => (
    <div className={`p-5 2xl:p-6 rounded-[1.5rem] 2xl:rounded-[2rem] border-none transition-all duration-300 flex flex-col justify-between h-36 2xl:h-44 hover:-translate-y-1 ${isHighlighted ? 'bg-gradient-to-br from-[#254E70] to-[#162e42] shadow-xl' : 'bg-[var(--bg-card)]'}`}>
      <div className="flex justify-between items-start">
        <div className={`p-2 2xl:p-2.5 rounded-[0.65rem] 2xl:rounded-xl border-none ${isHighlighted ? 'bg-[var(--bg-card)]/20 text-white shadow-inner' : 'bg-[var(--bg-page)] text-slate-500 dark:text-[#A0A0A0] shadow-sm'}`}><Icon size={18} className="2xl:w-5 2xl:h-5" /></div>
        <MoreHorizontal size={18} className={`2xl:w-5 2xl:h-5 ${isHighlighted ? 'text-white/40' : 'text-slate-400 dark:text-[#404040]'}`} />
      </div>
      <div>
        <p className={`text-[9px] 2xl:text-[10px] font-bold uppercase tracking-widest ${isHighlighted ? 'text-white/70' : 'text-slate-500 dark:text-[#606060]'}`}>{label}</p>
        <h3 className={`text-2xl 2xl:text-3xl font-black mt-0.5 2xl:mt-1 ${isHighlighted ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{value}</h3>
      </div>
      <div className="flex items-center gap-2">
        {trendValue && <span className={`text-[9px] 2xl:text-[10px] font-bold px-1.5 2xl:px-2 py-0.5 rounded-md ${isHighlighted ? 'bg-[var(--bg-card)]/20 text-white' : isPositive ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>{isPositive ? '↑' : '↓'} {trendValue}</span>}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );

  const hojeHeatmap = new Date();
  const anoHeatmap = hojeHeatmap.getFullYear();
  const mesHeatmap = hojeHeatmap.getMonth();
  const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const diasSemanaNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const diasNoMesHeatmap = new Date(anoHeatmap, mesHeatmap + 1, 0).getDate();
  const primeiroDiaSemanaHeatmap = new Date(anoHeatmap, mesHeatmap, 1).getDay();

  const diasDoMesGrid = [];
  for (let i = 0; i < primeiroDiaSemanaHeatmap; i++) { diasDoMesGrid.push(null); }
  for (let i = 1; i <= diasNoMesHeatmap; i++) { diasDoMesGrid.push(new Date(anoHeatmap, mesHeatmap, i)); }
  const pad = (n) => n.toString().padStart(2, '0');

  return (
    <div className="flex flex-col gap-0 w-full overflow-x-hidden">

      {/* 🟢 SEÇÃO SUPERIOR (ÁREA PRINCIPAL + SIDEBAR) */}
      <div className="flex flex-col lg:flex-row gap-0">

        {/* 🔴 ÁREA PRINCIPAL (75%) */}
        <div className="flex-1 space-y-10 min-w-0 pr-10">

          {/* CABEÇALHO */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 2xl:gap-6">
            <div>
              <h1 className="text-2xl 2xl:text-3xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors duration-300">
                Olá de volta, <span className="capitalize">{usuarioAtual?.get('username') || 'Usuário'}</span>! 👋
              </h1>
              <div className="text-xs 2xl:text-sm font-medium text-slate-500 dark:text-[#A0A0A0] mt-1.5 2xl:mt-2 flex flex-wrap items-center gap-x-2 transition-colors duration-300">
                {frasesInteligentes.length === 0 && <span className="italic text-slate-400 dark:text-[#606060]">Nenhuma atualização recente.</span>}
                {frasesInteligentes.map((f, i) => (
                  <React.Fragment key={f.id}>
                    <span className="flex items-center">
                      <span className={f.isAlert ? 'text-red-500 dark:text-red-400 font-bold' : 'text-slate-900 dark:text-white font-bold'}>{f.count}</span>
                      <span className="ml-1 text-[11px] 2xl:text-sm">{f.text}</span>
                    </span>
                    {i < frasesInteligentes.length - 1 && <span className="text-slate-300 dark:text-[#404040]">•</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

          </div>

          {/* METRICAS TOPO (Único Grande Retângulo Cockpit com Degradê Rosado de Alta Fidelidade) */}
          <div
            className=" bg-[var(--bg-card)] p-10 2xl:p-12 rounded-3xl flex flex-col md:flex-row items-center justify-around gap-12 group transition-all duration-500 overflow-hidden relative"
          >
            {/* Espaçador visual limpo */}

            <DonutCard
              label="Estoque Total"
              value={metricasTopo.estoque}
              percentage={100}
              color={COLORS.azul}
            />
            <div className="hidden md:block w-px h-20 bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/[0.03]"></div>
            <DonutCard
              label="Itens em Uso"
              value={metricasTopo.emprestados}
              percentage={metricasTopo.estoque > 0 ? (metricasTopo.emprestados / metricasTopo.estoque) * 100 : 0}
              color={COLORS.azul}
            />
            <div className="hidden md:block w-px h-20 bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/[0.03]"></div>
            <DonutCard
              label="Disponibilidade"
              value={Math.max(0, metricasTopo.estoque - metricasTopo.emprestados)}
              percentage={metricasTopo.estoque > 0 ? ((metricasTopo.estoque - metricasTopo.emprestados) / metricasTopo.estoque) * 100 : 0}
              color={COLORS.vermelho}
            />
          </div>

          {/* GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 2xl:gap-8">

            {/* Gráfico de Área */}
            <motion.div
              className="lg:col-span-4 bg-[var(--bg-card)] p-6 2xl:p-8 rounded-3xl transition-all duration-300 relative border-none overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 2xl:mb-12 gap-6 px-2">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2.5 group cursor-pointer">
                    <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all group-hover:scale-125" style={{ backgroundColor: COLORS.azul }}></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Saídas</span>
                  </div>
                  <div className="flex items-center gap-2.5 group cursor-pointer">
                    <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all group-hover:scale-125" style={{ backgroundColor: COLORS.vermelho }}></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#606060] group-hover:text-white transition-colors">Entradas</span>
                  </div>
                </div>

                <div className="flex bg-[var(--bg-card)]/[0.03] p-1.5 rounded-2xl border-none self-end shadow-inner backdrop-blur-xl">
                  {[
                    { id: '24h', label: '24h' },
                    { id: '7d', label: '7 dias' },
                    { id: 'mes', label: 'Mês' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setFiltroGrafico(p.id)}
                      className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filtroGrafico === p.id ? 'bg-[var(--bg-card)]/3 text-white shadow-none border-none backdrop-blur-sm' : 'text-[#606060] hover:text-white/60 border-none'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-80 w-full px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dados.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="glowAzul" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.azul} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={COLORS.azul} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="glowVermelho" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.vermelho} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={COLORS.vermelho} stopOpacity={0} />
                      </linearGradient>

                      {/* Filtro de Bloom Atmospheric (Identidade Absoluta) */}
                      <filter id="bloomFilter" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Grid Sutil Horizontal apenas (igual dash.jpeg) */}
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" strokeDasharray="0" />

                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#404040', fontWeight: 'bold' }}
                      minTickGap={filtroGrafico === 'mes' ? 15 : 5}
                      dy={15}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#404040', fontWeight: 'bold' }}
                      tickCount={6}
                    />

                    <Tooltip
                      cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }}
                      content={({ active, payload }) => active && payload && payload.length ? (
                        <div className="bg-[var(--bg-card)] backdrop-blur-3xl border border-slate-100 dark:border-white/5 p-4 rounded-2xl shadow-xl transition-all duration-300">
                          <p className="text-[10px] font-black text-slate-500 dark:text-[#606060] mb-3 uppercase tracking-[0.25em]">{payload[0].payload.label}</p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-6">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.azul }}></div>
                                <span className="text-[11px] font-black text-slate-500 dark:text-white/50 uppercase">Saídas</span>
                              </div>
                              <span className="text-[11px] font-black text-slate-900 dark:text-white">{payload[0].value}</span>
                            </div>
                            <div className="flex items-center justify-between gap-6">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.vermelho }}></div>
                                <span className="text-[11px] font-black text-slate-500 dark:text-white/50 uppercase">Entradas</span>
                              </div>
                              <span className="text-[11px] font-black text-slate-900 dark:text-white">{payload[1].value}</span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    />

                    {/* Saídas (Linha Sólida Suave) */}
                    <Area
                      type="monotone"
                      dataKey="saidas"
                      stroke={COLORS.azul}
                      strokeWidth={3}
                      fill="url(#glowAzul)"
                      isAnimationActive={false}
                      activeDot={{ r: 6, fill: COLORS.azul, stroke: '#fff', strokeWidth: 2, shadow: '0 0 10px rgba(0,0,0,1)' }}
                    />

                    {/* Entradas (Linha Sólida Suave) */}
                    <Area
                      type="monotone"
                      dataKey="entradas"
                      stroke={COLORS.vermelho}
                      strokeWidth={3}
                      fill="url(#glowVermelho)"
                      isAnimationActive={false}
                      activeDot={{ r: 6, fill: COLORS.vermelho, stroke: '#fff', strokeWidth: 2, shadow: '0 0 10px rgba(0,0,0,1)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">


            <div
              className="lg:col-span-1 bg-[var(--bg-card)] p-6 2xl:p-8 rounded-3xl border-none relative transition-all duration-300 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6 2xl:mb-8">
                <div>
                  <h3 className="text-slate-900 dark:text-white font-bold text-base 2xl:text-lg mb-1">Comparativo Setorial</h3>
                  <p className="text-[9px] 2xl:text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-[0.2em] mt-1">Mês Atual vs. Mês Passado</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.azul }}></div><span className="text-[10px] text-slate-600 dark:text-[#A0A0A0] font-bold uppercase">Mês Atual</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.vermelho }}></div><span className="text-[10px] text-slate-600 dark:text-[#A0A0A0] font-bold uppercase">Mês Passado</span></div>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.comparativoSetores} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#606060' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#606060' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#404040', opacity: 0.1 }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[var(--bg-card)] p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mb-3 uppercase tracking-widest">{payload[0].payload.name}</p>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-white/50">Mês Atual:</span>
                                <span className="text-xs font-black text-slate-900 dark:text-white" style={{ color: COLORS.azul }}>{payload[0].value}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-white/50">Mês Passado:</span>
                                <span className="text-xs font-black text-slate-900 dark:text-white" style={{ color: COLORS.vermelho }}>{payload[1].value}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar isAnimationActive={false} dataKey="atual" fill={COLORS.azul} radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar isAnimationActive={false} dataKey="passado" fill={COLORS.vermelho} radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="lg:col-span-1 bg-[var(--bg-card)] p-6 2xl:p-8 rounded-3xl border-none flex flex-col relative z-0 transition-all duration-300 overflow-hidden"
            >
              <div className="mb-4 2xl:mb-6 shrink-0">
                <h3 className="text-slate-900 dark:text-white font-bold text-base 2xl:text-lg mb-1 flex items-center gap-2"><Zap size={18} style={{ color: COLORS.azul }} /> Pulso de Pedidos</h3>
                <p className="text-[9px] 2xl:text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-[0.2em]">Atividade em {mesesNomes[mesHeatmap]} / {anoHeatmap}</p>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="grid grid-cols-7 gap-2 w-full max-w-sm mx-auto">
                  {diasSemanaNomes.map(d => (
                    <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-[#606060] mb-2">{d}</div>
                  ))}

                  {diasDoMesGrid.map((dia, idx) => {
                    if (!dia) return <div key={`empty-${idx}`} className="aspect-square rounded-lg bg-transparent"></div>;

                    const dateStr = `${dia.getFullYear()}-${pad(dia.getMonth() + 1)}-${pad(dia.getDate())}`;
                    const count = dados.heatmapMap?.[dateStr] || 0;

                    let colorClass = 'bg-[var(--bg-page)]';
                    if (count > 0 && count <= 2) colorClass = 'bg-[#254E70]/20 dark:bg-[#254E70]/30 text-[#254E70]';
                    else if (count > 2 && count <= 5) colorClass = 'bg-[#254E70]/40 dark:bg-[#254E70]/50 text-white';
                    else if (count > 5 && count <= 9) colorClass = 'bg-[#254E70]/70 dark:bg-[#254E70]/70 text-white';
                    else if (count >= 10) colorClass = 'bg-[#254E70] text-white';

                    const isToday = dia.getDate() === hojeHeatmap.getDate() && dia.getMonth() === hojeHeatmap.getMonth();

                    return (
                      <div key={idx} className={`aspect-square rounded-lg transition-all flex items-center justify-center relative group cursor-crosshair ${colorClass} ${isToday ? 'z-10' : 'hover:scale-110 z-0 hover:z-20'}`}>
                        <span className={`text-[10px] font-black absolute bottom-0.5 right-1 opacity-0 group-hover:opacity-100 transition-opacity ${count > 0 ? 'text-white' : 'text-slate-400/50 dark:text-white/30'}`}>{dia.getDate()}</span>
                        <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-[var(--bg-card)]  px-3 py-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 whitespace-nowrap scale-95 group-hover:scale-100">
                          <p className="text-[10px] font-bold text-slate-900 dark:text-white mb-0.5">{dia.toLocaleDateString('pt-BR')}</p>
                          <p className="text-xs font-black text-[#254E70]">{count} Pedido{count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 🔵 SIDEBAR DIREITA (25%) */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col gap-10 bg-[var(--bg-card)] p-10 rounded-3xl">

          {/* NOSSOS AGENTES */}
          <div className="space-y-8 shrink-0">
            <div className={`space-y-8 px-2 ${agentes.length > 6 ? 'max-h-[480px] overflow-y-auto custom-scrollbar' : ''}`}>
              {agentes.map(ag => (
                <div key={ag.id} className="flex items-center justify-between group cursor-pointer transition-all hover:translate-x-1 outline-none">
                  <div className="flex items-center gap-7">
                    <div className="relative">
                      {ag.foto ? (
                        <img src={ag.foto} alt={ag.nome} className="w-10 h-10 rounded-2xl object-cover ring-2 ring-transparent group-hover:ring-[#C4B5FD]/40 transition-all shadow-md" />
                      ) : (
                        <div className="w-10 h-10 rounded-2xl bg-[#f8fafc] flex items-center justify-center text-slate-400 font-extrabold uppercase transition-colors">{ag.nome.charAt(0)}</div>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-[#254E70] transition-colors">{ag.nome}</p>
                      <p className="text-[9px] font-black text-slate-500 dark:text-[#606060] uppercase tracking-widest mt-0.5">{ag.tipo}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_0_rgba(0,0,0,0.1)] ${ag.online ? 'bg-[#254E70] shadow-[#254E70]/40' : 'bg-[#8D3046] shadow-[#8D3046]/40'}`}></div>
                </div>
              ))}
            </div>
          </div>

          {/* ATIVIDADES (HOJE) */}
          <div className="space-y-8 flex-1 flex flex-col min-h-0">
            <div className="px-2 shrink-0">
              <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.3em]">Atividades</h3>
              <p className="text-[8px] font-black text-slate-400 dark:text-white/20 tracking-[0.2em] uppercase mt-2">Hoje</p>
            </div>

            <div className="space-y-8 px-2 relative flex-1 overflow-y-auto custom-scrollbar pr-1 pt-2">
              <div className="absolute left-7 top-0 bottom-0 w-[1px] bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/[0.03] z-0"></div>
              {atividades.map(log => (
                <div
                  key={log.id}
                  className="flex gap-7 relative z-10 group cursor-pointer outline-none hover:translate-x-1 transition-all"
                  onClick={() => setLogSelecionado(log)}
                >
                  <div className="w-10 h-10 rounded-2xl bg-[var(--bg-card)]  flex items-center justify-center text-slate-400 dark:text-[#606060] group-hover:bg-[#254E70]/10 transition-all shadow-sm shrink-0">
                    <Activity size={16} style={{ color: COLORS.azul }} />
                  </div>
                  <div className="flex-1 min-w-0 pr-2 pt-0.5">
                    <div className="flex justify-between items-center gap-4">
                      <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest truncate group-hover:text-[#254E70] transition-colors">{log.acao}</p>
                      <span className="text-[10px] font-black text-slate-500 dark:text-white/40 font-mono shrink-0">{log.hora}</span>
                    </div>
                    <p className="text-[9px] text-slate-500 dark:text-[#606060] font-bold uppercase tracking-widest mt-1 truncate">{log.item}</p>
                  </div>
                </div>
              ))}
              {atividades.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-40">Nenhuma atividade registrada hoje</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 🟡 TABELA DE HISTÓRICO (100% LARGURA) */}
      <div className="mt-10">
        <div
          id="historico-dashboard"
          className="bg-[var(--bg-card)] rounded-3xl transition-all duration-300 flex flex-col h-full relative overflow-hidden"
        >

          <div className="p-10 border-none flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shrink-0 bg-[var(--bg-page)]/50 dark:bg-transparent">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Histórico de Transações</h3>
              <p className="text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-[0.2em] mt-1">Auditoria Completa</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
              <div className="flex bg-[var(--bg-page)] p-1 rounded-2xl border-none shadow-sm">
                {[{ id: 'todos', l: 'Todos' }, { id: 'Aberto', l: 'Em Uso' }, { id: 'Devolvido', l: 'Devolvido' }].map(s => (
                  <button key={s.id} onClick={() => setFiltroStatus(s.id)} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filtroStatus === s.id ? 'bg-[var(--bg-card)] dark:bg-[#404040] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}>{s.l}</button>
                ))}
              </div>
              <div className="relative flex-1 lg:w-80 group">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] group-focus-within:text-[#8B5CF6] transition-colors" />
                <input type="text" placeholder="Equipamento ou solicitante..." value={buscaGeral} onChange={e => setBuscaGeral(e.target.value)} className="w-full bg-[var(--bg-page)] text-xs font-bold text-slate-900 dark:text-white pl-11 pr-4 py-3.5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-[#254E70]/50 transition-all placeholder:text-slate-400 dark:placeholder:text-[#606060]" />
              </div>
              <button onClick={() => { setBuscaGeral(''); setFiltroStatus('todos'); }} className="p-3.5 bg-[var(--bg-page)] text-slate-500 dark:text-[#606060] hover:text-[#254E70] dark:hover:text-[#254E70] rounded-2xl border-none transition-all shadow-sm"><RotateCcw size={16} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar pb-10">
            <table className="w-full text-left whitespace-nowrap min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-page-dark)]/80 backdrop-blur-xl border-none">
                <tr className="text-[10px] font-black uppercase tracking-[0.25em] text-[#606060]">
                  <th className="px-10 py-6">Equipamento</th>
                  <th className="px-6 py-6">Solicitante</th>
                  <th className="px-6 py-6">Saída</th>
                  <th className="px-6 py-6">Entrada</th>
                  <th className="px-6 py-6 text-center">Status</th>
                  <th className="px-10 py-6 text-right">Auditoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {historicoFiltrado.slice(0, 15).map(h => (
                  <tr key={h.id} className="hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/[0.02] transition-colors group">
                    <td className="px-10 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{h.item}</span>
                          {h.protocolo && (
                            <span className="text-[8px] font-bold uppercase tracking-widest text-[#254E70] bg-[#254E70]/10 px-1.5 py-0.5 rounded-md">
                              #{h.protocolo}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mt-0.5 truncate max-w-[250px]">{h.modelo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{h.solicitante}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[#606060] mt-0.5">{h.setor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{h.dataSaida}</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mt-0.5">{h.horaSaida}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${h.dataEntrada === '-' ? 'text-slate-400 dark:text-[#404040]' : 'text-slate-900 dark:text-white'}`}>{h.dataEntrada}</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mt-0.5">{h.horaEntrada !== '-' ? h.horaEntrada : ''}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        if (h.status === 'Aberto') return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#254E70]/10 text-[#254E70]">
                            <div className="w-1.5 h-1.5 rounded-sm bg-[#254E70] animate-pulse"></div> EM USO
                          </span>
                        );
                        if (h.status === 'Devolvido' || h.status === 'Concluído') return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                            DEVOLVIDO
                          </span>
                        );
                        if (h.status === 'Pendente') return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#8D3046]/10 text-[#8D3046]">
                            PENDENTE
                          </span>
                        );
                        if (h.status === 'Aprovado') return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#254E70]/20 text-slate-900 dark:text-white">
                            APROVADO
                          </span>
                        );
                        if (h.status === 'Recusado') return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-600 dark:text-red-400">
                            RECUSADO
                          </span>
                        );
                        return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-500/10 text-slate-600 dark:text-slate-400">
                            {h.status?.toUpperCase() || '-'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-10 py-4 text-right">
                      <button onClick={() => onOpenDetails('emprestimo', h.fullObj)} className="inline-flex items-center justify-center p-2.5 bg-[var(--bg-card)]  border-none text-slate-400 dark:text-[#606060] hover:text-[#254E70] dark:hover:text-[#254E70] rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm" title="Ver Termo">
                        <Printer size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL DE IMPRESSÃO (MANTIDO INTACTO) */}
      {/* ========================================================= */}
      {recibo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto custom-scrollbar print:p-0 print:bg-[var(--bg-card)] print:absolute print:inset-0 print:block print:w-full">

          <style dangerouslySetInnerHTML={{
            __html: `
            @media print {
              body * { visibility: hidden; }
              #printable-pdf, #printable-pdf * { visibility: visible; }
              #printable-pdf { 
                position: absolute; left: 0; top: 0; width: 100%; height: 100%;
                background: white !important; color: black !important;
              }
              .no-print { display: none !important; }
            }
          ` }} />

          <div
            id="printable-pdf"
            className="bg-[var(--bg-card)] w-full max-w-2xl rounded-[2.5rem] p-12 shadow-2xl border border-slate-200 dark:border-white/10 my-auto print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none"
          >
            <div className="text-center pb-8 mb-8 border-b border-slate-200 dark:border-white/5 print:border-neutral-200">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F59E0B] print:text-[#606060] mb-2">Comprovante de Equipamento</h4>
              <p className="text-3xl font-black text-slate-900 dark:text-white print:text-black italic tracking-tighter">TI LEND.</p>
            </div>

            <div className="space-y-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <span className="font-black text-slate-900 dark:text-white print:text-black uppercase text-2xl">{recibo.get('item')?.get('nome_equipamento')}</span>
                  {recibo.get('item')?.get('modelo_detalhes') && <span className="text-slate-500 text-sm block mt-1">{recibo.get('item')?.get('modelo_detalhes')}</span>}
                </div>
                <span className="font-black text-slate-900 dark:text-white print:text-black text-2xl px-5 py-2 bg-[var(--bg-soft)]  print:bg-[var(--bg-soft)] rounded-2xl border border-slate-200 dark:border-white/5 print:border-neutral-200">
                  x{recibo.get('quantidade_emprestada') || 1}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-8 bg-[var(--bg-page)] print:bg-transparent p-8 rounded-[1.5rem] border border-slate-200 dark:border-white/5 print:border-neutral-200">
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-widest mb-1.5 text-[10px]">Solicitante</p>
                  <p className="font-bold text-slate-900 dark:text-white print:text-black text-sm">{recibo.get('nome_solicitante')}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-widest mb-1.5 text-[10px]">Setor / Área</p>
                  <p className="font-bold text-slate-900 dark:text-white print:text-black text-sm">{recibo.get('setor_solicitante') || 'N/I'}</p>
                </div>

                <div className="col-span-2 border-t border-slate-200 dark:border-white/5 print:border-neutral-200 pt-5 mt-2 flex justify-between gap-4">
                  <div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-[10px]">
                      <CalendarDays size={14} /> Saída Oficial
                    </p>
                    <p className="text-slate-900 dark:text-white print:text-black font-black text-base">
                      {recibo.createdAt?.toLocaleDateString('pt-BR')} às {recibo.createdAt?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-slate-500 font-bold uppercase tracking-widest mt-3 mb-1 text-[10px]">Técnico (Saída)</p>
                    <p className="font-bold text-slate-900 dark:text-white print:text-black text-sm capitalize">{recibo.get('nome_tecnico_saida') || recibo.get('tecnico_saida')?.get('username') || 'Aguardando...'}</p>
                  </div>

                  {recibo.get('status_emprestimo') === 'Devolvido' && (
                    <div className="text-right">
                      <p className="text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center justify-end gap-1.5 text-[10px]">
                        Entrada Oficial <CheckCircle2 size={14} />
                      </p>
                      <p className="text-slate-900 dark:text-white print:text-black font-black text-base">
                        {recibo.get('data_hora_retorno')?.toLocaleDateString('pt-BR')} às {recibo.get('data_hora_retorno')?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-slate-500 font-bold uppercase tracking-widest mt-3 mb-1 flex items-center justify-end gap-1 text-[10px]">Técnico (Retorno)</p>
                      <p className="font-bold text-slate-900 dark:text-white print:text-black text-sm capitalize">{recibo.get('nome_tecnico_retorno') || recibo.get('tecnico_retorno')?.get('username') || '-'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between gap-8 pt-10">

                {/* ASSINATURA RETIRADA */}
                <div className="flex-1 flex flex-col items-center justify-end text-center">
                  {recibo.get('assinatura_eletronica') ? (
                    <>
                      <div className="flex items-center gap-2 text-emerald-600 mb-4 bg-emerald-50 px-5 py-3 rounded-2xl border border-emerald-200">
                        <ShieldCheck size={20} />
                        <span className="font-black tracking-widest uppercase text-[10px]">Retirada Validada</span>
                      </div>
                      <p className="text-[10px] text-slate-700 uppercase font-bold leading-relaxed">{recibo.get('detalhes_assinatura')}</p>
                    </>
                  ) : (
                    <>
                      <div className="w-full max-w-[200px] h-[1px] bg-slate-300 dark:bg-[var(--bg-card)]/20 print:bg-slate-300 mb-4"></div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Assinatura de Retirada</p>
                      <p className="text-[9px] text-slate-400 mt-1 uppercase">{recibo.get('quem_vai_buscar') || recibo.get('nome_solicitante')}</p>
                    </>
                  )}
                </div>

                {/* ASSINATURA DEVOLUÇÃO */}
                {(recibo.get('status_emprestimo') === 'Aberto' || recibo.get('status_emprestimo') === 'Devolvido') && (
                  <div className="flex-1 flex flex-col items-center justify-end text-center border-l border-slate-200 dark:border-white/5 print:border-neutral-200 pl-8">
                    {recibo.get('assinatura_dev_eletronica') ? (
                      <>
                        <div className="flex items-center gap-2 text-[#8B5CF6] mb-4 bg-[#8B5CF6]/10 px-5 py-3 rounded-2xl border border-[#8B5CF6]/20">
                          <ShieldCheck size={20} />
                          <span className="font-black tracking-widest uppercase text-[10px]">Devolução Validada</span>
                        </div>
                        <p className="text-[10px] text-slate-700 uppercase font-bold leading-relaxed">{recibo.get('detalhes_assinatura_dev')}</p>
                      </>
                    ) : (
                      <>
                        <div className="w-full max-w-[200px] h-[1px] bg-slate-300 dark:bg-[var(--bg-card)]/20 print:bg-slate-300 mb-4"></div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Assinatura de Devolução</p>
                        <p className="text-[9px] text-slate-400 mt-1 uppercase">{recibo.get('quem_vai_entregar') || recibo.get('nome_solicitante')}</p>
                      </>
                    )}
                  </div>
                )}

              </div>
            </div>

            <div className="mt-12 pt-8 flex gap-4 border-t border-slate-200 dark:border-white/5 print:hidden">
              <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 dark:bg-[#F8FAFC] text-white dark:text-[var(--bg-page-dark)] rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-[var(--bg-card)] transition-all shadow-xl flex items-center justify-center gap-2"><Printer size={16} /> Imprimir PDF</button>
              <button onClick={() => setRecibo(null)} className="flex-1 py-4 bg-[var(--bg-soft)]  text-slate-600 dark:text-[#A0A0A0] border border-slate-200 dark:border-white/5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-all shadow-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE DETALHES DO LOG (ATIVIDADES) */}
      {/* ========================================================= */}
      {logSelecionado && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-[var(--bg-card)] w-full max-w-lg rounded-[2.5rem] p-8 2xl:p-10 shadow-lg border border-slate-200 dark:border-white/10 relative overflow-hidden"
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[#254E70]/10 flex items-center justify-center text-[#254E70] border border-[#254E70]/20 shadow-inner">
                <Activity size={24} />
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#254E70] mb-1">Detalhes da Atividade</h4>
                <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">{logSelecionado.acao}</p>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="space-y-6">
              <div className="bg-[var(--bg-page)] p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                <p className="text-[9px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest mb-2">Equipamento Relacionado</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{logSelecionado.item}</p>
              </div>

              <div className="bg-[var(--bg-page)] p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                <p className="text-[9px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest mb-2">Descrição / Detalhes</p>
                <p className="text-sm font-medium text-slate-600 dark:text-[#A0A0A0] leading-relaxed italic">
                  "{logSelecionado.detalhes}"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-page)] p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest mb-2">Técnico Responsável</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{logSelecionado.tecnico}</p>
                </div>
                <div className="bg-[var(--bg-page)] p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest mb-2">Data e Horário</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{logSelecionado.dataCompleta}</p>
                </div>
              </div>
            </div>

            {/* Botão Fechar */}
            <div className="mt-10">
              <button
                onClick={() => setLogSelecionado(null)}
                className="w-full py-4 bg-[#254E70] text-white rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-[#1a3850] transition-all shadow-lg"
              >
                Entendido
              </button>
            </div>

            {/* Decoração sutil */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-[#254E70]/5 rounded-full blur-2xl"></div>
          </motion.div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.triggerAtualizacao === nextProps.triggerAtualizacao &&
    prevProps.filtroGrafico === nextProps.filtroGrafico &&
    prevProps.usuarioAtual?.id === nextProps.usuarioAtual?.id;
});

export default DashboardMetricas;
