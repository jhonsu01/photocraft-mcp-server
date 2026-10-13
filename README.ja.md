<p align="center"><img src="icon.png" width="120" alt="PhotoCraft Bridge アイコン"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <b>日本語</b> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  お使いのコンピューターにインストールされた <b>PhotoCraft</b> で、Claude に写真を編集させましょう — <b>Windows、macOS、Linux</b> 対応：<br>
  色調補正、フィルター、背景の削除、テキストとレイヤースタイル、新規デザイン、PSD・TIFF・PNG・JPEG・WebP などの相互変換。
</p>

---

## 概要

[PhotoCraft](https://github.com/storytold/photocraft) は Rust で書かれた Photoshop クラスのオープンソース画像エディターで、画面を持たない CLI（`photocraft-cli`）、817 のエンジンコマンド、MCP モードを備えています。この [Model Context Protocol](https://modelcontextprotocol.io) サーバーはそのエンジンを Claude 用の **「ファイルを入れてファイルを出す」ツール** に変えます。たとえば次のように頼めます：

> *「`D:\撮影` の写真をすべて 2000 px に縮小し、自動コントラストと軽いシャープをかけて、品質 85 の JPEG で保存して。」*
> *「`商品.jpg` の背景を削除して、商品に合わせて切り抜き、白背景にのせて。」*
> *「この写真と紫のグラデーション、ドロップシャドウ付きのタイトル『SALE』で 1080×1080 の投稿を作って。PSD もちょうだい。」*
> *「これらの画像すべての右下に、不透明度 70 % でロゴを入れて。」*
> *「これらの PSD を WebP に変換して、それぞれのレイヤーとフォントを教えて。」*

関連プロジェクト：[filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server)、[pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server)、[vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server)、[audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server)。

## プラットフォーム

| OS | インストールする PhotoCraft パッケージ | サーバーが自動で探す場所（設定不要） | 状態 |
| --- | --- | --- | --- |
| **Windows** 10/11（x64、x86、arm64） | MSI またはポータブル zip | `C:\Program Files\PhotoCraft`、`%LOCALAPPDATA%\Programs\PhotoCraft`、`PATH` | ✅ 検証済み（Windows 11） |
| **Linux**（x86_64、aarch64） | `.deb`、`.rpm` または `.tar.gz` | `/usr/bin`、`/usr/local/bin`、`/opt/photocraft/bin`、`~/.local/bin`、`PATH` | ✅ 検証済み（Debian 12、画面なし） |
| **macOS** 11+（Apple シリコンと Intel） | `.dmg`（アプリ）**と** `photocraft-cli-<バージョン>-macos-universal.zip` | `/Applications/PhotoCraft.app`、`/usr/local/bin`、`/opt/homebrew/bin`、`~/.local/bin`、`~/bin`、`PATH` | 🟡 対応済み、Mac では未検証 |

ダウンロード：[PhotoCraft のリリース](https://github.com/storytold/photocraft/releases)（FreeBSD 用の tar.gz もあります。`PHOTOCRAFT_DIR` で指定してください）。それ以外の場所にある場合は `PHOTOCRAFT_DIR`（フォルダー、`.tar.gz` のルート、`PhotoCraft.app`）または `PHOTOCRAFT_CLI` を設定します。

- **macOS：** DMG にはアプリだけが入っています。別配布の `photocraft-cli` zip を展開し、`photocraft-cli` を `/usr/local/bin` に移動してください（または `PHOTOCRAFT_CLI` で指定）。初回実行時に Apple の公証がオンラインで確認されます。
- **Linux：** AppImage と Flatpak にはアプリだけが入っており、`photocraft-cli` は含まれません。deb、rpm、tar.gz を使ってください。アプリが AppImage の場合は、`open_in_photocraft` が起動できるよう `PHOTOCRAFT_APP` を設定します。GPU のないサーバーでの検証環境では `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig` を使用しました。

## しくみ

| 構成要素 | 内容 |
| --- | --- |
| **PhotoCraft エンジン**（`photocraft-cli mcp`） | PhotoCraft 自身のエンジン：読み込み、色調補正、フィルター、被写体を選択、テキスト、シェイプ、レイヤースタイル、書き出し。ジョブごとに **画面なしで** 新しく起動するため、開いている PhotoCraft のウィンドウを変更することはありません。 |
| **MCP サーバー**（Node.js） | 10 個の高レベルツール。エンジンは専用フォルダー内でしか読み書きしないため、サーバーがファイルをそこへコピーし、コピー上で処理して、結果を指定の場所へ移動します：**元のファイルが直接開かれることはありません**。パスを検証し、決して上書きしません。 |
| **ライブアプリ**（任意） | `open_in_photocraft control=true` は認証付き・ローカル専用のコントロールチャネル（ポート 7878、トークンはコネクター専用フォルダーに保存）でアプリを起動し、`run_photo_commands live=true` がそれを操作します。 |

## ツール

| ツール | 機能 |
| --- | --- |
| `edit_image` | 1 枚の画像、リスト、フォルダー全体に操作のリストを順に適用：サイズ変更（サイズ、%、フィット）、切り抜き、カンバスサイズ、回転、反転、トリミング、自動トーン / コントラスト / カラー、21 種の色調補正（レベル補正、トーンカーブ、露光量、色相・彩度、白黒、レンズフィルター…）をピクセルまたは調整レイヤーとして、Camera Raw、122 種のフィルター、背景の削除、選択範囲（被写体、空、色、長方形、楕円）、塗りつぶし、テキスト、シェイプ、塗りつぶしレイヤー、配置画像、レイヤースタイル、モード / ビット数、任意のエンジンコマンド |
| `create_image` | 任意のサイズと背景の新規画像を同じ操作で作成：グラデーション、シェイプ、テキスト、写真、ロゴ、レイヤースタイル — PNG / JPEG / WebP に加え、編集可能な PSD または `.pcraft` |
| `remove_background` | 被写体を切り抜き：透明 PNG / WebP、被写体でトリミング、新しい背景色、または編集可能なマスク付き PSD。一括処理にも対応 |
| `convert_image` | PSD、PSB、TIFF（統合またはレイヤー付き）、PNG、JPEG、WebP（非可逆・可逆）、GIF、BMP、TGA、ICO、QOI、PPM、OpenEXR、HDR、`.pcraft` の相互変換。複数形式を同時出力、縮小も可能 |
| `get_image_info` | サイズ、カラーモード、ビット数、解像度、レイヤーツリー（テキストとフォント、シェイプ、マスク、スタイル）、レイヤーカンプ、読み込み時の警告 |
| `render_preview` | 任意の画像やレイヤー付きドキュメントを Claude が見られる PNG に（必要なら保存） |
| `list_photo_catalog` | 817 のコマンド、フィルター、色調補正、レイヤースタイル、スタイルとシェイプのプリセット、形式 — パラメーター付き |
| `run_photo_commands` | 1 つのセッションで任意のエンジンコマンドを実行（`$steps[N].layer` 参照可）、画面なしまたはライブアプリで |
| `open_in_photocraft` | PhotoCraft アプリで画像を開く（コントロールチャネル付きも可） |
| `get_photocraft_status` | プラットフォーム、インストール、バージョン、コマンド数、アプリ / コントロールポート |

| | |
| --- | --- |
| **読み込み** | PSD、PSB、`.pcraft`、TIFF、PNG、JPEG、WebP、GIF、BMP、TGA、ICO、QOI、PNM、OpenEXR、HDR、SVG、HEIC / HEIF（iPhone）、Affinity（`.af`、`.afphoto`、`.afdesign`、`.afpub`） |
| **書き出し** | PSD、PSB、`.pcraft`（レイヤー付き）、TIFF（統合またはレイヤー付き）、PNG、JPEG、WebP、GIF、BMP、TGA、ICO（256 px 以下）、QOI、PPM、OpenEXR、HDR |
| **フィルター** | ぼかし（ガウス、移動、放射状、表面、レンズ、チルトシフト、虹彩絞り…）、シャープ（アンシャープマスク、スマートシャープ）、ノイズ、変形、ピクセレート、表現手法、描画（雲模様、逆光、照明効果）、フィルターギャラリーのアート系 47 種、Camera Raw、ゆがみ… |

座標は **左上隅からのピクセル** です。色調補正とフィルターはアクティブなレイヤー（最後に作成したもの）と、選択範囲があればその範囲に作用します。ピクセルレイヤーが必要なため、テキストやシェイプを追加する前に適用してください（または先に `{"op": "flatten"}` を追加）。

## 例

```json
{
  "input_path": "C:\\写真\\海.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "夏 2026", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\ブランド\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## 必要なもの

- `photocraft-cli` 付きの **PhotoCraft**（**0.5.0** で検証）。[プラットフォーム](#プラットフォーム) を参照
- Node.js ≥ 20（`.mcpb` でインストールする場合は Claude Desktop に同梱）

## インストール

### Claude Desktop（推奨、全プラットフォーム）

1. [最新リリース](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest) から `photocraft-mcp-server.mcpb` をダウンロードします。
2. ダブルクリック（または Claude Desktop → *設定 → 拡張機能* にドラッグ）して **インストール** をクリックします。
3. 任意：PhotoCraft が標準の場所にない場合は、拡張機能の設定でそのフォルダーまたは `photocraft-cli` のパスを入力します。

### Codex（OpenAI）

**推奨 — マーケットプレイス（更新を受け取れます）：** *プラグイン → 追加 → マーケットプレイスを追加* で、ソースに `jhonsu01/craft-marketplace`、参照に `main` を指定し、**Craft Bridges** から **PhotoCraft Bridge** をインストールします（[craft-marketplace](https://github.com/jhonsu01/craft-marketplace)）。新しいバージョンはマーケットプレイスの更新で届きます。または zip をアップロードします（Codex はアカウントに保存し、同じ名前の新しい zip を拒否します）：

1. [最新リリース](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest)から `photocraft-mcp-server-<バージョン>-codex.zip` をダウンロードします。
2. Codex で *プラグイン → 追加 → 新しいプラグイン* を開き、zip を選んで **プラグインを追加** をクリックします。
3. Codex はサーバーを `node` で起動するため、`PATH` に Node.js ≥ 20 が必要です。PhotoCraft が標準の場所にない場合は、`PHOTOCRAFT_DIR` または `PHOTOCRAFT_CLI` をシステムの環境変数として設定してください（Codex にはローカルプラグイン用の設定画面がありません）。

### DeepSeek Harness

1. *Plugins → Add plugin* で `github:jhonsu01/craft-marketplace#path:/plugins/photocraft-mcp-server` を入力し、**Install**、続けて **Enable now** をクリックします。
2. Harness は独自の MCP クライアントと `node`（`PATH` に Node.js ≥ 20 が必要）でサーバーを起動します。ツールは `mcp__photocraft__<ツール>` として表示され、出力ファイルは Harness で開けるカードになります。
3. Harness はまだプラグインを自動更新しません。更新するには、プラグインをアンインストールして同じアドレスで再インストールしてください。

### Claude Code / その他の MCP クライアント

```bash
git clone https://github.com/jhonsu01/photocraft-mcp-server.git
cd photocraft-mcp-server
npm install
npm run build
```

Windows：

```bash
claude mcp add photocraft -- node "%CD%\dist\bundle.cjs"
```

macOS / Linux：

```bash
claude mcp add photocraft -- node "$PWD/dist/bundle.cjs"
```

## 設定

| 変数 | 意味 |
| --- | --- |
| `PHOTOCRAFT_DIR` | PhotoCraft のフォルダー、その実行ファイルのいずれか、`.tar.gz` のルート（`bin/` を含む）または `PhotoCraft.app`。既定：自動検出 |
| `PHOTOCRAFT_CLI` | `photocraft-cli` / `photocraft-cli.exe` のパス（`PHOTOCRAFT_DIR` より優先） |
| `PHOTOCRAFT_APP` | デスクトップアプリが別の場所にある場合のパス（例：Linux の AppImage） |
| `PHOTOCRAFT_CONTROL_PORT` | デスクトップアプリのコントロールポート（既定 7878） |
| `PHOTOCRAFT_MCP_TIMEOUT` | エンジン呼び出し 1 回あたりの最大秒数（既定 3600） |

## 安全性

- `overwrite: true` を指定しない限り、ファイルは **決して上書きされません**：フォルダー内では空いている名前（`_2`）を使い、既存の `output_path` はエラーになります。入力ファイルは変更されません：エンジンは専用のコピーで作業します。
- パスはすべて絶対パスで指定します。エンジンは画面なしで動作し、`live: true` でない限り開いている PhotoCraft のウィンドウを変更しません。生のパスでファイルを読み書きするエンジンコマンド（`file.open`、`file.placeEmbedded`、バッチ…）は PhotoCraft 自身が拒否します。ファイルの処理はこのサーバーのツールが行います。
- すべてローカルで実行され、ネットワークにはアクセスしません。各ジョブは一時フォルダー内の専用エンジンを使い、終了時にフォルダーは削除されます。ライブアプリ用のトークンは `%APPDATA%\photocraft-mcp-server`（Windows）、`~/Library/Application Support/photocraft-mcp-server`（macOS）、`~/.config/photocraft-mcp-server`（Linux）に保存されます。

## 開発

```bash
npm run build       # TypeScript + 単一ファイルのバンドル（dist/bundle.cjs）
npm test            # ユニットテスト（Windows、macOS、Linux のパス処理）
npm run test:e2e    # 実際の MCP stdio による 24 項目のエンドツーエンド検証（合成画像）
npm run pack:mcpb   # photocraft-mcp-server.mcpb
npm run pack:codex  # Codex 用プラグイン zip
```

Docker での Linux テスト（先に `photocraft-<バージョン>-linux-x86_64.tar.gz` を展開）：

```bash
docker run --rm -v "$PWD:/work:ro" -v "/path/to/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## ライセンス

Apache-2.0。PhotoCraft の著作権はその作者（Storytold）に帰属し、MIT または Apache-2.0 でライセンスされています。
本プロジェクトは PhotoCraft および Storytold とは無関係であり、承認も受けていません。Photoshop は Adobe の商標です。
