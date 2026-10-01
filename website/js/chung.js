export function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function ngay(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? h(value) : date.toLocaleDateString('vi-VN');
}
export const gio = (value) => String(value || '').slice(0, 5) || '—';
export const tien = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
export const homNay = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const maYeuCau = () => crypto.randomUUID?.() || `web-${Date.now()}`;
export const id = (value) => encodeURIComponent(String(value ?? ''));

const bookingNames = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', IN_PROGRESS: 'Đang chăm sóc', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };
const paymentNames = { PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', FAILED: 'Thất bại', EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy', REFUNDED: 'Đã hoàn tiền' };
export const tenLich = (value) => bookingNames[value] || value || '—';
export const tenTien = (value) => paymentNames[value] || value || '—';
export const nhan = (value, type = 'booking') => `<span class="nhan nhan-${h(String(value || '').toLowerCase())}">${h(type === 'payment' ? tenTien(value) : tenLich(value))}</span>`;

export function thongBao(text, error = false) {
  const target = document.querySelector('#thong-bao');
  if (!target) return;
  target.textContent = text;
  target.className = error ? 'thong-bao loi' : 'thong-bao';
  target.hidden = !text;
  if (text) { clearTimeout(thongBao.timer); thongBao.timer = setTimeout(() => { target.hidden = true; }, 7000); }
}

export async function thaoTac(button, action, success) {
  if (button) button.disabled = true;
  try { await action(); if (success) thongBao(success); return true; }
  catch (error) { thongBao(error.message || 'Không thể hoàn tất thao tác.', true); return false; }
  finally { if (button) button.disabled = false; }
}

export function chuyenTrang(page) {
  const pages = [...document.querySelectorAll('[data-page]')];
  if (!pages.some((section) => section.dataset.page === page)) page = pages[0]?.dataset.page;
  pages.forEach((section) => { section.hidden = section.dataset.page !== page; });
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === page;
    button.classList.toggle('dang-chon', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  location.hash = page || '';
  window.scrollTo({ top: 0, behavior: 'auto' });
  document.dispatchEvent(new CustomEvent('petnova:trang', { detail: page }));
}

export function batDieuHuong() {
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => chuyenTrang(button.dataset.tab)));
  chuyenTrang(location.hash.slice(1).split('?')[0] || document.querySelector('[data-page]')?.dataset.page);
}

export function luaChon(items, selected = '', label = (item) => item.name, value = (item) => item.id) {
  return items.map((item) => `<option value="${h(value(item))}" ${String(value(item)) === String(selected) ? 'selected' : ''}>${h(label(item))}</option>`).join('');
}

export async function taiTatCaLich(api) {
  const all = [];
  for (let page = 1; page <= 500; page += 1) {
    const part = await api.get(`/api/Bookings?page=${page}`);
    all.push(...part);
    if (part.length < 200) return all;
  }
  throw new Error('Có quá nhiều lịch để tải. Vui lòng lọc theo ngày hoặc dùng báo cáo.');
}
