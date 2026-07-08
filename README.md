# Redutor de Imagens

> App desktop Windows para reduzir tamanho e dimensões de imagens em lote.
> Construído com Electron + sharp.

![Status](https://img.shields.io/badge/status-MVP-blue)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![Stack](https://img.shields.io/badge/stack-Electron%2032%20%2B%20sharp-blueviolet)

---

## ✨ Features

- 🖼️ **Drag & drop** de imagens direto na janela
- 📦 **Processamento em lote** multi-thread (até 16 workers)
- 🎯 **7 presets padrão** + presets customizados (pixels ou percentual)
- 🔄 **3 formatos de saída**: JPEG, PNG, WebP
- 🎚️ **Qualidade configurável** (10–100) com slider live
- 📐 **Manter proporção** ou forçar dimensões
- 🗂️ **Destino flexível**: mesma pasta, pasta custom ou sobrescrever
- 🖱️ **Integração com menu de contexto** do Windows (Explorer → botão direito)
- ⚡ **Quick Action Modal** pra fluxos rápidos vindos do Explorer
- 📊 **Progresso em tempo real** com métricas (economia, velocidade, ETA)
- 💾 **Configurações persistidas** (presets + prefs) em `userData`

---

## 🚀 Quick Start (dev)

```powershell
# Instalar dependências
npm install

# Rodar em modo dev
npm run dev

# Rodar em modo normal
npm start
```

> Requer Node 18+ e Windows 10/11.

---

## 🔧 Instalação do Menu de Contexto

Após rodar o app pelo menos uma vez (pra ele existir no sistema), instale a integração:

```powershell
npm run install-context-menu
```

Isso adiciona a opção **"Reduzir com Redutor de Imagens"** ao clicar com o botão direito em arquivos `.jpg`, `.jpeg`, `.png`, `.webp`.

Para remover:

```powershell
npm run uninstall-context-menu
```

> A integração é feita por usuário (HKCU), não requer privilégio de administrador.

---

## 📦 Build (gerar instalador .exe)

```powershell
# Build completo (.exe + instalador NSIS)
npm run build:win
```

O instalador sai em `dist/`. Suporta escolha de pasta de instalação, atalho no menu iniciar e desktop.

---

## 🏗️ Arquitetura

```
minimize-parakeet/
├── main.js                  # Electron main process (window mgmt + IPC)
├── preload.js               # Bridge IPC seguro (contextIsolation)
├── package.json
├── workers/
│   └── image-worker.js      # Thread separada com sharp (processamento)
├── renderer/
│   ├── index.html           # UI principal + Quick Action (hash-based)
│   ├── settings.html        # Janela de configurações
│   ├── styles.css           # Estilos compartilhados
│   ├── app.js               # Lógica da UI
│   └── settings.js          # Lógica das configurações
└── scripts/
    ├── install-context-menu.js    # Adiciona verb no registry
    └── uninstall-context-menu.js  # Remove verb
```

### Decisões técnicas

- **Electron 32** com `contextIsolation: true` + `nodeIntegration: false` → segurança
- **sharp** pra processamento (rápido, suporta JPEG/PNG/WebP, mantém EXIF orientation)
- **Worker threads** pra não travar a UI durante o lote
- **IPC via `ipcMain.handle` / `ipcRenderer.invoke`** pra comunicação assíncrona
- **Settings + presets** persistidos em JSON em `app.getPath('userData')`
- **Single instance lock** + segunda instância com arquivos via argv

---

## 🎮 Uso

### Fluxo principal (Main Window)

1. Arraste imagens pra janela OU clique em **Abrir arquivos**
2. Escolha um preset rápido OU defina W×H personalizados
3. Configure formato (JPEG/PNG/WebP), qualidade, destino
4. Clique em **Processar N imagens**
5. Acompanhe o progresso (métricas em tempo real)
6. Quando terminar, clique em **Abrir pasta de saída**

### Quick Action (via menu de contexto)

1. No Explorer, clique com botão direito numa imagem (ou várias selecionadas)
2. Escolha **"Reduzir com Redutor de Imagens"**
3. Modal compacto abre com presets em destaque
4. Clique em **Reduzir agora** → processamento inicia em background

### Presets customizados

1. No painel principal, clique em **Gerenciar Presets...**
2. Preencha nome + tipo (pixels ou percentual) + dimensões
3. Salve — o preset aparece nos grids

---

## ⚠️ Edge cases tratados

| Cenário | Comportamento |
|---|---|
| Imagem menor que o alvo | Por padrão, NÃO amplia (mantém tamanho original). Marque "Permitir ampliação" pra forçar. |
| Sobrescrever original | Checkbox off por padrão. Confirmação obrigatória se ativado. |
| Arquivo de saída já existe | Auto-sufixo `_1`, `_2`, ... pra não colidir |
| Pasta protegida | Mostra erro "permission denied" com nome do arquivo |
| Formato não suportado | Ignorado na abertura (filter só mostra JPG/PNG/WebP) |
| Drag & drop de arquivo não-imagem | Aceito, falha é reportada no item com status "Erro" |
| 1000+ arquivos | Pool de 4 workers em paralelo, sem travar UI |

---

## 🛠️ Stack

- **Electron 32** — framework desktop
- **sharp 0.33** — processamento de imagem (libvips binding)
- **electron-builder 25** — empacotamento e instalador NSIS

Sem React/Vue/etc — vanilla HTML/CSS/JS pra manter o bundle leve e o startup rápido.

---

## 📝 Licença

MIT