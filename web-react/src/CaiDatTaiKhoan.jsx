import { useEffect, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, reload, updatePassword, verifyBeforeUpdateEmail } from 'firebase/auth';
import { auth } from './firebase';
import { api, formatError } from './api';
import { firebaseErrorMessage } from './auth';
import './cai-dat-tai-khoan.css';

const TEN_VAI_TRO = { CUSTOMER: 'Khách hàng', STAFF: 'Nhân viên', VET: 'Bác sĩ thú y', ADMIN: 'Quản trị viên' };

/** Cài đặt chung cho cả bốn vai trò. Mật khẩu chỉ gửi tới Firebase. */
export function CaiDatTaiKhoan({ user, onLogout, onUpdated }) {
  const [hoSo, setHoSo] = useState(user);
  const [lienHe, setLienHe] = useState({ fullName: user?.fullName || '', phone: user?.phone || '' });
  const [matKhau, setMatKhau] = useState({ current: '', next: '', confirm: '' });
  const [emailMoi, setEmailMoi] = useState('');
  const [matKhauEmail, setMatKhauEmail] = useState('');
  const [dangXuLy, setDangXuLy] = useState('');
  const [thongBao, setThongBao] = useState(null);

  useEffect(() => {
    setHoSo(user);
    setLienHe({ fullName: user?.fullName || '', phone: user?.phone || '' });
  }, [user]);

  const capNhat = (thayDoi) => {
    const tiepTheo = { ...hoSo, ...thayDoi };
    setHoSo(tiepTheo);
    onUpdated?.(tiepTheo);
  };
  const xuLy = async (ten, ham) => {
    if (dangXuLy) return;
    setDangXuLy(ten);
    setThongBao(null);
    try {
      const message = await ham();
      setThongBao({ message, error: false });
    } catch (error) {
      setThongBao({ message: error?.code?.startsWith('auth/') ? firebaseErrorMessage(error) : formatError(error), error: true });
    } finally { setDangXuLy(''); }
  };
  const xacThucLai = async (password) => {
    const current = auth.currentUser;
    if (!current?.email) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
    return current;
  };
  const luuLienHe = (event) => {
    event.preventDefault();
    void xuLy('profile', async () => {
      const fullName = lienHe.fullName.trim();
      const phone = lienHe.phone.replace(/[\s().-]/g, '');
      if (!fullName || fullName.length > 100) throw new Error('Họ tên cần từ 1 đến 100 ký tự.');
      if (!/^\+?\d{9,15}$/.test(phone)) throw new Error('Số điện thoại cần từ 9 đến 15 chữ số.');
      await api.put(`/api/UserAccounts/update-profile-by-email/${encodeURIComponent(hoSo.email)}`, { fullName, phone });
      capNhat({ fullName, phone });
      return 'Đã cập nhật thông tin liên hệ.';
    });
  };
  const taiAnh = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void xuLy('avatar', async () => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 6 * 1024 * 1024) throw new Error('Chọn ảnh JPG, PNG hoặc WebP dưới 6 MB.');
      const result = await api.upload('/api/Media/avatar', file);
      capNhat({ avatarUrl: result?.url || hoSo.avatarUrl });
      return 'Đã cập nhật ảnh đại diện.';
    });
  };
  const doiMatKhau = (event) => {
    event.preventDefault();
    void xuLy('password', async () => {
      if (matKhau.next.length < 8) throw new Error('Mật khẩu mới cần ít nhất 8 ký tự.');
      if (matKhau.next !== matKhau.confirm) throw new Error('Hai mật khẩu mới chưa giống nhau.');
      if (matKhau.next === matKhau.current) throw new Error('Mật khẩu mới cần khác mật khẩu hiện tại.');
      const current = await xacThucLai(matKhau.current);
      await updatePassword(current, matKhau.next);
      await current.getIdToken(true);
      setMatKhau({ current: '', next: '', confirm: '' });
      return 'Đã đổi mật khẩu. Lần đăng nhập tiếp theo hãy dùng mật khẩu mới.';
    });
  };
  const guiEmail = (event) => {
    event.preventDefault();
    void xuLy('email', async () => {
      const next = emailMoi.trim();
      if (next.toLowerCase() === hoSo.email.toLowerCase()) throw new Error('Hãy nhập email khác email hiện tại.');
      const current = await xacThucLai(matKhauEmail);
      await verifyBeforeUpdateEmail(current, next);
      setMatKhauEmail('');
      return `Đã gửi liên kết xác nhận tới ${next}. Sau khi mở liên kết trong email, bấm “Đã xác nhận, cập nhật email” bên dưới. Nếu phiên đăng nhập hết hạn, đăng nhập lại bằng email mới.`;
    });
  };
  const dongBoEmail = () => xuLy('sync-email', async () => {
    const current = auth.currentUser;
    if (!current) throw new Error('Vui lòng đăng nhập lại bằng email đã xác nhận.');
    await reload(current);
    await current.getIdToken(true);
    if (!current.emailVerified) throw new Error('Email chưa được xác nhận. Hãy mở liên kết trong email trước.');
    const result = await api.post('/api/UserAccounts/sync-email');
    capNhat({ ...result, email: result?.email || current.email });
    setEmailMoi('');
    return 'Đã đồng bộ email đã xác nhận với tài khoản PetNoVa.';
  });

  return <section className="cai-dat-tai-khoan">
    <header className="page-heading"><div><p className="eyebrow">Tài khoản PetNoVa</p><h1>Thông tin và bảo mật</h1><p>Quản lý thông tin liên hệ, email và mật khẩu của bạn.</p></div></header>
    {thongBao && <p className={`notice${thongBao.error ? ' notice-error' : ''}`} role={thongBao.error ? 'alert' : 'status'}>{thongBao.message}</p>}
    <div className="tai-khoan-grid">
      <aside className="panel profile-summary">
        <span className="avatar avatar-large">{hoSo?.avatarUrl ? <img src={hoSo.avatarUrl} alt="Ảnh đại diện" /> : (hoSo?.fullName || 'P').charAt(0)}</span>
        <h2>{hoSo?.fullName}</h2><p>{hoSo?.email}</p>
        <label className="button button-secondary file-button">{dangXuLy === 'avatar' ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={Boolean(dangXuLy)} onChange={taiAnh} /></label>
        <div className="profile-role"><span>Vai trò</span><strong>{TEN_VAI_TRO[hoSo?.role] || hoSo?.role}</strong></div>
        {onLogout && <button type="button" className="button button-danger" onClick={onLogout} disabled={Boolean(dangXuLy)}>Đăng xuất</button>}
      </aside>
      <div className="tai-khoan-forms">
        <form className="panel form-grid" onSubmit={luuLienHe}><h2>Thông tin liên hệ</h2>
          <label>Họ và tên<input required maxLength={100} autoComplete="name" value={lienHe.fullName} onChange={(e) => setLienHe({ ...lienHe, fullName: e.target.value })} /></label>
          <label>Số điện thoại<input required type="tel" maxLength={20} autoComplete="tel" value={lienHe.phone} onChange={(e) => setLienHe({ ...lienHe, phone: e.target.value })} /></label>
          <button className="button button-primary" disabled={Boolean(dangXuLy)}>{dangXuLy === 'profile' ? 'Đang lưu…' : 'Lưu thông tin'}</button>
        </form>
        <form className="panel form-grid" onSubmit={doiMatKhau}><h2>Đổi mật khẩu</h2>
          <label>Mật khẩu hiện tại<input type="password" required autoComplete="current-password" value={matKhau.current} onChange={(e) => setMatKhau({ ...matKhau, current: e.target.value })} /></label>
          <div className="form-row"><label>Mật khẩu mới<input type="password" required minLength={8} autoComplete="new-password" value={matKhau.next} onChange={(e) => setMatKhau({ ...matKhau, next: e.target.value })} /></label><label>Nhập lại mật khẩu mới<input type="password" required minLength={8} autoComplete="new-password" value={matKhau.confirm} onChange={(e) => setMatKhau({ ...matKhau, confirm: e.target.value })} /></label></div>
          <p className="muted small">Dùng ít nhất 8 ký tự. Mật khẩu chỉ được xử lý bởi hệ thống đăng nhập Firebase.</p>
          <button className="button button-primary" disabled={Boolean(dangXuLy)}>{dangXuLy === 'password' ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</button>
        </form>
        <form className="panel form-grid" onSubmit={guiEmail}><h2>Đổi email đăng nhập</h2><p className="muted small">Email hiện tại: {hoSo?.email}. Email mới chỉ có hiệu lực sau khi bạn xác nhận quyền sở hữu trong hộp thư.</p>
          <label>Email mới<input type="email" required autoComplete="email" value={emailMoi} onChange={(e) => setEmailMoi(e.target.value)} /></label>
          <label>Mật khẩu hiện tại<input type="password" required autoComplete="current-password" value={matKhauEmail} onChange={(e) => setMatKhauEmail(e.target.value)} /></label>
          <div className="button-row"><button className="button button-primary" disabled={Boolean(dangXuLy)}>{dangXuLy === 'email' ? 'Đang gửi…' : 'Gửi email xác nhận'}</button><button type="button" className="button button-secondary" disabled={Boolean(dangXuLy)} onClick={() => void dongBoEmail()}>{dangXuLy === 'sync-email' ? 'Đang kiểm tra…' : 'Đã xác nhận, cập nhật email'}</button></div>
        </form>
      </div>
    </div>
  </section>;
}
