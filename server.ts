import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { analisarPacoteReal } from './backend-analyzer.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Configuração do Multer para receber arquivos
const uploadDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    // Preserve the original extension: the analyzer uses it to distinguish APK from ZIP.
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 250 * 1024 * 1024, files: 1 },
});

// Carregar o Prompt CAROL
const promptPath = path.resolve(process.cwd(), 'src/prompts/carol-master.md');
const masterSystemPrompt = fs.readFileSync(promptPath, 'utf8');

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string; envKey?: string }> = {
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct', envKey: 'NVIDIA_API_KEY' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', envKey: 'OPENAI_API_KEY' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY' },
  ollama: { baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1', model: process.env.OLLAMA_MODEL || 'llama3.3' },
  custom: { baseUrl: '', model: '' },
};

// ==========================================
// ROTA DE ANÁLISE (APK/ZIP via JADX + IA)
// ==========================================
app.post('/api/analyze-architecture', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  const uploadedPath = req.file?.path;
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado para análise.' });
      return;
    }

    const projectName = String(req.body.projectName || req.file.originalname || 'Projeto enviado').slice(0, 240);
    const provider = String(req.get('x-ai-provider') || 'nvidia').toLowerCase();
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.custom;
    const targetBaseUrl = String(req.get('x-ai-base-url') || defaults.baseUrl || '').trim();
    const targetModel = String(req.get('x-ai-model') || defaults.model || '').trim();
    const targetApiKey = String(req.get('x-ai-api-key') || req.get('x-nvidia-api-key') || (defaults.envKey ? process.env[defaults.envKey] : '') || '').trim();

    if (!targetBaseUrl || !targetModel) {
      res.status(400).json({ error: `Configure a URL base e o modelo do provedor ${provider} no painel de IA.` });
      return;
    }
    if (provider !== 'ollama' && !targetApiKey) {
      res.status(401).json({ error: `Chave de API ausente para ${provider}. Informe a chave no painel ou configure a variável de ambiente correspondente.` });
      return;
    }

    console.log(`Iniciando análise de ${req.file.originalname} (${req.file.size} bytes) com ${provider}/${targetModel}`);
    const dadosReais = analisarPacoteReal(req.file.path, req.file.originalname);
    if (dadosReais.erro) {
      res.status(422).json({ error: `Não foi possível analisar o arquivo: ${dadosReais.erro}` });
      return;
    }
    if (!dadosReais.manifest.trim() && !dadosReais.codigo.trim()) {
      res.status(422).json({ error: 'O arquivo foi recebido, mas não foram encontrados conteúdos analisáveis. Envie um ZIP de projeto ou um APK válido.' });
      return;
    }

    const promptFinal = `Analise o arquivo real enviado. Nome: ${projectName}.
Formato detectado: ${dadosReais.formato}.

=== INVENTÁRIO E MANIFESTO ===
${dadosReais.manifest.slice(0, 25000)}

=== CÓDIGO E EVIDÊNCIAS EXTRAÍDAS ===
${dadosReais.codigo.slice(0, 90000)}

Produza um relatório em português brasileiro conforme o Prompt Mestre. Diferencie evidências observadas, inferências e recomendações. Não invente informações. Retorne JSON válido com overview, techStack, architectureBreakdown, stepByStepLogic, masterPrompt e visualDifferentiationTips. O campo masterPrompt deve conter o prompt de reconstrução específico deste arquivo.`;
    const completionsUrl = `${targetBaseUrl.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    let llmRes: globalThis.Response;
    try {
      llmRes = await fetch(completionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(targetApiKey ? { Authorization: `Bearer ${targetApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: masterSystemPrompt },
            { role: 'user', content: promptFinal },
          ],
          temperature: 0.2,
          max_tokens: 8000,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!llmRes.ok) {
      const errText = (await llmRes.text().catch(() => '')).slice(0, 1500);
      console.error(`Provedor ${provider} retornou HTTP ${llmRes.status}: ${errText}`);
      res.status(502).json({ error: `O provedor ${provider} recusou a análise (HTTP ${llmRes.status}). Verifique a chave, o modelo, a URL e a cota. Detalhe: ${errText || 'sem detalhe retornado'}` });
      return;
    }

    const llmData: any = await llmRes.json();
    let rawContent = llmData?.choices?.[0]?.message?.content;
    if (Array.isArray(rawContent)) rawContent = rawContent.map((part: any) => part?.text || '').join('');
    if (typeof rawContent !== 'string' || !rawContent.trim()) {
      res.status(502).json({ error: `O provedor ${provider} respondeu sem conteúdo de análise.` });
      return;
    }
    rawContent = rawContent.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Keep the real model output rather than replacing it with a fabricated report.
      parsed = {
        overview: 'O modelo retornou um relatório em texto; o conteúdo integral foi preservado abaixo.',
        techStack: [],
        architectureBreakdown: { pattern: 'Não estruturado pelo modelo', dataFlow: 'Consulte o relatório textual', modules: [] },
        stepByStepLogic: [],
        masterPrompt: rawContent,
        visualDifferentiationTips: 'Crie identidade visual própria com base nas funcionalidades comprovadas no relatório.',
      };
    }
    if (typeof parsed.masterPrompt !== 'string' || !parsed.masterPrompt.trim()) parsed.masterPrompt = rawContent;
    res.json({ success: true, analysis: parsed, metadata: { fileName: req.file.originalname, provider, model: targetModel, format: dadosReais.formato } });
  } catch (error: any) {
    console.error('Falha na análise de arquitetura:', error);
    if (error?.name === 'AbortError') {
      res.status(504).json({ error: 'A análise excedeu o limite de 3 minutos. Tente um arquivo menor ou um modelo mais rápido.' });
      return;
    }
    res.status(500).json({ error: `Falha ao gerar a análise: ${error?.message || 'erro interno desconhecido'}` });
  } finally {
    if (uploadedPath) {
      try { fs.unlinkSync(uploadedPath); } catch { /* already removed */ }
    }
  }
});

// ==========================================
// CONFIGURAÇÃO VITE E PRODUÇÃO
// ==========================================
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CAROL Engine rodando na porta ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
});
