import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CourseStatus,
  EnrollmentStatus,
  PrismaClient,
  Role,
  Weekday,
} from '../src/generated/prisma/client.ts';

const DEMO_PASSWORD_HASH = '$2b$12$21xo24dwHM4wHR5q8bWP4.kkHJqNrvm9pUW8hWHhqSn1Gs8mUl3SC';

const idFor = (key: string): string => {
  const hex = createHash('sha256').update(key).digest('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error(
    'DIRECT_URL is required to run the seed. Set it to the direct Neon connection string.',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: directUrl }),
});

const users = [
  {
    key: 'admin',
    name: 'Avery Admin',
    email: 'admin@campushub.local',
    role: Role.ADMIN,
  },
  {
    key: 'instructor-maya',
    name: 'Dr. Maya Chen',
    email: 'maya.chen@campushub.local',
    role: Role.INSTRUCTOR,
  },
  {
    key: 'instructor-daniel',
    name: 'Prof. Daniel Okafor',
    email: 'daniel.okafor@campushub.local',
    role: Role.INSTRUCTOR,
  },
  {
    key: 'student-priya',
    name: 'Priya Patel',
    email: 'priya.patel@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-jordan',
    name: 'Jordan Lee',
    email: 'jordan.lee@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-sofia',
    name: 'Sofia Martinez',
    email: 'sofia.martinez@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-ethan',
    name: 'Ethan Brown',
    email: 'ethan.brown@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-amara',
    name: 'Amara Johnson',
    email: 'amara.johnson@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-liam',
    name: 'Liam Nguyen',
    email: 'liam.nguyen@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-grace',
    name: 'Grace Kim',
    email: 'grace.kim@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-noah',
    name: 'Noah Williams',
    email: 'noah.williams@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-isabella',
    name: 'Isabella Garcia',
    email: 'isabella.garcia@campushub.local',
    role: Role.STUDENT,
  },
  {
    key: 'student-lucas',
    name: 'Lucas Thompson',
    email: 'lucas.thompson@campushub.local',
    role: Role.STUDENT,
  },
] as const;

const courses = [
  {
    code: 'CSE-2201',
    title: 'Data Structures and Algorithms',
    description:
      'Core data structures, algorithm analysis, and practical problem-solving with linked lists, trees, graphs, and hash tables.',
    credits: 4,
    capacity: 40,
    term: 'Fall 2026',
    scheduleDay: Weekday.MONDAY,
    startTime: '09:00',
    endTime: '10:30',
    room: 'CS-101',
    status: CourseStatus.OPEN,
    instructorKey: 'instructor-maya',
  },
  {
    code: 'CSE-3101',
    title: 'Database Systems',
    description:
      'Relational modelling, SQL, transactions, indexing, and application integration using PostgreSQL.',
    credits: 4,
    capacity: 35,
    term: 'Fall 2026',
    scheduleDay: Weekday.WEDNESDAY,
    startTime: '11:00',
    endTime: '12:30',
    room: 'CS-204',
    status: CourseStatus.OPEN,
    instructorKey: 'instructor-maya',
  },
  {
    code: 'MAT-2101',
    title: 'Discrete Mathematics',
    description:
      'Logic, proofs, sets, relations, combinatorics, and graph theory for computing students.',
    credits: 3,
    capacity: 45,
    term: 'Fall 2026',
    scheduleDay: Weekday.TUESDAY,
    startTime: '14:00',
    endTime: '15:30',
    room: 'MATH-110',
    status: CourseStatus.OPEN,
    instructorKey: 'instructor-daniel',
  },
  {
    code: 'CSE-4101',
    title: 'Software Engineering',
    description:
      'Requirements, architecture, testing, code review, and delivery practices for maintainable software.',
    credits: 4,
    capacity: 30,
    term: 'Spring 2027',
    scheduleDay: Weekday.THURSDAY,
    startTime: '10:00',
    endTime: '11:30',
    room: 'CS-301',
    status: CourseStatus.OPEN,
    instructorKey: 'instructor-daniel',
  },
  {
    code: 'BUS-1050',
    title: 'Foundations of Management',
    description:
      'An introduction to organisational behaviour, team leadership, and practical management decision-making.',
    credits: 3,
    capacity: 50,
    term: 'Spring 2027',
    scheduleDay: Weekday.FRIDAY,
    startTime: '13:00',
    endTime: '14:30',
    room: 'BUS-120',
    status: CourseStatus.DRAFT,
    instructorKey: 'instructor-daniel',
  },
] as const;

const enrollments = [
  { studentKey: 'student-priya', courseCode: 'CSE-2201' },
  { studentKey: 'student-jordan', courseCode: 'CSE-2201' },
  { studentKey: 'student-sofia', courseCode: 'CSE-2201' },
  { studentKey: 'student-ethan', courseCode: 'CSE-2201' },
  { studentKey: 'student-amara', courseCode: 'CSE-2201' },
  { studentKey: 'student-jordan', courseCode: 'CSE-3101' },
  { studentKey: 'student-sofia', courseCode: 'CSE-3101' },
  { studentKey: 'student-ethan', courseCode: 'CSE-3101' },
  { studentKey: 'student-amara', courseCode: 'CSE-3101' },
  { studentKey: 'student-liam', courseCode: 'CSE-3101' },
  { studentKey: 'student-amara', courseCode: 'MAT-2101' },
  { studentKey: 'student-liam', courseCode: 'MAT-2101' },
  { studentKey: 'student-grace', courseCode: 'MAT-2101' },
  { studentKey: 'student-noah', courseCode: 'MAT-2101' },
  { studentKey: 'student-isabella', courseCode: 'MAT-2101' },
  { studentKey: 'student-priya', courseCode: 'CSE-4101' },
  { studentKey: 'student-sofia', courseCode: 'CSE-4101' },
  { studentKey: 'student-grace', courseCode: 'CSE-4101' },
  { studentKey: 'student-lucas', courseCode: 'CSE-4101' },
] as const;

const assignments = [
  {
    courseCode: 'CSE-2201',
    slug: 'linked-list-lab',
    title: 'Linked List Lab',
    description:
      'Implement a singly linked list with insertion, removal, search, and reverse operations. Include tests for edge cases.',
    dueAt: new Date('2026-09-18T23:59:00.000Z'),
    maxScore: 100,
  },
  {
    courseCode: 'CSE-2201',
    slug: 'trees-worksheet',
    title: 'Trees and Traversal Worksheet',
    description:
      'Trace breadth-first and depth-first traversals, then compare their complexity on balanced and skewed trees.',
    dueAt: new Date('2026-10-02T23:59:00.000Z'),
    maxScore: 100,
  },
  {
    courseCode: 'CSE-3101',
    slug: 'schema-design-project',
    title: 'Schema Design Project',
    description:
      'Design a normalized schema for a small booking system. Include keys, relations, indexes, and a short rationale.',
    dueAt: new Date('2026-09-25T23:59:00.000Z'),
    maxScore: 50,
  },
  {
    courseCode: 'CSE-3101',
    slug: 'sql-query-assignment',
    title: 'SQL Query Assignment',
    description:
      'Write queries that combine joins, aggregation, filtering, and ordering against the provided sample database.',
    dueAt: new Date('2026-10-09T23:59:00.000Z'),
    maxScore: 50,
  },
  {
    courseCode: 'MAT-2101',
    slug: 'proof-techniques',
    title: 'Proof Techniques Worksheet',
    description:
      'Complete the direct proof, contradiction, and induction exercises. Show each step of the argument.',
    dueAt: new Date('2026-09-22T23:59:00.000Z'),
    maxScore: 20,
  },
  {
    courseCode: 'CSE-4101',
    slug: 'requirements-specification',
    title: 'Requirements Specification',
    description:
      'Write a concise requirements specification for a campus service, including user stories and acceptance criteria.',
    dueAt: new Date('2026-09-30T23:59:00.000Z'),
    maxScore: 100,
  },
  {
    courseCode: 'BUS-1050',
    slug: 'case-study-proposal',
    title: 'Case Study Proposal',
    description:
      'Propose a fictional organisation and a management challenge for the term case study.',
    dueAt: new Date('2026-10-16T23:59:00.000Z'),
    maxScore: 25,
  },
] as const;

type SeedSubmission = {
  courseCode: string;
  assignmentSlug: string;
  studentKey: string;
  content: string;
  submittedAt: Date;
  score?: number;
  feedback?: string;
  gradedAt?: Date;
};

const submissions: readonly SeedSubmission[] = [
  {
    courseCode: 'CSE-2201',
    assignmentSlug: 'linked-list-lab',
    studentKey: 'student-priya',
    content:
      'Implemented the list operations and added tests for empty, single-node, and duplicate-value cases.',
    submittedAt: new Date('2026-09-15T14:00:00.000Z'),
  },
  {
    courseCode: 'CSE-2201',
    assignmentSlug: 'linked-list-lab',
    studentKey: 'student-jordan',
    content:
      'Completed the lab with an iterative reverse and a test suite covering the required operations.',
    submittedAt: new Date('2026-09-16T09:30:00.000Z'),
    score: 88,
    feedback:
      'Clear implementation and useful edge-case tests. Add a note on time complexity next time.',
    gradedAt: new Date('2026-09-20T12:00:00.000Z'),
  },
  {
    courseCode: 'CSE-2201',
    assignmentSlug: 'linked-list-lab',
    studentKey: 'student-sofia',
    content:
      'My submission includes the linked list class, a small demo, and tests for insertion and removal.',
    submittedAt: new Date('2026-09-17T18:15:00.000Z'),
  },
  {
    courseCode: 'CSE-2201',
    assignmentSlug: 'trees-worksheet',
    studentKey: 'student-jordan',
    content: 'Traced both traversals and included complexity notes for balanced and skewed trees.',
    submittedAt: new Date('2026-09-30T16:45:00.000Z'),
  },
  {
    courseCode: 'CSE-3101',
    assignmentSlug: 'schema-design-project',
    studentKey: 'student-jordan',
    content:
      'Designed a booking schema in third normal form with indexes for the common availability lookup.',
    submittedAt: new Date('2026-09-23T11:20:00.000Z'),
    score: 46,
    feedback: 'Strong schema and rationale. Consider a partial index for the active-booking query.',
    gradedAt: new Date('2026-09-28T10:00:00.000Z'),
  },
  {
    courseCode: 'CSE-3101',
    assignmentSlug: 'schema-design-project',
    studentKey: 'student-sofia',
    content:
      'Submitted an entity-relationship diagram, relational schema, and index plan for the booking system.',
    submittedAt: new Date('2026-09-24T20:00:00.000Z'),
  },
  {
    courseCode: 'CSE-3101',
    assignmentSlug: 'sql-query-assignment',
    studentKey: 'student-ethan',
    content:
      'Included all required queries plus a short explanation of the join and aggregation choices.',
    submittedAt: new Date('2026-10-08T19:10:00.000Z'),
  },
  {
    courseCode: 'MAT-2101',
    assignmentSlug: 'proof-techniques',
    studentKey: 'student-amara',
    content:
      'Completed every exercise and wrote out each induction step with the base case clearly identified.',
    submittedAt: new Date('2026-09-21T13:40:00.000Z'),
    score: 18,
    feedback: 'Very clear proof structure. The final induction step can be condensed slightly.',
    gradedAt: new Date('2026-09-26T09:00:00.000Z'),
  },
  {
    courseCode: 'MAT-2101',
    assignmentSlug: 'proof-techniques',
    studentKey: 'student-liam',
    content:
      'Submitted the worksheet with direct proofs and one contradiction proof for the final question.',
    submittedAt: new Date('2026-09-22T17:25:00.000Z'),
  },
  {
    courseCode: 'CSE-4101',
    assignmentSlug: 'requirements-specification',
    studentKey: 'student-priya',
    content:
      'Wrote five user stories with acceptance criteria and a short note on non-functional requirements.',
    submittedAt: new Date('2026-09-29T15:30:00.000Z'),
  },
  {
    courseCode: 'CSE-4101',
    assignmentSlug: 'requirements-specification',
    studentKey: 'student-sofia',
    content:
      'Included the problem statement, user stories, acceptance criteria, and open questions for the client.',
    submittedAt: new Date('2026-09-30T08:05:00.000Z'),
  },
];

const announcements = [
  {
    key: 'welcome',
    title: 'Welcome to CampusHub',
    body: 'CampusHub is now available for the Fall 2026 term. Use the portal to browse courses, manage enrollments, and keep up with announcements.',
    courseCode: null,
    authorKey: 'admin',
    publishedAt: new Date('2026-09-01T08:00:00.000Z'),
  },
  {
    key: 'fall-add-drop',
    title: 'Fall 2026 add/drop window',
    body: 'The add/drop window is open through September 12. Review your schedule and confirm your enrollments before the deadline.',
    courseCode: null,
    authorKey: 'admin',
    publishedAt: new Date('2026-09-05T09:00:00.000Z'),
  },
  {
    key: 'cse2201-linked-list',
    title: 'Linked List Lab posted',
    body: 'The first lab is available now. Start early, test the edge cases, and bring questions to Monday office hours.',
    courseCode: 'CSE-2201',
    authorKey: 'instructor-maya',
    publishedAt: new Date('2026-09-08T10:30:00.000Z'),
  },
  {
    key: 'cse3101-project-groups',
    title: 'Database project groups',
    body: 'Project groups will be confirmed this week. Each group should choose a domain and prepare a one-page scope summary.',
    courseCode: 'CSE-3101',
    authorKey: 'instructor-maya',
    publishedAt: new Date('2026-09-10T14:00:00.000Z'),
  },
  {
    key: 'cse4101-guest-lecture',
    title: 'Guest lecture: production readiness',
    body: 'A guest engineer will discuss deployment checklists, observability, and incident response during Thursday class.',
    courseCode: 'CSE-4101',
    authorKey: 'instructor-daniel',
    publishedAt: new Date('2026-09-15T11:00:00.000Z'),
  },
  {
    key: 'mat2101-office-hours',
    title: 'Discrete Mathematics office hours',
    body: 'Extra office hours are available before the proof worksheet deadline. Check the course page for the room.',
    courseCode: 'MAT-2101',
    authorKey: 'instructor-daniel',
    publishedAt: new Date('2026-09-17T16:00:00.000Z'),
  },
] as const;

const main = async (): Promise<void> => {
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        isActive: true,
        passwordHash: DEMO_PASSWORD_HASH,
      },
      create: {
        id: idFor(`user:${user.key}`),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: true,
        passwordHash: DEMO_PASSWORD_HASH,
      },
    });
  }

  for (const course of courses) {
    const courseId = idFor(`course:${course.code}`);

    await prisma.course.upsert({
      where: { code: course.code },
      update: {
        title: course.title,
        description: course.description,
        credits: course.credits,
        capacity: course.capacity,
        term: course.term,
        scheduleDay: course.scheduleDay,
        startTime: course.startTime,
        endTime: course.endTime,
        room: course.room,
        status: course.status,
        instructorId: idFor(`user:${course.instructorKey}`),
      },
      create: {
        id: courseId,
        code: course.code,
        title: course.title,
        description: course.description,
        credits: course.credits,
        capacity: course.capacity,
        term: course.term,
        scheduleDay: course.scheduleDay,
        startTime: course.startTime,
        endTime: course.endTime,
        room: course.room,
        status: course.status,
        instructorId: idFor(`user:${course.instructorKey}`),
      },
    });
  }

  for (const enrollment of enrollments) {
    const studentId = idFor(`user:${enrollment.studentKey}`);
    const courseId = idFor(`course:${enrollment.courseCode}`);

    await prisma.enrollment.upsert({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
      update: {
        status: EnrollmentStatus.ENROLLED,
      },
      create: {
        id: idFor(`enrollment:${enrollment.studentKey}:${enrollment.courseCode}`),
        studentId,
        courseId,
        status: EnrollmentStatus.ENROLLED,
      },
    });
  }

  for (const assignment of assignments) {
    await prisma.assignment.upsert({
      where: {
        id: idFor(`assignment:${assignment.courseCode}:${assignment.slug}`),
      },
      update: {
        courseId: idFor(`course:${assignment.courseCode}`),
        title: assignment.title,
        description: assignment.description,
        dueAt: assignment.dueAt,
        maxScore: assignment.maxScore,
      },
      create: {
        id: idFor(`assignment:${assignment.courseCode}:${assignment.slug}`),
        courseId: idFor(`course:${assignment.courseCode}`),
        title: assignment.title,
        description: assignment.description,
        dueAt: assignment.dueAt,
        maxScore: assignment.maxScore,
      },
    });
  }

  for (const submission of submissions) {
    const assignmentId = idFor(`assignment:${submission.courseCode}:${submission.assignmentSlug}`);
    const studentId = idFor(`user:${submission.studentKey}`);

    await prisma.submission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId,
        },
      },
      update: {
        content: submission.content,
        submittedAt: submission.submittedAt,
        score: submission.score ?? null,
        feedback: submission.feedback ?? null,
        gradedAt: submission.gradedAt ?? null,
      },
      create: {
        id: idFor(
          `submission:${submission.courseCode}:${submission.assignmentSlug}:${submission.studentKey}`,
        ),
        assignmentId,
        studentId,
        content: submission.content,
        submittedAt: submission.submittedAt,
        score: submission.score ?? null,
        feedback: submission.feedback ?? null,
        gradedAt: submission.gradedAt ?? null,
      },
    });
  }

  for (const announcement of announcements) {
    await prisma.announcement.upsert({
      where: { id: idFor(`announcement:${announcement.key}`) },
      update: {
        title: announcement.title,
        body: announcement.body,
        courseId: announcement.courseCode ? idFor(`course:${announcement.courseCode}`) : null,
        authorId: idFor(`user:${announcement.authorKey}`),
        publishedAt: announcement.publishedAt,
      },
      create: {
        id: idFor(`announcement:${announcement.key}`),
        title: announcement.title,
        body: announcement.body,
        courseId: announcement.courseCode ? idFor(`course:${announcement.courseCode}`) : null,
        authorId: idFor(`user:${announcement.authorKey}`),
        publishedAt: announcement.publishedAt,
      },
    });
  }

  const [
    userCount,
    courseCount,
    enrollmentCount,
    assignmentCount,
    submissionCount,
    announcementCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.assignment.count(),
    prisma.submission.count(),
    prisma.announcement.count(),
  ]);

  console.log('Seed completed.', {
    users: userCount,
    courses: courseCount,
    enrollments: enrollmentCount,
    assignments: assignmentCount,
    submissions: submissionCount,
    announcements: announcementCount,
  });
};

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
