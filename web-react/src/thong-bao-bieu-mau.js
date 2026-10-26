/** Đồng bộ lỗi kiểm tra HTML sang tiếng Việt, giữ validation của trình duyệt. */
export function vietHoaLoiNhap(event) {
  const field = event.target;
  if (typeof field.setCustomValidity !== "function") return;
  const label = field.labels?.[0]?.textContent?.replace(/\s+/g, " ").trim() || "Thông tin";
  const validity = field.validity;
  if (validity.valueMissing) field.setCustomValidity(`Vui lòng nhập ${label.toLocaleLowerCase("vi-VN")}.`);
  else if (validity.typeMismatch) field.setCustomValidity(`${label} không đúng định dạng.`);
  else if (validity.tooShort) field.setCustomValidity(`${label} cần ít nhất ${field.minLength} ký tự.`);
  else if (validity.tooLong) field.setCustomValidity(`${label} không được quá ${field.maxLength} ký tự.`);
  else if (validity.rangeUnderflow) field.setCustomValidity(`${label} phải từ ${field.min} trở lên.`);
  else if (validity.rangeOverflow) field.setCustomValidity(`${label} không được vượt quá ${field.max}.`);
  else if (validity.badInput || validity.stepMismatch || validity.patternMismatch)
    field.setCustomValidity(`${label} không hợp lệ. Vui lòng kiểm tra lại.`);
}

export function xoaLoiNhap(event) {
  event.target.setCustomValidity?.("");
}
