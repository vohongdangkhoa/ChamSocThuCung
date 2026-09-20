using Microsoft.AspNetCore.Mvc;

// Controller mẫu của template ASP.NET, không được Flutter PetNoVa sử dụng.
namespace PetNoVaApi.Controllers
{
    [ApiController]
    [Route("[controller]")]
    /// <summary>Endpoint demo có thể xóa khi dọn template.</summary>
    public class WeatherForecastController : ControllerBase
    {
        private static readonly string[] Summaries =
        [
            "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
        ];

        [HttpGet(Name = "GetWeatherForecast")]
        /// <summary>Sinh năm dòng thời tiết ngẫu nhiên để minh họa template ASP.NET.</summary>
        /// <returns>Dữ liệu demo, không đọc PetNoVaDB và không thuộc nghiệp vụ ứng dụng.</returns>
        public IEnumerable<WeatherForecast> Get()
        {
            // Enumerable.Range tạo năm ngày kế tiếp; nhiệt độ/mô tả chỉ là số ngẫu nhiên.
            return Enumerable.Range(1, 5).Select(index => new WeatherForecast
            {
                Date = DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
                TemperatureC = Random.Shared.Next(-20, 55),
                Summary = Summaries[Random.Shared.Next(Summaries.Length)]
            })
            .ToArray();
        }
    }
}
