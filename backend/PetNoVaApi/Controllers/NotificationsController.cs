using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>REST API hộp thư thông báo của tài khoản.</summary>
    public class NotificationsController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;

        /// <summary>Nhận DbContext để thao tác hộp thư NOTIFICATION.</summary>
        public NotificationsController(PetNoVaDbContext context)
        {
            _context = context;
        }

        [HttpGet("user/{userId}")]
        /// <summary>Lấy thông báo của người dùng, sắp xếp mới nhất trước.</summary>
        /// <param name="userId">Khóa tài khoản nhận thông báo.</param>
        /// <returns>HTTP 200 cùng danh sách; có thể là danh sách rỗng.</returns>
        public async Task<ActionResult<IEnumerable<Notification>>> GetNotificationsByUserId(string userId)
        {
            return await _context.Notifications
                .Where(n => n.userId == userId)
                .OrderByDescending(n => n.createdAt)
                .ToListAsync();
        }

        [HttpGet("{id}")]
        /// <summary>Lấy một thông báo theo khóa chính.</summary>
        /// <param name="id">notificationId trong URL.</param>
        /// <returns>HTTP 200 hoặc 404 khi không tìm thấy.</returns>
        public async Task<ActionResult<Notification>> GetNotification(string id)
        {
            var notification = await _context.Notifications.FindAsync(id);

            if (notification == null)
            {
                return NotFound("Không tìm thấy thông báo.");
            }

            return notification;
        }

        [HttpPost]
        /// <summary>Tạo thông báo nghiệp vụ mới.</summary>
        /// <param name="notification">Nội dung, loại, liên kết và userId nhận từ nghiệp vụ gọi.</param>
        /// <returns>HTTP 201 cùng thông báo đã gán mã và thời điểm server.</returns>
        public async Task<ActionResult<Notification>> CreateNotification(Notification notification)
        {
            var count = await _context.Notifications.CountAsync();

            // Backend sở hữu mã, trạng thái chưa đọc và thời điểm tạo.
            notification.notificationId = "N" + (count + 1).ToString("D3");
            notification.isRead = false;
            notification.createdAt = DateTime.Now;

            // Chuẩn hóa type để khớp CHECK constraint và cách Flutter phân loại thông báo.
            notification.notificationType = notification.notificationType.Trim().ToUpper();

            if (!string.IsNullOrWhiteSpace(notification.relatedType))
            {
                notification.relatedType = notification.relatedType.Trim().ToUpper();
            }

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetNotification),
                new { id = notification.notificationId },
                notification
            );
        }

        [HttpPut("{id}/read")]
        /// <summary>Đánh dấu một thông báo đã đọc.</summary>
        /// <param name="id">Mã thông báo cần cập nhật.</param>
        /// <returns>204 khi thành công hoặc 404 nếu mã không tồn tại.</returns>
        public async Task<IActionResult> MarkAsRead(string id)
        {
            var notification = await _context.Notifications.FindAsync(id);

            if (notification == null)
            {
                return NotFound("Không tìm thấy thông báo.");
            }

            notification.isRead = true;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPut("user/{userId}/read-all")]
        /// <summary>Đánh dấu toàn bộ thông báo của tài khoản đã đọc.</summary>
        /// <param name="userId">Tài khoản cần dọn số lượng chưa đọc.</param>
        /// <returns>Luôn trả 204 sau khi lưu, kể cả khi không có bản ghi cần đổi.</returns>
        public async Task<IActionResult> MarkAllAsRead(string userId)
        {
            // Chỉ tải bản ghi chưa đọc để giảm số entity EF phải theo dõi/cập nhật.
            var notifications = await _context.Notifications
                .Where(n => n.userId == userId && !n.isRead)
                .ToListAsync();

            // Các entity đang được theo dõi; đổi thuộc tính là đủ để SaveChanges tạo UPDATE.
            foreach (var notification in notifications)
            {
                notification.isRead = true;
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
