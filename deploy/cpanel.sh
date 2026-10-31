#!/bin/bash
# No build step: copy the existing published files without changing their bytes.
set -euo pipefail

SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
TARGET="${1:?Usage: bash deploy/cpanel.sh /absolute/document-root}"
case "$TARGET" in
  /*) ;;
  *) echo 'Deployment path must be absolute.' >&2; exit 1 ;;
esac
mkdir -p -- "$TARGET"
TARGET="$(cd -- "$TARGET" && pwd -P)"
if [[ "$TARGET" == / || "$TARGET" == "$SOURCE" || "$TARGET" == "$SOURCE/"* ]]; then
  echo 'Use a document root outside the repository.' >&2
  exit 1
fi

cd -- "$SOURCE"
# Only these public directories are deployed; tools, Git and dependencies stay out.
for directory in articles assets citations documents issues pdfs viewers; do
  test -d "$directory"
done
for file in index.html index.php search-local.js search-data.js .htaccess; do
  test -f "$file"
done
for directory in articles assets citations documents issues pdfs viewers; do
  mkdir -p -- "$TARGET/$directory"
  cp -R -- "$directory/." "$TARGET/$directory/"
done
# Restricted file extensions at the repository root, preserving existing URLs.
for file in ./*.html ./*.pdf; do
  [[ -f "$file" ]] || continue
  cp -- "$file" "$TARGET/"
done
cp -- index.php search-local.js search-data.js .htaccess "$TARGET/"
echo "JPIP deployed to $TARGET"
