#!/usr/bin/env bash
# Instala Piper (texto a voz libre, MIT) y la voz en_US-kristin-medium (dominio público) en backend/vendor/piper.
# Lo ejecuta Render al desplegar (buildCommand en render.yaml). Solo Linux x86_64.
# Si algo falla no detiene el despliegue: la app sigue funcionando con la voz del dispositivo.
set -u

CARPETA="$(cd "$(dirname "$0")/.." && pwd)/vendor/piper"
VERSION_PIPER="2023.11.14-2"
URL_PIPER="https://github.com/rhasspy/piper/releases/download/${VERSION_PIPER}/piper_linux_x86_64.tar.gz"
URL_VOZ="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/kristin/medium"
VOZ="en_US-kristin-medium"

avisar () { echo "[piper] $*"; }

instalar () {
  mkdir -p "$CARPETA" || return 1

  if [ ! -x "$CARPETA/piper/piper" ]; then
    avisar "descargando Piper ${VERSION_PIPER}…"
    curl -fsSL --retry 3 "$URL_PIPER" -o "$CARPETA/piper.tar.gz" || return 1
    tar -xzf "$CARPETA/piper.tar.gz" -C "$CARPETA" || return 1
    rm -f "$CARPETA/piper.tar.gz"
  fi

  for archivo in "${VOZ}.onnx" "${VOZ}.onnx.json"; do
    if [ ! -s "$CARPETA/$archivo" ]; then
      avisar "descargando la voz ${archivo}…"
      curl -fsSL --retry 3 "${URL_VOZ}/${archivo}" -o "$CARPETA/$archivo" || return 1
    fi
  done

  # Prueba real: genera un audio corto
  avisar "probando la voz…"
  echo "Hi! I am Thommy." | LD_LIBRARY_PATH="$CARPETA/piper" "$CARPETA/piper/piper" \
    --model "$CARPETA/${VOZ}.onnx" --output_file "$CARPETA/prueba.wav" --quiet || return 1
  [ -s "$CARPETA/prueba.wav" ] || return 1
  rm -f "$CARPETA/prueba.wav"
}

if instalar; then
  avisar "✔ Piper listo en $CARPETA"
else
  avisar "✘ no se pudo instalar Piper: la app usará la voz del dispositivo"
  # Si quedó a medias, se borra para que el servidor no intente usarlo
  rm -rf "$CARPETA"
fi
exit 0
