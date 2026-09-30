/**
 * FileShelf - Lightweight Public & Admin Application
 */

const DEFAULT_FILES = [
  {
    "name": "Application-2.4.1.dmg",
    "type": "dmg",
    "category": "macOS",
    "size": 224395264,
    "modified": "2026-09-28T14:20:00Z",
    "sha256": "fa050d6738b12cddca8e5f423dc200a9b7ca1c3d44bf004c7bedcca6bf908ad4",
    "url": "/upload/Application-2.4.1.dmg"
  },
  {
    "name": "GoogleChromeSetup.exe",
    "type": "exe",
    "category": "Windows",
    "size": 134217728,
    "modified": "2026-09-30T10:30:00Z",
    "sha256": "3af5dde5b2413dbc8fc0327210cda65c538eeb0438b94a5be5d6c72319c8b32d",
    "url": "/upload/GoogleChromeSetup.exe"
  },
  {
    "name": "server-tools.deb",
    "type": "deb",
    "category": "Linux",
    "size": 49283072,
    "modified": "2026-09-27T08:15:00Z",
    "sha256": "0571fb132a0870133431c5faa9f512149e692b1230acbb609cdeae1e410410cc",
    "url": "/upload/server-tools.deb"
  },
  {
    "name": "toolkit-linux.tar.gz",
    "type": "gz",
    "category": "Archive",
    "size": 32505856,
    "modified": "2026-09-26T19:40:00Z",
    "sha256": "af248f6896a054d1af94aaa38d4c3fc402f388ae93f1e00d76bd21e902d2f303",
    "url": "/upload/toolkit-linux.tar.gz"
  },
  {
    "name": "VSCodeUserSetup-x64.exe",
    "type": "exe",
    "category": "Windows",
    "size": 96468992,
    "modified": "2026-09-29T11:05:00Z",
    "sha256": "b5bf84f354564dcd07678aabd04ee1684f45c6bb4ac4dbd6dbc03121096846bd",
    "url": "/upload/VSCodeUserSetup-x64.exe"
  }
];

let repositoryFiles = [];
let recentUploads = [
  { name: 'vscode-x64.exe', sizeFormatted: '86 MB', timeAgo: '2 min ago', category: 'Windows' },
  { name: 'app-client.dmg', sizeFormatted: '214 MB', timeAgo: '18 min ago', category: 'macOS' },
  { name: 'toolkit-linux.tar.gz', sizeFormatted: '31 MB', timeAgo: '1 hr ago', category: 'Linux' }
];

// Formatting helper
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Categorize helper
function categorizeExtension(ext) {
  ext = (ext || '').toLowerCase();
  if (['exe', 'msi'].includes(ext)) return 'Windows';
  if (['dmg', 'pkg'].includes(ext)) return 'macOS';
  if (['deb', 'rpm'].includes(ext)) return 'Linux';
  if (['zip', 'tar', 'gz', '7z', 'bz2', 'xz'].includes(ext)) return 'Archive';
  if (['iso', 'img'].includes(ext)) return 'ISO';
  return 'Other';
}

// Fetch or initialize manifest
async function loadManifest() {
  try {
    const res = await fetch('/upload/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Network response not ok');
    repositoryFiles = await res.json();
  } catch (err) {
    console.warn('Could not load /upload/index.json, using bundled data', err);
    repositoryFiles = DEFAULT_FILES;
  }
  updateStats();
  renderFileList();
  renderRecentUploads();
}

// Update Admin Stats
function updateStats() {
  const totalFiles = repositoryFiles.length;
  const totalBytes = repositoryFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  const uniqueTypes = new Set(repositoryFiles.map(f => (f.type || '').toLowerCase())).size;

  const statFilesEl = document.getElementById('statFiles');
  const statStorageEl = document.getElementById('statStorage');
  const statTypesEl = document.getElementById('statTypes');

  if (statFilesEl) statFilesEl.textContent = totalFiles;
  if (statStorageEl) statStorageEl.textContent = formatBytes(totalBytes);
  if (statTypesEl) statTypesEl.textContent = uniqueTypes;
}

// Render Public File List
function renderFileList() {
  const fileListEl = document.getElementById('fileList');
  if (!fileListEl) return;

  const searchVal = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const categoryFilter = document.getElementById('typeFilter')?.value || 'all';
  const sortMode = document.getElementById('sortFilter')?.value || 'name-asc';

  let filtered = repositoryFiles.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchVal) || 
                          (item.category && item.category.toLowerCase().includes(searchVal)) ||
                          (item.type && item.type.toLowerCase().includes(searchVal));
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
    if (sortMode === 'name-desc') return b.name.localeCompare(a.name);
    if (sortMode === 'newest') return new Date(b.modified) - new Date(a.modified);
    if (sortMode === 'oldest') return new Date(a.modified) - new Date(b.modified);
    if (sortMode === 'largest') return (b.size || 0) - (a.size || 0);
    if (sortMode === 'smallest') return (a.size || 0) - (b.size || 0);
    if (sortMode === 'type') return (a.type || '').localeCompare(b.type || '');
    return 0;
  });

  if (filtered.length === 0) {
    fileListEl.innerHTML = '<div class="empty-state">No matching files found in repository.</div>';
    return;
  }

  fileListEl.innerHTML = filtered.map(item => {
    const typeLabel = (item.type || 'BIN').toUpperCase();
    const dateStr = item.modified ? item.modified.slice(0, 10) : '';
    const sizeStr = formatBytes(item.size || 0);
    const downloadUrl = item.url || `/upload/${item.name}`;

    return `
      <div class="file-row">
        <div class="file-info-group">
          <div class="file-type-icon">${typeLabel}</div>
          <div class="file-text-meta">
            <div class="file-name" title="${item.name}">${item.name}</div>
            <div class="file-details">
              ${item.category || 'Binary'} · ${sizeStr} · ${dateStr}
            </div>
          </div>
        </div>
        <div class="file-actions">
          <button class="btn-action" onclick="openVerifyModal('${item.name}')">
            Verify
          </button>
          <button class="btn-action" onclick="copyFileUrl('${downloadUrl}')">
            Copy URL
          </button>
          <a class="btn-action download-btn" href="${downloadUrl}" download="${item.name}">
            Download
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// Render Recent Uploads in Admin
function renderRecentUploads() {
  const container = document.getElementById('recentUploadsList');
  if (!container) return;

  container.innerHTML = recentUploads.map(item => `
    <div class="recent-item">
      <div class="recent-main">
        <div class="recent-name">${item.name}</div>
        <div class="recent-meta">${item.sizeFormatted} · ${item.timeAgo}</div>
      </div>
      <span class="category-badge">${item.category}</span>
    </div>
  `).join('');
}

// Copy URL to clipboard
function copyFileUrl(urlPath) {
  const fullUrl = new URL(urlPath, window.location.origin).href;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast(`Direct URL copied: ${fullUrl}`);
  }).catch(() => {
    showToast(`Copied: ${fullUrl}`);
  });
}

// Toast message
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Security Configuration (Salted SHA-256 hashes of credentials)
const ADMIN_SALT = 'fileshelf_salt_2026';
const EXPECTED_USER_HASH = 'ce9a65f46d77cb3f6062cf6e831bc63a5bd0c1f130fe49a9e9ce6a876de860af';
const EXPECTED_PASS_HASH = '1ffd0f352a199436b81c1f1ef4dfd827e3c05228d7f12a3e634998ccd62ffab8';

async function computeSha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let isAdminAuthenticated = sessionStorage.getItem('fileshelf_admin_auth') === '1';

// View switcher
function switchView(viewName) {
  const publicView = document.getElementById('publicView');
  const adminView = document.getElementById('adminView');
  const tabPublic = document.getElementById('tabPublic');
  const tabAdmin = document.getElementById('tabAdmin');
  const loginBlock = document.getElementById('adminLoginBlock');
  const dashBlock = document.getElementById('adminDashboardBlock');

  if (viewName === 'public') {
    publicView.classList.add('active');
    adminView.classList.remove('active');
    tabPublic.classList.add('active');
    tabAdmin.classList.remove('active');
  } else {
    publicView.classList.remove('active');
    adminView.classList.add('active');
    tabPublic.classList.remove('active');
    tabAdmin.classList.add('active');

    // Update login block vs dashboard visibility
    if (isAdminAuthenticated) {
      if (loginBlock) loginBlock.style.display = 'none';
      if (dashBlock) dashBlock.style.display = 'block';
    } else {
      if (loginBlock) loginBlock.style.display = 'block';
      if (dashBlock) dashBlock.style.display = 'none';
      const alertEl = document.getElementById('loginAlert');
      if (alertEl) alertEl.style.display = 'none';
    }
  }
}

// Handle Vanilla Login Form submission
async function handleVanillaLogin(e) {
  e.preventDefault();
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const alertEl = document.getElementById('loginAlert');
  const btn = document.getElementById('btnSubmitLogin');

  btn.textContent = 'Verifying...';
  btn.disabled = true;

  try {
    const userH = await computeSha256(user + ':' + ADMIN_SALT);
    const passH = await computeSha256(pass + ':' + ADMIN_SALT);

    if (userH === EXPECTED_USER_HASH && passH === EXPECTED_PASS_HASH) {
      isAdminAuthenticated = true;
      sessionStorage.setItem('fileshelf_admin_auth', '1');
      showToast('Admin authenticated successfully');
      
      document.getElementById('loginUser').value = '';
      document.getElementById('loginPass').value = '';
      if (alertEl) alertEl.style.display = 'none';

      switchView('admin');
    } else {
      if (alertEl) {
        alertEl.textContent = 'Invalid username or password. Access denied.';
        alertEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.textContent = 'Error processing authentication.';
      alertEl.style.display = 'block';
    }
  } finally {
    btn.textContent = 'Sign In to Admin';
    btn.disabled = false;
  }
}

// Toggle password mask
function togglePasswordVisibility() {
  const input = document.getElementById('loginPass');
  const btn = event.target;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

// Handle Vanilla Logout
function handleVanillaLogout() {
  isAdminAuthenticated = false;
  sessionStorage.removeItem('fileshelf_admin_auth');
  showToast('Logged out of Admin session.');
  switchView('admin');
}

// Regenerate index.json
function regenerateIndex() {
  updateStats();
  showToast('Manifest index.json regenerated successfully.');
  
  // Create download link for updated index.json
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(repositoryFiles, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "index.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Drag and drop & file picker
function initUpload() {
  const dropZone = document.getElementById('dropZone');
  const filePicker = document.getElementById('filePicker');
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressText = document.getElementById('uploadProgressText');

  if (!dropZone || !filePicker) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    handleFiles(files);
  });

  filePicker.addEventListener('change', e => {
    const files = e.target.files;
    handleFiles(files);
  });

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '20%';
    progressText.textContent = `Preparing ${files.length} file(s)...`;

    setTimeout(() => {
      progressBar.style.width = '70%';
      progressText.textContent = `Processing upload stage...`;
    }, 300);

    setTimeout(() => {
      progressBar.style.width = '100%';
      progressText.textContent = `Done! Staged ${files.length} file(s).`;

      Promise.all(Array.from(files).map(async file => {
        const ext = file.name.split('.').pop() || '';
        const category = categorizeExtension(ext);
        const sizeFormatted = formatBytes(file.size);
        
        let sha256 = '';
        try {
          const buf = await file.arrayBuffer();
          const hashBuf = await crypto.subtle.digest('SHA-256', buf);
          sha256 = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {
          sha256 = '';
        }

        return {
          item: {
            name: file.name,
            type: ext.toLowerCase(),
            category: category,
            size: file.size,
            modified: new Date().toISOString(),
            sha256: sha256,
            url: `/upload/${file.name}`
          },
          recent: {
            name: file.name,
            sizeFormatted: sizeFormatted,
            timeAgo: 'Just now',
            category: category
          }
        };
      })).then(results => {
        results.forEach(res => {
          recentUploads.unshift(res.recent);
          repositoryFiles.unshift(res.item);
        });

        renderRecentUploads();
        updateStats();
        renderFileList();
        showToast(`${files.length} installer file(s) staged with SHA-256.`);

        setTimeout(() => {
          progressContainer.style.display = 'none';
          progressBar.style.width = '0%';
        }, 1500);
      });
    }, 700);
  }
}

// Verification Modal Handlers
let currentVerifyItem = null;

function openVerifyModal(filename) {
  const item = repositoryFiles.find(f => f.name === filename);
  if (!item) return;

  currentVerifyItem = item;
  const modal = document.getElementById('verifyModal');
  const title = document.getElementById('verifyFileTitle');
  const subtitle = document.getElementById('verifyFileSubtitle');
  const hashEl = document.getElementById('verifyShaHash');
  const inputEl = document.getElementById('verifyLocalInput');
  const alertEl = document.getElementById('verifyMatchAlert');
  const psCmd = document.getElementById('verifyPowerShellCmd');
  const linuxCmd = document.getElementById('verifyLinuxCmd');

  if (title) title.textContent = `Integrity Check · ${item.name}`;
  if (subtitle) subtitle.textContent = `${item.category} · ${formatBytes(item.size || 0)}`;
  if (hashEl) hashEl.textContent = item.sha256 || 'No checksum available';
  if (inputEl) inputEl.value = '';
  if (alertEl) alertEl.style.display = 'none';

  if (psCmd) psCmd.textContent = `Get-FileHash .\\${item.name} -Algorithm SHA256`;
  if (linuxCmd) linuxCmd.textContent = `sha256sum ${item.name}`;

  if (modal) modal.classList.add('open');
}

function closeVerifyModal(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('modal-close')) return;
  const modal = document.getElementById('verifyModal');
  if (modal) modal.classList.remove('open');
  currentVerifyItem = null;
}

function copyVerifyHash() {
  if (!currentVerifyItem || !currentVerifyItem.sha256) return;
  navigator.clipboard.writeText(currentVerifyItem.sha256).then(() => {
    showToast('SHA-256 hash copied to clipboard');
  });
}

function checkLocalHashMatch() {
  if (!currentVerifyItem || !currentVerifyItem.sha256) return;
  const inputVal = (document.getElementById('verifyLocalInput')?.value || '').trim().toLowerCase();
  const alertEl = document.getElementById('verifyMatchAlert');
  if (!alertEl) return;

  if (!inputVal) {
    alertEl.style.display = 'none';
    return;
  }

  const expected = currentVerifyItem.sha256.toLowerCase();
  alertEl.style.display = 'block';

  if (inputVal === expected) {
    alertEl.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
    alertEl.style.color = '#34d399';
    alertEl.style.border = '1px solid rgba(16, 185, 129, 0.4)';
    alertEl.textContent = '✓ Checksum MATCH: File integrity and authenticity verified.';
  } else {
    alertEl.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
    alertEl.style.color = '#fb7185';
    alertEl.style.border = '1px solid rgba(244, 63, 94, 0.4)';
    alertEl.textContent = '✗ Checksum MISMATCH: File may be modified, incomplete, or corrupted.';
  }
}

function copyPowerShellCmd() {
  if (!currentVerifyItem) return;
  const cmd = `Get-FileHash .\\${currentVerifyItem.name} -Algorithm SHA256`;
  navigator.clipboard.writeText(cmd).then(() => showToast('PowerShell command copied'));
}

function copyLinuxCmd() {
  if (!currentVerifyItem) return;
  const cmd = `sha256sum ${currentVerifyItem.name}`;
  navigator.clipboard.writeText(cmd).then(() => showToast('Linux / macOS command copied'));
}

// Event Listeners on load
document.addEventListener('DOMContentLoaded', () => {
  loadManifest();
  initUpload();

  document.getElementById('searchInput')?.addEventListener('input', renderFileList);
  document.getElementById('typeFilter')?.addEventListener('change', renderFileList);
  document.getElementById('sortFilter')?.addEventListener('change', renderFileList);
});
