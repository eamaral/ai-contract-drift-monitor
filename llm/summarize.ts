export async function summarizeDiff(
  aiUrl: string,
  apiKey: string,
  diff: Record<string, { added: string[]; removed: string[] }>
): Promise<string> {
  const plain = JSON.stringify(diff);
  if (!aiUrl || !apiKey) {
    const truncated = plain.length > 1200 ? plain.slice(0, 1200) + '…' : plain;
    return `Resumo desativado (sem credenciais de IA). Diff: ${truncated}`;
  }

  const body = {
    system: 'Você é um analista que resume impactos de mudanças de schema de APIs para consumidores.',
    user: `Gere um resumo curto, claro e objetivo do impacto do diff abaixo para consumidores de API. Foque no que pode quebrar integrações ou exigir ajustes. Diff: ${plain}`
  };

  const res = await fetch(aiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI summarize failed: ${res.status} ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  const content = (data && (data.content || data.message || data.result)) ?? '';
  return typeof content === 'string' && content.trim().length > 0
    ? content
    : JSON.stringify(data);
}






