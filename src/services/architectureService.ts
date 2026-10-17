export interface ArchitectureAnalysis {
  overview: string;
  techStack: Array<{ name: string; category: string; role: string; necessity: string }>;
  architectureBreakdown: { pattern: string; dataFlow: string; modules: Array<{ name: string; purpose: string; responsibility: string }> };
  stepByStepLogic: Array<{ stepNumber: number; title: string; objective: string; keyTasks: string[]; pitfallsToAvoid: string }>;
  masterPrompt: string;
  visualDifferentiationTips: string;
}

export async function analyzeProjectArchitecture(
  projectName: string,
  file: File,
  
): Promise<ArchitectureAnalysis> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectName', projectName);

  
  
  
  
  

  const provider = (localStorage.getItem('ai_provider') || 'nvidia').trim();
  const apiKey = (localStorage.getItem('ai_api_key') || localStorage.getItem(`${provider}_api_key`) || localStorage.getItem('nvidia_api_key') || '').trim();
  const baseUrl = (localStorage.getItem('ai_base_url') || '').trim();
  const model = (localStorage.getItem('ai_model') || '').trim();
  const headers: Record<string, string> = { 'x-ai-provider': provider };
  if (apiKey) headers['x-ai-api-key'] = apiKey;
  if (baseUrl) headers['x-ai-base-url'] = baseUrl;
  if (model) headers['x-ai-model'] = model;

  const response = await fetch('/api/analyze-architecture', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Falha na resposta do servidor' }));
    throw new Error(err.error || 'Erro desconhecido na análise');
  }

  const data = await response.json();
  return data.analysis;
}
