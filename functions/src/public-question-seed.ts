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

const PHYSICS_COMMON = {
  subject: 'physics' as const,
  language: 'en' as const,
  formulas: ['Q = mc\u0394T'],
  tags: ['authored-slice-2'],
};

/**
 * The units items list no formula of their own. The slice does have a relation
 * — a quantity is its digits times the power of ten its prefix stands for — but
 * it is not a formula a learner substitutes into per item, and repeating it on
 * every card would suggest the arithmetic is the difficulty here. It is not:
 * choosing the right power of ten is.
 */
const UNITS_COMMON = {
  subject: 'physics' as const,
  language: 'en' as const,
  formulas: [] as string[],
  tags: ['authored-slice-3'],
};

/**
 * The base-and-derived-units items. Their answers are unit names and unit
 * expressions rather than values, so `draft-questions.test.ts` recomputes each
 * one from the SI definitions it holds itself and compares the text exactly.
 */
const SI_COMMON = {
  subject: 'physics' as const,
  language: 'en' as const,
  formulas: [] as string[],
  tags: ['authored-slice-4'],
};

/**
 * Constant-speed kinematics. Every item names s = vt, because the difficulty in
 * this cell is not the relation but keeping the units of the three quantities
 * consistent before substituting into it.
 */
const KINEMATICS_COMMON = {
  subject: 'physics' as const,
  language: 'en' as const,
  formulas: ['s = vt'],
  tags: ['authored-slice-5'],
};

/**
 * Displacement against distance. No relation is listed: the whole cell is about
 * which quantity a situation is asking for, and attaching a formula would
 * suggest there is something to substitute into.
 */
const VECTOR_COMMON = {
  subject: 'physics' as const,
  language: 'en' as const,
  formulas: [] as string[],
  tags: ['authored-slice-6'],
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
    id: 'math-foundation-estimate-magnitude-003',
    cellId: 'math-foundation-estimate-magnitude',
    module: 'Number and foundations',
    topicId: 'math-foundation',
    skill: 'Compute reliably without a calculator',
    questionType: 'estimation',
    difficulty: 2,
    question: 'Without computing exactly, (7.9 × 10⁴) ÷ (1.9 × 10²) is closest to which value?',
    questionTranslation: 'Не вычисляя точно, к какому значению ближе всего (7.9 × 10⁴) ÷ (1.9 × 10²)?',
    options: [
      { id: 'a', text: '4.2 × 10²' },
      { id: 'b', text: '4.2 × 10¹' },
      { id: 'c', text: '4.2 × 10³' },
      { id: 'd', text: '1.5 × 10²' },
    ],
    correctAnswer: 'a',
    solution:
      'Handle the digits and the power of ten separately. The digits give about 8 ÷ 2 = 4, and dividing powers of ten subtracts the exponents: 10⁴ ÷ 10² = 10². So the quotient is a little above 4 × 10², and 4.2 × 10² is the nearest option.',
    shortSolution: 'About 8 ÷ 2 = 4 and 10⁴ ÷ 10² = 10², so roughly 4.2 × 10².',
    explanation:
      'The exponent decides which option is possible before any digits are divided, so settling it first eliminates every distractor built from an exponent slip.',
    commonMistakes: [
      { id: 'exponent-not-subtracted', description: 'Keeping the exponent of the numerator alone gives 4.2 × 10⁴, and dropping a further power gives 4.2 × 10³.', distractorOptionId: 'c' },
      { id: 'exponent-over-subtracted', description: 'Subtracting one power too many gives 4.2 × 10¹.', distractorOptionId: 'b' },
      { id: 'digits-subtracted', description: 'Subtracting the digits rather than dividing them gives about 6, and a further exponent slip lands near 1.5 × 10².', distractorOptionId: 'd' },
    ],
    vocabulary: ['estimate', 'order of magnitude'],
    estimatedTime: 50,
    templateParameters: { check: 'scientific-quotient', m1: 7.9, e1: 4, m2: 1.9, e2: 2 },
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
  //
  // Physics vertical slice for phys-thermodynamics-heat-transfer, authored
  // 2026-09-03. The cell requires difficulties 2 and 3 and both
  // single-step-calculation and multi-step-calculation, so the four items below
  // cover each combination. Every distractor is a named arithmetic or reading
  // mistake rather than a filler number, and every answer is recomputed
  // independently in src/data/draft-questions.test.ts from templateParameters.
  //
  // Like everything else in this file, the answer keys are public. These are
  // practice items and can never back a confidential mock.
  //
  {
    ...PHYSICS_COMMON,
    id: 'phys-thermodynamics-heat-transfer-001',
    cellId: 'phys-thermodynamics-heat-transfer',
    module: 'Thermal physics',
    topicId: 'phys-thermodynamics',
    skill: 'Apply thermal relations',
    questionType: 'single-step-calculation',
    difficulty: 2,
    question:
      'A beaker holds 0.50 kg of water. The specific heat capacity of water is 4200 J/(kg·K). How much energy raises its temperature by 20 K?',
    questionTranslation:
      'В стакане 0,50 кг воды. Удельная теплоёмкость воды 4200 Дж/(кг·К). Сколько энергии нужно, чтобы поднять её температуру на 20 К?',
    options: [
      { id: 'a', text: '42 kJ' },
      { id: 'b', text: '84 kJ' },
      { id: 'c', text: '2.1 kJ' },
      { id: 'd', text: '4.2 kJ' },
    ],
    correctAnswer: 'a',
    solution:
      'Use Q = mcΔT. Q = 0.50 × 4200 × 20 = 42000 J, which is 42 kJ. Checking the size: half a kilogram of water needs about 2 kJ for each kelvin, so 20 K needs about 42 kJ.',
    shortSolution: 'Q = 0.50 × 4200 × 20 = 42 kJ.',
    explanation:
      'Each of the three quantities multiplies. The most common slip is dropping one of them, so name m, c and ΔT before multiplying anything.',
    commonMistakes: [
      { id: 'mass-dropped', description: 'Using 1 kg instead of 0.50 kg gives 84 kJ.', distractorOptionId: 'b' },
      { id: 'delta-dropped', description: 'Leaving out ΔT gives 2.1 kJ.', distractorOptionId: 'c' },
      { id: 'power-of-ten', description: 'A factor-of-ten slip gives 4.2 kJ.', distractorOptionId: 'd' },
    ],
    vocabulary: ['specific-heat-capacity', 'temperature-change'],
    estimatedTime: 60,
    templateParameters: { check: 'heat-in-kilojoules', m: 0.5, c: 4200, dT: 20 },
  },
  {
    ...PHYSICS_COMMON,
    id: 'phys-thermodynamics-heat-transfer-002',
    cellId: 'phys-thermodynamics-heat-transfer',
    module: 'Thermal physics',
    topicId: 'phys-thermodynamics',
    skill: 'Apply thermal relations',
    questionType: 'single-step-calculation',
    difficulty: 3,
    question:
      'Adding 9200 J of energy to a 0.40 kg metal block raises its temperature by 50 K. What is the specific heat capacity of the metal?',
    questionTranslation:
      'Передача 9200 Дж энергии металлическому бруску массой 0,40 кг повышает его температуру на 50 К. Чему равна удельная теплоёмкость металла?',
    options: [
      { id: 'a', text: '460 J/(kg·K)' },
      { id: 'b', text: '230 J/(kg·K)' },
      { id: 'c', text: '184 J/(kg·K)' },
      { id: 'd', text: '0.46 J/(kg·K)' },
    ],
    correctAnswer: 'a',
    solution:
      'Rearrange Q = mcΔT to c = Q ÷ (mΔT). c = 9200 ÷ (0.40 × 50) = 9200 ÷ 20 = 460 J/(kg·K).',
    shortSolution: 'c = 9200 ÷ (0.40 × 50) = 460 J/(kg·K).',
    explanation:
      'Rearranging first, then substituting, keeps the units visible: joules divided by kilogram-kelvin is exactly J/(kg·K).',
    commonMistakes: [
      { id: 'doubled-delta', description: 'Reading 50 K as a final temperature and using 100 gives 230.', distractorOptionId: 'b' },
      { id: 'mass-dropped', description: 'Dividing by ΔT alone gives 184.', distractorOptionId: 'c' },
      { id: 'grams', description: 'Using 400 g as the number instead of 0.40 kg gives 0.46.', distractorOptionId: 'd' },
    ],
    vocabulary: ['specific-heat-capacity', 'rearrange'],
    estimatedTime: 75,
    templateParameters: { check: 'specific-heat-capacity', q: 9200, m: 0.4, dT: 50 },
  },
  {
    ...PHYSICS_COMMON,
    id: 'phys-thermodynamics-heat-transfer-003',
    cellId: 'phys-thermodynamics-heat-transfer',
    module: 'Thermal physics',
    topicId: 'phys-thermodynamics',
    skill: 'Apply thermal relations',
    questionType: 'multi-step-calculation',
    difficulty: 2,
    question:
      'Water of mass 0.20 kg is heated from 20 °C to 100 °C. The specific heat capacity of water is 4200 J/(kg·K). How much energy is needed?',
    questionTranslation:
      'Воду массой 0,20 кг нагревают от 20 °C до 100 °C. Удельная теплоёмкость воды 4200 Дж/(кг·К). Сколько энергии для этого нужно?',
    options: [
      { id: 'a', text: '67.2 kJ' },
      { id: 'b', text: '84 kJ' },
      { id: 'c', text: '16.8 kJ' },
      { id: 'd', text: '336 kJ' },
    ],
    correctAnswer: 'a',
    solution:
      'First find the temperature change: ΔT = 100 − 20 = 80 K. Then Q = mcΔT = 0.20 × 4200 × 80 = 67200 J, which is 67.2 kJ. A change in celsius degrees is the same number of kelvin, so no conversion is needed.',
    shortSolution: 'ΔT = 80 K, so Q = 0.20 × 4200 × 80 = 67.2 kJ.',
    explanation:
      'The extra step is the subtraction. ΔT is a difference, not the final reading, and a change of 1 °C is a change of 1 K.',
    commonMistakes: [
      { id: 'final-temperature', description: 'Using the final 100 °C as ΔT gives 84 kJ.', distractorOptionId: 'b' },
      { id: 'initial-temperature', description: 'Using the initial 20 °C as ΔT gives 16.8 kJ.', distractorOptionId: 'c' },
      { id: 'mass-dropped', description: 'Using 1 kg instead of 0.20 kg gives 336 kJ.', distractorOptionId: 'd' },
    ],
    vocabulary: ['specific-heat-capacity', 'temperature-change'],
    estimatedTime: 90,
    templateParameters: { check: 'heat-in-kilojoules-from-temperatures', m: 0.2, c: 4200, tStart: 20, tEnd: 100 },
  },
  {
    ...PHYSICS_COMMON,
    id: 'phys-thermodynamics-heat-transfer-004',
    cellId: 'phys-thermodynamics-heat-transfer',
    module: 'Thermal physics',
    topicId: 'phys-thermodynamics',
    skill: 'Apply thermal relations',
    questionType: 'multi-step-calculation',
    difficulty: 3,
    question:
      'An aluminium block of mass 0.15 kg cools from 120 °C to 30 °C. The specific heat capacity of aluminium is 900 J/(kg·K). How much energy does the block release?',
    questionTranslation:
      'Алюминиевый брусок массой 0,15 кг остывает от 120 °C до 30 °C. Удельная теплоёмкость алюминия 900 Дж/(кг·К). Сколько энергии отдаёт брусок?',
    options: [
      { id: 'a', text: '12.15 kJ' },
      { id: 'b', text: '16.2 kJ' },
      { id: 'c', text: '4.05 kJ' },
      { id: 'd', text: '81 kJ' },
    ],
    correctAnswer: 'a',
    solution:
      'The magnitude of the temperature change is ΔT = 120 − 30 = 90 K. Q = mcΔT = 0.15 × 900 × 90 = 12150 J, which is 12.15 kJ. The block cools, so this energy leaves it; the question asks how much is released, so the magnitude is the answer.',
    shortSolution: 'ΔT = 90 K, so Q = 0.15 × 900 × 90 = 12.15 kJ.',
    explanation:
      'Cooling uses the same relation as heating. Only the direction of the energy changes, and the question asks for the amount released rather than a signed value.',
    commonMistakes: [
      { id: 'start-temperature', description: 'Using the starting 120 °C as ΔT gives 16.2 kJ.', distractorOptionId: 'b' },
      { id: 'end-temperature', description: 'Using the final 30 °C as ΔT gives 4.05 kJ.', distractorOptionId: 'c' },
      { id: 'mass-dropped', description: 'Using 1 kg instead of 0.15 kg gives 81 kJ.', distractorOptionId: 'd' },
    ],
    vocabulary: ['specific-heat-capacity', 'released'],
    estimatedTime: 90,
    templateParameters: { check: 'heat-in-kilojoules-from-temperatures', m: 0.15, c: 900, tStart: 120, tEnd: 30 },
  },
  {
    ...UNITS_COMMON,
    id: 'phys-units-unit-conversion-si-001',
    cellId: 'phys-units-unit-conversion-si',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    skill: 'Use SI units consistently',
    questionType: 'unit-conversion',
    difficulty: 2,
    question: 'A capacitor is labelled 4.7 μF. Express this capacitance in farads.',
    questionTranslation: 'На конденсаторе указано 4.7 мкФ. Выразите эту ёмкость в фарадах.',
    options: [
      { id: 'a', text: '4.7 × 10⁻⁶ F' },
      { id: 'b', text: '4.7 × 10⁻³ F' },
      { id: 'c', text: '4.7 × 10⁻⁹ F' },
      { id: 'd', text: '4.7 × 10⁶ F' },
    ],
    correctAnswer: 'a',
    solution:
      'The prefix micro means a factor of 10⁻⁶, so 4.7 μF is 4.7 × 10⁻⁶ F. The digits are untouched by the conversion: only the power of ten changes.',
    shortSolution: 'μ means 10⁻⁶, so 4.7 μF = 4.7 × 10⁻⁶ F.',
    explanation:
      'A prefix is a multiplier attached to the unit, not to the number, so converting to the base unit moves the power of ten and leaves the digits alone.',
    commonMistakes: [
      { id: 'micro-as-milli', description: 'Reading μ as milli gives 4.7 × 10⁻³ F.', distractorOptionId: 'b' },
      { id: 'micro-as-nano', description: 'Reading μ as nano gives 4.7 × 10⁻⁹ F.', distractorOptionId: 'c' },
      { id: 'sign-of-exponent', description: 'Multiplying by the prefix instead of applying it gives 4.7 × 10⁶ F.', distractorOptionId: 'd' },
    ],
    vocabulary: ['prefix', 'base unit'],
    estimatedTime: 45,
    templateParameters: { check: 'si-prefix-scale', value: 4.7, exponent: -6 },
  },
  {
    ...UNITS_COMMON,
    id: 'phys-units-unit-conversion-si-002',
    cellId: 'phys-units-unit-conversion-si',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    skill: 'Use SI units consistently',
    questionType: 'unit-conversion',
    difficulty: 2,
    question: 'A car travels at a steady 72 km/h. Express this speed in SI base units.',
    questionTranslation: 'Автомобиль движется с постоянной скоростью 72 км/ч. Выразите эту скорость в основных единицах СИ.',
    options: [
      { id: 'a', text: '20 m/s' },
      { id: 'b', text: '1.2 m/s' },
      { id: 'c', text: '0.02 m/s' },
      { id: 'd', text: '259 m/s' },
    ],
    correctAnswer: 'a',
    solution:
      'One kilometre is 10³ metres and one hour is 3600 seconds, so a speed in km/h is divided by 3.6 to reach m/s: 72 ÷ 3.6 = 20 m/s.',
    shortSolution: '72 ÷ 3.6 = 20 m/s.',
    explanation:
      'Both parts of the unit change, so both factors apply: dividing by only one of them leaves an answer that is out by 60 or by 1000.',
    commonMistakes: [
      { id: 'minutes-only', description: 'Dividing by 60 alone gives 1.2 m/s.', distractorOptionId: 'b' },
      { id: 'seconds-only', description: 'Dividing by 3600 alone gives 0.02 m/s.', distractorOptionId: 'c' },
      { id: 'wrong-direction', description: 'Multiplying by 3.6 rather than dividing gives about 259 m/s.', distractorOptionId: 'd' },
    ],
    vocabulary: ['base unit', 'derived unit'],
    estimatedTime: 50,
    templateParameters: { check: 'kmh-to-ms', kmh: 72 },
  },
  {
    ...UNITS_COMMON,
    id: 'phys-units-unit-conversion-si-003',
    cellId: 'phys-units-unit-conversion-si',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    skill: 'Use SI units consistently',
    questionType: 'single-step-calculation',
    difficulty: 2,
    question: 'A charge of 3.6 mC passes a point in 0.20 s. What is the current, in milliamperes?',
    questionTranslation: 'Заряд 3.6 мКл проходит через точку за 0.20 с. Чему равен ток в миллиамперах?',
    options: [
      { id: 'a', text: '18 mA' },
      { id: 'b', text: '1.8 mA' },
      { id: 'c', text: '0.72 mA' },
      { id: 'd', text: '180 mA' },
    ],
    correctAnswer: 'a',
    solution:
      'Current is charge divided by time. Both the charge and the answer are in milli-units, so the prefixes cancel and the arithmetic is done on the numbers as given: 3.6 ÷ 0.20 = 18 mA.',
    shortSolution: '3.6 ÷ 0.20 = 18 mA.',
    explanation:
      'Converting to coulombs and amperes first gives the same answer but adds two chances to lose a power of ten. Matching prefixes on both sides is the shorter and safer route.',
    commonMistakes: [
      { id: 'decimal-slip', description: 'Dividing by 2 rather than by 0.20 gives 1.8 mA.', distractorOptionId: 'b' },
      { id: 'multiplied', description: 'Multiplying rather than dividing gives 0.72 mA.', distractorOptionId: 'c' },
      { id: 'stray-power', description: 'Carrying an extra power of ten from a half-finished conversion gives 180 mA.', distractorOptionId: 'd' },
    ],
    vocabulary: ['prefix', 'current'],
    estimatedTime: 55,
    templateParameters: { check: 'current-in-milliamps', chargeMilliCoulomb: 3.6, seconds: 0.2 },
  },
  {
    ...UNITS_COMMON,
    id: 'phys-units-unit-conversion-si-004',
    cellId: 'phys-units-unit-conversion-si',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    skill: 'Use SI units consistently',
    questionType: 'single-step-calculation',
    difficulty: 2,
    question: 'A pulse travels 0.60 m along a cable in 2.5 ms. What is its average speed?',
    questionTranslation: 'Импульс проходит 0.60 м по кабелю за 2.5 мс. Чему равна его средняя скорость?',
    options: [
      { id: 'a', text: '240 m/s' },
      { id: 'b', text: '0.24 m/s' },
      { id: 'c', text: '2400 m/s' },
      { id: 'd', text: '4.2 m/s' },
    ],
    correctAnswer: 'a',
    solution:
      'The time must be in seconds before dividing: 2.5 ms is 2.5 × 10⁻³ s. Then 0.60 ÷ (2.5 × 10⁻³) = 240 m/s.',
    shortSolution: '0.60 ÷ 2.5 × 10⁻³ s = 240 m/s.',
    explanation:
      'The unit of the answer is fixed by the units that went into it, so a time left in milliseconds gives a speed in metres per millisecond — a number that is out by a thousand and carries a label nobody wrote down.',
    commonMistakes: [
      { id: 'time-not-converted', description: 'Dividing by 2.5 as though it were seconds gives 0.24 m/s.', distractorOptionId: 'b' },
      { id: 'extra-power', description: 'Applying the milli twice gives 2400 m/s.', distractorOptionId: 'c' },
      { id: 'inverted', description: 'Dividing the time by the distance gives about 4.2, the reciprocal in the wrong unit.', distractorOptionId: 'd' },
    ],
    vocabulary: ['prefix', 'derived unit'],
    estimatedTime: 55,
    templateParameters: { check: 'speed-from-milliseconds', metres: 0.6, milliseconds: 2.5 },
  },
  {
    ...SI_COMMON,
    id: 'phys-units-si-base-derived-001',
    cellId: 'phys-units-si-base-derived',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    skill: 'Use SI units consistently',
    questionType: 'concept-recognition',
    difficulty: 1,
    question: 'Which SI base unit is used for the quantity electric current?',
    questionTranslation: 'Какая основная единица СИ используется для величины «сила тока»?',
    options: [
      { id: 'a', text: 'ampere' },
      { id: 'b', text: 'coulomb' },
      { id: 'c', text: 'volt' },
      { id: 'd', text: 'ohm' },
    ],
    correctAnswer: 'a',
    solution:
      'Electric current is one of the seven SI base quantities, and its base unit is the ampere. The coulomb, the volt and the ohm are all derived units, each defined in terms of the ampere and other base units.',
    shortSolution: 'Electric current is a base quantity; its base unit is the ampere.',
    explanation:
      'Charge is often met before current, which makes the coulomb feel more fundamental than it is. The SI takes current as the base quantity and defines the coulomb from it, not the other way round.',
    commonMistakes: [
      { id: 'charge-as-base', description: 'Treating charge as the base quantity gives the coulomb.', distractorOptionId: 'b' },
      { id: 'confuses-quantity', description: 'Reading the question as asking about potential difference gives the volt.', distractorOptionId: 'c' },
      { id: 'circuit-association', description: 'Choosing another familiar electrical unit gives the ohm.', distractorOptionId: 'd' },
    ],
    vocabulary: ['base unit', 'derived unit'],
    estimatedTime: 35,
    templateParameters: { check: 'si-base-unit-for', quantity: 'electric current' },
  },
  {
    ...SI_COMMON,
    id: 'phys-units-si-base-derived-002',
    cellId: 'phys-units-si-base-derived',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    skill: 'Use SI units consistently',
    questionType: 'concept-recognition',
    difficulty: 1,
    question: 'Which SI base unit is used for the quantity amount of substance?',
    questionTranslation: 'Какая основная единица СИ используется для величины «количество вещества»?',
    options: [
      { id: 'a', text: 'mole' },
      { id: 'b', text: 'kilogram' },
      { id: 'c', text: 'gram' },
      { id: 'd', text: 'candela' },
    ],
    correctAnswer: 'a',
    solution:
      'Amount of substance is a base quantity in its own right and its base unit is the mole. It is a count of entities, so it is not the same quantity as mass and is not measured in kilograms.',
    shortSolution: 'Amount of substance is a base quantity; its base unit is the mole.',
    explanation:
      'Amount of substance and mass are separate base quantities, which is why a mole of one substance and a mole of another have different masses.',
    commonMistakes: [
      { id: 'amount-as-mass', description: 'Reading “amount” as mass gives the kilogram.', distractorOptionId: 'b' },
      { id: 'gram-as-base', description: 'The gram is not the base unit even for mass — the kilogram is, prefix included.', distractorOptionId: 'c' },
      { id: 'other-base-unit', description: 'Choosing another base unit at random gives the candela, which measures luminous intensity.', distractorOptionId: 'd' },
    ],
    vocabulary: ['base unit'],
    estimatedTime: 35,
    templateParameters: { check: 'si-base-unit-for', quantity: 'amount of substance' },
  },
  {
    ...SI_COMMON,
    id: 'phys-units-si-base-derived-003',
    cellId: 'phys-units-si-base-derived',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    skill: 'Use SI units consistently',
    questionType: 'concept-recognition',
    difficulty: 2,
    question: 'The newton is a derived unit. Which expression gives it in SI base units?',
    questionTranslation: 'Ньютон — производная единица. Какое выражение записывает его в основных единицах СИ?',
    options: [
      { id: 'a', text: 'kg·m/s²' },
      { id: 'b', text: 'kg·m/s' },
      { id: 'c', text: 'kg·m²/s²' },
      { id: 'd', text: 'kg/(m·s²)' },
    ],
    correctAnswer: 'a',
    solution:
      'Force is mass times acceleration, and acceleration is metres per second per second, so a newton is a kilogram metre per second squared: kg·m/s². Every symbol in that expression is a base unit.',
    shortSolution: 'Force is mass × acceleration, so 1 N = 1 kg·m/s².',
    explanation:
      'Reading a derived unit off its defining relation is faster and safer than recalling it, and it is the same skill the dimensional-check cell asks for later.',
    commonMistakes: [
      { id: 'momentum', description: 'Mass times velocity rather than acceleration gives kg·m/s, which is momentum.', distractorOptionId: 'b' },
      { id: 'energy', description: 'Force times distance gives kg·m²/s², which is energy.', distractorOptionId: 'c' },
      { id: 'pressure', description: 'Force divided by area gives kg/(m·s²), which is pressure.', distractorOptionId: 'd' },
    ],
    vocabulary: ['derived unit', 'base unit'],
    estimatedTime: 50,
    templateParameters: { check: 'base-units-of', quantity: 'force' },
  },
  {
    ...SI_COMMON,
    id: 'phys-units-si-base-derived-004',
    cellId: 'phys-units-si-base-derived',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    skill: 'Use SI units consistently',
    questionType: 'concept-recognition',
    difficulty: 2,
    question: 'The joule is a derived unit. Which expression gives it in SI base units?',
    questionTranslation: 'Джоуль — производная единица. Какое выражение записывает его в основных единицах СИ?',
    options: [
      { id: 'a', text: 'kg·m²/s²' },
      { id: 'b', text: 'kg·m/s²' },
      { id: 'c', text: 'kg·m²/s³' },
      { id: 'd', text: 'A·s' },
    ],
    correctAnswer: 'a',
    solution:
      'Energy is force times distance, so a joule is a newton metre: kg·m/s² multiplied by m, which is kg·m²/s².',
    shortSolution: 'Energy is force × distance, so 1 J = 1 kg·m²/s².',
    explanation:
      'The difference between energy and power is a single second in the denominator, so the two expressions are worth deriving rather than recognising by shape.',
    commonMistakes: [
      { id: 'force-not-energy', description: 'Stopping at force gives kg·m/s².', distractorOptionId: 'b' },
      { id: 'power', description: 'Energy per second gives kg·m²/s³, which is power.', distractorOptionId: 'c' },
      { id: 'charge', description: 'Choosing an unrelated derived unit gives A·s, which is charge.', distractorOptionId: 'd' },
    ],
    vocabulary: ['derived unit'],
    estimatedTime: 50,
    templateParameters: { check: 'base-units-of', quantity: 'energy' },
  },
  {
    ...KINEMATICS_COMMON,
    id: 'phys-kinematics-constant-speed-001',
    cellId: 'phys-kinematics-constant-speed',
    module: 'Kinematics',
    topicId: 'phys-kinematics',
    skill: 'Describe motion',
    questionType: 'single-step-calculation',
    difficulty: 2,
    question: 'A train moves at a constant 45 m/s for 24 s. How far does it travel in that time?',
    questionTranslation: 'Поезд движется с постоянной скоростью 45 м/с в течение 24 с. Какой путь он проходит за это время?',
    options: [
      { id: 'a', text: '1080 m' },
      { id: 'b', text: '10800 m' },
      { id: 'c', text: '1.9 m' },
      { id: 'd', text: '69 m' },
    ],
    correctAnswer: 'a',
    solution:
      'At constant speed the distance is s = vt. Both quantities are already in SI units, so no conversion is needed: 45 × 24 = 1080 m.',
    shortSolution: 's = vt = 45 × 24 = 1080 m.',
    explanation:
      'Every quantity here is already in base units, which is what makes it a single step. The same relation with a time in minutes would need a conversion first, and that is where the marks usually go.',
    commonMistakes: [
      { id: 'power-of-ten', description: 'Carrying an extra power of ten gives 10800 m.', distractorOptionId: 'b' },
      { id: 'divided', description: 'Dividing the speed by the time gives about 1.9 m.', distractorOptionId: 'c' },
      { id: 'added', description: 'Adding the two numbers gives 69 m.', distractorOptionId: 'd' },
    ],
    vocabulary: ['constant speed'],
    estimatedTime: 45,
    templateParameters: { check: 'distance-from-speed-time', v: 45, t: 24 },
  },
  {
    ...KINEMATICS_COMMON,
    id: 'phys-kinematics-constant-speed-002',
    cellId: 'phys-kinematics-constant-speed',
    module: 'Kinematics',
    topicId: 'phys-kinematics',
    skill: 'Describe motion',
    questionType: 'single-step-calculation',
    difficulty: 2,
    question: 'A cyclist covers 3.6 km at a constant 8.0 m/s. How long does the journey take?',
    questionTranslation: 'Велосипедист проезжает 3.6 км с постоянной скоростью 8.0 м/с. Сколько времени занимает поездка?',
    options: [
      { id: 'a', text: '450 s' },
      { id: 'b', text: '0.45 s' },
      { id: 'c', text: '4500 s' },
      { id: 'd', text: '28800 s' },
    ],
    correctAnswer: 'a',
    solution:
      'Rearranging s = vt gives t = s ÷ v, but the distance must be in metres first: 3.6 km is 3600 m. Then 3600 ÷ 8.0 = 450 s.',
    shortSolution: 't = s ÷ v = 3600 ÷ 8.0 = 450 s.',
    explanation:
      'The speed is given in metres per second, so the distance has to be in metres. Mixing a kilometre with a metre-per-second is the single most common way to be out by a thousand here.',
    commonMistakes: [
      { id: 'km-not-converted', description: 'Dividing 3.6 by 8.0 without converting gives 0.45 s.', distractorOptionId: 'b' },
      { id: 'power-of-ten', description: 'A stray power of ten gives 4500 s.', distractorOptionId: 'c' },
      { id: 'multiplied', description: 'Multiplying rather than dividing gives 28800 s.', distractorOptionId: 'd' },
    ],
    vocabulary: ['constant speed', 'take'],
    estimatedTime: 55,
    templateParameters: { check: 'time-from-distance-speed', km: 3.6, v: 8 },
  },
  {
    ...KINEMATICS_COMMON,
    id: 'phys-kinematics-constant-speed-003',
    cellId: 'phys-kinematics-constant-speed',
    module: 'Kinematics',
    topicId: 'phys-kinematics',
    skill: 'Describe motion',
    questionType: 'word-problem',
    difficulty: 2,
    question: 'A ferry crosses a channel 12 km wide in 40 minutes, moving at a constant speed. What is its speed in metres per second?',
    questionTranslation: 'Паром пересекает пролив шириной 12 км за 40 минут, двигаясь с постоянной скоростью. Чему равна его скорость в метрах в секунду?',
    options: [
      { id: 'a', text: '5 m/s' },
      { id: 'b', text: '300 m/s' },
      { id: 'c', text: '0.3 m/s' },
      { id: 'd', text: '0.005 m/s' },
    ],
    correctAnswer: 'a',
    solution:
      'Convert both quantities before dividing: 12 km is 12000 m and 40 minutes is 2400 s. Then v = s ÷ t = 12000 ÷ 2400 = 5 m/s.',
    shortSolution: 'v = 12000 ÷ 2400 = 5 m/s.',
    explanation:
      'Two conversions are needed, not one, and each has its own failure. Writing both on their own lines before dividing costs a few seconds and removes both.',
    commonMistakes: [
      { id: 'minutes-as-seconds', description: 'Dividing by 40 instead of 2400 gives 300 m/s.', distractorOptionId: 'b' },
      { id: 'km-per-minute', description: 'Working in kilometres per minute gives 0.3.', distractorOptionId: 'c' },
      { id: 'km-not-converted', description: 'Dividing 12 by 2400 gives 0.005 m/s.', distractorOptionId: 'd' },
    ],
    vocabulary: ['constant speed', 'average speed'],
    estimatedTime: 65,
    templateParameters: { check: 'speed-in-ms-from-km-and-minutes', km: 12, minutes: 40 },
  },
  {
    ...KINEMATICS_COMMON,
    id: 'phys-kinematics-constant-speed-004',
    cellId: 'phys-kinematics-constant-speed',
    module: 'Kinematics',
    topicId: 'phys-kinematics',
    skill: 'Describe motion',
    questionType: 'word-problem',
    difficulty: 2,
    question: 'A delivery van drives at a constant 20 m/s for 15 minutes without stopping. How far does it travel, in kilometres?',
    questionTranslation: 'Фургон едет с постоянной скоростью 20 м/с в течение 15 минут без остановок. Какой путь он проходит, в километрах?',
    options: [
      { id: 'a', text: '18 km' },
      { id: 'b', text: '1.2 km' },
      { id: 'c', text: '0.3 km' },
      { id: 'd', text: '18000 km' },
    ],
    correctAnswer: 'a',
    solution:
      'The time must be in seconds: 15 minutes is 900 s. Then s = vt = 20 × 900 = 18000 m, and the answer is asked for in kilometres, so it is 18 km.',
    shortSolution: 's = 20 × 900 = 18000 m = 18 km.',
    explanation:
      'There are two unit steps here and they pull in opposite directions: minutes into seconds before the calculation, metres into kilometres after it. Doing only one of them lands on an option that is present.',
    commonMistakes: [
      { id: 'one-minute', description: 'Using 60 s rather than 900 s gives 1.2 km.', distractorOptionId: 'b' },
      { id: 'minutes-as-seconds', description: 'Using 15 s gives 300 m, or 0.3 km.', distractorOptionId: 'c' },
      { id: 'metres-reported-as-km', description: 'Giving the answer in metres but labelling it kilometres gives 18000 km.', distractorOptionId: 'd' },
    ],
    vocabulary: ['constant speed'],
    estimatedTime: 65,
    templateParameters: { check: 'distance-km-from-speed-and-minutes', v: 20, minutes: 15 },
  },
  {
    ...VECTOR_COMMON,
    id: 'phys-kinematics-displacement-distance-001',
    cellId: 'phys-kinematics-displacement-distance',
    module: 'Kinematics',
    topicId: 'phys-kinematics',
    skill: 'Describe motion',
    questionType: 'concept-recognition',
    difficulty: 1,
    question: 'An athlete runs one complete lap of a 400 m track and finishes at the point where they started. What is the magnitude of their displacement?',
    questionTranslation: 'Спортсмен пробегает полный круг по дорожке длиной 400 м и финиширует в точке старта. Чему равен модуль его перемещения?',
    options: [
      { id: 'a', text: '0 m' },
      { id: 'b', text: '400 m' },
      { id: 'c', text: '200 m' },
      { id: 'd', text: '800 m' },
    ],
    correctAnswer: 'a',
    solution:
      'Displacement is measured from the starting point to the finishing point, and here they are the same point. The displacement is therefore zero, whatever route was taken between them. The 400 m is the distance travelled, which is a different quantity.',
    shortSolution: 'Start and finish coincide, so the displacement is zero.',
    explanation:
      'Distance depends on the path and displacement does not. A closed path is the clearest case: the distance can be as large as you like while the displacement stays zero.',
    commonMistakes: [
      { id: 'distance-instead', description: 'Giving the distance travelled rather than the displacement gives 400 m.', distractorOptionId: 'b' },
      { id: 'half-lap', description: 'Taking half a lap gives 200 m.', distractorOptionId: 'c' },
      { id: 'doubled', description: 'Doubling the lap gives 800 m.', distractorOptionId: 'd' },
    ],
    vocabulary: ['displacement', 'distance'],
    estimatedTime: 40,
    templateParameters: { check: 'closed-loop-displacement', laps: 1 },
  },
  {
    ...VECTOR_COMMON,
    id: 'phys-kinematics-displacement-distance-002',
    cellId: 'phys-kinematics-displacement-distance',
    module: 'Kinematics',
    topicId: 'phys-kinematics',
    skill: 'Describe motion',
    questionType: 'concept-recognition',
    difficulty: 1,
    question: 'Which one of these quantities is a vector?',
    questionTranslation: 'Какая из этих величин является векторной?',
    options: [
      { id: 'a', text: 'displacement' },
      { id: 'b', text: 'distance' },
      { id: 'c', text: 'speed' },
      { id: 'd', text: 'time' },
    ],
    correctAnswer: 'a',
    solution:
      'A vector has a direction as well as a size. Displacement does: it is a length in a stated direction. Distance, speed and time each have a size only, so all three are scalars.',
    shortSolution: 'Displacement has a direction; distance, speed and time do not.',
    explanation:
      'Each vector in kinematics has a scalar partner that is easy to mistake for it — displacement with distance, velocity with speed — and the pairs are what this cell is testing.',
    commonMistakes: [
      { id: 'distance-as-vector', description: 'Distance is the scalar partner of displacement, not a vector.', distractorOptionId: 'b' },
      { id: 'speed-as-vector', description: 'Speed is the scalar partner of velocity; it is velocity that is the vector.', distractorOptionId: 'c' },
      { id: 'time-as-vector', description: 'Time has no direction at all.', distractorOptionId: 'd' },
    ],
    vocabulary: ['vector', 'scalar'],
    estimatedTime: 35,
    templateParameters: { check: 'vector-quantity-among', quantities: 'displacement,distance,speed,time' },
  },
  {
    ...VECTOR_COMMON,
    id: 'phys-kinematics-displacement-distance-003',
    cellId: 'phys-kinematics-displacement-distance',
    module: 'Kinematics',
    topicId: 'phys-kinematics',
    skill: 'Describe motion',
    questionType: 'concept-recognition',
    difficulty: 2,
    question: 'A car drives 300 m east along a straight road, then turns and drives 100 m west along the same road. What is the magnitude of its displacement?',
    questionTranslation: 'Автомобиль проезжает 300 м на восток по прямой дороге, затем разворачивается и проезжает 100 м на запад по той же дороге. Чему равен модуль его перемещения?',
    options: [
      { id: 'a', text: '200 m' },
      { id: 'b', text: '400 m' },
      { id: 'c', text: '300 m' },
      { id: 'd', text: '100 m' },
    ],
    correctAnswer: 'a',
    solution:
      'The two legs are along the same line and in opposite directions, so they subtract: the car ends up 300 − 100 = 200 m east of where it began. The distance travelled is 400 m, which is the sum, and the question did not ask for it.',
    shortSolution: 'Opposite directions subtract: 300 − 100 = 200 m.',
    explanation:
      'Both the sum and the difference are available as options, and only reading which quantity was asked for separates them. This is the same trap the closed-path item sets, with a smaller gap between the two answers.',
    commonMistakes: [
      { id: 'added', description: 'Adding the legs gives the distance travelled, 400 m.', distractorOptionId: 'b' },
      { id: 'first-leg', description: 'Stopping after the first leg gives 300 m.', distractorOptionId: 'c' },
      { id: 'second-leg', description: 'Reading only the return leg gives 100 m.', distractorOptionId: 'd' },
    ],
    vocabulary: ['displacement', 'distance'],
    estimatedTime: 50,
    templateParameters: { check: 'net-displacement-on-a-line', forward: 300, back: 100 },
  },
  {
    ...VECTOR_COMMON,
    id: 'phys-kinematics-displacement-distance-004',
    cellId: 'phys-kinematics-displacement-distance',
    module: 'Kinematics',
    topicId: 'phys-kinematics',
    skill: 'Describe motion',
    questionType: 'concept-recognition',
    difficulty: 2,
    question: 'Which one of these quantities is a scalar?',
    questionTranslation: 'Какая из этих величин является скалярной?',
    options: [
      { id: 'a', text: 'speed' },
      { id: 'b', text: 'velocity' },
      { id: 'c', text: 'acceleration' },
      { id: 'd', text: 'displacement' },
    ],
    correctAnswer: 'a',
    solution:
      'A scalar has a size and no direction. Speed is the size of the velocity with its direction discarded, so it is a scalar. Velocity, acceleration and displacement all carry a direction and are vectors.',
    shortSolution: 'Speed is velocity with the direction discarded, so it is a scalar.',
    explanation:
      'Speed and velocity are not two words for one quantity: a journey can have a large average speed and zero average velocity, which is exactly what happens on a closed path.',
    commonMistakes: [
      { id: 'velocity-as-scalar', description: 'Velocity is the vector; speed is its scalar partner.', distractorOptionId: 'b' },
      { id: 'acceleration-as-scalar', description: 'Acceleration has a direction, which is why slowing down and speeding up differ in sign.', distractorOptionId: 'c' },
      { id: 'displacement-as-scalar', description: 'Displacement is the vector partner of distance.', distractorOptionId: 'd' },
    ],
    vocabulary: ['vector', 'scalar'],
    estimatedTime: 40,
    templateParameters: { check: 'scalar-quantity-among', quantities: 'speed,velocity,acceleration,displacement' },
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
  'phys-thermodynamics-heat-transfer',
  'phys-kinematics-constant-speed',
  'phys-kinematics-displacement-distance',
  'phys-units-si-base-derived',
  'phys-units-unit-conversion-si',
] as const;
