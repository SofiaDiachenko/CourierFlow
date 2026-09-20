using CourierFlow.Core.Enums;

namespace CourierFlow.Api.DTOs.Orders
{
    public class OrderResponse
    {
        public int Id { get; set; }
        public int ClientId { get; set; }
        public int? CourierId { get; set; }

        public string SenderAddress { get; set; } = string.Empty;
        public string DeliveryAddress { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string RecipientPhone { get; set; } = string.Empty;
        public string PackageDescription { get; set; } = string.Empty;

        public OrderStatus Status { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public ClientResponse? Client { get; set; }
        public CourierResponse? Courier { get; set; }
    }

    public class ClientResponse
    {
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;
    }

    public class CourierResponse
    {
        public int Id { get; set; }
        public int UserId { get; set; }

        public CourierStatus Status { get; set; }
    }
}