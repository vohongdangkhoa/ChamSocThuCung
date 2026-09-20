using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>API hồ sơ tài khoản, đồng bộ danh tính Firebase và phân quyền SQL.</summary>
    public class UserAccountsController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;
        private readonly IFirebaseTokenVerifier _firebaseTokenVerifier;

        /// <summary>Nhận DbContext và dịch vụ xác minh Firebase qua dependency injection.</summary>
        public UserAccountsController(
            PetNoVaDbContext context,
            IFirebaseTokenVerifier firebaseTokenVerifier
        )
        {
            _context = context;
            _firebaseTokenVerifier = firebaseTokenVerifier;
        }

        [HttpGet]
        /// <summary>Chỉ admin đang hoạt động được lấy toàn bộ tài khoản.</summary>
        /// <param name="cancellationToken">Hủy truy vấn khi client đóng kết nối.</param>
        /// <returns>200 kèm danh sách; 401 nếu token sai; 403 nếu không phải admin; 503 khi Firebase lỗi.</returns>
        public async Task<ActionResult<IEnumerable<UserAccount>>> GetUserAccounts(
            CancellationToken cancellationToken
        )
        {
            // Xác minh token trước, không tin role hay firebaseUid do Flutter tự gửi.
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            // Quyền admin được kiểm tra lại từ PetNoVaDB để tài khoản bị khóa mất quyền ngay.
            if (!await IsActiveAdminAsync(identityResult.Identity!, cancellationToken))
            {
                return Forbid();
            }

            // Danh sách chỉ đọc nên tắt change tracking để giảm bộ nhớ.
            return await _context.UserAccounts
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        [HttpGet("{id}")]
        /// <summary>Lấy tài khoản theo userId với kiểm tra quyền phù hợp.</summary>
        /// <param name="id">userId cần đọc.</param>
        /// <returns>200 cho chính chủ/admin; 401, 403 hoặc 404 theo lỗi tương ứng.</returns>
        public async Task<ActionResult<UserAccount>> GetUserAccount(
            string id,
            CancellationToken cancellationToken
        )
        {
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            // Tải hồ sơ trước để vừa kiểm tra tồn tại vừa so firebaseUid sở hữu.
            var user = await _context.UserAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.userId == id, cancellationToken);

            if (user == null)
            {
                return NotFound();
            }

            // Người dùng chỉ đọc được chính hồ sơ có UID trùng token; admin active là ngoại lệ.
            if (
                !string.Equals(
                    user.firebaseUid,
                    identityResult.Identity!.FirebaseUid,
                    StringComparison.Ordinal
                )
                && !await IsActiveAdminAsync(
                    identityResult.Identity,
                    cancellationToken
                )
            )
            {
                return Forbid();
            }

            return user;
        }

        [HttpGet("firebase/{firebaseUid}")]
        /// <summary>Ghép người đã đăng nhập Firebase với hồ sơ SQL tương ứng.</summary>
        /// <param name="firebaseUid">UID cần tìm, thông thường chính là UID trong Bearer token.</param>
        /// <returns>200 với UserAccount; 403 khi đọc UID người khác; 404 nếu SQL chưa có hồ sơ.</returns>
        public async Task<ActionResult<UserAccount>> GetUserByFirebaseUid(
            string firebaseUid,
            CancellationToken cancellationToken
        )
        {
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            // Chặn kỹ thuật IDOR: đổi UID trên URL không cho phép xem tài khoản người khác.
            if (
                !string.Equals(
                    identityResult.Identity!.FirebaseUid,
                    firebaseUid,
                    StringComparison.Ordinal
                )
                && !await IsActiveAdminAsync(
                    identityResult.Identity,
                    cancellationToken
                )
            )
            {
                return Forbid();
            }

            // firebaseUid là cầu nối giữa Firebase Authentication và USER_ACCOUNT trong SQL.
            var user = await _context.UserAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    u => u.firebaseUid == firebaseUid,
                    cancellationToken
                );

            if (user == null)
            {
                return NotFound("Không tìm thấy tài khoản trong SQL Server");
            }

            return user;
        }

        [HttpGet("email/{email}")]
        /// <summary>Tìm hồ sơ bằng email đã xác thực.</summary>
        /// <param name="email">Email trên URL; phải trùng claim email của token nếu không phải admin.</param>
        /// <returns>200 với hồ sơ hoặc 403/404 khi không có quyền/không tìm thấy.</returns>
        public async Task<ActionResult<UserAccount>> GetUserByEmail(
            string email,
            CancellationToken cancellationToken
        )
        {
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            var identity = identityResult.Identity!;
            // So khớp email không phân biệt hoa thường; admin active có thể tra cứu người khác.
            if (
                string.IsNullOrWhiteSpace(identity.Email)
                || !string.Equals(
                    identity.Email.Trim(),
                    email.Trim(),
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                if (!await IsActiveAdminAsync(identity, cancellationToken))
                {
                    return Forbid();
                }
            }

            // Sau kiểm tra email URL, vẫn đối chiếu UID của bản ghi để chống hai hồ sơ trùng email bất thường.
            var user = await _context.UserAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.email == email, cancellationToken);

            if (user == null)
            {
                return NotFound("Không tìm thấy email trong SQL Server");
            }

            if (
                !string.Equals(
                    user.firebaseUid,
                    identity.FirebaseUid,
                    StringComparison.Ordinal
                )
                && !await IsActiveAdminAsync(identity, cancellationToken)
            )
            {
                return Forbid();
            }

            return user;
        }

        [HttpPost]
        /// <summary>Tạo hồ sơ SQL khi danh tính Firebase trùng request và dữ liệu duy nhất.</summary>
        /// <param name="user">Hồ sơ đăng ký; UID/email phải trùng token, role/status do server quyết định.</param>
        /// <returns>201 khi tạo; 400 dữ liệu sai/trùng; 401 token sai; 409 khi unique constraint va chạm.</returns>
        public async Task<ActionResult<UserAccount>> CreateUserAccount(
            UserAccount user,
            CancellationToken cancellationToken
        )
        {
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            var identity = identityResult.Identity!;
            // Không cho client đăng ký hộ UID/email khác dù body JSON đã bị chỉnh sửa.
            if (
                string.IsNullOrWhiteSpace(identity.Email)
                || !string.Equals(
                    identity.FirebaseUid,
                    user.firebaseUid,
                    StringComparison.Ordinal
                )
                || !string.Equals(
                    identity.Email.Trim(),
                    user.email.Trim(),
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                return BadRequest("Thông tin tài khoản không khớp phiên Firebase");
            }

            // Ghi đè các trường nhạy cảm bằng giá trị tin cậy từ Firebase/server.
            user.firebaseUid = identity.FirebaseUid;
            user.email = identity.Email.Trim();
            user.role = "CUSTOMER";
            user.status = "ACTIVE";

            // Kiểm tra sớm cho thông báo dễ hiểu; unique constraint DB vẫn là lớp bảo vệ cuối.
            var existingUser = await _context.UserAccounts
                .FirstOrDefaultAsync(
                    u => u.firebaseUid == user.firebaseUid,
                    cancellationToken
                );

            if (existingUser != null)
            {
                return BadRequest("Firebase UID này đã tồn tại");
            }

            // Chuẩn hóa 0xxxxxxxxx thành +84xxxxxxxxx để tìm kiếm và chống trùng ổn định.
            var normalizedPhone = PhoneNumberNormalizer.NormalizeVietnamese(user.phone);
            if (normalizedPhone is null)
            {
                return BadRequest("Số điện thoại không hợp lệ");
            }

            if (
                await CustomerPhoneExistsAsync(
                    normalizedPhone,
                    cancellationToken: cancellationToken
                )
            )
            {
                return BadRequest("Số điện thoại này đã được liên kết với tài khoản khác");
            }

            // Các giá trị hệ thống được tạo sau khi mọi validation đầu vào đã qua.
            user.userId = await GenerateUserIdAsync(cancellationToken);

            if (string.IsNullOrWhiteSpace(user.role))
            {
                user.role = "CUSTOMER";
            }

            if (string.IsNullOrWhiteSpace(user.status))
            {
                user.status = "ACTIVE";
            }

            user.createdAt = DateTime.Now;
            user.phone = normalizedPhone;
            user.normalizedPhone = normalizedPhone;

            _context.UserAccounts.Add(user);
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Bắt race condition khi hai request cùng vượt qua bước AnyAsync rồi cùng INSERT.
                return Conflict(
                    "Email, Firebase UID hoặc số điện thoại đã được sử dụng."
                );
            }

            return CreatedAtAction(
                nameof(GetUserAccount),
                new { id = user.userId },
                user
            );
        }

        [HttpPut("{id}/status")]
        /// <summary>Admin khóa/mở một tài khoản.</summary>
        /// <param name="id">userId cần thay đổi.</param>
        /// <param name="user">Body chỉ được dùng trường status.</param>
        /// <returns>204 khi lưu; 400 status sai; 401/403 không đủ quyền; 404 không có tài khoản.</returns>
        public async Task<IActionResult> UpdateUserStatus(
            string id,
            UserAccount user,
            CancellationToken cancellationToken
        )
        {
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            if (!await IsActiveAdminAsync(identityResult.Identity!, cancellationToken))
            {
                return Forbid();
            }

            // Danh sách trắng ngăn client ghi trạng thái lạ vào database.
            var normalizedStatus = user.status.Trim().ToUpperInvariant();
            if (normalizedStatus is not ("ACTIVE" or "INACTIVE" or "SUSPENDED"))
            {
                return BadRequest("Trạng thái tài khoản không hợp lệ.");
            }

            var existingUser = await _context.UserAccounts.FindAsync(
                [id],
                cancellationToken
            );

            if (existingUser == null)
            {
                return NotFound();
            }

            existingUser.status = normalizedStatus;

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }
        [HttpPut("{id}/role")]
        /// <summary>Admin thay đổi vai trò được phép của tài khoản.</summary>
        /// <param name="id">userId cần phân quyền.</param>
        /// <param name="user">Body chỉ lấy giá trị role.</param>
        /// <returns>204 khi lưu; 400/409 nếu role hoặc điện thoại không hợp lệ; 401/403/404 theo quyền/tồn tại.</returns>
        public async Task<IActionResult> UpdateUserRole(
            string id,
            UserAccount user,
            CancellationToken cancellationToken
        )
        {
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            if (!await IsActiveAdminAsync(identityResult.Identity!, cancellationToken))
            {
                return Forbid();
            }

            // Chỉ bốn role mà Flutter có màn hình tương ứng mới được lưu.
            var normalizedRole = user.role.Trim().ToUpperInvariant();
            if (normalizedRole is not ("CUSTOMER" or "STAFF" or "VET" or "ADMIN"))
            {
                return BadRequest("Vai trò tài khoản không hợp lệ.");
            }

            var existingUser = await _context.UserAccounts.FindAsync(
                [id],
                cancellationToken
            );

            if (existingUser == null)
            {
                return NotFound();
            }

            // CUSTOMER tham gia luồng quên mật khẩu bằng điện thoại nên bắt buộc số +84 hợp lệ/duy nhất.
            if (normalizedRole == "CUSTOMER")
            {
                var normalizedPhone = PhoneNumberNormalizer.NormalizeVietnamese(
                    existingUser.phone
                );
                if (normalizedPhone is null)
                {
                    return BadRequest(
                        "Tài khoản cần số điện thoại Việt Nam hợp lệ trước khi chuyển thành khách hàng."
                    );
                }

                if (
                    await CustomerPhoneExistsAsync(
                        normalizedPhone,
                        existingUser.userId,
                        cancellationToken
                    )
                )
                {
                    return Conflict(
                        "Số điện thoại đã được liên kết với tài khoản khác."
                    );
                }

                existingUser.phone = normalizedPhone;
                existingUser.normalizedPhone = normalizedPhone;
            }

            existingUser.role = normalizedRole;

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }
        [HttpPut("update-profile-by-email/{email}")]
        /// <summary>Người dùng cập nhật chính hồ sơ của mình sau khi token được xác minh.</summary>
        /// <param name="email">Email của hồ sơ trong URL, phải trùng email token.</param>
        /// <param name="request">Chỉ gồm họ tên và số điện thoại được phép sửa.</param>
        /// <returns>204 khi lưu; 400 số sai/trùng; 403 không phải chính chủ; 404 không có hồ sơ.</returns>
        public async Task<IActionResult> UpdateProfileByEmail(
            string email,
            UpdateProfileRequest request,
            CancellationToken cancellationToken
        )
        {
            var identityResult = await GetFirebaseIdentityAsync(cancellationToken);
            if (identityResult.Error is not null)
            {
                return identityResult.Error;
            }

            var identity = identityResult.Identity!;
            // Kiểm tra email ở biên API trước khi đọc và sửa dữ liệu cá nhân.
            if (
                string.IsNullOrWhiteSpace(identity.Email)
                || !string.Equals(
                    identity.Email.Trim(),
                    email.Trim(),
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                return Forbid();
            }

            var user = await _context.UserAccounts
                .FirstOrDefaultAsync(u => u.email == email, cancellationToken);

            if (user == null)
            {
                return NotFound("Không tìm thấy tài khoản");
            }

            // Kiểm tra UID thêm lần nữa để email trùng/đổi bất thường không dẫn tới sửa nhầm tài khoản.
            if (!string.Equals(user.firebaseUid, identity.FirebaseUid, StringComparison.Ordinal))
            {
                return Forbid();
            }

            // Lưu cả phone và normalizedPhone cùng một chuẩn để đăng nhập hỗ trợ/OTP nhất quán.
            var normalizedPhone = PhoneNumberNormalizer.NormalizeVietnamese(request.phone);
            if (normalizedPhone is null)
            {
                return BadRequest("Số điện thoại không hợp lệ");
            }

            if (
                await CustomerPhoneExistsAsync(
                    normalizedPhone,
                    user.userId,
                    cancellationToken
                )
            )
            {
                return BadRequest("Số điện thoại này đã được liên kết với tài khoản khác");
            }

            user.fullName = request.fullName;
            user.phone = normalizedPhone;
            user.normalizedPhone = normalizedPhone;

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        /// <summary>Kiểm tra số điện thoại chuẩn hóa đã thuộc tài khoản khác hay chưa.</summary>
        /// <param name="normalizedPhone">Số dạng +84 đã qua PhoneNumberNormalizer.</param>
        /// <param name="excludedUserId">Bỏ qua chính người đang cập nhật hồ sơ.</param>
        /// <returns>true nếu có bản ghi khác dùng số này.</returns>
        private async Task<bool> CustomerPhoneExistsAsync(
            string normalizedPhone,
            string? excludedUserId = null,
            CancellationToken cancellationToken = default
        )
        {
            // AnyAsync tạo truy vấn EXISTS gọn hơn tải nguyên UserAccount.
            return await _context.UserAccounts
                .AsNoTracking()
                .AnyAsync(
                    user =>
                        user.normalizedPhone == normalizedPhone
                        && (excludedUserId == null || user.userId != excludedUserId),
                    cancellationToken
                );
        }

        /// <summary>Đối chiếu Firebase UID với một tài khoản ADMIN đang ACTIVE trong SQL.</summary>
        /// <returns>true chỉ khi đồng thời đúng UID, role và status.</returns>
        private async Task<bool> IsActiveAdminAsync(
            FirebaseIdentity identity,
            CancellationToken cancellationToken
        )
        {
            return await _context.UserAccounts
                .AsNoTracking()
                .AnyAsync(
                    user =>
                        user.firebaseUid == identity.FirebaseUid
                        && user.role == "ADMIN"
                        && user.status == "ACTIVE",
                    cancellationToken
                );
        }

        /// <summary>Lấy phần số lớn nhất của Uxxx rồi cộng một để tạo userId mới.</summary>
        /// <returns>Mã dạng U001, U002...</returns>
        private async Task<string> GenerateUserIdAsync(
            CancellationToken cancellationToken
        )
        {
            // Không dùng Count vì dữ liệu có thể đã xóa, gây sinh lại khóa đang tồn tại.
            var userIds = await _context.UserAccounts
                .AsNoTracking()
                .Select(user => user.userId)
                .ToListAsync(cancellationToken);
            var nextNumber = userIds
                .Select(id =>
                    int.TryParse(id.TrimStart('U'), out var number) ? number : 0
                )
                .DefaultIfEmpty(0)
                .Max() + 1;

            return "U" + nextNumber.ToString("D3");
        }

        /// <summary>Đọc Bearer token và trả danh tính Firebase chuẩn hóa.</summary>
        /// <returns>Identity khi hợp lệ; ActionResult 401 hoặc 503 để action trả thẳng cho client.</returns>
        private async Task<IdentityLookupResult> GetFirebaseIdentityAsync(
            CancellationToken cancellationToken
        )
        {
            // Header phải đúng mẫu "Authorization: Bearer &lt;Firebase ID token&gt;".
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
                // Firebase verifier kiểm tra chữ ký, hạn token và lấy UID/email tin cậy.
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
                // Lỗi cấu hình/mạng của server là 503, khác với token người dùng sai là 401.
                return new IdentityLookupResult(
                    null,
                    StatusCode(
                        StatusCodes.Status503ServiceUnavailable,
                        new { message = "Chưa thể xác minh Firebase lúc này." }
                    )
                );
            }
        }

        // Record gói đúng một trong hai kết quả: Identity thành công hoặc lỗi HTTP sẵn sàng trả về.
        private sealed record IdentityLookupResult(
            FirebaseIdentity? Identity,
            ActionResult? Error
        );
    }
    /// <summary>DTO cho phép cập nhật tên, điện thoại và thông tin avatar.</summary>
    public class UpdateProfileRequest
    {
        // DTO cố ý không có role/status/firebaseUid để tránh over-posting quyền.
        public string fullName { get; set; } = string.Empty;
        public string phone { get; set; } = string.Empty;
    }
}
