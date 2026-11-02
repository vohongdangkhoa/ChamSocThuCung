import fs from 'node:fs/promises';
import path from 'node:path';
import {FileBlob, SpreadsheetFile, Workbook} from '@oai/artifact-tool';

const root='C:/Users/vohon/petnova_app';
const source='D:/Hk1 năm 3/LT_KDCLPM/Nhóm09/Nhom09_IntergrationTC.xlsx';
const dir=`${root}/.codex_tmp/testcase_completion/integration_v2`;
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(source));
await fs.mkdir(dir,{recursive:true});
if(process.argv[2]==='preview'){
  for(const [sheetName,range,name] of [
    ['Cover Page','B2:E18','cover_before'],
    ['Test Requirements','A7:G16','requirements_before'],
    ['Integration Test Cases','A1:M11','cases_before'],
    ['Sheet4','A1:G5','lookup_before']
  ]){
    const png=await wb.render({sheetName,range,scale:1,format:'png'});
    await fs.writeFile(path.join(dir,name+'.png'),new Uint8Array(await png.arrayBuffer()));
  }
  console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:1500})).ndjson);
  process.exit(0);
}

const sourceIndex=JSON.parse(await fs.readFile(`${root}/.codex_tmp/testcase_completion/integration_source_index.json`,'utf8'));
const functional=sourceIndex.functional_cases;
const links=[
  ['F1_01','F1.3_01'],
  ['F11.4_01','F1.4_02'],
  ['F1.5_01','F1.6_01','F1.7_01'],
  ['F1.6_03','F1.7_01'],
  ['F3.2_01','F4.5_01','F12.2_01'],
  ['F4.5_01','F3.5_03','F3.5_01'],
  ['F3.4_01','F3_01'],
  ['F3.4_03','F3_01'],
  ['F11.12_01','F11.10_03','F4.3_01'],
  ['F11.11_01','F4.3_04'],
  ['F4.5_01','F5_01','F7_01'],
  ['F4.5_02','F5_01'],
  ['F4.4_01','F4.5_01'],
  ['F4.3_02','F4.4_01','F4.5_01'],
  ['F4.8_01','F4_01','F7_01'],
  ['F4.8_03','F7_01'],
  ['F4.9_01','F5_01','F7_01'],
  ['F4.9_03','F5_01'],
  ['F4.6_02','F5.2_01','F7_01'],
  ['F5.2_02','F5_01'],
  ['F5.3_01','F5_01'],
  ['F5.3_03','F5.3_04'],
  ['F9.3_01','F10_01','F7_01'],
  ['F9.3_02','F9.3_03'],
  ['F9.6_01','F9.7_01','F9.5_03'],
  ['F9.7_03','F9.6_01'],
  ['F10.4_01','F6_01'],
  ['F10.5_01','F6_01'],
  ['F10.6_01','F7_01'],
  ['F3.5_01','F10.6_01','F7_01'],
  ['F11.7_01','F9.3_02','F1.4_01'],
  ['F11.8_02','F1.4_01'],
  ['F11.3_01','F12_03'],
  ['F12.2_02','F12.2_03','F6_07'],
  ['F9.7_01','F11.14_01'],
  ['F9.9_01','F11.14_01','F7_01'],
];
if(links.length!==sourceIndex.base_cases.length) throw Error('Base case mapping mismatch');
const base=sourceIndex.base_cases.map((c,i)=>({
  links:links[i], objective:c.objective, pre:c.pre, steps:c.steps,
  junction:c.notes.replace(/Chưa thực thi\.?/g,'').trim(),
}));

// Align existing cases to the supplied Functional workbook where the earlier
// draft was broader than its source case (5.5 MiB upload and PayOS failure).
base[7]={
  links:links[7],
  objective:'Ảnh 5,5 MiB được chọn trên giao diện nhưng API từ chối, hồ sơ thú cưng giữ ảnh cũ',
  pre:'Khách A sở hữu Pet A có ảnh cũ; chuẩn bị JPEG thật 5,5 MiB và Cloudinary hoạt động.',
  junction:'Giao diện chọn tệp → kiểm tra 5 MiB tại API → dữ liệu Pet; theo F3.4_03.',
  steps:[
    {action:'Chọn ảnh JPEG thật 5,5 MiB trong hồ sơ Pet A.',data:'petId A; tệp 5,5 MiB',expected:'Giao diện cho chọn tệp vì ngưỡng chọn hiện tại dưới 6 MiB.'},
    {action:'Thực hiện tải ảnh lên.',data:'Cùng tệp 5,5 MiB',expected:'API từ chối vì vượt giới hạn 5 MiB; không trả URL ảnh mới.'},
    {action:'Tải lại danh sách/hồ sơ Pet A.',data:'petId A',expected:'imageUrl/publicId và ảnh hiển thị vẫn là ảnh cũ.'},
  ],
};
base[19]={
  links:links[19],
  objective:'PayOS hủy hoặc hết hạn được đồng bộ thành FAILED, lịch sử không báo PAID',
  pre:'Khách A có Booking BANK_TRANSFER và Payment PENDING; PayOS sandbox hoạt động.',
  junction:'PayOS → Payment → lịch sử khách hàng; theo F5.2_02.',
  steps:[
    {action:'Tạo link PayOS cho Payment A rồi hủy checkout hoặc để hết hạn.',data:'paymentId A',expected:'PayOS trả trạng thái CANCELLED hoặc EXPIRED cho orderCode A.'},
    {action:'Đồng bộ trạng thái PayOS trong PetNoVa.',data:'paymentId A',expected:'Payment A chuyển FAILED, không chuyển PAID.'},
    {action:'Mở lịch sử thanh toán của khách A.',data:'bookingId A',expected:'Giao dịch A hiện FAILED; không có thông báo thanh toán thành công mới.'},
  ],
};

const N=(links,objective,pre,junction,steps)=>({links,objective,pre,junction,steps:steps.map(([action,data,expected])=>({action,data,expected}))});
const extra=[
  N(['F1.8_01','F12_01'],'Đăng xuất chặn tải mới dữ liệu được bảo vệ','Khách A đang đăng nhập và có dữ liệu thú cưng.','Firebase logout → API bảo vệ dữ liệu',[
    ['Đăng xuất khỏi cổng khách hàng.','Tài khoản A','Trang xác thực xuất hiện; phiên Firebase kết thúc.'],
    ['Tải lại trang đã lưu của cổng khách hàng.','URL từng mở','Không tải lại dữ liệu nghiệp vụ của A.'],
    ['Gọi API thú cưng khi không có token.','GET /api/Pets','API từ chối truy cập; không trả dữ liệu của A.']]),
  N(['F3.2_01','F2_01'],'Thêm thú cưng cập nhật số thú cưng trên tổng quan','Khách A ACTIVE; ghi nhận số thú cưng chưa lưu trữ trước khi thêm.','Pets → dashboard khách hàng',[
    ['Mở Tổng quan và ghi số thú cưng hiện tại.','Tài khoản A','Có số mốc N.'],
    ['Thêm Pet A hợp lệ.','Tên/loài/ngày sinh/cân nặng hợp lệ','Pet A xuất hiện trong danh sách thú cưng.'],
    ['Quay lại Tổng quan hoặc tải lại.','Tài khoản A','Số thú cưng tăng từ N lên N+1, không đếm pet đã lưu trữ.']]),
  N(['F4.5_01','F2_01'],'Lịch mới cập nhật số lịch đang chờ trên tổng quan khách hàng','Khách A có Pet A và gói ACTIVE; giờ trống.','Bookings → dashboard khách hàng',[
    ['Ghi số lịch đang chờ trên Tổng quan.','Tài khoản A','Có số mốc N.'],
    ['Đặt một lịch CASH mới còn trong tương lai.','Pet A, gói S, requestId mới','Booking PENDING được tạo.'],
    ['Tải lại Tổng quan.','Tài khoản A','Số lịch liên quan tăng đúng một; lịch vừa tạo thuộc A.']]),
  N(['F7_03','F2_01'],'Đánh dấu thông báo đã đọc cập nhật số chưa đọc trên Tổng quan','Khách A có ít nhất một thông báo chưa đọc.','Notifications.isRead → dashboard',[
    ['Ghi số thông báo chưa đọc trên Tổng quan.','Tài khoản A','Có số mốc N>0.'],
    ['Mở Thông báo và đánh dấu một mục chưa đọc.','notificationId A','Mục chuyển sang đã đọc.'],
    ['Tải lại Tổng quan.','Tài khoản A','Số chưa đọc giảm đúng một và giữ sau tải lại.']]),
  N(['F8_01','F9.2_01'],'Tên/số điện thoại khách cập nhật hiển thị đúng ở chi tiết lịch vận hành','Khách A có Booking B; STAFF có quyền xem chi tiết B.','UserAccount → chi tiết Booking của STAFF',[
    ['Khách A sửa họ tên và số điện thoại hợp lệ.','Tên mới, số mới chưa dùng','Hồ sơ của A lưu thông tin mới.'],
    ['STAFF làm mới và mở chi tiết Booking B.','bookingId B','Hiển thị đúng khách A với thông tin hiện tại.'],
    ['Khách A tải lại trang tài khoản.','Tài khoản A','Tên và số điện thoại mới vẫn được lưu.']]),
  N(['F8.2_06','F1.3_01'],'Đổi email đã xác nhận đồng bộ Firebase và hồ sơ SQL để đăng nhập lại','Khách A có email cũ; sở hữu email mới chưa dùng; biết mật khẩu hiện tại.','Firebase email verification → UserAccount sync → login',[
    ['Yêu cầu đổi email và xác nhận qua email mới.','Email mới A','Firebase xác nhận email mới; chưa coi email chưa xác nhận là đã đồng bộ.'],
    ['Đăng nhập lại và để PetNoVa đồng bộ hồ sơ.','Email mới A','UserAccount.email đổi sang email mới, UID và userId giữ nguyên.'],
    ['Đăng xuất rồi đăng nhập bằng email mới.','Email mới A, mật khẩu đúng','Vào lại đúng cổng của A; hồ sơ không bị nhân đôi.']]),
  N(['F8.2_01','F1.3_01'],'Đổi mật khẩu tài khoản làm mật khẩu cũ hết hiệu lực ở lần đăng nhập sau','Khách A ACTIVE, biết mật khẩu cũ; mật khẩu mới hợp lệ theo F8.2_01.','Đổi mật khẩu Firebase → login',[
    ['Đổi mật khẩu tại trang tài khoản.','Mật khẩu hiện tại đúng, mật khẩu mới ≥8 ký tự','Giao diện xác nhận cập nhật thành công.'],
    ['Đăng xuất và thử đăng nhập bằng mật khẩu cũ.','Email A, mật khẩu cũ','Firebase từ chối đăng nhập.'],
    ['Đăng nhập bằng mật khẩu mới.','Email A, mật khẩu mới','Vào đúng hồ sơ PetNoVa của A.']]),
  N(['F8_06','F8_01'],'Ảnh đại diện tải lên được lưu và hiển thị lại với hồ sơ tài khoản','Khách A có ảnh đại diện cũ hoặc rỗng; Cloudinary đã cấu hình.','Media/Cloudinary → UserAccount.avatarUrl → UI tài khoản',[
    ['Khách A chọn và tải ảnh đại diện hợp lệ.','JPEG/PNG/WebP thật ≤5 MiB','API lưu URL ảnh mới sau khi Cloudinary thành công.'],
    ['Tải lại trang tài khoản.','Tài khoản A','Ảnh đại diện mới vẫn hiển thị từ URL đã lưu.'],
    ['Đăng xuất rồi đăng nhập lại.','Tài khoản A','Ảnh vẫn gắn đúng hồ sơ A, không chuyển sang tài khoản khác.']]),
  N(['F11.12_04','F11.10_03'],'Danh mục INACTIVE không được gắn vào gói dịch vụ mới','ADMIN có danh mục D đang ACTIVE; có dữ liệu gói hợp lệ.','ServiceCategory.status → tạo ServicePackage',[
    ['ADMIN chuyển danh mục D sang INACTIVE.','categoryId D','Danh mục lưu trạng thái INACTIVE.'],
    ['Thử tạo gói mới gắn danh mục D.','Tên/giá/thời lượng hợp lệ; categoryId D','API từ chối vì danh mục không ACTIVE.'],
    ['Tải lại danh sách gói.','Tên gói vừa thử','Không có gói mới được tạo từ yêu cầu thất bại.']]),
  N(['F11.10_04','F4.5_03'],'Giá/thời lượng gói sau khi sửa được lấy ở lịch mới từ máy chủ','ADMIN có gói S ACTIVE; khách A có Pet A.','ServicePackage → BookingDetail/Booking/Payment',[
    ['ADMIN sửa giá và thời lượng gói S.','Giá P2, thời lượng T2 hợp lệ','Gói S lưu giá/thời lượng mới.'],
    ['Khách A tải lại form và tạo lịch mới với S.','Pet A, S, giờ đủ T2','Booking dùng tổng tiền P2 và durationMinutes T2.'],
    ['Đọc BookingDetail và Payment của lịch mới.','bookingId mới','Đơn giá chi tiết và số tiền thanh toán bằng P2.']]),
  N(['F11.11_02','F4.3_01'],'Bật lại gói dịch vụ cho phép khách chọn và tạo lịch mới','Gói S đang INACTIVE, khách A có Pet A.','Admin status → catalog khách → Booking',[
    ['ADMIN bật gói S sang ACTIVE.','serviceId S','Trạng thái gói lưu ACTIVE.'],
    ['Khách A tải lại form đặt lịch.','Tài khoản A','Gói S xuất hiện với giá/thời lượng hiện hành.'],
    ['Khách A tạo lịch ở giờ còn chỗ.','Pet A, S','Lịch mới chứa BookingDetail gắn S.']]),
  N(['F11.11_03','F4_01'],'Tắt gói dịch vụ không làm mất chi tiết lịch đã tạo','Khách A có Booking B từng dùng gói S; ADMIN có quyền đổi trạng thái S.','ServicePackage status → lịch sử BookingDetail',[
    ['Ghi dịch vụ và giá trên Booking B.','bookingId B','Có mốc chi tiết lịch cũ.'],
    ['ADMIN chuyển gói S sang INACTIVE.','serviceId S','S không còn được chọn khi đặt mới.'],
    ['Khách A mở lại Booking B.','bookingId B','Lịch và chi tiết dịch vụ/giá đã lưu vẫn đọc được.']]),
  N(['F4.6_03','F5_01'],'Lỗi tạo link PayOS giữ Booking và Payment ở trạng thái chờ','Có Booking BANK_TRANSFER/PENDING, PayOS thiếu cấu hình hoặc trả lỗi thử nghiệm.','PayOS link failure → Payment history',[
    ['Ghi bookingId, paymentId và trạng thái trước khi tạo link.','Booking A','Booking PENDING, Payment PENDING.'],
    ['Thử tạo link PayOS trong điều kiện lỗi kiểm soát.','paymentId A','API báo lỗi; không tự ghi PAID.'],
    ['Tải lại lịch và lịch sử thanh toán.','bookingId A','Lịch vẫn tồn tại; Payment vẫn PENDING, số tiền không đổi.']]),
  N(['F5.2_02','F5.3_01'],'PayOS thất bại cho phép retry cùng lịch bằng Payment mới','Booking A chưa hủy/hoàn thành; Payment BANK_TRANSFER đã FAILED sau đối soát.','PayOS FAILED → Payments.retry → lịch sử',[
    ['Mở lịch sử thanh toán của Booking A.','bookingId A','Có Payment cũ FAILED.'],
    ['Chọn thử lại giao dịch thất bại.','paymentId cũ','Tạo Payment mới PENDING, cùng bookingId và amount.'],
    ['Mở lại lịch sử và Booking A.','bookingId A','Có cả FAILED cũ và PENDING mới; Booking không bị nhân đôi.']]),
  N(['F5.2_03','F5_01'],'Webhook PayOS sai chữ ký hoặc sai tiền không ghi giao dịch PAID','Payment BANK_TRANSFER PENDING; môi trường test có cách gửi webhook giả/sai tiền.','Webhook verification → Payment visible',[
    ['Ghi trạng thái Payment A trước thử.','paymentId A','Trạng thái PENDING.'],
    ['Gửi webhook sai chữ ký hoặc số tiền không khớp.','orderCode A, payload thử nghiệm','Webhook bị từ chối hoặc bỏ qua; không gọi cập nhật PAID.'],
    ['Tải lại lịch sử thanh toán của A.','paymentId A','Payment không thành PAID; không có thông báo thanh toán thành công.']]),
  N(['F5.2_04','F7_01'],'Webhook PayOS thành công lặp không gửi hai thông báo thanh toán','Payment BANK_TRANSFER PENDING; có webhook PAID hợp lệ cho đơn thử.','PayOS webhook idempotency → Notifications',[
    ['Gửi webhook PAID hợp lệ một lần.','orderCode/số tiền đúng','Payment chuyển PAID, khách nhận một thông báo.'],
    ['Gửi lại đúng webhook ấy.','Cùng payload hợp lệ','Payment vẫn PAID, không tạo thêm thông báo thành công.'],
    ['Khách mở danh sách thông báo.','bookingId liên quan','Chỉ có một thông báo thanh toán cho giao dịch này.']]),
  N(['F4.9_01','F4.4_01'],'Hủy lịch làm khung giờ được tính lại là còn chỗ','Khách A có lịch chưa trả tiền, giờ T đang bị lịch đó chiếm.','Booking CANCELLED → availability',[
    ['Ghi trạng thái availability ở giờ T.','Pet A, dịch vụ S, ngày D','Giờ T đang bị xung đột bởi lịch A.'],
    ['Hủy lịch A hợp lệ.','bookingId A','Booking chuyển CANCELLED.'],
    ['Hỏi availability lại ở giờ T.','Cùng Pet A, S, D','Lịch A không còn chiếm giờ; trạng thái giờ được tính lại theo các lịch còn lại.']]),
  N(['F9.4_01','F4_01'],'Nhân viên đổi giờ lịch, khách thấy đúng giờ mới','Có Booking CONFIRMED thuộc khách A; STAFF và giờ mới còn chỗ.','Đổi lịch vận hành → lịch khách',[
    ['STAFF đổi Booking A sang ngày/giờ mới.','bookingId A, D2/T2','API cập nhật Booking, không đổi tiền/dịch vụ.'],
    ['Khách A làm mới danh sách lịch.','Tài khoản A','Booking A hiển thị D2/T2.'],
    ['Mở chi tiết ở cả hai cổng.','bookingId A','Ngày/giờ khớp nhau; không còn giờ cũ ở Booking A.']]),
  N(['F11.5_01','F1.3_01'],'Tạo nhân sự sinh tài khoản liên kết và mở đúng cổng đăng nhập','ADMIN có thể tạo nhân sự; email/điện thoại thử chưa dùng.','Staff + UserAccount/Firebase → role portal',[
    ['ADMIN tạo nhân sự STAFF/VET với dữ liệu hợp lệ.','Email/số mới, mật khẩu khởi tạo hợp lệ','Staff và UserAccount liên kết cùng userId, role ACTIVE.'],
    ['Đăng xuất ADMIN; đăng nhập tài khoản nhân sự mới.','Email và mật khẩu khởi tạo','Firebase xác thực; PetNoVa mở cổng theo role.'],
    ['Đối chiếu thông tin trong danh sách nhân sự.','staffId mới','Hồ sơ cổng và bản ghi nhân sự trùng người.']]),
  N(['F11.9_01','F1.3_01'],'Xóa nhân sự chưa có nghiệp vụ giữ tài khoản ở vai trò CUSTOMER','Staff A chưa có lịch/hồ sơ y tế liên quan; có số Việt Nam hợp lệ duy nhất.','Delete Staff → UserAccount role/status → portal',[
    ['ADMIN xóa Staff A theo quy trình.','staffId A','Bản ghi Staff bị xóa; UserAccount còn lại.'],
    ['Tải lại tài khoản A ở quản trị.','userId A','role CUSTOMER và status ACTIVE.'],
    ['Đăng nhập tài khoản A.','Email/mật khẩu của A','Mở cổng khách hàng, không còn cổng nhân sự.']]),
  N(['F9.5_01','F9.5_02','F7_01'],'Mỗi bước tiến độ lịch gửi thông báo tới đúng khách','Booking A PENDING thuộc khách A; STAFF có quyền xử lý.','Booking.status → Notifications',[
    ['STAFF chuyển PENDING sang CONFIRMED.','bookingId A','Booking CONFIRMED; khách A có thông báo xác nhận.'],
    ['STAFF chuyển CONFIRMED sang IN_PROGRESS.','bookingId A','Booking IN_PROGRESS; khách A có thông báo thực hiện.'],
    ['Khách B mở thông báo của mình.','Tài khoản B','Không thấy thông báo tiến độ của Booking A.']]),
  N(['F10.6_01','F6_06'],'Mũi tiêm mới xuất hiện trong sổ sức khỏe và mốc nhắc tiếp theo','VET có quyền với Pet A; chủ A mở được Sổ sức khỏe.','Vaccinations → customer health book',[
    ['VET thêm mũi tiêm có nextDate hợp lệ.','Pet A, vaccine V, ngày nhắc D','Vaccination mới gắn đúng petId A.'],
    ['Chủ A mở Sổ sức khỏe của Pet A.','Tài khoản A','Mũi tiêm V hiện trong danh sách.'],
    ['Đối chiếu mốc nhắc tiếp theo.','Ngày D','Nếu D là ngày nhắc chưa qua sớm nhất, UI hiển thị D.']]),
  N(['F11.16_01','F7_01'],'Thông báo chung từ ADMIN chỉ đến các tài khoản ACTIVE','Môi trường thử có khách A ACTIVE và khách B INACTIVE; ADMIN có quyền gửi broadcast.','ADMIN broadcast → Notifications per active user',[
    ['ADMIN gửi thông báo SYSTEM với nội dung riêng để nhận diện.','Tiêu đề T, nội dung M','API xác nhận gửi broadcast.'],
    ['Tài khoản A ACTIVE mở thông báo.','Tài khoản A','Có đúng một thông báo T/M.'],
    ['Đối chiếu dữ liệu thông báo của B INACTIVE.','Tài khoản B / quản trị','Không phát sinh thông báo T/M cho B.']]),
  N(['F11.10_04','F11.17_01'],'Sửa dịch vụ thành công được ghi vào nhật ký quản trị','ADMIN có gói S ACTIVE và quyền xem audit log.','Admin mutation → AuditLogs',[
    ['Ghi giá/tên hiện tại của gói S.','serviceId S','Có mốc trước sửa.'],
    ['ADMIN sửa gói S bằng dữ liệu hợp lệ.','Giá/tên mới','API lưu thay đổi thành công.'],
    ['Mở nhật ký thao tác và lọc đối tượng.','serviceId S','Có mục non-GET thành công, đúng user/role/action/route và thời điểm.']]),
  N(['F11.3_02','F11.17_02'],'Yêu cầu đổi vai trò sai bị từ chối không được ghi là thao tác thành công','ADMIN có UserAccount A; biết số lượng audit log trước thử.','Failed mutation → AuditLogs',[
    ['Ghi role A và log gần nhất.','userId A','Có mốc đối chiếu.'],
    ['Gửi đổi role sang giá trị không hợp lệ.','role không nằm trong 4 vai trò','API từ chối; UserAccount.role không đổi.'],
    ['Mở nhật ký.','userId A','Không có log thành công cho yêu cầu bị từ chối.']]),
  N(['F11.14_01','F11.15_01'],'CSV xuất từ báo cáo khớp các dòng theo ngày trên màn hình','ADMIN chọn khoảng ngày có Booking; bảng báo cáo đã tải xong.','Reports API → CSV export',[
    ['Ghi bảng theo ngày trên màn hình báo cáo.','Khoảng từ D1 đến D2','Có Ngày/Số lịch/Hoàn thành/Giá trị đặt làm mốc.'],
    ['Bấm Xuất CSV.','Cùng khoảng ngày','Tải tệp CSV mở được bằng Excel, tiếng Việt không lỗi mã.'],
    ['Đối chiếu từng dòng CSV với màn hình.','D1–D2','Các cột ngày, số lịch, hoàn thành, giá trị đặt khớp bảng.']]),
  N(['F12.3_01','F2_01'],'Dashboard hiển thị lỗi API rồi tải đúng số liệu sau khôi phục','Khách A có dữ liệu thử; có thể dừng/khởi động API trong môi trường test.','API availability → dashboard refresh',[
    ['Ghi số liệu trên dashboard khi API hoạt động.','Tài khoản A','Có số mốc hiện tại.'],
    ['Ngắt API thử nghiệm rồi tải lại dashboard.','API cổng 5200','Giao diện báo không tải được, không giả báo thành công.'],
    ['Khôi phục API và dùng thao tác làm mới.','Tài khoản A','Dashboard tải lại dữ liệu đúng, không giữ thông báo lỗi cũ.']]),
  N(['F4.5_01','F9.2_01'],'Lịch mới có đầy đủ chi tiết dịch vụ và Payment ở cổng vận hành','Khách A có Pet A, hai gói ACTIVE; STAFF có quyền xem lịch.','Customer Booking → operational detail aggregation',[
    ['Khách A tạo lịch với hai gói.','S1, S2, CASH','Booking, hai BookingDetail, Payment PENDING được tạo.'],
    ['STAFF làm mới danh sách và mở lịch vừa tạo.','bookingId mới','Thấy đúng chủ, Pet, ghi chú, hai dịch vụ và tiền.'],
    ['Đối chiếu Payment và tổng tiền.','bookingId mới','Số tiền ở cổng vận hành bằng tổng giá hai chi tiết.']]),
  N(['F4.5_01','F9_02'],'Nhân viên làm mới danh sách nhìn thấy lịch khách vừa đặt','STAFF đã mở bàn vận hành; khách A có thể tạo lịch.','Customer Booking → operational refresh',[
    ['STAFF ghi danh sách lịch hiện tại.','Bàn vận hành','Chưa có bookingId mới.'],
    ['Khách A tạo Booking hợp lệ ở phiên khác.','Pet A, gói S, giờ trống','API tạo bookingId mới.'],
    ['STAFF bấm Làm mới.','bookingId mới','Lịch mới xuất hiện với trạng thái PENDING, đúng khách A.']]),
  N(['F11.4_02','F1.3_01'],'Kích hoạt lại tài khoản cho phép đăng nhập vào đúng cổng','UserAccount A INACTIVE; ADMIN có quyền đổi trạng thái.','UserAccount status → login/role portal',[
    ['ADMIN chuyển A sang ACTIVE.','userId A','Trạng thái hồ sơ lưu ACTIVE.'],
    ['A đăng nhập lại bằng thông tin hợp lệ.','Email/mật khẩu của A','Firebase xác thực và API chấp nhận hồ sơ ACTIVE.'],
    ['Quan sát cổng được mở.','role hiện tại của A','Cổng đúng role; dữ liệu thuộc đúng userId A.']]),
  N(['F9.5_03','F11.14_01'],'Lịch hoàn thành được phản ánh ở số lịch hoàn thành trong báo cáo','Có Booking IN_PROGRESS đã PAID thuộc khoảng báo cáo D.','Booking.status → Reports.completed',[
    ['Ghi báo cáo ngày D trước khi hoàn thành.','Ngày Booking A','Có số completed làm mốc.'],
    ['STAFF chuyển Booking A sang COMPLETED.','bookingId A','Booking lưu COMPLETED.'],
    ['Tải lại báo cáo ngày D.','Cùng khoảng ngày','completed tăng đúng một; tổng số booking giữ nguyên.']]),
  N(['F7_07','F12.2_04'],'Khách khác không đọc hoặc đánh dấu thông báo của chủ lịch','Khách A có Notification N của Booking A; khách B đăng nhập riêng.','Notification ownership → read state',[
    ['A ghi trạng thái isRead của Notification N.','notificationId N','Có mốc ban đầu.'],
    ['B gọi GET N và PUT N/read bằng token B.','notificationId N','API từ chối hoặc không tìm thấy, không trả nội dung A.'],
    ['A tải lại thông báo N.','Tài khoản A','Nội dung và isRead không bị yêu cầu của B thay đổi.']]),
  N(['F10.7_02','F6_01'],'VET không được phân công không ghi được bệnh án cho pet của người khác','VET A được phân công Pet A; VET B không có ca với Pet A.','Booking assignment → MedicalRecords permission → owner view',[
    ['VET B gửi tạo MedicalRecord cho Pet A.','Token B, petId A','API từ chối vì Pet A ngoài phạm vi B.'],
    ['Chủ A tải lại Sổ sức khỏe.','Pet A','Không có bệnh án từ yêu cầu bị từ chối.'],
    ['VET A tạo bệnh án hợp lệ cho Pet A.','Token A, chẩn đoán/điều trị hợp lệ','Bệnh án xuất hiện trong sổ sức khỏe của chủ A.']]),
];

if(process.argv[2]!=='build') throw Error('Use preview or build');
const cases=[...base,...extra];
const chains=new Set();
for(const [i,c] of cases.entries()){
  if(c.links.length<2||c.steps.length<2||!c.objective||!c.pre) throw Error(`Incomplete integration case ${i+1}`);
  if(c.links.some(id=>!functional[id])) throw Error(`Unknown source testcase in FI_${i+1}: ${c.links.join(',')}`);
  if(c.steps.some(s=>!s.action||!s.expected)) throw Error(`Missing step/expected in FI_${i+1}`);
  const chain=c.links.join('-');
  if(chains.has(chain)) throw Error(`Duplicate source chain: ${chain}`);
  chains.add(chain);
}
if(cases.length!==69) throw Error(`Unexpected case count ${cases.length}`);
const moduleCoverage=new Set(cases.flatMap(c=>c.links.map(id=>Number(id.match(/^F(\d+)/)?.[1]))));
if(Array.from({length:12},(_,i)=>i+1).some(i=>!moduleCoverage.has(i))) throw Error('A functional module is not represented');

const result=Workbook.create();
const cover=result.worksheets.add('Cover Page');
const req=result.worksheets.add('Test Requirements');
const tc=result.worksheets.add('Integration Test Cases');
const lookup=result.worksheets.add('Sheet4');
for(const s of [cover,req,tc,lookup]) s.showGridLines=false;
const set=(s,a,v)=>{s.getRange(a).values=[[v]]};
const merge=(s,a)=>s.getRange(a).merge();
const fmt=(s,a,f)=>{s.getRange(a).format=f};
const border='#000000', green='#CCFFCC', yellow='#FFFF00', pink='#CC66CC';
const thin={preset:'all',style:'thin',color:border};
const widths=(s,arr)=>arr.forEach((n,i)=>{const col=String.fromCharCode(65+i);s.getRange(`${col}:${col}`).format.columnWidth=n});
const lines=(v,w)=>String(v??'').split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/w)),0);

// The supplied Integration workbook's four tabs, labels, header order and
// colored execution section are retained. Its unrelated sample cover text is
// replaced with the actual project and the user's two source workbooks.
widths(cover,[5,13,24,35,43]);
merge(cover,'B2:E2');set(cover,'B2','INTEGRATION TEST CASES');
merge(cover,'B3:E3');set(cover,'B3','for PetNoVa Website');
merge(cover,'B4:E4');set(cover,'B4','Team: Nhóm 09');
fmt(cover,'B2:E4',{fill:pink,font:{name:'Arial',size:19,bold:true,color:'#000000'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,borders:thin});
fmt(cover,'B2:E2',{font:{name:'Arial',size:19,bold:true,color:'#C00000'}});
for(const r of [2,3,4]) cover.getRange(`B${r}:E${r}`).format.rowHeight=37;
merge(cover,'B6:E6');set(cover,'B6','Document History – To maintain a list of changes being made');
fmt(cover,'B6:E6',{fill:green,font:{name:'Arial',size:10,bold:true,color:'#C00000'},borders:thin});
cover.getRange('B7:E7').values=[['Version','Date','Author','Description of Changes']];
fmt(cover,'B7:E7',{font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',borders:thin});
cover.getRange('B8:E8').values=[['v1.0','31-Oct-2026','Nhóm 09','Bổ sung và đối chiếu các ca tích hợp từ testcase Functional của PetNoVa']];
fmt(cover,'B8:E8',{font:{name:'Arial',size:10},borders:thin,wrapText:true,verticalAlignment:'center'});
cover.getRange('B8:E8').format.rowHeight=32;
merge(cover,'B13:E13');set(cover,'B13','Cấu trúc theo file Integration của nhóm; cách liên kết ca theo sheet Integrated trong Lab3_Buoi6.xlsx.');
fmt(cover,'B13:E13',{fill:green,font:{name:'Arial',size:10,italic:true},horizontalAlignment:'center',wrapText:true,borders:thin});
cover.getRange('B13:E13').format.rowHeight=28;
merge(cover,'B15:E15');set(cover,'B15','Reference Documents – Inputs used to design the test cases');
fmt(cover,'B15:E15',{fill:green,font:{name:'Arial',size:10,bold:true,color:'#C00000'},borders:thin});
merge(cover,'D16:E16');
for(const [a,v] of [['B16','Version'],['C16','Date'],['D16','Document Name']]) set(cover,a,v);
fmt(cover,'B16:E16',{fill:green,font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',borders:thin});
for(const [r,v] of [[17,'Nhóm09FullnewsPetNoVa.xlsx – testcase F1 đến F12'],[18,'Lab3_Buoi6.xlsx – sheet Integrated, cách liên kết F…-F…']]){
  merge(cover,`D${r}:E${r}`);set(cover,`B${r}`,'v1.0');set(cover,`C${r}`,'31-Oct-2026');set(cover,`D${r}`,v);
  fmt(cover,`B${r}:E${r}`,{font:{name:'Arial',size:10},borders:thin,wrapText:true,verticalAlignment:'center'});
  cover.getRange(`B${r}:E${r}`).format.rowHeight=28;
}

// One traceable requirement row per integration scenario. The B value uses
// exactly the Lab3 Integrated convention: linked Functional testcase IDs.
widths(req,[5.25,33,25.8,50,16.45,20,56,15.8,31.2]);
merge(req,'A1:I1');set(req,'A1','General Information');
fmt(req,'A1:I1',{font:{name:'Arial',size:12,bold:true}});
for(const [r,a,b,c,d] of [[2,'Test Designed By','Nhóm 09','Test Designed Date','31-Oct-2026'],[3,'Test Reviewed By','','Reviewed Date',''],[4,'Project','PetNoVa','Test Phase','Integration test design – chưa thực thi']]){
  merge(req,`A${r}:B${r}`);merge(req,`C${r}:E${r}`);merge(req,`G${r}:I${r}`);
  set(req,`A${r}`,a);set(req,`C${r}`,b);set(req,`F${r}`,c);set(req,`G${r}`,d);
  fmt(req,`A${r}:I${r}`,{font:{name:'Arial',size:10},borders:thin,wrapText:true,verticalAlignment:'center'});
  fmt(req,`A${r}:B${r}`,{font:{name:'Arial',size:10,bold:true}});
  fmt(req,`F${r}`,{font:{name:'Arial',size:10,bold:true}});
  req.getRange(`A${r}:I${r}`).format.rowHeight=25;
}
merge(req,'A7:I7');set(req,'A7','List of Test Requirements');
fmt(req,'A7:I7',{font:{name:'Arial',size:11,bold:true}});
merge(req,'C8:D8');merge(req,'F8:G8');
for(const [a,v] of [['A8','No.'],['B8','Test Requirement ID'],['C8','Test Requirement Description'],['E8','Num of Testcases'],['F8','Note']]) set(req,a,v);
fmt(req,'A8:G8',{fill:green,font:{name:'Arial',size:10,bold:true},borders:{preset:'all',style:'medium',color:border},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true});
req.getRange('A8:G8').format.rowHeight=33;

widths(tc,[5,34,14,35,28,6.5,43,27,47,55,16,16,20]);
merge(tc,'K1:M1');set(tc,'K1','Execute Testing - Version1.0');
fmt(tc,'K1:M1',{fill:yellow,font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',borders:thin});
tc.getRange('A2:M2').values=[['No.','Test Requirement ID','Test Case ID','Test Objective','Pre-conditions','Step #','Step Action','Test Data','Expected Result','Notes','Result','By tester','Note']];
fmt(tc,'A2:J2',{fill:green,font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,borders:{preset:'all',style:'medium',color:border}});
fmt(tc,'K2:M2',{fill:yellow,font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,borders:{preset:'all',style:'medium',color:border}});
tc.getRange('A2:M2').format.rowHeight=34;

let row=3;
for(let i=0;i<cases.length;i++){
  const c=cases[i],num=i+1,start=row,end=start+c.steps.length-1,chain=c.links.join('-'),id=`FI_${String(num).padStart(2,'0')}`;
  const locs=c.links.map(x=>`${functional[x].sheet}!C${functional[x].row}`).join(', ');
  const note=`Nguồn Functional: ${locs}.\nĐiểm nối: ${c.junction||'dữ liệu được chuyển giữa các chức năng liên quan'}.\nChưa thực thi.`;
  for(let j=0;j<c.steps.length;j++){
    const s=c.steps[j],r=start+j;
    tc.getRange(`A${r}:M${r}`).values=[[
      j?null:num,j?null:chain,j?null:id,j?null:c.objective,j?null:c.pre,
      j+1,s.action,s.data||'',s.expected,j?null:note,j?null:'Not Executed',null,null
    ]];
    const h=Math.max(36,Math.min(108,Math.max(lines(s.action,41),lines(s.data,26),lines(s.expected,45))*15+9));
    tc.getRange(`A${r}:M${r}`).format.rowHeight=h;
  }
  fmt(tc,`A${start}:J${end}`,{fill:'#FFFFFF',font:{name:'Arial',size:10},wrapText:true,verticalAlignment:'top',borders:thin});
  fmt(tc,`K${start}:M${end}`,{fill:yellow,font:{name:'Arial',size:10},wrapText:true,verticalAlignment:'top',borders:thin});
  for(const col of ['A','B','C','D','E','J','K','L','M']) merge(tc,`${col}${start}:${col}${end}`);
  fmt(tc,`A${start}:C${end}`,{font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',verticalAlignment:'top'});
  fmt(tc,`F${start}:F${end}`,{font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',verticalAlignment:'center'});
  fmt(tc,`K${start}:K${end}`,{font:{name:'Arial',size:10,bold:true},horizontalAlignment:'center',verticalAlignment:'center'});
  tc.getRange(`A${start}:M${end}`).format.borders={top:{style:'medium',color:border},bottom:{style:'medium',color:border},left:{style:'medium',color:border},right:{style:'medium',color:border}};

  const rr=9+i;
  merge(req,`C${rr}:D${rr}`);merge(req,`F${rr}:G${rr}`);
  set(req,`A${rr}`,num);set(req,`B${rr}`,chain);set(req,`C${rr}`,c.objective);
  req.getRange(`E${rr}`).formulas=[[`=COUNTIF('Integration Test Cases'!$B$3:$B$${2+cases.reduce((n,x)=>n+x.steps.length,0)},B${rr})`]];
  set(req,`F${rr}`,`Nguồn: ${locs}`);
  fmt(req,`A${rr}:G${rr}`,{fill:i%2?'#F7FBFF':'#FFFFFF',font:{name:'Arial',size:10},wrapText:true,verticalAlignment:'top',borders:thin});
  fmt(req,`A${rr}:B${rr}`,{horizontalAlignment:'center'});
  fmt(req,`E${rr}`,{horizontalAlignment:'center'});
  req.getRange(`A${rr}:G${rr}`).format.rowHeight=Math.max(38,Math.min(78,Math.max(lines(chain,32),lines(c.objective,72),lines(locs,65))*16+9));
  row=end+1;
}
const totalRow=9+cases.length+1;
merge(req,`C${totalRow}:D${totalRow}`);set(req,`C${totalRow}`,'Tổng số ca tích hợp');
req.getRange(`E${totalRow}`).formulas=[[`=SUM(E9:E${8+cases.length})`]];
fmt(req,`C${totalRow}:G${totalRow}`,{fill:green,font:{name:'Arial',size:10,bold:true},borders:thin});

widths(lookup,[16,4,4,18,4,4,17]);
lookup.getRange('A1:G1').values=[['Priority','','','Status','','','Type']];
fmt(lookup,'A1:G1',{fill:green,font:{name:'Arial',size:10,bold:true},borders:thin});
for(const [addr,value] of [['A2','High'],['A3','Medium'],['A4','Low'],['D2','Not Executed'],['D3','Passed'],['D4','Failed'],['D5','Blocked'],['G2','LooknFeel'],['G3','Positive'],['G4','Negative'],['G5','Boundary']]) set(lookup,addr,value);
fmt(lookup,'A2:G5',{font:{name:'Arial',size:10},borders:thin});

result.recalculate();
const inspect=await result.inspect({kind:'table',range:`'Test Requirements'!A${totalRow}:G${totalRow}`,tableMaxRows:1,tableMaxCols:7,maxChars:1000});
console.log('TOTAL_INSPECT',inspect.ndjson);
const errors=await result.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},summary:'final formula error scan',maxChars:1500});
console.log('ERROR_SCAN',errors.ndjson);
for(const [sheetName,range,name] of [
  ['Cover Page','B2:E18','cover_after'],
  ['Test Requirements','A7:G15','requirements_first'],
  ['Test Requirements','A37:G44','requirements_middle'],
  ['Test Requirements',`A${totalRow-6}:G${totalRow}`,'requirements_last'],
  ['Integration Test Cases','A1:M8','cases_first'],
  ['Integration Test Cases','A103:M108','cases_middle'],
  ['Integration Test Cases',`A${row-7}:M${row-1}`,'cases_last'],
  ['Sheet4','A1:G5','lookup_after'],
]){
  const png=await result.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(path.join(dir,name+'.png'),new Uint8Array(await png.arrayBuffer()));
}
const outDir=`${root}/outputs/01a0c27b-f522-7c62-8cec-50db5c0bf907`;
await fs.mkdir(outDir,{recursive:true});
const out=path.join(outDir,'Nhom09_IntergrationTC_hoan_chinh.xlsx');
await (await SpreadsheetFile.exportXlsx(result)).save(out);
console.log(JSON.stringify({out,cases:cases.length,steps:row-3,requirementRows:cases.length,lastCaseRow:row-1,moduleCoverage:[...moduleCoverage].sort((a,b)=>a-b)}));
