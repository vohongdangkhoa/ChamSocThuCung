using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;

namespace PetNoVaApi.Services;

/// <summary>Hợp đồng kiểm tra danh tính và đổi mật khẩu qua Firebase Admin.</summary>
public interface IFirebasePasswordManager
{
    void EnsureConfigured();

    Task<bool> IdentityMatchesAsync(
        string firebaseUid,
        string email,
        CancellationToken cancellationToken = default
    );

    Task UpdatePasswordAsync(
        string firebaseUid,
        string newPassword,
        CancellationToken cancellationToken = default
    );
}

/// <summary>Lỗi khởi tạo Firebase Admin do thiếu/sai service-account.</summary>
public sealed class FirebaseAdminConfigurationException : Exception
{
    public FirebaseAdminConfigurationException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}

/// <summary>Lỗi Firebase từ chối xác minh hoặc đổi mật khẩu.</summary>
public sealed class FirebasePasswordUpdateException : Exception
{
    public FirebasePasswordUpdateException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

/// <summary>Dùng Firebase Admin SDK; API secret/service account chỉ nằm ở backend.</summary>
public sealed class FirebasePasswordManager : IFirebasePasswordManager
{
    // Tên riêng tránh xung đột với FirebaseApp.DefaultInstance của phần khác.
    private const string AppName = "petnova-password-reset";

    // Lazy bảo đảm credential chỉ được đọc và FirebaseApp chỉ tạo đúng một lần, thread-safe.
    private readonly IConfiguration _configuration;
    private readonly ILogger<FirebasePasswordManager> _logger;
    private readonly Lazy<FirebaseAuth> _firebaseAuth;

    /// <summary>Lưu dependency và chuẩn bị bộ khởi tạo FirebaseAuth trì hoãn.</summary>
    public FirebasePasswordManager(
        IConfiguration configuration,
        ILogger<FirebasePasswordManager> logger
    )
    {
        _configuration = configuration;
        _logger = logger;
        _firebaseAuth = new Lazy<FirebaseAuth>(
            CreateFirebaseAuth,
            LazyThreadSafetyMode.ExecutionAndPublication
        );
    }

    /// <summary>Khởi tạo FirebaseApp một lần và báo rõ nếu thiếu service account.</summary>
    public void EnsureConfigured()
    {
        _ = _firebaseAuth.Value;
    }

    /// <summary>Đảm bảo UID/email SQL thật sự trùng tài khoản Firebase trước reset.</summary>
    public async Task<bool> IdentityMatchesAsync(
        string firebaseUid,
        string email,
        CancellationToken cancellationToken = default
    )
    {
        // Không gọi Firebase nếu hồ sơ SQL chưa có đủ hai định danh bắt buộc.
        if (string.IsNullOrWhiteSpace(firebaseUid) || string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        try
        {
            // UID xác định tài khoản; email được so sánh không phân biệt hoa thường để chống nối nhầm.
            var user = await _firebaseAuth.Value.GetUserAsync(
                firebaseUid.Trim(),
                cancellationToken
            );
            return string.Equals(
                user.Email?.Trim(),
                email.Trim(),
                StringComparison.OrdinalIgnoreCase
            );
        }
        catch (FirebaseAdminConfigurationException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is FirebaseAuthException
                or InvalidOperationException
                or ArgumentException
        )
        {
            // Log chi tiết ở server nhưng chỉ trả thông báo an toàn cho client.
            _logger.LogWarning(
                exception,
                "Firebase could not validate a PetNoVa recovery identity."
            );
            throw new FirebasePasswordUpdateException(
                "Firebase không thể xác minh tài khoản lúc này.",
                exception
            );
        }
    }

    /// <summary>Đổi mật khẩu bằng Admin SDK sau khi OTP/reset token hợp lệ.</summary>
    public async Task UpdatePasswordAsync(
        string firebaseUid,
        string newPassword,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            // Việc truy cập Lazy.Value cũng đồng thời xác nhận cấu hình Firebase Admin hợp lệ.
            var auth = _firebaseAuth.Value;
            var uid = firebaseUid.Trim();

            if (string.IsNullOrWhiteSpace(uid))
            {
                throw new FirebaseAdminConfigurationException(
                    "Tài khoản PetNoVa chưa liên kết Firebase UID hợp lệ."
                );
            }

            // Admin SDK đổi trực tiếp mật khẩu sau khi service OTP đã xác minh reset token.
            await auth.UpdateUserAsync(
                new UserRecordArgs
                {
                    Uid = uid,
                    Password = newPassword,
                },
                cancellationToken
            );

            // Thu hồi refresh token buộc các phiên cũ đăng nhập lại bằng mật khẩu mới.
            try
            {
                await auth.RevokeRefreshTokensAsync(uid, CancellationToken.None);
            }
            catch (Exception exception)
            {
                // Mật khẩu đã đổi thành công nên tuyệt đối không báo thất bại và
                // không mở lại reset token chỉ vì bước thu hồi phiên gặp lỗi.
                _logger.LogWarning(
                    exception,
                    "Password changed but Firebase refresh-token revocation failed."
                );
            }
        }
        catch (FirebaseAdminConfigurationException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is FirebaseAuthException
                or ArgumentException
                or InvalidOperationException
        )
        {
            _logger.LogWarning(
                exception,
                "Firebase rejected a PetNoVa password reset operation."
            );
            throw new FirebasePasswordUpdateException(
                "Firebase không thể cập nhật mật khẩu lúc này.",
                exception
            );
        }
    }

    /// <summary>Chọn credential JSON, đường dẫn file hoặc Application Default rồi tạo FirebaseApp.</summary>
    private FirebaseAuth CreateFirebaseAuth()
    {
        try
        {
            var credentialsPath = _configuration["FirebaseAdmin:CredentialsPath"]?.Trim();
            var credentialsJson = _configuration["FirebaseAdmin:CredentialsJson"];
            GoogleCredential credential;

            // JSON trực tiếp phù hợp biến môi trường triển khai; file phù hợp máy phát triển.
            if (!string.IsNullOrWhiteSpace(credentialsJson))
            {
                credential = CredentialFactory
                    .FromJson<ServiceAccountCredential>(credentialsJson)
                    .ToGoogleCredential();
            }
            else if (!string.IsNullOrWhiteSpace(credentialsPath))
            {
                // Báo hướng khắc phục cụ thể thay vì để SDK ném lỗi file khó hiểu.
                if (!File.Exists(credentialsPath))
                {
                    throw new FirebaseAdminConfigurationException(
                        "Không tìm thấy Firebase service-account JSON. "
                            + "Hãy chạy lại configure_petnova_password_reset.cmd."
                    );
                }

                credential = CredentialFactory
                    .FromFile<ServiceAccountCredential>(credentialsPath)
                    .ToGoogleCredential();
            }
            else
            {
                // Trên cloud có thể dùng credential mặc định do môi trường cung cấp.
                credential = GoogleCredential.GetApplicationDefault();
            }

            // projectId tùy chọn nhưng nên đặt để tránh dùng nhầm Firebase project.
            var projectId = _configuration["FirebaseAdmin:ProjectId"]?.Trim();
            var app = FirebaseApp.Create(
                new AppOptions
                {
                    Credential = credential,
                    ProjectId = string.IsNullOrWhiteSpace(projectId) ? null : projectId,
                },
                AppName
            );

            return FirebaseAuth.GetAuth(app);
        }
        catch (FirebaseAdminConfigurationException)
        {
            throw;
        }
        catch (Exception exception)
        {
            throw new FirebaseAdminConfigurationException(
                "Firebase Admin chưa được cấu hình. "
                    + "Hãy chạy configure_petnova_password_reset.cmd.",
                exception
            );
        }
    }
}
