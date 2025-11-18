const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const status = document.getElementById("status");
const userInfo = document.getElementById("userInfo");
const displayUsername = document.getElementById("displayUsername");

const LOGIN_URL = "http://49.12.130.247:9281/api/v1/auth/login";

chrome.storage.local.get(["auth"], (data) => {
  if (data.auth && data.auth.token) {
    showLoggedInState(data.auth.username);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    showStatus("Zəhmət olmasa bütün xanaları doldurun", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Daxil olunur...";
  showStatus("Gözləyin...", "info");

  try {
    const response = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });

    if (!response.ok) {
      throw new Error(`Login xətası: ${response.status}`);
    }

    const data = await response.json();

    const authData = {
      token: data.token,
      refreshToken: data.refreshToken,
      type: data.type || "Bearer",
      username: data.username,
    };

    chrome.storage.local.set({ auth: authData }, () => {
      console.log("✅ Auth data saved:", authData);
      showStatus("✓ Uğurla daxil oldunuz!", "success");
      setTimeout(() => {
        showLoggedInState(authData.username);
      }, 1000);
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    showStatus("✗ Xəta: " + error.message, "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Daxil ol";
  }
});

logoutBtn.addEventListener("click", () => {
  chrome.storage.local.set(
    {
      auth: {
        token: null,
        refreshToken: null,
        type: null,
        username: null,
      },
    },
    () => {
      console.log("✅ Logged out");
      showLoggedOutState();
      showStatus("✓ Çıxış edildi", "success");
      setTimeout(() => {
        status.style.display = "none";
      }, 2000);
    }
  );
});

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = "block";
}

function showLoggedInState(username) {
  loginForm.classList.add("hidden");
  userInfo.classList.add("active");
  displayUsername.textContent = username;
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  status.style.display = "none";
}

function showLoggedOutState() {
  loginForm.classList.remove("hidden");
  userInfo.classList.remove("active");
}
