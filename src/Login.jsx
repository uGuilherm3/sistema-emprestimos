// src/Login.jsx
import React, { useState, useEffect, useRef } from 'react';
import { api } from './utils/apiClient';
import { ShieldAlert, Sun, Moon } from 'lucide-react';
import LogoImg from './assets/logo.jpg';

// ─── COMPONENTE: PARTÍCULAS MORFÁVEIS (PIXELS NÍTIDOS) ────────────────────────
const MorphingParticlesCanvas = ({ Icon, isDarkMode }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const iconWrapperRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;

    const dpr = window.devicePixelRatio || 1;
    let width = parent.clientWidth;
    let height = parent.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Reduzi levemente a quantidade para dar mais respiro entre os pixels
    const maxParticles = 1200;

    if (particlesRef.current.length === 0) {
      for (let i = 0; i < maxParticles; i++) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          targetX: Math.random() * width,
          targetY: Math.random() * height,
          // Agora o tamanho é exato: 1px ou 2px, sem tamanhos quebrados
          size: Math.random() > 0.90 ? 2 : 1,
          speed: 0.05 + Math.random() * 0.04,
          phase: Math.random() * Math.PI * 2,
          isSpecial: Math.random() > 0.85
        });
      }
    }

    const rColor = isDarkMode ? 255 : 37;
    const gColor = isDarkMode ? 255 : 78;
    const bColor = isDarkMode ? 255 : 112;

    const svgElement = iconWrapperRef.current?.querySelector('svg');
    if (svgElement) {
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgData = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        offCtx.fillStyle = 'black';
        offCtx.fillRect(0, 0, width, height);

        const iconSize = Math.min(width, height) * 0.65;
        const dx = (width - iconSize) / 2;
        const dy = (height - iconSize) / 2;

        offCtx.drawImage(img, dx, dy, iconSize, iconSize);

        const imgData = offCtx.getImageData(0, 0, width, height).data;
        const targets = [];

        // Pula de 5 em 5 pixels para criar um espaçamento maior (grid mais visível)
        for (let y = 0; y < height; y += 5) {
          for (let x = 0; x < width; x += 5) {
            const index = (y * width + x) * 4;
            const r = imgData[index];

            if (r > 128) {
              targets.push({ x, y });
            }
          }
        }

        targets.sort(() => Math.random() - 0.5);

        particlesRef.current.forEach((p, i) => {
          if (targets.length > 0) {
            const target = targets[i % targets.length];
            // Ruído também em números inteiros para não quebrar o pixel-perfect
            p.targetX = target.x + Math.round((Math.random() - 0.5) * 4);
            p.targetY = target.y + Math.round((Math.random() - 0.5) * 4);
          } else {
            p.targetX = width / 2 + Math.round((Math.random() - 0.5) * 200);
            p.targetY = height / 2 + Math.round((Math.random() - 0.5) * 200);
          }
        });
      };
      img.src = svgData;
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particlesRef.current.forEach(p => {
        p.x += (p.targetX - p.x) * p.speed;
        p.y += (p.targetY - p.y) * p.speed;

        p.phase += 0.04;

        // Opacidade mais "seca" e brilhante, evitando valores muito baixos que causam borrão
        const opacity = p.isSpecial
          ? 0.7 + Math.sin(p.phase) * 0.3
          : 0.3 + Math.sin(p.phase) * 0.4;

        ctx.fillStyle = `rgba(${rColor}, ${gColor}, ${bColor}, ${Math.max(0.1, opacity)})`;

        // A MÁGICA DA NITIDEZ ESTÁ AQUI: Math.round() nas coordenadas e fillRect (quadrado)
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      });

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [Icon, isDarkMode]);

  return (
    <>
      <div ref={iconWrapperRef} style={{ display: 'none' }}>
        <Icon size={256} strokeWidth={3} color="white" />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </>
  );
};


// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Login({ onLoginSucesso, isDarkMode, setIsDarkMode }) {

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const criarUserMock = (dados) => ({
    id: dados.id,
    username: dados.username,
    nome: dados.nome || dados.username,
    setor: dados.setor,
    tipoUsuario: dados.tipo_usuario,
    get: (field) => {
      if (field === 'username') return dados.username;
      if (field === 'nome') return dados.nome || dados.username;
      if (field === 'setor') return dados.setor;
      if (field === 'tipoUsuario') return dados.tipo_usuario;
      return dados[field];
    },
    save: async () => { }
  });

  const entrarLauncher = (userMock) => {
    localStorage.setItem('tilend_user_id', userMock.id);
    setTransitioning(true);
    setTimeout(() => onLoginSucesso(userMock), 520);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    const userToLogin = username.trim().toLowerCase();
    const pinToLogin = password.trim();

    // Usuário temporário para dev local (sem banco)
    if (userToLogin === 'dev' && pinToLogin === '0000') {
      return entrarLauncher(criarUserMock({
        id: 'dev-local', username: 'dev', nome: 'Dev Local',
        setor: 'TI', tipo_usuario: 'adm', pin: '0000',
      }));
    }

    try {
      const { data: user } = await api.users.login(userToLogin, pinToLogin);
      if (user) return entrarLauncher(criarUserMock(user));

      setErro('Credenciais incorretas. Verifique seu usuário e PIN.');
    } catch (err) {
      setErro('Erro na comunicação com os servidores.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full bg-transparent border-b border-slate-500 dark:border-[#808080] focus:border-slate-900 dark:focus:border-white text-slate-900 dark:text-white py-3 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-[#404040] text-sm autofill:shadow-[inset_0_0_0_1000px_var(--bg-page)] autofill:[text-fill-color:black] autofill:[-webkit-text-fill-color:black] dark:autofill:[text-fill-color:white] dark:autofill:[-webkit-text-fill-color:white]`;
  const labelClass = 'block text-[10px] font-bold uppercase text-slate-500 dark:text-[#808080] tracking-widest mb-1';
  const grad = 'linear-gradient(to bottom right, #254E70, #8D3046)';

  return (
    <>
    <div className="min-h-screen bg-[var(--bg-page)] grid grid-cols-1 lg:grid-cols-2 animate-in fade-in duration-700 font-sans transition-colors duration-300">

      {/* ── Painel Esquerdo: Formulário ou Bem-vindo ── */}
      <div className="relative p-10 md:p-16 lg:p-24 flex flex-col justify-center overflow-y-auto">
        <div className="absolute top-10 left-10 md:left-16 lg:left-24 flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm overflow-hidden transition-colors duration-300">
            <img src={LogoImg} className="w-full h-full object-cover" alt="Logo" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white transition-colors duration-300">TI LEND.</h1>
        </div>
          <div className="w-full max-w-2xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="mb-16"><h2 className="text-slate-900 dark:text-white text-5xl font-light tracking-tight">Login</h2></div>
            {erro && <div className="flex items-center gap-2.5 p-4 bg-red-50 dark:bg-red-500/10 border-l-2 border-red-500 text-red-600 dark:text-red-400 text-xs font-semibold mb-8"><ShieldAlert size={16} /><span>{erro}</span></div>}
            <form onSubmit={handleLogin} className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <div>
                  <label className={labelClass}>Usuário ou E-mail</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Senha / PIN</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} />
                </div>
              </div>
              <div className="flex justify-end mt-20">
                <button type="submit" disabled={loading} className="w-24 h-24 bg-[#131313] text-white dark:bg-white dark:text-black rounded-full font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center hover:scale-105 transition-all shadow-xl">Entrar</button>
              </div>
            </form>
          </div>
      </div>

      {/* Painel direito: fundo decorativo gradiente */}
      <div className="hidden lg:flex h-full" style={{ background: grad }}>
        <div className="w-full h-full relative flex flex-col items-center justify-center p-12 text-center">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="absolute top-10 right-10 text-white/70 hover:text-white transition-colors">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="animate-in fade-in slide-in-from-right-12 duration-1000">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/40 mb-5">
              Bem-vindo ao Portal
            </p>
            <h2 className="text-5xl md:text-7xl font-light tracking-tight text-white leading-tight">
              Sistemas <br /> OAB Ceará
            </h2>
            <p className="text-sm text-white/40 mt-5">
              Faça o login para visualizar as ferramentas
            </p>
          </div>
        </div>
      </div>

    </div>

    {transitioning && (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-page)',
        zIndex: 9999,
        animation: 'expandFromLeft 480ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
      }} />
    )}
    </>
  );
}