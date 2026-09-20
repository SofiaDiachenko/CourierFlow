"use strict";

/* =========================================================
   CourierFlow — Client Dashboard
   ========================================================= */

const API = {
    myOrders: "/api/Orders/my",
    createOrder: "/api/Orders",
    cancelOrder: (id) => `/api/Orders/${id}/cancel`
};

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

let orders = [];
let currentFilter = "all";
let selectedOrder = null;


/* =========================================================
   DOM
   ========================================================= */

const elements = {
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    mobileMenuButton: document.getElementById("mobileMenuButton"),

    sidebarUserName: document.getElementById("sidebarUserName"),
    headerUserName: document.getElementById("headerUserName"),
    sidebarAvatar: document.getElementById("sidebarAvatar"),
    headerAvatar: document.getElementById("headerAvatar"),
    welcomeTitle: document.getElementById("welcomeTitle"),

    logoutButton: document.getElementById("logoutButton"),

    ordersNavigation: document.getElementById("ordersNavigation"),
    createNavigation: document.getElementById("createNavigation"),
    createOrderButton: document.getElementById("createOrderButton"),

    newCount: document.getElementById("newCount"),
    activeCount: document.getElementById("activeCount"),
    deliveredCount: document.getElementById("deliveredCount"),
    totalCount: document.getElementById("totalCount"),

    refreshButton: document.getElementById("refreshButton"),

    dashboardAlert: document.getElementById("dashboardAlert"),
    loadingState: document.getElementById("loadingState"),
    emptyState: document.getElementById("emptyState"),
    emptyStateText: document.getElementById("emptyStateText"),
    ordersList: document.getElementById("ordersList"),

    filterButtons: document.querySelectorAll(".filter-button"),

    createOrderModal: document.getElementById("createOrderModal"),
    createModalClose: document.getElementById("createModalClose"),
    cancelCreateButton: document.getElementById("cancelCreateButton"),
    createOrderForm: document.getElementById("createOrderForm"),
    createFormAlert: document.getElementById("createFormAlert"),
    submitOrderButton: document.getElementById("submitOrderButton"),
    submitOrderButtonText: document.getElementById("submitOrderButtonText"),

    senderAddress: document.getElementById("senderAddress"),
    deliveryAddress: document.getElementById("deliveryAddress"),
    recipientName: document.getElementById("recipientName"),
    recipientPhone: document.getElementById("recipientPhone"),
    packageDescription: document.getElementById("packageDescription"),

    orderModal: document.getElementById("orderModal"),
    orderModalTitle: document.getElementById("orderModalTitle"),
    orderModalBody: document.getElementById("orderModalBody"),
    orderModalFooter: document.getElementById("orderModalFooter"),
    orderModalClose: document.getElementById("orderModalClose")
};


/* =========================================================
   Session
   ========================================================= */

function getToken() {
    return sessionStorage.getItem("courierFlowToken");
}

function getStoredUser() {
    const value =
        sessionStorage.getItem("courierFlowUser");

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

function ensureAuthenticated() {
    const token = getToken();
    const user = getStoredUser();

    if (!token || !user) {
        clearSession();
        redirectToLogin();
        return false;
    }

    /*
     * Кабінет клієнта доступний
     * тільки користувачам з роллю Client.
     */
    if (Number(user.role) !== USER_ROLES.CLIENT) {
        clearSession();
        redirectToLogin();
        return false;
    }

    return true;
}


/* =========================================================
   User interface
   ========================================================= */

function setUserInterface() {
    const user = getStoredUser();

    const name =
        user?.name?.trim() ||
        user?.Name?.trim() ||
        "Клієнт";

    const firstName =
        name.split(/\s+/)[0] ||
        "Клієнт";

    const initial =
        firstName.charAt(0).toUpperCase() ||
        "К";

    elements.sidebarUserName.textContent = name;
    elements.headerUserName.textContent = name;

    elements.sidebarAvatar.textContent = initial;
    elements.headerAvatar.textContent = initial;

    elements.welcomeTitle.textContent =
        `Вітаємо, ${firstName}!`;
}


/* =========================================================
   API helper
   ========================================================= */

async function apiRequest(url, options = {}) {
    const token = getToken();

    const headers = {
        Accept: "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (
        options.body !== undefined &&
        !(options.body instanceof FormData)
    ) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    let data = null;

    const contentType =
        response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        try {
            data = await response.json();
        }
        catch {
            data = null;
        }
    }
    else {
        try {
            const text = await response.text();

            data = text
                ? { message: text }
                : null;
        }
        catch {
            data = null;
        }
    }

    if (response.status === 401) {
        clearSession();
        redirectToLogin();

        throw new Error(
            "Сесію завершено. Увійдіть у систему повторно."
        );
    }

    if (response.status === 403) {
        throw new Error(
            "У вас немає дозволу на виконання цієї дії."
        );
    }

    if (!response.ok) {
        const message =
            data?.message ||
            data?.title ||
            data?.error ||
            `Помилка сервера (${response.status}).`;

        throw new Error(message);
    }

    return data;
}


/* =========================================================
   Helpers
   ========================================================= */

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getStatusInfo(status) {
    const numericStatus = Number(status);

    switch (numericStatus) {
        case ORDER_STATUS.NEW:
            return {
                text: "Нове",
                className: "status-new"
            };

        case ORDER_STATUS.ASSIGNED:
            return {
                text: "Призначено",
                className: "status-assigned"
            };

        case ORDER_STATUS.PICKED_UP:
            return {
                text: "Отримано кур'єром",
                className: "status-picked"
            };

        case ORDER_STATUS.IN_TRANSIT:
            return {
                text: "У дорозі",
                className: "status-transit"
            };

        case ORDER_STATUS.DELIVERED:
            return {
                text: "Доставлено",
                className: "status-delivered"
            };

        case ORDER_STATUS.CANCELLED:
            return {
                text: "Скасовано",
                className: "status-cancelled"
            };

        default:
            return {
                text: "Невідомо",
                className: "status-new"
            };
    }
}

function formatDate(value) {
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

function getCourierName(order) {
    if (!order?.courier) {
        return "Ще не призначено";
    }

    if (order.courier.user?.name) {
        return order.courier.user.name;
    }

    if (order.courier.name) {
        return order.courier.name;
    }

    return `Кур'єр #${order.courier.id ??
        order.courierId ??
        ""
        }`;
}


/*
 * Клієнт може скасувати замовлення,
 * поки фактичне виконання доставки
 * ще не розпочалося.
 *
 * Дозволено:
 * New      -> Cancelled
 * Assigned -> Cancelled
 *
 * Заборонено:
 * PickedUp
 * InTransit
 * Delivered
 * Cancelled
 */
function canCancelOrder(order) {
    const status = Number(order.status);

    return (
        status === ORDER_STATUS.NEW ||
        status === ORDER_STATUS.ASSIGNED
    );
}


/* =========================================================
   Alerts
   ========================================================= */

function showDashboardAlert(
    message,
    type = "error"
) {
    elements.dashboardAlert.textContent = message;

    elements.dashboardAlert.className =
        `dashboard-alert show ${type}`;
}

function hideDashboardAlert() {
    elements.dashboardAlert.textContent = "";

    elements.dashboardAlert.className =
        "dashboard-alert";
}

function showFormAlert(
    message,
    type = "error"
) {
    elements.createFormAlert.textContent = message;

    elements.createFormAlert.className =
        `form-alert show ${type}`;
}

function hideFormAlert() {
    elements.createFormAlert.textContent = "";

    elements.createFormAlert.className =
        "form-alert";
}


/* =========================================================
   Loading
   ========================================================= */

function setLoading(isLoading) {
    if (isLoading) {
        elements.loadingState.classList.add("show");
        elements.emptyState.classList.remove("show");
        elements.ordersList.innerHTML = "";
    }
    else {
        elements.loadingState.classList.remove("show");
    }
}


/* =========================================================
   Load orders
   ========================================================= */

async function loadOrders() {
    hideDashboardAlert();
    setLoading(true);

    try {
        const data =
            await apiRequest(API.myOrders);

        orders =
            Array.isArray(data)
                ? data
                : [];

        updateStatistics();
        renderOrders();
    }
    catch (error) {
        orders = [];

        updateStatistics();

        elements.ordersList.innerHTML = "";
        elements.emptyState.classList.remove("show");

        showDashboardAlert(
            error.message ||
            "Не вдалося завантажити замовлення."
        );
    }
    finally {
        setLoading(false);
    }
}


/* =========================================================
   Statistics
   ========================================================= */

function updateStatistics() {
    const newOrders =
        orders.filter(
            order =>
                Number(order.status) ===
                ORDER_STATUS.NEW
        ).length;

    const activeOrders =
        orders.filter(order => {
            const status =
                Number(order.status);

            return (
                status === ORDER_STATUS.ASSIGNED ||
                status === ORDER_STATUS.PICKED_UP ||
                status === ORDER_STATUS.IN_TRANSIT
            );
        }).length;

    const deliveredOrders =
        orders.filter(
            order =>
                Number(order.status) ===
                ORDER_STATUS.DELIVERED
        ).length;

    elements.newCount.textContent =
        newOrders;

    elements.activeCount.textContent =
        activeOrders;

    elements.deliveredCount.textContent =
        deliveredOrders;

    elements.totalCount.textContent =
        orders.length;
}


/* =========================================================
   Filters
   ========================================================= */

function getFilteredOrders() {
    switch (currentFilter) {
        case "active":
            return orders.filter(order => {
                const status =
                    Number(order.status);

                return (
                    status === ORDER_STATUS.NEW ||
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

        case "cancelled":
            return orders.filter(
                order =>
                    Number(order.status) ===
                    ORDER_STATUS.CANCELLED
            );

        case "all":
        default:
            return [...orders];
    }
}

function getEmptyMessage() {
    switch (currentFilter) {
        case "active":
            return "У вас немає активних доставок.";

        case "delivered":
            return "У вас ще немає завершених доставок.";

        case "cancelled":
            return "У вас немає скасованих замовлень.";

        default:
            return "Створіть свою першу доставку, щоб вона з'явилася тут.";
    }
}


/* =========================================================
   Render orders
   ========================================================= */

function renderOrders() {
    const filteredOrders =
        getFilteredOrders();

    elements.ordersList.innerHTML = "";

    if (filteredOrders.length === 0) {
        elements.emptyStateText.textContent =
            getEmptyMessage();

        elements.emptyState.classList.add("show");

        return;
    }

    elements.emptyState.classList.remove("show");

    const sortedOrders =
        [...filteredOrders].sort(
            (a, b) =>
                new Date(b.createdAt || 0) -
                new Date(a.createdAt || 0)
        );

    elements.ordersList.innerHTML =
        sortedOrders
            .map(createOrderCard)
            .join("");

    document
        .querySelectorAll("[data-order-details]")
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const id = Number(
                        button.dataset.orderDetails
                    );

                    openOrderDetails(id);
                }
            );
        });
}

function createOrderCard(order) {
    const status =
        getStatusInfo(order.status);

    return `
        <article class="order-card">

            <div class="order-field">
                <span class="order-field-label">
                    Замовлення
                </span>

                <span class="order-number">
                    #${escapeHtml(order.id)}
                </span>
            </div>

            <div class="order-field">
                <span class="order-field-label">
                    Звідки
                </span>

                <span class="order-field-value"
                      title="${escapeHtml(order.senderAddress)}">
                    ${escapeHtml(order.senderAddress)}
                </span>
            </div>

            <div class="order-field">
                <span class="order-field-label">
                    Куди
                </span>

                <span class="order-field-value"
                      title="${escapeHtml(order.deliveryAddress)}">
                    ${escapeHtml(order.deliveryAddress)}
                </span>
            </div>

            <div class="order-field">
                <span class="order-field-label">
                    Статус
                </span>

                <span class="status-badge ${status.className}">
                    ${status.text}
                </span>
            </div>

            <div class="order-actions">

                <button type="button"
                        class="details-button"
                        data-order-details="${escapeHtml(order.id)}">
                    Деталі
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   Create order modal
   ========================================================= */

function openCreateModal() {
    hideFormAlert();
    clearValidation();

    elements.createOrderModal.classList.add("show");

    elements.createOrderModal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow = "hidden";

    setTimeout(() => {
        elements.senderAddress.focus();
    }, 50);
}

function closeCreateModal() {
    elements.createOrderModal.classList.remove("show");

    elements.createOrderModal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

    hideFormAlert();
    clearValidation();
}


/* =========================================================
   Validation
   ========================================================= */

function setFieldError(input, message) {
    const group =
        input.closest(".form-group");

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
    const group =
        input.closest(".form-group");

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
        elements.senderAddress,
        elements.deliveryAddress,
        elements.recipientName,
        elements.recipientPhone,
        elements.packageDescription
    ].forEach(clearFieldError);
}

function validateOrderForm() {
    clearValidation();

    let isValid = true;

    const sender =
        elements.senderAddress.value.trim();

    const delivery =
        elements.deliveryAddress.value.trim();

    const recipient =
        elements.recipientName.value.trim();

    const phone =
        elements.recipientPhone.value.trim();

    const description =
        elements.packageDescription.value.trim();

    if (sender.length < 5) {
        setFieldError(
            elements.senderAddress,
            "Введіть адресу відправлення."
        );

        isValid = false;
    }

    if (delivery.length < 5) {
        setFieldError(
            elements.deliveryAddress,
            "Введіть адресу доставки."
        );

        isValid = false;
    }

    if (recipient.length < 2) {
        setFieldError(
            elements.recipientName,
            "Введіть ім'я одержувача."
        );

        isValid = false;
    }

    const normalizedPhone =
        phone.replace(/[\s()-]/g, "");

    const phoneRegex =
        /^\+?[0-9]{10,15}$/;

    if (!phoneRegex.test(normalizedPhone)) {
        setFieldError(
            elements.recipientPhone,
            "Введіть коректний номер телефону."
        );

        isValid = false;
    }

    if (description.length > 500) {
        setFieldError(
            elements.packageDescription,
            "Опис не повинен перевищувати 500 символів."
        );

        isValid = false;
    }

    return isValid;
}


/* =========================================================
   Create order
   ========================================================= */

async function createOrder(event) {
    event.preventDefault();

    hideFormAlert();

    if (!validateOrderForm()) {
        showFormAlert(
            "Перевірте правильність заповнення форми."
        );

        return;
    }

    const request = {
        senderAddress:
            elements.senderAddress.value.trim(),

        deliveryAddress:
            elements.deliveryAddress.value.trim(),

        recipientName:
            elements.recipientName.value.trim(),

        recipientPhone:
            elements.recipientPhone.value
                .trim()
                .replace(/[\s()-]/g, ""),

        packageDescription:
            elements.packageDescription.value.trim()
    };

    setSubmitState(true);

    try {
        const createdOrder =
            await apiRequest(
                API.createOrder,
                {
                    method: "POST",
                    body: JSON.stringify(request)
                }
            );

        elements.createOrderForm.reset();

        closeCreateModal();

        currentFilter = "all";
        updateFilterButtons();

        await loadOrders();

        showDashboardAlert(
            `Замовлення #${createdOrder?.id ?? ""} успішно створено.`,
            "success"
        );
    }
    catch (error) {
        showFormAlert(
            error.message ||
            "Не вдалося створити замовлення."
        );
    }
    finally {
        setSubmitState(false);
    }
}

function setSubmitState(isSubmitting) {
    elements.submitOrderButton.disabled =
        isSubmitting;

    elements.submitOrderButtonText.textContent =
        isSubmitting
            ? "Створюємо..."
            : "Створити замовлення";
}


/* =========================================================
   Order details
   ========================================================= */

function openOrderDetails(id) {
    const order =
        orders.find(
            item =>
                Number(item.id) === Number(id)
        );

    if (!order) {
        showDashboardAlert(
            "Не вдалося знайти це замовлення."
        );

        return;
    }

    selectedOrder = order;

    const status =
        getStatusInfo(order.status);

    elements.orderModalTitle.textContent =
        `Замовлення #${order.id}`;

    elements.orderModalBody.innerHTML = `
        <div class="details-grid">

            <div class="detail-item full">
                <span class="detail-label">
                    Статус
                </span>

                <span class="status-badge ${status.className}">
                    ${status.text}
                </span>
            </div>

            <div class="detail-item full">
                <span class="detail-label">
                    Адреса відправлення
                </span>

                <div class="detail-value">
                    ${escapeHtml(order.senderAddress)}
                </div>
            </div>

            <div class="detail-item full">
                <span class="detail-label">
                    Адреса доставки
                </span>

                <div class="detail-value">
                    ${escapeHtml(order.deliveryAddress)}
                </div>
            </div>

            <div class="detail-item">
                <span class="detail-label">
                    Одержувач
                </span>

                <div class="detail-value">
                    ${escapeHtml(order.recipientName)}
                </div>
            </div>

            <div class="detail-item">
                <span class="detail-label">
                    Телефон
                </span>

                <div class="detail-value">
                    ${escapeHtml(order.recipientPhone)}
                </div>
            </div>

            <div class="detail-item full">
                <span class="detail-label">
                    Опис відправлення
                </span>

                <div class="detail-value">
                    ${escapeHtml(
        order.packageDescription || "—"
    )}
                </div>
            </div>

            <div class="detail-item">
                <span class="detail-label">
                    Кур'єр
                </span>

                <div class="detail-value">
                    ${escapeHtml(
        getCourierName(order)
    )}
                </div>
            </div>

            <div class="detail-item">
                <span class="detail-label">
                    Створено
                </span>

                <div class="detail-value">
                    ${escapeHtml(
        formatDate(order.createdAt)
    )}
                </div>
            </div>

            <div class="detail-item">
                <span class="detail-label">
                    Оновлено
                </span>

                <div class="detail-value">
                    ${escapeHtml(
        formatDate(order.updatedAt)
    )}
                </div>
            </div>

        </div>
    `;

    renderOrderModalFooter(order);

    elements.orderModal.classList.add("show");

    elements.orderModal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow = "hidden";
}


/* =========================================================
   Order modal actions
   ========================================================= */

function renderOrderModalFooter(order) {
    const cancelButton =
        canCancelOrder(order)
            ? `
                <button type="button"
                        class="danger-button"
                        id="cancelOrderButton">
                    Скасувати замовлення
                </button>
              `
            : "";

    elements.orderModalFooter.innerHTML = `
        ${cancelButton}

        <button type="button"
                class="modal-secondary"
                id="closeDetailsButton">
            Закрити
        </button>
    `;

    document
        .getElementById("closeDetailsButton")
        ?.addEventListener(
            "click",
            closeOrderDetails
        );

    document
        .getElementById("cancelOrderButton")
        ?.addEventListener(
            "click",
            cancelSelectedOrder
        );
}

function closeOrderDetails() {
    elements.orderModal.classList.remove("show");

    elements.orderModal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

    selectedOrder = null;
}


/* =========================================================
   Cancel order
   ========================================================= */

async function cancelSelectedOrder() {
    if (!selectedOrder) {
        return;
    }

    const orderId =
        selectedOrder.id;

    const confirmed =
        window.confirm(
            `Ви впевнені, що хочете скасувати замовлення #${orderId}?`
        );

    if (!confirmed) {
        return;
    }

    const button =
        document.getElementById(
            "cancelOrderButton"
        );

    if (button) {
        button.disabled = true;
        button.textContent =
            "Скасовуємо...";
    }

    try {
        /*
         * Backend:
         * PATCH /api/Orders/{id}/cancel
         *
         * Тіло запиту не потрібне.
         * Клієнт визначається сервером із JWT.
         */
        await apiRequest(
            API.cancelOrder(orderId),
            {
                method: "PATCH"
            }
        );

        closeOrderDetails();

        /*
         * Спочатку отримуємо актуальний стан
         * замовлень із backend.
         */
        await loadOrders();

        showDashboardAlert(
            `Замовлення #${orderId} успішно скасовано.`,
            "success"
        );
    }
    catch (error) {
        if (button) {
            button.disabled = false;
            button.textContent =
                "Скасувати замовлення";
        }

        window.alert(
            error.message ||
            "Не вдалося скасувати замовлення."
        );
    }
}


/* =========================================================
   Filter buttons
   ========================================================= */

function updateFilterButtons() {
    elements.filterButtons.forEach(
        button => {
            button.classList.toggle(
                "active",
                button.dataset.filter ===
                currentFilter
            );
        }
    );
}

function changeFilter(event) {
    const button =
        event.currentTarget;

    currentFilter =
        button.dataset.filter || "all";

    updateFilterButtons();
    renderOrders();
}


/* =========================================================
   Sidebar
   ========================================================= */

function openSidebar() {
    elements.sidebar.classList.add("open");

    elements.sidebarOverlay.classList.add(
        "show"
    );
}

function closeSidebar() {
    elements.sidebar.classList.remove("open");

    elements.sidebarOverlay.classList.remove(
        "show"
    );
}


/* =========================================================
   Logout
   ========================================================= */

function logout() {
    clearSession();
    redirectToLogin();
}


/* =========================================================
   Events
   ========================================================= */

function bindEvents() {
    elements.logoutButton.addEventListener(
        "click",
        logout
    );

    elements.refreshButton.addEventListener(
        "click",
        loadOrders
    );

    elements.createOrderButton.addEventListener(
        "click",
        openCreateModal
    );

    elements.createNavigation.addEventListener(
        "click",
        () => {
            closeSidebar();
            openCreateModal();
        }
    );

    elements.ordersNavigation.addEventListener(
        "click",
        () => {
            closeSidebar();

            document
                .getElementById("ordersSection")
                ?.scrollIntoView({
                    behavior: "smooth"
                });
        }
    );

    elements.filterButtons.forEach(
        button => {
            button.addEventListener(
                "click",
                changeFilter
            );
        }
    );

    elements.createModalClose.addEventListener(
        "click",
        closeCreateModal
    );

    elements.cancelCreateButton.addEventListener(
        "click",
        closeCreateModal
    );

    elements.createOrderForm.addEventListener(
        "submit",
        createOrder
    );

    elements.orderModalClose.addEventListener(
        "click",
        closeOrderDetails
    );

    elements.mobileMenuButton.addEventListener(
        "click",
        openSidebar
    );

    elements.sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );

    elements.createOrderModal.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                elements.createOrderModal
            ) {
                closeCreateModal();
            }
        }
    );

    elements.orderModal.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                elements.orderModal
            ) {
                closeOrderDetails();
            }
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (event.key !== "Escape") {
                return;
            }

            if (
                elements.createOrderModal
                    .classList.contains("show")
            ) {
                closeCreateModal();
                return;
            }

            if (
                elements.orderModal
                    .classList.contains("show")
            ) {
                closeOrderDetails();
                return;
            }

            closeSidebar();
        }
    );

    [
        elements.senderAddress,
        elements.deliveryAddress,
        elements.recipientName,
        elements.recipientPhone,
        elements.packageDescription
    ].forEach(input => {
        input.addEventListener(
            "input",
            () => clearFieldError(input)
        );
    });
}


/* =========================================================
   Initialization
   ========================================================= */

async function initialize() {
    if (!ensureAuthenticated()) {
        return;
    }

    setUserInterface();
    bindEvents();

    await loadOrders();
}

initialize();