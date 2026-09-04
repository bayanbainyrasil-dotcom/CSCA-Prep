import {
  FormulaSchema,
  LessonSchema,
  VocabularyEntrySchema,
  type Formula,
  type Lesson,
  type LessonSection,
  type LocalizedText,
  type VocabularyEntry,
} from '../domain';

/**
 * Authored teaching content for the vertical slices.
 *
 * This is **not** demo content. `DEMO_LESSONS` in `seed.ts` are marked
 * `demo: true` and exist to make the local demo navigable; everything here is
 * `demo: false` and `status: 'draft'`, meaning it was authored for the real
 * product and is waiting for a human to read it. Nothing here may be presented
 * to a learner as verified, and nothing here moves blueprint coverage — coverage
 * counts reviewer-verified *questions*, and a lesson is not a question.
 *
 * Each slice is attached to one blueprint cell and follows the same path the
 * cell implies: what you need first, the idea, the words, the relation, a worked
 * example, guided practice, independent practice, then a short timed set.
 *
 * Both languages are written out. Where a field is bilingual the Russian is a
 * real rendering, not the English copied across; `localizedText` in
 * `src/features/i18n` handles the fallback if a translation is ever missing.
 */

const AUTHORED_AT = '2026-09-03T00:00:00.000Z';
const AUTHOR = 'csca-prep-authored-slice';

function text(en: string, ru: string): LocalizedText {
  return { en, ru };
}

function section(
  id: string,
  kind: LessonSection['kind'],
  title: LocalizedText,
  body: LocalizedText,
  extra: Partial<LessonSection> = {},
): LessonSection {
  return { id, kind, title, body, katex: [], estimatedMinutes: 3, ...extra };
}

function draftMeta() {
  return {
    // Authored, unreviewed. A reviewer moves this to published; nothing here does.
    status: 'draft' as const,
    demo: false,
    version: 1,
    createdAt: AUTHORED_AT,
    updatedAt: AUTHORED_AT,
    createdBy: AUTHOR,
  };
}

// --- Vocabulary -------------------------------------------------------------

export const SLICE_VOCABULARY: readonly VocabularyEntry[] = Object.freeze([
  VocabularyEntrySchema.parse({
    id: 'vocab-isolate',
    english: 'isolate',
    russian: 'выразить, оставить одну переменную',
    simpleExplanation: text(
      'To get the unknown alone on one side of the equation, with everything else on the other.',
      'Оставить неизвестное одно на одной стороне уравнения, а всё остальное перенести на другую.',
    ),
    exampleSentence: 'Isolate x in the equation x + 9 = 4.',
    category: 'math',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-inverse-operation',
    english: 'inverse operation',
    russian: 'обратная операция',
    simpleExplanation: text(
      'The operation that undoes another: subtraction undoes addition, division undoes multiplication.',
      'Операция, отменяющая другую: вычитание отменяет сложение, деление отменяет умножение.',
    ),
    exampleSentence: 'Apply the inverse operation to both sides.',
    category: 'math',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-both-sides',
    english: 'both sides',
    russian: 'обе части уравнения',
    simpleExplanation: text(
      'An equation stays true only if the same thing is done to the left and the right.',
      'Равенство сохраняется, только если одно и то же сделано с левой и правой частью.',
    ),
    exampleSentence: 'Subtract 9 from both sides.',
    category: 'question-command',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-like-terms',
    english: 'like terms',
    russian: 'подобные слагаемые',
    simpleExplanation: text(
      'Terms with exactly the same letter part, so 4x and 2x are like terms but 4x and 4 are not.',
      'Слагаемые с одинаковой буквенной частью: 4x и 2x подобны, а 4x и 4 — нет.',
    ),
    exampleSentence: 'Collect the like terms on the left.',
    category: 'math',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-expand',
    english: 'expand',
    russian: 'раскрыть скобки',
    simpleExplanation: text(
      'Multiply everything inside the bracket by what is outside it — every term, not only the first.',
      'Умножить всё, что внутри скобки, на то, что снаружи — каждое слагаемое, а не только первое.',
    ),
    exampleSentence: 'Expand the brackets before collecting like terms.',
    category: 'question-command',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-common-denominator',
    english: 'common denominator',
    russian: 'общий знаменатель',
    simpleExplanation: text(
      'A number every denominator divides into, used to clear fractions from an equation.',
      'Число, на которое делится каждый знаменатель; используется, чтобы убрать дроби из уравнения.',
    ),
    exampleSentence: 'Multiply both sides by the common denominator.',
    category: 'math',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-per',
    english: 'per',
    russian: 'за каждый, на каждый',
    simpleExplanation: text(
      'For each one. A price “per kilometre” is multiplied by the number of kilometres, never added once.',
      'За каждый один. Цена «per kilometre» умножается на число километров, а не прибавляется один раз.',
    ),
    exampleSentence: 'The taxi charges 120 tenge per kilometre.',
    category: 'comparison',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-fixed-charge',
    english: 'fixed charge',
    russian: 'фиксированная плата',
    simpleExplanation: text(
      'An amount paid once regardless of size or quantity — the constant term in the equation, not the rate.',
      'Сумма, которая платится один раз независимо от количества — свободный член уравнения, а не коэффициент.',
    ),
    exampleSentence: 'There is a fixed charge of 500 tenge plus a rate for each kilometre.',
    category: 'math',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-let-be',
    english: 'let x be',
    russian: 'пусть x — это',
    simpleExplanation: text(
      'The phrase that names the unknown. Write what x stands for, including its unit, before writing any equation.',
      'Фраза, которая называет неизвестное. Запишите, что именно обозначает x, вместе с единицей, прежде чем писать уравнение.',
    ),
    exampleSentence: 'Let n be the number of tins in the crate.',
    category: 'question-command',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-evaluate',
    english: 'evaluate',
    russian: 'вычислить значение',
    simpleExplanation: text(
      'Work the expression out to a single number. It does not mean rearrange, simplify or solve — nothing here has an unknown in it.',
      'Довести выражение до одного числа. Это не значит преобразовать, упростить или решить: неизвестного здесь нет.',
    ),
    exampleSentence: 'Evaluate the expression, giving your answer as an integer.',
    category: 'question-command',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-order-of-operations',
    english: 'order of operations',
    russian: 'порядок действий',
    simpleExplanation: text(
      'Brackets first, then powers, then multiplication and division left to right, then addition and subtraction left to right.',
      'Сначала скобки, затем степени, затем умножение и деление слева направо, затем сложение и вычитание слева направо.',
    ),
    exampleSentence: 'The order of operations decides which sign the answer carries.',
    category: 'math',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-minus-sign',
    english: 'minus sign',
    russian: 'знак минус',
    simpleExplanation: text(
      'The same symbol does two jobs: it makes a number negative, and it subtracts. Reading which job it is doing decides the answer.',
      'Один и тот же знак выполняет две роли: делает число отрицательным и обозначает вычитание. От того, какую роль вы прочитали, зависит ответ.',
    ),
    exampleSentence: 'In −7 + 12 the minus sign belongs to the seven.',
    category: 'math',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-lowest-terms',
    english: 'in its lowest terms',
    russian: 'в несократимом виде',
    simpleExplanation: text(
      'A fraction whose top and bottom share no common factor left to cancel. An answer that is correct but not cancelled is usually still marked wrong.',
      'Дробь, у которой у числителя и знаменателя не осталось общего множителя. Верный, но несокращённый ответ обычно всё равно считается неверным.',
    ),
    exampleSentence: 'Give your answer as a fraction in its lowest terms.',
    category: 'question-command',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-decimal-place',
    english: 'decimal place',
    russian: 'знак после запятой',
    simpleExplanation: text(
      'A position after the decimal point. “To two decimal places” tells you where to round, and rounding earlier than that changes the answer.',
      'Позиция после десятичной запятой. «To two decimal places» указывает, где округлять; округление раньше меняет ответ.',
    ),
    exampleSentence: 'Give your answer to three decimal places.',
    category: 'unit',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-of',
    english: 'of',
    russian: 'от (в смысле умножения)',
    simpleExplanation: text(
      'Between a percentage or fraction and a quantity, “of” means multiply. “20% of 60” is 0.2 × 60, never 60 − 20.',
      'Между процентом или дробью и величиной «of» означает умножение. «20% of 60» — это 0.2 × 60, а не 60 − 20.',
    ),
    exampleSentence: 'Find 15% of the total mass.',
    category: 'comparison',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-estimate',
    english: 'estimate',
    russian: 'оценить, прикинуть',
    simpleExplanation: text(
      'Find roughly what the answer is, on purpose and quickly. An exact calculation is not a better answer to this instruction; it is a slower one that risks the same slip.',
      'Найти примерное значение — намеренно и быстро. Точное вычисление здесь не лучший ответ, а более медленный, и в нём та же ошибка так же возможна.',
    ),
    exampleSentence: 'Estimate the value without computing it exactly.',
    category: 'question-command',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-order-of-magnitude',
    english: 'order of magnitude',
    russian: 'порядок величины',
    simpleExplanation: text(
      'Which power of ten a number sits at. Two numbers an order of magnitude apart differ by a factor of about ten.',
      'На какой степени десяти находится число. Числа, отличающиеся на порядок, различаются примерно в десять раз.',
    ),
    exampleSentence: 'The two answers differ by an order of magnitude.',
    category: 'comparison',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-significant-figure',
    english: 'significant figure',
    russian: 'значащая цифра',
    simpleExplanation: text(
      'A digit that carries information about the size of a number, counted from the first non-zero digit. Rounding to one of them is what makes an estimate quick.',
      'Цифра, несущая информацию о величине числа; счёт ведётся с первой ненулевой. Округление до одной такой цифры и делает оценку быстрой.',
    ),
    exampleSentence: 'Round each number to one significant figure first.',
    category: 'unit',
    subject: 'mathematics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-prefix',
    english: 'prefix',
    russian: 'приставка (кратная или дольная)',
    simpleExplanation: text(
      'A letter in front of a unit standing for a power of ten: k is 10³, m is 10⁻³, μ is 10⁻⁶. It belongs to the unit, not to the number.',
      'Буква перед единицей, обозначающая степень десяти: к — 10³, м — 10⁻³, мк — 10⁻⁶. Она относится к единице, а не к числу.',
    ),
    exampleSentence: 'The prefix milli means one thousandth of the base unit.',
    category: 'unit',
    subject: 'physics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-base-unit',
    english: 'base unit',
    russian: 'основная единица',
    simpleExplanation: text(
      'One of the seven SI units everything else is built from — the metre, kilogram, second, ampere, kelvin, mole and candela.',
      'Одна из семи основных единиц СИ, из которых строятся все остальные: метр, килограмм, секунда, ампер, кельвин, моль и кандела.',
    ),
    exampleSentence: 'Give your answer in SI base units.',
    category: 'unit',
    subject: 'physics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-derived-unit',
    english: 'derived unit',
    russian: 'производная единица',
    simpleExplanation: text(
      'A unit made of base units, such as m/s or N. Converting one means converting every base unit inside it, not just the first.',
      'Единица, составленная из основных, например м/с или Н. Её перевод требует перевода каждой входящей основной единицы, а не только первой.',
    ),
    exampleSentence: 'The newton is a derived unit.',
    category: 'unit',
    subject: 'physics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-in-terms-of',
    english: 'in terms of',
    russian: 'через, выразив через',
    simpleExplanation: text(
      'Write one thing using another. “Express the newton in terms of base units” asks for kg·m/s², not for a definition in words.',
      'Записать одно через другое. «Express the newton in terms of base units» требует кг·м/с², а не определения словами.',
    ),
    exampleSentence: 'Express the joule in terms of SI base units.',
    category: 'question-command',
    subject: 'physics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-specific-heat-capacity',
    english: 'specific heat capacity',
    russian: 'удельная теплоёмкость',
    simpleExplanation: text(
      'The energy needed to raise one kilogram of a substance by one kelvin.',
      'Энергия, необходимая для нагрева одного килограмма вещества на один кельвин.',
    ),
    exampleSentence: 'The specific heat capacity of water is 4200 J/(kg·K).',
    category: 'physics',
    subject: 'physics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-temperature-change',
    english: 'temperature change',
    russian: 'изменение температуры',
    simpleExplanation: text(
      'The difference between the final and starting temperature, not the final reading itself.',
      'Разность конечной и начальной температуры, а не само конечное значение.',
    ),
    exampleSentence: 'Heating from 20 °C to 100 °C is a temperature change of 80 K.',
    category: 'physics',
    subject: 'physics',
    ...draftMeta(),
  }),
  VocabularyEntrySchema.parse({
    id: 'vocab-released',
    english: 'released',
    russian: 'отдаёт, выделяет',
    simpleExplanation: text(
      'Energy leaving an object, for example when it cools. The amount is asked for as a positive number.',
      'Энергия, покидающая тело, например при остывании. Величину спрашивают как положительное число.',
    ),
    exampleSentence: 'How much energy does the block release as it cools?',
    category: 'physics',
    subject: 'physics',
    ...draftMeta(),
  }),
]);

// --- Formulas ---------------------------------------------------------------

export const SLICE_FORMULAS: readonly Formula[] = Object.freeze([
  FormulaSchema.parse({
    id: 'formula-one-step-linear',
    subject: 'mathematics',
    topicId: 'math-linear',
    name: text('Undoing one operation', 'Отмена одной операции'),
    katex: 'x + b = c \\iff x = c - b',
    calculates: text(
      'The value of the unknown when exactly one operation has been applied to it.',
      'Значение неизвестного, когда к нему применена ровно одна операция.',
    ),
    variables: [
      { symbol: 'x', meaning: text('the unknown', 'неизвестное'), siUnit: null },
      { symbol: 'b', meaning: text('the number added to the unknown', 'число, прибавленное к неизвестному'), siUnit: null },
      { symbol: 'c', meaning: text('the value the left side equals', 'значение, которому равна левая часть'), siUnit: null },
    ],
    limitations: text(
      'Only for one operation. Two or more steps need the multi-step method, and this form says nothing about inequalities, where multiplying by a negative flips the sign.',
      'Только для одной операции. Два и более шага требуют многошагового метода, и эта форма ничего не говорит о неравенствах, где умножение на отрицательное число меняет знак.',
    ),
    ...draftMeta(),
  }),
  FormulaSchema.parse({
    id: 'formula-multi-step-linear',
    subject: 'mathematics',
    topicId: 'math-linear',
    name: text('Unknown on both sides', 'Неизвестное в обеих частях'),
    katex: 'ax + b = cx + d \\iff x = \\frac{d - b}{a - c}',
    calculates: text(
      'The value of the unknown when it appears on both sides of the equation.',
      'Значение неизвестного, когда оно встречается в обеих частях уравнения.',
    ),
    variables: [
      { symbol: 'x', meaning: text('the unknown', 'неизвестное'), siUnit: null },
      { symbol: 'a', meaning: text('coefficient of the unknown on the left', 'коэффициент при неизвестном слева'), siUnit: null },
      { symbol: 'b', meaning: text('constant term on the left', 'свободный член слева'), siUnit: null },
      { symbol: 'c', meaning: text('coefficient of the unknown on the right', 'коэффициент при неизвестном справа'), siUnit: null },
      { symbol: 'd', meaning: text('constant term on the right', 'свободный член справа'), siUnit: null },
    ],
    limitations: text(
      'Undefined when a equals c: the unknowns cancel, and the equation is then either true for every x or for none. It is a shortcut for a rearrangement, not a substitute for it — a bracket or a fraction must be cleared before the coefficients can be read off.',
      'Не определено при a = c: неизвестные сокращаются, и уравнение верно либо при любом x, либо ни при каком. Это сокращённая запись преобразования, а не замена ему: скобки и дроби нужно раскрыть до того, как коэффициенты можно будет считать.',
    ),
    ...draftMeta(),
  }),
  FormulaSchema.parse({
    id: 'formula-fixed-plus-rate',
    subject: 'mathematics',
    topicId: 'math-linear',
    name: text('A fixed amount plus a rate', 'Фиксированная сумма плюс тариф'),
    katex: 'T = f + rn \\iff n = \\frac{T - f}{r}',
    calculates: text(
      'How many units were bought, travelled or used, when a total is made of one fixed amount and one amount charged for each unit.',
      'Сколько единиц куплено, пройдено или израсходовано, когда итог складывается из одной фиксированной суммы и суммы за каждую единицу.',
    ),
    variables: [
      { symbol: 'T', meaning: text('the total', 'итоговая величина'), siUnit: null },
      { symbol: 'f', meaning: text('the fixed amount, paid once', 'фиксированная часть, платится один раз'), siUnit: null },
      { symbol: 'r', meaning: text('the amount for each unit', 'величина за одну единицу'), siUnit: null },
      { symbol: 'n', meaning: text('the number of units', 'число единиц'), siUnit: null },
    ],
    limitations: text(
      'Only for a situation with exactly one fixed part and one constant rate. A tariff that changes after a threshold, a discount above some quantity, or a second rate needs a different equation — and n must come out as a whole number when the units are countable, which is a check, not an assumption.',
      'Только для ситуации с ровно одной фиксированной частью и одним постоянным тарифом. Тариф, меняющийся после порога, скидка от количества или второй тариф требуют другого уравнения. Кроме того, при счётных единицах n должно получиться целым — это проверка, а не допущение.',
    ),
    ...draftMeta(),
  }),
  FormulaSchema.parse({
    id: 'formula-sign-rules',
    subject: 'mathematics',
    topicId: 'math-foundation',
    name: text('Signs in a product or quotient', 'Знаки в произведении и частном'),
    katex: '(-a)(-b) = ab,\\quad (-a)(b) = -ab,\\quad \\frac{-a}{-b} = \\frac{a}{b}',
    calculates: text(
      'The sign of a product or a quotient, from the signs of the two numbers in it.',
      'Знак произведения или частного по знакам двух чисел в нём.',
    ),
    variables: [
      { symbol: 'a', meaning: text('the size of the first number, without its sign', 'величина первого числа без знака'), siUnit: null },
      { symbol: 'b', meaning: text('the size of the second number, without its sign', 'величина второго числа без знака'), siUnit: null },
    ],
    limitations: text(
      'For multiplication and division only. Addition and subtraction have no such rule: −5 + 3 and −5 − 3 differ in size as well as sign, and each has to be worked out rather than read off. The rule also says nothing about which operation comes first, which is where most sign errors actually start.',
      'Только для умножения и деления. Для сложения и вычитания такого правила нет: −5 + 3 и −5 − 3 отличаются и знаком, и величиной, и каждое нужно вычислять, а не считывать. Правило также ничего не говорит о порядке действий, а именно оттуда чаще всего и берутся ошибки в знаках.',
    ),
    ...draftMeta(),
  }),
  FormulaSchema.parse({
    id: 'formula-percent-decimal-fraction',
    subject: 'mathematics',
    topicId: 'math-foundation',
    name: text('One number, three notations', 'Одно число в трёх записях'),
    katex: 'p\\% = \\frac{p}{100} = d',
    calculates: text(
      'The same value written as a percentage, as a decimal, or as a fraction — the notation changes, the number does not.',
      'Одно и то же значение в записи процентом, десятичной дробью или обыкновенной дробью — запись меняется, число нет.',
    ),
    variables: [
      { symbol: 'p', meaning: text('the number of per-cent, without the sign', 'число процентов без знака'), siUnit: null },
      { symbol: 'd', meaning: text('the same value as a decimal', 'то же значение десятичной дробью'), siUnit: null },
    ],
    limitations: text(
      'This converts a value; it does not compare two of them. A rise from 20% to 25% is five percentage points but a quarter more, and those are different answers to different questions. It also says nothing about rounding: a decimal that does not terminate has to be rounded where the question says, not where it becomes convenient.',
      'Это перевод значения, а не сравнение двух. Рост с 20% до 25% — это пять процентных пунктов, но при этом на четверть больше, и это разные ответы на разные вопросы. Здесь также ничего не сказано об округлении: непериодическую запись округляют там, где указано в задании, а не там, где удобно.',
    ),
    ...draftMeta(),
  }),
  FormulaSchema.parse({
    id: 'formula-standard-form',
    subject: 'mathematics',
    topicId: 'math-foundation',
    name: text('Standard form', 'Стандартный вид'),
    katex: 'x = a \\times 10^{n},\\quad 1 \\le a < 10',
    calculates: text(
      'Any number as one digit before the point multiplied by a power of ten, so that two numbers can be compared by size at a glance.',
      'Любое число в виде одной цифры до запятой, умноженной на степень десяти, чтобы два числа можно было сравнить по величине сразу.',
    ),
    variables: [
      { symbol: 'x', meaning: text('the number being written', 'записываемое число'), siUnit: null },
      { symbol: 'a', meaning: text('the digits, at least one and less than ten', 'цифры: не меньше единицы и меньше десяти'), siUnit: null },
      { symbol: 'n', meaning: text('the power of ten, which carries the size', 'показатель степени десяти, несущий величину'), siUnit: null },
    ],
    limitations: text(
      'The form itself says nothing about accuracy: writing a number in standard form neither adds nor removes significant figures, and an estimate written this way is still an estimate. It also does not apply to zero, which has no such form, and the condition on a is part of the definition — 12 × 10³ is a correct value but not standard form, and is marked wrong where the form is what was asked for.',
      'Сама запись ничего не говорит о точности: перевод в стандартный вид не добавляет и не убирает значащих цифр, и оценка, записанная так, остаётся оценкой. Он также неприменим к нулю, у которого такой формы нет, а условие на a — часть определения: 12 × 10³ верно по значению, но не является стандартным видом и засчитывается как ошибка там, где требовалась именно форма.',
    ),
    ...draftMeta(),
  }),
  FormulaSchema.parse({
    id: 'formula-si-prefix',
    subject: 'physics',
    topicId: 'phys-units',
    name: text('A prefix is a power of ten', 'Приставка — это степень десяти'),
    katex: 'q = a \\times 10^{n}',
    calculates: text(
      'The value of a quantity in its base unit, from the number written and the power of ten its prefix stands for.',
      'Значение величины в основной единице по записанному числу и степени десяти, которую обозначает приставка.',
    ),
    variables: [
      { symbol: 'q', meaning: text('the quantity in its base unit', 'величина в основной единице'), siUnit: null },
      { symbol: 'a', meaning: text('the number as written, unchanged by the conversion', 'число в исходной записи, не изменяемое переводом'), siUnit: null },
      { symbol: 'n', meaning: text('the power of ten the prefix stands for', 'степень десяти, которую обозначает приставка'), siUnit: null },
    ],
    limitations: text(
      'This looks like standard form and is not: there n is chosen so that a lies between one and ten, while here n is fixed by the prefix and a is whatever was written. It also covers one unit at a time — a derived unit such as km/h has a prefix on the top and a non-SI unit on the bottom, and both have to be dealt with. A prefix raised to a power, as in mm², carries the power too.',
      'Похоже на стандартный вид, но это не он: там n подбирают так, чтобы a было от одного до десяти, а здесь n задаётся приставкой, а a — то, что записано. Кроме того, здесь речь об одной единице: у производной единицы вроде км/ч приставка сверху, а несистемная единица снизу, и разобраться нужно с обеими. Приставка, возведённая в степень, как в мм², возводится в неё вместе с числом.',
    ),
    ...draftMeta(),
  }),
  FormulaSchema.parse({
    id: 'formula-newton-in-base-units',
    subject: 'physics',
    topicId: 'phys-units',
    name: text('A derived unit read off its relation', 'Производная единица, считанная с её соотношения'),
    katex: '1\\,N = 1\\,kg \\cdot m \\cdot s^{-2}',
    calculates: text(
      'The base units of a derived unit, taken from the relation that defines the quantity rather than from memory.',
      'Основные единицы производной единицы, полученные из соотношения, определяющего величину, а не из памяти.',
    ),
    variables: [
      { symbol: 'N', meaning: text('the newton, the unit of force', 'ньютон, единица силы'), siUnit: 'N' },
      { symbol: 'kg', meaning: text('the kilogram, the base unit of mass', 'килограмм, основная единица массы'), siUnit: 'kg' },
      { symbol: 'm', meaning: text('the metre, the base unit of length', 'метр, основная единица длины'), siUnit: 'm' },
      { symbol: 's', meaning: text('the second, the base unit of time', 'секунда, основная единица времени'), siUnit: 's' },
    ],
    limitations: text(
      'This is one worked case, not a rule that generalises by pattern. Every other derived unit has to be read off its own defining relation: the joule is a newton metre, the watt a joule per second, the pascal a newton per square metre. Matching a remembered shape is exactly the mistake the distractors in this cell are built from — energy and torque share base units and are not the same quantity.',
      'Это один разобранный случай, а не правило, обобщаемое по виду. Любую другую производную единицу нужно считывать с её собственного определяющего соотношения: джоуль — это ньютон-метр, ватт — джоуль в секунду, паскаль — ньютон на квадратный метр. Подбор по запомнившемуся виду — как раз та ошибка, из которой построены неверные варианты в этой ячейке: энергия и момент силы имеют одинаковые основные единицы и не являются одной величиной.',
    ),
    ...draftMeta(),
  }),
  FormulaSchema.parse({
    id: 'formula-heat-transfer',
    subject: 'physics',
    topicId: 'phys-thermodynamics',
    name: text('Heat transferred', 'Переданная теплота'),
    katex: 'Q = mc\\Delta T',
    calculates: text(
      'The energy needed to change the temperature of a mass of one substance, with no change of state.',
      'Энергия, необходимая для изменения температуры массы одного вещества без смены агрегатного состояния.',
    ),
    variables: [
      { symbol: 'Q', meaning: text('energy transferred', 'переданная энергия'), siUnit: 'J' },
      { symbol: 'm', meaning: text('mass of the substance', 'масса вещества'), siUnit: 'kg' },
      { symbol: 'c', meaning: text('specific heat capacity', 'удельная теплоёмкость'), siUnit: 'J/(kg·K)' },
      { symbol: 'ΔT', meaning: text('temperature change', 'изменение температуры'), siUnit: 'K' },
    ],
    limitations: text(
      'Does not apply while a substance is melting or boiling: there the temperature does not change and latent heat is needed instead. It also assumes c is constant over the range.',
      'Не применяется во время плавления или кипения: там температура не меняется и нужна удельная теплота фазового перехода. Также предполагается, что c постоянна в этом диапазоне.',
    ),
    ...draftMeta(),
  }),
]);

// --- Lessons ----------------------------------------------------------------

export const SLICE_LESSONS: readonly Lesson[] = Object.freeze([
  LessonSchema.parse({
    id: 'lesson-math-foundation-integer-operations',
    topicId: 'math-foundation',
    subject: 'mathematics',
    title: text('Signs and the order they are applied in', 'Знаки и порядок, в котором их применяют'),
    summary: text(
      'Do the operations in order, and read each minus sign as either a negative number or a subtraction before using it.',
      'Выполнять действия по порядку и перед вычислением понимать, что означает каждый минус: отрицательное число или вычитание.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need to add and subtract whole numbers and to know what a square is. Nothing else: this is the first cell in the chain, and every later lesson assumes what is here rather than the other way round.',
        'Нужно уметь складывать и вычитать целые числа и знать, что такое квадрат. Больше ничего: это первая ячейка цепочки, и все последующие уроки опираются на неё, а не наоборот.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Apply brackets, powers, multiplication and division, and then addition and subtraction, in that order and left to right within each level; decide for every minus sign whether it makes a number negative or subtracts; and give the sign of a product or quotient without recomputing it.',
        'Применять скобки, степени, умножение и деление, затем сложение и вычитание — в этом порядке и слева направо внутри каждого уровня; для каждого минуса определять, делает ли он число отрицательным или означает вычитание; называть знак произведения или частного, не пересчитывая его.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'Almost every wrong answer in this cell is right arithmetic done in the wrong order, or a minus sign attached to the wrong thing. Neither is a gap in knowledge, which is why they survive so long: the working looks correct line by line. The fix is to decide the order and the signs before computing anything, not while computing.',
        'Почти каждый неверный ответ в этой ячейке — верная арифметика, выполненная не в том порядке, или минус, отнесённый не к тому. Ни то, ни другое не пробел в знаниях, и именно поэтому такие ошибки держатся долго: построчно решение выглядит верным. Лечится это тем, что порядок и знаки определяют до вычислений, а не во время них.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“Evaluate” means work it out to a single number. It is not “simplify”, which may leave letters in the answer, and not “solve”, which needs an unknown to find. If a prompt says “giving your answer as an integer”, a decimal in the options is there for someone who divided in the wrong order.',
        '«Evaluate» значит довести до одного числа. Это не «simplify», где в ответе могут остаться буквы, и не «solve», где нужно найти неизвестное. Если в задании сказано «giving your answer as an integer», десятичная дробь среди вариантов предназначена тому, кто разделил не в том порядке.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'evaluate — вычислить значение; order of operations — порядок действий; minus sign — знак минус.',
        'evaluate — вычислить значение; order of operations — порядок действий; minus sign — знак минус.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'Two negatives multiplied or divided give a positive; one negative gives a negative. This holds for multiplication and division only — addition and subtraction have no such rule, and each has to be worked out.',
        'Два отрицательных числа при умножении или делении дают положительное; одно отрицательное даёт отрицательное. Это верно только для умножения и деления: у сложения и вычитания такого правила нет, там нужно вычислять.',
      ), { katex: ['(-a)(-b) = ab', '(-a)(b) = -ab'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        'Evaluate −15 ÷ 3 + (−7) × 2.\n\nDecide the order first. There are no brackets to open and no powers, so division and multiplication come before addition: −15 ÷ 3 and (−7) × 2 are both done before anything is added. Then read the signs: −15 divided by a positive is negative, giving −5; a negative times a positive is negative, giving −14. Only now the addition: −5 + (−14) = −19.\n\nThe common wrong answer here is not an arithmetic slip. It comes from adding left to right, which turns the expression into a different one entirely.',
        'Вычислите −15 ÷ 3 + (−7) × 2.\n\nСначала определите порядок. Скобок раскрывать нечего, степеней нет, значит деление и умножение выполняются до сложения: и −15 ÷ 3, и (−7) × 2 считаются раньше любого сложения. Теперь знаки: −15, делённое на положительное, даёт отрицательное −5; отрицательное на положительное даёт отрицательное −14. И только теперь сложение: −5 + (−14) = −19.\n\nЧастый неверный ответ здесь — не арифметическая ошибка. Он получается из сложения слева направо, которое превращает выражение в совсем другое.',
      ), { estimatedMinutes: 4 }),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        'Evaluate 10 − (−3)² × 2. First: what is inside the bracket, and does the square apply to the sign as well as the number? Second: which operation is at the highest level here, and what does that mean for the order? Third: is the minus in front of the square a subtraction or part of a negative number? Fourth: compute, and say your answer aloud with its sign.',
        'Вычислите 10 − (−3)² × 2. Первое: что стоит в скобке и относится ли квадрат к знаку, а не только к числу? Второе: какое действие здесь на высшем уровне и что это значит для порядка? Третье: минус перед квадратом — это вычитание или часть отрицательного числа? Четвёртое: вычислите и проговорите ответ вместе со знаком.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'Evaluate (−2)³ + 18 ÷ (−9), then −5 − (−11) + (−3) × 3. In the second one, decide what each of the four minus signs is doing before you compute anything. Write the order you will work in, then work in it.',
        'Вычислите (−2)³ + 18 ÷ (−9), затем −5 − (−11) + (−3) × 3. Во втором сначала определите, что делает каждый из четырёх минусов, и только потом считайте. Запишите порядок действий, затем действуйте по нему.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'Every option in this cell is reachable by a real mistake: one for working left to right, one for losing a sign, one for applying a power to the number but not to its sign. That is why an option matching your answer is not confirmation — it is the design. Recompute the expression in a different order of your own choosing and see whether you land in the same place.',
        'Каждый вариант в этой ячейке получается из реальной ошибки: один — из вычисления слева направо, другой — из потерянного знака, третий — из степени, применённой к числу, но не к его знаку. Поэтому совпадение вашего ответа с вариантом — не подтверждение, а замысел составителя. Пересчитайте выражение в другом порядке по своему выбору и посмотрите, придёте ли вы туда же.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Three expressions in three minutes. Before the timer starts, write the order of operations at the top of the page and keep it visible. Reading it is faster than remembering it, and this is the cell where being fast and being wrong cost the same.',
        'Три выражения за три минуты. До запуска таймера выпишите порядок действий сверху страницы и держите его перед глазами. Прочитать быстрее, чем вспомнить, а это как раз та ячейка, где «быстро» и «неверно» стоят одинаково.',
      ), { estimatedMinutes: 3 }),
    ],
    vocabularyIds: ['vocab-evaluate', 'vocab-order-of-operations', 'vocab-minus-sign'],
    formulaIds: ['formula-sign-rules'],
    prerequisiteLessonIds: [],
    ...draftMeta(),
  }),
  LessonSchema.parse({
    id: 'lesson-math-foundation-fraction-decimal-percent',
    topicId: 'math-foundation',
    subject: 'mathematics',
    title: text('One number, three notations', 'Одно число в трёх записях'),
    summary: text(
      'Move between fraction, decimal and percentage by dividing or by multiplying by a hundred, and answer in the notation the question asks for.',
      'Переходить между обыкновенной дробью, десятичной и процентом делением или умножением на сто и отвечать в той записи, которую требует задание.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need division that does not stop at the decimal point, and to be able to cancel a fraction by a common factor. Signs are not involved here, so the order-of-operations cell is useful but not required first.',
        'Нужно уметь делить, не останавливаясь на целой части, и сокращать дробь на общий множитель. Знаки здесь не участвуют, поэтому ячейка про порядок действий полезна, но не обязательна раньше.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Turn a fraction into a decimal by dividing, a decimal into a percentage by multiplying by a hundred, and a percentage into a fraction in its lowest terms — and say which of the three the question wants back.',
        'Превращать обыкновенную дробь в десятичную делением, десятичную в проценты умножением на сто, а проценты — в несократимую дробь, и понимать, какую из трёх записей ждёт задание.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'Fraction, decimal and percentage are three ways of writing one number, not three kinds of number. Every conversion is therefore a single operation and never a calculation to be reasoned out afresh: divide to leave a fraction, multiply by a hundred to reach a percentage, and reverse either to come back.',
        'Обыкновенная дробь, десятичная дробь и процент — это три записи одного числа, а не три вида чисел. Поэтому любой перевод — одно действие, а не вычисление, которое каждый раз выводят заново: делят, чтобы уйти от обыкновенной дроби, умножают на сто, чтобы получить проценты, и обращают то или другое, чтобы вернуться.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“Write … as a decimal” and “write … as a percentage” ask for a notation, not a calculation, and answering in the other notation loses the mark on correct work. “In its lowest terms” means cancel until nothing cancels. “Of” between a percentage and a quantity means multiply. “To two decimal places” says where to round, and rounding earlier changes the digits that are checked.',
        '«Write … as a decimal» и «write … as a percentage» требуют записи, а не вычисления, и ответ в другой записи теряет балл при верном решении. «In its lowest terms» значит сокращать, пока сокращается. «Of» между процентом и величиной означает умножение. «To two decimal places» указывает, где округлять, и более раннее округление меняет как раз те цифры, которые проверяются.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'in its lowest terms — в несократимом виде; decimal place — знак после запятой; of — от, в смысле умножения.',
        'in its lowest terms — в несократимом виде; decimal place — знак после запятой; of — от, в смысле умножения.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'p percent is p ÷ 100 written as a decimal, and the same value as a fraction once it is cancelled. Going the other way, a decimal becomes a percentage by multiplying by 100.',
        'p процентов — это p ÷ 100 в виде десятичной дроби и то же значение в виде обыкновенной дроби после сокращения. В обратную сторону десятичная дробь становится процентами умножением на 100.',
      ), { katex: ['p\\% = \\frac{p}{100} = d'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        'Write 7/20 as a decimal and as a percentage.\n\nA fraction is a division, so the decimal comes from dividing: 7 ÷ 20 = 0.35. Do not stop at the whole part; the division continues past the point until it terminates or the question says where to round.\n\nThe percentage is that decimal multiplied by a hundred: 0.35 × 100 = 35, so the answer is 35%. Notice that nothing was recalculated between the two answers — the second is the first with the point moved.\n\nCheck by going back: 35 ÷ 100 = 0.35, and 0.35 as a fraction is 35/100, which cancels to 7/20. Landing on the fraction you started from is the check.',
        'Запишите 7/20 в виде десятичной дроби и в виде процентов.\n\nОбыкновенная дробь — это деление, поэтому десятичная запись получается делением: 7 ÷ 20 = 0.35. Не останавливайтесь на целой части: деление продолжается за запятой, пока не завершится или пока задание не укажет, где округлить.\n\nПроценты — это та же десятичная дробь, умноженная на сто: 0.35 × 100 = 35, то есть 35%. Обратите внимание: между двумя ответами ничего не пересчитывали — второй это первый со сдвинутой запятой.\n\nПроверка обратным ходом: 35 ÷ 100 = 0.35, а 0.35 в виде дроби это 35/100, что сокращается до 7/20. Возврат к исходной дроби и есть проверка.',
      ), { estimatedMinutes: 4 }),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        'Write 0.6 as a fraction in its lowest terms. First: what does the last digit tell you the denominator is? Second: write the fraction with that denominator before cancelling anything. Third: cancel by the largest common factor you can see, then check nothing is left to cancel. Fourth: reverse the conversion and see whether you get 0.6 back.',
        'Запишите 0.6 в виде несократимой дроби. Первое: что последняя цифра говорит о знаменателе? Второе: запишите дробь с этим знаменателем до всякого сокращения. Третье: сократите на наибольший общий множитель, который видите, и проверьте, что сокращать больше нечего. Четвёртое: выполните обратный перевод и посмотрите, получится ли 0.6.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'Write 9/40 as a decimal, then as a percentage. Write 0.7 as a percentage and as a fraction in its lowest terms. Write 45% as a fraction in its lowest terms. For each one, say the notation the question asked for before you write the answer down.',
        'Запишите 9/40 в виде десятичной дроби, затем в процентах. Запишите 0.7 в процентах и в виде несократимой дроби. Запишите 45% в виде несократимой дроби. В каждом случае сначала назовите запись, которую требует задание, и только потом записывайте ответ.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'The options in this cell usually include the right number in the wrong notation, and the right digits with the point in the wrong place. Both look like your answer at a glance, so read the last few words of the question again before choosing: they, not the arithmetic, decide which option is correct. An uncancelled fraction is also a common trap where the cancelled form is present as well.',
        'Варианты в этой ячейке обычно содержат верное число в неверной записи и верные цифры со сдвинутой запятой. Оба на первый взгляд похожи на ваш ответ, поэтому перечитайте последние слова задания перед выбором: именно они, а не вычисления, определяют верный вариант. Несокращённая дробь — ещё одна частая ловушка, когда сокращённая форма тоже присутствует.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Three conversions in two minutes. Say the target notation out loud before each one. The conversions themselves take seconds; naming the target is what stops the wrong-notation answer, and it costs nothing.',
        'Три перевода за две минуты. Перед каждым проговорите вслух нужную запись. Сами переводы занимают секунды; именно называние цели предотвращает ответ в неверной записи и ничего не стоит.',
      ), { estimatedMinutes: 2 }),
    ],
    vocabularyIds: ['vocab-lowest-terms', 'vocab-decimal-place', 'vocab-of'],
    formulaIds: ['formula-percent-decimal-fraction'],
    prerequisiteLessonIds: [],
    ...draftMeta(),
  }),
  LessonSchema.parse({
    id: 'lesson-math-foundation-estimate-magnitude',
    topicId: 'math-foundation',
    subject: 'mathematics',
    title: text('Estimating, and knowing when that is the answer', 'Оценка и понимание того, когда она и есть ответ'),
    summary: text(
      'Round each number to one significant figure, work with the powers of ten separately, and choose the option nearest the result.',
      'Округлить каждое число до одной значащей цифры, отдельно разобраться со степенями десяти и выбрать вариант, ближайший к результату.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need to multiply and divide powers of ten by adding and subtracting their exponents, and to round a number to one significant figure. Both are single steps; if either is not automatic, that is what to practise before the estimating itself.',
        'Нужно уметь умножать и делить степени десяти, складывая и вычитая показатели, и округлять число до одной значащей цифры. И то, и другое — одно действие; если что-то из этого не доведено до автоматизма, тренируйте именно это, а не саму оценку.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Round the digits and handle the powers of ten separately, arrive at an estimate in one line, and recognise when a question is asking for an estimate rather than a value — including when computing exactly would be the slower way to get the mark.',
        'Отдельно округлять цифры и отдельно работать со степенями десяти, получать оценку в одну строку и распознавать, когда задание просит именно оценку, а не значение — в том числе когда точное вычисление окажется более долгим способом получить балл.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'An estimate is not a worse answer given in a hurry. When the options are an order of magnitude apart, the digits do not decide anything and only the power of ten does, so rounding hard is exactly the right move rather than a concession. Splitting a number into its digits and its power of ten turns one awkward calculation into two easy ones.',
        'Оценка — это не худший ответ, полученный второпях. Когда варианты отличаются на порядок, цифры ничего не решают, решает только степень десяти, и поэтому грубое округление — именно верный ход, а не уступка. Разделение числа на цифры и степень десяти превращает одно неудобное вычисление в два простых.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“Without computing exactly” and “which is closest to” are instructions, not encouragement: they say the mark is for the nearest option, and an exact answer that misses the point of the question still has to be matched to one. “Approximately” and “roughly” mean the same thing here. “Order of magnitude” refers to the power of ten, not to the digits in front of it.',
        '«Without computing exactly» и «which is closest to» — это указания, а не поощрение: они сообщают, что балл даётся за ближайший вариант, и точный ответ всё равно придётся сопоставлять с вариантом. «Approximately» и «roughly» здесь означают то же самое. «Order of magnitude» относится к степени десяти, а не к стоящим перед ней цифрам.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'estimate — оценить; order of magnitude — порядок величины; significant figure — значащая цифра.',
        'estimate — оценить; order of magnitude — порядок величины; significant figure — значащая цифра.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'Standard form writes a number as one digit before the point times a power of ten. Multiplying adds the exponents and dividing subtracts them, so the size of the answer is settled before any digits are multiplied.',
        'Стандартный вид записывает число как одну цифру до запятой, умноженную на степень десяти. При умножении показатели складываются, при делении вычитаются, поэтому величина ответа определяется ещё до умножения цифр.',
      ), { katex: ['x = a \\times 10^{n},\\quad 1 \\le a < 10'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        'Estimate (6.1 × 10⁵) ÷ (2.9 × 10²).\n\nSplit the problem. The digits first, rounded hard: 6 ÷ 3 = 2. Then the powers of ten, where division subtracts the exponents: 10⁵ ÷ 10² = 10³. Put them together for about 2 × 10³.\n\nThat is the whole calculation, and it is deliberately crude. Rounding 2.9 up to 3 makes the quotient slightly small, so the true value is a little above the estimate — enough to choose between options a power of ten apart, and not enough to choose between options that differ in the second digit. If a question offers you the latter, it is not asking for an estimate.',
        'Оцените (6.1 × 10⁵) ÷ (2.9 × 10²).\n\nРазделите задачу. Сначала цифры, округляя грубо: 6 ÷ 3 = 2. Затем степени десяти, где при делении показатели вычитаются: 10⁵ ÷ 10² = 10³. Вместе получается около 2 × 10³.\n\nЭто всё вычисление, и оно намеренно грубое. Округление 2.9 до 3 немного занижает частное, поэтому истинное значение чуть больше оценки — этого хватает, чтобы выбрать между вариантами, отличающимися на порядок, и не хватает, чтобы выбрать между вариантами, отличающимися во второй цифре. Если задание предлагает второе, оно просит не оценку.',
      ), { estimatedMinutes: 4 }),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        'Estimate 397 × 0.0021. First: write each number in standard form before rounding anything. Second: round each set of digits to one significant figure. Third: combine the powers of ten by adding the exponents. Fourth: check the sign of the exponent against common sense — multiplying by a number below one must make the result smaller.',
        'Оцените 397 × 0.0021. Первое: запишите каждое число в стандартном виде до всякого округления. Второе: округлите цифры каждого до одной значащей. Третье: объедините степени десяти, сложив показатели. Четвёртое: сверьте знак показателя со здравым смыслом: умножение на число меньше единицы обязано уменьшить результат.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'Estimate 78 × 0.49, then (8.2 × 10⁶) ÷ (3.9 × 10³), then 0.62 ÷ 0.031. For each, write the estimate before doing anything exact, and then say whether your rounding made the answer slightly too large or slightly too small.',
        'Оцените 78 × 0.49, затем (8.2 × 10⁶) ÷ (3.9 × 10³), затем 0.62 ÷ 0.031. В каждом случае сначала запишите оценку и только потом что-либо точное, а затем скажите, завысило ваше округление ответ или занизило.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'The distractors here are almost always the right digits with the wrong power of ten, because that is what an exponent slip produces. So settle the power of ten first and use it to eliminate: usually only one option survives, and the digits never have to be checked at all. Reaching for exact arithmetic in this cell costs time and does not protect against the mistake the options are built from.',
        'Неверные варианты здесь почти всегда содержат верные цифры с неверной степенью десяти, потому что именно это даёт ошибка в показателе. Поэтому сначала определяйте степень десяти и отсеивайте по ней: обычно остаётся один вариант, и цифры проверять вообще не приходится. Точная арифметика в этой ячейке стоит времени и не защищает от той ошибки, из которой построены варианты.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Three estimates in ninety seconds. That budget is the point: it is short enough that exact arithmetic will not fit, which is the habit this cell is training. Write only the power of ten first for all three, then the digits.',
        'Три оценки за девяносто секунд. Этот лимит и есть суть: он слишком мал для точных вычислений, и именно эту привычку тренирует ячейка. Сначала запишите только степень десяти для всех трёх, затем цифры.',
      ), { estimatedMinutes: 2 }),
    ],
    vocabularyIds: ['vocab-estimate', 'vocab-order-of-magnitude', 'vocab-significant-figure'],
    formulaIds: ['formula-standard-form'],
    prerequisiteLessonIds: [],
    ...draftMeta(),
  }),
  LessonSchema.parse({
    id: 'lesson-math-linear-isolate-unknown',
    topicId: 'math-linear',
    subject: 'mathematics',
    title: text('Isolating the unknown in one step', 'Выражаем неизвестное за один шаг'),
    summary: text(
      'Undo the single operation applied to the unknown, doing the same to both sides.',
      'Отменить единственную операцию, применённую к неизвестному, сделав одно и то же с обеими частями.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need to add and subtract negative numbers reliably, and to know that multiplication and division are inverses. If a signed subtraction is still slow, do the number foundations cell first.',
        'Нужно уверенно складывать и вычитать отрицательные числа и знать, что умножение и деление — взаимно обратные операции. Если вычитание со знаками ещё даётся медленно, сначала пройдите ячейку числовых основ.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Name the operation applied to the unknown, apply its inverse to both sides, and check the result by substitution.',
        'Назвать операцию, применённую к неизвестному, применить обратную к обеим частям и проверить результат подстановкой.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'An equation is a balance. Whatever you do to one side you must do to the other, or the balance breaks. To find the unknown, undo what was done to it.',
        'Уравнение — это равновесие. Что сделано с одной частью, должно быть сделано и с другой, иначе равновесие нарушится. Чтобы найти неизвестное, отмените то, что с ним сделали.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“Solve for x” means find the value of x. “Isolate x” means get x alone. Both ask for the same work.',
        '«Solve for x» значит найти значение x. «Isolate x» значит оставить x одно. Оба задания требуют одного и того же.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'isolate — выразить; inverse operation — обратная операция; both sides — обе части.',
        'isolate — выразить; inverse operation — обратная операция; both sides — обе части.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'If x + b = c then x = c − b. If ax = c then x = c ÷ a.',
        'Если x + b = c, то x = c − b. Если ax = c, то x = c ÷ a.',
      ), { katex: ['x + b = c \\iff x = c - b', 'ax = c \\iff x = \\frac{c}{a}'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        'Solve x + 6 = 2. Six was added to x, so subtract six from both sides: x = 2 − 6 = −4. Check: −4 + 6 = 2. Correct.',
        'Решите x + 6 = 2. К x прибавили шесть, значит вычитаем шесть из обеих частей: x = 2 − 6 = −4. Проверка: −4 + 6 = 2. Верно.',
      )),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        'Solve 7x = 42. First: what was done to x? Second: what undoes it? Third: apply it to both sides. Fourth: substitute your answer back.',
        'Решите 7x = 42. Первое: что сделали с x? Второе: что это отменяет? Третье: примените это к обеим частям. Четвёртое: подставьте ответ обратно.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'Solve x − 12 = −3, then 5x = −40. Check each by substitution before looking at the solution.',
        'Решите x − 12 = −3, затем 5x = −40. Проверьте каждое подстановкой, прежде чем смотреть решение.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'The prompt is in English and the options are values, not steps. Read what is asked, solve, then match your value to an option rather than choosing what looks familiar.',
        'Задание на английском, а варианты — значения, а не шаги. Прочитайте вопрос, решите, затем сопоставьте своё значение с вариантом, а не выбирайте знакомое на вид.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Three one-step equations in two minutes. Accuracy first: a checked answer beats a fast wrong one.',
        'Три одношаговых уравнения за две минуты. Сначала точность: проверенный ответ лучше быстрого неверного.',
      ), { estimatedMinutes: 2 }),
    ],
    vocabularyIds: ['vocab-isolate', 'vocab-inverse-operation', 'vocab-both-sides'],
    formulaIds: ['formula-one-step-linear'],
    prerequisiteLessonIds: [],
    ...draftMeta(),
  }),
  LessonSchema.parse({
    id: 'lesson-math-linear-multi-step-linear',
    topicId: 'math-linear',
    subject: 'mathematics',
    title: text('When the unknown is on both sides', 'Когда неизвестное в обеих частях'),
    summary: text(
      'Clear brackets and fractions first, gather the unknowns on one side, then finish with a single inverse operation.',
      'Сначала раскрыть скобки и убрать дроби, затем собрать неизвестные в одной части и закончить одной обратной операцией.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need the one-step method: name the operation applied to the unknown and apply its inverse to both sides. If that is not automatic yet, do the isolating-the-unknown cell first, because every question here ends with exactly that move.',
        'Нужен одношаговый метод: назвать операцию, применённую к неизвестному, и применить обратную к обеим частям. Если это ещё не доведено до автоматизма, сначала пройдите ячейку «выразить неизвестное»: каждое задание здесь заканчивается именно этим действием.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Expand a bracket correctly, clear a fraction by multiplying every term, collect the unknowns on one side, and check the result by substituting it into the original equation rather than into your own rearrangement.',
        'Правильно раскрывать скобку, убирать дробь умножением каждого слагаемого, собирать неизвестные в одной части и проверять результат подстановкой в исходное уравнение, а не в собственное преобразование.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'A multi-step equation is a one-step equation you have not finished tidying. The work is not new: it is the same balance, with brackets and fractions cleared first so that only one operation is left standing between you and the unknown.',
        'Многошаговое уравнение — это одношаговое, которое ещё не привели в порядок. Ничего нового: то же равновесие, только сначала убирают скобки и дроби, чтобы между вами и неизвестным осталась ровно одна операция.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“Expand” means multiply out a bracket. “Collect like terms” means add together the terms that share the same letter part. “Hence” in a CSCA prompt means use the result you have just found, not start again.',
        '«Expand» значит раскрыть скобку. «Collect like terms» значит сложить слагаемые с одинаковой буквенной частью. «Hence» в задании CSCA значит использовать только что найденный результат, а не начинать заново.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'like terms — подобные слагаемые; expand — раскрыть скобки; common denominator — общий знаменатель.',
        'like terms — подобные слагаемые; expand — раскрыть скобки; common denominator — общий знаменатель.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'Once every bracket and fraction is cleared, ax + b = cx + d gives x = (d − b) ÷ (a − c). If a equals c the unknowns cancel: the equation is then true for every x, or for none.',
        'Когда скобки и дроби убраны, из ax + b = cx + d следует x = (d − b) ÷ (a − c). Если a = c, неизвестные сокращаются: уравнение верно либо при любом x, либо ни при каком.',
      ), { katex: ['ax + b = cx + d \\iff x = \\frac{d - b}{a - c}'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        'Solve 8x − 5 = 3x + 20. There is no bracket and no fraction, so gather the unknowns: subtract 3x from both sides to get 5x − 5 = 20. Now one operation stands between you and the unknown twice over, so add 5 to both sides for 5x = 25, then divide by 5 for x = 5. Check in the original: the left side is 8(5) − 5 = 35 and the right side is 3(5) + 20 = 35. Equal, so the answer stands.',
        'Решите 8x − 5 = 3x + 20. Скобок и дробей нет, поэтому собираем неизвестные: вычитаем 3x из обеих частей и получаем 5x − 5 = 20. Теперь до неизвестного остаётся дважды по одной операции: прибавляем 5 к обеим частям, получаем 5x = 25, и делим на 5, получаем x = 5. Проверка в исходном уравнении: слева 8(5) − 5 = 35, справа 3(5) + 20 = 35. Равно, значит ответ верен.',
      ), { estimatedMinutes: 4 }),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        'Solve 5(x − 1) = 2x + 16. First: expand the bracket, and multiply both terms inside it, not only the x. Second: gather the unknowns on the side that keeps the coefficient positive. Third: undo what is left, one operation at a time. Fourth: substitute into the original equation, brackets and all.',
        'Решите 5(x − 1) = 2x + 16. Первое: раскройте скобку, умножив оба слагаемых внутри, а не только x. Второе: соберите неизвестные там, где коэффициент останется положительным. Третье: отменяйте оставшееся по одной операции. Четвёртое: подставьте в исходное уравнение вместе со скобкой.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'Solve 7x + 2 = 4x + 20, then 2(3x − 1) = 4x + 12, then (x + 9)/2 = x − 3. For the last one, multiply every term by 2 before anything else — including the term that has no fraction. Check each by substitution before looking at the solution.',
        'Решите 7x + 2 = 4x + 20, затем 2(3x − 1) = 4x + 12, затем (x + 9)/2 = x − 3. В последнем сначала умножьте на 2 каждое слагаемое, включая то, где дроби нет. Проверяйте каждое подстановкой, прежде чем смотреть решение.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'The distractors are built from the two mistakes that cost most marks: a sign lost when a term crosses the equals sign, and a bracket expanded onto its first term only. Both give a whole number that is sitting there in the options, so an answer looking plausible is not evidence that it is right. Substitute before you choose.',
        'Неверные варианты построены на двух ошибках, которые чаще всего стоят баллов: потерянный знак при переносе через равенство и скобка, раскрытая только на первое слагаемое. Обе дают целое число, которое уже есть среди вариантов, поэтому правдоподобный вид ответа ничего не доказывает. Подставляйте до того, как выбрать.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Three equations with the unknown on both sides, in four minutes. One of them has a bracket. Substitute your answer back even when the clock is running: an unchecked answer here is worth what an unanswered one is.',
        'Три уравнения с неизвестным в обеих частях за четыре минуты. В одном есть скобка. Подставляйте ответ обратно, даже когда идёт время: непроверенный ответ здесь стоит столько же, сколько неотвеченный.',
      ), { estimatedMinutes: 4 }),
    ],
    vocabularyIds: ['vocab-like-terms', 'vocab-expand', 'vocab-common-denominator'],
    formulaIds: ['formula-multi-step-linear'],
    prerequisiteLessonIds: ['lesson-math-linear-isolate-unknown'],
    ...draftMeta(),
  }),
  LessonSchema.parse({
    id: 'lesson-math-linear-linear-word-problem',
    topicId: 'math-linear',
    subject: 'mathematics',
    title: text('Turning a sentence into an equation', 'Превращаем условие в уравнение'),
    summary: text(
      'Name the unknown with its unit, translate each phrase into one term, solve, then answer the question that was actually asked.',
      'Назвать неизвестное вместе с единицей, перевести каждую фразу в одно слагаемое, решить и ответить именно на заданный вопрос.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need to solve an equation with the unknown on both sides without thinking about it, because here the solving is the easy half. If clearing a bracket or a fraction still takes attention, do the multi-step cell first.',
        'Нужно уметь решать уравнение с неизвестным в обеих частях не задумываясь: здесь решение — самая простая половина работы. Если раскрытие скобки или дроби ещё требует внимания, сначала пройдите многошаговую ячейку.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Write down what the unknown stands for and in what unit, turn each phrase of the sentence into one term of an equation, solve it, and then check the answer against the sentence rather than against your own working.',
        'Записать, что обозначает неизвестное и в каких единицах, превратить каждую фразу условия в одно слагаемое уравнения, решить его и проверить ответ по условию, а не по собственным выкладкам.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'A word problem is a translation task with a small piece of algebra at the end. Most marks are lost in the translation, not in the algebra: a rate read as a one-off charge, or an answer given for the wrong quantity. So the equation is written slowly and solved quickly, not the other way round.',
        'Текстовая задача — это перевод, в конце которого немного алгебры. Больше всего баллов теряется на переводе, а не на алгебре: тариф принимают за разовую плату или отвечают не на тот вопрос. Поэтому уравнение записывают медленно, а решают быстро, а не наоборот.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“Per” means for each one, so it multiplies. “Fixed”, “flat” and “standing” all mean paid once, so they add. “In total” marks the value the whole equation equals. “How many” expects a count, so a fractional answer is a signal that something was mistranslated, not a number to round.',
        '«Per» значит за каждый, поэтому это умножение. «Fixed», «flat», «standing» значат «платится один раз», поэтому это прибавление. «In total» указывает величину, которой равно всё уравнение. «How many» ожидает счёт, поэтому дробный ответ — признак ошибки перевода, а не число для округления.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'per — за каждый; fixed charge — фиксированная плата; let x be — пусть x — это.',
        'per — за каждый; fixed charge — фиксированная плата; let x be — пусть x — это.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'When a total is one fixed amount plus one amount for each unit, T = f + rn, so n = (T − f) ÷ r. Subtract the fixed part before dividing, never after.',
        'Когда итог складывается из фиксированной суммы и суммы за каждую единицу, T = f + rn, откуда n = (T − f) ÷ r. Фиксированную часть вычитают до деления, а не после.',
      ), { katex: ['T = f + rn \\iff n = \\frac{T - f}{r}'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        'A phone plan costs 900 tenge each month plus 45 tenge for every minute of calls. One month the bill is 3150 tenge. How many minutes were called?\n\nLet m be the number of minutes called. The monthly 900 is paid once, so it is a constant; the 45 is charged for every minute, so it multiplies m. That gives 900 + 45m = 3150. Subtract the fixed part first: 45m = 2250, so m = 50.\n\nCheck against the sentence, not the working: 900 + 45 × 50 = 900 + 2250 = 3150, and 50 is a whole number of minutes, which the question expects.',
        'Тарифный план стоит 900 тенге в месяц плюс 45 тенге за каждую минуту разговора. За месяц счёт составил 3150 тенге. Сколько минут проговорили?\n\nПусть m — число минут. Ежемесячные 900 платятся один раз, значит это свободный член; 45 берут за каждую минуту, значит это множитель при m. Получаем 900 + 45m = 3150. Сначала вычитаем фиксированную часть: 45m = 2250, откуда m = 50.\n\nПроверяем по условию, а не по выкладкам: 900 + 45 × 50 = 900 + 2250 = 3150, и 50 — целое число минут, как и ожидает вопрос.',
      ), { estimatedMinutes: 5 }),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        'A printer charges a setup fee and then a price for each page. Setting up costs 1400 tenge, each page costs 35 tenge, and an order comes to 4200 tenge. First: write what your unknown stands for, with its unit. Second: decide for each number whether it is paid once or for each page. Third: write the equation before doing any arithmetic. Fourth: solve it, then read the question again and answer that.',
        'Типография берёт плату за подготовку и затем цену за каждую страницу. Подготовка стоит 1400 тенге, страница — 35 тенге, заказ вышел на 4200 тенге. Первое: запишите, что обозначает ваше неизвестное и в каких единицах. Второе: для каждого числа решите, платится оно один раз или за каждую страницу. Третье: запишите уравнение до любых вычислений. Четвёртое: решите его, затем перечитайте вопрос и ответьте именно на него.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'A gym membership is 8000 tenge to join plus 2500 tenge each month, and someone has paid 28000 tenge in total: how many months? A courier charges 600 tenge plus 90 tenge for each kilometre, and a delivery cost 2130 tenge: how far was it? In both, write the sentence naming your unknown before the equation, and state the unit in your answer.',
        'Абонемент в зал: 8000 тенге за вступление плюс 2500 тенге в месяц, всего уплачено 28000 тенге — сколько месяцев? Курьер берёт 600 тенге плюс 90 тенге за километр, доставка обошлась в 2130 тенге — какое расстояние? В обеих задачах сначала запишите предложение с неизвестным, потом уравнение, и укажите единицу в ответе.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'The distractor built from dividing the total without removing the fixed part is always present, and it is always close to the right answer, which is what makes it dangerous. So substitute back into the sentence: the wrong value fails the sentence even when it looks reasonable. Check the unit too — an option in the wrong unit is a common way to lose a mark on work that was correct.',
        'Вариант, полученный делением всего итога без вычитания фиксированной части, присутствует всегда и всегда близок к верному ответу — именно поэтому он опасен. Поэтому подставляйте обратно в условие: неверное значение не проходит проверку по условию, даже если выглядит правдоподобно. Проверяйте и единицу: вариант в неверной единице — частый способ потерять балл при верном решении.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Three fixed-plus-rate problems in five minutes. Write the equation for all three first, then solve all three. Separating translation from arithmetic is faster than alternating between them, and it is where the marks are.',
        'Три задачи вида «фиксированная часть плюс тариф» за пять минут. Сначала запишите уравнения для всех трёх, затем решите все три. Разделять перевод и вычисления быстрее, чем чередовать их, и именно там находятся баллы.',
      ), { estimatedMinutes: 5 }),
    ],
    vocabularyIds: ['vocab-per', 'vocab-fixed-charge', 'vocab-let-be'],
    formulaIds: ['formula-fixed-plus-rate'],
    prerequisiteLessonIds: ['lesson-math-linear-multi-step-linear'],
    ...draftMeta(),
  }),
  LessonSchema.parse({
    id: 'lesson-phys-units-si-base-derived',
    topicId: 'phys-units',
    subject: 'physics',
    title: text('Seven base units, and everything else built from them', 'Семь основных единиц и всё остальное, построенное из них'),
    summary: text(
      'Know the seven SI base quantities, and get any derived unit by reading the relation that defines it rather than by recalling a shape.',
      'Знать семь основных величин СИ и получать любую производную единицу, считывая определяющее соотношение, а не вспоминая её вид.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need to rearrange a simple relation, because deriving a unit is rearranging one with units in place of numbers. Nothing else is assumed; this cell comes before the conversion cell rather than after it.',
        'Нужно уметь преобразовывать простое соотношение: вывод единицы — это то же преобразование, только вместо чисел единицы. Больше ничего не требуется; эта ячейка идёт до ячейки о переводе, а не после неё.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Name the seven SI base quantities and their units, tell a base unit from a derived one, and write any derived unit in base units by starting from the relation that defines the quantity.',
        'Назвать семь основных величин СИ и их единицы, отличить основную единицу от производной и записать любую производную единицу в основных, начиная с соотношения, определяющего величину.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'The SI fixes seven quantities as base — length, mass, time, electric current, thermodynamic temperature, amount of substance and luminous intensity — and defines everything else from them. Which seven is a decision, not a discovery: charge feels more fundamental than current to most people who met it first, and the SI chose otherwise. So the list is learned, and everything after it is derived rather than learned.',
        'СИ фиксирует семь величин как основные — длину, массу, время, силу тока, термодинамическую температуру, количество вещества и силу света — и определяет через них всё остальное. Какие именно семь — это решение, а не открытие: заряд большинству, кто встретил его раньше, кажется более фундаментальным, чем ток, а СИ выбрала иначе. Поэтому список запоминают, а всё последующее выводят, а не запоминают.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“In terms of base units” asks for an expression such as kg·m/s², not for a sentence. “Amount of substance” is a count of entities and is not a synonym for mass, however much the English suggests it. “Derived” means defined from the base units, not “less important”: the joule and the volt are derived and are used constantly.',
        '«In terms of base units» требует выражения вроде кг·м/с², а не предложения. «Amount of substance» — это количество частиц, а не синоним массы, как бы ни подсказывал английский. «Derived» значит «определённая через основные», а не «менее важная»: джоуль и вольт производные и используются постоянно.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'base unit — основная единица; derived unit — производная единица; in terms of — выразив через.',
        'base unit — основная единица; derived unit — производная единица; in terms of — выразив через.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'Force is mass times acceleration, so the newton is a kilogram metre per second squared. That is the method rather than a fact to keep: start from the defining relation and substitute base units for the quantities in it.',
        'Сила равна массе, умноженной на ускорение, поэтому ньютон — это килограмм-метр на секунду в квадрате. Это метод, а не факт для запоминания: начните с определяющего соотношения и подставьте в него основные единицы вместо величин.',
      ), { katex: ['1\\,N = 1\\,kg \\cdot m \\cdot s^{-2}'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        'Express the watt in SI base units.\n\nStart from what a watt is: power is energy per unit time. So the base units of the watt are the base units of energy divided by the second.\n\nEnergy needs deriving in turn. Energy is force times distance, and force is mass times acceleration, so force is kg·m/s² and energy is that multiplied by a metre: kg·m²/s². Dividing by a second gives kg·m²/s³.\n\nCheck the chain rather than the result: each step used one defining relation and nothing recalled. If a step needed memory instead of a relation, that is the step to look at again.',
        'Выразите ватт в основных единицах СИ.\n\nНачните с того, что такое ватт: мощность — это энергия за единицу времени. Значит, основные единицы ватта — это основные единицы энергии, делённые на секунду.\n\nЭнергию, в свою очередь, тоже нужно вывести. Энергия — это сила, умноженная на расстояние, а сила — масса, умноженная на ускорение, поэтому сила это кг·м/с², а энергия — это же, умноженное на метр: кг·м²/с². Деление на секунду даёт кг·м²/с³.\n\nПроверяйте цепочку, а не результат: на каждом шаге использовалось одно определяющее соотношение и ничего вспомненного. Если какой-то шаг потребовал памяти вместо соотношения, именно к нему и стоит вернуться.',
      ), { estimatedMinutes: 5 }),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        'Express the pascal in SI base units. First: write the relation that defines pressure. Second: replace force by its own base units before doing anything with the area. Third: divide by the base units of area, and keep the whole denominator together. Fourth: read your expression aloud as a sentence and check it still says what pressure is.',
        'Выразите паскаль в основных единицах СИ. Первое: запишите соотношение, определяющее давление. Второе: замените силу её основными единицами, прежде чем что-либо делать с площадью. Третье: разделите на основные единицы площади и сохраните весь знаменатель целиком. Четвёртое: прочитайте выражение вслух как предложение и проверьте, что оно всё ещё говорит, что такое давление.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'Express the coulomb, the volt and the hertz in SI base units. Two of them need one relation each; one of them needs two. Before starting each, write the defining relation on its own line — the marks in this cell are lost in the relation, not in the algebra that follows it.',
        'Выразите кулон, вольт и герц в основных единицах СИ. Двум из них нужно по одному соотношению, одному — два. Перед каждым запишите определяющее соотношение отдельной строкой: баллы в этой ячейке теряются на соотношении, а не на алгебре после него.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'Every distractor here is a real physical quantity, not a scrambled expression: kg·m/s is momentum, kg·m²/s³ is power, kg/(m·s²) is pressure. That means a plausible-looking option is plausible because it is genuinely something, and recognising the shape cannot separate them. Derive the answer before reading the options, then match. Note too that energy and torque share base units — base units identify a combination, not a quantity, which is a limit of the method rather than a flaw in your working.',
        'Каждый неверный вариант здесь — реальная физическая величина, а не переставленное выражение: кг·м/с — импульс, кг·м²/с³ — мощность, кг/(м·с²) — давление. Поэтому правдоподобный вариант правдоподобен потому, что он действительно что-то означает, и распознавание по виду их не различит. Выводите ответ до того, как читать варианты, и только потом сопоставляйте. Заметьте также, что энергия и момент силы имеют одинаковые основные единицы: основные единицы определяют комбинацию, а не величину, и это ограничение метода, а не ошибка в ваших выкладках.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Two base-unit recognitions and two derivations in three minutes. The recognitions should take seconds — they are recall of the list of seven — so the time is really for the derivations. If a recognition is taking longer than a derivation, the list is what needs practice, not the method.',
        'Два вопроса на узнавание основных единиц и два вывода за три минуты. Узнавание должно занимать секунды, это воспроизведение списка из семи, поэтому время фактически отводится на выводы. Если узнавание занимает больше времени, чем вывод, тренировать нужно список, а не метод.',
      ), { estimatedMinutes: 3 }),
    ],
    vocabularyIds: ['vocab-base-unit', 'vocab-derived-unit', 'vocab-in-terms-of'],
    formulaIds: ['formula-newton-in-base-units'],
    prerequisiteLessonIds: [],
    ...draftMeta(),
  }),
  LessonSchema.parse({
    id: 'lesson-phys-units-unit-conversion-si',
    topicId: 'phys-units',
    subject: 'physics',
    title: text('Prefixes, base units and what a conversion actually changes', 'Приставки, основные единицы и что на самом деле меняет перевод'),
    summary: text(
      'Treat a prefix as a power of ten belonging to the unit, convert every base unit inside a derived one, and check the answer’s unit against the units that went into it.',
      'Считать приставку степенью десяти, относящейся к единице, переводить каждую основную единицу внутри производной и сверять единицу ответа с теми единицами, которые в него вошли.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need to multiply and divide by powers of ten without losing one, and to know which SI units are the base ones. The estimation cell in mathematics covers the first; the second is a list worth having in front of you rather than in memory while you work.',
        'Нужно уметь умножать и делить на степени десяти, не теряя их, и знать, какие единицы СИ являются основными. Первое разобрано в ячейке про оценку в математике; второе — список, который во время работы лучше держать перед глазами, а не в памяти.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Read a prefix as a power of ten, convert a quantity to its base unit without changing its digits, convert a derived unit by dealing with every base unit in it, and use the unit of an answer as a check on the working that produced it.',
        'Читать приставку как степень десяти, переводить величину в основную единицу, не меняя её цифр, переводить производную единицу, разобравшись с каждой входящей основной, и использовать единицу ответа как проверку выполненных действий.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'A prefix belongs to the unit, not to the number. Converting therefore moves a power of ten and leaves the digits exactly as they were — which is why a conversion that changes the digits is a signal to stop and look, not a result. The second half of the idea is that a derived unit is several units at once, so converting it means converting each of them; dealing with only the obvious one is the single most common way to be out by a factor of sixty or of a thousand.',
        'Приставка относится к единице, а не к числу. Поэтому перевод сдвигает степень десяти и оставляет цифры ровно такими, какими они были, — и если при переводе цифры изменились, это повод остановиться и проверить, а не результат. Вторая половина мысли: производная единица — это несколько единиц сразу, и переводить нужно каждую; работа только с очевидной из них — самый частый способ ошибиться в шестьдесят или в тысячу раз.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“Express this in …” asks for the same quantity written differently, so the value does not change and only its form does. “In SI base units” is stricter than “in SI units”: it rules out the litre, the hour and the tonne, all of which are accepted alongside SI but are not base units. “Per” in a unit is a division, so “metres per second” is m/s and never m·s.',
        '«Express this in …» просит записать ту же величину иначе: значение не меняется, меняется только форма. «In SI base units» строже, чем «in SI units»: это исключает литр, час и тонну, которые допускаются наряду с СИ, но основными единицами не являются. «Per» в названии единицы означает деление, поэтому «metres per second» — это м/с, а не м·с.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'prefix — приставка; base unit — основная единица; derived unit — производная единица.',
        'prefix — приставка; base unit — основная единица; derived unit — производная единица.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'A quantity in its base unit is the number as written times the power of ten the prefix stands for: q = a × 10ⁿ. This is not standard form — there the power is chosen to put one digit before the point, here it is fixed by the prefix.',
        'Величина в основной единице — это записанное число, умноженное на степень десяти, которую обозначает приставка: q = a × 10ⁿ. Это не стандартный вид: там степень подбирают, чтобы до запятой осталась одна цифра, а здесь она задана приставкой.',
      ), { katex: ['q = a \\times 10^{n}'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        'Express 15 mA in amperes, and 90 km/h in metres per second.\n\nThe first is one unit. Milli stands for 10⁻³, so 15 mA is 15 × 10⁻³ A, or 1.5 × 10⁻² A written in standard form. The digits 1 and 5 are still there; nothing about the current changed.\n\nThe second is a derived unit, so both halves need attention. Kilo on the top is 10³ metres, and an hour on the bottom is 3600 seconds. That gives 90 × 1000 ÷ 3600, which is 25 m/s.\n\nCheck the size rather than the arithmetic: metres per second should be a smaller number than kilometres per hour, because a second is a much shorter time than an hour, and 25 is smaller than 90. An answer that had grown would be wrong whatever the working looked like.',
        'Выразите 15 мА в амперах и 90 км/ч в метрах в секунду.\n\nПервое — одна единица. Милли обозначает 10⁻³, поэтому 15 мА — это 15 × 10⁻³ А, или 1.5 × 10⁻² А в стандартном виде. Цифры 1 и 5 остались на месте; сам ток не изменился.\n\nВторое — производная единица, поэтому внимания требуют обе части. Кило сверху — это 10³ метров, а час снизу — 3600 секунд. Получаем 90 × 1000 ÷ 3600, то есть 25 м/с.\n\nПроверяйте порядок, а не вычисления: метров в секунду должно быть меньше, чем километров в час, потому что секунда намного короче часа, и 25 меньше 90. Ответ, который вырос бы, был бы неверным независимо от того, как выглядят выкладки.',
      ), { estimatedMinutes: 5 }),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        'Express 350 μs in seconds, then express 5.4 kN in newtons. First: write down what each prefix stands for, before touching the number. Second: apply it and check that the digits are unchanged. Third: say whether the number should have grown or shrunk, and confirm it did. Fourth: write the answer in standard form, and notice that this is a second, separate step.',
        'Выразите 350 мкс в секундах, затем 5.4 кН в ньютонах. Первое: выпишите, что обозначает каждая приставка, до всяких действий с числом. Второе: примените её и проверьте, что цифры не изменились. Третье: скажите, должно число вырасти или уменьшиться, и убедитесь, что так и произошло. Четвёртое: запишите ответ в стандартном виде и обратите внимание, что это отдельный, второй шаг.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'Express 4.5 GHz in hertz, 18 cm in metres, and 54 km/h in metres per second. For the last one, write the conversion of the top and of the bottom on separate lines before combining them. Then state, for each answer, whether the number grew or shrank and why that is what you expected.',
        'Выразите 4.5 ГГц в герцах, 18 см в метрах и 54 км/ч в метрах в секунду. В последнем запишите перевод числителя и знаменателя на отдельных строках, прежде чем объединять. Затем для каждого ответа скажите, вырос он или уменьшился и почему именно этого вы и ожидали.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'Every option in this cell tends to carry the right digits, so reading the digits tells you nothing. What separates them is the power of ten, and each wrong one corresponds to a named slip: a prefix read as its neighbour, a conversion applied in the wrong direction, or only half of a derived unit converted. Decide the power of ten first and check the direction against common sense before looking at the options at all — otherwise the option that looks familiar is the one you have just computed wrongly.',
        'Почти все варианты в этой ячейке содержат верные цифры, поэтому по цифрам ничего не понять. Их различает степень десяти, и каждая неверная соответствует конкретной ошибке: приставку прочитали как соседнюю, перевод выполнили в обратную сторону или перевели только половину производной единицы. Определяйте степень десяти первой и сверяйте направление со здравым смыслом до того, как смотреть на варианты, иначе знакомым покажется именно тот, который вы только что посчитали неверно.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Four conversions in three minutes, two of them derived units. Write the prefix table at the top of the page first; it is not cheating and it is faster than recalling each one under time. The derived ones take about twice as long as the single-unit ones, so leave room for that rather than rushing the last.',
        'Четыре перевода за три минуты, два из них — производные единицы. Сначала выпишите таблицу приставок сверху страницы: это не списывание и это быстрее, чем вспоминать каждую под таймером. Производные занимают примерно вдвое больше времени, чем одиночные, поэтому заложите этот запас, а не торопитесь на последнем.',
      ), { estimatedMinutes: 3 }),
    ],
    vocabularyIds: ['vocab-prefix', 'vocab-base-unit', 'vocab-derived-unit'],
    formulaIds: ['formula-si-prefix'],
    prerequisiteLessonIds: [],
    ...draftMeta(),
  }),
  LessonSchema.parse({
    id: 'lesson-phys-thermodynamics-heat-transfer',
    topicId: 'phys-thermodynamics',
    subject: 'physics',
    title: text('Heat, mass and temperature change', 'Теплота, масса и изменение температуры'),
    summary: text(
      'Use Q = mcΔT, and take ΔT as a difference rather than a final reading.',
      'Применять Q = mcΔT и брать ΔT как разность, а не как конечное показание.',
    ),
    sections: [
      section('prerequisites', 'big-idea', text('Before you start', 'Что нужно знать заранее'), text(
        'You need SI units and prefixes, and confident multiplication of decimals. Knowing that a change of one degree celsius equals a change of one kelvin will save you a step.',
        'Нужны единицы СИ и приставки, а также уверенное умножение десятичных дробей. Знание того, что изменение на один градус Цельсия равно изменению на один кельвин, сэкономит вам шаг.',
      )),
      section('objectives', 'big-idea', text('What you will be able to do', 'Чему вы научитесь'), text(
        'Identify m, c and ΔT in a worded problem, compute Q, and rearrange the relation to find c.',
        'Определить m, c и ΔT в текстовой задаче, вычислить Q и преобразовать соотношение для нахождения c.',
      )),
      section('big-idea', 'big-idea', text('The idea', 'Главная мысль'), text(
        'Warming something takes energy in proportion to three things: how much of it there is, what it is made of, and how far its temperature moves.',
        'Нагрев требует энергии пропорционально трём величинам: сколько вещества, из чего оно и насколько меняется его температура.',
      )),
      section('english', 'english', text('The English', 'Английский язык'), text(
        '“Raise its temperature by 20 K” is a change. “Heated to 100 °C” is a final value, and you must subtract the start. “Releases” means the object is cooling.',
        '«Raise its temperature by 20 K» — это изменение. «Heated to 100 °C» — конечное значение, и нужно вычесть начальное. «Releases» значит, что тело остывает.',
      )),
      section('vocabulary', 'vocabulary', text('Words', 'Слова'), text(
        'specific heat capacity — удельная теплоёмкость; temperature change — изменение температуры; released — отдаёт.',
        'specific heat capacity — удельная теплоёмкость; temperature change — изменение температуры; released — отдаёт.',
      )),
      section('formula', 'formula', text('The relation', 'Соотношение'), text(
        'Q = mcΔT, with Q in joules, m in kilograms, c in J/(kg·K) and ΔT in kelvin. Rearranged, c = Q ÷ (mΔT).',
        'Q = mcΔT, где Q в джоулях, m в килограммах, c в Дж/(кг·К) и ΔT в кельвинах. В преобразованном виде c = Q ÷ (mΔT).',
      ), { katex: ['Q = mc\\Delta T', 'c = \\frac{Q}{m\\Delta T}'] }),
      section('worked', 'worked-example', text('Worked example', 'Разобранный пример'), text(
        '0.30 kg of water, c = 4200 J/(kg·K), raised by 15 K. Q = 0.30 × 4200 × 15 = 18900 J = 18.9 kJ. Sanity check: water takes about 4.2 kJ per kilogram per kelvin, so 0.3 kg over 15 K is roughly 19 kJ.',
        '0,30 кг воды, c = 4200 Дж/(кг·К), нагрев на 15 К. Q = 0,30 × 4200 × 15 = 18900 Дж = 18,9 кДж. Проверка порядка: вода берёт около 4,2 кДж на килограмм на кельвин, значит 0,3 кг на 15 К — примерно 19 кДж.',
      )),
      section('guided', 'guided-practice', text('Guided practice', 'Практика с подсказками'), text(
        '0.20 kg of water goes from 20 °C to 100 °C. First: is 100 the change or the final value? Second: compute ΔT. Third: multiply m, c and ΔT. Fourth: convert to kilojoules.',
        '0,20 кг воды нагревают от 20 °C до 100 °C. Первое: 100 — это изменение или конечное значение? Второе: вычислите ΔT. Третье: перемножьте m, c и ΔT. Четвёртое: переведите в килоджоули.',
      )),
      section('independent', 'independent-practice', text('On your own', 'Самостоятельно'), text(
        'A 0.15 kg aluminium block, c = 900 J/(kg·K), cools from 120 °C to 30 °C. Find the energy released. Then rearrange to find c when 9200 J raises 0.40 kg by 50 K.',
        'Алюминиевый брусок 0,15 кг, c = 900 Дж/(кг·К), остывает от 120 °C до 30 °C. Найдите отданную энергию. Затем преобразуйте формулу и найдите c, если 9200 Дж нагревают 0,40 кг на 50 К.',
      )),
      section('csca', 'csca-style', text('In CSCA style', 'В стиле CSCA'), text(
        'Options are values with units. Check the unit of your answer against the options before choosing: a right number in the wrong unit is a wrong answer.',
        'Варианты — значения с единицами. Сверьте единицу своего ответа с вариантами перед выбором: верное число в неверной единице — неверный ответ.',
      )),
      section('speed', 'speed-round', text('Timed set', 'Набор на время'), text(
        'Four heat-transfer items in five minutes. Write m, c and ΔT down before calculating anything.',
        'Четыре задания на теплопередачу за пять минут. Выпишите m, c и ΔT до начала вычислений.',
      ), { estimatedMinutes: 5 }),
    ],
    vocabularyIds: ['vocab-specific-heat-capacity', 'vocab-temperature-change', 'vocab-released'],
    formulaIds: ['formula-heat-transfer'],
    prerequisiteLessonIds: [],
    ...draftMeta(),
  }),
]);

/** The blueprint cell each authored lesson teaches toward. */
export const SLICE_LESSON_CELL_IDS: Record<string, string> = {
  'lesson-phys-units-si-base-derived': 'phys-units-si-base-derived',
  'lesson-phys-units-unit-conversion-si': 'phys-units-unit-conversion-si',
  'lesson-math-foundation-estimate-magnitude': 'math-foundation-estimate-magnitude',
  'lesson-math-foundation-fraction-decimal-percent': 'math-foundation-fraction-decimal-percent',
  'lesson-math-foundation-integer-operations': 'math-foundation-integer-operations',
  'lesson-math-linear-isolate-unknown': 'math-linear-isolate-unknown',
  'lesson-math-linear-multi-step-linear': 'math-linear-multi-step-linear',
  'lesson-math-linear-linear-word-problem': 'math-linear-linear-word-problem',
  'lesson-phys-thermodynamics-heat-transfer': 'phys-thermodynamics-heat-transfer',
};
