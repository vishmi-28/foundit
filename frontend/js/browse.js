// =========================
// BROWSE PAGE LOGIC
// =========================

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    if (!path.includes("browse.html")) return;

    setupBrowseFilters();
    loadBrowseItems();
});

// Setup dynamic filters in browse page
function setupBrowseFilters() {
    const filterContainer = document.querySelector(".search-filter-container");
    if (!filterContainer) return;

    // 1. Add "Returned" to status select dynamically
    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter && !statusFilter.querySelector('option[value="returned"]')) {
        const returnedOpt = document.createElement("option");
        returnedOpt.value = "returned";
        returnedOpt.textContent = "Returned";
        statusFilter.appendChild(returnedOpt);
    }

    // 2. Add "Report Type" dropdown dynamically
    if (!document.getElementById("reportTypeFilter")) {
        const typeSelect = document.createElement("select");
        typeSelect.className = "filter";
        typeSelect.id = "reportTypeFilter";
        typeSelect.innerHTML = `
            <option value="all">All Types</option>
            <option value="Lost Item">Lost Items</option>
            <option value="Found Item">Found Items</option>
        `;
        filterContainer.appendChild(typeSelect);
    }

    // 3. Attach listeners to all inputs
    const inputs = [
        document.getElementById("searchInput"),
        document.getElementById("categoryFilter"),
        document.getElementById("locationFilter"),
        document.getElementById("statusFilter"),
        document.getElementById("reportTypeFilter")
    ];

    inputs.forEach(input => {
        input?.addEventListener("change", filterBrowseItems);
        input?.addEventListener("input", filterBrowseItems);
    });
}

// Load items from local storage
function loadBrowseItems() {
    const reports = loadData("reports");
    
    // Sort newest first by default
    const sortedReports = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    window.allBrowseReports = sortedReports;

    displayBrowseItems(sortedReports);
}

// Filter reports lists based on input conditions
function filterBrowseItems() {
    const searchVal = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const categoryVal = document.getElementById("categoryFilter")?.value || "all";
    const locationVal = document.getElementById("locationFilter")?.value || "all";
    const statusVal = document.getElementById("statusFilter")?.value || "all";
    const typeVal = document.getElementById("reportTypeFilter")?.value || "all";

    let filtered = window.allBrowseReports || [];

    // Search query filter
    if (searchVal) {
        filtered = filtered.filter(item => 
            item.itemName.toLowerCase().includes(searchVal) ||
            item.location.toLowerCase().includes(searchVal) ||
            item.description.toLowerCase().includes(searchVal) ||
            item.category.toLowerCase().includes(searchVal)
        );
    }

    // Category filter map
    if (categoryVal !== "all") {
        filtered = filtered.filter(item => {
            const cat = item.category.toLowerCase();
            if (categoryVal === "electronics" && cat === "electronics") return true;
            if (categoryVal === "wallets" && cat === "wallet") return true;
            if (categoryVal === "keys" && cat === "keys") return true;
            if (categoryVal === "idcards" && cat === "id card") return true;
            if (categoryVal === "bags" && cat === "bag") return true;
            return false;
        });
    }

    // Location filter map
    if (locationVal !== "all") {
        filtered = filtered.filter(item => {
            const loc = item.location.toLowerCase();
            return loc.includes(locationVal);
        });
    }

    // Status filter
    if (statusVal !== "all") {
        filtered = filtered.filter(item => item.status.toLowerCase() === statusVal);
    }

    // Report Type filter
    if (typeVal !== "all") {
        filtered = filtered.filter(item => item.reportType === typeVal);
    }

    displayBrowseItems(filtered);
}

// Populate HTML grid with cards
function displayBrowseItems(items) {
    const grid = document.getElementById("itemsGrid");
    if (!grid) return;

    grid.innerHTML = "";

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-wrapper" style="grid-column: 1/-1; text-align: center; padding: 50px 20px;">
                <i class="fa-solid fa-folder-open" style="font-size: 50px; color: #cbd5e1; margin-bottom: 15px;"></i>
                <h3 style="color:#0B2E4E; margin-bottom:8px;">No Items Found</h3>
                <p style="color:#64748b;">Try adjusting your keywords or filter parameters.</p>
            </div>
        `;
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";

        const isOwnerOrAdmin = currentUser && ((currentUser.role === "Admin") || (item.reporterId === currentUser.id));
        const userDisplayId = item.reporterId;
        const adminDisplayId = item.adminId || "usr_admin";

        card.innerHTML = `
            <!-- Lost/Found Badge -->
            <span class="tag ${item.reportType === "Lost Item" ? "lost" : "found"}">${item.reportType.toUpperCase()}</span>
            
            <img src="${item.image || 'images/no-image.png'}" alt="${item.itemName}">
            
            <div class="item-info">
                <h3>${item.itemName}</h3>
                <p class="location">📍 ${item.location}</p>
                <p style="text-align:center; color:#64748b; font-size:14px; margin-bottom:10px;">${item.category}</p>
                <p class="description-preview" style="text-align:center; color:#475569; font-size:14px; margin-bottom:15px; height: 40px; overflow: hidden; text-overflow: ellipsis;">${item.description}</p>
                <p class="date">📅 ${item.date}</p>
                
                <!-- Status Badge -->
                <div style="margin-bottom:15px; text-align:center;">
                    <span class="status ${item.status.toLowerCase()}">${item.status.toUpperCase()}</span>
                </div>
                
                <!-- User ID & Admin ID -->
                <div class="card-meta-ids" style="font-size:12px; color:#64748b; margin-bottom:15px; border-top:1px solid #f1f5f9; padding-top:10px; text-align:left;">
                    <div style="margin-bottom:4px;"><strong>User ID:</strong> <code>${userDisplayId}</code></div>
                    <div><strong>Admin ID:</strong> <code>${adminDisplayId}</code></div>
                </div>

                <button class="details-btn">View Details</button>
                
                <!-- Actions -->
                <div class="card-actions">
                    <button class="chat-btn"><i class="fa-solid fa-comments"></i> Chat</button>
                    ${isOwnerOrAdmin ? `<button class="edit-btn">Edit</button>` : ""}
                    ${isOwnerOrAdmin ? `<button class="delete-btn">Delete</button>` : ""}
                </div>
            </div>
        `;

        // 1. Details view
        card.querySelector(".details-btn").addEventListener("click", () => {
            openBrowseModal(item);
        });

        // 2. Chat trigger
        card.querySelector(".chat-btn").addEventListener("click", () => {
            if (!currentUser) {
                alert("Please login first to chat about items!");
                window.location.href = "login.html";
                return;
            }

            // Chat access check
            if (item.status === "Returned") {
                alert("This item has already been marked as returned.");
                return;
            }

            // If owner clicks chat on their own item
            if (item.reporterId === currentUser.id) {
                openDirectReportChat(item.reportId);
                return;
            }

            // If current user is Admin
            if (currentUser.role === "Admin") {
                if (item.linkedReportId) {
                    // Linked chat
                    const chatId = `chat_link_${item.reportType === "Lost Item" ? item.reportId : item.linkedReportId}_${item.reportType === "Found Item" ? item.reportId : item.linkedReportId}`;
                    activeChatId = chatId;
                } else {
                    // Direct chat between reporter and admin
                    activeChatId = `chat_report_${item.reportId}_${item.reporterId}`;
                }
                window.location.href = "dashboard.html?tab=chats";
                return;
            }

            // If regular user clicks chat on someone else's item
            // Check if Admin has linked the reports already!
            if (item.linkedReportId) {
                const reports = loadData("reports");
                const linkedRep = reports.find(r => r.reportId === item.linkedReportId);
                // If the logged in user is the reporter of the linked item, they can access the direct linked chat!
                if (linkedRep && linkedRep.reporterId === currentUser.id) {
                    const lostId = item.reportType === "Lost Item" ? item.reportId : item.linkedReportId;
                    const foundId = item.reportType === "Found Item" ? item.reportId : item.linkedReportId;
                    const chatId = `chat_link_${lostId}_${foundId}`;
                    activeChatId = chatId;
                    window.location.href = "dashboard.html?tab=chats";
                    return;
                }
            }

            // Otherwise, user contacts Admin about this report
            openDirectReportChat(item.reportId);
        });

        // 3. Edit trigger
        if (isOwnerOrAdmin) {
            card.querySelector(".edit-btn").addEventListener("click", () => {
                localStorage.setItem("editItem", JSON.stringify(item));
                window.location.href = "report.html";
            });

            // 4. Delete trigger
            card.querySelector(".delete-btn").addEventListener("click", () => {
                if (!confirm("Are you sure you want to permanently delete this report?")) return;
                deleteData("reports", item.reportId, "reportId");
                
                // Clear linked chats/messages
                let messages = loadData("messages");
                messages = messages.filter(m => m.reportId !== item.reportId);
                saveData("messages", messages);

                alert("Report deleted successfully.");
                loadBrowseItems();
            });
        }

        grid.appendChild(card);
    });
}

// Detail modal display
function openBrowseModal(item) {
    const modal = document.getElementById("itemModal");
    if (!modal) return;

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
