import AdmZip from 'adm-zip';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MAX_ENTRIES = 12000;
const MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024;
const MAX_TEXT_PER_FILE = 160_000;
const MAX_TOTAL_TEXT = 1_500_000;
const TEXT_EXTENSIONS = new Set([
  '.xml', '.json', '.txt', '.md', '.html', '.htm', '.js', '.jsx', '.ts', '.tsx', '.css', '.scss',
  '.java', '.kt', '.smali', '.gradle', '.properties', '.yml', '.yaml', '.toml', '.py', '.go', '.rs',
  '.c', '.h', '.cpp', '.hpp', '.dart', '.sh', '.sql', '.proto', '.graphql', '.plist', '.cfg', '.ini',
]);

export function analisarPacoteReal(filePath: string, originalName = path.basename(filePath)) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carol-analysis-'));
  const resultado = { manifest: '', codigo: '', erro: null as string | null, formato: 'desconhecido' };
  const ext = path.extname(originalName || filePath).toLowerCase();
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error('O arquivo temporário não existe.');
    const size = fs.statSync(filePath).size;
    if (size <= 0) throw new Error('O arquivo está vazio.');
    if (size > 250 * 1024 * 1024) throw new Error('O arquivo excede o limite de 250 MB.');

    if (ext === '.zip' || ext === '.apk') {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      if (entries.length > MAX_ENTRIES) throw new Error(`O arquivo contém mais de ${MAX_ENTRIES} entradas.`);
      let totalUncompressed = 0;
      let totalText = 0;
      const inventory: string[] = [];
      const evidence: string[] = [];
      let hasDex = false;
      let hasManifest = false;
      for (const entry of entries) {
        const entryName = entry.entryName.replace(/\\/g, '/');
        if (entryName.startsWith('/') || entryName.split('/').some((part) => part === '..')) {
          throw new Error(`Caminho inseguro detectado no arquivo: ${entryName.slice(0, 180)}`);
        }
        totalUncompressed += Math.max(0, entry.header.size || 0);
        if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) throw new Error('O tamanho descompactado excede 500 MB; análise interrompida para proteger o servidor.');
        if (entry.isDirectory) continue;
        inventory.push(entryName);
        if (/(^|\/)AndroidManifest\.xml$/i.test(entryName)) {
          hasManifest = true;
          try {
            const content = entry.getData();
            const text = content.toString('utf8');
            resultado.manifest += `\n--- ${entryName} ---\n${text.slice(0, 25000)}`;
          } catch { resultado.manifest += `\n${entryName}: manifesto presente, mas não decodificável como texto.`; }
        }
        if (/\.dex$/i.test(entryName)) hasDex = true;
        const entryExt = path.extname(entryName).toLowerCase();
        const relevantName = /(^|\/)(package\.json|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|pom\.xml|requirements\.txt|go\.mod|Cargo\.toml|pubspec\.yaml|AndroidManifest\.xml|README(\.md|\.txt)?|tsconfig\.json|vite\.config\.[^/]+|\.env\.example)$/i.test(entryName);
        if (TEXT_EXTENSIONS.has(entryExt) || relevantName) {
          if (totalText >= MAX_TOTAL_TEXT) continue;
          try {
            const data = entry.getData();
            const text = data.subarray(0, Math.min(MAX_TEXT_PER_FILE, MAX_TOTAL_TEXT - totalText)).toString('utf8');
            if (text.includes('\u0000')) continue;
            if (text.trim()) {
              evidence.push(`\n===== ARQUIVO: ${entryName} =====\n${text}`);
              totalText += text.length;
            }
          } catch { /* unreadable entry is listed in inventory */ }
        }
      }
      resultado.formato = ext === '.apk' ? 'APK Android (contêiner ZIP)' : 'Arquivo ZIP';
      resultado.manifest ||= `Inventário do pacote (${inventory.length} arquivos). Manifesto Android: ${hasManifest ? 'encontrado' : 'não encontrado'}. DEX: ${hasDex ? 'encontrado' : 'não encontrado'}.`;
      resultado.codigo = `INVENTÁRIO DE ARQUIVOS (${inventory.length})\n${inventory.slice(0, 4000).join('\n')}\n\n${evidence.join('\n').slice(0, MAX_TOTAL_TEXT)}`;

      if (ext === '.apk') {
        // Run analysis tools without shell interpolation. Failures are recorded, not fabricated.
        try {
          execFileSync('apktool', ['d', '-f', '-s', '-o', path.join(tempDir, 'apktool'), filePath], { stdio: 'pipe', timeout: 60_000 });
          const manifestPath = path.join(tempDir, 'apktool', 'AndroidManifest.xml');
          if (fs.existsSync(manifestPath)) resultado.manifest += `\n\n--- AndroidManifest.xml decodificado pelo Apktool ---\n${fs.readFileSync(manifestPath, 'utf8').slice(0, 25000)}`;
        } catch (e: any) { resultado.codigo += `\n\n[HERRAMIENTA] Apktool não disponível ou falhou: ${String(e?.message || e).slice(0, 500)}`; }
        try {
          execFileSync('jadx', ['-d', path.join(tempDir, 'jadx'), filePath], { stdio: 'pipe', timeout: 120_000 });
          const jadxRoot = path.join(tempDir, 'jadx');
          const files: string[] = [];
          const walk = (dir: string) => {
            if (files.length >= 80) return;
            for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, item.name);
              if (item.isDirectory()) walk(full);
              else if (item.isFile() && /\.(java|kt)$/i.test(item.name) && files.length < 80) files.push(full);
            }
          };
          if (fs.existsSync(jadxRoot)) walk(jadxRoot);
          for (const file of files) {
            if (totalText >= MAX_TOTAL_TEXT) break;
            const text = fs.readFileSync(file, 'utf8').slice(0, 30_000);
            resultado.codigo += `\n\n===== DESCOMPILADO: ${path.relative(jadxRoot, file)} =====\n${text}`;
            totalText += text.length;
          }
          if (!files.length) resultado.codigo += '\nJADX terminou, mas nenhum arquivo Java/Kotlin foi recuperado.';
        } catch (e: any) { resultado.codigo += `\n\n[HERRAMIENTA] JADX não disponível ou falhou: ${String(e?.message || e).slice(0, 500)}`; }
      }
    } else {
      resultado.formato = `formato não suportado pelo analisador profundo (${ext || 'sem extensão'})`;
      resultado.codigo = `O arquivo foi recebido, mas a análise profunda atual aceita ZIP e APK. Nome original: ${path.basename(originalName)}. Para executáveis ou outros arquivos, é necessária uma ferramenta específica; nenhum código foi executado.`;
    }
  } catch (err: any) {
    resultado.erro = String(err?.message || err);
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* cleanup best effort */ }
  }
  return resultado;
}
