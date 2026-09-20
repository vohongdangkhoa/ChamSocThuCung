import { useEffect, useState } from 'react';
import {
  completePasswordReset,
  errorMessage,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
} from './api';
import { useAuth } from './auth';

const emptyReset = {
  phone: '',
  otp: '',
  password: '',
  confirmation: '',
  challengeId: '',
  resetToken: '',
  maskedEmail: 'email đã liên kết',
  expiresInSeconds: 0,
  resendAfterSeconds: 0,
  step: 'phone',
};

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function AuthBrand() {
  return (
    <section className="auth-intro">
      <p className="eyebrow">PET CARE, SIMPLIFIED</p>
      <h1>PetNoVa<br /><em>luôn ở bên bạn nhỏ.</em></h1>
      <p>
        Quản lý hồ sơ, lịch hẹn và hành trình chăm sóc thú cưng trong một không gian ấm áp, dễ dùng.
      </p>
      <ul className="feature-list">
        <li><span>✓</span> Hồ sơ thú cưng luôn sẵn sàng</li>
        <li><span>✓</span> Nhắc lịch hẹn và chăm sóc</li>
        <li><span>✓</span> Kết nối phòng khám tin cậy</li>
      </ul>
    </section>
  );
}

function FormMessage({ error, notice }) {
  if (error) return <p className="form-feedback" role="alert">{error}</p>;
  if (notice) return <p className="form-feedback form-success" role="status">{notice}</p>;
  return null;
}

/**
 * Login, customer registration, and the three-step PetNoVa OTP recovery
 * journey. It deliberately uses local state rather than a router so App.jsx
 * can render it directly whenever Firebase has no signed-in user.
 */
export function AuthPages() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmation: '',
  });
  const [reset, setReset] = useState(emptyReset);

  useEffect(() => {
    if (reset.resendAfterSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setReset((current) => ({
        ...current,
        resendAfterSeconds: Math.max(0, current.resendAfterSeconds - 1),
      }));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [reset.resendAfterSeconds]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setFormError('');
    setNotice('');
  }

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      await action();
    } catch (actionError) {
      setFormError(errorMessage(actionError));
    } finally {
      setBusy(false);
    }
  }

  function submitLogin(event) {
    event.preventDefault();
    void run(() => login(loginForm));
  }

  function submitRegister(event) {
    event.preventDefault();
    void run(async () => {
      if (registerForm.password !== registerForm.confirmation) {
        throw new Error('Hai mật khẩu chưa trùng khớp.');
      }
      await register(registerForm);
    });
  }

  function submitPhone(event, isResend = false) {
    event?.preventDefault();
    void run(async () => {
      const phone = reset.phone.trim();
      const count = digitsOnly(phone).length;
      if (count < 9 || count > 15) {
        throw new Error('Vui lòng nhập số điện thoại hợp lệ.');
      }

      const result = await requestPasswordResetOtp(phone);
      setReset((current) => ({
        ...current,
        otp: '',
        challengeId: result.challengeId,
        resetToken: '',
        maskedEmail: result.maskedEmail,
        expiresInSeconds: result.expiresInSeconds,
        resendAfterSeconds: Math.min(Math.max(result.resendAfterSeconds, 0), 300),
        step: 'otp',
      }));
      setNotice(isResend ? 'Đã xử lý yêu cầu gửi lại OTP.' : 'Mã OTP đã được gửi tới email liên kết.');
    });
  }

  function submitOtp(event) {
    event.preventDefault();
    void run(async () => {
      if (!/^\d{6}$/.test(reset.otp.trim())) {
        throw new Error('Mã OTP phải gồm đúng 6 chữ số.');
      }

      const result = await verifyPasswordResetOtp({
        challengeId: reset.challengeId,
        otp: reset.otp.trim(),
      });
      setReset((current) => ({
        ...current,
        challengeId: result.challengeId,
        resetToken: result.resetToken,
        expiresInSeconds: result.expiresInSeconds,
        password: '',
        confirmation: '',
        step: 'password',
      }));
      setNotice('OTP đã được xác thực. Hãy đặt mật khẩu mới.');
    });
  }

  function submitNewPassword(event) {
    event.preventDefault();
    void run(async () => {
      if (reset.password.length < 6) {
        throw new Error('Mật khẩu mới cần ít nhất 6 ký tự.');
      }
      if (reset.password.length > 128) {
        throw new Error('Mật khẩu mới không được quá 128 ký tự.');
      }
      if (reset.password !== reset.confirmation) {
        throw new Error('Hai mật khẩu chưa trùng khớp.');
      }

      await completePasswordReset({
        challengeId: reset.challengeId,
        resetToken: reset.resetToken,
        newPassword: reset.password,
      });
      setReset(emptyReset);
      setMode('login');
      setFormError('');
      setNotice('Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.');
    });
  }

  function returnToPhoneStep() {
    setReset((current) => ({
      ...emptyReset,
      phone: current.phone,
    }));
    setFormError('');
    setNotice('');
  }

  return (
    <main className="auth-page">
      <AuthBrand />
      <section className="auth-card" aria-labelledby="auth-title">
        <h2 id="auth-title">
          {mode === 'login' && 'Chào mừng trở lại'}
          {mode === 'register' && 'Tạo tài khoản'}
          {mode === 'forgot' && 'Khôi phục mật khẩu'}
        </h2>
        <p>
          {mode === 'login' && 'Đăng nhập để tiếp tục chăm sóc bạn nhỏ của bạn.'}
          {mode === 'register' && 'Tạo tài khoản PetNoVa cho hành trình chăm sóc thú cưng.'}
          {mode === 'forgot' && 'Khôi phục mật khẩu an toàn bằng mã OTP gửi qua email.'}
        </p>

        <FormMessage error={formError} notice={notice} />

        {mode === 'login' && (
          <form className="form-grid" onSubmit={submitLogin}>
            <label>
              Email
              <input
                autoComplete="email"
                disabled={busy}
                inputMode="email"
                onChange={(event) => setLoginForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))}
                placeholder="ban@email.com"
                required
                type="email"
                value={loginForm.email}
              />
            </label>
            <label>
              Mật khẩu
              <input
                autoComplete="current-password"
                disabled={busy}
                onChange={(event) => setLoginForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))}
                placeholder="Nhập mật khẩu"
                required
                type="password"
                value={loginForm.password}
              />
            </label>
            <button className="button button-primary" disabled={busy} type="submit">
              {busy ? 'ĐANG ĐĂNG NHẬP…' : 'ĐĂNG NHẬP'}
            </button>
            <button
              className="form-link"
              disabled={busy}
              onClick={() => changeMode('forgot')}
              type="button"
            >
              Quên mật khẩu?
            </button>
            <p className="auth-switch">
              Chưa có tài khoản?{' '}
              <button className="form-link" disabled={busy} onClick={() => changeMode('register')} type="button">
                Đăng ký ngay
              </button>
            </p>
          </form>
        )}

        {mode === 'register' && (
          <form className="form-grid" onSubmit={submitRegister}>
            <label>
              Họ và tên
              <input
                autoComplete="name"
                disabled={busy}
                onChange={(event) => setRegisterForm((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))}
                placeholder="Nguyễn Minh Anh"
                required
                value={registerForm.fullName}
              />
            </label>
            <label>
              Email
              <input
                autoComplete="email"
                disabled={busy}
                inputMode="email"
                onChange={(event) => setRegisterForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))}
                placeholder="ban@email.com"
                required
                type="email"
                value={registerForm.email}
              />
            </label>
            <label>
              Số điện thoại
              <input
                autoComplete="tel"
                disabled={busy}
                inputMode="tel"
                onChange={(event) => setRegisterForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))}
                placeholder="0901 234 567"
                required
                type="tel"
                value={registerForm.phone}
              />
            </label>
            <label>
              Mật khẩu
              <input
                autoComplete="new-password"
                disabled={busy}
                minLength="6"
                onChange={(event) => setRegisterForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))}
                placeholder="Ít nhất 6 ký tự"
                required
                type="password"
                value={registerForm.password}
              />
            </label>
            <label>
              Xác nhận mật khẩu
              <input
                autoComplete="new-password"
                disabled={busy}
                minLength="6"
                onChange={(event) => setRegisterForm((current) => ({
                  ...current,
                  confirmation: event.target.value,
                }))}
                placeholder="Nhập lại mật khẩu"
                required
                type="password"
                value={registerForm.confirmation}
              />
            </label>
            <button className="button button-primary" disabled={busy} type="submit">
              {busy ? 'ĐANG TẠO TÀI KHOẢN…' : 'TẠO TÀI KHOẢN'}
            </button>
            <p className="auth-switch">
              Đã có tài khoản?{' '}
              <button className="form-link" disabled={busy} onClick={() => changeMode('login')} type="button">
                Đăng nhập
              </button>
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <section className="form-grid forgot-flow" aria-live="polite">
            <div className="reset-progress" aria-label={'Bước ' + (reset.step === 'phone' ? 1 : reset.step === 'otp' ? 2 : 3) + ' trên 3'}>
              <span className={reset.step === 'phone' ? 'active' : 'complete'}>1</span>
              <span className={reset.step === 'otp' ? 'active' : reset.step === 'password' ? 'complete' : ''}>2</span>
              <span className={reset.step === 'password' ? 'active' : ''}>3</span>
            </div>

            {reset.step === 'phone' && (
              <form onSubmit={submitPhone}>
                <label>
                  Số điện thoại đã đăng ký
                  <input
                    autoComplete="tel"
                    disabled={busy}
                    inputMode="tel"
                    onChange={(event) => setReset((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="0901 234 567"
                    required
                    type="tel"
                    value={reset.phone}
                  />
                </label>
                <button className="button button-primary" disabled={busy} type="submit">
                  {busy ? 'ĐANG GỬI…' : 'GỬI MÃ OTP'}
                </button>
              </form>
            )}

            {reset.step === 'otp' && (
              <form onSubmit={submitOtp}>
                <p className="reset-copy">
                  Nhập mã gồm 6 chữ số đã gửi tới <strong>{reset.maskedEmail}</strong>.
                  {reset.expiresInSeconds > 0 ? ' Mã có hiệu lực trong khoảng ' + Math.ceil(reset.expiresInSeconds / 60) + ' phút.' : ''}
                </p>
                <label>
                  Mã OTP
                  <input
                    autoComplete="one-time-code"
                    disabled={busy}
                    inputMode="numeric"
                    maxLength="6"
                    onChange={(event) => setReset((current) => ({
                      ...current,
                      otp: digitsOnly(event.target.value).slice(0, 6),
                    }))}
                    placeholder="000000"
                    required
                    value={reset.otp}
                  />
                </label>
                <button className="button button-primary" disabled={busy} type="submit">
                  {busy ? 'ĐANG XÁC THỰC…' : 'XÁC THỰC OTP'}
                </button>
                <div className="button-row reset-actions">
                  <button className="form-link" disabled={busy || reset.resendAfterSeconds > 0} onClick={() => submitPhone(null, true)} type="button">
                    {reset.resendAfterSeconds > 0 ? 'Gửi lại sau ' + reset.resendAfterSeconds + 's' : 'Gửi lại OTP'}
                  </button>
                  <button className="form-link" disabled={busy} onClick={returnToPhoneStep} type="button">
                    Đổi số điện thoại
                  </button>
                </div>
              </form>
            )}

            {reset.step === 'password' && (
              <form onSubmit={submitNewPassword}>
                <label>
                  Mật khẩu mới
                  <input
                    autoComplete="new-password"
                    disabled={busy}
                    minLength="6"
                    onChange={(event) => setReset((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Ít nhất 6 ký tự"
                    required
                    type="password"
                    value={reset.password}
                  />
                </label>
                <label>
                  Xác nhận mật khẩu mới
                  <input
                    autoComplete="new-password"
                    disabled={busy}
                    minLength="6"
                    onChange={(event) => setReset((current) => ({ ...current, confirmation: event.target.value }))}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    type="password"
                    value={reset.confirmation}
                  />
                </label>
                <button className="button button-primary" disabled={busy} type="submit">
                  {busy ? 'ĐANG CẬP NHẬT…' : 'CẬP NHẬT MẬT KHẨU'}
                </button>
              </form>
            )}

            <button className="form-link auth-back" disabled={busy} onClick={() => changeMode('login')} type="button">
              ← Quay lại đăng nhập
            </button>
          </section>
        )}
      </section>
    </main>
  );
}
