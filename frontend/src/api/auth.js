// frontend/src/api/auth.js
const json = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
};

export const authApi = {
  // session
  me:       () => fetch('/api/auth/me',      { credentials: 'include' }).then(json),
  refresh:  () => fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' }).then(json),

  // auth
  login:    ({ email, password }) =>
              fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
              }).then(json),

  register: ({ fullName, email, phone, password, role }) =>
              fetch('/api/auth/register', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, email, phone, password, role }),
              }).then(json),

  logout:   () => fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
              }).then(json),

  // session management
  listSessions:  () => fetch('/api/auth/sessions', { credentials: 'include' }).then(json),
  revokeSession: (id) => fetch(`/api/auth/sessions/${id}`, {
                      method: 'DELETE',
                      credentials: 'include',
                    }).then(json),
  revokeAll:     () => fetch('/api/auth/sessions', {
                      method: 'DELETE',
                      credentials: 'include',
                    }).then(json),
};
