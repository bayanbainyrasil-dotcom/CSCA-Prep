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
  'lesson-math-foundation-integer-operations': 'math-foundation-integer-operations',
  'lesson-math-linear-isolate-unknown': 'math-linear-isolate-unknown',
  'lesson-math-linear-multi-step-linear': 'math-linear-multi-step-linear',
  'lesson-math-linear-linear-word-problem': 'math-linear-linear-word-problem',
  'lesson-phys-thermodynamics-heat-transfer': 'phys-thermodynamics-heat-transfer',
};
