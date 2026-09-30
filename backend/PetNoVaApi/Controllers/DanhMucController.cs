using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers;

[Route("api/ServiceCategories"), ApiController]
public sealed class ServiceCategoriesController(PetNoVaDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await db.ServiceCategories.AsNoTracking().OrderBy(c => c.categoryName).ToListAsync());
    [HttpGet("care-types")]
    public async Task<IActionResult> GetCareTypes() => Ok(await db.CareTypes.AsNoTracking().ToListAsync());
    [HttpPost]
    public async Task<IActionResult> Create(DanhMucDichVu item)
    {
        if (string.IsNullOrWhiteSpace(item.categoryName)) return BadRequest("Nhập tên danh mục.");
        item.categoryId = await MaDinhDanh.NextAsync(db, "SERVICE_CATEGORY", "categoryId", "SC");
        item.categoryName = item.categoryName.Trim(); item.status = "ACTIVE";
        db.ServiceCategories.Add(item); await db.SaveChangesAsync(); return Ok(item);
    }
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, DanhMucDichVu item)
    {
        if (string.IsNullOrWhiteSpace(item.categoryName) || item.status is not ("ACTIVE" or "INACTIVE")) return BadRequest("Tên hoặc trạng thái không hợp lệ.");
        var existing = await db.ServiceCategories.FindAsync(id);
        if (existing is null) return NotFound();
        existing.categoryName = item.categoryName.Trim(); existing.description = item.description.Trim(); existing.status = item.status;
        await db.SaveChangesAsync(); return NoContent();
    }
}

[Route("api/AuditLogs"), ApiController]
public sealed class AuditLogsController(PetNoVaDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(DateTime? from, DateTime? to, int page = 1)
    {
        if (from.HasValue && to.HasValue && from > to) return BadRequest("Khoảng thời gian không hợp lệ.");
        var query = db.AuditLogs.AsNoTracking().AsQueryable();
        if (from.HasValue) query = query.Where(a => a.createdAt >= from.Value.Date);
        if (to.HasValue) { var end = to.Value.Date.AddDays(1); query = query.Where(a => a.createdAt < end); }
        Response.Headers["X-Total-Count"] = (await query.CountAsync()).ToString();
        return Ok(await query.OrderByDescending(a => a.id).Skip((Math.Clamp(page, 1, 10000) - 1) * 100).Take(100).ToListAsync());
    }
}
