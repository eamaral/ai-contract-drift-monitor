export async function summarizeDiff(
  aiUrl: string,
  apiKey: string,
  diff: Record<string, { added: string[]; removed: string[] }>
): Promise<string> {
  const plain = JSON.stringify(diff, null, 2);
  
  if (!aiUrl || !apiKey) {
    const truncated = plain.length > 1200 ? plain.slice(0, 1200) + '…' : plain;
    return `AI summary disabled (no AI credentials). Diff: ${truncated}`;
  }

  // Groq API format (OpenAI compatible)
  const body = {
    model: 'llama-3.3-70b-versatile', // Groq's latest free model
    messages: [
      {
        role: 'system',
        content: 'You are an expert API analyst who summarizes the impact of API schema changes for consumers. Be concise and focus on business impact.'
      },
      {
        role: 'user',
        content: `Analyze this API schema diff and explain the impact for API consumers. Focus on what might break integrations or require adjustments.\n\nDiff:\n${plain}\n\nProvide a SHORT summary (2-3 sentences max) highlighting critical changes.`
      }
    ],
    temperature: 0.3,
    max_tokens: 200
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
    console.error(`[AI] Request failed: ${res.status} ${res.statusText}`);
    console.error(`[AI] Response: ${text}`);
    return `AI summary failed (${res.status}). Diff: ${plain.slice(0, 500)}...`;
  }
  
  const data = await res.json();
  
  // Extract content from Groq response
  const content = data?.choices?.[0]?.message?.content;
  
  if (content && typeof content === 'string' && content.trim().length > 0) {
    return content.trim();
  }
  
  // Fallback
  console.error('[AI] Unexpected response format:', JSON.stringify(data));
  return `AI summary unavailable. Diff: ${plain.slice(0, 500)}...`;
}






