// Chuẩn hóa nhiều cách nhập số Việt Nam về một khóa tra cứu thống nhất.
namespace PetNoVaApi.Services;

/// <summary>Tiện ích dùng chung cho đăng ký và quên mật khẩu.</summary>
public static class PhoneNumberNormalizer
{
    /// <summary>Loại ký tự phụ và đổi +84/84 thành dạng 0xxxxxxxxx hợp lệ.</summary>
    public static string? NormalizeVietnamese(string? rawPhone)
    {
        // null/rỗng không phải số điện thoại hợp lệ và không được đưa vào truy vấn DB.
        if (string.IsNullOrWhiteSpace(rawPhone))
        {
            return null;
        }

        // Duyệt từng ký tự để chỉ chấp nhận số, dấu + đầu chuỗi và dấu phân cách quen thuộc.
        var raw = rawPhone.Trim();
        var digits = new List<char>(raw.Length);
        var hasLeadingPlus = false;

        for (var index = 0; index < raw.Length; index++)
        {
            var character = raw[index];

            // Gom chữ số, bỏ khoảng trắng/gạch/chấm/ngoặc nhưng từ chối ký tự lạ.
            if (character is >= '0' and <= '9')
            {
                digits.Add(character);
                continue;
            }

            if (character == '+' && index == 0)
            {
                hasLeadingPlus = true;
                continue;
            }

            if (char.IsWhiteSpace(character) || character is '-' or '.' or '(' or ')')
            {
                continue;
            }

            return null;
        }

        var number = new string(digits.ToArray());

        // Tiền tố gọi quốc tế 00 được xem tương đương dấu +.
        if (number.StartsWith("00", StringComparison.Ordinal))
        {
            number = number[2..];
            hasLeadingPlus = true;
        }

        // Dạng nội địa 0xxxxxxxxx được đổi sang chuẩn E.164 +84xxxxxxxxx.
        if (
            number.StartsWith('0')
            && number.Length == 10
            && number[1] != '0'
        )
        {
            return $"+84{number[1..]}";
        }

        // Cho phép người dùng nhập 84xxxxxxxxx nhưng quên dấu +.
        if (
            !hasLeadingPlus
            && number.StartsWith("84", StringComparison.Ordinal)
            && number.Length == 11
            && number[2] != '0'
        )
        {
            return $"+{number}";
        }

        // Chín chữ số thuê bao được hiểu là số Việt Nam thiếu cả 0 và +84.
        if (!hasLeadingPlus && number.Length == 9 && number[0] != '0')
        {
            return $"+84{number}";
        }

        // Dạng +84 hợp lệ được chuẩn hóa lại để kết quả luôn giống nhau.
        if (
            hasLeadingPlus
            && number.StartsWith("84", StringComparison.Ordinal)
            && number.Length == 11
            && number[2] != '0'
        )
        {
            return $"+{number}";
        }

        // Mọi độ dài/đầu số còn lại bị từ chối thay vì đoán sai tài khoản.
        return null;
    }
}
