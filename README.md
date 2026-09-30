# FileShelf

> Lightweight, blazing-fast, and responsive software package & installer repository web application.

FileShelf is purpose-built to serve large downloadable binaries (`.exe`, `.msi`, `.dmg`, `.pkg`, `.deb`, `.rpm`, `.zip`, `.tar.gz`, `.iso`) directly behind **Nginx**. It eliminates heavy databases, application servers, and complex proxy runtimes in favor of a clean, static, read-only architecture with full HTTP Range Request support for download accelerators like **aria2**.

---

## Architecture Overview

```text
fileserver/
├── index.html                   # Lightweight SPA entry point
├── assets/
│   ├── app.js                   # Client-side search, filtering, and view switcher
│   └── style.css                # Minimal developer-tool styling
├── upload/
│   ├── index.json               # Auto-generated JSON manifest
│   ├── GoogleChromeSetup.exe    # Raw binary package
│   ├── VSCodeUserSetup-x64.exe  # Raw binary package
│   ├── Application-2.4.1.dmg    # Raw binary package
│   └── ...
├── scripts/
│   └── generate-index.sh        # Zero-dependency manifest generator (GNU/BSD stat)
└── nginx/
    └── fileserver.conf          # Hardened Nginx configuration
```

### Pure Read-Only Public Security Model
- **Public Users**: Pure read-only access (`GET`, `HEAD`). They can search, filter, copy direct URLs, verify SHA-256 checksums, and download files. Public requests can never modify, upload, or delete files.
- **Admin Workflow**: Separate from public traffic. File uploads are placed directly on the filesystem (via SFTP, CI/CD, or protected admin panel), followed by executing `generate-index.sh` to produce a fresh `index.json`.

### Manifest Schema (`/upload/index.json`)
The repository index includes file metadata and the cryptographic SHA-256 digest:
```json
[
  {
    "name": "Application-2.4.1.dmg",
    "type": "dmg",
    "category": "macOS",
    "size": 224395264,
    "modified": "2026-09-28T14:20:00Z",
    "sha256": "fa050d6738b12cddca8e5f423dc200a9b7ca1c3d44bf004c7bedcca6bf908ad4",
    "url": "/upload/Application-2.4.1.dmg"
  }
]
```

### File Integrity Verification
Users can click the **Verify** button next to each package to view the SHA-256 hash or verify directly in the terminal:

- **Windows PowerShell**:
  ```powershell
  Get-FileHash .\GoogleChromeSetup.exe -Algorithm SHA256
  ```
- **Linux & macOS**:
  ```bash
  sha256sum Application-2.4.1.dmg
  # or on macOS
  shasum -a 256 Application-2.4.1.dmg
  ```

---

## Deployment with Nginx

### 1. Place Web Files
Create the web root on your Linux server (e.g. `/var/www/fileserver`):

```bash
sudo mkdir -p /var/www/fileserver/upload
sudo mkdir -p /var/www/fileserver/assets
sudo mkdir -p /var/www/fileserver/scripts

# Copy application files
sudo cp fileserver/index.html /var/www/fileserver/
sudo cp fileserver/assets/* /var/www/fileserver/assets/
sudo cp scripts/generate-index.sh /var/www/fileserver/scripts/
sudo chmod +x /var/www/fileserver/scripts/generate-index.sh
```

### 2. Copy Installer Files & Generate Manifest
Upload your binaries into `/var/www/fileserver/upload/` and run the generator:

```bash
# Upload files into /var/www/fileserver/upload/
# Then generate the initial manifest:
cd /var/www/fileserver
sudo ./scripts/generate-index.sh /var/www/fileserver/upload /var/www/fileserver/upload/index.json
```

### 3. Configure Nginx
Copy `nginx/fileserver.conf` to `/etc/nginx/sites-available/` and enable it:

```bash
sudo cp nginx/fileserver.conf /etc/nginx/sites-available/fileserver.conf
sudo ln -s /etc/nginx/sites-available/fileserver.conf /etc/nginx/sites-enabled/

# Test syntax and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## Automated Manifest Generation

### Manual Execution
Whenever files are added or removed from `/upload/`:
```bash
./scripts/generate-index.sh /var/www/fileserver/upload /var/www/fileserver/upload/index.json
```

### Automated with Crontab (Every 5 minutes)
```bash
crontab -e
```
Add:
```cron
*/5 * * * * /var/www/fileserver/scripts/generate-index.sh /var/www/fileserver/upload /var/www/fileserver/upload/index.json >/dev/null 2>&1
```

### Automated with `inotifywait` (Real-time on file change)
```bash
sudo apt-get install inotify-tools
inotifywait -m -e create,delete,moved_to /var/www/fileserver/upload | while read path action file; do
    if [ "$file" != "index.json" ]; then
        /var/www/fileserver/scripts/generate-index.sh /var/www/fileserver/upload /var/www/fileserver/upload/index.json
    fi
done
```

---

## aria2 Download Commands

FileShelf generates predictable, direct URLs that fully support HTTP Range Requests and multi-connection acceleration.

### Single-File Multi-Connection Download (8 parallel streams)
```bash
aria2c -x 8 -s 8 "https://fileserver.example.com/upload/VSCodeUserSetup-x64.exe"
```

### Resuming an Interrupted Download
```bash
aria2c -c "https://fileserver.example.com/upload/archlinux-2026.09.01-x86_64.iso"
```

### Silent High-Speed Package Retrieval
```bash
aria2c --summary-interval=0 -x 16 -s 16 -o "installer.msi" "https://fileserver.example.com/upload/enterprise-installer.msi"
```

---

## Windows Batch (.bat) Installer Automation

Because FileShelf uses direct static endpoints, you can construct zero-prompt automated installer scripts for enterprise deployment or workstation setup:

```bat
@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: FileShelf Automated Workstation Installer
:: ============================================================================
set REPO_URL=https://fileserver.example.com/upload
set TEMP_DIR=%TEMP%\fileshelf_installers

if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
cd /d "%TEMP_DIR%"

echo [1/3] Downloading Google Chrome...
aria2c -x 8 -s 8 -o "GoogleChromeSetup.exe" "%REPO_URL%/GoogleChromeSetup.exe"
if %ERRORLEVEL% equ 0 (
    echo Installing Chrome silently...
    start /wait GoogleChromeSetup.exe /silent /install
)

echo [2/3] Downloading VS Code...
aria2c -x 8 -s 8 -o "VSCodeUserSetup-x64.exe" "%REPO_URL%/VSCodeUserSetup-x64.exe"
if %ERRORLEVEL% equ 0 (
    echo Installing VS Code silently...
    start /wait VSCodeUserSetup-x64.exe /verysilent /mergetasks="!runcode,addcontextmenufiles,addcontextmenufolders,associatewithfiles,addtopath"
)

echo [3/3] Downloading Enterprise Package (MSI)...
aria2c -x 8 -s 8 -o "enterprise-installer.msi" "%REPO_URL%/enterprise-installer.msi"
if %ERRORLEVEL% equ 0 (
    echo Installing Enterprise MSI silently...
    msiexec /i "enterprise-installer.msi" /qn /norestart
)

echo Installation complete. Cleaning up...
del /q *.exe *.msi >nul 2>&1
echo Done!
pause
```

---

## Admin Authentication & Security

The Admin management panel is protected by a client-side cryptographic gateway utilizing salted **SHA-256** digests via the Web Crypto API (`crypto.subtle.digest`).

- **Username**: `arif`
- **Password**: `xajh@1314`

### Encryption & Privacy
Plaintext credentials are **never stored** in the client-side bundle or source code. Instead, only irreversible cryptographic digests are compared against the salted input:
```text
User Hash : ce9a65f46d77cb3f6062cf6e831bc63a5bd0c1f130fe49a9e9ce6a876de860af
Pass Hash : 1ffd0f352a199436b81c1f1ef4dfd827e3c05228d7f12a3e634998ccd62ffab8
Salt      : fileshelf_salt_2026
```
Once authenticated, credentials are valid for the active browser session (`sessionStorage`), and an instant **Log out** button locks the administrative panel.

---

## Linux CLI Download & Install Snippet

```bash
# Using curl with resume support
curl -C - -O "https://fileserver.example.com/upload/server-tools.deb"
sudo dpkg -i server-tools.deb || sudo apt-get install -f -y

# Or using aria2c
aria2c -x 8 -s 8 "https://fileserver.example.com/upload/toolkit-linux.tar.gz"
tar -xzf toolkit-linux.tar.gz -C /usr/local/bin/
```
