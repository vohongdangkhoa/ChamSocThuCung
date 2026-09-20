using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>REST API đọc và tạo bệnh án thú cưng.</summary>
    public class MedicalRecordsController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;

        /// <summary>Nhận DbContext để đọc/ghi bảng MEDICAL_RECORD.</summary>
        public MedicalRecordsController(PetNoVaDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        /// <summary>Lấy toàn bộ bệnh án cho vai trò nội bộ.</summary>
        /// <returns>HTTP 200 cùng danh sách bệnh án.</returns>
        public async Task<ActionResult<IEnumerable<MedicalRecord>>> GetMedicalRecords()
        {
            return await _context.MedicalRecords.ToListAsync();
        }

        [HttpGet("pet/{petId}")]
        /// <summary>Lấy lịch sử khám của một thú cưng.</summary>
        /// <param name="petId">Khóa pet dùng trong điều kiện lọc.</param>
        /// <returns>HTTP 200 với bệnh án mới nhất đứng trước.</returns>
        public async Task<ActionResult<IEnumerable<MedicalRecord>>> GetMedicalRecordsByPet(string petId)
        {
            // Sắp giảm dần theo ngày giúp màn hình hiển thị lần khám gần nhất trước tiên.
            return await _context.MedicalRecords
                 .Where(m => m.petId == petId)
                 .OrderByDescending(m => m.recordDate)
                 .ToListAsync();
        }

        [HttpPost]
        /// <summary>Sinh mã và lưu bệnh án mới.</summary>
        /// <param name="record">Chẩn đoán, điều trị, petId, staffId và ghi chú từ form.</param>
        /// <returns>HTTP 201 cùng bệnh án vừa tạo.</returns>
        public async Task<ActionResult<MedicalRecord>> CreateMedicalRecord(MedicalRecord record)
        {
            var count = await _context.MedicalRecords.CountAsync();

            // Backend tự đặt mã và ngày hiện tại để client không giả mạo thời điểm lập bệnh án.
            record.recordId = "MR" + (count + 1).ToString("D3");
            record.recordDate = DateTime.Now;

            _context.MedicalRecords.Add(record);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetMedicalRecordsByPet),
                new { petId = record.petId },
                record
            );
        }
    }
}
