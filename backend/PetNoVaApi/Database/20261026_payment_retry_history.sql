-- Một lịch cần giữ lịch sử FAILED/REFUNDED và có thể tạo lần thanh toán mới.
-- Giữ ràng buộc tối đa một PENDING, thay unique bookingId cũ vốn chặn mọi retry.
IF OBJECT_ID(N'dbo.PAYMENT', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.PAYMENT') AND name=N'UX_PAYMENT_BOOKING_PENDING')
        CREATE UNIQUE INDEX UX_PAYMENT_BOOKING_PENDING ON dbo.PAYMENT(bookingId) WHERE status='PENDING';

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.PAYMENT') AND name=N'UQ_PAYMENT_BOOKING')
        ALTER TABLE dbo.PAYMENT DROP CONSTRAINT UQ_PAYMENT_BOOKING;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.PAYMENT') AND name=N'IX_PAYMENT_BOOKING_HISTORY')
        CREATE INDEX IX_PAYMENT_BOOKING_HISTORY ON dbo.PAYMENT(bookingId);
END;
