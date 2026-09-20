# Quên mật khẩu bằng OTP Gmail

PetNoVa dùng luồng:

1. Khách hàng nhập số điện thoại đã đăng ký.
2. Backend tìm tài khoản `CUSTOMER` trong PetNoVaDB.
3. OTP 6 số được gửi tới email liên kết; ứng dụng chỉ thông báo chung rằng email đã được gửi để tránh lộ tài khoản tồn tại.
4. OTP đúng sẽ cấp một vé đặt lại mật khẩu ngắn hạn, dùng một lần.
5. Backend đổi mật khẩu Firebase và thu hồi các phiên đăng nhập cũ.

SQL Server **không lưu mật khẩu**. Bảng `PASSWORD_RESET_CHALLENGE` chỉ lưu mã OTP và vé đặt lại ở dạng HMAC, cùng thời hạn/trạng thái sử dụng.

## Cấu hình một lần

### 1. Tạo Google App Password cho Gmail gửi OTP

- Bật xác minh hai bước cho tài khoản Google dùng để gửi mail.
- Mở trang **Google Account > Security > App passwords**.
- Tạo App Password tên `PetNoVa`, rồi giữ mã 16 ký tự để nhập vào script.
- Không dùng mật khẩu Gmail thông thường.

### 2. Tải Firebase service account

- Mở Firebase Console của project `pet-care-app-dd27b`.
- Vào **Project settings > Service accounts**.
- Chọn **Generate new private key** và tải file JSON.
- Không chép file này vào thư mục dự án hoặc gửi lên Git.

### 3. Chạy script

Tại thư mục gốc dự án:

```powershell
.\configure_petnova_password_reset.cmd
```

Nhập Gmail gửi OTP, Google App Password và đường dẫn file service-account JSON. Script sẽ:

- tự sửa lỗi BOM `0xEF` của file User Secrets cũ mà không làm mất cấu hình Cloudinary;
- lưu SMTP, pepper và đường dẫn service account bằng .NET User Secrets;
- sao chép service account vào `%LOCALAPPDATA%\PetNoVa\Secrets`;
- không ghi bí mật vào `appsettings.json`.

Sau đó khởi động lại backend:

```powershell
.\run_petnova_dev.cmd -RestartBackend
```

Lần chạy này đồng thời nạp backend mới và cài bản Flutter mới nhất lên điện thoại. Sau đó, các buổi làm việc bình thường vẫn có thể dùng `.\run_petnova_dev.cmd -NoFlutter` như trước.

## Quy tắc bảo mật đang áp dụng

- OTP: 6 số ngẫu nhiên mật mã, thời hạn 5 phút.
- Tối đa 5 lần thử OTP.
- Chờ 60 giây trước khi gửi lại.
- Vé đặt lại mật khẩu: thời hạn 10 phút, dùng một lần.
- Giới hạn request theo địa chỉ IP.
- Phản hồi luôn dùng nội dung chung `email đã liên kết`, kể cả khi số điện thoại không tồn tại, để hạn chế dò tài khoản.
- “Nhớ mật khẩu” dùng Android Keystore qua `flutter_secure_storage`.

Khi triển khai nhiều máy chủ, nên chuyển bảng challenge/rate limit sang kho dùng chung và dùng dịch vụ email giao dịch thay cho Gmail SMTP.
