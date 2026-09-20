using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity giao dịch thanh toán gắn với một lịch hẹn.
namespace PetNoVaApi.Models
{
    [Table("PAYMENT")]
    /// <summary>Lưu phương thức, số tiền, trạng thái và ngày thanh toán.</summary>
    public class Payment
    {
        // Khóa chính của giao dịch.
        [Key]
        public string paymentId { get; set; } = string.Empty;

        // Phương thức (CASH/BANK_TRANSFER), số tiền và trạng thái xử lý.
        public string method { get; set; } = string.Empty;

        public decimal amount { get; set; }

        public string status { get; set; } = string.Empty;

        public DateTime? paymentDate { get; set; }

        // Khóa ngoại nối giao dịch với lịch hẹn cần thanh toán.
        public string bookingId { get; set; } = string.Empty;

    }
}
