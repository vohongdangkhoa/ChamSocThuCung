# Payment flows

Tai lieu nay tom tat cac luong logic da lam cho phan thanh toan lich hen
PetNoVa, kem dia chi file can xem khi can sua tiep.

## 1. Dia chi cac file lien quan

Flutter app:

| Muc dich                                                                       | File                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------- |
| Tao booking, tao payment, hien nut thanh toan customer, khoa huy lich customer | `lib/screens/customer_home_screen.dart`  |
| Man chi tiet thanh toan cua customer                                           | `lib/screens/customer_payment_page.dart` |
| Staff xem payment, xac nhan thanh toan, cap nhat trang thai lich hen           | `lib/screens/staff_home_screen.dart`     |
| Goi API payment                                                                | `lib/services/payment_api_service.dart`  |
| Goi API booking, cancel booking, update booking status                         | `lib/services/booking_api_service.dart`  |
| Model payment                                                                  | `lib/models/payment_model.dart`          |
| Model booking                                                                  | `lib/models/booking_model.dart`          |

Backend API:

| Muc dich                                          | File                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| API payment: tao payment, confirm, failed, refund | `C:\Users\vohon\source\repos\PetNoVaApi\Controllers\PaymentsController.cs` |
| API booking: cancel, update status flow           | `C:\Users\vohon\source\repos\PetNoVaApi\Controllers\BookingsController.cs` |

## 2. Customer tao lich va tao payment

Dia chi chinh:

- `lib/screens/customer_home_screen.dart`
- Ham `createBooking()`
- Service `PaymentApiService.addPayment(...)`

Luong logic:

1. Customer chon thu cung, loai cham soc, goi dich vu, ngay gio, ghi chu.
2. Customer chon hinh thuc thanh toan:
   - `CASH`: tien mat.
   - `BANK_TRANSFER`: chuyen khoan ngan hang.
3. App tao booking truoc.
4. App tao booking detail cho goi dich vu da chon.
5. App tao `PaymentModel` sau khi co `createdBooking.id`.
6. Payment moi co:
   - `method = selectedPaymentMethod`
   - `amount = selectedService.price`
   - `status = PENDING`
   - `paymentDate = ''`
   - `bookingId = createdBooking.id`
7. Tao xong thi app goi `loadData()` de refresh danh sach lich va payment.

Ket qua:

- Moi booking hop le se co payment di kem.
- Payment ban dau luon la `PENDING`.
- Payment gan dung voi booking qua `bookingId`.

## 3. Customer xem thanh toan

Dia chi chinh:

- `lib/screens/customer_home_screen.dart`
- `lib/screens/customer_payment_page.dart`

Nut trong card lich hen customer:

```dart
if (payment != null && booking.status.toUpperCase() != 'CANCELLED')
```

Luong logic:

1. App tim payment cua booking bang `getPaymentByBooking(booking.id)`.
2. Neu booking da `CANCELLED` thi khong hien nut thanh toan.
3. Neu co payment va booking chua huy:
   - Payment `PAID`: nut hien `Xem thanh toán`.
   - Payment khac `PAID`: nut hien `Thanh toán`.
4. Bam nut se mo `CustomerPaymentPage`.
5. App truyen vao:
   - `booking`
   - `payment`
   - `petName`
   - `serviceName`

Ket qua:

- Customer xem duoc thong tin thanh toan theo dung lich hen.
- Lich da huy khong con duong di vao man thanh toan.

## 4. Man CustomerPaymentPage

Dia chi chinh:

- `lib/screens/customer_payment_page.dart`

Logic chinh:

```dart
bool get isPaid => payment.status.toUpperCase() == 'PAID';
bool get isBankTransfer => payment.method.toUpperCase() == 'BANK_TRANSFER';
```

Man hinh hien:

- Thu cung.
- Dich vu.
- Ngay hen.
- Ma thanh toan.
- Phuong thuc thanh toan.
- So tien.
- Trang thai thanh toan.

Phan huong dan theo trang thai/payment method:

| Dieu kien                                      | UI hien thi          |
| ---------------------------------------------- | -------------------- |
| `payment.status == PAID`                       | `_PaidGuide`         |
| Chua paid va `payment.method == BANK_TRANSFER` | `_BankTransferGuide` |
| Chua paid va `payment.method == CASH`          | `_CashGuide`         |

Bank transfer guide:

- Hien ngan hang.
- Hien chu tai khoan.
- Hien so tai khoan.
- Hien so tien.
- Hien noi dung chuyen khoan.
- Co nut copy cho tung dong.

Ghi chu con placeholder:

```dart
static const String bankName = 'Cập nhật ngân hàng';
static const String bankAccountNumber = 'Cập nhật số tài khoản';
```

Sau nay can doi thanh thong tin that cua PetNoVa.

## 5. Staff xac nhan thanh toan

Dia chi chinh:

- `lib/screens/staff_home_screen.dart`
- `lib/services/payment_api_service.dart`
- Backend: `C:\Users\vohon\source\repos\PetNoVaApi\Controllers\PaymentsController.cs`

Flutter Staff:

- Ham `confirmPayment(PaymentModel payment)`.
- Nut `Xác nhận thanh toán` nam trong card lich hen Staff.
- Nut chi hien khi:

```dart
payment.status.toUpperCase() == 'PENDING'
```

Luong logic:

1. Staff thay thong tin payment trong card lich hen.
2. Neu payment dang `PENDING`, app hien nut `Xác nhận thanh toán`.
3. Staff bam nut.
4. Flutter goi:

```dart
PaymentApiService.confirmPayment(payment.paymentId)
```

5. Service goi API:

```text
PUT /api/Payments/{paymentId}/confirm
```

6. Backend set:
   - `payment.status = "PAID"`
   - `payment.paymentDate = DateTime.Now`
7. Flutter goi `loadBookings()` de refresh.
8. Payment da `PAID` thi nut xac nhan thanh toan khong hien nua.

Ket qua:

- Staff la nguoi xac nhan payment.
- Customer chi xem trang thai, khong tu set `PAID`.

## 6. Luong trang thai lich hen Staff co rang buoc payment

Dia chi chinh:

- `lib/screens/staff_home_screen.dart`
- Backend: `C:\Users\vohon\source\repos\PetNoVaApi\Controllers\BookingsController.cs`

Luong chuan:

```text
PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED
```

Flutter da co cac ham:

- `getNextBookingStatus(currentStatus)`
- `getNextBookingStatusLabel(currentStatus)`
- `canUpdateBookingByStaff(booking)`
- `isPaymentPaid(payment)`
- `updateBookingStatusByFlow(booking, payment)`

Quy tac:

| Trang thai hien tai | Nut Staff            | Trang thai tiep theo |
| ------------------- | -------------------- | -------------------- |
| `PENDING`           | `Xác nhận lịch`      | `CONFIRMED`          |
| `CONFIRMED`         | `Bắt đầu chăm sóc`   | `IN_PROGRESS`        |
| `IN_PROGRESS`       | `Hoàn thành dịch vụ` | `COMPLETED`          |
| `COMPLETED`         | Khoa                 | Khong cap nhat       |
| `CANCELLED`         | Khoa                 | Khong cap nhat       |

Rang buoc payment:

- Neu lich dang `IN_PROGRESS` va payment chua `PAID`, Staff khong duoc chuyen
  sang `COMPLETED`.
- UI hien canh bao:

```text
Cần xác nhận thanh toán trước khi hoàn thành dịch vụ.
```

Backend cung co guard:

- Khong cho cap nhat neu booking da `CANCELLED`.
- Khong cho cap nhat neu booking da `COMPLETED`.
- Chi cho flow dung:
  - `PENDING -> CONFIRMED`
  - `CONFIRMED -> IN_PROGRESS`
  - `IN_PROGRESS -> COMPLETED`
- Khi `IN_PROGRESS -> COMPLETED`, backend kiem tra payment cua booking phai
  `PAID`.

Ket qua:

- Khong the hoan thanh dich vu khi khach chua thanh toan.
- Frontend va backend deu co guard, khong chi tin vao UI.

## 7. Customer huy lich va quan he voi thanh toan

Dia chi chinh:

- `lib/screens/customer_home_screen.dart`
- `lib/services/booking_api_service.dart`
- Backend: `C:\Users\vohon\source\repos\PetNoVaApi\Controllers\BookingsController.cs`

Flutter da co ham:

```dart
bool canCustomerCancelBooking(BookingModel booking)
```

Quy tac:

| Trang thai booking | Customer co duoc huy? |
| ------------------ | --------------------- |
| `PENDING`          | Co                    |
| `CONFIRMED`        | Co                    |
| `IN_PROGRESS`      | Khong                 |
| `COMPLETED`        | Khong                 |
| `CANCELLED`        | Khong                 |

Trong UI:

- Nut `Hủy lịch hẹn` chi hien khi `canCustomerCancelBooking(booking) == true`.
- Ham `cancelBooking(booking)` cung goi lai guard nay o dau ham.

Backend cancel API:

```text
PUT /api/Bookings/{bookingId}/cancel
```

Backend chi cho cancel khi:

```text
PENDING hoac CONFIRMED
```

Ket qua:

- Staff da bat dau cham soc (`IN_PROGRESS`) thi Customer khong con duoc huy.
- Lich `COMPLETED` va `CANCELLED` bi khoa.
- Lich da huy khong hien nut thanh toan trong Customer booking card.

## 8. Checklist test nhanh

Test Customer:

1. Tao booking moi voi `CASH`.
2. Kiem tra booking co payment `PENDING`.
3. Bam `Thanh toán`, man payment hien huong dan tra tien mat.
4. Tao booking moi voi `BANK_TRANSFER`.
5. Bam `Thanh toán`, man payment hien thong tin chuyen khoan va nut copy.
6. Huy booking khi `PENDING` hoac `CONFIRMED`: thanh cong.
7. Khi booking `IN_PROGRESS`, `COMPLETED`, `CANCELLED`: khong thay nut huy.

Test Staff:

1. Booking `PENDING`: bam `Xác nhận lịch`, booking sang `CONFIRMED`.
2. Booking `CONFIRMED`: bam `Bắt đầu chăm sóc`, booking sang `IN_PROGRESS`.
3. Booking `IN_PROGRESS` + payment `PENDING`: bam `Hoàn thành dịch vụ`, bi
   chan.
4. Bam `Xác nhận thanh toán`, payment sang `PAID`.
5. Booking `IN_PROGRESS` + payment `PAID`: bam `Hoàn thành dịch vụ`, booking
   sang `COMPLETED`.
6. Booking `COMPLETED`: khong hien nut cap nhat nua.

## 9. Cac diem can cap nhat sau

- Doi thong tin ngan hang that trong `CustomerPaymentPage`.
- Neu backend tra status khac `204` cho confirm/cancel/update status, can chinh
  service Flutter cho khop.
- Nen chuan hoa message loi API trong cac service de debug nhanh hon.
