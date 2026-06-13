// =========================
// AUTHENTICATION SYSTEM
// =========================

// Check authentication on page load
document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    updateNavbar();
    setupAuthForms();
});

// Protect private pages
function checkAuth() {
    const path = window.location.pathname;
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    if (path.includes("dashboard.html") || path.includes("report.html")) {
        if (!currentUser) {
            // Store redirect URL if they wanted to do something specific
            if (window.location.search) {
                localStorage.setItem("authRedirect", window.location.pathname + window.location.search);
            } else {
                localStorage.setItem("authRedirect", window.location.pathname);
            }
            alert("Please login first!");
            window.location.href = "login.html";
            return false;
        }
    }
    
    // Auto-redirect if already logged in and visiting login page
    if (path.includes("login.html") && currentUser) {
        window.location.href = "dashboard.html";
        return false;
    }
    
    return true;
}

// Re-render role-based navbar
function updateNavbar() {
    const navLinks = document.querySelector(".nav-links");
    if (!navLinks) return;

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    // Normalize href paths (strip leading slashes if any for local files)
    navLinks.querySelectorAll("a").forEach(link => {
        let href = link.getAttribute("href");
        if (href && href.startsWith("/")) {
            link.setAttribute("href", href.substring(1));
        }
    });

    const dashboardLink = Array.from(navLinks.querySelectorAll("a")).find(a => a.getAttribute("href").includes("dashboard.html"));
    const loginLink = navLinks.querySelector(".login-btn") || navLinks.querySelector(".logout-btn");

    if (currentUser) {
        // Role-based title
        if (dashboardLink) {
            dashboardLink.textContent = currentUser.role === "Admin" ? "Admin Dashboard" : "Dashboard";
        }

        // Notification badge insertion if not present
        if (!navLinks.querySelector(".notification-item")) {
            const notifLi = document.createElement("li");
            notifLi.className = "notification-item";
            
            // Safe fetch count (fallback to 0 if notifications.js is not loaded yet)
            let badgeCount = 0;
            if (typeof getUnreadNotificationCount === "function") {
                badgeCount = getUnreadNotificationCount();
            } else {
                const notifs = JSON.parse(localStorage.getItem("notifications")) || [];
                badgeCount = notifs.filter(n => n.userId === currentUser.id && !n.read).length;
            }

            notifLi.innerHTML = `
                <a href="dashboard.html?tab=notifications" class="notification-link" style="position:relative; display:inline-flex; align-items:center;">
                    🔔
                    <span id="navNotificationBadge" class="nav-badge" style="${badgeCount > 0 ? '' : 'display:none;'}">${badgeCount}</span>
                </a>
            `;
            
            // Insert before the last list item (Login/Logout button)
            if (loginLink) {
                navLinks.insertBefore(notifLi, loginLink.parentElement);
            } else {
                navLinks.appendChild(notifLi);
            }
        } else {
            // Update badge count if already present
            const badge = document.getElementById("navNotificationBadge");
            if (badge) {
                let badgeCount = 0;
                if (typeof getUnreadNotificationCount === "function") {
                    badgeCount = getUnreadNotificationCount();
                } else {
                    const notifs = JSON.parse(localStorage.getItem("notifications")) || [];
                    badgeCount = notifs.filter(n => n.userId === currentUser.id && !n.read).length;
                }
                badge.textContent = badgeCount;
                badge.style.display = badgeCount > 0 ? "" : "none";
            }
        }

        // Login -> Logout button conversion
        if (loginLink) {
            loginLink.textContent = "Logout";
            loginLink.href = "#";
            loginLink.className = "logout-btn"; // styled via css extension or inline
            
            // Remove old listeners by cloning and replacing
            const newLogout = loginLink.cloneNode(true);
            loginLink.parentNode.replaceChild(newLogout, loginLink);
            
            newLogout.addEventListener("click", (e) => {
                e.preventDefault();
                logout();
            });
        }
    } else {
        // Logged out navbar state
        if (dashboardLink) {
            dashboardLink.textContent = "Dashboard";
        }
        
        const notifItem = navLinks.querySelector(".notification-item");
        if (notifItem) notifItem.remove();

        if (loginLink) {
            loginLink.textContent = "Login";
            loginLink.href = "login.html";
            loginLink.className = "login-btn";
        }
    }
}

// Logout session
function logout() {
    localStorage.removeItem("currentUser");
    alert("Logged out successfully!");
    window.location.href = "login.html";
}

// Setup login and signup forms
function setupAuthForms() {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    if (!loginForm && !signupForm) return;

    const loginToggle = document.getElementById("loginToggle");
    const signupToggle = document.getElementById("signupToggle");

    // Toggle Form visibility
    loginToggle?.addEventListener("click", () => {
        loginForm.classList.remove("hidden-form");
        signupForm.classList.add("hidden-form");
        loginToggle.classList.add("active-toggle");
        signupToggle.classList.remove("active-toggle");
    });

    signupToggle?.addEventListener("click", () => {
        signupForm.classList.remove("hidden-form");
        loginForm.classList.add("hidden-form");
        signupToggle.classList.add("active-toggle");
        loginToggle.classList.remove("active-toggle");
    });

    // Handle Login Submit
    loginForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;

        const users = loadData("users");
        const matchedUser = users.find(u => u.email === email && u.password === password);

        if (!matchedUser) {
            alert("Invalid email or password!");
            return;
        }

        // Set session
        localStorage.setItem("currentUser", JSON.stringify(matchedUser));

        alert(`Welcome back, ${matchedUser.name}!`);

        // Check if there was a page redirect saved
        const redirect = localStorage.getItem("authRedirect");
        if (redirect) {
            localStorage.removeItem("authRedirect");
            window.location.href = redirect;
        } else {
            window.location.href = "dashboard.html";
        }
    });

    // Handle Signup Submit
    signupForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("signupName").value.trim();
        const email = document.getElementById("signupEmail").value.trim().toLowerCase();
        const password = document.getElementById("signupPassword").value;

        const users = loadData("users");
        if (users.some(u => u.email === email)) {
            alert("A user with this email address already exists!");
            return;
        }

        // Create new user (Role defaults to "User")
        const newUser = {
            id: "usr_" + Date.now(),
            name,
            email,
            password,
            role: "User"
        };

        users.push(newUser);
        saveData("users", users);

        alert("Account created successfully! Please login.");
        
        // Switch to login form
        loginForm.classList.remove("hidden-form");
        signupForm.classList.add("hidden-form");
        loginToggle?.classList.add("active-toggle");
        signupToggle?.classList.remove("active-toggle");
    });
}
