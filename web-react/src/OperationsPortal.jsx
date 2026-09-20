import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatError } from './api';

const ENDPOINTS = {
  bookings: '/api/Bookings',
  bookingDetails: '/api/BookingDetails',
  payments: '/api/Payments',
  pets: '/api/Pets',
  records: '/api/MedicalRecords',
  vaccinations: '/api/Vaccinations',
  users: '/api/UserAccounts',
  staff: '/api/Staffs',
  services: '/api/ServicePackages',
};

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang chăm sóc',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const ACCOUNT_STATUS_LABELS = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngưng hoạt động',
  SUSPENDED: 'Tạm đình chỉ',
};

const PAYMENT_STATUS_LABELS = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

const ROLE_LABELS = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  VET: 'Bác sĩ thú y',
  ADMIN: 'Quản trị viên',
};

const EMPTY_STAFF_DRAFT = {
  firebaseUid: '',
  fullName: '',
  email: '',
  phone: '',
  role: 'STAFF',
};

const EMPTY_SERVICE_DRAFT = {
  serviceId: '',
  serviceName: '',
  description: '',
  price: '',
  duration: '',
  categoryId: '',
  status: 'ACTIVE',
};

function unwrapResponse(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'data')) {
    return value.data;
  }
  return value;
}

function asList(value) {
  const data = unwrapResponse(value);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function request(method, path, body) {
  const result = body === undefined
    ? await api[method](path)
    : await api[method](path, body);
  return unwrapResponse(result);
}

function errorText(error, fallback = 'Không thể hoàn tất thao tác. Vui lòng thử lại.') {
  try {
    const message = formatError(error);
    if (typeof message === 'string' && message.trim()) return message.trim();
  } catch {
    // Dùng thông điệp dự phòng bên dưới nếu helper không thể xử lý lỗi lạ.
  }

  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
}

function normalise(value) {
  return String(value || '').trim().toUpperCase();
}

function encodeId(value) {
  return encodeURIComponent(String(value || ''));
}

function roleLabel(role) {
  const normalized = normalise(role);
  return ROLE_LABELS[normalized] || normalized || 'Chưa xác định';
}

function statusLabel(status, kind = 'booking') {
  const normalized = normalise(status);
  const labels = kind === 'account'
    ? ACCOUNT_STATUS_LABELS
    : kind === 'payment'
      ? PAYMENT_STATUS_LABELS
      : BOOKING_STATUS_LABELS;
  return labels[normalized] || normalized || 'Chưa cập nhật';
}

function statusClass(status) {
  const normalized = normalise(status);
  if (normalized === 'IN_PROGRESS') return 'progress';
  return normalized.toLowerCase() || 'pending';
}

function paymentMethodLabel(method) {
  switch (normalise(method)) {
    case 'CASH':
      return 'Tiền mặt';
    case 'BANK_TRANSFER':
      return 'Chuyển khoản';
    default:
      return method || 'Chưa chọn';
  }
}

function currency(value) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat('vi-VN').format(Number.isFinite(amount) ? amount : 0)} ₫`;
}

function displayDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function dateInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function localDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function oneYearFromTodayInput() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return localDateInput(date);
}

function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'PN';
}

function nextBookingStatus(status) {
  switch (normalise(status)) {
    case 'PENDING':
      return 'CONFIRMED';
    case 'CONFIRMED':
      return 'IN_PROGRESS';
    case 'IN_PROGRESS':
      return 'COMPLETED';
    default:
      return '';
  }
}

function nextBookingActionLabel(status) {
  switch (normalise(status)) {
    case 'PENDING':
      return 'Xác nhận lịch';
    case 'CONFIRMED':
      return 'Bắt đầu chăm sóc';
    case 'IN_PROGRESS':
      return 'Hoàn thành dịch vụ';
    default:
      return '';
  }
}

function deriveStaffId(user, staffProfile) {
  const candidates = [
    staffProfile?.staffId,
    user?.staffId,
    user?.staff?.staffId,
    user?.staffProfile?.staffId,
    user?.profile?.staffId,
  ];
  return candidates.find((value) => String(value || '').trim()) || '';
}

function PortalShell({
  user,
  onLogout,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  onRefresh,
  children,
}) {
  const avatarUrl = String(user?.avatarUrl || '');

  return (
    <div className="portal">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>PetNoVa</span>
        </div>

        <nav aria-label="Điều hướng cổng làm việc">
          <ul className="nav-list">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  className={`nav-button${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => onTabChange(tab.id)}
                >
                  <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini">
            {avatarUrl ? (
              <span className="avatar"><img src={avatarUrl} alt="" /></span>
            ) : (
              <span className="avatar-placeholder" aria-hidden="true">{initials(user?.fullName)}</span>
            )}
            <div>
              <strong>{user?.fullName || 'Tài khoản PetNoVa'}</strong>
              <span>{roleLabel(user?.role)}</span>
            </div>
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>Đăng xuất</button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-topbar">
          <div className="portal-welcome">
            <p className="eyebrow">PETNOVA WORKSPACE</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {onRefresh && (
            <div className="topbar-actions">
              <button type="button" className="icon-button" onClick={onRefresh} title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu">↻</button>
            </div>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}

function StatusBadge({ status, kind = 'booking' }) {
  return <span className={`badge ${statusClass(status)}`}>{statusLabel(status, kind)}</span>;
}

function EmptyState({ icon = '◌', children }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function LoadingState({ label = 'Đang tải dữ liệu…' }) {
  return <div className="panel"><div className="empty-state">{label}</div></div>;
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="panel">
      <div className="empty-state">
        <span className="empty-icon" aria-hidden="true">!</span>
        <p>{error}</p>
        {onRetry && <button type="button" className="button button-secondary" onClick={onRetry}>Thử lại</button>}
      </div>
    </div>
  );
}

function Notice({ children, error = false }) {
  if (!children) return null;
  return <div className={error ? 'form-feedback' : 'notice'} role={error ? 'alert' : 'status'}>{children}</div>;
}

/** Cổng nghiệp vụ dành cho nhân viên vận hành. */
export function StaffPortal({ user, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [bookingDetails, setBookingDetails] = useState([]);
  const [payments, setPayments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadBookings = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [bookingData, detailData, paymentData, serviceData] = await Promise.all([
        request('get', ENDPOINTS.bookings),
        request('get', ENDPOINTS.bookingDetails),
        request('get', ENDPOINTS.payments),
        request('get', ENDPOINTS.services),
      ]);
      setBookings(asList(bookingData));
      setBookingDetails(asList(detailData));
      setPayments(asList(paymentData));
      setServices(asList(serviceData));
    } catch (loadError) {
      setError(errorText(loadError, 'Không thể tải danh sách lịch hẹn.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const serviceById = useMemo(() => new Map(services.map((service) => [service.serviceId, service])), [services]);
  const paymentByBookingId = useMemo(() => {
    const map = new Map();
    payments.forEach((payment) => {
      if (!map.has(payment.bookingId)) map.set(payment.bookingId, payment);
    });
    return map;
  }, [payments]);
  const detailByBookingId = useMemo(() => {
    const map = new Map();
    bookingDetails.forEach((detail) => {
      if (!map.has(detail.bookingId)) map.set(detail.bookingId, detail);
    });
    return map;
  }, [bookingDetails]);

  const visibleBookings = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return [...bookings]
      .filter((booking) => statusFilter === 'ALL' || normalise(booking.status) === statusFilter)
      .filter((booking) => !keyword || [
        booking.bookingId,
        booking.petId,
        booking.userId,
        booking.careTypeId,
      ].some((value) => String(value || '').toLowerCase().includes(keyword)))
      .sort((left, right) => String(right.bookingDate || '').localeCompare(String(left.bookingDate || '')));
  }, [bookings, query, statusFilter]);

  const runAction = async (key, operation, successMessage) => {
    setBusyKey(key);
    setNotice('');
    try {
      await operation();
      setNotice(successMessage);
      await loadBookings(false);
    } catch (actionError) {
      setNotice(errorText(actionError));
    } finally {
      setBusyKey('');
    }
  };

  const advanceBooking = async (booking, payment) => {
    const nextStatus = nextBookingStatus(booking.status);
    if (!nextStatus) return;
    if (nextStatus === 'COMPLETED' && normalise(payment?.status) !== 'PAID') {
      setNotice('Không thể hoàn thành dịch vụ khi khách hàng chưa thanh toán.');
      return;
    }
    if (!window.confirm(`Chuyển lịch ${booking.bookingId} sang trạng thái “${statusLabel(nextStatus)}”?`)) return;
    await runAction(
      `booking-${booking.bookingId}`,
      () => request('put', `${ENDPOINTS.bookings}/${encodeId(booking.bookingId)}/status`, { status: nextStatus }),
      `Đã cập nhật lịch ${booking.bookingId}.`,
    );
  };

  const confirmCashPayment = (payment) => runAction(
    `payment-${payment.paymentId}`,
    () => request('put', `${ENDPOINTS.payments}/${encodeId(payment.paymentId)}/confirm`),
    `Đã xác nhận thanh toán ${payment.paymentId}.`,
  );

  const syncBankPayment = (payment) => runAction(
    `payment-${payment.paymentId}`,
    () => request('post', `${ENDPOINTS.payments}/${encodeId(payment.paymentId)}/payos-sync`),
    `Đã kiểm tra giao dịch PayOS ${payment.paymentId}.`,
  );

  const tabs = [{ id: 'bookings', label: 'Lịch hẹn & thanh toán', icon: '▣' }];

  return (
    <PortalShell
      user={user}
      onLogout={onLogout}
      title="Bàn vận hành"
      subtitle="Theo dõi lịch hẹn, tiến độ chăm sóc và thanh toán tại quầy."
      tabs={tabs}
      activeTab="bookings"
      onTabChange={() => {}}
      onRefresh={() => loadBookings()}
    >
      <div className="page-heading">
        <div>
          <h1>Lịch hẹn</h1>
          <p>{visibleBookings.length} lịch phù hợp bộ lọc hiện tại.</p>
        </div>
      </div>

      <Notice error={notice && /^(Không thể|Lỗi)/i.test(notice)}>{notice}</Notice>

      <section className="panel">
        <div className="toolbar">
          <div className="toolbar-group">
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã lịch, thú cưng, khách…"
              aria-label="Tìm lịch hẹn"
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái lịch">
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ xác nhận</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="IN_PROGRESS">Đang chăm sóc</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>
          <button type="button" className="button button-secondary button-small" onClick={() => loadBookings()}>Làm mới</button>
        </div>

        {loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={() => loadBookings()} /> : visibleBookings.length === 0 ? (
          <EmptyState icon="◫">Chưa có lịch hẹn phù hợp.</EmptyState>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lịch hẹn</th>
                  <th>Dịch vụ</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleBookings.map((booking) => {
                  const detail = detailByBookingId.get(booking.bookingId);
                  const service = detail ? serviceById.get(detail.serviceId) : null;
                  const payment = paymentByBookingId.get(booking.bookingId);
                  const nextStatus = nextBookingStatus(booking.status);
                  const paymentPending = normalise(payment?.status) === 'PENDING';
                  const blockedCompletion = nextStatus === 'COMPLETED' && normalise(payment?.status) !== 'PAID';

                  return (
                    <tr key={booking.bookingId}>
                      <td>
                        <strong>{booking.bookingId}</strong>
                        <span className="muted small">{booking.petId} · Khách {booking.userId}</span>
                      </td>
                      <td>
                        <strong>{service?.serviceName || detail?.serviceId || booking.careTypeId || '—'}</strong>
                        <span className="muted small">{currency(booking.totalAmount)}</span>
                      </td>
                      <td>{displayDate(booking.bookingDate)}<br /><span className="muted small">{String(booking.bookingTime || '').slice(0, 5) || '—'}</span></td>
                      <td><StatusBadge status={booking.status} /></td>
                      <td>
                        {payment ? (
                          <>
                            <strong>{paymentMethodLabel(payment.method)}</strong><br />
                            <StatusBadge status={payment.status} kind="payment" />
                          </>
                        ) : <span className="muted">Chưa có giao dịch</span>}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {paymentPending && normalise(payment.method) === 'CASH' && (
                            <button
                              type="button"
                              className="button button-secondary button-small"
                              disabled={busyKey === `payment-${payment.paymentId}`}
                              onClick={() => confirmCashPayment(payment)}
                            >
                              {busyKey === `payment-${payment.paymentId}` ? 'Đang lưu…' : 'Xác nhận tiền mặt'}
                            </button>
                          )}
                          {paymentPending && normalise(payment.method) === 'BANK_TRANSFER' && (
                            <button
                              type="button"
                              className="button button-secondary button-small"
                              disabled={busyKey === `payment-${payment.paymentId}`}
                              onClick={() => syncBankPayment(payment)}
                            >
                              {busyKey === `payment-${payment.paymentId}` ? 'Đang kiểm tra…' : 'Kiểm tra PayOS'}
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              type="button"
                              className="button button-primary button-small"
                              disabled={busyKey === `booking-${booking.bookingId}` || blockedCompletion}
                              title={blockedCompletion ? 'Cần xác nhận thanh toán trước khi hoàn thành.' : undefined}
                              onClick={() => advanceBooking(booking, payment)}
                            >
                              {busyKey === `booking-${booking.bookingId}` ? 'Đang cập nhật…' : nextBookingActionLabel(booking.status)}
                            </button>
                          )}
                          {blockedCompletion && <span className="muted small">Chờ thanh toán</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PortalShell>
  );
}

/** Cổng chuyên môn dành cho bác sĩ thú y. */
export function VetPortal({ user, onLogout }) {
  const [pets, setPets] = useState([]);
  const [staffProfile, setStaffProfile] = useState(null);
  const [staffError, setStaffError] = useState('');
  const [selectedPetId, setSelectedPetId] = useState('');
  const [records, setRecords] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [clinicalTab, setClinicalTab] = useState('records');
  const [recordForm, setRecordForm] = useState({ diagnosis: '', treatment: '', note: '' });
  const [vaccinationForm, setVaccinationForm] = useState({
    vaccineName: '',
    vaccinationDate: localDateInput(),
    nextDate: oneYearFromTodayInput(),
    note: '',
  });

  const staffId = deriveStaffId(user, staffProfile);

  const loadInitial = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    setStaffError('');
    const [petResult, staffResult] = await Promise.allSettled([
      request('get', ENDPOINTS.pets),
      request('get', `${ENDPOINTS.staff}/me`),
    ]);

    if (petResult.status === 'fulfilled') {
      const petList = asList(petResult.value);
      setPets(petList);
      setSelectedPetId((current) => (
        petList.some((pet) => pet.petId === current) ? current : (petList[0]?.petId || '')
      ));
    } else {
      setPets([]);
      setError(errorText(petResult.reason, 'Không thể tải danh sách thú cưng.'));
    }

    if (staffResult.status === 'fulfilled') {
      setStaffProfile(unwrapResponse(staffResult.value) || null);
    } else {
      setStaffProfile(null);
      setStaffError(errorText(staffResult.reason, 'Chưa xác định được hồ sơ nhân sự hiện tại.'));
    }

    setLoading(false);
  }, []);

  const loadHistory = useCallback(async (petId) => {
    if (!petId) {
      setRecords([]);
      setVaccinations([]);
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const [recordData, vaccinationData] = await Promise.all([
        request('get', `${ENDPOINTS.records}/pet/${encodeId(petId)}`),
        request('get', `${ENDPOINTS.vaccinations}/pet/${encodeId(petId)}`),
      ]);
      setRecords(asList(recordData));
      setVaccinations(asList(vaccinationData));
    } catch (historyLoadError) {
      setHistoryError(errorText(historyLoadError, 'Không thể tải hồ sơ sức khỏe của thú cưng.'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (selectedPetId) loadHistory(selectedPetId);
  }, [selectedPetId, loadHistory]);

  const selectedPet = useMemo(
    () => pets.find((pet) => pet.petId === selectedPetId) || null,
    [pets, selectedPetId],
  );

  const refresh = async () => {
    await loadInitial();
    if (selectedPetId) await loadHistory(selectedPetId);
  };

  const requireClinicalContext = () => {
    if (!selectedPet) {
      setNotice('Hãy chọn thú cưng trước khi cập nhật hồ sơ.');
      return false;
    }
    if (!staffId) {
      setNotice('Chưa tìm thấy mã nhân sự của phiên đăng nhập. Hãy tải lại hoặc liên hệ quản trị viên.');
      return false;
    }
    return true;
  };

  const submitRecord = async (event) => {
    event.preventDefault();
    if (!requireClinicalContext()) return;
    setBusyKey('record');
    setNotice('');
    try {
      await request('post', ENDPOINTS.records, {
        recordId: '',
        diagnosis: recordForm.diagnosis.trim(),
        treatment: recordForm.treatment.trim(),
        recordDate: new Date().toISOString(),
        note: recordForm.note.trim() || null,
        petId: selectedPet.petId,
        staffId,
      });
      setRecordForm({ diagnosis: '', treatment: '', note: '' });
      setNotice(`Đã lưu bệnh án cho ${selectedPet.petName}.`);
      await loadHistory(selectedPet.petId);
    } catch (submitError) {
      setNotice(errorText(submitError));
    } finally {
      setBusyKey('');
    }
  };

  const submitVaccination = async (event) => {
    event.preventDefault();
    if (!requireClinicalContext()) return;
    setBusyKey('vaccination');
    setNotice('');
    try {
      await request('post', ENDPOINTS.vaccinations, {
        vaccinationId: '',
        vaccineName: vaccinationForm.vaccineName.trim(),
        vaccinationDate: `${vaccinationForm.vaccinationDate}T00:00:00`,
        nextDate: `${vaccinationForm.nextDate}T00:00:00`,
        note: vaccinationForm.note.trim() || null,
        petId: selectedPet.petId,
        staffId,
      });
      setVaccinationForm({
        vaccineName: '',
        vaccinationDate: localDateInput(),
        nextDate: oneYearFromTodayInput(),
        note: '',
      });
      setNotice(`Đã ghi nhận mũi tiêm cho ${selectedPet.petName}.`);
      await loadHistory(selectedPet.petId);
    } catch (submitError) {
      setNotice(errorText(submitError));
    } finally {
      setBusyKey('');
    }
  };

  const tabs = [{ id: 'pets', label: 'Hồ sơ thú cưng', icon: '♧' }];

  return (
    <PortalShell
      user={user}
      onLogout={onLogout}
      title="Phòng khám thú y"
      subtitle="Tra cứu hồ sơ, lập bệnh án và theo dõi lịch tiêm cho thú cưng."
      tabs={tabs}
      activeTab="pets"
      onTabChange={() => {}}
      onRefresh={refresh}
    >
      <div className="page-heading">
        <div>
          <h1>Hồ sơ khám chữa</h1>
          <p>{staffId ? `Đang ghi nhận với mã nhân sự ${staffId}.` : 'Đang xác thực hồ sơ nhân sự.'}</p>
        </div>
      </div>

      <Notice error={Boolean(staffError)}>{staffError}</Notice>
      <Notice error={notice && /^(Không thể|Lỗi|Chưa)/i.test(notice)}>{notice}</Notice>

      {loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={() => loadInitial()} /> : (
        <div className="split-layout">
          <section className="panel">
            <div className="panel-heading">
              <h2>Thú cưng ({pets.length})</h2>
              <button type="button" onClick={() => loadInitial(false)}>Tải lại</button>
            </div>
            {pets.length === 0 ? <EmptyState icon="♧">Chưa có hồ sơ thú cưng nào.</EmptyState> : (
              <div className="pet-grid">
                {pets.map((pet) => (
                  <article className="pet-card" key={pet.petId}>
                    <div className="pet-card-image">
                      {pet.imageUrl ? <img src={pet.imageUrl} alt={`Ảnh của ${pet.petName}`} /> : '♧'}
                    </div>
                    <div className="pet-card-body">
                      <h3>{pet.petName || pet.petId}</h3>
                      <p>{pet.species || 'Chưa cập nhật loài'} · {pet.breed || 'Chưa cập nhật giống'}</p>
                      <div className="pet-meta">
                        <span className="badge">{pet.gender || '—'}</span>
                        <span className="badge">{Number(pet.weight || 0)} kg</span>
                      </div>
                      <p className="small">Sức khỏe: <strong>{pet.healthStatus || 'Chưa cập nhật'}</strong></p>
                      <button
                        type="button"
                        className={`button ${selectedPetId === pet.petId ? 'button-secondary' : 'button-primary'} button-small`}
                        onClick={() => setSelectedPetId(pet.petId)}
                      >
                        {selectedPetId === pet.petId ? 'Đang xem hồ sơ' : 'Mở hồ sơ'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            {!selectedPet ? <EmptyState icon="◫">Chọn một thú cưng để xem hồ sơ sức khỏe.</EmptyState> : (
              <>
                <div className="panel-heading">
                  <div>
                    <h2>{selectedPet.petName}</h2>
                    <p className="muted small">{selectedPet.petId} · Chủ nuôi {selectedPet.userId}</p>
                  </div>
                  <span className="badge">{selectedPet.healthStatus || 'Chưa cập nhật'}</span>
                </div>

                <div className="detail-grid">
                  <div className="detail-item"><span>Loài / giống</span><strong>{selectedPet.species || '—'} · {selectedPet.breed || '—'}</strong></div>
                  <div className="detail-item"><span>Ngày sinh</span><strong>{displayDate(selectedPet.birthDate)}</strong></div>
                  <div className="detail-item"><span>Giới tính</span><strong>{selectedPet.gender || '—'}</strong></div>
                  <div className="detail-item"><span>Cân nặng</span><strong>{selectedPet.weight || '—'} kg</strong></div>
                </div>

                <div className="tab-list" role="tablist" aria-label="Hồ sơ sức khỏe">
                  <button type="button" role="tab" className={`tab-button${clinicalTab === 'records' ? ' active' : ''}`} onClick={() => setClinicalTab('records')}>Bệnh án ({records.length})</button>
                  <button type="button" role="tab" className={`tab-button${clinicalTab === 'vaccinations' ? ' active' : ''}`} onClick={() => setClinicalTab('vaccinations')}>Tiêm chủng ({vaccinations.length})</button>
                </div>

                {historyLoading ? <LoadingState label="Đang tải lịch sử sức khỏe…" /> : historyError ? <ErrorState error={historyError} onRetry={() => loadHistory(selectedPet.petId)} /> : clinicalTab === 'records' ? (
                  <>
                    <div className="timeline">
                      {records.length === 0 ? <EmptyState icon="＋">Chưa có bệnh án cho thú cưng này.</EmptyState> : records.map((record) => (
                        <article className="timeline-item" key={record.recordId}>
                          <h3>{record.diagnosis || 'Chưa có chẩn đoán'}</h3>
                          <p>{displayDate(record.recordDate)} · Nhân sự {record.staffId}</p>
                          <p><strong>Điều trị:</strong> {record.treatment || 'Chưa cập nhật'}</p>
                          {record.note && <p><strong>Ghi chú:</strong> {record.note}</p>}
                        </article>
                      ))}
                    </div>

                    <form className="form-grid" onSubmit={submitRecord}>
                      <h3>Thêm bệnh án</h3>
                      <label>Chẩn đoán
                        <input required value={recordForm.diagnosis} onChange={(event) => setRecordForm((current) => ({ ...current, diagnosis: event.target.value }))} placeholder="Ví dụ: Viêm da dị ứng" />
                      </label>
                      <label>Hướng điều trị
                        <textarea required value={recordForm.treatment} onChange={(event) => setRecordForm((current) => ({ ...current, treatment: event.target.value }))} placeholder="Thuốc, chế độ chăm sóc, dặn dò…" />
                      </label>
                      <label>Ghi chú thêm
                        <textarea value={recordForm.note} onChange={(event) => setRecordForm((current) => ({ ...current, note: event.target.value }))} placeholder="Tùy chọn" />
                      </label>
                      <div className="button-row"><button type="submit" className="button button-primary" disabled={busyKey === 'record' || !staffId}>{busyKey === 'record' ? 'Đang lưu…' : 'Lưu bệnh án'}</button></div>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="timeline">
                      {vaccinations.length === 0 ? <EmptyState icon="＋">Chưa có lịch sử tiêm chủng.</EmptyState> : vaccinations.map((vaccination) => (
                        <article className="timeline-item" key={vaccination.vaccinationId}>
                          <h3>{vaccination.vaccineName || 'Mũi tiêm chưa đặt tên'}</h3>
                          <p>Đã tiêm: {displayDate(vaccination.vaccinationDate)} · Nhân sự {vaccination.staffId}</p>
                          <p><strong>Nhắc lại:</strong> {displayDate(vaccination.nextDate)}</p>
                          {vaccination.note && <p><strong>Ghi chú:</strong> {vaccination.note}</p>}
                        </article>
                      ))}
                    </div>

                    <form className="form-grid" onSubmit={submitVaccination}>
                      <h3>Ghi nhận mũi tiêm</h3>
                      <label>Tên vaccine
                        <input required value={vaccinationForm.vaccineName} onChange={(event) => setVaccinationForm((current) => ({ ...current, vaccineName: event.target.value }))} placeholder="Ví dụ: Nobivac DHPPi" />
                      </label>
                      <div className="form-row">
                        <label>Ngày tiêm
                          <input required type="date" value={vaccinationForm.vaccinationDate} onChange={(event) => setVaccinationForm((current) => ({ ...current, vaccinationDate: event.target.value }))} />
                        </label>
                        <label>Ngày nhắc lại
                          <input required type="date" value={vaccinationForm.nextDate} onChange={(event) => setVaccinationForm((current) => ({ ...current, nextDate: event.target.value }))} />
                        </label>
                      </div>
                      <label>Ghi chú thêm
                        <textarea value={vaccinationForm.note} onChange={(event) => setVaccinationForm((current) => ({ ...current, note: event.target.value }))} placeholder="Tùy chọn" />
                      </label>
                      <div className="button-row"><button type="submit" className="button button-primary" disabled={busyKey === 'vaccination' || !staffId}>{busyKey === 'vaccination' ? 'Đang lưu…' : 'Lưu mũi tiêm'}</button></div>
                    </form>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </PortalShell>
  );
}

/** Cổng quản trị tổng hợp: người dùng, nhân sự, dịch vụ và lịch hẹn. */
export function AdminPortal({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    bookings: [],
    bookingDetails: [],
    payments: [],
    pets: [],
    users: [],
    staff: [],
    services: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [staffQuery, setStaffQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [staffEditorOpen, setStaffEditorOpen] = useState(false);
  const [staffEditingId, setStaffEditingId] = useState('');
  const [staffDraft, setStaffDraft] = useState(EMPTY_STAFF_DRAFT);
  const [serviceEditorOpen, setServiceEditorOpen] = useState(false);
  const [serviceEditingId, setServiceEditingId] = useState('');
  const [serviceDraft, setServiceDraft] = useState(EMPTY_SERVICE_DRAFT);

  const loadAll = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    const resources = [
      ['bookings', ENDPOINTS.bookings],
      ['bookingDetails', ENDPOINTS.bookingDetails],
      ['payments', ENDPOINTS.payments],
      ['pets', ENDPOINTS.pets],
      ['users', ENDPOINTS.users],
      ['staff', ENDPOINTS.staff],
      ['services', ENDPOINTS.services],
    ];
    const results = await Promise.allSettled(resources.map(([, path]) => request('get', path)));
    const nextData = {};
    const failures = [];
    results.forEach((result, index) => {
      const [name] = resources[index];
      if (result.status === 'fulfilled') {
        nextData[name] = asList(result.value);
      } else {
        nextData[name] = [];
        failures.push(errorText(result.reason, `Không thể tải ${name}.`));
      }
    });
    setData(nextData);
    if (failures.length) setError(failures[0]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runMutation = async (key, operation, successMessage) => {
    setBusyKey(key);
    setNotice('');
    try {
      await operation();
      setNotice(successMessage);
      await loadAll(false);
      return true;
    } catch (mutationError) {
      setNotice(errorText(mutationError));
      return false;
    } finally {
      setBusyKey('');
    }
  };

  const users = useMemo(() => {
    const keyword = userQuery.trim().toLowerCase();
    return data.users.filter((account) => !keyword || [account.userId, account.fullName, account.email, account.phone]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [data.users, userQuery]);

  const staffList = useMemo(() => {
    const keyword = staffQuery.trim().toLowerCase();
    return data.staff.filter((member) => !keyword || [member.staffId, member.fullName, member.email, member.phone]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [data.staff, staffQuery]);

  const services = useMemo(() => {
    const keyword = serviceQuery.trim().toLowerCase();
    return data.services.filter((service) => !keyword || [service.serviceId, service.serviceName, service.description, service.categoryId]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [data.services, serviceQuery]);

  const bookingDetailById = useMemo(() => {
    const map = new Map();
    data.bookingDetails.forEach((detail) => {
      if (!map.has(detail.bookingId)) map.set(detail.bookingId, detail);
    });
    return map;
  }, [data.bookingDetails]);
  const serviceById = useMemo(() => new Map(data.services.map((service) => [service.serviceId, service])), [data.services]);
  const petById = useMemo(() => new Map(data.pets.map((pet) => [pet.petId, pet])), [data.pets]);
  const userById = useMemo(() => new Map(data.users.map((account) => [account.userId, account])), [data.users]);
  const paymentByBookingId = useMemo(() => {
    const map = new Map();
    data.payments.forEach((payment) => {
      if (!map.has(payment.bookingId)) map.set(payment.bookingId, payment);
    });
    return map;
  }, [data.payments]);

  const paidPayments = useMemo(() => data.payments.filter((payment) => normalise(payment.status) === 'PAID'), [data.payments]);
  const totalRevenue = useMemo(() => paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [paidPayments]);
  const pendingBookings = useMemo(() => data.bookings.filter((booking) => normalise(booking.status) === 'PENDING').length, [data.bookings]);
  const activeServices = useMemo(() => data.services.filter((service) => normalise(service.status) === 'ACTIVE').length, [data.services]);

  const updateUserRole = (account, role) => {
    if (normalise(role) === normalise(account.role)) return;
    runMutation(
      `user-role-${account.userId}`,
      () => request('put', `${ENDPOINTS.users}/${encodeId(account.userId)}/role`, { role }),
      `Đã cập nhật vai trò của ${account.fullName || account.userId}.`,
    );
  };

  const updateUserStatus = (account, status) => {
    if (normalise(status) === normalise(account.status)) return;
    runMutation(
      `user-status-${account.userId}`,
      () => request('put', `${ENDPOINTS.users}/${encodeId(account.userId)}/status`, { status }),
      `Đã cập nhật trạng thái của ${account.fullName || account.userId}.`,
    );
  };

  const startCreateStaff = () => {
    setStaffEditingId('');
    setStaffDraft(EMPTY_STAFF_DRAFT);
    setStaffEditorOpen(true);
  };

  const startEditStaff = (member) => {
    setStaffEditingId(member.staffId);
    setStaffDraft({
      firebaseUid: '',
      fullName: member.fullName || '',
      email: member.email || '',
      phone: member.phone || '',
      role: normalise(member.role) || 'STAFF',
    });
    setStaffEditorOpen(true);
  };

  const submitStaff = async (event) => {
    event.preventDefault();
    const payload = {
      fullName: staffDraft.fullName.trim(),
      phone: staffDraft.phone.trim(),
      role: normalise(staffDraft.role),
    };
    const isEditing = Boolean(staffEditingId);
    const success = await runMutation(
      isEditing ? `staff-save-${staffEditingId}` : 'staff-create',
      () => isEditing
        ? request('put', `${ENDPOINTS.staff}/${encodeId(staffEditingId)}`, payload)
        : request('post', ENDPOINTS.staff, {
          ...payload,
          firebaseUid: staffDraft.firebaseUid.trim(),
          email: staffDraft.email.trim(),
        }),
      isEditing ? 'Đã cập nhật hồ sơ nhân sự.' : 'Đã tạo hồ sơ nhân sự.',
    );
    if (success) {
      setStaffEditorOpen(false);
      setStaffEditingId('');
      setStaffDraft(EMPTY_STAFF_DRAFT);
    }
  };

  const deleteStaff = (member) => {
    if (!window.confirm(`Xóa hồ sơ ${member.fullName || member.staffId}? Tài khoản sẽ được chuyển về khách hàng.`)) return;
    runMutation(
      `staff-delete-${member.staffId}`,
      () => request('delete', `${ENDPOINTS.staff}/${encodeId(member.staffId)}`),
      'Đã gỡ hồ sơ nhân sự.',
    );
  };

  const toggleStaff = (member) => runMutation(
    `staff-toggle-${member.staffId}`,
    () => request('put', `${ENDPOINTS.staff}/${encodeId(member.staffId)}/toggle-status`),
    `Đã đổi trạng thái của ${member.fullName || member.staffId}.`,
  );

  const addStaffViolation = (member) => {
    if (!window.confirm(`Ghi nhận thêm một vi phạm cho ${member.fullName || member.staffId}?`)) return;
    runMutation(
      `staff-violation-${member.staffId}`,
      () => request('put', `${ENDPOINTS.staff}/${encodeId(member.staffId)}/add-violation`),
      'Đã ghi nhận vi phạm.',
    );
  };

  const activateStaff = (member) => runMutation(
    `staff-activate-${member.staffId}`,
    () => request('put', `${ENDPOINTS.staff}/${encodeId(member.staffId)}/activate`),
    `Đã kích hoạt ${member.fullName || member.staffId}.`,
  );

  const startCreateService = () => {
    setServiceEditingId('');
    setServiceDraft(EMPTY_SERVICE_DRAFT);
    setServiceEditorOpen(true);
  };

  const startEditService = (service) => {
    setServiceEditingId(service.serviceId);
    setServiceDraft({
      serviceId: service.serviceId,
      serviceName: service.serviceName || '',
      description: service.description || '',
      price: String(service.price ?? ''),
      duration: String(service.duration ?? ''),
      categoryId: service.categoryId || '',
      status: normalise(service.status) || 'ACTIVE',
    });
    setServiceEditorOpen(true);
  };

  const submitService = async (event) => {
    event.preventDefault();
    const payload = {
      serviceId: serviceEditingId || '',
      serviceName: serviceDraft.serviceName.trim(),
      description: serviceDraft.description.trim(),
      price: Number(serviceDraft.price),
      duration: Number(serviceDraft.duration),
      categoryId: serviceDraft.categoryId.trim(),
      status: normalise(serviceDraft.status) || 'ACTIVE',
    };
    const isEditing = Boolean(serviceEditingId);
    const success = await runMutation(
      isEditing ? `service-save-${serviceEditingId}` : 'service-create',
      () => isEditing
        ? request('put', `${ENDPOINTS.services}/${encodeId(serviceEditingId)}`, payload)
        : request('post', ENDPOINTS.services, payload),
      isEditing ? 'Đã cập nhật gói dịch vụ.' : 'Đã tạo gói dịch vụ.',
    );
    if (success) {
      setServiceEditorOpen(false);
      setServiceEditingId('');
      setServiceDraft(EMPTY_SERVICE_DRAFT);
    }
  };

  const deleteService = (service) => {
    if (!window.confirm(`Xóa gói “${service.serviceName || service.serviceId}”?`)) return;
    runMutation(
      `service-delete-${service.serviceId}`,
      () => request('delete', `${ENDPOINTS.services}/${encodeId(service.serviceId)}`),
      'Đã xóa gói dịch vụ.',
    );
  };

  const toggleService = (service) => runMutation(
    `service-toggle-${service.serviceId}`,
    () => request('put', `${ENDPOINTS.services}/${encodeId(service.serviceId)}/toggle-status`),
    `Đã đổi trạng thái gói “${service.serviceName || service.serviceId}”.`,
  );

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: '▦' },
    { id: 'users', label: 'Tài khoản', icon: '♙' },
    { id: 'staff', label: 'Nhân sự', icon: '♟' },
    { id: 'services', label: 'Dịch vụ', icon: '✦' },
    { id: 'bookings', label: 'Lịch hẹn', icon: '▣' },
  ];

  const overview = (
    <>
      <div className="page-heading"><div><h1>Tổng quan</h1><p>Bức tranh vận hành PetNoVa tại thời điểm hiện tại.</p></div></div>
      <section className="dashboard-grid">
        <article className="card stat-card"><span className="stat-icon">▣</span><span className="stat-label">Tổng lịch hẹn</span><strong className="stat-number">{data.bookings.length}</strong></article>
        <article className="card stat-card"><span className="stat-icon">◷</span><span className="stat-label">Chờ xác nhận</span><strong className="stat-number">{pendingBookings}</strong></article>
        <article className="card stat-card"><span className="stat-icon">₫</span><span className="stat-label">Doanh thu đã thu</span><strong className="stat-number">{currency(totalRevenue)}</strong></article>
        <article className="card stat-card"><span className="stat-icon">✦</span><span className="stat-label">Dịch vụ hoạt động</span><strong className="stat-number">{activeServices}</strong></article>

        <section className="panel span-7">
          <div className="panel-heading"><h2>Lịch hẹn gần đây</h2><button type="button" onClick={() => setActiveTab('bookings')}>Xem tất cả</button></div>
          {data.bookings.length === 0 ? <EmptyState icon="◫">Chưa có lịch hẹn.</EmptyState> : (
            <ul className="list">
              {[...data.bookings].sort((a, b) => String(b.createdAt || b.bookingDate || '').localeCompare(String(a.createdAt || a.bookingDate || ''))).slice(0, 5).map((booking) => {
                const pet = petById.get(booking.petId);
                return <li className="list-item" key={booking.bookingId}><span className="avatar-placeholder" aria-hidden="true">♧</span><div className="list-item-main"><strong>{pet?.petName || booking.petId} · {booking.bookingId}</strong><span>{displayDate(booking.bookingDate)} · {currency(booking.totalAmount)}</span></div><StatusBadge status={booking.status} /></li>;
              })}
            </ul>
          )}
        </section>
        <section className="panel span-5">
          <div className="panel-heading"><h2>Thanh toán</h2><span className="badge paid">{paidPayments.length} đã thu</span></div>
          <div className="detail-grid">
            <div className="detail-item"><span>Giao dịch đã thu</span><strong>{paidPayments.length}</strong></div>
            <div className="detail-item"><span>Chờ thanh toán</span><strong>{data.payments.filter((payment) => normalise(payment.status) === 'PENDING').length}</strong></div>
            <div className="detail-item"><span>Khách hàng</span><strong>{data.users.filter((account) => normalise(account.role) === 'CUSTOMER').length}</strong></div>
            <div className="detail-item"><span>Hồ sơ thú cưng</span><strong>{data.pets.length}</strong></div>
          </div>
        </section>
      </section>
    </>
  );

  const usersPage = (
    <>
      <div className="page-heading"><div><h1>Quản lý tài khoản</h1><p>Phân quyền và kiểm soát trạng thái đăng nhập của người dùng.</p></div></div>
      <section className="panel">
        <div className="toolbar"><div className="toolbar-group"><input className="search-input" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Tìm tên, email, số điện thoại…" /></div><span className="muted small">{users.length} tài khoản</span></div>
        {users.length === 0 ? <EmptyState icon="♙">Không tìm thấy tài khoản phù hợp.</EmptyState> : (
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Vai trò</th><th>Trạng thái</th></tr></thead><tbody>
            {users.map((account) => (
              <tr key={account.userId}>
                <td><strong>{account.fullName || account.userId}</strong><span className="muted small">{account.userId}</span></td>
                <td>{account.email || '—'}<br /><span className="muted small">{account.phone || 'Chưa có số điện thoại'}</span></td>
                <td><select value={normalise(account.role)} disabled={busyKey === `user-role-${account.userId}`} onChange={(event) => updateUserRole(account, event.target.value)} aria-label={`Vai trò của ${account.fullName || account.userId}`}><option value="CUSTOMER">Khách hàng</option><option value="STAFF">Nhân viên</option><option value="VET">Bác sĩ thú y</option><option value="ADMIN">Quản trị viên</option></select></td>
                <td><select value={normalise(account.status)} disabled={busyKey === `user-status-${account.userId}`} onChange={(event) => updateUserStatus(account, event.target.value)} aria-label={`Trạng thái của ${account.fullName || account.userId}`}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Ngưng hoạt động</option><option value="SUSPENDED">Tạm đình chỉ</option></select></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </>
  );

  const staffPage = (
    <>
      <div className="page-heading"><div><h1>Quản lý nhân sự</h1><p>Tạo, chỉnh sửa, kiểm soát vi phạm và trạng thái nhân viên/bác sĩ.</p></div><button type="button" className="button button-primary" onClick={startCreateStaff}>Thêm nhân sự</button></div>
      {staffEditorOpen && (
        <section className="panel">
          <div className="panel-heading"><h2>{staffEditingId ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự'}</h2><button type="button" onClick={() => setStaffEditorOpen(false)}>Đóng</button></div>
          <form className="form-grid" onSubmit={submitStaff}>
            {!staffEditingId && <label>Firebase UID<input required value={staffDraft.firebaseUid} onChange={(event) => setStaffDraft((current) => ({ ...current, firebaseUid: event.target.value }))} placeholder="UID từ Firebase Authentication" /></label>}
            <div className="form-row"><label>Họ và tên<input required value={staffDraft.fullName} onChange={(event) => setStaffDraft((current) => ({ ...current, fullName: event.target.value }))} /></label><label>Số điện thoại<input required value={staffDraft.phone} onChange={(event) => setStaffDraft((current) => ({ ...current, phone: event.target.value }))} /></label></div>
            {!staffEditingId && <label>Email<input required type="email" value={staffDraft.email} onChange={(event) => setStaffDraft((current) => ({ ...current, email: event.target.value }))} /></label>}
            <label>Vai trò<select value={staffDraft.role} onChange={(event) => setStaffDraft((current) => ({ ...current, role: event.target.value }))}><option value="STAFF">Nhân viên</option><option value="VET">Bác sĩ thú y</option></select></label>
            <div className="button-row"><button type="submit" className="button button-primary" disabled={Boolean(busyKey)}>{busyKey ? 'Đang lưu…' : staffEditingId ? 'Lưu thay đổi' : 'Tạo nhân sự'}</button><button type="button" className="button button-secondary" onClick={() => setStaffEditorOpen(false)}>Hủy</button></div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="toolbar"><div className="toolbar-group"><input className="search-input" value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} placeholder="Tìm nhân viên, bác sĩ…" /></div><span className="muted small">{staffList.length} nhân sự</span></div>
        {staffList.length === 0 ? <EmptyState icon="♟">Chưa có hồ sơ nhân sự phù hợp.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Nhân sự</th><th>Vai trò</th><th>Liên hệ</th><th>Vi phạm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {staffList.map((member) => {
            const isSuspended = normalise(member.status) === 'SUSPENDED';
            const isBusy = busyKey.includes(member.staffId);
            return <tr key={member.staffId}><td><strong>{member.fullName || member.staffId}</strong><span className="muted small">{member.staffId} · {member.userId}</span></td><td>{roleLabel(member.role)}</td><td>{member.email || '—'}<br /><span className="muted small">{member.phone || '—'}</span></td><td>{Number(member.violationCount || 0)}</td><td><StatusBadge status={member.status} kind="account" /></td><td><div className="action-buttons"><button type="button" className="button button-secondary button-small" onClick={() => startEditStaff(member)} disabled={isBusy}>Sửa</button><button type="button" className="button button-secondary button-small" onClick={() => addStaffViolation(member)} disabled={isBusy || isSuspended}>Ghi vi phạm</button>{isSuspended ? <button type="button" className="button button-primary button-small" onClick={() => activateStaff(member)} disabled={isBusy}>Kích hoạt</button> : <button type="button" className="button button-secondary button-small" onClick={() => toggleStaff(member)} disabled={isBusy}>{normalise(member.status) === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</button>}<button type="button" className="button button-danger button-small" onClick={() => deleteStaff(member)} disabled={isBusy}>Xóa</button></div></td></tr>;
          })}
        </tbody></table></div>}
      </section>
    </>
  );

  const servicesPage = (
    <>
      <div className="page-heading"><div><h1>Gói dịch vụ</h1><p>Tạo, điều chỉnh và bật/tắt các dịch vụ khách hàng có thể đặt.</p></div><button type="button" className="button button-primary" onClick={startCreateService}>Thêm dịch vụ</button></div>
      {serviceEditorOpen && <section className="panel"><div className="panel-heading"><h2>{serviceEditingId ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ'}</h2><button type="button" onClick={() => setServiceEditorOpen(false)}>Đóng</button></div><form className="form-grid" onSubmit={submitService}><label>Tên dịch vụ<input required value={serviceDraft.serviceName} onChange={(event) => setServiceDraft((current) => ({ ...current, serviceName: event.target.value }))} /></label><label>Mô tả<textarea required value={serviceDraft.description} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} /></label><div className="form-row"><label>Giá (₫)<input required min="1" type="number" value={serviceDraft.price} onChange={(event) => setServiceDraft((current) => ({ ...current, price: event.target.value }))} /></label><label>Thời lượng (phút)<input required min="1" type="number" value={serviceDraft.duration} onChange={(event) => setServiceDraft((current) => ({ ...current, duration: event.target.value }))} /></label></div><div className="form-row"><label>Mã danh mục<input required value={serviceDraft.categoryId} onChange={(event) => setServiceDraft((current) => ({ ...current, categoryId: event.target.value }))} placeholder="Ví dụ: CT001" /></label>{serviceEditingId && <label>Trạng thái<select value={serviceDraft.status} onChange={(event) => setServiceDraft((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Tạm ngưng</option></select></label>}</div><div className="button-row"><button type="submit" className="button button-primary" disabled={Boolean(busyKey)}>{busyKey ? 'Đang lưu…' : serviceEditingId ? 'Lưu thay đổi' : 'Tạo dịch vụ'}</button><button type="button" className="button button-secondary" onClick={() => setServiceEditorOpen(false)}>Hủy</button></div></form></section>}
      <section className="panel"><div className="toolbar"><div className="toolbar-group"><input className="search-input" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Tìm tên, mã, danh mục…" /></div><span className="muted small">{services.length} gói dịch vụ</span></div>{services.length === 0 ? <EmptyState icon="✦">Chưa có gói dịch vụ phù hợp.</EmptyState> : <div className="service-grid">{services.map((service) => { const isBusy = busyKey.includes(service.serviceId); return <article className="service-card" key={service.serviceId}><div className="service-card-body"><div className="panel-heading"><h3>{service.serviceName || service.serviceId}</h3><StatusBadge status={service.status} kind="account" /></div><p>{service.description || 'Chưa có mô tả'}</p><div className="pet-meta"><span className="badge">{service.categoryId || 'Chưa phân loại'}</span><span className="badge">{service.duration || 0} phút</span></div><p className="price">{currency(service.price)}</p><div className="action-buttons"><button type="button" className="button button-secondary button-small" onClick={() => startEditService(service)} disabled={isBusy}>Sửa</button><button type="button" className="button button-secondary button-small" onClick={() => toggleService(service)} disabled={isBusy}>{normalise(service.status) === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</button><button type="button" className="button button-danger button-small" onClick={() => deleteService(service)} disabled={isBusy}>Xóa</button></div></div></article>; })}</div>}</section>
    </>
  );

  const bookingsPage = (
    <>
      <div className="page-heading"><div><h1>Toàn bộ lịch hẹn</h1><p>Tra cứu lịch, khách hàng, thú cưng, dịch vụ và giao dịch liên quan.</p></div></div>
      <section className="panel">{data.bookings.length === 0 ? <EmptyState icon="▣">Chưa có lịch hẹn.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Mã lịch</th><th>Khách hàng</th><th>Thú cưng & dịch vụ</th><th>Thời gian</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead><tbody>{[...data.bookings].sort((a, b) => String(b.bookingDate || '').localeCompare(String(a.bookingDate || ''))).map((booking) => { const account = userById.get(booking.userId); const pet = petById.get(booking.petId); const detail = bookingDetailById.get(booking.bookingId); const service = detail ? serviceById.get(detail.serviceId) : null; const payment = paymentByBookingId.get(booking.bookingId); return <tr key={booking.bookingId}><td><strong>{booking.bookingId}</strong><span className="muted small">{currency(booking.totalAmount)}</span></td><td>{account?.fullName || booking.userId}<br /><span className="muted small">{account?.email || ''}</span></td><td><strong>{pet?.petName || booking.petId}</strong><br /><span className="muted small">{service?.serviceName || detail?.serviceId || booking.careTypeId || '—'}</span></td><td>{displayDate(booking.bookingDate)}<br /><span className="muted small">{String(booking.bookingTime || '').slice(0, 5)}</span></td><td>{payment ? <><span>{paymentMethodLabel(payment.method)}</span><br /><StatusBadge status={payment.status} kind="payment" /></> : <span className="muted">Chưa có</span>}</td><td><StatusBadge status={booking.status} /></td></tr>; })}</tbody></table></div>}</section>
    </>
  );

  const pageByTab = {
    overview,
    users: usersPage,
    staff: staffPage,
    services: servicesPage,
    bookings: bookingsPage,
  };

  return (
    <PortalShell
      user={user}
      onLogout={onLogout}
      title="Quản trị PetNoVa"
      subtitle="Quản lý vận hành, nhân sự, tài khoản và danh mục dịch vụ."
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRefresh={() => loadAll()}
    >
      <Notice error={notice && /^(Không thể|Lỗi)/i.test(notice)}>{notice}</Notice>
      {loading ? <LoadingState label="Đang tải dữ liệu quản trị…" /> : error ? <><ErrorState error={error} onRetry={() => loadAll()} />{pageByTab[activeTab]}</> : pageByTab[activeTab]}
    </PortalShell>
  );
}
