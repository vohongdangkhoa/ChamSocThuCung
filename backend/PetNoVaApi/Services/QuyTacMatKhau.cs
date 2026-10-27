namespace PetNoVaApi.Services;

/// <summary>Quy tắc chung cho mật khẩu mới; không chuẩn hóa hoặc cắt khoảng trắng.</summary>
public static class QuyTacMatKhau
{
    public const int MinLength = 12;
    public const int MaxLength = 128;

    // Tập ký hiệu được Firebase tính là non-alphanumeric. Dấu cách, +, -, =
    // vẫn được phép xuất hiện nhưng không tự đáp ứng yêu cầu ký hiệu đặc biệt.
    private const string KyHieuDacBiet = "^$*.[]{}()?\"!@#%&/\\,><':;|_~";

    /// <returns>Thông báo lỗi an toàn cho người dùng, hoặc null khi hợp lệ.</returns>
    public static string? KiemTra(string? password)
    {
        if (string.IsNullOrEmpty(password)) return "Vui lòng nhập mật khẩu.";
        if (password.Length < MinLength)
            return $"Mật khẩu cần ít nhất {MinLength} ký tự.";
        if (password.Length > MaxLength)
            return $"Mật khẩu không được vượt quá {MaxLength} ký tự.";

        var coChuHoa = false;
        var coChuThuong = false;
        var coChuSo = false;
        var coKyHieu = false;
        foreach (var kyTu in password)
        {
            if (kyTu is < '\u0020' or > '\u007e')
                return "Mật khẩu chỉ dùng chữ không dấu, số, dấu cách và ký hiệu trên bàn phím.";
            coChuHoa |= kyTu is >= 'A' and <= 'Z';
            coChuThuong |= kyTu is >= 'a' and <= 'z';
            coChuSo |= kyTu is >= '0' and <= '9';
            coKyHieu |= KyHieuDacBiet.Contains(kyTu);
        }

        if (!coChuHoa) return "Mật khẩu cần ít nhất một chữ hoa (A-Z).";
        if (!coChuThuong) return "Mật khẩu cần ít nhất một chữ thường (a-z).";
        if (!coChuSo) return "Mật khẩu cần ít nhất một chữ số (0-9).";
        if (!coKyHieu)
            return "Mật khẩu cần có ít nhất một ký tự đặc biệt như !, @, # hoặc $.";
        return null;
    }
}
