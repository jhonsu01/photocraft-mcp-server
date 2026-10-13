<p align="center"><img src="icon.png" width="120" alt="PhotoCraft-Bridge-Symbol"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <b>Deutsch</b> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Lassen Sie Claude Fotos mit dem auf Ihrem Computer installierten <b>PhotoCraft</b> bearbeiten — <b>Windows, macOS und Linux</b>:<br>
  Korrekturen, Filter, Hintergrund entfernen, Text und Ebenenstile, neue Designs und Konvertierung zwischen PSD, TIFF, PNG, JPEG, WebP und mehr.
</p>

---

## Warum

[PhotoCraft](https://github.com/storytold/photocraft) ist ein quelloffener Bildeditor auf Photoshop-Niveau, geschrieben in Rust, mit einer CLI ohne Oberfläche (`photocraft-cli`), 817 Engine-Befehlen und einem MCP-Modus. Dieser [Model Context Protocol](https://modelcontextprotocol.io)-Server macht daraus **Datei-zu-Datei-Werkzeuge** für Claude, sodass Sie zum Beispiel sagen können:

> *„Skaliere alle Fotos in `D:\Shooting` auf 2000 px, wende Auto-Kontrast und etwas Schärfe an und speichere sie als JPEG mit Qualität 85.“*
> *„Entferne den Hintergrund von `produkt.jpg`, schneide auf das Produkt zu und lege es auf Weiß.“*
> *„Erstelle einen 1080×1080-Post mit diesem Foto, einem lila Verlauf und dem Titel ‚SALE‘ mit Schlagschatten; gib mir auch die PSD.“*
> *„Setze mein Logo mit 70 % Deckkraft unten rechts in all diese Bilder.“*
> *„Konvertiere diese PSDs nach WebP und sag mir, welche Ebenen und Schriften jede verwendet.“*

Schwesterprojekt von [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server), [pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server), [vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server) und [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Plattformen

| System | Zu installierendes PhotoCraft-Paket | Wo der Server es findet (ohne Einrichtung) | Status |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI oder portables Zip | `C:\Program Files\PhotoCraft`, `%LOCALAPPDATA%\Programs\PhotoCraft`, `PATH` | ✅ Geprüft (Windows 11) |
| **Linux** (x86_64, aarch64) | `.deb`, `.rpm` oder `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/photocraft/bin`, `~/.local/bin`, `PATH` | ✅ Geprüft (Debian 12, ohne Oberfläche) |
| **macOS** 11+ (Apple Silicon und Intel) | `.dmg` (die App) **plus** `photocraft-cli-<Version>-macos-universal.zip` | `/Applications/PhotoCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Unterstützt, noch nicht auf einem Mac getestet |

Downloads: [PhotoCraft-Releases](https://github.com/storytold/photocraft/releases) (es gibt auch ein tar.gz für FreeBSD; `PHOTOCRAFT_DIR` darauf zeigen lassen). An anderen Orten: `PHOTOCRAFT_DIR` (Ordner, Wurzel des `.tar.gz` oder `PhotoCraft.app`) oder `PHOTOCRAFT_CLI` setzen.

- **macOS:** Das DMG enthält nur die App. Entpacken Sie das separate `photocraft-cli`-Zip und verschieben Sie `photocraft-cli` nach `/usr/local/bin` (oder setzen Sie `PHOTOCRAFT_CLI`). Beim ersten Start wird Apples Beglaubigung online geprüft.
- **Linux:** AppImage und Flatpak enthalten nur die App, nicht `photocraft-cli`; nutzen Sie deb, rpm oder tar.gz. Ist die App ein AppImage, setzen Sie `PHOTOCRAFT_APP`, damit `open_in_photocraft` sie starten kann. Auf einem Server ohne GPU nutzte die geprüfte Umgebung `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig`.

## Funktionsweise

| Teil | Was es ist |
| --- | --- |
| **PhotoCraft-Engine** (`photocraft-cli mcp`) | PhotoCrafts eigene Engine: Importer, Korrekturen, Filter, Motiv auswählen, Text, Formen, Ebenenstile und Exporter. Für jede Aufgabe neu und **ohne Oberfläche** gestartet, verändert sie nie ein geöffnetes PhotoCraft-Fenster. |
| **MCP-Server** (Node.js) | 10 Werkzeuge auf hoher Ebene. Die Engine liest und schreibt nur in einem privaten Ordner: Der Server kopiert Ihre Dateien hinein, arbeitet an den Kopien und verschiebt die Ergebnisse an das gewünschte Ziel — **Ihre Originale werden nie direkt geöffnet**. Er prüft Pfade und überschreibt nie. |
| **Live-App** (optional) | `open_in_photocraft control=true` startet die App mit ihrem authentifizierten, nur lokalen Steuerkanal (Port 7878, Token im Ordner des Konnektors) und `run_photo_commands live=true` steuert sie. |

## Werkzeuge

| Werkzeug | Funktion |
| --- | --- |
| `edit_image` | Eine Liste von Operationen auf ein Bild, eine Liste oder einen ganzen Ordner: skalieren (Größe, %, einpassen), freistellen, Arbeitsfläche, drehen, spiegeln, zuschneiden, Auto-Farbton / -Kontrast / -Farbe, 21 Korrekturen (Tonwerte, Gradationskurven, Belichtung, Farbton/Sättigung, Schwarzweiß, Fotofilter...) in Pixeln oder als Einstellungsebenen, Camera Raw, 122 Filter, Hintergrund entfernen, Auswahlen (Motiv, Himmel, Farbe, Rechteck, Ellipse), Füllungen, Text, Formen, Füllebenen, platzierte Bilder, Ebenenstile, Modus / Bittiefe, jeder Engine-Befehl |
| `create_image` | Neues Bild in beliebiger Größe und Hintergrund mit denselben Operationen: Verläufe, Formen, Text, Fotos, Logos, Ebenenstile — PNG / JPEG / WebP plus bearbeitbare PSD oder `.pcraft` |
| `remove_background` | Stellt das Motiv frei: transparentes PNG / WebP, zugeschnitten, auf neuer Farbe oder als PSD mit bearbeitbarer Maske; auch im Stapel |
| `convert_image` | Zwischen PSD, PSB, TIFF (flach oder mit Ebenen), PNG, JPEG, WebP (verlustbehaftet oder verlustfrei), GIF, BMP, TGA, ICO, QOI, PPM, OpenEXR, HDR und `.pcraft`; mehrere Formate gleichzeitig, optional verkleinert |
| `get_image_info` | Größe, Farbmodus, Bittiefe, Auflösung, Ebenenbaum (Text und Schrift, Formen, Masken, Stile), Ebenenkompositionen, Importwarnungen |
| `render_preview` | Jedes Bild oder Ebenendokument als PNG, das Claude sieht (und auf Wunsch gespeichert) |
| `list_photo_catalog` | 817 Befehle, Filter, Korrekturen, Ebenenstile, Stil- und Formvorgaben, Formate — mit ihren Parametern |
| `run_photo_commands` | Beliebige Engine-Befehle in einer Sitzung (Verweise `$steps[N].layer`), ohne Oberfläche oder in der Live-App |
| `open_in_photocraft` | Öffnet Bilder in der PhotoCraft-App (optional mit Steuerkanal) |
| `get_photocraft_status` | Plattform, Installation, Version, Befehle, App / Steuerport |

| | |
| --- | --- |
| **Liest** | PSD, PSB, `.pcraft`, TIFF, PNG, JPEG, WebP, GIF, BMP, TGA, ICO, QOI, PNM, OpenEXR, HDR, SVG, HEIC / HEIF (iPhone), Affinity (`.af`, `.afphoto`, `.afdesign`, `.afpub`) |
| **Schreibt** | PSD, PSB, `.pcraft` (mit Ebenen), TIFF (flach oder mit Ebenen), PNG, JPEG, WebP, GIF, BMP, TGA, ICO (≤ 256 px), QOI, PPM, OpenEXR, HDR |
| **Filter** | Weichzeichner (Gauß, Bewegung, radial, Oberfläche, Objektiv, Tilt-Shift, Iris...), Scharfzeichner (Unscharf maskieren, selektiver Scharfzeichner), Rauschen, Verzerrung, Vergröberung, Stilisierung, Rendern (Wolken, Blendenflecke, Beleuchtung), 47 künstlerische Galeriefilter, Camera Raw, Verflüssigen... |

Koordinaten sind **Pixel ab der linken oberen Ecke**. Korrekturen und Filter wirken auf die aktive Ebene (die zuletzt erstellte) und auf eine vorhandene Auswahl; sie brauchen eine Pixelebene — wenden Sie sie also vor Text und Formen an (oder fügen Sie vorher `{"op": "flatten"}` ein).

## Beispiel

```json
{
  "input_path": "C:\\Fotos\\strand.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "Sommer 2026", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\Marke\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## Voraussetzungen

- **PhotoCraft** mit `photocraft-cli` (getestet mit **0.5.0**); siehe [Plattformen](#plattformen)
- Node.js ≥ 20 (bei `.mcpb`-Installationen in Claude Desktop enthalten)

## Installation

### Claude Desktop (empfohlen, alle Plattformen)

1. Laden Sie `photocraft-mcp-server.mcpb` aus dem [neuesten Release](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest) herunter.
2. Doppelklicken (oder in Claude Desktop → *Einstellungen → Erweiterungen* ziehen) und auf **Installieren** klicken.
3. Optional: Liegt PhotoCraft nicht am Standardort, tragen Sie seinen Ordner oder den Pfad von `photocraft-cli` in den Einstellungen der Erweiterung ein.

### Codex (OpenAI)

**Empfohlen — der Marketplace (erhält Updates):** *Plugins → Hinzufügen → Marketplace hinzufügen*, Quelle `jhonsu01/craft-marketplace`, Referenz `main`, dann **PhotoCraft Bridge** aus **Craft Bridges** installieren ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). Neue Versionen kommen durch Aktualisieren des Marketplace. Oder das Zip hochladen (Codex speichert es in Ihrem Konto und lehnt ein neueres Zip mit demselben Namen ab):

1. Laden Sie `photocraft-mcp-server-<version>-codex.zip` aus dem [neuesten Release](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest) herunter.
2. In Codex: *Plugins → Hinzufügen → Neues Plugin*, das Zip wählen und auf **Plugin hinzufügen** klicken.
3. Codex startet den Server mit `node`, daher muss Node.js ≥ 20 im `PATH` liegen. Liegt PhotoCraft nicht an einem Standardort, setzen Sie `PHOTOCRAFT_DIR` oder `PHOTOCRAFT_CLI` als Systemumgebungsvariablen (Codex hat für lokale Plugins kein Einstellungsformular).

### Claude Code / andere MCP-Clients

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

## Konfiguration

| Variable | Bedeutung |
| --- | --- |
| `PHOTOCRAFT_DIR` | PhotoCraft-Ordner, eine seiner Programmdateien, die Wurzel eines `.tar.gz` (mit `bin/`) oder `PhotoCraft.app`. Standard: automatische Erkennung |
| `PHOTOCRAFT_CLI` | Pfad zu `photocraft-cli` / `photocraft-cli.exe` (hat Vorrang vor `PHOTOCRAFT_DIR`) |
| `PHOTOCRAFT_APP` | Pfad der Desktop-App, wenn sie woanders liegt (z. B. ein AppImage unter Linux) |
| `PHOTOCRAFT_CONTROL_PORT` | Steuerport der Desktop-App (Standard 7878) |
| `PHOTOCRAFT_MCP_TIMEOUT` | Maximale Sekunden pro Engine-Aufruf (Standard 3600) |

## Sicherheit

- Dateien werden **nie überschrieben**, außer mit `overwrite: true`: In Ordnern wird ein freier Name (`_2`) verwendet, ein vorhandener `output_path` ist ein Fehler. Eingaben werden nie verändert: Die Engine arbeitet an privaten Kopien.
- Alle Pfade müssen absolut sein. Die Engine läuft ohne Oberfläche und verändert nie ein geöffnetes PhotoCraft-Fenster, außer mit `live: true`. Engine-Befehle, die Dateien über direkte Pfade lesen oder schreiben (`file.open`, `file.placeEmbedded`, Stapel...), lehnt PhotoCraft selbst ab; die Werkzeuge dieses Servers übernehmen die Dateiarbeit.
- Alles läuft lokal ohne Netzwerkzugriff. Jede Aufgabe nutzt eine private Engine in einem temporären Ordner, der danach gelöscht wird. Das Token der Live-App liegt in `%APPDATA%\photocraft-mcp-server` (Windows), `~/Library/Application Support/photocraft-mcp-server` (macOS) oder `~/.config/photocraft-mcp-server` (Linux).

## Entwicklung

```bash
npm run build       # TypeScript + Bundle in einer Datei (dist/bundle.cjs)
npm test            # Unit-Tests (Pfadlogik für Windows, macOS und Linux)
npm run test:e2e    # 24 End-to-End-Prüfungen über echtes MCP-stdio (synthetische Bilder)
npm run pack:mcpb   # photocraft-mcp-server.mcpb
npm run pack:codex  # Codex-Plugin-Zip
```

Linux-Test in Docker (zuerst `photocraft-<Version>-linux-x86_64.tar.gz` entpacken):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/pfad/zu/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## Lizenz

Apache-2.0. PhotoCraft ist © seiner Autoren (Storytold), MIT oder Apache-2.0.
Dieses Projekt ist nicht mit PhotoCraft oder Storytold verbunden und wird von ihnen nicht unterstützt. Photoshop ist eine Marke von Adobe.
