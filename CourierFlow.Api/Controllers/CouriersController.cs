using CourierFlow.Core.Enums;
using CourierFlow.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourierFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class CouriersController : ControllerBase
    {
        private readonly CourierFlowDbContext _context;

        public CouriersController(CourierFlowDbContext context)
        {
            _context = context;
        }

        // GET: /api/Couriers
        [HttpGet]
        public async Task<IActionResult> GetCouriers()
        {
            var couriers = await _context.Couriers
                .AsNoTracking()
                .Include(c => c.User)
                .OrderBy(c => c.User.Name)
                .Select(c => new
                {
                    id = c.Id,
                    userId = c.UserId,
                    name = c.User.Name,
                    email = c.User.Email,
                    phone = c.User.Phone,
                    status = c.Status
                })
                .ToListAsync();

            return Ok(couriers);
        }
    }
}
