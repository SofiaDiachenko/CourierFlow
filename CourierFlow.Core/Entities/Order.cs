using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CourierFlow.Core.Enums;

namespace CourierFlow.Core.Entities
{
    public class Order
    {
        public int Id { get; set; }

        public int ClientId { get; set; }

        public int? CourierId { get; set; }

        public string SenderAddress { get; set; } = string.Empty;

        public string DeliveryAddress { get; set; } = string.Empty;

        public string RecipientName { get; set; } = string.Empty;

        public string RecipientPhone { get; set; } = string.Empty;

        public string? PackageDescription { get; set; }

        public OrderStatus Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public User Client { get; set; } = null!;

        public Courier? Courier { get; set; }

        public ICollection<OrderStatusHistory> StatusHistory { get; set; }
            = new List<OrderStatusHistory>();
    }
}