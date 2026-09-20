# Chạy PetNoVa khi phát triển

## Android thật qua cáp USB — cách khuyên dùng

Từ thư mục gốc dự án, chỉ chạy:

```powershell
.\run_petnova_dev.cmd
```

Launcher sẽ tự động:

1. Kiểm tra API và SQL Server `PetNoVaDB`.
2. Khởi động backend ở cổng `5200` nếu backend chưa chạy.
3. Kiểm tra điện thoại đã cấp quyền USB debugging.
4. Tạo lại `adb reverse tcp:5200 tcp:5200`.
5. Chạy Flutter với đúng `API_BASE_URL`.

Giữ cửa sổ lệnh mở trong lúc demo. Nhấn `Ctrl + C` khi kết thúc.

Nếu app đã được cài và chỉ cần khôi phục backend + đường hầm USB:

```powershell
.\run_petnova_dev.cmd -NoFlutter
```

## Chạy thủ công khi cần chẩn đoán

Terminal 1:

```powershell
dotnet run --project .\backend\PetNoVaApi\PetNoVaApi.csproj --launch-profile http
```

Terminal 2:

```powershell
& "C:\Users\vohon\AppData\Local\Android\sdk\platform-tools\adb.exe" reverse tcp:5200 tcp:5200
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:5200
```

`adb reverse` có thể mất sau khi rút cáp, khởi động lại điện thoại hoặc cài lại APK.

## Cấu hình upload ảnh lần đầu

Cloudinary chỉ cần cấu hình một lần trên mỗi máy:

```powershell
.\configure_petnova_cloudinary.cmd
```

Sau khi nhập `Cloud name`, `API key` và `API secret`, hãy khởi động lại
backend bằng `.\run_petnova_dev.cmd -NoFlutter`. Secret được lưu ngoài source
code bằng .NET User Secrets. Xem thêm tại `docs/CloudinaryPetNoVa.md`.
Get-Process PetNoVaApi -ErrorAction SilentlyContinue | Stop-Process
