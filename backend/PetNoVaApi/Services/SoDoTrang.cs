namespace PetNoVaApi.Services;

// Menu tập trung: thêm một màn hình thì đăng ký đường dẫn và tên ở đúng vai trò.
public record MucDieuHuong(string DuongDan, string Ten);

public static class SoDoTrang
{
    private static readonly Dictionary<string, MucDieuHuong[]> CacVaiTro = new()
    {
        ["khach-hang"] = [
            new("/khach-hang/tong-quan", "Tổng quan"),
            new("/khach-hang/thu-cung", "Thú cưng"),
            new("/khach-hang/dat-lich", "Đặt lịch"),
            new("/khach-hang/lich-hen", "Lịch hẹn"),
            new("/khach-hang/thanh-toan", "Thanh toán"),
            new("/khach-hang/suc-khoe", "Sức khỏe"),
            new("/khach-hang/thong-bao", "Thông báo"),
            new("/khach-hang/tai-khoan", "Tài khoản"),
        ],
        ["nhan-vien"] = [
            new("/nhan-vien/tong-quan", "Tổng quan"),
            new("/nhan-vien/lich-hen", "Lịch hẹn"),
            new("/nhan-vien/thanh-toan", "Thanh toán"),
            new("/nhan-vien/khach-hang", "Khách hàng"),
            new("/nhan-vien/dich-vu", "Dịch vụ"),
            new("/nhan-vien/thong-bao", "Thông báo"),
            new("/nhan-vien/tai-khoan", "Tài khoản"),
        ],
        ["bac-si"] = [
            new("/bac-si/tong-quan", "Tổng quan"),
            new("/bac-si/lich-hen", "Lịch được phân công"),
            new("/bac-si/suc-khoe", "Bệnh án & tiêm chủng"),
            new("/bac-si/thong-bao", "Thông báo"),
            new("/bac-si/tai-khoan", "Tài khoản"),
        ],
        ["quan-tri"] = [
            new("/quan-tri/tong-quan", "Báo cáo"),
            new("/quan-tri/lich-hen", "Lịch hẹn"),
            new("/quan-tri/thanh-toan", "Thanh toán"),
            new("/quan-tri/nguoi-dung", "Người dùng"),
            new("/quan-tri/nhan-su", "Nhân sự"),
            new("/quan-tri/dich-vu", "Dịch vụ"),
            new("/quan-tri/danh-muc", "Danh mục"),
            new("/quan-tri/thong-bao", "Thông báo"),
            new("/quan-tri/nhat-ky", "Nhật ký"),
            new("/quan-tri/tai-khoan", "Tài khoản"),
        ],
    };

    public static string VaiTro(string path) => path.Split('/', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "";
    public static IReadOnlyList<MucDieuHuong> Menu(string role) => CacVaiTro.GetValueOrDefault(role) ?? [];
    public static string TenVaiTro(string role) => role switch
    {
        "khach-hang" => "Khách hàng",
        "nhan-vien" => "Nhân viên",
        "bac-si" => "Bác sĩ",
        "quan-tri" => "Quản trị",
        _ => "PetNoVa",
    };
    public static string MaVaiTro(string role) => role switch
    {
        "khach-hang" => "CUSTOMER", "nhan-vien" => "STAFF", "bac-si" => "VET", "quan-tri" => "ADMIN", _ => "",
    };
}
