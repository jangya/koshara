import 'server-only';

export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export interface JevChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface JevTrace {
  request: {model: string; state: unknown; questions: Record<string, JevChoiceQuestion>};
  response: unknown;
  status: number | 'skipped' | 'error';
}

export async function askJevChoices(state: unknown, questions: Record<string, JevChoiceQuestion>, onTrace?: (trace: JevTrace) => void, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  const body = {model: 'jev-latest', state, questions};
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) {
    onTrace?.({request: body, response: {reason: 'TYPESAFE_API_KEY is not configured'}, status: 'skipped'});
    return null;
  }
  try {
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    const rawResponse = await response.text();
    let payload: unknown;
    try { payload = JSON.parse(rawResponse) as unknown; } catch { payload = rawResponse; }
    onTrace?.({request: body, response: payload, status: response.status});
    if (!response.ok) throw new Error(`TypeSafe returned ${response.status}`);
    if (!payload || typeof payload !== 'object' || !('answers' in payload)) return null;
    const answers = payload.answers;
    return answers && typeof answers === 'object' && !Array.isArray(answers) ? answers as Record<string, unknown> : null;
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith('TypeSafe returned '))) {
      onTrace?.({request: body, response: {error: error instanceof Error ? error.message : String(error)}, status: 'error'});
    }
    throw error;
  }
}

export function validatedChoice(answer: unknown, allowed: readonly string[], minimumConfidence = 0.7): string | null {
  if (!answer || typeof answer !== 'object') return null;
  const value = answer as Partial<JevChoiceAnswer>;
  return value.type === 'choice' && typeof value.choice === 'string' && allowed.includes(value.choice)
    && typeof value.confidence === 'number' && Number.isFinite(value.confidence)
    && value.confidence >= minimumConfidence && value.confidence <= 1
    && value.probabilities !== null && typeof value.probabilities === 'object'
    ? value.choice : null;
}
