# Services guide

Tai lieu nay ghi rieng lop `lib/services`. Khi app loi API, loi JSON, loi
khong load du lieu hoac loi status code, doc file nay truoc.

## 1. Vai tro cua services

Services la lop noi giua UI Flutter va backend REST API.

Quy uoc hien tai:

- Tat ca service lay base URL tu `ApiConfig.baseUrl`.
- Goi API bang package `http`.
- Gui JSON bang `jsonEncode`.
- Doc JSON bang `jsonDecode`.
- Chuyen response thanh model bang `Model.fromJson`.
- Neu status code khong dung thi `throw Exception(...)` de UI hien SnackBar
  hoac error state.

Thu muc:

```text
lib/services/
  admin_user_api_service.dart
  booking_api_service.dart
  booking_detail_api_service.dart
  medical_record_api_service.dart
  payment_api_service.dart
  pet_api_service.dart
  service_package_api_service.dart
  staff_api_service.dart
  user_account_api_service.dart
  vaccination_api_service.dart
```

## 2. Bang API dang co

### UserAccountApiService

File: `lib/services/user_account_api_service.dart`

Dung cho dang nhap, dang ky, profile va mapping Firebase user voi user backend.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getUserAccounts()` | `GET /api/UserAccounts` | `200` | Tra `List<UserAccountModel>` |
| `getUserByFirebaseUid(firebaseUid)` | `GET /api/UserAccounts/firebase/{uid}` | `200` | UID duoc `Uri.encodeComponent` |
| `getUserByEmail(email)` | `GET /api/UserAccounts/email/{email}` | `200` | Email duoc `Uri.encodeComponent` |
| `createUserAccount(user)` | `POST /api/UserAccounts` | `201` hoac `200` | Dung sau Firebase register |
| `updateProfileByEmail(...)` | `PUT /api/UserAccounts/update-profile-by-email/{email}` | `204` | Cap nhat fullName va phone |

Loi hay gap:

- Firebase tao user thanh cong nhung backend tao user fail: app co Firebase
  account nhung khong co SQL account.
- Backend khong tim thay UID/email: login xong bi day ve login.
- Field JSON backend khac model: loi parse/null.

### AdminUserApiService

File: `lib/services/admin_user_api_service.dart`

Dung cho admin quan ly user va gan role.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getUsers()` | `GET /api/UserAccounts` | `200` | Hien dang tra `List` dynamic |
| `assignRole(userId, role)` | `PUT /api/UserAccounts/{userId}/assign-role` | `204` | Body: `{ "role": role }` |

Loi hay gap:

- `getUsers()` chua type thanh `List<UserAccountModel>`, nen UI dung key string
  truc tiep. Neu backend doi field name, man admin user rat de loi.
- Role nen khop dung chuoi backend: `CUSTOMER`, `STAFF`, `VET`, `ADMIN`.

### PetApiService

File: `lib/services/pet_api_service.dart`

Dung cho ho so thu cung.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getPets()` | `GET /api/Pets` | `200` | Dung cho vet/admin |
| `getPetsByUserId(userId)` | `GET /api/Pets/user/{userId}` | `200` | Dung cho customer |
| `updatePet(pet)` | `PUT /api/Pets/{pet.id}` | `204` | Body tao tay, co `birthDate` nullable |
| `addPet(pet)` | `POST /api/Pets` | `201` hoac `200` | Body tao tay |

Loi hay gap:

- Android goi sai base URL nen khong load pets.
- `birthDate` null/format date khong khop backend.
- `userId` phai la user backend, khong phai Firebase UID.

### BookingApiService

File: `lib/services/booking_api_service.dart`

Dung cho dat lich, xem lich va staff cap nhat trang thai.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getBookings()` | `GET /api/Bookings` | `200` | Tra tat ca booking |
| `getBookingsByUserId(userId)` | `GET /api/Bookings/user/{userId}` | `200` | Tra booking cua customer |
| `addBooking(booking)` | `POST /api/Bookings` | `201` hoac `200` | Tao status mac dinh `PENDING` |
| `cancelBooking(bookingId)` | `PUT /api/Bookings/{bookingId}/cancel` | `204` | Soft-cancel |
| `deleteBooking(bookingId)` | `DELETE /api/Bookings/{bookingId}` | `200`, `202`, `204`, `404` | Dang duoc them trong working tree |
| `updateBookingStatus(bookingId, status)` | `PUT /api/Bookings/{bookingId}/status` | `204` | Body: `{ "status": status }` |

Loi hay gap:

- Status backend tra ve khac `204` lam UI bao loi du thao tac da thanh cong.
- Xoa booking co the fail neu backend chan do rang buoc booking detail/payment.
- `deleteBooking` hien chap nhan `404` la thanh cong de tranh loi khi item da bi
  xoa tu truoc.
- Customer cancel flow nen dung `cancelBooking`, khong dung `deleteBooking`, de
  lich chuyen sang `CANCELLED` va van con lich su trong he thong.
- Man customer chi hien booking `CANCELLED` trong 30 ngay. App uu tien
  `cancelledAt`, sau do moc huy local trong phien hien tai, sau do `updatedAt`,
  cuoi cung moi fallback ve `bookingDate`.
- `careTypeId` hien chua co model rieng, nen can chac ID gui len dung backend.

### BookingDetailApiService

File: `lib/services/booking_detail_api_service.dart`

Dung cho chi tiet dich vu trong lich hen.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getBookingDetails()` | `GET /api/BookingDetails` | `200` | Lay tat ca detail |
| `getBookingDetailsByBooking(bookingId)` | `GET /api/BookingDetails/booking/{bookingId}` | `200` | Loc theo booking |
| `addBookingDetail(detail)` | `POST /api/BookingDetails` | `201` hoac `200` | Tao detail sau khi dat lich |

Loi hay gap:

- Dat lich thanh cong nhung tao booking detail fail: lich co the bi thieu goi
  dich vu.
- `serviceId` phai la ID cua `ServicePackageModel`.

### ServicePackageApiService

File: `lib/services/service_package_api_service.dart`

Dung cho goi dich vu cua admin/customer booking.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getServicePackages()` | `GET /api/ServicePackages` | `200` | Customer loc `status == ACTIVE` |
| `addServicePackage(servicePackage)` | `POST /api/ServicePackages` | `201` hoac `200` | Admin them goi |
| `updateServicePackage(servicePackage)` | `PUT /api/ServicePackages/{serviceId}` | `204` | Admin cap nhat |
| `toggleServiceStatus(serviceId)` | `PUT /api/ServicePackages/{serviceId}/toggle-status` | `204` | Bat/tat goi |

Loi hay gap:

- Backend tra status lowercase/khac `ACTIVE` thi customer khong thay goi dich
  vu.
- `categoryId` chua co model trong app, nen de sai ID se kho debug.

### PaymentApiService

File: `lib/services/payment_api_service.dart`

Dung cho thanh toan booking.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getPayments()` | `GET /api/Payments` | `200` | Lay tat ca payment |
| `getPaymentsByBooking(bookingId)` | `GET /api/Payments/booking/{bookingId}` | `200` | Loc theo booking |
| `addPayment(payment)` | `POST /api/Payments` | `201` hoac `200` | Tao payment sau booking |
| `confirmPayment(paymentId)` | `PUT /api/Payments/{paymentId}/confirm` | `204` | Staff xac nhan |
| `failedPayment(paymentId)` | `PUT /api/Payments/{paymentId}/failed` | `204` | Chuyen failed |

Loi hay gap:

- Booking tao thanh cong nhung payment fail: UI co the bao dat lich loi du
  booking da ton tai.
- Staff xac nhan payment nhung backend khong tra `204` se bao loi.

### MedicalRecordApiService

File: `lib/services/medical_record_api_service.dart`

Dung cho benh an thu cung.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getMedicalRecordsByPet(petId)` | `GET /api/MedicalRecords/pet/{petId}` | `200` | Xem benh an theo pet |
| `addMedicalRecord(record)` | `POST /api/MedicalRecords` | `201` hoac `200` | Vet them benh an |

Loi hay gap:

- `recordDate` va date parse khong khop backend.
- `staffId` phai la staff backend ID, khong phai Firebase UID.

### VaccinationApiService

File: `lib/services/vaccination_api_service.dart`

Dung cho lich tiem thu cung.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getVaccinationsByPet(petId)` | `GET /api/Vaccinations/pet/{petId}` | `200` | Xem lich tiem theo pet |
| `addVaccination(vaccination)` | `POST /api/Vaccinations` | `201` hoac `200` | Vet them lich tiem |

Loi hay gap:

- `vaccinationDate`/`nextDate` sai format.
- `CustomerVaccinationPage` hien co cho goi HTTP truc tiep rieng, nen neu sua
  endpoint vaccine can kiem tra ca page do.

### StaffApiService

File: `lib/services/staff_api_service.dart`

Dung cho admin quan ly staff.

| Ham | API | Status thanh cong | Ghi chu |
| --- | --- | --- | --- |
| `getStaffs()` | `GET /api/Staffs` | `200` | Danh sach staff |
| `toggleStaffStatus(staffId)` | `PUT /api/Staffs/{staffId}/toggle-status` | `204` | Doi status |
| `addViolation(staffId)` | `PUT /api/Staffs/{staffId}/add-violation` | `204` | Tang vi pham |
| `activateStaff(staffId)` | `PUT /api/Staffs/{staffId}/activate` | `204` | Kich hoat lai |

Loi hay gap:

- Status backend khong dung chuoi UI dang so sanh.
- Gan role user thanh staff/vet nhung backend chua tao record staff tuong ung.

## 3. Checklist khi app loi API

1. Kiem tra backend co dang chay port `5200` khong.
2. Kiem tra `ApiConfig.baseUrl` co dung voi platform khong.
3. Neu chay Android device that, khong dung `localhost`; phai dung IP may chay
   backend va cung mang Wi-Fi.
4. Neu chay Android emulator, tuy emulator co the can `10.0.2.2` thay vi IP
   LAN.
5. Kiem tra firewall Windows co chan port backend khong.
   `UserAccounts`, ...
7. Kiem tra status code backend tra ve co khop service dang expect khong.
8. Kiem tra response body co phai JSON array/object nhu model dang parse khong.
9. Kiem tra field name backend co khop `fromJson` trong model khong.
10. Kiem tra ID gui len la ID backend, khong nham voi Firebase UID.

## 4. Nhung diem nen can than khi sua service

- Dung `Uri.encodeComponent` cho tham so nam trong URL neu tham so co ky tu dac
  biet, vi du email, Firebase UID.
- Khi backend tra `204 No Content`, khong duoc `jsonDecode(response.body)`.
- Khi POST tao moi, app hien chap nhan `201` hoac `200`.
- Khi PUT cap nhat, app da so expect `204`.
- Khi GET list, app expect response la JSON array.
- Khi GET detail/user, app expect response la JSON object.
- Nen dua response body vao loi de debug nhanh hon, nhu cach
- Neu mot thao tac gom nhieu API lien tiep, vi du dat lich + booking detail +
  payment, can nghi den truong hop API 1 thanh cong nhung API 2 fail.

## 5. Huong cai thien sau nay

Nhung viec nen lam de service chac hon:

- Tao mot `ApiClient` dung chung de gom:
  - base URL
  - headers JSON
  - parse JSON
  - check status code
  - error message co status + body
- Type lai `AdminUserApiService.getUsers()` thanh `List<UserAccountModel>`.
- Dua cac page goi HTTP truc tiep ve service:
  - `CustomerMedicalRecordPage`
  - `CustomerVaccinationPage`
- Them service cho:
  - Health logs
  - Notifications
  - Cart/order/checkout neu backend co.
