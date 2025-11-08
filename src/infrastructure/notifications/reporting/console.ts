export type Fact = { name: string; value: string };

export async function sendConsoleMessage(
  title: string,
  text: string,
  facts?: Fact[]
): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(title); // Remove emoji duplicate - already in title
  console.log(text);  // Remove emoji duplicate - already in text
  
  // Facts are NOT printed here - they're for Teams/external notifications only
  // Console output should be clean and focused on the AI analysis
  
  console.log('='.repeat(60) + '\n');
}
