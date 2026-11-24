import {
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PaginationBar } from '../../components/PaginationBar';
import { StatusChip } from '../../components/StatusChip';
import { formatDateTime, formatGrade } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { listStudentCourses } from '../courses/courses-api';
import { listStudentSubmissions } from '../submissions/submissions-api';

export const StudentGradesPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const submissionsQuery = useQuery({
    queryKey: queryKeys.submissions({ scope: 'student', page }),
    queryFn: () => listStudentSubmissions({ page, limit: 20 }),
  });

  const coursesQuery = useQuery({
    queryKey: queryKeys.studentCourses({ limit: 100 }),
    queryFn: () => listStudentCourses({ limit: 100 }),
  });

  const courseById = new Map(
    (coursesQuery.data?.courses ?? []).map((course) => [course.id, course]),
  );

  return (
    <>
      <PageHeader
        title="My grades"
        subtitle="Grades and feedback for your submissions."
        action={
          <Typography
            component="button"
            onClick={() => navigate('/student/assignments')}
            sx={{
              border: 0,
              background: 'none',
              color: 'primary.main',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            View assignments
          </Typography>
        }
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            {submissionsQuery.isLoading ? (
              <LoadingState label="Loading grades..." />
            ) : submissionsQuery.isError || !submissionsQuery.data ? (
              <ErrorState
                message="Unable to load your grades."
                onRetry={() => void submissionsQuery.refetch()}
              />
            ) : submissionsQuery.data.submissions.length === 0 ? (
              <EmptyState
                title="No submissions yet"
                description="Grades will appear here once you submit assignments."
              />
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Assignment</TableCell>
                      <TableCell>Course</TableCell>
                      <TableCell>Submitted</TableCell>
                      <TableCell>Late</TableCell>
                      <TableCell>Grade</TableCell>
                      <TableCell>Feedback</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {submissionsQuery.data.submissions.map((submission) => {
                      const course = courseById.get(submission.assignment.courseId);

                      return (
                        <TableRow
                          key={submission.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/assignments/${submission.assignmentId}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {submission.assignment.title}
                            </Typography>
                          </TableCell>
                          <TableCell>{course?.code ?? '—'}</TableCell>
                          <TableCell>{formatDateTime(submission.submittedAt)}</TableCell>
                          <TableCell>
                            {submission.isLate ? <StatusChip status="LATE" /> : 'No'}
                          </TableCell>
                          <TableCell>
                            {formatGrade(submission.grade, submission.assignment.maxScore)}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                maxWidth: 260,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {submission.feedback ?? '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <PaginationBar meta={submissionsQuery.data.meta} onPageChange={setPage} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </>
  );
};
