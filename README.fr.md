<p align="center"><img src="icon.png" width="120" alt="Icône de PhotoCraft Bridge"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <b>Français</b> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Laissez Claude retoucher des photos avec le <b>PhotoCraft</b> installé sur votre ordinateur — <b>Windows, macOS et Linux</b> :<br>
  réglages, filtres, détourage, texte et styles de calque, nouvelles créations et conversion entre PSD, TIFF, PNG, JPEG, WebP et plus.
</p>

---

## Pourquoi

[PhotoCraft](https://github.com/storytold/photocraft) est un éditeur d'images open source de niveau Photoshop, écrit en Rust, avec une CLI sans interface (`photocraft-cli`), 817 commandes de moteur et un mode MCP. Ce serveur [Model Context Protocol](https://modelcontextprotocol.io) transforme ce moteur en **outils fichier → fichier** pour Claude, pour demander par exemple :

> *« Redimensionne toutes les photos de `D:\seance` à 2000 px, ajoute un contraste automatique et un peu de netteté, et enregistre-les en JPEG qualité 85. »*
> *« Détoure `produit.jpg`, recadre sur le produit et pose-le sur fond blanc. »*
> *« Fais un post 1080×1080 avec cette photo, un dégradé violet et le titre « SOLDES » avec une ombre portée ; donne-moi aussi le PSD. »*
> *« Ajoute mon logo en bas à droite de toutes ces images à 70 % d'opacité. »*
> *« Convertis ces PSD en WebP et dis-moi quels calques et polices chacun utilise. »*

Projet frère de [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server), [pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server), [vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server) et [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Plateformes

| Système | Paquet PhotoCraft à installer | Où le serveur le trouve (sans réglage) | État |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI ou zip portable | `C:\Program Files\PhotoCraft`, `%LOCALAPPDATA%\Programs\PhotoCraft`, `PATH` | ✅ Vérifié (Windows 11) |
| **Linux** (x86_64, aarch64) | `.deb`, `.rpm` ou `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/photocraft/bin`, `~/.local/bin`, `PATH` | ✅ Vérifié (Debian 12, sans interface) |
| **macOS** 11+ (Apple silicon et Intel) | `.dmg` (l'app) **plus** `photocraft-cli-<version>-macos-universal.zip` | `/Applications/PhotoCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Pris en charge, pas encore testé sur Mac |

Téléchargements : [versions de PhotoCraft](https://github.com/storytold/photocraft/releases) (il existe aussi un tar.gz pour FreeBSD ; pointez `PHOTOCRAFT_DIR` dessus). Ailleurs : définissez `PHOTOCRAFT_DIR` (dossier, racine du `.tar.gz` ou `PhotoCraft.app`) ou `PHOTOCRAFT_CLI`.

- **macOS :** le DMG ne contient que l'app. Décompressez le zip séparé de `photocraft-cli` et déplacez `photocraft-cli` dans `/usr/local/bin` (ou pointez `PHOTOCRAFT_CLI` dessus). Le premier lancement vérifie en ligne la notarisation d'Apple.
- **Linux :** l'AppImage et le Flatpak ne contiennent que l'app, sans `photocraft-cli` ; utilisez le deb, le rpm ou le tar.gz. Si l'app est un AppImage, définissez `PHOTOCRAFT_APP` pour que `open_in_photocraft` puisse la lancer. Sur un serveur sans GPU, la configuration vérifiée utilisait `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig`.

## Fonctionnement

| Élément | Description |
| --- | --- |
| **Moteur PhotoCraft** (`photocraft-cli mcp`) | Le moteur de PhotoCraft lui-même : importateurs, réglages, filtres, Sélectionner le sujet, texte, formes, styles de calque et exportateurs. Relancé à neuf et **sans interface** pour chaque tâche, il ne modifie donc jamais une fenêtre PhotoCraft ouverte. |
| **Serveur MCP** (Node.js) | 10 outils de haut niveau. Le moteur ne lit et n'écrit que dans un dossier privé : le serveur y copie vos fichiers, travaille sur les copies et déplace les résultats là où vous l'avez demandé — **vos originaux ne sont jamais ouverts directement**. Il valide les chemins et n'écrase jamais rien. |
| **App en direct** (facultatif) | `open_in_photocraft control=true` lance l'app avec son canal de contrôle authentifié et uniquement local (port 7878, jeton conservé dans le dossier du connecteur) et `run_photo_commands live=true` la pilote. |

## Outils

| Outil | Rôle |
| --- | --- |
| `edit_image` | Une liste d'opérations sur une image, une liste ou un dossier entier : redimensionner (taille, %, ajuster), recadrer, zone de travail, rotation, symétrie, rognage, tons / contraste / couleur automatiques, 21 réglages (niveaux, courbes, exposition, teinte/saturation, noir et blanc, filtre photo...) en pixels ou en calques de réglage, Camera Raw, 122 filtres, détourage, sélections (sujet, ciel, couleur, rectangle, ellipse), remplissages, texte, formes, calques de remplissage, images importées, styles de calque, mode / profondeur, toute commande du moteur |
| `create_image` | Nouvelle image de toute taille et de tout fond avec les mêmes opérations : dégradés, formes, texte, photos, logos, styles de calque — PNG / JPEG / WebP plus un PSD ou `.pcraft` modifiable |
| `remove_background` | Détoure le sujet : PNG / WebP transparent, rogné, sur une nouvelle couleur, ou PSD avec le masque modifiable ; aussi par lots |
| `convert_image` | Entre PSD, PSB, TIFF (aplati ou avec calques), PNG, JPEG, WebP (avec ou sans perte), GIF, BMP, TGA, ICO, QOI, PPM, OpenEXR, HDR et `.pcraft` ; plusieurs formats à la fois, réduction facultative |
| `get_image_info` | Taille, mode colorimétrique, profondeur, résolution, arbre des calques (texte et police, formes, masques, styles), compositions de calques, avertissements d'import |
| `render_preview` | Toute image ou document à calques en PNG visible par Claude (et enregistré si vous le souhaitez) |
| `list_photo_catalog` | 817 commandes, filtres, réglages, styles de calque, styles et formes prédéfinis, formats — avec leurs paramètres |
| `run_photo_commands` | Toutes commandes du moteur dans une session (références `$steps[N].layer`), sans interface ou dans l'app en direct |
| `open_in_photocraft` | Ouvre des images dans l'app PhotoCraft (éventuellement avec le canal de contrôle) |
| `get_photocraft_status` | Plateforme, installation, version, commandes, app / port de contrôle |

| | |
| --- | --- |
| **Lit** | PSD, PSB, `.pcraft`, TIFF, PNG, JPEG, WebP, GIF, BMP, TGA, ICO, QOI, PNM, OpenEXR, HDR, SVG, HEIC / HEIF (iPhone), Affinity (`.af`, `.afphoto`, `.afdesign`, `.afpub`) |
| **Écrit** | PSD, PSB, `.pcraft` (avec calques), TIFF (aplati ou avec calques), PNG, JPEG, WebP, GIF, BMP, TGA, ICO (≤ 256 px), QOI, PPM, OpenEXR, HDR |
| **Filtres** | flou (gaussien, directionnel, radial, de surface, de l'objectif, tilt-shift, iris...), netteté (accentuation, netteté optimisée), bruit, déformation, pixellisation, esthétiques, rendu (nuages, halo, éclairage), 47 filtres artistiques de la galerie, Camera Raw, fluidité... |

Les coordonnées sont des **pixels depuis le coin supérieur gauche**. Réglages et filtres agissent sur le calque actif (le dernier créé) et sur la sélection éventuelle ; ils exigent un calque de pixels, appliquez-les donc avant d'ajouter texte et formes (ou ajoutez d'abord `{"op": "flatten"}`).

## Exemple

```json
{
  "input_path": "C:\\Photos\\plage.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "Été 2026", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\Marque\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## Prérequis

- **PhotoCraft** avec `photocraft-cli` (testé avec **0.5.0**) ; voir [Plateformes](#plateformes)
- Node.js ≥ 20 (fourni avec Claude Desktop pour les installations `.mcpb`)

## Installation

### Claude Desktop (recommandé, toutes plateformes)

1. Téléchargez `photocraft-mcp-server.mcpb` depuis la [dernière version](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. Double-cliquez dessus (ou glissez-le dans Claude Desktop → *Paramètres → Extensions*) puis cliquez sur **Installer**.
3. Facultatif : si PhotoCraft n'est pas à un emplacement standard, indiquez son dossier ou le chemin de `photocraft-cli` dans les paramètres de l'extension.

### Codex (OpenAI)

**Recommandé — le marketplace (reçoit les mises à jour) :** *Plugins → Ajouter → Ajouter un marketplace*, source `jhonsu01/craft-marketplace`, référence `main`, puis installez **PhotoCraft Bridge** depuis **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). Les nouvelles versions arrivent en actualisant le marketplace. Ou envoyez le zip (Codex le garde dans votre compte et refuse un zip plus récent portant le même nom) :

1. Téléchargez `photocraft-mcp-server-<version>-codex.zip` depuis la [dernière version](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. Dans Codex : *Plugins → Ajouter → Nouveau plugin*, choisissez le zip et cliquez sur **Ajouter le plugin**.
3. Codex lance le serveur avec `node` : Node.js ≥ 20 doit donc être dans le `PATH`. Si PhotoCraft n'est pas à un emplacement standard, définissez `PHOTOCRAFT_DIR` ou `PHOTOCRAFT_CLI` comme variables d'environnement système (Codex n'a pas de formulaire de paramètres pour les plugins locaux).

### Claude Code / autres clients MCP

```bash
git clone https://github.com/jhonsu01/photocraft-mcp-server.git
cd photocraft-mcp-server
npm install
npm run build
```

Windows :

```bash
claude mcp add photocraft -- node "%CD%\dist\bundle.cjs"
```

macOS / Linux :

```bash
claude mcp add photocraft -- node "$PWD/dist/bundle.cjs"
```

## Configuration

| Variable | Signification |
| --- | --- |
| `PHOTOCRAFT_DIR` | Dossier de PhotoCraft, un de ses exécutables, la racine d'un `.tar.gz` (avec `bin/`) ou `PhotoCraft.app`. Par défaut : détection automatique |
| `PHOTOCRAFT_CLI` | Chemin de `photocraft-cli` / `photocraft-cli.exe` (prioritaire sur `PHOTOCRAFT_DIR`) |
| `PHOTOCRAFT_APP` | Chemin de l'app de bureau lorsqu'elle est ailleurs (p. ex. un AppImage sous Linux) |
| `PHOTOCRAFT_CONTROL_PORT` | Port de contrôle de l'app de bureau (7878 par défaut) |
| `PHOTOCRAFT_MCP_TIMEOUT` | Durée maximale en secondes par appel au moteur (3600 par défaut) |

## Sécurité

- Les fichiers ne sont **jamais écrasés** sans `overwrite: true` : dans un dossier, un nom libre (`_2`) est choisi et un `output_path` existant provoque une erreur. Les entrées ne sont jamais modifiées : le moteur travaille sur des copies privées.
- Tous les chemins doivent être absolus. Le moteur tourne sans interface et ne modifie jamais une fenêtre PhotoCraft ouverte, sauf avec `live: true`. Les commandes du moteur qui lisent ou écrivent des fichiers par chemin direct (`file.open`, `file.placeEmbedded`, lots...) sont refusées par PhotoCraft lui-même ; les outils de ce serveur gèrent les fichiers.
- Tout s'exécute en local, sans accès réseau. Chaque tâche utilise un moteur privé dans un dossier temporaire supprimé à la fin. Le jeton de l'app en direct se trouve dans `%APPDATA%\photocraft-mcp-server` (Windows), `~/Library/Application Support/photocraft-mcp-server` (macOS) ou `~/.config/photocraft-mcp-server` (Linux).

## Développement

```bash
npm run build       # TypeScript + bundle en un seul fichier (dist/bundle.cjs)
npm test            # tests unitaires (logique des chemins Windows, macOS et Linux)
npm run test:e2e    # 23 tests de bout en bout via un vrai MCP stdio (images synthétiques)
npm run pack:mcpb   # photocraft-mcp-server.mcpb
npm run pack:codex  # zip de plugin pour Codex
```

Test Linux dans Docker (décompressez d'abord `photocraft-<version>-linux-x86_64.tar.gz`) :

```bash
docker run --rm -v "$PWD:/work:ro" -v "/chemin/vers/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## Licence

Apache-2.0. PhotoCraft est © ses auteurs (Storytold), MIT ou Apache-2.0.
Ce projet n'est ni affilié à PhotoCraft ou Storytold, ni approuvé par eux. Photoshop est une marque d'Adobe.
