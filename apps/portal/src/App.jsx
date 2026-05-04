import React, { useState, useEffect } from 'react';
import PortalSolicitante from '@shared/PortalSolicitante';
import { useAuth } from './useAuth';

export default function App() {
  const { user, loading, logout } = useAuth();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('tema_tilend') === 'escuro');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tema_tilend', 'escuro');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tema_tilend', 'claro');
    }
  }, [isDark]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'tema_tilend') setIsDark(e.newValue === 'escuro');
    };
    const onMessage = (e) => {
      if (e.data?.type === 'TILEND_THEME') setIsDark(e.data.dark);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  if (loading || !user) return null;

  return (
    <PortalSolicitante
      usuarioAtual={user}
      onLogout={logout}
      onVoltar={null}
      onLoginSucesso={null}
      isDarkMode={isDark}
      setIsDarkMode={setIsDark}
      isEmbedded={true}
    />
  );
}
