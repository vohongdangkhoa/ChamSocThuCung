using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>REST API quản lý vòng đời lịch hẹn và thông báo liên quan.</summary>
    public class BookingsController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;

        /// <summary>Nhận DbContext qua dependency injection để đọc/ghi lịch hẹn.</summary>
        public BookingsController(PetNoVaDbContext context)
        {
            _context = context;
        }


        [HttpGet]
        /// <summary>Lấy toàn bộ lịch hẹn.</summary>
        /// <returns>HTTP 200 cùng danh sách Booking lấy từ bảng BOOKING.</returns>
        public async Task<ActionResult<IEnumerable<Booking>>> GetBookings()
        {
            return await _context.Bookings.ToListAsync();
        }

        [HttpGet("{id}")]
        /// <summary>Lấy một lịch hẹn theo mã.</summary>
        /// <param name="id">bookingId nhận từ URL.</param>
        /// <returns>HTTP 200 kèm lịch hẹn, hoặc 404 khi khóa không tồn tại.</returns>
        public async Task<ActionResult<Booking>> GetBooking(string id)
        {
            // FindAsync ưu tiên entity đã được EF theo dõi rồi mới truy vấn theo khóa chính.
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null)
            {
                return NotFound();
            }

            return booking;
        }

        [HttpPost]
        /// <summary>Kiểm tra dữ liệu, sinh mã, lưu lịch và tạo thông báo xác nhận.</summary>
        /// <param name="booking">Dữ liệu lịch do Flutter gửi; server sẽ tự đặt mã, trạng thái và ngày tạo.</param>
        /// <returns>HTTP 201 cùng Booking vừa tạo và URL truy vấn lại bản ghi.</returns>
        public async Task<ActionResult<Booking>> CreateBooking(Booking booking)
        {
            // Server sở hữu các trường hệ thống để client không thể tự xác nhận hay tự gán nhân viên.
            var count = await _context.Bookings.CountAsync();

            booking.bookingId = "B" + (count + 1).ToString("D3");
            booking.staffId = null;
            booking.status = "PENDING";
            booking.createdAt = DateTime.Now;

            // Add mới chỉ đưa entity vào change tracker; SaveChanges bên dưới mới ghi SQL.
            _context.Bookings.Add(booking);

            // Xếp thông báo vào cùng DbContext để lịch và thông báo được lưu trong một lần SaveChanges.
            await CreateBookingNotification(
                booking.userId,
                "Đặt lịch thành công",
                "Lịch hẹn của bạn đã được tạo và đang chờ nhân viên xác nhận.",
                booking.bookingId
            );

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBooking), new { id = booking.bookingId }, booking);
        }

        [HttpPut("{id}/cancel")]
        /// <summary>Hủy lịch khi lịch còn PENDING hoặc CONFIRMED.</summary>
        /// <param name="id">Mã lịch cần hủy.</param>
        /// <returns>204 khi thành công; 404 nếu không có lịch; 400 nếu trạng thái không cho phép hủy.</returns>
        public async Task<IActionResult> CancelBooking(string id)
        {
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null)
            {
                return NotFound();
            }

            // Chuẩn hóa chữ hoa để so sánh không phụ thuộc cách client/database ghi trạng thái.
            var currentStatus = booking.status.ToUpper();

            // Lịch đang làm, đã hoàn thành hoặc đã hủy là trạng thái không thể quay lại CANCELLED.
            if (currentStatus != "PENDING" && currentStatus != "CONFIRMED")
            {
                return BadRequest("Chỉ có thể hủy lịch khi lịch đang chờ xác nhận hoặc đã xác nhận.");
            }

            booking.status = "CANCELLED";

            // Báo cho chính chủ lịch biết thao tác hủy đã được hệ thống ghi nhận.
            await CreateBookingNotification(
                booking.userId,
                "Lịch hẹn đã được hủy",
                "Lịch hẹn của bạn đã được hủy thành công.",
                booking.bookingId
            );

            await _context.SaveChangesAsync();

            return NoContent();
        }
        [HttpDelete("{id}")]
        /// <summary>Xóa lịch cùng dữ liệu phụ thuộc theo quy tắc hiện tại.</summary>
        /// <param name="id">Mã lịch hẹn cần xóa vĩnh viễn.</param>
        /// <returns>204 sau khi xóa, hoặc 404 nếu lịch không tồn tại.</returns>
        public async Task<IActionResult> DeleteBooking(string id)
        {
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null)
            {
                return NotFound();
            }

            // Tải các bản ghi con để tránh vi phạm khóa ngoại khi xóa BOOKING trước.
            var payments = await _context.Payments
                .Where(payment => payment.bookingId == id)
                .ToListAsync();
            var bookingDetails = await _context.BookingDetails
                .Where(detail => detail.bookingId == id)
                .ToListAsync();

            // Xóa PAYMENT và BOOKING_DETAIL trước rồi mới xóa bản ghi cha BOOKING.
            _context.Payments.RemoveRange(payments);
            _context.BookingDetails.RemoveRange(bookingDetails);
            await _context.SaveChangesAsync();

            _context.Bookings.Remove(booking);
            await _context.SaveChangesAsync();

            return NoContent();
        }
        [HttpPut("{id}/status")]
        /// <summary>Chuyển trạng thái theo luồng cho phép và tạo thông báo cho khách.</summary>
        /// <param name="id">Mã lịch cần chuyển trạng thái.</param>
        /// <param name="request">DTO chỉ chứa trạng thái đích do nhân viên gửi.</param>
        /// <returns>204 khi thành công; 400 với chuyển đổi sai/chưa trả tiền; 404 nếu không có lịch.</returns>
        public async Task<IActionResult> UpdateBookingStatus(string id, [FromBody] UpdateBookingStatusRequest request)
        {
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null)
            {
                return NotFound("Không tìm thấy lịch hẹn.");
            }

            // Chặn body rỗng trước khi gọi Trim để tránh lỗi null và trạng thái vô nghĩa.
            if (request == null || string.IsNullOrWhiteSpace(request.Status))
            {
                return BadRequest("Trạng thái mới không hợp lệ.");
            }

            var currentStatus = booking.status.Trim().ToUpper();
            var newStatus = request.Status.Trim().ToUpper();

            // CANCELLED và COMPLETED là hai trạng thái kết thúc, không được chuyển tiếp.
            if (currentStatus == "CANCELLED")
            {
                return BadRequest("Lịch hẹn đã hủy, không thể cập nhật trạng thái.");
            }

            if (currentStatus == "COMPLETED")
            {
                return BadRequest("Lịch hẹn đã hoàn thành, không thể cập nhật trạng thái.");
            }

            // State machine chỉ cho đi từng bước, không cho client bỏ qua khâu xác nhận/thực hiện.
            var isValidFlow =
                (currentStatus == "PENDING" && newStatus == "CONFIRMED") ||
                (currentStatus == "CONFIRMED" && newStatus == "IN_PROGRESS") ||
                (currentStatus == "IN_PROGRESS" && newStatus == "COMPLETED");

            if (!isValidFlow)
            {
                return BadRequest($"Không thể chuyển trạng thái từ {currentStatus} sang {newStatus}.");
            }

            // Quy tắc nghiệp vụ: chỉ hoàn tất dịch vụ sau khi tồn tại giao dịch PAID của lịch.
            if (currentStatus == "IN_PROGRESS" && newStatus == "COMPLETED")
            {
                var serviceIsPaid = await _context.Payments.AnyAsync(payment =>
                    payment.bookingId == id && payment.status == "PAID");

                if (!serviceIsPaid)
                {
                    return BadRequest("Không thể hoàn thành dịch vụ khi khách hàng chưa thanh toán.");
                }
            }

            booking.status = newStatus;

            // Biến trạng thái kỹ thuật thành nội dung tiếng Việt thân thiện cho khách.
            var title = "";
            var message = "";

            if (newStatus == "CONFIRMED")
            {
                title = "Lịch hẹn đã được xác nhận";
                message = "Nhân viên PetNoVa đã xác nhận lịch hẹn của bạn.";
            }
            else if (newStatus == "IN_PROGRESS")
            {
                title = "Dịch vụ đang được thực hiện";
                message = "Thú cưng của bạn đang được PetNoVa chăm sóc.";
            }
            else if (newStatus == "COMPLETED")
            {
                title = "Dịch vụ đã hoàn thành";
                message = "Dịch vụ chăm sóc thú cưng của bạn đã hoàn thành.";
            }

            // Chỉ tạo notification khi trạng thái đích có thông điệp tương ứng.
            if (!string.IsNullOrWhiteSpace(title))
            {
                await CreateBookingNotification(
                    booking.userId,
                    title,
                    message,
                    booking.bookingId
                );
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }
        [HttpGet("user/{userId}")]
        /// <summary>Lấy lịch hẹn của riêng một khách hàng.</summary>
        /// <param name="userId">Khóa tài khoản chủ lịch.</param>
        /// <returns>HTTP 200 với danh sách được sắp từ lịch tạo mới nhất.</returns>
        public async Task<ActionResult<IEnumerable<Booking>>> GetBookingsByUserId(string userId)
        {
            return await _context.Bookings
                .Where(b => b.userId == userId)
                .OrderByDescending(b => b.createdAt)
                .ToListAsync();
        }

        /// <summary>Tạo thông báo đi kèm thay đổi lịch hẹn trong cùng DbContext.</summary>
        /// <remarks>Hàm chỉ Add vào change tracker; action gọi nó chịu trách nhiệm SaveChanges.</remarks>
        private async Task CreateBookingNotification(
            string userId,
            string title,
            string message,
            string bookingId
        )
        {
            // Mã Nxxx được sinh phía server rồi gắn liên kết BOOKING để Flutter mở đúng lịch.
            var count = await _context.Notifications.CountAsync();

            var notification = new Notification
            {
                notificationId = "N" + (count + 1).ToString("D3"),
                title = title,
                message = message,
                notificationType = "BOOKING",
                isRead = false,
                createdAt = DateTime.Now,
                relatedId = bookingId,
                relatedType = "BOOKING",
                userId = userId
            };

            _context.Notifications.Add(notification);
        }
    }
    /// <summary>DTO chỉ nhận trạng thái mới, không cho client sửa toàn bộ Booking.</summary>
    public class UpdateBookingStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }
}
