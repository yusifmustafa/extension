const MENU_ID = "tour_collector_copy";

let tokenRefreshInterval = null;

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(
        {
            entries: [],
            auth: {
                token: null,
                refreshToken: null,
                type: null,
                username: null,
                id: null,
            },
        },
        (data) => {
            const init = {
                entries: data.entries || [],
                auth: data.auth || {
                    token: null,
                    refreshToken: null,
                    type: null,
                    username: null,
                    id: null,
                },
                apiUrl: data.apiUrl || "http://49.12.130.247:9281/api/v1/auth/login",
                insertUrl:
                    data.insertUrl ||
                    "http://49.12.130.247:9281/api/v1/tour-package/tour",
            };
            chrome.storage.local.set(init);

            startTokenRefreshInterval();
        }
    );

    chrome.contextMenus.create({
        id: MENU_ID,
        title: "📋 Smart Kopyala",
        contexts: ["page", "all"],
        documentUrlPatterns: [
            "*://*.summertour.az/*",
            "*://*.kompastour.az/*",
            "*://*.online.pashaholidays.az/*",
            "*://*.online.voyagergroup.az/*",
            "*://*.online.voyagergroup.kg/search_tour/*",
            "*://*.kazunion.com/*",
            "*://*.prestigetravel-az.com/*",
            "*://*.fstravel.asia/*",
            "*://*.online.aviadesk.com/*",
        ],
    });

    console.log("✅ Context menu created");
});

function startTokenRefreshInterval() {
    if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
    }

    tokenRefreshInterval = setInterval(async () => {
        await checkAndRefreshToken();
    }, 30000);

    console.log("✅ Token refresh interval started");
}

async function checkAndRefreshToken() {
    try {
        const { auth } = await chrome.storage.local.get({ auth: {} });

        if (!auth.token || !auth.refreshToken) {
            return;
        }

        const tokenPayload = parseJwt(auth.token);

        if (!tokenPayload || !tokenPayload.exp) {
            console.warn("⚠️ Token parse edilə bilmədi");
            return;
        }

        const expirationDate = tokenPayload.exp * 1000;
        const timeLeft = expirationDate - Date.now();

        if (timeLeft <= 60000) {
            console.log("🔄 Token yenilənir...");
            await refreshToken();
        }
    } catch (error) {
        console.error("❌ Token yoxlanma xətası:", error);
    }
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("❌ JWT parse xətası:", error);
        return null;
    }
}

async function refreshToken() {
    try {
        const { auth } = await chrome.storage.local.get({ auth: {} });

        if (!auth.refreshToken) {
            console.warn("⚠️ Refresh token yoxdur");
            return null;
        }

        const response = await fetch("http://49.12.130.247:9281/api/v1/auth/refresh-token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": auth.refreshToken,
            },
        });

        if (!response.ok) {
            throw new Error(`Token yeniləmə uğursuz oldu: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.refreshToken) {
            const updatedAuth = {
                ...auth,
                token: data.token,
                refreshToken: data.refreshToken,
            };

            await chrome.storage.local.set({ auth: updatedAuth });
            console.log("✅ Token uğurla yeniləndi");
            return data.token;
        } else {
            throw new Error("Yanlış refresh token cavabı");
        }
    } catch (error) {
        console.error("❌ Token yeniləmə xətası:", error);

        await chrome.storage.local.set({
            auth: {
                token: null,
                refreshToken: null,
                type: null,
                username: null,
                id: null,
            }
        });

        return null;
    }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log("🖱️ Context menu clicked:", info.menuItemId);

    if (info.menuItemId !== MENU_ID) return;
    if (!tab || !tab.id) return;

    console.log("📤 Sending collectSelected message to tab:", tab.id);

    chrome.tabs.sendMessage(
        tab.id,
        {
            type: "collectSelected",
            url: tab.url,
        },
        (resp) => {
            if (chrome.runtime.lastError) {
                console.error("❌ Error:", chrome.runtime.lastError.message);
                return;
            }

            console.log("📥 Response from content script:", resp);

            if (!resp || !Array.isArray(resp.items) || !resp.items.length) {
                chrome.tabs.sendMessage(tab.id, {
                    type: "showError",
                    message: "Heç bir təklif seçilməyib. Checkbox ilə seçin!",
                });
                return;
            }

            console.log(
                "✅ Showing tracking dialog with",
                resp.items.length,
                "items"
            );

            chrome.tabs.sendMessage(tab.id, {
                type: "showTrackingDialog",
                items: resp.items,
                url: resp.url,
            });
        }
    );
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("📨 Background received message:", msg.type);

    if (msg.type === "insertTours") {
        const currentUrl = sender.tab?.url;

        insertToursToAPI(msg.applicationLeadId, msg.items, currentUrl)
            .then((result) => {
                console.log("✅ API success:", result);
                sendResponse({success: true, result});
            })
            .catch((error) => {
                console.error("❌ API error:", error);
                sendResponse({success: false, error: error.message});
            });
        return true;
    }

    if (msg.type === "fetchApplicationLeads") {
        console.log("🔍 Fetching application leads for query:", msg.query);

        fetchApplicationLeadsFromAPI(msg.query)
            .then((data) => {
                console.log("✅ Application Leads fetched:", data);
                sendResponse({success: true, data});
            })
            .catch((error) => {
                console.error("❌ Fetch error:", error);
                sendResponse({success: false, error: error.message});
            });
        return true;
    }

    if (msg.type === "refreshToken") {
        refreshToken()
            .then((token) => {
                sendResponse({ success: true, token });
            })
            .catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

async function fetchApplicationLeadsFromAPI(query) {
    console.log("🚀 Fetching application leads...");

    let { auth } = await chrome.storage.local.get({ auth: {} });

    if (!auth.token) {
        throw new Error("Token yoxdur! Zəhmət olmasa login olun.");
    }

    const apiUrl = `http://49.12.130.247:9281/api/v1/tour-package/application-leads?title=${encodeURIComponent(
        query
    )}`;

    console.log("📤 API URL:", apiUrl);

    let response = await fetch(apiUrl, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `${auth.type || "Bearer"} ${auth.token}`,
        },
    });

    if (response.status === 401) {
        console.log("🔄 Token bitib, yenilənir...");
        const newToken = await refreshToken();

        if (!newToken) {
            throw new Error("Token yenilənə bilmədi");
        }

        const { auth: updatedAuth } = await chrome.storage.local.get({ auth: {} });
        response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `${updatedAuth.type || "Bearer"} ${updatedAuth.token}`,
            },
        });
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(`API xətası: ${response.status}`);
    }

    const data = await response.json();
    console.log("📥 Application Leads Data:", data);

    return data;
}

async function insertToursToAPI(applicationLeadId, items, url) {
    console.log("🚀 Inserting tours to API...");

    let { auth, insertUrl } = await chrome.storage.local.get({
        auth: {},
        insertUrl: "http://49.12.130.247:9281/api/v1/tour-package/tour",
    });

    if (!auth.token) {
        console.warn("⚠️ Token yoxdur! Popup açılır...");
        chrome.action.openPopup();
        throw new Error("Token yoxdur! Zəhmət olmasa login olun.");
    }

    const domain = new URL(url).hostname.replace("www.", "");

    const payload = {
        empId: auth.id,
        applicationLeadId: Number(applicationLeadId),
        link: domain,
        tours: items,
    };

    console.log("📤 FULL PAYLOAD:", JSON.stringify(payload, null, 2));

    let response = await fetch(insertUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `${auth.type || "Bearer"} ${auth.token}`,
        },
        body: JSON.stringify(payload),
    });

    if (response.status === 401) {
        console.log("🔄 Token bitib, yenilənir...");
        const newToken = await refreshToken();

        if (!newToken) {
            throw new Error("Token yenilənə bilmədi");
        }

        const { auth: updatedAuth } = await chrome.storage.local.get({ auth: {} });
        response = await fetch(insertUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `${updatedAuth.type || "Bearer"} ${updatedAuth.token}`,
            },
            body: JSON.stringify(payload),
        });
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(`API xətası: ${response.status} - ${errorText}`);
    }

    const contentType = response.headers.get("content-type");
    console.log("📥 Response Content-Type:", contentType);

    const text = await response.text();
    console.log("📥 Response Text:", text);

    if (!text || text.trim() === "") {
        console.log("✅ Empty response, assuming success");
        return {success: true, message: "API uğurla qəbul etdi"};
    }

    try {
        const result = JSON.parse(text);
        console.log("✅ API Response:", result);

        const {entries} = await chrome.storage.local.get({entries: []});
        items.forEach((item) => entries.push(item));
        await chrome.storage.local.set({entries});

        return result;
    } catch (e) {
        console.error("❌ JSON Parse Error:", e);
        throw new Error(`JSON parse xətası: ${text.substring(0, 100)}...`);
    }
}

startTokenRefreshInterval();