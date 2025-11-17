
const $=s=>document.querySelector(s);
const loginDiv=$("#login"), viewerDiv=$("#viewer"), dataDiv=$("#data");
const apiResult=$("#apiResult"), tokenBox=$("#tokenBox"), apiUrlInput=$("#apiUrl");

function init(){
  chrome.storage.local.get({ apiUrl:"http://49.12.130.247:9282/api/auth/login", auth:{} }, ({apiUrl, auth})=>{
    apiUrlInput.value = apiUrl || "http://49.12.130.247:9282/api/auth/login";
    if (auth && auth.token) {
      tokenBox.style.display="block";
      tokenBox.textContent = `Token: ${auth.token}\nRefresh: ${auth.refreshToken || ""}\nType: ${auth.type || ""}\nUser: ${auth.username || ""}`;
      viewerDiv.style.display="block";
    }
  });
}
init();

function render(){
  chrome.storage.local.get({entries:[]},({entries})=>{
    if(!entries||!entries.length){ dataDiv.textContent="No offers saved yet."; return; }
    dataDiv.textContent = entries.map(e=>e.trim()).join(" --- ");
  });
}

$("#loginBtn").addEventListener("click", async ()=>{
  const username=$("#username").value.trim();
  const password=$("#password").value;
  const apiUrl=apiUrlInput.value.trim() || "http://49.12.130.247:9282/api/auth/login";
  if(!username||!password){ alert("Please enter both username and password"); return; }
  apiResult.textContent = "Requesting...";
  tokenBox.style.display="none";
  tokenBox.textContent = "";

  chrome.storage.local.set({ apiUrl });

  try{
    const res = await fetch(apiUrl, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ username, password })
    });

    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch(e) {
      apiResult.textContent = "Error: Received non-JSON (likely an HTML SPA page). Use the REAL API endpoint (e.g., /api/auth/login).\n\n"
        + "Response preview:\n" + raw.substring(0, 600);
      return;
    }

    if (res.ok && data && data.token) {
      tokenBox.style.display="block";
      tokenBox.textContent = `Token: ${data.token}\nRefresh: ${data.refreshToken || ""}\nType: ${data.type || ""}\nUser: ${data.username || ""}`;
      apiResult.textContent = JSON.stringify(data, null, 2);
      chrome.storage.local.set({ 
        auth: { token: data.token, refreshToken: data.refreshToken || null, type: data.type || null, username: data.username || null }
      }, ()=>{
        viewerDiv.style.display="block";
      });
    } else {
      let msg = data.message || data.error || data.detail || "Unknown error";
      apiResult.textContent = "Error: " + msg + "\n" + JSON.stringify(data, null, 2);
    }

  }catch(err){
    apiResult.textContent = "Login request failed: " + (err && err.message ? err.message : String(err));
  }
});

$("#refreshBtn").addEventListener("click",render);
$("#clearBtn").addEventListener("click",()=>{
  if(!confirm("Clear all saved offers?")) return;
  chrome.storage.local.set({entries:[]},render);
});
$("#exportBtn").addEventListener("click",()=>{
  chrome.storage.local.get({entries:[]},({entries})=>{
    const txt = (entries||[]).map(e=>e.trim()).join(" --- ");
    const blob = new Blob([txt], {type:"text/plain"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download="tour-offers.txt"; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
});
