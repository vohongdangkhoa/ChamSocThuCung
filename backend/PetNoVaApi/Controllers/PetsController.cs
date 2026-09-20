using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>REST API CRUD hồ sơ thú cưng.</summary>
    public class PetsController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;

        /// <summary>Nhận DbContext để thao tác hồ sơ PET.</summary>
        public PetsController(PetNoVaDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        /// <summary>Lấy toàn bộ thú cưng.</summary>
        /// <returns>HTTP 200 cùng danh sách từ bảng PET.</returns>
        public async Task<ActionResult<IEnumerable<Pet>>> GetPets()
        {
            return await _context.Pets.ToListAsync();
        }

        [HttpGet("{id}")]
        /// <summary>Lấy một thú cưng theo petId hoặc trả 404.</summary>
        /// <param name="id">petId lấy từ URL.</param>
        /// <returns>HTTP 200 kèm Pet, hoặc 404 nếu không tìm thấy.</returns>
        public async Task<ActionResult<Pet>> GetPet(string id)
        {
            var pet = await _context.Pets.FindAsync(id);

            if (pet == null)
            {
                return NotFound();
            }

            return pet;
        }
        [HttpPost]
        /// <summary>Sinh mã và lưu thú cưng trước khi ảnh được upload.</summary>
        /// <param name="pet">Thông tin hồ sơ do form Flutter gửi.</param>
        /// <returns>HTTP 201 cùng petId để bước upload Cloudinary dùng tiếp.</returns>
        public async Task<ActionResult<Pet>> CreatePet(Pet pet)
        {
            // Tạo PET trước; endpoint Media sau đó dùng petId để đặt folder ảnh và kiểm tra chủ sở hữu.
            var count = await _context.Pets.CountAsync();

            pet.petId = "P" + (count + 1).ToString("D3");

            _context.Pets.Add(pet);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPet), new { id = pet.petId }, pet);
        }
        [HttpPut("{id}")]
        /// <summary>Cập nhật các trường hồ sơ thú cưng, không ghi đè dữ liệu ảnh Cloudinary.</summary>
        /// <param name="id">petId trong URL.</param>
        /// <param name="pet">Giá trị mới từ form chỉnh sửa; petId phải khớp URL.</param>
        /// <returns>204 khi lưu; 400 nếu hai mã lệch nhau; 404 nếu pet không tồn tại.</returns>
        public async Task<IActionResult> UpdatePet(string id, Pet pet)
        {
            if (id != pet.petId)
            {
                return BadRequest();
            }

            var existingPet = await _context.Pets.FindAsync(id);

            if (existingPet == null)
            {
                return NotFound();
            }

            // Copy từng trường cho phép sửa thay vì đánh dấu toàn entity từ client là Modified.
            // imageUrl/imagePublicId được MediaController quản lý nên cố ý không thay đổi ở đây.
            existingPet.userId = pet.userId;
            existingPet.petName = pet.petName;
            existingPet.species = pet.species;
            existingPet.breed = pet.breed;
            existingPet.gender = pet.gender;
            existingPet.birthDate = pet.birthDate;
            existingPet.weight = pet.weight;
            existingPet.healthStatus = pet.healthStatus;

            await _context.SaveChangesAsync();

            return NoContent();
        }
        [HttpGet("user/{userId}")]
        /// <summary>Lọc thú cưng theo chủ sở hữu.</summary>
        /// <param name="userId">Khóa UserAccount của khách hàng.</param>
        /// <returns>HTTP 200 với danh sách pet thuộc userId.</returns>
        public async Task<ActionResult<IEnumerable<Pet>>> GetPetsByUserId(string userId)
        {
            return await _context.Pets
                .Where(p => p.userId == userId)
                .ToListAsync();
        }

    }
}
