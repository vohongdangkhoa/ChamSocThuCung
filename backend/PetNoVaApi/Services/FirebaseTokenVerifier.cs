using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PetNoVaApi.Services;

/// <summary>Hợp đồng xác minh Firebase ID token, giúp controller dễ test/thay thế.</summary>
public interface IFirebaseTokenVerifier
{
    Task<FirebaseIdentity?> VerifyAsync(
        string idToken,
        CancellationToken cancellationToken = default
    );
}

/// <summary>Danh tính tối thiểu backend tin tưởng sau khi xác minh token.</summary>
public sealed record FirebaseIdentity(string FirebaseUid, string? Email);

/// <summary>Lỗi API key Firebase bị thiếu hoặc không dùng được.</summary>
public sealed class FirebaseConfigurationException : Exception
{
    public FirebaseConfigurationException(string message)
        : base(message)
    {
    }
}

/// <summary>Lỗi tạm thời do timeout, mạng hoặc phản hồi Firebase sai định dạng.</summary>
public sealed class FirebaseVerificationUnavailableException : Exception
{
    public FirebaseVerificationUnavailableException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}

/// <summary>Gọi Firebase Identity Toolkit để xác minh Bearer token từ Flutter.</summary>
public sealed class FirebaseTokenVerifier : IFirebaseTokenVerifier
{
    // HttpClient do DI cấp, API key đọc từ secret và logger chỉ ghi chẩn đoán phía server.
    private readonly HttpClient _httpClient;
    private readonly string? _apiKey;
    private readonly ILogger<FirebaseTokenVerifier> _logger;

    /// <summary>Nhận dependency và lưu Firebase API key đã loại khoảng trắng.</summary>
    public FirebaseTokenVerifier(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<FirebaseTokenVerifier> logger
    )
    {
        _httpClient = httpClient;
        _apiKey = configuration["Firebase:ApiKey"]?.Trim();
        _logger = logger;
    }

    /// <summary>Trả UID/email nếu token hợp lệ; null nếu token bị từ chối.</summary>
    public async Task<FirebaseIdentity?> VerifyAsync(
        string idToken,
        CancellationToken cancellationToken = default
    )
    {
        // Lỗi cấu hình phải báo riêng để người phát triển biết cần sửa user-secrets.
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            throw new FirebaseConfigurationException(
                "Firebase chưa được cấu hình. Hãy đặt Firebase:ApiKey trong User Secrets hoặc biến môi trường."
            );
        }

        // Không có Bearer token thì danh tính không hợp lệ, không cần gọi mạng.
        if (string.IsNullOrWhiteSpace(idToken))
        {
            return null;
        }

        HttpResponseMessage response;

        // accounts:lookup là endpoint Firebase biến ID token thành UID/email đã xác minh.
        try
        {
            response = await _httpClient.PostAsJsonAsync(
                $"v1/accounts:lookup?key={Uri.EscapeDataString(_apiKey)}",
                new { idToken },
                cancellationToken
            );
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Chỉ đổi thành lỗi timeout khi caller không chủ động hủy request.
            throw new FirebaseVerificationUnavailableException(
                "Firebase phản hồi quá chậm. Vui lòng thử lại."
            );
        }
        catch (HttpRequestException exception)
        {
            throw new FirebaseVerificationUnavailableException(
                "Không thể kết nối Firebase để xác minh đăng nhập.",
                exception
            );
        }

        using (response)
        {
            if (response.IsSuccessStatusCode)
            {
                // Parse DTO tối thiểu thay vì phụ thuộc toàn bộ cấu trúc response Firebase.
                FirebaseLookupResponse? payload;

                try
                {
                    payload = await response.Content.ReadFromJsonAsync<FirebaseLookupResponse>(
                        cancellationToken: cancellationToken
                    );
                }
                catch (JsonException exception)
                {
                    throw new FirebaseVerificationUnavailableException(
                        "Firebase trả về dữ liệu xác minh không hợp lệ.",
                        exception
                    );
                }

                // Chỉ tin user có localId vì đây là khóa dùng để nối với UserAccount.firebaseUid.
                var firebaseUser = payload?.Users?.FirstOrDefault(
                    user => !string.IsNullOrWhiteSpace(user.LocalId)
                );

                return firebaseUser is null
                    ? null
                    : new FirebaseIdentity(
                        firebaseUser.LocalId!.Trim(),
                        string.IsNullOrWhiteSpace(firebaseUser.Email)
                            ? null
                            : firebaseUser.Email.Trim()
                    );
            }

            // Body lỗi giúp phân biệt API key sai với token người dùng hết hạn/không hợp lệ.
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (IsApiKeyConfigurationError(errorBody))
            {
                throw new FirebaseConfigurationException(
                    "Firebase:ApiKey không hợp lệ hoặc không được phép dùng Identity Toolkit."
                );
            }

            // Các mã xác thực phổ biến trả null để controller phản hồi 401/403 phù hợp.
            if (response.StatusCode is HttpStatusCode.BadRequest
                or HttpStatusCode.Unauthorized
                or HttpStatusCode.Forbidden)
            {
                return null;
            }

            // Mã bất thường được log nhưng không làm lộ nội dung phản hồi Firebase cho client.
            _logger.LogWarning(
                "Firebase accounts:lookup failed with HTTP {StatusCode}.",
                (int)response.StatusCode
            );

            throw new FirebaseVerificationUnavailableException(
                "Firebase tạm thời không thể xác minh đăng nhập."
            );
        }
    }

    /// <summary>Phân biệt lỗi secret cấu hình với token người dùng không hợp lệ.</summary>
    private static bool IsApiKeyConfigurationError(string errorBody)
    {
        return errorBody.Contains("API key", StringComparison.OrdinalIgnoreCase)
            || errorBody.Contains("API_KEY", StringComparison.OrdinalIgnoreCase)
            || errorBody.Contains("PROJECT_NOT_FOUND", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>DTO riêng để giải mã mảng users của accounts:lookup.</summary>
    private sealed class FirebaseLookupResponse
    {
        [JsonPropertyName("users")]
        public List<FirebaseLookupUser>? Users { get; init; }
    }

    /// <summary>Chỉ giữ UID và email mà backend cần để kiểm tra quyền.</summary>
    private sealed class FirebaseLookupUser
    {
        [JsonPropertyName("localId")]
        public string? LocalId { get; init; }

        [JsonPropertyName("email")]
        public string? Email { get; init; }
    }
}
