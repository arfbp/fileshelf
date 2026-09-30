#!/usr/bin/env bash
# ==============================================================================
# FileShelf - Static Repository Manifest Generator
# ==============================================================================
# Usage:
#   ./scripts/generate-index.sh [upload_dir] [output_json]
#
# Default paths:
#   Upload directory : ./upload (or /var/www/fileserver/upload)
#   Output manifest  : ./upload/index.json
# ==============================================================================

set -euo pipefail

TARGET_DIR="${1:-./upload}"
OUTPUT_FILE="${2:-${TARGET_DIR}/index.json}"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "Error: Directory '$TARGET_DIR' does not exist." >&2
  exit 1
fi

echo "FileShelf: Scanning directory '$TARGET_DIR'..."

TEMP_FILE=$(mktemp)
echo "[" > "$TEMP_FILE"

FIRST=1
TOTAL_COUNT=0
TOTAL_BYTES=0

# Loop through all files in TARGET_DIR (excluding subdirectories, hidden files, and index.json itself)
for filepath in "$TARGET_DIR"/*; do
  # Check if file exists (handles empty directory case)
  [[ -e "$filepath" ]] || continue
  
  # Skip directories
  [[ -f "$filepath" ]] || continue
  
  filename=$(basename "$filepath")
  
  # Skip index.json and hidden files
  if [[ "$filename" == "index.json" || "$filename" == .* ]]; then
    continue
  fi
  
  # Determine file size
  if stat --version >/dev/null 2>&1; then
    # GNU stat (Linux)
    size=$(stat -c %s "$filepath")
    mtime=$(stat -c %Y "$filepath")
    modified=$(date -u -d "@$mtime" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
  else
    # BSD stat (macOS fallback)
    size=$(stat -f %z "$filepath")
    mtime=$(stat -f %m "$filepath")
    modified=$(date -u -r "$mtime" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
  fi
  
  # Determine extension & type
  lower_name=$(echo "$filename" | tr '[:upper:]' '[:lower:]')
  type="unknown"
  category="Other"
  
  if [[ "$lower_name" == *.tar.gz ]]; then
    type="gz"
    category="Archive"
  elif [[ "$lower_name" == *.tar.xz ]]; then
    type="xz"
    category="Archive"
  elif [[ "$lower_name" == *.tar.bz2 ]]; then
    type="bz2"
    category="Archive"
  elif [[ "$lower_name" == *.* ]]; then
    ext="${lower_name##*.}"
    type="$ext"
    case "$ext" in
      exe|msi)
        category="Windows"
        ;;
      dmg|pkg)
        category="macOS"
        ;;
      deb|rpm|apk|appimage)
        category="Linux"
        ;;
      zip|tar|gz|7z|rar|bz2|xz)
        category="Archive"
        ;;
      iso|img)
        category="ISO"
        ;;
      *)
        category="Other"
        ;;
    esac
  else
    type="bin"
    category="Other"
  fi
  
  # Comma separation between JSON items
  if [[ $FIRST -eq 0 ]]; then
    echo "  }," >> "$TEMP_FILE"
  fi
  FIRST=0
  
  # Calculate SHA-256 checksum
  if command -v sha256sum >/dev/null 2>&1; then
    sha256=$(sha256sum "$filepath" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    sha256=$(shasum -a 256 "$filepath" | awk '{print $1}')
  else
    sha256=""
  fi

  cat <<EOF >> "$TEMP_FILE"
  {
    "name": "$filename",
    "type": "$type",
    "category": "$category",
    "size": $size,
    "modified": "$modified",
    "sha256": "$sha256",
    "url": "/upload/$filename"
EOF
  
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  TOTAL_BYTES=$((TOTAL_BYTES + size))
done

# Close the last JSON object and array
if [[ $FIRST -eq 0 ]]; then
  echo "  }" >> "$TEMP_FILE"
fi
echo "]" >> "$TEMP_FILE"

# Atomically move temp file to output location
mv "$TEMP_FILE" "$OUTPUT_FILE"
chmod 644 "$OUTPUT_FILE"

# Human readable size calculation
if command -v numfmt >/dev/null 2>&1; then
  READABLE_SIZE=$(numfmt --to=iec-i --suffix=B "$TOTAL_BYTES" 2>/dev/null || echo "${TOTAL_BYTES} bytes")
else
  READABLE_SIZE="${TOTAL_BYTES} bytes"
fi

echo "FileShelf: Manifest generated successfully at '$OUTPUT_FILE'."
echo "Indexed: $TOTAL_COUNT files ($READABLE_SIZE total)."
