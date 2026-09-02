import type { BlueprintExamMode, BlueprintQuestionType } from "./blueprint-engine";

export { PUBLIC_SEED_VERSION } from "./seed-versions";

/**
 * The first authored slice of the question bank — a PUBLIC seed.
 *
 * These are original CSCA-style items written for this project. Nothing here is
 * copied from an examination paper and nothing is labelled official. Every item
 * is a `draft`: it may only enter the bank through `importQuestionBank`, which
 * stores it as `pending-review`, and it becomes coverage only after a named
 * human approves it through `setContentVerification`.
 *
 * `templateParameters` carries the numbers each item is built from, so
 * `draft-questions.test.ts` can recompute the answer independently instead of
 * trusting the authored key.
 *
 * PRIVACY: this file lives in a public Git repository, and it contains the
 * correct answer and the full solution for every item. Those answers are
 * therefore public, permanently — moving the file later would not unpublish
 * them. Anything imported from here is marked `publicAnswerKey` and is allowed
 * in practice and the local demo only. Confidential production mock content must
 * come from an administrator's private local file and live only in the protected
 * `questionSolutions` collection.
 */

export interface DraftOption {
  id: string;
  text: string;
}

export interface DraftQuestion {
  id: string;
  cellId: string;
  subject: 'mathematics' | 'physics';
  module: string;
  topicId: string;
  skill: string;
  questionType: BlueprintQuestionType;
  difficulty: number;
  language: 'en';
  question: string;
  /** Russian rendering of the prompt, which the schema provides for. */
  questionTranslation: string;
  options: DraftOption[];
  correctAnswer: string;
  solution: string;
  shortSolution: string;
  explanation: string;
  commonMistakes: { id: string; description: string; distractorOptionId?: string }[];
  formulas: string[];
  vocabulary: string[];
  estimatedTime: number;
  templateParameters: Record<string, string | number | boolean>;
  tags: string[];
}

const COMMON = {
  subject: 'mathematics' as const,
  language: 'en' as const,
  formulas: [] as string[],
  tags: ['authored-slice-1'],
};

/**
 * These items are checked into a public repository together with their answer
 * keys and worked solutions, so their answers are public. They are usable for
 * practice and for the local demo, and they must never back a confidential
 * production mock — see `PUBLIC_SEED_ALLOWED_MODES`.
 */
export const PUBLIC_SEED_ALLOWED_MODES: BlueprintExamMode[] = ["practice"];

export const DRAFT_QUESTION_SEED: DraftQuestion[] = [
  {
    ...COMMON,
    id: 'math-foundation-integer-operations-001',
    cellId: 'math-foundation-integer-operations',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'single-step-calculation',
    difficulty: 1,
    question: 'Evaluate −7 + 12 ÷ 4.',
    questionTranslation: 'Вычислите −7 + 12 ÷ 4.',
    options: [
      { id: 'a', text: '−4' },
      { id: 'b', text: '1.25' },
      { id: 'c', text: '−10' },
      { id: 'd', text: '5' },
    ],
    correctAnswer: 'a',
    solution:
      'Division comes before addition. 12 ÷ 4 = 3, so the expression is −7 + 3. Adding 3 to −7 moves three steps towards zero, giving −4.',
    shortSolution: '12 ÷ 4 = 3, then −7 + 3 = −4.',
    explanation:
      'The order of operations decides the answer here, not the arithmetic. Doing the addition first changes the question into a different one.',
    commonMistakes: [
      { id: 'add-first', description: 'Adding before dividing gives (−7 + 12) ÷ 4 = 1.25.', distractorOptionId: 'b' },
      { id: 'sign-slip', description: 'Subtracting the 3 instead of adding it gives −10.', distractorOptionId: 'c' },
      { id: 'ignore-division', description: 'Ignoring the division altogether gives −7 + 12 = 5.', distractorOptionId: 'd' },
    ],
    vocabulary: ['evaluate'],
    estimatedTime: 45,
    templateParameters: { check: 'a-plus-b-over-c', a: -7, b: 12, c: 4 },
  },
  {
    ...COMMON,
    id: 'math-foundation-integer-operations-002',
    cellId: 'math-foundation-integer-operations',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'multi-step-calculation',
    difficulty: 2,
    question: 'Evaluate −3 × (5 − 8) + 2².',
    questionTranslation: 'Вычислите −3 × (5 − 8) + 2².',
    options: [
      { id: 'a', text: '13' },
      { id: 'b', text: '5' },
      { id: 'c', text: '−5' },
      { id: 'd', text: '−13' },
    ],
    correctAnswer: 'a',
    solution:
      'Work inside the brackets first: 5 − 8 = −3. Then the power: 2² = 4. Now −3 × (−3) = 9, because a negative times a negative is positive. Finally 9 + 4 = 13.',
    shortSolution: '−3 × (−3) + 4 = 9 + 4 = 13.',
    explanation:
      'Two signs and one power in the same line. The bracket is evaluated first, and the product of two negatives is positive.',
    commonMistakes: [
      { id: 'sign-of-product', description: 'Treating −3 × (−3) as −9 gives −9 + 4 = −5.', distractorOptionId: 'c' },
      { id: 'power-as-product', description: 'Reading 2² as 2 × 2 × 2 = 8 with a sign slip gives 5.', distractorOptionId: 'b' },
      { id: 'both-slips', description: 'Making both the sign and the power slip gives −13.', distractorOptionId: 'd' },
    ],
    vocabulary: ['evaluate', 'bracket'],
    estimatedTime: 70,
    templateParameters: { check: 'k-times-diff-plus-square', k: -3, p: 5, q: 8, base: 2 },
  },
  {
    ...COMMON,
    id: 'math-foundation-integer-operations-003',
    cellId: 'math-foundation-integer-operations',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'single-step-calculation',
    difficulty: 2,
    question: 'Evaluate (−6)² ÷ (−4).',
    questionTranslation: 'Вычислите (−6)² ÷ (−4).',
    options: [
      { id: 'a', text: '−9' },
      { id: 'b', text: '9' },
      { id: 'c', text: '−3' },
      { id: 'd', text: '3' },
    ],
    correctAnswer: 'a',
    solution:
      'The bracket is squared, so (−6)² = 36, a positive number. Dividing a positive by a negative gives a negative result: 36 ÷ (−4) = −9.',
    shortSolution: '(−6)² = 36, and 36 ÷ (−4) = −9.',
    explanation:
      'Squaring removes the sign; dividing by a negative puts one back. Losing track of either step changes the sign of the answer.',
    commonMistakes: [
      { id: 'sign-of-quotient', description: 'Forgetting that the divisor is negative gives 9.', distractorOptionId: 'b' },
      { id: 'square-not-applied', description: 'Reading (−6)² as −6 × 2 = −12 gives −3.', distractorOptionId: 'c' },
      { id: 'both-slips', description: 'Making both slips gives 3.', distractorOptionId: 'd' },
    ],
    vocabulary: ['evaluate'],
    estimatedTime: 55,
    templateParameters: { check: 'square-over-divisor', base: -6, divisor: -4 },
  },
  {
    ...COMMON,
    id: 'math-foundation-fraction-decimal-percent-001',
    cellId: 'math-foundation-fraction-decimal-percent',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'single-step-calculation',
    difficulty: 1,
    question: 'Write 3/8 as a decimal.',
    questionTranslation: 'Запишите 3/8 в виде десятичной дроби.',
    options: [
      { id: 'a', text: '0.375' },
      { id: 'b', text: '0.38' },
      { id: 'c', text: '2.667' },
      { id: 'd', text: '0.0375' },
    ],
    correctAnswer: 'a',
    solution:
      'A fraction is a division: 3 ÷ 8. Eight goes into 30 three times with 6 left over, into 60 seven times with 4 left over, and into 40 five times exactly. The decimal terminates at 0.375.',
    shortSolution: '3 ÷ 8 = 0.375.',
    explanation:
      'The numerator is divided by the denominator, not the other way round, and the division here terminates rather than rounding.',
    commonMistakes: [
      { id: 'rounded-early', description: 'Rounding to two decimal places gives 0.38, which is not exact.', distractorOptionId: 'b' },
      { id: 'inverted', description: 'Dividing 8 by 3 instead gives about 2.667.', distractorOptionId: 'c' },
      { id: 'place-value', description: 'A place-value slip gives 0.0375.', distractorOptionId: 'd' },
    ],
    vocabulary: ['numerator', 'denominator'],
    estimatedTime: 45,
    templateParameters: { check: 'fraction-to-decimal', numerator: 3, denominator: 8 },
  },
  {
    ...COMMON,
    id: 'math-foundation-fraction-decimal-percent-002',
    cellId: 'math-foundation-fraction-decimal-percent',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'unit-conversion',
    difficulty: 2,
    question: 'Write 0.045 as a percentage.',
    questionTranslation: 'Запишите 0.045 в виде процентов.',
    options: [
      { id: 'a', text: '4.5%' },
      { id: 'b', text: '45%' },
      { id: 'c', text: '0.45%' },
      { id: 'd', text: '0.00045%' },
    ],
    correctAnswer: 'a',
    solution:
      'A percentage is a number of hundredths, so multiply by 100: 0.045 × 100 = 4.5. The answer is 4.5%.',
    shortSolution: '0.045 × 100 = 4.5%.',
    explanation:
      'Converting to a percentage moves the decimal point two places to the right. Moving it the wrong number of places is the whole error here.',
    commonMistakes: [
      { id: 'three-places', description: 'Moving the point three places gives 45%.', distractorOptionId: 'b' },
      { id: 'one-place', description: 'Moving the point one place gives 0.45%.', distractorOptionId: 'c' },
      { id: 'divided', description: 'Dividing by 100 instead of multiplying gives 0.00045%.', distractorOptionId: 'd' },
    ],
    vocabulary: ['percentage'],
    estimatedTime: 40,
    templateParameters: { check: 'decimal-to-percent', value: 0.045 },
  },
  {
    ...COMMON,
    id: 'math-foundation-fraction-decimal-percent-003',
    cellId: 'math-foundation-fraction-decimal-percent',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'unit-conversion',
    difficulty: 1,
    question: 'Write 12% as a fraction in its lowest terms.',
    questionTranslation: 'Запишите 12% в виде несократимой дроби.',
    options: [
      { id: 'a', text: '3/25' },
      { id: 'b', text: '6/50' },
      { id: 'c', text: '12/10' },
      { id: 'd', text: '1/12' },
    ],
    correctAnswer: 'a',
    solution:
      'Per cent means per hundred, so 12% = 12/100. The greatest common divisor of 12 and 100 is 4, and dividing both by 4 gives 3/25.',
    shortSolution: '12/100 = 3/25.',
    explanation:
      'Two steps: write the percentage over 100, then cancel fully. Stopping after one cancellation leaves the fraction reducible.',
    commonMistakes: [
      { id: 'partial-cancel', description: 'Cancelling only by 2 leaves 6/50, which is not in lowest terms.', distractorOptionId: 'b' },
      { id: 'wrong-denominator', description: 'Writing the percentage over 10 gives 12/10.', distractorOptionId: 'c' },
      { id: 'inverted', description: 'Inverting the fraction gives 1/12.', distractorOptionId: 'd' },
    ],
    vocabulary: ['percentage', 'lowest terms'],
    estimatedTime: 50,
    templateParameters: { check: 'percent-to-fraction', percent: 12 },
  },
  {
    ...COMMON,
    id: 'math-foundation-estimate-magnitude-001',
    cellId: 'math-foundation-estimate-magnitude',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'estimation',
    difficulty: 2,
    question:
      'Without computing exactly, which value is the best estimate of (4.87 × 10³) ÷ (2.03 × 10¹)?',
    questionTranslation:
      'Не вычисляя точно, какое значение лучше всего оценивает (4.87 × 10³) ÷ (2.03 × 10¹)?',
    options: [
      { id: 'a', text: '2.4 × 10²' },
      { id: 'b', text: '2.4 × 10³' },
      { id: 'c', text: '2.4 × 10¹' },
      { id: 'd', text: '9.9 × 10⁴' },
    ],
    correctAnswer: 'a',
    solution:
      'Round the mantissas: 4.87 ≈ 5 and 2.03 ≈ 2, so the leading figure is about 5 ÷ 2 = 2.5. Subtract the exponents: 10³ ÷ 10¹ = 10². The estimate is about 2.5 × 10², and 2.4 × 10² is the closest option.',
    shortSolution: 'About 5 ÷ 2 = 2.5 and 10³ ÷ 10¹ = 10², so roughly 2.4 × 10².',
    explanation:
      'An estimate is judged by its order of magnitude first. Getting the exponent wrong is a factor-of-ten error, which matters far more than the leading digit.',
    commonMistakes: [
      { id: 'kept-exponent', description: 'Keeping the exponent unchanged gives 2.4 × 10³.', distractorOptionId: 'b' },
      { id: 'subtracted-twice', description: 'Subtracting the exponents twice gives 2.4 × 10¹.', distractorOptionId: 'c' },
      { id: 'multiplied', description: 'Multiplying instead of dividing gives about 9.9 × 10⁴.', distractorOptionId: 'd' },
    ],
    vocabulary: ['estimate', 'order of magnitude'],
    estimatedTime: 60,
    templateParameters: { check: 'scientific-quotient', m1: 4.87, e1: 3, m2: 2.03, e2: 1 },
  },
  {
    ...COMMON,
    id: 'math-foundation-estimate-magnitude-002',
    cellId: 'math-foundation-estimate-magnitude',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'estimation',
    difficulty: 2,
    question: 'Without computing exactly, the product 19.6 × 51 is closest to which value?',
    questionTranslation: 'Не вычисляя точно, к какому значению ближе всего произведение 19.6 × 51?',
    options: [
      { id: 'a', text: '1000' },
      { id: 'b', text: '100' },
      { id: 'c', text: '10000' },
      { id: 'd', text: '250' },
    ],
    correctAnswer: 'a',
    solution:
      'Round each factor to one significant figure: 19.6 ≈ 20 and 51 ≈ 50. Then 20 × 50 = 1000, so the product is about one thousand.',
    shortSolution: '20 × 50 = 1000.',
    explanation:
      'Rounding both factors to one significant figure keeps the estimate quick and keeps the order of magnitude right.',
    commonMistakes: [
      { id: 'one-factor', description: 'Rounding only one factor and dropping a zero gives 100.', distractorOptionId: 'b' },
      { id: 'extra-zero', description: 'Carrying an extra zero gives 10000.', distractorOptionId: 'c' },
      { id: 'added', description: 'Adding rather than multiplying gives about 70, nearest to 250 among the options.', distractorOptionId: 'd' },
    ],
    vocabulary: ['estimate', 'significant figure'],
    estimatedTime: 45,
    templateParameters: { check: 'rounded-product', x: 19.6, y: 51 },
  },
  {
    ...COMMON,
    id: 'math-linear-isolate-unknown-001',
    cellId: 'math-linear-isolate-unknown',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'single-step-calculation',
    difficulty: 1,
    question: 'Solve x + 9 = 4.',
    questionTranslation: 'Решите уравнение x + 9 = 4.',
    options: [
      { id: 'a', text: 'x = −5' },
      { id: 'b', text: 'x = 13' },
      { id: 'c', text: 'x = 5' },
      { id: 'd', text: 'x = −13' },
    ],
    correctAnswer: 'a',
    solution: 'Subtract 9 from both sides: x = 4 − 9 = −5. Checking, −5 + 9 = 4.',
    shortSolution: 'x = 4 − 9 = −5.',
    explanation:
      'The inverse of adding 9 is subtracting 9, applied to both sides. The check at the end catches a sign slip immediately.',
    commonMistakes: [
      { id: 'added', description: 'Adding 9 instead of subtracting gives 13.', distractorOptionId: 'b' },
      { id: 'sign', description: 'Subtracting in the wrong order gives 5.', distractorOptionId: 'c' },
      { id: 'both', description: 'Making both slips gives −13.', distractorOptionId: 'd' },
    ],
    vocabulary: ['solve'],
    estimatedTime: 40,
    templateParameters: { check: 'x-plus-b-equals-c', b: 9, c: 4 },
  },
  {
    ...COMMON,
    id: 'math-linear-isolate-unknown-002',
    cellId: 'math-linear-isolate-unknown',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'single-step-calculation',
    difficulty: 1,
    question: 'Solve 6x = −42.',
    questionTranslation: 'Решите уравнение 6x = −42.',
    options: [
      { id: 'a', text: 'x = −7' },
      { id: 'b', text: 'x = 7' },
      { id: 'c', text: 'x = −36' },
      { id: 'd', text: 'x = −48' },
    ],
    correctAnswer: 'a',
    solution:
      'Divide both sides by 6: x = −42 ÷ 6 = −7. A negative divided by a positive is negative. Checking, 6 × (−7) = −42.',
    shortSolution: 'x = −42 ÷ 6 = −7.',
    explanation:
      'The unknown is multiplied by 6, so dividing by 6 undoes it. The sign follows from dividing a negative by a positive.',
    commonMistakes: [
      { id: 'sign', description: 'Dropping the sign gives 7.', distractorOptionId: 'b' },
      { id: 'subtracted', description: 'Subtracting 6 instead of dividing gives −48.', distractorOptionId: 'd' },
      { id: 'added', description: 'Adding 6 instead of dividing gives −36.', distractorOptionId: 'c' },
    ],
    vocabulary: ['solve'],
    estimatedTime: 40,
    templateParameters: { check: 'ax-equals-c', a: 6, c: -42 },
  },
  {
    ...COMMON,
    id: 'math-linear-isolate-unknown-003',
    cellId: 'math-linear-isolate-unknown',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'single-step-calculation',
    difficulty: 2,
    question: 'Solve x ÷ 5 = −3.',
    questionTranslation: 'Решите уравнение x ÷ 5 = −3.',
    options: [
      { id: 'a', text: 'x = −15' },
      { id: 'b', text: 'x = −0.6' },
      { id: 'c', text: 'x = 15' },
      { id: 'd', text: 'x = −8' },
    ],
    correctAnswer: 'a',
    solution:
      'The unknown is divided by 5, so multiply both sides by 5: x = −3 × 5 = −15. Checking, −15 ÷ 5 = −3.',
    shortSolution: 'x = −3 × 5 = −15.',
    explanation:
      'Dividing is undone by multiplying. Dividing again is the most common slip and gives a number smaller than the right-hand side rather than larger.',
    commonMistakes: [
      { id: 'divided-again', description: 'Dividing by 5 again gives −0.6.', distractorOptionId: 'b' },
      { id: 'sign', description: 'Dropping the sign gives 15.', distractorOptionId: 'c' },
      { id: 'subtracted', description: 'Subtracting 5 instead of multiplying gives −8.', distractorOptionId: 'd' },
    ],
    vocabulary: ['solve'],
    estimatedTime: 45,
    templateParameters: { check: 'x-over-a-equals-c', a: 5, c: -3 },
  },
  {
    ...COMMON,
    id: 'math-linear-multi-step-linear-001',
    cellId: 'math-linear-multi-step-linear',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'multi-step-calculation',
    difficulty: 2,
    question: 'Solve 4x − 7 = 2x + 5.',
    questionTranslation: 'Решите уравнение 4x − 7 = 2x + 5.',
    options: [
      { id: 'a', text: 'x = 6' },
      { id: 'b', text: 'x = 1' },
      { id: 'c', text: 'x = −6' },
      { id: 'd', text: 'x = 2' },
    ],
    correctAnswer: 'a',
    solution:
      'Collect the unknowns on one side: 4x − 2x = 5 + 7, so 2x = 12 and x = 6. Checking, 4(6) − 7 = 17 and 2(6) + 5 = 17.',
    shortSolution: '2x = 12, so x = 6.',
    explanation:
      'Both sides carry a term in x, so the first move is to gather them. Every term that crosses the equals sign changes its sign.',
    commonMistakes: [
      { id: 'sign-on-move', description: 'Moving the 7 without changing its sign gives 2x = −2 and x = −1, nearest to 1 here.', distractorOptionId: 'b' },
      { id: 'sign-of-x', description: 'Collecting on the wrong side gives −6.', distractorOptionId: 'c' },
      { id: 'divide-slip', description: 'Dividing 12 by 6 rather than by 2 gives 2.', distractorOptionId: 'd' },
    ],
    vocabulary: ['solve', 'collect like terms'],
    estimatedTime: 70,
    templateParameters: { check: 'ax-plus-b-equals-cx-plus-d', a: 4, b: -7, c: 2, d: 5 },
  },
  {
    ...COMMON,
    id: 'math-linear-multi-step-linear-002',
    cellId: 'math-linear-multi-step-linear',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'multi-step-calculation',
    difficulty: 3,
    question: 'Solve 3(x − 2) = 5x + 4.',
    questionTranslation: 'Решите уравнение 3(x − 2) = 5x + 4.',
    options: [
      { id: 'a', text: 'x = −5' },
      { id: 'b', text: 'x = 5' },
      { id: 'c', text: 'x = −1' },
      { id: 'd', text: 'x = 1' },
    ],
    correctAnswer: 'a',
    solution:
      'Expand the bracket first: 3x − 6 = 5x + 4. Collecting gives −6 − 4 = 5x − 3x, so −10 = 2x and x = −5. Checking, 3(−5 − 2) = −21 and 5(−5) + 4 = −21.',
    shortSolution: '3x − 6 = 5x + 4, so 2x = −10 and x = −5.',
    explanation:
      'The bracket multiplies both terms inside it, including the −2. Expanding only the first term is the usual failure, and the check exposes it at once.',
    commonMistakes: [
      { id: 'partial-expand', description: 'Expanding as 3x − 2 gives x = −3, nearest to −1 here.', distractorOptionId: 'c' },
      { id: 'sign', description: 'Losing the sign at the last division gives 5.', distractorOptionId: 'b' },
      { id: 'collect-wrong-side', description: 'Collecting on the wrong side gives 1.', distractorOptionId: 'd' },
    ],
    vocabulary: ['expand', 'solve'],
    estimatedTime: 90,
    templateParameters: { check: 'k-times-x-minus-p-equals-cx-plus-d', k: 3, p: 2, c: 5, d: 4 },
  },
  {
    ...COMMON,
    id: 'math-linear-multi-step-linear-003',
    cellId: 'math-linear-multi-step-linear',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'multi-step-calculation',
    difficulty: 3,
    question: 'Solve (2x + 1)/3 − (x − 4)/2 = 1.',
    questionTranslation: 'Решите уравнение (2x + 1)/3 − (x − 4)/2 = 1.',
    options: [
      { id: 'a', text: 'x = −8' },
      { id: 'b', text: 'x = 8' },
      { id: 'c', text: 'x = −2' },
      { id: 'd', text: 'x = 2' },
    ],
    correctAnswer: 'a',
    solution:
      'Multiply every term by 6, the lowest common denominator: 2(2x + 1) − 3(x − 4) = 6. Expanding gives 4x + 2 − 3x + 12 = 6, so x + 14 = 6 and x = −8. Checking, (2(−8) + 1)/3 = −5 and (−8 − 4)/2 = −6, and −5 − (−6) = 1.',
    shortSolution: 'Multiply by 6: 4x + 2 − 3x + 12 = 6, so x = −8.',
    explanation:
      'Clearing the denominators removes the fractions in one move. The subtracted bracket must be multiplied by −3 in full, which flips the sign of the −4.',
    commonMistakes: [
      { id: 'sign-of-bracket', description: 'Treating −3(x − 4) as −3x − 12 gives x = 16, nearest to 8 here.', distractorOptionId: 'b' },
      { id: 'partial-multiply', description: 'Multiplying only one fraction by 6 gives −2.', distractorOptionId: 'c' },
      { id: 'sign-at-end', description: 'Losing the sign at the last step gives 2.', distractorOptionId: 'd' },
    ],
    vocabulary: ['lowest common denominator', 'expand'],
    estimatedTime: 120,
    templateParameters: { check: 'two-fractions-equals-one', a: 2, b: 1, den1: 3, c: 1, d: -4, den2: 2, rhs: 1 },
  },
  {
    ...COMMON,
    id: 'math-linear-linear-word-problem-001',
    cellId: 'math-linear-linear-word-problem',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'word-problem',
    difficulty: 3,
    question:
      'A taxi charges a fixed 500 tenge plus 120 tenge for each kilometre travelled. A journey costs 2300 tenge. How many kilometres was the journey?',
    questionTranslation:
      'Такси берёт фиксированные 500 тенге плюс 120 тенге за каждый пройденный километр. Поездка стоила 2300 тенге. Сколько километров составила поездка?',
    options: [
      { id: 'a', text: '15 km' },
      { id: 'b', text: '19 km' },
      { id: 'c', text: '12 km' },
      { id: 'd', text: '23 km' },
    ],
    correctAnswer: 'a',
    solution:
      'Let d be the distance in kilometres. The cost is 500 + 120d = 2300. Subtracting the fixed charge gives 120d = 1800, and dividing by 120 gives d = 15 km. Checking, 500 + 120 × 15 = 2300.',
    shortSolution: '120d = 2300 − 500 = 1800, so d = 15 km.',
    explanation:
      'The fixed charge is paid once and must be removed before dividing. Dividing the whole fare by the rate counts the fixed charge as distance.',
    commonMistakes: [
      { id: 'kept-fixed', description: 'Dividing the whole 2300 by 120 gives about 19 km.', distractorOptionId: 'b' },
      { id: 'subtracted-twice', description: 'Subtracting the fixed charge twice gives about 12 km.', distractorOptionId: 'c' },
      { id: 'ignored-rate', description: 'Reading the fare in hundreds gives 23 km.', distractorOptionId: 'd' },
    ],
    vocabulary: ['fixed charge', 'per'],
    estimatedTime: 110,
    templateParameters: { check: 'fixed-plus-rate', fixed: 500, rate: 120, total: 2300 },
  },
  {
    ...COMMON,
    id: 'math-linear-linear-word-problem-002',
    cellId: 'math-linear-linear-word-problem',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'word-problem',
    difficulty: 3,
    question:
      'An empty crate has a mass of 3 kg. Filled with n identical tins of mass 0.4 kg each, the crate has a mass of 9.4 kg. Find n.',
    questionTranslation:
      'Пустой ящик имеет массу 3 кг. С n одинаковыми банками массой 0.4 кг каждая масса ящика равна 9.4 кг. Найдите n.',
    options: [
      { id: 'a', text: '16' },
      { id: 'b', text: '24' },
      { id: 'c', text: '13' },
      { id: 'd', text: '31' },
    ],
    correctAnswer: 'a',
    solution:
      'The tins account for 9.4 − 3 = 6.4 kg. Each tin is 0.4 kg, so n = 6.4 ÷ 0.4 = 16. Checking, 3 + 16 × 0.4 = 9.4 kg.',
    shortSolution: 'n = (9.4 − 3) ÷ 0.4 = 16.',
    explanation:
      'The mass of the crate itself is not part of the tins. Because the tin mass is less than one, dividing by it increases the number, which is worth expecting before computing.',
    commonMistakes: [
      { id: 'kept-crate', description: 'Dividing the full 9.4 kg by 0.4 gives 23.5, rounded here to 24.', distractorOptionId: 'b' },
      { id: 'multiplied', description: 'Multiplying by 0.4 rather than dividing gives about 2.6, and adding the crate gives 13 by a further slip.', distractorOptionId: 'c' },
      { id: 'decimal-slip', description: 'Treating 0.4 as 0.2 gives 32, shown here as 31.', distractorOptionId: 'd' },
    ],
    vocabulary: ['mass', 'identical'],
    estimatedTime: 110,
    templateParameters: { check: 'fixed-plus-rate', fixed: 3, rate: 0.4, total: 9.4 },
  },
  {
    ...COMMON,
    id: 'math-linear-linear-word-problem-003',
    cellId: 'math-linear-linear-word-problem',
    module: 'Algebra',
    topicId: 'math-linear',
    skill: 'Solve linear relations',
    questionType: 'word-problem',
    difficulty: 3,
    question:
      'A student’s mean score over 4 tests is 68. After a fifth test the mean over all 5 tests is 70. What did the student score on the fifth test?',
    questionTranslation:
      'Средний балл ученика за 4 теста равен 68. После пятого теста средний балл за все 5 тестов стал 70. Сколько баллов ученик набрал за пятый тест?',
    options: [
      { id: 'a', text: '78' },
      { id: 'b', text: '72' },
      { id: 'c', text: '70' },
      { id: 'd', text: '80' },
    ],
    correctAnswer: 'a',
    solution:
      'The first four tests total 4 × 68 = 272. All five total 5 × 70 = 350. The fifth score is 350 − 272 = 78. Checking, (272 + 78) ÷ 5 = 70.',
    shortSolution: '5 × 70 − 4 × 68 = 350 − 272 = 78.',
    explanation:
      'A mean question becomes a linear one as soon as it is written as a total. The fifth score must exceed the new mean, because it pulled the mean upwards.',
    commonMistakes: [
      { id: 'mean-difference', description: 'Adding the difference in means to the old mean gives 70.', distractorOptionId: 'c' },
      { id: 'wrong-count', description: 'Using 4 tests in both totals gives 72.', distractorOptionId: 'b' },
      { id: 'rounded', description: 'Rounding the totals to the nearest ten gives 80.', distractorOptionId: 'd' },
    ],
    vocabulary: ['mean'],
    estimatedTime: 120,
    templateParameters: { check: 'mean-shift', n1: 4, mean1: 68, n2: 5, mean2: 70 },
  },
];

/** Cells this authored slice targets, in the order a reviewer should work through them. */
export const AUTHORED_SLICE_CELL_IDS = [
  'math-foundation-integer-operations',
  'math-foundation-fraction-decimal-percent',
  'math-foundation-estimate-magnitude',
  'math-linear-isolate-unknown',
  'math-linear-multi-step-linear',
  'math-linear-linear-word-problem',
] as const;
