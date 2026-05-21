/* ====================================================
   منصة تمكين - دليل تواصل الأمانات وإدارة جهات التواصل
   ==================================================== */

// ----- 🛠️ VISUAL DEBUG SYSTEM (GLOBAL ERROR LOGGING) -----
window.addEventListener('error', function(e) {
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '0';
  errDiv.style.left = '0';
  errDiv.style.width = '100%';
  errDiv.style.background = '#ef4444';
  errDiv.style.color = '#ffffff';
  errDiv.style.padding = '14px 20px';
  errDiv.style.zIndex = '999999';
  errDiv.style.fontFamily = 'monospace';
  errDiv.style.fontSize = '13px';
  errDiv.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
  errDiv.style.direction = 'ltr';
  errDiv.style.textAlign = 'left';
  errDiv.innerHTML = `<strong>JS Error:</strong> ${e.message} <br> <strong>File:</strong> ${e.filename} : Line ${e.lineno}`;
  document.body.appendChild(errDiv);
});

window.addEventListener('unhandledrejection', function(e) {
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '0';
  errDiv.style.left = '0';
  errDiv.style.width = '100%';
  errDiv.style.background = '#f59e0b';
  errDiv.style.color = '#ffffff';
  errDiv.style.padding = '14px 20px';
  errDiv.style.zIndex = '999999';
  errDiv.style.fontFamily = 'monospace';
  errDiv.style.fontSize = '13px';
  errDiv.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
  errDiv.style.direction = 'ltr';
  errDiv.style.textAlign = 'left';
  errDiv.innerHTML = `<strong>Database/Network Error:</strong> ${e.reason?.message || e.reason || 'Unhandled Promise Rejection'}`;
  document.body.appendChild(errDiv);
});

// ----- 🔑 SUPABASE INITIALIZATION -----
const { SUPABASE_URL, SUPABASE_KEY } = window.APP_CONFIG || {};
let supabaseClient = null;

// Safe storage adapter to prevent errors/hangs when Tracking Prevention blocks localStorage
const safeMemoryStorage = {
  store: {},
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn("⚠️ LocalStorage read blocked by browser security/tracking prevention. Using in-memory fallback.");
      return this.store[key] || null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn("⚠️ LocalStorage write blocked by browser security/tracking prevention. Using in-memory fallback.");
      this.store[key] = value;
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      delete this.store[key];
    }
  }
};

if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_KEY !== "PASTE_MY_SUPABASE_KEY_HERE") {
  if (window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          storage: safeMemoryStorage,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
    } catch (clientErr) {
      console.error("❌ Failed to initialize Supabase Client with storage, falling back to in-memory only:", clientErr);
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: false
        }
      });
    }
  } else {
    console.error("❌ Supabase library is not loaded from CDN.");
  }
} else {
  console.warn("⚠️ Supabase credentials missing in config.js");
}

// ----- 📦 STATE MANAGEMENT -----
const state = {
  contacts: [],          // Original records from Supabase (representing Contacts)
  searchQuery: "",       // Unified smart search text
  filters: {             // Dropdown filters
    amanah: "",
    city: "",
    status: ""
  },
  pagination: {          // Pagination details
    page: 1,
    pageSize: 10
  },
  activeTab: "dashboard",
  deleteTarget: null     // Object scheduled for deletion
};

// ----- 🔍 HELPER SELECTORS -----
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// ----- 💬 UI TOAST NOTIFICATION -----
function toast(message, type = "info") {
  const wrap = $("#toastWrap");
  if (!wrap) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  wrap.appendChild(t);
  
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-24px) scale(0.95)";
  }, 2700);
  
  setTimeout(() => t.remove(), 3000);
}

// Helper to escape HTML characters safely
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Helper to get initials of a name
function getInitials(name) {
  const safeName = (name || "").trim();
  if (!safeName) return "ت";
  return safeName.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
}

// Helper to format ISO Date beautifully
function formatDate(isoDate) {
  if (!isoDate) return "";
  try {
    return new Date(isoDate).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return isoDate;
  }
}

// Helper to translate status values nicely to team terminology
function translateStatus(status) {
  switch (String(status).toLowerCase()) {
    case "new": return "جديد";
    case "active": return "نشط";
    case "inactive": return "غير نشط";
    default: return status || "جديد";
  }
}

// ----- 📝 NOTES PARSING / SERIALIZATION HELPERS -----
// This maps 'المسمى الوظيفي' to notes inside DB cleanly [المسمى الوظيفي: JobTitle] actualNotes
function parseNotes(notesStr) {
  const safeNotes = notesStr || "";
  const match = safeNotes.match(/^\[المسمى الوظيفي:\s*(.*?)\]\s*(.*)/s);
  if (match) {
    return {
      jobTitle: match[1].trim(),
      notes: match[2].trim()
    };
  }
  return {
    jobTitle: "",
    notes: safeNotes
  };
}

function formatNotes(jobTitle, notes) {
  const cleanJob = (jobTitle || "").trim();
  const cleanNotes = (notes || "").trim();
  if (cleanJob) {
    return `[المسمى الوظيفي: ${cleanJob}] ${cleanNotes}`;
  }
  return cleanNotes;
}

// ----- 📝 FORM VALIDATIONS -----
function validateContact(data) {
  const errors = {};
  
  // At least one of email or phone must be provided
  if (!data.email && !data.phone) {
    errors.email = "يجب إدخال البريد الإلكتروني أو رقم الجوال على الأقل للتواصل";
    errors.phone = "يجب إدخال رقم الجوال أو البريد الإلكتروني على الأقل للتواصل";
    return errors;
  }
  
  // Email Validation (Optional format check)
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "يرجى إدخال بريد إلكتروني صحيح (مثال: example@domain.com)";
  }
  
  // Phone Validation (Optional format check)
  if (data.phone && data.phone.replace(/\D/g, "").length < 6) {
    errors.phone = "يرجى إدخال رقم جوال صحيح (يجب أن يحتوي على 6 أرقام على الأقل)";
  }
  
  return errors;
}

// ----- 📥 DATABASE OPERATORS (SUPABASE CRUD) -----

// Fetch all contacts (representing Contacts) from Supabase
async function fetchContacts() {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Insert new contact
async function insertContact(contactData) {
  if (!supabaseClient) throw new Error("خدمة الاتصال بقاعدة البيانات غير متصلة.");
  
  // Fetch current user from auth state
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    contactData.created_by = user.id;
    contactData.created_by_email = user.email;
  } else {
    throw new Error("عذراً، يجب تسجيل الدخول أولاً لإضافة جهات تواصل.");
  }
  
  // Client duplicate email verification (only if email is provided)
  if (contactData.email) {
    const isDuplicate = state.contacts.some(c => c.email && c.email.toLowerCase() === contactData.email.toLowerCase());
    if (isDuplicate) {
      throw new Error("عذراً، هذا البريد الإلكتروني مسجل مسبقاً في منصة تمكين.");
    }
  }
  
  const { data, error } = await supabaseClient
    .from("contacts")
    .insert([contactData])
    .select()
    .single();
    
  if (error) {
    if (error.code === "23505") { // Unique key constraint in Postgres
      throw new Error("عذراً، هذا البريد الإلكتروني مسجل مسبقاً بقاعدة بيانات منصة تمكين.");
    }
    throw error;
  }
  return data;
}

// Update contact details
async function updateContact(id, contactData) {
  if (!supabaseClient) throw new Error("خدمة الاتصال بقاعدة البيانات غير متصلة.");
  
  // Client duplicate email check (excluding itself, only if email is provided)
  if (contactData.email) {
    const isDuplicate = state.contacts.some(c => c.id != id && c.email && c.email.toLowerCase() === contactData.email.toLowerCase());
    if (isDuplicate) {
      throw new Error("عذراً، هذا البريد الإلكتروني مسجل مسبقاً لجهة اتصال أخرى في المنصة.");
    }
  }
  
  const { data, error } = await supabaseClient
    .from("contacts")
    .update(contactData)
    .eq("id", id)
    .select()
    .single();
    
  if (error) {
    if (error.code === "23505") {
      throw new Error("عذراً، هذا البريد الإلكتروني مسجل مسبقاً لجهة اتصال أخرى في قاعدة البيانات.");
    }
    throw error;
  }
  return data;
}

// Delete contact from Supabase
async function deleteContactFromDb(id) {
  if (!supabaseClient) throw new Error("خدمة الاتصال بقاعدة البيانات غير متصلة.");
  const { error } = await supabaseClient
    .from("contacts")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

// ----- 💻 RENDERING ENGINE & VIEW POPULATORS -----

// Calculate dashboard counts and distributions
function renderDashboard() {
  const totalContacts = state.contacts.length;
  
  // Calculate unique emails and phones counts
  const uniqueEmails = new Set(state.contacts.map(c => c.email?.toLowerCase()).filter(Boolean)).size;
  const uniquePhones = new Set(state.contacts.map(c => c.phone).filter(Boolean)).size;
  
  // Update UI Stats Cards
  $("#statTotalContacts").textContent = totalContacts;
  $("#statTotalEmails").textContent = uniqueEmails;
  $("#statTotalPhones").textContent = uniquePhones;
  
  // Calculate Distributions (Status & Org/Cities)
  const statusCounts = { new: 0, active: 0, inactive: 0 };
  const cityCounts = {};
  
  state.contacts.forEach(c => {
    // Status distributions
    const st = String(c.status || "new").toLowerCase();
    if (statusCounts[st] !== undefined) {
      statusCounts[st]++;
    } else {
      statusCounts.new++;
    }
    
    // City / Org distributions
    if (c.city && c.city.trim()) {
      const city = c.city.trim();
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
  });
  
  // 1. Status distribution DOM builder
  const statusDistWrap = $("#statusDistributions");
  statusDistWrap.innerHTML = `
    <span class="dist-pill primary">جديد (${statusCounts.new})</span>
    <span class="dist-pill active">نشط (${statusCounts.active})</span>
    <span class="dist-pill inactive">غير نشط (${statusCounts.inactive})</span>
  `;
  
  // 2. City / Org distribution DOM builder
  const cityDistWrap = $("#cityDistributions");
  const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  
  if (sortedCities.length === 0) {
    cityDistWrap.innerHTML = `<span class="placeholder-dist">لا توجد جهات مسجلة حالياً.</span>`;
  } else {
    cityDistWrap.innerHTML = sortedCities.map(([city, count]) => `
      <span class="dist-pill">${escapeHtml(city)} (${count})</span>
    `).join("");
  }
  
  // Render Recently Added Contacts (up to 5 items)
  const recentTableBody = $("#recentContactsTable");
  const recentList = state.contacts.slice(0, 5);
  
  if (recentList.length === 0) {
    recentTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="loading-td">لا توجد أي جهات تواصل مسجلة حالياً في منصة تمكين.</td>
      </tr>
    `;
    return;
  }
  
  recentTableBody.innerHTML = recentList.map(c => {
    const parsed = parseNotes(c.notes);
    return `
      <tr>
        <td data-label="الاسم"><strong>${escapeHtml(c.name || "بدون اسم")}</strong></td>
        <td data-label="الجهة">${escapeHtml(c.city || "-")}</td>
        <td data-label="المسمى الوظيفي">${escapeHtml(parsed.jobTitle || "-")}</td>
        <td data-label="الأمانة">${escapeHtml(c.amanah || "-")}</td>
        <td data-label="رقم الجوال">
          <div class="detail-val-wrap">
            <span class="mono">${escapeHtml(c.phone || "-")}</span>
            ${c.phone ? `<button class="copy-btn" data-copy="${escapeHtml(c.phone)}">نسخ الرقم</button>` : ""}
          </div>
        </td>
        <td data-label="البريد الإلكتروني">
          <div class="detail-val-wrap">
            <span class="mono">${escapeHtml(c.email || "-")}</span>
            ${c.email ? `<button class="copy-btn" data-copy="${escapeHtml(c.email)}">نسخ البريد</button>` : ""}
          </div>
        </td>
        <td data-label="تاريخ الإضافة">${formatDate(c.created_at)}</td>
      </tr>
    `;
  }).join("");
  
  // Re-bind Copy Event Handlers for Dashboard table
  bindCopyHandlers();
}

// Populate City (Org) Filter dynamic dropdown selector
function populateFilterDropdowns() {
  const citySelect = $("#filterCity");
  
  if (!citySelect) return;
  
  // Save current dynamic select value to avoid resetting user selection
  const currentCityVal = citySelect.value;
  
  // Get all unique values
  const uniqueCities = [...new Set(state.contacts.map(c => c.city?.trim()).filter(Boolean))].sort();
  
  // Populate City
  citySelect.innerHTML = `<option value="">الكل (${state.contacts.length})</option>` +
    uniqueCities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    
  // Restore selections if still valid
  if (uniqueCities.includes(currentCityVal)) {
    citySelect.value = currentCityVal;
  }
}

// Global Text Copy Event Bindings
function bindCopyHandlers() {
  $$(".copy-btn").forEach(btn => {
    // Avoid double bindings
    if (btn.dataset.bound) return;
    btn.dataset.bound = "true";
    
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        const originalText = btn.textContent;
        btn.textContent = "تم النسخ ✓";
        btn.classList.add("copied");
        toast("تم النسخ بنجاح!", "success");
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove("copied");
        }, 1800);
      } catch (err) {
        toast("فشل عملية نسخ النص", "error");
      }
    });
  });
}

// Render search contacts grid with multi-parameters matching & pagination
function renderSearchTab() {
  const container = $("#contactsContainer");
  if (!container) return;
  
  const query = state.searchQuery.trim().toLowerCase();
  const fAmanah = state.filters.amanah;
  const fCity = state.filters.city;
  const fStatus = state.filters.status;
  
  // Perform search matching
  const filtered = state.contacts.filter(c => {
    // 1. Text Query Filter (searches name, email, phone, amanah, city, notes, status)
    if (query) {
      const parsed = parseNotes(c.notes);
      const matchText = [
        c.name, c.email, c.phone, c.amanah, c.city, parsed.jobTitle, parsed.notes, translateStatus(c.status)
      ].map(v => String(v ?? "").toLowerCase()).join(" ");
      
      if (!matchText.includes(query)) return false;
    }
    
    // 2. Dropdown Filters
    if (fAmanah && (c.amanah || "").trim() !== fAmanah) return false;
    if (fCity && (c.city || "").trim() !== fCity) return false;
    if (fStatus && String(c.status || "new").toLowerCase() !== fStatus) return false;
    
    return true;
  });
  
  // Update matching count label
  $("#resultsCount").textContent = `تم العثور على ${filtered.length} جهة اتصال تطابق البحث والفرز الحالي`;
  
  const paginationWrap = $("#paginationWrap");
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty animate-fadeIn">
        <div class="empty-icon">📭</div>
        <p>لم يتم العثور على أي نتائج تطابق البحث والفلاتر الحالية</p>
      </div>
    `;
    if (paginationWrap) paginationWrap.style.display = "none";
    return;
  }
  
  if (paginationWrap) paginationWrap.style.display = "flex";
  
  // Calculate Pagination Page Boundaries
  const page = state.pagination.page;
  const pageSize = state.pagination.pageSize;
  const totalPages = Math.ceil(filtered.length / pageSize);
  
  // Clamp page between 1 and totalPages
  let activePage = Math.min(page, totalPages);
  if (activePage < 1) activePage = 1;
  state.pagination.page = activePage;
  
  const startIdx = (activePage - 1) * pageSize;
  const slicedContacts = filtered.slice(startIdx, startIdx + pageSize);
  
  // Update Pagination navigation text & buttons state
  $("#pageNumLabel").textContent = `صفحة ${activePage} من ${totalPages}`;
  $("#prevPageBtn").disabled = activePage === 1;
  $("#nextPageBtn").disabled = activePage === totalPages;
  
  // Render Contacts cards
  container.innerHTML = `
    <div class="contacts-grid animate-slideUp">
      ${slicedContacts.map(c => {
        const parsed = parseNotes(c.notes);
        return `
          <div class="contact-card">
            <div class="contact-header">
              <div class="contact-brand">
                <div class="avatar">${escapeHtml(getInitials(c.name || c.email))}</div>
                <div class="contact-title">
                  <h4>${escapeHtml(c.name || "جهة بدون اسم")}</h4>
                  <span class="contact-date">تم الحفظ: ${formatDate(c.created_at)}</span>
                </div>
              </div>
              
              <div class="contact-card-actions">
                <button class="btn-card-action edit-action-btn" data-id="${c.id}" title="تعديل">✏️</button>
                <button class="btn-card-action danger delete-action-btn" data-id="${c.id}" title="حذف">🗑️</button>
              </div>
            </div>
            
            <div class="contact-details">
              <div class="detail-item">
                <span class="detail-label">الجهة</span>
                <span class="detail-value">${escapeHtml(c.city || "-")}</span>
              </div>

              <div class="detail-item">
                <span class="detail-label">المسمى الوظيفي</span>
                <span class="detail-value" style="font-weight: 700; color: var(--primary);">${escapeHtml(parsed.jobTitle || "-")}</span>
              </div>

              <div class="detail-item">
                <span class="detail-label">الأمانة</span>
                <span class="detail-value">${escapeHtml(c.amanah || "-")}</span>
              </div>

              <div class="detail-item">
                <span class="detail-label">رقم الجوال</span>
                <div class="detail-val-wrap">
                  <span class="detail-value mono">${escapeHtml(c.phone || "-")}</span>
                  ${c.phone ? `<button class="copy-btn" data-copy="${escapeHtml(c.phone)}">نسخ الرقم</button>` : ""}
                </div>
              </div>

              <div class="detail-item">
                <span class="detail-label">البريد الإلكتروني</span>
                <div class="detail-val-wrap">
                  <span class="detail-value mono">${escapeHtml(c.email || "-")}</span>
                  ${c.email ? `<button class="copy-btn" data-copy="${escapeHtml(c.email)}">نسخ البريد</button>` : ""}
                </div>
              </div>
              
              <div class="detail-item">
                <span class="detail-label">حالة التواصل</span>
                <span class="status-badge ${escapeHtml(c.status || "new")}">
                  ${translateStatus(c.status)}
                </span>
              </div>
              
              ${parsed.notes ? `
                <div class="contact-notes">
                  <strong>ملاحظات:</strong>
                  <p>${escapeHtml(parsed.notes)}</p>
                </div>
              ` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
  
  // Re-bind click actions and copy functions inside cards
  bindCopyHandlers();
  bindCardActionHandlers();
}

// Bind events on individual cards actions (Edit/Delete clicks)
function bindCardActionHandlers() {
  // Edit Clicks
  $$(".edit-action-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const contact = state.contacts.find(c => c.id == id);
      if (contact) {
        openEditModal(contact);
      }
    });
  });
  
  // Delete Clicks
  $$(".delete-action-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const contact = state.contacts.find(c => c.id == id);
      if (contact) {
        openDeleteConfirmModal(contact);
      }
    });
  });
}

// Load dynamic data from Supabase and render
async function refreshApplicationState() {
  const container = $("#contactsContainer");
  const recentTableBody = $("#recentContactsTable");
  
  if (typeof updateDiagContacts === 'function') updateDiagContacts("Fetching...", "#f59e0b");
  
  try {
    // Diagnostic manual fetch test
    console.log("🌐 Diagnostic: Starting manual HTTP fetch test to Supabase...");
    window.fetch(`${SUPABASE_URL}/rest/v1/contacts?select=*`, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    })
    .then(res => {
      console.log(`🌐 Diagnostic: Manual fetch status = ${res.status} (${res.statusText})`);
      return res.json();
    })
    .then(data => {
      console.log(`🌐 Diagnostic: Manual fetch success! Found ${data.length} records.`);
    })
    .catch(err => {
      console.error(`❌ Diagnostic: Manual fetch failed:`, err.message || err);
    });

    // Fetch
    state.contacts = await fetchContacts();
    
    if (typeof updateDiagContacts === 'function') updateDiagContacts(`Loaded (${state.contacts.length}) ✓`, "#10b981");
    
    // Render
    renderDashboard();
    populateFilterDropdowns();
    renderSearchTab();
    
    // Status text update
    const dbStatus = $("#dbStatus");
    if (dbStatus) {
      dbStatus.className = "connection-status connected";
      dbStatus.querySelector(".status-text").textContent = "متصل بقاعدة البيانات";
    }
  } catch (err) {
    console.error("❌ Application database connection error:", err);
    toast("خطأ أثناء الاتصال بخادم قاعدة بيانات منصة تمكين", "error");
    
    if (typeof updateDiagContacts === 'function') updateDiagContacts("Failed ❌", "#ef4444");
    if (typeof showDiagError === 'function') showDiagError(err.message || String(err));
    
    const dbStatus = $("#dbStatus");
    if (dbStatus) {
      dbStatus.className = "connection-status disconnected";
      dbStatus.querySelector(".status-text").textContent = "خطأ في الاتصال";
    }
    
    if (container) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠️</div>
          <p>تعذر تحميل جهات التواصل. يرجى التحقق من صلاحيات Supabase أو اتصال الشبكة.</p>
        </div>
      `;
    }
    if (recentTableBody) {
      recentTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="loading-td text-danger">خطأ في جلب البيانات من الخادم.</td>
        </tr>
      `;
    }
  }
}

// ----- 🧭 TAB CONTROL & NAVIGATION -----
function switchTab(tabName) {
  state.activeTab = tabName;
  
  // Toggle Sidebar Link states
  $$(".nav-item").forEach(el => {
    if (el.dataset.tab === tabName) el.classList.add("active");
    else el.classList.remove("active");
  });
  
  // Toggle Tab content wrappers
  $$(".tab-content").forEach(el => {
    if (el.id === `tab-${tabName}`) el.classList.add("active");
    else el.classList.remove("active");
  });
  
  // Update header text dynamically
  const heading = $("#pageHeading");
  const subHeading = $("#pageSubheading");
  
  if (tabName === "dashboard") {
    heading.textContent = "لوحة التحكم";
    subHeading.textContent = "إحصائيات وقراءات سريعة لجهات التواصل المسجلة";
    renderDashboard(); // refresh totals
  } else if (tabName === "search") {
    heading.textContent = "البحث السريع";
    subHeading.textContent = "ابحث في قاعدة بيانات جهات التواصل مع فلاتر ذكية وسريعة";
    renderSearchTab();
  } else if (tabName === "add") {
    heading.textContent = "إضافة جهة تواصل";
    subHeading.textContent = "تسجيل جهة تواصل أو شخصية جديدة في دليل منصة تمكين";
  }
  
  // Auto collapse mobile drawer on tab click
  $("#sidebar").classList.remove("active");
  const sidebarBackdrop = $("#sidebarBackdrop");
  if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
}

// ----- ✏️ EDIT CONTACT FORM MODAL ACTIONS -----
const editModal = $("#editContactModal");
const editForm = $("#editContactForm");

function openEditModal(contact) {
  if (!editModal || !editForm) return;
  
  // Clear error messages
  $$("#editContactForm .error-msg").forEach(el => el.textContent = "");
  
  const parsed = parseNotes(contact.notes);
  
  // Populate field values
  $("#edit-id").value = contact.id;
  $("#edit-email").value = contact.email || "";
  $("#edit-phone").value = contact.phone || "";
  $("#edit-name").value = contact.name || "";
  $("#edit-amanah").value = contact.amanah || "";
  $("#edit-city").value = contact.city || "";
  $("#edit-status").value = contact.status || "new";
  $("#edit-job").value = parsed.jobTitle || "";
  $("#edit-notes").value = parsed.notes || "";
  
  // Show modal drawer overlay
  editModal.classList.add("active");
  editModal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  if (!editModal) return;
  editModal.classList.remove("active");
  editModal.setAttribute("aria-hidden", "true");
  editForm.reset();
}

// Submit edit handler
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Clear errors
    $$("#editContactForm .error-msg").forEach(el => el.textContent = "");
    
    const id = $("#edit-id").value;
    
    // Package notes with Job Title correctly
    const jobTitle = $("#edit-job").value.trim();
    const rawNotes = $("#edit-notes").value.trim();
    const serializedNotes = formatNotes(jobTitle, rawNotes);

    const contactData = {
      email: $("#edit-email").value.trim() || null,
      phone: $("#edit-phone").value.trim() || null,
      name: $("#edit-name").value.trim() || null,
      amanah: $("#edit-amanah").value.trim() || null,
      city: $("#edit-city").value.trim() || null,
      status: $("#edit-status").value || "new",
      notes: serializedNotes || null
    };
    
    // Validate
    const errors = validateContact(contactData);
    if (Object.keys(errors).length > 0) {
      Object.entries(errors).forEach(([field, msg]) => {
        const errEl = $(`#err-edit-${field}`);
        if (errEl) errEl.textContent = msg;
      });
      return;
    }
    
    const submitBtn = $("#editSubmitBtn");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "جاري الحفظ...";
    
    try {
      const updatedContact = await updateContact(id, contactData);
      
      // Update local state array
      const idx = state.contacts.findIndex(c => c.id == id);
      if (idx !== -1) {
        state.contacts[idx] = updatedContact;
      }
      
      toast("تم تعديل جهة التواصل بنجاح ✓", "success");
      closeEditModal();
      
      // Re-render
      renderDashboard();
      populateFilterDropdowns();
      renderSearchTab();
    } catch (err) {
      console.error(err);
      toast(err.message || "فشل تعديل جهة التواصل في قاعدة البيانات.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// ----- 🗑️ DELETE CONTACT DIALOG ACTIONS -----
const deleteModal = $("#deleteConfirmModal");

function openDeleteConfirmModal(contact) {
  if (!deleteModal) return;
  state.deleteTarget = contact;
  $("#deleteTargetName").textContent = contact.name || contact.email || "جهة بدون اسم";
  
  deleteModal.classList.add("active");
  deleteModal.setAttribute("aria-hidden", "false");
}

function closeDeleteConfirmModal() {
  if (!deleteModal) return;
  deleteModal.classList.remove("active");
  deleteModal.setAttribute("aria-hidden", "true");
  state.deleteTarget = null;
}

// Confirm Delete Click
const confirmDeleteBtn = $("#confirmDeleteBtn");
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", async () => {
    if (!state.deleteTarget) return;
    
    const id = state.deleteTarget.id;
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = "جاري الحذف...";
    
    try {
      await deleteContactFromDb(id);
      
      // Update local state
      state.contacts = state.contacts.filter(c => c.id != id);
      
      toast("تم حذف جهة التواصل نهائياً بنجاح.", "success");
      closeDeleteConfirmModal();
      
      // Re-render
      renderDashboard();
      populateFilterDropdowns();
      renderSearchTab();
    } catch (err) {
      console.error(err);
      toast("فشل عملية الحذف من قاعدة البيانات", "error");
    } finally {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "حذف";
    }
  });
}

// ----- ⚡ ADD NEW CONTACT FORM HANDLER -----
const addForm = $("#addContactForm");
if (addForm) {
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Clear errors
    $$("#addContactForm .error-msg").forEach(el => el.textContent = "");
    
    // Package notes with Job Title correctly
    const jobTitle = $("#c-job").value.trim();
    const rawNotes = $("#c-notes").value.trim();
    const serializedNotes = formatNotes(jobTitle, rawNotes);

    const contactData = {
      email: $("#c-email").value.trim() || null,
      phone: $("#c-phone").value.trim() || null,
      name: $("#c-name").value.trim() || null,
      amanah: $("#c-amanah").value.trim() || null,
      city: $("#c-city").value.trim() || null,
      status: "new",
      notes: serializedNotes || null
    };
    
    // Validate
    const errors = validateContact(contactData);
    if (Object.keys(errors).length > 0) {
      Object.entries(errors).forEach(([field, msg]) => {
        const errEl = $(`#err-${field}`);
        if (errEl) errEl.textContent = msg;
      });
      return;
    }
    
    const submitBtn = $("#submitBtn");
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳</span> <span>جاري حفظ البيانات...</span>`;
    
    try {
      const savedContact = await insertContact(contactData);
      
      // Unshift to local state
      state.contacts.unshift(savedContact);
      
      toast("تم حفظ جهة التواصل بنجاح ✓", "success");
      addForm.reset();
      
      // Switch back to Search tab to show newly added item
      setTimeout(() => {
        switchTab("search");
      }, 500);
    } catch (err) {
      console.error(err);
      toast(err.message || "تعذر حفظ جهة التواصل في قاعدة البيانات.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
  
  // Form Reset Button
  const resetBtn = $("#resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      addForm.reset();
      $$("#addContactForm .error-msg").forEach(el => el.textContent = "");
    });
  }
}

// ----- 🔍 LIVE FILTER / SEARCH INTERACTIVE EVENTS -----

// Debounced Text search query input
let searchDebounce = null;
const searchInput = $("#contactsSearch");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchQuery = e.target.value;
      state.pagination.page = 1; // Reset pagination page to 1 on new search
      renderSearchTab();
    }, 150);
  });
}

// Dropdown Filters selection listeners
const amanahFilter = $("#filterAmanah");
if (amanahFilter) {
  amanahFilter.addEventListener("change", (e) => {
    state.filters.amanah = e.target.value;
    state.pagination.page = 1;
    renderSearchTab();
  });
}

const cityFilter = $("#filterCity");
if (cityFilter) {
  cityFilter.addEventListener("change", (e) => {
    state.filters.city = e.target.value;
    state.pagination.page = 1;
    renderSearchTab();
  });
}

const statusFilter = $("#filterStatus");
if (statusFilter) {
  statusFilter.addEventListener("change", (e) => {
    state.filters.status = e.target.value;
    state.pagination.page = 1;
    renderSearchTab();
  });
}

// Reset Filters Button
const resetFiltersBtn = $("#resetFiltersBtn");
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (amanahFilter) amanahFilter.value = "";
    if (cityFilter) cityFilter.value = "";
    if (statusFilter) statusFilter.value = "";
    
    state.searchQuery = "";
    state.filters = { amanah: "", city: "", status: "" };
    state.pagination.page = 1;
    
    toast("تم إعادة تعيين الفلاتر بنجاح", "info");
    renderSearchTab();
  });
}

// ----- 📄 PAGINATION INTERACTIVE LISTENERS -----
const pageSizeSelect = $("#pageSizeSelect");
if (pageSizeSelect) {
  pageSizeSelect.addEventListener("change", (e) => {
    state.pagination.pageSize = parseInt(e.target.value) || 10;
    state.pagination.page = 1;
    renderSearchTab();
  });
}

const prevPageBtn = $("#prevPageBtn");
if (prevPageBtn) {
  prevPageBtn.addEventListener("click", () => {
    if (state.pagination.page > 1) {
      state.pagination.page--;
      renderSearchTab();
    }
  });
}

const nextPageBtn = $("#nextPageBtn");
if (nextPageBtn) {
  nextPageBtn.addEventListener("click", () => {
    state.pagination.page++;
    renderSearchTab();
  });
}

// ----- 📱 MOBILE SIDEBAR DRAWER INTERACTION -----
const sidebar = $("#sidebar");
const menuToggle = $("#menuToggle");
const closeSidebar = $("#closeSidebar");
const sidebarBackdrop = $("#sidebarBackdrop");

if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("active");
    if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
  });
}

if (closeSidebar && sidebar) {
  closeSidebar.addEventListener("click", () => {
    sidebar.classList.remove("active");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
  });
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", () => {
    sidebar.classList.remove("active");
    sidebarBackdrop.classList.remove("active");
  });
}

// Click outside drawer to close it
document.addEventListener("click", (e) => {
  if (sidebar && sidebar.classList.contains("active")) {
    if (!sidebar.contains(e.target) && e.target !== menuToggle && (!sidebarBackdrop || e.target !== sidebarBackdrop)) {
      sidebar.classList.remove("active");
      if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
    }
  }
});

// ----- 🧭 NAVIGATION MENU BINDINGS -----
$$(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    switchTab(item.dataset.tab);
  });
});

// Shortcut dashboard buttons
const shortcutSearchBtn = $("#shortcutSearchBtn");
if (shortcutSearchBtn) {
  shortcutSearchBtn.addEventListener("click", () => {
    switchTab("search");
  });
}

const shortcutAddBtn = $("#shortcutAddBtn");
if (shortcutAddBtn) {
  shortcutAddBtn.addEventListener("click", () => {
    switchTab("add");
  });
}

const viewAllRecentBtn = $("#viewAllRecentBtn");
if (viewAllRecentBtn) {
  viewAllRecentBtn.addEventListener("click", () => {
    switchTab("search");
  });
}

// Modal cancel buttons and background overlays
$$("#closeEditModalBtn, #cancelEditBtn").forEach(btn => {
  btn.addEventListener("click", closeEditModal);
});

$$("#cancelDeleteBtn").forEach(btn => {
  btn.addEventListener("click", closeDeleteConfirmModal);
});

// Close modals when clicking on their blur background
$$(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeEditModal();
      closeDeleteConfirmModal();
    }
  });
});

// ----- 🔒 AUTHENTICATION MANAGER -----
async function initAuth() {
  if (!supabaseClient) return;

  // Listen to Auth State Changes
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log(`🔐 Auth event: ${event}`, session);
    
    const loginWrapper = $("#loginWrapper");
    const adminWrapper = $("#adminWrapper");
    const allowedEmail = (window.APP_CONFIG?.ALLOWED_EMAIL || "").trim().toLowerCase();

    if (session) {
      if (typeof updateDiagAuth === 'function') updateDiagAuth(session.user.email, "#10b981");
      
      // Layer 2 Security: If authenticated email doesn't match the allowed email, force logout
      if (allowedEmail && session.user?.email && session.user.email.trim().toLowerCase() !== allowedEmail) {
        console.warn("⚠️ Unauthorized session blocked:", session.user.email);
        toast("عذراً، هذا البريد الإلكتروني غير مصرح له بالدخول لهذه المنصة.", "error");
        
        // Force logout
        await supabaseClient.auth.signOut();
        
        if (adminWrapper) adminWrapper.style.display = "none";
        if (loginWrapper) loginWrapper.style.display = "flex";
        state.contacts = [];
        renderDashboard();
        return;
      }

      // User is Authenticated & Authorized
      if (loginWrapper) loginWrapper.style.display = "none";
      if (adminWrapper) adminWrapper.style.display = "flex";
      
      // Load and refresh state
      await refreshApplicationState();
    } else {
      if (typeof updateDiagAuth === 'function') updateDiagAuth("Logged Out", "#ef4444");
      
      // User is Unauthenticated
      if (adminWrapper) adminWrapper.style.display = "none";
      if (loginWrapper) loginWrapper.style.display = "flex";
      
      // Clear loaded state to protect user directory information
      state.contacts = [];
      renderDashboard();
    }
  });

  // Bind Login Form Submission
  const loginForm = $("#loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Clear previous error messages
      const errEmail = $("#err-login-email");
      const errPassword = $("#err-login-password");
      if (errEmail) errEmail.textContent = "";
      if (errPassword) errPassword.textContent = "";
      
      const email = $("#l-email").value.trim();
      const password = $("#l-password").value;
      
      let hasError = false;
      if (!email) {
        if (errEmail) errEmail.textContent = "يرجى إدخال البريد الإلكتروني";
        hasError = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errEmail) errEmail.textContent = "يرجى إدخال بريد إلكتروني صحيح (مثال: email@domain.com)";
        hasError = true;
      }
      
      if (!password) {
        if (errPassword) errPassword.textContent = "يرجى إدخال كلمة المرور";
        hasError = true;
      }
      
      if (hasError) return;

      // Layer 1 Security: Client form validation before sending request
      const allowedEmail = (window.APP_CONFIG?.ALLOWED_EMAIL || "").trim().toLowerCase();
      console.log("🔒 [تمكين - أمان] مقارنة البريد الإلكتروني:", {
        entered: email.trim().toLowerCase(),
        allowed: allowedEmail,
        isMatch: email.trim().toLowerCase() === allowedEmail,
        allConfig: window.APP_CONFIG
      });
      if (allowedEmail && email.trim().toLowerCase() !== allowedEmail) {
        const errorMsg = "عذراً، هذا البريد الإلكتروني غير مصرح له بتسجيل الدخول.";
        if (errEmail) errEmail.textContent = errorMsg;
        toast(errorMsg, "error");
        return;
      }
      
      const submitBtn = $("#loginSubmitBtn");
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳ جاري تسجيل الدخول...</span>`;
      
      try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast("تم تسجيل الدخول بنجاح!", "success");
      } catch (err) {
        console.error("❌ Login error:", err);
        let errorMsg = "فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.";
        if (err.message === "Invalid login credentials") {
          errorMsg = "عذراً، البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        } else if (err.message === "Email not confirmed") {
          errorMsg = "عذراً، البريد الإلكتروني لم يتم تأكيده بعد.";
        }
        toast(errorMsg, "error");
        if (errPassword) errPassword.textContent = errorMsg;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Bind Logout Button with Global Event Delegation & Ultra-Defensive Fallback
  document.addEventListener("click", async (e) => {
    const logoutBtn = e.target.closest("#logoutBtn");
    if (logoutBtn) {
      e.preventDefault();
      console.log("🚪 [تمكين - أمان] تم الضغط على زر تسجيل الخروج");
      
      // 1. Force Immediate UI Logout & State Reset (Guarantees visual safety instantly)
      const loginWrapper = $("#loginWrapper");
      const adminWrapper = $("#adminWrapper");
      if (adminWrapper) adminWrapper.style.display = "none";
      if (loginWrapper) loginWrapper.style.display = "flex";
      
      state.contacts = [];
      renderDashboard();
      
      // 2. Manually purge Supabase tokens from Storage (Bypasses storage access blocks)
      try {
        const purgeKeys = (storage) => {
          if (!storage) return;
          const keys = [];
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.includes("supabase")) {
              keys.push(key);
            }
          }
          keys.forEach(k => storage.removeItem(k));
        };
        purgeKeys(window.localStorage);
        purgeKeys(window.sessionStorage);
        console.log("🧼 [تمكين - أمان] تم تنظيف التخزين المحلي يدوياً");
      } catch (storageErr) {
        console.warn("⚠️ Failed to purge storage manually:", storageErr);
      }

      // 3. Attempt standard Supabase SignOut in background
      try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        toast("تم تسجيل الخروج بنجاح.", "info");
      } catch (err) {
        console.warn("⚠️ Standard SignOut blocked or failed, fallback succeeded:", err);
        toast("تم تسجيل الخروج وتأمين الواجهة بنجاح.", "info");
      }
    }
  });
}

// ----- 🚀 APP BOOTSTRAP -----
async function bootstrap() {
  // تهيئة لوحة التشخيص المرئية لتتبع حالة الأخطاء
  try {
    initDiagnostics();
  } catch (diagErr) {
    console.warn("⚠️ Failed to initialize diagnostics layout:", diagErr);
  }

  if (supabaseClient) {
    await initAuth();
  } else {
    // Show Warning Banner if Supabase is offline
    const banner = document.createElement("div");
    banner.style.background = "#ef4444";
    banner.style.color = "white";
    banner.style.padding = "14px";
    banner.style.textAlign = "center";
    banner.style.fontWeight = "800";
    banner.style.position = "fixed";
    banner.style.top = "0";
    banner.style.left = "0";
    banner.style.width = "100%";
    banner.style.zIndex = "999999";
    banner.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
    banner.textContent = "⚠️ عذراً: تعذر الاتصال بـ Supabase. يرجى تهيئة المفاتيح بشكل صحيح وتنشيط الإنترنت.";
    document.body.appendChild(banner);
    
    if (typeof showDiagError === 'function') {
      showDiagError("Supabase credentials missing or invalid in config.js");
    }
  }
}

// ----- 🛠️ VISUAL DIAGNOSTICS SYSTEM IMPLEMENTATION -----
function initDiagnostics() {
  const diag = document.createElement("div");
  diag.id = "tamekeen-diagnostics";
  diag.style.cssText = "position: fixed; bottom: 10px; left: 10px; z-index: 999999; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); color: #f8fafc; padding: 12px 18px; border-radius: 12px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); width: 290px; direction: ltr; text-align: left;";
  diag.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
      <strong style="color: #10b981; font-size: 13px;">🛠️ Tamekeen Diagnostics</strong>
      <button onclick="document.getElementById('tamekeen-diagnostics').remove()" style="background: none; border: none; color: #ef4444; cursor: pointer; font-weight: bold; font-size: 14px; padding: 0 4px;">✕</button>
    </div>
    <div style="display: grid; grid-template-columns: 110px 1fr; gap: 4px; line-height: 1.4;">
      <span>Config:</span><strong id="diag-config" style="color: #ef4444;">Not Loaded</strong>
      <span>Supabase Url:</span><strong id="diag-url" style="color: #ef4444;">None</strong>
      <span>Supabase Client:</span><strong id="diag-client" style="color: #ef4444;">Not Init</strong>
      <span>User Auth:</span><strong id="diag-auth" style="color: #f59e0b;">Checking...</strong>
      <span>Database Fetch:</span><strong id="diag-contacts" style="color: #f59e0b;">Waiting...</strong>
      <span>Protocol:</span><strong id="diag-protocol" style="color: #3b82f6;">Unknown</strong>
    </div>
    <div id="diag-err-box" style="margin-top: 8px; color: #f87171; font-size: 11px; max-height: 80px; overflow-y: auto; word-break: break-all; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px; display: none;">
      <strong>Error:</strong> <span id="diag-err-text"></span>
    </div>
    <div id="diag-console-box" style="margin-top: 8px; max-height: 120px; overflow-y: auto; font-family: monospace; font-size: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; display: none;">
      <strong style="color: #38bdf8; display: block; margin-bottom: 2px;">Console Logs:</strong>
    </div>
  `;
  document.body.appendChild(diag);

  // Intercept and print console events dynamically to assist real-time debugging
  const oldConsoleLog = console.log;
  const oldConsoleWarn = console.warn;
  const oldConsoleError = console.error;

  const logToDiag = (msg, color = "#f8fafc") => {
    const box = document.getElementById("diag-console-box");
    if (box) {
      box.style.display = "block";
      const div = document.createElement("div");
      div.style.borderBottom = "1px dashed rgba(255,255,255,0.05)";
      div.style.padding = "2px 0";
      div.style.color = color;
      div.style.whiteSpace = "pre-wrap";
      div.style.wordBreak = "break-all";
      div.textContent = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);
      
      // Insert after the title header
      if (box.children.length > 1) {
        box.insertBefore(div, box.children[1]);
      } else {
        box.appendChild(div);
      }
      
      // Limit to 10 lines
      if (box.children.length > 11) {
        box.removeChild(box.lastChild);
      }
    }
  };

  console.log = function(...args) {
    oldConsoleLog.apply(console, args);
    logToDiag(args.join(" "), "#38bdf8");
  };
  console.warn = function(...args) {
    oldConsoleWarn.apply(console, args);
    logToDiag(args.join(" "), "#fbbf24");
  };
  console.error = function(...args) {
    oldConsoleError.apply(console, args);
    logToDiag(args.join(" "), "#f87171");
  };

  window.addEventListener('error', function(e) {
    logToDiag(`JS Error: ${e.message} at ${e.filename}:${e.lineno}`, "#f87171");
  });
  window.addEventListener('unhandledrejection', function(e) {
    logToDiag(`Promise Rejection: ${e.reason?.message || e.reason || 'Unhandled rejection'}`, "#f87171");
  });

  // Update static fields immediately
  const protocol = window.location.protocol;
  document.getElementById("diag-protocol").textContent = protocol;
  if (protocol === "file:") {
    document.getElementById("diag-protocol").style.color = "#f59e0b";
    document.getElementById("diag-protocol").textContent = "file:// (Blocked Storage)";
  } else {
    document.getElementById("diag-protocol").style.color = "#10b981";
  }

  if (window.APP_CONFIG) {
    document.getElementById("diag-config").textContent = "Loaded ✓";
    document.getElementById("diag-config").style.color = "#10b981";
    document.getElementById("diag-url").textContent = window.APP_CONFIG.SUPABASE_URL ? "Defined ✓" : "Missing ❌";
    document.getElementById("diag-url").style.color = window.APP_CONFIG.SUPABASE_URL ? "#10b981" : "#ef4444";
  } else {
    document.getElementById("diag-config").textContent = "Missing ❌";
    document.getElementById("diag-config").style.color = "#ef4444";
  }

  if (supabaseClient) {
    document.getElementById("diag-client").textContent = "Initialized ✓";
    document.getElementById("diag-client").style.color = "#10b981";
  } else {
    document.getElementById("diag-client").textContent = "Failed ❌";
    document.getElementById("diag-client").style.color = "#ef4444";
  }
}

function updateDiagAuth(text, color) {
  const el = document.getElementById("diag-auth");
  if (el) {
    el.textContent = text;
    if (color) el.style.color = color;
  }
}

function updateDiagContacts(text, color) {
  const el = document.getElementById("diag-contacts");
  if (el) {
    el.textContent = text;
    if (color) el.style.color = color;
  }
}

function showDiagError(errText) {
  const box = document.getElementById("diag-err-box");
  const txt = document.getElementById("diag-err-text");
  if (box && txt) {
    box.style.display = "block";
    txt.textContent = errText;
  }
  // Also link to window error display
  console.error("Diagnostic Error Captured:", errText);
}

bootstrap();

