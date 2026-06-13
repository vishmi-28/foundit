// =========================
// STORAGE UTILITIES
// =========================

function loadData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Error loading data from Local Storage", e);
        return [];
    }
}

function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Error saving data to Local Storage", e);
    }
}

function updateData(key, item, identifier = "id") {
    const data = loadData(key);
    const index = data.findIndex(x => x[identifier] === item[identifier]);
    if (index !== -1) {
        data[index] = item;
        saveData(key, data);
        return true;
    }
    return false;
}

function deleteData(key, idValue, identifier = "id") {
    let data = loadData(key);
    data = data.filter(x => x[identifier] !== idValue);
    saveData(key, data);
}

// =========================
// DEMO DATA SEEDING
// =========================

function seedDemoData() {
    // 1. Seed Users
    let users = loadData("users");
    if (users.length === 0) {
        users = [
            {
                id: "usr_admin",
                name: "System Admin",
                email: "admin@foundit.com",
                password: "admin123",
                role: "Admin"
            },
            {
                id: "usr_demo_1",
                name: "Jane Doe",
                email: "user@foundit.com",
                password: "user123",
                role: "User"
            },
            {
                id: "usr_demo_2",
                name: "Bob Smith",
                email: "user2@foundit.com",
                password: "user123",
                role: "User"
            }
        ];
        saveData("users", users);
    }

    // 2. Seed Reports
    let reports = loadData("reports");
    if (reports.length === 0) {
        reports = [
            {
                reportId: "rep_demo_1",
                itemName: "Bottle",
                category: "Bag",
                image: "images/bottle.jpg",
                description: "Translucent water bottle left behind.",
                location: "College Canteen",
                date: "2026-06-11",
                status: "Lost",
                reportType: "Lost Item",
                reporterId: "usr_demo_1",
                adminId: "usr_admin",
                createdAt: new Date("2026-06-11T10:00:00Z").toISOString(),
                linkedReportId: null
            },
            {
                reportId: "rep_demo_2",
                itemName: "Watch",
                category: "Electronics",
                image: "images/watch.jpg",
                description: "Silver wrist watch found on library table.",
                location: "Library",
                date: "2026-06-12",
                status: "Found",
                reportType: "Found Item",
                reporterId: "usr_demo_2",
                adminId: "usr_admin",
                createdAt: new Date("2026-06-12T11:00:00Z").toISOString(),
                linkedReportId: null
            },
            {
                reportId: "rep_demo_3",
                itemName: "Camera",
                category: "Electronics",
                image: "images/camera.jpg",
                description: "DSLR camera found near the back rows.",
                location: "Main Auditorium",
                date: "2026-06-12",
                status: "Found",
                reportType: "Found Item",
                reporterId: "usr_demo_2",
                adminId: "usr_admin",
                createdAt: new Date("2026-06-12T14:30:00Z").toISOString(),
                linkedReportId: null
            },
            {
                reportId: "rep_demo_4",
                itemName: "Pendrive",
                category: "Electronics",
                image: "images/pendrive.jpg",
                description: "Black 16GB USB drive lost during class.",
                location: "Computer Lab",
                date: "2026-06-10",
                status: "Lost",
                reportType: "Lost Item",
                reporterId: "usr_demo_1",
                adminId: "usr_admin",
                createdAt: new Date("2026-06-10T09:15:00Z").toISOString(),
                linkedReportId: null
            },
            {
                reportId: "rep_demo_5",
                itemName: "Keys",
                category: "Keys",
                image: "images/keys.jpeg",
                description: "Keychain with two house keys found on the pavement.",
                location: "Parking Area",
                date: "2026-06-12",
                status: "Found",
                reportType: "Found Item",
                reporterId: "usr_demo_2",
                adminId: "usr_admin",
                createdAt: new Date("2026-06-12T17:00:00Z").toISOString(),
                linkedReportId: null
            }
        ];
        saveData("reports", reports);
    }
}

// Automatically seed demo data
seedDemoData();
