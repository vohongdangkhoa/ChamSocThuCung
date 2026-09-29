using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PetNoVaApi.Data;

namespace PetNoVaApi.Services;

/// <summary>Bộ đếm nguyên tử trong SQL Server, không phụ thuộc số lượng bản ghi còn tồn tại.</summary>
public static class MaDinhDanh
{
    public static readonly (string Table, string Column, string Prefix)[] Tables =
    [ ("USER_ACCOUNT","userId","U"), ("STAFF","staffId","ST"), ("PET","petId","P"),
      ("BOOKING","bookingId","B"), ("BOOKING_DETAIL","detailId","BD"), ("PAYMENT","paymentId","PM"),
      ("NOTIFICATION","notificationId","N"), ("MEDICAL_RECORD","recordId","MR"),
      ("VACCINATION","vaccinationId","V"), ("SERVICE_PACKAGE","serviceId","SV"),
      ("SERVICE_CATEGORY","categoryId","DM") ];

    public static async Task<string> NextAsync(PetNoVaDbContext db, string table, string column, string prefix,
        CancellationToken ct = default)
    {
        if (!Tables.Any(t => t.Table == table && t.Column == column))
            throw new ArgumentException("Bảng không có trong danh sách cấp mã.");
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose) await connection.OpenAsync(ct);
        try
        {
            await using var command = connection.CreateCommand();
            command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
            command.CommandText = "UPDATE dbo.PETNOVA_SEQUENCE WITH (UPDLOCK) SET lastValue=lastValue+1 OUTPUT INSERTED.lastValue WHERE tableName=@table";
            var parameter = command.CreateParameter(); parameter.ParameterName = "@table"; parameter.Value = table;
            command.Parameters.Add(parameter);
            var number = await command.ExecuteScalarAsync(ct) ?? throw new InvalidOperationException("Chưa khởi tạo bộ cấp mã.");
            return prefix + Convert.ToInt64(number).ToString("D3");
        }
        finally { if (shouldClose) await connection.CloseAsync(); }
    }
}
