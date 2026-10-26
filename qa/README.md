# Kiểm thử PetNoVa

Đợt kiểm thử ngày 26/10/2026 đối chiếu tài liệu `Nhóm09FullnewsPetNoVa.xlsx`. Báo cáo chính: [bao-cao-kiem-thu.md](results/bao-cao-kiem-thu.md). File Excel nguồn được giữ nguyên.

Các bộ kiểm tra bên dưới có phạm vi khác nhau. Kết quả PASS của helper/controller không đồng nghĩa đã chạy xong một test case giao diện trong Excel.

## Chạy kiểm tra giao diện và logic React

Từ thư mục gốc dự án, mở PowerShell:

```powershell
cd web-react
npm ci
node --test tests/khach-hang.test.mjs tests/van-hanh.test.mjs tests/xac-thuc.test.mjs
npm run build
cd ..
```

Các test dùng dữ liệu giả lập trong bộ nhớ, không gửi OTP, tạo tài khoản Firebase hay sửa database thật. Riêng `van-hanh.test.mjs` mô phỏng hook để tái hiện phản hồi chậm của component; cần kiểm thử tiếp bằng trình duyệt thật.

## Chạy hồi quy logic API không dùng database

```powershell
dotnet build backend/PetNoVaApi/PetNoVaApi.csproj
dotnet run --project qa/tests-api/PetNoVaApi.Regression.csproj -- backend/PetNoVaApi/bin/Debug/net10.0/PetNoVaApi.dll qa/results/api-after.json
```

Nếu backend đang giữ DLL, hãy dừng đúng terminal backend trước khi build. Bộ này gọi logic khung giờ và kiểm tra dịch vụ trong DLL thật, không chạy HTTP/Firebase/SQL.

## Chạy tích hợp SQL trên bản sao QA

Database thử nghiệm tên cố định `PetNoVaDB_QA_20261026`, instance `lpc:.\MSSQLSERVER01`. Bộ test từ chối database khác; cần có sẵn loại dịch vụ và hình thức chăm sóc từ bản sao nguồn.

Nếu database QA chưa tồn tại, tạo một lần:

```powershell
sqlcmd -S 'lpc:.\MSSQLSERVER01' -E -C -b -i qa/chuan-bi-db.sql
```

Script dùng COPY_ONLY backup và restore sang tên/file mới, không ghi đè database có sẵn. Database và backup này chứa dữ liệu sao chép từ nguồn; không đưa vào Git hoặc gói ZIP chia sẻ công khai.

```powershell
dotnet run --project qa/integration-api/PetNoVaApi.Integration.csproj -- qa/results/sql-integration.json
```

Bộ này gọi controller thật với SQL thật trong bản sao, gán danh tính thử nghiệm vào HttpContext. Webhook dùng SDK PayOS xác minh HMAC cục bộ với khóa QA giả. Nó **không** chứng minh luồng đăng nhập Firebase, bộ lọc HTTP, SMTP hoặc thanh toán PayOS thật hoạt động. Mỗi lần chạy giữ lại fixture có tiền tố `Q...`, dùng khoảng ngày còn trống để tránh ghi đè dữ liệu cũ. Nếu hết khoảng ngày thử, bộ test dừng và báo lỗi.

## Kiểm tra HTTP

Khởi động website bằng `run_petnova_web_dev.cmd`, rồi chạy ở terminal khác:

```powershell
.\qa\kiem-tra-http.ps1
```

Script chỉ chấp nhận URL loopback. Nó kiểm tra health, request không có token/token sai, phiên reset không hợp lệ và webhook sai chữ ký; không chuyển tiền, không gửi OTP thật.

## Đọc kết quả

- `results/frontend.xml`: kết quả 19 kiểm tra phía React/JavaScript.
- `results/api-before.json`, `results/api-after.json`: hồi quy logic API trước/sau.
- `results/van-hanh-before.xml`: tái hiện 5 lỗi component trên mã trước sửa, ref `e573b91`.
- `results/sql-confirm-before.json`: tái hiện hai lần xác nhận tiền mặt đồng thời cùng thành công.
- `results/sql-other-payment-before.json`: tái hiện thao tác thanh toán mâu thuẫn và ghi nhận hoàn tiền lặp cùng thành công.
- `results/sql-webhook-before.json`: tái hiện thông báo PAID trùng khi webhook hợp lệ đến đồng thời.
- `results/sql-integration.json`: kiểm tra tích hợp SQL sau sửa.
- `results/http.json`: HTTP trên API đang chạy.
- `results/npm-audit.json`, `results/nuget-audit.json`: kiểm tra cảnh báo thư viện tại thời điểm chạy.
- `results/doi-chieu-testcase.csv` và `.json`: đối chiếu từng ca nguồn; mở CSV trong Excel được.

`KIEM_TRA_MOT_PHAN` nghĩa là có bằng chứng cho một phần ca; `CHUA_THUC_HIEN` nghĩa là chưa có bằng chứng được đối chiếu. Không lấy cột Passed có sẵn trong Excel nguồn làm kết quả của đợt này.
