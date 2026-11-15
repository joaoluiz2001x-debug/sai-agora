#!/usr/bin/env bash
# Exporta a versão web (preview) com caminhos relativos e moldura de telemóvel no desktop.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
EXPO_OFFLINE=1 CI=1 npx expo export --platform web --output-dir dist
cd dist
mkdir -p assets/fonts
for f in $(find assets/node_modules -name "*.ttf" | grep -E "(Atkinson.*(400Regular|700Bold)\.|JetBrainsMono_(400Regular|700Bold)\.)"); do cp "$f" assets/fonts/; done
rm -rf assets/node_modules
JS=$(ls _expo/static/js/web/*.js)
sed -i -E 's#"/assets/node_modules/@expo-google-fonts/[^/]+/[^/]+/#"./assets/fonts/#g' "$JS"
sed -i 's#src="/_expo#src="./_expo#; s#href="/favicon.ico"#href="./favicon.ico"#; s#<html lang="en">#<html lang="pt-PT">#' index.html
sed -i 's#</head>#<style>@media (min-width:500px){html,body{background:\#DCE6EB}\#root{max-width:400px;margin:24px auto;height:calc(100% - 48px)!important;border-radius:36px;overflow:hidden;box-shadow:0 20px 60px rgba(15,42,54,.25)}}</style></head>#' index.html
# O alojamento de artifacts reserva nomes começados por "_": mover o bundle para js/app.js
mkdir -p js css && cp _expo/static/js/web/*.js js/app.js && (cp _expo/static/css/*.css css/ 2>/dev/null || true) && rm -rf _expo
sed -i 's#src="./_expo/static/js/web/[^"]*"#src="./js/app.js"#; s#href="/_expo/static/css/#href="./css/#g' index.html
# PWA: ícone e manifest para "Adicionar ao ecrã principal"
cp ../assets/icon.png icon.png
cat > manifest.json <<'J'
{"name":"Sai Agora","short_name":"Sai Agora","start_url":".","display":"standalone","background_color":"#0A5BA8","theme_color":"#0A5BA8","icons":[{"src":"icon.png","sizes":"1024x1024","type":"image/png"}]}
J
sed -i 's#</head>#<link rel="manifest" href="./manifest.json"><link rel="apple-touch-icon" href="./icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="\#0A5BA8"></head>#' index.html
