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
    title: "📋 Copy Selected Tours",
    contexts: ["page", "selection", "link", "all"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "collectSelected" }, (resp) => {
    if (!resp || !Array.isArray(resp.items) || !resp.items.length) {
      chrome.tabs.sendMessage(tab.id, {
        type: "showError",
        message: "Heç bir təklif seçilməyib",
      });
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: "showTrackingDialog",
      items: resp.items,
    });
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "insertTours") {
    insertToursToAPI(msg.applicationLeadId, msg.items)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function insertToursToAPI(applicationLeadId, items) {
  const { auth, insertUrl } = await chrome.storage.local.get({
    auth: {},
    insertUrl: "http://49.12.130.247:9282/api/tours/insert",
  });

  // ✅ Send structured payload with applicationLeadId
  const payload = {
    applicationLeadId: applicationLeadId,
    tours: items, // items is now an array of structured DTOs
  };

  console.log("📤 Sending payload:", JSON.stringify(payload, null, 2));

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
    throw new Error(`API xətası: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // Save the structured items to local storage
  const { entries } = await chrome.storage.local.get({ entries: [] });
  items.forEach((item) => entries.push(item));
  await chrome.storage.local.set({ entries });

  return result;
}
