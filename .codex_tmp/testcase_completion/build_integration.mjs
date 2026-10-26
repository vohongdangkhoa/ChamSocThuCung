import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const root = 'C:/Users/vohon/petnova_app';
const out = `${root}/outputs/01a0c27b-f522-7c62-8cec-50db5c0bf907/PetNoVa_IntegrationTestCase.xlsx`;
const previewDir = `${root}/.codex_tmp/testcase_completion/integration_previews`;

// These are designed test cases, not records of execution. Each case checks a
// junction between PetNoVa modules or an external service.
const requirements = [
  ['ITR01','Firebase Authentication ↔ hồ sơ SQL: UID, email, vai trò và trạng thái tài khoản.','F1.1, F1.3, F1.4; UserAccountsController.cs, xac-thuc.jsx'],
  ['ITR02','Đặt lại mật khẩu: số điện thoại SQL ↔ OTP email ↔ mật khẩu Firebase.','F1.5–F1.7; PasswordResetController.cs, PasswordResetService.cs'],
  ['ITR03','Hồ sơ thú cưng ↔ đặt lịch: quyền sở hữu và điều kiện lưu trữ thú cưng.','F3.2, F3.5, F4.5; ThuCungController.cs, LichHenController.cs'],
  ['ITR04','Ảnh thú cưng: tải Cloudinary ↔ URL/publicId trong hồ sơ SQL.','F3.4; MediaController.cs'],
  ['ITR05','Danh mục/gói dịch vụ quản trị ↔ danh sách đặt lịch và kiểm tra gói đang hoạt động.','F4.3, F11.10–F11.12; DanhMucController.cs, ServicePackagesController.cs'],
  ['ITR06','Tạo lịch ↔ chi tiết dịch vụ ↔ khoản thanh toán ↔ thông báo khách hàng.','F4.5–F4.7, F7; LichHenController.cs'],
  ['ITR07','Dịch vụ/thú cưng/nhân sự ↔ kiểm tra chỗ trống và xung đột lịch.','F4.4, F4.7; LichHenController.cs'],
  ['ITR08','Đổi lịch ↔ năng lực khung giờ ↔ lịch hiển thị/thông báo.','F4.8, F7; LichHenController.cs'],
  ['ITR09','Hủy lịch ↔ trạng thái thanh toán ↔ giải phóng chỗ/thông báo.','F4.9, F5.1, F7; LichHenController.cs'],
  ['ITR10','PayOS ↔ thanh toán PetNoVa: tạo link, đồng bộ/webhook và thông báo.','F4.6, F5.2; PaymentsController.cs'],
  ['ITR11','Thanh toán thất bại ↔ tạo giao dịch thanh toán lại cho cùng lịch.','F5.3; PaymentsController.cs'],
  ['ITR12','Phân công nhân sự ↔ lịch công việc của bác sĩ/nhân viên và thông báo khách.','F9.3, F7; LichHenController.cs, StaffsController.cs'],
  ['ITR13','Trạng thái lịch ↔ thanh toán tiền mặt ↔ điều kiện hoàn thành và thông báo.','F9.5–F9.7, F7; LichHenController.cs, PaymentsController.cs'],
  ['ITR14','Hồ sơ khám ↔ cân nặng thú cưng ↔ lịch sử sức khỏe chủ nuôi.','F6, F10.4; HoSoSucKhoeController.cs'],
  ['ITR15','Lịch tiêm ↔ tác vụ nhắc lịch ↔ thông báo đúng chủ thú cưng.','F7, F10.6; HoSoSucKhoeController.cs, NhacLichTuDong.cs'],
  ['ITR16','Trạng thái nhân sự ↔ tài khoản SQL ↔ khả năng đăng nhập/phân công.','F11.7–F11.8, F9.3; StaffsController.cs, LichHenController.cs'],
  ['ITR17','Vai trò/quyền sở hữu ↔ API lịch, thanh toán và hồ sơ sức khỏe.','F11.3–F11.4, F12.1–F12.2; PhienNguoiDung.cs và controllers'],
  ['ITR18','Đặt lịch/thanh toán/hoàn tiền ↔ số liệu báo cáo quản trị.','F9.9, F11.14; PaymentsController.cs, BaoCaoController.cs'],
];
const C=(req,objective,pre,notes,steps)=>({req,objective,pre,notes,steps:steps.map(([action,data,expected])=>({action,data,expected}))});
const cases=[
  C('ITR01','Đăng ký Firebase tạo đúng một hồ sơ CUSTOMER trong SQL','Email và số điện thoại thử nghiệm chưa có tài khoản; Firebase và API sẵn sàng.','Không nhập thông tin cá nhân thật; dùng dữ liệu thử nghiệm.','1. Đăng ký trên web bằng email/số điện thoại thử nghiệm.|Email A, điện thoại A|Firebase tạo danh tính và web nhận phiên đăng nhập.\n2. Tra hồ sơ người dùng bằng tài khoản vừa tạo.|Firebase UID/email A|SQL có đúng một UserAccount gắn UID/email A, role CUSTOMER, status ACTIVE.\n3. Đăng xuất rồi đăng nhập lại.|Email A và mật khẩu đã tạo|Web ghép lại đúng hồ sơ SQL, vào cổng khách hàng.'.split('\n').map(x=>x.split('|'))),
  C('ITR01','Tài khoản SQL bị khóa không vào được cổng dù token Firebase còn hợp lệ','Có tài khoản thử nghiệm ACTIVE đã đăng nhập; ADMIN có quyền đổi trạng thái.','Kiểm tra cả phiên đang mở và lần đăng nhập lại.','1. ADMIN đổi UserAccount sang INACTIVE.|UserAccount A|SQL lưu status INACTIVE.\n2. Tải lại cổng khách hàng bằng phiên Firebase A.|Token Firebase A còn hợp lệ|Web/API từ chối sử dụng hồ sơ đang INACTIVE.\n3. Đăng xuất và đăng nhập lại tài khoản A.|Email A|Không truy cập được chức năng của cổng khách hàng.'.split('\n').map(x=>x.split('|'))),
  C('ITR02','Số điện thoại đã liên kết nhận OTP email và đổi mật khẩu Firebase','Có tài khoản thử nghiệm với điện thoại và email truy cập được; dịch vụ email/Firebase cấu hình.','Thực hiện ở môi trường thử nghiệm; không ghi OTP hay mật khẩu thật vào file.','1. Yêu cầu đặt lại mật khẩu bằng số điện thoại.|Điện thoại A|API trả challengeId và email đã che; OTP tới email liên kết.\n2. Xác minh OTP hợp lệ.|challengeId, OTP từ email A|API trả reset token dùng một lần.\n3. Hoàn tất với mật khẩu mới rồi đăng nhập.|reset token, mật khẩu mới|Firebase chấp nhận mật khẩu mới; mật khẩu cũ không còn dùng được.'.split('\n').map(x=>x.split('|'))),
  C('ITR02','OTP sai hoặc token dùng lại không cập nhật mật khẩu Firebase','Có challenge thử nghiệm còn hạn.','Không suy diễn gửi email thành công nếu hạ tầng chưa cấu hình.','1. Gửi OTP sai với challengeId.|OTP sai|API không cấp reset token.\n2. Xác minh bằng OTP đúng và hoàn tất một lần.|OTP đúng, mật khẩu mới|Lần hoàn tất đầu thành công.\n3. Gửi lại cùng reset token với mật khẩu khác.|Token đã dùng|API từ chối; đăng nhập vẫn chỉ dùng mật khẩu của lần hoàn tất đầu.'.split('\n').map(x=>x.split('|'))),
  C('ITR03','Thú cưng mới được chọn để đặt lịch và liên kết đúng chủ nuôi','Khách hàng A có tài khoản ACTIVE; có gói dịch vụ ACTIVE và ngày/giờ còn chỗ.','Luồng Pet ↔ Booking.','1. Khách hàng A tạo thú cưng thử nghiệm.|Pet A|Pet xuất hiện trong danh sách của A, có petId.\n2. Chọn Pet A khi đặt lịch.|petId của Pet A|Lịch được tạo với petId Pet A, userId của A.\n3. Khách hàng B đọc/thử đặt lịch cho petId A.|Tài khoản B|API không trả hồ sơ hoặc từ chối tạo lịch bằng Pet A.'.split('\n').map(x=>x.split('|'))),
  C('ITR03','Không lưu trữ thú cưng còn lịch mở; lịch kết thúc thì lưu trữ được','Pet A có lịch PENDING/CONFIRMED thử nghiệm.','Archive kiểm tra trạng thái Booking.','1. Lưu trữ Pet A khi còn lịch đang mở.|petId A|API trả xung đột; pet vẫn ACTIVE trong danh sách.\n2. Hủy hoặc hoàn thành lịch theo quy trình phù hợp.|bookingId liên quan|Lịch chuyển CANCELLED hoặc COMPLETED.\n3. Lưu trữ lại Pet A và mở danh sách đặt lịch.|petId A|Pet được đánh dấu archived và không còn được chọn để tạo lịch mới.'.split('\n').map(x=>x.split('|'))),
  C('ITR04','Upload ảnh thú cưng cập nhật URL và publicId sau khi Cloudinary thành công','Khách hàng A sở hữu Pet A; Cloudinary được cấu hình; có ảnh thử nghiệm hợp lệ.','MediaController upload trước rồi mới lưu URL SQL.','1. Upload ảnh hợp lệ cho Pet A.|JPG/PNG hợp lệ|Cloudinary trả ảnh; API trả URL/publicId.\n2. Tải lại hồ sơ Pet A.|petId A|Ảnh hiển thị từ URL đã lưu; imageUrl/imagePublicId gắn với Pet A.\n3. Upload ảnh thay thế.|Ảnh B hợp lệ|Hồ sơ trỏ tới ảnh B; không còn trỏ tới ảnh A.'.split('\n').map(x=>x.split('|'))),
  C('ITR04','Cloudinary lỗi không ghi URL ảnh không tồn tại vào SQL','Pet A có ảnh trước đó hoặc chưa có ảnh; có cách mô phỏng Cloudinary lỗi/thiếu cấu hình.','Cần môi trường test kiểm soát lỗi upstream.','1. Ghi nhận imageUrl hiện tại của Pet A.|petId A|Có giá trị mốc để đối chiếu.\n2. Thử upload khi Cloudinary trả lỗi hoặc thiếu cấu hình.|Ảnh hợp lệ|API báo lỗi 502/503 tương ứng.\n3. Tải lại hồ sơ Pet A.|petId A|imageUrl/imagePublicId vẫn là giá trị cũ; không hiển thị URL ảnh thất bại.'.split('\n').map(x=>x.split('|'))),
  C('ITR05','Gói dịch vụ ACTIVE từ quản trị xuất hiện ở luồng đặt lịch','ADMIN có quyền quản lý danh mục/gói; khách A đăng nhập.','Frontend lọc gói ACTIVE; backend cũng kiểm tra khi tạo lịch.','1. ADMIN tạo danh mục ACTIVE và gói ACTIVE.|Danh mục D, gói S giá/thời lượng >0|Gói S gắn đúng danh mục và lưu ACTIVE.\n2. Khách A mở màn hình đặt lịch.|Tài khoản A|Gói S hiển thị với giá, thời lượng đã lưu.\n3. Chọn gói S và xem giờ trống.|Pet A, ngày hợp lệ|Thời lượng tổng và giờ trống tính từ thời lượng của S.'.split('\n').map(x=>x.split('|'))),
  C('ITR05','Gói chuyển INACTIVE không thể tạo lịch mới dù dùng ID cũ','Đã có gói S ACTIVE; ADMIN và khách A có tài khoản.','Kiểm tra cả UI và API để tránh lọt qua bộ lọc giao diện.','1. ADMIN chuyển gói S sang INACTIVE.|serviceId S|Trạng thái gói được lưu INACTIVE.\n2. Khách A tải lại form đặt lịch.|Tài khoản A|Gói S không còn trong danh sách chọn.\n3. Gửi yêu cầu tạo lịch dùng serviceId S cũ.|Pet A, S, ngày/giờ hợp lệ|API từ chối; không phát sinh Booking, BookingDetail, Payment.'.split('\n').map(x=>x.split('|'))),
  C('ITR06','Tạo lịch tiền mặt tạo đầy đủ dữ liệu liên kết','Khách A có Pet A; dịch vụ S ACTIVE; giờ còn chỗ.','Đối chiếu cùng bookingId qua các màn hình/API.','1. Khách A đặt lịch tiền mặt.|Pet A, S, CASH, requestId mới|API tạo một Booking PENDING với tổng tiền bằng giá gói.\n2. Mở chi tiết lịch và thanh toán.|bookingId vừa tạo|BookingDetail chứa S/giá đúng; Payment CASH PENDING có cùng bookingId.\n3. Mở thông báo của khách A.|Tài khoản A|Có thông báo đặt lịch liên kết bookingId; khách khác không thấy.'.split('\n').map(x=>x.split('|'))),
  C('ITR06','Gửi lại cùng requestId không nhân đôi lịch, thanh toán, thông báo','Đã tạo lịch thử nghiệm thành công với requestId R.','Idempotency trong BookingsController.','1. Ghi bookingId, số payment và thông báo của lịch R.|requestId R|Có mốc đối chiếu.\n2. Gửi lại POST tạo lịch với cùng requestId R.|Cùng tài khoản và R|API trả lịch cũ thay vì tạo lịch mới.\n3. Đọc lại lịch, payment và thông báo.|bookingId của R|Vẫn chỉ có một Booking và một Payment cho yêu cầu R; không tạo thêm thông báo đặt lịch.'.split('\n').map(x=>x.split('|'))),
  C('ITR07','Đặt lịch chiếm chỗ và chặn lịch trùng của cùng thú cưng','Pet A, S ACTIVE; chọn ngày/giờ trống trong vòng 6 tháng.','So sánh GET availability và POST Booking.','1. Kiểm tra khung giờ còn trống cho Pet A.|Ngày D, giờ T, S|Availability báo T còn chọn được.\n2. Tạo lịch cho Pet A vào T.|D, T, S|Booking PENDING được tạo.\n3. Kiểm tra và thử đặt thêm lịch chồng giờ cho Pet A.|Cùng Pet A, khung giờ chồng lấn|Availability báo xung đột; POST trả Conflict, không tạo Payment mới.'.split('\n').map(x=>x.split('|'))),
  C('ITR07','Thời lượng nhiều gói được cộng khi kiểm tra năng lực khung giờ','Có hai gói S1, S2 ACTIVE và Pet A; còn chỗ vào một số khung giờ.','Kiểm tra dữ liệu dịch vụ truyền sang availability/booking.','1. Chọn S1 và S2 rồi hỏi availability.|duration S1 + S2|durationMinutes bằng tổng hai gói.\n2. Chọn giờ gần cuối ngày không đủ tổng thời lượng.|Ngày D, giờ T|Giờ T bị đánh dấu không khả dụng hoặc POST bị từ chối.\n3. Chọn giờ đủ thời lượng và tạo lịch.|Pet A, S1, S2|Booking.durationMinutes bằng tổng; có hai BookingDetail với giá tương ứng.'.split('\n').map(x=>x.split('|'))),
  C('ITR08','Đổi lịch hợp lệ cập nhật giờ ở các góc nhìn và tạo thông báo','Khách A có lịch PENDING hoặc CONFIRMED; giờ mới còn chỗ.','Luồng Booking ↔ availability ↔ Notifications.','1. Ghi thời gian cũ và đổi lịch sang giờ mới.|bookingId, ngày/giờ mới|API cập nhật bookingDate/bookingTime.\n2. Tải lại danh sách lịch của khách và vận hành.|bookingId|Cả hai góc nhìn hiển thị thời gian mới; giờ cũ không còn bị lịch đó chiếm.\n3. Mở thông báo khách A.|bookingId|Có thông báo thay đổi lịch liên kết bookingId.'.split('\n').map(x=>x.split('|'))),
  C('ITR08','Đổi sang giờ xung đột không thay đổi lịch hay gửi thông báo','Có lịch A và khung giờ mới đã xung đột với Pet A/nhân sự.','Kiểm tra tính nhất quán khi API trả Conflict.','1. Ghi thời gian và số thông báo ban đầu của lịch A.|bookingId A|Có mốc đối chiếu.\n2. Đổi lịch A sang giờ xung đột.|Ngày/giờ chồng lấn|API trả Conflict.\n3. Tải lại lịch và thông báo.|bookingId A|Ngày/giờ vẫn như cũ; không có thông báo đổi lịch mới.'.split('\n').map(x=>x.split('|'))),
  C('ITR09','Hủy lịch chưa trả tiền đổi Payment PENDING thành FAILED và giải phóng chỗ','Khách A có lịch PENDING/CONFIRMED và Payment PENDING.','Luồng Booking ↔ Payment ↔ capacity ↔ Notification.','1. Hủy lịch A.|bookingId A|Booking chuyển CANCELLED.\n2. Mở thanh toán và thông báo của A.|bookingId A|Payment PENDING của lịch đổi FAILED; có thông báo hủy.\n3. Hỏi availability tại khung giờ cũ.|Pet A, ngày/giờ cũ|Lịch đã hủy không còn chiếm chỗ.'.split('\n').map(x=>x.split('|'))),
  C('ITR09','Lịch đã PAID không hủy trực tiếp trước khi xử lý hoàn tiền','Có lịch PENDING/CONFIRMED với Payment PAID.','Backend trả Conflict và yêu cầu xử lý hoàn tiền trước.','1. Ghi trạng thái lịch và Payment.|bookingId A|Booking chưa CANCELLED, Payment PAID.\n2. Thử hủy lịch A.|bookingId A|API trả Conflict với thông báo xử lý hoàn tiền trước.\n3. Tải lại lịch, thanh toán, thông báo.|bookingId A|Booking/Payment không đổi; không tạo thông báo hủy mới.'.split('\n').map(x=>x.split('|'))),
  C('ITR10','PayOS báo PAID làm Payment PAID và gửi thông báo đúng khách','Có lịch BANK_TRANSFER, Payment PENDING; PayOS sandbox/secret cấu hình.','Chỉ trạng thái PayOS xác minh mới là nguồn tin cậy.','1. Tạo link PayOS cho Payment của lịch A.|paymentId A|Link/QR ứng với số tiền Payment A.\n2. Thanh toán trên PayOS sandbox và gọi đồng bộ/đợi webhook hợp lệ.|orderCode A|Payment A chuyển PAID, có paymentDate.\n3. Mở lịch sử thanh toán và thông báo khách A.|Tài khoản A|Hiện PAID và một thông báo thanh toán liên kết bookingId A.'.split('\n').map(x=>x.split('|'))),
  C('ITR10','PayOS trả thất bại hoặc webhook lặp không tạo trạng thái/thông báo sai','Có Payment BANK_TRANSFER PENDING; PayOS sandbox kiểm soát được kết quả.','Có thể chạy hai nhánh bằng hai bộ dữ liệu độc lập.','1. Hủy/hết hạn thanh toán PayOS rồi đồng bộ.|Payment A|Payment A chuyển FAILED, không báo thanh toán thành công.\n2. Với Payment B, gửi webhook PAID hợp lệ hai lần.|Webhook cùng orderCode/số tiền|Payment B vẫn PAID; chỉ một thông báo thanh toán thành công.\n3. Gửi webhook sai chữ ký hoặc sai số tiền cho Payment C.|Payload thử nghiệm|Không đánh dấu Payment C là PAID.'.split('\n').map(x=>x.split('|'))),
  C('ITR11','Payment FAILED được retry thành giao dịch PENDING mới cho cùng lịch','Có lịch chưa CANCELLED/COMPLETED với Payment FAILED; chưa có PENDING/PAID khác.','Luồng retry bảo toàn bookingId và tổng tiền.','1. Mở Payment FAILED của lịch A.|paymentId cũ|Ghi bookingId và amount hiện tại.\n2. Gọi retry giao dịch.|paymentId cũ|Tạo paymentId mới, status PENDING, cùng bookingId và amount bằng Booking.totalAmount.\n3. Mở lịch sử thanh toán.|bookingId A|Có cả giao dịch FAILED cũ và PENDING mới; không tạo lịch hẹn mới.'.split('\n').map(x=>x.split('|'))),
  C('ITR11','Không retry nếu lịch đã hủy hoặc có giao dịch còn PENDING/PAID','Có các lịch thử nghiệm CANCELLED và lịch có Payment PENDING/PAID.','Đối chiếu không phát sinh giao dịch mồ côi.','1. Gọi retry cho Payment FAILED thuộc lịch CANCELLED.|paymentId A|API trả Conflict, không tạo Payment mới.\n2. Gọi retry khi cùng bookingId đã có Payment PENDING/PAID.|paymentId B|API trả Conflict.\n3. Mở danh sách Payment của hai lịch.|bookingId A/B|Số Payment không tăng sau các yêu cầu bị từ chối.'.split('\n').map(x=>x.split('|'))),
  C('ITR12','Phân công nhân sự ACTIVE cập nhật lịch của VET và thông báo khách','Có lịch chưa kết thúc; VET A ACTIVE, không xung đột giờ.','Booking.staffId là cầu nối lịch vận hành và cổng VET.','1. STAFF/ADMIN phân công VET A cho lịch B.|staffId A, bookingId B|Booking.staffId được cập nhật.\n2. VET A tải lịch của mình.|Tài khoản VET A|Lịch B xuất hiện trong danh sách VET A; VET khác không thấy.\n3. Khách chủ lịch mở thông báo.|bookingId B|Có thông báo đã phân công liên kết lịch B.'.split('\n').map(x=>x.split('|'))),
  C('ITR12','Nhân sự INACTIVE hoặc bận giờ không được phân công','Có lịch B; một nhân sự INACTIVE và một nhân sự ACTIVE đã có lịch chồng giờ.','Kiểm tra ValidateStaff và CheckSlot.','1. Thử phân công nhân sự INACTIVE.|staffId X|API từ chối; bookingId B không đổi staffId.\n2. Thử phân công nhân sự ACTIVE đang bận.|staffId Y|API trả Conflict; staffId B không đổi.\n3. Kiểm tra thông báo khách.|bookingId B|Không có thông báo phân công mới từ các lần thất bại.'.split('\n').map(x=>x.split('|'))),
  C('ITR13','Thanh toán tiền mặt cho phép hoàn thành lịch và đồng bộ thông báo','Có lịch CASH ở IN_PROGRESS với Payment PENDING; STAFF/ADMIN hợp lệ.','Có thể chuẩn bị trạng thái qua PENDING→CONFIRMED→IN_PROGRESS.','1. Thử chuyển lịch sang COMPLETED trước thanh toán.|bookingId A|API trả Conflict; lịch vẫn IN_PROGRESS.\n2. STAFF xác nhận Payment CASH PENDING.|paymentId A|Payment chuyển PAID; khách có thông báo thanh toán.\n3. Chuyển lịch sang COMPLETED.|bookingId A|Booking chuyển COMPLETED; khách có thông báo hoàn thành.'.split('\n').map(x=>x.split('|'))),
  C('ITR13','Giao dịch BANK_TRANSFER không được xác nhận bằng nút tiền mặt','Có lịch BANK_TRANSFER và Payment PENDING; STAFF đăng nhập.','Không dùng xác nhận thủ công thay cho trạng thái PayOS.','1. Ghi trạng thái Payment BANK_TRANSFER.|paymentId A|Payment PENDING.\n2. Gọi xác nhận tiền mặt cho Payment A.|paymentId A|API trả BadRequest.\n3. Thử hoàn thành lịch liên quan.|bookingId A|Payment vẫn PENDING; Booking không được chuyển COMPLETED.'.split('\n').map(x=>x.split('|'))),
  C('ITR14','Bác sĩ tạo hồ sơ khám, cân nặng cập nhật thú cưng và chủ thấy lịch sử','VET được phân công hoặc có quyền với Pet A; khách A là chủ thú cưng.','Luồng MedicalRecord ↔ Pet ↔ owner view.','1. VET tạo hồ sơ khám có cân nặng mới.|Pet A, weight W, chẩn đoán|MedicalRecord được tạo cho Pet A; Pet.weight = W.\n2. Chủ A mở hồ sơ sức khỏe của Pet A.|Tài khoản A|Thấy hồ sơ vừa tạo và cân nặng W.\n3. Khách B thử đọc hồ sơ của Pet A.|Tài khoản B|API không trả hồ sơ của A.'.split('\n').map(x=>x.split('|'))),
  C('ITR14','Sửa hồ sơ khám cập nhật Pet.weight và lưu phiên bản chỉnh sửa','Có hồ sơ khám của Pet A; VET có quyền sửa, lý do chỉnh sửa hợp lệ.','Hồ sơ có revisions theo API.','1. VET sửa cân nặng và ghi lý do.|recordId A, weight W2|MedicalRecord lưu weight W2; Pet.weight cập nhật W2.\n2. Chủ A mở hồ sơ sức khỏe.|Pet A|Hiển thị giá trị mới W2.\n3. Mở lịch sử chỉnh sửa hồ sơ.|recordId A|Có revision phản ánh thay đổi từ giá trị trước đó.'.split('\n').map(x=>x.split('|'))),
  C('ITR15','Lịch tiêm đến hạn tạo thông báo đúng chủ thú cưng','Có Pet A chưa archived; VET có quyền tạo lịch tiêm; background service hoạt động.','Nhắc lịch xét nextDate từ hôm nay đến 7 ngày tới; chạy theo giờ.','1. VET tạo Vaccination cho Pet A, nextDate trong 7 ngày.|Pet A, vaccine V, nextDate D|Bản ghi tiêm lưu đúng petId và nextDate.\n2. Chờ tác vụ nhắc lịch chạy hoặc kích hoạt trong môi trường test.|D trong 7 ngày|Tạo thông báo nhắc tiêm liên kết vaccinationId.\n3. Khách A/B mở thông báo.|Tài khoản chủ A và B|Chỉ A thấy thông báo có tên Pet A, vaccine V, ngày D.'.split('\n').map(x=>x.split('|'))),
  C('ITR15','Tác vụ chạy lặp không nhân đôi nhắc tiêm; Pet archived không được nhắc','Có Vaccination A đến hạn và Pet B archived với lịch tiêm đến hạn.','Dedupe theo user/title/message/relatedId/relatedType.','1. Chạy tác vụ nhắc lịch cho Vaccination A.|vaccinationId A|Tạo một thông báo nhắc tiêm.\n2. Chạy lại tác vụ với dữ liệu không đổi.|vaccinationId A|Không tạo thông báo nhắc tiêm thứ hai cho A.\n3. Kiểm tra thông báo của Pet B archived.|vaccinationId B|Không tạo nhắc tiêm cho Pet B archived.'.split('\n').map(x=>x.split('|'))),
  C('ITR16','Tạm ngưng nhân sự đồng bộ tài khoản và loại khỏi danh sách phân công','Có Staff A ACTIVE gắn UserAccount ACTIVE; ADMIN đăng nhập.','StaffsController đồng bộ status UserAccount.','1. ADMIN chuyển Staff A sang INACTIVE.|staffId A|Staff.status INACTIVE, UserAccount.status INACTIVE.\n2. Mở danh sách nhân sự có thể phân công.|Ngày/giờ hợp lệ|Staff A không còn xuất hiện là nhân sự ACTIVE.\n3. Thử phân công staffId A và dùng tài khoản A.|staffId A, token/tài khoản A|API từ chối phân công; tài khoản A không dùng được cổng nhân sự.'.split('\n').map(x=>x.split('|'))),
  C('ITR16','Đạt ba vi phạm đình chỉ nhân sự và chặn đăng nhập/phân công','Staff A có 2 vi phạm và đang ACTIVE; ADMIN có quyền ghi vi phạm.','Ngưỡng 3 trong StaffsController.','1. ADMIN ghi vi phạm thứ ba cho Staff A.|staffId A|violationCount = 3, Staff.status SUSPENDED.\n2. Đọc tài khoản liên kết.|userId của Staff A|UserAccount.status INACTIVE.\n3. Thử đăng nhập và phân công Staff A.|Tài khoản/staffId A|Không dùng được cổng nhân sự và không thể phân công.'.split('\n').map(x=>x.split('|'))),
  C('ITR17','Đổi role SQL làm thay đổi cổng và quyền API theo phiên kế tiếp','Có tài khoản STAFF ACTIVE đã gắn hồ sơ Staff; ADMIN có quyền đổi role.','Quyền lấy từ SQL; API yêu cầu hồ sơ Staff trước khi gán STAFF/VET.','1. ADMIN đổi vai trò nhân sự thử nghiệm.|STAFF→VET, userId có hồ sơ Staff|UserAccount.role và Staff.role cùng chuyển VET.\n2. Đăng nhập lại tài khoản vừa đổi.|Firebase UID không đổi|Web mở cổng VET theo role hiện tại trong SQL.\n3. Thử API chỉ dành cho STAFF và API dành cho VET.|Token cùng UID|API kiểm tra quyền theo role mới; chức năng ngoài quyền bị từ chối.'.split('\n').map(x=>x.split('|'))),
  C('ITR17','Khách B không đọc được lịch, thanh toán, hồ sơ sức khỏe của khách A','Có hai khách hàng A/B; A có Pet, Booking, Payment, MedicalRecord.','Thử trực tiếp API để kiểm tra biên dữ liệu, không chỉ ẩn trên UI.','1. Dùng token B gọi GET Booking của A.|bookingId A|Không trả dữ liệu lịch của A.\n2. Dùng token B gọi Payment của Booking A.|paymentId/bookingId A|Không trả dữ liệu thanh toán của A.\n3. Dùng token B gọi MedicalRecord của Pet A.|petId/recordId A|Không trả hồ sơ sức khỏe của A.'.split('\n').map(x=>x.split('|'))),
  C('ITR18','Thanh toán PAID phản ánh trong báo cáo, không đếm Payment PENDING','Có ADMIN và hai lịch trong khoảng báo cáo: một PAID, một PENDING.','Báo cáo tính paidAmount theo paymentDate.','1. Ghi số liệu báo cáo trước xác nhận thanh toán.|Khoảng ngày D|Có bookedAmount/paidAmount làm mốc.\n2. Xác nhận CASH hoặc đồng bộ PayOS cho một Payment.|paymentId A|Payment A chuyển PAID, paymentDate thuộc D.\n3. Tải lại báo cáo cùng khoảng ngày.|D|paidAmount tăng đúng amount A; Payment PENDING còn lại không cộng vào paidAmount.'.split('\n').map(x=>x.split('|'))),
  C('ITR18','Ghi nhận hoàn tiền cập nhật báo cáo và thông báo, không xóa lịch sử PAID','Có Payment PAID trong khoảng ngày, ADMIN/STAFF được phép ghi hoàn tiền; khoản hoàn thực tế đã xử lý ngoài hệ thống.','API chỉ ghi nhận hoàn tiền, không tự chuyển tiền qua PayOS/ngân hàng.','1. Ghi nhận refund với lý do và mã tham chiếu.|paymentId A, reason, reference|Payment chuyển REFUNDED và lưu refundedAt/by.\n2. Mở thông báo khách chủ lịch.|bookingId A|Có thông báo ghi nhận hoàn tiền liên kết lịch.\n3. Tải báo cáo có ngày hoàn tiền.|Khoảng ngày D|refundAmount tăng amount A, netCollected = paidAmount − refundAmount; lịch sử booking vẫn còn.'.split('\n').map(x=>x.split('|'))),
];

const ids=new Set(requirements.map(r=>r[0]));
if(cases.length!==36||requirements.length!==18) throw new Error(`Unexpected inventory ${requirements.length}/${cases.length}`);
for(const c of cases){
  if(!ids.has(c.req)||c.steps.length<3||c.steps.some(s=>!s.action||!s.expected)) throw new Error(`Bad case ${c.req}`);
}

const wb=Workbook.create();
const cover=wb.worksheets.add('Cover Page');
const req=wb.worksheets.add('Test Requirements');
const sh=wb.worksheets.add('Integration Test Cases');
const lookup=wb.worksheets.add('Sheet2');
for(const s of [cover,req,sh,lookup]) s.showGridLines=false;
const set=(s,a,v)=>{s.getRange(a).values=[[v]]};
const merge=(s,a)=>s.getRange(a).merge();
const fmt=(s,a,f)=>{s.getRange(a).format=f};
const B='#000000', BLUE='#203864', PALE='#D9EAF7', GREEN='#CCFFCC', YELLOW='#FFFF00';
const thin={preset:'all',style:'thin',color:B};
const width=(s,arr)=>arr.forEach((n,i)=>{s.getRange(`${String.fromCharCode(65+i)}:${String.fromCharCode(65+i)}`).format.columnWidth=n});
const estimate=(t,w)=>String(t??'').split('\n').reduce((a,l)=>a+Math.max(1,Math.ceil(l.length/w)),0);

// Cover Page: same four-sheet flow and blue document-control presentation as template.
width(cover,[6,20,27,26,27]);
merge(cover,'B2:E4');set(cover,'B2','INTEGRATION TEST CASES\nfor PetNoVa Website');
fmt(cover,'B2:E4',{fill:BLUE,font:{name:'Arial',size:18,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,borders:thin});
for(let r=2;r<=4;r++) cover.getRange(`B${r}:E${r}`).format.rowHeight=29;
merge(cover,'B6:E6');set(cover,'B6','DOCUMENT HISTORY');
fmt(cover,'B6:E6',{fill:'#4472C4',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',borders:thin});
cover.getRange('B7:E7').values=[['Version','Date','Author','Description']];
fmt(cover,'B7:E7',{fill:PALE,font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',borders:thin});
cover.getRange('B8:E8').values=[['v1.0','25/10/2026','Nhóm 09','Thiết kế test case; chưa thực thi']];
fmt(cover,'B8:E8',{font:{name:'Arial',size:10},borders:thin,wrapText:true});
cover.getRange('B8:E8').format.rowHeight=30;
merge(cover,'B11:E11');set(cover,'B11','PROJECT INFORMATION');
fmt(cover,'B11:E11',{fill:'#4472C4',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',borders:thin});
for(const [r,label,value] of [[12,'Project','PetNoVa Website'],[13,'Test phase','Integration test case design'],[14,'Team','Nhóm 09; thành viên/MSSV tự bổ sung'],[15,'Execution','Chưa chạy test; kết quả để Not Executed']]){
  set(cover,`B${r}`,label);merge(cover,`C${r}:E${r}`);set(cover,`C${r}`,value);
  fmt(cover,`B${r}:E${r}`,{font:{name:'Arial',size:10},borders:thin,wrapText:true,verticalAlignment:'center'});
  fmt(cover,`B${r}`,{font:{name:'Arial',size:10,bold:true},fill:PALE});
  cover.getRange(`B${r}:E${r}`).format.rowHeight=r===14?29:24;
}
merge(cover,'B17:E17');set(cover,'B17','REFERENCE MATERIAL');
fmt(cover,'B17:E17',{fill:'#4472C4',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',borders:thin});
for(const [r,v] of [[18,'ST-IntegrationTestCase-Template.xlsx (mẫu trình bày)'],[19,'Nhom09Full.xlsx / các yêu cầu F1–F12'],[20,'Mã nguồn frontend/backend PetNoVa trong workspace']]){
  merge(cover,`B${r}:E${r}`);set(cover,`B${r}`,v);
  fmt(cover,`B${r}:E${r}`,{font:{name:'Arial',size:10},borders:thin,wrapText:true});
  cover.getRange(`B${r}:E${r}`).format.rowHeight=24;
}

// Requirement register: template columns A:G, including C:D and F:G merges.
width(req,[5.22,22.22,25.78,52.78,16.44,14.78,15.78,15.78,31.22]);
merge(req,'A1:I1');set(req,'A1','General Information');
fmt(req,'A1:I1',{font:{name:'Arial',size:12,bold:true}});
for(const [r,a,b,c,d] of [[2,'Test Designed By','Nhóm 09','Test Designed Date','25-Oct-2026'],[3,'Test Reviewed By','','Reviewed Date',''],[4,'Project','PetNoVa','Test Phase','Integration — chưa thực thi']]){
  merge(req,`A${r}:B${r}`);merge(req,`C${r}:E${r}`);merge(req,`G${r}:I${r}`);
  set(req,`A${r}`,a);set(req,`C${r}`,b);set(req,`F${r}`,c);set(req,`G${r}`,d);
  fmt(req,`A${r}:I${r}`,{font:{name:'Arial',size:10},borders:thin,wrapText:true});
  fmt(req,`A${r}:B${r}`,{font:{name:'Arial',size:10,bold:true}});
  fmt(req,`F${r}`,{font:{name:'Arial',size:10,bold:true}});
  req.getRange(`A${r}:I${r}`).format.rowHeight=24;
}
merge(req,'A7:I7');set(req,'A7','List of Test Requirements');
fmt(req,'A7:I7',{font:{name:'Arial',size:11,bold:true,color:'#000000'}});
merge(req,'C8:D8');merge(req,'F8:G8');
for(const [a,v] of [['A8','No.'],['B8','Test Requirement ID'],['C8','Test Requirement Description'],['E8','Num of Testcases'],['F8','Note']]) set(req,a,v);
fmt(req,'A8:G8',{fill:GREEN,font:{name:'Arial',size:10,bold:true},borders:{preset:'all',style:'medium',color:B},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'});
req.getRange('A8:G8').format.rowHeight=31;
const reqFirst=9, reqLast=reqFirst+requirements.length-1;
for(let i=0;i<requirements.length;i++){
  const r=reqFirst+i,[id,desc,note]=requirements[i];
  merge(req,`C${r}:D${r}`);merge(req,`F${r}:G${r}`);
  set(req,`A${r}`,i+1);set(req,`B${r}`,id);set(req,`C${r}`,desc);set(req,`F${r}`,note);
  req.getRange(`E${r}`).formulas=[[`=COUNTIF('Integration Test Cases'!$B$3:$B$200,"${id}")`]];
  fmt(req,`A${r}:G${r}`,{font:{name:'Arial',size:10},borders:thin,wrapText:true,verticalAlignment:'top',fill:i%2?'#F7FBFF':'#FFFFFF'});
  fmt(req,`A${r}:B${r}`,{horizontalAlignment:'center'});
  fmt(req,`E${r}`,{horizontalAlignment:'center'});
  req.getRange(`A${r}:G${r}`).format.rowHeight=36;
}
set(req,`C${reqLast+2}`,'Tổng số test case');req.getRange(`E${reqLast+2}`).formulas=[[`=SUM(E${reqFirst}:E${reqLast})`]];
fmt(req,`C${reqLast+2}:G${reqLast+2}`,{fill:PALE,font:{name:'Arial',size:10,bold:true},borders:thin});

// Integration Test Cases: preserve template's 13-column execution split.
width(sh,[4.55,16.55,17.44,31.78,22.78,5.78,36.22,23.44,43.22,45.55,15.55,15.78,19.33]);
merge(sh,'K1:M1');set(sh,'K1','Execute Testing - Version1.0');
fmt(sh,'K1:M1',{fill:YELLOW,font:{name:'Verdana',size:10,bold:true},horizontalAlignment:'center',borders:thin});
sh.getRange('A2:M2').values=[['No.','Test Requirement ID','Test Case ID','Test Objective','Pre-conditions','Step #','Step Action','Test Data','Expected Result','Notes','Result','By tester','Note']];
fmt(sh,'A2:J2',{fill:GREEN,font:{name:'Arial',size:11,bold:true},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',borders:{preset:'all',style:'medium',color:B}});
fmt(sh,'K2:M2',{fill:YELLOW,font:{name:'Verdana',size:10,bold:true},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',borders:{preset:'all',style:'medium',color:B}});
sh.getRange('A2:M2').format.rowHeight=33;
let row=3,seq=0;
for(const c of cases){
  seq++;const start=row,end=start+c.steps.length-1,id=`${c.req}_${String([ ...cases.slice(0,seq)].filter(x=>x.req===c.req).length).padStart(2,'0')}`;
  const note=`Liên kết: ${requirements.find(x=>x[0]===c.req)[2]}. ${c.notes}`;
  for(let i=0;i<c.steps.length;i++){
    const r=start+i,s=c.steps[i];
    sh.getRange(`A${r}:M${r}`).values=[[
      i?null:seq,i?null:c.req,i?null:id,i?null:c.objective,i?null:c.pre,
      i+1,s.action,s.data,s.expected,i?null:note,i?null:'Not Executed',null,null
    ]];
    const h=Math.max(32,Math.min(105,Math.max(estimate(s.action,35),estimate(s.data,22),estimate(s.expected,42))*15+10));
    sh.getRange(`A${r}:M${r}`).format.rowHeight=h;
  }
  fmt(sh,`A${start}:J${end}`,{fill:'#FFFFFF',font:{name:'Arial',size:10},wrapText:true,verticalAlignment:'top',borders:thin});
  fmt(sh,`K${start}:M${end}`,{fill:YELLOW,font:{name:'Verdana',size:10},wrapText:true,verticalAlignment:'top',borders:thin});
  for(const col of ['A','B','C','D','E','J','K','L','M']) merge(sh,`${col}${start}:${col}${end}`);
  fmt(sh,`A${start}:C${end}`,{font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',verticalAlignment:'top'});
  fmt(sh,`F${start}:F${end}`,{font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',verticalAlignment:'center'});
  fmt(sh,`K${start}:K${end}`,{font:{name:'Verdana',size:10,bold:true},horizontalAlignment:'center',verticalAlignment:'center'});
  sh.getRange(`A${start}:M${end}`).format.borders={top:{style:'medium',color:B},bottom:{style:'medium',color:B},left:{style:'medium',color:B},right:{style:'medium',color:B}};
  row=end+1;
}

// Keep the template's generic dropdown-reference sheet.
width(lookup,[16,4,4,18,4,4,17]);
lookup.getRange('A1:G1').values=[['Priority','','','Status','','','Type']];
fmt(lookup,'A1:G1',{font:{name:'Arial',size:10,bold:true},fill:GREEN,borders:thin});
for(const [a,v] of [['A2','High'],['A3','Medium'],['A4','Low'],['D2','Not Executed'],['D3','Passed'],['D4','Failed'],['D5','Blocked'],['G2','LooknFeel'],['G3','Positive'],['G4','Negative'],['G5','Boundary']]) set(lookup,a,v);
fmt(lookup,'A2:G5',{font:{name:'Arial',size:10},borders:thin});

wb.recalculate();
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.mkdir(previewDir,{recursive:true});
const renderItems=[
  ['Cover Page','B2:E20','cover'],
  ['Test Requirements','A7:G15','requirements_first'],
  ['Test Requirements',`A${reqLast-3}:G${reqLast+2}`,'requirements_last'],
  ['Integration Test Cases','A1:M8','cases_first'],
  ['Integration Test Cases','A72:M79','cases_middle'],
  ['Integration Test Cases',`A${row-7}:M${row-1}`,'cases_last'],
  ['Sheet2','A1:G5','lookup'],
];
for(const [sheetName,range,name] of renderItems){
  const png=await wb.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(`${previewDir}/${name}.png`,new Uint8Array(await png.arrayBuffer()));
}
const file=await SpreadsheetFile.exportXlsx(wb);await file.save(out);
console.log(JSON.stringify({out,requirements:requirements.length,cases:cases.length,lastRow:row-1,previews:renderItems.map(x=>x[2])}));
