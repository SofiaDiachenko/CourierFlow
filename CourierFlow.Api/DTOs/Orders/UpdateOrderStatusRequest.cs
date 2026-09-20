using CourierFlow.Core.Enums;
using System.ComponentModel.DataAnnotations;

namespace CourierFlow.Api.DTOs.Orders
{
    public class UpdateOrderStatusRequest
    {
        [EnumDataType(
            typeof(OrderStatus),
            ErrorMessage = "Invalid order status.")]
        public OrderStatus Status { get; set; }
    }
}