/** Chuẩn số điện thoại dùng chung với PhoneNumberNormalizer của API. */
export function chuanHoaSoDienThoai(value) {
  const raw = String(value ?? "").trim();
  if (!raw || !/^\+?[0-9\s.()\-]+$/.test(raw)) return null;
  let number = raw.replace(/[^0-9]/g, "");
  let international = raw.startsWith("+");
  if (number.startsWith("00")) {
    number = number.slice(2);
    international = true;
  }
  if (/^0[1-9]\d{8}$/.test(number)) return "+84" + number.slice(1);
  if (/^84[1-9]\d{8}$/.test(number)) return "+" + number;
  if (!international && /^[1-9]\d{8}$/.test(number)) return "+84" + number;
  return null;
}

/** Không gọi Firebase cho dữ liệu chắc chắn bị SQL/API từ chối. */
export function kiemTraThongTinDangKy({ fullName, email, phone, password }) {
  const name = String(fullName ?? "").trim();
  const address = String(email ?? "").trim();
  const normalizedPhone = chuanHoaSoDienThoai(phone);
  if (!name || name.length > 100) throw new Error("Họ và tên cần từ 1 đến 100 ký tự.");
  if (address.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    throw new Error("Email phải đúng định dạng và không quá 100 ký tự.");
  if (!normalizedPhone) throw new Error("Số điện thoại Việt Nam không hợp lệ.");
  if (String(password ?? "").length < 6) throw new Error("Mật khẩu cần có ít nhất 6 ký tự.");
  return { fullName: name, email: address, phone: normalizedPhone, password: String(password) };
}

/** Bù trừ danh tính vừa tạo khi hồ sơ bị API từ chối rõ ràng (vd. trùng số). */
export async function dangKyKhachHang(input, services) {
  const values = kiemTraThongTinDangKy(input);
  const credential = await services.createIdentity(values.email, values.password);
  const firebaseUser = credential.user;
  if (!firebaseUser) throw new Error("Firebase không trả về tài khoản vừa tạo.");
  let profileRequestStarted = false;
  try {
    await services.updateIdentity(firebaseUser, values.fullName);
    profileRequestStarted = true;
    const account = await services.createProfile({
      userId: "", firebaseUid: firebaseUser.uid, fullName: values.fullName,
      email: firebaseUser.email || values.email, phone: values.phone,
      role: "CUSTOMER", status: "ACTIVE", fcmToken: "", avatarUrl: "", avatarPublicId: "",
    }, firebaseUser);
    return { firebaseUser, account };
  } catch (error) {
    // Mất mạng/5xx có thể xảy ra SAU khi SQL đã lưu: không xóa danh tính khi chưa rõ kết quả.
    if (!profileRequestStarted || [400, 409, 422].includes(error?.status)) {
      try {
        await services.removeIdentity(firebaseUser);
      } catch {
        throw new Error("Chưa hoàn tất đăng ký và chưa thể dọn tài khoản vừa tạo. Hãy đăng nhập lại hoặc liên hệ PetNoVa.", { cause: error });
      }
    }
    throw error;
  }
}
