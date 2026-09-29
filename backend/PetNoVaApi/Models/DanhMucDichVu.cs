using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace PetNoVaApi.Models;

[Table("SERVICE_CATEGORY")]
public sealed class DanhMucDichVu
{
    [Key, MaxLength(10)] public string categoryId { get; set; } = "";
    [Required, MaxLength(50)] public string categoryName { get; set; } = "";
    [MaxLength(255)] public string description { get; set; } = "";
    [MaxLength(20)] public string status { get; set; } = "ACTIVE";
}
