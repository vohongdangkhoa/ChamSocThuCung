# PetNoVa class diagram

Tài liệu này bám theo mã nguồn Flutter hiện tại trong `lib/models`,
`lib/services` và các màn hình điều phối chính trong `lib/screens`.

## 1. Domain model và API services

```mermaid
classDiagram
direction LR

namespace Models {
  class UserAccountModel {
    +String userId
    +String firebaseUid
    +String fullName
    +String email
    +String phone
    +String role
    +String status
    +String fcmToken
    +String createdAt
    +fromJson(json)
    +toJson()
  }

  class StaffModel {
    +String staffId
    +String fullName
    +String phone
    +String email
    +String role
    +int violationCount
    +String status
    +String userId
    +fromJson(json)
    +toJson()
  }

  class PetModel {
    +String id
    +String userId
    +String name
    +String species
    +String breed
    +String gender
    +DateTime? birthDate
    +double weight
    +String healthStatus
    +fromJson(json)
  }

  class BookingModel {
    +String id
    +String userId
    +String petId
    +String? staffId
    +String careTypeId
    +DateTime bookingDate
    +String bookingTime
    +double totalAmount
    +String status
    +String note
    +DateTime? createdAt
    +DateTime? updatedAt
    +DateTime? cancelledAt
    +fromJson(json)
  }

  class BookingDetailModel {
    +String detailId
    +int quantity
    +double price
    +String bookingId
    +String serviceId
    +fromJson(json)
    +toJson()
  }

  class ServicePackageModel {
    +String serviceId
    +String serviceName
    +String description
    +double price
    +int duration
    +String status
    +String categoryId
    +fromJson(json)
    +toJson()
  }

  class PaymentModel {
    +String paymentId
    +String method
    +double amount
    +String status
    +String paymentDate
    +String bookingId
    +fromJson(json)
    +toJson()
  }

  class MedicalRecordModel {
    +String recordId
    +String diagnosis
    +String treatment
    +DateTime recordDate
    +String note
    +String petId
    +String staffId
    +fromJson(json)
    +toJson()
  }

  class VaccinationModel {
    +String vaccinationId
    +String vaccineName
    +DateTime vaccinationDate
    +DateTime nextDate
    +String note
    +String petId
    +String staffId
    +fromJson(json)
    +toJson()
  }

  class HealthLogModel {
    +String id
    +String date
    +double weight
    +String foodAmount
    +String symptoms
    +String note
  }

  class NotificationModel {
    +String id
    +String title
    +String message
    +String type
    +String createdAt
    +bool isRead
}

namespace Services {
  class UserAccountApiService {
    +getUserAccounts()
    +getUserByFirebaseUid(firebaseUid)
    +getUserByEmail(email)
    +createUserAccount(user)
    +updateProfileByEmail(email, fullName, phone)
  }

  class AdminUserApiService {
    +getUsers()
    +assignRole(userId, role)
  }

  class StaffApiService {
    +getStaffs()
    +toggleStaffStatus(staffId)
    +addViolation(staffId)
    +activateStaff(staffId)
  }

  class PetApiService {
    +getPets()
    +getPetsByUserId(userId)
    +addPet(pet)
    +updatePet(pet)
  }

  class BookingApiService {
    +getBookings()
    +getBookingsByUserId(userId)
    +addBooking(booking)
    +cancelBooking(bookingId)
    +deleteBooking(bookingId)
    +updateBookingStatus(bookingId, status)
  }

  class BookingDetailApiService {
    +getBookingDetails()
    +getBookingDetailsByBooking(bookingId)
    +addBookingDetail(detail)
  }

  class ServicePackageApiService {
    +getServicePackages()
    +addServicePackage(servicePackage)
    +updateServicePackage(servicePackage)
    +toggleServiceStatus(serviceId)
  }

  class PaymentApiService {
    +getPayments()
    +getPaymentsByBooking(bookingId)
    +addPayment(payment)
    +confirmPayment(paymentId)
    +failedPayment(paymentId)
  }

  class MedicalRecordApiService {
    +getMedicalRecordsByPet(petId)
    +addMedicalRecord(record)
  }

  class VaccinationApiService {
    +getVaccinationsByPet(petId)
    +addVaccination(vaccination)
  }

}

class ApiConfig {
  +baseUrl
}

UserAccountModel "1" --> "0..*" PetModel : userId
UserAccountModel "1" --> "0..*" BookingModel : userId
UserAccountModel "1" --> "0..1" StaffModel : userId
PetModel "1" --> "0..*" BookingModel : petId
StaffModel "0..1" --> "0..*" BookingModel : staffId
BookingModel "1" --> "0..*" BookingDetailModel : bookingId
ServicePackageModel "1" --> "0..*" BookingDetailModel : serviceId
BookingModel "1" --> "0..*" PaymentModel : bookingId
PetModel "1" --> "0..*" MedicalRecordModel : petId
StaffModel "1" --> "0..*" MedicalRecordModel : staffId
PetModel "1" --> "0..*" VaccinationModel : petId
StaffModel "1" --> "0..*" VaccinationModel : staffId

UserAccountApiService ..> UserAccountModel : serialize
StaffApiService ..> StaffModel : serialize
PetApiService ..> PetModel : serialize
BookingApiService ..> BookingModel : serialize
BookingDetailApiService ..> BookingDetailModel : serialize
ServicePackageApiService ..> ServicePackageModel : serialize
PaymentApiService ..> PaymentModel : serialize
MedicalRecordApiService ..> MedicalRecordModel : serialize
VaccinationApiService ..> VaccinationModel : serialize

UserAccountApiService ..> ApiConfig
AdminUserApiService ..> ApiConfig
StaffApiService ..> ApiConfig
PetApiService ..> ApiConfig
BookingApiService ..> ApiConfig
BookingDetailApiService ..> ApiConfig
ServicePackageApiService ..> ApiConfig
PaymentApiService ..> ApiConfig
MedicalRecordApiService ..> ApiConfig
VaccinationApiService ..> ApiConfig
```

## 2. Flutter presentation và dependency thực tế

Các phương thức xử lý state nằm trong lớp private `_<Screen>State` tương ứng.
Sơ đồ dưới đây gom chúng vào tên màn hình để tránh nhân đôi mỗi widget thành hai
ô UML.

```mermaid
classDiagram
direction LR

class PetNoVaApp {
  <<StatelessWidget>>
  +build(context)
}

class SplashScreen {
  <<StatefulWidget>>
  +checkLogin()
  +getUserAccount(firebaseUser)
  +getScreenByRole(role)
}

class LoginScreen {
  <<StatefulWidget>>
  +login()
  +goToHomeByRole()
}

class RegisterScreen {
  <<StatefulWidget>>
  +register()
}

class CustomerHomeScreen {
  <<StatefulWidget>>
}

class PetPage {
  <<StatefulWidget>>
  +loadPets()
  +openAddPetScreen()
}

class AddPetScreen {
  <<StatefulWidget>>
  +savePet()
}

class BookingPage {
  <<StatefulWidget>>
  +loadData()
  +createBooking()
  +cancelBooking(booking)
}

class PetDetailScreen {
  <<StatelessWidget>>
  +PetModel pet
}

class EditPetScreen {
  <<StatefulWidget>>
  +PetModel pet
  +updatePet()
}

class HealthLogScreen {
  <<StatefulWidget>>
  +PetModel pet
  +saveLog()
}

class MedicalRecordScreen {
  <<StatefulWidget>>
  +PetModel pet
  +loadMedicalRecords()
  +openAddMedicalRecordDialog()
}

class VaccinationScreen {
  <<StatefulWidget>>
  +PetModel pet
  +bool canAdd
  +loadVaccinations()
  +openAddVaccinationDialog()
}

class CustomerVaccinationPage {
  <<StatefulWidget>>
  +String petId
  +String petName
  +loadVaccinations()
}

class AdminHomeScreen {
class AdminDashboardPage {
  <<StatefulWidget>>
  +loadDashboardData()
}

class AdminUserManagementPage {
  <<StatefulWidget>>
  +loadUsers()
  +assignRole(userId, role)
}

class AdminServicePage {
  <<StatefulWidget>>
  +loadServices()
  +addService()
  +toggleStatus(service)
}

  <<StatefulWidget>>
}

class AdminStaffPage {
  <<StatefulWidget>>
  +loadStaffs()
  +toggleStaffStatus(staff)
  +addViolation(staff)
  +activateStaff(staff)
}

class StaffHomeScreen {
  <<StatefulWidget>>
  +loadBookings()
  +updateStatus(booking, status)
  +confirmPayment(payment)
}

class VetHomeScreen {
  <<StatefulWidget>>
  +loadPets()
}

class FirebaseAuth {
  <<external>>
  +currentUser
  +signInWithEmailAndPassword()
  +signOut()
  +createUserWithEmailAndPassword()
}

class HttpClient {
  <<external>>
  +get(uri)
  +post(uri)
  +put(uri)
}

PetNoVaApp --> SplashScreen : home

SplashScreen ..> FirebaseAuth
SplashScreen ..> UserAccountApiService
SplashScreen ..> LoginScreen
SplashScreen ..> CustomerHomeScreen : CUSTOMER
SplashScreen ..> StaffHomeScreen : STAFF
SplashScreen ..> VetHomeScreen : VET
SplashScreen ..> AdminHomeScreen : ADMIN

LoginScreen ..> FirebaseAuth
LoginScreen ..> UserAccountApiService
LoginScreen ..> CustomerHomeScreen : CUSTOMER
LoginScreen ..> StaffHomeScreen : STAFF
LoginScreen ..> VetHomeScreen : VET
LoginScreen ..> AdminHomeScreen : ADMIN
LoginScreen ..> RegisterScreen
RegisterScreen ..> FirebaseAuth
RegisterScreen ..> UserAccountApiService

CustomerHomeScreen *-- PetPage
CustomerHomeScreen *-- BookingPage
PetPage ..> UserAccountApiService
PetPage ..> PetApiService
PetPage ..> AddPetScreen
PetPage ..> PetDetailScreen
PetPage ..> CustomerVaccinationPage
PetDetailScreen --> PetModel
PetDetailScreen ..> PetApiService
PetDetailScreen ..> EditPetScreen
PetDetailScreen ..> HealthLogScreen
PetDetailScreen ..> VaccinationScreen
AddPetScreen ..> UserAccountApiService
AddPetScreen ..> FirebaseAuth
EditPetScreen --> PetModel
HealthLogScreen --> PetModel
HealthLogScreen *-- HealthLogModel : in-memory logs
MedicalRecordScreen --> PetModel
MedicalRecordScreen ..> MedicalRecordApiService
VaccinationScreen --> PetModel
VaccinationScreen ..> VaccinationApiService

BookingPage ..> FirebaseAuth
BookingPage ..> UserAccountApiService
BookingPage ..> PetApiService
BookingPage ..> BookingApiService
BookingPage ..> BookingDetailApiService
BookingPage ..> ServicePackageApiService
BookingPage ..> PaymentApiService

CustomerVaccinationPage ..> HttpClient : direct call
CustomerVaccinationPage ..> ApiConfig

AdminHomeScreen *-- AdminDashboardPage
AdminHomeScreen *-- AdminUserManagementPage
AdminHomeScreen *-- AdminServicePage
AdminHomeScreen *-- AdminStaffPage
AdminDashboardPage ..> BookingApiService
AdminDashboardPage ..> PetApiService
AdminDashboardPage ..> PaymentApiService
AdminUserManagementPage ..> AdminUserApiService
AdminServicePage ..> ServicePackageApiService
AdminStaffPage ..> StaffApiService

StaffHomeScreen ..> BookingApiService
StaffHomeScreen ..> BookingDetailApiService
StaffHomeScreen ..> ServicePackageApiService
StaffHomeScreen ..> PaymentApiService

VetHomeScreen ..> PetApiService
VetHomeScreen ..> MedicalRecordScreen
VetHomeScreen ..> VaccinationScreen
```

## Ghi chú bám sát code

- Quan hệ giữa các model là quan hệ logic thông qua các trường ID; code Dart
  hiện không giữ object lồng nhau.
- `careTypeId` trong `BookingModel` và `categoryId` trong
  `ServicePackageModel` chưa có model tương ứng trong app.
- `HealthLogModel` và `NotificationModel` hiện chỉ được lưu trong state của UI,
  chưa có API service.
- `CustomerVaccinationPage` goi HTTP truc tiep, khong di qua
  `VaccinationApiService` hoac model tuong ung.
- `AdminUserApiService.getUsers()` trả về `List` động thay vì
  `List<UserAccountModel>`.
