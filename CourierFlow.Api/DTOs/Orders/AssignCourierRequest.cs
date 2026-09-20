using System.ComponentModel.DataAnnotations;

namespace CourierFlow.Api.DTOs.Orders
{
    public class AssignCourierRequest
    {
        [Range(
            1,
            int.MaxValue,
            ErrorMessage = "Courier ID must be greater than 0.")]
        public int CourierId { get; set; }
    }
}