using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>API quản trị nhân sự, mọi thay đổi đều yêu cầu admin đang hoạt động.</summary>
    public class StaffsController : ControllerBase
    {
        // Danh sách trắng role mà màn hình nhân sự được phép tạo/chỉnh sửa.
        private static readonly string[] AllowedRoles = ["STAFF", "VET"];

        private readonly PetNoVaDbContext _context;
        private readonly IFirebaseTokenVerifier _firebaseTokenVerifier;

        /// <summary>Nhận DbContext và Firebase verifier dùng chung cho mọi action quản trị.</summary>
        public StaffsController(
            PetNoVaDbContext context,
            IFirebaseTokenVerifier firebaseTokenVerifier
        )
        {
            _context = context;
            _firebaseTokenVerifier = firebaseTokenVerifier;
        }

        [HttpGet]
        /// <summary>Trả danh sách nhân viên có lọc từ khóa/vai trò.</summary>
        /// <param name="search">Từ khóa tùy chọn tìm theo mã, tên, email hoặc điện thoại.</param>
        /// <param name="role">Role STAFF/VET tùy chọn.</param>
        /// <returns>200 cho admin active; 401/403/503 nếu xác thực không đạt.</returns>
        public async Task<ActionResult<IEnumerable<Staff>>> GetStaffs(
            [FromQuery] string? search,
            [FromQuery] string? role,
            CancellationToken cancellationToken
        )
        {
            // Mọi endpoint trong controller đều kiểm tra admin phía server trước khi truy cập dữ liệu.
            var authorizationError = await RequireActiveAdminAsync(cancellationToken);
            if (authorizationError is not null)
            {
                return authorizationError;
            }

            // Query động chỉ được thực thi ở ToListAsync sau khi ghép đủ bộ lọc.
            var query = _context.Staffs.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(role))
            {
                var normalizedRole = role.Trim().ToUpper();
                query = query.Where(staff => staff.role == normalizedRole);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var keyword = search.Trim();
                query = query.Where(staff =>
                    staff.staffId.Contains(keyword) ||
                    staff.fullName.Contains(keyword) ||
                    staff.email.Contains(keyword) ||
                    staff.phone.Contains(keyword)
                );
            }

            return await query
                .OrderBy(staff => staff.role)
                .ThenBy(staff => staff.fullName)
                .ToListAsync(cancellationToken);
        }

        [HttpGet("{id}")]
        /// <summary>Lấy một hồ sơ nhân viên sau khi xác minh admin.</summary>
        /// <param name="id">staffId cần xem.</param>
        /// <returns>200 kèm Staff, 404 nếu không có, hoặc lỗi quyền.</returns>
        public async Task<ActionResult<Staff>> GetStaff(
            string id,
            CancellationToken cancellationToken
        )
        {
            var authorizationError = await RequireActiveAdminAsync(cancellationToken);
            if (authorizationError is not null)
            {
                return authorizationError;
            }

            var staff = await _context.Staffs.FindAsync([id], cancellationToken);

            if (staff == null)
            {
                return NotFound();
            }

            return staff;
        }

        [HttpGet("me")]
        /// <summary>Lấy hồ sơ STAFF/VET của chính người đang đăng nhập.</summary>
        /// <remarks>
        /// Endpoint này phục vụ ứng dụng web/mobile khi cần staffId để lập bệnh án
        /// hoặc ghi nhận tiêm chủng. Không trả danh sách nhân sự và không cho phép
        /// đổi userId trên URL, nên nhân viên không thể xem hồ sơ của người khác.
        /// </remarks>
        /// <returns>200 với hồ sơ của phiên hiện tại; 401/403/404 theo quyền và dữ liệu.</returns>
        public async Task<ActionResult<Staff>> GetMyStaffProfile(
            CancellationToken cancellationToken
        )
        {
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            var user = await _context.UserAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    item => item.firebaseUid == identityResult.Identity!.FirebaseUid,
                    cancellationToken
                );

            // Chỉ nhân viên/bác sĩ đang hoạt động mới cần và được nhận staffId.
            if (user is null || user.status != "ACTIVE")
            {
                return Forbid();
            }

            var role = user.role.Trim().ToUpperInvariant();
            if (role is not ("STAFF" or "VET"))
            {
                return Forbid();
            }

            var staff = await _context.Staffs
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    item => item.userId == user.userId && item.status == "ACTIVE",
                    cancellationToken
                );

            return staff is null
                ? NotFound(new { message = "Không tìm thấy hồ sơ nhân sự đang hoạt động." })
                : Ok(staff);
        }

        [HttpPost]
        /// <summary>Tạo UserAccount và Staff liên kết trong một lần SaveChanges.</summary>
        /// <param name="request">UID Firebase, liên hệ và role do admin nhập.</param>
        /// <returns>201 khi tạo; 400 dữ liệu sai; 409 email/UID trùng; hoặc lỗi quyền.</returns>
        public async Task<ActionResult<Staff>> CreateStaff(
            CreateStaffRequest request,
            CancellationToken cancellationToken
        )
        {
            var authorizationError = await RequireActiveAdminAsync(cancellationToken);
            if (authorizationError is not null)
            {
                return authorizationError;
            }

            // Chuẩn hóa và kiểm tra role trước khi tạo hai entity liên kết.
            var role = NormalizeRole(request.role);
            if (role == null)
            {
                return BadRequest("Vai trò chỉ được là STAFF hoặc VET.");
            }

            // Trim/Lower giúp so sánh và dữ liệu hiển thị nhất quán.
            var fullName = request.fullName.Trim();
            var email = request.email.Trim().ToLower();
            var phone = request.phone.Trim();
            var firebaseUid = request.firebaseUid.Trim();

            if (string.IsNullOrWhiteSpace(fullName) ||
                string.IsNullOrWhiteSpace(email) ||
                string.IsNullOrWhiteSpace(phone) ||
                string.IsNullOrWhiteSpace(firebaseUid))
            {
                return BadRequest("Vui lòng nhập đầy đủ thông tin nhân sự.");
            }

            // Kiểm tra cả email và Firebase UID để không tạo hai tài khoản đăng nhập cùng danh tính.
            if (
                await _context.UserAccounts.AnyAsync(
                    user => user.email == email || user.firebaseUid == firebaseUid,
                    cancellationToken
                )
            )
            {
                return Conflict(
                    "Email hoặc Firebase UID đã tồn tại. Hãy dùng chức năng gán vai trò cho tài khoản có sẵn."
                );
            }

            // USER_ACCOUNT chứa thông tin đăng nhập/phân quyền; STAFF chứa nghiệp vụ nhân sự.
            var user = new UserAccount
            {
                userId = await GenerateUserId(cancellationToken),
                firebaseUid = firebaseUid,
                fullName = fullName,
                email = email,
                phone = phone,
                role = role,
                status = "ACTIVE",
                fcmToken = string.Empty,
                createdAt = DateTime.Now
            };

            var staff = new Staff
            {
                staffId = await GenerateStaffId(cancellationToken),
                fullName = fullName,
                phone = phone,
                email = email,
                role = role,
                violationCount = 0,
                status = "ACTIVE",
                userId = user.userId
            };

            // Một SaveChanges khiến EF sắp xếp INSERT UserAccount trước Staff theo khóa ngoại.
            _context.UserAccounts.Add(user);
            _context.Staffs.Add(staff);
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Trả 409 thay vì lộ chi tiết lỗi constraint SQL Server ra client.
                return Conflict(
                    "Không thể lưu tài khoản nhân sự. Vui lòng kiểm tra email và thử lại."
                );
            }

            return CreatedAtAction(nameof(GetStaff), new { id = staff.staffId }, staff);
        }

        [HttpPut("{id}")]
        /// <summary>Cập nhật hồ sơ và đồng bộ vai trò sang tài khoản đăng nhập.</summary>
        /// <param name="id">staffId cần sửa.</param>
        /// <param name="request">Tên, điện thoại và role mới.</param>
        /// <returns>204 khi lưu; 400 dữ liệu sai; 404 nếu không có Staff; hoặc lỗi quyền.</returns>
        public async Task<IActionResult> UpdateStaff(
            string id,
            UpdateStaffRequest request,
            CancellationToken cancellationToken
        )
        {
            var authorizationError = await RequireActiveAdminAsync(cancellationToken);
            if (authorizationError is not null)
            {
                return authorizationError;
            }

            var staff = await _context.Staffs.FindAsync([id], cancellationToken);
            if (staff == null)
            {
                return NotFound("Không tìm thấy nhân viên hoặc bác sĩ.");
            }

            var role = NormalizeRole(request.role);
            if (role == null)
            {
                return BadRequest("Vai trò chỉ được là STAFF hoặc VET.");
            }

            var fullName = request.fullName.Trim();
            var phone = request.phone.Trim();
            if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(phone))
            {
                return BadRequest("Họ tên và số điện thoại không được để trống.");
            }

            // STAFF phục vụ màn hình nhân sự; USER_ACCOUNT quyết định tên/role sau đăng nhập.
            staff.fullName = fullName;
            staff.phone = phone;
            staff.role = role;

            var user = await _context.UserAccounts.FindAsync(
                [staff.userId],
                cancellationToken
            );
            // Đồng bộ bản ghi đăng nhập nếu quan hệ userId còn tồn tại.
            if (user != null)
            {
                user.fullName = fullName;
                user.phone = phone;
                user.role = role;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        [HttpDelete("{id}")]
        /// <summary>Xóa hồ sơ Staff nhưng giữ UserAccount và chuyển tài khoản về CUSTOMER.</summary>
        /// <param name="id">staffId cần gỡ khỏi danh sách nhân sự.</param>
        /// <returns>204 khi xong; 400/409 nếu số điện thoại không thể dùng cho customer; 404 nếu không có.</returns>
        public async Task<IActionResult> DeleteStaff(
            string id,
            CancellationToken cancellationToken
        )
        {
            var authorizationError = await RequireActiveAdminAsync(cancellationToken);
            if (authorizationError is not null)
            {
                return authorizationError;
            }

            var staff = await _context.Staffs.FindAsync([id], cancellationToken);
            if (staff == null)
            {
                return NotFound("Không tìm thấy nhân viên hoặc bác sĩ.");
            }

            // Không xóa tài khoản Firebase/SQL: người cũ vẫn có thể dùng PetNoVa như khách hàng.
            var user = await _context.UserAccounts.FindAsync(
                [staff.userId],
                cancellationToken
            );
            if (user != null)
            {
                // CUSTOMER cần số Việt Nam duy nhất vì luồng quên mật khẩu tra cứu theo số này.
                var normalizedPhone = PhoneNumberNormalizer.NormalizeVietnamese(
                    user.phone
                );
                if (normalizedPhone is null)
                {
                    return BadRequest(
                        "Tài khoản cần số điện thoại Việt Nam hợp lệ trước khi chuyển thành khách hàng."
                    );
                }

                var phoneInUse = await _context.UserAccounts
                    .AsNoTracking()
                    .AnyAsync(
                        item =>
                            item.userId != user.userId
                            && item.normalizedPhone == normalizedPhone,
                        cancellationToken
                    );
                if (phoneInUse)
                {
                    return Conflict(
                        "Số điện thoại đã được liên kết với tài khoản khác."
                    );
                }

                user.role = "CUSTOMER";
                user.status = "ACTIVE";
                user.phone = normalizedPhone;
                user.normalizedPhone = normalizedPhone;
            }

            // SaveChanges cùng lúc UPDATE UserAccount và DELETE Staff để dữ liệu không lệch nhau.
            _context.Staffs.Remove(staff);
            await _context.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        [HttpPut("{id}/toggle-status")]
        /// <summary>Khóa/mở nhân viên và đồng bộ UserAccount.status.</summary>
        /// <param name="id">staffId cần đảo ACTIVE/INACTIVE.</param>
        /// <returns>204 khi lưu; 404 nếu không có; hoặc lỗi quyền admin.</returns>
        public async Task<IActionResult> ToggleStaffStatus(
            string id,
            CancellationToken cancellationToken
        )
        {
            var authorizationError = await RequireActiveAdminAsync(cancellationToken);
            if (authorizationError is not null)
            {
                return authorizationError;
            }

            var staff = await _context.Staffs.FindAsync([id], cancellationToken);

            if (staff == null)
            {
                return NotFound();
            }

            // Cùng một thao tác phải ảnh hưởng cả hồ sơ nhân sự và khả năng đăng nhập.
            staff.status = staff.status == "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await SyncUserStatus(staff, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPut("{id}/add-violation")]
        /// <summary>Tăng vi phạm; tự đình chỉ và khóa đăng nhập khi đạt ba lần.</summary>
        /// <param name="id">staffId bị ghi nhận vi phạm.</param>
        /// <returns>204 sau khi tăng; 404 nếu không có; hoặc lỗi quyền.</returns>
        public async Task<IActionResult> AddViolation(
            string id,
            CancellationToken cancellationToken
        )
        {
            var authorizationError = await RequireActiveAdminAsync(cancellationToken);
            if (authorizationError is not null)
            {
                return authorizationError;
            }

            var staff = await _context.Staffs.FindAsync([id], cancellationToken);

            if (staff == null)
            {
                return NotFound();
            }

            staff.violationCount += 1;

            // Ngưỡng ba vi phạm là quy tắc nghiệp vụ tự động chuyển sang SUSPENDED.
            if (staff.violationCount >= 3)
            {
                staff.status = "SUSPENDED";
                await SyncUserStatus(staff, cancellationToken);
            }

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPut("{id}/activate")]
        /// <summary>Kích hoạt lại cả hồ sơ nhân viên và tài khoản.</summary>
        /// <param name="id">staffId được admin cho hoạt động lại.</param>
        /// <returns>204 khi lưu; 404 nếu không có; hoặc lỗi quyền.</returns>
        public async Task<IActionResult> ActivateStaff(
            string id,
            CancellationToken cancellationToken
        )
        {
            var authorizationError = await RequireActiveAdminAsync(cancellationToken);
            if (authorizationError is not null)
            {
                return authorizationError;
            }

            var staff = await _context.Staffs.FindAsync([id], cancellationToken);

            if (staff == null)
            {
                return NotFound();
            }

            staff.status = "ACTIVE";
            await SyncUserStatus(staff, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        /// <summary>Chuẩn hóa role về chữ hoa và đối chiếu danh sách STAFF/VET.</summary>
        /// <returns>Role hợp lệ hoặc null để action trả HTTP 400.</returns>
        private static string? NormalizeRole(string role)
        {
            var normalizedRole = role.Trim().ToUpper();
            return AllowedRoles.Contains(normalizedRole) ? normalizedRole : null;
        }

        /// <summary>Đồng bộ trạng thái Staff sang tài khoản đăng nhập liên kết.</summary>
        /// <remarks>Mọi trạng thái Staff khác ACTIVE đều biến UserAccount thành INACTIVE.</remarks>
        private async Task SyncUserStatus(
            Staff staff,
            CancellationToken cancellationToken
        )
        {
            var user = await _context.UserAccounts.FindAsync(
                [staff.userId],
                cancellationToken
            );
            if (user != null)
            {
                user.status = staff.status == "ACTIVE" ? "ACTIVE" : "INACTIVE";
            }
        }

        /// <summary>Lấy số lớn nhất trong STxxx rồi cộng một.</summary>
        /// <returns>staffId mới dạng ST001.</returns>
        private async Task<string> GenerateStaffId(CancellationToken cancellationToken)
        {
            // Dùng Max thay vì Count để không tái dùng khóa khi một Staff cũ đã bị xóa.
            var ids = await _context.Staffs
                .Select(staff => staff.staffId)
                .ToListAsync(cancellationToken);
            var nextNumber = ids
                .Select(id => int.TryParse(id.Replace("ST", ""), out var number) ? number : 0)
                .DefaultIfEmpty(0)
                .Max() + 1;
            return "ST" + nextNumber.ToString("D3");
        }

        /// <summary>Lấy số lớn nhất trong Uxxx rồi cộng một cho UserAccount đi kèm.</summary>
        /// <returns>userId mới dạng U001.</returns>
        private async Task<string> GenerateUserId(CancellationToken cancellationToken)
        {
            var ids = await _context.UserAccounts
                .Select(user => user.userId)
                .ToListAsync(cancellationToken);
            var nextNumber = ids
                .Select(id => int.TryParse(id.Replace("U", ""), out var number) ? number : 0)
                .DefaultIfEmpty(0)
                .Max() + 1;
            return "U" + nextNumber.ToString("D3");
        }

        /// <summary>Xác minh Bearer token rồi kiểm tra tài khoản có vai trò Admin/Active.</summary>
        /// <returns>null nếu đủ quyền; ActionResult 401, 403 hoặc 503 nếu không đạt.</returns>
        private async Task<ActionResult?> RequireActiveAdminAsync(
            CancellationToken cancellationToken
        )
        {
            // Không có Bearer token nghĩa là chưa đăng nhập, trả 401 trước khi truy vấn dữ liệu.
            var authorization = Request.Headers.Authorization.ToString();
            if (
                !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                || authorization.Length <= "Bearer ".Length
            )
            {
                return Unauthorized(new { message = "Thiếu phiên đăng nhập quản trị." });
            }

            FirebaseIdentity? identity;
            try
            {
                // Verifier xác thực chữ ký/hạn token; UID trả về mới được coi là danh tính tin cậy.
                identity = await _firebaseTokenVerifier.VerifyAsync(
                    authorization["Bearer ".Length..].Trim(),
                    cancellationToken
                );
            }
            catch (Exception exception) when (
                exception is FirebaseConfigurationException
                    or FirebaseVerificationUnavailableException
            )
            {
                return StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    new { message = "Chưa thể xác minh Firebase lúc này." }
                );
            }

            if (identity is null)
            {
                return Unauthorized(new { message = "Phiên Firebase không hợp lệ." });
            }

            // Token hợp lệ chưa đủ: role/status hiện tại phải được SQL Server xác nhận.
            var isActiveAdmin = await _context.UserAccounts
                .AsNoTracking()
                .AnyAsync(
                    user =>
                        user.firebaseUid == identity.FirebaseUid
                        && user.role == "ADMIN"
                        && user.status == "ACTIVE",
                    cancellationToken
                );

            return isActiveAdmin ? null : Forbid();
        }

        /// <summary>Đọc và xác minh Bearer token cho endpoint hồ sơ nhân sự cá nhân.</summary>
        /// <returns>Danh tính Firebase tin cậy hoặc IActionResult lỗi có thể trả thẳng.</returns>
        private async Task<IdentityLookupResult> GetFirebaseIdentityAsync(
            CancellationToken cancellationToken
        )
        {
            var authorization = Request.Headers.Authorization.ToString();
            if (
                !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                || authorization.Length <= "Bearer ".Length
            )
            {
                return new IdentityLookupResult(
                    null,
                    Unauthorized(new { message = "Thiếu phiên đăng nhập Firebase." })
                );
            }

            try
            {
                var identity = await _firebaseTokenVerifier.VerifyAsync(
                    authorization["Bearer ".Length..].Trim(),
                    cancellationToken
                );
                return identity is null
                    ? new IdentityLookupResult(
                        null,
                        Unauthorized(new { message = "Phiên Firebase không hợp lệ." })
                    )
                    : new IdentityLookupResult(identity, null);
            }
            catch (Exception exception) when (
                exception is FirebaseConfigurationException
                    or FirebaseVerificationUnavailableException
            )
            {
                return new IdentityLookupResult(
                    null,
                    StatusCode(
                        StatusCodes.Status503ServiceUnavailable,
                        new { message = "Chưa thể xác minh Firebase lúc này." }
                    )
                );
            }
        }

        private sealed record IdentityLookupResult(
            FirebaseIdentity? Identity,
            ActionResult? Error
        );
    }

    /// <summary>DTO tạo nhân viên, tách dữ liệu client khỏi entity EF.</summary>
    public class CreateStaffRequest
    {
        // DTO không nhận status/violationCount/userId; server tự gán để tránh nâng quyền.
        public string firebaseUid { get; set; } = string.Empty;
        public string fullName { get; set; } = string.Empty;
        public string phone { get; set; } = string.Empty;
        public string email { get; set; } = string.Empty;
        public string role { get; set; } = string.Empty;
    }

    /// <summary>DTO giới hạn các trường được phép sửa.</summary>
    public class UpdateStaffRequest
    {
        // Email và UID không nằm trong DTO nên form sửa không thể thay danh tính đăng nhập.
        public string fullName { get; set; } = string.Empty;
        public string phone { get; set; } = string.Empty;
        public string role { get; set; } = string.Empty;
    }
}
