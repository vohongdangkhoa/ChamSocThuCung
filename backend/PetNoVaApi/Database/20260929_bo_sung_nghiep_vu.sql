-- Nâng cấp bổ sung, giữ lại dữ liệu và các quan hệ hiện có.
IF COL_LENGTH('dbo.PET', 'isArchived') IS NULL
    ALTER TABLE dbo.PET ADD isArchived bit NOT NULL CONSTRAINT DF_PET_ARCHIVED DEFAULT(0);
IF COL_LENGTH('dbo.BOOKING', 'requestId') IS NULL
    ALTER TABLE dbo.BOOKING ADD requestId nvarchar(80) NULL;
IF COL_LENGTH('dbo.BOOKING', 'durationMinutes') IS NULL
    ALTER TABLE dbo.BOOKING ADD durationMinutes int NOT NULL CONSTRAINT DF_BOOKING_DURATION DEFAULT(30);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_BOOKING_REQUEST' AND object_id=OBJECT_ID('dbo.BOOKING'))
    EXEC('CREATE UNIQUE INDEX UX_BOOKING_REQUEST ON dbo.BOOKING(userId,requestId) WHERE requestId IS NOT NULL');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_BOOKING_SCHEDULE' AND object_id=OBJECT_ID('dbo.BOOKING'))
    CREATE INDEX IX_BOOKING_SCHEDULE ON dbo.BOOKING(bookingDate,status,staffId) INCLUDE(petId,bookingTime);
IF COL_LENGTH('dbo.PAYMENT', 'refundReason') IS NULL
    ALTER TABLE dbo.PAYMENT ADD refundReason nvarchar(500) NULL, refundReference nvarchar(200) NULL,
        refundedAt datetime2 NULL, refundedBy nvarchar(128) NULL;
IF COL_LENGTH('dbo.MEDICAL_RECORD', 'prescription') IS NULL
    ALTER TABLE dbo.MEDICAL_RECORD ADD prescription nvarchar(2000) NULL, followUpDate datetime2 NULL, weight decimal(6,2) NULL;
ALTER TABLE dbo.MEDICAL_RECORD ALTER COLUMN treatment nvarchar(2000) NOT NULL;
ALTER TABLE dbo.MEDICAL_RECORD ALTER COLUMN note nvarchar(2000) NULL;
IF COL_LENGTH('dbo.SERVICE_CATEGORY', 'status') IS NULL
    ALTER TABLE dbo.SERVICE_CATEGORY ADD status varchar(20) NOT NULL CONSTRAINT DF_CATEGORY_STATUS DEFAULT('ACTIVE');
IF OBJECT_ID('dbo.PETNOVA_AUDIT') IS NULL
    CREATE TABLE dbo.PETNOVA_AUDIT(id bigint IDENTITY PRIMARY KEY, userId nvarchar(128) NOT NULL,
        actorName nvarchar(256) NOT NULL, role nvarchar(20) NOT NULL, action nvarchar(256) NOT NULL,
        targetId nvarchar(128) NULL, createdAt datetime2 NOT NULL);
IF OBJECT_ID('dbo.PETNOVA_CLINICAL_REVISION') IS NULL
    CREATE TABLE dbo.PETNOVA_CLINICAL_REVISION(id bigint IDENTITY PRIMARY KEY, entityType nvarchar(32) NOT NULL,
        entityId nvarchar(32) NOT NULL, oldData nvarchar(max) NOT NULL, reason nvarchar(500) NOT NULL,
        userId nvarchar(32) NOT NULL, createdAt datetime2 NOT NULL);
IF OBJECT_ID('dbo.PETNOVA_SEQUENCE') IS NULL
    CREATE TABLE dbo.PETNOVA_SEQUENCE(tableName nvarchar(128) PRIMARY KEY, lastValue bigint NOT NULL);
