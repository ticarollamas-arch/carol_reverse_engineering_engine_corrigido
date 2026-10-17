import React from 'react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0b0b12] text-slate-200 font-sans flex flex-col">
      <header className="border-b border-[#30233f] p-4 md:p-6 flex flex-wrap justify-between items-center bg-[#15121d]">
        <h1 className="text-xl md:text-2xl font-bold text-fuchsia-300">Engenharia Reversa</h1>
        <nav className="mt-4 md:mt-0 flex gap-4">
          <a href="#features" className="hover:text-fuchsia-300 transition">Recursos</a>
          <a href="/app" className="bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-fuchsia-500 hover:to-violet-500 transition">Testar Grátis</a>
        </nav>
      </header>

      <main className="flex-grow max-w-6xl mx-auto px-4 py-12 md:py-24 w-full">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
            Desconstrua qualquer software.<br />
            <span className="text-fuchsia-300">Entenda a lógica. Recrie com sua identidade.</span>
          </h2>
          <p className="text-lg md:text-xl text-slate-400 mb-8">
            Inspecione projetos ZIP e pacotes Android com evidências de arquivos, tecnologias, dependências e integrações observáveis. Gere relatórios e especificações para construir uma alternativa independente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/app" className="bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:from-fuchsia-500 hover:to-violet-500 transition">
              Acessar a Ferramenta
            </a>
          </div>
        </div>

        <section id="features" className="grid md:grid-cols-3 gap-8 my-24">
          <div className="bg-[#17141f] p-6 rounded-xl border border-[#382849]">
            <h3 className="text-xl font-bold text-fuchsia-300 mb-3">Análise de ZIP/APK</h3>
            <p className="text-slate-400">Inventário de arquivos, limites de extração e registro claro das limitações da análise.</p>
          </div>
          <div className="bg-[#17141f] p-6 rounded-xl border border-[#382849]">
            <h3 className="text-xl font-bold text-fuchsia-300 mb-3">Prompt por Arquivo</h3>
            <p className="text-slate-400">Produz um relatório técnico e um prompt de desenvolvimento baseado no conteúdo encontrado.</p>
          </div>
          <div className="bg-[#17141f] p-6 rounded-xl border border-[#382849]">
            <h3 className="text-xl font-bold text-fuchsia-300 mb-3">Multi-Provedor IA</h3>
            <p className="text-slate-400">Compatível com NVIDIA NIM, DeepSeek, OpenAI e Ollama Cloud.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#30233f] p-8 text-center text-slate-500 text-sm bg-[#15121d]/70">
        <p className="mb-4">&copy; {new Date().getFullYear()} Engenharia Reversa. Todos os direitos reservados.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="/privacidade" className="hover:text-fuchsia-300 transition">Política de Privacidade</a>
          <a href="/termos" className="hover:text-fuchsia-300 transition">Termos de Uso</a>
          <a href="/cookies" className="hover:text-fuchsia-300 transition">Política de Cookies</a>
        </div>
      </footer>
    </div>
  );
}
