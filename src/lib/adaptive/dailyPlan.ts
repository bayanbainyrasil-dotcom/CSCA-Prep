import { nanoid } from "nanoid";
import {
  DailyPlanSchema,
  type DailyPlan,
  type DailyPlanBlockKind,
  type Subject,
  type Topic,
  type TopicMastery,
} from "../../domain";
import { isReviewDue } from "./spacedRepetition";

interface CandidateBlock {
  kind: DailyPlanBlockKind;
  subject: Subject | null;
  title: string;
  topicIds: string[];
  weight: number;
  reason: string;
}

export interface AdaptiveDailyPlanInput {
  userId: string;
  date: string;
  timezone: string;
  targetMinutes: number;
  topics: Topic[];
  masteries: TopicMastery[];
  dueEnglishReviewCount?: number;
  now?: Date;
  idFactory?: () => string;
}

function comparePriority(left: TopicMastery, right: TopicMastery, now: Date): number {
  const leftOverdue = Math.max(0, now.getTime() - Date.parse(left.nextReviewAt));
  const rightOverdue = Math.max(0, now.getTime() - Date.parse(right.nextReviewAt));
  return rightOverdue - leftOverdue || left.score - right.score;
}

function allocateMinutes(weights: number[], totalMinutes: number): number[] {
  const minimum: number = totalMinutes >= weights.length * 5 ? 5 : 1;
  const allocations: number[] = weights.map(() => minimum);
  let remaining = totalMinutes - minimum * weights.length;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (remaining * weight) / totalWeight);
  exact.forEach((value, index) => {
    const whole = Math.floor(value);
    allocations[index] = (allocations[index] ?? 0) + whole;
    remaining -= whole;
  });
  const rankedRemainders = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder);
  for (let index = 0; index < remaining; index += 1) {
    const ranked = rankedRemainders[index % rankedRemainders.length];
    if (!ranked) continue;
    allocations[ranked.index] = (allocations[ranked.index] ?? 0) + 1;
  }
  return allocations;
}

function firstUnseenTopic(subject: Subject, topics: Topic[], masteryByTopic: Map<string, TopicMastery>): Topic | undefined {
  return topics
    .filter((topic) => topic.subject === subject && topic.status === "published" && !masteryByTopic.has(topic.id))
    .sort((left, right) => left.order - right.order)
    .find((topic) => topic.prerequisiteTopicIds.every((id) => (masteryByTopic.get(id)?.score ?? 0) >= 60));
}

/** Builds a concrete next-step plan rather than exposing raw analytics to the user. */
export function buildAdaptiveDailyPlan(input: AdaptiveDailyPlanInput): DailyPlan {
  const now = input.now ?? new Date();
  const idFactory = input.idFactory ?? (() => nanoid(10));
  const targetMinutes = Math.max(10, Math.min(360, Math.trunc(input.targetMinutes)));
  const masteryByTopic = new Map(input.masteries.map((mastery) => [mastery.topicId, mastery]));
  const topicById = new Map(input.topics.map((topic) => [topic.id, topic]));
  const due = input.masteries
    .filter((mastery) => isReviewDue(mastery.nextReviewAt, now))
    .sort((left, right) => comparePriority(left, right, now));
  const weak = input.masteries
    .filter((mastery) => mastery.attemptCount > 0 && mastery.score < 60)
    .sort((left, right) => left.score - right.score);
  const newMath = firstUnseenTopic("mathematics", input.topics, masteryByTopic);
  const newPhysics = firstUnseenTopic("physics", input.topics, masteryByTopic);
  const candidates: CandidateBlock[] = [];

  candidates.push({
    kind: "mental-math",
    subject: "mathematics",
    title: "Mental Math Warm-up",
    topicIds: [],
    weight: 0.08,
    reason: "Build calculation fluency before the main session.",
  });
  if (newMath) {
    candidates.push({
      kind: "new-math",
      subject: "mathematics",
      title: newMath.title.en,
      topicIds: [newMath.id],
      weight: 0.25,
      reason: "Next unlocked Mathematics topic.",
    });
  }
  if (newPhysics) {
    candidates.push({
      kind: "new-physics",
      subject: "physics",
      title: newPhysics.title.en,
      topicIds: [newPhysics.id],
      weight: 0.28,
      reason: "Next unlocked Physics topic; Physics receives extra foundation time.",
    });
  }
  if ((input.dueEnglishReviewCount ?? 0) > 0 || targetMinutes >= 30) {
    candidates.push({
      kind: "english",
      subject: "english",
      title: "CSCA English Vocabulary",
      topicIds: [],
      weight: 0.1,
      reason: `${input.dueEnglishReviewCount ?? 0} vocabulary reviews are due.`,
    });
  }
  if (weak.length > 0) {
    const selected = weak.slice(0, 2);
    const weakest = selected[0]!;
    candidates.push({
      kind: "weak-topic",
      subject: weakest.subject,
      title: `Strengthen ${topicById.get(weakest.topicId)?.title.en ?? "a weak topic"}`,
      topicIds: selected.map((mastery) => mastery.topicId),
      weight: 0.16,
      reason: `Lowest mastery is ${Math.round(weakest.score)}%.`,
    });
  }
  if (due.length > 0) {
    const firstDue = due[0]!;
    candidates.push({
      kind: "review",
      subject: due.length === 1 ? firstDue.subject : null,
      title: "Spaced Review",
      topicIds: due.slice(0, 4).map((mastery) => mastery.topicId),
      weight: 0.2,
      reason: `${due.length} topic review${due.length === 1 ? " is" : "s are"} due.`,
    });
  }

  const maximumBlocks = Math.max(1, Math.floor(targetMinutes / 5));
  const selectedCandidates = candidates.slice(0, maximumBlocks);
  const minutes = allocateMinutes(
    selectedCandidates.map((candidate) => candidate.weight),
    targetMinutes,
  );
  const timestamp = now.toISOString();
  const planId = `${input.userId}:${input.date}`;
  const reasons = selectedCandidates.map((candidate) => candidate.reason);

  return DailyPlanSchema.parse({
    id: planId,
    userId: input.userId,
    date: input.date,
    timezone: input.timezone,
    blocks: selectedCandidates.map((candidate, index) => ({
      id: idFactory(),
      kind: candidate.kind,
      subject: candidate.subject,
      title: candidate.title,
      topicIds: candidate.topicIds,
      targetMinutes: minutes[index] ?? 1,
      targetQuestionCount:
        candidate.kind === "mental-math"
          ? Math.max(3, Math.round((minutes[index] ?? 1) * 1.2))
          : candidate.kind === "review" || candidate.kind === "weak-topic"
            ? Math.max(3, Math.round((minutes[index] ?? 1) * 0.8))
            : 0,
      reason: candidate.reason,
      status: "upcoming",
      completedAt: null,
    })),
    targetMinutes,
    adaptiveReasons: reasons,
    generatedAt: timestamp,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}
