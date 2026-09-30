import { useEffect, useState } from 'react';
import { api, formatError } from './giao-tiep-api';

const TIEN = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const homNay = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const ngayDau = () => `${homNay().slice(0, 7)}-01`;

function taiCsv(ten, tieuDe, rows) {
  const escape = (value) => {
    const text = String(value ?? '');
    const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const body = [tieuDe, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = ten; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function DanhMuc({ onChanged }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({ categoryName: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => { try { setItems(await api.get('/api/ServiceCategories')); } catch (e) { setMessage(formatError(e)); } };
  useEffect(() => { void load(); }, []);
  const create = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await api.post('/api/ServiceCategories', draft); setDraft({ categoryName: '', description: '' }); await load(); onChanged?.(); setMessage('Đã thêm danh mục.'); }
    catch (e) { setMessage(formatError(e)); } finally { setBusy(false); }
  };
  const edit = async (item) => {
    const categoryName = window.prompt('Tên danh mục', item.categoryName);
    if (categoryName === null) return;
    const description = window.prompt('Mô tả', item.description || '');
    if (description === null) return;
    setBusy(true);
    try { await api.put(`/api/ServiceCategories/${encodeURIComponent(item.categoryId)}`, { ...item, categoryName: categoryName.trim(), description: description.trim() }); await load(); onChanged?.(); setMessage('Đã cập nhật danh mục.'); }
    catch (e) { setMessage(formatError(e)); } finally { setBusy(false); }
  };
  const toggle = async (item) => {
    setBusy(true);
    try { await api.put(`/api/ServiceCategories/${encodeURIComponent(item.categoryId)}`, { ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }); await load(); onChanged?.(); setMessage('Đã đổi trạng thái danh mục.'); }
    catch (e) { setMessage(formatError(e)); } finally { setBusy(false); }
  };
  return <section><header className="page-heading"><div><h1>Danh mục dịch vụ</h1><p>Nhóm các gói Spa, Y tế, Lưu trú và các dịch vụ mới.</p></div></header>{message && <p className="notice" role="status">{message}</p>}
    <form className="panel form-grid" onSubmit={create}><h2>Thêm danh mục</h2><div className="form-row"><label>Tên danh mục<input required maxLength={50} value={draft.categoryName} onChange={(e) => setDraft({ ...draft, categoryName: e.target.value })} /></label><label>Mô tả<input maxLength={255} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label></div><button className="button button-primary" disabled={busy}>Thêm danh mục</button></form>
    <div className="panel data-table-wrap"><table className="data-table"><thead><tr><th>Mã</th><th>Tên</th><th>Mô tả</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.map((item) => <tr key={item.categoryId}><td>{item.categoryId}</td><td><strong>{item.categoryName}</strong></td><td>{item.description || '—'}</td><td>{item.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}</td><td><div className="action-buttons"><button className="button button-secondary button-small" disabled={busy} onClick={() => edit(item)}>Sửa</button><button className="button button-secondary button-small" disabled={busy} onClick={() => toggle(item)}>{item.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</button></div></td></tr>)}</tbody></table></div>
  </section>;
}

function BaoCao() {
  const [dates, setDates] = useState({ from: ngayDau(), to: homNay() });
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const load = async () => { try { setData(await api.get(`/api/Reports?from=${dates.from}&to=${dates.to}`)); setMessage(''); } catch (e) { setMessage(formatError(e)); } };
  useEffect(() => { void load(); }, []);
  const rows = data?.byDay || [];
  return <section><header className="page-heading"><div><h1>Báo cáo vận hành</h1><p>Xem số lịch, số tiền thu và dịch vụ theo khoảng ngày.</p></div></header>
    <form className="panel form-row bo-loc-bao-cao" onSubmit={(e) => { e.preventDefault(); void load(); }}><label>Từ ngày<input type="date" required value={dates.from} max={dates.to} onChange={(e) => setDates({ ...dates, from: e.target.value })} /></label><label>Đến ngày<input type="date" required value={dates.to} min={dates.from} onChange={(e) => setDates({ ...dates, to: e.target.value })} /></label><button className="button button-primary">Xem báo cáo</button></form>
    {message && <p className="form-feedback" role="alert">{message}</p>}
    {data && <><div className="dashboard-grid"><article className="card stat-card"><span className="stat-label">Lịch hẹn</span><strong className="stat-number">{data.bookings}</strong></article><article className="card stat-card"><span className="stat-label">Hoàn thành</span><strong className="stat-number">{data.completed}</strong></article><article className="card stat-card"><span className="stat-label">Đã thu</span><strong className="stat-number">{TIEN.format(data.paidAmount)}</strong></article><article className="card stat-card"><span className="stat-label">Hoàn tiền</span><strong className="stat-number">{TIEN.format(data.refundAmount)}</strong></article></div><p className="muted small">Số tiền ghi nhận theo ngày giao dịch; hoàn tiền chỉ tính khi có chứng từ đã thực hiện.</p>
      <div className="panel"><div className="panel-heading"><h2>Lịch theo ngày</h2><button className="button button-secondary button-small" onClick={() => taiCsv(`petnova-bao-cao-${data.from}-${data.to}.csv`, ['Ngày', 'Số lịch', 'Hoàn thành', 'Giá trị đặt'], rows.map((r) => [r.date, r.bookings, r.completed, r.bookedAmount]))}>Xuất CSV cho Excel</button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Ngày</th><th>Số lịch</th><th>Hoàn thành</th><th>Giá trị đặt</th></tr></thead><tbody>{rows.map((r) => <tr key={r.date}><td>{r.date}</td><td>{r.bookings}</td><td>{r.completed}</td><td>{TIEN.format(r.bookedAmount)}</td></tr>)}</tbody></table></div></div>
      <div className="panel"><h2>Dịch vụ được đặt</h2><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Dịch vụ</th><th>Số lượng</th><th>Giá trị đặt</th></tr></thead><tbody>{(data.byService || []).map((item) => <tr key={item.serviceId}><td>{item.serviceName}</td><td>{item.quantity}</td><td>{TIEN.format(item.bookedAmount)}</td></tr>)}</tbody></table></div></div></>}
  </section>;
}

function HeThong() {
  const [logs, setLogs] = useState([]);
  const [draft, setDraft] = useState({ title: '', message: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { try { setLogs(await api.get('/api/AuditLogs')); } catch (e) { setMessage(formatError(e)); } };
  useEffect(() => { void load(); }, []);
  const broadcast = async (event) => {
    event.preventDefault();
    if (!window.confirm('Gửi thông báo này cho tất cả tài khoản đang hoạt động?')) return;
    setBusy(true);
    try { const result = await api.post('/api/Notifications/broadcast', draft); setDraft({ title: '', message: '' }); setMessage(`Đã gửi ${result.sent} thông báo.`); await load(); }
    catch (e) { setMessage(formatError(e)); } finally { setBusy(false); }
  };
  return <section><header className="page-heading"><div><h1>Thông báo và nhật ký</h1><p>Gửi tin chung và xem thao tác quản trị gần đây.</p></div></header>{message && <p className="notice" role="status">{message}</p>}
    <form className="panel form-grid" onSubmit={broadcast}><h2>Gửi thông báo chung</h2><label>Tiêu đề<input required maxLength={100} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><label>Nội dung<textarea required maxLength={255} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} /></label><button className="button button-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi cho tất cả'}</button></form>
    <div className="panel"><div className="panel-heading"><h2>100 thao tác gần đây</h2><button onClick={() => void load()}>Tải lại</button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Vai trò</th><th>Thao tác</th><th>Đối tượng</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString('vi-VN')}</td><td>{log.actorName}</td><td>{log.role}</td><td>{log.action}</td><td>{log.targetId || '—'}</td></tr>)}</tbody></table></div></div>
  </section>;
}

export function DanhMucVaBaoCao({ mode, onChanged }) {
  if (mode === 'categories') return <DanhMuc onChanged={onChanged} />;
  if (mode === 'reports') return <BaoCao />;
  return <HeThong />;
}
