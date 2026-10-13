<p align="center"><img src="icon.png" width="120" alt="Значок PhotoCraft Bridge"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <b>Русский</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Позвольте Claude редактировать фото в <b>PhotoCraft</b>, установленном на вашем компьютере, — <b>Windows, macOS и Linux</b>:<br>
  коррекция, фильтры, удаление фона, текст и стили слоя, новые макеты и конвертация между PSD, TIFF, PNG, JPEG, WebP и другими форматами.
</p>

---

## Зачем

[PhotoCraft](https://github.com/storytold/photocraft) — графический редактор с открытым исходным кодом уровня Photoshop, написанный на Rust, с консольным инструментом без интерфейса (`photocraft-cli`), 817 командами движка и режимом MCP. Этот сервер [Model Context Protocol](https://modelcontextprotocol.io) превращает движок в **инструменты «файл → файл»** для Claude, и можно просить, например:

> *«Уменьши все фото из `D:\съемка` до 2000 px, добавь автоконтраст и немного резкости и сохрани в JPEG с качеством 85».*
> *«Удали фон у `товар.jpg`, обрежь по товару и положи на белый».*
> *«Сделай пост 1080×1080 с этим фото, фиолетовым градиентом и заголовком „СКИДКИ“ с тенью; дай ещё PSD».*
> *«Поставь мой логотип в правый нижний угол всех этих изображений с непрозрачностью 70 %».*
> *«Конвертируй эти PSD в WebP и скажи, какие слои и шрифты в каждом».*

Родственные проекты: [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server), [pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server), [vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server) и [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Платформы

| Система | Какой пакет PhotoCraft установить | Где сервер его находит (без настройки) | Статус |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI или портативный zip | `C:\Program Files\PhotoCraft`, `%LOCALAPPDATA%\Programs\PhotoCraft`, `PATH` | ✅ Проверено (Windows 11) |
| **Linux** (x86_64, aarch64) | `.deb`, `.rpm` или `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/photocraft/bin`, `~/.local/bin`, `PATH` | ✅ Проверено (Debian 12, без графики) |
| **macOS** 11+ (Apple silicon и Intel) | `.dmg` (приложение) **и** `photocraft-cli-<версия>-macos-universal.zip` | `/Applications/PhotoCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Поддерживается, на Mac ещё не проверено |

Загрузки: [релизы PhotoCraft](https://github.com/storytold/photocraft/releases) (есть и tar.gz для FreeBSD — укажите его в `PHOTOCRAFT_DIR`). Если установлено в другом месте, задайте `PHOTOCRAFT_DIR` (папка, корень `.tar.gz` или `PhotoCraft.app`) или `PHOTOCRAFT_CLI`.

- **macOS:** в DMG только приложение. Распакуйте отдельный zip с `photocraft-cli` и переместите `photocraft-cli` в `/usr/local/bin` (или укажите путь в `PHOTOCRAFT_CLI`). При первом запуске нотаризация Apple проверяется онлайн.
- **Linux:** AppImage и Flatpak содержат только приложение, без `photocraft-cli`; используйте deb, rpm или tar.gz. Если приложение — AppImage, задайте `PHOTOCRAFT_APP`, чтобы `open_in_photocraft` мог его запустить. На сервере без GPU в проверенной конфигурации использовались `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig`.

## Как это работает

| Часть | Что это |
| --- | --- |
| **Движок PhotoCraft** (`photocraft-cli mcp`) | Собственный движок PhotoCraft: импорт, коррекция, фильтры, «Выделить предмет», текст, фигуры, стили слоя и экспорт. Для каждой задачи запускается заново и **без интерфейса**, поэтому никогда не меняет открытое окно PhotoCraft. |
| **MCP-сервер** (Node.js) | 10 высокоуровневых инструментов. Движок читает и пишет только внутри приватной папки, поэтому сервер копирует туда ваши файлы, работает с копиями и переносит результаты туда, куда вы просили: **оригиналы никогда не открываются напрямую**. Проверяет пути и никогда ничего не перезаписывает. |
| **Живое приложение** (необязательно) | `open_in_photocraft control=true` запускает приложение с аутентифицированным локальным каналом управления (порт 7878, токен хранится в папке коннектора), а `run_photo_commands live=true` управляет им. |

## Инструменты

| Инструмент | Что делает |
| --- | --- |
| `edit_image` | Список операций над одним изображением, списком или целой папкой: размер (пиксели, %, вписать), кадрирование, размер холста, поворот, отражение, обрезка краёв, автотон / автоконтраст / автоцвет, 21 коррекция (уровни, кривые, экспозиция, цветовой тон/насыщенность, чёрно-белое, фотофильтр...) в пикселях или корректирующими слоями, Camera Raw, 122 фильтра, удаление фона, выделения (предмет, небо, цвет, прямоугольник, эллипс), заливки, текст, фигуры, слои-заливки, вставленные изображения, стили слоя, режим / разрядность, любая команда движка |
| `create_image` | Новое изображение любого размера и фона с теми же операциями: градиенты, фигуры, текст, фото, логотипы, стили слоя — PNG / JPEG / WebP плюс редактируемый PSD или `.pcraft` |
| `remove_background` | Вырезает предмет: прозрачный PNG / WebP, обрезанный, на новом цвете или PSD с редактируемой маской; и пакетно |
| `convert_image` | Между PSD, PSB, TIFF (плоский или со слоями), PNG, JPEG, WebP (с потерями или без), GIF, BMP, TGA, ICO, QOI, PPM, OpenEXR, HDR и `.pcraft`; несколько форматов сразу, с необязательным уменьшением |
| `get_image_info` | Размер, цветовой режим, разрядность, разрешение, дерево слоёв (текст и шрифт, фигуры, маски, стили), композиции слоёв, предупреждения импорта |
| `render_preview` | Любое изображение или многослойный документ как PNG, который видит Claude (и сохраняется при желании) |
| `list_photo_catalog` | 817 команд, фильтры, коррекции, стили слоя, наборы стилей и фигур, форматы — с параметрами |
| `run_photo_commands` | Любые команды движка в одной сессии (ссылки `$steps[N].layer`), без интерфейса или в живом приложении |
| `open_in_photocraft` | Открывает изображения в приложении PhotoCraft (по желанию с каналом управления) |
| `get_photocraft_status` | Платформа, установка, версия, команды, приложение / порт управления |

| | |
| --- | --- |
| **Читает** | PSD, PSB, `.pcraft`, TIFF, PNG, JPEG, WebP, GIF, BMP, TGA, ICO, QOI, PNM, OpenEXR, HDR, SVG, HEIC / HEIF (iPhone), Affinity (`.af`, `.afphoto`, `.afdesign`, `.afpub`) |
| **Пишет** | PSD, PSB, `.pcraft` (со слоями), TIFF (плоский или со слоями), PNG, JPEG, WebP, GIF, BMP, TGA, ICO (≤ 256 px), QOI, PPM, OpenEXR, HDR |
| **Фильтры** | размытие (по Гауссу, в движении, радиальное, по поверхности, линзы, tilt-shift, диафрагма...), резкость («Контурная резкость», «Умная резкость»), шум, искажение, оформление, стилизация, рендеринг (облака, блик, освещение), 47 художественных фильтров галереи, Camera Raw, пластика... |

Координаты — **пиксели от левого верхнего угла**. Коррекции и фильтры действуют на активный слой (последний созданный) и на выделение, если оно есть; им нужен пиксельный слой, поэтому применяйте их до добавления текста и фигур (или сначала добавьте `{"op": "flatten"}`).

## Пример

```json
{
  "input_path": "C:\\Фото\\пляж.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "Лето 2026", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\Бренд\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## Требования

- **PhotoCraft** с `photocraft-cli` (проверено на **0.5.0**); см. [Платформы](#платформы)
- Node.js ≥ 20 (входит в Claude Desktop при установке `.mcpb`)

## Установка

### Claude Desktop (рекомендуется, все платформы)

1. Скачайте `photocraft-mcp-server.mcpb` из [последнего релиза](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. Дважды щёлкните по нему (или перетащите в Claude Desktop → *Настройки → Расширения*) и нажмите **Установить**.
3. Необязательно: если PhotoCraft установлен не в стандартное место, укажите его папку или путь к `photocraft-cli` в настройках расширения.

### Codex (OpenAI)

**Рекомендуется — маркетплейс (получает обновления):** *Плагины → Добавить → Добавить маркетплейс*, источник `jhonsu01/craft-marketplace`, ссылка `main`, затем установите **PhotoCraft Bridge** из **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). Новые версии приходят при обновлении маркетплейса. Или загрузите zip (Codex сохранит его в вашей учётной записи и отклонит более новый zip с тем же именем):

1. Скачайте `photocraft-mcp-server-<версия>-codex.zip` из [последнего релиза](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. В Codex: *Плагины → Добавить → Новый плагин*, выберите zip и нажмите **Добавить плагин**.
3. Codex запускает сервер через `node`, поэтому Node.js ≥ 20 должен быть в `PATH`. Если PhotoCraft установлен не в стандартное место, задайте `PHOTOCRAFT_DIR` или `PHOTOCRAFT_CLI` как системные переменные окружения (у Codex нет формы настроек для локальных плагинов).

### DeepSeek Harness

1. *Plugins → Add plugin*, введите `github:jhonsu01/craft-marketplace#path:/plugins/photocraft-mcp-server` и нажмите **Install**, затем **Enable now**.
2. Harness запускает сервер через свой MCP-клиент и `node` (Node.js ≥ 20 в `PATH`); инструменты появляются как `mcp__photocraft__<инструмент>`, а выходные файлы — как карточки, которые открываются в Harness.
3. Harness пока не обновляет плагины сам: чтобы обновить, удалите плагин и установите его снова по тому же адресу.

### Claude Code / другие MCP-клиенты

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

## Настройка

| Переменная | Значение |
| --- | --- |
| `PHOTOCRAFT_DIR` | Папка PhotoCraft, один из его исполняемых файлов, корень `.tar.gz` (с `bin/`) или `PhotoCraft.app`. По умолчанию: автоопределение |
| `PHOTOCRAFT_CLI` | Путь к `photocraft-cli` / `photocraft-cli.exe` (важнее, чем `PHOTOCRAFT_DIR`) |
| `PHOTOCRAFT_APP` | Путь к настольному приложению, если оно в другом месте (например, AppImage в Linux) |
| `PHOTOCRAFT_CONTROL_PORT` | Порт управления настольным приложением (по умолчанию 7878) |
| `PHOTOCRAFT_MCP_TIMEOUT` | Максимум секунд на один вызов движка (по умолчанию 3600) |

## Безопасность

- Файлы **никогда не перезаписываются** без `overwrite: true`: в папке выбирается свободное имя (`_2`), существующий `output_path` — ошибка. Исходные файлы не изменяются: движок работает с приватными копиями.
- Все пути должны быть абсолютными. Движок работает без интерфейса и не трогает открытое окно PhotoCraft, кроме случая `live: true`. Команды движка, читающие или пишущие файлы по прямому пути (`file.open`, `file.placeEmbedded`, пакетная обработка...), отклоняет сам PhotoCraft; работу с файлами выполняют инструменты этого сервера.
- Всё работает локально, без доступа к сети. Каждая задача использует отдельный движок во временной папке, которая затем удаляется. Токен живого приложения хранится в `%APPDATA%\photocraft-mcp-server` (Windows), `~/Library/Application Support/photocraft-mcp-server` (macOS) или `~/.config/photocraft-mcp-server` (Linux).

## Разработка

```bash
npm run build       # TypeScript + бандл в один файл (dist/bundle.cjs)
npm test            # модульные тесты (логика путей Windows, macOS и Linux)
npm run test:e2e    # 24 сквозные проверки через реальный MCP stdio (синтетические изображения)
npm run pack:mcpb   # photocraft-mcp-server.mcpb
npm run pack:codex  # zip-плагин для Codex
```

Проверка Linux в Docker (сначала распакуйте `photocraft-<версия>-linux-x86_64.tar.gz`):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/путь/к/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## Лицензия

Apache-2.0. PhotoCraft © его авторы (Storytold), MIT или Apache-2.0.
Проект не связан с PhotoCraft и Storytold и не одобрен ими. Photoshop — товарный знак Adobe.
