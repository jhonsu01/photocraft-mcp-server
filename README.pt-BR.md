<p align="center"><img src="icon.png" width="120" alt="Ícone do PhotoCraft Bridge"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <b>Português</b> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Deixe o Claude editar fotos com o <b>PhotoCraft</b> instalado no seu computador — <b>Windows, macOS e Linux</b>:<br>
  ajustes, filtros, remoção de fundo, texto e estilos de camada, novos designs e conversão entre PSD, TIFF, PNG, JPEG, WebP e mais.
</p>

---

## Por quê

O [PhotoCraft](https://github.com/storytold/photocraft) é um editor de imagens de código aberto, no nível do Photoshop, escrito em Rust, com uma CLI sem interface (`photocraft-cli`), 817 comandos de motor e um modo MCP. Este servidor [Model Context Protocol](https://modelcontextprotocol.io) transforma esse motor em **ferramentas de arquivo para arquivo** para o Claude, para pedir coisas como:

> *"Redimensione todas as fotos de `D:\ensaio` para 2000 px, aplique contraste automático e um pouco de nitidez, e salve em JPEG com qualidade 85."*
> *"Remova o fundo de `produto.jpg`, recorte no produto e coloque sobre branco."*
> *"Faça um post 1080×1080 com esta foto, um degradê roxo e o título 'PROMOÇÃO' com sombra; me dê também o PSD."*
> *"Coloque meu logo no canto inferior direito de todas estas imagens com 70 % de opacidade."*
> *"Converta estes PSD para WebP e diga quais camadas e fontes cada um usa."*

Irmão do [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server), do [pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server), do [vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server) e do [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Plataformas

| Sistema | Pacote do PhotoCraft a instalar | Onde o servidor o encontra (sem configurar) | Status |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI ou zip portátil | `C:\Program Files\PhotoCraft`, `%LOCALAPPDATA%\Programs\PhotoCraft`, `PATH` | ✅ Verificado (Windows 11) |
| **Linux** (x86_64, aarch64) | `.deb`, `.rpm` ou `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/photocraft/bin`, `~/.local/bin`, `PATH` | ✅ Verificado (Debian 12, sem interface) |
| **macOS** 11+ (Apple silicon e Intel) | `.dmg` (o app) **mais** `photocraft-cli-<versão>-macos-universal.zip` | `/Applications/PhotoCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Suportado, ainda não testado em um Mac |

Downloads: [versões do PhotoCraft](https://github.com/storytold/photocraft/releases) (há também um tar.gz para FreeBSD; aponte `PHOTOCRAFT_DIR` para ele). Em qualquer outro local: defina `PHOTOCRAFT_DIR` (pasta, raiz do `.tar.gz` ou `PhotoCraft.app`) ou `PHOTOCRAFT_CLI`.

- **macOS:** o DMG contém apenas o app. Descompacte o zip separado do `photocraft-cli` e mova `photocraft-cli` para `/usr/local/bin` (ou aponte `PHOTOCRAFT_CLI` para ele). A primeira execução verifica a notarização da Apple online.
- **Linux:** o AppImage e o Flatpak contêm apenas o app, sem `photocraft-cli`; use o deb, o rpm ou o tar.gz. Se o app for um AppImage, defina `PHOTOCRAFT_APP` para que `open_in_photocraft` consiga iniciá-lo. Em um servidor sem GPU, a configuração verificada usou `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig`.

## Como funciona

| Parte | O que é |
| --- | --- |
| **Motor do PhotoCraft** (`photocraft-cli mcp`) | O próprio motor do PhotoCraft: importadores, ajustes, filtros, Selecionar assunto, texto, formas, estilos de camada e exportadores. Iniciado do zero e **sem interface** para cada tarefa, então nunca edita uma janela do PhotoCraft que você tenha aberta. |
| **Servidor MCP** (Node.js) | 10 ferramentas de alto nível. O motor só lê e grava dentro de uma pasta privada, então o servidor copia seus arquivos para lá, trabalha nas cópias e move os resultados para onde você pediu: **seus originais nunca são abertos diretamente**. Valida caminhos e nunca sobrescreve. |
| **App ao vivo** (opcional) | `open_in_photocraft control=true` inicia o app com seu canal de controle autenticado e apenas local (porta 7878, token guardado na pasta do próprio conector) e `run_photo_commands live=true` o controla. |

## Ferramentas

| Ferramenta | O que faz |
| --- | --- |
| `edit_image` | Uma lista de operações em uma imagem, uma lista ou uma pasta inteira: redimensionar (tamanho, %, encaixar), recortar, tela, girar, espelhar, aparar, tom / contraste / cor automáticos, 21 ajustes (níveis, curvas, exposição, matiz/saturação, preto e branco, filtro de fotografia...) em pixels ou como camadas de ajuste, Camera Raw, 122 filtros, remover fundo, seleções (assunto, céu, cor, retângulo, elipse), preenchimentos, texto, formas, camadas de preenchimento, imagens inseridas, estilos de camada, modo / profundidade de bits, qualquer comando do motor |
| `create_image` | Imagem nova de qualquer tamanho e fundo com as mesmas operações: degradês, formas, texto, fotos, logos, estilos de camada — PNG / JPEG / WebP mais um PSD ou `.pcraft` editável |
| `remove_background` | Recorta o assunto: PNG / WebP transparente, aparado, sobre uma nova cor, ou PSD com a máscara editável; em lote também |
| `convert_image` | Entre PSD, PSB, TIFF (plano ou com camadas), PNG, JPEG, WebP (com ou sem perda), GIF, BMP, TGA, ICO, QOI, PPM, OpenEXR, HDR e `.pcraft`; vários formatos de uma vez, com redução opcional |
| `get_image_info` | Tamanho, modo de cor, profundidade de bits, resolução, árvore de camadas (texto e fonte, formas, máscaras, estilos), composições de camadas, avisos de importação |
| `render_preview` | Qualquer imagem ou documento com camadas como PNG que o Claude vê (e salvo, se quiser) |
| `list_photo_catalog` | 817 comandos, filtros, ajustes, estilos de camada, predefinições de estilos e formas, formatos — com seus parâmetros |
| `run_photo_commands` | Quaisquer comandos do motor em uma sessão (referências `$steps[N].layer`), sem interface ou no app ao vivo |
| `open_in_photocraft` | Abre imagens no app PhotoCraft (opcionalmente com o canal de controle) |
| `get_photocraft_status` | Plataforma, instalação, versão, comandos, app / porta de controle |

| | |
| --- | --- |
| **Lê** | PSD, PSB, `.pcraft`, TIFF, PNG, JPEG, WebP, GIF, BMP, TGA, ICO, QOI, PNM, OpenEXR, HDR, SVG, HEIC / HEIF (iPhone), Affinity (`.af`, `.afphoto`, `.afdesign`, `.afpub`) |
| **Grava** | PSD, PSB, `.pcraft` (com camadas), TIFF (plano ou com camadas), PNG, JPEG, WebP, GIF, BMP, TGA, ICO (≤ 256 px), QOI, PPM, OpenEXR, HDR |
| **Filtros** | desfoque (gaussiano, de movimento, radial, de superfície, de lente, tilt-shift, íris...), nitidez (máscara de nitidez, nitidez inteligente), ruído, distorção, pixelização, estilização, renderização (nuvens, reflexo de lente, iluminação), 47 filtros artísticos da galeria, Camera Raw, dissolver... |

As coordenadas são **pixels a partir do canto superior esquerdo**. Ajustes e filtros agem na camada ativa (a última criada) e na seleção, se houver; eles precisam de uma camada de pixels, então aplique-os antes de adicionar texto e formas (ou adicione antes `{"op": "flatten"}`).

## Exemplo

```json
{
  "input_path": "C:\\Fotos\\praia.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "Verão 2026", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\Marca\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## Requisitos

- **PhotoCraft** com `photocraft-cli` (testado com **0.5.0**); veja [Plataformas](#plataformas)
- Node.js ≥ 20 (incluído no Claude Desktop para instalações `.mcpb`)

## Instalação

### Claude Desktop (recomendado, todas as plataformas)

1. Baixe `photocraft-mcp-server.mcpb` da [versão mais recente](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. Clique duas vezes (ou arraste para o Claude Desktop → *Configurações → Extensões*) e clique em **Instalar**.
3. Opcional: se o PhotoCraft não estiver em um local padrão, informe a pasta ou o caminho do `photocraft-cli` nas configurações da extensão.

### Codex (OpenAI)

**Recomendado — o marketplace (recebe atualizações):** *Plugins → Adicionar → Adicionar marketplace*, origem `jhonsu01/craft-marketplace`, referência `main`, e instale o **PhotoCraft Bridge** em **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). As novas versões chegam ao atualizar o marketplace. Ou envie o zip (o Codex o guarda na sua conta e recusa um zip mais novo com o mesmo nome):

1. Baixe `photocraft-mcp-server-<versão>-codex.zip` da [versão mais recente](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. No Codex: *Plugins → Adicionar → Novo plugin*, escolha o zip e clique em **Adicionar plugin**.
3. O Codex inicia o servidor com `node`, então o Node.js ≥ 20 precisa estar no `PATH`. Se o PhotoCraft não estiver em um local padrão, defina `PHOTOCRAFT_DIR` ou `PHOTOCRAFT_CLI` como variáveis de ambiente do sistema (o Codex não tem formulário de configuração para plugins locais).

### DeepSeek Harness

1. *Plugins → Add plugin*, digite `github:jhonsu01/craft-marketplace#path:/plugins/photocraft-mcp-server` e clique em **Install** e depois em **Enable now**.
2. O Harness inicia o servidor com seu próprio cliente MCP e `node` (Node.js ≥ 20 no `PATH`); as ferramentas aparecem como `mcp__photocraft__<ferramenta>` e os arquivos de saída como cartões que abrem no Harness.
3. O Harness ainda não atualiza plugins sozinho: para atualizar, desinstale o plugin e instale-o de novo com o mesmo endereço.

### Claude Code / outros clientes MCP

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

## Configuração

| Variável | Significado |
| --- | --- |
| `PHOTOCRAFT_DIR` | Pasta do PhotoCraft, um de seus executáveis, a raiz de um `.tar.gz` (com `bin/`) ou `PhotoCraft.app`. Padrão: detecção automática |
| `PHOTOCRAFT_CLI` | Caminho do `photocraft-cli` / `photocraft-cli.exe` (tem prioridade sobre `PHOTOCRAFT_DIR`) |
| `PHOTOCRAFT_APP` | Caminho do app de desktop quando está em outro lugar (ex.: um AppImage no Linux) |
| `PHOTOCRAFT_CONTROL_PORT` | Porta de controle do app de desktop (padrão 7878) |
| `PHOTOCRAFT_MCP_TIMEOUT` | Máximo de segundos por chamada ao motor (padrão 3600) |

## Segurança

- Os arquivos **nunca são sobrescritos**, exceto com `overwrite: true`: em uma pasta é usado um nome livre (`_2`) e um `output_path` existente dá erro. As entradas nunca são modificadas: o motor trabalha em cópias privadas.
- Todos os caminhos devem ser absolutos. O motor roda sem interface e nunca edita uma janela aberta do PhotoCraft, exceto com `live: true`. Comandos do motor que leem ou gravam arquivos por caminho direto (`file.open`, `file.placeEmbedded`, lotes...) são recusados pelo próprio PhotoCraft; as ferramentas deste servidor cuidam dos arquivos.
- Tudo roda localmente, sem acesso à rede. Cada tarefa usa um motor privado em uma pasta temporária que é apagada ao final. O token do app ao vivo fica em `%APPDATA%\photocraft-mcp-server` (Windows), `~/Library/Application Support/photocraft-mcp-server` (macOS) ou `~/.config/photocraft-mcp-server` (Linux).

## Desenvolvimento

```bash
npm run build       # TypeScript + bundle de arquivo único (dist/bundle.cjs)
npm test            # testes unitários (lógica de caminhos de Windows, macOS e Linux)
npm run test:e2e    # 24 testes de ponta a ponta via MCP stdio real (imagens sintéticas)
npm run pack:mcpb   # photocraft-mcp-server.mcpb
npm run pack:codex  # zip de plugin para o Codex
```

Teste de Linux no Docker (descompacte antes `photocraft-<versão>-linux-x86_64.tar.gz`):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/caminho/para/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## Licença

Apache-2.0. O PhotoCraft é © de seus autores (Storytold), MIT ou Apache-2.0.
Este projeto não é afiliado nem endossado pelo PhotoCraft ou pela Storytold. Photoshop é marca da Adobe.
