import {
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PaginationBar } from '../../components/PaginationBar';
import { StatusChip } from '../../components/StatusChip';
import { formatDateTime, formatGrade } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import type { SubmissionDetail } from '../../types/api';
import { getAssignment } from '../assignments/assignments-api';
import { GradeDialog } from './GradeDialog';
import { listAssignmentSubmissions } from './submissions-api';

export const InstructorSubmissionsPage = () => {
  const { id } = useParams<{ id: string }>();
  const assignmentId = id ?? '';
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [graded, setGraded] = useState<'' | 'true' | 'false'>('');
  const [gradeTarget, setGradeTarget] = useState<SubmissionDetail | null>(null);

  const assignmentQuery = useQuery({
    queryKey: queryKeys.assignment(assignmentId),
    queryFn: () => getAssignment(assignmentId),
    enabled: Boolean(assignmentId),
  });

  const submissionsQuery = useQuery({
    queryKey: queryKeys.submissions({ assignmentId, page, search, graded }),
    queryFn: () =>
      listAssignmentSubmissions(assignmentId, {
        page,
        limit: 20,
        search: search || undefined,
        isGraded: graded === '' ? undefined : graded === 'true',
      }),
    enabled: Boolean(assignmentId),
  });

  if (!assignmentId) {
    return <ErrorState message="The assignment identifier is missing." />;
  }

  if (assignmentQuery.isLoading) {
    return <LoadingState label="Loading submissions..." />;
  }

  if (assignmentQuery.isError || !assignmentQuery.data) {
    return (
      <ErrorState
        message="Unable to load this assignment."
        onRetry={() => void assignmentQuery.refetch()}
      />
    );
  }

  const assignment = assignmentQuery.data;

  return (
    <>
      <PageHeader
        title={`Submissions - ${assignment.title}`}
        subtitle={`${assignment.course.code} · ${assignment.maxScore} points`}
        action={
          <Button variant="text" onClick={() => navigate('/instructor/assignments')}>
            Back to assignments
          </Button>
        }
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput);
                setPage(1);
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Search student name or email"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  select
                  label="Grading status"
                  value={graded}
                  onChange={(event) => {
                    setGraded(event.target.value as '' | 'true' | 'false');
                    setPage(1);
                  }}
                  size="small"
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="">All submissions</MenuItem>
                  <MenuItem value="false">Ungraded</MenuItem>
                  <MenuItem value="true">Graded</MenuItem>
                </TextField>
                <Button type="submit" variant="outlined">
                  Search
                </Button>
              </Stack>
            </Box>

            {submissionsQuery.isLoading ? (
              <LoadingState label="Loading submissions..." />
            ) : submissionsQuery.isError || !submissionsQuery.data ? (
              <ErrorState
                message="Unable to load submissions."
                onRetry={() => void submissionsQuery.refetch()}
              />
            ) : submissionsQuery.data.submissions.length === 0 ? (
              <EmptyState
                title="No submissions found"
                description="Submissions from enrolled students will appear here."
              />
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Submitted</TableCell>
                      <TableCell>Late</TableCell>
                      <TableCell>Grade</TableCell>
                      <TableCell>Feedback</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {submissionsQuery.data.submissions.map((submission) => (
                      <TableRow key={submission.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {submission.student.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {submission.student.email}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatDateTime(submission.submittedAt)}</TableCell>
                        <TableCell>
                          {submission.isLate ? <StatusChip status="LATE" /> : 'No'}
                        </TableCell>
                        <TableCell>{formatGrade(submission.grade, assignment.maxScore)}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              maxWidth: 220,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {submission.feedback ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => setGradeTarget(submission)}>
                            {submission.gradedAt ? 'Regrade' : 'Grade'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <PaginationBar meta={submissionsQuery.data.meta} onPageChange={setPage} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <GradeDialog
        open={Boolean(gradeTarget)}
        submission={gradeTarget}
        maxScore={assignment.maxScore}
        onClose={() => setGradeTarget(null)}
      />
    </>
  );
};
