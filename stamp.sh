#!/usr/bin/env sh
# Ajoute à chaque script et feuille de style locale un suffixe ?v=<empreinte du fichier>.
# Un fichier modifié change d'URL : les navigateurs chargent la nouvelle version sans Ctrl+F5.
# À lancer avant chaque publication : sh stamp.sh
cd "$(dirname "$0")" || exit 1
for page in index.html tests.html; do
  for f in $(grep -oE '(src|href)="(js|css)/[^"?]+' "$page" | sed -E 's/^(src|href)="//'); do
    h=$(git hash-object "$f" | cut -c1-8)
    sed -i -E "s#((src|href)=\")$f(\?v=[0-9a-f]*)?\"#\1$f?v=$h\"#" "$page"
  done
done
grep -hoE '(js|css)/[^"]+\?v=[0-9a-f]+' index.html tests.html | sort -u | wc -l
