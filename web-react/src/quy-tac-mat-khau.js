export const DO_DAI_MAT_KHAU_TOI_THIEU = 12;
export const DO_DAI_MAT_KHAU_TOI_DA = 128;

// Cùng tập ký hiệu với chính sách mật khẩu Firebase, để UI và nhà cung cấp khớp nhau.
export const KY_TU_DAC_BIET = "^$*.[]{}()?\"!@#%&/\\,><':;|_~";

/** Chính sách riêng của PetNoVa; không cắt khoảng trắng hay tự đổi mật khẩu. */
export function cacTieuChiMatKhau(value) {
  const password = typeof value === "string" ? value : "";
  return [
    { id: "length", text: `Từ ${DO_DAI_MAT_KHAU_TOI_THIEU} đến ${DO_DAI_MAT_KHAU_TOI_DA} ký tự`, dat: password.length >= DO_DAI_MAT_KHAU_TOI_THIEU && password.length <= DO_DAI_MAT_KHAU_TOI_DA,
      loi: `Mật khẩu cần có từ ${DO_DAI_MAT_KHAU_TOI_THIEU} đến ${DO_DAI_MAT_KHAU_TOI_DA} ký tự.` },
    { id: "ascii", text: "Chữ không dấu và ký tự bàn phím thông thường", dat: password.length > 0 && /^[\x20-\x7e]+$/.test(password),
      loi: "Mật khẩu chỉ dùng chữ không dấu, số, dấu cách và ký hiệu trên bàn phím." },
    { id: "upper", text: "Ít nhất một chữ hoa (A–Z)", dat: /[A-Z]/.test(password),
      loi: "Mật khẩu cần có ít nhất một chữ hoa (A–Z)." },
    { id: "lower", text: "Ít nhất một chữ thường (a–z)", dat: /[a-z]/.test(password),
      loi: "Mật khẩu cần có ít nhất một chữ thường (a–z)." },
    { id: "digit", text: "Ít nhất một chữ số (0–9)", dat: /[0-9]/.test(password),
      loi: "Mật khẩu cần có ít nhất một chữ số (0–9)." },
    { id: "symbol", text: "Ít nhất một ký tự đặc biệt (!, @, #, $…)", dat: Array.from(KY_TU_DAC_BIET).some((symbol) => password.includes(symbol)),
      loi: "Mật khẩu cần có ít nhất một ký tự đặc biệt như !, @, # hoặc $." },
  ];
}

export function kiemTraMatKhau(value) {
  return cacTieuChiMatKhau(value).find((tieuChi) => !tieuChi.dat)?.loi || null;
}
