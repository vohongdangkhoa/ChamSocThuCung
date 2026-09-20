using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity thông báo nghiệp vụ gửi đến người dùng.
namespace PetNoVaApi.Models
{
    [Table("NOTIFICATION")]
    /// <summary>Thông báo có trạng thái đọc và tham chiếu đối tượng liên quan.</summary>
    public class Notification
    {
        // Khóa chính và nội dung hiển thị cho người dùng.
        [Key]
        public string notificationId { get; set; } = string.Empty;

        public string title { get; set; } = string.Empty;

        public string message { get; set; } = string.Empty;

        // Loại thông báo giúp Flutter chọn icon/cách điều hướng; isRead điều khiển dấu chưa đọc.
        public string notificationType { get; set; } = string.Empty;

        public bool isRead { get; set; }

        public DateTime createdAt { get; set; }

        // Tham chiếu tùy chọn tới nghiệp vụ nguồn, ví dụ relatedType=BOOKING và relatedId=B001.
        public string? relatedId { get; set; }

        public string? relatedType { get; set; }

        // Tài khoản nhận thông báo.
        public string userId { get; set; } = string.Empty;
    }
}
