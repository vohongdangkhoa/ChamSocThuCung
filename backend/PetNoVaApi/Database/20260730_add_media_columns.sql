-- Migration idempotent bổ sung cặp URL/publicId Cloudinary cho tài khoản và thú cưng.
-- COL_LENGTH giúp script chạy lại an toàn mà không báo cột đã tồn tại.
IF COL_LENGTH(N'dbo.USER_ACCOUNT', N'avatarUrl') IS NULL
BEGIN
    -- URL HTTPS có thể dài do Cloudinary transformation nên cấp tối đa 2048 ký tự.
    ALTER TABLE [dbo].[USER_ACCOUNT]
        ADD [avatarUrl] NVARCHAR(2048) NULL;
END;
GO

IF COL_LENGTH(N'dbo.USER_ACCOUNT', N'avatarPublicId') IS NULL
BEGIN
    -- publicId không hiển thị cho người dùng; backend dùng để thay/xóa ảnh cũ.
    ALTER TABLE [dbo].[USER_ACCOUNT]
        ADD [avatarPublicId] NVARCHAR(512) NULL;
END;
GO

-- Hai cột dưới lưu ảnh riêng của từng PET.
IF COL_LENGTH(N'dbo.PET', N'imageUrl') IS NULL
BEGIN
    -- Cho phép NULL để hồ sơ cũ tiếp tục dùng avatar dấu chân mặc định.
    ALTER TABLE [dbo].[PET]
        ADD [imageUrl] NVARCHAR(2048) NULL;
END;
GO

IF COL_LENGTH(N'dbo.PET', N'imagePublicId') IS NULL
BEGIN
    -- Lưu publicId riêng từng pet, không dùng chung với avatar chủ nuôi.
    ALTER TABLE [dbo].[PET]
        ADD [imagePublicId] NVARCHAR(512) NULL;
END;
GO
