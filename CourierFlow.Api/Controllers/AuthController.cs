using CourierFlow.Api.DTOs.Auth;
using CourierFlow.Core.Entities;
using CourierFlow.Core.Enums;
using CourierFlow.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace CourierFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly CourierFlowDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(
            CourierFlowDbContext context,
            IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        // =========================
        // REGISTRATION
        // =========================

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterRequest request)
        {
            // Нормалізуємо email.
            var email = request.Email.Trim().ToLowerInvariant();

            // Перевіряємо, чи email уже використовується.
            var emailExists = await _context.Users
                .AnyAsync(u => u.Email.ToLower() == email);

            if (emailExists)
            {
                return Conflict(new
                {
                    message = "User with this email already exists."
                });
            }

            // Нормалізуємо номер телефону.
            var phone = request.Phone.Trim();

            // Перевіряємо, чи номер телефону вже використовується.
            var phoneExists = await _context.Users
                .AnyAsync(u => u.Phone == phone);

            if (phoneExists)
            {
                return Conflict(new
                {
                    message = "User with this phone already exists."
                });
            }

            // Публічна реєстрація створює ТІЛЬКИ клієнта.
            // Навіть якщо в запиті буде передана інша роль,
            // сервер її не використовує.
            var user = new User
            {
                Name = request.Name.Trim(),
                Email = email,
                Phone = phone,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = UserRole.Client
            };

            _context.Users.Add(user);

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(Register),
                new { id = user.Id },
                new
                {
                    user.Id,
                    user.Name,
                    user.Email,
                    user.Phone,
                    user.Role
                });
        }

        // =========================
        // LOGIN
        // =========================

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null)
            {
                return Unauthorized(new
                {
                    message = "Invalid email or password."
                });
            }

            var passwordIsValid = BCrypt.Net.BCrypt.Verify(
                request.Password,
                user.PasswordHash);

            if (!passwordIsValid)
            {
                return Unauthorized(new
                {
                    message = "Invalid email or password."
                });
            }

            // Створюємо JWT token.
            var token = GenerateJwtToken(user);

            return Ok(new
            {
                message = "Login successful.",
                token,
                user = new
                {
                    user.Id,
                    user.Name,
                    user.Email,
                    user.Phone,
                    user.Role
                }
            });
        }

        // =========================
        // JWT TOKEN
        // =========================

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _configuration["Jwt:Key"]
                ?? throw new InvalidOperationException(
                    "JWT Key is not configured.");

            var jwtIssuer = _configuration["Jwt:Issuer"]
                ?? throw new InvalidOperationException(
                    "JWT Issuer is not configured.");

            var jwtAudience = _configuration["Jwt:Audience"]
                ?? throw new InvalidOperationException(
                    "JWT Audience is not configured.");

            var expiresMinutes =
                _configuration.GetValue<int>("Jwt:ExpiresMinutes");

            var claims = new List<Claim>
            {
                new Claim(
                    ClaimTypes.NameIdentifier,
                    user.Id.ToString()),

                new Claim(
                    ClaimTypes.Email,
                    user.Email),

                new Claim(
                    ClaimTypes.Role,
                    user.Role.ToString())
            };

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey));

            var credentials = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler()
                .WriteToken(token);
        }
    }
}