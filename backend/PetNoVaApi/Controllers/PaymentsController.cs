using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayOS;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;
using PetNoVaApi.Data;
using PetNoVaApi.Models;

namespace PetNoVaApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    /// <summary>REST API giao dịch tiền mặt và tích hợp cổng PayOS.</summary>
    public class PaymentsController : ControllerBase
    {
        private readonly PetNoVaDbContext _context;
        private readonly IConfiguration _configuration;

        /// <summary>Nhận DbContext và cấu hình PayOS qua dependency injection.</summary>
        public PaymentsController(PetNoVaDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        /// <summary>Đọc ba secret PayOS và tạo SDK client cho từng thao tác.</summary>
        /// <returns>PayOSClient đã cấu hình.</returns>
        /// <exception cref="InvalidOperationException">Thiếu ClientId, ApiKey hoặc ChecksumKey.</exception>
        private PayOSClient CreatePayOSClient()
        {
            var clientId = _configuration["PayOS:ClientId"];
            var apiKey = _configuration["PayOS:ApiKey"];
            var checksumKey = _configuration["PayOS:ChecksumKey"];

            // Không gửi request ra PayOS khi credential thiếu; action sẽ đổi lỗi này thành HTTP 503.
            if (string.IsNullOrWhiteSpace(clientId) ||
                string.IsNullOrWhiteSpace(apiKey) ||
                string.IsNullOrWhiteSpace(checksumKey))
            {
                throw new InvalidOperationException(
                    "PayOS chưa được cấu hình. Hãy thêm ClientId, ApiKey và ChecksumKey vào User Secrets."
                );
            }

            return new PayOSClient(clientId, apiKey, checksumKey);
        }

        /// <summary>Chuyển paymentId như PM001 thành orderCode số mà PayOS yêu cầu.</summary>
        /// <returns>true và orderCode dương khi mã có phần số hợp lệ.</returns>
        private static bool TryGetOrderCode(string paymentId, out long orderCode)
        {
            // PayOS chỉ nhận long, nên bỏ tiền tố PM và giữ các chữ số.
            var digits = new string(paymentId.Where(char.IsDigit).ToArray());
            return long.TryParse(digits, out orderCode) && orderCode > 0;
        }

        /// <summary>Tìm giao dịch PetNoVa tương ứng orderCode nhận từ webhook PayOS.</summary>
        /// <returns>Payment khớp hoặc null đối với webhook mẫu/đơn không thuộc hệ thống.</returns>
        private async Task<Payment?> FindPaymentByOrderCode(long orderCode)
        {
            // paymentId là chuỗi nên tải các mã PM rồi dùng cùng quy tắc TryGetOrderCode để đối chiếu.
            var candidates = await _context.Payments
                .Where(payment => payment.paymentId.StartsWith("PM"))
                .ToListAsync();

            return candidates.FirstOrDefault(payment =>
                TryGetOrderCode(payment.paymentId, out var code) && code == orderCode
            );
        }

        [HttpGet]
        /// <summary>Lấy toàn bộ giao dịch.</summary>
        /// <returns>HTTP 200 cùng danh sách PAYMENT.</returns>
        public async Task<ActionResult<IEnumerable<Payment>>> GetPayments()
        {
            return await _context.Payments.ToListAsync();
        }

        [HttpGet("{id}")]
        /// <summary>Lấy một giao dịch theo paymentId.</summary>
        /// <returns>HTTP 200 kèm Payment hoặc 404.</returns>
        public async Task<ActionResult<Payment>> GetPayment(string id)
        {
            var payment = await _context.Payments.FindAsync(id);

            if (payment == null)
            {
                return NotFound();
            }

            return payment;
        }

        [HttpGet("booking/{bookingId}")]
        /// <summary>Lấy các lần thanh toán thuộc một lịch hẹn.</summary>
        /// <returns>HTTP 200, có thể là danh sách rỗng.</returns>
        public async Task<ActionResult<IEnumerable<Payment>>> GetPaymentsByBooking(string bookingId)
        {
            // WHERE bookingId giúp màn hình lịch chỉ hiển thị giao dịch của đúng booking.
            return await _context.Payments
                .Where(payment => payment.bookingId == bookingId)
                .ToListAsync();
        }

        [HttpPost]
        /// <summary>Tạo giao dịch chờ thanh toán và sinh mã phía server.</summary>
        /// <param name="payment">bookingId, phương thức và số tiền từ Flutter.</param>
        /// <returns>201 khi tạo; 400 nếu tiền không dương hoặc booking không tồn tại.</returns>
        public async Task<ActionResult<Payment>> CreatePayment(Payment payment)
        {
            if (payment.amount <= 0)
            {
                return BadRequest("Số tiền thanh toán phải lớn hơn 0.");
            }

            // Xác minh khóa cha trước để tránh lỗi foreign key khó hiểu khi SaveChanges.
            var bookingExists = await _context.Bookings
                .AnyAsync(booking => booking.bookingId == payment.bookingId);
            if (!bookingExists)
            {
                return BadRequest("Không tìm thấy booking của thanh toán.");
            }

            var count = await _context.Payments.CountAsync();

            payment.paymentId = "PM" + (count + 1).ToString("D3");

            // Client không được tự đánh dấu PAID; trạng thái chỉ đổi qua xác nhận/PayOS.
            payment.status = "PENDING";
            payment.method = payment.method.Trim().ToUpper();
            payment.paymentDate = null;

            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetPayment),
                new { id = payment.paymentId },
                payment
            );
        }

        [HttpPost("{id}/payos-link")]
        /// <summary>Ký yêu cầu PayOS và trả checkout URL cho Flutter mở trình duyệt.</summary>
        /// <param name="id">paymentId của giao dịch BANK_TRANSFER đang PENDING.</param>
        /// <returns>200 với URL/QR; 400 trạng thái sai; 404 không có; 502 PayOS lỗi; 503 thiếu secret.</returns>
        public async Task<IActionResult> CreatePayOSPaymentLink(string id)
        {
            var payment = await _context.Payments.FindAsync(id);

            if (payment == null)
            {
                return NotFound("Không tìm thấy thanh toán.");
            }

            // Link PayOS chỉ áp dụng chuyển khoản; CASH phải được nhân viên xác nhận thủ công.
            if (payment.method.Trim().ToUpper() != "BANK_TRANSFER")
            {
                return BadRequest("Chỉ thanh toán chuyển khoản mới dùng PayOS.");
            }

            if (payment.status.Trim().ToUpper() == "PAID")
            {
                return BadRequest("Thanh toán này đã hoàn tất.");
            }

            if (!TryGetOrderCode(payment.paymentId, out var orderCode))
            {
                return BadRequest("Mã thanh toán không hợp lệ để tạo đơn PayOS.");
            }

            var amount = decimal.ToInt64(decimal.Round(payment.amount, 0));
            if (amount <= 0)
            {
                return BadRequest("Số tiền thanh toán phải lớn hơn 0.");
            }

            // Ưu tiên URL cấu hình khi deploy; localhost dùng URL suy ra từ request để phát triển.
            var callbackBaseUrl = $"{Request.Scheme}://{Request.Host}";
            var returnUrl = _configuration["PayOS:ReturnUrl"]
                ?? $"{callbackBaseUrl}/api/Payments/payos/return";
            var cancelUrl = _configuration["PayOS:CancelUrl"]
                ?? $"{callbackBaseUrl}/api/Payments/payos/cancel";

            try
            {
                // SDK ký payload bằng checksum key và tạo đơn có hạn 15 phút trên PayOS.
                var payOS = CreatePayOSClient();
                var link = await payOS.PaymentRequests.CreateAsync(
                    new CreatePaymentLinkRequest
                    {
                        OrderCode = orderCode,
                        Amount = amount,
                        Description = $"PETNOVA {payment.paymentId}",
                        ReturnUrl = returnUrl,
                        CancelUrl = cancelUrl,
                        ExpiredAt = DateTimeOffset.UtcNow.AddMinutes(15).ToUnixTimeSeconds()
                    }
                );

                // Chỉ trả các trường Flutter cần để mở checkout và hiển thị thông tin chuyển khoản.
                return Ok(new
                {
                    link.CheckoutUrl,
                    link.PaymentLinkId,
                    link.QrCode,
                    link.AccountName,
                    link.AccountNumber,
                    link.Amount,
                    link.Description,
                    Status = PaymentLinkStatusConverter.ToSerializedString(link.Status)
                });
            }
            catch (InvalidOperationException exception)
            {
                return Problem(exception.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            catch (Exception exception)
            {
                return Problem(
                    $"Không thể tạo link thanh toán PayOS: {exception.Message}",
                    statusCode: StatusCodes.Status502BadGateway
                );
            }
        }

        [HttpPost("{id}/payos-sync")]
        /// <summary>Hỏi PayOS trạng thái mới nhất và đồng bộ PetNoVaDB.</summary>
        /// <param name="id">paymentId cần kiểm tra sau khi người dùng quay lại app.</param>
        /// <returns>200 với Payment mới nhất; 400/404; hoặc 502 nếu không gọi được PayOS.</returns>
        public async Task<IActionResult> SyncPayOSPayment(string id)
        {
            var payment = await _context.Payments.FindAsync(id);
            if (payment == null)
            {
                return NotFound("Không tìm thấy thanh toán.");
            }

            if (!TryGetOrderCode(payment.paymentId, out var orderCode))
            {
                return BadRequest("Mã thanh toán không hợp lệ.");
            }

            try
            {
                // Trạng thái từ PayOS là nguồn tin cậy, không dùng kết quả return URL để đánh dấu đã trả.
                var link = await CreatePayOSClient().PaymentRequests.GetAsync(orderCode);
                var payOSStatus = PaymentLinkStatusConverter.ToSerializedString(link.Status);

                // Chỉ cập nhật khi trạng thái thay đổi để tránh tạo trùng thông báo thanh toán.
                if (payOSStatus == "PAID" && payment.status.Trim().ToUpper() != "PAID")
                {
                    await ApplyPaidStatus(payment);
                    await _context.SaveChangesAsync();
                }
                else if (payOSStatus is "CANCELLED" or "EXPIRED" or "FAILED")
                {
                    payment.status = "FAILED";
                    payment.paymentDate = DateTime.Now;
                    await _context.SaveChangesAsync();
                }

                return Ok(payment);
            }
            catch (Exception exception)
            {
                return Problem(
                    $"Không thể kiểm tra trạng thái PayOS: {exception.Message}",
                    statusCode: StatusCodes.Status502BadGateway
                );
            }
        }

        [HttpPost("payos-webhook")]
        /// <summary>Nhận webhook PayOS, xác minh chữ ký/dữ liệu và cập nhật giao dịch.</summary>
        /// <param name="webhook">Payload nguyên bản PayOS POST về backend.</param>
        /// <returns>200 để xác nhận đã nhận; 400 nếu chữ ký hoặc payload không hợp lệ.</returns>
        public async Task<IActionResult> HandlePayOSWebhook([FromBody] Webhook webhook)
        {
            try
            {
                // VerifyAsync dùng checksum key xác nhận webhook thật sự do PayOS ký.
                var verified = await CreatePayOSClient().Webhooks.VerifyAsync(webhook);
                var payment = await FindPaymentByOrderCode(verified.OrderCode);

                // PayOS gửi dữ liệu mẫu khi đăng ký webhook; vẫn cần trả 2xx.
                if (payment == null)
                {
                    return Ok(new { success = true });
                }

                // Kiểm tra cả mã thành công và số tiền trước khi ghi PAID, chống webhook sai đơn/sai tiền.
                if (verified.Code == "00" &&
                    verified.Amount == decimal.ToInt64(payment.amount) &&
                    payment.status.Trim().ToUpper() != "PAID")
                {
                    await ApplyPaidStatus(payment);
                    await _context.SaveChangesAsync();
                }

                return Ok(new { success = true });
            }
            catch (Exception exception)
            {
                return BadRequest(new { success = false, message = exception.Message });
            }
        }

        [HttpGet("payos/return")]
        /// <summary>Trang chữ đơn giản PayOS chuyển người dùng về sau khi thanh toán thành công.</summary>
        public ContentResult PayOSReturn() => Content(
            "Thanh toán thành công. Bạn có thể quay lại ứng dụng PetNoVa và bấm Kiểm tra trạng thái.",
            "text/plain; charset=utf-8"
        );

        [HttpGet("payos/cancel")]
        /// <summary>Trang chữ đơn giản PayOS chuyển về khi người dùng hủy checkout.</summary>
        public ContentResult PayOSCancel() => Content(
            "Bạn đã hủy thanh toán. Có thể quay lại PetNoVa để thử lại.",
            "text/plain; charset=utf-8"
        );

        [HttpPut("{id}/confirm")]
        /// <summary>Xác nhận thanh toán thủ công, chỉ dùng cho tiền mặt.</summary>
        /// <param name="id">paymentId cần xác nhận tại quầy.</param>
        /// <returns>204 khi thành công; 400 nếu đã trả/không phải CASH; 404 nếu không có.</returns>
        public async Task<IActionResult> ConfirmPayment(string id)
        {
            var payment = await _context.Payments.FindAsync(id);

            if (payment == null)
            {
                return NotFound();
            }

            if (payment.status.Trim().ToUpper() == "PAID")
            {
                return BadRequest("Thanh toán này đã được xác nhận trước đó.");
            }

            if (payment.method.Trim().ToUpper() != "CASH")
            {
                return BadRequest(
                    "Chỉ thanh toán tiền mặt mới được nhân viên xác nhận thủ công."
                );
            }

            // Helper dùng chung bảo đảm tiền mặt và PayOS tạo cùng loại thông báo thành công.
            await ApplyPaidStatus(payment);

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPut("{id}/failed")]
        /// <summary>Đánh dấu giao dịch thất bại và ghi thời điểm xử lý.</summary>
        /// <returns>204 khi lưu hoặc 404 nếu paymentId không tồn tại.</returns>
        public async Task<IActionResult> FailedPayment(string id)
        {
            var payment = await _context.Payments.FindAsync(id);

            if (payment == null)
            {
                return NotFound();
            }

            payment.status = "FAILED";
            payment.paymentDate = DateTime.Now;

            await _context.SaveChangesAsync();

            return NoContent();
        }
        [HttpPut("{id}/refund")]
        /// <summary>Đánh dấu giao dịch đã hoàn tiền và ghi thời điểm xử lý.</summary>
        /// <returns>204 khi lưu hoặc 404 nếu paymentId không tồn tại.</returns>
        public async Task<IActionResult> RefundPayment(string id)
        {
            var payment = await _context.Payments.FindAsync(id);

            if (payment == null)
            {
                return NotFound();
            }

            payment.status = "REFUNDED";
            payment.paymentDate = DateTime.Now;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Đánh dấu giao dịch PAID và xếp thông báo cho chủ lịch vào DbContext.</summary>
        /// <remarks>Hàm không gọi SaveChanges; action gọi nó quyết định thời điểm commit.</remarks>
        private async Task ApplyPaidStatus(Payment payment)
        {
            // Cập nhật entity Payment đang được theo dõi.
            payment.status = "PAID";
            payment.paymentDate = DateTime.Now;

            // Tra userId qua BOOKING để gửi thông báo đúng chủ giao dịch.
            var notificationCount = await _context.Notifications.CountAsync();
            _context.Notifications.Add(new Notification
            {
                notificationId = "N" + (notificationCount + 1).ToString("D3"),
                title = "Thanh toán thành công",
                message = "Dịch vụ của bạn đã được thanh toán thành công.",
                notificationType = "PAYMENT",
                isRead = false,
                createdAt = DateTime.Now,
                // CK_NOTIFICATION_RELATED_TYPE của database chỉ cho phép
                // liên kết thông báo theo nghiệp vụ BOOKING, không nhận PAYMENT.
                relatedId = payment.bookingId,
                relatedType = "BOOKING",
                userId = await _context.Bookings
                    .Where(booking => booking.bookingId == payment.bookingId)
                    .Select(booking => booking.userId)
                    .FirstAsync()
            });
        }
    }
}
