import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PaginationBar } from '../../components/PaginationBar';
import { StatusChip } from '../../components/StatusChip';
import { ApiError } from '../../lib/api-client';
import { formatScheduleDay, formatTimeRange } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import type { StudentCourse } from '../../types/api';
import { dropCourse, listStudentCourses } from './courses-api';

export const StudentCoursesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dropTarget, setDropTarget] = useState<StudentCourse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const coursesQuery = useQuery({
    queryKey: queryKeys.studentCourses({ page, search }),
    queryFn: () => listStudentCourses({ page, limit: 20, search: search || undefined }),
  });

  const dropMutation = useMutation({
    mutationFn: (course: StudentCourse) => dropCourse(course.id),
    onSuccess: () => {
      setActionError(null);
      setDropTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['student-courses'] });
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to drop this course right now.',
      );
    },
  });

  return (
    <>
      <PageHeader
        title="My courses"
        subtitle="Courses you are enrolled in."
        action={
          <Button variant="contained" onClick={() => navigate('/catalogue')}>
            Browse catalogue
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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Search code or title"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  size="small"
                  fullWidth
                />
                <Button type="submit" variant="outlined">
                  Search
                </Button>
              </Stack>
            </Box>

            {actionError ? <Alert severity="error">{actionError}</Alert> : null}

            {coursesQuery.isLoading ? (
              <LoadingState label="Loading your courses..." />
            ) : coursesQuery.isError || !coursesQuery.data ? (
              <ErrorState
                message="Unable to load your courses."
                onRetry={() => void coursesQuery.refetch()}
              />
            ) : coursesQuery.data.courses.length === 0 ? (
              <EmptyState
                title="You are not enrolled in any courses"
                description="Browse the catalogue to enroll in an open course."
                action={
                  <Button variant="contained" onClick={() => navigate('/catalogue')}>
                    Browse catalogue
                  </Button>
                }
              />
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Course</TableCell>
                      <TableCell>Instructor</TableCell>
                      <TableCell>Term</TableCell>
                      <TableCell>Schedule</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {coursesQuery.data.courses.map((course) => (
                      <TableRow key={course.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {course.code}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {course.title}
                          </Typography>
                        </TableCell>
                        <TableCell>{course.instructor.name}</TableCell>
                        <TableCell>{course.term}</TableCell>
                        <TableCell>
                          {formatScheduleDay(course.scheduleDay)}{' '}
                          {formatTimeRange(course.startTime, course.endTime)}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={course.enrollment.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                            <Button size="small" onClick={() => navigate(`/courses/${course.id}`)}>
                              View
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setDropTarget(course)}
                            >
                              Drop
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <PaginationBar meta={coursesQuery.data.meta} onPageChange={setPage} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(dropTarget)}
        title="Drop course"
        description={
          dropTarget ? `Drop ${dropTarget.code}? You will lose access to its assignments.` : ''
        }
        confirmLabel="Drop course"
        loading={dropMutation.isPending}
        onConfirm={() => {
          if (dropTarget) {
            dropMutation.mutate(dropTarget);
          }
        }}
        onClose={() => setDropTarget(null)}
      />
    </>
  );
};
