using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

// Entity hồ sơ ứng dụng liên kết với tài khoản Firebase Authentication.
namespace PetNoVaApi.Models
{
    [Table("USER_ACCOUNT")]
    /// <summary>Tài khoản trung tâm dùng cho phân quyền và hồ sơ PetNoVa.</summary>
    public class UserAccount
    {
        // userId là khóa SQL; firebaseUid nối hồ sơ này với Firebase Authentication.
        [Key]
        public string userId { get; set; } = string.Empty;

        public string firebaseUid { get; set; } = string.Empty;

        // Thông tin cá nhân và liên hệ do người dùng cung cấp.
        public string fullName { get; set; } = string.Empty;

        public string email { get; set; } = string.Empty;

        public string phone { get; set; } = string.Empty;

        // Bản +84 chuẩn hóa để tìm quên mật khẩu và bảo đảm một số chỉ thuộc một tài khoản.
        [MaxLength(20)]
        public string? normalizedPhone { get; set; }

        // role điều khiển màn hình/quyền; status cho phép khóa tài khoản mà không xóa dữ liệu.
        public string role { get; set; } = string.Empty;

        public string status { get; set; } = string.Empty;

        // Token thiết bị dành cho push notification.
        public string fcmToken { get; set; } = string.Empty;

        // URL hiển thị avatar và publicId để backend quản lý tài nguyên Cloudinary.
        [MaxLength(2048)]
        public string? avatarUrl { get; set; }

        [MaxLength(512)]
        public string? avatarPublicId { get; set; }

        // Mốc tạo hồ sơ trong PetNoVaDB.
        public DateTime? createdAt { get; set; }
    }
}
