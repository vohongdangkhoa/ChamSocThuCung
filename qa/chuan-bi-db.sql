-- Tạo bản sao kiểm thử có cấu trúc/ràng buộc giống database thật.
-- Không có WITH REPLACE, không ghi đè database/file đã tồn tại.
USE master;
SET NOCOUNT ON;
IF DB_ID(N'PetNoVaDB_QA_20261026') IS NOT NULL
    THROW 51000, 'Database QA da ton tai; khong tu dong ghi de.', 1;
DECLARE @backupFolder nvarchar(4000) = CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultBackupPath'));
DECLARE @dataFolder nvarchar(4000) = CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultDataPath'));
DECLARE @logFolder nvarchar(4000) = CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultLogPath'));
IF @backupFolder IS NULL OR @dataFolder IS NULL OR @logFolder IS NULL
    THROW 51001, 'Khong doc duoc thu muc SQL Server.', 1;
SET @backupFolder += CASE WHEN RIGHT(@backupFolder,1)=N'\' THEN N'' ELSE N'\' END;
SET @dataFolder += CASE WHEN RIGHT(@dataFolder,1)=N'\' THEN N'' ELSE N'\' END;
SET @logFolder += CASE WHEN RIGHT(@logFolder,1)=N'\' THEN N'' ELSE N'\' END;
DECLARE @backupFile nvarchar(4000) = @backupFolder + N'PetNoVaDB_QA_' +
    REPLACE(REPLACE(REPLACE(CONVERT(nvarchar(30), GETDATE(), 126),N':',N''),N'-',N''),N'.',N'') + N'.bak';
BEGIN TRY
BACKUP DATABASE PetNoVaDB TO DISK = @backupFile WITH COPY_ONLY, CHECKSUM;
DECLARE @move nvarchar(max);
SELECT @move = STRING_AGG(CONVERT(nvarchar(max), N'MOVE N''' + REPLACE(name,N'''',N'''''') + N''' TO N''' +
    REPLACE(CASE WHEN type=1 THEN @logFolder ELSE @dataFolder END + N'PetNoVaDB_QA_20261026_' +
    CONVERT(nvarchar(10), file_id) + CASE WHEN type=1 THEN N'.ldf' ELSE N'.mdf' END,N'''',N'''''') + N''''), N', ')
FROM sys.master_files WHERE database_id = DB_ID(N'PetNoVaDB');
DECLARE @restore nvarchar(max) = N'RESTORE DATABASE PetNoVaDB_QA_20261026 FROM DISK = N''' +
    REPLACE(@backupFile,N'''',N'''''') + N''' WITH ' + @move + N', RECOVERY, CHECKSUM;';
EXEC (@restore);
SELECT N'PetNoVaDB_QA_20261026' AS test_database, @backupFile AS copy_only_backup;
END TRY
BEGIN CATCH
    THROW;
END CATCH;
