async function testGemmaVision() {
  const accountId = 'bfae8e23d4843a674d849378b759d367';
  const apiToken = 'cfut_pc7UgpkzIERgwVFDwfD0b5rHjcsBRcquRYXhgTH8c5b94e42';
  const baseUrl = 'https://api.cloudflare.com/client/v4';
  const modelId = '@cf/google/gemma-4-26b-a4b-it';

  const endpointUrl = `${baseUrl}/accounts/${accountId}/ai/run/${modelId}`;

  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

  // Test 1: Cloudflare payload with { prompt, image: Array.from(...) }
  console.log('Testing payload with image bytes array...');
  const res1 = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: 'What is this image?',
      image: Array.from(tinyPng),
      max_tokens: 100
    })
  });
  console.log('Res 1 status:', res1.status);
  console.log('Res 1 text:', await res1.text());
}

testGemmaVision();
