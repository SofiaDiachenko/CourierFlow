"use strict";

const loginForm = document.getElementById("loginForm");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");

const alertBox = document.getElementById("alert");

const loginButton = document.getElementById("loginButton");
const loginButtonText = document.getElementById("loginButtonText");

const passwordToggle = document.getElementById("passwordToggle");


// =========================================================
// Role configuration
// =========================================================

const USER_ROLES = {
    CLIENT: 0,
    COURIER: 1,
    ADMIN: 2
};


// =========================================================
// Show / hide password
// =========================================================

passwordToggle.addEventListener("click", () => {

    const passwordIsHidden =
        passwordInput.type === "password";

    passwordInput.type =
        passwordIsHidden ? "text" : "password";

    passwordToggle.setAttribute(
        "aria-label",
        passwordIsHidden
            ? "Приховати пароль"
            : "Показати пароль"
    );

    passwordToggle.setAttribute(
        "title",
        passwordIsHidden
            ? "Приховати пароль"
            : "Показати пароль"
    );
});


// =========================================================
// Remove errors while typing
// =========================================================

emailInput.addEventListener("input", () => {
    clearFieldError(emailInput, emailError);
    hideAlert();
});

passwordInput.addEventListener("input", () => {
    clearFieldError(passwordInput, passwordError);
    hideAlert();
});


// =========================================================
// Login
// =========================================================

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    clearErrors();
    hideAlert();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!validateForm(email, password)) {
        return;
    }

    setLoading(true);

    try {

        const response = await fetch("/api/Auth/login", {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            body: JSON.stringify({
                email: email,
                password: password
            })
        });


        let data = null;

        try {
            data = await response.json();
        }
        catch {
            data = null;
        }


        // Invalid credentials
        if (response.status === 401) {

            showAlert(
                "Неправильна електронна пошта або пароль."
            );

            return;
        }


        // Other API error
        if (!response.ok) {

            const message =
                data?.message ||
                "Не вдалося виконати вхід. Спробуйте ще раз.";

            showAlert(message);

            return;
        }


        // Validate server response
        if (!data?.token || !data?.user) {

            showAlert(
                "Сервер повернув некоректну відповідь."
            );

            return;
        }


        // Save authentication data
        saveSession(data);


        // Redirect according to user role
        redirectByRole(data.user.role);

    }
    catch (error) {

        console.error("Login error:", error);

        showAlert(
            "Не вдалося з'єднатися із сервером. " +
            "Перевірте підключення та спробуйте ще раз."
        );
    }
    finally {

        setLoading(false);
    }
});


// =========================================================
// Validation
// =========================================================

function validateForm(email, password) {

    let isValid = true;


    if (!email) {

        setFieldError(
            emailInput,
            emailError,
            "Введіть електронну пошту."
        );

        isValid = false;
    }
    else if (!isValidEmail(email)) {

        setFieldError(
            emailInput,
            emailError,
            "Введіть коректну електронну адресу."
        );

        isValid = false;
    }


    if (!password) {

        setFieldError(
            passwordInput,
            passwordError,
            "Введіть пароль."
        );

        isValid = false;
    }


    return isValid;
}


function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// =========================================================
// Session
// =========================================================

function saveSession(data) {

    sessionStorage.setItem(
        "courierFlowToken",
        data.token
    );

    sessionStorage.setItem(
        "courierFlowUser",
        JSON.stringify(data.user)
    );
}


// =========================================================
// Role redirect
// =========================================================

function redirectByRole(role) {

    const numericRole = Number(role);

    switch (numericRole) {

        case USER_ROLES.CLIENT:
            window.location.href = "/client.html";
            break;

        case USER_ROLES.COURIER:
            window.location.href = "/courier.html";
            break;

        case USER_ROLES.ADMIN:
            window.location.href = "/admin.html";
            break;

        default:

            clearSession();

            showAlert(
                "Для цього облікового запису не визначено роль."
            );
    }
}


// =========================================================
// UI helpers
// =========================================================

function setLoading(isLoading) {

    loginButton.disabled = isLoading;

    loginButton.classList.toggle(
        "loading",
        isLoading
    );

    loginButtonText.textContent =
        isLoading
            ? "Вхід..."
            : "Увійти";
}


function showAlert(message) {

    alertBox.textContent = message;

    alertBox.classList.remove("success");
    alertBox.classList.add("show");
}


function hideAlert() {

    alertBox.textContent = "";

    alertBox.classList.remove(
        "show",
        "success"
    );
}


function setFieldError(
    input,
    errorElement,
    message
) {

    input.classList.add("input-error");

    input.setAttribute(
        "aria-invalid",
        "true"
    );

    errorElement.textContent = message;
}


function clearFieldError(
    input,
    errorElement
) {

    input.classList.remove("input-error");

    input.removeAttribute("aria-invalid");

    errorElement.textContent = "";
}


function clearErrors() {

    clearFieldError(
        emailInput,
        emailError
    );

    clearFieldError(
        passwordInput,
        passwordError
    );
}


function clearSession() {

    sessionStorage.removeItem(
        "courierFlowToken"
    );

    sessionStorage.removeItem(
        "courierFlowUser"
    );
}