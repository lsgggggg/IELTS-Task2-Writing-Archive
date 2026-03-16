// ========== View Switcher ==========
function switchView(viewId) {
  const panels = document.querySelectorAll('.view-panel');
  const tabs = document.querySelectorAll('.view-tab');
  panels.forEach(p => p.classList.remove('active'));
  tabs.forEach(t => t.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
  const activeTab = document.querySelector(`[data-view="${viewId}"]`);
  if (activeTab) activeTab.classList.add('active');
}

// ========== Accordion ==========
function toggleAccordion(el) {
  const item = el.closest('.accordion-item');
  if (item) item.classList.toggle('open');
}

// ========== Filter ==========
function filterItems(group, value) {
  const btns = document.querySelectorAll(`.filter-group[data-group="${group}"] .filter-btn`);
  btns.forEach(b => b.classList.remove('active'));
  event.currentTarget.classList.add('active');
  const items = document.querySelectorAll(`[data-${group}]`);
  items.forEach(item => {
    if (value === 'all' || item.dataset[group] === value) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// ================================================================
//  Recycle Bin System (回收站)
//  - trashedEssays: 在回收站中（可恢复）
//  - permanentlyDeleted: 彻底删除（不可恢复）
// ================================================================

function getTrashedEssays() {
  try { return JSON.parse(localStorage.getItem('trashedEssays') || '[]'); }
  catch(e) { return []; }
}

function getPermanentlyDeleted() {
  try { return JSON.parse(localStorage.getItem('permanentlyDeleted') || '[]'); }
  catch(e) { return []; }
}

function isHiddenEssay(essayId) {
  return getTrashedEssays().includes(essayId) || getPermanentlyDeleted().includes(essayId);
}

// --- Migrate old data: convert old deletedEssays to trashedEssays ---
function migrateOldData() {
  try {
    const old = JSON.parse(localStorage.getItem('deletedEssays') || '[]');
    if (old.length > 0) {
      const trashed = getTrashedEssays();
      old.forEach(id => { if (!trashed.includes(id)) trashed.push(id); });
      localStorage.setItem('trashedEssays', JSON.stringify(trashed));
      localStorage.removeItem('deletedEssays');
    }
  } catch(e) {}
}

// --- Move to Recycle Bin ---
function deleteEssay(essayId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">移入回收站</div>
      <div class="modal-body">
        确定要将这篇作文移入回收站吗？<br>
        移入后，所有页面中与该作文相关的内容将暂时隐藏。<br>
        <span style="color:#38a169; font-weight:600;">你可以随时从回收站中恢复。</span>
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="modal-btn modal-btn-confirm" style="background:#dd6b20;" onclick="confirmTrash('${essayId}')">移入回收站</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function confirmTrash(essayId) {
  const trashed = getTrashedEssays();
  if (!trashed.includes(essayId)) {
    trashed.push(essayId);
    localStorage.setItem('trashedEssays', JSON.stringify(trashed));
  }
  document.querySelector('.modal-overlay')?.remove();
  applyHiddenEssays();
  // If on the trashed essay's own page, redirect
  if (document.body.dataset.essayPage === essayId) {
    const basePath = window.location.pathname.includes('/essays/') ? '../index.html' : 'index.html';
    window.location.href = basePath;
  }
}

// --- Restore from Recycle Bin ---
function restoreEssay(essayId) {
  const trashed = getTrashedEssays().filter(id => id !== essayId);
  localStorage.setItem('trashedEssays', JSON.stringify(trashed));
  // Reload to re-render all content (elements were removed from DOM)
  window.location.reload();
}

// --- Permanently Delete ---
function permanentlyDeleteEssay(essayId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title" style="color:#e53e3e;">彻底删除</div>
      <div class="modal-body">
        <strong style="color:#e53e3e;">此操作不可撤回！</strong><br><br>
        彻底删除后，该作文将永远不再显示在网页中。<br>
        （磁盘上的文件不会被删除，如需恢复需手动清除浏览器 localStorage。）
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="modal-btn modal-btn-confirm" onclick="confirmPermanentDelete('${essayId}')">彻底删除</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function confirmPermanentDelete(essayId) {
  // Remove from trashed
  const trashed = getTrashedEssays().filter(id => id !== essayId);
  localStorage.setItem('trashedEssays', JSON.stringify(trashed));
  // Add to permanently deleted
  const permaDeleted = getPermanentlyDeleted();
  if (!permaDeleted.includes(essayId)) {
    permaDeleted.push(essayId);
    localStorage.setItem('permanentlyDeleted', JSON.stringify(permaDeleted));
  }
  document.querySelector('.modal-overlay')?.remove();
  // Reload
  window.location.reload();
}

// --- Apply hidden state to all pages ---
function applyHiddenEssays() {
  const trashed = getTrashedEssays();
  const perma = getPermanentlyDeleted();
  const allHidden = [...trashed, ...perma];
  if (allHidden.length === 0) return;

  allHidden.forEach(essayId => {
    document.querySelectorAll(`[data-essay="${essayId}"]`).forEach(el => el.remove());
  });

  updateIndexStats();
  updateErrorStats();
  renderRecycleBin();
}

// --- Render Recycle Bin on Index Page ---
function renderRecycleBin() {
  const container = document.getElementById('recycle-bin-list');
  if (!container) return;

  const trashed = getTrashedEssays();
  const section = document.getElementById('recycle-bin-section');

  if (trashed.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = '';

  // Build recycle bin items from stored metadata
  let html = '';
  trashed.forEach(essayId => {
    // Try to extract info from the essayId (format: YYYY-MM-DD_topic)
    const parts = essayId.split('_');
    const date = parts[0] || essayId;
    const topic = parts.slice(1).join('_') || essayId;
    const displayName = topic.charAt(0).toUpperCase() + topic.slice(1).replace(/_/g, ' ');

    html += `
      <div class="card recycle-item" style="border-left:4px solid #dd6b20;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-size:.82rem; color:#a0aec0;">${date}</div>
            <div style="font-weight:600; color:#4a5568;">${displayName}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="restore-btn" onclick="restoreEssay('${essayId}')">恢复</button>
            <button class="delete-btn" onclick="permanentlyDeleteEssay('${essayId}')">彻底删除</button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// --- Update Stats ---
function updateIndexStats() {
  const essayCards = document.querySelectorAll('.card-grid [data-essay]');
  const countEl = document.querySelector('[data-stat="essay-count"]');
  if (countEl) countEl.textContent = essayCards.length;

  const scores = [];
  essayCards.forEach(card => {
    const before = parseFloat(card.dataset.scoreBefore || 0);
    const after = parseFloat(card.dataset.scoreAfter || 0);
    if (before && after) scores.push({ before, after });
  });

  const avgBeforeEl = document.querySelector('[data-stat="avg-before"]');
  const avgAfterEl = document.querySelector('[data-stat="avg-after"]');
  const avgDiffEl = document.querySelector('[data-stat="avg-diff"]');

  if (scores.length > 0) {
    const avgBefore = (scores.reduce((s, x) => s + x.before, 0) / scores.length).toFixed(1);
    const avgAfter = (scores.reduce((s, x) => s + x.after, 0) / scores.length).toFixed(1);
    const avgDiff = '+' + (avgAfter - avgBefore).toFixed(1);
    if (avgBeforeEl) avgBeforeEl.textContent = avgBefore;
    if (avgAfterEl) avgAfterEl.textContent = avgAfter;
    if (avgDiffEl) avgDiffEl.textContent = avgDiff;
  } else {
    if (avgBeforeEl) avgBeforeEl.textContent = '-';
    if (avgAfterEl) avgAfterEl.textContent = '-';
    if (avgDiffEl) avgDiffEl.textContent = '-';
    if (countEl) countEl.textContent = '0';
  }
}

function updateErrorStats() {
  const typeCount = document.querySelector('[data-stat="error-types"]');
  const totalCount = document.querySelector('[data-stat="error-total"]');
  const essayCount = document.querySelector('[data-stat="error-essays"]');

  if (typeCount || totalCount) {
    let types = 0, total = 0;
    const sources = new Set();
    document.querySelectorAll('.accordion-item').forEach(item => {
      const examples = item.querySelectorAll('.error-example');
      if (examples.length > 0) {
        types++;
        total += examples.length;
        examples.forEach(ex => {
          const link = ex.querySelector('a');
          if (link) sources.add(link.href);
        });
      }
    });
    if (typeCount) typeCount.textContent = types;
    if (totalCount) totalCount.textContent = total;
    if (essayCount) essayCount.textContent = sources.size;
  }
}

// ========== Navbar Active State ==========
document.addEventListener('DOMContentLoaded', function() {
  // Migrate old deletedEssays data to new recycle bin system
  migrateOldData();

  const path = window.location.pathname;
  const links = document.querySelectorAll('.navbar-links a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (path.endsWith(href) || (href.includes('index') && (path.endsWith('/') || path.endsWith('/Web/')))) {
      link.classList.add('active');
    }
  });

  // Hash-based view switching
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    const viewMap = { 'question': 'view-question', 'original': 'view-original', 'revision': 'view-revision', 'revised': 'view-revised' };
    if (viewMap[hash]) switchView(viewMap[hash]);
  }

  // Apply hidden essays on every page load
  applyHiddenEssays();

  // If on a hidden essay page, redirect
  const essayPageId = document.body.dataset.essayPage;
  if (essayPageId && isHiddenEssay(essayPageId)) {
    const basePath = window.location.pathname.includes('/essays/') ? '../index.html' : 'index.html';
    window.location.href = basePath;
  }
});
