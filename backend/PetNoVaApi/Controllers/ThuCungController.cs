using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers;

[Route("api/Pets"), ApiController]
public sealed class PetsController(PetNoVaDbContext db) : ControllerBase
{
    private UserAccount Current => PhienNguoiDung.Get(HttpContext);
    private IQueryable<Pet> Visible => PhienNguoiDung.Pets(db, Current);
    private static DateTime Today => DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date;

    [HttpGet]
    public async Task<IActionResult> GetPets() => Ok(await Visible.Where(p => !p.isArchived)
        .AsNoTracking().OrderBy(p => p.petName).ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPet(string id)
    {
        var pet = await Visible.AsNoTracking().FirstOrDefaultAsync(p => p.petId == id);
        return pet is null ? NotFound() : Ok(pet);
    }

    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetPetsByUserId(string userId) => Ok(await Visible
        .Where(p => p.userId == userId && !p.isArchived).AsNoTracking().ToListAsync());

    [HttpPost]
    public async Task<IActionResult> CreatePet(Pet pet)
    {
        if (!Valid(pet)) return BadRequest("Thông tin thú cưng không hợp lệ.");
        pet.userId = Current.role == "ADMIN" ? pet.userId : Current.userId;
        if (!await db.UserAccounts.AnyAsync(u => u.userId == pet.userId)) return BadRequest("Không tìm thấy chủ nuôi.");
        pet.petId = await MaDinhDanh.NextAsync(db, "PET", "petId", "P");
        pet.isArchived = false; pet.imageUrl = null; pet.imagePublicId = null;
        db.Pets.Add(pet); await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetPet), new { id = pet.petId }, pet);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePet(string id, Pet pet)
    {
        if (id != pet.petId || !Valid(pet)) return BadRequest("Thông tin thú cưng không hợp lệ.");
        var existing = await Visible.FirstOrDefaultAsync(p => p.petId == id);
        if (existing is null) return NotFound();
        if (Current.role == "STAFF") return StatusCode(403, new { message = "Không có quyền sửa hồ sơ." });
        if (Current.role != "VET")
        {
            existing.petName = pet.petName.Trim(); existing.species = pet.species.Trim();
            existing.breed = pet.breed.Trim(); existing.gender = pet.gender; existing.birthDate = pet.birthDate;
        }
        existing.weight = pet.weight; existing.healthStatus = pet.healthStatus.Trim();
        await db.SaveChangesAsync(); return NoContent();
    }

    [HttpPut("{id}/archive")]
    public async Task<IActionResult> ArchivePet(string id)
    {
        if (Current.role is not ("CUSTOMER" or "ADMIN")) return StatusCode(403);
        var pet = await Visible.FirstOrDefaultAsync(p => p.petId == id);
        if (pet is null) return NotFound();
        if (await db.Bookings.AnyAsync(b => b.petId == id && b.status != "COMPLETED" && b.status != "CANCELLED"))
            return Conflict("Thú cưng đang có lịch hẹn. Hãy hoàn tất hoặc hủy lịch trước khi lưu trữ hồ sơ.");
        pet.isArchived = true; await db.SaveChangesAsync(); return NoContent();
    }

    private static bool Valid(Pet p) => !string.IsNullOrWhiteSpace(p.petName) && p.petName.Length <= 100 &&
        !string.IsNullOrWhiteSpace(p.species) && p.species.Length <= 50 &&
        !string.IsNullOrWhiteSpace(p.breed) && p.breed.Length <= 100 &&
        p.gender is ("Đực" or "Cái" or "Khác") && p.weight > 0 && p.weight < 1000 &&
        p.birthDate.Date <= Today && p.birthDate.Year >= 1900 &&
        p.healthStatus is not null && p.healthStatus.Length <= 255;
}
