using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>REST API lịch sử tiêm chủng.</summary>
    public class VaccinationsController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;

        /// <summary>Nhận DbContext để thao tác bảng VACCINATION.</summary>
        public VaccinationsController(PetNoVaDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        /// <summary>Lấy toàn bộ bản ghi tiêm chủng.</summary>
        /// <returns>HTTP 200 cùng danh sách mũi tiêm.</returns>
        public async Task<ActionResult<IEnumerable<Vaccination>>> GetVaccinations()
        {
            return await _context.Vaccinations.ToListAsync();
        }

        [HttpGet("pet/{petId}")]
        /// <summary>Lấy các mũi tiêm của một thú cưng.</summary>
        /// <param name="petId">Mã thú cưng cần xem sổ tiêm.</param>
        /// <returns>HTTP 200 với lần tiêm gần nhất đứng đầu.</returns>
        public async Task<ActionResult<IEnumerable<Vaccination>>> GetVaccinationsByPet(string petId)
        {
            // Toàn bộ lọc/sắp xếp được EF dịch sang SQL trước khi lấy dữ liệu về.
            return await _context.Vaccinations
                .Where(v => v.petId == petId)
                .OrderByDescending(v => v.vaccinationDate)
                .ToListAsync();
        }

        [HttpPost]
        /// <summary>Sinh mã và lưu mũi tiêm mới.</summary>
        /// <param name="vaccination">Tên vaccine, ngày tiêm/nhắc lại, petId và staffId.</param>
        /// <returns>HTTP 201 cùng bản ghi vừa tạo.</returns>
        public async Task<ActionResult<Vaccination>> CreateVaccination(Vaccination vaccination)
        {
            var count = await _context.Vaccinations.CountAsync();

            // VCxxx là khóa do server quản lý; dữ liệu ngày tiêm vẫn lấy từ form nghiệp vụ.
            vaccination.vaccinationId = "VC" + (count + 1).ToString("D3");

            _context.Vaccinations.Add(vaccination);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetVaccinationsByPet),
                new { petId = vaccination.petId },
                vaccination
            );
        }
    }
}
