// =========================
// NOTIFICATIONS SYSTEM
// =========================

// Retrieve notifications for the current user
function getNotificationsForUser(userId) {
    const notifications = loadData("notifications");
    return notifications.filter(n => n.userId === userId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Get count of unread notifications
function getUnreadNotificationCount() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return 0;

    const notifications = loadData("notifications");
    return notifications.filter(n => n.userId === currentUser.id && !n.read).length;
}

// Create a new notification
function createNotification(userId, title, message, type = "info") {
    const notifications = loadData("notifications");
    const newNotification = {
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        userId,
        title,
        message,
        type, // 'message', 'report', 'returned', 'approval', 'info'
        read: false,
        timestamp: new Date().toISOString()
    };

    notifications.push(newNotification);
    saveData("notifications", notifications);

    // Dynamic badge update
    updateNotificationBadges();

    // Trigger toast notification if dynamic
    if (typeof showToast === "function") {
        showToast(title, message, type);
    }
}

// Mark a single notification as read
function markNotificationAsRead(notifId) {
    const notifications = loadData("notifications");
    const notif = notifications.find(n => n.id === notifId);
    if (notif) {
        notif.read = true;
        saveData("notifications", notifications);
        updateNotificationBadges();
    }
}

// Mark all notifications as read
function markAllNotificationsAsRead(userId) {
    const notifications = loadData("notifications");
    let changed = false;
    notifications.forEach(n => {
        if (n.userId === userId && !n.read) {
            n.read = true;
            changed = true;
        }
    });
    if (changed) {
        saveData("notifications", notifications);
        updateNotificationBadges();
    }
}

// Delete a notification
function deleteNotification(notifId) {
    deleteData("notifications", notifId, "id");
    updateNotificationBadges();
}

// Update badges on UI
function updateNotificationBadges() {
    const count = getUnreadNotificationCount();
    
    // Navbar badge update
    const navBadge = document.getElementById("navNotificationBadge");
    if (navBadge) {
        navBadge.textContent = count;
        navBadge.style.display = count > 0 ? "" : "none";
    }

    // Dashboard tab badge update (if in dashboard page)
    const chatBadge = document.getElementById("chatBadge");
    if (chatBadge) {
        // Find unread messages count
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (currentUser) {
            const messages = loadData("messages");
            // Messages where receiver is current user and status is unread
            // Wait, let's count messages that have unread attribute if we implement it.
            // Let's fallback to unread messages count in storage
            const unreadMessagesCount = messages.filter(m => m.receiverId === currentUser.id && !m.read).length;
            chatBadge.textContent = unreadMessagesCount;
            chatBadge.style.display = unreadMessagesCount > 0 ? "inline-flex" : "none";
        }
    }
}

// Ensure badges update on load
document.addEventListener("DOMContentLoaded", () => {
    updateNotificationBadges();
});
