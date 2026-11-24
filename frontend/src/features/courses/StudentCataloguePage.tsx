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
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PaginationBar } from '../../components/PaginationBar';
import { StatusChip } from '../../components/StatusChip';
import { ApiError } from '../../lib/api-client';
import { formatScheduleDay, formatTimeRange } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import type { CourseSummary } from '../../types/api';
import { enrollInCourse, listCourses, listStudentCourses } from './courses-api';

export const StudentCataloguePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const coursesQuery = useQuery({
    queryKey: queryKeys.courses({ page, search, scope: 'catalogue' }),
    queryFn: () => listCourses({ page, limit: 20, search: search || undefined }),
  });

  const enrolledQuery = useQuery({
    queryKey: queryKeys.studentCourses({ limit: 100 }),
    queryFn: () => listStudentCourses({ limit: 100 }),
  });

  const enrolledIds = new Set(enrolledQuery.data?.courses.map((course) => course.id) ?? []);

  const enrollMutation = useMutation({
    mutationFn: (course: CourseSummary) => enrollInCourse(course.id),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      void queryClient.invalidateQueries({ queryKey: ['student-courses'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to enroll in this course right now.',
      );
    },
  });

  return (
    <>
      <PageHeader
        title="Course catalogue"
        subtitle="Browse open courses and enroll."
        action={
          <Button variant="outlined" onClick={() => navigate('/student/courses')}>
            My courses
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
              <LoadingState label="Loading catalogue..." />
            ) : coursesQuery.isError || !coursesQuery.data ? (
              <ErrorState
                message="Unable to load the catalogue."
                onRetry={() => void coursesQuery.refetch()}
              />
            ) : coursesQuery.data.courses.length === 0 ? (
              <EmptyState
                title="No open courses"
                description="Check back later for newly opened courses."
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
                      <TableCell>Seats</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {coursesQuery.data.courses.map((course) => {
                      const enrolled = enrolledIds.has(course.id);
                      const full = course.availableSeats <= 0;

                      return (
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
                            {course.enrolledCount} / {course.capacity}
                          </TableCell>
                          <TableCell>
                            <StatusChip status={course.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                              <Button
                                size="small"
                                onClick={() => navigate(`/courses/${course.id}`)}
                              >
                                View
                              </Button>
                              {enrolled ? (
                                <Button size="small" disabled>
                                  Enrolled
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={full || enrollMutation.isPending}
                                  onClick={() => enrollMutation.mutate(course)}
                                >
                                  {full ? 'Full' : 'Enroll'}
                                </Button>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <PaginationBar meta={coursesQuery.data.meta} onPageChange={setPage} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </>
  );
};
