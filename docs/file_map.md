# PetNoVa File Map

File này là bản đồ logic của codebase. Cấu trúc thư mục thật vẫn giữ nguyên, đặc biệt `lib/screens/` đang để phẳng để tránh lỗi import, nhưng các file bên dưới được nhóm theo actor/chức năng để dễ tìm.

## Tổng Quan Nhanh

| Khu vực             | Thư mục/file                                             | Vai trò                                      |
| ------------------- | -------------------------------------------------------- | -------------------------------------------- |
| App entry           | `lib/main.dart`                                          | Khởi tạo Firebase, theme, mở `SplashScreen`  |
| Firebase            | `lib/firebase_options.dart`                              | Cấu hình Firebase theo platform              |
| Config              | `lib/config/api_config.dart`                             | Chọn API base URL theo web/android/platform  |
| Theme/UI dùng chung | `lib/theme/app_theme.dart`, `lib/theme/app_widgets.dart` | Màu, spacing, theme, widget style dùng chung |
| Screens             | `lib/screens/*.dart`                                     | Toàn bộ màn hình app                         |
| Services            | `lib/services/*.dart`                                    | Gọi API backend                              |
| Models              | `lib/models/*.dart`                                      | Parse dữ liệu JSON/backend                   |

## Screens Theo Actor Và Luồng

### Auth / Điều Hướng Ban Đầu

| File                               | Class chính      | Dùng cho                                                 |
| ---------------------------------- | ---------------- | -------------------------------------------------------- |
| `lib/screens/splash_screen.dart`   | `SplashScreen`   | Màn splash, kiểm tra Firebase user, điều hướng theo role |
| `lib/screens/login_screen.dart`    | `LoginScreen`    | Đăng nhập, lấy role user rồi đưa về màn tương ứng        |
| `lib/screens/register_screen.dart` | `RegisterScreen` | Đăng ký tài khoản customer                               |

### Customer

| File                                            | Class chính                                                             | Dùng cho                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| `lib/screens/customer_home_screen.dart`         | `CustomerHomeScreen`, `CustomerDashboardPage`, `PetPage`, `BookingPage` | Home customer, dashboard, danh sách pet, đặt lịch |
| `lib/screens/customer_payment_page.dart`        | `CustomerPaymentPage`                                                   | Thanh toán booking của customer                   |
| `lib/screens/customer_medical_record_page.dart` | `CustomerMedicalRecordPage`                                             | Customer xem hồ sơ y tế của pet                   |
| `lib/screens/customer_vaccination_page.dart`    | `CustomerVaccinationPage`                                               | Customer xem lịch sử tiêm phòng của pet           |
| `lib/screens/profile_page.dart`                 | `ProfilePage`                                                           | Hồ sơ cá nhân, đổi theme, thông báo, đăng xuất    |
| `lib/screens/edit_profile_screen.dart`          | `EditProfileScreen`                                                     | Sửa thông tin cá nhân                             |

### Pet / Hồ Sơ Thú Cưng

| File                                     | Class chính           | Dùng cho                                     |
| ---------------------------------------- | --------------------- | -------------------------------------------- |
| `lib/screens/add_pet_screen.dart`        | `AddPetScreen`        | Thêm pet mới                                 |
| `lib/screens/edit_pet_screen.dart`       | `EditPetScreen`       | Sửa thông tin pet                            |
| `lib/screens/pet_detail_screen.dart`     | `PetDetailScreen`     | Chi tiết pet, mở sức khỏe/tiêm phòng/sửa pet |
| `lib/screens/health_log_screen.dart`     | `HealthLogScreen`     | Nhật ký sức khỏe của pet                     |
| `lib/screens/vaccination_screen.dart`    | `VaccinationScreen`   | Danh sách/thêm mũi tiêm cho pet              |
| `lib/screens/medical_record_screen.dart` | `MedicalRecordScreen` | Hồ sơ y tế, chủ yếu dùng cho vet             |

### Admin

| File                                          | Class chính                                                                                       | Dùng cho                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `lib/screens/admin_user_management_page.dart` | `AdminUserManagementPage`                                                                         | Quản lý tài khoản và phân quyền user                  |

### Staff

| File                                 | Class chính       | Dùng cho                                             |
| ------------------------------------ | ----------------- | ---------------------------------------------------- |
| `lib/screens/staff_home_screen.dart` | `StaffHomeScreen` | Staff xem/xử lý booking, thanh toán, trạng thái lịch |

### Vet

| File                                     | Class chính           | Dùng cho                                           |
| ---------------------------------------- | --------------------- | -------------------------------------------------- |
| `lib/screens/vet_home_screen.dart`       | `VetHomeScreen`       | Vet xem danh sách pet, mở hồ sơ y tế và tiêm phòng |
| `lib/screens/medical_record_screen.dart` | `MedicalRecordScreen` | Vet thêm/xem hồ sơ y tế của pet                    |
| `lib/screens/vaccination_screen.dart`    | `VaccinationScreen`   | Vet thêm/xem lịch sử tiêm phòng của pet            |

### Payment

| File                                          | Class chính               | Dùng cho                                                      |
| --------------------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `lib/screens/customer_payment_page.dart`      | `CustomerPaymentPage`     | Thanh toán booking                                            |
| `lib/screens/payment_history_screen.dart`     | `PaymentHistoryScreen`    | Lịch sử thanh toán                                            |

### Shared / Legacy

| File                                   | Class chính          | Dùng cho            |
| -------------------------------------- | -------------------- | ------------------- |
| `lib/screens/notification_screen.dart` | `NotificationScreen` | Danh sách thông báo |
| `lib/screens/home_screen.dart`         | `HomeScreen`         | Màn home cũ/legacy  |

## Services Theo Backend Domain

| File                                            | Service                    | Gọi API cho                                           |
| ----------------------------------------------- | -------------------------- | ----------------------------------------------------- |
| `lib/services/api_client.dart`                  | `ApiClient`                | Wrapper HTTP chung, timeout, lỗi kết nối              |
| `lib/services/user_account_api_service.dart`    | `UserAccountApiService`    | Tài khoản user, Firebase UID, email, cập nhật profile |
| `lib/services/admin_user_api_service.dart`      | `AdminUserApiService`      | Admin quản lý và phân quyền user                      |
| `lib/services/pet_api_service.dart`             | `PetApiService`            | CRUD pet                                              |
| `lib/services/booking_api_service.dart`         | `BookingApiService`        | Booking/lịch hẹn                                      |
| `lib/services/booking_detail_api_service.dart`  | `BookingDetailApiService`  | Chi tiết dịch vụ trong booking                        |
| `lib/services/payment_api_service.dart`         | `PaymentApiService`        | Thanh toán, xác nhận/thất bại payment                 |
| `lib/services/notification_api_service.dart`    | `NotificationApiService`   | Thông báo user, đánh dấu đã đọc                       |
| `lib/services/medical_record_api_service.dart`  | `MedicalRecordApiService`  | Hồ sơ y tế                                            |
| `lib/services/vaccination_api_service.dart`     | `VaccinationApiService`    | Tiêm phòng                                            |
| `lib/services/service_package_api_service.dart` | `ServicePackageApiService` | Gói dịch vụ                                           |
| `lib/services/staff_api_service.dart`           | `StaffApiService`          | Nhân viên/staff                                       |

## Models Theo Domain

| File                                    | Model                 | Đại diện dữ liệu           |
| --------------------------------------- | --------------------- | -------------------------- |
| `lib/models/user_account_model.dart`    | `UserAccountModel`    | User account, role, status |
| `lib/models/pet_model.dart`             | `PetModel`            | Thú cưng                   |
| `lib/models/booking_model.dart`         | `BookingModel`        | Booking/lịch hẹn           |
| `lib/models/booking_detail_model.dart`  | `BookingDetailModel`  | Chi tiết booking           |
| `lib/models/payment_model.dart`         | `PaymentModel`        | Thanh toán                 |
| `lib/models/notification_model.dart`    | `NotificationModel`   | Thông báo                  |
| `lib/models/medical_record_model.dart`  | `MedicalRecordModel`  | Hồ sơ y tế                 |
| `lib/models/health_log_model.dart`      | `HealthLogModel`      | Nhật ký sức khỏe           |
| `lib/models/vaccination_model.dart`     | `VaccinationModel`    | Tiêm phòng                 |
| `lib/models/service_package_model.dart` | `ServicePackageModel` | Gói dịch vụ                |
| `lib/models/staff_model.dart`           | `StaffModel`          | Nhân viên                  |

## Nếu Sau Này Muốn Tách Thư Mục

Chưa nên tách trực tiếp khi app đang cần ổn định. Nếu muốn tách sau này, nên làm từng bước nhỏ:

1. Chỉ tách một nhóm trước, ví dụ `auth`.
2. Chạy `flutter analyze`.
3. Chạy `flutter test`.
4. Chạy thử Chrome.
5. Commit rồi mới tách nhóm tiếp theo.

Gợi ý nhóm tương lai:

```text
lib/screens/auth/
lib/screens/customer/
lib/screens/admin/
lib/screens/staff/
lib/screens/vet/
lib/screens/pet/
lib/screens/shared/
```

Hiện tại file map này đóng vai trò thay thế việc tách thư mục: code vẫn ít rủi ro, nhưng khi tìm file thì vẫn có bản đồ rõ ràng.
