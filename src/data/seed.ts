import {
  FormulaSchema,
  LessonSchema,
  TopicSchema,
  VocabularyEntrySchema,
  type Formula,
  type Lesson,
  type Question,
  type Topic,
  type VocabularyEntry,
} from "../domain";
import { generateQuestion } from "../lib/adaptive";
import {
  DISTANCE_AT_CONSTANT_SPEED_TEMPLATE,
  LINEAR_EQUATION_TEMPLATE,
  NEWTON_SECOND_LAW_TEMPLATE,
  SPEED_CONVERSION_TEMPLATE,
} from "./questionTemplates";

export const DEMO_CONTENT_DISCLAIMER =
  "Original CSCA-style practice created for this app. It is not an official CSCA question bank and is not endorsed by the exam provider.";

const SEED_TIMESTAMP = "2025-01-01T00:00:00.000Z";
const SEED_AUTHOR = "csca-prep-demo-seed";

function topic(input: Omit<Topic, "version" | "createdAt" | "updatedAt" | "createdBy" | "demo">): Topic {
  return TopicSchema.parse({
    ...input,
    demo: true,
    version: 1,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    createdBy: SEED_AUTHOR,
  });
}

export const DEMO_TOPICS: readonly Topic[] = Object.freeze([
  topic({
    id: "math-foundation",
    subject: "mathematics",
    parentId: null,
    slug: "foundation",
    title: { en: "Mathematics Foundation", ru: "Основы математики" },
    description: { en: "Core arithmetic and algebra needed for later CSCA topics.", ru: "Базовая арифметика и алгебра для последующих тем CSCA." },
    order: 0,
    prerequisiteTopicIds: [],
    estimatedMinutes: 300,
    status: "published",
  }),
  topic({
    id: "math-functions",
    subject: "mathematics",
    parentId: null,
    slug: "functions",
    title: { en: "Functions", ru: "Функции" },
    description: { en: "Domain, range, graphs, and function notation.", ru: "Область определения, значения, графики и обозначения функций." },
    order: 1,
    prerequisiteTopicIds: ["math-foundation"],
    estimatedMinutes: 420,
    status: "published",
  }),
  topic({
    id: "physics-units-si",
    subject: "physics",
    parentId: null,
    slug: "units-si",
    title: { en: "Units & SI", ru: "Единицы и СИ" },
    description: { en: "SI base units, prefixes, and reliable unit conversion.", ru: "Основные единицы СИ, приставки и перевод единиц." },
    order: 0,
    prerequisiteTopicIds: [],
    estimatedMinutes: 180,
    status: "published",
  }),
  topic({
    id: "physics-kinematics",
    subject: "physics",
    parentId: null,
    slug: "kinematics",
    title: { en: "Kinematics", ru: "Кинематика" },
    description: { en: "Describe motion using distance, displacement, speed, and time.", ru: "Описание движения с помощью пути, перемещения, скорости и времени." },
    order: 1,
    prerequisiteTopicIds: ["physics-units-si"],
    estimatedMinutes: 420,
    status: "published",
  }),
  topic({
    id: "physics-newtons-laws",
    subject: "physics",
    parentId: null,
    slug: "newtons-laws",
    title: { en: "Newton's Laws", ru: "Законы Ньютона" },
    description: { en: "Connect forces, mass, and changes in motion.", ru: "Связь сил, массы и изменения движения." },
    order: 2,
    prerequisiteTopicIds: ["physics-kinematics"],
    estimatedMinutes: 480,
    status: "published",
  }),
]);

function lessonSection(
  id: string,
  kind: Lesson["sections"][number]["kind"],
  title: string,
  body: string,
  extra: Partial<Lesson["sections"][number]> = {},
): Lesson["sections"][number] {
  return {
    id,
    kind,
    title: { en: title, ru: title },
    body: { en: body, ru: body },
    katex: [],
    estimatedMinutes: 2,
    ...extra,
  };
}

export const DEMO_LESSONS: readonly Lesson[] = Object.freeze([
  LessonSchema.parse({
    id: "lesson-physics-constant-speed-demo",
    topicId: "physics-kinematics",
    subject: "physics",
    title: { en: "Distance at Constant Speed", ru: "Путь при постоянной скорости" },
    summary: { en: "Understand when and how to use s = vt.", ru: "Когда и как применять s = vt." },
    sections: [
      lessonSection("big-idea", "big-idea", "Big Idea", "Speed tells you how much distance is covered in one unit of time."),
      lessonSection("visual", "visual", "Visual Explanation", "Imagine equal distance segments appearing every second.", {
        visual: {
          kind: "interactive",
          description: { en: "A dot advances equal distances each second along a labelled line.", ru: "Точка каждую секунду проходит одинаковый отрезок по размеченной линии." },
          componentKey: "constant-speed-line",
        },
      }),
      lessonSection("english", "english", "English", "‘Travels at a constant speed’ means the speed does not change."),
      lessonSection("vocabulary", "vocabulary", "Vocabulary", "distance — путь; speed — скорость; constant — постоянный"),
      lessonSection("formula", "formula", "Formula", "Distance equals speed multiplied by time.", { katex: ["s = vt"] }),
      lessonSection("worked", "worked-example", "Worked Example", "At 4 m/s for 3 s: s = 4 × 3 = 12 m."),
      lessonSection("guided", "guided-practice", "Guided Practice", "For 5 m/s and 2 s, identify v and t before multiplying."),
      lessonSection("independent", "independent-practice", "Independent Practice", "A runner moves at 6 m/s for 4 s. Find the distance."),
      lessonSection("csca", "csca-style", "CSCA-style", "Read the English prompt, identify the given values, then select the matching SI answer."),
      lessonSection("speed", "speed-round", "Speed Round", "Solve three constant-speed items in 90 seconds and check every unit."),
    ],
    vocabularyIds: ["vocab-distance", "vocab-at-rest"],
    formulaIds: ["formula-distance-constant-speed"],
    prerequisiteLessonIds: [],
    status: "published",
    demo: true,
    version: 1,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    createdBy: SEED_AUTHOR,
  }),
]);

export const DEMO_QUESTIONS: readonly Question[] = Object.freeze([
  generateQuestion(DISTANCE_AT_CONSTANT_SPEED_TEMPLATE, { seed: "verified-demo-1", id: "demo-question-1", now: new Date(SEED_TIMESTAMP) }),
  generateQuestion(NEWTON_SECOND_LAW_TEMPLATE, { seed: "verified-demo-2", id: "demo-question-2", now: new Date(SEED_TIMESTAMP) }),
  generateQuestion(LINEAR_EQUATION_TEMPLATE, { seed: "verified-demo-3", id: "demo-question-3", now: new Date(SEED_TIMESTAMP) }),
  generateQuestion(SPEED_CONVERSION_TEMPLATE, { seed: "verified-demo-4", id: "demo-question-4", now: new Date(SEED_TIMESTAMP) }),
]);

export const DEMO_VOCABULARY: readonly VocabularyEntry[] = Object.freeze([
  VocabularyEntrySchema.parse({
    id: "vocab-determine",
    english: "determine",
    russian: "определить, найти",
    simpleExplanation: { en: "Find the requested value using the information given.", ru: "Найти требуемую величину по данным условия." },
    exampleSentence: "Determine the acceleration of the object.",
    category: "question-command",
    subject: "english",
    status: "published",
    demo: true,
    version: 1,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    createdBy: SEED_AUTHOR,
  }),
  VocabularyEntrySchema.parse({
    id: "vocab-at-rest",
    english: "at rest",
    russian: "в состоянии покоя",
    simpleExplanation: { en: "The object has zero velocity at that moment.", ru: "В этот момент скорость тела равна нулю." },
    exampleSentence: "The car starts from rest.",
    category: "physics",
    subject: "physics",
    status: "published",
    demo: true,
    version: 1,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    createdBy: SEED_AUTHOR,
  }),
]);

export const DEMO_FORMULAS: readonly Formula[] = Object.freeze([
  FormulaSchema.parse({
    id: "formula-distance-constant-speed",
    subject: "physics",
    topicId: "physics-kinematics",
    name: { en: "Distance at constant speed", ru: "Путь при постоянной скорости" },
    katex: "s = vt",
    calculates: { en: "Distance travelled at constant speed.", ru: "Путь при постоянной скорости." },
    variables: [
      { symbol: "s", meaning: { en: "distance", ru: "путь" }, siUnit: "m" },
      { symbol: "v", meaning: { en: "speed", ru: "скорость" }, siUnit: "m/s" },
      { symbol: "t", meaning: { en: "time", ru: "время" }, siUnit: "s" },
    ],
    limitations: { en: "Use this form only when speed is constant.", ru: "Используйте эту форму только при постоянной скорости." },
    status: "published",
    demo: true,
    version: 1,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    createdBy: SEED_AUTHOR,
  }),
]);

export interface SeedContent {
  topics: readonly Topic[];
  lessons: readonly Lesson[];
  questions: readonly Question[];
  vocabulary: readonly VocabularyEntry[];
  formulas: readonly Formula[];
  disclaimer: string | null;
}

/** Demo data is returned only when the caller opts in explicitly. */
export function getSeedContent(options: { includeDemo: boolean }): SeedContent {
  if (!options.includeDemo) {
    return { topics: [], lessons: [], questions: [], vocabulary: [], formulas: [], disclaimer: null };
  }
  return {
    topics: DEMO_TOPICS,
    lessons: DEMO_LESSONS,
    questions: DEMO_QUESTIONS,
    vocabulary: DEMO_VOCABULARY,
    formulas: DEMO_FORMULAS,
    disclaimer: DEMO_CONTENT_DISCLAIMER,
  };
}
