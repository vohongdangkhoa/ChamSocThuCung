using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity chi tiết cho biết lịch hẹn chọn dịch vụ nào, số lượng và đơn giá.
namespace PetNoVaApi.Models
{
    [Table("BOOKING_DETAIL")]
    /// <summary>Một dòng dịch vụ nằm trong lịch hẹn.</summary>
    public class BookingDetail
    {
        // Khóa chính của dòng chi tiết.
        [Key]
        public string detailId { get; set; } = string.Empty;

        // Số lượng và đơn giá được chốt tại thời điểm đặt lịch.
        public int quantity { get; set; }

        public decimal price { get; set; }

        // Khóa ngoại nối dòng này với lịch hẹn và gói dịch vụ đã chọn.
        public string bookingId { get; set; } = string.Empty;

        public string serviceId { get; set; } = string.Empty;
    }
}
