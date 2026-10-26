using Microsoft.EntityFrameworkCore;

namespace PetNoVaApi.Data;

public static class ThanhToanSchemaInitializer
{
    public static async Task EnsureAsync(PetNoVaDbContext db, CancellationToken cancellationToken = default)
    {
        await using var stream = typeof(ThanhToanSchemaInitializer).Assembly.GetManifestResourceStream(
            "PetNoVaApi.Database.20261026_payment_retry_history.sql")
            ?? throw new InvalidOperationException("Thiếu SQL nâng cấp lịch sử thanh toán.");
        using var reader = new StreamReader(stream);
        await db.Database.ExecuteSqlRawAsync(await reader.ReadToEndAsync(cancellationToken), cancellationToken);
    }

    public static async Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        await EnsureAsync(scope.ServiceProvider.GetRequiredService<PetNoVaDbContext>(), cancellationToken);
    }
}
