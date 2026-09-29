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

        [MaxLength(2000)]
        public string? prescription { get; set; }

        public DateTime? followUpDate { get; set; }

        [Column(TypeName = "decimal(6,2)")]
        public decimal? weight { get; set; }

        // Khóa ngoại xác định thú cưng được khám và nhân viên lập bệnh án.
        public string petId { get; set; } = string.Empty;

        public string staffId { get; set; } = string.Empty;
    }

    [Table("PETNOVA_CLINICAL_REVISION")]
    public class LichSuHoSo
    {
        [Key] public long id { get; set; }
        [MaxLength(32)] public string entityType { get; set; } = string.Empty;
        [MaxLength(32)] public string entityId { get; set; } = string.Empty;
        public string oldData { get; set; } = string.Empty;
        [MaxLength(500)] public string reason { get; set; } = string.Empty;
        [MaxLength(32)] public string userId { get; set; } = string.Empty;
        public DateTime createdAt { get; set; }
    }
}
