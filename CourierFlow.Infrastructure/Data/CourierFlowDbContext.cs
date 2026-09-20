using CourierFlow.Core.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CourierFlow.Infrastructure.Data
{
    public class CourierFlowDbContext : DbContext
    {
        public CourierFlowDbContext(DbContextOptions<CourierFlowDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Courier> Couriers { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderStatusHistory> OrderStatusHistories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // User
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.Id);

                entity.Property(u => u.Name)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(u => u.Email)
                    .IsRequired()
                    .HasMaxLength(150);

                entity.HasIndex(u => u.Email)
                    .IsUnique();

                entity.Property(u => u.Phone)
                    .IsRequired()
                    .HasMaxLength(20);

                entity.Property(u => u.PasswordHash)
                    .IsRequired();

                entity.Property(u => u.Role)
                    .IsRequired();
            });

            // Courier
            modelBuilder.Entity<Courier>(entity =>
            {
                entity.HasKey(c => c.Id);

                entity.Property(c => c.Status)
                    .IsRequired();

                entity.HasOne(c => c.User)
                    .WithOne(u => u.Courier)
                    .HasForeignKey<Courier>(c => c.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Order
            modelBuilder.Entity<Order>(entity =>
            {
                entity.HasKey(o => o.Id);

                entity.Property(o => o.SenderAddress)
                    .IsRequired()
                    .HasMaxLength(250);

                entity.Property(o => o.DeliveryAddress)
                    .IsRequired()
                    .HasMaxLength(250);

                entity.Property(o => o.RecipientName)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(o => o.RecipientPhone)
                    .IsRequired()
                    .HasMaxLength(20);

                entity.Property(o => o.PackageDescription)
                    .HasMaxLength(500);

                entity.Property(o => o.Status)
                    .IsRequired();

                entity.Property(o => o.CreatedAt)
                    .IsRequired();

                entity.Property(o => o.UpdatedAt)
                    .IsRequired();

                entity.HasOne(o => o.Client)
                    .WithMany(u => u.Orders)
                    .HasForeignKey(o => o.ClientId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(o => o.Courier)
                    .WithMany(c => c.Orders)
                    .HasForeignKey(o => o.CourierId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            // Order status history
            modelBuilder.Entity<OrderStatusHistory>(entity =>
            {
                entity.HasKey(h => h.Id);

                entity.Property(h => h.Status)
                    .IsRequired();

                entity.Property(h => h.ChangedAt)
                    .IsRequired();

                entity.HasOne(h => h.Order)
                    .WithMany(o => o.StatusHistory)
                    .HasForeignKey(h => h.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(h => h.ChangedByUser)
                    .WithMany()
                    .HasForeignKey(h => h.ChangedByUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}
