using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PetNoVaApi.Controllers;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;
using PayOS.Crypto;
using PayOS.Models.Webhooks;

// Kiểm tra controller thật + SQL thật trong bản sao QA. Không gọi Firebase/SMTP/PayOS.
const string database = "PetNoVaDB_QA_20261026";
var connection = $"Server=lpc:.\\MSSQLSERVER01;Database={database};Trusted_Connection=True;TrustServerCertificate=True";
var options = new DbContextOptionsBuilder<PetNoVaDbContext>().UseSqlServer(connection).Options;
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Booking:Capacity"] = "3" }).Build();
var results = new List<object>();
var failures = 0;
var tag = "Q" + Guid.NewGuid().ToString("N")[..5];
var day = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date.AddDays(45);
await using var setup = new PetNoVaDbContext(options);
if (setup.Database.GetDbConnection().Database != database) throw new InvalidOperationException("Chi chay tren database QA.");
await ThanhToanSchemaInitializer.EnsureAsync(setup);
// Mỗi lần chạy dùng một khối ngày trống; không xóa fixture hoặc dữ liệu sao chép cũ.
while (await setup.Bookings.AnyAsync(b=>b.bookingDate>=day&&b.bookingDate<day.AddDays(9)&&b.status!="CANCELLED"))
{
    day=day.AddDays(10);
    if (day>DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date.AddDays(170))
        throw new InvalidOperationException("Database QA không còn khối ngày trống cho fixture.");
}
var customer = Account("CA", "CUSTOMER");
var other = Account("CB", "CUSTOMER");
var admin = Account("AD", "ADMIN");
var vet = Account("VT", "VET");
setup.UserAccounts.AddRange(customer, other, admin, vet);
await setup.SaveChangesAsync();
var vetStaff = new Staff { staffId = tag + "VT", userId = vet.userId, fullName = "Bác sĩ QA", phone = "0123456789", email = vet.email, role = "VET", status = "ACTIVE" };
setup.Staffs.Add(vetStaff);
var petA = Pet("PA", customer);
var petB = Pet("PB", other);
setup.Pets.AddRange(petA, petB);
var category = await setup.ServiceCategories.FirstAsync();
var care = await setup.CareTypes.FirstAsync();
var service = new ServicePackage { serviceId = tag + "SV", serviceName = "QA chỉ trong DB thử", description = "Không phải dịch vụ thật", categoryId = category.categoryId, price = 120000m, duration = 30, status = "ACTIVE" };
setup.ServicePackages.Add(service);
await setup.SaveChangesAsync();

UserAccount Account(string suffix, string role) => new() { userId = tag + suffix, firebaseUid = tag + suffix, fullName = "QA " + suffix, email = tag + suffix + "@petnova.invalid", phone = "0123456789", role = role, status = "ACTIVE", createdAt = DateTime.UtcNow };
Pet Pet(string suffix, UserAccount owner) => new() { petId = tag + suffix, userId = owner.userId, petName = "QA " + suffix, species = "Chó", breed = "Chưa rõ", gender = "Đực", birthDate = new DateTime(2024,1,1), weight = 5m, healthStatus = "Khỏe" };
T Bind<T>(T controller, UserAccount actor) where T : ControllerBase {
    controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
    controller.HttpContext.Items[PhienNguoiDung.Key] = actor;
    controller.HttpContext.Items["petnova.identity"] = new FirebaseIdentity(actor.firebaseUid, actor.email, true);
    return controller;
}
static int Status(IActionResult result) => result switch { ObjectResult value => value.StatusCode ?? 200, StatusCodeResult value => value.StatusCode, _ => 200 };
static void Require(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
async Task Run(string id, string description, Func<Task> test) {
    try { await test(); results.Add(new { id, description, status = "PASS", error = (string?)null }); Console.WriteLine("PASS " + id); }
    catch (Exception error) { failures++; results.Add(new { id, description, status = "FAIL", error = error.GetBaseException().Message }); Console.WriteLine("FAIL " + id + ": " + error.GetBaseException().Message); }
}
TaoLichRequest Request(int offset = 0) => new() { petId = petA.petId, careTypeId = care.careTypeId, bookingDate = day.AddDays(offset), bookingTime = TimeSpan.FromHours(9), serviceIds = [service.serviceId], paymentMethod = "CASH", requestId = tag + Guid.NewGuid().ToString("N") };
async Task<Booking> Create(TaoLichRequest request) {
    await using var db = new PetNoVaDbContext(options);
    var result = await Bind(new BookingsController(db, config), customer).CreateBooking(request);
    Require(Status(result) == 201, "Tạo lịch không trả 201: " + JsonSerializer.Serialize((result as ObjectResult)?.Value));
    return (Booking)((ObjectResult)result).Value!;
}
Booking? booking = null;
Payment? payment = null;
await Run("F4.5_01", "SQL: tạo lịch, chi tiết, giao dịch tiền mặt đồng bộ", async () => {
    booking = await Create(Request());
    await using var db = new PetNoVaDbContext(options);
    payment = await db.Payments.SingleAsync(p => p.bookingId == booking.bookingId);
    Require(await db.BookingDetails.CountAsync(d => d.bookingId == booking.bookingId) == 1, "Thiếu chi tiết");
    Require(payment.status == "PENDING" && payment.method == "CASH", "Sai giao dịch");
    Require(booking.totalAmount == service.price && booking.durationMinutes == service.duration, "Sai tiền/thời lượng");
});
await Run("F4.5_02", "SQL: phát lại requestId không tạo hai lịch", async () => {
    Require(booking is not null, "Thiếu lịch tiên quyết");
    var request = Request(); request.requestId = booking!.requestId!;
    await using var db = new PetNoVaDbContext(options);
    var response = await Bind(new BookingsController(db, config), customer).CreateBooking(request);
    Require(Status(response) == 200, "Phát lại không trả lịch cũ");
    Require(await db.Bookings.CountAsync(b => b.userId == customer.userId && b.requestId == request.requestId) == 1, "Tạo lịch trùng");
});
await Run("F4.7_02", "SQL: thú cưng khác chủ bị từ chối", async () => {
    await using var db = new PetNoVaDbContext(options);
    var request = Request(1); request.petId = petB.petId;
    Require(Status(await Bind(new BookingsController(db, config), customer).CreateBooking(request)) == 403, "Không chặn khác chủ");
});
await Run("F4.7_01", "SQL: không có dịch vụ không tạo lịch", async () => {
    await using var db = new PetNoVaDbContext(options); var request = Request(1); request.serviceIds = [];
    Require(Status(await Bind(new BookingsController(db, config), customer).CreateBooking(request)) == 400, "Không chặn thiếu dịch vụ");
});
await Run("F4.7_03", "SQL: mã dịch vụ trùng bị từ chối", async () => {
    await using var db = new PetNoVaDbContext(options); var request = Request(1); request.serviceIds = [service.serviceId, service.serviceId];
    Require(Status(await Bind(new BookingsController(db, config), customer).CreateBooking(request)) == 400, "Không chặn trùng dịch vụ");
});
await Run("F4.7_06", "SQL: 255 ký tự ghi chú được nhận, 256 bị từ chối", async () => {
    var valid = Request(2); valid.note = new string('a',255); await Create(valid);
    await using var db = new PetNoVaDbContext(options); var invalid = Request(3); invalid.note = new string('a',256);
    Require(Status(await Bind(new BookingsController(db, config), customer).CreateBooking(invalid)) == 400, "Không chặn ghi chú dài");
});
await Run("F12.2_01", "SQL: khách A không đọc/sửa thú cưng B", async () => {
    await using var db = new PetNoVaDbContext(options); var controller = Bind(new PetsController(db), customer);
    Require(Status(await controller.GetPet(petB.petId)) == 404, "Đọc được thú cưng B");
    Require(Status(await controller.UpdatePet(petB.petId, petB)) == 404, "Sửa được thú cưng B");
});
await Run("F12.2_02", "SQL: khách B không đọc lịch A", async () => {
    Require(booking is not null,"Thiếu lịch tiên quyết"); await using var db = new PetNoVaDbContext(options);
    Require(Status(await Bind(new BookingsController(db,config),other).GetBooking(booking!.bookingId)) == 404,"Lộ lịch A");
});
await Run("F12.2_03", "SQL: khách B không đọc thanh toán A", async () => {
    Require(payment is not null,"Thiếu giao dịch tiên quyết"); await using var db = new PetNoVaDbContext(options);
    var response = await Bind(new PaymentsController(db,config),other).GetPayment(payment!.paymentId);
    Require(response.Result is NotFoundResult,"Lộ thanh toán A");
});
await Run("F6_07", "SQL: khách B không đọc bệnh án/tiêm chủng thú cưng A", async () => {
    await using var db = new PetNoVaDbContext(options);
    Require(Status(await Bind(new MedicalRecordsController(db),other).GetMedicalRecordsByPet(petA.petId)) == 404,"Lộ bệnh án A");
    Require(Status(await Bind(new VaccinationsController(db),other).GetVaccinationsByPet(petA.petId)) == 404,"Lộ tiêm chủng A");
});
await Run("F9.7_01", "SQL: xác nhận tiền mặt và ngày thu", async () => {
    Require(payment is not null,"Thiếu giao dịch tiên quyết"); await using var db = new PetNoVaDbContext(options);
    Require(Status(await Bind(new PaymentsController(db,config),admin).ConfirmPayment(payment!.paymentId)) == 204,"Xác nhận thất bại");
    var saved = await db.Payments.AsNoTracking().SingleAsync(p=>p.paymentId == payment.paymentId);
    Require(saved.status == "PAID" && saved.paymentDate.HasValue,"Chưa lưu PAID/ngày thu");
});
await Run("F9.7_02", "SQL: xác nhận lặp không tạo thu/notification mới", async () => {
    Require(payment is not null,"Thiếu giao dịch tiên quyết"); await using var db = new PetNoVaDbContext(options);
    var before = await db.Notifications.CountAsync(n=>n.userId==customer.userId);
    Require(Status(await Bind(new PaymentsController(db,config),admin).ConfirmPayment(payment!.paymentId)) == 409,"Không từ chối xác nhận lặp");
    Require(await db.Notifications.CountAsync(n=>n.userId==customer.userId) == before,"Tạo thông báo thu trùng");
});
await Run("F4.9_03", "SQL: không hủy lịch có tiền PAID", async () => {
    Require(booking is not null,"Thiếu lịch tiên quyết"); await using var db = new PetNoVaDbContext(options);
    Require(Status(await Bind(new BookingsController(db,config),customer).CancelBooking(booking!.bookingId)) == 409,"Hủy lịch đã trả tiền");
});
await Run("F4.9_01", "SQL: hủy lịch chưa trả chuyển giao dịch FAILED", async () => {
    var created = await Create(Request(4)); await using var db = new PetNoVaDbContext(options);
    Require(Status(await Bind(new BookingsController(db,config),customer).CancelBooking(created.bookingId)) == 204,"Hủy lịch thất bại");
    Require(await db.Payments.AnyAsync(p=>p.bookingId==created.bookingId && p.status=="FAILED"),"Giao dịch chưa FAILED");
});
await Run("F5.3_01-concurrent", "SQL: hai lần thử lại đồng thời chỉ tạo một PENDING", async () => {
    var created = await Create(Request(5)); await using var db = new PetNoVaDbContext(options);
    var failed = await db.Payments.SingleAsync(p=>p.bookingId==created.bookingId); failed.status="FAILED"; await db.SaveChangesAsync();
    async Task<int> Retry() { await using var separate = new PetNoVaDbContext(options); return Status(await Bind(new PaymentsController(separate,config),customer).RetryPayment(failed.paymentId)); }
    var statuses=await Task.WhenAll(Retry(),Retry());
    Require(statuses.Order().SequenceEqual(new[]{201,409}), "Kết quả đồng thời: " + string.Join(',',statuses));
    Require(await db.Payments.CountAsync(p=>p.bookingId==created.bookingId && p.status=="PENDING")==1,"Tạo PENDING trùng");
});
await Run("F7_03-F7_04", "SQL: đọc thông báo lưu trạng thái và đọc lặp an toàn", async () => {
    await using var db = new PetNoVaDbContext(options); var note=await db.Notifications.FirstAsync(n=>n.userId==customer.userId);
    var controller=Bind(new NotificationsController(db),customer);
    Require(Status(await controller.MarkAsRead(note.notificationId))==204,"Không lưu đọc");
    Require(Status(await controller.MarkAsRead(note.notificationId))==204,"Đọc lặp lỗi");
    Require(await db.Notifications.AsNoTracking().AnyAsync(n=>n.notificationId==note.notificationId&&n.isRead),"Đọc không bền vững");
});
await Run("F12.2_04", "SQL: khách B không đọc/đánh dấu thông báo A", async () => {
    await using var db = new PetNoVaDbContext(options); var note=await db.Notifications.FirstAsync(n=>n.userId==customer.userId);
    var controller=Bind(new NotificationsController(db),other);
    Require(Status(await controller.GetNotification(note.notificationId))==404,"Lộ thông báo");
    Require(Status(await controller.MarkAsRead(note.notificationId))==404,"Sửa thông báo người khác");
    Require(Status(await controller.MarkAllAsRead(customer.userId))==403,"Đọc tất cả người khác");
});
await Run("F11.14_03-F11.14_04", "SQL: báo cáo chặn khoảng đảo ngược hoặc quá 3 năm", async () => {
    await using var db = new PetNoVaDbContext(options); var controller=Bind(new ReportsController(db),admin);
    Require(Status(await controller.Get(day,day.AddDays(-1)))==400,"Không chặn khoảng đảo ngược");
    Require(Status(await controller.Get(day,day.AddYears(3).AddDays(1)))==400,"Không chặn khoảng quá 3 năm");
});
await Run("F12_02-policy", "Chính sách route: chỉ ADMIN đọc báo cáo/nhật ký", () => {
    foreach(var role in new[]{"CUSTOMER","STAFF","VET","ADMIN"}) {
        Require(KiemTraQuyen.Allowed("Reports","Get","GET",role)==(role=="ADMIN"),"Sai quyền báo cáo " + role);
        Require(KiemTraQuyen.Allowed("AuditLogs","Get","GET",role)==(role=="ADMIN"),"Sai quyền nhật ký " + role);
    }
    Require(!KiemTraQuyen.Allowed("MedicalRecords","CreateMedicalRecord","POST","CUSTOMER"),"Khách ghi bệnh án");
    Require(!KiemTraQuyen.Allowed("Staffs","CreateStaff","POST","CUSTOMER"),"Khách tạo nhân sự");
    return Task.CompletedTask;
});

await Run("F8_02", "SQL: tên chỉ có khoảng trắng bị từ chối, hồ sơ không đổi", async () => {
    await using var db=new PetNoVaDbContext(options);
    var before=await db.UserAccounts.AsNoTracking().SingleAsync(u=>u.userId==customer.userId);
    var response=await Bind(new UserAccountsController(db,new NeverVerify()),customer).UpdateProfileByEmail(customer.email,new UpdateProfileRequest{fullName="   ",phone="0123456789"},default);
    Require(Status(response)==400,"Không chặn tên trống");
    Require((await db.UserAccounts.AsNoTracking().SingleAsync(u=>u.userId==customer.userId)).fullName==before.fullName,"Đã đổi tên dù bị từ chối");
});
await Run("F8_03", "SQL: tên 100 ký tự được lưu, 101 bị chặn trước SQL", async () => {
    await using var db=new PetNoVaDbContext(options);
    string phone;
    do { phone="+84"+Random.Shared.Next(100000000,999999999); } while(await db.UserAccounts.AnyAsync(u=>u.normalizedPhone==phone));
    var controller=Bind(new UserAccountsController(db,new NeverVerify()),customer);
    Require(Status(await controller.UpdateProfileByEmail(customer.email,new UpdateProfileRequest{fullName=new string('a',100),phone=phone},default))==204,"Tên 100 ký tự không được lưu");
    Require(Status(await controller.UpdateProfileByEmail(customer.email,new UpdateProfileRequest{fullName=new string('a',101),phone=phone},default))==400,"Không chặn tên quá dài");
});
await Run("F9.5_04", "SQL: không bỏ bước PENDING sang COMPLETED", async () => {
    Require(booking is not null,"Thiếu lịch tiên quyết"); await using var db=new PetNoVaDbContext(options);
    Require(Status(await Bind(new BookingsController(db,config),admin).UpdateBookingStatus(booking!.bookingId,new DoiTrangThaiRequest{status="COMPLETED"}))==409,"Cho bỏ bước trạng thái");
});
await Run("F9.3_01", "SQL: phân công nhân sự ACTIVE còn trống", async () => {
    Require(booking is not null,"Thiếu lịch tiên quyết"); await using var db=new PetNoVaDbContext(options);
    Require(Status(await Bind(new BookingsController(db,config),admin).AssignBooking(booking!.bookingId,new GanNhanVienRequest{staffId=vetStaff.staffId}))==200,"Phân công thất bại");
});
MedicalRecord? clinical=null;
await Run("F10.4_01", "SQL: bác sĩ được phân công tạo bệnh án đúng tác giả", async () => {
    await using var db=new PetNoVaDbContext(options);
    var response=await Bind(new MedicalRecordsController(db),vet).CreateMedicalRecord(new MedicalRecord{petId=petA.petId,diagnosis="Chẩn đoán QA",treatment="Điều trị QA",weight=5,followUpDate=day});
    Require(Status(response)==201,"Không lưu được bệnh án");
    clinical=(MedicalRecord)((ObjectResult)response).Value!;
    Require(clinical.staffId==vetStaff.staffId,"Sai tác giả");
});
await Run("F10.4_04", "SQL: chẩn đoán 256 ký tự bị chặn", async () => {
    await using var db=new PetNoVaDbContext(options);
    Require(Status(await Bind(new MedicalRecordsController(db),vet).CreateMedicalRecord(new MedicalRecord{petId=petA.petId,diagnosis=new string('a',256),treatment="QA"}))==400,"Không chặn chẩn đoán dài");
});
await Run("F10.7_02", "SQL: bác sĩ không ghi bệnh án cho thú cưng ngoài phạm vi", async () => {
    await using var db=new PetNoVaDbContext(options);
    Require(Status(await Bind(new MedicalRecordsController(db),vet).CreateMedicalRecord(new MedicalRecord{petId=petB.petId,diagnosis="QA",treatment="QA"}))==404,"Ghi được bệnh án ngoài phạm vi");
});
await Run("F10.5_01-F10.5_02", "SQL: sửa bệnh án cần lý do và lưu bản trước sửa", async () => {
    Require(clinical is not null,"Thiếu bệnh án tiên quyết"); await using var db=new PetNoVaDbContext(options);
    var controller=Bind(new MedicalRecordsController(db),vet);
    var edit=new SuaBenhAn{diagnosis="Sau sửa QA",treatment="Điều trị QA",correctionReason=""};
    Require(Status(await controller.Correct(clinical!.recordId,edit))==400,"Sửa không có lý do");
    edit.correctionReason="Đối chiếu QA";
    Require(Status(await controller.Correct(clinical.recordId,edit))==200,"Không sửa được bệnh án");
    var revision=await db.ClinicalRevisions.SingleAsync(r=>r.entityId==clinical.recordId&&r.entityType=="MEDICAL_RECORD");
    Require(JsonDocument.Parse(revision.oldData).RootElement.GetProperty("diagnosis").GetString()=="Chẩn đoán QA","Mất bản trước sửa");
});
await Run("F10.6_01", "SQL: lưu mũi tiêm hợp lệ", async () => {
    await using var db=new PetNoVaDbContext(options); var today=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date;
    Require(Status(await Bind(new VaccinationsController(db),vet).CreateVaccination(new Vaccination{petId=petA.petId,vaccineName="QA",vaccinationDate=today,nextDate=today.AddMonths(1)}))==201,"Không lưu được mũi tiêm");
});
await Run("F10.6_03-F10.6_04-F10.6_05", "SQL: chặn ngày nhắc trùng, ngày tiêm tương lai, ngày nhắc quá 10 năm", async () => {
    await using var db=new PetNoVaDbContext(options); var today=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date;
    var controller=Bind(new VaccinationsController(db),vet);
    foreach(var dates in new[]{(today,today),(today.AddDays(1),today.AddMonths(1)),(today,today.AddYears(10).AddDays(1))})
        Require(Status(await controller.CreateVaccination(new Vaccination{petId=petA.petId,vaccineName="QA",vaccinationDate=dates.Item1,nextDate=dates.Item2}))==400,"Cho lưu ngày tiêm sai");
});

await Run("F9.7_02-concurrent", "SQL: hai xác nhận tiền mặt đồng thời chỉ ghi nhận một lần", async () => {
    var created=await Create(Request(7)); await using var db=new PetNoVaDbContext(options);
    var pending=await db.Payments.SingleAsync(p=>p.bookingId==created.bookingId);
    async Task<int> Confirm() { await using var separate=new PetNoVaDbContext(options); return Status(await Bind(new PaymentsController(separate,config),admin).ConfirmPayment(pending.paymentId)); }
    var statuses=await Task.WhenAll(Confirm(),Confirm());
    Require(statuses.Order().SequenceEqual(new[]{204,409}),"Xác nhận đồng thời: "+string.Join(',',statuses));
});

await Run("QA-payment-conflicting-actions", "SQL: xác nhận và đánh dấu thất bại đồng thời không cùng thành công", async () => {
    var created=await Create(Request(8)); await using var db=new PetNoVaDbContext(options);
    var pending=await db.Payments.SingleAsync(p=>p.bookingId==created.bookingId);
    async Task<int> Change(bool confirm) {
        await using var separate=new PetNoVaDbContext(options);
        var controller=Bind(new PaymentsController(separate,config),admin);
        return Status(confirm ? await controller.ConfirmPayment(pending.paymentId) : await controller.FailedPayment(pending.paymentId));
    }
    var statuses=await Task.WhenAll(Change(true),Change(false));
    Require(statuses.Order().SequenceEqual(new[]{204,409}),"Xác nhận/thất bại đồng thời: "+string.Join(',',statuses));
});

await Run("QA-payment-refund-concurrent", "SQL: ghi nhận hoàn tiền lặp đồng thời chỉ tạo một thông báo", async () => {
    Require(payment is not null,"Thiếu thanh toán PAID tiên quyết");
    await using var db=new PetNoVaDbContext(options);
    var before=await db.Notifications.CountAsync(n=>n.userId==customer.userId&&n.title=="Đã ghi nhận hoàn tiền");
    async Task<int> Refund() {
        await using var separate=new PetNoVaDbContext(options);
        return Status(await Bind(new PaymentsController(separate,config),admin).RefundPayment(payment!.paymentId,new HoanTienRequest{reason="QA dữ liệu thử",reference=tag+"-TEST-ONLY"}));
    }
    var statuses=await Task.WhenAll(Refund(),Refund());
    Require(statuses.Order().SequenceEqual(new[]{204,409}),"Hoàn tiền đồng thời: "+string.Join(',',statuses));
    Require(await db.Notifications.CountAsync(n=>n.userId==customer.userId&&n.title=="Đã ghi nhận hoàn tiền")==before+1,"Thông báo hoàn tiền bị trùng");
});

// Khóa ký chỉ dùng trong test. SDK xác minh HMAC cục bộ, không kết nối PayOS/ngân hàng.
const string qaChecksum="qa-local-checksum-not-a-real-payos-secret";
var webhookConfig=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{
    ["PayOS:ClientId"]="qa-local-client",["PayOS:ApiKey"]="qa-local-api-key",["PayOS:ChecksumKey"]=qaChecksum
}).Build();
Payment? bankPayment=null;
Webhook LocalWebhook(Payment target,long? amount=null,bool invalidSignature=false) {
    var data=JsonSerializer.Deserialize<WebhookData>(JsonSerializer.Serialize(new {
        orderCode=long.Parse(new string(target.paymentId.Where(char.IsDigit).ToArray())),
        amount=amount??decimal.ToInt64(target.amount),description="QA LOCAL ONLY",accountNumber="QA-ONLY",
        reference=tag,transactionDateTime="2026-10-26 12:00:00",currency="VND",paymentLinkId="QA-ONLY",code="00",desc="success"
    }))!;
    var signature=invalidSignature?"qa-invalid-signature":new CryptoProvider().CreateSignatureFromObject(data,qaChecksum);
    return JsonSerializer.Deserialize<Webhook>(JsonSerializer.Serialize(new {code="00",desc="success",success=true,data,signature}))!;
}
await Run("F5.2_03-local-signature-amount", "SQL + SDK cục bộ: chữ ký sai hoặc số tiền sai không ghi PAID",async()=>{
    var request=Request(1);request.paymentMethod="BANK_TRANSFER";
    var created=await Create(request);await using var db=new PetNoVaDbContext(options);
    bankPayment=await db.Payments.AsNoTracking().SingleAsync(p=>p.bookingId==created.bookingId);
    Require(Status(await Bind(new PaymentsController(db,webhookConfig),admin).HandlePayOSWebhook(LocalWebhook(bankPayment,invalidSignature:true)))==400,"Chấp nhận chữ ký sai");
    Require(Status(await Bind(new PaymentsController(db,webhookConfig),admin).HandlePayOSWebhook(LocalWebhook(bankPayment,amount:1)))==200,"SDK không xác minh được fixture HMAC cục bộ");
    Require(await db.Payments.AsNoTracking().AnyAsync(p=>p.paymentId==bankPayment.paymentId&&p.status=="PENDING"),"Đã ghi PAID dù sai chữ ký/số tiền");
});
await Run("F5.2_04-concurrent-local-webhook", "SQL + SDK cục bộ: hai webhook hợp lệ đồng thời không tạo thông báo trùng",async()=>{
    Require(bankPayment is not null,"Thiếu fixture chuyển khoản");await using var db=new PetNoVaDbContext(options);
    var before=await db.Notifications.CountAsync(n=>n.userId==customer.userId&&n.title=="Thanh toán thành công");
    async Task<int> Webhook() {
        await using var separate=new PetNoVaDbContext(options);
        return Status(await Bind(new PaymentsController(separate,webhookConfig),admin).HandlePayOSWebhook(LocalWebhook(bankPayment!)));
    }
    var statuses=await Task.WhenAll(Webhook(),Webhook());
    Require(statuses.All(status=>status==200),"Không nhận webhook cục bộ: "+string.Join(',',statuses));
    Require(await db.Payments.AsNoTracking().AnyAsync(p=>p.paymentId==bankPayment!.paymentId&&p.status=="PAID"),"Không ghi PAID");
    Require(await db.Notifications.CountAsync(n=>n.userId==customer.userId&&n.title=="Thanh toán thành công")==before+1,"Thông báo PAID bị trùng khi webhook đồng thời");
});

var output = args.Length>0 ? args[0] : "qa/results/sql-integration.json";
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output))!);
File.WriteAllText(output, JsonSerializer.Serialize(new { executedAtUtc=DateTime.UtcNow, database, environment="Controller thật + SQL bản sao; Firebase identity giả lập trong HttpContext, không xác minh đăng nhập Firebase", fixtureTag=tag, passed=results.Count-failures, failed=failures, results },new JsonSerializerOptions{WriteIndented=true}));
Console.WriteLine($"SQL integration: {results.Count-failures}/{results.Count} PASS; DB={database}; fixtures={tag}");
return failures==0 ? 0 : 1;

sealed class NeverVerify : IFirebaseTokenVerifier
{
    public Task<FirebaseIdentity?> VerifyAsync(string token,CancellationToken cancellationToken=default) =>
        throw new InvalidOperationException("Token trong request này đã được bộ lọc xác minh; không gọi Firebase hai lần.");
}
