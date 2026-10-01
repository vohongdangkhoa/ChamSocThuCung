# PetNoVa — website ASP.NET Core Razor Pages

Website hiện dùng **Razor Pages + C#**, CSS và JavaScript thuần. Không dùng React, Flutter, Dart, Vite hay npm để chạy. Mỗi màn hình có một file `.cshtml` và một đường dẫn riêng. API .NET 10 và SQL Server nằm cùng ứng dụng.

## Chạy trong VS Code

1. Mở thư mục `C:\Users\vohon\petnova_app` trong VS Code.
2. Mở Terminal tại thư mục gốc và chạy `.\run_petnova_web_dev.ps1`. Hoặc bấm đúp `run_petnova_web_dev.cmd`.
3. Giữ terminal mở, truy cập `http://127.0.0.1:5200/`.
4. Nhấn `Ctrl+C` để dừng.

Một lệnh chạy cả giao diện lẫn API. Cần .NET 10 SDK, SQL Server/PetNoVaDB và cấu hình tích hợp đã có. Lần đầu `dotnet` có thể cần Internet để tải gói NuGet; Firebase đăng nhập cũng cần Internet.

## Tìm đúng file để sửa

| Nội dung | Vị trí |
|---|---|
| Đăng nhập, đăng ký | `backend/PetNoVaApi/Pages/Index.cshtml` |
| Màn hình khách hàng | `backend/PetNoVaApi/Pages/khach-hang/` |
| Màn hình nhân viên | `backend/PetNoVaApi/Pages/nhan-vien/` |
| Màn hình bác sĩ | `backend/PetNoVaApi/Pages/bac-si/` |
| Màn hình quản trị | `backend/PetNoVaApi/Pages/quan-tri/` |
| Thanh trên và menu dùng chung | `backend/PetNoVaApi/Pages/Shared/_Layout.cshtml` và `Services/SoDoTrang.cs` |
| Màu sắc, bố cục | `website/css/giao-dien.css` |
| Thao tác trên màn hình | `website/js/khach-hang.js`, `website/js/van-hanh.js`, `website/js/tai-khoan.js` |
| Đăng nhập, phân quyền | `website/js/xac-thuc.js`, `website/js/dang-nhap.js` |
| API và dữ liệu | `backend/PetNoVaApi/Controllers/`, `Data/`, `Services/` |

Ví dụ, muốn sửa giao diện đặt lịch, mở `backend/PetNoVaApi/Pages/khach-hang/dat-lich.cshtml`; muốn sửa hành động nút “Đặt lịch”, mở `website/js/khach-hang.js`. Tên các màn hình và thư mục vai trò mới đều là tiếng Việt không dấu; `Index.cshtml` và các file `_Layout`/`_View...` giữ tên quy ước của Razor.

Các file HTML tĩnh cũ đã được thay bằng Razor Pages; nếu cần đối chiếu, có thể xem trong lịch sử Git. `web-react/` là bản React cũ, không chạy trong lệnh trên. Không cần Go Live: nó chỉ phục vụ file tĩnh, không biên dịch Razor/C# và không khởi động API. Muốn xem trang `.cshtml`, dùng lệnh chạy ở trên.

Khi triển khai thật, chạy `dotnet publish backend/PetNoVaApi/PetNoVaApi.csproj -c Release`. Cần cấu hình SQL Server, Firebase, Cloudinary, PayOS, HTTPS và `Web:PublicBaseUrl` theo môi trường triển khai.
