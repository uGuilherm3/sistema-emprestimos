import { useState, useEffect } from 'react';
import { supabase } from '@shared/utils/supabaseClient';

const LOGIN_URL = import.meta.env.VITE_LOGIN_URL || 'http://localhost:5174/';

export function createUserMock(perfil) {
  return {
    id: perfil.id,
    username: perfil.username,
    nome: perfil.nome || perfil.username,
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
      if (field === 'pin') return perfil.pin;
      if (field === 'adm') return perfil.adm === true;
      return perfil[field];
    },
    save: async () => {},
  };
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('tilend_uid');
      if (uid) {
        localStorage.setItem('tilend_user_id', uid);
        params.delete('tilend_uid');
        const newSearch = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (newSearch ? '?' + newSearch : ''));
      }
      const id = uid || localStorage.getItem('tilend_user_id');
      if (!id) { window.location.href = LOGIN_URL; return; }
      const { data } = await supabase.from('perfil').select('*').eq('id', id).single();
      if (!data) { localStorage.removeItem('tilend_user_id'); window.location.href = LOGIN_URL; return; }
      setUser(createUserMock(data));
      setLoading(false);
    };
    check();
  }, []);

  const logout = () => { localStorage.removeItem('tilend_user_id'); window.location.href = LOGIN_URL; };
  return { user, loading, logout };
}
