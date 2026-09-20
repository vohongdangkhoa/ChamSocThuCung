// Kiểm tra ảnh bằng byte signature thay vì chỉ tin tên file/content type từ client.
namespace PetNoVaApi.Services;

/// <summary>Bảo vệ endpoint upload khỏi file quá lớn hoặc giả dạng ảnh.</summary>
public static class ImageUploadValidator
{
    // Giới hạn 5 MB cân bằng chất lượng avatar với thời gian upload trên di động.
    public const long MaxFileSize = 5 * 1024 * 1024;

    /// <summary>Đọc header, xác định JPEG/PNG/WebP và trả stream đã tua về đầu.</summary>
    public static async Task<ImageValidationResult> ValidateAsync(
        IFormFile? file,
        CancellationToken cancellationToken = default
    )
    {
        // Kiểm tra rỗng trước khi mở stream để trả lỗi 400 rõ ràng.
        if (file is null || file.Length == 0)
        {
            return ImageValidationResult.Failure(
                StatusCodes.Status400BadRequest,
                "Vui lòng chọn một ảnh để tải lên."
            );
        }

        // Từ chối sớm theo metadata kích thước, tránh đọc file lớn vào server.
        if (file.Length > MaxFileSize)
        {
            return ImageValidationResult.Failure(
                StatusCodes.Status413PayloadTooLarge,
                "Ảnh không được vượt quá 5 MB."
            );
        }

        // 12 byte đầu đủ nhận diện ba định dạng JPEG, PNG và WebP.
        var header = new byte[12];
        int bytesRead;

        await using (var stream = file.OpenReadStream())
        {
            bytesRead = await stream.ReadAsync(header.AsMemory(0, header.Length), cancellationToken);
        }

        // MIME phát hiện từ nội dung thật đáng tin hơn file.ContentType do client gửi.
        var detectedContentType = DetectContentType(header, bytesRead);

        if (detectedContentType is null)
        {
            return ImageValidationResult.Failure(
                StatusCodes.Status415UnsupportedMediaType,
                "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP hợp lệ."
            );
        }

        // application/octet-stream được chấp nhận vì một số picker không khai báo MIME cụ thể.
        var declaredContentType = NormalizeContentType(file.ContentType);
        var hasSpecificDeclaredType =
            !string.IsNullOrWhiteSpace(declaredContentType)
            && !declaredContentType.Equals(
                "application/octet-stream",
                StringComparison.OrdinalIgnoreCase
            );

        // Nếu client đã khai báo loại cụ thể thì loại đó phải khớp magic bytes.
        if (hasSpecificDeclaredType
            && !declaredContentType.Equals(
                detectedContentType,
                StringComparison.OrdinalIgnoreCase
            ))
        {
            return ImageValidationResult.Failure(
                StatusCodes.Status415UnsupportedMediaType,
                "Content-Type không khớp với nội dung thật của ảnh."
            );
        }

        return ImageValidationResult.Success(detectedContentType);
    }

    /// <summary>Chuẩn hóa MIME type về giá trị server hỗ trợ.</summary>
    public static string NormalizeContentType(string? contentType)
    {
        // Bỏ tham số sau dấu chấm phẩy, trim rồi chuyển về chữ thường để so sánh ổn định.
        return (contentType ?? string.Empty)
            .Split(';', 2, StringSplitOptions.TrimEntries)[0]
            .ToLowerInvariant();
    }

    /// <summary>Tạo tên file ngẫu nhiên với phần mở rộng đúng loại ảnh.</summary>
    public static string GetSafeFileName(string? contentType)
    {
        // Không dùng tên file gốc của người dùng để tránh path traversal/ký tự nguy hiểm.
        return NormalizeContentType(contentType) switch
        {
            "image/jpeg" => "upload.jpg",
            "image/png" => "upload.png",
            "image/webp" => "upload.webp",
            _ => "upload.bin"
        };
    }

    /// <summary>Nhận diện loại ảnh từ magic bytes đầu file.</summary>
    private static string? DetectContentType(byte[] header, int bytesRead)
    {
        // JPEG bắt đầu bằng FF D8 FF.
        if (bytesRead >= 3
            && header.AsSpan(0, 3).SequenceEqual(
                new byte[] { 0xFF, 0xD8, 0xFF }
            ))
        {
            return "image/jpeg";
        }

        // PNG có chữ ký cố định tám byte.
        if (bytesRead >= 8
            && header.AsSpan(0, 8).SequenceEqual(
                new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }
            ))
        {
            return "image/png";
        }

        // WebP nằm trong container RIFF và có nhãn WEBP ở offset 8.
        if (bytesRead >= 12
            && header.AsSpan(0, 4).SequenceEqual("RIFF"u8)
            && header.AsSpan(8, 4).SequenceEqual("WEBP"u8))
        {
            return "image/webp";
        }

        return null;
    }
}

/// <summary>Kết quả hợp lệ gồm stream, tên file an toàn và MIME thật.</summary>
public sealed record ImageValidationResult(
    bool IsValid,
    string? ContentType,
    int StatusCode,
    string? ErrorMessage
)
{
    /// <summary>Tạo kết quả hợp lệ kèm MIME type đã phát hiện.</summary>
    public static ImageValidationResult Success(string contentType) =>
        new(true, contentType, StatusCodes.Status200OK, null);

    /// <summary>Tạo kết quả lỗi để controller trả đúng HTTP status và thông báo.</summary>
    public static ImageValidationResult Failure(int statusCode, string errorMessage) =>
        new(false, null, statusCode, errorMessage);
}
