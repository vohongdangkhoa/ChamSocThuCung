using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>REST API quản lý các dòng dịch vụ thuộc lịch hẹn.</summary>
    public class BookingDetailsController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;

        /// <summary>Nhận DbContext để thao tác bảng BOOKING_DETAIL.</summary>
        public BookingDetailsController(PetNoVaDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        /// <summary>Lấy toàn bộ chi tiết lịch hẹn.</summary>
        /// <returns>HTTP 200 cùng mọi dòng dịch vụ trong BOOKING_DETAIL.</returns>
        public async Task<ActionResult<IEnumerable<BookingDetail>>> GetBookingDetails()
        {
            return await _context.BookingDetails.ToListAsync();
        }

        [HttpGet("booking/{bookingId}")]
        /// <summary>Lọc các dòng dịch vụ theo mã lịch hẹn.</summary>
        /// <param name="bookingId">Khóa lịch cha dùng trong điều kiện WHERE.</param>
        /// <returns>HTTP 200; danh sách rỗng nếu lịch chưa có chi tiết.</returns>
        public async Task<ActionResult<IEnumerable<BookingDetail>>> GetBookingDetailsByBooking(string bookingId)
        {
            // Where được dịch thành SQL, nên chỉ các dòng thuộc lịch được tải về API.
            return await _context.BookingDetails
                .Where(detail => detail.bookingId == bookingId)
                .ToListAsync();
        }

        [HttpPost]
        /// <summary>Sinh mã, lưu chi tiết dịch vụ và trả HTTP 201.</summary>
        /// <param name="detail">Dòng gồm bookingId, serviceId, số lượng và đơn giá.</param>
        /// <returns>HTTP 201 với chi tiết vừa ghi và route xem chi tiết theo lịch.</returns>
        public async Task<ActionResult<BookingDetail>> CreateBookingDetail(BookingDetail detail)
        {
            // Mã BDxxx được backend tạo để client không phải biết quy tắc khóa chính.
            var count = await _context.BookingDetails.CountAsync();

            detail.detailId = "BD" + (count + 1).ToString("D3");

            _context.BookingDetails.Add(detail);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetBookingDetailsByBooking),
                new { bookingId = detail.bookingId },
                detail
            );
        }
    }
}
