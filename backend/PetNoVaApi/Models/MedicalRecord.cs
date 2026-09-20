using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity bệnh án do bác sĩ/nhân viên lập cho thú cưng.
namespace PetNoVaApi.Models
{
    [Table("MEDICAL_RECORD")]
    /// <summary>Chẩn đoán, điều trị và ghi chú của một lần khám.</summary>
    public class MedicalRecord
    {
        // Khóa chính của bệnh án.
        [Key]
        public string recordId { get; set; } = string.Empty;

        // Nội dung chuyên môn do bác sĩ ghi lại.
        public string diagnosis { get; set; } = string.Empty;

        public string treatment { get; set; } = string.Empty;

        public DateTime recordDate { get; set; }

        public string? note { get; set; }

        // Khóa ngoại xác định thú cưng được khám và nhân viên lập bệnh án.
        public string petId { get; set; } = string.Empty;

        public string staffId { get; set; } = string.Empty;
    }
}
