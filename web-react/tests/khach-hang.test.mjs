import test from "node:test";
import assert from "node:assert/strict";
import { taiChiTietLichHen, kiemTraHoSoThuCung, kiemTraTepAnh } from "../src/du-lieu-khach-hang.js";

test("1000 lịch hẹn chỉ tải hai danh sách, không tạo 2000 request phụ", async () => {
  const calls = [];
  const api = { get: async (path) => {
    calls.push(path);
    return path === "/api/BookingDetails"
      ? [{ bookingId: "B0", detailId: "D1" }, { bookingId: "khong-hien-thi", detailId: "D2" }]
      : [{ bookingId: "B999", paymentId: "PM1" }, { bookingId: "khong-hien-thi", paymentId: "PM2" }];
  } };
  const rows = Array.from({ length: 1000 }, (_, i) => ({ bookingId: `B${i}` }));
  const result = await taiChiTietLichHen(api, rows);
  assert.deepEqual(calls.sort(), ["/api/BookingDetails", "/api/Payments"]);
  assert.deepEqual(result.details.B0, [{ bookingId: "B0", detailId: "D1" }]);
  assert.deepEqual(result.details.B999, []);
  assert.deepEqual(result.payments.B999, [{ bookingId: "B999", paymentId: "PM1" }]);
  assert.equal(result.details["khong-hien-thi"], undefined);
  assert.equal(result.payments["khong-hien-thi"], undefined);
});

test("khách chưa có lịch không cần tải chi tiết hoặc giao dịch", async () => {
  const api = { get: () => assert.fail("Không được gọi API khi không có lịch") };
  assert.deepEqual(await taiChiTietLichHen(api, []), { details: {}, payments: {} });
});

test("lỗi thanh toán không bị che thành danh sách rỗng", async () => {
  const api = { get: async (path) => {
    if (path === "/api/Payments") throw new Error("HTTP 503");
    return [];
  } };
  await assert.rejects(taiChiTietLichHen(api, [{ bookingId: "B1" }]),
    /Không thể tải lịch sử thanh toán.*HTTP 503/);
});

test("dữ liệu sai định dạng và hủy request được truyền về bên gọi", async () => {
  const invalidApi = { get: async () => ({ message: "not an array" }) };
  await assert.rejects(taiChiTietLichHen(invalidApi, [{ bookingId: "B1" }]), /không phải danh sách/);
  const controller = new AbortController();
  controller.abort();
  const cancellation = new Error("Aborted");
  const abortedApi = { get: async (_path, options) => {
    assert.equal(options.signal, controller.signal);
    throw cancellation;
  } };
  await assert.rejects(taiChiTietLichHen(abortedApi, [{ bookingId: "B1" }], { signal: controller.signal }),
    (error) => error === cancellation);
});

const pet = {
  petName: "Bông", species: "Chó", breed: "Poodle", gender: "Đực",
  birthDate: "2024-02-29", weight: "5.2", healthStatus: "Khỏe mạnh",
};
const today = "2026-10-26";

test("hồ sơ hợp lệ, ngày nhuận và giới hạn chuỗi được chấp nhận", () => {
  assert.equal(kiemTraHoSoThuCung(pet, today), "");
  assert.equal(kiemTraHoSoThuCung({ ...pet, petName: "a".repeat(100), breed: "b".repeat(100),
    healthStatus: "c".repeat(255), birthDate: today, weight: 999.9 }, today), "");
});

test("chặn giống trống, ngày sai hoặc tương lai và cân nặng ngoài giới hạn API", () => {
  assert.match(kiemTraHoSoThuCung({ ...pet, breed: " " }, today), /Giống/);
  assert.match(kiemTraHoSoThuCung({ ...pet, birthDate: "2025-02-29" }, today), /Ngày sinh/);
  assert.match(kiemTraHoSoThuCung({ ...pet, birthDate: "1899-12-31" }, today), /Ngày sinh/);
  assert.match(kiemTraHoSoThuCung({ ...pet, birthDate: "2026-10-27" }, today), /Ngày sinh/);
  for (const weight of [0, -1, 1000, Infinity, "abc"]) {
    assert.match(kiemTraHoSoThuCung({ ...pet, weight }, today), /Cân nặng/);
  }
  assert.match(kiemTraHoSoThuCung({ ...pet, petName: "a".repeat(101) }, today), /Tên/);
  assert.match(kiemTraHoSoThuCung({ ...pet, healthStatus: "a".repeat(256) }, today), /Tình trạng/);
});

test("giới hạn ảnh UI khớp server: đúng 5 MiB được phép, lớn hơn hoặc 6 MiB bị chặn", () => {
  const max = 5 * 1024 * 1024;
  assert.equal(kiemTraTepAnh({ type: "image/png", size: max }), "");
  assert.equal(kiemTraTepAnh({ type: "image/jpeg", size: 1 }), "");
  assert.equal(kiemTraTepAnh({ type: "image/webp", size: max - 1 }), "");
  assert.match(kiemTraTepAnh({ type: "image/png", size: max + 1 }), /5 MB/);
  assert.match(kiemTraTepAnh({ type: "image/png", size: 6 * 1024 * 1024 }), /5 MB/);
  assert.match(kiemTraTepAnh({ type: "image/png", size: 0 }), /có nội dung/);
  assert.match(kiemTraTepAnh({ type: "image/gif", size: 100 }), /JPG, PNG hoặc WebP/);
});
