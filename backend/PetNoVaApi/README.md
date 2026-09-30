# API PetNoVa

Đây là API ASP.NET Core/.NET 10 và SQL Server cho website React PetNoVa. Khởi động toàn bộ dự án từ thư mục gốc bằng `run_petnova_web_dev.cmd` hoặc `run_petnova_web_dev.ps1`; xem README ở thư mục gốc.

Nếu chỉ cần chạy API trong VS Code:

```powershell
dotnet run --project backend/PetNoVaApi/PetNoVaApi.csproj --launch-profile http
```

API phát triển dùng `http://localhost:5200`, kiểm tra bằng `http://localhost:5200/health`. Cấu hình SQL Server trong `appsettings.json`. Các thay đổi lược đồ bổ sung được áp dụng khi API khởi động; file SQL tương ứng nằm trong `Database/`.

Không đưa mật khẩu SMTP, khóa PayOS, Firebase Admin hoặc Cloudinary vào Git. Các tính năng tích hợp bên ngoài chỉ hoạt động khi khóa tương ứng đã được cấu hình trong .NET User Secrets hoặc biến môi trường. `configure_petnova_password_reset.cmd` và `configure_petnova_cloudinary.cmd` ở thư mục gốc hỗ trợ cấu hình một số khóa.

Khi triển khai thật, dùng HTTPS, cấu hình `Web:PublicBaseUrl` trỏ đến website, cập nhật URL callback PayOS và giới hạn CORS theo domain website.
