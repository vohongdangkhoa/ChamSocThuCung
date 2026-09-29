using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace PetNoVaApi.Models;

[Table("PETNOVA_AUDIT")]
public sealed class NhatKyThaoTac
{
    [Key] public long id { get; set; }
    [MaxLength(128)] public string userId { get; set; } = "";
    [MaxLength(256)] public string actorName { get; set; } = "";
    [MaxLength(20)] public string role { get; set; } = "";
    [MaxLength(256)] public string action { get; set; } = "";
    [MaxLength(128)] public string? targetId { get; set; }
    public DateTime createdAt { get; set; }
}
