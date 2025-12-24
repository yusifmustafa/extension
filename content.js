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

     "Места": "Availability",
    "Номер": "Room / Accommodation",
    "Размещение": "Room / Accommodation",
    "Тип": "Price type",

     "Заезд Тур": "Departure from Tour",
    "Ночей Гостиница": "Nights Hotel",
    "Места Питание Номер / Размещение": "Availability Meal Room / Accommodation",
    "Тип цены Транспорт": "Price type Transport",

     "Дата": "Date",
    "Период": "Period",
    "Отель": "Hotel",
    "Страна": "Country",
    "Курорт": "Resort",
    "Вылет": "Departure",
    "Категория": "Category",
    "Звезды": "Stars",
    "Стоимость": "Price",
    "Валюта": "Currency",
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

   function isRussianText(text) {
    return /[А-Яа-яЁё]/.test(text);
  }

  function getHeaders(table) {
    let headers = [];
    const thead = table.querySelector("thead");

    if (thead && thead.querySelectorAll("th").length) {
      headers = Array.from(thead.querySelectorAll("th")).map((th) =>
          norm(th.innerText)
      );
    } else {
      const firstRow = table.querySelector("tr");
      if (firstRow) {
        const ths = firstRow.querySelectorAll("th");
        const cells = ths.length ? ths : firstRow.querySelectorAll("td");
        headers = Array.from(cells).map((c) => norm(c.innerText));
      }
    }

    console.log("📋 Original Headers:", headers);

     headers = headers.map((h) => {
       if (ruToEn[h]) {
        console.log(`  ✓ Exact match: "${h}" -> "${ruToEn[h]}"`);
        return ruToEn[h];
      }

       for (const [ru, en] of Object.entries(ruToEn)) {
        if (h.includes(ru)) {
          const translated = h.replace(ru, en);
          console.log(`  ✓ Partial match: "${h}" -> "${translated}"`);
          return translated;
        }
      }

      console.log(`  ✗ No match: "${h}"`);
      return h;
    });

    console.log("📋 Translated Headers:", headers);
    return headers;
  }

  function mapField(header, value) {
    const out = {};
    const lines = splitLines(value);

     if (/Departure.*Tour/i.test(header) || /Заезд.*Тур/i.test(header)) {
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

     if (/Nights.*Hotel/i.test(header) || /Ночей.*Гостиница/i.test(header)) {
      if (lines.length >= 2) {
        out["Nights"] = lines[0];
        out["Hotel"] = lines.slice(1).join(" ");
      } else {
        const parts = value
            .split(/\s{2,}/)
            .map(norm)
            .filter(Boolean);
        if (parts.length >= 2) {
          out["Nights"] = parts[0];
          out["Hotel"] = parts.slice(1).join(" ");
        } else {
          out["Hotel"] = norm(value);
        }
      }
      return out;
    }

     if (
        /Availability.*Meal.*Room/i.test(header) ||
        /Места.*Питание.*Номер/i.test(header)
    ) {
      if (lines.length >= 3) {
        out["Availability"] = lines[0];
        out["Meal"] = lines[1];
        out["Room / Accommodation"] = lines.slice(2).join(" ");
      } else if (lines.length === 2) {
        out["Meal"] = lines[0];
        out["Room / Accommodation"] = lines[1];
      } else if (lines.length === 1) {
        out["Room / Accommodation"] = lines[0];
      } else {
        out["Room / Accommodation"] = norm(value);
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

     if (/Price type.*Transport/i.test(header) || /Тип.*Транспорт/i.test(header)) {
      if (lines.length >= 2) {
        out["Price type"] = lines[0];
        out["Transport"] = lines.slice(1).join(" ");
      } else {
        const parts = value
            .split(/\s{2,}/)
            .map(norm)
            .filter(Boolean);
        if (parts.length >= 2) {
          out["Price type"] = parts[0];
          out["Transport"] = parts.slice(1).join(" ");
        } else {
          out["Transport"] = norm(value);
        }
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

    console.log("📦 Extracted object:", data);
    return data;
  }

  function parseDepartureDate(dateStr) {
    if (!dateStr) return null;

    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);

    if (!match) return dateStr;

    const [, day, month, year] = match;

    return `${year}-${month}-${day}`;
  }

  function createTourDTO(obj) {
    return {
      departureFrom: obj["Departure from"] || obj["Departure"] || null,
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

     if (!isPriceLike(text)) {
      console.log("  ✗ No price found in row");
      return false;
    }

    const obj = extractObject(tr, headers);

     const hasHotel = Boolean(
        obj["Hotel"] ||
        obj["Room / Accommodation"] ||
        obj["Гостиница"] ||
        obj["Номер / Размещение"]
    );

    console.log(`  ${hasHotel ? '✓' : '✗'} Hotel/Room check:`, {
      Hotel: obj["Hotel"],
      "Room / Accommodation": obj["Room / Accommodation"],
    });

    return hasHotel;
  }

  function addCheckboxes(table) {
    const headers = getHeaders(table);
    console.log("🔍 Processing table with headers:", headers);

    const bodyRows = table.querySelectorAll("tbody tr");
    const rows = bodyRows.length ? bodyRows : table.querySelectorAll("tr");

    let addedCount = 0;
    rows.forEach((tr, index) => {
      if (tr.querySelector("th")) {
        console.log(`  Row ${index}: Skipped (has <th>)`);
        return;
      }
      if (tr.dataset.tourCollector === "1") {
        console.log(`  Row ${index}: Skipped (already processed)`);
        return;
      }

      console.log(`  Row ${index}: Checking if offer row...`);
      if (!isOfferRow(tr, headers)) {
        console.log(`  Row ${index}: Not an offer row`);
        return;
      }

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
      addedCount++;

      console.log(`  Row ${index}: ✓ Checkbox added`);
    });

    console.log(`✅ Added ${addedCount} checkboxes to table`);
  }

  function scan() {
    console.log("🔄 Scanning for tables...");
    const tables = document.querySelectorAll("table");
    console.log(`Found ${tables.length} tables`);
    tables.forEach((table, i) => {
      console.log(`\n📊 Processing table ${i + 1}/${tables.length}`);
      addCheckboxes(table);
    });
  }

  const obs = new MutationObserver(() => scan());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  scan();

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
    title.textContent = "İzləmə kodu seçin";
    title.style.cssText =
        "margin: 0 0 16px 0 !important; font-size: 20px !important; color: #333 !important;";

    const info = document.createElement("p");
    info.textContent = `${items.length} təklif seçildi. Davam etmək üçün Application Lead seçin.`;
    info.style.cssText =
        "margin: 0 0 16px 0 !important; color: #666 !important; font-size: 14px !important;";

    const autocompleteWrapper = document.createElement("div");
    autocompleteWrapper.style.cssText = `
      position: relative !important;
      margin-bottom: 16px !important;
    `;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Application Lead axtar...";
    input.style.cssText = `
      width: 100% !important;
      padding: 12px !important;
      border: 2px solid #ddd !important;
      border-radius: 6px !important;
      font-size: 15px !important;
      box-sizing: border-box !important;
    `;

    const dropdown = document.createElement("div");
    dropdown.style.cssText = `
      position: absolute !important;
      top: 100% !important;
      left: 0 !important;
      right: 0 !important;
      background: white !important;
      border: 2px solid #ddd !important;
      border-top: none !important;
      border-radius: 0 0 6px 6px !important;
      max-height: 200px !important;
      overflow-y: auto !important;
      display: none !important;
      z-index: 9999 !important;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
    `;

    const statusDiv = document.createElement("div");
    statusDiv.style.cssText =
        "margin-bottom: 16px !important; padding: 10px !important; border-radius: 6px !important; display: none !important;";

    let selectedId = null;
    let debounceTimeout = null;

    async function fetchApplicationLeads(query) {
      if (query.length < 2) {
        dropdown.style.display = "none";
        return;
      }

      try {
        console.log("🔍 Fetching application leads for:", query);

        const response = await chrome.runtime.sendMessage({
          type: "fetchApplicationLeads",
          query: query,
        });

        console.log("📥 Application Leads Response:", response);

        if (response.success && response.data) {
          renderDropdown(response.data);
        } else {
          console.error("❌ Fetch failed:", response.error);
          dropdown.style.display = "none";
        }
      } catch (error) {
        console.error("❌ Fetch error:", error);
        dropdown.style.display = "none";
      }
    }

    function renderDropdown(leads) {
      dropdown.innerHTML = "";

      if (!leads || leads.length === 0) {
        const noResult = document.createElement("div");
        noResult.textContent = "Nəticə tapılmadı";
        noResult.style.cssText = `
          padding: 12px !important;
          color: #999 !important;
          text-align: center !important;
        `;
        dropdown.appendChild(noResult);
        dropdown.style.display = "block";
        return;
      }

      leads.forEach((lead) => {
        const item = document.createElement("div");
        item.textContent = `${lead.title}`;
        item.style.cssText = `
          padding: 12px !important;
          cursor: pointer !important;
          border-bottom: 1px solid #f0f0f0 !important;
          font-size: 14px !important;
          color: #333 !important;
        `;

        item.onmouseover = () => {
          item.style.background = "#f5f5f5";
        };
        item.onmouseout = () => {
          item.style.background = "white";
        };

        item.onclick = () => {
          selectedId = lead.id;
          input.value = `${lead.title}`;
          dropdown.style.display = "none";
          console.log("✅ Selected ID:", selectedId);
        };

        dropdown.appendChild(item);
      });

      dropdown.style.display = "block";
    }

    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimeout);
      selectedId = null;

      debounceTimeout = setTimeout(() => {
        const query = e.target.value.trim();
        fetchApplicationLeads(query);
      }, 300);
    });

    input.addEventListener("focus", () => {
      if (dropdown.children.length > 0) {
        dropdown.style.display = "block";
      }
    });

    document.addEventListener("click", (e) => {
      if (!autocompleteWrapper.contains(e.target)) {
        dropdown.style.display = "none";
      }
    });

    autocompleteWrapper.appendChild(input);
    autocompleteWrapper.appendChild(dropdown);

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
      console.log("📤 Submit clicked, selectedId:", selectedId);

      if (!selectedId) {
        statusDiv.style.display = "block";
        statusDiv.style.background = "#fff3cd";
        statusDiv.style.color = "#856404";
        statusDiv.textContent = "Zəhmət olmasa Application Lead seçin";
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
          applicationLeadId: selectedId,
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

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(submitBtn);

    dialog.appendChild(title);
    dialog.appendChild(info);
    dialog.appendChild(autocompleteWrapper);
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

  console.log("✅ Tour Collector Content Script loaded (v9 - Rusça Fix)");
})();