using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CourierFlow.Core.Enums;

namespace CourierFlow.Core.Entities
{
    public class OrderStatusHistory
    {
        public int Id { get; set; }

        public int OrderId { get; set; }

        public OrderStatus Status { get; set; }

        public int ChangedByUserId { get; set; }

        public DateTime ChangedAt { get; set; }

        public Order Order { get; set; } = null!;

        public User ChangedByUser { get; set; } = null!;
    }
}