using Microsoft.EntityFrameworkCore;

// Bộ nâng cấp schema cho số điện thoại chuẩn hóa và bảng challenge OTP.
namespace PetNoVaApi.Data;

/// <summary>Đảm bảo PetNoVaDB có đủ cấu trúc cho quên mật khẩu an toàn.</summary>
public static class PasswordResetSchemaInitializer
{
    // Bước 1: thêm cột chuẩn hóa số điện thoại nếu database cũ chưa có.
    // Keep this statement in its own batch. SQL Server compiles a batch before
    // executing it, so later references to a newly-added column would otherwise
    // fail on the first application startup.
    private const string EnsureNormalizedPhoneColumnSql = """
        IF COL_LENGTH(N'dbo.USER_ACCOUNT', N'normalizedPhone') IS NULL
        BEGIN
            ALTER TABLE [dbo].[USER_ACCOUNT]
                ADD [normalizedPhone] NVARCHAR(20) NULL;
        END;
        """;

    // Bước 2: chuẩn hóa dữ liệu cũ về +84, chỉ giữ số duy nhất và tạo unique index.
    private const string BackfillNormalizedPhonesSql = """
        ;WITH SanitizedPhones AS
        (
            SELECT
                [userId],
                [role],
                REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    LTRIM(RTRIM([phone])),
                    N' ', N''), N'-', N''), N'.', N''), N'(', N''), N')', N'') AS [cleanPhone]
            FROM [dbo].[USER_ACCOUNT]
            WHERE [normalizedPhone] IS NULL
        ),
        CanonicalPhones AS
        (
            SELECT
                [userId],
                CASE
                    WHEN [role] = N'CUSTOMER'
                         AND LEN([cleanPhone]) = 10
                         AND [cleanPhone] LIKE N'0[1-9]%'
                         AND [cleanPhone] NOT LIKE N'%[^0-9]%'
                        THEN N'+84' + SUBSTRING([cleanPhone], 2, 9)
                    WHEN [role] = N'CUSTOMER'
                         AND LEN([cleanPhone]) = 12
                         AND [cleanPhone] LIKE N'+84[1-9]%'
                         AND SUBSTRING([cleanPhone], 4, 9) NOT LIKE N'%[^0-9]%'
                        THEN [cleanPhone]
                    WHEN [role] = N'CUSTOMER'
                         AND LEN([cleanPhone]) = 11
                         AND [cleanPhone] LIKE N'84[1-9]%'
                         AND [cleanPhone] NOT LIKE N'%[^0-9]%'
                        THEN N'+' + [cleanPhone]
                    ELSE NULL
                END AS [normalizedPhone]
            FROM SanitizedPhones
        ),
        UniquePhones AS
        (
            SELECT
                [userId],
                [normalizedPhone],
                COUNT(*) OVER (PARTITION BY [normalizedPhone]) AS [phoneCount]
            FROM CanonicalPhones
            WHERE [normalizedPhone] IS NOT NULL
        )
        UPDATE account
        SET account.[normalizedPhone] = candidate.[normalizedPhone]
        FROM [dbo].[USER_ACCOUNT] account
        INNER JOIN UniquePhones candidate ON candidate.[userId] = account.[userId]
        WHERE candidate.[phoneCount] = 1
          AND NOT EXISTS
          (
              SELECT 1
              FROM [dbo].[USER_ACCOUNT] existing
              WHERE existing.[normalizedPhone] = candidate.[normalizedPhone]
                AND existing.[userId] <> candidate.[userId]
          );

        IF NOT EXISTS
        (
            SELECT 1
            FROM sys.indexes
            WHERE [name] = N'UX_USER_ACCOUNT_normalizedPhone'
              AND [object_id] = OBJECT_ID(N'dbo.USER_ACCOUNT')
        )
        BEGIN
            CREATE UNIQUE INDEX [UX_USER_ACCOUNT_normalizedPhone]
                ON [dbo].[USER_ACCOUNT] ([normalizedPhone])
                WHERE [normalizedPhone] IS NOT NULL;
        END;
        """;

    // Bước 3: tạo bảng lưu OTP dạng hash, thời hạn, lượt thử và reset token dùng một lần.
    private const string EnsurePasswordResetChallengeSql = """
        IF OBJECT_ID(N'dbo.PASSWORD_RESET_CHALLENGE', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PASSWORD_RESET_CHALLENGE]
            (
                [challengeId] UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT [PK_PASSWORD_RESET_CHALLENGE] PRIMARY KEY,
                [userId] NVARCHAR(50) NOT NULL,
                [firebaseUid] NVARCHAR(128) NOT NULL,
                [email] NVARCHAR(320) NOT NULL,
                [normalizedPhone] NVARCHAR(20) NOT NULL,
                [otpHash] VARBINARY(32) NOT NULL,
                [expiresAt] DATETIME2 NOT NULL,
                [attemptCount] INT NOT NULL
                    CONSTRAINT [DF_PASSWORD_RESET_ATTEMPTS] DEFAULT 0,
                [resendAvailableAt] DATETIME2 NOT NULL,
                [verifiedAt] DATETIME2 NULL,
                [resetTokenHash] VARBINARY(32) NULL,
                [resetTokenExpiresAt] DATETIME2 NULL,
                [consumedAt] DATETIME2 NULL,
                [createdAt] DATETIME2 NOT NULL,
                [rowVersion] ROWVERSION NOT NULL
            );
        END;
        """;

    // Bước 4: tạo index phục vụ truy vấn challenge mới nhất và chặn hai challenge đang hoạt động.
    private const string EnsurePasswordResetIndexesSql = """
        IF NOT EXISTS
        (
            SELECT 1
            FROM sys.indexes
            WHERE [name] = N'IX_PASSWORD_RESET_CHALLENGE_userId_createdAt'
              AND [object_id] = OBJECT_ID(N'dbo.PASSWORD_RESET_CHALLENGE')
        )
        BEGIN
            CREATE INDEX [IX_PASSWORD_RESET_CHALLENGE_userId_createdAt]
                ON [dbo].[PASSWORD_RESET_CHALLENGE] ([userId], [createdAt]);
        END;

        IF NOT EXISTS
        (
            SELECT 1
            FROM sys.indexes
            WHERE [name] = N'UX_PASSWORD_RESET_CHALLENGE_active_user'
              AND [object_id] = OBJECT_ID(N'dbo.PASSWORD_RESET_CHALLENGE')
        )
        BEGIN
            CREATE UNIQUE INDEX [UX_PASSWORD_RESET_CHALLENGE_active_user]
                ON [dbo].[PASSWORD_RESET_CHALLENGE] ([userId])
                WHERE [consumedAt] IS NULL;
        END;
        """;

    /// <summary>Thực thi migration SQL có thể chạy lặp lại khi API khởi động.</summary>
    /// <param name="services">Service provider gốc dùng để tạo scope và lấy DbContext.</param>
    /// <param name="cancellationToken">Cho phép hủy quá trình khởi tạo khi API dừng.</param>
    /// <returns>Task hoàn tất sau khi cả bốn khối schema đã chạy thành công.</returns>
    public static async Task InitializeAsync(
        IServiceProvider services,
        CancellationToken cancellationToken = default
    )
    {
        // Tạo scope riêng vì DbContext là scoped service, không được giữ ở singleton initializer.
        await using var scope = services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<PetNoVaDbContext>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger(nameof(PasswordResetSchemaInitializer));

        logger.LogInformation("Ensuring password reset schema exists in PetNoVaDB.");
        // Chạy đúng thứ tự: cột phải tồn tại trước khi backfill và tạo index tham chiếu cột đó.
        await context.Database.ExecuteSqlRawAsync(
            EnsureNormalizedPhoneColumnSql,
            cancellationToken
        );
        await context.Database.ExecuteSqlRawAsync(
            BackfillNormalizedPhonesSql,
            cancellationToken
        );
        await context.Database.ExecuteSqlRawAsync(
            EnsurePasswordResetChallengeSql,
            cancellationToken
        );
        await context.Database.ExecuteSqlRawAsync(
            EnsurePasswordResetIndexesSql,
            cancellationToken
        );
    }
}
