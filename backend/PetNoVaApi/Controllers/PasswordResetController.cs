using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers;

[ApiController]
[Route("api/auth/password-reset")]
[EnableRateLimiting("password-reset")]
/// <summary>Ba endpoint OTP đặt lại mật khẩu, có rate limit và kiểm tra HTTPS.</summary>
public sealed class PasswordResetController : ControllerBase
{
    private readonly IPasswordResetService _passwordResetService;
    private readonly ILogger<PasswordResetController> _logger;

    /// <summary>Nhận service chứa nghiệp vụ OTP và logger để che lỗi hạ tầng khỏi client.</summary>
    public PasswordResetController(
        IPasswordResetService passwordResetService,
        ILogger<PasswordResetController> logger
    )
    {
        _passwordResetService = passwordResetService;
        _logger = logger;
    }

    [HttpPost("request")]
    /// <summary>Nhận số điện thoại và yêu cầu service gửi OTP đến email đã liên kết.</summary>
    /// <param name="request">DTO chứa số điện thoại khách hàng.</param>
    /// <returns>202 với challenge/email che; 400 đầu vào sai; 426 HTTP từ xa; 503 dịch vụ chưa sẵn sàng.</returns>
    public async Task<IActionResult> RequestOtp(
        RequestPasswordResetDto request,
        CancellationToken cancellationToken
    )
    {
        // OTP/reset token là dữ liệu nhạy cảm: chỉ HTTPS hoặc ADB loopback cục bộ được phép.
        var transportError = RejectInsecureRemoteRequest();
        if (transportError is not null)
        {
            return transportError;
        }

        try
        {
            // Service chuẩn hóa số, tìm tài khoản, tạo hash OTP và gửi email; controller chỉ đổi thành HTTP.
            var result = await _passwordResetService.RequestOtpAsync(
                request.Phone,
                cancellationToken
            );

            // Không trả OTP/email đầy đủ; client chỉ nhận challengeId và email đã che để hướng dẫn người dùng.
            return Accepted(new
            {
                challengeId = result.ChallengeId,
                maskedEmail = result.MaskedEmail,
                expiresInSeconds = result.ExpiresInSeconds,
                resendAfterSeconds = result.ResendAfterSeconds,
                message = "Nếu số điện thoại khớp với tài khoản khách hàng, OTP đã được gửi tới email liên kết.",
            });
        }
        catch (PasswordResetValidationException exception)
        {
            // Lỗi người dùng có thể sửa (số sai, cooldown...) được trả 400 với thông báo cụ thể.
            return BadRequest(new { message = exception.Message });
        }
        catch (Exception exception) when (
            exception is PasswordResetConfigurationException
                or EmailConfigurationException
                or PasswordResetEmailDeliveryException
                or FirebaseAdminConfigurationException
                or FirebasePasswordUpdateException
        )
        {
            // Lỗi cấu hình/email/Firebase được log nội bộ nhưng client chỉ nhận thông báo an toàn.
            _logger.LogWarning(exception, "Password reset email request is unavailable.");
            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new
                {
                    message = "Dịch vụ gửi OTP chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ PetNoVa.",
                }
            );
        }
    }

    [HttpPost("verify")]
    /// <summary>Xác minh OTP rồi trả reset token dùng một lần.</summary>
    /// <param name="request">challengeId và mã OTP người dùng nhập.</param>
    /// <returns>200 với reset token ngắn hạn; 400 nếu sai/hết hạn; 426 nếu kết nối không an toàn.</returns>
    public async Task<IActionResult> VerifyOtp(
        VerifyPasswordResetOtpDto request,
        CancellationToken cancellationToken
    )
    {
        var transportError = RejectInsecureRemoteRequest();
        if (transportError is not null)
        {
            return transportError;
        }

        try
        {
            // OTP được service băm rồi so sánh constant-time với hash trong SQL, không so chuỗi rõ.
            var result = await _passwordResetService.VerifyOtpAsync(
                request.ChallengeId,
                request.Otp.Trim(),
                cancellationToken
            );

            return Ok(new
            {
                challengeId = result.ChallengeId,
                resetToken = result.ResetToken,
                expiresInSeconds = result.ExpiresInSeconds,
            });
        }
        catch (PasswordResetValidationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("complete")]
    /// <summary>Đổi mật khẩu Firebase khi reset token còn hợp lệ.</summary>
    /// <param name="request">challengeId, reset token một lần và mật khẩu mới.</param>
    /// <returns>204 khi đổi xong; 400 token/mật khẩu sai; 426 HTTP từ xa; 503 Firebase lỗi.</returns>
    public async Task<IActionResult> Complete(
        CompletePasswordResetDto request,
        CancellationToken cancellationToken
    )
    {
        var transportError = RejectInsecureRemoteRequest();
        if (transportError is not null)
        {
            return transportError;
        }

        try
        {
            // Service xác minh reset token, cập nhật Firebase rồi đánh dấu challenge consumed để chống dùng lại.
            await _passwordResetService.CompleteAsync(
                request.ChallengeId,
                request.ResetToken,
                request.NewPassword,
                cancellationToken
            );

            return NoContent();
        }
        catch (PasswordResetValidationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (Exception exception) when (
            exception is FirebaseAdminConfigurationException
                or FirebasePasswordUpdateException
        )
        {
            _logger.LogWarning(exception, "Password reset could not update Firebase.");
            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new
                {
                    message = "Chưa thể cập nhật mật khẩu Firebase. Vui lòng quay lại và xin mã OTP mới.",
                }
            );
        }
    }

    /// <summary>Cho phép HTTP loopback lúc phát triển nhưng bắt buộc HTTPS khi triển khai xa.</summary>
    /// <returns>null nếu an toàn; HTTP 426 khi request HTTP đến từ địa chỉ không phải loopback.</returns>
    private IActionResult? RejectInsecureRemoteRequest()
    {
        // ADB reverse làm điện thoại xuất hiện như loopback, phù hợp dev mà không mở HTTP ra Wi-Fi.
        var remoteAddress = HttpContext.Connection.RemoteIpAddress;
        if (
            Request.IsHttps
            || (remoteAddress is not null && IPAddress.IsLoopback(remoteAddress))
        )
        {
            return null;
        }

        return StatusCode(
            StatusCodes.Status426UpgradeRequired,
            new
            {
                message = "Đặt lại mật khẩu yêu cầu HTTPS. HTTP chỉ được dùng qua USB loopback khi phát triển.",
            }
        );
    }
}

/// <summary>DTO bước yêu cầu OTP.</summary>
public sealed class RequestPasswordResetDto
{
    // Số có thể ở dạng 0xxxxxxxxx; service sẽ chuẩn hóa về +84.
    public string Phone { get; set; } = string.Empty;
}

/// <summary>DTO bước xác minh challenge và OTP.</summary>
public sealed class VerifyPasswordResetOtpDto
{
    // ChallengeId nối request này với đúng OTP hash trong PASSWORD_RESET_CHALLENGE.
    public Guid ChallengeId { get; set; }

    public string Otp { get; set; } = string.Empty;
}

/// <summary>DTO bước hoàn tất bằng reset token và mật khẩu mới.</summary>
public sealed class CompletePasswordResetDto
{
    // Cả challengeId và reset token đều cần đúng; token chỉ dùng được một lần.
    public Guid ChallengeId { get; set; }

    public string ResetToken { get; set; } = string.Empty;

    // Mật khẩu rõ chỉ tồn tại trong request và được gửi sang Firebase Admin, không lưu PetNoVaDB.
    public string NewPassword { get; set; } = string.Empty;
}
