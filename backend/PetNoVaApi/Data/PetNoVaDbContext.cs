using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Models;

// DbContext ánh xạ các bảng PetNoVaDB sang entity C# cho Entity Framework Core.
namespace PetNoVaApi.Data
{
    /// <summary>Phiên làm việc với SQL Server, quản lý truy vấn và SaveChanges.</summary>
    public class PetNoVaDbContext : DbContext
    {
        /// <summary>
        /// Nhận cấu hình kết nối SQL Server đã đăng ký trong Program.cs và chuyển cho DbContext gốc.
        /// </summary>
        /// <param name="options">Chứa connection string và provider SQL Server của PetNoVaDB.</param>
        public PetNoVaDbContext(DbContextOptions<PetNoVaDbContext> options)
            : base(options)
        {
        }

        // Mỗi DbSet tương ứng một bảng nghiệp vụ trong PetNoVaDB.
        public DbSet<Pet> Pets { get; set; }
        public DbSet<Booking> Bookings { get; set; }
        public DbSet<MedicalRecord> MedicalRecords { get; set; }
        public DbSet<Vaccination> Vaccinations { get; set; }
        public DbSet<ServicePackage> ServicePackages { get; set; }
        public DbSet<BookingDetail> BookingDetails { get; set; }
        public DbSet<Payment> Payments { get; set; }
        public DbSet<Staff> Staffs { get; set; }
        public DbSet<UserAccount> UserAccounts { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<PasswordResetChallenge> PasswordResetChallenges { get; set; }

        /// <summary>Cấu hình precision, index và quan hệ không mô tả đủ bằng attribute.</summary>
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Giữ lại mọi quy ước mặc định của EF Core trước khi bổ sung quy tắc riêng.
            base.OnModelCreating(modelBuilder);

            // Giữ đúng độ chính xác tiền/cân nặng khi EF ghi số thập phân vào SQL Server.
            modelBuilder.Entity<Booking>().Property(item => item.totalAmount).HasPrecision(18, 2);
            modelBuilder.Entity<Payment>().Property(item => item.amount).HasPrecision(18, 2);
            modelBuilder.Entity<BookingDetail>().Property(item => item.price).HasPrecision(18, 2);
            modelBuilder.Entity<Pet>().Property(item => item.weight).HasPrecision(10, 2);
            modelBuilder.Entity<ServicePackage>().Property(item => item.price).HasPrecision(18, 2);

            // Mỗi số điện thoại chuẩn hóa chỉ thuộc một tài khoản.
            modelBuilder.Entity<UserAccount>()
                .HasIndex(item => item.normalizedPhone)
                .IsUnique()
                .HasFilter("[normalizedPhone] IS NOT NULL");

            // Khai báo FK có sẵn trong SQL Server để EF luôn INSERT UserAccount
            // trước Staff và không vi phạm FK_STAFF_USER_ACCOUNT.
            modelBuilder.Entity<Staff>()
                .HasOne<UserAccount>()
                .WithMany()
                .HasForeignKey(staff => staff.userId)
                .HasPrincipalKey(user => user.userId)
                .OnDelete(DeleteBehavior.Restrict);

            // Index giúp tìm challenge OTP mới nhất của một người dùng nhanh hơn.
            modelBuilder.Entity<PasswordResetChallenge>()
                .HasIndex(item => new { item.userId, item.createdAt });
        }

    }
}
