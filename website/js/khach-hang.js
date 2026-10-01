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
  maYeuCau,
  ngay,
  nhan,
  thaoTac,
  thongBao,
  tien,
} from "./chung.js";
import { caiDatTaiKhoan } from "./tai-khoan.js";

let profile;
let pets = [],
  bookings = [],
  services = [],
  careTypes = [],
  staff = [],
  payments = [],
  notifications = [];
const $ = (selector) => document.querySelector(selector);
const empty = (text) => `<div class="rong">${h(text)}</div>`;
const petName = (key) => pets.find((pet) => pet.petId === key)?.petName || key;

function render() {
  $("#so-lieu").innerHTML =
    `<div class="card"><h3>${pets.length}</h3><p>Thú cưng</p></div><div class="card"><h3>${bookings.filter((b) => !["COMPLETED", "CANCELLED"].includes(b.status)).length}</h3><p>Lịch đang xử lý</p></div><div class="card"><h3>${notifications.filter((n) => !n.isRead).length}</h3><p>Thông báo chưa đọc</p></div>`;
  $("#lich-gan-day").innerHTML =
    bookings.slice(0, 3).map(bookingCard).join("") ||
    empty("Bạn chưa có lịch hẹn.");
  $("#danh-sach-thu").innerHTML =
    pets
      .map(
        (pet) =>
          `<article class="dong"><div class="hang">${pet.imageUrl ? `<img class="anh-thu" src="${h(pet.imageUrl)}" alt="${h(pet.petName)}">` : ""}<div><strong>${h(pet.petName)}</strong><span class="nho">${h(pet.species)} · ${h(pet.breed)} · ${h(pet.weight)} kg</span><p class="nho">${h(pet.healthStatus || "Chưa ghi tình trạng")}</p></div></div><div class="hang"><button class="nut nut-phu nut-nho" data-pet-edit="${h(pet.petId)}">Sửa</button><button class="nut nut-phu nut-nho" data-pet-photo="${h(pet.petId)}">Ảnh</button><button class="nut nut-nguy-hiem nut-nho" data-pet-archive="${h(pet.petId)}">Lưu trữ</button></div></article>`,
      )
      .join("") || empty("Chưa có thú cưng. Hãy thêm bé đầu tiên.");
  $("#form-dat-lich").petId.innerHTML =
    `<option value="">Chọn thú cưng</option>${luaChon(
      pets,
      "",
      (p) => p.petName,
      (p) => p.petId,
    )}`;
  $("#form-dat-lich").careTypeId.innerHTML = luaChon(
    careTypes,
    "",
    (c) => c.typeName,
    (c) => c.careTypeId,
  );
  $("#form-dat-lich").staffId.innerHTML =
    `<option value="">Để PetNoVa phân công</option>${luaChon(
      staff,
      "",
      (s) => `${s.fullName} (${s.role === "VET" ? "Bác sĩ" : "Nhân viên"})`,
      (s) => s.staffId,
    )}`;
  $("#chon-dich-vu").innerHTML =
    services
      .filter((s) => s.status === "ACTIVE")
      .map(
        (s) =>
          `<label><input type="checkbox" value="${h(s.serviceId)}"><span><strong>${h(s.serviceName)}</strong><br><small>${tien(s.price)} · ${h(s.duration)} phút</small></span></label>`,
      )
      .join("") || empty("Chưa có dịch vụ đang hoạt động.");
  const selectedPet = $("#chon-thu-suc-khoe").value;
  $("#chon-thu-suc-khoe").innerHTML =
    `<option value="">Chọn thú cưng</option>${luaChon(
      pets,
      selectedPet,
      (p) => p.petName,
      (p) => p.petId,
    )}`;
  $("#danh-sach-lich").innerHTML =
    bookings.map(bookingCard).join("") || empty("Chưa có lịch hẹn.");
  $("#danh-sach-thanh-toan").innerHTML =
    payments.map(paymentCard).join("") || empty("Chưa có thanh toán.");
  $("#danh-sach-thong-bao").innerHTML =
    notifications
      .map(
        (n) =>
          `<article class="dong"><div><strong>${h(n.title)} ${n.isRead ? "" : "●"}</strong><p>${h(n.message)}</p><small class="nho">${ngay(n.createdAt)}</small></div>${n.isRead ? "" : `<button class="nut nut-phu nut-nho" data-read="${h(n.notificationId)}">Đã đọc</button>`}</article>`,
      )
      .join("") || empty("Chưa có thông báo.");
  capNhatTien();
}

function bookingCard(b) {
  const canEdit = ["PENDING", "CONFIRMED"].includes(b.status);
  return `<article class="dong"><div><strong>${h(b.bookingId)} · ${h(petName(b.petId))}</strong><p>${ngay(b.bookingDate)} lúc ${gio(b.bookingTime)} · ${tien(b.totalAmount)}</p>${nhan(b.status)} ${b.note ? `<small class="nho">${h(b.note)}</small>` : ""}</div>${canEdit ? `<div class="hang"><button class="nut nut-phu nut-nho" data-book-reschedule="${h(b.bookingId)}">Đổi lịch</button><button class="nut nut-nguy-hiem nut-nho" data-book-cancel="${h(b.bookingId)}">Hủy lịch</button></div>` : ""}</article>`;
}

function paymentCard(p) {
  const canPay = p.method === "BANK_TRANSFER" && p.status === "PENDING";
  return `<article class="dong"><div><strong>${h(p.paymentId)} · Lịch ${h(p.bookingId)}</strong><p>${tien(p.amount)} · ${p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</p>${nhan(p.status, "payment")}${p.paymentDate ? `<p class="nho">Ngày trả: ${ngay(p.paymentDate)}</p>` : ""}${p.refundReason ? `<p class="nho">Hoàn tiền: ${h(p.refundReason)}</p>` : ""}</div><div class="hang">${canPay ? `<button class="nut nut-nho" data-pay="${h(p.paymentId)}">Thanh toán</button><button class="nut nut-phu nut-nho" data-sync="${h(p.paymentId)}">Kiểm tra</button>` : ""}${p.status === "FAILED" ? `<button class="nut nut-phu nut-nho" data-retry="${h(p.paymentId)}">Thử lại</button>` : ""}${p.status === "PAID" ? `<button class="nut nut-phu nut-nho" data-receipt="${h(p.paymentId)}">Biên nhận</button>` : ""}</div></article>`;
}

async function load() {
  [pets, bookings, services, careTypes, staff, payments, notifications] =
    await Promise.all([
      api.get(`/api/Pets/user/${id(profile.userId)}`),
      api.get(`/api/Bookings/user/${id(profile.userId)}`),
      api.get("/api/ServicePackages"),
      api.get("/api/ServiceCategories/care-types"),
      api.get("/api/Staffs/directory"),
      api.get("/api/Payments"),
      api.get(`/api/Notifications/user/${id(profile.userId)}`),
    ]);
  render();
}

function capNhatTien() {
  const ids = [...$("#chon-dich-vu").querySelectorAll("input:checked")].map(
    (node) => node.value,
  );
  $("#tong-tien").textContent =
    `Tạm tính: ${tien(services.filter((s) => ids.includes(s.serviceId)).reduce((sum, s) => sum + Number(s.price), 0))}`;
}

async function xemGio() {
  const form = $("#form-dat-lich");
  const selected = [
    ...$("#chon-dich-vu").querySelectorAll("input:checked"),
  ].map((node) => node.value);
  if (!form.petId.value || !form.bookingDate.value || selected.length === 0)
    throw new Error("Hãy chọn thú cưng, ngày và ít nhất một dịch vụ.");
  const query = new URLSearchParams({
    date: form.bookingDate.value,
    serviceIds: selected.join(","),
    petId: form.petId.value,
  });
  if (form.staffId.value) query.set("staffId", form.staffId.value);
  const data = await api.get(`/api/Bookings/availability?${query}`);
  form.bookingTime.innerHTML = `<option value="">Chọn giờ còn trống</option>${data.slots
    .filter((s) => s.available)
    .map((s) => `<option value="${h(s.time)}">${h(s.time)}</option>`)
    .join("")}`;
  if (!data.slots.some((s) => s.available))
    thongBao("Không còn khung giờ phù hợp trong ngày này.", true);
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
          `<article class="dong"><div><strong>${h(r.diagnosis)}</strong><p>${h(r.treatment)}</p><small class="nho">${ngay(r.recordDate)}${r.prescription ? ` · Đơn thuốc: ${h(r.prescription)}` : ""}${r.followUpDate ? ` · Tái khám: ${ngay(r.followUpDate)}` : ""}</small></div></article>`,
      )
      .join("") || empty("Chưa có bệnh án.");
  $("#tiem-chung").innerHTML =
    vaccines
      .map(
        (v) =>
          `<article class="dong"><div><strong>${h(v.vaccineName)}</strong><p>Đã tiêm: ${ngay(v.vaccinationDate)} · Nhắc lại: ${ngay(v.nextDate)}</p><small class="nho">${h(v.note || "")}</small></div></article>`,
      )
      .join("") || empty("Chưa có lịch sử tiêm chủng.");
}

$("#form-thu-cung").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const petId = form.petId.value;
  const body = {
    petId,
    userId: profile.userId,
    petName: form.petName.value.trim(),
    species: form.species.value.trim(),
    breed: form.breed.value.trim(),
    gender: form.gender.value,
    birthDate: form.birthDate.value,
    weight: Number(form.weight.value),
    healthStatus: form.healthStatus.value.trim(),
  };
  const ok = await thaoTac(
    form.querySelector("button[type=submit]"),
    () =>
      petId
        ? api.put(`/api/Pets/${id(petId)}`, body)
        : api.post("/api/Pets", body),
    "Đã lưu hồ sơ thú cưng.",
  );
  if (ok) {
    form.reset();
    form.petId.value = "";
    $("#huy-sua-thu").hidden = true;
    await load();
  }
});
$("#huy-sua-thu").addEventListener("click", () => {
  $("#form-thu-cung").reset();
  $("#huy-sua-thu").hidden = true;
});
$("#chon-dich-vu").addEventListener("change", () => {
  capNhatTien();
  $("#form-dat-lich").bookingTime.innerHTML =
    '<option value="">Hãy xem giờ còn trống</option>';
});
$("#kiem-tra-gio").addEventListener("click", (event) =>
  thaoTac(event.currentTarget, xemGio),
);
$("#form-dat-lich").addEventListener("change", (event) => {
  if (["bookingDate", "petId", "staffId"].includes(event.target.name))
    $("#form-dat-lich").bookingTime.innerHTML =
      '<option value="">Hãy xem giờ còn trống</option>';
});
$("#form-dat-lich").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const serviceIds = [
    ...$("#chon-dich-vu").querySelectorAll("input:checked"),
  ].map((node) => node.value);
  if (!serviceIds.length) {
    thongBao("Hãy chọn ít nhất một dịch vụ.", true);
    return;
  }
  const body = {
    petId: form.petId.value,
    careTypeId: form.careTypeId.value,
    serviceIds,
    bookingDate: form.bookingDate.value,
    bookingTime: `${form.bookingTime.value}:00`,
    staffId: form.staffId.value || null,
    note: form.note.value,
    paymentMethod: form.paymentMethod.value,
    requestId: maYeuCau(),
  };
  const ok = await thaoTac(
    form.querySelector("button[type=submit]"),
    () => api.post("/api/Bookings", body),
    "Đã tạo lịch hẹn.",
  );
  if (ok) {
    form.reset();
    await load();
    chuyenTrang("lich-hen");
  }
});
$("#chon-thu-suc-khoe").addEventListener("change", () =>
  loadHealth().catch((e) => thongBao(e.message, true)),
);
$("#doc-tat-ca").addEventListener("click", (event) =>
  thaoTac(
    event.currentTarget,
    async () => {
      await api.put(`/api/Notifications/user/${id(profile.userId)}/read-all`);
      await load();
    },
    "Đã đánh dấu tất cả là đã đọc.",
  ),
);

document.addEventListener("click", async (event) => {
  const button = event.target.closest(
    "button[data-pet-edit],button[data-pet-photo],button[data-pet-archive],button[data-book-cancel],button[data-book-reschedule],button[data-pay],button[data-sync],button[data-retry],button[data-receipt],button[data-read]",
  );
  if (!button) return;
  if (button.dataset.petEdit) {
    const pet = pets.find((p) => p.petId === button.dataset.petEdit);
    const form = $("#form-thu-cung");
    for (const key of [
      "petId",
      "petName",
      "species",
      "breed",
      "gender",
      "weight",
      "healthStatus",
    ])
      form[key].value = pet[key] || "";
    form.birthDate.value = String(pet.birthDate).slice(0, 10);
    $("#huy-sua-thu").hidden = false;
    chuyenTrang("thu-cung");
    form.petName.focus();
  } else if (button.dataset.petPhoto) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      if (input.files[0])
        thaoTac(
          button,
          async () => {
            await api.upload(
              `/api/Media/pets/${id(button.dataset.petPhoto)}`,
              input.files[0],
            );
            await load();
          },
          "Đã tải ảnh thú cưng.",
        );
    };
    input.click();
  } else if (button.dataset.petArchive) {
    if (confirm("Lưu trữ hồ sơ thú cưng này?"))
      await thaoTac(
        button,
        async () => {
          await api.put(`/api/Pets/${id(button.dataset.petArchive)}/archive`);
          await load();
        },
        "Đã lưu trữ hồ sơ.",
      );
  } else if (button.dataset.bookCancel) {
    if (confirm("Bạn chắc chắn muốn hủy lịch này?"))
      await thaoTac(
        button,
        async () => {
          await api.put(
            `/api/Bookings/${id(button.dataset.bookCancel)}/cancel`,
          );
          await load();
        },
        "Đã hủy lịch.",
      );
  } else if (button.dataset.bookReschedule) {
    const booking = bookings.find(
      (b) => b.bookingId === button.dataset.bookReschedule,
    );
    const date = prompt(
      "Ngày mới (YYYY-MM-DD):",
      String(booking.bookingDate).slice(0, 10),
    );
    if (date === null) return;
    const time = prompt("Giờ mới (HH:MM):", gio(booking.bookingTime));
    if (time === null) return;
    await thaoTac(
      button,
      async () => {
        await api.put(`/api/Bookings/${id(booking.bookingId)}/reschedule`, {
          bookingDate: date,
          bookingTime: `${time}:00`,
          staffId: booking.staffId,
          note: booking.note,
        });
        await load();
      },
      "Đã đổi lịch.",
    );
  } else if (button.dataset.pay) {
    await thaoTac(button, async () => {
      const data = await api.post(
        `/api/Payments/${id(button.dataset.pay)}/payos-link`,
      );
      if (!data.checkoutUrl)
        throw new Error("PayOS không trả link thanh toán.");
      location.href = data.checkoutUrl;
    });
  } else if (button.dataset.sync) {
    await thaoTac(
      button,
      async () => {
        await api.post(`/api/Payments/${id(button.dataset.sync)}/payos-sync`);
        await load();
      },
      "Đã cập nhật trạng thái thanh toán.",
    );
  } else if (button.dataset.retry) {
    await thaoTac(
      button,
      async () => {
        await api.post(`/api/Payments/${id(button.dataset.retry)}/retry`);
        await load();
      },
      "Đã tạo giao dịch thử lại.",
    );
  } else if (button.dataset.receipt) {
    const payment = payments.find(
      (p) => p.paymentId === button.dataset.receipt,
    );
    alert(
      `BIÊN NHẬN PETNOVA\nMã giao dịch: ${payment.paymentId}\nLịch hẹn: ${payment.bookingId}\nSố tiền: ${tien(payment.amount)}\nTrạng thái: Đã thanh toán\nNgày: ${ngay(payment.paymentDate)}`,
    );
  } else if (button.dataset.read) {
    await thaoTac(button, async () => {
      await api.put(`/api/Notifications/${id(button.dataset.read)}/read`);
      await load();
    });
  }
});

profile = await baoVeTrang("CUSTOMER");
if (profile) {
  $("#noi-dung").hidden = false;
  batDieuHuong();
  $("#form-dat-lich").bookingDate.min = homNay();
  $("#form-thu-cung").birthDate.max = homNay();
  try {
    await load();
    caiDatTaiKhoan(profile, async () => {
      profile = await taiHoSo();
      caiDatTaiKhoan(profile, () => location.reload());
    });
  } catch (error) {
    thongBao(error.message, true);
  }
  if (location.hash.includes("payos=return"))
    thongBao(
      "Đã quay lại từ PayOS. Hãy bấm “Kiểm tra” để đồng bộ trạng thái thanh toán.",
    );
  if (location.hash.includes("payos=cancel"))
    thongBao(
      "Bạn đã rời trang thanh toán PayOS. Giao dịch chưa được xác nhận.",
      true,
    );
}
