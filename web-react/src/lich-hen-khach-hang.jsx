import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, formatError } from './giao-tiep-api';

const TIEN = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const NGAY = new Intl.DateTimeFormat('vi-VN');
const TRANG_THAI = { PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', FAILED: 'Thất bại', REFUNDED: 'Đã hoàn tiền' };
export const ngayHomNay = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const ngay = (value) => value ? NGAY.format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : '—';
const taoMaYeuCau = () => globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function useKhungGio({ bookingDate, serviceIds, staffId, petId, excludeBookingId }) {
  const [state, setState] = useState({ slots: [], staff: [], durationMinutes: 0, loading: false, error: '' });
  const [lanTai, setLanTai] = useState(0);
  const services = [...serviceIds].sort().join(',');
  useEffect(() => {
    if (!bookingDate || !services || !petId) {
      setState({ slots: [], staff: [], durationMinutes: 0, loading: false, error: '' });
      return undefined;
    }
    const controller = new AbortController();
    let current = true;
    setState((old) => ({ ...old, slots: [], loading: true, error: '' }));
    const query = new URLSearchParams({ date: bookingDate, serviceIds: services, petId });
    if (staffId) query.set('staffId', staffId);
    if (excludeBookingId) query.set('excludeBookingId', excludeBookingId);
    void api.get(`/api/Bookings/availability?${query}`, { signal: controller.signal }).then((data) => {
      if (current) setState({ slots: data?.slots || [], staff: data?.staff || [], durationMinutes: Number(data?.durationMinutes) || 0, loading: false, error: '' });
    }).catch((error) => {
      if (current) setState((old) => ({ ...old, slots: [], loading: false, error: formatError(error) }));
    });
    return () => { current = false; controller.abort(); };
  }, [bookingDate, services, staffId, petId, excludeBookingId, lanTai]);
  return { ...state, taiLai: () => setLanTai((old) => old + 1) };
}

function ChonNgayGio({ form, onChange, khungGio, busy }) {
  const { slots, staff, loading, error, durationMinutes } = khungGio;
  return <>
    <div className="form-row">
      <label>Ngày hẹn<input required type="date" min={ngayHomNay()} value={form.bookingDate} onChange={(e) => onChange({ bookingDate: e.target.value, bookingTime: '' })} disabled={busy} /></label>
      <label>Người chăm sóc<select value={form.staffId || ''} onChange={(e) => onChange({ staffId: e.target.value, bookingTime: '' })} disabled={busy || !form.bookingDate}><option value="">PetNoVa sắp xếp</option>{staff.map((person) => <option key={person.staffId} value={person.staffId}>{person.fullName} · {person.role === 'VET' ? 'Bác sĩ' : 'Nhân viên'}</option>)}</select></label>
    </div>
    <fieldset className="chon-khung-gio" disabled={busy || loading}><legend>Khung giờ còn nhận lịch{durationMinutes > 0 ? ` · dự kiến ${durationMinutes} phút` : ''}</legend>
      {loading ? <p role="status">Đang kiểm tra lịch trống…</p> : error ? <div role="alert"><p className="form-feedback">{error}</p><button type="button" className="button button-secondary button-small" onClick={khungGio.taiLai}>Kiểm tra lại</button></div> : !form.bookingDate ? <p className="muted small">Chọn ngày và dịch vụ để xem giờ trống.</p> : !slots.length ? <p className="muted small">Không có khung giờ phù hợp. Hãy thử ngày khác hoặc chọn dịch vụ.</p> : <div className="khung-gio-grid">{slots.map((slot) => <label key={slot.time} className={`khung-gio${!slot.available ? ' het-cho' : ''}${form.bookingTime === slot.time ? ' da-chon' : ''}`} title={slot.reason || undefined}><input type="radio" name="khung-gio" value={slot.time} checked={form.bookingTime === slot.time} disabled={!slot.available} onChange={() => onChange({ bookingTime: slot.time })} /><span>{slot.time}</span>{!slot.available && <small>Hết chỗ</small>}</label>)}</div>}
    </fieldset>
  </>;
}

/** Một yêu cầu tạo lịch bao gồm cả dịch vụ và thanh toán. */
export function DatLichForm({ pets, services, submitting, onSubmit }) {
  const dichVu = useMemo(() => services.filter((item) => item.status === 'ACTIVE'), [services]);
  const [form, setForm] = useState(() => ({ petId: pets[0]?.petId || '', careTypeId: 'CT001', serviceIds: [], bookingDate: '', bookingTime: '', staffId: '', paymentMethod: 'CASH', note: '', requestId: taoMaYeuCau() }));
  const [loi, setLoi] = useState('');
  const khungGio = useKhungGio(form);
  const tongTien = dichVu.filter((item) => form.serviceIds.includes(item.serviceId)).reduce((sum, item) => sum + Number(item.price || 0), 0);
  const sua = (values) => setForm((old) => ({ ...old, ...values, requestId: taoMaYeuCau() }));
  useEffect(() => {
    setForm((old) => ({ ...old, petId: pets.some((pet) => pet.petId === old.petId) ? old.petId : pets[0]?.petId || '', serviceIds: old.serviceIds.filter((id) => dichVu.some((item) => item.serviceId === id)) }));
  }, [pets, dichVu]);
  const gui = async (event) => {
    event.preventDefault();
    if (!form.petId || !form.serviceIds.length || !form.bookingDate || !form.bookingTime) return setLoi('Hãy chọn thú cưng, ít nhất một dịch vụ và khung giờ.');
    if (new Date(`${form.bookingDate}T${form.bookingTime}`) <= new Date()) return setLoi('Ngày giờ hẹn phải nằm trong tương lai.');
    if (!khungGio.slots.some((slot) => slot.available && slot.time === form.bookingTime)) return setLoi('Khung giờ đã thay đổi. Vui lòng chọn lại.');
    setLoi('');
    const ok = await onSubmit(form);
    if (ok) setForm((old) => ({ ...old, bookingDate: '', bookingTime: '', note: '', requestId: taoMaYeuCau() }));
    else khungGio.taiLai();
  };
  return <form className="panel form-grid dat-lich-form" onSubmit={gui}>
    <div><h2>Tạo cuộc hẹn</h2><p className="muted small">Chọn nhiều dịch vụ cho cùng một bé. Giá và chỗ trống sẽ được kiểm tra lại khi đặt lịch.</p></div>
    {loi && <p className="form-feedback" role="alert">{loi}</p>}
    {!pets.length && <p className="form-feedback">Thêm hồ sơ thú cưng trước khi đặt lịch.</p>}
    <div className="form-row"><label>Thú cưng<select required value={form.petId} onChange={(e) => sua({ petId: e.target.value, bookingTime: '' })} disabled={submitting || !pets.length}><option value="">Chọn thú cưng</option>{pets.map((pet) => <option key={pet.petId} value={pet.petId}>{pet.petName} · {pet.species}</option>)}</select></label><label>Hình thức<select value={form.careTypeId} onChange={(e) => sua({ careTypeId: e.target.value })} disabled={submitting}><option value="CT001">Đến trung tâm</option><option value="CT002">Gửi thú cưng</option></select></label></div>
    <fieldset className="chon-dich-vu" disabled={submitting}><legend>Dịch vụ cần đặt</legend>{dichVu.length ? <div className="dich-vu-grid">{dichVu.map((item) => <label key={item.serviceId} className={`dich-vu-lua-chon${form.serviceIds.includes(item.serviceId) ? ' da-chon' : ''}`}><input type="checkbox" checked={form.serviceIds.includes(item.serviceId)} onChange={(e) => sua({ serviceIds: e.target.checked ? [...form.serviceIds, item.serviceId] : form.serviceIds.filter((id) => id !== item.serviceId), bookingTime: '' })} /><span><strong>{item.serviceName}</strong><small>{item.description}</small><b>{TIEN.format(item.price)} · {item.durationMinutes || item.duration || 30} phút</b></span></label>)}</div> : <p>Hiện chưa có dịch vụ hoạt động.</p>}</fieldset>
    <ChonNgayGio form={form} onChange={sua} khungGio={khungGio} busy={submitting} />
    <label>Thanh toán<select value={form.paymentMethod} disabled={submitting} onChange={(e) => sua({ paymentMethod: e.target.value })}><option value="CASH">Tiền mặt tại quầy</option><option value="BANK_TRANSFER">Chuyển khoản PayOS</option></select></label>
    <label>Ghi chú<textarea maxLength={1000} value={form.note} disabled={submitting} onChange={(e) => sua({ note: e.target.value })} placeholder="Tình trạng cần lưu ý, yêu cầu chăm sóc…" /></label>
    <div className="tong-dat-lich"><span>{form.serviceIds.length} dịch vụ</span><strong>{TIEN.format(tongTien)}</strong></div>
    <button className="button button-primary" disabled={submitting || khungGio.loading || !form.bookingTime || !form.serviceIds.length || !form.petId}>{submitting ? 'Đang tạo lịch…' : 'Xác nhận đặt lịch'}</button>
  </form>;
}

export function DoiLichForm({ booking, details, busy, onSave, onCancel }) {
  const [form, setForm] = useState({ bookingDate: String(booking.bookingDate).slice(0, 10), bookingTime: String(booking.bookingTime).slice(0, 5), staffId: booking.staffId || '', note: booking.note || '' });
  const [loi, setLoi] = useState('');
  const khungGio = useKhungGio({ ...form, petId: booking.petId, serviceIds: details.map((item) => item.serviceId), excludeBookingId: booking.bookingId });
  const submit = async (event) => {
    event.preventDefault();
    if (new Date(`${form.bookingDate}T${form.bookingTime}`) <= new Date() || !khungGio.slots.some((item) => item.available && item.time === form.bookingTime)) return setLoi('Vui lòng chọn khung giờ trống trong tương lai.');
    setLoi('');
    if (!await onSave(form)) khungGio.taiLai();
  };
  return <form className="form-grid doi-lich-form" onSubmit={submit}><h3>Đổi ngày giờ hẹn</h3><p className="muted small">Giữ nguyên dịch vụ và số tiền đã thanh toán. Lịch đã bắt đầu hoặc hoàn tất không thể đổi.</p>{loi && <p className="form-feedback" role="alert">{loi}</p>}<ChonNgayGio form={form} onChange={(values) => setForm((old) => ({ ...old, ...values }))} khungGio={khungGio} busy={busy} /><label>Ghi chú<textarea maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} disabled={busy} /></label><div className="button-row"><button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Giữ lịch cũ</button><button className="button button-primary" disabled={busy || khungGio.loading || !form.bookingTime}>{busy ? 'Đang đổi lịch…' : 'Lưu lịch mới'}</button></div></form>;
}

export function LichSuThanhToan({ payments, bookings, pets, details, serviceById, user, onOpenBooking }) {
  const [trangThai, setTrangThai] = useState('');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [phieu, setPhieu] = useState(null);
  const rows = Object.values(payments).flat().map((payment) => ({ ...payment, booking: bookings.find((item) => item.bookingId === payment.bookingId) })).filter((item) => (!trangThai || item.status === trangThai) && (!tuNgay || String(item.paymentDate || item.booking?.bookingDate || '').slice(0, 10) >= tuNgay) && (!denNgay || String(item.paymentDate || item.booking?.bookingDate || '').slice(0, 10) <= denNgay)).sort((a, b) => String(b.paymentDate || b.booking?.bookingDate).localeCompare(String(a.paymentDate || a.booking?.bookingDate)));
  return <section><header className="page-heading"><div><p className="eyebrow">Giao dịch của bạn</p><h1>Lịch sử thanh toán</h1><p>Tra cứu giao dịch và in phiếu xác nhận thanh toán.</p></div></header>
    <div className="panel form-row bo-loc-thanh-toan"><label>Trạng thái<select value={trangThai} onChange={(e) => setTrangThai(e.target.value)}><option value="">Tất cả</option>{Object.entries(TRANG_THAI).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label><label>Từ ngày<input type="date" value={tuNgay} max={denNgay || undefined} onChange={(e) => setTuNgay(e.target.value)} /></label><label>Đến ngày<input type="date" value={denNgay} min={tuNgay || undefined} onChange={(e) => setDenNgay(e.target.value)} /></label></div>
    <div className="panel data-table-wrap"><table className="data-table"><caption className="chi-doc-man-hinh">Các giao dịch thanh toán của bạn</caption><thead><tr><th>Mã giao dịch</th><th>Lịch hẹn</th><th>Ngày thanh toán</th><th>Phương thức</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map((payment) => <tr key={payment.paymentId}><td>{payment.paymentId}</td><td><button className="button button-ghost button-small" onClick={() => onOpenBooking(payment.bookingId)}>{payment.bookingId}</button></td><td>{ngay(payment.paymentDate)}</td><td>{payment.method === 'CASH' ? 'Tiền mặt' : 'PayOS'}</td><td>{TIEN.format(payment.amount)}</td><td><span className={`badge ${payment.status.toLowerCase()}`}>{TRANG_THAI[payment.status] || payment.status}</span></td><td>{['PAID', 'REFUNDED'].includes(payment.status) ? <button className="button button-secondary button-small" onClick={() => setPhieu(payment)}>Xem phiếu</button> : <button className="button button-secondary button-small" onClick={() => onOpenBooking(payment.bookingId)}>Xử lý</button>}</td></tr>)}</tbody></table>{!rows.length && <p className="empty-state">Không có giao dịch phù hợp.</p>}</div>
    {phieu && <PhieuThanhToan payment={phieu} booking={phieu.booking} pet={pets.find((pet) => pet.petId === phieu.booking?.petId)} details={details[phieu.bookingId] || []} serviceById={serviceById} user={user} onClose={() => setPhieu(null)} />}
  </section>;
}

function PhieuThanhToan({ payment, booking, pet, details, serviceById, user, onClose }) {
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape') onClose(); };
    document.body.classList.add('dang-xem-phieu');
    window.addEventListener('keydown', key);
    return () => { document.body.classList.remove('dang-xem-phieu'); window.removeEventListener('keydown', key); };
  }, [onClose]);
  return createPortal(<div className="modal-backdrop phieu-backdrop"><section className="modal phieu-thanh-toan" role="dialog" aria-modal="true" aria-label="Phiếu xác nhận thanh toán"><div className="modal-heading khong-in"><h2>Chi tiết phiếu</h2><button type="button" className="close-button" aria-label="Đóng phiếu" onClick={onClose}>×</button></div><div className="ban-in-phieu"><p className="eyebrow">PetNoVa</p><h2>PHIẾU XÁC NHẬN THANH TOÁN</h2><p>Mã giao dịch: <strong>{payment.paymentId}</strong> · {TRANG_THAI[payment.status]}</p><dl className="phieu-thong-tin"><div><dt>Khách hàng</dt><dd>{user.fullName}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Thú cưng</dt><dd>{pet?.petName || booking?.petId || '—'}</dd></div><div><dt>Lịch hẹn</dt><dd>{payment.bookingId} · {ngay(booking?.bookingDate)} {String(booking?.bookingTime || '').slice(0, 5)}</dd></div><div><dt>Ngày thanh toán</dt><dd>{ngay(payment.paymentDate)}</dd></div><div><dt>Phương thức</dt><dd>{payment.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản PayOS'}</dd></div></dl><table className="data-table"><thead><tr><th>Dịch vụ</th><th>Số lượng</th><th>Thành tiền</th></tr></thead><tbody>{details.map((item) => <tr key={item.detailId}><td>{serviceById[item.serviceId]?.serviceName || item.serviceId}</td><td>{item.quantity}</td><td>{TIEN.format(Number(item.price) * Number(item.quantity || 1))}</td></tr>)}</tbody></table><p className="tong-dat-lich"><span>Số tiền giao dịch</span><strong>{TIEN.format(payment.amount)}</strong></p>{payment.status === 'REFUNDED' && <p>Đã hoàn tiền {ngay(payment.refundedAt)}. {payment.refundReason}{payment.refundReference ? ` · Tham chiếu: ${payment.refundReference}` : ''}</p>}<p className="muted small">Phiếu xác nhận giao dịch tại PetNoVa, không thay thế hóa đơn thuế.</p></div><div className="button-row khong-in"><button type="button" className="button button-secondary" onClick={onClose}>Đóng</button><button type="button" className="button button-primary" onClick={() => window.print()}>In / Lưu PDF</button></div></section></div>, document.body);
}

export function NhacNhoTrinhDuyet({ userId, notifications, onOpen }) {
  const key = `petnova-nhac-nho-${userId}`;
  const supported = typeof Notification !== 'undefined' && globalThis.isSecureContext;
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem(key) === 'on'; } catch { return false; } });
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!enabled || !supported || Notification.permission !== 'granted') return;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(`${key}-seen`) || '[]'); } catch { /* Bộ nhớ trình duyệt có thể bị chặn. */ }
    if (!Array.isArray(seen)) seen = [];
    const fresh = notifications.filter((item) => !item.isRead && !seen.includes(item.notificationId));
    fresh.slice(0, 3).forEach((item) => {
      try {
        const toast = new Notification(item.title || 'PetNoVa', { body: item.message || '', tag: item.notificationId });
        toast.onclick = () => { window.focus(); onOpen(item); toast.close(); };
      } catch { /* Một số trình duyệt di động chỉ cho phép Service Worker. */ }
    });
    try { localStorage.setItem(`${key}-seen`, JSON.stringify([...new Set([...seen, ...fresh.map((item) => item.notificationId)])].slice(-250))); } catch { /* Không ảnh hưởng hộp thư trong website. */ }
  }, [enabled, key, notifications, onOpen, supported]);
  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      try { localStorage.setItem(key, 'off'); } catch { /* Không bắt buộc lưu tùy chọn. */ }
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setMessage('Thông báo đang bị chặn. Bạn có thể cấp quyền trong cài đặt trang của trình duyệt.');
      setEnabled(true);
      try { localStorage.setItem(key, 'on'); } catch { /* Tùy chọn vẫn có hiệu lực trong phiên. */ }
      setMessage('Đã bật nhắc lịch khi website đang mở.');
    } catch { setMessage('Trình duyệt này chưa hỗ trợ thông báo. Bạn vẫn nhận được thông báo trong website.'); }
  };
  return <div className="panel nhac-nho-trinh-duyet"><div><strong>Nhắc lịch trên trình duyệt</strong><p className="muted small">Thông báo lịch hẹn và tiêm chủng khi website đang mở. Bạn vẫn xem được tất cả trong hộp thư khi đóng trình duyệt.</p>{message && <p role="status">{message}</p>}</div><button type="button" className="button button-secondary" disabled={!supported} onClick={() => void toggle()}>{!supported ? 'Trình duyệt chưa hỗ trợ' : enabled ? 'Tắt nhắc lịch' : 'Bật nhắc lịch'}</button></div>;
}
