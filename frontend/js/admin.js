// =========================
// ADMIN FUNCTIONS
// =========================

// Render the users list in the Admin Dashboard
function renderUsersTable() {
    const container = document.getElementById("usersTableContainer");
    if (!container) return;

    const users = loadData("users");
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    container.innerHTML = `
        <div class="dashboard-table-top">
            <h2>User Accounts</h2>
        </div>
        <div class="dashboard-table">
            <table>
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="usersTableBody">
                    <!-- Rendered dynamically -->
                </tbody>
            </table>
        </div>
    `;

    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = "";

    users.forEach(u => {
        const tr = document.createElement("tr");
        
        // Prevent admin from deleting themselves
        const deleteBtn = u.id === currentUser.id 
            ? `<span class="meta-info">Active Session</span>`
            : `<button class="delete-btn" onclick="deleteUserAccount('${u.id}')">Delete</button>`;

        tr.innerHTML = `
            <td><code>${u.id}</code></td>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td><span class="status-badge ${u.role === "Admin" ? "status-found" : "status-pending"}">${u.role}</span></td>
            <td>${deleteBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Delete user account
function deleteUserAccount(userId) {
    if (!confirm("Are you sure you want to delete this user account? This will remove all their login access.")) return;

    // Delete user
    deleteData("users", userId, "id");
    
    // Refresh table
    renderUsersTable();
    alert("User account deleted successfully.");
}

// Render the select tools for report linking
function renderLinkReportsUI() {
    const container = document.getElementById("linkReportsContainer");
    if (!container) return;

    const reports = loadData("reports");
    
    // Filter reports
    const lostItems = reports.filter(r => r.reportType === "Lost Item" && r.status === "Lost" && !r.linkedReportId);
    const foundItems = reports.filter(r => r.reportType === "Found Item" && r.status === "Found" && !r.linkedReportId);

    container.innerHTML = `
        <div class="link-reports-box">
            <h3>Link Lost & Found Items</h3>
            <p>Establish a direct communication channel between the person who lost an item and the person who found a match.</p>
            
            <div class="link-selectors">
                <div class="selector-field">
                    <label for="linkLostSelect">Lost Item</label>
                    <select id="linkLostSelect">
                        <option value="">-- Select Lost Report --</option>
                        ${lostItems.map(r => `<option value="${r.reportId}">${r.itemName} (by ${r.reporterId}) - 📍 ${r.location}</option>`).join("")}
                    </select>
                </div>
                
                <div class="selector-icon">
                    <i class="fa-solid fa-link"></i>
                </div>
                
                <div class="selector-field">
                    <label for="linkFoundSelect">Found Item</label>
                    <select id="linkFoundSelect">
                        <option value="">-- Select Found Report --</option>
                        ${foundItems.map(r => `<option value="${r.reportId}">${r.itemName} (by ${r.reporterId}) - 📍 ${r.location}</option>`).join("")}
                    </select>
                </div>
            </div>
            
            <button class="details-btn" id="linkReportsBtn" style="margin-top:20px; width:auto; padding: 12px 28px;">
                Approve Match & Link Chat
            </button>
        </div>
    `;

    document.getElementById("linkReportsBtn").addEventListener("click", () => {
        const lostId = document.getElementById("linkLostSelect").value;
        const foundId = document.getElementById("linkFoundSelect").value;

        if (!lostId || !foundId) {
            alert("Please select both a Lost Item and a Found Item report to link.");
            return;
        }

        linkReports(lostId, foundId);
    });
}

// Link a Lost report and a Found report
function linkReports(lostReportId, foundReportId) {
    let reports = loadData("reports");
    const users = loadData("users");
    
    const lostIndex = reports.findIndex(r => r.reportId === lostReportId);
    const foundIndex = reports.findIndex(r => r.reportId === foundReportId);

    if (lostIndex === -1 || foundIndex === -1) {
        alert("Error linking reports: One or both reports could not be found.");
        return;
    }

    const lostRep = reports[lostIndex];
    const foundRep = reports[foundIndex];

    // Mark as linked
    lostRep.linkedReportId = foundReportId;
    foundRep.linkedReportId = lostReportId;
    
    reports[lostIndex] = lostRep;
    reports[foundIndex] = foundRep;
    saveData("reports", reports);

    // Get user details
    const userLost = users.find(u => u.id === lostRep.reporterId);
    const userFound = users.find(u => u.id === foundRep.reporterId);

    // Create linked chat conversation
    const chatId = `chat_link_${lostReportId}_${foundReportId}`;
    const messages = loadData("messages");

    // Welcome message from System Admin in the linked chat
    const welcomeMsg = {
        chatId,
        senderId: "usr_admin",
        receiverId: lostRep.reporterId,
        message: `🔔 Match Approved: A connection has been established by the Admin between "${lostRep.itemName}" (Lost) and "${foundRep.itemName}" (Found). You can now communicate directly to arrange verification and return.`,
        timestamp: new Date().toISOString(),
        reportId: lostReportId,
        read: false
    };

    messages.push(welcomeMsg);
    saveData("messages", messages);

    // Send notifications to both users
    createNotification(
        lostRep.reporterId,
        "Matching Item Approved! 🔔",
        `Admin has linked your lost "${lostRep.itemName}" to a found item. Chat is now available!`,
        "approval"
    );

    createNotification(
        foundRep.reporterId,
        "Matching Item Approved! 🔔",
        `Admin has linked your found "${foundRep.itemName}" to a lost item. Chat is now available!`,
        "approval"
    );

    alert(`Item match approved! Direct chat unlocked between ${userLost?.name || "Lost Reporter"} and ${userFound?.name || "Found Finder"}.`);
    
    // Refresh Admin dashboard views
    renderLinkReportsUI();
    if (typeof loadDashboardContent === "function") {
        loadDashboardContent();
    }
}
