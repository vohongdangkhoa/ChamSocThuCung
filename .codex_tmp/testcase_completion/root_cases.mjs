export const requirements = [
  {id:'F6',name:'Xem hồ sơ sức khỏe',description:'Khách hàng xem bệnh án và lịch tiêm theo thú cưng thuộc tài khoản.',type:'Positive / Negative / LooknFeel',importance:'High',sources:['web-react/src/cong-khach-hang.jsx','backend/PetNoVaApi/Controllers/HoSoSucKhoeController.cs','backend/PetNoVaApi/Services/PhienNguoiDung.cs'],scenarios:'Xem dữ liệu có/rỗng; đổi thú cưng; thứ tự bệnh án; mũi tiêm tiếp theo; ngăn đọc hồ sơ của khách khác.'},
  {id:'F7',name:'Thông báo cá nhân',description:'Xem thông báo của tài khoản, đánh dấu một hoặc tất cả đã đọc, mở lịch hẹn liên quan.',type:'Positive / Negative / LooknFeel',importance:'Medium',sources:['web-react/src/cong-khach-hang.jsx','backend/PetNoVaApi/Controllers/ThongBaoController.cs'],scenarios:'Có thông báo/rỗng; đọc một/tất cả; cập nhật số chưa đọc; thao tác lặp; mở lịch liên quan; chặn thông báo của khách khác.'}
];
export const cases=[];
const step=(action,data,expected)=>({action,data,expected});
const add=(req,objective,pre,steps,notes='',gui=false)=>cases.push({req,objective,pre,steps,notes,gui});
const kh='KH_A là tài khoản thử CUSTOMER/ACTIVE đã đăng nhập; API và cơ sở dữ liệu kết nối được.';
add('F6','Xem đúng bệnh án và tiêm chủng của thú cưng có dữ liệu',kh+' PET_A thuộc KH_A, có một bệnh án và một mũi tiêm với dữ liệu đối chiếu đã ghi nhận.',[
  step('Mở Sổ sức khỏe và chọn PET_A.','PET_A; bệnh án MR_A; mũi tiêm VX_A đã chuẩn bị.','Hiển thị hồ sơ PET_A, các vùng Lịch sử khám và Sổ tiêm chủng.'),
  step('Đối chiếu chẩn đoán, điều trị, ngày khám, tên vaccine, ngày tiêm và ngày nhắc lại.','Các giá trị thực tế của MR_A và VX_A trong dữ liệu thử.','Các thông tin hiển thị khớp dữ liệu của PET_A, không lẫn thú cưng khác.')]);
add('F6','Hiển thị trạng thái khi khách chưa có thú cưng',kh+' KH_A chưa có hồ sơ thú cưng trong dữ liệu thử.',[
  step('Mở Sổ sức khỏe.','Tài khoản không có thú cưng.','Hiển thị hướng dẫn thêm thú cưng để xem hồ sơ sức khỏe.'),
  step('Quan sát các vùng dữ liệu.','Danh sách thú cưng rỗng.','Không hiển thị bệnh án hoặc mũi tiêm của tài khoản khác; trang vẫn sử dụng được.')]);
add('F6','Hiển thị trạng thái khi thú cưng chưa có bệnh án và mũi tiêm',kh+' PET_A thuộc KH_A và chưa có bệnh án hay tiêm chủng.',[
  step('Mở Sổ sức khỏe và chọn PET_A.','PET_A không có MR/VX.','Hiển thị thông tin PET_A.'),
  step('Quan sát Lịch sử khám và Sổ tiêm chủng.','0 bệnh án; 0 mũi tiêm.','Hai vùng có trạng thái chưa có dữ liệu tương ứng, không hiển thị lỗi tải.')]);
add('F6','Đổi thú cưng không giữ lại dữ liệu hồ sơ trước đó',kh+' PET_A và PET_B cùng thuộc KH_A, có chẩn đoán và vaccine khác nhau dễ phân biệt.',[
  step('Chọn PET_A trong Sổ sức khỏe.','PET_A, MR_A và VX_A.','Hiển thị dữ liệu của PET_A.'),
  step('Chọn tab PET_B, chờ tải dữ liệu.','PET_B, MR_B và VX_B.','Thông tin thú cưng, bệnh án và tiêm chủng chuyển sang PET_B; không hiển thị MR_A/VX_A như dữ liệu của PET_B.')]);
add('F6','Lịch sử khám được sắp từ ngày mới đến ngày cũ',kh+' PET_A có ít nhất hai bệnh án khác ngày, đã xác nhận thứ tự ngày trong dữ liệu thử.',[
  step('Mở Sổ sức khỏe của PET_A.','MR_mới có recordDate lớn hơn MR_cũ.','Cả hai bệnh án được hiển thị.'),
  step('Đối chiếu thứ tự trong Lịch sử khám.','Ngày của MR_mới và MR_cũ.','MR_mới xuất hiện trước MR_cũ.')]);
add('F6','Mũi tiêm tiếp theo chọn ngày nhắc gần nhất chưa qua',kh+' PET_A có ba mũi với nextDate hôm qua, ngày mai và sau ngày mai.',[
  step('Mở Sổ sức khỏe của PET_A.','nextDate: hôm qua, ngày mai, sau ngày mai theo ngày thử.','Sổ tiêm chủng liệt kê các mũi đã chuẩn bị.'),
  step('Quan sát vùng Mũi tiêm tiếp theo.','Vaccine có nextDate là ngày mai.','Hiển thị vaccine có ngày nhắc gần nhất từ hôm nay trở đi; không chọn mũi đã qua ngày nhắc.')]);
add('F6','Chặn khách đọc bệnh án và tiêm chủng của khách khác qua API',kh+' KH_B là khách khác; PET_B thuộc KH_B. Có công cụ gửi HTTP và token KH_A đang hiệu lực.',[
  step('Gửi GET /api/MedicalRecords/pet/{PET_B} bằng token KH_A.','petId thực tế của PET_B; Authorization Bearer của KH_A.','Không trả bệnh án PET_B; yêu cầu bị từ chối hoặc không tìm thấy bản ghi.'),
  step('Gửi GET /api/Vaccinations/pet/{PET_B} bằng cùng token.','PET_B của KH_B.','Không trả các mũi tiêm của PET_B; dữ liệu không bị tiết lộ.')], 'Dùng đúng petId được chuẩn bị trong môi trường thử; không suy ra quyền từ việc ẩn tab.');
add('F7','Xem đúng nội dung và thứ tự thông báo cá nhân',kh+' Có N_mới và N_cũ của KH_A khác createdAt; KH_B có thông báo riêng.',[
  step('Mở Thông báo.','N_mới, N_cũ của KH_A.','Hiển thị tiêu đề, nội dung, thời gian của thông báo KH_A.'),
  step('Đối chiếu thứ tự và người nhận.','createdAt N_mới > N_cũ.','N_mới trước N_cũ; không hiển thị thông báo KH_B.')]);
add('F7','Hiển thị trạng thái chưa có thông báo',kh+' KH_A không có thông báo.',[
  step('Mở Thông báo.','0 thông báo.','Hiển thị thông điệp chưa có thông báo.'),
  step('Quan sát số chưa đọc và hành động đọc tất cả.','0 chưa đọc.','Không báo có thông báo chưa đọc; không hiển thị hành động đánh dấu tất cả khi không cần.')]);
add('F7','Đọc một thông báo cập nhật số chưa đọc và lưu trạng thái',kh+' N_A chưa đọc và N_B chưa đọc thuộc KH_A; ghi nhận tổng chưa đọc ban đầu.',[
  step('Mở Thông báo và bấm N_A.','N_A.isRead=false.','N_A chuyển sang đã đọc; số chưa đọc giảm một.'),
  step('Tải lại trang và mở Thông báo.','N_A; N_B.','N_A vẫn đã đọc; N_B giữ trạng thái chưa đọc nếu chưa thao tác.')]);
add('F7','Đọc lại thông báo đã đọc không làm giảm số đếm thêm',kh+' N_A đã đọc; còn ít nhất một thông báo khác chưa đọc.',[
  step('Ghi nhận số chưa đọc rồi bấm N_A.','N_A.isRead=true.','Số chưa đọc không giảm do đọc lại N_A.'),
  step('Bấm lại N_A và tải lại.','Cùng N_A.','Số chưa đọc vẫn khớp các thông báo thật sự chưa đọc, không âm.')]);
add('F7','Đánh dấu tất cả thông báo của tài khoản là đã đọc',kh+' KH_A có ít nhất hai thông báo chưa đọc; KH_B cũng có thông báo chưa đọc để đối chiếu.',[
  step('Trong Thông báo, bấm Đánh dấu đã đọc.','Các thông báo chưa đọc của KH_A.','Tất cả thông báo KH_A trên danh sách chuyển sang đã đọc; số chưa đọc bằng 0.'),
  step('Tải lại trang, đối chiếu dữ liệu hai tài khoản.','KH_A và KH_B.','Trạng thái đã đọc của KH_A được lưu; thông báo KH_B không bị thay đổi.')]);
add('F7','Mở thông báo lịch hẹn dẫn đến đúng chi tiết lịch',kh+' N_A thuộc KH_A, relatedType=BOOKING, relatedId là B_A thuộc KH_A và còn tồn tại.',[
  step('Bấm N_A trong Thông báo.','N_A → B_A.','Thông báo được đánh dấu đã đọc và mở chi tiết lịch B_A.'),
  step('Đối chiếu mã lịch và thú cưng trên chi tiết.','B_A và petId của B_A.','Chi tiết khớp lịch được liên kết, không mở lịch khác.')]);
add('F7','Chặn đọc và đánh dấu thông báo của khách khác',kh+' KH_B có N_B chưa đọc. Có token KH_A và công cụ HTTP.',[
  step('Gửi GET /api/Notifications/user/{KH_B} bằng token KH_A.','userId KH_B.','Yêu cầu bị từ chối, không trả danh sách KH_B.'),
  step('Gửi PUT /api/Notifications/{N_B}/read bằng token KH_A.','notificationId N_B.','Không được cập nhật N_B; trả lỗi quyền hoặc không tìm thấy.'),
  step('Đối chiếu N_B bằng tài khoản có quyền.','N_B trước và sau.','N_B vẫn chưa đọc.')]);
add('F7','Lỗi mạng khi đánh dấu đã đọc không giả báo thành công',kh+' N_A chưa đọc. Có thể mô phỏng ngắt API sau khi danh sách đã tải.',[
  step('Mở Thông báo, ngắt kết nối API và bấm N_A.','N_A chưa đọc; API không truy cập được.','Có phản hồi lỗi cập nhật; không coi N_A đã được lưu thành đã đọc khi API thất bại.'),
  step('Khôi phục API, tải lại dữ liệu.','N_A chưa được cập nhật thành công.','Trạng thái hiển thị khớp dữ liệu máy chủ; có thể thực hiện lại thao tác.')]);

const guiSpecs=[
 ['F1.3','F1','Đăng nhập','chưa đăng nhập; trang Đăng nhập mở được','Email; Mật khẩu; nút ĐĂNG NHẬP; Đăng ký ngay; Quên mật khẩu','web-react/src/trang-dang-nhap.jsx'],
 ['F2','F2','Tổng quan khách hàng','KH_A CUSTOMER/ACTIVE đã đăng nhập, có dữ liệu tổng quan','tên khách hàng, thẻ số liệu, lịch hẹn và các nút điều hướng','web-react/src/cong-khach-hang.jsx'],
 ['F3.2','F3','Thêm thú cưng','KH_A đã đăng nhập và mở biểu mẫu Thêm thú cưng','nhãn các trường, ảnh xem trước, nút lưu và hủy','web-react/src/cong-khach-hang.jsx'],
 ['F4.3','F4','Đặt lịch chăm sóc','KH_A đã đăng nhập, có thú cưng và dịch vụ ACTIVE; mở biểu mẫu đặt lịch','thú cưng, hình thức, dịch vụ, ngày giờ, tổng tiền và phương thức thanh toán','web-react/src/lich-hen-khach-hang.jsx'],
 ['F5.1','F5','Lịch sử thanh toán','KH_A đã đăng nhập, có giao dịch với dữ liệu tiếng Việt và số tiền','mã lịch, số tiền, phương thức, trạng thái và nút hành động tương ứng','web-react/src/lich-hen-khach-hang.jsx'],
 ['F6','F6','Sổ sức khỏe','KH_A đã đăng nhập, có thú cưng với bệnh án và mũi tiêm','tab thú cưng, Lịch sử khám, Sổ tiêm chủng, ngày và tên vaccine','web-react/src/cong-khach-hang.jsx'],
 ['F7','F7','Thông báo','KH_A đã đăng nhập, có thông báo đã đọc và chưa đọc','tiêu đề, nội dung, thời gian và dấu Chưa đọc','web-react/src/cong-khach-hang.jsx'],
 ['F8.1','F8','Thông tin tài khoản','KH_A đã đăng nhập và mở trang Tài khoản','họ tên, email, số điện thoại, ảnh đại diện và nút lưu','web-react/src/cong-khach-hang.jsx'],
 ['F9.1','F9','Bàn vận hành','NV_A STAFF/ACTIVE đã đăng nhập; có lịch hẹn thử','tìm kiếm, bộ lọc, danh sách lịch và các nút thao tác được cấp quyền','web-react/src/cong-van-hanh.jsx'],
 ['F10.4','F10','Bệnh án','BS_A VET/ACTIVE đã đăng nhập, được phân công PET_A và mở form bệnh án','chẩn đoán, điều trị, toa thuốc, ngày tái khám và nút lưu','web-react/src/cong-van-hanh.jsx'],
 ['F11.1','F11','Tổng quan quản trị','AD_A ADMIN/ACTIVE đã đăng nhập, có dữ liệu tổng quan','các thẻ thống kê, danh mục điều hướng và bảng dữ liệu','web-react/src/cong-van-hanh.jsx'],
 ['F12.4','F12','Điều hướng theo vai trò','Có tài khoản thử CUSTOMER, STAFF, VET, ADMIN; từng phiên đăng nhập đúng vai trò','menu và nội dung chức năng của từng vai trò','web-react/src/ung-dung.jsx']
];
for(const [req,group,screen,pre,items,source] of guiSpecs){
 add(req,'GUI: nội dung và bố cục '+screen,pre+'.',[
   step('Mở màn hình '+screen+' ở trình duyệt thử.','Dữ liệu chuẩn bị cho màn hình; tên tiếng Việt có dấu.','Hiển thị đủ '+items+'.'),
   step('Quan sát nhãn, dữ liệu và vùng nội dung khi cuộn đến cuối.','Các nhãn và trường có trong giao diện hiện tại.','Nhãn có thể đọc, tiếng Việt không mất dấu, nội dung không chồng lên nút hoặc bị cắt mất khi cần thao tác.')
 ],'Nguồn giao diện: '+source+'. Kiểm tra hình thức; chưa có kết quả chạy.',true);
 add(req,'GUI: thao tác '+screen+' tại màn hình hẹp',pre+'. Có công cụ đổi kích thước trình duyệt.',[
   step('Mở màn hình ở cửa sổ desktop rồi thu hẹp còn khoảng 390 CSS pixel.','Viewport kiểm tra chọn trước: desktop 1366×768; mobile 390×844.','Nội dung được bố trí theo kích thước cửa sổ; các vùng chính vẫn truy cập được.'),
   step('Cuộn trang và mở các vùng có thể cuộn hoặc menu tại màn hình đó.','Nút, biểu mẫu hoặc bảng đang hiển thị.','Có thể đọc nội dung và tiếp cận các điều khiển; bảng rộng cuộn được, không che mất nút thao tác.')
 ],'Kích thước trên là dữ liệu kiểm tra, không tuyên bố là ma trận trình duyệt được hỗ trợ chính thức. Nguồn: '+source+'.',true);
}
