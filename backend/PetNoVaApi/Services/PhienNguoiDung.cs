using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Services;

public static class PhienNguoiDung
{
    public const string Key = "petnova.user";
    public static UserAccount Get(HttpContext context) =>
        context.Items[Key] as UserAccount ?? throw new InvalidOperationException("Chưa xác thực tài khoản.");

    public static bool IsOperator(UserAccount user) => user.role is "STAFF" or "ADMIN";

    public static IQueryable<Pet> Pets(PetNoVaDbContext db, UserAccount user)
    {
        if (user.role == "CUSTOMER") return db.Pets.Where(p => p.userId == user.userId);
        if (user.role == "VET")
            return db.Pets.Where(p => db.Bookings.Any(b => b.petId == p.petId && b.status != "CANCELLED" &&
                db.Staffs.Any(s => s.staffId == b.staffId && s.userId == user.userId)));
        return db.Pets;
    }
}

/// <summary>Xác thực tại server cho mọi API, kể cả khi người gọi bỏ qua giao diện React.</summary>
public sealed class KiemTraQuyen(PetNoVaDbContext db, IFirebaseTokenVerifier verifier,
    ILogger<KiemTraQuyen> logger) : IAsyncActionFilter, IOrderedFilter
{
    public int Order => -2000;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var descriptor = (ControllerActionDescriptor)context.ActionDescriptor;
        var controller = descriptor.ControllerName;
        var action = descriptor.ActionName;
        var request = context.HttpContext.Request;
        // OTP có cơ chế bảo vệ riêng; callback thanh toán xác minh chữ ký PayOS ở controller.
        if (controller == "PasswordReset" || (controller == "Payments" &&
            action is "HandlePayOSWebhook" or "PayOSReturn" or "PayOSCancel"))
        { await next(); return; }

        var header = request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        { context.Result = Error(401, "Bạn cần đăng nhập để thực hiện thao tác này."); return; }

        FirebaseIdentity? identity;
        try { identity = await verifier.VerifyAsync(header[7..].Trim(), request.HttpContext.RequestAborted); }
        catch (Exception ex) when (ex is FirebaseConfigurationException or FirebaseVerificationUnavailableException)
        { context.Result = Error(503, "Chưa thể xác minh phiên đăng nhập. Vui lòng thử lại."); return; }
        if (identity is null)
        { context.Result = Error(401, "Phiên đăng nhập đã hết hạn hoặc không hợp lệ."); return; }
        context.HttpContext.Items["petnova.identity"] = identity;
        var user = await db.UserAccounts.AsNoTracking().FirstOrDefaultAsync(u => u.firebaseUid == identity.FirebaseUid);
        // Cho phép đăng ký hồ sơ và khôi phục liên kết cũ; các action này còn tự xác minh danh tính.
        if (user is null && controller == "UserAccounts" && action is "CreateUserAccount" or "GetUserByEmail" or "GetUserByFirebaseUid")
        { await next(); return; }
        if (user is null || user.status != "ACTIVE")
        { context.Result = Error(403, "Tài khoản chưa có hồ sơ hoặc đã bị tạm ngưng."); return; }
        user.role = user.role.Trim().ToUpperInvariant();
        context.HttpContext.Items[PhienNguoiDung.Key] = user;
        if (!Allowed(controller, action, request.Method, user.role))
        { context.Result = Error(403, "Bạn không có quyền thực hiện thao tác này."); return; }

        var executed = await next();
        var status = (executed.Result as ObjectResult)?.StatusCode ?? (executed.Result as StatusCodeResult)?.StatusCode ?? 200;
        if (!HttpMethods.IsGet(request.Method) && executed.Exception is null && status < 400)
        {
            // Nhật ký không lưu mật khẩu, token, body, nội dung bệnh án hoặc thông tin thẻ.
            try
            {
                db.AuditLogs.Add(new NhatKyThaoTac
                {
                    userId = user.userId, actorName = user.fullName, role = user.role,
                    action = request.Method + " " + controller + "/" + action,
                    targetId = context.RouteData.Values.TryGetValue("id", out var target) ? target?.ToString() : null,
                    createdAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception ex) { logger.LogError(ex, "Không thể lưu nhật ký thao tác."); }
        }
    }

    public static bool Allowed(string controller, string action, string method, string role)
    {
        if (role is not ("CUSTOMER" or "STAFF" or "VET" or "ADMIN")) return false;
        if (controller == "UserAccounts") return action is "GetUserByFirebaseUid" or "GetUserByEmail" or "GetUserAccount" or
            "CreateUserAccount" or "UpdateProfileByEmail" or "SyncEmail" || role == "ADMIN" || (action == "GetContacts" && role is "STAFF" or "VET");
        if (controller == "Staffs") return action == "GetDirectory" || role == "ADMIN" || (action == "GetMyStaffProfile" && role is "STAFF" or "VET");
        if (controller is "ServicePackages" or "ServiceCategories") return HttpMethods.IsGet(method) || role == "ADMIN";
        if (controller == "AuditLogs") return role == "ADMIN";
        if (controller == "Notifications") return HttpMethods.IsGet(method) || action is "MarkAsRead" or "MarkAllAsRead" || role == "ADMIN";
        if (controller is "MedicalRecords" or "Vaccinations") return HttpMethods.IsGet(method) || role is "VET" or "ADMIN";
        if (controller == "Payments") return HttpMethods.IsGet(method) || action is "CreatePayOSPaymentLink" or "SyncPayOSPayment" or "RetryPayment" || role is "ADMIN" or "STAFF";
        if (controller == "BookingDetails") return HttpMethods.IsGet(method);
        if (controller == "Bookings") return HttpMethods.IsGet(method) || role is "STAFF" or "ADMIN" ||
            (role == "CUSTOMER" && action is "CreateBooking" or "CancelBooking" or "RescheduleBooking");
        if (controller == "Pets") return HttpMethods.IsGet(method) || action == "UpdatePet" || role is "ADMIN" or "CUSTOMER";
        if (controller == "Media") return true; // Media kiểm tra quyền sở hữu từng tài nguyên.
        return false;
    }

    private static ObjectResult Error(int code, string message) => new(new { message }) { StatusCode = code };
}

// Controllers cũ dùng Forbid(); trả 403 trực tiếp vì xác thực Firebase không dùng cookie/challenge scheme.
public sealed class TraLoiCamTruyCap : IAlwaysRunResultFilter
{
    public void OnResultExecuting(ResultExecutingContext context)
    {
        if (context.Result is ForbidResult)
            context.Result = new ObjectResult(new { message = "Bạn không có quyền truy cập dữ liệu này." }) { StatusCode = 403 };
    }
    public void OnResultExecuted(ResultExecutedContext context) { }
}
