export type Fact = { name: string; value: string };

export async function sendTeamsMessage(
  webhookUrl: string,
  title: string,
  text: string,
  facts?: Fact[]
): Promise<void> {
  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: '0076D7',
    summary: title,
    title,
    text,
    sections: facts && facts.length > 0 ? [
      {
        facts: facts.map((f) => ({ name: f.name, value: f.value }))
      }
    ] : []
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Teams webhook failed: ${res.status} ${res.statusText} - ${body}`);
  }
}






