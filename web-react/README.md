# Bản React cũ — không còn là giao diện chính

Website hiện tại đã chuyển sang HTML/CSS/JavaScript thuần tại `../website/`.
Lệnh `../run_petnova_web_dev.ps1` **không dùng thư mục này** và chạy website ở `http://127.0.0.1:5200/`.
Thư mục React được giữ lại để đối chiếu, chưa xóa nhằm tránh mất code cũ.

## Ghi chú về bản React cũ

Website dùng React, JavaScript, CSS và Vite. Không cần Dart hoặc Flutter.

## Chạy

Chỉ khi muốn xem lại bản React cũ, tự chạy `npm install` và `npm run dev` tại thư mục này, rồi mở `http://localhost:5173/`.

Bản React cũ vẫn cần API ở cổng 5200 để đăng nhập và tải dữ liệu; đây chỉ là tài liệu lưu trữ, không phải hướng dẫn chạy website mới.

## File giao diện

| File | Ý nghĩa |
| --- | --- |
| `src/diem-vao.jsx` | Điểm bắt đầu React |
| `src/ung-dung.jsx` | Chọn giao diện theo vai trò |
| `src/trang-dang-nhap.jsx` | Đăng nhập, đăng ký, quên mật khẩu |
| `src/cong-khach-hang.jsx` | Các màn hình khách hàng |
| `src/lich-hen-khach-hang.jsx` | Đặt lịch, đổi lịch, lịch sử thanh toán |
| `src/cong-van-hanh.jsx` | Màn hình nhân viên, bác sĩ, quản trị |
| `src/quan-tri-bo-sung.jsx` | Danh mục, báo cáo, thông báo, nhật ký |
| `src/cai-dat-tai-khoan.jsx` | Thông tin tài khoản |
| `src/xac-thuc.jsx` | Phiên đăng nhập Firebase |
| `src/giao-tiep-api.js` | Gọi API .NET |
| `src/cau-hinh-firebase.js` | Cấu hình Firebase phía website |
| `src/giao-dien.css`, `src/khach-hang.css`, `src/van-hanh.css` | Kiểu dáng giao diện |

`index.html`, `vite.config.js`, `package.json` là tên tiêu chuẩn Vite/npm nên được giữ nguyên. Mỗi màn hình React là một hàm/component xuất JSX; không cần một file HTML riêng cho mỗi trang.

## Build và triển khai

`npm run build` tạo bản tĩnh trong `dist/`. Tạo `.env` theo `.env.example` để đặt `VITE_API_BASE_URL` và cấu hình Firebase nếu cần. Với production, API phải chạy HTTPS, domain website cần có trong Firebase Authentication Authorized Domains, và CORS API chỉ nên cho phép domain đó. PayOS, email OTP và tải ảnh cần khóa dịch vụ phía server.
