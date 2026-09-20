using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity gói dịch vụ mà khách chọn khi đặt lịch.
namespace PetNoVaApi.Models
{
    [Table("SERVICE_PACKAGE")]
    /// <summary>Dịch vụ gồm mô tả, giá, thời lượng, trạng thái và danh mục.</summary>
    public class ServicePackage
    {
        // Khóa chính của gói dịch vụ.
        [Key]
        public string serviceId { get; set; } = string.Empty;

        // Nội dung giới thiệu hiển thị cho khách hàng.
        public string serviceName { get; set; } = string.Empty;

        public string description { get; set; } = string.Empty;

        // Giá tiền và thời lượng dự kiến theo phút.
        public decimal price { get; set; }

        public int duration { get; set; }

        // ACTIVE/INACTIVE quyết định gói có còn được chọn; categoryId dùng để phân nhóm.
        public string status { get; set; } = string.Empty;

        public string categoryId { get; set; } = string.Empty;
    }
}
