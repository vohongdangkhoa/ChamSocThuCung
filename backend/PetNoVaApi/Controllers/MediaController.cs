using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers;

[Route("api/[controller]")]
[ApiController]
/// <summary>Nhận ảnh có xác thực, upload Cloudinary và lưu URL vào PetNoVaDB.</summary>
public sealed class MediaController : ControllerBase
{
    // Giới hạn request 6 MB ở tầng ASP.NET; validator bên dưới tiếp tục kiểm tra kích thước/định dạng ảnh.
    private const long MaxRequestSize = 6 * 1024 * 1024;

    private readonly PetNoVaDbContext _context;
    private readonly IFirebaseTokenVerifier _firebaseTokenVerifier;
    private readonly ICloudinaryMediaService _cloudinary;
    private readonly ILogger<MediaController> _logger;

    /// <summary>Nhận database, Firebase, Cloudinary và logger qua dependency injection.</summary>
    public MediaController(
        PetNoVaDbContext context,
        IFirebaseTokenVerifier firebaseTokenVerifier,
        ICloudinaryMediaService cloudinary,
        ILogger<MediaController> logger
    )
    {
        _context = context;
        _firebaseTokenVerifier = firebaseTokenVerifier;
        _cloudinary = cloudinary;
        _logger = logger;
    }

    [HttpPost("avatar")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxRequestSize)]
    /// <summary>Upload avatar của đúng tài khoản Firebase đang gọi.</summary>
    /// <param name="file">File multipart/form-data có field name là file.</param>
    /// <returns>200 với URL/publicId; 400/413/415 file sai; 401 token sai; 404 hồ sơ thiếu; 503 cấu hình lỗi.</returns>
    public async Task<IActionResult> UploadAvatar(
        [FromForm] IFormFile? file,
        CancellationToken cancellationToken
    )
    {
        // Fail fast trước khi đọc file/token nếu backend chưa có đủ secret Cloudinary.
        var configurationError = GetCloudinaryConfigurationError();

        if (configurationError is not null)
        {
            return configurationError;
        }

        // Xác minh Bearer token để ảnh chỉ gắn vào tài khoản đang đăng nhập thật sự.
        var identityResult = await GetFirebaseIdentityAsync(cancellationToken);

        if (identityResult.Error is not null)
        {
            return identityResult.Error;
        }

        var identity = identityResult.Identity!;
        // Kiểm tra file rỗng, dung lượng, MIME và magic bytes trước khi gửi ra dịch vụ ngoài.
        var validation = await ImageUploadValidator.ValidateAsync(
            file,
            cancellationToken
        );

        if (!validation.IsValid)
        {
            return StatusCode(validation.StatusCode, new
            {
                message = validation.ErrorMessage
            });
        }

        // Ghép UID Firebase với USER_ACCOUNT, có fallback email cho dữ liệu cũ chưa đồng bộ UID.
        var user = await FindAndSynchronizeUserAsync(
            identity,
            cancellationToken
        );

        if (user is null)
        {
            return NotFound(new
            {
                message = "Không tìm thấy tài khoản PetNoVa của người dùng đang đăng nhập."
            });
        }

        // Callback chỉ cập nhật entity; helper chung chịu trách nhiệm upload, SaveChanges và xóa ảnh cũ.
        return await UploadAndSaveAsync(
            file!,
            validation.ContentType!,
            BuildFolder("users", identity.FirebaseUid, "avatar"),
            user.avatarPublicId,
            result =>
            {
                user.avatarUrl = result.Url;
                user.avatarPublicId = result.PublicId;
            },
            cancellationToken
        );
    }

    [HttpPost("pets/{petId}")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxRequestSize)]
    /// <summary>Upload ảnh pet sau khi kiểm tra pet thuộc người dùng hiện tại.</summary>
    /// <param name="petId">Mã pet trong URL, dùng để tìm hồ sơ và tạo folder Cloudinary.</param>
    /// <param name="file">Ảnh multipart/form-data.</param>
    /// <returns>200 với URL/publicId; 403 nếu pet của người khác; cùng các lỗi file/token/cấu hình tương ứng.</returns>
    public async Task<IActionResult> UploadPetImage(
        string petId,
        [FromForm] IFormFile? file,
        CancellationToken cancellationToken
    )
    {
        var configurationError = GetCloudinaryConfigurationError();

        if (configurationError is not null)
        {
            return configurationError;
        }

        var identityResult = await GetFirebaseIdentityAsync(cancellationToken);

        if (identityResult.Error is not null)
        {
            return identityResult.Error;
        }

        var identity = identityResult.Identity!;
        var validation = await ImageUploadValidator.ValidateAsync(
            file,
            cancellationToken
        );

        if (!validation.IsValid)
        {
            return StatusCode(validation.StatusCode, new
            {
                message = validation.ErrorMessage
            });
        }

        var user = await FindAndSynchronizeUserAsync(
            identity,
            cancellationToken
        );

        if (user is null)
        {
            return NotFound(new
            {
                message = "Không tìm thấy tài khoản PetNoVa của người dùng đang đăng nhập."
            });
        }

        // Tìm pet bằng khóa từ route; chưa upload gì cho đến khi quyền sở hữu được xác nhận.
        var pet = await _context.Pets.FirstOrDefaultAsync(
            item => item.petId == petId,
            cancellationToken
        );

        if (pet is null)
        {
            return NotFound(new { message = "Không tìm thấy thú cưng." });
        }

        // Chống IDOR: người dùng sửa petId trên URL vẫn không thể thay ảnh của chủ khác.
        if (!string.Equals(pet.userId, user.userId, StringComparison.Ordinal))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Bạn không có quyền thay đổi ảnh của thú cưng này."
            });
        }

        return await UploadAndSaveAsync(
            file!,
            validation.ContentType!,
            BuildFolder(
                "users",
                identity.FirebaseUid,
                "pets",
                pet.petId
            ),
            pet.imagePublicId,
            result =>
            {
                pet.imageUrl = result.Url;
                pet.imagePublicId = result.PublicId;
            },
            cancellationToken
        );
    }

    /// <summary>Upload ảnh mới, lưu tham chiếu DB rồi dọn ảnh cũ theo thứ tự an toàn.</summary>
    /// <param name="folder">Folder Cloudinary đã được làm sạch theo user/pet.</param>
    /// <param name="oldPublicId">Tài nguyên cũ cần xóa sau khi DB lưu ảnh mới thành công.</param>
    /// <param name="applyResult">Callback gán URL/publicId vào UserAccount hoặc Pet.</param>
    /// <returns>200 với ảnh mới, 502 khi Cloudinary lỗi hoặc 503 khi thiếu cấu hình.</returns>
    private async Task<IActionResult> UploadAndSaveAsync(
        IFormFile file,
        string contentType,
        string folder,
        string? oldPublicId,
        Action<CloudinaryUploadResult> applyResult,
        CancellationToken cancellationToken
    )
    {
        CloudinaryUploadResult uploadResult;

        // Bước 1: upload trước để chỉ ghi URL vào SQL khi Cloudinary đã có tài nguyên thật.
        try
        {
            uploadResult = await _cloudinary.UploadImageAsync(
                file,
                folder,
                contentType,
                cancellationToken
            );
        }
        catch (CloudinaryConfigurationException exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = exception.Message
            });
        }
        catch (CloudinaryRequestException exception)
        {
            // 502 cho biết PetNoVa API chạy nhưng upstream Cloudinary không xử lý được yêu cầu.
            _logger.LogWarning(exception, "Cloudinary image upload failed.");
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                message = "Dịch vụ lưu ảnh tạm thời không khả dụng. Vui lòng thử lại."
            });
        }

        // Bước 2: gán kết quả vào entity đang được EF theo dõi.
        applyResult(uploadResult);

        // Bước 3: lưu URL/publicId. Nếu SQL lỗi, xóa ảnh vừa upload để tránh file mồ côi.
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await TryDeleteImageAsync(uploadResult.PublicId, CancellationToken.None);
            throw;
        }

        // Bước 4: chỉ sau khi SQL thành công mới xóa ảnh cũ, tránh làm mất avatar đang dùng.
        if (!string.IsNullOrWhiteSpace(oldPublicId)
            && !string.Equals(
                oldPublicId,
                uploadResult.PublicId,
                StringComparison.Ordinal
            ))
        {
            await TryDeleteImageAsync(oldPublicId, CancellationToken.None);
        }

        return Ok(new
        {
            url = uploadResult.Url,
            publicId = uploadResult.PublicId
        });
    }

    /// <summary>Cố gắng xóa tài nguyên cũ; lỗi dọn dẹp không làm mất kết quả upload mới.</summary>
    /// <param name="publicId">Định danh Cloudinary, không phải URL hiển thị.</param>
    /// <returns>Task hoàn tất kể cả khi Cloudinary ném lỗi (lỗi chỉ được ghi log).</returns>
    private async Task TryDeleteImageAsync(
        string publicId,
        CancellationToken cancellationToken
    )
    {
        try
        {
            await _cloudinary.DeleteImageAsync(publicId, cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Could not delete Cloudinary image {PublicId}; cleanup will be best-effort.",
                publicId
            );
        }
    }

    /// <summary>Kiểm tra ba credential Cloudinary đã được cấu hình hay chưa.</summary>
    /// <returns>null khi sẵn sàng; HTTP 503 có hướng dẫn cấu hình khi còn thiếu.</returns>
    private ObjectResult? GetCloudinaryConfigurationError()
    {
        return _cloudinary.IsConfigured
            ? null
            : StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message =
                    "Cloudinary chưa được cấu hình. Hãy đặt Cloudinary:CloudName, Cloudinary:ApiKey và Cloudinary:ApiSecret trong User Secrets hoặc biến môi trường."
            });
    }

    /// <summary>Tìm UserAccount theo Firebase UID, fallback email và đồng bộ UID cho dữ liệu cũ.</summary>
    /// <returns>UserAccount thuộc danh tính; null nếu không tìm thấy hoặc UID đang thuộc hồ sơ khác.</returns>
    private async Task<UserAccount?> FindAndSynchronizeUserAsync(
        FirebaseIdentity identity,
        CancellationToken cancellationToken
    )
    {
        // Đường chính: UID đã đồng bộ thì tìm trực tiếp, không cần dựa vào email có thể đổi.
        var user = await _context.UserAccounts.FirstOrDefaultAsync(
            item => item.firebaseUid == identity.FirebaseUid,
            cancellationToken
        );

        if (user is not null || string.IsNullOrWhiteSpace(identity.Email))
        {
            return user;
        }

        // Đường tương thích dữ liệu cũ: tìm email claim khi firebaseUid trong SQL chưa đúng.
        var normalizedEmail = identity.Email.Trim();

        user = await _context.UserAccounts.FirstOrDefaultAsync(
            item => item.email == normalizedEmail,
            cancellationToken
        );

        if (user is null)
        {
            return null;
        }

        // Không tái gán UID nếu UID đó đã nối với một USER_ACCOUNT khác.
        var uidBelongsToAnotherUser = await _context.UserAccounts.AnyAsync(
            item =>
                item.firebaseUid == identity.FirebaseUid
                && item.userId != user.userId,
            cancellationToken
        );

        if (uidBelongsToAnotherUser)
        {
            _logger.LogWarning(
                "Firebase UID {FirebaseUid} is already linked to another PetNoVa account.",
                identity.FirebaseUid
            );
            return null;
        }

        // Đồng bộ một lần để các request sau đi theo đường UID an toàn và nhanh hơn.
        user.firebaseUid = identity.FirebaseUid;
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Synchronized Firebase UID for PetNoVa user {UserId}.",
            user.userId
        );

        return user;
    }

    /// <summary>Đọc Bearer token và xác minh danh tính qua Firebase service.</summary>
    /// <returns>IdentityResult chứa danh tính hoặc lỗi HTTP 401/503 để action trả thẳng.</returns>
    private async Task<IdentityResult> GetFirebaseIdentityAsync(
        CancellationToken cancellationToken
    )
    {
        // Parse bằng AuthenticationHeaderValue để xử lý header chuẩn thay vì tự tách chuỗi tùy ý.
        if (!AuthenticationHeaderValue.TryParse(
                Request.Headers.Authorization.ToString(),
                out var authorization
            )
            || !string.Equals(
                authorization.Scheme,
                "Bearer",
                StringComparison.OrdinalIgnoreCase
            )
            || string.IsNullOrWhiteSpace(authorization.Parameter))
        {
            return new IdentityResult(
                null,
                Unauthorized(new
                {
                    message = "Thiếu Firebase Bearer token."
                })
            );
        }

        try
        {
            // Verifier kiểm chữ ký, issuer, audience và thời hạn của Firebase ID token.
            var identity = await _firebaseTokenVerifier.VerifyAsync(
                authorization.Parameter,
                cancellationToken
            );

            return identity is null
                ? new IdentityResult(
                    null,
                    Unauthorized(new
                    {
                        message = "Firebase token không hợp lệ hoặc đã hết hạn."
                    })
                )
                : new IdentityResult(identity, null);
        }
        catch (FirebaseConfigurationException exception)
        {
            return new IdentityResult(
                null,
                StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = exception.Message
                })
            );
        }
        catch (FirebaseVerificationUnavailableException exception)
        {
            // Firebase tạm thời không truy cập được là lỗi dịch vụ 503, không quy thành token sai 401.
            _logger.LogWarning(exception, "Firebase token verification failed.");
            return new IdentityResult(
                null,
                StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = "Không thể xác minh đăng nhập lúc này. Vui lòng thử lại."
                })
            );
        }
    }

    /// <summary>Tạo đường dẫn folder Cloudinary không chứa phân đoạn nguy hiểm.</summary>
    /// <param name="segments">Các phần như users, Firebase UID, pets và petId.</param>
    /// <returns>Đường dẫn bắt đầu bằng petnova/.</returns>
    private static string BuildFolder(params string[] segments)
    {
        return "petnova/" + string.Join("/", segments.Select(SanitizePathSegment));
    }

    /// <summary>Chỉ giữ chữ ASCII, số, dấu gạch ngang/gạch dưới trong một phần đường dẫn.</summary>
    /// <returns>Chuỗi sạch hoặc "unknown" khi không còn ký tự hợp lệ.</returns>
    private static string SanitizePathSegment(string value)
    {
        // Loại dấu slash và ký tự lạ để input không thoát khỏi cấu trúc folder dự kiến.
        var sanitized = new string(
            value
                .Where(character =>
                    char.IsAsciiLetterOrDigit(character)
                    || character is '-' or '_'
                )
                .ToArray()
        );

        return string.IsNullOrWhiteSpace(sanitized) ? "unknown" : sanitized;
    }

    // Union nhỏ: mỗi lần gọi trả Identity thành công hoặc IActionResult lỗi, không trả cả hai.
    private sealed record IdentityResult(
        FirebaseIdentity? Identity,
        IActionResult? Error
    );
}
