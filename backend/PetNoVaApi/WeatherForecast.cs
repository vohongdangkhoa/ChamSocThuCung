// File mẫu mặc định của ASP.NET Core, không tham gia nghiệp vụ PetNoVa.
namespace PetNoVaApi
{
    /// <summary>Dữ liệu demo giữ lại để tham khảo cấu trúc endpoint ASP.NET.</summary>
    public class WeatherForecast
    {
        public DateOnly Date { get; set; }

        public int TemperatureC { get; set; }

        public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);

        public string? Summary { get; set; }
    }
}
