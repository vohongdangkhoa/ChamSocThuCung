using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetNoVaApi.Data;

namespace PetNoVaApi.Controllers;

[Route("api/Reports"), ApiController]
public sealed class ReportsController(PetNoVaDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(DateTime? from, DateTime? to)
    {
        var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date;
        var start = (from ?? today.AddMonths(-1)).Date;
        var end = (to ?? today).Date;
        if (end < start || end > start.AddYears(3)) return BadRequest("Chọn khoảng báo cáo tối đa 3 năm.");
        var exclusive = end.AddDays(1);
        var bookings = await db.Bookings.AsNoTracking().Where(b => b.bookingDate >= start && b.bookingDate < exclusive)
            .Select(b => new { b.bookingId, b.bookingDate, b.status, b.totalAmount }).ToListAsync();
        var payments = await db.Payments.AsNoTracking().Where(p =>
            (p.paymentDate >= start && p.paymentDate < exclusive) ||
            (p.refundedAt >= start && p.refundedAt < exclusive))
            .Select(p => new { p.paymentId, p.bookingId, p.amount, p.status, p.paymentDate, p.refundedAt }).ToListAsync();
        var details = await db.BookingDetails.AsNoTracking().Where(d =>
            db.Bookings.Any(b => b.bookingId == d.bookingId && b.bookingDate >= start && b.bookingDate < exclusive))
            .Join(db.ServicePackages, d => d.serviceId, s => s.serviceId,
                (d, s) => new { s.serviceId, s.serviceName, d.quantity, d.price }).ToListAsync();
        var paid = payments.Where(p => (p.status == "PAID" || p.status == "REFUNDED") && p.paymentDate >= start && p.paymentDate < exclusive).ToList();
        var refunded = payments.Where(p => p.status == "REFUNDED" && p.refundedAt >= start && p.refundedAt < exclusive).ToList();
        var byDay = bookings.GroupBy(b => b.bookingDate.Date).Select(g => new
        {
            date = g.Key.ToString("yyyy-MM-dd"), bookings = g.Count(), completed = g.Count(b => b.status == "COMPLETED"),
            bookedAmount = g.Sum(b => b.totalAmount)
        }).OrderBy(x => x.date).ToList();
        var byService = details.GroupBy(d => new { d.serviceId, d.serviceName }).Select(g => new
        {
            g.Key.serviceId, g.Key.serviceName, quantity = g.Sum(d => d.quantity),
            bookedAmount = g.Sum(d => d.price * d.quantity)
        }).OrderByDescending(x => x.bookedAmount).ToList();
        return Ok(new
        {
            from = start.ToString("yyyy-MM-dd"), to = end.ToString("yyyy-MM-dd"),
            bookings = bookings.Count, completed = bookings.Count(b => b.status == "COMPLETED"),
            bookedAmount = bookings.Sum(b => b.totalAmount), paidAmount = paid.Sum(p => p.amount),
            refundAmount = refunded.Sum(p => p.amount), netCollected = paid.Sum(p => p.amount) - refunded.Sum(p => p.amount),
            byDay, byService
        });
    }
}
