<p align="center"><img src="icon.png" width="120" alt="PhotoCraft Bridge 图标"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <b>简体中文</b> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  让 Claude 使用你电脑上安装的 <b>PhotoCraft</b> 编辑照片 —— 支持 <b>Windows、macOS 和 Linux</b>：<br>
  调整、滤镜、去除背景、文字和图层样式、新设计，以及 PSD、TIFF、PNG、JPEG、WebP 等格式互转。
</p>

---

## 为什么

[PhotoCraft](https://github.com/storytold/photocraft) 是一款用 Rust 编写、对标 Photoshop 的开源图像编辑器，自带无界面的命令行工具（`photocraft-cli`）、817 条引擎命令和 MCP 模式。这个 [Model Context Protocol](https://modelcontextprotocol.io) 服务器把该引擎变成 Claude 可调用的 **"文件进、文件出" 工具**，例如你可以说：

> *"把 `D:\拍摄` 里的所有照片缩放到 2000 像素，自动对比度并稍微锐化，保存为质量 85 的 JPEG。"*
> *"去掉 `产品.jpg` 的背景，裁到产品大小，放在白色背景上。"*
> *"用这张照片做一张 1080×1080 的帖子：紫色渐变、带投影的标题「促销」；也给我 PSD。"*
> *"在所有这些图片的右下角加上我的标志，不透明度 70%。"*
> *"把这些 PSD 转成 WebP，并告诉我每个文件用了哪些图层和字体。"*

同系列项目：[filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server)、[pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server)、[vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server) 和 [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server)。

## 平台

| 系统 | 需要安装的 PhotoCraft 包 | 服务器会自动查找的位置（无需配置） | 状态 |
| --- | --- | --- | --- |
| **Windows** 10/11（x64、x86、arm64） | MSI 或便携版 zip | `C:\Program Files\PhotoCraft`、`%LOCALAPPDATA%\Programs\PhotoCraft`、`PATH` | ✅ 已验证（Windows 11） |
| **Linux**（x86_64、aarch64） | `.deb`、`.rpm` 或 `.tar.gz` | `/usr/bin`、`/usr/local/bin`、`/opt/photocraft/bin`、`~/.local/bin`、`PATH` | ✅ 已验证（Debian 12，无界面） |
| **macOS** 11+（Apple 芯片和 Intel） | `.dmg`（应用）**以及** `photocraft-cli-<版本>-macos-universal.zip` | `/Applications/PhotoCraft.app`、`/usr/local/bin`、`/opt/homebrew/bin`、`~/.local/bin`、`~/bin`、`PATH` | 🟡 已支持，尚未在 Mac 上实测 |

下载：[PhotoCraft 发布页](https://github.com/storytold/photocraft/releases)（另有 FreeBSD 的 tar.gz，用 `PHOTOCRAFT_DIR` 指向它即可）。若安装在其他位置，请设置 `PHOTOCRAFT_DIR`（文件夹、`.tar.gz` 解压根目录或 `PhotoCraft.app`）或 `PHOTOCRAFT_CLI`。

- **macOS：** DMG 里只有应用本身。请解压单独提供的 `photocraft-cli` zip，把 `photocraft-cli` 移到 `/usr/local/bin`（或用 `PHOTOCRAFT_CLI` 指向它）。首次运行会在线检查 Apple 公证。
- **Linux：** AppImage 和 Flatpak 只包含应用，不含 `photocraft-cli`，请使用 deb、rpm 或 tar.gz。若应用是 AppImage，请设置 `PHOTOCRAFT_APP`，以便 `open_in_photocraft` 能启动它。在没有 GPU 的服务器上，经过验证的环境安装了 `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig`。

## 工作原理

| 组成 | 说明 |
| --- | --- |
| **PhotoCraft 引擎**（`photocraft-cli mcp`） | PhotoCraft 自己的引擎：导入、调整、滤镜、选择主体、文字、形状、图层样式和导出。每个任务都 **以无界面方式** 重新启动，因此绝不会修改你打开着的 PhotoCraft 窗口。 |
| **MCP 服务器**（Node.js） | 10 个高层工具。引擎只在一个私有文件夹内读写，因此服务器把你的文件复制进去，在副本上处理，再把结果移到你指定的位置：**原始文件永远不会被直接打开**。它校验路径，从不覆盖文件。 |
| **实时应用**（可选） | `open_in_photocraft control=true` 以经过认证、仅限本机的控制通道启动应用（端口 7878，令牌保存在连接器自己的文件夹中），`run_photo_commands live=true` 用它操作应用。 |

## 工具

| 工具 | 功能 |
| --- | --- |
| `edit_image` | 对单张图片、一组图片或整个文件夹按顺序执行一系列操作：缩放（尺寸、百分比、适合）、裁剪、画布大小、旋转、翻转、裁切、自动色调 / 对比度 / 颜色、21 种调整（色阶、曲线、曝光度、色相/饱和度、黑白、照片滤镜…）可作用于像素或作为调整图层、Camera Raw、122 种滤镜、去除背景、选区（主体、天空、颜色、矩形、椭圆）、填充、文字、形状、填充图层、置入图片、图层样式、模式 / 位深度、任意引擎命令 |
| `create_image` | 任意尺寸和背景的新图片，使用相同的操作：渐变、形状、文字、照片、标志、图层样式 —— 输出 PNG / JPEG / WebP，以及可编辑的 PSD 或 `.pcraft` |
| `remove_background` | 抠出主体：透明 PNG / WebP、裁切到主体、换成新背景色，或保留可编辑蒙版的 PSD；也支持批量 |
| `convert_image` | 在 PSD、PSB、TIFF（拼合或分层）、PNG、JPEG、WebP（有损或无损）、GIF、BMP、TGA、ICO、QOI、PPM、OpenEXR、HDR 和 `.pcraft` 之间转换；可一次输出多种格式，可选缩小 |
| `get_image_info` | 尺寸、颜色模式、位深度、分辨率、图层树（文字和字体、形状、蒙版、样式）、图层复合、导入警告 |
| `render_preview` | 将任意图片或分层文档渲染为 Claude 可以看到的 PNG（可选保存） |
| `list_photo_catalog` | 817 条命令、滤镜、调整、图层样式、样式和形状预设、格式 —— 含参数 |
| `run_photo_commands` | 在一个会话中运行任意引擎命令（支持 `$steps[N].layer` 引用），可无界面或在实时应用中运行 |
| `open_in_photocraft` | 在 PhotoCraft 应用中打开图片（可选开启控制通道） |
| `get_photocraft_status` | 平台、安装、版本、命令数、应用 / 控制端口 |

| | |
| --- | --- |
| **读取** | PSD、PSB、`.pcraft`、TIFF、PNG、JPEG、WebP、GIF、BMP、TGA、ICO、QOI、PNM、OpenEXR、HDR、SVG、HEIC / HEIF（iPhone）、Affinity（`.af`、`.afphoto`、`.afdesign`、`.afpub`） |
| **写入** | PSD、PSB、`.pcraft`（分层）、TIFF（拼合或分层）、PNG、JPEG、WebP、GIF、BMP、TGA、ICO（≤ 256 像素）、QOI、PPM、OpenEXR、HDR |
| **滤镜** | 模糊（高斯、动感、径向、表面、镜头、移轴、光圈…）、锐化（USM 锐化、智能锐化）、杂色、扭曲、像素化、风格化、渲染（云彩、镜头光晕、光照）、47 种艺术滤镜库滤镜、Camera Raw、液化… |

坐标是 **从左上角起算的像素**。调整和滤镜作用于当前图层（最后创建的图层）以及选区（如有）；它们需要像素图层，因此请在添加文字和形状之前使用（或先加入 `{"op": "flatten"}`）。

## 示例

```json
{
  "input_path": "C:\\照片\\海滩.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "2026 夏天", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\品牌\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## 要求

- 带有 `photocraft-cli` 的 **PhotoCraft**（已在 **0.5.0** 上测试），见 [平台](#平台)
- Node.js ≥ 20（通过 `.mcpb` 安装时 Claude Desktop 已自带）

## 安装

### Claude Desktop（推荐，所有平台）

1. 从 [最新发布](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest) 下载 `photocraft-mcp-server.mcpb`。
2. 双击它（或拖到 Claude Desktop → *设置 → 扩展*），然后点击 **安装**。
3. 可选：如果 PhotoCraft 不在标准位置，请在扩展设置中填写它的文件夹或 `photocraft-cli` 的路径。

### Codex（OpenAI）

**推荐 —— 插件市场（可获得更新）：** *插件 → 添加 → 添加插件市场*，来源 `jhonsu01/craft-marketplace`，引用 `main`，然后从 **Craft Bridges** 安装 **PhotoCraft Bridge**（[craft-marketplace](https://github.com/jhonsu01/craft-marketplace)）。刷新插件市场即可获得新版本。或者上传 zip（Codex 会把它保存在你的账户中，并拒绝同名的新版 zip）：

1. 从[最新发布](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest)下载 `photocraft-mcp-server-<版本>-codex.zip`。
2. 在 Codex 中：*插件 → 添加 → 新插件*，选择该 zip，然后点击 **添加插件**。
3. Codex 用 `node` 启动服务器，因此 `PATH` 中必须有 Node.js ≥ 20。如果 PhotoCraft 不在标准位置，请把 `PHOTOCRAFT_DIR` 或 `PHOTOCRAFT_CLI` 设为系统环境变量（Codex 没有本地插件的设置表单）。

### Claude Code / 其他 MCP 客户端

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

## 配置

| 变量 | 含义 |
| --- | --- |
| `PHOTOCRAFT_DIR` | PhotoCraft 安装文件夹、其中某个可执行文件、`.tar.gz` 解压根目录（含 `bin/`）或 `PhotoCraft.app`。默认：自动检测 |
| `PHOTOCRAFT_CLI` | `photocraft-cli` / `photocraft-cli.exe` 的路径（优先于 `PHOTOCRAFT_DIR`） |
| `PHOTOCRAFT_APP` | 桌面应用在其他位置时的路径（例如 Linux 的 AppImage） |
| `PHOTOCRAFT_CONTROL_PORT` | 桌面应用的控制端口（默认 7878） |
| `PHOTOCRAFT_MCP_TIMEOUT` | 每次引擎调用的最长秒数（默认 3600） |

## 安全

- 除非设置 `overwrite: true`，否则**绝不覆盖**文件：在文件夹中会使用空闲的名称（`_2`），已存在的 `output_path` 会报错。输入文件永远不会被修改：引擎只处理私有副本。
- 所有路径必须是绝对路径。引擎以无界面方式运行，除非 `live: true`，否则绝不修改已打开的 PhotoCraft 窗口。通过原始路径读写文件的引擎命令（`file.open`、`file.placeEmbedded`、批处理…）会被 PhotoCraft 自身拒绝；文件操作由本服务器的工具完成。
- 一切都在本地运行，不访问网络。每个任务使用独立引擎和临时文件夹，结束后自动删除。实时应用的令牌保存在 `%APPDATA%\photocraft-mcp-server`（Windows）、`~/Library/Application Support/photocraft-mcp-server`（macOS）或 `~/.config/photocraft-mcp-server`（Linux）。

## 开发

```bash
npm run build       # TypeScript + 单文件打包（dist/bundle.cjs）
npm test            # 单元测试（Windows、macOS、Linux 路径逻辑）
npm run test:e2e    # 通过真实 MCP stdio 的 23 项端到端检查（合成图片）
npm run pack:mcpb   # photocraft-mcp-server.mcpb
npm run pack:codex  # Codex 插件 zip
```

在 Docker 中测试 Linux（先解压 `photocraft-<版本>-linux-x86_64.tar.gz`）：

```bash
docker run --rm -v "$PWD:/work:ro" -v "/path/to/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## 许可证

Apache-2.0。PhotoCraft 版权归其作者（Storytold）所有，采用 MIT 或 Apache-2.0 许可。
本项目与 PhotoCraft 和 Storytold 无关，也未获得其认可。Photoshop 是 Adobe 的商标。
