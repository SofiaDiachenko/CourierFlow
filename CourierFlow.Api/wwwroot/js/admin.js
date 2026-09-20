"use strict";

/* =========================================================
   CourierFlow — Admin Dashboard
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

const COURIER_STATUS = {
    AVAILABLE: 0,
    BUSY: 1,
    OFFLINE: 2
};


/* =========================================================
   State
   ========================================================= */

let orders = [];
let couriers = [];

let currentFilter = "all";
let currentSearch = "";

let selectedOrderId = null;
let selectedCourierId = null;

let toastTimer = null;


/* =========================================================
   DOM
   ========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mobileMenuButton = document.getElementById("mobileMenuButton");

const ordersNavigation = document.getElementById("ordersNavigation");
const couriersNavigation = document.getElementById("couriersNavigation");

const ordersSection = document.getElementById("ordersSection");
const couriersSection = document.getElementById("couriersSection");

const logoutButton = document.getElementById("logoutButton");
const refreshButton = document.getElementById("refreshButton");
const refreshCouriersButton = document.getElementById("refreshCouriersButton");
const retryOrdersButton = document.getElementById("retryOrdersButton");

const sidebarUserName = document.getElementById("sidebarUserName");
const sidebarAvatar = document.getElementById("sidebarAvatar");

const topbarUserName = document.getElementById("topbarUserName");
const topbarAvatar = document.getElementById("topbarAvatar");

const welcomeTitle = document.getElementById("welcomeTitle");
const currentDate = document.getElementById("currentDate");

const newOrdersCount = document.getElementById("newOrdersCount");
const activeOrdersCount = document.getElementById("activeOrdersCount");
const deliveredOrdersCount = document.getElementById("deliveredOrdersCount");
const totalOrdersCount = document.getElementById("totalOrdersCount");

const orderSearch = document.getElementById("orderSearch");
const orderFilters = document.getElementById("orderFilters");

const ordersLoadingState = document.getElementById("ordersLoadingState");
const ordersErrorState = document.getElementById("ordersErrorState");
const ordersErrorMessage = document.getElementById("ordersErrorMessage");
const ordersEmptyState = document.getElementById("ordersEmptyState");

const ordersTableWrapper = document.getElementById("ordersTableWrapper");
const ordersTableBody = document.getElementById("ordersTableBody");

const couriersLoadingState = document.getElementById("couriersLoadingState");
const couriersEmptyState = document.getElementById("couriersEmptyState");
const couriersGrid = document.getElementById("couriersGrid");

const orderDetailsModal = document.getElementById("orderDetailsModal");
const orderDetailsTitle = document.getElementById("orderDetailsTitle");
const orderDetailsBody = document.getElementById("orderDetailsBody");
const orderDetailsFooter = document.getElementById("orderDetailsFooter");

const assignCourierModal = document.getElementById("assignCourierModal");
const assignCourierTitle = document.getElementById("assignCourierTitle");
const assignDescription = document.getElementById("assignDescription");
const courierOptions = document.getElementById("courierOptions");

const assignCourierAlert = document.getElementById("assignCourierAlert");
const confirmAssignButton = document.getElementById("confirmAssignButton");

const toast = document.getElementById("toast");
const toastTitle = document.getElementById("toastTitle");
const toastMessage = document.getElementById("toastMessage");


/* =========================================================
   Session
   ========================================================= */

function getToken() {
    return sessionStorage.getItem("courierFlowToken");
}

function getStoredUser() {
    const value = sessionStorage.getItem("courierFlowUser");

    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}

function clearSession() {
    sessionStorage.removeItem("courierFlowToken");
    sessionStorage.removeItem("courierFlowUser");
}

function redirectToLogin() {
    window.location.replace("/");
}

function ensureAdmin() {

    const token = getToken();
    const user = getStoredUser();

    if (!token || !user) {
        clearSession();
        redirectToLogin();
        return false;
    }

    if (Number(user.role) !== USER_ROLES.ADMIN) {
        clearSession();
        redirectToLogin();
        return false;
    }

    return true;
}


/* =========================================================
   Initialization
   ========================================================= */

async function initialize() {

    if (!ensureAdmin()) {
        return;
    }

    renderCurrentUser();
    renderCurrentDate();

    await Promise.all([
        loadOrders(),
        loadCouriers()
    ]);
}


/* =========================================================
   Current user
   ========================================================= */

function renderCurrentUser() {

    const user = getStoredUser();

    if (!user) {
        return;
    }

    const name = user.name || "Адміністратор";
    const firstName = name.split(" ")[0] || "Адміністратор";

    sidebarUserName.textContent = name;
    topbarUserName.textContent = name;

    welcomeTitle.textContent =
        `Вітаємо, ${firstName}!`;

    const initial =
        name.trim().charAt(0).toUpperCase() || "A";

    sidebarAvatar.textContent = initial;
    topbarAvatar.textContent = initial;
}

function renderCurrentDate() {

    const formatter = new Intl.DateTimeFormat(
        "uk-UA",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

    let formatted = formatter.format(new Date());

    formatted =
        formatted.charAt(0).toUpperCase() +
        formatted.slice(1);

    currentDate.textContent = formatted;
}


/* =========================================================
   API helper
   ========================================================= */

async function apiRequest(url, options = {}) {

    const token = getToken();

    const headers = {
        "Accept": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401 ||
        response.status === 403) {

        clearSession();
        redirectToLogin();

        throw new Error(
            "Сесія завершена або недостатньо прав."
        );
    }

    let data = null;

    if (response.status !== 204) {
        try {
            data = await response.json();
        }
        catch {
            data = null;
        }
    }

    if (!response.ok) {

        const error = new Error(
            data?.message ||
            "Під час виконання запиту сталася помилка."
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
}


/* =========================================================
   Orders
   ========================================================= */

async function loadOrders() {

    showOrdersLoading();

    try {

        const data = await apiRequest("/api/Orders");

        orders = Array.isArray(data)
            ? data
            : [];

        renderStatistics();
        renderOrders();
    }
    catch (error) {

        console.error(
            "Orders loading error:",
            error
        );

        if (error.status !== 401 &&
            error.status !== 403) {

            showOrdersError(
                error.message ||
                "Не вдалося отримати замовлення."
            );
        }
    }
}


/* =========================================================
   Couriers
   ========================================================= */

async function loadCouriers() {

    showCouriersLoading();

    try {

        const data =
            await apiRequest("/api/Couriers");

        couriers = Array.isArray(data)
            ? data
            : [];

        renderCouriers();
    }
    catch (error) {

        console.error(
            "Couriers loading error:",
            error
        );

        couriers = [];

        couriersLoadingState.classList.add("hidden");
        couriersGrid.classList.add("hidden");
        couriersEmptyState.classList.remove("hidden");
    }
}


/* =========================================================
   Statistics
   ========================================================= */

function renderStatistics() {

    const newCount = orders.filter(
        order =>
            Number(order.status) ===
            ORDER_STATUS.NEW
    ).length;

    const activeCount = orders.filter(
        order => [
            ORDER_STATUS.ASSIGNED,
            ORDER_STATUS.PICKED_UP,
            ORDER_STATUS.IN_TRANSIT
        ].includes(Number(order.status))
    ).length;

    const deliveredCount = orders.filter(
        order =>
            Number(order.status) ===
            ORDER_STATUS.DELIVERED
    ).length;

    newOrdersCount.textContent = newCount;
    activeOrdersCount.textContent = activeCount;
    deliveredOrdersCount.textContent = deliveredCount;
    totalOrdersCount.textContent = orders.length;
}


/* =========================================================
   Filter orders
   ========================================================= */

function getFilteredOrders() {

    let result = [...orders];

    switch (currentFilter) {

        case "new":
            result = result.filter(
                order =>
                    Number(order.status) ===
                    ORDER_STATUS.NEW
            );
            break;

        case "active":
            result = result.filter(
                order => [
                    ORDER_STATUS.ASSIGNED,
                    ORDER_STATUS.PICKED_UP,
                    ORDER_STATUS.IN_TRANSIT
                ].includes(Number(order.status))
            );
            break;

        case "delivered":
            result = result.filter(
                order =>
                    Number(order.status) ===
                    ORDER_STATUS.DELIVERED
            );
            break;

        case "cancelled":
            result = result.filter(
                order =>
                    Number(order.status) ===
                    ORDER_STATUS.CANCELLED
            );
            break;
    }

    if (currentSearch) {

        const search =
            currentSearch.toLowerCase();

        result = result.filter(order => {

            const searchableValues = [
                order.id,
                order.senderAddress,
                order.deliveryAddress,
                order.recipientName,
                order.recipientPhone,
                order.packageDescription,
                order.client?.name,
                order.client?.email,
                order.courier?.user?.name,
                order.courier?.name
            ];

            return searchableValues.some(
                value =>
                    String(value ?? "")
                        .toLowerCase()
                        .includes(search)
            );
        });
    }

    return result;
}


/* =========================================================
   Render orders
   ========================================================= */

function renderOrders() {

    ordersLoadingState.classList.add("hidden");
    ordersErrorState.classList.add("hidden");

    const filteredOrders =
        getFilteredOrders();

    if (filteredOrders.length === 0) {

        ordersTableWrapper.classList.add("hidden");
        ordersEmptyState.classList.remove("hidden");

        return;
    }

    ordersEmptyState.classList.add("hidden");
    ordersTableWrapper.classList.remove("hidden");

    ordersTableBody.innerHTML =
        filteredOrders
            .map(createOrderRow)
            .join("");
}


function createOrderRow(order) {

    const status =
        Number(order.status);

    const clientName =
        order.client?.name ||
        `Клієнт #${order.clientId ?? "—"}`;

    const clientEmail =
        order.client?.email || "";

    const courierName =
        getCourierNameFromOrder(order);

    const createdAt =
        formatDateTime(order.createdAt);

    const assignButton =
        status === ORDER_STATUS.NEW
            ? `
                <button
                    type="button"
                    class="table-button table-button-primary"
                    data-action="assign"
                    data-order-id="${Number(order.id)}">
                    Призначити
                </button>
              `
            : "";

    return `
        <tr>

            <td>
                <span class="order-number">
                    #${escapeHtml(order.id)}
                </span>

                <span class="table-secondary">
                    ${escapeHtml(order.recipientName || "Без одержувача")}
                </span>
            </td>

            <td>
                ${escapeHtml(clientName)}

                ${clientEmail
            ? `
                            <span class="table-secondary">
                                ${escapeHtml(clientEmail)}
                            </span>
                          `
            : ""
        }
            </td>

            <td class="route-cell">

                <div class="route-point">
                    <span class="route-dot"></span>
                    <span>
                        ${escapeHtml(order.senderAddress || "—")}
                    </span>
                </div>

                <div class="route-point">
                    <span class="route-dot"></span>
                    <span>
                        ${escapeHtml(order.deliveryAddress || "—")}
                    </span>
                </div>

            </td>

            <td>
                ${escapeHtml(courierName)}
            </td>

            <td>
                ${createStatusBadge(status)}
            </td>

            <td>
                ${escapeHtml(createdAt)}
            </td>

            <td>
                <div class="table-actions">

                    ${assignButton}

                    <button
                        type="button"
                        class="table-button"
                        data-action="details"
                        data-order-id="${Number(order.id)}">
                        Деталі
                    </button>

                </div>
            </td>

        </tr>
    `;
}


/* =========================================================
   Order status
   ========================================================= */

function createStatusBadge(status) {

    const config = getOrderStatusConfig(status);

    return `
        <span class="status-badge ${config.className}">
            ${escapeHtml(config.label)}
        </span>
    `;
}


function getOrderStatusConfig(status) {

    switch (Number(status)) {

        case ORDER_STATUS.NEW:
            return {
                label: "Нове",
                className: "status-new"
            };

        case ORDER_STATUS.ASSIGNED:
            return {
                label: "Призначено",
                className: "status-assigned"
            };

        case ORDER_STATUS.PICKED_UP:
            return {
                label: "Забрано",
                className: "status-pickedup"
            };

        case ORDER_STATUS.IN_TRANSIT:
            return {
                label: "У дорозі",
                className: "status-intransit"
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


/* =========================================================
   Order details
   ========================================================= */

function openOrderDetails(orderId) {

    const order = orders.find(
        item =>
            Number(item.id) ===
            Number(orderId)
    );

    if (!order) {
        return;
    }

    const status =
        Number(order.status);

    orderDetailsTitle.textContent =
        `Замовлення #${order.id}`;

    const clientName =
        order.client?.name ||
        `Клієнт #${order.clientId ?? "—"}`;

    const clientEmail =
        order.client?.email || "—";

    const courierName =
        getCourierNameFromOrder(order);

    orderDetailsBody.innerHTML = `

        <div class="details-status">

            <span class="details-label">
                Статус
            </span>

            ${createStatusBadge(status)}

        </div>


        <div class="details-grid">

            <div class="details-item-full">

                <span class="details-label">
                    Клієнт
                </span>

                <div class="details-value">
                    ${escapeHtml(clientName)}
                </div>

            </div>


            <div>

                <span class="details-label">
                    Email клієнта
                </span>

                <div class="details-value">
                    ${escapeHtml(clientEmail)}
                </div>

            </div>


            <div>

                <span class="details-label">
                    Кур'єр
                </span>

                <div class="details-value">
                    ${escapeHtml(courierName)}
                </div>

            </div>


            <div class="details-item-full">

                <span class="details-label">
                    Адреса відправлення
                </span>

                <div class="details-value">
                    ${escapeHtml(order.senderAddress || "—")}
                </div>

            </div>


            <div class="details-item-full">

                <span class="details-label">
                    Адреса доставки
                </span>

                <div class="details-value">
                    ${escapeHtml(order.deliveryAddress || "—")}
                </div>

            </div>


            <div>

                <span class="details-label">
                    Одержувач
                </span>

                <div class="details-value">
                    ${escapeHtml(order.recipientName || "—")}
                </div>

            </div>


            <div>

                <span class="details-label">
                    Телефон
                </span>

                <div class="details-value">
                    ${escapeHtml(order.recipientPhone || "—")}
                </div>

            </div>


            <div class="details-item-full">

                <span class="details-label">
                    Опис відправлення
                </span>

                <div class="details-value">
                    ${escapeHtml(order.packageDescription || "Не вказано")}
                </div>

            </div>


            <div>

                <span class="details-label">
                    Створено
                </span>

                <div class="details-value">
                    ${escapeHtml(formatDateTime(order.createdAt))}
                </div>

            </div>


            <div>

                <span class="details-label">
                    Оновлено
                </span>

                <div class="details-value">
                    ${escapeHtml(formatDateTime(order.updatedAt))}
                </div>

            </div>

        </div>
    `;

    let footer = "";

    if (status === ORDER_STATUS.NEW) {

        footer += `
            <button
                type="button"
                class="primary-button"
                data-modal-action="assign"
                data-order-id="${Number(order.id)}">
                Призначити кур'єра
            </button>
        `;
    }

    footer += `
        <button
            type="button"
            class="secondary-button"
            data-close-modal="orderDetailsModal">
            Закрити
        </button>
    `;

    orderDetailsFooter.innerHTML = footer;

    openModal(orderDetailsModal);
}


/* =========================================================
   Assign courier
   ========================================================= */

function openAssignCourier(orderId) {

    const order = orders.find(
        item =>
            Number(item.id) ===
            Number(orderId)
    );

    if (!order) {
        return;
    }

    selectedOrderId =
        Number(order.id);

    selectedCourierId = null;

    confirmAssignButton.disabled = true;

    hideAssignError();

    assignCourierTitle.textContent =
        `Замовлення #${order.id}`;

    assignDescription.textContent =
        "Оберіть доступного кур'єра для виконання цього замовлення.";

    renderCourierOptions();

    openModal(assignCourierModal);
}


function renderCourierOptions() {

    if (!couriers.length) {

        courierOptions.innerHTML = `
            <div class="state-container"
                 style="min-height: 150px; padding: 15px;">

                <strong>
                    Кур'єрів не знайдено
                </strong>

                <p>
                    У системі немає кур'єрів,
                    доступних для призначення.
                </p>

            </div>
        `;

        return;
    }

    const sortedCouriers =
        [...couriers].sort((a, b) => {

            const aAvailable =
                Number(a.status) ===
                    COURIER_STATUS.AVAILABLE
                    ? 0
                    : 1;

            const bAvailable =
                Number(b.status) ===
                    COURIER_STATUS.AVAILABLE
                    ? 0
                    : 1;

            return aAvailable - bAvailable;
        });

    courierOptions.innerHTML =
        sortedCouriers
            .map(courier => {

                const status =
                    getCourierStatusConfig(
                        courier.status
                    );

                const isAvailable =
                    Number(courier.status) ===
                    COURIER_STATUS.AVAILABLE;

                return `
                    <button
                        type="button"
                        class="courier-option"
                        data-courier-id="${Number(courier.id)}"
                        ${isAvailable ? "" : "disabled"}>

                        <span class="courier-option-avatar">
                            ${escapeHtml(getInitial(courier.name))}
                        </span>

                        <span class="courier-option-info">

                            <strong>
                                ${escapeHtml(courier.name || "Кур'єр")}
                            </strong>

                            <span>
                                ${escapeHtml(courier.phone || courier.email || "")}
                            </span>

                        </span>

                        <span class="courier-status-badge ${status.className}">
                            ${escapeHtml(status.label)}
                        </span>

                    </button>
                `;
            })
            .join("");
}


async function assignCourier() {

    if (!selectedOrderId ||
        !selectedCourierId) {

        showAssignError(
            "Оберіть кур'єра."
        );

        return;
    }

    confirmAssignButton.disabled = true;
    confirmAssignButton.textContent =
        "Призначення...";

    hideAssignError();

    try {

        await apiRequest(
            `/api/Orders/${selectedOrderId}/assign`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    courierId: selectedCourierId
                })
            }
        );

        closeModal(assignCourierModal);

        showToast(
            "Кур'єра призначено",
            `Замовлення #${selectedOrderId} передано кур'єру.`
        );

        selectedOrderId = null;
        selectedCourierId = null;

        await Promise.all([
            loadOrders(),
            loadCouriers()
        ]);
    }
    catch (error) {

        console.error(
            "Assign courier error:",
            error
        );

        showAssignError(
            error.message ||
            "Не вдалося призначити кур'єра."
        );
    }
    finally {

        confirmAssignButton.textContent =
            "Призначити кур'єра";

        if (selectedCourierId) {
            confirmAssignButton.disabled = false;
        }
    }
}


/* =========================================================
   Render couriers
   ========================================================= */

function renderCouriers() {

    couriersLoadingState.classList.add("hidden");

    if (!couriers.length) {

        couriersGrid.classList.add("hidden");
        couriersEmptyState.classList.remove("hidden");

        return;
    }

    couriersEmptyState.classList.add("hidden");
    couriersGrid.classList.remove("hidden");

    couriersGrid.innerHTML =
        couriers
            .map(createCourierCard)
            .join("");
}


function createCourierCard(courier) {

    const status =
        getCourierStatusConfig(
            courier.status
        );

    return `
        <article class="courier-card">

            <div class="courier-card-header">

                <div class="courier-avatar">
                    ${escapeHtml(getInitial(courier.name))}
                </div>

                <div>

                    <h4>
                        ${escapeHtml(courier.name || "Кур'єр")}
                    </h4>

                    <p>
                        ${escapeHtml(courier.email || "—")}
                    </p>

                </div>

            </div>


            <div class="courier-meta">

                <div class="courier-meta-row">

                    <span>
                        Телефон
                    </span>

                    <strong>
                        ${escapeHtml(courier.phone || "—")}
                    </strong>

                </div>


                <div class="courier-meta-row">

                    <span>
                        Статус
                    </span>

                    <span class="courier-status-badge ${status.className}">
                        ${escapeHtml(status.label)}
                    </span>

                </div>

            </div>

        </article>
    `;
}


function getCourierStatusConfig(status) {

    switch (Number(status)) {

        case COURIER_STATUS.AVAILABLE:
            return {
                label: "Доступний",
                className: "courier-available"
            };

        case COURIER_STATUS.BUSY:
            return {
                label: "Зайнятий",
                className: "courier-busy"
            };

        case COURIER_STATUS.OFFLINE:
            return {
                label: "Офлайн",
                className: "courier-offline"
            };

        default:
            return {
                label: "Невідомо",
                className: "courier-offline"
            };
    }
}


/* =========================================================
   Order helpers
   ========================================================= */

function getCourierNameFromOrder(order) {

    if (!order.courier) {
        return "Не призначено";
    }

    if (order.courier.user?.name) {
        return order.courier.user.name;
    }

    if (order.courier.name) {
        return order.courier.name;
    }

    if (order.courierId) {

        const courier = couriers.find(
            item =>
                Number(item.id) ===
                Number(order.courierId)
        );

        if (courier?.name) {
            return courier.name;
        }
    }

    return "Призначено";
}


/* =========================================================
   Loading / error states
   ========================================================= */

function showOrdersLoading() {

    ordersErrorState.classList.add("hidden");
    ordersEmptyState.classList.add("hidden");
    ordersTableWrapper.classList.add("hidden");

    ordersLoadingState.classList.remove("hidden");
}


function showOrdersError(message) {

    ordersLoadingState.classList.add("hidden");
    ordersEmptyState.classList.add("hidden");
    ordersTableWrapper.classList.add("hidden");

    ordersErrorMessage.textContent = message;

    ordersErrorState.classList.remove("hidden");
}


function showCouriersLoading() {

    couriersEmptyState.classList.add("hidden");
    couriersGrid.classList.add("hidden");

    couriersLoadingState.classList.remove("hidden");
}


/* =========================================================
   Navigation
   ========================================================= */

function showOrdersSection() {

    ordersNavigation.classList.add("active");
    couriersNavigation.classList.remove("active");

    ordersSection.classList.remove("hidden");
    couriersSection.classList.add("hidden");

    closeMobileSidebar();
}


function showCouriersSection() {

    couriersNavigation.classList.add("active");
    ordersNavigation.classList.remove("active");

    couriersSection.classList.remove("hidden");
    ordersSection.classList.add("hidden");

    renderCouriers();

    closeMobileSidebar();
}


/* =========================================================
   Modal helpers
   ========================================================= */

function openModal(modal) {

    modal.classList.remove("hidden");

    document.body.style.overflow =
        "hidden";
}


function closeModal(modal) {

    modal.classList.add("hidden");

    const anyOpenModal =
        document.querySelector(
            ".modal-backdrop:not(.hidden)"
        );

    if (!anyOpenModal) {
        document.body.style.overflow = "";
    }
}


function showAssignError(message) {

    assignCourierAlert.textContent = message;
    assignCourierAlert.classList.remove("hidden");
}


function hideAssignError() {

    assignCourierAlert.textContent = "";
    assignCourierAlert.classList.add("hidden");
}


/* =========================================================
   Toast
   ========================================================= */

function showToast(title, message) {

    clearTimeout(toastTimer);

    toastTitle.textContent = title;
    toastMessage.textContent = message;

    toast.classList.add("show");

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


/* =========================================================
   Mobile sidebar
   ========================================================= */

function openMobileSidebar() {

    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
}


function closeMobileSidebar() {

    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
}


/* =========================================================
   Formatting
   ========================================================= */

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


function getInitial(name) {

    if (!name) {
        return "К";
    }

    return name
        .trim()
        .charAt(0)
        .toUpperCase();
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   Events
   ========================================================= */

orderFilters.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-filter]"
            );

        if (!button) {
            return;
        }

        currentFilter =
            button.dataset.filter;

        document
            .querySelectorAll(
                ".filter-button"
            )
            .forEach(item =>
                item.classList.remove("active")
            );

        button.classList.add("active");

        renderOrders();
    }
);


orderSearch.addEventListener(
    "input",
    () => {

        currentSearch =
            orderSearch.value
                .trim()
                .toLowerCase();

        renderOrders();
    }
);


ordersTableBody.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-action]"
            );

        if (!button) {
            return;
        }

        const orderId =
            Number(button.dataset.orderId);

        switch (button.dataset.action) {

            case "details":
                openOrderDetails(orderId);
                break;

            case "assign":
                openAssignCourier(orderId);
                break;
        }
    }
);


orderDetailsFooter.addEventListener(
    "click",
    event => {

        const assignButton =
            event.target.closest(
                '[data-modal-action="assign"]'
            );

        if (!assignButton) {
            return;
        }

        const orderId =
            Number(assignButton.dataset.orderId);

        closeModal(orderDetailsModal);
        openAssignCourier(orderId);
    }
);


courierOptions.addEventListener(
    "click",
    event => {

        const option =
            event.target.closest(
                "[data-courier-id]"
            );

        if (!option ||
            option.disabled) {
            return;
        }

        selectedCourierId =
            Number(option.dataset.courierId);

        courierOptions
            .querySelectorAll(
                ".courier-option"
            )
            .forEach(item =>
                item.classList.remove("selected")
            );

        option.classList.add("selected");

        confirmAssignButton.disabled = false;

        hideAssignError();
    }
);


document.addEventListener(
    "click",
    event => {

        const closeButton =
            event.target.closest(
                "[data-close-modal]"
            );

        if (!closeButton) {
            return;
        }

        const modalId =
            closeButton.dataset.closeModal;

        const modal =
            document.getElementById(modalId);

        if (modal) {
            closeModal(modal);
        }
    }
);


document
    .querySelectorAll(".modal-backdrop")
    .forEach(modal => {

        modal.addEventListener(
            "click",
            event => {

                if (event.target === modal) {
                    closeModal(modal);
                }
            }
        );
    });


document.addEventListener(
    "keydown",
    event => {

        if (event.key !== "Escape") {
            return;
        }

        document
            .querySelectorAll(
                ".modal-backdrop:not(.hidden)"
            )
            .forEach(closeModal);

        closeMobileSidebar();
    }
);


confirmAssignButton.addEventListener(
    "click",
    assignCourier
);


refreshButton.addEventListener(
    "click",
    async () => {

        await Promise.all([
            loadOrders(),
            loadCouriers()
        ]);

        showToast(
            "Дані оновлено",
            "Інформацію про замовлення та кур'єрів оновлено."
        );
    }
);


refreshCouriersButton.addEventListener(
    "click",
    loadCouriers
);


retryOrdersButton.addEventListener(
    "click",
    loadOrders
);


ordersNavigation.addEventListener(
    "click",
    showOrdersSection
);


couriersNavigation.addEventListener(
    "click",
    showCouriersSection
);


mobileMenuButton.addEventListener(
    "click",
    openMobileSidebar
);


sidebarOverlay.addEventListener(
    "click",
    closeMobileSidebar
);


logoutButton.addEventListener(
    "click",
    () => {

        clearSession();
        redirectToLogin();
    }
);


/* =========================================================
   Start
   ========================================================= */

initialize();