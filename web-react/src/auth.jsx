import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase';
import {
  UserAccountNotFoundError,
  createUserAccount,
  getUserAccountByEmail,
  getUserAccountByFirebaseUid,
  normaliseUserAccount,
} from './api';

const AuthContext = createContext(null);
export const PETNOVA_ROLES = Object.freeze(['CUSTOMER', 'STAFF', 'VET', 'ADMIN']);

export class AuthProfileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthProfileError';
  }
}

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new AuthProfileError(label + ' là bắt buộc.');
  return text;
}

function validateProfile(rawProfile) {
  const profile = normaliseUserAccount(rawProfile);

  if (profile.status !== 'ACTIVE') {
    throw new AuthProfileError('Tài khoản của bạn đang bị khóa hoặc tạm ngưng.');
  }
  if (!PETNOVA_ROLES.includes(profile.role)) {
    throw new AuthProfileError('Vai trò tài khoản không hợp lệ: ' + (profile.role || 'trống') + '.');
  }

  return profile;
}

async function loadUserProfile(firebaseUser) {
  if (!firebaseUser?.uid) {
    throw new AuthProfileError('Chưa đăng nhập Firebase.');
  }

  try {
    return validateProfile(
      await getUserAccountByFirebaseUid(firebaseUser.uid, firebaseUser),
    );
  } catch (error) {
    // Older SQL records may have been created before firebaseUid was populated.
    // The backend still verifies that the token email belongs to the record.
    if (!(error instanceof UserAccountNotFoundError)) throw error;

    const email = String(firebaseUser.email ?? '').trim();
    if (!email) {
      throw new AuthProfileError('Tài khoản Firebase không có email để tìm hồ sơ PetNoVa.');
    }

    return validateProfile(await getUserAccountByEmail(email, firebaseUser));
  }
}

export function firebaseErrorMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/email-already-in-use':
      return 'Email này đã được đăng ký.';
    case 'auth/invalid-email':
      return 'Email không đúng định dạng.';
    case 'auth/weak-password':
      return 'Mật khẩu cần có ít nhất 6 ký tự.';
    case 'auth/network-request-failed':
      return 'Kết nối Firebase bị gián đoạn. Hãy kiểm tra mạng rồi thử lại.';
    case 'auth/too-many-requests':
      return 'Bạn đã thử quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.';
    case 'auth/user-disabled':
      return 'Tài khoản Firebase này đã bị vô hiệu hóa.';
    default:
      return error?.message || 'Firebase chưa thể hoàn tất yêu cầu. Vui lòng thử lại.';
  }
}

/**
 * Holds the Firebase identity plus the PetNoVa SQL profile. The SQL role and
 * account status are always fetched from the server; they are never trusted
 * from browser input or Firebase display information.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const registrationInFlight = useRef(false);

  const syncProfile = useCallback(async (firebaseUser, { showLoading = true } = {}) => {
    const requestId = ++requestSequence.current;
    if (!firebaseUser) {
      setUser(null);
      setProfile(null);
      setError('');
      setLoading(false);
      return null;
    }

    if (showLoading) setLoading(true);
    setError('');
    setUser(firebaseUser);

    try {
      const nextProfile = await loadUserProfile(firebaseUser);
      if (requestId === requestSequence.current) {
        setProfile(nextProfile);
        setError('');
      }
      return nextProfile;
    } catch (profileError) {
      if (requestId === requestSequence.current) {
        setProfile(null);
        setError(profileError?.message || 'Không thể tải hồ sơ PetNoVa.');
      }
      throw profileError;
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (disposed) return;

      if (!firebaseUser) {
        requestSequence.current += 1;
        setUser(null);
        setProfile(null);
        setError('');
        setLoading(false);
        return;
      }

      // During registration, a Firebase identity exists before the SQL POST
      // finishes. Avoid treating that short interval as a missing profile.
      if (registrationInFlight.current) {
        setUser(firebaseUser);
        setLoading(true);
        return;
      }

      void syncProfile(firebaseUser).catch(() => {
        // syncProfile keeps the user-facing failure in context state.
      });
    });

    return () => {
      disposed = true;
      requestSequence.current += 1;
      unsubscribe();
    };
  }, [syncProfile]);

  const login = useCallback(async ({ email, password }) => {
    const normalizedEmail = requiredText(email, 'Email');
    const suppliedPassword = String(password ?? '');
    if (!suppliedPassword) throw new AuthProfileError('Mật khẩu là bắt buộc.');

    setError('');
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        suppliedPassword,
      );
      return await syncProfile(credential.user);
    } catch (loginError) {
      if (loginError?.code?.startsWith('auth/')) {
        const friendlyError = new AuthProfileError(firebaseErrorMessage(loginError));
        setError(friendlyError.message);
        throw friendlyError;
      }
      throw loginError;
    }
  }, [syncProfile]);

  const register = useCallback(async ({
    fullName,
    email,
    phone,
    password,
  }) => {
    const normalizedName = requiredText(fullName, 'Họ và tên');
    const normalizedEmail = requiredText(email, 'Email');
    const normalizedPhone = requiredText(phone, 'Số điện thoại');
    const suppliedPassword = String(password ?? '');
    if (suppliedPassword.length < 6) {
      throw new AuthProfileError('Mật khẩu cần có ít nhất 6 ký tự.');
    }

    registrationInFlight.current = true;
    setLoading(true);
    setError('');
    try {
      // Firebase owns password storage; PetNoVa stores only its business profile.
      const credential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        suppliedPassword,
      );
      const firebaseUser = credential.user;
      if (!firebaseUser) {
        throw new AuthProfileError('Firebase không trả về tài khoản vừa tạo.');
      }

      await updateProfile(firebaseUser, { displayName: normalizedName });
      const created = await createUserAccount({
        userId: '',
        firebaseUid: firebaseUser.uid,
        fullName: normalizedName,
        email: firebaseUser.email || normalizedEmail,
        phone: normalizedPhone,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        fcmToken: '',
        avatarUrl: '',
        avatarPublicId: '',
      }, firebaseUser);
      const nextProfile = validateProfile(created);

      // Apply the successful profile immediately instead of waiting for another
      // Firebase auth event.
      requestSequence.current += 1;
      setUser(firebaseUser);
      setProfile(nextProfile);
      setError('');
      return nextProfile;
    } catch (registrationError) {
      if (registrationError?.code?.startsWith('auth/')) {
        const friendlyError = new AuthProfileError(firebaseErrorMessage(registrationError));
        setError(friendlyError.message);
        throw friendlyError;
      }
      setError(registrationError?.message || 'Không thể hoàn tất đăng ký.');
      throw registrationError;
    } finally {
      registrationInFlight.current = false;
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new AuthProfileError('Bạn chưa đăng nhập Firebase.');
    }
    return syncProfile(firebaseUser);
  }, [syncProfile]);

  const logout = useCallback(async () => {
    requestSequence.current += 1;
    setLoading(true);
    try {
      await signOut(auth);
    } finally {
      setUser(null);
      setProfile(null);
      setError('');
      setLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    error,
    login,
    register,
    logout,
    refreshProfile,
    clearError: () => setError(''),
  }), [error, loading, login, logout, profile, refreshProfile, register, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider.');
  }
  return context;
}

/**
 * Optional small gate for pages that want to render a dedicated fallback.
 * App.jsx may also decide routing itself from useAuth().
 */
export function AuthGate({ children, loadingFallback = null, signedOutFallback = null }) {
  const { loading, user } = useAuth();
  if (loading) return loadingFallback;
  if (!user) return signedOutFallback;
  return children;
}
