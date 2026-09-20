using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CourierFlow.Core.Enums
{
    public enum OrderStatus
    {
        New = 0,
        Assigned = 1,
        PickedUp = 2,
        InTransit = 3,
        Delivered = 4,
        Cancelled = 5
    }
}
