import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ensureMentorshipSchema } from "./mentorshipSchema";

// Numbers for the six tiles on the student profile, all from real data:
//  - tests the student submitted (test_submissions) compared with every other student's,
//  - lessons opened in their enrolled courses (lesson_progress),
//  - the daily streak is read from the users row by the profile route.
// "Rank" means rank among EduRAIN students who took the same tests (there is no national data).

export type StudentStats = {
  /** Avg. Mock Pace: total time in submitted tests ÷ total questions in them */
  pace: { secondsPerQuestion: number; tests: number } | null;
  /** AI Accuracy Rate: correct ÷ answered (correct + wrong), compared with all students */
  accuracy: { percent: number; correct: number; answered: number; platformPercent: number | null } | null;
  /** AIR Marks Prediction: average score % across tests, ranked among all students who took tests */
  standing: { topPercent: number; rank: number; students: number; averagePercent: number } | null;
  /** Predictive AIR Marks Analysis: rank in the latest test and the change since the previous one */
  latestTest: {
    title: string;
    rank: number;
    students: number;
    score: number;
    maxMarks: number;
    /** Positions gained since the previous test (negative = dropped); null when it is the first test */
    positionsGained: number | null;
  } | null;
  /** Overall Syllabus Velocity: lessons opened ÷ lessons in the enrolled courses */
  syllabus: {
    percent: number;
    done: number;
    total: number;
    /** Course with the most lessons left */
    focus: { title: string; remaining: number } | null;
  } | null;
};

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const round1 = (v: number) => Math.round(v * 10) / 10;

// Best submitted attempt per student per test, with the test's maximum marks
const BEST_SCORES = sql`
  max_marks AS (
    SELECT t.id AS test_id, t.title, SUM(COALESCE(q.marks_positive, t.marks_positive)) AS max_marks
    FROM tests t JOIN test_questions q ON q.test_id = t.id
    GROUP BY t.id, t.title
  ),
  best AS (
    SELECT DISTINCT ON (s.user_id, s.test_id) s.user_id, s.test_id, s.score
    FROM test_submissions s
    WHERE s.status = 'SUBMITTED'
    ORDER BY s.user_id, s.test_id, s.score DESC, s.submitted_at DESC
  )`;

async function rankInTest(userId: number, testId: number) {
  const { rows } = await db.execute<{ title: string; score: number; max_marks: number; rank: number; students: number }>(sql`
    WITH ${BEST_SCORES}
    SELECT m.title, mine.score, m.max_marks,
           1 + (SELECT count(*) FROM best b WHERE b.test_id = ${testId} AND b.score > mine.score) AS rank,
           (SELECT count(*) FROM best b WHERE b.test_id = ${testId}) AS students
    FROM best mine JOIN max_marks m ON m.test_id = mine.test_id
    WHERE mine.user_id = ${userId} AND mine.test_id = ${testId}
  `);
  return rows[0] ?? null;
}

export async function loadStudentStats(userId: number): Promise<StudentStats> {
  // Time, questions and answers across the student's submitted tests, and the platform accuracy
  const { rows: totalsRows } = await db.execute<{
    tests: number;
    seconds: number;
    questions: number;
    correct: number;
    wrong: number;
    all_correct: number;
    all_wrong: number;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE user_id = ${userId}) AS tests,
      coalesce(sum(extract(epoch FROM (submitted_at - started_at))) FILTER (WHERE user_id = ${userId}), 0) AS seconds,
      coalesce(sum(total_questions) FILTER (WHERE user_id = ${userId}), 0) AS questions,
      coalesce(sum(correct_count) FILTER (WHERE user_id = ${userId}), 0) AS correct,
      coalesce(sum(wrong_count) FILTER (WHERE user_id = ${userId}), 0) AS wrong,
      coalesce(sum(correct_count), 0) AS all_correct,
      coalesce(sum(wrong_count), 0) AS all_wrong
    FROM test_submissions
    WHERE status = 'SUBMITTED' AND submitted_at IS NOT NULL
  `);
  const t = totalsRows[0];
  const tests = num(t?.tests);
  const questions = num(t?.questions);
  const answered = num(t?.correct) + num(t?.wrong);
  const allAnswered = num(t?.all_correct) + num(t?.all_wrong);

  const pace = tests && questions ? { secondsPerQuestion: Math.round(num(t.seconds) / questions), tests } : null;
  const accuracy = answered
    ? {
        percent: round1((num(t.correct) / answered) * 100),
        correct: num(t.correct),
        answered,
        platformPercent: allAnswered ? round1((num(t.all_correct) / allAnswered) * 100) : null,
      }
    : null;

  // Average score % per student across their tests, and where this student stands
  let standing: StudentStats["standing"] = null;
  if (tests) {
    const { rows } = await db.execute<{ mine: number | null; students: number; above: number }>(sql`
      WITH ${BEST_SCORES},
      pct AS (
        SELECT b.user_id, avg(CASE WHEN m.max_marks > 0 THEN b.score / m.max_marks ELSE 0 END) AS avg_pct
        FROM best b JOIN max_marks m ON m.test_id = b.test_id
        GROUP BY b.user_id
      )
      SELECT (SELECT avg_pct FROM pct WHERE user_id = ${userId}) AS mine,
             (SELECT count(*) FROM pct) AS students,
             (SELECT count(*) FROM pct WHERE avg_pct > (SELECT avg_pct FROM pct WHERE user_id = ${userId})) AS above
    `);
    const r = rows[0];
    if (r && r.mine !== null && num(r.students) > 0) {
      const rank = num(r.above) + 1;
      const students = num(r.students);
      standing = {
        rank,
        students,
        topPercent: Math.max(0.1, round1((rank / students) * 100)),
        averagePercent: round1(num(r.mine) * 100),
      };
    }
  }

  // Latest test (and the one before it) for the rank change
  let latestTest: StudentStats["latestTest"] = null;
  if (tests) {
    const { rows: recent } = await db.execute<{ test_id: number }>(sql`
      SELECT test_id FROM test_submissions
      WHERE user_id = ${userId} AND status = 'SUBMITTED'
      GROUP BY test_id ORDER BY max(submitted_at) DESC LIMIT 2
    `);
    const latest = recent[0] ? await rankInTest(userId, num(recent[0].test_id)) : null;
    const previous = recent[1] ? await rankInTest(userId, num(recent[1].test_id)) : null;
    if (latest) {
      latestTest = {
        title: latest.title,
        rank: num(latest.rank),
        students: num(latest.students),
        score: round1(num(latest.score)),
        maxMarks: round1(num(latest.max_marks)),
        positionsGained: previous ? num(previous.rank) - num(latest.rank) : null,
      };
    }
  }

  // Lessons opened in the enrolled courses
  await ensureMentorshipSchema();
  const { rows: courseRows } = await db.execute<{ title: string; total: number; done: number }>(sql`
    SELECT c.title,
      (SELECT count(*) FROM course_content cc WHERE cc.course_id = c.id AND cc.type <> 'folder') AS total,
      (SELECT count(*) FROM lesson_progress lp JOIN course_content cc ON cc.id::text = lp.content_id
        WHERE lp.user_id = ${userId} AND cc.course_id = c.id AND cc.type <> 'folder') AS done
    FROM courses c
    WHERE c.id IN (SELECT course_id FROM user_courses WHERE user_id = ${userId})
  `);
  const total = courseRows.reduce((sum, c) => sum + num(c.total), 0);
  const done = courseRows.reduce((sum, c) => sum + num(c.done), 0);
  const focus = courseRows
    .map((c) => ({ title: c.title, remaining: num(c.total) - num(c.done) }))
    .filter((c) => c.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)[0];
  const syllabus = total ? { percent: round1((done / total) * 100), done, total, focus: focus ?? null } : null;

  return { pace, accuracy, standing, latestTest, syllabus };
}