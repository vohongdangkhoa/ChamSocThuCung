# PetNoVa Web

Frontend React chuyển đổi từ ứng dụng Flutter. API ASP.NET Core trong `../backend/PetNoVaApi` vẫn là nguồn dữ liệu duy nhất.

## Chạy local

1. Chạy API (mặc định cổng `5200`): `run_petnova_dev.cmd` tại thư mục gốc.
2. Từ thư mục này, tạo `.env` từ `.env.example` và thay `VITE_API_BASE_URL` nếu API chạy ở địa chỉ khác.
3. Cài và chạy:

   ```powershell
   npm install
   npm run dev
   ```

Mở `http://localhost:5173`. Build production dùng `npm run build`; thư mục deploy là `dist`.

## Chức năng đã chuyển

- Firebase: đăng nhập, đăng ký, đăng xuất, lưu email, quên mật khẩu ba bước OTP.
- Khách hàng: hồ sơ, ảnh avatar, thú cưng, đặt/hủy lịch, bệnh án, tiêm chủng, thanh toán PayOS/tiền mặt, thông báo.
- Nhân viên: lịch hẹn, luồng trạng thái, xác nhận thanh toán tiền mặt.
- Bác sĩ: hồ sơ thú cưng, lập bệnh án, ghi nhận tiêm chủng.
- Quản trị: tài khoản, nhân sự, gói dịch vụ và xem lịch hẹn.

## Lưu ý triển khai

- Cần thêm domain website vào **Firebase Authentication → Authorized domains**.
- `VITE_API_BASE_URL` production phải là HTTPS do luồng OTP truyền mật khẩu mới.
- Backend đã cấu hình CORS phát triển rộng rãi. Trước khi public, giới hạn CORS ở `backend/PetNoVaApi/Program.cs` theo domain web thực tế.
