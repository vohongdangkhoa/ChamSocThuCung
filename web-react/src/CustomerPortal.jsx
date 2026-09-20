import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatError } from './api';

const CARE_TYPES = {
  CT001: 'Đến trung tâm',
  CT002: 'Gửi thú cưng',
};

const NAV_ITEMS = [
  ['overview', '⌂', 'Tổng quan'],
  ['pets', '♧', 'Thú cưng'],
  ['bookings', '◷', 'Đặt lịch'],
  ['health', '✚', 'Hồ sơ sức khỏe'],
  ['notifications', '♢', 'Thông báo'],
  ['profile', '◉', 'Tài khoản'],
];

const STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  PAID: 'Đã thanh toán',
  FAILED: 'Không thành công',
  REFUNDED: 'Đã hoàn tiền',
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngưng hoạt động',
};

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const longDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function itemId(item, field) {
  return String(item?.[field] ?? item?.id ?? '');
}

function readDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(`${value.slice(0, 10)}T12:00:00`);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value, fallback = 'Chưa cập nhật') {
  const date = readDate(value);
  return date ? dateFormatter.format(date) : fallback;
}

function formatLongDate(value) {
  const date = readDate(value);
  return date ? longDateFormatter.format(date) : 'Chưa chọn ngày';
}

function dateInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function todayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatTime(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'Chưa chọn giờ';
  const match = text.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : text;
}

function formatMoney(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function statusText(status) {
  const normalized = String(status || '').trim().toUpperCase();
  return STATUS_LABELS[normalized] || normalized || 'Chưa cập nhật';
}

function statusClass(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'IN_PROGRESS') return 'progress';
  return normalized.toLowerCase();
}

function errorText(error, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  try {
    const message = formatError(error);
    if (message) return message;
  } catch {
    // The fallback below also covers API helpers that surface native errors.
  }
  return error?.message || fallback;
}

function isCancellable(booking) {
  const status = String(booking?.status || '').toUpperCase();
  return status === 'PENDING' || status === 'CONFIRMED';
}

function isOpenBooking(booking) {
  const status = String(booking?.status || '').toUpperCase();
  return !['CANCELLED', 'COMPLETED'].includes(status);
}

function isUpcoming(booking) {
  if (!isOpenBooking(booking)) return false;
  const date = readDate(booking?.bookingDate);
  if (!date) return false;
  const today = readDate(todayInputValue());
  return date >= today;
}

function Avatar({ user, size = 'normal' }) {
  const name = String(user?.fullName || user?.email || 'P').trim();
  const initial = name.charAt(0).toLocaleUpperCase('vi-VN') || 'P';
  const avatarUrl = user?.avatarUrl;
  const className = size === 'large' ? 'avatar avatar-large' : 'avatar';
  return (
    <span className={className} aria-label={`Ảnh đại diện của ${name}`}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : initial}
    </span>
  );
}

function PetImage({ pet, compact = false }) {
  const name = String(pet?.petName || pet?.name || 'Thú cưng');
  return (
    <div className={compact ? 'pet-image pet-image-compact' : 'pet-card-image'}>
      {pet?.imageUrl ? <img src={pet.imageUrl} alt={`Ảnh của ${name}`} /> : <span aria-hidden="true">🐾</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`badge ${statusClass(status)}`}>{statusText(status)}</span>;
}

function EmptyState({ icon = '✦', children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <p>{children}</p>
      {action}
    </div>
  );
}

function LoadingBlock({ label = 'Đang tải dữ liệu…' }) {
  return <div className="empty-state" aria-live="polite"><span className="empty-icon">⋯</span><p>{label}</p></div>;
}

function PageHeading({ eyebrow, title, description, actions }) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="toolbar-group">{actions}</div>}
    </header>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Đóng cửa sổ">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function DetailGrid({ children }) {
  return <div className="detail-grid">{children}</div>;
}

function DetailItem({ label, children }) {
  return <div className="detail-item"><span>{label}</span><strong>{children || '—'}</strong></div>;
}

/** Customer home, appointments, pets, health history, notifications and profile. */
export function CustomerPortal({ user, onLogout }) {
  const [customer, setCustomer] = useState(user);
  const [activeView, setActiveView] = useState('overview');
  const [pets, setPets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [bookingDetails, setBookingDetails] = useState({});
  const [payments, setPayments] = useState({});
  const [selectedPetId, setSelectedPetId] = useState('');
  const [healthRecords, setHealthRecords] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [toast, setToast] = useState(null);
  const [petModal, setPetModal] = useState(null);
  const [bookingDetailId, setBookingDetailId] = useState('');

  const userId = String(customer?.userId || '');

  useEffect(() => setCustomer(user), [user]);

  const petById = useMemo(() => Object.fromEntries(pets.map((pet) => [itemId(pet, 'petId'), pet])), [pets]);
  const serviceById = useMemo(() => Object.fromEntries(services.map((service) => [itemId(service, 'serviceId'), service])), [services]);
  const unpaidCount = useMemo(
    () => Object.values(payments).flat().filter((payment) => String(payment.status).toUpperCase() === 'PENDING').length,
    [payments],
  );
  const unreadCount = useMemo(() => notifications.filter((notice) => !notice.isRead).length, [notifications]);
  const activeBooking = useMemo(
    () => bookings.find((booking) => itemId(booking, 'bookingId') === bookingDetailId) || null,
    [bookings, bookingDetailId],
  );

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const loadBookingExtras = useCallback(async (bookingList) => {
    const settled = await Promise.allSettled(list(bookingList).map(async (booking) => {
      const bookingId = itemId(booking, 'bookingId');
      const [detailsResult, paymentsResult] = await Promise.allSettled([
        api.get(`/api/BookingDetails/booking/${encodeURIComponent(bookingId)}`),
        api.get(`/api/Payments/booking/${encodeURIComponent(bookingId)}`),
      ]);
      return {
        bookingId,
        details: detailsResult.status === 'fulfilled' ? list(detailsResult.value) : [],
        payments: paymentsResult.status === 'fulfilled' ? list(paymentsResult.value) : [],
      };
    }));

    const nextDetails = {};
    const nextPayments = {};
    settled.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      nextDetails[result.value.bookingId] = result.value.details;
      nextPayments[result.value.bookingId] = result.value.payments;
    });
    setBookingDetails(nextDetails);
    setPayments(nextPayments);
  }, []);

  const refreshData = useCallback(async ({ quiet = false } = {}) => {
    if (!userId) return;
    if (!quiet) setIsLoading(true);
    setPageError('');
    try {
      const [petData, bookingData, serviceData, notificationData] = await Promise.all([
        api.get(`/api/Pets/user/${encodeURIComponent(userId)}`),
        api.get(`/api/Bookings/user/${encodeURIComponent(userId)}`),
        api.get('/api/ServicePackages'),
        api.get(`/api/Notifications/user/${encodeURIComponent(userId)}`),
      ]);
      const nextPets = list(petData);
      const nextBookings = list(bookingData);
      setPets(nextPets);
      setBookings(nextBookings);
      setServices(list(serviceData));
      setNotifications(list(notificationData));
      setSelectedPetId((current) => nextPets.some((pet) => itemId(pet, 'petId') === current)
        ? current
        : itemId(nextPets[0], 'petId'));
      await loadBookingExtras(nextBookings);
    } catch (error) {
      setPageError(errorText(error, 'Không thể tải dữ liệu của bạn.'));
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [loadBookingExtras, userId]);

  const loadHealthData = useCallback(async (petId) => {
    if (!petId) {
      setHealthRecords([]);
      setVaccinations([]);
      return;
    }
    setHealthLoading(true);
    try {
      const [recordData, vaccinationData] = await Promise.all([
        api.get(`/api/MedicalRecords/pet/${encodeURIComponent(petId)}`),
        api.get(`/api/Vaccinations/pet/${encodeURIComponent(petId)}`),
      ]);
      setHealthRecords(list(recordData));
      setVaccinations(list(vaccinationData));
    } catch (error) {
      notify(errorText(error, 'Không thể tải hồ sơ sức khỏe.'), 'error');
      setHealthRecords([]);
      setVaccinations([]);
    } finally {
      setHealthLoading(false);
    }
  }, [notify]);

  useEffect(() => { void refreshData(); }, [refreshData]);
  useEffect(() => {
    if (activeView === 'health') void loadHealthData(selectedPetId);
  }, [activeView, loadHealthData, selectedPetId]);

  const navigate = useCallback((view) => {
    setActiveView(view);
    if (view === 'health' && selectedPetId) void loadHealthData(selectedPetId);
  }, [loadHealthData, selectedPetId]);

  const savePet = useCallback(async ({ pet, values, file }) => {
    const payload = {
      petId: pet ? itemId(pet, 'petId') : '',
      userId,
      petName: values.petName.trim(),
      species: values.species.trim(),
      breed: values.breed.trim(),
      gender: values.gender,
      birthDate: `${values.birthDate}T00:00:00`,
      weight: Number(values.weight),
      healthStatus: values.healthStatus.trim(),
    };
    setActionBusy('pet');
    try {
      let savedPet;
      if (pet) {
        await api.put(`/api/Pets/${encodeURIComponent(payload.petId)}`, payload);
        savedPet = { ...pet, ...payload };
      } else {
        savedPet = await api.post('/api/Pets', payload);
      }
      const savedPetId = itemId(savedPet, 'petId');
      if (file && savedPetId) {
        await api.upload(`/api/Media/pets/${encodeURIComponent(savedPetId)}`, file);
      }
      setPetModal(null);
      await refreshData({ quiet: true });
      setSelectedPetId(savedPetId || selectedPetId);
      notify(file ? 'Đã lưu hồ sơ và cập nhật ảnh thú cưng.' : 'Đã lưu hồ sơ thú cưng.');
      return true;
    } catch (error) {
      notify(errorText(error, 'Không thể lưu hồ sơ thú cưng.'), 'error');
      return false;
    } finally {
      setActionBusy('');
    }
  }, [notify, refreshData, selectedPetId, userId]);

  const createBooking = useCallback(async (form) => {
    const service = serviceById[form.serviceId];
    if (!service) {
      notify('Gói dịch vụ không còn khả dụng. Vui lòng chọn lại.', 'error');
      return false;
    }
    setActionBusy('booking');
    let createdBooking = null;
    try {
      createdBooking = await api.post('/api/Bookings', {
        bookingId: '',
        bookingDate: `${form.bookingDate}T00:00:00`,
        bookingTime: `${formatTime(form.bookingTime)}:00`,
        totalAmount: Number(service.price) || 0,
        status: 'PENDING',
        note: form.note.trim(),
        userId,
        petId: form.petId,
        staffId: null,
        careTypeId: form.careTypeId,
        createdAt: new Date().toISOString(),
      });
      const bookingId = itemId(createdBooking, 'bookingId');
      await api.post('/api/BookingDetails', {
        detailId: '',
        quantity: 1,
        price: Number(service.price) || 0,
        bookingId,
        serviceId: itemId(service, 'serviceId'),
      });
      await api.post('/api/Payments', {
        paymentId: '',
        method: form.paymentMethod,
        amount: Number(service.price) || 0,
        status: 'PENDING',
        paymentDate: null,
        bookingId,
      });
      await refreshData({ quiet: true });
      setBookingDetailId(bookingId);
      notify(form.paymentMethod === 'BANK_TRANSFER'
        ? 'Đặt lịch thành công. Bạn có thể thanh toán qua PayOS ngay bây giờ.'
        : 'Đặt lịch thành công. Vui lòng thanh toán tiền mặt tại quầy.');
      return true;
    } catch (error) {
      const partial = createdBooking
        ? 'Lịch hẹn đã được tạo nhưng chưa hoàn tất dữ liệu thanh toán. Vui lòng liên hệ PetNoVa.'
        : 'Không thể tạo lịch hẹn.';
      notify(errorText(error, partial), 'error');
      return false;
    } finally {
      setActionBusy('');
    }
  }, [notify, refreshData, serviceById, userId]);

  const cancelBooking = useCallback(async (booking) => {
    const bookingId = itemId(booking, 'bookingId');
    if (!isCancellable(booking)) {
      notify('Lịch này không còn có thể hủy.', 'error');
      return;
    }
    if (!window.confirm('Bạn có chắc muốn hủy lịch hẹn này không?')) return;
    setActionBusy(`cancel-${bookingId}`);
    try {
      await api.put(`/api/Bookings/${encodeURIComponent(bookingId)}/cancel`);
      await refreshData({ quiet: true });
      notify('Lịch hẹn đã được hủy.');
    } catch (error) {
      notify(errorText(error, 'Không thể hủy lịch hẹn.'), 'error');
    } finally {
      setActionBusy('');
    }
  }, [notify, refreshData]);

  const syncPayOS = useCallback(async (payment) => {
    const paymentId = itemId(payment, 'paymentId');
    setActionBusy(`sync-${paymentId}`);
    try {
      const updated = await api.post(`/api/Payments/${encodeURIComponent(paymentId)}/payos-sync`);
      setPayments((current) => Object.fromEntries(Object.entries(current).map(([bookingId, rows]) => [
        bookingId,
        rows.map((row) => itemId(row, 'paymentId') === paymentId ? updated : row),
      ])));
      notify(String(updated?.status).toUpperCase() === 'PAID'
        ? 'PayOS đã ghi nhận thanh toán thành công.'
        : `Trạng thái thanh toán: ${statusText(updated?.status)}.`);
      return updated;
    } catch (error) {
      notify(errorText(error, 'Không thể kiểm tra PayOS.'), 'error');
      return null;
    } finally {
      setActionBusy('');
    }
  }, [notify]);

  const markNotificationRead = useCallback(async (notice) => {
    if (notice.isRead) return;
    const notificationId = itemId(notice, 'notificationId');
    try {
      await api.put(`/api/Notifications/${encodeURIComponent(notificationId)}/read`);
      setNotifications((items) => items.map((item) => itemId(item, 'notificationId') === notificationId ? { ...item, isRead: true } : item));
    } catch (error) {
      notify(errorText(error, 'Không thể cập nhật thông báo.'), 'error');
    }
  }, [notify]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!unreadCount) return;
    setActionBusy('notifications');
    try {
      await api.put(`/api/Notifications/user/${encodeURIComponent(userId)}/read-all`);
      setNotifications((items) => items.map((notice) => ({ ...notice, isRead: true })));
      notify('Đã đánh dấu tất cả thông báo là đã đọc.');
    } catch (error) {
      notify(errorText(error, 'Không thể cập nhật thông báo.'), 'error');
    } finally {
      setActionBusy('');
    }
  }, [notify, unreadCount, userId]);

  const saveProfile = useCallback(async ({ fullName, phone }) => {
    setActionBusy('profile');
    try {
      await api.put(`/api/UserAccounts/update-profile-by-email/${encodeURIComponent(customer.email)}`, {
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
      setCustomer((current) => ({ ...current, fullName: fullName.trim(), phone: phone.trim() }));
      notify('Đã cập nhật thông tin tài khoản.');
      return true;
    } catch (error) {
      notify(errorText(error, 'Không thể cập nhật tài khoản.'), 'error');
      return false;
    } finally {
      setActionBusy('');
    }
  }, [customer.email, notify]);

  const uploadAvatar = useCallback(async (file) => {
    if (!file) return false;
    setActionBusy('avatar');
    try {
      const result = await api.upload('/api/Media/avatar', file);
      setCustomer((current) => ({ ...current, avatarUrl: result?.url || current.avatarUrl }));
      notify('Đã cập nhật ảnh đại diện.');
      return true;
    } catch (error) {
      notify(errorText(error, 'Không thể tải ảnh đại diện.'), 'error');
      return false;
    } finally {
      setActionBusy('');
    }
  }, [notify]);

  const openNotification = useCallback(async (notice) => {
    await markNotificationRead(notice);
    if (String(notice.relatedType || '').toUpperCase() === 'BOOKING' && notice.relatedId) {
      setBookingDetailId(String(notice.relatedId));
    }
  }, [markNotificationRead]);

  const content = (() => {
    if (isLoading) return <LoadingBlock />;
    if (pageError) return (
      <div className="panel"><EmptyState icon="!" action={<button className="button button-primary" onClick={() => void refreshData()}>Tải lại</button>}>{pageError}</EmptyState></div>
    );
    switch (activeView) {
      case 'pets':
        return <PetsPage pets={pets} onAdd={() => setPetModal({ pet: null })} onEdit={(pet) => setPetModal({ pet })} onViewHealth={(pet) => { setSelectedPetId(itemId(pet, 'petId')); navigate('health'); }} />;
      case 'bookings':
        return <BookingsPage
          pets={pets}
          bookings={bookings}
          services={services}
          details={bookingDetails}
          payments={payments}
          petById={petById}
          serviceById={serviceById}
          submitting={actionBusy === 'booking'}
          onSubmit={createBooking}
          onOpenBooking={setBookingDetailId}
          onCancel={cancelBooking}
          busyId={actionBusy}
        />;
      case 'health':
        return <HealthPage pets={pets} selectedPetId={selectedPetId} onSelectPet={setSelectedPetId} records={healthRecords} vaccinations={vaccinations} loading={healthLoading} />;
      case 'notifications':
        return <NotificationsPage notifications={notifications} unreadCount={unreadCount} onOpen={openNotification} onMarkAll={markAllNotificationsRead} busy={actionBusy === 'notifications'} />;
      case 'profile':
        return <ProfilePage user={customer} busy={actionBusy} onSave={saveProfile} onUploadAvatar={uploadAvatar} onLogout={onLogout} />;
      case 'overview':
      default:
        return <OverviewPage
          customer={customer}
          pets={pets}
          bookings={bookings}
          payments={payments}
          notifications={notifications}
          petById={petById}
          onNavigate={navigate}
          onOpenBooking={setBookingDetailId}
        />;
    }
  })();

  return (
    <div className="portal customer-portal">
      <aside className="sidebar customer-sidebar">
        <div className="sidebar-brand"><span className="brand-mark">✦</span><span>PetNoVa</span></div>
        <nav aria-label="Điều hướng khách hàng">
          <ul className="nav-list">
            {NAV_ITEMS.map(([view, icon, label]) => (
              <li key={view}>
                <button type="button" className={`nav-button${activeView === view ? ' active' : ''}`} onClick={() => navigate(view)}>
                  <span className="nav-icon" aria-hidden="true">{icon}</span>{label}
                  {view === 'notifications' && unreadCount > 0 && <span className="nav-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="user-mini"><Avatar user={customer} /><div><strong>{customer?.fullName || 'Khách hàng'}</strong><span>{customer?.email}</span></div></div>
          <button type="button" className="logout-button" onClick={onLogout}>Đăng xuất ↗</button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-topbar">
          <div className="portal-welcome"><p className="eyebrow">Không gian của bạn</p><h1>Xin chào, {String(customer?.fullName || 'bạn').split(' ').slice(-1)}.</h1><p>Chăm sóc trọn vẹn cho người bạn nhỏ mỗi ngày.</p></div>
          <div className="topbar-actions">
            <button type="button" className="icon-button" aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu" onClick={() => void refreshData({ quiet: false })}>↻</button>
            <button type="button" className="icon-button" aria-label="Mở thông báo" title="Thông báo" onClick={() => navigate('notifications')}>♢{unreadCount > 0 && <span className="notification-dot" />}</button>
            <Avatar user={customer} />
          </div>
        </header>
        {toast && <div className={`notice${toast.type === 'error' ? ' notice-error' : ''}`} role="status">{toast.message}</div>}
        {content}
      </main>

      {petModal && <PetFormModal pet={petModal.pet} busy={actionBusy === 'pet'} onClose={() => !actionBusy && setPetModal(null)} onSave={savePet} />}
      {activeBooking && <BookingDetailModal
        booking={activeBooking}
        pet={petById[itemId(activeBooking, 'petId')]}
        details={bookingDetails[itemId(activeBooking, 'bookingId')] || []}
        payments={payments[itemId(activeBooking, 'bookingId')] || []}
        serviceById={serviceById}
        actionBusy={actionBusy}
        onClose={() => setBookingDetailId('')}
        onCancel={cancelBooking}
        onSync={syncPayOS}
        onMessage={notify}
      />}
    </div>
  );
}

function OverviewPage({ customer, pets, bookings, payments, notifications, petById, onNavigate, onOpenBooking }) {
  const upcoming = bookings.filter(isUpcoming).sort((a, b) => (readDate(a.bookingDate)?.getTime() || 0) - (readDate(b.bookingDate)?.getTime() || 0));
  const pendingPayments = Object.values(payments).flat().filter((payment) => String(payment.status).toUpperCase() === 'PENDING');
  const unread = notifications.filter((notice) => !notice.isRead);
  return (
    <>
      <section className="dashboard-grid">
        <article className="panel span-12 welcome-panel">
          <div className="welcome-copy"><p className="eyebrow">PetNoVa Care</p><h2>Mỗi lần chăm sóc đều bắt đầu từ một cuộc hẹn chu đáo.</h2><p>Quản lý hồ sơ, lịch hẹn và sức khỏe của các bé thật nhẹ nhàng — ngay tại đây.</p><div className="button-row"><button type="button" className="button button-primary" onClick={() => onNavigate('bookings')}>Đặt lịch mới</button><button type="button" className="button button-secondary" onClick={() => onNavigate('pets')}>Quản lý thú cưng</button></div></div>
          <div className="welcome-art" aria-hidden="true"><span>🐕</span><span>✦</span><span>♥</span></div>
        </article>
        <StatCard icon="🐾" label="Thú cưng" value={pets.length} hint="Hồ sơ đang quản lý" />
        <StatCard icon="◷" label="Lịch sắp tới" value={upcoming.length} hint="Không bỏ lỡ cuộc hẹn" />
        <StatCard icon="₫" label="Chờ thanh toán" value={pendingPayments.length} hint="Giao dịch đang xử lý" />
        <StatCard icon="♢" label="Thông báo mới" value={unread.length} hint="Tin nhắn cần xem" />

        <section className="panel span-7">
          <div className="panel-heading"><h2>Lịch hẹn sắp tới</h2><button type="button" onClick={() => onNavigate('bookings')}>Xem tất cả</button></div>
          {upcoming.length ? <ul className="list">{upcoming.slice(0, 3).map((booking) => {
            const bookingId = itemId(booking, 'bookingId');
            const pet = petById[itemId(booking, 'petId')];
            return <li className="list-item" key={bookingId}><span className="calendar-chip"><strong>{String(readDate(booking.bookingDate)?.getDate() || '').padStart(2, '0')}</strong><small>THG {String((readDate(booking.bookingDate)?.getMonth() || 0) + 1).padStart(2, '0')}</small></span><div className="list-item-main"><strong>{pet?.petName || 'Thú cưng'} · {CARE_TYPES[booking.careTypeId] || booking.careTypeId}</strong><span>{formatTime(booking.bookingTime)} · {formatLongDate(booking.bookingDate)}</span></div><StatusBadge status={booking.status} /><button type="button" className="button button-ghost button-small" onClick={() => onOpenBooking(bookingId)}>Chi tiết</button></li>;
          })}</ul> : <EmptyState icon="◷">Chưa có lịch hẹn sắp tới. Hãy đặt một buổi chăm sóc cho bé nhé.</EmptyState>}
        </section>

        <section className="panel span-5">
          <div className="panel-heading"><h2>Việc cần làm</h2></div>
          <ul className="list action-list">
            <li className="list-item"><span className="task-icon">✚</span><div className="list-item-main"><strong>Hồ sơ sức khỏe</strong><span>Xem lịch sử khám và tiêm chủng của bé</span></div><button type="button" className="button button-ghost button-small" onClick={() => onNavigate('health')}>Mở</button></li>
            <li className="list-item"><span className="task-icon">₫</span><div className="list-item-main"><strong>{pendingPayments.length ? `${pendingPayments.length} thanh toán đang chờ` : 'Thanh toán đã ổn'}</strong><span>{pendingPayments.length ? 'Kiểm tra PayOS hoặc thanh toán tại quầy' : 'Bạn không có thanh toán đang chờ'}</span></div><button type="button" className="button button-ghost button-small" onClick={() => onNavigate('bookings')}>Xem</button></li>
            <li className="list-item"><span className="task-icon">♧</span><div className="list-item-main"><strong>Cập nhật thông tin bé</strong><span>Giữ cân nặng và tình trạng sức khỏe luôn mới</span></div><button type="button" className="button button-ghost button-small" onClick={() => onNavigate('pets')}>Quản lý</button></li>
          </ul>
        </section>
      </section>
      {customer?.fullName && <p className="dashboard-footnote">PetNoVa luôn ở đây để đồng hành cùng {customer.fullName} và các bé. ✦</p>}
    </>
  );
}

function StatCard({ icon, label, value, hint }) {
  return <article className="card stat-card"><span className="stat-icon" aria-hidden="true">{icon}</span><span className="stat-label">{label}</span><strong className="stat-number">{value}</strong><span className="muted small">{hint}</span></article>;
}

function PetsPage({ pets, onAdd, onEdit, onViewHealth }) {
  return (
    <section>
      <PageHeading eyebrow="Hồ sơ thú cưng" title="Những người bạn nhỏ" description="Lưu lại các thông tin cần thiết để PetNoVa chăm sóc bé tốt hơn." actions={<button className="button button-primary" onClick={onAdd}>＋ Thêm thú cưng</button>} />
      {pets.length ? <div className="pet-grid">{pets.map((pet) => {
        const petId = itemId(pet, 'petId');
        return <article className="pet-card" key={petId}><PetImage pet={pet} /><div className="pet-card-body"><div className="pet-card-title"><div><h3>{pet.petName}</h3><p>{pet.species} · {pet.breed || 'Chưa cập nhật giống'}</p></div><StatusBadge status={pet.healthStatus || 'ACTIVE'} /></div><div className="pet-meta"><span className="badge">{pet.gender || 'Chưa rõ giới tính'}</span><span className="badge">{Number(pet.weight) ? `${pet.weight} kg` : 'Chưa có cân nặng'}</span></div><div className="action-buttons"><button type="button" className="button button-secondary button-small" onClick={() => onEdit(pet)}>Chỉnh sửa</button><button type="button" className="button button-ghost button-small" onClick={() => onViewHealth(pet)}>Sức khỏe</button></div></div></article>;
      })}</div> : <div className="panel"><EmptyState icon="🐾" action={<button className="button button-primary" onClick={onAdd}>Thêm hồ sơ đầu tiên</button>}>Bạn chưa thêm thú cưng nào. Hãy tạo hồ sơ đầu tiên cho bé.</EmptyState></div>}
    </section>
  );
}

function PetFormModal({ pet, busy, onClose, onSave }) {
  const [values, setValues] = useState({
    petName: pet?.petName || '',
    species: pet?.species || '',
    breed: pet?.breed || '',
    gender: pet?.gender || 'Đực',
    birthDate: dateInputValue(pet?.birthDate),
    weight: pet?.weight ?? '',
    healthStatus: pet?.healthStatus || 'Khỏe mạnh',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(pet?.imageUrl || '');
  const [formError, setFormError] = useState('');

  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  const selectFile = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(nextFile.type)) {
      setFormError('Hãy chọn ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (nextFile.size > 6 * 1024 * 1024) {
      setFormError('Ảnh phải có dung lượng dưới 6 MB.');
      return;
    }
    setFormError('');
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!values.petName.trim() || !values.species.trim() || !values.birthDate || !values.weight || !values.healthStatus.trim()) {
      setFormError('Vui lòng điền đủ tên, loài, ngày sinh, cân nặng và tình trạng sức khỏe.');
      return;
    }
    if (Number(values.weight) <= 0) {
      setFormError('Cân nặng phải lớn hơn 0.');
      return;
    }
    setFormError('');
    await onSave({ pet, values, file });
  };
  return (
    <Modal title={pet ? `Chỉnh sửa ${pet.petName}` : 'Thêm thú cưng'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        {formError && <p className="form-feedback">{formError}</p>}
        <div className="photo-field"><div>{preview ? <img className="upload-preview" src={preview} alt="Xem trước ảnh thú cưng" /> : <div className="upload-preview upload-placeholder" aria-hidden="true">🐾</div>}</div><label className="file-input">{file ? `Đã chọn: ${file.name}` : 'Chọn ảnh thú cưng'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} hidden /></label></div>
        <label>Tên bé<input name="petName" value={values.petName} onChange={change} placeholder="Ví dụ: Bông" autoFocus /></label>
        <div className="form-row"><label>Loài<select name="species" value={values.species} onChange={change}><option value="">Chọn loài</option><option value="Chó">Chó</option><option value="Mèo">Mèo</option><option value="Khác">Khác</option></select></label><label>Giống<input name="breed" value={values.breed} onChange={change} placeholder="Ví dụ: Poodle" /></label></div>
        <div className="form-row"><label>Giới tính<select name="gender" value={values.gender} onChange={change}><option value="Đực">Đực</option><option value="Cái">Cái</option><option value="Chưa rõ">Chưa rõ</option></select></label><label>Ngày sinh<input type="date" name="birthDate" value={values.birthDate} max={todayInputValue()} onChange={change} /></label></div>
        <div className="form-row"><label>Cân nặng (kg)<input type="number" name="weight" value={values.weight} min="0.1" step="0.1" onChange={change} /></label><label>Tình trạng sức khỏe<input name="healthStatus" value={values.healthStatus} onChange={change} placeholder="Ví dụ: Khỏe mạnh" /></label></div>
        <div className="button-row"><button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Hủy</button><button className="button button-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></div>
      </form>
    </Modal>
  );
}

function BookingsPage({ pets, bookings, services, details, payments, petById, serviceById, submitting, onSubmit, onOpenBooking, onCancel, busyId }) {
  const activeServices = useMemo(
    () => services.filter((service) => String(service.status).toUpperCase() === 'ACTIVE'),
    [services],
  );
  const [form, setForm] = useState({
    petId: itemId(pets[0], 'petId'),
    careTypeId: 'CT001',
    serviceId: itemId(activeServices[0], 'serviceId'),
    bookingDate: '',
    bookingTime: '',
    paymentMethod: 'CASH',
    note: '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setForm((current) => ({
      ...current,
      petId: pets.some((pet) => itemId(pet, 'petId') === current.petId) ? current.petId : itemId(pets[0], 'petId'),
      serviceId: activeServices.some((service) => itemId(service, 'serviceId') === current.serviceId) ? current.serviceId : itemId(activeServices[0], 'serviceId'),
    }));
  }, [activeServices, pets]);

  const selectedService = activeServices.find((service) => itemId(service, 'serviceId') === form.serviceId);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.petId || !form.serviceId || !form.bookingDate || !form.bookingTime) {
      setFormError('Vui lòng chọn thú cưng, dịch vụ, ngày và giờ hẹn.');
      return;
    }
    if (form.bookingDate < todayInputValue()) {
      setFormError('Ngày hẹn phải từ hôm nay trở đi.');
      return;
    }
    setFormError('');
    const saved = await onSubmit(form);
    if (saved) setForm((current) => ({ ...current, bookingDate: '', bookingTime: '', note: '' }));
  };
  return (
    <section>
      <PageHeading eyebrow="Dịch vụ PetNoVa" title="Đặt lịch chăm sóc" description="Chọn lịch phù hợp để đội ngũ PetNoVa chuẩn bị thật chu đáo cho bé." />
      <div className="split-layout">
        <form className="panel booking-form" onSubmit={submit}>
          <div className="panel-heading"><h2>Thông tin cuộc hẹn</h2><span className="badge">Bước 1/1</span></div>
          {formError && <p className="form-feedback">{formError}</p>}
          {!pets.length && <p className="form-feedback">Bạn cần thêm thú cưng trước khi đặt lịch.</p>}
          <div className="form-grid">
            <label>Thú cưng<select name="petId" value={form.petId} onChange={update} disabled={!pets.length}>{pets.map((pet) => <option key={itemId(pet, 'petId')} value={itemId(pet, 'petId')}>{pet.petName} · {pet.species}</option>)}</select></label>
            <div className="form-row"><label>Hình thức<select name="careTypeId" value={form.careTypeId} onChange={update}>{Object.entries(CARE_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Thanh toán<select name="paymentMethod" value={form.paymentMethod} onChange={update}><option value="CASH">Tiền mặt tại quầy</option><option value="BANK_TRANSFER">Chuyển khoản PayOS</option></select></label></div>
            <label>Gói dịch vụ<select name="serviceId" value={form.serviceId} onChange={update} disabled={!activeServices.length}>{activeServices.map((service) => <option key={itemId(service, 'serviceId')} value={itemId(service, 'serviceId')}>{service.serviceName} · {formatMoney(service.price)}</option>)}</select></label>
            {selectedService && <div className="service-summary"><span>✦</span><div><strong>{selectedService.serviceName}</strong><p>{selectedService.description || 'Dịch vụ chăm sóc dành cho bé.'}</p></div><b>{formatMoney(selectedService.price)}</b></div>}
            <div className="form-row"><label>Ngày hẹn<input type="date" name="bookingDate" value={form.bookingDate} min={todayInputValue()} onChange={update} /></label><label>Giờ hẹn<input type="time" name="bookingTime" value={form.bookingTime} onChange={update} /></label></div>
            <label>Ghi chú cho PetNoVa<textarea name="note" value={form.note} onChange={update} placeholder="Tình trạng cần lưu ý, yêu cầu chăm sóc…" /></label>
            <button className="button button-primary" disabled={submitting || !pets.length || !activeServices.length}>{submitting ? 'Đang tạo lịch…' : `Đặt lịch · ${selectedService ? formatMoney(selectedService.price) : ''}`}</button>
          </div>
        </form>

        <aside className="panel booking-tip"><span className="tip-mark">♥</span><h2>Lời nhắn nhỏ</h2><p>Thông tin chính xác giúp đội ngũ chuẩn bị dịch vụ phù hợp cho từng bé.</p><ul><li>Đến đúng giờ đã chọn</li><li>Có thể hủy khi lịch chờ hoặc đã xác nhận</li><li>PayOS bảo mật, không lưu thông tin ngân hàng</li></ul></aside>
      </div>

      <section className="booking-history"><div className="panel-heading"><h2>Lịch hẹn của bạn</h2><span className="muted small">{bookings.length} cuộc hẹn</span></div>{bookings.length ? <div className="appointment-list">{bookings.map((booking) => <BookingCard key={itemId(booking, 'bookingId')} booking={booking} pet={petById[itemId(booking, 'petId')]} details={details[itemId(booking, 'bookingId')] || []} payments={payments[itemId(booking, 'bookingId')] || []} serviceById={serviceById} busy={busyId === `cancel-${itemId(booking, 'bookingId')}`} onOpen={() => onOpenBooking(itemId(booking, 'bookingId'))} onCancel={() => onCancel(booking)} />)}</div> : <div className="panel"><EmptyState icon="◷">Bạn chưa có lịch hẹn nào.</EmptyState></div>}</section>
    </section>
  );
}

function BookingCard({ booking, pet, details, payments, serviceById, busy, onOpen, onCancel }) {
  const detail = details[0];
  const service = detail ? serviceById[itemId(detail, 'serviceId')] : null;
  const payment = payments[0];
  return <article className="panel appointment-card"><div className="appointment-date"><strong>{String(readDate(booking.bookingDate)?.getDate() || '').padStart(2, '0')}</strong><span>THG {String((readDate(booking.bookingDate)?.getMonth() || 0) + 1).padStart(2, '0')}</span></div><div className="appointment-main"><div className="appointment-title"><div><h3>{pet?.petName || 'Thú cưng'} · {CARE_TYPES[booking.careTypeId] || booking.careTypeId}</h3><p>{service?.serviceName || 'Dịch vụ PetNoVa'} · {formatTime(booking.bookingTime)}</p></div><StatusBadge status={booking.status} /></div><div className="appointment-meta"><span>🐾 {pet?.species || 'Thú cưng'}</span><span>₫ {formatMoney(booking.totalAmount)}</span>{payment && <span>◉ {String(payment.status).toUpperCase() === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}</span>}</div></div><div className="action-buttons"><button type="button" className="button button-secondary button-small" onClick={onOpen}>Chi tiết</button>{isCancellable(booking) && <button type="button" className="button button-danger button-small" onClick={onCancel} disabled={busy}>{busy ? 'Đang hủy…' : 'Hủy lịch'}</button>}</div></article>;
}

function BookingDetailModal({ booking, pet, details, payments, serviceById, actionBusy, onClose, onCancel, onSync, onMessage }) {
  const [payosLinks, setPayosLinks] = useState({});
  const [creatingLink, setCreatingLink] = useState('');
  const bookingId = itemId(booking, 'bookingId');
  const createPayOSLink = async (payment) => {
    const paymentId = itemId(payment, 'paymentId');
    setCreatingLink(paymentId);
    try {
      const link = await api.post(`/api/Payments/${encodeURIComponent(paymentId)}/payos-link`);
      setPayosLinks((current) => ({ ...current, [paymentId]: link }));
      if (link?.checkoutUrl) {
        const opened = window.open(link.checkoutUrl, '_blank', 'noopener,noreferrer');
        if (!opened) onMessage('Trình duyệt đã chặn cửa sổ PayOS. Hãy dùng nút mở liên kết bên dưới.', 'error');
      }
    } catch (error) {
      onMessage(errorText(error, 'Không thể tạo liên kết PayOS.'), 'error');
    } finally {
      setCreatingLink('');
    }
  };
  return <Modal title={`Lịch hẹn ${bookingId}`} onClose={onClose} wide><div className="split-layout modal-booking-layout"><div><DetailGrid><DetailItem label="Thú cưng">{pet?.petName || booking.petId}</DetailItem><DetailItem label="Ngày giờ">{formatDate(booking.bookingDate)} · {formatTime(booking.bookingTime)}</DetailItem><DetailItem label="Hình thức">{CARE_TYPES[booking.careTypeId] || booking.careTypeId}</DetailItem><DetailItem label="Tổng tiền">{formatMoney(booking.totalAmount)}</DetailItem></DetailGrid>{booking.note && <div className="booking-note"><strong>Ghi chú của bạn</strong><p>{booking.note}</p></div>}<section className="modal-section"><h3>Dịch vụ đã chọn</h3>{details.length ? <ul className="list">{details.map((detail) => { const service = serviceById[itemId(detail, 'serviceId')]; return <li className="list-item" key={itemId(detail, 'detailId')}><span className="task-icon">✦</span><div className="list-item-main"><strong>{service?.serviceName || detail.serviceId}</strong><span>{detail.quantity || 1} gói · {formatMoney(detail.price)}</span></div></li>; })}</ul> : <p className="muted">Đang chờ thông tin dịch vụ.</p>}</section></div><aside className="payment-panel"><div className="panel-heading"><h3>Thanh toán</h3></div>{payments.length ? payments.map((payment) => <PaymentPanel key={itemId(payment, 'paymentId')} payment={payment} payosLink={payosLinks[itemId(payment, 'paymentId')]} creating={creatingLink === itemId(payment, 'paymentId')} syncing={actionBusy === `sync-${itemId(payment, 'paymentId')}`} onCreateLink={() => createPayOSLink(payment)} onSync={() => onSync(payment)} />) : <EmptyState icon="₫">Chưa có giao dịch cho lịch hẹn này.</EmptyState>}</aside></div><div className="button-row"><button type="button" className="button button-secondary" onClick={onClose}>Đóng</button>{isCancellable(booking) && <button type="button" className="button button-danger" disabled={actionBusy === `cancel-${bookingId}`} onClick={() => { onCancel(booking); onClose(); }}>Hủy lịch hẹn</button>}</div></Modal>;
}

function PaymentPanel({ payment, payosLink, creating, syncing, onCreateLink, onSync }) {
  const isPaid = String(payment.status).toUpperCase() === 'PAID';
  const bankTransfer = String(payment.method).toUpperCase() === 'BANK_TRANSFER';
  return <div className="payment-card"><div className="payment-card-head"><div><strong>{bankTransfer ? 'Chuyển khoản PayOS' : 'Tiền mặt tại quầy'}</strong><span>{formatMoney(payment.amount)}</span></div><StatusBadge status={payment.status} /></div>{isPaid ? <p className="payment-success">✓ Thanh toán đã được ghi nhận {payment.paymentDate ? `vào ${formatDate(payment.paymentDate)}` : ''}.</p> : bankTransfer ? <><p className="muted small">Tạo liên kết thanh toán bảo mật qua PayOS, sau đó quay lại để kiểm tra trạng thái.</p><div className="action-buttons"><button type="button" className="button button-primary button-small" onClick={onCreateLink} disabled={creating}>{creating ? 'Đang tạo…' : 'Thanh toán PayOS'}</button><button type="button" className="button button-secondary button-small" onClick={onSync} disabled={syncing}>{syncing ? 'Đang kiểm tra…' : 'Kiểm tra lại'}</button></div>{payosLink?.checkoutUrl && <a className="payment-link" href={payosLink.checkoutUrl} target="_blank" rel="noreferrer">Mở liên kết PayOS ↗</a>}</> : <p className="cash-note">Thanh toán {formatMoney(payment.amount)} trực tiếp tại quầy PetNoVa. Nhân viên sẽ xác nhận giao dịch cho bạn.</p>}</div>;
}

function HealthPage({ pets, selectedPetId, onSelectPet, records, vaccinations, loading }) {
  const selectedPet = pets.find((pet) => itemId(pet, 'petId') === selectedPetId);
  const nextVaccination = vaccinations.filter((item) => readDate(item.nextDate) >= readDate(todayInputValue())).sort((a, b) => (readDate(a.nextDate)?.getTime() || 0) - (readDate(b.nextDate)?.getTime() || 0))[0];
  return <section><PageHeading eyebrow="Theo dõi sức khỏe" title="Sổ sức khỏe của bé" description="Xem lại bệnh án và những lần tiêm chủng do đội ngũ PetNoVa cập nhật." />{!pets.length ? <div className="panel"><EmptyState icon="✚">Hãy thêm thú cưng để xem hồ sơ sức khỏe.</EmptyState></div> : <><div className="tab-list" role="tablist" aria-label="Chọn thú cưng">{pets.map((pet) => <button type="button" role="tab" aria-selected={itemId(pet, 'petId') === selectedPetId} className={`tab-button${itemId(pet, 'petId') === selectedPetId ? ' active' : ''}`} key={itemId(pet, 'petId')} onClick={() => onSelectPet(itemId(pet, 'petId'))}>{pet.petName}</button>)}</div>{loading ? <LoadingBlock label="Đang mở sổ sức khỏe…" /> : <div className="dashboard-grid"><section className="panel span-4 health-profile"><PetImage pet={selectedPet} compact /><div><p className="eyebrow">Hồ sơ đang xem</p><h2>{selectedPet?.petName}</h2><p>{selectedPet?.species} · {selectedPet?.breed || 'Chưa cập nhật giống'}</p><DetailGrid><DetailItem label="Cân nặng">{selectedPet?.weight ? `${selectedPet.weight} kg` : '—'}</DetailItem><DetailItem label="Sức khỏe">{selectedPet?.healthStatus || '—'}</DetailItem></DetailGrid>{nextVaccination && <div className="next-vaccine"><span>💉</span><div><strong>Mũi tiêm tiếp theo</strong><p>{nextVaccination.vaccineName} · {formatDate(nextVaccination.nextDate)}</p></div></div>}</div></section><section className="panel span-8"><div className="panel-heading"><h2>Lịch sử khám</h2><span className="badge">{records.length} hồ sơ</span></div>{records.length ? <div className="timeline">{records.map((record) => <article className="timeline-item" key={itemId(record, 'recordId')}><h3>{record.diagnosis || 'Khám sức khỏe'}</h3><p>{formatDate(record.recordDate)} · {record.treatment || 'Chưa có thông tin điều trị'}</p>{record.note && <p className="muted small">Ghi chú: {record.note}</p>}</article>)}</div> : <EmptyState icon="✚">Chưa có bệnh án được ghi nhận.</EmptyState>}</section><section className="panel span-12"><div className="panel-heading"><h2>Sổ tiêm chủng</h2><span className="badge">{vaccinations.length} mũi</span></div>{vaccinations.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Vaccine</th><th>Ngày tiêm</th><th>Ngày nhắc lại</th><th>Ghi chú</th></tr></thead><tbody>{vaccinations.map((vaccine) => <tr key={itemId(vaccine, 'vaccinationId')}><td><strong>{vaccine.vaccineName}</strong></td><td>{formatDate(vaccine.vaccinationDate)}</td><td>{formatDate(vaccine.nextDate)}</td><td>{vaccine.note || '—'}</td></tr>)}</tbody></table></div> : <EmptyState icon="💉">Chưa có lịch sử tiêm chủng.</EmptyState>}</section></div>}</>}</section>;
}

function NotificationsPage({ notifications, unreadCount, onOpen, onMarkAll, busy }) {
  return <section><PageHeading eyebrow="Hộp thư PetNoVa" title="Thông báo" description="Theo dõi xác nhận lịch hẹn, thanh toán và những cập nhật quan trọng." actions={unreadCount ? <button className="button button-secondary" disabled={busy} onClick={onMarkAll}>{busy ? 'Đang cập nhật…' : 'Đánh dấu đã đọc'}</button> : null} />{notifications.length ? <div className="notification-list">{notifications.map((notice) => <button type="button" key={itemId(notice, 'notificationId')} className={`notification-card${notice.isRead ? '' : ' unread'}`} onClick={() => void onOpen(notice)}><span className="notification-icon" aria-hidden="true">{String(notice.notificationType).toUpperCase() === 'PAYMENT' ? '₫' : '◷'}</span><span className="notification-content"><strong>{notice.title}</strong><span>{notice.message}</span><small>{formatDate(notice.createdAt)}</small></span>{!notice.isRead && <span className="unread-indicator" aria-label="Chưa đọc" />}</button>)}</div> : <div className="panel"><EmptyState icon="♢">Bạn chưa có thông báo nào. Các cập nhật về lịch hẹn sẽ xuất hiện ở đây.</EmptyState></div>}</section>;
}

function ProfilePage({ user, busy, onSave, onUploadAvatar, onLogout }) {
  const [values, setValues] = useState({ fullName: user?.fullName || '', phone: user?.phone || '' });
  const [formError, setFormError] = useState('');
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  useEffect(() => setValues({ fullName: user?.fullName || '', phone: user?.phone || '' }), [user?.fullName, user?.phone]);
  const submit = async (event) => { event.preventDefault(); if (!values.fullName.trim() || !values.phone.trim()) { setFormError('Vui lòng nhập họ tên và số điện thoại.'); return; } setFormError(''); await onSave(values); };
  const selectAvatar = async (event) => { const file = event.target.files?.[0]; if (!file) return; if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 6 * 1024 * 1024) { setFormError('Ảnh đại diện phải là JPG, PNG hoặc WebP dưới 6 MB.'); return; } setFormError(''); await onUploadAvatar(file); event.target.value = ''; };
  return <section><PageHeading eyebrow="Tài khoản PetNoVa" title="Thông tin của bạn" description="Cập nhật thông tin liên hệ và ảnh đại diện cho tài khoản." /><div className="split-layout"><aside className="panel profile-summary"><Avatar user={user} size="large" /><h2>{user?.fullName || 'Khách hàng PetNoVa'}</h2><p>{user?.email}</p><label className="button button-secondary file-button">{busy === 'avatar' ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy === 'avatar'} onChange={selectAvatar} /></label><div className="profile-role"><span>Vai trò</span><strong>Khách hàng</strong></div></aside><form className="panel form-grid" onSubmit={submit}><div className="panel-heading"><h2>Thông tin liên hệ</h2></div>{formError && <p className="form-feedback">{formError}</p>}<label>Họ và tên<input name="fullName" value={values.fullName} onChange={change} autoComplete="name" /></label><label>Email<input value={user?.email || ''} readOnly aria-readonly="true" /><span className="field-hint">Email được quản lý bởi tài khoản đăng nhập.</span></label><label>Số điện thoại<input name="phone" value={values.phone} onChange={change} inputMode="tel" autoComplete="tel" placeholder="+84…" /></label><div className="button-row"><button className="button button-primary" disabled={busy === 'profile'}>{busy === 'profile' ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div><hr className="section-line" /><div className="profile-danger"><div><strong>Đăng xuất khỏi PetNoVa</strong><p>Bạn có thể đăng nhập lại bất kỳ lúc nào.</p></div><button type="button" className="button button-danger button-small" onClick={onLogout}>Đăng xuất</button></div></form></div></section>;
}
