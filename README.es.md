<p align="center"><img src="icon.png" width="120" alt="Icono de PhotoCraft Bridge"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <b>Español</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Deja que Claude edite fotos con el <b>PhotoCraft</b> instalado en tu ordenador — <b>Windows, macOS y Linux</b>:<br>
  ajustes, filtros, quitar fondos, texto y estilos de capa, diseños nuevos y conversión entre PSD, TIFF, PNG, JPEG, WebP y más.
</p>

---

## Por qué

[PhotoCraft](https://github.com/storytold/photocraft) es un editor de imágenes de código abierto, al nivel de Photoshop, escrito en Rust, con una CLI sin interfaz (`photocraft-cli`), 817 comandos de motor y un modo MCP. Este servidor [Model Context Protocol](https://modelcontextprotocol.io) convierte ese motor en **herramientas de archivo a archivo** para Claude, para pedir cosas como:

> *"Redimensiona todas las fotos de `D:\sesion` a 2000 px, aplica contraste automático y un poco de enfoque, y guárdalas en JPEG con calidad 85."*
> *"Quita el fondo de `producto.jpg`, recórtalo al producto y ponlo sobre blanco."*
> *"Haz un post de 1080×1080 con esta foto, un degradado morado y el título 'OFERTA' con sombra; dame también el PSD."*
> *"Pon mi logo en la esquina inferior derecha de todas estas imágenes al 70 % de opacidad."*
> *"Convierte estos PSD a WebP y dime qué capas y fuentes usa cada uno."*

Hermano de [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server), [pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server), [vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server) y [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Plataformas

| Sistema | Paquete de PhotoCraft a instalar | Dónde lo encuentra el servidor (sin configurar) | Estado |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI o zip portátil | `C:\Program Files\PhotoCraft`, `%LOCALAPPDATA%\Programs\PhotoCraft`, `PATH` | ✅ Verificado (Windows 11) |
| **Linux** (x86_64, aarch64) | `.deb`, `.rpm` o `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/photocraft/bin`, `~/.local/bin`, `PATH` | ✅ Verificado (Debian 12, sin interfaz) |
| **macOS** 11+ (Apple silicon e Intel) | `.dmg` (la app) **más** `photocraft-cli-<versión>-macos-universal.zip` | `/Applications/PhotoCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Soportado, aún sin probar en un Mac |

Descargas: [versiones de PhotoCraft](https://github.com/storytold/photocraft/releases) (hay también un tar.gz para FreeBSD; apunta `PHOTOCRAFT_DIR` a él). En cualquier otro sitio: define `PHOTOCRAFT_DIR` (carpeta, raíz del `.tar.gz` o `PhotoCraft.app`) o `PHOTOCRAFT_CLI`.

- **macOS:** el DMG solo trae la app. Descomprime el zip aparte de `photocraft-cli` y mueve `photocraft-cli` a `/usr/local/bin` (o apunta `PHOTOCRAFT_CLI` a él). La primera ejecución comprueba en línea la notarización de Apple.
- **Linux:** el AppImage y el Flatpak solo traen la app, sin `photocraft-cli`; usa el deb, el rpm o el tar.gz. Si la app es un AppImage, define `PHOTOCRAFT_APP` para que `open_in_photocraft` pueda abrirla. En un servidor sin GPU, la configuración verificada usó `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig`.

## Cómo funciona

| Parte | Qué es |
| --- | --- |
| **Motor de PhotoCraft** (`photocraft-cli mcp`) | El propio motor de PhotoCraft: importadores, ajustes, filtros, Seleccionar sujeto, texto, formas, estilos de capa y exportadores. Se inicia de cero y **sin interfaz** en cada tarea, así que nunca edita una ventana de PhotoCraft que tengas abierta. |
| **Servidor MCP** (Node.js) | 10 herramientas de alto nivel. El motor solo lee y escribe dentro de una carpeta privada, así que el servidor copia ahí tus archivos, trabaja sobre las copias y mueve los resultados a donde pediste: **tus originales nunca se abren directamente**. Valida rutas y nunca sobrescribe. |
| **App en vivo** (opcional) | `open_in_photocraft control=true` abre la app con su canal de control autenticado y solo local (puerto 7878, con el token guardado en la carpeta propia del conector) y `run_photo_commands live=true` la controla. |

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| `edit_image` | Una lista de operaciones sobre una imagen, una lista o una carpeta entera: redimensionar (tamaño, %, encajar), recortar, lienzo, rotar, voltear, recortar bordes, tono / contraste / color automáticos, 21 ajustes (niveles, curvas, exposición, tono/saturación, blanco y negro, filtro de fotografía...) en píxeles o como capas de ajuste, Camera Raw, 122 filtros, quitar fondo, selecciones (sujeto, cielo, color, rectángulo, elipse), rellenos, texto, formas, capas de relleno, imágenes colocadas, estilos de capa, modo / profundidad de bits, cualquier comando del motor |
| `create_image` | Imagen nueva de cualquier tamaño y fondo con las mismas operaciones: degradados, formas, texto, fotos, logos, estilos de capa — PNG / JPEG / WebP más un PSD o `.pcraft` editable |
| `remove_background` | Recorta el sujeto: PNG / WebP transparente, recortado, sobre un color nuevo, o PSD con la máscara editable; también por lotes |
| `convert_image` | Entre PSD, PSB, TIFF (plano o con capas), PNG, JPEG, WebP (con o sin pérdida), GIF, BMP, TGA, ICO, QOI, PPM, OpenEXR, HDR y `.pcraft`; varios formatos a la vez, con reducción opcional |
| `get_image_info` | Tamaño, modo de color, profundidad de bits, resolución, árbol de capas (texto y fuente, formas, máscaras, estilos), composiciones de capas, avisos de importación |
| `render_preview` | Cualquier imagen o documento con capas como PNG que Claude ve (y que se guarda si quieres) |
| `list_photo_catalog` | 817 comandos, filtros, ajustes, estilos de capa, ajustes preestablecidos de estilos y formas, formatos — con sus parámetros |
| `run_photo_commands` | Cualquier comando del motor en una sesión (referencias `$steps[N].layer`), sin interfaz o en la app en vivo |
| `open_in_photocraft` | Abre imágenes en la app PhotoCraft (opcionalmente con el canal de control) |
| `get_photocraft_status` | Plataforma, instalación, versión, comandos, app / puerto de control |

| | |
| --- | --- |
| **Lee** | PSD, PSB, `.pcraft`, TIFF, PNG, JPEG, WebP, GIF, BMP, TGA, ICO, QOI, PNM, OpenEXR, HDR, SVG, HEIC / HEIF (iPhone), Affinity (`.af`, `.afphoto`, `.afdesign`, `.afpub`) |
| **Escribe** | PSD, PSB, `.pcraft` (con capas), TIFF (plano o con capas), PNG, JPEG, WebP, GIF, BMP, TGA, ICO (≤ 256 px), QOI, PPM, OpenEXR, HDR |
| **Filtros** | desenfoque (gaussiano, de movimiento, radial, de superficie, de lente, tilt-shift, iris...), enfoque (máscara de enfoque, enfoque suavizado), ruido, distorsión, pixelizar, estilizar, interpretar (nubes, destello, iluminación), 47 filtros artísticos de la galería, Camera Raw, licuar... |

Las coordenadas son **píxeles desde la esquina superior izquierda**. Los ajustes y filtros actúan sobre la capa activa (la última creada) y sobre la selección, si la hay; necesitan una capa de píxeles, así que aplícalos antes de añadir texto y formas (o añade antes `{"op": "flatten"}`).

## Ejemplo

```json
{
  "input_path": "C:\\Fotos\\playa.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "Verano 2026", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\Marca\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## Requisitos

- **PhotoCraft** con `photocraft-cli` (probado con **0.5.0**); ver [Plataformas](#plataformas)
- Node.js ≥ 20 (incluido en Claude Desktop para instalaciones `.mcpb`)

## Instalación

### Claude Desktop (recomendado, todas las plataformas)

1. Descarga `photocraft-mcp-server.mcpb` de la [última versión](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. Haz doble clic (o arrástralo a Claude Desktop → *Configuración → Extensiones*) y pulsa **Instalar**.
3. Opcional: si PhotoCraft no está en una ubicación estándar, indica su carpeta o la ruta de `photocraft-cli` en la configuración de la extensión.

### Codex (OpenAI)

**Recomendado — el marketplace (recibe actualizaciones):** *Complementos → Añadir → Añadir marketplace*, origen `jhonsu01/craft-marketplace`, referencia `main`, y luego instala **PhotoCraft Bridge** desde **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). Las versiones nuevas llegan al actualizar el marketplace. O sube el zip (Codex lo guarda en tu cuenta y rechaza un zip más nuevo con el mismo nombre):

1. Descarga `photocraft-mcp-server-<versión>-codex.zip` de la [última versión](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. En Codex: *Complementos → Añadir → Nuevo complemento*, elige el zip y pulsa **Añadir complemento**.
3. Codex arranca el servidor con `node`, así que Node.js ≥ 20 debe estar en el `PATH`. Si PhotoCraft no está en una ubicación estándar, define `PHOTOCRAFT_DIR` o `PHOTOCRAFT_CLI` como variables de entorno del sistema (Codex no tiene formulario de configuración para complementos locales).

### DeepSeek Harness

1. *Plugins → Add plugin*, escribe `github:jhonsu01/craft-marketplace#path:/plugins/photocraft-mcp-server` y pulsa **Install** y luego **Enable now**.
2. Harness arranca el servidor con su propio cliente MCP y `node` (Node.js ≥ 20 en el `PATH`); las herramientas aparecen como `mcp__photocraft__<herramienta>` y los archivos de salida como tarjetas que se abren en Harness.
3. Harness aún no actualiza los plugins por sí solo: para actualizar, desinstala el plugin y vuelve a instalarlo con la misma dirección.

### Claude Code / otros clientes MCP

```bash
git clone https://github.com/jhonsu01/photocraft-mcp-server.git
cd photocraft-mcp-server
npm install
npm run build
```

Windows:

```bash
claude mcp add photocraft -- node "%CD%\dist\bundle.cjs"
```

macOS / Linux:

```bash
claude mcp add photocraft -- node "$PWD/dist/bundle.cjs"
```

## Configuración

| Variable | Significado |
| --- | --- |
| `PHOTOCRAFT_DIR` | Carpeta de PhotoCraft, uno de sus ejecutables, la raíz de un `.tar.gz` (con `bin/`) o `PhotoCraft.app`. Por defecto: detección automática |
| `PHOTOCRAFT_CLI` | Ruta de `photocraft-cli` / `photocraft-cli.exe` (tiene prioridad sobre `PHOTOCRAFT_DIR`) |
| `PHOTOCRAFT_APP` | Ruta de la app de escritorio cuando está en otro sitio (p. ej. un AppImage en Linux) |
| `PHOTOCRAFT_CONTROL_PORT` | Puerto de control de la app de escritorio (por defecto 7878) |
| `PHOTOCRAFT_MCP_TIMEOUT` | Máximo de segundos por llamada al motor (por defecto 3600) |

## Seguridad

- Los archivos **nunca se sobrescriben** salvo con `overwrite: true`: en una carpeta se usa un nombre libre (`_2`) y un `output_path` existente da error. Las entradas nunca se modifican: el motor trabaja sobre copias privadas.
- Todas las rutas deben ser absolutas. El motor funciona sin interfaz y nunca edita una ventana abierta de PhotoCraft salvo con `live: true`. Los comandos del motor que leen o escriben archivos por ruta directa (`file.open`, `file.placeEmbedded`, lotes...) los rechaza el propio PhotoCraft; las herramientas de este servidor se encargan de los archivos.
- Todo se ejecuta en local, sin acceso a la red. Cada tarea usa un motor privado en una carpeta temporal que se borra al final. El token de la app en vivo vive en `%APPDATA%\photocraft-mcp-server` (Windows), `~/Library/Application Support/photocraft-mcp-server` (macOS) o `~/.config/photocraft-mcp-server` (Linux).

## Desarrollo

```bash
npm run build       # TypeScript + bundle de un solo archivo (dist/bundle.cjs)
npm test            # pruebas unitarias (lógica de rutas de Windows, macOS y Linux)
npm run test:e2e    # 24 pruebas de extremo a extremo por MCP stdio real (imágenes sintéticas)
npm run pack:mcpb   # photocraft-mcp-server.mcpb
npm run pack:codex  # zip de complemento para Codex
```

Prueba de Linux en Docker (descomprime antes `photocraft-<versión>-linux-x86_64.tar.gz`):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/ruta/a/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## Licencia

Apache-2.0. PhotoCraft es © de sus autores (Storytold), MIT o Apache-2.0.
Este proyecto no está afiliado ni respaldado por PhotoCraft ni por Storytold. Photoshop es una marca de Adobe.
