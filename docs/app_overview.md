# Tong quan app PetNoVa

Tai lieu nay ghi lai nhung phan app hien dang co trong source Flutter, kem
phan thay doi chua commit o working tree. No giup nam nhanh project truoc khi
sua tiep UI, API hoac luong nghiep vu.

## 1. App nay la gi

PetNoVa la app Flutter cho cham soc thu cung, dat lich dich vu, theo doi ho so
dung.

Project hien co:

- Flutter/Dart app: `lib/main.dart`.
- Firebase Core va Firebase Auth: dang nhap, dang ky, kiem tra user hien tai.
- Backend REST API qua package `http`.
- Theme rieng trong `lib/theme`.
- Models trong `lib/models`.
- API services trong `lib/services`.
- Screens trong `lib/screens`.
- Asset icon: `assets/images/petnova_icon.png`.
- Ho tro nhieu platform mac dinh cua Flutter: Android, iOS, web, Windows,
  macOS, Linux.

## 2. Cong nghe va cau hinh

Dependencies chinh trong `pubspec.yaml`:

- `firebase_core`
- `firebase_auth`
- `http`
- `cupertino_icons`
- `flutter_launcher_icons`

Luon chay app tu `main.dart`:

1. `WidgetsFlutterBinding.ensureInitialized()`
2. `Firebase.initializeApp(...)`
3. `runApp(PetNoVaApp())`
4. `MaterialApp` dung theme `AppTheme.light`
5. Man dau tien la `SplashScreen`

Base URL API nam o `lib/config/api_config.dart`:

- Neu build voi `--dart-define=API_BASE_URL=...` thi dung URL do.
- Web mac dinh: `http://localhost:5200`
- Android mac dinh: `http://192.168.2.108:5200`
- Platform khac mac dinh: `http://localhost:5200`

## 3. Luong dang nhap va phan quyen

App dang dung Firebase Auth de xac thuc email/password. Sau khi co Firebase
user, app goi backend `UserAccounts` de lay thong tin SQL/user profile va role.

Role dang co:

- `CUSTOMER`: khach hang/chu thu cung.
- `STAFF`: nhan vien cham soc/xu ly lich.
- `VET`: bac si thu y.
- `ADMIN`: quan tri vien.

Man hinh dieu huong theo role:

- `SplashScreen`: kiem tra da dang nhap chua, lay user backend, kiem tra status,
  roi day vao home theo role.
- `LoginScreen`: dang nhap Firebase, lay user backend, chuyen home theo role.
- `RegisterScreen`: tao Firebase account, tao user backend mac dinh role
  `CUSTOMER`, roi vao man customer.

Neu tai khoan bi khoa/tam ngung hoac role khong hop le, app se sign out va tra
ve login.

## 4. Cac man hinh chinh

### Customer

`CustomerHomeScreen` la home cua khach hang, co bottom navigation:

- `Trang chu`
- `Thu cung`
- `Dat lich`
- `Tai khoan`

Nhung viec customer dang lam duoc:

- Xem danh sach thu cung cua tai khoan hien tai.
- Them thu cung moi qua `AddPetScreen`.
- Xem chi tiet thu cung qua `PetDetailScreen`.
- Cap nhat ho so thu cung qua `EditPetScreen`.
- Xem/ghi nhat ky suc khoe qua `HealthLogScreen`.
- Xem lich tiem cua tung thu cung qua `CustomerVaccinationPage`.
- Xem benh an cua tung thu cung qua `CustomerMedicalRecordPage`.
- Dat lich dich vu trong `BookingPage`.
- Tao booking detail va payment khi dat lich.
- Xem lich hen da dat.
- Mo man thanh toan cho lich hen: CASH hien huong dan tra tai trung tam,
  BANK_TRANSFER hien thong tin chuyen khoan, PENDING la cho thanh toan, PAID la
  da thanh toan.
- Xem/cap nhat tai khoan qua `ProfilePage` va `EditProfileScreen`.

### Admin

`AdminHomeScreen` co bottom navigation:

- `Tong quan`
- `Nguoi dung`
- `Dich vu`
- `Nhan vien`

Nhung viec admin dang lam duoc:

- Xem tong quan dashboard: du lieu lay tu booking, pet, payment.
- Xem danh sach nguoi dung.
- Gan role `STAFF` hoac `VET` cho user dang la `CUSTOMER`.
- Xem/them goi dich vu.
- Bat/tat trang thai goi dich vu.
- Xem nhan vien.
- Doi trang thai nhan vien.
- Ghi nhan vi pham nhan vien.
- Kich hoat lai nhan vien.

### Staff

`StaffHomeScreen` la man cho nhan vien. Hien co:

- Xem danh sach booking.
- Lay kem booking detail, goi dich vu va payment.
- Cap nhat trang thai lich hen.
- Xac nhan thanh toan.
- Hien thong tin khach hang, thu cung, loai hinh, goi dich vu, ngay gio, tong
  tien, thanh toan va ghi chu.

### Vet

`VetHomeScreen` la man cho bac si thu y. Hien co:

- Xem danh sach thu cung.
- Xem thong tin chi tiet thu cung.
- Mo benh an cua thu cung.
- Mo lich tiem cua thu cung.
- Them benh an qua `MedicalRecordScreen`.
- Them lich tiem qua `VaccinationScreen`.

### Cac man phu/khac

- `HomeScreen`: man placeholder cu, hien email/Firebase UID va ghi chu ve role.
- `PaymentHistoryScreen`: man lich su thanh toan dang hien UI rieng, chua thay
  luong chinh goi den.
- `CustomerPaymentPage`: man thanh toan lich hen cho customer, hien huong dan
  CASH/BANK_TRANSFER va trang thai PENDING/PAID.
- `NotificationScreen`: man thong bao voi du lieu local/mock.
  checkout tam bang cach tru ton kho.

## 5. Models hien co

Trong `lib/models`:

- `UserAccountModel`: user backend, Firebase UID, ho ten, email, phone, role,
  status, FCM token, createdAt.
- `StaffModel`: nhan vien, role, status, violationCount, userId lien ket.
- `PetModel`: thu cung, chu nuoi, ten, loai, giong, gioi tinh, ngay sinh, can
  nang, tinh trang suc khoe.
- `BookingModel`: lich hen, user, pet, staff, careTypeId, ngay/gio, tong tien,
  status, note, createdAt, updatedAt, cancelledAt.
- `BookingDetailModel`: chi tiet lich hen, so luong, gia, bookingId, serviceId.
- `ServicePackageModel`: goi dich vu, mo ta, gia, thoi luong, status,
  categoryId.
- `PaymentModel`: thanh toan, phuong thuc, so tien, status, ngay, bookingId.
- `MedicalRecordModel`: benh an, chan doan, dieu tri, ngay kham, note, pet,
  staff.
- `VaccinationModel`: tiem chung, ten vaccine, ngay tiem, ngay nhac lai, note,
  pet, staff.
- `HealthLogModel`: nhat ky suc khoe local: ngay, can nang, luong an, trieu
  chung, note.
- `NotificationModel`: thong bao local/mock: title, message, type, createdAt,
  isRead.

## 6. API services hien co

Trong `lib/services`:

- `UserAccountApiService`
  - Lay danh sach user.
  - Lay user theo Firebase UID.
  - Lay user theo email.
  - Tao user backend.
  - Cap nhat profile theo email.
- `AdminUserApiService`
  - Lay danh sach user dang dynamic `List`.
  - Gan role user.
- `StaffApiService`
  - Lay staff.
  - Doi trang thai staff.
  - Ghi nhan vi pham.
  - Kich hoat staff.
- `PetApiService`
  - Lay tat ca pets.
  - Lay pets theo userId.
  - Them pet.
  - Cap nhat pet.
- `BookingApiService`
  - Lay tat ca booking.
  - Lay booking theo userId.
  - Them booking.
  - Huy booking.
  - Xoa booking.
  - Cap nhat trang thai booking.
- `BookingDetailApiService`
  - Lay tat ca booking detail.
  - Lay booking detail theo bookingId.
  - Them booking detail.
- `ServicePackageApiService`
  - Lay goi dich vu.
  - Them goi dich vu.
  - Cap nhat goi dich vu.
  - Bat/tat status goi dich vu.
- `PaymentApiService`
  - Lay thanh toan.
  - Lay thanh toan theo booking.
  - Tao thanh toan.
  - Xac nhan thanh toan.
  - Chuyen thanh toan sang failed.
- `MedicalRecordApiService`
  - Lay benh an theo pet.
  - Them benh an.
- `VaccinationApiService`
  - Lay lich tiem theo pet.
  - Them lich tiem.
  - Tru ton kho.

## 7. Theme va UI dung chung

Trong `lib/theme`:

- `app_theme.dart`
  - `AppColors`
  - `AppSpacing`
  - `AppShadows`
  - `AppTheme.light`
- `app_widgets.dart`
  - `AppBackground`
  - `SoftCard`
  - `GradientCard`
  - `StatusBadge`
  - `IconAvatar`
  - `SectionTitle`
  - `PetWeightChart`

Day la nen UI dung chung cho cac man hinh moi, nen khi sua giao dien nen uu
tien dung lai cac class nay de app dong bo.

## 8. Tai lieu da co san

Da co file `docs/petnova_class_diagram.md`.

File nay ghi class diagram bang Mermaid cho:

- Models.
- Services.
- Quan he logic giua cac model qua ID.
- Quan he giua man hinh Flutter va service.

Luu y: `BookingApiService` co ca soft-cancel (`cancelBooking`) va hard-delete
(`deleteBooking`), nhung man customer nen dung soft-cancel de giu lich trong he
thong.

Tai lieu bo sung:

- `docs/services.md`: ghi rieng toan bo API services, endpoint, status code,
  loi hay gap va checklist debug khi API loi.
- `docs/config_main_pubspec.md`: ghi rieng `api_config.dart`, `main.dart`,
  `pubspec.yaml`, cach chay voi `API_BASE_URL` va loi hay gap khi app khong
  khoi dong/khong ket noi backend.

## 9. Nhung thay doi dang luu y

Git dang co mot so file modified/untracked trong working tree, nen truoc khi
commit can xem lai `git status`.

Nhung file nghiep vu dang dang chu y:

- `lib/screens/customer_home_screen.dart`
- `lib/screens/login_screen.dart`
- `lib/services/booking_api_service.dart`

Chi tiet y nghia:

- `customer_home_screen.dart`
  - BookingPage hien giu booking `CANCELLED` trong lich su khach hang 30 ngay.
  - Sau 30 ngay, booking `CANCELLED` se duoc an khoi danh sach customer.
  - Neu backend tra `cancelledAt` hoac `updatedAt`, app dung moc do de tinh 30
    ngay; neu khong co thi tam fallback ve `bookingDate`.
  - Lich vua duoc customer huy trong phien hien tai co moc huy local de khong
    bi an sai ngay sau khi reload data.
  - Customer dung nut `Huy lich hen`, khong dung nut xoa khoi he thong.
  - Chi hien nut huy voi lich `PENDING` hoac `CONFIRMED`.
  - Khi huy, app goi `BookingApiService.cancelBooking(...)`, sau do load lai
    data de lich chuyen sang trang thai `CANCELLED`.
- `booking_api_service.dart`
  - Them ham `deleteBooking(String bookingId)`.
  - Goi `DELETE /api/Bookings/{bookingId}`.
  - Chap nhan status `200`, `202`, `204`, `404` la thanh cong/khong can bao loi.
  - Ham nay khong nen dung cho customer cancel flow; customer nen dung
    `cancelBooking`.
  - Them helper `_errorMessage(...)` de bao loi API ro hon.
    response body.
- `login_screen.dart`
  - Chu yeu la format lai UI code, khong thay doi hanh vi dang nhap.

## 10. Nhung phan con tam/thieu API

Mot so phan da co UI/model nhung chua that su day du ve backend hoac luong:

- `HealthLogModel` hien dang dung local trong UI, chua co API service.
- `NotificationModel` va `NotificationScreen` dang giong du lieu local/mock,
  chua co API service.
- `PaymentHistoryScreen` la UI rieng, chua thay duoc gan vao luong chinh ro
  rang.
  phong, chua co checkout day du.
- `CustomerMedicalRecordPage` va `CustomerVaccinationPage` co cho goi HTTP truc
  tiep thay vi di qua service/model dong bo.
- `AdminUserApiService.getUsers()` dang tra `List` dynamic, chua type thanh
  `List<UserAccountModel>`.
- `BookingModel.careTypeId` va `ServicePackageModel.categoryId` chua co model
  rieng trong app.
- Test hien co moi la test don gian: `PetNoVaApp can be created`.

## 11. Nen nho khi sua tiep

- Neu sua API URL, xem `lib/config/api_config.dart`.
- Neu sua luong role, xem `SplashScreen` va `LoginScreen`.
- Neu sua UI tong the, xem `lib/theme/app_theme.dart` va `lib/theme/app_widgets.dart`.
- Neu sua customer flow, file lon nhat la `lib/screens/customer_home_screen.dart`.
- Neu sua admin flow, nhieu logic nam trong `lib/screens/admin_home_screen.dart`.
- Neu sua booking/payment, can xem dong thoi:
  - `BookingModel`
  - `BookingDetailModel`
  - `PaymentModel`
  - `BookingApiService`
  - `BookingDetailApiService`
  - `PaymentApiService`
  - `BookingPage`
- Neu sua pet medical/vaccine, xem:
  - `PetModel`
  - `MedicalRecordModel`
  - `VaccinationModel`
  - `PetApiService`
  - `MedicalRecordApiService`
  - `VaccinationApiService`
  - `VetHomeScreen`
  - `MedicalRecordScreen`
  - `VaccinationScreen`
