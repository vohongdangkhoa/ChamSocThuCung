# PetNoVa Web

PetNoVa là website quản lý chăm sóc thú cưng. Giao diện được xây dựng bằng React, JavaScript và CSS; API dùng ASP.NET Core/.NET 10 cùng SQL Server.

## Cấu trúc

- `web-react/`: giao diện React/Vite.
- `backend/PetNoVaApi/`: REST API ASP.NET Core và kết nối SQL Server.
- `docs/`: tài liệu nghiệp vụ và API.

## Chạy trên VS Code

Mở Terminal ở thư mục dự án và chạy một lệnh:

```powershell
.\run_petnova_web_dev.ps1
```

Script mở API .NET và website React cùng lúc. Giữ terminal mở khi dùng website, rồi nhấn `Ctrl+C` để dừng. API do script mở sẽ tự dừng; lần chạy sau dùng mã nguồn mới. Nếu cổng 5200 đã có API chạy sẵn, script sẽ dùng phiên đó và không tự dừng nó.

Nếu thấy Vite đã báo `ready` ở một terminal khác, chỉ cần mở `http://localhost:5173/`; không chạy thêm lệnh lần nữa. Script cũng sẽ nhận ra khi PetNoVa đã chạy và không mở thêm phiên Vite trên cùng cổng.

Bạn cũng có thể bấm đúp `run_petnova_web_dev.cmd` trên Windows.

## Chạy từng phần (khi cần)

### 1. Chạy API

```powershell
cd backend\PetNoVaApi
dotnet run --launch-profile http
```

Chờ đến khi API hiện `Now listening on: http://127.0.0.1:5200`.

### 2. Chạy website

```powershell
cd web-react
npm install
npm run dev
```

Mở `http://localhost:5173/`. Chỉ cần chạy `npm install` ở lần đầu hoặc khi dependency thay đổi.

## Build để triển khai

```powershell
cd web-react
npm run build
```

Thư mục `web-react/dist/` là bản website đã build. Trước khi public, đặt `VITE_API_BASE_URL` thành URL HTTPS của API và giới hạn CORS trong backend theo domain thật.
