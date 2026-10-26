using System.Collections;
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

// Kiểm tra trực tiếp logic trong DLL API. Không kết nối database hoặc gọi dịch vụ ngoài.
if (args.Length is < 1 or > 2)
{
    Console.Error.WriteLine("Usage: dotnet run --project qa/tests-api -- <PetNoVaApi.dll> [results.json]");
    return 2;
}

var assemblyPath = Path.GetFullPath(args[0]);
var resolver = new AssemblyDependencyResolver(assemblyPath);
var loader = new AssemblyLoadContext("PetNoVaOfflineQa", isCollectible: true);
loader.Resolving += (_, name) =>
{
    if (name.Name?.StartsWith("Microsoft.Extensions.", StringComparison.Ordinal) == true ||
        name.Name?.StartsWith("Microsoft.AspNetCore.", StringComparison.Ordinal) == true)
        return null; // Dùng cùng các interface từ ASP.NET shared framework.
    var path = resolver.ResolveAssemblyToPath(name);
    return path is null ? null : loader.LoadFromAssemblyPath(path);
};
var assembly = loader.LoadFromAssemblyPath(assemblyPath);
var controllerType = assembly.GetType("PetNoVaApi.Controllers.BookingsController", throwOnError: true)!;
var bookingType = assembly.GetType("PetNoVaApi.Models.Booking", throwOnError: true)!;
var serviceType = assembly.GetType("PetNoVaApi.Models.ServicePackage", throwOnError: true)!;
var serviceControllerType = assembly.GetType("PetNoVaApi.Controllers.ServicePackagesController", throwOnError: true)!;
var slotMethod = controllerType.GetMethod("CheckSlot", BindingFlags.NonPublic | BindingFlags.Instance)!;
var inputMethod = controllerType.GetMethod("ValidateInput", BindingFlags.NonPublic | BindingFlags.Instance)!;
var serviceMethod = serviceControllerType.GetMethod("IsValid", BindingFlags.NonPublic | BindingFlags.Static)!;
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["Booking:Capacity"] = "3"
}).Build();
var controller = Activator.CreateInstance(controllerType, [null, config])!;
var day = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date.AddDays(1);
var results = new List<TestResult>();

object Booking(int startMinutes, int duration, string pet, string? staff = null)
{
    var value = Activator.CreateInstance(bookingType)!;
    bookingType.GetProperty("bookingTime")!.SetValue(value, TimeSpan.FromMinutes(startMinutes));
    bookingType.GetProperty("durationMinutes")!.SetValue(value, duration);
    bookingType.GetProperty("petId")!.SetValue(value, pet);
    bookingType.GetProperty("staffId")!.SetValue(value, staff);
    return value;
}

bool Available(object[] bookings, int start, int duration, string? pet = "new-pet", string? staff = null, DateTime? now = null)
{
    var list = (IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(bookingType))!;
    foreach (var booking in bookings) list.Add(booking);
    var result = ((bool Available, string Reason))slotMethod.Invoke(controller,
        [list, day, TimeSpan.FromMinutes(start), duration, pet, staff, now ?? day.AddDays(-1)])!;
    return result.Available;
}

bool ServiceValid(decimal price = 100000, int duration = 30, string status = "ACTIVE", bool requireStatus = false)
{
    var value = Activator.CreateInstance(serviceType)!;
    foreach (var (name, fieldValue) in new (string, object)[]
    {
        ("serviceName", "Dịch vụ thử nghiệm"), ("description", "Dữ liệu chỉ nằm trong bộ nhớ"),
        ("categoryId", "SC-QA"), ("price", price), ("duration", duration), ("status", status)
    }) serviceType.GetProperty(name)!.SetValue(value, fieldValue);
    // DLL trước sửa có 1 tham số; vẫn gọi đúng phương thức cũ để đo baseline thực.
    object?[] parameters = serviceMethod.GetParameters().Length == 1 ? [value] : [value, requireStatus];
    return (bool)serviceMethod.Invoke(null, parameters)!;
}

void Check(string id, string description, bool expected, Func<bool> check)
{
    try
    {
        var actual = check();
        results.Add(new(id, description, actual == expected ? "PASS" : "FAIL", expected, actual, null));
    }
    catch (Exception ex)
    {
        results.Add(new(id, description, "ERROR", expected, null, ex.GetBaseException().GetType().Name));
    }
    Console.WriteLine($"{results[^1].Status} {id}: {description}");
}

Check("API-BK-001", "Ba lịch nối tiếp không chiếm ba chỗ đồng thời", true,
    () => Available([Booking(480, 30, "p1"), Booking(510, 30, "p2"), Booking(540, 30, "p3")], 480, 90));
Check("API-BK-002", "Ba lịch đồng thời đạt công suất phải bị chặn", false,
    () => Available([Booking(480, 90, "p1"), Booking(480, 90, "p2"), Booking(510, 30, "p3")], 480, 90));
Check("API-BK-003", "Lịch mới bắt đầu đúng khi lịch cũ kết thúc", true,
    () => Available([Booking(480, 30, "new-pet")], 510, 30));
Check("API-BK-004", "Thú cưng trùng giờ phải bị chặn", false,
    () => Available([Booking(480, 30, "new-pet")], 480, 30));
Check("API-BK-005", "Nhân sự trùng giờ phải bị chặn", false,
    () => Available([Booking(480, 30, "p1", "staff-1")], 480, 30, staff: "staff-1"));
Check("API-BK-006", "Khung giờ đã qua phải bị chặn", false,
    () => Available([], 480, 30, now: day.AddHours(8)));
Check("API-BK-007", "Dịch vụ vượt giờ đóng cửa phải bị chặn", false,
    () => Available([], 1050, 60));
Check("API-BK-008", "Khung giờ có phần mili giây không thuộc bước 30 phút", false,
    () => inputMethod.Invoke(controller, [day, TimeSpan.FromHours(8).Add(TimeSpan.FromMilliseconds(1)), null]) is null);
Check("API-BK-009", "08:30 đúng bước 30 phút được chấp nhận", true,
    () => inputMethod.Invoke(controller, [day, TimeSpan.FromMinutes(510), null]) is null);
Check("API-SV-001", "Giá có phần thập phân vượt precision SQL bị từ chối", false,
    () => ServiceValid(price: 0.001m));
Check("API-SV-002", "Giá vượt decimal(18,2) bị từ chối", false,
    () => ServiceValid(price: 10000000000000000m));
Check("API-SV-003", "Dịch vụ dài hơn giới hạn đặt lịch 480 phút bị từ chối", false,
    () => ServiceValid(duration: 481));
Check("API-SV-004", "Cập nhật trạng thái dịch vụ ngoài ACTIVE/INACTIVE bị từ chối", false,
    () => ServiceValid(status: "INVALID", requireStatus: true));
Check("API-SV-005", "Tạo dịch vụ không yêu cầu trạng thái từ client", true,
    () => ServiceValid(status: ""));
Check("API-SV-006", "Dịch vụ hợp lệ được chấp nhận", true,
    () => ServiceValid(requireStatus: true));
Check("API-SV-007", "Giá bằng 0 bị từ chối", false,
    () => ServiceValid(price: 0));

var summary = new
{
    Assembly = assemblyPath,
    ExecutedAtUtc = DateTime.UtcNow,
    Passed = results.Count(r => r.Status == "PASS"),
    Failed = results.Count(r => r.Status != "PASS"),
    Results = results
};
if (args.Length == 2)
{
    var output = Path.GetFullPath(args[1]);
    Directory.CreateDirectory(Path.GetDirectoryName(output)!);
    File.WriteAllText(output, JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
}
Console.WriteLine($"Total: {results.Count}; PASS: {summary.Passed}; FAIL/ERROR: {summary.Failed}");
return summary.Failed == 0 ? 0 : 1;

record TestResult(string Id, string Description, string Status, bool Expected, bool? Actual, string? Error);
