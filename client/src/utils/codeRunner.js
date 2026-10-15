import { SERVER_URL as serverUrl } from '../lib/serverUrl.js';

export async function runCompiledCode(language, code) {
  let response;
  try {
    response = await fetch(`${serverUrl}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code }),
    });
  } catch {
    // fetch only rejects for network-level failures (server down, offline, blocked by CORS).
    throw new Error(
      'Could not reach the CollabCode server to run this code. Check that the server is running and try again.',
    );
  }

  const result = await response.json().catch(() => ({ error: 'The runner returned an invalid response.' }));
  if (!response.ok) throw new Error(result.error || 'The code runner could not execute this program.');
  return result;
}
