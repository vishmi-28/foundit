// =========================
// INTERNAL CHAT SYSTEM
// =========================

let activeChatId = null;
let chatRefreshInterval = null;

// Retrieve all chat conversations for a given user
function getConversationsForUser(user) {
    const messages = loadData("messages");
    const reports = loadData("reports");
    const users = loadData("users");
    
    const conversations = {};

    messages.forEach(msg => {
        // Chat eligibility filter
        const isParticipant = (user.role === "Admin") || (msg.senderId === user.id) || (msg.receiverId === user.id);
        if (!isParticipant) return;

        const cid = msg.chatId;
        if (!conversations[cid]) {
            conversations[cid] = {
                chatId: cid,
                messages: [],
                lastMessage: null,
                otherParticipant: null,
                report: null,
                unreadCount: 0
            };
        }

        conversations[cid].messages.push(msg);
    });

    // Populate metadata for each conversation
    Object.keys(conversations).forEach(cid => {
        const conv = conversations[cid];
        // Sort messages chronologically
        conv.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        conv.lastMessage = conv.messages[conv.messages.length - 1];

        // Find report
        const firstMsg = conv.messages[0];
        conv.report = reports.find(r => r.reportId === firstMsg.reportId);

        // Find other participant name and avatar
        if (user.role === "Admin") {
            // Admin sees the chat participants
            // For linked chats, show the two users. For direct inquiries, show the user.
            if (cid.startsWith("chat_link_")) {
                const parts = cid.split("_");
                const rep1 = reports.find(r => r.reportId === parts[2]);
                const rep2 = reports.find(r => r.reportId === parts[3]);
                const u1 = users.find(u => u.id === rep1?.reporterId);
                const u2 = users.find(u => u.id === rep2?.reporterId);
                conv.otherParticipant = {
                    name: `${u1?.name || "User"} ↔ ${u2?.name || "User"}`,
                    role: "Linked Users",
                    avatar: "https://i.pravatar.cc/100?img=12"
                };
            } else {
                const otherId = firstMsg.senderId === "usr_admin" ? firstMsg.receiverId : firstMsg.senderId;
                const otherUser = users.find(u => u.id === otherId);
                conv.otherParticipant = {
                    name: otherUser?.name || "User",
                    role: otherUser?.role || "User",
                    avatar: `https://i.pravatar.cc/100?u=${otherId}`
                };
            }
        } else {
            // For regular users, find who they are talking to (Admin or linked User)
            let otherId = null;
            if (cid.startsWith("chat_link_")) {
                // Linked chat between User A and User B
                otherId = firstMsg.senderId === user.id ? firstMsg.receiverId : msgSender(conv.messages, user.id);
            } else {
                // Direct chat User <-> Admin
                otherId = firstMsg.senderId === user.id ? firstMsg.receiverId : firstMsg.senderId;
            }

            const otherUser = users.find(u => u.id === otherId);
            conv.otherParticipant = {
                name: otherUser?.name || "System Admin",
                role: otherUser?.role || "Admin",
                avatar: otherId === "usr_admin" ? "images/logo.png" : `https://i.pravatar.cc/100?u=${otherId}`
            };
        }

        // Count unread
        conv.unreadCount = conv.messages.filter(m => m.receiverId === user.id && !m.read).length;
    });

    return Object.values(conversations).sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
}

// Helper to find other sender in linked conversations
function msgSender(messages, currentUserId) {
    const otherMsg = messages.find(m => m.senderId !== currentUserId);
    return otherMsg ? otherMsg.senderId : "usr_admin";
}

// Initiate or open a chat with Admin about a report
function openDirectReportChat(reportId) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    const reports = loadData("reports");
    const report = reports.find(r => r.reportId === reportId);
    if (!report) return;

    // Chat between reporter/finder and Admin
    const chatId = `chat_report_${reportId}_${currentUser.id}`;

    // Seed initial message if no chat exists
    const messages = loadData("messages");
    const existing = messages.find(m => m.chatId === chatId);

    if (!existing) {
        const adminWelcome = {
            chatId,
            senderId: "usr_admin",
            receiverId: currentUser.id,
            message: `Hello! This is System Admin. Let's discuss your report: "${report.itemName}" (${report.reportType}). Please provide any verification details here.`,
            timestamp: new Date().toISOString(),
            reportId,
            read: false
        };
        messages.push(adminWelcome);
        saveData("messages", messages);
    }

    // Switch to chats tab and load this chat
    activeChatId = chatId;
    
    // Switch tab
    const chatTabButton = document.querySelector('[data-tab="chats"]');
    if (chatTabButton) {
        chatTabButton.click();
    }
    
    renderChatInterface();
}

// Send a new message
function sendMessage(chatId, messageText) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser || !messageText.trim()) return;

    const messages = loadData("messages");
    const chatMessages = messages.filter(m => m.chatId === chatId).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (chatMessages.length === 0) return;

    const referenceMsg = chatMessages[0];
    const reportId = referenceMsg.reportId;
    
    let receiverId = "usr_admin"; // Default target
    if (currentUser.role === "Admin") {
        // Admin replying. Check sender of previous messages.
        if (chatId.startsWith("chat_link_")) {
            // Linked chat. Admin posts to moderate, target user depends.
            // In linked chat, Admin can choose receiver, or by default it sends to both or lost reporter. Let's target the lost reporter.
            const parts = chatId.split("_");
            const reports = loadData("reports");
            const rep = reports.find(r => r.reportId === parts[2]);
            receiverId = rep ? rep.reporterId : referenceMsg.senderId;
        } else {
            // User to Admin. Admin replies to User.
            receiverId = referenceMsg.senderId === "usr_admin" ? referenceMsg.receiverId : referenceMsg.senderId;
        }
    } else {
        // User sending.
        if (chatId.startsWith("chat_link_")) {
            // User to User. Target is the other user.
            receiverId = chatMessages.find(m => m.senderId !== currentUser.id)?.senderId;
            if (!receiverId) {
                // fallback
                receiverId = referenceMsg.senderId === currentUser.id ? referenceMsg.receiverId : referenceMsg.senderId;
            }
        } else {
            // User to Admin.
            receiverId = "usr_admin";
        }
    }

    const newMessage = {
        chatId,
        senderId: currentUser.id,
        receiverId,
        message: messageText.trim(),
        timestamp: new Date().toISOString(),
        reportId,
        read: false
    };

    messages.push(newMessage);
    saveData("messages", messages);

    // Create notifications for the receiver
    createNotification(
        receiverId,
        `New Message from ${currentUser.name}`,
        `Regarding: "${referenceMsg.message.substring(0, 30)}..."`,
        "message"
    );

    // Refresh UI
    renderActiveChat();
    renderConversationsList();
}

// Mark messages inside a chat as read
function markChatAsRead(chatId, userId) {
    const messages = loadData("messages");
    let updated = false;
    messages.forEach(m => {
        if (m.chatId === chatId && m.receiverId === userId && !m.read) {
            m.read = true;
            updated = true;
        }
    });
    if (updated) {
        saveData("messages", messages);
        updateNotificationBadges();
    }
}

// Format timestamp beautifully
function formatChatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Render the entire chat container interface
function renderChatInterface() {
    const chatContainer = document.getElementById("chatDashboardContainer");
    if (!chatContainer) return;

    chatContainer.innerHTML = `
        <div class="chat-layout-wrapper">
            <!-- LEFT PANEL -->
            <div class="chat-left-panel">
                <div class="chat-panel-header">
                    <h3>Conversations</h3>
                </div>
                <div class="conversations-list" id="conversationsList">
                    <!-- Loaded dynamically -->
                </div>
            </div>
            
            <!-- RIGHT PANEL -->
            <div class="chat-right-panel" id="chatRightPanel">
                <!-- Loaded dynamically or empty state -->
                <div class="chat-empty-state">
                    <i class="fa-solid fa-comments"></i>
                    <h4>Select a conversation to start chatting</h4>
                    <p>Contact Admin or check linked match approvals.</p>
                </div>
            </div>
        </div>
    `;

    renderConversationsList();

    if (activeChatId) {
        selectConversation(activeChatId);
    }

    // Set polling for real-time updates
    if (chatRefreshInterval) clearInterval(chatRefreshInterval);
    chatRefreshInterval = setInterval(() => {
        if (activeChatId) {
            renderActiveChatSilent();
        }
        renderConversationsListSilent();
    }, 3000);
}

// Render Conversations List in Left Panel
function renderConversationsList() {
    const listContainer = document.getElementById("conversationsList");
    if (!listContainer) return;

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    const conversations = getConversationsForUser(currentUser);
    listContainer.innerHTML = "";

    if (conversations.length === 0) {
        listContainer.innerHTML = `<p class="no-chats-msg">No active conversations.</p>`;
        return;
    }

    conversations.forEach(conv => {
        const item = document.createElement("div");
        item.className = `conversation-item ${conv.chatId === activeChatId ? "active" : ""}`;
        item.onclick = () => selectConversation(conv.chatId);

        const unreadBadge = conv.unreadCount > 0 
            ? `<span class="chat-unread-badge">${conv.unreadCount}</span>` 
            : "";

        const statusClass = conv.report?.status === "Returned" ? "archived" : "online";
        const statusText = conv.report?.status === "Returned" ? "Archived" : "Online";

        item.innerHTML = `
            <div class="chat-avatar-wrapper">
                <img src="${conv.otherParticipant.avatar}" alt="Avatar">
                <span class="status-indicator ${statusClass}" title="${statusText}"></span>
            </div>
            <div class="conversation-info">
                <div class="conv-header">
                    <h4>${conv.otherParticipant.name}</h4>
                    <span class="chat-time">${formatChatTime(conv.lastMessage.timestamp)}</span>
                </div>
                <div class="conv-body">
                    <p>${conv.lastMessage.message}</p>
                    ${unreadBadge}
                </div>
                <span class="item-tag-ref">${conv.report ? conv.report.itemName : "General Inquiry"}</span>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// Quiet background updates for left panel
function renderConversationsListSilent() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    const conversations = getConversationsForUser(currentUser);
    const listContainer = document.getElementById("conversationsList");
    if (!listContainer) return;

    // We can rebuild list quietly
    const items = listContainer.querySelectorAll(".conversation-item");
    if (items.length !== conversations.length) {
        renderConversationsList();
        return;
    }

    conversations.forEach((conv, index) => {
        const item = items[index];
        if (!item) return;

        // Check if selected state differs
        const isActive = conv.chatId === activeChatId;
        if (isActive && !item.classList.contains("active")) {
            item.classList.add("active");
        } else if (!isActive && item.classList.contains("active")) {
            item.classList.remove("active");
        }

        // Update last message preview
        const p = item.querySelector(".conv-body p");
        if (p && p.textContent !== conv.lastMessage.message) {
            p.textContent = conv.lastMessage.message;
        }

        // Update time
        const time = item.querySelector(".chat-time");
        if (time) time.textContent = formatChatTime(conv.lastMessage.timestamp);

        // Update badge
        const badge = item.querySelector(".chat-unread-badge");
        if (conv.unreadCount > 0) {
            if (badge) {
                badge.textContent = conv.unreadCount;
            } else {
                const badgeSpan = document.createElement("span");
                badgeSpan.className = "chat-unread-badge";
                badgeSpan.textContent = conv.unreadCount;
                item.querySelector(".conv-body").appendChild(badgeSpan);
            }
        } else if (badge) {
            badge.remove();
        }
    });
}

// Select a conversation
function selectConversation(chatId) {
    activeChatId = chatId;
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (currentUser) {
        markChatAsRead(chatId, currentUser.id);
    }
    
    // Highlight in list
    const items = document.querySelectorAll(".conversation-item");
    items.forEach(item => {
        item.classList.remove("active");
    });
    
    // Render right panel
    renderActiveChat();
    renderConversationsListSilent();
}

// Render active chat history in right panel
function renderActiveChat() {
    const rightPanel = document.getElementById("chatRightPanel");
    if (!rightPanel || !activeChatId) return;

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    const messages = loadData("messages");
    const chatMessages = messages.filter(m => m.chatId === activeChatId).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (chatMessages.length === 0) return;

    const firstMsg = chatMessages[0];
    const reports = loadData("reports");
    const report = reports.find(r => r.reportId === firstMsg.reportId);
    const isArchived = report?.status === "Returned";

    // Find other participant
    const users = loadData("users");
    let otherParticipant = null;
    
    if (currentUser.role === "Admin" && activeChatId.startsWith("chat_link_")) {
        const parts = activeChatId.split("_");
        const r1 = reports.find(r => r.reportId === parts[2]);
        const r2 = reports.find(r => r.reportId === parts[3]);
        const u1 = users.find(u => u.id === r1?.reporterId);
        const u2 = users.find(u => u.id === r2?.reporterId);
        otherParticipant = {
            name: `${u1?.name || "User"} ↔ ${u2?.name || "User"} (Linked)`,
            role: "Linked Chat Moderation",
            avatar: "https://i.pravatar.cc/100?img=12"
        };
    } else {
        let otherId = null;
        if (activeChatId.startsWith("chat_link_")) {
            otherId = firstMsg.senderId === currentUser.id ? firstMsg.receiverId : msgSender(chatMessages, currentUser.id);
        } else {
            otherId = firstMsg.senderId === currentUser.id ? firstMsg.receiverId : firstMsg.senderId;
        }
        const otherUser = users.find(u => u.id === otherId);
        otherParticipant = {
            name: otherUser?.name || "System Admin",
            role: otherUser?.role || "Admin",
            avatar: otherId === "usr_admin" ? "images/logo.png" : `https://i.pravatar.cc/100?u=${otherId}`
        };
    }

    rightPanel.innerHTML = `
        <div class="chat-header">
            <div class="chat-header-profile">
                <img src="${otherParticipant.avatar}" alt="Avatar">
                <div>
                    <h4>${otherParticipant.name}</h4>
                    <span>${otherParticipant.role}</span>
                </div>
            </div>
            <div class="chat-header-actions" id="chatHeaderActions">
                <!-- Mod Actions added below if Admin -->
            </div>
        </div>
        
        <div class="chat-messages-container" id="chatMessagesContainer">
            <!-- Messages rendered below -->
        </div>
        
        <div class="chat-input-bar">
            ${isArchived 
                ? `<div class="chat-archived-bar">🔒 This chat is archived because the item has been marked as returned.</div>`
                : `
                    <input type="text" id="chatMessageInput" placeholder="Write a message...">
                    <button class="chat-send-btn" id="chatSendBtn"><i class="fa-solid fa-paper-plane"></i></button>
                  `
            }
        </div>
    `;

    // Setup Admin Header buttons
    const headerActions = document.getElementById("chatHeaderActions");
    if (currentUser.role === "Admin" && headerActions) {
        // Moderate Actions
        if (!isArchived) {
            headerActions.innerHTML = `
                <button class="chat-action-btn btn-resolve" title="Mark Resolved & Return Item"><i class="fa-solid fa-circle-check"></i> Resolve</button>
            `;
            headerActions.querySelector(".btn-resolve").addEventListener("click", () => {
                if (confirm("Are you sure you want to mark this item as Returned and archive this chat?")) {
                    resolveItemWorkflow(report.reportId);
                }
            });
        } else {
            headerActions.innerHTML = `<span class="status-badge status-returned">Returned</span>`;
        }
    }

    renderActiveChatMessages(chatMessages, currentUser);

    // Setup send actions
    const sendInput = document.getElementById("chatMessageInput");
    const sendBtn = document.getElementById("chatSendBtn");

    if (sendInput && sendBtn) {
        sendInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                sendMessage(activeChatId, sendInput.value);
                sendInput.value = "";
            }
        });
        sendBtn.addEventListener("click", () => {
            sendMessage(activeChatId, sendInput.value);
            sendInput.value = "";
        });
    }
}

// Render the actual list of message bubble elements
function renderActiveChatMessages(chatMessages, currentUser) {
    const container = document.getElementById("chatMessagesContainer");
    if (!container) return;

    container.innerHTML = "";

    chatMessages.forEach(msg => {
        const isOwn = msg.senderId === currentUser.id;
        const bubbleWrapper = document.createElement("div");
        bubbleWrapper.className = `message-bubble-wrapper ${isOwn ? "own" : "other"}`;

        // Message delete button for Admin moderation
        const deleteBtn = (currentUser.role === "Admin")
            ? `<span class="msg-delete-icon" onclick="deleteChatMessage('${msg.timestamp}')" title="Delete Message">&times;</span>`
            : "";

        const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        bubbleWrapper.innerHTML = `
            <div class="message-bubble">
                <p>${msg.message}</p>
                <span class="msg-time-badge">${formattedTime} ${deleteBtn}</span>
            </div>
        `;
        container.appendChild(bubbleWrapper);
    });

    // Auto scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Background silent refreshing of message content
function renderActiveChatSilent() {
    const container = document.getElementById("chatMessagesContainer");
    if (!container || !activeChatId) return;

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    const messages = loadData("messages");
    const chatMessages = messages.filter(m => m.chatId === activeChatId).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (chatMessages.length === 0) return;

    const bubbles = container.querySelectorAll(".message-bubble-wrapper");
    if (bubbles.length !== chatMessages.length) {
        // Something changed (e.g. message received or deleted), full re-render
        renderActiveChatMessages(chatMessages, currentUser);
        markChatAsRead(activeChatId, currentUser.id);
    }
}

// Admin message deletion
function deleteChatMessage(timestamp) {
    if (!confirm("Are you sure you want to delete this message?")) return;
    
    let messages = loadData("messages");
    messages = messages.filter(m => m.timestamp !== timestamp);
    saveData("messages", messages);

    if (activeChatId) {
        renderActiveChat();
    }
}

// Archive conversation and update report status to Returned
function resolveItemWorkflow(reportId) {
    let reports = loadData("reports");
    const reportIndex = reports.findIndex(r => r.reportId === reportId);
    if (reportIndex === -1) return;

    const report = reports[reportIndex];
    report.status = "Returned";
    reports[reportIndex] = report;
    saveData("reports", reports);

    // If linked matching reports exist, resolve the other report too!
    if (report.linkedReportId) {
        const linkedIndex = reports.findIndex(r => r.reportId === report.linkedReportId);
        if (linkedIndex !== -1) {
            reports[linkedIndex].status = "Returned";
            saveData("reports", reports);
        }
    }

    // Create notifications for the user(s)
    createNotification(
        report.reporterId,
        "Item Marked Returned 🎁",
        `Your report for "${report.itemName}" has been marked as Returned.`,
        "returned"
    );

    if (report.linkedReportId) {
        const linkedRep = reports.find(r => r.reportId === report.linkedReportId);
        if (linkedRep) {
            createNotification(
                linkedRep.reporterId,
                "Item Marked Returned 🎁",
                `The report for "${linkedRep.itemName}" has been marked as Returned.`,
                "returned"
            );
        }
    }

    alert("Item marked as Returned! Chat archived.");
    
    // Refresh active chat view
    renderActiveChat();
}

// Clean up polling interval on unload
window.addEventListener("unload", () => {
    if (chatRefreshInterval) clearInterval(chatRefreshInterval);
});
