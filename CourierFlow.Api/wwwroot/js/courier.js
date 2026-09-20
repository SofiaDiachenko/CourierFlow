"use strict";

/* =========================================================
   CourierFlow — Courier Dashboard
   ========================================================= */

const USER_ROLES = {
    CLIENT: 0,
    COURIER: 1,
    ADMIN: 2
};

const ORDER_STATUS = {
    NEW: 0,
    ASSIGNED: 1,
    PICKED_UP: 2,
    IN_TRANSIT: 3,
    DELIVERED: 4,
    CANCELLED: 5
};

const token = sessionStorage.getItem("courierFlowToken");
const storedUser = sessionStorage.getItem("courierFlowUser");

let currentUser = null;
let orders = [];
let currentFilter = "active";
let selectedOrderId = null;


// =========================================================
// DOM
// =========================================================

const sidebarUserName = document.getElementById("sidebarUserName");
const headerUserName = document.getElementById("headerUserName");

const sidebarAvatar = document.getElementById("sidebarAvatar");
const headerAvatar = document.getElementById("headerAvatar");

const welcomeTitle = document.getElementById("welcomeTitle");
const currentDate = document.getElementById("currentDate");

const assignedCount = document.getElementById("assignedCount");
const inProgressCount = document.getElementById("inProgressCount");
const deliveredCount = document.getElementById("deliveredCount");
const totalCount = document.getElementById("totalCount");

const ordersList = document.getElementById("ordersList");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const emptyStateText = document.getElementById("emptyStateText");

const dashboardAlert = document.getElementById("dashboardAlert");

const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");

const filterButtons = document.querySelectorAll(".filter-button");

const orderModal = document.getElementById("orderModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalFooter = document.getElementById("modalFooter");
const modalClose = document.getElementById("modalClose");

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mobileMenuButton = document.getElementById("mobileMenuButton");


// =========================================================
// Start
// =========================================================

initializeDashboard();

async function initializeDashboard() {

    if (!restoreAndValidateSession()) {
        return;
    }

    renderUser();
    renderCurrentDate();
    bindEvents();

    await loadOrders();
}


// =========================================================
// Session protection
// =========================================================

function restoreAndValidateSession() {

    if (!token || !storedUser) {
        redirectToLogin();
        return false;
    }

    try {
        currentUser = JSON.parse(storedUser);
    }
    catch {
        clearSession();
        redirectToLogin();
        return false;
    }

    if (!currentUser || Number(currentUser.role) !== USER_ROLES.COURIER) {
        clearSession();
        redirectToLogin();
        return false;
    }

    return true;
}

function clearSession() {
    sessionStorage.removeItem("courierFlowToken");
    sessionStorage.removeItem("courierFlowUser");
}

function redirectToLogin() {
    window.location.replace("/");
}


// =========================================================
// User
// =========================================================

function renderUser() {

    const name = currentUser.name?.trim() || "Кур'єр";
    const initial = name.charAt(0).toUpperCase();

    sidebarUserName.textContent = name;
    headerUserName.textContent = name;

    sidebarAvatar.textContent = initial;
    headerAvatar.textContent = initial;

    const firstName = name.split(/\s+/)[0];

    welcomeTitle.textContent = `Вітаємо, ${firstName}!`;
}


// =========================================================
// Date
// =========================================================

function renderCurrentDate() {

    const formatter = new Intl.DateTimeFormat("uk-UA", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    let formattedDate = formatter.format(new Date());

    formattedDate =
        formattedDate.charAt(0).toUpperCase() +
        formattedDate.slice(1);

    currentDate.textContent = formattedDate;
}


// =========================================================
// Events
// =========================================================

function bindEvents() {

    refreshButton.addEventListener("click", loadOrders);

    logoutButton.addEventListener("click", logout);

    filterButtons.forEach(button => {

        button.addEventListener("click", () => {

            filterButtons.forEach(item =>
                item.classList.remove("active")
            );

            button.classList.add("active");

            currentFilter = button.dataset.filter;

            renderOrders();
        });
    });

    modalClose.addEventListener("click", closeModal);

    orderModal.addEventListener("click", event => {

        if (event.target === orderModal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closeModal();
            closeMobileMenu();
        }
    });

    mobileMenuButton.addEventListener("click", openMobileMenu);

    sidebarOverlay.addEventListener("click", closeMobileMenu);
}


// =========================================================
// API
// =========================================================

async function loadOrders() {

    showLoading();
    hideAlert();

    try {

        const response = await fetch("/api/Orders/courier/my", {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {

            clearSession();
            redirectToLogin();
            return;
        }

        if (response.status === 403) {

            clearSession();
            redirectToLogin();
            return;
        }

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data = await response.json();

        orders = Array.isArray(data)
            ? data
            : [];

        renderStatistics();
        renderOrders();

    }
    catch (error) {

        console.error("Orders loading error:", error);

        orders = [];

        renderStatistics();

        hideLoading();

        showAlert(
            "Не вдалося завантажити доставки. " +
            "Спробуйте оновити сторінку."
        );
    }
}


// =========================================================
// Statistics
// =========================================================

function renderStatistics() {

    const assigned = orders.filter(
        order =>
            Number(order.status) === ORDER_STATUS.ASSIGNED
    ).length;

    const inProgress = orders.filter(order => {

        const status = Number(order.status);

        return (
            status === ORDER_STATUS.PICKED_UP ||
            status === ORDER_STATUS.IN_TRANSIT
        );
    }).length;

    const delivered = orders.filter(
        order =>
            Number(order.status) === ORDER_STATUS.DELIVERED
    ).length;

    assignedCount.textContent = assigned;
    inProgressCount.textContent = inProgress;
    deliveredCount.textContent = delivered;
    totalCount.textContent = orders.length;
}


// =========================================================
// Render orders
// =========================================================

function renderOrders() {

    hideLoading();

    const filteredOrders = getFilteredOrders();

    ordersList.innerHTML = "";

    if (filteredOrders.length === 0) {

        showEmptyState();

        return;
    }

    hideEmptyState();

    filteredOrders.forEach(order => {

        const card = document.createElement("article");

        card.className = "order-card";

        card.innerHTML = `
            <div class="order-number">
                <span>ЗАМОВЛЕННЯ</span>
                <strong>#${escapeHtml(order.id)}</strong>
            </div>

            <div class="address-block">
                <span class="address-label">
                    Звідки
                </span>

                <span class="address-value"
                      title="${escapeHtml(order.senderAddress)}">
                    ${escapeHtml(order.senderAddress)}
                </span>
            </div>

            <div class="address-block">
                <span class="address-label">
                    Куди
                </span>

                <span class="address-value"
                      title="${escapeHtml(order.deliveryAddress)}">
                    ${escapeHtml(order.deliveryAddress)}
                </span>
            </div>

            <div>
                ${createStatusBadge(order.status)}
            </div>

            <button type="button"
                    class="order-action"
                    data-order-id="${escapeHtml(order.id)}">
                Деталі
            </button>
        `;

        const detailsButton =
            card.querySelector(".order-action");

        detailsButton.addEventListener("click", () => {
            openOrderModal(order.id);
        });

        ordersList.appendChild(card);
    });
}


// =========================================================
// Filters
// =========================================================

function getFilteredOrders() {

    switch (currentFilter) {

        case "active":

            return orders.filter(order => {

                const status = Number(order.status);

                return (
                    status === ORDER_STATUS.ASSIGNED ||
                    status === ORDER_STATUS.PICKED_UP ||
                    status === ORDER_STATUS.IN_TRANSIT
                );
            });

        case "delivered":

            return orders.filter(
                order =>
                    Number(order.status) ===
                    ORDER_STATUS.DELIVERED
            );

        case "all":
        default:

            return [...orders];
    }
}


// =========================================================
// Empty state
// =========================================================

function showEmptyState() {

    let message =
        "На цей момент вам не призначено активних замовлень.";

    if (currentFilter === "all") {

        message =
            "Вам ще не призначено жодного замовлення.";
    }

    if (currentFilter === "delivered") {

        message =
            "У вас поки немає завершених доставок.";
    }

    emptyStateText.textContent = message;

    emptyState.style.display = "flex";
}

function hideEmptyState() {
    emptyState.style.display = "none";
}


// =========================================================
// Order modal
// =========================================================

function openOrderModal(orderId) {

    const order = orders.find(
        item => Number(item.id) === Number(orderId)
    );

    if (!order) {
        return;
    }

    selectedOrderId = order.id;

    modalTitle.textContent =
        `Замовлення #${order.id}`;

    modalBody.innerHTML = `
        <div class="detail-grid">

            <div class="detail-item full">
                <span>Статус</span>
                <div>
                    ${createStatusBadge(order.status)}
                </div>
            </div>

            <div class="detail-item full">
                <span>Адреса відправлення</span>
                <strong>
                    ${escapeHtml(order.senderAddress)}
                </strong>
            </div>

            <div class="detail-item full">
                <span>Адреса доставки</span>
                <strong>
                    ${escapeHtml(order.deliveryAddress)}
                </strong>
            </div>

            <div class="detail-item">
                <span>Одержувач</span>
                <strong>
                    ${escapeHtml(order.recipientName)}
                </strong>
            </div>

            <div class="detail-item">
                <span>Телефон</span>
                <strong>
                    ${escapeHtml(order.recipientPhone)}
                </strong>
            </div>

            <div class="detail-item full">
                <span>Опис відправлення</span>
                <strong>
                    ${escapeHtml(
        order.packageDescription ||
        "Не вказано"
    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Створено</span>
                <strong>
                    ${formatDateTime(order.createdAt)}
                </strong>
            </div>

            <div class="detail-item">
                <span>Оновлено</span>
                <strong>
                    ${formatDateTime(order.updatedAt)}
                </strong>
            </div>

        </div>
    `;

    renderModalActions(order);

    orderModal.classList.add("show");
    orderModal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";
}


// =========================================================
// Modal actions
// =========================================================

function renderModalActions(order) {

    modalFooter.innerHTML = "";

    const closeButton =
        document.createElement("button");

    closeButton.type = "button";
    closeButton.className = "modal-secondary";
    closeButton.textContent = "Закрити";

    closeButton.addEventListener(
        "click",
        closeModal
    );

    modalFooter.appendChild(closeButton);

    const nextStatus =
        getNextCourierStatus(order.status);

    if (nextStatus === null) {
        return;
    }

    const actionButton =
        document.createElement("button");

    actionButton.type = "button";
    actionButton.className = "modal-action";

    actionButton.textContent =
        getStatusActionText(nextStatus);

    actionButton.addEventListener(
        "click",
        async () => {

            actionButton.disabled = true;

            const oldText =
                actionButton.textContent;

            actionButton.textContent =
                "Оновлення...";

            const success =
                await updateOrderStatus(
                    order.id,
                    nextStatus
                );

            if (!success) {

                actionButton.disabled = false;
                actionButton.textContent = oldText;
            }
        }
    );

    modalFooter.appendChild(actionButton);
}


function getNextCourierStatus(status) {

    const numericStatus = Number(status);

    switch (numericStatus) {

        case ORDER_STATUS.ASSIGNED:
            return ORDER_STATUS.PICKED_UP;

        case ORDER_STATUS.PICKED_UP:
            return ORDER_STATUS.IN_TRANSIT;

        case ORDER_STATUS.IN_TRANSIT:
            return ORDER_STATUS.DELIVERED;

        default:
            return null;
    }
}


function getStatusActionText(status) {

    switch (Number(status)) {

        case ORDER_STATUS.PICKED_UP:
            return "Посилку отримано";

        case ORDER_STATUS.IN_TRANSIT:
            return "Розпочати доставку";

        case ORDER_STATUS.DELIVERED:
            return "Позначити доставленим";

        default:
            return "Оновити статус";
    }
}


// =========================================================
// Update status
// =========================================================

async function updateOrderStatus(
    orderId,
    newStatus
) {

    hideAlert();

    try {

        const response = await fetch(
            `/api/Orders/${orderId}/status`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                // Кур'єр визначається backend-ом із JWT.
                // Ідентифікатор користувача з браузера
                // більше не передаємо.
                body: JSON.stringify({
                    status: newStatus
                })
            }
        );

        if (response.status === 401) {

            clearSession();
            redirectToLogin();

            return false;
        }

        if (response.status === 403) {

            closeModal();

            showAlert(
                "У вас немає дозволу змінювати це замовлення."
            );

            return false;
        }

        let data = null;

        try {
            data = await response.json();
        }
        catch {
            data = null;
        }

        if (!response.ok) {

            const message =
                data?.message ||
                "Не вдалося змінити статус доставки.";

            closeModal();
            showAlert(message);

            return false;
        }

        closeModal();

        await loadOrders();

        showAlert(
            "Статус доставки успішно оновлено.",
            true
        );

        return true;

    }
    catch (error) {

        console.error(
            "Status update error:",
            error
        );

        closeModal();

        showAlert(
            "Не вдалося з'єднатися із сервером."
        );

        return false;
    }
}


// =========================================================
// Status
// =========================================================

function createStatusBadge(status) {

    const info =
        getStatusInfo(status);

    return `
        <span class="status-badge ${info.className}">
            ${info.label}
        </span>
    `;
}


function getStatusInfo(status) {

    switch (Number(status)) {

        case ORDER_STATUS.NEW:
            return {
                label: "Нове",
                className: "status-assigned"
            };

        case ORDER_STATUS.ASSIGNED:
            return {
                label: "Призначено",
                className: "status-assigned"
            };

        case ORDER_STATUS.PICKED_UP:
            return {
                label: "Отримано",
                className: "status-picked"
            };

        case ORDER_STATUS.IN_TRANSIT:
            return {
                label: "У дорозі",
                className: "status-transit"
            };

        case ORDER_STATUS.DELIVERED:
            return {
                label: "Доставлено",
                className: "status-delivered"
            };

        case ORDER_STATUS.CANCELLED:
            return {
                label: "Скасовано",
                className: "status-cancelled"
            };

        default:
            return {
                label: "Невідомо",
                className: "status-cancelled"
            };
    }
}


// =========================================================
// Loading
// =========================================================

function showLoading() {

    loadingState.style.display = "flex";

    ordersList.style.display = "none";

    hideEmptyState();
}


function hideLoading() {

    loadingState.style.display = "none";

    ordersList.style.display = "grid";
}


// =========================================================
// Alert
// =========================================================

function showAlert(message, success = false) {

    dashboardAlert.textContent = message;

    dashboardAlert.classList.toggle(
        "success",
        success
    );

    dashboardAlert.classList.add("show");
}


function hideAlert() {

    dashboardAlert.textContent = "";

    dashboardAlert.classList.remove(
        "show",
        "success"
    );
}


// =========================================================
// Modal
// =========================================================

function closeModal() {

    orderModal.classList.remove("show");

    orderModal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

    selectedOrderId = null;
}


// =========================================================
// Mobile menu
// =========================================================

function openMobileMenu() {

    sidebar.classList.add("open");

    sidebarOverlay.classList.add("show");
}


function closeMobileMenu() {

    sidebar.classList.remove("open");

    sidebarOverlay.classList.remove("show");
}


// =========================================================
// Logout
// =========================================================

function logout() {

    clearSession();

    window.location.replace("/");
}


// =========================================================
// Formatting
// =========================================================

function formatDateTime(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "uk-UA",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(date);
}


// =========================================================
// HTML safety
// =========================================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}