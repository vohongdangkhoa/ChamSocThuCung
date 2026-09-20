# Cấu hình ảnh Cloudinary cho PetNoVa

PetNoVa gửi ảnh từ Flutter đến ASP.NET API. Backend xác minh người dùng
Firebase, ký yêu cầu Cloudinary và chỉ lưu URL cùng `publicId` vào SQL Server.
`API secret` không được đặt trong Flutter, `appsettings.json` hoặc Git.

## Cấu hình một lần trên máy phát triển

1. Tạo tài khoản tại [Cloudinary](https://cloudinary.com/).
2. Mở Dashboard và lấy ba giá trị `Cloud name`, `API key`, `API secret`.
3. Tại thư mục gốc dự án, chạy:

   ```powershell
   .\configure_petnova_cloudinary.cmd
   ```

4. Nhập ba giá trị khi được hỏi. Script lưu chúng bằng .NET User Secrets ở
   ngoài repository.
5. Khởi động lại PetNoVa:

   ```powershell
   .\run_petnova_dev.cmd -NoFlutter
   ```

Trên máy mới chỉ cần chạy lại bước cấu hình một lần. Không gửi `API secret`
qua chat, không chụp màn hình Dashboard có secret và không commit secret vào
source code.

## Cách dữ liệu được lưu

- `USER_ACCOUNT`: `avatarUrl`, `avatarPublicId`.
- `PET`: `imageUrl`, `imagePublicId`.
- File thật nằm trên Cloudinary.
- Bốn cột SQL đều cho phép `NULL`, vì vậy tài khoản và thú cưng cũ tiếp tục
  dùng ảnh mặc định.

Backend tự kiểm tra và thêm bốn cột nullable khi khởi động. Script SQL
idempotent tương ứng cũng được lưu trong thư mục
`backend/PetNoVaApi/Database` để triển khai thủ công khi cần.

## Kiểm tra nhanh

1. Đăng nhập bằng tài khoản khách hàng.
2. Vào Hồ sơ, chọn avatar và lưu.
3. Thêm thú cưng, chọn ảnh rồi lưu.
4. Đổi ảnh trong trang chỉnh sửa thú cưng.
5. Kiểm tra lại ảnh ở danh sách thú cưng, chi tiết thú cưng và màn bác sĩ.

Nếu chưa cấu hình Cloudinary, các chức năng khác vẫn hoạt động; riêng thao tác
upload sẽ nhận thông báo yêu cầu cấu hình Cloudinary.
