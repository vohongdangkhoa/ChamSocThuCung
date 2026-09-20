using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using PetNoVaApi.Data;
using PetNoVaApi.Services;

// Builder đọc appsettings, user-secrets, biến môi trường và cấu hình hosting.
var builder = WebApplication.CreateBuilder(args);

// Tránh Windows Event Log làm request thất bại khi chạy bằng tài khoản thường.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// Đăng ký REST controller và Swagger/OpenAPI phục vụ kiểm thử API.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Cho phép Flutter Web/mobile gọi API trong môi trường phát triển.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFlutterApp", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Kết nối SQL Server PetNoVaDB bằng Entity Framework và retry lỗi tạm thời.
builder.Services.AddDbContext<PetNoVaDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("PetNoVaConnection"),
        sqlOptions => sqlOptions.EnableRetryOnFailure()
    ));

// HttpClient xác minh ID token với Firebase Identity Toolkit.
builder.Services.AddHttpClient<IFirebaseTokenVerifier, FirebaseTokenVerifier>(client =>
{
    client.BaseAddress = new Uri("https://identitytoolkit.googleapis.com/");
    client.Timeout = TimeSpan.FromSeconds(15);
});

// HttpClient riêng để upload/xóa ảnh qua Cloudinary API.
builder.Services.AddHttpClient<ICloudinaryMediaService, CloudinaryMediaService>(client =>
{
    client.BaseAddress = new Uri("https://api.cloudinary.com/");
    client.Timeout = TimeSpan.FromSeconds(60);
});

// Các service của OTP: nghiệp vụ theo request, SMTP và Firebase Admin dùng chung.
builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();
builder.Services.AddSingleton<IPasswordResetEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<IFirebasePasswordManager, FirebasePasswordManager>();

// Giới hạn request reset mật khẩu theo IP để giảm spam và dò OTP.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("password-reset", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0,
                AutoReplenishment = true,
            }
        )
    );
});

builder.Services.AddOpenApi();

// Tạo pipeline sau khi hoàn tất đăng ký phụ thuộc.
var app = builder.Build();

// Bổ sung cột/bảng mới theo cách idempotent trước khi API nhận request.
await MediaSchemaInitializer.InitializeAsync(app.Services);
await PasswordResetSchemaInitializer.InitializeAsync(app.Services);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapOpenApi();
}

// Tạm tắt dòng này để Flutter Web gọi HTTP không bị lỗi HTTPS local
// app.UseHttpsRedirection();

app.UseCors("AllowFlutterApp");

app.UseRateLimiter();

app.UseAuthorization();

// Health check xác nhận đồng thời API chạy và SQL Server kết nối được.
app.MapGet(
    "/health",
    async (PetNoVaDbContext context, CancellationToken cancellationToken) =>
        await context.Database.CanConnectAsync(cancellationToken)
            ? Results.Ok(new { status = "ready" })
            : Results.StatusCode(StatusCodes.Status503ServiceUnavailable)
);

app.MapControllers();

app.Run();
