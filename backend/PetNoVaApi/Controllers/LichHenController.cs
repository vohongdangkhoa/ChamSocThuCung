using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers;

public sealed class TaoLichRequest
{
    public string petId { get; set; } = "";
    public DateTime bookingDate { get; set; }
    public TimeSpan bookingTime { get; set; }
    public string careTypeId { get; set; } = "";
    public string? note { get; set; }
    public string? staffId { get; set; }
    public List<string> serviceIds { get; set; } = [];
    public string paymentMethod { get; set; } = "";
    public string requestId { get; set; } = "";
}
public sealed class DoiLichRequest
{
    public DateTime bookingDate { get; set; }
    public TimeSpan bookingTime { get; set; }
    public string? staffId { get; set; }
    public string? note { get; set; }
}
public sealed class GanNhanVienRequest { public string staffId { get; set; } = ""; }
public sealed class DoiTrangThaiRequest { public string status { get; set; } = ""; }

[Route("api/Bookings"), ApiController]
public sealed class BookingsController(PetNoVaDbContext db, IConfiguration config) : ControllerBase
{
    private UserAccount Current => PhienNguoiDung.Get(HttpContext);
    private static DateTime Today => DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date;
    private int Capacity => Math.Clamp(config.GetValue("Booking:Capacity", 3), 1, 100);
    private IQueryable<Booking> Visible => Current.role switch
    {
        "CUSTOMER" => db.Bookings.Where(b => b.userId == Current.userId),
        "VET" => db.Bookings.Where(b => db.Staffs.Any(s => s.userId == Current.userId && s.staffId == b.staffId)),
        _ => db.Bookings
    };

    [HttpGet]
    public async Task<IActionResult> GetBookings(DateTime? from, DateTime? to, int page = 1)
    {
        var query = Visible.AsNoTracking();
        if (from.HasValue) query = query.Where(b => b.bookingDate >= from.Value.Date);
        if (to.HasValue) query = query.Where(b => b.bookingDate <= to.Value.Date);
        Response.Headers["X-Total-Count"] = (await query.CountAsync()).ToString();
        return Ok(await query.OrderByDescending(b => b.bookingDate).ThenBy(b => b.bookingTime).ThenBy(b => b.bookingId)
            .Skip((Math.Clamp(page, 1, 10000) - 1) * 200).Take(200).ToListAsync());
    }

    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetBookingsByUserId(string userId) => Ok(await Visible
        .Where(b => b.userId == userId).AsNoTracking().OrderByDescending(b => b.createdAt).ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBooking(string id)
    {
        var booking = await Visible.AsNoTracking().FirstOrDefaultAsync(b => b.bookingId == id);
        return booking is null ? NotFound() : Ok(booking);
    }

    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability(DateTime date, string? serviceIds, string? petId,
        string? staffId, string? excludeBookingId)
    {
        var ids = (serviceIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (date.Date < Today || date.Date > Today.AddMonths(6) || ids.Length is < 1 or > 10)
            return BadRequest("Chọn ngày trong vòng 6 tháng và từ 1 đến 10 dịch vụ.");
        if (Current.role == "CUSTOMER" && (string.IsNullOrWhiteSpace(petId) ||
            !await db.Pets.AnyAsync(p => p.petId == petId && p.userId == Current.userId && !p.isArchived)))
            return StatusCode(403, new { message = "Chọn thú cưng của chính bạn." });
        var services = await db.ServicePackages.AsNoTracking().Where(s => ids.Contains(s.serviceId) && s.status == "ACTIVE").ToListAsync();
        if (services.Count != ids.Length) return BadRequest("Một dịch vụ không còn hoạt động.");
        var duration = services.Sum(s => s.duration);
        if (duration is < 1 or > 480) return BadRequest("Tổng thời gian dịch vụ không hợp lệ.");
        var staff = await db.Staffs.AsNoTracking().Where(s => s.status == "ACTIVE")
            .Select(s => new { s.staffId, s.fullName, s.role }).ToListAsync();
        if (staffId is not null && staff.All(s => s.staffId != staffId)) return BadRequest("Nhân sự không khả dụng.");
        var existing = await db.Bookings.AsNoTracking().Where(b => b.bookingDate == date.Date &&
            b.status != "CANCELLED" && b.bookingId != excludeBookingId).ToListAsync();
        var now = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).DateTime;
        var slots = Enumerable.Range(0, 20).Select(i => TimeSpan.FromHours(8) + TimeSpan.FromMinutes(i * 30))
            .Where(t => t + TimeSpan.FromMinutes(duration) <= TimeSpan.FromHours(18))
            .Select(t =>
            {
                var (available, reason) = CheckSlot(existing, date.Date, t, duration, petId, staffId, now);
                return new { time = t.ToString(@"hh\:mm"), available, reason };
            }).ToList();
        return Ok(new { slots, staff, durationMinutes = duration });
    }

    [HttpPost]
    public async Task<IActionResult> CreateBooking(TaoLichRequest request)
    {
        var invalid = ValidateInput(request.bookingDate, request.bookingTime, request.note);
        if (invalid is not null) return BadRequest(invalid);
        if (request.serviceIds is null || request.serviceIds.Count is < 1 or > 10 ||
            request.serviceIds.Distinct(StringComparer.OrdinalIgnoreCase).Count() != request.serviceIds.Count ||
            request.paymentMethod is not ("CASH" or "BANK_TRANSFER") ||
            string.IsNullOrWhiteSpace(request.requestId) || request.requestId.Length > 80)
            return BadRequest("Dịch vụ, phương thức hoặc mã yêu cầu không hợp lệ.");
        if (Current.role != "CUSTOMER") return StatusCode(403, new { message = "Chỉ khách hàng được tạo lịch tại đây." });
        if (!await db.Pets.AnyAsync(p => p.petId == request.petId && p.userId == Current.userId && !p.isArchived))
            return StatusCode(403, new { message = "Thú cưng không thuộc tài khoản này." });
        if (!await db.CareTypes.AnyAsync(c => c.careTypeId == request.careTypeId)) return BadRequest("Hình thức chăm sóc không tồn tại.");
        var services = await db.ServicePackages.Where(s => request.serviceIds.Contains(s.serviceId) && s.status == "ACTIVE").ToListAsync();
        if (services.Count != request.serviceIds.Count) return BadRequest("Một dịch vụ không còn hoạt động.");
        var duration = services.Sum(s => s.duration);
        var amount = services.Sum(s => s.price);
        if (duration is < 1 or > 480 || amount <= 0) return BadRequest("Tổng dịch vụ không hợp lệ.");
        var result = await InBookingLock(async () =>
        {
            var old = await db.Bookings.FirstOrDefaultAsync(b => b.userId == Current.userId && b.requestId == request.requestId);
            if (old is not null) return (Result: (IActionResult)Ok(old), Completed: true);
            var staff = await ValidateStaff(request.staffId);
            if (request.staffId is not null && !staff) return (Result: (IActionResult)BadRequest("Nhân sự không khả dụng."), Completed: false);
            var existing = await db.Bookings.Where(b => b.bookingDate == request.bookingDate.Date && b.status != "CANCELLED").ToListAsync();
            var (available, reason) = CheckSlot(existing, request.bookingDate.Date, request.bookingTime, duration,
                request.petId, request.staffId, DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).DateTime);
            if (!available) return (Result: (IActionResult)Conflict(reason), Completed: false);
            var booking = new Booking
            {
                bookingId = await MaDinhDanh.NextAsync(db, "BOOKING", "bookingId", "B"),
                userId = Current.userId, petId = request.petId, careTypeId = request.careTypeId,
                bookingDate = request.bookingDate.Date, bookingTime = request.bookingTime,
                staffId = request.staffId, note = request.note?.Trim(), status = "PENDING",
                totalAmount = amount, durationMinutes = duration, requestId = request.requestId,
                createdAt = DateTime.Now
            };
            db.Bookings.Add(booking);
            foreach (var service in services)
                db.BookingDetails.Add(new BookingDetail
                {
                    detailId = await MaDinhDanh.NextAsync(db, "BOOKING_DETAIL", "detailId", "BD"),
                    bookingId = booking.bookingId, serviceId = service.serviceId, quantity = 1, price = service.price
                });
            db.Payments.Add(new Payment
            {
                paymentId = await MaDinhDanh.NextAsync(db, "PAYMENT", "paymentId", "PM"),
                bookingId = booking.bookingId, method = request.paymentMethod, amount = amount, status = "PENDING"
            });
            await Notify(booking.userId, "Đặt lịch thành công", "Lịch hẹn đã được tạo và đang chờ xác nhận.", booking.bookingId);
            await db.SaveChangesAsync();
            return (Result: (IActionResult)CreatedAtAction(nameof(GetBooking), new { id = booking.bookingId }, booking), Completed: true);
        });
        return result;
    }

    [HttpPut("{id}/reschedule")]
    public async Task<IActionResult> RescheduleBooking(string id, DoiLichRequest request)
    {
        var invalid = ValidateInput(request.bookingDate, request.bookingTime, request.note);
        if (invalid is not null) return BadRequest(invalid);
        return await InBookingLock(async () =>
        {
            var booking = await Visible.FirstOrDefaultAsync(b => b.bookingId == id);
            if (booking is null) return ((IActionResult)NotFound(), false);
            if (booking.status is not ("PENDING" or "CONFIRMED"))
                return ((IActionResult)Conflict("Chỉ đổi lịch đang chờ hoặc đã xác nhận."), false);
            if (request.staffId is not null && !await ValidateStaff(request.staffId))
                return ((IActionResult)BadRequest("Nhân sự không khả dụng."), false);
            var existing = await db.Bookings.Where(b => b.bookingDate == request.bookingDate.Date &&
                b.status != "CANCELLED" && b.bookingId != id).ToListAsync();
            var (available, reason) = CheckSlot(existing, request.bookingDate.Date, request.bookingTime,
                booking.durationMinutes, booking.petId, request.staffId, DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).DateTime);
            if (!available) return ((IActionResult)Conflict(reason), false);
            booking.bookingDate = request.bookingDate.Date; booking.bookingTime = request.bookingTime;
            booking.staffId = request.staffId; booking.note = request.note?.Trim();
            await Notify(booking.userId, "Lịch hẹn đã thay đổi", "Ngày giờ lịch hẹn đã được cập nhật. Vui lòng kiểm tra lại.", booking.bookingId);
            await db.SaveChangesAsync(); return ((IActionResult)Ok(booking), true);
        });
    }

    [HttpPut("{id}/assign")]
    public async Task<IActionResult> AssignBooking(string id, GanNhanVienRequest request)
    {
        if (Current.role is not ("STAFF" or "ADMIN")) return StatusCode(403);
        if (!await ValidateStaff(request.staffId)) return BadRequest("Nhân sự không khả dụng.");
        return await InBookingLock(async () =>
        {
            var booking = await db.Bookings.FirstOrDefaultAsync(b => b.bookingId == id);
            if (booking is null) return ((IActionResult)NotFound(), false);
            if (booking.status is "CANCELLED" or "COMPLETED") return ((IActionResult)Conflict("Lịch đã kết thúc."), false);
            var other = await db.Bookings.Where(b => b.bookingDate == booking.bookingDate && b.status != "CANCELLED" && b.bookingId != id).ToListAsync();
            var (available, reason) = CheckSlot(other, booking.bookingDate, booking.bookingTime,
                booking.durationMinutes, booking.petId, request.staffId, DateTime.MinValue);
            if (!available) return ((IActionResult)Conflict(reason), false);
            booking.staffId = request.staffId;
            await Notify(booking.userId, "Đã phân công người chăm sóc", "PetNoVa đã phân công nhân sự phụ trách lịch hẹn.", id);
            await db.SaveChangesAsync(); return ((IActionResult)Ok(booking), true);
        });
    }

    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelBooking(string id)
    {
        return await InBookingLock(async () =>
        {
            var booking = await Visible.FirstOrDefaultAsync(b => b.bookingId == id);
            if (booking is null) return ((IActionResult)NotFound(), false);
            if (booking.status is not ("PENDING" or "CONFIRMED")) return ((IActionResult)Conflict("Lịch đã bắt đầu hoặc đã kết thúc."), false);
            if (await db.Payments.AnyAsync(p => p.bookingId == id && p.status == "PAID"))
                return ((IActionResult)Conflict("Lịch đã thanh toán. PetNoVa cần xử lý hoàn tiền trước khi hủy."), false);
            booking.status = "CANCELLED";
            foreach (var payment in await db.Payments.Where(p => p.bookingId == id && p.status == "PENDING").ToListAsync()) payment.status = "FAILED";
            await Notify(booking.userId, "Lịch hẹn đã hủy", "PetNoVa đã ghi nhận yêu cầu hủy lịch hẹn.", id);
            await db.SaveChangesAsync(); return ((IActionResult)NoContent(), true);
        });
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateBookingStatus(string id, DoiTrangThaiRequest request)
    {
        if (Current.role is not ("STAFF" or "ADMIN")) return StatusCode(403);
        return await InBookingLock(async () =>
        {
            var booking = await db.Bookings.FirstOrDefaultAsync(b => b.bookingId == id);
            if (booking is null) return ((IActionResult)NotFound(), false);
            var next = request.status?.Trim().ToUpperInvariant();
            var allowed = (booking.status, next) is ("PENDING", "CONFIRMED") or
                ("CONFIRMED", "IN_PROGRESS") or ("IN_PROGRESS", "COMPLETED");
            if (!allowed) return ((IActionResult)Conflict("Không thể chuyển sang trạng thái này."), false);
            if (next == "COMPLETED" && !await db.Payments.AnyAsync(p => p.bookingId == id && p.status == "PAID"))
                return ((IActionResult)Conflict("Cần xác nhận thanh toán trước khi hoàn thành."), false);
            booking.status = next!;
            await Notify(booking.userId, next switch
            {
                "CONFIRMED" => "Lịch hẹn đã xác nhận", "IN_PROGRESS" => "Dịch vụ đang thực hiện", _ => "Dịch vụ hoàn thành"
            }, "Trạng thái lịch hẹn của bạn đã được cập nhật.", id);
            await db.SaveChangesAsync(); return ((IActionResult)NoContent(), true);
        });
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteBooking(string id) => Conflict("Lịch hẹn là chứng từ lịch sử. Hãy hủy lịch theo quy trình thay vì xóa.");

    private string? ValidateInput(DateTime date, TimeSpan time, string? note)
    {
        if (date.Date < Today || date.Date > Today.AddMonths(6)) return "Ngày hẹn phải trong vòng 6 tháng tới.";
        if (time < TimeSpan.FromHours(8) || time >= TimeSpan.FromHours(18) || time.Minutes % 30 != 0 || time.Seconds != 0)
            return "Khung giờ phải từ 08:00 đến 18:00 và theo bước 30 phút.";
        if (note?.Length > 255) return "Ghi chú tối đa 255 ký tự.";
        return null;
    }

    private async Task<bool> ValidateStaff(string? id) => id is null || await db.Staffs.AnyAsync(s => s.staffId == id && s.status == "ACTIVE");

    private (bool Available, string Reason) CheckSlot(List<Booking> existing, DateTime date, TimeSpan time,
        int duration, string? petId, string? staffId, DateTime now)
    {
        if (date + time <= now) return (false, "Khung giờ đã qua.");
        if (duration <= 0 || time + TimeSpan.FromMinutes(duration) > TimeSpan.FromHours(18)) return (false, "Không đủ thời gian trong ngày.");
        var overlapping = existing.Where(b => b.bookingTime < time + TimeSpan.FromMinutes(duration) &&
            b.bookingTime + TimeSpan.FromMinutes(Math.Max(1, b.durationMinutes)) > time).ToList();
        if (petId is not null && overlapping.Any(b => b.petId == petId)) return (false, "Thú cưng đã có lịch trùng giờ.");
        if (staffId is not null && overlapping.Any(b => b.staffId == staffId)) return (false, "Nhân sự đã có lịch trùng giờ.");
        if (overlapping.Count >= Capacity) return (false, "Khung giờ đã đủ công suất.");
        return (true, "");
    }

    private async Task Notify(string userId, string title, string message, string bookingId)
    {
        db.Notifications.Add(new Notification
        {
            notificationId = await MaDinhDanh.NextAsync(db, "NOTIFICATION", "notificationId", "N"),
            userId = userId, title = title, message = message, notificationType = "BOOKING",
            relatedId = bookingId, relatedType = "BOOKING", isRead = false, createdAt = DateTime.Now
        });
    }

    private async Task<IActionResult> InBookingLock(Func<Task<(IActionResult Result, bool Completed)>> work)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            await db.Database.ExecuteSqlRawAsync("DECLARE @result int; EXEC @result = sp_getapplock @Resource='PetNova:lich-hen', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000; IF @result < 0 THROW 51000, 'Khong the khoa lich hen', 1;");
            var (result, completed) = await work();
            if (completed) await tx.CommitAsync();
            return result;
        });
    }
}
