// src/Login.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { loginGLPI } from './utils/glpiClient';
import { ShieldAlert, CheckCircle2, ArrowLeft, Globe, Sun, Moon, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login({ onLoginSucesso, onAbrirPortal, onVoltarLogin, isPortal, isDarkMode, setIsDarkMode }) {
  const [viewMode, setViewMode] = useState('login'); // 'login', 'register', 'forgot'
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [username, setUsername] = useState('');
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [setor, setSetor] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Cores: Azul (#254E70) e Vermelho (#8D3046) 
  const colorBlue = "#254E70";
  const colorRed = "#8D3046";
  const themeColor = isPortal ? colorRed : colorBlue;

  // Gradientes: 
  const gradAgente = `linear-gradient(to bottom right, ${colorBlue}, ${colorRed})`;
  const gradPortal = `linear-gradient(to bottom right, ${colorRed}, ${colorBlue})`;

  // Estado para camada de fundo persistente
  const [prevMode, setPrevMode] = useState(isPortal);
  useEffect(() => {
    const timer = setTimeout(() => { setPrevMode(isPortal); }, 900);
    return () => clearTimeout(timer);
  }, [isPortal]);

  const toggleMode = (mode) => {
    setViewMode(mode); setErro(''); setSucesso(''); setPassword(''); setConfirmPassword('');
  };

  const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setErro('');
    const userToLogin = username.trim().toLowerCase();
    const pinToLogin = password.trim();

    try {
      // 1. TENTA LOGIN LEGADO (Supabase via PIN)
      const { data: perfil } = await supabase
        .from('perfil')
        .select('*')
        .or(`username.eq."${userToLogin}",email.eq."${userToLogin}"`)
        .eq('pin', pinToLogin)
        .single();

      if (perfil) {
        // Bloqueio de segurança: Solicitantes não entram no painel administrativo
        if (!isPortal && perfil.tipo_usuario === 'solicitante') {
          setErro('Esta conta não possui permissão de agente. Use o Portal do Colaborador.');
          setLoading(false);
          return;
        }

        const userMock = {
          id: perfil.id,
          username: perfil.username,
          nome: perfil.username,
          setor: perfil.setor,
          tipoUsuario: perfil.tipo_usuario,
          atribuicao: perfil.atribuicao,
          foto_perfil: { url: () => perfil.foto_perfil },
          get: (field) => {
            if (field === 'username') return perfil.username;
            if (field === 'setor') return perfil.setor;
            if (field === 'tipoUsuario') return perfil.tipo_usuario;
            if (field === 'atribuicao') return perfil.atribuicao;
            if (field === 'foto_perfil') return { url: () => perfil.foto_perfil };
            if (field === 'adm') return perfil.adm === true;
            return perfil[field];
          },
          save: async () => { /* Heartbeat mock */ }
        };

        localStorage.setItem('tilend_user_id', perfil.id);
        onLoginSucesso(userMock);
        return;
      }

      // 2. SE FALHAR O PIN, TENTA LOGIN GLPI (Usuário e Senha)
      setLoading(true); // Garante que o loading continue visível na transição
      const glpiUser = await loginGLPI(userToLogin, pinToLogin);

      if (glpiUser) {
        // Usuários vindo do GLPI são assumidos como Agentes por padrão nesta integração técnica
        // mas podemos validar permissões específicas no GLPI se necessário.
        localStorage.setItem('tilend_user_id', glpiUser.id);
        localStorage.setItem('tilend_glpi_session', glpiUser.sessionToken);

        const userMock = {
          ...glpiUser,
          username: glpiUser.username,
          nome: glpiUser.username,
          get: (field) => {
            if (field === 'tipoUsuario') return 'agente';
            if (field === 'adm') return false; // Por padrão GLPI não é admin a menos que configurado
            return glpiUser[field];
          },
          save: async () => { }
        };

        onLoginSucesso(userMock);
        return;
      }

      setErro('Credenciais incorretas (PIN legado ou Senha GLPI inválida).');
    } catch (err) {
      setErro('Erro na comunicação com os servidores.');
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setLoading(true); setErro(''); setSucesso('');
    if (password !== confirmPassword) { setErro('As senhas não coincidem.'); setLoading(false); return; }
    if (password.length < 4) { setErro('O PIN deve ter no mínimo 4 números.'); setLoading(false); return; }

    try {
      const user = new Parse.User();
      user.set("username", username.trim().toLowerCase());
      user.set("password", password.trim());
      user.set("email", email.trim().toLowerCase());
      user.set("nome", nome.trim());
      user.set("setor", setor.trim().toUpperCase());
      user.set("tipo_usuario", isPortal ? 'solicitante' : 'tecnico');

      await user.signUp();

      // Espelhar na classe Colaborador (Parse não tem restrição de FK automática aqui, mas seguimos a regra)
      const Colaborador = Parse.Object.extend('Colaborador');
      const colab = new Colaborador();
      await colab.save({
        nome: nome.trim(),
        setor: setor.trim().toUpperCase(),
        userId: user.id
      });

      setSucesso('Conta criada com sucesso!');
      setTimeout(() => { toggleMode('login'); }, 2000);
    } catch (error) {
      setErro('Erro ao criar conta: ' + error.message);
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErro('A recuperação de senha via e-mail não está disponível para o modo PIN. Entre em contato com a TI.');
    setLoading(false);
  };


  const inputClass = `w-full bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5 ring-inset focus:ring-2 focus:ring-[${themeColor}] text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-[#404040] text-sm [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:[-webkit-text-fill-color:black] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[transition:background-color_5000s_ease-in-out_0s]`;
  const labelClass = "block text-[10px] font-bold uppercase text-slate-500 dark:text-[#A0A0A0] tracking-widest mb-1";

  return (
    <div className={`min-h-screen bg-[var(--bg-page)] grid grid-cols-1 lg:grid-cols-2 selection:bg-[${themeColor}]/30 animate-in fade-in duration-700 font-sans transition-colors duration-300`}>

      <div className="relative p-10 md:p-16 lg:p-24 flex flex-col justify-center">
        <div className="absolute top-10 left-10 md:left-16 lg:left-24 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 dark:bg-white flex items-center justify-center rounded-sm transition-colors duration-300"><span className="text-white dark:text-black font-black text-[10px] italic">TI</span></div>
          <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white transition-colors duration-300">
            TI LEND. {isPortal && <span className="text-[#8D3046] text-[10px] uppercase ml-1 tracking-widest font-black">Portal</span>}
          </h1>
        </div>

        <div className="absolute top-10 right-10 md:right-16 lg:right-24">
          {setIsDarkMode && (
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white transition-colors">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
        </div>

        <div className="w-full max-w-2xl mx-auto mt-10">
          {loading && <div className={`absolute top-0 left-0 h-1 animate-pulse w-full`} style={{ backgroundColor: themeColor }}></div>}

          {viewMode === 'forgot' && (
            <button onClick={() => toggleMode('login')} className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest mb-12 transition-all"><ArrowLeft size={14} /> Voltar ao Login</button>
          )}

          <div className="mb-16">
            <h2 className="text-slate-900 dark:text-white text-5xl md:text-6xl font-light tracking-tight transition-colors duration-300">
              {viewMode === 'login' ? 'Login' : viewMode === 'register' ? 'Criar Conta' : 'Recuperar'}
            </h2>
          </div>

          {erro && <div className={`flex items-center gap-2.5 p-4 bg-red-50 dark:bg-red-500/10 border-l-2 border-red-500 text-red-600 dark:text-red-400 text-xs font-semibold mb-8 animate-in fade-in`}><ShieldAlert size={16} /><span>{erro}</span></div>}
          {sucesso && <div className="flex items-center gap-2.5 p-4 bg-emerald-50 dark:bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-8 animate-in fade-in"><CheckCircle2 size={16} /><span>{sucesso}</span></div>}

          <form onSubmit={viewMode === 'register' ? handleRegister : viewMode === 'forgot' ? handleForgotPassword : handleLogin} className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {viewMode === 'login' && (
                <>
                  <div>
                    <label className={labelClass}>Usuário ou E-mail</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="seu.nome" className={inputClass} style={{ borderColor: themeColor + '33' }} />
                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={() => toggleMode('register')} className={`text-[9px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest transition-colors`}>Criar Conta</button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Senha</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className={inputClass} style={{ borderColor: themeColor + '33' }} />
                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={() => toggleMode('forgot')} className={`text-[9px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest transition-colors`}>Esqueceu a senha?</button>
                    </div>
                  </div>
                </>
              )}

              {viewMode === 'register' && (
                <>
                  <div><label className={labelClass}>Nome Completo</label><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Nome e Sobrenome" className={inputClass} style={{ borderColor: themeColor + '33' }} /></div>
                  <div><label className={labelClass}>Nome de Usuário</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="seu.login" className={inputClass} style={{ borderColor: themeColor + '33' }} /></div>

                  <div><label className={labelClass}>Setor / Área</label><input type="text" value={setor} onChange={(e) => setSetor(e.target.value)} required placeholder="Ex: Recepção" className={inputClass} style={{ borderColor: themeColor + '33' }} /></div>
                  <div>
                    <label className={labelClass}>E-mail Corporativo</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@empresa.com" className={inputClass} style={{ borderColor: themeColor + '33' }} />
                  </div>
                  <div><label className={labelClass}>Senha (Para Login)</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className={inputClass} style={{ borderColor: themeColor + '33' }} /></div>
                  <div><label className={labelClass}>Confirmar Senha</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className={inputClass} style={{ borderColor: themeColor + '33' }} /></div>
                  <div className="md:col-span-2 mt-[-10px] flex justify-end">
                    <button type="button" onClick={() => toggleMode('login')} className="text-[9px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest transition-colors">Já tenho uma conta</button>
                  </div>
                </>
              )}

              {viewMode === 'forgot' && (
                <div className="md:col-span-2 max-w-sm">
                  <label className={labelClass}>E-mail cadastrado</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@empresa.com" className={inputClass} style={{ borderColor: themeColor + '33' }} />
                </div>
              )}
            </div>

            <div className="flex justify-end mt-20">
              <button type="submit" disabled={loading} className="w-24 h-24 bg-slate-900 text-white dark:bg-white dark:text-black rounded-full font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center hover:scale-105 transition-all shadow-xl disabled:opacity-50" style={!isDarkMode ? { boxShadow: `0 0 40px -10px ${themeColor}66` } : {}}>
                {loading ? '...' : viewMode === 'login' ? 'Entrar' : viewMode === 'register' ? 'Criar' : 'Enviar'}
              </button>
            </div>

            <div className="mt-12 pt-6 text-center">
              {isPortal ? (
                <>
                  <p className="text-[9px] text-slate-500 dark:text-[#606060] font-bold uppercase tracking-widest mb-4">Acesso Administrativo?</p>
                  <button type="button" onClick={onVoltarLogin} className="w-full py-4 bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5 text-slate-600 dark:text-[#A0A0A0] rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[var(--bg-card)]/10 transition-all flex items-center justify-center gap-2">
                    <ShieldCheck size={14} /> Acessar Login de Agente
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[9px] text-slate-500 dark:text-[#606060] font-bold uppercase tracking-widest mb-4">Precisa de um equipamento?</p>
                  <button type="button" onClick={onAbrirPortal} className="w-full py-4 bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5 text-slate-600 dark:text-[#A0A0A0] rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[var(--bg-card)]/10 transition-all flex items-center justify-center gap-2">
                    <Globe size={14} /> Acessar Portal do Colaborador
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* PAINEL DIREITO: DEGRADÊ COM ANIMAÇÃO OCEAN WAVE (INUNDAÇÃO) */}
      <div className="relative hidden lg:flex items-center justify-center overflow-hidden h-full">

        {/* Camada Estática de Fundo (Estado Anterior) */}
        <div
          className="absolute inset-0 z-0"
          style={{ background: prevMode ? gradPortal : gradAgente }}
        />

        <AnimatePresence mode="popLayout">
          {/* Camada de Onda que Inunda o Fundo */}
          <motion.div
            key={isPortal ? 'portal' : 'admin'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-10 p-12 lg:p-24 flex items-center justify-center"
            style={{ background: isPortal ? gradPortal : gradAgente }}
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--bg-card)]/10 blur-[100px] rounded-full pointer-events-none"></div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="w-full max-w-lg space-y-12 relative z-20"
            >
              <div className="w-full h-px bg-[var(--bg-card)]/20"></div>
              <div>
                <h2 className="text-4xl lg:text-5xl font-black tracking-tighter text-white leading-tight">
                  {isPortal ? 'Portal de Autoatendimento.' : 'As ferramentas mais poderosas de gestão.'}
                </h2>
                <p className="text-white/80 text-base mt-6 leading-relaxed font-medium">
                  {isPortal
                    ? 'Faça sua solicitação de equipamentos em segundos. A equipe de TI cuida do resto.'
                    : 'Um ecossistema completo para controle de ativos, com foco em eficiência, rastreabilidade e produtividade.'
                  }
                </p>
              </div>
              <div className="w-full h-px bg-[var(--bg-card)]/20 pt-10"></div>
              <div className="text-left"><p className="text-[9px] text-white/60 font-bold uppercase tracking-[0.4em]">© {new Date().getFullYear()} TI LEND. | OAB CEARÁ</p></div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
