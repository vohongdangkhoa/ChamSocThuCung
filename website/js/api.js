import { auth, API_BASE } from './cau-hinh.js';

export async function goiApi(path, { method = 'GET', body, publicAccess = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (!publicAccess) {
    const user = auth.currentUser;
    if (!user) throw new Error('Bạn cần đăng nhập lại.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method, headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được API. Hãy chạy run_petnova_web_dev.cmd rồi thử lại.');
  }

  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const message = typeof data === 'string' ? data : data?.message || data?.title;
    const error = new Error(message || `Yêu cầu thất bại (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => goiApi(path),
  post: (path, body) => goiApi(path, { method: 'POST', body }),
  put: (path, body) => goiApi(path, { method: 'PUT', body }),
  del: (path) => goiApi(path, { method: 'DELETE' }),
  upload: async (path, file) => {
    const body = new FormData(); body.append('file', file);
    return goiApi(path, { method: 'POST', body });
  },
};
