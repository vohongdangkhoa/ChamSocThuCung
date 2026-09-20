# PetNoVaApi File Map

Tai lieu nay map rieng backend ASP.NET Core API nam trong:

```text
backend/PetNoVaApi
```

Dung file nay khi can sua endpoint, sua model database, debug loi API, hoac
kiem tra API nao dang duoc Flutter goi.

## 1. Tong quan backend

| Phan | File/folder | Vai tro |
| --- | --- | --- |
| Project .NET | `backend/PetNoVaApi/PetNoVaApi.csproj` | Khai bao `net10.0` va package EF Core SQL Server, Swagger |
| Entry point | `backend/PetNoVaApi/Program.cs` | Dang ky controller, Swagger, CORS, DbContext, route API |
| Config database | `backend/PetNoVaApi/appsettings.json` | Chua connection string toi `PetNoVaDB` |
| Config development | `backend/PetNoVaApi/appsettings.Development.json` | Log level khi chay Development |
| Launch profile | `backend/PetNoVaApi/Properties/launchSettings.json` | Chay API o `http://0.0.0.0:5200` |
| DbContext | `backend/PetNoVaApi/Data/PetNoVaDbContext.cs` | Map EF Core DbSet toi cac bang SQL Server |
| Controllers | `backend/PetNoVaApi/Controllers/` | Chua REST endpoints |
| Models | `backend/PetNoVaApi/Models/` | Entity map voi bang trong `PetNoVaDB` |
| Request test | `backend/PetNoVaApi/PetNoVaApi.http` | File test request nhanh trong VS Code |
| Huong dan chay | `backend/PetNoVaApi/README.md` | Lenh chay API trong VS Code |

Lenh chay API:

```powershell
dotnet run --project backend\PetNoVaApi\PetNoVaApi.csproj --launch-profile http
```

Swagger:

```text
http://localhost:5200/swagger
```

## 2. Cau hinh ket noi database

Connection string nam trong:

```text
backend/PetNoVaApi/appsettings.json
```

Key dang duoc dung:

```text
PetNoVaConnection
```

Gia tri hien tai:

```text
Server=localhost\MSSQLSERVER01;Database=PetNoVaDB;Trusted_Connection=True;TrustServerCertificate=True;
```

`Program.cs` doc key nay bang:

```csharp
builder.Configuration.GetConnectionString("PetNoVaConnection")
```

Neu API loi ket noi SQL Server, can kiem tra:

- SQL Server instance `localhost\MSSQLSERVER01` co dang chay khong.
- Database `PetNoVaDB` co ton tai khong.
- Ten instance SQL Server co khac may hien tai khong.
- Windows Authentication co quyen truy cap database khong.

## 3. Program.cs

File:

```text
backend/PetNoVaApi/Program.cs
```

Nhung viec chinh:

- `AddControllers()` de dung controller REST.
- `AddSwaggerGen()` va `UseSwaggerUI()` de mo Swagger.
- `AddCors("AllowFlutterApp")` cho Flutter Web goi API.
- `AddDbContext<PetNoVaDbContext>()` de ket noi SQL Server.
- `app.MapControllers()` de map cac endpoint trong `Controllers/`.
- `UseHttpsRedirection()` dang duoc comment de Flutter Web goi HTTP local khong loi HTTPS.

## 4. DbContext va bang database

File:

```text
backend/PetNoVaApi/Data/PetNoVaDbContext.cs
```

| DbSet | Model | Bang SQL |
| --- | --- | --- |
| `Pets` | `Pet` | `PET` |
| `Bookings` | `Booking` | `BOOKING` |
| `BookingDetails` | `BookingDetail` | `BOOKING_DETAIL` |
| `MedicalRecords` | `MedicalRecord` | `MEDICAL_RECORD` |
| `Vaccinations` | `Vaccination` | `VACCINATION` |
| `ServicePackages` | `ServicePackage` | `SERVICE_PACKAGE` |
| `Payments` | `Payment` | `PAYMENT` |
| `Staffs` | `Staff` | `STAFF` |
| `UserAccounts` | `UserAccount` | `USER_ACCOUNT` |
| `Notifications` | `Notification` | `NOTIFICATION` |

## 5. Models

Tat ca model nam trong:

```text
backend/PetNoVaApi/Models/
```

| File | Bang | Key | Noi dung chinh |
| --- | --- | --- | --- |
| `UserAccount.cs` | `USER_ACCOUNT` | `userId` | Tai khoan SQL gan voi Firebase UID, role, status, FCM token |
| `Pet.cs` | `PET` | `petId` | Ho so thu cung theo `userId` |
| `Booking.cs` | `BOOKING` | `bookingId` | Lich hen, pet, user, staff, status, tong tien |
| `BookingDetail.cs` | `BOOKING_DETAIL` | `detailId` | Dich vu trong booking, quantity, price, serviceId |
| `Payment.cs` | `PAYMENT` | `paymentId` | Thanh toan theo booking, method, amount, status |
| `ServicePackage.cs` | `SERVICE_PACKAGE` | `serviceId` | Goi dich vu, gia, thoi luong, status, categoryId |
| `Staff.cs` | `STAFF` | `staffId` | Nhan vien/bac si, role, violationCount, status, userId |
| `MedicalRecord.cs` | `MEDICAL_RECORD` | `recordId` | Ho so benh an theo pet va staff |
| `Vaccination.cs` | `VACCINATION` | `vaccinationId` | Lich tiem phong theo pet va staff |
| `Notification.cs` | `NOTIFICATION` | `notificationId` | Thong bao user, read state, relatedId/relatedType |

Ghi chu:

- Models dung property camelCase de khop JSON Flutter dang parse.
- Moi model co `[Table("...")]` de map toi ten bang SQL Server.
- Primary key duoc khai bao bang `[Key]`.

## 6. Controllers va endpoints

Tat ca controller chinh nam trong:

```text
backend/PetNoVaApi/Controllers/
```

### UserAccountsController.cs

Route goc:

```text
/api/UserAccounts
```

Dung cho login/register/profile/admin phan quyen.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/UserAccounts` | Lay tat ca user | `user_account_api_service.dart`, `admin_user_api_service.dart` |
| `GET` | `/api/UserAccounts/{id}` | Lay user theo `userId` | Co the dung cho detail |
| `GET` | `/api/UserAccounts/firebase/{firebaseUid}` | Tim user SQL theo Firebase UID | `user_account_api_service.dart` |
| `GET` | `/api/UserAccounts/email/{email}` | Tim user theo email | `user_account_api_service.dart` |
| `POST` | `/api/UserAccounts` | Tao user SQL sau Firebase register | `user_account_api_service.dart` |
| `PUT` | `/api/UserAccounts/{id}/status` | Cap nhat status user | Chua thay app goi truc tiep |
| `PUT` | `/api/UserAccounts/{userId}/assign-role` | Gan role `STAFF` hoac `VET`, dong thoi tao/cap nhat `Staff` | `admin_user_api_service.dart` |
| `PUT` | `/api/UserAccounts/{id}/role` | Cap nhat role user | Chua thay app goi truc tiep |
| `PUT` | `/api/UserAccounts/update-profile-by-email/{email}` | Cap nhat fullName va phone | `user_account_api_service.dart` |

### PetsController.cs

Route goc:

```text
/api/Pets
```

Dung cho ho so thu cung.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/Pets` | Lay tat ca pet | `pet_api_service.dart` |
| `GET` | `/api/Pets/{id}` | Lay pet theo `petId` | Co the dung cho detail |
| `POST` | `/api/Pets` | Tao pet, sinh ID dang `P001` | `pet_api_service.dart` |
| `PUT` | `/api/Pets/{id}` | Cap nhat thong tin pet | `pet_api_service.dart` |
| `GET` | `/api/Pets/user/{userId}` | Lay pet theo user | `pet_api_service.dart` |

### BookingsController.cs

Route goc:

```text
/api/Bookings
```

Dung cho dat lich, staff cap nhat trang thai va huy/xoa lich.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/Bookings` | Lay tat ca booking | `booking_api_service.dart` |
| `GET` | `/api/Bookings/{id}` | Lay booking theo `bookingId` | Co the dung cho detail |
| `POST` | `/api/Bookings` | Tao booking, set `PENDING`, tao notification | `booking_api_service.dart` |
| `PUT` | `/api/Bookings/{id}/cancel` | Huy booking khi `PENDING` hoac `CONFIRMED` | `booking_api_service.dart` |
| `DELETE` | `/api/Bookings/{id}` | Xoa booking kem payment/detail lien quan | `booking_api_service.dart` |
| `PUT` | `/api/Bookings/{id}/status` | Doi status theo flow hop le | `booking_api_service.dart` |
| `GET` | `/api/Bookings/user/{userId}` | Lay booking cua customer | `booking_api_service.dart` |

Flow status hien tai:

```text
PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED
```

Rang buoc quan trong:

- `CANCELLED` va `COMPLETED` khong duoc update tiep.
- Khi chuyen `IN_PROGRESS -> COMPLETED`, payment cua booking phai co status `PAID`.
- Tao booking se tao notification loai `BOOKING`.

### BookingDetailsController.cs

Route goc:

```text
/api/BookingDetails
```

Dung cho danh sach dich vu trong mot booking.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/BookingDetails` | Lay tat ca detail | `booking_detail_api_service.dart` |
| `GET` | `/api/BookingDetails/booking/{bookingId}` | Lay detail theo booking | `booking_detail_api_service.dart` |
| `POST` | `/api/BookingDetails` | Tao detail, sinh ID dang `BD001` | `booking_detail_api_service.dart` |

### PaymentsController.cs

Route goc:

```text
/api/Payments
```

Dung cho thanh toan booking.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/Payments` | Lay tat ca payment | `payment_api_service.dart` |
| `GET` | `/api/Payments/{id}` | Lay payment theo `paymentId` | Co the dung cho detail |
| `GET` | `/api/Payments/booking/{bookingId}` | Lay payment theo booking | `payment_api_service.dart` |
| `POST` | `/api/Payments` | Tao payment, sinh ID dang `PM001` | `payment_api_service.dart` |
| `PUT` | `/api/Payments/{id}/confirm` | Chuyen payment sang `PAID` | `payment_api_service.dart` |
| `PUT` | `/api/Payments/{id}/failed` | Chuyen payment sang `FAILED` | `payment_api_service.dart` |
| `PUT` | `/api/Payments/{id}/refund` | Chuyen payment sang `REFUNDED` | Chua thay app goi truc tiep |

Ghi chu:

- `method` va `status` duoc uppercase khi tao payment.
- `paymentDate` chi set khi status la `PAID`, `FAILED`, hoac `REFUNDED`.

### ServicePackagesController.cs

Route goc:

```text
/api/ServicePackages
```

Dung cho goi dich vu admin/customer.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/ServicePackages` | Lay tat ca goi dich vu | `service_package_api_service.dart` |
| `GET` | `/api/ServicePackages/{id}` | Lay goi theo `serviceId` | Co the dung cho detail |
| `POST` | `/api/ServicePackages` | Tao goi, sinh ID dang `SV001`, status `ACTIVE` | `service_package_api_service.dart` |
| `PUT` | `/api/ServicePackages/{id}` | Cap nhat goi dich vu | `service_package_api_service.dart` |
| `PUT` | `/api/ServicePackages/{id}/toggle-status` | Doi `ACTIVE`/`INACTIVE` | `service_package_api_service.dart` |

### StaffsController.cs

Route goc:

```text
/api/Staffs
```

Dung cho admin quan ly staff/vet.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/Staffs` | Lay tat ca staff | `staff_api_service.dart` |
| `GET` | `/api/Staffs/{id}` | Lay staff theo `staffId` | Co the dung cho detail |
| `PUT` | `/api/Staffs/{id}/toggle-status` | Doi `ACTIVE`/`INACTIVE` | `staff_api_service.dart` |
| `PUT` | `/api/Staffs/{id}/add-violation` | Tang vi pham, tu 3 lan se `SUSPENDED` | `staff_api_service.dart` |
| `PUT` | `/api/Staffs/{id}/activate` | Kich hoat lai staff | `staff_api_service.dart` |

### MedicalRecordsController.cs

Route goc:

```text
/api/MedicalRecords
```

Dung cho ho so y te.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/MedicalRecords` | Lay tat ca benh an | `medical_record_api_service.dart` |
| `GET` | `/api/MedicalRecords/pet/{petId}` | Lay benh an theo pet, moi nhat truoc | `medical_record_api_service.dart` |
| `POST` | `/api/MedicalRecords` | Tao benh an, sinh ID dang `MR001` | `medical_record_api_service.dart` |

### VaccinationsController.cs

Route goc:

```text
/api/Vaccinations
```

Dung cho lich tiem phong.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/Vaccinations` | Lay tat ca lich tiem | `vaccination_api_service.dart` |
| `GET` | `/api/Vaccinations/pet/{petId}` | Lay lich tiem theo pet, moi nhat truoc | `vaccination_api_service.dart` |
| `POST` | `/api/Vaccinations` | Tao lich tiem, sinh ID dang `VC001` | `vaccination_api_service.dart` |

### NotificationsController.cs

Route goc:

```text
/api/Notifications
```

Dung cho thong bao trong app.

| Method | Endpoint | Vai tro | Flutter service |
| --- | --- | --- | --- |
| `GET` | `/api/Notifications/user/{userId}` | Lay notification theo user, moi nhat truoc | `notification_api_service.dart` |
| `GET` | `/api/Notifications/{id}` | Lay notification theo ID | Co the dung cho detail |
| `POST` | `/api/Notifications` | Tao notification, sinh ID dang `N001` | `notification_api_service.dart` |
| `PUT` | `/api/Notifications/{id}/read` | Danh dau 1 thong bao da doc | `notification_api_service.dart` |
| `PUT` | `/api/Notifications/user/{userId}/read-all` | Danh dau tat ca thong bao cua user da doc | `notification_api_service.dart` |

### WeatherForecastController.cs

Route goc:

```text
/WeatherForecast
```

Day la controller template mac dinh cua ASP.NET Core, khong phai domain chinh
cua PetNoVa va hien khong thay Flutter app goi.

## 7. Mapping nhanh Flutter service -> Backend controller

| Flutter file | Backend controller | Endpoint goc |
| --- | --- | --- |
| `lib/services/user_account_api_service.dart` | `UserAccountsController.cs` | `/api/UserAccounts` |
| `lib/services/admin_user_api_service.dart` | `UserAccountsController.cs` | `/api/UserAccounts` |
| `lib/services/pet_api_service.dart` | `PetsController.cs` | `/api/Pets` |
| `lib/services/booking_api_service.dart` | `BookingsController.cs` | `/api/Bookings` |
| `lib/services/booking_detail_api_service.dart` | `BookingDetailsController.cs` | `/api/BookingDetails` |
| `lib/services/payment_api_service.dart` | `PaymentsController.cs` | `/api/Payments` |
| `lib/services/service_package_api_service.dart` | `ServicePackagesController.cs` | `/api/ServicePackages` |
| `lib/services/staff_api_service.dart` | `StaffsController.cs` | `/api/Staffs` |
| `lib/services/medical_record_api_service.dart` | `MedicalRecordsController.cs` | `/api/MedicalRecords` |
| `lib/services/vaccination_api_service.dart` | `VaccinationsController.cs` | `/api/Vaccinations` |
| `lib/services/notification_api_service.dart` | `NotificationsController.cs` | `/api/Notifications` |

## 8. ID prefix dang sinh trong API

| Entity | Prefix | Vi du | Noi sinh |
| --- | --- | --- | --- |
| UserAccount | `U` | `U001` | `UserAccountsController.CreateUserAccount` |
| Staff | `ST` | `ST001` | `UserAccountsController.GenerateStaffId` |
| Pet | `P` | `P001` | `PetsController.CreatePet` |
| Booking | `B` | `B001` | `BookingsController.CreateBooking` |
| BookingDetail | `BD` | `BD001` | `BookingDetailsController.CreateBookingDetail` |
| Payment | `PM` | `PM001` | `PaymentsController.CreatePayment` |
| ServicePackage | `SV` | `SV001` | `ServicePackagesController.CreateServicePackage` |
| MedicalRecord | `MR` | `MR001` | `MedicalRecordsController.CreateMedicalRecord` |
| Vaccination | `VC` | `VC001` | `VaccinationsController.CreateVaccination` |
| Notification | `N` | `N001` | `NotificationsController.CreateNotification` va booking notification |

Ghi chu can than:

- Nhieu ID dang sinh bang `CountAsync() + 1`. Neu da tung xoa record, co the bi
  trung ID neu database da co ID cao hon count hien tai.

## 9. Loi hay gap va file can xem

| Loi | File can xem |
| --- | --- |
| API khong start duoc | `PetNoVaApi.csproj`, `Program.cs`, `Properties/launchSettings.json` |
| Khong ket noi duoc SQL Server | `appsettings.json`, `Program.cs`, `Data/PetNoVaDbContext.cs` |
| Flutter Web bi CORS | `Program.cs` phan `AddCors` va `UseCors` |
| Swagger khong mo | `Program.cs` phan Swagger, profile Development trong `launchSettings.json` |
| Endpoint 404 | Controller route trong `Controllers/*.cs`, URL trong `lib/services/*.dart` |
| JSON parse loi ben Flutter | Model backend trong `Models/*.cs` va model Flutter trong `lib/models/*.dart` |
| Status code khong khop | Controller method tra `CreatedAtAction`, `NoContent`, `BadRequest`, `NotFound` |
| Booking khong complete duoc | `BookingsController.UpdateBookingStatus`, `PaymentsController.ConfirmPayment` |
| Admin gan role nhung staff khong hien | `UserAccountsController.AssignRole`, `StaffsController.cs` |
| Notification khong hien | `NotificationsController.cs`, `BookingsController.CreateBookingNotification` |

## 10. Files build/cache khong can sua

Nhung folder sau do `dotnet build/run` tao ra, khong can sua tay:

```text
backend/PetNoVaApi/bin/
backend/PetNoVaApi/obj/
```

Chung da duoc ignore trong `.gitignore`.
