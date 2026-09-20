using Microsoft.EntityFrameworkCore;

// Bộ nâng cấp schema bổ sung cột URL/publicId ảnh mà không cần EF migration đầy đủ.
namespace PetNoVaApi.Data;

/// <summary>Kiểm tra và thêm các cột Cloudinary còn thiếu khi backend khởi động.</summary>
public static class MediaSchemaInitializer
{
    // SQL idempotent: COL_LENGTH giúp mỗi ALTER TABLE chỉ chạy khi cột thật sự còn thiếu.
    private const string AddMediaColumnsSql = """
        IF COL_LENGTH(N'dbo.USER_ACCOUNT', N'avatarUrl') IS NULL
        BEGIN
            ALTER TABLE [dbo].[USER_ACCOUNT]
                ADD [avatarUrl] NVARCHAR(2048) NULL;
        END;

        IF COL_LENGTH(N'dbo.USER_ACCOUNT', N'avatarPublicId') IS NULL
        BEGIN
            ALTER TABLE [dbo].[USER_ACCOUNT]
                ADD [avatarPublicId] NVARCHAR(512) NULL;
        END;

        IF COL_LENGTH(N'dbo.PET', N'imageUrl') IS NULL
        BEGIN
            ALTER TABLE [dbo].[PET]
                ADD [imageUrl] NVARCHAR(2048) NULL;
        END;

        IF COL_LENGTH(N'dbo.PET', N'imagePublicId') IS NULL
        BEGIN
            ALTER TABLE [dbo].[PET]
                ADD [imagePublicId] NVARCHAR(512) NULL;
        END;
        """;

    /// <summary>Chạy lệnh SQL idempotent trong scope DbContext riêng.</summary>
    /// <param name="services">Service provider dùng để lấy PetNoVaDbContext và logger.</param>
    /// <param name="cancellationToken">Dừng câu lệnh nếu tiến trình API bị hủy.</param>
    /// <returns>Task hoàn tất khi bốn cột URL/publicId đã tồn tại.</returns>
    public static async Task InitializeAsync(
        IServiceProvider services,
        CancellationToken cancellationToken = default
    )
    {
        // Scope tạm bảo đảm DbContext được dispose ngay sau khi kiểm tra schema.
        await using var scope = services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<PetNoVaDbContext>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger(nameof(MediaSchemaInitializer));

        logger.LogInformation("Ensuring nullable media columns exist in PetNoVaDB.");
        // ExecuteSqlRawAsync phù hợp vì đây là DDL cố định, không nhận dữ liệu từ người dùng.
        await context.Database.ExecuteSqlRawAsync(
            AddMediaColumnsSql,
            cancellationToken
        );
    }
}
