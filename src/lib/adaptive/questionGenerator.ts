import {
  QuestionSchema,
  type Difficulty,
  type Question,
  type QuestionSourceType,
  type Subject,
} from "../../domain";

export type TemplateParameter = string | number | boolean;
export type TemplateParameters = Record<string, TemplateParameter>;

export interface QuestionTemplateContent {
  question: string;
  questionTranslation?: string;
  solution: string;
  shortSolution: string;
  explanation: string;
  formulas: string[];
  vocabulary: string[];
  commonMistakes: Array<{
    id: string;
    description: string;
    distractorIndex?: number;
  }>;
}

export interface ParameterizedQuestionTemplate<P extends TemplateParameters = TemplateParameters> {
  id: string;
  subject: Subject;
  module: string;
  topicId: string;
  skill: string;
  difficulty: Difficulty;
  estimatedTime: number;
  tags: string[];
  sourceType: Extract<QuestionSourceType, "template-generated" | "diagnostic">;
  sourceNote: string;
  demo: boolean;
  sample: (random: () => number) => P;
  solve: (parameters: P) => number | string;
  formatAnswer: (answer: number | string, parameters: P) => string;
  distractors: (parameters: P, correctAnswer: number | string) => string[];
  content: (parameters: P, formattedAnswer: string) => QuestionTemplateContent;
}

export interface GenerateQuestionOptions<P extends TemplateParameters> {
  seed?: number | string;
  parameters?: P;
  id?: string;
  now?: Date;
}

export interface TemplateValidationIssue {
  sample: number;
  message: string;
}

export interface TemplateValidationReport {
  templateId: string;
  valid: boolean;
  samplesChecked: number;
  issues: TemplateValidationIssue[];
}

function hashSeed(seed: number | string): number {
  if (typeof seed === "number") return (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** Deterministic Mulberry32 PRNG used only for content variation, never security. */
export function createSeededRandom(seed: number | string): () => number {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function stableParameterKey(parameters: TemplateParameters): string {
  return Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const swap = shuffled[swapIndex];
    if (current === undefined || swap === undefined) continue;
    shuffled[index] = swap;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

export function generateQuestion<P extends TemplateParameters>(
  template: ParameterizedQuestionTemplate<P>,
  options: GenerateQuestionOptions<P> = {},
): Question {
  const seed = options.seed ?? `${template.id}:${Date.now()}`;
  const random = createSeededRandom(seed);
  const parameters = options.parameters ?? template.sample(random);
  const correctValue = template.solve(parameters);
  if (typeof correctValue === "number" && !Number.isFinite(correctValue)) {
    throw new Error(`Template ${template.id} produced a non-finite answer`);
  }
  const correctText = template.formatAnswer(correctValue, parameters).trim();
  const distractors = template
    .distractors(parameters, correctValue)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== correctText);
  const uniqueDistractors = [...new Set(distractors)];
  if (uniqueDistractors.length < 3) {
    throw new Error(`Template ${template.id} must produce at least three unique distractors`);
  }

  const optionValues = shuffle(
    [
      { text: correctText, correct: true },
      ...uniqueDistractors.slice(0, 3).map((text) => ({ text, correct: false })),
    ],
    random,
  );
  const optionIds = ["A", "B", "C", "D"] as const;
  const optionsWithIds = optionValues.map((option, index) => ({
    id: optionIds[index],
    text: option.text,
  }));
  const correctIndex = optionValues.findIndex((option) => option.correct);
  const correctAnswer = optionIds[correctIndex];
  if (!correctAnswer) throw new Error(`Template ${template.id} did not produce a correct option`);
  const content = template.content(parameters, correctText);
  const now = options.now ?? new Date();
  const timestamp = now.toISOString();
  const parameterKey = stableParameterKey(parameters);

  return QuestionSchema.parse({
    id: options.id ?? `${template.id}:${hashSeed(`${seed}:${parameterKey}`).toString(36)}`,
    subject: template.subject,
    module: template.module,
    topicId: template.topicId,
    skill: template.skill,
    difficulty: template.difficulty,
    language: "en",
    question: content.question,
    ...(content.questionTranslation ? { questionTranslation: content.questionTranslation } : {}),
    options: optionsWithIds,
    correctAnswer,
    solution: content.solution,
    shortSolution: content.shortSolution,
    explanation: content.explanation,
    formulas: content.formulas,
    vocabulary: content.vocabulary,
    commonMistakes: content.commonMistakes.map((mistake) => ({
      id: mistake.id,
      description: mistake.description,
      ...(mistake.distractorIndex === undefined
        ? {}
        : { distractorOptionId: optionsWithIds.find((option) => option.text === uniqueDistractors[mistake.distractorIndex ?? -1])?.id }),
    })).map((mistake) => {
      if (mistake.distractorOptionId === undefined) {
        return { id: mistake.id, description: mistake.description };
      }
      return mistake;
    }),
    estimatedTime: template.estimatedTime,
    sourceType: template.sourceType,
    sourceNote: template.sourceNote,
    tags: template.tags,
    status: "published",
    demo: template.demo,
    templateId: template.id,
    templateParameters: parameters,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "verified-template-engine",
  });
}

export function validateQuestionTemplate<P extends TemplateParameters>(
  template: ParameterizedQuestionTemplate<P>,
  samples = 100,
): TemplateValidationReport {
  const issues: TemplateValidationIssue[] = [];
  const checked = Math.max(1, Math.trunc(samples));
  for (let sample = 0; sample < checked; sample += 1) {
    try {
      const question = generateQuestion(template, {
        seed: sample + 1,
        now: new Date("2025-01-01T00:00:00.000Z"),
      });
      const correct = question.options.find((option) => option.id === question.correctAnswer);
      if (!correct) throw new Error("Correct option is missing");
      const parameters = question.templateParameters as P;
      const independentlyFormatted = template.formatAnswer(template.solve(parameters), parameters);
      if (correct.text !== independentlyFormatted) {
        throw new Error("Stored answer differs from the template solver result");
      }
    } catch (error) {
      issues.push({
        sample,
        message: error instanceof Error ? error.message : "Unknown template validation error",
      });
    }
  }
  return {
    templateId: template.id,
    valid: issues.length === 0,
    samplesChecked: checked,
    issues,
  };
}

export function assertValidQuestionTemplate<P extends TemplateParameters>(
  template: ParameterizedQuestionTemplate<P>,
  samples = 100,
): void {
  const report = validateQuestionTemplate(template, samples);
  if (!report.valid) {
    const summary = report.issues.slice(0, 3).map((issue) => `sample ${issue.sample}: ${issue.message}`).join("; ");
    throw new Error(`Question template ${template.id} failed validation: ${summary}`);
  }
}
