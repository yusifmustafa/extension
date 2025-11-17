const MENU_ID = "tour_collector_copy";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    {
      entries: [],
      auth: { token: null, refreshToken: null, type: null, username: null },
    },
    (data) => {
      const init = {
        entries: data.entries || [],
        auth: data.auth || {
          token: null,
          refreshToken: null,
          type: null,
          username: null,
        },
        apiUrl: data.apiUrl || "http://49.12.130.247:9282/api/auth/login",
        insertUrl:
          data.insertUrl || "http://49.12.130.247:9282/api/tours/insert",
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

  chrome.tabs.sendMessage(tab.id, { type: "collectSelected" }, (resp) => {
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

    console.log("✅ Showing tracking dialog with", resp.items.length, "items");

    chrome.tabs.sendMessage(tab.id, {
      type: "showTrackingDialog",
      items: resp.items,
    });
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📨 Background received message:", msg.type);

  if (msg.type === "insertTours") {
    insertToursToAPI(msg.applicationLeadId, msg.items)
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

async function insertToursToAPI(applicationLeadId, items) {
  console.log("🚀 Inserting tours to API...");

  const { auth, insertUrl } = await chrome.storage.local.get({
    auth: {},
    insertUrl: "http://49.12.130.247:9282/api/tours/insert",
  });

  // if (!auth.token) {
  //   throw new Error("Token yoxdur! Popup-dan login edin.");
  // }

  // ✅ Send structured payload with applicationLeadId
  const payload = {
    applicationLeadId: applicationLeadId,
    tours: items, // items is now an array of structured DTOs
  };

  console.log("📤 FULL PAYLOAD OBJECT:", JSON.parse(JSON.stringify(payload)));
  console.log("📤 FULL PAYLOAD STRING:", JSON.stringify(payload, null, 2));
  console.log("PAYLOAD", payload);

  const response = await fetch(insertUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${auth.type || "Bearer"} ${auth.token}`,
    },
    body: payload,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API xətası: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("✅ API Response:", result);

  // Save the structured items to local storage
  const { entries } = await chrome.storage.local.get({ entries: [] });
  items.forEach((item) => entries.push(item));
  await chrome.storage.local.set({ entries });

  return result;
}
