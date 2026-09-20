using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

// Entity bảo mật lưu challenge OTP dưới dạng hash, có thời hạn và số lần thử.
namespace PetNoVaApi.Models;

[Table("PASSWORD_RESET_CHALLENGE")]
[Index(nameof(userId), nameof(createdAt))]
/// <summary>Trạng thái phía server của một yêu cầu đặt lại mật khẩu.</summary>
public sealed class PasswordResetChallenge
{
    // Khóa challenge mà client phải gửi lại ở bước xác minh và hoàn tất.
    [Key]
    public Guid challengeId { get; set; }

    [MaxLength(50)]
    public string userId { get; set; } = string.Empty;

    [MaxLength(128)]
    public string firebaseUid { get; set; } = string.Empty;

    [MaxLength(320)]
    public string email { get; set; } = string.Empty;

    [MaxLength(20)]
    public string normalizedPhone { get; set; } = string.Empty;

    // Không lưu OTP dạng rõ; chỉ lưu hash để so sánh khi người dùng xác minh.
    [MaxLength(32)]
    public byte[] otpHash { get; set; } = [];

    // Giới hạn thời gian dùng OTP, số lần đoán và thời điểm được phép gửi lại.
    public DateTime expiresAt { get; set; }

    // Đếm số lần nhập sai để khóa challenge chống dò mã.
    public int attemptCount { get; set; }

    public DateTime resendAvailableAt { get; set; }

    // Sau khi OTP đúng, server ghi thời điểm xác minh và phát reset token dạng hash.
    public DateTime? verifiedAt { get; set; }

    [MaxLength(32)]
    public byte[]? resetTokenHash { get; set; }

    public DateTime? resetTokenExpiresAt { get; set; }

    // consumedAt khác null nghĩa là challenge đã đổi mật khẩu xong và không thể dùng lại.
    public DateTime? consumedAt { get; set; }

    public DateTime createdAt { get; set; }

    // RowVersion hỗ trợ optimistic concurrency, tránh hai request đồng thời cùng tiêu thụ OTP.
    [Timestamp]
    public byte[] rowVersion { get; set; } = [];
}
