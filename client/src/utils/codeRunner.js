const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export async function runCompiledCode(language, code) {
  const response = await fetch(`${serverUrl}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code }),
  });

  const result = await response.json().catch(() => ({ error: 'The runner returned an invalid response.' }));
  if (!response.ok) throw new Error(result.error || 'The code runner could not execute this program.');
  return result;
}
