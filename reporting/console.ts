export type Fact = { name: string; value: string };

export async function sendConsoleMessage(
  title: string,
  text: string,
  facts?: Fact[]
): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`🚨 ${title}`);
  console.log('='.repeat(60));
  console.log(`📝 ${text}`);
  
  if (facts && facts.length > 0) {
  console.log('\n📊 Details:');
  facts.forEach(fact => {
    console.log(`   • ${fact.name}: ${fact.value}`);
  });
  }
  
  console.log('\n⏰ Timestamp:', new Date().toISOString());
  console.log('='.repeat(60) + '\n');
}
