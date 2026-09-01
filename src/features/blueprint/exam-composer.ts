/**
 * The blueprint-driven exam composer lives with the rest of the shared engine so
 * the server composes exams with exactly the code these tests exercise.
 */
export {
  composeExam,
  createBlueprintRandom,
  type ComposedQuestion,
  type ExamCompositionResult,
  type ExamCompositionSpec,
} from '../../../functions/src/blueprint-engine';
