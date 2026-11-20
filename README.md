<p align="center"><img src="assets/banner.svg" alt="Engenheiro Reverso CAROL — análise clean-room de APK/ZIP com limites de segurança" width="100%"></p>

# Engenheiro Reverso (CAROL) — análise clean-room de APK e ZIP com IA

Aplicação full-stack (**React + Vite** no front-end e **Express** no back-end) que faz **engenharia reversa clean-room** de pacotes **APK e ZIP**. O servidor extrai o pacote com **apktool** e **JADX**, reúne manifesto, estrutura e trechos de código, e envia esse resumo a um **modelo de linguagem à sua escolha** (Ollama, NVIDIA NIM, OpenAI, DeepSeek, Groq ou endpoint próprio). O modelo devolve um relatório de arquitetura e um **prompt mestre** para reimplementar o projeto de forma independente. A interface também publica arquivos no GitHub (ZipToGit).

> Mesmo código do [Engenheiro-Reverso](https://github.com/ticarollamas-arch/Engenheiro-Reverso).

## Recursos

- **Landing page** e páginas de Termos, Privacidade e Cookies; a ferramenta fica em `/app`.
- **Envio de pacotes** com árvore de arquivos, pré-visualização e seção dedicada a APK.
- **Análise real no servidor** (`POST /api/analyze-architecture`, upload multipart):
  - `apktool` decodifica recursos e manifesto (timeout de 60 s);
  - `JADX` descompila até 30 arquivos Java (512 MB de RAM, timeout de 120 s);
  - ZIPs são percorridos por inteiro, com leitura dos arquivos de texto relevantes;
  - limites de 250 MB por upload, 12 mil entradas, 500 MB descompactados e timeout de 3 minutos;
  - os arquivos temporários são apagados ao final.
- **Vários provedores de IA**: NVIDIA NIM (padrão), OpenAI, DeepSeek, Groq, Ollama ou endpoint próprio, escolhidos no painel e enviados pelos cabeçalhos `x-ai-provider`, `x-ai-api-key`, `x-ai-base-url` e `x-ai-model`.
- **Respostas honestas**: se o modelo não devolver JSON válido, o texto real é preservado em vez de um relatório inventado; falhas do apktool ou do JADX são registradas.
- **Relatório gerado por IA**: visão geral, stack, arquitetura, lógica passo a passo, prompt mestre e dicas de diferenciação visual, guiado pelo prompt de sistema em `src/prompts/carol-master.md`.
- **Publicação no GitHub** com token pessoal e pipeline de envio.
- **Proteções** contra *Zip Slip* e *zip bomb* no tratamento dos pacotes.

## Instalação

Requisitos: **Node.js 20+**, **apktool** e **JADX** no PATH (para análise de APK) e a chave de pelo menos um provedor de IA (ou um Ollama).

```bash
git clone https://github.com/ticarollamas-arch/carol_reverse_engineering_engine_corrigido.git
cd carol_reverse_engineering_engine_corrigido
npm install
cp .env.example .env
```

| Variável | Uso |
|---|---|
| `NVIDIA_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY` | Chaves dos provedores (também podem ser informadas no painel) |
| `OLLAMA_BASE_URL` | Ollama local |
| `PORT` | Porta do servidor |

No Termux: `pkg install apktool` e instale o JADX manualmente; o limite de memória já foi pensado para celulares.

## Como usar

```bash
npm run dev        # servidor Express + Vite
npm run build      # build de produção
```

Abra `/app`, escolha o provedor, envie o APK ou ZIP e gere o relatório. Para publicar um pacote no GitHub, informe o token, o repositório e a branch.

## Estrutura

```
server.ts               API Express (upload + análise com o provedor escolhido)
backend-analyzer.ts     extração com apktool e JADX
src/                    front-end React (landing, app, páginas legais)
src/prompts/            prompts de sistema da análise
RELATORIO-CORRECOES.md  diagnóstico e correções desta versão
```

## Uso responsável

Analise apenas pacotes próprios ou com autorização do titular. A especificação gerada serve para uma implementação original: não copie código, marcas ou ativos de terceiros e não remova avisos de autoria ou licença.

## Tecnologias

TypeScript · React 19 · Vite · Tailwind CSS · Express · Multer · adm-zip · JSZip · apktool · JADX · NVIDIA NIM · OpenAI · DeepSeek · Groq · Ollama · GitHub REST API

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
