using System.ComponentModel.DataAnnotations;

namespace CourierFlow.Api.DTOs.Orders
{
    public class CreateOrderRequest
    {
        [Required(ErrorMessage = "Sender address is required.")]
        [StringLength(
            250,
            MinimumLength = 5,
            ErrorMessage = "Sender address must contain from 5 to 250 characters.")]
        public string SenderAddress { get; set; } = string.Empty;


        [Required(ErrorMessage = "Delivery address is required.")]
        [StringLength(
            250,
            MinimumLength = 5,
            ErrorMessage = "Delivery address must contain from 5 to 250 characters.")]
        public string DeliveryAddress { get; set; } = string.Empty;


        [Required(ErrorMessage = "Recipient name is required.")]
        [StringLength(
            100,
            MinimumLength = 2,
            ErrorMessage = "Recipient name must contain from 2 to 100 characters.")]
        public string RecipientName { get; set; } = string.Empty;


        [Required(ErrorMessage = "Recipient phone is required.")]
        [StringLength(
            20,
            MinimumLength = 7,
            ErrorMessage = "Recipient phone must contain from 7 to 20 characters.")]
        [RegularExpression(
            @"^\+?[0-9\s\-\(\)]+$",
            ErrorMessage = "Recipient phone has an invalid format.")]
        public string RecipientPhone { get; set; } = string.Empty;


        [Required(ErrorMessage = "Package description is required.")]
        [StringLength(
            500,
            MinimumLength = 2,
            ErrorMessage = "Package description must contain from 2 to 500 characters.")]
        public string PackageDescription { get; set; } = string.Empty;
    }
}
