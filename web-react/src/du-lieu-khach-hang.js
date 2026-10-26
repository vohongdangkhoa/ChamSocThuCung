/** Tải hai danh sách đã được API lọc quyền, tránh hai request cho từng lịch hẹn. */
export async function taiChiTietLichHen(apiClient, bookings, { signal } = {}) {
  const ids = new Set(bookings.map((booking) => String(booking.bookingId)));
  if (!ids.size) return { details: {}, payments: {} };

  const taiDanhSach = async (path, label) => {
    try {
      const rows = await apiClient.get(path, { signal });
      if (!Array.isArray(rows)) throw new Error("Dữ liệu trả về không phải danh sách.");
      return rows;
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(`Không thể tải ${label}. ${error?.message || "Vui lòng thử lại."}`);
    }
  };
  const [detailRows, paymentRows] = await Promise.all([
    taiDanhSach("/api/BookingDetails", "dịch vụ trong lịch hẹn"),
    taiDanhSach("/api/Payments", "lịch sử thanh toán"),
  ]);
  const group = (rows) => {
    const result = Object.fromEntries([...ids].map((id) => [id, []]));
    rows.forEach((row) => {
      const id = String(row.bookingId);
      // Không đưa dòng không thuộc danh sách lịch đang hiển thị vào giao diện.
      if (ids.has(id)) result[id].push(row);
    });
    return result;
  };
  return { details: group(detailRows), payments: group(paymentRows) };
}

/** Kiểm tra cùng các giới hạn hồ sơ thú cưng mà API chấp nhận. */
export function kiemTraHoSoThuCung(values, today) {
  if (!values.petName?.trim() || values.petName.trim().length > 100)
    return "Tên thú cưng cần từ 1 đến 100 ký tự.";
  if (!values.species?.trim() || values.species.trim().length > 50)
    return "Vui lòng chọn loài thú cưng hợp lệ.";
  if (!values.breed?.trim() || values.breed.trim().length > 100)
    return "Giống thú cưng cần từ 1 đến 100 ký tự. Nếu chưa rõ, nhập Chưa rõ.";
  if (!["Đực", "Cái", "Khác"].includes(values.gender))
    return "Vui lòng chọn giới tính hợp lệ.";
  const birthDate = String(values.birthDate || "");
  const parsed = new Date(`${birthDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate ||
      birthDate < "1900-01-01" || birthDate > today)
    return "Ngày sinh phải hợp lệ, từ năm 1900 đến hôm nay.";
  const weight = Number(values.weight);
  if (!Number.isFinite(weight) || weight <= 0 || weight >= 1000)
    return "Cân nặng phải lớn hơn 0 và nhỏ hơn 1000 kg.";
  if (!values.healthStatus?.trim() || values.healthStatus.trim().length > 255)
    return "Tình trạng sức khỏe cần từ 1 đến 255 ký tự.";
  return "";
}

export function kiemTraTepAnh(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0)
    return "Vui lòng chọn một ảnh có nội dung.";
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || ""))
    return "Hãy chọn ảnh JPG, PNG hoặc WebP.";
  if (file.size > 5 * 1024 * 1024)
    return "Ảnh không được vượt quá 5 MB.";
  return "";
}
