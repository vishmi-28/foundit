// =========================
// DASHBOARD LOGIC
// =========================

let dashboardChart = null;

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    if (!path.includes("dashboard.html")) return;

    setupDashboardTabs();
    loadDashboardContent();
    setupDashboardSearch();
});

// Setup tab navigation clicks
function setupDashboardTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    if (!currentUser) return;

    // Display admin-only tabs
    const usersTabBtn = document.getElementById("usersTabBtn");
    if (currentUser.role === "Admin" && usersTabBtn) {
        usersTabBtn.style.display = "";
    }

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");

            // Toggle active button
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Toggle active content section
            tabContents.forEach(content => {
                if (content.id === `${targetTab}Tab`) {
                    content.style.display = "";
                } else {
                    content.style.display = "none";
                }
            });

            // Specific tab load actions
            if (targetTab === "chats") {
                renderChatInterface();
            } else if (targetTab === "users" && currentUser.role === "Admin") {
                renderUsersTable();
            } else if (targetTab === "reports") {
                renderReportsTableFull();
            } else if (targetTab === "overview") {
                loadDashboardContent();
            } else if (targetTab === "notifications") {
                renderNotificationsTab();
            }
        });
    });

    // Check query params to open a specific tab directly (e.g. ?tab=chats)
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get("tab");
    if (initialTab) {
        const matchingBtn = document.querySelector(`.tab-btn[data-tab="${initialTab}"]`);
        if (matchingBtn) {
            matchingBtn.click();
        }
    }
}

// Load and render all overview content
function loadDashboardContent() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    // Set Welcome Header
    const usernameEl = document.getElementById("username");
    if (usernameEl) {
        usernameEl.textContent = currentUser.name;
    }
    
    const roleSpan = document.querySelector(".dashboard-user span");
    if (roleSpan) {
        roleSpan.textContent = currentUser.role === "Admin" ? "Administrator" : "Student User";
    }

    // Set User Profile Image
    const profileImg = document.querySelector(".dashboard-user img");
    if (profileImg) {
        profileImg.src = currentUser.role === "Admin" 
            ? "images/logo.png" 
            : `https://i.pravatar.cc/100?u=${currentUser.id}`;
    }

    // Calculate Counts & Stats
    const reports = loadData("reports");
    const userReports = currentUser.role === "Admin" 
        ? reports 
        : reports.filter(r => r.reporterId === currentUser.id);

    const lostCount = userReports.filter(r => r.reportType === "Lost Item" && r.status === "Lost").length;
    const foundCount = userReports.filter(r => r.reportType === "Found Item" && r.status === "Found").length;
    const claimedCount = userReports.filter(r => r.status === "Returned").length;
    
    // Pending items count (either lost or found and not yet returned)
    const pendingCount = userReports.filter(r => r.status !== "Returned").length;

    // Update numbers on cards
    const statsContainer = document.querySelector(".dashboard-stats");
    if (statsContainer) {
        const statCards = statsContainer.querySelectorAll(".dashboard-card");
        if (statCards.length >= 4) {
            statCards[0].querySelector("h2").textContent = lostCount;
            statCards[1].querySelector("h2").textContent = foundCount;
            statCards[2].querySelector("h2").textContent = claimedCount;
            statCards[3].querySelector("h2").textContent = pendingCount;
        }
    }

    // Load Chart.js
    renderDashboardChart(lostCount, foundCount, claimedCount, pendingCount);

    // Load Activity feed
    renderRecentActivity(reports);

    // Load Overview Mini-Table
    renderOverviewTable(userReports);
}

// Render the Chart.js canvas
function renderDashboardChart(lost, found, claimed, pending) {
    const ctx = document.getElementById("itemsChart");
    if (!ctx) return;

    // Destroy previous instance to avoid duplication overlays
    if (dashboardChart) {
        dashboardChart.destroy();
    }

    if (typeof Chart === "undefined") return;

    dashboardChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Lost', 'Found', 'Returned', 'Pending'],
            datasets: [{
                label: 'Items',
                data: [lost, found, claimed, pending],
                backgroundColor: ['#ff4d4d', '#00A86B', '#2bb9a9', '#f59e0b'],
                borderRadius: 12,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            }
        }
    });
}

// Render dynamic recent activities list
function renderRecentActivity(reports) {
    const list = document.querySelector(".activity-list");
    if (!list) return;

    list.innerHTML = "";

    // Sort reports by creation date descending
    const sorted = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    if (sorted.length === 0) {
        list.innerHTML = `<p class="no-activity-msg">No recent actions recorded.</p>`;
        return;
    }

    sorted.forEach(item => {
        const div = document.createElement("div");
        div.className = "activity-item";
        
        let actionMsg = "";
        if (item.status === "Returned") {
            actionMsg = `<strong>${item.itemName}</strong> marked as Returned`;
        } else {
            actionMsg = `<strong>${item.itemName}</strong> reported ${item.status.toLowerCase()} near ${item.location}`;
        }

        const dateStr = new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" });

        div.innerHTML = `
            <div class="activity-dot"></div>
            <p>${actionMsg} <span class="activity-time-badge">${dateStr}</span></p>
        `;
        list.appendChild(div);
    });
}

// Render small table inside overview tab
function renderOverviewTable(reports) {
    const tbody = document.querySelector(".dashboard-table tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    
    // Sort and show top 5
    const latest = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    if (latest.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No reports found.</td></tr>`;
        return;
    }

    latest.forEach(item => {
        const tr = document.createElement("tr");
        
        let statusBadge = "";
        if (item.status === "Lost") {
            statusBadge = `<span class="dashboard-badge badge-lost">Lost</span>`;
        } else if (item.status === "Found") {
            statusBadge = `<span class="dashboard-badge badge-found">Found</span>`;
        } else {
            statusBadge = `<span class="dashboard-badge badge-pending" style="background:#e0f2fe; color:var(--primary);">Returned</span>`;
        }

        const dateFormatted = new Date(item.date).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

        tr.innerHTML = `
            <td><strong>${item.itemName}</strong></td>
            <td>${item.category}</td>
            <td>${statusBadge}</td>
            <td>${dateFormatted}</td>
            <td><button class="details-btn" style="padding: 8px 14px;" onclick="openDashboardModal('${item.reportId}')">View</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Render full table in dedicated Reports tab
function renderReportsTableFull() {
    const container = document.getElementById("reportsTableContainer");
    if (!container) return;

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    const reports = loadData("reports");
    const userReports = currentUser.role === "Admin" 
        ? reports 
        : reports.filter(r => r.reporterId === currentUser.id);

    container.innerHTML = `
        <div class="dashboard-table-top">
            <h2>${currentUser.role === "Admin" ? "All Platform Reports" : "My Submitted Reports"}</h2>
            <input type="text" id="fullReportsSearch" placeholder="Filter reports..." class="dashboard-search">
        </div>
        <div class="dashboard-table">
            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="fullReportsTbody">
                    <!-- Loaded dynamically -->
                </tbody>
            </table>
        </div>
    `;

    // Hook search event
    const searchInput = document.getElementById("fullReportsSearch");
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        filterFullReportsTable(userReports, query);
    });

    // Populate rows
    filterFullReportsTable(userReports, "");
}

// Populate and filter full reports rows
function filterFullReportsTable(reports, query) {
    const tbody = document.getElementById("fullReportsTbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const filtered = reports.filter(r => 
        r.itemName.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query) ||
        r.location.toLowerCase().includes(query) ||
        r.status.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No matching reports found.</td></tr>`;
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    filtered.forEach(item => {
        const tr = document.createElement("tr");

        let statusBadge = "";
        if (item.status === "Lost") {
            statusBadge = `<span class="dashboard-badge badge-lost">Lost</span>`;
        } else if (item.status === "Found") {
            statusBadge = `<span class="dashboard-badge badge-found">Found</span>`;
        } else {
            statusBadge = `<span class="dashboard-badge badge-pending" style="background:#e0f2fe; color:var(--primary);">Returned</span>`;
        }

        const dateFormatted = new Date(item.date).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

        // Action Buttons: owner or Admin can Edit/Delete
        const isOwnerOrAdmin = (currentUser.role === "Admin") || (item.reporterId === currentUser.id);
        
        let actionsHtml = `<button class="details-btn" style="padding: 6px 12px; margin-right: 5px; width:auto; display:inline-block;" onclick="openDashboardModal('${item.reportId}')">View</button>`;

        if (isOwnerOrAdmin) {
            actionsHtml += `
                <button class="edit-btn" style="padding: 6px 12px; margin-right: 5px; width:auto; font-size:13px; font-weight:600;" onclick="editReportDashboard('${item.reportId}')">Edit</button>
                <button class="delete-btn" style="padding: 6px 12px; width:auto; font-size:13px; font-weight:600;" onclick="deleteReportDashboard('${item.reportId}')">Delete</button>
            `;
        }

        tr.innerHTML = `
            <td><strong>${item.itemName}</strong></td>
            <td>${item.category}</td>
            <td>${statusBadge}</td>
            <td><span class="status-badge ${item.reportType === "Lost Item" ? "status-lost" : "status-found"}" style="padding:4px 10px; font-size:11px; margin-bottom:0;">${item.reportType}</span></td>
            <td>📍 ${item.location}</td>
            <td>${dateFormatted}</td>
            <td>
                <div style="display:flex; align-items:center;">
                    ${actionsHtml}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Hook search inputs in Mini tables
function setupDashboardSearch() {
    const miniSearch = document.querySelector(".dashboard-search");
    if (!miniSearch) return;

    miniSearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) return;

        const reports = loadData("reports");
        const userReports = currentUser.role === "Admin" 
            ? reports 
            : reports.filter(r => r.reporterId === currentUser.id);

        const filtered = userReports.filter(r => 
            r.itemName.toLowerCase().includes(query) ||
            r.category.toLowerCase().includes(query) ||
            r.location.toLowerCase().includes(query)
        );

        renderOverviewTable(filtered);
    });
}

// Redirect report edit
function editReportDashboard(reportId) {
    const reports = loadData("reports");
    const report = reports.find(r => r.reportId === reportId);
    if (!report) return;

    localStorage.setItem("editItem", JSON.stringify(report));
    window.location.href = "report.html";
}

// Report deletion
function deleteReportDashboard(reportId) {
    if (!confirm("Are you sure you want to permanently delete this report?")) return;

    // Delete reports
    deleteData("reports", reportId, "reportId");

    // Also delete any messages linked to this report
    let messages = loadData("messages");
    messages = messages.filter(m => m.reportId !== reportId);
    saveData("messages", messages);

    alert("Report deleted successfully.");
    
    // Refresh page
    loadDashboardContent();
    renderReportsTableFull();
    if (typeof renderLinkReportsUI === "function") {
        renderLinkReportsUI();
    }
}

// Dashboard Detail Modal Opener
function openDashboardModal(reportId) {
    const reports = loadData("reports");
    const item = reports.find(r => r.reportId === reportId);
    if (!item) return;

    const modal = document.getElementById("itemModal");
    if (!modal) {
        // If modal doesn't exist on dashboard page, let's alert or dynamically inject it
        alert(`Item: ${item.itemName}\nLocation: ${item.location}\nCategory: ${item.category}\nStatus: ${item.status}\nDescription: ${item.description}`);
        return;
    }

    modal.style.display = "flex";

    document.getElementById("modalTitle").innerText = item.itemName;
    document.getElementById("modalCategory").innerText = "Category: " + item.category;
    document.getElementById("modalLocation").innerText = "📍 Location: " + item.location;
    document.getElementById("modalDescription").innerText = "Description: " + item.description;

    let statusBadge = "";
    if (item.status === "Lost") {
        statusBadge = `<span class="status-badge status-lost">LOST</span>`;
    } else if (item.status === "Found") {
        statusBadge = `<span class="status-badge status-found">FOUND</span>`;
    } else {
        statusBadge = `<span class="status-badge status-returned" style="background:#e0f2fe; color:var(--primary);">RETURNED</span>`;
    }

    document.getElementById("modalStatus").innerHTML = statusBadge;
    document.getElementById("modalImage").src = item.image || "images/no-image.png";
}

// Notifications tab renderer
function renderNotificationsTab() {
    const container = document.getElementById("notificationsTableContainer");
    if (!container) return;

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    const notifications = getNotificationsForUser(currentUser.id);

    container.innerHTML = `
        <div class="dashboard-table-top">
            <h2>My Notifications</h2>
            <button class="details-btn" id="markAllReadBtn" style="width:auto; padding: 8px 16px;">Mark All Read</button>
        </div>
        <div class="notifications-list-wrapper" id="notificationsListWrapper">
            <!-- Rendered below -->
        </div>
    `;

    const wrapper = document.getElementById("notificationsListWrapper");
    wrapper.innerHTML = "";

    if (notifications.length === 0) {
        wrapper.innerHTML = `<p class="no-chats-msg" style="padding:30px; text-align:center;">You have no notifications.</p>`;
        return;
    }

    notifications.forEach(notif => {
        const item = document.createElement("div");
        item.className = `notification-list-item ${notif.read ? "read" : "unread"}`;
        
        let typeIcon = "🔔";
        if (notif.type === "message") typeIcon = "💬";
        if (notif.type === "approval") typeIcon = "🤝";
        if (notif.type === "returned") typeIcon = "🎁";

        const dateStr = new Date(notif.timestamp).toLocaleString();

        item.innerHTML = `
            <div class="notif-icon">${typeIcon}</div>
            <div class="notif-details">
                <h4>${notif.title}</h4>
                <p>${notif.message}</p>
                <span class="notif-date">${dateStr}</span>
            </div>
            <div class="notif-actions">
                ${!notif.read ? `<button class="details-btn btn-read" onclick="readNotificationDashboard('${notif.id}')" style="padding:6px 12px; font-size:12px; margin-bottom:5px;">Read</button>` : ""}
                <button class="delete-btn btn-delete" onclick="deleteNotificationDashboard('${notif.id}')" style="padding:6px 12px; font-size:12px;">Clear</button>
            </div>
        `;
        wrapper.appendChild(item);
    });

    document.getElementById("markAllReadBtn").addEventListener("click", () => {
        markAllNotificationsAsRead(currentUser.id);
        renderNotificationsTab();
    });
}

function readNotificationDashboard(id) {
    markNotificationAsRead(id);
    renderNotificationsTab();
}

function deleteNotificationDashboard(id) {
    deleteNotification(id);
    renderNotificationsTab();
}
