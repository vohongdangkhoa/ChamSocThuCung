using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>REST API tra cứu và quản trị gói dịch vụ.</summary>
    public class ServicePackagesController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;

        /// <summary>Nhận DbContext để truy vấn và quản trị SERVICE_PACKAGE.</summary>
        public ServicePackagesController(PetNoVaDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        /// <summary>Lấy danh sách, có thể lọc theo từ khóa.</summary>
        /// <param name="search">Từ khóa tùy chọn tìm trong mã, tên, mô tả hoặc danh mục.</param>
        /// <returns>HTTP 200 với danh sách sắp theo tên.</returns>
        public async Task<ActionResult<IEnumerable<ServicePackage>>> GetServicePackages(
            [FromQuery] string? search
        )
        {
            // AsNoTracking tối ưu màn hình chỉ đọc; AsQueryable cho phép ghép điều kiện động.
            var query = _context.ServicePackages.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                // EF Core dịch chuỗi OR Contains thành điều kiện LIKE phía SQL Server.
                var keyword = search.Trim();
                query = query.Where(service =>
                    service.serviceId.Contains(keyword) ||
                    service.serviceName.Contains(keyword) ||
                    service.description.Contains(keyword) ||
                    service.categoryId.Contains(keyword)
                );
            }

            return await query.OrderBy(service => service.serviceName).ToListAsync();
        }

        [HttpGet("{id}")]
        /// <summary>Lấy một gói dịch vụ theo mã.</summary>
        /// <param name="id">serviceId trong URL.</param>
        /// <returns>HTTP 200 hoặc 404.</returns>
        public async Task<ActionResult<ServicePackage>> GetServicePackage(string id)
        {
            var servicePackage = await _context.ServicePackages.FindAsync(id);

            if (servicePackage == null)
            {
                return NotFound();
            }

            return servicePackage;
        }

        [HttpPost]
        /// <summary>Kiểm tra dữ liệu, sinh mã và lưu dịch vụ mới.</summary>
        /// <param name="servicePackage">Tên, mô tả, giá, phút và danh mục do admin nhập.</param>
        /// <returns>HTTP 201 khi tạo; 400 nếu thiếu nội dung hoặc số không dương.</returns>
        public async Task<ActionResult<ServicePackage>> CreateServicePackage(ServicePackage servicePackage)
        {
            if (!IsValid(servicePackage))
            {
                return BadRequest("Tên, mô tả, giá và thời lượng gói dịch vụ không hợp lệ.");
            }

            // Client không được tự chọn mã/trạng thái ban đầu; dịch vụ mới luôn ACTIVE.
            servicePackage.serviceId = await GenerateServiceId();
            servicePackage.status = "ACTIVE";

            _context.ServicePackages.Add(servicePackage);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetServicePackage),
                new { id = servicePackage.serviceId },
                servicePackage
            );
        }

        [HttpPut("{id}")]
        /// <summary>Cập nhật nội dung/giá/thời lượng/danh mục dịch vụ.</summary>
        /// <param name="id">Mã trong route, phải trùng serviceId trong body.</param>
        /// <param name="servicePackage">Giá trị mới đã chỉnh trên giao diện admin.</param>
        /// <returns>204 khi lưu; 400 nếu dữ liệu/mã sai; 404 nếu dịch vụ không tồn tại.</returns>
        public async Task<IActionResult> UpdateServicePackage(string id, ServicePackage servicePackage)
        {
            if (id != servicePackage.serviceId)
            {
                return BadRequest();
            }

            var existingService = await _context.ServicePackages.FindAsync(id);

            if (existingService == null)
            {
                return NotFound();
            }

            if (!IsValid(servicePackage))
            {
                return BadRequest("Tên, mô tả, giá và thời lượng gói dịch vụ không hợp lệ.");
            }

            // Copy từng trường vào entity đã được theo dõi để tránh over-posting trường ngoài ý muốn.
            existingService.serviceName = servicePackage.serviceName;
            existingService.description = servicePackage.description;
            existingService.price = servicePackage.price;
            existingService.duration = servicePackage.duration;
            existingService.status = servicePackage.status;
            existingService.categoryId = servicePackage.categoryId;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        /// <summary>Xóa dịch vụ nếu không vi phạm ràng buộc dữ liệu liên quan.</summary>
        /// <param name="id">Mã dịch vụ cần xóa.</param>
        /// <returns>204 khi xóa; 404 nếu không có; 409 nếu đã nằm trong lịch hẹn.</returns>
        public async Task<IActionResult> DeleteServicePackage(string id)
        {
            var servicePackage = await _context.ServicePackages.FindAsync(id);
            if (servicePackage == null)
            {
                return NotFound("Không tìm thấy gói dịch vụ.");
            }

            // AnyAsync chỉ hỏi có tồn tại hay không, không tải toàn bộ BOOKING_DETAIL về RAM.
            var isInUse = await _context.BookingDetails.AnyAsync(detail =>
                detail.serviceId == id
            );
            if (isInUse)
            {
                return Conflict(
                    "Gói dịch vụ đã phát sinh lịch hẹn nên không thể xóa. Hãy chuyển gói sang INACTIVE."
                );
            }

            _context.ServicePackages.Remove(servicePackage);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("{id}/toggle-status")]
        /// <summary>Bật hoặc tắt dịch vụ mà không xóa lịch sử.</summary>
        /// <param name="id">Mã gói cần đổi ACTIVE/INACTIVE.</param>
        /// <returns>204 khi đổi hoặc 404 nếu không tồn tại.</returns>
        public async Task<IActionResult> ToggleServiceStatus(string id)
        {
            var servicePackage = await _context.ServicePackages.FindAsync(id);

            if (servicePackage == null)
            {
                return NotFound();
            }

            servicePackage.status = servicePackage.status == "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE";

            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Kiểm tra các điều kiện tối thiểu trước khi ghi DB.</summary>
        /// <returns>true khi chuỗi bắt buộc có nội dung và price/duration lớn hơn 0.</returns>
        private static bool IsValid(ServicePackage servicePackage)
        {
            return !string.IsNullOrWhiteSpace(servicePackage.serviceName) &&
                !string.IsNullOrWhiteSpace(servicePackage.description) &&
                !string.IsNullOrWhiteSpace(servicePackage.categoryId) &&
                servicePackage.price > 0 &&
                servicePackage.duration > 0;
        }

        /// <summary>Sinh serviceId tiếp theo từ phần số lớn nhất của các mã SVxxx hiện có.</summary>
        /// <returns>Mã mới dạng SV001, SV002...</returns>
        private async Task<string> GenerateServiceId()
        {
            // Bỏ mã lỗi định dạng về 0, lấy Max rồi cộng 1 để không phụ thuộc số lượng bản ghi.
            var ids = await _context.ServicePackages
                .Select(service => service.serviceId)
                .ToListAsync();
            var nextNumber = ids
                .Select(id => int.TryParse(id.Replace("SV", ""), out var number) ? number : 0)
                .DefaultIfEmpty(0)
                .Max() + 1;
            return "SV" + nextNumber.ToString("D3");
        }
    }
}
