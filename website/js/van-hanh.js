import { api } from "./api.js";
import { baoVeTrang, taiHoSo } from "./xac-thuc.js";
import {
  batDieuHuong,
  chuyenTrang,
  gio,
  h,
  homNay,
  id,
  luaChon,
  ngay,
  nhan,
  thaoTac,
  thongBao,
  tien,
  taiTatCaLich,
} from "./chung.js";
import { caiDatTaiKhoan } from "./tai-khoan.js";

const role = document.body.dataset.role;
const $ = (selector) => document.querySelector(selector);
const empty = (message) => `<div class="rong">${h(message)}</div>`;
let profile, staffMe;
let bookings = [],
  payments = [],
  pets = [],
  customers = [],
  services = [],
  categories = [],
  staff = [],
  users = [],
  notifications = [];
let auditPage = 0;
const petName = (petId) =>
  pets.find((p) => p.petId === petId)?.petName || petId;
const customerName = (userId) =>
  customers.find((c) => c.userId === userId)?.fullName ||
  users.find((u) => u.userId === userId)?.fullName ||
  userId;
const staffName = (staffId) =>
  staff.find((s) => s.staffId === staffId)?.fullName ||
  staffId ||
  "Chưa phân công";

async function load() {
  const jobs = [
    taiTatCaLich(api),
    api.get("/api/Payments"),
    api.get("/api/Pets"),
    api.get("/api/ServicePackages"),
    api.get(`/api/Notifications/user/${id(profile.userId)}`),
  ];
  jobs.push(
    api.get("/api/UserAccounts/contacts"),
    api.get("/api/Staffs/directory"),
  );
  if (role === "ADMIN")
    jobs.push(
      api.get("/api/UserAccounts"),
      api.get("/api/Staffs"),
      api.get("/api/ServiceCategories"),
    );
  const values = await Promise.all(jobs);
  [bookings, payments, pets, services, notifications] = values;
  [customers, staff] = values.slice(5, 7);
  if (role === "ADMIN") [users, staff, categories] = values.slice(7, 10);
  render();
}

function render() {
  $("#so-lieu").innerHTML =
    `<div class="card"><h3>${bookings.length}</h3><p>Lịch hẹn hiển thị</p></div><div class="card"><h3>${bookings.filter((b) => b.status === "PENDING").length}</h3><p>Đang chờ xác nhận</p></div><div class="card"><h3>${pets.length}</h3><p>Thú cưng có quyền xem</p></div>`;
  $("#danh-sach-lich").innerHTML =
    bookings
      .filter(
        (b) => !$("#loc-lich")?.value || b.status === $("#loc-lich").value,
      )
      .map(bookingCard)
      .join("") || empty("Không có lịch hẹn.");
  if ($("#danh-sach-thanh-toan"))
    $("#danh-sach-thanh-toan").innerHTML =
      payments.map(paymentCard).join("") || empty("Chưa có giao dịch.");
  if ($("#danh-sach-khach")) renderCustomers();
  if ($("#danh-sach-nguoi-dung")) renderUsers();
  if ($("#danh-sach-nhan-su"))
    $("#danh-sach-nhan-su").innerHTML =
      staff
        .map(
          (s) =>
            `<article class="dong"><div><strong>${h(s.fullName)} · ${h(s.staffId)}</strong><p>${h(s.role)} · ${h(s.email)} · ${h(s.phone)}</p>${nhan(s.status)} <small class="nho">Vi phạm: ${h(s.violationCount)}</small></div><div class="hang"><button class="nut nut-phu nut-nho" data-staff-edit="${h(s.staffId)}">Sửa</button><button class="nut nut-phu nut-nho" data-staff-toggle="${h(s.staffId)}">${s.status === "ACTIVE" ? "Tạm khóa" : "Đổi trạng thái"}</button><button class="nut nut-phu nut-nho" data-staff-violation="${h(s.staffId)}">Ghi vi phạm</button>${s.status === "SUSPENDED" ? `<button class="nut nut-phu nut-nho" data-staff-activate="${h(s.staffId)}">Kích hoạt lại</button>` : ""}<button class="nut nut-nguy-hiem nut-nho" data-staff-delete="${h(s.staffId)}">Xóa nếu chưa có lịch sử</button></div></article>`,
        )
        .join("") || empty("Chưa có nhân sự.");
  $("#danh-sach-dich-vu").innerHTML =
    services
      .map(
        (s) =>
          `<article class="dong"><div><strong>${h(s.serviceName)}</strong><p>${h(s.description)} · ${tien(s.price)} · ${h(s.duration)} phút</p>${nhan(s.status)}</div>${role === "ADMIN" ? `<div class="hang"><button class="nut nut-phu nut-nho" data-service-edit="${h(s.serviceId)}">Sửa</button><button class="nut nut-phu nut-nho" data-service-toggle="${h(s.serviceId)}">Bật/tắt</button><button class="nut nut-nguy-hiem nut-nho" data-service-delete="${h(s.serviceId)}">Xóa</button></div>` : ""}</article>`,
      )
      .join("") || empty("Chưa có dịch vụ.");
  if ($("#danh-sach-danh-muc"))
    $("#danh-sach-danh-muc").innerHTML =
      categories
        .map(
          (c) =>
            `<article class="dong"><div><strong>${h(c.categoryName)}</strong><p>${h(c.description)}</p>${nhan(c.status)}</div><div class="hang"><button class="nut nut-phu nut-nho" data-category-edit="${h(c.categoryId)}">Sửa</button><button class="nut nut-phu nut-nho" data-category-toggle="${h(c.categoryId)}">${c.status === "ACTIVE" ? "Tạm ẩn" : "Hiện lại"}</button></div></article>`,
        )
        .join("") || empty("Chưa có danh mục.");
  $("#danh-sach-thong-bao").innerHTML =
    notifications
      .map(
        (n) =>
          `<article class="dong"><div><strong>${h(n.title)}${n.isRead ? "" : " ●"}</strong><p>${h(n.message)}</p><small class="nho">${ngay(n.createdAt)}</small></div>${n.isRead ? "" : `<button class="nut nut-phu nut-nho" data-read="${h(n.notificationId)}">Đã đọc</button>`}</article>`,
      )
      .join("") || empty("Chưa có thông báo.");
  if ($("#chon-thu-suc-khoe")) {
    const selected = $("#chon-thu-suc-khoe").value;
    $("#chon-thu-suc-khoe").innerHTML =
      `<option value="">Chọn thú cưng</option>${luaChon(
        pets,
        selected,
        (p) => p.petName,
        (p) => p.petId,
      )}`;
  }
  if (role === "ADMIN") {
    $("#form-dich-vu").categoryId.innerHTML =
      `<option value="">Chọn danh mục</option>${luaChon(
        categories.filter((c) => c.status === "ACTIVE"),
        "",
        (c) => c.categoryName,
        (c) => c.categoryId,
      )}`;
    $("#form-phat-thong-bao").userId.innerHTML =
      `<option value="">Tất cả tài khoản đang hoạt động</option>${luaChon(
        users,
        "",
        (u) => `${u.fullName} (${u.email})`,
        (u) => u.userId,
      )}`;
  }
}

function bookingCard(b) {
  const action =
    role !== "VET" && b.status === "PENDING"
      ? `<button class="nut nut-nho" data-book-status="${h(b.bookingId)}" data-next="CONFIRMED">Xác nhận</button>`
      : role !== "VET" && b.status === "CONFIRMED"
        ? `<button class="nut nut-nho" data-book-status="${h(b.bookingId)}" data-next="IN_PROGRESS">Bắt đầu</button>`
        : role !== "VET" && b.status === "IN_PROGRESS"
          ? `<button class="nut nut-nho" data-book-status="${h(b.bookingId)}" data-next="COMPLETED">Hoàn thành</button>`
          : "";
  return `<article class="dong"><div><strong>${h(b.bookingId)} · ${h(petName(b.petId))}</strong><p>${ngay(b.bookingDate)} ${gio(b.bookingTime)} · ${tien(b.totalAmount)}</p><small class="nho">Khách: ${h(customerName(b.userId))} · Phụ trách: ${h(staffName(b.staffId))}</small><br>${nhan(b.status)} ${b.note ? `<small>${h(b.note)}</small>` : ""}</div><div class="hang">${action}${role !== "VET" && !["CANCELLED", "COMPLETED"].includes(b.status) ? `<button class="nut nut-phu nut-nho" data-book-assign="${h(b.bookingId)}">Phân công</button>` : ""}${role !== "VET" && ["PENDING", "CONFIRMED"].includes(b.status) ? `<button class="nut nut-phu nut-nho" data-book-reschedule="${h(b.bookingId)}">Đổi lịch</button><button class="nut nut-nguy-hiem nut-nho" data-book-cancel="${h(b.bookingId)}">Hủy</button>` : ""}<button class="nut nut-phu nut-nho" data-book-details="${h(b.bookingId)}">Dịch vụ</button></div></article>`;
}

function paymentCard(p) {
  return `<article class="dong"><div><strong>${h(p.paymentId)} · Lịch ${h(p.bookingId)}</strong><p>${tien(p.amount)} · ${p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</p>${nhan(p.status, "payment")}${p.refundReason ? `<p class="nho">Lý do hoàn: ${h(p.refundReason)} · ${h(p.refundReference)}</p>` : ""}</div><div class="hang">${p.status === "PENDING" && p.method === "CASH" ? `<button class="nut nut-nho" data-payment-confirm="${h(p.paymentId)}">Xác nhận đã thu</button>` : ""}${p.status === "PENDING" && p.method === "BANK_TRANSFER" ? `<button class="nut nut-phu nut-nho" data-payment-sync="${h(p.paymentId)}">Đồng bộ PayOS</button>` : ""}${p.status === "PAID" && role === "ADMIN" ? `<button class="nut nut-phu nut-nho" data-payment-refund="${h(p.paymentId)}">Ghi nhận hoàn tiền</button>` : ""}</div></article>`;
}

function renderCustomers() {
  const term = $("#tim-khach").value.toLowerCase();
  $("#danh-sach-khach").innerHTML =
    customers
      .filter((c) =>
        `${c.fullName} ${c.phone} ${c.email}`.toLowerCase().includes(term),
      )
      .map(
        (c) =>
          `<article class="dong"><div><strong>${h(c.fullName)}</strong><p>${h(c.phone)} · ${h(c.email)}</p><small class="nho">Thú cưng: ${h(
            pets
              .filter((p) => p.userId === c.userId)
              .map((p) => p.petName)
              .join(", ") || "Chưa có",
          )}</small></div></article>`,
      )
      .join("") || empty("Không tìm thấy khách hàng.");
}
function renderUsers() {
  const term = $("#tim-nguoi-dung").value.toLowerCase();
  $("#danh-sach-nguoi-dung").innerHTML =
    users
      .filter((u) => `${u.fullName} ${u.email}`.toLowerCase().includes(term))
      .map(
        (u) =>
          `<article class="dong"><div><strong>${h(u.fullName)} · ${h(u.userId)}</strong><p>${h(u.email)} · ${h(u.phone)}</p><small>${h(u.role)} · ${h(u.status)}</small></div><div class="hang"><button class="nut nut-phu nut-nho" data-user-status="${h(u.userId)}">Đổi trạng thái</button><button class="nut nut-phu nut-nho" data-user-role="${h(u.userId)}">Đổi vai trò</button></div></article>`,
      )
      .join("") || empty("Không tìm thấy tài khoản.");
}

async function loadHealth() {
  const petId = $("#chon-thu-suc-khoe").value;
  if (!petId) {
    $("#benh-an").innerHTML = empty("Hãy chọn thú cưng.");
    $("#tiem-chung").innerHTML = "";
    return;
  }
  const [records, vaccines] = await Promise.all([
    api.get(`/api/MedicalRecords/pet/${id(petId)}`),
    api.get(`/api/Vaccinations/pet/${id(petId)}`),
  ]);
  $("#benh-an").innerHTML =
    records
      .map(
        (r) =>
          `<article class="dong"><div><strong>${h(r.diagnosis)}</strong><p>${h(r.treatment)}</p><small class="nho">${ngay(r.recordDate)} · ${h(r.prescription || "")}</small></div><button class="nut nut-phu nut-nho" data-record-edit="${h(r.recordId)}">Sửa</button></article>`,
      )
      .join("") || empty("Chưa có bệnh án.");
  $("#tiem-chung").innerHTML =
    vaccines
      .map(
        (v) =>
          `<article class="dong"><div><strong>${h(v.vaccineName)}</strong><p>Đã tiêm ${ngay(v.vaccinationDate)} · Nhắc ${ngay(v.nextDate)}</p></div><button class="nut nut-phu nut-nho" data-vaccine-edit="${h(v.vaccinationId)}">Sửa</button></article>`,
      )
      .join("") || empty("Chưa có mũi tiêm.");
  window.healthRecords = records;
  window.healthVaccines = vaccines;
}

async function loadReport() {
  const form = $("#form-bao-cao");
  const query = new URLSearchParams();
  if (form.from.value) query.set("from", form.from.value);
  if (form.to.value) query.set("to", form.to.value);
  const data = await api.get(`/api/Reports?${query}`);
  $("#so-lieu").innerHTML =
    `<div class="card"><h3>${h(data.bookings)}</h3><p>Lịch hẹn</p></div><div class="card"><h3>${h(data.completed)}</h3><p>Hoàn thành</p></div><div class="card"><h3>${tien(data.netCollected)}</h3><p>Thực thu</p></div><div class="card"><h3>${tien(data.refundAmount)}</h3><p>Hoàn tiền</p></div>`;
  $("#bao-cao-chi-tiet").textContent =
    `Từ ${data.from} đến ${data.to}\n\nTheo ngày:\n${data.byDay.map((row) => `${row.date}: ${row.bookings} lịch, ${row.completed} hoàn thành, ${tien(row.bookedAmount)}`).join("\n") || "Chưa có dữ liệu"}\n\nTheo dịch vụ:\n${data.byService.map((row) => `${row.serviceName}: ${row.quantity} lượt, ${tien(row.bookedAmount)}`).join("\n") || "Chưa có dữ liệu"}`;
}

async function loadAudit() {
  const rows = await api.get(`/api/AuditLogs?page=${auditPage + 1}`);
  auditPage += 1;
  $("#danh-sach-nhat-ky").insertAdjacentHTML(
    "beforeend",
    rows
      .map(
        (a) =>
          `<article class="dong"><div><strong>${h(a.action || "Hoạt động")} · ${h(a.actorName || a.userId)}</strong><p>${h(a.targetId || "")}</p><small class="nho">${h(a.createdAt)}</small></div></article>`,
      )
      .join(""),
  );
  $("#tai-them-nhat-ky").hidden = rows.length < 100;
}

$("#loc-lich")?.addEventListener("change", render);
$("#tim-khach")?.addEventListener("input", renderCustomers);
$("#tim-nguoi-dung")?.addEventListener("input", renderUsers);
$("#chon-thu-suc-khoe")?.addEventListener("change", () =>
  loadHealth().catch((e) => thongBao(e.message, true)),
);
$("#form-benh-an")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const petId = $("#chon-thu-suc-khoe").value;
  if (!petId) {
    thongBao("Hãy chọn thú cưng.", true);
    return;
  }
  const body = {
    petId,
    staffId: staffMe.staffId,
    diagnosis: form.diagnosis.value,
    treatment: form.treatment.value,
    prescription: form.prescription.value,
    weight: form.weight.value ? Number(form.weight.value) : null,
    followUpDate: form.followUpDate.value || null,
    note: form.note.value,
  };
  const ok = await thaoTac(
    form.querySelector("button"),
    () => api.post("/api/MedicalRecords", body),
    "Đã ghi bệnh án.",
  );
  if (ok) {
    form.reset();
    await loadHealth();
  }
});
$("#form-tiem-chung")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const petId = $("#chon-thu-suc-khoe").value;
  if (!petId) {
    thongBao("Hãy chọn thú cưng.", true);
    return;
  }
  const body = {
    petId,
    staffId: staffMe.staffId,
    vaccineName: form.vaccineName.value,
    vaccinationDate: form.vaccinationDate.value,
    nextDate: form.nextDate.value,
    note: form.note.value,
  };
  const ok = await thaoTac(
    form.querySelector("button"),
    () => api.post("/api/Vaccinations", body),
    "Đã ghi mũi tiêm.",
  );
  if (ok) {
    form.reset();
    await loadHealth();
  }
});
$("#form-bao-cao")?.addEventListener("submit", (event) => {
  event.preventDefault();
  thaoTac(event.currentTarget.querySelector("button"), loadReport);
});
$("#tai-them-nhat-ky")?.addEventListener("click", (event) =>
  thaoTac(event.currentTarget, loadAudit),
);
$("#form-nhan-su")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = {
    fullName: form.fullName.value,
    email: form.email.value,
    phone: form.phone.value,
    password: form.password.value,
    role: form.role.value,
  };
  const ok = await thaoTac(
    form.querySelector("button"),
    () => api.post("/api/Staffs", body),
    "Đã tạo nhân sự.",
  );
  if (ok) {
    form.reset();
    await load();
  }
});
$("#form-dich-vu")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = {
    serviceId: form.serviceId.value,
    serviceName: form.serviceName.value,
    description: form.description.value,
    price: Number(form.price.value),
    duration: Number(form.duration.value),
    categoryId: form.categoryId.value,
    status:
      services.find((s) => s.serviceId === form.serviceId.value)?.status ||
      "ACTIVE",
  };
  const ok = await thaoTac(
    form.querySelector("button[type=submit]"),
    () =>
      body.serviceId
        ? api.put(`/api/ServicePackages/${id(body.serviceId)}`, body)
        : api.post("/api/ServicePackages", body),
    "Đã lưu dịch vụ.",
  );
  if (ok) {
    form.reset();
    $("#huy-sua-dich-vu").hidden = true;
    await load();
  }
});
$("#huy-sua-dich-vu")?.addEventListener("click", () => {
  $("#form-dich-vu").reset();
  $("#huy-sua-dich-vu").hidden = true;
});
$("#form-danh-muc")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const old = categories.find((c) => c.categoryId === form.categoryId.value);
  const body = {
    categoryId: form.categoryId.value,
    categoryName: form.categoryName.value,
    description: form.description.value,
    status: old?.status || "ACTIVE",
  };
  const ok = await thaoTac(
    form.querySelector("button[type=submit]"),
    () =>
      body.categoryId
        ? api.put(`/api/ServiceCategories/${id(body.categoryId)}`, body)
        : api.post("/api/ServiceCategories", body),
    "Đã lưu danh mục.",
  );
  if (ok) {
    form.reset();
    $("#huy-sua-danh-muc").hidden = true;
    await load();
  }
});
$("#huy-sua-danh-muc")?.addEventListener("click", () => {
  $("#form-danh-muc").reset();
  $("#huy-sua-danh-muc").hidden = true;
});
$("#form-phat-thong-bao")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = {
    title: form.title.value,
    message: form.message.value,
    userId: form.userId.value || null,
  };
  if (
    !body.userId &&
    !confirm("Gửi thông báo tới toàn bộ tài khoản đang hoạt động?")
  )
    return;
  const ok = await thaoTac(
    form.querySelector("button"),
    () =>
      api.post(
        body.userId ? "/api/Notifications" : "/api/Notifications/broadcast",
        body,
      ),
    "Đã gửi thông báo.",
  );
  if (ok) {
    form.reset();
    await load();
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest(
    "button[data-book-status],button[data-book-assign],button[data-book-reschedule],button[data-book-cancel],button[data-book-details],button[data-payment-confirm],button[data-payment-sync],button[data-payment-refund],button[data-user-status],button[data-user-role],button[data-staff-edit],button[data-staff-toggle],button[data-staff-violation],button[data-staff-activate],button[data-staff-delete],button[data-service-edit],button[data-service-toggle],button[data-service-delete],button[data-category-edit],button[data-category-toggle],button[data-record-edit],button[data-vaccine-edit],button[data-read]",
  );
  if (!button) return;
  const d = button.dataset;
  if (d.bookStatus)
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Bookings/${id(d.bookStatus)}/status`, {
          status: d.next,
        });
        await load();
      },
      "Đã cập nhật lịch.",
    );
  else if (d.bookAssign) {
    const choice = prompt(
      `Nhập mã nhân sự:\n${staff.map((s) => `${s.staffId}: ${s.fullName}`).join("\n")}`,
    );
    if (!choice) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Bookings/${id(d.bookAssign)}/assign`, {
          staffId: choice.trim(),
        });
        await load();
      },
      "Đã phân công.",
    );
  } else if (d.bookDetails) {
    await thaoTac(button, async () => {
      const rows = await api.get(
        `/api/BookingDetails/booking/${id(d.bookDetails)}`,
      );
      alert(
        rows
          .map(
            (r) =>
              `${services.find((s) => s.serviceId === r.serviceId)?.serviceName || r.serviceId}: ${tien(r.price)}`,
          )
          .join("\n") || "Không có chi tiết.",
      );
    });
  } else if (d.bookReschedule) {
    const b = bookings.find((item) => item.bookingId === d.bookReschedule);
    const date = prompt(
      "Ngày mới (YYYY-MM-DD):",
      String(b.bookingDate).slice(0, 10),
    );
    if (date === null) return;
    const time = prompt("Giờ mới (HH:MM):", gio(b.bookingTime));
    if (time === null) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Bookings/${id(b.bookingId)}/reschedule`, {
          bookingDate: date,
          bookingTime: `${time}:00`,
          staffId: b.staffId,
          note: b.note,
        });
        await load();
      },
      "Đã đổi lịch.",
    );
  } else if (d.bookCancel) {
    if (
      confirm("Hủy lịch hẹn này? Lịch đã thanh toán phải được hoàn tiền trước.")
    )
      await thaoTac(
        button,
        async () => {
          await api.put(`/api/Bookings/${id(d.bookCancel)}/cancel`);
          await load();
        },
        "Đã hủy lịch.",
      );
  } else if (d.paymentConfirm) {
    if (confirm("Đã thực nhận tiền mặt cho giao dịch này?"))
      await thaoTac(
        button,
        async () => {
          await api.put(`/api/Payments/${id(d.paymentConfirm)}/confirm`);
          await load();
        },
        "Đã xác nhận thanh toán.",
      );
  } else if (d.paymentSync)
    await thaoTac(
      button,
      async () => {
        await api.post(`/api/Payments/${id(d.paymentSync)}/payos-sync`);
        await load();
      },
      "Đã đồng bộ PayOS.",
    );
  else if (d.paymentRefund) {
    const reason = prompt(
      "Lý do hoàn tiền (chỉ ghi sau khi đã chuyển tiền thực tế):",
    );
    if (!reason) return;
    const reference = prompt("Mã tham chiếu giao dịch hoàn tiền thực tế:");
    if (!reference) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Payments/${id(d.paymentRefund)}/refund`, {
          reason,
          reference,
        });
        await load();
      },
      "Đã ghi nhận khoản hoàn tiền.",
    );
  } else if (d.userStatus) {
    const u = users.find((item) => item.userId === d.userStatus);
    const status = prompt(
      "Trạng thái mới: ACTIVE, INACTIVE hoặc SUSPENDED",
      u.status,
    );
    if (!status) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/UserAccounts/${id(u.userId)}/status`, {
          status: status.toUpperCase(),
        });
        await load();
      },
      "Đã đổi trạng thái.",
    );
  } else if (d.userRole) {
    const u = users.find((item) => item.userId === d.userRole);
    const newRole = prompt(
      "Vai trò mới: CUSTOMER, STAFF, VET hoặc ADMIN",
      u.role,
    );
    if (!newRole) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/UserAccounts/${id(u.userId)}/role`, {
          role: newRole.toUpperCase(),
        });
        await load();
      },
      "Đã đổi vai trò.",
    );
  } else if (d.staffEdit) {
    const s = staff.find((item) => item.staffId === d.staffEdit);
    const fullName = prompt("Họ tên:", s.fullName);
    if (!fullName) return;
    const phone = prompt("Điện thoại:", s.phone);
    if (!phone) return;
    const nextRole = prompt("Vai trò (STAFF hoặc VET):", s.role);
    if (!nextRole) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Staffs/${id(s.staffId)}`, {
          fullName,
          phone,
          role: nextRole.toUpperCase(),
        });
        await load();
      },
      "Đã sửa nhân sự.",
    );
  } else if (d.staffToggle)
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Staffs/${id(d.staffToggle)}/toggle-status`);
        await load();
      },
      "Đã đổi trạng thái nhân sự.",
    );
  else if (d.staffViolation) {
    if (confirm("Ghi thêm một vi phạm cho nhân sự này?"))
      await thaoTac(
        button,
        async () => {
          await api.put(`/api/Staffs/${id(d.staffViolation)}/add-violation`);
          await load();
        },
        "Đã ghi vi phạm.",
      );
  } else if (d.staffActivate)
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Staffs/${id(d.staffActivate)}/activate`);
        await load();
      },
      "Đã kích hoạt lại nhân sự.",
    );
  else if (d.staffDelete) {
    if (
      confirm("Xóa nhân sự chưa có lịch sử? Thao tác này không thể hoàn tác.")
    )
      await thaoTac(
        button,
        async () => {
          await api.del(`/api/Staffs/${id(d.staffDelete)}`);
          await load();
        },
        "Đã xóa nhân sự.",
      );
  } else if (d.serviceEdit) {
    const s = services.find((item) => item.serviceId === d.serviceEdit);
    const form = $("#form-dich-vu");
    for (const key of [
      "serviceId",
      "serviceName",
      "description",
      "price",
      "duration",
      "categoryId",
    ])
      form[key].value = s[key];
    $("#huy-sua-dich-vu").hidden = false;
    chuyenTrang("dich-vu");
    form.serviceName.focus();
  } else if (d.serviceToggle)
    await thaoTac(
      button,
      async () => {
        await api.put(
          `/api/ServicePackages/${id(d.serviceToggle)}/toggle-status`,
        );
        await load();
      },
      "Đã đổi trạng thái dịch vụ.",
    );
  else if (d.serviceDelete) {
    if (confirm("Xóa dịch vụ chưa có lịch sử đặt?"))
      await thaoTac(
        button,
        async () => {
          await api.del(`/api/ServicePackages/${id(d.serviceDelete)}`);
          await load();
        },
        "Đã xóa dịch vụ.",
      );
  } else if (d.categoryEdit) {
    const c = categories.find((item) => item.categoryId === d.categoryEdit);
    const form = $("#form-danh-muc");
    for (const key of ["categoryId", "categoryName", "description"])
      form[key].value = c[key];
    $("#huy-sua-danh-muc").hidden = false;
    chuyenTrang("danh-muc");
    form.categoryName.focus();
  } else if (d.categoryToggle) {
    const c = categories.find((item) => item.categoryId === d.categoryToggle);
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/ServiceCategories/${id(c.categoryId)}`, {
          ...c,
          status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        });
        await load();
      },
      "Đã đổi trạng thái danh mục.",
    );
  } else if (d.recordEdit) {
    const r = window.healthRecords.find(
      (item) => item.recordId === d.recordEdit,
    );
    const diagnosis = prompt("Chẩn đoán:", r.diagnosis);
    if (!diagnosis) return;
    const treatment = prompt("Điều trị:", r.treatment);
    if (!treatment) return;
    const correctionReason = prompt("Lý do chỉnh sửa (bắt buộc):");
    if (!correctionReason) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/MedicalRecords/${id(r.recordId)}`, {
          diagnosis,
          treatment,
          note: r.note,
          prescription: r.prescription,
          weight: r.weight,
          followUpDate: r.followUpDate,
          correctionReason,
        });
        await loadHealth();
      },
      "Đã sửa bệnh án và ghi lịch sử chỉnh sửa.",
    );
  } else if (d.vaccineEdit) {
    const v = window.healthVaccines.find(
      (item) => item.vaccinationId === d.vaccineEdit,
    );
    const vaccineName = prompt("Tên vaccine:", v.vaccineName);
    if (!vaccineName) return;
    const nextDate = prompt(
      "Ngày nhắc lại (YYYY-MM-DD):",
      String(v.nextDate).slice(0, 10),
    );
    if (!nextDate) return;
    const correctionReason = prompt("Lý do chỉnh sửa (bắt buộc):");
    if (!correctionReason) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Vaccinations/${id(v.vaccinationId)}`, {
          vaccineName,
          vaccinationDate: v.vaccinationDate,
          nextDate,
          note: v.note,
          correctionReason,
        });
        await loadHealth();
      },
      "Đã sửa mũi tiêm và ghi lịch sử chỉnh sửa.",
    );
  } else if (d.read)
    await thaoTac(button, async () => {
      await api.put(`/api/Notifications/${id(d.read)}/read`);
      await load();
    });
});

profile = await baoVeTrang(role);
if (profile) {
  $("#noi-dung").hidden = false;
  batDieuHuong();
  if (role === "VET") {
    try {
      staffMe = await api.get("/api/Staffs/me");
    } catch (error) {
      thongBao(error.message, true);
    }
    $("#form-tiem-chung").vaccinationDate.max = homNay();
    $("#form-benh-an").followUpDate.min = homNay();
  }
  try {
    await load();
    if (role === "ADMIN") {
      await loadReport();
      await loadAudit();
    }
    caiDatTaiKhoan(profile, async () => {
      profile = await taiHoSo();
      caiDatTaiKhoan(profile, () => location.reload());
    });
  } catch (error) {
    thongBao(error.message, true);
  }
}
