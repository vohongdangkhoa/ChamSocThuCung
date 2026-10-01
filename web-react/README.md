# Giao diện PetNoVa

Website dùng React, JavaScript, CSS và Vite. Không cần Dart hoặc Flutter.

## Chạy

Tại thư mục gốc `petnova_app`, chạy `run_petnova_web_dev.cmd` hoặc `run_petnova_web_dev.ps1` để khởi động cả API và website. Mở `http://localhost:5173/`.

Nếu chỉ chạy giao diện, vào thư mục `web-react`, chạy `npm install` (lần đầu) rồi `npm run dev`. API vẫn phải chạy ở cổng 5200 để đăng nhập và tải dữ liệu. Go Live không thay thế Vite hoặc API .NET.

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
