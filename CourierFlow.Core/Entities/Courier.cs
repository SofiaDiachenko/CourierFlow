using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CourierFlow.Core.Enums;

namespace CourierFlow.Core.Entities
{
    public class Courier
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public CourierStatus Status { get; set; }

        public User User { get; set; } = null!;

        public ICollection<Order> Orders { get; set; } = new List<Order>();
    }
}