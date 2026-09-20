using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Services;

/// <summary>Hợp đồng nghiệp vụ ba bước yêu cầu, xác minh và hoàn tất reset.</summary>
public interface IPasswordResetService
{
    Task<PasswordResetRequestResult> RequestOtpAsync(
        string phone,
        CancellationToken cancellationToken = default
    );

    Task<PasswordResetVerificationResult> VerifyOtpAsync(
        Guid challengeId,
        string otp,
        CancellationToken cancellationToken = default
    );

    Task CompleteAsync(
        Guid challengeId,
        string resetToken,
        string newPassword,
        CancellationToken cancellationToken = default
    );
}

/// <summary>Kết quả gửi OTP chỉ lộ email đã che và thời gian chờ.</summary>
public sealed record PasswordResetRequestResult(
    Guid ChallengeId,
    string MaskedEmail,
    int ExpiresInSeconds,
    int ResendAfterSeconds
);

/// <summary>Kết quả OTP đúng chứa reset token ngắn hạn dùng một lần.</summary>
public sealed record PasswordResetVerificationResult(
    Guid ChallengeId,
    string ResetToken,
    int ExpiresInSeconds
);

/// <summary>Lỗi dữ liệu/quy tắc có thể trả an toàn cho người dùng.</summary>
public sealed class PasswordResetValidationException : Exception
{
    public PasswordResetValidationException(string message)
        : base(message)
    {
    }
}

/// <summary>Lỗi secret/cấu hình chỉ người vận hành cần xử lý.</summary>
public sealed class PasswordResetConfigurationException : Exception
{
    public PasswordResetConfigurationException(string message)
        : base(message)
    {
    }
}

/// <summary>Điều phối SQL, OTP, SMTP và Firebase Admin với các biện pháp chống dò tài khoản.</summary>
public sealed class PasswordResetService : IPasswordResetService
{
    // Khóa theo user chống hai request đồng thời tạo nhiều OTP; opaque state giả lập kết quả cho số không tồn tại.
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> UserLocks = new();
    private static readonly ConcurrentDictionary<string, OpaqueRequestState> OpaqueRequests = new();

    // Các dependency lần lượt phụ trách SQL, email, Firebase, cấu hình bảo mật và log server.
    private readonly PetNoVaDbContext _context;
    private readonly IPasswordResetEmailSender _emailSender;
    private readonly IFirebasePasswordManager _firebasePasswordManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PasswordResetService> _logger;

    /// <summary>Nhận toàn bộ dependency của luồng reset qua DI, không tự tạo kết nối/service.</summary>
    public PasswordResetService(
        PetNoVaDbContext context,
        IPasswordResetEmailSender emailSender,
        IFirebasePasswordManager firebasePasswordManager,
        IConfiguration configuration,
        ILogger<PasswordResetService> logger
    )
    {
        _context = context;
        _emailSender = emailSender;
        _firebasePasswordManager = firebasePasswordManager;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>Đảm bảo thời gian phản hồi tối thiểu rồi xử lý yêu cầu OTP.</summary>
    public async Task<PasswordResetRequestResult> RequestOtpAsync(
        string phone,
        CancellationToken cancellationToken = default
    )
    {
        // Thời gian ngẫu nhiên 0,9–1,4 giây làm khó đoán số điện thoại có tồn tại qua timing.
        var startedAt = Stopwatch.GetTimestamp();
        var minimumResponseTime = TimeSpan.FromMilliseconds(
            RandomNumberGenerator.GetInt32(900, 1_401)
        );

        try
        {
            return await RequestOtpCoreAsync(phone, cancellationToken);
        }
        finally
        {
            // Luôn áp dụng thời gian tối thiểu, kể cả nhánh thành công hay phát sinh lỗi.
            await EnforceMinimumResponseTimeAsync(
                startedAt,
                minimumResponseTime,
                cancellationToken
            );
        }
    }

    /// <summary>Chuẩn hóa số, tra user, tạo OTP ngẫu nhiên, lưu hash và gửi email.</summary>
    private async Task<PasswordResetRequestResult> RequestOtpCoreAsync(
        string phone,
        CancellationToken cancellationToken
    )
    {
        // Mọi cách nhập hợp lệ được đưa về cùng chuẩn E.164 trước khi truy vấn unique index.
        var normalizedPhone = PhoneNumberNormalizer.NormalizeVietnamese(phone);
        if (normalizedPhone is null)
        {
            throw new PasswordResetValidationException(
                "Số điện thoại không hợp lệ. Ví dụ: 0912345678."
            );
        }

        // Kiểm tra secret/email/Firebase trước khi tạo challenge để tránh ghi bản ghi không thể sử dụng.
        var settings = ReadSettings();
        _emailSender.EnsureConfigured();
        _firebasePasswordManager.EnsureConfigured();
        // Dùng UTC nhất quán giữa backend và SQL, đồng thời dọn bản ghi quá cũ.
        var now = DateTime.UtcNow;
        await RemoveOldChallengesAsync(now, cancellationToken);

        // Chỉ Customer ACTIVE mới được tự reset; Select tối thiểu tránh tải dữ liệu hồ sơ không cần thiết.
        var user = await _context.UserAccounts
            .AsNoTracking()
            .Where(user =>
                user.role == "CUSTOMER"
                && user.status == "ACTIVE"
                && user.normalizedPhone == normalizedPhone
            )
            .Select(user => new
            {
                user.userId,
                user.firebaseUid,
                user.email,
            })
            .SingleOrDefaultAsync(cancellationToken);

        // Trả kết quả giả giống thật để không tiết lộ số điện thoại nào đã đăng ký.
        if (
            user is null
            || string.IsNullOrWhiteSpace(user.email)
            || string.IsNullOrWhiteSpace(user.firebaseUid)
        )
        {
            return CreateOpaqueRequestResult(settings, normalizedPhone, now);
        }

        // Kiểm tra thêm UID/email với Firebase để DB cũ/sai không thể đổi nhầm tài khoản.
        bool identityMatches;
        try
        {
            identityMatches = await _firebasePasswordManager.IdentityMatchesAsync(
                user.firebaseUid,
                user.email,
                cancellationToken
            );
        }
        catch (FirebasePasswordUpdateException exception)
        {
            // Firebase tạm lỗi cũng dùng kết quả mờ, không xác nhận tài khoản tồn tại.
            _logger.LogWarning(
                exception,
                "Password reset identity lookup was unavailable."
            );
            return CreateOpaqueRequestResult(settings, normalizedPhone, now);
        }

        if (!identityMatches)
        {
            // Ghi cảnh báo nội bộ để quản trị sửa dữ liệu liên kết, client vẫn nhận phản hồi mờ.
            _logger.LogWarning(
                "Password reset skipped because SQL identity does not match Firebase."
            );
            return CreateOpaqueRequestResult(settings, normalizedPhone, now);
        }

        // Serialize request của cùng user để cooldown và vô hiệu hóa OTP cũ không bị race condition.
        var userLock = UserLocks.GetOrAdd(user.userId, _ => new SemaphoreSlim(1, 1));
        await userLock.WaitAsync(cancellationToken);
        try
        {
            now = DateTime.UtcNow;
            // Tìm OTP còn hiệu lực gần nhất để áp dụng thời gian chờ gửi lại.
            var activeChallenge = await _context.PasswordResetChallenges
                .Where(item =>
                    item.userId == user.userId
                    && item.consumedAt == null
                    && item.verifiedAt == null
                    && item.expiresAt > now
                )
                .OrderByDescending(item => item.createdAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (activeChallenge is not null && activeChallenge.resendAvailableAt > now)
            {
                // Không gửi email mới trong cooldown nhưng phản hồi vẫn cung cấp đồng hồ đếm ngược.
                return new PasswordResetRequestResult(
                    activeChallenge.challengeId,
                    "email đã liên kết",
                    SecondsUntil(activeChallenge.expiresAt, now),
                    SecondsUntil(activeChallenge.resendAvailableAt, now)
                );
            }

            // Khi được phép gửi lại, đánh dấu mọi challenge trước đó đã dùng để chỉ OTP mới nhất hợp lệ.
            var previousChallenges = await _context.PasswordResetChallenges
                .Where(item => item.userId == user.userId && item.consumedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var previousChallenge in previousChallenges)
            {
                previousChallenge.consumedAt = now;
            }

            if (previousChallenges.Count > 0)
            {
                await _context.SaveChangesAsync(cancellationToken);
            }

            // RandomNumberGenerator tạo OTP sáu số không thể dự đoán như System.Random.
            var challengeId = Guid.NewGuid();
            var otp = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            // Chỉ lưu HMAC của OTP; thời hạn/cooldown/số lần thử nằm hoàn toàn ở server.
            var challenge = new PasswordResetChallenge
            {
                challengeId = challengeId,
                userId = user.userId,
                firebaseUid = user.firebaseUid,
                email = user.email.Trim(),
                normalizedPhone = normalizedPhone,
                otpHash = ComputeHash(settings.Pepper, challengeId, otp),
                expiresAt = now.AddMinutes(settings.OtpLifetimeMinutes),
                attemptCount = 0,
                resendAvailableAt = now.AddSeconds(settings.ResendCooldownSeconds),
                createdAt = now,
            };

            // Lưu challenge trước khi gửi để OTP trong email luôn có bản ghi kiểm chứng.
            _context.PasswordResetChallenges.Add(challenge);
            await _context.SaveChangesAsync(cancellationToken);

            // Email là side effect ngoài DB; nếu gửi thất bại phải rollback challenge vừa tạo.
            try
            {
                await _emailSender.SendOtpAsync(
                    challenge.email,
                    otp,
                    settings.OtpLifetimeMinutes,
                    cancellationToken
                );
            }
            catch (Exception exception) when (
                exception is PasswordResetEmailDeliveryException
                    or OperationCanceledException
            )
            {
                // Xóa bằng CancellationToken.None vì vẫn phải dọn DB dù request client đã hủy.
                _context.PasswordResetChallenges.Remove(challenge);
                await _context.SaveChangesAsync(CancellationToken.None);

                if (exception is OperationCanceledException)
                {
                    // Giữ đúng semantics hủy request thay vì biến thành lỗi gửi email chung.
                    throw;
                }

                _logger.LogWarning(
                    exception,
                    "Password reset email could not be delivered."
                );
                return CreateOpaqueRequestResult(settings, normalizedPhone, now);
            }

            // Không trả email thật; client chỉ cần challengeId và thời gian để chuyển bước OTP.
            return new PasswordResetRequestResult(
                challenge.challengeId,
                "email đã liên kết",
                SecondsUntil(challenge.expiresAt, now),
                settings.ResendCooldownSeconds
            );
        }
        finally
        {
            // Bắt buộc nhả semaphore kể cả DB/SMTP ném lỗi để user không bị khóa vĩnh viễn.
            userLock.Release();
        }
    }

    /// <summary>Bọc bước xác minh bằng thời gian phản hồi tối thiểu chống enumeration.</summary>
    public async Task<PasswordResetVerificationResult> VerifyOtpAsync(
        Guid challengeId,
        string otp,
        CancellationToken cancellationToken = default
    )
    {
        // Bước verify cũng thêm jitter ngắn để giảm khả năng suy luận từ thời gian xử lý.
        var startedAt = Stopwatch.GetTimestamp();
        var minimumResponseTime = TimeSpan.FromMilliseconds(
            RandomNumberGenerator.GetInt32(350, 551)
        );

        try
        {
            return await VerifyOtpCoreAsync(challengeId, otp, cancellationToken);
        }
        finally
        {
            await EnforceMinimumResponseTimeAsync(
                startedAt,
                minimumResponseTime,
                cancellationToken
            );
        }
    }

    /// <summary>Kiểm tra challenge/hạn/số lần thử/hash rồi phát reset token.</summary>
    private async Task<PasswordResetVerificationResult> VerifyOtpCoreAsync(
        Guid challengeId,
        string otp,
        CancellationToken cancellationToken
    )
    {
        // Từ chối định dạng trước truy vấn DB nhưng dùng cùng thông báo chung chống lộ trạng thái.
        if (otp.Length != 6 || otp.Any(character => character is < '0' or > '9'))
        {
            throw InvalidOtp();
        }

        var settings = ReadSettings();
        var now = DateTime.UtcNow;
        // Tải entity có tracking vì hàm sẽ tăng attempt hoặc ghi reset-token hash.
        var challenge = await _context.PasswordResetChallenges
            .FirstOrDefaultAsync(item => item.challengeId == challengeId, cancellationToken);

        // Một thông báo chung bao phủ không tồn tại, hết hạn, đã dùng và vượt số lần thử.
        if (
            challenge is null
            || challenge.consumedAt is not null
            || challenge.verifiedAt is not null
            || challenge.expiresAt <= now
            || challenge.attemptCount >= settings.MaximumOtpAttempts
        )
        {
            throw InvalidOtp();
        }

        // Tăng attempt trước khi so sánh để mọi lần nhập đều được tính kể cả nhập sai.
        challenge.attemptCount++;
        var submittedHash = ComputeHash(settings.Pepper, challenge.challengeId, otp);
        // FixedTimeEquals tránh timing attack khi so sánh dữ liệu bí mật.
        var isMatch = challenge.otpHash.Length == submittedHash.Length
            && CryptographicOperations.FixedTimeEquals(challenge.otpHash, submittedHash);

        if (!isMatch)
        {
            if (challenge.attemptCount >= settings.MaximumOtpAttempts)
            {
                // Đạt ngưỡng thì consume challenge, buộc người dùng xin OTP mới.
                challenge.consumedAt = now;
            }

            await SaveOtpStateAsync(cancellationToken);
            throw InvalidOtp();
        }

        // OTP đúng không đổi mật khẩu ngay; phát token mạnh riêng cho bước xác nhận cuối.
        var resetToken = CreateResetToken();
        challenge.verifiedAt = now;
        challenge.resetTokenHash = ComputeHash(
            settings.Pepper,
            challenge.challengeId,
            resetToken
        );
        challenge.resetTokenExpiresAt = now.AddMinutes(
            settings.ResetTokenLifetimeMinutes
        );

        await SaveOtpStateAsync(cancellationToken);

        // Chỉ token dạng rõ được trả một lần; DB tiếp tục chỉ giữ hash.
        return new PasswordResetVerificationResult(
            challenge.challengeId,
            resetToken,
            settings.ResetTokenLifetimeMinutes * 60
        );
    }

    /// <summary>Xác minh reset token, đổi mật khẩu Firebase và đánh dấu challenge đã dùng.</summary>
    public async Task CompleteAsync(
        Guid challengeId,
        string resetToken,
        string newPassword,
        CancellationToken cancellationToken = default
    )
    {
        // Firebase yêu cầu tối thiểu 6 ký tự; giới hạn trên tránh payload bất thường.
        if (
            string.IsNullOrWhiteSpace(newPassword)
            || newPassword.Length < 6
            || newPassword.Length > 128
        )
        {
            throw new PasswordResetValidationException(
                "Mật khẩu mới phải có từ 6 đến 128 ký tự."
            );
        }

        // Token rỗng dùng cùng lỗi phiên hết hạn, không tiết lộ chi tiết kiểm tra.
        if (string.IsNullOrWhiteSpace(resetToken))
        {
            throw InvalidResetToken();
        }

        var settings = ReadSettings();
        var now = DateTime.UtcNow;
        // Tải challenge có tracking vì sẽ đánh dấu consumed trước khi gọi Firebase.
        var challenge = await _context.PasswordResetChallenges
            .FirstOrDefaultAsync(item => item.challengeId == challengeId, cancellationToken);

        // Chỉ challenge đã verify, chưa dùng và reset token còn hạn mới đi tiếp.
        if (
            challenge is null
            || challenge.consumedAt is not null
            || challenge.verifiedAt is null
            || challenge.resetTokenHash is null
            || challenge.resetTokenExpiresAt is null
            || challenge.resetTokenExpiresAt <= now
        )
        {
            throw InvalidResetToken();
        }

        // Kiểm tra lại toàn bộ liên kết tại thời điểm hoàn tất vì tài khoản có thể vừa bị khóa/đổi dữ liệu.
        var accountIsStillEligible = await _context.UserAccounts
            .AsNoTracking()
            .AnyAsync(
                user =>
                    user.userId == challenge.userId
                    && user.firebaseUid == challenge.firebaseUid
                    && user.email == challenge.email
                    && user.normalizedPhone == challenge.normalizedPhone
                    && user.role == "CUSTOMER"
                    && user.status == "ACTIVE",
                cancellationToken
            );
        if (!accountIsStillEligible)
        {
            throw InvalidResetToken();
        }

        // Hash token client gửi với cùng pepper/challengeId rồi so sánh constant-time.
        var submittedHash = ComputeHash(
            settings.Pepper,
            challenge.challengeId,
            resetToken
        );
        if (
            challenge.resetTokenHash.Length != submittedHash.Length
            || !CryptographicOperations.FixedTimeEquals(
                challenge.resetTokenHash,
                submittedHash
            )
        )
        {
            throw InvalidResetToken();
        }

        // Lớp bảo vệ cuối xác nhận Firebase UID và email vẫn thuộc cùng người dùng.
        var identityMatches = await _firebasePasswordManager.IdentityMatchesAsync(
            challenge.firebaseUid,
            challenge.email,
            cancellationToken
        );
        if (!identityMatches)
        {
            throw InvalidResetToken();
        }

        // Consume trong DB trước external call để hai request đồng thời không dùng lại token.
        challenge.consumedAt = now;
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // RowVersion thay đổi nghĩa request khác đã dùng token này trước.
            throw InvalidResetToken();
        }

        // Kể từ đây token đã bị tiêu thụ vĩnh viễn. Nếu Firebase gặp lỗi không
        // xác định, người dùng phải xin OTP mới thay vì tái sử dụng token cũ.
        await _firebasePasswordManager.UpdatePasswordAsync(
            challenge.firebaseUid,
            newPassword,
            CancellationToken.None
        );
    }

    /// <summary>Đọc pepper và giới hạn thời gian/số lần thử, ép chúng vào khoảng an toàn.</summary>
    private PasswordResetSettings ReadSettings()
    {
        // Pepper là secret toàn hệ thống dùng HMAC, bắt buộc đủ dài và không lưu trong Git.
        var pepper = _configuration["PasswordReset:Pepper"];
        if (string.IsNullOrWhiteSpace(pepper) || pepper.Length < 32)
        {
            throw new PasswordResetConfigurationException(
                "PasswordReset:Pepper chưa được cấu hình. "
                    + "Hãy chạy configure_petnova_password_reset.cmd."
            );
        }

        // Clamp ngăn cấu hình nhầm khiến OTP quá ngắn, tồn tại quá lâu hoặc thử vô hạn.
        return new PasswordResetSettings(
            pepper,
            Math.Clamp(
                _configuration.GetValue("PasswordReset:OtpLifetimeMinutes", 5),
                3,
                15
            ),
            Math.Clamp(
                _configuration.GetValue(
                    "PasswordReset:ResetTokenLifetimeMinutes",
                    10
                ),
                5,
                30
            ),
            Math.Clamp(
                _configuration.GetValue("PasswordReset:ResendCooldownSeconds", 60),
                30,
                300
            ),
            Math.Clamp(
                _configuration.GetValue("PasswordReset:MaximumOtpAttempts", 5),
                3,
                10
            )
        );
    }

    /// <summary>Tạo HMAC-SHA256 gắn secret với challengeId để OTP giống nhau vẫn có hash khác.</summary>
    private static byte[] ComputeHash(string pepper, Guid challengeId, string value)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(pepper));
        return hmac.ComputeHash(
            Encoding.UTF8.GetBytes($"{challengeId:N}:{value}")
        );
    }

    /// <summary>Sinh reset token ngẫu nhiên bằng bộ tạo số mật mã an toàn.</summary>
    private static string CreateResetToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    /// <summary>Tạo phản hồi giả có cooldown giống thật cho số không có tài khoản hợp lệ.</summary>
    private static PasswordResetRequestResult CreateOpaqueRequestResult(
        PasswordResetSettings settings,
        string normalizedPhone,
        DateTime now
    )
    {
        // Chỉ quét dọn khi cache lớn để giới hạn bộ nhớ mà không tốn chi phí mọi request.
        if (OpaqueRequests.Count > 1_000)
        {
            foreach (var item in OpaqueRequests)
            {
                if (item.Value.ExpiresAt <= now)
                {
                    OpaqueRequests.TryRemove(item.Key, out _);
                }
            }
        }

        // Cache dùng HMAC của số thay vì số rõ, và giữ state cũ trong thời gian cooldown.
        var lookupKey = ComputeOpaqueLookupKey(settings.Pepper, normalizedPhone);
        var state = OpaqueRequests.AddOrUpdate(
            lookupKey,
            _ => CreateOpaqueState(settings, now),
            (_, current) => current.ResendAvailableAt > now
                ? current
                : CreateOpaqueState(settings, now)
        );

        return new PasswordResetRequestResult(
            state.ChallengeId,
            "email đã liên kết",
            SecondsUntil(state.ExpiresAt, now),
            SecondsUntil(state.ResendAvailableAt, now)
        );
    }

    /// <summary>Tạo challenge giả có cùng cấu trúc thời hạn với challenge trong SQL.</summary>
    private static OpaqueRequestState CreateOpaqueState(
        PasswordResetSettings settings,
        DateTime now
    )
    {
        return new OpaqueRequestState(
            Guid.NewGuid(),
            now.AddMinutes(settings.OtpLifetimeMinutes),
            now.AddSeconds(settings.ResendCooldownSeconds)
        );
    }

    /// <summary>Tạo khóa tra cứu mờ để hạn chế lộ số điện thoại trong bộ nhớ/cache.</summary>
    private static string ComputeOpaqueLookupKey(string pepper, string phone)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(pepper));
        return Convert.ToHexString(
            hmac.ComputeHash(Encoding.UTF8.GetBytes($"opaque-phone:{phone}"))
        );
    }

    /// <summary>Làm thời gian phản hồi gần nhau dù số điện thoại có tồn tại hay không.</summary>
    private static async Task EnforceMinimumResponseTimeAsync(
        long startedAt,
        TimeSpan minimumResponseTime,
        CancellationToken cancellationToken
    )
    {
        // Chỉ delay phần còn thiếu; xử lý đã lâu hơn mức tối thiểu thì trả ngay.
        var remaining = minimumResponseTime - Stopwatch.GetElapsedTime(startedAt);
        if (remaining > TimeSpan.Zero)
        {
            await Task.Delay(remaining, cancellationToken);
        }
    }

    /// <summary>Dọn challenge cũ để bảng OTP không tăng vô hạn.</summary>
    private async Task RemoveOldChallengesAsync(
        DateTime now,
        CancellationToken cancellationToken
    )
    {
        // Challenge quá một ngày không còn giá trị pháp lý và có thể xóa trực tiếp tại DB.
        var retentionCutoff = now.AddDays(-1);
        await _context.PasswordResetChallenges
            .Where(item => item.createdAt < retentionCutoff)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <summary>Lưu thay đổi OTP và xử lý xung đột đồng thời một cách kiểm soát.</summary>
    private async Task SaveOtpStateAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Xung đột rowVersion được biểu diễn như OTP không hợp lệ, không lộ race condition.
            throw InvalidOtp();
        }
    }

    /// <summary>Đổi mốc UTC thành số giây đếm ngược không bao giờ âm.</summary>
    private static int SecondsUntil(DateTime timestamp, DateTime now)
    {
        return Math.Max(0, (int)Math.Ceiling((timestamp - now).TotalSeconds));
    }

    /// <summary>Tạo thông báo OTP chung để không tiết lộ lý do kiểm tra nào thất bại.</summary>
    private static PasswordResetValidationException InvalidOtp()
    {
        return new PasswordResetValidationException(
            "Mã OTP không đúng, đã hết hạn hoặc đã được sử dụng."
        );
    }

    /// <summary>Tạo thông báo reset token chung, yêu cầu bắt đầu lại quy trình.</summary>
    private static PasswordResetValidationException InvalidResetToken()
    {
        return new PasswordResetValidationException(
            "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng gửi OTP mới."
        );
    }

    /// <summary>Snapshot cấu hình bảo mật đã được kiểm tra và clamp.</summary>
    private sealed record PasswordResetSettings(
        string Pepper,
        int OtpLifetimeMinutes,
        int ResetTokenLifetimeMinutes,
        int ResendCooldownSeconds,
        int MaximumOtpAttempts
    );

    /// <summary>Trạng thái giả trong RAM dùng chống dò số điện thoại.</summary>
    private sealed record OpaqueRequestState(
        Guid ChallengeId,
        DateTime ExpiresAt,
        DateTime ResendAvailableAt
    );
}
