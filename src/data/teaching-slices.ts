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
  'lesson-math-linear-isolate-unknown': 'math-linear-isolate-unknown',
  'lesson-math-linear-multi-step-linear': 'math-linear-multi-step-linear',
  'lesson-phys-thermodynamics-heat-transfer': 'phys-thermodynamics-heat-transfer',
};
