import type {ParsedTransaction} from './types';

type Category = NonNullable<ParsedTransaction['classification']>['category'];
type ChoiceAnswer = {type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number>};
type Answers = Record<string, ChoiceAnswer>;

const categories: Record<Category, string> = {
  FOOD: 'Restaurants, prepared food, food delivery',
  GROCERIES: 'Food and household groceries',
  SHOPPING: 'Retail purchases other than groceries',
  TRANSPORT: 'Rides, public transit, fuel, travel transport',
  UTILITIES: 'Electricity, water, internet, phone and other utilities',
  RENT: 'Housing rent',
  EMI: 'Loan installment or EMI payment',
  TRANSFER: 'Money moved between accounts or people',
  SALARY: 'Pay or wages from employment',
  INVESTMENT: 'Investment purchase, sale or contribution',
  HEALTHCARE: 'Medical treatment, pharmacy or healthcare',
  ENTERTAINMENT: 'Movies, games and leisure activities',
  FEES: 'Bank charges, service fees, penalties or taxes',
  OTHER: 'A real transaction that fits none of the other categories',
};
const directions = {DEBIT: 'Money leaves the account', CREDIT: 'Money enters the account', UNKNOWN: 'The direction cannot be determined'};
const realOptions = {REAL: 'A genuine account transaction', NOT_TRANSACTION: 'A summary, header, duplicate layout artifact, or non-transaction row'};
const reviewOptions = {YES: 'Row meaning, category, amount or direction needs human review', NO: 'Row is clear enough for ordinary review'};
const minimumConfidence = 0.7;
const chunkSize = 20;

export type JevRow = Pick<ParsedTransaction, 'date' | 'description' | 'amountMinor' | 'kind' | 'balanceMinor' | 'sourcePage' | 'confidence' | 'directionAmbiguous'> & {knownCategory?: Category};
export type JevDecision = NonNullable<ParsedTransaction['classification']> & {direction?: 'DEBIT' | 'CREDIT' | 'UNKNOWN'};

export function fallbackDecision(row?: JevRow): JevDecision {
  return {isTransaction: true, category: row?.knownCategory ?? 'OTHER', needsReview: true};
}

function choice(answer: unknown, allowed: string[]): ChoiceAnswer | null {
  if (!answer || typeof answer !== 'object') return null;
  const value = answer as Partial<ChoiceAnswer>;
  return value.type === 'choice' && typeof value.choice === 'string' && allowed.includes(value.choice)
    && typeof value.confidence === 'number' && value.confidence >= 0 && value.confidence <= 1
    && value.probabilities && typeof value.probabilities === 'object' ? value as ChoiceAnswer : null;
}

async function classifyChunk(rows: JevRow[], key: string): Promise<JevDecision[]> {
  const questions: Record<string, {type: 'choice'; instructions: string; criteria: Record<string, string>}> = {};
  rows.forEach((row, index) => {
    const reference = `rows[${index}]`;
    questions[`real_${index}`] = {type: 'choice', instructions: `Is ${reference} a real posted bank transaction?`, criteria: realOptions};
    if (!row.knownCategory) questions[`category_${index}`] = {type: 'choice', instructions: `Assuming ${reference} is a real transaction, which category best describes its merchant or purpose?`, criteria: categories};
    if (row.directionAmbiguous) questions[`direction_${index}`] = {type: 'choice', instructions: `For ${reference}, does money enter or leave the account? Choose UNKNOWN when the row does not say.`, criteria: directions};
    questions[`review_${index}`] = {type: 'choice', instructions: `Does ${reference} need manual review due to uncertain row meaning, amount, category or direction?`, criteria: reviewOptions};
  });
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: 'jev-latest', state: {rows: rows.map((row) => ({
      ...row, kind: row.directionAmbiguous ? 'UNKNOWN' : row.kind,
    }))}, questions}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`TypeSafe returned ${response.status}`);
  const payload = await response.json() as {answers?: Answers};
  const answers = payload.answers ?? {};
  return rows.map((row, index) => {
    const real = choice(answers[`real_${index}`], Object.keys(realOptions));
    const category = row.knownCategory ? null : choice(answers[`category_${index}`], Object.keys(categories));
    const review = choice(answers[`review_${index}`], Object.keys(reviewOptions));
    const direction = row.directionAmbiguous ? choice(answers[`direction_${index}`], Object.keys(directions)) : null;
    if (!real || (!row.knownCategory && !category) || !review || (row.directionAmbiguous && !direction)) return fallbackDecision(row);
    const categoryName = row.knownCategory ?? category!.choice as Category;
    const uncertain = real.confidence < minimumConfidence || (category?.confidence ?? 1) < minimumConfidence
      || review.confidence < minimumConfidence || (direction?.confidence ?? 1) < minimumConfidence
      || Boolean(row.directionAmbiguous && direction?.choice === 'UNKNOWN');
    return {
      isTransaction: real.choice === 'REAL' || real.confidence < minimumConfidence,
      category: categoryName,
      categoryConfidence: category?.confidence,
      needsReview: review.choice === 'YES' || uncertain,
      direction: direction?.choice as JevDecision['direction'],
    };
  });
}

export async function classifyWithJev(rows: JevRow[]): Promise<JevDecision[]> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return rows.map((row) => fallbackDecision(row));
  const decisions: JevDecision[] = [];
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    try {
      decisions.push(...await classifyChunk(chunk, key));
    } catch {
      decisions.push(...chunk.map((row) => fallbackDecision(row)));
    }
  }
  return decisions;
}
