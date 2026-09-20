import { auth } from './firebase';

function envBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  const value = typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : 'http://localhost:5200';

  return value.replace(/\/+$/, '');
}

export const API_BASE_URL = envBaseUrl();

function assertPasswordResetTransport() {
  const baseUrl = new URL(API_BASE_URL);
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(
    baseUrl.hostname.toLowerCase(),
  );
  if (baseUrl.protocol !== 'https:' && !isLoopback) {
    throw new ApiError(
      'Đặt lại mật khẩu chỉ được phép qua HTTPS. Khi phát triển, hãy dùng API loopback.',
    );
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, url = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.url = url;
  }
}

export class UserAccountNotFoundError extends ApiError {
  constructor(message = 'Không tìm thấy hồ sơ PetNoVa của tài khoản này.') {
    super(message, { status: 404 });
    this.name = 'UserAccountNotFoundError';
  }
}

function endpoint(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return API_BASE_URL + (path.startsWith('/') ? path : '/' + path);
}

function messageFromPayload(payload, fallback) {
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (payload && typeof payload === 'object') {
    const message = payload.message ?? payload.title ?? payload.error;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return fallback;
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

/**
 * Request helper for public endpoints. Use authenticatedFetch for PetNoVa APIs
 * that validate Firebase Bearer tokens.
 */
export async function apiFetch(path, options = {}) {
  const {
    body,
    headers: suppliedHeaders,
    signal,
    method = 'GET',
  } = options;
  const url = endpoint(path);
  const headers = new Headers(suppliedHeaders || {});

  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (body !== undefined && body !== null && !isFormData(body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined || body === null
        ? undefined
        : (typeof body === 'string' || isFormData(body) ? body : JSON.stringify(body)),
      signal,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      'Không thể kết nối tới máy chủ PetNoVa. Vui lòng kiểm tra lại mạng.',
      { url },
    );
  }

  const data = await readPayload(response);
  if (!response.ok) {
    throw new ApiError(
      messageFromPayload(data, 'PetNoVa chưa thể xử lý yêu cầu. Vui lòng thử lại.'),
      { status: response.status, data, url },
    );
  }

  return data;
}

/**
 * Fetches an API endpoint with the current Firebase ID token. A caller may
 * provide a Firebase user explicitly when synchronising a just-created account.
 */
export async function authenticatedFetch(path, options = {}) {
  const { firebaseUser = auth.currentUser, headers, ...requestOptions } = options;
  if (!firebaseUser) {
    throw new ApiError('Bạn cần đăng nhập Firebase để thực hiện thao tác này.');
  }

  const idToken = await firebaseUser.getIdToken();
  if (!idToken) {
    throw new ApiError('Không lấy được phiên đăng nhập Firebase.');
  }

  return apiFetch(path, {
    ...requestOptions,
    headers: {
      ...(headers || {}),
      Authorization: 'Bearer ' + idToken,
    },
  });
}

export function normaliseUserAccount(value = {}) {
  return {
    userId: String(value.userId ?? ''),
    firebaseUid: String(value.firebaseUid ?? ''),
    fullName: String(value.fullName ?? ''),
    email: String(value.email ?? ''),
    phone: String(value.phone ?? ''),
    role: String(value.role ?? '').trim().toUpperCase(),
    status: String(value.status ?? '').trim().toUpperCase(),
    fcmToken: String(value.fcmToken ?? ''),
    createdAt: value.createdAt ?? '',
    avatarUrl: String(value.avatarUrl ?? ''),
    avatarPublicId: String(value.avatarPublicId ?? ''),
  };
}

export async function getUserAccountByFirebaseUid(firebaseUid, firebaseUser) {
  try {
    const data = await authenticatedFetch(
      '/api/UserAccounts/firebase/' + encodeURIComponent(firebaseUid),
      { firebaseUser },
    );
    return normaliseUserAccount(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new UserAccountNotFoundError();
    }
    throw error;
  }
}

export async function getUserAccountByEmail(email, firebaseUser) {
  try {
    const data = await authenticatedFetch(
      '/api/UserAccounts/email/' + encodeURIComponent(email),
      { firebaseUser },
    );
    return normaliseUserAccount(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new UserAccountNotFoundError();
    }
    throw error;
  }
}

export async function createUserAccount(account, firebaseUser) {
  const data = await authenticatedFetch('/api/UserAccounts', {
    method: 'POST',
    body: account,
    firebaseUser,
  });
  return normaliseUserAccount(data);
}

export async function updateProfileByEmail({ email, fullName, phone }, firebaseUser) {
  return authenticatedFetch(
    '/api/UserAccounts/update-profile-by-email/' + encodeURIComponent(email),
    {
      method: 'PUT',
      body: { fullName, phone },
      firebaseUser,
    },
  );
}

export async function getUserAccounts(firebaseUser) {
  const data = await authenticatedFetch('/api/UserAccounts', { firebaseUser });
  return Array.isArray(data) ? data.map(normaliseUserAccount) : [];
}

export async function updateUserStatus(userId, status, firebaseUser) {
  return authenticatedFetch('/api/UserAccounts/' + encodeURIComponent(userId) + '/status', {
    method: 'PUT',
    body: { status },
    firebaseUser,
  });
}

export async function updateUserRole(userId, role, firebaseUser) {
  return authenticatedFetch('/api/UserAccounts/' + encodeURIComponent(userId) + '/role', {
    method: 'PUT',
    body: { role },
    firebaseUser,
  });
}

function requestOptions(value) {
  if (value && typeof value.getIdToken === 'function') {
    return { firebaseUser: value };
  }
  return value && typeof value === 'object' ? value : {};
}

/**
 * Convenience client for feature pages. It uses the current Firebase user by
 * default, accepts an explicit Firebase user as the final argument, and keeps
 * every relative path rooted at VITE_API_BASE_URL.
 *
 * Examples:
 *   api.get('/api/Pets')
 *   api.post('/api/Pets', payload)
 *   api.put('/api/Pets/P001', payload, firebaseUser)
 *   api.upload('/api/Media', photoFile, { fieldName: 'file' })
 */
export const api = Object.freeze({
  get(path, options) {
    return authenticatedFetch(path, { ...requestOptions(options), method: 'GET' });
  },
  post(path, body, options) {
    return authenticatedFetch(path, {
      ...requestOptions(options),
      method: 'POST',
      body,
    });
  },
  put(path, body, options) {
    return authenticatedFetch(path, {
      ...requestOptions(options),
      method: 'PUT',
      body,
    });
  },
  delete(path, options) {
    return authenticatedFetch(path, { ...requestOptions(options), method: 'DELETE' });
  },
  upload(path, fileOrFormData, options = {}) {
    const uploadOptions = requestOptions(options);
    const formData = isFormData(fileOrFormData) ? fileOrFormData : new FormData();
    if (!isFormData(fileOrFormData)) {
      formData.append(uploadOptions.fieldName || 'file', fileOrFormData);
    }
    const { fieldName, ...fetchOptions } = uploadOptions;
    return authenticatedFetch(path, {
      ...fetchOptions,
      method: fetchOptions.method || 'POST',
      body: formData,
    });
  },
});

/**
 * The three public endpoints power the OTP password-recovery wizard. They do
 * not use a Firebase token because a locked-out user has no active session.
 */
export async function requestPasswordResetOtp(phone) {
  assertPasswordResetTransport();
  const data = await apiFetch('/api/auth/password-reset/request', {
    method: 'POST',
    body: { phone },
  });
  if (!data || !data.challengeId) {
    throw new ApiError('Máy chủ trả về phiên OTP không hợp lệ.');
  }
  return {
    challengeId: String(data.challengeId),
    maskedEmail: String(data.maskedEmail || 'email đã liên kết'),
    expiresInSeconds: Number(data.expiresInSeconds) || 300,
    resendAfterSeconds: Number(data.resendAfterSeconds) || 0,
    message: String(data.message || ''),
  };
}

export async function verifyPasswordResetOtp({ challengeId, otp }) {
  assertPasswordResetTransport();
  const data = await apiFetch('/api/auth/password-reset/verify', {
    method: 'POST',
    body: { challengeId, otp },
  });
  if (!data || !data.challengeId || !data.resetToken) {
    throw new ApiError('Máy chủ trả về vé đặt lại mật khẩu không hợp lệ.');
  }
  return {
    challengeId: String(data.challengeId),
    resetToken: String(data.resetToken),
    expiresInSeconds: Number(data.expiresInSeconds) || 600,
  };
}

export async function completePasswordReset({ challengeId, resetToken, newPassword }) {
  assertPasswordResetTransport();
  return apiFetch('/api/auth/password-reset/complete', {
    method: 'POST',
    body: { challengeId, resetToken, newPassword },
  });
}

export function errorMessage(error, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
}

// Feature pages use this shorter name; retain errorMessage for auth callers.
export const formatError = errorMessage;
