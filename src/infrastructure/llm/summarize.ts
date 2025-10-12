export async function summarizeDiff(
  aiUrl: string,
  apiKey: string,
  diff: Record<string, { added: string[]; removed: string[] }>
): Promise<string> {
  const plain = JSON.stringify(diff);
  if (!aiUrl || !apiKey) {
    const truncated = plain.length > 1200 ? plain.slice(0, 1200) + '…' : plain;
    return `AI summary disabled (no AI credentials). Diff: ${truncated}`;
  }

  const body = {
    system: 'You are an analyst who summarizes the impact of API schema changes for consumers.',
    user: `Generate a short, clear and objective summary of the impact of the diff below for API consumers. Focus on what might break integrations or require adjustments. Diff: ${plain}`
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






