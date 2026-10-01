# Thư mục giao diện PetNoVa

Mỗi trang là một file `.html` riêng. Bạn có thể mở từng file trong VS Code để thấy phần chữ, nút, biểu mẫu của trang đó. CSS nằm trong `css/giao-dien.css`; hành động khi bấm nút nằm trong `js/`.

## Sơ đồ ngắn

```text
website/
├── index.html             Đăng nhập, đăng ký, quên mật khẩu
├── khach-hang.html        Thú cưng, đặt lịch, thanh toán, sức khỏe
├── nhan-vien.html         Xử lý lịch, thanh toán, khách hàng
├── bac-si.html            Lịch được phân công, bệnh án, tiêm chủng
├── quan-tri.html          Báo cáo, nhân sự, dịch vụ, tài khoản
├── css/
│   └── giao-dien.css      Toàn bộ màu sắc và bố cục
└── js/
    ├── dang-nhap.js       Nút/form đăng nhập và lấy lại mật khẩu
    ├── khach-hang.js      Chức năng của khách hàng
    ├── van-hanh.js        Chức năng nhân viên, bác sĩ, quản trị
    ├── tai-khoan.js       Sửa hồ sơ/ảnh/mật khẩu/email
    ├── xac-thuc.js        Kiểm tra đăng nhập và vai trò
    ├── api.js             Gọi API .NET
    ├── cau-hinh.js        Firebase và địa chỉ API
    └── chung.js           Định dạng ngày, tiền, thông báo
```

Ví dụ: muốn sửa chữ “Thú cưng của tôi”, tìm trong `khach-hang.html`; muốn đổi màu nút, tìm `.nut` trong `css/giao-dien.css`; muốn đổi việc xảy ra khi bấm “Lưu hồ sơ”, tìm `form-thu-cung` trong `js/khach-hang.js`.

Không mở các file HTML bằng `file://` vì trình duyệt sẽ chặn JavaScript module. Hãy chạy lệnh ở README gốc rồi vào `http://127.0.0.1:5200/`.
