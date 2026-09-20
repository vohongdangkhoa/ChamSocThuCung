using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity hồ sơ nhân viên/bác sĩ liên kết với UserAccount đăng nhập.
namespace PetNoVaApi.Models
{
    [Table("STAFF")]
    /// <summary>Thông tin nhân sự, vai trò, vi phạm và trạng thái hoạt động.</summary>
    public class Staff
    {
        // Khóa hồ sơ nhân sự.
        [Key]
        public string staffId { get; set; } = string.Empty;

        // Thông tin liên hệ hiển thị trong trang quản trị.
        public string fullName { get; set; } = string.Empty;

        public string phone { get; set; } = string.Empty;

        public string email { get; set; } = string.Empty;

        // role phân biệt STAFF/VET; đủ ba vi phạm có thể chuyển trạng thái SUSPENDED.
        public string role { get; set; } = string.Empty;

        public int violationCount { get; set; }

        public string status { get; set; } = string.Empty;

        // Khóa ngoại tới UserAccount dùng để nhân viên đăng nhập Firebase.
        public string userId { get; set; } = string.Empty;
    }
}
