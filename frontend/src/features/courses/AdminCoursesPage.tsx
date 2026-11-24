import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
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
import { listUsers } from '../users/users-api';
import { ApiError } from '../../lib/api-client';
import { formatScheduleDay, formatTimeRange } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import type { CourseDetail, CourseStatus, CourseSummary } from '../../types/api';
import { CourseFormDialog } from './CourseFormDialog';
import { deleteCourse, getCourse, listAdminCourses } from './courses-api';

export const AdminCoursesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CourseStatus | ''>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const instructorsQuery = useQuery({
    queryKey: queryKeys.users({ role: 'INSTRUCTOR', isActive: true, limit: 100 }),
    queryFn: () => listUsers({ role: 'INSTRUCTOR', isActive: true, limit: 100 }),
  });

  const coursesQuery = useQuery({
    queryKey: queryKeys.courses({ page, limit: 20, search, status, scope: 'admin' }),
    queryFn: () =>
      listAdminCourses({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (course: CourseSummary) => deleteCourse(course.id),
    onSuccess: () => {
      setActionError(null);
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to delete the course right now.',
      );
    },
  });

  const openCreate = () => {
    setEditingCourse(null);
    setDialogOpen(true);
  };

  const openEdit = async (course: CourseSummary) => {
    try {
      const detail = await getCourse(course.id);
      setEditingCourse(detail);
      setDialogOpen(true);
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to open this course for editing.',
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Create courses and assign instructors."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Create course
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
                  label="Search code or title"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  select
                  label="Status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as CourseStatus | '');
                    setPage(1);
                  }}
                  size="small"
                  sx={{ minWidth: 170 }}
                >
                  <MenuItem value="">All statuses</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="OPEN">Open</MenuItem>
                  <MenuItem value="CLOSED">Closed</MenuItem>
                  <MenuItem value="ARCHIVED">Archived</MenuItem>
                </TextField>
                <Button type="submit" variant="outlined">
                  Search
                </Button>
              </Stack>
            </Box>

            {actionError ? <Alert severity="error">{actionError}</Alert> : null}

            {coursesQuery.isLoading ? (
              <LoadingState label="Loading courses..." />
            ) : coursesQuery.isError || !coursesQuery.data ? (
              <ErrorState
                message="Unable to load courses."
                onRetry={() => void coursesQuery.refetch()}
              />
            ) : coursesQuery.data.courses.length === 0 ? (
              <EmptyState
                title="No courses found"
                description="Create a course or adjust your filters."
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
                          {course.enrolledCount} / {course.capacity}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={course.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                            <Button size="small" onClick={() => navigate(`/courses/${course.id}`)}>
                              View
                            </Button>
                            <Button
                              size="small"
                              onClick={() => navigate(`/courses/${course.id}/students`)}
                            >
                              Roster
                            </Button>
                            <Button
                              size="small"
                              onClick={() => {
                                void openEdit(course);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setDeleteTarget(course)}
                            >
                              Delete
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

      <CourseFormDialog
        open={dialogOpen}
        course={editingCourse}
        instructors={instructorsQuery.data?.users ?? []}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete course"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.code} - ${deleteTarget.title}? This also removes its assignments and enrollments.`
            : ''
        }
        confirmLabel="Delete course"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget);
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};
