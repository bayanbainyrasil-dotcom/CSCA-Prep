import type { ParameterizedQuestionTemplate, TemplateParameter } from "../lib/adaptive";

const VERIFIED_TEMPLATE_NOTE =
  "Original CSCA-style practice generated from a deterministic, code-reviewed template. It is not an official CSCA question.";

function integer(random: () => number, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

type DistanceParameters = Record<string, TemplateParameter> & {
  velocity: number;
  time: number;
};

export const DISTANCE_AT_CONSTANT_SPEED_TEMPLATE: ParameterizedQuestionTemplate<DistanceParameters> = {
  id: "tpl-physics-distance-vt-v1",
  subject: "physics",
  module: "Kinematics",
  topicId: "physics-kinematics",
  skill: "Calculate distance at constant speed",
  difficulty: 1,
  estimatedTime: 45,
  tags: ["demo", "kinematics", "distance", "constant-speed"],
  sourceType: "template-generated",
  sourceNote: VERIFIED_TEMPLATE_NOTE,
  demo: true,
  sample: (random) => ({
    velocity: integer(random, 2, 24),
    time: integer(random, 2, 15),
  }),
  solve: ({ velocity, time }) => velocity * time,
  formatAnswer: (answer) => `${formatNumber(Number(answer))} m`,
  distractors: ({ velocity, time }, answer) => [
    `${formatNumber(velocity + time)} m`,
    `${formatNumber(velocity / time)} m`,
    `${formatNumber(Number(answer) * 10)} m`,
    `${formatNumber(Number(answer) / 10)} m`,
    `${formatNumber(Math.abs(velocity - time))} m`,
  ],
  content: ({ velocity, time }, formattedAnswer) => ({
    question: `A body moves at a constant speed of ${velocity} m/s for ${time} seconds. What distance does it travel?`,
    questionTranslation: `Тело движется с постоянной скоростью ${velocity} м/с в течение ${time} секунд. Какое расстояние оно проходит?`,
    solution: `Use s = vt. Substitute the values: s = ${velocity} × ${time} = ${velocity * time} m.`,
    shortSolution: `s = vt = ${velocity} × ${time} = ${formattedAnswer}`,
    explanation: "At constant speed, distance equals speed multiplied by elapsed time.",
    formulas: ["s = vt"],
    vocabulary: ["constant speed", "distance", "travel"],
    commonMistakes: [
      { id: "add-v-and-t", description: "Adds speed and time instead of multiplying.", distractorIndex: 0 },
      { id: "divide-v-by-t", description: "Divides speed by time.", distractorIndex: 1 },
    ],
  }),
};

type NewtonParameters = Record<string, TemplateParameter> & {
  mass: number;
  acceleration: number;
};

export const NEWTON_SECOND_LAW_TEMPLATE: ParameterizedQuestionTemplate<NewtonParameters> = {
  id: "tpl-physics-newton-second-law-v1",
  subject: "physics",
  module: "Mechanics",
  topicId: "physics-newtons-laws",
  skill: "Apply Newton's second law",
  difficulty: 2,
  estimatedTime: 60,
  tags: ["demo", "force", "newton-second-law", "si-units"],
  sourceType: "template-generated",
  sourceNote: VERIFIED_TEMPLATE_NOTE,
  demo: true,
  sample: (random) => ({
    mass: integer(random, 2, 20),
    acceleration: integer(random, 2, 12),
  }),
  solve: ({ mass, acceleration }) => mass * acceleration,
  formatAnswer: (answer) => `${formatNumber(Number(answer))} N`,
  distractors: ({ mass, acceleration }, answer) => [
    `${formatNumber(mass + acceleration)} N`,
    `${formatNumber(mass / acceleration)} N`,
    `${formatNumber(Number(answer) * 10)} N`,
    `${formatNumber(Number(answer) / 10)} N`,
    `${formatNumber(Math.abs(mass - acceleration))} N`,
  ],
  content: ({ mass, acceleration }, formattedAnswer) => ({
    question: `A ${mass} kg object accelerates at ${acceleration} m/s². What is the resultant force on it?`,
    questionTranslation: `Тело массой ${mass} кг движется с ускорением ${acceleration} м/с². Чему равна результирующая сила?`,
    solution: `Newton's second law gives F = ma. Therefore F = ${mass} × ${acceleration} = ${formattedAnswer}.`,
    shortSolution: `F = ma = ${mass} × ${acceleration} = ${formattedAnswer}`,
    explanation: "The resultant force is the product of mass and acceleration when SI units are used.",
    formulas: ["F = ma"],
    vocabulary: ["accelerates", "resultant force", "mass"],
    commonMistakes: [
      { id: "add-m-and-a", description: "Adds mass and acceleration instead of multiplying.", distractorIndex: 0 },
      { id: "divide-m-by-a", description: "Divides mass by acceleration.", distractorIndex: 1 },
    ],
  }),
};

type LinearEquationParameters = Record<string, TemplateParameter> & {
  coefficient: number;
  constant: number;
  solution: number;
  rightSide: number;
};

export const LINEAR_EQUATION_TEMPLATE: ParameterizedQuestionTemplate<LinearEquationParameters> = {
  id: "tpl-math-linear-equation-v1",
  subject: "mathematics",
  module: "Foundation Algebra",
  topicId: "math-foundation",
  skill: "Solve a one-variable linear equation",
  difficulty: 1,
  estimatedTime: 50,
  tags: ["demo", "algebra", "linear-equation"],
  sourceType: "template-generated",
  sourceNote: VERIFIED_TEMPLATE_NOTE,
  demo: true,
  sample: (random) => {
    const coefficient = integer(random, 2, 9);
    const constant = integer(random, 1, 15);
    const solution = integer(random, 2, 15);
    return {
      coefficient,
      constant,
      solution,
      rightSide: coefficient * solution + constant,
    };
  },
  solve: ({ solution }) => solution,
  formatAnswer: (answer) => `x = ${formatNumber(Number(answer))}`,
  distractors: ({ coefficient, constant, solution, rightSide }) => [
    `x = ${solution + 1}`,
    `x = ${solution - 1}`,
    `x = ${formatNumber(rightSide / coefficient)}`,
    `x = ${formatNumber((rightSide + constant) / coefficient)}`,
    `x = ${formatNumber(rightSide - constant)}`,
  ],
  content: ({ coefficient, constant, solution, rightSide }, formattedAnswer) => ({
    question: `Solve the equation ${coefficient}x + ${constant} = ${rightSide}.`,
    questionTranslation: `Решите уравнение ${coefficient}x + ${constant} = ${rightSide}.`,
    solution: `Subtract ${constant} from both sides: ${coefficient}x = ${rightSide - constant}. Divide by ${coefficient}: ${formattedAnswer}.`,
    shortSolution: `${coefficient}x = ${rightSide - constant}, so ${formattedAnswer}`,
    explanation: `Use inverse operations in reverse order. The checked value ${solution} makes both sides equal.`,
    formulas: [`ax + b = c → x = (c - b) / a`],
    vocabulary: ["solve", "equation", "both sides"],
    commonMistakes: [
      { id: "off-by-one-plus", description: "Stops one above the solution.", distractorIndex: 0 },
      { id: "fails-subtract", description: "Divides before subtracting the constant.", distractorIndex: 2 },
    ],
  }),
};

type SpeedConversionParameters = Record<string, TemplateParameter> & {
  metresPerSecond: number;
  kilometresPerHour: number;
};

export const SPEED_CONVERSION_TEMPLATE: ParameterizedQuestionTemplate<SpeedConversionParameters> = {
  id: "tpl-physics-kmh-to-ms-v1",
  subject: "physics",
  module: "Units & SI",
  topicId: "physics-units-si",
  skill: "Convert km/h to m/s",
  difficulty: 1,
  estimatedTime: 35,
  tags: ["demo", "units", "conversion", "speed"],
  sourceType: "template-generated",
  sourceNote: VERIFIED_TEMPLATE_NOTE,
  demo: true,
  sample: (random) => {
    const metresPerSecond = integer(random, 2, 30);
    return {
      metresPerSecond,
      kilometresPerHour: metresPerSecond * 3.6,
    };
  },
  solve: ({ metresPerSecond }) => metresPerSecond,
  formatAnswer: (answer) => `${formatNumber(Number(answer))} m/s`,
  distractors: ({ metresPerSecond, kilometresPerHour }) => [
    `${formatNumber(kilometresPerHour)} m/s`,
    `${formatNumber(kilometresPerHour / 10)} m/s`,
    `${formatNumber(metresPerSecond * 10)} m/s`,
    `${formatNumber(metresPerSecond / 3.6)} m/s`,
    `${formatNumber(kilometresPerHour * 3.6)} m/s`,
  ],
  content: ({ metresPerSecond, kilometresPerHour }, formattedAnswer) => ({
    question: `Convert ${formatNumber(kilometresPerHour)} km/h to metres per second.`,
    questionTranslation: `Переведите ${formatNumber(kilometresPerHour)} км/ч в метры в секунду.`,
    solution: `Divide by 3.6: ${formatNumber(kilometresPerHour)} ÷ 3.6 = ${metresPerSecond}. Therefore the speed is ${formattedAnswer}.`,
    shortSolution: `${formatNumber(kilometresPerHour)} ÷ 3.6 = ${formattedAnswer}`,
    explanation: "One kilometre is 1000 metres and one hour is 3600 seconds, so km/h is divided by 3.6.",
    formulas: ["v(m/s) = v(km/h) / 3.6"],
    vocabulary: ["convert", "metres per second"],
    commonMistakes: [
      { id: "no-conversion", description: "Changes the unit label without changing the number.", distractorIndex: 0 },
      { id: "divide-by-ten", description: "Divides by 10 instead of 3.6.", distractorIndex: 1 },
    ],
  }),
};

export const VERIFIED_QUESTION_TEMPLATES = Object.freeze([
  DISTANCE_AT_CONSTANT_SPEED_TEMPLATE,
  NEWTON_SECOND_LAW_TEMPLATE,
  LINEAR_EQUATION_TEMPLATE,
  SPEED_CONVERSION_TEMPLATE,
] as const);

export { VERIFIED_TEMPLATE_NOTE };
