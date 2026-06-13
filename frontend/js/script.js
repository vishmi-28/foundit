// =========================
// MAIN ENTRY POINT
// =========================

document.addEventListener("DOMContentLoaded", () => {
    setupNavbar();
    setupReportForm();
    loadHomepageRecentItems();
});

// =========================
// NAVBAR HAMBURGER TOGGLE
// =========================

function setupNavbar() {
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.querySelector(".nav-links");

    menuToggle?.addEventListener("click", () => {
        navLinks?.classList.toggle("active");
    });
}

// =========================
// HOMEPAGE RECENT ITEMS
// =========================

function loadHomepageRecentItems() {
    const grid = document.querySelector(".recent-items .items-grid");
    if (!grid) return;

    const reports = loadData("reports");
    
    // Filter out returned items and sort newest first
    const activeReports = reports.filter(r => r.status !== "Returned");
    const latest = activeReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

    if (latest.length === 0) return; // Keep static items if empty

    grid.innerHTML = "";

    latest.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";
        card.innerHTML = `
            <span class="tag ${item.reportType === "Lost Item" ? "lost" : "found"}">${item.reportType === "Lost Item" ? "LOST" : "FOUND"}</span>
            <img src="${item.image || 'images/no-image.png'}" alt="${item.itemName}">
            <h3>${item.itemName}</h3>
            <p style="text-align:center; color:#64748b; font-size:15px; margin-bottom:8px;">📍 ${item.location}</p>
        `;
        card.style.cursor = "pointer";
        card.onclick = () => {
            window.location.href = "browse.html";
        };
        grid.appendChild(card);
    });
}

// =========================
// REPORT FORM (ADD + EDIT)
// =========================

function setupReportForm() {
    const form = document.getElementById("reportForm");
    if (!form) return;

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    const editItem = JSON.parse(localStorage.getItem("editItem"));

    // Check if editing
    if (editItem) {
        document.querySelector(".report-section h1").textContent = "Edit Report";
        document.getElementById("title").value = editItem.itemName;
        document.getElementById("location").value = editItem.location;
        document.getElementById("category").value = editItem.category;
        document.getElementById("type").value = editItem.reportType === "Lost Item" ? "lost" : "found";
        document.getElementById("description").value = editItem.description;
        
        const btn = form.querySelector("button[type='submit']");
        if (btn) btn.textContent = "Update Report";
    } else {
        // Check query parameters to pre-set Type (e.g. ?type=lost or ?type=found)
        const urlParams = new URLSearchParams(window.location.search);
        const preType = urlParams.get("type");
        if (preType) {
            document.getElementById("type").value = preType;
        }
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const imageInput = document.getElementById("image");
        const itemName = document.getElementById("title").value.trim();
        const location = document.getElementById("location").value.trim();
        const category = document.getElementById("category").value;
        const typeSelect = document.getElementById("type").value;
        const description = document.getElementById("description").value.trim();

        const reportType = typeSelect === "lost" ? "Lost Item" : "Found Item";
        const status = typeSelect === "lost" ? "Lost" : "Found";

        // Save report operation helper
        const processSave = (base64Image) => {
            let reports = loadData("reports");

            const finalImage = base64Image || (editItem ? editItem.image : getDefaultCategoryImage(category));

            const reportData = {
                reportId: editItem ? editItem.reportId : "rep_" + Date.now(),
                itemName,
                category,
                image: finalImage,
                description,
                location,
                date: editItem ? editItem.date : new Date().toISOString().split("T")[0],
                status: editItem ? editItem.status : status,
                reportType,
                reporterId: editItem ? editItem.reporterId : currentUser.id,
                adminId: editItem ? editItem.adminId : "usr_admin",
                createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
                linkedReportId: editItem ? editItem.linkedReportId : null
            };

            if (editItem) {
                const idx = reports.findIndex(r => r.reportId === editItem.reportId);
                if (idx !== -1) {
                    reports[idx] = reportData;
                }
                localStorage.removeItem("editItem");
            } else {
                reports.push(reportData);
                
                // Notify admin about new report
                createNotification(
                    "usr_admin",
                    "New Report Submitted 📑",
                    `User ${currentUser.name} reported "${itemName}" as ${status}.`,
                    "report"
                );
            }

            saveData("reports", reports);

            alert(editItem ? "Report updated successfully!" : "Report submitted successfully!");
            window.location.href = "browse.html";
        };

        // If file uploaded, convert to Base64. Else, run processSave directly.
        if (imageInput?.files?.[0]) {
            const file = imageInput.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                processSave(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            processSave(null);
        }
    });
}

// Fallback category images from available resources
function getDefaultCategoryImage(category) {
    switch (category) {
        case "Electronics":
            return "images/phone.jpg";
        case "Wallet":
            return "images/wallet.jpg";
        case "Keys":
            return "images/keys.jpeg";
        case "ID Card":
            return "images/idcard.jpg";
        case "Bag":
        default:
            return "images/bottle.jpg";
    }
}

// Global Toast Popup Helper
function showToast(title, message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast-popup toast-${type}`;
    toast.innerHTML = `
        <div class="toast-header">
            <strong>${title}</strong>
            <span class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
        </div>
        <div class="toast-body">${message}</div>
    `;
    document.body.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}