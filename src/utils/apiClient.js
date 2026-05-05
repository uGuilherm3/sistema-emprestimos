// src/utils/apiClient.js
// Cliente HTTP para a API REST do TI LEND (backend MariaDB).
// Substitui todas as chamadas ao Supabase no frontend.
//
// CONVENÇÃO DE RETORNO:
//   Todas as funções retornam { data, error } para manter
//   compatibilidade com o padrão antigo do Supabase.

const BASE_URL = import.meta.env.VITE_API_URL || '/sistemas';

const API_KEY = import.meta.env.VITE_API_KEY || '';

async function req(method, path, body = null) {
  try {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {})
      },
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${path}`, opts);
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: json.data ?? json, error: json.error ?? null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

// ─── ITEMS ────────────────────────────────────────────────────
export const api = {
  items: {
    list:   (params = {}) => req('GET',    '/api/items?' + new URLSearchParams(params)),
    get:    (id)         => req('GET',    `/api/items/${id}`),
    insert: (data)       => req('POST',   '/api/items', data),
    update: (id, data)   => req('PUT',    `/api/items/${id}`, data),
    upsert: (data)       => req('POST',   '/api/items/upsert', data),
    delete: (id)         => req('DELETE', `/api/items/${id}`),
  },

  // ─── EMPRÉSTIMOS ────────────────────────────────────────────
  emprestimos: {
    list:          (params = {}) => req('GET', '/api/emprestimos?' + new URLSearchParams(params)),
    get:           (id)          => req('GET', `/api/emprestimos/${id}`),
    protocolCount: ()            => req('GET', '/api/emprestimos/protocolo-count'),
    insert:        (data)        => req('POST',   '/api/emprestimos', data),
    update:        (id, data)    => req('PUT',    `/api/emprestimos/${id}`, data),
    updateMany:    (ids, data)   => req('PUT',    '/api/emprestimos', { ids, ...data }),
    deleteMany:    (ids)         => req('DELETE', '/api/emprestimos', { ids }),
  },

  // ─── USERS ──────────────────────────────────────────────────
  users: {
    list:         (params = {}) => req('GET', '/api/users?' + new URLSearchParams(params)),
    get:          (id)          => req('GET', `/api/users/${id}`),
    login:        (login, pin)  => req('POST', '/api/users/login', { login, pin }),
    checkExists:  (username, email) => req('POST', '/api/users/check-exists', { username, email }),
    insert:       (data)        => req('POST',   '/api/users', data),
    update:       (id, data)    => req('PUT',    `/api/users/${id}`, data),
    delete:       (id)          => req('DELETE', `/api/users/${id}`),
  },

  // ─── LOGS ───────────────────────────────────────────────────
  logs: {
    list:   (params = {}) => req('GET', '/api/logs?' + new URLSearchParams(params)),
    insert: (data)        => req('POST', '/api/logs', data),
  },

  // ─── AGENDA ─────────────────────────────────────────────────
  agenda: {
    list:    (params = {}) => req('GET', '/api/agenda?' + new URLSearchParams(params)),
    perfis:  ()            => req('GET', '/api/agenda/perfis'),
    insert:  (data)        => req('POST',   '/api/agenda', data),
    update:  (id, data)    => req('PUT',    `/api/agenda/${id}`, data),
    delete:  (id)          => req('DELETE', `/api/agenda/${id}`),
  },

  // ─── UPLOADS ────────────────────────────────────────────────
  uploads: {
    /**
     * Envia uma foto de perfil para o servidor.
     * @param {string} userId - ID do usuário
     * @param {File}   file   - Objeto File do input
     * @returns {{ data: { url: string }, error: string|null }}
     */
    foto: async (userId, file) => {
      try {
        const form = new FormData();
        form.append('foto', file);
        const res = await fetch(`${BASE_URL}/api/uploads/foto/${userId}`, {
          method: 'POST',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
          body: form,
        });
        const json = await res.json();
        if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
        return { data: json.data, error: null };
      } catch (e) { return { data: null, error: e.message }; }
    },

    deleteFoto: (userId) => req('DELETE', `/api/uploads/foto/${userId}`),

    /**
     * Envia um comprovante (imagem ou PDF) para um empréstimo.
     * @param {string} empId  - ID do empréstimo
     * @param {File}   file   - Objeto File do input
     * @param {string} campo  - 'comprovante_saida' | 'comprovante_devolucao'
     */
    comprovante: async (empId, file, campo = 'comprovante_saida') => {
      try {
        const form = new FormData();
        form.append('comprovante', file);
        const res = await fetch(`${BASE_URL}/api/uploads/comprovante/${empId}?campo=${campo}`, {
          method: 'POST',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
          body: form,
        });
        const json = await res.json();
        if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
        return { data: json.data, error: null };
      } catch (e) { return { data: null, error: e.message }; }
    },

    deleteComprovante: (empId, campo = 'comprovante_saida') =>
      req('DELETE', `/api/uploads/comprovante/${empId}?campo=${campo}`),
  },
};

export default api;
