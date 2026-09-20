using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity ánh xạ bảng Booking: lịch sử và trạng thái một lịch hẹn.
namespace PetNoVaApi.Models
{
    [Table("BOOKING")]
    /// <summary>Lịch hẹn nối khách hàng, thú cưng, nhân viên và loại chăm sóc.</summary>
    public class Booking
    {
        // Khóa chính và thời điểm khách chọn để sử dụng dịch vụ.
        [Key]
        public string bookingId { get; set; } = string.Empty;

        public DateTime bookingDate { get; set; }

        public TimeSpan bookingTime { get; set; }

        // Thông tin tính tiền và trạng thái vòng đời: PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED.
        public decimal totalAmount { get; set; }

        public string status { get; set; } = string.Empty;

        public string? note { get; set; }

        // Các khóa liên kết đến khách hàng, thú cưng, nhân viên phụ trách và loại chăm sóc.
        public string userId { get; set; } = string.Empty;

        public string petId { get; set; } = string.Empty;

        public string? staffId { get; set; }

        public string careTypeId { get; set; } = string.Empty;

        // Mốc hệ thống tạo lịch, dùng để sắp xếp lịch mới nhất.
        public DateTime createdAt { get; set; }
    }
}
