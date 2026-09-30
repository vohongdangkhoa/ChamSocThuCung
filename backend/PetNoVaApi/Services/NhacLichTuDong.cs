using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Services;

/// <summary>Gửi thông báo trong tài khoản khi gần đến lịch hẹn hoặc ngày tiêm nhắc lại.</summary>
public sealed class NhacLichTuDong(IServiceScopeFactory scopeFactory, ILogger<NhacLichTuDong> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnce(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Không thể tạo thông báo nhắc lịch."); }
            try { await Task.Delay(TimeSpan.FromHours(1), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task RunOnce(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<PetNoVaDbContext>();
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlRawAsync("DECLARE @result int; EXEC @result = sp_getapplock @Resource='PetNova:reminders', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000; IF @result < 0 THROW 51001, 'Khong the khoa nhac lich', 1;", ct);
            var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date;
            var tomorrow = today.AddDays(1);
            var bookings = await db.Bookings.AsNoTracking().Where(b => b.bookingDate == tomorrow &&
                (b.status == "PENDING" || b.status == "CONFIRMED")).ToListAsync(ct);
            foreach (var booking in bookings)
                await AddIfMissing(db, booking.userId, "Lịch hẹn ngày mai",
                    $"Bạn có lịch hẹn lúc {booking.bookingTime:hh\\:mm} ngày {tomorrow:dd/MM/yyyy}.",
                    "BOOKING", booking.bookingId, ct);

            var until = today.AddDays(7);
            var vaccinations = await db.Vaccinations.AsNoTracking()
                .Where(v => v.nextDate >= today && v.nextDate <= until)
                .Join(db.Pets, v => v.petId, p => p.petId, (v, p) => new { v, p })
                .Where(x => !x.p.isArchived).ToListAsync(ct);
            foreach (var item in vaccinations)
                await AddIfMissing(db, item.p.userId, "Nhắc lịch tiêm chủng",
                    $"{item.p.petName} đến lịch nhắc {item.v.vaccineName} ngày {item.v.nextDate:dd/MM/yyyy}.",
                    "VACCINATION", item.v.vaccinationId, ct);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        });
    }

    private static async Task AddIfMissing(PetNoVaDbContext db, string userId, string title, string message,
        string kind, string id, CancellationToken ct)
    {
        var safeMessage = message.Length <= 255 ? message : message[..255];
        if (await db.Notifications.AnyAsync(n => n.userId == userId && n.title == title &&
            n.message == safeMessage && n.relatedId == id && n.relatedType == kind, ct)) return;
        db.Notifications.Add(new Notification
        {
            notificationId = await MaDinhDanh.NextAsync(db, "NOTIFICATION", "notificationId", "N", ct),
            userId = userId, title = title, message = safeMessage,
            notificationType = kind, relatedId = id, relatedType = kind,
            isRead = false, createdAt = DateTime.Now
        });
    }
}
