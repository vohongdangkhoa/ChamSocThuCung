-- Migration chuẩn hóa số điện thoại và tạo bảng challenge cho luồng OTP an toàn.
-- Các câu IF NOT EXISTS làm migration có thể chạy nhiều lần khi triển khai.
IF COL_LENGTH(N'dbo.USER_ACCOUNT', N'normalizedPhone') IS NULL
BEGIN
    -- Cột nullable giữ tương thích hồ sơ cũ/số không chuẩn; code mới ghi dạng +84.
    ALTER TABLE [dbo].[USER_ACCOUNT]
        ADD [normalizedPhone] NVARCHAR(20) NULL;
END;
GO

-- Chuyển số hiện có về dạng so sánh thống nhất trước khi tạo unique index.
;WITH SanitizedPhones AS
(
    -- Bỏ khoảng trắng và dấu trình bày, chưa thay đổi dữ liệu gốc ở cột phone.
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
    -- Chỉ chuẩn hóa CUSTOMER và ba dạng 0..., +84..., 84... hợp lệ.
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
    -- Đếm trùng để không tự gán cùng số chuẩn hóa cho nhiều tài khoản cũ.
    SELECT
        [userId],
        [normalizedPhone],
        COUNT(*) OVER (PARTITION BY [normalizedPhone]) AS [phoneCount]
    FROM CanonicalPhones
    WHERE [normalizedPhone] IS NOT NULL
)
UPDATE account
-- Chỉ backfill ứng viên duy nhất và chưa xung đột với giá trị đã có.
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
GO

-- OTP và reset token chỉ được lưu dưới dạng hash kèm hạn dùng/số lần thử.
IF OBJECT_ID(N'dbo.PASSWORD_RESET_CHALLENGE', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PASSWORD_RESET_CHALLENGE]
    (
        -- challengeId được Flutter gửi qua ba bước nhưng không phải secret.
        [challengeId] UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT [PK_PASSWORD_RESET_CHALLENGE] PRIMARY KEY,
        [userId] NVARCHAR(50) NOT NULL,
        [firebaseUid] NVARCHAR(128) NOT NULL,
        [email] NVARCHAR(320) NOT NULL,
        [normalizedPhone] NVARCHAR(20) NOT NULL,
        -- HMAC-SHA256 dài 32 byte; OTP dạng rõ không bao giờ lưu trong DB.
        [otpHash] VARBINARY(32) NOT NULL,
        [expiresAt] DATETIME2 NOT NULL,
        [attemptCount] INT NOT NULL
            CONSTRAINT [DF_PASSWORD_RESET_ATTEMPTS] DEFAULT 0,
        [resendAvailableAt] DATETIME2 NOT NULL,
        -- verifiedAt mở bước reset; consumedAt đóng vĩnh viễn challenge sau khi dùng.
        [verifiedAt] DATETIME2 NULL,
        [resetTokenHash] VARBINARY(32) NULL,
        [resetTokenExpiresAt] DATETIME2 NULL,
        [consumedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NOT NULL,
        -- rowVersion phát hiện hai request đồng thời cố dùng cùng OTP/token.
        [rowVersion] ROWVERSION NOT NULL
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_USER_ACCOUNT_normalizedPhone'
      AND [object_id] = OBJECT_ID(N'dbo.USER_ACCOUNT')
)
BEGIN
    -- Unique filtered index bảo đảm một số chuẩn hóa không thuộc hai tài khoản.
    CREATE UNIQUE INDEX [UX_USER_ACCOUNT_normalizedPhone]
        ON [dbo].[USER_ACCOUNT] ([normalizedPhone])
        WHERE [normalizedPhone] IS NOT NULL;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_PASSWORD_RESET_CHALLENGE_userId_createdAt'
      AND [object_id] = OBJECT_ID(N'dbo.PASSWORD_RESET_CHALLENGE')
)
BEGIN
    -- Index này tăng tốc truy vấn/dọn các challenge mới nhất theo user.
    CREATE INDEX [IX_PASSWORD_RESET_CHALLENGE_userId_createdAt]
        ON [dbo].[PASSWORD_RESET_CHALLENGE] ([userId], [createdAt]);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_PASSWORD_RESET_CHALLENGE_active_user'
      AND [object_id] = OBJECT_ID(N'dbo.PASSWORD_RESET_CHALLENGE')
)
BEGIN
    -- Mỗi user chỉ có một challenge chưa consumed, hạn chế gửi OTP đồng thời.
    CREATE UNIQUE INDEX [UX_PASSWORD_RESET_CHALLENGE_active_user]
        ON [dbo].[PASSWORD_RESET_CHALLENGE] ([userId])
        WHERE [consumedAt] IS NULL;
END;
GO
