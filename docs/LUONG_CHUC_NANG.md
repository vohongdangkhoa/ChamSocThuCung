# Các luồng chức năng hiện có của PetNoVa

> Cập nhật ngày 19/07/2026. Tài liệu được tổng hợp từ mã nguồn Flutter trong `lib/` và các API ASP.NET Core trong `backend/PetNoVaApi/`.

## 1. Tổng quan vai trò

Ứng dụng hiện có 4 vai trò:

| Vai trò | Màn hình chính | Chức năng chính |
| --- | --- | --- |
| `CUSTOMER` | Khách hàng | Quản lý thú cưng, đặt/hủy lịch, thanh toán, xem bệnh án và lịch tiêm, quản lý tài khoản và thông báo |
| `STAFF` | Nhân viên | Theo dõi lịch hẹn, xác nhận thanh toán, cập nhật tiến trình dịch vụ |
| `VET` | Bác sĩ thú y | Xem danh sách thú cưng, thêm bệnh án, xem/thêm lịch tiêm |
| `ADMIN` | Quản trị viên | Xem thống kê, phân quyền người dùng, quản lý gói dịch vụ và nhân viên |

## 2. Luồng khởi động, xác thực và phân quyền

### 2.1. Tự động kiểm tra phiên đăng nhập

1. Mở ứng dụng và hiển thị Splash Screen.
2. Kiểm tra người dùng hiện tại trong Firebase Authentication.
3. Nếu chưa đăng nhập, chuyển đến màn hình đăng nhập.
4. Nếu đã đăng nhập, tải tài khoản PetNoVa theo Firebase UID; nếu không tìm thấy thì thử theo email.
5. Nếu tài khoản không ở trạng thái `ACTIVE`, đăng xuất và quay về màn hình đăng nhập.
6. Nếu tài khoản hợp lệ, điều hướng theo vai trò `CUSTOMER`, `STAFF`, `VET` hoặc `ADMIN`.

### 2.2. Đăng ký khách hàng

1. Từ màn hình đăng nhập, chọn **Đăng ký ngay**.
2. Nhập họ tên, email, số điện thoại và mật khẩu.
3. Ứng dụng kiểm tra đủ thông tin và mật khẩu có ít nhất 6 ký tự.
4. Tạo tài khoản Firebase Authentication.
5. Tạo tài khoản PetNoVa với vai trò `CUSTOMER` và trạng thái `ACTIVE`.
6. Chuyển thẳng đến trang chủ khách hàng.

### 2.3. Đăng nhập

1. Nhập email và mật khẩu.
2. Xác thực bằng Firebase Authentication.
3. Tải thông tin tài khoản PetNoVa và kiểm tra trạng thái.
4. Điều hướng đến trang chủ tương ứng với vai trò.

### 2.4. Đăng xuất

Người dùng chọn đăng xuất tại màn hình của vai trò hiện tại. Ứng dụng đăng xuất Firebase, xóa ngăn xếp điều hướng và quay về màn hình đăng nhập.

## 3. Luồng khách hàng (`CUSTOMER`)

Khu vực khách hàng có 4 tab: **Trang chủ**, **Thú cưng**, **Đặt lịch** và **Tài khoản**.

### 3.1. Xem trang tổng quan

- Xem lời chào, các thẻ thông tin và lối tắt đến quản lý thú cưng hoặc đặt lịch.
- Xem các nội dung giới thiệu dịch vụ và nhắc nhở trên giao diện.

Lưu ý: một số số liệu và nội dung nhắc nhở trên trang tổng quan đang là nội dung trình bày tĩnh, chưa được tải động từ API.

### 3.2. Quản lý hồ sơ thú cưng

#### Thêm thú cưng

1. Mở tab **Thú cưng** và chọn **Thêm thú cưng**.
2. Nhập tên, loài, giống, giới tính, ngày sinh, cân nặng và tình trạng sức khỏe.
3. Ứng dụng kiểm tra trường bắt buộc và cân nặng hợp lệ.
4. Liên kết thú cưng với tài khoản khách hàng đang đăng nhập.
5. Gửi dữ liệu lên API và tải lại danh sách.

#### Xem và sửa hồ sơ

1. Chọn một thú cưng trong danh sách để mở hồ sơ chi tiết.
2. Xem thông tin cơ bản và tình trạng sức khỏe.
3. Chọn sửa hồ sơ, cập nhật thông tin rồi lưu.
4. Ứng dụng gọi API cập nhật thú cưng và làm mới dữ liệu hiển thị.

#### Nhật ký sức khỏe

1. Từ hồ sơ thú cưng, mở **Nhật ký**.
2. Nhập cân nặng, lượng thức ăn, triệu chứng và ghi chú.
3. Lưu và xem bản ghi vừa thêm trong danh sách hiện tại.

Lưu ý: nhật ký sức khỏe hiện chỉ lưu trong bộ nhớ của màn hình, chưa có service/API và sẽ mất khi rời hoặc tạo lại màn hình.

### 3.3. Xem lịch tiêm và bệnh án

- Từ danh sách thú cưng, khách hàng có thể mở **Lịch tiêm** để xem các mũi tiêm của đúng thú cưng.
- Khách hàng có thể mở **Bệnh án** để xem ngày khám, chẩn đoán, điều trị và ghi chú.
- Đây là luồng chỉ xem; thao tác thêm dữ liệu thuộc vai trò bác sĩ thú y.

### 3.4. Đặt lịch dịch vụ

1. Mở tab **Đặt lịch**.
2. Ứng dụng tải thú cưng của khách hàng, các gói dịch vụ đang `ACTIVE`, lịch hẹn, chi tiết lịch và thanh toán liên quan.
3. Chọn thú cưng.
4. Chọn loại hình chăm sóc:
   - `CT001`: Đến trung tâm.
   - `CT002`: Gửi thú cưng.
5. Chọn gói dịch vụ, ngày và giờ hẹn.
6. Chọn hình thức thanh toán: tiền mặt hoặc chuyển khoản ngân hàng.
7. Nhập ghi chú nếu cần và xác nhận đặt lịch.
8. Hệ thống lần lượt tạo:
   - Lịch hẹn ở trạng thái `PENDING`.
   - Chi tiết lịch hẹn gắn với gói dịch vụ.
   - Thanh toán ở trạng thái `PENDING`.
9. Danh sách lịch hẹn được tải lại.

### 3.5. Theo dõi và hủy lịch hẹn

- Khách hàng xem được thú cưng, loại hình chăm sóc, dịch vụ, ngày giờ, tổng tiền, trạng thái lịch và trạng thái thanh toán.
- Khách hàng chỉ có thể hủy lịch khi lịch ở `PENDING` hoặc `CONFIRMED`.
- Khi xác nhận hủy, lịch chuyển sang `CANCELLED` và hệ thống tạo thông báo liên quan.
- Lịch đã hủy chỉ được giữ trong danh sách hiển thị khách hàng trong khoảng 30 ngày dựa trên thời điểm hủy/cập nhật.

### 3.6. Thanh toán

#### Tiền mặt

1. Khi đặt lịch, chọn **Tiền mặt**.
2. Thanh toán được tạo ở trạng thái `PENDING`.
3. Khách hàng xem hướng dẫn thanh toán tại quầy.
4. Nhân viên xác nhận sau khi nhận tiền; trạng thái chuyển thành `PAID`.

#### Chuyển khoản qua PayOS

1. Khi đặt lịch, chọn **Chuyển khoản ngân hàng**.
2. Mở lịch hẹn và chọn **Thanh toán**.
3. Ứng dụng yêu cầu backend tạo liên kết thanh toán PayOS và mở liên kết ngoài ứng dụng.
4. Sau khi thanh toán, khách hàng chọn **Kiểm tra trạng thái**.
5. Backend đồng bộ trạng thái PayOS; nếu thành công, thanh toán chuyển thành `PAID`.

Khách hàng có thể xem lại thông tin thanh toán, số tiền, nội dung chuyển khoản, phương thức và trạng thái.

### 3.7. Hồ sơ tài khoản và giao diện

- Xem thông tin tài khoản hiện tại.
- Cập nhật họ tên và số điện thoại; dữ liệu được cập nhật qua API theo email.
- Chuyển đổi giao diện sáng/tối.
- Đăng xuất.

### 3.8. Thông báo

1. Từ tab **Tài khoản**, mở **Thông báo**; biểu tượng hiển thị số thông báo chưa đọc.
2. Tải danh sách thông báo của đúng người dùng.
3. Chạm vào một thông báo để đánh dấu đã đọc.
4. Có thể đánh dấu toàn bộ là đã đọc.
5. Có thể vào chế độ chọn nhiều và ẩn các thông báo khỏi danh sách cá nhân.

Việc “xóa” trên giao diện là ẩn cục bộ theo người dùng; dữ liệu thông báo gốc trên backend vẫn được giữ.

Thông báo được backend tạo khi lịch hẹn bị hủy hoặc khi nhân viên chuyển lịch sang các trạng thái `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`.

## 4. Luồng nhân viên (`STAFF`)

### 4.1. Theo dõi lịch hẹn

1. Mở màn hình nhân viên.
2. Ứng dụng tải toàn bộ lịch hẹn, chi tiết lịch, thú cưng, gói dịch vụ và thanh toán.
3. Nhân viên xem khách hàng, thú cưng, loại hình, dịch vụ, ngày giờ, tổng tiền, ghi chú và trạng thái.
4. Có thể kéo để làm mới hoặc dùng nút tải lại.

### 4.2. Cập nhật tiến trình dịch vụ

Luồng trạng thái được giới hạn tuần tự:

```text
PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED
```

- `PENDING -> CONFIRMED`: xác nhận lịch.
- `CONFIRMED -> IN_PROGRESS`: bắt đầu chăm sóc.
- `IN_PROGRESS -> COMPLETED`: hoàn thành dịch vụ.
- `CANCELLED` và `COMPLETED` là trạng thái kết thúc, không thể chuyển tiếp.
- Chỉ được chuyển sang `COMPLETED` khi thanh toán liên quan đã ở trạng thái `PAID`.
- Mỗi lần chuyển trạng thái cần xác nhận và sẽ tạo thông báo cho khách hàng.

### 4.3. Xác nhận thanh toán

- Với thanh toán đang `PENDING`, nhân viên chọn **Xác nhận thanh toán**.
- Backend cập nhật thanh toán thành `PAID`.
- Sau khi thanh toán thành công, lịch đang `IN_PROGRESS` mới có thể hoàn tất.

## 5. Luồng bác sĩ thú y (`VET`)

### 5.1. Xem danh sách thú cưng

- Tải toàn bộ thú cưng từ API.
- Xem mã thú cưng, chủ nuôi, giống, giới tính, ngày sinh, cân nặng và tình trạng sức khỏe.
- Có thể tải lại danh sách.

### 5.2. Quản lý bệnh án

1. Chọn thú cưng và mở **Xem bệnh án**.
2. Tải danh sách bệnh án của thú cưng.
3. Xem ngày khám, chẩn đoán, điều trị và ghi chú.
4. Chọn thêm bệnh án, nhập chẩn đoán, điều trị và ghi chú.
5. Lưu qua API và tải lại danh sách.

### 5.3. Quản lý lịch tiêm

1. Chọn thú cưng và mở **Lịch tiêm**.
2. Tải danh sách tiêm chủng của thú cưng.
3. Xem tên vaccine, ngày tiêm, ngày tiêm tiếp theo và ghi chú.
4. Với quyền bác sĩ (`canAdd: true`), có thể thêm bản ghi tiêm chủng mới qua API.

## 6. Luồng quản trị viên (`ADMIN`)

Khu vực quản trị có 4 tab: **Tổng quan**, **Người dùng**, **Dịch vụ** và **Nhân viên**.

### 6.1. Xem tổng quan hệ thống

Dashboard tải dữ liệu từ API và hiển thị:

- Tổng số lịch hẹn.
- Số lịch đang chờ xử lý (`PENDING`).
- Tổng số thú cưng.
- Số thanh toán đã `PAID`.
- Tổng doanh thu từ các thanh toán đã `PAID`.

### 6.2. Xem người dùng

1. Tải danh sách tài khoản.
2. Xem họ tên, email, số điện thoại, vai trò và trạng thái.
3. Việc tạo và quản lý tài khoản `STAFF`/`VET` được thực hiện riêng tại tab **Nhân viên**; không chuyển tài khoản khách hàng sang vai trò nhân sự.

### 6.3. Quản lý gói dịch vụ

- Tải và xem danh sách gói dịch vụ.
- Tìm kiếm theo mã, tên, mô tả hoặc danh mục.
- Thêm gói mới với tên, mô tả, loại chăm sóc, thời lượng và giá; gói mới mặc định `ACTIVE`.
- Sửa tên, mô tả, danh mục, thời lượng và giá gói dịch vụ.
- Xóa gói chưa phát sinh lịch hẹn; gói đã được sử dụng phải chuyển sang `INACTIVE` để giữ lịch sử.
- Bật/tắt trạng thái gói dịch vụ.
- Chỉ gói `ACTIVE` xuất hiện trong danh sách đặt lịch của khách hàng.

### 6.4. Quản lý nhân viên

- Tải và xem danh sách nhân viên/bác sĩ cùng thông tin liên hệ, vai trò, trạng thái và số lần vi phạm.
- Tìm kiếm theo mã nhân sự, họ tên, email hoặc số điện thoại; lọc riêng `STAFF` và `VET`.
- Thêm trực tiếp nhân viên hoặc bác sĩ với tài khoản Firebase đăng nhập riêng mà không làm admin bị đăng xuất.
- Sửa họ tên, số điện thoại và chuyển đổi vai trò `STAFF`/`VET`; email đăng nhập không sửa tại màn hình này.
- Xóa hồ sơ nhân sự; tài khoản liên kết được chuyển về `CUSTOMER` để giữ lịch sử Firebase và dữ liệu liên quan.
- Bật/tắt trạng thái hoạt động.
- Ghi nhận thêm một lần vi phạm.
- Kích hoạt lại nhân viên đang `SUSPENDED`.

## 7. Các trạng thái nghiệp vụ chính

### 7.1. Tài khoản

- `ACTIVE`: được phép đăng nhập và sử dụng app.
- Trạng thái khác `ACTIVE`: bị đăng xuất/chặn tại bước kiểm tra phiên hoặc đăng nhập.

### 7.2. Lịch hẹn

| Trạng thái | Ý nghĩa | Thao tác tiếp theo |
| --- | --- | --- |
| `PENDING` | Chờ nhân viên xác nhận | Khách có thể hủy; nhân viên có thể xác nhận |
| `CONFIRMED` | Đã xác nhận | Khách có thể hủy; nhân viên có thể bắt đầu dịch vụ |
| `IN_PROGRESS` | Đang thực hiện | Nhân viên có thể hoàn tất khi đã thanh toán |
| `COMPLETED` | Đã hoàn thành | Kết thúc |
| `CANCELLED` | Đã hủy | Kết thúc |

### 7.3. Thanh toán

- `PENDING`: chờ khách thanh toán hoặc chờ nhân viên xác nhận.
- `PAID`: đã thanh toán; cho phép hoàn tất dịch vụ.
- Backend cũng có luồng chuyển thanh toán sang thất bại, nhưng hiện chưa có thao tác tương ứng trên giao diện chính.

### 7.4. Gói dịch vụ

- `ACTIVE`: khách hàng có thể chọn khi đặt lịch.
- Không `ACTIVE`: vẫn được quản trị viên nhìn thấy nhưng không xuất hiện trong form đặt lịch.

## 8. Màn hình/chức năng đã có mã nhưng chưa hoàn chỉnh hoặc chưa nối vào luồng chính

| Chức năng | Hiện trạng |
| --- | --- |
| Nhật ký sức khỏe | Chỉ lưu trong state cục bộ, chưa lưu API/cơ sở dữ liệu |
| Lịch sử thanh toán riêng | Màn hình dùng dữ liệu mẫu cố định và hiện không được điều hướng từ luồng chính |
| Thông báo gần đây trong trang tài khoản | Hai mục hiển thị là nội dung tĩnh; danh sách thông báo đầy đủ mới dùng API |
| Một số số liệu/nội dung trang chủ khách hàng | Mang tính trình bày tĩnh, chưa đồng bộ từ backend |
| `HomeScreen` cơ bản | Là màn hình cũ/độc lập, không nằm trong luồng phân quyền hiện tại |

## 9. Tóm tắt luồng end-to-end chính

```text
Khách đăng ký/đăng nhập
  -> thêm thú cưng
  -> chọn gói và đặt lịch
  -> hệ thống tạo lịch + chi tiết + thanh toán PENDING
  -> nhân viên xác nhận lịch
  -> nhân viên bắt đầu dịch vụ
  -> khách thanh toán PayOS hoặc nhân viên xác nhận tiền mặt
  -> nhân viên hoàn thành dịch vụ
  -> khách nhận thông báo và xem lại trạng thái
  -> bác sĩ cập nhật bệnh án/lịch tiêm cho thú cưng
```
