# PetNoVa — website HTML/CSS/JavaScript

Giao diện chính hiện nằm trong **`website/`**, viết bằng HTML, CSS và JavaScript thuần. Không cần học React, không cần npm/Vite để chạy website này. API .NET 10 và SQL Server hiện có vẫn phục vụ tài khoản, lịch hẹn và dữ liệu.

## Mở trong VS Code

1. Mở thư mục `C:\Users\vohon\petnova_app`.
2. Mở Terminal ở thư mục gốc, chạy:

   ```powershell
   .\run_petnova_web_dev.ps1
   ```

   Hoặc bấm đúp `run_petnova_web_dev.cmd`.
3. Giữ terminal đang chạy và mở **http://127.0.0.1:5200/**.
4. Nhấn `Ctrl+C` trong terminal để dừng.

Chỉ một lệnh trên chạy cả website lẫn API. Cần .NET 10 SDK, SQL Server với `PetNoVaDB` và cấu hình kết nối đã dùng trước đây. Lần đầu `dotnet` có thể tải các gói NuGet. Firebase đăng nhập cần Internet.

## Tìm file giao diện

| Bạn muốn sửa | Mở file |
|---|---|
| Trang đăng nhập/đăng ký | `website/index.html` |
| Trang khách hàng | `website/khach-hang.html` |
| Trang nhân viên | `website/nhan-vien.html` |
| Trang bác sĩ | `website/bac-si.html` |
| Trang quản trị | `website/quan-tri.html` |
| Màu, bố cục, nút, biểu mẫu | `website/css/giao-dien.css` |
| Hành động trang khách hàng | `website/js/khach-hang.js` |
| Hành động nhân viên/bác sĩ/quản trị | `website/js/van-hanh.js` |
| Đăng nhập, đăng ký, phân quyền | `website/js/xac-thuc.js` và `website/js/dang-nhap.js` |
| Gọi API | `website/js/api.js` |
| Cấu hình Firebase/API | `website/js/cau-hinh.js` |

Xem [hướng dẫn chi tiết](website/README.md) nếu bạn muốn biết mỗi thư mục làm gì.

`backend/PetNoVaApi/` là phần xử lý dữ liệu. `web-react/` là bản React cũ, **không còn được chạy** bởi lệnh ở trên; tạm giữ để đối chiếu, chưa xóa dữ liệu/code cũ.

### Có dùng nút Go Live được không?

Được, VS Code đã được cấu hình để Go Live mở thư mục `website/` ở cổng 5500. Tuy nhiên Go Live **chỉ chạy file HTML/CSS/JS**; chức năng đăng nhập và lưu dữ liệu vẫn cần API .NET chạy tại cổng 5200. Vì thế cách dễ nhất là chỉ dùng lệnh `run_petnova_web_dev.ps1` và mở cổng 5200.

### Khi đưa lên máy chủ thật

Chạy `dotnet publish backend/PetNoVaApi/PetNoVaApi.csproj -c Release`. File trong `website/` được đóng gói vào `wwwroot/` của bản publish. Cần cấu hình SQL Server, Firebase, Cloudinary, PayOS, HTTPS và `Web:PublicBaseUrl` theo môi trường thật trước khi công khai.
