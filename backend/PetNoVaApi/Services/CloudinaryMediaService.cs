using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace PetNoVaApi.Services;

/// <summary>Hợp đồng upload/xóa ảnh, tách controller khỏi Cloudinary SDK/API.</summary>
public interface ICloudinaryMediaService
{
    bool IsConfigured { get; }

    Task<CloudinaryUploadResult> UploadImageAsync(
        IFormFile file,
        string folder,
        string contentType,
        CancellationToken cancellationToken = default
    );

    Task DeleteImageAsync(
        string publicId,
        CancellationToken cancellationToken = default
    );
}

/// <summary>Cặp thông tin cần lưu vào SQL Server sau khi upload.</summary>
public sealed record CloudinaryUploadResult(string Url, string PublicId);

/// <summary>Báo thiếu CloudName/API key/secret trong user-secrets.</summary>
public sealed class CloudinaryConfigurationException : Exception
{
    public CloudinaryConfigurationException(string message)
        : base(message)
    {
    }
}

/// <summary>Báo Cloudinary từ chối hoặc không thể xử lý request.</summary>
public sealed class CloudinaryRequestException : Exception
{
    public CloudinaryRequestException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}

/// <summary>Ký và gọi trực tiếp Cloudinary REST API để quản lý ảnh PetNoVa.</summary>
public sealed class CloudinaryMediaService : ICloudinaryMediaService
{
    // HttpClient được DI quản lý; ba chuỗi còn lại lấy từ user-secrets/biến môi trường.
    private readonly HttpClient _httpClient;
    private readonly string? _cloudName;
    private readonly string? _apiKey;
    private readonly string? _apiSecret;

    /// <summary>Nhận HttpClient và đọc cấu hình Cloudinary một lần khi service được tạo.</summary>
    public CloudinaryMediaService(
        HttpClient httpClient,
        IConfiguration configuration
    )
    {
        // Trim tránh khoảng trắng do sao chép credential làm chữ ký bị sai.
        _httpClient = httpClient;
        _cloudName = configuration["Cloudinary:CloudName"]?.Trim();
        _apiKey = configuration["Cloudinary:ApiKey"]?.Trim();
        _apiSecret = configuration["Cloudinary:ApiSecret"]?.Trim();
    }

    /// <summary>Cho biết ba thông số Cloudinary cần thiết đã được cấu hình.</summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_cloudName)
        && !string.IsNullOrWhiteSpace(_apiKey)
        && !string.IsNullOrWhiteSpace(_apiSecret);

    /// <summary>Tạo chữ ký SHA, gửi multipart và đọc secure_url/public_id.</summary>
    public async Task<CloudinaryUploadResult> UploadImageAsync(
        IFormFile file,
        string folder,
        string contentType,
        CancellationToken cancellationToken = default
    )
    {
        // Không gửi request nếu thiếu credential; lỗi cấu hình được phân biệt với lỗi mạng.
        EnsureConfigured();

        // Cloudinary dùng folder để tổ chức ảnh và public_id ngẫu nhiên để tránh trùng tên.
        var parameters = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["folder"] = folder,
            ["public_id"] = Guid.NewGuid().ToString("N")
        };

        // Ghép metadata với stream ảnh thành multipart/form-data; using bảo đảm giải phóng stream.
        using var form = CreateForm(parameters);
        await using var fileStream = file.OpenReadStream();
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue(
                contentType
            );
        fileContent.Headers.ContentDisposition = new ContentDispositionHeaderValue(
            "form-data"
        )
        {
            Name = "\"file\"",
            FileName =
                $"\"{ImageUploadValidator.GetSafeFileName(contentType)}\""
        };
        form.Add(fileContent);

        // Endpoint upload chứa cloud name; SendAsync chịu trách nhiệm xác thực Basic Auth.
        var responseBody = await SendAsync(
            $"v1_1/{Uri.EscapeDataString(_cloudName!)}/image/upload",
            form,
            cancellationToken
        );

        // Chỉ coi upload thành công khi phản hồi có đủ URL HTTPS và publicId để quản lý ảnh.
        try
        {
            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;
            var url = root.TryGetProperty("secure_url", out var secureUrl)
                ? secureUrl.GetString()
                : null;
            var publicId = root.TryGetProperty("public_id", out var publicIdElement)
                ? publicIdElement.GetString()
                : null;

            if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(publicId))
            {
                throw new CloudinaryRequestException(
                    "Cloudinary không trả về URL hoặc public ID của ảnh."
                );
            }

            return new CloudinaryUploadResult(url, publicId);
        }
        catch (JsonException exception)
        {
            // Bọc lỗi parser để controller không làm lộ chi tiết JSON/stack trace ra client.
            throw new CloudinaryRequestException(
                "Cloudinary trả về dữ liệu không hợp lệ.",
                exception
            );
        }
    }

    /// <summary>Xóa ảnh theo publicId khi avatar được thay hoặc thao tác rollback.</summary>
    public async Task DeleteImageAsync(
        string publicId,
        CancellationToken cancellationToken = default
    )
    {
        EnsureConfigured();

        // publicId rỗng nghĩa là hồ sơ chưa từng có ảnh, không cần gọi Cloudinary.
        if (string.IsNullOrWhiteSpace(publicId))
        {
            return;
        }

        // invalidate=true yêu cầu CDN bỏ cache ảnh cũ sau khi xóa.
        var parameters = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["invalidate"] = "true",
            ["public_id"] = publicId
        };

        using var form = CreateForm(parameters);
        await SendAsync(
            $"v1_1/{Uri.EscapeDataString(_cloudName!)}/image/destroy",
            form,
            cancellationToken
        );
    }

    /// <summary>Chuyển các tham số ký request thành từng field multipart đúng tên.</summary>
    private static MultipartFormDataContent CreateForm(
        IReadOnlyDictionary<string, string> parameters
    )
    {
        var form = new MultipartFormDataContent();

        // Mỗi phần cần Content-Disposition form-data để Cloudinary nhận đúng field.
        foreach (var parameter in parameters)
        {
            var fieldContent = new StringContent(parameter.Value, Encoding.UTF8);
            fieldContent.Headers.ContentDisposition =
                new ContentDispositionHeaderValue("form-data")
                {
                    Name = $"\"{parameter.Key}\""
                };
            form.Add(fieldContent);
        }

        return form;
    }

    /// <summary>Gửi HTTP và chuyển lỗi Cloudinary thành exception nghiệp vụ.</summary>
    private async Task<string> SendAsync(
        string requestUri,
        HttpContent content,
        CancellationToken cancellationToken
    )
    {
        HttpResponseMessage response;

        // Tạo request mới cho mỗi lần gọi để Content và header được dispose đúng vòng đời.
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
            {
                Content = content
            };
            request.Headers.Authorization = new AuthenticationHeaderValue(
                "Basic",
                Convert.ToBase64String(
                    Encoding.ASCII.GetBytes($"{_apiKey}:{_apiSecret}")
                )
            );

            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Phân biệt timeout của HttpClient với việc request bị caller chủ động hủy.
            throw new CloudinaryRequestException(
                "Cloudinary phản hồi quá chậm. Vui lòng thử lại."
            );
        }
        catch (HttpRequestException exception)
        {
            throw new CloudinaryRequestException(
                "Không thể kết nối dịch vụ lưu ảnh Cloudinary.",
                exception
            );
        }

        using (response)
        {
            // Đọc body trước khi dispose để parse thành kết quả hoặc thông báo lỗi.
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return responseBody;
            }

            // 401/403 thường do API key/secret, nên trả lỗi cấu hình thay vì lỗi upload chung.
            if (response.StatusCode is HttpStatusCode.Unauthorized
                or HttpStatusCode.Forbidden)
            {
                throw new CloudinaryConfigurationException(
                    "Thông tin Cloudinary không hợp lệ hoặc không có quyền upload ảnh."
                );
            }

            throw new CloudinaryRequestException(
                $"Cloudinary từ chối yêu cầu với mã HTTP {(int)response.StatusCode}."
            );
        }
    }

    /// <summary>Chặn thao tác sớm nếu secret chưa được thiết lập.</summary>
    private void EnsureConfigured()
    {
        if (!IsConfigured)
        {
            throw new CloudinaryConfigurationException(
                "Cloudinary chưa được cấu hình. Hãy đặt Cloudinary:CloudName, Cloudinary:ApiKey và Cloudinary:ApiSecret trong User Secrets hoặc biến môi trường."
            );
        }
    }
}
