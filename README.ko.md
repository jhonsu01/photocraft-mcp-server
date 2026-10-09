<p align="center"><img src="icon.png" width="120" alt="PhotoCraft Bridge 아이콘"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <b>한국어</b>
</p>

<p align="center">
  컴퓨터에 설치된 <b>PhotoCraft</b>로 Claude가 사진을 편집하게 하세요 — <b>Windows, macOS, Linux</b> 지원:<br>
  보정, 필터, 배경 제거, 텍스트와 레이어 스타일, 새 디자인, PSD·TIFF·PNG·JPEG·WebP 등 형식 간 변환.
</p>

---

## 왜 필요한가

[PhotoCraft](https://github.com/storytold/photocraft)는 Rust로 작성된 Photoshop급 오픈 소스 이미지 편집기로, 화면 없는 CLI(`photocraft-cli`), 817개의 엔진 명령, MCP 모드를 갖추고 있습니다. 이 [Model Context Protocol](https://modelcontextprotocol.io) 서버는 그 엔진을 Claude용 **"파일 입력 → 파일 출력" 도구**로 바꿔 줍니다. 예를 들어 이렇게 요청할 수 있습니다:

> *"`D:\촬영`의 모든 사진을 2000 px로 줄이고 자동 대비와 약간의 선명도를 적용해 품질 85의 JPEG로 저장해 줘."*
> *"`제품.jpg`의 배경을 제거하고 제품에 맞게 자른 뒤 흰 배경에 올려 줘."*
> *"이 사진, 보라색 그라디언트, 그림자가 있는 제목 'SALE'로 1080×1080 게시물을 만들어 줘. PSD도 줘."*
> *"이 이미지들 모두의 오른쪽 아래에 불투명도 70 %로 내 로고를 넣어 줘."*
> *"이 PSD들을 WebP로 변환하고 각각 어떤 레이어와 글꼴을 쓰는지 알려 줘."*

같은 시리즈: [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server), [pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server), [vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server), [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## 플랫폼

| OS | 설치할 PhotoCraft 패키지 | 서버가 자동으로 찾는 위치(설정 불필요) | 상태 |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI 또는 포터블 zip | `C:\Program Files\PhotoCraft`, `%LOCALAPPDATA%\Programs\PhotoCraft`, `PATH` | ✅ 검증됨 (Windows 11) |
| **Linux** (x86_64, aarch64) | `.deb`, `.rpm` 또는 `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/photocraft/bin`, `~/.local/bin`, `PATH` | ✅ 검증됨 (Debian 12, 화면 없음) |
| **macOS** 11+ (Apple 실리콘 및 Intel) | `.dmg`(앱) **와** `photocraft-cli-<버전>-macos-universal.zip` | `/Applications/PhotoCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 지원, 아직 Mac에서 테스트하지 않음 |

다운로드: [PhotoCraft 릴리스](https://github.com/storytold/photocraft/releases) (FreeBSD용 tar.gz도 있습니다. `PHOTOCRAFT_DIR`로 지정하세요). 다른 위치에 있다면 `PHOTOCRAFT_DIR`(폴더, `.tar.gz` 루트 또는 `PhotoCraft.app`)나 `PHOTOCRAFT_CLI`를 설정하세요.

- **macOS:** DMG에는 앱만 들어 있습니다. 별도로 제공되는 `photocraft-cli` zip을 풀고 `photocraft-cli`를 `/usr/local/bin`으로 옮기세요(또는 `PHOTOCRAFT_CLI`로 지정). 처음 실행할 때 Apple 공증을 온라인으로 확인합니다.
- **Linux:** AppImage와 Flatpak에는 앱만 있고 `photocraft-cli`는 없습니다. deb, rpm 또는 tar.gz를 사용하세요. 앱이 AppImage라면 `open_in_photocraft`가 실행할 수 있도록 `PHOTOCRAFT_APP`을 설정하세요. GPU가 없는 서버에서 검증된 환경은 `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig`를 사용했습니다.

## 작동 방식

| 구성 요소 | 설명 |
| --- | --- |
| **PhotoCraft 엔진** (`photocraft-cli mcp`) | PhotoCraft 자체 엔진: 가져오기, 보정, 필터, 피사체 선택, 텍스트, 셰이프, 레이어 스타일, 내보내기. 작업마다 **화면 없이** 새로 시작하므로 열려 있는 PhotoCraft 창을 절대 수정하지 않습니다. |
| **MCP 서버** (Node.js) | 10개의 상위 수준 도구. 엔진은 전용 폴더 안에서만 읽고 쓰므로, 서버가 파일을 그곳에 복사해 사본으로 작업한 뒤 결과를 요청한 위치로 옮깁니다: **원본은 절대 직접 열리지 않습니다**. 경로를 검증하고 절대 덮어쓰지 않습니다. |
| **라이브 앱** (선택) | `open_in_photocraft control=true`는 인증된 로컬 전용 제어 채널(포트 7878, 토큰은 커넥터 전용 폴더에 보관)로 앱을 시작하고, `run_photo_commands live=true`가 이를 조작합니다. |

## 도구

| 도구 | 기능 |
| --- | --- |
| `edit_image` | 이미지 한 장, 목록 또는 폴더 전체에 작업 목록을 차례로 적용: 크기 조정(크기, %, 맞춤), 자르기, 캔버스 크기, 회전, 뒤집기, 여백 자르기, 자동 톤 / 대비 / 색상, 21가지 보정(레벨, 곡선, 노출, 색조/채도, 흑백, 포토 필터…)을 픽셀 또는 조정 레이어로, Camera Raw, 122가지 필터, 배경 제거, 선택 영역(피사체, 하늘, 색상, 사각형, 타원), 채우기, 텍스트, 셰이프, 채우기 레이어, 가져온 이미지, 레이어 스타일, 모드 / 비트 수, 모든 엔진 명령 |
| `create_image` | 원하는 크기와 배경의 새 이미지를 같은 작업으로 제작: 그라디언트, 셰이프, 텍스트, 사진, 로고, 레이어 스타일 — PNG / JPEG / WebP와 편집 가능한 PSD 또는 `.pcraft` |
| `remove_background` | 피사체 오려내기: 투명 PNG / WebP, 피사체에 맞춰 자르기, 새 배경색, 또는 편집 가능한 마스크가 있는 PSD. 일괄 처리도 가능 |
| `convert_image` | PSD, PSB, TIFF(병합 또는 레이어 유지), PNG, JPEG, WebP(손실 또는 무손실), GIF, BMP, TGA, ICO, QOI, PPM, OpenEXR, HDR, `.pcraft` 간 변환. 여러 형식 동시 출력, 선택적 축소 |
| `get_image_info` | 크기, 색상 모드, 비트 수, 해상도, 레이어 트리(텍스트와 글꼴, 셰이프, 마스크, 스타일), 레이어 구성, 가져오기 경고 |
| `render_preview` | 모든 이미지나 레이어 문서를 Claude가 볼 수 있는 PNG로(원하면 저장) |
| `list_photo_catalog` | 817개 명령, 필터, 보정, 레이어 스타일, 스타일·셰이프 프리셋, 형식 — 매개변수 포함 |
| `run_photo_commands` | 한 세션에서 모든 엔진 명령 실행(`$steps[N].layer` 참조), 화면 없이 또는 라이브 앱에서 |
| `open_in_photocraft` | PhotoCraft 앱에서 이미지 열기(제어 채널 선택 가능) |
| `get_photocraft_status` | 플랫폼, 설치, 버전, 명령 수, 앱 / 제어 포트 |

| | |
| --- | --- |
| **읽기** | PSD, PSB, `.pcraft`, TIFF, PNG, JPEG, WebP, GIF, BMP, TGA, ICO, QOI, PNM, OpenEXR, HDR, SVG, HEIC / HEIF(iPhone), Affinity(`.af`, `.afphoto`, `.afdesign`, `.afpub`) |
| **쓰기** | PSD, PSB, `.pcraft`(레이어 유지), TIFF(병합 또는 레이어 유지), PNG, JPEG, WebP, GIF, BMP, TGA, ICO(256 px 이하), QOI, PPM, OpenEXR, HDR |
| **필터** | 흐림 효과(가우시안, 동작, 방사형, 표면, 렌즈, 틸트-시프트, 조리개…), 선명 효과(언샵 마스크, 고급 선명 효과), 노이즈, 왜곡, 픽셀화, 스타일화, 렌더(구름, 렌즈 플레어, 조명 효과), 필터 갤러리의 예술 필터 47종, Camera Raw, 픽셀 유동화… |

좌표는 **왼쪽 위 모서리부터의 픽셀**입니다. 보정과 필터는 활성 레이어(마지막으로 만든 레이어)와 선택 영역(있는 경우)에 적용됩니다. 픽셀 레이어가 필요하므로 텍스트와 셰이프를 추가하기 전에 적용하세요(또는 먼저 `{"op": "flatten"}`을 추가).

## 예시

```json
{
  "input_path": "C:\\사진\\해변.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "2026 여름", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\브랜드\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## 요구 사항

- `photocraft-cli`가 포함된 **PhotoCraft**(**0.5.0**에서 테스트), [플랫폼](#플랫폼) 참조
- Node.js ≥ 20(`.mcpb`로 설치할 때는 Claude Desktop에 포함)

## 설치

### Claude Desktop (권장, 모든 플랫폼)

1. [최신 릴리스](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest)에서 `photocraft-mcp-server.mcpb`를 내려받습니다.
2. 더블클릭(또는 Claude Desktop → *설정 → 확장 프로그램*으로 끌어다 놓기)한 뒤 **설치**를 클릭합니다.
3. 선택: PhotoCraft가 표준 위치에 없다면 확장 프로그램 설정에서 해당 폴더나 `photocraft-cli` 경로를 입력합니다.

### Claude Code / 기타 MCP 클라이언트

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

## 설정

| 변수 | 의미 |
| --- | --- |
| `PHOTOCRAFT_DIR` | PhotoCraft 폴더, 그 안의 실행 파일, `.tar.gz` 루트(`bin/` 포함) 또는 `PhotoCraft.app`. 기본값: 자동 감지 |
| `PHOTOCRAFT_CLI` | `photocraft-cli` / `photocraft-cli.exe` 경로(`PHOTOCRAFT_DIR`보다 우선) |
| `PHOTOCRAFT_APP` | 데스크톱 앱이 다른 곳에 있을 때의 경로(예: Linux의 AppImage) |
| `PHOTOCRAFT_CONTROL_PORT` | 데스크톱 앱의 제어 포트(기본 7878) |
| `PHOTOCRAFT_MCP_TIMEOUT` | 엔진 호출 1회당 최대 초(기본 3600) |

## 안전

- `overwrite: true`가 아니면 파일을 **절대 덮어쓰지 않습니다**: 폴더에서는 빈 이름(`_2`)을 사용하고, 이미 있는 `output_path`는 오류가 됩니다. 입력 파일은 수정되지 않습니다: 엔진은 전용 사본으로 작업합니다.
- 모든 경로는 절대 경로여야 합니다. 엔진은 화면 없이 실행되며 `live: true`가 아니면 열려 있는 PhotoCraft 창을 수정하지 않습니다. 원시 경로로 파일을 읽고 쓰는 엔진 명령(`file.open`, `file.placeEmbedded`, 일괄 처리…)은 PhotoCraft 자체가 거부합니다. 파일 작업은 이 서버의 도구가 담당합니다.
- 모든 작업은 네트워크 접근 없이 로컬에서 실행됩니다. 각 작업은 임시 폴더의 전용 엔진을 사용하며, 끝나면 폴더가 삭제됩니다. 라이브 앱 토큰은 `%APPDATA%\photocraft-mcp-server`(Windows), `~/Library/Application Support/photocraft-mcp-server`(macOS), `~/.config/photocraft-mcp-server`(Linux)에 보관됩니다.

## 개발

```bash
npm run build       # TypeScript + 단일 파일 번들(dist/bundle.cjs)
npm test            # 단위 테스트(Windows, macOS, Linux 경로 로직)
npm run test:e2e    # 실제 MCP stdio를 통한 22개 엔드투엔드 검사(합성 이미지)
npm run pack:mcpb   # photocraft-mcp-server.mcpb
```

Docker에서 Linux 테스트(먼저 `photocraft-<버전>-linux-x86_64.tar.gz` 압축 해제):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/path/to/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## 라이선스

Apache-2.0. PhotoCraft의 저작권은 저자(Storytold)에게 있으며 MIT 또는 Apache-2.0으로 배포됩니다.
이 프로젝트는 PhotoCraft 및 Storytold와 관련이 없으며 이들의 승인을 받지 않았습니다. Photoshop은 Adobe의 상표입니다.
