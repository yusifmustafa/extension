(() => {
  if (window.__tourCollectorInjectedV8) return;
  window.__tourCollectorInjectedV8 = true;

  const ruToEn = {
    Заезд: "Departure",
    Тур: "Tour",
    Ночей: "Nights",
    Гостиница: "Hotel",
    "Места в отеле": "Availability",
    Питание: "Meal",
    "Номер / Размещение": "Room / Accommodation",
    Цена: "Price",
    "Тип цены": "Price type",
    Транспорт: "Transport",
  };

  const norm = (s) =>
    (s || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const splitLines = (s) =>
    (s || "")
      .split(/\n+/)
      .map((t) => norm(t))
      .filter(Boolean);
  const isPriceLike = (t) => /\b\d[\d\s.,]*\s?(USD|EUR|RUB)\b/i.test(t);

  function getHeaders(table) {
    let headers = [];
    const thead = table.querySelector("thead");
    if (thead && thead.querySelectorAll("th").length) {
      headers = Array.from(thead.querySelectorAll("th")).map((th) =>
        th.innerText.trim()
      );
    } else {
      const firstRow = table.querySelector("tr");
      if (firstRow) {
        const ths = firstRow.querySelectorAll("th");
        const cells = ths.length ? ths : firstRow.querySelectorAll("td");
        headers = Array.from(cells).map((c) => c.innerText.trim());
      }
    }
    headers = headers.map((h) => ruToEn[h] || h);
    return headers;
  }

  function mapField(header, value) {
    const out = {};
    const lines = splitLines(value);

    if (/^Departure\s*from/i.test(header) && /Tour/i.test(header)) {
      if (lines.length >= 2) {
        out["Departure from"] = lines[0];
        out["Tour"] = lines[1];
      } else {
        const parts = value
          .split(/\s{2,}/)
          .map(norm)
          .filter(Boolean);
        if (parts.length >= 2) {
          out["Departure from"] = parts[0];
          out["Tour"] = parts[1];
        } else {
          out["Departure from"] = norm(value);
        }
      }
      return out;
    }

    if (/^Availability/i.test(header) && /Meal/i.test(header)) {
      if (lines.length >= 2) {
        out["Availability"] = lines.slice(0, -1).join(" ") || "";
        out["Meal"] = lines[lines.length - 1] || "";
      } else if (lines.length === 1) {
        out["Meal"] = lines[0];
      } else {
        out["Meal"] = norm(value);
      }
      return out;
    }

    out[header] = norm(value);
    return out;
  }

  function extractObject(tr, headers) {
    const tds = Array.from(tr.querySelectorAll("td"));
    const last = tds[tds.length - 1];
    const cells =
      last && last.classList.contains("tour-collector-cell")
        ? tds.slice(0, -1)
        : tds;

    const data = {};
    cells.forEach((td, i) => {
      const header = headers[i] || "";
      const val = td.innerText;
      const mapped = mapField(header, val);
      Object.assign(data, mapped);
    });
    return data;
  }

  // ✅ Structured DTO mapping function
  function createTourDTO(obj) {
    return {
      departureFrom: obj["Departure from"] || null,
      tour: obj["Tour"] || null,
      nights: obj["Nights"] ? parseInt(obj["Nights"]) : null,
      hotel: obj["Hotel"] || null,
      availability: obj["Availability"] || null,
      meal: obj["Meal"] || null,
      roomAccommodation: obj["Room / Accommodation"] || null,
      price: obj["Price"] || null,
      priceType: obj["Price type"] || null,
      transport: obj["Transport"] || null,
    };
  }

  function isOfferRow(tr, headers) {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (!tds.length) return false;
    const text = norm(tds.map((td) => td.innerText).join(" "));
    if (!isPriceLike(text)) return false;
    const obj = extractObject(tr, headers);
    return Boolean(obj["Hotel"] || obj["Room / Accommodation"]);
  }

  function addCheckboxes(table) {
    const headers = getHeaders(table);
    const bodyRows = table.querySelectorAll("tbody tr");
    const rows = bodyRows.length ? bodyRows : table.querySelectorAll("tr");

    rows.forEach((tr) => {
      if (tr.querySelector("th")) return;
      if (tr.dataset.tourCollector === "1") return;
      if (!isOfferRow(tr, headers)) return;

      const td = document.createElement("td");
      td.className = "tour-collector-cell";
      td.style.textAlign = "right";
      td.style.verticalAlign = "middle";
      td.style.paddingRight = "6px";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.title = "Select this offer";
      cb.addEventListener("change", () => {
        tr.classList.toggle("tour-collector-selected", cb.checked);
      });

      td.appendChild(cb);
      tr.appendChild(td);
      tr.dataset.tourCollector = "1";
    });
  }

  function scan() {
    document.querySelectorAll("table").forEach(addCheckboxes);
  }
  const obs = new MutationObserver(() => scan());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  scan();

  // ✅ Add CSS for selected rows
  const style = document.createElement("style");
  style.textContent = `
    tr.tour-collector-selected {
      background-color: #e3f2fd !important;
      outline: 2px solid #2196F3 !important;
    }
    .tour-collector-cell input[type="checkbox"] {
      cursor: pointer;
      width: 18px;
      height: 18px;
    }
  `;
  document.head.appendChild(style);

  function showTrackingDialog(items) {
    console.log("🎯 showTrackingDialog called with items:", items);

    const existing = document.getElementById("tour-tracking-dialog-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "tour-tracking-dialog-overlay";
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0,0,0,0.6) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: system-ui, -apple-system, sans-serif !important;
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
      background: white !important;
      padding: 24px !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important;
      max-width: 500px !important;
      width: 90% !important;
      z-index: 2147483648 !important;
    `;

    const title = document.createElement("h3");
    title.textContent = "İzləmə kodu daxil edin";
    title.style.cssText =
      "margin: 0 0 16px 0 !important; font-size: 20px !important; color: #333 !important;";

    const info = document.createElement("p");
    info.textContent = `${items.length} təklif seçildi. Davam etmək üçün İzləmə kodu daxil edin.`;
    info.style.cssText =
      "margin: 0 0 16px 0 !important; color: #666 !important; font-size: 14px !important;";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "İzləmə kodu";
    input.style.cssText = `
      width: 100% !important;
      padding: 12px !important;
      border: 2px solid #ddd !important;
      border-radius: 6px !important;
      font-size: 15px !important;
      box-sizing: border-box !important;
      margin-bottom: 16px !important;
    `;

    const statusDiv = document.createElement("div");
    statusDiv.style.cssText =
      "margin-bottom: 16px !important; padding: 10px !important; border-radius: 6px !important; display: none !important;";

    const btnContainer = document.createElement("div");
    btnContainer.style.cssText =
      "display: flex !important; gap: 10px !important; justify-content: flex-end !important;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Ləğv et";
    cancelBtn.style.cssText = `
      padding: 10px 20px !important;
      border: 1px solid #ddd !important;
      background: white !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 14px !important;
    `;
    cancelBtn.onmouseover = () => (cancelBtn.style.background = "#f5f5f5");
    cancelBtn.onmouseout = () => (cancelBtn.style.background = "white");
    cancelBtn.onclick = () => {
      console.log("❌ Dialog cancelled");
      overlay.remove();
    };

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Göndər";
    submitBtn.style.cssText = `
      padding: 10px 20px !important;
      border: none !important;
      background: #0066ff !important;
      color: white !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: 500 !important;
    `;
    submitBtn.onmouseover = () => (submitBtn.style.background = "#0052cc");
    submitBtn.onmouseout = () => (submitBtn.style.background = "#0066ff");

    submitBtn.onclick = async () => {
      const applicationLeadId = input.value.trim();
      console.log("📤 Submit clicked, applicationLeadId:", applicationLeadId);

      if (!applicationLeadId) {
        statusDiv.style.display = "block";
        statusDiv.style.background = "#fff3cd";
        statusDiv.style.color = "#856404";
        statusDiv.textContent = "Zəhmət olmasa ApplicationLeadId daxil edin";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Göndərilir...";
      statusDiv.style.display = "block";
      statusDiv.style.background = "#cce5ff";
      statusDiv.style.color = "#004085";
      statusDiv.textContent = "API-yə göndərilir...";

      try {
        console.log("📡 Sending message to background...");
        const response = await chrome.runtime.sendMessage({
          type: "insertTours",
          applicationLeadId: applicationLeadId,
          items: items,
        });

        console.log("📥 Response received:", response);

        if (response.success) {
          statusDiv.style.background = "#d4edda";
          statusDiv.style.color = "#155724";
          statusDiv.textContent = "✓ Uğurla göndərildi!";

          document
            .querySelectorAll("tr.tour-collector-selected")
            .forEach((tr) => {
              tr.classList.remove("tour-collector-selected");
              const cb = tr.querySelector("input[type=checkbox]");
              if (cb) cb.checked = false;
            });

          setTimeout(() => overlay.remove(), 2000);
        } else {
          // ✅ Check if error is about missing token
          if (response.error && response.error.includes("Token yoxdur")) {
            statusDiv.style.background = "#fff3cd";
            statusDiv.style.color = "#856404";
            statusDiv.innerHTML =
              "⚠️ Token yoxdur! <br>Extension ikonuna klikləyib login olun.";
          } else {
            statusDiv.style.background = "#f8d7da";
            statusDiv.style.color = "#721c24";
            statusDiv.textContent = "✗ Xəta: " + response.error;
          }
          submitBtn.disabled = false;
          submitBtn.textContent = "Göndər";
        }
      } catch (error) {
        console.error("❌ Error:", error);
        statusDiv.style.background = "#f8d7da";
        statusDiv.style.color = "#721c24";
        statusDiv.textContent = "✗ Xəta: " + error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = "Göndər";
      }
    };

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") submitBtn.click();
    });

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(submitBtn);

    dialog.appendChild(title);
    dialog.appendChild(info);
    dialog.appendChild(input);
    dialog.appendChild(statusDiv);
    dialog.appendChild(btnContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    input.focus();

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    console.log("✅ Dialog rendered successfully");
  }

  function showErrorMessage(message) {
    console.log("⚠️ Showing error:", message);
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: #f8d7da !important;
      color: #721c24 !important;
      padding: 16px 20px !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
      z-index: 2147483647 !important;
      font-family: system-ui, sans-serif !important;
      font-size: 14px !important;
      max-width: 300px !important;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("📨 Message received:", msg);

    if (msg.type === "collectSelected") {
      const items = [];
      document.querySelectorAll("tr.tour-collector-selected").forEach((tr) => {
        const table = tr.closest("table");
        const headers = getHeaders(table);
        const obj = extractObject(tr, headers);
        const dto = createTourDTO(obj);
        items.push(dto);
      });
      console.log("✅ Collected structured items:", items);
      sendResponse({ items });
    } else if (msg.type === "showTrackingDialog") {
      console.log("🎯 Received showTrackingDialog message");
      showTrackingDialog(msg.items);
      sendResponse({ received: true });
    } else if (msg.type === "showError") {
      showErrorMessage(msg.message);
      sendResponse({ received: true });
    }
    return true;
  });

  console.log("✅ Tour Collector Content Script loaded (v8)");
})();
