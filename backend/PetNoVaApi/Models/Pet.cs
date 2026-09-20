using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity hồ sơ thú cưng thuộc một khách hàng.
namespace PetNoVaApi.Models
{
    [Table("PET")]
    /// <summary>Thông tin nhận dạng, sức khỏe và ảnh Cloudinary của thú cưng.</summary>
    public class Pet
    {
        // Khóa chính của thú cưng và khóa chủ sở hữu.
        [Key]
        public string petId { get; set; } = string.Empty;

        public string userId { get; set; } = string.Empty;

        // Nhóm thông tin nhận dạng cơ bản hiển thị trong hồ sơ.
        public string petName { get; set; } = string.Empty;

        public string species { get; set; } = string.Empty;

        public string breed { get; set; } = string.Empty;

        public string gender { get; set; } = string.Empty;

        // Nhóm dữ liệu sức khỏe dùng cho lịch khám và theo dõi cân nặng.
        public DateTime birthDate { get; set; }

        public decimal weight { get; set; }

        public string healthStatus { get; set; } = string.Empty;

        // URL dùng để hiển thị ảnh; publicId dùng để thay thế/xóa đúng tài nguyên trên Cloudinary.
        [MaxLength(2048)]
        public string? imageUrl { get; set; }

        [MaxLength(512)]
        public string? imagePublicId { get; set; }
    }
}
