# PetNoVa API

Backend ASP.NET Core API duoc copy tu:

```text
C:\Users\vohon\source\repos\PetNoVaApi
```

## Chay trong VS Code

Tu terminal o root `petnova_app`:

```powershell
dotnet run --project backend/PetNoVaApi/PetNoVaApi.csproj --launch-profile http
```

API se nghe o:

```text
http://localhost:5200
http://<IP-may-tinh>:5200
```

Swagger:

```text
http://localhost:5200/swagger
```

Neu chay Flutter web trong VS Code:

```powershell
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:5200
```

Neu chay Android may that, app can goi IP may tinh dang chay API, vi du:

```powershell
flutter run --dart-define=API_BASE_URL=http://172.32.9.163:5200
```

Connection string nam trong `appsettings.json` va dang tro toi SQL Server local:

```text
Server=localhost\MSSQLSERVER01;Database=PetNoVaDB;Trusted_Connection=True;TrustServerCertificate=True;
```

## Cau hinh Cloudinary

Khong dat `API secret` trong source code. Tu thu muc goc `petnova_app`, chay:

```powershell
.\configure_petnova_cloudinary.cmd
```

Script se luu `Cloud name`, `API key` va `API secret` bang .NET User Secrets.
Huong dan day du nam tai `docs/CloudinaryPetNoVa.md`.

## Cau hinh OTP quen mat khau

Khong dat Gmail App Password hoac Firebase service-account trong source code.
Tu thu muc goc `petnova_app`, chay:

```powershell
.\configure_petnova_password_reset.cmd
```

Huong dan day du nam tai `docs/PasswordResetPetNoVa.md`.
