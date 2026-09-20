using System.Net;
using System.Net.Mail;

namespace PetNoVaApi.Services;

/// <summary>Hợp đồng gửi OTP, cho phép thay SMTP bằng nhà cung cấp khác.</summary>
public interface IPasswordResetEmailSender
{
    void EnsureConfigured();

    Task SendOtpAsync(
        string recipientEmail,
        string otp,
        int lifetimeMinutes,
        CancellationToken cancellationToken = default
    );
}

/// <summary>Lỗi thiếu hoặc sai địa chỉ/cấu hình máy chủ email.</summary>
public sealed class EmailConfigurationException : Exception
{
    public EmailConfigurationException(string message)
        : base(message)
    {
    }
}

/// <summary>Lỗi SMTP xảy ra trong lúc gửi OTP.</summary>
public sealed class PasswordResetEmailDeliveryException : Exception
{
    public PasswordResetEmailDeliveryException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

/// <summary>Gửi email OTP qua máy chủ SMTP cấu hình trong user-secrets.</summary>
public sealed class SmtpEmailSender : IPasswordResetEmailSender
{
    // Configuration chứa SMTP settings; logger giữ chi tiết kỹ thuật ở backend.
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailSender> _logger;

    /// <summary>Nhận cấu hình và logger qua dependency injection.</summary>
    public SmtpEmailSender(
        IConfiguration configuration,
        ILogger<SmtpEmailSender> logger
    )
    {
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>Kiểm tra host, port, tài khoản và mật khẩu ứng dụng trước khi dùng.</summary>
    public void EnsureConfigured()
    {
        // Đọc trước toàn bộ trường bắt buộc để lỗi cấu hình xuất hiện trước khi tạo OTP.
        var username = RequiredSetting("Email:Username");
        _ = RequiredSetting("Email:Password", secret: true);
        _ = RequiredSetting("Email:SmtpHost");

        // Nếu FromAddress không đặt thì dùng chính username đăng nhập SMTP.
        var fromAddress = _configuration["Email:FromAddress"]?.Trim();
        try
        {
            _ = new MailAddress(
                string.IsNullOrWhiteSpace(fromAddress) ? username : fromAddress
            );
        }
        catch (FormatException exception)
        {
            throw new EmailConfigurationException(
                $"Email gửi OTP không hợp lệ: {exception.Message}"
            );
        }
    }

    /// <summary>Tạo email text/HTML tiếng Việt và gửi bất đồng bộ.</summary>
    public async Task SendOtpAsync(
        string recipientEmail,
        string otp,
        int lifetimeMinutes,
        CancellationToken cancellationToken = default
    )
    {
        // Xác thực cấu hình rồi đọc các giá trị cần cho đúng lần gửi hiện tại.
        EnsureConfigured();
        var host = RequiredSetting("Email:SmtpHost");
        var username = RequiredSetting("Email:Username");
        var password = RequiredSetting("Email:Password", secret: true);
        var fromAddress = _configuration["Email:FromAddress"]?.Trim();
        var fromName = _configuration["Email:FromName"]?.Trim();
        var port = _configuration.GetValue("Email:SmtpPort", 587);
        var enableSsl = _configuration.GetValue("Email:EnableSsl", true);

        // Hai giá trị mặc định giúp cấu hình local ngắn hơn nhưng email vẫn có tên người gửi.
        if (string.IsNullOrWhiteSpace(fromAddress))
        {
            fromAddress = username;
        }

        if (string.IsNullOrWhiteSpace(fromName))
        {
            fromName = "PetNoVa";
        }

        // MailMessage chứa HTML chính và plain text dự phòng cho client không hiển thị HTML.
        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(fromAddress, fromName),
                Subject = "Mã OTP đặt lại mật khẩu PetNoVa",
                Body = BuildHtmlBody(otp, lifetimeMinutes),
                IsBodyHtml = true,
            };
            message.To.Add(new MailAddress(recipientEmail));
            message.AlternateViews.Add(
                AlternateView.CreateAlternateViewFromString(
                    BuildPlainTextBody(otp, lifetimeMinutes),
                    null,
                    "text/plain"
                )
            );

            // SmtpClient dùng TLS, app password và timeout 20 giây; không dùng credential Windows.
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(username, password),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 20_000,
            };

            // CancellationToken giúp request HTTP bị hủy thì việc gửi email cũng dừng theo.
            await client.SendMailAsync(message, cancellationToken);
        }
        catch (Exception exception) when (
            exception is SmtpException
                or InvalidOperationException
                or FormatException
        )
        {
            // Không trả host/password/stack trace cho ứng dụng; chỉ log ở server.
            _logger.LogWarning(
                exception,
                "PetNoVa could not deliver a password reset email."
            );
            throw new PasswordResetEmailDeliveryException(
                "Không thể gửi email OTP lúc này.",
                exception
            );
        }
    }

    /// <summary>Đọc setting bắt buộc; không đưa giá trị secret vào thông báo lỗi.</summary>
    private string RequiredSetting(string key, bool secret = false)
    {
        var value = _configuration[key];

        // Secret được giữ nguyên vì mật khẩu có thể chứa khoảng trắng; field thường được Trim.
        if (!string.IsNullOrWhiteSpace(value))
        {
            return secret ? value : value.Trim();
        }

        throw new EmailConfigurationException(
            $"Thiếu cấu hình {key}. Hãy chạy configure_petnova_password_reset.cmd."
        );
    }

    /// <summary>Tạo nội dung văn bản thuần tương thích mọi ứng dụng email.</summary>
    private static string BuildPlainTextBody(string otp, int lifetimeMinutes)
    {
        return $"""
            Mã OTP đặt lại mật khẩu PetNoVa của bạn là: {otp}

            Mã có hiệu lực trong {lifetimeMinutes} phút và chỉ dùng một lần.
            Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
            Không chia sẻ mã OTP với bất kỳ ai.
            """;
    }

    /// <summary>Tạo email HTML theo tông Playful Orbit, nhấn mạnh OTP và thời hạn.</summary>
    private static string BuildHtmlBody(string otp, int lifetimeMinutes)
    {
        return $$"""
            <!doctype html>
            <html lang="vi">
            <body style="margin:0;background:#111827;font-family:Arial,sans-serif;color:#f9fafb">
              <div style="max-width:520px;margin:0 auto;padding:32px 20px">
                <div style="background:#1f2937;border-radius:24px;padding:28px;border:1px solid #374151">
                  <div style="font-size:26px;font-weight:800;color:#b5ff3d">PetNoVa</div>
                  <h1 style="font-size:22px;margin:24px 0 12px">Đặt lại mật khẩu</h1>
                  <p style="color:#cbd5e1;line-height:1.6">Nhập mã dưới đây trong ứng dụng PetNoVa:</p>
                  <div style="font-size:36px;letter-spacing:10px;font-weight:900;text-align:center;background:#111827;color:#b5ff3d;padding:20px;border-radius:16px;margin:22px 0">{{otp}}</div>
                  <p style="color:#cbd5e1;line-height:1.6">Mã có hiệu lực trong <strong>{{lifetimeMinutes}} phút</strong> và chỉ dùng một lần.</p>
                  <p style="color:#94a3b8;font-size:13px;line-height:1.6">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. PetNoVa không bao giờ yêu cầu bạn gửi lại mã OTP.</p>
                </div>
              </div>
            </body>
            </html>
            """;
    }
}
