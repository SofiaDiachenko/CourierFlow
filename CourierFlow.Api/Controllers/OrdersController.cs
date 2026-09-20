using CourierFlow.Api.DTOs.Orders;
using CourierFlow.Core.Entities;
using CourierFlow.Core.Enums;
using CourierFlow.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourierFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly CourierFlowDbContext _context;

        public OrdersController(CourierFlowDbContext context)
        {
            _context = context;
        }


        // ============================================================
        // Допоміжний метод
        // Перетворює Order у безпечний OrderResponse
        // ============================================================

        private static OrderResponse ToOrderResponse(Order order)
        {
            return new OrderResponse
            {
                Id = order.Id,
                ClientId = order.ClientId,
                CourierId = order.CourierId,

                SenderAddress = order.SenderAddress ?? string.Empty,
                DeliveryAddress = order.DeliveryAddress ?? string.Empty,
                RecipientName = order.RecipientName ?? string.Empty,
                RecipientPhone = order.RecipientPhone ?? string.Empty,
                PackageDescription =
                    order.PackageDescription ?? string.Empty,

                Status = order.Status,

                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,

                Client = order.Client == null
                ? null
                : new ClientResponse
                {
                    Id = order.Client.Id,
                    Name = order.Client.Name ?? string.Empty
                },

                Courier = order.Courier == null
                    ? null
                    : new CourierResponse
                    {
                        Id = order.Courier.Id,
                        UserId = order.Courier.UserId,
                        Status = order.Courier.Status
                    }
            };
        }


        // ============================================================
        // Допоміжний метод
        // Отримання ID поточного користувача з JWT
        // ============================================================

        private bool TryGetCurrentUserId(out int userId)
        {
            userId = 0;

            var claim =
                User.FindFirst(ClaimTypes.NameIdentifier);

            return claim != null &&
                   int.TryParse(claim.Value, out userId);
        }


        // ============================================================
        // POST: api/orders
        // Створення замовлення клієнтом
        // ============================================================

        [Authorize(Roles = "Client")]
        [HttpPost]
        public async Task<ActionResult<OrderResponse>> CreateOrder(
            CreateOrderRequest request)
        {
            if (!TryGetCurrentUserId(out int clientId))
            {
                return Unauthorized(new
                {
                    message = "Invalid authentication token."
                });
            }

            var client = await _context.Users
                .FirstOrDefaultAsync(
                    u => u.Id == clientId);

            if (client == null)
            {
                return NotFound(new
                {
                    message = "Client not found."
                });
            }

            var order = new Order
            {
                ClientId = clientId,

                SenderAddress = request.SenderAddress,
                DeliveryAddress = request.DeliveryAddress,
                RecipientName = request.RecipientName,
                RecipientPhone = request.RecipientPhone,
                PackageDescription =
                    request.PackageDescription,

                Status = OrderStatus.New,

                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Orders.Add(order);

            await _context.SaveChangesAsync();

            order.Client = client;

            return CreatedAtAction(
                nameof(GetOrderById),
                new { id = order.Id },
                ToOrderResponse(order));
        }


        // ============================================================
        // GET: api/orders
        // Усі замовлення
        // Доступ тільки для адміністратора
        // ============================================================

        [Authorize(Roles = "Admin")]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<OrderResponse>>>
            GetOrders()
        {
            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Client)
                .Include(o => o.Courier)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            var result = orders
                .Select(ToOrderResponse)
                .ToList();

            return Ok(result);
        }


        // ============================================================
        // GET: api/orders/my
        // Замовлення поточного клієнта
        // ============================================================

        [Authorize(Roles = "Client")]
        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<OrderResponse>>>
            GetMyOrders()
        {
            if (!TryGetCurrentUserId(out int clientId))
            {
                return Unauthorized(new
                {
                    message = "Invalid authentication token."
                });
            }

            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Client)
                .Include(o => o.Courier)
                .Where(o => o.ClientId == clientId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            var result = orders
                .Select(ToOrderResponse)
                .ToList();

            return Ok(result);
        }


        // ============================================================
        // GET: api/orders/{id}
        //
        // Admin:
        //   може переглядати будь-яке замовлення.
        //
        // Client:
        //   тільки власне.
        //
        // Courier:
        //   тільки призначене йому.
        // ============================================================

        [Authorize]
        [HttpGet("{id:int}")]
        public async Task<ActionResult<OrderResponse>>
            GetOrderById(int id)
        {
            if (!TryGetCurrentUserId(out int currentUserId))
            {
                return Unauthorized(new
                {
                    message = "Invalid authentication token."
                });
            }

            var order = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Client)
                .Include(o => o.Courier)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound(new
                {
                    message = "Order not found."
                });
            }

            if (User.IsInRole("Admin"))
            {
                return Ok(ToOrderResponse(order));
            }

            if (User.IsInRole("Client"))
            {
                if (order.ClientId != currentUserId)
                {
                    return StatusCode(403, new
                    {
                        message =
                            "You cannot access another client's order."
                    });
                }

                return Ok(ToOrderResponse(order));
            }

            if (User.IsInRole("Courier"))
            {
                if (order.Courier == null ||
                    order.Courier.UserId != currentUserId)
                {
                    return StatusCode(403, new
                    {
                        message =
                            "This order is not assigned to you."
                    });
                }

                return Ok(ToOrderResponse(order));
            }

            return StatusCode(403, new
            {
                message =
                    "You do not have permission to access this order."
            });
        }


        // ============================================================
        // PATCH: api/orders/{id}/assign
        // Призначення кур'єра
        // Тільки Admin
        // ============================================================

        [Authorize(Roles = "Admin")]
        [HttpPatch("{id:int}/assign")]
        public async Task<ActionResult<OrderResponse>>
            AssignCourier(
                int id,
                AssignCourierRequest request)
        {
            if (!TryGetCurrentUserId(out int adminUserId))
            {
                return Unauthorized(new
                {
                    message = "Invalid authentication token."
                });
            }

            var order = await _context.Orders
                .Include(o => o.Client)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound(new
                {
                    message = "Order not found."
                });
            }

            if (order.Status != OrderStatus.New)
            {
                return Conflict(new
                {
                    message =
                        "Courier can be assigned only to a new order."
                });
            }

            var courier = await _context.Couriers
                .FirstOrDefaultAsync(
                    c => c.Id == request.CourierId);

            if (courier == null)
            {
                return NotFound(new
                {
                    message = "Courier not found."
                });
            }

            // Кур'єр повинен бути доступним.
            // Busy та Offline кур'єрам нове замовлення
            // призначати не можна.
            if (courier.Status != CourierStatus.Available)
            {
                return Conflict(new
                {
                    message =
                        "The selected courier is not available."
                });
            }

            // Додаткова перевірка БД.
            // Навіть якщо Status помилково залишився Available,
            // кур'єр не може мати більше одного активного замовлення.
            var hasActiveOrder = await _context.Orders
                .AnyAsync(o =>
                    o.CourierId == courier.Id &&
                    o.Status != OrderStatus.Delivered &&
                    o.Status != OrderStatus.Cancelled);

            if (hasActiveOrder)
            {
                return Conflict(new
                {
                    message =
                        "The selected courier already has an active order."
                });
            }

            order.CourierId = courier.Id;
            order.Courier = courier;

            order.Status = OrderStatus.Assigned;
            order.UpdatedAt = DateTime.UtcNow;

            // Після призначення кур'єр стає зайнятим.
            courier.Status = CourierStatus.Busy;

            var history = new OrderStatusHistory
            {
                OrderId = order.Id,
                Status = OrderStatus.Assigned,

                // Призначення виконує адміністратор.
                ChangedByUserId = adminUserId,

                ChangedAt = DateTime.UtcNow
            };

            _context.OrderStatusHistories.Add(history);

            await _context.SaveChangesAsync();

            return Ok(ToOrderResponse(order));
        }


        // ============================================================
        // PATCH: api/orders/{id}/status
        // Зміна статусу призначеним кур'єром
        // ============================================================

        [Authorize(Roles = "Courier")]
        [HttpPatch("{id:int}/status")]
        public async Task<ActionResult<OrderResponse>>
            UpdateOrderStatus(
                int id,
                UpdateOrderStatusRequest request)
        {
            if (!TryGetCurrentUserId(
                    out int courierUserId))
            {
                return Unauthorized(new
                {
                    message = "Invalid authentication token."
                });
            }

            var order = await _context.Orders
                .Include(o => o.Client)
                .Include(o => o.Courier)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound(new
                {
                    message = "Order not found."
                });
            }

            if (order.CourierId == null)
            {
                return Conflict(new
                {
                    message =
                        "No courier is assigned to this order."
                });
            }

            var courier = await _context.Couriers
                .FirstOrDefaultAsync(
                    c => c.Id == order.CourierId.Value);

            if (courier == null)
            {
                return NotFound(new
                {
                    message = "Courier not found."
                });
            }

            if (courier.UserId != courierUserId)
            {
                return StatusCode(403, new
                {
                    message =
                        "This courier is not assigned to this order."
                });
            }

            /*
             * Дозволені переходи:
             *
             * Assigned  -> PickedUp
             * PickedUp  -> InTransit
             * InTransit -> Delivered
             */

            bool validTransition =
                (order.Status == OrderStatus.Assigned &&
                 request.Status == OrderStatus.PickedUp)

                ||

                (order.Status == OrderStatus.PickedUp &&
                 request.Status == OrderStatus.InTransit)

                ||

                (order.Status == OrderStatus.InTransit &&
                 request.Status == OrderStatus.Delivered);

            if (!validTransition)
            {
                return Conflict(new
                {
                    message =
                        $"Invalid status transition from " +
                        $"{order.Status} to {request.Status}."
                });
            }

            order.Status = request.Status;
            order.UpdatedAt = DateTime.UtcNow;

            // Після завершення доставки кур'єр
            // знову стає доступним.
            if (request.Status == OrderStatus.Delivered)
            {
                courier.Status = CourierStatus.Available;
            }

            var history = new OrderStatusHistory
            {
                OrderId = order.Id,
                Status = request.Status,
                ChangedByUserId = courierUserId,
                ChangedAt = DateTime.UtcNow
            };

            _context.OrderStatusHistories.Add(history);

            await _context.SaveChangesAsync();

            return Ok(ToOrderResponse(order));
        }


        // ============================================================
        // PATCH: api/orders/{id}/cancel
        // Скасування замовлення клієнтом
        // ============================================================

        [Authorize(Roles = "Client")]
        [HttpPatch("{id:int}/cancel")]
        public async Task<ActionResult<OrderResponse>>
            CancelOrder(int id)
        {
            if (!TryGetCurrentUserId(out int clientId))
            {
                return Unauthorized(new
                {
                    message = "Invalid authentication token."
                });
            }

            var order = await _context.Orders
                .Include(o => o.Client)
                .Include(o => o.Courier)
                .Include(o => o.StatusHistory)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound(new
                {
                    message = "Order not found."
                });
            }

            // Клієнт може скасувати тільки власне замовлення.
            if (order.ClientId != clientId)
            {
                return StatusCode(403, new
                {
                    message =
                        "You cannot cancel another client's order."
                });
            }

            /*
             * Скасування дозволене тільки до фактичного
             * початку виконання доставки.
             *
             * New       -> Cancelled
             * Assigned  -> Cancelled
             */

            if (order.Status != OrderStatus.New &&
                order.Status != OrderStatus.Assigned)
            {
                return Conflict(new
                {
                    message =
                        "This order can no longer be cancelled."
                });
            }

            // Запам'ятовуємо, чи був кур'єр призначений
            // до зміни статусу замовлення.
            var assignedCourier = order.Courier;

            order.Status = OrderStatus.Cancelled;
            order.UpdatedAt = DateTime.UtcNow;

            // Якщо замовлення вже було призначене кур'єру,
            // після скасування він знову доступний.
            if (assignedCourier != null)
            {
                assignedCourier.Status = CourierStatus.Available;
            }

            var history = new OrderStatusHistory
            {
                OrderId = order.Id,
                Status = OrderStatus.Cancelled,
                ChangedByUserId = clientId,
                ChangedAt = DateTime.UtcNow
            };

            _context.OrderStatusHistories.Add(history);

            await _context.SaveChangesAsync();

            return Ok(ToOrderResponse(order));
        }


        // ============================================================
        // GET: api/orders/courier/my
        // Замовлення поточного кур'єра
        // ============================================================

        [Authorize(Roles = "Courier")]
        [HttpGet("courier/my")]
        public async Task<ActionResult<IEnumerable<OrderResponse>>>
            GetMyCourierOrders()
        {
            if (!TryGetCurrentUserId(
                    out int courierUserId))
            {
                return Unauthorized(new
                {
                    message = "Invalid authentication token."
                });
            }

            var courier = await _context.Couriers
                .FirstOrDefaultAsync(
                    c => c.UserId == courierUserId);

            if (courier == null)
            {
                return NotFound(new
                {
                    message = "Courier not found."
                });
            }

            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Client)
                .Include(o => o.Courier)
                .Where(o => o.CourierId == courier.Id)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            var result = orders
                .Select(ToOrderResponse)
                .ToList();

            return Ok(result);
        }
    }
}