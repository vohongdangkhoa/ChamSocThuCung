using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace PetNoVaApi.Models;

[Table("CARE_TYPE")]
public sealed class HinhThucChamSoc
{
    [Key] public string careTypeId { get; set; } = "";
    public string typeName { get; set; } = "";
    public string? description { get; set; }
}
