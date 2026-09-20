using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity lịch sử tiêm chủng và ngày hẹn mũi tiếp theo.
namespace PetNoVaApi.Models
{
    [Table("VACCINATION")]
    /// <summary>Mũi tiêm của một thú cưng do một nhân viên thực hiện.</summary>
    public class Vaccination
    {
        // Khóa chính của lần tiêm.
        [Key]
        public string vaccinationId { get; set; } = string.Empty;

        // Tên vaccine, ngày đã tiêm và ngày dự kiến tiêm nhắc lại.
        public string vaccineName { get; set; } = string.Empty;

        public DateTime vaccinationDate { get; set; }

        public DateTime nextDate { get; set; }

        public string? note { get; set; }

        // Khóa ngoại của thú cưng được tiêm và nhân viên thực hiện.
        public string petId { get; set; } = string.Empty;

        public string staffId { get; set; } = string.Empty;
    }
}
