"use strict";

/* =========================================================
   CourierFlow — Registration
   ========================================================= */

const REGISTER_URL = "/api/Auth/register";

const form = document.getElementById("registerForm");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const passwordInput = document.getElementById("password");
const confirmPasswordInput =
    document.getElementById("confirmPassword");

const registerButton =
    document.getElementById("registerButton");

const registerButtonText =
    document.getElementById("registerButtonText");

const registerAlert =
    document.getElementById("registerAlert");

const passwordToggle =
    document.getElementById("passwordToggle");

const confirmPasswordToggle =
    document.getElementById("confirmPasswordToggle");


/* =========================================================
   Alerts
   ========================================================= */

function showAlert(message, type = "error") {
    registerAlert.textContent = message;

    registerAlert.className =
        `form-alert show ${type}`;
}

function hideAlert() {
    registerAlert.textContent = "";
    registerAlert.className = "form-alert";
}


/* =========================================================
   Validation helpers
   ========================================================= */

function setFieldError(input, message) {
    const group = input.closest(".form-group");

    if (!group) {
        return;
    }

    group.classList.add("invalid");

    const error =
        group.querySelector(".field-error");

    if (error) {
        error.textContent = message;
    }
}

function clearFieldError(input) {
    const group = input.closest(".form-group");

    if (!group) {
        return;
    }

    group.classList.remove("invalid");

    const error =
        group.querySelector(".field-error");

    if (error) {
        error.textContent = "";
    }
}

function clearValidation() {
    [
        nameInput,
        emailInput,
        phoneInput,
        passwordInput,
        confirmPasswordInput
    ].forEach(clearFieldError);
}


/* =========================================================
   Form validation
   ========================================================= */

function validateForm() {
    clearValidation();
    hideAlert();

    let isValid = true;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword =
        confirmPasswordInput.value;

    /* Name */

    if (name.length < 2) {
        setFieldError(
            nameInput,
            "Введіть ім'я та прізвище."
        );

        isValid = false;
    }

    /* Email */

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        setFieldError(
            emailInput,
            "Введіть коректну email-адресу."
        );

        isValid = false;
    }

    /* Phone */

    const normalizedPhone =
        phone.replace(/[\s()-]/g, "");

    const phoneRegex =
        /^\+?[0-9]{10,15}$/;

    if (!phoneRegex.test(normalizedPhone)) {
        setFieldError(
            phoneInput,
            "Введіть коректний номер телефону."
        );

        isValid = false;
    }

    /* Password */

    if (password.length < 8) {
        setFieldError(
            passwordInput,
            "Пароль повинен містити щонайменше 8 символів."
        );

        isValid = false;
    }

    /* Confirm password */

    if (!confirmPassword) {
        setFieldError(
            confirmPasswordInput,
            "Повторіть пароль."
        );

        isValid = false;
    } else if (password !== confirmPassword) {
        setFieldError(
            confirmPasswordInput,
            "Паролі не збігаються."
        );

        isValid = false;
    }

    return isValid;
}


/* =========================================================
   Loading state
   ========================================================= */

function setLoading(isLoading) {
    registerButton.disabled = isLoading;

    registerButtonText.textContent =
        isLoading
            ? "Створення облікового запису..."
            : "Створити обліковий запис";
}


/* =========================================================
   Register
   ========================================================= */

async function register(event) {
    event.preventDefault();

    if (!validateForm()) {
        showAlert(
            "Перевірте правильність заповнення форми."
        );

        return;
    }

    const normalizedPhone =
        phoneInput.value
            .trim()
            .replace(/[\s()-]/g, "");

    /*
     * Публічна реєстрація призначена
     * тільки для клієнтів.
     *
     * Client = 0
     */
    const request = {
        name: nameInput.value.trim(),
        email: emailInput.value
            .trim()
            .toLowerCase(),
        phone: normalizedPhone,
        password: passwordInput.value,
        role: 0
    };

    hideAlert();
    setLoading(true);

    try {
        const response = await fetch(
            REGISTER_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify(request)
            }
        );

        let data = null;

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            contentType.includes(
                "application/json"
            )
        ) {
            try {
                data = await response.json();
            } catch {
                data = null;
            }
        }

        if (!response.ok) {
            const message =
                data?.message ||
                data?.title ||
                data?.error ||
                getDefaultErrorMessage(
                    response.status
                );

            throw new Error(message);
        }

        form.reset();

        showAlert(
            "Обліковий запис успішно створено. Зараз ви перейдете до входу.",
            "success"
        );

        /*
         * Даємо користувачу побачити
         * повідомлення про успіх.
         */
        setTimeout(() => {
            window.location.href = "/";
        }, 1400);

    } catch (error) {
        showAlert(
            error.message ||
            "Не вдалося створити обліковий запис."
        );

        setLoading(false);
    }
}


/* =========================================================
   Default HTTP errors
   ========================================================= */

function getDefaultErrorMessage(status) {
    switch (status) {
        case 400:
            return "Перевірте введені дані.";

        case 409:
            return "Користувач із таким email уже існує.";

        case 422:
            return "Введені дані не пройшли перевірку.";

        case 500:
            return "Виникла помилка сервера. Спробуйте ще раз.";

        default:
            return `Не вдалося зареєструватися. Код помилки: ${status}.`;
    }
}


/* =========================================================
   Password visibility
   ========================================================= */

function togglePasswordVisibility(input, button) {
    const isPassword =
        input.type === "password";

    input.type =
        isPassword
            ? "text"
            : "password";

    button.setAttribute(
        "aria-label",
        isPassword
            ? "Приховати пароль"
            : "Показати пароль"
    );
}


/* =========================================================
   Events
   ========================================================= */

form.addEventListener(
    "submit",
    register
);

passwordToggle.addEventListener(
    "click",
    () => {
        togglePasswordVisibility(
            passwordInput,
            passwordToggle
        );
    }
);

confirmPasswordToggle.addEventListener(
    "click",
    () => {
        togglePasswordVisibility(
            confirmPasswordInput,
            confirmPasswordToggle
        );
    }
);

[
    nameInput,
    emailInput,
    phoneInput,
    passwordInput,
    confirmPasswordInput
].forEach(input => {
    input.addEventListener(
        "input",
        () => {
            clearFieldError(input);
            hideAlert();
        }
    );
});
