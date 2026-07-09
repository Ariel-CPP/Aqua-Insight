/* ==========================================================================
   AQUA INSIGHT GLOBAL LOADER & UI ORCHESTRATION
   Handles: Theme switches, Language toggles, Dynamic Shared UI injection, 
   responsive sidebar, and module search filtering.
   ========================================================================== */

// Global Alert Override for Copyable Errors
window.alert = function(message) {
  let container = document.getElementById("aqua-global-alert-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "aqua-global-alert-container";
    container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
      z-index: 999999; display: flex; align-items: center; justify-content: center;
    `;
    document.body.appendChild(container);
  }
  
  const msgStr = String(message);
  const isError = msgStr.toLowerCase().includes("error") || msgStr.toLowerCase().includes("kesalahan") || msgStr.toLowerCase().includes("gagal");
  const iconColor = isError ? "#F43F5E" : "#00E5FF";
  const iconClass = isError ? "fa-circle-exclamation" : "fa-circle-info";
  const titleText = isError ? "Peringatan Sistem" : "Informasi";
  
  const modal = document.createElement("div");
  modal.style.cssText = `
    background: var(--bg-panel, #0A0A0C); border: 1px solid var(--border-color, rgba(255,255,255,0.1));
    border-radius: 12px; padding: 1.5rem; max-width: 600px; width: 90%;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.75); color: var(--text-primary, #f8fafc);
  `;
  
  modal.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding-bottom: 0.75rem;">
      <i class="fa-solid ${iconClass}" style="color: ${iconColor}; font-size: 1.25rem;"></i>
      <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">${titleText}</h3>
    </div>
    <div style="margin-bottom: 1.5rem;">
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Pesan ini dapat Anda <b>blok dan salin (Copy)</b> untuk pelaporan:</p>
      <textarea readonly style="width: 100%; height: 200px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); color: #e2e8f0; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; resize: vertical; box-sizing: border-box;">${msgStr}</textarea>
    </div>
    <div style="text-align: right;">
      <button onclick="this.closest('#aqua-global-alert-container').style.display='none'" style="background: ${iconColor}; color: #000; font-weight: 600; padding: 0.5rem 1.5rem; border-radius: 6px; border: none; cursor: pointer; font-family: inherit;">Tutup</button>
    </div>
  `;
  
  container.innerHTML = "";
  container.appendChild(modal);
  container.style.display = "flex";
};

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  // Ensure i18n is loaded before rendering UI
  if (!window.AQUA_I18N) {
    console.warn("i18n module not found, fallback to hardcoded text");
  }
  injectSharedUI();
  setupResponsiveSidebar();
  injectPWA();
  
  // Apply initial language state from localStorage
  applyTranslations();
  
  // Listen for language changes to re-render dynamic content
  window.addEventListener('languageChanged', () => {
    injectSharedUI();
    // If we're on the index page, we need to re-render cards and filter
    if (typeof window.renderFilterBar === "function") {
      window.renderFilterBar();
      // Keep current filter if possible, otherwise default to all
      const activeBtn = document.querySelector(".filter-btn.active");
      if (activeBtn) {
        // Trigger a click to re-render properly
        activeBtn.click();
      } else {
        window.renderModuleCards("all");
      }
    }
    applyTranslations();
  });
});

function applyTranslations() {
  // Update any static data-i18n attributes on the page
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if(window.AQUA_T) el.textContent = window.AQUA_T(key);
  });
  
  // Update placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if(window.AQUA_T) el.setAttribute("placeholder", window.AQUA_T(key));
  });
}

// 1. Theme Configuration Logic
function initTheme() {
  const savedTheme = localStorage.getItem("aqua-insight-theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("aqua-insight-theme", newTheme);
  
  // Dispatch custom event for Chart.js updates
  const event = new CustomEvent("themeChanged", { detail: { theme: newTheme } });
  window.dispatchEvent(event);
}

// Language Toggle Logic
window.toggleLanguage = function() {
  if (typeof window.AQUA_GET_LANG === "function") {
    const currentLang = window.AQUA_GET_LANG();
    const newLang = currentLang === "id" ? "en" : "id";
    window.AQUA_SET_LANG(newLang);
  }
};

// 2. Relative Path Resolver
function getPathContext() {
  const path = window.location.pathname;
  const isInPagesDir = path.includes("/pages/") || path.endsWith(".html") && !path.endsWith("index.html") && !path.includes("scratch");
  const bodyHasSubpageMark = document.body.classList.contains("subpage");
  
  if (isInPagesDir || bodyHasSubpageMark) {
    return {
      rootPrefix: "../",
      pagesPrefix: "",
      assetsPrefix: "../"
    };
  } else {
    return {
      rootPrefix: "",
      pagesPrefix: "pages/",
      assetsPrefix: ""
    };
  }
}

// Helper for translation or fallback
function T(key) {
  if (typeof window.AQUA_T === "function") {
    return window.AQUA_T(key);
  }
  return key; // Fallback
}

// PWA Injection Global
function injectPWA() {
  const ctx = getPathContext();
  
  // Inject Manifest
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = ctx.rootPrefix + 'manifest.json';
    document.head.appendChild(manifestLink);
  }
  
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    // Pakai absolut/relatif dari root
    const swPath = ctx.rootPrefix + 'sw.js';
    navigator.serviceWorker.register(swPath)
      .then(registration => console.log('[PWA] ServiceWorker registered with scope:', registration.scope))
      .catch(err => console.log('[PWA] ServiceWorker error:', err));
  }
}

// 3. Dynamic Header & Sidebar Injection
function injectSharedUI() {
  const ctx = getPathContext();
  const currentFilename = window.location.pathname.split("/").pop() || "index.html";
  const lang = (typeof window.AQUA_GET_LANG === "function") ? window.AQUA_GET_LANG() : "id";
  
  // Inject Sidebar
  const sidebarContainer = document.getElementById("sidebar-container");
  if (sidebarContainer) {
    const modules = window.AQUA_INSIGHT_MODULES || [];
    
    // Group modules by category
    const groupedModules = {};
    modules.forEach(mod => {
      // Use language-specific category name
      const catKey = 'category_' + lang;
      const catName = mod[catKey] || mod.category_id || mod.category;
      if (!groupedModules[catName]) groupedModules[catName] = [];
      groupedModules[catName].push(mod);
    });

    let sidebarHTML = `
      <aside class="sidebar" id="app-sidebar">
        <a href="${ctx.rootPrefix}index.html" class="sidebar-brand">
          <img src="${ctx.assetsPrefix}assets/images/logo.jpg" alt="CP PRIMA Logo" style="width: 40px; height: 40px; object-fit: contain; border-radius: 8px; background: white; padding: 2px;">
          <span class="brand-text" style="background: none; -webkit-text-fill-color: var(--text-primary); color: var(--text-primary);">${T('sb_brand')}</span>
        </a>
        
        <div class="sidebar-search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="module-search" placeholder="${T('sb_search_placeholder')}" oninput="filterSidebarModules(this.value)">
        </div>
        
        <div class="sidebar-menu" id="sidebar-menu-list">
          <div class="menu-category">
            <a href="${ctx.rootPrefix}index.html" class="menu-item ${currentFilename === "index.html" ? "active" : ""}">
              <i class="fa-solid fa-house"></i>
              <span>${T('sb_main_dashboard')}</span>
            </a>
          </div>
    `;

    // Add grouped links
    for (const [category, items] of Object.entries(groupedModules)) {
      sidebarHTML += `
        <div class="menu-category" data-category-group="${category}">
          <div class="category-label">${category}</div>
      `;
      
      items.forEach(item => {
        const itemUrl = ctx.pagesPrefix + item.url.split("/").pop();
        const itemFilename = item.url.split("/").pop();
        const isActive = currentFilename === itemFilename;
        
        const itemName = item['name_' + lang] || item.name_id || item.name;
        
        sidebarHTML += `
          <a href="${ctx.rootPrefix + item.url}" class="menu-item ${isActive ? "active" : ""}" data-module-name="${itemName.toLowerCase()}">
            <i class="fa-solid ${item.icon}"></i>
            <span>${itemName}</span>
          </a>
        `;
      });
      
      sidebarHTML += `</div>`;
    }

    // Add support category
    sidebarHTML += `
          <div class="menu-category">
            <div class="category-label">${T('sb_support')}</div>
            <a href="${ctx.rootPrefix}pages/contact.html" class="menu-item ${currentFilename === "contact.html" ? "active" : ""}">
              <i class="fa-solid fa-envelope"></i>
              <span>${T('sb_contact')}</span>
            </a>
          </div>
        </div>
        
        <div class="sidebar-footer" style="gap: 0.5rem; justify-content: flex-start;">
          <div class="theme-switch" style="margin-right: auto;">
            <span class="switch-label"><i class="fa-solid fa-moon"></i></span>
            <button class="switch-btn" onclick="toggleTheme()" aria-label="Toggle theme"></button>
          </div>
          <button class="header-btn" style="padding: 0.35rem 0.65rem; font-family: var(--font-heading); font-weight: 700; width: 40px; border-radius: 8px;" onclick="toggleLanguage()" data-tooltip="Switch ID/EN">
            ${lang.toUpperCase()}
          </button>
          <button class="header-btn" style="padding: 0.35rem 0.65rem; border-radius: 8px;" onclick="triggerProjectExport()" data-tooltip="${T('sb_tooltip_export')}">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>
      </aside>
    `;
    
    sidebarContainer.innerHTML = sidebarHTML;
  }

  // Inject Header
  const headerContainer = document.getElementById("header-container");
  if (headerContainer) {
    // Dynamic page title logic
    let pageTitle = headerContainer.getAttribute("data-page-title") || "Aqua Insight Ecosystem";
    let parentCategory = headerContainer.getAttribute("data-page-category") || T('hdr_breadcrumb_core');
    
    // Look up the current page title in the modules list to get the translated name
    if (window.AQUA_INSIGHT_MODULES) {
      const activeModule = window.AQUA_INSIGHT_MODULES.find(m => m.url.includes(currentFilename));
      if (activeModule) {
        pageTitle = activeModule['name_' + lang] || activeModule.name_id;
        parentCategory = activeModule['category_' + lang] || activeModule.category_id;
      }
    }
    
    headerContainer.innerHTML = `
      <header class="app-header">
        <div class="header-title-area">
          <button id="mobile-sidebar-toggle" class="header-btn" style="display: none; padding: 0.5rem; margin-right: 0.5rem;" onclick="toggleMobileSidebar()">
            <i class="fa-solid fa-bars"></i>
          </button>
          <h1>${pageTitle}</h1>
          <div class="breadcrumb">
            <a href="${ctx.rootPrefix}index.html" style="color: var(--text-secondary); text-decoration: none;">Aqua Insight</a>
            <span class="separator"><i class="fa-solid fa-chevron-right" style="font-size: 0.7rem;"></i></span>
            <span style="color: var(--text-secondary);">${parentCategory}</span>
            <span class="separator"><i class="fa-solid fa-chevron-right" style="font-size: 0.7rem;"></i></span>
            <span class="current">${pageTitle}</span>
          </div>
        </div>
        
        <div class="header-actions">
          <div class="glass-panel" style="padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; font-weight: 500;">
            <i class="fa-solid fa-calendar" style="color: var(--text-accent);"></i>
            <span id="header-timer">...</span>
          </div>
          <button class="header-btn" onclick="triggerProjectImport()" data-tooltip="${T('hdr_tooltip_import')}">
            <i class="fa-solid fa-upload"></i> ${T('hdr_import')}
          </button>
        </div>
      </header>
    `;
    
    adjustToggleVisibility();
    window.addEventListener("resize", adjustToggleVisibility);
    updateHeaderDate();
  }
}

// 4. Update Header Date
function updateHeaderDate() {
  const dateSpan = document.getElementById("header-timer");
  if (dateSpan) {
    const lang = (typeof window.AQUA_GET_LANG === "function") ? window.AQUA_GET_LANG() : "id";
    const locale = lang === "en" ? "en-US" : "id-ID";
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateSpan.textContent = new Date().toLocaleDateString(locale, options);
  }
}

// 5. Sidebar Responsive toggle control
function setupResponsiveSidebar() {
  const layout = document.getElementById("app-layout");
  if (layout && !document.getElementById("mobile-sidebar-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "mobile-sidebar-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      z-index: 999;
      display: none;
    `;
    overlay.addEventListener("click", toggleMobileSidebar);
    layout.appendChild(overlay);
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  const overlay = document.getElementById("mobile-sidebar-overlay");
  
  if (sidebar && overlay) {
    const open = sidebar.classList.toggle("mobile-open");
    overlay.style.display = open ? "block" : "none";
  }
}

function adjustToggleVisibility() {
  const toggleBtn = document.getElementById("mobile-sidebar-toggle");
  if (toggleBtn) {
    toggleBtn.style.display = window.innerWidth <= 768 ? "inline-block" : "none";
  }
}

// 6. Search Bar filter inside sidebar
window.filterSidebarModules = function(query) {
  const cleanQuery = query.toLowerCase().trim();
  const menuItems = document.querySelectorAll("#sidebar-menu-list .menu-item");
  const categoryGroups = document.querySelectorAll("#sidebar-menu-list [data-category-group]");
  const dashboardText = typeof window.AQUA_T === "function" ? window.AQUA_T('sb_main_dashboard') : "Dashboard Utama";
  
  if (cleanQuery === "") {
    menuItems.forEach(item => item.style.display = "flex");
    categoryGroups.forEach(grp => grp.style.display = "flex");
    return;
  }
  
  menuItems.forEach(item => {
    const moduleName = item.getAttribute("data-module-name") || "";
    // Don't hide the main Dashboard link
    const itemSpan = item.querySelector("span");
    if (itemSpan && itemSpan.textContent === dashboardText) return;
    
    if (moduleName.includes(cleanQuery)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
  
  categoryGroups.forEach(grp => {
    const items = grp.querySelectorAll(".menu-item");
    let visibleCount = 0;
    items.forEach(it => {
      if (it.style.display !== "none") visibleCount++;
    });
    grp.style.display = visibleCount > 0 ? "flex" : "none";
  });
}

// 7. Project Serialization Export / Import
window.triggerProjectExport = function() {
  const projectData = {
    appName: "Aqua Insight Ecosystem",
    exportTime: new Date().toISOString(),
    theme: localStorage.getItem("aqua-insight-theme") || "dark",
    lang: localStorage.getItem("aqua-insight-lang") || "id",
    statisticsData: localStorage.getItem("aqua-insight-stats-grid") || "",
    statisticsDatasetName: localStorage.getItem("aqua-insight-stats-name") || "",
    particleSettings: localStorage.getItem("aqua-insight-particle-settings") || "",
    planktonDb: localStorage.getItem("aqua-insight-plankton-db") || "",
    geneSettings: localStorage.getItem("aqua-insight-gene-settings") || "",
    riskInputs: localStorage.getItem("aqua-insight-risk-inputs") || ""
  };
  
  const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aqua_insight_session_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  const lang = typeof window.AQUA_GET_LANG === "function" ? window.AQUA_GET_LANG() : "id";
  alert(lang === "en" ? "Project session successfully exported as JSON file." : "Sesi Proyek berhasil diekspor sebagai file JSON.");
};

window.triggerProjectImport = function() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      const lang = typeof window.AQUA_GET_LANG === "function" ? window.AQUA_GET_LANG() : "id";
      try {
        const data = JSON.parse(evt.target.result);
        if (data.appName !== "Aqua Insight Ecosystem") {
          throw new Error(lang === "en" ? "Incompatible file format." : "Format file tidak kompatibel dengan Aqua Insight.");
        }
        
        if (data.theme) localStorage.setItem("aqua-insight-theme", data.theme);
        if (data.lang) localStorage.setItem("aqua-insight-lang", data.lang);
        if (data.statisticsData) localStorage.setItem("aqua-insight-stats-grid", data.statisticsData);
        if (data.statisticsDatasetName) localStorage.setItem("aqua-insight-stats-name", data.statisticsDatasetName);
        if (data.particleSettings) localStorage.setItem("aqua-insight-particle-settings", data.particleSettings);
        if (data.planktonDb) localStorage.setItem("aqua-insight-plankton-db", data.planktonDb);
        if (data.geneSettings) localStorage.setItem("aqua-insight-gene-settings", data.geneSettings);
        if (data.riskInputs) localStorage.setItem("aqua-insight-risk-inputs", data.riskInputs);
        
        alert(lang === "en" ? "Project successfully imported! Page will reload to restore session." : "Proyek berhasil diimpor! Halaman akan dimuat ulang untuk memulihkan sesi Anda.");
        window.location.reload();
      } catch (err) {
        alert((lang === "en" ? "Failed to import file: " : "Gagal mengimpor file: ") + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
};
