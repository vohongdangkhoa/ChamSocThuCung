using System.Reflection;
using System.Text.Json;
using FirebaseAdmin.Auth;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Primitives;
using PetNoVaApi.Services;

// Chạy offline: cấu hình sentinel ném lỗi nếu code cố đọc credential.
// Không đọc User Secrets, không dùng SQL, SMTP hoặc Firebase thật.
if (args.Length is < 1 or > 2)
{
    Console.Error.WriteLine("Usage: dotnet run --project qa/kiem-tra-mat-khau -- qa/mat-khau-cases.json [results.json]");
    return 2;
}

var cases = JsonSerializer.Deserialize<PasswordCase[]>(File.ReadAllText(args[0]),
    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
    ?? throw new InvalidOperationException("Fixture phải là danh sách ca kiểm thử.");
if (cases.Length == 0 || cases.Any(item => string.IsNullOrWhiteSpace(item.Id)) ||
    cases.Select(item => item.Id).Distinct(StringComparer.Ordinal).Count() != cases.Length)
    throw new InvalidOperationException("Fixture phải có mã ca duy nhất và không được rỗng.");

var results = new List<CheckResult>();
void Record(string id, string kind, bool pass, string? error = null)
{
    results.Add(new(id, kind, pass ? "PASS" : "FAIL", error));
    Console.WriteLine($"{results[^1].Status} {kind}/{id}" + (error is null ? "" : $": {error}"));
}

Record("length-constants", "contract", QuyTacMatKhau.MinLength == 12 && QuyTacMatKhau.MaxLength == 128);
foreach (var item in cases)
{
    var message = QuyTacMatKhau.KiemTra(item.Password);
    Record(item.Id, "validator", (message is null) == item.Valid,
        (message is null) == item.Valid ? null : "Kết quả không khớp fixture chung JS/C#.");
}

var deniedConfig = new DeniedConfiguration();
var manager = new FirebasePasswordManager(deniedConfig, NullLogger<FirebasePasswordManager>.Instance);
// DbContext/email bằng null là sentinel: chạm vào chúng sẽ làm test thất bại
// với exception khác, thay vì mở kết nối đến môi trường đang chạy.
var reset = new PasswordResetService(null!, null!, manager, deniedConfig,
    NullLogger<PasswordResetService>.Instance);

async Task ExpectRejected<TException>(PasswordCase item, string kind, Func<Task> action)
    where TException : Exception
{
    try
    {
        await action();
        Record(item.Id, kind, false, "Mật khẩu sai không bị từ chối.");
    }
    catch (TException exception)
    {
        var policyMessage = QuyTacMatKhau.KiemTra(item.Password)!;
        Record(item.Id, kind, exception.Message.StartsWith(policyMessage, StringComparison.Ordinal),
            exception.Message.StartsWith(policyMessage, StringComparison.Ordinal) ? null : "Không trả đúng lỗi quy tắc mật khẩu.");
    }
    catch (Exception exception)
    {
        // Chỉ ghi tên loại lỗi, không in dữ liệu đầu vào hoặc credential.
        Record(item.Id, kind, false, $"Sai loại lỗi: {exception.GetType().Name}");
    }
}

foreach (var item in cases.Where(item => !item.Valid))
{
    await ExpectRejected<PasswordResetValidationException>(item, "reset-before-db",
        () => reset.CompleteAsync(Guid.Empty, "qa-not-a-real-reset-token", item.Password!));
    await ExpectRejected<ArgumentException>(item, "manager-create-before-firebase",
        async () => { await manager.CreateStaffIdentityAsync("qa@example.invalid", item.Password!, "QA offline"); });
    await ExpectRejected<ArgumentException>(item, "manager-update-before-firebase",
        () => manager.UpdatePasswordAsync("qa-not-a-real-uid", item.Password!));
}

Record("no-credential-read", "guard", deniedConfig.AccessCount == 0,
    deniedConfig.AccessCount == 0 ? null : "Code đã cố đọc cấu hình trước khi từ chối mật khẩu sai.");
var lazyAuth = (Lazy<FirebaseAuth>)typeof(FirebasePasswordManager)
    .GetField("_firebaseAuth", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(manager)!;
Record("firebase-not-initialized", "guard", !lazyAuth.IsValueCreated);

var summary = new
{
    ExecutedAtUtc = DateTime.UtcNow,
    Fixture = Path.GetFullPath(args[0]),
    FixtureCases = cases.Length,
    Checks = results.Count,
    Passed = results.Count(item => item.Status == "PASS"),
    Failed = results.Count(item => item.Status != "PASS"),
    ExternalCalls = 0,
    Results = results
};
if (args.Length == 2)
{
    var resultPath = Path.GetFullPath(args[1]);
    Directory.CreateDirectory(Path.GetDirectoryName(resultPath)!);
    File.WriteAllText(resultPath, JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
}
Console.WriteLine($"Fixture: {cases.Length}; checks: {summary.Checks}; PASS: {summary.Passed}; FAIL: {summary.Failed}");
return summary.Failed == 0 ? 0 : 1;

record PasswordCase(string Id, string? Password, bool Valid);
record CheckResult(string Id, string Kind, string Status, string? Error);

sealed class DeniedConfiguration : IConfiguration
{
    public int AccessCount { get; private set; }
    private InvalidOperationException Denied()
    {
        AccessCount++;
        return new InvalidOperationException("Offline test forbids configuration access.");
    }
    public string? this[string key] { get => throw Denied(); set => throw Denied(); }
    public IEnumerable<IConfigurationSection> GetChildren() => throw Denied();
    public IChangeToken GetReloadToken() => throw Denied();
    public IConfigurationSection GetSection(string key) => throw Denied();
}
