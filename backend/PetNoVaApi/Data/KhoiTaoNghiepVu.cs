using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Services;
namespace PetNoVaApi.Data;

public static class KhoiTaoNghiepVu
{
    public static async Task InitializeAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<PetNoVaDbContext>();
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("EXEC sp_getapplock @Resource='PetNova:schema', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000");
            using var stream = typeof(KhoiTaoNghiepVu).Assembly.GetManifestResourceStream("PetNoVaApi.Database.20260929_bo_sung_nghiep_vu.sql")!;
            using var reader = new StreamReader(stream);
            await db.Database.ExecuteSqlRawAsync(await reader.ReadToEndAsync());
            foreach (var entry in MaDinhDanh.Tables)
            {
                // Tên bảng/cột lấy từ danh sách cố định trong mã nguồn, không nhận đầu vào người dùng.
                var sql = $"""
                    IF NOT EXISTS (SELECT 1 FROM dbo.PETNOVA_SEQUENCE WHERE tableName=N'{entry.Table}')
                    INSERT dbo.PETNOVA_SEQUENCE(tableName,lastValue)
                    SELECT N'{entry.Table}', COALESCE(MAX(TRY_CONVERT(bigint,SUBSTRING([{entry.Column}],PATINDEX('%[0-9]%',[{entry.Column}]),20))),0)
                    FROM dbo.[{entry.Table}];
                    """;
                await db.Database.ExecuteSqlRawAsync(sql);
            }
            await tx.CommitAsync();
        });
    }
}
