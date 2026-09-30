using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers;

public sealed class NoiDungThongBao
{
    public string title { get; set; } = "";
    public string message { get; set; } = "";
    public string? userId { get; set; }
}

[Route("api/Notifications"), ApiController]
public sealed class NotificationsController(PetNoVaDbContext db) : ControllerBase
{
    private UserAccount Current => PhienNguoiDung.Get(HttpContext);
    private IQueryable<Notification> Visible => Current.role == "ADMIN"
        ? db.Notifications : db.Notifications.Where(n => n.userId == Current.userId);

    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetNotificationsByUserId(string userId)
    {
        if (Current.role != "ADMIN" && userId != Current.userId) return StatusCode(403);
        return Ok(await Visible.Where(n => n.userId == userId).AsNoTracking()
            .OrderByDescending(n => n.createdAt).Take(200).ToListAsync());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetNotification(string id)
    {
        var item = await Visible.AsNoTracking().FirstOrDefaultAsync(n => n.notificationId == id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(string id)
    {
        var item = await Visible.FirstOrDefaultAsync(n => n.notificationId == id);
        if (item is null) return NotFound();
        item.isRead = true; await db.SaveChangesAsync(); return NoContent();
    }

    [HttpPut("user/{userId}/read-all")]
    public async Task<IActionResult> MarkAllAsRead(string userId)
    {
        if (Current.role != "ADMIN" && userId != Current.userId) return StatusCode(403);
        var items = await Visible.Where(n => n.userId == userId && !n.isRead).ToListAsync();
        foreach (var item in items) item.isRead = true;
        await db.SaveChangesAsync(); return NoContent();
    }

    [HttpPost]
    public async Task<IActionResult> CreateNotification(NoiDungThongBao request)
    {
        if (Current.role != "ADMIN") return StatusCode(403);
        if (request.userId is null || !Valid(request) || !await db.UserAccounts.AnyAsync(u => u.userId == request.userId))
            return BadRequest("Người nhận hoặc nội dung không hợp lệ.");
        var item = await Make(request.userId, request.title, request.message);
        await db.SaveChangesAsync(); return Ok(item);
    }

    [HttpPost("broadcast")]
    public async Task<IActionResult> Broadcast(NoiDungThongBao request)
    {
        if (Current.role != "ADMIN") return StatusCode(403);
        if (!Valid(request)) return BadRequest("Tiêu đề hoặc nội dung không hợp lệ.");
        var ids = await db.UserAccounts.AsNoTracking().Where(u => u.status == "ACTIVE")
            .Select(u => u.userId).ToListAsync();
        foreach (var id in ids) await Make(id, request.title, request.message);
        await db.SaveChangesAsync(); return Ok(new { sent = ids.Count });
    }

    private async Task<Notification> Make(string userId, string title, string message)
    {
        var item = new Notification
        {
            notificationId = await MaDinhDanh.NextAsync(db, "NOTIFICATION", "notificationId", "N"),
            userId = userId, title = title.Trim(), message = message.Trim(), notificationType = "SYSTEM",
            relatedType = "SYSTEM", isRead = false, createdAt = DateTime.Now
        };
        db.Notifications.Add(item); return item;
    }

    private static bool Valid(NoiDungThongBao request) =>
        !string.IsNullOrWhiteSpace(request.title) && request.title.Length <= 100 &&
        !string.IsNullOrWhiteSpace(request.message) && request.message.Length <= 255;
}
