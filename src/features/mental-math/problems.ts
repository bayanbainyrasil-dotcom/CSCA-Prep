export const MENTAL_MATH_PROBLEM_COUNT = 10;

export type MentalMathProblemKind =
  | 'square'
  | 'percentage'
  | 'fraction'
  | 'root'
  | 'product'
  | 'scientific-notation'
  | 'estimation';

export interface MentalMathProblem {
  id: string;
  kind: MentalMathProblemKind;
  prompt: string;
  answer: number;
  operands: readonly number[];
}

const PROBLEM_KINDS: readonly MentalMathProblemKind[] = [
  'square',
  'percentage',
  'fraction',
  'root',
  'product',
  'scientific-notation',
  'estimation',
];

const PERCENTAGES = [10, 20, 25, 50, 75] as const;

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function buildProblem(seed: number, index: number): MentalMathProblem {
  const kind = PROBLEM_KINDS[index % PROBLEM_KINDS.length]!;
  const a = modulo(seed * 7 + index * 11, 24) + 2;
  const id = `mental-${seed}-${index + 1}`;

  if (kind === 'square') {
    return { id, kind, prompt: `${a}²`, answer: a * a, operands: [a] };
  }

  if (kind === 'percentage') {
    const percentage = PERCENTAGES[modulo(seed + index, PERCENTAGES.length)]!;
    const base = (modulo(seed * 13 + index * 17, 16) + 2) * 20;
    return {
      id,
      kind,
      prompt: `${percentage}% of ${base}`,
      answer: (percentage * base) / 100,
      operands: [percentage, base],
    };
  }

  if (kind === 'fraction') {
    const numerator = a * 2;
    return {
      id,
      kind,
      prompt: `${numerator}/4 + ${numerator}/4`,
      answer: a,
      operands: [numerator, 4, numerator, 4],
    };
  }

  if (kind === 'root') {
    const radicand = a * a;
    return { id, kind, prompt: `√${radicand}`, answer: a, operands: [radicand] };
  }

  if (kind === 'product') {
    const right = a + 3;
    return { id, kind, prompt: `${a} × ${right}`, answer: a * right, operands: [a, right] };
  }

  if (kind === 'scientific-notation') {
    const coefficient = modulo(a, 8) + 2;
    const exponent = modulo(seed + index, 4) + 2;
    return {
      id,
      kind,
      prompt: `${coefficient} × 10^${exponent}`,
      answer: coefficient * 10 ** exponent,
      operands: [coefficient, exponent],
    };
  }

  const left = a * 4 + 1;
  const right = modulo(seed * 5 + index * 7, 18) + 12;
  return {
    id,
    kind,
    prompt: `Estimate ${left} × ${right} to the nearest 100`,
    answer: Math.round((left * right) / 100) * 100,
    operands: [left, right, 100],
  };
}

export function generateMentalMathProblems(seed: number): MentalMathProblem[] {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError('Mental-math seed must be a safe integer.');
  }
  const normalizedSeed = modulo(seed, 1_000_003);
  return Array.from(
    { length: MENTAL_MATH_PROBLEM_COUNT },
    (_, index) => buildProblem(normalizedSeed, index),
  );
}
