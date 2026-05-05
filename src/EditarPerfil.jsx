import React, { useState, useEffect, useRef } from 'react';
import { api } from './utils/apiClient';
import { UserCog, Mail, Lock, ShieldCheck, ShieldAlert, Camera, User, Briefcase, ArrowRight, Users, Edit3, CheckCircle2 } from 'lucide-react';

export default function EditarPerfil({ usuarioAtual, onPerfilAtualizado }) {
  const [perfilForm, setPerfilForm] = useState({ nome: '', username: '', email: '', atribuicao: '', setor: '', newPassword: '', confirmPassword: '' });
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [sucessoUpdate, setSucessoUpdate] = useState(false);
  const [erroUpdate, setErroUpdate] = useState('');
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState(null);
  const fotoInputRef = useRef(null);

  // Estados para Admin
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [usuarioEspelho, setUsuarioEspelho] = useState(null);
  const [modoEdicaoAdmin, setModoEdicaoAdmin] = useState(false);
  const isAdmin = usuarioAtual?.get('tipoUsuario') === 'adm';

  const wrapUser = (perfil) => {
    if (!perfil) return null;
    return {
      id: perfil.id,
      get: (field) => {
        if (field === 'username') return perfil.username;
        if (field === 'nome') return perfil.nome;
        if (field === 'setor') return perfil.setor;
        if (field === 'tipoUsuario') return perfil.tipo_usuario;
        if (field === 'atribuicao') return perfil.atribuicao;
        if (field === 'email') return perfil.email;
        if (field === 'pin') return perfil.pin;
        if (field === 'senha_pin') return perfil.pin;
        if (field === 'foto_perfil') return { url: () => perfil.foto_perfil };
        return perfil[field];
      },
      save: async () => { /* Heartbeat mock */ }
    };
  };

  useEffect(() => {
    const fetchUsuarios = async () => {
      if (isAdmin) {
        const { data, error } = await api.users.list({ order: 'username', limit: 200 });
        if (!error && data) setListaUsuarios(data);
      }
    };
    fetchUsuarios();
  }, [isAdmin]);

  useEffect(() => {
    const targetUser = usuarioEspelho ? wrapUser(usuarioEspelho) : usuarioAtual;
    if (targetUser) {
      setPerfilForm({
        nome: targetUser.get('nome') || '',
        username: targetUser.get('username') || '',
        email: targetUser.get('email') || '',
        atribuicao: targetUser.get('atribuicao') || '',
        setor: targetUser.get('setor') || '',
        newPassword: '',
        confirmPassword: ''
      });
      const foto = targetUser.get('foto_perfil');
      if (foto && typeof foto.url === 'function') setFotoPerfilPreview(foto.url());
      else if (foto && typeof foto === 'string') setFotoPerfilPreview(foto);
      else setFotoPerfilPreview(null);
    }
    if (usuarioEspelho) setModoEdicaoAdmin(false);
  }, [usuarioAtual, usuarioEspelho]);

  const handleFotoSelection = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { setErroUpdate('A foto deve ter no máximo 2MB.'); return; }
      setFotoPerfilPreview(URL.createObjectURL(file));
      setErroUpdate('');
    }
  };

  const handleUpdatePerfil = async (e) => {
    e.preventDefault();
    const targetUserId = usuarioEspelho ? usuarioEspelho.id : usuarioAtual.id;
    setLoadingUpdate(true); setSucessoUpdate(false); setErroUpdate('');

    if (perfilForm.newPassword !== perfilForm.confirmPassword) {
      setErroUpdate('As novas senhas não coincidem.');
      setLoadingUpdate(false); return;
    }

    try {
      // Upload de foto de perfil
      if (fotoInputRef.current?.files[0]) {
        const { data: uploadData, error: uploadError } = await api.uploads.foto(targetUserId, fotoInputRef.current.files[0]);
        if (uploadError) throw new Error('Erro no upload da foto: ' + uploadError);
        // A URL já foi salva no banco pelo backend; o campo foto_perfil virá no perfilData abaixo
      }

      const updates = {
        nome: perfilForm.nome.trim(),
        username: perfilForm.username.trim(),
        atribuicao: perfilForm.atribuicao.trim(),
        setor: perfilForm.setor.trim().toUpperCase(),
        email: perfilForm.email.trim()
      };
      if (perfilForm.newPassword) updates.pin = perfilForm.newPassword;

      const { data: perfilData, error } = await api.users.update(targetUserId, updates);
      if (error) throw new Error(error);

      setSucessoUpdate(true);
      setPerfilForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));

      if (!usuarioEspelho) onPerfilAtualizado(wrapUser(perfilData));
      else {
        setListaUsuarios(prev => prev.map(u => u.id === perfilData.id ? perfilData : u));
        setUsuarioEspelho(perfilData);
        setModoEdicaoAdmin(false);
      }
      setTimeout(() => setSucessoUpdate(false), 3000);
    } catch (error) { setErroUpdate(error.message || 'Erro ao atualizar perfil.'); }
    finally { setLoadingUpdate(false); }
  };

  const isEditable = !usuarioEspelho || (isAdmin && modoEdicaoAdmin);

  return (
    <div className="relative w-full min-h-full flex flex-col items-center justify-center px-6 overflow-x-hidden">

      {/* FORMULÁRIO CENTRALIZADO (O ESTILO PERFEITO) */}
      <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <form onSubmit={handleUpdatePerfil} className="space-y-6 pb-20">
          <div className="bg-[var(--bg-card)] rounded-[2.5rem] overflow-hidden shadow-sm relative">
            <div className="h-32 bg-gradient-to-r from-[var(--bg-soft)] to-[var(--bg-card)] opacity-50"></div>

            {/* Lápis de Edição (Apenas para perfis de terceiros) */}
            {usuarioEspelho && (
              <button
                type="button"
                onClick={() => setModoEdicaoAdmin(!modoEdicaoAdmin)}
                className={`absolute top-6 right-6 w-11 h-11 rounded-full flex items-center justify-center transition-all z-10 ${modoEdicaoAdmin ? 'bg-emerald-500 text-white shadow-lg scale-110' : 'bg-black/5 dark:bg-white/5 text-[#606060] hover:bg-black/10 dark:hover:bg-white/10'}`}
                title={modoEdicaoAdmin ? "Edição Habilitada" : "Habilitar Edição"}
              >
                {modoEdicaoAdmin ? <CheckCircle2 size={16} /> : <Edit3 size={16} />}
              </button>
            )}

            <div className="px-10 pb-10 -mt-16 flex flex-col md:flex-row items-end gap-6 relative z-0">
              <div className="relative">
                <div className="w-32 h-32 rounded-[2rem] bg-[var(--bg-page)] overflow-hidden flex items-center justify-center border-4 border-[var(--bg-card)] shadow-sm">
                  {fotoPerfilPreview ? <img src={fotoPerfilPreview} alt="Avatar" className="w-full h-full object-cover" /> : <User size={48} className="text-[#404040]" />}
                </div>
                {isEditable && (
                  <>
                    <button type="button" onClick={() => fotoInputRef.current.click()} className="absolute bottom-0 right-0 p-2.5 bg-slate-200 dark:bg-[#404040] text-slate-700 dark:text-white rounded-xl shadow-lg hover:scale-110 transition-transform"><Camera size={16} /></button>
                    <input type="file" ref={fotoInputRef} onChange={handleFotoSelection} className="hidden" accept="image/*" />
                  </>
                )}
              </div>
              <div className="flex-1 pb-2">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white capitalize tracking-tight">
                  {usuarioEspelho ? usuarioEspelho.username : usuarioAtual?.get('username')}
                </h3>
                <p className="text-sm font-medium text-[#A0A0A0]">
                  {usuarioEspelho ? (usuarioEspelho.atribuicao || usuarioEspelho.email) : (usuarioAtual?.get('atribuicao') || usuarioAtual?.get('email'))}
                </p>
              </div>
            </div>

            <div className="px-10 pb-10 grid grid-cols-1 md:grid-cols-2 gap-8 pt-10">
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-[#606060] uppercase tracking-[0.2em] mb-2 ml-1">Dados da Conta</p>
                <div className="space-y-4">
                  <div className="relative"><User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" /><input disabled={!isEditable} type="text" value={perfilForm.nome} onChange={e => setPerfilForm({ ...perfilForm, nome: e.target.value })} placeholder="Nome Completo" className="w-full pl-14 pr-6 py-4 bg-[var(--bg-page)] rounded-2xl text-sm text-slate-900 dark:text-white outline-none disabled:opacity-50 transition-all" /></div>
                  <div className="relative"><User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" /><input disabled={!isEditable} type="text" value={perfilForm.username} onChange={e => setPerfilForm({ ...perfilForm, username: e.target.value })} placeholder="Nome de usuário" className="w-full pl-14 pr-6 py-4 bg-[var(--bg-page)] rounded-2xl text-sm text-slate-900 dark:text-white outline-none disabled:opacity-50 transition-all" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative"><Briefcase size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" /><input disabled={!isEditable} type="text" value={perfilForm.atribuicao} onChange={e => setPerfilForm({ ...perfilForm, atribuicao: e.target.value })} placeholder="Cargo" className="w-full pl-14 pr-6 py-4 bg-[var(--bg-page)] rounded-2xl text-sm text-slate-900 dark:text-white outline-none disabled:opacity-50 transition-all" /></div>
                    <div className="relative"><User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" /><input disabled={!isEditable} type="text" value={perfilForm.setor} onChange={e => setPerfilForm({ ...perfilForm, setor: e.target.value })} placeholder="Setor / Unidade" className="w-full pl-14 pr-6 py-4 bg-[var(--bg-page)] rounded-2xl text-sm text-slate-900 dark:text-white outline-none disabled:opacity-50 transition-all" /></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-[#606060] uppercase tracking-[0.2em] mb-2 ml-1">Segurança</p>
                <div className="relative"><Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" /><input disabled={!isEditable} type="email" value={perfilForm.email} onChange={e => setPerfilForm({ ...perfilForm, email: e.target.value })} placeholder="E-mail Corporativo" className="w-full pl-14 pr-6 py-4 bg-[var(--bg-page)] rounded-2xl text-sm text-slate-900 dark:text-white outline-none disabled:opacity-50 transition-all" /></div>
                <div className="relative"><Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" /><input disabled={!isEditable} type="password" value={perfilForm.newPassword} onChange={e => setPerfilForm({ ...perfilForm, newPassword: e.target.value })} placeholder="Nova senha" className="w-full pl-14 pr-6 py-4 bg-[var(--bg-page)] rounded-2xl text-sm text-slate-900 dark:text-white outline-none disabled:opacity-50 transition-all" /></div>
                <div className="relative"><Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" /><input disabled={!isEditable} type="password" value={perfilForm.confirmPassword} onChange={e => setPerfilForm({ ...perfilForm, confirmPassword: e.target.value })} placeholder="Confirmar" className="w-full pl-14 pr-6 py-4 bg-[var(--bg-page)] rounded-2xl text-sm text-slate-900 dark:text-white outline-none disabled:opacity-50 transition-all" /></div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative flex flex-col items-center">
              <button type="submit" disabled={loadingUpdate || !isEditable} className="w-full flex items-center justify-between bg-[var(--bg-card)] p-3 rounded-3xl group transition-all disabled:opacity-30">
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-[#606060] ml-6">
                  {loadingUpdate ? 'Processando...' : (usuarioEspelho ? `Atualizar Perfil de ${usuarioEspelho.username}` : 'Salvar informações')}
                </span>
                <div className="w-14 h-14 flex items-center justify-center rounded-2xl transition-all group-hover:opacity-70 bg-[var(--bg-page)] text-slate-900 dark:text-white shadow-inner">
                  {loadingUpdate ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={18} />}
                </div>
              </button>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-3 w-full justify-center">
                {sucessoUpdate && <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-[10px] uppercase tracking-widest animate-in fade-in zoom-in slide-in-from-bottom-2 bg-black/5 dark:bg-white/5 px-4 py-2 rounded-full shadow-sm"><ShieldCheck size={14} /> Atualizado com sucesso</div>}
                {erroUpdate && <div className="flex items-center gap-2 text-red-400 font-bold text-[10px] uppercase tracking-widest animate-in fade-in zoom-in slide-in-from-bottom-2 bg-red-500/10 px-4 py-2 rounded-full shadow-sm"><ShieldAlert size={14} /> {erroUpdate}</div>}
              </div>
            </div>

            {/* Botão idêntico ao de salvar para voltar ao perfil próprio */}
            {usuarioEspelho && (
              <div className="animate-in fade-in slide-in-from-top-4">
                <button 
                  type="button"
                  onClick={() => setUsuarioEspelho(null)}
                  className="w-full flex items-center justify-between bg-[var(--bg-card)] p-3 rounded-3xl group transition-all"
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-[#606060] ml-6">
                    Voltar ao meu perfil
                  </span>
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl transition-all group-hover:opacity-70 bg-[var(--bg-page)] text-slate-900 dark:text-white shadow-inner">
                    <ArrowRight size={18} className="rotate-180" />
                  </div>
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* AGENTES NA DIREITA (ESTILO SUTIL E MINIMALISTA) */}
      {isAdmin && (
        <div className="fixed right-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-1000 hidden xl:flex z-40">
           
           <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 bg-[var(--bg-card)] rounded-full flex items-center justify-center text-[#606060] shadow-sm opacity-40"><Users size={18} /></div>
              <div className="h-16 w-px bg-gradient-to-b from-transparent via-[#606060]/20 to-transparent"></div>
           </div>

           <div className="bg-[var(--bg-card)] p-2 rounded-full space-y-3">
              {listaUsuarios
                .filter(u => u.username !== usuarioAtual?.get('username'))
                .map(user => (
                 <button 
                    key={user.id} 
                    onClick={() => setUsuarioEspelho(user)} 
                    className={`w-8 h-8 rounded-full overflow-hidden block transition-all relative group ${usuarioEspelho?.id === user.id ? 'ring-2 ring-black dark:ring-white scale-110 shadow-lg z-10' : 'opacity-40 hover:opacity-100 hover:scale-110'}`}
                 >
                    {user.foto_perfil ? (
                      <img src={user.foto_perfil} className="w-full h-full object-cover" alt={user.username} />
                    ) : (
                      <div className="w-full h-full bg-black/10 flex items-center justify-center text-[8px] font-black uppercase text-slate-600">
                        {user.username.charAt(0)}
                      </div>
                    )}
                    
                    <span className="absolute right-full mr-4 px-2 py-1 bg-black text-white text-[8px] font-bold uppercase rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                      {user.nome || user.username}
                    </span>
                 </button>
              ))}
           </div>
        </div>
      )}

    </div>
  );
}
