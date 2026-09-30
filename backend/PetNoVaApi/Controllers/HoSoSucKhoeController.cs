using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;
using PetNoVaApi.Services;

namespace PetNoVaApi.Controllers;

public sealed class SuaBenhAn
{
    public string diagnosis { get; set; } = "";
    public string treatment { get; set; } = "";
    public string? note { get; set; }
    public string? prescription { get; set; }
    public DateTime? followUpDate { get; set; }
    public decimal? weight { get; set; }
    public string correctionReason { get; set; } = "";
}

public sealed class SuaTiemChung
{
    public string vaccineName { get; set; } = "";
    public DateTime vaccinationDate { get; set; }
    public DateTime nextDate { get; set; }
    public string? note { get; set; }
    public string correctionReason { get; set; } = "";
}

internal static class QuyenHoSo
{
    public static DateTime Today => DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date;
    public static async Task<string?> StaffId(PetNoVaDbContext db, UserAccount user) =>
        await db.Staffs.Where(s => s.userId == user.userId && s.role == "VET" && s.status == "ACTIVE")
            .Select(s => s.staffId).FirstOrDefaultAsync();
    public static bool ValidReason(string? text) => !string.IsNullOrWhiteSpace(text) && text.Length <= 500;
}

[Route("api/MedicalRecords"), ApiController]
public sealed class MedicalRecordsController(PetNoVaDbContext db) : ControllerBase
{
    private UserAccount Current => PhienNguoiDung.Get(HttpContext);
    private IQueryable<MedicalRecord> Visible => db.MedicalRecords.Where(r =>
        PhienNguoiDung.Pets(db, Current).Select(p => p.petId).Contains(r.petId));

    [HttpGet]
    public async Task<IActionResult> GetMedicalRecords() => Ok(await Visible.AsNoTracking()
        .OrderByDescending(r => r.recordDate).Take(500).ToListAsync());

    [HttpGet("pet/{petId}")]
    public async Task<IActionResult> GetMedicalRecordsByPet(string petId)
    {
        if (!await PhienNguoiDung.Pets(db, Current).AnyAsync(p => p.petId == petId)) return NotFound();
        return Ok(await Visible.Where(r => r.petId == petId).AsNoTracking()
            .OrderByDescending(r => r.recordDate).ToListAsync());
    }

    [HttpGet("{id}/revisions")]
    public async Task<IActionResult> Revisions(string id)
    {
        if (Current.role is not ("VET" or "ADMIN") || !await Visible.AnyAsync(r => r.recordId == id)) return NotFound();
        return Ok(await db.ClinicalRevisions.AsNoTracking().Where(r => r.entityType == "MEDICAL_RECORD" && r.entityId == id)
            .OrderByDescending(r => r.createdAt).ToListAsync());
    }

    [HttpPost]
    public async Task<IActionResult> CreateMedicalRecord(MedicalRecord record)
    {
        if (!Valid(record.diagnosis, 255) || !Valid(record.treatment, 2000) || record.note?.Length > 2000 ||
            record.prescription?.Length > 2000 || record.weight is <= 0 or > 999 ||
            record.followUpDate is { } due && due.Date < QuyenHoSo.Today)
            return BadRequest("Nội dung bệnh án hoặc ngày tái khám không hợp lệ.");
        var pet = await PhienNguoiDung.Pets(db, Current).FirstOrDefaultAsync(p => p.petId == record.petId);
        if (pet is null) return NotFound("Không tìm thấy thú cưng được phân công.");
        var staffId = Current.role == "VET" ? await QuyenHoSo.StaffId(db, Current) : record.staffId;
        if (staffId is null || !await db.Staffs.AnyAsync(s => s.staffId == staffId && s.role == "VET" && s.status == "ACTIVE"))
            return BadRequest("Không tìm thấy bác sĩ đang hoạt động.");
        record.recordId = await MaDinhDanh.NextAsync(db, "MEDICAL_RECORD", "recordId", "MR");
        record.staffId = staffId; record.recordDate = QuyenHoSo.Today;
        if (record.weight.HasValue) pet.weight = record.weight.Value;
        db.MedicalRecords.Add(record); await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetMedicalRecordsByPet), new { petId = record.petId }, record);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Correct(string id, SuaBenhAn request)
    {
        var record = await Visible.FirstOrDefaultAsync(r => r.recordId == id);
        if (record is null) return NotFound();
        if (!await CanEdit(record.staffId) || !QuyenHoSo.ValidReason(request.correctionReason) ||
            !Valid(request.diagnosis, 255) || !Valid(request.treatment, 2000) ||
            request.note?.Length > 2000 || request.prescription?.Length > 2000 ||
            request.weight is <= 0 or > 999 || request.followUpDate is { } due && due.Date < record.recordDate.Date)
            return BadRequest("Lý do sửa hoặc nội dung bệnh án không hợp lệ.");
        var snapshot = JsonSerializer.Serialize(record);
        db.ClinicalRevisions.Add(new LichSuHoSo { entityType = "MEDICAL_RECORD", entityId = id,
            oldData = snapshot, reason = request.correctionReason.Trim(), userId = Current.userId, createdAt = DateTime.UtcNow });
        record.diagnosis = request.diagnosis.Trim(); record.treatment = request.treatment.Trim();
        record.note = request.note?.Trim(); record.prescription = request.prescription?.Trim();
        record.followUpDate = request.followUpDate; record.weight = request.weight;
        if (request.weight.HasValue)
        {
            var pet = await db.Pets.FirstAsync(p => p.petId == record.petId);
            pet.weight = request.weight.Value;
        }
        await db.SaveChangesAsync(); return Ok(record);
    }

    private async Task<bool> CanEdit(string authorStaffId) => Current.role == "ADMIN" ||
        (Current.role == "VET" && await db.Staffs.AnyAsync(s => s.staffId == authorStaffId && s.userId == Current.userId));
    private static bool Valid(string? text, int max) => !string.IsNullOrWhiteSpace(text) && text.Length <= max;
}

[Route("api/Vaccinations"), ApiController]
public sealed class VaccinationsController(PetNoVaDbContext db) : ControllerBase
{
    private UserAccount Current => PhienNguoiDung.Get(HttpContext);
    private IQueryable<Vaccination> Visible => db.Vaccinations.Where(v =>
        PhienNguoiDung.Pets(db, Current).Select(p => p.petId).Contains(v.petId));

    [HttpGet]
    public async Task<IActionResult> GetVaccinations() => Ok(await Visible.AsNoTracking()
        .OrderByDescending(v => v.vaccinationDate).Take(500).ToListAsync());
    [HttpGet("pet/{petId}")]
    public async Task<IActionResult> GetVaccinationsByPet(string petId)
    {
        if (!await PhienNguoiDung.Pets(db, Current).AnyAsync(p => p.petId == petId)) return NotFound();
        return Ok(await Visible.Where(v => v.petId == petId).AsNoTracking()
            .OrderByDescending(v => v.vaccinationDate).ToListAsync());
    }
    [HttpGet("{id}/revisions")]
    public async Task<IActionResult> Revisions(string id)
    {
        if (Current.role is not ("VET" or "ADMIN") || !await Visible.AnyAsync(v => v.vaccinationId == id)) return NotFound();
        return Ok(await db.ClinicalRevisions.AsNoTracking().Where(r => r.entityType == "VACCINATION" && r.entityId == id)
            .OrderByDescending(r => r.createdAt).ToListAsync());
    }

    [HttpPost]
    public async Task<IActionResult> CreateVaccination(Vaccination item)
    {
        if (!Valid(item.vaccineName, 100) || item.note?.Length > 255 || !ValidDates(item.vaccinationDate, item.nextDate))
            return BadRequest("Thông tin mũi tiêm hoặc ngày nhắc lại không hợp lệ.");
        if (!await PhienNguoiDung.Pets(db, Current).AnyAsync(p => p.petId == item.petId)) return NotFound();
        var staffId = Current.role == "VET" ? await QuyenHoSo.StaffId(db, Current) : item.staffId;
        if (staffId is null || !await db.Staffs.AnyAsync(s => s.staffId == staffId && s.role == "VET" && s.status == "ACTIVE"))
            return BadRequest("Không tìm thấy bác sĩ đang hoạt động.");
        item.staffId = staffId;
        item.vaccinationId = await MaDinhDanh.NextAsync(db, "VACCINATION", "vaccinationId", "VC");
        db.Vaccinations.Add(item); await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetVaccinationsByPet), new { petId = item.petId }, item);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Correct(string id, SuaTiemChung request)
    {
        var item = await Visible.FirstOrDefaultAsync(v => v.vaccinationId == id);
        if (item is null) return NotFound();
        var own = Current.role == "ADMIN" || await db.Staffs.AnyAsync(s => s.staffId == item.staffId && s.userId == Current.userId);
        if (!own || !QuyenHoSo.ValidReason(request.correctionReason) || !Valid(request.vaccineName, 100) ||
            request.note?.Length > 255 || !ValidDates(request.vaccinationDate, request.nextDate))
            return BadRequest("Lý do sửa hoặc thông tin tiêm chủng không hợp lệ.");
        db.ClinicalRevisions.Add(new LichSuHoSo { entityType = "VACCINATION", entityId = id,
            oldData = JsonSerializer.Serialize(item), reason = request.correctionReason.Trim(),
            userId = Current.userId, createdAt = DateTime.UtcNow });
        item.vaccineName = request.vaccineName.Trim(); item.vaccinationDate = request.vaccinationDate.Date;
        item.nextDate = request.nextDate.Date; item.note = request.note?.Trim();
        await db.SaveChangesAsync(); return Ok(item);
    }
    private static bool Valid(string? text, int max) => !string.IsNullOrWhiteSpace(text) && text.Length <= max;
    private static bool ValidDates(DateTime date, DateTime next) => date.Date <= QuyenHoSo.Today &&
        date.Year >= 2000 && next.Date > date.Date && next.Date <= date.Date.AddYears(10);
}
