const MENU_ID = "tour_collector_copy";

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
      "*://*.kazunion.com/*",
      "*://*.prestigetravel-az.com/*",
      "*://*.fstravel.asia/*",
    ],
  });

  console.log("✅ Context menu created");
});

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
    const currentUrl = sender.tab?.url; // ← URL buradan alınır

    insertToursToAPI(msg.applicationLeadId, msg.items, currentUrl)
      .then((result) => {
        console.log("✅ API success:", result);
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        console.error("❌ API error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function insertToursToAPI(applicationLeadId, items, url) {
  console.log("🚀 Inserting tours to API...");

  const { auth, insertUrl } = await chrome.storage.local.get({
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

  const response = await fetch(insertUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${auth.type || "Bearer"} ${auth.token}`,
    },
    body: JSON.stringify(payload),
  });

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
    return { success: true, message: "API uğurla qəbul etdi" };
  }

  try {
    const result = JSON.parse(text);
    console.log("✅ API Response:", result);

    const { entries } = await chrome.storage.local.get({ entries: [] });
    items.forEach((item) => entries.push(item));
    await chrome.storage.local.set({ entries });

    return result;
  } catch (e) {
    console.error("❌ JSON Parse Error:", e);
    throw new Error(`JSON parse xətası: ${text.substring(0, 100)}...`);
  }
}
