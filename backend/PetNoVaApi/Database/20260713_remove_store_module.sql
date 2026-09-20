-- Migration loại bỏ module bán sản phẩm cũ, giữ lại PetNoVa tập trung dịch vụ chăm sóc.
-- Toàn bộ thay đổi nằm trong transaction và XACT_ABORT để tránh schema dở dang.
USE PetNoVaDB;
GO

SET XACT_ABORT ON;
GO

-- Bắt đầu transaction để mọi cập nhật/xóa schema cùng thành công hoặc cùng rollback.
BEGIN TRANSACTION;

-- Hoàn nguyên payment gộp về tiền dịch vụ trước khi xóa đơn sản phẩm.
IF COL_LENGTH('dbo.PAYMENT', 'paymentType') IS NOT NULL
BEGIN
    IF OBJECT_ID('dbo.PRODUCT_ORDER', 'U') IS NOT NULL
    BEGIN
        -- Với COMBINED, trừ phần tiền sản phẩm để giữ lại đúng tiền dịch vụ trong PAYMENT.
        UPDATE payment
        SET payment.amount = CASE
                WHEN payment.paymentType = 'COMBINED'
                    THEN payment.amount - ISNULL(productOrder.totalAmount, 0)
                ELSE payment.amount
            END,
            payment.orderId = NULL,
            payment.paymentType = 'SERVICE'
        FROM dbo.PAYMENT AS payment
        LEFT JOIN dbo.PRODUCT_ORDER AS productOrder
            ON productOrder.orderId = payment.orderId
        WHERE payment.paymentType = 'COMBINED';
    END;

    -- Giao dịch chỉ mua sản phẩm không còn ý nghĩa sau khi bỏ module cửa hàng.
    DELETE FROM dbo.PAYMENT WHERE paymentType = 'PRODUCT';
    UPDATE dbo.PAYMENT SET orderId = NULL, paymentType = 'SERVICE';
END;

-- Phải gỡ FK/check/index phụ thuộc trước khi DROP các cột orderId/paymentType.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PAYMENT_PRODUCT_ORDER')
    ALTER TABLE dbo.PAYMENT DROP CONSTRAINT FK_PAYMENT_PRODUCT_ORDER;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PAYMENT_ORDER_LOGIC')
    ALTER TABLE dbo.PAYMENT DROP CONSTRAINT CK_PAYMENT_ORDER_LOGIC;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PAYMENT_TYPE')
    ALTER TABLE dbo.PAYMENT DROP CONSTRAINT CK_PAYMENT_TYPE;

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_PAYMENT_orderId' AND object_id = OBJECT_ID('dbo.PAYMENT')
)
    DROP INDEX IX_PAYMENT_orderId ON dbo.PAYMENT;

-- Tên default constraint do SQL Server có thể sinh tự động nên cần tra catalog rồi chạy SQL động.
DECLARE @paymentTypeDefault sysname;
SELECT @paymentTypeDefault = defaultConstraint.name
FROM sys.default_constraints AS defaultConstraint
JOIN sys.columns AS columnInfo
    ON columnInfo.default_object_id = defaultConstraint.object_id
WHERE defaultConstraint.parent_object_id = OBJECT_ID('dbo.PAYMENT')
  AND columnInfo.name = 'paymentType';

IF @paymentTypeDefault IS NOT NULL
BEGIN
    DECLARE @dropPaymentTypeDefault nvarchar(500) =
        N'ALTER TABLE dbo.PAYMENT DROP CONSTRAINT ' + QUOTENAME(@paymentTypeDefault);
    EXEC sys.sp_executesql @dropPaymentTypeDefault;
END

-- Sau khi gỡ hết dependency, loại hai cột thuộc module sản phẩm khỏi PAYMENT.
IF COL_LENGTH('dbo.PAYMENT', 'orderId') IS NOT NULL
    ALTER TABLE dbo.PAYMENT DROP COLUMN orderId;

IF COL_LENGTH('dbo.PAYMENT', 'paymentType') IS NOT NULL
    ALTER TABLE dbo.PAYMENT DROP COLUMN paymentType;

-- Xóa bảng con trước bảng cha để không vi phạm khóa ngoại còn tồn tại giữa các bảng cửa hàng.
IF OBJECT_ID('dbo.CART_ITEM', 'U') IS NOT NULL DROP TABLE dbo.CART_ITEM;
IF OBJECT_ID('dbo.ORDER_DETAIL', 'U') IS NOT NULL DROP TABLE dbo.ORDER_DETAIL;
IF OBJECT_ID('dbo.CART', 'U') IS NOT NULL DROP TABLE dbo.CART;
IF OBJECT_ID('dbo.PRODUCT_ORDER', 'U') IS NOT NULL DROP TABLE dbo.PRODUCT_ORDER;
IF OBJECT_ID('dbo.PRODUCT', 'U') IS NOT NULL DROP TABLE dbo.PRODUCT;
IF OBJECT_ID('dbo.PRODUCT_CATEGORY', 'U') IS NOT NULL DROP TABLE dbo.PRODUCT_CATEGORY;

-- Chỉ commit sau khi toàn bộ dữ liệu và schema đã được chuyển đổi thành công.
COMMIT TRANSACTION;
GO
